/**
 * High-Fi 3D Mesh Builder & Procedural "Zelda: The Wind Waker HD" 3D Asset Models.
 *
 * Every world asset across all levels (Outside, Basement, Upstairs, People gallery)
 * is constructed with high-segment curved primitives (spheres, capsules, toruses, beveled boxes,
 * multi-part articulated characters, furniture, vehicles, and architecture), surface normals,
 * UV coordinates, vertex colors, procedural texture atlas IDs, and contour outline thickness.
 *
 * Vertex layout (14 floats = 56 bytes per vertex):
 *  [0..2]  x, y, z          (3D world position; X = 2D x, Y = elevation up, Z = 2D y)
 *  [3..5]  nx, ny, nz       (3D surface normal; blended at box corners for gap-free outlines)
 *  [6..7]  u, v             (texture tile UV coordinates [0..1])
 *  [8..11] r, g, b, a       (vertex color [0..1])
 *  [12]    texId            (procedural texture atlas tile index 0..19)
 *  [13]    outlineScale     (inverted-hull contour thickness in world units; 0 disables outline)
 */

import { Cat } from '../entities/cat';
import { Dog } from '../entities/dog';
import { ConeOfSight } from '../entities/sight';
import { SnowballThrower } from '../entities/snowball';
import { GameState, MotorcycleState } from '../world/gameState';
import {
  DIANA_DISTRACTED_KEY,
  DIANA_PRESENT_TAKEN_KEY,
  SIMON_DISTRACTED_KEY,
  SIMON_PRESENT_TAKEN_KEY,
  UPSTAIRS_ALBIN_X,
  UPSTAIRS_DIANA_PRESENT_BOUNDS,
  UPSTAIRS_SIMON_PRESENT_BOUNDS,
} from '../world/levels/levelUpstairs';
import { CollidableDoor, LevelId, OpenedDoorAnimation } from '../world/levels/types';
import {
  DAMAGED_WIRE_HAZARD,
  GROUND_LADDER_BOUNDS,
  LADDER_CLIMB_X,
  ROOF_CHIMNEY_BOUNDS,
  ROOF_WALK_Y,
  TILE_SIZE,
  TileMap,
  TileType,
} from '../world/tilemap';
import {
  directionToYaw,
  getMainHouseRoofElevation,
  getPlayerElevation,
  getTerrainHeight,
  getTerrainNormal,
  INDOOR_WALL_HEIGHT,
  MAIN_HOUSE_ROOF_WALK_HEIGHT,
  MAIN_HOUSE_WALL_HEIGHT,
} from './math3d';
import { TexId } from './textures3d';

export const FLOATS_PER_VERTEX = 14;

export type Color4 = readonly [number, number, number, number];

export interface MeshData {
  vertices: Float32Array;
  vertexCount: number;
}

export interface PointLight3D {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  radius: number;
  intensity: number;
}

export interface DynamicSceneMeshes {
  opaque: MeshData;
  translucent: MeshData;
  pointLights: PointLight3D[];
}

export function rgb(r: number, g: number, b: number, a = 1): Color4 {
  return [r / 255, g / 255, b / 255, a];
}

export function hexToColor4(hex: string, a = 1): Color4 {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return [r / 255, g / 255, b / 255, a];
}

export function darkenColor(c: Color4, factor: number): Color4 {
  return [c[0] * factor, c[1] * factor, c[2] * factor, c[3]];
}

export function lightenColor(c: Color4, boost: number): Color4 {
  return [
    Math.min(1, c[0] + boost),
    Math.min(1, c[1] + boost),
    Math.min(1, c[2] + boost),
    c[3],
  ];
}

class MeshBuilder {
  private buf: Float32Array = new Float32Array(4096 * FLOATS_PER_VERTEX);
  private floatCount = 0;
  private triVertexStep = 0;

  get vertexCount(): number {
    return this.floatCount / FLOATS_PER_VERTEX;
  }

  private ensureCapacity(extraFloats: number): void {
    const needed = this.floatCount + extraFloats;
    if (needed <= this.buf.length) return;
    let nextLen = this.buf.length * 2;
    while (nextLen < needed) nextLen *= 2;
    const next = new Float32Array(nextLen);
    next.set(this.buf.subarray(0, this.floatCount));
    this.buf = next;
  }

  scaleAlphaRange(startVertex: number, alphaScale: number): void {
    const startFloat = startVertex * FLOATS_PER_VERTEX;
    const out = this.buf;
    for (let i = startFloat + 11; i < this.floatCount; i += FLOATS_PER_VERTEX) {
      out[i] *= alphaScale;
    }
  }

  pushVertex(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
    color: Color4,
    texId: number,
    outlineScale: number
  ): void {
    this.ensureCapacity(FLOATS_PER_VERTEX);
    const out = this.buf;
    let idx = this.floatCount;
    out[idx++] = x;
    out[idx++] = y;
    out[idx++] = z;
    out[idx++] = nx;
    out[idx++] = ny;
    out[idx++] = nz;
    out[idx++] = u;
    out[idx++] = v;
    out[idx++] = color[0];
    out[idx++] = color[1];
    out[idx++] = color[2];
    out[idx++] = color[3];
    out[idx++] = texId;
    out[idx++] = outlineScale;
    this.floatCount = idx;

    this.triVertexStep++;
    if (this.triVertexStep === 3) {
      this.triVertexStep = 0;
      const v0 = idx - 3 * FLOATS_PER_VERTEX;
      const v1 = v0 + FLOATS_PER_VERTEX;
      const v2 = v1 + FLOATS_PER_VERTEX;
      const ux = out[v1] - out[v0];
      const uy = out[v1 + 1] - out[v0 + 1];
      const uz = out[v1 + 2] - out[v0 + 2];
      const vx = out[v2] - out[v0];
      const vy = out[v2 + 1] - out[v0 + 1];
      const vz = out[v2 + 2] - out[v0 + 2];
      const cx = uy * vz - uz * vy;
      const cy = uz * vx - ux * vz;
      const cz = ux * vy - uy * vx;
      const anx = out[v0 + 3] + out[v1 + 3] + out[v2 + 3];
      const any = out[v0 + 4] + out[v1 + 4] + out[v2 + 4];
      const anz = out[v0 + 5] + out[v1 + 5] + out[v2 + 5];
      if (cx * anx + cy * any + cz * anz < 0) {
        for (let k = 0; k < FLOATS_PER_VERTEX; k++) {
          const tmp = out[v1 + k];
          out[v1 + k] = out[v2 + k];
          out[v2 + k] = tmp;
        }
      }
    }
  }

  addTriangle(
    p0: readonly [number, number, number],
    p1: readonly [number, number, number],
    p2: readonly [number, number, number],
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.65,
    customNormal?: readonly [number, number, number]
  ): void {
    let nx = 0;
    let ny = 1;
    let nz = 0;
    if (customNormal) {
      [nx, ny, nz] = customNormal;
    } else {
      const ux = p1[0] - p0[0];
      const uy = p1[1] - p0[1];
      const uz = p1[2] - p0[2];
      const vx = p2[0] - p0[0];
      const vy = p2[1] - p0[1];
      const vz = p2[2] - p0[2];
      nx = uy * vz - uz * vy;
      ny = uz * vx - ux * vz;
      nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
    }
    this.pushVertex(p0[0], p0[1], p0[2], nx, ny, nz, 0, 0, color, texId, outlineScale);
    this.pushVertex(p1[0], p1[1], p1[2], nx, ny, nz, 1, 0, color, texId, outlineScale);
    this.pushVertex(p2[0], p2[1], p2[2], nx, ny, nz, 1, 1, color, texId, outlineScale);
  }

  addQuad(
    p0: readonly [number, number, number],
    p1: readonly [number, number, number],
    p2: readonly [number, number, number],
    p3: readonly [number, number, number],
    normal: readonly [number, number, number],
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.65,
    uvScaleU = 1,
    uvScaleV = 1
  ): void {
    const [nx, ny, nz] = normal;
    this.pushVertex(p0[0], p0[1], p0[2], nx, ny, nz, 0, uvScaleV, color, texId, outlineScale);
    this.pushVertex(p1[0], p1[1], p1[2], nx, ny, nz, uvScaleU, uvScaleV, color, texId, outlineScale);
    this.pushVertex(p2[0], p2[1], p2[2], nx, ny, nz, uvScaleU, 0, color, texId, outlineScale);

    this.pushVertex(p0[0], p0[1], p0[2], nx, ny, nz, 0, uvScaleV, color, texId, outlineScale);
    this.pushVertex(p2[0], p2[1], p2[2], nx, ny, nz, uvScaleU, 0, color, texId, outlineScale);
    this.pushVertex(p3[0], p3[1], p3[2], nx, ny, nz, 0, 0, color, texId, outlineScale);
  }

  addBox(
    cx: number,
    baseY: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.65
  ): void {
    const hx = w * 0.5;
    const hy = h * 0.5;
    const hz = d * 0.5;
    const cy = baseY + hy;

    const pushCornerQuad = (
      c0: [number, number, number],
      c1: [number, number, number],
      c2: [number, number, number],
      c3: [number, number, number],
      fn: [number, number, number]
    ) => {
      const blendNormal = (pt: [number, number, number]): [number, number, number] => {
        const dx = (pt[0] - cx) / (hx || 1);
        const dy = (pt[1] - cy) / (hy || 1);
        const dz = (pt[2] - cz) / (hz || 1);
        const clen = Math.hypot(dx, dy, dz) || 1;
        const bnx = fn[0] * 0.68 + (dx / clen) * 0.32;
        const bny = fn[1] * 0.68 + (dy / clen) * 0.32;
        const bnz = fn[2] * 0.68 + (dz / clen) * 0.32;
        const nlen = Math.hypot(bnx, bny, bnz) || 1;
        return [bnx / nlen, bny / nlen, bnz / nlen];
      };

      const n0 = blendNormal(c0);
      const n1 = blendNormal(c1);
      const n2 = blendNormal(c2);
      const n3 = blendNormal(c3);

      this.pushVertex(c0[0], c0[1], c0[2], n0[0], n0[1], n0[2], 0, 1, color, texId, outlineScale);
      this.pushVertex(c1[0], c1[1], c1[2], n1[0], n1[1], n1[2], 1, 1, color, texId, outlineScale);
      this.pushVertex(c2[0], c2[1], c2[2], n2[0], n2[1], n2[2], 1, 0, color, texId, outlineScale);

      this.pushVertex(c0[0], c0[1], c0[2], n0[0], n0[1], n0[2], 0, 1, color, texId, outlineScale);
      this.pushVertex(c2[0], c2[1], c2[2], n2[0], n2[1], n2[2], 1, 0, color, texId, outlineScale);
      this.pushVertex(c3[0], c3[1], c3[2], n3[0], n3[1], n3[2], 0, 0, color, texId, outlineScale);
    };

    const x0 = cx - hx;
    const x1 = cx + hx;
    const y0 = baseY;
    const y1 = baseY + h;
    const z0 = cz - hz;
    const z1 = cz + hz;

    pushCornerQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
    pushCornerQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]);
    pushCornerQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]);
    pushCornerQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
    pushCornerQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]);
    pushCornerQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  }

  /**
   * Adds a chamfered/beveled 3D box whose top and side edges are beveled to catch
   * Wind Waker HD specular & rim highlights.
   */
  addBeveledBox(
    cx: number,
    baseY: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    bevel: number,
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.65
  ): void {
    const b = Math.min(bevel, w * 0.25, h * 0.35, d * 0.25);
    const bodyH = Math.max(0.2, h - b);
    this.addBox(cx, baseY, cz, w, bodyH, d, color, texId, outlineScale);
    // Chamfered top cap
    const topColor = lightenColor(color, 0.04);
    this.addBox(cx, baseY + bodyH - 0.05, cz, w - b * 1.4, b + 0.05, d - b * 1.4, topColor, texId, outlineScale * 0.8);
  }

  addOrientedBox(
    cx: number,
    cy: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    yaw: number,
    pitch: number,
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.6
  ): void {
    const hx = w * 0.5;
    const hy = h * 0.5;
    const hz = d * 0.5;
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);

    const xform = (lx: number, ly: number, lz: number): [number, number, number] => {
      const px = lx * cp - ly * sp;
      const py = lx * sp + ly * cp;
      const pz = lz;
      const wx = px * cyaw - pz * syaw;
      const wy = py;
      const wz = px * syaw + pz * cyaw;
      return [cx + wx, cy + wy, cz + wz];
    };

    const rotN = (nx: number, ny: number, nz: number): [number, number, number] => {
      const px = nx * cp - ny * sp;
      const py = nx * sp + ny * cp;
      const pz = nz;
      return [px * cyaw - pz * syaw, py, px * syaw + pz * cyaw];
    };

    const faces: Array<{
      corners: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
      n: [number, number, number];
    }> = [
      { corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]], n: [0, 0, 1] },
      { corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]], n: [0, 0, -1] },
      { corners: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]], n: [1, 0, 0] },
      { corners: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]], n: [-1, 0, 0] },
      { corners: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]], n: [0, 1, 0] },
      { corners: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]], n: [0, -1, 0] },
    ];

    for (const f of faces) {
      const p0 = xform(...f.corners[0]);
      const p1 = xform(...f.corners[1]);
      const p2 = xform(...f.corners[2]);
      const p3 = xform(...f.corners[3]);
      const wn = rotN(...f.n);
      this.addQuad(p0, p1, p2, p3, wn, color, texId, outlineScale);
    }
  }

  addCylinder(
    cx: number,
    baseY: number,
    cz: number,
    radiusBottom: number,
    radiusTop: number,
    height: number,
    segments: number,
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.65
  ): void {
    const segs = Math.max(5, segments);
    const topY = baseY + height;
    const slopeY = (radiusBottom - radiusTop) / (height || 1);

    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0);
      const s0 = Math.sin(a0);
      const c1 = Math.cos(a1);
      const s1 = Math.sin(a1);

      const n0Len = Math.hypot(c0, slopeY, s0) || 1;
      const n1Len = Math.hypot(c1, slopeY, s1) || 1;
      const n0: [number, number, number] = [c0 / n0Len, slopeY / n0Len, s0 / n0Len];
      const n1: [number, number, number] = [c1 / n1Len, slopeY / n1Len, s1 / n1Len];

      const b0: [number, number, number] = [cx + c0 * radiusBottom, baseY, cz + s0 * radiusBottom];
      const b1: [number, number, number] = [cx + c1 * radiusBottom, baseY, cz + s1 * radiusBottom];
      const t1: [number, number, number] = [cx + c1 * radiusTop, topY, cz + s1 * radiusTop];
      const t0: [number, number, number] = [cx + c0 * radiusTop, topY, cz + s0 * radiusTop];

      const u0 = i / segs;
      const u1 = (i + 1) / segs;

      this.pushVertex(b0[0], b0[1], b0[2], n0[0], n0[1], n0[2], u0, 1, color, texId, outlineScale);
      this.pushVertex(t1[0], t1[1], t1[2], n1[0], n1[1], n1[2], u1, 0, color, texId, outlineScale);
      this.pushVertex(b1[0], b1[1], b1[2], n1[0], n1[1], n1[2], u1, 1, color, texId, outlineScale);

      this.pushVertex(b0[0], b0[1], b0[2], n0[0], n0[1], n0[2], u0, 1, color, texId, outlineScale);
      this.pushVertex(t0[0], t0[1], t0[2], n0[0], n0[1], n0[2], u0, 0, color, texId, outlineScale);
      this.pushVertex(t1[0], t1[1], t1[2], n1[0], n1[1], n1[2], u1, 0, color, texId, outlineScale);

      if (radiusTop > 0.05) {
        this.pushVertex(cx, topY, cz, 0, 1, 0, 0.5, 0.5, color, texId, outlineScale);
        this.pushVertex(t1[0], t1[1], t1[2], n1[0], 0.8, n1[2], 0.5 + c1 * 0.5, 0.5 + s1 * 0.5, color, texId, outlineScale);
        this.pushVertex(t0[0], t0[1], t0[2], n0[0], 0.8, n0[2], 0.5 + c0 * 0.5, 0.5 + s0 * 0.5, color, texId, outlineScale);
      }
      if (radiusBottom > 0.05) {
        this.pushVertex(cx, baseY, cz, 0, -1, 0, 0.5, 0.5, color, texId, outlineScale);
        this.pushVertex(b0[0], b0[1], b0[2], n0[0], -0.8, n0[2], 0.5 + c0 * 0.5, 0.5 + s0 * 0.5, color, texId, outlineScale);
        this.pushVertex(b1[0], b1[1], b1[2], n1[0], -0.8, n1[2], 0.5 + c1 * 0.5, 0.5 + s1 * 0.5, color, texId, outlineScale);
      }
    }
  }

  addCone(
    cx: number,
    baseY: number,
    cz: number,
    radius: number,
    height: number,
    segments: number,
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.65
  ): void {
    this.addCylinder(cx, baseY, cz, radius, 0.02, height, Math.max(5, segments), color, texId, outlineScale);
  }

  /**
   * Adds a smooth high-segment ellipsoid / sphere centered at `(cx, cy, cz)`.
   */
  addSphere(
    cx: number,
    cy: number,
    cz: number,
    rx: number,
    ry: number,
    rz: number,
    latBands: number,
    lonBands: number,
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.65
  ): void {
    const lats = Math.max(4, latBands);
    const lons = Math.max(6, lonBands);
    for (let lat = 0; lat < lats; lat++) {
      const theta0 = (lat / lats) * Math.PI;
      const theta1 = ((lat + 1) / lats) * Math.PI;
      const sinT0 = Math.sin(theta0);
      const cosT0 = Math.cos(theta0);
      const sinT1 = Math.sin(theta1);
      const cosT1 = Math.cos(theta1);

      for (let lon = 0; lon < lons; lon++) {
        const phi0 = (lon / lons) * Math.PI * 2;
        const phi1 = ((lon + 1) / lons) * Math.PI * 2;
        const cosP0 = Math.cos(phi0);
        const sinP0 = Math.sin(phi0);
        const cosP1 = Math.cos(phi1);
        const sinP1 = Math.sin(phi1);

        const n00: [number, number, number] = [sinT0 * cosP0, cosT0, sinT0 * sinP0];
        const n10: [number, number, number] = [sinT1 * cosP0, cosT1, sinT1 * sinP0];
        const n11: [number, number, number] = [sinT1 * cosP1, cosT1, sinT1 * sinP1];
        const n01: [number, number, number] = [sinT0 * cosP1, cosT0, sinT0 * sinP1];

        const p00: [number, number, number] = [cx + n00[0] * rx, cy + n00[1] * ry, cz + n00[2] * rz];
        const p10: [number, number, number] = [cx + n10[0] * rx, cy + n10[1] * ry, cz + n10[2] * rz];
        const p11: [number, number, number] = [cx + n11[0] * rx, cy + n11[1] * ry, cz + n11[2] * rz];
        const p01: [number, number, number] = [cx + n01[0] * rx, cy + n01[1] * ry, cz + n01[2] * rz];

        const u0 = lon / lons;
        const u1 = (lon + 1) / lons;
        const v0 = lat / lats;
        const v1 = (lat + 1) / lats;

        this.pushVertex(p00[0], p00[1], p00[2], n00[0], n00[1], n00[2], u0, v0, color, texId, outlineScale);
        this.pushVertex(p11[0], p11[1], p11[2], n11[0], n11[1], n11[2], u1, v1, color, texId, outlineScale);
        this.pushVertex(p10[0], p10[1], p10[2], n10[0], n10[1], n10[2], u0, v1, color, texId, outlineScale);

        this.pushVertex(p00[0], p00[1], p00[2], n00[0], n00[1], n00[2], u0, v0, color, texId, outlineScale);
        this.pushVertex(p01[0], p01[1], p01[2], n01[0], n01[1], n01[2], u1, v0, color, texId, outlineScale);
        this.pushVertex(p11[0], p11[1], p11[2], n11[0], n11[1], n11[2], u1, v1, color, texId, outlineScale);
      }
    }
  }

  /**
   * Adds a 3D torus (donut ring) centered at `(cx, cy, cz)`, oriented around `'x'`, `'y'`, or `'z'`.
   * Used for scarves, wreaths, rubber tires, cushions, collars, and halo rings.
   */
  addTorus(
    cx: number,
    cy: number,
    cz: number,
    majorR: number,
    minorR: number,
    ringSegs: number,
    tubeSegs: number,
    axis: 'x' | 'y' | 'z',
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.55
  ): void {
    const mapAxis = (x: number, y: number, z: number): [number, number, number] => {
      if (axis === 'y') return [x, y, z];
      if (axis === 'x') return [y, x, z];
      return [x, z, y];
    };

    for (let i = 0; i < ringSegs; i++) {
      const u0 = (i / ringSegs) * Math.PI * 2;
      const u1 = ((i + 1) / ringSegs) * Math.PI * 2;
      const cu0 = Math.cos(u0);
      const su0 = Math.sin(u0);
      const cu1 = Math.cos(u1);
      const su1 = Math.sin(u1);

      for (let j = 0; j < tubeSegs; j++) {
        const v0 = (j / tubeSegs) * Math.PI * 2;
        const v1 = ((j + 1) / tubeSegs) * Math.PI * 2;
        const cv0 = Math.cos(v0);
        const sv0 = Math.sin(v0);
        const cv1 = Math.cos(v1);
        const sv1 = Math.sin(v1);

        const pt = (cu: number, su: number, cv: number, sv: number): [number, number, number] => {
          const r = majorR + minorR * cv;
          const [lx, ly, lz] = mapAxis(r * cu, minorR * sv, r * su);
          return [cx + lx, cy + ly, cz + lz];
        };

        const nm = (cu: number, su: number, cv: number, sv: number): [number, number, number] => {
          return mapAxis(cv * cu, sv, cv * su);
        };

        const p00 = pt(cu0, su0, cv0, sv0);
        const p10 = pt(cu1, su1, cv0, sv0);
        const p11 = pt(cu1, su1, cv1, sv1);
        const p01 = pt(cu0, su0, cv1, sv1);

        const n00 = nm(cu0, su0, cv0, sv0);
        const n10 = nm(cu1, su1, cv0, sv0);
        const n11 = nm(cu1, su1, cv1, sv1);
        const n01 = nm(cu0, su0, cv1, sv1);

        this.pushVertex(p00[0], p00[1], p00[2], n00[0], n00[1], n00[2], 0, 0, color, texId, outlineScale);
        this.pushVertex(p11[0], p11[1], p11[2], n11[0], n11[1], n11[2], 1, 1, color, texId, outlineScale);
        this.pushVertex(p10[0], p10[1], p10[2], n10[0], n10[1], n10[2], 1, 0, color, texId, outlineScale);

        this.pushVertex(p00[0], p00[1], p00[2], n00[0], n00[1], n00[2], 0, 0, color, texId, outlineScale);
        this.pushVertex(p01[0], p01[1], p01[2], n01[0], n01[1], n01[2], 0, 1, color, texId, outlineScale);
        this.pushVertex(p11[0], p11[1], p11[2], n11[0], n11[1], n11[2], 1, 1, color, texId, outlineScale);
      }
    }
  }

  /**
   * Adds a soft dark-blue contact shadow disc on the floor/snow to ground characters and props.
   */
  addShadowDisc(
    cx: number,
    y: number,
    cz: number,
    rx: number,
    rz: number,
    alpha = 0.32
  ): void {
    const segs = 12;
    const centerColor: Color4 = [0.04, 0.06, 0.14, alpha];
    const edgeColor: Color4 = [0.04, 0.06, 0.14, 0.02];
    const sy = y + 0.12;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      this.pushVertex(cx, sy, cz, 0, 1, 0, 0.5, 0.5, centerColor, TexId.SOLID, 0);
      this.pushVertex(cx + Math.cos(a1) * rx, sy, cz + Math.sin(a1) * rz, 0, 1, 0, 1, 1, edgeColor, TexId.SOLID, 0);
      this.pushVertex(cx + Math.cos(a0) * rx, sy, cz + Math.sin(a0) * rz, 0, 1, 0, 0, 1, edgeColor, TexId.SOLID, 0);
    }
  }

  /**
   * Adds a pitched gable roof with overhang eaves, fascia trim, snow ridge cap, and optional icicles.
   */
  addGableRoof(
    cx: number,
    baseY: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    ridgeAlongX: boolean,
    roofColor: Color4,
    gableColor: Color4,
    texId: number = TexId.ROOF_SLATE,
    outlineScale = 0.75,
    withIcicles = true
  ): void {
    const hx = w * 0.5;
    const hz = d * 0.5;
    const topY = baseY + h;

    if (ridgeAlongX) {
      const swL: [number, number, number] = [cx - hx, baseY, cz + hz];
      const seL: [number, number, number] = [cx + hx, baseY, cz + hz];
      const nwL: [number, number, number] = [cx - hx, baseY, cz - hz];
      const neL: [number, number, number] = [cx + hx, baseY, cz - hz];
      const rW: [number, number, number] = [cx - hx, topY, cz];
      const rE: [number, number, number] = [cx + hx, topY, cz];

      const nlen = Math.hypot(h, hz) || 1;
      this.addQuad(swL, seL, rE, rW, [0, hz / nlen, h / nlen], roofColor, texId, outlineScale);
      this.addQuad(neL, nwL, rW, rE, [0, hz / nlen, -h / nlen], roofColor, texId, outlineScale);
      this.addTriangle(nwL, swL, rW, gableColor, TexId.HOUSE_SIDING, outlineScale, [-1, 0, 0]);
      this.addTriangle(seL, neL, rE, gableColor, TexId.HOUSE_SIDING, outlineScale, [1, 0, 0]);
      this.addQuad(nwL, neL, seL, swL, [0, -1, 0], gableColor, TexId.SOLID, 0);
      // Sculpted rounded snow ridge cap
      this.addBox(cx, topY - 1.5, cz, w + 1.8, 2.4, 5.2, rgb(246, 250, 255), TexId.SNOW, 0.45);
      // Snow eaves strips & hanging icicles along South and North eaves
      this.addBox(cx, baseY - 0.4, cz + hz, w + 1.0, 1.4, 2.2, rgb(244, 249, 255), TexId.SNOW, 0.4);
      this.addBox(cx, baseY - 0.4, cz - hz, w + 1.0, 1.4, 2.2, rgb(244, 249, 255), TexId.SNOW, 0.4);
      if (withIcicles) {
        const icicleCount = Math.max(3, Math.floor(w / 14));
        for (let i = 0; i < icicleCount; i++) {
          const ix = cx - hx + 6 + (i / Math.max(1, icicleCount - 1)) * (w - 12);
          const ih = 2.6 + ((i * 7) % 3) * 0.9;
          this.addCone(ix, baseY - ih, cz + hz, 0.65, ih, 6, rgb(212, 238, 255), TexId.SOLID, 0.25);
        }
      }
    } else {
      const swL: [number, number, number] = [cx - hx, baseY, cz + hz];
      const seL: [number, number, number] = [cx + hx, baseY, cz + hz];
      const nwL: [number, number, number] = [cx - hx, baseY, cz - hz];
      const neL: [number, number, number] = [cx + hx, baseY, cz - hz];
      const rN: [number, number, number] = [cx, topY, cz - hz];
      const rS: [number, number, number] = [cx, topY, cz + hz];

      const nlen = Math.hypot(h, hx) || 1;
      this.addQuad(nwL, swL, rS, rN, [-h / nlen, hx / nlen, 0], roofColor, texId, outlineScale);
      this.addQuad(seL, neL, rN, rS, [h / nlen, hx / nlen, 0], roofColor, texId, outlineScale);
      this.addTriangle(swL, seL, rS, gableColor, TexId.HOUSE_SIDING, outlineScale, [0, 0, 1]);
      this.addTriangle(neL, nwL, rN, gableColor, TexId.HOUSE_SIDING, outlineScale, [0, 0, -1]);
      this.addQuad(nwL, neL, seL, swL, [0, -1, 0], gableColor, TexId.SOLID, 0);
      this.addBox(cx, topY - 1.5, cz, 5.2, 2.4, d + 1.8, rgb(246, 250, 255), TexId.SNOW, 0.45);
    }
  }

  build(): MeshData {
    const arr = this.buf.slice(0, this.floatCount);
    return {
      vertices: arr,
      vertexCount: this.floatCount / FLOATS_PER_VERTEX,
    };
  }
}

