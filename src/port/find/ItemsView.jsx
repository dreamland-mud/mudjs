/* Item search: every weapon, armor, magic item and pet of the website's item
 * database, found by name in any language, magic items by their spells too.
 * The desktop client's item search (Ctrl+K). */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import Sheet from '../Sheet';
import FindView from '../FindView';
import { loadData } from '../sitedata';
import { runFromSquare } from '../walk';
import { lang } from '../game';
import { t } from '../../i18n';
import { openWidgetHelp } from '../../components/helpSheet/HelpSheet';
import { areaByName, DANGER } from './areadata';
import { useAreas } from './AreasView';
import {
  KINDS,
  FILES,
  TYPE_FIELD,
  STATS,
  ALIGNS,
  num,
  statGain,
  overallScore,
  hasMinus,
  noIdent,
  usableBy,
  limited,
  localField,
  magicSpells,
  allItems,
  statText,
} from './itemdata';
import { tr, word, useOpener, later, MAX_LEVEL } from './common';

const WORN = ['weapon', 'armor'];
const sentence = s => (s ? s[0].toUpperCase() + s.slice(1) + '.' : '');


const typeWord = (kind, it) => (TYPE_FIELD[kind] ? word(TYPE_FIELD[kind][1], it[TYPE_FIELD[kind][0]]) : t('items.pet'));

function itemLabel(kind, it, L, stat) {
  const level = num(it.level);
  const parts = [localField(it, 'name', L)];
  // A pet below level zero grows with its master.
  parts.push(kind === 'pet' && level < 0 ? t('items.grows') : tr('items.lvl', level || 0));
  parts.push(typeWord(kind, it));
  if (kind === 'weapon' && num(it.ave)) parts.push(tr('items.ave', num(it.ave)));
  if (stat && stat !== 'overall') {
    const v = num(it[stat]);
    const w = STATS.find(s => s[0] === stat)[1];
    parts.push(t('items.stat.' + w) + ' ' + (v > 0 ? '+' : '') + v);
  }
  return parts.filter(Boolean).join(', ');
}

function itemDetail(kind, it, L, zone, label) {
  const lines = [label];
  if (WORN.includes(kind)) {
    if (noIdent(it)) lines.push(t('items.noident'));
    else {
      const stats = statText(it);
      if (stats) lines.push(sentence(stats));
      else if (kind === 'armor') lines.push(sentence(t('items.nobonus')));
    }
  }
  if (kind === 'weapon') {
    const d1 = num(it.d1);
    const d2 = num(it.d2);
    if (d1 && d2) lines.push(tr('items.dice', d1, d2));
    const special = String(localField(it, 'special', L)).trim();
    if (special && special !== '-') lines.push(tr('items.special', special));
  }
  if (kind === 'armor') {
    const ac = ['ac_pierce', 'ac_bash', 'ac_slash', 'ac_exotic'].map(k => num(it[k]) || 0);
    if (ac.some(Boolean)) lines.push(tr('items.ac', ...ac));
    if (num(it.random)) lines.push(t('items.random'));
  }
  if (kind === 'magic') {
    const spells = magicSpells(it, L);
    if (spells.length) lines.push(tr('items.spells', spells.join(', ')));
    if (num(it.spellLevel)) lines.push(tr('items.slevel', num(it.spellLevel)));
    if (num(it.charges)) lines.push(sentence(tr('items.charges', num(it.charges))));
  }
  if (kind === 'pet') {
    [
      ['aff', 'items.pet.aff'],
      ['off', 'items.pet.off'],
      ['act', 'items.pet.act'],
    ].forEach(([f, key]) => {
      const v = String(it[f] || '').trim();
      if (v && v !== '-') lines.push(tr(key, v));
    });
  }
  const area = localField(it, 'area', L);
  const where = localField(it, 'where', L);
  if (area && where) lines.push(tr('items.where', area, where));
  else if (area) lines.push(tr('items.area', area));
  if (zone) {
    const z = [];
    if (zone.max) z.push(tr('areas.levels', zone.min, zone.max));
    if (zone.danger) z.push(t('areas.danger.' + zone.danger));
    if (z.length) lines.push(tr('items.zone', z.join(', ')));
  }
  const al = String(it.align || '').trim();
  if (WORN.includes(kind) && al && al !== '-')
    lines.push(tr('items.only', ALIGNS.filter(a => usableBy(al, a)).map(a => t('items.align.' + a)).join(', ')));
  if (limited(it)) lines.push(tr('items.limited', num(it.limit)));
  if (kind !== 'pet' && it.vnum != null) lines.push(tr('items.vnum', it.vnum));
  return lines.join('\n');
}

