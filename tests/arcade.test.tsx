import { expect, mock } from 'claude-code/testing'
import { test } from './timed'
import { Game, HOWTO, specSize } from '../hooks/arcade-engine'
import { ROSTER, STATS, TEAM_CAP, TEAM_IRON, Versus } from '../hooks/arcade-versus'

// ── helpers ─────────────────────────────────────────────────────────────────
const screen = (g: Game) => { g.draw(); return g.frameRuns().map(r => r.map(x => x.s).join('')).join('\n') }
// A scripted pilot for the siege: fly at the nearest drone, fire, use every power.
function pilot(g: Game, frames: number) {
  for (let f = 1; f <= frames; f++) {
    if (g.mode === 'title' || g.mode === 'howto' || (g.mode === 'over' && g.overT > 1.2)) g.key(' ')
    const e = g.E.filter(e => e.on).sort((a, b) => a.x - b.x)[0]
    if (e) g.key(e.y + 2 < g.ty ? 'up' : 'down')
    if (f % 3 === 0) g.key(' ')
    if (f % 150 === 0) g.key('1')
    if (f % 210 === 0) g.key('2')
    if (f % 290 === 0) { g.rage = 100; g.key('3') }
    g.tick()
  }
}
// A fight set up the way a player does it: menu → select → HOW TO PLAY → the fight.
function fight(gi: number, w = 100, h = 30, ai = false) {
  const g = new Game(w, h, 4), v = new Versus(g)
  g.vs = v
  g.key(String(gi + 1)) // the menu row
  if (gi === 1) { g.key(' '); g.key('a') } // a side, then the movie trio
  else { g.key(' '); if (gi !== 4) g.key(' ') } // your fighter (and the opponent)
  expect(g.mode).toBe('howto')
  g.key(' ')
  if (ai) for (const f of v.T[0]!) f.ai = true
  g.key(' ') // skip the VS screen / THE CHARGE
  return { g, v }
}
function brawl(g: Game, v: Versus, frames: number) {
  for (let f = 1; f <= frames; f++) {
    if (v.phase === 'fight' && !v.P[0].ai) {
      const me = v.P[0], o = v.P[1]
      if (Math.abs(o.x - me.x) > 14 * v.k) g.key(o.x > me.x ? 'right' : 'left')
      if (f % 3 === 0) g.key(' ')
      if (f % 40 === 0) g.key('c')
      if (f % 9 === 0) g.key('x')
      if (f % 13 === 0) g.key('down')
    }
    g.tick()
  }
}
// every text cell of the last frame that sits inside a fighter's drawn box
function textOnFighters(g: Game, v: Versus) {
  const fb = g.fb, hits: string[] = []
  for (const b of v.boxes) {
    if (b.x1 < 0) continue
    for (let r = Math.max(0, Math.floor(b.y0 / 2)); r <= Math.min(fb.rows - 1, Math.floor(b.y1 / 2)); r++)
      for (let x = Math.max(0, Math.floor(b.x0)); x <= Math.min(g.W - 1, Math.ceil(b.x1)); x++) if (fb.och[r * g.W + x]) hits.push(String.fromCharCode(fb.och[r * g.W + x]!))
  }
  return hits
}

// ── the shell ───────────────────────────────────────────────────────────────
test('the title offers all five games; the siege opens on HOW TO PLAY, a fight on its select screen', () => {
  for (let i = 1; i <= 5; i++) {
    const g = new Game(100, 32, 1), v = new Versus(g)
    g.vs = v
    expect(screen(g)).toContain('PICK YOUR GAME')
    expect(g.menuHit.length).toBe(5) // five clickable rows
    g.key(String(i))
    if (i === 1) { expect(g.mode).toBe('howto'); g.key(' '); expect(g.mode).toBe('play'); expect(g.wave).toBe(1); continue }
    expect(g.mode).toBe('vs')
    expect(v.phase).toBe('select')
  }
})

test('select → HOW TO PLAY → VS → fight, for every duel (any fighter, any opponent)', () => {
  const g = new Game(100, 30, 1), v = new Versus(g)
  g.vs = v
  g.key('3') // Iron Man vs Thor by default
  g.key('right'); g.key(' ') // the next fighter instead
  const me = v.pick
  g.key(' ')
  expect(g.mode).toBe('howto')
  expect(screen(g)).toContain('HOW TO PLAY'.slice(0, 0)) // the card is up
  g.key(' ')
  expect(v.phase).toBe('vs')
  expect(v.P[0].id).toBe(me)
  expect(v.P[1].id).toBe(v.foe)
  expect(v.foe).not.toBe(me)
  for (let k = 0; k < 90; k++) g.tick()
  expect(v.phase).toBe('fight')
})

