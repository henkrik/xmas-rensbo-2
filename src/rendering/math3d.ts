import { InputState } from '../core/input';
import { Direction } from '../entities/player';
import { LineOfSight } from '../entities/sight';
import { GameState } from '../world/gameState';
import { LevelId } from '../world/levels/types';
import {
  CAMERA_NON_BLOCKING_TILES,
  isRectCollidingWithMap,
  LADDER_BOTTOM_Y,
  ROOF_WALK_Y,
  TILE_SIZE,
  TileMap,
} from '../world/tilemap';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type Mat4 = Float32Array;

export const MAIN_HOUSE_WALL_HEIGHT = 34;
export const MAIN_HOUSE_ROOF_PEAK_ADD = 16;
export const MAIN_HOUSE_ROOF_WALK_HEIGHT = 36;
export const INDOOR_WALL_HEIGHT = 2 * TILE_SIZE; // 32 (2 tiles high)

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale3(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length3(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-6) return { x: 0, y: 1, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function wrapAngle(angle: number): number {
  let a = (angle + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a - Math.PI;
}

export function lerpAngle(from: number, to: number, t: number): number {
  const diff = wrapAngle(to - from);
  return wrapAngle(from + diff * Math.max(0, Math.min(1, t)));
}

export function directionToYaw(facing: Direction): number {
  switch (facing) {
    case 'up':
      return -Math.PI / 2;
    case 'down':
      return Math.PI / 2;
    case 'left':
      return Math.PI;
    case 'right':
      return 0;
  }
}

export function yawToDirection(yaw: number): Direction {
  const dx = Math.cos(yaw);
  const dy = Math.sin(yaw);
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy < 0 ? 'up' : 'down';
  }
  return dx < 0 ? 'left' : 'right';
}

export function mat4Identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}

/**
 * Right-handed perspective matrix for WebGPU clip space (Z in [0, 1]).
 */
export function mat4Perspective(
  fovYRadians: number,
  aspect: number,
  near: number,
  far: number
): Mat4 {
  const f = 1.0 / Math.tan(fovYRadians / 2);
  const rangeInv = 1.0 / (near - far);
  const out = new Float32Array(16);
  out[0] = f / Math.max(0.01, aspect);
  out[5] = f;
  out[10] = far * rangeInv;
  out[11] = -1;
  out[14] = near * far * rangeInv;
  out[15] = 0;
  return out;
}

export function mat4LookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const zAxis = normalize3(sub3(eye, target)); // points backward from target to eye
  let xAxis = cross3(up, zAxis);
  if (length3(xAxis) < 1e-5) {
    xAxis = { x: 1, y: 0, z: 0 };
  } else {
    xAxis = normalize3(xAxis);
  }
  const yAxis = cross3(zAxis, xAxis);

  const out = new Float32Array(16);
  out[0] = xAxis.x;
  out[1] = yAxis.x;
  out[2] = zAxis.x;
  out[3] = 0;

  out[4] = xAxis.y;
  out[5] = yAxis.y;
  out[6] = zAxis.y;
  out[7] = 0;

  out[8] = xAxis.z;
  out[9] = yAxis.z;
  out[10] = zAxis.z;
  out[11] = 0;

  out[12] = -dot3(xAxis, eye);
  out[13] = -dot3(yAxis, eye);
  out[14] = -dot3(zAxis, eye);
  out[15] = 1;
  return out;
}

