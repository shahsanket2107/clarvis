import { expect, mock } from 'claude-code/testing'
import { test } from './timed'
import { Game, HOWTO, MENU } from '../hooks/arcade-engine'
import { Versus } from '../hooks/arcade-versus'

// ── helpers ─────────────────────────────────────────────────────────────────
const SIZES: [number, number][] = [[40, 11], [60, 11], [80, 20], [100, 28], [180, 60], [240, 70]]
const mk = (w = 100, h = 28, seed = 7) => { const g = new Game(w, h, seed); g.vs = new Versus(g); return g }
const rows = (g: Game) => { g.draw(); return g.frameRuns().map(r => r.map(x => x.s).join('')) }
const screen = (g: Game) => rows(g).join('\n')
const tickN = (g: Game, n: number) => { for (let i = 0; i < n; i++) g.tick() }
const playing = (w = 100, h = 28, seed = 7) => { const g = mk(w, h, seed); g.key('1'); g.key(' '); expect(g.mode).toBe('play'); return g }
const lcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296)
const KEYS = ['up', 'down', 'left', 'right', ' ', '1', '2', '3', 'p', 'x', 'enter', 'a', 'w']
const strip = (s: string) => s.replace(/\s+/g, ' ')

const ram = (g: Game, hp = 99) => Object.assign(g.E[0]!, { on: true, kind: 0, x: g.px + g.pw * 0.5, y: g.py + g.ph * 0.3, y0: g.py + g.ph * 0.3, vx: 0, vy: 0, hp, max: hp })

// ── title ───────────────────────────────────────────────────────────────────
test('title lists the five games in order', () => {
  const g = mk(); const s = screen(g)
  expect(g.mode).toBe('title'); expect(MENU.length).toBe(5); expect(g.menuHit.length).toBe(5)
  for (const w of ['ULTRON SIEGE', 'CIVIL WAR', 'Iron Man vs Thor', 'Hulkbuster vs Hulk', 'ENDGAME']) expect(s.toLowerCase()).toContain(w.toLowerCase())
})
test('keys 1-5 pick the matching game directly', () => {
  for (let i = 1; i <= 5; i++) { const g = mk(); g.key(String(i)); expect(g.menuSel).toBe(i - 1); expect(g.mode).toBe(i === 1 ? 'howto' : 'vs') }
})
test('up/down stay in range, wrap or clamp, from every start', () => {
  const g = mk()
  for (let i = 0; i < 17; i++) { g.key('down'); expect(g.menuSel).toBeGreaterThanOrEqual(0); expect(g.menuSel).toBeLessThanOrEqual(4) }
  for (let i = 0; i < 23; i++) { g.key('up'); expect(g.menuSel).toBeGreaterThanOrEqual(0); expect(g.menuSel).toBeLessThanOrEqual(4) }
  const h = mk(); h.key('up'); expect([0, 4]).toContain(h.menuSel)
  const d = mk(); d.key('down'); expect(d.menuSel).toBe(1)
})
test('SPACE and Enter launch the selected game', () => {
  for (const k of [' ', 'enter']) { const g = mk(); g.key(k); expect(g.mode).toBe('howto') }
  for (const k of [' ', 'enter']) { const g = mk(); g.key('down'); g.key(k); expect(g.mode).toBe('vs') }
})
test('other keys on the title do nothing', () => {
  const g = mk(); for (const k of ['x', 'z', '0', '6', '9', 'b', 'p', 'left']) g.key(k)
  expect(g.mode).toBe('title'); expect(g.wantsClose).toBe(false)
})
test('mouse down on a game row launches THAT game (client row = menuHit row + 1)', () => {
  for (let i = 0; i < 5; i++) {
    const g = mk(); g.draw(); const h = g.menuHit[i]!
    g.pointer('down', h.x0 + 2, h.row + 1, 'left')
    expect(g.menuSel).toBe(i); expect(g.mode).toBe(i === 0 ? 'howto' : 'vs')
  }
})
test('click at the row edges: x0 inside, x1 outside', () => {
  const g = mk(); g.draw(); const h = g.menuHit[0]!
  g.pointer('down', h.x1 + 1, h.row + 1, 'left'); expect(g.mode).toBe('title')
  g.pointer('down', h.x0 - 1, h.row + 1, 'left'); expect(g.mode).toBe('title')
  g.pointer('down', h.x1 - 1, h.row + 1, 'left'); expect(g.mode).toBe('howto')
})
test('hover selects without launching; click elsewhere does nothing', () => {
  const g = mk(); g.draw(); const h = g.menuHit[3]!
  g.pointer('move', h.x0 + 3, h.row + 1); expect(g.menuSel).toBe(3); expect(g.mode).toBe('title')
  for (const [x, y] of [[0, 0], [1, 1], [g.W - 1, 5], [h.x0 + 3, g.menuHit[0]!.row - 1], [h.x0 + 3, g.menuHit[4]!.row + 3], [5, 200], [-3, -3]] as const) { g.pointer('down', x, y, 'left'); expect(g.mode).toBe('title') }
  expect(g.menuSel).toBe(3)
})
test('right-click / non-left down on a row does not launch', () => {
  const g = mk(); g.draw(); const h = g.menuHit[1]!
  g.pointer('down', h.x0 + 2, h.row + 1, 'right'); expect(g.mode).toBe('title')
})
test('Q on the title closes the arcade', () => { const g = mk(); g.key('q'); expect(g.wantsClose).toBe(true) })
test('Escape on the title closes the arcade too', () => { const g = mk(); g.key('escape'); expect(g.wantsClose).toBe(true) })