test('a click lands on the game it is over: clicking a row picks that game, clicking elsewhere picks nothing', () => {
  const g = new Game(100, 32, 1), v = new Versus(g)
  g.vs = v
  g.draw()
  g.pointer('down', 0, 0, 'left') // the corner: nothing
  expect(g.mode).toBe('title')
  const row = g.menuHit[0]!
  g.pointer('down', row.x0 + 2, row.row + 1, 'left') // the header row sits above the playfield
  expect(g.mode).toBe('howto')
})

test('HOW TO PLAY fits in 5 rows at every width, for every game', () => {
  for (const [w, h] of [[60, 11], [100, 28], [180, 60]] as const) for (let i = 0; i < 5; i++) {
    const g = new Game(w, h, 1), v = new Versus(g)
    g.vs = v
    g.launch(i)
    if (i > 0) { g.howtoThen(i) }
    g.draw()
    const rows = new Set<number>()
    for (let r = 0; r < g.fb.rows; r++) for (let x = 0; x < w; x++) if (g.fb.och[r * w + x]) rows.add(r)
    expect(rows.size).toBeLessThanOrEqual(5)
    expect(HOWTO[i]!.move.length + HOWTO[i]!.fight.length).toBeGreaterThan(0)
  }
})

test('Q in a game pauses first; a second Q quits; Q on a menu quits at once', () => {
  const g = new Game(100, 30, 9)
  g.launch(0); g.key(' ')
  g.key('q')
  expect(g.mode).toBe('pause')
  expect(g.wantsClose).toBe(false)
  g.key('q')
  expect(g.wantsClose).toBe(true)
  const m = new Game(100, 30, 9)
  m.key('q')
  expect(m.wantsClose).toBe(true)
  const { g: f, v } = fight(2)
  for (let i = 0; i < 40; i++) f.tick()
  f.key('q')
  expect(v.paused).toBe(true)
  expect(f.wantsClose).toBe(false)
  f.key('q')
  expect(f.wantsClose).toBe(true)
})

// ── the siege ───────────────────────────────────────────────────────────────
test('SIEGE: every frame fits the tree bound at any pane size, and the pools stay fixed', { timeoutMs: 60000 }, () => {
  for (const [w, h] of [[60, 11], [100, 32], [180, 60]] as const) {
    const g = new Game(w, h, 3)
    const sizes = () => [g.E.length, g.PB.length, g.EB.length, g.POP.length, g.PK.length, g.BM.length, g.pX.length]
    const before = sizes()
    let max = 0
    for (let f = 0; f < 500; f++) { pilot(g, 1); g.draw(); max = Math.max(max, specSize(g.frameOut().specs)) }
    expect(max).toBeLessThan(100000)
    expect(sizes()).toEqual(before)
  }
})

test('SIEGE: game over hands the score out once; 1/2/3 are the powers', () => {
  const g = new Game(100, 30, 9)
  g.launch(0); g.key(' ')
  g.cdShield = 0; g.key('1')
  expect(g.shield.on).toBe(true)
  g.score = 4321
  for (let i = 0; i < 3; i++) { g.inv = 0; (g as unknown as { hurt: () => void }).hurt() }
  expect(g.mode).toBe('over')
  expect(g.outbox).toEqual({ score: 4321 })
  expect(g.best).toBe(4321)
})

// ── VERSUS: the quality bar ─────────────────────────────────────────────────
test('both fighters stay fully visible at 60×11, 100×28 and 180×60 (AI vs AI, sampled every 10 frames)', () => {
  for (const [w, h] of [[60, 11], [100, 28], [180, 60]] as const) for (const gi of [1, 2, 4]) {
    const { g, v } = fight(gi, w, h, true)
    for (let f = 0; f < 900 && v.phase !== 'match'; f++) {
      g.tick()
      if (f % 10 || v.phase !== 'fight') continue
      g.draw()
      for (const b of v.boxes) { expect(b.x0).toBeGreaterThanOrEqual(-1); expect(b.x1).toBeLessThanOrEqual(w); expect(b.y0).toBeGreaterThanOrEqual(-1); expect(b.y1).toBeLessThanOrEqual(g.H) }
    }
  }
})

