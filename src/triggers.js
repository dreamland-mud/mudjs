import $ from 'jquery';
import { send, rpccmd } from './websock.js';
import { utf8ToB64, b64ToUtf8 } from './b64utf8.js';
import { playSound } from './sound.js';
import { expandAliases } from './aliases.js';
import { t } from './i18n.js';

// Player triggers: a pattern, and up to three things that happen when a line
// of game output matches it -- a highlight, a sound, commands.
//
// Two lists live on the server (comm/webtriggers.cpp): the character's own and
// the account's, shared by every character of the account. The server keeps
// each as an opaque base64 blob of this JSON and never reads it:
//   { v: 1, list: [ { id, pattern, regex, on, hl, sound, cmd, act } ] }
//     pattern  plain text with %1..%9 placeholders, or a regex when regex=true
//     hl       null | { mode: 'line' | 'match', color: '#rrggbb' }
//     sound    null | { name, V }          (a library name, see sound.js)
//     cmd      '' | 'command|command'      (%1..%9 substituted; the server
//                                            splits on |)
//     act      the pattern as typed in #action, for that command's own lists
// The character's list is checked first, then the account's; within a list,
// top to bottom.
//
// Matched: what the server sends through the terminal's 'output' path. The
// player's typed-command echo goes straight to 'output-html' and is never
// matched, so a trigger cannot answer the command it just sent. Client banners
// (connecting, disconnected) and help text also use 'output' and can match.
//
// Lists belong to one character. Any sign that the character may have changed
// -- a new socket (rpc-version) or a quit/login on the same socket
// (rpc-config_state) -- disarms everything and drops unsaved edits: losing one
// edit is cheaper than writing one character's list into another's file.
//
// Triggers made with the old browser-only #action live in localStorage.actions.
// The first time a server list arrives they move onto the account (or the
// character, when there is no account), so they keep firing for every
// character, as they did, and work on every device.

export const SCOPES = ['char', 'acct'];
export const MAX_PER_LIST = 200;
const SAVE_DELAY_MS = 1200;
const RETRY_MS = 1500;
// No answer to triggers_get in this long: the server has no triggers rpc.
const ANSWER_TIMEOUT_MS = 5000;
// Commands from triggers: at most this many in this window, then a pause.
const FLOOD_MAX = 10;
const FLOOD_WINDOW_MS = 3000;
const FLOOD_PAUSE_MS = 10000;
// A trigger that spends this long on one block of output is switched off for
// the session: a runaway regex must not freeze the game.
const SLOW_MS = 150;

const state = {
  known: false, // the server has answered for this character
  unsupported: false, // the server never answered: no triggers rpc there
  account: false,
  lists: { char: [], acct: [] },
  status: { char: 'idle', acct: 'idle' }, // idle | saving | error:<reason>
};
const dirty = { char: false, acct: false };
const timers = { char: null, acct: null };
const watchers = new Set();
const slow = new Set(); // ids switched off this session for being too slow
let asked = false;
let answerTimer = null;
let compiled = [];

function notify() {
  compiled = compileAll();
  watchers.forEach(fn => {
    try {
      fn(getTriggers());
    } catch (e) {
      /* a broken watcher must not stop the others */
    }
  });
}