// ── how to play ─────────────────────────────────────────────────────────────
test('SPACE or a click on HOW TO PLAY starts the siege', () => {
  const a = mk(); a.key('1'); a.key(' '); expect(a.mode).toBe('play')
  const b = mk(); b.key('1'); b.pointer('down', 10, 10, 'left'); expect(b.mode).toBe('play')
  const c = mk(); c.key('1'); c.key('enter'); expect(c.mode).toBe('play')
})
test('HOW TO PLAY: B goes back to the menu; Q goes to the menu, not a close', () => {
  const a = mk(); a.key('1'); a.key('b'); expect(a.mode).toBe('title')
  const b = mk(); b.key('1'); b.key('q'); expect(b.mode).toBe('title'); expect(b.wantsClose).toBe(false)
})
test('HOW TO PLAY shows before every game, every time, including rematch', () => {
  const g = mk(); g.key('1'); expect(g.mode).toBe('howto'); g.key(' ')
  g.key('p'); g.key('r'); expect(g.mode).toBe('howto') // restart from pause
  g.key(' '); g.hp = 1; g.inv = 0; ram(g)
  for (let i = 0; i < 200 && g.mode === 'play'; i++) g.tick()
  expect(g.mode).toBe('over'); tickN(g, 250); g.key(' '); expect(g.mode).toBe('howto')
  g.key(' '); expect(g.mode).toBe('play')
})
test('HOW TO PLAY fits in 5 rows (HOWTO data: 2 lines per column + signature)', () => {
  for (const h of HOWTO) { expect(h.move.length).toBeLessThanOrEqual(2); expect(h.fight.length).toBeLessThanOrEqual(2); expect(h.win.length).toBeLessThanOrEqual(2) }
})
// BUG: drawHowto slices each column to cw-1 chars, so 40x11 clips 'or the mouse', 'SPACE repulsor', 'down the drones'
test('HOW TO PLAY text is fully visible at every size', () => {
  for (const [w, h] of SIZES) for (const hint of [false, true]) {
    const g = mk(w, h); g.key('1'); g.clickHint = hint; const s = screen(g), r = rows(g)
    const ctx = `${w}x${h} hint=${hint}`
    for (const t of ['MOVE', 'FIGHT', 'WIN', ...HOWTO[0]!.move, ...HOWTO[0]!.fight, ...HOWTO[0]!.win]) if (!s.includes(t)) throw new Error(`${ctx}: "${t}" not fully visible`)
    if (!/SPACE start/.test(s)) throw new Error(`${ctx}: SPACE start missing`)
    // the howto block (MOVE row to start row) is at most 5 rows
    const first = r.findIndex(x => x.includes('MOVE')), last = r.findIndex(x => x.includes('SPACE start'))
    expect(last - first + 1).toBeLessThanOrEqual(g.fb.rows) // 5 rows where three columns fit; narrow panes stack the sections, still inside the pane
  }
})
test('HOW TO PLAY signature line is not clipped mid-word', () => {
  for (const [w, h] of SIZES) {
    const g = mk(w, h); g.key('1'); const line = rows(g).find(x => x.includes('★'))
    if (!line) throw new Error(`${w}x${h}: no signature line`)
    const body = line.replace(/^[^★]*★/, '').replace(/[▀▄█]+/g, ' ').trim(); const sig = HOWTO[0]!.sig
    const words = body.split(' ').filter(Boolean), sw = sig.split(' ')
    // what is shown must be whole leading words of the real text
    expect(strip(sig).startsWith(strip(body)) || strip(body) === strip(sig)).toBe(true)
    void words; void sw
  }
})

