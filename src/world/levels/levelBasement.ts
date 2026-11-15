import {
  Direction,
  Player,
  Rect,
  rectsIntersect,
  selectPlayerEquipmentSlot,
} from '../../entities/player';
import { ConeOfSight } from '../../entities/sight';
import { Interactable } from '../interaction';
import { MAP_COLS, MAP_ROWS, TILE_SIZE, TileMap, TileType } from '../tilemap';
import { UPSTAIRS_INTRO_STATE_KEY } from './levelUpstairs';
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
const S = TileType.StoneTileFloor;
const B = TileType.BathroomTileFloor;
const T = TileType.StairsFloor;
const O = TileType.FurnitureSolid;

/**
 * Cozy 32x28 Tile Matrix for `level-basement` (based on inspiration/level-basement.jpg):
 * - West wing (cols 6..13):
 *   - The Library (cols 7..12, rows 6..12, WoodFloor): Bookshelf on north wall (rows 6..7, cols 7..12),
 *     neutral couch on west side (col 7, rows 9..11), stack of wood on east side (col 12, rows 8..9),
 *     and The Fireplace (cols 11..12, rows 11..12).
 *   - Basement Living Room (cols 7..12, rows 13..20, WoodFloor): Neutral couch (cols 8..10, row 14),
 *     chess board table (cols 8..9, row 17), extra big south windows (row 20, cols 7..9 & 10..12),
 *     and a character standing by the south window looking out (col 11, row 18.5).
 * - East wing (cols 14..22):
 *   - Basement Hallway (cols 14..21, rows 13..19, StoneTileFloor):
 *     Locked door on north wall (cols 15..16, row 12) is straight north from the locked Front Door
 *     on the south wall (cols 15..16, row 20). Coat hangers on west wall (col 14, rows 17..18).
 *   - Stairs (cols 18..21, rows 15..18): Inside the east part of the hallway, directly south of the bathroom.
 *   - Basement Bathroom (cols 18..22, rows 7..12, BathroomTileFloor): Directly north of the stairs,
 *     with a collidable door at (col 20, row 12), sink on west wall (col 19, rows 9..10), and toilet on north-east (col 21, row 8).
 */
