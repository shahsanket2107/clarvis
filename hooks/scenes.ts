// clarvis: what the band draws. A frame is a pure function of time `t`
// (seconds) and the state handed in: nothing is kept between frames, and the
// only caches are the 3D turntables, rendered once and replayed.
//
//   idle      one Stark line: who, the suit's Mark, context used, spend
//   working   8 rows: a 3D stage where the hero of the moment turns (the arc
//             reactor while thinking), beside the content: what is running,
//             on what, JARVIS's line, the last three actions, the gauges
//   moments   full width, a few seconds: Stark boot, CLAUVENGERS, ASSEMBLE! (done),
//             Thanos (error), Nick Fury (needs you)
import { Canvas, CLEAR, HOLE, clamp01, easeIn, easeOut, easeOutBack, hash, lerp, rgb, scale, type HiSprite } from './pixel'
import * as B from './baked'
import { fmtDur } from './art'
import type { Piece, Tone } from './metrics'
import { guardianLane, guardianStage } from './guardians'
import { LANE_ART, STAGE_ART } from './portraits'
import { HAMMER, HELMET, REACTOR, SHIELD, STONES, Turntable } from './holo'

const TAU = Math.PI * 2
export const C = {
  text: rgb('#E6E6F5'), muted: rgb('#8C90B4'), dim: rgb('#565A7A'), faint: rgb('#33364C'),
  arc: rgb('#5FE1FF'), arcHi: rgb('#BFF8FF'), arcDim: rgb('#2B8FB0'), white: 0xffffff,
  gold: rgb('#F5C542'), goldHi: rgb('#FFE9A8'), red: rgb('#E5383F'), redHi: rgb('#FF7A66'),
  green: rgb('#7EE787'), hulk: rgb('#7CD650'), bolt: rgb('#BFD4FF'), boltDeep: rgb('#5C6CFF'),
  cap: rgb('#5C8BFF'), capRed: rgb('#F04A4F'), hawk: rgb('#B48AF0'), spidey: rgb('#FF4B5C'),
  amber: rgb('#FFB020'), alarm: rgb('#FF4D4D'), thanos: rgb('#A98AE0'), steel: rgb('#A5AFC2'),
}
export const fmtK = (n: number) => (n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
export { fmtDur }
export const fmtMs = (ms: number) => (ms < 1000 ? `${Math.max(0.1, ms / 1000).toFixed(1)}s` : fmtDur(ms))

// ── the heroes ──────────────────────────────────────────────────────────────
export type Hero = 'ironman' | 'hulk' | 'thor' | 'cap' | 'hawkeye' | 'spidey' | 'assemble' | 'jarvis' | 'strange' | 'witch' | 'widow' | 'panther' | 'vision' | 'loki' | 'ultron' | 'antman' | 'deadpool' | 'starlord' | 'gamora' | 'drax' | 'rocket' | 'groot' | 'mantis' | 'nebula' | 'yondu' | 'falcon' | 'warmachine' | 'cmarvel' | 'bucky'
export type Activity = Hero | 'thinking' | 'responding' | 'snap' | 'fury'
export const HERO: Record<Activity, { name: string; color: number }> = {
  ironman: { name: 'IRON MAN', color: C.red }, hulk: { name: 'HULK', color: C.hulk }, thor: { name: 'THOR', color: C.bolt },
  cap: { name: 'CAPTAIN AMERICA', color: C.cap }, hawkeye: { name: 'HAWKEYE', color: C.hawk }, spidey: { name: 'SPIDER-MAN', color: C.spidey },
  assemble: { name: 'THE AVENGERS', color: C.gold }, jarvis: { name: 'J.A.R.V.I.S.', color: C.arc },
  strange: { name: 'DOCTOR STRANGE', color: rgb('#FFA43A') }, witch: { name: 'SCARLET WITCH', color: rgb('#FF3E6C') },
  widow: { name: 'BLACK WIDOW', color: rgb('#E0233A') }, antman: { name: 'ANT-MAN', color: rgb('#E5383F') }, deadpool: { name: 'DEADPOOL & WOLVERINE', color: rgb('#FF4B5C') },
  panther: { name: 'BLACK PANTHER', color: rgb('#8E6CFF') }, vision: { name: 'VISION', color: rgb('#E0306A') }, loki: { name: 'LOKI', color: rgb('#3FBF5A') }, ultron: { name: 'ULTRON', color: rgb('#FF2A2A') },
  starlord: { name: 'STAR-LORD', color: rgb('#FF8A1E') }, gamora: { name: 'GAMORA', color: rgb('#62C23C') }, drax: { name: 'DRAX', color: rgb('#C0242C') }, rocket: { name: 'ROCKET', color: rgb('#F07A1C') },
  groot: { name: 'GROOT', color: rgb('#A8EC70') }, mantis: { name: 'MANTIS', color: rgb('#6FE08A') }, nebula: { name: 'NEBULA', color: rgb('#3C7BE0') }, yondu: { name: 'YONDU', color: rgb('#FF2A2A') },
  falcon: { name: 'FALCON', color: rgb('#D8323C') }, warmachine: { name: 'WAR MACHINE', color: rgb('#9AA3AD') }, cmarvel: { name: 'CAPTAIN MARVEL', color: rgb('#F4B731') }, bucky: { name: 'WINTER SOLDIER', color: rgb('#8FA3B8') },
  thinking: { name: 'J.A.R.V.I.S.', color: C.arc }, responding: { name: 'J.A.R.V.I.S.', color: C.arc }, snap: { name: 'THANOS', color: C.thanos }, fury: { name: 'NICK FURY', color: C.amber },
}
// While no tool runs, the stage and the lane rotate through the whole team.
export const ROSTER: Activity[] = ['thinking', 'ironman', 'warmachine', 'cap', 'falcon', 'bucky', 'thor', 'hulk', 'ultron', 'widow', 'panther', 'hawkeye', 'spidey', 'jarvis', 'fury', 'cmarvel', 'strange', 'vision', 'witch', 'antman', 'deadpool', 'loki', 'starlord', 'gamora', 'drax', 'rocket', 'groot', 'mantis', 'nebula', 'yondu']
export const ROSTER_SECONDS = 8 // long enough to read the line and watch the whole lane scene
export const MARK: Record<string, string> = { opus: 'MK-LXXXV', sonnet: 'MK-L', haiku: 'MK-XLII', fable: 'MK-I' }
const MODEL_TINT: Record<string, number> = { opus: rgb('#CBA6F7'), sonnet: rgb('#89B4FA'), haiku: rgb('#94E2D5'), fable: rgb('#F5C2E7') }

// Which hero answers which tool.
const TEST_RE = /\b(test|tests|jest|vitest|pytest|mocha|spec|bun test|npm t|go test|cargo test|rspec)\b/
export function heroFor(tool: string, detail = ''): Hero {
  if (/^(Edit|MultiEdit|NotebookEdit)$/.test(tool)) return 'ironman'
  if (tool === 'Write') return 'witch' // chaos magic: a file rewritten whole
  if (tool === 'Bash' || tool === 'BashOutput' || tool === 'PowerShell') return TEST_RE.test(detail) ? 'cap' : 'hulk'
  if (tool === 'WebSearch') return 'widow' // gathering intel
  if (tool === 'WebFetch' || tool.startsWith('mcp__')) return 'thor'
  if (tool === 'Read' || tool === 'NotebookRead') return 'cap'
  if (tool === 'Grep' || tool === 'ToolSearch') return 'hawkeye'
  if (tool === 'Glob' || tool === 'LS' || tool === 'LSP') return 'spidey'
  if (tool === 'Agent' || tool === 'Task' || tool === 'SendMessage') return 'strange' // a portal for a teammate
  return 'jarvis'
}

// ── text helpers ────────────────────────────────────────────────────────────
const len = (s: string) => [...s].length
export function clip(s: string, n: number) { const a = [...s]; return a.length <= n ? s : n <= 1 ? '…' : a.slice(0, n - 1).join('') + '…' }
// Typed out at `cps` characters a second; a block cursor while typing.
function typed(cv: Canvas, col: number, row: number, s: string, age: number, color: number, cps = 50, cursor = true) {
  const n = Math.max(0, Math.floor(age * cps)), all = [...s]
  cv.text(col, row, all.slice(0, n).join(''), color)
  if (cursor && n < all.length + 8 && Math.floor(age * 4) % 2 === 0) cv.text(col + Math.min(n, all.length), row, '▌', C.arcHi)
}
// Splits a line into two rows at a word, the second clipped.
function wrap2(s: string, w: number): [string, string] {
  const a = [...s]
  if (a.length <= w) return [s, '']
  let cut = a.lastIndexOf(' ', w)
  if (cut < w * 0.5) cut = w
  return [a.slice(0, cut).join(''), clip(a.slice(cut).join('').trimStart(), w)]
}
// The context gauge: a fine line, half a cell a step, cyan to gold to red.
function gauge(cv: Canvas, col: number, row: number, cells: number, pct: number) {
  const steps = Math.round((Math.max(0, Math.min(100, pct)) / 100) * cells * 2)
  for (let i = 0; i < cells; i++) {
    const k = i / Math.max(1, cells - 1)
    const c = k < 0.6 ? lerp(C.arc, C.gold, k / 0.6) : lerp(C.gold, C.red, (k - 0.6) / 0.4)
    const filled = steps - i * 2
    cv.text(col + i, row, filled >= 2 ? '━' : filled === 1 ? '╸' : '─', filled >= 1 ? c : C.faint)
  }
}

export type Who = { name: string; model: string }
export type Usage = { percent: number; tokens: number; cost: number; pieces?: Piece[]; hideCost?: boolean } // pieces: the extras after the spend (tokens, cache, rate limit), in priority order
const TONE: Record<Tone, number> = { steel: C.steel, arc: C.arc, text: C.text, amber: C.amber, red: C.alarm }
// "◢ name"; returns the columns it took.
function who(cv: Canvas, col: number, row: number, w: Who, max: number) {
  cv.text(col, row, '◢', C.arc)
  const name = clip(w.name, Math.max(6, max - 4))
  cv.text(col + 2, row, name, C.text)
  return Math.min(max, 3 + len(name))
}
// The gauges line: context used, the Mark, what the session has spent; drops pieces to fit.
function gauges(cv: Canvas, col: number, row: number, width: number, w: Who, u: Usage, state?: [string, number], keepState = false) {
  u = { percent: Number.isFinite(u.percent) ? u.percent : 0, tokens: Number.isFinite(u.tokens) ? u.tokens : 0, cost: Number.isFinite(u.cost) ? u.cost : 0, pieces: u.pieces, hideCost: u.hideCost } // a bad reading never takes the band down
  const mark = `${MARK[w.model] ?? w.model.toUpperCase()} ${w.model.toUpperCase()}`
  const pct = `${Math.round(u.percent)}%`
  const label = width >= 56 ? 'REACTOR' : 'CTX' // the context gauge is the arc reactor; a narrow band keeps the short word
  const draw = u.hideCost ? `${fmtK(u.tokens)} tok` : `$${u.cost.toFixed(2)} spent · ${fmtK(u.tokens)} tok` // showCost off: no money anywhere
  const short = u.hideCost ? `${fmtK(u.tokens)} tok` : `$${u.cost.toFixed(2)} spent`
  // the spend always shows: the gauge shrinks, then goes, then the token count, before the cost does
  const parts: [string, number][] = [[draw, C.text], [mark, MODEL_TINT[w.model] ?? C.muted]]
  const fit = (ps: [string, number][]) => Math.min(20, Math.floor(width * 0.18), width - ps.slice(1).reduce((n, [s]) => n + len(s) + 3, len(short) + 3) - 2 - label.length - len(pct))
  if (state && keepState) parts.splice(1, 0, state) // news (agents at work) outranks the gauge and the Mark
  else if (state && fit([...parts, state]) >= 4) parts.push(state) // the state goes before the ctx gauge does
  const tail = parts.slice(1).reduce((n, [s]) => n + len(s) + 3, len(short) + 3)
  const g = fit(parts)
  let x = col
  if (g >= 4) {
    cv.text(x, row, label, C.muted); x += label.length + 1
    gauge(cv, x, row, g, u.percent); x += g + 1
    cv.text(x, row, pct, u.percent > 85 ? C.alarm : C.text); x += len(pct) + 3
  }
  if (x + tail - len(short) + len(draw) > col + width) parts[0] = [short, C.text]
  // the spend first, then the extras (tokens, cache hit, rate limit) while the Mark (or the news) still fits after them, then the rest
  const end = col + width
  const drawPart = ([t, c]: [string, number]) => { cv.text(x, row, t, c); x += len(t) + 3 }
  let [first, ...rest] = parts
  if (first![0] && x + len(first![0]) > end) first = [short, C.text]
  drawPart(first!)
  const keep = rest[0] ? len(rest[0][0]) + 3 : 0
  for (const p of u.pieces ?? []) {
    if (x + len(p.text) + keep > end) break
    drawPart([p.text, TONE[p.tone] ?? C.text])
  }
  for (const part of rest) if (x + len(part[0]) <= end) drawPart(part)
}

// ── the card: every view sits on a raised panel ─────────────────────────────
// A surface a shade lighter than the terminal, its corners rounded off, and
// an accent bar down its left edge in the colour of the moment.
const PANEL = rgb('#202038')
export function card(cv: Canvas, accent: number, t = 0) {
  cv.panel = PANEL
  const W = cv.W, H = cv.h
  if (H <= 2) return // one line: the surface alone
  // an accent bar down the left edge in the colour of the moment, a sheen
  // travelling down it; the corners rounded off
  for (let y = 0; y < H; y++) {
    const sheen = Math.max(0, 1 - Math.abs(y - ((t * 10) % (H + 10)) + 5) / 3)
    cv.setSub(0, y, lerp(accent, 0xffffff, sheen * 0.5))
  }
  for (const y of [0, H - 1]) { cv.setSub(0, y, HOLE); cv.setSub(W - 1, y, HOLE) }
}

// ── idle: one line ──────────────────────────────────────────────────────────
export const IDLE_ROWS = 1
export function drawIdle(cv: Canvas, w: Who, u: Usage, busy?: string) {
  card(cv, busy ? C.gold : C.green)
  const used = who(cv, 1, 0, w, Math.min(42, Math.floor(cv.w * 0.32)))
  gauges(cv, used + 3, 0, cv.w - used - (cv.w >= 90 ? 30 : 2), w, u, busy ? [busy, C.gold] : ['✓ standing by', C.green], !!busy) // the right end: the movies and play buttons (shown from 90 columns)
}

// ── working: the stage and the content ──────────────────────────────────────
export const STAGE_ROWS = 7 // the 3D stage and the content beside it
export const LANE_ROWS = 6 // the full-width action lane beneath: tall enough for a hero in motion
export const WORK_ROWS = STAGE_ROWS + LANE_ROWS
export const WORK_ROWS_COMPACT = STAGE_ROWS
export const STAGE = 18 // columns
const turn: Partial<Record<string, Turntable>> = {}
function tt(name: string): Turntable {
  return (turn[name] ??= name === 'helmetLane' ? new Turntable(HELMET, 10, LANE_ROWS, 8, k => ({ yaw: 0.55 + Math.sin(k * TAU) * 0.1, pitch: 0.05 }))
    : name === 'helmet' ? new Turntable(HELMET, STAGE, STAGE_ROWS, 40, k => ({ yaw: Math.sin(k * TAU) * 0.55, pitch: 0.1 + Math.sin(k * TAU * 2) * 0.05 }))
    // face on, always round: it spins about its own centre (a fifth of a turn repeats the star)
    : name === 'shield' ? new Turntable(SHIELD, 17, 7, 24, k => ({ yaw: 0, pitch: 0, roll: (k * TAU) / 5 }))
    : name === 'hammer' ? new Turntable(HAMMER, STAGE, STAGE_ROWS, 36, k => ({ yaw: k * TAU, pitch: 0.15 }))
    : name === 'reactor' ? new Turntable(REACTOR, 15, 6, 36, k => ({ yaw: Math.sin(k * TAU) * 0.45, pitch: 0.15 + Math.cos(k * TAU) * 0.15, roll: (k * TAU) / 5 }))
    : name === 'stones' ? new Turntable(STONES, STAGE, STAGE_ROWS, 36, k => ({ yaw: Math.sin(k * TAU) * 0.6, pitch: 0.45, roll: (k * TAU) / 3 }))
    : new Turntable(STONES, STAGE, STAGE_ROWS, 36, k => ({ yaw: k * TAU, pitch: 0.4 })))
}
const center = (s: HiSprite, x0: number, wCols: number) => x0 + (wCols - s.w / 2) / 2

// A lightning bolt from (x, y0) down to y1, forking once in a while.
function bolt(cv: Canvas, x0: number, y0: number, y1: number, seed: number, a = 1, depth = 0) {
  let x = x0, y = y0, i = 0
  while (y < y1) {
    const nx = x + (hash(seed, i) - 0.5) * 2.4, ny = y + 1
    cv.glow(nx - 1, ny, C.boltDeep, 0.35 * a); cv.glow(nx + 1, ny, C.boltDeep, 0.35 * a)
    cv.line(x, y, nx, ny, a > 0.6 ? C.white : C.bolt)
    if (depth < 1 && hash(seed + 3, i) > 0.86) bolt(cv, nx, ny, Math.min(y1, ny + 3), seed * 1.7 + i, a * 0.7, 1)
    x = nx; y = ny; i++
  }
}
// The JARVIS globe: a wireframe sphere turning, the near lines bright, the
// far ones faint, a ping sweeping round the equator.
function globe(cv: Canvas, cx: number, cy: number, R: number, t: number) {
  const plot = (x: number, y: number, z: number) => {
    const a = t, X = x * Math.cos(a) + z * Math.sin(a), Z = -x * Math.sin(a) + z * Math.cos(a)
    const tilt = 0.35, Y = y * Math.cos(tilt) - Z * Math.sin(tilt), Z2 = y * Math.sin(tilt) + Z * Math.cos(tilt)
    const near = (Z2 + 1) / 2
    if (near > 0.5 || cv.get(cx + X * R, cy + Y * R) === -1) cv.setSub((cx + X * R) * 2, cy + Y * R, near > 0.5 ? lerp(C.arc, C.arcHi, (near - 0.5) * 2) : lerp(rgb('#163A4C'), C.arcDim, near * 2))
  }
  for (let lat = -50; lat <= 50; lat += 50) { const r = Math.cos((lat * Math.PI) / 180), y = -Math.sin((lat * Math.PI) / 180); for (let i = 0; i < 90; i++) { const a = (i / 90) * TAU; plot(Math.cos(a) * r, y, Math.sin(a) * r) } }
  for (let lon = 0; lon < 180; lon += 60) { const a = (lon * Math.PI) / 180; for (let i = 0; i < 60; i++) { const b = (i / 60) * TAU; plot(Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)) } }
  const p = (t * 1.6) % TAU
  cv.radial(cx + Math.cos(p) * R, cy + Math.sin(p) * R * 0.35, 2.2, C.gold, 0.9)
}

