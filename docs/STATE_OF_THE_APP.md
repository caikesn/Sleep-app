# Wick — state of the app

**As of 5 August 2026** · branch `main`, clean · HEAD `b402473` · 155 tests passing · `tsc --noEmit` clean

A companion to [ARCHITECTURE.md](ARCHITECTURE.md), which explains *how* the thing is
built. This one is about *what exists*, what it does when you open it, and what
is still missing.

---

## What Wick is

A React Native + Expo app for the hour before bed. Not a sleep tracker, not an
alarm clock (yet), not a meditation library with a bedtime skin on it: it is the
wind-down itself — a routine of stretches, a breathing pacer, a guided script, a
reading timer — plus the two things that actually move the needle on falling
asleep, which are **light** and **consistency**.

The name is deliberate. A wick is the thing that burns down and goes out, which
is what the Tonight screen literally draws, and it is one syllable, uncontested
in the category, and yields an icon straight out of the app's existing ember
palette. It replaced the placeholder "Night Routine" on 2 August 2026. Earlier
candidates were rejected on evidence and should not be re-proposed: *Remly* is
an existing sleep app on both stores, *Rest* is generic-descriptive and
unsearchable, *Dusk* is ResMed's, and *Night Routine* is taken on the App Store.

### The premise, and the one rule that follows from it

Ambient light matters more than what the phone shows. So the app **never glows
red**: a bright red screen at reading distance is still a bright light, and
selling that would be selling the feeling of doing something rather than the
thing. What it does instead:

1. Tells you to put a red bulb in the lamp beside you — ranked first, because it
   is first.
2. Teaches you your phone's own **system-wide red filter** (iOS Accessibility →
   Display & Text Size → Colour Filters → Colour Tint, bound to the
   Accessibility Shortcut). This is not a contradiction of rule 1 — "the app must
   not glow red" and "teach the user the phone's red filter" are different
   claims and both are true.
3. Turns its **own** screen down during a session, and gives the brightness back.
4. Never uses blue anywhere in the interface. Every neutral is warm-shifted, so
   the UI reads as lamplight rather than as a screen.

---

## What you can do with it tonight

### Sign in

Email + password, Supabase-backed. Sign-up, sign-in, and password reset by
6-digit emailed code. No social or anonymous auth — deliberately, because it is
the simplest thing to reason about and needs no Apple Developer account to test.

### First run

A four-step walkthrough, shown once, skippable, triggered by a device flag
written the moment an account is created:

1. **This is Wick** — the flame, full-screen, and six words.
2. **When does your evening start?** — the wind-down time picker.
3. **How dark should it get?** — the four light levels, previewed live: the step
   actually dims the screen as you tap, so you choose by looking at the room.
4. **Tonight** — the routine that is about to run, named, over a Start button.

Every step already has a sensible default, so none of it is a question you must
answer. It is reachable again later from Settings → "See the walkthrough again".

### Tonight (tab 1)

The hero is a wick burning down. One number — `burn`, 0 when the evening's
window opens and 1 when your wind-down reminder lands — drives the flame's
height, the bloom behind it, the embers coming off it, the night veil closing in,
and the countdown. There is no separate "early evening" and "late evening"
state; the screen is a clock you read without reading.

Under it: an ordinal night count ("your 12th night"), the first four steps of
tonight's routine drawn as a descent down a lit rail, a Start button that becomes
"Start anyway" once the countdown hits zero, this week's strip of lit/unlit
nights, and a card for any badge you have earned but not yet seen.

### Modules (tab 2)

Three modules, ranked rather than presented as three equal cards — because people
pick a lane and stay in it. The one you actually use is promoted to a lit card
with its own front door; the other two drop to a compact pair. Nothing is hidden.

- **Yoga & Stretches** — a library of 30 stretches in 5 categories (breathing,
  neck & shoulders, back & spine, hips & legs, winding down, in the order you
  work through them), each marked gentle / moderate / deep. Filter by category,
  select several, run them as a sequence.
- **My Routines** — build, name, reorder and delete your own wind-downs; pick
  which one Tonight starts. A built-in eight-step "Night Routine" always exists
  and can never be deleted, so a fresh install with no signal still has something
  to run.
- **Reading & Meditation** — three modes (Meditate / Breathe / Read), a duration,
  an optional guided script, interval bells, a background soundscape, and a Do
  Not Disturb prompt before it starts.

### A session

Whichever way you got here, a timed session:

- Each stretch gets **five seconds to get into it** before its clock starts, with
  the last three counted in by haptic taps. Two-sided poses get one per side.
- Hold times are honest. A two-sided pose's authored number is **per side**, and
  no static hold is under 30 seconds. Breathing steps last a whole number of
  their own cycles — 4-7-8 runs 76s (four rounds of 19), not the round 60 that
  used to cut you off mid-exhale.
