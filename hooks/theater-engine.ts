// clarvis AVENGERS THEATER: the pane's engine (no host calls; the Client
// in theater.tsx drives it). Two screens:
//   list   the 10 movies, one a row, ✓ on the watched ones;
//          1–0 / arrows / SPACE / click to pick and watch
//   watch  a movie as a comic page: 1–2 tiers of 1–3 panels, each beat a
//          panel sliding in, frozen panels kept, a page turn when it fills;
//          ← → skip beats, P pause, Q back to the list
// Frames are drawn into one Canvas (quadrant cells) and handed out as rows
// of Text runs, coarsened when a busy frame nears the tree bound.
import { Canvas, DEFAULT, Surface, clamp01, easeInOut, easeOut, lerp, rgb } from './pixel'
import { MOVIES } from './movies'
import { beatAt, plan as planOf, type PBeat, type Plan } from './saga-plan'
import { BACK, CHARS, INK, PAPER, WHITE, YEL, caption, coverArtOnly, setFlat, setQuant, coverColor, drawPanel, impactOf, keyTime, nameOf, outerClip, type Rect } from './saga'
import { BURST_S, burstFor, drawBurst, type BurstKind } from './burst'
import type { CharId } from './saga-types'

export const FPS = 12
export const BURST_GAP_S = 20 // at most one screen burst this often
const HEAD = rgb('#14141F'), DIM = rgb('#A4A8C8'), TXT = rgb('#E6E6F5'), GOLD = rgb('#F5C542'), GREEN = rgb('#7EE787')
const LIST_BG = rgb('#12121C'), ROW_A = rgb('#1A1A28'), ROW_B = rgb('#20202F'), PLATE = rgb('#101018'), WHITE_T = 0xffffff, GREEN_T = GREEN
// Cuts at a word (never mid-word), with … when anything was left out.
export function clipWords(s: string, w: number): string {
  if (s.length <= w) return s
  const cut = s.lastIndexOf(' ', w - 1)
  return (cut > w * 0.4 ? s.slice(0, cut) : s.slice(0, w - 1)).replace(/[ ,.;:]+$/, '') + '…'
}
function wrapWords(s: string, w: number, max: number): string[] {
  const out: string[] = []
  let rest = s
  while (rest && out.length < max) {
    if (rest.length <= w) { out.push(rest); rest = ''; break }
    if (out.length === max - 1) { out.push(clipWords(rest, w)); rest = ''; break }
    let cut = rest.lastIndexOf(' ', w)
    if (cut < w * 0.4) cut = w
    out.push(rest.slice(0, cut)); rest = rest.slice(cut).trimStart()
  }
  return out
}

export type Slot = Rect & { page: number }
export type TextSpec = { props: Record<string, string | boolean>; kids: (string | { props: Record<string, string | boolean>; s: string })[] }

// Lays a plan out as comic pages: tiers of panels, wide beats a tier alone, an ensemble
// (crowd, charge) a whole page alone; a page that ends early stretches its tiers to fill.
export function layout(p: Plan, cols: number, rows: number): Slot[] {
  const sub = rows >= 20 ? 2 : 1 // the bottom letterbox bar carries the subtitles
  return p.beats.map((_, i) => ({ page: i, x0: 0, x1: cols, y0: 2, y1: (rows - sub) * 2 }))
}
// What the bottom bar says during a beat: SPEAKER: line, or the narration.
export function subtitleOf(b: PBeat): string {
  if (!b.text || b.k === 'card' || b.k === 'cover' || b.k === 'credits') return ''
  const who = b.by === 'l' ? b.l : b.by === 'r' ? b.r : b.by
  return b.k === 'est' || !who ? b.text : `${nameOf(who)}: ${b.text}`
}

