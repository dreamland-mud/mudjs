/* Text and filters for the game guide: rows and details of zone quests,
 * items, class skills, gods and races. A port of the desktop client's
 * guide.py. Plain functions with tr(key, ...args) passed in, so node can
 * check them without a page. */
import { ALIGNS, num, usableBy, alignOk, parseStats, STAT_STEMS } from './site.js';
import { word } from '../find/common';
import { statText } from '../find/itemdata';

export function levelsText(tr, low, high) {
  if (low && high) return tr('guide.levels', low, high);
  if (low) return tr('guide.levelfrom', low);
  return '';
}

export function questRow(tr, q) {
  const parts = [q.zone + ': ' + q.text];
  const lv = levelsText(tr, q.low, q.high);
  if (lv) parts.push(lv);
  if (q.align) parts.push(q.align);
  if (q.often) parts.push(q.often);
  return parts.join(', ');
}

export function questDetail(tr, site, q) {
  const L = site.L;
  const out = [q.text];
  const lv = levelsText(tr, q.low, q.high);
  if (lv) out.push(lv);
  for (const key of ['align', 'often', 'requires']) if (q[key]) out.push(L[key] + ': ' + q[key]);
  out.push('');
  out.push(q.zone);
  for (const key of ['levels', 'danger', 'route']) if (q[key]) out.push(L[key] + ': ' + q[key]);
  return out.join('\n');
}

// Zone danger as the zone help words it, in the three languages. Deadly is
// checked first: the Ukrainian word for deadly contains the one for safe.
const DANGER_STEMS = [
  [3, ['deadly', 'смертель']],
  [2, ['tough', 'сложн', 'важк']],
  [1, ['easy', 'лёгк', 'легк']],
  [0, ['safe', 'безопас', 'безпеч']],
];

/* 0 safe, 1 easy, 2 tough, 3 deadly, null when the help gives no danger. */
export function dangerRank(text) {
  const t = String(text || '').toLowerCase();
  const hit = DANGER_STEMS.find(([, stems]) => stems.some(s => t.includes(s)));
  return hit ? hit[0] : null;
}

/* The first level of a zone's range such as "10-25", or null. */
export function zoneStart(levels) {
  const head = String(levels || '').split('-')[0].trim();
  return /^\d+$/.test(head) ? parseInt(head, 10) : null;
}

/* The zone starts at most gap levels above level, and is no more dangerous
 * than danger (null: any). Zones the help says nothing about stay. */
export function questZoneOk(q, level, gap, danger) {
  const start = zoneStart(q.levels);
  if (level && gap != null && start != null && start > level + gap) return false;
  const rank = dangerRank(q.danger);
  return danger == null || rank == null || rank <= danger;
}

export function questFits(q, level, align) {
  if (level && q.low && level < q.low) return false;
  if (level && q.high && level > q.high) return false;
  return alignOk(q.align, align);
}

export function itemRow(tr, site, it, kind) {
  const parts = [site.itemName(it), tr('guide.lvl', num(it.level) || 0)];
  if (kind === 'weapon') {
    if (it.wclass) parts.push(word('items.wc.', it.wclass));
    const ave = num(it.ave);
    if (ave) parts.push(tr('guide.ave', ave));
  } else if (it.wearloc) parts.push(word('items.wear.', it.wearloc));
  const stats = statText(it);
  if (stats) parts.push(stats);
  else if (kind !== 'weapon') parts.push(tr('guide.nobonus'));
  const [area] = site.itemPlace(it);
  if (area) parts.push(area);
  return parts.join(', ');
}

export function itemDetail(tr, site, it, kind) {
  const out = [itemRow(tr, site, it, kind)];
  const d1 = num(it.d1);
  const d2 = num(it.d2);
  if (kind === 'weapon' && d1 && d2) out.push(tr('guide.dice', d1, d2));
  if (kind !== 'weapon') {
    const ac = ['pierce', 'bash', 'slash', 'exotic'].map(k => [k, num(it['ac_' + k])]).filter(([, v]) => v);
    if (ac.length) out.push(tr('guide.ac', ac.map(([k, v]) => tr('guide.ac.' + k) + ' ' + v).join(', ')));
  }
  const special = site.itemSpecial(it);
  if (special) out.push(tr('guide.special', special));
  if (num(it.random)) out.push(tr('guide.random'));
  out.push(...placeLines(tr, site, it));
  if (!['', '-'].includes(String(it.align || '').trim())) {
    out.push(tr('guide.only', ALIGNS.slice(1).filter(a => usableBy(it.align, a)).map(a => tr('guide.align.' + a)).join(', ')));
  }
  if ((num(it.limit) || 0) > 0) out.push(tr('guide.limited', num(it.limit)));
  out.push(tr('guide.vnum', it.vnum == null ? '' : it.vnum));
  return out.join('\n');
}

/* Where an item comes from, and the levels and danger of that zone. */
export function placeLines(tr, site, it) {
  const out = [];
  const [area, where] = site.itemPlace(it);
  if (area || where) out.push(where ? tr('guide.where', area, where) : area);
  const { levels, danger } = site.zoneInfo(area);
  if (levels || danger) out.push(tr('guide.zone', [levels, danger].filter(Boolean).join(', ')));
  return out;
}

export function skillRow(tr, sk, teacher, mine) {
  const key = mine && sk.level <= mine ? 'guide.s.done' : 'guide.s.row';
  let text = tr(key, sk.level, sk.name);
  if (teacher && teacher.group) text += ', ' + teacher.group;
  if (teacher && teacher.teacher) text += '. ' + teacher.teacher;
  return text;
}

export function infoDetail(site, rec, fields) {
  const out = [rec.name];
  for (const key of fields) if (rec[key]) out.push(site.L[key] + ': ' + rec[key]);
  const body = site.articleText(rec.id);
  if (body) out.push('', body);
  return out.join('\n');
}

/* {stat: highest value} for a race in a class, without rebirths. */
export function raceValues(rec, bonus) {
  const race = parseStats(rec.stats || '');
  const out = {};
  for (const [k] of STAT_STEMS) out[k] = 20 + (race[k] || 0) + ((bonus || {})[k] || 0);
  return out;
}
