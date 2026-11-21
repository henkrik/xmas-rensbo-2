import { debugLog } from '../core/debugConsole';
import { SecretSantaDB } from '../core/secretSantaDB';
import {
  consumeActionPress,
  consumeAttackPress,
  consumeSlotPress,
  InputState,
} from '../core/input';
import { updateCat } from '../entities/cat';
import { createDog, Dog, updateDog } from '../entities/dog';
import {
  applyNpcDamage,
  ArmedNpcState,
  NPC_BURN_DAMAGE_PER_SECOND,
  NPC_UZI_BULLET_DAMAGE,
  PLAYER_FIREBALL_NPC_DAMAGE,
  PLAYER_PUNCH_NPC_DAMAGE,
  PLAYER_UZI_NPC_DAMAGE,
} from '../entities/npcCombat';
import { ConeOfSight } from '../entities/sight';
import {
  applyPlayerDamage,
  createPlayer,
  FLAMETHROWER_FIRE_INTERVAL_SECONDS,
  FLAMETHROWER_MAX_DISTANCE,
  FLAMETHROWER_PROJECTILE_SPEED,
  Footprint,
  MAX_UZI_AMMO,
  Player,
  Rect,
  rectsIntersect,
  selectPlayerEquipmentSlot,
  triggerPlayerJump,
  triggerPlayerPunch,
  updateFootprints,
  updatePlayer,
  updatePlayerHealthAndTimers,
  updatePlayerJump,
  UZI_DROP_DURATION_SECONDS,
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
  BASEMENT_STAIRS_SIDE_NORTH_BOUNDS,
  BASEMENT_STAIRS_SIDE_SOUTH_BOUNDS,
  BASEMENT_STAIRS_TRIGGER_BOUNDS,
  BASEMENT_STAIRS_WOOD_OBSTACLES,
  isPlayerOnBasementStairs,
  LevelBasement,
  STAIRS_WOOD_BURN_DURATION,
  USED_STAIRS_STATE_KEY,
} from './levels/levelBasement';
import {
  LevelUpstairs,
  UPSTAIRS_INTRO_STATE_KEY,
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
  TileMap,
  TileType,
} from './tilemap';

export { createMotorcycle };
export type { ClimbingState, MotorcycleState, MotorcycleStatus };

export const BULLET_HOLE_DURATION_SECONDS = 10;
export const BLOOD_POOL_DURATION_SECONDS = 20;

export interface Projectile {
  kind?: 'bullet' | 'fireball';
  owner?: 'player' | 'npc';
  sourceNpcKey?: string;
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

export interface DroppedUzi {
  levelId: LevelId;
  x: number;
  y: number;
  z: number;
  yaw: number;
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

export function damagePlayer(state: GameState, amount: number): void {
  applyPlayerDamage(state.player, amount);
  if (state.player.health <= 0 && !state.cheatMode) {
    state.gameOver = true;
    state.nearbyInteractable = null;
    state.activeDialogue = {
      lines: ['Try again?'],
      currentIndex: 0,
      variant: 'gameover',
      onClose: () => {
        restartEntireGame(state);
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
    addTarget('basement:Hanneloes', basement.toiletNpc);
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
  const died = applyNpcDamage(npc, damage);
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
        removed = true;
        break;
      }

      if (typeof p.maxDistance === 'number' && p.distanceTraveled >= p.maxDistance) {
        removed = true;
        break;
      }

      const isFireball = p.kind === 'fireball';
      const projRect: Rect = isFireball
        ? { x: p.x - 4, y: p.y - 4, width: 8, height: 8 }
        : { x: p.x - 1.5, y: p.y - 1.5, width: 3, height: 3 };

      // Check stairs wood stacks burn in basement when hit by a fireball
      if (isFireball && state.currentLevelId === 'level-basement') {
        const basement = state.levels['level-basement'];
        if (
          !basement.stairsWoodBurned &&
          BASEMENT_STAIRS_WOOD_OBSTACLES.some((obs) =>
            rectsIntersect(projRect, obs)
          )
        ) {
          if (basement.stairsWoodBurnTimer <= 0) {
            basement.stairsWoodBurnTimer = STAIRS_WOOD_BURN_DURATION;
          }
          removed = true;
          break;
        }
      }

      // NPC-fired projectiles damage the player (5 HP) without resetting the map
      if (p.owner === 'npc') {
        if (rectsIntersect(projRect, state.player)) {
          damagePlayer(state, NPC_UZI_BULLET_DAMAGE);
          removed = true;
          break;
        }
      }

      // Check NPC hits (skip self-hit for NPC projectiles)
      const hitNpc = npcTargets.find(
        (t) =>
          t.key !== p.sourceNpcKey && rectsIntersect(projRect, t.rect)
      );
      if (hitNpc) {
        if (isFireball) {
          state.burningNpcs.add(hitNpc.key);
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
          if (!isFireball) {
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
        continue;
      }

      const hitMap = isRectCollidingWithMap(
        state.map,
        projRect.x,
        projRect.y,
        projRect.width,
        projRect.height,
        true
      );
      const sourceNpcTarget = p.sourceNpcKey
        ? npcTargets.find((t) => t.key === p.sourceNpcKey)
        : undefined;
      const hitObstacle = obstacles.some((obs) => {
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
        if (!isFireball && (hitMap || hitObstacle)) {
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
  if (player.uziAmmo <= 0 || player.uziDepleted) {
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
    player.uziDepleted = true;
    player.uziDropTimer = UZI_DROP_DURATION_SECONDS;
    player.uziCheatRefillTimer = state.cheatMode ? 3.0 : 0;
    player.equippedItem = 'empty';
    state.droppedUzis.push({
      levelId: state.currentLevelId,
      x: cx + Math.cos(rightAngle) * 7,
      y: cy + Math.sin(rightAngle) * 7,
      z: groundZ,
      yaw: aimYaw + 0.4,
    });
  }
}

function fireFlamethrowerProjectile(state: GameState): void {
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
      if (
        state.activeDialogue.currentIndex >= state.activeDialogue.lines.length
      ) {
        const onClose = state.activeDialogue.onClose;
        const prevLevel = state.currentLevelId;
        state.activeDialogue = null;
        if (onClose) {
          onClose();
        }
        if (
          state.currentLevelId !== prevLevel &&
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
    getSecretSantaReceiver: () => {
      if (!state.secretSantaDB) return undefined;
      const playerName = state.secretSantaDB.playerName;
      if (!playerName) return undefined;
      return state.secretSantaDB.getGiftReceiverOf(playerName);
    },
    fadeWorldToBlack: () => {
      state.worldFadedToBlack = true;
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
    basement.updateHazardsAndItems(dtSeconds, state.player);
    basement.updateNpcSight(dtSeconds, state.player, transitionCtx);
    if (state.activeDialogue) {
      refreshInteractables(state);
      return;
    }

    // Automatically walk upstairs with a 0.5s fade to black & fade from black once on the stairs and close enough
    if (
      basement.stairsWoodBurned &&
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
      upstairs.getSolidObstacles()
    );
    // Re-check right after moving in case this step crossed into the kitchen
    if (upstairs.updateCutscene(0, state.player, transitionCtx)) {
      refreshInteractables(state);
      return;
    }
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
    if (wantsToFire && state.player.flamethrowerFireCooldown <= 1e-6) {
      state.player.flamethrowerFireCooldown = Math.max(
        0.01,
        FLAMETHROWER_FIRE_INTERVAL_SECONDS - flameCooldownRemainder
      );
      fireFlamethrowerProjectile(state);
    }
  }
}
