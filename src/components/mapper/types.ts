/**
 * TS schema mirrored from dreamland_code/plug-ins/areas/xmlroom.h, xmlmisc.h.
 * Field names match the XML node names.
 */

export type Direction = 'north' | 'south' | 'east' | 'west' | 'up' | 'down';

export const ALL_DIRECTIONS: Direction[] = [
  'north', 'south', 'east', 'west', 'up', 'down',
];

// Single-letter speedwalk codes for the `run` command. The engine (plug-ins/comm/run.cpp
// -> direction_lookup) matches each letter against the English direction name, so down is
// 'd' (first letter of "down"); 'o' is rejected with "Непонятное направление для бега".
export const DIR_LETTERS: Record<Direction, string> = {
  north: 'n', south: 's', east: 'e', west: 'w', up: 'u', down: 'd',
};

export const DIR_DELTAS: Record<Direction, [number, number, number]> = {
  north: [ 0,  1,  0],
  south: [ 0, -1,  0],
  east:  [ 1,  0,  0],
  west:  [-1,  0,  0],
  up:    [ 0,  0,  1],
  down:  [ 0,  0, -1],
};

export const REVERSE_DIR: Record<Direction, Direction> = {
  north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up',
};

export type Sector =
  | 'inside' | 'city' | 'field' | 'forest' | 'hills' | 'mountain'
  | 'water_swim' | 'water_noswim' | 'underwater' | 'air'
  | 'desert' | 'cave' | 'jungle' | 'tundra' | 'unknown';

export interface Exit {
  dir: Direction;
  target: number;
  key?: number;          // -1 or absent = no key
  flags: string[];       // raw flags: 'isdoor', 'closed', 'locked', 'pickproof', 'nopass', etc.
  keyword?: string;      // door noun; when present and 'isdoor' set, exit has a door
}

export interface Room {
  vnum: number;
  area: string;          // area filename (no .are.xml)
  name: string;
  description: string;
  sector: Sector | string;
  flags: string[];       // 'dark', 'indoors', 'no_mob', etc.
  exits: Exit[];
}

export interface AreaMeta {
  file: string;          // filename without .are.xml suffix
  name: string;
  vnumLow: number;
  vnumHigh: number;
  levelLow: number;
  levelHigh: number;
  authors: string;
  flags: string[];       // 'hard', etc.
  speedwalk?: string;    // hint to entry path; first char often a vnum lookup
  altname?: string;
}

/* ---------- Layout output (post-BFS) ---------- */

export type ExitStyle = 'open' | 'door_closed' | 'door_locked' | 'door_pickproof' | 'warp' | 'random' | 'cross_area';

export interface PlacedRoom {
  vnum: number;
  x: number;
  y: number;
  z: number;
  cluster: number;       // disconnected component index (0 for primary)
  isVoid?: boolean;      // 'a terrible void here' rendering
  voidReason?: string;
}

export interface PlacedExit {
  from: number;          // source vnum
  to: number;            // target vnum (may be in another area)
  dir: Direction;
  style: ExitStyle;
  /** Cross-area target area (filename, no suffix) when style === 'cross_area'. */
  targetArea?: string;
  flags: string[];
  hasFly?: boolean;
  hasSwim?: boolean;
  hasTrap?: boolean;
  doorKeyword?: string;
  /** True iff target room has any exit pointing back to source. False = one-way. */
  bidirectional: boolean;
}

export interface AreaLayout {
  meta: AreaMeta;
  rooms: Record<number, Room>;             // vnum → room
  placed: Record<number, PlacedRoom>;      // vnum → coords
  exits: PlacedExit[];                     // deduplicated (one entry per logical edge)
  zLayers: number[];                       // sorted unique z values
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  clusters: number;                        // count of disconnected components
}

export interface MapperIndex {
  areas: AreaMeta[];
  /** vnum → area filename. Used for cross-area edge resolution. */
  vnumToArea: Record<number, string>;
}
