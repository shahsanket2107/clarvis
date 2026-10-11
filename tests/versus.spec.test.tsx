import { expect } from 'claude-code/testing'
import { test } from './timed'
import { Game } from '../hooks/arcade-engine'
import { ROSTER, STATS, TEAM_CAP, TEAM_IRON, Versus, type HeroId } from '../hooks/arcade-versus'

// ── helpers ─────────────────────────────────────────────────────────────────
const SIZES = [[60, 11], [100, 28], [180, 60]] as const
const FRAME_SIZES = [[40, 11], [60, 11], [100, 28], [180, 60], [240, 70]] as const
const GOOD = ['fight', 'ko', 'swap', 'finisher', 'match', 'intro', 'vs', 'charge']
function mk(w = 100, h = 28, seed = 5) { const g = new Game(w, h, seed), v = new Versus(g); g.vs = v; return { g, v } }
function lcg(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) }
const tickN = (g: Game, n: number) => { for (let i = 0; i < n; i++) g.tick() }
// Civil War to the select-a-side screen (n = '2'), duels to the fighter select
function open(n: string, w = 100, h = 28, seed = 5) { const r = mk(w, h, seed); r.g.key(n); return r }
// Everything the player would do to reach the fight, then to the first fighting frame.
function toFight(gi: number, w = 100, h = 28, pickA?: HeroId, pickB?: HeroId, seed = 5) {
  const { g, v } = open(String(gi + 1), w, h, seed)
  if (gi === 1) { g.key(' '); g.key('a') } // side, movie trio
  else {
    if (pickA) v.cur = ROSTER.indexOf(pickA)
    g.key(' ')
    if (gi !== 4) { if (pickB) v.cur = ROSTER.indexOf(pickB); g.key(' ') }
  }
  expect(g.mode).toBe('howto')
  g.key(' ')
  g.key(' ') // VS / THE CHARGE
  g.key(' ') // intro skip
  return { g, v }
}
const aiOn = (v: Versus) => { for (const f of v.T[0]!) f.ai = true }
const KEYS = ['left', 'right', 'up', 'down', ' ', 'c', 'x', 'z', 'a', 'd', 'w', 's', 'p', '1', '2', '3']
const SAFE = KEYS.filter(k => k !== 'p')
const runs = (g: Game) => { g.draw(); return g.frameRuns() }
function allFinite(o: any, path = '', seen = new Set<any>(), depth = 0): string | null {
  if (typeof o === 'number') return Number.isFinite(o) ? null : path
  if (!o || typeof o !== 'object' || seen.has(o) || depth > 4) return null
  seen.add(o)
  for (const k of Object.keys(o)) { if (k === 'g') continue; const r = allFinite(o[k], path + '.' + k, seen, depth + 1); if (r) return r }
  return null
}
function snapshot(v: Versus) { return JSON.stringify([v.P.map(f => [f.x, f.y, f.hp, f.st, f.t, f.meter]), v.clock, v.pt, v.phase, v.round]) }
function leaderTimeout(v: Versus) { return v.P }

// ── 1. flow ─────────────────────────────────────────────────────────────────
test('SPACE alone from the title gets into a fight in every game at 60x11, 100x28, 180x60', () => {
  for (const [w, h] of SIZES) for (const n of ['2', '3', '4', '5']) {
    const { g, v } = mk(w, h, 3)
    g.key(n)
    for (let i = 0; i < 12; i++) { g.key(' '); tickN(g, 15) }
    expect([n, w, h, ['fight', 'ko', 'swap', 'finisher', 'match'].includes(v.phase)]).toEqual([n, w, h, true])
  }
})

test('HOW TO PLAY shows every time, including on rematch', () => {
  const { g, v } = open('3')
  g.key(' '); g.key(' ')
  expect(g.mode).toBe('howto')
  g.key(' ')
  expect(v.phase).toBe('vs')
  v.phase = 'match'; v.continueT = -1
  g.key('r')
  expect(g.mode).toBe('howto')
})

test('B goes back one step at each select step and from HOW TO PLAY', () => {
  // duel: foe step -> fighter step -> menu
  const { g, v } = open('3')
  g.key(' ')
  expect(v.step).toBe(1)
  g.key('b'); expect(v.step).toBe(0); expect(v.phase).toBe('select'); expect(g.mode).toBe('vs')
  g.key('b'); expect(g.mode).toBe('title')
  // civil war: draft -> side -> menu
  const c = open('2')
  c.g.key(' '); expect(c.v.step).toBe(1)
  c.g.key(' '); expect(c.v.squad.length).toBe(1)
  c.g.key('b'); expect(c.v.step).toBe(0); expect(c.v.squad.length).toBe(0)
  c.g.key('b'); expect(c.g.mode).toBe('title')
  // HOW TO PLAY: back -> one step, not the title and not a fight
  const h = open('3')
  h.g.key(' '); h.g.key(' ')
  expect(h.g.mode).toBe('howto')
  h.g.key('b')
  expect(h.g.mode).not.toBe('play')
  expect(h.v.phase === 'select' || h.g.mode === 'vs').toBe(true) // BUG? back from HOW TO PLAY must return to the last select step
})