export function mat4Multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4 + 0];
    const b1 = b[col * 4 + 1];
    const b2 = b[col * 4 + 2];
    const b3 = b[col * 4 + 3];
    out[col * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

export function projectWorldToScreen(
  pt: Vec3,
  viewProj: Mat4,
  viewportW: number,
  viewportH: number
): { x: number; y: number; z: number; w: number; visible: boolean } {
  const x = pt.x;
  const y = pt.y;
  const z = pt.z;
  const cx = viewProj[0] * x + viewProj[4] * y + viewProj[8] * z + viewProj[12];
  const cy = viewProj[1] * x + viewProj[5] * y + viewProj[9] * z + viewProj[13];
  const cz = viewProj[2] * x + viewProj[6] * y + viewProj[10] * z + viewProj[14];
  const cw = viewProj[3] * x + viewProj[7] * y + viewProj[11] * z + viewProj[15];

  if (cw <= 0.05) {
    return { x: 0, y: 0, z: cz, w: cw, visible: false };
  }
  const invW = 1.0 / cw;
  const ndcX = cx * invW;
  const ndcY = cy * invW;
  const ndcZ = cz * invW;
  return {
    x: (ndcX * 0.5 + 0.5) * viewportW,
    y: (0.5 - ndcY * 0.5) * viewportH,
    z: ndcZ,
    w: cw,
    visible: ndcZ >= -0.1 && ndcZ <= 1.05 && Math.abs(ndcX) <= 1.6 && Math.abs(ndcY) <= 1.6,
  };
}

function smoothPlateauWeight(
  x: number,
  z: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  margin: number
): number {
  const dx = Math.max(0, minX - x, x - maxX);
  const dz = Math.max(0, minZ - z, z - maxZ);
  const dist = Math.hypot(dx, dz);
  if (dist >= margin) return 0;
  const t = 1 - dist / margin;
  return t * t * (3 - 2 * t);
}

/**
 * Computes the 3D terrain elevation (Y up) at world coordinates (x, z) where x = 2D x, z = 2D y.
 *
 * For `level-outside`, models the sloped Rensbo hillside seen in `inspiration/map.jpeg`:
 * - Gently slopes upward from the bottom of the driveway (south, z=430) up toward the Main House
 *   terrace (north-west) and guest cottages ("stugor", north-east), with a steeper rocky forest
 *   ridge along the northern border and smooth level pads under buildings.
 */
export function getTerrainHeight(
  x: number,
  z: number,
  levelId: LevelId = 'level-outside'
): number {
  if (levelId !== 'level-outside') {
    return 0;
  }

  // Base south-to-north hillside slope: rises from ~0 at row 26 (z=416) up to ~26 at row 3 (z=48)
  const northProgress = Math.max(0, Math.min(1, (432 - z) / 384));
  let h = Math.pow(northProgress, 1.08) * 24.0;

  // Gentle east/west hillside contour & rolling snowdrifts
  const hills =
    Math.sin(x * 0.016 + z * 0.012) * 2.2 +
    Math.cos(x * 0.024 - z * 0.019) * 1.6 +
    Math.sin((x - 240) * 0.01) * 1.8;
  h += hills;

  // Eastern hillside rise behind the two guest cottages (cols 18..31, rows 3..14)
  const eastHill = smoothPlateauWeight(x, z, 18 * 16, 30 * 16, 3 * 16, 11 * 16, 56);
  h += eastHill * 5.5;

  // Steep rocky forest ridge along the northern edge (rows 0..3) and upper-left granite cliff
  if (z < 4.5 * 16) {
    const ridgeT = Math.max(0, (4.5 * 16 - z) / (4.5 * 16));
    h += ridgeT * ridgeT * 14.0;
  }
  const nwCliff = smoothPlateauWeight(x, z, 0, 4.2 * 16, 0, 3.8 * 16, 36);
  h += nwCliff * 9.0;

  // Smooth level building foundation pads so houses/garages/sheds sit flush on the sloped terrain:
  // 1. Main House & front gravel terrace (cols 3.5..17, rows 3..11) -> target height 21.5
  const wHouse = smoothPlateauWeight(x, z, 3.6 * 16, 17.2 * 16, 3.0 * 16, 11.2 * 16, 28);
  h = h * (1 - wHouse) + 21.5 * wHouse;

  // 2. Left Guest Cottage ("Stuga 1", cols 19..23, rows 5..9) -> target height 25.0
  const wStuga1 = smoothPlateauWeight(x, z, 19 * 16, 23 * 16, 5 * 16, 9 * 16, 20);
  h = h * (1 - wStuga1) + 25.0 * wStuga1;

  // 3. Right Guest Cottage ("Stuga 2", cols 25..29, rows 5..9) -> target height 26.5
  const wStuga2 = smoothPlateauWeight(x, z, 25 * 16, 29 * 16, 5 * 16, 9 * 16, 20);
  h = h * (1 - wStuga2) + 26.5 * wStuga2;

  // 4. Outdoor Patio Table pad on west lawn (cols 7..9, rows 14..16) -> target height 14.0
  const wPatio = smoothPlateauWeight(x, z, 7 * 16, 9 * 16, 14 * 16, 16 * 16, 18);
  h = h * (1 - wPatio) + 14.0 * wPatio;

  // 5. White Red-Door Shed pad on east side (cols 25..30, rows 16..20) -> target height 11.5
  const wShed = smoothPlateauWeight(x, z, 25 * 16, 30 * 16, 16 * 16, 20 * 16, 22);
  h = h * (1 - wShed) + 11.5 * wShed;

  // 6. Blue Garage & Greenhouse pad on south-west (cols 2..9, rows 21..26) -> target height 5.5
  const wGarage = smoothPlateauWeight(x, z, 2 * 16, 9 * 16, 21 * 16, 26 * 16, 24);
  h = h * (1 - wGarage) + 5.5 * wGarage;

  return h;
}

export function getTerrainNormal(
  x: number,
  z: number,
  levelId: LevelId = 'level-outside'
): Vec3 {
  if (levelId !== 'level-outside') {
    return { x: 0, y: 1, z: 0 };
  }
  const eps = 2.0;
  const hL = getTerrainHeight(x - eps, z, levelId);
  const hR = getTerrainHeight(x + eps, z, levelId);
  const hD = getTerrainHeight(x, z - eps, levelId);
  const hU = getTerrainHeight(x, z + eps, levelId);
  return normalize3({
    x: hL - hR,
    y: 2.0 * eps,
    z: hD - hU,
  });
}

/**
 * Returns the pitched Main House gable rooftop Y elevation at world (px, pz),
 * matching the 3D roof geometry (`roofBaseY = baseY + 36`, ridge peak `+16` along z = 6.5 * TILE_SIZE).
 */
export function getMainHouseRoofElevation(_px: number, pz: number): number {
  const houseGroundY = getTerrainHeight(5 * TILE_SIZE, 9 * TILE_SIZE, 'level-outside');
  const roofBaseY = houseGroundY + MAIN_HOUSE_ROOF_WALK_HEIGHT; // baseY + 36
  const zCenter = 6.5 * TILE_SIZE; // 104 (ridge center)
  const zHalfSpan = 3.75 * TILE_SIZE; // 60 (half of d + 8 = 120)
  const slopeT = Math.max(0, 1 - Math.abs(pz - zCenter) / zHalfSpan);
  return roofBaseY + MAIN_HOUSE_ROOF_PEAK_ADD * slopeT;
}

/**
 * Returns the 3D world Y elevation of the player (handling outdoor slopes, ladder climbing, roof walking, jump arc, and indoor stairs).
 */
export function getPlayerElevation(state: GameState): number {
  const px = state.player.x + state.player.width / 2;
  const pz = state.player.y + state.player.height / 2;
  const jumpOffset = state.player.jumpOffset ?? 0;

  if (state.currentLevelId === 'level-outside') {
    if (state.climbing) {
      const groundY = getTerrainHeight(px, LADDER_BOTTOM_Y + 6, 'level-outside');
      const roofEdgeY = getMainHouseRoofElevation(px, ROOF_WALK_Y + 6);
      const t = Math.max(0, Math.min(1, state.climbing.progress));
      return state.climbing.direction === 'up'
        ? groundY + (roofEdgeY - groundY) * t
        : roofEdgeY + (groundY - roofEdgeY) * t;
    }

    if (state.isOnRoof) {
      return getMainHouseRoofElevation(px, pz) + jumpOffset;
    }

    return getTerrainHeight(px, pz, 'level-outside') + jumpOffset;
  }

  if (state.currentLevelId === 'level-basement') {
    // Basement stairs at cols 18..21, rows 15..18 ascend eastward
    if (
      px >= 18 * TILE_SIZE &&
      px <= 22 * TILE_SIZE &&
      pz >= 15 * TILE_SIZE &&
      pz <= 19 * TILE_SIZE
    ) {
      const stairProgress = Math.max(0, Math.min(1, (px - 18 * TILE_SIZE) / (3 * TILE_SIZE)));
      return stairProgress * 12 + jumpOffset;
    }
    return jumpOffset;
  }

  if (state.currentLevelId === 'level-upstairs') {
    // Upstairs stairs at cols 15..18, rows 13..18 descend southward
    if (
      px >= 15 * TILE_SIZE &&
      px <= 19 * TILE_SIZE &&
      pz >= 13 * TILE_SIZE &&
      pz <= 18 * TILE_SIZE
    ) {
      const stairProgress = Math.max(0, Math.min(1, (pz - 13.5 * TILE_SIZE) / (4 * TILE_SIZE)));
      return -stairProgress * 10 + jumpOffset;
    }
    return jumpOffset;
  }

  return jumpOffset;
}

export interface Camera3D {
  yaw: number;
  pitch: number;
  distance: number;
  eye: Vec3;
  target: Vec3;
  up: Vec3;
  fovY: number;
  near: number;
  far: number;
  viewMatrix: Mat4;
  projMatrix: Mat4;
  viewProjMatrix: Mat4;
  lastLevelId: LevelId | null;
  wasOnRoof: boolean;
}

export const DEFAULT_CAMERA_PITCH = 0.42; // ~24 degrees looking slightly down behind Santa's back
export const MIN_CAMERA_PITCH = 0.08;
export const MAX_CAMERA_PITCH = 1.18;

export function createCamera3D(initialYaw: number = -Math.PI / 2): Camera3D {
  const eye = { x: 232, y: 28, z: 450 };
  const target = { x: 232, y: 12, z: 408 };
  const up = { x: 0, y: 1, z: 0 };
  const viewMatrix = mat4LookAt(eye, target, up);
  const projMatrix = mat4Perspective((55 * Math.PI) / 180, 256 / 224, 2.0, 900.0);
  const viewProjMatrix = mat4Multiply(projMatrix, viewMatrix);

  return {
    yaw: initialYaw,
    pitch: DEFAULT_CAMERA_PITCH,
    distance: 52,
    eye,
    target,
    up,
    fovY: (55 * Math.PI) / 180,
    near: 2.0,
    far: 900.0,
    viewMatrix,
    projMatrix,
    viewProjMatrix,
    lastLevelId: null,
    wasOnRoof: false,
  };
}

/**
 * Casts a temporary LineOfSight behind the player (opposite the camera yaw) and returns
 * the furthest unobstructed camera distance in [0, maxDistance] before colliding with the map.
 * The LineOfSight instance is immediately discarded after computing the distance.
 */
export function computeUnobstructedCameraDistance(
  originX: number,
  originZ: number,
  cameraYaw: number,
  cameraPitch: number,
  maxDistance: number,
  map: TileMap
): number {
  const CAMERA_LOS_POINTS = 30;
  const oppositeYaw = cameraYaw + Math.PI;
  const cosPitch = Math.max(0.2, Math.cos(cameraPitch));
  const horizontalMaxDistance = maxDistance * cosPitch;
  // LineOfSight samples CAMERA_LOS_POINTS boxes at i = 0..29 (up to 29/30 * distance),
  // so scale by 30/29 so an unobstructed line reaches the full horizontalMaxDistance.
  const lineOfSightDistance =
    (horizontalMaxDistance * CAMERA_LOS_POINTS) / (CAMERA_LOS_POINTS - 1);

  const isCameraIgnoredTile = (col: number, row: number): boolean => {
    if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) {
      return false;
    }
    return CAMERA_NON_BLOCKING_TILES.has(map.tiles[row][col]);
  };

  let lineOfSight: LineOfSight | null = new LineOfSight(
    { x: originX, y: originZ },
    oppositeYaw,
    lineOfSightDistance,
    map,
    CAMERA_LOS_POINTS,
    isCameraIgnoredTile
  );

  // Find the n-th point within the line of sight that is furthest from the player
  // without colliding with anything on the map (ignoring map boundaries & camera-transparent scenery).
  let furthestValidIndex = -1;
  for (let i = lineOfSight.n - 1; i >= 0; i--) {
    const box = lineOfSight.boxes[i];
    if (
      !isRectCollidingWithMap(
        map,
        box.x,
        box.y,
        box.width,
        box.height,
        false,
        isCameraIgnoredTile
      )
    ) {
      furthestValidIndex = i;
      break;
    }
  }

  let unobstructedDistance = 0;
  if (furthestValidIndex >= 0) {
    const furthestPoint = lineOfSight.points(furthestValidIndex);
    const horizontalDist = Math.hypot(
      furthestPoint.x - originX,
      furthestPoint.y - originZ
    );
    // Keep a small wall clearance buffer when an obstacle was hit so the camera near-plane never clips the wall
    const paddedHorizontalDist =
      furthestValidIndex < CAMERA_LOS_POINTS - 1
        ? Math.max(0, horizontalDist - 4.0)
        : horizontalDist;
    unobstructedDistance = Math.min(
      maxDistance,
      Math.max(0, paddedHorizontalDist / cosPitch)
    );
  }

  // Delete the temporary LineOfSight object as soon as the computation is done
  lineOfSight = null;

  return unobstructedDistance;
}

