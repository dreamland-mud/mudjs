import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import type { AreaLayout } from './types.js';
import { sectorLabel, sectorStyle } from './sectors.js';
import { t, nameFor, exitsPhrase, zLabel, type Locale } from './i18n.js';
import { sendHotKeyCmd } from '../sysCommands/hotkeySend';

interface Props {
  layout: AreaLayout;
  /** Active display locale; also busts memoized parents on a pure language switch. */
  locale: Locale;
  currentVnum: number | null;
  selectedVnum: number | null;
  /** True while the detail drawer overlays the bottom of the pane (adds scroll room). */
  drawerOpen?: boolean;
  onSelectRoom: (vnum: number) => void;
}

const KEEP_KEYS = new Set([
  'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
]);

interface Group {
  key: string;
  heading: string;
  clusters: { key: string; heading: string | null; vnums: number[] }[];
}

/**
 * RoomList — text alternative to the graph map: every room of the area as a real
 * <button>, grouped by z-layer (and by disconnected cluster when the area has several).
 * Built for screen readers: semantic headings + lists, the current room carries
 * aria-current="location", exits are spelled out in full words.
 */
export function RoomList({ layout, locale, currentVnum, selectedVnum, drawerOpen, onSelectRoom }: Props) {
  const currentRef = useRef<HTMLButtonElement | null>(null);

  const groups = useMemo(() => {
    const byZ: Record<number, number[]> = {};
    const unplaced: number[] = [];
    for (const r of Object.values(layout.rooms)) {
      const p = layout.placed[r.vnum];
      if (!p) { unplaced.push(r.vnum); continue; }
      if (!byZ[p.z]) byZ[p.z] = [];
      byZ[p.z].push(r.vnum);
    }
    const multiCluster = layout.clusters > 1;
    const out: Group[] = [];
    // Ground floor first, then the floors above (going up), then the basements (going down).
    const zs = Object.keys(byZ).map(Number).sort((a, b) => {
      const rank = (z: number) => (z === 0 ? 0 : z > 0 ? 1 : 2);
      return rank(a) - rank(b) || Math.abs(a) - Math.abs(b);
    });
    for (const z of zs) {
      const vnums = byZ[z].slice().sort((a, b) => a - b);
      const byCluster: Record<number, number[]> = {};
      for (const v of vnums) {
        const c = layout.placed[v].cluster;
        if (!byCluster[c]) byCluster[c] = [];
        byCluster[c].push(v);
      }
      const clusterKeys = Object.keys(byCluster).map(Number).sort((a, b) => a - b);
      out.push({
        key: `z${z}`,
        heading: t.layerHeading(zLabel(z), vnums.length),
        clusters: clusterKeys.map((c) => ({
          key: `z${z}c${c}`,
          heading: multiCluster ? t.clusterOf(c + 1, layout.clusters) : null,
          vnums: byCluster[c],
        })),
      });
    }
    if (unplaced.length > 0) {
      const label = t.unmapped.charAt(0).toUpperCase() + t.unmapped.slice(1);
      out.push({
        key: 'unplaced',
        heading: `${label} · ${t.rooms(unplaced.length)}`,
        clusters: [{ key: 'unplaced', heading: null, vnums: unplaced.sort((a, b) => a - b) }],
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, locale]);

  // Same-named rooms ("In the Dungeon" x5) get an ordinal in list order, so they can be
  // told apart: vnum -> "(2 of 5)".
  const dupLabel = useMemo(() => {
    const byName: Record<string, number[]> = {};
    for (const g of groups) {
      for (const c of g.clusters) {
        for (const v of c.vnums) {
          const n = nameFor(layout.rooms[v], locale) || t.unnamedRoom;
          if (!byName[n]) byName[n] = [];
          byName[n].push(v);
        }
      }
    }
    const out: Record<number, string> = {};
    for (const vs of Object.values(byName)) {
      if (vs.length < 2) continue;
      vs.forEach((v, i) => { out[v] = t.dupOf(i + 1, vs.length); });
    }
    return out;
  }, [groups, layout, locale]);

  // Bring the current room into view when the list opens or the area changes (no focus move).
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [layout.meta.file]);

  // Activation and navigation keys stay here: the global cmdinput keydown handler would
  // otherwise pull focus into the command line (and recall history on arrows). A player
  // macro bound to the key still fires first, same priority the global handler gives it.
  const keepKeys = (e: KeyboardEvent) => {
    if (sendHotKeyCmd(e.nativeEvent)) return;
    if (KEEP_KEYS.has(e.key)) e.stopPropagation();
  };

  const total = Object.keys(layout.rooms).length;
  let summary = t.rooms(total);
  if (layout.zLayers.length > 1) summary += ` · ${t.layers}: ${layout.zLayers.map(zLabel).join(', ')}`;
  if (layout.clusters > 1) summary += ` · ${t.clusters(layout.clusters)}`;

  return (
    <section className="room-list" aria-label={t.listView} data-drawer={drawerOpen ? 'true' : 'false'}
             onKeyDown={keepKeys}>
      <p className="room-list-summary">{summary}</p>
      {groups.map((g) => (
        <div key={g.key}>
          <h3 className="room-list-heading">{g.heading}</h3>
          {g.clusters.map((c) => (
            <div key={c.key}>
              {c.heading && <h4 className="room-list-subheading">{c.heading}</h4>}
              <ul className="room-list-items">
                {c.vnums.map((v) => {
                  const room = layout.rooms[v];
                  const p = layout.placed[v];
                  const sector = room.flags.includes('indoors') ? 'inside' : room.sector;
                  const isCurrent = v === currentVnum;
                  const isNoRecall = room.flags.includes('no_recall');
                  const short = room.exits.map((e) => t.dirShort[e.dir] ?? e.dir).join(' ');
                  return (
                    <li key={v}>
                      <button
                        type="button"
                        ref={isCurrent ? currentRef : undefined}
                        className={`room-list-item${v === selectedVnum ? ' is-selected' : ''}`}
                        aria-current={isCurrent ? 'location' : undefined}
                        onClick={() => onSelectRoom(v)}
                      >
                        <span className="room-list-name" style={isCurrent ? undefined : { color: sectorStyle(sector).text }}>
                          {nameFor(room, locale) || t.unnamedRoom}
                          {dupLabel[v] ? ` ${dupLabel[v]}` : ''}
                        </span>
                        <span className="dl-mapper-sr-only">, </span>
                        <span className="room-list-meta">
                          {sectorLabel(sector)}{isNoRecall ? `, ${t.noRecall}` : ''}
                        </span>
                        {p?.isVoid && <span className="room-list-void">{t.voidShort}</span>}
                        <span className="room-list-exits" aria-hidden="true">{short || '—'}</span>
                        <span className="dl-mapper-sr-only">, {exitsPhrase(room.exits)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
