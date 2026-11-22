import { Cat, createCat } from '../../entities/cat';
import {
  ArmedNpcState,
  createArmedNpcState,
  enterHostileMode,
  MAX_NPC_HEALTH,
  NPC_HOSTILE_LOSE_SIGHT_SECONDS,
  NPC_KATANA_MELEE_COOLDOWN,
  NPC_KATANA_MELEE_DAMAGE,
  NPC_KATANA_MELEE_RANGE,
  propagateHostileAlert,
  stepBurningNpc,
  stepHostileNpcAlongPath,
  tryFireHostileNpcBazooka,
  tryFireHostileNpcFlamethrower,
  tryFireHostileNpcUzi,
  updateNpcHealthAndTimers,
} from '../../entities/npcCombat';
import {
  Direction,
  equipPlayerBodyArmor,
  Player,
  Rect,
  rectsIntersect,
  UPSTAIRS_INITIAL_FLAMETHROWER_AMMO,
} from '../../entities/player';
import {
  ConeOfSight,
  DEFAULT_CONE_OF_SIGHT_DISTANCE,
  DEFAULT_CONE_OF_SIGHT_FOV,
} from '../../entities/sight';
import { Interactable } from '../interaction';
import { MAP_COLS, MAP_ROWS, TILE_SIZE, TileMap, TileType } from '../tilemap';
import {
  CollidableDoor,
  GameLevel,
  LevelId,
  LevelTransitionContext,
  OpenedDoorAnimation,
} from './types';

const V = TileType.VoidBlack;
const W = TileType.InteriorWall;
const F = TileType.WoodFloor;
const B = TileType.BathroomTileFloor;
const T = TileType.StairsFloor;
const O = TileType.FurnitureSolid;

/**
 * 32x28 Tile Matrix for `level-upstairs` (based on inspiration/level-upstairs.jpg):
 * - Dining Room (cols 2..8, rows 4..10, WoodFloor):
 *   Cupboard against west wall (col 3, rows 6..7), long wooden dining table (cols 5..6, rows 5..9),
 *   with extra open distance (cols 7..9) between the dining table and the kitchen.
 * - Living Room (cols 2..9, rows 11..17, WoodFloor):
 *   Moved north so its south wall is at row 17 (leaving breathing room next to the Table Room at rows 13..20).
 *   Colorful couch (cols 5..7, row 11) and matching colorful armchairs (col 3, row 12 & col 8, row 13)
 *   leave a wide open path (cols 4..7, rows 12..16) so the player can easily reach the Xmas Tree (cols 3..4, rows 14..16).
 * - The Kitchen (cols 9..15, rows 4..10, WoodFloor):
 *   Kitchen island shifted west (cols 10..11, rows 6..7), stove & sink on east wall (col 15, rows 5..8),
 *   counter bar on south-west (cols 9..11, row 9), and The Altar at (cols 10..11, row 10).
 * - Narrow Hallway (cols 9..27, rows 11..12, WoodFloor):
 *   2 tiles tall along the Y-axis, extending seamlessly east into the narrower Extra Room (cols 26..27, rows 11..17).
 * - Table Room (cols 9..14, rows 13..20, WoodFloor):
 *   Door at (col 11, row 13), second wooden kitchen table (cols 11..12, rows 16..17), 3 south windows (row 20).
 * - Staircase (cols 15..18, rows 13..18):
 *   Player spawns at top of stairs (row 13) and can walk downstairs at (rows 16..17).
 * - Shower (cols 16..20, rows 4..10, BathroomTileFloor):
 *   Closed door at (col 18, row 10); hidden until opened.
 * - The Bedroom (cols 20..27, rows 4..10, WoodFloor):
 *   Closed door at (col 23, row 10); hidden until opened. Normal 2x2 double bed at (cols 25..26, rows 6..7).
 * - Wider Office (cols 19..25, rows 13..20, WoodFloor):
 *   Closed door at (col 21, row 13); hidden until opened. 5 interior columns wide (cols 20..24).
 */