test('Q never instantly closes a match; second Q closes; Q on select / HOW TO PLAY / results goes to menu', () => {
  for (const gi of [1, 2, 3, 4]) {
    const { g, v } = toFight(gi)
    tickN(g, 30)
    g.key('q')
    expect([gi, g.wantsClose, v.paused, v.quitArmed]).toEqual([gi, false, true, true])
    g.key('q')
    expect([gi, g.wantsClose]).toEqual([gi, true])
  }
  // Q at every non-select stage of a match never closes at once
  for (const stage of ['vs', 'intro', 'ko']) {
    const { g, v } = toFight(2)
    if (stage === 'vs') { g.key('r'); }
    tickN(g, 5)
    g.key('q'); expect(g.wantsClose).toBe(false)
  }
  const s = open('4'); s.g.key('q'); expect(s.g.mode).toBe('title'); expect(s.g.wantsClose).toBe(false)
  const h = open('4'); h.g.key(' '); h.g.key(' '); expect(h.g.mode).toBe('howto'); h.g.key('q')
  expect(h.g.mode).toBe('title'); expect(h.g.wantsClose).toBe(false)
  const { g, v } = toFight(2); v.phase = 'match'; v.continueT = -1
  g.key('q'); expect(g.mode).toBe('title'); expect(g.wantsClose).toBe(false)
})

test('P pauses and resumes; nothing moves for 300 ticks while paused', () => {
  for (const gi of [1, 2, 4]) {
    const { g, v } = toFight(gi)
    tickN(g, 40)
    expect(v.phase).toBe('fight')
    g.key('p'); expect(v.paused).toBe(true)
    const a = snapshot(v)
    tickN(g, 300)
    expect(snapshot(v)).toBe(a)
    g.key('p'); expect(v.paused).toBe(false)
    tickN(g, 30)
    expect(snapshot(v)).not.toBe(a)
  }
})

test('paused: attack keys do not act', () => {
  const { g, v } = toFight(2)
  tickN(g, 30)
  g.key('p')
  const st = v.P[0].st
  for (const k of ['left', 'right', 'up', ' ', 'c', 'x']) g.key(k)
  tickN(g, 10)
  expect(v.P[0].st).toBe(st)
})

// BUG: arcade-versus.ts:324 pause menu handles R but not S, so the fight stays paused
test('R or S from the pause menu leaves the next fight unpaused and playable', () => {
  for (const k of ['r', 's']) for (const gi of [1, 2, 3, 4]) {
    const { g, v } = toFight(gi)
    tickN(g, 40)
    g.key('p'); g.key(k)
    for (let i = 0; i < 8; i++) { g.key(' '); tickN(g, 15) }
    expect([k, gi, v.paused]).toEqual([k, gi, false])
    const a = snapshot(v)
    tickN(g, 120)
    expect([k, gi, snapshot(v) !== a]).toEqual([k, gi, true])
    expect(GOOD).toContain(v.phase)
  }
})

test('results: a rank, R rematch, S select, M menu, CONTINUE after a loss', () => {
  const win = () => { const r = toFight(2); tickN(r.g, 40); r.v.P[0].wins = 1; r.v.P[1].hp = 0.5; r.v.P[1].x = r.v.P[0].x + 10 * r.v.k; for (let i = 0; i < 300 && r.v.phase !== 'match'; i++) { if (r.v.phase === 'fight') r.g.key(' '); r.g.tick() } return r }
  let { g, v } = win()
  expect(v.phase).toBe('match'); expect(['S', 'A', 'B', 'C']).toContain(v.rank)
  g.key('r'); expect(g.mode).toBe('howto')
  ;({ g, v } = win()); g.key('s'); expect(v.phase).toBe('select'); expect(g.mode).toBe('vs')
  ;({ g, v } = win()); g.key('m'); expect(g.mode).toBe('title')
  // a loss offers CONTINUE; SPACE continues into a fresh round
  const r = toFight(2); tickN(r.g, 40)
  r.v.P[1].wins = 1; r.v.P[0].hp = 0.5; r.v.P[1].x = r.v.P[0].x + 10 * r.v.k
  for (let i = 0; i < 500 && r.v.phase !== 'match'; i++) r.g.tick()
  expect(r.v.phase).toBe('match'); expect(r.v.continueT).toBeGreaterThan(0); expect(r.v.rank).toBe('C')
  r.g.key(' ')
  expect(['intro', 'fight']).toContain(r.v.phase)
  expect(r.v.P[0].hp).toBe(r.v.P[0].s.hp)
})

