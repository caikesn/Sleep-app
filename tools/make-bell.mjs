import { mkdir, writeFile } from 'node:fs/promises';

/**
 * Generates the meditation bells into assets/audio/.
 *
 *   node tools/make-bell.mjs
 *
 * The .wav files are committed, so this only needs running if the sound itself
 * should change. It exists so the assets are reviewable and reproducible rather
 * than being two opaque binaries someone has to take on trust.
 *
 * A struck bowl is a handful of *inharmonic* partials — ratios slightly off the
 * whole numbers a plucked string would give — each decaying faster than the one
 * below it. That uneven decay is what stops additive synthesis sounding like an
 * organ: the high partials are the strike, the fundamental is the ring.
 */

const RATE = 22050;

/** Ratios and levels roughly modelled on a small singing bowl. */
const PARTIALS = [
  { ratio: 1.0, level: 1.0 },
  { ratio: 2.02, level: 0.5 },
  { ratio: 2.99, level: 0.32 },
  { ratio: 4.12, level: 0.18 },
  { ratio: 5.43, level: 0.1 },
  { ratio: 6.79, level: 0.06 },
];

/** Fade-in, in seconds. Starting a sine at full amplitude is an audible click. */
const ATTACK = 0.008;

function render({ frequency, seconds, decay }) {
  const total = Math.floor(RATE * seconds);
  const samples = new Float64Array(total);

  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    let value = 0;

    for (const [index, partial] of PARTIALS.entries()) {
      // Higher partials die away sooner, which is what makes the strike read as
      // a strike rather than a chord.
      const life = decay / (1 + index * 0.55);
      value += partial.level * Math.exp(-t / life) * Math.sin(2 * Math.PI * frequency * partial.ratio * t);
    }

    const attack = t < ATTACK ? t / ATTACK : 1;
    // A final taper to true silence, so the file can't end on a non-zero sample
    // and click on the way out.
    const tail = Math.min(1, ((seconds - t) / 0.25) ** 2);
    samples[i] = value * attack * Math.min(1, tail);
  }

  return samples;
}

function toWav(samples) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  // Leaves headroom rather than normalising to full scale — this plays quietly
  // in a dark room, not at a mastering level.
  const gain = peak > 0 ? 0.62 / peak : 0;

  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] * gain));
    data.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // format: PCM
  header.writeUInt16LE(1, 22); // channels: mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}

const BELLS = [
  // Interval: higher and shorter, so it marks time without ending anything.
  { file: 'bell.wav', frequency: 392.0, seconds: 2.6, decay: 0.85 },
  // End: lower and longer. The drop in pitch is what makes it read as final.
  { file: 'bell-end.wav', frequency: 261.63, seconds: 3.6, decay: 1.25 },
];

await mkdir('assets/audio', { recursive: true });

for (const bell of BELLS) {
  const wav = toWav(render(bell));
  await writeFile(`assets/audio/${bell.file}`, wav);
  console.log(`assets/audio/${bell.file}  ${(wav.length / 1024).toFixed(0)} KB  ${bell.frequency} Hz`);
}
