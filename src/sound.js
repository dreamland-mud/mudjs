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
// An exact name also picks among its numbered variants (spell/fire,
// spell/fire_2, spell/fire_3), so a sound cast every few seconds does not
// repeat itself. The server sends the base name; Mudlet plays the base file.
//
// Effects share one channel with MSP priority: a new sound stops the one that
// is playing only if its priority is strictly higher, so a fight does not turn
// into a mush of half-sounds. Spells get a channel of their own: otherwise a
// fireball would be cut by the crit sound of its own damage in the same
// output. Music is a third channel, one track at a time.
// The server's background loops (the 'ambience' frame) are a separate layer
// in ambience.js and never touch either channel.
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

export const SOUND_TYPES = ['combat', 'spell', 'alert', 'chat', 'ui', 'ambient', 'music'];

const DEFAULT_PREFS = {
  mute: false,
  master: 80,
  types: { combat: 100, spell: 70, alert: 100, chat: 100, ui: 100, ambient: 0, music: 0 },
};
// With a screen reader the background tells where you are (rain = outdoors,
// fire = resting, drums = a boss), so it is on, low enough to sit under the
// speech. Without one it is atmosphere only and starts off.
const SR_TYPES = { ambient: 30, music: 50 };

let srMode = false;
let userTypes = {}; // only the volumes the player has set; the rest follow the defaults
let prefs = loadPrefs();
let library = null; // [{ name, type, file, author, source, license }]
let libraryLoad = null;

let effect = null; // { audio, priority }
let spell = null; // { audio, priority, type, v, base }
// The same spell again within DAMP_MS plays quieter: a warlock on a fireball
// loop hears the first one in full and the rest as texture.
const DAMP_MS = 8000;
const DAMP = [1, 0.7, 0.5];
const recent = {}; // base name -> { t, n }
let mspOn = false;
let music = null; // { audio, name }
const prefsListeners = [];

function defaultTypes() {
  return srMode ? { ...DEFAULT_PREFS.types, ...SR_TYPES } : { ...DEFAULT_PREFS.types };
}

function loadPrefs() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
  } catch (e) {
    /* private mode or a broken value: defaults */
  }
  if (!saved || typeof saved !== 'object') saved = {};
  userTypes = saved.types && typeof saved.types === 'object' ? { ...saved.types } : {};
  return { ...DEFAULT_PREFS, ...saved, types: { ...defaultTypes(), ...userTypes } };
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, types: userTypes }));
  } catch (e) {
    /* private mode: the change lives for this tab */
  }
}

function changed() {
  if (prefs.mute) stopAll();
  else applyVolumes();
  prefsListeners.forEach(fn => fn(prefs));
}

export function getSoundPrefs() {
  return prefs;
}

export function setSoundPrefs(next) {
  userTypes = { ...userTypes, ...(next.types || {}) };
  prefs = { ...prefs, ...next, types: { ...defaultTypes(), ...userTypes } };
  savePrefs();
  changed();
}

/** Screen reader mode on or off: volumes the player never set follow it. */
export function setSoundScreenReader(on) {
  on = !!on;
  if (on === srMode) return;
  srMode = on;
  prefs = { ...prefs, types: { ...defaultTypes(), ...userTypes } };
  changed();
}

/** Call fn(prefs) after every change of the sound settings (the ambience
 *  layer follows the sliders and mute live). */
export function onSoundPrefs(fn) {
  prefsListeners.push(fn);
}

/** Every library entry named `name` or a numbered variant of it (name_2,
 *  name_3...). Empty when the library is not loaded yet. */
function variantsOf(name) {
  if (!library) return [];
  const esc = name.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + esc + '(_\\d+)?$', 'i');
  return library.filter(s => re.test(s.name));
}

const pickRandom = list => list[Math.floor(Math.random() * list.length)];

/** A random entry among `name` and its numbered variants, or null (library
 *  not loaded yet, or no such sound). */
export function findVariant(name) {
  const hits = variantsOf(name);
  return hits.length ? pickRandom(hits) : null;
}

/** Every library entry whose name matches re. */
export function findSounds(re) {
  return library ? library.filter(s => re.test(s.name)) : [];
}

/** URL of a library entry's file. */
export function soundUrl(entry) {
  return BASE + entry.file;
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
  let hits;
  if (/[*?]/.test(clean)) hits = library.filter(s => re.test(s.name));
  else hits = variantsOf(clean);
  if (hits.length === 0 && clean.indexOf('/') < 0)
    hits = library.filter(s => re.test(s.name.split('/').pop()));
  if (hits.length === 0) return null;
  return pickRandom(hits);
}

/** 0..1 for a sound type at volume v (0-100): master * type * v, 0 when muted. */
export function gain(type, v = 100) {
  if (prefs.mute) return 0;
  const t = prefs.types[type] !== undefined ? prefs.types[type] : 100;
  return (prefs.master / 100) * (t / 100) * (v / 100);
}

function applyVolumes() {
  if (effect) effect.audio.volume = gain(effect.type, effect.v);
  if (spell) spell.audio.volume = gain(spell.type, spell.v);
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
    if (gain(type, v) === 0) return; // silent: do not fetch it at all
    if (type === 'spell') return playSpell(name, entry, v, loops, p);

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

/** Fade out over ~100 ms instead of a click. */
function fadeOut(audio) {
  const v0 = audio.volume;
  let step = 0;
  const id = setInterval(() => {
    step++;
    audio.volume = Math.max(0, v0 * (1 - step / 5));
    if (step >= 5) {
      clearInterval(id);
      audio.pause();
    }
  }, 20);
}

/** The spell channel. Casts land every few seconds and a sound runs 2-4 s, so
 *  the same spell again replaces the one still playing (it would be dropped
 *  on a tie otherwise); a different spell of the same priority still waits. */
function playSpell(name, entry, v, loops, p) {
  const base = name.replace(/\.(wav|mid|ogg|mp3)$/i, '').toLowerCase();
  const now = Date.now();
  const last = recent[base];
  const n = last && now - last.t < DAMP_MS ? Math.min(last.n + 1, DAMP.length - 1) : 0;
  recent[base] = { t: now, n };
  v = Math.round(v * DAMP[n]);

  if (spell && !spell.audio.ended && !spell.audio.paused) {
    if (p < spell.priority || (p === spell.priority && spell.base !== base)) return;
    fadeOut(spell.audio);
  }
  const audio = start(name, entry, v, loops, 'spell', a => {
    if (spell && spell.audio === a) spell = null;
  });
  spell = { audio, priority: p, type: 'spell', v, base };
}

export function stopSound() {
  if (effect) effect.audio.pause();
  effect = null;
  if (spell) spell.audio.pause();
  spell = null;
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
    if (gain('music', v) === 0) return stopMusic();

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
