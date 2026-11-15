import { InputState } from '../core/input';
import {
  isRectCollidingWithMap,
  TILE_SIZE,
  TileMap,
  TileType,
} from '../world/tilemap';

export type Direction = 'up' | 'down' | 'left' | 'right';

export const FOOTPRINT_DURATION_SECONDS = 3.0;
export const FOOTPRINT_STEP_INTERVAL_SECONDS = 0.14;

export const PLAYER_JUMP_HEIGHT = 0.5 * TILE_SIZE;
export const PLAYER_JUMP_DURATION = 0.44;
export const PLAYER_JUMP_GRAVITY =
  (8 * PLAYER_JUMP_HEIGHT) / (PLAYER_JUMP_DURATION * PLAYER_JUMP_DURATION);
export const PLAYER_JUMP_INITIAL_VELOCITY =
  (4 * PLAYER_JUMP_HEIGHT) / PLAYER_JUMP_DURATION;

export const MAX_PLAYER_HEALTH = 100;
export const PUNCH_DURATION_SECONDS = 0.28;
export const UZI_EQUIP_DURATION_SECONDS = 0.5;
export const UZI_DROP_DURATION_SECONDS = 0.45;
export const UZI_FIRE_INTERVAL_SECONDS = 0.1;
export const UZI_PROJECTILE_SPEED = 16 * TILE_SIZE;
export const MAX_UZI_AMMO = 30;
export const FLAMETHROWER_FIRE_INTERVAL_SECONDS = 0.05;
export const FLAMETHROWER_PROJECTILE_SPEED = 5 * TILE_SIZE;
export const FLAMETHROWER_MAX_DISTANCE = 6 * TILE_SIZE;

export type EquipmentId = 'empty' | 'unarmed' | 'uzi' | 'flamethrower';

export interface Footprint {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  foot: 'left' | 'right';
  facing: Direction;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  facing: Direction;
  /** Continuous 3D facing yaw in radians (`-Math.PI / 2` = North / up) */
  yaw?: number;
  /** Smoothed 3D rendered facing yaw that rapidly turns toward `yaw` */
  renderYaw?: number;
  /** Aesthetic 3D vertical jump/fall height offset above ground/roof (in world units) */
  jumpOffset?: number;
  /** Vertical velocity for jump/fall animation (units/sec) */
  jumpVelocity?: number;
  isMoving: boolean;
  walkTimer: number;
  blinkTimer: number;
  footprintSpawnTimer: number;
  nextFootprintFoot: 'left' | 'right';
  states: Map<string, unknown>;
  health: number;
  delayedHealth: number;
  delayedHealthRate: number;
  equippedItem: EquipmentId;
  unlockedUzi: boolean;
  uziAmmo: number;
  uziDepleted: boolean;
  uziDropTimer: number;
  unlockedFlamethrower: boolean;
  flamethrowerFireCooldown: number;
  weaponVibrationTimer: number;
  punchTimer: number;
  punchHand: 'left' | 'right';
  uziEquipTimer: number;
  uziFireCooldown: number;
}

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    width: 12,
    height: 12,
    speed: 75, // pixels per second
    facing: 'up',
    yaw: -Math.PI / 2,
    renderYaw: -Math.PI / 2,
    jumpOffset: 0,
    jumpVelocity: 0,
    isMoving: false,
    walkTimer: 0,
    blinkTimer: 0,
    footprintSpawnTimer: 0,
    nextFootprintFoot: 'left',
    states: new Map<string, unknown>(),
    health: MAX_PLAYER_HEALTH,
    delayedHealth: MAX_PLAYER_HEALTH,
    delayedHealthRate: 0,
    equippedItem: 'empty',
    unlockedUzi: false,
    uziAmmo: MAX_UZI_AMMO,
    uziDepleted: false,
    uziDropTimer: 0,
    unlockedFlamethrower: false,
    flamethrowerFireCooldown: 0,
    weaponVibrationTimer: 0,
    punchTimer: 0,
    punchHand: 'right',
    uziEquipTimer: 0,
    uziFireCooldown: 0,
  };
}

export function setPlayerHealth(player: Player, newHealth: number): void {
  const clamped = Math.max(0, Math.min(MAX_PLAYER_HEALTH, newHealth));
  player.health = clamped;
  // Rate is recalculated on every health change so delayedHealth reaches health in 1 second.
  player.delayedHealthRate = Math.abs(player.delayedHealth - player.health);
}