// JARVIS's holographic rings: a dashed ring turning one way, a ring of
// ticks the other, and a bright sweep arc racing round, Stark-lab cyan.
function hudRings(cv: Canvas, cx: number, cy: number, t: number) {
  cv.ring(cx, cy, 6.55, 6.95, ang => {
    const a = ((ang - t * 0.6) % TAU + TAU) % TAU
    const sweep = ((ang - t * 2.2) % TAU + TAU) % TAU // a bright arc racing round
    if (sweep > TAU - 1.1) return lerp(C.arcDim, C.arcHi, (sweep - (TAU - 1.1)) / 1.1)
    return (a / TAU * 12) % 1 < 0.12 ? C.arc : rgb('#1E4A5E') // twelve ticks on a faint ring
  })
}

// The stage: the hero of the moment, in 3D where it can be.
// Art never paints over the content beside the stage: whatever a stage or lane effect left right of the stage box (rows 0..STAGE_ROWS) is wiped.
function fence(cv: Canvas) {
  const x0 = STAGE * 2
  for (let y = 0; y < STAGE_ROWS * 2 && y < cv.h; y++) for (let x = x0; x < cv.W; x++) { const i = y * cv.W + x; if (cv.px[i] !== HOLE) cv.px[i] = CLEAR }
}
function stage(cv: Canvas, act: Activity, t: number, calm: boolean) {
  const art = STAGE_ART[act] // hand-drawn pixel art first, when the hero has it
  if (art) { art(cv, calm ? 0 : t, calm); return }
  const H = STAGE_ROWS * 2
  const tl = calm ? 0 : t
  switch (act) {
    case 'thinking': { // JARVIS: the reactor inside his holographic HUD rings
      const cx = STAGE / 2, cy = H / 2
      cv.radial(cx, cy, 6.5, C.arc, calm ? 0.15 : 0.15 + 0.1 * Math.sin(t * 4))
      hudRings(cv, cx, cy, calm ? 0 : t)
      const s = tt('reactor').at(tl / 6)
      cv.hi(s, center(s, 0, STAGE), cy - s.h / 2)
      break
    }
    case 'responding': case 'ironman': {
      const s = tt('helmet').at(tl / 6)
      cv.hi(s, center(s, 0, STAGE), 0)
      if (act === 'ironman' && !calm) { const k = (t % 1.6) / 1.6; if (k < 0.25) cv.radial(STAGE / 2, H * 0.45, 6, C.arcHi, (0.25 - k) * 3) }
      break
    }
    case 'cap': {
      // thrown round a circle, spinning as it goes, a fading trail behind
      const s = tt('shield').at(tl * 2.2), w = s.w / 2, R = 1.4, Ry = 0.8, sp = 2.4
      const at = (k: number): [number, number] => [STAGE / 2 + Math.cos(k * sp) * R - w / 2, H / 2 + Math.sin(k * sp) * Ry - s.h / 2]
      if (!calm) for (let i = 4; i >= 1; i--) { const [x, y] = at(t - i * 0.05); cv.radial(x + w / 2, y + s.h / 2, 4.5, C.cap, 0.12 * (1 - i / 5)) }
      const [x, y] = calm ? [STAGE / 2 - w / 2, H / 2 - s.h / 2] : at(t)
      cv.hi(s, x, Math.round(y))
      break
    }
    case 'thor': {
      const s = tt('hammer').at(tl / 0.9)
      cv.hi(s, center(s, 0, STAGE), 0)
      if (!calm && (t % 1.2) < 0.45) { const seed = Math.floor(t * 12); bolt(cv, STAGE / 2 + (hash(seed) - 0.5) * 6, 0, 4, seed); cv.radial(STAGE / 2, 3, 7, C.bolt, 0.4) }
      break
    }
    case 'hulk': {
      const s = B.fistStage
      const k = calm ? 1 : (t % 1.3) / 1.3, hit = 0.4
      const y = k < hit ? -s.h + (H - 2) * easeIn(k / hit) : H - 2 - s.h
      const shake = !calm && k > hit && k < hit + 0.15 ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0
      cv.hi(s, center(s, 0, STAGE) + shake, Math.round(y))
      cv.rect(0, H - 2, STAGE, 1, rgb('#4B5363')); cv.rect(0, H - 1, STAGE, 1, rgb('#2C313D'))
      if (!calm && k > hit) {
        const g = (k - hit) / (1 - hit)
        for (let i = 0; i < (STAGE / 2) * easeOut(g * 2); i++) for (const d of [-1, 1]) cv.set(STAGE / 2 + d * i, H - 2 + (hash(i, d) > 0.6 ? 1 : 0), lerp(C.goldHi, rgb('#2C313D'), g))
        for (let p = 0; p < 10; p++) { const vx = (hash(p, 3) - 0.5) * 26, vy = -10 - hash(p, 4) * 10; const px = STAGE / 2 + vx * g, py = H - 3 + vy * g + 26 * g * g; if (py < H - 2) cv.set(px, py, p % 3 ? C.steel : C.hulk) }
      }
      break
    }
    case 'hawkeye': {
      const k = calm ? 1 : (t % 1.4) / 1.4, tx = STAGE - 5, ty = H / 2
      cv.ring(tx, ty, 0, 4.6, (_a, d) => { const f = d / 4.6; return f > 0.78 ? C.capRed : f > 0.55 ? rgb('#EEF1F7') : f > 0.3 ? C.capRed : C.gold })
      // the arrow, drawn: fletching, shaft, a steel head; a purple trail
      const tip = Math.min(-2 + (tx + 1) * easeIn(Math.min(1, k * 1.5)), tx - 1), ay = ty - 1
      for (let i = 1; i < 9; i++) cv.glow(tip - 9 - i, ay, C.hawk, 0.55 * (1 - i / 9))
      cv.line(tip - 9, ay, tip - 1, ay, rgb('#C7A266'))
      cv.line(tip - 9, ay - 1, tip - 7.5, ay - 1, C.hawk); cv.line(tip - 9, ay + 1, tip - 7.5, ay + 1, C.hawk)
      cv.set(tip, ay, rgb('#E9EEF7')); cv.setSub(tip * 2 - 1, ay - 1, rgb('#A5AFC2')); cv.setSub(tip * 2 - 1, ay + 1, rgb('#A5AFC2'))
      if (k * 1.5 >= 1 && k * 1.5 < 1.25) cv.radial(tx, ty, 5, C.goldHi, 0.8)
      break
    }
    case 'spidey': {
      const s = B.spideyStage, th = calm ? 0 : Math.sin(t * 3.4) * 0.8, L = 7
      const ax = STAGE / 2, hx = ax + Math.sin(th) * L, hy = Math.cos(th) * L - 3
      cv.line(ax, 0, hx, hy + 1, rgb('#DDE3F0'))
      for (let i = -1; i <= 1; i++) cv.set(ax + i, 0, C.white)
      cv.hi(s, hx - s.w / 4, hy)
      break
    }
    case 'snap': { const s = tt('stones').at(tl / 4); cv.hi(s, center(s, 0, STAGE), 0); break }
    case 'strange': {
      // a sling-ring portal: sparks racing round a ring, a teammate stepping through
      const cx = STAGE / 2, cy = H / 2, open = calm ? 1 : easeOutBack(clamp01(t / 0.6)), R = 7 * open
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU + (calm ? 0 : t * 3.2), jit = calm ? 0 : (hash(i, Math.floor(t * 20)) - 0.5) * 0.9
        const r = R + jit
        cv.glow(cx + (Math.cos(a) * r) / 0.83, cy + Math.sin(a) * r, i % 3 ? rgb('#FF9A2E') : rgb('#FFE08A'), 0.95)
      }
      if (!calm) for (let i = 0; i < 14; i++) { const a = hash(i, 9) * TAU + t * 3.2, k = (t * 2 + hash(i, 4)) % 1, r = R + k * 4; cv.glow(cx + (Math.cos(a) * r) / 0.83, cy + Math.sin(a) * r, rgb('#FFB347'), 1 - k) }
      const team = [B.helmetIcon, B.spideyIcon, B.fistIcon, B.mjolnirIcon, B.shieldIcon0, B.widowIcon]
      const who = team[((Math.floor(t / 1.4) % team.length) + team.length) % team.length]!, k = calm ? 1 : clamp01(((t % 1.4) - 0.3) / 0.5)
      if (open > 0.8) cv.hi(who, center(who, 0, STAGE), cy - who.h / 2, { alpha: k })
      break
    }
    case 'witch': {
      // chaos magic: red hex energy coiling round her crown
      const cr = B.witchCrown
      for (let i = 0; i < 26; i++) {
        const ph = i / 26, a = ph * TAU * 2 + (calm ? 0 : t * 2.4), r = 3 + ph * 6
        const x = STAGE / 2 + (Math.cos(a) * r) / 0.83, y = H / 2 + 1 + Math.sin(a * 1.3) * r * 0.55
        cv.radial(x, y, 1.6, i % 2 ? rgb('#FF2E5C') : rgb('#C8123A'), 0.75 * (1 - ph * 0.5))
      }
      cv.hi(cr, center(cr, 0, STAGE), 1)
      break
    }
    case 'widow': {
      // the hourglass, and the Widow's Bites crackling blue either side
      const ic = B.widowIcon
      cv.hi(ic, center(ic, 0, STAGE), (H - ic.h) / 2)
      if (!calm) for (const side of [-1, 1]) {
        const x0 = STAGE / 2 + side * 6, seed = Math.floor(t * 14) + side
        let y = 2
        for (let i = 0; i < 12; i++) { const ny = y + 1, x = x0 + (hash(seed, i) - 0.5) * 2.4; cv.glow(x, ny, rgb('#7FD8FF'), 0.9); y = ny }
      }
      break
    }
    case 'ultron': {
      // the chrome head turning side to side, the eyes flaring red
      const s = B.ultronStage, ang = calm ? 0 : Math.sin(t * 1.6) * 0.5, sx = Math.cos(ang), fl = calm ? 0.3 : 0.5 + 0.5 * Math.sin(t * 5)
      const cx = STAGE / 2, cy = H - s.h / 2
      cv.drawRot(s, cx + Math.sin(ang) * 1.5, cy, 0, { sx: 0.8 + 0.2 * sx, sy: 1 })
      const ex = Math.sin(ang) * 3
      for (const d of [-1, 1]) cv.radial(cx + ex + d * 3.6 * sx, cy - s.h * 0.14, 2.2 + fl * 2, rgb('#FF2A2A'), 0.25 + 0.5 * fl)
      if (!calm) for (let i = 0; i < 6; i++) { const k = (t * 1.2 + hash(i, 2)) % 1; cv.glow(cx + (hash(i, 7) - 0.5) * 16, H - k * H, rgb('#FF5A4A'), 0.5 * (1 - k)) }
      break
    }
    case 'panther': {
      // a crouch, a pounce, a landing: kinetic purple pulses rolling out
      const s = B.pantherStage, per = 2.4, u = calm ? 0.55 : (t % per) / per, bot = H - 0.5
      let px = STAGE / 2, sy = 1, sx = 1, lift = 0
      if (u < 0.3) { const k = easeOut(u / 0.3); sy = 1 - 0.22 * k; sx = 1 + 0.12 * k } // crouch
      else if (u < 0.62) { const k = (u - 0.3) / 0.32; px += (k - 0.5) * 9; lift = Math.sin(k * Math.PI) * 5; sy = 1.08; sx = 0.94 } // pounce
      else { const k = clamp01((u - 0.62) / 0.2); px += 4.5; sy = 0.82 + 0.18 * easeOutBack(k); sx = 1.1 - 0.1 * k } // land
      if (!calm) {
        const pk = u < 0.62 ? 0 : (u - 0.62) / 0.38 // pulses from the landing spot
        if (pk > 0) for (let r = 0; r < 2; r++) { const f = clamp01(pk * 1.3 - r * 0.25); if (f > 0 && f < 1) for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, d = f * 9; cv.glow(STAGE / 2 + 4.5 + (Math.cos(a) * d) / 0.83, bot - 1 + Math.sin(a) * d * 0.45, i % 2 ? rgb('#B9A6FF') : rgb('#8E6CFF'), 1 - f) } }
        if (u < 0.3) for (let i = 0; i < 6; i++) { const a = hash(i, Math.floor(t * 12)) * TAU; cv.glow(px + Math.cos(a) * 4, bot - s.h * sy / 2 + Math.sin(a) * 4, rgb('#8E6CFF'), 0.5) } // gathering
      }
      cv.drawRot(s, px, bot - (s.h * sy) / 2 - lift, 0, { sx, sy })
      break
    }
    case 'vision': {
      // phasing in and out, the Mind Stone firing a beam that sweeps
      const s = B.visionStage, ph = calm ? 1 : 0.55 + 0.45 * Math.sin(t * 3.1) * Math.sin(t * 1.3 + 1), x = center(s, 0, STAGE), y = H - s.h
      cv.hi(s, x, y, { alpha: clamp01(ph) })
      if (!calm) {
        const sx0 = STAGE / 2, sy0 = y + s.h * 0.27, ang = Math.sin(t * 1.5) * 0.9
        for (let i = 2; i < 34; i++) { const d = i * 0.8; cv.glow(sx0 + (Math.cos(ang) * d) / 0.83, sy0 + Math.sin(ang) * d, i % 4 ? rgb('#FFE33A') : rgb('#FFFBD0'), 1 - i / 40) }
        cv.radial(sx0, sy0, 2.6, rgb('#FFE33A'), 0.55 + 0.3 * Math.sin(t * 9))
      }
      break
    }
    case 'loki': {
      // illusions: duplicates flicker into being and vanish, green sparks and a glowing sceptre gem
      const s = B.lokiStage, x = center(s, 0, STAGE), y = H - s.h
      if (!calm) for (const d of [-1, 1]) {
        const ph = ((t * 0.5 + (d > 0 ? 0.5 : 0)) % 1), a = ph < 0.15 ? ph / 0.15 : ph > 0.7 ? Math.max(0, 1 - (ph - 0.7) / 0.2) : 1
        if (a > 0) { const jit = hash(Math.floor(t * 16), d) > 0.85 ? 0.4 : 1; cv.hi(s, x + d * (2.5 + ph * 1.5), y, { alpha: 0.35 * a * jit, tint: rgb('#3FBF5A'), tintAmt: 0.45 }) }
      }
      cv.hi(s, x, y)
      const gx = x + s.w / 4 * 0.93 + 0.5, gy = y + s.h * 0.24
      cv.radial(gx, gy, 2.4, rgb('#4FC3FF'), calm ? 0.35 : 0.3 + 0.25 * Math.sin(t * 6))
      if (!calm) for (let i = 0; i < 12; i++) { const k = (t * 0.8 + hash(i, 3)) % 1, a = hash(i, 5) * TAU; cv.glow(STAGE / 2 + Math.cos(a) * (3 + k * 6) / 0.83, H / 2 + Math.sin(a) * (3 + k * 5), i % 2 ? rgb('#3FBF5A') : rgb('#A8EC70'), 1 - k) }
      break
    }
    case 'antman': {
      // Ant-Man: shrinking to nothing, then growing huge again
      const s = B.antman, k = calm ? 1 : 0.5 + 0.5 * Math.cos(t * 1.8), sc = 0.12 + k * 0.88
      cv.drawRot(s, STAGE / 2, H / 2, 0, { sx: sc, sy: sc })
      if (!calm && sc < 0.3) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t, r = 3 + (1 - sc) * 4; cv.glow(STAGE / 2 + Math.cos(a) * r / 0.83, H / 2 + Math.sin(a) * r, rgb('#B48AF0'), 0.7) }
      break
    }
    case 'deadpool': {
      // Deadpool and Wolverine, popping up from below, taking turns
      const turn = calm ? 0 : Math.floor(t / 2.2) % 2, u = calm ? 1 : (t % 2.2) / 2.2
      const s = turn ? B.wolverine : B.deadpool
      const up = u < 0.2 ? easeOutBack(u / 0.2) : u > 0.85 ? 1 - easeIn((u - 0.85) / 0.15) : 1
      cv.hi(s, center(s, 0, STAGE) + (turn ? 2 : -2), H - s.h * up)
      if (turn && up > 0.9 && !calm) for (const dx of [-3.5, -1.5, 0.5]) cv.line(STAGE / 2 + 6 + dx, H - 12, STAGE / 2 + 7 + dx, H - 5, rgb('#DDE3F0')) // snikt
      break
    }
    case 'assemble': { // the Clarvis emblem, a glint sweeping through it
      const s = B.logoStage
      cv.hi(s, center(s, 0, STAGE), 0)
      if (!calm) { const g = ((t * 22) % (s.w / 2 + 20)) - 5; for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) { const d = Math.abs(xx / 2 - g + yy * 0.6); if (d < 1.6 && s.a[yy * s.w + xx]! > 160) cv.glowSub(Math.round(center(s, 0, STAGE) * 2) + xx, yy, C.white, (1 - d / 1.6) * 0.6) } }
      break
    }
    case 'fury': { // Nick Fury, an amber alert strobing behind him
      const s = B.furyStage, on = calm || Math.floor(t * 2) % 2 === 0
      cv.radial(STAGE / 2, H / 2, 8, on ? C.amber : C.alarm, 0.18)
      cv.hi(s, center(s, 0, STAGE), 0)
      break
    }
    default: if (!guardianStage(cv, act, t, calm, STAGE, H)) globe(cv, STAGE / 2, H / 2, 7.2, tl * 0.6)
  }
}

