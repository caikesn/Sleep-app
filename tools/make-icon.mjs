/**
 * Generates every icon asset in `assets/` from one vector description.
 *
 *     node tools/make-icon.mjs
 *
 * The mark: a small flame on a wick, with a wide ember bloom around it. It is
 * drawn from the same values as `src/theme.ts`, so the icon and the interface
 * are lit by the same lamp rather than merely agreeing about it.
 *
 * There are six outputs and they are not crops of each other — Android's
 * adaptive icon throws away everything outside a centre circle, and a
 * notification icon is a silhouette the system tints itself. Generating them
 * from shared geometry is what stops those drifting apart the next time the
 * mark is adjusted.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { encodePng, canvas, toBytes, hex, mix, blend, addLight, smoothstep } from './png.mjs';

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// Straight from src/theme.ts. Kept as literals rather than imported because
// theme.ts is TypeScript with app imports around it; these five are the ones
// the mark uses, and a mismatch would be visible immediately.
const BG = hex('#14100c');
const BG_LIFT = hex('#2a1d12');
const BG_EDGE = hex('#120e0a');
const EMBER = hex('#ff9d5c');
const EMBER_DEEP = hex('#e8703a');
const WHITE_HOT = hex('#fff3e4');

// One step past theme.ts's deepest ember, for the flame's outer edge only.
// Without it the silhouette meets the background at full brightness and the
// mark looks like a sticker laid on top rather than something lit.
const EMBER_EDGE = hex('#c9522a');

// --- Geometry, in a unit square centred on the mark -------------------------
// y runs downwards, matching the pixel buffer, so "apex" is the most negative.
//
// The mark is the flame alone. It carried a wick underneath at first and that
// was a mistake twice over: a flame on a stalk reads as a matchstick or a
// spoon, and it read as one at 1024px before it ever got small. The name does
// not have to be illustrated — what has to survive is one warm light in a
// large dark field, which is the product in a single image.

const FLAME_APEX = -0.1875;
const FLAME_WIDEST_Y = 0.0875; // 73% of the way down — low, the way a flame is
const FLAME_BASE = 0.1875;
const FLAME_W = 0.072;

/**
 * How far the tip leans off the vertical. Small, and it is not decoration.
 *
 * Two shapes were drawn before this one and both came out as a **water
 * droplet**, which is the single worst thing this mark could evoke. Concave
 * sides alone did not fix it. What actually separates the two is that a drop is
 * perfectly symmetric and fully round at the bottom, and a flame is neither: it
 * pinches where the wick enters it, and it leans, because it is moving.
 */
const LEAN = 0.03;

/**
 * Half-width down the flame, in two pieces that meet at the widest point with
 * matching zero slope — so there is no kink there.
 *
 * Above: `sin` raised past 1, which is what gives concave sides running to a
 * point. Below: `cos` raised below 1, which holds the width through a round
 * shoulder and then pulls it in sharply to nothing at the base.
 */
function flameHalfWidth(y) {
  if (y <= FLAME_APEX || y >= FLAME_BASE) return 0;

  if (y <= FLAME_WIDEST_Y) {
    const s = (y - FLAME_APEX) / (FLAME_WIDEST_Y - FLAME_APEX);
    return FLAME_W * Math.pow(Math.sin((s * Math.PI) / 2), 1.9);
  }

  const u = (y - FLAME_WIDEST_Y) / (FLAME_BASE - FLAME_WIDEST_Y);
  return FLAME_W * Math.pow(Math.cos((u * Math.PI) / 2), 0.55);
}

/** The centreline drifts to one side going up; it is straight at the base. */
function flameCentre(y) {
  const t = Math.max(0, Math.min(1, (FLAME_WIDEST_Y - y) / (FLAME_WIDEST_Y - FLAME_APEX)));
  return LEAN * Math.pow(t, 2.2);
}

/** The hot centre — the bloom radiates from here, not from the mark's centre. */
const CORE = { x: 0.004, y: 0.04 };

function flameInside(x, y) {
  return Math.abs(x - flameCentre(y)) <= flameHalfWidth(y);
}

/**
 * Colour of the flame body: white-hot low and central, ember at its edges.
 *
 * The core is stretched vertically and kept wide. A small round one reads as a
 * specular highlight — light bouncing off a glossy object — instead of the
 * flame being lit from inside, which is the entire point.
 */
function flameColour(x, y) {
  const d = Math.hypot((x - CORE.x) * 1.35, (y - CORE.y) * 0.75);
  if (d < 0.075) return mix(WHITE_HOT, EMBER, smoothstep(0, 0.075, d));
  return mix(EMBER, EMBER_EDGE, smoothstep(0.075, 0.17, d));
}

/**
 * Two falloffs, not one. The tight one is the light the flame actually casts;
 * the wide one is what stops the icon reading as a bright dot pasted onto a
 * dark square. Inverse-square-ish rather than linear, because a linear falloff
 * has a visible edge where it reaches zero.
 *
 * The near falloff is elongated to the flame's own proportions. A circular one
 * leaves the tip poking out of its own light, which is the tell that the glow
 * was added afterwards rather than being cast by the shape.
 */
function bloom(x, y) {
  const near = 1.05 / Math.pow(1 + Math.pow(Math.hypot((x - CORE.x) / 0.85, (y - CORE.y) / 1.45) / 0.15, 2), 1.5);
  const far = 0.32 / Math.pow(1 + Math.pow(Math.hypot(x - CORE.x, y - CORE.y) / 0.46, 2), 1.4);
  return near + far;
}