export function applyPlayerDamage(player: Player, amount: number): void {
  setPlayerHealth(player, player.health - amount);
}

export function updatePlayerHealthAndTimers(player: Player, dtSeconds: number): void {
  if (dtSeconds <= 0) {
    return;
  }
  if (player.delayedHealth !== player.health) {
    const diff = player.health - player.delayedHealth;
    const step = player.delayedHealthRate * dtSeconds;
    if (Math.abs(diff) <= step || player.delayedHealthRate <= 0) {
      player.delayedHealth = player.health;
      player.delayedHealthRate = 0;
    } else {
      player.delayedHealth += Math.sign(diff) * step;
    }
  }
  if (player.punchTimer > 0) {
    player.punchTimer = Math.max(0, player.punchTimer - dtSeconds);
  }
  if (player.uziEquipTimer > 0) {
    player.uziEquipTimer = Math.max(0, player.uziEquipTimer - dtSeconds);
  }
  if (player.uziFireCooldown > 0) {
    player.uziFireCooldown = Math.max(0, player.uziFireCooldown - dtSeconds);
  }
  if (player.uziDropTimer > 0) {
    player.uziDropTimer = Math.max(0, player.uziDropTimer - dtSeconds);
  }
  if (player.flamethrowerFireCooldown > 0) {
    player.flamethrowerFireCooldown = Math.max(
      0,
      player.flamethrowerFireCooldown - dtSeconds
    );
  }
  if (player.weaponVibrationTimer > 0) {
    player.weaponVibrationTimer = Math.max(
      0,
      player.weaponVibrationTimer - dtSeconds
    );
  }
}

export function triggerPlayerPunch(player: Player): boolean {
  if (player.equippedItem !== 'unarmed') {
    return false;
  }
  player.punchTimer = PUNCH_DURATION_SECONDS;
  player.punchHand = player.punchHand === 'right' ? 'left' : 'right';
  return true;
}

export function selectPlayerEquipmentSlot(player: Player, slot: number): boolean {
  if (slot === 1) {
    player.equippedItem = 'empty';
    player.uziEquipTimer = 0;
    return true;
  }
  if (slot === 2) {
    player.equippedItem = 'unarmed';
    player.uziEquipTimer = 0;
    return true;
  }
  if (slot === 3) {
    if (player.unlockedUzi && !player.uziDepleted) {
      if (player.equippedItem !== 'uzi') {
        player.equippedItem = 'uzi';
        player.uziEquipTimer = UZI_EQUIP_DURATION_SECONDS;
        player.punchTimer = 0;
      }
      return true;
    }
    if (player.uziDepleted) {
      player.equippedItem = 'empty';
      player.uziEquipTimer = 0;
      return true;
    }
    return false;
  }
  if (slot === 4) {
    if (!player.unlockedFlamethrower) {
      return false;
    }
    player.equippedItem = 'flamethrower';
    player.uziEquipTimer = 0;
    player.punchTimer = 0;
    return true;
  }
  return false;
}

export function lerpAngle(current: number, target: number, t: number): number {
  let diff = (target - current + Math.PI) % (Math.PI * 2);
  if (diff < 0) diff += Math.PI * 2;
  diff -= Math.PI;
  return current + diff * t;
}

export function triggerPlayerJump(player: Player): boolean {
  if ((player.jumpOffset ?? 0) > 0 || (player.jumpVelocity ?? 0) !== 0) {
    return false;
  }
  player.jumpOffset = 0.001;
  player.jumpVelocity = PLAYER_JUMP_INITIAL_VELOCITY;
  return true;
}