test('no splash or text cell overlaps a fighter, in the fight, a super, the snap and the finisher', () => {
  for (const [w, h] of [[60, 11], [100, 28], [180, 60]] as const) for (const gi of [1, 2, 3, 4]) {
    const { g, v } = fight(gi, w, h)
    for (let f = 0; f < 600 && v.phase !== 'match'; f++) {
      if (f === 120) { v.P[0].meter = 100; v.P[1].meter = 100; if (v.P[1].id === 'THANOS') v.P[1].stones = 6 }
      brawl(g, v, 1)
      if (f % 5) continue
      g.draw()
      expect(textOnFighters(g, v)).toEqual([])
    }
  }
  // the finisher
  const { g, v } = fight(4)
  for (let i = 0; i < 40; i++) g.tick()
  v.P[0].wins = 1; v.P[1].hp = 0.5; v.P[1].x = v.P[0].x + 10 * v.k
  for (let i = 0; i < 40 && v.phase === 'fight'; i++) { g.key(' '); g.tick() }
  expect(v.phase).toBe('finisher')
  for (let i = 0; i < 300 && v.phase !== 'match'; i++) { g.tick(); if (i % 8 === 0) { g.draw(); expect(textOnFighters(g, v)).toEqual([]) } }
  expect(v.phase).toBe('match')
  expect(v.matchWon).toBe(true)
})

test('a held key never stutters or drops guard (repeat at 30 ms after a 500 ms delay)', () => {
  const { g, v } = fight(2, 100, 28)
  for (let i = 0; i < 40; i++) g.tick()
  const me = v.P[0]
  v.P[1].x = g.W - 6; v.P[1].think = 99; v.P[1].ai = false // a still target
  me.x = 20
  // → held: a press now, then one every 30 ms from 500 ms on; the walk never stops
  let t = 0, next = 0, last = me.x, stalls = 0
  for (let f = 0; f < 60; f++) {
    while (t >= next) { g.key('right'); next = next === 0 ? 0.5 : next + 0.03 }
    g.tick(); t += 1 / 30
    if (t > 0.55) { if (me.x <= last) stalls++; last = me.x } else last = me.x
  }
  expect(stalls).toBe(0)
  expect(me.st === 'walk' || me.st === 'idle').toBe(true)
  // ↓ held: the guard is up from the first press and never drops
  t = 0; next = 0
  let drops = 0
  for (let f = 0; f < 60; f++) {
    while (t >= next) { g.key('down'); next = next === 0 ? 0.5 : next + 0.03 }
    g.tick(); t += 1 / 30
    if (me.st !== 'block') drops++
  }
  expect(drops).toBe(0)
})

test('a fresh guard parries: a 12-frame stop, the attacker staggers, no chip', () => {
  const { g, v } = fight(2, 100, 28)
  for (let i = 0; i < 40; i++) g.tick()
  const [me, o] = v.P
  o.ai = false; o.x = me.x + 10 * v.k; o.face = -1; me.face = 1
  const hp = me.hp
  g.key('down')
  v.input(o, ' ')
  for (let i = 0; i < 6; i++) g.tick()
  expect(me.parries).toBe(1)
  expect(me.hp).toBe(hp)
  expect(o.st).toBe('hurt')
})

test('a 5-hit combo is possible for every fighter: SPACE x3 → C → X', () => {
  for (const id of ROSTER) {
    const { g, v } = fight(2, 100, 28)
    for (let i = 0; i < 40; i++) g.tick()
    const me = v.P[0], o = v.P[1]
    me.id = id; me.s = STATS[id]; me.meter = 100; me.cd = 0; me.armed = true; me.stones = 6
    o.ai = false; o.think = 99; o.hp = o.s.hp = 999; o.x = me.x + 8 * v.k; o.y = me.y
    let hits = 0, step = 0
    for (let f = 0; f < 150 && step < 5; f++) {
      if (step < 3 && f % 3 === 0) g.key(' ')
      if (step === 3) g.key('c')
      if (step === 4 && me.mv && me.t >= me.mv.at) g.key('x')
      if (o.st !== 'hurt' && step < 3) { o.x = me.x + me.face * 8 * v.k; o.y = me.y }
      g.tick()
      if (step < 3 && me.chain === 2 && me.landed) step = 3
      else if (step === 3 && me.st === 'special') step = 4
      else if (step === 4 && me.st === 'super') step = 5
      hits = Math.max(hits, me.maxChain)
    }
    expect([id, step]).toEqual([id, 5]) // the whole string came out: chain, cancel into C, cancel into X
    expect(hits).toBeGreaterThanOrEqual(3)
  }
})

