/**
 * WebGPU 3D Renderer in the style of "The Legend of Zelda: The Wind Waker".
 *
 * Implements a 3-pass WebGPU rendering pipeline:
 *  1. Cel-Shaded Opaque Pass: 3-band quantized directional toon shading + stepped point-light
 *     toon rings + crisp rim highlight + procedural 20-tile Wind Waker texture atlas sampling.
 *  2. Inverted-Hull Silhouette Contour Pass: Extrudes vertices along smoothed normals with a
 *     small depth bias so bold dark ink contours wrap every 3D character, tree, and building.
 *  3. Translucent FX Pass: Alpha-blended pass for NPC cones of sight, fireplace flames,
 *     electric sparks, chimney smoke, snow footprints, falling snow, and floating hearts.
 */

import { GameState } from '../world/gameState';
import { LevelId } from '../world/levels/types';
import { debugLog } from '../core/debugConsole';
import {
  Camera3D,
  Mat4,
  mat4LookAt,
  mat4Multiply,
  mat4Perspective,
} from './math3d';
import {
  ATLAS_COLS,
  ATLAS_ROWS,
  getProceduralTextureAtlas,
} from './textures3d';
import {
  buildDynamicSceneMeshes,
  extractOutlineMesh,
  FLOATS_PER_VERTEX,
  getStaticLevelMesh,
} from './models3d';

const VERTEX_STRIDE_BYTES = FLOATS_PER_VERTEX * 4; // 56 bytes
const UNIFORM_BUFFER_SIZE = 256; // 64 floats
const MSAA_SAMPLE_COUNT = 4;

