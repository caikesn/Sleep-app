/**
 * Formatting shared between screens, so the same number never gets written two
 * different ways in two places.
 */

/** Minutes as a person would say them: `45m`, `1h`, `1h 24m`. */
export function formatTotal(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
