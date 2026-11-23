import { Player, Rect, rectsIntersect } from './player';
import { isRectCollidingWithMap, TILE_SIZE, TileMap } from '../world/tilemap';
import { debugLog } from '../core/debugConsole';

export type CatMode = 'standing' | 'flee' | 'hostile' | 'latched' | 'dead';

export interface Cat {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  mode: CatMode;
  facing: 'left' | 'right';
  /** Continuous 3D facing yaw in radians */
  yaw?: number;
  animTimer: number;
  hasBeenActivated: boolean;
  wallForceDirX: number;
  wallForceDirY: number;
  health: number;
  delayedHealth: number;
  delayedHealthRate: number;
  jumpZ: number;
  jumpPhase: number;
  latchTimer: number;
  latchDamageAccum: number;
  blinkRedTimer: number;
}

// Window in the extra room is at cols 26..27, row 18
// Cat sits near the window (e.g. col 26.5, row 17)
export const CAT_START_X = 26.5 * TILE_SIZE;
export const CAT_START_Y = 17.0 * TILE_SIZE;

// Cat speed parameters
export const CAT_MAX_SPEED = 60; // px/s
export const CAT_ACCELERATION = 120; // snappier than dog
export const CAT_DECELERATION = 100;

// Extra room activation bounding box (cols 26..27, rows 11..17)
export const EXTRA_ROOM_BOUNDS: Rect = {
  x: 25.5 * TILE_SIZE,
  y: 11.0 * TILE_SIZE,
  width: 2.5 * TILE_SIZE,
  height: 7.0 * TILE_SIZE,
};

// Distance thresholds
export const CAT_STOP_FLEE_DISTANCE = 5.0 * TILE_SIZE; // > 5 tiles -> standing still
export const CAT_RETRIGGER_FLEE_DISTANCE = 2.0 * TILE_SIZE; // <= 2 tiles -> flee again

// Combat & headcrab parameters
export const MAX_CAT_HEALTH = 500;
export const CAT_ARMOR_DAMAGE_MULTIPLIER = 1.0; // Takes normal damage
export const CAT_HOSTILE_JUMP_SPEED = 95; // px/s
export const CAT_JUMP_CYCLE_SECONDS = 0.55;
export const CAT_JUMP_PEAK_Z = 13.5;
export const CAT_LATCH_DURATION_SECONDS = 10.0;
export const CAT_LATCH_DAMAGE_PER_SECOND = 5;
export const CAT_LATCH_TICK_INTERVAL_SECONDS = 1.0;
export const CAT_DELAYED_HEALTH_RATE = 40;

export function createCat(
  x: number = CAT_START_X,
  y: number = CAT_START_Y
): Cat {
  return {
    x,
    y,
    width: 10,
    height: 10,
    vx: 0,
    vy: 0,
    maxSpeed: CAT_MAX_SPEED,
    acceleration: CAT_ACCELERATION,
    deceleration: CAT_DECELERATION,
    mode: 'standing',
    facing: 'left',
    yaw: Math.PI / 2,
    animTimer: 0,
    hasBeenActivated: false,
    wallForceDirX: 0,
    wallForceDirY: 0,
    health: MAX_CAT_HEALTH,
    delayedHealth: MAX_CAT_HEALTH,
    delayedHealthRate: CAT_DELAYED_HEALTH_RATE,
    jumpZ: 0,
    jumpPhase: 0,
    latchTimer: 0,
    latchDamageAccum: 0,
    blinkRedTimer: 0,
  };
}

export function isCatBillboardVisible(cat: Cat): boolean {
  return (
    cat.mode !== 'dead' &&
    (cat.mode === 'hostile' ||
      cat.mode === 'latched' ||
      cat.health < MAX_CAT_HEALTH)
  );
}