export const BASEMENT_TILES: TileType[][] = [
  //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 0
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 1
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 2
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 3
  [V, V, V, V, V, V, V, V, V, V, V, V, V, W, W, W, W, W, W, V, V, V, V, V, V, V, V, V, V, V, V, V], // 4: Expanded Spa Room north wall (cols 13..18)
  [V, V, V, V, V, V, V, V, V, V, V, V, V, W, B, B, B, B, W, V, V, V, V, V, V, V, V, V, V, V, V, V], // 5: Spa Room north bathtub end (cols 14..17)
  [V, V, V, V, V, V, W, W, W, W, W, W, W, W, B, B, B, B, W, V, V, V, V, V, V, V, V, V, V, V, V, V], // 6: Library Bookshelf top | Spa Room
  [V, V, V, V, V, V, W, W, W, W, W, W, W, W, B, B, B, B, W, W, W, W, W, V, V, V, V, V, V, V, V, V], // 7: Library Bookshelf base | Spa Room | Bathroom north wall
  [V, V, V, V, V, V, W, F, F, F, F, F, O, W, B, B, B, B, W, B, B, B, W, V, V, V, V, V, V, V, V, V], // 8: Wood stack (12) | Spa Room (14..17) | Bathroom floor (19..21)
  [V, V, V, V, V, V, W, O, F, F, F, F, O, W, B, B, B, B, W, O, B, O, W, V, V, V, V, V, V, V, V, V], // 9: Library couch (7) | Wood stack (12) | Spa Room | Sink (19) | Toilet (21)
  [V, V, V, V, V, V, W, O, F, F, F, F, F, W, B, B, B, B, W, O, B, B, W, V, V, V, V, V, V, V, V, V], // 10: Library couch (7) | Spa Room | Sink (19)
  [V, V, V, V, V, V, W, O, F, F, F, O, O, W, B, B, B, B, W, B, B, B, W, V, V, V, V, V, V, V, V, V], // 11: Library couch (7) | Fireplace (11..12) | Spa Room
  [V, V, V, V, V, V, W, F, F, F, F, O, O, W, W, B, B, W, W, W, B, W, W, V, V, V, V, V, V, V, V, V], // 12: Fireplace (11..12) | Spa Doors (15..16) | Bathroom Door (20)
  [V, V, V, V, V, V, W, F, F, F, F, F, F, F, S, S, S, S, S, S, S, S, W, V, V, V, V, V, V, V, V, V], // 13: Wood->Stone threshold (14) | Hallway
  [V, V, V, V, V, V, W, F, O, O, O, F, F, F, S, S, S, S, S, S, S, S, W, V, V, V, V, V, V, V, V, V], // 14: Living Room couch (8..10)
  [V, V, V, V, V, V, W, F, F, F, F, F, F, F, S, S, S, S, T, T, T, T, W, V, V, V, V, V, V, V, V, V], // 15: Stairs (18..21)
  [V, V, V, V, V, V, W, F, F, F, F, F, F, W, S, S, S, S, T, T, T, T, W, V, V, V, V, V, V, V, V, V], // 16: Dividing wall (13) | Stairs (18..21)
  [V, V, V, V, V, V, W, F, F, F, F, F, F, W, O, S, S, S, T, T, T, T, W, V, V, V, V, V, V, V, V, V], // 17: Chess table (8..9, non-collidable) | Coat hangers (14) | Stairs (18..21)
  [V, V, V, V, V, V, W, F, F, F, F, F, F, W, O, S, S, S, T, T, T, T, W, V, V, V, V, V, V, V, V, V], // 18: Coat hangers (14) | Stairs (18..21)
  [V, V, V, V, V, V, W, F, F, F, F, F, F, W, S, S, S, S, S, S, S, S, W, V, V, V, V, V, V, V, V, V], // 19: Window NPC at col 11, row 18.5
  [V, V, V, V, V, V, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, V, V, V, V, V, V, V, V, V], // 20: Big south windows (7..9, 10..12) | Front Door (15..16)
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 21
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 22
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 23
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 24
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 25
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 26
  [V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V], // 27
];

export const BASEMENT_MAP: TileMap = {
  cols: MAP_COLS,
  rows: MAP_ROWS,
  tileSize: TILE_SIZE,
  tiles: BASEMENT_TILES,
};

/** Spawn next to "the fireplace" inside "the library" when arriving via the chimney. */
export const BASEMENT_FIREPLACE_SPAWN = {
  x: 9.5 * TILE_SIZE,
  y: 11 * TILE_SIZE + 2,
  facing: 'down' as Direction,
};

/** Spawn on the stairs when returning to `level-basement` after having used the stairs. */
export const BASEMENT_STAIRS_SPAWN = {
  x: 18.5 * TILE_SIZE,
  y: 16 * TILE_SIZE + 2,
  facing: 'left' as Direction,
};

/** Character standing by the extra big south windows in the basement living room, looking out (Arjan). */
export const BASEMENT_WINDOW_NPC: Rect & { facing: Direction } = {
  x: 11 * TILE_SIZE + 2,
  y: 18.5 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'down',
};

/** Character standing one tile south of the chess board looking north (Olexa). */
export const BASEMENT_OLEXA_NPC: Rect & { facing: Direction } = {
  x: 8.5 * TILE_SIZE + 2,
  y: 18 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'up',
};

/** Person sitting on the toilet in the basement bathroom (facing west). */
export const BASEMENT_TOILET_NPC: Rect & { facing: Direction } = {
  x: 21 * TILE_SIZE + 2,
  y: 9 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'left',
};

/** Locked door on the north wall of the basement hallway (straight north of front door). */
export const BASEMENT_HALL_NORTH_DOOR_BOUNDS: Rect = {
  x: 15 * TILE_SIZE,
  y: 12 * TILE_SIZE,
  width: 2 * TILE_SIZE,
  height: TILE_SIZE,
};

