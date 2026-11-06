/* Output review for screen readers.
 *
 * Tab in the command line puts the game output into a hidden textarea and moves
 * the focus there. The screen reader stays in focus mode and reads it the way
 * it reads any text box: Up and Down by line, Ctrl+arrows by word. Enter runs
 * the command link under the caret (or the line's first one) and stays here.
 * Tab, Shift+Tab or Escape go back to the command line; typing a letter goes
 * back too and the letter lands in the command line.
 *
 * Nothing in the terminal moves while reviewing: scrolling it would load or
 * trim history, so the textarea is a copy, kept in step as new output lands. */
import $ from 'jquery';
import { t } from './i18n';
import { getKeydown } from './settings';
import { sendHotKeyCmd } from './components/sysCommands/hotkeySend';
import { resumeAutoScroll } from './components/terminal';
import { echoHtml } from './components/sysCommandUtils';

// Commands, help links and item names (an item name opens its menu of actions).
const LINK_SELECTOR = '.manip-cmd, .builtin-cmd, .dropdown-toggle';
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);
const REFRESH_MS = 1000; // new output is copied in at most this often, unless a key is pressed

let box = null; // the review textarea
let lines = []; // [{start, end, links: [{start, end, el}]}], offsets into box.value
let observer = null;
let refreshTimer = null;
let saved = null; // {value, caret} when review was last left: Tab comes back there
let copied = ''; // the text as this module last wrote it, to undo an edit that slipped through

/* Each output chunk is read once: a chunk never changes after it lands, and
 * walking the whole terminal again for every new line made reading during a
 * fight several times slower. */
let chunkCache = new WeakMap(); // emptied each time review opens: chunks edited while it was closed are read again

/* Plain text of the terminal, one game line per line, blank lines dropped, with
 * the character range of every command link. */
function collectLines(terminal) {
  const out = [];
  terminal.childNodes.forEach(child => {
    if (child.nodeType !== 1 || !child.hasAttribute('data-chunk-id')) {
      out.push(...collectNode(child));
      return;
    }
    let lines = chunkCache.get(child);
    if (!lines) {
      lines = collectNode(child);
      chunkCache.set(child, lines);
    }
    out.push(...lines);
  });
  return out;
}

function collectNode(root) {
  const out = [];
  let cur = { text: '', links: [] };
  const push = () => {
    if (cur.text.trim()) out.push(cur);
    cur = { text: '', links: [] };
  };
  const addText = s => {
    const parts = s.replace(/\xa0/g, ' ').split('\n');
    parts.forEach((part, i) => {
      if (i > 0) push();
      cur.text += part;
    });
  };
  const walk = node => {
    if (node.nodeType === 3) return addText(node.nodeValue);
    if (node.nodeType !== 1) return;
    // Chunks marked aria-hidden (output heard live, then reloaded) are still
    // scrollback, so review keeps them. An item's menu of actions is hidden
    // text inside the line: not read.
    if (node.classList && node.classList.contains('dropdown-menu')) return;
    if (node.tagName === 'BR' || node.tagName === 'HR') return push();
    const isLink = node.matches && node.matches(LINK_SELECTOR);
    const startLine = cur;
    const start = cur.text.length;
    node.childNodes.forEach(walk);
    if (isLink && cur === startLine && cur.text.length > start)
      cur.links.push({ start, end: cur.text.length, el: node });
    if (node.tagName === 'DIV' || node.tagName === 'P') push();
  };
  walk(root);
  push();
  return out;
}

function render(collected) {
  let pos = 0;
  lines = collected.map(l => {
    const line = {
      start: pos,
      end: pos + l.text.length,
      links: l.links.map(k => ({ start: pos + k.start, end: pos + k.end, el: k.el })),
    };
    pos += l.text.length + 1;
    return line;
  });
  return collected.map(l => l.text).join('\n');
}

function terminalEl() {
  return document.querySelector('.terminal');
}

function lineAt(offset) {
  for (let i = lines.length - 1; i >= 0; i--) if (offset >= lines[i].start) return lines[i];
  return null;
}

/* How many characters were cut off the top of oldValue to get the start of
 * value: the terminal trims whole chunks off the top as new output arrives at
 * the bottom, so value is oldValue minus a prefix of whole lines, plus new text.
 * -1 when the two do not line up that way (history reloaded, say). */
