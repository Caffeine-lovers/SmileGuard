// Generates an original, royalty-free upbeat 120 BPM track -> public/music.wav
// Structure (18 bars @ 2s/bar = 36s): 2-bar intro, drop on bar 3, final bar = ending hit.
// Progression: C – G – Am – F (I–V–vi–IV).
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BARS = 18;
const DUR = BARS * BAR;
const N = Math.floor(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  [60, 64, 67], // C
  [59, 62, 67], // G/B
  [57, 60, 64], // Am
  [57, 60, 65], // F/A
];
const ROOTS = [36, 43, 45, 41];
const MELODY = [ // [beatOffsetInBar, midi, lengthBeats] – one 4-bar phrase
  [[0, 72, 0.5], [0.5, 74, 0.5], [1, 76, 1], [2.5, 79, 0.5], [3, 76, 1]],
  [[0, 74, 0.5], [0.5, 76, 0.5], [1, 74, 1], [2, 71, 1], [3, 67, 1]],
  [[0, 72, 0.5], [0.5, 76, 0.5], [1, 81, 1], [2.5, 79, 0.5], [3, 76, 1]],
  [[0, 77, 0.5], [0.5, 76, 0.5], [1, 74, 0.5], [1.5, 72, 0.5], [2, 74, 2]],
];

let seed = 1;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

function add(t0, dur, fn, gain = 1, pan = 0) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(dur * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < len && s0 + i < N; i++) {
    const v = fn(i / SR, i);
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

const kick = (t) => {
  const f = 50 + 120 * Math.exp(-t * 35);
  return Math.sin(2 * Math.PI * f * t - 0) * Math.exp(-t * 7) * 0.9;
};
const clap = (t) => noise() * Math.exp(-t * 22) * 0.35;
const hat = (t) => noise() * Math.exp(-t * 60) * 0.18;
const openHat = (t) => noise() * Math.exp(-t * 14) * 0.12;

function saw(f, t) {
  return 2 * ((f * t) % 1) - 1;
}
function supersaw(f, t) {
  return (saw(f, t) + saw(f * 1.006, t + 0.13) + saw(f * 0.994, t + 0.37)) / 3;
}

// simple one-pole lowpass per voice
function lp(fn, cutoff) {
  let y = 0;
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  return (t, i) => (y += a * (fn(t, i) - y));
}

for (let bar = 0; bar < BARS; bar++) {
  const t = bar * BAR;
  const ci = bar % 4;
  const intro = bar < 2;
  const outro = bar === BARS - 1;

  if (outro) {
    // Final hit: kick + clap + big sustained chord
    add(t, 1, kick, 1);
    add(t, 0.4, clap, 1);
    for (const m of [...CHORDS[0], 72, 48]) {
      add(t, BAR, lp((tt) => supersaw(midi(m), tt) * Math.exp(-tt * 1.4), 3000), 0.09, (m % 3) - 1 > 0 ? 0.3 : -0.3);
    }
    continue;
  }

  for (let b = 0; b < 4; b++) {
    const bt = t + b * BEAT;
    if (!intro) add(bt, 0.5, kick, 1);
    if (!intro && (b === 1 || b === 3)) add(bt, 0.3, clap, 1, 0.1);
    add(bt + BEAT / 2, 0.25, openHat, intro ? 0.6 : 1, 0.25);
    add(bt, 0.06, hat, intro ? 0.5 : 0.8, -0.25);
    add(bt + BEAT / 4, 0.05, hat, 0.5, -0.2);
    add(bt + (3 * BEAT) / 4, 0.05, hat, 0.5, -0.2);

    // Bass: offbeat pumping 8ths
    if (!intro) {
      const f = midi(ROOTS[ci]);
      add(bt + BEAT / 2, BEAT / 2 * 0.9, lp((tt) => saw(f, tt) * Math.min(1, tt * 200) * Math.exp(-tt * 4), 600), 0.35);
    }

    // Chord stabs, sidechain-feel (on the offbeats)
    const cutoff = intro ? 900 + bar * 600 + b * 150 : 3200;
    for (const m of CHORDS[ci]) {
      add(bt + BEAT / 2, BEAT * 0.45, lp((tt) => supersaw(midi(m), tt) * Math.exp(-tt * 6), cutoff), 0.08, m % 2 ? 0.35 : -0.35);
    }
  }

  // Pluck melody from the drop onward
  if (!intro) {
    for (const [off, m, len] of MELODY[ci]) {
      add(t + off * BEAT, len * BEAT, (tt) => {
        const f = midi(m);
        const env = Math.exp(-tt * 5);
        return (Math.sin(2 * Math.PI * f * tt) * 0.6 + saw(f, tt) * 0.25 + Math.sin(4 * Math.PI * f * tt) * 0.15) * env;
      }, 0.16, 0.15);
    }
  }

  // Riser into the drop
  if (bar === 1) {
    add(t, BAR, (tt) => noise() * (tt / BAR) ** 2 * 0.25, 1);
  }
}

// Master: soft clip + fade out last 1.5s
let peak = 0;
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / (1.5 * SR));
  L[i] = Math.tanh(L[i] * 1.1) * fade;
  R[i] = Math.tanh(R[i] * 1.1) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;

const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * norm * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * norm * 32767), 46 + i * 4);
}

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "music.wav");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`Wrote ${out} (${DUR.toFixed(1)}s)`);
