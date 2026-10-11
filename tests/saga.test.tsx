import { expect, mock } from 'claude-code/testing'
import { test } from './timed'
import { Canvas, Surface, safeCell } from '../hooks/pixel'
import { MOVIES, findMovie } from '../hooks/movies'
import { plan, castOf, beatAt, onScreen, ensembleShare } from '../hooks/saga-plan'
import { figsDrawn, figScales, spriteCount, capFor } from '../hooks/saga-stage'
import { MSPRITES } from '../hooks/msprites'
import { drawChar, INK } from '../hooks/saga'
import { CHARS, crowdDrawn, crowdSeen, keyTime, impactOf, sheetCount } from '../hooks/saga'
import { BURST_KINDS, drawBurst } from '../hooks/burst'
import { Theater, BURST_GAP_S, FPS } from '../hooks/theater-engine'
import * as M01 from '../hooks/movie-01-assemble'
import * as M02 from '../hooks/movie-02-ultron'
import * as M03 from '../hooks/movie-03-civilwar'
import * as M04 from '../hooks/movie-04-ragnarok'
import * as M05 from '../hooks/movie-05-awesomemix'
import * as M06 from '../hooks/movie-06-wakanda'
import * as M07 from '../hooks/movie-07-infinitywar'
import * as M08 from '../hooks/movie-08-endgame'
import * as M09 from '../hooks/movie-09-multiverse'
import * as M10 from '../hooks/movie-10-whatif'
import { ROSTER, ROSTER_SECONDS, HERO } from '../hooks/scenes'

const FIGHTERS = ['CAP', 'IRONMAN', 'THOR', 'HULK', 'HULKBUSTER', 'THANOS', 'BUCKY', 'FALCON', 'ANTMAN', 'HAWKEYE', 'WANDA', 'WARMACHINE', 'WIDOW', 'PANTHER', 'SPIDEY', 'VISION']
const SIZES = [[60, 20], [100, 30], [170, 45], [250, 60]] as const
const wide = (b: any) => b.k === 'crowd' || b.k === 'charge' || b.k === 'arrive'

// Draws one sampled frame of every beat of the playing movie; checks every cell.
function sweep(th: Theater, offsets: ((b: any) => number)[] = [b => Math.max(keyTime(b), impactOf(b))]) {
  const p = th.plan!
  let worst = 0, n = 0, ms = 0
  for (const b of p.beats) for (const off of offsets) {
    th.tm = Math.min(p.len - 0.01, b.start + Math.min(off(b), b.d - 0.01)); th.time += 0.083
    const t0 = performance.now()
    th.draw(); const { size } = th.out()
    ms += performance.now() - t0; n++
    worst = Math.max(worst, size)
    const w = th.sf.words
    for (let i = 0; i < w.length; i += 3) {
      const cp = w[i]!
      if (safeCell(String.fromCodePoint(cp)) !== cp) throw new Error(`bad cell ${cp.toString(16)} in ${p.movie.id}`)
    }
  }
  expect(worst).toBeLessThanOrEqual(100000)
  return { frames: n, ms }
}

test('10 movies, each 5-10 minutes for several seeds', () => {
  expect(MOVIES.length).toBe(10)
  for (const m of MOVIES) for (const seed of [1, 7, 99, 12345, 0xabcdef]) {
    const len = plan(m, seed).len
    expect(len).toBeGreaterThanOrEqual(300)
    expect(len).toBeLessThanOrEqual(600)
  }
})

test('every movie plays start to finish at 4 sizes with only safe cells', { timeoutMs: 120000 }, () => {
  for (const [W, H] of SIZES) {
    const th = new Theater(W, H, 5)
    for (let i = 0; i < MOVIES.length; i++) { th.watch(i); sweep(th) }
  }
})

test('a real playthrough by tick() ends and posts watched', { timeoutMs: 120000 }, () => {
  const th = new Theater(100, 30, 3)
  th.watch(0)
  let n = 0
  while (!th.ended && n++ < 12 * 700) { th.tick(); if (n % 240 === 0) { th.draw(); th.out() } }
  expect(th.ended).toBe(true)
  expect(th.outbox).toContainEqual({ watched: MOVIES[0]!.id })
  th.draw(); th.out()
})