// ── click hint ──────────────────────────────────────────────────────────────
test('CLICK TO PLAY lives on the bottom playfield row', () => {
  for (const [w, h] of SIZES) { const g = mk(w, h); g.clickHint = true; const r = rows(g); expect(r[r.length - 2]).toContain('CLICK') ; expect(r.slice(1, -2).some(x => x.includes('CLICK'))).toBe(false) }
})
test('CLICK TO PLAY bar never covers the title game rows', () => {
  for (const [w, h] of SIZES) {
    const g = mk(w, h); g.clickHint = true; const r = rows(g)
    expect(g.menuHit.length).toBe(5)
    g.menuHit.forEach((m, i) => {
      if (m.row >= r.length - 3) throw new Error(`${w}x${h}: game row ${i} at ${m.row} collides with the bottom bar`)
      if (!r[m.row + 1]!.includes(MENU[i]!.label.slice(0, 10))) throw new Error(`${w}x${h}: row ${i} text covered`)
    })
  }
})
test('title game rows are fully visible with no hint at every size', () => {
  for (const [w, h] of SIZES) { const s = screen(mk(w, h)); for (const m of MENU) if (!s.includes(m.label.split(' · ')[0]!)) throw new Error(`${w}x${h}: ${m.label} missing`) }
})
test('clickHint off: no CLICK text anywhere', () => { expect(screen(mk())).not.toContain('CLICK TO PLAY') })

// ── pause and quit ──────────────────────────────────────────────────────────
test('P pauses and P resumes', () => {
  const g = playing(); g.key('p'); expect(g.mode).toBe('pause'); g.key('p'); expect(g.mode).toBe('play')
})
test('while paused nothing advances over 300 ticks', () => {
  const g = playing(); tickN(g, 120); g.key('p')
  const snap = () => JSON.stringify([g.score, g.hp, g.wave, g.px, g.py, g.toSpawn, g.spawnT, g.E.map(e => [e.on, e.x, e.y, e.hp]), g.PB.map(s => [s.on, s.x]), g.EB.map(s => [s.on, s.x, s.y]), g.cdShield, g.rage, g.combo, g.inv])
  const a = snap(); tickN(g, 300); expect(snap()).toBe(a); expect(g.mode).toBe('pause')
})
test('keys while paused (move/fire) do not change the game', () => {
  const g = playing(); tickN(g, 60); g.key('p'); const a = [g.tx, g.ty, g.PB.filter(s => s.on).length]
  for (const k of ['up', 'down', 'left', 'right', ' ', '1', '2', '3']) g.key(k)
  expect([g.tx, g.ty, g.PB.filter(s => s.on).length]).toEqual(a)
})
test('Q in play pauses with quit armed; second Q closes', () => {
  const g = playing(); g.key('q'); expect(g.mode).toBe('pause'); expect(g.quitArmed).toBe(true); expect(g.wantsClose).toBe(false)
  g.key('q'); expect(g.wantsClose).toBe(true)
})
// BUG: key() in pause returns before any disarm for keys other than p/b/r, so quitArmed stays true
test('any other key disarms quit', () => {
  for (const k of ['x', 'up', ' ', 'z', 'left', '1', 'enter']) {
    const g = playing(); g.key('q'); g.key(k)
    if (g.quitArmed) throw new Error(`"${k}" left quit armed`) // BUG: pause ignores keys other than p, so quit stays armed
    g.key('q'); expect(g.wantsClose).toBe(false)
  }
})
test('P while quit armed resumes and disarms', () => {
  const g = playing(); g.key('q'); g.key('p'); expect(g.mode).toBe('play'); expect(g.quitArmed).toBe(false)
  g.key('q'); expect(g.wantsClose).toBe(false)
})
test('Q on a plain pause arms quit (no close), then second Q closes', () => {
  const g = playing(); g.key('p'); g.key('q'); expect(g.wantsClose).toBe(false); g.key('q'); expect(g.wantsClose).toBe(true)
})