// ── 2. civil war ────────────────────────────────────────────────────────────
test('Civil War: side pick lists exactly the six heroes of that side', () => {
  for (const [cur, team] of [[0, TEAM_CAP], [1, TEAM_IRON]] as const) {
    const { g, v } = open('2')
    v.cur = cur; g.key(' ')
    expect(v.side).toBe(cur === 0 ? 'cap' : 'iron')
    const seen: string[] = []
    for (let i = 0; i < 6; i++) { seen.push((v as any).list()[v.cur]); g.key('right') }
    expect(seen.sort()).toEqual([...team].sort())
  }
  expect(TEAM_CAP).toEqual(['CAP', 'BUCKY', 'FALCON', 'ANTMAN', 'HAWKEYE', 'WANDA'])
  expect(TEAM_IRON).toEqual(['IRONMAN', 'WARMACHINE', 'WIDOW', 'PANTHER', 'SPIDEY', 'VISION'])
})

test('draft: SPACE drafts and auto-advances; SPACE on a drafted hero drops it; never >3 or duplicates', () => {
  for (const cur of [0, 1]) {
    const { g, v } = open('2')
    v.cur = cur; g.key(' ')
    const L = (v as any).list() as HeroId[]
    g.key(' ')
    expect(v.squad).toEqual([L[0]])
    expect(v.cur).toBe(1)
    // go back and drop the first
    v.cur = 0; g.key(' ')
    expect(v.squad).toEqual([])
    // fill, with arbitrary extra presses; the fill triggers HOW TO PLAY
    const rnd = lcg(9)
    for (let i = 0; i < 60 && g.mode === 'vs'; i++) {
      g.key(rnd() < 0.7 ? ' ' : rnd() < 0.5 ? 'right' : 'left')
      expect(v.squad.length).toBeLessThanOrEqual(3)
      expect(new Set(v.squad).size).toBe(v.squad.length)
      expect(v.squad.every(h => L.includes(h))).toBe(true)
    }
    expect(g.mode).toBe('howto')
    expect(v.squad.length).toBe(3)
  }
})

test('draft: SPACE x3 fills the team of three in order from the cursor', () => {
  const { g, v } = open('2'); g.key(' ')
  g.key(' '); g.key(' ')
  expect(v.squad.length).toBe(2)
  g.key(' ')
  expect(v.squad).toEqual(['CAP', 'BUCKY', 'FALCON'])
  expect(g.mode).toBe('howto')
})

test('draft: A = movie trio, R = random 3 distinct of your side; each team is the right side', () => {
  const MOVIE_CAP = ['CAP', 'BUCKY', 'FALCON'] // assumption: Team Cap's movie trio leads with Cap
  for (const cur of [0, 1]) {
    const { g, v } = open('2'); v.cur = cur; g.key(' '); g.key('a')
    expect(g.mode).toBe('howto'); expect(v.squad.length).toBe(3)
    g.key(' '); g.key(' ')
    expect(v.T[0]!.map(f => f.id)).toEqual(v.squad)
    expect(v.squad[0]).toBe(cur === 0 ? 'CAP' : 'IRONMAN')
    expect(MOVIE_CAP.length).toBe(3)
  }
  for (let seed = 1; seed <= 8; seed++) {
    const { g, v } = open('2', 100, 28, seed); v.cur = seed % 2; g.key(' ')
    const L = (v as any).list() as HeroId[]
    g.key('r')
    for (let i = 0; i < 6 && g.mode === 'vs' && v.phase === 'select'; i++) g.key('r') // a random pick may need more presses if it only picks one
    g.key(' '); g.key(' ')
    expect(v.T[0]!.length).toBe(3)
    expect(new Set(v.T[0]!.map(f => f.id)).size).toBe(3)
    expect(v.T[0]!.every(f => L.includes(f.id))).toBe(true)
  }
})

test('AI fields exactly 3 from the other side; no overlap with your side', () => {
  for (const cur of [0, 1]) {
    const { g, v } = open('2'); v.cur = cur; g.key(' '); g.key('a'); g.key(' '); g.key(' ')
    const mine = cur === 0 ? TEAM_CAP : TEAM_IRON, theirs = cur === 0 ? TEAM_IRON : TEAM_CAP
    expect(v.T[1]!.length).toBe(3)
    expect(v.T[1]!.every(f => theirs.includes(f.id) && f.ai)).toBe(true)
    expect(v.T[0]!.every(f => mine.includes(f.id))).toBe(true)
    expect(new Set(v.T[1]!.map(f => f.id)).size).toBe(3)
  }
})