export type LogEntry = { ok: boolean; tool: string; detail: string; ms: number }
export type WorkState = {
  who: Who; usage: Usage; calm: boolean
  act: Activity; actAt: number // what is on stage, since when (s)
  tool: string; detail: string // what is running now ('' while thinking)
  line: string; lineAt: number // JARVIS
  elapsed: string; tools: number; log: LogEntry[]
  lane?: boolean // the full-width action lane beneath (when there is room)
  cast?: Activity // who plays the stage, when not the one at work (the roster rotating)
  speaker?: string // who says the line (JARVIS when absent)
}
export function drawWorking(cv: Canvas, s: WorkState, t: number) {
  if (!Number.isFinite(t)) t = 0
  const since = Math.max(0, t - s.actAt) // time on stage, never negative
  const cast = s.cast ?? s.act
  card(cv, HERO[cast].color, s.calm ? 0 : t)
  stage(cv, cast, since, s.calm); fence(cv)
  const col = STAGE + 2, width = cv.w - col
  for (let r = 0; r < STAGE_ROWS; r++) cv.text(STAGE, r, r === 0 ? '╭' : r === STAGE_ROWS - 1 ? '╰' : '│', r === 0 || r === STAGE_ROWS - 1 ? C.arcDim : C.faint)
  // row 0: what the session is doing (the tool, never its command), a live
  // spinner, the clock at the right; the hero is named once, by their line
  const h = HERO[cast]
  const doing = s.tool ? `ON ${s.tool.toUpperCase()}` : s.act === 'responding' ? 'WRITING THE REPLY' : 'THINKING'
  const spin = s.calm ? '◆' : ('◐◓◑◒'[Math.floor(t * 6) % 4] ?? '◆')
  cv.text(col, 0, spin, h.color)
  cv.text(col + 2, 0, doing, C.text)
  const clock = `◷ ${s.elapsed}`
  cv.text(cv.w - len(clock) - 2, 0, clock, C.muted)
  // (the play button sits left of the clock: register.tsx draws it over the band)
  // rows 1–2: the hero's line under their own name, typed in, wrapped over two rows
  const by = `${s.speaker ?? 'JARVIS'} ▸`
  cv.text(col, 1, by, h.color)
  const room = width - len(by) - 3
  const [l1, l2] = wrap2(s.line, room)
  const n = s.calm ? 999 : Math.floor((t - s.lineAt) * 45)
  const a1 = [...l1], a2 = [...l2]
  cv.text(col + len(by) + 1, 1, a1.slice(0, n).join(''), C.text)
  if (n > a1.length) cv.text(col + len(by) + 1, 2, a2.slice(0, n - a1.length - 1).join(''), C.text)
  if (!s.calm && n < a1.length + a2.length + 8 && Math.floor(t * 4) % 2 === 0) {
    const onFirst = n <= a1.length
    cv.text(col + len(by) + 1 + (onFirst ? Math.min(n, a1.length) : Math.min(n - a1.length - 1, a2.length)), onFirst ? 1 : 2, '▌', C.arcHi)
  }
  // row 3: the mission log's head, the gauges beside it; rows 4–6: what runs
  // now (or that Claude is thinking), then the newest finished actions
  // (narrow: the head gives way so the spend still shows)
  const lh = `MISSION LOG · ${s.tools} action${s.tools === 1 ? '' : 's'}`
  const gx = width - Math.max(len(lh) + 3, 26) > 14 ? Math.max(len(lh) + 3, 26) : 0
  if (gx) cv.text(col, 3, lh, C.dim)
  gauges(cv, col + gx, 3, width - gx - 1, s.who, s.usage)
  let r = 4
  {
    const live = s.tool || (s.act === 'responding' ? 'reply' : 'thinking')
    const note = s.tool ? 'running' : s.act === 'responding' ? 'writing it up' : s.tools ? 'planning the next move' : 'reading the brief'
    cv.text(col, r, spin, h.color)
    cv.text(col + 2, r, clip(live, 9).padEnd(9), C.text) // WebSearch, TodoWrite, MultiEdit fit whole
    const dots = s.calm ? '…' : '·'.repeat(1 + ((Math.floor(t * 3) % 3) + 3) % 3)
    cv.text(col + 12, r, `${note} ${dots}`, h.color)
    r++
  }
  for (const e of s.log) {
    if (r > 6) break
    cv.text(col, r, e.ok ? '✓' : '✗', e.ok ? C.green : C.alarm)
    cv.text(col + 2, r, clip(e.tool, 9).padEnd(9), r === 5 ? C.text : C.muted)
    const ms = fmtMs(e.ms)
    cv.text(col + 12, r, clip(e.detail, width - 15 - len(ms)), r === 5 ? C.muted : C.dim)
    cv.text(cv.w - len(ms) - 2, r, ms, C.dim)
    r++
  }
  // a fresh turn, nothing done yet: the one tip worth knowing, not blank rows
  if (r === 5) cv.text(col, 5, clip('◇ waiting? ▶ STARK ARCADE: five games while the team works · /clarvis calm stills the band', width - 2), C.dim)
  // the lane: the same hero as the stage, crossing the band, named
  if (s.lane) { lane(cv, STAGE_ROWS * 2, cast, since, s.calm); fence(cv); const tag = `◢ ${HERO[cast].name}`; cv.text(cv.w - len(tag) - 2, STAGE_ROWS + LANE_ROWS - 1, tag, HERO[cast].color) }
}