export const UPSTAIRS_TILES: TileType[][] = [
  //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 0
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 1
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 2: Exterior strip north of kitchen windows
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 3
  [V, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, V, V, V], // 4: North wall (Dining | Kitchen windows | Shower | Bedroom with window at 24..25)
  [V, W, F, F, F, F, F, F, F, F, F, F, F, F, F, O, W, B, B, B, W, W, F, F, F, F, F, F, W, V, V, V], // 5: Shortened dining table walk path (4..5) | Shower (17..19) | Bedroom (22..27)
  [V, W, O, F, O, O, F, F, F, F, O, O, F, F, F, O, W, B, B, B, W, W, F, F, F, F, O, O, W, V, V, V], // 6: Cupboard (2) | Dining Table (4..5) | Island (10..11) | Bed (26..27)
  [V, W, O, F, O, O, F, F, F, F, O, O, F, F, F, O, W, O, B, B, W, W, F, F, F, F, O, O, W, V, V, V], // 7: Cupboard (2) | Dining Table (4..5) | Shower sink (17) | Bed (26..27)
  [V, W, F, F, O, O, F, F, F, F, F, F, F, F, F, O, W, O, B, O, W, W, F, F, F, F, F, F, W, V, V, V], // 8: Dining table (4..5) | Shower sink (17) & toilet (19) | Bedroom
  [V, W, F, F, O, O, F, F, F, W, W, W, W, F, F, W, W, B, B, B, W, W, F, F, F, F, F, F, W, V, V, V], // 9: North wall of altar alcove (9..12) | Kitchen entrance (13..14)
  [V, W, F, F, F, F, F, F, F, W, O, O, W, F, F, W, W, W, B, W, W, W, W, W, F, W, W, W, W, V, V, V], // 10: Altar (10..11) | Altar east wall (12) | Kitchen entrance (13..14) | Shower door (18) | Bedroom door (24)
  [V, W, F, F, O, O, O, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, V, V, V], // 11: Colorful Couch (4..6) | Narrow Hallway (rows 11..12) -> Extra Room (26..27)
  [V, W, O, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W, V, V, V], // 12: Left Colorful Armchair (2) | Narrow Hallway (rows 11..12)
  [V, W, F, F, F, F, F, O, F, F, F, F, F, F, W, T, T, T, T, W, W, F, W, W, W, W, F, F, W, V, V, V], // 13: Right Armchair (7) | Open breathing room (8..13) | Stairs (15..18) | Office door (21)
  [V, W, O, O, F, F, F, F, F, F, F, F, F, F, W, T, T, T, T, W, F, F, F, F, F, W, F, F, W, V, V, V], // 14: Xmas Tree (2..3) | Stairs | Aligned Office (20..24) | Extra Room (26..27)
  [V, W, O, O, F, F, F, F, F, W, W, F, W, W, W, T, T, T, T, W, O, F, F, F, F, W, F, F, W, V, V, V], // 15: Xmas Tree (2..3) | Table Room door (11) | Office side desk (20)
  [V, W, O, O, F, F, F, F, F, W, F, F, F, F, W, T, T, T, T, W, O, O, O, F, F, W, F, F, W, V, V, V], // 16: Xmas Tree (2..3) | Table Room floor | Stairs trigger (15..18) | Office PC desk (20..22)
  [V, W, W, W, W, W, W, W, W, W, F, O, O, F, W, T, T, T, T, W, O, O, O, F, F, W, F, F, W, V, V, V], // 17: Living Room south wall (3..4, 6..7) | Office PC desk/chair (20..22)
  [V, V, V, V, V, V, V, V, V, W, F, O, O, F, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, V, V, V], // 18: Aligned South Wall across Stairs (15..18), Office (19..25 with window), Extra Room (26..28)
  [V, V, V, V, V, V, V, V, V, W, F, F, F, F, W, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 19: Table Room floor | Void under aligned office
  [V, V, V, V, V, V, V, V, V, W, F, F, F, F, W, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 20: Table Room floor
  [V, V, V, V, V, V, V, V, V, W, W, W, W, W, W, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 21: Table Room south wall (windows at 10..13)
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 22
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 23
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 24
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 25
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 26
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 27
];

export const UPSTAIRS_MAP: TileMap = {
  cols: MAP_COLS,
  rows: MAP_ROWS,
  tileSize: TILE_SIZE,
  tiles: UPSTAIRS_TILES,
};

/** Player spawns by the stairs when arriving in `level-upstairs`. */
export const UPSTAIRS_STAIRS_SPAWN = {
  x: 16 * TILE_SIZE + 2,
  y: 13 * TILE_SIZE + 2,
  facing: 'up' as Direction,
};

/** Invisible collision box halfway down the staircase to walk back downstairs to `level-basement`. */
export const UPSTAIRS_STAIRS_TRIGGER_BOUNDS: Rect = {
  x: 15 * TILE_SIZE,
  y: 16 * TILE_SIZE,
  width: 4 * TILE_SIZE,
  height: 2 * TILE_SIZE,
};

/** Closed collidable door to the Shower (bathroom tiles inside). */
export const UPSTAIRS_SHOWER_DOOR_BOUNDS: Rect = {
  x: 18 * TILE_SIZE,
  y: 10 * TILE_SIZE,
  width: TILE_SIZE,
  height: TILE_SIZE,
};

export const UPSTAIRS_SHOWER_HIDDEN_MASK: Rect = {
  x: 17 * TILE_SIZE,
  y: 4 * TILE_SIZE,
  width: 4 * TILE_SIZE,
  height: 6 * TILE_SIZE,
};

/** Closed collidable door to The Bedroom. */
export const UPSTAIRS_BEDROOM_DOOR_BOUNDS: Rect = {
  x: 24 * TILE_SIZE,
  y: 10 * TILE_SIZE,
  width: TILE_SIZE,
  height: TILE_SIZE,
};

export const UPSTAIRS_BEDROOM_HIDDEN_MASK: Rect = {
  x: 21 * TILE_SIZE,
  y: 4 * TILE_SIZE,
  width: 8 * TILE_SIZE,
  height: 6 * TILE_SIZE,
};

/** Closed collidable door to The Office. */
export const UPSTAIRS_OFFICE_DOOR_BOUNDS: Rect = {
  x: 21 * TILE_SIZE,
  y: 13 * TILE_SIZE,
  width: TILE_SIZE,
  height: TILE_SIZE,
};

export const UPSTAIRS_OFFICE_HIDDEN_MASK: Rect = {
  x: 20 * TILE_SIZE,
  y: 14 * TILE_SIZE,
  width: 5 * TILE_SIZE,
  height: 5 * TILE_SIZE,
};

/** Albin walking NPC in dining room (col 7, rows 5..9). */
export const UPSTAIRS_ALBIN_START_Y = 5 * TILE_SIZE + 2;
export const UPSTAIRS_ALBIN_END_Y = 9 * TILE_SIZE + 2;
export const UPSTAIRS_ALBIN_X = 7 * TILE_SIZE + 2;
export const UPSTAIRS_ALBIN_SPEED = 15; // px/s
export const UPSTAIRS_INTRO_STATE_KEY = 'upstairsIntroTriggered';

/** Present item pickup and distracted states */
export const DIANA_PRESENT_TAKEN_KEY = 'upstairsDianaPresentTaken';
export const SIMON_PRESENT_TAKEN_KEY = 'upstairsSimonPresentTaken';
export const DIANA_DISTRACTED_KEY = 'upstairsDianaDistracted';
export const SIMON_DISTRACTED_KEY = 'upstairsSimonDistracted';

/** Diana's present on the floor in upstairs bedroom, 1 tile south of the bed (cols 25..26, row 8). */
export const UPSTAIRS_DIANA_PRESENT_BOUNDS: Rect = {
  x: 25.5 * TILE_SIZE + 2,
  y: 8 * TILE_SIZE + 4,
  width: 10,
  height: 10,
};

/** Simon's present inside the office in the southeast corner (col 24, row 17). */
export const UPSTAIRS_SIMON_PRESENT_BOUNDS: Rect = {
  x: 24 * TILE_SIZE + 3,
  y: 17 * TILE_SIZE + 3,
  width: 10,
  height: 10,
};

/** Christmas Tree interactable bounds (cols 2..3, rows 14..16). */
export const UPSTAIRS_XMAS_TREE_BOUNDS: Rect = {
  x: 2 * TILE_SIZE,
  y: 14 * TILE_SIZE,
  width: 2 * TILE_SIZE,
  height: 3 * TILE_SIZE,
};

/** Henrik & Tanja in table room (left and right of table at cols 11..12, row 17). */
export const UPSTAIRS_HENRIK_NPC: Rect & { facing: Direction } = {
  x: 10 * TILE_SIZE + 2,
  y: 17 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'down',
};

export const UPSTAIRS_TANJA_NPC: Rect & { facing: Direction } = {
  x: 13 * TILE_SIZE + 2,
  y: 17 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'up',
};

/** Diana & Simon in living room. */
export const UPSTAIRS_DIANA_NPC: Rect & { facing: Direction } = {
  x: 5 * TILE_SIZE + 2, // 1 tile south of couch (col 5, row 12)
  y: 12 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'down',
};

export const UPSTAIRS_SIMON_NPC: Rect & { facing: Direction } = {
  x: 7 * TILE_SIZE + 2, // 1 tile south of right armchair (col 7, row 14)
  y: 14 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'left',
};

/** Anne-Marie in bedroom (north of door below window). */
export const UPSTAIRS_ANNE_MARIE_NPC: Rect & { facing: Direction } = {
  x: 24 * TILE_SIZE + 2,
  y: 5 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'up',
};
export const UPSTAIRS_CUPBOARD_BOUNDS: Rect = {
  x: 2 * TILE_SIZE,
  y: 6 * TILE_SIZE,
  width: TILE_SIZE,
  height: 2 * TILE_SIZE,
};

/** Computer on desk in the office (col 21, row 16). */
export const UPSTAIRS_COMPUTER_BOUNDS: Rect = {
  x: 21 * TILE_SIZE,
  y: 16 * TILE_SIZE,
  width: TILE_SIZE,
  height: TILE_SIZE,
};

export const C4_TAKEN_STATE_KEY = 'upstairsC4Taken';
export const C4_PLACED_STATE_KEY = 'upstairsC4Placed';
export const BODY_ARMOR_TAKEN_KEY = 'upstairsBodyArmorTaken';
export const ANNE_MARIE_HOSTILE_DIALOGUE_KEY = 'upstairsAnneMarieHostileDialogueShown';
export const ANNE_MARIE_MAX_HEALTH = MAX_NPC_HEALTH * 5;
export const ANNE_MARIE_HOSTILE_DIALOGUE_LINES: readonly string[] = [
  'I was just sharpening my knife.',
  'You see... my other knife is missing. Where did I leave it?',
  'Oh I remember.',
  'And I want you to know, it was me.',
  'I stabbed Rudolph.',
];

/** Medkit lying in the open kitchen floor east of the kitchen island (col 12.5, row 7.5). */
export const UPSTAIRS_KITCHEN_MEDKIT_POS = {
  x: 12.5 * TILE_SIZE,
  y: 7.5 * TILE_SIZE,
};

/** Military-grade body armor inside the upstairs bathroom (shower room, col 18, row 5). */
export const UPSTAIRS_BODY_ARMOR_BOUNDS: Rect = {
  x: 18 * TILE_SIZE + 2,
  y: 5 * TILE_SIZE + 2,
  width: 12,
  height: 12,
};

/** Military C4 explosive charge inside Arjan's office (col 23, row 15). */
export const UPSTAIRS_C4_BOUNDS: Rect = {
  x: 23 * TILE_SIZE + 2,
  y: 15 * TILE_SIZE + 3,
  width: 12,
  height: 10,
};

/** Closed collidable door to the room with the second kitchen table. */
export const UPSTAIRS_TABLE_ROOM_DOOR_BOUNDS: Rect = {
  x: 11 * TILE_SIZE,
  y: 15 * TILE_SIZE,
  width: TILE_SIZE,
  height: TILE_SIZE,
};

/**
 * Fog-of-war masks for the southern-most room (Table Room).
 * Leaves uncovered:
 * - West wall tiles down through row 17 (rows 15..17, leaving the row 17 corner with the living room wall uncovered).
 * - East wall tiles down through row 18 (rows 15..18, leaving the row 18 corner with the stairs wall uncovered).
 * Fog on the west wall starts 1 tile further down (at row 18).
 * Fog on the east wall starts 1 tile further down (at row 19).
 * Covers the rest of the room interior, south wall, and remaining west/east walls.
 */
export const UPSTAIRS_TABLE_ROOM_HIDDEN_MASKS: readonly Rect[] = [
  // Rows 16..17: interior cols 10..13 (excluding west wall col 9 & east wall col 14)
  {
    x: 10 * TILE_SIZE,
    y: 16 * TILE_SIZE,
    width: 4 * TILE_SIZE,
    height: 2 * TILE_SIZE,
  },
  // Row 18: west wall col 9 + interior cols 10..13 (starts west wall fog at row 18, excluding east wall col 14)
  {
    x: 9 * TILE_SIZE,
    y: 18 * TILE_SIZE,
    width: 5 * TILE_SIZE,
    height: 1 * TILE_SIZE,
  },
  // Rows 19..21: full width cols 9..14 (starts east wall fog at row 19, full width for south wall)
  {
    x: 9 * TILE_SIZE,
    y: 19 * TILE_SIZE,
    width: 6 * TILE_SIZE,
    height: 3 * TILE_SIZE,
  },
];

export const UPSTAIRS_TABLE_ROOM_HIDDEN_MASK: Rect =
  UPSTAIRS_TABLE_ROOM_HIDDEN_MASKS[0];

/** Trigger region inside "The Kitchen" (cols 9..15, rows 5..8, triggered 1 tile further north). */
export const KITCHEN_TRIGGER_BOUNDS: Rect = {
  x: 9 * TILE_SIZE,
  y: 5 * TILE_SIZE,
  width: 6 * TILE_SIZE,
  height: 3.5 * TILE_SIZE,
};

export const KITCHEN_ROSANNA_STATE_KEY = 'kitchenRosannaEventTriggered';
export const ROSANNA_SANTA_START_X = 11.0 * TILE_SIZE;
export const ROSANNA_SANTA_END_X = 12.0 * TILE_SIZE;
export const ROSANNA_SANTA_Y = 2.5 * TILE_SIZE;
export const ROSANNA_INTERIOR_X = 12.5 * TILE_SIZE - 6;
export const ROSANNA_INTERIOR_Y = 5.5 * TILE_SIZE - 6;
export const TABLE_ROOM_AMBUSH_STATE_KEY = 'upstairsTableRoomAmbushTriggered';
export const TABLE_ROOM_AMBUSH_TRIGGER_BOUNDS: Rect = {
  x: 9 * TILE_SIZE,
  y: 11 * TILE_SIZE,
  width: 5.5 * TILE_SIZE,
  height: 2.8 * TILE_SIZE,
};

export interface RosannaCutsceneState {
  active: boolean;
  phase: 'rising' | 'firing' | 'jumping';
  santaX: number;
  santaY: number;
  santaZ: number;
  facingAngle: number;
  walkTimer: number;
  elapsed: number;
  firedShot: boolean;
}

export interface TableRoomAmbushCutsceneState {
  active: boolean;
  timer: number;
}

export class LevelUpstairs implements GameLevel {
  public readonly id: LevelId = 'level-upstairs';
  public readonly map: TileMap = {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tileSize: TILE_SIZE,
    tiles: UPSTAIRS_TILES.map((row) => [...row]),
  };
  public doors: CollidableDoor[];
  public openedDoors: OpenedDoorAnimation[] = [];
  public rosannaCutscene: RosannaCutsceneState | null = null;
  public tableRoomAmbushCutscene: TableRoomAmbushCutsceneState = {
    active: false,
    timer: 0,
  };
  public rosannaSpawned: boolean = false;
  public readonly rosannaNpc: Rect = {
    x: ROSANNA_INTERIOR_X,
    y: ROSANNA_INTERIOR_Y,
    width: 12,
    height: 12,
  };
  public rosannaCone: ConeOfSight | null = null;
  public rosannaCombat: ArmedNpcState;
  public cat: Cat;

  // Upstairs NPCs
  public albinX: number = UPSTAIRS_ALBIN_X;
  public albinY: number = UPSTAIRS_ALBIN_START_Y;
  public albinDir: 1 | -1 = 1; // 1 = walking down (south), -1 = walking up (north)
  public albinCone: ConeOfSight | null;
  public albinCombat: ArmedNpcState;

  public readonly henrikNpc = { ...UPSTAIRS_HENRIK_NPC };
  public henrikAngle: number = Math.PI / 2; // Facing south initially
  public henrikTimer: number = 0;
  public henrikCone: ConeOfSight | null;
  public henrikCombat: ArmedNpcState;

  public readonly tanjaNpc = { ...UPSTAIRS_TANJA_NPC };
  public tanjaCone: ConeOfSight | null;
  public tanjaCombat: ArmedNpcState;

  public readonly dianaNpc = { ...UPSTAIRS_DIANA_NPC };
  public dianaCone: ConeOfSight | null = null;
  public dianaCombat: ArmedNpcState;

  public readonly simonNpc = { ...UPSTAIRS_SIMON_NPC };
  public simonCone: ConeOfSight | null = null;
  public simonCombat: ArmedNpcState;

  public readonly anneMarieNpc = { ...UPSTAIRS_ANNE_MARIE_NPC };
  public anneMarieAngle: number = Math.PI / 2; // Facing south toward the bedroom door
  public anneMarieTimer: number = 0;
  public anneMarieCone: ConeOfSight | null;
  public anneMarieCombat: ArmedNpcState;

  public intruderDetected: boolean = false;

  constructor() {
    this.cat = createCat();
    this.doors = [
      {
        id: 'upstairs-shower-door',
        bounds: { ...UPSTAIRS_SHOWER_DOOR_BOUNDS },
        hiddenRegions: [{ ...UPSTAIRS_SHOWER_HIDDEN_MASK }],
      },
      {
        id: 'upstairs-bedroom-door',
        bounds: { ...UPSTAIRS_BEDROOM_DOOR_BOUNDS },
        hiddenRegions: [{ ...UPSTAIRS_BEDROOM_HIDDEN_MASK }],
      },
      {
        id: 'upstairs-office-door',
        bounds: { ...UPSTAIRS_OFFICE_DOOR_BOUNDS },
        hiddenRegions: [{ ...UPSTAIRS_OFFICE_HIDDEN_MASK }],
      },
      {
        id: 'upstairs-table-room-door',
        bounds: { ...UPSTAIRS_TABLE_ROOM_DOOR_BOUNDS },
        hiddenRegions: UPSTAIRS_TABLE_ROOM_HIDDEN_MASKS.map((r) => ({ ...r })),
      },
    ];

    this.albinCombat = createArmedNpcState('upstairs:Albin', 'Albin', Math.PI / 2);
    this.henrikCombat = createArmedNpcState(
      'upstairs:Henrik',
      'Henrik',
      this.henrikAngle,
      'flamethrower'
    );
    this.tanjaCombat = createArmedNpcState(
      'upstairs:Tanja',
      'Tanja',
      -Math.PI / 2,
      'flamethrower'
    );
    this.rosannaCombat = createArmedNpcState(
      'upstairs:Rosanna',
      'Rosanna',
      Math.PI / 2,
      'bazooka'
    );

    this.albinCone = new ConeOfSight(
      { x: UPSTAIRS_ALBIN_X + TILE_SIZE / 2, y: this.albinY + TILE_SIZE / 2 },
      Math.PI / 2, // south
      undefined,
      this.map
    );

    this.henrikCone = new ConeOfSight(
      { x: this.henrikNpc.x + TILE_SIZE / 2, y: this.henrikNpc.y + TILE_SIZE / 2 },
      this.henrikAngle,
      undefined,
      this.map
    );

    this.tanjaCone = new ConeOfSight(
      { x: this.tanjaNpc.x + TILE_SIZE / 2, y: this.tanjaNpc.y + TILE_SIZE / 2 },
      -Math.PI / 2, // north
      undefined,
      this.map
    );

    // Diana faces the Christmas tree (down-left) with a 50% wider field of view
    const dianaTreeAngle = Math.atan2(
      15.5 * TILE_SIZE - (this.dianaNpc.y + TILE_SIZE / 2),
      3.0 * TILE_SIZE - (this.dianaNpc.x + TILE_SIZE / 2)
    );
    this.dianaCombat = createArmedNpcState('upstairs:Diana', 'Diana', dianaTreeAngle);
    this.dianaCone = new ConeOfSight(
      { x: this.dianaNpc.x + TILE_SIZE / 2, y: this.dianaNpc.y + TILE_SIZE / 2 },
      dianaTreeAngle,
      DEFAULT_CONE_OF_SIGHT_DISTANCE,
      this.map,
      DEFAULT_CONE_OF_SIGHT_FOV * 1.5
    );

    // Simon faces the Christmas tree (left / slightly down-left) with a 50% wider field of view
    const simonTreeAngle = Math.atan2(
      15.5 * TILE_SIZE - (this.simonNpc.y + TILE_SIZE / 2),
      3.0 * TILE_SIZE - (this.simonNpc.x + TILE_SIZE / 2)
    );
    this.simonCombat = createArmedNpcState('upstairs:Simon', 'Simon', simonTreeAngle);
    this.simonCone = new ConeOfSight(
      { x: this.simonNpc.x + TILE_SIZE / 2, y: this.simonNpc.y + TILE_SIZE / 2 },
      simonTreeAngle,
      DEFAULT_CONE_OF_SIGHT_DISTANCE,
      this.map,
      DEFAULT_CONE_OF_SIGHT_FOV * 1.5
    );

    this.anneMarieCombat = createArmedNpcState(
      'upstairs:Anne-Marie',
      'Anne-Marie',
      this.anneMarieAngle,
      'katana',
      ANNE_MARIE_MAX_HEALTH
    );
    this.anneMarieCone = new ConeOfSight(
      { x: this.anneMarieNpc.x + TILE_SIZE / 2, y: this.anneMarieNpc.y + TILE_SIZE / 2 },
      this.anneMarieAngle,
      undefined,
      this.map
    );
  }

  public getArmedNpcs(): Array<{ state: ArmedNpcState; bounds: Rect; visible: boolean }> {
    const isTableRoomDoorOpen = !this.doors.some(
      (d) => d.id === 'upstairs-table-room-door' && d.hiddenRegions.length > 0
    );
    const isBedroomDoorOpen = !this.doors.some(
      (d) => d.id === 'upstairs-bedroom-door' && d.hiddenRegions.length > 0
    );
    return [
      {
        state: this.albinCombat,
        bounds: { x: this.albinX, y: this.albinY, width: 12, height: 12 },
        visible: true,
      },
      { state: this.henrikCombat, bounds: this.henrikNpc, visible: isTableRoomDoorOpen },
      { state: this.tanjaCombat, bounds: this.tanjaNpc, visible: isTableRoomDoorOpen },
      { state: this.dianaCombat, bounds: this.dianaNpc, visible: true },
      { state: this.simonCombat, bounds: this.simonNpc, visible: true },
      { state: this.anneMarieCombat, bounds: this.anneMarieNpc, visible: isBedroomDoorOpen },
      ...(this.rosannaSpawned
        ? [{ state: this.rosannaCombat, bounds: this.rosannaNpc, visible: true }]
        : []),
    ];
  }

  public getArmedNpcByKey(key: string): ArmedNpcState | undefined {
    for (const entry of this.getArmedNpcs()) {
      if (entry.state.key === key) return entry.state;
    }
    return undefined;
  }

  public enter(player: Player): void {
    player.x = UPSTAIRS_STAIRS_SPAWN.x;
    player.y = UPSTAIRS_STAIRS_SPAWN.y;
    player.facing = UPSTAIRS_STAIRS_SPAWN.facing;
    player.yaw = -Math.PI / 2;
    player.renderYaw = -Math.PI / 2;
    player.jumpOffset = 0;
    player.jumpVelocity = 0;
    player.isMoving = false;
    player.walkTimer = 0;

    // Starting upstairs limits flamethrower fuel to 10 flames (until refilled by drops)
    if (!Number.isFinite(player.flamethrowerAmmo)) {
      player.flamethrowerAmmo = UPSTAIRS_INITIAL_FLAMETHROWER_AMMO;
    }

    // Reset Upstairs passive sight & timers (preserve dead NPCs)
    this.intruderDetected = false;
    if (this.albinCombat.mode !== 'dead') {
      this.albinCombat.mode = 'passive';
      this.albinCombat.unseenTimer = 0;
      this.albinY = UPSTAIRS_ALBIN_START_Y;
      this.albinDir = 1;
      this.albinCombat.aimYaw = Math.PI / 2;
      this.albinCone = new ConeOfSight(
        { x: UPSTAIRS_ALBIN_X + TILE_SIZE / 2, y: this.albinY + TILE_SIZE / 2 },
        Math.PI / 2,
        undefined,
        this.map
      );
    } else {
      this.albinCone = null;
    }

    if (this.henrikCombat.mode !== 'dead') {
      this.henrikCombat.mode = 'passive';
      this.henrikCombat.unseenTimer = 0;
      this.henrikAngle = Math.PI / 2;
      this.henrikTimer = 0;
      this.henrikCombat.aimYaw = this.henrikAngle;
      this.henrikCone = new ConeOfSight(
        { x: this.henrikNpc.x + TILE_SIZE / 2, y: this.henrikNpc.y + TILE_SIZE / 2 },
        this.henrikAngle,
        undefined,
        this.map
      );
    } else {
      this.henrikCone = null;
    }

    if (this.tanjaCombat.mode !== 'dead') {
      this.tanjaCombat.mode = 'passive';
      this.tanjaCombat.unseenTimer = 0;
      this.tanjaCombat.aimYaw = -Math.PI / 2;
      this.tanjaCone = new ConeOfSight(
        { x: this.tanjaNpc.x + TILE_SIZE / 2, y: this.tanjaNpc.y + TILE_SIZE / 2 },
        -Math.PI / 2,
        undefined,
        this.map
      );
    } else {
      this.tanjaCone = null;
    }

    if (this.dianaCombat.mode !== 'dead' && !player.states.get(DIANA_DISTRACTED_KEY)) {
      this.dianaCombat.mode = 'passive';
      this.dianaCombat.unseenTimer = 0;
      const dianaTreeAngle = Math.atan2(
        15.5 * TILE_SIZE - (this.dianaNpc.y + TILE_SIZE / 2),
        3.0 * TILE_SIZE - (this.dianaNpc.x + TILE_SIZE / 2)
      );
      this.dianaCombat.aimYaw = dianaTreeAngle;
      this.dianaCone = new ConeOfSight(
        { x: this.dianaNpc.x + TILE_SIZE / 2, y: this.dianaNpc.y + TILE_SIZE / 2 },
        dianaTreeAngle,
        DEFAULT_CONE_OF_SIGHT_DISTANCE,
        this.map,
        DEFAULT_CONE_OF_SIGHT_FOV * 1.5
      );
    } else {
      this.dianaCone = null;
    }

    if (this.simonCombat.mode !== 'dead' && !player.states.get(SIMON_DISTRACTED_KEY)) {
      this.simonCombat.mode = 'passive';
      this.simonCombat.unseenTimer = 0;
      const simonTreeAngle = Math.atan2(
        15.5 * TILE_SIZE - (this.simonNpc.y + TILE_SIZE / 2),
        3.0 * TILE_SIZE - (this.simonNpc.x + TILE_SIZE / 2)
      );
      this.simonCombat.aimYaw = simonTreeAngle;
      this.simonCone = new ConeOfSight(
        { x: this.simonNpc.x + TILE_SIZE / 2, y: this.simonNpc.y + TILE_SIZE / 2 },
        simonTreeAngle,
        DEFAULT_CONE_OF_SIGHT_DISTANCE,
        this.map,
        DEFAULT_CONE_OF_SIGHT_FOV * 1.5
      );
    } else {
      this.simonCone = null;
    }

    if (this.anneMarieCombat.mode !== 'dead') {
      this.anneMarieCombat.mode = 'passive';
      this.anneMarieCombat.unseenTimer = 0;
      this.anneMarieAngle = Math.PI / 2;
      this.anneMarieTimer = 0;
      this.anneMarieCombat.aimYaw = this.anneMarieAngle;
      this.anneMarieCone = new ConeOfSight(
        { x: this.anneMarieNpc.x + TILE_SIZE / 2, y: this.anneMarieNpc.y + TILE_SIZE / 2 },
        this.anneMarieAngle,
        undefined,
        this.map
      );
    } else {
      this.anneMarieCone = null;
    }

    if (this.rosannaSpawned && this.rosannaCombat.mode !== 'dead') {
      this.rosannaCombat.mode = 'passive';
      this.rosannaCombat.unseenTimer = 0;
      this.rosannaCombat.aimYaw = Math.PI / 2;
      this.rosannaCone = new ConeOfSight(
        { x: this.rosannaNpc.x + 6, y: this.rosannaNpc.y + 6 },
        Math.PI / 2,
        undefined,
        this.map
      );
    }
  }

  public getSolidObstacles(): readonly Rect[] {
    const obs: Rect[] = [
      UPSTAIRS_STAIRS_TRIGGER_BOUNDS,
      ...this.doors.map((d) => d.bounds),
    ];
    if (this.albinCombat.mode !== 'dead') {
      obs.push({ x: this.albinX, y: this.albinY, width: 12, height: 12 });
    }
    if (this.henrikCombat.mode !== 'dead') obs.push(this.henrikNpc);
    if (this.tanjaCombat.mode !== 'dead') obs.push(this.tanjaNpc);
    if (this.dianaCombat.mode !== 'dead') obs.push(this.dianaNpc);
    if (this.simonCombat.mode !== 'dead') obs.push(this.simonNpc);
    if (this.anneMarieCombat.mode !== 'dead') obs.push(this.anneMarieNpc);
    if (this.rosannaSpawned && this.rosannaCombat.mode !== 'dead') {
      obs.push(this.rosannaNpc);
    }
    return obs;
  }

  public getInteractables(player?: Player): Interactable[] {
    const list: Interactable[] = [
      {
        id: 'upstairs-office-pc',
        bounds: { ...UPSTAIRS_COMPUTER_BOUNDS },
        promptText: 'Start PC',
        dialogueLines: [
          'Hmm... is this where Arjan pretends to work? It\'s just a bunch of pictures of Anne-Marie.',
          'Hey there\'s actually a python script here, shall we run it?',
          'You are now addicted to Olexa\'s text-based christmas adventure.',
        ],
      },
    ];

    // C4 explosive inside Arjan's office (if not already taken)
    if (!player?.states.get(C4_TAKEN_STATE_KEY)) {
      list.push({
        id: 'upstairs-office-c4',
        bounds: { ...UPSTAIRS_C4_BOUNDS },
        promptText: 'Pick up C4',
        dialogueLines: [],
      });
    }

    // Military-grade body armor in upstairs bathroom (if not already taken)
    if (!player?.states.get(BODY_ARMOR_TAKEN_KEY) && !player?.hasBodyArmor) {
      list.push({
        id: 'upstairs-body-armor',
        bounds: { ...UPSTAIRS_BODY_ARMOR_BOUNDS },
        promptText: 'Take Body Armor',
        dialogueLines: [],
      });
    }

    // Diana's Present in bedroom (if not already taken)
    if (!player?.states.get(DIANA_PRESENT_TAKEN_KEY)) {
      list.push({
        id: 'upstairs-diana-present',
        bounds: { ...UPSTAIRS_DIANA_PRESENT_BOUNDS },
        promptText: "Take Diana's Present",
        dialogueLines: [],
      });
    }

    // Simon's Present in office (if not already taken)
    if (!player?.states.get(SIMON_PRESENT_TAKEN_KEY)) {
      list.push({
        id: 'upstairs-simon-present',
        bounds: { ...UPSTAIRS_SIMON_PRESENT_BOUNDS },
        promptText: "Take Simon's Present",
        dialogueLines: [],
      });
    }

    // Christmas Tree interactable (Place C4 once retrieved from Arjan's office)
    if (
      player?.states.get(C4_TAKEN_STATE_KEY) &&
      !player?.states.get(C4_PLACED_STATE_KEY)
    ) {
      list.push({
        id: 'upstairs-xmas-tree',
        bounds: { ...UPSTAIRS_XMAS_TREE_BOUNDS },
        promptText: 'Place C4',
        dialogueLines: [],
      });
    }

    for (const door of this.doors) {
      list.push({
        id: door.id,
        bounds: { ...door.bounds },
        promptText: 'Open door',
        dialogueLines: [],
      });
    }

    return list;
  }

  public handleInteraction(
    interactableId: string,
    player: Player,
    ctx: LevelTransitionContext
  ): boolean {
    if (interactableId === 'upstairs-office-c4') {
      player.states.set(C4_TAKEN_STATE_KEY, true);
      ctx.openDialogue([
        'You picked up a block of military-grade C4 explosive! Now plant it under the Christmas tree...',
      ]);
      return true;
    }

    if (interactableId === 'upstairs-body-armor') {
      player.states.set(BODY_ARMOR_TAKEN_KEY, true);
      equipPlayerBodyArmor(player);
      ctx.openDialogue([
        'You put on military-grade body armor! Max HP increased to 200 and restored to full.',
      ]);
      return true;
    }

    if (interactableId === 'upstairs-diana-present') {
      player.states.set(DIANA_PRESENT_TAKEN_KEY, true);
      ctx.openDialogue([
        "I'll open this! Hmm, it's whiskey.",
        'You drank the whole bottle.',
      ]);
      return true;
    }

    if (interactableId === 'upstairs-simon-present') {
      player.states.set(SIMON_PRESENT_TAKEN_KEY, true);
      ctx.openDialogue([
        "I'll open this! Hmm, it's whiskey.",
        'You drank the whole bottle.',
      ]);
      return true;
    }

    if (interactableId === 'upstairs-xmas-tree') {
      if (!player.states.get(C4_TAKEN_STATE_KEY)) {
        return false;
      }
      const remainingNpcs = ctx.getRemainingNaughtyListNames
        ? ctx.getRemainingNaughtyListNames()
        : [];
      if (remainingNpcs.length > 0) {
        ctx.openDialogue([
          "I'm not ready... I still have to say good-bye to the people on my naughty list. Which are:",
          remainingNpcs.join(', '),
        ]);
        return true;
      }
      player.states.set(C4_PLACED_STATE_KEY, true);
      if (ctx.detonateHouseC4) {
        ctx.detonateHouseC4();
      } else if (ctx.fadeWorldToBlack) {
        ctx.fadeWorldToBlack();
      }
      ctx.openDialogue(
        [
          'KABOOM! The C4 detonates under the Christmas tree, blowing the entire Rensbo house sky-high!',
          'CONGRATULATIONS! You have "saved" Christmas — not a single witness, wall, or hostile Santa left standing.',
        ],
        undefined,
        undefined,
        true
      );
      return true;
    }

    const doorIdx = this.doors.findIndex((d) => d.id === interactableId);
    if (doorIdx !== -1) {
      const door = this.doors[doorIdx];
      if (door.id === 'upstairs-office-door') {
        ctx.openDialogue([
          "It's locked. Maybe I can blow it open.",
        ]);
        return true;
      }
      if (door.id === 'upstairs-table-room-door') {
        player.states.set(TABLE_ROOM_AMBUSH_STATE_KEY, true);
      }

      this.doors.splice(doorIdx, 1);
      this.openedDoors.push({
        id: door.id,
        bounds: { ...door.bounds },
        progress: 0,
        swingDirection: player.y >= door.bounds.y ? -1 : 1,
      });
      return true;
    }

    if (interactableId === 'upstairs-stairs-down') {
      ctx.loadLevel('level-basement');
      return true;
    }

    return false;
  }

  public triggerTableRoomAmbush(player: Player): void {
    player.states.set(TABLE_ROOM_AMBUSH_STATE_KEY, true);
    const doorIdx = this.doors.findIndex((d) => d.id === 'upstairs-table-room-door');
    if (doorIdx !== -1) {
      const door = this.doors[doorIdx];
      this.doors.splice(doorIdx, 1);
      this.openedDoors.push({
        id: door.id,
        bounds: { ...door.bounds },
        progress: 0,
        swingDirection: 1,
      });
    }
    this.tableRoomAmbushCutscene = { active: true, timer: 0 };
    for (const combat of [this.henrikCombat, this.tanjaCombat]) {
      if (combat.mode !== 'dead' && combat.mode !== 'burning') {
        combat.mode = 'hostile';
        combat.hostileAlertTimer = 0;
        combat.pendingHostileAlertTimer = 0;
        combat.unseenTimer = 0;
        combat.pathTimer = 0;
      }
    }
  }

  public updateTableRoomAmbush(dtSeconds: number, player: Player): void {
    if (
      !player.states.get(TABLE_ROOM_AMBUSH_STATE_KEY) &&
      rectsIntersect(player, TABLE_ROOM_AMBUSH_TRIGGER_BOUNDS)
    ) {
      this.triggerTableRoomAmbush(player);
    }
    if (this.tableRoomAmbushCutscene.active && dtSeconds > 0) {
      this.tableRoomAmbushCutscene.timer += dtSeconds;
      if (this.tableRoomAmbushCutscene.timer >= 1.6) {
        this.tableRoomAmbushCutscene.active = false;
      }
    }
  }

  /**
   * Updates the one-time Kitchen Rosanna bazooka reveal, window jump, and boss spawn cutscene.
   * Returns true if player movement is currently locked by the active cutscene.
   */
  public updateCutscene(
    dtSeconds: number,
    player: Player,
    ctx: LevelTransitionContext
  ): boolean {
    if (this.rosannaCutscene?.active) {
      const cs = this.rosannaCutscene;
      player.isMoving = false;
      player.walkTimer = 0;
      player.facing = 'up';

      cs.elapsed += dtSeconds;

      if (cs.elapsed < 1.0) {
        cs.phase = 'rising';
        const p = Math.min(1, cs.elapsed / 1.0);
        cs.santaZ = -14 + p * 16;
      } else if (cs.elapsed < 2.35) {
        cs.phase = 'firing';
        cs.santaZ = 2;
        if (!cs.firedShot) {
          cs.firedShot = true;
          const originX = cs.santaX + 8;
          const originY = cs.santaY + 8;
          const playerCx = player.x + player.width * 0.5;
          const targetX = Math.max(
            9.5 * TILE_SIZE,
            Math.min(12.2 * TILE_SIZE, playerCx - 2.8 * TILE_SIZE)
          );
          const targetY = 9.05 * TILE_SIZE;
          const shotYaw = Math.atan2(targetY - originY, targetX - originX);
          ctx.fireRosannaCutsceneRocket?.(originX, originY, shotYaw);
        }
      } else if (cs.elapsed < 3.15) {
        cs.phase = 'jumping';
        cs.walkTimer += dtSeconds;
        const jp = Math.min(1, (cs.elapsed - 2.35) / 0.8);
        cs.santaX =
          ROSANNA_SANTA_START_X +
          jp * (ROSANNA_SANTA_END_X - ROSANNA_SANTA_START_X);
        cs.santaY =
          ROSANNA_SANTA_Y +
          jp * (ROSANNA_INTERIOR_Y + 6 - (ROSANNA_SANTA_Y + 8));
        cs.santaZ = Math.sin(jp * Math.PI) * 14;
      } else {
        cs.active = false;
        this.rosannaCutscene = null;
        this.rosannaSpawned = true;
        this.rosannaNpc.x = ROSANNA_INTERIOR_X;
        this.rosannaNpc.y = ROSANNA_INTERIOR_Y;
        this.rosannaCombat.mode = 'hostile';
        this.rosannaCombat.hostileAlertTimer = 0;
        this.rosannaCombat.unseenTimer = 0;
        this.rosannaCombat.pathTimer = 0;
        this.rosannaCombat.fireCooldown = 1.2;
      }
      return true;
    }

    // Check if the player just walked into the kitchen for the first time
    if (
      !player.states.get(KITCHEN_ROSANNA_STATE_KEY) &&
      rectsIntersect(player, KITCHEN_TRIGGER_BOUNDS)
    ) {
      player.states.set(KITCHEN_ROSANNA_STATE_KEY, true);
      player.isMoving = false;
      player.walkTimer = 0;
      player.facing = 'up';
      this.rosannaCutscene = {
        active: true,
        phase: 'rising',
        santaX: ROSANNA_SANTA_START_X,
        santaY: ROSANNA_SANTA_Y,
        santaZ: -14,
        facingAngle: Math.PI / 2,
        walkTimer: 0,
        elapsed: 0,
        firedShot: false,
      };
      return true;
    }

    return false;
  }

  private updateHostileNpc(
    combat: ArmedNpcState,
    bounds: Rect,
    player: Player,
    dtSeconds: number,
    ctx: LevelTransitionContext,
    fov: number = DEFAULT_CONE_OF_SIGHT_FOV
  ): ConeOfSight {
    stepHostileNpcAlongPath(
      combat,
      bounds,
      player,
      this.map,
      this.getSolidObstacles(),
      dtSeconds,
      combat.key === 'upstairs:Anne-Marie' ? 2 : 1
    );
    const originX = bounds.x + bounds.width * 0.5;
    const originY = bounds.y + bounds.height * 0.5;
    const playerCx = player.x + player.width * 0.5;
    const playerCy = player.y + player.height * 0.5;
    const aimYaw = Math.atan2(playerCy - originY, playerCx - originX);
    combat.aimYaw = aimYaw;
    const cone = new ConeOfSight(
      { x: originX, y: originY },
      aimYaw,
      DEFAULT_CONE_OF_SIGHT_DISTANCE,
      this.map,
      fov
    );
    if (cone.checkDetection(player)) {
      combat.unseenTimer = 0;
    } else {
      combat.unseenTimer += dtSeconds;
    }
    if (combat.unseenTimer >= NPC_HOSTILE_LOSE_SIGHT_SECONDS) {
      combat.mode = 'passive';
      combat.unseenTimer = 0;
      combat.isMoving = false;
      combat.path = [];
      combat.pathTimer = 0;
    } else if (combat.weapon === 'katana') {
      if (
        combat.hostileAlertTimer <= 0 &&
        combat.meleeCooldown <= 0 &&
        Math.hypot(playerCx - originX, playerCy - originY) <= NPC_KATANA_MELEE_RANGE
      ) {
        ctx.damagePlayer?.(NPC_KATANA_MELEE_DAMAGE);
        combat.meleeCooldown = NPC_KATANA_MELEE_COOLDOWN;
      }
    } else if (combat.weapon === 'flamethrower') {
      tryFireHostileNpcFlamethrower(
        combat,
        originX,
        originY,
        aimYaw,
        ctx.fireNpcFlamethrower
      );
    } else if (combat.weapon === 'bazooka') {
      tryFireHostileNpcBazooka(
        combat,
        originX,
        originY,
        aimYaw,
        ctx.fireNpcBazooka
      );
    } else {
      tryFireHostileNpcUzi(combat, originX, originY, aimYaw, ctx.fireNpcUzi);
    }
    return cone;
  }

  /**
   * Updates all Upstairs NPCs' patrol, cones of sight, and hostile Uzi combat.
   */
  public updateNpcSight(
    dtSeconds: number,
    player: Player,
    ctx: LevelTransitionContext
  ): void {
    const playerCx = player.x + player.width * 0.5;
    const playerCy = player.y + player.height * 0.5;

    // 1. Albin in dining room (col 7, rows 5..9)
    updateNpcHealthAndTimers(this.albinCombat, dtSeconds);
    if (this.albinCombat.mode === 'dead') {
      this.albinCone = null;
    } else if (this.albinCombat.mode === 'burning') {
      this.albinCone = null;
      const albinBounds: Rect = { x: this.albinX, y: this.albinY, width: 12, height: 12 };
      stepBurningNpc(
        this.albinCombat,
        albinBounds,
        player,
        this.map,
        this.getSolidObstacles(),
        dtSeconds,
        ctx.fireNpcUzi
      );
      this.albinX = albinBounds.x;
      this.albinY = albinBounds.y;
    } else if (this.albinCombat.mode === 'hostile') {
      const albinBounds: Rect = { x: this.albinX, y: this.albinY, width: 12, height: 12 };
      this.albinCone = this.updateHostileNpc(
        this.albinCombat,
        albinBounds,
        player,
        dtSeconds,
        ctx
      );
      this.albinX = albinBounds.x;
      this.albinY = albinBounds.y;
    } else {
      this.albinY += this.albinDir * UPSTAIRS_ALBIN_SPEED * dtSeconds;
      if (this.albinDir === 1 && this.albinY >= UPSTAIRS_ALBIN_END_Y) {
        this.albinY = UPSTAIRS_ALBIN_END_Y;
        this.albinDir = -1;
      } else if (this.albinDir === -1 && this.albinY <= UPSTAIRS_ALBIN_START_Y) {
        this.albinY = UPSTAIRS_ALBIN_START_Y;
        this.albinDir = 1;
      }
      const albinAngle = this.albinDir === 1 ? Math.PI / 2 : -Math.PI / 2;
      this.albinCombat.aimYaw = albinAngle;
      this.albinCone = new ConeOfSight(
        { x: this.albinX + TILE_SIZE / 2, y: this.albinY + TILE_SIZE / 2 },
        albinAngle,
        undefined,
        this.map
      );
      if (this.albinCone.checkDetection(player)) {
        enterHostileMode(this.albinCombat);
        const aimYaw = Math.atan2(playerCy - (this.albinY + 6), playerCx - (this.albinX + 6));
        this.albinCombat.aimYaw = aimYaw;
        this.albinCone = new ConeOfSight(
          { x: this.albinX + 6, y: this.albinY + 6 },
          aimYaw,
          undefined,
          this.map
        );
        propagateHostileAlert(this.getArmedNpcs(), this.albinCombat.key);
      }
    }

    // 2. Henrik & Tanja in table room (only if table room door or wall is opened!)
    const isTableRoomDoorOpen = !this.doors.some(
      (d) => d.id === 'upstairs-table-room-door' && d.hiddenRegions.length > 0
    );
    updateNpcHealthAndTimers(this.henrikCombat, dtSeconds);
    updateNpcHealthAndTimers(this.tanjaCombat, dtSeconds);
    if (isTableRoomDoorOpen) {
      if (this.henrikCombat.mode === 'dead') {
        this.henrikCone = null;
      } else if (this.henrikCombat.mode === 'burning') {
        this.henrikCone = null;
        stepBurningNpc(
          this.henrikCombat,
          this.henrikNpc,
          player,
          this.map,
          this.getSolidObstacles(),
          dtSeconds,
          ctx.fireNpcUzi,
          ctx.fireNpcFlamethrower,
          ctx.fireNpcBazooka
        );
      } else if (this.henrikCombat.mode === 'hostile') {
        this.henrikCone = this.updateHostileNpc(
          this.henrikCombat,
          this.henrikNpc,
          player,
          dtSeconds,
          ctx
        );
      } else {
        this.henrikTimer += dtSeconds;
        if (this.henrikTimer >= 1.0) {
          this.henrikTimer -= 1.0;
          this.henrikAngle -= Math.PI / 4;
          this.henrikCone = new ConeOfSight(
            { x: this.henrikNpc.x + TILE_SIZE / 2, y: this.henrikNpc.y + TILE_SIZE / 2 },
            this.henrikAngle,
            undefined,
            this.map
          );
        }
        this.henrikCombat.aimYaw = this.henrikCone?.direction ?? this.henrikAngle;
        if (this.henrikCone?.checkDetection(player)) {
          enterHostileMode(this.henrikCombat);
          const aimYaw = Math.atan2(playerCy - (this.henrikNpc.y + 6), playerCx - (this.henrikNpc.x + 6));
          this.henrikCombat.aimYaw = aimYaw;
          this.henrikCone = new ConeOfSight(
            { x: this.henrikNpc.x + 6, y: this.henrikNpc.y + 6 },
            aimYaw,
            undefined,
            this.map
          );
          propagateHostileAlert(this.getArmedNpcs(), this.henrikCombat.key);
        }
      }

      if (this.tanjaCombat.mode === 'dead') {
        this.tanjaCone = null;
      } else if (this.tanjaCombat.mode === 'burning') {
        this.tanjaCone = null;
        stepBurningNpc(
          this.tanjaCombat,
          this.tanjaNpc,
          player,
          this.map,
          this.getSolidObstacles(),
          dtSeconds,
          ctx.fireNpcUzi,
          ctx.fireNpcFlamethrower,
          ctx.fireNpcBazooka
        );
      } else if (this.tanjaCombat.mode === 'hostile') {
        this.tanjaCone = this.updateHostileNpc(
          this.tanjaCombat,
          this.tanjaNpc,
          player,
          dtSeconds,
          ctx
        );
      } else {
        if (!this.tanjaCone) {
          this.tanjaCone = new ConeOfSight(
            { x: this.tanjaNpc.x + TILE_SIZE / 2, y: this.tanjaNpc.y + TILE_SIZE / 2 },
            -Math.PI / 2,
            undefined,
            this.map
          );
        }
        this.tanjaCombat.aimYaw = this.tanjaCone.direction;
        if (this.tanjaCone.checkDetection(player)) {
          enterHostileMode(this.tanjaCombat);
          const aimYaw = Math.atan2(playerCy - (this.tanjaNpc.y + 6), playerCx - (this.tanjaNpc.x + 6));
          this.tanjaCombat.aimYaw = aimYaw;
          this.tanjaCone = new ConeOfSight(
            { x: this.tanjaNpc.x + 6, y: this.tanjaNpc.y + 6 },
            aimYaw,
            undefined,
            this.map
          );
          propagateHostileAlert(this.getArmedNpcs(), this.tanjaCombat.key);
        }
      }
    }

    // 3. Diana & Simon in living room
    updateNpcHealthAndTimers(this.dianaCombat, dtSeconds);
    if (this.dianaCombat.mode === 'dead') {
      this.dianaCone = null;
    } else if (this.dianaCombat.mode === 'burning') {
      this.dianaCone = null;
      stepBurningNpc(
        this.dianaCombat,
        this.dianaNpc,
        player,
        this.map,
        this.getSolidObstacles(),
        dtSeconds,
        ctx.fireNpcUzi
      );
    } else if (this.dianaCombat.mode === 'hostile') {
      this.dianaCone = this.updateHostileNpc(
        this.dianaCombat,
        this.dianaNpc,
        player,
        dtSeconds,
        ctx,
        DEFAULT_CONE_OF_SIGHT_FOV * 1.5
      );
      if ((this.dianaCombat.mode as string) === 'passive') {
        if (player.states.get(DIANA_DISTRACTED_KEY)) {
          this.dianaCone = null;
        } else {
          const dianaTreeAngle = Math.atan2(
            15.5 * TILE_SIZE - (this.dianaNpc.y + TILE_SIZE / 2),
            3.0 * TILE_SIZE - (this.dianaNpc.x + TILE_SIZE / 2)
          );
          this.dianaCombat.aimYaw = dianaTreeAngle;
          this.dianaCone = new ConeOfSight(
            { x: this.dianaNpc.x + TILE_SIZE / 2, y: this.dianaNpc.y + TILE_SIZE / 2 },
            dianaTreeAngle,
            DEFAULT_CONE_OF_SIGHT_DISTANCE,
            this.map,
            DEFAULT_CONE_OF_SIGHT_FOV * 1.5
          );
        }
      }
    } else if (this.dianaCone && this.dianaCone.checkDetection(player)) {
      enterHostileMode(this.dianaCombat);
      const aimYaw = Math.atan2(playerCy - (this.dianaNpc.y + 6), playerCx - (this.dianaNpc.x + 6));
      this.dianaCombat.aimYaw = aimYaw;
      this.dianaCone = new ConeOfSight(
        { x: this.dianaNpc.x + 6, y: this.dianaNpc.y + 6 },
        aimYaw,
        DEFAULT_CONE_OF_SIGHT_DISTANCE,
        this.map,
        DEFAULT_CONE_OF_SIGHT_FOV * 1.5
      );
      propagateHostileAlert(this.getArmedNpcs(), this.dianaCombat.key);
    }

    updateNpcHealthAndTimers(this.simonCombat, dtSeconds);
    if (this.simonCombat.mode === 'dead') {
      this.simonCone = null;
    } else if (this.simonCombat.mode === 'burning') {
      this.simonCone = null;
      stepBurningNpc(
        this.simonCombat,
        this.simonNpc,
        player,
        this.map,
        this.getSolidObstacles(),
        dtSeconds,
        ctx.fireNpcUzi
      );
    } else if (this.simonCombat.mode === 'hostile') {
      this.simonCone = this.updateHostileNpc(
        this.simonCombat,
        this.simonNpc,
        player,
        dtSeconds,
        ctx,
        DEFAULT_CONE_OF_SIGHT_FOV * 1.5
      );
      if ((this.simonCombat.mode as string) === 'passive') {
        if (player.states.get(SIMON_DISTRACTED_KEY)) {
          this.simonCone = null;
        } else {
          const simonTreeAngle = Math.atan2(
            15.5 * TILE_SIZE - (this.simonNpc.y + TILE_SIZE / 2),
            3.0 * TILE_SIZE - (this.simonNpc.x + TILE_SIZE / 2)
          );
          this.simonCombat.aimYaw = simonTreeAngle;
          this.simonCone = new ConeOfSight(
            { x: this.simonNpc.x + TILE_SIZE / 2, y: this.simonNpc.y + TILE_SIZE / 2 },
            simonTreeAngle,
            DEFAULT_CONE_OF_SIGHT_DISTANCE,
            this.map,
            DEFAULT_CONE_OF_SIGHT_FOV * 1.5
          );
        }
      }
    } else if (this.simonCone && this.simonCone.checkDetection(player)) {
      enterHostileMode(this.simonCombat);
      const aimYaw = Math.atan2(playerCy - (this.simonNpc.y + 6), playerCx - (this.simonNpc.x + 6));
      this.simonCombat.aimYaw = aimYaw;
      this.simonCone = new ConeOfSight(
        { x: this.simonNpc.x + 6, y: this.simonNpc.y + 6 },
        aimYaw,
        DEFAULT_CONE_OF_SIGHT_DISTANCE,
        this.map,
        DEFAULT_CONE_OF_SIGHT_FOV * 1.5
      );
      propagateHostileAlert(this.getArmedNpcs(), this.simonCombat.key);
    }

    // 4. Anne-Marie in bedroom (only if bedroom door or wall is open! Always faces south toward the door when passive)
    const isBedroomDoorOpen = !this.doors.some(
      (d) => d.id === 'upstairs-bedroom-door' && d.hiddenRegions.length > 0
    );
    updateNpcHealthAndTimers(this.anneMarieCombat, dtSeconds);
    if (isBedroomDoorOpen) {
      if (this.anneMarieCombat.mode === 'dead') {
        this.anneMarieCone = null;
      } else if (this.anneMarieCombat.mode === 'burning') {
        this.anneMarieCone = null;
        stepBurningNpc(
          this.anneMarieCombat,
          this.anneMarieNpc,
          player,
          this.map,
          this.getSolidObstacles(),
          dtSeconds,
          ctx.fireNpcUzi
        );
      } else if (this.anneMarieCombat.mode === 'hostile') {
        this.anneMarieCone = this.updateHostileNpc(
          this.anneMarieCombat,
          this.anneMarieNpc,
          player,
          dtSeconds,
          ctx
        );
      } else {
        // Always face south toward the bedroom door (no rotation)
        this.anneMarieAngle = Math.PI / 2;
        this.anneMarieCombat.aimYaw = this.anneMarieAngle;
        this.anneMarieCone = new ConeOfSight(
          { x: this.anneMarieNpc.x + TILE_SIZE / 2, y: this.anneMarieNpc.y + TILE_SIZE / 2 },
          this.anneMarieAngle,
          undefined,
          this.map
        );
        if (this.anneMarieCone.checkDetection(player)) {
          enterHostileMode(this.anneMarieCombat);
          const aimYaw = Math.atan2(playerCy - (this.anneMarieNpc.y + 6), playerCx - (this.anneMarieNpc.x + 6));
          this.anneMarieCombat.aimYaw = aimYaw;
          this.anneMarieCone = new ConeOfSight(
            { x: this.anneMarieNpc.x + 6, y: this.anneMarieNpc.y + 6 },
            aimYaw,
            undefined,
            this.map
          );
          propagateHostileAlert(this.getArmedNpcs(), this.anneMarieCombat.key);
        }
      }

      if (
        (this.anneMarieCombat.mode === 'hostile' ||
          this.anneMarieCombat.mode === 'burning') &&
        !player.states.get(ANNE_MARIE_HOSTILE_DIALOGUE_KEY)
      ) {
        player.states.set(ANNE_MARIE_HOSTILE_DIALOGUE_KEY, true);
        ctx.openDialogue(
          [...ANNE_MARIE_HOSTILE_DIALOGUE_LINES],
          () => {
            ctx.openDialogue(
              ['ACHIEVEMENT UNLOCKED: Murder-mystery solved.'],
              undefined,
              undefined,
              false,
              'achievement'
            );
          },
          'Anne-Marie'
        );
      }
    }

    // 5. Spawned Rosanna boss inside Kitchen (after window jump cutscene completes)
    if (this.rosannaSpawned) {
      updateNpcHealthAndTimers(this.rosannaCombat, dtSeconds);
      if (this.rosannaCombat.mode === 'dead') {
        this.rosannaCone = null;
      } else if (this.rosannaCombat.mode === 'burning') {
        this.rosannaCone = null;
        stepBurningNpc(
          this.rosannaCombat,
          this.rosannaNpc,
          player,
          this.map,
          this.getSolidObstacles(),
          dtSeconds,
          ctx.fireNpcUzi,
          ctx.fireNpcFlamethrower,
          ctx.fireNpcBazooka
        );
      } else if (this.rosannaCombat.mode === 'hostile') {
        this.rosannaCone = this.updateHostileNpc(
          this.rosannaCombat,
          this.rosannaNpc,
          player,
          dtSeconds,
          ctx
        );
      } else {
        this.rosannaCone = new ConeOfSight(
          { x: this.rosannaNpc.x + 6, y: this.rosannaNpc.y + 6 },
          this.rosannaCombat.aimYaw,
          undefined,
          this.map
        );
        if (this.rosannaCone.checkDetection(player)) {
          enterHostileMode(this.rosannaCombat);
          const aimYaw = Math.atan2(
            playerCy - (this.rosannaNpc.y + 6),
            playerCx - (this.rosannaNpc.x + 6)
          );
          this.rosannaCombat.aimYaw = aimYaw;
          this.rosannaCone = new ConeOfSight(
            { x: this.rosannaNpc.x + 6, y: this.rosannaNpc.y + 6 },
            aimYaw,
            undefined,
            this.map
          );
          propagateHostileAlert(this.getArmedNpcs(), this.rosannaCombat.key);
        }
      }
    }
  }
}