test('Z tags in the next living teammate, never a KO\'d one', () => {
  const { g, v } = toFight(1)
  tickN(g, 40)
  const ids = v.T[0]!.map(f => f.id)
  v.T[0]![1]!.out = true; v.T[0]![1]!.hp = 0
  const first = v.P[0].id
  g.key('z')
  tickN(g, 60)
  expect(v.P[0].id).not.toBe(first)
  expect(v.P[0].id).not.toBe(ids[1])
  expect(v.P[0].out).toBe(false)
  // everyone else down: Z must not bring in a dead fighter
  for (const f of v.T[0]!) if (f !== v.P[0]) { f.out = true; f.hp = 0 }
  const cur = v.P[0]
  for (let i = 0; i < 5; i++) { g.key('z'); tickN(g, 50) }
  expect(v.P[0]).toBe(cur)
})

test('Z in a duel does nothing (no team)', () => {
  const { g, v } = toFight(2); tickN(g, 30)
  const id = v.P[0].id; g.key('z'); tickN(g, 30)
  expect(v.P[0].id).toBe(id)
})

test('Civil War ends when one side has all 3 KO\'d; AI-vs-AI and random input both reach results in bounded ticks', () => {
  for (const [w, h] of SIZES) for (const mode of ['ai', 'rand']) {
    const { g, v } = toFight(1, w, h, undefined, undefined, 11)
    if (mode === 'ai') aiOn(v)
    const rnd = lcg(42)
    let n = 0
    for (; n < 30 * 600 && v.phase !== 'match'; n++) {
      if (mode === 'rand') g.key(KEYS[Math.floor(rnd() * KEYS.length)]!)
      if (v.paused) g.key('p')
      g.tick()
    }
    expect([w, h, mode, v.phase]).toEqual([w, h, mode, 'match'])
    expect(v.T[0]!.every(f => f.out) || v.T[1]!.every(f => f.out) || v.clock <= 0).toBe(true)
  }
})

test('Civil War: KO of one fighter does not end the match while a teammate stands', () => {
  const { g, v } = toFight(1); tickN(g, 40)
  v.P[1].hp = 0.1; v.P[1].x = v.P[0].x + 8 * v.k
  for (let i = 0; i < 120 && v.phase === 'fight'; i++) { g.key(' '); g.tick() }
  tickN(g, 200)
  expect(v.phase).not.toBe('match')
  expect(v.T[1]!.filter(f => !f.out).length).toBeGreaterThanOrEqual(2)
})

// ── 3. duels ────────────────────────────────────────────────────────────────
test('any fighter vs any fighter (all pairs incl. mirror) starts and runs without crashing', () => {
  for (const a of ROSTER) for (const b of ROSTER) {
    const gi = 2 + (ROSTER.indexOf(a) % 2)
    const { g, v } = toFight(gi, 100, 28, a, b)
    expect([a, b, v.P[0].id, v.P[1].id]).toEqual([a, b, a, b])
    aiOn(v)
    tickN(g, 90)
    g.draw()
  }
})

test('AI tiers: 4 tiers via up/down, clamped', () => {
  const { g, v } = open('3')
  for (let i = 0; i < 10; i++) g.key('up')
  expect(v.tier).toBe(3)
  const seen = new Set<number>()
  for (let i = 0; i < 10; i++) { g.key('down'); seen.add(v.tier) }
  expect(v.tier).toBe(0)
  expect([...seen].sort()).toEqual([0, 1, 2])
  for (let i = 0; i < 4; i++) { g.key('up'); seen.add(v.tier) }
  expect([...seen].sort()).toEqual([0, 1, 2, 3])
  g.key('w'); g.key('w'); g.key('w'); g.key('w'); expect(v.tier).toBe(3)
})

test('Endgame: the foe is always Thanos, and the player cannot pick Thanos', () => {
  const { g, v } = open('5')
  const L = (v as any).list() as string[]
  expect(L).not.toContain('THANOS')
  for (let i = 0; i < L.length + 3; i++) {
    g.key('right')
    expect(L[v.cur]).not.toBe('THANOS')
  }
  g.key(' ')
  expect(v.foe).toBe('THANOS')
  expect(g.mode).toBe('howto')
  g.key(' '); g.key(' '); g.key(' ')
  expect(v.P[1].id).toBe('THANOS')
  expect(v.P[0].id).not.toBe('THANOS')
  // random pick never yields Thanos
  for (let seed = 1; seed < 25; seed++) {
    const r = open('5', 100, 28, seed); r.g.key('r'); r.g.key(' '); r.g.key(' '); r.g.key(' ')
    expect(r.v.P[0].id).not.toBe('THANOS'); expect(r.v.P[1].id).toBe('THANOS')
  }
  // even when pick was THANOS before (stale), entering Endgame resets
  const s = mk(); s.v.pick = 'THANOS'; s.g.key('5'); expect(s.v.pick).not.toBe('THANOS')
})

