import { debugLog } from '../core/debugConsole';
import { SecretSantaDB } from '../core/secretSantaDB';
import {
  consumeActionPress,
  consumeAttackPress,
  consumeSlotPress,
  InputState,
} from '../core/input';
import { applyCatDamage, updateCat } from '../entities/cat';
import { createDog, Dog, updateDog } from '../entities/dog';
import {
  applyNpcDamage,
  ArmedNpcState,
  enterHostileMode,
  igniteNpc,
  NPC_BAZOOKA_ROCKET_SPEED,
  NPC_BURN_DAMAGE_PER_SECOND,
  NPC_UZI_BULLET_DAMAGE,
  PLAYER_FIREBALL_NPC_DAMAGE,
  PLAYER_KATANA_NPC_DAMAGE,
  PLAYER_PUNCH_NPC_DAMAGE,
  PLAYER_UZI_NPC_DAMAGE,
  propagateHostileAlert,
} from '../entities/npcCombat';
import { ConeOfSight } from '../entities/sight';
import {
  applyPlayerDamage,
  BAZOOKA_FIRE_INTERVAL_SECONDS,
  createPlayer,
  DROPPED_FLAMETHROWER_AMMO,
  FLAMETHROWER_FIRE_INTERVAL_SECONDS,
  FLAMETHROWER_MAX_DISTANCE,
  FLAMETHROWER_PROJECTILE_SPEED,
  Footprint,
  MAX_UZI_AMMO,
  Player,
  PLAYER_UZI_RELOAD_SECONDS,
  Rect,
  rectsIntersect,
  selectPlayerEquipmentSlot,
  setPlayerHealth,
  triggerPlayerJump,
  triggerPlayerKatanaSwing,
  triggerPlayerPunch,
  updateFootprints,
  updatePlayer,
  updatePlayerHealthAndTimers,
  updatePlayerJump,
  UZI_EQUIP_DURATION_SECONDS,
  UZI_FIRE_INTERVAL_SECONDS,
  UZI_PROJECTILE_SPEED,
} from '../entities/player';
import {
  createDrivewayThrowers,
  HIT_BLINK_DURATION_SECONDS,
  Snowball,
  SnowballThrower,
  updateSnowballFight,
} from '../entities/snowball';
import {
  DialogueState,
  DialogueVariant,
  findNearbyInteractable,
  Interactable,
  INTERACTION_MAX_GAP_PX,
  rectEdgeDistance,
} from './interaction';
import {
  BASEMENT_FRONT_DOOR_BOUNDS,
  BASEMENT_HALL_NORTH_DOOR_BOUNDS,
  BASEMENT_MINE_EXPLOSION_DAMAGE,
  BASEMENT_MINE_EXPLOSION_RADIUS,
  BASEMENT_SPA_HIDDEN_MASK,
  BASEMENT_SPA_MEDKIT_POS,
  BASEMENT_STAIRS_SIDE_NORTH_BOUNDS,
  BASEMENT_STAIRS_SIDE_SOUTH_BOUNDS,
  BASEMENT_STAIRS_TRIGGER_BOUNDS,
  isPlayerOnBasementStairs,
  LevelBasement,
  USED_STAIRS_STATE_KEY,
} from './levels/levelBasement';
import {
  LevelUpstairs,
  UPSTAIRS_INTRO_STATE_KEY,
  UPSTAIRS_KITCHEN_MEDKIT_POS,
  UPSTAIRS_STAIRS_TRIGGER_BOUNDS,
} from './levels/levelUpstairs';
import {
  ClimbingState,
  createMotorcycle,
  LevelOutside,
  MotorcycleState,
  MotorcycleStatus,
} from './levels/levelOutside';
import { LevelPeople } from './levels/levelPeople';
import { GameLevel, LevelId, LevelTransitionContext } from './levels/types';
import {
  directionToYaw,
  getMainHouseRoofElevation,
  getTerrainHeight,
} from '../rendering/math3d';
import {
  CLIMB_DURATION_SECONDS,
  DAMAGED_WIRE_HAZARD,
  ELECTROCUTION_DURATION_SECONDS,
  isRectCollidingWithMap,
  LADDER_BOTTOM_Y,
  LADDER_CLIMB_X,
  MAIN_HOUSE_ROOF_BOUNDS,
  MOTORCYCLE_CRASH_X,
  MOTORCYCLE_SPEED,
  MOTORCYCLE_START_Y,
  PLAYER_START_X,
  PLAYER_START_Y,
  ROOF_CHIMNEY_BOUNDS,
  ROOF_WALK_Y,
  STARTER_MAP,
  TILE_SIZE,
  TileMap,
  TileType,
} from './tilemap';

export { createMotorcycle };
export type { ClimbingState, MotorcycleState, MotorcycleStatus };

export const BULLET_HOLE_DURATION_SECONDS = 10;
export const BLOOD_POOL_DURATION_SECONDS = 20;

export interface Projectile {
  kind?: 'bullet' | 'fireball' | 'rocket';
  owner?: 'player' | 'npc';
  sourceNpcKey?: string;
  cutsceneShot?: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz?: number;
  yaw: number;
  distanceTraveled?: number;
  maxDistance?: number;
  fromRoof?: boolean;
}

export interface ExplosionBurst {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  timer: number;
  maxTimer: number;
}

export interface BulletHole {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  age: number;
  maxAge: number;
}

export interface BloodParticle {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  groundZ: number;
  age: number;
  spawnsPool?: boolean;
}

export interface BloodPool {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  age: number;
  maxAge: number;
}

export const PLAYER_DROPPED_UZI_DURATION_SECONDS = 3.0;
export const MEDKIT_HEAL_AMOUNT = 25;

export interface DroppedUzi {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pickupable?: boolean;
  ammo?: number;
  age?: number;
  maxAge?: number;
}

export interface DroppedFlamethrower {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  ammo: number;
}

export interface MedkitPickup {
  id: string;
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
}

export const WALL_DESTRUCTION_DURATION_SECONDS = 1.0;
export const ROCKET_WALL_BLAST_RADIUS = 1.0 * TILE_SIZE;

