/* Two keys of the command line.
 *
 * Ctrl+Space completes the word before the cursor from the words of the recent
 * output, newest first; pressed again it gives the next word, and after the
 * last one what was typed comes back.
 *
 * Down on an empty command line (with the history at its end, where Down does
 * nothing) fills in the newest command link of the output; more Down goes to
 * older ones, Up back to newer ones and, past the newest, to an empty line.
 * Editing the line, Escape or sending it ends the browsing, and Up and Down
 * are the history again. */
import { addInputKeyHook } from '../../components/cmdinput';
import { macroFor } from '../../macros.js';
import { putInInput } from '../walk';
import { t } from '../../i18n';
import { lines } from './ring';
import { recentLinks } from './links';
import { say } from './speak';
import { toolKeysOn } from '../tools';

const WORD = /[\p{L}\p{N}_][\p{L}\p{N}_'-]*/gu;
const BEFORE = /[\p{L}\p{N}_'-]+$/u;

let completion = null; // { value, pos, start, prefix, found, i }
let hints = null; // { list: [{ cmd, line }], pos }

function setLine(input, value, caret) {
  putInInput(value);
  const at = caret === undefined ? value.length : caret;
  try {
    input.setSelectionRange(at, at);
  } catch (e) {
    // not a text field: nothing to place
  }
}

function completeWord(input) {
  const value = input.value;
  const pos = input.selectionStart === null ? value.length : input.selectionStart;
  let st = completion;
  if (!(st && st.value === value && st.pos === pos)) {
    const m = BEFORE.exec(value.slice(0, pos));
    if (!m) return say(t('out.complete.none'));
    const prefix = m[0];
    const low = prefix.toLowerCase();
    const seen = new Set([low]);
    const found = [];
    const ring = lines();
    for (let i = ring.length - 1; i >= 0; i--) {
      const words = ring[i].text.match(WORD);
      if (!words) continue;
      for (let j = words.length - 1; j >= 0; j--) {
        const w = words[j].toLowerCase();
        if (w.startsWith(low) && !seen.has(w)) {
          seen.add(w);
          found.push(words[j]);
        }
      }
    }
    if (!found.length) return say(t('out.complete.none'));
    st = completion = { start: m.index, prefix, found, i: -1 };
  }
  st.i += 1;
  let word;
  if (st.i >= st.found.length) {
    st.i = -1;
    word = st.prefix;
  } else word = st.found[st.i];
  const next = value.slice(0, st.start) + word + value.slice(pos);
  const caret = st.start + word.length;
  setLine(input, next, caret);
  st.value = next;
  st.pos = caret;
  say(word);
}

/* The commands of the recent output, newest first, each once: no item menus
 * and no web links. */
function hintCommands() {
  const seen = new Set();
  const out = [];
  recentLinks().forEach(({ link, line }) => {
    if (link.kind !== 'cmd' || !link.action || seen.has(link.action)) return;
    seen.add(link.action);
    out.push({ cmd: link.action, line });
  });
  return out;
}

function browseHints(input, down, atHistoryEnd) {
  if (hints && input.value !== hints.list[hints.pos].cmd) hints = null;
  if (!hints) {
    if (!down || input.value || !atHistoryEnd) return false;
    const list = hintCommands();
    if (!list.length) {
      say(t('out.links.empty'));
      return true;
    }
    hints = { list, pos: 0 };
  } else {
    hints.pos += down ? 1 : -1;
    if (hints.pos < 0) {
      hints = null;
      setLine(input, '');
      say(t('out.input'));
      return true;
    }
    hints.pos = Math.min(hints.pos, hints.list.length - 1);
  }
  const { cmd, line } = hints.list[hints.pos];
  setLine(input, cmd);
  say(line && line !== cmd ? cmd + ' - ' + line : cmd);
  return true;
}

addInputKeyHook((e, atHistoryEnd) => {
  const input = e.target;
  if (!input || input.id !== 'inputBox') return false;
  // Ctrl+Space and Down on an empty line are client keys too.
  if (!toolKeysOn()) return false;
  const plain = !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
  if (e.key === 'Escape' || e.key === 'Enter') {
    hints = null;
    completion = null;
    return false;
  }
  if ((e.key === ' ' || e.code === 'Space') && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
    if (macroFor('ctrl+space')) return false; // the player's own macro wins
    e.preventDefault();
    completeWord(input);
    return true;
  }
  if (plain && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    // Keypad arrows with NumLock off stay the player's movement keys.
    if (e.code && e.code.startsWith('Numpad')) return false;
    if (browseHints(input, e.key === 'ArrowDown', atHistoryEnd)) {
      e.preventDefault();
      return true;
    }
  }
  return false;
});
