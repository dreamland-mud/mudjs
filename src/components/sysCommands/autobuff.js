import $ from 'jquery';
import { send, rpccmd } from '../../websock';
import { parseStringCmd, echoHtml, clickableLink, DELETE_WORDS } from '../sysCommandUtils';
import { st } from './strings';

// Player-managed manual autobuff list, stored per browser in
// localStorage.autobuff as an array of { gate, cmd }. The '~' key (defaults.js)
// and the panel button both call runAutobuff(): it fires the server-side
// auto-buff (rpccmd 'autobuff', computed from the character's live practices and
// level, so it self-updates) and then each manual entry -- the things the server
// can't know: a pet's haste, a cross-class order. A manual entry is gated on an
// affect sysname the server publishes in mudprompt.affsn: it fires only while
// that affect is absent. Gate '*' fires every time.
//
// Those browser lines are the LEGACY path. The settings tab (AutobuffPage) keeps
// the player's own lines on the character, server-side, next to which buffs are
// switched off and in what order; the server runs them itself after the buffs.
// The tab offers to import the browser lines, which then empties this list.

export const autobuffHelp = {
  get title() { return st('sys.ab.title', clickableLink('#help autobuff')); },
  get description() { return st('sys.ab.desc', clickableLink('#autobuff')); },
};

const errAutobuff = () => st('sys.forhelp', clickableLink('#help autobuff'));

function loadList() {
  try {
    return localStorage.autobuff ? JSON.parse(localStorage.autobuff) : [];
  } catch (e) {
    return []; // corrupt or unavailable storage -- treat as empty
  }
}

function saveList(list) {
  try {
    localStorage.autobuff = JSON.stringify(list);
  } catch (e) {
    /* private mode / storage disabled -- entry just won't persist */
  }
}

// Used by the panel button to decide whether to show itself for a non-caster
// who nonetheless keeps manual entries (e.g. a warrior with a pet mage) -- in
// this browser or on the character.
export function autobuffHasEntries() {
  if (server && Array.isArray(server.custom) && server.custom.length > 0) return true;
  return loadList().length > 0;
}

// The legacy browser lines, for the settings tab's import offer.
export function legacyAutobuffLines() {
  return loadList();
}

export function setLegacyAutobuffLines(list) {
  saveList(list);
}

// --- Server-kept settings (autobuff_prefs RPC) ---
//
// The server answers 'list' and every 'set' with the whole list:
//   { who, spells: [{ sn, name, on }], custom: [{ gate, cmd, bad }] }
// A server without the RPC answers nothing, and the tab never appears. Asked
// once per character after the first prompt (so the panel button knows about
// server-side lines) and again whenever the settings window opens.
let server = null;
let asked = false;
// The seq of the last request (list or change) sent and not yet answered.
// While one is out, every other answer is to an older request, already out of
// date, and would drag the tab back to a state the player has left.
let seq = 0;
let awaiting = null;
const watchers = new Set();

export function autobuffServer() {
  return server;
}