/**
 * Extracts only triangles that have `outlineScale > 0.001` so Pass 2 (inverted-hull
 * contour pass) skips all non-outlined floor, ground, and ceiling geometry.
 */
export function extractOutlineMesh(mesh: MeshData): MeshData {
  const src = mesh.vertices;
  const triStride = FLOATS_PER_VERTEX * 3;
  let outlineFloats = 0;
  for (let i = 0; i < src.length; i += triStride) {
    if (src[i + 13] > 0.001 || src[i + FLOATS_PER_VERTEX + 13] > 0.001 || src[i + FLOATS_PER_VERTEX * 2 + 13] > 0.001) {
      outlineFloats += triStride;
    }
  }
  const out = new Float32Array(outlineFloats);
  let dstIdx = 0;
  for (let i = 0; i < src.length; i += triStride) {
    if (src[i + 13] > 0.001 || src[i + FLOATS_PER_VERTEX + 13] > 0.001 || src[i + FLOATS_PER_VERTEX * 2 + 13] > 0.001) {
      out.set(src.subarray(i, i + triStride), dstIdx);
      dstIdx += triStride;
    }
  }
  return {
    vertices: out,
    vertexCount: outlineFloats / FLOATS_PER_VERTEX,
  };
}

// ============================================================================
// High-Fi 3D Trees, Rocks, and Foliage Models
// ============================================================================

function addPineTree3D(
  mb: MeshBuilder,
  cx: number,
  baseY: number,
  cz: number,
  variant: number,
  scale = 1.0
): void {
  // Snow mound at base of trunk
  mb.addSphere(cx, baseY + 0.4, cz, 4.2 * scale, 1.4 * scale, 4.2 * scale, 5, 8, rgb(242, 248, 255), TexId.SNOW, 0.35);

  if (variant === 0) {
    // Variant 0: Lush 4-tier Norway spruce with snow pillows on boughs
    mb.addCylinder(cx, baseY, cz, 2.5 * scale, 1.5 * scale, 9.5 * scale, 8, rgb(92, 58, 33), TexId.WOOD_GRAIN, 0.6);
    mb.addCone(cx, baseY + 4.5 * scale, cz, 9.4 * scale, 9.5 * scale, 9, rgb(26, 88, 48), TexId.PINE_FOLIAGE, 0.7);
    mb.addCone(cx, baseY + 9.8 * scale, cz, 7.8 * scale, 9.0 * scale, 9, rgb(34, 108, 58), TexId.PINE_FOLIAGE, 0.7);
    mb.addCone(cx, baseY + 15.0 * scale, cz, 6.0 * scale, 8.2 * scale, 8, rgb(44, 126, 68), TexId.PINE_FOLIAGE, 0.7);
    mb.addCone(cx, baseY + 19.8 * scale, cz, 4.2 * scale, 7.2 * scale, 8, rgb(56, 142, 80), TexId.PINE_FOLIAGE, 0.7);
    // Fluffy snow crown
    mb.addCone(cx, baseY + 23.0 * scale, cz, 2.8 * scale, 4.8 * scale, 8, rgb(246, 250, 255), TexId.SNOW, 0.55);
  } else if (variant === 1) {
    // Variant 1: Twin sister alpine pines
    addPineTree3D(mb, cx - 3.4 * scale, baseY, cz + 1.5 * scale, 0, 0.74 * scale);
    addPineTree3D(mb, cx + 3.2 * scale, baseY, cz - 1.2 * scale, 2, 0.88 * scale);
  } else if (variant === 2) {
    // Variant 2: Frosty blue-teal conical spruce
    mb.addCylinder(cx, baseY, cz, 2.1 * scale, 1.3 * scale, 7.5 * scale, 8, rgb(84, 52, 30), TexId.WOOD_GRAIN, 0.6);
    mb.addCone(cx, baseY + 3.8 * scale, cz, 8.0 * scale, 11.5 * scale, 9, rgb(32, 102, 74), TexId.PINE_FOLIAGE, 0.7);
    mb.addCone(cx, baseY + 9.8 * scale, cz, 6.2 * scale, 10.5 * scale, 9, rgb(46, 124, 92), TexId.PINE_FOLIAGE, 0.7);
    mb.addCone(cx, baseY + 15.5 * scale, cz, 4.4 * scale, 9.0 * scale, 8, rgb(60, 144, 108), TexId.PINE_FOLIAGE, 0.7);
    mb.addCone(cx, baseY + 20.2 * scale, cz, 2.8 * scale, 5.2 * scale, 8, rgb(244, 250, 255), TexId.SNOW, 0.55);
  } else if (variant === 3) {
    // Variant 3: Sculpted Nordic Scots pine (curved reddish bark trunk + multi-lobe canopy)
    mb.addCylinder(cx, baseY, cz, 2.3 * scale, 1.8 * scale, 9 * scale, 8, rgb(132, 70, 38), TexId.WOOD_GRAIN, 0.65);
    mb.addOrientedBox(cx + 0.6 * scale, baseY + 13.5 * scale, cz, 2.8 * scale, 11 * scale, 2.8 * scale, 0.2, 0.14, rgb(156, 84, 44), TexId.WOOD_GRAIN, 0.6);
    mb.addSphere(cx - 2.4 * scale, baseY + 18.5 * scale, cz + 0.8 * scale, 6.4 * scale, 3.8 * scale, 6.4 * scale, 6, 9, rgb(34, 98, 52), TexId.PINE_FOLIAGE, 0.7);
    mb.addSphere(cx + 2.8 * scale, baseY + 20.5 * scale, cz - 1.0 * scale, 6.0 * scale, 3.6 * scale, 6.0 * scale, 6, 9, rgb(46, 118, 64), TexId.PINE_FOLIAGE, 0.7);
    mb.addSphere(cx + 0.2 * scale, baseY + 22.8 * scale, cz, 5.6 * scale, 2.5 * scale, 5.6 * scale, 6, 9, rgb(246, 250, 255), TexId.SNOW, 0.55);
  } else {
    // Variant 4: High-Fi Winter Silver Birch with multi-limbed crown & snow pillows
    mb.addCylinder(cx, baseY, cz, 1.9 * scale, 1.2 * scale, 16 * scale, 8, rgb(244, 242, 238), TexId.BIRCH_BARK, 0.65);
    mb.addOrientedBox(cx - 2.6 * scale, baseY + 13.5 * scale, cz + 0.6 * scale, 1.1 * scale, 7.5 * scale, 1.1 * scale, 0.3, 0.52, rgb(238, 235, 230), TexId.BIRCH_BARK, 0.5);
    mb.addOrientedBox(cx + 2.6 * scale, baseY + 14.2 * scale, cz - 0.6 * scale, 1.1 * scale, 7.0 * scale, 1.1 * scale, -0.4, -0.48, rgb(238, 235, 230), TexId.BIRCH_BARK, 0.5);
    mb.addSphere(cx - 2.2 * scale, baseY + 17.2 * scale, cz + 0.6 * scale, 4.4 * scale, 3.2 * scale, 4.4 * scale, 6, 9, rgb(232, 242, 252), TexId.SNOW, 0.6);
    mb.addSphere(cx + 2.2 * scale, baseY + 18.0 * scale, cz - 0.6 * scale, 4.2 * scale, 3.0 * scale, 4.2 * scale, 6, 9, rgb(236, 245, 255), TexId.SNOW, 0.6);
    mb.addSphere(cx, baseY + 19.6 * scale, cz, 4.8 * scale, 3.4 * scale, 4.8 * scale, 6, 9, rgb(246, 250, 255), TexId.SNOW, 0.6);
  }
}

function addThujaTree3D(mb: MeshBuilder, cx: number, baseY: number, cz: number): void {
  mb.addSphere(cx, baseY + 0.3, cz, 3.2, 1.0, 3.2, 5, 8, rgb(242, 248, 255), TexId.SNOW, 0.3);
  mb.addCylinder(cx, baseY, cz, 1.5, 1.0, 4.5, 8, rgb(88, 56, 32), TexId.WOOD_GRAIN, 0.55);
  mb.addCone(cx, baseY + 3.0, cz, 5.4, 9.5, 9, rgb(36, 114, 60), TexId.PINE_FOLIAGE, 0.65);
  mb.addCone(cx, baseY + 8.5, cz, 4.4, 9.0, 9, rgb(44, 130, 70), TexId.PINE_FOLIAGE, 0.65);
  mb.addCone(cx, baseY + 14.0, cz, 3.1, 7.2, 8, rgb(54, 144, 80), TexId.PINE_FOLIAGE, 0.65);
  mb.addCone(cx, baseY + 17.5, cz, 2.0, 4.5, 8, rgb(244, 250, 255), TexId.SNOW, 0.5);
}

function addHedgeTile3D(mb: MeshBuilder, cx: number, baseY: number, cz: number): void {
  mb.addBeveledBox(cx, baseY, cz, 15.6, 8.8, 15.6, 1.8, rgb(38, 114, 58), TexId.PINE_FOLIAGE, 0.65);
  mb.addBeveledBox(cx, baseY + 7.6, cz, 16.0, 2.4, 16.0, 1.0, rgb(244, 250, 255), TexId.SNOW, 0.45);
}

function addGraniteCliff3D(mb: MeshBuilder, cx: number, baseY: number, cz: number, seed: number): void {
  const h = 15 + (seed % 5) * 3;
  const rx = 10.5 + (seed % 3) * 1.5;
  mb.addCylinder(cx, baseY - 2, cz, rx, rx * 0.72, h, 10, rgb(108, 116, 128), TexId.STONE_FLOOR, 0.75);
  mb.addSphere(cx, baseY + h - 2.0, cz, rx * 0.7, 2.8, rx * 0.7, 8, 12, rgb(244, 250, 255), TexId.SNOW, 0.55);
}

function addWindowWithShutters3D(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  shutterColor: Color4
): void {
  // Outer wooden window frame & stone sill
  mb.addBox(cx, cy - 0.8, cz + 0.3, w + 2.4, 1.2, 2.2, rgb(238, 240, 246), TexId.SOLID, 0.4);
  mb.addBox(cx, cy + 0.2, cz, w, h, 1.4, rgb(255, 232, 142), TexId.WINDOW_GLOW, 0.45);
  // Left & Right louvered shutters
  const sw = Math.max(2.6, w * 0.22);
  mb.addBox(cx - w * 0.5 - sw * 0.55, cy + 0.2, cz + 0.2, sw, h, 1.2, shutterColor, TexId.WOOD_GRAIN, 0.45);
  mb.addBox(cx + w * 0.5 + sw * 0.55, cy + 0.2, cz + 0.2, sw, h, 1.2, shutterColor, TexId.WOOD_GRAIN, 0.45);
  // Snow cap on window header
  mb.addBox(cx, cy + h + 0.2, cz + 0.3, w + 2.0, 1.0, 1.8, rgb(246, 250, 255), TexId.SNOW, 0.3);
}

// ============================================================================
// Static Level 1: Outside (32x28 TileMap = 512x448 world units)
// ============================================================================