const WGSL_SHADER_SOURCE = /* wgsl */ `
struct SceneUniforms {
  viewProj: mat4x4<f32>,
  cameraPosAndTime: vec4<f32>,
  sunDirAndAmbient: vec4<f32>,
  fogColorAndStart: vec4<f32>,
  fogEndAndFlags: vec4<f32>,
  light0PosRad: vec4<f32>,
  light0ColorInt: vec4<f32>,
  light1PosRad: vec4<f32>,
  light1ColorInt: vec4<f32>,
};

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(0) @binding(1) var atlasSampler: sampler;
@group(0) @binding(2) var atlasTex: texture_2d<f32>;

struct VertexInput {
  @location(0) pos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec4<f32>,
  @location(4) texAndOutline: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) clipPos: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) worldNormal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) color: vec4<f32>,
  @location(4) texId: f32,
};

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.clipPos = scene.viewProj * vec4<f32>(in.pos, 1.0);
  out.worldPos = in.pos;
  out.worldNormal = in.normal;
  out.uv = in.uv;
  out.color = in.color;
  out.texId = in.texAndOutline.x;
  return out;
}

@vertex
fn vs_outline(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  let outlineScale = in.texAndOutline.y;
  if (outlineScale <= 0.001) {
    out.clipPos = vec4<f32>(0.0, 0.0, 0.0, 1.0);
    out.worldPos = in.pos;
    out.worldNormal = in.normal;
    out.uv = in.uv;
    out.color = vec4<f32>(0.0);
    out.texId = 0.0;
    return out;
  }

  let nLen = max(0.0001, length(in.normal));
  let norm = in.normal / nLen;
  let extrudedPos = in.pos + norm * outlineScale;
  var clip = scene.viewProj * vec4<f32>(extrudedPos, 1.0);
  // Push outline slightly back in depth so interior faces are occluded by the opaque pass
  // while outer silhouette edges remain crisp and unbroken.
  clip.z = min(clip.w * 0.9999, clip.z + 0.0020 * clip.w);

  out.clipPos = clip;
  out.worldPos = extrudedPos;
  out.worldNormal = norm;
  out.uv = in.uv;
  out.color = in.color;
  out.texId = in.texAndOutline.x;
  return out;
}

fn sampleAtlas(texIdFloat: f32, rawUv: vec2<f32>) -> vec4<f32> {
  let tid = i32(round(texIdFloat));
  let col = f32(tid % ${ATLAS_COLS});
  let row = f32(tid / ${ATLAS_COLS});
  let wrappedUv = clamp(fract(rawUv * 0.9999), vec2<f32>(0.03), vec2<f32>(0.97));
  let atlasUv = vec2<f32>(
    (col + wrappedUv.x) / f32(${ATLAS_COLS}.0),
    (row + wrappedUv.y) / f32(${ATLAS_ROWS}.0)
  );
  return textureSampleLevel(atlasTex, atlasSampler, atlasUv, 0.0);
}

fn computePointLightToon(
  worldPos: vec3<f32>,
  N: vec3<f32>,
  lightPosRad: vec4<f32>,
  lightColorInt: vec4<f32>
) -> vec3<f32> {
  let radius = lightPosRad.w;
  let intensity = lightColorInt.w;
  if (radius <= 0.01 || intensity <= 0.001) {
    return vec3<f32>(0.0);
  }
  let toLight = lightPosRad.xyz - worldPos;
  let dist = length(toLight);
  if (dist >= radius) {
    return vec3<f32>(0.0);
  }
  let L = toLight / max(0.001, dist);
  let ndl = max(0.28, dot(N, L));
  let normDist = 1.0 - (dist / radius);
  // Smooth-edged Wind Waker HD lantern/hearth toon rings
  let outerRing = smoothstep(0.20, 0.28, normDist) * 0.48;
  let innerRing = smoothstep(0.58, 0.66, normDist) * 0.56;
  let ring = outerRing + innerRing;
  return lightColorInt.rgb * (ring * intensity * ndl);
}

@fragment
fn fs_cel(in: VertexOutput) -> @location(0) vec4<f32> {
  let fadeBlack = scene.fogEndAndFlags.w;
  if (fadeBlack >= 0.999) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }

  let texSample = sampleAtlas(in.texId, in.uv);
  let baseAlbedo = in.color.rgb * texSample.rgb;

  let N = normalize(in.worldNormal);
  let sunDir = normalize(scene.sunDirAndAmbient.xyz);
  let ambientBoost = scene.sunDirAndAmbient.w;
  let ndl = dot(N, sunDir);

  // Hemispheric sky-to-ground bounce fill (Wind Waker HD soft ambient)
  let hemiFactor = clamp(N.y * 0.5 + 0.5, 0.0, 1.0);
  let shadowTone = mix(vec3<f32>(0.50, 0.55, 0.68), vec3<f32>(0.62, 0.68, 0.80), hemiFactor);
  let midTone = vec3<f32>(0.84, 0.87, 0.94);
  let litTone = vec3<f32>(1.10, 1.07, 1.01);

  // Anti-aliased 3-band Wind Waker HD cel shading
  let band1 = smoothstep(-0.16, -0.09, ndl);
  let band2 = smoothstep(0.32, 0.39, ndl);
  var toonBand = mix(shadowTone, midTone, band1);
  toonBand = mix(toonBand, litTone, band2);
  toonBand = toonBand + vec3<f32>(ambientBoost);

  // Stepped point lights (fireplace hearth, Christmas tree star, EV sparks, windows)
  let pl0 = computePointLightToon(in.worldPos, N, scene.light0PosRad, scene.light0ColorInt);
  let pl1 = computePointLightToon(in.worldPos, N, scene.light1PosRad, scene.light1ColorInt);

  // View vector for Wind Waker HD specular & Fresnel rim highlights
  let V = normalize(scene.cameraPosAndTime.xyz - in.worldPos);
  let H = normalize(sunDir + V);
  let ndh = max(0.0, dot(N, H));
  let spec = smoothstep(0.89, 0.93, ndh) * step(0.15, ndl) * 0.16;

  let rimDot = 1.0 - max(0.0, dot(N, V));
  let rim = smoothstep(0.68, 0.78, rimDot) * smoothstep(-0.20, 0.15, ndl) * 0.18;

  var litColor = baseAlbedo * (toonBand + pl0 + pl1) + vec3<f32>(spec + rim);

  // Atmospheric distance fog
  let camDist = length(in.worldPos - scene.cameraPosAndTime.xyz);
  let fogStart = scene.fogColorAndStart.w;
  let fogEnd = scene.fogEndAndFlags.x;
  let fogFactor = clamp((camDist - fogStart) / max(1.0, fogEnd - fogStart), 0.0, 0.78);
  litColor = mix(litColor, scene.fogColorAndStart.rgb, fogFactor);
  litColor = litColor * (1.0 - fadeBlack);

  return vec4<f32>(clamp(litColor, vec3<f32>(0.0), vec3<f32>(1.0)), in.color.a);
}

@fragment
fn fs_outline(in: VertexOutput) -> @location(0) vec4<f32> {
  let fadeBlack = scene.fogEndAndFlags.w;
  if (fadeBlack >= 0.999) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
  // Deep Wind Waker cartoon ink contour tinted slightly by object color
  let ink = mix(vec3<f32>(0.05, 0.06, 0.11), in.color.rgb * 0.22, 0.35);
  let camDist = length(in.worldPos - scene.cameraPosAndTime.xyz);
  let fogStart = scene.fogColorAndStart.w;
  let fogEnd = scene.fogEndAndFlags.x;
  let fogFactor = clamp((camDist - fogStart) / max(1.0, fogEnd - fogStart), 0.0, 0.78);
  let finalInk = mix(ink, scene.fogColorAndStart.rgb, fogFactor) * (1.0 - fadeBlack);
  return vec4<f32>(finalInk, 1.0);
}

@fragment
fn fs_translucent(in: VertexOutput) -> @location(0) vec4<f32> {
  let fadeBlack = scene.fogEndAndFlags.w;
  if (fadeBlack >= 0.999) {
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
  }
  let texSample = sampleAtlas(in.texId, in.uv);
  let color = in.color.rgb * texSample.rgb * (1.0 - fadeBlack);
  return vec4<f32>(color, in.color.a);
}
`;

