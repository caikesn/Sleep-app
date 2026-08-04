# Wick — how the codebase works

**As of 4 August 2026** · HEAD `e4450b1` · Expo SDK 54, React Native 0.81.5, React 19.1

A companion to [STATE_OF_THE_APP.md](STATE_OF_THE_APP.md), which covers what the
app does. This one is about how it is put together and — more usefully — *why*,
because most of the structural decisions here were made against a specific
failure that had already happened.

---

## 1. The shape of it

```
index.ts                 registerRootComponent
App.tsx                  SafeAreaProvider → AuthProvider → Navigation
                         (or the dev-only preview harness, see §9)

src/
  navigation/            the whole route tree, in one file
  lib/                   supabase client, AuthContext
  screens/               13 screens
  components/            16 shared UI pieces
  preview/               dev-only harness + fixtures
  *.ts                   the domain layer — see §2
  *.test.ts              13 test files, colocated with what they test

tools/                   build/tooling scripts, none of them dependencies
assets/                  generated icons + generated audio
docs/                    this
design_handoff_*/        accepted design specs, kept as the record of intent
```

There is no `src/utils/`, no `src/hooks/`, no barrel files. Modules are named for
the thing they own (`streak.ts`, `candles.ts`, `lighting.ts`) and imported
directly.

---

## 2. The one architectural rule

> **Logic that can be silently wrong lives in a module with no platform imports.**

This is the rule everything else follows from, and it exists because of the test
runner. `npm test` is `node --test` — no jest, no vitest, nothing added to
`package.json`, because Node 24 strips TypeScript natively. Node can only import
a module whose whole import graph it can resolve, which means: no `expo-*`, no
`react-native`, no `require()` of a `.wav` (that is a Metro bundler feature Node
cannot evaluate), and no AsyncStorage.

So every feature gets split at that line, and the split is always the same shape:

| Pure — tested | Platform — untestable |
|---|---|
| `streak.ts` — night keys, streak arithmetic | `sessions.ts` — queue, flush, cache |
| `achievements.ts` — stats, badge scoring | |
| `candles.ts` — vessel geometry, wax fills | `components/Candle.tsx` — the SVG |
| `flame.ts` — the mark's profile | `components/Flame.tsx` + `tools/make-icon.mjs` |
| `poseArt.ts` — 30 figure skeletons | `components/Pose.tsx` |
| `routineData.ts` — catalog, durations, reordering | `routines.ts` — sync |
| `sessionPlan.ts` — routine → phase list | `screens/RoutineScreen.tsx` |
| `breathing.ts` — patterns, `phaseAt`, `scaleFor` | `components/BreathingPacer.tsx` |
| `meditationData.ts` — scripts, timelines, bell times | |
| `reminders.ts` — what to schedule, and when | `notifications.ts` — expo-notifications |
| `lighting.ts` — levels, ceilings, copy | `screenDim.ts` — expo-brightness |
| `soundscapes.ts` — names, gains | `soundscapeAssets.ts` — the Metro `require`s |
| `format.ts` — ordinals, durations | |

Some of these splits were forced rather than chosen. `soundscapes.ts` /
`soundscapeAssets.ts` is one file's worth of content in two files purely because
one `require('../assets/audio/amb-rain.wav')` would make the whole module
unloadable under Node. `flame.ts` is shared in the other direction: a `.mjs`
build tool imports it, which it could not do if it touched React.

**When you add a feature, ask this question first.** The answer decides how many
files it is.

---

## 3. Data flow: cache-first, everywhere

Every persisted thing follows the same pattern, for the same reason — a routine
finishes at 10pm in bed, which is exactly where the wifi is worst.

```
read:   AsyncStorage cache  →  render immediately
                            →  reconcile with Supabase in the background
write:  AsyncStorage cache  (immediately, always succeeds)
                            →  push to Supabase best-effort
                            →  on failure, remember and retry on next load
```

What differs between the three stores is **how the failure is remembered**, and
that difference is load-bearing:

