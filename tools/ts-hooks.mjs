/**
 * Lets Node's test runner resolve the app's imports.
 *
 * Metro is happy with `import { nightOf } from './streak'`, but Node's ESM
 * resolver demands a file extension. Rather than write `./streak.ts` through
 * the app source — which is unusual to read and would tie the source to the
 * test runner — this retries a failed relative specifier as `.ts`, then as a
 * directory index.
 *
 * Nothing here runs in the app. It is loaded only by `npm test`.
 */
const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (!relative || error.code !== 'ERR_MODULE_NOT_FOUND') throw error;

    for (const suffix of CANDIDATES) {
      try {
        return await nextResolve(specifier + suffix, context);
      } catch {
        // Try the next shape; if none work, the original error is the honest one.
      }
    }
    throw error;
  }
}
