// Background ambience from the server: looping layers (rain, wind, a city)
// and one music track, driven by the 'ambience' rpc frame.
//
// The frame carries the full state, sent on every change:
//   ambience(layers, music)
//   layers: library names, e.g. ["ambient/rain", "ambient/thunder"]
//   music:  a library name, or "" for none
// What is new fades in, what is gone fades out, what stays keeps playing.
//
// WebAudio, not <audio loop>: a looping AudioBufferSourceNode is gapless on
// every engine, Safari and iOS included, where HTMLAudio leaves a click or a
// pause at the seam. "ambient/thunder" is not a loop but random claps, one of
// the ambient/thunder* sounds every 8-25 s while the layer is on.
//
// This layer is independent of the MSP effect channel in sound.js: a
// !!SOUND never stops it and it never stops a !!SOUND. Volume: master *
// ambient for layers, master * music for the track, live with the sliders.
// Mute, an 'msp' frame with false and a new connection stop everything.

import $ from 'jquery';
import { loadLibrary, findSound, findSounds, soundUrl, gain, getSoundPrefs, onSoundPrefs } from './sound.js';

const LAYER_IN = 2.5;
const LAYER_OUT = 2.5;
const MUSIC_IN = 2;
const MUSIC_OUT = 3;
const THUNDER = 'ambient/thunder';
const THUNDER_RE = /^ambient\/thunder/i;
const THUNDER_MIN_MS = 8000;
const THUNDER_MAX_MS = 25000;

let ctx = null;
let ambientBus = null; // GainNode: master * ambient
let musicBus = null; // GainNode: master * music

// What the server asked for last; replayed after an unmute.
let wanted = { layers: [], music: '' };
// The server turned MSP off on this connection: its frames play nothing.
let serverOff = false;

const layers = new Map(); // name -> track
let musicTrack = null; // track with .name
const fading = new Set(); // tracks fading out, stopped when the fade ends

const buffers = new Map(); // file -> Promise<AudioBuffer|null>

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      ctx = new Ctx();
    } catch (e) {
      return null;
    }
    ambientBus = ctx.createGain();
    musicBus = ctx.createGain();
    ambientBus.connect(ctx.destination);
    musicBus.connect(ctx.destination);
    applyVolumes();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Browsers start audio only after a key or a click on the page: until then
// the context is suspended and the scheduled sound waits, then starts.
['keydown', 'pointerdown', 'touchend'].forEach(type =>
  window.addEventListener(
    type,
    () => {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    { capture: true, passive: true }
  )
);

function applyVolumes() {
  if (!ctx) return;
  ambientBus.gain.value = gain('ambient');
  musicBus.gain.value = gain('music');
}

/** Fetch and decode a library file once. Null on any failure. */
function load(entry) {
  const url = soundUrl(entry);
  if (!buffers.has(url)) {
    const p = fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      // The callback form: older Safari has no promise from decodeAudioData.
      .then(data => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
      .catch(() => null);
    buffers.set(url, p);
  }
  return buffers.get(url);
}

/** Ramp a track's own gain to `to` over `secs` from where it is now. */
function ramp(track, to, secs) {
  const g = track.gain.gain;
  const now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(to, now + secs);
}

/** A new track on a bus: its gain starts at 0, the sound fades in once loaded. */
function newTrack(bus) {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.connect(bus);
  return { gain: g, sources: new Set(), timer: null, stopped: false };
}

function playBuffer(track, buf, loop) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = loop;
  src.connect(track.gain);
  src.onended = () => track.sources.delete(src);
  track.sources.add(src);
  src.start();
}

function startLoop(entry, bus, fadeIn) {
  const track = newTrack(bus);
  load(entry).then(buf => {
    if (!buf || track.stopped) return;
    playBuffer(track, buf, true);
    ramp(track, 1, fadeIn);
  });
  return track;
}

function startThunder() {
  const track = newTrack(ambientBus);
  ramp(track, 1, LAYER_IN);
  const next = () => {
    track.timer = setTimeout(clap, THUNDER_MIN_MS + Math.random() * (THUNDER_MAX_MS - THUNDER_MIN_MS));
  };
  const clap = () => {
    if (track.stopped) return;
    const claps = findSounds(THUNDER_RE);
    const entry = claps[Math.floor(Math.random() * claps.length)];
    load(entry).then(buf => {
      if (buf && !track.stopped) playBuffer(track, buf, false);
    });
    next();
  };
  next();
  return track;
}

function stopNow(track) {
  track.stopped = true;
  clearTimeout(track.timer);
  track.sources.forEach(src => {
    try {
      src.stop();
    } catch (e) {
      /* never started */
    }
  });
  track.sources.clear();
  track.gain.disconnect();
  fading.delete(track);
}

function fadeOut(track, secs) {
  track.stopped = true;
  clearTimeout(track.timer);
  fading.add(track);
  ramp(track, 0, secs);
  setTimeout(() => stopNow(track), secs * 1000 + 100);
}

function stopEverything() {
  layers.forEach(stopNow);
  layers.clear();
  if (musicTrack) stopNow(musicTrack);
  musicTrack = null;
  [...fading].forEach(stopNow);
}

/** Bring what plays in line with `wanted`. */
function apply() {
  if (serverOff || getSoundPrefs().mute) return;
  // A layer at volume 0 is not fetched and not played; raising the slider
  // brings it back through onSoundPrefs -> apply().
  const names = gain('ambient') === 0 ? [] : wanted.layers;
  const music = gain('music') === 0 ? '' : wanted.music;
  const snapshot = wanted;
  if (!names.length && !music && !layers.size && !musicTrack) return;

  loadLibrary().then(() => {
    // The state may have changed while the library loaded.
    if (serverOff || getSoundPrefs().mute || wanted !== snapshot) return;
    if (!audio()) return;

    layers.forEach((track, name) => {
      if (!names.includes(name)) {
        layers.delete(name);
        fadeOut(track, LAYER_OUT);
      }
    });
    names.forEach(name => {
      if (layers.has(name)) return;
      if (name === THUNDER) {
        if (findSounds(THUNDER_RE).length) layers.set(name, startThunder());
        return;
      }
      const entry = findSound(name);
      if (entry) layers.set(name, startLoop(entry, ambientBus, LAYER_IN));
    });

    if (musicTrack && musicTrack.name !== music) {
      fadeOut(musicTrack, MUSIC_OUT);
      musicTrack = null;
    }
    if (music && !musicTrack) {
      const entry = findSound(music);
      if (entry) {
        musicTrack = startLoop(entry, musicBus, MUSIC_IN);
        musicTrack.name = music;
      }
    }
  });
}

function setAmbience(list, music) {
  const names = Array.isArray(list) ? [...new Set(list.filter(n => typeof n === 'string' && n))] : [];
  wanted = { layers: names, music: typeof music === 'string' ? music : '' };
  apply();
}

onSoundPrefs(prefs => {
  if (prefs.mute) stopEverything();
  else {
    applyVolumes();
    apply();
  }
});

$(document).ready(function () {
  $('#rpc-events')
    .on('rpc-ambience', function (e, list, music) {
      setAmbience(list, music);
    })
    .on('rpc-msp', function (e, on) {
      serverOff = !on;
      if (serverOff) {
        wanted = { layers: [], music: '' };
        stopEverything();
      }
    })
    .on('rpc-version', function () {
      // A new connection: nothing from the old one keeps playing.
      serverOff = false;
      wanted = { layers: [], music: '' };
      stopEverything();
    });
});
