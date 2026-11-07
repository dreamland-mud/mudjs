/* Who the guide is for: level, class and alignment of the character in play,
 * and the guide's options, kept per character in localStorage (mudjs.guide).
 *
 * The server tells level and class in its account_chars reply; the guide
 * asks for it each time it opens. Without an account the character is known
 * by the name the game gives in config_state, so each keeps its own options. */
import $ from 'jquery';
import { rpccmd } from '../../websock.js';
import { ALIGNS } from './site.js';

const KEY = 'mudjs.guide';
const subscribers = new Set();
let current = ''; // the character's name in lower case, '' while unknown

function readAll() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    return {};
  }
}

function writeAll(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch (e) {
    // private mode or full storage: the options last until the page closes
  }
}

const memory = readAll();
if (!memory.chars || typeof memory.chars !== 'object') memory.chars = {};
if (typeof memory.last === 'string') current = memory.last;

function record() {
  const r = memory.chars[current] || {};
  return { ctx: Object.assign({ level: 1, class: '', align: '' }, r.ctx), opts: Object.assign({}, r.opts) };
}

export function load() {
  return record();
}

// The character in the world, by name, also without an account.
$(document).ready(() =>
  $('#rpc-events').on('rpc-config_state.guide', (e, b) => {
    const who = b && b.playing && b.who ? String(b.who).toLowerCase() : '';
    if (who && who !== current) {
      current = who;
      subscribers.forEach(fn => fn(record()));
    }
  })
);

export function save(ctx, opts) {
  memory.chars[current] = { ctx, opts };
  memory.last = current;
  writeAll(memory);
}

export function onCharacter(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function askServer() {
  rpccmd('account_chars');
}

/* account_chars: {current, chars: [{name, level, class: {en, ru, ua}}]}. */
function onChars(e, data) {
  if (!data || typeof data !== 'object') return;
  const name = String(data.current || '').toLowerCase();
  const ch = (data.chars || []).find(c => c && typeof c === 'object' && String(c.name || '').toLowerCase() === name);
  if (!name || !ch) return;
  current = name;
  const r = record();
  const lv = parseInt(ch.level, 10);
  if (lv > 0) r.ctx.level = lv;
  let cls = ch.class;
  if (cls && typeof cls === 'object') cls = cls.en || '';
  if (cls) r.ctx.class = String(cls).toLowerCase();
  if (ALIGNS.includes(ch.align) && ch.align) r.ctx.align = ch.align;
  save(r.ctx, r.opts);
  subscribers.forEach(fn => fn(r));
}

$(document).ready(() => {
  $('#rpc-events').on('rpc-account_chars', onChars);
});