function trimmedPrefix(oldValue, value) {
  if (value.startsWith(oldValue)) return 0;
  const nl = value.indexOf('\n');
  const first = nl < 0 ? value : value.slice(0, nl);
  // Only line starts whose line equals value's first line are worth the full
  // comparison, so this stays cheap on a full screen.
  for (let cut = oldValue.indexOf('\n') + 1; cut > 0; cut = oldValue.indexOf('\n', cut) + 1) {
    const end = cut + first.length;
    if (oldValue.startsWith(first, cut) && (end === oldValue.length || oldValue[end] === '\n') &&
        value.startsWith(oldValue.slice(cut)))
      return cut;
  }
  return -1;
}

/* Where a caret at oldCaret in oldValue sits in value. A caret whose line was
 * trimmed off the top goes to the oldest line left, the nearest to where it
 * was, as the in-place edit in refresh() does; -1 when its line cannot be found. */
function carryCaret(oldValue, oldCaret, value, cut = trimmedPrefix(oldValue, value)) {
  if (cut >= 0) return oldCaret >= cut ? oldCaret - cut : 0;
  // Not a plain trim: look for the caret's line by its text, nearest the place
  // it had, rather than the last copy of a repeated line.
  const s = oldValue.lastIndexOf('\n', oldCaret - 1) + 1;
  let e = oldValue.indexOf('\n', s);
  if (e < 0) e = oldValue.length;
  const text = oldValue.slice(s, e);
  if (!text) return -1;
  const target = Math.round((s / Math.max(1, oldValue.length)) * value.length);
  let best = -1;
  for (let i = value.indexOf(text); i >= 0; i = value.indexOf(text, i + 1))
    if (best < 0 || Math.abs(i - target) < Math.abs(best - target)) best = i;
  return best >= 0 ? best + (oldCaret - s) : -1;
}

/* The terminal as text, or null while it has nothing to read: scrolling to the
 * bottom empties it and reloads it from the history database, and the copy
 * (with the caret) must wait for the reload rather than go blank. */
function currentText() {
  const terminal = terminalEl();
  if (!terminal || !terminal.querySelector('[data-chunk-id]')) return null;
  return render(collectLines(terminal));
}

/* Replace the whole copy, carrying the caret from oldValue's text. */
function replaceCopy(value, oldValue, caret, cut) {
  box.value = value;
  copied = value;
  let pos = carryCaret(oldValue, caret, value, cut);
  if (pos < 0) pos = value.length;
  box.setSelectionRange(pos, pos);
}

function refresh() {
  refreshTimer = null;
  if (!box || box.hidden || !observer) return;
  // The terminal was rebuilt (a layout change, a reconnect): watch the new one.
  if (terminalEl() !== watched) startWatching();
  const oldValue = box.value;
  const value = currentText();
  if (value === null) return scheduleRefresh();
  if (value === oldValue) return;
  const cut = trimmedPrefix(oldValue, value);
  if (cut >= 0) {
    // Edit the text in place, leaving the caret where it is: replacing the
    // whole text made the screen reader read the line under the caret again
    // after every line of output.
    if (cut > 0) box.setRangeText('', 0, cut, 'preserve');
    const kept = oldValue.length - cut;
    box.setRangeText(value.slice(kept), kept, kept, 'preserve');
    copied = box.value;
    return;
  }
  replaceCopy(value, oldValue, box.selectionStart, cut);
}

/* Mutations come in bursts (one per chunk, plus history loads). Each copy makes
 * the browser lay out the whole review text again, which during a fight cost as
 * much as the terminal itself, so new output is copied in at most once a
 * second, and at once before a reading key (see flushRefresh): the player always
 * reads current text. */
function scheduleRefresh() {
  if (!refreshTimer) refreshTimer = setTimeout(refresh, REFRESH_MS);
}

function flushRefresh() {
  if (!refreshTimer) return;
  clearTimeout(refreshTimer);
  refresh();
}

let watched = null; // the terminal element the observer is on

function startWatching() {
  stopWatching();
  const terminal = terminalEl();
  watched = terminal;
  if (!terminal) return;
  observer = new MutationObserver(records => {
    // A chunk is read once and cached; one edited after it landed (a trigger,
    // a script) is read again.
    records.forEach(r => {
      const node = r.target.nodeType === 1 ? r.target : r.target.parentElement;
      const chunk = node && node.closest && node.closest('[data-chunk-id]');
      if (chunk) chunkCache.delete(chunk);
    });
    scheduleRefresh();
  });
  observer.observe(terminal, { childList: true, subtree: true, characterData: true });
}

function stopWatching() {
  if (observer) observer.disconnect();
  observer = null;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
}