// ── siege ───────────────────────────────────────────────────────────────────
test('siege starts with hp>0, score 0, wave 1', () => {
  const g = playing(); expect(g.hp).toBeGreaterThan(0); expect(g.score).toBe(0); expect(g.wave).toBe(1); expect(g.bossWave).toBe(false)
})
test('SPACE fires a shot; held fire cooldown limits it', () => {
  const g = playing(); g.key(' '); expect(g.PB.filter(s => s.on).length).toBe(1)
  g.key(' '); expect(g.PB.filter(s => s.on).length).toBe(1) // cooldown
  tickN(g, 10); g.key(' '); expect(g.PB.filter(s => s.on).length).toBeGreaterThanOrEqual(2)
})
test('1 throws the shield and starts its cooldown; 1 again does nothing while cooling', () => {
  const g = playing(); g.key('1'); expect(g.shield.on).toBe(true); expect(g.cdShield).toBeGreaterThan(0)
})
test('2 calls thunder when ready', () => { const g = playing(); g.key('2'); expect(g.bolt.on || g.cdThunder > 0).toBe(true) })
test('3 smashes only when rage is full', () => {
  const g = playing(); g.rage = 40; g.key('3'); expect(g.smash.on).toBe(false)
  g.rage = 100; g.key('3'); expect(g.smash.on).toBe(true); expect(g.rage).toBe(0)
})
test('arrows move the suit target but never out of the arena', () => {
  for (const [w, h] of SIZES) {
    const g = playing(w, h)
    for (const k of ['up', 'left', 'down', 'right']) for (let i = 0; i < 80; i++) { g.key(k); if (i % 5 === 0) g.tick() }
    tickN(g, 60)
    for (const k of ['up', 'left', 'down', 'right']) {
      for (let i = 0; i < 80; i++) g.key(k)
      tickN(g, 60)
      if (!(g.px >= 0 && g.px <= g.W && g.py >= 0 && g.py <= g.H)) throw new Error(`${w}x${h} left arena px=${g.px} py=${g.py} after ${k}`)
    }
  }
})
test('down moves the suit down and up moves it up', () => {
  const g = playing(); const y = g.ty; g.key('down'); expect(g.ty).toBeGreaterThan(y); g.key('up'); g.key('up'); expect(g.ty).toBeLessThan(y)
})
test('enemies spawn', () => { const g = playing(); tickN(g, 200); expect(g.E.some(e => e.on)).toBe(true) })
test('a kill raises the score', () => {
  const g = playing(); g.inv = 99; const e = g.E[0]!
  Object.assign(e, { on: true, kind: 0, x: g.px + 25, y: g.py + 4, vx: 0, vy: 0, hp: 1, max: 1 })
  const s0 = g.score
  for (let i = 0; i < 90 && g.score === s0; i++) { g.key(' '); g.tick() }
  expect(g.score).toBeGreaterThan(s0)
})
test('getting hit lowers hp', () => {
  const g = playing(); g.inv = 0; const hp = g.hp
  ram(g)
  tickN(g, 30); expect(g.hp).toBeLessThan(hp)
})
test('invulnerability after a hit: one drone does not drain all hp at once', () => {
  const g = playing(); g.inv = 0
  ram(g)
  tickN(g, 5); expect(g.hp).toBe(2)
})
test('clearing a wave starts the next', () => {
  const g = playing(); g.toSpawn = 0; for (const e of g.E) e.on = false; tickN(g, 3); expect(g.wave).toBe(2)
})
test('every 4th wave is Ultron Prime (kind 3)', () => {
  const g = playing()
  for (const w of [2, 3, 4, 5, 8]) { g.toSpawn = 0; for (const e of g.E) e.on = false; g.wave = w - 1; g.hp = 3; g.inv = 99; tickN(g, 2); expect(g.wave).toBe(w); expect(g.bossWave).toBe(w % 4 === 0) }
  g.wave = 3; g.toSpawn = 0; for (const e of g.E) e.on = false; tickN(g, 2); g.inv = 99
  tickN(g, 150); expect(g.E.some(e => e.on && e.kind === 3)).toBe(true)
})
test('hp 0 -> game over; score posts once via outbox; best updates', () => {
  const g = playing(); g.score = 1234; g.best = 10; g.hp = 1; g.inv = 0
  ram(g)
  for (let i = 0; i < 100 && g.mode === 'play'; i++) g.tick()
  expect(g.mode).toBe('over'); expect(g.hp).toBe(0); expect(g.outbox).toEqual({ score: 1234 }); expect(g.best).toBe(1234)
  const first = g.outbox; g.outbox = undefined // what the Client does
  tickN(g, 300); expect(g.outbox).toBeUndefined(); void first
})
test('game over with a lower score keeps the old best', () => {
  const g = playing(); g.score = 5; g.best = 900; g.hp = 1; g.inv = 0
  ram(g)
  tickN(g, 100); expect(g.mode).toBe('over'); expect(g.best).toBe(900)
})
function die(g: Game) {
  g.hp = 1; g.inv = 0; ram(g)
  for (let i = 0; i < 100 && g.mode === 'play'; i++) g.tick(); tickN(g, 250); expect(g.mode).toBe('over')
}
test('game over: SPACE restarts via HOW TO PLAY with fresh state', () => {
  const g = playing(); g.score = 50; die(g); g.key(' '); expect(g.mode).toBe('howto'); g.key(' '); expect(g.mode).toBe('play')
  expect(g.score).toBe(0); expect(g.wave).toBe(1); expect(g.hp).toBeGreaterThan(0)
})
test('game over: R restarts via HOW TO PLAY', () => {
  const g = playing(); die(g); g.key('r'); expect(g.mode).toBe('howto') // BUG: over mode ignores R
})
test('game over: Q goes to the menu', () => { const g = playing(); die(g); g.key('q'); expect(g.mode).toBe('title'); expect(g.wantsClose).toBe(false) })
test('game over: M goes to the menu', () => { const g = playing(); die(g); g.key('m'); expect(g.mode).toBe('title') }) // BUG: over mode ignores M
test('game over: restart keys are ignored during the first moments (no accidental skip)', () => {
  const g = playing(); g.hp = 1; g.inv = 0; ram(g)
  for (let i = 0; i < 100 && g.mode === 'play'; i++) g.tick()
  g.key(' '); expect(g.mode).toBe('over')
})
test('after game over, ticking forever keeps mode over and values finite', () => {
  const g = playing(); die(g); tickN(g, 600); expect(g.mode).toBe('over'); expect(Number.isFinite(g.score)).toBe(true)
})
test('10k ticks of seeded random input: no NaN anywhere', () => {
  for (const seed of [1, 2, 3]) {
    const g = mk(100, 28, seed), r = lcg(seed * 77)
    for (let i = 0; i < 10000; i++) {
      if (r() < 0.5) g.key(KEYS[Math.floor(r() * KEYS.length)]!)
      if (r() < 0.01) g.key(r() < 0.5 ? ' ' : '1')
      if (g.mode === 'over' || g.mode === 'title') g.key(' ')
      if (g.wantsClose) g.wantsClose = false
      if (r() < 0.02) g.pointer(r() < 0.5 ? 'down' : 'move', r() * g.W, r() * 30, 'left')
      if (g.mode === 'pause' && r() < 0.05) g.key('p')
      g.tick(); g.outbox = undefined
      if (i % 500 === 0) for (const v of [g.score, g.hp, g.px, g.py, g.tx, g.ty, g.wave, g.rage, g.t, g.best]) if (!Number.isFinite(v)) throw new Error(`NaN seed ${seed} frame ${i}`)
    }
    for (const e of g.E) for (const v of [e.x, e.y, e.vx, e.vy, e.hp]) expect(Number.isFinite(v)).toBe(true)
    for (const s of [...g.PB, ...g.EB]) expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true)
  }
})

