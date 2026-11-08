/* Rooms of this area when the map pane is not on the screen (a window under
 * 1280 pixels wide, or zoomed in, has no map pane): a find window over the
 * map's own data, like the desktop client's room list. The search box takes
 * the focus, Down moves through the rooms nearest first, Enter shows a room,
 * Walk there runs to it with the map's own route. It shows what the map pane
 * shows, no more and no less. With the map pane showing, the rooms key uses
 * that pane instead and this window stays closed. */
import React, { useMemo, useRef } from 'react';
import Sheet from '../Sheet';
import FindView from '../FindView';
import { putInInput, run } from '../walk';
import { t } from '../../i18n';
import { useLocation } from '../../components/map';
import { useGraphMapper } from '../../components/mapper/useGraphMapper';
import { t as mt, setLocale, localeFromLang, nameFor, exitsPhrase, zLabel } from '../../components/mapper/i18n';
import { listGroups, dupLabels } from '../../components/mapper/RoomList';
import { sectorLabel } from '../../components/mapper/sectors';
import { routesFrom, pathToSpeedwalk } from '../../components/mapper/pathfinding';
import { tr, useOpener, later } from './common';

const LOCALES = ['en', 'ru', 'ua'];

function stepsText(steps) {
  if (steps === 0) return t('rooms.here');
  return steps === 1 ? tr('areas.step') : tr('areas.steps', steps);
}

export default function RoomsView() {
  const { open, arg, gen, close } = useOpener('rooms');
  const location = useLocation();
  const locale = localeFromLang(location.lang);
  setLocale(locale);
  const { layout, currentVnum, status } = useGraphMapper(location, open);
  const search = useRef(null);
  // The order is fixed when the window opens or the area changes: a move while
  // reading updates the steps but does not shuffle the list under the focus.
  const order = useRef({ key: null, rank: {} });

  const ready = open && status === 'ready' && !!layout;

  const rows = useMemo(() => {
    if (!ready) return [];
    const routes = currentVnum != null ? routesFrom(layout, currentVnum) : {};
    // The map's List view order and its "2 of 5" numbers, so a room is the same in both.
    const groups = listGroups(layout);
    const dup = dupLabels(layout, groups, locale);
    const vnums = groups.flatMap(g => g.clusters.flatMap(c => c.vnums));
    const out = vnums.map(v => {
      const r = layout.rooms[v];
      const p = layout.placed[v];
      const name = nameFor(r, locale) || mt.unnamedRoom;
      const shownName = dup[v] ? `${name} ${dup[v]}` : name;
      const path = routes[v];
      const steps = path ? path.length : null;
      const route = path && path.length ? pathToSpeedwalk(path) : '';
      const sector = r.flags.includes('indoors') ? 'inside' : r.sector;
      const detail = () => {
        // What the List view shows too: the floor (its layer heading) and the void mark.
        const where = [sectorLabel(sector)];
        if (r.flags.includes('no_recall')) where.push(mt.noRecall);
        if (p) where.push(`${mt.layer} z ${zLabel(p.z)}`);
        if (p && p.isVoid) where.push(mt.voidShort);
        const lines = [shownName, where.join(', ')];
        lines.push(exitsPhrase(r.exits));
        if (route) lines.push(tr('rooms.route', stepsText(steps), route));
        return lines.join('\n');
      };
      return {
        key: String(v),
        label: steps != null ? `${shownName}, ${stepsText(steps)}` : shownName,
        words: LOCALES.map(l => nameFor(r, l)).filter(Boolean),
        detail,
        vnum: v,
        steps,
        route,
        name: shownName,
      };
    });
    const key = gen + ':' + layout.meta.file;
    if (order.current.key !== key) {
      // Nearest first; rooms with no way there after them, by name.
      const sorted = out
        .slice()
        .sort(
          (a, b) =>
            (a.steps == null ? 1 : 0) - (b.steps == null ? 1 : 0) ||
            (a.steps || 0) - (b.steps || 0) ||
            a.name.localeCompare(b.name)
        );
      const rank = {};
      sorted.forEach((row, i) => {
        rank[row.key] = i;
      });
      order.current = { key, rank };
    }
    const rank = order.current.rank;
    return out.sort((a, b) => (rank[a.key] ?? 1e9) - (rank[b.key] ?? 1e9));
  }, [ready, layout, currentVnum, locale, gen]);

  const actions = [
    {
      id: 'walk',
      key: 'w',
      label: t('pf.walk'),
      when: r => !!r.route,
      run: r => {
        close();
        later(() => run(r.route));
      },
    },
    {
      id: 'route',
      key: 'r',
      label: t('pf.route'),
      when: r => !!r.route,
      run: r => {
        close();
        later(() => putInInput('run ' + r.route));
      },
    },
  ];

  // Before login there is no area; a missing graph and a failed download are told apart.
  let emptyText;
  if (!location.area) emptyText = t('rooms.noarea');
  else if (status === 'missing') emptyText = t('rooms.nomap');
  else if (status === 'error') emptyText = t('pf.offline');

  return (
    <Sheet id="rooms" open={open} onClose={close} title={t('rooms.title')} initialFocus={search}>
      <FindView
        key={gen}
        rows={rows}
        actions={actions}
        searchLabel={t('rooms.search')}
        query={arg}
        loading={open && !!location.area && (status === 'idle' || status === 'loading')}
        emptyText={emptyText}
        searchRef={search}
        selectKey={currentVnum != null ? String(currentVnum) : undefined}
      />
    </Sheet>
  );
}