export function watchTriggers(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

export function getTriggers() {
  return {
    known: state.known,
    unsupported: state.unsupported,
    account: state.account,
    char: state.lists.char,
    acct: state.lists.acct,
    status: { ...state.status },
  };
}

export function newTriggerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Replace one list and save it to the server shortly after. */
export function setTriggerList(scope, list) {
  if (!SCOPES.includes(scope) || !state.known) return;
  if (scope === 'acct' && !state.account) return;
  state.lists[scope] = list;
  dirty[scope] = true;
  clearTimeout(timers[scope]);
  timers[scope] = setTimeout(() => upload(scope), SAVE_DELAY_MS);
  notify();
}

function upload(scope) {
  timers[scope] = null;
  if (!dirty[scope] || !state.known) return;
  const list = state.lists[scope];
  const text = list.length ? JSON.stringify({ v: 1, list }) : '';
  const b64 = text ? utf8ToB64(text).b64 : '';
  if (!rpccmd('triggers_put', scope, b64)) {
    // No socket. Whatever reconnects next may be another character, so the
    // edit is not carried over (see the top of the file).
    state.status[scope] = 'error:offline';
    notify();
    return;
  }
  dirty[scope] = false;
  state.status[scope] = 'saving';
  notify();
}

function decode(b64) {
  if (!b64) return [];
  try {
    const data = JSON.parse(b64ToUtf8(b64));
    return Array.isArray(data.list)
      ? data.list
          .filter(x => x && typeof x.pattern === 'string')
          .map(x => (x.id ? x : { ...x, id: newTriggerId() }))
      : [];
  } catch (e) {
    return [];
  }
}

/** Forget the character: nothing fires until the next character's lists. */
function disarm() {
  asked = false;
  clearTimeout(answerTimer);
  answerTimer = null;
  state.known = false;
  state.unsupported = false;
  state.account = false;
  SCOPES.forEach(scope => {
    clearTimeout(timers[scope]);
    timers[scope] = null;
    dirty[scope] = false;
    state.lists[scope] = [];
    state.status[scope] = 'idle';
  });
  notify();
}

/* ---- the old browser-only #action triggers ------------------------------ */

function legacyStorage() {
  try {
    return localStorage.actions ? JSON.parse(localStorage.actions) : {};
  } catch (e) {
    return {};
  }
}

function saveLegacyStorage(stored) {
  try {
    if (Object.keys(stored).length) localStorage.actions = JSON.stringify(stored);
    else localStorage.removeItem('actions');
  } catch (e) {
    /* private mode */
  }
}

export function legacyActionMap() {
  return legacyStorage();
}

export function setLegacyActionMap(stored) {
  saveLegacyStorage(stored);
}

/** An old-style #action pattern and command as a regex trigger: %1..%9 each
 *  take one word, numbered in the order they appear in the pattern. */
export function fromAction(trigger, action) {
  const order = trigger.match(/%\d\b/g) || [];
  const pattern = trigger.replace(/%\d\b/g, '(\\S+)');
  // %N in the command meant "the placeholder written %N in the pattern"; in a
  // regex trigger %N is capture group N, so renumber by position.
  const cmd = action.replace(/%(\d)\b/g, (all, n) => {
    const at = order.indexOf('%' + n);
    return at >= 0 ? '%' + (at + 1) : all;
  });
  return { id: newTriggerId(), pattern, regex: true, on: true, hl: null, sound: null, cmd, act: trigger };
}

/** Move the old triggers onto the server list, as many as fit; the rest stay
 *  in this browser for next time. */
function importLegacy() {
  const stored = legacyStorage();
  const keys = Object.keys(stored).sort(
    (a, b) => (stored[a].priority !== undefined ? stored[a].priority : 5) - (stored[b].priority !== undefined ? stored[b].priority : 5)
  );
  if (!keys.length) return;

  const scope = state.account ? 'acct' : 'char';
  const room = MAX_PER_LIST - state.lists[scope].length;
  const moving = keys.slice(0, Math.max(0, room));
  if (!moving.length) return;

  const have = new Set(state.lists[scope].map(x => x.pattern));
  const added = moving.map(k => fromAction(k, String(stored[k].action || ''))).filter(x => !have.has(x.pattern));
  setTriggerList(scope, state.lists[scope].concat(added));
  moving.forEach(k => delete stored[k]);
  saveLegacyStorage(stored);

  $('.terminal').trigger('output-html', [
    '<span class="trig-note">' + t(scope === 'acct' ? 'tr.moved.acct' : 'tr.moved.char').replace('%d', String(moving.length)) + '</span>\n',
  ]);
}

/* ---- matching ---------------------------------------------------------- */

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The RegExp for one trigger, or an Error describing why there is none. */
export function compileTrigger(trig) {
  if (!trig.pattern) return new Error('empty');
  try {
    if (trig.regex) return new RegExp(trig.pattern);
    // Plain text: case-insensitive, %N takes any text (the last one takes the
    // rest of the line, the others as little as they can).
    const parts = trig.pattern.split(/(%[1-9])/);
    const atEnd = i => i === parts.length - 2 && parts[i + 1] === '';
    const re = parts
      .map((p, i) => (/^%[1-9]$/.test(p) ? (atEnd(i) ? '(.+)' : '(.+?)') : escapeRe(p)))
      .join('');
    return new RegExp(re, 'i');
  } catch (e) {
    return e;
  }
}

/** True when a regex backtracks catastrophically. Probes grow two characters
 *  at a time and stop at the first one over 25 ms, so a runaway pattern costs
 *  about 100 ms here once (results are cached) instead of freezing the tab on
 *  a long line of game text. */
const slowCache = new Map();
export function regexTooSlow(re) {
  const key = re.source + '/' + re.flags;
  if (slowCache.has(key)) return slowCache.get(key);
  let slowRe = false;
  outer: for (const unit of ['a', 'а', ' ', '1', 'a ']) {
    for (let n = 8; n <= 30; n += 2) {
      const probe = unit.repeat(n) + '!';
      const start = performance.now();
      re.exec(probe);
      if (performance.now() - start > 25) {
        slowRe = true;
        break outer;
      }
    }
  }
  slowCache.set(key, slowRe);
  return slowRe;
}

/** Which %N belongs to which capture group, in the order they appear. */
function placeholderOrder(trig) {
  if (trig.regex) return null; // a regex names its own groups: %N is group N
  return (trig.pattern.match(/%[1-9]/g) || []).map(p => p[1]);
}

function compileAll() {
  const out = [];
  for (const scope of SCOPES)
    for (const trig of state.lists[scope]) {
      if (!trig || trig.on === false || slow.has(trig.id)) continue;
      const re = compileTrigger(trig);
      if (re instanceof Error) continue;
      // Saved through #action or another device, so the editor never vetted it.
      if (trig.regex && regexTooSlow(re)) continue;
      out.push({ t: trig, re, order: placeholderOrder(trig) });
    }
  return out;
}

function substitute(cmd, m, order) {
  return cmd.replace(/%([0-9])/g, (all, n) => {
    if (n === '0') return m[0];
    if (!order) return m[+n] !== undefined ? m[+n] : '';
    const idx = order.indexOf(n);
    return idx >= 0 && m[idx + 1] !== undefined ? m[idx + 1] : '';
  });
}

let floodTimes = [];
let floodUntil = 0;

function note(text) {
  $('.terminal').trigger('output-html', ['<span class="trig-note">' + $('<i/>').text(text).html() + '</span>\n']);
}

function sendFromTrigger(cmd) {
  const now = Date.now();
  if (now < floodUntil) return;
  floodTimes = floodTimes.filter(x => now - x < FLOOD_WINDOW_MS);
  if (floodTimes.length >= FLOOD_MAX) {
    floodUntil = now + FLOOD_PAUSE_MS;
    floodTimes = [];
    note(t('tr.flood'));
    return;
  }
  floodTimes.push(now);
  send(expandAliases(cmd));
}

/** Text nodes under root, with each one's offset in the joined text. */
function textMap(root) {
  const nodes = [];
  let text = '';
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n =>
      n.parentElement && n.parentElement.closest('.no-triggers')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    nodes.push({ node: n, start: text.length });
    text += n.nodeValue;
  }
  return { nodes, text };
}