// ── the lane: the hero of the moment crossing the whole width ───────────────
function lane(cv: Canvas, y0: number, act: Activity, t: number, calm: boolean) {
  const art = LANE_ART[act]
  if (art) { art(cv, y0, calm ? 1.2 : t, calm); return }
  const W = cv.w, H = LANE_ROWS * 2, mid = y0 + H / 2
  const tl = calm ? 1.2 : t
  const across = (secs: number, pad = 10) => -pad + ((tl % secs) / secs) * (W + pad * 2) // x crossing left to right
  switch (act) {
    case 'thinking': { // JARVIS scanning: a sine of light sweeping across
      const p = across(3.2, 0)
      for (let x = 0; x < W; x++) { const d = Math.abs(x - p), a = Math.max(0, 1 - d / 22); if (a > 0) cv.glowSub(x * 2, mid + Math.sin(x * 0.35 - tl * 6) * 2.2, C.arc, 0.25 + 0.75 * a) }
      cv.radial(p, mid, 3, C.arcHi, 0.8)
      break
    }
    case 'responding': { // JARVIS speaking: a voice across the whole band
      for (let x = 0; x < W; x++) { const v = (Math.sin(x * 0.5 + tl * 9) + Math.sin(x * 0.17 - tl * 4)) / 2, hh = Math.round((v * 0.5 + 0.5) * (H - 2)); for (let j = 0; j < hh; j++) cv.setSub(x * 2, mid + hh / 2 - j, lerp(C.arcDim, C.arc, j / H)) }
      break
    }
    case 'ironman': { // flying across on boot jets, firing ahead
      const s = tt('helmetLane').at(tl / 2), x = across(3.4, 14), hw = s.w / 4
      for (let i = 1; i < 18; i++) for (const dy of [-1, 0, 1]) cv.glow(x - hw - i, mid + dy * 0.8, i < 4 ? C.goldHi : i < 9 ? C.gold : C.redHi, (1 - i / 18) * (dy ? 0.45 : 0.95))
      cv.hi(s, x - hw, y0)
      if ((tl % 1.1) < 0.4) for (let i = 0; i < 26; i++) { cv.set(x + hw + 1 + i, mid, i < 25 ? C.arcHi : C.white); cv.glow(x + hw + 1 + i, mid - 1, C.arc, 0.6); cv.glow(x + hw + 1 + i, mid + 1, C.arc, 0.6) }
      break
    }
    case 'hulk': { // SMASH at the left, the crack racing out across the floor
      const k = (tl % 2.4) / 2.4, s = B.laneFist
      const fy = k < 0.12 ? y0 - s.h + (s.h + 1) * easeIn(k / 0.12) : y0 + 1
      cv.hi(s, 1, fy)
      const reach = Math.max(0, (k - 0.12) / 0.88) * W
      for (let x = 8; x < Math.min(W, 8 + reach); x++) cv.set(x, y0 + H - 1 - (hash(x) > 0.7 ? 1 : 0), lerp(C.goldHi, rgb('#4B5363'), Math.min(1, (8 + reach - x) / 30)))
      for (let p = 0; p < 6; p++) { const px = 8 + reach - hash(p) * 10; cv.set(px, y0 + H - 3 - hash(p, Math.floor(tl * 8)) * 3, C.steel) }
      break
    }
    case 'deadpool': { // Deadpool and Wolverine racing across
      const x = across(4, 16), bob = Math.abs(Math.sin(tl * 9)) * 1.5
      cv.hi(B.laneDeadpool, x, y0 + 1 - bob)
      cv.hi(B.laneWolverine, x - 10, y0 + 1 - Math.abs(Math.sin(tl * 9 + 1)) * 1.5)
      break
    }
    case 'cap': { // the shield ricocheting across, top to bottom of the lane
      const s = B.shieldIcon0, x = across(2.8, 8), ph = (tl * 2.2) % 2, y = y0 + (ph < 1 ? ph : 2 - ph) * Math.max(0, H - s.h)
      for (let i = 1; i < 6; i++) cv.radial(x + s.w / 4 - i * 2.5, y + s.h / 2, 2.5, C.cap, 0.25 * (1 - i / 6))
      cv.hi(s, x, y)
      break
    }
    case 'thor': { // Mjölnir flying across, lightning raining down behind it
      const s = B.laneHammer, x = across(2.6, 8)
      cv.drawRot(s, x, mid, tl * 14)
      const seed = Math.floor(tl * 12)
      for (let b = 0; b < 3; b++) { const bx = x - 8 - b * 9 - hash(seed, b) * 4; if (bx > 0 && (seed + b) % 2) { let yy = y0, xx = bx; while (yy < y0 + H - 1) { const nx = xx + (hash(seed, yy * 3 + b) - 0.5) * 2; cv.line(xx, yy, nx, yy + 1, C.white); cv.glow(nx + 1, yy + 1, C.boltDeep, 0.4); xx = nx; yy++ } } }
      break
    }
    case 'widow': { // Black Widow zipping across, her Bites sparking
      const x = across(2.4, 8)
      cv.hi(B.laneWidow, x, y0 + 1)
      for (let i = 0; i < 12; i++) cv.glow(x - 2 - i * 1.5, y0 + 1 + hash(i, Math.floor(tl * 15)) * (H - 2), rgb('#7FD8FF'), 1 - i / 12)
      break
    }
    case 'hawkeye': { // an arrow across the whole band into the bullseye at the end
      const k = (tl % 1.8) / 1.8, tx = W - 4, x = -4 + Math.min(1, k * 1.3) * (tx - 2)
      cv.ring(tx, mid, 0, 3.6, (_a, d) => (d > 2.7 ? C.capRed : d > 1.8 ? rgb('#EEF1F7') : d > 0.9 ? C.capRed : C.gold))
      for (let i = 1; i < 20; i++) cv.glow(x - 8 - i, mid, C.hawk, 0.6 * (1 - i / 20))
      cv.line(x - 8, mid, x - 1, mid, rgb('#C7A266')); cv.set(x, mid, rgb('#E9EEF7')); cv.line(x - 8, mid - 1, x - 7, mid - 1, C.hawk); cv.line(x - 8, mid + 1, x - 7, mid + 1, C.hawk)
      if (k * 1.3 >= 1 && k * 1.3 < 1.2) cv.radial(tx, mid, 5, C.goldHi, 0.9)
      break
    }
    case 'spidey': { // swinging across web to web, anchored above the lane
      const s = B.spideyIcon, per = 0.55, L = 6, A = 1.0, D = 2 * L * Math.sin(A)
      const n = Math.floor(tl / per), u = (tl % per) / per, ax = (-6 + n * D + L * Math.sin(A)) % (W + 12)
      const th = -A * Math.cos(Math.PI * u), hx = ax + (L * Math.sin(th)) / 0.83, hy = y0 - 6 + L * Math.cos(th)
      cv.line(ax, y0 - 6, hx, hy, rgb('#DDE3F0'))
      cv.hi(s, hx - s.w / 4, Math.min(hy, y0 + H - s.h))
      break
    }
    case 'witch': { // a wave of chaos magic rolling across
      const p = across(3, 6)
      for (let x = 0; x < W; x++) { const d = x - p; if (d > 0 || d < -40) continue; const a = 1 + d / 40; cv.glowSub(x * 2, mid + Math.sin(x * 0.45 + tl * 7) * 2.5 * a, rgb('#FF2E5C'), a); cv.glowSub(x * 2 + 1, mid + Math.cos(x * 0.3 - tl * 5) * 2 * a, rgb('#C8123A'), a * 0.7) }
      break
    }
    case 'strange': { // a portal crossing the band, sparks streaming off it
      const x = across(3.6, 8)
      for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU + tl * 4; cv.glow(x + (Math.cos(a) * 3.2) / 0.83, mid + Math.sin(a) * 3.2, i % 3 ? rgb('#FF9A2E') : rgb('#FFE08A'), 1) }
      for (let i = 0; i < 14; i++) cv.glow(x - 5 - hash(i) * 20, mid + (hash(i, 2) - 0.5) * 6, rgb('#FFB347'), 1 - hash(i))
      break
    }
    case 'ultron': { // a drone swarm crossing, red eyes blinking in unison
      const x = across(3, 10), s = B.laneUltron, blink = Math.sin(tl * 7) > -0.6
      cv.hi(s, x, y0 + 1)
      if (blink) for (const d of [-1, 1]) cv.radial(x + s.w / 4 + d * 1.5, y0 + 1 + s.h * 0.45, 1.6, rgb('#FF2A2A'), 0.8)
      for (let i = 0; i < 16; i++) {
        const dx = -3 - hash(i, 1) * 26, dy = hash(i, 2) * (H - 1) + Math.sin(tl * 6 + i) * 0.6, dxp = x + dx
        cv.set(dxp, y0 + dy, rgb('#9AA3B4')); cv.glow(dxp - 0.5, y0 + dy, rgb('#FF2A2A'), (Math.sin(tl * 7 + i * 1.7) > -0.4 ? 0.9 : 0.15))
      }
      break
    }
    case 'panther': { // pouncing across in long leaps, purple pulses rippling the lane
      const x = across(2.8, 8), ph = (tl * 2.4) % 1, hop = Math.sin(ph * Math.PI) * (H - 3)
      const s = B.lanePanther
      cv.hi(s, x, y0 + H - s.h - hop)
      for (let i = 1; i < 10; i++) cv.glow(x - i * 1.8, y0 + H - s.h / 2 - hop * (1 - i / 12), i % 2 ? rgb('#B9A6FF') : rgb('#8E6CFF'), 1 - i / 10)
      for (let r = 0; r < 3; r++) { const px = x - 3 - ((tl * 14 + r * 9) % 27); for (let j = 0; j < H; j++) cv.glow(px + Math.sin(j * 0.9 + tl * 10) * 0.6, y0 + j, rgb('#8E6CFF'), 0.35 + 0.3 * (1 - ((x - px) / 30))) }
      break
    }
    case 'vision': { // phasing through the lane, a Mind Stone beam sweeping up and down ahead of him
      const x = across(3.2, 8), s = B.laneVision, ph = 0.5 + 0.5 * Math.sin(tl * 7) * Math.sin(tl * 2.3 + 1)
      cv.hi(s, x, y0 + 1, { alpha: clamp01(0.35 + ph) })
      const bx = x + s.w / 4 * 0.9, by = y0 + 1 + s.h * 0.27, ang = Math.sin(tl * 3.4) * 0.45
      for (let i = 1; i < 34; i++) cv.glow(bx + i * 0.9 * Math.cos(ang) / 0.83 * 0.83 + i * 0.1, by + Math.sin(ang) * i * 0.9, i % 5 ? rgb('#FFE33A') : rgb('#FFFBD0'), 0.9 - i / 40)
      cv.radial(bx, by, 2, rgb('#FFE33A'), 0.8)
      break
    }
    case 'loki': { // illusions of him blinking in and out ahead, sceptre glowing, green sparks
      const x = across(3.4, 10), s = B.laneLoki
      for (let d = 1; d <= 2; d++) { const ph = (tl * 1.6 + d * 0.37) % 1; if (ph < 0.6) cv.hi(s, x + d * 11 * (d % 2 ? 1 : -0.6) + 6, y0 + 1, { alpha: 0.55 * Math.sin((ph / 0.6) * Math.PI), tint: rgb('#3FBF5A'), tintAmt: 0.4 }) }
      cv.hi(s, x, y0 + 1)
      cv.radial(x + s.w / 4 + 0.5, y0 + 1 + s.h * 0.24, 2, rgb('#4FC3FF'), 0.5 + 0.3 * Math.sin(tl * 9))
      for (let i = 0; i < 14; i++) cv.glow(x - 1 - i * 1.3, y0 + hash(i, Math.floor(tl * 12)) * (H - 1), i % 2 ? rgb('#3FBF5A') : rgb('#A8EC70'), 1 - i / 14)
      break
    }
    case 'antman': { // Ant-Man crossing, shrinking and growing as he goes
      const s = B.laneAntman, x = across(4.2, 8), sc = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos(tl * 3))
      cv.drawRot(s, x, mid, 0, { sx: sc, sy: sc })
      break
    }
    case 'assemble': { // CLAUVENGERS, ASSEMBLE! crossing the band, a glint running through it
      const s = B.wordLane, x = across(5, s.w / 2 + 4) - s.w / 4
      cv.hi(s, x, y0)
      const g = ((tl * 50) % (s.w / 2 + 30)) - 10
      for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) { const d = Math.abs(xx / 2 - g + yy * 0.6); if (d < 2 && s.a[yy * s.w + xx]! > 160) cv.glowSub(Math.round(x * 2) + xx, y0 + yy, C.white, (1 - d / 2) * 0.55) }
      break
    }
    case 'fury': { // S.H.I.E.L.D. hazard chevrons marching the width
      const on = calm || Math.floor(tl * 2) % 2 === 0, edge = on ? C.amber : C.alarm
      for (let x = 0; x < W; x++) { const m = ((x + Math.floor(tl * 10)) % 6) < 3; cv.set(x, y0 + 1, m ? edge : scale(edge, 0.3)); cv.set(x, y0 + H - 2, m ? scale(edge, 0.3) : edge) }
      cv.text(Math.floor(W / 2) - 16, Math.floor((y0 + H / 2) / 2), '◤ S.H.I.E.L.D. ▸ PRIORITY ALERT ◥', edge)
      break
    }
    case 'snap': { // dust drifting across
      for (let i = 0; i < 60; i++) { const x = (hash(i) * W + tl * (6 + hash(i, 3) * 10)) % W, y = y0 + 1 + ((hash(i, 2) * (H - 2) - tl * 1.5) % (H - 2) + (H - 2)) % (H - 2); cv.glow(x, y, i % 2 ? C.thanos : rgb('#B49A7A'), 0.7) }
      break
    }
    default: { // JARVIS at work: data packets streaming across the rail
      if (guardianLane(cv, y0, H, W, act, t, calm)) break
      for (let i = 0; i < 8; i++) { const x = ((tl * 30 + i * (W / 8)) % (W + 6)) - 3; cv.rect(x, mid, 2, 1, i % 3 ? C.arc : C.gold); cv.glow(x - 2, mid, C.arcDim, 0.6) }
    }
  }
}

