import { AStarPathfinder, TileCoord } from '../world/pathfinding';
import { isRectCollidingWithMap, TILE_SIZE, TileMap } from '../world/tilemap';
import {
  Player,
  Rect,
  rectsIntersect,
  UZI_FIRE_INTERVAL_SECONDS,
} from './player';

export const MAX_NPC_HEALTH = 100;
export const NPC_HOSTILE_LOSE_SIGHT_SECONDS = 5.0;
export const NPC_HOSTILE_ALERT_SECONDS = 0.5;
export const NPC_HOSTILE_PROPAGATION_DELAY_SECONDS = 2.0;
export const NPC_HOSTILE_PATH_RECALC_SECONDS = 1.0;
export const NPC_HOSTILE_WALK_SPEED = 24; // pixels per second (slow menacing advance)
export const NPC_BURNING_RUN_SPEED = NPC_HOSTILE_WALK_SPEED * 2; // 2x walk speed while on fire
export const NPC_BURNING_DIR_INTERVAL_SECONDS = 1.0;
export const NPC_HOSTILE_STOP_DISTANCE = 18;
export const NPC_HOSTILE_ALERT_RADIUS = 5 * TILE_SIZE;
export const NPC_UZI_BULLET_DAMAGE = 10;
export const NPC_UZI_MAGAZINE_SIZE = 30;
export const NPC_UZI_RELOAD_SECONDS = 2.5;
export const PLAYER_UZI_NPC_DAMAGE = 30;
export const PLAYER_PUNCH_NPC_DAMAGE = 15;
export const PLAYER_KATANA_NPC_DAMAGE = 50;
export const PLAYER_FIREBALL_NPC_DAMAGE = 15;
export const NPC_BURN_DAMAGE_PER_SECOND = 20;
export const NPC_KATANA_MELEE_DAMAGE = 15 * 1.75; // 26.25 (+75% damage)
export const NPC_KATANA_MELEE_COOLDOWN = 0.45;
export const NPC_KATANA_MELEE_RANGE = 24;
export const NPC_FLAMETHROWER_SHOT_INTERVAL_SECONDS = 0.12;
export const NPC_BAZOOKA_SHOT_INTERVAL_SECONDS = 2.4;
export const NPC_BAZOOKA_ROCKET_SPEED = 150;
export const NPC_DEATH_FALL_DURATION = 0.45;

export type NpcWeapon = 'uzi' | 'katana' | 'flamethrower' | 'bazooka';
export type NpcCombatMode = 'passive' | 'hostile' | 'burning' | 'dead';

export interface ArmedNpcState {
  key: string;
  name: string;
  weapon: NpcWeapon;
  mode: NpcCombatMode;
  maxHealth: number;
  health: number;
  delayedHealth: number;
  delayedHealthRate: number;
  unseenTimer: number;
  hostileAlertTimer: number;
  pendingHostileAlertTimer: number;
  fireCooldown: number;
  meleeCooldown: number;
  shotsFiredInMag: number;
  reloadTimer: number;
  weaponVibrationTimer: number;
  aimYaw: number;
  deadFallProgress: number;
  path: TileCoord[];
  pathTimer: number;
  isMoving: boolean;
  burnDirYaw: number;
  burnDirTimer: number;
  charred: boolean;
}

export function createArmedNpcState(
  key: string,
  name: string,
  initialAimYaw: number,
  weapon: NpcWeapon = 'uzi',
  maxHealth: number = MAX_NPC_HEALTH
): ArmedNpcState {
  return {
    key,
    name,
    weapon,
    mode: 'passive',
    maxHealth,
    health: maxHealth,
    delayedHealth: maxHealth,
    delayedHealthRate: 0,
    unseenTimer: 0,
    hostileAlertTimer: 0,
    pendingHostileAlertTimer: 0,
    fireCooldown: 0,
    meleeCooldown: 0,
    shotsFiredInMag: 0,
    reloadTimer: 0,
    weaponVibrationTimer: 0,
    aimYaw: initialAimYaw,
    deadFallProgress: 0,
    path: [],
    pathTimer: 0,
    isMoving: false,
    burnDirYaw: initialAimYaw,
    burnDirTimer: 0,
    charred: false,
  };
}

