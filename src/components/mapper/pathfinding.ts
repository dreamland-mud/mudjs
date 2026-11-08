/**
 * Room-to-room BFS over the in-memory graph. Produces a speedwalk string
 * compatible with Dreamland's `run` command (e.g. "nnesw").
 *
 * Direction letters per dreamland_world `run` help:
 *   n s e w u d   (cardinal + vertical)
 * Diagonal letters are not native to Dreamland's `run`, so we expand them
 * into two cardinal steps (ne → ne is one direction in MUD, but `run` does
 * not parse diagonals — we emit them anyway and let the engine reject;
 * post-PoC: detect and expand into n+e if needed).
 */

import type { AreaLayout, Direction } from './types.js';
import { DIR_LETTERS } from './types.js';

interface PathStep {
  dir: Direction;
  vnum: number;
}

export function findPath(layout: AreaLayout, fromVnum: number, toVnum: number): PathStep[] | null {
  if (fromVnum === toVnum) return [];
  const visited = new Set<number>([fromVnum]);
  const queue: Array<{ vnum: number; path: PathStep[] }> = [{ vnum: fromVnum, path: [] }];
  while (queue.length > 0) {
    const { vnum, path } = queue.shift()!;
    const room = layout.rooms[vnum];
    if (!room) continue;
    for (const exit of room.exits) {
      if (visited.has(exit.target)) continue;
      // Don't path through cross-area exits in the local pathfinder.
      if (!layout.rooms[exit.target]) continue;
      const nextPath = [...path, { dir: exit.dir, vnum: exit.target }];
      if (exit.target === toVnum) return nextPath;
      visited.add(exit.target);
      queue.push({ vnum: exit.target, path: nextPath });
    }
  }
  return null;
}

/** The route from one room to every room it can reach in this layout, in one
 *  search, with the same rules as findPath (no cross-area exits). */
export function routesFrom(layout: AreaLayout, fromVnum: number): Record<number, PathStep[]> {
  const routes: Record<number, PathStep[]> = { [fromVnum]: [] };
  const queue: number[] = [fromVnum];
  while (queue.length > 0) {
    const vnum = queue.shift()!;
    const room = layout.rooms[vnum];
    if (!room) continue;
    for (const exit of room.exits) {
      if (routes[exit.target] || !layout.rooms[exit.target]) continue;
      routes[exit.target] = [...routes[vnum], { dir: exit.dir, vnum: exit.target }];
      queue.push(exit.target);
    }
  }
  return routes;
}

export function pathToSpeedwalk(path: PathStep[]): string {
  return path.map((s) => DIR_LETTERS[s.dir]).join('');
}
