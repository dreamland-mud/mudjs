import $ from 'jquery';
import { send, rpccmd } from './websock.js';
import { utf8ToB64, b64ToUtf8 } from './b64utf8.js';

// Aliases: a word that stands for one or more commands, written with | between
// them. Two lists, edited on the Aliases page of the settings window.
//
// The character's list IS the game's own `alias` list (comm/alias.cpp): the
// server expands those, and the page only shows them and changes them by
// sending `alias` / `unalias`, the same commands a player types. The server
// pushes aliases_char after each of those commands, typed or sent from here,
// so the page never shows a list the player has since changed.
//   aliases_char {max, aliases: [[name, body], ...]}   body as stored, single |
//
// The account's list is the client's: kept on the server as an opaque blob
// (comm/webaliases.cpp), expanded here before a line is sent, so it works for
// every character of the account.
//   { v: 1, list: [ { name, body } ] }
//
// A name in both lists belongs to the character: the client leaves the line
// alone and the server expands its own alias. The narrower list wins.
//
// Lists belong to one character: a new socket or a quit/login drops them and
// any unsaved account edit, as triggers.js does.

export const MAX_ACCT = 300;
const SAVE_DELAY_MS = 1200;
const RETRY_MS = 1500;
const ANSWER_TIMEOUT_MS = 5000;
// The game's line limit (MAX_INPUT_LENGTH less the terminating byte).
export const MAX_LINE = 1023;

const state = {
  known: false, // the character's list has arrived
  unsupported: false, // no answer: the server has no aliases rpc yet
  max: 1000,
  account: false,
  acctKnown: false,
  char: [], // [{ name, body }]
  acct: [], // [{ name, body }]
  status: 'idle', // the account list: idle | saving | error:<reason>
};
let dirty = false;
let timer = null;
let asked = false;
let answerTimer = null;
const watchers = new Set();

function notify() {
  const snap = getAliases();
  watchers.forEach(fn => {
    try {
      fn(snap);
    } catch (e) {
      /* a broken watcher must not stop the others */
    }
  });
}

export function watchAliases(fn) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

export function getAliases() {
  return {
    known: state.known,
    unsupported: state.unsupported,
    max: state.max,
    account: state.account,
    acctKnown: state.acctKnown,
    char: state.char,
    acct: state.acct,
    status: state.status,
  };
}

/* ---- the character's list: the game's own aliases ------------------------ */

// Typing `alias x a|b` would cut the line at | before `alias` ever saw it; the
// game reads || as one literal |, so a body goes out with every | doubled.
const commandBody = body => body.replace(/\|/g, '||');

/** Why a name cannot be an alias, or '' when it can. */
export function badName(name) {
  if (!name) return 'empty';
  if (/\s/.test(name)) return 'space';
  if (name[0] === "'" || name[0] === '"') return 'quote';
  if (name.includes('|')) return 'pipe';
  // `alias flush` wipes every alias instead of defining one.
  if (name.toLowerCase() === 'flush') return 'flush';
  return '';
}

/** True when `alias name body` fits on one game line. */
export function fitsLine(name, body) {
  return ('alias ' + name + ' ' + commandBody(body)).length <= MAX_LINE;
}

/** Define or redefine one of the character's aliases. A rename drops the old
 *  name first. The list on the page follows the server's answer. */
export function setCharAlias(oldName, name, body) {
  if (oldName && oldName !== name) send('unalias ' + oldName);
  send('alias ' + name + ' ' + commandBody(body));
}

export function removeCharAlias(name) {
  send('unalias ' + name);
}

/* ---- the account's list -------------------------------------------------- */

/** Replace the account list and save it to the server shortly after. */
export function setAcctAliases(list) {
  if (!state.acctKnown || !state.account) return;
  state.acct = list;
  dirty = true;
  clearTimeout(timer);
  timer = setTimeout(upload, SAVE_DELAY_MS);
  notify();
}

