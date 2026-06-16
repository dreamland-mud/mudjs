/**
 * useGraphMapper — drives the graphical DL mapper from the live player location.
 *
 * The standalone mapper (dreamland_mapper) owned its area/current-room as UI state fed
 * by a dropdown + placeholder. In mudjs both are authoritative from the game: the area
 * and current vnum arrive over the `location` BroadcastChannel (see ../map.jsx useLocation).
 * This hook loads the precomputed graph for the player's area, tracks selection/z-layer,
 * and turns "run here" into a real `run <speedwalk>` sent down the websocket.
 *
 * Graph JSON is fetched on demand from /maps/graph/ (served beside the legacy ASCII
 * /maps/sources/*.html), mirroring how the ASCII map already fetches per-area.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { findPath, pathToSpeedwalk } from './pathfinding.js';
import { DIR_LETTERS } from './types.js';
import { t } from './i18n.js';
import { send } from '../../websock.js';

const GRAPH_BASE = '/maps/graph';

/** Live area filename ("newthalos.are") -> mapper graph key ("newthalos"). */
export function areaKey(area) {
  return (area || '').replace(/\.are$/, '');
}

/**
 * Re-base z (in place) so the ground floor becomes z=0 — ported verbatim from the
 * standalone mapper's App.tsx. Considers only the MAIN (largest) cluster; a layer with a
 * clear plurality (>=40%) of its rooms is the ground (flat cities), else the layer with
 * the most cross-area exits is the ground (towers → entrance floor).
 */
function rebaseZ(l) {
  const clusterSize = {};
  for (const p of Object.values(l.placed)) clusterSize[p.cluster] = (clusterSize[p.cluster] || 0) + 1;
  let mainCluster = 0, mainSize = -1;
  for (const [c, n] of Object.entries(clusterSize)) if (n > mainSize) { mainSize = n; mainCluster = Number(c); }

  const roomZ = {};
  for (const p of Object.values(l.placed)) if (p.cluster === mainCluster) roomZ[p.z] = (roomZ[p.z] || 0) + 1;
  let mostRoomsZ = 0, maxRooms = -1;
  for (const [z, n] of Object.entries(roomZ)) if (n > maxRooms) { maxRooms = n; mostRoomsZ = Number(z); }
  if (maxRooms < 0) return;

  let target = mostRoomsZ;
  if (maxRooms < 0.4 * mainSize) {
    const crossZ = {};
    for (const e of l.exits) {
      if (e.style !== 'cross_area') continue;
      const p = l.placed[e.from];
      if (p && p.cluster === mainCluster) crossZ[p.z] = (crossZ[p.z] || 0) + 1;
    }
    const entries = Object.entries(crossZ);
    if (entries.length) target = Number(entries.sort((a, b) => b[1] - a[1])[0][0]);
  }
  if (target === 0) return;
  for (const p of Object.values(l.placed)) p.z -= target;
  l.zLayers = l.zLayers.map((z) => z - target).sort((a, b) => a - b);
}

/**
 * @param location {{area?: string, vnum?: number|string}} — live player location.
 * @param enabled  {boolean} — false in ASCII mode; skips all fetching.
 * @returns mapper state + actions consumed by the shell topbar and GraphMapPane.
 */
export function useGraphMapper(location, enabled) {
  const areaFile = areaKey(location.area);
  const currentVnum =
    location.vnum != null && location.vnum !== '' ? Number(location.vnum) : null;

  const [index, setIndex] = useState(null);
  const [layout, setLayout] = useState(null);
  const [selectedVnum, setSelectedVnum] = useState(null);
  const [zFilter, setZFilter] = useState(0);
  const [toast, setToast] = useState(null);
  // 'idle' | 'loading' | 'ready' | 'missing' | 'error' — drives the pane's fallback notice.
  const [status, setStatus] = useState('idle');

  // Cross-area index (vnum -> area, area names): loaded once, lazily, when first enabled.
  useEffect(() => {
    if (!enabled || index != null) return;
    let cancelled = false;
    fetch(`${GRAPH_BASE}/index.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((data) => { if (!cancelled) setIndex(data); })
      .catch((e) => {
        console.warn('[mapper] index.json load failed', e);
        // Degrade gracefully rather than hang: an empty index renders the map with
        // generic cross-area labels instead of leaving the pane stuck on "loading".
        if (!cancelled) setIndex({ areas: [], vnumToArea: {} });
      });
    return () => { cancelled = true; };
  }, [enabled, index]);

  // Load the player's area graph whenever the area changes (and the graph view is active).
  useEffect(() => {
    if (!enabled || !areaFile) return;
    let cancelled = false;
    setStatus('loading');
    fetch(`${GRAPH_BASE}/area-${areaFile}.json`)
      .then((r) => {
        if (r.status === 404) throw new Error('missing');
        if (!r.ok) throw new Error('http ' + r.status);
        return r.json();
      })
      .then((l) => {
        if (cancelled) return;
        rebaseZ(l); // ground layer -> z=0 before choosing the active layer
        setLayout(l);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setLayout(null);
        setStatus(err.message === 'missing' ? 'missing' : 'error');
        if (err.message !== 'missing') console.warn('[mapper] area load failed', areaFile, err);
      });
    return () => { cancelled = true; };
  }, [enabled, areaFile]);

  // Follow the player: on area-load and on every move, refocus the panel + active layer
  // onto the current room. The <Map> recenters the viewport on currentVnum by itself.
  useEffect(() => {
    if (status !== 'ready' || layout == null || currentVnum == null) return;
    const p = layout.placed[currentVnum];
    if (p == null) return;
    setSelectedVnum(currentVnum);
    setZFilter(p.z);
  }, [status, layout, currentVnum]);

  // Auto-dismiss toasts.
  useEffect(() => {
    if (toast == null) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Active z-layer: follows the focused room (selection, else current).
  const activeZ = useMemo(() => {
    if (layout == null) return 0;
    const focus = selectedVnum != null ? selectedVnum : currentVnum;
    if (focus == null) return 0;
    return layout.placed[focus]?.z ?? 0;
  }, [layout, selectedVnum, currentVnum]);

  /** Run the player to `target`: compute an in-area speedwalk and send it to the game. */
  const runTo = useCallback(
    (target) => {
      if (layout == null) return;
      if (currentVnum == null) { setToast(t.setCurrentFirst); return; }
      if (target === currentVnum) { setToast(t.alreadyThere); return; }
      const path = findPath(layout, currentVnum, target);
      if (path == null) { setToast(t.noPath); return; }
      if (path.length === 0) { setToast(t.alreadyThere); return; }
      const speedwalk = pathToSpeedwalk(path);
      // Real movement: the game moves the player and the location broadcast updates
      // currentVnum, which recenters the map. No optimistic local "set current".
      send('run ' + speedwalk);
      setToast(`run ${speedwalk}  ·  ${t.steps(path.length)}`);
    },
    [layout, currentVnum],
  );

  /** Walk one step in `dir` — used for cross-area exits, whose target isn't in this
   *  layout. The move updates the player's area, and the map follows automatically. */
  const walk = useCallback((dir) => {
    const cmd = DIR_LETTERS[dir];
    if (cmd) send(cmd);
  }, []);

  return {
    index,
    layout,
    status,
    areaFile,
    currentVnum,
    selectedVnum,
    setSelectedVnum,
    zFilter,
    setZFilter,
    activeZ,
    runTo,
    walk,
    toast,
    setToast,
  };
}
