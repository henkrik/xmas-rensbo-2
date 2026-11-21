import { ArmedNpcState } from '../../entities/npcCombat';
import { Player, Rect } from '../../entities/player';
import { DialogueVariant, Interactable } from '../interaction';
import { TileMap } from '../tilemap';

export type LevelId = 'level-outside' | 'level-basement' | 'level-upstairs' | 'level-people';

export interface CollidableDoor {
  id: string;
  bounds: Rect;
  /** Regions hidden under black fog-of-war until this door is opened & deleted. */
  hiddenRegions: Rect[];
}

export interface OpenedDoorAnimation {
  id: string;
  bounds: Rect;
  progress: number;
  swingDirection: 1 | -1;
}

export interface LevelTransitionContext {
  loadLevel: (levelId: LevelId) => void;
  openDialogue: (
    lines: string[],
    onClose?: () => void,
    speakerPortrait?: string,
    unclosable?: boolean,
    variant?: DialogueVariant
  ) => void;
  damagePlayer?: (amount: number) => void;
  fireNpcUzi?: (
    npc: ArmedNpcState,
    originX: number,
    originY: number,
    aimYaw: number
  ) => void;
  getSecretSantaReceiver?: () => string | undefined;
  fadeWorldToBlack?: () => void;
}

export interface GameLevel {
  readonly id: LevelId;
  readonly map: TileMap;
  enter(player: Player): void;
  getSolidObstacles(player?: Player): readonly Rect[];
  getInteractables(player?: Player): Interactable[];
  handleInteraction(
    interactableId: string,
    player: Player,
    ctx: LevelTransitionContext
  ): boolean;
}