// A huge pane draws a 180 × 50 picture (the tree bound can't carry more detail; the rest is margin).
const clampCols = (c: number) => Math.max(40, Math.min(180, Math.floor(c) || 40))
const clampRows = (r: number) => Math.max(10, Math.min(50, Math.floor(r) || 10))
type Hit = { x0: number; x1: number; y0: number; y1: number; i: number }
export class Theater {
  cols: number; rows: number
  sf: Surface
  mode: 'list' | 'watch' = 'list'
  sel = 0
  seen = new Set<string>()
  fx = true
  seed: number
  views = 0
  plan: Plan | undefined
  slots: Slot[] = []
  tm = 0 // movie time, s
  paused = false
  time = 0 // the engine's own clock, s
  frame = 0
  hits: Hit[] = []
  outbox: unknown[] = []
  burst: { kind: BurstKind; at: number } | undefined
  lastBurst = -1e9
  bursts = 0
  ended = false
  constructor(cols: number, rows: number, seed: number) {
    this.cols = clampCols(cols); this.rows = clampRows(rows); this.seed = seed >>> 0
    this.sf = new Surface(this.cols, this.rows)
  }
  resize(cols: number, rows: number) {
    cols = clampCols(cols); rows = clampRows(rows)
    if (cols === this.cols && rows === this.rows) return
    this.cols = cols; this.rows = rows
    this.sf = new Surface(cols, rows)
    if (this.plan) this.slots = layout(this.plan, cols, rows)
  }
  get playing() { return this.mode === 'watch' && !this.paused && !this.ended }
  watch(i: number) {
    const m = MOVIES[i]
    if (!m) return
    this.sel = i; this.mode = 'watch'; this.views++
    this.plan = planOf(m, (this.seed + this.views * 0x9e3779b9) >>> 0)
    this.slots = layout(this.plan, this.cols, this.rows)
    this.tm = 0; this.paused = false; this.ended = false; this.burst = undefined
  }
  toList() { this.mode = 'list'; this.plan = undefined; this.slots = []; this.burst = undefined }
  private skip(dir: number) {
    const p = this.plan
    if (!p) return
    const i = beatAt(p, this.tm), j = Math.max(0, Math.min(p.beats.length - 1, i + dir))
    this.tm = p.beats[j]!.start + 0.001; this.burst = undefined
  }
  key(k: string) {
    const K = k.toLowerCase()
    if (this.mode === 'list') {
      if (/^[0-9]$/.test(K)) { this.watch(K === '0' ? 9 : Number(K) - 1); return }
      if (K === 'up' || K === 'left') this.sel = (this.sel + MOVIES.length - 1) % MOVIES.length
      else if (K === 'down' || K === 'right' || K === 'tab') this.sel = (this.sel + 1) % MOVIES.length
      else if (K === ' ' || K === 'space' || K === 'return' || K === 'enter') this.watch(this.sel)
      else if (K === 'q' || K === 'escape') this.outbox.push({ close: true })
      return
    }
    if (K === 'q' || K === 'escape' || K === 'backspace') this.toList()
    else if (K === 'p' || K === ' ' || K === 'space') { if (this.ended) this.toList(); else this.paused = !this.paused }
    else if (K === 'right') this.skip(1)
    else if (K === 'left') this.skip(-1)
  }
  pointer(type: string, x: number, y: number) {
    x = Math.floor(x); y = Math.floor(y)
    if (this.mode !== 'list') { if (type === 'down') this.key('p'); return }
    const h = this.hits.find(h => x >= h.x0 && x < h.x1 && y >= h.y0 && y < h.y1)
    if (!h) return
    if (type === 'down') this.watch(h.i)
    else if (type === 'move') this.sel = h.i
  }
  tick(dt = 1 / FPS) {
    this.time += dt; this.frame++
    if (!this.playing || !this.plan) return
    const p = this.plan, prev = this.tm
    this.tm += dt
    // a screen burst on the beat's big hit, at most one per BURST_GAP_S
    const i = beatAt(p, this.tm), b = p.beats[i]!, imp = impactOf(b)
    if (this.fx && imp >= 0 && prev - b.start < imp && this.tm - b.start >= imp && this.time - this.lastBurst >= BURST_GAP_S) {
      const by = b.k === 'ko' ? b.win : b.by, who = (by === 'l' ? b.l : by === 'r' ? b.r : by) as string
      const kind = burstFor(who || 'JARVIS', b.fx || undefined)
      this.burst = { kind, at: this.time }; this.lastBurst = this.time; this.bursts++
      this.outbox.push({ fx: kind })
    }
    if (this.burst && this.time - this.burst.at > BURST_S) this.burst = undefined
    if (this.tm >= p.len) { this.tm = p.len - 0.001; this.ended = true; this.seen.add(p.movie.id); this.outbox.push({ watched: p.movie.id }) }
  }

