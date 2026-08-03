# Onboarding & auth copy

Agreed 2026-08-03, alongside the plan to build first-run onboarding.

## The problem

Most of the app's copy already has a voice — terse, present-tense, states what's
true instead of explaining itself ("the wick is out — go to bed", "Real bulbs,
and a red filter for your screen"). Two spots don't: the Auth screen's
subtitles, and the first draft of onboarding copy, both of which slipped into
ordinary app-tutorial voice — narrating the feature ("we'll remind you",
"syncs across your devices") instead of just saying the thing.

**The tell:** if a sentence explains what the software is about to do for you,
it's the wrong voice. The right voice speaks like someone already standing in
the moment, not like a product describing itself.

## Auth screen (`src/screens/AuthScreen.tsx`)

| Mode | Before | After |
|---|---|---|
| Sign in | "Sign in to pick up your routines and history." | "Pick up where you left off." |
| Sign up | "Your routines and history sync across your devices." | "Everything you build stays with you." |

## Onboarding (new, first run after sign-up only)

Three screens, skippable, shown once. See [[project-roadmap]] item 12.

1. **This is Wick** — flame on screen carries the metaphor; copy is just
   "Lit at wind-down. Out by bed." No explainer line underneath — the visual
   already says it.
2. **Wind-down time** — heading "When does your evening start?" directly above
   the existing time picker (reused from Settings). No caption sentence.
3. **Tonight's routine** — shows the built-in routine already loaded. Heading
   "Tonight", the routine's name, and "Change it anytime in Modules." as the
   only body line.

Deliberately left out: the red-light tutorial. It's already reachable from
Settings and from inside a session; folding it in would make onboarding four
screens for a tip that isn't essential to night one.

## Why this is worth keeping

Voice regressions are easy to reintroduce — the tutorial-copy instinct is the
default one, and it will come back the next time a screen gets new copy
written under time pressure. This file is the check: does new copy explain
itself, or does it just say the thing.