- **`storage.ts` (reminders)** — one dirty flag. Correct here because this is one
  record, and reminders are a fixed set named in code. There is nothing a user
  can delete offline and have resurrected.
- **`routines.ts` (saved routines)** — two id lists: `routines_pending_v1` for
  unsent writes and `routines_deleted_v1` for unsent deletes. A single dirty flag
  is not enough for a *list* — reconciling would resurrect a routine you deleted
  while offline. On merge, anything still queued is newer than the server's copy
  by definition, so the local version wins, and it is written back through a `Map`
  rather than filtered so edits keep their position instead of being shunted to
  the end.
- **`sessions.ts` (history)** — an append-only queue plus a full local log. A
  failed push must never lose a session, so unsent rows sit in `session_queue_v1`
  and flush on the next successful call. `loadHistory` **unions** cache and server
  rather than replacing, because a session logged offline on this device is not on
  the server yet and dropping it would visibly break the streak.
- **`lightingStorage.ts`** — no server side at all, and therefore no dirty flag.
  This is the deliberate exception: how dark a screen should go is a fact about
  that screen in that room, not about the person. It also meant the feature needed
  no migration and no RLS policy — a secondary benefit, but worth writing down,
  because the *next* preference should ask the same question rather than assume
  the answer is a column.

### Reading old data

Every cache read tolerates every shape it has ever been written in.
`storage.ts` still understands the bare `{hour, minute, enabled}` a pre-multiple-
reminders build wrote; `sessions.ts` still unions the legacy `session_nights_v1`
key. Silently dropping either would move someone's reminder or reset their streak
without telling them, which is the one class of bug that makes a whole feature
untrustworthy.

### Sign-out

`AuthContext.signOut` clears every cache **after** the session is gone, in that
order, so nothing can re-populate the cache from the outgoing user. Miss one and
the next person to sign in on that device inherits a stranger's streak.

---

## 4. Supabase

Client in `src/lib/supabase.ts`, typed against `src/database.types.ts` (generated
— regenerate after any migration, never hand-edit). Config comes from
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the module
throws on boot if they are missing, which is better than failing on the first
query. The publishable key is safe to ship — RLS is what protects the data. The
service_role key must never appear in `.env`.

**Four tables, all with RLS:** `profiles` (one per user, holds the `reminders`
jsonb plus the legacy `reminder_*` columns, still written but no longer read so an
older build reads the right time), `routines`, `routine_steps` (`ON DELETE
CASCADE`, unique on `(routine_id, position)`), `sessions`.

`AppState` drives `startAutoRefresh` / `stopAutoRefresh`: Supabase only refreshes
tokens while foregrounded, and for a bedtime app "the phone was asleep" is the
common case, not the edge case.

**Two gotchas already paid for:** `SECURITY DEFINER` trigger functions in the
`public` schema are exposed as callable REST endpoints unless execute is revoked;
and `get_advisors` should be run after every migration, because that is what
caught it.

---

## 5. Navigation

All of it in `src/navigation/index.tsx`, which is worth reading top to bottom.

```
RootStack (native stack, headerShown: false)
├── signed out ──── Auth, ForgotPassword
├── onboarding ──── Onboarding                    (its own Group: no way out of a half-finished run)
└── signed in  ──── Tabs
                    ├── Tonight
                    ├── Modules (stack) ── ModulesHome → StretchLibrary / Routines / RoutineBuilder
                    └── You     (stack) ── Progress → Settings
                    Session          (above the tabs — nothing competes for attention)
                    Meditation
                    RedLightTutorial (modal)
                    Onboarding       (modal — same screen, declared twice, see below)
```

**The tabs are a top-tab navigator worn at the bottom.** A bottom-tab navigator
renders one screen at a time, so there is nothing beside the current page for a
swipe to drag in, and there never will be. This one is a pager: on native that is
`react-native-pager-view`, so the swipe never touches the JS thread; on web it
falls back to a PanResponder, which is what keeps the screenshot harness working
and also why the web swipe is rougher. `lazy: false` — every tab is mounted up
front, because a pager must have the next page drawn *before* the gesture starts.