export interface DroppedKatana {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface DroppedBazooka {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface DestroyingWall {
  levelId: LevelId;
  col: number;
  row: number;
  elapsed: number;
  duration: number;
  replacementTile: TileType;
}

export interface DestroyingDoor {
  levelId: LevelId;
  doorId: string;
  bounds: Rect;
  elapsed: number;
  duration: number;
}

export interface LevelRegistry {
  'level-outside': LevelOutside;
  'level-basement': LevelBasement;
  'level-upstairs': LevelUpstairs;
  'level-people': LevelPeople;
}

export interface ScreenFadeState {
  phase: 'out' | 'in';
  timer: number;
  duration: number;
  onMidpoint?: () => void;
  onComplete?: () => void;
}

export interface GameState {
  currentLevelId: LevelId;
  levels: LevelRegistry;
  map: TileMap;
  player: Player;
  footprints: Footprint[];
  dog: Dog;
  motorcycle: MotorcycleState;
  throwers: SnowballThrower[];
  snowballs: Snowball[];
  projectiles: Projectile[];
  bulletHoles: BulletHole[];
  bloodParticles: BloodParticle[];
  bloodPools: BloodPool[];
  droppedUzis: DroppedUzi[];
  droppedFlamethrowers: DroppedFlamethrower[];
  droppedKatanas: DroppedKatana[];
  droppedBazookas: DroppedBazooka[];
  medkits: MedkitPickup[];
  explosions: ExplosionBurst[];
  destroyingWalls: DestroyingWall[];
  destroyingDoors: DestroyingDoor[];
  blackenedWalls: Set<string>;
  mapVersion: number;
  burningNpcs: Set<string>;
  hasLadder: boolean;
  ladderPlaced: boolean;
  isOnRoof: boolean;
  climbing: ClimbingState | null;
  electrocutionTimer: number;
  joystickActive: boolean;
  interactables: Interactable[];
  nearbyInteractable: Interactable | null;
  activeDialogue: DialogueState | null;
  gameOver: boolean;
  elapsedTime: number;
  debugMode: boolean;
  cheatMode: boolean;
  worldFadedToBlack: boolean;
  damageFlashTimer: number;
  houseExploding: boolean;
  houseExplosionTimer: number;
  houseExplosionSpawnAccum: number;
  screenFade: ScreenFadeState | null;
  secretSantaDB: SecretSantaDB | null;
}

function syncOutsideToLevel(state: GameState): void {
  const outside = state.levels['level-outside'];
  outside.dog = state.dog;
  outside.motorcycle = state.motorcycle;
  outside.throwers = state.throwers;
  outside.snowballs = state.snowballs;
  outside.hasLadder = state.hasLadder;
  outside.ladderPlaced = state.ladderPlaced;
  outside.isOnRoof = state.isOnRoof;
  outside.climbing = state.climbing;
  outside.electrocutionTimer = state.electrocutionTimer;
}

function syncLevelToOutside(state: GameState): void {
  const outside = state.levels['level-outside'];
  state.dog = outside.dog;
  state.motorcycle = outside.motorcycle;
  state.throwers = outside.throwers;
  state.snowballs = outside.snowballs;
  state.hasLadder = outside.hasLadder;
  state.ladderPlaced = outside.ladderPlaced;
  state.isOnRoof = outside.isOnRoof;
  state.climbing = outside.climbing;
  state.electrocutionTimer = outside.electrocutionTimer;
}

export function getActiveLevel(state: GameState): GameLevel {
  return state.levels[state.currentLevelId];
}

export function refreshInteractables(state: GameState): void {
  if (state.currentLevelId === 'level-outside') {
    syncOutsideToLevel(state);
  }
  const activeLevel = getActiveLevel(state);
  state.interactables = activeLevel.getInteractables(state.player);

  const isBusyOutside =
    state.currentLevelId === 'level-outside' &&
    (state.climbing !== null ||
      state.motorcycle.status === 'driving' ||
      state.electrocutionTimer > 0);

  const isBusyUpstairs =
    state.currentLevelId === 'level-upstairs' &&
    state.levels['level-upstairs'].rosannaCutscene?.active === true;

  state.nearbyInteractable =
    isBusyOutside || isBusyUpstairs
      ? null
      : findNearbyInteractable(state.player, state.interactables);

  if (
    !state.nearbyInteractable &&
    !isBusyOutside &&
    !isBusyUpstairs &&
    state.player.equippedItem === 'uzi' &&
    state.player.unlockedUzi &&
    !state.player.uziDepleted
  ) {
    for (const floorUzi of state.droppedUzis) {
      if (!floorUzi.pickupable || floorUzi.levelId !== state.currentLevelId) {
        continue;
      }
      const uziRect: Rect = {
        x: floorUzi.x - 7,
        y: floorUzi.y - 7,
        width: 14,
        height: 14,
      };
      if (rectsIntersect(state.player, uziRect)) {
        state.nearbyInteractable = {
          id: 'swap-floor-uzi',
          bounds: uziRect,
          promptText: 'Swap Uzi',
          dialogueLines: [],
        };
        break;
      }
    }
  }
}

/**
 * Transitions the game to `levelId`, preserving the persistent `state.player`
 * (and `state.player.states` Map), spawning the player at the level's entry point,
 * and logging `"Loaded level: <levelId>"` to the debug console.
 */
export function loadLevel(state: GameState, levelId: LevelId): void {
  if (state.currentLevelId === 'level-outside') {
    state.isOnRoof = false;
    state.climbing = null;
    syncOutsideToLevel(state);
  }

  state.currentLevelId = levelId;
  const nextLevel = state.levels[levelId];
  state.map = nextLevel.map;
  state.footprints = [];
  state.projectiles = [];
  state.nearbyInteractable = null;
  state.activeDialogue = null;

  nextLevel.enter(state.player);
  refreshInteractables(state);
  debugLog(`Loaded level: ${levelId}`);
}

export interface CreateGameStateOptions {
  map?: TileMap;
  isMobile?: boolean;
  showIntroDialogue?: boolean;
  initialLevelId?: LevelId;
  levelParamOverride?: boolean;
  debug?: boolean;
  cheat?: boolean;
  giveUpSorry?: boolean;
  secretSantaDB?: SecretSantaDB | null;
}

/**
 * Parses the `?level=X` URL query parameter, mapping:
 * - 'outdoors' / 'outside' / 'level-outside' -> 'level-outside' (default)
 * - 'basement' / 'level-basement' -> 'level-basement'
 * - 'upstairs' / 'level-upstairs' -> 'level-upstairs'
 *
 * Accepts either the entire search string (e.g. `window.location.search`)
 * or the raw parameter value (e.g. `new URLSearchParams(location.search).get('level')`).
 */
export function parseLevelQueryParam(
  searchOrParam: string | null | undefined
): LevelId {
  if (!searchOrParam) {
    return 'level-outside';
  }
  let val = searchOrParam.trim();
  if (val.startsWith('?')) {
    const params = new URLSearchParams(val);
    val = params.get('level') ?? '';
  }
  const normalized = val.toLowerCase().trim();
  if (normalized === 'basement' || normalized === 'level-basement') {
    return 'level-basement';
  }
  if (normalized === 'upstairs' || normalized === 'level-upstairs') {
    return 'level-upstairs';
  }
  if (normalized === 'people' || normalized === 'level-people') {
    return 'level-people';
  }
  if (
    normalized === 'outdoors' ||
    normalized === 'outside' ||
    normalized === 'level-outside'
  ) {
    return 'level-outside';
  }
  return 'level-outside';
}

export function createIntroDialogue(isMobile: boolean): DialogueState {
  const firstLine = isMobile
    ? 'Use the virtual joystick to move around. To interact with things, move close enough to it and an interaction button will appear. Click anywhere to close this window and start playing.'
    : 'Use WASD to move around, the arrow keys to look around, and Space to jump and interact with things. Press Space to close this window and start playing.';

  return {
    lines: [firstLine, 'Good luck!\nChristmas depends on you...'],
    currentIndex: 0,
  };
}

export function createGameState(
  mapOrOptions: TileMap | CreateGameStateOptions = STARTER_MAP
): GameState {
  let map: TileMap = STARTER_MAP;
  let isMobile = false;
  let showIntroDialogue = false;
  let initialLevelId: LevelId = 'level-outside';
  let levelParamOverride = false;
  let debugMode = false;
  let cheatMode = false;
  let giveUpSorry = false;
  let secretSantaDB: SecretSantaDB | null = null;

  if (mapOrOptions && 'cols' in mapOrOptions && 'rows' in mapOrOptions) {
    map = mapOrOptions as TileMap;
  } else if (mapOrOptions && typeof mapOrOptions === 'object') {
    const opts = mapOrOptions as CreateGameStateOptions;
    if (opts.map) map = opts.map;
    if (opts.isMobile !== undefined) isMobile = opts.isMobile;
    if (opts.showIntroDialogue !== undefined) {
      showIntroDialogue = opts.showIntroDialogue;
    }
    if (opts.initialLevelId) {
      initialLevelId = opts.initialLevelId;
    }
    if (opts.levelParamOverride !== undefined) {
      levelParamOverride = opts.levelParamOverride;
    }
    if (opts.debug !== undefined) {
      debugMode = opts.debug;
    }
    if (opts.cheat !== undefined) {
      cheatMode = opts.cheat;
    }
    if (opts.giveUpSorry !== undefined) {
      giveUpSorry = opts.giveUpSorry;
    }
    if (opts.secretSantaDB !== undefined) {
      secretSantaDB = opts.secretSantaDB;
    }
  }

  ConeOfSight.cheatMode = cheatMode;

  const player = createPlayer(PLAYER_START_X, PLAYER_START_Y);
  const levelOutside = new LevelOutside(map);
  if (cheatMode) {
    levelOutside.ladderPlaced = true;
  }
  const levelBasement = new LevelBasement();
  const levelUpstairs = new LevelUpstairs();
  const levelPeople = new LevelPeople();

  const levels: LevelRegistry = {
    'level-outside': levelOutside,
    'level-basement': levelBasement,
    'level-upstairs': levelUpstairs,
    'level-people': levelPeople,
  };

  const activeLevel = levels[initialLevelId];
  activeLevel.enter(player);

  if (levelParamOverride) {
    player.unlockedUzi = true;
    player.uziAmmo = MAX_UZI_AMMO;
    player.uziDepleted = false;
    player.uziDropTimer = 0;
    player.equippedItem = 'uzi';
  }

  let activeDialogue: DialogueState | null = null;
  let worldFadedToBlack = false;

  if (giveUpSorry) {
    worldFadedToBlack = true;
    const playerName = secretSantaDB?.playerName;
    const receiver =
      playerName && secretSantaDB
        ? secretSantaDB.getGiftReceiverOf(playerName)
        : undefined;
    const finalLine =
      receiver ?? 'Ehm... this is awkward. An error occurred, gift receiver unknown.';
    activeDialogue = {
      lines: [
        "Give up huh? Don't feel bad... Your secret santa gift receiver is...",
        finalLine,
      ],
      currentIndex: 0,
      unclosable: true,
    };
  } else if (showIntroDialogue) {
    activeDialogue = createIntroDialogue(isMobile);
  }

  const state: GameState = {
    currentLevelId: initialLevelId,
    levels,
    map: activeLevel.map,
    player,
    footprints: [],
    dog: levelOutside.dog,
    motorcycle: levelOutside.motorcycle,
    throwers: levelOutside.throwers,
    snowballs: levelOutside.snowballs,
    projectiles: [],
    bulletHoles: [],
    bloodParticles: [],
    bloodPools: [],
    droppedUzis: [],
    droppedFlamethrowers: [],
    droppedKatanas: [],
    droppedBazookas: [],
    medkits: [
      {
        id: 'basement-spa-medkit',
        levelId: 'level-basement',
        x: BASEMENT_SPA_MEDKIT_POS.x,
        y: BASEMENT_SPA_MEDKIT_POS.y,
        z: 0,
      },
      {
        id: 'upstairs-kitchen-medkit',
        levelId: 'level-upstairs',
        x: UPSTAIRS_KITCHEN_MEDKIT_POS.x,
        y: UPSTAIRS_KITCHEN_MEDKIT_POS.y,
        z: 0,
      },
    ],
    explosions: [],
    destroyingWalls: [],
    destroyingDoors: [],
    blackenedWalls: new Set<string>(),
    mapVersion: 0,
    burningNpcs: new Set<string>(),
    hasLadder: levelOutside.hasLadder,
    ladderPlaced: levelOutside.ladderPlaced,
    isOnRoof: levelOutside.isOnRoof,
    climbing: levelOutside.climbing,
    electrocutionTimer: levelOutside.electrocutionTimer,
    joystickActive: false,
    interactables: activeLevel.getInteractables(player),
    nearbyInteractable: null,
    activeDialogue,
    gameOver: false,
    elapsedTime: 0,
    debugMode,
    cheatMode,
    worldFadedToBlack,
    damageFlashTimer: 0,
    houseExploding: false,
    houseExplosionTimer: 0,
    houseExplosionSpawnAccum: 0,
    screenFade: null,
    secretSantaDB,
  };

  debugLog(`Loaded level: ${initialLevelId}`);
  return state;
}

export function restartEntireGame(state: GameState): void {
  const prevJoystick = state.joystickActive;
  const fresh = createGameState({
    initialLevelId: 'level-outside',
    debug: state.debugMode,
    cheat: state.cheatMode,
    secretSantaDB: state.secretSantaDB,
  });
  Object.assign(state, fresh);
  state.joystickActive = prevJoystick;
}

export function restartFromBasementCheckpoint(state: GameState): void {
  const prevJoystick = state.joystickActive;
  const fresh = createGameState({
    initialLevelId: 'level-basement',
    showIntroDialogue: false,
    debug: state.debugMode,
    cheat: state.cheatMode,
    secretSantaDB: state.secretSantaDB,
  });
  fresh.player.unlockedUzi = true;
  fresh.player.uziAmmo = MAX_UZI_AMMO;
  fresh.player.uziDepleted = false;
  fresh.player.uziDropTimer = 0;
  fresh.player.uziReloadTimer = 0;
  fresh.player.equippedItem = 'uzi';
  fresh.player.facing = 'down';
  fresh.player.yaw = Math.PI / 2;
  fresh.player.renderYaw = Math.PI / 2;
  Object.assign(state, fresh);
  state.joystickActive = prevJoystick;
}

export const DAMAGE_FLASH_DURATION_SECONDS = 0.3;
export const BAZOOKA_PLAYER_EXPLOSION_DAMAGE = 20;

export function damagePlayer(state: GameState, amount: number): void {
  applyPlayerDamage(state.player, amount);
  if (amount > 0) {
    state.damageFlashTimer = DAMAGE_FLASH_DURATION_SECONDS;
  }
  if (state.player.health <= 0 && !state.cheatMode) {
    const insideHouse =
      state.currentLevelId === 'level-basement' ||
      state.currentLevelId === 'level-upstairs';
    state.gameOver = true;
    state.nearbyInteractable = null;
    state.activeDialogue = {
      lines: ['Try again?'],
      currentIndex: 0,
      variant: 'gameover',
      onClose: () => {
        if (insideHouse) {
          restartFromBasementCheckpoint(state);
        } else {
          restartEntireGame(state);
        }
      },
    };
  }
}

/**
 * Resets the outdoor map state when Santa takes damage (from a snowball, the sparking EV wire, or the loving dog):
 * - Teleports Santa back to the bottom of the driveway facing up
 * - Starts Santa's blinking timer
 * - Resets the dog, motorcycle, ladder state, snowball throwers, footprints, and flying snowballs
 */
export function resetAfterSnowballHit(state: GameState): void {
  state.player.x = PLAYER_START_X;
  state.player.y = PLAYER_START_Y;
  state.player.facing = 'up';
  state.player.yaw = -Math.PI / 2;
  state.player.renderYaw = -Math.PI / 2;
  state.player.jumpOffset = 0;
  state.player.jumpVelocity = 0;
  state.player.isMoving = false;
  state.player.walkTimer = 0;
  state.player.blinkTimer = HIT_BLINK_DURATION_SECONDS;
  state.player.footprintSpawnTimer = 0;
  state.player.nextFootprintFoot = 'left';

  const wasLadderPlaced = state.ladderPlaced;
  state.footprints = [];
  state.dog = createDog();
  state.motorcycle = createMotorcycle();
  state.throwers = createDrivewayThrowers();
  state.snowballs = [];
  state.projectiles = [];
  state.hasLadder = false;
  state.ladderPlaced = wasLadderPlaced;
  state.isOnRoof = false;
  state.climbing = null;
  state.electrocutionTimer = 0;
  state.activeDialogue = null;
  syncOutsideToLevel(state);
  refreshInteractables(state);
  damagePlayer(state, 30);
}

function isMainHouseTile(col: number, row: number): boolean {
  return col >= 4 && col <= 16 && row >= 3 && row <= 9;
}

function updateRoofMovement(
  state: GameState,
  input: InputState,
  dtSeconds: number
): void {
  const player = state.player;
  const prevCenterX = player.x + player.width * 0.5;
  const prevCenterZ = player.y + player.height * 0.5;
  const prevRoofElevation = getMainHouseRoofElevation(prevCenterX, prevCenterZ);

  const chimneyCore: Rect = {
    x: ROOF_CHIMNEY_BOUNDS.x + 3,
    y: ROOF_CHIMNEY_BOUNDS.y + 3,
    width: Math.max(4, ROOF_CHIMNEY_BOUNDS.width - 6),
    height: Math.max(4, ROOF_CHIMNEY_BOUNDS.height - 6),
  };

  // On the roof, Santa can walk freely in 2D without colliding with the house beneath him,
  // while still colliding with the brick chimney core and forest behind the house.
  updatePlayer(
    player,
    input,
    dtSeconds,
    state.map,
    [chimneyCore],
    isMainHouseTile
  );

  const cx = player.x + player.width * 0.5;
  const cz = player.y + player.height * 0.5;
  const minX = MAIN_HOUSE_ROOF_BOUNDS.x;
  const maxX = MAIN_HOUSE_ROOF_BOUNDS.x + MAIN_HOUSE_ROOF_BOUNDS.width;
  const minZ = MAIN_HOUSE_ROOF_BOUNDS.y;
  const maxZ = MAIN_HOUSE_ROOF_BOUNDS.y + MAIN_HOUSE_ROOF_BOUNDS.height;

  if (cx < minX || cx > maxX || cz < minZ || cz > maxZ) {
    state.isOnRoof = false;
    if (cx < minX) {
      player.x = minX - player.width - 1;
    } else if (cx > maxX) {
      player.x = maxX + 1;
    }
    if (cz < minZ) {
      player.y = minZ - player.height - 1;
    } else if (cz > maxZ) {
      player.y = maxZ + 1;
    }

    const landingGroundY = getTerrainHeight(
      player.x + player.width * 0.5,
      player.y + player.height * 0.5,
      'level-outside'
    );
    player.jumpOffset = Math.max(0.001, prevRoofElevation - landingGroundY);
    player.jumpVelocity = 0;
  }
}

function updateOutsideLevel(
  state: GameState,
  input: InputState,
  dtSeconds: number
): boolean {
  // If Santa is currently being electrocuted on the sparking wire
  if (state.electrocutionTimer > 0) {
    state.player.isMoving = false;
    state.player.walkTimer = 0;
    state.electrocutionTimer = Math.max(
      0,
      state.electrocutionTimer - dtSeconds
    );
    if (state.electrocutionTimer <= 0) {
      resetAfterSnowballHit(state);
    }
    return true;
  }

  // If Santa is riding the motorcycle straight east into the trees
  if (state.motorcycle.status === 'driving') {
    state.motorcycle.x = Math.min(
      MOTORCYCLE_CRASH_X,
      state.motorcycle.x + MOTORCYCLE_SPEED * dtSeconds
    );
    state.player.x = state.motorcycle.x + 8;
    state.player.y = state.motorcycle.y - 2;
    state.player.facing = 'right';
    state.player.yaw = 0;
    state.player.renderYaw = 0;
    state.player.isMoving = true;
    state.player.walkTimer += dtSeconds;

    if (state.motorcycle.x >= MOTORCYCLE_CRASH_X) {
      state.motorcycle.x = MOTORCYCLE_CRASH_X;
      state.motorcycle.status = 'crashed';
      // Spawn Santa right next to the crashed motorcycle, blinking, without resetting the map!
      state.player.x = MOTORCYCLE_CRASH_X - state.player.width - 4;
      state.player.y = MOTORCYCLE_START_Y + 2;
      state.player.isMoving = false;
      state.player.walkTimer = 0;
      state.player.blinkTimer = HIT_BLINK_DURATION_SECONDS;
      damagePlayer(state, 10);
    }

    refreshInteractables(state);
    return true;
  }

  // If Santa is currently climbing straight up or down the ladder outside the south wall
  if (state.climbing) {
    state.climbing.progress = Math.min(
      1,
      state.climbing.progress + dtSeconds / CLIMB_DURATION_SECONDS
    );
    state.player.x = LADDER_CLIMB_X;
    state.player.isMoving = true;
    state.player.walkTimer += dtSeconds;

    if (state.climbing.direction === 'up') {
      state.player.facing = 'up';
      state.player.yaw = -Math.PI / 2;
      state.player.renderYaw = -Math.PI / 2;
      state.player.y = LADDER_BOTTOM_Y;
      if (state.climbing.progress >= 1) {
        state.player.y = ROOF_WALK_Y;
        state.player.isMoving = false;
        state.isOnRoof = true;
        state.climbing = null;
      }
    } else {
      state.player.facing = 'down';
      state.player.yaw = Math.PI / 2;
      state.player.renderYaw = Math.PI / 2;
      state.player.y = LADDER_BOTTOM_Y;
      if (state.climbing.progress >= 1) {
        state.player.y = LADDER_BOTTOM_Y;
        state.player.isMoving = false;
        state.isOnRoof = false;
        state.climbing = null;
      }
    }

    refreshInteractables(state);
    return true;
  }

  if (state.isOnRoof) {
    updateRoofMovement(state, input, dtSeconds);
    for (let i = state.footprints.length - 1; i >= 0; i--) {
      state.footprints[i].age += dtSeconds;
      if (state.footprints[i].age >= state.footprints[i].maxAge) {
        state.footprints.splice(i, 1);
      }
    }
    syncOutsideToLevel(state);
    return false;
  }

  const solidObstacles: Rect[] = [...state.throwers, state.motorcycle];

  // Move player on the ground
  updatePlayer(state.player, input, dtSeconds, state.map, solidObstacles);

  // Update snow footprints (spawns on snow tiles only and fades out over 3 seconds)
  updateFootprints(state.footprints, state.player, state.map, dtSeconds);

  // Check if Santa stepped on the visibly damaged, sparking EV charging cable
  if (rectsIntersect(state.player, DAMAGED_WIRE_HAZARD)) {
    state.electrocutionTimer = ELECTROCUTION_DURATION_SECONDS;
    state.player.isMoving = false;
    state.player.walkTimer = 0;
    state.nearbyInteractable = null;
    state.activeDialogue = null;
    return true;
  }

  // Update the dog on the east snow field (constant half-speed across all platforms)
  const caughtByDog = updateDog(
    state.dog,
    state.player,
    dtSeconds,
    state.map,
    solidObstacles
  );
  if (caughtByDog) {
    resetAfterSnowballHit(state);
    return true;
  }

  // Update snowball fight on the driveway
  const hitBySnowball = updateSnowballFight(
    state.throwers,
    state.snowballs,
    state.player,
    dtSeconds
  );
  if (hitBySnowball) {
    resetAfterSnowballHit(state);
    return true;
  }

  return false;
}

interface NpcTarget {
  key: string;
  rect: Rect;
  groundZ: number;
}

function getLevelNpcTargets(state: GameState): NpcTarget[] {
  const targets: NpcTarget[] = [];
  const addTarget = (key: string, rect: Rect): void => {
    const cx = rect.x + rect.width * 0.5;
    const cy = rect.y + rect.height * 0.5;
    targets.push({
      key,
      rect,
      groundZ: getTerrainHeight(cx, cy, state.currentLevelId),
    });
  };

  if (state.currentLevelId === 'level-outside') {
    if (state.throwers[0]) addTarget('outside:Sylvester', state.throwers[0]);
    if (state.throwers[1]) addTarget('outside:Annelotte', state.throwers[1]);
    addTarget('outside:Alex', state.levels['level-outside'].alexNpc);
  } else if (state.currentLevelId === 'level-basement') {
    const basement = state.levels['level-basement'];
    if (basement.arjanCombat.mode !== 'dead') {
      addTarget('basement:Arjan', basement.windowNpc);
    }
    if (basement.olexaCombat.mode !== 'dead') {
      addTarget('basement:Olexa', basement.olexaNpc);
    }
    if (basement.hanneloesCombat.mode !== 'dead') {
      addTarget('basement:Hanneloes', basement.toiletNpc);
    }
  } else if (state.currentLevelId === 'level-upstairs') {
    const upstairs = state.levels['level-upstairs'];
    if (upstairs.albinCombat.mode !== 'dead') {
      addTarget('upstairs:Albin', {
        x: upstairs.albinX,
        y: upstairs.albinY,
        width: 12,
        height: 12,
      });
    }
    if (upstairs.henrikCombat.mode !== 'dead') addTarget('upstairs:Henrik', upstairs.henrikNpc);
    if (upstairs.tanjaCombat.mode !== 'dead') addTarget('upstairs:Tanja', upstairs.tanjaNpc);
    if (upstairs.dianaCombat.mode !== 'dead') addTarget('upstairs:Diana', upstairs.dianaNpc);
    if (upstairs.simonCombat.mode !== 'dead') addTarget('upstairs:Simon', upstairs.simonNpc);
    if (upstairs.anneMarieCombat.mode !== 'dead') {
      addTarget('upstairs:Anne-Marie', upstairs.anneMarieNpc);
    }
    if (upstairs.rosannaSpawned && upstairs.rosannaCombat.mode !== 'dead') {
      addTarget('upstairs:Rosanna', upstairs.rosannaNpc);
    }
  } else if (state.currentLevelId === 'level-people') {
    for (const npc of state.levels['level-people'].npcs) {
      addTarget(`people:${npc.name}`, npc.bounds);
    }
  }
  return targets;
}

function spawnNpcBlood(
  state: GameState,
  x: number,
  y: number,
  groundZ: number
): void {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const speed = 16 + Math.random() * 24;
    state.bloodParticles.push({
      levelId: state.currentLevelId,
      x,
      y,
      z: groundZ + 7 + Math.random() * 3,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: -4 + Math.random() * 20,
      groundZ,
      age: 0,
      spawnsPool: i < 3,
    });
  }
}

function getArmedNpcByKey(state: GameState, key: string): ArmedNpcState | undefined {
  if (state.currentLevelId === 'level-basement') {
    return state.levels['level-basement'].getArmedNpcByKey(key);
  }
  if (state.currentLevelId === 'level-upstairs') {
    return state.levels['level-upstairs'].getArmedNpcByKey(key);
  }
  return undefined;
}

export const ROSANNA_DAMAGE_MULTIPLIER = 0.2; // Rosanna takes 1/5th damage

function damageArmedNpc(
  state: GameState,
  key: string,
  damage: number,
  hitX: number,
  hitY: number,
  groundZ: number
): void {
  const npc = getArmedNpcByKey(state, key);
  if (!npc) return;
  const wasPassive = npc.mode === 'passive';
  const effectiveDamage =
    key === 'upstairs:Rosanna' ? damage * ROSANNA_DAMAGE_MULTIPLIER : damage;
  const died = applyNpcDamage(npc, effectiveDamage);
  if (wasPassive && (npc.mode as string) === 'hostile') {
    if (state.currentLevelId === 'level-basement') {
      propagateHostileAlert(state.levels['level-basement'].getArmedNpcs(), key);
    } else if (state.currentLevelId === 'level-upstairs') {
      propagateHostileAlert(state.levels['level-upstairs'].getArmedNpcs(), key);
    }
  }
  if (died) {
    state.burningNpcs.delete(key);
    spawnNpcBlood(state, hitX, hitY, groundZ);
    state.bloodPools.push({
      levelId: state.currentLevelId,
      x: hitX,
      y: hitY,
      z: groundZ,
      age: 0,
      maxAge: 999999,
    });
    const rightAngle = npc.aimYaw + Math.PI / 2;
    if (npc.weapon === 'katana') {
      state.droppedKatanas.push({
        levelId: state.currentLevelId,
        x: hitX + Math.cos(rightAngle) * 5.2,
        y: hitY + Math.sin(rightAngle) * 5.2,
        z: groundZ,
        yaw: npc.aimYaw + 0.4,
      });
    } else if (npc.weapon === 'flamethrower') {
      state.droppedFlamethrowers.push({
        levelId: state.currentLevelId,
        x: hitX + Math.cos(rightAngle) * 5.2,
        y: hitY + Math.sin(rightAngle) * 5.2,
        z: groundZ,
        yaw: npc.aimYaw + 0.4,
        ammo: DROPPED_FLAMETHROWER_AMMO,
      });
    } else if (npc.weapon === 'bazooka') {
      state.droppedBazookas.push({
        levelId: state.currentLevelId,
        x: hitX + Math.cos(rightAngle) * 5.2,
        y: hitY + Math.sin(rightAngle) * 5.2,
        z: groundZ,
        yaw: npc.aimYaw + 0.4,
      });
    } else if (npc.weapon === 'uzi') {
      state.droppedUzis.push({
        levelId: state.currentLevelId,
        x: hitX + Math.cos(rightAngle) * 5.2,
        y: hitY + Math.sin(rightAngle) * 5.2,
        z: groundZ,
        yaw: npc.aimYaw + 0.4,
        pickupable: true,
        ammo: MAX_UZI_AMMO,
      });
    }
    if (key === 'basement:Olexa') {
      state.medkits.push({
        id: 'olexa-drop-medkit',
        levelId: state.currentLevelId,
        x: hitX - Math.cos(rightAngle) * 5.5,
        y: hitY - Math.sin(rightAngle) * 5.5,
        z: groundZ,
      });
    }
  }
}

function fireNpcUziProjectile(
  state: GameState,
  npc: ArmedNpcState,
  originX: number,
  originY: number,
  aimYaw: number
): void {
  const rightAngle = aimYaw + Math.PI / 2;
  const groundZ = getTerrainHeight(originX, originY, state.currentLevelId);

  const yawSpread = (Math.random() * 2 - 1) * ((10 * Math.PI) / 180);
  const shotYaw = aimYaw + yawSpread;
  const pitchSpread = (Math.random() * 2 - 1) * ((5 * Math.PI) / 180);

  const spawnX =
    originX + Math.cos(aimYaw) * 7.5 + Math.cos(rightAngle) * 3.8;
  const spawnY =
    originY + Math.sin(aimYaw) * 7.5 + Math.sin(rightAngle) * 3.8;
  const spawnZ = groundZ + 10.0;

  state.projectiles.push({
    kind: 'bullet',
    owner: 'npc',
    sourceNpcKey: npc.key,
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    vx: Math.cos(shotYaw) * UZI_PROJECTILE_SPEED,
    vy: Math.sin(shotYaw) * UZI_PROJECTILE_SPEED,
    vz: UZI_PROJECTILE_SPEED * Math.tan(pitchSpread),
    yaw: shotYaw,
    distanceTraveled: 0,
    fromRoof: false,
  });
}

function fireNpcFlamethrowerProjectile(
  state: GameState,
  npc: ArmedNpcState,
  originX: number,
  originY: number,
  aimYaw: number
): void {
  const rightAngle = aimYaw + Math.PI / 2;
  const groundZ = getTerrainHeight(originX, originY, state.currentLevelId);

  const spawnX =
    originX + Math.cos(aimYaw) * 8.5 + Math.cos(rightAngle) * 3.5;
  const spawnY =
    originY + Math.sin(aimYaw) * 8.5 + Math.sin(rightAngle) * 3.5;
  const spawnZ = groundZ + 9.5;

  state.projectiles.push({
    kind: 'fireball',
    owner: 'npc',
    sourceNpcKey: npc.key,
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    vx: Math.cos(aimYaw) * FLAMETHROWER_PROJECTILE_SPEED,
    vy: Math.sin(aimYaw) * FLAMETHROWER_PROJECTILE_SPEED,
    vz: 0,
    yaw: aimYaw,
    distanceTraveled: 0,
    maxDistance: FLAMETHROWER_MAX_DISTANCE,
    fromRoof: false,
  });
}

function fireNpcBazookaProjectile(
  state: GameState,
  originX: number,
  originY: number,
  aimYaw: number,
  sourceNpcKey?: string,
  cutsceneShot: boolean = false
): void {
  const rightAngle = aimYaw + Math.PI / 2;
  const groundZ = getTerrainHeight(originX, originY, state.currentLevelId);

  const spawnX =
    originX + Math.cos(aimYaw) * 9.0 + Math.cos(rightAngle) * 3.0;
  const spawnY =
    originY + Math.sin(aimYaw) * 9.0 + Math.sin(rightAngle) * 3.0;
  const spawnZ = groundZ + 11.5;

  state.projectiles.push({
    kind: 'rocket',
    owner: 'npc',
    sourceNpcKey,
    cutsceneShot,
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    vx: Math.cos(aimYaw) * NPC_BAZOOKA_ROCKET_SPEED,
    vy: Math.sin(aimYaw) * NPC_BAZOOKA_ROCKET_SPEED,
    vz: 0,
    yaw: aimYaw,
    distanceTraveled: 0,
    maxDistance: 320,
    fromRoof: false,
  });
}

export function isOuterBorderWallTile(
  levelId: LevelId,
  map: TileMap,
  col: number,
  row: number
): boolean {
  // Double-thick library north backing in basement is directly backed by the north outer border
  if (levelId === 'level-basement' && row === 7 && col >= 6 && col <= 12) {
    return true;
  }
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (nr < 0 || nc < 0 || nr >= map.rows || nc >= map.cols) {
        return true;
      }
      if (map.tiles[nr][nc] === TileType.VoidBlack) {
        return true;
      }
    }
  }
  return false;
}