/**
 * Renders the mark.
 *
 * `scale` is the fraction of the canvas width spanned by one unit of the
 * geometry above. `ground` paints a lit background; without it the mark lands
 * on transparency, which is what the splash and the adaptive foreground need.
 * `silhouette` ignores every colour and emits flat white with the shape's
 * coverage as alpha — the form both Android themed icons and notification
 * icons require, since the system supplies the colour. `mark: false` leaves the
 * flame off entirely, which only the adaptive background layer wants.
 */
function render(size, { scale, ground = false, silhouette = false, glow = true, mark = true }) {
  const px = canvas(size);
  const SS = 4; // 4x4 coverage sampling; every shape here is an edge worth easing
  const half = size / 2;

  const toUnit = (p) => (p + 0.5 - half) / (size * scale);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = y * size + x;
      const ux = toUnit(x);
      const uy = toUnit(y);

      if (ground) {
        const d = Math.hypot(ux - CORE.x, uy - CORE.y);
        blend(px, i, mix(BG_LIFT, BG_EDGE, smoothstep(0.1, 0.95, d)), 1);
      }

      if (glow && !silhouette) {
        /**
         * On a transparent render the bloom has to reach exactly zero before
         * the edge of the file, or it gets chopped there — and a soft glow cut
         * off along a straight line is a **visible square plate** around the
         * mark wherever it is placed on a dark ground. It showed up the moment
         * this asset was put on the sign-in screen.
         *
         * Grounded renders are opaque to the edge and need no such fade.
         */
        const frame = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) / 0.5;
        const vignette = ground ? 1 : 1 - smoothstep(0.72, 1, frame);
        addLight(px, i, EMBER, bloom(ux, uy) * 0.55 * vignette);
      }

      if (!mark) continue;

      // Coverage is supersampled; the fields above are smooth and are not.
      let flame = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const fx = toUnit(x + (sx + 0.5) / SS - 0.5);
          const fy = toUnit(y + (sy + 0.5) / SS - 0.5);
          if (flameInside(fx, fy)) flame += 1;
        }
      }

      if (flame > 0) {
        const coverage = flame / (SS * SS);
        blend(px, i, silhouette ? [255, 255, 255] : flameColour(ux, uy), coverage);
      }
    }
  }

  return px;
}

/**
 * Every asset, as data rather than as a sequence of calls — so that `--preview`
 * below can re-render one by looking it up instead of restating its size and
 * scale. The first version of the preview did restate them, they drifted within
 * the hour, and it went on cheerfully previewing a mark nothing shipped.
 */
const OUTPUTS = [
  // The app icon. iOS rounds the corners itself, so this is drawn full-bleed.
  // The flame is deliberately small in frame: the dark around it is doing as
  // much work as the light is.
  { name: 'icon.png', size: 1024, scale: 1.0, ground: true },

  // Splash: transparent, and smaller in frame — it sits on the splash colour
  // from app.json, and a splash mark that fills its box looks like an error.
  { name: 'splash-icon.png', size: 1024, scale: 0.78 },

  // Android adaptive icon. The system shows only the centre ~66% and
  // parallaxes the two layers against each other, so the flame belongs to
  // exactly one of them. Drawing it on both — which the first version did —
  // puts two flames on the launcher that slide apart as the icon is tilted.
  { name: 'android-icon-foreground.png', size: 1024, scale: 1.35 },
  { name: 'android-icon-background.png', size: 1024, scale: 1.35, ground: true, glow: false, mark: false },

  // Themed icons: alpha only, the launcher supplies the colour.
  { name: 'android-icon-monochrome.png', size: 1024, scale: 1.35, silhouette: true },

  // Android status-bar notification icon: white silhouette, drawn to nearly
  // fill its canvas. It is rendered at 24dp, where the generous margin the
  // other sizes want would leave a mark too small to identify.
  { name: 'notification-icon.png', size: 512, scale: 2.3, silhouette: true },

  // Web favicon, rendered at its real size rather than downscaled from 1024 —
  // the supersampling is what keeps it readable at 64px.
  { name: 'favicon.png', size: 64, scale: 1.0, ground: true },
];

console.log('Wick — icon set');

for (const { name, size, ...opts } of OUTPUTS) {
  writeFileSync(join(ASSETS, name), encodePng(toBytes(render(size, opts), size), size, size));
  console.log(`  ${name.padEnd(30)} ${size}x${size}`);
}

/**
 * `--preview <dir>` re-renders every silhouette asset over a lit ground.
 *
 * White-on-transparent is the only correct form for a themed launcher icon and
 * a status-bar icon, and it is also the one form no image viewer can show you:
 * transparent renders as white, the shape is white, and a completely broken
 * asset looks identical to a correct one. These copies are never shipped — they
 * exist so the silhouettes can be looked at before they are trusted.
 */
const previewAt = process.argv.indexOf('--preview');
if (previewAt !== -1) {
  const dir = process.argv[previewAt + 1];

  for (const { name, size, ...opts } of OUTPUTS.filter((o) => o.silhouette)) {
    const px = render(size, { ...opts, ground: true, glow: false });
    const out = `preview-${name}`;
    writeFileSync(join(dir, out), encodePng(toBytes(px, size), size, size));
    console.log(`  ${out.padEnd(30)} ${size}x${size}  (preview only)`);
  }
}
