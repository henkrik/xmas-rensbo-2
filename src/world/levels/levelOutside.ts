import { createDog, Dog } from '../../entities/dog';
import {
  ArmedNpcState,
  createArmedNpcState,
  enterHostileMode,
  stepBurningNpc,
  stepHostileNpcAlongPath,
  tryFireHostileNpcUzi,
  updateNpcHealthAndTimers,
} from '../../entities/npcCombat';
import {
  Player,
  Rect,
  selectPlayerEquipmentSlot,
} from '../../entities/player';
import {
  createDrivewayThrowers,
  Snowball,
  SnowballThrower,
} from '../../entities/snowball';
import { buildInteractables, Interactable } from '../interaction';
import {
  LADDER_BOTTOM_Y,
  LADDER_CLIMB_X,
  MOTORCYCLE_START_X,
  MOTORCYCLE_START_Y,
  PLAYER_START_X,
  PLAYER_START_Y,
  STARTER_MAP,
  TILE_SIZE,
  TileMap,
} from '../tilemap';
import { BASEMENT_CHIMNEY_INTRO_STATE_KEY } from './levelBasement';
import { GameLevel, LevelId, LevelTransitionContext } from './types';

export interface ClimbingState {
  direction: 'up' | 'down';
  progress: number;
}

export type MotorcycleStatus = 'parked' | 'driving' | 'crashed';

export interface MotorcycleState extends Rect {
  status: MotorcycleStatus;
}

export function createMotorcycle(): MotorcycleState {
  return {
    x: MOTORCYCLE_START_X,
    y: MOTORCYCLE_START_Y,
    width: TILE_SIZE * 2,
    height: TILE_SIZE,
    status: 'parked',
  };
}

export const RUDOLPH_INSPECTED_KEY = 'rudolphInspected';

export const OUTSIDE_ALEX_NPC: Rect & { facing: 'down' | 'left' | 'right' | 'up' } = {
  x: 4 * TILE_SIZE + 2,
  y: 19 * TILE_SIZE + 2,
  width: 12,
  height: 12,
  facing: 'left',
};

export class LevelOutside implements GameLevel {
  public readonly id: LevelId = 'level-outside';
  public readonly map: TileMap;
  public dog: Dog;
  public motorcycle: MotorcycleState;
  public throwers: SnowballThrower[];
  public snowballs: Snowball[];
  public readonly alexNpc = { ...OUTSIDE_ALEX_NPC };
  public sylvesterCombat: ArmedNpcState;
  public annelotteCombat: ArmedNpcState;
  public alexCombat: ArmedNpcState;
  public hasLadder: boolean = false;
  public ladderPlaced: boolean = false;
  public isOnRoof: boolean = false;
  public climbing: ClimbingState | null = null;
  public electrocutionTimer: number = 0;

  constructor(map: TileMap = STARTER_MAP) {
    this.map = map;
    this.dog = createDog();
    this.motorcycle = createMotorcycle();
    this.throwers = createDrivewayThrowers();
    this.snowballs = [];
    this.sylvesterCombat = createArmedNpcState('outside:Sylvester', 'Sylvester', 0, 'uzi');
    this.annelotteCombat = createArmedNpcState('outside:Annelotte', 'Annelotte', Math.PI, 'uzi');
    this.alexCombat = createArmedNpcState('outside:Alex', 'Alex', Math.PI, 'uzi');
  }

  public getArmedNpcs(): Array<{ state: ArmedNpcState; bounds: Rect; visible: boolean }> {
    const entries: Array<{ state: ArmedNpcState; bounds: Rect; visible: boolean }> = [];
    if (this.throwers[0]) {
      entries.push({ state: this.sylvesterCombat, bounds: this.throwers[0], visible: true });
    }
    if (this.throwers[1]) {
      entries.push({ state: this.annelotteCombat, bounds: this.throwers[1], visible: true });
    }
    entries.push({ state: this.alexCombat, bounds: this.alexNpc, visible: true });
    return entries;
  }

  public getArmedNpcByKey(key: string): ArmedNpcState | undefined {
    for (const entry of this.getArmedNpcs()) {
      if (entry.state.key === key) {
        return entry.state;
      }
    }
    return undefined;
  }

  /** Turns every living outside NPC hostile with Uzis drawn whenever any outside NPC is damaged. */
  public alertAllOutsideNpcs(): void {
    for (const entry of this.getArmedNpcs()) {
      if (entry.state.mode !== 'dead' && entry.state.mode !== 'burning') {
        enterHostileMode(entry.state);
      }
    }
  }

  public updateNpcCombat(
    player: Player,
    dtSeconds: number,
    ctx: LevelTransitionContext
  ): void {
    const playerCx = player.x + player.width * 0.5;
    const playerCy = player.y + player.height * 0.5;
    const solidObstacles = this.getSolidObstacles();

    for (const { state: combat, bounds } of this.getArmedNpcs()) {
      updateNpcHealthAndTimers(combat, dtSeconds);
      if (combat.mode === 'dead') continue;
      if (combat.mode === 'burning') {
        stepBurningNpc(
          combat,
          bounds,
          player,
          this.map,
          solidObstacles,
          dtSeconds,
          ctx.fireNpcUzi
        );
      } else if (combat.mode === 'hostile') {
        stepHostileNpcAlongPath(
          combat,
          bounds,
          player,
          this.map,
          solidObstacles,
          dtSeconds
        );
        const originX = bounds.x + bounds.width * 0.5;
        const originY = bounds.y + bounds.height * 0.5;
        const aimYaw = Math.atan2(playerCy - originY, playerCx - originX);
        combat.aimYaw = aimYaw;
        tryFireHostileNpcUzi(combat, originX, originY, aimYaw, ctx.fireNpcUzi);
      }
    }
  }

