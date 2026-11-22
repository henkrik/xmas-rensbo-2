import { debugLog } from '../core/debugConsole';
import { GameState } from '../world/gameState';
import { LevelId } from '../world/levels/types';
import {
  Camera3D,
  Mat4,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
} from './math3d';
import {
  buildDynamicSceneMeshes,
  extractOutlineMesh,
  FLOATS_PER_VERTEX,
  getStaticLevelMesh,
  MeshData,
} from './models3d';
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  getProceduralTextureAtlas,
} from './textures3d';

const VERTEX_STRIDE_BYTES = FLOATS_PER_VERTEX * 4; // 56 bytes

export interface Hardware3DRenderer {
  render(state: GameState, camera: Camera3D): Mat4;
}

const VERTEX_SHADER_CEL = `
precision highp float;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;
attribute vec4 a_color;
attribute float a_texId;
attribute float a_outlineScale;

uniform mat4 u_viewProj;

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec4 v_color;
varying float v_texId;

void main() {
  vec4 clipPos = u_viewProj * vec4(a_position, 1.0);
  gl_Position = vec4(clipPos.xy, clipPos.z * 2.0 - clipPos.w, clipPos.w);
  v_worldPos = a_position;
  v_normal = a_normal;
  v_uv = a_uv;
  v_color = a_color;
  v_texId = a_texId;
}
`;

const FRAGMENT_SHADER_CEL = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec4 v_color;
varying float v_texId;

uniform sampler2D u_atlas;
uniform vec4 u_cameraPosAndTime;
uniform vec4 u_sunDirAndAmbient;
uniform vec4 u_fogColorAndStart;
uniform vec4 u_fogEndAndFlags;
uniform vec4 u_light0PosRad;
uniform vec4 u_light0ColorInt;
uniform vec4 u_light1PosRad;
uniform vec4 u_light1ColorInt;

vec4 sampleAtlas(float texIdFloat, vec2 rawUv) {
  float tid = clamp(floor(texIdFloat + 0.5), 0.0, 19.0);
  float col = mod(tid, ${ATLAS_COLS}.0);
  float row = floor(tid / ${ATLAS_COLS}.0);
  vec2 wrappedUv = clamp(fract(rawUv * 0.9999), vec2(0.03), vec2(0.97));
  vec2 atlasUv = vec2(
    (col + wrappedUv.x) / ${ATLAS_COLS}.0,
    (row + wrappedUv.y) / ${ATLAS_ROWS}.0
  );
  return texture2D(u_atlas, atlasUv);
}

vec3 computePointLightToon(
  vec3 worldPos,
  vec3 N,
  vec4 lightPosRad,
  vec4 lightColorInt
) {
  float radius = lightPosRad.w;
  float intensity = lightColorInt.w;
  if (radius <= 0.01 || intensity <= 0.001) {
    return vec3(0.0);
  }
  vec3 toLight = lightPosRad.xyz - worldPos;
  float dist = length(toLight);
  if (dist >= radius) {
    return vec3(0.0);
  }
  vec3 L = toLight / max(0.001, dist);
  float ndl = max(0.28, dot(N, L));
  float normDist = 1.0 - (dist / radius);
  float outerRing = smoothstep(0.20, 0.28, normDist) * 0.48;
  float innerRing = smoothstep(0.58, 0.66, normDist) * 0.56;
  float ring = outerRing + innerRing;
  return lightColorInt.rgb * (ring * intensity * ndl);
}

