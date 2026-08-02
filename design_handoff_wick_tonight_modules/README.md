# Handoff: Wick — Tonight "burning wick" hero + Modules promoted card

## Overview

Two accepted designs for the Wick sleep app (`caikesn/Sleep-app`, branch `main`, Expo / React Native):

1. **2a — Tonight screen, "the wick burns down."** The Tonight tab's hero is replaced with the app's flame mark rendered large and bright at the start of the evening, shrinking and dimming as bedtime approaches. A warm bloom sits behind it, a soft cast-light ellipse sways underneath it, embers drift upward, and a night veil darkens the whole screen as the evening burns down. The week strip (currently only on the You/Progress tab) is pinned to the bottom of the screen to fill the space under the routine list.
2. **2b — Modules screen, promoted "Tonight's pick" card.** The three equal cards become one promoted card with a 150px header (warm "light leak" gradient, two breathing ember blooms, nine rising embers) plus a compact 2-up for the remaining two modules and a "This week" bar chart at the bottom.

## About the design files

`Wick Design Ideas.dc.html` in this bundle is a **design reference created in HTML** — a prototype showing intended look and behaviour, not production code to copy. The task is to **recreate options 2a and 2b in the existing React Native / Expo codebase**, using its established patterns: `src/theme.ts` tokens, `src/motion.ts` curves, the `Screen` / `Button` / `Icon` components, `expo-linear-gradient`, and `Animated` with `useNativeDriver: true`.

Ignore every other option in the file (1a–1h, 2c, 2d, 2e). They are earlier explorations.

The HTML uses Feather icons via CDN purely so the prototype matches; in the app, keep using `src/components/Icon.tsx` with the same concept names.

## Fidelity

**High-fidelity.** Colors, spacing, type sizes and animation timings below are final and are all expressed in existing `theme.ts` / `motion.ts` tokens where one exists. Recreate pixel-for-pixel.

---

## Screen 1 — Tonight (option 2a)

Replaces the hero and step list in `src/screens/TonightScreen.tsx`. Keeps `Screen` (no `title`), keeps the tab bar.

### Layout (top to bottom, inside `Screen`'s 24px horizontal padding)

| Block | Spec |
| --- | --- |
| Eyebrow row | `flexDirection: row`, `justifyContent: space-between`. Left: `TONIGHT`, `theme.ember`, 11px / 700 / letterSpacing 2. Right: `night 12`, `theme.textDim`, 12px / 600. |
| Flame box | Fixed height, **not** flexible (`flexGrow: 0, flexShrink: 0`). Height interpolates 202 → 110 as the evening burns. The flame image is absolutely positioned, horizontally centred, `bottom: -14`. |
| Countdown | Centred column, `marginTop: 10`. Value: `theme.text`, 44px / weight 200, letterSpacing −1. Caption: `theme.textDim`, 14px, `marginTop: 2`. |
| Burn bar | 170 × 3, radius `radius.pill`, track `theme.cardBorder`, fill a horizontal `#e8703a → #ff9d5c` gradient, width = burn %. `marginTop: 18`. |
| Burn label | `EVENING BURNED DOWN` (→ `BURNED OUT` at 100%), `theme.textFaint`, 11px / 600 / letterSpacing 1.2, `marginTop: 8`. |
| Primary CTA | Existing `Button` (primary). Label `Light it now` → `Start anyway` once the countdown hits zero. `meta: '· 9 min'`. `marginTop: 18`. A 1px `rgba(255,157,92,0.6)` ring pulses out from it every 3.4s. |
| Section head | `THE DESCENT` (`theme.textFaint`, 11/700/ls 1.2) left; routine name link (`theme.ember`, 13/600) + `chevron` icon right. `marginTop: 22, marginBottom: 8`. |
| Descent list | First 4 steps of the active routine. `paddingLeft: 34`. A 2px vertical rail at `left: 9`, inset 8px top and bottom, gradient `#ff9d5c → rgba(255,157,92,.35)` at 40% → `rgba(255,157,92,.05)`. Each row: an 8px dot at `left: 5` (`top: 10`) with a 3px `theme.bg` ring; name 15px; duration 12px `theme.textFaint`, tabular nums. Row padding 6px vertical. Then a `+ 4 more` row, `theme.textFaint`, 12/600. |
| Week strip | Pushed to the bottom (`marginTop: auto`), `paddingTop: 14`, `borderTopWidth: hairline`, `borderTopColor: theme.cardBorder`. Header row: `THIS WEEK` (`theme.textFaint`, 11/700/ls 1.2) and `6 of 7 nights lit` (`theme.textDim`, 12/600), `marginBottom: 12`. Then the existing `WeekStrip` from `ProgressScreen.tsx` verbatim — 26px circles, `theme.ember` fill + check when done, `theme.card` + `theme.cardBorder` when not, 1.5px ember border on tonight, narrow weekday label `theme.textFaint` 11/600 with 6px gap. |