function getDestroyedWallReplacementTile(
  map: TileMap,
  col: number,
  row: number
): TileType {
  const floorCandidates = [
    TileType.BathroomTileFloor,
    TileType.StoneTileFloor,
    TileType.WoodFloor,
    TileType.StairsFloor,
  ];
  for (const [dc, dr] of [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
  ]) {
    const t = map.tiles[row + dr]?.[col + dc];
    if (t !== undefined && floorCandidates.includes(t)) {
      return t;
    }
  }
  return TileType.WoodFloor;
}

function distancePointToRect(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.width));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

function applyRocketExplosionToWallsAndDoors(
  state: GameState,
  x: number,
  y: number
): void {
  const levelId = state.currentLevelId;
  if (levelId !== 'level-basement' && levelId !== 'level-upstairs') {
    return;
  }
  const map = state.map;
  const ts = map.tileSize;
  const minCol = Math.max(0, Math.floor((x - ROCKET_WALL_BLAST_RADIUS) / ts));
  const maxCol = Math.min(
    map.cols - 1,
    Math.floor((x + ROCKET_WALL_BLAST_RADIUS) / ts)
  );
  const minRow = Math.max(0, Math.floor((y - ROCKET_WALL_BLAST_RADIUS) / ts));
  const maxRow = Math.min(
    map.rows - 1,
    Math.floor((y + ROCKET_WALL_BLAST_RADIUS) / ts)
  );

  let changed = false;
  const activeLevel = getActiveLevel(state);
  const levelDoors =
    levelId === 'level-basement'
      ? state.levels['level-basement'].doors
      : state.levels['level-upstairs'].doors;

  const activateNpcForRevealedDoor = (doorId: string): void => {
    if (levelId === 'level-upstairs' && doorId === 'upstairs-bedroom-door') {
      const upstairs = state.levels['level-upstairs'];
      if (upstairs.anneMarieCombat.mode === 'passive') {
        enterHostileMode(upstairs.anneMarieCombat);
        propagateHostileAlert(upstairs.getArmedNpcs(), upstairs.anneMarieCombat.key);
      }
    } else if (levelId === 'level-basement' && doorId === 'basement-bathroom-door') {
      const basement = state.levels['level-basement'];
      if (basement.toiletNpc.x >= 21 * TILE_SIZE) {
        basement.toiletNpc.x = 20 * TILE_SIZE + 2;
      }
      if (basement.hanneloesCombat.mode === 'passive') {
        enterHostileMode(basement.hanneloesCombat);
        propagateHostileAlert(basement.getArmedNpcs(), basement.hanneloesCombat.key);
      }
    }
  };

  const revealRoomsTouchingRect = (rect: Rect): void => {
    const expanded: Rect = {
      x: rect.x - ts - 2,
      y: rect.y - ts - 2,
      width: rect.width + ts * 2 + 4,
      height: rect.height + ts * 2 + 4,
    };
    for (const d of levelDoors) {
      if (d.hiddenRegions.some((hr) => rectsIntersect(expanded, hr))) {
        d.hiddenRegions = [];
        activateNpcForRevealedDoor(d.id);
        changed = true;
      }
    }
    if (
      levelId === 'level-basement' &&
      !state.levels['level-basement'].spaFogCleared &&
      rectsIntersect(expanded, BASEMENT_SPA_HIDDEN_MASK)
    ) {
      state.levels['level-basement'].spaFogCleared = true;
      changed = true;
    }
  };

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (map.tiles[row]?.[col] !== TileType.InteriorWall) continue;
      const tileRect: Rect = {
        x: col * ts,
        y: row * ts,
        width: ts,
        height: ts,
      };
      if (distancePointToRect(x, y, tileRect) > ROCKET_WALL_BLAST_RADIUS) {
        continue;
      }

      if (isOuterBorderWallTile(levelId, map, col, row)) {
        const key = `${levelId}:${col},${row}`;
        if (!state.blackenedWalls.has(key)) {
          state.blackenedWalls.add(key);
          changed = true;
        }
      } else {
        const alreadyDestroying = state.destroyingWalls.some(
          (w) => w.levelId === levelId && w.col === col && w.row === row
        );
        if (!alreadyDestroying) {
          state.destroyingWalls.push({
            levelId,
            col,
            row,
            elapsed: 0,
            duration: WALL_DESTRUCTION_DURATION_SECONDS,
            replacementTile: getDestroyedWallReplacementTile(map, col, row),
          });
          changed = true;
        }
        revealRoomsTouchingRect(tileRect);
      }
    }
  }

  // Interior doors within blast radius also turn black, squish & fade away over 1s
  for (const door of levelDoors) {
    if (distancePointToRect(x, y, door.bounds) <= ROCKET_WALL_BLAST_RADIUS) {
      if (
        !state.destroyingDoors.some(
          (d) => d.levelId === levelId && d.doorId === door.id
        )
      ) {
        state.destroyingDoors.push({
          levelId,
          doorId: door.id,
          bounds: { ...door.bounds },
          elapsed: 0,
          duration: WALL_DESTRUCTION_DURATION_SECONDS,
        });
        door.hiddenRegions = [];
        activateNpcForRevealedDoor(door.id);
        changed = true;
      }
    }
  }

  if (levelId === 'level-basement') {
    const basement = state.levels['level-basement'];
    // Interior Spa double door
    if (
      basement.spaDoorClosed &&
      distancePointToRect(x, y, BASEMENT_HALL_NORTH_DOOR_BOUNDS) <=
        ROCKET_WALL_BLAST_RADIUS &&
      !state.destroyingDoors.some(
        (d) =>
          d.levelId === 'level-basement' &&
          d.doorId === 'basement-hall-north-door'
      )
    ) {
      state.destroyingDoors.push({
        levelId: 'level-basement',
        doorId: 'basement-hall-north-door',
        bounds: { ...BASEMENT_HALL_NORTH_DOOR_BOUNDS },
        elapsed: 0,
        duration: WALL_DESTRUCTION_DURATION_SECONDS,
      });
      basement.spaFogCleared = true;
      changed = true;
    }
    // Exterior locked front door turns black but remains indestructible
    if (
      distancePointToRect(x, y, BASEMENT_FRONT_DOOR_BOUNDS) <=
      ROCKET_WALL_BLAST_RADIUS
    ) {
      for (const fc of [15, 16]) {
        const key = `level-basement:${fc},20`;
        if (!state.blackenedWalls.has(key)) {
          state.blackenedWalls.add(key);
          changed = true;
        }
      }
    }
  }

  void activeLevel;
  if (changed) {
    state.mapVersion += 1;
  }
}