function positionCatOnRightFace(cat: Cat, player: Player): void {
  const playerCenterX = player.x + player.width / 2;
  const playerCenterY = player.y + player.height / 2;
  const playerYaw =
    typeof player.yaw === 'number'
      ? player.yaw
      : player.facing === 'up'
        ? -Math.PI / 2
        : player.facing === 'down'
          ? Math.PI / 2
          : player.facing === 'left'
            ? Math.PI
            : 0;

  const rightAngle = playerYaw + Math.PI / 2;
  const forwardOffset = 2.4;
  const rightOffset = 4.4;
  cat.x =
    playerCenterX +
    Math.cos(playerYaw) * forwardOffset +
    Math.cos(rightAngle) * rightOffset -
    cat.width * 0.5;
  cat.y =
    playerCenterY +
    Math.sin(playerYaw) * forwardOffset +
    Math.sin(rightAngle) * rightOffset -
    cat.height * 0.5;
  cat.vx = 0;
  cat.vy = 0;
  // Face inward toward the right side of Santa's face while hugging it
  cat.yaw = playerYaw - Math.PI / 2;
  cat.facing = Math.cos(cat.yaw) < 0 ? 'left' : 'right';
  cat.jumpZ = 12.2 + (player.jumpOffset ?? 0);
}

/**
 * Applies damage to the armored cat and turns it hostile.
 * Returns true if damage was applied.
 */
export function applyCatDamage(cat: Cat, rawDamage: number): boolean {
  if (cat.mode === 'dead' || rawDamage <= 0) {
    return false;
  }

  const prevMode = cat.mode;
  const armorDamage = rawDamage * CAT_ARMOR_DAMAGE_MULTIPLIER;
  cat.health = Math.max(0, cat.health - armorDamage);
  cat.delayedHealthRate = Math.max(
    CAT_DELAYED_HEALTH_RATE,
    Math.abs(cat.delayedHealth - cat.health)
  );
  cat.blinkRedTimer = Math.max(cat.blinkRedTimer, 0.35);

  if (cat.health <= 0) {
    cat.mode = 'dead';
    cat.vx = 0;
    cat.vy = 0;
    cat.jumpZ = 0;
    cat.latchTimer = 0;
    cat.latchDamageAccum = 0;
    debugLog(`Cat state changed: ${prevMode} -> dead`);
    return true;
  }

  if (cat.mode !== 'latched') {
    cat.hasBeenActivated = true;
    cat.mode = 'hostile';
    if (prevMode !== 'hostile') {
      cat.jumpPhase = 0;
      debugLog(`Cat state changed: ${prevMode} -> hostile`);
    }
  }

  return true;
}

/**
 * Updates the cat's AI, hostile headcrab leap & face-latch behavior, steering away from Santa when non-hostile, and wall collision.
 */
