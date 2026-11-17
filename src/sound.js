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
// Effects and spells are pools of voices mixed through Web Audio: casts and
// hits overlap in a real fight, so several play at once. Each pool has a cap
// (lower in screen reader mode, so speech stays on top); a full pool steals
// its oldest lowest-priority voice, MSP priority deciding. The same spell
// again replaces its own voice, and the same effect twice within DEDUP_MS
// plays once (an area spell's ten hit lines are one hit). A compressor on the
// mix keeps stacked sounds from clipping. Music is one track at a time.
// The server's background loops (the 'ambience' frame) are a separate layer
// in ambience.js and never touch the pools.
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

// Voice pools: { type, v, priority, base, name, t, setVolume(), stop(fade) }.
const effects = [];
const spells = [];
const CAPS = { effect: 4, spell: 6 };
const SR_CAPS = { effect: 3, spell: 3 };
const DEDUP_MS = 120;
const lastEffect = {}; // name -> ms
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
  // v is the file's content hash, stamped into the built manifest
  // (vite.config.js stampSoundManifest): sounds are cached for a week, so a
  // replaced file needs a new URL or players keep hearing the old one.
  return BASE + entry.file + (entry.v ? '?v=' + entry.v : '');
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
  effects.concat(spells).forEach(voice => voice.setVolume(gain(voice.type, voice.v)));
  if (music) music.audio.volume = gain('music', music.v);
}

/** Play `loops` times (-1 = until stopped), re-resolving wildcards per loop. */
function start(name, entry, v, loops, type, onEnd) {
  const audio = new Audio(soundUrl(entry));
  audio.volume = gain(type, v);
  let left = loops;
  audio.addEventListener('ended', () => {
    if (left > 0) left--;
    if (left === 0) return onEnd(audio);
    const next = resolve(name) || entry;
    audio.src = soundUrl(next);
    audio.play().catch(() => onEnd(audio));
  });
  // Rejected until the first click or key on the page (browser autoplay rule).
  audio.play().catch(() => onEnd(audio));
  return audio;
}

/* ---- Web Audio voices ------------------------------------------------- */

let ctx = null; // AudioContext, null where the browser has none
let bus = null; // compressor -> destination; every voice feeds it
// url -> Promise<AudioBuffer>, least recently used first. A decoded second
// is ~190 KB of floats, so only the last BUFFER_CAP files stay decoded.
const buffers = new Map();
const BUFFER_CAP = 40;

