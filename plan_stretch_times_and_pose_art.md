# Plan — honest stretch times, and figure art for every pose

Two jobs that touch the same file ([src/routineData.ts](src/routineData.ts)) and are worth doing in
one pass, in this order. Part A is small and unblocks nothing; Part B is the
long one. Do A first so the durations are settled before art is drawn against
them.

---

## Part A — fix the times

### What's wrong now

Every step carries a single `seconds`. Two problems hide in it:

1. **Two-sided poses are half as long as they read.** Ten steps end in "Switch
   sides halfway" — `ear-to-shoulder`, `doorway-chest`, `eagle-arms`,
   `thread-the-needle`, `supine-twist`, `seated-twist`, `hamstring-reclined`,
   `figure-four`, `low-lunge`, `pigeon`. Figure-Four is 60s, so 30s a side.
   Ear to Shoulder is 45s → 22s a side, under the ~30s a static hold needs to
   do anything. The number in the UI is the *total*, but the number that
   matters to the body is the *per-side*, and right now they're conflated.

2. **Breathing steps don't finish a whole number of cycles.** `four-seven-eight`
   is 60s; one round is 19s, and the description says "four rounds is plenty" —
   that's 76s. `breathing` (box, 16s/round) at 60s = 3.75 rounds. The timer
   cuts people off mid-exhale.

### The change

In `RoutineStep`, make the authored number the *unit* and derive the total:

```ts
/** Seconds for one side. Present only on poses done twice. */
perSide?: true;
```

- `seconds` stays the field name and stays the authored value, but for
  `perSide` steps it means *per side*; add `stepSeconds(step)` returning
  `step.perSide ? step.seconds * 2 : step.seconds` and route every consumer
  through it.
