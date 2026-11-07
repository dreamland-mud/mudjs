/* The desktop client's sounds for exits and for what a room shows, played
 * through WebAudio at the volume the sound settings give the "ui" type. */
import { getSoundPrefs } from '../../sound.js';
import { makeSound, RATE } from './recipes';

let ctx = null;

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      ctx = new Ctx();
    } catch (e) {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Browsers start audio only after a key or a click on the page: a key or a
// click wakes it, but only once a sound has been asked for (the context
// exists), so players with the sounds off never get one.
['keydown', 'pointerdown'].forEach(type =>
  window.addEventListener(
    type,
    () => {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    { capture: true, passive: true }
  )
);

/* 0..1 from the sound settings: nothing when muted. */
function volume() {
  const p = getSoundPrefs();
  if (p.mute) return 0;
  const type = p.types && p.types.ui !== undefined ? p.types.ui : 100;
  return (p.master / 100) * (type / 100);
}

/* The desktop client's sounds, made here with the same recipes as its
 * tools/make_exit_tones.py and tools/make_room_sounds.py (recipes.js), once
 * each, then kept. No sound files. */
const buffers = new Map();

function load(c, path) {
  if (!buffers.has(path)) {
    let buffer = null;
    try {
      const made = makeSound(path);
      if (made) {
        buffer = c.createBuffer(2, made[0].length, RATE);
        buffer.copyToChannel(made[0], 0);
        buffer.copyToChannel(made[1], 1);
      }
    } catch (e) {
      buffer = null;
    }
    buffers.set(path, Promise.resolve(buffer));
  }
  return buffers.get(path);
}

/* path played `at` seconds from now at level 0..1. */
function play(c, path, at, level) {
  const due = c.currentTime + at;
  load(c, path).then(buf => {
    if (!buf) return;
    const src = c.createBufferSource();
    const amp = c.createGain();
    src.buffer = buf;
    amp.gain.value = level;
    src.connect(amp);
    amp.connect(c.destination);
    // A sound still loading when its time came plays at once.
    src.start(Math.max(due, c.currentTime));
  });
}

const EXIT_NAMES = { n: 'north', e: 'east', s: 'south', w: 'west', u: 'up', d: 'down' };

/* Fetch and decode every sound before it is needed, so the first one of a
 * kind is not late. */
export function preload() {
  const c = audio();
  if (!c) return;
  Object.values(EXIT_NAMES).forEach(n => load(c, 'exits/' + n));
  ['target', 'player', 'mob', 'item'].forEach(k => load(c, 'room/' + k));
}

export const EXIT_ORDER = ['n', 'e', 's', 'w', 'u', 'd'];
export const EXIT_GAP = 0.13;

// As loud as in the desktop client: 70 of 100 of the "ui" volume, the item
// clink at full.
const EXIT_LEVEL = 0.7;
const ROOM_LEVEL = { item: 1 };

/* A tone per exit letter, 130 ms apart. Returns how long they take, in s. */
export function playExits(letters) {
  const v = volume();
  const c = v > 0 && letters.length ? audio() : null;
  if (!c) return 0;
  letters.forEach((l, i) => play(c, 'exits/' + EXIT_NAMES[l], i * EXIT_GAP, EXIT_LEVEL * v));
  return letters.length * EXIT_GAP;
}

export const ROOM_ORDER = ['target', 'player', 'mob', 'item'];

/* The room's sounds together, as the desktop client plays them, starting
 * `delay` seconds from now. */
export function playRoom(kinds, delay = 0) {
  const v = volume();
  const c = v > 0 && kinds.length ? audio() : null;
  if (!c) return;
  kinds.forEach(kind => play(c, 'room/' + kind, delay, (ROOM_LEVEL[kind] || EXIT_LEVEL) * v));
}