/**
 * Updates the 3D camera so it smoothly follows behind Santa's back, respecting mouse look
 * and sloped terrain / map obstacles.
 */
export function updateCamera3D(
  cam: Camera3D,
  state: GameState,
  input: InputState,
  dtSeconds: number,
  aspect: number = 256 / 224
): void {
  const player = state.player;

  // On level transitions, snap camera yaw behind Santa's initial facing direction
  if (cam.lastLevelId !== state.currentLevelId) {
    cam.lastLevelId = state.currentLevelId;
    const spawnYaw = directionToYaw(player.facing);
    cam.yaw = spawnYaw;
    player.yaw = spawnYaw;
    player.renderYaw = spawnYaw;
    if (input.cameraYaw !== null && input.cameraYaw !== undefined) {
      input.cameraYaw = spawnYaw;
    }
  }

  // When transitioning onto the roof, orient camera north toward the chimney
  if (state.isOnRoof && !cam.wasOnRoof) {
    cam.yaw = -Math.PI / 2;
    player.yaw = -Math.PI / 2;
    if (input.cameraYaw !== null && input.cameraYaw !== undefined) {
      input.cameraYaw = -Math.PI / 2;
    }
  }
  cam.wasOnRoof = state.isOnRoof;

  // Apply arrow-key camera rotation in 3D mode (keyboard-only fallback without mouse)
  if (typeof input.cameraYaw === 'number' && dtSeconds > 0) {
    const yawSpeed = 2.2;
    const pitchSpeed = 1.5;
    if (input.camLeft) {
      input.cameraYaw = wrapAngle(input.cameraYaw - yawSpeed * dtSeconds);
    }
    if (input.camRight) {
      input.cameraYaw = wrapAngle(input.cameraYaw + yawSpeed * dtSeconds);
    }
    const basePitch =
      typeof input.cameraPitch === 'number'
        ? input.cameraPitch
        : DEFAULT_CAMERA_PITCH;
    if (input.camUp) {
      input.cameraPitch = Math.max(
        MIN_CAMERA_PITCH,
        basePitch - pitchSpeed * dtSeconds
      );
    }
    if (input.camDown) {
      input.cameraPitch = Math.min(
        MAX_CAMERA_PITCH,
        (typeof input.cameraPitch === 'number'
          ? input.cameraPitch
          : basePitch) +
          pitchSpeed * dtSeconds
      );
    }
  }

  // Sync yaw/pitch on InputState if active
  if (typeof input.cameraYaw === 'number') {
    cam.yaw = wrapAngle(input.cameraYaw);
  } else if (player.isMoving && dtSeconds > 0) {
    // Gently follow behind Santa's movement direction when cameraYaw is unset
    const targetYaw =
      typeof player.yaw === 'number' ? player.yaw : directionToYaw(player.facing);
    cam.yaw = lerpAngle(cam.yaw, targetYaw, Math.min(1, dtSeconds * 6));
  }

  if (typeof input.cameraPitch === 'number') {
    cam.pitch = Math.max(
      MIN_CAMERA_PITCH,
      Math.min(MAX_CAMERA_PITCH, input.cameraPitch)
    );
  }

  // Task 7: When sitting on the motorcycle and riding East, face the camera East in travel direction
  if (
    state.currentLevelId === 'level-outside' &&
    state.motorcycle.status === 'driving'
  ) {
    cam.yaw = 0;
    if (typeof input.cameraYaw === 'number') {
      input.cameraYaw = 0;
    }
  }

  const px = player.x + player.width / 2;
  let pz = player.y + player.height / 2;
  if (state.climbing && state.currentLevelId === 'level-outside') {
    pz = LADDER_BOTTOM_Y + player.height / 2;
  }
  const py = getPlayerElevation(state);

  const isOutdoor = state.currentLevelId === 'level-outside';
  const maxCameraDistance = isOutdoor ? (state.isOnRoof ? 44 : 52) : 38;

  // Look target is slightly above Santa's head/shoulders so Santa is framed in the lower-middle third
  const targetHeightOffset = isOutdoor ? 13.5 : 12.5;
  cam.target = {
    x: px,
    y: py + targetHeightOffset,
    z: pz,
  };

  // Dramatic cutscene zoom helper (Rosanna north-window & Basement toilet detection)
  const rosannaCutscene =
    state.currentLevelId === 'level-upstairs'
      ? state.levels['level-upstairs'].rosannaCutscene
      : null;
  const toiletCutscene =
    state.currentLevelId === 'level-basement'
      ? state.levels['level-basement'].toiletCutscene
      : null;
  let zoomEase = 0;

  if (rosannaCutscene?.active || toiletCutscene?.active) {
    let targetYaw = -Math.PI / 2;
    let elapsed = 0;
    let targetOffsetX = 0;
    let targetOffsetY = 3.0;
    let targetOffsetZ = -12.0;

    if (toiletCutscene?.active) {
      const toiletNpc = state.levels['level-basement'].toiletNpc;
      const tx = toiletNpc.x + toiletNpc.width * 0.5;
      const tz = toiletNpc.y + toiletNpc.height * 0.5;
      targetYaw = Math.atan2(tz - pz, tx - px);
      elapsed = toiletCutscene.timer;
      targetOffsetX = (tx - px) * 0.45;
      targetOffsetY = 1.5;
      targetOffsetZ = (tz - pz) * 0.45;
    } else if (rosannaCutscene?.active) {
      elapsed = rosannaCutscene.elapsed;
    }

    const turnBlend = dtSeconds > 0 ? Math.min(1, dtSeconds * 6) : 1;
    cam.yaw = lerpAngle(cam.yaw, targetYaw, turnBlend);
    if (typeof input.cameraYaw === 'number') {
      input.cameraYaw = cam.yaw;
    }
    cam.pitch = cam.pitch + (0.16 - cam.pitch) * turnBlend;
    if (typeof input.cameraPitch === 'number') {
      input.cameraPitch = cam.pitch;
    }

    const zoomT = Math.min(1, elapsed / 1.1);
    zoomEase = zoomT * zoomT * (3 - 2 * zoomT);
    cam.fovY = ((55 - 23 * zoomEase) * Math.PI) / 180;
    cam.target.x += targetOffsetX * zoomEase;
    cam.target.y += targetOffsetY * zoomEase;
    cam.target.z += targetOffsetZ * zoomEase;
  } else {
    cam.fovY = (55 * Math.PI) / 180;
  }

  // Forward direction in XZ is (cos(yaw), sin(yaw)); camera sits behind Santa at -forward
  const cosPitch = Math.cos(cam.pitch);
  const sinPitch = Math.sin(cam.pitch);
  const backX = -Math.cos(cam.yaw) * cosPitch;
  const backZ = -Math.sin(cam.yaw) * cosPitch;
  const backY = sinPitch;

  // Compute unobstructed camera distance in [0, maxCameraDistance] using a temporary LineOfSight.
  // Skip when on the roof or climbing the ladder since roof/house tiles beneath Santa are solid in the 2D map.
  const baseEffectiveDistance =
    state.isOnRoof || state.climbing
      ? maxCameraDistance
      : computeUnobstructedCameraDistance(
          cam.target.x,
          cam.target.z,
          cam.yaw,
          cam.pitch,
          maxCameraDistance,
          state.map
        );
  const effectiveDistance = baseEffectiveDistance * (1 - 0.42 * zoomEase);
  cam.distance = effectiveDistance;

  let eyeX = cam.target.x + backX * effectiveDistance;
  let eyeY = cam.target.y + backY * effectiveDistance;
  let eyeZ = cam.target.z + backZ * effectiveDistance;

  // Ensure camera stays above the sloped outdoor ground, or underneath the indoor ceiling
  if (isOutdoor) {
    const groundAtEye = getTerrainHeight(eyeX, eyeZ, 'level-outside');
    if (eyeY < groundAtEye + 8) {
      eyeY = groundAtEye + 8;
    }
  } else {
    eyeY = Math.min(eyeY, INDOOR_WALL_HEIGHT - 3.2);
  }

  cam.eye = { x: eyeX, y: eyeY, z: eyeZ };
  cam.viewMatrix = mat4LookAt(cam.eye, cam.target, cam.up);
  cam.projMatrix = mat4Perspective(cam.fovY, aspect, cam.near, cam.far);
  cam.viewProjMatrix = mat4Multiply(cam.projMatrix, cam.viewMatrix);
}