void main() {
  float fadeBlack = u_fogEndAndFlags.w;
  if (fadeBlack >= 0.999) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec4 texSample = sampleAtlas(v_texId, v_uv);
  vec3 baseAlbedo = v_color.rgb * texSample.rgb;

  vec3 N = normalize(v_normal);
  vec3 sunDir = normalize(u_sunDirAndAmbient.xyz);
  float ambientBoost = u_sunDirAndAmbient.w;
  float ndl = dot(N, sunDir);

  float hemiFactor = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 shadowTone = mix(vec3(0.50, 0.55, 0.68), vec3(0.62, 0.68, 0.80), hemiFactor);
  vec3 midTone = vec3(0.84, 0.87, 0.94);
  vec3 litTone = vec3(1.10, 1.07, 1.01);

  float band1 = smoothstep(-0.16, -0.09, ndl);
  float band2 = smoothstep(0.32, 0.39, ndl);
  vec3 toonBand = mix(shadowTone, midTone, band1);
  toonBand = mix(toonBand, litTone, band2) + vec3(ambientBoost);

  vec3 pl0 = computePointLightToon(v_worldPos, N, u_light0PosRad, u_light0ColorInt);
  vec3 pl1 = computePointLightToon(v_worldPos, N, u_light1PosRad, u_light1ColorInt);

  vec3 V = normalize(u_cameraPosAndTime.xyz - v_worldPos);
  vec3 H = normalize(sunDir + V);
  float ndh = max(0.0, dot(N, H));
  float spec = smoothstep(0.89, 0.93, ndh) * step(0.15, ndl) * 0.16;

  float rimDot = 1.0 - max(0.0, dot(N, V));
  float rim = smoothstep(0.68, 0.78, rimDot) * smoothstep(-0.20, 0.15, ndl) * 0.18;

  vec3 litColor = baseAlbedo * (toonBand + pl0 + pl1) + vec3(spec + rim);

  float camDist = length(v_worldPos - u_cameraPosAndTime.xyz);
  float fogStart = u_fogColorAndStart.w;
  float fogEnd = u_fogEndAndFlags.x;
  float fogFactor = clamp((camDist - fogStart) / max(1.0, fogEnd - fogStart), 0.0, 0.78);
  litColor = mix(litColor, u_fogColorAndStart.rgb, fogFactor);
  litColor = litColor * (1.0 - fadeBlack);

  gl_FragColor = vec4(clamp(litColor, vec3(0.0), vec3(1.0)), v_color.a);
}
`;

const FRAGMENT_SHADER_TRANSLUCENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec3 v_worldPos;
varying vec3 v_normal;
varying vec2 v_uv;
varying vec4 v_color;
varying float v_texId;

uniform sampler2D u_atlas;
uniform vec4 u_fogEndAndFlags;

vec4 sampleAtlas(float texIdFloat, vec2 rawUv) {
  float tid = clamp(floor(texIdFloat + 0.5), 0.0, 19.0);
  float col = mod(tid, ${ATLAS_COLS}.0);
  float row = floor(tid / ${ATLAS_COLS}.0);
  vec2 wrappedUv = clamp(fract(rawUv * 0.9999), vec2(0.03), vec2(0.97));
  vec2 atlasUv = vec2(
    (col + wrappedUv.x) / ${ATLAS_COLS}.0,
    (row + wrappedUv.y) / ${ATLAS_ROWS}.0
  );
  return texture2D(u_atlas, atlasUv);
}

void main() {
  float fadeBlack = u_fogEndAndFlags.w;
  if (fadeBlack >= 0.999) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec4 texSample = sampleAtlas(v_texId, v_uv);
  vec3 color = v_color.rgb * texSample.rgb * (1.0 - fadeBlack);
  gl_FragColor = vec4(color, v_color.a);
}
`;

const VERTEX_SHADER_OUTLINE = `
precision highp float;

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec4 a_color;
attribute float a_outlineScale;

uniform mat4 u_viewProj;

varying vec3 v_worldPos;
varying vec4 v_color;

void main() {
  if (a_outlineScale <= 0.001) {
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
    v_worldPos = a_position;
    v_color = vec4(0.0);
    return;
  }
  float nLen = max(0.0001, length(a_normal));
  vec3 norm = a_normal / nLen;
  vec3 extrudedPos = a_position + norm * a_outlineScale;
  vec4 clip = u_viewProj * vec4(extrudedPos, 1.0);
  clip.z = min(clip.w * 0.9999, clip.z + 0.0020 * clip.w);
  gl_Position = vec4(clip.xy, clip.z * 2.0 - clip.w, clip.w);
  v_worldPos = extrudedPos;
  v_color = a_color;
}
`;

const FRAGMENT_SHADER_OUTLINE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec3 v_worldPos;
varying vec4 v_color;

