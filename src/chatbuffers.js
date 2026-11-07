/* Chat buffers read from the keyboard, for screen readers.
 *
 * Every chat line the server sends lands in a buffer (chatstore.js): one for
 * all chat, one each for tells, group, room and creatures, and one per channel
 * (ooc, gossip, ...). From the command line, the output review or anywhere
 * else in the game, without opening the chat panel:
 *   Alt+Left / Alt+Right  previous / next buffer, with its message count
 *   Alt+Up / Alt+Down     older / newer message in the buffer
 *   Alt+Home / Alt+End    oldest / newest message
 * What is read goes to a live region, so the screen reader speaks it and the
 * focus stays where it was. Nothing on screen changes. The keys work only with
 * #review on, the screen reader switch, so a player's keydown script still gets
 * them otherwise. A player's own hotkey on one of these keys wins; inside
 * dialogs, drop-down lists, menus and the text editor the keys keep their usual
 * meaning. Not on a Mac: there Option+arrows
 * move by word in every text field and Ctrl+Option is VoiceOver's own key.
 *
 * Lines come from the chat panel's archive step (chatstream.js) with their
 * archive id. With review on, a character's newest lines are read back from the
 * same archive (chatdb.js) at login, or on the first key press when review was
 * turned on later; the id tells which lines the read already brought in. With
 * review off nothing is read or kept, so other players pay nothing. */
import $ from 'jquery';
import chatDb from './chatdb.js';
import { onArchived } from './chatstream.js';
import { plain } from './plaintext';
import { createStore, CHANNEL } from './chatstore';
import { t } from './i18n';
import { sendHotKeyCmd } from './components/sysCommands/hotkeySend';
import { reviewEnabled, dialogOpen, IS_MAC } from './review';

const KEEP = 1000; // lines kept per buffer
// Lines read back from the archive: several buffers' worth, so a quiet
// buffer's tells are still there after an evening of channel chatter.
const LOAD = 5000;
const ELSEWHERE =
  '[role="dialog"], [role="combobox"], [role="listbox"], [role="menu"], .modal, .acc-overlay, .ace_editor, .monaco-editor';

/* A buffer's spoken name: its translation, or a channel's own name. */
export function bufferLabel(name) {
  if (name.startsWith(CHANNEL)) return name.slice(CHANNEL.length);
  const key = 'cb.buf.' + name;
  const label = t(key);
  return label === key ? name : label;
}

/* ---- screen reader announcements ------------------------------------------ */

let region = null;
let wipe = null;

function ensureRegion() {
  if (region) return region;
  region = document.createElement('div');
  region.id = 'chatBufferAnnounce';
  region.className = 'sr-only';
  region.setAttribute('aria-live', 'assertive');
  region.setAttribute('aria-relevant', 'additions');
  document.body.appendChild(region);
  return region;
}

/* Each text goes in as a new line of its own, at once: a screen reader speaks
 * an added line straight away, also when it is the same text as last time
 * (Alt+Down at the end, twice). The line before is taken out first, so only
 * the new one is read. Emptied once spoken, so browse mode does not find old
 * chat at the bottom of the page. */
/* The browser's ariaNotify hands the text straight to the screen reader, with
 * no live region in between. Heard with NVDA in Firefox on the PC; in other
 * browsers and on phones nobody has heard it yet, so they keep the region. */
const NOTIFY =
  typeof document !== 'undefined' &&
  typeof document.ariaNotify === 'function' &&
  /Firefox\//.test(navigator.userAgent) &&
  !/Android|Mobile/.test(navigator.userAgent);

export function announce(text) {
  if (NOTIFY) {
    try {
      document.ariaNotify(String(text), { priority: 'high' });
      return;
    } catch (e) {
      /* fall through to the region */
    }
  }
  const r = ensureRegion();
  clearTimeout(wipe);
  r.replaceChildren();
  const line = document.createElement('div');
  line.textContent = text;
  r.appendChild(line);
  wipe = setTimeout(() => r.replaceChildren(), 4000);
}

/* ---- the buffers ---------------------------------------------------------- */

const store = createStore(KEEP);
let who = null;
let generation = 0; // which archive read is current: a relog starts a new one
let loading = null; // lines archived while the archive was being read
let loadedUpTo = 0; // archive id of the newest line the read brought in
let reading = null; // the archive read of this character, once started
let active = false; // buffers kept for this character: review is on

/* The text is cleaned only when a line is read: a character's archive is read
 * back at login, and parsing all of it then would hold up the page. */
const rowOf = r => ({ id: r.id || 0, chan: r.chan || '', kind: r.kind || 'world', text: r.text || '' });
const spoken = row => {
  if (row.spoken === undefined) row.spoken = plain(row.text).replace(/\s+/g, ' ').trim();
  return row.spoken;
};

