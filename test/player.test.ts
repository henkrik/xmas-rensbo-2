import { describe, expect, it } from 'vitest';
import {
  applyCatDamage,
  CAT_ARMOR_DAMAGE_MULTIPLIER,
  CAT_LATCH_DAMAGE_PER_SECOND,
  CAT_LATCH_DURATION_SECONDS,
  CAT_RETRIGGER_FLEE_DISTANCE,
  CAT_START_X,
  CAT_START_Y,
  createCat,
  EXTRA_ROOM_BOUNDS,
  isCatBillboardVisible,
  MAX_CAT_HEALTH,
  updateCat,
} from '../src/entities/cat';
import { debugConsole, debugLog } from '../src/core/debugConsole';
import { soundManager } from '../src/core/audio';
import { SecretSantaDB, initSecretSantaDB } from '../src/core/secretSantaDB';
import {
  applyKeyEvent,
  computeViewportLayout,
  createEmptyInput,
  createVirtualJoystick,
} from '../src/core/input';
import {
  DOG_AGGRO_DISTANCE,
  DOG_DEAGGRO_DISTANCE,
  DOG_START_X,
  DOG_START_Y,
  updateDog,
} from '../src/entities/dog';
import {
  ARMOR_MAX_PLAYER_HEALTH,
  createPlayer,
  cyclePlayerEquipmentSlot,
  FLAMETHROWER_MAX_DISTANCE,
  FLAMETHROWER_PROJECTILE_SPEED,
  FOOTPRINT_DURATION_SECONDS,
  MAX_PLAYER_HEALTH,
  MAX_UZI_AMMO,
  PLAYER_DAMAGE_MULTIPLIER,
  PLAYER_JUMP_HEIGHT,
  PLAYER_UZI_RELOAD_SECONDS,
  PUNCH_DURATION_SECONDS,
  selectPlayerEquipmentSlot,
  setPlayerHealth,
  triggerPlayerJump,
  updatePlayer,
  UZI_EQUIP_DURATION_SECONDS,
  UZI_PROJECTILE_SPEED,
} from '../src/entities/player';
import { ConeOfSight, LineOfSight } from '../src/entities/sight';
import { HIT_BLINK_DURATION_SECONDS } from '../src/entities/snowball';
import { findNearbyInteractable } from '../src/world/interaction';
import { drawPixelText, measurePixelText } from '../src/rendering/pixelFont';
import {
  drawEquippedItemHud,
  drawHealthBar,
  shouldShowEquipmentHud,
  shouldShowHealthBar,
  wrapTextLines,
} from '../src/rendering/renderer';
import {
  computeUnobstructedCameraDistance,
  createCamera3D,
  getMainHouseRoofElevation,
  getPlayerElevation,
  getTerrainHeight,
  getTerrainNormal,
  INDOOR_WALL_HEIGHT,
  projectWorldToScreen,
  updateCamera3D,
} from '../src/rendering/math3d';
import {
  buildDynamicSceneMeshes,
  extractOutlineMesh,
  FLOATS_PER_VERTEX,
  getStaticLevelMesh,
} from '../src/rendering/models3d';
import { WebGL3DRenderer } from '../src/rendering/webglRenderer';
import {
  ATLAS_HEIGHT,
  ATLAS_WIDTH,
  getProceduralTextureAtlas,
} from '../src/rendering/textures3d';
import {
  BLOOD_POOL_DURATION_SECONDS,
  BULLET_HOLE_DURATION_SECONDS,
  createGameState,
  damagePlayer,
  loadLevel,
  parseLevelQueryParam,
  refreshInteractables,
  resetAfterSnowballHit,
  updateGameState,
} from '../src/world/gameState';
import {
  BASEMENT_BATHROOM_DOOR_BOUNDS,
  BASEMENT_FIREPLACE_SPAWN,
  BASEMENT_FLAMETHROWER_BOUNDS,
  BASEMENT_FRONT_DOOR_BOUNDS,
  BASEMENT_HALL_NORTH_DOOR_BOUNDS,
  BASEMENT_MINE_BOUNDS,
  BASEMENT_MINE_EXPLOSION_DAMAGE,
  BASEMENT_MINE_FUSE_SECONDS,
  BASEMENT_SPA_ROOM_BOUNDS,
  BASEMENT_SPA_TUB_BOUNDS,
  BASEMENT_STAIRS_SIDE_NORTH_BOUNDS,
  BASEMENT_STAIRS_SPAWN,
  BASEMENT_STAIRS_TRIGGER_BOUNDS,
  BASEMENT_STAIRS_WOOD_BOUNDS,
  BASEMENT_STAIRS_WOOD_NORTH_BOUNDS,
  BASEMENT_STAIRS_WOOD_OBSTACLES,
  BASEMENT_STAIRS_WOOD_SOUTH_BOUNDS,
  LevelBasement,
  USED_STAIRS_STATE_KEY,
} from '../src/world/levels/levelBasement';
import {
  ANNE_MARIE_HOSTILE_DIALOGUE_KEY,
  ANNE_MARIE_HOSTILE_DIALOGUE_LINES,
  ANNE_MARIE_MAX_HEALTH,
  BODY_ARMOR_TAKEN_KEY,
  C4_PLACED_STATE_KEY,
  C4_TAKEN_STATE_KEY,
  DIANA_PRESENT_TAKEN_KEY,
  KITCHEN_ROSANNA_STATE_KEY,
  KITCHEN_TRIGGER_BOUNDS,
  LevelUpstairs,
  SIMON_PRESENT_TAKEN_KEY,
  TABLE_ROOM_AMBUSH_STATE_KEY,
  TABLE_ROOM_AMBUSH_TRIGGER_BOUNDS,
  UPSTAIRS_ALBIN_START_Y,
  UPSTAIRS_BEDROOM_DOOR_BOUNDS,
  UPSTAIRS_BEDROOM_HIDDEN_MASK,
  UPSTAIRS_BODY_ARMOR_BOUNDS,
  UPSTAIRS_C4_BOUNDS,
  UPSTAIRS_COMPUTER_BOUNDS,
  UPSTAIRS_CUPBOARD_BOUNDS,
  UPSTAIRS_DIANA_PRESENT_BOUNDS,
  UPSTAIRS_KITCHEN_MEDKIT_POS,
  UPSTAIRS_OFFICE_DOOR_BOUNDS,
  UPSTAIRS_OFFICE_HIDDEN_MASK,
  UPSTAIRS_SHOWER_DOOR_BOUNDS,
  UPSTAIRS_SIMON_PRESENT_BOUNDS,
  UPSTAIRS_STAIRS_SPAWN,
  UPSTAIRS_STAIRS_TRIGGER_BOUNDS,
  UPSTAIRS_TABLE_ROOM_DOOR_BOUNDS,
  UPSTAIRS_TABLE_ROOM_HIDDEN_MASKS,
} from '../src/world/levels/levelUpstairs';
import {
  LevelPeople,
  PEOPLE_NAMES,
  PEOPLE_PLAYER_SPAWN,
} from '../src/world/levels/levelPeople';
import {
  CLIMB_DURATION_SECONDS,
  DAMAGED_WIRE_HAZARD,
  ELECTROCUTION_DURATION_SECONDS,
  GROUND_LADDER_BOUNDS,
  HOUSE_DOOR_COL,
  HOUSE_DOOR_ROW,
  HOUSE_WEST_LADDER_SPOT,
  isRectCollidingWithMap,
  LADDER_BOTTOM_Y,
  MAIN_HOUSE_ROOF_BOUNDS,
  MAP_COLS,
  MAP_ROWS,
  MOTORCYCLE_CRASH_X,
  MOTORCYCLE_START_X,
  MOTORCYCLE_START_Y,
  PLAYER_START_X,
  PLAYER_START_Y,
  ROOF_CHIMNEY_BOUNDS,
  ROOF_LADDER_BOUNDS,
  ROOF_RUDOLPH_BOUNDS,
  ROOF_WALK_Y,
  STARTER_MAP,
  TILE_SIZE,
  TileType,
} from '../src/world/tilemap';
import {
  isNpcBillboardVisible,
  MAX_NPC_HEALTH,
  NPC_HOSTILE_LOSE_SIGHT_SECONDS,
  NPC_UZI_BULLET_DAMAGE,
  NPC_UZI_MAGAZINE_SIZE,
  NPC_UZI_RELOAD_SECONDS,
  PLAYER_FIREBALL_NPC_DAMAGE,
  PLAYER_KATANA_NPC_DAMAGE,
  PLAYER_PUNCH_NPC_DAMAGE,
  PLAYER_UZI_NPC_DAMAGE,
} from '../src/entities/npcCombat';
import { AStarPathfinder } from '../src/world/pathfinding';
import {
  OUTSIDE_ALEX_NPC,
  RUDOLPH_INSPECTED_KEY,
} from '../src/world/levels/levelOutside';

function advanceDialogue(state: ReturnType<typeof createGameState>, input: ReturnType<typeof createEmptyInput>): void {
  if (state.activeDialogue) {
    updateGameState(state, input, 0.55);
  }
  input.action = false;
  applyKeyEvent(input, 'Space', true);
  updateGameState(state, input, 0.02);
  applyKeyEvent(input, 'Space', false);
}

