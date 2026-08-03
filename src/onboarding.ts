import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether this device owes someone the first-run walkthrough.
 *
 * Deliberately a flag written at *sign-up* rather than "no session has been
 * seen here before". Signing in on a second phone is not a first run — the
 * routines and the wind-down time already exist, and walking someone through
 * picking them again would offer to overwrite settings they made months ago.
 * The only moment that is genuinely night one is the moment an account is
 * created, so that is the moment that sets the flag.
 *
 * It survives the confirm-your-email detour, because it lives on the device and
 * not in the session: sign up, tap the link, come back and sign in, and the
 * walkthrough is still waiting.
 */
const PENDING_KEY = 'onboarding_pending_v1';

export async function markOnboardingPending(): Promise<void> {
  await AsyncStorage.setItem(PENDING_KEY, 'true');
}

export async function isOnboardingPending(): Promise<boolean> {
  return (await AsyncStorage.getItem(PENDING_KEY)) === 'true';
}

/** Called when the walkthrough is finished *or* skipped — both mean "seen". */
export async function clearOnboardingPending(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_KEY);
}
