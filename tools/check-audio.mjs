import { chromium } from 'playwright';

/**
 * Checks that soundscapes actually stop.
 *
 *   npm run check:audio
 *
 * This exists because the audio layer is the one part of the app that neither
 * `npm test` nor `npm run shoot` can see. `src/audio.ts` imports expo-audio, so
 * Node cannot load it; and a screenshot of a screen playing three loops at once
 * looks exactly like a screenshot of a screen playing none.
 *
 * A leaked player shipped once already: starting a second track cancelled the
 * first one's fade-out, the release only ran when that fade *completed*, and
 * the reference was overwritten a moment later — so every track auditioned
 * piled up on the last, unstoppable. This walks that exact path.
 *
 * On web, expo-audio plays through `new Audio()` elements that are never added
 * to the document, so they cannot be found by querying the DOM. Wrapping the
 * constructor before the app boots is what makes them countable.
 */

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:8081';
const TRACKS = ['Rain', 'Waves', 'Embers'];
/** Comfortably longer than the two-second fade-out. */
const SETTLE_MS = 4000;

const browser = await chromium.launch({
  // Otherwise every play() is refused and each element reports itself paused,
  // which would make a broken build look clean.
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

await page.addInitScript(() => {
  window.__audio = [];
  const Real = window.Audio;
  window.Audio = function (...args) {
    const element = new Real(...args);
    window.__audio.push(element);
    return element;
  };
  window.Audio.prototype = Real.prototype;
});

const report = () =>
  page.evaluate(() => ({
    created: window.__audio.length,
    playing: window.__audio.filter((a) => !a.paused && !a.ended).length,
    audible: window.__audio.filter((a) => !a.paused && !a.ended && a.volume > 0.001).length,
  }));

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual} (expected ${expected})`);
}

try {
  await page.goto(`${BASE}/?preview=meditation&fixture=steady`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, {
    timeout: 120_000,
  });
  await page.waitForTimeout(600);

  for (const track of TRACKS) {
    await page.getByText(track, { exact: true }).first().click();
    await page.waitForTimeout(1200);
  }

  const afterAudition = await report();
  console.log(`after auditioning ${TRACKS.length} tracks: ${JSON.stringify(afterAudition)}`);
  // Only the last one may still be going. Two or three means they stacked.
  check('playing after auditioning', afterAudition.playing, 1);

  // `.last()`, not `.first()`: BELLS has an "Off" pill too and it comes first
  // in the DOM. SOUND is the last section on the screen that has one.
  await page.getByText('Off', { exact: true }).last().click();
  await page.waitForTimeout(SETTLE_MS);

  const afterOff = await report();
  console.log(`after tapping Off:            ${JSON.stringify(afterOff)}`);
  check('playing after Off', afterOff.playing, 0);
  check('audible after Off', afterOff.audible, 0);
} catch (error) {
  failures += 1;
  console.error(`FAILED: ${error.message}`);
} finally {
  await browser.close();
}

process.exit(failures === 0 ? 0 : 1);