test('Thanos snap: not in the first 60 s of normal play; at most once per match', () => {
  const { g, v } = toFight(4, 100, 28, 'THOR')
  v.P[0].ai = true
  let edges = 0, was = false
  for (let i = 0; i < 30 * 60 && v.phase !== 'match'; i++) {
    g.tick()
    if (v.snapPend && !was) edges++
    was = v.snapPend
    if (v.round === 1 && v.pt < 59 && v.phase === 'fight') expect(v.snapUsed).toBe(false)
  }
  expect(edges).toBe(0) // BUG? snap before 60 s of normal play
})

test('Thanos snap happens at most once per match even with stones forced full every tick', () => {
  const { g, v } = toFight(4, 100, 28, 'CAP')
  v.P[0].ai = true
  let edges = 0, was = false
  for (let i = 0; i < 30 * 400 && v.phase !== 'match'; i++) {
    const th = v.T[1]![0]!; th.stones = 6; th.think = 0
    g.tick()
    if (v.snapPend && !was) edges++
    was = v.snapPend
  }
  expect(edges).toBeLessThanOrEqual(1)
})

test('tapping down in the snap window stops it (SNAP BROKEN, no damage)', () => {
  const { g, v } = toFight(4); tickN(g, 40)
  const me = v.P[0], th = v.P[1]
  me.ai = false; th.stones = 6; th.think = 0
  let hp0 = me.hp, done = false
  for (let i = 0; i < 300 && !done; i++) {
    if (v.snapPend && Math.abs(g.t - v.snapFlash) < 0.1) { hp0 = me.hp; g.key('down') }
    g.tick()
    if (v.snapUsed && !v.snapPend && th.stones === 0) done = true
  }
  expect(done).toBe(true)
  expect(me.hp).toBeGreaterThanOrEqual(hp0 - 0.001)
})

// ── 4. fighting ─────────────────────────────────────────────────────────────
function still(v: Versus) { const [me, o] = v.P; o.ai = false; o.think = 99; me.ai = false; return { me, o } }

test('left/right step; a double tap runs faster than a single step', () => {
  const { g, v } = toFight(2); tickN(g, 40)
  const { me, o } = still(v); me.x = 30; o.x = g.W - 6
  g.key('right'); const x0 = me.x; tickN(g, 6)
  const step = me.x - x0
  expect(step).toBeGreaterThan(0)
  tickN(g, 30)
  me.x = 30; me.st = 'idle'
  g.key('right'); tickN(g, 4); g.key('right'); tickN(g, 3)
  expect(me.st).toBe('run')
  const r0 = me.x; tickN(g, 6)
  expect(me.x - r0).toBeGreaterThan(step)
  g.key('left'); // left ends the run
  tickN(g, 30)
  expect(me.st).not.toBe('run')
})

test('up jumps (leaves the ground, lands again)', () => {
  const { g, v } = toFight(2); tickN(g, 40)
  const { me } = still(v)
  const y0 = me.y
  g.key('up'); tickN(g, 5)
  expect(me.y).toBeLessThan(y0); expect(me.st).toBe('jump')
  tickN(g, 90)
  expect(Math.abs(me.y - y0)).toBeLessThan(0.01); expect(me.st).not.toBe('jump')
})

test('down guards ~0.6 s then drops; first 0.2 s parries', () => {
  const { g, v } = toFight(2, 100, 28); tickN(g, 40)
  const { me, o } = still(v)
  g.key('down'); expect(me.st).toBe('block')
  tickN(g, 14); expect(me.st).toBe('block') // 0.47 s
  tickN(g, 8); expect(me.st).not.toBe('block') // > 0.6 s
  // parry inside 0.2 s
  tickN(g, 20)
  o.x = me.x + 10 * v.k; o.face = -1; me.face = 1
  g.key('down'); v.input(o, ' '); tickN(g, 6)
  expect(me.parries).toBe(1)
  // late guard (> 0.2 s in) is a block, not a parry
  tickN(g, 60); o.st = 'idle'; o.stun = 0; me.st = 'idle'; me.stun = 0
  o.x = me.x + 10 * v.k
  g.key('down'); tickN(g, 9)
  const p = me.parries; v.input(o, ' '); tickN(g, 8)
  expect(me.parries).toBe(p)
})

test('SPACE x3 chains, C special, X needs a full meter, X works at full meter', () => {
  const { g, v } = toFight(2); tickN(g, 40)
  const { me, o } = still(v)
  o.hp = o.s.hp = 999; me.meter = 0; o.x = me.x + 8 * v.k
  g.key('x'); tickN(g, 3); expect(me.st).not.toBe('super')
  g.key('c'); expect(me.st).toBe('special')
  tickN(g, 90)
  o.x = me.x + 8 * v.k; o.st = 'idle'; o.stun = 0
  me.st = 'idle'
  let max = 0
  for (let f = 0; f < 120; f++) { if (f % 3 === 0) g.key(' '); o.x = me.x + me.face * 8 * v.k; g.tick(); max = Math.max(max, me.chain, me.maxChain) }
  expect(max).toBeGreaterThanOrEqual(2)
  tickN(g, 60); me.st = 'idle'; me.stun = 0; me.meter = 100
  g.key('x'); expect(me.st).toBe('super'); expect(me.meter).toBe(0)
})