export function buildOutsideStaticMesh(map: TileMap): MeshBuilder {
  const mb = new MeshBuilder();
  const ts = map.tileSize; // 16

  // 1. High-Resolution Sloped Terrain Heightfield Mesh (subdivided into 4x4 world-unit cells)
  const step = 4;
  const gridCols = Math.floor((map.cols * ts) / step);
  const gridRows = Math.floor((map.rows * ts) / step);

  for (let gz = 0; gz < gridRows; gz++) {
    for (let gx = 0; gx < gridCols; gx++) {
      const x0 = gx * step;
      const z0 = gz * step;
      const x1 = x0 + step;
      const z1 = z0 + step;

      const tileCol = Math.min(map.cols - 1, Math.floor((x0 + step * 0.5) / ts));
      const tileRow = Math.min(map.rows - 1, Math.floor((z0 + step * 0.5) / ts));
      const tile = map.tiles[tileRow][tileCol];

      let color: Color4 = rgb(240, 246, 255);
      let texId: number = TexId.SNOW;
      let yOffset = 0;

      if (tile === TileType.Road || tile === TileType.ElectricCar || tile === TileType.Motorcycle) {
        color = rgb(168, 176, 190);
        texId = TexId.GRAVEL;
        yOffset = -0.28;
      }

      const y00 = getTerrainHeight(x0, z0, 'level-outside') + yOffset;
      const y10 = getTerrainHeight(x1, z0, 'level-outside') + yOffset;
      const y11 = getTerrainHeight(x1, z1, 'level-outside') + yOffset;
      const y01 = getTerrainHeight(x0, z1, 'level-outside') + yOffset;

      const n00 = getTerrainNormal(x0, z0, 'level-outside');
      const n10 = getTerrainNormal(x1, z0, 'level-outside');
      const n11 = getTerrainNormal(x1, z1, 'level-outside');
      const n01 = getTerrainNormal(x0, z1, 'level-outside');

      const u0 = (gx % 4) * 0.25;
      const u1 = u0 + 0.25;
      const v0 = (gz % 4) * 0.25;
      const v1 = v0 + 0.25;

      mb.pushVertex(x0, y00, z0, n00.x, n00.y, n00.z, u0, v0, color, texId, 0);
      mb.pushVertex(x0, y01, z1, n01.x, n01.y, n01.z, u0, v1, color, texId, 0);
      mb.pushVertex(x1, y11, z1, n11.x, n11.y, n11.z, u1, v1, color, texId, 0);

      mb.pushVertex(x0, y00, z0, n00.x, n00.y, n00.z, u0, v0, color, texId, 0);
      mb.pushVertex(x1, y11, z1, n11.x, n11.y, n11.z, u1, v1, color, texId, 0);
      mb.pushVertex(x1, y10, z0, n10.x, n10.y, n10.z, u1, v0, color, texId, 0);
    }
  }

  // 2. Tile-driven Trees, Thuja, Hedges, and Northern Granite Cliffs
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const tile = map.tiles[r][c];
      const cx = c * ts + ts * 0.5;
      const cz = r * ts + ts * 0.5;
      const baseY = getTerrainHeight(cx, cz, 'level-outside');
      const seed = (c * 31 + r * 17) % 10;

      if (tile === TileType.Tree) {
        if (r <= 2 && c <= 3) {
          addGraniteCliff3D(mb, cx, baseY, cz, seed);
        }
        const variant = seed < 3 ? 0 : seed < 5 ? 1 : seed < 7 ? 2 : seed < 9 ? 3 : 4;
        addPineTree3D(mb, cx, baseY, cz, variant, 1.0);
      } else if (tile === TileType.Thuja) {
        addThujaTree3D(mb, cx, baseY, cz);
      } else if (tile === TileType.Hedge) {
        addHedgeTile3D(mb, cx, baseY, cz);
      }
    }
  }

  // 3. High-Fi Main Villa House (cols 4..16 => x: 64..272, rows 3..9 => z: 48..160)
  {
    const x0 = 4 * ts; // 64
    const x1 = 17 * ts; // 272
    const z0 = 3 * ts; // 48
    const z1 = 10 * ts; // 160
    const cx = (x0 + x1) * 0.5; // 168
    const cz = (z0 + z1) * 0.5; // 104
    const w = x1 - x0; // 208
    const d = z1 - z0; // 112
    const baseY = getTerrainHeight(5 * ts, 9 * ts, 'level-outside');

    // Chiseled granite foundation plinth
    mb.addBeveledBox(cx, baseY - 4, cz, w + 4, 6.2, d + 4, 0.8, rgb(122, 126, 138), TexId.STONE_FLOOR, 0.8);

    // Main two-story cream-gold Swedish wooden facade
    const wallH = MAIN_HOUSE_WALL_HEIGHT; // 34
    mb.addBox(cx, baseY + 2, cz, w, wallH, d, rgb(246, 222, 166), TexId.HOUSE_SIDING, 0.9);

    // Mid-story architectural belt course & cornice trim
    mb.addBox(cx, baseY + 18, cz, w + 1.6, 1.6, d + 1.6, rgb(248, 248, 252), TexId.SOLID, 0.45);
    mb.addBox(cx, baseY + wallH + 0.5, cz, w + 2.0, 1.8, d + 2.0, rgb(248, 248, 252), TexId.SOLID, 0.45);

    // White corner trim pilasters
    for (const [tx, tz] of [
      [x0, z0],
      [x1, z0],
      [x0, z1],
      [x1, z1],
    ]) {
      mb.addBox(tx, baseY + 2, tz, 4.4, wallH + 0.5, 4.4, rgb(248, 248, 252), TexId.SOLID, 0.55);
    }

    // Pitched slate gable roof with snow ridge & icicles
    const roofBaseY = baseY + 2 + wallH;
    mb.addGableRoof(
      cx,
      roofBaseY,
      cz,
      w + 8,
      16,
      d + 8,
      true,
      rgb(62, 74, 94),
      rgb(238, 212, 152),
      TexId.ROOF_SLATE,
      0.9,
      true
    );

    // High-Fi Red Brick Chimney on the roof at ROOF_CHIMNEY_BOUNDS (x: 120..136, z: 58..76)
    const roofWalkY = baseY + MAIN_HOUSE_ROOF_WALK_HEIGHT;
    const chimX = ROOF_CHIMNEY_BOUNDS.x + ROOF_CHIMNEY_BOUNDS.width * 0.5;
    const chimZ = ROOF_CHIMNEY_BOUNDS.y + ROOF_CHIMNEY_BOUNDS.height * 0.5;
    mb.addBox(chimX, roofWalkY, chimZ, 16, 17, 16, rgb(188, 62, 48), TexId.BRICK_RED, 0.8);
    // Corbeled brick chimney crown
    mb.addBeveledBox(chimX, roofWalkY + 17.0, chimZ, 18.5, 2.8, 18.5, 0.6, rgb(245, 250, 255), TexId.SNOW, 0.55);
    mb.addBox(chimX, roofWalkY + 19.3, chimZ, 11, 1.2, 11, rgb(24, 20, 24), TexId.SOLID, 0);
    // Dual terracotta chimney flue pots
    mb.addCylinder(chimX - 3, roofWalkY + 19.3, chimZ, 2.0, 1.8, 3.2, 10, rgb(164, 68, 44), TexId.SOLID, 0.45);
    mb.addCylinder(chimX + 3, roofWalkY + 19.3, chimZ, 2.0, 1.8, 3.2, 10, rgb(164, 68, 44), TexId.SOLID, 0.45);

    // Shuttered Glowing Windows on South wall (cols 5..6 and 14..15, two stories)
    const greenShutter = rgb(44, 108, 68);
    for (const winCol of [5.5, 14.5]) {
      const wx = (winCol + 0.5) * ts;
      addWindowWithShutters3D(mb, wx, baseY + 7.5, z1 + 0.3, 18, 9.5, greenShutter);
      addWindowWithShutters3D(mb, wx, baseY + 21.5, z1 + 0.3, 18, 9.5, greenShutter);
    }

    // Center Veranda / Glass Porch (cols 9..11 => x: 144..192, z: 160)
    mb.addBeveledBox(168, baseY, z1 + 5.5, 50, 4.2, 13, 0.6, rgb(164, 114, 68), TexId.WOOD_FLOOR, 0.65);
    // Porch steps
    mb.addBeveledBox(168, baseY, z1 + 13.5, 22, 2.2, 4.5, 0.4, rgb(148, 152, 162), TexId.STONE_FLOOR, 0.5);
    // Turned classical porch columns & balustrade rails
    for (const colX of [146, 158, 178, 190]) {
      mb.addCylinder(colX, baseY + 4.2, z1 + 10.5, 1.6, 1.3, 20, 12, rgb(248, 248, 252), TexId.SOLID, 0.5);
      mb.addBox(colX, baseY + 4.2, z1 + 10.5, 3.8, 1.8, 3.8, rgb(238, 240, 246), TexId.SOLID, 0.4);
    }
    mb.addBox(152, baseY + 8.5, z1 + 10.5, 12, 1.2, 1.4, rgb(248, 248, 252), TexId.SOLID, 0.4);
    mb.addBox(184, baseY + 8.5, z1 + 10.5, 12, 1.2, 1.4, rgb(248, 248, 252), TexId.SOLID, 0.4);
    mb.addGableRoof(168, baseY + 24, z1 + 5.5, 54, 7.5, 15, false, rgb(62, 74, 94), rgb(246, 222, 166), TexId.ROOF_SLATE, 0.7, false);
    // Main Entrance Double Door (replacing the former center porch window)
    mb.addBox(168, baseY + 4.2, z1 + 0.4, 28, 19.2, 1.4, rgb(248, 248, 252), TexId.SOLID, 0.5);
    mb.addBeveledBox(168 - 6.4, baseY + 4.2, z1 + 0.8, 12.0, 17.8, 1.6, 0.45, rgb(124, 64, 34), TexId.WOOD_GRAIN, 0.6);
    mb.addBeveledBox(168 + 6.4, baseY + 4.2, z1 + 0.8, 12.0, 17.8, 1.6, 0.45, rgb(124, 64, 34), TexId.WOOD_GRAIN, 0.6);
    mb.addBox(168, baseY + 4.2, z1 + 1.0, 0.7, 17.8, 1.7, rgb(52, 28, 16), TexId.SOLID, 0.2);
    // Brass double-door handles
    mb.addSphere(168 - 1.9, baseY + 12.2, z1 + 1.9, 0.7, 1.1, 0.6, 4, 6, rgb(242, 200, 74), TexId.SOLID, 0.3);
    mb.addSphere(168 + 1.9, baseY + 12.2, z1 + 1.9, 0.7, 1.1, 0.6, 4, 6, rgb(242, 200, 74), TexId.SOLID, 0.3);

    // Front Entrance Door at col 13, row 9 (x: 216, z: 160) with Torus Holly Wreath & Lanterns
    const doorX = 13.5 * ts; // 216
    mb.addBox(doorX, baseY + 2, z1 + 0.4, 15, 19.5, 1.4, rgb(248, 248, 252), TexId.SOLID, 0.5);
    mb.addBeveledBox(doorX, baseY + 2, z1 + 0.8, 12.5, 18, 1.6, 0.5, rgb(124, 64, 34), TexId.WOOD_GRAIN, 0.6);
    // 3D Torus Holly Wreath + Red Ribbon Bow on front door
    mb.addTorus(doorX, baseY + 13.5, z1 + 2.0, 2.6, 0.95, 14, 8, 'z', rgb(34, 128, 54), TexId.PINE_FOLIAGE, 0.4);
    mb.addSphere(doorX, baseY + 15.8, z1 + 2.4, 1.1, 0.8, 0.7, 6, 8, rgb(224, 36, 42), TexId.SOLID, 0.3);
    // Brass coach lanterns flanking the front door
    mb.addSphere(doorX - 9.5, baseY + 14.5, z1 + 1.6, 1.3, 1.8, 1.3, 6, 8, rgb(255, 228, 120), TexId.SOLID, 0.35);
    mb.addSphere(doorX + 9.5, baseY + 14.5, z1 + 1.6, 1.3, 1.8, 1.3, 6, 8, rgb(255, 228, 120), TexId.SOLID, 0.35);
  }

  // 4. Guest Cottage 1 & 2 ("Stuga 1" at cols 19..22, "Stuga 2" at cols 25..28, rows 5..8)
  for (const [stugaCol, wallColor, gableColor] of [
    [21, rgb(172, 106, 58), rgb(156, 94, 48)],
    [27, rgb(164, 98, 52), rgb(148, 88, 44)],
  ] as const) {
    const cx = stugaCol * ts;
    const cz = 7 * ts;
    const w = 4 * ts;
    const d = 4 * ts;
    const baseY = getTerrainHeight(cx, cz, 'level-outside');

    mb.addBeveledBox(cx, baseY - 3, cz, w + 3, 4.2, d + 3, 0.6, rgb(118, 122, 132), TexId.STONE_FLOOR, 0.7);
    mb.addBox(cx, baseY + 1, cz, w, 20, d, wallColor, TexId.LOG_WALL, 0.85);

    // Authentic Swedish protruding notched log corners ("knuttimring")
    for (const [kx, kz] of [
      [cx - w * 0.5, cz - d * 0.5],
      [cx + w * 0.5, cz - d * 0.5],
      [cx - w * 0.5, cz + d * 0.5],
      [cx + w * 0.5, cz + d * 0.5],
    ]) {
      mb.addBox(kx, baseY + 1, kz, 5.2, 20.2, 5.2, gableColor, TexId.LOG_WALL, 0.6);
    }

    mb.addGableRoof(cx, baseY + 21, cz, w + 7, 12, d + 7, true, rgb(58, 68, 86), gableColor, TexId.ROOF_SLATE, 0.85, true);
    // Small stuga brick chimney
    mb.addBox(cx + 12, baseY + 26, cz - 8, 7, 9, 7, rgb(182, 60, 46), TexId.BRICK_RED, 0.6);
    mb.addBox(cx + 12, baseY + 34.5, cz - 8, 8.2, 1.5, 8.2, rgb(245, 250, 255), TexId.SNOW, 0.4);
    // Door, stone step & shuttered window
    mb.addBeveledBox(cx - 11, baseY + 1, cz + d * 0.5 + 0.5, 10.5, 15.5, 1.6, 0.4, rgb(112, 62, 32), TexId.WOOD_GRAIN, 0.55);
    mb.addBeveledBox(cx - 11, baseY, cz + d * 0.5 + 3.5, 13, 2.0, 5.5, 0.4, rgb(138, 142, 152), TexId.STONE_FLOOR, 0.45);
    addWindowWithShutters3D(mb, cx + 11, baseY + 7, cz + d * 0.5 + 0.3, 12, 8.5, rgb(186, 44, 42));
  }

  // 6. White Shed with Red Double Barn Doors (cols 25..29 => x: 400..480, rows 16..19 => z: 256..320)
  {
    const cx = 27.5 * ts; // 440
    const cz = 18 * ts; // 288
    const w = 5 * ts; // 80
    const d = 4 * ts; // 64
    const baseY = getTerrainHeight(cx, cz, 'level-outside');

    mb.addBeveledBox(cx, baseY - 2, cz, w + 2, 3.2, d + 2, 0.5, rgb(114, 118, 126), TexId.STONE_FLOOR, 0.7);
    mb.addBox(cx, baseY + 1, cz, w, 18.5, d, rgb(238, 240, 246), TexId.HOUSE_SIDING, 0.85);
    mb.addGableRoof(cx, baseY + 19.5, cz, w + 6, 10.5, d + 6, true, rgb(64, 72, 86), rgb(224, 228, 236), TexId.ROOF_SLATE, 0.85, true);
    // Double red barn doors with white X cross-bracing & iron hinges
    const doorZ = cz + d * 0.5 + 0.5;
    mb.addBox(cx, baseY + 1, doorZ, 26, 15.5, 1.4, rgb(214, 38, 38), TexId.WOOD_GRAIN, 0.65);
    mb.addBox(cx, baseY + 1, doorZ + 0.3, 1.4, 15.5, 1.2, rgb(245, 245, 250), TexId.SOLID, 0.35);
    mb.addOrientedBox(cx - 6.5, baseY + 8.5, doorZ + 0.4, 1.1, 14, 1.0, 0, 0.62, rgb(245, 245, 250), TexId.SOLID, 0.3);
    mb.addOrientedBox(cx + 6.5, baseY + 8.5, doorZ + 0.4, 1.1, 14, 1.0, 0, -0.62, rgb(245, 245, 250), TexId.SOLID, 0.3);
  }

  // 7. Blue Garage + EV Wallbox (cols 2..7 => x: 32..128, rows 21..25 => z: 336..416)
  {
    const cx = 5 * ts; // 80
    const cz = 23.5 * ts; // 376
    const w = 6 * ts; // 96
    const d = 5 * ts; // 80
    const baseY = getTerrainHeight(cx, cz, 'level-outside');

    mb.addBeveledBox(cx, baseY - 2, cz, w + 2, 3.2, d + 2, 0.5, rgb(118, 122, 130), TexId.STONE_FLOOR, 0.7);
    mb.addBox(cx, baseY + 1, cz, w, 20.5, d, rgb(64, 122, 196), TexId.BLUE_SIDING, 0.85);
    mb.addGableRoof(cx, baseY + 21.5, cz, w + 6, 11.5, d + 6, true, rgb(54, 64, 82), rgb(58, 108, 176), TexId.ROOF_SLATE, 0.85, true);
    // Sectional overhead garage doors on South wall
    mb.addBeveledBox(cx - 20, baseY + 1, cz + d * 0.5 + 0.5, 32, 15.5, 1.5, 0.4, rgb(234, 240, 248), TexId.HOUSE_SIDING, 0.55);
    mb.addBeveledBox(cx + 20, baseY + 1, cz + d * 0.5 + 0.5, 32, 15.5, 1.5, 0.4, rgb(234, 240, 248), TexId.HOUSE_SIDING, 0.55);

    // High-Fi EV Wallbox mounted on East wall at col 7, row 22 (x: 128, z: 358)
    const wbY = getTerrainHeight(128, 358, 'level-outside');
    mb.addBeveledBox(129, wbY + 7.5, 358, 3.4, 7.2, 5.6, 0.5, rgb(38, 44, 54), TexId.SOLID, 0.55);
    // Glowing green LED status ring on Wallbox
    mb.addTorus(130.9, wbY + 11.5, 358, 1.2, 0.35, 10, 6, 'x', rgb(64, 248, 136), TexId.SOLID, 0.25);
  }

  // 8. High-Fi Sculpted Electric Car & Charging Cable across row 22 (car at cols 17..19 => x: 272..320, rows 21..22 => z: 336..368)
  {
    const carX = 18.5 * ts; // 296
    const carZ = 22 * ts; // 352
    const baseY = getTerrainHeight(carX, carZ, 'level-outside');

    // Ground contact shadow under EV
    mb.addShadowDisc(carX, baseY, carZ, 24, 13, 0.38);

    // 4 Rubber Tires (Torus) + Silver Alloy Hubs
    for (const [wx, wz] of [
      [-14, -9.8],
      [14, -9.8],
      [-14, 9.8],
      [14, 9.8],
    ]) {
      mb.addTorus(carX + wx, baseY + 3.6, carZ + wz, 2.6, 1.2, 14, 8, 'z', rgb(26, 28, 34), TexId.SOLID, 0.5);
      mb.addCylinder(carX + wx, baseY + 2.2, carZ + wz, 1.8, 1.8, 2.8, 10, rgb(212, 220, 232), TexId.SOLID, 0.35);
    }

    // Lower sculpted aerodynamic body & rocker panels
    mb.addBeveledBox(carX, baseY + 2.4, carZ, 45, 6.8, 21, 1.4, rgb(38, 134, 156), TexId.SOLID, 0.75);
    // Front & rear bumpers
    mb.addBeveledBox(carX, baseY + 2.0, carZ, 47, 2.8, 20, 0.8, rgb(28, 36, 46), TexId.SOLID, 0.55);
    // Sloped greenhouse cabin + tinted glass windows
    mb.addBeveledBox(carX - 1.5, baseY + 8.6, carZ, 26, 5.8, 17.5, 1.6, rgb(24, 34, 48), TexId.SOLID, 0.7);
    mb.addBeveledBox(carX - 1.5, baseY + 13.6, carZ, 21, 1.4, 15.5, 0.5, rgb(44, 148, 170), TexId.SOLID, 0.55);
    // Snow drift on car roof & hood
    mb.addBeveledBox(carX - 1.5, baseY + 14.6, carZ, 19, 1.3, 14, 0.5, rgb(244, 250, 255), TexId.SNOW, 0.4);
    // Side mirrors
    mb.addSphere(carX - 9, baseY + 9.2, carZ - 10.2, 1.2, 0.9, 1.5, 6, 8, rgb(38, 134, 156), TexId.SOLID, 0.4);
    mb.addSphere(carX - 9, baseY + 9.2, carZ + 10.2, 1.2, 0.9, 1.5, 6, 8, rgb(38, 134, 156), TexId.SOLID, 0.4);
    // Full-width LED DRL front lightbar (West) & crimson rear taillight bar (East)
    mb.addBox(carX - 22.8, baseY + 5.8, carZ, 1.0, 1.6, 17, rgb(255, 248, 200), TexId.SOLID, 0.3);
    mb.addBox(carX + 22.8, baseY + 6.0, carZ, 1.0, 1.6, 17, rgb(238, 38, 48), TexId.SOLID, 0.3);

    // Charging cable running along row 22 (z = 358) from Wallbox (x = 128) to Car port (x = 274)
    for (let segX = 132; segX < 272; segX += 10) {
      const cy = getTerrainHeight(segX, 358, 'level-outside');
      mb.addBeveledBox(segX + 5, cy + 0.4, 358, 10.5, 1.4, 1.6, 0.4, rgb(26, 30, 38), TexId.SOLID, 0.4);
    }
    // Exposed frayed copper core at DAMAGED_WIRE_HAZARD
    const hx = DAMAGED_WIRE_HAZARD.x + DAMAGED_WIRE_HAZARD.width * 0.5;
    const hz = DAMAGED_WIRE_HAZARD.y + DAMAGED_WIRE_HAZARD.height * 0.5;
    const hy = getTerrainHeight(hx, hz, 'level-outside');
    mb.addBeveledBox(hx, hy + 0.6, hz, 8.5, 2.0, 3.0, 0.5, rgb(242, 138, 42), TexId.SOLID, 0.5);
  }

  // 9. High-Fi Outdoor Patio Table, Benches & Folded Umbrella (cols 7..8 => x: 128, z: 240)
  {
    const px = 8 * ts; // 128
    const pz = 15 * ts; // 240
    const baseY = getTerrainHeight(px, pz, 'level-outside');
    mb.addShadowDisc(px, baseY, pz, 15, 14, 0.3);
    // Table legs & plank top
    mb.addBox(px - 8, baseY, pz, 2.0, 5.8, 11, rgb(122, 76, 38), TexId.WOOD_GRAIN, 0.55);
    mb.addBox(px + 8, baseY, pz, 2.0, 5.8, 11, rgb(122, 76, 38), TexId.WOOD_GRAIN, 0.55);
    mb.addBeveledBox(px, baseY + 5.2, pz, 23, 1.4, 14.5, 0.4, rgb(152, 98, 50), TexId.WOOD_GRAIN, 0.65);
    mb.addBeveledBox(px, baseY + 6.4, pz, 21, 1.1, 13, 0.4, rgb(244, 250, 255), TexId.SNOW, 0.4);
    // Folded winter patio umbrella in center of table
    mb.addCylinder(px, baseY + 1, pz, 0.8, 0.8, 17, 8, rgb(92, 62, 36), TexId.WOOD_GRAIN, 0.45);
    mb.addCone(px, baseY + 9.5, pz, 3.6, 9.5, 10, rgb(198, 52, 48), TexId.FABRIC, 0.55);
    // Benches
    mb.addBeveledBox(px, baseY + 2.4, pz - 10.5, 21, 1.2, 4.2, 0.3, rgb(142, 90, 44), TexId.WOOD_GRAIN, 0.55);
    mb.addBeveledBox(px, baseY + 2.4, pz + 10.5, 21, 1.2, 4.2, 0.3, rgb(142, 90, 44), TexId.WOOD_GRAIN, 0.55);
  }

  return mb;
}

// ============================================================================
// Helper for Indoor Levels: 2-Tile-High Architectural Walls, Doorways, Windows & Ceilings
// ============================================================================

type WallOverrideKind =
  | 'door-left'
  | 'door-right'
  | 'window-south'
  | 'window-north'
  | 'window-north-transparent';

interface IndoorWallOptions {
  wallHeight?: number;
  wallOverrides?: Map<string, WallOverrideKind>;
  /** Floor coordinates that act as doorway openings and should have a 3D frame + upper header built above them. */
  openableDoorCoords?: ReadonlyArray<readonly [number, number]>;
  /** Optional floor rectangle (e.g. descending stairwell opening) where flat y=0 floor tiles are omitted. */
  skipFloorRect?: { minCol: number; maxCol: number; minRow: number; maxRow: number };
}

function tileKey(col: number, row: number): string {
  return `${col},${row}`;
}

function addStandardWallTile3D(
  mb: MeshBuilder,
  cx: number,
  cz: number,
  ts: number,
  wallHeight: number,
  trimAdjacentWidth = 0
): void {
  const wainscotH = 10.6;
  const trimW = Math.max(4, ts + 0.3 - trimAdjacentWidth);

  // 1. Dark walnut baseboard plinth (y = 0..1.8)
  mb.addBox(cx, 0, cz, trimW, 1.8, ts + 0.35, rgb(110, 72, 42), TexId.WOOD_GRAIN, 0.35);

  // 2. Cream raised-panel wainscoting tier (y = 1.8..10.6)
  mb.addBox(cx, 1.8, cz, ts, wainscotH - 1.8, ts, rgb(228, 220, 206), TexId.WOOD_GRAIN, 0.45);
  // Subtle recessed panel reliefs on North & South faces
  mb.addBox(cx, 3.0, cz, ts * 0.72, 6.2, ts + 0.28, rgb(242, 236, 224), TexId.SOLID, 0.25);
  mb.addBox(cx, 3.0, cz, ts + 0.28, 6.2, ts * 0.72, rgb(242, 236, 224), TexId.SOLID, 0.25);

  // 3. Projecting oak dado chair-rail molding (y = 10.6..11.8)
  mb.addBox(cx, 10.6, cz, trimW, 1.2, ts + 0.45, rgb(146, 98, 56), TexId.WOOD_GRAIN, 0.35);

  // 4. Two stacked 1:1 unstretched Nordic wallpaper tiers (y = 11.8..21.0 & 21.0..30.2)
  const midStart = 11.8;
  const midTop = wallHeight - 1.8;
  const midHeight = Math.max(4, midTop - midStart);
  const lowerTierH = midHeight * 0.5;
  const upperTierH = midHeight - lowerTierH;
  mb.addBox(cx, midStart, cz, ts, lowerTierH, ts, rgb(236, 226, 208), TexId.INTERIOR_WALL, 0.55);
  mb.addBox(cx, midStart + lowerTierH, cz, ts, upperTierH, ts, rgb(236, 226, 208), TexId.INTERIOR_WALL, 0.55);

  // 5. Routed walnut ceiling crown molding (y = 30.2..wallHeight)
  mb.addBeveledBox(cx, midTop, cz, trimW + 0.1, 1.8, ts + 0.45, 0.35, rgb(92, 60, 38), TexId.WOOD_GRAIN, 0.45);
}

function addWindowWallTile3D(
  mb: MeshBuilder,
  cx: number,
  cz: number,
  ts: number,
  wallHeight: number,
  kind: 'window-south' | 'window-north' | 'window-north-transparent'
): void {
  const sillY = 7.4;
  const headerY = 25.4;

  // Lower wall below the window (baseboard + short wainscoting + oak window sill)
  mb.addBox(cx, 0, cz, ts + 0.25, 1.6, ts + 0.3, rgb(110, 72, 42), TexId.WOOD_GRAIN, 0.35);
  mb.addBox(cx, 1.6, cz, ts, sillY - 1.6, ts, rgb(228, 220, 206), TexId.WOOD_GRAIN, 0.45);
  mb.addBeveledBox(cx, sillY, cz, ts + 0.2, 1.2, ts + 1.4, 0.3, rgb(138, 92, 52), TexId.WOOD_GRAIN, 0.45);

  // Upper wall lintel above the window + crown molding
  mb.addBox(cx, headerY, cz, ts, wallHeight - headerY - 1.8, ts, rgb(236, 226, 208), TexId.INTERIOR_WALL, 0.55);
  mb.addBeveledBox(cx, wallHeight - 1.8, cz, ts + 0.25, 1.8, ts + 0.45, 0.35, rgb(92, 60, 38), TexId.WOOD_GRAIN, 0.45);

  // Side wooden window mullions & top transom bar
  const openH = headerY - (sillY + 1.2);
  mb.addBox(cx - ts * 0.45, sillY + 1.2, cz, 1.6, openH, 5.2, rgb(116, 74, 42), TexId.WOOD_GRAIN, 0.4);
  mb.addBox(cx + ts * 0.45, sillY + 1.2, cz, 1.6, openH, 5.2, rgb(116, 74, 42), TexId.WOOD_GRAIN, 0.4);
  mb.addBox(cx, sillY + 1.2 + openH * 0.55, cz, ts - 1.6, 1.1, 3.6, rgb(116, 74, 42), TexId.WOOD_GRAIN, 0.3);

  if (kind !== 'window-north-transparent') {
    // Warm frosted casement window pane so interiors stay cozy at night
    mb.addBox(cx, sillY + 1.2, cz, ts - 2.6, openH - 0.2, 2.2, rgb(252, 232, 158), TexId.WINDOW_GLOW, 0.35);
  }
}