**`Onboarding` is declared in two groups.** Safe, because the groups are mutually
exclusive. The difference is what finishing means: on a first run it swaps the
whole group for the app; from Settings it is a modal that closes. Both save the
wind-down time and the light level on the way past.

**Three pieces of state are held before the tree renders:** `initializing` (so the
sign-in screen never flashes at someone already logged in), `recovering` (verifying
a reset code creates a session, which would otherwise unmount the reset screen
before the new password is saved), and `onboarding === null` (not read yet —
guessing `false` shows a frame of Tonight, guessing `true` flashes the walkthrough
at everybody).

**A tapped reminder is held, not dropped.** Those routes only exist in the
signed-in group, so `pendingIntent` is a ref that survives until a session
appears *and* onboarding is done. It holds a destination rather than a boolean
because the three reminders disagree about where they go: wind-down starts
whichever routine Tonight would have started — not the built-in one, because a
shortcut that ignores the routine you saved is worse than no shortcut — morning
opens the stretch library rather than force-starting anything, and lights out
deliberately opens nothing at all.

**Reminders are re-registered on every launch.** Pending notifications do not
survive a reinstall and the OS drops them when restoring to a new device, but the
settings do survive in the profile row. Rescheduling is cancel-then-register per
key, so this is a no-op when nothing has changed.

### `useScreenLoad`

`src/screenLoad.ts` — loads a screen's data on mount and on every focus. It exists
because `useFocusEffect` alone was correct only while the tabs were a bottom-tab
navigator. Under a pager, the page you are swiping toward is drawn at full size
beside the one you are on, and is not focused until you let go — so a screen that
waits for focus shows its empty state through the whole gesture and snaps into
content on landing. Which is exactly the flicker the swipe was added to avoid.

---

## 6. The design system

### `theme.ts`

Warm dusk / ember. Surfaces are warm near-blacks (`#14100c`), type runs warm white
to dim clay, the accent is `#ff9d5c`. **No blue, anywhere** — that is the rule that
ties the interface to the red-light premise instead of leaving it as one feature.

Also here: `gradients` (screen grounds — a flat fill reads as a dark rectangle, a
slow warm gradient reads as a room lit from one side, and all of them stay far
below the reference apps' brightness because those are used in daylight and this
one is opened in bed), `space`, `radius`, `type`, and `EMBER_RGB` for anything that
needs to build its own alpha stack.

### `motion.ts`

Three rules, and they are enforced by the values rather than by review:

1. **Nothing overshoots.** No springs, no bounce, no elastic. Overshoot is the
   grammar of play and it reliably pulls the eye back to a screen you are trying to
   put down. `easing.settle` is `Easing.out(Easing.cubic)`, which ends exactly at
   its target.
2. **Opacity and scale, not travel.** Sliding panels are a lot of movement in
   peripheral vision.
3. **Everything is native-driven.** A shape redrawn from a JS ticker stutters, and
   a stuttering animation is worse than none because you end up watching it.

The one exception to "slow" is `duration.press` at 90ms — late touch feedback
reads as a dropped tap.

`useAmbientLoop(halfCycleMs, still)` gives a value drifting 0 → 1 → 0 forever,
alternating rather than resetting so there is no seam. `useDrift` sums three of
them at non-commensurate periods, because **one loop is a metronome**: however
slowly eased, a single loop spends half of every cycle on one side of its middle,
and at fourteen seconds that is seven seconds of sitting there — which is how a
swaying flame comes to look like a flame stuck to the right. The sum is
re-expanded through `DRIFT_WINDOW` because three weighted waves rarely agree, so
the raw sum lives near its middle. `Animated.add` and `Animated.multiply` both run
natively, so rule 3 survives.