// ── the moments ─────────────────────────────────────────────────────────────
export type Moment = 'boot' | 'assemble' | 'snap' | 'fury'
export const MOMENT_ROWS: Record<Moment, number> = { boot: STAGE_ROWS, assemble: 10, snap: 11, fury: 6 }
export const MOMENT_SECONDS: Record<Moment, number> = { boot: 2.6, assemble: 4.4, snap: 3.6, fury: Infinity }
export type MomentArgs = { who: Who; usage: Usage; detail: string; caption: string }

// Session start: the helmet's systems come up, JARVIS runs the checks.
function boot(cv: Canvas, t: number, a: MomentArgs) {
  card(cv, C.arc, t)
  const s = tt('helmet').at(0.25 + t / 10)
  const on = clamp01((t - 0.2) / 1.2)
  cv.hi(s, center(s, 0, STAGE), 0, { tint: 0x0b0b12, tintAmt: 1 - on * (Math.floor(t * 18) % 5 ? 1 : 0.7) })
  const col = STAGE + 2
  const lines = ['STARK INDUSTRIES ▸ C.L.A.R.V.I.S. online', `suit ............ ${MARK[a.who.model] ?? 'MK-?'} · ${a.who.model.toUpperCase()}`, `pilot ........... ${a.who.name}`, `context ......... ${Math.round(a.usage.percent)}% used`, 'repulsors ....... calibrated', 'flight systems .. nominal']
  lines.forEach((l, i) => { const at = 0.1 + i * 0.3; if (t > at) typed(cv, col, i, clip(l, cv.w - col - 1), t - at, i === 0 ? C.gold : C.muted, 80, false) })
  if (t > 2.0) cv.text(col, 6, clip(`◢ CLARVIS: "${a.caption || 'Welcome home, sir.'}"`, cv.w - col - 1), C.green)
}

