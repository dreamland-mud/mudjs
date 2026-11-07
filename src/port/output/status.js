/* The status panels as sentences, from the prompt frame: effects, quests,
 * group, stats, time and weather, location, who is online. */
import { t } from '../../i18n';
import { tf } from './speak';

const AFFECT_ORDER = ['mal', 'pro', 'det', 'trv', 'enh', 'cln', 'cd'];
const STATS = ['str', 'int', 'wis', 'dex', 'con', 'cha'];
const EXIT_LETTERS = [
  ['n', 'north'],
  ['e', 'east'],
  ['s', 'south'],
  ['w', 'west'],
  ['u', 'up'],
  ['d', 'down'],
];

/* Without the game's colour codes ({x, {R ...). */
export const clean = v => String(v === undefined || v === null ? '' : v).replace(/\{./g, '').trim();

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const present = v =>
  v !== undefined && v !== null && v !== '' && v !== 'none' && !(Array.isArray(v) && !v.length) && !(isObj(v) && !Object.keys(v).length);

function sentence(parts) {
  const kept = parts.filter(x => x && x.replace(/[ .]/g, '')).map(x => x.replace(/[ .]+$/, ''));
  return kept.length ? kept.join('. ') + '.' : '';
}

/* Hours left, with the Russian and Ukrainian plural forms. */
export function hours(d, lang) {
  if (d === undefined || d === null || d === '') return '';
  d = Number(d);
  if (isNaN(d)) return '';
  if (d < 0) return t('out.st.perm');
  if (d === 0) return t('out.st.soon');
  const unit = d % 10;
  const tens = d % 100;
  if (lang === 'en') return d + ' ' + t(d === 1 ? 'out.st.h1' : 'out.st.h5');
  if (unit === 1 && tens !== 11) return d + ' ' + t('out.st.h1');
  if (unit >= 2 && unit <= 4 && !(tens >= 12 && tens <= 14)) return d + ' ' + t('out.st.h2');
  return d + ' ' + t('out.st.h5');
}

export function affects(p, lang) {
  const items = [];
  AFFECT_ORDER.forEach(key => {
    const block = p[key];
    if (!Array.isArray(block)) return;
    block.forEach(aff => {
      if (isObj(aff) && aff.n) items.push({ key, aff });
    });
  });
  const rank = ({ aff }) => (aff.d === undefined || aff.d === null || aff.d < 0 ? Infinity : Number(aff.d));
  // Harmful ones first, then by time left: the soonest to end first.
  items.sort((a, b) => (a.key !== 'mal') - (b.key !== 'mal') || rank(a) - rank(b));
  if (!items.length) return t('out.st.noaff');
  const out = items.map(({ key, aff }) => {
    const bits = [clean(aff.f || aff.n)];
    if (key === 'mal') bits.push(t('out.st.malad'));
    if (key === 'cd') bits.push(t('out.st.cooldown'));
    const left = hours(aff.d, lang);
    if (left) bits.push(left);
    return bits.join(', ');
  });
  return tf('out.st.affects', out.join('; '));
}

export function quests(p) {
  const out = [];
  if (present(p.q) && isObj(p.q)) out.push(tf('out.st.questor', clean(p.q.i), clean(p.q.t)));
  if (present(p.aq) && isObj(p.aq)) out.push(clean(p.aq.t) + ': ' + clean(p.aq.i));
  return out.length ? out.join(' ') : t('out.st.noquest');
}

export function group(p) {
  const g = p.group;
  if (!present(g) || !isObj(g)) return t('out.st.nogroup');
  const members = (g.leader ? [g.leader] : []).concat(g.pc || [], g.npc || []);
  const rows = members.filter(isObj).map(m => {
    let text = tf('out.st.member', clean(m.sees), m.level ?? '', m.health ?? '');
    if (m.tnl !== undefined && m.tnl !== null && m.tnl !== '') text += ', ' + tf('out.st.tnl', m.tnl);
    return text;
  });
  if (!rows.length) return t('out.st.nogroup');
  return tf('out.st.group', clean(g.ln)) + ' ' + rows.join('; ');
}

export function stats(p) {
  const out = [];
  if (present(p.p1) && isObj(p.p1)) {
    const perm = p.p1.ps || [];
    const cur = p.p1.cs || [];
    const parts = [];
    STATS.forEach((key, i) => {
      if (i >= cur.length) return;
      let value = String(cur[i]);
      if (i < perm.length && perm[i] !== cur[i]) value += ' (' + perm[i] + ')';
      parts.push(t('out.st.' + key) + ' ' + value);
    });
    out.push(parts.join(', '));
  }
  if (present(p.p2) && isObj(p.p2)) out.push(tf('out.st.combat', p.p2.h ?? '', p.p2.d ?? '', p.p2.a ?? '', p.p2.s ?? ''));
  return sentence(out) || t('out.st.nostats');
}

export function world(p) {
  const out = [];
  if (present(p.time) && isObj(p.time)) {
    let text = clean(p.time.h) + ' ' + clean(p.time.tod);
    if (p.time.l) text += ', ' + clean(p.time.l);
    out.push(text);
  }
  if (present(p.date) && isObj(p.date)) {
    let text = clean(p.date.d) + ' ' + clean(p.date.m);
    if (p.date.s) text += ', ' + clean(p.date.s);
    out.push(text);
  }
  if (present(p.w) && isObj(p.w) && p.w.m) out.push(clean(p.w.m));
  return sentence(out) || t('out.st.noworld');
}

export function location(p) {
  const out = [];
  if (present(p.room)) out.push(clean(p.room));
  if (present(p.zone)) out.push(clean(p.zone));
  if (present(p.exits) && isObj(p.exits)) {
    const visible = String(p.exits.e || '').toLowerCase();
    // exits.h: the exits with a closed door (plug-ins/web/impl.cpp).
    const closedDoors = String(p.exits.h || '').toLowerCase();
    const words = EXIT_LETTERS.filter(([l]) => visible.includes(l)).map(([, n]) => t('out.dir.' + n));
    const closed = EXIT_LETTERS.filter(([l]) => closedDoors.includes(l)).map(([, n]) => t('out.dir.' + n));
    let text = words.length ? tf('out.st.exits', words.join(', ')) : t('out.st.noexits');
    if (closed.length) text += ' ' + tf('out.st.closed', closed.join(', '));
    out.push(text);
  }
  return sentence(out) || t('out.st.noplace');
}

export function who(p) {
  const w = p.who;
  if (!present(w) || !isObj(w)) return t('out.st.nowho');
  const names = (w.p || []).filter(x => isObj(x) && x.n).map(x => clean(x.n));
  // who sends p (the players shown) and t (all online); "N of M" only when
  // the game also says how many are visible.
  const total = w.t ?? names.length;
  const head = w.v != null ? tf('out.st.who', w.v, total) : tf('out.st.whocount', total);
  return names.length ? head + ' ' + names.join(', ') : head;
}

export function fightCommands(p) {
  return Array.isArray(p.fcmd) ? p.fcmd.map(String).filter(Boolean) : [];
}

export const PANELS = [
  ['affects', affects],
  ['quests', quests],
  ['group', group],
  ['stats', stats],
  ['world', world],
  ['location', location],
  ['who', who],
];

export function everything(p, lang) {
  return PANELS.map(([key, fn]) => t('out.st.title.' + key) + '\n' + fn(p, lang)).join('\n\n');
}

export function statusLine(p) {
  if (p.hit === undefined) return t('out.status.none');
  let s = tf('out.status.line', p.hit, p.max_hit, p.mana, p.max_mana, p.move, p.max_move);
  if (p.fight > 0 || p.fight === true) s += ' ' + t('out.status.fighting');
  return s;
}