function addDoorWallLintelTile3D(
  mb: MeshBuilder,
  col: number,
  row: number,
  ts: number,
  wallHeight: number,
  side: 'door-left' | 'door-right'
): void {
  const cx = col * ts + ts * 0.5;
  const cz = row * ts + ts * 0.5;
  const doorHeight = 24.4;

  // Floor threshold beneath the door leaf so there is never a black gap when close to the doorway
  mb.addQuad(
    [col * ts, 0, (row + 1) * ts],
    [(col + 1) * ts, 0, (row + 1) * ts],
    [(col + 1) * ts, 0, row * ts],
    [col * ts, 0, row * ts],
    [0, 1, 0],
    rgb(142, 98, 58),
    TexId.WOOD_GRAIN,
    0
  );

  // Outer door casing jamb + carved oak architrave header bar
  const jambX = side === 'door-left' ? col * ts + 1.1 : (col + 1) * ts - 1.1;
  mb.addBox(jambX, 0, cz, 2.2, doorHeight, ts * 0.85, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);
  mb.addBeveledBox(cx, doorHeight, cz, ts, 1.4, ts + 0.5, 0.25, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);

  // Upper wall lintel (y = doorHeight + 1.4 .. wallHeight - 1.8) + crown molding
  const lintelY = doorHeight + 1.4;
  const lintelH = Math.max(1.5, wallHeight - 1.8 - lintelY);
  mb.addBox(cx, lintelY, cz, ts, lintelH, ts, rgb(236, 226, 208), TexId.INTERIOR_WALL, 0.55);
  mb.addBeveledBox(cx, wallHeight - 1.8, cz, ts + 0.2, 1.8, ts + 0.45, 0.35, rgb(92, 60, 38), TexId.WOOD_GRAIN, 0.45);
}

/**
 * Builds the 3D recessed jambs, molded lintel architrave, and upper wall header
 * above an openable floor doorway tile (making room in the wall for the 24-unit-tall door).
 */
function addDoorwayFrameAndHeader3D(
  mb: MeshBuilder,
  col: number,
  row: number,
  ts: number,
  wallHeight = INDOOR_WALL_HEIGHT
): void {
  const cx = col * ts + ts * 0.5;
  const cz = row * ts + ts * 0.5;
  const doorHeight = 24.4;

  // Left & right carved oak jamb posts flanking the 13.6-wide doorway opening
  mb.addBox(col * ts + 0.9, 0, cz, 1.8, doorHeight, ts * 0.92, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);
  mb.addBox((col + 1) * ts - 0.9, 0, cz, 1.8, doorHeight, ts * 0.92, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);

  // Header architrave beam above the door leaf
  mb.addBeveledBox(cx, doorHeight, cz, ts, 1.4, ts + 0.5, 0.25, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);

  // Upper wallpapered wall header connecting cleanly to adjacent 2-tile-high walls
  const lintelY = doorHeight + 1.4;
  const lintelH = Math.max(1.5, wallHeight - 1.8 - lintelY);
  mb.addBox(cx, lintelY, cz, ts, lintelH, ts, rgb(236, 226, 208), TexId.INTERIOR_WALL, 0.55);
  mb.addBeveledBox(cx, wallHeight - 1.8, cz, ts + 0.2, 1.8, ts + 0.45, 0.35, rgb(92, 60, 38), TexId.WOOD_GRAIN, 0.45);
}

function addLockedDoubleDoor3D(mb: MeshBuilder, cx: number, cz: number, ts: number): void {
  const leafW = ts - 2.6;
  const leafH = 24.0;
  for (const offsetX of [-ts * 0.5 + 0.9, ts * 0.5 - 0.9]) {
    const lx = cx + offsetX;
    // Tall paneled door slab recessed cleanly inside the 2-tile doorway
    mb.addBeveledBox(lx, 0, cz, leafW, leafH, 3.8, 0.4, rgb(124, 68, 34), TexId.WOOD_GRAIN, 0.65);
    // Lower and upper raised door panels on both faces
    mb.addBox(lx, 2.4, cz, leafW * 0.68, 7.2, 4.4, rgb(146, 86, 46), TexId.WOOD_GRAIN, 0.3);
    mb.addBox(lx, 12.2, cz, leafW * 0.68, 9.2, 4.4, rgb(146, 86, 46), TexId.WOOD_GRAIN, 0.3);
  }
  // Brass double doorknobs on both sides
  for (const dz of [-2.4, 2.4]) {
    mb.addSphere(cx - 2.4, 11.2, cz + dz, 0.9, 0.9, 0.9, 6, 8, rgb(250, 214, 72), TexId.SOLID, 0.35);
    mb.addSphere(cx + 2.4, 11.2, cz + dz, 0.9, 0.9, 0.9, 6, 8, rgb(250, 214, 72), TexId.SOLID, 0.35);
  }
}

function addCeilingChandelier3D(mb: MeshBuilder, cx: number, cz: number, ceilingY = INDOOR_WALL_HEIGHT): void {
  // Brass ceiling canopy & chain rod
  mb.addCylinder(cx, ceilingY - 1.0, cz, 2.2, 1.0, 1.0, 10, rgb(212, 174, 74), TexId.SOLID, 0.35);
  mb.addCylinder(cx, ceilingY - 4.2, cz, 0.45, 0.45, 3.4, 8, rgb(196, 158, 66), TexId.SOLID, 0.3);
  // Warm radial ring & 4 glowing frosted globes
  mb.addTorus(cx, ceilingY - 4.3, cz, 3.6, 0.45, 12, 6, 'y', rgb(224, 182, 74), TexId.SOLID, 0.35);
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    const gx = cx + Math.cos(ang) * 3.6;
    const gz = cz + Math.sin(ang) * 3.6;
    mb.addSphere(gx, ceilingY - 4.9, gz, 1.1, 1.25, 1.1, 6, 8, rgb(255, 240, 168), TexId.SOLID, 0.25);
  }
}

function addIndoorCeiling3D(
  mb: MeshBuilder,
  map: TileMap,
  options?: {
    skipRect?: { minCol: number; maxCol: number; minRow: number; maxRow: number };
    chandeliers?: ReadonlyArray<readonly [number, number]>;
    ceilingY?: number;
  }
): void {
  const ts = map.tileSize;
  const ceilingY = options?.ceilingY ?? INDOOR_WALL_HEIGHT;
  const skip = options?.skipRect;

  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const tile = map.tiles[r][c];
      if (tile === TileType.VoidBlack || tile === TileType.InteriorWall) continue;
      if (skip && c >= skip.minCol && c <= skip.maxCol && r >= skip.minRow && r <= skip.maxRow) {
        continue;
      }

      // Downward-facing warm coffered plaster ceiling quad at y = ceilingY
      mb.addQuad(
        [c * ts, ceilingY, r * ts],
        [(c + 1) * ts, ceilingY, r * ts],
        [(c + 1) * ts, ceilingY, (r + 1) * ts],
        [c * ts, ceilingY, (r + 1) * ts],
        [0, -1, 0],
        rgb(240, 232, 218),
        TexId.SOLID,
        0
      );

      // Exposed oak timber rafters every 3 columns for rich Wind Waker HD ceiling depth
      if (c % 3 === 0) {
        const bx = c * ts + ts * 0.5;
        const bz = r * ts + ts * 0.5;
        mb.addBox(bx, ceilingY - 1.2, bz, 2.2, 1.2, ts, rgb(116, 74, 42), TexId.WOOD_GRAIN, 0.35);
      }
    }
  }

  // Sculpted stairwell ceiling trim around floor/ceiling openings
  if (skip) {
    const x0 = skip.minCol * ts;
    const x1 = (skip.maxCol + 1) * ts;
    const z0 = skip.minRow * ts;
    const z1 = (skip.maxRow + 1) * ts;
    const w = x1 - x0;
    const d = z1 - z0;
    mb.addBox((x0 + x1) * 0.5, ceilingY - 1.6, z0 + 0.6, w, 1.6, 1.2, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);
    mb.addBox((x0 + x1) * 0.5, ceilingY - 1.6, z1 - 0.6, w, 1.6, 1.2, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);
    mb.addBox(x0 + 0.6, ceilingY - 1.6, (z0 + z1) * 0.5, 1.2, 1.6, d, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);
    mb.addBox(x1 - 0.6, ceilingY - 1.6, (z0 + z1) * 0.5, 1.2, 1.6, d, rgb(104, 66, 36), TexId.WOOD_GRAIN, 0.45);
  }

  for (const [col, row] of options?.chandeliers ?? []) {
    addCeilingChandelier3D(mb, col * ts, row * ts, ceilingY);
  }
}

function addIndoorTilesAndWalls(
  mb: MeshBuilder,
  map: TileMap,
  options?: IndoorWallOptions
): void {
  const ts = map.tileSize;
  const wallHeight = options?.wallHeight ?? INDOOR_WALL_HEIGHT;
  const overrides = options?.wallOverrides;

  const openableSet = new Set<string>();
  for (const [dc, dr] of options?.openableDoorCoords ?? []) {
    openableSet.add(tileKey(dc, dr));
    addDoorwayFrameAndHeader3D(mb, dc, dr, ts, wallHeight);
  }

  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const tile = map.tiles[r][c];
      if (tile === TileType.VoidBlack) continue;

      const cx = c * ts + ts * 0.5;
      const cz = r * ts + ts * 0.5;

      if (tile === TileType.InteriorWall) {
        const override = overrides?.get(tileKey(c, r));
        if (override === 'door-left' || override === 'door-right') {
          addDoorWallLintelTile3D(mb, c, r, ts, wallHeight, override);
        } else if (
          override === 'window-south' ||
          override === 'window-north' ||
          override === 'window-north-transparent'
        ) {
          addWindowWallTile3D(mb, cx, cz, ts, wallHeight, override);
        } else {
          // Slight trim pullback if an openable door sits directly to the East or West so moldings don't overhang the door leaf
          const leftDoor = openableSet.has(tileKey(c - 1, r)) || overrides?.has(tileKey(c - 1, r));
          const rightDoor = openableSet.has(tileKey(c + 1, r)) || overrides?.has(tileKey(c + 1, r));
          const trimPullback = leftDoor || rightDoor ? 0.5 : 0;
          addStandardWallTile3D(mb, cx, cz, ts, wallHeight, trimPullback);
        }
      } else {
        const skipFloor = options?.skipFloorRect;
        if (
          skipFloor &&
          c >= skipFloor.minCol &&
          c <= skipFloor.maxCol &&
          r >= skipFloor.minRow &&
          r <= skipFloor.maxRow
        ) {
          continue;
        }
        let floorColor = rgb(198, 146, 92);
        let floorTex: number = TexId.WOOD_FLOOR;

        if (tile === TileType.StoneTileFloor) {
          floorColor = rgb(182, 170, 160);
          floorTex = TexId.STONE_FLOOR;
        } else if (tile === TileType.BathroomTileFloor) {
          floorColor = rgb(216, 238, 244);
          floorTex = TexId.BATHROOM_TILE;
        } else if (tile === TileType.StairsFloor) {
          floorColor = rgb(168, 116, 68);
          floorTex = TexId.WOOD_GRAIN;
        }

        mb.addQuad(
          [c * ts, 0, (r + 1) * ts],
          [(c + 1) * ts, 0, (r + 1) * ts],
          [(c + 1) * ts, 0, r * ts],
          [c * ts, 0, r * ts],
          [0, 1, 0],
          floorColor,
          floorTex,
          0
        );
      }
    }
  }
}

function addTuftedCouch3D(
  mb: MeshBuilder,
  cx: number,
  cz: number,
  w: number,
  d: number,
  facing: 'north' | 'south' | 'east',
  fabricColor: Color4,
  pillowColor: Color4
): void {
  mb.addShadowDisc(cx, 0, cz, w * 0.54, d * 0.54, 0.32);
  const darkFabric = darkenColor(fabricColor, 0.84);
  // Base frame & seat cushion
  mb.addBeveledBox(cx, 0.6, cz, w, 4.8, d, 0.9, fabricColor, TexId.FABRIC, 0.65);

  if (facing === 'east') {
    // Backrest on West side, rolled armrests on North & South
    mb.addBeveledBox(cx - w * 0.34, 4.8, cz, w * 0.32, 6.2, d, 1.0, darkFabric, TexId.FABRIC, 0.65);
    mb.addTorus(cx + 1, 5.5, cz - d * 0.44, 2.0, 1.2, 10, 8, 'x', darkFabric, TexId.FABRIC, 0.5);
    mb.addTorus(cx + 1, 5.5, cz + d * 0.44, 2.0, 1.2, 10, 8, 'x', darkFabric, TexId.FABRIC, 0.5);
    mb.addSphere(cx + 0.5, 6.2, cz - d * 0.25, 1.8, 2.2, 3.0, 8, 10, pillowColor, TexId.FABRIC, 0.45);
    mb.addSphere(cx + 0.5, 6.2, cz + d * 0.25, 1.8, 2.2, 3.0, 8, 10, pillowColor, TexId.FABRIC, 0.45);
  } else {
    // Backrest on North side, rolled armrests on West & East
    mb.addBeveledBox(cx, 4.8, cz - d * 0.34, w, 6.2, d * 0.32, 1.0, darkFabric, TexId.FABRIC, 0.65);
    mb.addTorus(cx - w * 0.44, 5.5, cz + 1, 2.0, 1.2, 10, 8, 'z', darkFabric, TexId.FABRIC, 0.5);
    mb.addTorus(cx + w * 0.44, 5.5, cz + 1, 2.0, 1.2, 10, 8, 'z', darkFabric, TexId.FABRIC, 0.5);
    mb.addSphere(cx - w * 0.26, 6.2, cz + 0.5, 3.2, 2.2, 1.8, 8, 10, pillowColor, TexId.FABRIC, 0.45);
    mb.addSphere(cx + w * 0.26, 6.2, cz + 0.5, 3.2, 2.2, 1.8, 8, 10, pillowColor, TexId.FABRIC, 0.45);
  }
}

// ============================================================================
// Static Level 2: Basement (32x28 TileMap)
// ============================================================================

export function buildBasementStaticMesh(map: TileMap): MeshBuilder {
  const mb = new MeshBuilder();
  const ts = map.tileSize; // 16

  const wallOverrides = new Map<string, WallOverrideKind>([
    // Locked North Door (cols 15..16, row 12)
    [tileKey(15, 12), 'door-left'],
    [tileKey(16, 12), 'door-right'],
    // Locked Front Door (cols 15..16, row 20)
    [tileKey(15, 20), 'door-left'],
    [tileKey(16, 20), 'door-right'],
    // Extra Big South Windows (row 20, cols 7..12)
    [tileKey(7, 20), 'window-south'],
    [tileKey(8, 20), 'window-south'],
    [tileKey(9, 20), 'window-south'],
    [tileKey(10, 20), 'window-south'],
    [tileKey(11, 20), 'window-south'],
    [tileKey(12, 20), 'window-south'],
  ]);

  addIndoorTilesAndWalls(mb, map, {
    wallHeight: INDOOR_WALL_HEIGHT,
    wallOverrides,
    openableDoorCoords: [[20, 12]], // Bathroom door
  });

  // Aesthetic Coffered Ceiling + Rafters + Chandeliers (leave stairwell at cols 18..21, rows 15..18 open)
  addIndoorCeiling3D(mb, map, {
    skipRect: { minCol: 18, maxCol: 21, minRow: 15, maxRow: 18 },
    chandeliers: [
      [9.5, 9.5],
      [9.5, 16.5],
      [16.0, 16.0],
      [20.5, 9.5],
    ],
  });

  // 1. Two-Tier Floor-to-Ceiling Library Bookshelf on north wall (cols 7..12, row 7 => z: 120)
  {
    const bx = 10 * ts;
    const bz = 7.55 * ts;
    // Plinth & lower bookshelf tier (1:1 unstretched TexId.BOOKSHELF)
    mb.addBox(bx, 0, bz, 6 * ts, 1.5, 13.5, rgb(88, 52, 26), TexId.WOOD_GRAIN, 0.45);
    mb.addBeveledBox(bx, 1.5, bz, 6 * ts, 12.5, 12.8, 0.5, rgb(128, 78, 40), TexId.BOOKSHELF, 0.65);
    // Waist molding ledge + brass rolling-ladder rail
    mb.addBeveledBox(bx, 14.0, bz, 6 * ts + 1.5, 1.2, 14.2, 0.35, rgb(98, 58, 28), TexId.WOOD_GRAIN, 0.45);
    // Upper bookshelf tier (second 1:1 unstretched TexId.BOOKSHELF) + ceiling crown
    mb.addBeveledBox(bx, 15.2, bz, 6 * ts, 12.2, 12.2, 0.5, rgb(128, 78, 40), TexId.BOOKSHELF, 0.65);
    mb.addBeveledBox(bx, 27.4, bz, 6 * ts + 2, 1.6, 14.0, 0.4, rgb(92, 54, 26), TexId.WOOD_GRAIN, 0.5);
    // Brass globe on mid shelf & rolling oak ladder on east end
    mb.addSphere(8.2 * ts, 16.8, bz + 4.5, 1.8, 1.8, 1.8, 8, 12, rgb(76, 158, 198), TexId.SOLID, 0.4);
    mb.addOrientedBox(12.2 * ts, 11.5, bz + 7.2, 1.1, 22, 1.2, 0, -0.14, rgb(156, 102, 54), TexId.WOOD_GRAIN, 0.4);
  }

  // 2. Stacked Birch & Oak Firewood Rack (col 12, rows 8..9 => x: 192..208, z: 128..160)
  mb.addBeveledBox(12.5 * ts, 0, 9 * ts, 14, 14.5, 2 * ts, 0.7, rgb(148, 92, 48), TexId.LOG_WALL, 0.65);
  for (let i = 0; i < 4; i++) {
    mb.addCylinder(12.5 * ts, 14.5, 8.3 * ts + i * 6.5, 2.2, 2.2, 2.5, 10, rgb(238, 234, 226), TexId.BIRCH_BARK, 0.4);
  }

  // 3. Tufted Library Couch on west wall (col 7, rows 9..11 => x: 112..128, z: 144..192)
  addTuftedCouch3D(mb, 7.55 * ts, 10.5 * ts, 15, 3 * ts - 2, 'east', rgb(172, 154, 134), rgb(186, 56, 56));

  // 4. Grand Floor-to-Ceiling Brick & Stone Fireplace (cols 11..12, rows 11..12)
  {
    const fx = 12 * ts;
    const fz = 12 * ts;
    mb.addBeveledBox(fx, 0, fz, 2 * ts + 1.5, 2.0, 2 * ts + 2.5, 0.4, rgb(118, 122, 132), TexId.STONE_FLOOR, 0.55);
    // Lower brick firebox tier (unstretched 1:1 brick tier)
    mb.addBox(fx, 2.0, fz, 2 * ts, 14.2, 2 * ts, rgb(186, 62, 48), TexId.BRICK_RED, 0.7);
    // Carved oak mantelpiece shelf + holiday pine garland & candles
    mb.addBeveledBox(fx, 16.2, fz, 2 * ts + 4, 2.2, 2 * ts + 4, 0.5, rgb(108, 68, 38), TexId.WOOD_GRAIN, 0.6);
    mb.addTorus(11 * ts - 0.5, 15.8, fz, 6.5, 1.2, 12, 8, 'x', rgb(36, 124, 54), TexId.PINE_FOLIAGE, 0.4);
    mb.addCylinder(11 * ts + 1, 18.4, fz - 10, 0.8, 0.8, 3.2, 8, rgb(248, 214, 92), TexId.SOLID, 0.3);
    mb.addCylinder(11 * ts + 1, 18.4, fz + 10, 0.8, 0.8, 3.2, 8, rgb(248, 214, 92), TexId.SOLID, 0.3);
    // Upper tapered brick chimney breast reaching the ceiling (unstretched 1:1 brick tier)
    mb.addBox(fx + 2, 18.4, fz, 2 * ts - 4, 11.8, 2 * ts - 4, rgb(186, 62, 48), TexId.BRICK_RED, 0.65);
    // Framed gilded overmantel mirror on west chimney face
    mb.addBox(11 * ts + 1.2, 20.6, fz, 1.8, 7.2, 14, rgb(212, 174, 72), TexId.SOLID, 0.35);
    mb.addBox(11 * ts + 0.9, 21.4, fz, 1.6, 5.6, 11.2, rgb(196, 224, 242), TexId.WINDOW_GLOW, 0.25);
    // Top stone crown corbel flush with y = 32 ceiling
    mb.addBeveledBox(fx + 2, 30.2, fz, 2 * ts - 2, 1.8, 2 * ts - 2, 0.35, rgb(118, 122, 132), TexId.STONE_FLOOR, 0.45);
    // Dark firebox & glowing ember logs
    mb.addBox(11 * ts - 0.4, 2.0, fz, 1.6, 10.5, 17, rgb(24, 18, 18), TexId.SOLID, 0);
    mb.addSphere(11.3 * ts, 2.8, fz, 2.5, 1.4, 6.5, 6, 10, rgb(255, 92, 28), TexId.SOLID, 0.3);
  }

  // 5. Basement Living Room Couch (cols 8..10, row 14 => x: 128..176, z: 224..240)
  addTuftedCouch3D(mb, 9.5 * ts, 14.5 * ts, 3 * ts - 2, 15, 'south', rgb(172, 154, 134), rgb(64, 128, 178));

  // 6. Pedestal Chess Board Table & Chairs (cols 8..9, row 17 => x: 144, z: 280)
  {
    const cx = 9 * ts;
    const cz = 17.5 * ts;
    mb.addShadowDisc(cx, 0, cz, 14, 11, 0.32);
    mb.addCylinder(cx, 0, cz, 5.5, 2.2, 1.6, 12, rgb(112, 68, 36), TexId.WOOD_GRAIN, 0.5);
    mb.addCylinder(cx, 1.6, cz, 2.2, 2.2, 4.4, 12, rgb(112, 68, 36), TexId.WOOD_GRAIN, 0.5);
    mb.addBeveledBox(cx, 5.8, cz, 22, 1.2, 16, 0.4, rgb(134, 82, 44), TexId.WOOD_GRAIN, 0.65);
    mb.addBox(cx, 6.9, cz, 13.5, 0.5, 13.5, rgb(245, 236, 212), TexId.CHESSBOARD, 0.35);
    // Miniature sculpted gold & silver chess pieces
    for (let p = -4; p <= 4; p += 2.6) {
      mb.addCone(cx + p, 7.4, cz - 4.2, 0.85, 2.6, 8, rgb(248, 216, 92), TexId.SOLID, 0.3);
      mb.addCone(cx + p, 7.4, cz + 4.2, 0.85, 2.6, 8, rgb(76, 82, 96), TexId.SOLID, 0.3);
    }
  }

  // 7. Hallway Coat Rack with Wall Hook Rail, Coat Hangers, Tailored Winter Coats & Freestanding Coat Tree (col 14, rows 17..18)
  {
    const rackX = 14.08 * ts;
    const rackZ = 18.0 * ts;
    const wood = rgb(118, 72, 38);
    const chrome = rgb(214, 222, 234);

    // Wall-mounted oak backboard & upper hat shelf along west wall
    mb.addBeveledBox(rackX + 0.5, 19.2, rackZ, 1.4, 2.4, 26, 0.25, wood, TexId.WOOD_GRAIN, 0.5);
    mb.addBeveledBox(rackX + 2.2, 21.6, rackZ, 4.6, 0.9, 26, 0.25, wood, TexId.WOOD_GRAIN, 0.45);
    // Wrought-iron brackets under the shelf
    for (const bz of [rackZ - 9.5, rackZ + 9.5]) {
      mb.addOrientedBox(rackX + 1.8, 20.1, bz, 3.2, 0.7, 0.7, 0, -0.7, rgb(48, 52, 62), TexId.SOLID, 0.3);
    }

    // Triangular coat hangers + brass peg hooks + hanging winter coats along the rail
    const coatConfigs: Array<{ z: number; coat: Color4 | null; accent: Color4 }> = [
      { z: rackZ - 7.8, coat: rgb(182, 44, 46), accent: rgb(238, 232, 222) },
      { z: rackZ, coat: rgb(42, 68, 114), accent: rgb(196, 172, 118) },
      { z: rackZ + 7.8, coat: null, accent: wood }, // empty visible triangular hanger
    ];

    for (const cfg of coatConfigs) {
      // Wall peg & hanger wire hook
      mb.addCylinder(rackX + 1.4, 19.6, cfg.z, 0.35, 0.45, 1.4, 8, chrome, TexId.SOLID, 0.3);
      mb.addTorus(rackX + 2.4, 18.9, cfg.z, 0.65, 0.18, 8, 6, 'x', chrome, TexId.SOLID, 0.25);

      // Triangular wooden coat hanger frame (top shoulder bars + horizontal trouser bar)
      mb.addOrientedBox(rackX + 2.5, 17.5, cfg.z - 1.6, 0.55, 0.65, 3.8, Math.PI * 0.5, 0.42, wood, TexId.WOOD_GRAIN, 0.35);
      mb.addOrientedBox(rackX + 2.5, 17.5, cfg.z + 1.6, 0.55, 0.65, 3.8, Math.PI * 0.5, -0.42, wood, TexId.WOOD_GRAIN, 0.35);
      mb.addBox(rackX + 2.5, 16.5, cfg.z, 0.5, 0.5, 6.2, wood, TexId.WOOD_GRAIN, 0.3);

      if (cfg.coat) {
        // Hung coat torso with flared skirt, sleeves & contrasting collar lapels
        mb.addBeveledBox(rackX + 2.7, 8.2, cfg.z, 2.2, 9.2, 5.2, 0.45, cfg.coat, TexId.FABRIC, 0.55);
        mb.addOrientedBox(rackX + 2.7, 12.2, cfg.z - 2.6, 1.5, 6.8, 1.5, Math.PI * 0.5, 0.14, cfg.coat, TexId.FABRIC, 0.45);
        mb.addOrientedBox(rackX + 2.7, 12.2, cfg.z + 2.6, 1.5, 6.8, 1.5, Math.PI * 0.5, -0.14, cfg.coat, TexId.FABRIC, 0.45);
        mb.addBox(rackX + 3.7, 15.6, cfg.z, 0.5, 2.2, 2.4, cfg.accent, TexId.FABRIC, 0.3);
      }
    }

    // Classic freestanding bentwood coat tree stand at north end of tile with tripod base, hooks & hat
    const tx = 14.55 * ts;
    const tz = 17.28 * ts;
    mb.addShadowDisc(tx, 0, tz, 4.2, 4.2, 0.26);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      mb.addOrientedBox(
        tx + Math.cos(a) * 1.9,
        1.2,
        tz + Math.sin(a) * 1.9,
        3.6,
        1.1,
        0.95,
        a,
        0.48,
        wood,
        TexId.WOOD_GRAIN,
        0.45
      );
      // Curved upper branch hooks
      mb.addOrientedBox(
        tx + Math.cos(a) * 1.5,
        17.8,
        tz + Math.sin(a) * 1.5,
        2.8,
        0.65,
        0.65,
        a,
        -0.55,
        wood,
        TexId.WOOD_GRAIN,
        0.35
      );
      mb.addSphere(tx + Math.cos(a) * 2.7, 18.8, tz + Math.sin(a) * 2.7, 0.45, 0.45, 0.45, 6, 6, chrome, TexId.SOLID, 0.25);
    }
    mb.addCylinder(tx, 1.2, tz, 0.95, 0.65, 17.8, 10, wood, TexId.WOOD_GRAIN, 0.55);
    // Dark wool fedora hat perched on top finial of coat stand
    mb.addCylinder(tx, 19.2, tz, 3.1, 3.1, 0.45, 12, rgb(38, 40, 48), TexId.FABRIC, 0.45);
    mb.addCylinder(tx, 19.65, tz, 1.95, 1.7, 2.1, 12, rgb(44, 46, 56), TexId.FABRIC, 0.45);
    mb.addCylinder(tx, 19.75, tz, 2.02, 2.02, 0.5, 12, rgb(168, 42, 44), TexId.SOLID, 0.25);
  }

  // 8. Locked Double Doors recessed cleanly inside wall openings (cols 15..16, row 12 & row 20)
  addLockedDoubleDoor3D(mb, 16 * ts, 12.5 * ts, ts);
  addLockedDoubleDoor3D(mb, 16 * ts, 20.5 * ts, ts);

  // 9. High-Fi Basement Staircase rising up to the ceiling stairwell opening (cols 18..21, rows 15..18)
  for (let s = 0; s < 12; s++) {
    const sx = 18 * ts + s * 5.2 + 2.6;
    const sh = (s + 1) * 1.95;
    mb.addBeveledBox(sx, 0, 17 * ts, 5.4, sh, 4 * ts - 4, 0.3, rgb(168, 116, 68), TexId.WOOD_GRAIN, 0.5);
    mb.addCylinder(sx, sh, 18.8 * ts, 0.55, 0.45, 6.2, 8, rgb(242, 238, 230), TexId.SOLID, 0.3);
  }
  mb.addOrientedBox(20 * ts, 18.2, 18.8 * ts, 4.1 * ts, 1.3, 1.5, 0, 0.34, rgb(112, 68, 36), TexId.WOOD_GRAIN, 0.5);

  // 10. High-Fi Bathroom Vanity Sink, Beveled Wall Mirror, Light Bar & Porcelain Toilet (cols 18..22, rows 7..12)
  mb.addBeveledBox(19.5 * ts, 0, 10 * ts, 13.5, 7.8, 23, 0.6, rgb(242, 246, 252), TexId.SOLID, 0.65);
  mb.addTorus(19.6 * ts, 8.0, 10 * ts, 3.8, 0.9, 12, 8, 'y', rgb(252, 254, 255), TexId.SOLID, 0.4);
  mb.addCylinder(19.2 * ts, 8.0, 10 * ts, 0.5, 0.5, 2.6, 8, rgb(210, 220, 232), TexId.SOLID, 0.3);
  // Wall mirror & sconce bar mounted cleanly on the 2-tile-high West bathroom wall
  mb.addBeveledBox(19.04 * ts, 11.2, 10 * ts, 1.4, 11.2, 17, 0.3, rgb(112, 72, 40), TexId.WOOD_GRAIN, 0.4);
  mb.addBox(19.08 * ts, 12.2, 10 * ts, 1.4, 9.2, 14.5, rgb(206, 232, 248), TexId.WINDOW_GLOW, 0.25);
  mb.addBox(19.12 * ts, 23.4, 10 * ts, 2.0, 1.4, 12, rgb(255, 236, 152), TexId.SOLID, 0.3);
  // Sculpted Porcelain Toilet (col 21, row 9)
  mb.addBeveledBox(21.75 * ts, 4.5, 9.5 * ts, 5.2, 6.8, 9.5, 0.7, rgb(246, 250, 255), TexId.SOLID, 0.65);
  mb.addCylinder(21.3 * ts, 0, 9.5 * ts, 3.6, 4.8, 5.2, 12, rgb(246, 250, 255), TexId.SOLID, 0.65);
  mb.addTorus(21.3 * ts, 5.3, 9.5 * ts, 3.8, 1.0, 12, 8, 'y', rgb(252, 254, 255), TexId.SOLID, 0.45);

  return mb;
}