const DIALOG = '[role="dialog"], [aria-modal="true"], .modal';

/* Option+arrows move by word on a Mac and Ctrl+Option is VoiceOver's key: the
 * chat keys (chatbuffers.js) stay off there. */
export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');

/* On screen: the help sheet and the settings stay in the page while closed,
 * slid aside and marked aria-hidden. */
export function isShown(el) {
  return el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function dialogOpen() {
  return Array.from(document.querySelectorAll(DIALOG)).some(isShown);
}

// The focus went from the box straight into a dialog (the help sheet, say):
// the box stays until it closes. Set where the move is visible, after the blur.
let dialogFromReview = false;

/* Out of the page once left: a hidden copy of the whole output would stay in
 * the accessibility tree (and in browse mode) for the screen reader to track.
 * Emptied a moment later, once the screen reader has announced where the focus
 * went. While a dialog that took the focus from the box is up (the help sheet),
 * the box stays, even when the focus has wandered out of the dialog: the dialog
 * gives the focus back to the box when it closes. A dialog the player opened
 * otherwise does not keep it. */
function scheduleHide() {
  const el = box;
  setTimeout(() => {
    if (!el || document.activeElement === el) return;
    const now = document.activeElement;
    if (dialogFromReview && dialogOpen()) return scheduleHide();
    dialogFromReview = false;
    if (now && now.closest && now.closest(DIALOG)) return scheduleHide();
    el.value = '';
    el.hidden = true;
    lines = []; // let trimmed chunks go: the copy held their link elements
  }, 1500);
}

/* Back to `input`, or, when there is none (the connection dropped and the
 * command line is the Reconnect button now), to that button. */
function leave(input) {
  stopWatching();
  if (box && box.value) saved = { value: box.value, caret: box.selectionStart };
  const target = input || (box && document.activeElement === box ? document.querySelector('.rf-reconnect') : null);
  if (target) target.focus();
  else if (input === undefined && box && document.activeElement === box) box.blur();
  scheduleHide();
}

/* After a link ran: stay in review, unless the link opened something that took
 * the focus (the help sheet, settings), which keeps it. */
function afterClick() {
  const now = document.activeElement;
  if (now === box) return;
  if (!now || now === document.body) enterReview();
  else leave(null); // the command line or a dialog the link moved the focus to keeps it
}

function onKeyDown(e) {
  const input = document.getElementById('inputBox');
  // Tab and Shift+Tab both go back: the box sits outside the page's tab order,
  // and Shift+Tab from it would wander through every link in the output. A
  // player's own hotkey on Tab wins here as it does in the command line.
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && sendHotKeyCmd(e)) return;
  if (e.key === 'Escape' || (e.key === 'Tab' && !e.ctrlKey && !e.altKey)) {
    e.preventDefault();
    return leave(input || undefined);
  }
  // Bring in output still waiting to be copied, so the key reads current text
  // and Enter finds the right link. Not on a held key's repeats: those would
  // copy the whole text dozens of times a second during a fight.
  if (!e.repeat) flushRefresh();
  if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    const caret = box.selectionStart;
    const line = lineAt(caret);
    if (!line || !line.links.length) return;
    // The link under the caret, or just before it (the caret right after a
    // link's last letter, End on the line), else the line's first link.
    const link =
      line.links.find(k => caret >= k.start && caret < k.end) ||
      line.links.find(k => caret === k.end) ||
      line.links[0];
    if (link.el.classList.contains('dropdown-toggle')) return openMenu(link.el);
    // The command runs and the reading stays on the same line; the game's
    // answer is announced and lands below.
    saved = { value: box.value, caret };
    clickLink(link.el);
    afterClick();
    return;
  }
  // The textarea's own reading keys read; the keypad with NumLock off also
  // reports arrows, and those stay movement hotkeys below.
  if (NAV_KEYS.has(e.key) && !e.code.startsWith('Numpad')) return;
  // Hotkeys fire here as they would in the command line, the player's keydown
  // script (keypad movement) too.
  if (sendHotKeyCmd(e)) return;
  // A typed letter goes back to the command line and lands in it: the focus
  // moves before the browser types it.
  const typed = (e.key.length === 1 || e.key === 'Dead' || e.key === 'Process') && !e.ctrlKey && !e.altKey;
  if (typed && !e.code.startsWith('Numpad')) {
    leave(input || undefined);
    return;
  }
  getKeydown()(e);
  // A keypad arrow (NumLock off) is movement: it must not move the caret too.
  if (e.code.startsWith('Numpad') && NAV_KEYS.has(e.key)) e.preventDefault();
}