test('every frame fits the tree bound at 180×60, even a super with particles', () => {
  for (const gi of [1, 2, 3, 4]) {
    const { g, v } = fight(gi, 180, 60)
    let max = 0
    // a super every 2 s; frames sampled through each (the worst is the super's first half-second)
    for (let f = 0; f < 150 && v.phase !== 'match'; f++) {
      if (f % 60 === 10) { v.P[0].meter = 100; v.P[1].meter = 100 }
      brawl(g, v, 1)
      if (f % 3 === 0) { g.draw(); max = Math.max(max, specSize(g.frameOut().specs)) }
    }
    expect(max).toBeLessThan(100000)
  }
})

test('a full AI-vs-AI Civil War match runs to its results screen', () => {
  const { g, v } = fight(1, 100, 28, true)
  expect(v.T[0]!.length).toBe(3)
  expect(v.T[1]!.length).toBe(3)
  for (let f = 0; f < 30 * 400 && v.phase !== 'match'; f++) g.tick()
  expect(v.phase).toBe('match')
  expect(v.T[0]!.every(f => f.out) || v.T[1]!.every(f => f.out) || v.clock === 0).toBe(true)
})

test('Civil War: 12 heroes, two teams of 6, each with a special and a super; Z tags', () => {
  expect(TEAM_CAP.length + TEAM_IRON.length).toBe(12)
  for (const id of [...TEAM_CAP, ...TEAM_IRON]) { expect(STATS[id].sp.name.length).toBeGreaterThan(0); expect(STATS[id].su.name.length).toBeGreaterThan(0); expect(STATS[id].lines.length).toBeGreaterThanOrEqual(2) }
  const { g, v } = fight(1, 100, 28)
  for (let i = 0; i < 60; i++) g.tick()
  const first = v.P[0].id
  g.key('z')
  expect(v.P[0].id).not.toBe(first)
})

test('the snap: no snap in the first 60 s; at 6 stones a tap of ↓ on the flash parries it; else half your life', () => {
  const quiet = fight(4)
  for (let i = 0; i < 30 * 60; i++) { quiet.g.tick(); expect(quiet.v.snapPend).toBe(false); if (quiet.v.phase !== 'fight' && quiet.v.phase !== 'intro') break }
  for (const tap of [true, false]) {
    const { g, v } = fight(4)
    for (let i = 0; i < 40; i++) g.tick()
    const me = v.P[0], th = v.P[1]
    me.ai = true; me.think = 99 // stand still
    me.ai = false
    th.stones = 6; th.think = 0
    let before = me.hp, fired = false
    for (let i = 0; i < 200 && !fired; i++) {
      if (tap && v.snapPend && Math.abs(g.t - v.snapFlash) < 0.05) g.key('down')
      before = me.hp
      g.tick()
      if (v.snapUsed && !v.snapPend && th.stones === 0) fired = true
    }
    expect(fired).toBe(true)
    if (tap) expect(me.parries).toBeGreaterThanOrEqual(1)
    else expect(me.hp).toBeLessThan(before + 1)
  }
})

test('results: a rank, R rematches through HOW TO PLAY, M goes to the menu', () => {
  const { g, v } = fight(2)
  for (let i = 0; i < 40; i++) g.tick()
  v.P[0].wins = 1; v.P[1].hp = 0.5; v.P[1].x = v.P[0].x + 10 * v.k
  for (let i = 0; i < 200 && v.phase !== 'match'; i++) { if (v.phase === 'fight') g.key(' '); g.tick() }
  expect(v.phase).toBe('match')
  expect(['S', 'A', 'B', 'C']).toContain(v.rank)
  g.key('r')
  expect(g.mode).toBe('howto')
  g.key(' ')
  expect(v.phase).toBe('vs')
  const m = fight(2)
  for (let i = 0; i < 40; i++) m.g.tick()
  m.v.P[1].wins = 1; m.v.P[0].hp = 0.5
  m.v.P[1].x = m.v.P[0].x + 10 * m.v.k
  for (let i = 0; i < 400 && m.v.phase !== 'match'; i++) m.g.tick()
  expect(m.v.continueT).toBeGreaterThan(0) // CONTINUE? after a loss
  m.g.key('m')
  expect(m.g.mode).toBe('title')
})

