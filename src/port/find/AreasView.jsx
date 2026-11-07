/* Areas of the world: every area with its levels, danger and the route from
 * the Market Square of Midgaard. The desktop client's area list (Ctrl+E). */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import Sheet from '../Sheet';
import FindView from '../FindView';
import { loadData, loadIndex } from '../sitedata';
import { runFromSquare, putInInput } from '../walk';
import { lang } from '../game';
import { t } from '../../i18n';
import { openWidgetHelp } from '../../components/helpSheet/HelpSheet';
import { parseAreas, areaHelpMap, helpFor, DANGER } from './areadata';
import { tr, useOpener, later, MAX_LEVEL } from './common';

const rank = d => DANGER.indexOf(d);

export function areaLabel(a) {
  const parts = [a.name];
  if (a.max) parts.push(tr('areas.levels', a.min, a.max));
  if (a.danger) parts.push(t('areas.danger.' + a.danger));
  if (a.steps) parts.push(a.steps === 1 ? tr('areas.step') : tr('areas.steps', a.steps));
  return parts.join(', ');
}

function areaDetail(a) {
  const lines = [areaLabel(a)];
  if (a.route) {
    lines.push(tr('areas.route', a.steps, a.route));
    if (a.note) lines.push(tr('areas.note', a.note));
  } else if (a.note) lines.push(tr('areas.way', a.note));
  else lines.push(t('areas.noroute'));
  return lines.join('\n');
}

/* The areas in the game's language, each with its help article id. Shared by
 * the item search, which walks to an item's zone. */
export function useAreas(open) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || data) return undefined;
    let gone = false;
    setFailed(false);
    Promise.all([loadData('maps-index.json'), loadIndex().catch(() => [])])
      .then(([raw, index]) => !gone && setData({ raw, help: areaHelpMap(index) }))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, [open, data]);
  const l = lang();
  const areas = useMemo(
    () => (data ? parseAreas(data.raw, l).map(a => ({ ...a, helpId: helpFor(data.help, a.names) })) : null),
    [data, l]
  );
  return { areas, failed };
}

export default function AreasView() {
  const { open, arg, gen, close } = useOpener('areas');
  const shownLang = useSelector(state => state.prompt && state.prompt.lang); // labels follow it
  const { areas, failed } = useAreas(open);
  const [level, setLevel] = useState('');
  const [danger, setDanger] = useState('');
  const [sort, setSort] = useState('name');
  const search = useRef(null);

  const rows = useMemo(() => {
    if (!areas) return [];
    const n = parseInt(level, 10);
    let shown = areas.filter(a => {
      if (n && !(a.max && a.min <= n && n <= a.max)) return false;
      if (danger && !(a.danger && rank(a.danger) <= rank(danger))) return false;
      return true;
    });
    const byName = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    const noLevels = a => (a.max ? 0 : 1);
    shown = shown.slice();
    if (sort === 'level') shown.sort((a, b) => noLevels(a) - noLevels(b) || a.min - b.min || a.max - b.max || byName(a, b));
    else if (sort === 'levelhigh')
      shown.sort((a, b) => noLevels(a) - noLevels(b) || b.min - a.min || b.max - a.max || byName(a, b));
    else if (sort === 'near')
      shown.sort((a, b) => (a.route ? 0 : 1) - (b.route ? 0 : 1) || (a.steps || 0) - (b.steps || 0) || byName(a, b));
    else shown.sort(byName);
    return shown.map(a => ({
      key: a.key,
      label: areaLabel(a),
      words: [a.name, ...a.names],
      detail: () => areaDetail(a),
      area: a,
    }));
  }, [areas, level, danger, sort, shownLang]);

  const levels = [{ value: '', label: t('areas.anylevel') }];
  for (let i = 1; i <= MAX_LEVEL; i++) levels.push({ value: String(i), label: tr('areas.level', i) });

  const filters = [
    { id: 'level', label: t('areas.f.level'), value: level, onChange: setLevel, options: levels },
    {
      id: 'danger',
      label: t('areas.f.danger'),
      value: danger,
      onChange: setDanger,
      options: [
        { value: '', label: t('areas.anydanger') },
        { value: 'safe', label: t('areas.upto.safe') },
        { value: 'easy', label: t('areas.upto.easy') },
        { value: 'hard', label: t('areas.upto.hard') },
      ],
    },
    {
      id: 'sort',
      label: t('areas.sort'),
      value: sort,
      onChange: setSort,
      options: [
        { value: 'name', label: t('areas.byname') },
        { value: 'level', label: t('areas.bylevel') },
        { value: 'levelhigh', label: t('areas.bylevelhigh') },
        { value: 'near', label: t('areas.bynear') },
      ],
    },
  ];

  const actions = [
    {
      id: 'walk',
      key: 'w',
      label: t('pf.walk'),
      when: r => !!r.area.route,
      run: r => {
        close();
        later(() => runFromSquare(r.area.route));
      },
    },
    {
      id: 'route',
      key: 'r',
      label: t('pf.route'),
      when: r => !!r.area.route,
      run: r => {
        close();
        later(() => putInInput('run ' + r.area.route));
      },
    },
    {
      id: 'help',
      key: 'h',
      label: t('pf.help'),
      when: r => r.area.helpId != null,
      run: r => {
        close();
        later(() => openWidgetHelp({ kind: 'article', id: r.area.helpId }));
      },
    },
  ];

  return (
    <Sheet id="areas" open={open} onClose={close} title={t('areas.title')} initialFocus={search}>
      <FindView
        key={gen}
        rows={rows}
        filters={filters}
        actions={actions}
        searchLabel={t('areas.search')}
        query={arg}
        loading={!areas && !failed}
        emptyText={failed ? t('pf.offline') : undefined}
        searchRef={search}
      />
    </Sheet>
  );
}
