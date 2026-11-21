import { AStarPathfinder, TileCoord } from '../world/pathfinding';
import { isRectCollidingWithMap, TileMap } from '../world/tilemap';
import {
  Player,
  Rect,
  rectsIntersect,
  UZI_FIRE_INTERVAL_SECONDS,
} from './player';

export const MAX_NPC_HEALTH = 100;
export const NPC_HOSTILE_LOSE_SIGHT_SECONDS = 5.0;
export const NPC_HOSTILE_PATH_RECALC_SECONDS = 1.0;
export const NPC_HOSTILE_WALK_SPEED = 24; // pixels per second (slow menacing advance)
export const NPC_HOSTILE_STOP_DISTANCE = 18;
export const NPC_UZI_BULLET_DAMAGE = 5;
export const NPC_UZI_MAGAZINE_SIZE = 30;
export const NPC_UZI_RELOAD_SECONDS = 2.5;
export const PLAYER_UZI_NPC_DAMAGE = 10;
export const PLAYER_PUNCH_NPC_DAMAGE = 15;
export const PLAYER_FIREBALL_NPC_DAMAGE = 15;
export const NPC_BURN_DAMAGE_PER_SECOND = 12;
export const NPC_DEATH_FALL_DURATION = 0.45;

export type NpcCombatMode = 'passive' | 'hostile' | 'dead';

export interface ArmedNpcState {
  key: string;
  name: string;
  mode: NpcCombatMode;
  health: number;
  delayedHealth: number;
  delayedHealthRate: number;
  unseenTimer: number;
  fireCooldown: number;
  shotsFiredInMag: number;
  reloadTimer: number;
  weaponVibrationTimer: number;
  aimYaw: number;
  deadFallProgress: number;
  path: TileCoord[];
  pathTimer: number;
  isMoving: boolean;
}

export function createArmedNpcState(
  key: string,
  name: string,
  initialAimYaw: number
): ArmedNpcState {
  return {
    key,
    name,
    mode: 'passive',
    health: MAX_NPC_HEALTH,
    delayedHealth: MAX_NPC_HEALTH,
    delayedHealthRate: 0,
    unseenTimer: 0,
    fireCooldown: 0,
    shotsFiredInMag: 0,
    reloadTimer: 0,
    weaponVibrationTimer: 0,
    aimYaw: initialAimYaw,
    deadFallProgress: 0,
    path: [],
    pathTimer: 0,
    isMoving: false,
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
  const nextHealth = Math.max(0, Math.min(MAX_NPC_HEALTH, npc.health - damage));
  npc.health = nextHealth;
  npc.delayedHealthRate = Math.abs(npc.delayedHealth - npc.health);

  if (npc.health <= 0) {
    npc.mode = 'dead';
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

  if (npc.mode !== 'hostile') {
    npc.pathTimer = 0;
  }
  npc.mode = 'hostile';
  npc.unseenTimer = 0;
  return false;
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
  if (npc.mode !== 'hostile' || npc.reloadTimer > 0 || npc.fireCooldown > 0) {
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

export function isNpcBillboardVisible(npc: ArmedNpcState): boolean {
  return (
    npc.mode !== 'dead' &&
    (npc.mode === 'hostile' || npc.health < MAX_NPC_HEALTH)
  );
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
  dtSeconds: number
): void {
  if (npc.mode !== 'hostile' || dtSeconds <= 0) {
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

  const step = Math.min(adist, NPC_HOSTILE_WALK_SPEED * dtSeconds);
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