/**
 * Applies damage to an armed indoor NPC.
 * Updates `delayedHealthRate` for a 1-second catch-up animation (matching the player health bar).
 * Triggers `'hostile'` mode if still alive, or `'dead'` if `health <= 0`.
 * Returns `true` if this damage call caused the NPC to die.
 */
export function applyNpcDamage(npc: ArmedNpcState, damage: number): boolean {
  if (npc.mode === 'dead' || damage <= 0) {
    return false;
  }
  const nextHealth = Math.max(0, Math.min(npc.maxHealth, npc.health - damage));
  npc.health = nextHealth;
  npc.delayedHealthRate = Math.abs(npc.delayedHealth - npc.health);

  if (npc.health <= 0) {
    npc.mode = 'dead';
    npc.hostileAlertTimer = 0;
    npc.pendingHostileAlertTimer = 0;
    npc.fireCooldown = 0;
    npc.reloadTimer = 0;
    npc.weaponVibrationTimer = 0;
    npc.unseenTimer = 0;
    npc.deadFallProgress = 0;
    npc.isMoving = false;
    npc.path = [];
    npc.pathTimer = 0;
    return true;
  }

  if (npc.mode !== 'burning') {
    enterHostileMode(npc);
  }
  return false;
}

/**
 * Transitions a passive NPC into hostile mode with a 1-second blinking exclamation alert before shooting.
 */
export function enterHostileMode(npc: ArmedNpcState): void {
  if (npc.mode === 'dead' || npc.mode === 'burning') return;
  if (npc.mode === 'passive') {
    npc.mode = 'hostile';
    npc.hostileAlertTimer = NPC_HOSTILE_ALERT_SECONDS;
    npc.pendingHostileAlertTimer = 0;
    npc.pathTimer = 0;
  }
  npc.unseenTimer = 0;
}

/**
 * Ignites an NPC when hit by flamethrower fire, switching them out of hostile into frantic burning mode.
 */
export function igniteNpc(npc: ArmedNpcState): void {
  if (npc.mode === 'dead') return;
  npc.mode = 'burning';
  npc.charred = true;
  npc.hostileAlertTimer = 0;
  npc.pendingHostileAlertTimer = 0;
  npc.unseenTimer = 0;
  npc.path = [];
  if (npc.burnDirTimer <= 0) {
    npc.burnDirYaw = Math.random() * Math.PI * 2;
    npc.burnDirTimer = NPC_BURNING_DIR_INTERVAL_SECONDS;
  }
  npc.isMoving = true;
}

export function updateNpcHealthAndTimers(
  npc: ArmedNpcState,
  dtSeconds: number
): void {
  if (dtSeconds <= 0) return;

  if (npc.delayedHealth !== npc.health) {
    const step = npc.delayedHealthRate * dtSeconds;
    if (npc.delayedHealth > npc.health) {
      npc.delayedHealth = Math.max(npc.health, npc.delayedHealth - step);
    } else {
      npc.delayedHealth = Math.min(npc.health, npc.delayedHealth + step);
    }
    if (npc.delayedHealth === npc.health) {
      npc.delayedHealthRate = 0;
    }
  }

  if (npc.hostileAlertTimer > 0) {
    npc.hostileAlertTimer = Math.max(0, npc.hostileAlertTimer - dtSeconds);
  }
  if (npc.mode === 'passive' && npc.pendingHostileAlertTimer > 0) {
    npc.pendingHostileAlertTimer = Math.max(
      0,
      npc.pendingHostileAlertTimer - dtSeconds
    );
    if (npc.pendingHostileAlertTimer === 0) {
      enterHostileMode(npc);
    }
  }
  if (npc.meleeCooldown > 0) {
    npc.meleeCooldown = Math.max(0, npc.meleeCooldown - dtSeconds);
  }
  if (npc.weaponVibrationTimer > 0) {
    npc.weaponVibrationTimer = Math.max(0, npc.weaponVibrationTimer - dtSeconds);
  }
  if (npc.fireCooldown > 0) {
    npc.fireCooldown = Math.max(0, npc.fireCooldown - dtSeconds);
  }
  if (npc.reloadTimer > 0) {
    npc.reloadTimer = Math.max(0, npc.reloadTimer - dtSeconds);
    if (npc.reloadTimer === 0) {
      npc.shotsFiredInMag = 0;
    }
  }

  if (npc.mode === 'dead' && npc.deadFallProgress < 1) {
    npc.deadFallProgress = Math.min(
      1,
      npc.deadFallProgress + dtSeconds / NPC_DEATH_FALL_DURATION
    );
  }
}

