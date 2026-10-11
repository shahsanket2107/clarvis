// clarvis ledger: the daily buckets behind /clarvis card, the lifetime extras
// (commits, green runs, pull requests, cache tokens, who did the work) and the
// day streak. Pure: dates are local `YYYY-MM-DD` strings made from a Date the
// caller hands in, so a test fixes the day. Whatever the store held is made
// safe before use.
import { num } from './metrics'

export const KEEP_DAYS = 35
export type Bucket = { turns: number; actions: number; commits: number; green: number; prs: number; inTok: number; outTok: number; cacheTok: number; cost: number; heroes: Record<string, number> }
export type Extras = { commits: number; green: number; prs: number; cacheTok: number; heroes: Record<string, number> }
export type Ledger = { life: Extras; days: Record<string, Bucket> }
export type Streak = { last: string; n: number; best: number }

/** Local calendar date, `2026-10-31`. */
export function dayKey(d: Date): string {
  const t = d.getTime()
  if (!Number.isFinite(t)) return '1970-01-01'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
/** The day `n` days before (positive n) a date, local. */
export function daysAgo(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n, 12) }
/** Whole days between two day keys (b - a), by calendar. */
export function dayDiff(a: string, b: string): number {
  const f = (k: string) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y!, m! - 1, d!) }
  return Math.round((f(b) - f(a)) / 86_400_000)
}

const whole = (x: unknown) => Math.floor(num(x))
const tally = (raw: unknown): Record<string, number> => {
  const out: Record<string, number> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    let k = 0
    for (const [id, n] of Object.entries(raw as Record<string, unknown>)) { if (k++ >= 60) break; if (/^[a-z0-9_-]{1,24}$/.test(id) && whole(n) > 0) out[id] = whole(n) }
  }
  return out
}
export const emptyBucket = (): Bucket => ({ turns: 0, actions: 0, commits: 0, green: 0, prs: 0, inTok: 0, outTok: 0, cacheTok: 0, cost: 0, heroes: {} })
export const emptyExtras = (): Extras => ({ commits: 0, green: 0, prs: 0, cacheTok: 0, heroes: {} })
export const emptyLedger = (): Ledger => ({ life: emptyExtras(), days: {} })
function cleanBucket(raw: unknown): Bucket {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  return { turns: whole(o.turns), actions: whole(o.actions), commits: whole(o.commits), green: whole(o.green), prs: whole(o.prs), inTok: whole(o.inTok), outTok: whole(o.outTok), cacheTok: whole(o.cacheTok), cost: num(o.cost), heroes: tally(o.heroes) }
}
export function sanitizeLedger(raw: unknown): Ledger {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const l = (o.life && typeof o.life === 'object' && !Array.isArray(o.life) ? o.life : {}) as Record<string, unknown>
  const days: Record<string, Bucket> = {}
  if (o.days && typeof o.days === 'object' && !Array.isArray(o.days)) {
    for (const [k, v] of Object.entries(o.days as Record<string, unknown>)) if (DAY_RE.test(k)) days[k] = cleanBucket(v)
  }
  return { life: { commits: whole(l.commits), green: whole(l.green), prs: whole(l.prs), cacheTok: whole(l.cacheTok), heroes: tally(l.heroes) }, days }
}

export type Delta = Partial<{ turns: number; actions: number; commits: number; green: number; prs: number; inTok: number; outTok: number; cacheTok: number; cost: number; heroes: Record<string, number> }>
const mergeHeroes = (a: Record<string, number>, b: Record<string, number> | undefined) => {
  const out = { ...a }
  for (const [k, n] of Object.entries(tally(b))) out[k] = (out[k] ?? 0) + n
  return out
}
/** Adds a delta to today's bucket and to the lifetime extras; drops buckets older than KEEP_DAYS. */
export function addToLedger(raw: unknown, today: Date, d: Delta): Ledger {
  const lg = sanitizeLedger(raw)
  const key = dayKey(today)
  const b = lg.days[key] ?? emptyBucket()
  b.turns += whole(d.turns); b.actions += whole(d.actions); b.commits += whole(d.commits); b.green += whole(d.green); b.prs += whole(d.prs)
  b.inTok += whole(d.inTok); b.outTok += whole(d.outTok); b.cacheTok += whole(d.cacheTok); b.cost += num(d.cost); b.heroes = mergeHeroes(b.heroes, d.heroes)
  lg.days[key] = b
  lg.life = { commits: lg.life.commits + whole(d.commits), green: lg.life.green + whole(d.green), prs: lg.life.prs + whole(d.prs), cacheTok: lg.life.cacheTok + whole(d.cacheTok), heroes: mergeHeroes(lg.life.heroes, d.heroes) }
  const oldest = dayKey(daysAgo(today, KEEP_DAYS - 1))
  for (const k of Object.keys(lg.days)) if (k < oldest) delete lg.days[k]
  return lg
}

// ── the streak ──────────────────────────────────────────────────────────────
export function sanitizeStreak(raw: unknown): Streak {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  return { last: typeof o.last === 'string' && DAY_RE.test(o.last) ? o.last : '', n: whole(o.n), best: whole(o.best) }
}
/** One more day of work: the same day changes nothing, the next day extends the run, a gap starts it again. */
export function bumpStreak(raw: unknown, today: Date): Streak {
  const s = sanitizeStreak(raw), key = dayKey(today)
  if (s.last === key) return s
  const gap = s.last ? dayDiff(s.last, key) : NaN
  const n = gap === 1 ? s.n + 1 : 1
  return { last: key, n, best: Math.max(s.best, n) }
}
/** The run as the band shows it today: a run that ended before yesterday is over. */
export function streakNow(raw: unknown, today: Date): number {
  const s = sanitizeStreak(raw)
  if (!s.last) return 0
  const gap = dayDiff(s.last, dayKey(today))
  return gap === 0 || gap === 1 ? s.n : 0
}
export const STREAK_TOASTS = [3, 7, 30]

// ── ranges for the card ─────────────────────────────────────────────────────
export type Range = 'today' | 'week' | 'all'
export type Sum = Bucket & { days: number }
/** Today's bucket, the last 7 days', or (all) the whole ledger: totals only. */
export function sumDays(lg: Ledger, today: Date, range: Range): Sum {
  const out: Sum = { ...emptyBucket(), days: 0 }
  const span = range === 'today' ? 1 : range === 'week' ? 7 : KEEP_DAYS
  const from = dayKey(daysAgo(today, span - 1)), to = dayKey(today)
  for (const [k, b] of Object.entries(lg.days)) {
    if (k < from || k > to) continue
    out.days++; out.turns += b.turns; out.actions += b.actions; out.commits += b.commits; out.green += b.green; out.prs += b.prs
    out.inTok += b.inTok; out.outTok += b.outTok; out.cacheTok += b.cacheTok; out.cost += b.cost; out.heroes = mergeHeroes(out.heroes, b.heroes)
  }
  return out
}
/** The hero with the most actions, ties broken by id; undefined when nobody worked. */
export function mvp(heroes: Record<string, number>): string | undefined {
  let best: string | undefined
  for (const [k, n] of Object.entries(heroes)) if (n > 0 && (best === undefined || n > heroes[best]! || (n === heroes[best] && k < best))) best = k
  return best
}