/** Locked front door on the south wall of the basement hallway (straight south of north door). */
export const BASEMENT_FRONT_DOOR_BOUNDS: Rect = {
  x: 15 * TILE_SIZE,
  y: 20 * TILE_SIZE,
  width: 2 * TILE_SIZE,
  height: TILE_SIZE,
};

/** Collidable door to the basement bathroom (north of the stairs, deleted when opened). */
export const BASEMENT_BATHROOM_DOOR_BOUNDS: Rect = {
  x: 20 * TILE_SIZE,
  y: 12 * TILE_SIZE,
  width: TILE_SIZE,
  height: TILE_SIZE,
};

/** Black fog-of-war mask hiding the entire basement bathroom until its door is opened. */
export const BASEMENT_BATHROOM_HIDDEN_MASK: Rect = {
  x: 18 * TILE_SIZE,
  y: 7 * TILE_SIZE,
  width: 5 * TILE_SIZE,
  height: 5 * TILE_SIZE,
};

/** Expanded Spa Room interior bounds (cols 14..17, rows 5..11 = 28 tiles, +75% larger) behind the Spa Doors. */
export const BASEMENT_SPA_ROOM_BOUNDS: Rect = {
  x: 14 * TILE_SIZE,
  y: 5 * TILE_SIZE,
  width: 4 * TILE_SIZE,
  height: 7 * TILE_SIZE,
};

/** Single bathtub filled with water at the north end of the Spa Room. */
export const BASEMENT_SPA_TUB_BOUNDS: Rect = {
  x: 14 * TILE_SIZE + 6,
  y: 5 * TILE_SIZE + 2,
  width: 4 * TILE_SIZE - 12,
  height: 22,
};

/** Black fog-of-war mask hiding the Spa Room until the mine breaks open the Spa Doors. */
export const BASEMENT_SPA_HIDDEN_MASK: Rect = {
  x: 14 * TILE_SIZE,
  y: 4 * TILE_SIZE,
  width: 4 * TILE_SIZE,
  height: 8 * TILE_SIZE,
};

/** Landmine 1 tile south of the Spa Doors (cols 15..16, row 13). */
export const BASEMENT_MINE_BOUNDS: Rect = {
  x: 15 * TILE_SIZE + 11,
  y: 13 * TILE_SIZE + 3,
  width: 10,
  height: 10,
};

export const BASEMENT_MINE_FUSE_SECONDS = 3.0;

/** Flamethrower pickup resting inside the Spa Room (slot 4). */
export const BASEMENT_FLAMETHROWER_BOUNDS: Rect = {
  x: 15 * TILE_SIZE + 8,
  y: 9 * TILE_SIZE + 4,
  width: 16,
  height: 10,
};

/** Burnable stack of wood blocking the west side of the basement stairs (col 18, rows 15..18). */
export const BASEMENT_STAIRS_WOOD_BOUNDS: Rect = {
  x: 18 * TILE_SIZE,
  y: 15 * TILE_SIZE,
  width: TILE_SIZE,
  height: 4 * TILE_SIZE,
};

/** Burnable wood stacks blocking the north and south sides around the basement stairs. */
export const BASEMENT_STAIRS_WOOD_NORTH_BOUNDS: Rect = {
  x: 18 * TILE_SIZE,
  y: 14 * TILE_SIZE,
  width: 4 * TILE_SIZE,
  height: TILE_SIZE,
};

export const BASEMENT_STAIRS_WOOD_SOUTH_BOUNDS: Rect = {
  x: 18 * TILE_SIZE,
  y: 19 * TILE_SIZE,
  width: 4 * TILE_SIZE,
  height: TILE_SIZE,
};

export const BASEMENT_STAIRS_WOOD_OBSTACLES: readonly Rect[] = [
  BASEMENT_STAIRS_WOOD_BOUNDS,
  BASEMENT_STAIRS_WOOD_NORTH_BOUNDS,
  BASEMENT_STAIRS_WOOD_SOUTH_BOUNDS,
];