  // ── drawing ───────────────────────────────────────────────────────────────
  private drawnQ = -1
  draw() { this.draw0(Math.max(0, this.level - 1)) }
  private flat = 0
  private flatAll = 0
  private draw0(lv: number) {
    const q = LEVELS[lv]!.q
    setQuant(q); this.drawnQ = lv; this.flat = LEVELS[lv]!.flat; this.flatAll = LEVELS[lv]!.all ?? 0
    const cv = this.sf.cv
    cv.clear(); cv.panel = HEAD; this.live = undefined
    if (this.mode === 'list') this.drawList(cv)
    else this.drawWatch(cv)
  }
  private header(cv: Canvas, left: string, right: string, color = GOLD) {
    cv.text(1, 0, left.slice(0, this.cols - right.length - 3), color, HEAD)
    cv.text(this.cols - right.length - 1, 0, right, DIM, HEAD)
  }
  // The list. Words always sit on solid plates (contrast ≥ 4.5:1). A short or narrow pane
  // gets a clean menu, one movie a row, the selected one a solid bar, and (when there is
  // room) the selected movie's cover beside it; a big pane gets covers with title plates.
  private drawList(cv: Canvas) {
    const C = this.cols, R = this.rows
    this.header(cv, '◢ AVENGERS THEATER · 10 movies', C >= 96 ? '1–0 pick · ↑↓ · SPACE watch · click · Q close' : C >= 64 ? '1–0 · ↑↓ · SPACE · Q' : 'SPACE · Q')
    for (let y = 2; y < R * 2; y++) for (let xs = 0; xs < C * 2; xs++) cv.setSub(xs, y, LIST_BG)
    this.hits = []
    this.drawMenu(cv) // a clean menu at every size: one frame on screen, never a grid of covers
  }
  private drawMenu(cv: Canvas) {
    const C = this.cols, R = this.rows
    const listW = C // (no inset: the screen is one frame)
    const two = R - 2 >= MOVIES.length * 2 // room for a tagline row under each title
    const step = two ? 2 : 1, top = Math.max(1, Math.min(2, R - 1 - MOVIES.length * step))
    MOVIES.forEach((m, i) => {
      const row = top + i * step
      if (row + step > R) return
      const on = i === this.sel, seen = this.seen.has(m.id)
      const bg = on ? YEL : i % 2 ? ROW_A : ROW_B, fg = on ? INK : TXT, sub = on ? INK : DIM
      const mins = `${Math.round(planOf(m, 1).len / 60)} min`, tick = seen ? ' ✓' : '  '
      const right = `${mins}${tick} `, num = ` ${(i + 1) % 10} `
      const title = m.title.toUpperCase(), room = listW - num.length - right.length - 4
      const tagRoom = two ? listW - 8 : room - title.length - 3
      const tag = tagRoom > 8 ? clipWords(m.blurb, tagRoom) : ''
      for (let r2 = 0; r2 < step; r2++) cv.text(2, row + r2, ' '.repeat(listW - 3), fg, bg)
      for (let r2 = 0; r2 < step; r2++) for (let y = (row + r2) * 2; y < (row + r2) * 2 + 2; y++) { cv.setSub(2, y, coverColor(m)); cv.setSub(3, y, coverColor(m)) } // the issue's colour
      cv.text(2, row, `${on ? '▶' : ' '}${num}`, on ? INK : GOLD, bg)
      cv.text(2 + num.length + 1, row, clipWords(title, room), on ? INK : WHITE_T, bg)
      if (!two && tag) cv.text(2 + num.length + 1 + title.length + 2, row, tag, sub, bg)
      if (two && tag) cv.text(2 + num.length + 1, row + 1, tag, sub, bg)
      cv.text(listW - right.length - 1, row, right, on ? INK : seen ? GREEN_T : DIM, bg)
      this.hits.push({ x0: 1, x1: listW - 1, y0: row, y1: row + step, i })
    })
  }
  // A film: one full-bleed shot between letterbox bars, the line as a subtitle on the
  // bottom bar, a dip to black between scenes. Hard cuts between beats.
  private drawWatch(cv: Canvas) {
    const p = this.plan!, C = this.cols, R = this.rows, t = this.time
    const i = beatAt(p, this.tm), b = p.beats[i]!, u = this.tm - b.start, s = this.slots[i]!
    const m = p.movie
    this.live = s
    const fmt = (x: number) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`
    this.header(cv, `THE AVENGERS SAGA #${m.n} · ${m.title}`, `${this.paused ? '❚❚ PAUSED · ' : this.ended ? '✓ THE END · ' : ''}${fmt(this.tm)} / ${fmt(p.len)}${C >= 110 ? ' · ←/→ shots · P pause · Q list' : ''}`, DIM)
    setFlat(this.flatAll); drawPanel(cv, p, b, s, u, t, true); setFlat(0)
    for (let y = 0; y < 2; y++) for (let xs = 0; xs < C * 2; xs++) cv.setSub(xs, y, 0) // the bars, over anything that strayed
    for (let y = s.y1; y < R * 2; y++) for (let xs = 0; xs < C * 2; xs++) cv.setSub(xs, y, 0)
    // a dip to black between scenes (in at a scene's first shot, out at its last)
    const prev = p.beats[i - 1], next = p.beats[i + 1]
    let black = 0
    if (!prev || prev.scene !== b.scene) black = Math.max(black, 1 - clamp01(u / 0.6))
    if (!next || next.scene !== b.scene) black = Math.max(black, clamp01((u - (b.d - 0.5)) / 0.5))
    if (black > 0.01) for (let y = s.y0; y < s.y1; y++) for (let xs = 0; xs < C * 2; xs++) cv.blendSub(xs, y, 0, black)
    // the screen burst over the shot (the bars' words stay)
    if (this.burst) { cv.clip(0, C * 2); drawBurst(cv, this.burst.kind, clamp01((t - this.burst.at) / BURST_S)); cv.unclip() }
    // the subtitle: one centred line (two on a taller pane), white on black
    const sub = subtitleOf(b)
    if (sub) {
      const rowsFor = R - Math.ceil(s.y1 / 2), lines = wrapWords(sub, C - 6, Math.max(1, rowsFor))
      lines.forEach((l, k) => cv.text(Math.max(1, Math.round((C - l.length) / 2)), Math.ceil(s.y1 / 2) + k, l, WHITE_T, 0))
    }
    if (this.ended) { const msg = ' THE END · SPACE or Q: back to the list '; cv.text(Math.max(0, Math.round((C - msg.length) / 2)), R - 1, msg, INK, YEL) }
  }
  // ── out: rows of Text runs ────────────────────────────────────────────────
  // Busy frames (a 40-hero crowd) coarsen until the tree fits: colour first, then
  // neighbouring subpixels (and cells) share a colour. Each frame starts one level
  // finer than the last, so detail comes back once there is room.
  level = 0
  private tries = 0
  private keep: Int32Array | undefined
  live: Rect | undefined // the live panel this frame: it coarsens last
  out(): { specs: TextSpec[]; size: number } {
    const cv = this.sf.cv, px = cv.px
    if (!this.keep || this.keep.length !== px.length) this.keep = new Int32Array(px.length)
    this.keep.set(px)
    let m = Math.max(0, this.level - ((this.tries++ & 3) === 0 ? 1 : 0)) // detail comes back every fourth frame (a failed finer try costs a whole extra pass)
    for (;;) {
      const L = LEVELS[m]!
      if (L.q !== LEVELS[this.drawnQ]!.q || L.flat !== this.flat || (L.all ?? 0) !== this.flatAll) { this.draw0(m); this.keep.set(px) }
      else if (m) px.set(this.keep)
      if (L.k || L.kl) pair(cv.px, cv.W, cv.h, L.k, L.kl, this.live)
      this.sf.cells()
      const r = toSpecs(this.sf, L.mask, L.cq)
      if (r.size <= TREE_MAX || m === LEVELS.length - 1) { this.level = m; return r }
      m++
    }
  }
}
export const TREE_MAX = 92_000 // a Client tree is held to 100,000 serialized characters
// k: how coarse the frozen panels go, kl: the live panel (it keeps its detail longest)
// q: figures posterised to q tones a channel (0 full colour)
// flat: the frozen panels' figures, 0 full, 1 flat four-tone, 2 one-tone silhouettes
const LEVELS = [
  { q: 0, cq: 0, flat: 0, mask: 0xffffff, k: 0, kl: 0 }, { q: 0, cq: 0, flat: 1, mask: 0xffffff, k: 0, kl: 0 }, { q: 0, cq: 0, flat: 1, mask: 0xfcfcfc, k: 1, kl: 0 },
  { q: 0, cq: 0, flat: 1, mask: 0xf8f8f8, k: 3, kl: 0 }, { q: 0, cq: 0, flat: 2, mask: 0xf8f8f8, k: 0, kl: 0 }, { q: 6, cq: 0, flat: 2, mask: 0xf0f0f0, k: 0, kl: 0 },
  { q: 0, cq: 4, flat: 2, mask: 0xffffff, k: 0, kl: 0 }, { q: 0, cq: 3, flat: 2, mask: 0xffffff, k: 0, kl: 0 }, { q: 0, cq: 3, flat: 2, mask: 0xffffff, k: 1, kl: 1 },
  { q: 0, cq: 3, flat: 2, mask: 0xffffff, k: 7, kl: 3 }, { q: 4, cq: 3, flat: 2, mask: 0xc0c0c0, k: 15, kl: 7 },
  { q: 4, cq: 3, flat: 2, all: 1, mask: 0xc0c0c0, k: 15, kl: 7 }, { q: 4, cq: 3, flat: 2, all: 2, mask: 0xc0c0c0, k: 15, kl: 15 }, // last resorts: the shot's own figures flatten
] as { q: number; cq: number; flat: number; all?: number; mask: number; k: number; kl: number }[]
// Subpixels share their group's first colour: k = 1 a cell's pair, 3 two cells, 7 four, 15 eight.
function pair(px: Int32Array, W: number, H: number, k: number, kl: number, live: Rect | undefined) {
  const lx0 = live ? live.x0 * 2 : -1, lx1 = live ? live.x1 * 2 : -1, ly0 = live ? live.y0 : -1, ly1 = live ? live.y1 : -1
  for (let y = 2; y < H; y++) {
    const o = y * W, inY = y >= ly0 && y < ly1
    for (let x = 0; x < W; x++) { const kk = inY && x >= lx0 && x < lx1 ? kl : k; if (x & kk) px[o + x] = px[o + (x & ~kk)]! }
  }
}
const COVER_BEAT: PBeat = { k: 'cover', l: '', r: '', by: '', text: '', style: 0, sfx: '', fx: '', win: 'l', n: 0, att: [], hit: [], move: [], who: [], rw: [], ext: [], extIn: [], extOut: [], mv: '', brawl: false, earlier: [], cap: '', scene: -1, sceneCap: '', bg: 'city', start: 0, d: 6 }

