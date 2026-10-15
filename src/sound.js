// The client's sound player, with the semantics of the MUD Sound Protocol
// (MSP v0.3, https://www.zuggsoft.com/zmud/msp.htm), so a sound picked in a
// trigger and a !!SOUND(...) line from the server behave the same way.
//
// Sounds come only from our own library, public/sounds/<type>/<name>.ogg,
// listed in public/sounds/manifest.json. A name is a relative path without the
// extension and may carry MSP wildcards (* and ?): several matches pick one at
// random, per play. A name that is not in the library plays nothing. A U=
// download URL from the server is ignored on purpose: the web client never
// fetches audio from wherever a line of text points.
//
// Effects share one channel with MSP priority: a new sound stops the one that
// is playing only if its priority is strictly higher, so a fight does not turn
// into a mush of half-sounds. Music is a second channel, one track at a time.
//
// Volume is this device's business, not the character's: master, per-type and
// mute live in localStorage under mudjs.sound.
//
// MSP lines are honoured only after the server says it sends them (an 'msp'
// frame with true). Until then a !!SOUND at the start of a line is ordinary
// text: a note or a description written by a player must not be able to loop
// a sound at top priority.

import $ from 'jquery';

const BASE = import.meta.env.BASE_URL + 'sounds/';
const PREFS_KEY = 'mudjs.sound';

export const SOUND_TYPES = ['combat', 'alert', 'chat', 'ui', 'ambient'];

const DEFAULT_PREFS = {
  mute: false,
  master: 80,
  types: { combat: 100, alert: 100, chat: 100, ui: 100, ambient: 60, music: 50 },
};

let prefs = loadPrefs();
let library = null; // [{ name, type, file, author, source, license }]
let libraryLoad = null;

let effect = null; // { audio, priority }
let mspOn = false;
let music = null; // { audio, name }

function loadPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (saved && typeof saved === 'object')
      return { ...DEFAULT_PREFS, ...saved, types: { ...DEFAULT_PREFS.types, ...(saved.types || {}) } };
  } catch (e) {
    /* private mode or a broken value: defaults */
  }
  return { ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types } };
}

export function getSoundPrefs() {
  return prefs;
}

export function setSoundPrefs(next) {
  prefs = { ...prefs, ...next, types: { ...prefs.types, ...(next.types || {}) } };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    /* private mode: the change lives for this tab */
  }
  if (prefs.mute) stopAll();
  else applyVolumes();
}

/** The library, loaded once. Resolves to [] when the manifest is missing. */
export function loadLibrary() {
  if (!libraryLoad)
    libraryLoad = fetch(BASE + 'manifest.json')
      .then(r => (r.ok ? r.json() : { sounds: [] }))
      .then(m => (library = Array.isArray(m.sounds) ? m.sounds : []))
      .catch(() => (library = []));
  return libraryLoad;
}

const clamp = (n, lo, hi, dflt) => {
  n = parseInt(n, 10);
  return isNaN(n) ? dflt : Math.min(hi, Math.max(lo, n));
};

/** MSP wildcard -> RegExp: * matches the rest, ? one character. */
function wildcard(name) {
  const esc = name.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + esc.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
}

/** Pick a library entry for an MSP name: exact path, then (per the spec) the
 *  bare file name in any directory. Null when nothing matches. */
function resolve(name) {
  if (!library || !name) return null;
  // Absolute paths are not allowed; an extension is ours to choose.
  const clean = name.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.(wav|mid|ogg|mp3)$/i, '');
  if (clean.split('/').includes('..')) return null;

  const re = wildcard(clean);
  let hits = library.filter(s => re.test(s.name));
  if (hits.length === 0 && clean.indexOf('/') < 0)
    hits = library.filter(s => re.test(s.name.split('/').pop()));
  if (hits.length === 0) return null;
  return hits[Math.floor(Math.random() * hits.length)];
}

function gain(type, v) {
  if (prefs.mute) return 0;
  const t = prefs.types[type] !== undefined ? prefs.types[type] : 100;
  return (prefs.master / 100) * (t / 100) * (v / 100);
}

