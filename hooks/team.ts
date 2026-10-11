// clarvis team: which heroes take the stage. The rotation itself stays in
// register.tsx (`order`, built from scenes.ts's ROSTER); this file only filters
// and orders a roster it is handed, matches names, and cleans what the store
// held. Pure: no engine access.
import { VILLAINS } from './season'

export type TeamId = 'avengers' | 'guardians' | 'wakanda' | 'cosmic' | 'all'
export const TEAM_IDS: TeamId[] = ['avengers', 'guardians', 'wakanda', 'cosmic', 'all']
// Presets name existing hero ids from ROSTER ('all' is the whole roster).
export const TEAMS: Record<Exclude<TeamId, 'all'>, string[]> = {
  avengers: ['ironman', 'cap', 'thor', 'hulk', 'widow', 'hawkeye', 'spidey', 'warmachine', 'falcon', 'bucky', 'vision', 'witch', 'antman', 'strange', 'cmarvel', 'jarvis', 'fury'],
  guardians: ['starlord', 'gamora', 'drax', 'rocket', 'groot', 'mantis', 'nebula', 'yondu'],
  wakanda: ['panther', 'cap', 'bucky', 'widow', 'falcon', 'hulk', 'warmachine', 'vision', 'witch', 'thor'],
  cosmic: ['cmarvel', 'thor', 'strange', 'loki', 'starlord', 'gamora', 'drax', 'rocket', 'groot', 'mantis', 'nebula', 'yondu'],
}
export const isTeam = (s: unknown): s is TeamId => typeof s === 'string' && (TEAM_IDS as string[]).includes(s)

/** The ids a person can pick: everyone on the roster except the generic "thinking" slot. */
export const pickable = (roster: readonly string[]): string[] => roster.filter(r => r !== 'thinking')

// ── names ───────────────────────────────────────────────────────────────────
const ALIASES: Record<string, string[]> = {
  ironman: ['tony', 'stark', 'tonystark', 'iron'], cap: ['captain', 'captainamerica', 'steve', 'rogers', 'steverogers'], thor: ['odinson'], hulk: ['banner', 'brucebanner'],
  widow: ['natasha', 'blackwidow', 'romanoff'], hawkeye: ['clint', 'barton'], spidey: ['spiderman', 'spider', 'peter', 'parker'], panther: ['blackpanther', 'tchalla', 'wakanda'],
  witch: ['scarletwitch', 'wanda'], strange: ['doctorstrange', 'drstrange', 'stephen'], antman: ['ant', 'scott', 'lang'], starlord: ['quill', 'peterquill', 'star'],
  warmachine: ['rhodey', 'rhodes', 'war'], cmarvel: ['captainmarvel', 'carol', 'danvers', 'marvel'], bucky: ['wintersoldier', 'winter', 'barnes'], jarvis: ['friday'],
  deadpool: ['wolverine', 'wade', 'deadpoolwolverine'], falcon: ['sam', 'wilson'], rocket: ['raccoon'], groot: ['tree'], fury: ['nick', 'nickfury'], loki: ['trickster'], ultron: ['robot'],
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
function dist(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 9
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]!
}
export type Match = { id: string; suggestions?: undefined } | { id?: undefined; suggestions: string[] }
/** Finds a hero from what was typed: an id, a display name, an alias, a prefix, a part of a name, or a near miss. */
export function findHero(q: string, ids: readonly string[], names: Record<string, string>): Match {
  const k = norm(q)
  const list = pickable(ids)
  if (!k) return { suggestions: list.slice(0, 8) }
  const keys = (id: string) => [norm(id), norm(names[id] ?? ''), ...(ALIASES[id] ?? []).map(norm)].filter(Boolean)
  const exact = list.find(id => keys(id).includes(k))
  if (exact) return { id: exact }
  const pre = list.filter(id => keys(id).some(x => x.startsWith(k)))
  if (pre.length === 1) return { id: pre[0]! }
  if (pre.length > 1) return { suggestions: pre.slice(0, 8) }
  const part = list.filter(id => k.length >= 3 && keys(id).some(x => x.includes(k)))
  if (part.length === 1) return { id: part[0]! }
  if (part.length > 1) return { suggestions: part.slice(0, 8) }
  const scored = list.map(id => ({ id, d: Math.min(...keys(id).map(x => dist(k, x))) })).filter(x => x.d <= 2).sort((a, b) => a.d - b.d)
  if (scored.length === 1 || (scored.length > 1 && scored[0]!.d < scored[1]!.d)) return { id: scored[0]!.id }
  return { suggestions: (scored.length ? scored.map(s => s.id) : list).slice(0, 8) }
}

// ── what is chosen, and where it is kept ────────────────────────────────────
export type Selection = { team: TeamId; pick?: string; here?: string }
export const HERE_MAX = 100
/** The stored global choice {team, pick}, made safe against the roster. */
export function sanitizeSel(raw: unknown, ids: readonly string[]): { team: TeamId; pick?: string } {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const ok = pickable(ids)
  return { team: isTeam(o.team) ? o.team : 'all', ...(typeof o.pick === 'string' && ok.includes(o.pick) ? { pick: o.pick } : {}) }
}
/** The per-project pins {cwd: id}, made safe and bounded. */
export function sanitizeHere(raw: unknown, ids: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const ok = pickable(ids)
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) { if (Object.keys(out).length >= HERE_MAX) break; if (k && k.length < 1024 && typeof v === 'string' && ok.includes(v)) out[k] = v }
  }
  return out
}
export function pinHere(here: Record<string, string>, cwd: string, id: string | undefined): Record<string, string> {
  const out = { ...here }
  if (id === undefined) delete out[cwd]
  else { delete out[cwd]; out[cwd] = id } // newest last
  const keys = Object.keys(out)
  for (const k of keys.slice(0, Math.max(0, keys.length - HERE_MAX))) delete out[k]
  return out
}

/** The ids on the stage for a choice: a project pin beats a global pick, a pick beats the team. */
export function stageIds(roster: readonly string[], sel: { team: TeamId; pick?: string }, here?: string): string[] {
  const ok = pickable(roster)
  if (here && ok.includes(here)) return [here]
  if (sel.pick && ok.includes(sel.pick)) return [sel.pick]
  if (sel.team === 'all') return [...roster]
  const want = TEAMS[sel.team]
  const out = roster.filter(r => want.includes(r))
  return out.length ? out : [...roster]
}

/**
 * The rotation order for a session: the stage ids shuffled by `rng`, then the seasons' touches. Villains come first at
 * Halloween and Thor takes a second slot on Thursdays; both only for the whole roster or a team (a pick stays a pick).
 */
export function orderFor(ids: readonly string[], o: { rng: () => number; villains?: boolean; thursday?: boolean }): string[] {
  const order = [...ids]
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(o.rng() * (i + 1)); [order[i], order[j]] = [order[j]!, order[i]!] }
  if (order.length < 2) return order
  let out = order
  if (o.villains) {
    const v = out.filter(x => VILLAINS.includes(x)), rest = out.filter(x => !VILLAINS.includes(x))
    out = [...v, ...rest]
  }
  // Halloween week belongs to the villains: Thor's Thursday slot waits (Oct 29, 2026 is both).
  if (o.thursday && !o.villains && out.includes('thor') && out.length >= 3) {
    // a second slot for Thor, half a lap after the first (never next to it)
    out = [...out]
    out.splice(((out.indexOf('thor') + Math.floor(out.length / 2)) % out.length) + 1, 0, 'thor')
  }
  return out
}