export function tryFireHostileNpcUzi(
  npc: ArmedNpcState,
  originX: number,
  originY: number,
  aimYaw: number,
  fireNpcUzi?: (
    npc: ArmedNpcState,
    originX: number,
    originY: number,
    aimYaw: number
  ) => void
): boolean {
  if (
    npc.mode !== 'hostile' ||
    npc.hostileAlertTimer > 0 ||
    npc.reloadTimer > 0 ||
    npc.fireCooldown > 0
  ) {
    return false;
  }
  fireNpcUzi?.(npc, originX, originY, aimYaw);
  npc.fireCooldown = UZI_FIRE_INTERVAL_SECONDS;
  npc.weaponVibrationTimer = Math.max(
    npc.weaponVibrationTimer,
    UZI_FIRE_INTERVAL_SECONDS + 0.05
  );
  npc.shotsFiredInMag += 1;
  if (npc.shotsFiredInMag >= NPC_UZI_MAGAZINE_SIZE) {
    npc.shotsFiredInMag = 0;
    npc.reloadTimer = NPC_UZI_RELOAD_SECONDS;
  }
  return true;
}

export function tryFireHostileNpcFlamethrower(
  npc: ArmedNpcState,
  originX: number,
  originY: number,
  aimYaw: number,
  fireNpcFlamethrower?: (
    npc: ArmedNpcState,
    originX: number,
    originY: number,
    aimYaw: number
  ) => void
): boolean {
  if (
    npc.mode !== 'hostile' ||
    npc.hostileAlertTimer > 0 ||
    npc.fireCooldown > 0
  ) {
    return false;
  }
  fireNpcFlamethrower?.(npc, originX, originY, aimYaw);
  npc.fireCooldown = NPC_FLAMETHROWER_SHOT_INTERVAL_SECONDS;
  npc.weaponVibrationTimer = Math.max(
    npc.weaponVibrationTimer,
    NPC_FLAMETHROWER_SHOT_INTERVAL_SECONDS + 0.05
  );
  return true;
}

export function tryFireHostileNpcBazooka(
  npc: ArmedNpcState,
  originX: number,
  originY: number,
  aimYaw: number,
  fireNpcBazooka?: (
    npc: ArmedNpcState,
    originX: number,
    originY: number,
    aimYaw: number
  ) => void
): boolean {
  if (
    npc.mode !== 'hostile' ||
    npc.hostileAlertTimer > 0 ||
    npc.fireCooldown > 0
  ) {
    return false;
  }
  fireNpcBazooka?.(npc, originX, originY, aimYaw);
  npc.fireCooldown = NPC_BAZOOKA_SHOT_INTERVAL_SECONDS;
  npc.weaponVibrationTimer = Math.max(npc.weaponVibrationTimer, 0.25);
  return true;
}

export function isNpcBillboardVisible(npc: ArmedNpcState): boolean {
  return (
    npc.mode !== 'dead' &&
    npc.hostileAlertTimer <= 0 &&
    (npc.mode === 'hostile' || npc.mode === 'burning' || npc.health < MAX_NPC_HEALTH)
  );
}

/**
 * When one armed NPC turns hostile, schedules a 2-second delayed alert for every other
 * visible passive NPC within 5 tiles so they also turn hostile.
 */
export function propagateHostileAlert(
  entries: ReadonlyArray<{ state: ArmedNpcState; bounds: Rect; visible: boolean }>,
  sourceKey: string
): void {
  const source = entries.find((e) => e.state.key === sourceKey);
  if (!source) return;
  const sx = source.bounds.x + source.bounds.width * 0.5;
  const sy = source.bounds.y + source.bounds.height * 0.5;

  for (const other of entries) {
    if (other.state.key === sourceKey) continue;
    if (!other.visible || other.state.mode !== 'passive') continue;
    const ox = other.bounds.x + other.bounds.width * 0.5;
    const oy = other.bounds.y + other.bounds.height * 0.5;
    if (Math.hypot(ox - sx, oy - sy) <= NPC_HOSTILE_ALERT_RADIUS) {
      if (other.state.pendingHostileAlertTimer <= 0) {
        other.state.pendingHostileAlertTimer = NPC_HOSTILE_PROPAGATION_DELAY_SECONDS;
      }
    }
  }
}