// The Clarvis emblem (a gold C around a reactor core): where its pixels end up, read once from the baked logo.
let LOGO_PX: { x: number; y: number; c: number }[] | undefined
function logoPx() {
  if (LOGO_PX) return LOGO_PX
  const s = B.logo, out: { x: number; y: number; c: number }[] = []
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const i = y * s.w + x; if (s.a[i]! > 140) out.push({ x, y, c: s.px[i]! }) }
  return (LOGO_PX = out)
}
// Done: the A gathers from sparks, CLAUVENGERS, ASSEMBLE! lands with a glint, the
// team's icons fly in, the mission's numbers settle beside them.
function assemble(cv: Canvas, t: number, a: MomentArgs) {
  card(cv, C.gold, t)
  const end = MOMENT_SECONDS.assemble
  const fade = t > end - 0.4 ? clamp01((end - t) / 0.4) : 1
  const lx = 1, H = cv.h
  // the A gathers: every pixel streaks in from a ring around it, a short
  // glowing trail behind, and lands within half a second
  logoPx().forEach((p, i) => {
    const start = hash(i, 1) * 0.18, k = clamp01((t - start) / 0.4)
    const ang = hash(i, 2) * TAU, far = 6 + hash(i, 3) * 10, e = easeOut(k)
    const at = (q: number): [number, number] => [lx * 2 + p.x + Math.cos(ang) * far * 2 * (1 - q), p.y + Math.sin(ang) * far * 0.6 * (1 - q)]
    const [xs, y] = at(e)
    if (k < 1) {
      for (let j = 1; j <= 3; j++) { const [tx, ty] = at(Math.max(0, e - j * 0.08)); cv.glowSub(tx, ty, C.gold, 0.5 * (1 - j / 4)) }
      cv.setSub(xs, y, lerp(C.white, p.c, k))
    } else if (fade < 1) cv.blendSub(xs, y, p.c, fade); else cv.setSub(xs, y, p.c)
  })
  if (t > 0.45 && t < 0.9) cv.radial(lx + B.logo.w / 4, H / 2, 12, C.goldHi, (1 - (t - 0.45) / 0.45) * 0.6)
  const wx = lx + B.logo.w / 2 + 3
  const line = B.wordAssembleLine
  const wide = wx + line.w / 2 + 2 < cv.w
  const reveal = (s: HiSprite, x: number, y: number, at: number) => {
    if (t < at) return
    const k = easeOut((t - at) / 0.5)
    cv.hi(s, x, y + (1 - k) * 2, { alpha: k * fade })
    const g = ((t - at - 0.4) * 60) % (s.w / 2 + 40) - 10
    if (t > at + 0.4) for (let yy = 0; yy < s.h; yy++) for (let xx = 0; xx < s.w; xx++) {
      const d = Math.abs(xx / 2 - g + yy * 0.6)
      if (d < 2 && s.a[yy * s.w + xx]! > 160) cv.glowSub(Math.round(x * 2) + xx, Math.round(y) + yy, C.white, (1 - d / 2) * 0.55 * fade)
    }
  }
  let textCol: number
  if (wide) {
    reveal(line, wx, 0, 0.35); textCol = wx + line.w / 2 + 3
    const icons = [B.helmetIcon, B.shieldIcon0, B.mjolnirIcon, B.fistIcon, B.spideyIcon, B.widowIcon]
    icons.forEach((s, i) => {
      const at = 0.6 + i * 0.1
      if (t < at) return
      const k = easeOutBack(clamp01((t - at) / 0.45)), fx = wx + i * 11, from = i % 2 ? cv.w + 10 : -20
      cv.hi(s, from + (fx - from) * k, 11, { alpha: fade })
    })
  } else { reveal(B.wordAssemble, wx, 0, 0.35); textCol = -1 } // narrow: the word, the numbers under it
  // the numbers: beside the wordmark, else after the team's icons, else under the word
  const lines = [a.detail, a.caption].filter(Boolean)
  const need = Math.max(0, ...lines.map(len)) + 1
  const [tc, tr] = wide && textCol + need < cv.w ? [Math.round(textCol), 1]
    : wide ? [Math.round(wx + 6 * 11 + 2), 6]
    : [Math.round(wx + 1), 6]
  if (tc + 12 < cv.w) lines.forEach((l, i) => { if (t > 1.0 + i * 0.4) typed(cv, tc, tr + i * 2, clip(l, cv.w - tc - 1), t - 1.0 - i * 0.4, i === 0 ? C.text : C.gold, 60, false) })
}

