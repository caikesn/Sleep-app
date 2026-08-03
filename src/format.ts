/**
 * Formatting shared between screens, so the same number never gets written two
 * different ways in two places.
 */

/**
 * A count as a position: `1st`, `2nd`, `3rd`, `4th`, `21st`, `111th`.
 *
 * The rule is not "look at the last digit". Eleven, twelve and thirteen take
 * `th` despite ending in 1, 2 and 3 — and so does every hundred-and-eleventh
 * after them, which is why the teens are tested on `% 100` rather than on the
 * last two characters. Getting this wrong is invisible on the day you write it
 * and then reads as broken for two nights in every ten.
 */
export function ordinal(n: number): string {
  const teens = Math.abs(n) % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;

  switch (Math.abs(n) % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Minutes as a person would say them: `45m`, `1h`, `1h 24m`. */
export function formatTotal(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
