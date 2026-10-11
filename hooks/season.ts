// clarvis seasons and easter eggs: pure, and the date and the dice are handed
// in so a test fixes both. Full mode only (the caller gates; nothing here
// touches the engine).

export type Season = 'halloween' | 'winter' | 'newyear'
export type Flair = 'halloween' | 'newyear' | 'groot' | 'shawarma'
/** Dates before this are never seasonal: a test clock at 0 (1 Jan 1970, a Thursday) must stay plain. */
const MIN_YEAR = 2024

/** Halloween Oct 25 to Nov 1, snow all of December, fireworks on New Year's Day. By local date. */
export function seasonOf(d: Date): Season | null {
  if (!Number.isFinite(d.getTime()) || d.getFullYear() < MIN_YEAR) return null
  const m = d.getMonth(), day = d.getDate()
  if ((m === 9 && day >= 25) || (m === 10 && day === 1)) return 'halloween'
  if (m === 0 && day === 1) return 'newyear'
  if (m === 11) return 'winter'
  return null
}
export const isRealDate = (d: Date): boolean => Number.isFinite(d.getTime()) && d.getFullYear() >= MIN_YEAR
export const isThursday = (d: Date): boolean => Number.isFinite(d.getTime()) && d.getFullYear() >= MIN_YEAR && d.getDay() === 4

/** The flair a moment of the season carries (winter's snow lives on the band, not on a moment). */
export function flairOf(s: Season | null): Flair | undefined { return s === 'halloween' ? 'halloween' : s === 'newyear' ? 'newyear' : undefined }
export function seasonCaption(s: Season | null): string | undefined {
  return s === 'halloween' ? '"Trick or treat. The villains have the floor tonight."' : s === 'newyear' ? '"Happy New Year, Avengers. Make it a good one."' : undefined
}
/** The villains Halloween features up front in the rotation. */
export const VILLAINS: readonly string[] = ['ultron', 'loki', 'nebula', 'bucky']

// ── easter eggs ─────────────────────────────────────────────────────────────
export const EGG_ODDS = 150
export const SHAWARMA_MS = 3 * 60 * 60_000
export const EGG_CAPTIONS: Record<'groot' | 'shawarma', string> = { groot: '"I am Groot." (the dance floor is open)', shawarma: '"Shawarma break?"' }
/** One roll per finished turn: 1 in 150. A session past three hours may get the shawarma line instead of the dance. */
export function rollEgg(rng: () => number, o: { sessionMs: number }): 'groot' | 'shawarma' | undefined {
  const r = rng()
  if (!(typeof r === 'number' && r >= 0 && r < 1 / EGG_ODDS)) return undefined
  if (o.sessionMs >= SHAWARMA_MS) return rng() < 0.5 ? 'shawarma' : 'groot'
  return 'groot'
}
