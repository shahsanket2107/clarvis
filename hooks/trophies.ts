// clarvis trophies: a fixed list, each earned once ever. The store keeps
// {id: unlockedAtMs}; this file only decides what is earned from plain facts,
// and words the /clarvis trophies list. Pure: no engine access.
import { dayKey } from './daily'

export type Trophy = { id: string; name: string; hint: string; text: string }
// `text` is the toast's words (the five first trophies keep the wording they had as achievements).
export const TROPHIES: readonly Trophy[] = [
  { id: 'hulk', name: 'Hulk Out', hint: 'smash 25 times in one session', text: 'Hulk Out: 25 smashes this session' },
  { id: 'hawkeye', name: 'Never Misses', hint: 'search 15 times in one session', text: 'Never Misses: 15 searches' },
  { id: 'century', name: 'On Your Left', hint: '100 actions in one session', text: 'On Your Left: 100 actions this session' },
  { id: 'ironman', name: 'I Am Iron Man', hint: 'a 25-action or 5-minute mission', text: 'I Am Iron Man: a 25-action (or 5-minute) mission' },
  { id: 'snap', name: 'Snap Survivor', hint: 'get back on mission after a snap', text: 'Snap Survivor: back on mission after a snap' },
  { id: 'firstCommit', name: 'First Commit', hint: 'let a commit land', text: 'First Commit: it is in the books' },
  { id: 'tenCommits', name: 'Ten Commits', hint: 'land 10 commits', text: 'Ten Commits' },
  { id: 'hundredCommits', name: 'Hundred Commits', hint: 'land 100 commits', text: 'Hundred Commits' },
  { id: 'firstPr', name: 'Assembled', hint: 'open a pull request', text: 'Assembled: your first pull request is up' },
  { id: 'greenWall', name: 'Green Wall', hint: '10 green test runs', text: 'Green Wall: 10 green test runs' },
  { id: 'nightShift', name: 'Night Shift', hint: 'finish a mission after 1am', text: 'Night Shift: a mission after 1am' },
  { id: 'nightOwl', name: 'Night Owl', hint: 'work past 1am on 3 different nights', text: 'Night Owl: three nights past 1am' },
  { id: 'earlyBird', name: 'Early Bird', hint: 'finish a mission between 5am and 7am', text: 'Early Bird: a mission at dawn' },
  { id: 'endgame', name: 'Endgame', hint: 'a mission that runs 60 minutes', text: 'Endgame: a 60-minute mission' },
  { id: 'binge', name: 'Binge Watcher', hint: 'watch all 10 episodes in the theater', text: 'Binge Watcher: all 10 episodes' },
  { id: 'opening', name: 'Opening Night', hint: 'watch an episode in the theater', text: 'Opening Night: your first episode' },
  { id: 'arcade50k', name: 'Arcade 50k', hint: 'score 50,000 in the arcade', text: 'Arcade 50k: 50,000 points' },
  { id: 'streak3', name: 'Three-Peat', hint: 'work 3 days in a row', text: 'Three-Peat: a 3-day streak' },
  { id: 'streak7', name: 'Streak 7', hint: 'work 7 days in a row', text: 'Streak 7: a week without a break' },
  { id: 'streak30', name: 'Monthly Mission', hint: 'work 30 days in a row', text: 'Monthly Mission: a 30-day streak' },
  { id: 'million', name: 'Million Tokens', hint: 'a million tokens, all time', text: 'Million Tokens: a million and counting' },
  { id: 'tenMillion', name: 'Ten Million Tokens', hint: 'ten million tokens, all time', text: 'Ten Million Tokens' },
  { id: 'cacheWizard', name: 'Cache Wizard', hint: '90% cache hits over a 50k+ token session', text: 'Cache Wizard: 90%+ cache hits' },
  { id: 'thousand', name: 'Thousand Actions', hint: '1,000 actions, all time', text: 'Thousand Actions' },
  { id: 'polyglot', name: 'Polyglot', hint: 'edit 5 kinds of file in one session', text: 'Polyglot: edits in 5 file types' },
  { id: 'regular', name: 'Regular', hint: 'open 10 sessions', text: 'Regular: ten sessions in' },
  { id: 'veteran', name: 'Veteran', hint: 'open 100 sessions', text: 'Veteran: a hundred sessions in' },
]
export const TROPHY_IDS: readonly string[] = TROPHIES.map(t => t.id)
const byId = new Map(TROPHIES.map(t => [t.id, t]))
export const trophyOf = (id: string): Trophy | undefined => byId.get(id)

