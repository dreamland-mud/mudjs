/* Exit tones and room sounds, both off until the player turns them on, and
 * keys for mute and the master volume.
 *
 * Exit tones: on each move a short tone per visible exit of the prompt.
 * Room sounds: as soon as the room's text has come in (the output ends without
 * a line break: the prompt), or 800 ms after a move at the latest, a sound
 * for a quest target, players, creatures and items in that text, as in the
 * desktop client. Only what the room text
 * shows counts. The game sends the prompt frame before the room's text, so
 * the text that follows a new room number is that room's. */
import $ from 'jquery';
import { getSoundPrefs, setSoundPrefs } from '../../sound.js';
import { t, fmt } from '../../i18n';
import { registerTool } from '../tools';
import { prompt } from '../game';
import { say as speak } from '../speak';
import './strings';
import { EXIT_ORDER, playExits, playRoom, ROOM_ORDER, preload } from './synth';

const TONES_KEY = 'mudjs.exitTones';
const ROOM_KEY = 'mudjs.roomSounds';
// Any player, creature or item line in the text within this long of a move
// counts as being in the room, so a say from someone elsewhere in that moment
// counts as a player here too. Accepted: the game marks no room boundary.
const ROOM_WAIT_MS = 800;
const QUIET_MS = 40;
let quietTimer = null;

function flag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch (e) {
    return false;
  }
}

function setFlag(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch (e) {
    /* private mode: for this tab only */
  }
}

/* ---- what the room shows --------------------------------------------- */

const TARGET_MARKS = ['[TARGET]', '[ЦЕЛЬ]', '[ЦІЛЬ]'];
const CREATURE_WORDS = new Set(['consider', 'follow', 'шансы', 'следовать', 'шанси', 'слідувати', 'оценить', 'оцінити']);

function attrs(s) {
  const out = {};
  s.replace(/([a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (m, name, dq, sq) => {
    out[name.toLowerCase()] = dq !== undefined ? dq : sq;
    return m;
  });
  return out;
}

/* Kinds found in the game's text: the [TARGET] mark, and the menus of the
 * links the game puts on players (named), creatures (consider or follow) and
 * items (everything else). As the desktop client's presence.py. */
export function classify(text) {
  const found = new Set();
  if (TARGET_MARKS.some(m => text.includes(m))) found.add('target');
  const tag = /<m\s+([^>]*)>/gi;
  let hit;
  while ((hit = tag.exec(text))) {
    const a = attrs(hit[1]);
    const cmds = [a.c, a.l]
      .filter(Boolean)
      .join(',')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!cmds.length) continue;
    const ident = a.i || '';
    if (ident && !/^\d+$/.test(ident)) {
      found.add('player');
      continue;
    }
    const creature = cmds.some(c => CREATURE_WORDS.has(c.split(/\s+/)[0].toLowerCase()));
    found.add(creature ? 'mob' : 'item');
  }
  return found;
}

/* ---- room changes ------------------------------------------------------ */

let room = null;
let collecting = null; // text seen since the move
let roomTimer = null;

function finishRoom() {
  const text = collecting;
  collecting = null;
  roomTimer = null;
  if (text == null || !flag(ROOM_KEY)) return;
  const present = classify(text);
  const kinds = ROOM_ORDER.filter(k => present.has(k));
  // At once, over the exit tones if they still play, as the desktop does.
  playRoom(kinds);
}

function onRoom(vnum, frameExits) {
  if (vnum === undefined || vnum === null || vnum === '') return;
  const first = room === null;
  if (String(vnum) === String(room)) return;
  room = String(vnum);
  if (flag(TONES_KEY) || flag(ROOM_KEY)) preload();
  if (first) return;

  if (flag(TONES_KEY)) {
    const exits = frameExits || prompt().exits;
    const visible = String((exits && exits.e) || '').toLowerCase();
    playExits(EXIT_ORDER.filter(l => visible.includes(l)));
  }

  clearTimeout(roomTimer);
  clearTimeout(quietTimer);
  collecting = null;
  if (flag(ROOM_KEY)) {
    collecting = '';
    roomTimer = setTimeout(finishRoom, ROOM_WAIT_MS);
  }
}

$(document).ready(() => {
  $('#rpc-events').on('rpc-prompt.port-sounds', (e, b) => {
    // At once: the room's text may be the very next message. Exits not in
    // this frame are the ones the store kept from an earlier one.
    if (b && b.vnum !== undefined) onRoom(b.vnum, b.exits);
  });
  // A new login: its first room plays nothing.
  $('#rpc-events').on('rpc-version.port-sounds', () => {
    room = null;
  });
  $(document).on('output.port-sounds', '.terminal', (e, txt) => {
    if (collecting === null) return;
    const text = String(txt == null ? '' : txt);
    collecting += text;
    // Text that ends without a line break ends with the prompt: the room's
    // text is all here.
    if (text && !/\n\s*$/.test(text)) {
      clearTimeout(roomTimer);
      clearTimeout(quietTimer);
      finishRoom();
      return;
    }
    // No prompt (turned off, or one ending in a line break): the server sends
    // a room's text in one go, so a short quiet after it ends the room too.
    // ROOM_WAIT_MS after the move stays the latest.
    clearTimeout(quietTimer);
    if (text)
      quietTimer = setTimeout(() => {
        if (collecting === null) return;
        clearTimeout(roomTimer);
        finishRoom();
      }, QUIET_MS);
  });
});

/* ---- toggles and keys ---------------------------------------------------- */


function toggle(key, arg, onText, offText) {
  const a = String(arg || '').toLowerCase();
  const on = a === 'on' ? true : a === 'off' ? false : !flag(key);
  setFlag(key, on);
  speak(t(on ? onText : offText));
}

registerTool({
  id: 'exittones',
  label: () => t('snd.tones'),
  hash: 'exittones',
  help: () => t('snd.tones.help'),
  run: arg => toggle(TONES_KEY, arg, 'snd.tones.on', 'snd.tones.off'),
});

registerTool({
  id: 'roomsounds',
  label: () => t('snd.room'),
  hash: 'roomsounds',
  help: () => t('snd.room.help'),
  run: arg => toggle(ROOM_KEY, arg, 'snd.room.on', 'snd.room.off'),
});

registerTool({
  id: 'mute',
  menu: false, // spoken only, or Settings itself: not on the Tools page
  label: () => t('snd.mute'),
  keys: ['ctrl+shift+m'],
  inDialog: true,
  run: () => {
    const mute = !getSoundPrefs().mute;
    setSoundPrefs({ mute });
    speak(t(mute ? 'snd.muted' : 'snd.unmuted'));
  },
});

function changeVolume(step) {
  const master = Math.max(0, Math.min(100, Math.round((getSoundPrefs().master + step) / 10) * 10));
  setSoundPrefs({ master });
  speak(fmt('snd.volume', master));
}

registerTool({
  id: 'louder',
  menu: false, // spoken only, or Settings itself: not on the Tools page
  label: () => t('snd.louder'),
  keys: ['ctrl+shift+up'],
  inDialog: true,
  run: () => changeVolume(10),
});

registerTool({
  id: 'quieter',
  menu: false, // spoken only, or Settings itself: not on the Tools page
  label: () => t('snd.quieter'),
  keys: ['ctrl+shift+down'],
  inDialog: true,
  run: () => changeVolume(-10),
});