/** Wrap [from, to) of the joined text in highlight spans, splitting text
 *  nodes so every piece stays inside its own ANSI colour span. */
function wrapRange(map, from, to, mode, color) {
  for (const entry of map.nodes) {
    const n = entry.node;
    const s = entry.start;
    const e = s + n.nodeValue.length;
    if (e <= from || s >= to) continue;
    let target = n;
    const a = Math.max(from, s) - s;
    const b = Math.min(to, e) - s;
    if (b < target.nodeValue.length) target.splitText(b);
    if (a > 0) target = target.splitText(a);
    const span = document.createElement('span');
    span.className = mode === 'line' ? 'trig-line' : 'trig-match';
    if (mode === 'line') span.style.backgroundColor = color + '40';
    else span.style.color = color;
    target.parentNode.insertBefore(span, target);
    span.appendChild(target);
  }
}

/** Run every trigger over one block of server output, already in DOM form
 *  (the span terminal.jsx builds before it goes to history). Highlights are
 *  written into the DOM; sounds and commands go out once per trigger per
 *  block, so a trigger cannot answer one screen of text twenty times. */
export function applyTriggers(root) {
  if (compiled.length === 0) return;

  const ranges = [];
  const fired = [];
  let map = textMap(root);
  const lines = [];
  let pos = 0;
  map.text.split('\n').forEach(line => {
    lines.push({ line: line.replace(/\xa0/g, ' '), start: pos });
    pos += line.length + 1;
  });

  let tooSlow = false;
  for (const c of compiled) {
    let hit = null;
    const started = performance.now();
    for (const l of lines) {
      if (!l.line) continue;
      const m = c.re.exec(l.line);
      if (!m) continue;
      if (!hit) hit = m;
      if (c.t.hl && c.t.hl.color) {
        if (c.t.hl.mode === 'line') ranges.push([l.start, l.start + l.line.length, 'line', c.t.hl.color]);
        else if (m[0].length > 0) ranges.push([l.start + m.index, l.start + m.index + m[0].length, 'match', c.t.hl.color]);
      }
    }
    if (performance.now() - started > SLOW_MS) {
      slow.add(c.t.id);
      tooSlow = true;
      note(t('tr.slow').replace('%s', c.t.pattern));
      continue;
    }
    if (hit) fired.push({ c, m: hit });
  }
  if (tooSlow) compiled = compileAll();

  // Line backgrounds first, so a match colour inside the same line nests in them.
  ranges
    .sort((x, y) => (x[2] === y[2] ? 0 : x[2] === 'line' ? -1 : 1))
    .forEach(r => {
      wrapRange(map, r[0], r[1], r[2], r[3]);
      map = textMap(root);
    });

  for (const { c, m } of fired) {
    // No T: the sound plays under its own library type's volume slider.
    if (c.t.sound && c.t.sound.name) playSound(c.t.sound.name, { V: c.t.sound.V });
    if (c.t.cmd) sendFromTrigger(substitute(c.t.cmd, m, c.order));
  }
}

