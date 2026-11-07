import { t } from '../../i18n';
/* The website's item database (db_weapon, db_armor, db_magic, db_pets) as
 * plain functions. Ported from the desktop client's sitedata.py. */

export const KINDS = ['weapon', 'armor', 'magic', 'pet'];
export const FILES = { weapon: 'db_weapon.json', armor: 'db_armor.json', magic: 'db_magic.json', pet: 'db_pets.json' };
// The field that tells an item's type, and the string prefix for its word.
export const TYPE_FIELD = { weapon: ['wclass', 'items.wc.'], armor: ['wearloc', 'items.wear.'], magic: ['itemtype', 'items.it.'] };

// [field, word]: the order stats are read in.
export const STATS = [
  ['hr', 'hit'],
  ['dr', 'dam'],
  ['hp', 'hp'],
  ['mana', 'mana'],
  ['move', 'mv'],
  ['saves', 'saves'],
  ['stat_str', 'str'],
  ['stat_int', 'int'],
  ['stat_wis', 'wis'],
  ['stat_dex', 'dex'],
  ['stat_con', 'con'],
  ['stat_cha', 'cha'],
];

/* Numbers come as ints or strings ("+3" too); "-" means none. */
export function num(v) {
  if (typeof v === 'boolean' || v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  const t = String(v).trim();
  return /^[+-]?\d+$/.test(t) ? parseInt(t, 10) : null;
}

/* How much an item helps with one stat; saves count the other way. */
export function statGain(it, key) {
  const v = num(it[key]) || 0;
  return key === 'saves' ? -v : v;
}

/* One number to rank by "Overall": hitroll and damroll count most, then the
 * stats and saves, health and mana; a weapon's average damage too. */
export function overallScore(it) {
  const g = k => statGain(it, k);
  const stats = ['stat_str', 'stat_int', 'stat_wis', 'stat_dex', 'stat_con', 'stat_cha'].reduce((s, k) => s + g(k), 0);
  return (
    2 * g('hr') + 2 * g('dr') + 1.5 * stats + 1.5 * g('saves') + g('hp') / 10 + g('mana') / 20 + g('move') / 40 +
    (num(it.ave) || 0) / 2
  );
}

export const hasMinus = it => STATS.some(([k]) => statGain(it, k) < 0);

/* Stats the database hides: the item cannot be identified. */
export const noIdent = it => it.hr === '-' && it.align === '-';

export const ALIGNS = ['good', 'neutral', 'evil'];

// Codes for each alignment in the item database ("GN") and in free text.
export const ALIGN_CODES = {
  good: ['g', 'good', 'добр'],
  neutral: ['n', 'neutral', 'нейтр'],
  evil: ['e', 'evil', 'зл'],
};

/* Who may use an item: "GN" is good and neutral; empty or "-" is anyone. */
export function usableBy(field, align) {
  const f = String(field || '')
    .trim()
    .toLowerCase();
  if (!f || f === '-') return true;
  return (ALIGN_CODES[align] || []).some(code => f.includes(code));
}

export const limited = it => (num(it.limit) || 0) > 0;

const SUFFIX = { en: 'En', ua: 'Ua', ru: '' };

export function localField(it, field, lang) {
  return it[field + (SUFFIX[lang] || '')] || it[field] || '';
}

/* A magic item's spells: English for English players, else the Russian
 * names (the database has no Ukrainian ones). */
export function magicSpells(it, lang) {
  const text = String((lang === 'en' ? it.spells : it.ruspells) || it.spells || it.ruspells || '');
  const out = [];
  text.replace(/'([^']+)'|(\S+)/g, (m, a, b) => {
    const s = a || b;
    if (s !== '-') out.push(s);
    return m;
  });
  return out;
}

/* Every item of the four files as { kind, it }, by name then highest level. */
export function allItems(dbs, lang) {
  const out = [];
  KINDS.forEach(kind => (Array.isArray(dbs[kind]) ? dbs[kind] : []).forEach(it => it && out.push({ kind, it })));
  const name = x => String(localField(x.it, 'name', lang)).toLowerCase();
  out.sort((a, b) => name(a).localeCompare(name(b)) || (num(b.it.level) || 0) - (num(a.it.level) || 0));
  return out;
}

/* "hitroll +1, damroll +2, str +1" from an item record, in the reader's
 * language (the items.stat.* words). The item window and the guide both use it. */
export function statText(it) {
  return STATS.map(([k, w]) => {
    const v = num(it[k]);
    return v ? t('items.stat.' + w) + ' ' + (v > 0 ? '+' : '') + v : '';
  })
    .filter(Boolean)
    .join(', ');
}
