// clarvis AVENGERS THEATER: a movie resolved for one viewing. Every
// choice the script leaves open (a pool of lines, a branch, a rematch, the
// blows of a trade) is picked here with the viewing's seed, once, so the
// drawing is a pure function of (plan, time). Pure data: no art.
import { BEAT_S, COVER_S, SAY_S, type Beat, type BeatKind, type Bg, type CharId, type FxKind, type Movie, type Pool, type Side, type TeamMove } from './saga-types'

export type PBeat = {
  k: BeatKind | 'cover' | 'credits' | 'sting'
  l: CharId | ''; r: CharId | ''
  by: Side | CharId | '' // who acts or speaks
  text: string // the line (say), the narration (est) or the card's words
  style: 0 | 1 | 2 // balloon: 0 speech, 1 shout (jagged), 2 thought
  sfx: string; fx: FxKind | ''
  win: Side
  n: number // trade: exchanges
  att: Side[]; hit: boolean[]; move: number[] // trade: who attacks each exchange, whether it lands, the pose (4 punch, 5 special, 8 jump)
  who: CharId[]; rw: CharId[]
  ext: CharId[]; extIn: CharId[]; extOut: CharId[] // bystanders on stage, those who walk in this beat, those who walk off
  mv: TeamMove | ''
  brawl: boolean // the bystanders fight in pairs
  earlier: CharId[] // arrive: who already came through this scene
  cap: string // the caption box ('' none)
  scene: number; sceneCap: string; bg: Bg
  start: number; d: number
}
// Beats that put the scene's bystanders on stage.
const STAGED = new Set<string>(['est', 'enter', 'say', 'talk', 'group', 'trade', 'special', 'super', 'clash', 'ko', 'stand', 'exit'])
export const CREDITS_S = 10, STING_S = 5
// After the credits: one more line from someone in the movie (PG, and a little self-aware).
const STINGS = ['So... shawarma?', 'Is the build done yet?', "I'm gonna need a bigger terminal.", 'Did anyone else stay for the credits?', 'Same time next session?', 'We should really write some tests.']
export type Plan = { movie: Movie; beats: PBeat[]; len: number; seed: number }

