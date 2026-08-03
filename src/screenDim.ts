import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Brightness from 'expo-brightness';
import { type DimLevel, brightnessFor } from './lighting';

/**
 * Turning the screen down while a session runs, and — the part that matters —
 * putting it back.
 *
 * This is the audio bug's shape again: a global the app borrows, an async call
 * in the middle of taking it, and a user who never sees the leak until they are
 * somewhere else entirely. A soundscape that never stopped played until the app
 * was killed. A brightness that is never restored is worse, because on iOS
 * `setBrightnessAsync` moves the *system* slider — someone finishes a wind-down,
 * opens their phone the next morning outdoors, and it is at four percent with
 * nothing on screen to explain why.
 *
 * So the rules from `audio.ts` are the rules here:
 *
 * - The original brightness is captured once, before anything is changed, and
 *   restoring is unconditional — never contingent on the apply having finished.
 * - A generation counter guards every `await`, so a slow read can't install a
 *   value for a session that has already ended.
 * - Backgrounding restores. Leaving the app is leaving the session as far as
 *   the screen is concerned, and the OS gives no promise about what happens to
 *   a foreground brightness once you're gone.
 */

/**
 * What the screen was on before we touched it, or `null` when we are not
 * holding it. This is the single piece of state that must survive every path
 * out — every early return below is written to leave it correct.
 */
let original: number | null = null;

/** Invalidates in-flight work. Bumped by every acquire and every release. */
let generation = 0;

/**
 * Whether the platform can do this at all.
 *
 * Web is the one that matters in practice: the preview harness mounts the real
 * session screen in Chromium, and a module that threw on import would take the
 * screenshot tooling down with it.
 */
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Reads the current brightness, or NaN if the platform won't say.
 *
 * NaN rather than a guess: `brightnessFor` treats an unreadable reading as "the
 * ceiling stands on its own", which dims correctly. A fabricated 1.0 would do
 * the same thing but would also be *remembered* as the original and restored
 * later — turning a failed read into a screen set to full.
 */
async function readBrightness(): Promise<number> {
  try {
    return await Brightness.getBrightnessAsync();
  } catch {
    return NaN;
  }
}

async function setBrightness(value: number): Promise<void> {
  try {
    await Brightness.setBrightnessAsync(value);
  } catch {
    // Never throws into a session. Same rule as `audio.ts`: a stretch timer
    // must not die because the screen would not dim.
  }
}

/**
 * Take the screen down to `level`, remembering where it was.
 *
 * Safe to call repeatedly with a new level — the remembered original is only
 * captured on the first acquire, so stepping Soft → Dim → Dark inside one
 * session still restores to where the user actually had it, not to Soft.
 */
export async function acquireDim(level: DimLevel): Promise<void> {
  if (!SUPPORTED) return;

  if (level === 'off') {
    // Not a no-op: switching to Off mid-session has to hand the screen back.
    await releaseDim();
    return;
  }

  const mine = (generation += 1);

  const current = original ?? (await readBrightness());
  if (mine !== generation) return;

  const target = brightnessFor(level, current);
  if (target === null) return;

  // Recorded before the screen moves, and only if it is a number we could
  // actually restore to. A NaN reading means we dim without claiming to know
  // where to put it back — `releaseDim` then leans on the OS instead.
  if (original === null && Number.isFinite(current)) original = current;

  await setBrightness(target);
}

/**
 * Give the screen back. Unconditional, idempotent, and never awaits anything
 * before it has invalidated whatever else was in flight.
 */
export async function releaseDim(): Promise<void> {
  if (!SUPPORTED) return;

  // First, so an acquire that is mid-await cannot land after this returns and
  // leave the screen dimmed with nothing holding it.
  generation += 1;

  const restoreTo = original;
  original = null;

  if (restoreTo !== null) {
    await setBrightness(restoreTo);
    return;
  }

  // We dimmed without a usable reading of where it started. Hand it back to
  // the system rather than inventing a number — a guess here is the same bug
  // as never restoring, just harder to spot.
  try {
    await Brightness.restoreSystemBrightnessAsync();
  } catch {
    // Android-only in some SDK versions, and unavailable is not a failure worth
    // surfacing: on Android the window brightness reverts on its own anyway.
  }
}

/**
 * Dim for as long as this screen is mounted and in the foreground.
 *
 * Used by every screen that runs a timed session. The cleanup is the whole
 * point of the hook existing — every exit from a session (finish, End, back
 * gesture, a tapped notification pulling them elsewhere) unmounts the screen,
 * and all of them therefore restore.
 */
export function useScreenDim(level: DimLevel): void {
  useEffect(() => {
    void acquireDim(level);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void acquireDim(level);
      else void releaseDim();
    });

    return () => {
      sub.remove();
      void releaseDim();
    };
  }, [level]);
}
