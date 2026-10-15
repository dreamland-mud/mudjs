import $ from 'jquery';
import { rpccmd } from './websock.js';
import { utf8ToB64, b64ToUtf8 } from './b64utf8.js';
import { t } from './i18n.js';
import keycode from './components/sysCommands/keycode.js';

// Macros: a key combination that sends commands. Edited on the Macros page of
// the settings window and with #hotkey; fired from the game's keydown handler
// (sysCommands/hotkey.js).
//
// Two lists live on the server (comm/webmacros.cpp): the character's own and
// the account's, shared by every character of the account. Each is an opaque
// base64 blob of this JSON:
//   { v: 1, list: [ { key, cmd } ] }
//     key  the name keycode.hotkey gives the press: "f1", "ctrl+shift+z"
//     cmd  'command|command'; $var is substituted, account aliases expanded
// A key in both lists fires the character's.
//
// Lists belong to one character: a new socket or a quit/login drops them, as
// triggers.js does. Until the server answers -- or when it has no macros rpc
// at all -- the old browser-only #hotkey list in localStorage.hotkey is used,
// so keys keep working on a server that does not keep macros yet. The first
// time a server list arrives, that list moves onto the account (or the
// character, when there is no account) and leaves this browser.

export const SCOPES = ['char', 'acct'];
export const MAX_PER_LIST = 300;
const SAVE_DELAY_MS = 1200;
const RETRY_MS = 1500;
const ANSWER_TIMEOUT_MS = 5000;

const state = {
  known: false,
  unsupported: false,
  account: false,
  lists: { char: [], acct: [] },
  status: { char: 'idle', acct: 'idle' },
};
const dirty = { char: false, acct: false };
const timers = { char: null, acct: null };
const watchers = new Set();
let asked = false;
let answerTimer = null;

function notify() {
  const snap = getMacros();
  watchers.forEach(fn => {
    try {
      fn(snap);
    } catch (e) {
      /* a broken watcher must not stop the others */
    }
  });
}