function context() {
  if (ctx === null) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    try {
      ctx = Ctx ? new Ctx() : false;
    } catch (e) {
      ctx = false;
    }
    if (ctx) {
      // A soft limiter: one sound passes untouched, a stack is held down.
      bus = ctx.createDynamicsCompressor();
      bus.threshold.value = -10;
      bus.knee.value = 6;
      bus.ratio.value = 12;
      bus.attack.value = 0.003;
      bus.release.value = 0.25;
      bus.connect(ctx.destination);
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx || null;
}

// Browsers start audio only after a key or a click on the page.
['keydown', 'pointerdown'].forEach(type =>
  window.addEventListener(
    type,
    () => {
      // Safari keeps a context made outside a gesture suspended, so make it
      // here once the server sends sounds and the player has them on.
      if (ctx === null && mspOn && !prefs.mute) context();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    { capture: true, passive: true }
  )
);

function decode(url) {
  let job = buffers.get(url);
  if (job) {
    buffers.delete(url); // re-insert: most recently used
  } else {
    job = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.arrayBuffer();
      })
      .then(data => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
      .catch(e => {
        buffers.delete(url); // a network blip must not silence it for good
        throw e;
      });
  }
  buffers.set(url, job);
  if (buffers.size > BUFFER_CAP) buffers.delete(buffers.keys().next().value);
  return job;
}

/** Before the first click or key the browser keeps the context suspended; a
 *  sound started then would burst out later with everything queued behind
 *  it, so it is dropped, as a rejected play() was. */
function canPlay() {
  const c = context();
  return !c || c.state === 'running';
}

function drop(pool, voice) {
  const i = pool.indexOf(voice);
  if (i >= 0) pool.splice(i, 1);
}

/** A voice in `pool`: plays `loops` times (-1 = until stopped), re-resolving
 *  wildcards and variants per loop. Web Audio where there is one, else an
 *  <audio> element (no compressor, no volume on iOS). */
function startVoice(pool, name, entry, v, loops, type, meta) {
  const voice = { type, v, t: Date.now(), dead: false, ...meta };
  let left = loops;
  const next = () => {
    if (left > 0) left--;
    if (left === 0) return finish();
    play(resolve(name) || entry);
  };
  const finish = () => {
    if (voice.dead) return;
    voice.dead = true;
    drop(pool, voice);
    if (voice.g) voice.g.disconnect();
  };
  let play;

  const c = context();
  if (c) {
    voice.g = c.createGain();
    voice.g.gain.value = gain(type, v);
    voice.g.connect(bus);
    play = e =>
      decode(soundUrl(e))
        .then(buf => {
          if (voice.dead) return;
          const src = c.createBufferSource();
          src.buffer = buf;
          src.connect(voice.g);
          src.onended = () => {
            if (!voice.dead) next();
          };
          voice.src = src;
          src.start();
        })
        .catch(finish);
    voice.setVolume = x => {
      if (!voice.dead) voice.g.gain.setTargetAtTime(x, c.currentTime, 0.02);
    };
    voice.stop = fade => {
      if (voice.dead) return;
      voice.dead = true;
      drop(pool, voice);
      const g = voice.g;
      const when = c.currentTime + (fade ? 0.1 : 0);
      if (fade) g.gain.setTargetAtTime(0, c.currentTime, 0.025);
      try {
        if (voice.src) voice.src.stop(when);
      } catch (e) {
        /* already stopped */
      }
      setTimeout(() => g.disconnect(), fade ? 150 : 0);
    };
  } else {
    const audio = new Audio();
    audio.volume = gain(type, v);
    audio.addEventListener('ended', () => {
      if (!voice.dead) next();
    });
    play = e => {
      audio.src = soundUrl(e);
      audio.play().catch(finish);
    };
    voice.setVolume = x => {
      audio.volume = x;
    };
    voice.stop = () => {
      if (voice.dead) return;
      voice.dead = true;
      drop(pool, voice);
      audio.pause();
    };
  }

  pool.push(voice);
  play(entry);
  return voice;
}

/** Room in a pool for a sound of priority p: true when it may play (a voice
 *  was free or one was stolen), false when every voice outranks it. */
function makeRoom(pool, cap, p) {
  if (pool.length < cap) return true;
  let victim = null;
  pool.forEach(voice => {
    if (!victim || voice.priority < victim.priority || (voice.priority === victim.priority && voice.t < victim.t))
      victim = voice;
  });
  if (victim.priority > p) return false;
  victim.stop(true);
  return true;
}

const capOf = kind => (srMode ? SR_CAPS : CAPS)[kind];

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
    if (!canPlay()) return;
    if (type === 'spell') return playSpell(name, entry, v, loops, p);

    const key = name.toLowerCase();
    const now = Date.now();
    if (lastEffect[key] && now - lastEffect[key] < DEDUP_MS) return;
    lastEffect[key] = now;

    if (!makeRoom(effects, capOf('effect'), p)) return;
    startVoice(effects, name, entry, v, loops, type, { priority: p, name: key });
  });
}

/** The spell pool. Casts land every few seconds and a sound runs 2-4 s, so
 *  the same spell again replaces its own voice instead of stacking; other
 *  spells overlap up to the cap. */
function playSpell(name, entry, v, loops, p) {
  const base = name.replace(/\.(wav|mid|ogg|mp3)$/i, '').toLowerCase();
  const now = Date.now();
  const last = recent[base];
  const n = last && now - last.t < DAMP_MS ? Math.min(last.n + 1, DAMP.length - 1) : 0;
  recent[base] = { t: now, n };
  v = Math.round(v * DAMP[n]);

  const same = spells.find(voice => voice.base === base);
  if (same) {
    if (p < same.priority) return;
    same.stop(true);
  } else if (!makeRoom(spells, capOf('spell'), p)) return;
  startVoice(spells, name, entry, v, loops, 'spell', { priority: p, base });
}

export function stopSound() {
  effects.concat(spells).forEach(voice => voice.stop(false));
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
