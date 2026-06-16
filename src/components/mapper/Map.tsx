import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { AreaLayout, Direction, ExitStyle, MapperIndex, PlacedExit, PlacedRoom } from './types.js';
import { DIR_DELTAS, REVERSE_DIR } from './types.js';
import { sectorStyle, sectorLabel } from './sectors.js';
import { t } from './i18n.js';

/* ---- visual scale ---- */
const TILE_W = 124;
const TILE_H = 72;
const GAP_X = 74;
const GAP_Y = 70;
const STEP_X = TILE_W + GAP_X;
const STEP_Y = TILE_H + GAP_Y;
const TILE_RADIUS = 7;
/** Gap kept between every edge endpoint (port/clip) and a tile's click box. */
const EDGE_GAP = 7;
/** Per-z-layer screen offset. +z shifts top-right; -z shifts bottom-left.
 * Tuned to never produce >20% overlap between adjacent-layer tiles while staying
 * visibly diagonal (worst case at grid neighbors: ~18% overlap). */
const Z_SHIFT_X = STEP_X * 0.65;
const Z_SHIFT_Y = STEP_Y * 0.65;
const STUB_LEN = 40;

interface Props {
  layout: AreaLayout;
  index: MapperIndex;
  currentVnum: number | null;
  selectedVnum: number | null;
  activeZ: number;
  onSelectRoom: (vnum: number) => void;
  onSetCurrent: (vnum: number) => void;
  onCrossArea: (file: string, vnum: number) => void;
  onChangeZ: (z: number | 'all') => void;
  zFilter: number | 'all';
  /** Optional out-param: Map publishes `{ zoomBy }` here so external +/- buttons can
   *  drive the d3 zoom (host integration). Left undefined in the standalone app. */
  zoomApiRef?: { current: { zoomBy: (factor: number) => void } | null };
}

interface ScreenCoords { sx: number; sy: number }

function placedToScreen(p: PlacedRoom, bounds: AreaLayout['bounds']): ScreenCoords {
  // Cardinal: x → screen x, y → screen y (flipped for SVG).
  // Vertical (up/down): each +z layer shifts top-right (-y, +x in screen).
  const sx = (p.x - bounds.minX) * STEP_X + p.z * Z_SHIFT_X;
  const sy = (bounds.maxY - p.y) * STEP_Y - p.z * Z_SHIFT_Y;
  return { sx, sy };
}

/* Theme accents — kept in sync with src/main.css (CSS custom properties).
 * Hardcoded here because SVG attributes don't read CSS variables in Safari without
 * the `currentColor` trick on every leaf element. */
/* DreamLand web-client (mudjs) Tango ANSI palette — mirrors src/main.css :root.
 * Hardcoded here because SVG attributes don't read CSS variables reliably. */
const COLOR = {
  ink:        '#121212', // mudjs terminal ground
  rule:       '#2e2e2e',
  textBright: '#ffffff', // ANSI bright white
  parchment:  '#eeeeec', // bright text on accent fills
  amber:      '#bb86fc', // PRIMARY — current location, matches mudjs accent
  lapis:      '#55a3f2', // ANSI bright blue — selection
  copper:     '#c4a000', // ANSI yellow — door_closed
  rust:       '#cc0000', // ANSI red — door_locked
  moss:       '#4e9a06', // ANSI green — cross_area
  edge:       '#888888', // open / random — dim terminal grey (mudjs body text)
  warp:       '#d384cb', // ANSI bright magenta — warp, never reads as a real corridor
  cyan:       '#2cf4eb', // ANSI bright cyan — current location (matches mudjs .active)
  darkCyan:   '#06989a', // ANSI dark cyan — cross-area destinations
  swimBlue:   '#3465a4', // dark blue — underwater / swim exits
  flyBlue:    '#8ec5ff', // light blue — air / fly exits
};

const EXIT_DASH: Record<ExitStyle, string> = {
  open: '',
  door_closed: '6 5',
  door_locked: '10 6',
  door_pickproof: '2 4',
  warp: '3 5',
  random: '2 6',
  cross_area: '10 5',
};

const EXIT_COLOR: Record<ExitStyle, string> = {
  open: COLOR.edge,
  door_closed: COLOR.edge,    // grey — unlocked closed door
  door_locked: COLOR.rust,    // red — locked
  door_pickproof: '#ed2330',  // ANSI bright red — most severe lock
  warp: COLOR.warp,
  random: COLOR.edge,
  cross_area: COLOR.darkCyan, // dark cyan — exits to other zones
};
/** Effective sector text-colour for a room (indoors → inside). Vertical (up/down) exits are
 * painted the colour of the room they lead to, so a stair reads as "goes to a <terrain> room". */
function roomSectorColor(layout: AreaLayout, vnum: number): string {
  const r = layout.rooms[vnum];
  if (!r) return COLOR.edge;
  return sectorStyle(r.flags.includes('indoors') ? 'inside' : r.sector).text;
}

function exitMidIcon(exit: PlacedExit): string | null {
  if (exit.hasTrap) return '⚠';
  if (exit.style === 'random') return '∞';
  if (exit.style === 'warp') return '⤳';
  return null;
}

function isDoorStyle(style: ExitStyle): boolean {
  return style === 'door_closed' || style === 'door_locked' || style === 'door_pickproof';
}
function doorGlyphFor(style: ExitStyle): string {
  return style === 'door_closed' ? '🚪' : '🔒'; // closed → door, locked/pickproof → lock
}

/** Door decoration at the middle of a connector: two jamb marks perpendicular to the
 * connector direction (ux,uy) flanking the glyph, with the line masked between them.
 * Horizontal connector → "|" jambs; vertical → "--" jambs (orientation follows the line). */