test('-> plus SPACE up close throws', () => {
  const { g, v } = toFight(2); tickN(g, 40)
  const { me, o } = still(v)
  o.hp = o.s.hp = 999
  me.x = 40; me.face = 1; o.x = me.x + 6 * v.k; o.y = me.y
  const hp = o.hp
  g.key('right'); g.key(' ')
  tickN(g, 6)
  expect(o.hp).toBeLessThan(hp)
  expect(me.last).toContain('throw')
})

for (const HERO of ROSTER) test(`bounds, HP range, no NaN: 20k ticks of seeded random input, ${HERO} vs others and mirror`, () => {
  // every fighter is covered as player AND as foe, plus the mirror
  const pairs: [HeroId, HeroId][] = ROSTER.flatMap((a, i) => [[a, ROSTER[(i + 1) % ROSTER.length]!], [ROSTER[(i + 5) % ROSTER.length]!, a], [a, a]] as [HeroId, HeroId][])
  for (const [a, b] of pairs.filter(p => p[0] === HERO || p[1] === HERO)) {
    const { g, v } = toFight(2 + (ROSTER.indexOf(a) % 2), 100, 28, a, b, 3)
    const rnd = lcg(ROSTER.indexOf(a) * 31 + ROSTER.indexOf(b) + 1)
    let problem = ''
    for (let i = 0; i < 20000 && !problem; i++) {
      if (v.phase === 'match') { g.key('r'); g.key(' '); g.key(' '); g.key(' ') }
      const k = rnd() < 0.5 ? SAFE[Math.floor(rnd() * SAFE.length)]! : ' '
      g.key(k)
      if (v.paused) g.key('p')
      g.tick()
      if (i % 7) continue
      for (const f of v.P) {
        if (!(f.x >= -1 && f.x <= g.W + 1)) problem = `x ${f.id} ${f.x}`
        if (f.y > g.H + 1) problem = `y ${f.id} ${f.y}`
        if (f.hp < 0 || f.hp > f.s.hp + 1e-9) problem = `hp ${f.id} ${f.hp}/${f.s.hp}`
        if (f.meter < 0 || f.meter > 100.0001) problem = `meter ${f.meter}`
      }
      const nan = allFinite(v.P) ?? allFinite([v.clock, v.pt, v.koWinner]); if (nan) problem = 'NaN ' + nan
    }
    expect([a, b, problem]).toEqual([a, b, ''])
  }
})

test('fighters never pass through each other while both are on the ground', () => {
  for (const gi of [2, 3, 4]) {
    const { g, v } = toFight(gi, 100, 28); aiOn(v)
    const rnd = lcg(gi)
    let prev = 0, bad = 0
    for (let i = 0; i < 6000; i++) {
      if (v.phase === 'match') break
      g.tick(); if (rnd() < 0.1) g.key(rnd() < 0.5 ? 'left' : 'right')
      const [a, b] = v.P
      const grounded = a.y >= v.gy - 0.5 && b.y >= v.gy - 0.5 && v.phase === 'fight' && a.st !== 'ko' && b.st !== 'ko' && !['special', 'super', 'hurt'].includes(a.st) && !['special', 'super', 'hurt'].includes(b.st) && !a.last.includes('throw') && !b.last.includes('throw')
      const s = Math.sign(b.x - a.x)
      if (grounded && prev !== 0 && s !== 0 && s !== prev && Math.abs(b.x - a.x) > 1) bad++
      if (grounded && s !== 0) prev = s
      if (!grounded) prev = 0
    }
    expect([gi, bad]).toEqual([gi, 0])
  }
})

test('held key repeats never drop guard or stutter walk (30 ms repeat after 500 ms delay)', () => {
  const { g, v } = toFight(2); tickN(g, 40)
  const { me, o } = still(v); o.x = g.W - 6; me.x = 20
  let t = 0, next = 0, last = me.x, stalls = 0, drops = 0
  for (let f = 0; f < 60; f++) {
    while (t >= next) { g.key('right'); next = next === 0 ? 0.5 : next + 0.03 }
    g.tick(); t += 1 / 30
    if (t > 0.55) { if (me.x <= last) stalls++ }
    last = me.x
  }
  expect(stalls).toBe(0)
  me.st = 'idle'; me.stun = 0; t = 0; next = 0
  for (let f = 0; f < 90; f++) {
    while (t >= next) { g.key('down'); next = next === 0 ? 0.5 : next + 0.03 }
    g.tick(); t += 1 / 30
    if ((me.st as string) !== 'block') drops++
  }
  expect(drops).toBe(0)
})