export class WebGPURenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private canvas: HTMLCanvasElement;
  private format: GPUTextureFormat;

  private celOpaquePipeline: GPURenderPipeline;
  private outlinePipeline: GPURenderPipeline;
  private translucentPipeline: GPURenderPipeline;

  private uniformBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;

  private msaaColorTexture: GPUTexture | null = null;
  private depthTexture: GPUTexture | null = null;
  private attachmentWidth = 0;
  private attachmentHeight = 0;

  private staticBuffers = new Map<
    LevelId,
    {
      buffer: GPUBuffer;
      vertexCount: number;
      outlineBuffer: GPUBuffer;
      outlineVertexCount: number;
      mapVersion: number;
      map: GameState['map'];
    }
  >();
  private dynamicOpaqueBuffer: GPUBuffer;
  private dynamicOpaqueCapacityBytes: number;
  private dynamicTranslucentBuffer: GPUBuffer;
  private dynamicTranslucentCapacityBytes: number;

  private uniformScratch = new Float32Array(UNIFORM_BUFFER_SIZE / 4);

  private constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    format: GPUTextureFormat,
    celOpaquePipeline: GPURenderPipeline,
    outlinePipeline: GPURenderPipeline,
    translucentPipeline: GPURenderPipeline,
    uniformBuffer: GPUBuffer,
    bindGroup: GPUBindGroup
  ) {
    this.canvas = canvas;
    this.device = device;
    this.context = context;
    this.format = format;
    this.celOpaquePipeline = celOpaquePipeline;
    this.outlinePipeline = outlinePipeline;
    this.translucentPipeline = translucentPipeline;
    this.uniformBuffer = uniformBuffer;
    this.bindGroup = bindGroup;

    this.dynamicOpaqueCapacityBytes = 2 * 1024 * 1024;
    this.dynamicOpaqueBuffer = this.device.createBuffer({
      size: this.dynamicOpaqueCapacityBytes,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.dynamicTranslucentCapacityBytes = 512 * 1024;
    this.dynamicTranslucentBuffer = this.device.createBuffer({
      size: this.dynamicTranslucentCapacityBytes,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  static async create(
    canvas: HTMLCanvasElement
  ): Promise<WebGPURenderer | null> {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      debugLog('WebGPU not available in navigator; using 3D Canvas fallback');
      return null;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        debugLog('No WebGPU adapter found; using 3D Canvas fallback');
        return null;
      }

      const device = await adapter.requestDevice();
      const context = canvas.getContext(
        'webgpu'
      ) as unknown as GPUCanvasContext | null;
      if (!context) {
        debugLog('Could not acquire webgpu context on canvas');
        return null;
      }

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'opaque',
      });

      const shaderModule = device.createShaderModule({
        code: WGSL_SHADER_SOURCE,
      });

      const vertexBufferLayout: GPUVertexBufferLayout = {
        arrayStride: VERTEX_STRIDE_BYTES,
        stepMode: 'vertex',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, // pos
          { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
          { shaderLocation: 2, offset: 24, format: 'float32x2' }, // uv
          { shaderLocation: 3, offset: 32, format: 'float32x4' }, // color
          { shaderLocation: 4, offset: 48, format: 'float32x2' }, // texId, outlineScale
        ],
      };

      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT,
            sampler: { type: 'filtering' },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.FRAGMENT,
            texture: { sampleType: 'float' },
          },
        ],
      });

      const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      });

      const celOpaquePipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [vertexBufferLayout],
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_cel',
          targets: [{ format }],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none',
        },
        depthStencil: {
          format: 'depth24plus',
          depthWriteEnabled: true,
          depthCompare: 'less',
        },
        multisample: {
          count: MSAA_SAMPLE_COUNT,
        },
      });

      const outlinePipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_outline',
          buffers: [vertexBufferLayout],
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_outline',
          targets: [{ format }],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'front',
        },
        depthStencil: {
          format: 'depth24plus',
          depthWriteEnabled: true,
          depthCompare: 'less-equal',
        },
        multisample: {
          count: MSAA_SAMPLE_COUNT,
        },
      });

      const translucentPipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [vertexBufferLayout],
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_translucent',
          targets: [
            {
              format,
              blend: {
                color: {
                  srcFactor: 'src-alpha',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
                alpha: {
                  srcFactor: 'one',
                  dstFactor: 'one-minus-src-alpha',
                  operation: 'add',
                },
              },
            },
          ],
        },
        primitive: {
          topology: 'triangle-list',
          cullMode: 'none',
        },
        depthStencil: {
          format: 'depth24plus',
          depthWriteEnabled: false,
          depthCompare: 'less-equal',
        },
        multisample: {
          count: MSAA_SAMPLE_COUNT,
        },
      });

      // Upload Procedural Wind Waker HD Texture Atlas
      const atlas = getProceduralTextureAtlas();
      const atlasTexture = device.createTexture({
        size: { width: atlas.width, height: atlas.height, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      });
      device.queue.writeTexture(
        { texture: atlasTexture },
        atlas.data.buffer,
        {
          offset: atlas.data.byteOffset,
          bytesPerRow: atlas.width * 4,
          rowsPerImage: atlas.height,
        },
        { width: atlas.width, height: atlas.height, depthOrArrayLayers: 1 }
      );

      const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });

      const uniformBuffer = device.createBuffer({
        size: UNIFORM_BUFFER_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: sampler },
          { binding: 2, resource: atlasTexture.createView() },
        ],
      });

      debugLog('WebGPU 3D Wind Waker HD renderer initialized (4x MSAA)');
      return new WebGPURenderer(
        canvas,
        device,
        context,
        format,
        celOpaquePipeline,
        outlinePipeline,
        translucentPipeline,
        uniformBuffer,
        bindGroup
      );
    } catch (err) {
      debugLog(`WebGPU init failed: ${String(err)}`);
      return null;
    }
  }

  private ensureAttachments(): {
    msaaColorView: GPUTextureView;
    depthView: GPUTextureView;
  } {
    const w = Math.max(1, this.canvas.width);
    const h = Math.max(1, this.canvas.height);
    if (
      !this.depthTexture ||
      !this.msaaColorTexture ||
      this.attachmentWidth !== w ||
      this.attachmentHeight !== h
    ) {
      this.msaaColorTexture?.destroy();
      this.depthTexture?.destroy();

      this.msaaColorTexture = this.device.createTexture({
        size: { width: w, height: h, depthOrArrayLayers: 1 },
        sampleCount: MSAA_SAMPLE_COUNT,
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      this.depthTexture = this.device.createTexture({
        size: { width: w, height: h, depthOrArrayLayers: 1 },
        sampleCount: MSAA_SAMPLE_COUNT,
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      this.attachmentWidth = w;
      this.attachmentHeight = h;
    }
    return {
      msaaColorView: this.msaaColorTexture.createView(),
      depthView: this.depthTexture.createView(),
    };
  }

  private getOrUploadStaticLevelBuffer(
    state: GameState
  ): {
    buffer: GPUBuffer;
    vertexCount: number;
    outlineBuffer: GPUBuffer;
    outlineVertexCount: number;
  } {
    const existing = this.staticBuffers.get(state.currentLevelId);
    if (
      existing &&
      existing.mapVersion === state.mapVersion &&
      existing.map === state.map
    ) {
      return existing;
    }
    if (existing) {
      existing.buffer.destroy();
      existing.outlineBuffer.destroy();
    }
    const mesh = getStaticLevelMesh(state.currentLevelId, state.map, state);
    const byteLength = Math.max(64, mesh.vertices.byteLength);
    const buffer = this.device.createBuffer({
      size: byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    if (mesh.vertices.byteLength > 0) {
      this.device.queue.writeBuffer(
        buffer,
        0,
        mesh.vertices.buffer,
        mesh.vertices.byteOffset,
        mesh.vertices.byteLength
      );
    }

    const outlineMesh = extractOutlineMesh(mesh);
    const outlineByteLength = Math.max(64, outlineMesh.vertices.byteLength);
    const outlineBuffer = this.device.createBuffer({
      size: outlineByteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    if (outlineMesh.vertices.byteLength > 0) {
      this.device.queue.writeBuffer(
        outlineBuffer,
        0,
        outlineMesh.vertices.buffer,
        outlineMesh.vertices.byteOffset,
        outlineMesh.vertices.byteLength
      );
    }

    const entry = {
      buffer,
      vertexCount: mesh.vertexCount,
      outlineBuffer,
      outlineVertexCount: outlineMesh.vertexCount,
      mapVersion: state.mapVersion,
      map: state.map,
    };
    this.staticBuffers.set(state.currentLevelId, entry);
    return entry;
  }

  render(state: GameState, camera: Camera3D): Mat4 {
    const w = Math.max(1, this.canvas.width);
    const h = Math.max(1, this.canvas.height);
    const aspect = w / h;

    const proj = mat4Perspective(camera.fovY, aspect, camera.near, camera.far);
    const view = mat4LookAt(camera.eye, camera.target, camera.up);
    const viewProj = mat4Multiply(proj, view);

    const staticEntry = this.getOrUploadStaticLevelBuffer(state);
    const dynamicScene = buildDynamicSceneMeshes(state, camera.distance);

    // Upload dynamic opaque vertices
    if (dynamicScene.opaque.vertices.byteLength > this.dynamicOpaqueCapacityBytes) {
      this.dynamicOpaqueBuffer.destroy();
      this.dynamicOpaqueCapacityBytes = dynamicScene.opaque.vertices.byteLength * 2;
      this.dynamicOpaqueBuffer = this.device.createBuffer({
        size: this.dynamicOpaqueCapacityBytes,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }
    if (dynamicScene.opaque.vertices.byteLength > 0) {
      this.device.queue.writeBuffer(
        this.dynamicOpaqueBuffer,
        0,
        dynamicScene.opaque.vertices.buffer,
        dynamicScene.opaque.vertices.byteOffset,
        dynamicScene.opaque.vertices.byteLength
      );
    }

    // Upload dynamic translucent vertices
    if (
      dynamicScene.translucent.vertices.byteLength >
      this.dynamicTranslucentCapacityBytes
    ) {
      this.dynamicTranslucentBuffer.destroy();
      this.dynamicTranslucentCapacityBytes =
        dynamicScene.translucent.vertices.byteLength * 2;
      this.dynamicTranslucentBuffer = this.device.createBuffer({
        size: this.dynamicTranslucentCapacityBytes,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }
    if (dynamicScene.translucent.vertices.byteLength > 0) {
      this.device.queue.writeBuffer(
        this.dynamicTranslucentBuffer,
        0,
        dynamicScene.translucent.vertices.buffer,
        dynamicScene.translucent.vertices.byteOffset,
        dynamicScene.translucent.vertices.byteLength
      );
    }

    // Populate SceneUniforms
    const u = this.uniformScratch;
    u.set(viewProj, 0);
    u[16] = camera.eye.x;
    u[17] = camera.eye.y;
    u[18] = camera.eye.z;
    u[19] = state.elapsedTime;

    const isOutside = state.currentLevelId === 'level-outside';
    // Sun / moon directional light vector
    u[20] = 0.42;
    u[21] = 0.78;
    u[22] = 0.46;
    u[23] = isOutside ? 0.04 : 0.12; // indoor ambient boost

    // Fog color & start/end
    const clearR = isOutside ? 0.09 : 0.08;
    const clearG = isOutside ? 0.15 : 0.07;
    const clearB = isOutside ? 0.28 : 0.11;
    u[24] = clearR;
    u[25] = clearG;
    u[26] = clearB;
    u[27] = isOutside ? 170.0 : 190.0; // fogStart
    u[28] = isOutside ? 420.0 : 380.0; // fogEnd
    u[29] = dynamicScene.pointLights.length;
    u[30] = isOutside ? 0.0 : 1.0;
    u[31] = state.worldFadedToBlack ? 1.0 : 0.0;

    // Up to 2 dynamic point lights
    const l0 = dynamicScene.pointLights[0];
    if (l0) {
      u[32] = l0.x;
      u[33] = l0.y;
      u[34] = l0.z;
      u[35] = l0.radius;
      u[36] = l0.r;
      u[37] = l0.g;
      u[38] = l0.b;
      u[39] = l0.intensity;
    } else {
      u.fill(0, 32, 40);
    }

    const l1 = dynamicScene.pointLights[1];
    if (l1) {
      u[40] = l1.x;
      u[41] = l1.y;
      u[42] = l1.z;
      u[43] = l1.radius;
      u[44] = l1.r;
      u[45] = l1.g;
      u[46] = l1.b;
      u[47] = l1.intensity;
    } else {
      u.fill(0, 40, 48);
    }

    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      u.buffer,
      u.byteOffset,
      u.byteLength
    );

    const { msaaColorView, depthView } = this.ensureAttachments();
    const colorView = this.context.getCurrentTexture().createView();
    const encoder = this.device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: msaaColorView,
          resolveTarget: colorView,
          clearValue: state.worldFadedToBlack
            ? { r: 0, g: 0, b: 0, a: 1 }
            : { r: clearR, g: clearG, b: clearB, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    });

    pass.setBindGroup(0, this.bindGroup);

    // Pass 1: Cel-Shaded Opaque Geometry
    pass.setPipeline(this.celOpaquePipeline);
    if (staticEntry.vertexCount > 0) {
      pass.setVertexBuffer(0, staticEntry.buffer);
      pass.draw(staticEntry.vertexCount);
    }
    if (dynamicScene.opaque.vertexCount > 0) {
      pass.setVertexBuffer(0, this.dynamicOpaqueBuffer);
      pass.draw(dynamicScene.opaque.vertexCount);
    }

    // Pass 2: Wind Waker Silhouette Contours (Inverted-Hull with depth offset)
    pass.setPipeline(this.outlinePipeline);
    if (staticEntry.outlineVertexCount > 0) {
      pass.setVertexBuffer(0, staticEntry.outlineBuffer);
      pass.draw(staticEntry.outlineVertexCount);
    }
    if (dynamicScene.opaque.vertexCount > 0) {
      pass.setVertexBuffer(0, this.dynamicOpaqueBuffer);
      pass.draw(dynamicScene.opaque.vertexCount);
    }

    // Pass 3: Translucent FX (Cones of Sight, Flames, Sparks, Smoke, Footprints, Snowflakes, Hearts)
    if (dynamicScene.translucent.vertexCount > 0) {
      pass.setPipeline(this.translucentPipeline);
      pass.setVertexBuffer(0, this.dynamicTranslucentBuffer);
      pass.draw(dynamicScene.translucent.vertexCount);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);

    return viewProj;
  }
}