/* Click a link of the copy. While the terminal reloads its history its chunks
 * are gone from the page for a moment, and a click on a detached element never
 * reaches the page's delegated handlers: put it in the page for the click. */
function clickLink(el) {
  if (el.isConnected) return el.click();
  const holder = document.createElement('div');
  holder.hidden = true;
  holder.appendChild(el);
  document.body.appendChild(holder);
  try {
    el.click();
  } finally {
    holder.remove();
  }
}

/* Enter on an item name: open its menu of actions, the same one a click opens,
 * and move the focus to the first action. Up and Down move through the
 * actions, Enter runs one, Escape goes back to the output line. The keys are
 * kept from the window handler, which would pull the focus to the command line. */
function openMenu(toggle) {
  saved = { value: box.value, caret: box.selectionStart };
  if (!toggle.isConnected) return; // the history is reloading: the menu is not in the page for now
  toggle.click();
  const menu = toggle.parentElement && toggle.parentElement.querySelector('.dropdown-menu');
  const items = menu ? Array.from(menu.querySelectorAll('.dropdown-item')) : [];
  if (!items.length) {
    if (menu && menu.classList.contains('show')) toggle.click();
    return;
  }
  // One listener per menu, ever: a menu left some other way (a mouse click
  // outside) and opened again must not run its action twice.
  if (menu._reviewDetach) menu._reviewDetach();
  const detach = () => {
    menu.removeEventListener('keydown', onMenuKey, true);
    menu.removeEventListener('focusout', onFocusOut);
    menu._reviewDetach = null;
  };
  const close = () => {
    detach();
    if (menu.classList.contains('show')) toggle.click();
  };
  function onFocusOut() {
    setTimeout(() => {
      if (!menu.contains(document.activeElement)) detach();
    }, 0);
  }
  function onMenuKey(e) {
    resumeAutoScroll();
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const item = items[i >= 0 ? i : 0];
      close();
      item.click();
      // Back to the output line the item was on, like a command link. Item
      // actions only send a command, so nothing else wants the focus.
      enterReview();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      close();
      if (e.key === 'Escape') enterReview();
      else document.getElementById('inputBox')?.focus();
    } else if (!(e.key.length === 1 && !e.ctrlKey && !e.altKey)) {
      // F1 to F12 and other non-letter keys: the player's macro first.
      if (sendHotKeyCmd(e)) return;
      e.stopPropagation();
    } else {
      close();
    }
  }
  menu.addEventListener('keydown', onMenuKey, true);
  menu.addEventListener('focusout', onFocusOut);
  menu._reviewDetach = detach;
  // The box's blur ends review once the menu has the focus. If the menu did
  // not open, stay in review rather than leave it half-stopped.
  items[0].focus();
  if (document.activeElement !== items[0]) {
    close();
    box.focus();
  }
}

function ensureBox() {
  if (box) return box;
  box = document.createElement('textarea');
  box.id = 'outputReview';
  // Not readOnly: Chrome does not move the caret of a read-only textarea with
  // the arrow keys, so nothing could be read. Every edit is blocked instead.
  box.setAttribute('aria-readonly', 'true');
  box.tabIndex = -1; // reached only with Tab from the command line, never by tabbing around the page
  box.setAttribute('wrap', 'off');
  box.setAttribute('spellcheck', 'false');
  box.className = 'output-review';
  box.setAttribute('aria-label', t('rv.label'));
  box.addEventListener('keydown', onKeyDown);
  // Every edit (typing, Backspace, Delete, paste, cut, drop) is cancelled here.
  box.addEventListener('beforeinput', e => e.preventDefault());
  // IME and dead-key composition cannot be cancelled: put the copy back, with
  // the caret carried over the same way new output carries it.
  box.addEventListener('input', () => {
    const caret = Math.min(box.selectionStart, copied.length);
    const value = currentText();
    replaceCopy(value === null ? copied : value, copied, caret);
  });
  // Leaving for another control ends review. Leaving the window (Alt+Tab, a
  // confirm dialog) does not: the focus comes back here and the copy must still
  // be kept up to date.
  box.addEventListener('blur', () => {
    setTimeout(() => {
      // By now React has run the dialog's focus effect, so a dialog that took
      // the focus from the box shows here.
      const now = document.activeElement;
      if (now && now !== box && now.closest && now.closest(DIALOG)) dialogFromReview = true;
      if (now !== box && document.hasFocus()) leave(null);
    }, 0);
  });
  box.addEventListener('focus', () => {
    if (!observer && !box.hidden) {
      startWatching();
      scheduleRefresh();
    }
  });
  document.body.appendChild(box);
  return box;
}

