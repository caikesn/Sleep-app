import { mkdir, writeFile } from 'node:fs/promises';
import { RATE, encodeWav, normaliseRms } from './wav.mjs';

/**
 * Generates the background soundscapes into assets/audio/.
 *
 *   node tools/make-ambience.mjs
 *
 * These are synthesised, not recorded. Noise-based ambience — brown noise,
 * rain, a fan — is genuinely what synthesis is good at, because the real thing
 * *is* filtered noise. Waves and embers are decent. None of them will beat a
 * real field recording, and the catalog in src/soundscapes.ts is arranged so
 * any one of them can be swapped for a recorded file without touching anything
 * else.
 *
 * Every track is a short loop that has to join back to its own start without an
 * audible seam. Two ways of getting there, both used below:
 *
 *  - Noise is statistically stationary, so the head can be crossfaded against
 *    the material that would have followed the tail (`seamless`).
 *  - Tones can be made to loop *exactly*, by snapping every frequency to a
 *    whole number of cycles per loop, which needs no crossfade at all.
 */

const LOOP_SECONDS = 20;
const CROSSFADE_SECONDS = 0.75;
const N = Math.floor(RATE * LOOP_SECONDS);
const FADE = Math.floor(RATE * CROSSFADE_SECONDS);

/* ── building blocks ────────────────────────────────────────────────────── */

/** One-pole low-pass. Returns a stateful per-sample function. */
function lowPass(cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  return (x) => {
    y += a * (x - y);
    return y;
  };
}

/** One-pole high-pass, as the part of the signal the low-pass throws away. */
function highPass(cutoff) {
  const low = lowPass(cutoff);
  return (x) => x - low(x);
}

const white = () => Math.random() * 2 - 1;

/** A leaky integrator over white noise — the standard brown-noise recipe. */
function brownSource() {
  let last = 0;
  return () => {
    last = (last + 0.02 * white()) / 1.02;
    return last * 3.5;
  };
}

/**
 * Renders `N + FADE` samples and folds the overhang back over the start, so the
 * end of the loop runs into the beginning exactly as the source would have.
 */
function seamless(render) {
  const src = render(N + FADE);
  const out = src.slice(0, N);

  for (let j = 0; j < FADE; j += 1) {
    // Raised cosine: equal-power enough for noise, and flat at both ends so
    // neither join has a corner in it.
    const t = 0.5 - 0.5 * Math.cos((Math.PI * j) / FADE);
    out[j] = src[j] * t + src[N + j] * (1 - t);
  }

  return out;
}

/** Nearest frequency that completes a whole number of cycles per loop. */
const snap = (hz) => Math.round(hz * LOOP_SECONDS) / LOOP_SECONDS;

/* ── the soundscapes ────────────────────────────────────────────────────── */

function brown(length) {
  const source = brownSource();
  const soften = lowPass(1400);
  const out = new Float64Array(length);
  for (let i = 0; i < length; i += 1) out[i] = soften(source());
  return out;
}

function rain(length) {
  // Hiss is most of it; the brown underneath is what stops it sounding like a
  // radio between stations.
  const hissHigh = highPass(1100);
  const hissLow = lowPass(7500);
  const body = brownSource();
  const bodyLow = lowPass(500);

  const out = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / RATE;
    // Slow swell, so it never sits at exactly one level. Whole cycles per loop.
    const swell = 1 + 0.16 * Math.sin(2 * Math.PI * snap(0.15) * t);
    out[i] = hissLow(hissHigh(white())) * 0.85 * swell + bodyLow(body()) * 0.4;
  }
  return out;
}

function waves(length) {
  const wash = lowPass(1600);
  const crestHigh = highPass(2500);
  const crestLow = lowPass(7000);
  // Four swells per loop, so the envelope lands back at its start.
  const period = LOOP_SECONDS / 4;

  const out = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    const phase = ((i / RATE) % period) / period;
    // Skewing the phase before the sine puts the peak a third of the way in:
    // a wave arrives faster than it recedes.
    const env = Math.sin(Math.PI * phase ** 0.55) ** 2;
    out[i] = wash(white()) * (0.22 + 0.78 * env) + crestLow(crestHigh(white())) * env ** 3 * 0.55;
  }
  return out;
}