const hex = (c: number) => '#' + (c & 0xffffff).toString(16).padStart(6, '0')
// Cells → rows of Text runs: neighbours with the same colours merge (a blank
// takes any ink), each row's commonest pair on its outer Text.
// A busy frame's colours snap to `cq` levels a channel (4: 64 inks, 3: 27): a four-colour
// comic print, with long runs, before any detail is given up.
const CQ = new Uint8Array(256)
let cqN = 0
function cqSet(n: number) { if (n === cqN) return; cqN = n; for (let v = 0; v < 256; v++) CQ[v] = n ? Math.round(Math.round((v * (n - 1)) / 255) * (255 / (n - 1))) : v }
const cqc = (c: number) => (cqN ? (CQ[(c >> 16) & 255]! << 16) | (CQ[(c >> 8) & 255]! << 8) | CQ[c & 255]! : c)
export function toSpecs(sf: Surface, mask: number, cq = 0): { specs: TextSpec[]; size: number } {
  cqSet(cq)
  const w = sf.words, cols = sf.columns, specs: TextSpec[] = []
  let size = 60
  const DEF = 0x1b1b29
  for (let row = 0; row < sf.rowCount; row++) {
    const runs: { s: string; fg: number; bg: number }[] = []
    let s = '', fg = -1, bg = -1
    for (let x = 0; x < cols; x++) {
      const o = (row * cols + x) * 3, cp = w[o]!, f0 = w[o + 1]!, b0 = w[o + 2]!
      const f = cqc(f0 === DEFAULT ? DEF : f0) & mask, b = cqc(b0 === DEFAULT ? DEF : b0) & mask, blank = cp === 0x20
      if (s && b === bg && (blank || fg === -1 || f === fg)) { s += String.fromCharCode(cp); if (!blank && fg === -1) fg = f; continue }
      if (s) runs.push({ s, fg, bg })
      s = String.fromCharCode(cp); bg = b; fg = blank ? -1 : f
    }
    if (s) runs.push({ s, fg, bg })
    // the commonest pair goes on the outer Text
    let best = runs[0]!, most = -1
    const tally = new Map<number, number>()
    for (const r of runs) { const k = r.bg * 4096 + (r.fg < 0 ? 4095 : r.fg & 0xfff); const n = (tally.get(k) ?? 0) + r.s.length; tally.set(k, n); if (n > most) { most = n; best = r } }
    const pf = best.fg < 0 ? DEF : best.fg, pb = best.bg
    const kids: TextSpec['kids'] = []
    for (const r of runs) {
      const rf = r.fg < 0 ? pf : r.fg
      if (rf === pf && r.bg === pb) { const last = kids[kids.length - 1]; if (typeof last === 'string') kids[kids.length - 1] = last + r.s; else kids.push(r.s); size += r.s.length + 3; continue }
      const props: Record<string, string> = {}
      if (rf !== pf) props.color = hex(rf)
      if (r.bg !== pb) props.backgroundColor = hex(r.bg)
      kids.push({ props, s: r.s }); size += r.s.length + 30 + (props.color ? 26 : 0) + (props.backgroundColor ? 36 : 0)
    }
    specs.push({ props: { color: hex(pf), backgroundColor: hex(pb) }, kids })
    size += 80
  }
  return { specs, size }
}
// (for tests and the gallery)
export const castName = (c: CharId) => nameOf(c)
export const backdrops = BACK
export const chars = CHARS
void caption
