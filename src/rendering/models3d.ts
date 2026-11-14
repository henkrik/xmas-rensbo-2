/**
 * 3D Mesh Builder & Procedural "Zelda: The Wind Waker" 3D Asset Models.
 *
 * Every world asset across all levels (Outside, Basement, Upstairs, People gallery)
 * is constructed here as 3D geometry with surface normals, UV coordinates, vertex colors,
 * procedural texture atlas IDs, and contour outline thickness (`outlineScale`).
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
import { CollidableDoor, LevelId } from '../world/levels/types';
import {
  DAMAGED_WIRE_HAZARD,
  GROUND_LADDER_BOUNDS,
  LADDER_BOTTOM_Y,
  LADDER_CLIMB_X,
  ROOF_CHIMNEY_BOUNDS,
  ROOF_WALK_Y,
  TILE_SIZE,
  TileMap,
  TileType,
} from '../world/tilemap';
import {
  directionToYaw,
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

export class MeshBuilder {
  private data: number[] = [];

  get vertexCount(): number {
    return this.data.length / FLOATS_PER_VERTEX;
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
    this.data.push(
      x,
      y,
      z,
      nx,
      ny,
      nz,
      u,
      v,
      color[0],
      color[1],
      color[2],
      color[3],
      texId,
      outlineScale
    );
  }

  addTriangle(
    p0: readonly [number, number, number],
    p1: readonly [number, number, number],
    p2: readonly [number, number, number],
    color: Color4,
    texId: number = TexId.SOLID,
    outlineScale = 0.7,
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
    outlineScale = 0.7,
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
    outlineScale = 0.75
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
    outlineScale = 0.65
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
    outlineScale = 0.7
  ): void {
    const topY = baseY + height;
    const slopeY = (radiusBottom - radiusTop) / (height || 1);

    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
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

      const u0 = i / segments;
      const u1 = (i + 1) / segments;

      this.pushVertex(b0[0], b0[1], b0[2], n0[0], n0[1], n0[2], u0, 1, color, texId, outlineScale);
      this.pushVertex(b1[0], b1[1], b1[2], n1[0], n1[1], n1[2], u1, 1, color, texId, outlineScale);
      this.pushVertex(t1[0], t1[1], t1[2], n1[0], n1[1], n1[2], u1, 0, color, texId, outlineScale);

      this.pushVertex(b0[0], b0[1], b0[2], n0[0], n0[1], n0[2], u0, 1, color, texId, outlineScale);
      this.pushVertex(t1[0], t1[1], t1[2], n1[0], n1[1], n1[2], u1, 0, color, texId, outlineScale);
      this.pushVertex(t0[0], t0[1], t0[2], n0[0], n0[1], n0[2], u0, 0, color, texId, outlineScale);

      if (radiusTop > 0.01) {
        this.pushVertex(cx, topY, cz, 0, 1, 0, 0.5, 0.5, color, texId, outlineScale);
        this.pushVertex(t0[0], t0[1], t0[2], n0[0], 0.8, n0[2], 0.5 + c0 * 0.5, 0.5 + s0 * 0.5, color, texId, outlineScale);
        this.pushVertex(t1[0], t1[1], t1[2], n1[0], 0.8, n1[2], 0.5 + c1 * 0.5, 0.5 + s1 * 0.5, color, texId, outlineScale);
      }
      if (radiusBottom > 0.01) {
        this.pushVertex(cx, baseY, cz, 0, -1, 0, 0.5, 0.5, color, texId, outlineScale);
        this.pushVertex(b1[0], b1[1], b1[2], n1[0], -0.8, n1[2], 0.5 + c1 * 0.5, 0.5 + s1 * 0.5, color, texId, outlineScale);
        this.pushVertex(b0[0], b0[1], b0[2], n0[0], -0.8, n0[2], 0.5 + c0 * 0.5, 0.5 + s0 * 0.5, color, texId, outlineScale);
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
    outlineScale = 0.75
  ): void {
    this.addCylinder(cx, baseY, cz, radius, 0.02, height, segments, color, texId, outlineScale);
  }

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
    outlineScale = 0.75
  ): void {
    for (let lat = 0; lat < latBands; lat++) {
      const theta0 = (lat / latBands) * Math.PI;
      const theta1 = ((lat + 1) / latBands) * Math.PI;
      const sinT0 = Math.sin(theta0);
      const cosT0 = Math.cos(theta0);
      const sinT1 = Math.sin(theta1);
      const cosT1 = Math.cos(theta1);

      for (let lon = 0; lon < lonBands; lon++) {
        const phi0 = (lon / lonBands) * Math.PI * 2;
        const phi1 = ((lon + 1) / lonBands) * Math.PI * 2;
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

        const u0 = lon / lonBands;
        const u1 = (lon + 1) / lonBands;
        const v0 = lat / latBands;
        const v1 = (lat + 1) / latBands;

        this.pushVertex(p00[0], p00[1], p00[2], n00[0], n00[1], n00[2], u0, v0, color, texId, outlineScale);
        this.pushVertex(p11[0], p11[1], p11[2], n11[0], n11[1], n11[2], u1, v1, color, texId, outlineScale);
        this.pushVertex(p10[0], p10[1], p10[2], n10[0], n10[1], n10[2], u0, v1, color, texId, outlineScale);

        this.pushVertex(p00[0], p00[1], p00[2], n00[0], n00[1], n00[2], u0, v0, color, texId, outlineScale);
        this.pushVertex(p01[0], p01[1], p01[2], n01[0], n01[1], n01[2], u1, v0, color, texId, outlineScale);
        this.pushVertex(p11[0], p11[1], p11[2], n11[0], n11[1], n11[2], u1, v1, color, texId, outlineScale);
      }
    }
  }

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
    outlineScale = 0.85
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
      this.addBox(cx, topY - 1.5, cz, w + 1.5, 2.2, 4.5, rgb(244, 249, 255), TexId.SNOW, 0.5);
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
      this.addBox(cx, topY - 1.5, cz, 4.5, 2.2, d + 1.5, rgb(244, 249, 255), TexId.SNOW, 0.5);
    }
  }

  build(): MeshData {
    const arr = new Float32Array(this.data);
    return {
      vertices: arr,
      vertexCount: arr.length / FLOATS_PER_VERTEX,
    };
  }
}

// ============================================================================
// 3D Trees, Rocks, and Foliage Models
// ============================================================================

function addPineTree3D(
  mb: MeshBuilder,
  cx: number,
  baseY: number,
  cz: number,
  variant: number,
  scale = 1.0
): void {
  if (variant === 0) {
    mb.addCylinder(cx, baseY, cz, 2.2 * scale, 1.5 * scale, 9 * scale, 7, rgb(92, 58, 33), TexId.WOOD_GRAIN, 0.65);
    mb.addCone(cx, baseY + 5 * scale, cz, 8.8 * scale, 11 * scale, 8, rgb(29, 92, 51), TexId.PINE_FOLIAGE, 0.8);
    mb.addCone(cx, baseY + 11 * scale, cz, 7.0 * scale, 10 * scale, 8, rgb(39, 117, 65), TexId.PINE_FOLIAGE, 0.8);
    mb.addCone(cx, baseY + 17 * scale, cz, 5.0 * scale, 9 * scale, 8, rgb(52, 138, 79), TexId.PINE_FOLIAGE, 0.8);
    mb.addCone(cx, baseY + 21.5 * scale, cz, 3.0 * scale, 5.2 * scale, 8, rgb(242, 248, 255), TexId.SNOW, 0.6);
  } else if (variant === 1) {
    addPineTree3D(mb, cx - 3.2 * scale, baseY, cz + 1.5 * scale, 0, 0.72 * scale);
    addPineTree3D(mb, cx + 3.2 * scale, baseY, cz - 1.2 * scale, 2, 0.85 * scale);
  } else if (variant === 2) {
    mb.addCylinder(cx, baseY, cz, 1.9 * scale, 1.3 * scale, 7 * scale, 6, rgb(84, 52, 30), TexId.WOOD_GRAIN, 0.65);
    mb.addCone(cx, baseY + 4 * scale, cz, 7.4 * scale, 14 * scale, 8, rgb(36, 108, 78), TexId.PINE_FOLIAGE, 0.8);
    mb.addCone(cx, baseY + 11 * scale, cz, 5.4 * scale, 12 * scale, 8, rgb(54, 134, 98), TexId.PINE_FOLIAGE, 0.8);
    mb.addCone(cx, baseY + 18 * scale, cz, 3.2 * scale, 6 * scale, 8, rgb(240, 248, 255), TexId.SNOW, 0.6);
  } else if (variant === 3) {
    // Tall crooked Scots pine
    mb.addCylinder(cx, baseY, cz, 2.1 * scale, 1.4 * scale, 18 * scale, 7, rgb(146, 78, 42), TexId.WOOD_GRAIN, 0.7);
    mb.addSphere(cx - 2 * scale, baseY + 18 * scale, cz, 6.2 * scale, 4.0 * scale, 6.2 * scale, 5, 7, rgb(34, 98, 52), TexId.PINE_FOLIAGE, 0.8);
    mb.addSphere(cx + 2.5 * scale, baseY + 20 * scale, cz - 1 * scale, 5.8 * scale, 3.8 * scale, 5.8 * scale, 5, 7, rgb(44, 118, 64), TexId.PINE_FOLIAGE, 0.8);
    mb.addSphere(cx, baseY + 22 * scale, cz, 5.2 * scale, 2.4 * scale, 5.2 * scale, 4, 7, rgb(242, 248, 255), TexId.SNOW, 0.6);
  } else {
    // Winter silver birch
    mb.addCylinder(cx, baseY, cz, 1.7 * scale, 1.1 * scale, 16 * scale, 7, rgb(242, 240, 236), TexId.BIRCH_BARK, 0.7);
    mb.addOrientedBox(cx - 2.5 * scale, baseY + 13 * scale, cz, 1.0 * scale, 7 * scale, 1.0 * scale, 0.3, 0.55, rgb(235, 232, 228), TexId.BIRCH_BARK, 0.55);
    mb.addOrientedBox(cx + 2.5 * scale, baseY + 14 * scale, cz, 1.0 * scale, 6.5 * scale, 1.0 * scale, -0.4, -0.5, rgb(235, 232, 228), TexId.BIRCH_BARK, 0.55);
    mb.addSphere(cx, baseY + 17.5 * scale, cz, 5.5 * scale, 4.2 * scale, 5.5 * scale, 5, 7, rgb(228, 238, 250), TexId.SNOW, 0.7);
  }
}

function addThujaTree3D(mb: MeshBuilder, cx: number, baseY: number, cz: number): void {
  mb.addCylinder(cx, baseY, cz, 1.5, 1.0, 4.5, 6, rgb(88, 56, 32), TexId.WOOD_GRAIN, 0.6);
  mb.addCone(cx, baseY + 3, cz, 5.2, 18, 8, rgb(42, 126, 68), TexId.PINE_FOLIAGE, 0.75);
  mb.addCone(cx, baseY + 14.5, cz, 2.5, 6.8, 8, rgb(240, 248, 255), TexId.SNOW, 0.55);
}

function addHedgeTile3D(mb: MeshBuilder, cx: number, baseY: number, cz: number): void {
  mb.addBox(cx, baseY, cz, 15.5, 8.5, 15.5, rgb(38, 112, 58), TexId.PINE_FOLIAGE, 0.75);
  mb.addBox(cx, baseY + 7.8, cz, 16.0, 2.2, 16.0, rgb(242, 248, 255), TexId.SNOW, 0.55);
}

function addGraniteCliff3D(mb: MeshBuilder, cx: number, baseY: number, cz: number, seed: number): void {
  const h = 14 + (seed % 5) * 3;
  const rx = 10 + (seed % 3) * 1.5;
  mb.addCylinder(cx, baseY - 2, cz, rx, rx * 0.7, h, 7, rgb(108, 116, 128), TexId.STONE_FLOOR, 0.85);
  mb.addSphere(cx, baseY + h - 2.2, cz, rx * 0.68, 2.5, rx * 0.68, 4, 7, rgb(242, 248, 255), TexId.SNOW, 0.6);
}

// ============================================================================
// Static Level 1: Outside (32x28 TileMap = 512x448 world units)
// ============================================================================

export function buildOutsideStaticMesh(map: TileMap): MeshBuilder {
  const mb = new MeshBuilder();
  const ts = map.tileSize; // 16

  // 1. Sloped Terrain Heightfield Mesh (subdivided into 8x8 world-unit cells)
  const step = 8;
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

      let color: Color4 = rgb(238, 245, 255);
      let texId: number = TexId.SNOW;
      let yOffset = 0;

      if (tile === TileType.Road || tile === TileType.ElectricCar || tile === TileType.Motorcycle) {
        color = rgb(166, 174, 188);
        texId = TexId.GRAVEL;
        yOffset = -0.25;
      }

      const y00 = getTerrainHeight(x0, z0, 'level-outside') + yOffset;
      const y10 = getTerrainHeight(x1, z0, 'level-outside') + yOffset;
      const y11 = getTerrainHeight(x1, z1, 'level-outside') + yOffset;
      const y01 = getTerrainHeight(x0, z1, 'level-outside') + yOffset;

      const n00 = getTerrainNormal(x0, z0, 'level-outside');
      const n10 = getTerrainNormal(x1, z0, 'level-outside');
      const n11 = getTerrainNormal(x1, z1, 'level-outside');
      const n01 = getTerrainNormal(x0, z1, 'level-outside');

      const u0 = (gx % 2) * 0.5;
      const u1 = u0 + 0.5;
      const v0 = (gz % 2) * 0.5;
      const v1 = v0 + 0.5;

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

  // 3. Main Villa House (cols 4..16 => x: 64..272, rows 3..9 => z: 48..160)
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

    // Stone foundation plinth
    mb.addBox(cx, baseY - 4, cz, w + 4, 6, d + 4, rgb(118, 122, 132), TexId.STONE_FLOOR, 0.85);

    // Main two-story cream-gold Swedish wooden facade
    const wallH = MAIN_HOUSE_WALL_HEIGHT; // 34
    mb.addBox(cx, baseY + 2, cz, w, wallH, d, rgb(246, 222, 166), TexId.HOUSE_SIDING, 1.0);

    // White corner trim posts
    for (const [tx, tz] of [
      [x0, z0],
      [x1, z0],
      [x0, z1],
      [x1, z1],
    ]) {
      mb.addBox(tx, baseY + 2, tz, 4.0, wallH + 0.5, 4.0, rgb(248, 248, 252), TexId.SOLID, 0.6);
    }

    // Pitched slate gable roof
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
      1.0
    );

    // Roof walk boardwalk along z = ROOF_WALK_Y + 6 (72) from col 4 to col 8
    const roofWalkY = baseY + MAIN_HOUSE_ROOF_WALK_HEIGHT;
    mb.addBox(96, roofWalkY - 1.5, ROOF_WALK_Y + 6, 76, 2.2, 14, rgb(242, 248, 255), TexId.SNOW, 0.55);

    // Red brick Chimney on the roof at ROOF_CHIMNEY_BOUNDS (x: 120..136, z: 58..76)
    const chimX = ROOF_CHIMNEY_BOUNDS.x + ROOF_CHIMNEY_BOUNDS.width * 0.5;
    const chimZ = ROOF_CHIMNEY_BOUNDS.y + ROOF_CHIMNEY_BOUNDS.height * 0.5;
    mb.addBox(chimX, roofWalkY - 4, chimZ, 16, 18, 16, rgb(188, 62, 48), TexId.BRICK_RED, 0.9);
    mb.addBox(chimX, roofWalkY + 13.5, chimZ, 18, 2.4, 18, rgb(245, 250, 255), TexId.SNOW, 0.6);
    mb.addBox(chimX, roofWalkY + 15.0, chimZ, 11, 1.2, 11, rgb(24, 20, 24), TexId.SOLID, 0);

    // Glowing Windows on South wall (cols 5..6 and 14..15)
    for (const winCol of [5.5, 14.5]) {
      const wx = (winCol + 0.5) * ts;
      mb.addBox(wx, baseY + 8, z1 + 0.5, 22, 10, 1.4, rgb(255, 228, 135), TexId.WINDOW_GLOW, 0.45);
      mb.addBox(wx, baseY + 22, z1 + 0.5, 22, 10, 1.4, rgb(255, 228, 135), TexId.WINDOW_GLOW, 0.45);
    }

    // Center Veranda / Glass Porch (cols 9..11 => x: 144..192, z: 160)
    mb.addBox(168, baseY, z1 + 5, 48, 4, 12, rgb(164, 114, 68), TexId.WOOD_FLOOR, 0.7);
    mb.addCylinder(148, baseY + 4, z1 + 9, 1.4, 1.4, 20, 6, rgb(248, 248, 252), TexId.SOLID, 0.55);
    mb.addCylinder(188, baseY + 4, z1 + 9, 1.4, 1.4, 20, 6, rgb(248, 248, 252), TexId.SOLID, 0.55);
    mb.addGableRoof(168, baseY + 24, z1 + 5, 52, 7, 14, false, rgb(62, 74, 94), rgb(246, 222, 166), TexId.ROOF_SLATE, 0.75);
    mb.addBox(168, baseY + 9, z1 + 0.6, 36, 12, 1.4, rgb(255, 232, 145), TexId.WINDOW_GLOW, 0.45);

    // Front Entrance Door at col 13, row 9 (x: 208..224, z: 160)
    const doorX = 13.5 * ts; // 216
    mb.addBox(doorX, baseY + 2, z1 + 0.6, 13, 18, 1.8, rgb(124, 64, 34), TexId.WOOD_GRAIN, 0.65);
    mb.addSphere(doorX, baseY + 13, z1 + 1.8, 3.0, 3.0, 0.9, 5, 7, rgb(36, 128, 56), TexId.PINE_FOLIAGE, 0.4);
  }

  // 4. Guest Cottage 1 ("Stuga 1", cols 19..22 => x: 304..368, rows 5..8 => z: 80..144)
  {
    const cx = 21 * ts; // 336
    const cz = 7 * ts; // 112
    const w = 4 * ts; // 64
    const d = 4 * ts; // 64
    const baseY = getTerrainHeight(cx, cz, 'level-outside');

    mb.addBox(cx, baseY - 3, cz, w + 2, 4, d + 2, rgb(118, 122, 132), TexId.STONE_FLOOR, 0.75);
    mb.addBox(cx, baseY + 1, cz, w, 20, d, rgb(172, 106, 58), TexId.LOG_WALL, 0.9);
    mb.addGableRoof(cx, baseY + 21, cz, w + 6, 12, d + 6, true, rgb(58, 68, 86), rgb(156, 94, 48), TexId.ROOF_SLATE, 0.9);
    mb.addBox(cx - 10, baseY + 1, cz + d * 0.5 + 0.5, 10, 15, 1.4, rgb(112, 62, 32), TexId.WOOD_GRAIN, 0.55);
    mb.addBox(cx + 12, baseY + 7, cz + d * 0.5 + 0.5, 12, 9, 1.4, rgb(255, 226, 130), TexId.WINDOW_GLOW, 0.4);
  }

  // 5. Guest Cottage 2 ("Stuga 2", cols 25..28 => x: 400..464, rows 5..8 => z: 80..144)
  {
    const cx = 27 * ts; // 432
    const cz = 7 * ts; // 112
    const w = 4 * ts; // 64
    const d = 4 * ts; // 64
    const baseY = getTerrainHeight(cx, cz, 'level-outside');

    mb.addBox(cx, baseY - 3, cz, w + 2, 4, d + 2, rgb(118, 122, 132), TexId.STONE_FLOOR, 0.75);
    mb.addBox(cx, baseY + 1, cz, w, 20, d, rgb(164, 98, 52), TexId.LOG_WALL, 0.9);
    mb.addGableRoof(cx, baseY + 21, cz, w + 6, 12, d + 6, true, rgb(58, 68, 86), rgb(148, 88, 44), TexId.ROOF_SLATE, 0.9);
    mb.addBox(cx - 10, baseY + 1, cz + d * 0.5 + 0.5, 10, 15, 1.4, rgb(112, 62, 32), TexId.WOOD_GRAIN, 0.55);
    mb.addBox(cx + 12, baseY + 7, cz + d * 0.5 + 0.5, 12, 9, 1.4, rgb(255, 226, 130), TexId.WINDOW_GLOW, 0.4);
  }

  // 6. White Shed with Red Double Doors (cols 25..29 => x: 400..480, rows 16..19 => z: 256..320)
  {
    const cx = 27.5 * ts; // 440
    const cz = 18 * ts; // 288
    const w = 5 * ts; // 80
    const d = 4 * ts; // 64
    const baseY = getTerrainHeight(cx, cz, 'level-outside');

    mb.addBox(cx, baseY - 2, cz, w + 2, 3, d + 2, rgb(114, 118, 126), TexId.STONE_FLOOR, 0.75);
    mb.addBox(cx, baseY + 1, cz, w, 18, d, rgb(236, 238, 244), TexId.HOUSE_SIDING, 0.9);
    mb.addGableRoof(cx, baseY + 19, cz, w + 5, 10, d + 5, true, rgb(64, 72, 86), rgb(224, 228, 236), TexId.ROOF_SLATE, 0.9);
    // Iconic bright red double doors on South wall
    mb.addBox(cx, baseY + 1, cz + d * 0.5 + 0.5, 24, 15, 1.5, rgb(214, 38, 38), TexId.WOOD_GRAIN, 0.7);
  }

  // 7. Blue Garage + EV Wallbox (cols 2..7 => x: 32..128, rows 21..25 => z: 336..416)
  {
    const cx = 5 * ts; // 80
    const cz = 23.5 * ts; // 376
    const w = 6 * ts; // 96
    const d = 5 * ts; // 80
    const baseY = getTerrainHeight(cx, cz, 'level-outside');

    mb.addBox(cx, baseY - 2, cz, w + 2, 3, d + 2, rgb(118, 122, 130), TexId.STONE_FLOOR, 0.75);
    mb.addBox(cx, baseY + 1, cz, w, 20, d, rgb(68, 124, 196), TexId.BLUE_SIDING, 0.9);
    mb.addGableRoof(cx, baseY + 21, cz, w + 6, 11, d + 6, true, rgb(54, 64, 82), rgb(58, 108, 176), TexId.ROOF_SLATE, 0.9);
    // EV Wallbox mounted on East wall of blue garage at col 7, row 22 (x: 128, z: 358)
    const wbY = getTerrainHeight(128, 358, 'level-outside');
    mb.addBox(129, wbY + 8, 358, 3.0, 6.5, 5.0, rgb(42, 48, 58), TexId.SOLID, 0.6);
    mb.addSphere(130.8, wbY + 12, 358, 0.8, 0.8, 0.8, 4, 5, rgb(64, 245, 128), TexId.SOLID, 0.25);
  }

  // 8. Electric Car & Charging Cable across row 22 (car at cols 17..19 => x: 272..320, rows 21..22 => z: 336..368)
  {
    const carX = 18.5 * ts; // 296
    const carZ = 22 * ts; // 352
    const baseY = getTerrainHeight(carX, carZ, 'level-outside');

    for (const [wx, wz] of [
      [-14, -9],
      [14, -9],
      [-14, 9],
      [14, 9],
    ]) {
      mb.addCylinder(carX + wx, baseY, carZ + wz, 3.6, 3.6, 3.6, 8, rgb(32, 34, 40), TexId.SOLID, 0.55);
    }
    mb.addBox(carX, baseY + 2.4, carZ, 44, 7.0, 22, rgb(44, 138, 158), TexId.SOLID, 0.85);
    mb.addBox(carX - 2, baseY + 9.0, carZ, 24, 6.0, 18, rgb(56, 158, 178), TexId.WINDOW_GLOW, 0.8);
    mb.addBox(carX - 2, baseY + 14.8, carZ, 22, 1.5, 16, rgb(242, 248, 255), TexId.SNOW, 0.5);

    // Charging cable running along row 22 (z = 358) from Wallbox (x = 128) to Car (x = 274)
    for (let segX = 132; segX < 272; segX += 12) {
      const cy = getTerrainHeight(segX, 358, 'level-outside');
      mb.addBox(segX + 6, cy + 0.5, 358, 12.5, 1.3, 1.6, rgb(28, 32, 38), TexId.SOLID, 0.45);
    }
    // Exposed copper hazard core at DAMAGED_WIRE_HAZARD
    const hx = DAMAGED_WIRE_HAZARD.x + DAMAGED_WIRE_HAZARD.width * 0.5;
    const hz = DAMAGED_WIRE_HAZARD.y + DAMAGED_WIRE_HAZARD.height * 0.5;
    const hy = getTerrainHeight(hx, hz, 'level-outside');
    mb.addBox(hx, hy + 0.7, hz, 8, 1.8, 2.8, rgb(235, 136, 42), TexId.SOLID, 0.55);
  }

  // 9. Outdoor Patio Table & Benches (cols 7..8 => x: 112..144, rows 14..15 => z: 224..256)
  {
    const px = 8 * ts; // 128
    const pz = 15 * ts; // 240
    const baseY = getTerrainHeight(px, pz, 'level-outside');
    mb.addBox(px, baseY, pz, 22, 6.0, 14, rgb(146, 94, 48), TexId.WOOD_GRAIN, 0.75);
    mb.addBox(px, baseY + 5.8, pz, 24, 1.4, 15, rgb(242, 248, 255), TexId.SNOW, 0.5);
    mb.addBox(px, baseY, pz - 10, 20, 3.5, 4, rgb(136, 86, 42), TexId.WOOD_GRAIN, 0.6);
    mb.addBox(px, baseY, pz + 10, 20, 3.5, 4, rgb(136, 86, 42), TexId.WOOD_GRAIN, 0.6);
  }

  return mb;
}

// ============================================================================
// Helper for Indoor Levels: Floor Tiles & Cutaway 3D Walls
// ============================================================================

function addIndoorTilesAndWalls(
  mb: MeshBuilder,
  map: TileMap,
  wallHeight = INDOOR_WALL_HEIGHT
): void {
  const ts = map.tileSize;
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const tile = map.tiles[r][c];
      if (tile === TileType.VoidBlack) continue;

      const cx = c * ts + ts * 0.5;
      const cz = r * ts + ts * 0.5;

      if (tile === TileType.InteriorWall) {
        // Keep southern-most wall lower so behind-the-back camera has unobstructed view when looking North
        const southTile = r + 1 < map.rows ? map.tiles[r + 1][c] : TileType.VoidBlack;
        const h = southTile === TileType.VoidBlack ? 9.0 : wallHeight;
        mb.addBox(cx, 0, cz, ts, h, ts, rgb(232, 222, 204), TexId.INTERIOR_WALL, 0.75);
        mb.addBox(cx, h, cz, ts + 0.3, 1.2, ts + 0.3, rgb(92, 62, 40), TexId.WOOD_GRAIN, 0.5);
      } else {
        let floorColor = rgb(194, 142, 88);
        let floorTex: number = TexId.WOOD_FLOOR;

        if (tile === TileType.StoneTileFloor) {
          floorColor = rgb(178, 166, 156);
          floorTex = TexId.STONE_FLOOR;
        } else if (tile === TileType.BathroomTileFloor) {
          floorColor = rgb(212, 236, 242);
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

// ============================================================================
// Static Level 2: Basement (32x28 TileMap)
// ============================================================================

export function buildBasementStaticMesh(map: TileMap): MeshBuilder {
  const mb = new MeshBuilder();
  const ts = map.tileSize; // 16
  addIndoorTilesAndWalls(mb, map, 16);

  // 1. Library Bookshelf on north wall (cols 7..12, row 7 => x: 112..208, z: 112..128)
  mb.addBox(10 * ts, 0, 7.5 * ts, 6 * ts, 16, 12, rgb(132, 82, 44), TexId.BOOKSHELF, 0.8);

  // 2. Stack of Firewood on east wall of library (col 12, rows 8..9 => x: 192..208, z: 128..160)
  mb.addBox(12.5 * ts, 0, 9 * ts, 14, 11, 2 * ts, rgb(148, 92, 48), TexId.LOG_WALL, 0.75);

  // 3. Library Couch on west wall (col 7, rows 9..11 => x: 112..128, z: 144..192)
  mb.addBox(7.5 * ts, 0, 10.5 * ts, 14, 5.5, 3 * ts, rgb(168, 152, 134), TexId.FABRIC, 0.75);
  mb.addBox(7.2 * ts, 5.2, 10.5 * ts, 4.5, 6.0, 3 * ts, rgb(148, 132, 114), TexId.FABRIC, 0.75);

  // 4. Red Brick Fireplace (cols 11..12, rows 11..12 => x: 176..208, z: 176..208)
  mb.addBox(12 * ts, 0, 12 * ts, 2 * ts, 19, 2 * ts, rgb(186, 62, 48), TexId.BRICK_RED, 0.85);
  mb.addBox(12 * ts, 18.5, 12 * ts, 2 * ts + 3, 2.2, 2 * ts + 3, rgb(112, 72, 42), TexId.WOOD_GRAIN, 0.7);
  // Hearth firebox opening facing West
  mb.addBox(11 * ts - 0.5, 1, 12 * ts, 1.5, 10, 16, rgb(28, 22, 22), TexId.SOLID, 0);

  // 5. Basement Living Room Couch (cols 8..10, row 14 => x: 128..176, z: 224..240)
  mb.addBox(9.5 * ts, 0, 14.5 * ts, 3 * ts, 5.5, 15, rgb(168, 152, 134), TexId.FABRIC, 0.75);
  mb.addBox(9.5 * ts, 5.2, 14.2 * ts, 3 * ts, 6.0, 4.5, rgb(148, 132, 114), TexId.FABRIC, 0.75);

  // 6. Chess Board Table (cols 8..9, row 17 => x: 128..160, z: 272..288)
  mb.addBox(9 * ts, 0, 17.5 * ts, 22, 6.2, 16, rgb(128, 78, 42), TexId.WOOD_GRAIN, 0.75);
  mb.addBox(9 * ts, 6.1, 17.5 * ts, 14, 0.8, 14, rgb(245, 236, 212), TexId.CHESSBOARD, 0.4);
  mb.addCone(9 * ts - 3, 6.9, 17.5 * ts - 3, 1.1, 3.0, 5, rgb(246, 214, 92), TexId.SOLID, 0.35);
  mb.addCone(9 * ts + 3, 6.9, 17.5 * ts + 3, 1.1, 3.0, 5, rgb(72, 76, 88), TexId.SOLID, 0.35);

  // 7. Extra Big South Windows (row 20, cols 7..9 & 10..12 => z: 320..336)
  mb.addBox(8.5 * ts, 3, 20.2 * ts, 2.6 * ts, 8, 2, rgb(255, 228, 138), TexId.WINDOW_GLOW, 0.45);
  mb.addBox(11.5 * ts, 3, 20.2 * ts, 2.6 * ts, 8, 2, rgb(255, 228, 138), TexId.WINDOW_GLOW, 0.45);

  // 8. Hallway Coat Hangers (col 14, rows 17..18 => x: 224..240, z: 272..304)
  mb.addCylinder(14.5 * ts, 0, 18 * ts, 3.5, 1.0, 14, 6, rgb(104, 64, 34), TexId.WOOD_GRAIN, 0.65);
  mb.addSphere(14.5 * ts, 10.5, 18 * ts, 3.6, 4.0, 3.6, 4, 6, rgb(186, 48, 48), TexId.FABRIC, 0.55);

  // 9. Locked North Door (cols 15..16, row 12) & Locked Front Door (cols 15..16, row 20)
  mb.addBox(16 * ts, 0, 12.5 * ts, 2 * ts, 15, 6, rgb(124, 68, 34), TexId.WOOD_GRAIN, 0.7);
  mb.addBox(16 * ts, 0, 20.5 * ts, 2 * ts, 11, 6, rgb(124, 68, 34), TexId.WOOD_GRAIN, 0.7);

  // 10. Basement Staircase ascending Eastward (cols 18..21, rows 15..18 => x: 288..352, z: 240..304)
  for (let s = 0; s < 8; s++) {
    const sx = 18 * ts + s * 8 + 4;
    const sh = (s + 1) * 1.6;
    mb.addBox(sx, 0, 17 * ts, 8.2, sh, 4 * ts - 4, rgb(168, 116, 68), TexId.WOOD_GRAIN, 0.65);
  }

  // 11. Bathroom Sink (col 19, rows 9..10) & Toilet (col 21, row 9)
  mb.addBox(19.5 * ts, 0, 10 * ts, 13, 7.5, 22, rgb(242, 246, 252), TexId.SOLID, 0.7);
  mb.addBox(21.7 * ts, 0, 9.5 * ts, 5, 10.5, 10, rgb(246, 250, 255), TexId.SOLID, 0.7);
  mb.addCylinder(21.3 * ts, 0, 9.5 * ts, 4.4, 4.8, 5.5, 8, rgb(246, 250, 255), TexId.SOLID, 0.7);

  return mb;
}

// ============================================================================
// Static Level 3: Upstairs (32x28 TileMap)
// ============================================================================

export function buildUpstairsStaticMesh(map: TileMap): MeshBuilder {
  const mb = new MeshBuilder();
  const ts = map.tileSize; // 16
  addIndoorTilesAndWalls(mb, map, 16);

  // 1. Dining Room Cupboard (col 2, rows 6..7 => x: 32..48, z: 96..128)
  mb.addBox(2.5 * ts, 0, 7 * ts, 14, 15, 2 * ts, rgb(134, 82, 42), TexId.WOOD_GRAIN, 0.8);

  // 2. Long Wooden Dining Table (cols 4..5, rows 6..9 => x: 64..96, z: 96..160)
  mb.addBox(5 * ts, 0, 8 * ts, 2 * ts - 2, 6.8, 4 * ts - 4, rgb(148, 92, 48), TexId.WOOD_GRAIN, 0.8);
  mb.addBox(5 * ts, 6.7, 8 * ts, 10, 0.5, 4 * ts - 10, rgb(248, 244, 240), TexId.FABRIC, 0.35);

  // 3. Kitchen Island (cols 10..11, rows 6..7), Stove/Sink on East Wall (col 15, rows 5..8), Altar (cols 10..11, row 10)
  mb.addBox(11 * ts, 0, 7 * ts, 2 * ts - 2, 8.2, 2 * ts - 2, rgb(232, 228, 218), TexId.SOLID, 0.75);
  mb.addBox(11 * ts, 8.0, 7 * ts, 2 * ts, 1.4, 2 * ts, rgb(168, 114, 66), TexId.WOOD_GRAIN, 0.65);
  mb.addBox(15.5 * ts, 0, 7 * ts, 14, 8.5, 4 * ts - 2, rgb(224, 228, 234), TexId.SOLID, 0.75);
  // Altar
  mb.addBox(11 * ts, 0, 10.5 * ts, 2 * ts - 2, 10, 14, rgb(138, 44, 44), TexId.WOOD_GRAIN, 0.75);
  mb.addCylinder(10.5 * ts, 10, 10.5 * ts, 1.1, 1.1, 3.8, 6, rgb(255, 224, 110), TexId.SOLID, 0.35);
  mb.addCylinder(11.5 * ts, 10, 10.5 * ts, 1.1, 1.1, 3.8, 6, rgb(255, 224, 110), TexId.SOLID, 0.35);

  // 4. Living Room Colorful Couch (cols 4..6, row 11) & Armchairs (col 2, row 12 & col 7, row 13)
  mb.addBox(5.5 * ts, 0, 11.5 * ts, 3 * ts - 2, 5.8, 15, rgb(214, 84, 58), TexId.FABRIC, 0.8);
  mb.addBox(5.5 * ts, 5.5, 11.2 * ts, 3 * ts - 2, 6.2, 4.5, rgb(64, 134, 188), TexId.FABRIC, 0.8);
  mb.addBox(2.5 * ts, 0, 12.5 * ts, 14, 7.5, 14, rgb(236, 178, 52), TexId.FABRIC, 0.75);
  mb.addBox(7.5 * ts, 0, 13.5 * ts, 14, 7.5, 14, rgb(68, 156, 124), TexId.FABRIC, 0.75);

  // 5. THE CHRISTMAS TREE! (cols 2..3, rows 14..16 => x: 32..64, z: 224..272)
  {
    const tx = 3 * ts; // 48
    const tz = 15.5 * ts; // 248
    mb.addCylinder(tx, 0.2, tz, 14, 13.5, 0.9, 12, rgb(198, 36, 42), TexId.FABRIC, 0.45);
    mb.addCylinder(tx, 0.9, tz, 2.8, 2.0, 9, 7, rgb(96, 58, 32), TexId.WOOD_GRAIN, 0.65);
    mb.addCone(tx, 6.0, tz, 13.0, 11.5, 10, rgb(26, 108, 48), TexId.PINE_FOLIAGE, 0.85);
    mb.addCone(tx, 12.5, tz, 10.4, 10.5, 10, rgb(34, 128, 58), TexId.PINE_FOLIAGE, 0.85);
    mb.addCone(tx, 18.5, tz, 7.6, 9.5, 10, rgb(44, 146, 68), TexId.PINE_FOLIAGE, 0.85);
    mb.addCone(tx, 24.0, tz, 4.8, 7.5, 10, rgb(54, 162, 78), TexId.PINE_FOLIAGE, 0.85);

    const ornamentPalette: Color4[] = [
      rgb(238, 44, 48),
      rgb(252, 212, 62),
      rgb(56, 152, 245),
      rgb(236, 92, 214),
    ];
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const tier = i % 3;
      const rad = tier === 0 ? 10.2 : tier === 1 ? 8.0 : 5.4;
      const oy = tier === 0 ? 8.5 : tier === 1 ? 15.0 : 21.0;
      mb.addSphere(
        tx + Math.cos(ang) * rad,
        oy,
        tz + Math.sin(ang) * rad,
        1.45,
        1.45,
        1.45,
        4,
        6,
        ornamentPalette[i % ornamentPalette.length],
        TexId.SOLID,
        0.4
      );
    }

    // Glowing Golden Star at the top of the Christmas Tree
    mb.addSphere(tx, 32.2, tz, 3.0, 3.0, 1.5, 5, 8, rgb(255, 232, 75), TexId.SOLID, 0.65);
    mb.addOrientedBox(tx, 32.2, tz, 5.6, 5.6, 1.5, 0, Math.PI * 0.25, rgb(255, 238, 95), TexId.SOLID, 0.55);

    // Presents under the tree
    mb.addBox(tx - 8, 0.8, tz + 8, 6, 5, 6, rgb(218, 44, 48), TexId.GIFT_WRAP, 0.6);
    mb.addBox(tx + 7, 0.8, tz + 8, 5.5, 4.5, 5.5, rgb(48, 128, 214), TexId.GIFT_WRAP, 0.6);
  }

  // 6. Table Room Second Table (cols 11..12, rows 17..18 => x: 176..208, z: 272..304)
  mb.addBox(12 * ts, 0, 18 * ts, 2 * ts - 2, 6.8, 2 * ts - 2, rgb(148, 92, 48), TexId.WOOD_GRAIN, 0.75);

  // 7. Shower Sink (col 17, rows 7..8) & Toilet (col 19, row 8)
  mb.addBox(17.5 * ts, 0, 8 * ts, 13, 7.5, 22, rgb(242, 246, 252), TexId.SOLID, 0.7);
  mb.addCylinder(19.5 * ts, 0, 8.5 * ts, 4.4, 4.8, 5.5, 8, rgb(246, 250, 255), TexId.SOLID, 0.7);

  // 8. Bedroom Double Bed (cols 26..27, rows 6..7 => x: 416..448, z: 96..128)
  mb.addBox(27 * ts, 0, 7 * ts, 2 * ts - 2, 5.5, 2 * ts - 2, rgb(132, 82, 42), TexId.WOOD_GRAIN, 0.75);
  mb.addBox(27 * ts, 5.2, 7 * ts, 2 * ts - 4, 2.2, 2 * ts - 4, rgb(198, 52, 58), TexId.FABRIC, 0.55);

  // 9. Office Desks & Computer (cols 20..22, rows 15..17 => x: 320..368, z: 240..288)
  mb.addBox(21.5 * ts, 0, 16.5 * ts, 3 * ts - 4, 6.8, 2 * ts - 2, rgb(142, 90, 48), TexId.WOOD_GRAIN, 0.75);
  mb.addBox(21.5 * ts, 6.8, 16.5 * ts, 9.5, 7.0, 2.0, rgb(42, 46, 56), TexId.WINDOW_GLOW, 0.55);

  return mb;
}

// ============================================================================
// Static Level 4: People Showcase Gallery
// ============================================================================

export function buildPeopleStaticMesh(map: TileMap): MeshBuilder {
  const mb = new MeshBuilder();
  addIndoorTilesAndWalls(mb, map, 15);
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
// 3D Articulated Character Models (Santa, 11 NPCs, Dog, Cat, Props)
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
  carryingLadder = false
): void {
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const fx = cyaw;
  const fz = syaw;
  const rx = -syaw;
  const rz = cyaw;

  const swing = isMoving ? Math.sin(walkPhase * 11) * 0.55 : 0;
  const bob = isMoving ? Math.abs(Math.sin(walkPhase * 11)) * 0.8 : 0;
  const y0 = baseY + bob;

  // Boots & Legs
  const legSpread = 1.65;
  const legSwingDist = style.sitting ? 1.8 : Math.sin(swing) * 1.8;
  mb.addOrientedBox(
    cx + rx * legSpread + fx * legSwingDist,
    y0 + 2.2,
    cz + rz * legSpread + fz * legSwingDist,
    2.4,
    4.4,
    2.4,
    yaw,
    style.sitting ? 0.9 : swing,
    style.pants,
    TexId.SOLID,
    0.75
  );
  mb.addOrientedBox(
    cx - rx * legSpread - fx * legSwingDist,
    y0 + 2.2,
    cz - rz * legSpread - fz * legSwingDist,
    2.4,
    4.4,
    2.4,
    yaw,
    style.sitting ? 0.9 : -swing,
    style.pants,
    TexId.SOLID,
    0.75
  );

  // Torso / Coat
  mb.addCylinder(cx, y0 + 3.8, cz, 4.2, 3.4, 6.8, 8, style.coat, TexId.FABRIC, 0.85);

  if (isSanta) {
    mb.addCylinder(cx, y0 + 3.6, cz, 4.45, 4.35, 1.4, 8, style.trim, TexId.SNOW, 0.5);
    mb.addCylinder(cx, y0 + 5.8, cz, 4.05, 3.95, 1.3, 8, rgb(32, 32, 38), TexId.SOLID, 0.45);
    mb.addOrientedBox(
      cx + fx * 3.9,
      y0 + 6.4,
      cz + fz * 3.9,
      0.8,
      1.5,
      1.8,
      yaw,
      0,
      rgb(250, 212, 64),
      TexId.SOLID,
      0.35
    );
  }

  // Arms
  const armSpread = 4.4;
  mb.addOrientedBox(
    cx + rx * armSpread - fx * legSwingDist * 0.7,
    y0 + 7.5,
    cz + rz * armSpread - fz * legSwingDist * 0.7,
    2.1,
    5.0,
    2.1,
    yaw,
    -swing * 0.9,
    style.coat,
    TexId.FABRIC,
    0.7
  );
  mb.addOrientedBox(
    cx - rx * armSpread + fx * legSwingDist * 0.7,
    y0 + 7.5,
    cz - rz * armSpread + fz * legSwingDist * 0.7,
    2.1,
    5.0,
    2.1,
    yaw,
    swing * 0.9,
    style.coat,
    TexId.FABRIC,
    0.7
  );

  // Expressive Wind Waker Cartoon Head
  const headY = y0 + 13.0;
  mb.addSphere(cx, headY, cz, 3.6, 3.5, 3.6, 6, 8, style.skin, TexId.SOLID, 0.85);

  const eyeForward = 3.25;
  const eyeSpread = 1.25;
  mb.addSphere(
    cx + fx * eyeForward + rx * eyeSpread,
    headY + 0.4,
    cz + fz * eyeForward + rz * eyeSpread,
    0.58,
    0.72,
    0.58,
    4,
    5,
    rgb(24, 28, 38),
    TexId.SOLID,
    0.2
  );
  mb.addSphere(
    cx + fx * eyeForward - rx * eyeSpread,
    headY + 0.4,
    cz + fz * eyeForward - rz * eyeSpread,
    0.58,
    0.72,
    0.58,
    4,
    5,
    rgb(24, 28, 38),
    TexId.SOLID,
    0.2
  );

  if (style.hasBeard || isSanta) {
    mb.addSphere(
      cx + fx * 2.2,
      headY - 1.5,
      cz + fz * 2.2,
      3.1,
      2.6,
      2.6,
      5,
      7,
      rgb(250, 252, 255),
      TexId.SNOW,
      0.7
    );
  }

  if (style.hat || isSanta) {
    const hatColor = style.hat ?? rgb(220, 36, 42);
    mb.addCylinder(cx, headY + 2.0, cz, 3.9, 3.8, 1.4, 8, style.trim, TexId.SNOW, 0.65);
    mb.addCone(cx - fx * 0.6, headY + 3.2, cz - fz * 0.6, 3.5, 5.8, 8, hatColor, TexId.FABRIC, 0.8);
    mb.addSphere(
      cx - fx * 1.8,
      headY + 8.6,
      cz - fz * 1.8,
      1.45,
      1.45,
      1.45,
      5,
      6,
      rgb(252, 254, 255),
      TexId.SNOW,
      0.65
    );
  } else {
    mb.addSphere(cx, headY + 1.2, cz, 3.75, 2.8, 3.75, 5, 8, style.hair, TexId.SOLID, 0.75);
  }

  if (style.holdingClub) {
    mb.addOrientedBox(
      cx + fx * 4.5 + rx * 2.5,
      y0 + 4.5,
      cz + fz * 4.5 + rz * 2.5,
      0.8,
      9.0,
      0.8,
      yaw,
      0.35,
      rgb(212, 218, 228),
      TexId.SOLID,
      0.5
    );
  }

  if (style.holdingBook) {
    mb.addOrientedBox(
      cx + fx * 4.2,
      y0 + 7.2,
      cz + fz * 4.2,
      3.0,
      2.4,
      3.8,
      yaw,
      0.4,
      rgb(192, 48, 52),
      TexId.BOOKSHELF,
      0.5
    );
  }

  if (style.hasPresentInLap) {
    mb.addBox(
      cx + fx * 4.2,
      y0 + 5.0,
      cz + fz * 4.2,
      5.2,
      4.6,
      5.2,
      rgb(220, 42, 48),
      TexId.GIFT_WRAP,
      0.65
    );
  }

  if (carryingLadder) {
    mb.addOrientedBox(
      cx - fx * 3.2,
      y0 + 8.5,
      cz - fz * 3.2,
      1.4,
      12.0,
      5.2,
      yaw,
      0.2,
      rgb(168, 112, 58),
      TexId.WOOD_GRAIN,
      0.65
    );
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
    mb.addBox(cx - 2.6, baseY, cz, 1.4, height, 1.4, wood, TexId.WOOD_GRAIN, 0.7);
    mb.addBox(cx + 2.6, baseY, cz, 1.4, height, 1.4, wood, TexId.WOOD_GRAIN, 0.7);
    const rungs = 8;
    for (let i = 0; i < rungs; i++) {
      const ry = baseY + 3 + (i / (rungs - 1)) * (height - 5);
      mb.addBox(cx, ry, cz, 5.8, 1.1, 1.2, wood, TexId.WOOD_GRAIN, 0.55);
    }
  } else {
    mb.addBox(cx, baseY + 0.6, cz - 2.5, 24, 1.5, 1.4, wood, TexId.WOOD_GRAIN, 0.65);
    mb.addBox(cx, baseY + 0.6, cz + 2.5, 24, 1.5, 1.4, wood, TexId.WOOD_GRAIN, 0.65);
    for (let i = -9; i <= 9; i += 3.6) {
      mb.addBox(cx + i, baseY + 0.8, cz, 1.2, 1.3, 5.6, wood, TexId.WOOD_GRAIN, 0.55);
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
  const yaw = directionToYaw(dog.facing);
  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const fx = cyaw;
  const fz = syaw;
  const rx = -syaw;
  const rz = cyaw;

  const isRunning = dog.mode === 'chasing' || Math.hypot(dog.vx, dog.vy) > 2;
  const legBounce = isRunning ? Math.sin(elapsedTime * 16) * 1.2 : 0;
  const bodyColor = rgb(198, 134, 68);
  const earColor = rgb(128, 76, 34);

  for (const [fSign, rSign] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    mb.addBox(
      cx + fx * fSign * 3.0 + rx * rSign * 1.8,
      baseY + Math.max(0, fSign * legBounce * 0.4),
      cz + fz * fSign * 3.0 + rz * rSign * 1.8,
      1.6,
      3.2,
      1.6,
      bodyColor,
      TexId.SOLID,
      0.6
    );
  }

  mb.addOrientedBox(cx, baseY + 4.0, cz, 8.2, 3.8, 4.4, yaw, 0, bodyColor, TexId.FABRIC, 0.75);
  mb.addOrientedBox(cx + fx * 3.2, baseY + 4.8, cz + fz * 3.2, 1.4, 4.2, 4.6, yaw, 0, rgb(220, 38, 42), TexId.SOLID, 0.5);
  mb.addSphere(cx + fx * 4.6, baseY + 6.8, cz + fz * 4.6, 2.8, 2.6, 2.8, 5, 7, bodyColor, TexId.SOLID, 0.75);
  mb.addSphere(cx + fx * 6.8, baseY + 6.2, cz + fz * 6.8, 1.5, 1.2, 1.5, 4, 5, earColor, TexId.SOLID, 0.55);
  mb.addSphere(cx + fx * 4.2 + rx * 2.6, baseY + 6.2, cz + fz * 4.2 + rz * 2.6, 1.0, 2.2, 1.2, 4, 5, earColor, TexId.SOLID, 0.55);
  mb.addSphere(cx + fx * 4.2 - rx * 2.6, baseY + 6.2, cz + fz * 4.2 - rz * 2.6, 1.0, 2.2, 1.2, 4, 5, earColor, TexId.SOLID, 0.55);

  const wag = Math.sin(elapsedTime * 18) * 1.4;
  mb.addOrientedBox(
    cx - fx * 4.6 + rx * wag,
    baseY + 5.8,
    cz - fz * 4.6 + rz * wag,
    3.2,
    1.2,
    1.2,
    yaw,
    0.55,
    earColor,
    TexId.SOLID,
    0.55
  );

  if (dog.mode === 'chasing' || dog.hearts.length > 0) {
    const hy = baseY + 12.5 + Math.sin(elapsedTime * 6) * 1.2;
    translucentMb.addSphere(cx - 1.1, hy, cz, 1.5, 1.5, 1.2, 4, 6, rgb(245, 48, 78, 0.92), TexId.SOLID, 0.45);
    translucentMb.addSphere(cx + 1.1, hy, cz, 1.5, 1.5, 1.2, 4, 6, rgb(245, 48, 78, 0.92), TexId.SOLID, 0.45);
    translucentMb.addCone(cx, hy - 2.4, cz, 2.2, 2.6, 6, rgb(245, 48, 78, 0.92), TexId.SOLID, 0.45);
  }
}

function addCat3D(mb: MeshBuilder, cat: Cat): void {
  const cx = cat.x + cat.width * 0.5;
  const cz = cat.y + cat.height * 0.5;
  const catBlack = rgb(28, 30, 38);

  mb.addCylinder(cx, 0, cz, 3.0, 2.4, 5.2, 7, catBlack, TexId.SOLID, 0.75);
  mb.addSphere(cx, 6.5, cz + 1.0, 2.5, 2.3, 2.5, 5, 7, catBlack, TexId.SOLID, 0.75);
  mb.addCone(cx - 1.5, 8.2, cz + 1.0, 0.9, 2.2, 4, catBlack, TexId.SOLID, 0.55);
  mb.addCone(cx + 1.5, 8.2, cz + 1.0, 0.9, 2.2, 4, catBlack, TexId.SOLID, 0.55);
  mb.addSphere(cx - 0.9, 6.8, cz + 3.2, 0.45, 0.45, 0.45, 4, 4, rgb(84, 245, 112), TexId.SOLID, 0.2);
  mb.addSphere(cx + 0.9, 6.8, cz + 3.2, 0.45, 0.45, 0.45, 4, 4, rgb(84, 245, 112), TexId.SOLID, 0.2);
}

function addMotorcycle3D(
  mb: MeshBuilder,
  motorcycle: MotorcycleState,
  elapsedTime: number
): void {
  const cx = motorcycle.x + motorcycle.width * 0.5;
  const cz = motorcycle.y + motorcycle.height * 0.5;
  const baseY = getTerrainHeight(cx, cz, 'level-outside');

  if (motorcycle.status === 'crashed') {
    mb.addOrientedBox(cx, baseY + 2.5, cz, 18, 3.8, 7.0, 0.4, 1.1, rgb(42, 46, 56), TexId.SOLID, 0.75);
    for (let i = 0; i < 3; i++) {
      const p = (elapsedTime * 0.9 + i * 0.33) % 1;
      mb.addSphere(
        cx + Math.sin(elapsedTime * 3 + i) * 2.5,
        baseY + 5 + p * 14,
        cz,
        2.0 + p * 2.5,
        1.8 + p * 2.0,
        2.0 + p * 2.5,
        4,
        6,
        rgb(168, 174, 184),
        TexId.SOLID,
        0.4
      );
    }
    return;
  }

  mb.addCylinder(cx - 6.5, baseY, cz, 3.5, 3.5, 2.4, 8, rgb(28, 30, 36), TexId.SOLID, 0.65);
  mb.addCylinder(cx + 6.5, baseY, cz, 3.5, 3.5, 2.4, 8, rgb(28, 30, 36), TexId.SOLID, 0.65);
  mb.addBox(cx, baseY + 3.0, cz, 14, 4.0, 4.0, rgb(46, 52, 64), TexId.SOLID, 0.75);
  mb.addBox(cx + 5.0, baseY + 6.5, cz, 1.5, 3.5, 7.5, rgb(192, 198, 210), TexId.SOLID, 0.55);
  mb.addSphere(cx + 6.8, baseY + 6.8, cz, 1.5, 1.5, 1.5, 4, 5, rgb(255, 242, 156), TexId.SOLID, 0.35);
}

function addConeOfSight3D(translucentMb: MeshBuilder, cone: ConeOfSight | null | undefined): void {
  if (!cone || cone.sightPolygon.length < 3) return;
  const poly = cone.sightPolygon;
  const ox = poly[0].x;
  const oz = poly[0].y;
  const y = 0.42;
  const beamColor = ConeOfSight.cheatMode
    ? rgb(82, 224, 128, 0.28)
    : rgb(255, 232, 92, 0.32);
  const edgeColor = ConeOfSight.cheatMode
    ? rgb(82, 245, 140, 0.62)
    : rgb(255, 112, 48, 0.68);

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
      [p2.x, y + 1.5, p2.y],
      [p1.x, y + 1.5, p1.y],
      [0, 1, 0],
      edgeColor,
      TexId.SOLID,
      0
    );
  }
}

function addDoorAndFog3D(opaqueMb: MeshBuilder, door: CollidableDoor): void {
  const b = door.bounds;
  opaqueMb.addBox(
    b.x + b.width * 0.5,
    0,
    b.y + b.height * 0.5,
    b.width,
    15.5,
    b.height,
    rgb(132, 78, 40),
    TexId.WOOD_GRAIN,
    0.8
  );
  // Brass doorknob
  opaqueMb.addSphere(
    b.x + b.width * 0.75,
    7.5,
    b.y + b.height * 0.5 + 2.5,
    1.0,
    1.0,
    1.0,
    4,
    5,
    rgb(248, 212, 72),
    TexId.SOLID,
    0.35
  );

  for (const hr of door.hiddenRegions) {
    opaqueMb.addBox(
      hr.x + hr.width * 0.5,
      0.2,
      hr.y + hr.height * 0.5,
      hr.width,
      16.8,
      hr.height,
      rgb(12, 14, 22),
      TexId.SOLID,
      0
    );
  }
}

function addExclamationBadge3D(opaqueMb: MeshBuilder, cx: number, baseY: number, cz: number): void {
  const ay = baseY + 19;
  opaqueMb.addBox(cx - 1.5, ay + 2.5, cz, 1.5, 5.2, 1.5, rgb(255, 42, 42), TexId.SOLID, 0.55);
  opaqueMb.addSphere(cx - 1.5, ay + 0.8, cz, 0.9, 0.9, 0.9, 4, 5, rgb(255, 42, 42), TexId.SOLID, 0.45);
  opaqueMb.addBox(cx + 1.5, ay + 2.5, cz, 1.5, 5.2, 1.5, rgb(255, 42, 42), TexId.SOLID, 0.55);
  opaqueMb.addSphere(cx + 1.5, ay + 0.8, cz, 0.9, 0.9, 0.9, 4, 5, rgb(255, 42, 42), TexId.SOLID, 0.45);
}

// ============================================================================
// Dynamic Scene Builder (Per-Frame Entities, Doors, Lights, Particles)
// ============================================================================

export function buildDynamicSceneMeshes(state: GameState): DynamicSceneMeshes {
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
    state.isOnRoof && levelId === 'level-outside'
      ? ROOF_WALK_Y + state.player.height * 0.5
      : state.player.y + state.player.height * 0.5;
  const py = getPlayerElevation(state);
  const playerYaw =
    typeof state.player.yaw === 'number'
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

    addHumanoid3D(
      opaque,
      px,
      py,
      pz,
      playerYaw,
      state.player.walkTimer,
      state.player.isMoving,
      santaStyle,
      true,
      state.hasLadder && !state.ladderPlaced
    );
  }

  // 2. Level-specific dynamic entities & lighting
  if (levelId === 'level-outside') {
    const outside = state.levels['level-outside'];

    // Footprints in snow
    for (const fp of state.footprints) {
      const alpha = Math.max(0, 1 - fp.age / fp.maxAge) * 0.65;
      const fy = getTerrainHeight(fp.x, fp.y, 'level-outside') + 0.15;
      translucent.addBox(fp.x, fy, fp.y, 2.2, 0.3, 2.8, rgb(138, 162, 198, alpha), TexId.SOLID, 0);
    }

    // Ladder (on ground at GROUND_LADDER_BOUNDS or placed on west wall of main house)
    if (!state.hasLadder && !state.ladderPlaced) {
      const lx = GROUND_LADDER_BOUNDS.x + GROUND_LADDER_BOUNDS.width * 0.5;
      const lz = GROUND_LADDER_BOUNDS.y + GROUND_LADDER_BOUNDS.height * 0.5;
      const ly = getTerrainHeight(lx, lz, 'level-outside');
      addWoodenLadder3D(opaque, lx, ly, lz, 24, false);
    } else if (state.ladderPlaced) {
      const lx = LADDER_CLIMB_X + 6;
      const lz = LADDER_BOTTOM_Y;
      const ly = getTerrainHeight(lx, lz, 'level-outside');
      const houseGroundY = getTerrainHeight(5 * TILE_SIZE, 9 * TILE_SIZE, 'level-outside');
      const roofY = houseGroundY + MAIN_HOUSE_ROOF_WALK_HEIGHT;
      addWoodenLadder3D(opaque, lx, ly, lz - 4, roofY - ly + 2, true);
    }

    // Motorcycle
    addMotorcycle3D(opaque, state.motorcycle, t);

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
        }
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
      addHumanoid3D(opaque, tx, ty, tz, throwYaw, isThrowing ? t * 2 : 0, isThrowing, style);
    });

    // Flying Snowballs
    for (const sb of state.snowballs) {
      const sx = sb.x + sb.width * 0.5;
      const sz = sb.y + sb.height * 0.5;
      const sy = getTerrainHeight(sx, sz, 'level-outside') + 7.5;
      opaque.addSphere(sx, sy, sz, 3.2, 3.2, 3.2, 5, 7, rgb(248, 252, 255), TexId.SNOW, 0.65);
    }

    // Chimney Smoke Puffs rising from the main house chimney
    const houseGroundY = getTerrainHeight(5 * TILE_SIZE, 9 * TILE_SIZE, 'level-outside');
    const chimTopY = houseGroundY + MAIN_HOUSE_ROOF_WALK_HEIGHT + 14;
    const chimX = ROOF_CHIMNEY_BOUNDS.x + ROOF_CHIMNEY_BOUNDS.width * 0.5;
    const chimZ = ROOF_CHIMNEY_BOUNDS.y + ROOF_CHIMNEY_BOUNDS.height * 0.5;
    for (let i = 0; i < 4; i++) {
      const phase = (t * 0.45 + i * 0.25) % 1;
      const sx = chimX + Math.sin(t * 1.8 + i * 2) * 3.5 * phase;
      const sz = chimZ - phase * 6;
      const sy = chimTopY + phase * 22;
      const r = 2.2 + phase * 3.2;
      translucent.addSphere(sx, sy, sz, r, r * 0.85, r, 4, 6, rgb(228, 236, 248, (1 - phase) * 0.55), TexId.SOLID, 0);
    }

    // Electric Sparks on the frayed EV charging cable
    const sparkX = DAMAGED_WIRE_HAZARD.x + DAMAGED_WIRE_HAZARD.width * 0.5;
    const sparkZ = DAMAGED_WIRE_HAZARD.y + DAMAGED_WIRE_HAZARD.height * 0.5;
    const sparkBaseY = getTerrainHeight(sparkX, sparkZ, 'level-outside') + 1.5;
    for (let i = 0; i < 3; i++) {
      const ang = t * 14 + i * 2.1;
      translucent.addOrientedBox(
        sparkX + Math.cos(ang) * 2.2,
        sparkBaseY + 1.2 + Math.abs(Math.sin(ang * 1.7)) * 2.8,
        sparkZ + Math.sin(ang) * 2.2,
        4.0,
        0.6,
        0.6,
        ang,
        0.6,
        rgb(120, 235, 255, 0.95),
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
      radius: 85,
      intensity: 0.8,
    });

    // Gentle 3D Falling Snowflakes around Santa
    for (let i = 0; i < 28; i++) {
      const seedX = ((i * 73) % 140) - 70;
      const seedZ = ((i * 47) % 140) - 70;
      const fall = (t * 14 + i * 9.3) % 42;
      const fx = px + seedX + Math.sin(t * 1.5 + i) * 4;
      const fz = pz + seedZ + Math.cos(t * 1.3 + i) * 4;
      const fy = py + 38 - fall;
      translucent.addSphere(fx, fy, fz, 0.65, 0.65, 0.65, 3, 4, rgb(252, 254, 255, 0.85), TexId.SOLID, 0);
    }
  } else if (levelId === 'level-basement') {
    const basement = state.levels['level-basement'];

    // Animated Fireplace Flames & Warm Hearth Point Light (cols 11..12, rows 11..12 => x: 176, z: 192)
    for (let i = 0; i < 4; i++) {
      const flicker = Math.sin(t * 14 + i * 1.8) * 1.4;
      const flameH = 5.0 + flicker;
      translucent.addCone(
        11 * TILE_SIZE - 1,
        1.5,
        11.5 * TILE_SIZE + i * 3.2,
        1.8,
        flameH,
        6,
        i % 2 === 0 ? rgb(255, 146, 36, 0.92) : rgb(255, 224, 68, 0.92),
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
      radius: 120,
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
      }
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
      }
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
        }
      );
      if (basement.toiletCutscene?.active && Math.floor(basement.toiletCutscene.timer * 10) % 2 === 0) {
        addExclamationBadge3D(opaque, tx, 2.0, tz);
      }
    }

    // Sight cones
    addConeOfSight3D(translucent, basement.coneOfSight);
    addConeOfSight3D(translucent, basement.olexaConeOfSight);

    // Closed doors & fog-of-war masks
    for (const door of basement.doors) {
      addDoorAndFog3D(opaque, door);
    }
  } else if (levelId === 'level-upstairs') {
    const upstairs = state.levels['level-upstairs'];

    // Christmas Tree warm golden glow at (3 * 16, 15.5 * 16)
    pointLights.push({
      x: 3 * TILE_SIZE,
      y: 18,
      z: 15.5 * TILE_SIZE,
      r: 1.0,
      g: 0.86,
      b: 0.42,
      radius: 130,
      intensity: 1.0 + Math.sin(t * 4) * 0.1,
    });

    // Black Cat in Extra Room
    addCat3D(opaque, upstairs.cat);

    // Rosanna Cutscene: second Santa running west-to-east outside the north kitchen windows
    if (upstairs.rosannaCutscene?.active) {
      const cs = upstairs.rosannaCutscene;
      addHumanoid3D(
        opaque,
        cs.santaX + 8,
        0,
        cs.santaY + 8,
        0, // running East
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
        true
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

    // Diana's Present in Bedroom (if bedroom opened & not taken)
    if (isBedroomDoorOpen && !state.player.states.get(DIANA_PRESENT_TAKEN_KEY)) {
      const pr = UPSTAIRS_DIANA_PRESENT_BOUNDS;
      const gx = pr.x + pr.width * 0.5;
      const gz = pr.y + pr.height * 0.5;
      opaque.addBox(gx, 0, gz, 8, 7, 8, rgb(214, 40, 40), TexId.GIFT_WRAP, 0.75);
      opaque.addSphere(gx, 7.5, gz, 2.2, 1.4, 2.2, 4, 6, rgb(255, 209, 102), TexId.SOLID, 0.5);
    }

    // Simon's Present in Office (if office opened & not taken)
    if (isOfficeDoorOpen && !state.player.states.get(SIMON_PRESENT_TAKEN_KEY)) {
      const pr = UPSTAIRS_SIMON_PRESENT_BOUNDS;
      const gx = pr.x + pr.width * 0.5;
      const gz = pr.y + pr.height * 0.5;
      opaque.addBox(gx, 0, gz, 8, 7, 8, rgb(42, 117, 211), TexId.GIFT_WRAP, 0.75);
      opaque.addSphere(gx, 7.5, gz, 2.2, 1.4, 2.2, 4, 6, rgb(255, 238, 84), TexId.SOLID, 0.5);
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
      }
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
      }
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
      }
    );

    // Henrik & Tanja in Table Room (when table room door is opened)
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
        }
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
        }
      );
    }

    // Anne-Marie in Bedroom (when bedroom door is opened)
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
        }
      );
    }

    // Sight Cones
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

    // Closed Doors & Fog of War
    for (const door of upstairs.doors) {
      addDoorAndFog3D(opaque, door);
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
        }
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