function damageUpstairsCat(state: GameState, rawDamage: number): void {
  if (state.currentLevelId !== 'level-upstairs') return;
  const cat = state.levels['level-upstairs'].cat;
  if (!applyCatDamage(cat, rawDamage)) return;
  const ccx = cat.x + cat.width * 0.5;
  const ccy = cat.y + cat.height * 0.5;
  const groundZ = getTerrainHeight(ccx, ccy, state.currentLevelId);
  spawnNpcBlood(state, ccx, ccy, groundZ + cat.jumpZ);
}

const UPSTAIRS_HOUSE_EXPLOSION_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [3, 15],
  [6, 13],
  [4, 7],
  [11, 7],
  [14, 11],
  [18, 7],
  [24, 7],
  [22, 15],
  [26, 15],
  [11, 18],
];

function spawnHouseExplosionWave(state: GameState, jitter: boolean): void {
  const ts = state.map.tileSize;
  for (const [col, row] of UPSTAIRS_HOUSE_EXPLOSION_SPOTS) {
    const jx = jitter ? (Math.random() - 0.5) * ts * 1.4 : 0;
    const jy = jitter ? (Math.random() - 0.5) * ts * 1.4 : 0;
    const jz = jitter ? Math.random() * 10 : 0;
    state.explosions.push({
      levelId: 'level-upstairs',
      x: (col + 0.5) * ts + jx,
      y: (row + 0.5) * ts + jy,
      z: jz,
      timer: 0.65,
      maxTimer: 0.65,
    });
  }
}