function finishLoad(mine, rows) {
  if (mine !== generation || !loading) return;
  const held = loading;
  loading = null;
  // A broken archive answer must not leave the keys waiting forever: the held
  // lines still go in, and the keys read what there is.
  try {
    if (Array.isArray(rows)) {
      rows.forEach(r => store.add(rowOf(r)));
      // loadLast answers oldest first: the last row has the newest id.
      loadedUpTo = rows.length ? rows[rows.length - 1].id || 0 : 0;
    }
  } finally {
    // Lines archived during the read: a newer id than the newest one read means
    // the read did not have it; no id means the archive refused it.
    held.forEach(row => {
      if (!row.id || row.id > loadedUpTo) store.add(row);
    });
  }
}

/* Start keeping this character's buffers: read the archive, and hold the lines
 * that arrive meanwhile. */
function start() {
  active = true;
  const mine = generation;
  const name = who;
  loading = [];
  reading = chatDb
    .then(db => db.loadLast(name, LOAD))
    .catch(() => [])
    .then(rows => finishLoad(mine, rows))
    .catch(() => {});
}

/* Review turned off: nothing kept, until it is on again. */
function stop() {
  generation++; // a read still running is for buffers no longer kept
  active = false;
  store.reset();
  loading = null;
  loadedUpTo = 0;
  reading = null;
}

function setWho(name) {
  if (name === who) return;
  who = name;
  generation++;
  stop();
  if (name && reviewEnabled()) start();
}

/* Each line the chat panel archived. Whose buffers these are is decided by
 * chat_state alone: a line archived late for the previous character (the
 * panel catches up on a relog a moment later) is not this character's. */
function onLine(name, saved) {
  if (!name || !saved || name !== who) return;
  if (!reviewEnabled()) {
    if (active) stop();
    return;
  }
  if (!active) return; // turned on mid-session: the first key press reads the archive, these lines included
  const row = rowOf(saved);
  if (loading) {
    loading.push(row);
    if (loading.length > KEEP) loading.shift();
  } else store.add(row);
}

/* ---- keys ----------------------------------------------------------------- */

function say(row, edge) {
  if (!row) return announce(t('cb.empty'));
  const prefix = edge === 'top' ? t('cb.top') + ' ' : edge === 'end' ? t('cb.end') + ' ' : '';
  announce(prefix + spoken(row));
}

function switchTo(step) {
  const name = store.switch(step);
  // Filled in by position, not by search and replace: a channel name is the
  // server's text and may itself hold '%s' or '$&'.
  const parts = t('cb.switched').split('%s');
  const fill = [bufferLabel(name), String(store.rowsOf(name).length)];
  announce(parts.map((p, i) => p + (i < parts.length - 1 && i < fill.length ? fill[i] : '')).join(''));
}

const ACTIONS = {
  ArrowLeft: () => switchTo(-1),
  ArrowRight: () => switchTo(1),
  ArrowUp: () => {
    const { row, edge } = store.move(-1);
    say(row, edge);
  },
  ArrowDown: () => {
    const { row, edge } = store.move(1);
    say(row, edge);
  },
  Home: () => say(store.jump(false)),
  End: () => say(store.jump(true)),
};

/* Places where Alt+arrows already mean something: dialogs (the help sheet, the
 * settings with macro recording, the account login), drop-down lists, menus,
 * comboboxes, the text editor. */
function keysBelongElsewhere() {
  if (document.body.classList.contains('modal-open') || document.body.classList.contains('settings-open') ||
      document.body.classList.contains('port-sheet-open'))
    return true;
  // A dialog actually up, by the same test output review uses.
  if (dialogOpen()) return true;
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  if (el.tagName === 'SELECT' || el.isContentEditable) return true;
  return !!(el.closest && el.closest(ELSEWHERE));
}

function onKey(e) {
  if (IS_MAC || !e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;
  // The keypad with NumLock off also reports arrows: those stay movement keys.
  if (e.code && e.code.startsWith('Numpad')) return;
  const act = ACTIONS[e.key];
  if (!act || !reviewEnabled() || keysBelongElsewhere()) return;
  if (sendHotKeyCmd(e)) return; // the player's own macro on this key wins
  // Alt+Left and Alt+Right would otherwise go Back and Forward and leave the game.
  e.preventDefault();
  e.stopPropagation();
  if (!active && who) start(); // review turned on during this session
  // Acted on once this character's archive is in; not after a relog meanwhile.
  const mine = generation;
  (reading || Promise.resolve()).then(() => {
    if (mine === generation) act();
  });
}

$(function () {
  ensureRegion(); // in place before the first announcement, or that one is lost
  $('#rpc-events').on('rpc-chat_state.chatbuffers', (e, b) => setWho((b && b.who) || null));
  onArchived(onLine);
  window.addEventListener('keydown', onKey, true);
});