describe('Player walking & 2x Rensbo map layout', () => {
  it('uses a 32x28 map (2x width and height) with a large 13x7 main house and parked black motorcycle', () => {
    expect(MAP_COLS).toBe(32);
    expect(MAP_ROWS).toBe(28);
    expect(STARTER_MAP.tiles.length).toBe(28);
    expect(STARTER_MAP.tiles[0].length).toBe(32);

    // Verify the main house spans cols 4..16 (13 tiles wide) and rows 3..9 (7 tiles tall)
    expect(STARTER_MAP.tiles[3][4]).toBe(TileType.RoofDark);
    expect(STARTER_MAP.tiles[3][16]).toBe(TileType.RoofDark);
    expect(STARTER_MAP.tiles[HOUSE_DOOR_ROW][HOUSE_DOOR_COL]).toBe(
      TileType.HouseDoor
    );

    // Verify the black motorcycle is parked on the right side of the electric car, outside the red-door shed
    expect(STARTER_MAP.tiles[21][25]).toBe(TileType.Motorcycle);
    expect(STARTER_MAP.tiles[21][26]).toBe(TileType.Motorcycle);
  });

  it('moves the player in all four directions using arrow keys', () => {
    const player = createPlayer(PLAYER_START_X, PLAYER_START_Y);
    const input = createEmptyInput();

    // Walk up the gravel road
    const startY = player.y;
    applyKeyEvent(input, 'ArrowUp', true);
    updatePlayer(player, input, 0.2, STARTER_MAP);
    expect(player.y).toBeLessThan(startY);
    expect(player.facing).toBe('up');
    expect(player.isMoving).toBe(true);
    applyKeyEvent(input, 'ArrowUp', false);

    // Walk right
    const startX = player.x;
    applyKeyEvent(input, 'ArrowRight', true);
    updatePlayer(player, input, 0.2, STARTER_MAP);
    expect(player.x).toBeGreaterThan(startX);
    expect(player.facing).toBe('right');
    applyKeyEvent(input, 'ArrowRight', false);

    // Stop moving when keys are released
    updatePlayer(player, input, 0.2, STARTER_MAP);
    expect(player.isMoving).toBe(false);
  });

  it('leaves footprints on snow tiles (but not road tiles) that fade after 3 seconds', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Walk up on the gravel road (TileType.Road) -> no footprints should be left
    input.up = true;
    updateGameState(state, input, 0.2);
    expect(state.footprints.length).toBe(0);

    // Move Santa onto the snow lawn on the left (col 10, row 16 -> TileType.Snow) and walk
    state.player.x = 10 * TILE_SIZE;
    state.player.y = 16 * TILE_SIZE;
    updateGameState(state, input, 0.2);
    expect(state.footprints.length).toBeGreaterThan(0);
    expect(state.footprints[0].maxAge).toBe(FOOTPRINT_DURATION_SECONDS);

    // Stop walking and advance just under 3 seconds -> footprint is still visible (fading)
    input.up = false;
    updateGameState(state, input, 2.5);
    expect(state.footprints.length).toBeGreaterThan(0);

    // Advance past 3.0 seconds total -> footprints completely fade out and are removed
    updateGameState(state, input, 0.6);
    expect(state.footprints.length).toBe(0);
  });

  it('allows walking straight up the driveway to the main house when not hit by a snowball', () => {
    const player = createPlayer(13 * TILE_SIZE + 2, PLAYER_START_Y);
    const input = createEmptyInput();
    input.up = true;

    // Walk straight up for 4 seconds to reach the main house door at row 9
    for (let i = 0; i < 80; i++) {
      updatePlayer(player, input, 0.05, STARTER_MAP);
    }

    // Player should stop at row 10 right in front of the house door (row 9, col 13)
    const finalRow = Math.floor(player.y / TILE_SIZE);
    expect(finalRow).toBe(10);
  });

  it('resets the map and makes Santa blink when hit by a snowball on the driveway', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Place Santa directly in the snowball throwers' line of fire on the driveway (row 16, col 15)
    state.player.x = 15 * TILE_SIZE;
    state.player.y = 16 * TILE_SIZE + 2;

    // Advance time in small steps until a thrown snowball crosses the driveway and hits Santa
    for (let i = 0; i < 40; i++) {
      updateGameState(state, input, 0.05);
      if (state.player.blinkTimer > 0) {
        break;
      }
    }

    // Santa should be reset to the starting position at the bottom of the road and blinking
    expect(state.player.x).toBe(PLAYER_START_X);
    expect(state.player.y).toBe(PLAYER_START_Y);
    expect(state.player.blinkTimer).toBe(HIT_BLINK_DURATION_SECONDS);
    expect(state.snowballs.length).toBe(0);
  });

  it('plays a 1.25-second electrocution animation before resetting the map and making Santa blink when stepping on the sparking EV charging wire', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Verify the electric car is parked on the driveway at cols 17..19, rows 21..22
    expect(STARTER_MAP.tiles[21][17]).toBe(TileType.ElectricCar);
    expect(STARTER_MAP.tiles[22][19]).toBe(TileType.ElectricCar);

    // Position Santa just below the damaged sparking section of the charging wire and walk up into it
    state.player.x = DAMAGED_WIRE_HAZARD.x;
    state.player.y = DAMAGED_WIRE_HAZARD.y + DAMAGED_WIRE_HAZARD.height + 2;
    input.up = true;

    updateGameState(state, input, 0.1);

    // Santa should enter the 1.25-second electrocution animation right at the wire before the map resets
    expect(state.electrocutionTimer).toBe(ELECTROCUTION_DURATION_SECONDS);
    expect(state.player.y).not.toBe(PLAYER_START_Y);

    // Partway through the 1.25-second electrocution animation, Santa is still being zapped at the wire
    updateGameState(state, input, 0.6);
    expect(state.electrocutionTimer).toBeCloseTo(0.65, 5);
    expect(state.player.y).not.toBe(PLAYER_START_Y);

    // Once the full 1.25 seconds complete, the map resets and Santa spawns at the start blinking
    updateGameState(state, input, 0.65);
    expect(state.electrocutionTimer).toBe(0);
    expect(state.player.x).toBe(PLAYER_START_X);
    expect(state.player.y).toBe(PLAYER_START_Y);
    expect(state.player.blinkTimer).toBe(HIT_BLINK_DURATION_SECONDS);
  });

  it('has a dog on the east snow field that waits, chases with red hearts when close, can be dodged or blocked, and resets Santa if caught', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Dog starts in waiting mode on the east snow field between the guest cottages and red-door shed
    expect(state.dog.x).toBe(DOG_START_X);
    expect(state.dog.y).toBe(DOG_START_Y);
    expect(state.dog.mode).toBe('waiting');
    expect(state.dog.hearts.length).toBe(0);

    // Move Santa within aggro distance on the east snow field
    state.player.x = DOG_START_X - (DOG_AGGRO_DISTANCE - 16);
    state.player.y = DOG_START_Y;
    updateGameState(state, input, 0.1);

    expect(state.dog.mode).toBe('chasing');
    expect(state.dog.hearts.length).toBeGreaterThan(0);
    // Gradual acceleration: after 0.1s the dog is moving toward Santa but hasn't hit maxSpeed yet
    expect(state.dog.vx).toBeLessThan(0);
    expect(Math.abs(state.dog.vx)).toBeLessThan(state.dog.maxSpeed);

    // Move Santa far away (beyond de-aggro distance) -> dog returns to waiting mode and decelerates
    state.player.x = DOG_START_X - (DOG_DEAGGRO_DISTANCE + 32);
    updateGameState(state, input, 0.1);
    expect(state.dog.mode).toBe('waiting');

    // Now place Santa close to the dog and stand still -> dog accelerates and inevitably catches Santa
    state.dog.x = DOG_START_X;
    state.dog.y = DOG_START_Y;
    state.dog.vx = 0;
    state.dog.vy = 0;
    state.player.x = DOG_START_X - 48;
    state.player.y = DOG_START_Y;

    for (let i = 0; i < 40; i++) {
      updateGameState(state, input, 0.05);
      if (state.player.blinkTimer > 0) {
        break;
      }
    }

    expect(state.player.x).toBe(PLAYER_START_X);
    expect(state.player.y).toBe(PLAYER_START_Y);
    expect(state.player.blinkTimer).toBe(HIT_BLINK_DURATION_SECONDS);
    expect(state.dog.mode).toBe('waiting');
  });

  it('supports inspecting the west house spot, picking up the ladder next to the dog, placing & climbing it to the roof, and walking east/west between ladder and chimney', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // 1. Before acquiring the ladder, the snow-free spot on the west side of the house shows "Inspect"
    state.player.x = HOUSE_WEST_LADDER_SPOT.x + 2;
    state.player.y = HOUSE_WEST_LADDER_SPOT.y + 4;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.promptText).toBe('Inspect');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue?.lines[0]).toBe(
      "Hmm.. looks like there is a chimney up there, but I can't reach it"
    );

    // Close the inspection dialogue (after 0.5s anti-skip lock)
    advanceDialogue(state, input);
    expect(state.activeDialogue).toBeNull();

    // 2. Walk over the ladder on the ground next to the dog (non-colliding) and pick it up with "Pick up"
    state.dog.x = 29 * TILE_SIZE; // keep dog slightly to the right while testing pickup
    state.player.x = GROUND_LADDER_BOUNDS.x;
    state.player.y = GROUND_LADDER_BOUNDS.y;
    input.right = true;
    updateGameState(state, input, 0.05);
    input.right = false;
    // Verify Santa moved freely over the ground ladder without collision
    expect(state.player.x).toBeGreaterThan(GROUND_LADDER_BOUNDS.x);
    expect(state.nearbyInteractable?.promptText).toBe('Pick up');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.hasLadder).toBe(true);
    expect(state.nearbyInteractable).toBeNull();

    // 3. Return to the west side of the main house -> "Place ladder"
    state.player.x = HOUSE_WEST_LADDER_SPOT.x + 2;
    state.player.y = HOUSE_WEST_LADDER_SPOT.y + 4;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.promptText).toBe('Place ladder');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.hasLadder).toBe(false);
    expect(state.ladderPlaced).toBe(true);
    expect(state.nearbyInteractable?.promptText).toBe('Climb ladder');

    // 4. Press Space to climb the ladder -> Santa climbs straight up onto the roof
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.climbing).not.toBeNull();
    expect(state.climbing?.direction).toBe('up');

    // Advance partway through the climb -> Santa ascends vertically at the base X/Y
    updateGameState(state, input, CLIMB_DURATION_SECONDS * 0.5);
    expect(state.player.y).toBe(LADDER_BOTTOM_Y);
    expect(getPlayerElevation(state)).toBeGreaterThan(
      getTerrainHeight(state.player.x, state.player.y, 'level-outside')
    );

    // Finish climbing onto the roof
    updateGameState(state, input, CLIMB_DURATION_SECONDS * 0.6);
    expect(state.climbing).toBeNull();
    expect(state.isOnRoof).toBe(true);
    expect(state.player.y).toBe(ROOF_WALK_Y);
    expect(state.nearbyInteractable?.promptText).toBe('Climb down ladder');

    // 5. On the roof, Santa can walk freely in 2D (north/south/east/west)
    input.up = true;
    updateGameState(state, input, 0.2);
    input.up = false;
    expect(state.player.y).toBeLessThan(ROOF_WALK_Y);

    // 6. Walk north and east across the roof to the chimney -> "Climb down chimney"
    input.up = true;
    for (let i = 0; i < 18; i++) {
      updateGameState(state, input, 0.05);
    }
    input.up = false;
    input.right = true;
    for (let i = 0; i < 13; i++) {
      updateGameState(state, input, 0.05);
    }
    input.right = false;
    expect(state.isOnRoof).toBe(true);
    expect(state.nearbyInteractable?.promptText).toBe('Climb down chimney');

    // 7. Walk west and south back to the ladder and climb down first
    input.left = true;
    for (let i = 0; i < 13; i++) {
      updateGameState(state, input, 0.05);
    }
    input.left = false;
    input.down = true;
    for (let i = 0; i < 22; i++) {
      updateGameState(state, input, 0.05);
    }
    input.down = false;
    expect(state.isOnRoof).toBe(true);
    expect(state.nearbyInteractable?.promptText).toBe('Climb down ladder');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.climbing?.direction).toBe('down');

    updateGameState(state, input, CLIMB_DURATION_SECONDS + 0.05);
    expect(state.climbing).toBeNull();
    expect(state.isOnRoof).toBe(false);
    expect(state.player.y).toBe(LADDER_BOTTOM_Y);

    // 8. Climb back up to the roof, walk to the chimney, and press Space to enter level-basement!
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    updateGameState(state, input, CLIMB_DURATION_SECONDS + 0.05);
    expect(state.isOnRoof).toBe(true);

    input.up = true;
    for (let i = 0; i < 22; i++) {
      updateGameState(state, input, 0.05);
    }
    input.up = false;
    input.right = true;
    for (let i = 0; i < 13; i++) {
      updateGameState(state, input, 0.05);
    }
    input.right = false;
    expect(state.nearbyInteractable?.promptText).toBe('Climb down chimney');

    // Before inspecting Rudolph, trying to climb down the chimney only smells blood
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.currentLevelId).toBe('level-outside');
    expect(state.activeDialogue?.lines).toEqual([
      'You smell the stench of blood...',
    ]);
    advanceDialogue(state, input);
    expect(state.activeDialogue).toBeNull();

    // After inspecting Rudolph, the chimney enters the basement
    state.player.states.set(RUDOLPH_INSPECTED_KEY, true);
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.currentLevelId).toBe('level-basement');
    expect(state.player.x).toBe(BASEMENT_FIREPLACE_SPAWN.x);
    expect(state.player.y).toBe(BASEMENT_FIREPLACE_SPAWN.y);

    // Chimney intro dialogue (line 1 + desktop firing hint line 2)
    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.lines).toEqual([
      'You better run, Santa Claus is coming to town.',
      'Press Space to fire your weapon (hold to keep firing).',
    ]);

    // Press Space twice (after 0.5s lock each) -> Closes dialogue
    advanceDialogue(state, input);
    advanceDialogue(state, input);
    expect(state.activeDialogue).toBeNull();
  });

  it('lets Santa "Z: drive" the motorcycle east into the trees where it crashes and Santa spawns next to it blinking without resetting the map', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Suppose Santa already picked up the ladder (to verify the map state does not reset on crash!)
    state.hasLadder = true;

    // Position Santa just above the parked motorcycle (cols 25..26, row 20)
    state.player.x = MOTORCYCLE_START_X + 4;
    state.player.y = MOTORCYCLE_START_Y - state.player.height - 2;

    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.promptText).toBe('Drive');

    // Press Z to drive the motorcycle
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    expect(state.motorcycle.status).toBe('driving');

    // Advance partway -> motorcycle and Santa drive east
    updateGameState(state, input, 0.15);
    expect(state.motorcycle.x).toBeGreaterThan(MOTORCYCLE_START_X);
    expect(state.motorcycle.x).toBeLessThan(MOTORCYCLE_CRASH_X);

    // Advance until it hits the eastern trees and crashes
    for (let i = 0; i < 20; i++) {
      updateGameState(state, input, 0.05);
      if (state.motorcycle.status === 'crashed') {
        break;
      }
    }

    expect(state.motorcycle.status).toBe('crashed');
    expect(state.motorcycle.x).toBe(MOTORCYCLE_CRASH_X);
    // Santa spawns next to the crashed motorcycle blinking, and the map does NOT reset
    expect(state.player.x).toBe(MOTORCYCLE_CRASH_X - state.player.width - 4);
    expect(state.player.y).toBe(MOTORCYCLE_START_Y + 2);
    expect(state.player.blinkTimer).toBe(HIT_BLINK_DURATION_SECONDS);
    expect(state.hasLadder).toBe(true);
    expect(state.nearbyInteractable).toBeNull();
  });

  it('shows "Talk to Sylvester" and "Talk to Annelotte" near the snowball throwers with portraits and dialogue', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // 1. Position Santa right below the left snowball thrower (Sylvester)
    const sylvester = state.throwers[0];
    state.player.x = sylvester.x;
    state.player.y = sylvester.y + sylvester.height + 2;

    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable).not.toBeNull();
    expect(state.nearbyInteractable?.promptText).toBe('Talk to Sylvester');
    expect(state.nearbyInteractable?.speakerPortrait).toBe('Sylvester');

    // Press Z to talk to Sylvester
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.speakerPortrait).toBe('Sylvester');
    expect(state.activeDialogue?.lines[state.activeDialogue.currentIndex]).toBe(
      'Watch out! Annelotte is crazy!'
    );

    // Press Space again after 0.5s lock to close the single-line dialogue
    advanceDialogue(state, input);

    expect(state.activeDialogue).toBeNull();

    // 2. Position Santa right below the right snowball thrower (Annelotte)
    const annelotte = state.throwers[1];
    state.player.x = annelotte.x;
    state.player.y = annelotte.y + annelotte.height + 2;

    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable).not.toBeNull();
    expect(state.nearbyInteractable?.promptText).toBe('Talk to Annelotte');
    expect(state.nearbyInteractable?.speakerPortrait).toBe('Annelotte');

    // Press Z to talk to Annelotte
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.speakerPortrait).toBe('Annelotte');
    expect(state.activeDialogue?.lines[state.activeDialogue.currentIndex]).toBe(
      "It's good to talk about your feelings... how does a snowball in your face feel?"
    );

    // Press Space again after 0.5s lock to close the dialogue
    advanceDialogue(state, input);

    expect(state.activeDialogue).toBeNull();

    // 3. Position Santa right below Alex on the southwest part of the map
    const outside = state.levels['level-outside'];
    expect(outside.alexNpc).toBeDefined();
    state.player.x = outside.alexNpc.x;
    state.player.y = outside.alexNpc.y + outside.alexNpc.height + 2;

    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable).not.toBeNull();
    expect(state.nearbyInteractable?.promptText).toBe('Talk to Alex');
    expect(state.nearbyInteractable?.speakerPortrait).toBe('Alex');

    // Press Z to talk to Alex
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.speakerPortrait).toBe('Alex');
    expect(state.activeDialogue?.lines[state.activeDialogue.currentIndex]).toBe(
      'Just practicing my swings...'
    );

    // Press Space again after 0.5s lock to close the dialogue
    advanceDialogue(state, input);

    expect(state.activeDialogue).toBeNull();
  });

  it('shows "Open door" at the main house door and advances through the two dialogue lines with Z', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Position Santa right in front of the house door (col 13, row 10, just below row 9 door)
    state.player.x = HOUSE_DOOR_COL * TILE_SIZE + 2;
    state.player.y = (HOUSE_DOOR_ROW + 1) * TILE_SIZE + 2;

    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable).not.toBeNull();
    expect(state.nearbyInteractable?.promptText).toBe('Open door');

    // Press Z to try opening the locked door
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.lines[state.activeDialogue.currentIndex]).toBe(
      "It's locked."
    );

    // Pressing Space within 0.5s of opening is ignored (anti-skip lock)
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue?.currentIndex).toBe(0);

    // Press Space after 0.5s lock -> Santa responds "There has to be another way into the house..."
    advanceDialogue(state, input);

    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.lines[state.activeDialogue.currentIndex]).toBe(
      'There has to be another way into the house...'
    );

    // Pressing Space within 0.5s of advancing to the next line is also ignored
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue?.currentIndex).toBe(1);

    // Press Space after 0.5s lock -> closes the dialogue box
    advanceDialogue(state, input);

    expect(state.activeDialogue).toBeNull();
  });

  it('clamps negative dtSeconds on cached tab refresh so elapsedTime never goes negative', () => {
    const state = createGameState();
    const input = createEmptyInput();

    updateGameState(state, input, -0.004);
    expect(state.elapsedTime).toBeGreaterThanOrEqual(0);
  });

  it('only uses Space (not Z, E, or pointer clicks) to interact and advance dialogue', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Position Santa right in front of the house door
    state.player.x = HOUSE_DOOR_COL * TILE_SIZE + 2;
    state.player.y = (HOUSE_DOOR_ROW + 1) * TILE_SIZE + 2;

    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('house-door');

    // Pointer click, KeyZ, and KeyE do NOT interact anymore
    input.pointerClick = {
      worldX: HOUSE_DOOR_COL * TILE_SIZE + 6,
      worldY: HOUSE_DOOR_ROW * TILE_SIZE + 6,
    };
    updateGameState(state, input, 0.01);
    expect(state.activeDialogue).toBeNull();

    applyKeyEvent(input, 'KeyZ', true);
    applyKeyEvent(input, 'KeyE', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'KeyZ', false);
    applyKeyEvent(input, 'KeyE', false);
    expect(state.activeDialogue).toBeNull();

    // Pressing Space opens the dialogue
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.lines[0]).toBe("It's locked.");

    // KeyZ, KeyE, and pointerClick do NOT advance active dialogue either
    input.pointerClick = { worldX: 100, worldY: 100 };
    applyKeyEvent(input, 'KeyZ', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'KeyZ', false);
    expect(state.activeDialogue?.currentIndex).toBe(0);

    // Pressing Space after 0.5s lock advances and closes dialogue
    advanceDialogue(state, input);
    expect(state.activeDialogue?.currentIndex).toBe(1);

    advanceDialogue(state, input);
    expect(state.activeDialogue).toBeNull();
  });

  it('keeps dog max speed at half-speed (37 px/s) on both keyboard and joystick mode', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Aggro dog on east snow field
    state.dog.x = DOG_START_X;
    state.dog.y = DOG_START_Y;
    state.player.x = DOG_START_X - (DOG_AGGRO_DISTANCE - 16);
    state.player.y = DOG_START_Y;

    // Normal keyboard mode
    state.joystickActive = false;
    for (let i = 0; i < 20; i++) {
      updateGameState(state, input, 0.05);
      expect(Math.abs(state.dog.vx)).toBeLessThanOrEqual(37.01);
    }
    expect(Math.abs(state.dog.vx)).toBeGreaterThan(30);

    // Reset and test in Joystick mode
    state.dog.x = DOG_START_X;
    state.dog.y = DOG_START_Y;
    state.dog.vx = 0;
    state.dog.vy = 0;
    state.player.x = DOG_START_X - (DOG_AGGRO_DISTANCE - 16);
    state.player.y = DOG_START_Y;
    state.joystickActive = true;

    for (let i = 0; i < 20; i++) {
      updateGameState(state, input, 0.05);
      expect(Math.abs(state.dog.vx)).toBeLessThanOrEqual(37.01);
    }
    expect(Math.abs(state.dog.vx)).toBeGreaterThan(30);
  });

  it('shows desktop and mobile tutorial dialogues on initial load and clears them on reset', () => {
    // Desktop initial state
    const desktopState = createGameState({ isMobile: false, showIntroDialogue: true });
    expect(desktopState.activeDialogue).not.toBeNull();
    expect(desktopState.activeDialogue?.lines[0]).toBe(
      'Use WASD to move around, the arrow keys to look around, and Space to jump and interact with things. Press Space to close this window and start playing.'
    );
    expect(desktopState.activeDialogue?.lines[1]).toBe(
      'Good luck!\nChristmas depends on you...'
    );
    expect(desktopState.activeDialogue?.currentIndex).toBe(0);

    const input = createEmptyInput();
    // Press Space after 0.5s lock to advance to line 2
    advanceDialogue(desktopState, input);
    expect(desktopState.activeDialogue?.currentIndex).toBe(1);

    // Press Space again after 0.5s lock to close dialogue
    advanceDialogue(desktopState, input);
    expect(desktopState.activeDialogue).toBeNull();

    // Mobile initial state
    const mobileState = createGameState({ isMobile: true, showIntroDialogue: true });
    expect(mobileState.activeDialogue).not.toBeNull();
    expect(mobileState.activeDialogue?.lines[0]).toBe(
      'Use the virtual joystick to move around. To interact with things, move close enough to it and an interaction button will appear. Click anywhere to close this window and start playing.'
    );
    expect(mobileState.activeDialogue?.lines[1]).toBe(
      'Good luck!\nChristmas depends on you...'
    );

    // Advance to line 2 and close with Space after 0.5s lock
    advanceDialogue(mobileState, input);
    expect(mobileState.activeDialogue?.currentIndex).toBe(1);

    advanceDialogue(mobileState, input);
    expect(mobileState.activeDialogue).toBeNull();

    // When damage reset occurs, activeDialogue must remain null (not reset to intro dialogue)
    resetAfterSnowballHit(mobileState);
    expect(mobileState.activeDialogue).toBeNull();
  });

  it('breaks dialogue lines on explicit newline characters', () => {
    const mockCtx = {
      measureText: (str: string) => ({ width: str.length * 6 }),
    } as unknown as CanvasRenderingContext2D;

    const wrapped = wrapTextLines(
      mockCtx,
      'Good luck!\nChristmas depends on you...',
      220
    );

    expect(wrapped).toEqual(['Good luck!', 'Christmas depends on you...']);
  });

  it('slides slippery against obstacles when colliding at subtle angles', () => {
    // Place Santa right next to the left wall of the main house (house starts at col 4)
    // House wall is col 4 -> x = 4 * 16 = 64. Santa width = 12.
    // Santa at x = 52, y = 140 (house door is row 9 = 144, wall at 140)
    const player = createPlayer(52, 140);
    const input = createEmptyInput();

    // Player moves mostly right into the house wall, but slightly down (e.g. angle ~11 degrees)
    // dx = 0.98, dy = 0.20
    input.moveVector = { x: 0.98, y: 0.2 };

    const initialY = player.y;
    // Update player for several frames
    for (let i = 0; i < 10; i++) {
      updatePlayer(player, input, 0.05, STARTER_MAP);
    }

    // Santa is blocked in X by the house wall (cannot move past x = 52)
    expect(player.x).toBeLessThanOrEqual(52.01);
    // Santa slid downwards in Y along the wall rather than being completely stuck!
    expect(player.y).toBeGreaterThan(initialY);
  });

  it('provides analog moveVector with [0, 1] clamped speed scaling', () => {
    const input = createEmptyInput();
    const listeners: Record<string, (e: unknown) => void> = {};
    const container = {
      getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 200 }),
      addEventListener: (evt: string, cb: (e: unknown) => void) => { listeners[evt] = cb; },
      removeEventListener: () => {},
      style: {},
    } as unknown as HTMLElement;
    const stick = { style: { transform: '' } } as unknown as HTMLElement;

    createVirtualJoystick({ container, stick, input });

    // Center is (200, 200). maxRadius is 200/2 * 0.72 = 72.

    // 1. Move halfway (dx = 36, dy = 0) -> intensity = 36 / 72 = 0.5 (50% speed)
    listeners['pointerdown']?.({
      pointerId: 1,
      clientX: 236,
      clientY: 200,
      preventDefault: () => {},
    });
    expect(input.right).toBe(true);
    expect(input.moveVector).not.toBeNull();
    expect(input.moveVector?.x).toBeCloseTo(0.5, 2);
    expect(input.moveVector?.y).toBe(0);

    // 2. Move at max border (dx = 72, dy = 0) -> intensity = 1.0 (100% speed)
    listeners['pointerdown']?.({
      pointerId: 1,
      clientX: 272,
      clientY: 200,
      preventDefault: () => {},
    });
    expect(input.moveVector?.x).toBeCloseTo(1.0, 2);

    // 3. Move FAR outside (dx = 300, dy = 0) -> intensity must stay 1.0 (100% speed), NOT slow down!
    listeners['pointerdown']?.({
      pointerId: 1,
      clientX: 500,
      clientY: 200,
      preventDefault: () => {},
    });
    expect(input.moveVector?.x).toBeCloseTo(1.0, 2);

    // 4. Subtle angle (dx = 100, dy = 10) outside circle: maintains 100% speed and subtle Y deflection
    listeners['pointerdown']?.({
      pointerId: 1,
      clientX: 300,
      clientY: 210,
      preventDefault: () => {},
    });
    expect(input.right).toBe(true);
    expect(input.down).toBe(true);
    expect(input.moveVector?.x).toBeGreaterThan(0.95);
    expect(input.moveVector?.y).toBeGreaterThan(0.05);
  });

  it('renders unaliased integer pixels with drop shadow via pixel font', () => {
    const filledRects: Array<{ x: number; y: number; w: number; h: number; color: string }> = [];
    let curColor = '';

    const mockCtx = {
      save: () => {},
      restore: () => {},
      set fillStyle(val: string) { curColor = val; },
      fillRect: (x: number, y: number, w: number, h: number) => {
        filledRects.push({ x, y, w, h, color: curColor });
      },
    } as unknown as CanvasRenderingContext2D;

    drawPixelText(mockCtx, 'Hi!', 10, 20, '#ffffff', '#000000');

    expect(filledRects.length).toBeGreaterThan(0);
    // Every pixel must be exact 1x1 integer pixels (completely unaliased)
    for (const r of filledRects) {
      expect(Number.isInteger(r.x)).toBe(true);
      expect(Number.isInteger(r.y)).toBe(true);
      expect(r.w).toBe(1);
      expect(r.h).toBe(1);
      expect(['#ffffff', '#000000']).toContain(r.color);
    }

    // Width measurement is proportional and positive
    expect(measurePixelText('Hi!')).toBeGreaterThan(0);
    expect(measurePixelText('W')).toBeGreaterThan(measurePixelText('I'));
  });

  it('recomputes layout across portrait and landscape orientations so everything fits and centers', () => {
    // 1. Mobile Portrait (390x844)
    const portrait = computeViewportLayout(390, 844);
    expect(portrait.isLandscape).toBe(false);
    expect(portrait.containerWidth).toBe(390);
    expect(portrait.containerHeight).toBe(844);
    expect(portrait.canvasWidth).toBeLessThanOrEqual(390 - 24);
    expect(portrait.canvasHeight).toBeLessThanOrEqual(844 - 24);
    // Joystick is horizontally centered and bottom-aligned in portrait
    expect(portrait.joystickSize).toBe(195);
    expect(portrait.joystickLeft).toBe(Math.round((390 - 195) / 2));
    expect(portrait.joystickTop).toBe(844 - 195);
    expect(portrait.actionBtnLeft).toBe(20);
    expect(portrait.actionBtnBottom).toBe(24);
    expect(portrait.actionBtnTop).toBeNull();

    // 2. Rotate to Mobile Landscape (844x390)
    const landscape = computeViewportLayout(844, 390);
    expect(landscape.isLandscape).toBe(true);
    expect(landscape.containerWidth).toBe(844);
    expect(landscape.containerHeight).toBe(390);
    expect(landscape.canvasWidth).toBeLessThanOrEqual(844 - 24);
    expect(landscape.canvasHeight).toBeLessThanOrEqual(390 - 24);
    // Joystick is aligned to the right of the long side and vertically centered in landscape
    expect(landscape.joystickSize).toBe(195);
    expect(landscape.joystickLeft).toBe(844 - 195);
    expect(landscape.joystickTop).toBe(Math.round((390 - 195) / 2));
    // Action button is on the left of the long side, vertically centered
    expect(landscape.actionBtnLeft).toBe(20);
    expect(landscape.actionBtnTop).toBe(Math.round(390 / 2));
    expect(landscape.actionBtnBottom).toBeNull();
    // 3. Stale browser dimensions during rotation animation (axes swapped relative to orientation)
    // Mobile rotates to landscape, but browser still reports 390x844:
    const staleLandscape = computeViewportLayout(390, 844, true);
    expect(staleLandscape.isLandscape).toBe(true);
    expect(staleLandscape.containerWidth).toBe(844);
    expect(staleLandscape.containerHeight).toBe(390);
    expect(staleLandscape.joystickLeft).toBe(844 - 195);
    expect(staleLandscape.joystickTop).toBe(Math.round((390 - 195) / 2));

    // Mobile rotates to portrait, but browser still reports 844x390:
    const stalePortrait = computeViewportLayout(844, 390, false);
    expect(stalePortrait.isLandscape).toBe(false);
    expect(stalePortrait.containerWidth).toBe(390);
    expect(stalePortrait.containerHeight).toBe(844);
    expect(stalePortrait.joystickLeft).toBe(Math.round((390 - 195) / 2));
    expect(stalePortrait.joystickTop).toBe(844 - 195);
  });

  it('supports level-basement mechanics: fireplace spawn, locked doors, openable bathroom door, stairs transition, and persistent player.states', () => {
    const state = createGameState({ initialLevelId: 'level-basement' });
    const input = createEmptyInput();

    // 1. Player starts with a Map in `player.states` and spawns next to the fireplace in the library
    expect(state.player.states).toBeInstanceOf(Map);
    expect(state.currentLevelId).toBe('level-basement');
    expect(state.player.x).toBe(BASEMENT_FIREPLACE_SPAWN.x);
    expect(state.player.y).toBe(BASEMENT_FIREPLACE_SPAWN.y);

    // 2. Both locked doors in the basement hallway show "It's locked."
    state.player.x = BASEMENT_HALL_NORTH_DOOR_BOUNDS.x + 2;
    state.player.y = BASEMENT_HALL_NORTH_DOOR_BOUNDS.y + TILE_SIZE + 2;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('basement-hall-north-door');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue?.lines[0]).toBe("It's locked.");

    // Close dialogue
    advanceDialogue(state, input);
    expect(state.activeDialogue).toBeNull();

    // Check front door on south wall of hallway
    state.player.x = BASEMENT_FRONT_DOOR_BOUNDS.x + 2;
    state.player.y = BASEMENT_FRONT_DOOR_BOUNDS.y - state.player.height - 2;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('basement-front-door');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue?.lines[0]).toBe("It's locked.");

    advanceDialogue(state, input);

    // 3. Bathroom door is initially closed and collidable (blocks walking into bathroom)
    state.player.x = BASEMENT_BATHROOM_DOOR_BOUNDS.x + 2;
    state.player.y = BASEMENT_BATHROOM_DOOR_BOUNDS.y + TILE_SIZE + 1;
    input.up = true;
    updateGameState(state, input, 0.2);
    input.up = false;
    // Blocked by closed bathroom door at row 9 (y = 9 * 16 = 144 -> player stops at y = 160)
    expect(state.player.y).toBeGreaterThanOrEqual(
      BASEMENT_BATHROOM_DOOR_BOUNDS.y + BASEMENT_BATHROOM_DOOR_BOUNDS.height - 0.01
    );
    expect(state.nearbyInteractable?.id).toBe('basement-bathroom-door');
    expect(state.nearbyInteractable?.promptText).toBe('Open door');

    // Open the bathroom door -> deletes the door and triggers toilet cutscene
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.levels['level-basement'].doors.length).toBe(0);

    // Toilet cutscene is active, locking player movement while exclamation mark blinks
    const basement = state.levels['level-basement'] as LevelBasement;
    expect(basement.toiletCutscene?.active).toBe(true);
    input.up = true;
    updateGameState(state, input, 0.35);
    input.up = false;
    expect(state.player.isMoving).toBe(false);

    // Advance 2 seconds -> Hanneloes jumps off the toilet and turns hostile instead of showing dialogue
    updateGameState(state, input, 2.0);
    expect(state.activeDialogue).toBeNull();
    expect(basement.hanneloesCombat.mode).toBe('hostile');
    expect(basement.toiletNpc.x).toBeLessThan(21 * TILE_SIZE);

    // Door remains open and player can walk into the bathroom
    state.player.x = BASEMENT_BATHROOM_DOOR_BOUNDS.x + 2;
    state.player.y = BASEMENT_BATHROOM_DOOR_BOUNDS.y + TILE_SIZE + 1;
    input.up = true;
    updateGameState(state, input, 0.35);
    input.up = false;
    expect(state.player.y).toBeLessThan(BASEMENT_BATHROOM_DOOR_BOUNDS.y);

    // 4. Stairs are initially blocked by the burnable wood stack until burned away
    expect(state.levels['level-basement'].stairsWoodBurned).toBe(false);
    state.levels['level-basement'].stairsWoodBurned = true;
    state.player.x = BASEMENT_STAIRS_TRIGGER_BOUNDS.x - state.player.width - 1;
    state.player.y = BASEMENT_STAIRS_TRIGGER_BOUNDS.y + 8;
    input.right = true;
    updateGameState(state, input, 0.2);
    input.right = false;
    expect(state.player.x).toBeLessThanOrEqual(
      BASEMENT_STAIRS_TRIGGER_BOUNDS.x - state.player.width + 0.01
    );
    expect(state.nearbyInteractable).toBeNull();
    // Walking close automatically triggers 0.5s fade-to-black -> level-upstairs -> 0.5s fade-from-black
    expect(state.screenFade?.phase).toBe('out');
    expect(state.screenFade?.duration).toBe(0.5);
    expect(state.currentLevelId).toBe('level-basement');

    updateGameState(state, input, 0.5);
    expect(state.currentLevelId).toBe('level-upstairs');
    expect(state.screenFade?.phase).toBe('in');
    updateGameState(state, input, 0.5);
    expect(state.screenFade).toBeNull();
    expect(state.player.states.get(USED_STAIRS_STATE_KEY)).toBe(true);
    expect(state.player.x).toBe(UPSTAIRS_STAIRS_SPAWN.x);
    expect(state.player.y).toBe(UPSTAIRS_STAIRS_SPAWN.y);
    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.lines[0]).toBe(
      "Heeeeere's Santa."
    );
    // Dismiss upstairs intro dialogue
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue).toBeNull();

    // 5. Walk back downstairs from `level-upstairs` -> automatically fades 0.5s to black, spawns Santa on the stairs in `level-basement`, and fades 0.5s from black
    state.player.x = UPSTAIRS_STAIRS_TRIGGER_BOUNDS.x + 8;
    state.player.y = UPSTAIRS_STAIRS_TRIGGER_BOUNDS.y - state.player.height - 1;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable).toBeNull();
    expect(state.screenFade?.phase).toBe('out');
    expect(state.screenFade?.duration).toBe(0.5);
    expect(state.currentLevelId).toBe('level-upstairs');

    updateGameState(state, input, 0.5);
    expect(state.currentLevelId).toBe('level-basement');
    expect(state.screenFade?.phase).toBe('in');
    updateGameState(state, input, 0.5);
    expect(state.screenFade).toBeNull();
    expect(state.player.x).toBe(BASEMENT_STAIRS_SPAWN.x);
    expect(state.player.y).toBe(BASEMENT_STAIRS_SPAWN.y);
  });

  it('supports level-upstairs closed doors, open hallway to extra room, and the one-time Kitchen Rosanna Santa cutscene', () => {
    const state = createGameState({ initialLevelId: 'level-upstairs' });
    const input = createEmptyInput();
    const upstairs = state.levels['level-upstairs'];

    // 1. Shower, Bedroom, Office, and Table Room doors start closed
    expect(upstairs.doors.map((d) => d.id)).toEqual([
      'upstairs-shower-door',
      'upstairs-bedroom-door',
      'upstairs-office-door',
      'upstairs-table-room-door',
    ]);

    // Fog-of-war masks validation:
    // Office fog-of-war covers the southern wall (rows 14..18 -> height: 5 tiles)
    const officeDoor = upstairs.doors.find((d) => d.id === 'upstairs-office-door')!;
    expect(officeDoor.hiddenRegions[0].height).toBe(5 * TILE_SIZE);
    expect(officeDoor.hiddenRegions[0]).toEqual(UPSTAIRS_OFFICE_HIDDEN_MASK);

    // Bedroom fog-of-war covers the eastern wall (cols 21..28 -> width: 8 tiles)
    const bedroomDoor = upstairs.doors.find((d) => d.id === 'upstairs-bedroom-door')!;
    expect(bedroomDoor.hiddenRegions[0].width).toBe(8 * TILE_SIZE);
    expect(bedroomDoor.hiddenRegions[0]).toEqual(UPSTAIRS_BEDROOM_HIDDEN_MASK);

    // Table Room fog-of-war:
    // West wall fog starts at row 18 (row 17 west corner uncovered)
    // East wall fog starts at row 19 (row 18 east corner uncovered)
    const tableRoomDoor = upstairs.doors.find((d) => d.id === 'upstairs-table-room-door')!;
    expect(tableRoomDoor.hiddenRegions).toEqual(UPSTAIRS_TABLE_ROOM_HIDDEN_MASKS);
    expect(tableRoomDoor.hiddenRegions.length).toBe(3);

    // Opening office door gives locked dialogue (no Arjan key exists anymore; must blast open with bazooka):
    state.player.x = UPSTAIRS_OFFICE_DOOR_BOUNDS.x + 2;
    state.player.y = UPSTAIRS_OFFICE_DOOR_BOUNDS.y - 14;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('upstairs-office-door');
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue?.lines[0]).toBe(
      "It's locked. Maybe I can blow it open."
    );
    // Dismiss dialogue
    advanceDialogue(state, input);
    expect(upstairs.doors.some((d) => d.id === 'upstairs-office-door')).toBe(true);

    // Dining cupboard no longer holds Arjan's key or an interactable
    state.player.x = UPSTAIRS_CUPBOARD_BOUNDS.x + TILE_SIZE + 2;
    state.player.y = UPSTAIRS_CUPBOARD_BOUNDS.y + 4;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).not.toBe('upstairs-dining-cupboard');

    // Open other doors: shower, bedroom, table room (office door stays locked until blasted)
    for (const [doorId, bounds, offsetY] of [
      ['upstairs-shower-door', UPSTAIRS_SHOWER_DOOR_BOUNDS, TILE_SIZE + 2],
      ['upstairs-bedroom-door', UPSTAIRS_BEDROOM_DOOR_BOUNDS, TILE_SIZE + 2],
      ['upstairs-table-room-door', UPSTAIRS_TABLE_ROOM_DOOR_BOUNDS, -14],
    ] as const) {
      state.player.x = bounds.x + 2;
      state.player.y = bounds.y + offsetY;
      updateGameState(state, input, 0.01);
      expect(state.nearbyInteractable?.id).toBe(doorId);
      expect(state.nearbyInteractable?.promptText).toBe('Open door');

      applyKeyEvent(input, 'Space', true);
      updateGameState(state, input, 0.01);
      applyKeyEvent(input, 'Space', false);
      if (doorId === 'upstairs-shower-door') {
        // Opening a door puts weapons on a 0.25s cooldown
        state.player.unlockedUzi = true;
        state.player.equippedItem = 'uzi';
        state.player.uziAmmo = 30;
        state.player.uziFireCooldown = 0;
        state.projectiles = [];
        applyKeyEvent(input, 'Space', true);
        updateGameState(state, input, 0.2);
        applyKeyEvent(input, 'Space', false);
        expect(state.projectiles.length).toBe(0);
        updateGameState(state, input, 0.06);
        applyKeyEvent(input, 'Space', true);
        updateGameState(state, input, 0.02);
        applyKeyEvent(input, 'Space', false);
        expect(state.projectiles.length).toBe(1);
        state.projectiles = [];
      }
      // Dismiss Anne-Marie's first-time hostile dialogue if triggered when opening bedroom door
      while (state.activeDialogue) {
        advanceDialogue(state, input);
      }
    }

    expect(upstairs.doors.map((d) => d.id)).toEqual(['upstairs-office-door']);

    // Inside Arjan's office: pick up C4 explosive
    state.player.x = UPSTAIRS_C4_BOUNDS.x;
    state.player.y = UPSTAIRS_C4_BOUNDS.y - state.player.height - 2;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('upstairs-office-c4');
    expect(state.nearbyInteractable?.promptText).toBe('Pick up C4');
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.player.states.get(C4_TAKEN_STATE_KEY)).toBe(true);
    expect(state.activeDialogue?.lines[0]).toBe(
      'You picked up a block of military-grade C4 explosive! Now plant it under the Christmas tree...'
    );
    advanceDialogue(state, input);

    // Inspect PC in the office -> "Start PC" and 3 dialogue messages
    state.player.x = UPSTAIRS_COMPUTER_BOUNDS.x + 2;
    state.player.y = UPSTAIRS_COMPUTER_BOUNDS.y + TILE_SIZE + 2;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('upstairs-office-pc');
    expect(state.nearbyInteractable?.promptText).toBe('Start PC');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue?.lines).toEqual([
      'Hmm... is this where Arjan pretends to work? It\'s just a bunch of pictures of Anne-Marie.',
      'Hey there\'s actually a python script here, shall we run it?',
      'You are now addicted to Olexa\'s text-based christmas adventure.',
    ]);
    expect(state.activeDialogue?.currentIndex).toBe(0);

    // Advance dialogue
    advanceDialogue(state, input);
    expect(state.activeDialogue?.currentIndex).toBe(1);

    advanceDialogue(state, input);
    expect(state.activeDialogue?.currentIndex).toBe(2);

    advanceDialogue(state, input);
    expect(state.activeDialogue).toBeNull();

    // 2. Hallway connects directly to the Extra Room on the east without any wall or door blocking it
    state.player.states.set(ANNE_MARIE_HOSTILE_DIALOGUE_KEY, true);
    state.player.x = 23 * TILE_SIZE;
    state.player.y = 12 * TILE_SIZE;
    input.right = true;
    for (let i = 0; i < 20; i++) {
      updateGameState(state, input, 0.05);
    }
    input.right = false;
    expect(state.player.x).toBeGreaterThan(26 * TILE_SIZE);

    // 3. Walking into The Kitchen triggers the one-time Rosanna Bazooka Santa reveal event
    expect(state.player.states.get(KITCHEN_ROSANNA_STATE_KEY)).toBeUndefined();
    state.player.x = 13.5 * TILE_SIZE;
    state.player.y = KITCHEN_TRIGGER_BOUNDS.y + 42;
    updateGameState(state, input, 0.05);

    expect(state.player.states.get(KITCHEN_ROSANNA_STATE_KEY)).toBe(true);
    expect(upstairs.rosannaCutscene?.active).toBe(true);
    const initialSantaZ = upstairs.rosannaCutscene!.santaZ;

    // During rising phase, player movement is locked while Rosanna slowly rises behind the middle window
    const lockedPlayerX = state.player.x;
    const lockedPlayerY = state.player.y;
    input.left = true;
    input.down = true;
    updateGameState(state, input, 0.5);
    input.left = false;
    input.down = false;
    expect(state.player.x).toBe(lockedPlayerX);
    expect(state.player.y).toBe(lockedPlayerY);
    expect(upstairs.rosannaCutscene!.santaZ).toBeGreaterThan(initialSantaZ);

    // Advance through firing + window jump phases until Rosanna enters the kitchen
    let sawRocket = false;
    for (let i = 0; i < 80; i++) {
      updateGameState(state, input, 0.05);
      if (state.projectiles.some((p) => p.kind === 'rocket')) {
        sawRocket = true;
      }
      if (!upstairs.rosannaCutscene) {
        break;
      }
    }

    expect(sawRocket).toBe(true);
    expect(state.player.health).toBe(MAX_PLAYER_HEALTH); // Cutscene explosion hits kitchen wall west of player without hurting player
    expect(upstairs.rosannaCutscene).toBeNull();
    expect(upstairs.rosannaSpawned).toBe(true);
    expect(upstairs.rosannaCombat.weapon).toBe('bazooka');
    expect(upstairs.rosannaCombat.mode).toBe('hostile');

    // Player regains control and can move again (clear active hostiles check or move down)
    input.down = true;
    updateGameState(state, input, 0.2);
    input.down = false;
    expect(state.player.y).toBeGreaterThan(lockedPlayerY);
    // Does not re-trigger on subsequent movement in the kitchen
    expect(upstairs.rosannaCutscene).toBeNull();
  });

  it('logs level transitions and custom messages via debugLog and DebugConsole', () => {
    debugConsole.clear();
    const state = createGameState();
    expect(debugConsole.getLines()).toContain('Loaded level: level-outside');

    loadLevel(state, 'level-basement');
    expect(debugConsole.getLines()).toContain('Loaded level: level-basement');

    loadLevel(state, 'level-upstairs');
    expect(debugConsole.getLines()).toContain('Loaded level: level-upstairs');

    debugLog('Custom debug test');
    expect(debugConsole.getLines()).toContain('Custom debug test');
  });

  it('supports overriding the starting level via ?level=X URL argument', () => {
    // 1. URL search parsing behavior
    expect(parseLevelQueryParam('?level=outdoors')).toBe('level-outside');
    expect(parseLevelQueryParam('?level=outside')).toBe('level-outside');
    expect(parseLevelQueryParam('?level=basement')).toBe('level-basement');
    expect(parseLevelQueryParam('?level=upstairs')).toBe('level-upstairs');
    expect(parseLevelQueryParam('?level=UNKNOWN')).toBe('level-outside');
    expect(parseLevelQueryParam('')).toBe('level-outside');
    expect(parseLevelQueryParam(null)).toBe('level-outside');
    expect(parseLevelQueryParam('basement')).toBe('level-basement');
    expect(parseLevelQueryParam('upstairs')).toBe('level-upstairs');
    expect(parseLevelQueryParam('outdoors')).toBe('level-outside');

    // 2. Starting at basement spawns at the fireplace
    const basementState = createGameState({
      initialLevelId: parseLevelQueryParam('?level=basement'),
      showIntroDialogue: false,
    });
    expect(basementState.currentLevelId).toBe('level-basement');
    expect(basementState.player.x).toBe(BASEMENT_FIREPLACE_SPAWN.x);
    expect(basementState.player.y).toBe(BASEMENT_FIREPLACE_SPAWN.y);

    // 3. Starting upstairs spawns at the staircase
    const upstairsState = createGameState({
      initialLevelId: parseLevelQueryParam('?level=upstairs'),
      showIntroDialogue: false,
    });
    expect(upstairsState.currentLevelId).toBe('level-upstairs');
    expect(upstairsState.player.x).toBe(UPSTAIRS_STAIRS_SPAWN.x);
    expect(upstairsState.player.y).toBe(UPSTAIRS_STAIRS_SPAWN.y);

    // 4. Player can walk freely along the hallway from the staircase
    const input = createEmptyInput();
    input.left = true;
    for (let i = 0; i < 20; i++) {
      updateGameState(upstairsState, input, 0.05);
    }
    input.left = false;
    expect(upstairsState.player.x).toBeLessThan(UPSTAIRS_STAIRS_SPAWN.x);
  });

  it('allows walking freely along row 5 north of the shortened dining table upstairs', () => {
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();

    // Start player at col 3, row 5
    state.player.x = 3 * TILE_SIZE;
    state.player.y = 5 * TILE_SIZE;

    // Walk east across row 5 all the way to col 8 past the table (cols 4..5, rows 6..9)
    input.right = true;
    for (let i = 0; i < 30; i++) {
      updateGameState(state, input, 0.05);
    }
    input.right = false;

    expect(state.player.x).toBeGreaterThan(7 * TILE_SIZE);
    expect(Math.round(state.player.y)).toBe(5 * TILE_SIZE);
  });

  it('initializes debugMode based on options and supports basement toilet/dog bowl collision updates', () => {
    const normalState = createGameState();
    expect(normalState.debugMode).toBe(false);

    const debugState = createGameState({ debug: true });
    expect(debugState.debugMode).toBe(true);

    const basement = debugState.levels['level-basement'];
    // Col 21, Row 9 is the toilet on the east wall (solid)
    expect(basement.map.tiles[9][21]).toBe(TileType.FurnitureSolid);

    // Col 18, Row 14 is the dog bowl tile (walkable StoneTileFloor)
    expect(basement.map.tiles[14][18]).toBe(TileType.StoneTileFloor);
  });

  it('updates the upstairs altar alcove walls and kitchen entrance walkability', () => {
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const upstairs = state.levels['level-upstairs'];

    // Row 9 (north & northwest & northeast of altar): cols 9..12 are wall tiles
    expect(upstairs.map.tiles[9][9]).toBe(TileType.InteriorWall);
    expect(upstairs.map.tiles[9][10]).toBe(TileType.InteriorWall);
    expect(upstairs.map.tiles[9][11]).toBe(TileType.InteriorWall);
    expect(upstairs.map.tiles[9][12]).toBe(TileType.InteriorWall);

    // Row 10: col 12 (east of altar) is a wall tile
    expect(upstairs.map.tiles[10][12]).toBe(TileType.InteriorWall);
    // Altar itself at cols 10..11, row 10
    expect(upstairs.map.tiles[10][10]).toBe(TileType.FurnitureSolid);
    expect(upstairs.map.tiles[10][11]).toBe(TileType.FurnitureSolid);

    // Kitchen entrance is 2 tiles wide at cols 13..14
    expect(upstairs.map.tiles[10][13]).toBe(TileType.WoodFloor);
    expect(upstairs.map.tiles[10][14]).toBe(TileType.WoodFloor);
    expect(upstairs.map.tiles[9][13]).toBe(TileType.WoodFloor);
    expect(upstairs.map.tiles[9][14]).toBe(TileType.WoodFloor);

    // Walking up through the kitchen entrance from hallway (row 11) to kitchen (row 8)
    const input = createEmptyInput();
    state.player.x = 13.5 * TILE_SIZE;
    state.player.y = 11 * TILE_SIZE;
    input.up = true;
    for (let i = 0; i < 20; i++) {
      updateGameState(state, input, 0.05);
    }
    input.up = false;
    expect(state.player.y).toBeLessThan(9 * TILE_SIZE);
  });

  it('manages black cat AI in the extra room: starts standing still, flees when player enters room, stops when > 5 tiles, reflee when <= 2 tiles, cannot cross walls', () => {
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const upstairs = state.levels['level-upstairs'];
    const cat = upstairs.cat;

    // 1. Initial position near extra room window, standing still, not activated
    expect(cat.x).toBe(CAT_START_X);
    expect(cat.y).toBe(CAT_START_Y);
    expect(cat.mode).toBe('standing');
    expect(cat.hasBeenActivated).toBe(false);

    // Player walking in hallway outside extra room does not activate the cat
    state.player.x = 22 * TILE_SIZE;
    state.player.y = 12 * TILE_SIZE;
    updateGameState(state, input, 0.1);
    expect(cat.mode).toBe('standing');
    expect(cat.hasBeenActivated).toBe(false);

    debugConsole.clear();

    // 2. Player enters the extra room -> cat enters "flee" mode and flees away from player
    state.player.x = EXTRA_ROOM_BOUNDS.x + 4;
    state.player.y = EXTRA_ROOM_BOUNDS.y + 4;
    updateGameState(state, input, 0.1);

    expect(cat.hasBeenActivated).toBe(true);
    expect(cat.mode).toBe('flee');
    expect(cat.vx).not.toBe(0);
    expect(debugConsole.getLines()).toContain('Cat state changed: standing -> flee');

    // 3. Cat runs away and cannot pass through outer east wall (col 28) or south wall (row 18)
    for (let i = 0; i < 40; i++) {
      updateGameState(state, input, 0.05);
    }
    // Cat ran and stayed within map bounds without walking through walls
    expect(cat.x).toBeLessThan(28 * TILE_SIZE);
    expect(cat.y).toBeLessThan(18 * TILE_SIZE);
    expect(
      debugConsole.getLines().some((line) => line.startsWith('Cat wall force changed:'))
    ).toBe(true);

    // 4. If player moves far away (> 5 tiles distance from cat), cat goes back to "standing still"
    state.player.x = 10 * TILE_SIZE;
    state.player.y = 10 * TILE_SIZE;
    // Advance enough time for cat deceleration to bring velocity to 0
    for (let i = 0; i < 30; i++) {
      updateGameState(state, input, 0.05);
    }
    expect(cat.mode).toBe('standing');
    expect(cat.vx).toBe(0);
    expect(cat.vy).toBe(0);
    expect(debugConsole.getLines()).toContain('Cat state changed: flee -> standing');
    expect(cat.wallForceDirX).toBe(0);
    expect(cat.wallForceDirY).toBe(0);

    // 5. If player approaches within 2 tiles distance, cat enters "flee" mode again
    state.player.x = cat.x - (CAT_RETRIGGER_FLEE_DISTANCE - 4);
    state.player.y = cat.y;
    updateGameState(state, input, 0.05);
    expect(cat.mode).toBe('flee');
    expect(cat.vx).not.toBe(0);
    expect(debugConsole.getLines()).toContain('Cat state changed: standing -> flee');
  });

  it('calculates LineOfSight and ConeOfSight bounding boxes and triggers detection callbacks', () => {
    // 1. LineOfSight unit test without map:
    // Starts at (100, 100), facing east (direction = 0), distance = 50 (default 20 sample points)
    const los = new LineOfSight({ x: 100, y: 100 }, 0, 50);
    expect(los.n).toBe(20);
    expect(los.boxes.length).toBe(20);
    for (let i = 0; i < 20; i++) {
      expect(los.boxes[i].x).toBeCloseTo(100 + (50 / 20) * i);
      expect(los.boxes[i].y).toBeCloseTo(100);
      expect(los.boxes[i].width).toBe(4);
      expect(los.boxes[i].height).toBe(4);
      // Getter points(i) returns center of box
      expect(los.points(i).x).toBeCloseTo(100 + (50 / 20) * i + 2);
      expect(los.points(i).y).toBeCloseTo(100 + 2);
    }

    // LineOfSight with wall collision stop:
    // A mock map where column 3 is a wall
    const mockMap = {
      cols: 10,
      rows: 10,
      tileSize: 16,
      tiles: Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, (_, col) => (col === 3 ? 21 : 16))
      ),
    };
    // Starting at x = 16 (col 1), going east: box 0 (x=16, col 1), box 1 (x=32, col 2), box 2 (x=48, col 3 = wall!)
    // Box 2 collides with wall, so box 3+ should not be spawned.
    const losWithWall = new LineOfSight({ x: 16, y: 16 }, 0, 160, mockMap as any);
    expect(losWithWall.n).toBe(5); // 20-point step=8px: boxes 0..4 spawned (x=16,24,32,40,48); box 4 hit col 3 wall

    let losDetectedCount = 0;
    const unsubLos = los.onDetection(() => {
      losDetectedCount++;
    });

    const player = createPlayer(0, 0);
    // Player far away -> no detection
    player.x = 20;
    player.y = 20;
    expect(los.checkDetection(player)).toBe(false);
    expect(losDetectedCount).toBe(0);

    // Player collides with box 4 at x = 120, y = 100
    player.x = 118;
    player.y = 98;
    expect(los.checkDetection(player)).toBe(true);
    expect(losDetectedCount).toBe(1);

    // Unsubscribe
    unsubLos();
    expect(los.checkDetection(player)).toBe(true);
    expect(losDetectedCount).toBe(1);

    // 2. ConeOfSight unit test:
    // 5 lines: -fov/2, -fov/4, forward, +fov/4, +fov/2
    const fov = (60 * Math.PI) / 180;
    const cone = new ConeOfSight({ x: 200, y: 200 }, 0, 60, fov);
    expect(cone.lines.length).toBe(5);
    expect(cone.getAllBoxes().length).toBe(100);
    expect(cone.sightPolygon.length).toBe(6); // position + 5 line tips

    let coneDetectedCount = 0;
    cone.onDetection(() => {
      coneDetectedCount++;
    });

    // Player far away
    player.x = 0;
    player.y = 0;
    expect(cone.checkDetection(player)).toBe(false);
    expect(coneDetectedCount).toBe(0);

    // Player inside +fov/2 line at 30 degrees (last line: index 4)
    const boxOnPlusLine = cone.lines[4].boxes[5];
    player.x = boxOnPlusLine.x;
    player.y = boxOnPlusLine.y;
    expect(cone.checkDetection(player)).toBe(true);
    expect(coneDetectedCount).toBe(1);
  });

  it('rotates the basement window NPC cone of sight and damages Santa upon detection with "Intruder!!!" dialogue', () => {
    const state = createGameState({ initialLevelId: 'level-basement' });
    const input = createEmptyInput();
    const basement = state.levels['level-basement'];

    // 1. Initially looking north (-Math.PI / 2 radians, or 90 degrees absolute)
    expect(basement.npcSightAngle).toBeCloseTo(-Math.PI / 2);
    // Distance doubled to 15 tiles (240 px) with 20 sample points per ray
    expect(basement.coneOfSight!.distance).toBe(15 * 16);
    expect(basement.coneOfSight!.lines.length).toBe(5);
    expect(basement.coneOfSight!.lines[0].maxPoints).toBe(20);
    expect(basement.coneOfSight!.sightPolygon.length).toBe(6);

    // Rotates smoothly twice as fast (Math.PI / 4 rad/s) sweeping West (-PI) <-> North (-PI/2) <-> East (0)
    updateGameState(state, input, 1.0);
    expect(basement.npcSightAngle).toBeCloseTo(-Math.PI / 4);

    updateGameState(state, input, 1.0); // reaches East (0) and reverses direction!
    expect(basement.npcSightAngle).toBeCloseTo(0);
    expect(basement.arjanSweepDir).toBe(-1);

    updateGameState(state, input, 2.0); // sweeps back to North (-PI/2)
    expect(basement.npcSightAngle).toBeCloseTo(-Math.PI / 2);

    updateGameState(state, input, 2.0); // reaches West (-PI) and reverses back toward North!
    expect(basement.npcSightAngle).toBeCloseTo(-Math.PI);
    expect(basement.arjanSweepDir).toBe(1);

    // 2. Test player detection: place Santa in Arjan's cone of sight -> Arjan turns hostile immediately,
    //    and Olexa (within 5 tiles) has a 2-second delayed hostile propagation!
    const targetBox = basement.coneOfSight!.getAllBoxes()[5];
    state.player.x = targetBox.x - 2;
    state.player.y = targetBox.y - 2;
    updateGameState(state, input, 0.01);

    expect(state.activeDialogue).toBeNull();
    expect(basement.arjanCombat.mode).toBe('hostile');
    expect(basement.olexaCombat.mode).toBe('passive');
    expect(basement.olexaCombat.pendingHostileAlertTimer).toBeCloseTo(2.0, 1);
    expect(basement.arjanCombat.hostileAlertTimer).toBeCloseTo(0.5, 2);
    expect(isNpcBillboardVisible(basement.arjanCombat)).toBe(false);
    expect(PLAYER_UZI_NPC_DAMAGE).toBe(30);
    // Does not shoot, move, or show health billboard during the 0.5-second blinking exclamation alert
    const arjanStartY = basement.windowNpc.y;
    updateGameState(state, input, 0.25);
    expect(basement.windowNpc.y).toBe(arjanStartY);
    expect(basement.arjanCombat.isMoving).toBe(false);
    expect(isNpcBillboardVisible(basement.arjanCombat)).toBe(false);
    expect(state.projectiles.some((p) => p.owner === 'npc' && p.sourceNpcKey === 'basement:Arjan')).toBe(false);
    // After 1s alert completes, Arjan starts shooting Uzi and shows health billboard
    updateGameState(state, input, 0.55);
    expect(isNpcBillboardVisible(basement.arjanCombat)).toBe(true);
    expect(state.projectiles.some((p) => p.owner === 'npc' && p.sourceNpcKey === 'basement:Arjan')).toBe(true);
    // After 2s total delay, Olexa also turns hostile!
    updateGameState(state, input, 1.25);
    expect(basement.olexaCombat.mode).toBe('hostile');
  });

  it('supports the people level (?level=people), spawning 11 NPCs and talking to each with their portrait', () => {
    // 1. Parsing query parameter ?level=people
    expect(parseLevelQueryParam('?level=people')).toBe('level-people');
    expect(parseLevelQueryParam('people')).toBe('level-people');

    // 2. Load level-people
    const state = createGameState({ initialLevelId: 'level-people' });
    const input = createEmptyInput();
    const peopleLevel = state.levels['level-people'] as LevelPeople;

    expect(state.currentLevelId).toBe('level-people');
    expect(state.player.x).toBe(PEOPLE_PLAYER_SPAWN.x);
    expect(state.player.y).toBe(PEOPLE_PLAYER_SPAWN.y);

    // 3. Exactly 11 NPCs matching inspiration person names
    expect(peopleLevel.npcs.length).toBe(11);
    expect(peopleLevel.npcs.map((npc) => npc.name)).toEqual([...PEOPLE_NAMES]);

    // 4. Test walking up to Henrik and talking to him
    const henrikNpc = peopleLevel.npcs.find((n) => n.name === 'Henrik')!;
    state.player.x = henrikNpc.bounds.x;
    state.player.y = henrikNpc.bounds.y + henrikNpc.bounds.height + 2;
    updateGameState(state, input, 0.01);

    expect(state.nearbyInteractable?.id).toBe('person-henrik');
    expect(state.nearbyInteractable?.promptText).toBe('Talk to Henrik');
    expect(state.nearbyInteractable?.speakerPortrait).toBe('Henrik');

    // Press Z to talk
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.lines[0]).toBe('Henrik says hello.');
    expect(state.activeDialogue?.speakerPortrait).toBe('Henrik');

    // Dismiss dialogue
    advanceDialogue(state, input);
    expect(state.activeDialogue).toBeNull();

    // 5. Test talking to Olexa
    const olexaNpc = peopleLevel.npcs.find((n) => n.name === 'Olexa')!;
    state.player.x = olexaNpc.bounds.x;
    state.player.y = olexaNpc.bounds.y + olexaNpc.bounds.height + 2;
    updateGameState(state, input, 0.01);

    expect(state.nearbyInteractable?.id).toBe('person-olexa');
    expect(state.nearbyInteractable?.speakerPortrait).toBe('Olexa');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    expect(state.activeDialogue?.lines[0]).toBe('Olexa says hello.');
    expect(state.activeDialogue?.speakerPortrait).toBe('Olexa');
  });

  it('detects Santa in basement Olexa cone of sight and damages player upon detection', () => {
    const state = createGameState({
      initialLevelId: 'level-basement',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const basement = state.levels['level-basement'] as LevelBasement;

    // Olexa is 1 tile south of the chess board, cone of sight looking north (-Math.PI / 2)
    expect(basement.olexaConeOfSight!.lines.length).toBe(5);
    expect(basement.olexaConeOfSight!.direction).toBeCloseTo(-Math.PI / 2);

    // Check that the chess board table (cols 8..9, row 17) is floor and not collidable
    expect(basement.map.tiles[17][8]).toBe(TileType.WoodFloor);
    expect(basement.map.tiles[17][9]).toBe(TileType.WoodFloor);

    // Place Santa inside Olexa's cone of sight -> turns hostile & fires Uzi without dialogue/reset
    state.player.x = 8.5 * TILE_SIZE;
    state.player.y = 17 * TILE_SIZE;
    updateGameState(state, input, 0.01);

    expect(state.activeDialogue).toBeNull();
    expect(basement.olexaCombat.mode).toBe('hostile');
    expect(basement.olexaCombat.hostileAlertTimer).toBeCloseTo(0.5, 2);
    updateGameState(state, input, 0.55);
    expect(state.projectiles.some((p) => p.owner === 'npc' && p.sourceNpcKey === 'basement:Olexa')).toBe(true);
  });

  it('patrols upstairs Albin in dining room with reversing cone of sight and damages Santa on detection', () => {
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const upstairs = state.levels['level-upstairs'] as LevelUpstairs;

    expect(upstairs.albinY).toBe(UPSTAIRS_ALBIN_START_Y);
    expect(upstairs.albinDir).toBe(1); // Walking south
    expect(upstairs.albinCone!.direction).toBeCloseTo(Math.PI / 2);

    // Advance 6 seconds: Albin moves at 15 px/s, travels > 64px, reaches end, reverses to walking north (-Math.PI / 2)
    updateGameState(state, input, 6.0);
    expect(upstairs.albinDir).toBe(-1);
    expect(upstairs.albinCone!.direction).toBeCloseTo(-Math.PI / 2);

    // Place Santa in Albin's cone of sight -> turns hostile & shoots Uzi
    const targetBox = upstairs.albinCone!.getAllBoxes()[5];
    state.player.x = targetBox.x - 2;
    state.player.y = targetBox.y - 2;
    updateGameState(state, input, 0.01);

    expect(state.activeDialogue).toBeNull();
    expect(upstairs.albinCombat.mode).toBe('hostile');
    expect(upstairs.albinCombat.hostileAlertTimer).toBeCloseTo(0.5, 2);
    updateGameState(state, input, 0.55);
    expect(state.projectiles.some((p) => p.owner === 'npc' && p.sourceNpcKey === 'upstairs:Albin')).toBe(true);
  });

  it('handles upstairs Henrik and Tanja in table room after opening door', () => {
    // 1. When table room door is closed, Henrik does not detect player
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const upstairs = state.levels['level-upstairs'] as LevelUpstairs;

    // Henrik starts facing south (Math.PI / 2)
    expect(upstairs.henrikAngle).toBeCloseTo(Math.PI / 2);

    // Place Santa where Henrik would see him if door was open
    const targetBoxClosed = upstairs.henrikCone!.getAllBoxes()[5];
    state.player.x = targetBoxClosed.x - 2;
    state.player.y = targetBoxClosed.y - 2;
    updateGameState(state, input, 0.01);
    expect(upstairs.henrikCombat.mode).toBe('passive'); // Door is closed, inactive

    // 2. Open table room door
    const tableRoomDoor = upstairs.doors.find(
      (d) => d.id === 'upstairs-table-room-door'
    )!;
    state.player.x = tableRoomDoor.bounds.x + 2;
    state.player.y = tableRoomDoor.bounds.y - 10;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('upstairs-table-room-door');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(
      upstairs.doors.some((d) => d.id === 'upstairs-table-room-door')
    ).toBe(false);

    // 3. Henrik rotates 45 degrees counter-clockwise every 1 second
    updateGameState(state, input, 0.5);
    expect(upstairs.henrikAngle).toBeCloseTo(Math.PI / 2);
    updateGameState(state, input, 0.6); // Total 1.1s -> rotates by -Math.PI / 4
    expect(upstairs.henrikAngle).toBeCloseTo(Math.PI / 2 - Math.PI / 4);

    // 4. Henrik detects Santa -> turns hostile
    const henrikBox = upstairs.henrikCone!.getAllBoxes()[5];
    state.player.x = henrikBox.x - 2;
    state.player.y = henrikBox.y - 2;
    updateGameState(state, input, 0.01);
    expect(upstairs.henrikCombat.mode).toBe('hostile');

    // 5. Tanja detection (always facing north) -> turns hostile
    const state2 = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const upstairs2 = state2.levels['level-upstairs'] as LevelUpstairs;
    // Open door
    upstairs2.doors = upstairs2.doors.filter(
      (d) => d.id !== 'upstairs-table-room-door'
    );
    expect(upstairs2.tanjaCone!.direction).toBeCloseTo(-Math.PI / 2);

    const tanjaBox = upstairs2.tanjaCone!.getAllBoxes()[5];
    state2.player.x = tanjaBox.x - 2;
    state2.player.y = tanjaBox.y - 2;
    updateGameState(state2, input, 0.01);
    expect(upstairs2.tanjaCombat.mode).toBe('hostile');
  });

  it('detects Santa in upstairs living room via Diana and Simon cones of sight', () => {
    // 1. Diana detection (looking towards Christmas tree) -> turns hostile
    const stateDiana = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const upstairsDiana = stateDiana.levels['level-upstairs'] as LevelUpstairs;

    const dianaBox = upstairsDiana.dianaCone!.getAllBoxes()[3];
    stateDiana.player.x = dianaBox.x - 2;
    stateDiana.player.y = dianaBox.y - 2;
    updateGameState(stateDiana, input, 0.01);
    expect(upstairsDiana.dianaCombat.mode).toBe('hostile');

    // 2. Simon detection (looking towards Christmas tree) -> turns hostile
    const stateSimon = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const upstairsSimon = stateSimon.levels['level-upstairs'] as LevelUpstairs;

    const simonBox = upstairsSimon.simonCone!.getAllBoxes()[3];
    stateSimon.player.x = simonBox.x - 2;
    stateSimon.player.y = simonBox.y - 2;
    updateGameState(stateSimon, input, 0.01);
    expect(upstairsSimon.simonCombat.mode).toBe('hostile');
  });

  it('handles upstairs Anne-Marie in bedroom after opening door', () => {
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const upstairs = state.levels['level-upstairs'] as LevelUpstairs;

    // 1. Inactive when door is closed
    const targetBoxClosed = upstairs.anneMarieCone!.getAllBoxes()[5];
    state.player.x = targetBoxClosed.x - 2;
    state.player.y = targetBoxClosed.y - 2;
    updateGameState(state, input, 0.01);
    expect(upstairs.anneMarieCombat.mode).toBe('passive');

    // 2. Open bedroom door
    upstairs.doors = upstairs.doors.filter(
      (d) => d.id !== 'upstairs-bedroom-door'
    );

    // 3. Anne-Marie always faces south (Math.PI / 2) toward the bedroom door and does not rotate
    expect(upstairs.anneMarieAngle).toBeCloseTo(Math.PI / 2);
    expect(upstairs.anneMarieCombat.weapon).toBe('katana');
    updateGameState(state, input, 1.1);
    expect(upstairs.anneMarieAngle).toBeCloseTo(Math.PI / 2);

    // 4. Detects Santa -> turns hostile
    const targetBoxOpen = upstairs.anneMarieCone!.getAllBoxes()[5];
    state.player.x = targetBoxOpen.x - 2;
    state.player.y = targetBoxOpen.y - 2;
    updateGameState(state, input, 0.01);
    expect(upstairs.anneMarieCombat.mode).toBe('hostile');
  });

  it('removes talk dialogs from all upstairs NPCs while preserving presents pickup', () => {
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const upstairs = state.levels['level-upstairs'] as LevelUpstairs;

    // 1. No upstairs NPC has a talk/inspect dialog interactable anymore
    const allInteractableIds = upstairs.getInteractables(state.player).map((i) => i.id);
    expect(allInteractableIds).not.toContain('upstairs-diana-npc');
    expect(allInteractableIds).not.toContain('upstairs-simon-npc');

    state.player.x = upstairs.dianaNpc.x;
    state.player.y = upstairs.dianaNpc.y - state.player.height - 2;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable).toBeNull();

    state.player.x = upstairs.simonNpc.x + upstairs.simonNpc.width + 2;
    state.player.y = upstairs.simonNpc.y;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable).toBeNull();

    // 2. Presents in bedroom and office can still be picked up
    state.player.x = UPSTAIRS_DIANA_PRESENT_BOUNDS.x;
    state.player.y =
      UPSTAIRS_DIANA_PRESENT_BOUNDS.y + UPSTAIRS_DIANA_PRESENT_BOUNDS.height + 2;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('upstairs-diana-present');
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.player.states.get(DIANA_PRESENT_TAKEN_KEY)).toBe(true);
    expect(state.activeDialogue?.lines).toEqual([
      "I'll open this! Hmm, it's whiskey.",
      'You drank the whole bottle.',
    ]);
    const dismissActiveDialogue = () => {
      while (state.activeDialogue) {
        applyKeyEvent(input, 'Space', true);
        updateGameState(state, input, 0.01);
        applyKeyEvent(input, 'Space', false);
      }
    };
    dismissActiveDialogue();

    state.player.x = UPSTAIRS_SIMON_PRESENT_BOUNDS.x;
    state.player.y =
      UPSTAIRS_SIMON_PRESENT_BOUNDS.y - state.player.height - 2;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('upstairs-simon-present');
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.player.states.get(SIMON_PRESENT_TAKEN_KEY)).toBe(true);
    expect(state.activeDialogue?.lines).toEqual([
      "I'll open this! Hmm, it's whiskey.",
      'You drank the whole bottle.',
    ]);
  });

  it('populates SecretSantaDB from secret.txt format, provides getters, and debug logs entries', async () => {
    debugConsole.clear();

    const sampleContent = `
Alex -> Arjan
Anne Marie -> Annelotte
Annelotte -> Olexa
Arjan -> Hanneloes
Hanneloes -> Anne Marie
Henrik -> Sylvester
Olexa -> Henrik
Sylvester -> Tanja
Tanja -> Alex
`;

    // Initialize with a playerId encoded for "Alex" -> btoa("Alex") = "QWxleA=="
    const alexPid = btoa('Alex');
    const db: SecretSantaDB = await initSecretSantaDB(sampleContent, alexPid);
    db.debugLogAll();

    expect(db.playerId).toBe(alexPid);
    expect(db.playerName).toBe('Alex');
    expect(db.toPlayerId('Alex')).toBe(alexPid);

    expect(db.giftGivers).toEqual([
      'Alex',
      'Anne Marie',
      'Annelotte',
      'Arjan',
      'Hanneloes',
      'Henrik',
      'Olexa',
      'Sylvester',
      'Tanja',
    ]);

    expect(db.getGiftReceiverOf('Alex')).toBe('Arjan');
    expect(db.getGiftReceiverOf('Anne Marie')).toBe('Annelotte');
    expect(db.getGiftReceiverOf('Henrik')).toBe('Sylvester');
    expect(db.getGiftReceiverOf('Tanja')).toBe('Alex');
    expect(db.getGiftReceiverOf('Unknown')).toBeUndefined();

    const logs = debugConsole.getLines();
    expect(logs).toContain(`Alex (${alexPid}) -> Arjan`);
    expect(logs).toContain(`Henrik (${btoa('Henrik')}) -> Sylvester`);
    expect(logs).toContain(`Tanja (${btoa('Tanja')}) -> Alex`);
    expect(logs).toContain(
      'Based on pid, the current player is Alex who should give a gift to Arjan'
    );

    // Test with null playerId
    debugConsole.clear();
    const dbNoPid = new SecretSantaDB(sampleContent, null);
    expect(dbNoPid.playerId).toBeNull();
    expect(dbNoPid.playerName).toBeNull();
    dbNoPid.debugLogAll();
    const logsNoPid = debugConsole.getLines();
    expect(logsNoPid).toContain(
      'Based on pid, the current player is null who should give a gift to null'
    );
  });

  it('mutes ConeOfSight detection when ?cheat is enabled', () => {
    let detectedWithoutCheat = false;
    let detectedWithCheat = false;

    const cone = new ConeOfSight(
      { x: 100, y: 100 },
      0,
      100
    );
    cone.onDetection(() => {
      detectedWithoutCheat = true;
    });

    const player = createPlayer(130, 100);

    ConeOfSight.cheatMode = false;
    const resNormal = cone.checkDetection(player);
    expect(resNormal).toBe(true);
    expect(detectedWithoutCheat).toBe(true);

    const cheatCone = new ConeOfSight(
      { x: 100, y: 100 },
      0,
      100
    );
    cheatCone.onDetection(() => {
      detectedWithCheat = true;
    });

    ConeOfSight.cheatMode = true;
    const resCheat = cheatCone.checkDetection(player);
    expect(resCheat).toBe(false);
    expect(detectedWithCheat).toBe(false);

    // Also verify gameState creation with cheat: true
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      cheat: true,
    });
    expect(state.cheatMode).toBe(true);
    expect(ConeOfSight.cheatMode).toBe(true);
  });

  it('picks up C4 in office, places it under the Christmas tree to blow up the house, and shows unclosable Secret Santa ending dialogue', () => {
    const sampleContent = 'Alex -> Arjan\nHenrik -> Sylvester';
    const alexPid = btoa('Alex');
    const secretSantaDB = new SecretSantaDB(sampleContent, alexPid);

    const state = createGameState({
      initialLevelId: 'level-upstairs',
      secretSantaDB,
      cheat: true,
    });

    expect(state.worldFadedToBlack).toBe(false);
    expect(state.houseExploding).toBe(false);

    // Without C4 yet, standing next to the Christmas tree does NOT allow placing C4
    state.player.x = 4 * TILE_SIZE; // x: 64
    state.player.y = 15 * TILE_SIZE; // y: 240
    refreshInteractables(state);
    expect(findNearbyInteractable(state.player, state.interactables)?.id).not.toBe(
      'upstairs-xmas-tree'
    );

    // Pick up C4 inside Arjan's office
    state.player.x = UPSTAIRS_C4_BOUNDS.x;
    state.player.y = UPSTAIRS_C4_BOUNDS.y - state.player.height - 2;
    refreshInteractables(state);
    const nearbyC4 = findNearbyInteractable(state.player, state.interactables);
    expect(nearbyC4?.id).toBe('upstairs-office-c4');
    expect(nearbyC4?.promptText).toBe('Pick up C4');

    const input = createEmptyInput();
    input.actionJustPressed = true;
    input.action = true;
    updateGameState(state, input, 0.016);
    expect(state.player.states.get(C4_TAKEN_STATE_KEY)).toBe(true);
    // Dismiss pickup dialogue
    advanceDialogue(state, input);

    // Now return to the Christmas tree -> "Place C4" prompt appears
    state.player.x = 4 * TILE_SIZE;
    state.player.y = 15 * TILE_SIZE;
    refreshInteractables(state);
    const nearby = findNearbyInteractable(state.player, state.interactables);
    expect(nearby).not.toBeNull();
    expect(nearby?.id).toBe('upstairs-xmas-tree');
    expect(nearby?.promptText).toBe('Place C4');

    // Attempting to plant C4 while NPCs in basement/upstairs are still alive triggers the naughty list dialogue
    input.actionJustPressed = true;
    updateGameState(state, input, 0.016);
    expect(state.player.states.get(C4_PLACED_STATE_KEY)).toBeUndefined();
    expect(state.houseExploding).toBe(false);
    expect(state.activeDialogue?.lines[0]).toBe(
      "I'm not ready... I still have to say good-bye to the people on my naughty list. Which are:"
    );
    expect(state.activeDialogue?.lines[1]).toContain('Arjan');
    expect(state.activeDialogue?.lines[1]).toContain('Rosanna');
    expect(state.activeDialogue?.lines[1]).not.toContain('Cat');
    // Dismiss naughty list dialogue
    const dismissNaughtyDialogue = () => {
      while (state.activeDialogue) {
        advanceDialogue(state, input);
      }
    };
    dismissNaughtyDialogue();

    // Mark every NPC in basement & upstairs dead (cat stays alive and is excluded)
    const markAllNpcsDead = (gs: typeof state) => {
      const b = gs.levels['level-basement'];
      const u = gs.levels['level-upstairs'];
      for (const npc of [
        b.arjanCombat,
        b.olexaCombat,
        b.hanneloesCombat,
        u.albinCombat,
        u.henrikCombat,
        u.tanjaCombat,
        u.dianaCombat,
        u.simonCombat,
        u.anneMarieCombat,
        u.rosannaCombat,
      ]) {
        npc.mode = 'dead';
        npc.health = 0;
      }
    };
    markAllNpcsDead(state);
    expect(state.levels['level-upstairs'].cat.mode).not.toBe('dead');

    // Press Space to plant and detonate C4 now that all naughty-list NPCs are dead
    input.actionJustPressed = true;
    updateGameState(state, input, 0.016);

    expect(state.player.states.get(C4_PLACED_STATE_KEY)).toBe(true);
    expect(state.houseExploding).toBe(true);
    expect(state.explosions.length).toBeGreaterThan(0);
    expect(state.destroyingWalls.length).toBeGreaterThan(0);
    expect(state.blackenedWalls.size).toBeGreaterThan(0);
    expect(getStaticLevelMesh(state.currentLevelId, state.map, state).vertexCount).toBeGreaterThan(0);
    expect(buildDynamicSceneMeshes(state, 0.25).opaque.vertexCount).toBeGreaterThan(0);

    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.unclosable).toBe(true);
    expect(state.activeDialogue?.lines).toEqual([
      'KABOOM! The C4 detonates under the Christmas tree, blowing the entire Rensbo house sky-high!',
      'CONGRATULATIONS! You have "saved" Christmas — not a single witness, wall, or hostile Santa left standing.',
    ]);
    expect(state.activeDialogue?.currentIndex).toBe(0);

    // Advance dialogue to line 1 (final line) -> world fades to black
    advanceDialogue(state, input);
    expect(state.activeDialogue?.currentIndex).toBe(1);
    expect(state.worldFadedToBlack).toBe(true);
    expect(state.activeDialogue?.lines[state.activeDialogue.currentIndex]).toBe(
      'CONGRATULATIONS! You have "saved" Christmas — not a single witness, wall, or hostile Santa left standing.'
    );

    // Attempting to advance beyond the final line must NOT close the dialogue box and must stay frozen
    advanceDialogue(state, input);
    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.currentIndex).toBe(1);
    expect(state.activeDialogue?.lines[state.activeDialogue.currentIndex]).toBe(
      'CONGRATULATIONS! You have "saved" Christmas — not a single witness, wall, or hostile Santa left standing.'
    );
  });

  it('supports URL parameter ?giveUpSorry loading an unclosable dialog box with the gift receiver', () => {
    const sampleContent = 'Alex -> Arjan\nHenrik -> Sylvester';
    const alexPid = btoa('Alex');
    const secretSantaDB = new SecretSantaDB(sampleContent, alexPid);

    const state = createGameState({
      giveUpSorry: true,
      secretSantaDB,
    });

    expect(state.worldFadedToBlack).toBe(true);
    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.unclosable).toBe(true);
    expect(state.activeDialogue?.lines).toEqual([
      "Give up huh? Don't feel bad... Your secret santa gift receiver is...",
      'Arjan',
    ]);
    expect(state.activeDialogue?.currentIndex).toBe(0);

    // Advance to final line
    const input = createEmptyInput();
    advanceDialogue(state, input);
    expect(state.activeDialogue?.currentIndex).toBe(1);
    expect(state.activeDialogue?.lines[1]).toBe('Arjan');

    // Attempting to advance beyond final line must remain unclosable
    advanceDialogue(state, input);
    expect(state.activeDialogue).not.toBeNull();
    expect(state.activeDialogue?.currentIndex).toBe(1);

    // Test fallback when receiver is unknown
    const dbUnknown = new SecretSantaDB(sampleContent, null);
    const stateUnknown = createGameState({
      giveUpSorry: true,
      secretSantaDB: dbUnknown,
    });
    expect(stateUnknown.activeDialogue?.lines[1]).toBe(
      'Ehm... this is awkward. An error occurred, gift receiver unknown.'
    );
  });

  it('supports WASD movement and camera-relative 3D movement when cameraYaw is active', () => {
    const state = createGameState();
    const input = createEmptyInput();

    // Verify WASD and E/Space key bindings
    expect(applyKeyEvent(input, 'KeyW', true)).toBe(true);
    expect(input.up).toBe(true);
    expect(applyKeyEvent(input, 'KeyW', false)).toBe(true);
    expect(input.up).toBe(false);

    expect(applyKeyEvent(input, 'KeyS', true)).toBe(true);
    expect(input.down).toBe(true);
    applyKeyEvent(input, 'KeyS', false);

    expect(applyKeyEvent(input, 'KeyA', true)).toBe(true);
    expect(input.left).toBe(true);
    applyKeyEvent(input, 'KeyA', false);

    expect(applyKeyEvent(input, 'KeyD', true)).toBe(true);
    expect(input.right).toBe(true);
    applyKeyEvent(input, 'KeyD', false);

    expect(applyKeyEvent(input, 'Space', true)).toBe(true);
    expect(input.action).toBe(true);
    expect(input.actionJustPressed).toBe(true);
    applyKeyEvent(input, 'Space', false);
    input.actionJustPressed = false;

    // When cameraYaw = 0 (looking East / +X), pressing W (up) moves Santa East (+X),
    // and pressing D (right) strafes South (+Y)
    const startX = state.player.x;
    const startY = state.player.y;
    input.cameraYaw = 0;
    applyKeyEvent(input, 'KeyW', true);
    updateGameState(state, input, 0.1);
    expect(state.player.x).toBeGreaterThan(startX);
    expect(Math.abs(state.player.y - startY)).toBeLessThan(0.01);
    expect(state.player.facing).toBe('right');
    applyKeyEvent(input, 'KeyW', false);

    // Strafing right (D) while looking East (cameraYaw = 0) moves South (+Y)
    const afterEastY = state.player.y;
    applyKeyEvent(input, 'KeyD', true);
    updateGameState(state, input, 0.1);
    expect(state.player.y).toBeGreaterThan(afterEastY);
    expect(state.player.facing).toBe('down');
    applyKeyEvent(input, 'KeyD', false);
  });

  it('models sloped outdoor terrain and behind-the-back 3D camera following Santa', () => {
    // Outdoor terrain slopes upward from south driveway toward main house, guest cottages, and north ridge
    const southDrivewayH = getTerrainHeight(232, 416, 'level-outside');
    const midDrivewayH = getTerrainHeight(232, 260, 'level-outside');
    const mainHousePadH = getTerrainHeight(168, 104, 'level-outside');
    const guestCottagePadH = getTerrainHeight(432, 112, 'level-outside');
    const northRidgeH = getTerrainHeight(168, 24, 'level-outside');

    expect(midDrivewayH).toBeGreaterThan(southDrivewayH);
    expect(mainHousePadH).toBeGreaterThan(midDrivewayH);
    expect(guestCottagePadH).toBeGreaterThan(mainHousePadH);
    expect(northRidgeH).toBeGreaterThan(mainHousePadH);

    // Indoor levels have flat 0 base terrain height and upward normal (0, 1, 0)
    expect(getTerrainHeight(160, 160, 'level-basement')).toBe(0);
    expect(getTerrainNormal(160, 160, 'level-basement')).toEqual({ x: 0, y: 1, z: 0 });

    const outNormal = getTerrainNormal(232, 300, 'level-outside');
    expect(outNormal.y).toBeGreaterThan(0.8);
    expect(Math.hypot(outNormal.x, outNormal.y, outNormal.z)).toBeCloseTo(1, 4);

    // Behind-the-back 3D camera positions eye behind Santa along -cameraYaw and projects Santa on screen
    const state = createGameState();
    const input = createEmptyInput();
    input.cameraYaw = -Math.PI / 2; // Looking North (-Z)
    input.cameraPitch = 0.42;

    const cam = createCamera3D();
    updateCamera3D(cam, state, input, 0.016, 256 / 224);

    const playerCenterZ = state.player.y + state.player.height / 2;
    // Camera eye should be South (+Z) and elevated (+Y) behind Santa's back when looking North
    expect(cam.eye.z).toBeGreaterThan(playerCenterZ);
    expect(cam.eye.y).toBeGreaterThan(getPlayerElevation(state));

    const screenPt = projectWorldToScreen(
      {
        x: state.player.x + state.player.width / 2,
        y: getPlayerElevation(state) + 8,
        z: playerCenterZ,
      },
      cam.viewProjMatrix,
      256,
      224
    );
    expect(screenPt.visible).toBe(true);
    expect(screenPt.x).toBeGreaterThan(60);
    expect(screenPt.x).toBeLessThan(196);
  });

  it('builds 3D Wind Waker meshes and procedural texture atlas for all game levels and entities', () => {
    const atlas = getProceduralTextureAtlas();
    expect(atlas.width).toBe(ATLAS_WIDTH);
    expect(atlas.height).toBe(ATLAS_HEIGHT);
    expect(atlas.data.byteLength).toBe(ATLAS_WIDTH * ATLAS_HEIGHT * 4);

    const levelIds = [
      'level-outside',
      'level-basement',
      'level-upstairs',
      'level-people',
    ] as const;

    for (const levelId of levelIds) {
      const state = createGameState({ initialLevelId: levelId });
      const staticMesh = getStaticLevelMesh(levelId, state.map);
      expect(staticMesh.vertexCount).toBeGreaterThan(100);
      expect(staticMesh.vertexCount % 3).toBe(0);
      expect(staticMesh.vertices.length).toBe(
        staticMesh.vertexCount * FLOATS_PER_VERTEX
      );

      const dyn = buildDynamicSceneMeshes(state);
      expect(dyn.opaque.vertexCount).toBeGreaterThan(30);
      expect(dyn.opaque.vertexCount % 3).toBe(0);
    }
  });

  it('turns the 3D camera with arrow keys when cameraYaw is active', () => {
    const state = createGameState();
    const input = createEmptyInput();
    input.cameraYaw = -Math.PI / 2;
    input.cameraPitch = 0.42;

    const cam = createCamera3D();
    updateCamera3D(cam, state, input, 0.016, 256 / 224);

    const initialYaw = input.cameraYaw;
    applyKeyEvent(input, 'ArrowRight', true);
    expect(input.camRight).toBe(true);
    expect(input.right).toBe(false);
    updateCamera3D(cam, state, input, 0.25, 256 / 224);
    expect(input.cameraYaw).toBeGreaterThan(initialYaw);
    applyKeyEvent(input, 'ArrowRight', false);

    const initialPitch = input.cameraPitch;
    applyKeyEvent(input, 'ArrowDown', true);
    expect(input.camDown).toBe(true);
    updateCamera3D(cam, state, input, 0.25, 256 / 224);
    expect(input.cameraPitch).toBeGreaterThan(initialPitch);
    applyKeyEvent(input, 'ArrowDown', false);
  });

  it('shortens 3D camera distance using a temporary LineOfSight when an obstacle is between camera and player', () => {
    const state = createGameState({ initialLevelId: 'level-outside', showIntroDialogue: false });
    const input = createEmptyInput();
    const cam = createCamera3D();

    // Unobstructed driveway behind Santa (middle of driveway looking North): full 52 distance
    state.player.x = 14 * TILE_SIZE;
    state.player.y = 18 * TILE_SIZE;
    input.cameraYaw = -Math.PI / 2;
    input.cameraPitch = 0.42;
    updateCamera3D(cam, state, input, 0.016, 256 / 224);
    expect(cam.distance).toBeCloseTo(52, 0);

    // Place Santa right in front of the main house south wall (row 10, facing South so house is directly behind him)
    state.player.x = 10 * TILE_SIZE;
    state.player.y = 11 * TILE_SIZE + 4;
    input.cameraYaw = Math.PI / 2; // Looking South; camera is to the North (inside the house footprint!)
    updateCamera3D(cam, state, input, 0.016, 256 / 224);
    expect(cam.distance).toBeGreaterThanOrEqual(0);
    expect(cam.distance).toBeLessThan(30);

    // Turn camera back to look North (camera is to the South, open terrace/driveway): distance returns to full 52
    input.cameraYaw = -Math.PI / 2;
    updateCamera3D(cam, state, input, 0.016, 256 / 224);
    expect(cam.distance).toBeCloseTo(52, 0);

    // Even when backed directly against a wall so effectiveDistance is 0, camera still aims forward (not down at the ground)
    state.player.x = 10 * TILE_SIZE;
    state.player.y = 10 * TILE_SIZE + 1; // Flush against main house south wall
    input.cameraYaw = Math.PI / 2; // Looking South, wall immediately behind
    input.cameraPitch = 0.42;
    updateCamera3D(cam, state, input, 0.016, 256 / 224);
    const lookDx = cam.target.x - cam.eye.x;
    const lookDy = cam.target.y - cam.eye.y;
    const lookDz = cam.target.z - cam.eye.z;
    const lookLen = Math.hypot(lookDx, lookDy, lookDz);
    expect(lookLen).toBeGreaterThan(1);
    // Looking South (+Z): horizontal forward component (lookDz / lookLen) must be strongly positive (~cos(0.42) = 0.91)
    expect(lookDz / lookLen).toBeCloseTo(Math.cos(0.42), 2);
    expect(lookDy / lookLen).toBeCloseTo(-Math.sin(0.42), 2);

    // Standing with a wall ~11px to the right while holding a weapon does not collapse camera distance to 0
    state.player.equippedItem = 'uzi';
    state.player.x = 10 * TILE_SIZE;
    state.player.y = 10 * TILE_SIZE + 5; // Wall is to the North (-Z), 11px from player center
    input.cameraYaw = Math.PI; // Facing West (-X) -> right shoulder is North (-Z) toward the house wall, behind is East (+X, open)
    updateCamera3D(cam, state, input, 1.0, 256 / 224);
    expect(cam.distance).toBeGreaterThan(15);
  });

  it('builds 2-tile-high indoor walls with ceilings and keeps indoor camera under the ceiling', () => {
    expect(INDOOR_WALL_HEIGHT).toBe(2 * TILE_SIZE);

    for (const levelId of [
      'level-basement',
      'level-upstairs',
      'level-people',
    ] as const) {
      const state = createGameState({
        initialLevelId: levelId,
        showIntroDialogue: false,
      });
      const mesh = getStaticLevelMesh(levelId, state.map);
      expect(mesh.vertexCount).toBeGreaterThan(0);

      let maxY = -Infinity;
      for (let i = 0; i < mesh.vertexCount; i++) {
        const y = mesh.vertices[i * FLOATS_PER_VERTEX + 1];
        if (y > maxY) maxY = y;
      }
      expect(maxY).toBeGreaterThanOrEqual(INDOOR_WALL_HEIGHT);

      if (levelId !== 'level-people') {
        const cam = createCamera3D();
        const input = createEmptyInput();
        input.cameraPitch = 1.1;
        updateCamera3D(cam, state, input, 0.016, 256 / 224);
        expect(cam.eye.y).toBeLessThan(INDOOR_WALL_HEIGHT);
      }
    }
  });

  it('jumps half a tile on Space when no interactable or dialogue is active and lands smoothly', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();

    // Verify no interactable is active at start on the driveway
    updateGameState(state, input, 0.016);
    expect(state.nearbyInteractable).toBeNull();
    expect(state.player.jumpOffset ?? 0).toBe(0);

    // Press Space -> triggers a half-tile jump (PLAYER_JUMP_HEIGHT = 8)
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.016);
    applyKeyEvent(input, 'Space', false);
    expect(state.player.jumpOffset).toBeGreaterThan(0);

    // Cannot double-jump mid-air
    expect(triggerPlayerJump(state.player)).toBe(false);

    let maxJumpOffset = 0;
    for (let i = 0; i < 30; i++) {
      updateGameState(state, input, 0.02);
      maxJumpOffset = Math.max(maxJumpOffset, state.player.jumpOffset ?? 0);
    }
    expect(maxJumpOffset).toBeCloseTo(PLAYER_JUMP_HEIGHT, 0);
    expect(state.player.jumpOffset).toBe(0);
  });

  it('supports free 2D roof walking with pitched height and falling off the roof edge', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();

    // Place Santa on the roof at the ladder top (col 4, row 9)
    expect(ROOF_LADDER_BOUNDS.y).toBe(9 * TILE_SIZE);
    state.isOnRoof = true;
    state.player.x = 10 * TILE_SIZE;
    state.player.y = 9 * TILE_SIZE;

    // Pitched height is higher near the ridge center (row 6-7) than at south eaves (row 9)
    const southEdgeY = getPlayerElevation(state);
    input.up = true;
    for (let i = 0; i < 16; i++) {
      updateGameState(state, input, 0.04);
    }
    input.up = false;
    expect(state.isOnRoof).toBe(true);
    expect(state.player.y).toBeLessThan(7 * TILE_SIZE);
    const ridgeY = getPlayerElevation(state);
    expect(ridgeY).toBeGreaterThan(southEdgeY + 8);
    expect(ridgeY).toBeCloseTo(
      getMainHouseRoofElevation(
        state.player.x + state.player.width * 0.5,
        state.player.y + state.player.height * 0.5
      ),
      2
    );

    // Chimneys still have a solid core on the roof
    state.player.x = ROOF_CHIMNEY_BOUNDS.x - state.player.width - 1;
    state.player.y = ROOF_CHIMNEY_BOUNDS.y + 4;
    input.right = true;
    updateGameState(state, input, 0.2);
    input.right = false;
    expect(state.player.x).toBeLessThanOrEqual(ROOF_CHIMNEY_BOUNDS.x + 3);

    // Walking off the west edge of the roof exits isOnRoof, falls via jumpOffset, and re-enables house collision
    state.player.x = MAIN_HOUSE_ROOF_BOUNDS.x + 1;
    state.player.y = 7 * TILE_SIZE;
    input.left = true;
    updateGameState(state, input, 0.2);
    input.left = false;
    expect(state.isOnRoof).toBe(false);
    expect(state.player.x).toBeLessThan(MAIN_HOUSE_ROOF_BOUNDS.x);
    expect(state.player.jumpOffset).toBeGreaterThan(10);
  });

  it('smoothly turns player renderYaw and rotates Dog and Cat models to face their velocity', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();
    state.player.yaw = -Math.PI / 2;
    state.player.renderYaw = -Math.PI / 2;

    // Turning East from North interpolates renderYaw gradually rather than snapping immediately
    input.right = true;
    updateGameState(state, input, 0.016);
    expect(state.player.yaw).toBeCloseTo(0, 4);
    expect(state.player.renderYaw).toBeGreaterThan(-Math.PI / 2);
    expect(state.player.renderYaw).toBeLessThan(0);

    for (let i = 0; i < 20; i++) {
      updateGameState(state, input, 0.05);
    }
    input.right = false;
    expect(state.player.renderYaw).toBeCloseTo(0, 2);

    // Dog facing direction aligns with its velocity vector when chasing
    const dogPlayer = createPlayer(DOG_START_X - 32, DOG_START_Y + 24);
    updateDog(state.dog, dogPlayer, 0.25, state.map, []);
    expect(Math.hypot(state.dog.vx, state.dog.vy)).toBeGreaterThan(1);
    expect(state.dog.yaw).toBeCloseTo(
      Math.atan2(state.dog.vy, state.dog.vx),
      4
    );

    // Cat facing direction aligns with its velocity vector when fleeing
    const upstairs = state.levels['level-upstairs'] as LevelUpstairs;
    const cat = createCat(CAT_START_X, CAT_START_Y);
    const catChaser = createPlayer(
      EXTRA_ROOM_BOUNDS.x + 2 * TILE_SIZE,
      EXTRA_ROOM_BOUNDS.y + 4 * TILE_SIZE
    );
    updateCat(cat, catChaser, 0.25, upstairs.map, []);
    expect(Math.hypot(cat.vx, cat.vy)).toBeGreaterThan(1);
    expect(cat.yaw).toBeCloseTo(Math.atan2(cat.vy, cat.vx), 4);
  });

  it('allows LineOfSight camera points past map boundaries while blocking player movement at boundaries', () => {
    // LineOfSight points outside map bounds are NOT flagged as colliding when collideWithMapBoundary=false
    expect(
      isRectCollidingWithMap(STARTER_MAP, 15 * TILE_SIZE, MAP_ROWS * TILE_SIZE + 8, 8, 8, false)
    ).toBe(false);
    expect(
      isRectCollidingWithMap(STARTER_MAP, 15 * TILE_SIZE, MAP_ROWS * TILE_SIZE + 8, 8, 8, true)
    ).toBe(true);

    // Player at southern road edge is blocked by map boundary
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();
    state.player.x = 15 * TILE_SIZE;
    state.player.y = (MAP_ROWS - 1) * TILE_SIZE;
    input.down = true;
    updateGameState(state, input, 0.5);
    input.down = false;
    expect(state.player.y).toBeLessThanOrEqual(
      MAP_ROWS * TILE_SIZE - state.player.height + 0.01
    );

    // Looking North from the south edge places camera points south of the map boundary,
    // and computeUnobstructedCameraDistance preserves full distance instead of collapsing
    const camDist = computeUnobstructedCameraDistance(
      state.player.x + state.player.width * 0.5,
      state.player.y + state.player.height * 0.5,
      -Math.PI / 2,
      0.38,
      52,
      STARTER_MAP
    );
    expect(camDist).toBeCloseTo(52, 0);
  });

  it('points camera East on the motorcycle and zooms toward north window during Rosanna cutscene', () => {
    // 1. Motorcycle camera faces East (0) when driving
    const outState = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();
    const cam = createCamera3D();
    outState.player.x = MOTORCYCLE_START_X + 4;
    outState.player.y = MOTORCYCLE_START_Y - outState.player.height - 2;
    updateGameState(outState, input, 0.01);
    applyKeyEvent(input, 'Space', true);
    updateGameState(outState, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(outState.motorcycle.status).toBe('driving');

    input.cameraYaw = -Math.PI / 2;
    for (let i = 0; i < 15; i++) {
      updateCamera3D(cam, outState, input, 0.05, 256 / 224);
    }
    expect(input.cameraYaw).toBeCloseTo(0, 1);

    // 2. Rosanna cutscene turns camera North (-Math.PI / 2) and narrows fovY to zoom in
    const upState = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const upCam = createCamera3D();
    const upInput = createEmptyInput();
    upInput.cameraYaw = Math.PI / 2; // initially looking south away from window
    upState.player.x = 13 * TILE_SIZE;
    upState.player.y = KITCHEN_TRIGGER_BOUNDS.y + 8;
    updateGameState(upState, upInput, 0.05);
    expect((upState.levels['level-upstairs'] as LevelUpstairs).rosannaCutscene?.active).toBe(true);

    for (let i = 0; i < 18; i++) {
      updateGameState(upState, upInput, 0.05);
      updateCamera3D(upCam, upState, upInput, 0.05, 256 / 224);
    }
    const cs = (upState.levels['level-upstairs'] as LevelUpstairs).rosannaCutscene!;
    expect(cs.active).toBe(true);
    const expectedWindowYaw = Math.atan2(
      4.0 * TILE_SIZE - (upState.player.y + upState.player.height * 0.5),
      cs.santaX + 8 - (upState.player.x + upState.player.width * 0.5)
    );
    expect(upInput.cameraYaw).toBeCloseTo(expectedWindowYaw, 1);
    expect(upCam.fovY).toBeLessThan((40 * Math.PI) / 180);

    // Santa is rendered at 25% transparency during the Rosanna zoom cutscene even at normal camera distance
    const dynRosanna = buildDynamicSceneMeshes(upState, 38);
    const rosannaAlphas = new Set<number>();
    for (let i = 0; i < dynRosanna.translucent.vertexCount; i++) {
      rosannaAlphas.add(
        Math.round(dynRosanna.translucent.vertices[i * FLOATS_PER_VERTEX + 11] * 100) / 100
      );
    }
    expect(rosannaAlphas.has(0.25)).toBe(true);

    // 3. Basement bathroom toilet cutscene zooms in toward toiletNpc with 25% transparent Santa
    const baseState = createGameState({
      initialLevelId: 'level-basement',
      showIntroDialogue: false,
    });
    const baseCam = createCamera3D();
    const baseInput = createEmptyInput();
    baseInput.cameraYaw = Math.PI / 2; // initially facing away (south)
    baseState.player.x = BASEMENT_BATHROOM_DOOR_BOUNDS.x + 2;
    baseState.player.y = BASEMENT_BATHROOM_DOOR_BOUNDS.y + TILE_SIZE + 1;
    updateGameState(baseState, baseInput, 0.01);
    applyKeyEvent(baseInput, 'Space', true);
    updateGameState(baseState, baseInput, 0.01);
    applyKeyEvent(baseInput, 'Space', false);
    const basement = baseState.levels['level-basement'] as LevelBasement;
    expect(basement.toiletCutscene?.active).toBe(true);

    for (let i = 0; i < 20; i++) {
      updateGameState(baseState, baseInput, 0.05);
      updateCamera3D(baseCam, baseState, baseInput, 0.05, 256 / 224);
    }
    const px = baseState.player.x + baseState.player.width * 0.5;
    const pz = baseState.player.y + baseState.player.height * 0.5;
    const tx = basement.toiletNpc.x + basement.toiletNpc.width * 0.5;
    const tz = basement.toiletNpc.y + basement.toiletNpc.height * 0.5;
    expect(baseInput.cameraYaw).toBeCloseTo(Math.atan2(tz - pz, tx - px), 1);
    expect(baseCam.fovY).toBeLessThan((40 * Math.PI) / 180);

    const dynToilet = buildDynamicSceneMeshes(baseState, 38);
    const toiletAlphas = new Set<number>();
    for (let i = 0; i < dynToilet.translucent.vertexCount; i++) {
      toiletAlphas.add(
        Math.round(dynToilet.translucent.vertices[i * FLOATS_PER_VERTEX + 11] * 100) / 100
      );
    }
    expect(toiletAlphas.has(0.25)).toBe(true);
  });

  it('keeps outdoor bushes, trees, and wooden patio table solid to movement without blocking camera distance', () => {
    // Verify Thuja (row 13, col 12), Hedge (row 12, col 5..6), PatioTable (row 14..15, col 7..8), Tree (row 0..2)
    expect(STARTER_MAP.tiles[13][12]).toBe(TileType.Thuja);
    expect(STARTER_MAP.tiles[12][5]).toBe(TileType.Hedge);
    expect(STARTER_MAP.tiles[14][7]).toBe(TileType.PatioTable);
    expect(STARTER_MAP.tiles[2][5]).toBe(TileType.Tree);

    // All four remain solid for player collision
    expect(isRectCollidingWithMap(STARTER_MAP, 12 * TILE_SIZE + 2, 13 * TILE_SIZE + 2, 12, 12, true)).toBe(true);
    expect(isRectCollidingWithMap(STARTER_MAP, 5 * TILE_SIZE + 2, 12 * TILE_SIZE + 2, 12, 12, true)).toBe(true);
    expect(isRectCollidingWithMap(STARTER_MAP, 7 * TILE_SIZE + 2, 14 * TILE_SIZE + 2, 12, 12, true)).toBe(true);

    // Camera behind Santa passing through Thuja/Hedge/PatioTable does NOT shorten distance
    // Santa at driveway (col 13.5, row 13.5) facing East (camera behind him to the West, through Thuja at col 12)
    const thujaCamDist = computeUnobstructedCameraDistance(
      13.5 * TILE_SIZE,
      13.5 * TILE_SIZE,
      0,
      0.38,
      52,
      STARTER_MAP
    );
    expect(thujaCamDist).toBeGreaterThan(48);

    // Santa just south of PatioTable (col 7.5, row 16.2) facing South (camera behind him to the North, through PatioTable at rows 14..15)
    const tableCamDist = computeUnobstructedCameraDistance(
      7.5 * TILE_SIZE,
      16.2 * TILE_SIZE,
      Math.PI / 2,
      0.38,
      52,
      STARTER_MAP
    );
    expect(tableCamDist).toBeGreaterThan(48);

    // Santa just north of Hedge (col 5.5, row 11.2) facing North (camera behind him to the South, through Hedge at row 12)
    const hedgeCamDist = computeUnobstructedCameraDistance(
      5.5 * TILE_SIZE,
      11.2 * TILE_SIZE,
      -Math.PI / 2,
      0.38,
      52,
      STARTER_MAP
    );
    expect(hedgeCamDist).toBeGreaterThan(48);
  });

  it('renders close-camera Santa at 25% opacity, animates opened doors, and checks NPC/stairwell updates', () => {
    // 1. Close-camera Santa alpha = 0.25 in translucent mesh
    const state = createGameState({ showIntroDialogue: false });
    const dynClose = buildDynamicSceneMeshes(state, TILE_SIZE * 0.5);
    const closeAlphas = new Set<number>();
    for (let i = 0; i < dynClose.translucent.vertexCount; i++) {
      closeAlphas.add(
        Math.round(dynClose.translucent.vertices[i * FLOATS_PER_VERTEX + 11] * 100) / 100
      );
    }
    expect(closeAlphas.has(0.25)).toBe(true);

    // 2. Spawn/NPC orientations updated
    expect(BASEMENT_FIREPLACE_SPAWN.facing).toBe('down');
    expect(OUTSIDE_ALEX_NPC.facing).toBe('left');

    // 3. Door swing animation progresses when an indoor door opens
    const baseState = createGameState({
      initialLevelId: 'level-basement',
      showIntroDialogue: false,
    });
    const basement = baseState.levels['level-basement'] as LevelBasement;
    const input = createEmptyInput();
    baseState.player.x = BASEMENT_BATHROOM_DOOR_BOUNDS.x + 2;
    baseState.player.y = BASEMENT_BATHROOM_DOOR_BOUNDS.y + TILE_SIZE + 1;
    updateGameState(baseState, input, 0.01);
    applyKeyEvent(input, 'Space', true);
    updateGameState(baseState, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(basement.openedDoors.length).toBe(1);
    expect(basement.openedDoors[0].progress).toBeLessThan(1);
    updateGameState(baseState, input, 0.5);
    expect(basement.openedDoors[0].progress).toBe(1);

    // 4. Upstairs stairwell cutout exposes stairs descending below floor (y < -5)
    const upState = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const upMesh = getStaticLevelMesh('level-upstairs', upState.map);
    let hasStairwellBelowFloor = false;
    for (let i = 0; i < upMesh.vertexCount; i++) {
      const vx = upMesh.vertices[i * FLOATS_PER_VERTEX + 0];
      const vy = upMesh.vertices[i * FLOATS_PER_VERTEX + 1];
      const vz = upMesh.vertices[i * FLOATS_PER_VERTEX + 2];
      if (
        vx >= 15 * TILE_SIZE &&
        vx <= 19 * TILE_SIZE &&
        vz >= 14 * TILE_SIZE &&
        vz <= 18 * TILE_SIZE &&
        vy < -5
      ) {
        hasStairwellBelowFloor = true;
        break;
      }
    }
    expect(hasStairwellBelowFloor).toBe(true);
  });

  it('guarantees outward CCW triangle winding, strips non-outlined static triangles, and renders via WebGL3DRenderer for iOS', () => {
    const state = createGameState({ showIntroDialogue: false });
    const staticMesh = getStaticLevelMesh('level-outside', state.map);
    const outlineMesh = extractOutlineMesh(staticMesh);

    // 1. Filtered outline mesh strips non-outlined terrain/floor triangles
    expect(outlineMesh.vertexCount).toBeGreaterThan(0);
    expect(outlineMesh.vertexCount).toBeLessThan(staticMesh.vertexCount);

    // 2. Every triangle in static and dynamic meshes has outward CCW winding ((p1 - p0) x (p2 - p0)) . N >= 0
    const verifyCCWWinding = (verts: Float32Array, vertexCount: number) => {
      let invertedCount = 0;
      for (let i = 0; i < vertexCount; i += 3) {
        const b0 = i * FLOATS_PER_VERTEX;
        const b1 = (i + 1) * FLOATS_PER_VERTEX;
        const b2 = (i + 2) * FLOATS_PER_VERTEX;
        const ux = verts[b1] - verts[b0];
        const uy = verts[b1 + 1] - verts[b0 + 1];
        const uz = verts[b1 + 2] - verts[b0 + 2];
        const vx = verts[b2] - verts[b0];
        const vy = verts[b2 + 1] - verts[b0 + 1];
        const vz = verts[b2 + 2] - verts[b0 + 2];
        const cx = uy * vz - uz * vy;
        const cy = uz * vx - ux * vz;
        const cz = ux * vy - uy * vx;
        const nx = verts[b0 + 3] + verts[b1 + 3] + verts[b2 + 3];
        const ny = verts[b0 + 4] + verts[b1 + 4] + verts[b2 + 4];
        const nz = verts[b0 + 5] + verts[b1 + 5] + verts[b2 + 5];
        if (cx * nx + cy * ny + cz * nz < -1e-5) {
          invertedCount++;
        }
      }
      return invertedCount;
    };

    const dynMeshes = buildDynamicSceneMeshes(state, 52);
    expect(verifyCCWWinding(staticMesh.vertices, staticMesh.vertexCount)).toBe(0);
    expect(verifyCCWWinding(dynMeshes.opaque.vertices, dynMeshes.opaque.vertexCount)).toBe(0);

    // 3. WebGL3DRenderer initializes and executes 3-pass Wind Waker cel + outline + translucent rendering
    const drawCalls: number[] = [];
    const cullModes: number[] = [];
    const mockGL: Record<string, unknown> = {
      VERTEX_SHADER: 0x8b31,
      FRAGMENT_SHADER: 0x8b30,
      COMPILE_STATUS: 0x8b81,
      LINK_STATUS: 0x8b82,
      TEXTURE_2D: 0x0de1,
      TEXTURE0: 0x84c0,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      UNPACK_FLIP_Y_WEBGL: 0x9240,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      CLAMP_TO_EDGE: 0x812f,
      LINEAR: 0x2601,
      ARRAY_BUFFER: 0x8892,
      STATIC_DRAW: 0x88e4,
      DYNAMIC_DRAW: 0x88e8,
      FLOAT: 0x1406,
      DEPTH_TEST: 0x0b71,
      LEQUAL: 0x0203,
      COLOR_BUFFER_BIT: 0x4000,
      DEPTH_BUFFER_BIT: 0x0100,
      BLEND: 0x0be2,
      CULL_FACE: 0x0b44,
      CCW: 0x0901,
      FRONT: 0x0404,
      SRC_ALPHA: 0x0302,
      ONE_MINUS_SRC_ALPHA: 0x0303,
      TRIANGLES: 0x0004,
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      deleteShader: () => {},
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      deleteProgram: () => {},
      getAttribLocation: () => 0,
      getUniformLocation: () => ({}),
      createTexture: () => ({}),
      bindTexture: () => {},
      pixelStorei: () => {},
      texImage2D: () => {},
      texParameteri: () => {},
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      bufferSubData: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      viewport: () => {},
      clearColor: () => {},
      clearDepth: () => {},
      enable: () => {},
      disable: () => {},
      depthFunc: () => {},
      depthMask: () => {},
      clear: () => {},
      useProgram: () => {},
      activeTexture: () => {},
      uniform1i: () => {},
      uniformMatrix4fv: () => {},
      uniform4f: () => {},
      frontFace: () => {},
      cullFace: (mode: number) => {
        cullModes.push(mode);
      },
      blendFunc: () => {},
      drawArrays: (_mode: number, _first: number, count: number) => {
        drawCalls.push(count);
      },
    };

    const mockCanvas = {
      width: 640,
      height: 560,
      getContext: (type: string) => (type === 'webgl2' ? mockGL : null),
    } as unknown as HTMLCanvasElement;

    const webglRenderer = WebGL3DRenderer.create(mockCanvas);
    expect(webglRenderer).not.toBeNull();
    const cam = createCamera3D();
    updateCamera3D(cam, state, createEmptyInput(), 0.016);
    const viewProj = webglRenderer!.render(state, cam);
    expect(viewProj.length).toBe(16);
    expect(drawCalls.length).toBe(5); // 2 opaque + 2 outline + 1 translucent
    expect(cullModes).toContain(0x0404); // gl.FRONT culled in Pass 2
  });

  it('turns 3D camera left/right from virtual joystick X and moves Santa forward/backward from Y without affecting camera pitch', () => {
    const state = createGameState({ isMobile: true, showIntroDialogue: false });
    const input = createEmptyInput();
    input.cameraYaw = -Math.PI / 2; // Facing North (-Y)
    input.cameraPitch = 0.38;
    const cam = createCamera3D();

    // 1. Joystick pushed strictly right (moveVector.x = 1, moveVector.y = 0): turns camera right, Santa stays still
    const startX = state.player.x;
    const startY = state.player.y;
    input.moveVector = { x: 1, y: 0 };
    updateGameState(state, input, 0.25);
    updateCamera3D(cam, state, input, 0.25);
    expect(state.player.x).toBeCloseTo(startX, 5);
    expect(state.player.y).toBeCloseTo(startY, 5);
    expect(input.cameraYaw).toBeGreaterThan(-Math.PI / 2);
    expect(input.cameraPitch).toBeCloseTo(0.38, 5);

    // 2. Joystick pushed strictly left (moveVector.x = -1, moveVector.y = 0): turns camera left
    const yawAfterRight = input.cameraYaw!;
    input.moveVector = { x: -1, y: 0 };
    updateGameState(state, input, 0.25);
    updateCamera3D(cam, state, input, 0.25);
    expect(input.cameraYaw).toBeLessThan(yawAfterRight);
    expect(input.cameraPitch).toBeCloseTo(0.38, 5);

    // 3. Joystick pushed strictly up (moveVector.x = 0, moveVector.y = -1): moves Santa forward along cameraYaw, camera unchanged
    const yawBeforeUp = input.cameraYaw!;
    const yBeforeUp = state.player.y;
    input.moveVector = { x: 0, y: -1 };
    updateGameState(state, input, 0.2);
    updateCamera3D(cam, state, input, 0.2);
    expect(state.player.y).toBeLessThan(yBeforeUp);
    expect(input.cameraYaw).toBeCloseTo(yawBeforeUp, 5);
    expect(input.cameraPitch).toBeCloseTo(0.38, 5);

    // 4. Joystick pushed strictly down (moveVector.x = 0, moveVector.y = 1): moves Santa backward along cameraYaw, camera unchanged
    const yBeforeDown = state.player.y;
    input.moveVector = { x: 0, y: 1 };
    updateGameState(state, input, 0.2);
    updateCamera3D(cam, state, input, 0.2);
    expect(state.player.y).toBeGreaterThan(yBeforeDown);
    expect(input.cameraYaw).toBeCloseTo(yawBeforeUp, 5);
    expect(input.cameraPitch).toBeCloseTo(0.38, 5);
  });

  it('supports dual joysticks in mobile landscape mode with simultaneous multi-touch pointer IDs', () => {
    // 1. Landscape layout positions identical-sized left and right joysticks symmetrically
    const layout = computeViewportLayout(844, 390);
    expect(layout.isLandscape).toBe(true);
    expect(layout.joystickSize).toBe(195);
    expect(layout.leftJoystickLeft).toBe(0);
    expect(layout.leftJoystickTop).toBe(Math.round((390 - 195) / 2));
    expect(layout.joystickLeft).toBe(844 - 195);
    expect(layout.joystickTop).toBe(Math.round((390 - 195) / 2));

    // 2. Simultaneous multi-touch on left (move, pointerId 1) and right (camera, pointerId 2)
    const input = createEmptyInput();
    input.dualJoystickMode = true;
    input.cameraYaw = -Math.PI / 2;
    input.cameraPitch = 0.38;

    const leftListeners: Record<string, (e: unknown) => void> = {};
    const rightListeners: Record<string, (e: unknown) => void> = {};
    const winListeners: Record<string, Array<(e: unknown) => void>> = {
      pointermove: [],
      pointerup: [],
      pointercancel: [],
    };
    const mockWindow = {
      addEventListener: (evt: string, cb: (e: unknown) => void) => {
        winListeners[evt]?.push(cb);
      },
      removeEventListener: () => {},
    } as unknown as EventTarget;

    const leftContainer = {
      getBoundingClientRect: () => ({ left: 0, top: 100, width: 200, height: 200 }),
      addEventListener: (evt: string, cb: (e: unknown) => void) => {
        leftListeners[evt] = cb;
      },
      removeEventListener: () => {},
      style: { display: 'none' },
    } as unknown as HTMLElement;
    const leftStick = { style: { transform: '' } } as unknown as HTMLElement;

    const rightContainer = {
      getBoundingClientRect: () => ({ left: 600, top: 100, width: 200, height: 200 }),
      addEventListener: (evt: string, cb: (e: unknown) => void) => {
        rightListeners[evt] = cb;
      },
      removeEventListener: () => {},
      style: { display: 'none' },
    } as unknown as HTMLElement;
    const rightStick = { style: { transform: '' } } as unknown as HTMLElement;

    const leftController = createVirtualJoystick({
      container: leftContainer,
      stick: leftStick,
      input,
      role: 'move',
      targetWindow: mockWindow,
    });
    const rightController = createVirtualJoystick({
      container: rightContainer,
      stick: rightStick,
      input,
      role: 'camera',
      targetWindow: mockWindow,
    });

    leftController.show();
    rightController.show();

    // Touch down simultaneously on left stick (right/east strafe) and right stick (right camera turn)
    leftListeners['pointerdown']?.({
      pointerId: 1,
      clientX: 172,
      clientY: 200,
      preventDefault: () => {},
    });
    rightListeners['pointerdown']?.({
      pointerId: 2,
      clientX: 772,
      clientY: 200,
      preventDefault: () => {},
    });

    expect(leftController.isPointerActive()).toBe(true);
    expect(rightController.isPointerActive()).toBe(true);
    expect(input.moveVector?.x).toBeCloseTo(1.0, 2);
    expect(input.cameraLookVector?.x).toBeCloseTo(1.0, 2);

    // Move pointer 1 (left thumb) while pointer 2 stays held; right stick must remain untouched
    for (const cb of winListeners.pointermove) {
      cb({ pointerId: 1, clientX: 100, clientY: 128, preventDefault: () => {} });
    }
    expect(input.moveVector?.x).toBeCloseTo(0, 2);
    expect(input.moveVector?.y).toBeCloseTo(-1.0, 2);
    expect(input.cameraLookVector?.x).toBeCloseTo(1.0, 2);

    // Release pointer 2 (right thumb) while pointer 1 stays held; moveVector must stay active
    for (const cb of winListeners.pointerup) {
      cb({ pointerId: 2, preventDefault: () => {} });
    }
    expect(rightController.isPointerActive()).toBe(false);
    expect(leftController.isPointerActive()).toBe(true);
    expect(input.cameraLookVector).toBeNull();
    expect(input.moveVector?.y).toBeCloseTo(-1.0, 2);

    // Release pointer 1 as well
    for (const cb of winListeners.pointerup) {
      cb({ pointerId: 1, preventDefault: () => {} });
    }
    expect(leftController.isPointerActive()).toBe(false);
    expect(input.moveVector).toBeNull();

    // 2b. Right (camera) joystick has a 70% deadzone in dualJoystickMode, while left (move) stays at 15%
    // maxRadius = (200 / 2) * 0.72 = 72. 60% = 43.2px (ignored on right, active on left), 80% = 57.6px (active on right)
    leftListeners['pointerdown']?.({
      pointerId: 3,
      clientX: 100 + 36, // 50% of maxRadius -> active on left
      clientY: 200,
      preventDefault: () => {},
    });
    rightListeners['pointerdown']?.({
      pointerId: 4,
      clientX: 700 + 43, // ~60% of maxRadius -> ignored on right (< 70%)
      clientY: 200,
      preventDefault: () => {},
    });
    expect(input.moveVector?.x).toBeCloseTo(0.5, 2);
    expect(input.cameraLookVector).toBeNull();

    // Move right stick to 80% of maxRadius -> now active
    for (const cb of winListeners.pointermove) {
      cb({ pointerId: 4, clientX: 700 + 58, clientY: 200, preventDefault: () => {} });
    }
    expect(input.cameraLookVector?.x).toBeGreaterThan(0.75);

    for (const cb of winListeners.pointerup) {
      cb({ pointerId: 3, preventDefault: () => {} });
      cb({ pointerId: 4, preventDefault: () => {} });
    }

    // 3. In dualJoystickMode, left joystick moves Santa relative to cameraYaw (including strafing)
    // without changing cameraYaw, while right joystick turns cameraYaw without moving Santa
    const state = createGameState({ isMobile: true, showIntroDialogue: false });
    const cam = createCamera3D();
    input.cameraYaw = -Math.PI / 2; // Facing North (-Y)
    updateCamera3D(cam, state, input, 0);
    const startX = state.player.x;
    const startY = state.player.y;

    // Strafe right + forward via left joystick only
    input.moveVector = { x: 1, y: 0 };
    input.cameraLookVector = null;
    updateGameState(state, input, 0.2);
    updateCamera3D(cam, state, input, 0.2);
    expect(state.player.x).toBeGreaterThan(startX);
    expect(state.player.y).toBeCloseTo(startY, 4);
    expect(input.cameraYaw).toBeCloseTo(-Math.PI / 2, 5);

    // Turn camera right via right joystick only
    const posXAfterStrafe = state.player.x;
    const posYAfterStrafe = state.player.y;
    input.moveVector = null;
    input.cameraLookVector = { x: 1, y: 0 };
    updateGameState(state, input, 0.2);
    updateCamera3D(cam, state, input, 0.2);
    expect(state.player.x).toBeCloseTo(posXAfterStrafe, 5);
    expect(state.player.y).toBeCloseTo(posYAfterStrafe, 5);
    expect(input.cameraYaw).toBeGreaterThan(-Math.PI / 2);
  });

  it('has a locked double door at the center porch of the outside house', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();

    // Stand directly in front of the center porch (cols 9..11, row 10)
    state.player.x = 10 * TILE_SIZE + 2;
    state.player.y = 10 * TILE_SIZE + 1;
    updateGameState(state, input, 0.01);

    expect(state.nearbyInteractable?.id).toBe('house-double-door');
    expect(state.nearbyInteractable?.promptText).toBe('Open door');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);
    expect(state.activeDialogue?.lines).toEqual(["It's locked."]);
  });

  it('tracks health, 1-second delayedHealth catch-up, 30hp/10hp damage, Game Over restart, and ?cheat immunity', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();

    expect(state.player.health).toBe(MAX_PLAYER_HEALTH);
    expect(state.player.delayedHealth).toBe(MAX_PLAYER_HEALTH);

    // 1. Motorcycle crash deals 10 * 0.5 = 5 hp without respawn and sets delayedHealthRate = 5/sec (1 second catch-up)
    state.motorcycle.status = 'driving';
    state.motorcycle.x = MOTORCYCLE_CRASH_X - 1;
    updateGameState(state, input, 0.1);
    expect(state.motorcycle.status).toBe('crashed');
    expect(state.player.health).toBe(95);
    expect(state.player.delayedHealth).toBe(100);

    // After 0.5 seconds, delayedHealth moves halfway from 100 toward 95 (~97.5)
    updateGameState(state, input, 0.5);
    expect(state.player.delayedHealth).toBeCloseTo(97.5, 2);

    // Another health change recalculates rate so delayedHealth still reaches health in 1.0 second
    setPlayerHealth(state.player, 67.5);
    expect(state.player.delayedHealthRate).toBeCloseTo(30, 2);
    updateGameState(state, input, 0.5);
    expect(state.player.delayedHealth).toBeCloseTo(82.5, 2);
    updateGameState(state, input, 0.5);
    expect(state.player.delayedHealth).toBeCloseTo(67.5, 4);

    // 2. Respawn hazards deal 30 * 0.5 = 15 hp and hostile NPC Uzi bullets deal 5 * 0.5 = 2.5 hp
    const outsideRespawn = createGameState({ showIntroDialogue: false });
    resetAfterSnowballHit(outsideRespawn);
    expect(outsideRespawn.player.health).toBe(85);

    const basementState = createGameState({ initialLevelId: 'level-basement' });
    const basement = basementState.levels['level-basement'];
    basementState.player.x = basement.windowNpc.x;
    basementState.player.y = basement.windowNpc.y - TILE_SIZE;
    // Arjan detects Santa -> 1s alert, then becomes hostile and fires halved Uzi bullets
    for (let i = 0; i < 32; i++) {
      updateGameState(basementState, createEmptyInput(), 0.05);
    }
    expect(basement.arjanCombat.mode).toBe('hostile');
    expect(basementState.player.health).toBeLessThan(100);
    expect((100 - basementState.player.health) % (NPC_UZI_BULLET_DAMAGE * PLAYER_DAMAGE_MULTIPLIER)).toBe(0);

    // 3. Reaching <= 0 hp triggers Game Over ("Try again?") and advancing restarts from level-outside
    damagePlayer(outsideRespawn, 60); // 85 - 30 = 55
    damagePlayer(outsideRespawn, 60); // 55 - 30 = 25
    damagePlayer(outsideRespawn, 60); // 0
    expect(outsideRespawn.player.health).toBe(0);
    expect(outsideRespawn.gameOver).toBe(true);
    expect(outsideRespawn.activeDialogue?.variant).toBe('gameover');
    expect(outsideRespawn.activeDialogue?.lines).toEqual(['Try again?']);
    // Advance Game Over dialog -> restarts from level-outside with full 100 hp
    const spaceInput = createEmptyInput();
    advanceDialogue(outsideRespawn, spaceInput);
    expect(outsideRespawn.currentLevelId).toBe('level-outside');
    expect(outsideRespawn.player.health).toBe(MAX_PLAYER_HEALTH);
    expect(outsideRespawn.player.delayedHealth).toBe(MAX_PLAYER_HEALTH);
    expect(outsideRespawn.gameOver).toBe(false);
    expect(outsideRespawn.activeDialogue).toBeNull();

    // 4. With ?cheat enabled, running out of health does NOT trigger Game Over
    const cheatState = createGameState({ cheat: true });
    damagePlayer(cheatState, 240);
    expect(cheatState.player.health).toBe(0);
    expect(cheatState.gameOver).toBe(false);
    expect(cheatState.activeDialogue).toBeNull();
  });

  it('supports slot 1-4 equipment (empty/unarmed/uzi/flamethrower), Rudolph murder-mystery chain, and 5/s @ 16 tiles/s Uzi projectiles', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();

    // 1. Starts with 'empty' (slot 1); slot 2 switches to 'unarmed'; slot 3 (Uzi) cannot be equipped before unlocking
    expect(state.player.equippedItem).toBe('empty');
    expect(state.player.unlockedUzi).toBe(false);
    applyKeyEvent(input, 'Digit3', true);
    applyKeyEvent(input, 'Digit3', false);
    updateGameState(state, input, 0.01);
    expect(state.player.equippedItem).toBe('empty');

    // Switch to slot 2 (unarmed) and press F -> triggers punch animation
    applyKeyEvent(input, 'Digit2', true);
    applyKeyEvent(input, 'Digit2', false);
    updateGameState(state, input, 0.01);
    expect(state.player.equippedItem).toBe('unarmed');

    applyKeyEvent(input, 'KeyF', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'KeyF', false);
    expect(state.player.punchTimer).toBeCloseTo(PUNCH_DURATION_SECONDS, 4);
    expect(state.projectiles.length).toBe(0);

    // 2. Verify Rudolph corpse mesh is built into the outside roof scene
    const staticOutside = getStaticLevelMesh('level-outside', state.map);
    expect(staticOutside.vertexCount).toBeGreaterThan(0);

    // 3. Move Santa onto the roof next to Rudolph and inspect him
    state.isOnRoof = true;
    state.player.x = ROOF_RUDOLPH_BOUNDS.x;
    state.player.y = ROOF_RUDOLPH_BOUNDS.y + 4;
    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('roof-rudolph');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    // Regular 5-line monologue about Rudolph
    expect(state.activeDialogue?.variant).toBeUndefined();
    expect(state.activeDialogue?.lines).toEqual([
      'RUDOLPH?!! WHO DID THIS?',
      '...',
      'This is no longer about saving christmas...',
      'This is about REVENGE!',
      "I will find out who did this, if it is the last thing I'll ever do.",
    ]);

    for (let i = 0; i < 5; i++) {
      advanceDialogue(state, input);
    }

    // Special centered Achievement 1
    expect(state.activeDialogue?.variant).toBe('achievement');
    expect(state.activeDialogue?.lines).toEqual([
      'ACHIEVEMENT UNLOCKED: Murder-mystery genre unlocked.',
    ]);

    advanceDialogue(state, input);

    // Regular dialogue: "I'm dreaming of a RED CHRISTMAS."
    expect(state.activeDialogue?.variant).toBeUndefined();
    expect(state.activeDialogue?.lines).toEqual([
      "I'm dreaming of a RED CHRISTMAS.",
    ]);

    advanceDialogue(state, input);

    // Special centered Achievement 2
    expect(state.activeDialogue?.variant).toBe('achievement');
    expect(state.activeDialogue?.lines).toEqual([
      'ACHIEVEMENT UNLOCKED: Action genre unlocked. Viewer discretion is advised.',
    ]);

    // Closing the second achievement unlocks & equips Uzi (slot 3) with 0.5s sky-to-forward animation
    advanceDialogue(state, input);

    expect(state.activeDialogue).toBeNull();
    expect(state.player.unlockedUzi).toBe(true);
    expect(state.player.equippedItem).toBe('uzi');
    expect(state.player.uziEquipTimer).toBeCloseTo(
      UZI_EQUIP_DURATION_SECONDS,
      4
    );

    // Build dynamic 3D mesh mid-equip and after equip finishes
    const midEquipMesh = buildDynamicSceneMeshes(state, 50);
    expect(midEquipMesh.opaque.vertexCount).toBeGreaterThan(0);

    // Switch back to slot 1 (empty), slot 2 (unarmed), then slot 3 (uzi) via digit keys
    applyKeyEvent(input, 'Digit1', true);
    applyKeyEvent(input, 'Digit1', false);
    updateGameState(state, input, 0.01);
    expect(state.player.equippedItem).toBe('empty');

    applyKeyEvent(input, 'Digit2', true);
    applyKeyEvent(input, 'Digit2', false);
    updateGameState(state, input, 0.01);
    expect(state.player.equippedItem).toBe('unarmed');

    applyKeyEvent(input, 'Digit3', true);
    applyKeyEvent(input, 'Digit3', false);
    updateGameState(state, input, 0.01);
    expect(state.player.equippedItem).toBe('uzi');
    expect(state.player.uziEquipTimer).toBeCloseTo(
      UZI_EQUIP_DURATION_SECONDS,
      4
    );

    // 4. Firing Uzi in open ground emits 10 projectiles per second (every 0.1s) moving at 16 tiles/s (256 px/s)
    state.isOnRoof = false;
    state.player.x = 15 * TILE_SIZE;
    state.player.y = 26 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2; // aiming straight north (open driveway)
    state.player.uziEquipTimer = 0;

    applyKeyEvent(input, 'Space', true);
    // Simulate 0.85s in 0.05s steps holding Space -> 9 shots fired at t = 0.0, 0.1, ..., 0.8s
    for (let step = 0; step < 17; step++) {
      updateGameState(state, input, 0.05);
    }
    applyKeyEvent(input, 'Space', false);
    expect(state.player.uziAmmo).toBe(MAX_UZI_AMMO - 9);
    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(UZI_PROJECTILE_SPEED).toBe(24 * TILE_SIZE);

    // Verify projectile velocity = 16 tiles/sec (256 px/s) and 3D bullet rendering
    const firstProj = state.projectiles[0];
    expect(Math.hypot(firstProj.vx, firstProj.vy)).toBeCloseTo(
      UZI_PROJECTILE_SPEED,
      4
    );
    const bulletScene = buildDynamicSceneMeshes(state, 50);
    expect(bulletScene.opaque.vertexCount).toBeGreaterThan(0);

    // Moving projectiles collide with obstacles / walls, disappear, and spawn a black bullet hole
    const wallTestState = createGameState({ showIntroDialogue: false });
    wallTestState.player.unlockedUzi = true;
    wallTestState.player.equippedItem = 'uzi';
    // Stand just south of the Main House south wall (row 9 is solid house wall)
    wallTestState.player.x = 11 * TILE_SIZE;
    wallTestState.player.y = 10 * TILE_SIZE + 8;
    wallTestState.player.yaw = -Math.PI / 2;
    const shootInput = createEmptyInput();
    applyKeyEvent(shootInput, 'KeyF', true);
    updateGameState(wallTestState, shootInput, 0.016);
    applyKeyEvent(shootInput, 'KeyF', false);
    expect(wallTestState.projectiles.length).toBe(1);

    // Advance 0.1s (~25.6px travel north) -> collides with house wall at row 9 and spawns a bullet hole
    updateGameState(wallTestState, shootInput, 0.1);
    expect(wallTestState.projectiles.length).toBe(0);
    expect(wallTestState.bulletHoles.length).toBe(1);
  });

  it('pre-places ladder in ?cheat mode and preserves a placed ladder across outdoor hazard respawns', () => {
    const cheatState = createGameState({ cheat: true, showIntroDialogue: false });
    expect(cheatState.ladderPlaced).toBe(true);
    expect(cheatState.hasLadder).toBe(false);
    expect(cheatState.levels['level-outside'].ladderPlaced).toBe(true);
    expect(
      cheatState.interactables.some((i) => i.id === 'house-west-climb-ladder')
    ).toBe(true);

    const normalState = createGameState({ showIntroDialogue: false });
    expect(normalState.ladderPlaced).toBe(false);
    normalState.ladderPlaced = true;
    normalState.levels['level-outside'].ladderPlaced = true;
    resetAfterSnowballHit(normalState);
    expect(normalState.ladderPlaced).toBe(true);
    expect(normalState.levels['level-outside'].ladderPlaced).toBe(true);
    expect(
      normalState.interactables.some((i) => i.id === 'house-west-climb-ladder')
    ).toBe(true);
  });

  it('uses A/D to turn in empty mode, strafe & lock facing to cameraYaw in other equipment modes, and jump vs punch on Space', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();
    const camera = createCamera3D(-Math.PI / 2);
    input.cameraYaw = -Math.PI / 2;
    updateCamera3D(camera, state, input, 0);

    // 1. Slot 1 ('empty'): Space jumps when not near interactable, and A/D walk+face left/right
    state.player.x = 15 * TILE_SIZE;
    state.player.y = 25 * TILE_SIZE;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.016);
    applyKeyEvent(input, 'Space', false);
    expect((state.player.jumpOffset ?? 0) > 0 || (state.player.jumpVelocity ?? 0) > 0).toBe(true);
    expect(state.player.punchTimer).toBe(0);

    applyKeyEvent(input, 'KeyA', true);
    updateGameState(state, input, 0.1);
    updateCamera3D(camera, state, input, 0.1);
    applyKeyEvent(input, 'KeyA', false);
    expect(state.player.facing).toBe('left');
    expect(Math.abs(state.player.yaw ?? 0)).toBeCloseTo(Math.PI, 4);

    // 2. Slot 2 ('unarmed'): Space triggers flailing punch instead of jump, A/D strafe while keeping cameraYaw facing
    applyKeyEvent(input, 'Digit2', true);
    applyKeyEvent(input, 'Digit2', false);
    updateGameState(state, input, 0.01);
    expect(state.player.equippedItem).toBe('unarmed');

    state.player.jumpOffset = 0;
    state.player.jumpVelocity = 0;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.016);
    applyKeyEvent(input, 'Space', false);
    expect(state.player.punchTimer).toBeGreaterThan(0);
    expect(state.player.jumpOffset ?? 0).toBe(0);

    // Rotate camera with Right Arrow and verify Santa turns to match camera.yaw while strafing left with A
    input.cameraYaw = camera.yaw;
    applyKeyEvent(input, 'ArrowRight', true);
    const prevX = state.player.x;
    applyKeyEvent(input, 'KeyA', true);
    updateGameState(state, input, 0.1);
    updateCamera3D(camera, state, input, 0.1);
    applyKeyEvent(input, 'ArrowRight', false);
    applyKeyEvent(input, 'KeyA', false);
    expect(state.player.yaw).toBeCloseTo(camera.yaw, 5);
    expect(state.player.renderYaw).toBeCloseTo(camera.yaw, 5);
    expect(state.player.x).toBeLessThan(prevX);
  });

  it('spawns off-center vibrating Uzi shots with spread, cleans out-of-bounds bullets, expires wall bullet holes in 10s, and spawns NPC blood pools lasting 20s', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();
    state.player.unlockedUzi = true;
    state.player.equippedItem = 'uzi';
    state.player.x = 15 * TILE_SIZE;
    state.player.y = 25 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2; // facing north: right vector is +x (1, 0)

    const pcx = state.player.x + state.player.width * 0.5;
    const pcy = state.player.y + state.player.height * 0.5;
    const yawSpreadLimit = (10 * Math.PI) / 180;
    const pitchSpreadLimit = (5 * Math.PI) / 180;

    // Fire 6 shots and check off-center origin, vibration, yaw spread (±10 deg), and pitch spread (±5 deg)
    applyKeyEvent(input, 'Space', true);
    for (let i = 0; i < 6; i++) {
      updateGameState(state, input, 0.2);
    }
    applyKeyEvent(input, 'Space', false);
    expect(state.player.weaponVibrationTimer).toBeGreaterThan(0);
    expect(state.projectiles.length).toBeGreaterThan(0);

    const lastShot = state.projectiles[state.projectiles.length - 1];
    // At t=0 right after spawn, offset is ~ (+3.8, -7.5) from player center (spread changes yaw within ±10 deg)
    expect(lastShot.x).toBeGreaterThan(pcx);
    expect(lastShot.y).toBeLessThan(pcy);
    for (const proj of state.projectiles) {
      let yawDelta = proj.yaw - -Math.PI / 2;
      while (yawDelta > Math.PI) yawDelta -= Math.PI * 2;
      while (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
      expect(Math.abs(yawDelta)).toBeLessThanOrEqual(yawSpreadLimit + 1e-6);
      const maxVz = UZI_PROJECTILE_SPEED * Math.tan(pitchSpreadLimit) + 1e-4;
      expect(Math.abs(proj.vz ?? 0)).toBeLessThanOrEqual(maxVz);
    }

    // Bullet leaving map bounds is deleted
    state.projectiles.push({
      kind: 'bullet',
      x: 4,
      y: 25 * TILE_SIZE,
      z: 9,
      vx: -UZI_PROJECTILE_SPEED,
      vy: 0,
      vz: 0,
      yaw: Math.PI,
    });
    updateGameState(state, input, 0.1);
    expect(state.projectiles.some((p) => p.x < 0)).toBe(false);

    // Wall bullet hole expires after 10 seconds
    state.projectiles = [];
    state.bulletHoles = [
      {
        levelId: 'level-outside',
        x: 100,
        y: 140,
        z: 9,
        age: 0,
        maxAge: BULLET_HOLE_DURATION_SECONDS,
      },
    ];
    updateGameState(state, input, BULLET_HOLE_DURATION_SECONDS - 0.1);
    expect(state.bulletHoles.length).toBe(1);
    updateGameState(state, input, 0.2);
    expect(state.bulletHoles.length).toBe(0);

    // Hitting Alex NPC with an Uzi bullet spawns falling blood particles -> 20s ground blood pools
    state.projectiles = [
      {
        kind: 'bullet',
        x: OUTSIDE_ALEX_NPC.x - 4,
        y: OUTSIDE_ALEX_NPC.y + OUTSIDE_ALEX_NPC.height * 0.5,
        z: 9,
        vx: UZI_PROJECTILE_SPEED,
        vy: 0,
        vz: 0,
        yaw: 0,
      },
    ];
    updateGameState(state, input, 0.05);
    expect(state.bloodParticles.length).toBeGreaterThan(0);

    // Advance enough for blood particles to land and create 20s ground blood pools
    for (let i = 0; i < 15; i++) {
      updateGameState(state, input, 0.1);
    }
    expect(state.bloodPools.length).toBeGreaterThan(0);
    const meshWithBlood = buildDynamicSceneMeshes(state, 50);
    expect(meshWithBlood.translucent.vertexCount).toBeGreaterThan(0);

    // Advance remaining lifetime past 20s -> blood pools disappear
    updateGameState(state, input, BLOOD_POOL_DURATION_SECONDS);
    expect(state.bloodPools.length).toBe(0);

    // Unarmed punch reaching Alex NPC also spawns blood splatter & pools
    applyKeyEvent(input, 'Digit2', true);
    applyKeyEvent(input, 'Digit2', false);
    updateGameState(state, input, 0.01);
    state.player.x = OUTSIDE_ALEX_NPC.x - state.player.width - 2;
    state.player.y = OUTSIDE_ALEX_NPC.y;
    state.player.yaw = 0; // facing east toward Alex
    applyKeyEvent(input, 'KeyF', true);
    updateGameState(state, input, 0.016);
    applyKeyEvent(input, 'KeyF', false);
    expect(state.bloodParticles.length).toBeGreaterThan(0);
  });

  it('tracks 30-bullet Uzi magazine, HUD badge, 0-ammo right-arm drop animation, floor Uzi, and removes slot 3 after depletion', () => {
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();
    state.player.unlockedUzi = true;
    state.player.equippedItem = 'uzi';
    expect(state.player.uziAmmo).toBe(MAX_UZI_AMMO);

    // Verify drawEquippedItemHud renders the ammo badge left of main HUD box & hides slot 3 after depletion
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const mockCtx = {
      canvas: { width: 320, height: 240 },
      save: () => {},
      restore: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      fillRect: (x: number, y: number, w: number, h: number) => {
        rects.push({ x, y, w, h });
      },
      strokeRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillText: () => {},
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawEquippedItemHud(mockCtx, state.player);
    // Ammo badge renders to the left of main box (x < 262, y between 8..42)
    expect(rects.some((r) => r.x < 262 && r.y >= 10 && r.y <= 35)).toBe(true);
    // With 3 slots (1, 2, 3), leftmost slot starts at x = 246 (y = 46)
    expect(rects.some((r) => r.x < 265 && r.y >= 46)).toBe(true);

    // Drop down to 1 bullet left and fire the last bullet in open yard
    state.player.uziAmmo = 1;
    state.player.x = 15 * TILE_SIZE;
    state.player.y = 25 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.016);
    applyKeyEvent(input, 'Space', false);

    expect(state.player.uziAmmo).toBe(0);
    expect(state.player.uziDepleted).toBe(false);
    expect(state.player.equippedItem).toBe('uzi');
    expect(state.player.uziReloadTimer).toBeCloseTo(PLAYER_UZI_RELOAD_SECONDS, 4);
    expect(state.droppedUzis.length).toBe(0);

    // While reloading, HUD renders blinking "RELOADING" status pill at even blink frames and hides it at odd frames
    rects.length = 0;
    drawEquippedItemHud(mockCtx, state.player, 0.0);
    const reloadingOnCount = rects.length;
    rects.length = 0;
    drawEquippedItemHud(mockCtx, state.player, 0.2);
    const reloadingOffCount = rects.length;
    expect(reloadingOnCount).toBeGreaterThan(reloadingOffCount);

    // Flamethrower at 0 ammo renders blinking "NO AMMO" status pill
    state.player.unlockedFlamethrower = true;
    state.player.equippedItem = 'flamethrower';
    state.player.flamethrowerAmmo = 0;
    rects.length = 0;
    drawEquippedItemHud(mockCtx, state.player, 0.0);
    const noAmmoOnCount = rects.length;
    rects.length = 0;
    drawEquippedItemHud(mockCtx, state.player, 0.2);
    const noAmmoOffCount = rects.length;
    expect(noAmmoOnCount).toBeGreaterThan(noAmmoOffCount);
    state.player.equippedItem = 'uzi';

    // 3D scene builds cleanly during 1.5-second reload animation
    updateGameState(state, input, 0.7);
    expect(state.player.uziReloadTimer).toBeGreaterThan(0);
    expect(state.player.uziAmmo).toBe(0);
    const reloadMesh = buildDynamicSceneMeshes(state, 50);
    expect(reloadMesh.opaque.vertexCount).toBeGreaterThan(0);

    // After 1.5 seconds total, Uzi finishes reloading with a full 30-round magazine
    updateGameState(state, input, 0.9);
    expect(state.player.uziReloadTimer).toBe(0);
    expect(state.player.uziAmmo).toBe(MAX_UZI_AMMO);
    expect(state.player.equippedItem).toBe('uzi');
  });

  it('triggers 3s blinking landmine in basement to open Spa Room, unlocks Slot 4 Flamethrower with 3-tile fireballs, burns NPCs, and burns stairs wood stack', () => {
    const state = createGameState({
      initialLevelId: 'level-basement',
      cheat: true,
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const basement = state.levels['level-basement'];

    // 1. Spa Room is initially closed & mine idle 1 tile south
    expect(basement.spaDoorClosed).toBe(true);
    expect(basement.mineState).toBe('idle');

    // Step onto mine -> blinks for 3 seconds then explodes & reveals Spa Room
    state.player.x = BASEMENT_MINE_BOUNDS.x + 2;
    state.player.y = BASEMENT_MINE_BOUNDS.y + 2;
    updateGameState(state, input, 0.05);
    expect(basement.mineState).toBe('blinking');
    expect(basement.mineTimer).toBeCloseTo(BASEMENT_MINE_FUSE_SECONDS, 4);

    updateGameState(state, input, 2.85);
    expect(basement.mineState).toBe('blinking');
    expect(basement.spaDoorClosed).toBe(true);

    updateGameState(state, input, 0.25);
    expect(basement.mineState).toBe('exploded');
    expect(basement.mineExplosionTimer).toBeGreaterThan(0);
    expect(basement.spaDoorClosed).toBe(false);

    // 2. Walk north through open doorway into Spa Room to collect Flamethrower (slot 4)
    state.player.x = BASEMENT_FLAMETHROWER_BOUNDS.x + 2;
    state.player.y = BASEMENT_FLAMETHROWER_BOUNDS.y + 2;
    expect(state.player.x).toBeGreaterThanOrEqual(BASEMENT_SPA_ROOM_BOUNDS.x);
    updateGameState(state, input, 0.05);
    expect(basement.flamethrowerPickedUp).toBe(true);
    expect(state.player.unlockedFlamethrower).toBe(true);
    expect(state.player.equippedItem).toBe('flamethrower');
    expect(state.activeDialogue?.lines).toEqual([
      'Use the number keys to change weapon.',
    ]);
    advanceDialogue(state, input);
    expect(state.activeDialogue).toBeNull();

    // Switch slot 1 (empty) and back to slot 4 (flamethrower)
    applyKeyEvent(input, 'Digit1', true);
    applyKeyEvent(input, 'Digit1', false);
    updateGameState(state, input, 0.01);
    expect(state.player.equippedItem).toBe('empty');

    applyKeyEvent(input, 'Digit4', true);
    applyKeyEvent(input, 'Digit4', false);
    updateGameState(state, input, 0.01);
    expect(state.player.equippedItem).toBe('flamethrower');

    // 3. Fireball travels slowly and disappears after 3 tiles (FLAMETHROWER_MAX_DISTANCE)
    state.player.x = 12 * TILE_SIZE;
    state.player.y = 16 * TILE_SIZE;
    state.player.yaw = Math.PI; // shoot west along empty hallway from col 12 toward col 7
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.016);
    applyKeyEvent(input, 'Space', false);
    expect(state.projectiles.length).toBe(1);
    expect(state.projectiles[0].kind).toBe('fireball');
    expect(
      Math.hypot(state.projectiles[0].vx, state.projectiles[0].vy)
    ).toBeCloseTo(FLAMETHROWER_PROJECTILE_SPEED, 4);

    // Advance 1.3s (> FLAMETHROWER_MAX_DISTANCE / FLAMETHROWER_PROJECTILE_SPEED = 48 / 40 = 1.2s)
    updateGameState(state, input, 1.3);
    expect(state.projectiles.length).toBe(0);

    // 4. Hitting Arjan NPC with a fireball sets him on fire ('basement:Arjan')
    state.projectiles.push({
      kind: 'fireball',
      x: basement.windowNpc.x - 4,
      y: basement.windowNpc.y + basement.windowNpc.height * 0.5,
      z: 9,
      vx: FLAMETHROWER_PROJECTILE_SPEED,
      vy: 0,
      vz: 0,
      yaw: 0,
      distanceTraveled: 0,
      maxDistance: FLAMETHROWER_MAX_DISTANCE,
    });
    updateGameState(state, input, 0.2);
    expect(state.burningNpcs.has('basement:Arjan')).toBe(true);

    // 5. Basement stairs are blocked by stacked wood until a fireball burns it away
    expect(basement.stairsWoodBurned).toBe(false);
    state.player.x = BASEMENT_STAIRS_WOOD_BOUNDS.x - state.player.width - 2;
    state.player.y = BASEMENT_STAIRS_WOOD_BOUNDS.y + TILE_SIZE;
    applyKeyEvent(input, 'KeyD', true);
    updateGameState(state, input, 0.25);
    applyKeyEvent(input, 'KeyD', false);
    expect(state.player.x).toBeLessThanOrEqual(
      BASEMENT_STAIRS_WOOD_BOUNDS.x - state.player.width + 0.01
    );

    // Shoot fireball east into wood tile -> only the hit tile ignites locally, burns in 3.0s, spreads to immediate neighbors at 2.5s
    state.player.yaw = 0;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    updateGameState(state, input, 0.4);
    const burningInitially = basement.stairsWoodTiles.filter((t) => t.burning);
    expect(burningInitially.length).toBeGreaterThanOrEqual(1);
    expect(burningInitially.length).toBeLessThan(basement.stairsWoodTiles.length);
    expect(basement.stairsWoodBurnTimer).toBeGreaterThan(0);
    expect(basement.stairsWoodBurned).toBe(false);

    // Build 3D scene while wood is burning and NPC is burning
    const burningMesh = buildDynamicSceneMeshes(state, 50);
    expect(burningMesh.translucent.vertexCount).toBeGreaterThan(0);

    // Advance past 2.5s -> fire spreads to immediate neighbor(s); advance past 3.0s -> hit tile burns away cleanly
    updateGameState(state, input, 2.2); // total ~2.6s -> neighbor(s) ignited!
    expect(basement.stairsWoodTiles.filter((t) => t.burning).length).toBeGreaterThan(
      burningInitially.length
    );
    updateGameState(state, input, 0.6); // total ~3.2s -> original hit tile(s) burned away!
    expect(burningInitially.every((t) => t.burned)).toBe(true);

    // Now Santa can walk right through the burned tile onto the stairs
    const burnedTile = burningInitially[0];
    state.player.x = burnedTile.bounds.x;
    state.player.y = burnedTile.bounds.y + 2;
    applyKeyEvent(input, 'KeyD', true);
    for (let i = 0; i < 20; i++) {
      updateGameState(state, input, 0.02);
    }
    applyKeyEvent(input, 'KeyD', false);
    expect(state.screenFade?.phase).toBe('out');
    updateGameState(state, input, 0.5);
    expect(state.currentLevelId).toBe('level-upstairs');
    expect(state.screenFade?.phase).toBe('in');
  });

  it('applies right-shoulder camera offset when equipped, buffed flamethrower stats, enlarged bathroom-tiled Spa Room with tub, and full-surround stairs wood', () => {
    // 1. Over-the-right-shoulder camera offset only when something is equipped
    const state = createGameState({ showIntroDialogue: false });
    const input = createEmptyInput();
    const camera = createCamera3D();
    updateCamera3D(camera, state, input, 1.0, 256 / 224);
    expect(camera.shoulderOffset).toBe(0);
    const emptyDistance = camera.distance;
    const emptyTargetY = camera.target.y;

    state.player.equippedItem = 'unarmed';
    updateCamera3D(camera, state, input, 1.0, 256 / 224);
    expect(camera.shoulderOffset ?? 0).toBeCloseTo(10.3125, 2);
    expect(camera.distance).toBeCloseTo(emptyDistance * 0.55, 1);
    expect(camera.target.y).toBeCloseTo(emptyTargetY + 1.3, 2);

    state.player.equippedItem = 'empty';
    updateCamera3D(camera, state, input, 1.0, 256 / 224);
    expect(camera.shoulderOffset).toBeCloseTo(0, 1);
    expect(camera.distance).toBeCloseTo(emptyDistance, 1);

    // 2. Buffed Flamethrower: 2x speed (5 * TILE_SIZE), 2x distance (6 * TILE_SIZE), 5x fire rate (0.05s)
    expect(FLAMETHROWER_PROJECTILE_SPEED).toBe(5 * TILE_SIZE);
    expect(FLAMETHROWER_MAX_DISTANCE).toBe(6 * TILE_SIZE);
    state.player.unlockedFlamethrower = true;
    state.player.equippedItem = 'flamethrower';
    state.player.x = 15 * TILE_SIZE;
    state.player.y = 26 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    applyKeyEvent(input, 'Space', true);
    for (let i = 0; i < 4; i++) {
      updateGameState(state, input, 0.05);
    }
    applyKeyEvent(input, 'Space', false);
    expect(state.projectiles.length).toBeGreaterThanOrEqual(3);

    // 3. Expanded Spa Room (4x7 = 28 tiles, BathroomTileFloor) with single tub obstacle
    const basementState = createGameState({ showIntroDialogue: false, initialLevelId: 'level-basement' });
    const basementLevel = basementState.levels['level-basement'];
    expect(basementLevel.doors.find((d) => d.id === 'basement-bathroom-door')?.hiddenRegions).toEqual([]);
    expect(BASEMENT_SPA_ROOM_BOUNDS.width).toBe(4 * TILE_SIZE);
    expect(BASEMENT_SPA_ROOM_BOUNDS.height).toBe(7 * TILE_SIZE);
    expect(basementLevel.map.tiles[6][15]).toBe(TileType.BathroomTileFloor);
    expect(basementLevel.map.tiles[11][17]).toBe(TileType.BathroomTileFloor);
    const obstacles = basementLevel.getSolidObstacles();
    expect(obstacles.some((o) => o.x === BASEMENT_SPA_TUB_BOUNDS.x && o.y === BASEMENT_SPA_TUB_BOUNDS.y)).toBe(true);

    // 4. Stairs wood stacks surround West, North, and South sides until burned
    expect(BASEMENT_STAIRS_WOOD_OBSTACLES.length).toBe(3);
    expect(BASEMENT_STAIRS_WOOD_OBSTACLES).toContain(BASEMENT_STAIRS_WOOD_BOUNDS);
    expect(BASEMENT_STAIRS_WOOD_OBSTACLES).toContain(BASEMENT_STAIRS_WOOD_NORTH_BOUNDS);
    expect(BASEMENT_STAIRS_WOOD_OBSTACLES).toContain(BASEMENT_STAIRS_WOOD_SOUTH_BOUNDS);
    expect(obstacles.some((o) => o.y === BASEMENT_STAIRS_WOOD_NORTH_BOUNDS.y && o.x === BASEMENT_STAIRS_WOOD_NORTH_BOUNDS.x)).toBe(true);
    expect(obstacles.some((o) => o.y === BASEMENT_STAIRS_WOOD_SOUTH_BOUNDS.y && o.x === BASEMENT_STAIRS_WOOD_SOUTH_BOUNDS.x)).toBe(true);
  });

  it('spawns player with Uzi when ?level param is used and refills Uzi 3s after depletion in ?cheat mode', () => {
    const levelState = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-basement',
      levelParamOverride: true,
    });
    expect(levelState.player.unlockedUzi).toBe(true);
    expect(levelState.player.equippedItem).toBe('uzi');
    expect(levelState.player.uziAmmo).toBe(MAX_UZI_AMMO);

    const cheatState = createGameState({
      showIntroDialogue: false,
      cheat: true,
    });
    cheatState.player.unlockedUzi = true;
    cheatState.player.equippedItem = 'uzi';
    cheatState.player.uziAmmo = 1;
    cheatState.player.x = 15 * TILE_SIZE;
    cheatState.player.y = 26 * TILE_SIZE;

    const input = createEmptyInput();
    applyKeyEvent(input, 'Space', true);
    updateGameState(cheatState, input, 0.05);
    applyKeyEvent(input, 'Space', false);
    expect(cheatState.player.uziAmmo).toBe(0);
    expect(cheatState.player.uziReloadTimer).toBeCloseTo(PLAYER_UZI_RELOAD_SECONDS, 4);
    expect(cheatState.player.equippedItem).toBe('uzi');

    // Before 1.5s elapses, still reloading
    updateGameState(cheatState, input, 0.8);
    expect(cheatState.player.uziReloadTimer).toBeGreaterThan(0);
    expect(cheatState.player.uziAmmo).toBe(0);

    // After 1.5s total, Uzi finishes reloading with 30 rounds
    updateGameState(cheatState, input, 0.8);
    expect(cheatState.player.uziReloadTimer).toBe(0);
    expect(cheatState.player.unlockedUzi).toBe(true);
    expect(cheatState.player.uziAmmo).toBe(MAX_UZI_AMMO);
    expect(cheatState.player.equippedItem).toBe('uzi');
  });

  it('blocks entering basement stairs from north/south floor while allowing exit once on stairs', () => {
    const state = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-basement',
    });
    const basement = state.levels['level-basement'];
    basement.stairsWoodBurned = true;
    const input = createEmptyInput();

    // 1. Standing on north floor (row 14, col 20) and walking south hits the stair side and does NOT go upstairs
    state.player.x = 20 * TILE_SIZE + 2;
    state.player.y = 14 * TILE_SIZE + 1;
    input.down = true;
    for (let i = 0; i < 10; i++) {
      updateGameState(state, input, 0.05);
    }
    input.down = false;
    expect(state.player.y + state.player.height).toBeLessThanOrEqual(15 * TILE_SIZE);
    expect(state.screenFade).toBeNull();
    expect(state.currentLevelId).toBe('level-basement');

    // 2. Standing on south floor (row 19, col 20) and walking north hits the south stair side and does NOT go upstairs
    state.player.x = 20 * TILE_SIZE + 2;
    state.player.y = 19 * TILE_SIZE + 3;
    input.up = true;
    for (let i = 0; i < 10; i++) {
      updateGameState(state, input, 0.05);
    }
    input.up = false;
    expect(state.player.y).toBeGreaterThanOrEqual(19 * TILE_SIZE);
    expect(state.screenFade).toBeNull();

    // 3. When already on the stairs (e.g. col 18.5, row 15), side rails are NOT collideable
    //    and stepping/jumping off the north edge pushes Santa north clear of the side collider
    state.player.x = 18.5 * TILE_SIZE;
    state.player.y = 15 * TILE_SIZE + 1;
    input.up = true;
    updateGameState(state, input, 0.1);
    input.up = false;
    expect(state.player.y).toBeLessThan(15 * TILE_SIZE);
    expect(state.player.y + state.player.height).toBeLessThanOrEqual(
      BASEMENT_STAIRS_SIDE_NORTH_BOUNDS.y
    );
  });

  it('computes shortest tile paths using AStarPathfinder around walls and obstacles', () => {
    const state = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-basement',
    });
    const basement = state.levels['level-basement'];
    const pathfinder = new AStarPathfinder(basement.map);

    // Path from library floor (col 8, row 10) to hallway (col 15, row 16) navigating around the fireplace & dividing wall
    const path = pathfinder.findPath({ col: 8, row: 10 }, { col: 15, row: 16 });
    expect(path.length).toBeGreaterThan(8);
    expect(path[0]).toEqual({ col: 8, row: 10 });
    expect(path[path.length - 1]).toEqual({ col: 15, row: 16 });
    // Every consecutive step is 1 tile apart (Manhattan distance = 1) and walkable
    for (let i = 1; i < path.length; i++) {
      const dist = Math.abs(path[i].col - path[i - 1].col) + Math.abs(path[i].row - path[i - 1].row);
      expect(dist).toBe(1);
      expect(pathfinder.isTileWalkable(path[i].col, path[i].row)).toBe(true);
    }

    // Unreachable solid wall tile returns []
    expect(pathfinder.findPath({ col: 8, row: 10 }, { col: 0, row: 0 })).toEqual([]);
  });

  it('arms indoor NPCs with Uzis, 100 HP billboards, 5s return-to-passive, and death in blood pool', () => {
    const state = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-basement',
    });
    const basement = state.levels['level-basement'];
    const arjan = basement.arjanCombat;
    const input = createEmptyInput();

    // 1. Starts passive with 100 HP and hidden billboard
    expect(arjan.mode).toBe('passive');
    expect(arjan.health).toBe(MAX_NPC_HEALTH);
    expect(arjan.delayedHealth).toBe(MAX_NPC_HEALTH);
    expect(isNpcBillboardVisible(arjan)).toBe(false);

    // 2. Taking damage from player triggers hostile mode + delayedHealth lag + visible billboard + A* walking toward player
    const startArjanY = basement.windowNpc.y;
    state.player.unlockedUzi = true;
    state.player.equippedItem = 'uzi';
    state.player.x = basement.windowNpc.x;
    state.player.y = basement.windowNpc.y - 3 * TILE_SIZE;
    state.player.yaw = Math.PI / 2; // facing south toward Arjan
    applyKeyEvent(input, 'Space', true);
    for (let i = 0; i < 6 && arjan.health === MAX_NPC_HEALTH; i++) {
      updateGameState(state, input, 0.05);
    }
    applyKeyEvent(input, 'Space', false);
    // Advance bullets to hit Arjan (during 0.5s alert -> delayedHealth lags behind health)
    for (let i = 0; i < 8 && arjan.health === MAX_NPC_HEALTH; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      updateGameState(state, input, 0.05);
    }
    expect(arjan.health).toBeLessThan(MAX_NPC_HEALTH);
    expect(arjan.delayedHealth).toBeGreaterThan(arjan.health);
    expect(arjan.mode).toBe('hostile');
    expect(isNpcBillboardVisible(arjan)).toBe(false); // hidden during 0.5s alert
    expect(basement.windowNpc.y).toBe(startArjanY); // does not run during 0.5s alert
    // Advance past 0.5s alert so Arjan starts shooting, running, & showing billboard
    for (let i = 0; i < 16; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      updateGameState(state, input, 0.05);
    }
    expect(isNpcBillboardVisible(arjan)).toBe(true);
    expect(basement.windowNpc.y).toBeLessThan(startArjanY); // walked north along A* path toward player!
    expect(arjan.weaponVibrationTimer).toBeGreaterThan(0);

    // 3. Move player behind the closed Spa Room doors (truly out of sight & unreachable) for 5+ seconds -> returns to passive, billboard stays visible because HP < 100
    state.player.x = 15 * TILE_SIZE;
    state.player.y = 7 * TILE_SIZE;
    for (let i = 0; i < 60; i++) {
      updateGameState(state, input, 0.1);
    }
    expect(arjan.unseenTimer).toBe(0);
    expect(arjan.mode).toBe('passive');
    expect(arjan.delayedHealth).toBe(arjan.health); // caught up over 1s
    expect(isNpcBillboardVisible(arjan)).toBe(true); // remains visible while HP < 100

    // 4. Killing Arjan (HP <= 0) sets dead mode, clears cone, spawns blood pool, removes solid obstacle
    state.player.x = basement.windowNpc.x;
    state.player.y = basement.windowNpc.y - TILE_SIZE;
    state.player.yaw = Math.PI / 2;
    const poolsBefore = state.bloodPools.length;
    applyKeyEvent(input, 'Space', true);
    for (let i = 0; i < 30 && arjan.mode !== 'dead'; i++) {
      updateGameState(state, input, 0.1);
    }
    applyKeyEvent(input, 'Space', false);
    expect(arjan.mode).toBe('dead');
    expect(arjan.health).toBe(0);
    expect(basement.coneOfSight).toBeNull();
    expect(state.bloodPools.length).toBeGreaterThan(poolsBefore);
    expect(basement.getSolidObstacles(state.player)).not.toContain(basement.windowNpc);
    // Advance death fall animation
    updateGameState(state, input, 0.5);
    expect(arjan.deadFallProgress).toBe(1);
    expect(isNpcBillboardVisible(arjan)).toBe(false);
    expect(NPC_HOSTILE_LOSE_SIGHT_SECONDS).toBe(5.0);
  });

  it('triggers a 2.5-second reload animation every 30 shots fired by a hostile NPC', () => {
    const state = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-basement',
    });
    const basement = state.levels['level-basement'];
    const arjan = basement.arjanCombat;
    const input = createEmptyInput();

    // Put Santa in front of Arjan and make Arjan hostile
    state.player.x = basement.windowNpc.x;
    state.player.y = basement.windowNpc.y - 3 * TILE_SIZE;
    arjan.mode = 'hostile';

    let shotsFired = 0;
    // Step in 0.1s increments until Arjan fires 30 shots and enters reload
    for (let i = 0; i < 40 && arjan.reloadTimer <= 0; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      state.projectiles = [];
      updateGameState(state, input, 0.1);
      shotsFired += state.projectiles.filter(
        (p) => p.owner === 'npc' && p.sourceNpcKey === 'basement:Arjan'
      ).length;
    }
    expect(shotsFired).toBe(NPC_UZI_MAGAZINE_SIZE);
    expect(arjan.reloadTimer).toBeCloseTo(NPC_UZI_RELOAD_SECONDS, 2);

    // 3D reload mesh builds cleanly during reload
    const reloadScene = buildDynamicSceneMeshes(state, 40);
    expect(reloadScene.opaque.vertexCount).toBeGreaterThan(0);

    // During the 2.5s reload window, Arjan must NOT fire any new bullets
    let shotsDuringReload = 0;
    for (let i = 0; i < 20; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      state.projectiles = [];
      updateGameState(state, input, 0.1); // 2.0s elapsed
      shotsDuringReload += state.projectiles.filter(
        (p) => p.owner === 'npc' && p.sourceNpcKey === 'basement:Arjan'
      ).length;
    }
    expect(shotsDuringReload).toBe(0);
    expect(arjan.reloadTimer).toBeGreaterThan(0);

    // After the remaining 0.5s+ elapses, reload completes and Arjan resumes firing
    state.player.health = MAX_PLAYER_HEALTH;
    state.projectiles = [];
    updateGameState(state, input, 0.6);
    expect(arjan.reloadTimer).toBe(0);
    const resumedShots = state.projectiles.filter(
      (p) => p.owner === 'npc' && p.sourceNpcKey === 'basement:Arjan'
    ).length;
    expect(resumedShots).toBeGreaterThan(0);
  });

  it('lets player pick up dropped NPC Uzis when unarmed/depleted and deals 50 HP on basement mine blast', () => {
    const state = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-basement',
    });
    const basement = state.levels['level-basement'];
    const input = createEmptyInput();

    // 1. Standing in the mine explosion deals 50 HP damage
    state.player.x = BASEMENT_MINE_BOUNDS.x;
    state.player.y = BASEMENT_MINE_BOUNDS.y;
    updateGameState(state, input, 0.05);
    expect(basement.mineState).toBe('blinking');
    updateGameState(state, input, BASEMENT_MINE_FUSE_SECONDS + 0.1);
    expect(basement.mineState).toBe('exploded');
    expect(state.player.health).toBe(100 - 50 * PLAYER_DAMAGE_MULTIPLIER);

    // 2. Kill Arjan -> drops a pickupable Uzi on the floor; player without an Uzi picks it up on touch
    state.player.unlockedUzi = true;
    state.player.equippedItem = 'uzi';
    state.player.x = basement.windowNpc.x;
    state.player.y = basement.windowNpc.y - TILE_SIZE;
    state.player.yaw = Math.PI / 2;
    applyKeyEvent(input, 'Space', true);
    for (let i = 0; i < 30 && basement.arjanCombat.mode !== 'dead'; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      updateGameState(state, input, 0.1);
    }
    applyKeyEvent(input, 'Space', false);
    expect(basement.arjanCombat.mode).toBe('dead');
    const droppedNpcUzi = state.droppedUzis.find((u) => u.pickupable);
    expect(droppedNpcUzi).toBeDefined();
    expect(droppedNpcUzi?.maxAge).toBeUndefined();

    // NPC-dropped Uzi does NOT disappear over time and is NOT picked up while player already holds a usable Uzi
    state.player.x = droppedNpcUzi!.x - 4;
    state.player.y = droppedNpcUzi!.y - 4;
    for (let i = 0; i < 40; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      updateGameState(state, input, 0.1); // 4.0s elapsed
    }
    expect(state.droppedUzis.some((u) => u.pickupable)).toBe(true);

    // Simulate player not holding a usable Uzi (depleted) and touching the dropped NPC Uzi
    state.player.uziDepleted = true;
    state.player.uziAmmo = 0;
    state.player.equippedItem = 'empty';
    state.player.x = droppedNpcUzi!.x - 4;
    state.player.y = droppedNpcUzi!.y - 4;
    updateGameState(state, input, 0.05);
    expect(state.player.unlockedUzi).toBe(true);
    expect(state.player.uziDepleted).toBe(false);
    expect(state.player.uziAmmo).toBe(MAX_UZI_AMMO);
    expect(state.player.equippedItem).toBe('uzi');
    expect(state.droppedUzis.some((u) => u.pickupable)).toBe(false);
  });

  it('supports Spa Room & Olexa medkits (+25 HP), NPC burning mode (20 HP/s, 2x random run/shoot), and Anne-Marie katana drop & pickup', () => {
    const state = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-basement',
    });
    const basement = state.levels['level-basement'];
    const input = createEmptyInput();

    // 1. Spa Room medkit heals +25 HP when picked up after Spa Door opens
    basement.spaDoorClosed = false;
    const spaMedkit = state.medkits.find((m) => m.id === 'basement-spa-medkit');
    expect(spaMedkit).toBeDefined();
    damagePlayer(state, 40); // 60 HP
    state.player.x = spaMedkit!.x - 4;
    state.player.y = spaMedkit!.y - 4;
    updateGameState(state, input, 0.05);
    expect(state.player.health).toBe(100);
    expect(state.medkits.some((m) => m.id === 'basement-spa-medkit')).toBe(false);

    // 2. Hitting Olexa with Flamethrower switches him to 'burning' mode (takes 20 HP/s, runs & fires randomly)
    //    and killing Olexa spawns a medkit!
    state.player.unlockedFlamethrower = true;
    state.player.equippedItem = 'flamethrower';
    state.player.x = basement.olexaNpc.x;
    state.player.y = basement.olexaNpc.y - 2 * TILE_SIZE;
    state.player.yaw = Math.PI / 2;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.05);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 8 && basement.olexaCombat.mode !== 'burning'; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      updateGameState(state, input, 0.05);
    }
    expect(basement.olexaCombat.mode).toBe('burning');
    const hpAfterHit = basement.olexaCombat.health;
    updateGameState(state, input, 1.0);
    expect(basement.olexaCombat.health).toBeCloseTo(Math.max(0, hpAfterHit - 20), 1);
    const burningMesh = buildDynamicSceneMeshes(state, 40);
    expect(burningMesh.opaque.vertexCount).toBeGreaterThan(0);

    // Let burn damage kill Olexa -> spawns a medkit on the floor
    for (let i = 0; i < 60 && basement.olexaCombat.mode !== 'dead'; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      updateGameState(state, input, 0.1);
    }
    expect(basement.olexaCombat.mode).toBe('dead');
    expect(basement.olexaCombat.charred).toBe(true);
    expect(state.medkits.some((m) => m.id === 'olexa-drop-medkit')).toBe(true);
    expect(buildDynamicSceneMeshes(state, 40).opaque.vertexCount).toBeGreaterThan(0);

    // Player hit by NPC flamethrower flame: 30 HP on ignition (non-burning -> burning),
    // 10 HP/sec for 3s, 4x Uzi spread while burnt, and re-hitting resets timer without extra instant damage
    expect(state.playerCharredTimer).toBe(0);
    basement.arjanCombat.mode = 'dead';
    basement.hanneloesCombat.mode = 'dead';
    state.medkits = [];
    state.projectiles = [];
    state.player.health = MAX_PLAYER_HEALTH;
    const hpBeforeFlame = state.player.health;
    const spawnNpcFlameOnPlayer = () => {
      state.projectiles.push({
        kind: 'fireball',
        owner: 'npc',
        sourceNpcKey: 'upstairs:Tanja',
        x: state.player.x + state.player.width * 0.5,
        y: state.player.y + state.player.height * 0.5,
        z: 9.5,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: 0,
        distanceTraveled: 0,
      });
    };
    spawnNpcFlameOnPlayer();
    updateGameState(state, input, 0.02);
    expect(state.playerCharredTimer).toBeCloseTo(3.0, 2);
    expect(hpBeforeFlame - state.player.health).toBeCloseTo(
      30 * PLAYER_DAMAGE_MULTIPLIER,
      4
    );
    expect(buildDynamicSceneMeshes(state, 40).opaque.vertexCount).toBeGreaterThan(0);

    // While burnt, Uzi bullet spread is 4x (+40 deg at Math.random() = 1)
    const origRandomBurn = Math.random;
    try {
      Math.random = () => 1;
      state.projectiles = [];
      state.player.unlockedUzi = true;
      state.player.equippedItem = 'uzi';
      state.player.uziAmmo = 30;
      state.player.uziFireCooldown = 0;
      state.player.yaw = 0;
      applyKeyEvent(input, 'Space', true);
      updateGameState(state, input, 0.02);
      applyKeyEvent(input, 'Space', false);
      const burntBullet = state.projectiles.find((p) => p.kind === 'bullet');
      expect(burntBullet).toBeDefined();
      expect(burntBullet!.yaw).toBeCloseTo((40 * Math.PI) / 180, 4);
      state.projectiles = [];
    } finally {
      Math.random = origRandomBurn;
    }

    // Wait 1.0s (takes 10 HP/sec * 1.0s * PLAYER_DAMAGE_MULTIPLIER), then hit again -> no extra instant damage, resets timer to 3.0s
    const hpBeforeSecondHit = state.player.health;
    updateGameState(state, input, 1.0);
    expect(hpBeforeSecondHit - state.player.health).toBeCloseTo(
      10 * 1.0 * PLAYER_DAMAGE_MULTIPLIER,
      4
    );
    const hpRightBeforeReignite = state.player.health;
    spawnNpcFlameOnPlayer();
    updateGameState(state, input, 0.02);
    expect(state.playerCharredTimer).toBeCloseTo(3.0, 2);
    // Only 0.02s of burn DoT applied (no extra 30 HP ignition damage)
    expect(hpRightBeforeReignite - state.player.health).toBeCloseTo(
      10 * 0.02 * PLAYER_DAMAGE_MULTIPLIER,
      4
    );

    // Let full 3.0s burn finish -> takes remaining 10 * 3.0 * PLAYER_DAMAGE_MULTIPLIER and returns spread to normal
    const hpBeforeFullBurn = state.player.health;
    updateGameState(state, input, 3.1);
    expect(state.playerCharredTimer).toBe(0);
    expect(hpBeforeFullBurn - state.player.health).toBeCloseTo(
      10 * 3.0 * PLAYER_DAMAGE_MULTIPLIER,
      4
    );
    try {
      Math.random = () => 1;
      state.projectiles = [];
      state.player.uziFireCooldown = 0;
      state.player.yaw = 0;
      applyKeyEvent(input, 'Space', true);
      updateGameState(state, input, 0.02);
      applyKeyEvent(input, 'Space', false);
      const unburntBullet = state.projectiles.find((p) => p.kind === 'bullet');
      expect(unburntBullet).toBeDefined();
      expect(unburntBullet!.yaw).toBeCloseTo((10 * Math.PI) / 180, 4);
      state.projectiles = [];
    } finally {
      Math.random = origRandomBurn;
    }

    // 3. Defeating Anne-Marie (500 HP) upstairs drops her katana sword which the player picks up (slot 5) and can swing
    const upState = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-upstairs',
    });
    const upstairs = upState.levels['level-upstairs'];
    expect(upstairs.anneMarieCombat.health).toBe(ANNE_MARIE_MAX_HEALTH);
    upstairs.doors = upstairs.doors.filter((d) => d.id !== 'upstairs-bedroom-door');
    upState.player.unlockedUzi = true;
    upState.player.equippedItem = 'uzi';
    upState.player.x = upstairs.anneMarieNpc.x - 4;
    upState.player.y = upstairs.anneMarieNpc.y + 2 * TILE_SIZE;
    upState.player.yaw = -Math.PI / 2;
    for (let i = 0; i < 80 && upstairs.anneMarieCombat.mode !== 'dead'; i++) {
      upState.player.health = MAX_PLAYER_HEALTH;
      upState.player.x = upstairs.anneMarieNpc.x - 4;
      upState.player.y = upstairs.anneMarieNpc.y + 2 * TILE_SIZE;
      if (upState.activeDialogue) {
        advanceDialogue(upState, input);
        continue;
      }
      applyKeyEvent(input, 'Space', true);
      updateGameState(upState, input, 0.1);
      applyKeyEvent(input, 'Space', false);
    }
    expect(upstairs.anneMarieCombat.mode).toBe('dead');
    expect(upState.droppedKatanas.length).toBe(1);
    // Santa's post-kill one-liner dialogue is delayed by 0.5 seconds
    expect(upState.activeDialogue).toBeNull();
    updateGameState(upState, input, 0.4);
    expect(upState.activeDialogue).toBeNull();
    updateGameState(upState, input, 0.15);
    expect(upState.activeDialogue?.lines).toEqual([
      "I guess it's my turn to...",
      'Take out the trash.',
    ]);
    // Dismiss Santa's post-kill one-liner dialogue
    for (let i = 0; i < 2; i++) {
      advanceDialogue(upState, input);
    }
    expect(upState.activeDialogue).toBeNull();

    // Walk onto dropped katana -> unlocks & equips slot 5 ('katana')
    upState.player.x = upState.droppedKatanas[0].x - 4;
    upState.player.y = upState.droppedKatanas[0].y - 4;
    updateGameState(upState, input, 0.05);
    expect(upState.player.unlockedKatana).toBe(true);
    expect(upState.player.equippedItem).toBe('katana');
    expect(upState.droppedKatanas.length).toBe(0);

    // Swinging katana triggers katanaSwingTimer and builds 3D slash mesh cleanly
    applyKeyEvent(input, 'Space', true);
    updateGameState(upState, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    expect(upState.player.katanaSwingTimer).toBeGreaterThan(0);
    const katanaMesh = buildDynamicSceneMeshes(upState, 40);
    expect(katanaMesh.opaque.vertexCount).toBeGreaterThan(0);
  });

  it('supports Uzi floor swap on Space, upstairs ambush & flamethrower ammo/drops, friendly fire burning, and Rosanna bazooka fight', () => {
    // 1. Spacebar swaps Uzi in hand for floor Uzi, replaying equip animation and swapping magazine ammo
    const state = createGameState({
      showIntroDialogue: false,
      initialLevelId: 'level-basement',
    });
    const input = createEmptyInput();
    state.player.unlockedUzi = true;
    state.player.equippedItem = 'uzi';
    state.player.uziAmmo = 5;
    state.player.uziEquipTimer = 0;

    state.droppedUzis.push({
      levelId: 'level-basement',
      x: state.player.x + 6,
      y: state.player.y + 6,
      z: 0,
      yaw: 0,
      pickupable: true,
      ammo: 30,
    });

    updateGameState(state, input, 0.01);
    expect(state.nearbyInteractable?.id).toBe('swap-floor-uzi');
    expect(state.nearbyInteractable?.promptText).toBe('Swap Uzi');
    expect(state.player.uziAmmo).toBe(5); // Still 5 before pressing Space

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.01);
    applyKeyEvent(input, 'Space', false);

    expect(state.player.uziAmmo).toBe(30);
    expect(state.player.uziEquipTimer).toBeGreaterThan(0);
    expect(state.droppedUzis[0].ammo).toBe(5);

    // 2. Flamethrower has Infinity ammo before upstairs, drops to 10 upstairs, and stops firing at 0
    expect(state.player.flamethrowerAmmo).toBe(Infinity);
    state.player.unlockedFlamethrower = true;
    state.player.equippedItem = 'flamethrower';
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    expect(state.player.flamethrowerAmmo).toBe(Infinity);

    loadLevel(state, 'level-upstairs');
    expect(state.player.flamethrowerAmmo).toBe(10);

    // Consume all 10 flames
    state.player.equippedItem = 'flamethrower';
    for (let i = 0; i < 12; i++) {
      applyKeyEvent(input, 'Space', true);
      updateGameState(state, input, 0.1);
      applyKeyEvent(input, 'Space', false);
    }
    expect(state.player.flamethrowerAmmo).toBe(0);
    const projsAtZero = state.projectiles.length;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.1);
    applyKeyEvent(input, 'Space', false);
    expect(state.projectiles.length).toBeLessThanOrEqual(projsAtZero);

    // 3. Exiting upstairs main hallway west triggers Henrik & Tanja ambush: door opens, camera zooms to door, both hostile with flamethrowers
    const upstairs = state.levels['level-upstairs'] as LevelUpstairs;
    const cam = createCamera3D();
    state.player.x = TABLE_ROOM_AMBUSH_TRIGGER_BOUNDS.x + 3 * TILE_SIZE;
    state.player.y = TABLE_ROOM_AMBUSH_TRIGGER_BOUNDS.y + TILE_SIZE;
    updateGameState(state, input, 0.05);
    updateCamera3D(cam, state, input, 0.05, 256 / 224);

    expect(state.player.states.get(TABLE_ROOM_AMBUSH_STATE_KEY)).toBe(true);
    expect(upstairs.doors.some((d) => d.id === 'upstairs-table-room-door')).toBe(false);
    expect(upstairs.tableRoomAmbushCutscene.active).toBe(true);
    expect(upstairs.henrikCombat.mode).toBe('hostile');
    expect(upstairs.tanjaCombat.mode).toBe('hostile');
    expect(upstairs.henrikCombat.weapon).toBe('flamethrower');
    expect(upstairs.tanjaCombat.weapon).toBe('flamethrower');
    expect(cam.fovY).toBeLessThan((55 * Math.PI) / 180);

    // Friendly fire: place Henrik directly between Tanja and player -> Tanja's flame ignites Henrik
    upstairs.henrikNpc.x = 11 * TILE_SIZE + 2;
    upstairs.henrikNpc.y = 13 * TILE_SIZE;
    upstairs.tanjaNpc.x = 11 * TILE_SIZE + 2;
    upstairs.tanjaNpc.y = 14.5 * TILE_SIZE;
    state.player.x = 11 * TILE_SIZE + 2;
    state.player.y = 11 * TILE_SIZE;
    upstairs.henrikCombat.mode = 'passive';
    upstairs.henrikCombat.path = [];
    upstairs.tanjaCombat.mode = 'hostile';
    upstairs.tanjaCombat.hostileAlertTimer = 0;
    upstairs.tanjaCombat.path = [];
    upstairs.tanjaCombat.pathTimer = 0;
    upstairs.tanjaCombat.fireCooldown = 0;

    for (let i = 0; i < 30 && (upstairs.henrikCombat.mode as string) !== 'burning'; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      updateGameState(state, input, 0.05);
    }
    expect(upstairs.henrikCombat.mode).toBe('burning');

    // Killing Henrik & Tanja drops flamethrowers with 20 flames each
    state.player.unlockedUzi = true;
    state.player.uziAmmo = 30;
    state.player.uziDepleted = false;
    state.player.equippedItem = 'uzi';
    state.player.x = upstairs.tanjaNpc.x;
    state.player.y = upstairs.tanjaNpc.y - 1.75 * TILE_SIZE;
    state.player.yaw = Math.PI / 2;
    upstairs.tanjaCombat.path = [];
    upstairs.tanjaCombat.pathTimer = 1.0;
    applyKeyEvent(input, 'Space', true);
    for (let i = 0; i < 60 && (upstairs.tanjaCombat.mode as string) !== 'dead'; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      state.player.x = upstairs.tanjaNpc.x + 4;
      state.player.y = upstairs.tanjaNpc.y - 1.5 * TILE_SIZE;
      updateGameState(state, input, 0.05);
    }
    applyKeyEvent(input, 'Space', false);
    expect(upstairs.tanjaCombat.mode).toBe('dead');
    expect(state.droppedFlamethrowers.some((d) => d.ammo === 20)).toBe(true);

    const ammoBeforePickup = state.player.flamethrowerAmmo;
    const flameDrop = state.droppedFlamethrowers[0];
    state.player.x = flameDrop.x - 4;
    state.player.y = flameDrop.y - 4;
    updateGameState(state, input, 0.05);
    expect(state.player.flamethrowerAmmo).toBe(ammoBeforePickup + 20);

    // 4. Spawned Rosanna fires walking-speed bazooka rockets that explode for 50 HP mine-style damage & build 3D meshes cleanly
    const bossState = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const bossUp = bossState.levels['level-upstairs'] as LevelUpstairs;
    bossState.player.states.set(KITCHEN_ROSANNA_STATE_KEY, true);
    bossUp.rosannaSpawned = true;
    bossUp.rosannaCombat.mode = 'hostile';
    bossUp.rosannaCombat.hostileAlertTimer = 0;
    bossUp.rosannaCombat.fireCooldown = 0;
    bossState.player.x = 12.5 * TILE_SIZE - 6;
    bossState.player.y = 8 * TILE_SIZE;
    bossState.player.health = MAX_PLAYER_HEALTH;

    updateGameState(bossState, input, 0.05);
    const rocket = bossState.projectiles.find((p) => p.kind === 'rocket');
    expect(rocket).toBeDefined();
    expect(Math.hypot(rocket!.vx, rocket!.vy)).toBeCloseTo(bossState.player.speed * 2, 1);

    const meshWithRocket = buildDynamicSceneMeshes(bossState, 40);
    expect(meshWithRocket.opaque.vertexCount).toBeGreaterThan(0);

    for (let i = 0; i < 30 && bossState.player.health === MAX_PLAYER_HEALTH; i++) {
      updateGameState(bossState, input, 0.05);
    }
    expect(bossState.player.health).toBe(100 - 80 * PLAYER_DAMAGE_MULTIPLIER);
    expect(bossState.explosions.length).toBeGreaterThan(0);
    const meshWithExplosion = buildDynamicSceneMeshes(bossState, 40);
    expect(meshWithExplosion.translucent.vertexCount).toBeGreaterThan(0);
  });

  it('drops bazooka on Rosanna defeat, allows player rocket firing, destroys interior walls/doors over 1s, and blackens indestructible outer border walls/doors', () => {
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const input = createEmptyInput();
    const upstairs = state.levels['level-upstairs'] as LevelUpstairs;
    state.player.states.set(KITCHEN_ROSANNA_STATE_KEY, true);
    upstairs.rosannaSpawned = true;
    upstairs.rosannaCombat.mode = 'hostile';
    upstairs.rosannaCombat.hostileAlertTimer = 0;

    // 1. Rosanna takes 1/5th damage (6 HP per Uzi shot instead of 30) and drops Bazooka on defeat
    state.player.unlockedUzi = true;
    state.player.uziAmmo = 30;
    state.player.uziDepleted = false;
    state.player.equippedItem = 'uzi';
    state.player.x = upstairs.rosannaNpc.x - 4;
    state.player.y = upstairs.rosannaNpc.y + 2.5 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    const prevRosannaHp = upstairs.rosannaCombat.health;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 15 && upstairs.rosannaCombat.health === prevRosannaHp; i++) {
      updateGameState(state, input, 0.01);
    }
    expect(upstairs.rosannaCombat.health).toBeCloseTo(
      prevRosannaHp - PLAYER_UZI_NPC_DAMAGE * 0.2,
      4
    );

    applyKeyEvent(input, 'Space', true);
    for (let i = 0; i < 80 && (upstairs.rosannaCombat.mode as string) !== 'dead'; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      state.player.x = upstairs.rosannaNpc.x - 4;
      state.player.y = upstairs.rosannaNpc.y + 2.2 * TILE_SIZE;
      updateGameState(state, input, 0.1);
    }
    applyKeyEvent(input, 'Space', false);
    expect(upstairs.rosannaCombat.mode).toBe('dead');
    expect(state.droppedBazookas.length).toBe(1);

    // 2. Touch dropped bazooka -> unlocks & equips slot 6 ('bazooka')
    const bazDrop = state.droppedBazookas[0];
    state.player.x = bazDrop.x - 4;
    state.player.y = bazDrop.y - 4;
    updateGameState(state, input, 0.05);
    expect(state.player.unlockedBazooka).toBe(true);
    expect(state.player.equippedItem).toBe('bazooka');
    expect(state.droppedBazookas.length).toBe(0);

    // 3. Fire bazooka east at interior Shower wall (col 16, row 6 -> separates Kitchen and Shower)
    // Put player at (14 * TILE_SIZE, 6 * TILE_SIZE + 2) aiming East (0 rad)
    state.player.x = 14 * TILE_SIZE;
    state.player.y = 6 * TILE_SIZE + 2;
    state.player.yaw = 0;
    state.player.bazookaFireCooldown = 0;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);

    const playerRocket = state.projectiles.find((p) => p.kind === 'rocket' && p.owner === 'player');
    expect(playerRocket).toBeDefined();
    expect(Math.hypot(playerRocket!.vx, playerRocket!.vy)).toBeCloseTo(state.player.speed * 2, 1);

    // Advance until rocket impacts interior wall (col 16, row 6)
    for (let i = 0; i < 30 && state.destroyingWalls.length === 0; i++) {
      state.player.health = MAX_PLAYER_HEALTH;
      updateGameState(state, input, 0.05);
    }
    expect(state.destroyingWalls.some((w) => w.col === 16 && w.row === 6)).toBe(true);
    // Wall is squishing/fading dynamically for 1.0s and not yet deleted at 0.4s
    updateGameState(state, input, 0.4);
    expect(state.destroyingWalls.some((w) => w.col === 16 && w.row === 6)).toBe(true);
    expect(upstairs.map.tiles[6][16]).toBe(TileType.InteriorWall);
    const animMesh = buildDynamicSceneMeshes(state, 40);
    expect(animMesh.translucent.vertexCount).toBeGreaterThan(0);

    // Complete 1.0s destruction animation -> wall tile is deleted to floor and passable!
    updateGameState(state, input, 0.7);
    expect(state.destroyingWalls.some((w) => w.col === 16 && w.row === 6)).toBe(false);
    expect(upstairs.map.tiles[6][16]).not.toBe(TileType.InteriorWall);
    expect(upstairs.doors.find((d) => d.id === 'upstairs-shower-door')?.hiddenRegions.length).toBe(0);

    // Also shooting an interior door (e.g. upstairs-bedroom-door at col 24, row 10) destroys it over 1s
    state.player.x = 24 * TILE_SIZE + 2;
    state.player.y = 11.5 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    state.player.bazookaFireCooldown = 0;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 20 && state.destroyingDoors.length === 0; i++) {
      updateGameState(state, input, 0.05);
    }
    expect(state.destroyingDoors.some((d) => d.doorId === 'upstairs-bedroom-door')).toBe(true);
    // Blowing up the bedroom door also makes Anne-Marie hostile & triggers her first-time dialogue after 0.5s
    expect(upstairs.anneMarieCombat.mode).toBe('hostile');
    updateGameState(state, input, 1.05);
    while (state.activeDialogue) {
      applyKeyEvent(input, 'Space', true);
      updateGameState(state, input, 0.02);
      applyKeyEvent(input, 'Space', false);
    }
    expect(upstairs.doors.some((d) => d.id === 'upstairs-bedroom-door')).toBe(false);

    // 4. Shooting an outer border wall (e.g. row 4 north outer wall of house at col 13) turns it black but NEVER destroys it!
    state.player.x = 13 * TILE_SIZE + 2;
    state.player.y = 5.5 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    state.player.bazookaFireCooldown = 0;
    const prevVersion = state.mapVersion;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 20 && state.mapVersion === prevVersion; i++) {
      updateGameState(state, input, 0.05);
    }
    expect(state.blackenedWalls.has('level-upstairs:13,4')).toBe(true);
    expect(state.destroyingWalls.some((w) => w.row === 4)).toBe(false);
    updateGameState(state, input, 1.5);
    expect(upstairs.map.tiles[4][13]).toBe(TileType.InteriorWall);
    const staticWithBlackWall = getStaticLevelMesh(state.currentLevelId, state.map, state);
    expect(staticWithBlackWall.vertexCount).toBeGreaterThan(0);

    // 5. Basement outer Front Door (cols 15..16, row 20) turns black but remains indestructible
    loadLevel(state, 'level-basement');
    const basement = state.levels['level-basement'];
    state.player.x = 15.5 * TILE_SIZE;
    state.player.y = 18.5 * TILE_SIZE;
    state.player.yaw = Math.PI / 2;
    state.player.bazookaFireCooldown = 0;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 20 && !state.blackenedWalls.has('level-basement:15,20'); i++) {
      updateGameState(state, input, 0.05);
    }
    expect(state.blackenedWalls.has('level-basement:15,20')).toBe(true);
    expect(state.blackenedWalls.has('level-basement:16,20')).toBe(true);
    updateGameState(state, input, 1.5);
    expect(basement.map.tiles[20][15]).toBe(TileType.InteriorWall);
    expect(basement.map.tiles[20][16]).toBe(TileType.InteriorWall);
  });
});