export function watchMacros(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

export function getMacros() {
  return {
    known: state.known,
    unsupported: state.unsupported,
    account: state.account,
    char: state.lists.char,
    acct: state.lists.acct,
    status: { ...state.status },
  };
}

/** Replace one list and save it to the server shortly after. */
export function setMacroList(scope, list) {
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
  if (!rpccmd('macros_put', scope, b64)) {
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
      ? data.list.filter(x => x && typeof x.key === 'string' && typeof x.cmd === 'string')
      : [];
  } catch (e) {
    return [];
  }
}

/* ---- the old browser-only #hotkey list ---------------------------------- */

function legacyStorage() {
  try {
    return localStorage.hotkey ? JSON.parse(localStorage.hotkey) : {};
  } catch (e) {
    return {};
  }
}

function saveLegacyStorage(stored) {
  try {
    if (Object.keys(stored).length) localStorage.hotkey = JSON.stringify(stored);
    else localStorage.removeItem('hotkey');
  } catch (e) {
    /* private mode */
  }
}

function importLegacy() {
  const stored = legacyStorage();
  const keys = Object.keys(stored);
  if (!keys.length) return;

  const scope = state.account ? 'acct' : 'char';
  const have = new Set(state.lists[scope].map(x => x.key));
  const room = MAX_PER_LIST - state.lists[scope].length;
  const moving = keys.slice(0, Math.max(0, room));
  if (!moving.length) return;

  // A key this list already has keeps the server's command: the server copy
  // is the one every other device sees.
  // Keys stored before they were canonical ("я" and "z") collapse into one.
  const added = [];
  for (const k of moving) {
    const one = { key: keycode.canonical(k) || k, cmd: String(stored[k] || '') };
    if (!one.cmd || have.has(one.key)) continue;
    have.add(one.key);
    added.push(one);
  }
  if (added.length) setMacroList(scope, state.lists[scope].concat(added));
  moving.forEach(k => delete stored[k]);
  saveLegacyStorage(stored);
  if (!added.length) return;

  $('.terminal').trigger('output-html', [
    '<span class="trig-note">' + t(scope === 'acct' ? 'mc.moved.acct' : 'mc.moved.char').replace('%d', String(added.length)) + '</span>\n',
  ]);
}

/* ---- one interface over both stores, for #hotkey and the key handler ----- */

/** Server lists when the server keeps macros, this browser's otherwise. */
export function macrosOnServer() {
  return state.known;
}

/** The command for a key, character first. */
export function macroFor(key) {
  if (!state.known) return legacyStorage()[key];
  for (const scope of SCOPES) {
    const hit = state.lists[scope].find(x => x.key === key);
    if (hit) return hit.cmd;
  }
  return undefined;
}

/** Every macro as [{ key, cmd, scope }], scope 'local' for this browser's. */
export function allMacros() {
  if (!state.known) {
    const stored = legacyStorage();
    return Object.keys(stored).map(key => ({ key, cmd: stored[key], scope: 'local' }));
  }
  return SCOPES.flatMap(scope => state.lists[scope].map(x => ({ ...x, scope })));
}

/** Where #hotkey puts a new key: the account when there is one. */
export function defaultScope() {
  if (!state.known) return 'local';
  return state.account ? 'acct' : 'char';
}

/** Add or replace a key's command in one list. False when it cannot be
 *  saved there: the list is full, or it is the account's and there is none. */
export function putMacro(scope, key, cmd) {
  if (scope === 'local') {
    const stored = legacyStorage();
    stored[key] = cmd;
    saveLegacyStorage(stored);
    return true;
  }
  if (!SCOPES.includes(scope) || !state.known || (scope === 'acct' && !state.account)) return false;
  const list = state.lists[scope];
  const at = list.findIndex(x => x.key === key);
  if (at < 0 && list.length >= MAX_PER_LIST) return false;
  setMacroList(scope, at >= 0 ? list.map((x, i) => (i === at ? { key, cmd } : x)) : list.concat([{ key, cmd }]));
  return true;
}

/** Drop a key from one list. */
export function removeMacro(scope, key) {
  if (scope === 'local') {
    const stored = legacyStorage();
    delete stored[key];
    saveLegacyStorage(stored);
    return;
  }
  setMacroList(scope, state.lists[scope].filter(x => x.key !== key));
}

/** Save an edited or new macro, moving it out of where it was when its list
 *  or its key changed. False when the target list is full. */
export function saveMacro(origScope, origKey, scope, key, cmd) {
  // Into another list: in first, so a refusal there loses nothing here.
  if (origScope && origScope !== scope) {
    if (!putMacro(scope, key, cmd)) return false;
    removeMacro(origScope, origKey);
    return true;
  }
  // Within one list the old entry goes first, which also makes room for the new.
  if (origScope && origKey !== key) removeMacro(origScope, origKey);
  return putMacro(scope, key, cmd);
}

/** Drop a key from every list. False when no list had it. */
export function deleteMacro(key) {
  if (!state.known) {
    const stored = legacyStorage();
    if (stored[key] === undefined) return false;
    delete stored[key];
    saveLegacyStorage(stored);
    return true;
  }
  let found = false;
  for (const scope of SCOPES) {
    const list = state.lists[scope];
    if (list.some(x => x.key === key)) {
      found = true;
      setMacroList(scope, list.filter(x => x.key !== key));
    }
  }
  return found;
}

/* ---- server sync --------------------------------------------------------- */

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

$(document).ready(function () {
  $('#rpc-events')
    .on('rpc-version', disarm)
    .on('rpc-config_state', disarm)
    .on('rpc-prompt', function () {
      if (asked) return;
      asked = true;
      if (!rpccmd('macros_get')) {
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
    .on('rpc-macros_data', function (e, data) {
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
    .on('rpc-macros_saved', function (e, data) {
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