export function updatePlayerJump(player: Player, dtSeconds: number): void {
  const offset = player.jumpOffset ?? 0;
  const velocity = player.jumpVelocity ?? 0;
  if (offset <= 0 && velocity === 0) {
    return;
  }
  const nextVelocity = velocity - PLAYER_JUMP_GRAVITY * dtSeconds;
  const nextOffset = offset + 0.5 * (velocity + nextVelocity) * dtSeconds;
  if (nextOffset <= 0) {
    player.jumpOffset = 0;
    player.jumpVelocity = 0;
  } else {
    player.jumpOffset = nextOffset;
    player.jumpVelocity = nextVelocity;
  }
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function isPlayerOnSnowTile(player: Player, map: TileMap): boolean {
  const footCenterX = player.x + player.width / 2;
  const footCenterY = player.y + player.height - 2;
  const col = Math.floor(footCenterX / map.tileSize);
  const row = Math.floor(footCenterY / map.tileSize);
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) {
    return false;
  }
  return map.tiles[row][col] === TileType.Snow;
}

export function updateFootprints(
  footprints: Footprint[],
  player: Player,
  map: TileMap,
  dtSeconds: number
): void {
  for (let i = footprints.length - 1; i >= 0; i--) {
    footprints[i].age += dtSeconds;
    if (footprints[i].age >= footprints[i].maxAge) {
      footprints.splice(i, 1);
    }
  }

  if (player.isMoving && isPlayerOnSnowTile(player, map)) {
    player.footprintSpawnTimer -= dtSeconds;
    while (player.footprintSpawnTimer <= 0) {
      const foot = player.nextFootprintFoot;
      const baseX = player.x + player.width / 2;
      const baseY = player.y + player.height - 1;

      const isVertical = player.facing === 'up' || player.facing === 'down';
      const fx = isVertical ? baseX + (foot === 'left' ? -3 : 1) : baseX - 1;
      const fy = isVertical ? baseY - 1 : baseY + (foot === 'left' ? -2 : 1);

      footprints.push({
        x: Math.round(fx),
        y: Math.round(fy),
        age: 0,
        maxAge: FOOTPRINT_DURATION_SECONDS,
        foot,
        facing: player.facing,
      });

      player.nextFootprintFoot = foot === 'left' ? 'right' : 'left';
      player.footprintSpawnTimer += FOOTPRINT_STEP_INTERVAL_SECONDS;
    }
  } else {
    player.footprintSpawnTimer = 0;
  }
}

function localYawToDirection(yaw: number): Direction {
  const cx = Math.cos(yaw);
  const cy = Math.sin(yaw);
  if (Math.abs(cy) >= Math.abs(cx)) {
    return cy < 0 ? 'up' : 'down';
  }
  return cx < 0 ? 'left' : 'right';
}