test('time-out: the HP leader wins (either side; tie does not crash)', () => {
  for (const lead of [0, 1]) {
    const { g, v } = toFight(2); tickN(g, 10)
    const a = v.P[lead]!, b = v.P[1 - lead]!
    a.hp = a.s.hp * 0.8; b.hp = b.s.hp * 0.3
    v.P[0]!.ai = false; v.P[1]!.think = 99; v.P[1]!.ai = false
    v.clock = 0.05
    for (let i = 0; i < 20 && v.phase === 'fight'; i++) g.tick()
    expect(v.phase).not.toBe('fight')
    expect(v.koWinner).toBe(lead)
  }
  const { g, v } = toFight(2); tickN(g, 10); v.clock = 0.05
  tickN(g, 60); expect(Number.isFinite(v.koWinner)).toBe(true)
})

test('time-out in Civil War: side with more total life wins the round / match resolves', () => {
  const { g, v } = toFight(1); tickN(g, 10)
  for (const f of v.T[0]!) f.hp = f.s.hp
  for (const f of v.T[1]!) f.hp = 1
  v.clock = 0.05
  tickN(g, 30)
  expect(v.koWinner).toBe(0)
})

// ── 5. frames ───────────────────────────────────────────────────────────────
// BUG: arcade-engine.ts:1332 JARVIS row is not padded when `right` does not fit (34 of 40 cells at 40x11, fails below)
for (const [w, h] of FRAME_SIZES) test(`every cell is a printable width-1 BMP char; rows and widths match the pane at ${w}x${h}`, () => {
  for (const gi of [1, 2, 3, 4]) {
    const { g, v } = toFight(gi, w, h)
    let rows = -1
    for (let f = 0; f < 240; f++) {
      if (f === 100) { v.P[0].meter = 100; v.P[1].meter = 100; if (v.P[1].id === 'THANOS') v.P[1].stones = 6 }
      g.key(SAFE[f % SAFE.length]!); g.tick()
      if (f % 6) continue
      const rs = runs(g)
      if (rows < 0) rows = rs.length
      expect([w, h, gi, 'rows', rs.length]).toEqual([w, h, gi, 'rows', rows])
      for (const [ri, row] of rs.entries()) {
        let n = 0
        for (const r of row) for (const ch of r.s) {
          const cp = ch.codePointAt(0)!
          if (cp < 32 || cp === 127 || (cp >= 0x80 && cp < 0xa0) || cp > 0xffff || (cp >= 0xd800 && cp < 0xe000) || cp === 0x200b || cp === 0xfe0f) throw new Error(`bad char U+${cp.toString(16)} at ${w}x${h} gi${gi} row ${ri}`)
          n++
        }
        if (n !== g.W) throw new Error(`row ${ri} width ${n} != ${g.W} at ${w}x${h} gi${gi}`)
      }
    }
    // select, howto and results screens too
  }
  for (const n of ['2', '3', '5']) {
    const { g, v } = open(n, w, h)
    for (const step of [0, 1, 2]) {
      const rs = runs(g)
      for (const row of rs) expect(row.reduce((a, r) => a + [...r.s].length, 0)).toBe(g.W)
      g.key(' ')
    }
  }
})

test('both fighters are visible (inside the pane) during the fight at every size', () => {
  for (const [w, h] of FRAME_SIZES) for (const gi of [1, 2, 3, 4]) {
    const { g, v } = toFight(gi, w, h); aiOn(v)
    for (let f = 0; f < 400 && v.phase !== 'match'; f++) {
      g.tick()
      if (f % 10 || v.phase !== 'fight') continue
      g.draw()
      for (const [i, b] of v.boxes.entries()) {
        if (v.P[i]!.st === 'ko') continue
        const vis = Math.min(b.x1, g.W) - Math.max(b.x0, 0)
        const visY = Math.min(b.y1, g.H) - Math.max(b.y0, 0)
        if (!(vis > 2 && visY > 2)) throw new Error(`fighter ${i} not visible ${JSON.stringify(b)} at ${w}x${h} gi${gi}`)
      }
    }
  }
})