describe('Hostile armored headcrab cat', () => {
  it('takes 1/10th damage from all player weapons and turns hostile', () => {
    const state = createGameState();
    loadLevel(state, 'level-upstairs');
    const upstairs = state.levels['level-upstairs'];
    const cat = upstairs.cat;
    const input = createEmptyInput();

    // Unlock all weapons so we can test every damage source cleanly
    state.player.unlockedUzi = true;
    state.player.uziAmmo = 30;
    state.player.unlockedFlamethrower = true;
    state.player.flamethrowerAmmo = 20;
    state.player.unlockedKatana = true;
    state.player.unlockedBazooka = true;

    // Place player & cat in clear open floor (extra room cols 26..27, rows 12..17)
    // Offset cat slightly east (+4.8px) to line up squarely with Santa's right-shoulder weapon muzzle
    state.player.x = 26.2 * TILE_SIZE;
    state.player.y = 15.8 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    cat.x = state.player.x + 4.8;
    cat.y = 14.8 * TILE_SIZE;

    // 1. Uzi shot -> 1/10th of PLAYER_UZI_NPC_DAMAGE & turns hostile
    selectPlayerEquipmentSlot(state.player, 3);
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 15 && cat.mode !== 'hostile'; i++) {
      updateGameState(state, input, 0.01);
    }
    expect(cat.mode).toBe('hostile');
    expect(cat.health).toBeCloseTo(
      MAX_CAT_HEALTH - PLAYER_UZI_NPC_DAMAGE * CAT_ARMOR_DAMAGE_MULTIPLIER,
      4
    );

    // Reset mode to standing and test Flamethrower
    cat.mode = 'standing';
    const healthAfterUzi = cat.health;
    state.player.x = 26.2 * TILE_SIZE;
    state.player.y = 15.8 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    cat.x = state.player.x + 4.5;
    cat.y = 14.0 * TILE_SIZE;
    selectPlayerEquipmentSlot(state.player, 4);
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 40 && (cat.mode as string) !== 'hostile'; i++) {
      updateGameState(state, input, 0.02);
    }
    expect(cat.mode).toBe('hostile');
    expect(cat.health).toBeCloseTo(
      healthAfterUzi - PLAYER_FIREBALL_NPC_DAMAGE * CAT_ARMOR_DAMAGE_MULTIPLIER,
      4
    );

    // Reset mode to flee and test Katana slash
    cat.mode = 'flee';
    const healthAfterFlame = cat.health;
    cat.x = 26.5 * TILE_SIZE;
    cat.y = 15.0 * TILE_SIZE;
    state.player.x = 26.5 * TILE_SIZE;
    state.player.y = 15.8 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    selectPlayerEquipmentSlot(state.player, 5);
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    expect(cat.mode).toBe('hostile');
    expect(cat.health).toBeCloseTo(
      healthAfterFlame - PLAYER_KATANA_NPC_DAMAGE * CAT_ARMOR_DAMAGE_MULTIPLIER,
      4
    );

    // Reset mode & health to standing and test Unarmed punch
    cat.mode = 'standing';
    cat.health = MAX_CAT_HEALTH;
    cat.vx = 0;
    cat.vy = 0;
    const healthAfterKatana = cat.health;
    cat.x = 26.5 * TILE_SIZE;
    cat.y = 15.2 * TILE_SIZE;
    state.player.x = 26.5 * TILE_SIZE;
    state.player.y = 15.8 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    selectPlayerEquipmentSlot(state.player, 2);
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    expect(cat.mode).toBe('hostile');
    expect(cat.health).toBeCloseTo(
      healthAfterKatana - PLAYER_PUNCH_NPC_DAMAGE * CAT_ARMOR_DAMAGE_MULTIPLIER,
      4
    );

    // Reset mode to standing and test Bazooka blast
    cat.mode = 'standing';
    cat.vx = 0;
    cat.vy = 0;
    const healthAfterPunch = cat.health;
    state.player.x = 26.2 * TILE_SIZE;
    state.player.y = 16.0 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    cat.x = state.player.x + 4.0;
    cat.y = 14.2 * TILE_SIZE;
    selectPlayerEquipmentSlot(state.player, 6);
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 40 && (cat.mode as string) !== 'hostile'; i++) {
      updateGameState(state, input, 0.02);
    }
    expect(cat.mode).toBe('hostile');
    expect(cat.health).toBeCloseTo(
      healthAfterPunch - BASEMENT_MINE_EXPLOSION_DAMAGE * CAT_ARMOR_DAMAGE_MULTIPLIER,
      4
    );
  });

  it('leaps like a headcrab, latches on Santa face dealing 5 HP/sec for 10s, then flees and can re-aggro', () => {
    const state = createGameState();
    loadLevel(state, 'level-upstairs');
    const upstairs = state.levels['level-upstairs'];
    const cat = upstairs.cat;
    const input = createEmptyInput();

    cat.x = 26.5 * TILE_SIZE;
    cat.y = 12.2 * TILE_SIZE;
    state.player.x = 26.5 * TILE_SIZE;
    state.player.y = 16.0 * TILE_SIZE;
    state.player.health = MAX_PLAYER_HEALTH;

    // Trigger hostile state (normal 1.0x damage on 500 HP cat)
    expect(isCatBillboardVisible(cat)).toBe(false);
    expect(applyCatDamage(cat, 30)).toBe(true);
    expect(cat.mode).toBe('hostile');
    expect(isCatBillboardVisible(cat)).toBe(true);
    expect(cat.health).toBeCloseTo(MAX_CAT_HEALTH - 30, 4);

    // During leap toward player, cat becomes airborne (jumpZ > 0) and renders arched red mesh
    let maxJumpZ = 0;
    for (let i = 0; i < 40 && cat.mode === 'hostile'; i++) {
      updateGameState(state, input, 0.05);
      maxJumpZ = Math.max(maxJumpZ, cat.jumpZ);
    }
    expect(maxJumpZ).toBeGreaterThan(5);

    // Ensure 3D dynamic mesh builds cleanly while hostile and latched
    const latchedMesh = buildDynamicSceneMeshes(state, 0.05);
    expect(latchedMesh.opaque.vertexCount).toBeGreaterThan(0);

    // It should reach and latch onto the RIGHT side of Santa's face
    expect(cat.mode).toBe('latched');
    expect(isCatBillboardVisible(cat)).toBe(true);
    expect(cat.jumpZ).toBeGreaterThan(10);
    const playerYaw = state.player.yaw ?? 0;
    const rightAngle = playerYaw + Math.PI / 2;
    const relX = (cat.x + cat.width * 0.5) - (state.player.x + state.player.width * 0.5);
    const relY = (cat.y + cat.height * 0.5) - (state.player.y + state.player.height * 0.5);
    const rightProj = relX * Math.cos(rightAngle) + relY * Math.sin(rightAngle);
    expect(rightProj).toBeGreaterThan(2.5);

    // While latched, projectiles cannot hit the cat
    const catHpBeforeShot = cat.health;
    state.player.unlockedUzi = true;
    state.player.equippedItem = 'uzi';
    state.player.uziAmmo = 30;
    state.player.uziFireCooldown = 0;
    state.projectiles.push({
      kind: 'bullet',
      x: cat.x + cat.width * 0.5,
      y: cat.y + cat.height * 0.5,
      z: cat.jumpZ,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      distanceTraveled: 0,
      owner: 'player',
    });
    updateGameState(state, input, 0.02);
    expect(cat.health).toBe(catHpBeforeShot);

    // While latched, firing the Uzi has 4x bullet spread (+40 deg at Math.random() = 1)
    const origRandom = Math.random;
    try {
      Math.random = () => 1;
      state.projectiles = [];
      state.player.equippedItem = 'uzi';
      state.player.uziAmmo = 30;
      state.player.uziFireCooldown = 0;
      state.player.yaw = 0;
      applyKeyEvent(input, 'Space', true);
      updateGameState(state, input, 0.02);
      applyKeyEvent(input, 'Space', false);
      const latchedBullet = state.projectiles.find((p) => p.kind === 'bullet');
      expect(latchedBullet).toBeDefined();
      expect(latchedBullet!.yaw).toBeCloseTo((40 * Math.PI) / 180, 4);
    } finally {
      Math.random = origRandom;
    }

    // While latched, punching with 'unarmed' deals 5x damage to the cat
    state.player.equippedItem = 'unarmed';
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    expect(cat.health).toBeCloseTo(
      catHpBeforeShot - PLAYER_PUNCH_NPC_DAMAGE * 5,
      4
    );

    // Stay latched for the remaining latch duration -> takes 5 HP per second = 50 HP total
    const healthBeforeLatch = state.player.health;
    for (let i = 0; i < 100; i++) {
      updateGameState(state, input, 0.1);
    }

    expect(state.player.health).toBe(
      healthBeforeLatch -
        CAT_LATCH_DURATION_SECONDS *
          CAT_LATCH_DAMAGE_PER_SECOND *
          PLAYER_DAMAGE_MULTIPLIER
    );
    // Right after 10 seconds, cat jumps off and becomes non-hostile ('flee')
    expect(cat.mode).toBe('flee');
    expect(cat.jumpZ).toBe(0);

    // As soon as the cat stops face-hugging, Uzi spread returns to normal (+10 deg at Math.random() = 1)
    try {
      Math.random = () => 1;
      state.projectiles = [];
      state.player.equippedItem = 'uzi';
      state.player.uziAmmo = 30;
      state.player.uziFireCooldown = 0;
      state.player.yaw = Math.PI;
      applyKeyEvent(input, 'Space', true);
      updateGameState(state, input, 0.02);
      applyKeyEvent(input, 'Space', false);
      const normalBullet = state.projectiles.find((p) => p.kind === 'bullet');
      expect(normalBullet).toBeDefined();
      expect(normalBullet!.yaw - Math.PI).toBeCloseTo((10 * Math.PI) / 180, 4);
      state.projectiles = [];
    } finally {
      Math.random = origRandom;
    }

    // Stepping while fleeing moves it away and deals no further damage
    const healthAfterJumpOff = state.player.health;
    const distAtJumpOff = Math.hypot(
      cat.x - state.player.x,
      cat.y - state.player.y
    );
    for (let i = 0; i < 10; i++) {
      updateGameState(state, input, 0.05);
    }
    expect(state.player.health).toBe(healthAfterJumpOff);
    expect(Math.hypot(cat.x - state.player.x, cat.y - state.player.y)).toBeGreaterThan(
      distAtJumpOff
    );

    // Damaging the cat again turns it hostile again
    expect(applyCatDamage(cat, 30)).toBe(true);
    expect(cat.mode).toBe('hostile');

    // Draining remaining armor HP kills the cat cleanly
    applyCatDamage(cat, 2000);
    expect(cat.mode).toBe('dead');
    expect(cat.health).toBe(0);
    expect(isCatBillboardVisible(cat)).toBe(false);
    const deadMesh = buildDynamicSceneMeshes(state, 0.2);
    expect(deadMesh.opaque.vertexCount).toBeGreaterThan(0);
  });

  it('supports kitchen medkit, damage red flash, body armor 200 HP navy bar, wall-breach NPC aggro, and Anne-Marie Rudolph confession dialogue', () => {
    const state = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const upstairs = state.levels['level-upstairs'];
    const input = createEmptyInput();
    state.player.states.set(KITCHEN_ROSANNA_STATE_KEY, true);

    // 1. Kitchen medkit exists & heals +50 HP on touch; taking damage triggers red flash timer (all damage halved)
    expect(state.medkits.some((m) => m.id === 'upstairs-kitchen-medkit')).toBe(true);
    damagePlayer(state, 120); // 120 * 0.5 = 60 actual damage -> 40 HP
    expect(state.player.health).toBe(40);
    expect(state.damageFlashTimer).toBeGreaterThan(0);
    updateGameState(state, input, 0.35);
    expect(state.damageFlashTimer).toBe(0);

    state.player.x = UPSTAIRS_KITCHEN_MEDKIT_POS.x - 4;
    state.player.y = UPSTAIRS_KITCHEN_MEDKIT_POS.y - 4;
    updateGameState(state, input, 0.05);
    expect(state.player.health).toBe(90);
    expect(state.medkits.some((m) => m.id === 'upstairs-kitchen-medkit')).toBe(false);

    // 2. Military-grade body armor in upstairs bathroom increases max HP to 200 & restores to 200
    upstairs.doors = upstairs.doors.filter((d) => d.id !== 'upstairs-shower-door');
    const armorMeshBefore = buildDynamicSceneMeshes(state, 40);
    expect(armorMeshBefore.opaque.vertexCount).toBeGreaterThan(0);

    state.player.x = UPSTAIRS_BODY_ARMOR_BOUNDS.x;
    state.player.y = UPSTAIRS_BODY_ARMOR_BOUNDS.y + UPSTAIRS_BODY_ARMOR_BOUNDS.height + 2;
    updateGameState(state, input, 0.02);
    expect(state.nearbyInteractable?.id).toBe('upstairs-body-armor');
    expect(state.nearbyInteractable?.promptText).toBe('Take Body Armor');

    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    expect(state.player.hasBodyArmor).toBe(true);
    expect(state.player.maxHealth).toBe(ARMOR_MAX_PLAYER_HEALTH);
    expect(state.player.health).toBe(200);
    expect(state.player.states.get(BODY_ARMOR_TAKEN_KEY)).toBe(true);
    // Dismiss pickup dialogue
    advanceDialogue(state, input);

    // Armor bar renders in navy blue (#1e3a8a) underneath the red health bar
    const fills: string[] = [];
    const mockCtx = {
      canvas: { width: 320, height: 224 },
      save: () => {},
      restore: () => {},
      set fillStyle(v: string) {
        fills.push(v);
      },
      strokeStyle: '',
      lineWidth: 1,
      fillRect: () => {},
      strokeRect: () => {},
    } as unknown as CanvasRenderingContext2D;
    drawHealthBar(mockCtx, state.player);
    expect(fills).toContain('#1e3a8a');

    // Damage drains armor (200 -> 140) before touching base 0..100 HP (damage halved: 120 * 0.5 = 60)
    damagePlayer(state, 120);
    expect(state.player.health).toBe(140);
    // Above 100 HP (armor active): medkits cannot be picked up
    state.medkits.push({
      id: 'armor-cap-test-medkit',
      levelId: 'level-upstairs',
      x: state.player.x + 4,
      y: state.player.y + 4,
      z: 0,
    });
    updateGameState(state, input, 0.02);
    expect(state.player.health).toBe(140);
    expect(state.medkits.some((m) => m.id === 'armor-cap-test-medkit')).toBe(true);

    // Drop below 100 HP (140 -> 80): picking up medkit (+50) caps at 100 HP without healing armor
    damagePlayer(state, 120);
    expect(state.player.health).toBe(80);
    updateGameState(state, input, 0.02);
    expect(state.player.health).toBe(MAX_PLAYER_HEALTH);
    expect(state.medkits.some((m) => m.id === 'armor-cap-test-medkit')).toBe(false);

    // 3. Blowing up a wall around Anne-Marie's bedroom makes her hostile & triggers her Rudolph confession dialogue
    state.player.unlockedBazooka = true;
    state.player.equippedItem = 'bazooka';
    state.player.x = 22 * TILE_SIZE + 2;
    state.player.y = 11.5 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    state.player.bazookaFireCooldown = 0;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 20 && upstairs.anneMarieCombat.mode === 'passive'; i++) {
      updateGameState(state, input, 0.05);
    }
    expect(upstairs.anneMarieCombat.mode).toBe('hostile');
    // Anne-Marie's initial confession dialogue is delayed by 0.5s
    expect(state.activeDialogue).toBeNull();
    updateGameState(state, input, 0.4);
    expect(state.activeDialogue).toBeNull();
    updateGameState(state, input, 0.15);
    expect(state.player.states.get(ANNE_MARIE_HOSTILE_DIALOGUE_KEY)).toBe(true);
    expect(state.activeDialogue?.speakerPortrait).toBe('Anne-Marie');
    expect(state.activeDialogue?.lines).toEqual([...ANNE_MARIE_HOSTILE_DIALOGUE_LINES]);

    // Advancing through Anne-Marie's reveal chains into the "Murder-mystery solved." achievement banner
    for (let i = 0; i < ANNE_MARIE_HOSTILE_DIALOGUE_LINES.length; i++) {
      advanceDialogue(state, input);
    }
    expect(state.activeDialogue?.variant).toBe('achievement');
    expect(state.activeDialogue?.lines).toEqual([
      'ACHIEVEMENT UNLOCKED: Murder-mystery solved.',
    ]);
    // Dismiss achievement banner and verify Anne-Marie runs at 2x speed (48 px/s) normally,
    // and sprints at 4x speed (96 px/s) for 0.5s every 2.5s
    advanceDialogue(state, input);
    upstairs.anneMarieCombat.hostileAlertTimer = 0;
    upstairs.anneMarieCombat.pathTimer = 0;
    upstairs.anneMarieSprintCycleTimer = 0;
    upstairs.anneMarieNpc.x = 24 * TILE_SIZE + 2;
    upstairs.anneMarieNpc.y = 5.2 * TILE_SIZE;
    state.player.x = 24 * TILE_SIZE + 2;
    state.player.y = 9.5 * TILE_SIZE;
    const amStartY = upstairs.anneMarieNpc.y;
    for (let i = 0; i < 10; i++) {
      updateGameState(state, input, 0.05);
    }
    const normalDist = upstairs.anneMarieNpc.y - amStartY;
    expect(normalDist).toBeGreaterThan(20); // > normal 12px in 0.5s (2x = 24px)
    expect(normalDist).toBeLessThan(30);

    // Advance into the 0.5s sprint window (t = 2.0s..2.5s) and verify 4x speed (~48px in 0.5s)
    upstairs.anneMarieNpc.x = 24 * TILE_SIZE + 2;
    upstairs.anneMarieNpc.y = 5.2 * TILE_SIZE;
    upstairs.anneMarieCombat.pathTimer = 0;
    upstairs.anneMarieSprintCycleTimer = 2.0;
    const sprintStartY = upstairs.anneMarieNpc.y;
    for (let i = 0; i < 10; i++) {
      updateGameState(state, input, 0.05);
    }
    const sprintDist = upstairs.anneMarieNpc.y - sprintStartY;
    expect(sprintDist).toBeGreaterThan(40); // 4x speed = 48px in 0.5s

    // Verify Anne-Marie takes 25% less damage (e.g. 15-damage punch -> 11.25 damage)
    const hpBeforeHit = upstairs.anneMarieCombat.health;
    upstairs.anneMarieNpc.x = 24 * TILE_SIZE + 2;
    upstairs.anneMarieNpc.y = 6 * TILE_SIZE;
    state.player.equippedItem = 'unarmed';
    state.player.x = upstairs.anneMarieNpc.x;
    state.player.y = upstairs.anneMarieNpc.y + 12;
    state.player.yaw = -Math.PI / 2;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    expect(hpBeforeHit - upstairs.anneMarieCombat.health).toBeCloseTo(11.25, 2);
    state.player.equippedItem = 'bazooka';

    // 4. Blowing up a wall around the basement bathroom makes Hanneloes active & hostile
    loadLevel(state, 'level-basement');
    const basement = state.levels['level-basement'];
    state.activeDialogue = null;
    state.player.x = 19 * TILE_SIZE;
    state.player.y = 13.5 * TILE_SIZE;
    state.player.yaw = -Math.PI / 2;
    state.player.bazookaFireCooldown = 0;
    applyKeyEvent(input, 'Space', true);
    updateGameState(state, input, 0.02);
    applyKeyEvent(input, 'Space', false);
    for (let i = 0; i < 20 && basement.hanneloesCombat.mode === 'passive'; i++) {
      updateGameState(state, input, 0.05);
    }
    expect(basement.hanneloesCombat.mode).toBe('hostile');

    // 5. Game Over inside the house -> "Try again?" respawns at start of basement with Uzi (30 ammo), facing south
    const indoorState = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const retryInput = createEmptyInput();
    retryInput.cameraYaw = -Math.PI / 2;
    damagePlayer(indoorState, 200);
    expect(indoorState.gameOver).toBe(true);
    expect(indoorState.activeDialogue?.lines).toEqual(['Try again?']);
    advanceDialogue(indoorState, retryInput);
    expect(indoorState.gameOver).toBe(false);
    expect(indoorState.currentLevelId).toBe('level-basement');
    expect(indoorState.player.x).toBe(BASEMENT_FIREPLACE_SPAWN.x);
    expect(indoorState.player.y).toBe(BASEMENT_FIREPLACE_SPAWN.y);
    expect(indoorState.player.unlockedUzi).toBe(true);
    expect(indoorState.player.equippedItem).toBe('uzi');
    expect(indoorState.player.uziAmmo).toBe(MAX_UZI_AMMO);
    expect(indoorState.player.facing).toBe('down');
    expect(indoorState.player.yaw).toBeCloseTo(Math.PI / 2, 4);
    expect(retryInput.cameraYaw).toBeCloseTo(Math.PI / 2, 4);

    // Game Over outside before entering the house still resets to level-outside
    const outdoorState = createGameState({
      initialLevelId: 'level-outside',
      showIntroDialogue: false,
    });
    damagePlayer(outdoorState, 200);
    expect(outdoorState.gameOver).toBe(true);
    advanceDialogue(outdoorState, retryInput);
    expect(outdoorState.gameOver).toBe(false);
    expect(outdoorState.currentLevelId).toBe('level-outside');

    // 6. Player bazooka explosion still deals 50 HP to NPCs
    const npcBlastState = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const upLvl = npcBlastState.levels['level-upstairs'];
    npcBlastState.player.unlockedBazooka = true;
    npcBlastState.player.equippedItem = 'bazooka';
    npcBlastState.player.x = upLvl.dianaNpc.x;
    npcBlastState.player.y = upLvl.dianaNpc.y + 1.5 * TILE_SIZE;
    npcBlastState.player.yaw = -Math.PI / 2;
    npcBlastState.player.bazookaFireCooldown = 0;
    const dianaStartHp = upLvl.dianaCombat.health;
    applyKeyEvent(retryInput, 'Space', true);
    updateGameState(npcBlastState, retryInput, 0.02);
    applyKeyEvent(retryInput, 'Space', false);
    for (let i = 0; i < 20 && upLvl.dianaCombat.health === dianaStartHp; i++) {
      updateGameState(npcBlastState, retryInput, 0.02);
    }
    expect(upLvl.dianaCombat.health).toBe(dianaStartHp - 50);

    // 7. Outside HUD visibility: equipment & full-HP health bar hidden until Rudolph interaction / Uzi unlock
    const hudOutside = createGameState({
      initialLevelId: 'level-outside',
      showIntroDialogue: false,
    });
    expect(shouldShowEquipmentHud(hudOutside)).toBe(false);
    expect(shouldShowHealthBar(hudOutside)).toBe(false);

    // Taking damage outside reveals health bar, while equipment HUD remains hidden
    damagePlayer(hudOutside, 10);
    expect(shouldShowHealthBar(hudOutside)).toBe(true);
    expect(shouldShowEquipmentHud(hudOutside)).toBe(false);

    // After interacting with Rudolph on the roof, all HUD elements are displayed at full health
    setPlayerHealth(hudOutside.player, MAX_PLAYER_HEALTH);
    hudOutside.player.delayedHealth = MAX_PLAYER_HEALTH;
    hudOutside.player.states.set(RUDOLPH_INSPECTED_KEY, true);
    expect(shouldShowEquipmentHud(hudOutside)).toBe(true);
    expect(shouldShowHealthBar(hudOutside)).toBe(true);

    // 8. Toggle weapon cycles through obtained items (1, 2, 3, ... wrapping back to 1) skipping unobtained items
    const p = createPlayer(0, 0);
    p.unlockedUzi = true;
    p.unlockedBazooka = true; // flamethrower & katana not obtained
    expect(p.equippedItem).toBe('empty');
    expect(cyclePlayerEquipmentSlot(p)).toBe('unarmed');
    expect(cyclePlayerEquipmentSlot(p)).toBe('uzi');
    expect(cyclePlayerEquipmentSlot(p)).toBe('bazooka');
    expect(cyclePlayerEquipmentSlot(p)).toBe('empty');

    // Mobile basement entry dialogue explains tap-and-hold firing
    const mobileRoofState = createGameState({
      initialLevelId: 'level-outside',
      isMobile: true,
      showIntroDialogue: false,
    });
    mobileRoofState.joystickActive = true;
    mobileRoofState.isOnRoof = true;
    mobileRoofState.player.unlockedUzi = true;
    mobileRoofState.player.x = ROOF_CHIMNEY_BOUNDS.x;
    mobileRoofState.player.y = ROOF_CHIMNEY_BOUNDS.y + ROOF_CHIMNEY_BOUNDS.height + 2;
    const mobInput = createEmptyInput();
    applyKeyEvent(mobInput, 'Space', true);
    updateGameState(mobileRoofState, mobInput, 0.02);
    applyKeyEvent(mobInput, 'Space', false);
    expect(mobileRoofState.currentLevelId).toBe('level-basement');
    expect(mobileRoofState.activeDialogue?.lines).toEqual([
      'You better run, Santa Claus is coming to town.',
      'Tap anywhere inside the game screen to fire your weapon (hold to keep firing).',
    ]);

    // 9. Mobile flamethrower pickup suppresses the "Use the number keys to change weapon." dialog
    const mobBase = createGameState({
      initialLevelId: 'level-basement',
      isMobile: true,
      showIntroDialogue: false,
    });
    mobBase.levels['level-basement'].spaDoorClosed = false;
    mobBase.player.x = BASEMENT_FLAMETHROWER_BOUNDS.x + 2;
    mobBase.player.y = BASEMENT_FLAMETHROWER_BOUNDS.y + 2;
    updateGameState(mobBase, createEmptyInput(), 0.05);
    expect(mobBase.player.unlockedFlamethrower).toBe(true);
    expect(mobBase.activeDialogue).toBeNull();

    // 10. Mobile-only auto-aim: aims at closest hostile NPC in FOV when right joystick is idle, disabled when right joystick is used or on desktop
    const aimState = createGameState({
      initialLevelId: 'level-upstairs',
      isMobile: true,
      showIntroDialogue: false,
    });
    const aimUp = aimState.levels['level-upstairs'];
    aimState.player.states.set(KITCHEN_ROSANNA_STATE_KEY, true);
    aimState.player.x = 4 * TILE_SIZE;
    aimState.player.y = 14 * TILE_SIZE;
    aimState.player.yaw = -Math.PI / 2;
    // Diana (closer) & Simon (farther) both hostile inside FOV
    aimUp.dianaNpc.x = 5 * TILE_SIZE;
    aimUp.dianaNpc.y = 12 * TILE_SIZE;
    aimUp.dianaCombat.mode = 'hostile';
    aimUp.dianaCombat.hostileAlertTimer = 1.0;
    aimUp.simonNpc.x = 6 * TILE_SIZE;
    aimUp.simonNpc.y = 11 * TILE_SIZE;
    aimUp.simonCombat.mode = 'hostile';
    aimUp.simonCombat.hostileAlertTimer = 1.0;

    const expectedDianaAngle = Math.atan2(
      aimUp.dianaNpc.y + aimUp.dianaNpc.height * 0.5 - (aimState.player.y + aimState.player.height * 0.5),
      aimUp.dianaNpc.x + aimUp.dianaNpc.width * 0.5 - (aimState.player.x + aimState.player.width * 0.5)
    );

    const aimInput = createEmptyInput();
    aimInput.cameraYaw = -Math.PI / 2;
    updateGameState(aimState, aimInput, 0.05);
    expect(aimState.player.yaw).toBeCloseTo(expectedDianaAngle, 2);

    // When right joystick is actively used, auto-aim does NOT trigger
    aimState.player.yaw = -Math.PI / 2;
    aimInput.cameraYaw = -Math.PI / 2;
    aimInput.cameraLookVector = { x: 0.7, y: 0 };
    updateGameState(aimState, aimInput, 0.05);
    expect(aimState.player.yaw).not.toBeCloseTo(expectedDianaAngle, 2);

    // On desktop (joystickActive = false), auto-aim does NOT trigger
    aimState.joystickActive = false;
    aimState.player.yaw = -Math.PI / 2;
    aimInput.cameraLookVector = null;
    aimInput.cameraYaw = -Math.PI / 2;
    updateGameState(aimState, aimInput, 0.05);
    expect(aimState.player.yaw).toBeCloseTo(-Math.PI / 2, 2);

    // 11. Screen blinks yellow when firing a weapon with ammo, and does not blink when out of ammo
    const flashState = createGameState({
      initialLevelId: 'level-upstairs',
      showIntroDialogue: false,
    });
    const flashInput = createEmptyInput();
    flashState.player.unlockedUzi = true;
    flashState.player.equippedItem = 'uzi';
    flashState.player.uziAmmo = 5;
    applyKeyEvent(flashInput, 'Space', true);
    updateGameState(flashState, flashInput, 0.01);
    applyKeyEvent(flashInput, 'Space', false);
    expect(flashState.fireFlashTimer).toBeGreaterThan(0);

    updateGameState(flashState, flashInput, 0.1);
    expect(flashState.fireFlashTimer).toBe(0);

    // Out-of-ammo flamethrower does NOT trigger yellow flash
    flashState.player.unlockedFlamethrower = true;
    flashState.player.equippedItem = 'flamethrower';
    flashState.player.flamethrowerAmmo = 0;
    applyKeyEvent(flashInput, 'Space', true);
    updateGameState(flashState, flashInput, 0.01);
    applyKeyEvent(flashInput, 'Space', false);
    expect(flashState.fireFlashTimer).toBe(0);

    // 12. N64 chiptune music & sound effects trigger for interactions, footsteps, animals, doors, weapons, fire/embers, rockets, explosions, and window break
    const sfxState = createGameState({
      initialLevelId: 'level-outside',
      showIntroDialogue: false,
    });
    const sfxInput = createEmptyInput();
    soundManager.clearRecentEvents();

    // Outside peaceful Christmas music & snow footsteps (walk on snow lawn at col 6, row 20)
    sfxState.player.x = 6 * TILE_SIZE;
    sfxState.player.y = 20 * TILE_SIZE;
    sfxInput.up = true;
    updateGameState(sfxState, sfxInput, 0.2);
    sfxInput.up = false;
    expect(soundManager.getCurrentMusicTrack()).toBe('peaceful_xmas');
    expect(soundManager.getRecentEvents()).toContain('footstep_snow');

    // Dog chasing -> dog_bark (move Santa within dog aggro distance)
    sfxState.player.x = sfxState.dog.x - 24;
    sfxState.player.y = sfxState.dog.y;
    updateGameState(sfxState, sfxInput, 0.05);
    expect(soundManager.getRecentEvents()).toContain('dog_bark');

    // Locked front door -> door_locked & dialogue_open; advancing -> dialogue_advance
    sfxState.player.x = HOUSE_DOOR_COL * TILE_SIZE;
    sfxState.player.y = (HOUSE_DOOR_ROW + 1) * TILE_SIZE + 2;
    updateGameState(sfxState, sfxInput, 0.01);
    applyKeyEvent(sfxInput, 'Space', true);
    updateGameState(sfxState, sfxInput, 0.02);
    applyKeyEvent(sfxInput, 'Space', false);
    expect(soundManager.getRecentEvents()).toContain('door_locked');
    expect(soundManager.getRecentEvents()).toContain('dialogue_open');
    advanceDialogue(sfxState, sfxInput);
    expect(soundManager.getRecentEvents()).toContain('dialogue_advance');
    sfxState.activeDialogue = null;

    // Upstairs outside of boss fights still plays peaceful_xmas (even after Rudolph/Uzi)
    sfxState.player.states.set(RUDOLPH_INSPECTED_KEY, true);
    sfxState.player.unlockedUzi = true;
    loadLevel(sfxState, 'level-upstairs');
    const sfxUp = sfxState.levels['level-upstairs'];
    updateGameState(sfxState, sfxInput, 0.05);
    expect(soundManager.getCurrentMusicTrack()).toBe('peaceful_xmas');
    soundManager.clearRecentEvents();

    // Trigger Rosanna window break sound during jumping phase -> boss music (action_xmas)
    sfxUp.rosannaCutscene = {
      active: true,
      phase: 'firing',
      santaX: 11 * TILE_SIZE,
      santaY: 2.5 * TILE_SIZE,
      santaZ: 2,
      facingAngle: Math.PI / 2,
      walkTimer: 0,
      elapsed: 2.3,
      firedShot: true,
    };
    updateGameState(sfxState, sfxInput, 0.1);
    expect(soundManager.getCurrentMusicTrack()).toBe('action_xmas');
    expect(soundManager.getRecentEvents()).toContain('window_break');
    sfxUp.rosannaCutscene = null;
    sfxUp.rosannaSpawned = true;
    updateGameState(sfxState, sfxInput, 0.05);
    expect(soundManager.getCurrentMusicTrack()).toBe('action_xmas');
    // Defeating Rosanna returns music to peaceful_xmas
    sfxUp.rosannaCombat.mode = 'dead';
    updateGameState(sfxState, sfxInput, 0.05);
    expect(soundManager.getCurrentMusicTrack()).toBe('peaceful_xmas');
    sfxState.player.states.set(KITCHEN_ROSANNA_STATE_KEY, true);

    // Anne-Marie boss music starts when she initiates her confession dialog and stops when defeated
    sfxState.player.states.set(ANNE_MARIE_HOSTILE_DIALOGUE_KEY, true);
    updateGameState(sfxState, sfxInput, 0.05);
    expect(soundManager.getCurrentMusicTrack()).toBe('action_xmas');
    sfxUp.anneMarieCombat.mode = 'dead';
    updateGameState(sfxState, sfxInput, 0.05);
    expect(soundManager.getCurrentMusicTrack()).toBe('peaceful_xmas');

    // Cat fleeing -> cat_meow; cat damaged -> cat_angry
    sfxUp.cat.mode = 'flee';
    updateGameState(sfxState, sfxInput, 0.05);
    expect(soundManager.getRecentEvents()).toContain('cat_meow');
    applyCatDamage(sfxUp.cat, 20);
    updateGameState(sfxState, sfxInput, 0.05);
    expect(soundManager.getRecentEvents()).toContain('cat_angry');

    // Weapons: Uzi fire, Flamethrower fire + ember, Katana swoosh, Bazooka fire + rocket_flight + explosion
    sfxState.player.unlockedUzi = true;
    sfxState.player.unlockedFlamethrower = true;
    sfxState.player.flamethrowerAmmo = 10;
    sfxState.player.unlockedKatana = true;
    sfxState.player.unlockedBazooka = true;
    sfxState.player.x = 11 * TILE_SIZE;
    sfxState.player.y = 11 * TILE_SIZE;
    sfxState.player.yaw = 0;

    selectPlayerEquipmentSlot(sfxState.player, 3);
    sfxState.player.uziAmmo = 1;
    applyKeyEvent(sfxInput, 'Space', true);
    updateGameState(sfxState, sfxInput, 0.02);
    applyKeyEvent(sfxInput, 'Space', false);
    expect(soundManager.getRecentEvents()).toContain('weapon_switch');
    expect(soundManager.getRecentEvents()).toContain('uzi_fire');
    expect(soundManager.getRecentEvents()).toContain('uzi_reload');

    selectPlayerEquipmentSlot(sfxState.player, 4);
    applyKeyEvent(sfxInput, 'Space', true);
    updateGameState(sfxState, sfxInput, 0.02);
    applyKeyEvent(sfxInput, 'Space', false);
    expect(soundManager.getRecentEvents()).toContain('flamethrower_fire');
    expect(soundManager.getRecentEvents()).toContain('fire_ember');

    selectPlayerEquipmentSlot(sfxState.player, 5);
    applyKeyEvent(sfxInput, 'Space', true);
    updateGameState(sfxState, sfxInput, 0.02);
    applyKeyEvent(sfxInput, 'Space', false);
    expect(soundManager.getRecentEvents()).toContain('katana_swing');

    selectPlayerEquipmentSlot(sfxState.player, 6);
    sfxState.player.yaw = -Math.PI / 2;
    sfxState.player.bazookaFireCooldown = 0;
    applyKeyEvent(sfxInput, 'Space', true);
    updateGameState(sfxState, sfxInput, 0.02);
    applyKeyEvent(sfxInput, 'Space', false);
    expect(soundManager.getRecentEvents()).toContain('bazooka_fire');
    expect(soundManager.getRecentEvents()).toContain('rocket_flight');
    for (let i = 0; i < 20; i++) {
      updateGameState(sfxState, sfxInput, 0.05);
    }
    expect(soundManager.getRecentEvents()).toContain('explosion');
  });
});