/** The store's {id: ms}, made safe: only known ids with a positive finite time. */
export function sanitizeTrophies(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (byId.has(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
  }
  return out
}

/** Facts the trophies read. Every field is optional: a trophy whose fact is missing is not earned. */
export type Facts = {
  hour?: number // local hour 0..23 of a finished mission
  durationMs?: number
  tools?: number
  commits?: number; green?: number; prs?: number // lifetime counts
  streak?: number
  tokens?: number; toolCalls?: number; sessions?: number // lifetime
  moviesSeen?: number; moviesTotal?: number
  arcadeBest?: number
  session?: { input?: number; cacheHit?: number; extensions?: number } // input: all prompt tokens; cacheHit 0..1
  nights?: number // distinct days with a mission after 1am
}
/** Ids earned by these facts (earned or not before: the caller keeps only the new ones). */
export function earned(f: Facts): string[] {
  const out: string[] = []
  const add = (ok: boolean, id: string) => { if (ok) out.push(id) }
  const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
  const h = f.hour
  add(n(f.commits) >= 1, 'firstCommit'); add(n(f.commits) >= 10, 'tenCommits'); add(n(f.commits) >= 100, 'hundredCommits')
  add(n(f.prs) >= 1, 'firstPr'); add(n(f.green) >= 10, 'greenWall')
  add(typeof h === 'number' && h >= 1 && h < 5, 'nightShift'); add(n(f.nights) >= 3, 'nightOwl'); add(typeof h === 'number' && h >= 5 && h < 7, 'earlyBird')
  add(n(f.durationMs) >= 60 * 60_000, 'endgame')
  add(n(f.moviesSeen) >= 1, 'opening'); add(n(f.moviesTotal) > 0 && n(f.moviesSeen) >= n(f.moviesTotal), 'binge')
  add(n(f.arcadeBest) >= 50_000, 'arcade50k')
  add(n(f.streak) >= 3, 'streak3'); add(n(f.streak) >= 7, 'streak7'); add(n(f.streak) >= 30, 'streak30')
  add(n(f.tokens) >= 1_000_000, 'million'); add(n(f.tokens) >= 10_000_000, 'tenMillion')
  add(n(f.toolCalls) >= 1000, 'thousand')
  add(n(f.sessions) >= 10, 'regular'); add(n(f.sessions) >= 100, 'veteran')
  const s = f.session
  add(!!s && n(s.input) >= 50_000 && n(s.cacheHit) >= 0.9, 'cacheWizard')
  add(!!s && n(s.extensions) >= 5, 'polyglot')
  return out
}

/** The file extension an edit touched, lower-case without the dot; '' for none. */
export function extOf(path: unknown): string {
  if (typeof path !== 'string') return ''
  const base = path.split(/[\\/]/).pop() ?? ''
  const i = base.lastIndexOf('.')
  return i > 0 && i < base.length - 1 && base.length - i <= 8 ? base.slice(i + 1).toLowerCase() : ''
}

/** The /clarvis trophies text: unlocked with the date, locked as "??? · hint: ...", then "N/M unlocked". */
export function trophiesText(unlocked: Record<string, number>): string {
  const got = sanitizeTrophies(unlocked)
  const w = Math.max(...TROPHIES.map(t => t.name.length)) + 2
  const rows = ['TROPHIES', '']
  const have = TROPHIES.filter(t => got[t.id]), lack = TROPHIES.filter(t => !got[t.id])
  for (const t of have) rows.push(`  ★ ${t.name.padEnd(w)}${dayKey(new Date(got[t.id]!))}`)
  for (const t of lack) rows.push(`  · ??? · hint: ${t.hint}`)
  rows.push('', `  ${have.length}/${TROPHIES.length} unlocked`)
  return rows.join('\n')
}