/* ---- the switch ----------------------------------------------------------- */

/* Off until the player turns it on with #review on (sysCommands/review.js), or
 * the game says the character uses a screen reader (config screenreader, see
 * followServer below); remembered in this browser. Then Tab in the command
 * line reads the output, and Alt with the arrows reads chat (chatbuffers.js). */
const SWITCH_KEY = 'mudjs.outputReview';

export function reviewEnabled() {
  try {
    return localStorage.getItem(SWITCH_KEY) === 'on';
  } catch (e) {
    return false; // storage blocked: off, as for a new player
  }
}

export function setReviewEnabled(on) {
  try {
    if (on) localStorage.setItem(SWITCH_KEY, 'on');
    else localStorage.removeItem(SWITCH_KEY);
  } catch (e) {
    /* storage blocked: nothing to remember it in */
  }
}

/* The game's own screen reader setting. Turning it on or off (config
 * screenreader, or the Settings dialog) turns review on or off. Entering the
 * world, review is turned on only when the setting is newly on for that
 * character: a player who then chose #review off keeps it off. */
const SERVER_KEY = 'mudjs.outputReview.server';
const serverOn = v => v === true || v === 1 || ['1', 'yes', 'on', 'true'].includes(String(v).toLowerCase());
let playing = null; // the character in the world, for the per-character memory

function lastServer() {
  try {
    return JSON.parse(localStorage.getItem(SERVER_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function noteServer(name, on) {
  if (!name) return;
  try {
    const seen = lastServer();
    seen[name] = on;
    localStorage.setItem(SERVER_KEY, JSON.stringify(seen));
  } catch (e) {
    /* storage blocked: follow the server each time */
  }
}

/* What #review says about the switch; also said when the game turns it. */
export function reviewStateText() {
  const on = reviewEnabled();
  return t(on ? 'rv.cmd.on' : 'rv.cmd.off') + (IS_MAC ? '' : ' ' + t(on ? 'rv.cmd.chat.on' : 'rv.cmd.chat.off'));
}

/* Turned by the game: switched and said, so Tab going into the output is not a surprise. */
function switchTo(on) {
  if (on === reviewEnabled()) return;
  setReviewEnabled(on);
  echoHtml(reviewStateText());
}

function followServer() {
  $('#rpc-events').on('rpc-config_state.review', (e, b) => {
    if (!b || !b.playing) {
      playing = null;
      return;
    }
    playing = b.who || null;
    const on = serverOn(b.screenreader);
    if (on && lastServer()[playing] !== true) switchTo(true);
    noteServer(playing, on);
  });
  const changed = (e, b) => {
    if (!b || b.key !== 'screenreader') return;
    // config_result carries ok as 1 or 0, and a refusal has no value: nothing changed.
    // config_changed has no ok at all.
    if ((b.ok !== undefined && !b.ok) || b.value === undefined) return;
    const on = serverOn(b.value);
    switchTo(on);
    noteServer(playing, on);
  };
  // config_changed when typed or changed elsewhere; config_result answers this
  // client's own Settings dialog, which gets no config_changed.
  $('#rpc-events').on('rpc-config_changed.review', changed);
  $('#rpc-events').on('rpc-config_result.review', changed);
}
$(followServer);

/* Called from the command line on Tab. */
export function enterReview() {
  const terminal = terminalEl();
  if (!terminal) return false;
  const el = ensureBox();
  el.hidden = false;
  el.setAttribute('aria-label', t('rv.label'));
  chunkCache = new WeakMap();
  // While the terminal reloads its history it is empty for a moment: show the
  // copy from last time until the reload lands, rather than a blank box.
  const now = currentText();
  el.value = now !== null ? now : saved ? saved.value : '';
  copied = el.value;
  // Back on the line read last time; the newest line the first time, or when
  // that line has scrolled out of the output.
  let pos = saved ? carryCaret(saved.value, saved.caret, el.value) : -1;
  if (pos < 0) pos = lines.length ? lines[lines.length - 1].start : 0;
  startWatching();
  // The caret goes on its line before the focus arrives, so the screen reader
  // announces that line and not the last one first.
  el.setSelectionRange(pos, pos);
  el.focus();
  el.setSelectionRange(pos, pos);
  return true;
}