- Every pose has a **drawing of a person in it** — a hand-authored skeleton, not
  an icon, all the same figure in different shapes, facing right, two-sided poses
  drawn on the left so "switch sides" means "mirror what you're looking at".
- The screen dims to your chosen level and warms, with a banner pill you can tap
  to change the level mid-session. It restores your brightness on every exit.
- The screen stays awake. The session logs whether you finished or abandoned it.

### Meditation, specifically

- **Meditate** — a timer with rotating prompts, or one of three guided scripts
  (body scan, breath awareness, letting the day go). A script is stretched to fit
  whatever duration you picked, so a 5-minute body scan and a 20-minute one visit
  the same places at different speeds. There is **no narration** — the running
  screen is built to take it and `GuidedSession.track` is the reserved slot, but
  the voice has to be recorded by a person.
- **Breathe** — four patterns (long exhale, coherent, box, 4-7-8) driven by an
  orb that expands, holds expanded, contracts and holds small. The phase is
  derived from elapsed wall time, never counted up, so it cannot drift.
- **Read** — a timer and a reminder to read something physical.
- Across all three: two synthesised bell sounds (interval + final), always paired
  with a haptic tap, and five looping soundscapes (brown noise, rain, waves,
  embers, warm drone) at three volume steps, crossfaded, mixing with whatever
  music you already had playing.

### You (tab 3)

Progress is the tab's home, Settings sits behind it — streaks and badges are
looked at often, a reminder time is set once.

- Current streak, best streak, total nights, total minutes.
- A week strip and a full session history grouped by night ("Tonight", "Last
  night", then dates).
- **13 badges, drawn as candles.** A badge fills with wax as you approach it and
  **lights** when you earn it. The direction matters: the obvious version of this
  metaphor burns the candle down with progress, so the better you do the less
  candle you have and the prize is a puddle. Three families run through the
  shapes — session counts grow (tealight → votive → jar → pillar), streaks gain
  flames (taper → twin → triple, and a month becomes a storm lantern), total time
  comes in tins.
- Settings: both reminders with their times and nights, the light level, the
  warm wash toggle, links into the phone's own Display and Accessibility
  settings, the red-light tutorial, the walkthrough again, and sign out.

### Reminders

Three of them:

- **Wind-down** — "time to wind down". Tapping it starts tonight's routine.
- **Lights out** — "nothing left to do tonight, put the phone down". Tapping it
  deliberately opens nothing, because it has done its job when it is read.
- **Morning** — "stretch the night out before anything else". Tapping it opens
  the stretch library rather than force-starting a routine, because at 7am the
  app has no idea which stretches you want and the night routine is the wrong
  one at the wrong end of the day.

Each picks its own nights, with Weeknights / Weekends / Every night presets.
`nights` names the **night**, not the calendar day, so a 00:30 lights-out set for
"Sunday" fires on Monday morning — and so does a 7am morning reminder set for
Sunday. Those two are the same rule but not the same arithmetic; see the streak
rules below.

Morning is a **reminder, not an alarm**, and says so. It is an ordinary scheduled
notification, which the OS silences under Do Not Disturb — precisely what someone
following this app's own advice has on overnight. A real alarm needs a critical-
alert entitlement from Apple and a full-screen-intent permission on Android, and
is a separate feature.

With lights out and morning both on, Settings names the night they describe:
"8h 15m from lights out to morning — the most sleep tonight can hold." Framed as
what the night can hold rather than what you got, because nothing here measures
sleep and a line reading "8h 15m of sleep" would be inventing a figure out of two
settings.

---

## Streak rules, and other decisions that look like bugs

- **A night ends at 4am.** A wind-down finished at 00:30 belongs to the night
  before. Without this, doing your routine just after midnight would break the
  streak it should have extended. The same cutoff drives which day an *evening*
  reminder actually fires on.
- **A morning reminder ignores that cutoff.** It is the day after its night at
  every hour. 7am is past 4am, so the evening rule would fire a "Sunday night"
  wake-up on Sunday morning — twenty-three hours before the night it was set for.
  Same off-by-a-day, opposite direction, which is why `fireDay` takes a kind.
- **The streak holds through the day.** It counts back from tonight, or from
  yesterday if tonight hasn't happened yet — otherwise it would read zero all day
  until you did your routine.
- **Badges never come back off.** Streak badges measure *best* streak, so missing
  a night dims the streak on Tonight but takes nothing away.
- **Abandoned sessions are logged but never scored.** They show in history; they
  do not count toward badges or streaks.
- **The light level is a ceiling, not a multiplier.** It never brightens a phone
  that is already darker than the level asks for.
- **The light level is device-local and deliberately not synced.** A reminder time
  is a fact about a person; how dark a screen should go is a fact about *that
  screen in that room*.

---

## Roadmap status

| # | Section | State |
|---|---|---|
| 1 | Data & persistence | Done |
| 2 | App shell & navigation | Done |
| 3 | Design system | Done — a `Card` primitive would formally close it; Modules still hand-rolls its own |
| 4 | History, streaks & progress | Done |
| 5 | Routine builder | Done |
| 6 | Content library (30 stretches) | Done |
| 7 | Meditation & audio | Done |
| 8 | Reminders & scheduling | Done |
| 9 | Accounts & sync | Auth done incl. password reset; **full sync partial** |
| 10 | Sleep & wake — morning targets + alarms | Morning reminder done (5 Aug 2026). **A real alarm is not built** — see below |
| 11 | Lighting & environment | Done (4 Aug 2026) |
| 12 | Onboarding & settings | Onboarding done (3–4 Aug); settings continues to grow |
| 13 | Testing | Pure layer covered (155 assertions); **component rendering untested** |

### What item 10 still owes

The **morning reminder** shipped on 5 August 2026 and the notification half of
this section is done. Adding it was mostly what the previous version of this
document predicted — a third `ReminderId`, its copy, its channel, its default,
with the registry, the night strip and the Settings card already generic over the
id list — with one exception worth recording, because the prediction was wrong
about it and confidently so.

`fireDay` had **not** been written for this case. It rolled a reminder to the next
day only below the 4am cutoff, so a 7am wake time came out on the night's own
day: a "Sunday night" alarm at Sunday breakfast. It now takes a `ReminderKind`
and the two rules are separate and separately tested.

What is left is a **real alarm** — one that sounds through Do Not Disturb and a
silent switch. That needs Apple's critical-alert entitlement (an application, not
a flag) and Android's `USE_EXACT_ALARM` plus a full-screen intent, and it changes
what the feature can honestly promise. Until then the copy says "reminder" and
means it.