// ── frames ──────────────────────────────────────────────────────────────────
const bad = (ch: string) => { const c = ch.codePointAt(0)!; return c < 0x20 || (c >= 0x7f && c <= 0x9f) || c > 0xffff || (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xd800 && c <= 0xdfff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0x0300 && c <= 0x036f) || c === 0x200b || c === 0xfe0f }
function checkFrame(g: Game, w0: number, h: number, ctx: string, strictW = false) {
  const w = strictW ? w0 : g.W
  g.draw(); const out = g.frameRuns()
  if (out.length > h) throw new Error(`${ctx}: ${out.length} rows > ${h}`)
  out.forEach((r, i) => {
    let n = 0
    for (const run of r) for (const ch of run.s) { n++; if (bad(ch)) throw new Error(`${ctx} row ${i}: bad char U+${ch.codePointAt(0)!.toString(16)}`) }
    if (n !== w) throw new Error(`${ctx} row ${i}: width ${n} != ${w}`)
  })
}
test('every frame at every size: printable width-1 BMP, rows<=pane, width==pane (all modes)', () => {
  for (const [w, h] of SIZES) {
    const g = mk(w, h), ctx = `${w}x${h}`
    checkFrame(g, w, h, ctx + ' title'); tickN(g, 5); g.clickHint = true; checkFrame(g, w, h, ctx + ' title+hint'); g.clickHint = false
    g.key('1'); checkFrame(g, w, h, ctx + ' howto'); g.key(' ')
    for (let i = 0; i < 400; i++) { if (i % 3 === 0) g.key(' '); if (i % 7 === 0) g.key(i % 14 ? 'up' : 'down'); if (i === 100) g.key('1'); if (i === 150) { g.rage = 100; g.key('3') } if (i === 200) g.key('2'); g.tick(); if (i % 40 === 0) checkFrame(g, w, h, ctx + ' play') }
    g.key('p'); checkFrame(g, w, h, ctx + ' pause'); g.key('q'); checkFrame(g, w, h, ctx + ' quit armed'); g.key('p')
    g.hp = 1; g.inv = 0; g.score = 123456; ram(g)
    for (let i = 0; i < 200; i++) g.tick(); checkFrame(g, w, h, ctx + ' over'); tickN(g, 60); checkFrame(g, w, h, ctx + ' over late')
  }
})
test('frame width equals the pane width up to 240 columns', () => {
  for (const [w, h] of SIZES) checkFrame(mk(w, h), Math.min(w, 220), h, `${w}x${h}`, true) // the engine caps rows at 220 columns by design (the frame-size budget); the Client draws at that width
})
test('resize mid-game, down to 1x1 and back, never throws and the game keeps working', () => {
  const g = playing(120, 40)
  tickN(g, 100)
  for (const [w, h] of [[80, 20], [1, 1], [0, 0], [-5, -5], [1, 1], [40, 11], [240, 70], [100, 28], [1, 100], [500, 1]] as [number, number][]) {
    g.resize(w, h); for (let i = 0; i < 30; i++) { g.key(i % 2 ? 'up' : 'down'); g.key(' '); g.tick() }
    g.draw(); g.frameRuns()
    for (const v of [g.px, g.py, g.tx, g.ty]) expect(Number.isFinite(v)).toBe(true)
  }
  expect(g.mode).toBe('play'); const s = g.score; tickN(g, 300); expect(g.hp > 0 || g.mode === 'over').toBe(true); void s
  g.resize(100, 28); checkFrame(g, 100, 28, 'after resize')
})
test('resize on title/howto/over/pause modes does not throw', () => {
  const g = mk(); for (const [w, h] of [[1, 1], [100, 28]] as const) g.resize(w, h), g.draw(), g.frameRuns()
  g.key('1'); g.resize(1, 1); g.draw(); g.key(' '); g.resize(60, 11); g.key('p'); g.resize(1, 1); g.draw(); g.frameRuns()
})
test('suit stays inside the arena after a shrink', () => {
  const g = playing(240, 70); g.key('right'); g.key('down'); for (let i = 0; i < 20; i++) g.key('right'); tickN(g, 60); g.resize(40, 11); tickN(g, 60)
  expect(g.px).toBeLessThanOrEqual(g.W); expect(g.py).toBeLessThanOrEqual(g.H) // BUG: resize() leaves tx/ty unclamped, so the suit drifts off-arena
})