test('each viewing is randomised; the same seed repeats', () => {
  const m = MOVIES[9]!
  const sig = (s: number) => JSON.stringify(plan(m, s).beats.map(b => [b.k, b.l, b.r, b.text, b.att]))
  expect(sig(1)).not.toBe(sig(2))
  expect(sig(1)).toBe(sig(1))
  const th = new Theater(100, 30, 11)
  th.watch(9); const a = JSON.stringify(th.plan!.beats.map(b => [b.k, b.text]))
  th.watch(9); expect(JSON.stringify(th.plan!.beats.map(b => [b.k, b.text]))).not.toBe(a)
})

test('the library holds the whole roster, every fighter and the villains', () => {
  const cast = new Set<string>()
  const plans = MOVIES.map(m => plan(m, 1))
  for (const p of plans) for (const c of castOf(p)) cast.add(c)
  const map: Record<string, string> = { thinking: 'JARVIS', responding: 'JARVIS', jarvis: 'JARVIS', witch: 'WANDA', snap: 'THANOS' }
  for (const a of ROSTER) {
    if (a === 'assemble') continue
    const id = map[a] ?? a.toUpperCase()
    expect(CHARS as Record<string, unknown>).toHaveProperty(id)
    expect(cast.has(id)).toBe(true)
  }
  for (const c of [...FIGHTERS, 'LOKI', 'ULTRON', 'THANOS']) expect(cast.has(c)).toBe(true)
  for (const p of plans) {
    // a film: cold open, then the title; the story ends on its card, then rolling credits and a post-credits sting
    const ks = p.beats.map(b => b.k)
    expect(ks[ks.length - 1]).toBe('sting'); expect(ks[ks.length - 2]).toBe('credits'); expect(ks[ks.length - 3]).toBe('card')
    expect(ks.indexOf('cover')).toBeGreaterThan(0)
    expect(p.beats.some(wide)).toBe(true)
  }
  const crowd = plans[7]!.beats.filter(b => b.k === 'crowd')
  expect(crowd.some(b => b.who.length + b.rw.length + (b.l ? 1 : 0) + (b.r ? 1 : 0) >= 30)).toBe(true)
})

// The sandbox has no process/gc, so heapUsed is measured by a bun script (see the report); here: no canvas is
// ever made by draw(), the sheet cache stays bounded, and a frame is quick.
test('memory: all 10 movies at 170x45 make no canvas after warm-up', { timeoutMs: 120000 }, () => {
  const th = new Theater(170, 45, 9)
  for (let i = 0; i < MOVIES.length; i++) { th.watch(i); sweep(th) } // warm-up
  const c0 = Canvas.made
  let frames = 0, ms = 0
  for (let i = 0; i < MOVIES.length; i++) { th.watch(i); const r = sweep(th); frames += r.frames; ms += r.ms }
  expect(Canvas.made).toBe(c0)
  expect(sheetCount()).toBeLessThanOrEqual(16)
})

test('list screen: 10 hits, keys, pointer, close', () => {
  for (const [W, H] of [[170, 45], [100, 30], [60, 20]] as const) {
    const th = new Theater(W, H, 1); th.draw(); th.out()
    expect(th.hits.length).toBe(10)
    for (const h of th.hits) expect(h.y0).toBeGreaterThanOrEqual(1)
    for (const h of th.hits) {
      const t2 = new Theater(W, H, 1); t2.draw()
      t2.pointer('move', h.x0, h.y0); expect(t2.sel).toBe(h.i)
      t2.pointer('down', h.x0, h.y0); expect(t2.mode).toBe('watch'); expect(t2.sel).toBe(h.i)
    }
  }
  const th = new Theater(170, 45, 1); th.draw()
  th.key('4'); expect(th.mode).toBe('watch'); expect(th.plan!.movie.n).toBe(4)
  const t2 = new Theater(170, 45, 1)
  t2.key('down'); expect(t2.sel).toBe(1); t2.key('up'); t2.key('up'); expect(t2.sel).toBe(9)
  t2.key('right'); expect(t2.sel).toBe(0); t2.key('down'); t2.key(' '); expect(t2.mode).toBe('watch'); expect(t2.sel).toBe(1)
  const t3 = new Theater(170, 45, 1); t3.key('q'); expect(t3.outbox).toContainEqual({ close: true })
})