export const STAIRS_WOOD_BURN_DURATION = 1.0;

/** Invisible collision box halfway up the stairs that offers "Walk upstairs". */
export const BASEMENT_STAIRS_TRIGGER_BOUNDS: Rect = {
  x: 20 * TILE_SIZE,
  y: 15 * TILE_SIZE,
  width: 2 * TILE_SIZE,
  height: 4 * TILE_SIZE,
};

export const USED_STAIRS_STATE_KEY = 'usedStairs';
export const TOILET_EVENT_TRIGGERED_KEY = 'basementToiletEventTriggered';
export const BASEMENT_CHIMNEY_INTRO_STATE_KEY = 'basementChimneyIntroTriggered';

export interface ToiletCutsceneState {
  active: boolean;
  timer: number;
}

export class LevelBasement implements GameLevel {
  public readonly id: LevelId = 'level-basement';
  public readonly map: TileMap = BASEMENT_MAP;
  public doors: CollidableDoor[];
  public openedDoors: OpenedDoorAnimation[] = [];
  public spaDoorClosed: boolean = true;
  public mineState: 'idle' | 'blinking' | 'exploded' = 'idle';
  public mineTimer: number = 0;
  public mineExplosionTimer: number = 0;
  public flamethrowerPickedUp: boolean = false;
  public stairsWoodBurned: boolean = false;
  public stairsWoodBurnTimer: number = 0;
  public readonly windowNpc = { ...BASEMENT_WINDOW_NPC };
  public readonly olexaNpc = { ...BASEMENT_OLEXA_NPC };
  public readonly toiletNpc = { ...BASEMENT_TOILET_NPC };
  public toiletCutscene: ToiletCutsceneState | null = null;
  public coneOfSight: ConeOfSight;
  public olexaConeOfSight: ConeOfSight;
  public npcSightAngle: number = -Math.PI / 2; // North is -90 degrees in screen Y coordinates
  public npcSightTimer: number = 0;
  public intruderDetected: boolean = false;

  constructor() {
    this.doors = [
      {
        id: 'basement-bathroom-door',
        bounds: { ...BASEMENT_BATHROOM_DOOR_BOUNDS },
        hiddenRegions: [],
      },
    ];
    this.coneOfSight = new ConeOfSight(
      { x: this.windowNpc.x + TILE_SIZE / 2, y: this.windowNpc.y + TILE_SIZE / 2 },
      this.npcSightAngle,
      undefined,
      this.map
    );
    this.olexaConeOfSight = new ConeOfSight(
      { x: this.olexaNpc.x + TILE_SIZE / 2, y: this.olexaNpc.y + TILE_SIZE / 2 },
      -Math.PI / 2, // Looking north
      undefined,
      this.map
    );
  }

  public enter(player: Player): void {
    const hasUsedStairs = Boolean(player.states.get(USED_STAIRS_STATE_KEY));
    if (hasUsedStairs) {
      player.x = BASEMENT_STAIRS_SPAWN.x;
      player.y = BASEMENT_STAIRS_SPAWN.y;
      player.facing = BASEMENT_STAIRS_SPAWN.facing;
    } else {
      player.x = BASEMENT_FIREPLACE_SPAWN.x;
      player.y = BASEMENT_FIREPLACE_SPAWN.y;
      player.facing = BASEMENT_FIREPLACE_SPAWN.facing;
    }
    const spawnYaw =
      player.facing === 'up'
        ? -Math.PI / 2
        : player.facing === 'down'
          ? Math.PI / 2
          : player.facing === 'left'
            ? Math.PI
            : 0;
    player.yaw = spawnYaw;
    player.renderYaw = spawnYaw;
    player.jumpOffset = 0;
    player.jumpVelocity = 0;
    player.isMoving = false;
    player.walkTimer = 0;

    // Preserve openedDoors only if already opened; reset if bathroom door is still closed
    if (this.doors.some((d) => d.id === 'basement-bathroom-door')) {
      this.openedDoors = [];
    }

    // Reset NPC sight to looking north
    this.npcSightAngle = -Math.PI / 2;
    this.npcSightTimer = 0;
    this.intruderDetected = false;
    this.coneOfSight = new ConeOfSight(
      { x: this.windowNpc.x + TILE_SIZE / 2, y: this.windowNpc.y + TILE_SIZE / 2 },
      this.npcSightAngle,
      undefined,
      this.map
    );
    this.olexaConeOfSight = new ConeOfSight(
      { x: this.olexaNpc.x + TILE_SIZE / 2, y: this.olexaNpc.y + TILE_SIZE / 2 },
      -Math.PI / 2,
      undefined,
      this.map
    );
  }

