/* The exit and room sounds, made in the browser with the same recipes as the
 * desktop client's tools/make_exit_tones.py and tools/make_room_sounds.py: a
 * plucked string (Karplus-Strong) per exit, and wood, bubble, glass and
 * metal for what a room shows. The noise comes from a seeded generator, so a
 * sound is the same every time, though not sample for sample the desktop's.
 * Each returns [left, right] Float32Arrays at RATE. */
export const RATE = 44100;

/* A small seeded generator (mulberry32): uniform in [lo, hi). */
function rng(seed) {
  let a = seed >>> 0;
  return (lo, hi) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return lo + (hi - lo) * r;
  };
}

/* ---- exits ---------------------------------------------------------------- */

function pluck(rand, freq, { length = 0.32, glideTo = null, pan = 0, volume = 0.6, bright = 0.55 } = {}) {
  const n = Math.floor(RATE * length);
  const out = new Float64Array(n);
  let period = RATE / freq;
  const size = Math.floor(period) + 2;
  // Noise smoothed by the two-tap filter [bright, 1 - bright].
  const noise = Array.from({ length: size }, () => rand(-1, 1));
  const buf = noise.map((v, k) => bright * v + (1 - bright) * (k > 0 ? noise[k - 1] : 0));
  let pos = 0;
  let last = 0;
  for (let i = 0; i < n; i++) {
    if (glideTo) {
      const f = freq * Math.pow(glideTo / freq, Math.min(1, i / (RATE * 0.08)));
      period = RATE / f;
    }
    const idx = Math.floor(pos) % size;
    const nxt = (idx + 1) % size;
    let sample = 0.5 * (buf[idx] + buf[nxt]);
    sample = 0.996 * (0.6 * sample + 0.4 * last);
    last = sample;
    buf[idx] = sample;
    out[i] = sample;
    pos += size / period;
  }
  for (let i = 0; i < n; i++) out[i] *= Math.exp((-i / RATE) * 9) * volume;
  const clickN = Math.floor(RATE * 0.003);
  for (let i = 0; i < clickN; i++) out[i] += rand(-1, 1) * 0.25 * (1 - i / (clickN - 1));
  const l = Math.sqrt((1 - pan) / 2);
  const r = Math.sqrt((1 + pan) / 2);
  return [out.map(v => v * l), out.map(v => v * r)];
}

/* Three short echoes, then 0.15 s of tail. */
function roomReverb([left, right], mix = 0.15) {
  const tail = Math.floor(RATE * 0.15);
  const echo = x => {
    const y = new Float64Array(x.length + tail);
    y.set(x);
    for (const [delay, gain] of [
      [0.019, 0.5],
      [0.029, 0.4],
      [0.043, 0.3],
    ]) {
      const d = Math.floor(RATE * delay);
      for (let i = d; i < x.length; i++) y[i] += x[i - d] * gain * mix;
    }
    return y;
  };
  return [echo(left), echo(right)];
}

const EXITS = {
  north: rand => pluck(rand, 988),
  south: rand => pluck(rand, 494),
  east: rand => pluck(rand, 784, { pan: 0.8 }),
  west: rand => pluck(rand, 784, { pan: -0.8 }),
  up: rand => pluck(rand, 659, { glideTo: 988 }),
  down: rand => pluck(rand, 988, { glideTo: 659 }),
};

/* ---- room ----------------------------------------------------------------- */

const timeline = length => Array.from({ length: Math.floor(RATE * length) }, (_, i) => i / RATE);
const stereo = x => [x.map(v => v * Math.SQRT1_2), x.map(v => v * Math.SQRT1_2)];

function wood(rand, freq, length = 0.18, vol = 0.7) {
  const t = timeline(length);
  return stereo(
    Float64Array.from(t, s => {
      const body =
        Math.sin(2 * Math.PI * freq * s) * Math.exp(-s * 35) + 0.5 * Math.sin(2 * Math.PI * freq * 2.7 * s) * Math.exp(-s * 60);
      const click = rand(-1, 1) * Math.exp(-s * 400) * 0.4;
      return (body + click) * vol;
    })
  );
}

function bubble(f0, f1, length, vol) {
  const t = timeline(length);
  let phase = 0;
  return stereo(
    Float64Array.from(t, s => {
      const f = f0 * Math.pow(f1 / f0, s / length);
      phase += f;
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, s / length)), 1.5);
      return Math.sin((2 * Math.PI * phase) / RATE) * env * vol;
    })
  );
}

function glass(freq, length = 0.09, vol = 0.3) {
  const t = timeline(length);
  return stereo(
    Float64Array.from(t, s => {
      const x = Math.sin(2 * Math.PI * freq * s) * Math.exp(-s * 60) + 0.4 * Math.sin(2 * Math.PI * freq * 2.3 * s) * Math.exp(-s * 90);
      return x * Math.min(1, s / 0.001) * vol;
    })
  );
}

function metal(freq, length = 0.15, vol = 0.35, decay = 30) {
  const t = timeline(length);
  const partials = [
    [1.0, 1.0],
    [2.76, 0.45],
    [5.4, 0.2],
    [8.93, 0.08],
  ];
  return stereo(
    Float64Array.from(t, s => {
      let x = 0;
      for (const [ratio, amp] of partials) x += amp * Math.sin(2 * Math.PI * freq * ratio * s) * Math.exp(-s * decay * (1 + ratio * 0.3));
      return x * Math.min(1, s / 0.0015) * vol;
    })
  );
}

/* Parts [startSeconds, [left, right]] mixed into one, with 0.1 s after. */
function seq(parts) {
  const total = Math.floor(RATE * (Math.max(...parts.map(([at, s]) => at + s[0].length / RATE)) + 0.1));
  const left = new Float64Array(total);
  const right = new Float64Array(total);
  for (const [at, [l, r]] of parts) {
    const i = Math.floor(RATE * at);
    for (let k = 0; k < l.length && i + k < total; k++) {
      left[i + k] += l[k];
      right[i + k] += r[k];
    }
  }
  return [left, right];
}

const ROOM = {
  player: rand => seq([
    [0, wood(rand, 700)],
    [0.1, wood(rand, 900)],
  ]),
  mob: () => seq([[0, bubble(380, 220, 0.18, 0.7)]]),
  item: () => seq([[0, glass(1900, 0.12, 0.4)]]),
  target: () => seq([0, 1, 2].map(i => [i * 0.055, metal(1650)])),
};

/* Scale so the loudest sample of either channel is peak. */
function normalise([left, right], peak) {
  let max = 0;
  for (const v of left) max = Math.max(max, Math.abs(v));
  for (const v of right) max = Math.max(max, Math.abs(v));
  const k = max ? peak / max : 1;
  return [Float32Array.from(left, v => v * k), Float32Array.from(right, v => v * k)];
}

/* "exits/north" or "room/item" as [left, right], or null. */
export function makeSound(path) {
  const [group, name] = path.split('/');
  if (group === 'exits' && EXITS[name]) return normalise(roomReverb(EXITS[name](rng(7))), 0.8);
  if (group === 'room' && ROOM[name]) return normalise(ROOM[name](rng(3)), name === 'item' ? 0.98 : 0.8);
  return null;
}