/**
 * Updates a burning NPC: every 1s picks a random direction, runs at 2x walk speed,
 * and fires projectiles in random directions until dead.
 */
export function stepBurningNpc(
  npc: ArmedNpcState,
  bounds: Rect,
  player: Player,
  map: TileMap,
  solidObstacles: readonly Rect[],
  dtSeconds: number,
  fireNpcUzi?: (
    npc: ArmedNpcState,
    originX: number,
    originY: number,
    aimYaw: number
  ) => void,
  fireNpcFlamethrower?: (
    npc: ArmedNpcState,
    originX: number,
    originY: number,
    aimYaw: number
  ) => void,
  fireNpcBazooka?: (
    npc: ArmedNpcState,
    originX: number,
    originY: number,
    aimYaw: number
  ) => void
): void {
  if (npc.mode !== 'burning' || dtSeconds <= 0) return;

  npc.burnDirTimer -= dtSeconds;
  if (npc.burnDirTimer <= 0) {
    npc.burnDirTimer = NPC_BURNING_DIR_INTERVAL_SECONDS;
    npc.burnDirYaw = Math.random() * Math.PI * 2;
  }
  npc.aimYaw = npc.burnDirYaw;

  const otherObstacles = solidObstacles.filter(
    (obs) =>
      !(
        obs.x === bounds.x &&
        obs.y === bounds.y &&
        obs.width === bounds.width &&
        obs.height === bounds.height
      )
  );

  const step = NPC_BURNING_RUN_SPEED * dtSeconds;
  const vx = Math.cos(npc.burnDirYaw) * step;
  const vy = Math.sin(npc.burnDirYaw) * step;

  const canMoveTo = (nx: number, ny: number): boolean => {
    const candidate: Rect = {
      x: nx,
      y: ny,
      width: bounds.width,
      height: bounds.height,
    };
    if (isRectCollidingWithMap(map, nx, ny, bounds.width, bounds.height, true)) {
      return false;
    }
    if (rectsIntersect(candidate, player)) {
      return false;
    }
    for (const obs of otherObstacles) {
      if (rectsIntersect(candidate, obs)) {
        return false;
      }
    }
    return true;
  };

  let moved = false;
  if (Math.abs(vx) > 0.0001 && canMoveTo(bounds.x + vx, bounds.y)) {
    bounds.x += vx;
    moved = true;
  }
  if (Math.abs(vy) > 0.0001 && canMoveTo(bounds.x, bounds.y + vy)) {
    bounds.y += vy;
    moved = true;
  }
  if (!moved) {
    // Bounce to a new random direction if pinned against a wall
    npc.burnDirYaw = Math.random() * Math.PI * 2;
  }
  npc.isMoving = true;

  // Fire projectiles in random directions while burning (for ranged NPCs)
  if (npc.fireCooldown <= 0) {
    const ox = bounds.x + bounds.width * 0.5;
    const oy = bounds.y + bounds.height * 0.5;
    const randomYaw = Math.random() * Math.PI * 2;
    if (npc.weapon === 'uzi') {
      fireNpcUzi?.(npc, ox, oy, randomYaw);
      npc.fireCooldown = UZI_FIRE_INTERVAL_SECONDS;
      npc.weaponVibrationTimer = Math.max(
        npc.weaponVibrationTimer,
        UZI_FIRE_INTERVAL_SECONDS + 0.05
      );
    } else if (npc.weapon === 'flamethrower') {
      fireNpcFlamethrower?.(npc, ox, oy, randomYaw);
      npc.fireCooldown = NPC_FLAMETHROWER_SHOT_INTERVAL_SECONDS;
      npc.weaponVibrationTimer = Math.max(
        npc.weaponVibrationTimer,
        NPC_FLAMETHROWER_SHOT_INTERVAL_SECONDS + 0.05
      );
    } else if (npc.weapon === 'bazooka') {
      fireNpcBazooka?.(npc, ox, oy, randomYaw);
      npc.fireCooldown = NPC_BAZOOKA_SHOT_INTERVAL_SECONDS;
      npc.weaponVibrationTimer = Math.max(npc.weaponVibrationTimer, 0.25);
    }
  }
}