  public getSolidObstacles(): readonly Rect[] {
    const obs: Rect[] = [
      this.windowNpc,
      this.olexaNpc,
      BASEMENT_SPA_TUB_BOUNDS,
      BASEMENT_STAIRS_TRIGGER_BOUNDS,
      ...this.doors.map((d) => d.bounds),
    ];
    if (this.spaDoorClosed) {
      obs.push(BASEMENT_HALL_NORTH_DOOR_BOUNDS);
    }
    if (!this.stairsWoodBurned) {
      obs.push(...BASEMENT_STAIRS_WOOD_OBSTACLES);
    }
    return obs;
  }

  public getInteractables(): Interactable[] {
    const list: Interactable[] = [
      {
        id: 'basement-front-door',
        bounds: { ...BASEMENT_FRONT_DOOR_BOUNDS },
        promptText: 'Open door',
        dialogueLines: ["It's locked."],
      },
    ];

    if (this.spaDoorClosed) {
      list.push({
        id: 'basement-hall-north-door',
        bounds: { ...BASEMENT_HALL_NORTH_DOOR_BOUNDS },
        promptText: 'Open door',
        dialogueLines: ["It's locked."],
      });
    }

    if (!this.spaDoorClosed && !this.flamethrowerPickedUp) {
      list.push({
        id: 'basement-flamethrower',
        bounds: { ...BASEMENT_FLAMETHROWER_BOUNDS },
        promptText: 'Pick up flamethrower',
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

  public updateHazardsAndItems(dtSeconds: number, player: Player): void {
    if (this.mineState === 'idle' && rectsIntersect(player, BASEMENT_MINE_BOUNDS)) {
      this.mineState = 'blinking';
      this.mineTimer = BASEMENT_MINE_FUSE_SECONDS;
    } else if (this.mineState === 'blinking') {
      this.mineTimer = Math.max(0, this.mineTimer - dtSeconds);
      if (this.mineTimer <= 0) {
        this.mineState = 'exploded';
        this.mineExplosionTimer = 0.65;
        this.spaDoorClosed = false;
      }
    }

    if (this.mineExplosionTimer > 0) {
      this.mineExplosionTimer = Math.max(0, this.mineExplosionTimer - dtSeconds);
    }

    if (
      !this.spaDoorClosed &&
      !this.flamethrowerPickedUp &&
      rectsIntersect(player, BASEMENT_FLAMETHROWER_BOUNDS)
    ) {
      this.flamethrowerPickedUp = true;
      player.unlockedFlamethrower = true;
      selectPlayerEquipmentSlot(player, 4);
    }

    if (this.stairsWoodBurnTimer > 0) {
      this.stairsWoodBurnTimer = Math.max(0, this.stairsWoodBurnTimer - dtSeconds);
      if (this.stairsWoodBurnTimer <= 0) {
        this.stairsWoodBurned = true;
      }
    }
  }

  public handleInteraction(
    interactableId: string,
    player: Player,
    ctx: LevelTransitionContext
  ): boolean {
    if (interactableId === 'basement-flamethrower') {
      this.flamethrowerPickedUp = true;
      player.unlockedFlamethrower = true;
      selectPlayerEquipmentSlot(player, 4);
      return true;
    }

    const doorIdx = this.doors.findIndex((d) => d.id === interactableId);
    if (doorIdx !== -1) {
      const openedDoor = this.doors[doorIdx];
      this.doors.splice(doorIdx, 1);
      this.openedDoors.push({
        id: openedDoor.id,
        bounds: { ...openedDoor.bounds },
        progress: 0,
        swingDirection: player.y >= openedDoor.bounds.y ? -1 : 1,
      });
      if (openedDoor.id === 'basement-bathroom-door') {
        this.startToiletCutscene(player);
      }
      return true;
    }

    if (interactableId === 'basement-stairs-up') {
      player.states.set(USED_STAIRS_STATE_KEY, true);
      ctx.loadLevel('level-upstairs');
      if (!player.states.get(UPSTAIRS_INTRO_STATE_KEY)) {
        player.states.set(UPSTAIRS_INTRO_STATE_KEY, true);
        ctx.openDialogue([
          'Hmm... so I believe the Christmas tree is to the left, but I must not be seen!',
        ]);
      }
      return true;
    }

    return false;
  }

  public startToiletCutscene(player: Player): void {
    if (player.states.get(TOILET_EVENT_TRIGGERED_KEY)) {
      return;
    }
    this.toiletCutscene = {
      active: true,
      timer: 0,
    };
  }

  public updateNpcSight(
    dtSeconds: number,
    player: Player,
    ctx: LevelTransitionContext
  ): void {
    if (this.intruderDetected) {
      return;
    }

    this.npcSightTimer += dtSeconds;
    if (this.npcSightTimer >= 2.0) {
      this.npcSightTimer -= 2.0;
      // Spawn new cone of sight that is +45 degrees from where the NPC was looking previously
      this.npcSightAngle += Math.PI / 4;
      this.coneOfSight = new ConeOfSight(
        { x: this.windowNpc.x + TILE_SIZE / 2, y: this.windowNpc.y + TILE_SIZE / 2 },
        this.npcSightAngle,
        undefined,
        this.map
      );
    }

    // Check if player is detected in Arjan's cone of sight
    const detectedArjan = this.coneOfSight.checkDetection(player);
    if (detectedArjan) {
      this.intruderDetected = true;
      player.isMoving = false;
      ctx.openDialogue(
        ["You're not supposed to be here! Check-mate."],
        () => {
          // Player takes damage: reload current level, make Santa blink
          ctx.loadLevel('level-basement');
          player.blinkTimer = 2.0; // HIT_BLINK_DURATION_SECONDS
          ctx.damagePlayer?.(30);
        },
        'Arjan'
      );
      return;
    }

    // Check if player is detected in Olexa's cone of sight
    const detectedOlexa = this.olexaConeOfSight.checkDetection(player);
    if (detectedOlexa) {
      this.intruderDetected = true;
      player.isMoving = false;
      ctx.openDialogue(
        ['Nobody believed me when I said you were real...'],
        () => {
          // Player takes damage: reload current level, make Santa blink
          ctx.loadLevel('level-basement');
          player.blinkTimer = 2.0; // HIT_BLINK_DURATION_SECONDS
          ctx.damagePlayer?.(30);
        },
        'Olexa'
      );
      return;
    }
  }

  public updateCutscene(
    dtSeconds: number,
    player: Player,
    ctx: LevelTransitionContext
  ): boolean {
    if (!this.toiletCutscene?.active) {
      return false;
    }

    player.isMoving = false;
    player.walkTimer = 0;
    this.toiletCutscene.timer += dtSeconds;

    if (this.toiletCutscene.timer >= 2.0) {
      this.toiletCutscene.active = false;
      this.toiletCutscene = null;
      player.states.set(TOILET_EVENT_TRIGGERED_KEY, true);
      ctx.openDialogue(
        [
          "What are you doing here?? I know you see me when I'm sleeping but this is not okay.",
        ],
        () => {
          // Player takes damage: reload current level, make Santa blink
          ctx.loadLevel('level-basement');
          player.blinkTimer = 2.0; // HIT_BLINK_DURATION_SECONDS
          ctx.damagePlayer?.(30);
        },
        'Hanneloes'
      );
    }

    return true;
  }
}