Dot colours down the descent rail: index 0 `theme.ember`; 1–2 `rgba(255,157,92,0.55)`; 3+ `rgba(255,157,92,0.2)`. Name colours: index 0 `theme.text`; 1–2 `theme.textDim`; 3+ `theme.textFaint`.

### The burn value

One number, `burn` ∈ [0, 1]: **0 = the wick is lit at the start of the evening, 1 = the reminder time has arrived.** In the app, derive it from the clock and the saved reminder — `burn = clamp((now − eveningStart) / (reminderTime − eveningStart))`, with `eveningStart` = reminder time minus 96 minutes. Recompute on focus and on a 60s interval; there is no user control for it (the scrubber in the prototype exists only so you can see the whole range).

Everything below is a linear interpolation on `burn`:

| Property | burn = 0 | burn = 1 |
| --- | --- | --- |
| Flame box height | 202 | 110 |
| Flame image size | 300 × 300 | 100 × 100 |
| Flame opacity | 1.0 | 0.46 |
| Bloom peak alpha (ember) | 0.19 | 0.05 |
| Cast-light peak alpha (ember) | 0.30 | 0.07 |
| Ember-layer opacity | 1.0 | 0.30 |
| Night veil opacity (over `#0d0a07`) | 0 | 0.42 |
| Burn bar fill width | 0% | 100% |
| Countdown minutes | 96 | 0 |

Derived geometry, so the glow always stays centred on the flame — do **not** hard-code these:

```
flameCentreY = safeTop + eyebrowRowHeight + flameBoxHeight + 14 − flameSize / 2
bloomSize    = flameSize * 2.3
bloomTop     = flameCentreY − bloomSize / 2
castLightTop = flameCentreY + flameSize / 2 − 34
```

Transitions between burn values are 500ms, `easing.settle` (`Easing.out(Easing.cubic)`).

### Background layers (behind the content, inside the gradient, `pointerEvents: none`)

Screen ground is a `LinearGradient` of `#241a10 → #14100c` with the second stop at 55% (a slightly warmer variant of `gradients.session`).

1. **Night veil** — full-bleed `#0d0a07`, opacity per the table above.
2. **Bloom** — a circle of `bloomSize`, centred on the flame, radial gradient `rgba(255,157,92,<bloom>) → transparent` at 56%. Breathes: opacity 0.45→1 and scale 0.94→1.06, `duration.breath` (4600ms) per half cycle, `easing.breathe`, looping alternate — i.e. the exact `Flame.tsx` idle, so reuse it.
3. **Cast light** — 300 × 140 ellipse under the flame, `radial-gradient(ellipse at 50% 0%, rgba(255,157,92,<castLight>), transparent 68%)`, blurred ~11px, `transformOrigin: '50% 0%'`, swaying on a 7.4s alternate loop: `translateX −10 → +11`, `skewX 5deg → −6deg`, `scaleY 0.95 → 1.06`. In RN, drop the `skewX` if it's awkward and keep translate + scaleY; blur can be faked with a second, larger, softer radial gradient layer since `filter` isn't available.
4. **Embers** — 6 dots, `theme.ember`, 2–4px, at x = 18 / 31 / 47 / 58 / 72 / 84 %, rising 190px over 9–14s each with staggered delays, fading in at 18% of the travel and out to 0 at the top. Native-driven `translateY` + `opacity` only.