function triggerUpstairsHouseExplosion(state: GameState): void {
  state.houseExploding = true;
  state.houseExplosionTimer = 2.0;
  state.houseExplosionSpawnAccum = 0;

  spawnHouseExplosionWave(state, false);

  const upstairs = state.levels['level-upstairs'];
  const map = upstairs.map;
  let changed = false;

  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      if (map.tiles[row]?.[col] !== TileType.InteriorWall) continue;
      if (isOuterBorderWallTile('level-upstairs', map, col, row)) {
        const key = `level-upstairs:${col},${row}`;
        if (!state.blackenedWalls.has(key)) {
          state.blackenedWalls.add(key);
          changed = true;
        }
      } else {
        const alreadyDestroying = state.destroyingWalls.some(
          (w) => w.levelId === 'level-upstairs' && w.col === col && w.row === row
        );
        if (!alreadyDestroying) {
          state.destroyingWalls.push({
            levelId: 'level-upstairs',
            col,
            row,
            elapsed: 0,
            duration: WALL_DESTRUCTION_DURATION_SECONDS,
            replacementTile: getDestroyedWallReplacementTile(map, col, row),
          });
          changed = true;
        }
      }
    }
  }

  for (const door of upstairs.doors) {
    door.hiddenRegions = [];
    if (
      !state.destroyingDoors.some(
        (d) => d.levelId === 'level-upstairs' && d.doorId === door.id
      )
    ) {
      state.destroyingDoors.push({
        levelId: 'level-upstairs',
        doorId: door.id,
        bounds: { ...door.bounds },
        elapsed: 0,
        duration: WALL_DESTRUCTION_DURATION_SECONDS,
      });
      changed = true;
    }
  }

  if (changed) {
    state.mapVersion += 1;
  }
}

function detonateRocket(
  state: GameState,
  x: number,
  y: number,
  cutsceneShot: boolean = false,
  sourceNpcKey?: string,
  owner: 'player' | 'npc' = 'npc'
): void {
  const groundZ = getTerrainHeight(x, y, state.currentLevelId);
  state.explosions.push({
    levelId: state.currentLevelId,
    x,
    y,
    z: groundZ,
    timer: 0.65,
    maxTimer: 0.65,
  });

  applyRocketExplosionToWallsAndDoors(state, x, y);

  if (!cutsceneShot) {
    if (owner === 'npc') {
      const playerCx = state.player.x + state.player.width * 0.5;
      const playerCy = state.player.y + state.player.height * 0.5;
      if (
        Math.hypot(playerCx - x, playerCy - y) <= BASEMENT_MINE_EXPLOSION_RADIUS
      ) {
        damagePlayer(state, BAZOOKA_PLAYER_EXPLOSION_DAMAGE);
      }
    }

    if (owner === 'player' && state.currentLevelId === 'level-upstairs') {
      const cat = state.levels['level-upstairs'].cat;
      if (cat.mode !== 'dead') {
        const ccx = cat.x + cat.width * 0.5;
        const ccy = cat.y + cat.height * 0.5;
        if (Math.hypot(ccx - x, ccy - y) <= BASEMENT_MINE_EXPLOSION_RADIUS) {
          damageUpstairsCat(state, BASEMENT_MINE_EXPLOSION_DAMAGE);
        }
      }
    }

    for (const target of getLevelNpcTargets(state)) {
      if (target.key === sourceNpcKey) continue;
      const ncx = target.rect.x + target.rect.width * 0.5;
      const ncy = target.rect.y + target.rect.height * 0.5;
      if (Math.hypot(ncx - x, ncy - y) <= BASEMENT_MINE_EXPLOSION_RADIUS) {
        damageArmedNpc(
          state,
          target.key,
          BASEMENT_MINE_EXPLOSION_DAMAGE,
          ncx,
          ncy,
          target.groundZ
        );
      }
    }
  }
}

function checkKatanaNpcHit(state: GameState): void {
  const player = state.player;
  const aimYaw =
    typeof player.yaw === 'number'
      ? player.yaw
      : directionToYaw(player.facing);
  const cx = player.x + player.width * 0.5 + Math.cos(aimYaw) * 10;
  const cy = player.y + player.height * 0.5 + Math.sin(aimYaw) * 10;
  const slashRect: Rect = {
    x: cx - 15,
    y: cy - 15,
    width: 30,
    height: 30,
  };

  for (const target of getLevelNpcTargets(state)) {
    if (rectsIntersect(slashRect, target.rect)) {
      const ncx = target.rect.x + target.rect.width * 0.5;
      const ncy = target.rect.y + target.rect.height * 0.5;
      spawnNpcBlood(state, ncx, ncy, target.groundZ);
      damageArmedNpc(state, target.key, PLAYER_KATANA_NPC_DAMAGE, ncx, ncy, target.groundZ);
    }
  }

  if (state.currentLevelId === 'level-upstairs') {
    const cat = state.levels['level-upstairs'].cat;
    if (cat.mode !== 'dead' && rectsIntersect(slashRect, cat)) {
      damageUpstairsCat(state, PLAYER_KATANA_NPC_DAMAGE);
    }
  }
}

function checkPunchNpcHit(state: GameState): void {
  const player = state.player;
  const aimYaw =
    typeof player.yaw === 'number'
      ? player.yaw
      : directionToYaw(player.facing);
  const cx = player.x + player.width * 0.5 + Math.cos(aimYaw) * 6;
  const cy = player.y + player.height * 0.5 + Math.sin(aimYaw) * 6;
  const punchRect: Rect = {
    x: cx - 12,
    y: cy - 12,
    width: 24,
    height: 24,
  };

  for (const target of getLevelNpcTargets(state)) {
    if (rectsIntersect(punchRect, target.rect)) {
      const ncx = target.rect.x + target.rect.width * 0.5;
      const ncy = target.rect.y + target.rect.height * 0.5;
      spawnNpcBlood(state, ncx, ncy, target.groundZ);
      damageArmedNpc(state, target.key, PLAYER_PUNCH_NPC_DAMAGE, ncx, ncy, target.groundZ);
    }
  }

  if (state.currentLevelId === 'level-upstairs') {
    const cat = state.levels['level-upstairs'].cat;
    if (cat.mode !== 'dead' && rectsIntersect(punchRect, cat)) {
      damageUpstairsCat(state, PLAYER_PUNCH_NPC_DAMAGE);
    }
  }
}

function updateEffectTimers(state: GameState, dtSeconds: number): void {
  if (dtSeconds <= 0) return;

  for (let i = state.bulletHoles.length - 1; i >= 0; i--) {
    state.bulletHoles[i].age += dtSeconds;
    if (state.bulletHoles[i].age >= state.bulletHoles[i].maxAge) {
      state.bulletHoles.splice(i, 1);
    }
  }

  for (let i = state.bloodPools.length - 1; i >= 0; i--) {
    state.bloodPools[i].age += dtSeconds;
    if (state.bloodPools[i].age >= state.bloodPools[i].maxAge) {
      state.bloodPools.splice(i, 1);
    }
  }

  for (let i = state.droppedUzis.length - 1; i >= 0; i--) {
    const drop = state.droppedUzis[i];
    if (typeof drop.maxAge === 'number') {
      drop.age = (drop.age ?? 0) + dtSeconds;
      if (drop.age >= drop.maxAge) {
        state.droppedUzis.splice(i, 1);
      }
    }
  }

  for (let i = state.explosions.length - 1; i >= 0; i--) {
    state.explosions[i].timer -= dtSeconds;
    if (state.explosions[i].timer <= 0) {
      state.explosions.splice(i, 1);
    }
  }

  for (let i = state.destroyingWalls.length - 1; i >= 0; i--) {
    const wall = state.destroyingWalls[i];
    wall.elapsed += dtSeconds;
    if (wall.elapsed >= wall.duration) {
      const lvl = state.levels[wall.levelId];
      lvl.map.tiles[wall.row][wall.col] = wall.replacementTile;
      if (state.currentLevelId === wall.levelId) {
        state.map.tiles[wall.row][wall.col] = wall.replacementTile;
      }
      state.destroyingWalls.splice(i, 1);
      state.mapVersion += 1;
    }
  }

  for (let i = state.destroyingDoors.length - 1; i >= 0; i--) {
    const d = state.destroyingDoors[i];
    d.elapsed += dtSeconds;
    if (d.elapsed >= d.duration) {
      if (d.levelId === 'level-basement') {
        const basement = state.levels['level-basement'];
        if (d.doorId === 'basement-hall-north-door') {
          basement.spaDoorClosed = false;
        } else {
          basement.doors = basement.doors.filter((dr) => dr.id !== d.doorId);
        }
      } else if (d.levelId === 'level-upstairs') {
        const upstairs = state.levels['level-upstairs'];
        upstairs.doors = upstairs.doors.filter((dr) => dr.id !== d.doorId);
      }
      state.destroyingDoors.splice(i, 1);
      state.mapVersion += 1;
    }
  }

  // Apply burn damage over time to burning armed NPCs
  if (state.burningNpcs.size > 0) {
    const npcTargets = getLevelNpcTargets(state);
    for (const key of Array.from(state.burningNpcs)) {
      const target = npcTargets.find((t) => t.key === key);
      if (target) {
        damageArmedNpc(
          state,
          key,
          NPC_BURN_DAMAGE_PER_SECOND * dtSeconds,
          target.rect.x + target.rect.width * 0.5,
          target.rect.y + target.rect.height * 0.5,
          target.groundZ
        );
      }
    }
  }

  for (let i = state.bloodParticles.length - 1; i >= 0; i--) {
    const pt = state.bloodParticles[i];
    pt.age += dtSeconds;
    pt.x += pt.vx * dtSeconds;
    pt.y += pt.vy * dtSeconds;
    pt.z += pt.vz * dtSeconds;
    pt.vz -= 130 * dtSeconds;
    if (pt.z <= pt.groundZ) {
      if (pt.spawnsPool) {
        state.bloodPools.push({
          levelId: pt.levelId,
          x: pt.x,
          y: pt.y,
          z: pt.groundZ,
          age: 0,
          maxAge: BLOOD_POOL_DURATION_SECONDS,
        });
      }
      state.bloodParticles.splice(i, 1);
    }
  }
}