export function rng(seed: number) {
  let h = seed >>> 0 || 1
  return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const mixSeed = (a: number, s: string) => { let h = (a ^ 2166136261) >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0 }

export function plan(movie: Movie, seed: number): Plan {
  const rnd = rng(mixSeed(seed, movie.id))
  const pick = <T,>(p: Pool<T> | undefined, d: T): T => (p === undefined ? d : Array.isArray(p) ? (p.length ? p[Math.floor(rnd() * p.length)]! : d) : (p as T))
  const beats: PBeat[] = []
  let t = 0
  const push = (b: Omit<PBeat, 'start'>) => { beats.push({ ...b, start: t }); t += b.d }
  const blank = (k: PBeat['k'], scene: number, sceneCap: string, bg: Bg): Omit<PBeat, 'start'> => ({
    k, l: '', r: '', by: '', text: '', style: 0, sfx: '', fx: '', win: 'l', n: 0, att: [], hit: [], move: [], who: [], rw: [], ext: [], extIn: [], extOut: [], mv: '', brawl: false, earlier: [], cap: '', scene, sceneCap, bg, d: 0,
  })
  let scenes = movie.scenes.slice()
  if (movie.shuffle && scenes.length > 3) {
    const mid = scenes.slice(1, -1)
    for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [mid[i], mid[j]] = [mid[j]!, mid[i]!] }
    scenes = [scenes[0]!, ...mid, scenes[scenes.length - 1]!]
  }
  // a film: the cold open (the first scene), the studio card and the title, the acts,
  // the finale, rolling end credits, then a post-credits sting
  scenes.forEach((sc, si) => {
    if (si === 1 || scenes.length === 1) push({ ...blank('cover', -1, '', sc.bg), d: COVER_S, text: movie.title, cap: movie.blurb })
    let l: CharId | '' = '', r: CharId | '' = ''
    const earlier: CharId[] = []
    let ext: CharId[] = [...(sc.ext ?? [])], prevExt: CharId[] = [], brawl = sc.brawl ?? false
    const one = (b: Beat) => {
      if (b.alt?.length) { for (const x of b.alt[Math.floor(rnd() * b.alt.length)]!) one(x); return }
      if (b.l !== undefined) l = b.l === '' ? '' : pick(b.l as Pool<CharId>, l || 'CAP')
      if (b.r !== undefined) r = b.r === '' ? '' : pick(b.r as Pool<CharId>, r || 'IRONMAN')
      if (b.k === 'group') { const w = b.who ?? []; l = w[0] ?? l; r = w[1] ?? r; ext = w.slice(2) }
      else if (b.ext) ext = [...b.ext]
      if (b.brawl !== undefined) brawl = b.brawl
      const staged = STAGED.has(b.k)
      const here = staged ? ext.filter(x => (x !== l && x !== r) || ext.indexOf(x) !== ext.lastIndexOf(x)) : [] // a name listed twice is a deliberate double (the Mirror Dimension's Stranges)
      const base = { ...blank(b.k === 'group' ? 'say' : b.k, si, sc.cap, sc.bg), l, r, ext: here, extIn: here.filter(x => !prevExt.includes(x)), extOut: prevExt.filter(x => !here.includes(x) && x !== l && x !== r), mv: b.move ?? '' as TeamMove | '', brawl: staged && brawl, cap: b.cap ?? (b.k === 'est' ? sc.cap : ''), fx: (b.fx ?? '') as FxKind | '', sfx: pick(b.sfx, ''), who: [...(b.who ?? [])], rw: [...(b.rw ?? [])] }
      const line = (by: Side | CharId, p: Pool<string>) => {
        let s = pick(p, '')
        const style = s.startsWith('!') ? 1 : s.startsWith('~') ? 2 : 0
        if (style) s = s.slice(1)
        push({ ...base, k: 'say', by, text: s, style, cap: base.cap, d: b.d ?? SAY_S(s) })
        base.cap = '' // a caption shows on the first panel only
        base.extIn = []; base.extOut = [] // walking in or off happens on a shot's first panel only
      }
      switch (b.k) {
        case 'group': case 'talk': for (const [by, p] of b.lines ?? []) { line(by, p) } prevExt = here; return
        case 'say': line(b.by ?? 'l', b.say ?? ''); prevExt = here; return
        case 'trade': {
          const n = b.n ?? 3, att: Side[] = [], hit: boolean[] = [], move: number[] = []
          let s: Side = rnd() < 0.5 ? 'l' : 'r'
          for (let i = 0; i < n; i++) { att.push(s); hit.push(rnd() < 0.62); move.push([4, 4, 5, 8][Math.floor(rnd() * 4)]!); if (rnd() < 0.7) s = s === 'l' ? 'r' : 'l' }
          push({ ...base, n, att, hit, move, d: b.d ?? BEAT_S.trade * n }); prevExt = here
          return
        }
        case 'arrive': {
          push({ ...base, fx: b.fx ?? 'portal', earlier: earlier.slice(), text: pick(b.say, ''), d: b.d ?? BEAT_S.arrive })
          earlier.push(...base.who); prevExt = here
          return
        }
        default: {
          const win: Side = b.win === '?' ? (rnd() < 0.5 ? 'l' : 'r') : (b.win ?? 'l')
          push({ ...base, by: b.by ?? (b.k === 'ko' ? win : 'l'), win, text: pick(b.say, ''), d: b.d ?? BEAT_S[b.k] }); prevExt = here
        }
      }
    }
    for (const b of sc.beats) one(b)
  })
  push({ ...blank('credits', -2, '', 'void'), d: CREDITS_S, text: movie.title })
  const last = scenes[scenes.length - 1]!, cast = [...new Set(beats.flatMap(b => [b.l, b.r]).filter(Boolean))] as CharId[]
  const who = cast.length ? cast[Math.floor(rnd() * cast.length)]! : movie.hero
  push({ ...blank('sting', -3, '', last.bg), d: STING_S, l: who, by: 'l', text: STINGS[Math.floor(rnd() * STINGS.length)]! })
  return { movie, beats, len: t, seed }
}

// Which beat holds time t (binary search), and how far into it.
export function beatAt(p: Plan, t: number): number {
  let lo = 0, hi = p.beats.length - 1
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (p.beats[m]!.start <= t) lo = m; else hi = m - 1 }
  return lo
}
// Everyone a plan puts on stage or gives a line.
export function castOf(p: Plan): Set<CharId> {
  const s = new Set<CharId>()
  for (const b of p.beats) {
    for (const c of [b.l, b.r, ...b.who, ...b.rw, ...b.ext]) if (c) s.add(c)
    if (b.by && b.by !== 'l' && b.by !== 'r') s.add(b.by)
  }
  return s
}

// How many characters a shot shows: the ensemble measure (cover, credits, cards and the sting do not count).
export function onScreen(b: PBeat): number {
  switch (b.k) {
    case 'cover': case 'credits': case 'card': case 'sting': return 0
    case 'crowd': case 'charge': return b.who.length + b.rw.length // an army, drawn small at the back
    case 'battle': case 'teamup': return Math.min(b.who.length + b.rw.length, 6) // a few duels at a time
    case 'arrive': return Math.min(6, b.earlier.length + b.who.length)
    case 'snap': return Math.min(Math.max(b.who.length, 1) + 1, 6)
    default: {
      let n = (b.l ? 1 : 0) + (b.r ? 1 : 0) + Math.min(b.ext.length, b.brawl ? 4 : 6)
      if (n === 0 && b.by && b.by !== 'l' && b.by !== 'r') n++ // a lone voice-only speaker is drawn alone; a radio voice beside others is heard, not seen
      return Math.min(n, 6) // one row holds six at most in a small pane
    }
  }
}
// The share of the story's runtime (cover, credits, cards and the sting aside) that shows `min` or more characters.
export function ensembleShare(p: Plan, min = 3): number {
  let all = 0, many = 0
  for (const b of p.beats) { if (b.k === 'cover' || b.k === 'credits' || b.k === 'card' || b.k === 'sting') continue; all += b.d; if (onScreen(b) >= min) many += b.d }
  return all ? many / all : 0
}