// ============================================================================
// Static Level 3: Upstairs (32x28 TileMap)
// ============================================================================

export function buildUpstairsStaticMesh(map: TileMap): MeshBuilder {
  const mb = new MeshBuilder();
  const ts = map.tileSize; // 16

  const wallOverrides = new Map<string, WallOverrideKind>([
    // Kitchen north windows (row 4, cols 9..14) — transparent between mullions so Rosanna Santa cutscene is visible outside
    [tileKey(9, 4), 'window-north-transparent'],
    [tileKey(10, 4), 'window-north-transparent'],
    [tileKey(11, 4), 'window-north-transparent'],
    [tileKey(12, 4), 'window-north-transparent'],
    [tileKey(13, 4), 'window-north-transparent'],
    [tileKey(14, 4), 'window-north-transparent'],
    // Bedroom north window (row 4, cols 24..25)
    [tileKey(24, 4), 'window-north'],
    [tileKey(25, 4), 'window-north'],
    // Office south window (row 18, cols 21..23)
    [tileKey(21, 18), 'window-south'],
    [tileKey(22, 18), 'window-south'],
    [tileKey(23, 18), 'window-south'],
    // Table room south windows (row 21, cols 10..13)
    [tileKey(10, 21), 'window-south'],
    [tileKey(11, 21), 'window-south'],
    [tileKey(12, 21), 'window-south'],
    [tileKey(13, 21), 'window-south'],
  ]);

  addIndoorTilesAndWalls(mb, map, {
    wallHeight: INDOOR_WALL_HEIGHT,
    wallOverrides,
    openableDoorCoords: [
      [18, 10], // Shower door
      [24, 10], // Bedroom door
      [21, 13], // Office door
      [11, 15], // Table Room door
    ],
    // Leave stairwell steps (cols 15..18, rows 14..17) open below y=0 so descending stairs are clearly visible
    skipFloorRect: { minCol: 15, maxCol: 18, minRow: 14, maxRow: 17 },
  });

  // Aesthetic Coffered Ceiling + Rafters + Chandeliers (leave stairwell at cols 15..18, rows 14..18 open)
  addIndoorCeiling3D(mb, map, {
    skipRect: { minCol: 15, maxCol: 18, minRow: 14, maxRow: 18 },
    chandeliers: [
      [5.0, 7.5],
      [11.5, 7.0],
      [5.5, 14.0],
      [12.0, 18.0],
      [25.0, 7.0],
      [22.0, 16.5],
    ],
  });

  // Snowy Moonlit Exterior Terrace outside Kitchen North Windows (cols 7..16, rows 1..3)
  // so looking out the kitchen windows reveals a snowy winter night for the Rosanna Santa cutscene
  for (let c = 7; c <= 16; c++) {
    mb.addQuad(
      [c * ts, -1, 3.8 * ts],
      [(c + 1) * ts, -1, 3.8 * ts],
      [(c + 1) * ts, -1, 1.2 * ts],
      [c * ts, -1, 1.2 * ts],
      [0, 1, 0],
      rgb(228, 240, 252),
      TexId.SNOW,
      0
    );
  }
  mb.addCone(8.2 * ts, -1, 1.8 * ts, 7.5, 22, 10, rgb(32, 82, 50), TexId.PINE_FOLIAGE, 0.55);
  mb.addCone(14.5 * ts, -1, 1.8 * ts, 8.0, 24, 10, rgb(36, 90, 54), TexId.PINE_FOLIAGE, 0.55);

  // 1. Tall Dining Room China Hutch Cupboard (col 2, rows 6..7 => x: 40, z: 112)
  mb.addBeveledBox(2.5 * ts, 0, 7 * ts, 14.5, 8.8, 2 * ts, 0.6, rgb(134, 82, 42), TexId.WOOD_GRAIN, 0.65);
  mb.addBeveledBox(2.45 * ts, 8.8, 7 * ts, 13.5, 1.2, 2 * ts + 0.5, 0.3, rgb(112, 68, 36), TexId.WOOD_GRAIN, 0.45);
  mb.addBeveledBox(2.35 * ts, 10.0, 7 * ts, 10.5, 14.5, 2 * ts - 2, 0.5, rgb(148, 94, 50), TexId.BOOKSHELF, 0.65);
  mb.addBeveledBox(2.35 * ts, 24.5, 7 * ts, 11.8, 1.8, 2 * ts - 0.5, 0.4, rgb(104, 62, 32), TexId.WOOD_GRAIN, 0.5);

  // 2. Festive Long Dining Table with Candelabrum, Plates, Goblets & 6 High-Back Chairs (cols 4..5, rows 6..9)
  {
    const tx = 5 * ts; // 80
    const tz = 8 * ts; // 128
    mb.addShadowDisc(tx, 0, tz, 17, 32, 0.34);
    mb.addBeveledBox(tx, 0, tz, 2 * ts - 2, 6.8, 4 * ts - 4, 0.7, rgb(148, 92, 48), TexId.WOOD_GRAIN, 0.75);
    // White linen table runner & golden 3-branch candelabrum
    mb.addBeveledBox(tx, 6.7, tz, 12, 0.5, 4 * ts - 8, 0.2, rgb(250, 246, 242), TexId.FABRIC, 0.35);
    mb.addCylinder(tx, 7.2, tz, 2.0, 0.7, 4.5, 10, rgb(250, 214, 78), TexId.SOLID, 0.4);
    mb.addSphere(tx, 12.2, tz, 0.7, 1.3, 0.7, 6, 8, rgb(255, 200, 64), TexId.SOLID, 0.2);

    // 6 Porcelain dinner plates & High-back chairs flanking the table
    for (const rowOff of [-18, 0, 18]) {
      mb.addCylinder(tx - 8, 7.1, tz + rowOff, 3.2, 3.4, 0.5, 12, rgb(250, 252, 255), TexId.SOLID, 0.3);
      mb.addCylinder(tx + 8, 7.1, tz + rowOff, 3.2, 3.4, 0.5, 12, rgb(250, 252, 255), TexId.SOLID, 0.3);
      mb.addBeveledBox(tx - 15.5, 0, tz + rowOff, 4.5, 4.5, 6.5, 0.4, rgb(124, 74, 38), TexId.WOOD_GRAIN, 0.5);
      mb.addBeveledBox(tx - 17.2, 4.5, tz + rowOff, 1.4, 5.5, 6.5, 0.3, rgb(112, 66, 32), TexId.WOOD_GRAIN, 0.5);
      mb.addBeveledBox(tx + 15.5, 0, tz + rowOff, 4.5, 4.5, 6.5, 0.4, rgb(124, 74, 38), TexId.WOOD_GRAIN, 0.5);
      mb.addBeveledBox(tx + 17.2, 4.5, tz + rowOff, 1.4, 5.5, 6.5, 0.3, rgb(112, 66, 32), TexId.WOOD_GRAIN, 0.5);
    }
  }

  // 3. Kitchen Island, Upper Kitchen Cabinets, Stainless Range Hood & Candlelit Altar
  {
    const ix = 11 * ts;
    const iz = 7 * ts;
    mb.addShadowDisc(ix, 0, iz, 17, 17, 0.32);
    mb.addBeveledBox(ix, 0, iz, 2 * ts - 2, 8.0, 2 * ts - 2, 0.5, rgb(236, 232, 224), TexId.SOLID, 0.7);
    mb.addBeveledBox(ix, 7.8, iz, 2 * ts + 1, 1.6, 2 * ts + 1, 0.5, rgb(168, 114, 66), TexId.WOOD_GRAIN, 0.6);
    mb.addCylinder(ix, 9.4, iz, 3.2, 4.6, 1.8, 12, rgb(248, 250, 255), TexId.SOLID, 0.4);
    mb.addSphere(ix - 1.2, 11.2, iz, 1.5, 1.4, 1.5, 6, 8, rgb(220, 42, 42), TexId.SOLID, 0.3);
    mb.addSphere(ix + 1.4, 11.2, iz + 0.8, 1.4, 1.4, 1.4, 6, 8, rgb(245, 148, 38), TexId.SOLID, 0.3);

    // East wall Stove & Sink Counter (col 15, rows 5..8)
    mb.addBeveledBox(15.5 * ts, 0, 7 * ts, 14.5, 8.6, 4 * ts - 2, 0.6, rgb(228, 232, 238), TexId.SOLID, 0.7);
    mb.addBox(15.5 * ts, 8.6, 6 * ts, 11, 0.4, 18, rgb(32, 36, 44), TexId.SOLID, 0.35);
    mb.addTorus(15.5 * ts, 8.9, 5.7 * ts, 2.2, 0.35, 10, 6, 'y', rgb(238, 64, 48), TexId.SOLID, 0.2);
    mb.addTorus(15.5 * ts, 8.9, 6.4 * ts, 2.2, 0.35, 10, 6, 'y', rgb(238, 64, 48), TexId.SOLID, 0.2);
    mb.addCylinder(15.8 * ts, 8.6, 8 * ts, 0.5, 0.5, 3.2, 8, rgb(210, 220, 232), TexId.SOLID, 0.3);

    // Kitchen Tile Backsplash + Stainless Range Hood over Stove + Upper Wall Cabinets
    mb.addBox(15.92 * ts, 8.8, 7 * ts, 1.4, 9.2, 4 * ts - 2, rgb(228, 240, 246), TexId.BATHROOM_TILE, 0.3);
    mb.addBeveledBox(15.5 * ts, 18.2, 6 * ts, 12.5, 2.8, 18, 0.4, rgb(186, 196, 212), TexId.SOLID, 0.45);
    mb.addBox(15.7 * ts, 21.0, 6 * ts, 7.2, 11.0, 8.5, rgb(174, 184, 200), TexId.SOLID, 0.4);
    mb.addBeveledBox(15.65 * ts, 18.2, 8 * ts, 10.5, 10.8, 2 * ts - 2, 0.4, rgb(164, 112, 66), TexId.WOOD_GRAIN, 0.55);

    // Kitchen Altar / Shrine (cols 10..11, row 10)
    mb.addBeveledBox(11 * ts, 0, 10.5 * ts, 2 * ts - 2, 9.5, 14, 0.6, rgb(142, 42, 46), TexId.WOOD_GRAIN, 0.7);
    mb.addBeveledBox(11 * ts, 9.4, 10.3 * ts, 18, 2.2, 8, 0.4, rgb(242, 198, 72), TexId.SOLID, 0.5);
    mb.addCylinder(10.4 * ts, 9.5, 10.6 * ts, 1.1, 1.1, 4.0, 10, rgb(255, 232, 128), TexId.SOLID, 0.35);
    mb.addCylinder(11.6 * ts, 9.5, 10.6 * ts, 1.1, 1.1, 4.0, 10, rgb(255, 232, 128), TexId.SOLID, 0.35);
  }

  // 4. Living Room Designer Patchwork Couch (cols 4..6, row 11) & Wingback Armchairs
  addTuftedCouch3D(mb, 5.5 * ts, 11.5 * ts, 3 * ts - 2, 15, 'south', rgb(214, 84, 58), rgb(248, 206, 68));
  mb.addShadowDisc(2.5 * ts, 0, 12.5 * ts, 8.5, 8.5, 0.3);
  mb.addBeveledBox(2.5 * ts, 0.5, 12.5 * ts, 14.5, 5.2, 14.5, 0.9, rgb(236, 178, 52), TexId.FABRIC, 0.65);
  mb.addBeveledBox(2.1 * ts, 5.2, 12.5 * ts, 4.2, 5.8, 14.5, 0.8, rgb(214, 156, 38), TexId.FABRIC, 0.65);

  mb.addShadowDisc(7.5 * ts, 0, 13.5 * ts, 8.5, 8.5, 0.3);
  mb.addBeveledBox(7.5 * ts, 0.5, 13.5 * ts, 14.5, 5.2, 14.5, 0.9, rgb(68, 156, 124), TexId.FABRIC, 0.65);
  mb.addBeveledBox(7.9 * ts, 5.2, 13.5 * ts, 4.2, 5.8, 14.5, 0.8, rgb(52, 134, 104), TexId.FABRIC, 0.65);

  // 5. THE GRAND CHRISTMAS TREE! (cols 2..3, rows 14..16 => x: 48, z: 248)
  {
    const tx = 3 * ts; // 48
    const tz = 15.5 * ts; // 248
    mb.addShadowDisc(tx, 0, tz, 16, 16, 0.38);
    mb.addCylinder(tx, 0.2, tz, 14.2, 13.5, 0.9, 16, rgb(198, 36, 42), TexId.FABRIC, 0.4);
    mb.addTorus(tx, 0.6, tz, 13.8, 0.6, 16, 8, 'y', rgb(250, 212, 72), TexId.SOLID, 0.3);
    mb.addCylinder(tx, 0.9, tz, 3.0, 2.0, 8, 12, rgb(96, 58, 32), TexId.WOOD_GRAIN, 0.6);
    // 5 lush evergreen bough tiers proportioned gracefully under the y = 32 ceiling
    mb.addCone(tx, 5.0, tz, 13.5, 9.2, 16, rgb(24, 104, 46), TexId.PINE_FOLIAGE, 0.75);
    mb.addCone(tx, 10.0, tz, 11.4, 8.5, 16, rgb(32, 122, 54), TexId.PINE_FOLIAGE, 0.75);
    mb.addCone(tx, 14.6, tz, 9.0, 7.8, 16, rgb(40, 138, 64), TexId.PINE_FOLIAGE, 0.75);
    mb.addCone(tx, 19.0, tz, 6.6, 7.0, 16, rgb(48, 154, 72), TexId.PINE_FOLIAGE, 0.75);
    mb.addCone(tx, 22.8, tz, 4.2, 5.8, 16, rgb(58, 168, 82), TexId.PINE_FOLIAGE, 0.75);

    const ornamentPalette: Color4[] = [
      rgb(242, 42, 48),
      rgb(255, 216, 64),
      rgb(56, 156, 250),
      rgb(240, 88, 218),
    ];
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 * 2.0;
      const tNorm = i / 18;
      const rad = 11.8 * (1 - tNorm * 0.68);
      const oy = 6.5 + tNorm * 16.5;
      mb.addSphere(
        tx + Math.cos(ang) * rad,
        oy,
        tz + Math.sin(ang) * rad,
        1.5,
        1.5,
        1.5,
        8,
        10,
        ornamentPalette[i % ornamentPalette.length],
        TexId.SOLID,
        0.38
      );
    }

    // Glowing Golden Star Topper + Halo Ring beneath the ceiling
    mb.addSphere(tx, 28.8, tz, 2.6, 2.6, 1.4, 8, 12, rgb(255, 236, 82), TexId.SOLID, 0.55);
    mb.addOrientedBox(tx, 28.8, tz, 5.2, 5.2, 1.4, 0, Math.PI * 0.25, rgb(255, 242, 104), TexId.SOLID, 0.5);
    mb.addTorus(tx, 28.8, tz, 3.6, 0.4, 14, 6, 'z', rgb(255, 245, 140), TexId.SOLID, 0.25);

    // Pile of Festive Presents with 3D Bow Loops under the Tree
    for (const [gx, gz, gw, gh, gc] of [
      [tx - 8.5, tz + 8.0, 6.2, 5.2, rgb(222, 42, 48)],
      [tx + 7.5, tz + 8.2, 5.6, 4.6, rgb(48, 128, 218)],
      [tx - 1.5, tz + 10.2, 5.0, 4.2, rgb(52, 168, 86)],
      [tx + 8.8, tz - 5.5, 5.2, 4.4, rgb(168, 64, 196)],
    ] as const) {
      mb.addBeveledBox(gx, 0.8, gz, gw, gh, gw, 0.5, gc, TexId.GIFT_WRAP, 0.55);
      mb.addTorus(gx, 0.8 + gh + 0.5, gz, 1.3, 0.45, 8, 6, 'x', rgb(255, 218, 72), TexId.SOLID, 0.35);
      mb.addTorus(gx, 0.8 + gh + 0.5, gz, 1.3, 0.45, 8, 6, 'z', rgb(255, 218, 72), TexId.SOLID, 0.35);
    }
  }

  // 6. Table Room Second Table (cols 11..12, rows 17..18 => x: 192, z: 288)
  mb.addShadowDisc(12 * ts, 0, 18 * ts, 16, 16, 0.32);
  mb.addBeveledBox(12 * ts, 0, 18 * ts, 2 * ts - 2, 6.8, 2 * ts - 2, 0.6, rgb(148, 92, 48), TexId.WOOD_GRAIN, 0.7);

  // 7. Shower Sink, Beveled Wall Mirror, Light Bar & Porcelain Toilet (col 17, rows 7..8 & col 19, row 8)
  mb.addBeveledBox(17.5 * ts, 0, 8 * ts, 13.5, 7.8, 22, 0.6, rgb(242, 246, 252), TexId.SOLID, 0.65);
  mb.addBeveledBox(17.04 * ts, 11.2, 8 * ts, 1.4, 11.2, 17, 0.3, rgb(112, 72, 40), TexId.WOOD_GRAIN, 0.4);
  mb.addBox(17.08 * ts, 12.2, 8 * ts, 1.4, 9.2, 14.5, rgb(206, 232, 248), TexId.WINDOW_GLOW, 0.25);
  mb.addBox(17.12 * ts, 23.4, 8 * ts, 2.0, 1.4, 12, rgb(255, 236, 152), TexId.SOLID, 0.3);
  mb.addCylinder(19.5 * ts, 0, 8.5 * ts, 3.8, 4.8, 5.4, 12, rgb(246, 250, 255), TexId.SOLID, 0.65);
  mb.addTorus(19.5 * ts, 5.4, 8.5 * ts, 3.8, 1.0, 12, 8, 'y', rgb(252, 254, 255), TexId.SOLID, 0.45);

  // 8. Upstairs Staircase Descending to Basement (cols 15..18, rows 14..17) + Guardrails
  {
    const stairX0 = 15 * ts;
    const stairX1 = 19 * ts;
    const stairCx = (stairX0 + stairX1) * 0.5;
    const stairW = stairX1 - stairX0;
    const stairZ0 = 14 * ts;
    const stairZ1 = 18 * ts;
    const numSteps = 12;
    const stepD = (stairZ1 - stairZ0) / numSteps;
    const stepDrop = 1.65;
    const stairWellDepth = numSteps * stepDrop + 4;

    // Recessed stairwell lining walls descending below y=0 so there is no gap into the void
    mb.addBox(stairX0 + 0.4, -stairWellDepth, (stairZ0 + stairZ1) * 0.5, 0.8, stairWellDepth, stairZ1 - stairZ0, rgb(228, 220, 206), TexId.WOOD_GRAIN, 0.4);
    mb.addBox(stairX1 - 0.4, -stairWellDepth, (stairZ0 + stairZ1) * 0.5, 0.8, stairWellDepth, stairZ1 - stairZ0, rgb(228, 220, 206), TexId.WOOD_GRAIN, 0.4);
    mb.addBox(stairCx, -stairWellDepth, stairZ1 - 0.4, stairW, stairWellDepth, 0.8, rgb(186, 178, 166), TexId.INTERIOR_WALL, 0.4);

    // 12 Descending Wooden Steps + Risers (top at north z = 14*ts, descending southward to z = 18*ts)
    for (let s = 0; s < numSteps; s++) {
      const treadTopY = -(s + 1) * stepDrop;
      const treadCz = stairZ0 + (s + 0.5) * stepD;
      // Cream riser + projecting warm oak stair tread
      mb.addBox(stairCx, -stairWellDepth, treadCz, stairW - 1.2, Math.max(0.5, treadTopY + stairWellDepth - 0.8), stepD + 0.2, rgb(236, 228, 214), TexId.WOOD_GRAIN, 0.35);
      mb.addBeveledBox(stairCx, treadTopY - 1.0, treadCz, stairW - 1.0, 1.0, stepD + 0.6, 0.2, rgb(168, 116, 68), TexId.WOOD_GRAIN, 0.5);
    }

    // Sloped Stairwell Handrails & Newel Posts on West & East edges leading downward
    for (const sideX of [15.2 * ts, 18.8 * ts]) {
      mb.addCylinder(sideX, 0, stairZ0, 0.75, 0.75, 7.6, 8, rgb(112, 68, 36), TexId.WOOD_GRAIN, 0.4);
      mb.addSphere(sideX, 7.8, stairZ0, 0.95, 0.95, 0.95, 6, 8, rgb(134, 82, 44), TexId.WOOD_GRAIN, 0.3);
      for (let p = 1; p <= 5; p++) {
        const pt = p / 5;
        const postZ = stairZ0 + pt * (stairZ1 - stairZ0 - 4);
        const stepY = -pt * numSteps * stepDrop;
        mb.addCylinder(sideX, stepY, postZ, 0.45, 0.45, 7.0, 8, rgb(242, 238, 230), TexId.SOLID, 0.3);
      }
      mb.addOrientedBox(
        sideX,
        7.0 - (numSteps * stepDrop) * 0.5,
        (stairZ0 + stairZ1 - 4) * 0.5,
        3.95 * ts,
        1.0,
        1.2,
        Math.PI * 0.5,
        -0.31,
        rgb(134, 82, 44),
        TexId.WOOD_GRAIN,
        0.45
      );
    }
  }

  // 9. Bedroom Carved Sleigh Double Bed with Duvet & Pillows (cols 26..27, rows 6..7 => x: 432, z: 112)
  {
    const bx = 27 * ts;
    const bz = 7 * ts;
    mb.addShadowDisc(bx, 0, bz, 17, 17, 0.34);
    mb.addBeveledBox(bx, 0, bz, 2 * ts - 2, 4.8, 2 * ts - 2, 0.6, rgb(128, 78, 38), TexId.WOOD_GRAIN, 0.7);
    mb.addBeveledBox(bx, 4.8, bz - ts + 2.5, 2 * ts - 2, 8.4, 3.2, 0.6, rgb(112, 66, 32), TexId.WOOD_GRAIN, 0.65);
    mb.addBeveledBox(bx, 4.6, bz, 2 * ts - 4, 2.0, 2 * ts - 4, 0.6, rgb(248, 248, 252), TexId.FABRIC, 0.45);
    mb.addBeveledBox(bx, 5.2, bz + 2.5, 2 * ts - 3.5, 2.2, 2 * ts - 9, 0.7, rgb(198, 48, 56), TexId.FABRIC, 0.55);
    mb.addSphere(bx - 6.5, 7.2, bz - 8.5, 5.2, 1.8, 3.2, 8, 10, rgb(252, 252, 255), TexId.FABRIC, 0.45);
    mb.addSphere(bx + 6.5, 7.2, bz - 8.5, 5.2, 1.8, 3.2, 8, 10, rgb(252, 252, 255), TexId.FABRIC, 0.45);
  }

  // 10. Office Executive Desk, Ultrawide Monitor, Keyboard & Ergonomic Swivel Chair (cols 20..22, rows 15..17)
  {
    const ox = 21.5 * ts;
    const oz = 16.5 * ts;
    mb.addShadowDisc(ox, 0, oz, 22, 16, 0.32);
    mb.addBeveledBox(ox, 0, oz, 3 * ts - 4, 6.8, 2 * ts - 2, 0.6, rgb(142, 90, 48), TexId.WOOD_GRAIN, 0.7);
    mb.addCylinder(ox, 6.8, oz - 4, 2.6, 0.8, 2.2, 10, rgb(52, 58, 70), TexId.SOLID, 0.4);
    mb.addBeveledBox(ox, 8.6, oz - 4, 14, 7.5, 1.8, 0.35, rgb(36, 40, 50), TexId.WINDOW_GLOW, 0.55);
    mb.addBeveledBox(ox, 6.8, oz + 3, 9, 0.6, 3.6, 0.2, rgb(48, 54, 66), TexId.SOLID, 0.35);
    mb.addCylinder(ox, 0, oz + 14, 4.2, 1.0, 4.2, 10, rgb(44, 48, 58), TexId.SOLID, 0.45);
    mb.addBeveledBox(ox, 4.0, oz + 14, 8.5, 1.6, 8.5, 0.5, rgb(58, 66, 82), TexId.FABRIC, 0.55);
    mb.addBeveledBox(ox, 5.4, oz + 17.5, 8.0, 6.5, 2.0, 0.5, rgb(52, 60, 76), TexId.FABRIC, 0.55);
  }

  return mb;
}