function embers(length) {
  const bedSource = brownSource();
  const bedLow = lowPass(260);
  const snap_ = highPass(1500);

  /** Crackles per second. Low enough to stay sparse and not become static. */
  const density = 7 / RATE;
  const active = [];

  const out = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    if (Math.random() < density) {
      active.push({
        start: i,
        // 4–30ms. Short ones read as ticks, long ones as pops.
        tau: ((4 + Math.random() * 26) / 1000) * RATE,
        amp: 0.25 + Math.random() * 0.75,
      });
    }

    let crackle = 0;
    for (let k = active.length - 1; k >= 0; k -= 1) {
      const event = active[k];
      const decay = Math.exp(-(i - event.start) / event.tau);
      if (decay < 0.001) {
        active.splice(k, 1);
        continue;
      }
      crackle += event.amp * decay * white();
    }

    out[i] = bedLow(bedSource()) * 0.55 + snap_(crackle) * 0.5;
  }
  return out;
}

function drone() {
  // A low root with its fifth and octaves. Each partial is doubled a fraction
  // sharp so the pair beats slowly against itself — that slow wobble is what
  // makes a stack of sines sound like an instrument rather than a test tone.
  const partials = [
    { hz: 110, level: 1.0 },
    { hz: 164.81, level: 0.5 },
    { hz: 220, level: 0.34 },
    { hz: 329.63, level: 0.16 },
    { hz: 440, level: 0.08 },
  ];

  const warm = lowPass(2200);
  // Two periods rendered, the second kept. Every frequency here completes whole
  // cycles per loop, so the signal is exactly periodic — but the filter is not:
  // it starts from silence and takes time to reach its steady state, which left
  // the loop quiet at the start and full at the end, and that step was audible.
  const total = N * 2;
  const buffer = new Float64Array(total);

  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    let value = 0;

    for (const [index, partial] of partials.entries()) {
      // One LFO cycle per loop for the first partial, two for the second, and
      // so on — all whole numbers, so they all land back where they started.
      const swell = 1 - 0.25 * Math.sin(2 * Math.PI * ((index + 1) / LOOP_SECONDS) * t);
      value +=
        partial.level *
        swell *
        (Math.sin(2 * Math.PI * snap(partial.hz) * t) +
          0.6 * Math.sin(2 * Math.PI * snap(partial.hz + 0.35) * t));
    }

    buffer[i] = warm(value);
  }

  return buffer.slice(N);
}

/* ── render ─────────────────────────────────────────────────────────────── */

const TRACKS = [
  { file: 'amb-brown.wav', render: () => seamless(brown) },
  { file: 'amb-rain.wav', render: () => seamless(rain) },
  { file: 'amb-waves.wav', render: () => seamless(waves) },
  { file: 'amb-embers.wav', render: () => seamless(embers) },
  // Exactly periodic, so it needs no crossfade at all.
  { file: 'amb-drone.wav', render: drone },
];

/**
 * The step the loop takes at its join, against the largest step the track takes
 * anywhere else. At or below 1.0 the join is doing nothing the signal does not
 * already do somewhere, so there is nothing to hear.
 *
 * Two more obvious measures are both wrong here, and both were tried first.
 * Comparing the join to the *average* step flatters hiss, whose steps are
 * enormous by nature, and libels a drone, whose steps are tiny. Comparing it to
 * the peak amplitude does exactly the reverse — and reads worst of all at a
 * loop point where every partial happens to be at its steepest, which is
 * precisely where a tone built from sines starting at phase zero will loop.
 */
function seamRatio(samples) {
  let largest = 0;
  for (let i = 1; i < samples.length; i += 1) {
    largest = Math.max(largest, Math.abs(samples[i] - samples[i - 1]));
  }
  const join = Math.abs(samples[0] - samples[samples.length - 1]);
  return largest === 0 ? 0 : join / largest;
}

await mkdir('assets/audio', { recursive: true });

for (const track of TRACKS) {
  const samples = normaliseRms(track.render(), 0.11);

  let peak = 0;
  let sum = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
    sum += sample * sample;
  }

  const wav = encodeWav(samples);
  await writeFile(`assets/audio/${track.file}`, wav);

  console.log(
    `${track.file.padEnd(16)} ${(wav.length / 1024).toFixed(0).padStart(5)} KB` +
      `  rms ${Math.sqrt(sum / samples.length).toFixed(3)}` +
      `  peak ${peak.toFixed(3)}` +
      `  seam ${seamRatio(samples).toFixed(2)} of largest step`
  );
}