`reduceMotion.ts` subscribes to the OS setting (it can be toggled from Control
Centre while the app is open). Callers park ambient loops at their **mid** value
rather than removing the element, so the layout and the lighting are identical
either way and only the movement goes.

### Components

| Component | Note |
|---|---|
| `Screen` | Every screen's shell: warm ground, safe-area inset, optional header/footer/`background` slot. The entrance fade is defined once here, and the gradient deliberately sits *outside* it so moving between tabs reads as the light staying on. |
| `Button`, `Field`, `Chips`, `SelectRow`, `LevelRow` | The form/selection primitives. `LevelRow` is the discrete-steps control shared by light levels and soundscape volume. |
| `Icon` | Every icon in the app goes through one map. Screens name the **concept**, not the glyph, so swapping sets is a change to this file alone. Feather line icons — emoji were replaced wholesale because the platform draws them in its own multicolour font, which broke the no-blue rule on every device differently. |
| `Flame` | The mark, drawn as SVG from `flame.ts`. Exports `FLAME_BODY`, the ratio of visible flame to drawing box — see §7. |
| `Glow`, `Embers` | Ambient light: a layered radial bloom, and drifting specks. |
| `Candle` | A badge as a candle. Vector, driven entirely by `candles.ts`. |
| `Pose` | A figure drawn from a `poseArt.ts` skeleton. |
| `BreathingPacer` | The orb. Native-driven, handed the *remaining* time at each phase boundary. |
| `TabBar`, `WeekStrip`, `NightStrip` | The custom bottom bar, the seven-night lit/unlit strip, the weekday toggle row. |

---

## 7. Drawing: one geometry, two consumers

`src/flame.ts` describes the Wick mark as a profile in a unit square, and it is
imported by **both** `components/Flame.tsx` (SVG, in the app) and
`tools/make-icon.mjs` (rasteriser, for the launcher icon, splash, notification
icon and favicon). That is the entire reason the module exists: the profile used
to live in the icon generator alone, so the moment the app wanted its own flame
there would have been two shapes in two languages to keep in step.

Its doc comment is the record of four wrong turns and is worth keeping: a
`pow`-based profile cannot come to a point, a straight tangent cone draws a **water
droplet** (the one thing a warm bedtime app must not evoke), and what separates a
flame from a drop is a *pinched base* and a *slight lean*. A fifth pass was needed
when the mark was first drawn at 190pt rather than at icon size — at 24 pixels a
bulb reads as a flame because there is nothing else it could be. **Check any
change at both ends**: `npm run icons -- --preview` for the small end,
`npm run shoot -- tonight:steady` for the large one.

**`FLAME_BODY` is the trap.** The drawing is roughly 3.4× the height of the flame
inside it, so sizing by the box understates the flame by that factor. Tonight and
Onboarding both state their intent in points of *visible flame* and divide.

`poseArt.ts` is the same idea applied to 30 figures. A pose is a **skeleton** —
a head and a handful of jointed strokes in a 64×64 box — because thirty
hand-authored outlines would drift in stroke weight, head size and height, and
drift across a set is what makes a set look bought rather than drawn. The
conventions do most of the communicating: the torso is heavier than the limbs, a
floor pose has a floor line and a standing one doesn't, everything faces right,
two-sided poses are drawn on the left, and props are dimmed because a door frame
at body weight competes with the body.

`candles.ts` is the third instance: nine vessel specs (columns, widths, wall,
taper, saucer, stagger) plus twelve wax colours, with `waxHeight` / `widthAt` /
`columnCentre` as pure functions the SVG consumes. `EMPTY_FILL` is 0.14 rather than
0 because a freestanding candle at true zero has no body to see, and the point of
drawing a locked badge as its own dim shape rather than a padlock is that you can
tell them apart before you have earned any.

---

## 8. The three lifecycle disciplines

Three features in this app borrow something global, mutate it across an `await`,
and are used by someone who will not notice the leak until they are somewhere
else entirely. All three converged on the same rules, and the third one is
documented in terms of the first.