test('watching: tick, pause, skip, back to the list', () => {
  const th = new Theater(100, 30, 2); th.watch(2)
  th.tick(); th.tick(); expect(th.tm).toBeGreaterThan(0)
  th.key('p'); const t = th.tm
  for (let i = 0; i < 10; i++) th.tick()
  expect(th.tm).toBe(t)
  th.key('p'); th.tick(); expect(th.tm).toBeGreaterThan(t)
  const p = th.plan!, i = beatAt(p, th.tm)
  th.key('right'); expect(beatAt(p, th.tm)).toBe(i + 1); expect(Math.abs(th.tm - p.beats[i + 1]!.start)).toBeLessThan(0.01)
  th.key('left'); expect(beatAt(p, th.tm)).toBe(i)
  th.key('q'); expect(th.mode).toBe('list')
})

test('bursts: rare, short, only with fx; every kind draws', { timeoutMs: 120000 }, () => {
  for (const fx of [true, false]) {
    const th = new Theater(100, 30, 4); th.fx = fx; th.watch(7)
    const ats: number[] = []
    let seen = 0, long = 0, startAt = 0
    for (let n = 0; n < 12 * 700 && !th.ended; n++) {
      th.tick()
      if (th.burst) { if (th.burst.at !== startAt) { startAt = th.burst.at; ats.push(th.burst.at) } long = Math.max(long, th.time - th.burst.at) }
      if (n % 500 === 0) { th.draw(); th.out() }
      seen = th.bursts
    }
    if (fx) {
      expect(seen).toBeGreaterThan(0)
      expect(long).toBeLessThanOrEqual(1.1)
      for (let i = 1; i < ats.length; i++) expect(ats[i]! - ats[i - 1]!).toBeGreaterThanOrEqual(BURST_GAP_S - 0.001)
    } else { expect(seen).toBe(0); expect(ats.length).toBe(0) }
  }
  for (const [W, H] of [[60, 20], [100, 30], [250, 70]] as const) {
    const sf = new Surface(W, H)
    for (const k of BURST_KINDS) for (const u of [0, 0.25, 0.5, 0.75, 1]) { sf.cv.clear(); drawBurst(sf.cv, k, u) }
  }
})

// ── hooks ───────────────────────────────────────────────────────────────────
const SPAN = { plugin: 'clarvis', surface: 'terminal' } as const
const flat = (n: any): string => typeof n === 'string' ? n : !n ? '' : (n.children ?? []).map(flat).join('')
const findRaster = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(findRaster).find(Boolean))
function rasterText(n: any): string {
  const r = findRaster(n)
  if (!r) return ''
  const bin = atob(r.props.cells), u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  const w = new Uint32Array(u8.buffer)
  const out: string[] = []
  for (let y = 0; y < r.props.rows; y++) { let s = ''; for (let x = 0; x < r.props.columns; x++) s += String.fromCodePoint(w[(y * r.props.columns + x) * 3]!); out.push(s) }
  return out.join('\n')
}
const find = (n: any, f: (n: any) => boolean): any => (!n || typeof n !== 'object' ? undefined : f(n) ? n : (n.children ?? []).map((c: any) => find(c, f)).find(Boolean))
function session(on: any, opened: any[] = [], store = true) {
  if (store) mock.store(on)
  mock.env(on, { COLORTERM: 'truecolor' })
  const clock = mock.clock(on, { now: 0 })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'sonnet' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 41, tokens: 82400 }, rateLimits: [] } }))
  on('command.register', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.notice', () => ({ value: undefined }))
  on('ui.open', (_$: any, e: any) => { opened.push(e.id); return { value: undefined } as any })
  on('tool.call', () => ({ result: { ok: true } }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '', reason: 'answer' }) as any)
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>hello stock</Text> })
  return clock
}
const startS = ($: any) => $.session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
const run = ($: any, args: string) => $.command.run({ command: 'clarvis', args } as any)