export function updateCat(
  cat: Cat,
  player: Player,
  dtSeconds: number,
  map: TileMap,
  solidObstacles: readonly Rect[] = [],
  onDamagePlayer?: (amount: number) => void
): void {
  if (cat.delayedHealth > cat.health) {
    cat.delayedHealth = Math.max(
      cat.health,
      cat.delayedHealth - cat.delayedHealthRate * dtSeconds
    );
  } else if (cat.delayedHealth < cat.health) {
    cat.delayedHealth = cat.health;
  }

  if (cat.mode === 'dead') {
    cat.vx = 0;
    cat.vy = 0;
    cat.jumpZ = 0;
    return;
  }

  const catCenterX = cat.x + cat.width / 2;
  const catCenterY = cat.y + cat.height / 2;
  const playerCenterX = player.x + player.width / 2;
  const playerCenterY = player.y + player.height / 2;

  const dx = playerCenterX - catCenterX;
  const dy = playerCenterY - catCenterY;
  const dist = Math.hypot(dx, dy);

  const collidesAt = (testX: number, testY: number): boolean => {
    if (isRectCollidingWithMap(map, testX, testY, cat.width, cat.height)) {
      return true;
    }
    const testRect: Rect = {
      x: testX,
      y: testY,
      width: cat.width,
      height: cat.height,
    };
    return solidObstacles.some((obs) => rectsIntersect(testRect, obs));
  };

  if (cat.mode === 'latched') {
    cat.blinkRedTimer += dtSeconds;
    cat.animTimer += dtSeconds;

    const playerYaw =
      typeof player.yaw === 'number'
        ? player.yaw
        : player.facing === 'up'
          ? -Math.PI / 2
          : player.facing === 'down'
            ? Math.PI / 2
            : player.facing === 'left'
              ? Math.PI
              : 0;

    positionCatOnRightFace(cat, player);

    const step = Math.min(dtSeconds, cat.latchTimer);
    cat.latchTimer = Math.max(0, cat.latchTimer - dtSeconds);
    cat.latchDamageAccum += step;
    while (cat.latchDamageAccum >= CAT_LATCH_TICK_INTERVAL_SECONDS - 1e-6) {
      cat.latchDamageAccum -= CAT_LATCH_TICK_INTERVAL_SECONDS;
      onDamagePlayer?.(CAT_LATCH_DAMAGE_PER_SECOND);
    }

    if (cat.latchTimer <= 1e-6) {
      cat.mode = 'flee';
      cat.hasBeenActivated = true;
      cat.jumpZ = 0;
      cat.jumpPhase = 0;
      cat.latchTimer = 0;
      cat.latchDamageAccum = 0;
      cat.blinkRedTimer = 0;

      const awayYaw = playerYaw;
      const fleeKickX = Math.cos(awayYaw) * 8;
      const fleeKickY = Math.sin(awayYaw) * 8;
      if (!collidesAt(cat.x + fleeKickX, cat.y + fleeKickY)) {
        cat.x += fleeKickX;
        cat.y += fleeKickY;
      }
      cat.vx = Math.cos(awayYaw) * cat.maxSpeed;
      cat.vy = Math.sin(awayYaw) * cat.maxSpeed;
      cat.yaw = awayYaw;
      cat.facing = cat.vx < 0 ? 'left' : 'right';
      debugLog('Cat state changed: latched -> flee');
    }
    return;
  }

  if (cat.mode === 'hostile') {
    cat.blinkRedTimer += dtSeconds;
    cat.animTimer += dtSeconds;
    cat.jumpPhase = (cat.jumpPhase + dtSeconds / CAT_JUMP_CYCLE_SECONDS) % 1;
    cat.jumpZ = 4 * CAT_JUMP_PEAK_Z * cat.jumpPhase * (1 - cat.jumpPhase);

    const ux = dist > 0.001 ? dx / dist : 1;
    const uy = dist > 0.001 ? dy / dist : 0;
    cat.vx = ux * CAT_HOSTILE_JUMP_SPEED;
    cat.vy = uy * CAT_HOSTILE_JUMP_SPEED;
    cat.yaw = Math.atan2(uy, ux);
    cat.facing = ux < 0 ? 'left' : 'right';

    const stepDist = Math.min(dist, CAT_HOSTILE_JUMP_SPEED * dtSeconds);
    const nextX = cat.x + ux * stepDist;
    if (!collidesAt(nextX, cat.y)) {
      cat.x = nextX;
    } else {
      cat.vx = 0;
    }

    const nextY = cat.y + uy * stepDist;
    if (!collidesAt(cat.x, nextY)) {
      cat.y = nextY;
    } else {
      cat.vy = 0;
    }

    const newDist = Math.hypot(
      playerCenterX - (cat.x + cat.width * 0.5),
      playerCenterY - (cat.y + cat.height * 0.5)
    );
    if (rectsIntersect(cat, player) || newDist <= 12) {
      cat.mode = 'latched';
      cat.latchTimer = CAT_LATCH_DURATION_SECONDS;
      cat.latchDamageAccum = 0;
      positionCatOnRightFace(cat, player);
      debugLog('Cat state changed: hostile -> latched');
    }
    return;
  }

  cat.jumpZ = 0;
  cat.blinkRedTimer = 0;

  // 1. Activation and state transition logic
  const prevMode = cat.mode;
  if (!cat.hasBeenActivated) {
    if (rectsIntersect(player, EXTRA_ROOM_BOUNDS)) {
      cat.hasBeenActivated = true;
      cat.mode = 'flee';
    }
  } else {
    // Already activated before:
    if (cat.mode === 'flee') {
      if (dist > CAT_STOP_FLEE_DISTANCE) {
        cat.mode = 'standing';
      }
    } else if (cat.mode === 'standing') {
      if (dist <= CAT_RETRIGGER_FLEE_DISTANCE) {
        cat.mode = 'flee';
      }
    }
  }

  if (cat.mode !== prevMode) {
    debugLog(`Cat state changed: ${prevMode} -> ${cat.mode}`);
  }

  // 2. Velocity and movement
  if (cat.mode === 'flee') {
    // Check surroundings by looking a few pixels (8px, half a tile) in each direction (west, north, east, south).
    // If a wall is detected in one direction, apply a force in the opposite direction.
    const lookDist = 8;
    const wallWest = collidesAt(cat.x - lookDist, cat.y);
    const wallEast = collidesAt(cat.x + lookDist, cat.y);
    const wallNorth = collidesAt(cat.x, cat.y - lookDist);
    const wallSouth = collidesAt(cat.x, cat.y + lookDist);

    let forceDirX = 0;
    let forceDirY = 0;

    if (wallWest) forceDirX += 1; // wall to west -> force east (+X)
    if (wallEast) forceDirX -= 1; // wall to east -> force west (-X)
    if (wallNorth) forceDirY += 1; // wall to north -> force south (+Y)
    if (wallSouth) forceDirY -= 1; // wall to south -> force north (-Y)

    if (forceDirX !== cat.wallForceDirX || forceDirY !== cat.wallForceDirY) {
      debugLog(
        `Cat wall force changed: (${cat.wallForceDirX}, ${cat.wallForceDirY}) -> (${forceDirX}, ${forceDirY})`
      );
      cat.wallForceDirX = forceDirX;
      cat.wallForceDirY = forceDirY;
    }

    // Run away from player (opposite direction of dx, dy)
    let ux = dist > 0.001 ? -dx / dist : -1;
    let uy = dist > 0.001 ? -dy / dist : 0;

    const targetVx = ux * cat.maxSpeed;
    const targetVy = uy * cat.maxSpeed;

    const dvx = targetVx - cat.vx;
    const dvy = targetVy - cat.vy;
    const dvLen = Math.hypot(dvx, dvy);
    const maxDeltaV = cat.acceleration * dtSeconds;

    if (dvLen <= maxDeltaV || dvLen === 0) {
      cat.vx = targetVx;
      cat.vy = targetVy;
    } else {
      cat.vx += (dvx / dvLen) * maxDeltaV;
      cat.vy += (dvy / dvLen) * maxDeltaV;
    }

    // Apply wall avoidance force (same strength as regular running acceleration)
    if (forceDirX !== 0 || forceDirY !== 0) {
      const forceLen = Math.hypot(forceDirX, forceDirY);
      const normFx = forceDirX / forceLen;
      const normFy = forceDirY / forceLen;
      cat.vx += normFx * cat.acceleration * dtSeconds;
      cat.vy += normFy * cat.acceleration * dtSeconds;
    }

    if (Math.abs(cat.vx) > 2) {
      cat.facing = cat.vx < 0 ? 'left' : 'right';
    } else if (Math.abs(dx) > 0.5) {
      cat.facing = dx > 0 ? 'left' : 'right'; // looking away from player
    }
  } else {
    // Standing mode: reset wall force to (0, 0)
    if (cat.wallForceDirX !== 0 || cat.wallForceDirY !== 0) {
      debugLog(
        `Cat wall force changed: (${cat.wallForceDirX}, ${cat.wallForceDirY}) -> (0, 0)`
      );
      cat.wallForceDirX = 0;
      cat.wallForceDirY = 0;
    }

    // Decelerate to 0
    const speed = Math.hypot(cat.vx, cat.vy);
    const maxDrop = cat.deceleration * dtSeconds;
    if (speed <= maxDrop) {
      cat.vx = 0;
      cat.vy = 0;
    } else {
      cat.vx -= (cat.vx / speed) * maxDrop;
      cat.vy -= (cat.vy / speed) * maxDrop;
    }
  }

  if (cat.vx !== 0 || cat.vy !== 0) {
    if (Math.hypot(cat.vx, cat.vy) > 0.5) {
      cat.yaw = Math.atan2(cat.vy, cat.vx);
    }
    cat.animTimer += dtSeconds;

    const nextX = cat.x + cat.vx * dtSeconds;
    if (!collidesAt(nextX, cat.y)) {
      cat.x = nextX;
    } else {
      cat.vx = 0;
    }

    const nextY = cat.y + cat.vy * dtSeconds;
    if (!collidesAt(cat.x, nextY)) {
      cat.y = nextY;
    } else {
      cat.vy = 0;
    }
  }
}