### Audio (`audio.ts`) — the one that shipped broken

A soundscape's fade-out timer used to live on the module rather than on the
player. Starting a second track cancelled the first track's fade — and since the
release only happened when that fade *completed*, the first player was never
paused or freed. Its reference was overwritten a moment later, so nothing could
reach it again: it played until the app was killed, and every track you auditioned
piled up on the last.

The fix, and the rules that came out of it:

- **The timer belongs to the thing it protects**, not to the module. A `Voice` owns
  its player, its source and its fade.
- **Every live handle stays reachable.** `live` is a `Set` of every voice including
  ones on their way out, so there is never a window where a playing voice has
  nothing referencing it. `stopSoundscape` sweeps it as a backstop.
- **A generation counter guards every `await`**, so a slow start cannot install a
  voice for a session that has already ended.
- **Nothing here may ever throw into a session.** A bell is decoration on a timer;
  if the asset fails to decode or a future SDK renames a method, the meditation
  carries on in silence. Every entry point is wrapped.
- **Every bell is also a haptic tap**, because the app's own DND screen tells you
  to silence the phone immediately before the session starts — so sound alone is
  the one cue guaranteed to be muted by following our own advice.
- Audio mode is `mixWithOthers`: someone winding down to their own album keeps it.

### Brightness (`screenDim.ts`) — the same bug in a worse place

On iOS `setBrightnessAsync` moves the **system** slider. A brightness that is never
restored is found the next morning, outdoors, at four percent, with nothing on
screen to explain it. Same rules: the original is captured once before anything
moves, restoring is unconditional and idempotent, a generation counter guards
every await, and **backgrounding restores** — leaving the app is leaving the
session as far as the screen is concerned.

`useScreenDim(level)` is the hook every timed screen uses, and its cleanup is the
whole point: finish, End, back gesture, or a tapped notification pulling you
elsewhere all unmount the screen, and therefore all restore. A failed *read* is
recorded as NaN rather than a fabricated 1.0 — a guess would be remembered as the
original and later restored, turning a failed read into a screen set to full.

### Notifications (`notifications.ts`)

**Nothing ever calls `cancelAllScheduledNotificationsAsync`.** The previous version
opened every schedule with it, which meant the app could hold exactly one pending
notification — a second reminder silently deleted the first, and a morning alarm
was impossible. Everything is registered under a key it owns
(`wick.wind-down.daily`, `wick.lights-out.n3`) and cancelled by reading back what
is actually registered, which is the only way to know that deselecting Friday
should remove `…n5`.

Schedule changes are **serialised per reminder id**, because every change is
cancel-then-schedule and dragging the time picker fires a change per tick — two
interleaving calls will cancel a schedule the earlier one had not yet written.

**`nights` names the night, and two rules turn it into a weekday.** `fireDay`
takes the reminder's `ReminderKind`, not just its hour. An *evening* reminder
rolls to the next day only below the 4am `NIGHT_CUTOFF_HOUR`, because until then
it still belongs to the night behind it. A *morning* reminder is the day after
its night at every hour — 7am on "Sunday night" is Monday, and the evening rule
answers Sunday, the morning twenty-three hours before the night it was set for.
That is the same off-by-a-day the cutoff exists to prevent, in the other
direction, which is why the cutoff could not simply be reused.

A full week collapses to **one DAILY trigger**, not seven WEEKLY ones, because iOS
caps an app at 64 pending notifications and three reminders share that
budget. One Android channel **per reminder**, not one for the app, because a
channel is the only handle a user has to change behaviour and it cannot be changed
after creation — sharing one would mean silencing "lights out" also silences the
wind-down.

---

## 9. Tooling

Everything below is in `tools/` and none of it is a dependency of the app.

