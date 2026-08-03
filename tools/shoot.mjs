import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Screenshots app screens against the running Expo web server.
 *
 *   npm run shoot -- progress:veteran progress:empty tonight:steady
 *
 * Each argument is `screen:fixture` (see src/preview), optionally followed by
 * `@` and a pipe-separated list of button labels to tap first:
 *
 *   npm run shoot -- "meditation:steady@Breathe|Continue|I've turned"
 *
 * Taps are what make states behind a button reachable — a running timer, a
 * breathing pacer — without wiring test-only routes into the app itself.
 * Output lands in .screenshots/, which is gitignored.
 *
 * This is react-native-web in Chromium, not a device. It catches layout that
 * overflows, wraps or clips; it does not tell you how shadows, fonts or
 * safe-area insets will land on a real phone.
 */

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:8081';

/**
 * How long a screen is left to settle before the first shot, in milliseconds.
 *
 * The default lands on the **dark end of every ambient loop**. Anything driven
 * by `useAmbientLoop` starts at 0, and the glows on Tonight and Modules
 * interpolate opacity from about 0.45 there — so a default shot shows them at
 * half strength and they read as broken or missing. Twice that was chased as a
 * positioning bug and both times it was capture phase.
 *
 *     SETTLE=5200 npm run shoot -- tonight:steady
 *
 * One half-breath is ~4.6s, so that lands near the top. Overridable rather than
 * simply raised because five seconds a screen is a slow default for the shots
 * that have nothing breathing in them, which is most of them.
 */
const SETTLE = Number(process.env.SETTLE ?? 600);
const OUT = '.screenshots';
const shots = process.argv.slice(2);

if (shots.length === 0) {
  console.error('usage: npm run shoot -- progress:veteran [tonight:steady ...]');
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  // iPhone 13 logical size. Scale factor 2 rather than the real 3, because a
  // tall screen at 3x produces images too large to read back usefully.
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  // The app is dark by design; a light-scheme default would flash white.
  colorScheme: 'dark',
});

/**
 * Playwright's `fullPage` is useless here: react-native-web pins the root and
 * scrolls inside it, so the document itself is always one viewport tall. This
 * finds the actual scroll container and steps down it a screen at a time.
 */
async function captureScrolled(page, stem) {
  const files = [];
  const scroller = await page.evaluateHandle(() => {
    const nodes = Array.from(document.querySelectorAll('div'));
    return nodes.find((n) => n.scrollHeight > n.clientHeight + 40) ?? null;
  });

  const height = await scroller.evaluate((n) => (n ? n.scrollHeight : 0));
  const view = await scroller.evaluate((n) => (n ? n.clientHeight : 0));
  const pages = height > 0 ? Math.min(Math.ceil(height / view), 8) : 1;

  for (let i = 0; i < pages; i += 1) {
    if (i > 0) {
      // Assigning scrollTop directly. `scrollTo({ behavior: 'instant' })` is
      // silently ignored on this element — measured, not assumed.
      await scroller.evaluate((n, top) => {
        n.scrollTop = top;
      }, i * view);
      await page.waitForTimeout(250);
    }
    // Expo re-mounts its dev overlay as the page settles, so it has to be
    // removed immediately before each shot rather than once on load.
    await page.evaluate(() => {
      document.querySelectorAll('body > div:not(#root)').forEach((n) => n.remove());
    });

    const file = pages === 1 ? `${stem}.png` : `${stem}-${i + 1}.png`;
    await page.screenshot({ path: file });
    files.push(file);
  }

  return files;
}

let failures = 0;

for (const shot of shots) {
  const [target, tapList = ''] = shot.split('@');
  const [screen, fixture = 'steady'] = target.split(':');
  const taps = tapList.split('|').filter(Boolean);
  // Keeps a tapped shot from overwriting the untapped one of the same screen.
  const suffix = taps.length ? `-${taps.map((t) => t.split(' ')[0].toLowerCase()).join('-')}` : '';

  const page = await context.newPage();
  const problems = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(msg.text());
  });
  page.on('pageerror', (error) => problems.push(String(error)));

  try {
    await page.goto(`${BASE}/?preview=${screen}&fixture=${fixture}`, {
      waitUntil: 'networkidle',
      timeout: 120_000,
    });
    // Metro's first compile is slow and the harness renders nothing until the
    // seeded cache lands, so wait for real content rather than a fixed delay.
    await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, {
      timeout: 120_000,
    });
    await page.waitForTimeout(SETTLE);

    for (const tap of taps) {
      // Substring match on visible text: these are button labels as a person
      // reads them, so the caller doesn't need to know the DOM.
      await page.getByText(tap, { exact: false }).first().click({ timeout: 15_000 });
      await page.waitForTimeout(400);
    }
    // A pacer or timer needs a moment of running before it shows anything but
    // its opening frame.
    if (taps.length) await page.waitForTimeout(2500);

    const files = await captureScrolled(page, path.join(OUT, `${screen}-${fixture}${suffix}`));
    console.log(
      `${files.join('  ')}${problems.length ? `  (${problems.length} console errors)` : ''}`
    );
    for (const problem of problems.slice(0, 5)) console.log(`    ${problem}`);
  } catch (error) {
    failures += 1;
    console.error(`FAILED ${shot}: ${error.message}`);
  } finally {
    await page.close();
  }
}

await browser.close();
process.exit(failures === 0 ? 0 : 1);