Also still open from this section: nothing yet **records** when you actually woke.
The sleep window Settings shows is derived from two settings, not from anything
observed, and it is labelled that way on purpose.

---

## Known gaps and risks

**Email delivery is the one thing that blocks real users.**

- Password reset is written and works, but **only for the project owner's own
  address**, until a sending domain is verified. Supabase's built-in email only
  delivers to org members; Resend's `onboarding@resend.dev` test domain only
  delivers to the account owner's exact address, and plus-addressing does not
  bypass it. When the send fails, Supabase 500s and rolls the token back.
- The Supabase **Reset password email template still needs `{{ .Token }}`** added,
  or the code never reaches the user at all.
- Auth → Rate Limits needs raising. Custom SMTP does not lift the ~2/hour cap on
  its own.

**Testing**

- 155 assertions, all over the pure layer. **No component renders in any test** —
  that would need jest-expo and real dependencies.
- Screenshots are react-native-web in Chromium. They catch overflow, wrapping and
  clipping; they say nothing about native shadows, font metrics or safe-area
  insets.
- Scheduled notifications have no automated check and cannot get one —
  `expo-notifications` has essentially no web scheduling, so a browser-driven
  check would verify nothing. `scheduledKeys()` exists to be called on a device.

**Platform**

- `expo-brightness` is believed bundled in Expo Go but **not yet verified on a
  device**. Every call is caught, so the worst case is that the dim silently
  no-ops.
- iOS has no supported way to deep-link into another part of Settings. The
  `App-Prefs:` scheme is private API and shipping it risks rejection, so on iOS
  the settings links land on Wick's own page and the caption says so. Android
  gets real intents.

**Open design questions**

- "You" is still a placeholder tab name — less so now that it is a real profile
  screen rather than a settings dump.
- Whether to restore one-tap-to-start in the stretch library. It is currently
  select-then-start, which is what fixed a nested-`Pressable` bug.

**Not started**

- No App Store or Play Store presence. No EAS build has been cut.
- No web or marketing site. Vercel was considered and rejected — this is a mobile
  app, and Vercel would only make sense for a future marketing site.
- No analytics, no crash reporting, no CI.

---

## Numbers

- ~15,700 lines of TypeScript/TSX across 13 screens, 16 components and ~25
  domain modules.
- 13 test files, 155 assertions, **zero test dependencies** — Node 24 strips
  TypeScript natively, so the runner is `node --test`.
- 30 stretches, 13 badges, 9 candle silhouettes, 12 wax colours, 4 breathing
  patterns, 3 guided scripts, 5 soundscapes, 4 light levels, 3 reminders.
- 4 Supabase tables (`profiles`, `routines`, `routine_steps`, `sessions`), all
  with RLS.
- 8 build/tooling scripts, none of which are a dependency: icons, bells,
  ambience, screenshots, an audio-lifecycle checker, a PNG encoder, a WAV
  encoder, and a TypeScript resolution hook.