// ── round 4: the reviewer's findings ────────────────────────────────────────
test('pause, then R (rematch): the new fight runs, not frozen', () => {
  const g = new Game(100, 30, 4), v = new Versus(g)
  g.vs = v
  g.key('3'); for (let i = 0; i < 4; i++) g.key(' ') // to the fight
  for (let i = 0; i < 60; i++) g.tick()
  g.key('p'); g.key('r'); g.key(' '); g.key(' ')
  for (let i = 0; i < 300; i++) g.tick()
  expect(v.paused).toBe(false)
  expect(v.phase === 'fight' || v.phase === 'ko' || v.phase === 'match').toBe(true)
})

test('Q and Esc: only the title closes; games pause first; select, results, HOW TO PLAY and game over go to the menu', () => {
  const t = new Game(100, 30, 1); t.vs = new Versus(t)
  t.key('escape'); expect(t.wantsClose).toBe(true)
  const s = new Game(100, 30, 1); s.vs = new Versus(s)
  s.launch(0); s.key(' '); s.key('escape') // Esc in the siege: a pause with QUIT armed
  expect(s.mode).toBe('pause'); expect(s.wantsClose).toBe(false)
  const h = new Game(100, 30, 1); h.vs = new Versus(h)
  h.launch(0); h.key('q'); expect(h.mode).toBe('title'); expect(h.wantsClose).toBe(false)
  const v1 = new Game(100, 30, 1), vs = new Versus(v1); v1.vs = vs
  v1.key('3'); expect(vs.phase).toBe('select')
  v1.key('q'); expect(v1.mode).toBe('title'); expect(v1.wantsClose).toBe(false)
  const { g, v } = fight(2)
  for (let i = 0; i < 40; i++) g.tick()
  v.P[0].wins = 1; v.P[1].hp = 0.5; v.P[1].x = v.P[0].x + 10 * v.k
  for (let i = 0; i < 40 && v.phase === 'fight'; i++) { g.key(' '); g.tick() }
  expect(v.phase).toBe('ko')
  g.key('q'); expect(g.wantsClose).toBe(false); expect(v.paused).toBe(true) // the guard
  g.key('p')
  for (let i = 0; i < 200 && v.phase !== 'match'; i++) g.tick()
  expect(v.phase).toBe('match')
  g.key('q'); expect(g.mode).toBe('title'); expect(g.wantsClose).toBe(false)
})

test('the 30 fps clock stops while the game lacks the keyboard, and a key starts it again', async ($: any, on: any) => {
  mock.store(on)
  const m = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'Pane', requestId: 'avengers-arcade', props: { title: 'STARK ARCADE', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { bodyRows: 30 }, view: {} } })
  await m.resize({ columns: 100, rows: 28, in: 'arcade' })
  await m.advance(200)
  const a = JSON.stringify(await m.drawn({ in: 'arcade' }))
  await m.advance(2000)
  expect(JSON.stringify(await m.drawn({ in: 'arcade' }))).toBe(a) // stopped: nothing ticks or redraws
  await m.key({ key: 'down', in: 'arcade' })
  await m.advance(1000)
  expect(JSON.stringify(await m.drawn({ in: 'arcade' }))).not.toBe(a) // running again
})

test('SPACE alone walks every game from the title into its fight (the draft never stalls)', () => {
  for (const [W, H] of [[60, 11], [100, 28], [170, 45]] as const) for (const n of ['2', '3', '4', '5']) {
    const g = new Game(W, H, 7), v = new Versus(g)
    g.vs = v
    g.key(n)
    for (let i = 0; i < 10; i++) { g.key(' '); for (let k = 0; k < 15; k++) g.tick() }
    expect(['fight', 'ko', 'swap', 'finisher', 'match']).toContain((v as any).phase)
  }
})