| Command | What it does |
|---|---|
| `npm test` | `node --test` over `src/**/*.test.ts`. 148 assertions, zero test dependencies. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run shoot -- tonight:steady` | Playwright screenshots into `.screenshots/` (gitignored). |
| `npm run icons` | Regenerates all six icon assets from `flame.ts`. `-- --preview` for the small end. |
| `npm run check:audio` | Drives a real browser through auditioning soundscapes and counts what is still playing. |
| `node tools/make-bell.mjs` / `make-ambience.mjs` | Regenerate the committed `.wav` files. Only run to *change* the sound. |

**`tools/ts-hooks.mjs`** is the twenty lines that make `npm test` possible: a
resolution hook that retries extensionless relative imports as `.ts`, because
Node's ESM resolver demands extensions and Metro does not. Rewriting app source to
suit the test runner would be the tail wagging the dog.

### The preview harness (`src/preview/`)

`http://localhost:8081/?preview=progress&fixture=veteran` seeds AsyncStorage and
mounts one screen with no auth. It exists because screens sit behind sign-in *and*
because the interesting states — a forty-night streak, a full badge case, an empty
history — take weeks to reach honestly. Guarded by `__DEV__` and
`Platform.OS === 'web'`; the cache is the only thing seeded, so with no session
`sessions.ts` reads local and never calls the server.

Screens: `progress`, `tonight`, `modules`, `settings`, `routines`, `stretches`,
`meditation`, `builder`, `builder-edit`, `auth`, `onboarding`, `redlight`,
`session`, `tabs`, plus two contact sheets (`candles`, `poses`).
Fixtures: `empty`, `starting`, `steady`, `veteran`.

### Five traps in the tooling that have each cost real time

1. **A preview screen calling `useAuth` needs `needsAuth: true`, or `shoot` hangs
   rather than failing.** `useAuth` throws outside its provider and the harness has
   no error boundary, so the run sits until killed and prints nothing. `settings`
   was registered without it and had therefore never been screenshot — there was no
   PNG on disk at all, which is the only reason it was noticed. **Check this first
   when a shoot hangs.**
2. **`shoot.mjs` waits ~600ms, which lands on the dark end of every ambient loop.**
   Anything driven by `useAmbientLoop` starts at 0, so glows shoot at about half
   strength and read as broken. Re-shoot with `SETTLE=5200` before deciding a glow
   is too dim. Twice this was chased as a positioning bug; both times it was
   capture phase.
3. **Playwright's `fullPage` is useless here** — react-native-web pins the root and
   scrolls inside it, so the document is always one viewport tall. `shoot.mjs`
   finds the inner scroll container and steps down it. On that container
   `scrollTo({ behavior: 'instant' })` is silently ignored; assigning `scrollTop`
   works.
4. **A fixture must not make a screen's state depend on the day it is shot.**
   `SETTINGS_FIXTURES` keeps wind-down on *every night* in all four fixtures,
   because Tonight's whole hero reads off it — a weeknights-only fixture would draw
   the wick unlit on a Saturday and look like a broken screen. The partial-week
   case lives on lights-out, which only Settings reads.
5. **Verifying a loop has no click, without being able to listen:** compare the
   join step to the *largest* step the track takes anywhere else (≤1.0 is clean).
   Comparing to the average flatters hiss and libels a drone; comparing to peak
   amplitude does the reverse.

**Scheduled notifications have no check script and cannot get one.**
`check:audio` works because expo-audio has a real web player; `expo-notifications`
has essentially no web scheduling. `scheduledKeys()` exists to be called on a
device.

---

## 10. Content: what lives in code and why

Stretches, badges, breathing patterns, guided scripts, reminder copy and soundscape
names are all **source of truth in TypeScript**, not in the database. Zero latency,
offline by default, and versioned with the code that renders them. The database
references stretches by string id only.

Which produces the single most important content rule:

> **Step ids are permanent.** Saved routines reference them. Rename a step freely,
> re-describe it freely, but never re-key it. Adding is always safe; removing costs
> the step from every routine that used it, which `resolveSteps` handles by
> quietly dropping unknown ids rather than rendering blanks.