function upload() {
  timer = null;
  if (!dirty || !state.acctKnown) return;
  const text = state.acct.length ? JSON.stringify({ v: 1, list: state.acct }) : '';
  const b64 = text ? utf8ToB64(text).b64 : '';
  if (!rpccmd('aliases_acct_put', b64)) {
    state.status = 'error:offline';
    notify();
    return;
  }
  dirty = false;
  state.status = 'saving';
  notify();
}

function decode(b64) {
  if (!b64) return [];
  try {
    const data = JSON.parse(b64ToUtf8(b64));
    return Array.isArray(data.list)
      ? data.list.filter(x => x && typeof x.name === 'string' && typeof x.body === 'string')
      : [];
  } catch (e) {
    return [];
  }
}

/* ---- expanding account aliases before a line is sent --------------------- */

/** One game line cut where the server cuts it: at a single |, while || stays
 *  inside a piece as the literal | it stands for. */
function splitPieces(line) {
  const pieces = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '|') {
      if (line[i + 1] === '|') {
        cur += '||';
        i++;
        continue;
      }
      pieces.push(cur);
      cur = '';
      continue;
    }
    cur += line[i];
  }
  pieces.push(cur);
  return pieces;
}

/** Expand one command the way the game expands its own aliases: the first
 *  word is the name, the rest is added to the end of the body. Quoted lines
 *  (say-shortcuts) are never aliases. One level only: a body is sent as is,
 *  so two account aliases cannot call each other in circles. */
function expandPiece(piece) {
  const m = /^(\s*)(\S+)(.*)$/.exec(piece);
  if (!m) return piece;
  const word = m[2];
  if (word[0] === "'" || word[0] === '"') return piece;
  if (state.char.some(x => x.name === word)) return piece;
  const hit = state.acct.find(x => x.name === word);
  if (!hit) return piece;
  const rest = m[3].trim();
  return hit.body + (rest ? ' ' + rest : '');
}

/** A line as it should go to the server, account aliases expanded. */
export function expandAliases(line) {
  // jQuery's .each hands over String objects, not strings.
  if (!state.acct.length || line == null) return line;
  return splitPieces(String(line)).map(expandPiece).join('|');
}

/* ---- server sync --------------------------------------------------------- */

function disarm() {
  asked = false;
  clearTimeout(answerTimer);
  answerTimer = null;
  clearTimeout(timer);
  timer = null;
  dirty = false;
  state.known = false;
  state.unsupported = false;
  state.account = false;
  state.acctKnown = false;
  state.char = [];
  state.acct = [];
  state.status = 'idle';
  notify();
}

$(document).ready(function () {
  $('#rpc-events')
    .on('rpc-version', disarm)
    .on('rpc-config_state', disarm)
    .on('rpc-prompt', function () {
      if (asked) return;
      asked = true;
      if (!rpccmd('aliases_get') || !rpccmd('aliases_acct_get')) {
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
    .on('rpc-aliases_char', function (e, data) {
      if (!data || !Array.isArray(data.aliases)) return;
      clearTimeout(answerTimer);
      answerTimer = null;
      state.known = true;
      state.unsupported = false;
      if (data.max) state.max = data.max;
      state.char = data.aliases
        .filter(p => Array.isArray(p) && typeof p[0] === 'string')
        .map(p => ({ name: p[0], body: String(p[1] || '') }));
      notify();
    })
    .on('rpc-aliases_acct', function (e, data) {
      if (!data) return;
      state.acctKnown = true;
      state.account = !!data.account;
      state.acct = decode(data.b64);
      notify();
    })
    .on('rpc-aliases_acct_saved', function (e, data) {
      if (!data || !state.acctKnown) return;
      if (data.ok) {
        state.status = 'idle';
      } else if (data.reason === 'rate') {
        dirty = true;
        clearTimeout(timer);
        timer = setTimeout(upload, RETRY_MS);
      } else {
        dirty = true;
        state.status = 'error:' + (data.reason || 'io');
      }
      notify();
    });
});