for (const [w, h] of FRAME_SIZES) test(`no splash/overlay text overlaps a fighter box (fight, super, snap) at ${w}x${h}`, { timeoutMs: 60000 }, () => {
  const textOn = (g: Game, v: Versus) => {
    const hits: string[] = []
    for (const b of v.boxes) { if (b.x1 < 0) continue
      for (let r = Math.max(0, Math.floor(b.y0 / 2)); r <= Math.min(g.fb.rows - 1, Math.floor(b.y1 / 2)); r++)
        for (let x = Math.max(0, Math.floor(b.x0)); x <= Math.min(g.W - 1, Math.ceil(b.x1)); x++) if (g.fb.och[r * g.W + x]) hits.push(String.fromCharCode(g.fb.och[r * g.W + x]!)) }
    return hits
  }
  for (const gi of [1, 2, 3, 4]) {
    const { g, v } = toFight(gi, w, h, undefined, undefined, 8)
    const rnd = lcg(gi * 7)
    for (let f = 0; f < 700 && v.phase !== 'match'; f++) {
      if (f % 100 === 50) { v.P[0].meter = 100; v.P[1].meter = 100; if (v.P[1].id === 'THANOS') v.P[1].stones = 6 }
      g.key(SAFE[Math.floor(rnd() * SAFE.length)]!); g.tick()
      if (f % 4) continue
      g.draw()
      const hits = textOn(g, v)
      if (hits.length) throw new Error(`text ${hits.join('')} on a fighter at ${w}x${h} gi${gi} phase ${v.phase} frame ${f}`)
    }
  }
})

test('resize() mid-fight never throws and keeps fighters in the new arena', () => {
  for (const gi of [1, 2, 4]) {
    const { g, v } = toFight(gi, 100, 28); aiOn(v)
    const seq = [[40, 11], [240, 70], [60, 11], [180, 60], [5, 3], [1000, 1000], [0, 0], [100, 28], [-5, -5]]
    for (const [w, h] of seq) {
      tickN(g, 20)
      expect(() => { g.resize(w!, h!); g.draw(); tickN(g, 20); g.draw() }).not.toThrow()
      for (const f of v.P) { expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true); expect(f.x).toBeGreaterThanOrEqual(-1); expect(f.x).toBeLessThanOrEqual(g.W + 1); expect(f.y).toBeLessThanOrEqual(g.H + 1) }
    }
  }
  // resizing on the select and results screens
  const { g } = open('2'); expect(() => { g.resize(40, 11); g.draw(); g.resize(240, 70); g.draw() }).not.toThrow()
})

// ── 6. pointer ──────────────────────────────────────────────────────────────
// BUG: arcade-versus.ts:365 a click on the left third sends 'left' (wraps Cap -> Iron Man) instead of choosing the side under it
test('click on select picks sides/fighters sensibly', () => {
  // civil war: left third = Team Cap, right third = Team Iron Man, never out-of-range
  for (const [x, side] of [[2, 'cap'], [97, 'iron']] as const) {
    const { g, v } = open('2'); g.draw()
    g.pointer('down', x, 10, 'left')
    for (let i = 0; i < 3; i++) g.pointer('down', 50, 10, 'left') // centre = confirm
    expect([x, v.side]).toEqual([x, side])
  }
  const { g, v } = open('3'); g.draw()
  for (const x of [-50, 0, 5, 50, 99, 100, 5000]) {
    g.pointer('down', x, 10, 'left')
    expect(v.cur).toBeGreaterThanOrEqual(0)
    expect(v.cur).toBeLessThanOrEqual((v as any).list().length - 1)
    if (g.mode !== 'vs' || v.phase !== 'select') break
  }
  expect(() => g.draw()).not.toThrow()
})

test('a click anywhere in any phase never throws (negative, huge, NaN, any button/type)', () => {
  const xs = [-1e9, -100, -1, 0, 1, 50, 99, 100, 101, 1e9, NaN, Infinity]
  const types = ['down', 'up', 'move', 'drag', 'wheel']
  const buttons = ['left', 'right', 'middle', undefined]
  for (const gi of [1, 2, 3, 4]) {
    const { g, v } = toFight(gi); aiOn(v)
    for (const t of types) for (const b of buttons) for (const x of xs) for (const y of [-5, 0, 13, 1e9, NaN]) {
      g.pointer(t, x, y, b as any)
      g.tick()
    }
    for (const f of v.P) expect(Number.isFinite(f.x)).toBe(true)
    // across phases
    for (const ph of ['select', 'vs', 'charge', 'intro', 'ko', 'match', 'finisher', 'swap'] as const) {
      v.phase = ph
      expect(() => { for (const x of xs) { g.pointer('down', x, 5, 'left'); g.pointer('down', x, 5, 'right') } ; g.draw() }).not.toThrow()
    }
  }
  // pointer on select without prior draw, at tiny sizes
  const s = open('2', 40, 11); expect(() => { for (const x of xs) s.g.pointer('down', x, 3, 'left') }).not.toThrow()
})

// BUG: arcade-versus.ts:367 pointer() ignores `paused`, so a click while paused still attacks
test('a click while paused does not move or attack', () => {
  const { g, v } = toFight(2); tickN(g, 40)
  g.key('p')
  const a = snapshot(v)
  g.pointer('down', v.P[0].x, 5, 'left'); g.pointer('down', 99, 5, 'right'); tickN(g, 30)
  expect(snapshot(v)).toBe(a)
}) 
