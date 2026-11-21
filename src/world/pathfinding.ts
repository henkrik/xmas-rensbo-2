import { Rect, rectsIntersect } from '../entities/player';
import { isSolidTile, TileMap } from './tilemap';

export interface TileCoord {
  col: number;
  row: number;
}

export interface PathfinderOptions {
  /** Allow diagonal 8-way movement without cutting solid corners. Defaults to false (4-way). */
  allowDiagonal?: boolean;
  /** Optional extra solid obstacles in world pixel coordinates. */
  obstacles?: readonly Rect[];
  /** Optional custom tile walkability predicate overriding default tile solidity. */
  isWalkable?: (col: number, row: number) => boolean;
}

/**
 * Computes shortest tile-to-tile paths on a TileMap using the A* search algorithm.
 */
export class AStarPathfinder {
  private readonly map: TileMap;
  private readonly allowDiagonal: boolean;
  private readonly obstacles: readonly Rect[];
  private readonly customWalkable?: (col: number, row: number) => boolean;

  constructor(map: TileMap, options?: PathfinderOptions) {
    this.map = map;
    this.allowDiagonal = options?.allowDiagonal ?? false;
    this.obstacles = options?.obstacles ?? [];
    this.customWalkable = options?.isWalkable;
  }

  public isTileWalkable(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.map.cols || row >= this.map.rows) {
      return false;
    }
    if (this.customWalkable) {
      return this.customWalkable(col, row);
    }
    if (isSolidTile(this.map, col, row)) {
      return false;
    }
    if (this.obstacles.length > 0) {
      const ts = this.map.tileSize;
      const tileRect: Rect = {
        x: col * ts + 1,
        y: row * ts + 1,
        width: ts - 2,
        height: ts - 2,
      };
      for (const obs of this.obstacles) {
        if (rectsIntersect(tileRect, obs)) {
          return false;
        }
      }
    }
    return true;
  }

  private heuristic(a: TileCoord, b: TileCoord): number {
    const dx = Math.abs(a.col - b.col);
    const dy = Math.abs(a.row - b.row);
    if (this.allowDiagonal) {
      const min = Math.min(dx, dy);
      const max = Math.max(dx, dy);
      return min * Math.SQRT2 + (max - min);
    }
    return dx + dy;
  }

  private keyOf(col: number, row: number): number {
    return row * this.map.cols + col;
  }

  /**
   * Returns the shortest path of tiles from `start` to `goal` (inclusive),
   * or an empty array if no valid path exists.
   */
  public findPath(start: TileCoord, goal: TileCoord): TileCoord[] {
    if (
      start.col < 0 ||
      start.row < 0 ||
      start.col >= this.map.cols ||
      start.row >= this.map.rows ||
      goal.col < 0 ||
      goal.row < 0 ||
      goal.col >= this.map.cols ||
      goal.row >= this.map.rows
    ) {
      return [];
    }

    if (!this.isTileWalkable(goal.col, goal.row)) {
      return [];
    }

    if (start.col === goal.col && start.row === goal.row) {
      return [{ col: start.col, row: start.row }];
    }

    const startKey = this.keyOf(start.col, start.row);
    const goalKey = this.keyOf(goal.col, goal.row);

    const openSet = new Set<number>([startKey]);
    const closedSet = new Set<number>();
    const cameFrom = new Map<number, number>();
    const gScore = new Map<number, number>([[startKey, 0]]);
    const fScore = new Map<number, number>([
      [startKey, this.heuristic(start, goal)],
    ]);

    const cardinalDirs: ReadonlyArray<readonly [number, number, number]> = [
      [0, -1, 1],
      [1, 0, 1],
      [0, 1, 1],
      [-1, 0, 1],
    ];
    const diagonalDirs: ReadonlyArray<readonly [number, number, number]> = [
      [1, -1, Math.SQRT2],
      [1, 1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [-1, -1, Math.SQRT2],
    ];

    while (openSet.size > 0) {
      let currentKey = -1;
      let bestF = Infinity;
      for (const k of openSet) {
        const f = fScore.get(k) ?? Infinity;
        if (f < bestF) {
          bestF = f;
          currentKey = k;
        }
      }

      if (currentKey === goalKey) {
        const path: TileCoord[] = [];
        let trace: number | undefined = currentKey;
        while (trace !== undefined) {
          const r = Math.floor(trace / this.map.cols);
          const c = trace % this.map.cols;
          path.push({ col: c, row: r });
          trace = cameFrom.get(trace);
        }
        path.reverse();
        return path;
      }

      openSet.delete(currentKey);
      closedSet.add(currentKey);

      const curRow = Math.floor(currentKey / this.map.cols);
      const curCol = currentKey % this.map.cols;
      const curG = gScore.get(currentKey) ?? Infinity;

      const dirs = this.allowDiagonal
        ? [...cardinalDirs, ...diagonalDirs]
        : cardinalDirs;

      for (const [dc, dr, stepCost] of dirs) {
        const nc = curCol + dc;
        const nr = curRow + dr;
        if (!this.isTileWalkable(nc, nr)) {
          continue;
        }
        // Prevent diagonal corner cutting through adjacent solid walls
        if (dc !== 0 && dr !== 0) {
          if (
            !this.isTileWalkable(curCol + dc, curRow) ||
            !this.isTileWalkable(curCol, curRow + dr)
          ) {
            continue;
          }
        }

        const neighborKey = this.keyOf(nc, nr);
        if (closedSet.has(neighborKey)) {
          continue;
        }

        const tentativeG = curG + stepCost;
        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);
          fScore.set(
            neighborKey,
            tentativeG + this.heuristic({ col: nc, row: nr }, goal)
          );
          openSet.add(neighborKey);
        }
      }
    }

    return [];
  }

  /**
   * Convenience wrapper accepting world pixel coordinates.
   */
  public findPathWorld(
    startX: number,
    startY: number,
    goalX: number,
    goalY: number
  ): TileCoord[] {
    const ts = this.map.tileSize;
    return this.findPath(
      { col: Math.floor(startX / ts), row: Math.floor(startY / ts) },
      { col: Math.floor(goalX / ts), row: Math.floor(goalY / ts) }
    );
  }
}