function updateProjectiles(state: GameState, dtSeconds: number): void {
  if (state.projectiles.length === 0 || dtSeconds <= 0) {
    return;
  }

  const mapWidth = state.map.cols * state.map.tileSize;
  const mapHeight = state.map.rows * state.map.tileSize;
  const activeLevel = getActiveLevel(state);
  const obstacles = activeLevel.getSolidObstacles();
  const npcTargets = getLevelNpcTargets(state);

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    const stepSpeed = Math.hypot(p.vx, p.vy);
    const totalStepDist = stepSpeed * dtSeconds;
    const subSteps = Math.max(1, Math.ceil(totalStepDist / 4));
    const subDt = dtSeconds / subSteps;
    let removed = false;

    for (let s = 0; s < subSteps; s++) {
      p.x += p.vx * subDt;
      p.y += p.vy * subDt;
      p.z += (p.vz ?? 0) * subDt;
      p.distanceTraveled = (p.distanceTraveled ?? 0) + stepSpeed * subDt;

      if (p.x < 0 || p.y < 0 || p.x >= mapWidth || p.y >= mapHeight) {
        if (p.kind === 'rocket') {
          detonateRocket(
            state,
            p.x,
            p.y,
            p.cutsceneShot,
            p.sourceNpcKey,
            p.owner ?? 'npc'
          );
        }
        removed = true;
        break;
      }

      if (typeof p.maxDistance === 'number' && p.distanceTraveled >= p.maxDistance) {
        if (p.kind === 'rocket') {
          detonateRocket(
            state,
            p.x,
            p.y,
            p.cutsceneShot,
            p.sourceNpcKey,
            p.owner ?? 'npc'
          );
        }
        removed = true;
        break;
      }

      const isFireball = p.kind === 'fireball';
      const isRocket = p.kind === 'rocket';
      const projRect: Rect =
        isFireball || isRocket
          ? { x: p.x - 4, y: p.y - 4, width: 8, height: 8 }
          : { x: p.x - 1.5, y: p.y - 1.5, width: 3, height: 3 };

      // Check per-tile stairs wood burn in basement when hit by a fireball
      if (isFireball && state.currentLevelId === 'level-basement') {
        const basement = state.levels['level-basement'];
        if (basement.igniteStairsWoodAt(projRect)) {
          removed = true;
          break;
        }
      }

      // NPC-fired projectiles damage the player (5 HP for bullets/flames, 50 HP explosion for rockets)
      if (p.owner === 'npc' && !p.cutsceneShot) {
        if (rectsIntersect(projRect, state.player)) {
          if (isRocket) {
            detonateRocket(state, p.x, p.y, false, p.sourceNpcKey, 'npc');
          } else {
            damagePlayer(state, NPC_UZI_BULLET_DAMAGE);
          }
          removed = true;
          break;
        }
      }

      // Check NPC hits (skip self-hit for NPC projectiles)
      const hitNpc = npcTargets.find(
        (t) =>
          t.key !== p.sourceNpcKey && rectsIntersect(projRect, t.rect)
      );
      if (hitNpc && !p.cutsceneShot) {
        if (isRocket) {
          detonateRocket(
            state,
            p.x,
            p.y,
            false,
            p.sourceNpcKey,
            p.owner ?? 'npc'
          );
        } else if (isFireball) {
          state.burningNpcs.add(hitNpc.key);
          const armed = getArmedNpcByKey(state, hitNpc.key);
          if (armed) {
            igniteNpc(armed);
          }
          damageArmedNpc(
            state,
            hitNpc.key,
            PLAYER_FIREBALL_NPC_DAMAGE,
            p.x,
            p.y,
            hitNpc.groundZ
          );
        } else {
          spawnNpcBlood(state, p.x, p.y, hitNpc.groundZ);
          if (p.owner !== 'npc') {
            damageArmedNpc(
              state,
              hitNpc.key,
              PLAYER_UZI_NPC_DAMAGE,
              p.x,
              p.y,
              hitNpc.groundZ
            );
          }
        }
        removed = true;
        break;
      }

      // Check player-fired hits against the upstairs cat (1/10th armor damage -> turns hostile)
      if (
        p.owner !== 'npc' &&
        !p.cutsceneShot &&
        state.currentLevelId === 'level-upstairs'
      ) {
        const cat = state.levels['level-upstairs'].cat;
        if (cat.mode !== 'dead' && rectsIntersect(projRect, cat)) {
          if (isRocket) {
            detonateRocket(
              state,
              p.x,
              p.y,
              false,
              p.sourceNpcKey,
              p.owner ?? 'player'
            );
          } else if (isFireball) {
            damageUpstairsCat(state, PLAYER_FIREBALL_NPC_DAMAGE);
          } else {
            damageUpstairsCat(state, PLAYER_UZI_NPC_DAMAGE);
          }
          removed = true;
          break;
        }
      }

      if (p.fromRoof) {
        const hitChimney = rectsIntersect(projRect, ROOF_CHIMNEY_BOUNDS);
        const hitTallTreeOrEdge = isRectCollidingWithMap(
          state.map,
          projRect.x,
          projRect.y,
          projRect.width,
          projRect.height,
          true,
          (c, r) =>
            c >= 0 &&
            r >= 0 &&
            c < state.map.cols &&
            r < state.map.rows &&
            state.map.tiles[r][c] !== TileType.Tree
        );
        if (hitChimney || hitTallTreeOrEdge) {
          if (!isFireball && !isRocket) {
            state.bulletHoles.push({
              levelId: state.currentLevelId,
              x: p.x,
              y: p.y,
              z: Math.max(2, p.z),
              age: 0,
              maxAge: BULLET_HOLE_DURATION_SECONDS,
            });
          } else if (isRocket) {
            detonateRocket(
              state,
              p.x,
              p.y,
              p.cutsceneShot,
              p.sourceNpcKey,
              p.owner ?? 'npc'
            );
          }
          removed = true;
          break;
        }
        continue;
      }

      const hitMap = isRectCollidingWithMap(
        state.map,
        projRect.x,
        projRect.y,
        projRect.width,
        projRect.height,
        true,
        p.cutsceneShot
          ? (c, r) => {
              const tile = state.map.tiles[r]?.[c];
              // Cutscene rocket passes smoothly through row 4 north kitchen window and over low kitchen counter/island into the kitchen wall
              if (r < 5) return true;
              if (tile === TileType.FurnitureSolid) return true;
              return false;
            }
          : undefined
      );
      const sourceNpcTarget = p.sourceNpcKey
        ? npcTargets.find((t) => t.key === p.sourceNpcKey)
        : undefined;
      const hitObstacle = p.cutsceneShot
        ? false
        : obstacles.some((obs) => {
            if (
              sourceNpcTarget &&
              obs.x === sourceNpcTarget.rect.x &&
              obs.y === sourceNpcTarget.rect.y &&
              obs.width === sourceNpcTarget.rect.width &&
              obs.height === sourceNpcTarget.rect.height
            ) {
              return false;
            }
            return rectsIntersect(projRect, obs);
          });
      const hitOutsideDynamic =
        state.currentLevelId === 'level-outside' &&
        (rectsIntersect(projRect, state.dog) ||
          rectsIntersect(projRect, state.motorcycle));

      if (hitMap || hitObstacle || hitOutsideDynamic) {
        if (isRocket) {
          detonateRocket(
            state,
            p.x,
            p.y,
            p.cutsceneShot,
            p.sourceNpcKey,
            p.owner ?? 'npc'
          );
        } else if (!isFireball && (hitMap || hitObstacle)) {
          state.bulletHoles.push({
            levelId: state.currentLevelId,
            x: p.x,
            y: p.y,
            z: Math.max(2, p.z),
            age: 0,
            maxAge: BULLET_HOLE_DURATION_SECONDS,
          });
        }
        removed = true;
        break;
      }
    }

    if (removed) {
      state.projectiles.splice(i, 1);
    }
  }
}

function fireUziProjectile(state: GameState): void {
  const player = state.player;
  if (player.uziAmmo <= 0 || player.uziReloadTimer > 0 || player.uziDepleted) {
    return;
  }

  const aimYaw =
    typeof player.yaw === 'number'
      ? player.yaw
      : directionToYaw(player.facing);
  const rightAngle = aimYaw + Math.PI / 2;
  const cx = player.x + player.width * 0.5;
  const cy = player.y + player.height * 0.5;
  const onRoof = state.currentLevelId === 'level-outside' && state.isOnRoof;
  const groundZ = onRoof
    ? getMainHouseRoofElevation(cx, cy)
    : getTerrainHeight(cx, cy, state.currentLevelId);

  const yawSpread = (Math.random() * 2 - 1) * ((10 * Math.PI) / 180);
  const shotYaw = aimYaw + yawSpread;
  const pitchSpread = (Math.random() * 2 - 1) * ((5 * Math.PI) / 180);

  const spawnX =
    cx + Math.cos(aimYaw) * 7.5 + Math.cos(rightAngle) * 3.8;
  const spawnY =
    cy + Math.sin(aimYaw) * 7.5 + Math.sin(rightAngle) * 3.8;
  const spawnZ = groundZ + (player.jumpOffset ?? 0) + 10.0;

  state.projectiles.push({
    kind: 'bullet',
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    vx: Math.cos(shotYaw) * UZI_PROJECTILE_SPEED,
    vy: Math.sin(shotYaw) * UZI_PROJECTILE_SPEED,
    vz: UZI_PROJECTILE_SPEED * Math.tan(pitchSpread),
    yaw: shotYaw,
    distanceTraveled: 0,
    fromRoof: onRoof,
  });

  player.weaponVibrationTimer = Math.max(
    player.weaponVibrationTimer,
    UZI_FIRE_INTERVAL_SECONDS + 0.05
  );
  player.uziAmmo = Math.max(0, player.uziAmmo - 1);

  if (player.uziAmmo <= 0) {
    player.uziReloadTimer = PLAYER_UZI_RELOAD_SECONDS;
    debugLog('Reloading Uzi...');
  }
}

function fireFlamethrowerProjectile(state: GameState): void {
  const player = state.player;
  if (player.flamethrowerAmmo <= 0) {
    return;
  }
  if (Number.isFinite(player.flamethrowerAmmo)) {
    player.flamethrowerAmmo = Math.max(0, player.flamethrowerAmmo - 1);
  }
  const aimYaw =
    typeof player.yaw === 'number'
      ? player.yaw
      : directionToYaw(player.facing);
  const rightAngle = aimYaw + Math.PI / 2;
  const cx = player.x + player.width * 0.5;
  const cy = player.y + player.height * 0.5;
  const onRoof = state.currentLevelId === 'level-outside' && state.isOnRoof;
  const groundZ = onRoof
    ? getMainHouseRoofElevation(cx, cy)
    : getTerrainHeight(cx, cy, state.currentLevelId);

  const spawnX =
    cx + Math.cos(aimYaw) * 8.5 + Math.cos(rightAngle) * 3.5;
  const spawnY =
    cy + Math.sin(aimYaw) * 8.5 + Math.sin(rightAngle) * 3.5;
  const spawnZ = groundZ + (player.jumpOffset ?? 0) + 9.5;

  state.projectiles.push({
    kind: 'fireball',
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    vx: Math.cos(aimYaw) * FLAMETHROWER_PROJECTILE_SPEED,
    vy: Math.sin(aimYaw) * FLAMETHROWER_PROJECTILE_SPEED,
    vz: 0,
    yaw: aimYaw,
    distanceTraveled: 0,
    maxDistance: FLAMETHROWER_MAX_DISTANCE,
    fromRoof: onRoof,
  });

  player.weaponVibrationTimer = Math.max(
    player.weaponVibrationTimer,
    FLAMETHROWER_FIRE_INTERVAL_SECONDS + 0.05
  );
}