// ============================================================================
// Static Level 4: People Showcase Gallery
// ============================================================================

export function buildPeopleStaticMesh(map: TileMap): MeshBuilder {
  const mb = new MeshBuilder();
  addIndoorTilesAndWalls(mb, map, { wallHeight: INDOOR_WALL_HEIGHT });
  addIndoorCeiling3D(mb, map, {
    chandeliers: [
      [10, 13],
      [20, 13],
    ],
  });
  return mb;
}

const staticMeshCache = new Map<LevelId, MeshData>();

export function getStaticLevelMesh(levelId: LevelId, map: TileMap): MeshData {
  const cached = staticMeshCache.get(levelId);
  if (cached) {
    return cached;
  }
  let builder: MeshBuilder;
  if (levelId === 'level-outside') {
    builder = buildOutsideStaticMesh(map);
  } else if (levelId === 'level-basement') {
    builder = buildBasementStaticMesh(map);
  } else if (levelId === 'level-upstairs') {
    builder = buildUpstairsStaticMesh(map);
  } else {
    builder = buildPeopleStaticMesh(map);
  }
  const mesh = builder.build();
  staticMeshCache.set(levelId, mesh);
  return mesh;
}

// ============================================================================
// High-Fi 3D Articulated Character Models (Santa, 11 NPCs, Dog, Cat, Props)
// ============================================================================

export interface CharacterColors3D {
  coat: Color4;
  trim: Color4;
  pants: Color4;
  skin: Color4;
  hair: Color4;
  hat?: Color4;
  hasBeard?: boolean;
  holdingClub?: boolean;
  holdingBook?: boolean;
  sitting?: boolean;
  hasPresentInLap?: boolean;
}

export function addHumanoid3D(
  mb: MeshBuilder,
  cx: number,
  baseY: number,
  cz: number,
  yaw: number,
  walkPhase: number,
  isMoving: boolean,
  style: CharacterColors3D,
  isSanta = false,
  carryingLadder = false,
  translucentMb?: MeshBuilder,
  shadowGroundY: number = baseY
): void {
  if (translucentMb) {
    translucentMb.addShadowDisc(cx, shadowGroundY, cz, 5.6, 5.6, 0.36);
  }

  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const fx = cyaw;
  const fz = syaw;
  const rx = -syaw;
  const rz = cyaw;

  const swing = isMoving ? Math.sin(walkPhase * 11) * 0.58 : 0;
  const bob = isMoving ? Math.abs(Math.sin(walkPhase * 11)) * 0.85 : 0;
  const y0 = baseY + bob;

  // 1. Articulated Legs + Rounded Boots + Boot Cuffs
  const legSpread = 1.75;
  const legSwingDist = style.sitting ? 1.9 : Math.sin(swing) * 1.9;
  const bootColor: Color4 = isSanta ? rgb(28, 30, 38) : darkenColor(style.pants, 0.65);

  for (const side of [1, -1] as const) {
    const sSwing = style.sitting ? 0.9 : side * swing;
    const sDist = style.sitting ? 1.9 : side * legSwingDist;
    const lx = cx + rx * legSpread * side + fx * sDist;
    const lz = cz + rz * legSpread * side + fz * sDist;

    // Rounded boot sole & toe
    mb.addSphere(lx + fx * 0.5, y0 + 1.0, lz + fz * 0.5, 1.45, 1.05, 1.65, 6, 8, bootColor, TexId.SOLID, 0.6);
    if (isSanta) {
      // Fluffy white fur boot cuff
      mb.addTorus(lx, y0 + 2.1, lz, 1.15, 0.45, 8, 6, 'y', style.trim, TexId.SNOW, 0.4);
    }
    // Pant leg
    mb.addOrientedBox(lx, y0 + 2.8, lz, 2.3, 3.6, 2.3, yaw, sSwing, style.pants, TexId.SOLID, 0.65);
  }

  // 2. Sculpted Coat Skirt + Upper Torso + Scarf/Collar
  mb.addCylinder(cx, y0 + 3.6, cz, 4.45, 3.65, 3.8, 14, style.coat, TexId.FABRIC, 0.75);
  mb.addCylinder(cx, y0 + 6.8, cz, 3.65, 3.25, 3.8, 14, style.coat, TexId.FABRIC, 0.75);

  if (isSanta) {
    // Plush white fur bottom coat hem, vertical center fur trim, leather belt, and gold frame buckle
    mb.addTorus(cx, y0 + 3.8, cz, 4.15, 0.7, 14, 8, 'y', style.trim, TexId.SNOW, 0.5);
    mb.addCylinder(cx, y0 + 5.8, cz, 4.05, 3.95, 1.35, 14, rgb(28, 30, 38), TexId.SOLID, 0.45);
    mb.addOrientedBox(
      cx + fx * 3.95,
      y0 + 6.45,
      cz + fz * 3.95,
      0.85,
      1.65,
      2.0,
      yaw,
      0,
      rgb(252, 214, 68),
      TexId.SOLID,
      0.35
    );
    // Plush white fur collar around Santa's shoulders
    mb.addTorus(cx, y0 + 10.2, cz, 3.0, 0.85, 12, 8, 'y', style.trim, TexId.SNOW, 0.5);
  } else {
    // Cozy knitted winter collar / scarf ring around NPC neck
    mb.addTorus(cx, y0 + 10.2, cz, 2.85, 0.75, 12, 8, 'y', style.trim, TexId.FABRIC, 0.45);
  }

  // 3. Articulated Shoulders, Arms & Rounded Mittens/Hands
  const armSpread = 4.35;
  const mittenColor: Color4 = isSanta ? rgb(224, 232, 245) : style.skin;
  for (const side of [1, -1] as const) {
    const aSwing = -side * swing * 0.9;
    const aDist = -side * legSwingDist * 0.72;
    const ax = cx + rx * armSpread * side + fx * aDist;
    const az = cz + rz * armSpread * side + fz * aDist;

    // Shoulder cap
    mb.addSphere(cx + rx * 3.7 * side, y0 + 9.4, cz + rz * 3.7 * side, 1.4, 1.4, 1.4, 6, 8, style.coat, TexId.FABRIC, 0.5);
    // Sleeve
    mb.addOrientedBox(ax, y0 + 7.5, az, 2.0, 4.4, 2.0, yaw, aSwing, style.coat, TexId.FABRIC, 0.65);
    // Mitten / Hand sphere
    mb.addSphere(ax + fx * Math.sin(aSwing) * 1.4, y0 + 5.1, az + fz * Math.sin(aSwing) * 1.4, 1.15, 1.15, 1.15, 6, 8, mittenColor, TexId.SOLID, 0.5);
  }

  // 4. High-Fi Expressive Wind Waker HD Head, Ears, Nose, Cheeks & Eye Catchlights
  const headY = y0 + 13.3;
  mb.addSphere(cx, headY, cz, 3.75, 3.65, 3.75, 12, 16, style.skin, TexId.SOLID, 0.8);

  // 3D Ears on left and right sides of head
  mb.addSphere(cx + rx * 3.65, headY - 0.1, cz + rz * 3.65, 0.75, 1.05, 0.75, 6, 8, style.skin, TexId.SOLID, 0.45);
  mb.addSphere(cx - rx * 3.65, headY - 0.1, cz - rz * 3.65, 0.75, 1.05, 0.75, 6, 8, style.skin, TexId.SOLID, 0.45);

  // Sculpted 3D Button Nose & Rosy Winter Cheeks
  const noseColor = lightenColor(style.skin, -0.06);
  mb.addSphere(cx + fx * 3.75, headY - 0.15, cz + fz * 3.75, 0.72, 0.68, 0.72, 6, 8, noseColor, TexId.SOLID, 0.35);

  // Expressive Eyes: White Sclera + Dark Iris + Bright White Catchlight Shine + Eyebrows
  const eyeForward = 3.35;
  const eyeSpread = 1.35;
  for (const side of [1, -1] as const) {
    const ex = cx + fx * eyeForward + rx * eyeSpread * side;
    const ez = cz + fz * eyeForward + rz * eyeSpread * side;
    // White sclera base
    mb.addSphere(ex, headY + 0.45, ez, 0.78, 0.9, 0.65, 6, 8, rgb(252, 254, 255), TexId.SOLID, 0.15);
    // Dark pupil/iris
    mb.addSphere(ex + fx * 0.22, headY + 0.45, ez + fz * 0.22, 0.56, 0.72, 0.52, 6, 8, rgb(22, 26, 38), TexId.SOLID, 0.15);
    // Signature Wind Waker HD white eye catchlight dot
    mb.addSphere(ex + fx * 0.38 + rx * 0.18, headY + 0.68, ez + fz * 0.38 + rz * 0.18, 0.22, 0.22, 0.22, 4, 6, rgb(255, 255, 255), TexId.SOLID, 0);
    // Expressive eyebrow
    mb.addOrientedBox(ex + fx * 0.1, headY + 1.45, ez + fz * 0.1, 0.4, 0.32, 1.1, yaw, 0, style.hair, TexId.SOLID, 0.2);
  }

  if (style.hasBeard || isSanta) {
    // Full sculpted white Santa beard + curly mustache lobes
    mb.addSphere(cx + fx * 2.35, headY - 1.65, cz + fz * 2.35, 3.25, 2.75, 2.95, 10, 12, rgb(250, 252, 255), TexId.SNOW, 0.65);
    mb.addSphere(cx + fx * 3.1, headY - 2.9, cz + fz * 3.1, 2.1, 1.8, 2.1, 8, 10, rgb(252, 254, 255), TexId.SNOW, 0.55);
    // Mustache
    mb.addSphere(cx + fx * 3.45 + rx * 0.95, headY - 0.65, cz + fz * 3.45 + rz * 0.95, 1.1, 0.65, 1.1, 6, 8, rgb(255, 255, 255), TexId.SNOW, 0.35);
    mb.addSphere(cx + fx * 3.45 - rx * 0.95, headY - 0.65, cz + fz * 3.45 - rz * 0.95, 1.1, 0.65, 1.1, 6, 8, rgb(255, 255, 255), TexId.SNOW, 0.35);
  }

  if (style.hat || isSanta) {
    const hatColor = style.hat ?? rgb(220, 36, 42);
    // Plush torus fur hat brim
    mb.addTorus(cx, headY + 2.25, cz, 3.35, 0.85, 14, 8, 'y', style.trim, TexId.SNOW, 0.55);
    // Curved multi-segment drooping Santa/winter hat
    mb.addCylinder(cx - fx * 0.3, headY + 2.6, cz - fz * 0.3, 3.35, 2.3, 3.2, 12, hatColor, TexId.FABRIC, 0.7);
    mb.addCone(cx - fx * 1.15, headY + 5.4, cz - fz * 1.15, 2.35, 4.2, 12, hatColor, TexId.FABRIC, 0.7);
    // Fluffy white pom-pom at tip of hat
    mb.addSphere(
      cx - fx * 2.1,
      headY + 9.2 + bob * 0.3,
      cz - fz * 2.1,
      1.55,
      1.55,
      1.55,
      8,
      10,
      rgb(252, 254, 255),
      TexId.SNOW,
      0.6
    );
  } else {
    // Sculpted multi-part Wind Waker HD hair (crown + bangs + side locks + back volume)
    mb.addSphere(cx - fx * 0.2, headY + 1.15, cz - fz * 0.2, 3.95, 3.05, 3.95, 10, 14, style.hair, TexId.SOLID, 0.7);
    mb.addSphere(cx + fx * 1.8, headY + 2.15, cz + fz * 1.8, 3.1, 1.45, 3.3, 8, 10, style.hair, TexId.SOLID, 0.5);
    mb.addSphere(cx - fx * 2.6, headY - 0.2, cz - fz * 2.6, 2.4, 2.4, 2.4, 8, 10, style.hair, TexId.SOLID, 0.55);
  }

  // 5. Held High-Fi Props
  if (style.holdingClub) {
    const gx = cx + fx * 4.5 + rx * 2.5;
    const gz = cz + fz * 4.5 + rz * 2.5;
    mb.addOrientedBox(gx, y0 + 4.5, gz, 0.65, 9.2, 0.65, yaw, 0.35, rgb(216, 222, 234), TexId.SOLID, 0.45);
    mb.addBox(gx + fx * 1.6, y0 + 0.6, gz + fz * 1.6, 1.6, 1.1, 2.8, rgb(180, 190, 206), TexId.SOLID, 0.45);
    mb.addSphere(gx + fx * 3.4, y0 + 0.6, gz + fz * 3.4, 0.7, 0.7, 0.7, 6, 8, rgb(252, 254, 255), TexId.SOLID, 0.3);
  }

  if (style.holdingBook) {
    mb.addOrientedBox(cx + fx * 4.2, y0 + 7.2, cz + fz * 4.2, 3.2, 2.5, 4.0, yaw, 0.4, rgb(192, 48, 52), TexId.BOOKSHELF, 0.5);
    mb.addOrientedBox(cx + fx * 4.0, y0 + 7.45, cz + fz * 4.0, 2.9, 2.2, 3.6, yaw, 0.4, rgb(250, 246, 236), TexId.SOLID, 0.3);
  }

  if (style.hasPresentInLap) {
    const gx = cx + fx * 4.2;
    const gz = cz + fz * 4.2;
    mb.addBeveledBox(gx, y0 + 4.8, gz, 5.4, 4.8, 5.4, 0.45, rgb(220, 42, 48), TexId.GIFT_WRAP, 0.6);
    mb.addTorus(gx, y0 + 9.8, gz, 1.2, 0.4, 8, 6, 'z', rgb(255, 218, 72), TexId.SOLID, 0.35);
  }

  if (carryingLadder) {
    mb.addOrientedBox(cx - fx * 3.3, y0 + 8.5, cz - fz * 3.3, 1.4, 12.5, 5.4, yaw, 0.2, rgb(168, 112, 58), TexId.WOOD_GRAIN, 0.6);
  }
}