/* ---- server sync --------------------------------------------------------- */

$(document).ready(function () {
  $('#rpc-events')
    .on('rpc-version', disarm)
    .on('rpc-config_state', disarm)
    .on('rpc-prompt', function () {
      if (asked) return;
      asked = true;
      if (!rpccmd('triggers_get')) {
        asked = false;
        return;
      }
      clearTimeout(answerTimer);
      answerTimer = setTimeout(() => {
        answerTimer = null;
        if (state.known) return;
        state.unsupported = true;
        notify();
      }, ANSWER_TIMEOUT_MS);
    })
    .on('rpc-triggers_data', function (e, data) {
      if (!data) return;
      clearTimeout(answerTimer);
      answerTimer = null;
      state.known = true;
      state.unsupported = false;
      state.account = !!data.account;
      SCOPES.forEach(scope => {
        state.lists[scope] = decode(data[scope] && data[scope].b64);
      });
      notify();
      importLegacy();
    })
    .on('rpc-triggers_saved', function (e, data) {
      if (!data || !SCOPES.includes(data.scope) || !state.known) return;
      const scope = data.scope;
      if (data.ok) {
        state.status[scope] = 'idle';
      } else if (data.reason === 'rate') {
        dirty[scope] = true;
        clearTimeout(timers[scope]);
        timers[scope] = setTimeout(() => upload(scope), RETRY_MS);
      } else {
        dirty[scope] = true;
        state.status[scope] = 'error:' + (data.reason || 'io');
      }
      notify();
    });
});