function useItems(open) {
  const [dbs, setDbs] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open || dbs) return undefined;
    let gone = false;
    setFailed(false);
    Promise.all(KINDS.map(k => loadData(FILES[k])))
      .then(list => {
        if (gone) return;
        const out = {};
        KINDS.forEach((k, i) => (out[k] = list[i]));
        setDbs(out);
      })
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, [open, dbs]);
  return { dbs, failed };
}

const rankOf = d => DANGER.indexOf(d);

export default function ItemsView() {
  const { open, arg, gen, close } = useOpener('items');
  const shownLang = useSelector(state => state.prompt && state.prompt.lang);
  const { dbs, failed } = useItems(open);
  const { areas, failed: noAreas } = useAreas(open);
  const [kind, setKindValue] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('0');
  const [to, setTo] = useState(String(MAX_LEVEL));
  const [stat, setStat] = useState('');
  const [align, setAlign] = useState('');
  const [hide, setHide] = useState('');
  const [zoneCap, setZoneCap] = useState('');
  const [spell, setSpell] = useState('');
  const search = useRef(null);
  const L = lang();

  const setKind = v => {
    setKindValue(v);
    setType('');
  };

  // Every item once, with the zone it comes from and its search words.
  const items = useMemo(() => {
    // Wait for the zones too, so the list does not reset under the cursor.
    if (!dbs || (!areas && !noAreas)) return null;
    const zones = areas ? areaByName(areas) : new Map();
    return allItems(dbs, L).map(({ kind: k, it }) => {
      const zone = [it.areaEn, it.area, it.areaUa]
        .map(n => zones.get(String(n || '').toLowerCase()))
        .find(Boolean);
      const words = [it.nameEn, it.name, it.nameUa].map(x => String(x || ''));
      if (k === 'magic') words.push(String(it.spells || ''), String(it.ruspells || ''), typeWord(k, it));
      if (k === 'pet') words.push(t('items.pet'));
      return { kind: k, it, zone, words, spells: k === 'magic' ? magicSpells(it, L) : [] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbs, areas, noAreas, L, shownLang]);

  const spellList = useMemo(() => {
    const set = new Set();
    (items || []).forEach(x => x.spells.forEach(s => set.add(s)));
    return Array.from(set).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }, [items]);

  const typeList = useMemo(() => {
    if (!dbs || !TYPE_FIELD[kind]) return [];
    const [field, prefix] = TYPE_FIELD[kind];
    const values = Array.from(new Set(dbs[kind].map(it => it && it[field]).filter(Boolean).map(String)));
    return values.map(v => ({ value: v, label: word(prefix, v) })).sort((a, b) => a.label.localeCompare(b.label));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbs, kind, shownLang]);

  const rows = useMemo(() => {
    if (!items) return [];
    const low = parseInt(from, 10) || 0;
    const high = parseInt(to, 10);
    const cap = zoneCap ? rankOf(zoneCap) : null;
    const out = items.filter(x => {
      const { kind: k, it } = x;
      if (kind && k !== kind) return false;
      if (type && String(it[(TYPE_FIELD[k] || [])[0]] || '') !== type) return false;
      const lv = num(it.level);
      if (lv != null && lv >= 0 && (lv < low || lv > high)) return false;
      if (stat && !WORN.includes(k)) return false;
      if (stat === 'overall' && overallScore(it) <= 0) return false;
      if (stat && stat !== 'overall' && statGain(it, stat) <= 0) return false;
      if (align && WORN.includes(k) && !usableBy(it.align, align)) return false;
      if ((hide === 'minus' || hide === 'both') && hasMinus(it)) return false;
      if ((hide === 'limit' || hide === 'both') && limited(it)) return false;
      if (cap != null && !(x.zone && x.zone.danger && rankOf(x.zone.danger) <= cap)) return false;
      if (spell && !x.spells.includes(spell)) return false;
      return true;
    });
    if (stat === 'overall') out.sort((a, b) => overallScore(b.it) - overallScore(a.it));
    else if (stat) out.sort((a, b) => statGain(b.it, stat) - statGain(a.it, stat));
    const seen = new Map(); // vnum can be missing or repeat: keys must stay unique
    return out.map(x => {
      const label = itemLabel(x.kind, x.it, L, stat);
      const base = x.kind + (x.it.vnum != null ? x.it.vnum : '-' + label);
      const n = seen.get(base) || 0;
      seen.set(base, n + 1);
      return {
        key: n ? base + '#' + n : base,
        label,
        words: x.words,
        detail: () => itemDetail(x.kind, x.it, L, x.zone, label),
        item: x,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, kind, type, from, to, stat, align, hide, zoneCap, spell]);

  const levelOptions = [];
  for (let i = 0; i <= MAX_LEVEL; i++) levelOptions.push({ value: String(i), label: tr('items.level', i) });

  const filters = [
    {
      id: 'kind',
      label: t('items.f.kind'),
      value: kind,
      onChange: setKind,
      options: [
        { value: '', label: t('items.anykind') },
        { value: 'weapon', label: t('items.weapons') },
        { value: 'armor', label: t('items.armor') },
        { value: 'magic', label: t('items.magic') },
        { value: 'pet', label: t('items.pets') },
      ],
    },
    {
      id: 'type',
      label: t('items.f.type'),
      value: type,
      onChange: setType,
      options: [{ value: '', label: t('items.anytype') }, ...typeList],
    },
    { id: 'from', label: t('items.f.from'), value: from, onChange: setFrom, options: levelOptions },
    { id: 'to', label: t('items.f.to'), value: to, onChange: setTo, options: levelOptions },
    {
      id: 'stat',
      label: t('items.f.stat'),
      value: stat,
      onChange: setStat,
      options: [
        { value: '', label: t('items.anystat') },
        { value: 'overall', label: t('items.overall') },
        ...STATS.map(([k, w]) => ({ value: k, label: t('items.stat.' + w) })),
      ],
    },
    {
      id: 'align',
      label: t('items.f.align'),
      value: align,
      onChange: setAlign,
      options: [{ value: '', label: t('items.align.any') }, ...ALIGNS.map(a => ({ value: a, label: t('items.align.' + a) }))],
    },
    {
      id: 'hide',
      label: t('items.f.hide'),
      value: hide,
      onChange: setHide,
      options: ['none', 'minus', 'limit', 'both'].map(h => ({ value: h === 'none' ? '' : h, label: t('items.hide.' + h) })),
    },
    {
      id: 'zone',
      label: t('items.f.zone'),
      value: zoneCap,
      onChange: setZoneCap,
      options: [
        { value: '', label: t('items.zone.any') },
        { value: 'hard', label: t('items.zone.nodeadly') },
        { value: 'easy', label: t('items.zone.easy') },
      ],
    },
    {
      id: 'spell',
      label: t('items.f.spell'),
      value: spell,
      onChange: setSpell,
      options: [{ value: '', label: t('items.anyspell') }, ...spellList.map(s => ({ value: s, label: s }))],
    },
  ];

  const actions = [
    {
      id: 'walk',
      key: 'w',
      label: t('pf.zonewalk'),
      when: r => !!(r.item.zone && r.item.zone.route),
      run: r => {
        close();
        later(() => runFromSquare(r.item.zone.route));
      },
    },
    {
      id: 'help',
      key: 'h',
      label: t('pf.zonehelp'),
      when: r => !!(r.item.zone && r.item.zone.helpId != null),
      run: r => {
        close();
        later(() => openWidgetHelp({ kind: 'article', id: r.item.zone.helpId }));
      },
    },
  ];

  return (
    <Sheet id="items" open={open} onClose={close} title={t('items.title')} wide initialFocus={search}>
      <FindView
        key={gen}
        rows={rows}
        filters={filters}
        actions={actions}
        searchLabel={t('items.search')}
        query={arg}
        loading={!items && !failed}
        emptyText={failed ? t('pf.offline') : t('items.none')}
        searchRef={search}
      />
    </Sheet>
  );
}