function addWoodenLadder3D(
  mb: MeshBuilder,
  cx: number,
  baseY: number,
  cz: number,
  height: number,
  standingVertical: boolean
): void {
  const wood = rgb(176, 118, 62);
  if (standingVertical) {
    mb.addCylinder(cx - 2.7, baseY, cz, 0.85, 0.8, height, 10, wood, TexId.WOOD_GRAIN, 0.6);
    mb.addCylinder(cx + 2.7, baseY, cz, 0.85, 0.8, height, 10, wood, TexId.WOOD_GRAIN, 0.6);
    const rungs = 8;
    for (let i = 0; i < rungs; i++) {
      const ry = baseY + 3 + (i / (rungs - 1)) * (height - 5);
      mb.addBeveledBox(cx, ry, cz, 6.0, 1.0, 1.1, 0.25, wood, TexId.WOOD_GRAIN, 0.5);
    }
  } else {
    mb.addBeveledBox(cx, baseY + 0.6, cz - 2.6, 24, 1.5, 1.4, 0.3, wood, TexId.WOOD_GRAIN, 0.6);
    mb.addBeveledBox(cx, baseY + 0.6, cz + 2.6, 24, 1.5, 1.4, 0.3, wood, TexId.WOOD_GRAIN, 0.6);
    for (let i = -9; i <= 9; i += 3.6) {
      mb.addBeveledBox(cx + i, baseY + 0.8, cz, 1.2, 1.3, 5.8, 0.25, wood, TexId.WOOD_GRAIN, 0.5);
    }
  }
}

function addDog3D(
  mb: MeshBuilder,
  translucentMb: MeshBuilder,
  dog: Dog,
  elapsedTime: number
): void {
  const cx = dog.x + dog.width * 0.5;
  const cz = dog.y + dog.height * 0.5;
  const baseY = getTerrainHeight(cx, cz, 'level-outside');
  translucentMb.addShadowDisc(cx, baseY, cz, 5.8, 4.4, 0.35);

  const yaw = typeof dog.yaw === 'number' ? dog.yaw : directionToYaw(dog.facing);
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const fx = cyaw;
  const fz = syaw;
  const rx = -syaw;
  const rz = cyaw;

  const isRunning = dog.mode === 'chasing' || Math.hypot(dog.vx, dog.vy) > 2;
  const legBounce = isRunning ? Math.sin(elapsedTime * 16) * 1.2 : 0;
  const bodyColor = rgb(206, 142, 74);
  const chestColor = rgb(238, 196, 138);
  const earColor = rgb(128, 76, 34);

  // 4 Articulated Legs & Rounded Paws
  for (const [fSign, rSign] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const lx = cx + fx * fSign * 3.1 + rx * rSign * 1.85;
    const lz = cz + fz * fSign * 3.1 + rz * rSign * 1.85;
    const ly = baseY + Math.max(0, fSign * legBounce * 0.45);
    mb.addCylinder(lx, ly + 0.5, lz, 0.85, 0.95, 3.0, 8, bodyColor, TexId.SOLID, 0.55);
    mb.addSphere(lx + fx * 0.3, ly + 0.55, lz + fz * 0.3, 1.0, 0.65, 1.1, 6, 8, chestColor, TexId.SOLID, 0.45);
  }

  // Sculpted Torso, Haunches & Fluffy Chest
  mb.addSphere(cx - fx * 1.4, baseY + 4.3, cz - fz * 1.4, 3.4, 2.3, 2.4, 8, 12, bodyColor, TexId.FABRIC, 0.65);
  mb.addSphere(cx + fx * 1.8, baseY + 4.6, cz + fz * 1.8, 3.0, 2.5, 2.5, 8, 12, bodyColor, TexId.FABRIC, 0.65);
  mb.addSphere(cx + fx * 3.2, baseY + 4.4, cz + fz * 3.2, 2.1, 2.0, 2.1, 6, 10, chestColor, TexId.FABRIC, 0.5);

  // Red Collar + Shiny Gold Dog Tag
  mb.addTorus(cx + fx * 3.5, baseY + 5.6, cz + fz * 3.5, 2.1, 0.52, 12, 6, 'y', rgb(224, 36, 42), TexId.SOLID, 0.45);
  mb.addSphere(cx + fx * 5.4, baseY + 4.8, cz + fz * 5.4, 0.55, 0.55, 0.55, 6, 6, rgb(252, 214, 68), TexId.SOLID, 0.25);

  // Expressive Head, Snout, Wet Black Nose, Happy Pink Tongue & Floppy Ears
  const hx = cx + fx * 4.8;
  const hz = cz + fz * 4.8;
  const hy = baseY + 7.1;
  mb.addSphere(hx, hy, hz, 2.85, 2.65, 2.85, 10, 14, bodyColor, TexId.SOLID, 0.7);
  mb.addSphere(hx + fx * 2.2, hy - 0.5, hz + fz * 2.2, 1.65, 1.35, 1.55, 8, 10, chestColor, TexId.SOLID, 0.6);
  mb.addSphere(hx + fx * 3.65, hy - 0.15, hz + fz * 3.65, 0.65, 0.55, 0.65, 6, 8, rgb(24, 24, 30), TexId.SOLID, 0.25);
  // Happy pink tongue
  mb.addSphere(hx + fx * 2.9, hy - 1.45, hz + fz * 2.9, 0.55, 0.75, 0.45, 6, 6, rgb(245, 112, 138), TexId.SOLID, 0.2);
  // Eyes with catchlights
  for (const side of [1, -1] as const) {
    mb.addSphere(hx + fx * 2.2 + rx * 1.25 * side, hy + 0.55, hz + fz * 2.2 + rz * 1.25 * side, 0.5, 0.58, 0.5, 6, 6, rgb(22, 24, 32), TexId.SOLID, 0.15);
  }
  // Floppy ears
  mb.addSphere(hx - fx * 0.2 + rx * 2.75, hy - 0.3, hz - fz * 0.2 + rz * 2.75, 0.95, 2.35, 1.35, 8, 10, earColor, TexId.SOLID, 0.55);
  mb.addSphere(hx - fx * 0.2 - rx * 2.75, hy - 0.3, hz - fz * 0.2 - rz * 2.75, 0.95, 2.35, 1.35, 8, 10, earColor, TexId.SOLID, 0.55);

  // Wagging Tail
  const wag = Math.sin(elapsedTime * 18) * 1.5;
  mb.addOrientedBox(
    cx - fx * 4.6 + rx * wag,
    baseY + 5.9,
    cz - fz * 4.6 + rz * wag,
    3.4,
    1.1,
    1.1,
    yaw,
    0.58,
    earColor,
    TexId.SOLID,
    0.5
  );

  // Floating 3D Puffy Heart when dog is chasing
  if (dog.mode === 'chasing' || dog.hearts.length > 0) {
    const heartY = baseY + 13.0 + Math.sin(elapsedTime * 6) * 1.2;
    translucentMb.addSphere(cx - 1.15, heartY, cz, 1.55, 1.55, 1.25, 8, 10, rgb(248, 48, 82, 0.94), TexId.SOLID, 0.45);
    translucentMb.addSphere(cx + 1.15, heartY, cz, 1.55, 1.55, 1.25, 8, 10, rgb(248, 48, 82, 0.94), TexId.SOLID, 0.45);
    translucentMb.addCone(cx, heartY - 2.4, cz, 2.25, 2.6, 10, rgb(248, 48, 82, 0.94), TexId.SOLID, 0.45);
  }
}

function addCat3D(mb: MeshBuilder, translucentMb: MeshBuilder, cat: Cat, elapsedTime = 0): void {
  const cx = cat.x + cat.width * 0.5;
  const cz = cat.y + cat.height * 0.5;
  translucentMb.addShadowDisc(cx, 0, cz, 4.4, 4.4, 0.32);

  const speed = Math.hypot(cat.vx, cat.vy);
  const isRunning = cat.mode === 'flee' || speed > 1.5;
  const yaw =
    typeof cat.yaw === 'number'
      ? cat.yaw
      : speed > 0.5
        ? Math.atan2(cat.vy, cat.vx)
        : Math.PI / 2;
  const fx = Math.cos(yaw);
  const fz = Math.sin(yaw);
  const rx = -fz;
  const rz = fx;

  const catBlack = rgb(28, 30, 40);
  const runStride = isRunning ? Math.sin(elapsedTime * 18) * 1.4 : 0;

  if (isRunning) {
    // Sleek stretched running body & animated legs oriented along running direction
    mb.addOrientedBox(cx, 3.0, cz, 5.4, 2.8, 3.2, yaw, 0, catBlack, TexId.SOLID, 0.65);
    for (const [fSign, rSign] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const lx = cx + fx * (fSign * 2.1 + fSign * runStride * 0.65) + rx * rSign * 1.1;
      const lz = cz + fz * (fSign * 2.1 + fSign * runStride * 0.65) + rz * rSign * 1.1;
      mb.addCylinder(lx, 0, lz, 0.55, 0.55, 2.6, 8, catBlack, TexId.SOLID, 0.4);
      mb.addSphere(lx + fx * 0.25, 0.35, lz + fz * 0.25, 0.65, 0.45, 0.75, 6, 6, rgb(244, 246, 252), TexId.SOLID, 0.25);
    }
  } else {
    // Lithe seated feline body & white front paws oriented along yaw
    mb.addCylinder(cx, 0, cz, 2.8, 2.1, 5.0, 12, catBlack, TexId.SOLID, 0.65);
    mb.addSphere(cx + fx * 2.3 + rx * 1.05, 0.55, cz + fz * 2.3 + rz * 1.05, 0.75, 0.55, 0.95, 6, 6, rgb(244, 246, 252), TexId.SOLID, 0.3);
    mb.addSphere(cx + fx * 2.3 - rx * 1.05, 0.55, cz + fz * 2.3 - rz * 1.05, 0.75, 0.55, 0.95, 6, 6, rgb(244, 246, 252), TexId.SOLID, 0.3);
  }

  // Sculpted Cat Head + Pointed Ears + Glowing Emerald Eyes facing `yaw`
  const headDist = isRunning ? 3.2 : 1.0;
  const headY = isRunning ? 5.2 : 6.6;
  const hx = cx + fx * headDist;
  const hz = cz + fz * headDist;
  mb.addSphere(hx, headY, hz, 2.5, 2.3, 2.5, 10, 12, catBlack, TexId.SOLID, 0.65);
  mb.addCone(hx + rx * 1.45, headY + 1.6, hz + rz * 1.45, 0.9, 2.2, 8, catBlack, TexId.SOLID, 0.5);
  mb.addCone(hx - rx * 1.45, headY + 1.6, hz - rz * 1.45, 0.9, 2.2, 8, catBlack, TexId.SOLID, 0.5);
  mb.addSphere(hx + fx * 2.15 + rx * 0.95, headY + 0.25, hz + fz * 2.15 + rz * 0.95, 0.5, 0.55, 0.45, 6, 6, rgb(92, 248, 118), TexId.SOLID, 0.15);
  mb.addSphere(hx + fx * 2.15 - rx * 0.95, headY + 0.25, hz + fz * 2.15 - rz * 0.95, 0.5, 0.55, 0.45, 6, 6, rgb(92, 248, 118), TexId.SOLID, 0.15);

  // S-curved trailing swishing tail
  const swish = Math.sin(elapsedTime * 5) * 0.9;
  mb.addSphere(cx - fx * 3.3 + rx * swish, isRunning ? 3.8 : 2.2, cz - fz * 3.3 + rz * swish, 0.7, 2.2, 0.7, 6, 8, catBlack, TexId.SOLID, 0.45);
}

function addMotorcycle3D(
  mb: MeshBuilder,
  translucentMb: MeshBuilder,
  motorcycle: MotorcycleState,
  elapsedTime: number
): void {
  const cx = motorcycle.x + motorcycle.width * 0.5;
  const cz = motorcycle.y + motorcycle.height * 0.5;
  const baseY = getTerrainHeight(cx, cz, 'level-outside');
  translucentMb.addShadowDisc(cx, baseY, cz, 11, 5.5, 0.36);

  if (motorcycle.status === 'crashed') {
    mb.addOrientedBox(cx, baseY + 2.5, cz, 18, 3.8, 7.0, 0.4, 1.1, rgb(42, 46, 56), TexId.SOLID, 0.7);
    for (let i = 0; i < 4; i++) {
      const p = (elapsedTime * 0.9 + i * 0.25) % 1;
      translucentMb.addSphere(
        cx + Math.sin(elapsedTime * 3 + i) * 2.5,
        baseY + 5 + p * 15,
        cz,
        2.0 + p * 2.6,
        1.8 + p * 2.2,
        2.0 + p * 2.6,
        8,
        10,
        rgb(176, 184, 196, (1 - p) * 0.65),
        TexId.SOLID,
        0
      );
    }
    return;
  }

  // Front & Rear Rubber Tires (Torus) + Chrome Rims
  for (const wx of [-6.8, 6.8]) {
    mb.addTorus(cx + wx, baseY + 3.4, cz, 2.5, 1.0, 14, 8, 'z', rgb(24, 26, 32), TexId.SOLID, 0.55);
    mb.addCylinder(cx + wx, baseY + 2.2, cz, 1.7, 1.7, 2.2, 10, rgb(210, 218, 232), TexId.SOLID, 0.35);
  }
  // Engine block & chrome twin exhaust pipes
  mb.addBeveledBox(cx, baseY + 2.8, cz, 9.5, 3.8, 3.8, 0.6, rgb(56, 62, 74), TexId.SOLID, 0.6);
  mb.addOrientedBox(cx - 3.5, baseY + 2.6, cz + 2.2, 9.0, 1.0, 1.0, 0, 0.12, rgb(216, 224, 236), TexId.SOLID, 0.4);
  // Sculpted Teardrop Fuel Tank & Stepped Leather Saddle
  mb.addSphere(cx + 2.2, baseY + 6.4, cz, 3.8, 2.0, 2.2, 8, 12, rgb(32, 36, 46), TexId.SOLID, 0.6);
  mb.addSphere(cx - 3.2, baseY + 5.8, cz, 4.2, 1.4, 2.1, 8, 10, rgb(64, 42, 30), TexId.FABRIC, 0.55);
  // Front Forks, Handlebars & Chrome Headlight
  mb.addOrientedBox(cx + 5.2, baseY + 5.8, cz, 1.2, 6.8, 2.8, 0, -0.35, rgb(206, 214, 228), TexId.SOLID, 0.45);
  mb.addBox(cx + 4.4, baseY + 8.6, cz, 1.2, 1.2, 8.2, rgb(42, 46, 56), TexId.SOLID, 0.45);
  mb.addSphere(cx + 6.8, baseY + 7.2, cz, 1.4, 1.5, 1.5, 8, 10, rgb(255, 244, 164), TexId.SOLID, 0.35);
}

function addConeOfSight3D(translucentMb: MeshBuilder, cone: ConeOfSight | null | undefined): void {
  if (!cone || cone.sightPolygon.length < 3) return;
  const poly = cone.sightPolygon;
  const ox = poly[0].x;
  const oz = poly[0].y;
  const y = 0.42;
  const beamColor = ConeOfSight.cheatMode
    ? rgb(82, 224, 128, 0.48)
    : rgb(255, 232, 68, 0.62);
  const edgeColor = ConeOfSight.cheatMode
    ? rgb(82, 245, 140, 0.85)
    : rgb(255, 152, 48, 0.90);

  for (let i = 1; i < poly.length - 1; i++) {
    const p1 = poly[i];
    const p2 = poly[i + 1];
    translucentMb.addTriangle(
      [ox, y, oz],
      [p1.x, y, p1.y],
      [p2.x, y, p2.y],
      beamColor,
      TexId.SOLID,
      0,
      [0, 1, 0]
    );
    translucentMb.addQuad(
      [p1.x, y, p1.y],
      [p2.x, y, p2.y],
      [p2.x, y + 2.0, p2.y],
      [p1.x, y + 2.0, p1.y],
      [0, 1, 0],
      edgeColor,
      TexId.SOLID,
      0
    );
  }

  // Crisp left & right side edge ribbons from the NPC apex out to the cone perimeter
  const firstPt = poly[1];
  const lastPt = poly[poly.length - 1];
  translucentMb.addQuad(
    [ox, y, oz],
    [firstPt.x, y, firstPt.y],
    [firstPt.x, y + 2.0, firstPt.y],
    [ox, y + 2.0, oz],
    [0, 1, 0],
    edgeColor,
    TexId.SOLID,
    0
  );
  translucentMb.addQuad(
    [lastPt.x, y, lastPt.y],
    [ox, y, oz],
    [ox, y + 2.0, oz],
    [lastPt.x, y + 2.0, lastPt.y],
    [0, 1, 0],
    edgeColor,
    TexId.SOLID,
    0
  );
}

function addDoorAndFog3D(opaqueMb: MeshBuilder, door: CollidableDoor): void {
  const b = door.bounds;
  const cx = b.x + b.width * 0.5;
  const cz = b.y + b.height * 0.5;
  const leafW = b.width - 2.4;
  const leafH = 24.0;
  const leafD = 3.6;

  // Paneled door leaf centered inside the recessed doorway opening (making room in the wall)
  opaqueMb.addBeveledBox(cx, 0, cz, leafW, leafH, leafD, 0.4, rgb(132, 78, 40), TexId.WOOD_GRAIN, 0.7);
  // Lower and upper raised wooden door panels on both faces
  opaqueMb.addBox(cx, 2.4, cz, leafW * 0.68, 7.4, leafD + 0.6, rgb(156, 96, 52), TexId.WOOD_GRAIN, 0.35);
  opaqueMb.addBox(cx, 12.4, cz, leafW * 0.68, 9.2, leafD + 0.6, rgb(156, 96, 52), TexId.WOOD_GRAIN, 0.35);

  // Brass doorknobs on both sides of the door
  for (const dz of [-leafD * 0.5 - 0.6, leafD * 0.5 + 0.6]) {
    opaqueMb.addSphere(cx + leafW * 0.32, 11.2, cz + dz, 0.9, 0.9, 0.9, 6, 8, rgb(250, 214, 72), TexId.SOLID, 0.35);
  }

  for (const hr of door.hiddenRegions) {
    opaqueMb.addBox(
      hr.x + hr.width * 0.5,
      0.2,
      hr.y + hr.height * 0.5,
      hr.width,
      INDOOR_WALL_HEIGHT + 0.4,
      hr.height,
      rgb(12, 14, 22),
      TexId.SOLID,
      0
    );
  }
}

function addOpenedDoor3D(opaqueMb: MeshBuilder, door: OpenedDoorAnimation): void {
  const b = door.bounds;
  const leafW = b.width - 2.4;
  const leafH = 24.0;
  const leafD = 3.6;

  // Hinge pivot on left jamb inside the recessed doorway opening
  const hx = b.x + 1.2;
  const hz = b.y + b.height * 0.5;
  const ease = 1 - Math.pow(1 - Math.max(0, Math.min(1, door.progress)), 3);
  const angle = door.swingDirection * ease * (Math.PI * 0.48);

  const ux = Math.cos(angle);
  const uz = Math.sin(angle);
  const nx = -uz;
  const nz = ux;
  const cx = hx + ux * leafW * 0.5;
  const cz = hz + uz * leafW * 0.5;

  opaqueMb.addOrientedBox(cx, leafH * 0.5, cz, leafW, leafH, leafD, angle, 0, rgb(132, 78, 40), TexId.WOOD_GRAIN, 0.7);
  opaqueMb.addOrientedBox(cx, 2.4 + 3.7, cz, leafW * 0.68, 7.4, leafD + 0.6, angle, 0, rgb(156, 96, 52), TexId.WOOD_GRAIN, 0.35);
  opaqueMb.addOrientedBox(cx, 12.4 + 4.6, cz, leafW * 0.68, 9.2, leafD + 0.6, angle, 0, rgb(156, 96, 52), TexId.WOOD_GRAIN, 0.35);

  const knobDist = leafW * 0.32;
  const kx = cx + ux * knobDist;
  const kz = cz + uz * knobDist;
  for (const side of [-1, 1] as const) {
    const off = side * (leafD * 0.5 + 0.6);
    opaqueMb.addSphere(kx + nx * off, 11.2, kz + nz * off, 0.9, 0.9, 0.9, 6, 8, rgb(250, 214, 72), TexId.SOLID, 0.35);
  }
}

function addExclamationBadge3D(opaqueMb: MeshBuilder, cx: number, baseY: number, cz: number): void {
  const ay = baseY + 19;
  opaqueMb.addBeveledBox(cx - 1.5, ay + 2.5, cz, 1.6, 5.2, 1.6, 0.3, rgb(255, 42, 42), TexId.SOLID, 0.55);
  opaqueMb.addSphere(cx - 1.5, ay + 0.8, cz, 0.95, 0.95, 0.95, 6, 8, rgb(255, 42, 42), TexId.SOLID, 0.45);
  opaqueMb.addBeveledBox(cx + 1.5, ay + 2.5, cz, 1.6, 5.2, 1.6, 0.3, rgb(255, 42, 42), TexId.SOLID, 0.55);
  opaqueMb.addSphere(cx + 1.5, ay + 0.8, cz, 0.95, 0.95, 0.95, 6, 8, rgb(255, 42, 42), TexId.SOLID, 0.45);
}

// ============================================================================
// Dynamic Scene Builder (Per-Frame Entities, Doors, Lights, Particles)
// ============================================================================