- Consumers to update: `routineSeconds`, `stepsMinutes`, and the initial timer
  in [src/screens/RoutineScreen.tsx:19](src/screens/RoutineScreen.tsx#L19) /
  `goToStep` at [:87](src/screens/RoutineScreen.tsx#L87). Grep for `.seconds`
  before declaring it done — `duration_seconds` at
  [:44](src/screens/RoutineScreen.tsx#L44) is the session log and is measured,
  not computed, so it needs no change.
- No data migration. Saved routines store step *ids* only
  ([routineData.ts:363](src/routineData.ts#L363)), so re-timing a step silently
  re-times every routine that uses it — which is what we want.

Then re-author the numbers:

| Step kind | New rule |
|---|---|
| Two-sided holds | 30s per side (gentle/moderate), 45s per side for `pigeon` |
| One-sided holds | 45s floor; anything currently 30s (`neck-rolls`, `shoulder-rolls`, `chin-tuck`) goes to 45s |
| Breathing | round up to a whole number of cycles: box 64s, long-exhale 60s, belly 90s, 4-7-8 76s, alternate-nostril 96s |
| Rest | leave alone — these are already generous and the point is that they're open-ended |

Longer routines are the consequence: the built-in Night Routine goes from ~8min
to ~10min. That's the honest number; if it's too long, cut a *step* from
`defaultRoutine`, don't shave the holds.

### Tell the user the side switch is coming

A 60s Figure-Four that is really 30+30 needs the app to say so. In
`RoutineScreen`, for a `perSide` step:

- show `Left · 0:24` then `Right · 0:28` rather than a bare `0:54`
- fire the existing cue (whatever `neck-rolls` etc. use for step change — check
  [src/audio.ts](src/audio.ts)) at the halfway mark, quieter than the
  step-change cue

### Tests

Extend [src/routineData.test.ts](src/routineData.test.ts):

- every step with "Switch sides" in its `description` has `perSide: true`, and
  vice versa — this is the assertion that stops the two drifting apart as the
  catalog grows
- `routineSeconds` doubles `perSide` steps
- no step's per-side hold is under 30s
- `defaultRoutine` total is within an expected band (guards against a future
  edit quietly making the nightly routine 20 minutes)

---

## Part B — a person doing the stretch

### Why the current icons don't do it

[src/components/Icon.tsx:46-61](src/components/Icon.tsx#L46-L61) is explicit
about this: the stretch glyphs describe *movement* — a rotation, a fold — "rather
than trying to depict a pose, which no line-icon set can do honestly." That was
the right call for Feather. It's the wrong ceiling for the app: `open` is
`maximize-2` for both Butterfly and Pigeon, and nobody has ever learned a pose
from a diagonal arrow.

So this is new artwork, not a new icon set. Keep `icon` — it still labels rows
in the library where art would be too heavy — and add a second field.

### The data change

```ts
/** Key into the pose art. Every step has one; unlike `icon`, never shared. */
pose: PoseName;
```

One drawing per catalog step, 30 of them. Not shared, because sharing is exactly
the failure mode above.

### The drawing

`react-native-svg` (already in the tree via Expo — confirm in
[package.json](package.json), add if not).

**Style, so 30 drawings look like one set:**

- single-weight stroke, round caps, matching the flame's line language — see
  [src/flame.ts](src/flame.ts) and [src/components/Flame.tsx](src/components/Flame.tsx)
  for the existing stroke weight and how a path is authored as data separate
  from the component
- monochrome, `currentColor`-style tint passed as a prop, same as `Icon` —
  this keeps the no-blue rule intact and makes the art work on both the dark
  routine screen and the lighter library rows
- contour figure, not a stick figure: head, torso, limbs as one continuous
  weight. Stick figures read as clip art; a contour reads as a person.
- a floor line where the pose is on the floor, omitted where it isn't. This
  single detail does most of the work of communicating "lie down" vs "stand".
- always drawn facing the *same* direction (right), and for two-sided poses
  always the *left*-side version, so the halfway switch in Part A means "mirror
  what you're looking at"
- one 64×64 viewBox for all of them, figure sized to a consistent head-height
  so poses don't jump in scale between steps

**Authoring:** mirror the `flame.ts` / `Flame.tsx` split — path data in
`src/poseArt.ts` as a `Record<PoseName, string[]>` of path `d` strings, and a
dumb `<Pose name size color />` in `src/components/Pose.tsx` that renders them.
That keeps the 30 drawings out of the component tree and makes them diffable.

**Order to draw them in** — do one from each group first, get those four
approved, then batch the rest:

1. `childs-pose` (rest, folded, floor line)
2. `low-lunge` (hips, upright, two-sided)
3. `cat-cow` (back, on all fours, mid-movement)
4. `breathing` (breath, seated — the hardest, because stillness has to look
   deliberate rather than like a mistake)

The breath ones may end up as seated figures with a subtle expansion mark
rather than trying to animate; decide after seeing #4.

### Where the art shows up

- **[RoutineScreen](src/screens/RoutineScreen.tsx)** — large, above the timer.
  This is the one that matters: it's the moment someone needs to know what to
  do. It replaces nothing; the description text stays under it.
- **[StretchLibraryScreen](src/screens/StretchLibraryScreen.tsx)** — medium,
  in each row, replacing the `icon` there. Browsing the catalog is the other
  time you need to see the shape.
- **[RoutineBuilderScreen](src/screens/RoutineBuilderScreen.tsx)** — keep the
  small `icon`. Rows here are dense and reorderable; art would make the list
  harder to scan, not easier.

### Accessibility

The art is decorative in the strict sense — the `description` already says what
to do in words, and that's what a screen reader should read. Mark the SVG
`accessible={false}` / `importantForAccessibility="no-hide-descendants"` rather
than writing alt text that duplicates the description.

Also honour [src/reduceMotion.ts](src/reduceMotion.ts) if any pose art ends up
animated — default to static.

### Tests

- every `PoseName` in the type has entries in `poseArt.ts`, and every catalog
  step's `pose` resolves — a missing drawing should fail the suite, not render
  blank
- no two steps share a `pose`

### Seeing it

Use the `?preview=` harness (see the tooling notes) to shoot
`StretchLibraryScreen` and `RoutineScreen` after each batch of drawings — a
contact sheet of all 30 side by side is the only way to catch scale and weight
drift between them. Consider adding a `poses` preview route that renders the
whole set in a grid purely for that check.

---

## Suggested commits

1. `fix(routines): per-side holds and whole breathing cycles` — Part A, data +
   `stepSeconds` + consumers + tests
2. `feat(routines): announce the side switch mid-step` — the RoutineScreen half
   of Part A
3. `feat(stretches): pose art scaffolding + first four drawings` — `poseArt.ts`,
   `Pose.tsx`, preview grid, four poses
4. `feat(stretches): remaining pose art` — the other 26
5. `feat(stretches): show pose art in the routine and library screens`