/**
 * Recalculates the A* shortest path to the player every 1 second and slowly walks
 * the hostile NPC along that path toward the player without clipping into walls/obstacles.
 */
export function stepHostileNpcAlongPath(
  npc: ArmedNpcState,
  bounds: Rect,
  player: Player,
  map: TileMap,
  solidObstacles: readonly Rect[],
  dtSeconds: number,
  speedMultiplier: number = 1
): void {
  if (npc.mode !== 'hostile' || npc.hostileAlertTimer > 0 || dtSeconds <= 0) {
    npc.isMoving = false;
    return;
  }

  const ts = map.tileSize;
  const npcCx = bounds.x + bounds.width * 0.5;
  const npcCy = bounds.y + bounds.height * 0.5;
  const playerCx = player.x + player.width * 0.5;
  const playerCy = player.y + player.height * 0.5;

  const otherObstacles = solidObstacles.filter(
    (obs) =>
      !(
        obs.x === bounds.x &&
        obs.y === bounds.y &&
        obs.width === bounds.width &&
        obs.height === bounds.height
      )
  );

  npc.pathTimer -= dtSeconds;
  if (npc.pathTimer <= 0) {
    npc.pathTimer = NPC_HOSTILE_PATH_RECALC_SECONDS;
    const pathfinder = new AStarPathfinder(map, { obstacles: otherObstacles });
    const fullPath = pathfinder.findPathWorld(npcCx, npcCy, playerCx, playerCy);
    if (fullPath.length > 1) {
      npc.path = fullPath.slice(1);
    } else {
      npc.path = fullPath;
    }
  }

  const distToPlayer = Math.hypot(playerCx - npcCx, playerCy - npcCy);
  if (distToPlayer <= NPC_HOSTILE_STOP_DISTANCE || npc.path.length === 0) {
    npc.isMoving = false;
    return;
  }

  const nextTile = npc.path[0];
  const targetX = nextTile.col * ts + ts * 0.5;
  const targetY = nextTile.row * ts + ts * 0.5;
  const dx = targetX - npcCx;
  const dy = targetY - npcCy;
  const dist = Math.hypot(dx, dy);

  if (dist <= 2.0) {
    npc.path.shift();
    if (npc.path.length === 0) {
      npc.isMoving = false;
      return;
    }
  }

  const activeTile = npc.path[0];
  const ax = activeTile.col * ts + ts * 0.5 - npcCx;
  const ay = activeTile.row * ts + ts * 0.5 - npcCy;
  const adist = Math.hypot(ax, ay);
  if (adist <= 0.001) {
    npc.isMoving = false;
    return;
  }

  const step = Math.min(
    adist,
    NPC_HOSTILE_WALK_SPEED * speedMultiplier * dtSeconds
  );
  const vx = (ax / adist) * step;
  const vy = (ay / adist) * step;

  const canMoveTo = (nx: number, ny: number): boolean => {
    const candidate: Rect = {
      x: nx,
      y: ny,
      width: bounds.width,
      height: bounds.height,
    };
    if (isRectCollidingWithMap(map, nx, ny, bounds.width, bounds.height, true)) {
      return false;
    }
    if (rectsIntersect(candidate, player)) {
      return false;
    }
    for (const obs of otherObstacles) {
      if (rectsIntersect(candidate, obs)) {
        return false;
      }
    }
    return true;
  };

  let moved = false;
  if (Math.abs(vx) > 0.0001 && canMoveTo(bounds.x + vx, bounds.y)) {
    bounds.x += vx;
    moved = true;
  }
  if (Math.abs(vy) > 0.0001 && canMoveTo(bounds.x, bounds.y + vy)) {
    bounds.y += vy;
    moved = true;
  }
  npc.isMoving = moved;
}