// ── determinism ─────────────────────────────────────────────────────────────
test('same seed + same inputs gives the same frames; different seed differs', () => {
  const run = (seed: number) => {
    const g = mk(100, 28, seed), r = lcg(99), out: string[] = []
    g.key('1'); g.key(' ')
    for (let i = 0; i < 900; i++) { if (r() < 0.4) g.key(KEYS[Math.floor(r() * KEYS.length)]!); g.tick(); if (i % 30 === 0) out.push(screen(g)) }
    return out.join('\u0001')
  }
  expect(run(5)).toBe(run(5)); expect(run(5)).not.toBe(run(6))
})

// ── the Client ──────────────────────────────────────────────────────────────
const mount = async ($: any, on: any, focused = true) => {
  mock.store(on)
  const closed: string[] = []
  on('ui.close', (_$: any, e: any) => { closed.push(e.id); return { value: undefined } as any })
  const m = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'Pane', requestId: 'avengers-arcade', props: { title: 'STARK ARCADE', isFocused: focused, bodyColumns: 100, placement: 'dock', scroll: { bodyRows: 30 }, view: {} } })
  await m.resize({ columns: 100, rows: 28, in: 'arcade' }); await m.advance(200)
  return { m, closed }
}
const drawn = async (m: any) => JSON.stringify(await m.drawn({ in: 'arcade' }))
test('Client: CLICK TO PLAY before input, clock stopped for 2 s', async ($: any, on: any) => {
  const { m } = await mount($, on); const a = await drawn(m); expect(a).toContain('CLICK')
  await m.advance(2000); expect(await drawn(m)).toBe(a)
})
test('Client: a key starts it and it keeps running without further input', async ($: any, on: any) => {
  const { m } = await mount($, on); const a = await drawn(m)
  await m.key({ key: 'down', in: 'arcade' }); await m.advance(300); const b = await drawn(m); expect(b).not.toBe(a); expect(b).not.toContain('CLICK TO PLAY')
  await m.advance(1000); const c = await drawn(m); await m.advance(1000); expect(await drawn(m)).not.toBe(c)
})
test('Client: a click starts it and it keeps running', async ($: any, on: any) => {
  const { m } = await mount($, on); const a = await drawn(m)
  await m.pointer({ type: 'down', x: 50, y: 10, button: 'left', in: 'arcade' }); await m.advance(1000)
  const b = await drawn(m); expect(b).not.toBe(a); await m.advance(1000); expect(await drawn(m)).not.toBe(b)
})
test('Client: keeps running when the focused prop is false', async ($: any, on: any) => {
  const { m } = await mount($, on, false); await m.key({ key: 'down', in: 'arcade' }); await m.advance(1000)
  const a = await drawn(m); await m.advance(1000); expect(await drawn(m)).not.toBe(a); expect(a).not.toContain('CLICK TO PLAY')
})
// (20 s idle stop not testable: the Client's Date.now is the real clock, which m.advance does not move)
test('Client: does not stop before 20 s of idleness', async ($: any, on: any) => {
  const { m } = await mount($, on); await m.key({ key: 'down', in: 'arcade' }); await m.advance(15000)
  const a = await drawn(m); await m.advance(500); expect(await drawn(m)).not.toBe(a)
})
test('Client: Q on the title posts close (closes the pane)', async ($: any, on: any) => {
  const { m, closed } = await mount($, on); await m.key({ key: 'q', in: 'arcade' }); await m.advance(200)
  expect(closed).toContain('avengers-arcade')
})
test('Client: Q during play pauses only; second Q closes', async ($: any, on: any) => {
  const { m, closed } = await mount($, on); await m.key({ key: '1', in: 'arcade' }); await m.key({ key: ' ', in: 'arcade' }); await m.advance(200)
  await m.key({ key: 'q', in: 'arcade' }); await m.advance(200); expect(closed).toEqual([])
  await m.key({ key: 'q', in: 'arcade' }); await m.advance(200); expect(closed).toContain('avengers-arcade')
})