  public enter(player: Player): void {
    player.x = PLAYER_START_X;
    player.y = PLAYER_START_Y;
    player.facing = 'up';
    player.yaw = -Math.PI / 2;
    player.renderYaw = -Math.PI / 2;
    player.jumpOffset = 0;
    player.jumpVelocity = 0;
    player.isMoving = false;
    player.walkTimer = 0;
  }

  public getSolidObstacles(): readonly Rect[] {
    const obs: Rect[] = [this.motorcycle];
    if (this.throwers[0] && this.sylvesterCombat.mode !== 'dead') {
      obs.push(this.throwers[0]);
    }
    if (this.throwers[1] && this.annelotteCombat.mode !== 'dead') {
      obs.push(this.throwers[1]);
    }
    if (this.alexCombat.mode !== 'dead') {
      obs.push(this.alexNpc);
    }
    return obs;
  }

  public getInteractables(): Interactable[] {
    const passiveThrowers: SnowballThrower[] = [];
    if (this.throwers[0] && this.sylvesterCombat.mode === 'passive') {
      passiveThrowers.push(this.throwers[0]);
    }
    if (this.throwers[1] && this.annelotteCombat.mode === 'passive') {
      passiveThrowers.push(this.throwers[1]);
    }
    return buildInteractables(passiveThrowers, {
      hasLadder: this.hasLadder,
      ladderPlaced: this.ladderPlaced,
      isOnRoof: this.isOnRoof,
      motorcycleStatus: this.motorcycle.status,
      alexNpc: this.alexCombat.mode === 'passive' ? this.alexNpc : undefined,
    });
  }

  public handleInteraction(
    interactableId: string,
    player: Player,
    ctx: LevelTransitionContext
  ): boolean {
    if (interactableId === 'motorcycle') {
      this.motorcycle.status = 'driving';
      player.x = this.motorcycle.x + 8;
      player.y = this.motorcycle.y - 2;
      player.facing = 'right';
      player.yaw = 0;
      player.renderYaw = 0;
      player.isMoving = true;
      return true;
    }
    if (interactableId === 'ground-ladder') {
      this.hasLadder = true;
      return true;
    }
    if (interactableId === 'house-west-place-ladder') {
      this.hasLadder = false;
      this.ladderPlaced = true;
      return true;
    }
    if (interactableId === 'house-west-climb-ladder') {
      this.climbing = { direction: 'up', progress: 0 };
      player.x = LADDER_CLIMB_X;
      player.y = LADDER_BOTTOM_Y;
      player.facing = 'up';
      player.yaw = -Math.PI / 2;
      player.renderYaw = -Math.PI / 2;
      player.jumpOffset = 0;
      player.jumpVelocity = 0;
      return true;
    }
    if (interactableId === 'roof-ladder') {
      this.climbing = { direction: 'down', progress: 0 };
      player.x = LADDER_CLIMB_X;
      player.y = LADDER_BOTTOM_Y;
      player.facing = 'down';
      player.yaw = Math.PI / 2;
      player.renderYaw = Math.PI / 2;
      player.jumpOffset = 0;
      player.jumpVelocity = 0;
      return true;
    }
    if (interactableId === 'roof-rudolph') {
      player.states.set(RUDOLPH_INSPECTED_KEY, true);
      ctx.openDialogue(
        [
          'RUDOLPH?!! WHO DID THIS?',
          '...',
          'This is no longer about saving christmas...',
          'This is about REVENGE!',
          "I will find out who did this, if it is the last thing I'll ever do.",
        ],
        () => {
          ctx.openDialogue(
            ['ACHIEVEMENT UNLOCKED: Murder-mystery genre unlocked.'],
            () => {
              ctx.openDialogue(["I'm dreaming of a RED CHRISTMAS."], () => {
                ctx.openDialogue(
                  [
                    'ACHIEVEMENT UNLOCKED: Action genre unlocked. Viewer discretion is advised.',
                  ],
                  () => {
                    if (!player.unlockedUzi) {
                      player.unlockedUzi = true;
                      selectPlayerEquipmentSlot(player, 3);
                    }
                  },
                  undefined,
                  false,
                  'achievement'
                );
              });
            },
            undefined,
            false,
            'achievement'
          );
        }
      );
      return true;
    }
    if (interactableId === 'roof-chimney') {
      if (!player.states.get(RUDOLPH_INSPECTED_KEY) && !player.unlockedUzi) {
        ctx.openDialogue(['You smell the stench of blood...']);
        return true;
      }
      ctx.loadLevel('level-basement');
      if (!player.states.get(BASEMENT_CHIMNEY_INTRO_STATE_KEY)) {
        player.states.set(BASEMENT_CHIMNEY_INTRO_STATE_KEY, true);
        ctx.openDialogue([
          'You better run, Santa Claus is coming to town.',
          ctx.isMobile
            ? 'Tap anywhere inside the game screen to fire your weapon (hold to keep firing).'
            : 'Press Space to fire your weapon (hold to keep firing).',
        ]);
      }
      return true;
    }
    return false;
  }
}
