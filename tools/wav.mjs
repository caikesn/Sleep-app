/**
 * Mono 16-bit PCM WAV encoding, shared by the bell and ambience generators.
 *
 * Uncompressed on purpose: MP3 and AAC encoders are not something Node can do
 * without pulling in a binary, and every asset here is either a few seconds
 * long or a short loop, so the size is affordable. It also means the committed
 * files are exactly what the generator produced, with no encoder in between.
 */

export const RATE = 22050;

/** Scales so the loudest sample sits at `target`. Right for one-shot sounds. */
export function normalisePeak(samples, target) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak === 0) return samples;

  const gain = target / peak;
  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;
  return samples;
}

/**
 * Scales to a target RMS, then pulls back if that pushed the peak too high.
 *
 * Ambience has to be matched by loudness, not by peak: crackling embers have a
 * far higher peak-to-average ratio than brown noise, so peak-matching the two
 * would leave the embers sounding half as loud as everything else.
 */
export function normaliseRms(samples, target, ceiling = 0.9) {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  const rms = Math.sqrt(sum / samples.length);
  if (rms === 0) return samples;

  let gain = target / rms;
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak * gain > ceiling) gain = ceiling / peak;

  for (let i = 0; i < samples.length; i += 1) samples[i] *= gain;
  return samples;
}

/** Expects samples already in [-1, 1]. Anything outside is clamped, not wrapped. */
export function encodeWav(samples, rate = RATE) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
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
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}