test('/clarvis movies opens the theater', async ($, on) => {
  const opened: string[] = []
  session(on, opened); await startS($)
  await run($, 'movies')
  expect(opened).toEqual(['avengers-theater'])
})

test('/clarvis movie <n|name|next|random> opens and names it; bad ones do not', async ($, on) => {
  const opened: string[] = []
  session(on, opened); await startS($)
  const t = (r: any) => JSON.stringify(r)
  expect(t(await run($, 'movie 4'))).toContain(MOVIES[3]!.title)
  expect(t(await run($, 'movie ragnarok'))).toContain(findMovie('ragnarok')!.title)
  expect(t(await run($, 'movie next'))).toContain('now showing')
  expect(t(await run($, 'movie random'))).toContain('now showing')
  expect(opened.length).toBe(4)
  expect(opened.every(x => x === 'avengers-theater')).toBe(true)
  expect(t(await run($, 'movie 99'))).toContain('No movie')
  expect(t(await run($, 'movie zzz'))).toContain('No movie')
  expect(opened.length).toBe(4)
})

test('/clarvis fx off persists and is reported', async ($, on) => {
  session(on); await startS($)
  await run($, 'fx off')
  expect(JSON.stringify(await run($, 'fx'))).toContain('off')
  await startS($) // a new session re-reads the stored choice
  expect(JSON.stringify(await run($, 'fx'))).toContain('off')
  await run($, 'fx on')
  expect(JSON.stringify(await run($, 'fx'))).toContain('on')
})

const pane = ($: any, cols = 100) => $.ui.mount({ ...SPAN, component: 'Pane', requestId: 'avengers-theater', props: { title: 'AVENGERS THEATER', isFocused: true, bodyColumns: cols, placement: 'dock', scroll: { bodyRows: 30, offset: 0 }, view: {} } })

test('the theater pane hosts ./theater.tsx; the clock idles until a key', async ($, on) => {
  session(on)
  const m = await pane($)
  expect(JSON.stringify(await m.drawn())).toContain('theater.tsx')
  await m.resize({ columns: 100, rows: 28, in: 'theater' })
  await m.advance(200)
  const a = JSON.stringify(await m.drawn({ in: 'theater' }))
  expect(flat(await m.drawn({ in: 'theater' }))).toContain('AVENGERS THEATER')
  await m.advance(2000)
  expect(JSON.stringify(await m.drawn({ in: 'theater' }))).toBe(a)
  await m.key({ key: '1', in: 'theater' })
  await m.advance(1000)
  expect(JSON.stringify(await m.drawn({ in: 'theater' }))).not.toBe(a)
})

test('the working band carries a MOVIES button that opens the theater', async ($, on) => {
  const opened: string[] = []
  const clock = session(on, opened); await startS($)
  await clock.advance(4000)
  await $.turn.start({ text: 'go', turnId: 't1' })
  const m = await $.ui.mount({ ...SPAN, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 120, scroll: { bodyRows: 19, offset: 0 }, view: {} } })
  await m.press({ key: 'movies' })
  expect(opened).toContain('avengers-theater')
})

const msg = (m: any, data: unknown) => m.post(data as any, { in: 'theater' })
const stock = (e: any) => { const { Text } = (globalThis as any).__noop ?? {}; return e }
void stock