The flame asset is the existing `assets/splash-icon.png`, i.e. keep using `src/components/Flame.tsx` — just make `size` and `opacity` driven by `burn`.

### What is removed

The old `10:30 PM` numeral hero, the `wind-down begins` caption, and the flat 8-row step list. The achievement card can stay exactly as it is (insert it above the CTA) — it was hidden in the prototype only to keep the layout legible.

---

## Screen 2 — Modules (option 2b)

Replaces the three equal cards in `src/screens/ModulesScreen.tsx`. Keeps `Screen title="Modules"` and the tab bar. The `Pick something to wind down with.` subtitle is dropped.

### 1. Promoted card ("Tonight's pick")

Outer: `borderWidth: 1`, `borderColor: theme.emberEdge`, `borderRadius: 26`, `overflow: hidden`, `backgroundColor: theme.card`.

**Header, 150px tall**, `LinearGradient` `#120e0a → #251a11`, `overflow: hidden`, layered bottom-up:

- Bloom A: 250 × 250 circle, `left: 8%`, `bottom: −120`, radial `rgba(255,157,92,0.42) → transparent` at 62%, breathing on a 5.2s alternate loop.
- Bloom B: 300 × 300 circle, `right: 2%`, `bottom: −140`, radial `rgba(232,112,58,0.30) → transparent` at 64%, breathing softer (opacity 0.25→0.7, scale 0.97→1.04) on a 7.6s alternate loop.
- Embers: 9 dots in `#ffb782`, sizes 2/3/2/3/2/4/2/3/2 px, at x = 9 / 17 / 26 / 38 / 46 / 57 / 66 / 78 / 89 %, starting at `bottom: −4` and rising 150px, durations 7.5 / 9.5 / 11 / 8.5 / 12 / 9 / 10.5 / 13 / 8 s, delays 0 / 3.1 / 6.4 / 1.7 / 4.9 / 7.6 / 2.3 / 5.5 / 0.9 s. Fade in by 22% of travel, out to 0 at the top. Scale 0.7 → 1.1.
- Scrim: `linear-gradient(180deg, rgba(20,16,12,.55), transparent 55%)` — keeps the badge and the top edge readable.
- Badge, `left: 20, bottom: 14`: `TONIGHT'S PICK`, background `rgba(20,16,12,0.62)`, `borderWidth: 1`, `borderColor: rgba(255,157,92,0.28)`, `borderRadius: radius.pill`, padding 5 × 11, `theme.ember`, 10px / 700 / letterSpacing 1.2.

**Body**, padding `18 20 20`:

- Title `Yoga & Stretches`, `theme.text`, 19px / 700.
- Body `Start one stretch, or pick several to run as a sequence.`, `theme.textDim`, 13px / lineHeight 18, `marginTop: 4`.
- `Button` (primary), label `Open library`, meta `· 30 stretches`, `minHeight: 48`, `marginTop: 16`.

The promoted module should be chosen from real data (most-used module, or the one the active routine draws from) rather than hard-coded.

### 2. Compact pair

`flexDirection: row`, `gap: 14`, `marginTop: 14`. Each tile `flex: 1`, `borderWidth: 1`, `borderColor: theme.cardBorder`, `backgroundColor: rgba(255,157,92,0.05)`, `borderRadius: 22`, `padding: 16`.

- Icon plate 38 × 38, `borderRadius: 12`, `theme.emberGlow`, centred `Icon` at 19px in `theme.ember` (`routines` / `reading`).
- Name `theme.text`, 15px / 700, `marginTop: 12`.
- Meta `theme.textFaint`, 12px / lineHeight 17, `marginTop: 3`. Copy: `3 saved · Quick wind-down set` and `Timed, with Do Not Disturb` — both should come from real state.