export function watchAutobuff(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

// Tagged like a change, so a slow answer to an earlier request can't land on
// top of this one. It also replaces a wait on a change that went into a dead
// socket.
export function requestAutobuffList() {
  asked = true;
  const tag = String(++seq);
  if (rpccmd('autobuff_prefs', 'list', tag)) awaiting = tag;
}

// Tabs and newlines are the wire format's separators; a command can't carry them.
const flat = s => String(s || '').replace(/[\t\r\n]+/g, ' ').trim();

// The server's limits (setPrefs in utils/autobuff): a line past them is dropped.
export const AUTOBUFF_MAX_LINES = 20;
export const AUTOBUFF_MAX_GATE = 40;
export const AUTOBUFF_MAX_CMD = 200;

export function autobuffLineFits(line) {
  const gate = flat(line.gate);
  const cmd = flat(line.cmd);
  return !!gate && !!cmd && gate.length <= AUTOBUFF_MAX_GATE && cmd.length <= AUTOBUFF_MAX_CMD;
}

// Send the whole state; the server validates it and answers with the list it
// actually stored, tagged with this change's seq.
export function saveAutobuffPrefs(spells, custom) {
  const order = spells.map(one => one.sn).join(',');
  const off = spells.filter(one => !one.on).map(one => one.sn).join(',');
  const own = custom
    .map(one => flat(one.gate) + '\t' + flat(one.cmd))
    .join('\n');
  const tag = String(++seq);
  if (!rpccmd('autobuff_prefs', 'set', order, off, own, tag)) return false;
  awaiting = tag;
  return true;
}

const notify = () => watchers.forEach(fn => fn(server));

$(function () {
  $('#rpc-events').on('rpc-autobuff_list', (e, b) => {
    const body = b && typeof b === 'object' ? b : null;
    if (awaiting !== null) {
      if (!body || body.seq !== awaiting) return;
      awaiting = null;
    }
    server = body;
    notify();
  });

  // First prompt of a character: ask, so the panel button can show for a
  // non-caster whose lines live on the server.
  $('#rpc-events').on('rpc-prompt', () => {
    if (!asked) requestAutobuffList();
  });

  // Entering or leaving the world (a character switch included): what is in
  // hand belongs to somebody else.
  $('#rpc-events').on('rpc-config_state', () => {
    server = null;
    asked = false;
    awaiting = null;
    notify();
  });
});

function listEntries() {
  const list = loadList();
  if (list.length === 0)
    return echoHtml(st('sys.ab.empty', clickableLink('#help autobuff')));
  let buf = st('sys.ab.list');
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const when = e.gate === '*' ? st('sys.ab.always') : st('sys.ab.ifnot', e.gate);
    buf += `    ${i + 1}. [${when}] ${e.cmd}\n`;
  }
  echoHtml(buf + '\n');
}

function addEntry(s) {
  const gate = s[1];
  const cmd = s.slice(2).join(' ').trim();
  if (!gate || !cmd) return echoHtml(errAutobuff());

  const list = loadList();
  list.push({ gate: gate, cmd: cmd });
  saveList(list);

  const when = gate === '*' ? st('sys.ab.always') : st('sys.ab.whilenot', gate);
  echoHtml(st('sys.ab.added', when, cmd));
}

function delEntry(s) {
  const n = parseInt(s[1], 10);
  const list = loadList();
  if (!n || n < 1 || n > list.length)
    return echoHtml(st('sys.ab.nonum', clickableLink('#autobuff')));
  const removed = list.splice(n - 1, 1)[0];
  saveList(list);
  echoHtml(st('sys.ab.deleted', removed.cmd));
}

function clearEntries() {
  saveList([]);
  echoHtml(st('sys.ab.cleared'));
}

const autobuffCmd = value => {
  const s = parseStringCmd(value);
  if (!s[0]) return listEntries();
  const sub = s[0].toLowerCase();
  if (sub === 'add' || sub === 'добавить' || sub === 'додати') return addEntry(s);
  if (sub === 'del' || DELETE_WORDS.includes(sub)) return delEntry(s);
  if (sub === 'clear' || sub === 'очистить' || sub === 'очистити') return clearEntries();
  return echoHtml(errAutobuff());
};

// The '~' key (defaults.js) and the panel button both call this.
export function runAutobuff() {
  // Server-side auto-buff: every buff you know >=50% and don't have up. This
  // reaches a dedicated RPC handler OUTSIDE the command interpreter, so there is
  // no typeable 'autobuff' command -- only the button/key can fire it.
  rpccmd('autobuff');

  // Then the player's own manual entries, each gated by active affect.
  const list = loadList();
  if (list.length === 0) return;

  const affsn =
    window.mudprompt && Array.isArray(window.mudprompt.affsn)
      ? window.mudprompt.affsn
      : [];

  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.gate && e.gate !== '*' && affsn.indexOf(e.gate) !== -1) continue;
    send(e.cmd);
  }
}

export default autobuffCmd;