function renderDoorDeco(midX: number, midY: number, ux: number, uy: number, glyph: string, color: string): JSX.Element {
  const px = -uy, py = ux; // perpendicular unit
  const GAP = 11, JAMB = 7;
  const j1x = midX + ux * GAP, j1y = midY + uy * GAP;
  const j2x = midX - ux * GAP, j2y = midY - uy * GAP;
  return (
    <g pointerEvents="none">
      <circle cx={midX} cy={midY} r={GAP + 3} fill={COLOR.ink} />
      <line x1={j1x - px * JAMB} y1={j1y - py * JAMB} x2={j1x + px * JAMB} y2={j1y + py * JAMB} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <line x1={j2x - px * JAMB} y1={j2y - py * JAMB} x2={j2x + px * JAMB} y2={j2y + py * JAMB} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <text x={midX} y={midY + 4} fontSize="12" textAnchor="middle" style={{ fontFamily: 'var(--font-mono), monospace' }}>{glyph}</text>
    </g>
  );
}

/** Greedy word-wrap into up to maxLines lines. Truncates with ellipsis if overflow. */
function wrapName(name: string, charsPerLine: number, maxLines: number): string[] {
  if (!name) return [];
  const words = name.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (lines.length >= maxLines) break;
    const candidate = cur ? cur + ' ' + w : w;
    if (candidate.length <= charsPerLine) {
      cur = candidate;
    } else if (cur === '') {
      // Single word longer than a line — place it whole (no ellipsis; font sizing keeps it sane).
      cur = w;
    } else {
      lines.push(cur);
      cur = (lines.length < maxLines) ? w : '';
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

/** Size-adjusted label for a box-less tile: shorter names get a larger font so every
 * room's text block occupies roughly the same footprint. fontSize ∝ 1/√(charCount)
 * keeps the rendered area near-constant; charsPerLine/maxLines derive from it. */
function fittedLabel(name: string): { fontSize: number; lines: string[]; lineH: number } {
  if (!name) return { fontSize: 11, lines: [], lineH: 13 };
  const charCount = name.replace(/\s+/g, '').length || 1;
  const fontSize = Math.max(9, Math.min(22, Math.round(52 / Math.sqrt(charCount))));
  const charsPerLine = Math.max(4, Math.floor((TILE_W - 8) / (fontSize * 0.6)));
  const maxLines = Math.max(1, Math.min(3, Math.floor(TILE_H / (fontSize * 1.15))));
  const lines = wrapName(name, charsPerLine, maxLines);
  return { fontSize, lines, lineH: Math.round(fontSize * 1.15) };
}

/** Largest font (<= desired) whose <=3-line wrap fits inside maxW × maxH — keeps a margin
 * inside the selected tile's purple box at any zoom. */
function boxedLabel(name: string, maxW: number, maxH: number, desired: number): { fontSize: number; lines: string[]; lineH: number } {
  if (!name) return { fontSize: Math.round(desired), lines: [], lineH: Math.round(desired * 1.15) };
  const wordCount = name.split(/\s+/).filter(Boolean).length;
  for (let fs = Math.round(desired); fs >= 7; fs--) {
    const charsPerLine = Math.max(4, Math.floor(maxW / (fs * 0.6)));
    const lines = wrapName(name, charsPerLine, 3);
    const lineH = fs * 1.15;
    const widest = lines.reduce((m, l) => Math.max(m, l.length), 0) * fs * 0.6;
    const placedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
    // Largest font whose <=3-line wrap shows EVERY word and fits the box.
    if (placedWords >= wordCount && lines.length * lineH <= maxH && widest <= maxW) {
      return { fontSize: fs, lines, lineH: Math.round(lineH) };
    }
  }
  const fs = 7;
  const charsPerLine = Math.max(4, Math.floor(maxW / (fs * 0.6)));
  return { fontSize: fs, lines: wrapName(name, charsPerLine, 3), lineH: Math.round(fs * 1.15) };
}

/** Layer opacity based on distance from active z. Far layers stay visible at a low floor (10%) — never hidden. */
function layerOpacity(z: number, activeZ: number): number {
  const d = Math.abs(z - activeZ);
  if (d === 0) return 1;
  if (d === 1) return 0.4;
  if (d === 2) return 0.3;
  if (d === 3) return 0.2;
  return 0.1;
}

/** Perspective scaling. Decays gently with distance, plateauing so far layers stay legible. */
function layerScale(z: number, activeZ: number): number {
  const d = Math.abs(z - activeZ);
  if (d === 0) return 1;
  if (d === 1) return 0.93;
  if (d === 2) return 0.86;
  if (d === 3) return 0.80;
  return 0.76;
}

/** Clip a line from `(cx, cy)` heading toward `(ox, oy)` to the rectangle of half-w/half-h
 * centered at `(cx, cy)`. Returns the point where the line first crosses the rect boundary. */
function clipFromCenter(cx: number, cy: number, ox: number, oy: number, halfW: number, halfH: number): [number, number] {
  const dx = ox - cx;
  const dy = oy - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const tx = dx === 0 ? Infinity : Math.abs(halfW / dx);
  const ty = dy === 0 ? Infinity : Math.abs(halfH / dy);
  const t = Math.min(tx, ty);
  return [cx + dx * t, cy + dy * t];
}

/**
 * A warp edge is "wrong-side" when the target tile sits in the opposite half-plane from
 * the exit's declared direction (e.g. a `south` exit whose target was placed above the
 * source). These are mostly irreducible cycle-edge contradictions — a non-planar room
 * graph can't satisfy every cardinal exit on a 2D grid. Drawing a full connector to such
 * a tile implies a spatial adjacency that's a lie; we render a labelled stub instead.
 * Flat (perpendicular-only) offsets are not counted — only genuine opposite-side cases.
 */
function warpWrongSide(dir: Direction, fromP: PlacedRoom, toP: PlacedRoom): boolean {
  if (fromP.z !== toP.z) return false;
  const [ddx, ddy] = DIR_DELTAS[dir];
  if (ddx !== 0) { const s = Math.sign(toP.x - fromP.x); return s !== 0 && s !== Math.sign(ddx); }
  if (ddy !== 0) { const s = Math.sign(toP.y - fromP.y); return s !== 0 && s !== Math.sign(ddy); }
  return false;
}

/** Cardinal port (mid of a tile side) for the given direction. */
function cardinalPort(cx: number, cy: number, halfW: number, halfH: number, dir: Direction): [number, number] {
  switch (dir) {
    case 'north': return [cx, cy - halfH];
    case 'south': return [cx, cy + halfH];
    case 'east':  return [cx + halfW, cy];
    case 'west':  return [cx - halfW, cy];
    default:      return [cx, cy];
  }
}

/** Pick the target's port: the side of the target facing the source. For grid-aligned
 * exits this matches REVERSE_DIR(exit). For warp/twisted layouts where the target landed
 * on the wrong side, this picks the geometrically-closest face so the connector doesn't
 * have to wrap around the target tile. */
function targetFacingPortDir(srcCx: number, srcCy: number, dstCx: number, dstCy: number): Direction {
  const dx = srcCx - dstCx;
  const dy = srcCy - dstCy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'east' : 'west';
  return dy > 0 ? 'south' : 'north';
}

/** Manhattan-routed path from a source tile's exit port to a target tile's facing port.
 * Source side is dictated by exit.dir (always — direction must read clearly).
 * Target side is the side facing the source.
 * Path leaves the source perpendicular to its exit side, bends 90° once or twice, then
 * approaches the target's facing port from a perpendicular direction.
 * When `detour` is true, the path takes a perpendicular detour (lane offset) to clear a
 * tile that sits on the straight line between source and target. */
function manhattanPath(
  srcCx: number, srcCy: number, srcHalfW: number, srcHalfH: number,
  dstCx: number, dstCy: number, dstHalfW: number, dstHalfH: number,
  exitDir: Direction,
  detour: boolean,
): { d: string; mid: [number, number] } {
  const LEAVE = 28;
  const DETOUR = 78;  // perpendicular shift used when detouring around an obstacle tile
  const [sx, sy] = cardinalPort(srcCx, srcCy, srcHalfW, srcHalfH, exitDir);
  const targetDir = targetFacingPortDir(srcCx, srcCy, dstCx, dstCy);
  const [tx, ty] = cardinalPort(dstCx, dstCy, dstHalfW, dstHalfH, targetDir);

  // Step out from the source in its exit direction.
  const dirX = exitDir === 'east' ? 1 : exitDir === 'west' ? -1 : 0;
  const dirY = exitDir === 'south' ? 1 : exitDir === 'north' ? -1 : 0;
  const p2x = sx + dirX * LEAVE;
  const p2y = sy + dirY * LEAVE;

  // Approach the target from OUTSIDE — perpendicular to its facing side, away from the tile.
  // (Stepping inward would put p3 inside the target tile and the lane segment would cross
  // the tile body, making the visible connector appear to enter from the wrong edge.)
  const tDirX = targetDir === 'east' ? 1 : targetDir === 'west' ? -1 : 0;
  const tDirY = targetDir === 'south' ? 1 : targetDir === 'north' ? -1 : 0;
  const p3x = tx + tDirX * LEAVE;
  const p3y = ty + tDirY * LEAVE;

  if (detour) {
    // Lane offset perpendicular to source's leave axis. "North" by default for horizontal
    // exits (lane runs above the row); "east" for vertical exits (lane runs right of the column).
    const laneDx = dirX !== 0 ? 0 : 1;
    const laneDy = dirX !== 0 ? -1 : 0;
    const laneOff = DETOUR;
    const lx1 = p2x + laneDx * laneOff;
    const ly1 = p2y + laneDy * laneOff;
    const lx2 = p3x + laneDx * laneOff;
    const ly2 = p3y + laneDy * laneOff;
    return {
      d: `M${sx},${sy} L${p2x},${p2y} L${lx1},${ly1} L${lx2},${ly2} L${p3x},${p3y} L${tx},${ty}`,
      mid: [(lx1 + lx2) / 2, (ly1 + ly2) / 2],
    };
  }

  // Bridge p2 → p3 with a Manhattan corner. Choose the bend axis that matches the source's
  // leave axis: if source leaves vertically (n/s), bridge horizontally first; vice versa.
  let cornerX: number, cornerY: number;
  if (dirY !== 0) {
    cornerX = p3x;
    cornerY = p2y;
  } else {
    cornerX = p2x;
    cornerY = p3y;
  }
  return {
    d: `M${sx},${sy} L${p2x},${p2y} L${cornerX},${cornerY} L${p3x},${p3y} L${tx},${ty}`,
    mid: [cornerX, cornerY],
  };
}

/** Corner port for vertical exits. Up = top-right corner of source; down = bottom-left.
 * Aligns with the axonometric +z = top-right diagonal projection. */
function cornerPort(cx: number, cy: number, halfW: number, halfH: number, dir: 'up' | 'down'): [number, number] {
  return dir === 'up'
    ? [cx + halfW, cy - halfH]   // top-right
    : [cx - halfW, cy + halfH];  // bottom-left
}

/** Curved arc for warp links: leaves the source on its exit-direction face and arrives at
 * the destination's reverse-direction face, so the arrowhead points the correct way (a
 * south exit leaves the source's bottom and enters the destination's top, pointing down). */
function cardinalArc(
  cx1: number, cy1: number, hw1: number, hh1: number,
  cx2: number, cy2: number, hw2: number, hh2: number,
  dir: Direction,
): string {
  const [sxp, syp] = cardinalPort(cx1, cy1, hw1, hh1, dir);
  const [txp, typ] = cardinalPort(cx2, cy2, hw2, hh2, REVERSE_DIR[dir]);
  const ddx = txp - sxp;
  const ddy = typ - syp;
  const len = Math.hypot(ddx, ddy) || 1;
  const bow = Math.min(64, len * 0.3);
  const ctrlX = (sxp + txp) / 2 + (-ddy / len) * bow;
  const ctrlY = (syp + typ) / 2 + (ddx / len) * bow;
  return `M${sxp},${syp} Q${ctrlX},${ctrlY} ${txp},${typ}`;
}

export function Map({ layout, index, currentVnum, selectedVnum, activeZ, onSelectRoom, onSetCurrent, onCrossArea, onChangeZ, zFilter, zoomApiRef }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [transform, setTransform] = useState({ k: 0.7, x: 0, y: 0 });

  const isolating = zFilter !== 'all';
  const visibleRooms = useMemo(() => {
    const list = Object.values(layout.placed);
    const filtered = isolating
      ? list.filter((p) => p.z === zFilter)
      : list.filter((p) => layerOpacity(p.z, activeZ) > 0);
    // Sort z asc so higher layers render on top of lower layers (axonometric stacking order).
    return filtered.slice().sort((a, b) => a.z - b.z);
  }, [layout, zFilter, isolating, activeZ]);

  const visibleVnumSet = useMemo(() => new Set(visibleRooms.map((r) => r.vnum)), [visibleRooms]);

  // Grid occupancy ("x,y,z") for neighbour-aware label sizing.
  const occupied = useMemo(() => {
    const s = new Set<string>();
    for (const p of Object.values(layout.placed)) s.add(`${p.x},${p.y},${p.z}`);
    return s;
  }, [layout]);

  // file → localized zone name (for cross-area destination labels). Plain object because the
  // component is named `Map`, which shadows the global Map constructor in this module.
  const areaNameByFile = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of index.areas) m[a.file] = a.name;
    return m;
  }, [index]);

  const visibleEdges = useMemo(() => {
    return layout.exits.filter((e) => {
      const fromVisible = visibleVnumSet.has(e.from);
      const toVisible = visibleVnumSet.has(e.to);
      if (e.dir === 'up' || e.dir === 'down') return fromVisible || toVisible;
      if (e.style === 'cross_area') return fromVisible;
      return fromVisible && toVisible;
    });
  }, [layout.exits, visibleVnumSet]);

  /** Per-edge detour flag: true when the straight cardinal path between source and target
   * would pass through any other tile (same row or column, between the endpoints).
   * Triggers a perpendicular lane offset in the renderer. */
  const obstructedEdges = useMemo(() => {
    const out = new Set<PlacedExit>();
    const placed = Object.values(layout.placed);
    for (const e of layout.exits) {
      if (e.dir === 'up' || e.dir === 'down' || e.style === 'cross_area') continue;
      const f = layout.placed[e.from];
      const t = layout.placed[e.to];
      if (!f || !t || f.z !== t.z) continue;
      let blocked = false;
      if (f.y === t.y) {
        const minX = Math.min(f.x, t.x);
        const maxX = Math.max(f.x, t.x);
        blocked = placed.some((p) =>
          p.vnum !== e.from && p.vnum !== e.to &&
          p.z === f.z && p.y === f.y && p.x > minX && p.x < maxX);
      } else if (f.x === t.x) {
        const minY = Math.min(f.y, t.y);
        const maxY = Math.max(f.y, t.y);
        blocked = placed.some((p) =>
          p.vnum !== e.from && p.vnum !== e.to &&
          p.z === f.z && p.x === f.x && p.y > minY && p.y < maxY);
      }
      if (blocked) out.add(e);
    }
    return out;
  }, [layout]);

  // Set up d3-zoom.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = select(svgRef.current);
    // Max zoom: at peak, a tile should occupy ~33% of the smaller viewport dimension.
    // Hard-capped at 1.5 so even on tiny viewports we don't end up rendering a single tile
    // larger than that (avoids the whole-screen-card effect).
    const w0 = svgRef.current.clientWidth || 1200;
    const h0 = svgRef.current.clientHeight || 800;
    const maxByW = (w0 * 0.33) / TILE_W;
    const maxByH = (h0 * 0.33) / TILE_H;
    const maxScale = Math.min(Math.max(0.6, maxByW), Math.max(0.6, maxByH), 1.5);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.12, maxScale])
      .on('zoom', (ev) => setTransform({ k: ev.transform.k, x: ev.transform.x, y: ev.transform.y }));
    zoomRef.current = z;
    svg.call(z);
    // Initial pan: center on midpoint of bounds.
    const w = svgRef.current.clientWidth;
    const h = svgRef.current.clientHeight;
    const midSX = ((layout.bounds.maxX - layout.bounds.minX) / 2) * STEP_X;
    const midSY = ((layout.bounds.maxY - layout.bounds.minY) / 2) * STEP_Y;
    // Default zoom 35% — also the reset level when the map remounts after toggling ASCII.
    const k = 0.35;
    const tx = w / 2 - (midSX + TILE_W / 2) * k;
    const ty = h / 2 - (midSY + TILE_H / 2) * k;
    svg.call(z.transform, zoomIdentity.translate(tx, ty).scale(k));
    return () => { svg.on('.zoom', null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.meta.file]);

  // Publish an imperative zoom handle for host +/- buttons. Zooms about the viewport
  // centre via d3's scaleBy (instant — d3-transition isn't a dependency here).
  useEffect(() => {
    if (!zoomApiRef) return;
    zoomApiRef.current = {
      zoomBy(factor: number) {
        if (!svgRef.current || !zoomRef.current) return;
        const w = svgRef.current.clientWidth;
        const h = svgRef.current.clientHeight;
        select(svgRef.current).call(zoomRef.current.scaleBy, factor, [w / 2, h / 2]);
      },
    };
    return () => { if (zoomApiRef) zoomApiRef.current = null; };
  }, [zoomApiRef]);

  // Auto-pan to current room (without zoom change).
  useEffect(() => {
    if (currentVnum == null || !svgRef.current || !zoomRef.current) return;
    const placed = layout.placed[currentVnum];
    if (!placed) return;
    const { sx, sy } = placedToScreen(placed, layout.bounds);
    const w = svgRef.current.clientWidth;
    const h = svgRef.current.clientHeight;
    const k = transform.k;
    const tx = w / 2 - (sx + TILE_W / 2) * k;
    const ty = h / 2 - (sy + TILE_H / 2) * k;
    select(svgRef.current).call(zoomRef.current.transform, zoomIdentity.translate(tx, ty).scale(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVnum, layout]);

  // Counter-scale room labels against zoom-out so they stay legible. At k>=1 labels keep
  // their base size; as you zoom out (k<1) they grow toward a cap, then hold.
  const labelZoom = Math.min(2.4, Math.max(1, 1 / transform.k));

  return (
    <svg ref={svgRef} className="map-svg" role="group" aria-label={t.mapOf(layout.meta.name)}>
      <defs>
        {/* Soft drop shadow filter — replaces the manual offset rect for a more painterly look. */}
        <filter id="tile-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.4" />
          <feOffset dx="3" dy="5" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.55" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Cyan halo around the current room — soft outward bloom. */}
        <filter id="glow-current" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="6" />
        </filter>

        <marker id="arrow-cross" viewBox="0 -4 8 8" refX="7" refY="0" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,-4L8,0L0,4" fill={COLOR.darkCyan} />
        </marker>
        {/* fill follows the line's stroke (sector colour) so the arrowhead matches the connector. */}
        <marker id="arrow-vertical" viewBox="0 -4 8 8" refX="7" refY="0" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,-4L8,0L0,4" fill="context-stroke" />
        </marker>
        <marker id="arrow-warp" viewBox="0 -4 8 8" refX="7" refY="0" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,-4L8,0L0,4" fill={COLOR.warp} />
        </marker>
        {/* One-way edge marker: small chevron at the target end. Color matches the edge stroke. */}
        <marker id="arrow-oneway" viewBox="-1 -5 12 10" refX="9" refY="0" markerWidth="9" markerHeight="9" orient="auto">
          <path d="M0,-4L9,0L0,4" fill="none" stroke={COLOR.parchment} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
        </marker>
        {/* Cycle/contradiction edge marker: red filled arrowhead at the target end. */}
        <marker id="arrow-cycle" viewBox="0 -4 8 8" refX="7" refY="0" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,-4L8,0L0,4" fill={COLOR.rust} />
        </marker>
        <pattern id="hatch-locked" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
          <rect width="7" height="7" fill={COLOR.ink} />
          <line x1="0" y1="0" x2="0" y2="7" stroke={COLOR.rust} strokeWidth="1.4" />
        </pattern>
      </defs>

      <g ref={gRef} transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {/* Edges (drawn under tiles) */}
        {visibleEdges.map((edge, i) => {
          const fromP = layout.placed[edge.from];
          if (!fromP) return null;

          // Edge opacity: stronger of the two endpoints' layer-opacities (only matters in all-layers mode).
          const toPForOpacity = layout.placed[edge.to];
          const opa = isolating ? 1 : Math.max(
            layerOpacity(fromP.z, activeZ),
            toPForOpacity ? layerOpacity(toPForOpacity.z, activeZ) : 0,
          );
          if (opa <= 0) return null;

          const fromScale = isolating ? 1 : layerScale(fromP.z, activeZ);
          const halfFromW = TILE_W * fromScale / 2;
          const halfFromH = TILE_H * fromScale / 2;
          // Port extents include EDGE_GAP so edges start/end outside the tile's click box.
          const portFromW = halfFromW + EDGE_GAP;
          const portFromH = halfFromH + EDGE_GAP;

          // Self-loop (exit targets its own room — undrawable as a tile-to-tile line).
          // Render a small stick poking out the exit's direction, with no far end.
          if (edge.from === edge.to) {
            const fromS = placedToScreen(fromP, layout.bounds);
            const ux = edge.dir === 'east' ? 1 : edge.dir === 'west' ? -1 : (edge.dir === 'up' ? 1 : 0);
            const uy = edge.dir === 'north' || edge.dir === 'up' ? -1 : edge.dir === 'south' || edge.dir === 'down' ? 1 : 0;
            const cx = fromS.sx + TILE_W / 2;
            const cy = fromS.sy + TILE_H / 2;
            const [x1, y1] = clipFromCenter(cx, cy, cx + ux * STUB_LEN * 4, cy + uy * STUB_LEN * 4, portFromW, portFromH);
            const STICK = 22;
            return (
              <g key={`e${i}`} opacity={opa * 0.45}>
                <line x1={x1} y1={y1} x2={x1 + ux * STICK} y2={y1 + uy * STICK}
                      stroke={COLOR.warp} strokeWidth={1.3} strokeDasharray="2 3" strokeLinecap="round" />
              </g>
            );
          }

          // Cross-area (any direction, incl. up/down) — destination "tile" one step away (a
          // diagonal step for up/down), joined by a dark-cyan dashed connector. Shows the
          // localized zone name and loads that zone on click. Handled before the vertical
          // branch because the target room lives in another area (not in layout.placed).
          if (edge.style === 'cross_area') {
            const fromS = placedToScreen(fromP, layout.bounds);
            const dx = edge.dir === 'east' ? 1 : edge.dir === 'west' ? -1 : edge.dir === 'up' ? 1 : edge.dir === 'down' ? -1 : 0;
            const dy = edge.dir === 'north' ? -1 : edge.dir === 'south' ? 1 : edge.dir === 'up' ? -1 : edge.dir === 'down' ? 1 : 0;
            const cx = fromS.sx + TILE_W / 2;
            const cy = fromS.sy + TILE_H / 2;
            const ghostCx = cx + dx * STEP_X;
            const ghostCy = cy + dy * STEP_Y;
            const [x1, y1] = clipFromCenter(cx, cy, ghostCx, ghostCy, portFromW, portFromH);
            const [x2, y2] = clipFromCenter(ghostCx, ghostCy, cx, cy, portFromW, portFromH);
            const areaName = areaNameByFile[edge.targetArea || ''] || edge.targetArea || '';
            const f = fittedLabel(areaName);
            const cFont = f.fontSize * labelZoom;
            const cLineH = f.lineH * labelZoom;
            const cBlockH = f.lines.length === 0 ? 0 : (f.lines.length - 1) * cLineH + Math.round(cFont);
            const cFirstY = ghostCy - cBlockH / 2 + Math.round(cFont * 0.82);
            return (
              <g key={`e${i}`} opacity={opa} style={{ cursor: 'pointer' }}
                 role="button" aria-label={t.toZone(areaName)}
                 onClick={() => onCrossArea(edge.targetArea || '', edge.to)}>
                <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={EXIT_COLOR.cross_area} strokeWidth={1.8}
                      strokeDasharray={EXIT_DASH.cross_area} markerEnd="url(#arrow-cross)" />
                {/* transparent hit area so the destination works like a room tile */}
                <rect x={ghostCx - TILE_W / 2} y={ghostCy - TILE_H / 2} width={TILE_W} height={TILE_H}
                      fill="transparent" pointerEvents="all" />
                {f.lines.length > 0 && (
                  <text x={ghostCx} y={cFirstY} fontSize={cFont} textAnchor="middle" fill={COLOR.darkCyan}
                        style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'var(--font-mono), ui-monospace, monospace', fontWeight: 600, letterSpacing: '0.02em' }}>
                    {f.lines.map((ln, idx) => <tspan key={idx} x={ghostCx} dy={idx === 0 ? 0 : cLineH}>{ln}</tspan>)}
                  </text>
                )}
              </g>
            );
          }

          // Vertical (up/down) in-area — full line between tile edges when both visible
          // (axonometric diagonal), otherwise stub on the visible endpoint with target name.
          if (edge.dir === 'up' || edge.dir === 'down') {
            const toP = layout.placed[edge.to];
            if (!toP) return null;
            const fromVisible = visibleVnumSet.has(edge.from);
            const toVisible = visibleVnumSet.has(edge.to);
            if (fromVisible && toVisible) {
              const toScale = isolating ? 1 : layerScale(toP.z, activeZ);
              return renderVerticalLine(layout, edge, i, opa, fromScale, toScale);
            }
            return renderVerticalStub(layout, edge, i, fromVisible, opa, fromScale, labelZoom, onSetCurrent, onChangeZ);
          }

          // Cardinal in-area exit — Manhattan route from cardinal port on source to reverse port on target.
          const toP = layout.placed[edge.to];
          if (!toP) return null;

          // Warp link — curved arc to the correct face of the destination (see cardinalArc).
          // Red for wrong-side cycle/contradiction warps (target in the opposite half-plane),
          // purple for ordinary warps. Never a straight grid corridor.
          if (edge.style === 'warp') {
            const toScaleArc = isolating ? 1 : layerScale(toP.z, activeZ);
            const fromS = placedToScreen(fromP, layout.bounds);
            const toS = placedToScreen(toP, layout.bounds);
            const cx1 = fromS.sx + TILE_W / 2;
            const cy1 = fromS.sy + TILE_H / 2;
            const cx2 = toS.sx + TILE_W / 2;
            const cy2 = toS.sy + TILE_H / 2;
            const wrong = warpWrongSide(edge.dir, fromP, toP);
            const d = cardinalArc(cx1, cy1, portFromW, portFromH,
              cx2, cy2, TILE_W * toScaleArc / 2 + EDGE_GAP, TILE_H * toScaleArc / 2 + EDGE_GAP, edge.dir);
            // Warps are recessive — thin, faint, dashed — so the clean grid reads first.
            return (
              <g key={`e${i}`} opacity={opa * 0.45}>
                <path d={d} fill="none"
                      stroke={wrong ? COLOR.rust : COLOR.warp} strokeWidth={1.3}
                      strokeDasharray="4 5" strokeLinecap="round"
                      markerEnd={wrong ? 'url(#arrow-cycle)' : 'url(#arrow-warp)'} />
              </g>
            );
          }

          const toScale = isolating ? 1 : layerScale(toP.z, activeZ);
          const portToW = TILE_W * toScale / 2 + EDGE_GAP;
          const portToH = TILE_H * toScale / 2 + EDGE_GAP;
          const fromS = placedToScreen(fromP, layout.bounds);
          const toS = placedToScreen(toP, layout.bounds);
          const cx1 = fromS.sx + TILE_W / 2;
          const cy1 = fromS.sy + TILE_H / 2;
          const cx2 = toS.sx + TILE_W / 2;
          const cy2 = toS.sy + TILE_H / 2;
          const route = manhattanPath(cx1, cy1, portFromW, portFromH, cx2, cy2, portToW, portToH, edge.dir, obstructedEdges.has(edge));

          const isDoor = isDoorStyle(edge.style);

          // Underwater / air exits — by exit flag or either endpoint's sector. Recolour the
          // line and show a fish / bird at the middle. Doors keep their own styling.
          const fromSec = layout.rooms[edge.from]?.sector;
          const toSec = layout.rooms[edge.to]?.sector;
          const isSwim = !isDoor && (edge.hasSwim || fromSec === 'underwater' || toSec === 'underwater');
          const isFly = !isDoor && !isSwim && (edge.hasFly || fromSec === 'air' || toSec === 'air');
          const lineColor = isSwim ? COLOR.swimBlue : isFly ? COLOR.flyBlue : EXIT_COLOR[edge.style];
          const icon = isDoor ? null : isSwim ? '🐟' : isFly ? '🐦' : exitMidIcon(edge);

          // Door / icon decorations sit at the true middle of the connector (between centres).
          const midX = (cx1 + cx2) / 2;
          const midY = (cy1 + cy2) / 2;
          const dLen = Math.hypot(cx2 - cx1, cy2 - cy1) || 1;
          const ux = (cx2 - cx1) / dLen, uy = (cy2 - cy1) / dLen;

          return (
            <g key={`e${i}`} opacity={opa}>
              <path d={route.d} stroke={lineColor} strokeWidth={2.2}
                    strokeDasharray={EXIT_DASH[edge.style]} fill="none"
                    strokeLinejoin="round" strokeLinecap="round"
                    markerEnd={edge.bidirectional ? undefined : 'url(#arrow-oneway)'} />
              {/* Door — jambs perpendicular to the connector ("|" if horizontal, "--" if vertical). */}
              {isDoor && renderDoorDeco(midX, midY, ux, uy, doorGlyphFor(edge.style), EXIT_COLOR[edge.style])}
              {icon && (
                <g pointerEvents="none">
                  <rect x={midX - 8} y={midY - 8} width={16} height={16} rx={3}
                        fill={COLOR.ink} stroke={lineColor} strokeWidth={0.5} />
                  <text x={midX} y={midY + 4} fontSize="11" textAnchor="middle"
                        fill={lineColor}>{icon}</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Tiles — sorted z asc so higher layers stack on top of lower ones */}
        {visibleRooms.map((p) => {
          const room = layout.rooms[p.vnum];
          if (!room) return null;
          const { sx, sy } = placedToScreen(p, layout.bounds);
          // 'indoors'-flagged rooms render like the 'inside' sector.
          const effectiveSector = room.flags.includes('indoors') ? 'inside' : room.sector;
          const style = sectorStyle(effectiveSector);
          const isCurrent = p.vnum === currentVnum;
          const isSelected = p.vnum === selectedVnum;
          const opa = isolating ? 1 : layerOpacity(p.z, activeZ);
          const scale = isolating ? 1 : layerScale(p.z, activeZ);
          const cx = sx + TILE_W / 2;
          const cy = sy + TILE_H / 2;

          // Label layout — same for every tile: use the free space around it (bigger where
          // neighbours are absent), growing with zoom-out only up to that space (no overlap).
          // Selection does NOT shrink the label — instead the purple box grows to wrap it.
          const hasNeighborX = occupied.has(`${p.x - 1},${p.y},${p.z}`) || occupied.has(`${p.x + 1},${p.y},${p.z}`);
          const hasNeighborY = occupied.has(`${p.x},${p.y - 1},${p.z}`) || occupied.has(`${p.x},${p.y + 1},${p.z}`);
          const maxW = hasNeighborX ? TILE_W - 8 : TILE_W + GAP_X * 0.8;
          const maxH = hasNeighborY ? TILE_H - 6 : TILE_H + GAP_Y * 0.8;
          const base = boxedLabel(room.name, maxW, maxH, 22);
          const bw = base.lines.reduce((m, l) => Math.max(m, l.length), 0) * base.fontSize * 0.6;
          const bh = base.lines.length * base.fontSize * 1.15;
          const growCap = Math.max(1, Math.min(maxW / (bw || 1), maxH / (bh || 1)));
          const z = Math.min(labelZoom, growCap);
          const lines = base.lines;
          const fontSize = base.fontSize * z;
          const lineH = base.lineH * z;
          const blockW = lines.reduce((m, l) => Math.max(m, l.length), 0) * fontSize * 0.6;
          const blockH = lines.length === 0 ? 0 : (lines.length - 1) * lineH + Math.round(fontSize);
          const firstLineY = cy - blockH / 2 + Math.round(fontSize * 0.82);

          // Selected purple box / current halo are sized to wrap the label with margin.
          const boxW = Math.max(TILE_W, blockW + 20);
          const boxH = Math.max(TILE_H, blockH + 16);

          // Label colour: selected → black on purple fill; current → cyan; else sector colour.
          const labelFill = isSelected ? COLOR.ink : isCurrent ? COLOR.cyan : style.text;

          const labelEl = lines.length > 0 ? (
            <text x={cx} y={firstLineY} fontSize={fontSize} textAnchor="middle" fill={labelFill}
                  style={{
                    userSelect: 'none',
                    pointerEvents: 'none',
                    fontFamily: 'var(--font-mono), ui-monospace, monospace',
                    fontWeight: (isCurrent || isSelected) ? 600 : 400,
                    letterSpacing: '0.02em',
                  }}>
              {lines.map((ln, idx) => (
                <tspan key={idx} x={cx} dy={idx === 0 ? 0 : lineH}>{ln}</tspan>
              ))}
            </text>
          ) : null;

          return (
            <g key={p.vnum} opacity={opa}
               transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`}
               role="button"
               tabIndex={0}
               aria-label={`${room.name || t.unnamedRoom}, ${sectorLabel(effectiveSector)}${p.z !== 0 ? t.layerZ(p.z) : ''}${isCurrent ? ', ' + t.currentLocation : ''}`}
               style={{ cursor: 'pointer' }}
               onClick={() => onSelectRoom(p.vnum)}
               onDoubleClick={() => onSetCurrent(p.vnum)}>
              {/* Current-location halo — cyan bloom wrapping the label/box with margin. */}
              {isCurrent && (
                <rect x={cx - (boxW + 8) / 2} y={cy - (boxH + 8) / 2} width={boxW + 8} height={boxH + 8}
                      rx={TILE_RADIUS + 4} fill={COLOR.cyan} opacity={0.32}
                      filter="url(#glow-current)">
                  <animate attributeName="opacity" values="0.4;0.18;0.4" dur="2.2s" repeatCount="indefinite" />
                </rect>
              )}

              {p.isVoid ? (
                // Void tile keeps its hatched box + glyph.
                <g filter="url(#tile-shadow)">
                  <rect x={sx} y={sy} width={TILE_W} height={TILE_H} rx={TILE_RADIUS} ry={TILE_RADIUS}
                        fill="url(#hatch-locked)"
                        stroke={isCurrent ? COLOR.cyan : style.stroke} strokeWidth={isCurrent ? 1.6 : 1} />
                  <text x={cx} y={cy + 7} fontSize="22" textAnchor="middle" fill={COLOR.rust}
                        style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'var(--font-mono), monospace' }}>
                    ✦
                  </text>
                </g>
              ) : isSelected ? (
                // Selected tile — solid purple box grown to wrap the full-size label, black text.
                <g filter="url(#tile-shadow)">
                  <rect x={cx - boxW / 2} y={cy - boxH / 2} width={boxW} height={boxH} rx={TILE_RADIUS} ry={TILE_RADIUS}
                        fill={COLOR.amber} stroke="none" />
                  {labelEl}
                </g>
              ) : (
                // Box-less tile — sector-coloured, size-fitted label only. The label has
                // pointerEvents:none, so a transparent rect provides the click/hit area.
                <>
                  <rect x={sx} y={sy} width={TILE_W} height={TILE_H} rx={TILE_RADIUS} ry={TILE_RADIUS}
                        fill="transparent" pointerEvents="all" />
                  {labelEl}
                </>
              )}

              <title>{`${room.name || t.unnamedRoom}\n${sectorLabel(room.sector)}\n${t.exits}: ${room.exits.map((e) => t.dir[e.dir] ?? e.dir).join(', ') || '—'}`}</title>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Direct line between corner ports for vertical exits when both layers visible.
 *  Source port: top-right corner (up) or bottom-left (down).
 *  Target port: opposite corner. */
function renderVerticalLine(layout: AreaLayout, edge: PlacedExit, key: number, opa: number, fromScale: number, toScale: number): JSX.Element | null {
  const fromP = layout.placed[edge.from];
  const toP = layout.placed[edge.to];
  if (!fromP || !toP) return null;
  const fromS = placedToScreen(fromP, layout.bounds);
  const toS = placedToScreen(toP, layout.bounds);
  const cx1 = fromS.sx + TILE_W / 2;
  const cy1 = fromS.sy + TILE_H / 2;
  const cx2 = toS.sx + TILE_W / 2;
  const cy2 = toS.sy + TILE_H / 2;
  const dir = edge.dir as 'up' | 'down';
  const [x1, y1] = cornerPort(cx1, cy1, TILE_W * fromScale / 2 + EDGE_GAP, TILE_H * fromScale / 2 + EDGE_GAP, dir);
  // Target's matching corner is the opposite (the corner on its tile facing the source).
  const reverseDir = dir === 'up' ? 'down' : 'up';
  const [x2, y2] = cornerPort(cx2, cy2, TILE_W * toScale / 2 + EDGE_GAP, TILE_H * toScale / 2 + EDGE_GAP, reverseDir);
  const door = isDoorStyle(edge.style);
  const dLen = Math.hypot(x2 - x1, y2 - y1) || 1;
  const vcolor = roomSectorColor(layout, edge.to); // colour by the room the exit leads to
  return (
    <g key={`v${key}`} opacity={opa}>
      <line x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={vcolor} strokeWidth={2} strokeDasharray="6 4"
            markerEnd={edge.bidirectional ? 'url(#arrow-vertical)' : 'url(#arrow-oneway)'} opacity={0.85} />
      {door && renderDoorDeco((x1 + x2) / 2, (y1 + y2) / 2, (x2 - x1) / dLen, (y2 - y1) / dLen, doorGlyphFor(edge.style), EXIT_COLOR[edge.style])}
    </g>
  );
}

/** Stub fallback when the other endpoint isn't visible (z-filter active). */
function renderVerticalStub(
  layout: AreaLayout,
  edge: PlacedExit,
  key: number,
  fromIsAnchor: boolean,
  opa: number,
  anchorScale: number,
  labelZoom: number,
  onSetCurrent: (vnum: number) => void,
  onChangeZ: (z: number | 'all') => void,
): JSX.Element | null {
  const fromP = layout.placed[edge.from];
  const toP = layout.placed[edge.to];
  if (!fromP || !toP) return null;

  const anchorP = fromIsAnchor ? fromP : toP;
  const otherVnum = fromIsAnchor ? edge.to : edge.from;
  const dirIsUp = fromIsAnchor ? edge.dir === 'up' : edge.dir === 'down';

  const otherP = layout.placed[otherVnum];
  const otherRoom = layout.rooms[otherVnum];
  const targetName = otherRoom?.name || '(unknown)';
  const targetZ = otherP?.z ?? anchorP.z;

  const { sx, sy } = placedToScreen(anchorP, layout.bounds);
  // Source port is the corner: up → top-right, down → bottom-left.
  const dx = dirIsUp ? 1 : -1;
  const dy = dirIsUp ? -1 : 1;
  const cx = sx + TILE_W / 2;
  const cy = sy + TILE_H / 2;
  const [startX, startY] = cornerPort(cx, cy, TILE_W * anchorScale / 2 + EDGE_GAP, TILE_H * anchorScale / 2 + EDGE_GAP,
    dirIsUp ? 'up' : 'down');
  const endX = startX + dx * STUB_LEN;
  const endY = startY + dy * STUB_LEN;
  // Same default sizing as a normal room label (by name length), scaled with zoom-out.
  const nameFont = fittedLabel(targetName).fontSize * labelZoom;
  const labelX = endX + dx * 6;
  const labelY = endY + dy * 6 + (dirIsUp ? -6 : nameFont);

  const vcolor = roomSectorColor(layout, otherVnum); // colour by the room the stair leads to

  const handleJump = () => {
    onChangeZ(targetZ);
    onSetCurrent(otherVnum);
  };

  return (
    <g key={`v${key}`} opacity={opa} style={{ cursor: 'pointer' }} onClick={handleJump}
       role="button" aria-label={dirIsUp ? t.upTo(targetName) : t.downTo(targetName)}>
      <line x1={startX} y1={startY} x2={endX} y2={endY}
            stroke={vcolor} strokeWidth={2} strokeDasharray="4 3"
            markerEnd="url(#arrow-vertical)" />
      {isDoorStyle(edge.style) && renderDoorDeco((startX + endX) / 2, (startY + endY) / 2,
        dx / Math.SQRT2, dy / Math.SQRT2, doorGlyphFor(edge.style), EXIT_COLOR[edge.style])}
      <text x={labelX} y={labelY} fontSize={nameFont} textAnchor={dx > 0 ? 'start' : 'end'} fill={vcolor}
            style={{ cursor: 'pointer', fontFamily: 'var(--font-mono), ui-monospace, monospace', letterSpacing: '0.02em' }}>
        {dirIsUp ? '▲' : '▼'} {targetName}
      </text>
    </g>
  );
}