export function buildDynamicSceneMeshes(
  state: GameState,
  cameraDistance?: number
): DynamicSceneMeshes {
  const opaque = new MeshBuilder();
  const translucent = new MeshBuilder();
  const pointLights: PointLight3D[] = [];
  const t = state.elapsedTime;
  const levelId = state.currentLevelId;

  // 1. Santa (Player)
  const playerVisible =
    state.player.blinkTimer <= 0 || Math.floor(state.player.blinkTimer * 12) % 2 === 0;
  const px = state.player.x + state.player.width * 0.5;
  const pz =
    state.climbing && levelId === 'level-outside'
      ? 10 * TILE_SIZE + 5.2
      : state.player.y + state.player.height * 0.5;
  const py = getPlayerElevation(state);
  const shadowGroundY = state.climbing
    ? getTerrainHeight(px, pz, levelId)
    : py - (state.player.jumpOffset ?? 0);
  const playerYaw =
    state.climbing && levelId === 'level-outside'
      ? -Math.PI / 2
      : typeof state.player.renderYaw === 'number'
        ? state.player.renderYaw
        : typeof state.player.yaw === 'number'
          ? state.player.yaw
          : directionToYaw(state.player.facing);

  if (playerVisible) {
    const electrocutedFlash =
      state.electrocutionTimer > 0 && Math.floor(t * 20) % 2 === 0;
    const santaStyle: CharacterColors3D = electrocutedFlash
      ? {
          coat: rgb(245, 250, 120),
          trim: rgb(255, 255, 255),
          pants: rgb(245, 250, 120),
          skin: rgb(255, 255, 255),
          hair: rgb(255, 255, 255),
          hat: rgb(245, 250, 120),
          hasBeard: true,
        }
      : {
          coat: rgb(216, 34, 42),
          trim: rgb(248, 250, 255),
          pants: rgb(186, 28, 36),
          skin: rgb(250, 208, 176),
          hair: rgb(250, 252, 255),
          hat: rgb(220, 36, 42),
          hasBeard: true,
        };

    const rosannaCutsceneActive =
      levelId === 'level-upstairs' &&
      Boolean(state.levels['level-upstairs'].rosannaCutscene?.active);
    const toiletCutsceneActive =
      levelId === 'level-basement' &&
      Boolean(state.levels['level-basement'].toiletCutscene?.active);
    const isPlayerTranslucent =
      (cameraDistance !== undefined && cameraDistance < TILE_SIZE) ||
      rosannaCutsceneActive ||
      toiletCutsceneActive;
    const playerTargetBuilder = isPlayerTranslucent ? translucent : opaque;
    const playerStartVertex = playerTargetBuilder.vertexCount;

    addHumanoid3D(
      playerTargetBuilder,
      px,
      py,
      pz,
      playerYaw,
      state.player.walkTimer,
      state.player.isMoving,
      santaStyle,
      true,
      state.hasLadder && !state.ladderPlaced,
      translucent,
      shadowGroundY
    );

    if (isPlayerTranslucent) {
      playerTargetBuilder.scaleAlphaRange(playerStartVertex, 0.25);
    }
  }

  // 2. Level-specific dynamic entities & lighting
  if (levelId === 'level-outside') {
    const outside = state.levels['level-outside'];

    // Footprints in snow
    for (const fp of state.footprints) {
      const alpha = Math.max(0, 1 - fp.age / fp.maxAge) * 0.65;
      const fy = getTerrainHeight(fp.x, fp.y, 'level-outside') + 0.15;
      translucent.addSphere(fp.x, fy, fp.y, 1.2, 0.2, 1.6, 6, 8, rgb(138, 162, 198, alpha), TexId.SOLID, 0);
    }

    // Ladder (on ground at GROUND_LADDER_BOUNDS or placed outside the south wall of main house)
    if (!state.hasLadder && !state.ladderPlaced) {
      const lx = GROUND_LADDER_BOUNDS.x + GROUND_LADDER_BOUNDS.width * 0.5;
      const lz = GROUND_LADDER_BOUNDS.y + GROUND_LADDER_BOUNDS.height * 0.5;
      const ly = getTerrainHeight(lx, lz, 'level-outside');
      addWoodenLadder3D(opaque, lx, ly, lz, 24, false);
    } else if (state.ladderPlaced) {
      const lx = LADDER_CLIMB_X + 6;
      const lz = 10 * TILE_SIZE + 3.2;
      const ly = getTerrainHeight(lx, lz, 'level-outside');
      const roofEdgeY = getMainHouseRoofElevation(lx, ROOF_WALK_Y + 6);
      addWoodenLadder3D(opaque, lx, ly, lz, roofEdgeY - ly + 2.5, true);
    }

    // Motorcycle
    addMotorcycle3D(opaque, translucent, state.motorcycle, t);

    // Dog & floating hearts
    addDog3D(opaque, translucent, state.dog, t);

    // Alex practicing golf swings in the southwest lawn
    if (outside.alexNpc) {
      const ax = outside.alexNpc.x + outside.alexNpc.width * 0.5;
      const az = outside.alexNpc.y + outside.alexNpc.height * 0.5;
      const ay = getTerrainHeight(ax, az, 'level-outside');
      addHumanoid3D(
        opaque,
        ax,
        ay,
        az,
        directionToYaw(outside.alexNpc.facing),
        t,
        false,
        {
          coat: rgb(156, 56, 50),
          trim: rgb(238, 238, 244),
          pants: rgb(52, 58, 72),
          skin: rgb(248, 206, 174),
          hair: rgb(168, 176, 160),
          holdingClub: true,
        },
        false,
        false,
        translucent
      );
    }

    // Snowball throwers (Sylvester & Annelotte)
    state.throwers.forEach((th: SnowballThrower, idx: number) => {
      const tx = th.x + th.width * 0.5;
      const tz = th.y + th.height * 0.5;
      const ty = getTerrainHeight(tx, tz, 'level-outside');
      const throwYaw = directionToYaw(th.facing);
      const isThrowing = th.throwTimer < 0.25 || th.throwTimer > th.throwInterval - 0.35;
      const style: CharacterColors3D =
        idx === 0
          ? {
              coat: rgb(176, 88, 50),
              trim: rgb(242, 248, 255),
              pants: rgb(44, 54, 72),
              skin: rgb(248, 208, 176),
              hair: rgb(74, 44, 30),
              hat: rgb(176, 88, 50),
            }
          : {
              coat: rgb(128, 64, 112),
              trim: rgb(242, 248, 255),
              pants: rgb(44, 54, 72),
              skin: rgb(250, 210, 178),
              hair: rgb(176, 104, 48),
              hat: rgb(128, 64, 112),
            };
      addHumanoid3D(opaque, tx, ty, tz, throwYaw, isThrowing ? t * 2 : 0, isThrowing, style, false, false, translucent);
    });

    // Flying Snowballs + ground shadow
    for (const sb of state.snowballs) {
      const sx = sb.x + sb.width * 0.5;
      const sz = sb.y + sb.height * 0.5;
      const groundY = getTerrainHeight(sx, sz, 'level-outside');
      translucent.addShadowDisc(sx, groundY, sz, 2.8, 2.8, 0.28);
      opaque.addSphere(sx, groundY + 7.5, sz, 3.3, 3.3, 3.3, 10, 12, rgb(248, 252, 255), TexId.SNOW, 0.6);
    }

    // Chimney Smoke Puffs rising from the main house chimney
    const houseGroundY = getTerrainHeight(5 * TILE_SIZE, 9 * TILE_SIZE, 'level-outside');
    const chimTopY = houseGroundY + MAIN_HOUSE_ROOF_WALK_HEIGHT + 21;
    const chimX = ROOF_CHIMNEY_BOUNDS.x + ROOF_CHIMNEY_BOUNDS.width * 0.5;
    const chimZ = ROOF_CHIMNEY_BOUNDS.y + ROOF_CHIMNEY_BOUNDS.height * 0.5;
    for (let i = 0; i < 5; i++) {
      const phase = (t * 0.42 + i * 0.2) % 1;
      const sx = chimX + Math.sin(t * 1.8 + i * 2) * 3.8 * phase;
      const sz = chimZ - phase * 6;
      const sy = chimTopY + phase * 24;
      const r = 2.2 + phase * 3.6;
      translucent.addSphere(sx, sy, sz, r, r * 0.85, r, 8, 10, rgb(228, 236, 248, (1 - phase) * 0.52), TexId.SOLID, 0);
    }

    // Electric Sparks on the frayed EV charging cable
    const sparkX = DAMAGED_WIRE_HAZARD.x + DAMAGED_WIRE_HAZARD.width * 0.5;
    const sparkZ = DAMAGED_WIRE_HAZARD.y + DAMAGED_WIRE_HAZARD.height * 0.5;
    const sparkBaseY = getTerrainHeight(sparkX, sparkZ, 'level-outside') + 1.5;
    for (let i = 0; i < 4; i++) {
      const ang = t * 15 + i * 1.6;
      translucent.addOrientedBox(
        sparkX + Math.cos(ang) * 2.2,
        sparkBaseY + 1.2 + Math.abs(Math.sin(ang * 1.7)) * 2.8,
        sparkZ + Math.sin(ang) * 2.2,
        4.2,
        0.55,
        0.55,
        ang,
        0.6,
        rgb(120, 238, 255, 0.95),
        TexId.SOLID,
        0.3
      );
    }
    pointLights.push({
      x: sparkX,
      y: sparkBaseY + 3,
      z: sparkZ,
      r: 0.4,
      g: 0.9,
      b: 1.0,
      radius: 48,
      intensity: 0.55 + Math.sin(t * 24) * 0.35,
    });
    pointLights.push({
      x: 168,
      y: houseGroundY + 14,
      z: 164,
      r: 1.0,
      g: 0.82,
      b: 0.42,
      radius: 90,
      intensity: 0.82,
    });

    // Gentle 3D Falling Snowflakes around Santa
    for (let i = 0; i < 32; i++) {
      const seedX = ((i * 73) % 140) - 70;
      const seedZ = ((i * 47) % 140) - 70;
      const fall = (t * 14 + i * 9.3) % 42;
      const fx = px + seedX + Math.sin(t * 1.5 + i) * 4;
      const fz = pz + seedZ + Math.cos(t * 1.3 + i) * 4;
      const fy = py + 38 - fall;
      translucent.addSphere(fx, fy, fz, 0.6, 0.6, 0.6, 6, 6, rgb(252, 254, 255, 0.85), TexId.SOLID, 0);
    }
  } else if (levelId === 'level-basement') {
    const basement = state.levels['level-basement'];

    // Animated Fireplace Flames & Warm Hearth Point Light
    for (let i = 0; i < 5; i++) {
      const flicker = Math.sin(t * 14 + i * 1.6) * 1.5;
      const flameH = 5.2 + flicker;
      translucent.addCone(
        11 * TILE_SIZE - 0.8,
        1.8,
        11.4 * TILE_SIZE + i * 2.8,
        1.8,
        flameH,
        10,
        i % 2 === 0 ? rgb(255, 146, 36, 0.92) : rgb(255, 226, 72, 0.92),
        TexId.SOLID,
        0
      );
    }
    pointLights.push({
      x: 10.5 * TILE_SIZE,
      y: 8,
      z: 12 * TILE_SIZE,
      r: 1.0,
      g: 0.62,
      b: 0.22,
      radius: 125,
      intensity: 1.05 + Math.sin(t * 13) * 0.18,
    });

    // Arjan (windowNpc)
    addHumanoid3D(
      opaque,
      basement.windowNpc.x + basement.windowNpc.width * 0.5,
      0,
      basement.windowNpc.y + basement.windowNpc.height * 0.5,
      basement.coneOfSight ? basement.coneOfSight.direction : directionToYaw(basement.windowNpc.facing),
      t,
      false,
      {
        coat: hexToColor4('#423933'),
        trim: rgb(224, 220, 214),
        pants: rgb(44, 52, 68),
        skin: rgb(248, 206, 174),
        hair: hexToColor4('#4e433c'),
      },
      false,
      false,
      translucent
    );

    // Olexa (olexaNpc)
    addHumanoid3D(
      opaque,
      basement.olexaNpc.x + basement.olexaNpc.width * 0.5,
      0,
      basement.olexaNpc.y + basement.olexaNpc.height * 0.5,
      basement.olexaConeOfSight ? basement.olexaConeOfSight.direction : directionToYaw(basement.olexaNpc.facing),
      t,
      false,
      {
        coat: hexToColor4('#52446a'),
        trim: rgb(232, 228, 240),
        pants: rgb(44, 52, 68),
        skin: rgb(248, 206, 174),
        hair: hexToColor4('#342618'),
      },
      false,
      false,
      translucent
    );

    // Hanneloes sitting on the toilet in the bathroom (when door is opened)
    const isBathroomClosed = basement.doors.some((d) => d.id === 'basement-bathroom-door');
    if (!isBathroomClosed) {
      const tx = basement.toiletNpc.x + basement.toiletNpc.width * 0.5;
      const tz = basement.toiletNpc.y + basement.toiletNpc.height * 0.5;
      addHumanoid3D(
        opaque,
        tx,
        2.0,
        tz,
        directionToYaw(basement.toiletNpc.facing),
        t,
        false,
        {
          coat: hexToColor4('#2d7862'),
          trim: rgb(238, 244, 242),
          pants: rgb(52, 56, 74),
          skin: rgb(250, 208, 176),
          hair: hexToColor4('#8a4822'),
          sitting: true,
        },
        false,
        false,
        translucent
      );
      if (basement.toiletCutscene?.active && Math.floor(basement.toiletCutscene.timer * 10) % 2 === 0) {
        addExclamationBadge3D(opaque, tx, 2.0, tz);
      }
    }

    addConeOfSight3D(translucent, basement.coneOfSight);
    addConeOfSight3D(translucent, basement.olexaConeOfSight);

    for (const door of basement.doors) {
      addDoorAndFog3D(opaque, door);
    }
    for (const door of basement.openedDoors) {
      addOpenedDoor3D(opaque, door);
    }
  } else if (levelId === 'level-upstairs') {
    const upstairs = state.levels['level-upstairs'];

    // Christmas Tree warm golden glow
    pointLights.push({
      x: 3 * TILE_SIZE,
      y: 18,
      z: 15.5 * TILE_SIZE,
      r: 1.0,
      g: 0.86,
      b: 0.42,
      radius: 135,
      intensity: 1.0 + Math.sin(t * 4) * 0.1,
    });

    // Black Cat in Extra Room
    addCat3D(opaque, translucent, upstairs.cat, t);

    // Rosanna Cutscene: second Santa running west-to-east outside the north kitchen windows
    if (upstairs.rosannaCutscene?.active) {
      const cs = upstairs.rosannaCutscene;
      addHumanoid3D(
        opaque,
        cs.santaX + 8,
        0,
        cs.santaY + 8,
        0,
        cs.walkTimer,
        true,
        {
          coat: rgb(216, 34, 42),
          trim: rgb(248, 250, 255),
          pants: rgb(186, 28, 36),
          skin: rgb(250, 208, 176),
          hair: rgb(250, 252, 255),
          hat: rgb(220, 36, 42),
          hasBeard: true,
        },
        true,
        false,
        translucent
      );
      if (Math.floor(cs.elapsed * 10) % 2 === 0) {
        addExclamationBadge3D(opaque, px, py, pz);
      }
    }

    const isTableRoomDoorOpen = !upstairs.doors.some(
      (d) => d.id === 'upstairs-table-room-door'
    );
    const isBedroomDoorOpen = !upstairs.doors.some(
      (d) => d.id === 'upstairs-bedroom-door'
    );
    const isOfficeDoorOpen = !upstairs.doors.some(
      (d) => d.id === 'upstairs-office-door'
    );

    // Diana's Present in Bedroom
    if (isBedroomDoorOpen && !state.player.states.get(DIANA_PRESENT_TAKEN_KEY)) {
      const pr = UPSTAIRS_DIANA_PRESENT_BOUNDS;
      const gx = pr.x + pr.width * 0.5;
      const gz = pr.y + pr.height * 0.5;
      translucent.addShadowDisc(gx, 0, gz, 5.5, 5.5, 0.3);
      opaque.addBeveledBox(gx, 0, gz, 8, 7, 8, 0.5, rgb(214, 40, 40), TexId.GIFT_WRAP, 0.7);
      opaque.addTorus(gx, 7.4, gz, 1.8, 0.55, 10, 6, 'x', rgb(255, 209, 102), TexId.SOLID, 0.4);
      opaque.addTorus(gx, 7.4, gz, 1.8, 0.55, 10, 6, 'z', rgb(255, 209, 102), TexId.SOLID, 0.4);
    }

    // Simon's Present in Office
    if (isOfficeDoorOpen && !state.player.states.get(SIMON_PRESENT_TAKEN_KEY)) {
      const pr = UPSTAIRS_SIMON_PRESENT_BOUNDS;
      const gx = pr.x + pr.width * 0.5;
      const gz = pr.y + pr.height * 0.5;
      translucent.addShadowDisc(gx, 0, gz, 5.5, 5.5, 0.3);
      opaque.addBeveledBox(gx, 0, gz, 8, 7, 8, 0.5, rgb(42, 117, 211), TexId.GIFT_WRAP, 0.7);
      opaque.addTorus(gx, 7.4, gz, 1.8, 0.55, 10, 6, 'x', rgb(255, 238, 84), TexId.SOLID, 0.4);
      opaque.addTorus(gx, 7.4, gz, 1.8, 0.55, 10, 6, 'z', rgb(255, 238, 84), TexId.SOLID, 0.4);
    }

    // Albin pacing in Dining Room
    addHumanoid3D(
      opaque,
      UPSTAIRS_ALBIN_X + 6,
      0,
      upstairs.albinY + 6,
      upstairs.albinDir === 1 ? Math.PI / 2 : -Math.PI / 2,
      t,
      true,
      {
        coat: hexToColor4('#285890'),
        trim: rgb(236, 240, 248),
        pants: rgb(42, 48, 62),
        skin: rgb(248, 206, 174),
        hair: hexToColor4('#7a421c'),
      },
      false,
      false,
      translucent
    );

    // Diana & Simon in Living Room
    const isDianaDistracted = Boolean(state.player.states.get(DIANA_DISTRACTED_KEY));
    addHumanoid3D(
      opaque,
      upstairs.dianaNpc.x + upstairs.dianaNpc.width * 0.5,
      0,
      upstairs.dianaNpc.y + upstairs.dianaNpc.height * 0.5,
      upstairs.dianaCone ? upstairs.dianaCone.direction : Math.PI / 2,
      t,
      false,
      {
        coat: hexToColor4('#3a6288'),
        trim: rgb(238, 242, 248),
        pants: rgb(44, 52, 68),
        skin: rgb(250, 208, 176),
        hair: hexToColor4('#2a1a14'),
        sitting: isDianaDistracted,
        hasPresentInLap: isDianaDistracted,
      },
      false,
      false,
      translucent
    );

    const isSimonDistracted = Boolean(state.player.states.get(SIMON_DISTRACTED_KEY));
    addHumanoid3D(
      opaque,
      upstairs.simonNpc.x + upstairs.simonNpc.width * 0.5,
      0,
      upstairs.simonNpc.y + upstairs.simonNpc.height * 0.5,
      upstairs.simonCone ? upstairs.simonCone.direction : Math.PI,
      t,
      false,
      {
        coat: hexToColor4('#647038'),
        trim: rgb(238, 242, 232),
        pants: rgb(44, 52, 68),
        skin: rgb(248, 204, 172),
        hair: hexToColor4('#583822'),
        sitting: isSimonDistracted,
        hasPresentInLap: isSimonDistracted,
      },
      false,
      false,
      translucent
    );

    // Henrik & Tanja in Table Room
    if (isTableRoomDoorOpen) {
      addHumanoid3D(
        opaque,
        upstairs.henrikNpc.x + upstairs.henrikNpc.width * 0.5,
        0,
        upstairs.henrikNpc.y + upstairs.henrikNpc.height * 0.5,
        upstairs.henrikCone ? upstairs.henrikCone.direction : Math.PI / 2,
        t,
        false,
        {
          coat: hexToColor4('#324a78'),
          trim: rgb(236, 240, 248),
          pants: rgb(42, 48, 62),
          skin: rgb(248, 206, 174),
          hair: hexToColor4('#6e4624'),
        },
        false,
        false,
        translucent
      );
      addHumanoid3D(
        opaque,
        upstairs.tanjaNpc.x + upstairs.tanjaNpc.width * 0.5,
        0,
        upstairs.tanjaNpc.y + upstairs.tanjaNpc.height * 0.5,
        upstairs.tanjaCone ? upstairs.tanjaCone.direction : -Math.PI / 2,
        t,
        false,
        {
          coat: hexToColor4('#783858'),
          trim: rgb(246, 236, 242),
          pants: rgb(44, 50, 64),
          skin: rgb(250, 208, 176),
          hair: hexToColor4('#743c20'),
        },
        false,
        false,
        translucent
      );
    }

    // Anne-Marie in Bedroom
    if (isBedroomDoorOpen) {
      addHumanoid3D(
        opaque,
        upstairs.anneMarieNpc.x + upstairs.anneMarieNpc.width * 0.5,
        0,
        upstairs.anneMarieNpc.y + upstairs.anneMarieNpc.height * 0.5,
        upstairs.anneMarieCone ? upstairs.anneMarieCone.direction : -Math.PI / 2,
        t,
        false,
        {
          coat: hexToColor4('#428860'),
          trim: rgb(238, 246, 240),
          pants: rgb(46, 52, 66),
          skin: rgb(250, 212, 182),
          hair: hexToColor4('#c88642'),
          holdingBook: true,
        },
        false,
        false,
        translucent
      );
    }

    addConeOfSight3D(translucent, upstairs.albinCone);
    addConeOfSight3D(translucent, upstairs.dianaCone);
    addConeOfSight3D(translucent, upstairs.simonCone);
    if (isTableRoomDoorOpen) {
      addConeOfSight3D(translucent, upstairs.henrikCone);
      addConeOfSight3D(translucent, upstairs.tanjaCone);
    }
    if (isBedroomDoorOpen) {
      addConeOfSight3D(translucent, upstairs.anneMarieCone);
    }

    for (const door of upstairs.doors) {
      addDoorAndFog3D(opaque, door);
    }
    for (const door of upstairs.openedDoors) {
      addOpenedDoor3D(opaque, door);
    }
  } else if (levelId === 'level-people') {
    const peopleLevel = state.levels['level-people'];
    for (const npc of peopleLevel.npcs) {
      const nx = npc.bounds.x + npc.bounds.width * 0.5;
      const nz = npc.bounds.y + npc.bounds.height * 0.5;
      addHumanoid3D(
        opaque,
        nx,
        0,
        nz,
        directionToYaw(npc.facing),
        t,
        false,
        {
          coat: hexToColor4(npc.shirtColor),
          trim: rgb(242, 244, 248),
          pants: rgb(44, 52, 68),
          skin: rgb(248, 206, 174),
          hair: hexToColor4(npc.hairColor),
          holdingClub: npc.name === 'Alex',
          holdingBook: npc.name === 'Anne-Marie',
        },
        false,
        false,
        translucent
      );
    }
  }

  // 3. Debug 3D Collision Bounding Boxes (?debug mode)
  if (state.debugMode) {
    translucent.addBox(
      state.player.x + state.player.width * 0.5,
      py,
      pz,
      state.player.width,
      2.2,
      state.player.height,
      rgb(64, 245, 128, 0.45),
      TexId.SOLID,
      0
    );
    for (const inter of state.interactables) {
      const ix = inter.bounds.x + inter.bounds.width * 0.5;
      const iz = inter.bounds.y + inter.bounds.height * 0.5;
      const iy = getTerrainHeight(ix, iz, levelId);
      translucent.addBox(
        ix,
        iy + 0.5,
        iz,
        inter.bounds.width,
        2.0,
        inter.bounds.height,
        rgb(255, 232, 64, 0.3),
        TexId.SOLID,
        0
      );
    }
  }

  return {
    opaque: opaque.build(),
    translucent: translucent.build(),
    pointLights,
  };
}