function applyVolumes() {
  if (effect) effect.audio.volume = gain(effect.type, effect.v);
  if (music) music.audio.volume = gain('music', music.v);
}

/** Play `loops` times (-1 = until stopped), re-resolving wildcards per loop. */
function start(name, entry, v, loops, type, onEnd) {
  const audio = new Audio(BASE + entry.file);
  audio.volume = gain(type, v);
  let left = loops;
  audio.addEventListener('ended', () => {
    if (left > 0) left--;
    if (left === 0) return onEnd(audio);
    const next = resolve(name) || entry;
    audio.src = BASE + next.file;
    audio.play().catch(() => onEnd(audio));
  });
  // Rejected until the first click or key on the page (browser autoplay rule).
  audio.play().catch(() => onEnd(audio));
  return audio;
}

/** MSP !!SOUND. opts: V volume 0-100, L loops (-1 forever), P priority 0-100,
 *  T type (falls back to the library's own type for the sound). */
export function playSound(name, opts = {}) {
  if (!name) return;
  if (/^off$/i.test(name)) return stopSound();
  if (prefs.mute) return;

  loadLibrary().then(() => {
    const entry = resolve(name);
    if (!entry) return;

    const v = clamp(opts.V, 0, 100, 100);
    let loops = clamp(opts.L, -1, 100, 1);
    if (loops === 0) loops = 1;
    const p = clamp(opts.P, 0, 100, 50);
    const type = (opts.T || entry.type || 'alert').toLowerCase();

    if (effect && !effect.audio.ended && !effect.audio.paused) {
      if (p <= effect.priority) return; // a tie: the one already playing wins
      effect.audio.pause();
    }

    const audio = start(name, entry, v, loops, type, a => {
      if (effect && effect.audio === a) effect = null;
    });
    effect = { audio, priority: p, type, v };
  });
}

export function stopSound() {
  if (effect) effect.audio.pause();
  effect = null;
}

/** MSP !!MUSIC. opts: V, L, C (1 = keep playing the same track, 0 = restart). */
export function playMusic(name, opts = {}) {
  if (!name) return;
  if (/^off$/i.test(name)) return stopMusic();
  if (prefs.mute) return;

  loadLibrary().then(() => {
    const entry = resolve(name);
    if (!entry) return;

    const v = clamp(opts.V, 0, 100, 100);
    let loops = clamp(opts.L, -1, 100, 1);
    if (loops === 0) loops = 1;
    const cont = clamp(opts.C, 0, 1, 1) === 1;

    if (music && music.name === name && cont && !music.audio.paused) {
      music.v = v;
      applyVolumes();
      return;
    }
    stopMusic();
    const audio = start(name, entry, v, loops, 'music', a => {
      if (music && music.audio === a) music = null;
    });
    music = { audio, name, v };
  });
}

export function stopMusic() {
  if (music) music.audio.pause();
  music = null;
}

export function stopAll() {
  stopSound();
  stopMusic();
}

/** Whether the server has said it sends MSP on this connection. */
export function mspEnabled() {
  return mspOn;
}

$(document).ready(function () {
  $('#rpc-events')
    .on('rpc-version', function () {
      mspOn = false;
    })
    .on('rpc-msp', function (e, on) {
      mspOn = !!on;
      if (!mspOn) stopAll();
    });
});

/** Parse one MSP line, "!!SOUND(name V=.. L=.. P=.. T=.. U=..)", and play it.
 *  False when the line is not an MSP trigger. */
export function handleMspLine(line) {
  const m = /^!!(SOUND|MUSIC)\(([^)]*)\)\s*$/.exec(line);
  if (!m) return false;

  const parts = m[2].trim().split(/\s+/);
  const name = parts.shift();
  const opts = {};
  parts.forEach(p => {
    const kv = /^([A-Z])=(\S*)$/.exec(p);
    if (kv) opts[kv[1]] = kv[2];
  });

  if (m[1] === 'SOUND') playSound(name, opts);
  else playMusic(name, opts);
  return true;
}