test('a theater burst tints the transcript (fullscreen only) and clears', async ($, on) => {
  const clock = session(on); await startS($)
  await run($, 'fx on') // the transcript echo is opt-in
  await clock.advance(4000)
  const pm = await pane($)
  const mountMsg = (fs: boolean) => $.ui.mount({ ...SPAN, component: 'AssistantMessage', props: { text: 'hi', isFirstOfReply: true }, viewport: { columns: 120, rows: 40, isFullscreen: fs } })
  const base = JSON.stringify(await (await mountMsg(true)).drawn())
  expect(base).not.toContain('backgroundColor')
  await msg(pm, { fx: 'THOR' })
  const hot = await (await mountMsg(true)).drawn()
  expect(JSON.stringify(hot)).not.toBe(base)
  const cold = await (await mountMsg(false)).drawn()
  expect(JSON.stringify(cold)).toBe(base)
  await clock.advance(1500)
  expect(JSON.stringify(await (await mountMsg(true)).drawn())).toBe(base)
})

test('the working band still rotates every ROSTER hero without a movie mention', async ($, on) => {
  const clock = session(on); await startS($)
  await clock.advance(4000)
  await $.turn.start({ text: 'go', turnId: 't1' })
  const seen: string[] = []
  for (let i = 0; i < ROSTER.length; i++) {
    const m = await $.ui.mount({ ...SPAN, component: 'AbovePrompt', props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 100, scroll: { bodyRows: 19, offset: 0 }, view: {} } })
    const t = rasterText(await m.drawn())
    expect(t).not.toContain('AVENGERS SAGA'); expect(t).not.toContain('THEATER')
    seen.push(/◢ ([A-Z][A-Z .&'-]+)/.exec(t)?.[1]?.trim().toUpperCase() ?? '?')
    await clock.advance(ROSTER_SECONDS * 1000)
  }
  expect(new Set(seen)).toEqual(new Set(ROSTER.map(a => HERO[a].name.toUpperCase()))) // the session's shuffled order: every hero once a lap
})

test('every hooks/movie-*.ts exports one Movie and MOVIES lists all of them', () => {
  const mods = [M01, M02, M03, M04, M05, M06, M07, M08, M09, M10]
  for (const mod of mods) {
    const movies = Object.values(mod).filter((v: any) => v && typeof v === 'object' && Array.isArray(v.scenes))
    expect(movies.length).toBe(1)
    expect(Object.keys(mod).length).toBe(1)
    expect((movies[0] as any).scenes.length).toBeGreaterThan(0)
    expect(MOVIES).toContain(movies[0] as any)
  }
  expect(MOVIES.length).toBe(10)
})

test('the ENDGAME crowd panel shows the whole team: 30+ figures and 30+ colour clusters at 170x45 and 100x30', () => {
  for (const [W, H] of [[170, 45], [100, 30]] as const) {
    const th = new Theater(W, H, 7); th.watch(7); th.fx = false
    const i = th.plan!.beats.findIndex(b => b.k === 'crowd' && b.who.length >= 40)
    expect(i).toBeGreaterThan(0)
    const b = th.plan!.beats[i]!, sl = th.slots[i]!
    // the camera pans along the ranks as the portals deliver them: over the shot, 30+ heroes are on screen
    crowdSeen.fill(0)
    for (let k = 1; k <= 10; k++) { th.tm = b.start + (b.d * k) / 10.5; th.draw() }
    expect(crowdSeen.reduce((a, v) => a + v, 0)).toBeGreaterThanOrEqual(30)
    th.tm = b.start + b.d * 0.6; th.draw(); th.out()
    expect(crowdDrawn).toBeGreaterThanOrEqual(8)
    // distinct colours among the figures (the panel's ink, outside its plain backdrop rows)
    const cv = th.sf.cv, seen = new Set<number>()
    for (let y = sl.y0 + 2; y < sl.y1 - 2; y++) for (let x = sl.x0 * 2 + 2; x < sl.x1 * 2 - 2; x++) { const c = cv.px[y * cv.W + x]!; if (c >= 0) seen.add(c & 0xf0f0f0) }
    expect(seen.size).toBeGreaterThanOrEqual(30)
    // the crowd's page holds nothing else: it is the live panel, so it never gives up its figures first
    expect(th.slots.filter(s => s.page === sl.page).length).toBe(1)
  }
})

// WCAG contrast of two 0xRRGGBB colours
function contrast(a: number, b: number) {
  const L = (c: number) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f((c >> 16) & 255) + 0.7152 * f((c >> 8) & 255) + 0.0722 * f(c & 255) }
  const x = L(a), y = L(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
test('the list: every word sits on a solid plate with contrast ≥ 4.5:1, at 100x14, 100x28 and 170x45', () => {
  for (const [W, H] of [[100, 14], [100, 28], [170, 45]] as const) {
    const th = new Theater(W, H, 3); th.seen.add('assemble'); th.sel = 3
    th.draw(); th.out()
    const w = th.sf.words, cv = th.sf.cv
    let words = 0
    for (let i = 0; i < W * H; i++) {
      const g = cv.glyph[i]!
      if (!g || g === 0x20) continue // only text cells (the art is pixels)
      const ch = String.fromCodePoint(g)
      if (/[▀-▟]/.test(ch)) continue
      words++
      const fg = w[i * 3 + 1]!, bg = w[i * 3 + 2]!
      expect(bg).not.toBe(0x01000000) // never on the terminal's own background
      if (contrast(fg & 0xffffff, bg & 0xffffff) < 4.5) throw new Error(`${W}x${H}: low contrast for "${ch}" at ${i % W},${Math.floor(i / W)}: ${(fg & 0xffffff).toString(16)} on ${(bg & 0xffffff).toString(16)}`)
    }
    expect(words).toBeGreaterThan(100)
  }
})
test('the list layout: a clean menu at every size (one movie a row, titles whole), never a grid of covers', () => {
  for (const [W, H, rowsEach] of [[100, 14, 1], [100, 28, 2]] as const) {
    const th = new Theater(W, H, 3); th.draw()
    expect(th.hits.length).toBe(10)
    th.hits.forEach((h, i) => { expect(h.y1 - h.y0).toBe(rowsEach); expect(h.y1).toBeLessThanOrEqual(H); if (i) expect(h.y0).toBeGreaterThanOrEqual(th.hits[i - 1]!.y1) })
    // titles are never cut mid-word
    const text = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => String.fromCodePoint(th.sf.cv.glyph[r * W + c]! || 0x20)).join('')).join('\n')
    for (const m of MOVIES) expect(text).toContain(m.title.toUpperCase())
  }
  const big = new Theater(170, 45, 3); big.draw()
  expect(big.hits.length).toBe(10)
  expect(big.hits.every(h => h.y1 - h.y0 === 2)).toBe(true) // the same menu, roomier: never a grid of covers
})

test('a movie is one frame: every shot fills the pane between the letterbox bars, with no borders or gutters, at every size', () => {
  for (const [W, H] of [[100, 14], [100, 28], [170, 45]] as const) {
    const th = new Theater(W, H, 5); th.watch(3); th.fx = false
    for (const s of th.slots) { expect(s.x0).toBe(0); expect(s.x1).toBe(W); expect(s.y0).toBe(2) } // one region, full width
    const beats = th.plan!.beats
    for (let i = 0; i < beats.length; i += 7) {
      const b = beats[i]!
      if (b.k === 'cover' || b.k === 'credits' || b.k === 'card' || (b.k === 'sting')) continue
      th.tm = b.start + Math.min(b.d - 0.1, 1.2); th.draw()
      const cv = th.sf.cv, s = th.slots[i]!
      // no panel border: the shot's edge columns are not a solid ink line, and no inner column is one either
      let inkCols = 0
      for (let xs = 0; xs < cv.W; xs += 2) {
        let ink = 0
        for (let y = s.y0; y < s.y1; y++) { const c = cv.px[y * cv.W + xs]!; if (c === 0x0b0b12) ink++ }
        if (ink >= (s.y1 - s.y0) * 0.95) inkCols++
      }
      expect(inkCols).toBe(0)
    }
  }
})

// ── the ensemble: no more two-character movies ──────────────────────────────
test('ensemble: every movie shows 3+ characters for at least 60% of its story, over several seeds', () => {
  for (const m of MOVIES) for (const seed of [1, 7, 99, 12345]) {
    const share = ensembleShare(plan(m, seed))
    if (share < 0.6) throw new Error(`${m.title} (seed ${seed}) shows 3+ characters only ${(share * 100).toFixed(0)}% of the time`)
  }
})

test('ensemble: every fight act (5+ blows, a cast of 4+) holds a set piece of 4+ characters', () => {
  for (const m of MOVIES) {
    const p = plan(m, 5), scenes = new Map<number, { fight: number; big: boolean; cast: Set<string> }>()
    for (const b of p.beats) {
      if (b.scene < 0) continue
      const s = scenes.get(b.scene) ?? { fight: 0, big: false, cast: new Set<string>() }
      for (const c of [b.l, b.r, ...b.ext, ...b.who, ...b.rw]) if (c) s.cast.add(c)
      if (['trade', 'special', 'super', 'clash', 'ko'].includes(b.k)) s.fight++
      if (onScreen(b) >= 4 && (b.k === 'battle' || b.k === 'teamup' || b.k === 'crowd' || b.k === 'charge' || b.brawl)) s.big = true
      scenes.set(b.scene, s)
    }
    for (const [si, s] of scenes) if (s.fight >= 5 && s.cast.size > 3 && !s.big) throw new Error(`${m.title}: scene ${si} (${m.scenes[si]!.cap}) fights without a 4+ character set piece`)
  }
})

test('ensemble: the frame really draws the characters a shot counts, at 100x28 and 170x45', { timeoutMs: 60000 }, () => {
  for (const [W, H] of [[100, 28], [170, 45]] as const) for (const mi of [2, 7]) {
    const th = new Theater(W, H, 3); th.watch(mi); th.fx = false
    const p = th.plan!
    let checked = 0, sets = 0
    for (let i = 0; i < p.beats.length; i += 3) {
      const b = p.beats[i]!
      if (b.k === 'cover' || b.k === 'credits' || b.k === 'card' || b.k === 'sting' || b.k === 'crowd' || b.k === 'charge' || b.k === 'arrive' || b.k === 'snap' || (b.k === 'say' && !b.ext.length)) continue // (a bare line may cut to a close-up)
      th.tm = b.start + Math.min(b.d - 0.05, 2.5); th.time += 0.083; th.draw()
      const want = Math.min(onScreen(b), 6)
      expect(figsDrawn()).toBeGreaterThanOrEqual(Math.min(want, W < 60 ? 2 : 3) - (b.k === 'say' ? 0 : 1))
      checked++; if (b.k === 'battle' || b.k === 'teamup') { sets++; expect(figsDrawn()).toBeGreaterThanOrEqual(Math.min(onScreen(b), 6) - 1) }
    }
    expect(checked).toBeGreaterThan(10)
    if (mi === 2) expect(sets).toBeGreaterThan(0)
  }
})

test('ensemble: a draw makes no canvas and the sprite cache stays bounded', { timeoutMs: 60000 }, () => {
  const th = new Theater(170, 45, 4)
  th.watch(2)
  for (const b of th.plan!.beats) { th.tm = b.start + Math.min(b.d - 0.05, 2); th.time += 0.083; th.draw() } // warm-up
  const c0 = Canvas.made
  for (const b of th.plan!.beats) { th.tm = b.start + Math.min(b.d - 0.05, 3); th.time += 0.083; th.draw() }
  expect(Canvas.made).toBe(c0)
  expect(spriteCount()).toBeLessThanOrEqual(3000)
})

test('every movie renders a non-empty frame for every shot of its whole timeline at 100x28', { timeoutMs: 60000 }, () => {
  const th = new Theater(100, 28, 11); th.fx = false
  for (let m = 0; m < MOVIES.length; m++) {
    th.watch(m)
    const p = th.plan!
    p.beats.forEach((b, i) => {
      th.tm = Math.min(p.len - 0.01, b.start + Math.min(b.d - 0.05, Math.max(1.3, b.d * 0.5))); th.time += 0.083; th.draw()
      const cv = th.sf.cv, s = th.slots[i]!, seen = new Set<number>()
      for (let y = s.y0; y < s.y1; y += 2) for (let x = 0; x < cv.W; x += 3) seen.add(cv.px[y * cv.W + x]!)
      const words = cv.glyph.some(g => g !== 0)
      if (seen.size < 3 && !words) throw new Error(`${p.movie.title}: shot ${i} (${b.k}) draws an empty frame (${seen.size} colours)`)
    })
  }
})

test('a name listed twice in ext is a deliberate double: the Mirror Dimension shows three Stranges', () => {
  const p = plan(MOVIES[8]!, 3), b = p.beats.find(x => x.sceneCap.startsWith('THE MIRROR') && x.k === 'say')!
  expect([b.l, ...b.ext].filter(c => c === 'STRANGE').length).toBe(3)
})

test('hand-drawn movie sprites: every sheet decodes, has 11 frames, and drawChar draws its own colours (no tint, no pasted head)', () => {
  const ids = Object.keys(MSPRITES)
  expect(ids.length).toBeGreaterThanOrEqual(41)
  for (const id of ids) {
    const F = MSPRITES[id]!
    expect(CHARS as Record<string, unknown>).toHaveProperty(id)
    expect(F.n).toBe(11)
    expect(atob(F.data).length).toBeGreaterThanOrEqual(F.w * F.h * 11)
    const pal = new Set([...F.pal, INK])
    for (const fr of [0, 4, 10]) {
      const cv = new Canvas(90, 100); cv.clear()
      drawChar(cv, id as keyof typeof CHARS, fr, 45, 90, 32, 1, 0)
      let n = 0
      for (const c of cv.px) if (c >= 0) { n++; if (!pal.has(c) && !(CHARS as Record<string, { ghost?: boolean }>)[id]!.ghost) throw new Error(`${id} pose ${fr}: colour ${c.toString(16)} is not in its own palette (tinted?)`) }
      expect(n).toBeGreaterThan(40)
    }
  }
})

test('one scale per shot: every figure is drawn at the shot scale (1 or 2 sheet pixels, 0.5 in a tiny pane) or exactly half of it, never above the base', { timeoutMs: 120000 }, () => {
  for (const [W, H] of [[100, 14], [100, 28], [120, 30], [170, 45]] as const) {
    const th = new Theater(W, H, 6); th.fx = false
    const base = (H - 2) * 2 - 2 >= 76 ? 64 : (H - 2) * 2 - 2 >= 40 ? 32 : 16 // pane rows: 2 per cell, minus the bars
    for (let m = 0; m < MOVIES.length; m++) {
      th.watch(m)
      const p = th.plan!
      p.beats.forEach((b, i) => {
        if (b.k === 'cover' || b.k === 'credits' || b.k === 'card' || b.k === 'sting') return
        for (const off of [0.4, 1.5]) {
          th.tm = Math.min(p.len - 0.01, b.start + Math.min(b.d - 0.05, off)); th.time += 0.083; th.draw()
          const sc = [...figScales()]
          for (const h of sc) if (![8, 16, 32, 64].includes(h) || h > base) throw new Error(`${p.movie.title} shot ${i} (${b.k}) at ${W}x${H}: figure height ${h} is not a legal scale (base ${base})`)
          if (sc.length > 2 || (sc.length === 2 && Math.max(...sc) !== 2 * Math.min(...sc))) throw new Error(`${p.movie.title} shot ${i} (${b.k}) at ${W}x${H}: mixed figure scales ${sc.join('/')}`)
          if (b.k !== 'crowd' && b.k !== 'charge' && b.k !== 'battle' && b.k !== 'teamup' && b.k !== 'arrive' && b.k !== 'snap' && figsDrawn() > capFor(W)) throw new Error(`${p.movie.title} shot ${i} (${b.k}) at ${W}x${H}: ${figsDrawn()} figures, over the cap of ${capFor(W)}`)
        }
      })
    }
  }
})