// Error: the stones light one by one, a snap, the error turns to dust.
function snap(cv: Canvas, t: number, a: MomentArgs) {
  card(cv, C.thanos, t)
  const g = B.gauntlet, gx = 1, H = cv.h
  const sn = 1.5
  const jolt = t > sn && t < sn + 0.2 ? (Math.floor(t * 50) % 2 ? 1 : -1) : 0
  cv.hi(g, gx + jolt, 0)
  const sx = g.w / B.GAUNTLET_VB[0], sy = g.h / B.GAUNTLET_VB[1]
  const gems = ['#3B82F6', '#FACC15', '#EF4444', '#A855F7', '#22C55E', '#F97316'].map(rgb)
  B.GAUNTLET_STONES.forEach(([vx, vy], i) => {
    const lit = clamp01((t - 0.15 - i * 0.18) / 0.15)
    if (lit <= 0) return
    const x = gx + jolt + (vx * sx) / 2, y = vy * sy
    cv.radial(x, y, 3.2 + Math.sin(t * 9 + i) * 0.5, gems[i]!, 0.85 * lit)
    cv.set(x - 0.5, y - 0.5, lerp(gems[i]!, C.white, 0.5 * lit))
  })
  if (t > sn && t < sn + 0.1) for (let y = 0; y < H; y++) for (let x = 0; x < 40; x++) cv.glow(x, y, C.white, 0.6)
  const col = gx + g.w / 2 + 3
  cv.text(col, 0, 'THANOS ▸', C.thanos)
  const done = a.detail === '✓' // a finished task: the snap dusts the troubles, not an error
  if (t > 0.3) typed(cv, col + 9, 0, done ? 'the work is done' : 'a tool snapped', t - 0.3, C.text, 40, false)
  if (t > sn + 0.1) cv.text(col, 2, '*snap*', C.thanos)
  if (t > sn + 0.4) typed(cv, col + 7, 2, '"I am inevitable."', t - sn - 0.4, C.muted, 30, false)
  const msg = [...clip(done ? 'bugs · flaky tests · stray TODOs · merge conflicts' : a.detail || 'The turn hit an error.', cv.w - col - 2)], row = 4
  msg.forEach((ch, i) => {
    const goneAt = sn + 0.2 + hash(i, 3) * 1.1 + (i / msg.length) * 0.4
    if (t < goneAt) { if (ch !== ' ') cv.text(col + i, row, ch, C.text); return }
    const k = t - goneAt
    for (let p = 0; p < 3; p++) {
      const dx = col + i + k * (8 + hash(i, p) * 20), dy = row * 2 + 1 - k * (3 + hash(p, i) * 8) + Math.sin(k * 6 + p)
      if (k < 1.3) cv.glow(dx, dy, lerp(p % 2 ? rgb('#B49A7A') : C.thanos, rgb('#2A2440'), k / 1.3), 1 - k / 1.3)
    }
  })
  if (t > 2.6) cv.text(col, 7, '◢ THANOS: "Dread it. Run from it. Destiny arrives all the same."', C.thanos)
  if (a.caption) cv.text(col, 9, clip(a.caption, cv.w - col - 1), C.dim)
}