export function updatePlayer(
  player: Player,
  input: InputState,
  dtSeconds: number,
  map: TileMap,
  solidObstacles: readonly Rect[] = [],
  ignoreTilePred?: (col: number, row: number) => boolean
): void {
  if (player.blinkTimer > 0) {
    player.blinkTimer = Math.max(0, player.blinkTimer - dtSeconds);
  }

  const isStrafeMode = player.equippedItem !== 'empty';
  if (isStrafeMode && typeof input.cameraYaw === 'number') {
    player.yaw = input.cameraYaw;
    player.facing = localYawToDirection(input.cameraYaw);
  }

  let dx = 0;
  let dy = 0;

  if (input.moveVector) {
    if (typeof input.cameraYaw === 'number') {
      if (input.dualJoystickMode) {
        // Dual joystick mode (landscape): left joystick controls full 360 camera-relative movement
        const forward = -input.moveVector.y;
        const strafe = input.moveVector.x;
        if (Math.abs(forward) > 0.001 || Math.abs(strafe) > 0.001) {
          const cosY = Math.cos(input.cameraYaw);
          const sinY = Math.sin(input.cameraYaw);
          dx = forward * cosY - strafe * sinY;
          dy = forward * sinY + strafe * cosY;
        }
      } else {
        // Single joystick mode (portrait): joystick up/down moves Santa forwards/backwards along cameraYaw
        // while left/right turns the camera angle in updateCamera3D.
        const forward = -input.moveVector.y;
        if (Math.abs(forward) > 0.001) {
          dx = forward * Math.cos(input.cameraYaw);
          dy = forward * Math.sin(input.cameraYaw);
        }
      }
    } else {
      dx = input.moveVector.x;
      dy = input.moveVector.y;
    }
  } else if (typeof input.cameraYaw === 'number') {
    const forward = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const rawLen = Math.hypot(forward, strafe);
    if (rawLen > 0) {
      const nf = forward / rawLen;
      const ns = strafe / rawLen;
      const cosY = Math.cos(input.cameraYaw);
      const sinY = Math.sin(input.cameraYaw);
      dx = nf * cosY - ns * sinY;
      dy = nf * sinY + ns * cosY;
    }
  } else {
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    const length = Math.hypot(dx, dy);
    if (length > 0) {
      dx /= length;
      dy /= length;
    }
  }

  const length = Math.hypot(dx, dy);
  if (length < 0.001) {
    player.isMoving = false;
    player.walkTimer = 0;
    const targetYaw = player.yaw ?? -Math.PI / 2;
    const turnBlend = Math.min(1, dtSeconds * 16);
    player.renderYaw = lerpAngle(player.renderYaw ?? targetYaw, targetYaw, turnBlend);
    return;
  }

  player.isMoving = true;
  player.walkTimer += dtSeconds;

  if (isStrafeMode) {
    if (typeof input.cameraYaw === 'number') {
      // Non-empty equipment: Santa strafes/backpedals while staying aimed along the camera's forward direction
      player.yaw = input.cameraYaw;
      player.facing = localYawToDirection(input.cameraYaw);
    } else if (Math.abs(dy) > Math.abs(dx)) {
      player.yaw = Math.atan2(dy, dx);
      player.facing = dy < 0 ? 'up' : 'down';
    }
    const targetYaw = player.yaw ?? -Math.PI / 2;
    const turnBlend = Math.min(1, dtSeconds * 16);
    player.renderYaw = lerpAngle(player.renderYaw ?? targetYaw, targetYaw, turnBlend);
  } else {
    player.yaw = Math.atan2(dy, dx);
    const turnBlend = Math.min(1, dtSeconds * 16);
    player.renderYaw = lerpAngle(player.renderYaw ?? player.yaw, player.yaw, turnBlend);

    if (Math.abs(dy) > Math.abs(dx)) {
      player.facing = dy < 0 ? 'up' : 'down';
    } else if (Math.abs(dx) > 0) {
      player.facing = dx < 0 ? 'left' : 'right';
    }
  }

  const moveX = dx * player.speed * dtSeconds;
  const moveY = dy * player.speed * dtSeconds;

  const collidesAt = (testX: number, testY: number): boolean => {
    if (
      isRectCollidingWithMap(
        map,
        testX,
        testY,
        player.width,
        player.height,
        true,
        ignoreTilePred
      )
    ) {
      return true;
    }
    const testRect: Rect = {
      x: testX,
      y: testY,
      width: player.width,
      height: player.height,
    };
    return solidObstacles.some((obs) => rectsIntersect(testRect, obs));
  };

  // Axis-separated collision check so the player slides smoothly along walls
  const nextX = player.x + moveX;
  const xBlocked = collidesAt(nextX, player.y);
  if (!xBlocked) {
    player.x = nextX;
  }

  const nextY = player.y + moveY;
  const yBlocked = collidesAt(player.x, nextY);
  if (!yBlocked) {
    player.y = nextY;
  }

  // Gentle corner sliding: if moving straight into an obstacle corner within 1-4px of clearing,
  // nudge along the free axis so player slips smoothly around corners instead of getting stuck
  if (xBlocked && Math.abs(moveY) < 0.01) {
    const slideStep = player.speed * dtSeconds * 0.75;
    for (let offset = 1; offset <= 4; offset++) {
      if (!collidesAt(nextX, player.y - offset) && !collidesAt(player.x, player.y - slideStep)) {
        player.y = Math.max(0, player.y - slideStep);
        break;
      }
      if (!collidesAt(nextX, player.y + offset) && !collidesAt(player.x, player.y + slideStep)) {
        player.y = player.y + slideStep;
        break;
      }
    }
  }

  if (yBlocked && Math.abs(moveX) < 0.01) {
    const slideStep = player.speed * dtSeconds * 0.75;
    for (let offset = 1; offset <= 4; offset++) {
      if (!collidesAt(player.x - offset, nextY) && !collidesAt(player.x - slideStep, player.y)) {
        player.x = Math.max(0, player.x - slideStep);
        break;
      }
      if (!collidesAt(player.x + offset, nextY) && !collidesAt(player.x + slideStep, player.y)) {
        player.x = player.x + slideStep;
        break;
      }
    }
  }
}