uniform vec4 u_cameraPosAndTime;
uniform vec4 u_fogColorAndStart;
uniform vec4 u_fogEndAndFlags;

void main() {
  float fadeBlack = u_fogEndAndFlags.w;
  if (fadeBlack >= 0.999) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec3 ink = mix(vec3(0.05, 0.06, 0.11), v_color.rgb * 0.22, 0.35);
  float camDist = length(v_worldPos - u_cameraPosAndTime.xyz);
  float fogStart = u_fogColorAndStart.w;
  float fogEnd = u_fogEndAndFlags.x;
  float fogFactor = clamp((camDist - fogStart) / max(1.0, fogEnd - fogStart), 0.0, 0.78);
  vec3 finalInk = mix(ink, u_fogColorAndStart.rgb, fogFactor) * (1.0 - fadeBlack);
  gl_FragColor = vec4(finalInk, 1.0);
}
`;

interface CelProgramInfo {
  program: WebGLProgram;
  a_position: number;
  a_normal: number;
  a_uv: number;
  a_color: number;
  a_texId: number;
  a_outlineScale: number;
  u_viewProj: WebGLUniformLocation | null;
  u_atlas: WebGLUniformLocation | null;
  u_cameraPosAndTime: WebGLUniformLocation | null;
  u_sunDirAndAmbient: WebGLUniformLocation | null;
  u_fogColorAndStart: WebGLUniformLocation | null;
  u_fogEndAndFlags: WebGLUniformLocation | null;
  u_light0PosRad: WebGLUniformLocation | null;
  u_light0ColorInt: WebGLUniformLocation | null;
  u_light1PosRad: WebGLUniformLocation | null;
  u_light1ColorInt: WebGLUniformLocation | null;
}

interface TranslucentProgramInfo {
  program: WebGLProgram;
  a_position: number;
  a_normal: number;
  a_uv: number;
  a_color: number;
  a_texId: number;
  a_outlineScale: number;
  u_viewProj: WebGLUniformLocation | null;
  u_atlas: WebGLUniformLocation | null;
  u_fogEndAndFlags: WebGLUniformLocation | null;
}

interface OutlineProgramInfo {
  program: WebGLProgram;
  a_position: number;
  a_normal: number;
  a_color: number;
  a_outlineScale: number;
  u_viewProj: WebGLUniformLocation | null;
  u_cameraPosAndTime: WebGLUniformLocation | null;
  u_fogColorAndStart: WebGLUniformLocation | null;
  u_fogEndAndFlags: WebGLUniformLocation | null;
}

interface StaticLevelGLBuffers {
  opaqueBuffer: WebGLBuffer;
  opaqueVertexCount: number;
  outlineBuffer: WebGLBuffer;
  outlineVertexCount: number;
  mapVersion: number;
  map: GameState['map'];
}

function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export class WebGL3DRenderer implements Hardware3DRenderer {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private celInfo: CelProgramInfo;
  private translucentInfo: TranslucentProgramInfo;
  private outlineInfo: OutlineProgramInfo;
  private atlasTexture: WebGLTexture;

  private staticLevelBuffers = new Map<LevelId, StaticLevelGLBuffers>();
  private dynamicOpaqueBuffer: WebGLBuffer;
  private dynamicOpaqueCapacity = 0;
  private dynamicTranslucentBuffer: WebGLBuffer;
  private dynamicTranslucentCapacity = 0;

  private constructor(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    canvas: HTMLCanvasElement,
    celInfo: CelProgramInfo,
    translucentInfo: TranslucentProgramInfo,
    outlineInfo: OutlineProgramInfo,
    atlasTexture: WebGLTexture,
    dynamicOpaqueBuffer: WebGLBuffer,
    dynamicTranslucentBuffer: WebGLBuffer
  ) {
    this.gl = gl;
    this.canvas = canvas;
    this.celInfo = celInfo;
    this.translucentInfo = translucentInfo;
    this.outlineInfo = outlineInfo;
    this.atlasTexture = atlasTexture;
    this.dynamicOpaqueBuffer = dynamicOpaqueBuffer;
    this.dynamicTranslucentBuffer = dynamicTranslucentBuffer;
  }

  static create(canvas: HTMLCanvasElement): WebGL3DRenderer | null {
    try {
      const contextAttrs: WebGLContextAttributes = {
        alpha: false,
        depth: true,
        stencil: false,
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      };

      const gl =
        (canvas.getContext('webgl2', contextAttrs) as WebGL2RenderingContext | null) ||
        (canvas.getContext('webgl', contextAttrs) as WebGLRenderingContext | null) ||
        (canvas.getContext('experimental-webgl', contextAttrs) as WebGLRenderingContext | null);

      if (!gl) {
        return null;
      }

      const celProgram = createProgram(gl, VERTEX_SHADER_CEL, FRAGMENT_SHADER_CEL);
      const translucentProgram = createProgram(gl, VERTEX_SHADER_CEL, FRAGMENT_SHADER_TRANSLUCENT);
      const outlineProgram = createProgram(gl, VERTEX_SHADER_OUTLINE, FRAGMENT_SHADER_OUTLINE);
      if (!celProgram || !translucentProgram || !outlineProgram) {
        return null;
      }

      const celInfo: CelProgramInfo = {
        program: celProgram,
        a_position: gl.getAttribLocation(celProgram, 'a_position'),
        a_normal: gl.getAttribLocation(celProgram, 'a_normal'),
        a_uv: gl.getAttribLocation(celProgram, 'a_uv'),
        a_color: gl.getAttribLocation(celProgram, 'a_color'),
        a_texId: gl.getAttribLocation(celProgram, 'a_texId'),
        a_outlineScale: gl.getAttribLocation(celProgram, 'a_outlineScale'),
        u_viewProj: gl.getUniformLocation(celProgram, 'u_viewProj'),
        u_atlas: gl.getUniformLocation(celProgram, 'u_atlas'),
        u_cameraPosAndTime: gl.getUniformLocation(celProgram, 'u_cameraPosAndTime'),
        u_sunDirAndAmbient: gl.getUniformLocation(celProgram, 'u_sunDirAndAmbient'),
        u_fogColorAndStart: gl.getUniformLocation(celProgram, 'u_fogColorAndStart'),
        u_fogEndAndFlags: gl.getUniformLocation(celProgram, 'u_fogEndAndFlags'),
        u_light0PosRad: gl.getUniformLocation(celProgram, 'u_light0PosRad'),
        u_light0ColorInt: gl.getUniformLocation(celProgram, 'u_light0ColorInt'),
        u_light1PosRad: gl.getUniformLocation(celProgram, 'u_light1PosRad'),
        u_light1ColorInt: gl.getUniformLocation(celProgram, 'u_light1ColorInt'),
      };

      const translucentInfo: TranslucentProgramInfo = {
        program: translucentProgram,
        a_position: gl.getAttribLocation(translucentProgram, 'a_position'),
        a_normal: gl.getAttribLocation(translucentProgram, 'a_normal'),
        a_uv: gl.getAttribLocation(translucentProgram, 'a_uv'),
        a_color: gl.getAttribLocation(translucentProgram, 'a_color'),
        a_texId: gl.getAttribLocation(translucentProgram, 'a_texId'),
        a_outlineScale: gl.getAttribLocation(translucentProgram, 'a_outlineScale'),
        u_viewProj: gl.getUniformLocation(translucentProgram, 'u_viewProj'),
        u_atlas: gl.getUniformLocation(translucentProgram, 'u_atlas'),
        u_fogEndAndFlags: gl.getUniformLocation(translucentProgram, 'u_fogEndAndFlags'),
      };

      const outlineInfo: OutlineProgramInfo = {
        program: outlineProgram,
        a_position: gl.getAttribLocation(outlineProgram, 'a_position'),
        a_normal: gl.getAttribLocation(outlineProgram, 'a_normal'),
        a_color: gl.getAttribLocation(outlineProgram, 'a_color'),
        a_outlineScale: gl.getAttribLocation(outlineProgram, 'a_outlineScale'),
        u_viewProj: gl.getUniformLocation(outlineProgram, 'u_viewProj'),
        u_cameraPosAndTime: gl.getUniformLocation(outlineProgram, 'u_cameraPosAndTime'),
        u_fogColorAndStart: gl.getUniformLocation(outlineProgram, 'u_fogColorAndStart'),
        u_fogEndAndFlags: gl.getUniformLocation(outlineProgram, 'u_fogEndAndFlags'),
      };

      const atlas = getProceduralTextureAtlas();
      const atlasTexture = gl.createTexture();
      const dynamicOpaqueBuffer = gl.createBuffer();
      const dynamicTranslucentBuffer = gl.createBuffer();
      if (!atlasTexture || !dynamicOpaqueBuffer || !dynamicTranslucentBuffer) {
        return null;
      }

      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        atlas.width,
        atlas.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        atlas.data
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const dynamicOpaqueCapacity = 2 * 1024 * 1024;
      gl.bindBuffer(gl.ARRAY_BUFFER, dynamicOpaqueBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, dynamicOpaqueCapacity, gl.DYNAMIC_DRAW);

      const dynamicTranslucentCapacity = 512 * 1024;
      gl.bindBuffer(gl.ARRAY_BUFFER, dynamicTranslucentBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, dynamicTranslucentCapacity, gl.DYNAMIC_DRAW);

      const renderer = new WebGL3DRenderer(
        gl,
        canvas,
        celInfo,
        translucentInfo,
        outlineInfo,
        atlasTexture,
        dynamicOpaqueBuffer,
        dynamicTranslucentBuffer
      );
      renderer.dynamicOpaqueCapacity = dynamicOpaqueCapacity;
      renderer.dynamicTranslucentCapacity = dynamicTranslucentCapacity;
      debugLog('WebGL 3D Wind Waker HD renderer initialized');
      return renderer;
    } catch (err) {
      debugLog(`WebGL init failed: ${String(err)}`);
      return null;
    }
  }

  private getOrCreateStaticLevelBuffers(state: GameState): StaticLevelGLBuffers {
    const existing = this.staticLevelBuffers.get(state.currentLevelId);
    if (
      existing &&
      existing.mapVersion === state.mapVersion &&
      existing.map === state.map
    ) {
      return existing;
    }

    const gl = this.gl;
    const mesh = getStaticLevelMesh(state.currentLevelId, state.map, state);
    const outlineMesh = extractOutlineMesh(mesh);

    const opaqueBuffer = existing?.opaqueBuffer ?? gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, opaqueBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

    const outlineBuffer = existing?.outlineBuffer ?? gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, outlineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, outlineMesh.vertices, gl.STATIC_DRAW);

    const entry: StaticLevelGLBuffers = {
      opaqueBuffer,
      opaqueVertexCount: mesh.vertexCount,
      outlineBuffer,
      outlineVertexCount: outlineMesh.vertexCount,
      mapVersion: state.mapVersion,
      map: state.map,
    };
    this.staticLevelBuffers.set(state.currentLevelId, entry);
    return entry;
  }

  private uploadDynamicBuffer(
    mesh: MeshData,
    target: 'opaque' | 'translucent'
  ): { buffer: WebGLBuffer; vertexCount: number } {
    const gl = this.gl;
    const byteLength = mesh.vertices.byteLength;
    if (target === 'opaque') {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamicOpaqueBuffer);
      if (byteLength > this.dynamicOpaqueCapacity) {
        this.dynamicOpaqueCapacity = Math.max(byteLength * 2, 65536);
        gl.bufferData(gl.ARRAY_BUFFER, this.dynamicOpaqueCapacity, gl.DYNAMIC_DRAW);
      }
      if (byteLength > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.vertices);
      }
      return { buffer: this.dynamicOpaqueBuffer, vertexCount: mesh.vertexCount };
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamicTranslucentBuffer);
      if (byteLength > this.dynamicTranslucentCapacity) {
        this.dynamicTranslucentCapacity = Math.max(byteLength * 2, 32768);
        gl.bufferData(gl.ARRAY_BUFFER, this.dynamicTranslucentCapacity, gl.DYNAMIC_DRAW);
      }
      if (byteLength > 0) {
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.vertices);
      }
      return { buffer: this.dynamicTranslucentBuffer, vertexCount: mesh.vertexCount };
    }
  }

  private bindCelAttributes(
    buffer: WebGLBuffer,
    info: CelProgramInfo | TranslucentProgramInfo
  ): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (info.a_position >= 0) {
      gl.enableVertexAttribArray(info.a_position);
      gl.vertexAttribPointer(info.a_position, 3, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 0);
    }
    if (info.a_normal >= 0) {
      gl.enableVertexAttribArray(info.a_normal);
      gl.vertexAttribPointer(info.a_normal, 3, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 12);
    }
    if (info.a_uv >= 0) {
      gl.enableVertexAttribArray(info.a_uv);
      gl.vertexAttribPointer(info.a_uv, 2, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 24);
    }
    if (info.a_color >= 0) {
      gl.enableVertexAttribArray(info.a_color);
      gl.vertexAttribPointer(info.a_color, 4, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 32);
    }
    if (info.a_texId >= 0) {
      gl.enableVertexAttribArray(info.a_texId);
      gl.vertexAttribPointer(info.a_texId, 1, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 48);
    }
    if (info.a_outlineScale >= 0) {
      gl.enableVertexAttribArray(info.a_outlineScale);
      gl.vertexAttribPointer(info.a_outlineScale, 1, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 52);
    }
  }

  private bindOutlineAttributes(buffer: WebGLBuffer): void {
    const gl = this.gl;
    const info = this.outlineInfo;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (info.a_position >= 0) {
      gl.enableVertexAttribArray(info.a_position);
      gl.vertexAttribPointer(info.a_position, 3, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 0);
    }
    if (info.a_normal >= 0) {
      gl.enableVertexAttribArray(info.a_normal);
      gl.vertexAttribPointer(info.a_normal, 3, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 12);
    }
    if (info.a_color >= 0) {
      gl.enableVertexAttribArray(info.a_color);
      gl.vertexAttribPointer(info.a_color, 4, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 32);
    }
    if (info.a_outlineScale >= 0) {
      gl.enableVertexAttribArray(info.a_outlineScale);
      gl.vertexAttribPointer(info.a_outlineScale, 1, gl.FLOAT, false, VERTEX_STRIDE_BYTES, 52);
    }
  }

  render(state: GameState, camera: Camera3D): Mat4 {
    const gl = this.gl;
    const w = Math.max(1, this.canvas.width);
    const h = Math.max(1, this.canvas.height);
    gl.viewport(0, 0, w, h);

    const aspect = w / h;
    const proj = mat4Perspective(camera.fovY, aspect, camera.near, camera.far);
    const view = mat4LookAt(camera.eye, camera.target, camera.up);
    const viewProj = mat4Multiply(proj, view);

    const staticBuffers = this.getOrCreateStaticLevelBuffers(state);
    const dynamicScene = buildDynamicSceneMeshes(state, camera.distance);
    const dynOpaque = this.uploadDynamicBuffer(dynamicScene.opaque, 'opaque');
    const dynTrans = this.uploadDynamicBuffer(dynamicScene.translucent, 'translucent');

    const isOutside = state.currentLevelId === 'level-outside';
    const clearR = isOutside ? 0.09 : 0.08;
    const clearG = isOutside ? 0.15 : 0.07;
    const clearB = isOutside ? 0.28 : 0.11;
    const fogStart = isOutside ? 170.0 : 190.0;
    const fogEnd = isOutside ? 420.0 : 380.0;
    const fadeBlack = state.worldFadedToBlack ? 1.0 : 0.0;

    const l0 = dynamicScene.pointLights[0];
    const l1 = dynamicScene.pointLights[1];

    if (state.worldFadedToBlack) {
      gl.clearColor(0, 0, 0, 1);
    } else {
      gl.clearColor(clearR, clearG, clearB, 1);
    }
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Pass 1: Cel-Shaded Opaque Geometry
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.celInfo.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
    gl.uniform1i(this.celInfo.u_atlas, 0);
    gl.uniformMatrix4fv(this.celInfo.u_viewProj, false, viewProj);
    gl.uniform4f(
      this.celInfo.u_cameraPosAndTime,
      camera.eye.x,
      camera.eye.y,
      camera.eye.z,
      state.elapsedTime
    );
    gl.uniform4f(
      this.celInfo.u_sunDirAndAmbient,
      0.42,
      0.78,
      0.46,
      isOutside ? 0.04 : 0.12
    );
    gl.uniform4f(this.celInfo.u_fogColorAndStart, clearR, clearG, clearB, fogStart);
    gl.uniform4f(
      this.celInfo.u_fogEndAndFlags,
      fogEnd,
      dynamicScene.pointLights.length,
      isOutside ? 0.0 : 1.0,
      fadeBlack
    );
    if (l0) {
      gl.uniform4f(this.celInfo.u_light0PosRad, l0.x, l0.y, l0.z, l0.radius);
      gl.uniform4f(this.celInfo.u_light0ColorInt, l0.r, l0.g, l0.b, l0.intensity);
    } else {
      gl.uniform4f(this.celInfo.u_light0PosRad, 0, 0, 0, 0);
      gl.uniform4f(this.celInfo.u_light0ColorInt, 0, 0, 0, 0);
    }
    if (l1) {
      gl.uniform4f(this.celInfo.u_light1PosRad, l1.x, l1.y, l1.z, l1.radius);
      gl.uniform4f(this.celInfo.u_light1ColorInt, l1.r, l1.g, l1.b, l1.intensity);
    } else {
      gl.uniform4f(this.celInfo.u_light1PosRad, 0, 0, 0, 0);
      gl.uniform4f(this.celInfo.u_light1ColorInt, 0, 0, 0, 0);
    }

    if (staticBuffers.opaqueVertexCount > 0) {
      this.bindCelAttributes(staticBuffers.opaqueBuffer, this.celInfo);
      gl.drawArrays(gl.TRIANGLES, 0, staticBuffers.opaqueVertexCount);
    }
    if (dynOpaque.vertexCount > 0) {
      this.bindCelAttributes(dynOpaque.buffer, this.celInfo);
      gl.drawArrays(gl.TRIANGLES, 0, dynOpaque.vertexCount);
    }

    // Pass 2: Wind Waker Silhouette Contours (front-face culled so only back faces draw)
    gl.enable(gl.CULL_FACE);
    gl.frontFace(gl.CCW);
    gl.cullFace(gl.FRONT);
    gl.useProgram(this.outlineInfo.program);
    gl.uniformMatrix4fv(this.outlineInfo.u_viewProj, false, viewProj);
    gl.uniform4f(
      this.outlineInfo.u_cameraPosAndTime,
      camera.eye.x,
      camera.eye.y,
      camera.eye.z,
      state.elapsedTime
    );
    gl.uniform4f(this.outlineInfo.u_fogColorAndStart, clearR, clearG, clearB, fogStart);
    gl.uniform4f(
      this.outlineInfo.u_fogEndAndFlags,
      fogEnd,
      dynamicScene.pointLights.length,
      isOutside ? 0.0 : 1.0,
      fadeBlack
    );

    if (staticBuffers.outlineVertexCount > 0) {
      this.bindOutlineAttributes(staticBuffers.outlineBuffer);
      gl.drawArrays(gl.TRIANGLES, 0, staticBuffers.outlineVertexCount);
    }
    if (dynOpaque.vertexCount > 0) {
      this.bindOutlineAttributes(dynOpaque.buffer);
      gl.drawArrays(gl.TRIANGLES, 0, dynOpaque.vertexCount);
    }

    // Pass 3: Translucent FX (Cones of Sight, Flames, Sparks, Smoke, Footprints, Snowflakes, Hearts, Transparent Santa)
    gl.disable(gl.CULL_FACE);
    if (dynTrans.vertexCount > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.translucentInfo.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
      gl.uniform1i(this.translucentInfo.u_atlas, 0);
      gl.uniformMatrix4fv(this.translucentInfo.u_viewProj, false, viewProj);
      gl.uniform4f(
        this.translucentInfo.u_fogEndAndFlags,
        fogEnd,
        dynamicScene.pointLights.length,
        isOutside ? 0.0 : 1.0,
        fadeBlack
      );
      this.bindCelAttributes(dynTrans.buffer, this.translucentInfo);
      gl.drawArrays(gl.TRIANGLES, 0, dynTrans.vertexCount);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    return viewProj;
  }
}