// Needs you: Nick Fury, in a S.H.I.E.L.D. alert frame, on what's waiting.
export function fury(cv: Canvas, t: number, a: MomentArgs, calm = false) {
  const on = calm || Math.floor(t * 2) % 2 === 0
  const edge = on ? C.amber : C.alarm, H = cv.h
  card(cv, edge, calm ? 0 : t)
  for (let y = 0; y < H; y++) { cv.set(0, y, edge); cv.set(cv.w - 1, y, edge) }
  for (let x = 16; x < cv.w - 1; x++) { const m = ((x + Math.floor(calm ? 0 : t * 10)) % 6) < 3; cv.set(x, H - 1, m ? edge : scale(edge, 0.3)) }
  cv.hi(B.fury, 2, 0)
  const col = 17
  cv.text(col, 0, '◤ S.H.I.E.L.D. ▸ PRIORITY ALERT', edge)
  cv.text(col, 1, 'NICK FURY ▸', C.amber)
  cv.text(col + 12, 1, clip(a.caption || '"I need your sign-off on this one, Agent."', cv.w - col - 14), C.text)
  cv.text(col, 3, 'THE QUESTION ▸', C.muted)
  cv.text(col + 15, 3, clip(a.detail, cv.w - col - 17), C.text)
  cv.text(col, 4, on ? '● the team is holding for your reply' : '○ the team is holding for your reply', on ? C.amber : C.muted)
}

export const MOMENTS: Record<Moment, (cv: Canvas, t: number, a: MomentArgs) => void> = { boot, assemble, snap, fury: (cv, t, a) => fury(cv, t, a) }