function firePlayerBazookaProjectile(state: GameState): void {
  const player = state.player;
  const aimYaw =
    typeof player.yaw === 'number'
      ? player.yaw
      : directionToYaw(player.facing);
  const rightAngle = aimYaw + Math.PI / 2;
  const cx = player.x + player.width * 0.5;
  const cy = player.y + player.height * 0.5;
  const onRoof = state.currentLevelId === 'level-outside' && state.isOnRoof;
  const groundZ = onRoof
    ? getMainHouseRoofElevation(cx, cy)
    : getTerrainHeight(cx, cy, state.currentLevelId);

  const spawnX = cx + Math.cos(aimYaw) * 9.0 + Math.cos(rightAngle) * 3.0;
  const spawnY = cy + Math.sin(aimYaw) * 9.0 + Math.sin(rightAngle) * 3.0;
  const spawnZ = groundZ + (player.jumpOffset ?? 0) + 11.5;

  state.projectiles.push({
    kind: 'rocket',
    owner: 'player',
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    vx: Math.cos(aimYaw) * NPC_BAZOOKA_ROCKET_SPEED,
    vy: Math.sin(aimYaw) * NPC_BAZOOKA_ROCKET_SPEED,
    vz: 0,
    yaw: aimYaw,
    distanceTraveled: 0,
    maxDistance: 320,
    fromRoof: onRoof,
  });

  player.weaponVibrationTimer = Math.max(player.weaponVibrationTimer, 0.25);
}