### 3. This-week chart

`borderWidth: 1`, `borderColor: theme.cardBorder`, `borderRadius: 22`, `padding: 18`, `marginTop: 14`, `backgroundColor: theme.card`.

Header row, `marginBottom: 14`: `THIS WEEK` (`theme.textFaint`, 11/700/ls 1.2) and total minutes formatted with `formatTotal` from `ProgressScreen.tsx` (`1h 24m wound down`, `theme.textDim`, 12/600).

Seven columns, `flex: 1` each. **Each column is a fixed 56px bar track (`justifyContent: flex-end`) with the weekday label 10px BELOW the track** — do not put the bar and label in one 56px box, or a tall bar collides with its label. Bar 16px wide, `borderRadius: 5`. Height = minutes that night, scaled so the week's max is 52px. Colour `theme.emberDeep`, `theme.ember` for tonight, `theme.cardBorder` for a missed night (drawn at 4px so the slot is still visible). Label `theme.textFaint`, 10px / 600.

---

## Interactions & behaviour

- **Tonight:** CTA pushes `Session` with the active routine's steps, unchanged. The routine name in the section head still deep-links to `Modules → Routines`. The week strip is display-only. Nothing about the burn-down is interactive.
- **Modules:** promoted CTA → `StretchLibrary`; each compact tile → `Routines` / `Meditation`. Existing press feedback (`PRESS_SCALE` 0.97, `duration.press` 90ms down / `duration.release` 220ms up) applies to all three.
- **Motion rules from `src/motion.ts` still hold and this design was drawn to obey them:** nothing overshoots, everything is opacity/scale/translate only, everything is `useNativeDriver: true`. All ambient loops are alternating `Animated.loop`s with `easing.breathe`; all state changes use `easing.settle`.
- **Reduced motion:** respect `AccessibilityInfo.isReduceMotionEnabled()` — hold every ambient loop at its mid value and keep only the burn-driven size/opacity changes.

## State

Tonight adds one value: `burn` (0–1), derived from the clock plus the saved reminder, recomputed on focus and on a 60s interval. Everything else — active routine, streak, progress, unseen badges — is already loaded by `TonightScreen`. Modules needs the module usage counts and the last seven nights' minutes, both derivable from `loadProgress()` in `src/sessions.ts`.

## Design tokens

All from `src/theme.ts`; nothing new was invented except two literals noted below.

```
bg          #14100c      text       #f7ede2      ember       #ff9d5c
bgRaised    #1c1611      textDim    #a89482      emberDeep   #e8703a
card        #1f1813      textFaint  #6b5c4e      emberGlow   rgba(255,157,92,0.14)
cardBorder  #2e241c                              emberVeil   rgba(255,157,92,0.07)
warmLight   #241a10                              emberEdge   rgba(255,157,92,0.22)

space   xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48
radius  sm 8 · md 14 · lg 20 · pill 999   (plus 22 and 26 used on the new cards)
motion  press 90 · release 220 · enter 380 · exit 260 · breath 4600
```

New literals: `#0d0a07` (the night veil) and `#ffb782` (the brighter ember used only on 2b's card, so the specks read against the warm header).

## Assets

- `assets/splash-icon.png` — the existing Wick flame mark, already in the repo. It is the only image either design uses.
- Icons: `chevron`, `routines`, `reading`, `check` — all already mapped in `src/components/Icon.tsx`. No new glyphs.
- No illustration is required for either accepted option.

## Files in this bundle

- `Wick Design Ideas.dc.html` — the prototype. Options **2a** and **2b** are the accepted designs; ignore the rest.
- `ios-frame.jsx` — the phone bezel the prototype renders inside. Prototype scaffolding only, not part of the design.
- `assets/splash-icon.png` — copy of the repo asset, so the prototype opens standalone.