Re-*timing* a step is safe and deliberately global — routines store ids, so a
better number is a better number everywhere it appears.

Two invariants the tests enforce on the catalog: a hold is at least
`MIN_HOLD_SECONDS` (30) **per side**, and a breath pose lasts a whole number of its
own cycles. The old durations were round numbers instead, so 4-7-8 — a 19-second
cycle — ran for 60 seconds and cut you off three breaths in, mid-exhale.

`sessionPlan.ts` flattens a routine into what the timer actually counts:

```
one-sided:  get ready → hold
two-sided:  get ready → hold(left) → get ready → hold(right)
```

The screen walks phases while still reporting progress in *steps*, because "3 of 8"
should count stretches and nobody thinks of Pigeon as two of them. This is a
property of the sequence rather than of the screen, which is why it is built in a
module that can be tested without a renderer.

**Copy lives next to the thing it describes.** `REMINDER_COPY` is in `reminders.ts`
rather than at the scheduling call, because a scheduled notification keeps the text
it was created with — one place to change it is the difference between a copy edit
working and half the week still saying the old thing. `DIM_COPY` and `describeDim`
are shared between Settings and the in-session banner for the same reason: a banner
that says the screen is dimmed while Settings says it isn't is worse than neither
saying anything.

`design_handoff_onboarding_auth_copy/README.md` is the **voice check** for anything
new. The tell: if a sentence explains what the software is about to do for you,
it is the wrong voice. The right voice speaks like someone already standing in the
moment, not like a product describing itself.

---

## 11. Conventions worth matching

- **Comments explain *why*, and usually name what was tried first.** This codebase's
  doc comments are unusually long on purpose — most of them are the record of a
  decision that looks arbitrary until you know the alternative was tried and was
  worse. Keep writing them that way; they are the reason a six-month-old file can
  be changed safely.
- Screens are self-contained: local `StyleSheet.create`, tokens from `theme.ts`,
  data via `useScreenLoad`.
- Nothing invents its own spacing, radius or duration. If a value is missing from
  `theme.ts` or `motion.ts`, add it there.
- Types are declared where they are owned and imported with `import type`, which is
  erased at compile time and therefore keeps a pure module pure.
- Async work in an effect is guarded by a local `active` flag or a generation
  counter. Every one of them.
- Errors on a decorative path are swallowed with a comment saying so. A stretch
  timer must not die because the screen would not dim.
- Reordering is up/down arrows, not drag: no new dependency, and it is the only
  version a screen reader can drive.
- Accessibility roles and labels are set on custom pressables (`radio`, `selected`,
  a spoken label that includes the summary).

---

## 12. Where to start, by task

| If you are… | Read first |
|---|---|
| Adding a reminder | `reminders.ts` (`ReminderId`, `REMINDER_KIND`, `REMINDER_COPY`, `DEFAULT_REMINDERS`), then `notifications.ts` (channel), then where a tap should land in `navigation/index.tsx`. Settings and storage are generic over `REMINDER_IDS` and need nothing. |
| Adding a stretch | `routineData.ts` (permanent id, `perSide`, whole breath cycles), then `poseArt.ts` for its figure. |
| Adding a badge | `achievements.ts` (a count against a target — keep it uniform so one progress bar renders all of them) and pick a `vessel` + `wax` pair no other badge uses. If it is a run of nights, set `streak: true` and give it a `peak`: progress comes off the current run so a miss resets it, but earning comes off the best run so nothing is ever revoked. |
| Changing the mark | `flame.ts`, then check **both** ends: `npm run icons -- --preview` and `npm run shoot -- tonight:steady`. |
| Adding a preference | Ask the `lightingStorage.ts` question first: is this a fact about the person, or about this device in this room? The answer decides whether it needs a column and a migration at all. |
| Touching audio or brightness | §8. Do not skip it. |
| Adding a screen | Register it in `navigation/index.tsx` **and** in `preview/index.tsx` — with `needsAuth: true` if it calls `useAuth`. |