export function updateGameState(
  state: GameState,
  input: InputState,
  dtSeconds: number
): void {
  const safeDt = Math.max(0, dtSeconds);
  state.elapsedTime += safeDt;
  dtSeconds = safeDt;
  const prevUziCooldown = state.player.uziFireCooldown;
  const prevFlameCooldown = state.player.flamethrowerFireCooldown;
  updatePlayerHealthAndTimers(state.player, dtSeconds);
  if (state.damageFlashTimer > 0) {
    state.damageFlashTimer = Math.max(0, state.damageFlashTimer - dtSeconds);
  }
  if (
    state.cheatMode &&
    state.player.uziDepleted &&
    state.player.uziCheatRefillTimer > 0
  ) {
    state.player.uziCheatRefillTimer = Math.max(
      0,
      state.player.uziCheatRefillTimer - dtSeconds
    );
    if (state.player.uziCheatRefillTimer === 0) {
      state.player.unlockedUzi = true;
      state.player.uziDepleted = false;
      state.player.uziAmmo = MAX_UZI_AMMO;
      state.player.equippedItem = 'uzi';
      state.player.uziEquipTimer = UZI_EQUIP_DURATION_SECONDS;
      debugLog('Cheat refill: new Uzi obtained with 30 rounds');
    }
  }
  const uziCooldownRemainder =
    prevUziCooldown > 0 ? Math.max(0, dtSeconds - prevUziCooldown) : 0;
  const flameCooldownRemainder =
    prevFlameCooldown > 0 ? Math.max(0, dtSeconds - prevFlameCooldown) : 0;
  const actionPressed = consumeActionPress(input);
  const attackPressed = consumeAttackPress(input);
  const slotPressed = consumeSlotPress(input);

  // Clear any legacy pointerClick without triggering dialogue skip or interactions
  if (input.pointerClick) {
    input.pointerClick = null;
  }

  // Advance seamless 0.5s fade-to-black / fade-from-black level transitions
  if (state.screenFade) {
    state.screenFade.timer += dtSeconds;
    if (state.screenFade.phase === 'out') {
      if (state.screenFade.timer >= state.screenFade.duration) {
        const onMidpoint = state.screenFade.onMidpoint;
        state.screenFade.onMidpoint = undefined;
        state.screenFade.phase = 'in';
        state.screenFade.timer = 0;
        if (onMidpoint) {
          onMidpoint();
        }
        if (typeof input.cameraYaw === 'number') {
          input.cameraYaw =
            state.player.yaw ?? directionToYaw(state.player.facing);
        }
      }
      state.player.isMoving = false;
      state.nearbyInteractable = null;
      return;
    } else if (state.screenFade.timer >= state.screenFade.duration) {
      const onComplete = state.screenFade.onComplete;
      state.screenFade = null;
      if (onComplete) {
        onComplete();
      }
    }
  }

  // Animate full-house C4 demolition even while endgame dialogue is displayed
  if (state.houseExploding) {
    updateEffectTimers(state, dtSeconds);
    if (state.houseExplosionTimer > 0) {
      state.houseExplosionTimer = Math.max(0, state.houseExplosionTimer - dtSeconds);
      state.houseExplosionSpawnAccum += dtSeconds;
      while (state.houseExplosionSpawnAccum >= 0.12) {
        state.houseExplosionSpawnAccum -= 0.12;
        spawnHouseExplosionWave(state, true);
      }
      if (state.houseExplosionTimer <= 0) {
        state.worldFadedToBlack = true;
      }
    }
  }

  // If a dialogue box is currently open, pressing Space advances or closes it
  if (state.activeDialogue) {
    state.player.isMoving = false;
    if (actionPressed) {
      if (
        state.activeDialogue.unclosable &&
        state.activeDialogue.currentIndex >= state.activeDialogue.lines.length - 1
      ) {
        // Unclosable ending dialogue: stay on final line forever and do not close
        return;
      }
      state.activeDialogue.currentIndex += 1;
      if (state.houseExploding && state.activeDialogue.currentIndex >= 1) {
        state.worldFadedToBlack = true;
      }
      if (
        state.activeDialogue.currentIndex >= state.activeDialogue.lines.length
      ) {
        const wasGameOver = state.gameOver;
        const onClose = state.activeDialogue.onClose;
        const prevLevel = state.currentLevelId;
        state.activeDialogue = null;
        if (onClose) {
          onClose();
        }
        if (
          (state.currentLevelId !== prevLevel || wasGameOver) &&
          typeof input.cameraYaw === 'number'
        ) {
          input.cameraYaw =
            state.player.yaw ?? directionToYaw(state.player.facing);
        }
      }
    }
    return;
  }

  if (slotPressed !== null) {
    selectPlayerEquipmentSlot(state.player, slotPressed);
  }

  // Update 3D jump / fall arc, indoor door opening animations, projectiles, bullet holes, and blood
  updatePlayerJump(state.player, dtSeconds);
  updateProjectiles(state, dtSeconds);

  // Pick up a fallen NPC's dropped Uzi if the player does not currently hold a usable Uzi
  if (!state.player.unlockedUzi || state.player.uziDepleted) {
    for (let i = state.droppedUzis.length - 1; i >= 0; i--) {
      const uzi = state.droppedUzis[i];
      if (!uzi.pickupable || uzi.levelId !== state.currentLevelId) continue;
      const uziRect: Rect = {
        x: uzi.x - 6,
        y: uzi.y - 6,
        width: 12,
        height: 12,
      };
      if (rectsIntersect(state.player, uziRect)) {
        const pickedAmmo = uzi.ammo ?? MAX_UZI_AMMO;
        state.droppedUzis.splice(i, 1);
        state.player.unlockedUzi = true;
        state.player.uziDepleted = pickedAmmo <= 0;
        state.player.uziAmmo = pickedAmmo;
        state.player.uziDropTimer = 0;
        state.player.uziCheatRefillTimer = 0;
        state.player.equippedItem = pickedAmmo > 0 ? 'uzi' : 'empty';
        state.player.uziEquipTimer = UZI_EQUIP_DURATION_SECONDS;
        debugLog(`Picked up Uzi from fallen NPC (${pickedAmmo} rounds)`);
        break;
      }
    }
  }

  // Pick up dropped flamethrowers on touch (+20 flames each)
  for (let i = state.droppedFlamethrowers.length - 1; i >= 0; i--) {
    const flameDrop = state.droppedFlamethrowers[i];
    if (flameDrop.levelId !== state.currentLevelId) continue;
    const flameRect: Rect = {
      x: flameDrop.x - 7,
      y: flameDrop.y - 7,
      width: 14,
      height: 14,
    };
    if (rectsIntersect(state.player, flameRect)) {
      state.droppedFlamethrowers.splice(i, 1);
      state.player.unlockedFlamethrower = true;
      if (Number.isFinite(state.player.flamethrowerAmmo)) {
        state.player.flamethrowerAmmo += flameDrop.ammo;
      } else {
        state.player.flamethrowerAmmo = flameDrop.ammo;
      }
      if (state.player.equippedItem === 'empty') {
        selectPlayerEquipmentSlot(state.player, 4);
      }
      debugLog(`Picked up Flamethrower (+${flameDrop.ammo} flames)`);
      break;
    }
  }

  // Pick up dropped katana sword on touch
  for (let i = state.droppedKatanas.length - 1; i >= 0; i--) {
    const katana = state.droppedKatanas[i];
    if (katana.levelId !== state.currentLevelId) continue;
    const katanaRect: Rect = {
      x: katana.x - 7,
      y: katana.y - 7,
      width: 14,
      height: 14,
    };
    if (rectsIntersect(state.player, katanaRect)) {
      state.droppedKatanas.splice(i, 1);
      state.player.unlockedKatana = true;
      selectPlayerEquipmentSlot(state.player, 5);
      debugLog('Picked up Katana!');
      break;
    }
  }

  // Pick up dropped bazooka (from Rosanna) on touch
  for (let i = state.droppedBazookas.length - 1; i >= 0; i--) {
    const bazooka = state.droppedBazookas[i];
    if (bazooka.levelId !== state.currentLevelId) continue;
    const bazookaRect: Rect = {
      x: bazooka.x - 7,
      y: bazooka.y - 7,
      width: 14,
      height: 14,
    };
    if (rectsIntersect(state.player, bazookaRect)) {
      state.droppedBazookas.splice(i, 1);
      state.player.unlockedBazooka = true;
      selectPlayerEquipmentSlot(state.player, 6);
      debugLog('Picked up Bazooka!');
      break;
    }
  }

  // Pick up medkit on touch (+25 HP)
  for (let i = state.medkits.length - 1; i >= 0; i--) {
    const medkit = state.medkits[i];
    if (medkit.levelId !== state.currentLevelId) continue;
    if (
      medkit.id === 'basement-spa-medkit' &&
      state.levels['level-basement'].spaDoorClosed
    ) {
      continue;
    }
    if (state.player.health >= state.player.maxHealth) continue;
    const medkitRect: Rect = {
      x: medkit.x - 7,
      y: medkit.y - 7,
      width: 14,
      height: 14,
    };
    if (rectsIntersect(state.player, medkitRect)) {
      state.medkits.splice(i, 1);
      setPlayerHealth(state.player, state.player.health + MEDKIT_HEAL_AMOUNT);
      debugLog(`Picked up Medkit (+${MEDKIT_HEAL_AMOUNT} HP)`);
      break;
    }
  }
  updateEffectTimers(state, dtSeconds);
  for (const door of state.levels['level-basement'].openedDoors) {
    door.progress = Math.min(1, door.progress + dtSeconds / 0.45);
  }
  for (const door of state.levels['level-upstairs'].openedDoors) {
    door.progress = Math.min(1, door.progress + dtSeconds / 0.45);
  }

  const transitionCtx: LevelTransitionContext = {
    loadLevel: (nextId: LevelId) => {
      loadLevel(state, nextId);
      if (typeof input.cameraYaw === 'number') {
        input.cameraYaw =
          state.player.yaw ?? directionToYaw(state.player.facing);
      }
    },
    openDialogue: (
      lines: string[],
      onClose?: () => void,
      speakerPortrait?: string,
      unclosable?: boolean,
      variant?: DialogueVariant
    ) => {
      state.activeDialogue = {
        lines,
        currentIndex: 0,
        onClose,
        speakerPortrait,
        unclosable,
        variant,
      };
    },
    damagePlayer: (amount: number) => damagePlayer(state, amount),
    fireNpcUzi: (
      npc: ArmedNpcState,
      originX: number,
      originY: number,
      aimYaw: number
    ) => fireNpcUziProjectile(state, npc, originX, originY, aimYaw),
    fireNpcFlamethrower: (
      npc: ArmedNpcState,
      originX: number,
      originY: number,
      aimYaw: number
    ) => fireNpcFlamethrowerProjectile(state, npc, originX, originY, aimYaw),
    fireNpcBazooka: (
      npc: ArmedNpcState,
      originX: number,
      originY: number,
      aimYaw: number
    ) => fireNpcBazookaProjectile(state, originX, originY, aimYaw, npc.key, false),
    fireRosannaCutsceneRocket: (
      originX: number,
      originY: number,
      aimYaw: number
    ) =>
      fireNpcBazookaProjectile(
        state,
        originX,
        originY,
        aimYaw,
        'upstairs:Rosanna',
        true
      ),
    getSecretSantaReceiver: () => {
      if (!state.secretSantaDB) return undefined;
      const playerName = state.secretSantaDB.playerName;
      if (!playerName) return undefined;
      return state.secretSantaDB.getGiftReceiverOf(playerName);
    },
    fadeWorldToBlack: () => {
      state.worldFadedToBlack = true;
    },
    detonateHouseC4: () => {
      triggerUpstairsHouseExplosion(state);
    },
    getRemainingNaughtyListNames: () => {
      const basement = state.levels['level-basement'];
      const upstairs = state.levels['level-upstairs'];
      const allNpcs: ArmedNpcState[] = [
        basement.arjanCombat,
        basement.olexaCombat,
        basement.hanneloesCombat,
        upstairs.albinCombat,
        upstairs.henrikCombat,
        upstairs.tanjaCombat,
        upstairs.dianaCombat,
        upstairs.simonCombat,
        upstairs.anneMarieCombat,
        upstairs.rosannaCombat,
      ];
      return allNpcs.filter((npc) => npc.mode !== 'dead').map((npc) => npc.name);
    },
  };

  if (state.currentLevelId === 'level-outside') {
    const handledEarly = updateOutsideLevel(state, input, dtSeconds);
    if (handledEarly) {
      return;
    }
  } else if (state.currentLevelId === 'level-basement') {
    const basement = state.levels['level-basement'];
    const movementLocked = basement.updateCutscene(
      dtSeconds,
      state.player,
      transitionCtx
    );
    if (movementLocked) {
      refreshInteractables(state);
      return;
    }
    updatePlayer(
      state.player,
      input,
      dtSeconds,
      basement.map,
      basement.getSolidObstacles(state.player)
    );
    if (!isPlayerOnBasementStairs(state.player)) {
      if (rectsIntersect(state.player, BASEMENT_STAIRS_SIDE_NORTH_BOUNDS)) {
        state.player.y =
          BASEMENT_STAIRS_SIDE_NORTH_BOUNDS.y - state.player.height;
      } else if (
        rectsIntersect(state.player, BASEMENT_STAIRS_SIDE_SOUTH_BOUNDS)
      ) {
        state.player.y =
          BASEMENT_STAIRS_SIDE_SOUTH_BOUNDS.y +
          BASEMENT_STAIRS_SIDE_SOUTH_BOUNDS.height;
      }
    }
    basement.updateHazardsAndItems(dtSeconds, state.player, transitionCtx);
    basement.updateNpcSight(dtSeconds, state.player, transitionCtx);
    if (state.activeDialogue) {
      refreshInteractables(state);
      return;
    }

    // Automatically walk upstairs with a 0.5s fade to black & fade from black once on the stairs and close enough
    if (
      !state.screenFade &&
      isPlayerOnBasementStairs(state.player) &&
      rectEdgeDistance(state.player, BASEMENT_STAIRS_TRIGGER_BOUNDS) <=
        INTERACTION_MAX_GAP_PX
    ) {
      state.player.isMoving = false;
      state.nearbyInteractable = null;
      state.screenFade = {
        phase: 'out',
        timer: 0,
        duration: 0.5,
        onMidpoint: () => {
          state.player.states.set(USED_STAIRS_STATE_KEY, true);
          transitionCtx.loadLevel('level-upstairs');
        },
        onComplete: () => {
          if (!state.player.states.get(UPSTAIRS_INTRO_STATE_KEY)) {
            state.player.states.set(UPSTAIRS_INTRO_STATE_KEY, true);
            transitionCtx.openDialogue([
              'Hmm... so I believe the Christmas tree is to the left, but I must not be seen!',
            ]);
          }
        },
      };
      return;
    }
  } else if (state.currentLevelId === 'level-upstairs') {
    const upstairs = state.levels['level-upstairs'];
    // Check if the Kitchen Rosanna cutscene is active or just triggered
    const movementLocked = upstairs.updateCutscene(
      dtSeconds,
      state.player,
      transitionCtx
    );
    if (movementLocked) {
      refreshInteractables(state);
      return;
    }
    updatePlayer(
      state.player,
      input,
      dtSeconds,
      upstairs.map,
      upstairs.getSolidObstacles()
    );
    // Update the black cat in the extra room
    updateCat(
      upstairs.cat,
      state.player,
      dtSeconds,
      upstairs.map,
      upstairs.getSolidObstacles(),
      (damage) => damagePlayer(state, damage)
    );
    // Re-check right after moving in case this step crossed into the kitchen
    if (upstairs.updateCutscene(0, state.player, transitionCtx)) {
      refreshInteractables(state);
      return;
    }
    // Check west hallway ambush trigger & update Henrik/Tanja door-open zoom
    upstairs.updateTableRoomAmbush(dtSeconds, state.player);
    // Update Upstairs NPCs sight detection
    upstairs.updateNpcSight(dtSeconds, state.player, transitionCtx);
    if (state.activeDialogue) {
      refreshInteractables(state);
      return;
    }

    // Automatically walk downstairs with a 0.5s fade to black & fade from black once close enough
    if (
      !state.screenFade &&
      rectEdgeDistance(state.player, UPSTAIRS_STAIRS_TRIGGER_BOUNDS) <=
        INTERACTION_MAX_GAP_PX
    ) {
      state.player.isMoving = false;
      state.nearbyInteractable = null;
      state.screenFade = {
        phase: 'out',
        timer: 0,
        duration: 0.5,
        onMidpoint: () => {
          transitionCtx.loadLevel('level-basement');
        },
      };
      return;
    }
  } else if (state.currentLevelId === 'level-people') {
    const peopleLevel = state.levels['level-people'];
    updatePlayer(
      state.player,
      input,
      dtSeconds,
      peopleLevel.map,
      peopleLevel.getSolidObstacles()
    );
  }

  // Check if Santa is close enough to an interactable object to show the Space prompt
  refreshInteractables(state);

  // If already holding an Uzi in hand and standing on a pickupable floor Uzi, pressing Space swaps magazines & replays equip animation
  if (
    actionPressed &&
    state.player.equippedItem === 'uzi' &&
    state.player.unlockedUzi &&
    !state.player.uziDepleted
  ) {
    for (const floorUzi of state.droppedUzis) {
      if (!floorUzi.pickupable || floorUzi.levelId !== state.currentLevelId) continue;
      const uziRect: Rect = {
        x: floorUzi.x - 7,
        y: floorUzi.y - 7,
        width: 14,
        height: 14,
      };
      if (rectsIntersect(state.player, uziRect)) {
        const prevPlayerAmmo = state.player.uziAmmo;
        const floorAmmo = floorUzi.ammo ?? MAX_UZI_AMMO;
        state.player.uziAmmo = floorAmmo;
        floorUzi.ammo = prevPlayerAmmo;
        state.player.uziDepleted = floorAmmo <= 0;
        state.player.equippedItem = state.player.uziDepleted ? 'empty' : 'uzi';
        state.player.uziEquipTimer = UZI_EQUIP_DURATION_SECONDS;
        state.player.uziFireCooldown = 0;
        state.player.punchTimer = 0;
        debugLog(
          `Swapped Uzi on floor (${prevPlayerAmmo} <-> ${floorAmmo} rounds)`
        );
        return;
      }
    }
  }

  if (actionPressed && state.nearbyInteractable) {
    const target = state.nearbyInteractable;
    if (state.currentLevelId === 'level-outside') {
      syncOutsideToLevel(state);
    }

    const activeLevel = getActiveLevel(state);
    const prevLevelId = state.currentLevelId;
    const handledByLevel = activeLevel.handleInteraction(
      target.id,
      state.player,
      transitionCtx
    );

    if (handledByLevel) {
      if (
        prevLevelId === 'level-outside' &&
        state.currentLevelId === 'level-outside'
      ) {
        syncLevelToOutside(state);
      }
      refreshInteractables(state);
    } else if (target.dialogueLines.length > 0) {
      state.activeDialogue = {
        lines: target.dialogueLines,
        currentIndex: 0,
        speakerPortrait: target.speakerPortrait,
      };
    }
    return;
  }

  if (state.player.equippedItem === 'empty') {
    if (actionPressed && !state.nearbyInteractable) {
      // No interactable Action available while empty-handed: Space triggers a 3D half-tile jump animation
      triggerPlayerJump(state.player);
    }
  } else if (state.player.equippedItem === 'unarmed') {
    if (attackPressed || (!state.nearbyInteractable && actionPressed)) {
      if (triggerPlayerPunch(state.player)) {
        checkPunchNpcHit(state);
      }
    }
  } else if (state.player.equippedItem === 'katana') {
    if (attackPressed || (!state.nearbyInteractable && actionPressed)) {
      if (triggerPlayerKatanaSwing(state.player)) {
        checkKatanaNpcHit(state);
      }
    }
  } else if (state.player.equippedItem === 'uzi') {
    const wantsToFire =
      attackPressed ||
      Boolean(input.attack) ||
      (!state.nearbyInteractable && (actionPressed || Boolean(input.action)));
    if (wantsToFire && state.player.uziFireCooldown <= 1e-6) {
      state.player.uziFireCooldown = Math.max(
        0.01,
        UZI_FIRE_INTERVAL_SECONDS - uziCooldownRemainder
      );
      fireUziProjectile(state);
    }
  } else if (state.player.equippedItem === 'flamethrower') {
    const wantsToFire =
      attackPressed ||
      Boolean(input.attack) ||
      (!state.nearbyInteractable && (actionPressed || Boolean(input.action)));
    if (
      wantsToFire &&
      state.player.flamethrowerFireCooldown <= 1e-6 &&
      state.player.flamethrowerAmmo > 0
    ) {
      state.player.flamethrowerFireCooldown = Math.max(
        0.01,
        FLAMETHROWER_FIRE_INTERVAL_SECONDS - flameCooldownRemainder
      );
      fireFlamethrowerProjectile(state);
    }
  } else if (state.player.equippedItem === 'bazooka') {
    const wantsToFire =
      attackPressed ||
      Boolean(input.attack) ||
      (!state.nearbyInteractable && (actionPressed || Boolean(input.action)));
    if (wantsToFire && state.player.bazookaFireCooldown <= 1e-6) {
      state.player.bazookaFireCooldown = BAZOOKA_FIRE_INTERVAL_SECONDS;
      firePlayerBazookaProjectile(state);
    }
  }
}
