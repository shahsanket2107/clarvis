// Hand-drawn pixel art for some of the heroes (see ../portraits.ts for the format).
// Faces are drawn as the LEFT half (right-aligned, last char = the centre column)
// and mirrored; asymmetric bits are patched in afterwards.
import { pixmap, type LaneArt, type StageArt } from './pixmap'
import type { Canvas, HiSprite } from '../pixel'

export const STAGES: Partial<Record<string, StageArt>> = {}
export const LANES: Partial<Record<string, LaneArt>> = {}

type Pal = Record<string, number>
function half(rows: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < 14; i++) {
    const r = (rows[i] ?? '').padStart(18, '.')
    if (r.length > 18) throw new Error(`avengers2: row ${i} too wide`)
    out.push(r + [...r].reverse().join(''))
  }
  return out
}
const put = (f: string[], x: number, y: number, ch: string) => { f[y] = f[y]!.slice(0, x) + ch + f[y]!.slice(x + 1) }
const swap = (f: string[], y: number, a: string, b: string) => { f[y] = f[y]!.split(a).join(b) }
const build = (rows: string[], pal: Pal, edit?: (f: string[]) => void) => { const f = half(rows); edit?.(f); return pixmap(f, pal) }
const pulse = (t: number, calm: boolean, sp = 2) => (calm ? 1 : 0.5 + 0.5 * Math.sin(t * sp))
const blinkNow = (t: number, calm: boolean) => !calm && t % 4.3 > 4.15
function blob(cv: Canvas, xs: number, y: number, rx: number, ry: number, c: number, a: number) {
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    const d = Math.hypot(i / rx, j / ry)
    if (d < 1 && y + j < 14 && y + j >= 0 && xs + i >= 0 && xs + i < 36) cv.glowSub(xs + i, y + j, c, a * (1 - d) * (1 - d))
  }
}
function orbit(cv: Canvas, cx: number, cy: number, rx: number, ry: number, ph: number, c: number, n = 10) {
  for (let k = 0; k < n; k++) {
    const a = ph + (k / n) * Math.PI * 2
    { const ox = Math.round(cx + Math.cos(a) * rx); if (ox < 36 && ox >= 0) cv.glowSub(ox, Math.round(cy + Math.sin(a) * ry), c, 0.35 + 0.65 * (k / n)) }
  }
}

// ---------------- Portrait toolkit (grids drawn in code, then pixmap'd once) ----------------
type G = string[][]
const gNew = (): G => Array.from({ length: 14 }, () => Array<string>(36).fill('.'))
const gPut = (g: G, x: number, y: number, c: string) => { if (g[y]?.[x] !== undefined) g[y]![x] = c }
function gEll(g: G, cx: number, cy: number, rx: number, ry: number, c: string | ((x: number, y: number, dx: number, dy: number) => string)) {
  for (let y = 0; y < 14; y++) for (let x = 0; x < 36; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry
    if (dx * dx + dy * dy <= 1) g[y]![x] = typeof c === 'string' ? c : c(x, y, dx, dy)
  }
}
function gLine(g: G, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) gPut(g, Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c)
}
const gMir = (g: G) => { for (const r of g) for (let x = 0; x < 18; x++) if (r[x] !== '.') r[35 - x] = r[x]! }
function gOutline(g: G, c: string) {
  const o = g.map(r => r.slice())
  for (let y = 0; y < 14; y++) for (let x = 0; x < 36; x++) if (g[y]![x] === '.') {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (g[y + dy!]?.[x + dx!] ?? '.') !== '.' && g[y + dy!]![x + dx!] !== c)) o[y]![x] = c
  }
  for (let y = 0; y < 14; y++) g[y] = o[y]!
}
const gRows = (g: G) => g.map(r => r.join(''))
const breath = (t: number, calm: boolean) => (calm ? 0 : Math.sin(t * 1.5) > 0.35 ? 1 : 0)
function shiftDown(s: HiSprite): HiSprite { // breathing: the body one subpixel lower, nothing leaves the 14-row box
  const px = new Int32Array(s.px.length), a = new Uint8Array(s.a.length), w = s.w
  for (let y = 1; y < s.h; y++) { px.set(s.px.subarray((y - 1) * w, y * w), y * w); a.set(s.a.subarray((y - 1) * w, y * w), y * w) }
  return { w, h: s.h, px, a }
}
function shiftFrom(s: HiSprite, r0: number): HiSprite { // rows r0.. one subpixel lower (breathing), still inside the 14-row box
  const px = Int32Array.from(s.px), a = Uint8Array.from(s.a), w = s.w
  for (let y = r0 + 1; y < s.h; y++) { px.set(s.px.subarray((y - 1) * w, y * w), y * w); a.set(s.a.subarray((y - 1) * w, y * w), y * w) }
  return { w, h: s.h, px, a }
}
function portrait(body0: HiSprite, hA: HiSprite, hB: HiSprite, under: ((cv: Canvas, t: number, calm: boolean) => void) | null, over: ((cv: Canvas, t: number, calm: boolean) => void) | null): StageArt {
  const body1 = shiftDown(body0)
  return (cv, t, calm) => {
    under?.(cv, t, calm)
    cv.hi(breath(t, calm) ? body1 : body0, 0, 0)
    cv.hi(blinkNow(t, calm) ? hB : hA, 0, 0)
    over?.(cv, t, calm)
  }
}

// ---------------- Doctor Strange ----------------
const SP: Pal = { O: 0x2a1226, H: 0x2e2638, G: 0xd0d0e0, S: 0xf2b48a, s: 0xc47a62, h: 0xffd2aa, E: 0x1a1020, M: 0x3a2a3c, R: 0xe03a2c, r: 0x8c1c2c, d: 0x5a1426, Y: 0xf4b830, g: 0x5cff90, B: 0x3a58b8, b: 0x24388a }
function strBody(): HiSprite {
  const g = gNew()
  for (let y = 5; y <= 13; y++) for (let x = Math.round(7 + (y - 5) * 0.2); x <= 17; x++) if (x <= 13 || y >= 9) g[y]![x] = x <= 9 + (y > 9 ? 0 : 0) ? 'r' : 'R'
  for (let y = 9; y <= 13; y++) for (let x = 14 - (y - 9) * 0; x <= 17; x++) g[y]![x] = 'R'
  for (let y = 9; y <= 13; y++) for (let x = 7 - (y - 9) * 0; x < 10; x++) g[y]![x] = 'd'
  for (let y = 10; y <= 13; y++) for (let x = 14; x <= 17; x++) g[y]![x] = x === 14 ? 'b' : 'B' // tunic V
  for (let y = 5; y <= 9; y++) gPut(g, 13, y, 'd') // collar fold
  gMir(g)
  for (const x of [17, 18]) { gPut(g, x, 11, 'Y'); gPut(g, x, 13, 'Y') }
  gPut(g, 16, 12, 'Y'); gPut(g, 19, 12, 'Y'); gPut(g, 17, 12, 'g'); gPut(g, 18, 12, 'g')
  gOutline(g, 'O')
  return pixmap(gRows(g), SP)
}
function strHead(blink: boolean): HiSprite {
  const g = gNew()
  gEll(g, 18, 5, 8.6, 5.2, (x, y, dx, dy) => dy < -0.5 ? 'H' : dx > 0.55 ? 's' : 'S')
  for (const side of [-1, 1]) {
    const m = (x: number) => (side < 0 ? x : 35 - x)
    for (let y = 2; y <= 5; y++) for (const x of [10, 11]) gPut(g, m(x) + (side < 0 ? 0 : 0), y, 'G') // grey temples
    gPut(g, m(12), 2, 'G'); gPut(g, m(12), 1, 'H')
    for (const x of [13, 14, 15]) gPut(g, m(x), 3, 'H') // brow
    gPut(g, m(14), 4, blink ? 'S' : 'E'); gPut(g, m(15), 4, blink ? 'S' : 'E')
    if (blink) { gPut(g, m(14), 4, 's'); gPut(g, m(15), 4, 's') }
  }
  gPut(g, 17, 5, 's'); gPut(g, 18, 5, 's'); gPut(g, 17, 6, 's'); gPut(g, 18, 6, 's')
  for (let x = 14; x <= 21; x++) gPut(g, x, 7, 'M') // moustache
  gPut(g, 15, 8, 'S'); gPut(g, 20, 8, 'S')
  for (const x of [16, 17, 18, 19]) gPut(g, x, 8, x === 17 || x === 18 ? 's' : 'M')
  for (const x of [16, 17, 18, 19]) gPut(g, x, 9, 'M')
  gOutline(g, 'O')
  return pixmap(gRows(g), SP)
}
const strBodyS = strBody(), strHeadA = strHead(false), strHeadB = strHead(true)
STAGES.strange = portrait(strBodyS, strHeadA, strHeadB,
  (cv, t, calm) => { const k = pulse(t, calm, 2.4); blob(cv, 18, 12, 7, 3, 0x3aff7a, 0.2 + 0.2 * k) },
  (cv, t, calm) => {
    const ph = calm ? 0 : t * 1.4, k = pulse(t, calm, 2.4)
    for (const [cx, dir] of [[4.5, 1], [31.5, -1]] as const) orbit(cv, cx, 3, 5, 2.8, ph * dir, 0xffa43a, 30)
    blob(cv, 18, 12, 3, 1, 0x9cffb8, 0.3 + 0.4 * k)
  })

// ---------------- Scarlet Witch ----------------
const WP: Pal = { O: 0x2a0e1c, A: 0x9a3a1c, a: 0x5a1a18, L: 0xd0662c, S: 0xf4bc98, s: 0xc87c68, K: 0x1a0c14, R: 0xe0203e, r: 0x8a1030, M: 0xc0304c }
const WIT_ROWS = [
  'RR....RR', 'OAARRRRRRR', 'OAAAAAARRR',
  'OAAAAAAALSSSSSS', 'OAAAAAALLSSaaSS', 'OAAaAAAALSSKKSS', 'OAAAAAAALSSSSSS', 'OaAAAAAALSSSSsS',
  'OAAAAAAaLSSSSMM', 'OAAAAAAAAAOSSSS', 'AAAAAAAAARRrSSS',
  'AALARRRRRRRRRRRRRR', 'ALARRRRRRRRRRRRRRR', 'AARRRRRRRRRRRRRRRR',
]
const witA = build(WIT_ROWS, WP), witB = build(WIT_ROWS, WP, f => swap(f, 5, 'K', 'S'))
const witA1 = shiftFrom(witA, 9), witB1 = shiftFrom(witB, 9)
STAGES.witch = (cv, t, calm) => {
  const k = pulse(t, calm, 3), ph = calm ? 0.5 : t
  for (const [xs, dir] of [[4, 1], [31, -1]] as const) {
    blob(cv, xs, 11, 5, 3, 0xff2a50, 0.25 + 0.25 * k)
    for (let i = 0; i < 9; i++) { // a hex wisp curling up from the fingertips
      const u = i / 9, an = ph * 3 * dir + u * 6.5
      cv.glowSub(Math.round(xs + Math.sin(an) * (1 + u * 3)), Math.round(12 - u * 9), i % 3 ? 0xff6a88 : 0xffc0d0, 0.95 * (1 - u * 0.55))
    }
  }
  const b = breath(t, calm) === 1, bl = blinkNow(t, calm)
  cv.hi(bl ? (b ? witB1 : witB) : b ? witA1 : witA, 0, 0)
  blob(cv, 18, 1, 6, 2, 0xff2a50, 0.15 + 0.2 * k)
}

// ---------------- Ant-Man ----------------
const AP: Pal = { O: 0x241418, R: 0xd8303a, r: 0x8c1424, h: 0xff7078, W: 0xd0d8e6, w: 0x8c98b4, C: 0x9ffaff, c: 0x2ab4c8, D: 0x0c1824, B: 0x34344e, b: 0x22223a, F: 0xf0ffff }
function antBody(): HiSprite {
  const g = gNew()
  for (let y = 10; y <= 13; y++) for (let x = Math.round(7 - (y - 10) * 1.5); x <= 17; x++) g[y]![x] = 'B'
  for (let y = 10; y <= 13; y++) for (let x = Math.round(7 - (y - 10) * 1.5); x <= Math.round(10 - (y - 10) * 1.5); x++) g[y]![x] = 'R' // red shoulder
  for (let y = 11; y <= 13; y++) gPut(g, 16, y, 'b')
  for (let y = 10; y <= 13; y++) gPut(g, 17, y, y === 10 ? 'W' : 'b')
  gMir(g)
  gOutline(g, 'O')
  return pixmap(gRows(g), AP)
}
function antHead(lens: string): HiSprite {
  const g = gNew()
  gEll(g, 18, 5.4, 9.6, 5.6, (x, y, dx, dy) => dy > 0.2 ? 'W' : dx > 0.6 ? 'r' : dy < -0.65 ? 'h' : 'R')
  for (let y = 0; y < 14; y++) for (let x = 0; x < 18; x++) if ((g[y]![x] === 'W') && x < 11) g[y]![x] = 'w' // shaded cheek
  for (let y = 3; y <= 6; y++) for (let x = 10; x <= 16; x++) if (g[y]![x] !== '.') g[y]![x] = 'D' // visor
  for (let y = 4; y <= 6; y++) for (let x = 11; x <= 15; x++) g[y]![x] = y === 4 ? lens : y === 5 ? lens : 'c'
  gPut(g, 17, 3, 'D'); gPut(g, 17, 4, 'D')
  for (const y of [8, 9]) for (let x = 12; x <= 17; x++) g[y]![x] = (x === 14 || x === 16) && y === 8 ? 'w' : 'W'
  for (const y of [0, 1]) gPut(g, 17, y, 'B')
  for (let y = 0; y <= 5; y++) gPut(g, 16, y, y < 4 ? 'B' : 'D') // central stripe + visor edge
  gMir(g)
  gPut(g, 7, 0, 'W'); gPut(g, 7, 1, 'W'); gPut(g, 28, 0, 'W'); gPut(g, 28, 1, 'W') // antenna pins
  gOutline(g, 'O')
  return pixmap(gRows(g), AP)
}
const antBodyS = antBody(), antHeadA = antHead('C'), antHeadB = antHead('F')
const PYM = [[5, 3], [31, 4], [3, 9], [33, 10], [8, 12], [28, 12]] as const
STAGES.antman = portrait(antBodyS, antHeadA, antHeadB,
  (cv, t, calm) => { const k = pulse(t, calm, 2.2); blob(cv, 18, 6, 15, 6, 0xe0303a, 0.1 + 0.08 * k) },
  (cv, t, calm) => {
    const k = pulse(t, calm, 2.2)
    for (let i = 0; i < PYM.length; i++) { // Pym particles: shrink as they drift up
      const age = calm ? 0.3 + i * 0.1 : mod(t * 0.5 + i * 0.37, 1), [px0, py0] = PYM[i]!, y = py0 - age * 4, a = 1 - age
      cv.glowSub(px0 + (i % 2 ? 1 : -1), Math.round(y), 0x7ff0ff, 0.9 * a)
      if (age < 0.5) { cv.glowSub(px0 + (i % 2 ? 2 : -2), Math.round(y), 0x7ff0ff, 0.5 * a); cv.glowSub(px0 + (i % 2 ? 1 : -1), Math.round(y) + 1, 0x7ff0ff, 0.4 * a) }
    }
    blob(cv, 13, 5, 2, 1, 0x7ff0ff, 0.2 + 0.25 * k); blob(cv, 22, 5, 2, 1, 0x7ff0ff, 0.2 + 0.25 * k)
  })

// ---------------- Deadpool & Wolverine (side by side) ----------------
const DWP: Pal = { O: 0x2a0a10, R: 0xd8222e, r: 0x8a1220, h: 0xf4585e, P: 0x14101a, W: 0xffffff, Y: 0xf4c818, y: 0xb08a10, B: 0x30304a, S: 0xf0b090, s: 0xb8745a, K: 0x4a2a30 }
const DP_H = ['OOOOOOO', 'ORRRRRRR', 'ORhhRRRR', 'ORRRRRRR', 'OPPPRRRR', 'OPWWPRRR', 'ORPPPPRR', 'ORRRRRRR', 'ORRRRRRr', 'OORRRRRR', 'KKRRRRRR', 'KKKRRRRR', 'KKKRRRRR', 'KKKRRRRR']
const WV_H = ['BB......', 'BBYYYYYY', 'BYYYYYYY', 'BYBBBBBB', 'BYBWWBBB', 'BYYBBBBB', 'BYYSSSSS', 'BYYSSsSS', 'BYYSsssS', 'BBYSSSSS', 'BBBYYYYY', 'BBBYYYYY', 'BBBYYYYY', 'BBBYYYYY']
const dwRows = () => DP_H.map((r, i) => { const l = r.padStart(8, '.'), w = WV_H[i]!.padStart(8, '.'); return l + [...l].reverse().join('') + '....' + w + [...w].reverse().join('') })
const dwBase = dwRows()
const dwA = pixmap(dwBase, DWP)
const dwSquint = pixmap(patchRows2(dwBase, f => { swap(f, 5, 'W', 'P'); swap(f, 4, 'P', 'R'); put(f, 3, 5, 'P') }), DWP)
const dwGlance = pixmap(patchRows2(dwBase, f => { const row = f[4]!; let o = row.slice(0, 20) + row.slice(20).replace(/W/g, 'B'); f[4] = o; for (let x = 21; x < 36; x++) if (row[x] === 'W') put(f, x - 1, 4, 'W') }), DWP)
function patchRows2(rows: string[], fn: (f: string[]) => void) { const f = [...rows]; fn(f); return f }
const dwA1 = shiftFrom(dwA, 9), dwSquint1 = shiftFrom(dwSquint, 9), dwGlance1 = shiftFrom(dwGlance, 9)
const DPP: Pal = { O: 0x2a0a10, R: 0xd8222e, r: 0x8a1220, h: 0xf4585e, P: 0x120e18, W: 0xffffff, K: 0x34324c, k: 0x8484b4, Y: 0xf4c818, B: 0x46465e, Q: 0xff6a8a }
const DP_EYES: Record<string, string[]> = {
  round: ['PPPP....', 'PWWWPP..', 'PWWWWWPP', '.PPPPPP.'],
  squint: ['PPPPP...', 'PWWWPP..', 'PPPPWWPP', '.PPPPPP.'],
  wink: ['........', 'PPPPPP..', 'PPPPPPPP', '........'],
}
function dpFrame(eyeL: string, eyeR: string, tilt: number) {
  const body = gNew(), head = gNew(), top = gNew()
  gEll(body, 18, 14.5, 16.5, 4.8, 'R')
  for (let y = 10; y < 14; y++) for (let x = 0; x < 36; x++) if (body[y]![x] === 'R' && (x === 9 || x === 26 || (y === 13 && x % 6 === 0))) body[y]![x] = 'r'
  for (let x = 12; x < 24; x++) gPut(body, x, 10, 'r')
  for (const sx of [1, -1]) { // katana hilts peeking over the shoulders
    const X = (x: number) => (sx > 0 ? x : 35 - x)
    gLine(body, X(2), 4, X(6), 10, 'B'); gLine(body, X(3), 4, X(7), 10, 'B')
    gLine(body, X(4), 8, X(7), 8, 'Y')
  }
  gEll(head, 18, 4.5, 9.8, 4.6, (x, y, dx, dy) => (dx + dy * 0.6 < -0.5 && y < 3 ? 'h' : dx + dy > 0.95 ? 'r' : 'R'))
  for (let y = 0; y < 3; y++) { gPut(head, 17, y, 'r'); gPut(head, 18, y, 'r') }
  for (const [eye, left] of [[eyeL, true], [eyeR, false]] as const) {
    DP_EYES[eye]!.forEach((row, i) => [...row].forEach((c, j) => { if (c !== '.') gPut(head, left ? 9 + j + 1 : 26 - j - 1, 2 + i, c) }))
  }
  for (let y = 7; y < 9; y++) { gPut(head, 17, y, 'r'); gPut(head, 18, y, 'r') }
  const out = gNew()
  for (let y = 0; y < 14; y++) { const sh = Math.round((tilt * 1.5 * Math.max(0, 8 - y)) / 8); for (let x = 0; x < 36; x++) if (head[y]![x] !== '.') gPut(out, x + sh, y, head[y]![x]!) }
  const comp = gNew()
  for (let y = 0; y < 14; y++) for (let x = 0; x < 36; x++) comp[y]![x] = out[y]![x] !== '.' ? out[y]![x]! : body[y]![x]!
  // gloved hands cupped under the jaw, fingers fanned up the cheeks
  for (const sx of [1, -1]) {
    const X = (x: number) => (sx > 0 ? x : 35 - x)
    for (let y = 9; y < 12; y++) for (let x = 7; x <= 13; x++) gPut(comp, X(x), y, 'K')
    for (let x = 12; x <= 14; x++) gPut(comp, X(x), 8, 'K')
    for (const [fx, ft] of [[7, 6], [9, 5], [11, 6]] as const) {
      for (let y = ft; y < 9; y++) gPut(comp, X(fx), y, 'K')
      gPut(comp, X(fx), ft, 'k')
    }
    for (let x = 8; x <= 13; x++) gPut(comp, X(x), 9, 'k')
  }
  gOutline(comp, 'O')
  return pixmap(gRows(comp), DPP)
}
const DPF = new Map<string, HiSprite>()
const dpGet = (l: string, r: string, tilt: number) => { const k = `${l}${r}${tilt}`; let s = DPF.get(k); if (!s) { s = dpFrame(l, r, tilt); DPF.set(k, s) } return s }
for (const e of [['round', 'round'], ['squint', 'squint'], ['round', 'wink']] as const) for (const tl of [-1, 0, 1]) dpGet(e[0], e[1], tl)
const HEART = ['.Q.Q.', 'QQQQQ', '.QQQ.', '..Q..']
STAGES.deadpool = (cv, t, calm) => {
  const tt = calm ? 0 : t % 7
  const tilt = calm ? 1 : Math.sin(t * 1.4) > 0.45 ? 1 : Math.sin(t * 1.4) < -0.45 ? -1 : 0
  const sq = tt > 2.6 && tt < 3.5, wk = tt > 5.0 && tt < 5.6
  cv.hi(sq ? dpGet('squint', 'squint', tilt) : wk ? dpGet('round', 'wink', tilt) : dpGet('round', 'round', tilt), 0, 0)
  const hq = calm ? 0.5 : tt - 5.1
  if (hq > 0 && hq < 1.4) {
    const rise = Math.round(hq * 1.5), a = hq < 1 ? 1 : 1 - (hq - 1) / 0.4
    HEART.forEach((row, i) => [...row].forEach((c, j) => { if (c !== '.' && 3 - rise + i >= 0) cv.blendSub(30 + j, Math.max(0, 3 - rise) + i, 0xff6a8a, a) }))
  }
}

// ---------------- Nick Fury ----------------
const FP: Pal = { O: 0x1c0e14, S: 0xb47a50, s: 0x7a4a32, h: 0xd09868, H: 0xf4c898, E: 0x1a0e0c, W: 0xf0e8e0, P: 0x07070c, q: 0x5a5a80, G: 0x2c2024, K: 0x2e3048, k: 0x4c5072, b: 0x16162a, d: 0x3a2018, a: 0x9ad8ff }
function furyBody(): HiSprite {
  const g = gNew()
  for (let y = 9; y <= 13; y++) for (let x = Math.round(8 - (y - 9) * 2); x <= 17; x++) g[y]![x] = x <= Math.round(8 - (y - 9) * 2) + 1 ? 'k' : 'K'
  for (let y = 6; y <= 11; y++) for (let x = 8 + (y - 6) * 0; x <= 12; x++) if (x >= 8 + (y < 8 ? 0 : 0)) g[y]![x] = x === 8 ? 'k' : x >= 11 ? 'K' : 'K' // tall collar
  for (let y = 6; y <= 12; y++) gPut(g, 12, y, y > 8 ? 'b' : 'K')
  for (let y = 11; y <= 13; y++) for (let x = 15; x <= 17; x++) g[y]![x] = 'b' // V of the coat
  gMir(g)
  gOutline(g, 'O')
  return pixmap(gRows(g), FP)
}
function furyHead(blink: boolean): HiSprite {
  const g = gNew()
  gEll(g, 18, 4.9, 10.6, 5.6, (x, y, dx, dy) => (dx > 0.6 ? 's' : dx < -0.35 && dy < 0.1 ? 'h' : 'S'))
  for (const [x, y] of [[12, 1], [13, 1], [14, 1], [15, 1], [11, 2], [12, 2], [13, 2]] as const) gPut(g, x, y, 'H') // bald-head shine
  for (let x = 20; x <= 24; x++) gPut(g, x, 1, 'h')
  gLine(g, 11, 2, 15, 3, 'd'); gLine(g, 12, 3, 16, 3, 'd') // hard scowl brow, slanting down to the nose
  gPut(g, 12, 2, 'S')
  for (const x of [12, 13, 14, 15]) gPut(g, x, 4, blink ? 's' : 'W') // right eye: white with a dark pupil
  if (!blink) { gPut(g, 14, 4, 'E'); gPut(g, 15, 4, 'E'); gPut(g, 14, 5, 'E') }
  else for (const x of [12, 13, 14, 15]) gPut(g, x, 4, 'd')
  gPut(g, 14, 5, blink ? 's' : 'E')
  // eyepatch: a small angled oval over the left eye, a thin strap across the forehead
  for (const [x, y] of [[21, 3], [22, 3], [23, 3], [21, 4], [22, 4], [23, 4], [24, 4], [22, 5], [23, 5], [24, 5], [25, 5]] as const) gPut(g, x, y, 'P')
  gLine(g, 21, 3, 10, 1, 'G'); gLine(g, 25, 5, 29, 4, 'G')
  for (const x of [17, 18]) { gPut(g, x, 5, 's'); gPut(g, x, 6, 's') } gPut(g, 19, 6, 's'); gPut(g, 16, 6, 's')
  for (let x = 14; x <= 21; x++) gPut(g, x, 8, 'd') // closed, stern mouth
  gPut(g, 13, 8, 's'); gPut(g, 22, 8, 's')
  for (let x = 15; x <= 20; x++) gPut(g, x, 9, 'G'); for (let x = 16; x <= 19; x++) gPut(g, x, 10, 'G') // goatee
  gOutline(g, 'O')
  return pixmap(gRows(g), FP)
}
const furyBodyS = furyBody(), furyHeadA = furyHead(false), furyHeadB = furyHead(true)
STAGES.fury = portrait(furyBodyS, furyHeadA, furyHeadB,
  (cv, t, calm) => { const k = pulse(t, calm, 3); blob(cv, 18, 6, 17, 7, 0xffb020, 0.07 + 0.06 * k) },
  (cv, t, calm) => {
    const k = pulse(t, calm, 3)
    const sw = calm ? 0.5 : mod(t / 3.2, 1.6) // a glint sweeps across the bald head
    if (sw < 1) { const gx = Math.round(10 + sw * 16); cv.glowSub(gx, 1, 0xffffff, 0.8); cv.glowSub(gx - 1, 2, 0xffe8c8, 0.5); cv.glowSub(gx + 1, 1, 0xffe8c8, 0.4) }
    blob(cv, 2, 10, 3, 4, 0x3aa0ff, 0.1 + 0.1 * k); blob(cv, 33, 10, 3, 4, 0x3aa0ff, 0.1 + 0.1 * k)
    for (let i = 0; i < 3; i++) cv.glowSub(30 + i, 13 - (Math.floor(t * 2) + i) % 3, 0x9ad8ff, 0.5) // data ticks
  })

// ---------------- Thanos ----------------
const TP: Pal = { O: 0x1e0e2c, P: 0x8c58b4, p: 0x5e3a86, h: 0xb88ae0, Y: 0xf4b82c, y: 0xa87218, K: 0x14081c, A: 0x2c48a8, E: 0xe8c860 }
const THAN_ROWS = [
  'yY.......YY', 'YYY.....YYYY', 'OYYYYYYYYYYY', 'OYYyYYYYYYYY', 'OPPYYYYYYYYY', 'OPPKKpPPPPPP',
  'OPPPPPPPPPPP', 'OPPPPPPPPPpP', 'OPPPPppppppp', 'OPPpPPpPPpPP', 'OPpPPpPPpPP',
  'YYYYYYAAAAAAAAAAAA', 'YYYYYYAAAAAAAAAAAA', 'YYYYYYAAAAAAAAAAAA',
]
const thanA = build(THAN_ROWS, TP), thanB = build(THAN_ROWS, TP, f => swap(f, 5, 'K', 'p'))
const STONES = [0x3a8cff, 0xffe03a, 0xff8a28, 0xb04aff, 0x3aff7a, 0xff3a4a]
STAGES.snap = (cv, t, calm) => {
  cv.hi(blinkNow(t, calm) ? thanB : thanA, 0, 0)
  STONES.forEach((c, i) => {
    const x = 8 + i * 4 + (i > 2 ? 4 : 0), k = pulse(t + i * 1.1, calm, 2.6)
    blob(cv, x + 1, 12, 3, 1, c, 0.3 + 0.4 * k)
    cv.setSub(x, 12, c); cv.setSub(x + 1, 12, c)
  })
}

// ---------------- The Clarvis emblem: a gold ring, a C, an arc-reactor core (an original mark) ----------------
const AVP: Pal = { G: 0xf4c040, g: 0xa87818, W: 0xeef2fa, w: 0x8a96b4, D: 0x3c3a5c, C: 0x9bf0ff, c: 0x2f8fc8 }
const A_ROWS: string[] = (() => {
  const rows: string[] = []
  for (let y = 0; y < 14; y++) {
    let r = ''
    for (let x = 0; x < 36; x++) {
      const dx = x - 17.5, dy = y - 6.5, d = Math.hypot(dx / 17, dy / 6.9)
      let ch = '.'
      if (d >= 0.86 && d < 1) ch = dx + dy * 0.9 < 0 ? 'G' : 'g'
      else if (d < 0.86) {
        const a = Math.atan2(dy / 6.9, dx / 17) // 0 points right: the C opens there
        if (d >= 0.42 && d < 0.72 && Math.abs(a) > 0.75) ch = dy < 0 ? 'W' : 'w' // the C
        else if (d < 0.26) ch = d < 0.13 ? 'W' : 'C' // the reactor core
        else if (d < 0.32) ch = 'c'
      }
      r += ch
    }
    rows.push(r)
  }
  return rows
})()
const avSprite = pixmap(A_ROWS, AVP)
STAGES.assemble = (cv, t, calm) => {
  const k = pulse(t, calm, 1.6)
  blob(cv, 18, 7, 17, 7, 0xf4c040, 0.08 + 0.08 * k)
  cv.hi(avSprite, 0, 0)
  const s = calm ? 0.5 : (t * 0.45) % 1.6
  for (let y = 1; y < 12; y++) for (let x = 6; x < 30; x++) {
    const d = x * 0.35 + y - s * 30 + 6
    if (Math.abs(d) < 1.6 && cv.get(x / 2, y) !== 0 && A_ROWS[y]![x] === 'W') cv.glowSub(x, y, 0xffffff, 0.5 * (1 - Math.abs(d) / 1.6))
  }
}
// ======================= LANES (8 subpx tall, full width) =======================
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const lerpC = (a: number, b: number, k: number) => {
  const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k), g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k), bl = Math.round((a & 255) * (1 - k) + (b & 255) * k)
  return (r << 16) | (g << 8) | bl
}
const mod = (a: number, n: number) => ((a % n) + n) % n

// Lane art (LH = 12 subpx tall). Sprites are authored 1 source px = 2 subpx wide.
const LH = 12
const dbl = (rows: string[], w: number) => rows.map(r => [...r.padEnd(w, '.')].map(c => c + c).join(''))
const sp2 = (rows: string[], pal: Pal, w: number): HiSprite => pixmap(dbl(rows, w), pal)
const patchRows = (rows: string[], edits: [number, number, string][]) => {
  const out = rows.map(r => r.split(''))
  for (const [r, c, ch] of edits) out[r]![c] = ch
  return out.map(r => r.join(''))
}
const ground = (cv: Canvas, y0: number) => { for (let x = 0; x < cv.W; x++) cv.blendSub(x, y0 + LH - 1, 0x4a4a74, 0.35) }
const dust = (cv: Canvas, x: number, yb: number, tt: number) => {
  for (let k = 0; k < 3; k++) cv.blendSub(Math.round(x - 2 - k * 3 - ((tt * 9) % 2)), yb - 1 - (k >> 1), 0xa8a8c8, 0.55 - k * 0.15)
}
function scaled(cv: Canvas, s: HiSprite, xs: number, yb: number, k: number, al: number) {
  const w2 = Math.max(2, Math.round(s.w * k)), h2 = Math.max(2, Math.round(s.h * k))
  for (let j = 0; j < h2; j++) for (let i = 0; i < w2; i++) {
    const si = Math.min(s.h - 1, Math.floor(j / k)) * s.w + Math.min(s.w - 1, Math.floor(i / k))
    if (s.a[si]) cv.blendSub(xs + i, yb - h2 + j, s.px[si]!, al)
  }
}
function arc(cv: Canvas, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, c: number, al: number, c2 = c) {
  const n = 28
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n, k = i / n
    cv.blendSub(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), k > 0.8 ? c2 : c, al * (0.3 + 0.7 * k))
  }
}

// ---- Thanos: the gauntlet slides in, squeezes, SNAP, dust drifts one way ----
const GAUNT = sp2([
  '..123456....', '.YYYYYYYYY..', 'YYhYyYYyYYy.', 'YhYYyYYyYYYy', 'YYYYyYYyYYYy', 'YYYYYYYYYYYy',
  '.YYYYYYYYYy.', '..yYYYYYYYy.', '...yYYYYYy..', '...BBBBBBB..', '...BbBBBBB..', '...BBBBBBB..',
], { Y: 0xf4b82c, y: 0xa87218, h: 0xffe08a, B: 0x3858c8, b: 0x1c2c78, '1': STONES[0]!, '2': STONES[1]!, '3': STONES[2]!, '4': STONES[3]!, '5': STONES[4]!, '6': STONES[5]! }, 12)
LANES.snap = (cv, y0, t, calm) => {
  LY0 = y0
  const tt = calm ? 3 : t % 7, W = cv.W, gx = Math.floor(W * 0.26)
  const p = ease(tt / 1.3), x = Math.round(-30 + (gx + 30) * p), sq = tt > 1.2 && tt < 1.7 ? 1 : 0
  ground(cv, y0)
  cv.hi(GAUNT, x / 2, y0 + sq)
  const gl = Math.min(1, Math.max(0, (tt - 0.5) / 0.7)) * (1 + (sq ? 0.8 : 0))
  STONES.forEach((c, i) => lblob(cv, x + 5 + i * 2, y0 + 1, 4, 3, c, 0.3 * gl))
  if (tt >= 1.7 && tt < 2.2) {
    const k = (tt - 1.7) / 0.5
    lblob(cv, gx + 12, y0 + 6, Math.round(8 + 60 * k), Math.round(5 + 2 * k), 0xffd860, 0.55 * (1 - k))
    arc(cv, gx + 12, y0 + 6, 6 + 55 * k, 5.5, -Math.PI, Math.PI, 0xe8d0ff, 1 - k)
  }
  if (tt > 1.8) for (let i = 0; i < 40; i++) {
    const age = tt - 1.8 - (i / 40) * 3.4
    if (age < 0) continue
    const a = mod(age, 3.4), f = a / 3.4
    const xx = Math.round(gx + 20 + a * (12 + ((i * 7) % 11) * 2.2)), yy = Math.round(y0 + 1 + ((i * 5) % 9) + Math.sin(a * 3 + i) * 1.2 - f * 2)
    if (xx >= W || yy < y0 || yy >= y0 + LH) continue
    const al = Math.pow(1 - f, 0.9), c = lerpC([0xc89aff, 0xf0e0ff, 0x9a7ac0][i % 3]!, 0x6a6a80, f)
    cv.blendSub(xx, yy, c, al); cv.blendSub(xx + 1, yy, c, al)
    if (i % 3 === 0 && yy - 1 >= y0) cv.blendSub(xx, yy - 1, c, al * 0.6)
  }
}

// ---- Shared lane toolkit (new lanes): clipped drawing, parametric 10-row figures ----
let LY0 = 0
const bs = (cv: Canvas, x: number, y: number, c: number, a = 1) => { const ry = Math.round(y); if (ry >= LY0 && ry < LY0 + LH && a > 0) cv.blendSub(Math.round(x), ry, c, a > 1 ? 1 : a) }
const gw = (cv: Canvas, x: number, y: number, c: number, a: number) => { const ry = Math.round(y); if (ry >= LY0 && ry < LY0 + LH && a > 0) cv.glowSub(Math.round(x), ry, c, a) }
function lblob(cv: Canvas, xs: number, y: number, rx: number, ry: number, c: number, a: number) {
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    const d = Math.hypot(i / rx, j / ry)
    if (d < 1) gw(cv, xs + i, y + j, c, a * (1 - d) * (1 - d))
  }
}
const lseg = (cv: Canvas, x0: number, y0: number, x1: number, y1: number, c: number, a: number, upto = 1) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n * upto; i++) bs(cv, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a)
}
const lplus = (cv: Canvas, x: number, y: number, c: number, a: number) => { bs(cv, x, y, c, a); bs(cv, x - 1, y, c, a * 0.6); bs(cv, x + 1, y, c, a * 0.6); bs(cv, x, y - 1, c, a * 0.6); bs(cv, x, y + 1, c, a * 0.6) }
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const kfl = (t: number, k: [number, number][]) => { // linear keyframes
  if (t <= k[0]![0]) return k[0]![1]
  for (let i = 1; i < k.length; i++) if (t <= k[i]![0]) { const [t0, v0] = k[i - 1]!, [t1, v1] = k[i]!; return v0 + (v1 - v0) * ((t - t0) / (t1 - t0)) }
  return k[k.length - 1]![1]
}
const kfe = (t: number, k: [number, number][]) => { // eased keyframes
  if (t <= k[0]![0]) return k[0]![1]
  for (let i = 1; i < k.length; i++) if (t <= k[i]![0]) { const [t0, v0] = k[i - 1]!, [t1, v1] = k[i]!; return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0)) }
  return k[k.length - 1]![1]
}
const hash = (i: number) => { let h = Math.imul(i + 1, 2654435761) >>> 0; h ^= h >>> 13; h = Math.imul(h, 1274126177) >>> 0; return (h & 1023) / 1023 }
const shadowE = (cv: Canvas, x: number, y0: number, rx: number, a: number) => { for (let i = -rx; i <= rx; i++) bs(cv, x + i, y0 + LH - 1, 0x0e0e1c, a * (1 - Math.abs(i) / (rx + 1))) }
const skid = (cv: Canvas, x: number, yb: number, dir: number, tt: number, n = 5) => {
  for (let k = 0; k < n; k++) { const r = mod(tt * 7 + k * 0.37, 1); bs(cv, x - dir * (2 + r * 9 + k), yb - 1 - (k % 3), 0xb8b8d8, 0.6 * (1 - r)); if (k % 2) bs(cv, x - dir * (3 + r * 9 + k), yb - 2 - (k % 2), 0x8a8aa8, 0.4 * (1 - r)) }
}
const speedL = (cv: Canvas, x: number, y0: number, dir: number, len: number, c = 0xe8ecff) => { for (let k = 0; k < 4; k++) { const yy = y0 + 1 + k * 3 + (k & 1); for (let i = 0; i < len - k * 2; i++) bs(cv, x - dir * (3 + i + k * 3), yy, c, 0.5 * (1 - i / len)) } }
function ringE(cv: Canvas, cx: number, cy: number, rx: number, ry: number, c: number, a: number, step = 0.18) { for (let an = 0; an < 6.283; an += step) bs(cv, cx + Math.cos(an) * rx, cy + Math.sin(an) * ry, c, a) }
function fireball(cv: Canvas, x: number, y: number, q: number, big: number) { // q: seconds since the hit
  if (q < 0 || q > 1.3) return
  const r = Math.round(big * Math.min(1, q / 0.35)), fade = clamp01(1 - (q - 0.5) / 0.8)
  lblob(cv, x, y, r + 4, 6, 0xff7a20, 0.5 * fade)
  if (q < 0.5) { lblob(cv, x, y, r, 5, 0xffe08a, 0.9 * (1 - q / 0.5)); lblob(cv, x, y, Math.max(2, r >> 1), 3, 0xffffff, 1 - q / 0.5) }
  ringE(cv, x, y, r * 1.8 + q * 14, 5, 0xffd890, 0.7 * (1 - q / 1.3), 0.12)
  for (let i = 0; i < 10; i++) { const a = i * 0.63, v = 10 + (i % 3) * 5; lplus(cv, x + Math.cos(a) * v * q * 1.7, y + Math.sin(a) * v * q * 0.6 + q * q * 9, i % 2 ? 0xffb040 : 0xff5a28, 0.9 * fade) }
  for (let i = 0; i < 4; i++) lblob(cv, x - 4 + i * 3, Math.round(y - 3 - q * 5 - i), 2, 1, 0x5a5a6e, 0.35 * clamp01((q - 0.3) / 0.3) * fade)
}

// Parametric figure: 10 rows x 11 cols, facing right. Head 3 rows; torso/arm/leg chars: T t b a h L F C c.
interface Pose { dy?: number; lean?: number; a: [number, number][]; l: [number, number][]; cape?: number; coat?: number }
function figRows(head: string[], p: Pose): string[] {
  const hh = Math.max(0, head.length - 3), W = 11, H = 10 + hh, g = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  const put = (x: number, y: number, c: string) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y]![x] = c }
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) put(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c) }
  const dy = (p.dy ?? 0) + hh, ln = p.lean ?? 0
  const A = p.a.map(([x, y]) => [x, y + hh] as [number, number]), Lg = p.l.map(([x, y]) => [x, y + hh] as [number, number])
  if (p.cape) for (let r = 0; r < 6; r++) { const xs = 2 + ln - Math.max(1, p.cape - Math.floor(r * 0.5)); for (let x = xs; x <= 3 + ln; x++) put(x, 3 + dy + r, x === xs ? 'c' : 'C') }
  line(2 + ln, 3 + dy, A[0]![0], A[0]![1], 'a'); put(A[0]![0], A[0]![1], 'h')
  line(3 + ln, 6 + dy, Lg[0]![0], Lg[0]![1], 'L'); put(Lg[0]![0], Lg[0]![1], 'F'); put(Lg[0]![0] + 1, Lg[0]![1], 'F')
  line(6 + ln, 6 + dy, Lg[1]![0], Lg[1]![1], 'L'); put(Lg[1]![0], Lg[1]![1], 'F'); put(Lg[1]![0] + 1, Lg[1]![1], 'F')
  for (let x = 2 + ln; x <= 7 + ln; x++) put(x, 3 + dy, 'T')
  for (let y = 4; y <= 5; y++) for (let x = 3 + ln; x <= 6 + ln; x++) put(x, y + dy, x === 3 + ln ? 't' : 'T')
  for (let x = 3 + ln; x <= 6 + ln; x++) put(x, 6 + dy, 'b')
  if (p.coat) for (let k = 0; k < p.coat; k++) for (let x = 3 + ln - (k >> 1); x <= 6 + ln + (k >> 1); x++) put(x, 7 + dy + k, x === 3 + ln - (k >> 1) ? 't' : 'C')
  head.forEach((r, j) => { for (let i = 0; i < 4; i++) if (r[i] !== '.') put(3 + ln + i, (p.dy ?? 0) + j, r[i]!) })
  line(7 + ln, 3 + dy, A[1]![0], A[1]![1], 'a'); put(A[1]![0], A[1]![1], 'h')
  return g.map(r => r.join(''))
}
const mkFig = (head: string[], pal: Pal, name: string, extra: Partial<Pose> = {}) => sp2(figRows(head, { ...POSES[name]!, ...extra }), pal, 11)
const POSES: Record<string, Pose> = {
  stand: { a: [[2, 6], [8, 6]], l: [[3, 9], [6, 9]] },
  r1: { a: [[0, 5], [9, 3]], l: [[1, 8], [8, 9]] },
  r2: { a: [[2, 6], [8, 5]], l: [[3, 9], [7, 8]] },
  r3: { a: [[9, 3], [0, 5]], l: [[8, 9], [1, 8]] },
  r4: { a: [[8, 5], [2, 6]], l: [[7, 8], [3, 9]] },
  crouch: { dy: 2, lean: 1, a: [[3, 7], [9, 7]], l: [[1, 9], [8, 9]] },
  leap: { a: [[0, 1], [10, 1]], l: [[1, 7], [9, 8]] },
  lunge: { lean: 1, a: [[10, 3], [10, 5]], l: [[0, 9], [9, 9]] },
  raise: { a: [[1, 1], [9, 1]], l: [[3, 9], [6, 9]] },
  fwd: { a: [[2, 6], [10, 4]], l: [[3, 9], [6, 9]] },
  wave: { a: [[2, 6], [9, 0]], l: [[3, 9], [6, 9]] },
  wave2: { a: [[2, 6], [10, 1]], l: [[3, 9], [6, 9]] },
  shrug: { a: [[1, 4], [9, 4]], l: [[3, 9], [6, 9]] },
}
const FIGH = 10 // figure height; the sprite's feet land on the ground row (y0 + 11)
const figY = (y0: number) => y0 + LH - FIGH
const runCycle = (c: HiSprite[], tt: number, sp = 9) => c[Math.floor(tt * sp) & 3]!

// ---- Strange: sling-ring portal, mirror-dimension fold, out of a second portal, a Time Stone rewind ----
const STRL: Pal = { H: 0x2e2638, S: 0xf2b48a, G: 0xd0d0e0, K: 0x1a1020, M: 0x3a2a3c, R: 0xe03a2c, T: 0x3a58b8, t: 0x22388a, b: 0x8c6a1c, a: 0xe03a2c, h: 0xf2b48a, L: 0x2c3a78, F: 0x3a2a48, C: 0xe03a2c, c: 0x8c1c2c }
const STR_HEAD = ['.HH.', 'HHHH', 'HHHH', 'GSKS', 'RMMR']
const strWalk = [mkFig(STR_HEAD, STRL, 'r1', { cape: 4 }), mkFig(STR_HEAD, STRL, 'r2', { cape: 5 }), mkFig(STR_HEAD, STRL, 'r3', { cape: 4 }), mkFig(STR_HEAD, STRL, 'r4', { cape: 4 })]
const strCrouch = mkFig(STR_HEAD, STRL, 'crouch', { cape: 4 }), strCast = mkFig(STR_HEAD, STRL, 'fwd', { cape: 2 }), strRaise = mkFig(STR_HEAD, STRL, 'raise', { cape: 4 }), strStand = mkFig(STR_HEAD, STRL, 'stand', { cape: 2 })
function portalL(cv: Canvas, px: number, py: number, rx: number, ry: number, tt: number, a: number) {
  if (rx < 0.8) return
  for (let y = LY0; y < LY0 + LH; y++) for (let x = Math.floor(px - rx - 1); x <= px + rx + 1; x++) {
    const d = Math.hypot((x + 0.5 - px) / rx, (y + 0.5 - py) / ry)
    if (d < 0.86) cv.blendSub(x, y, 0x1a0c24, 0.92 * a)
    else if (d < 1.0) cv.blendSub(x, y, 0xffb040, a) // one bright ring
  }
  lblob(cv, Math.round(px), Math.round(py), Math.round(rx + 3), 5, 0xffa43a, 0.14 * a)
  for (let i = 0; i < 8; i++) { const an = tt * 2.6 + i * 0.785, rr = 1.12 + 0.08 * Math.sin(tt * 5 + i); lplus(cv, px + Math.cos(an) * rx * rr, py + Math.sin(an) * ry * rr, i % 2 ? 0xffe08a : 0xffa43a, 0.95 * a) }
}
LANES.strange = (cv, y0, t, calm) => {
  LY0 = y0
  const tt = calm ? 1.9 : mod(t, 8), W = cv.W, yb = y0 + LH, fy = figY(y0), P1 = Math.round(W * 0.45), P2 = Math.round(W * 0.8), py = y0 + 5.5
  ground(cv, y0)
  // Strange's x: walk in, cast, step through portal A (gone), later walk out of portal B and off
  const sx = Math.round(kfl(tt, [[0, -12], [1.3, W * 0.17], [3.0, W * 0.17], [3.9, P1 - 6], [5.5, P2 - 12], [6.0, P2 - 12], [7.0, P2 + 24], [8, W - 30]]))
  const walking = (tt < 1.3 || (tt > 3.0 && tt < 3.95) || (tt > 5.5 && tt < 5.95) || tt > 6.0)
  let spr: HiSprite = strStand, al = 1
  if (tt < 1.3) spr = runCycle(strWalk, tt, 8)
  else if (tt < 1.7) spr = strStand
  else if (tt < 2.1) spr = strCrouch // anticipation
  else if (tt < 3.0) spr = strCast // sling ring
  else if (tt < 3.95) spr = runCycle(strWalk, tt, 7)
  else if (tt >= 5.5 && tt < 5.95) spr = runCycle(strWalk, tt, 7)
  else if (tt >= 5.95 && tt < 6.7) spr = tt < 6.35 ? strRaise : strStand // Time Stone beat
  else if (tt >= 6.7) spr = runCycle(strWalk, tt, 8)
  if (tt >= 3.0 && tt < 4.1) al = clamp01((P1 + 4 - (sx + 22)) / 12)
  else if (tt >= 4.1 && tt < 5.5) al = 0
  else if (tt >= 5.5 && tt < 6.2) al = clamp01((sx + 6 - (P2 - 10)) / 12)
  if (al > 0.02) { if (walking && al > 0.5) shadowE(cv, sx + 12, y0, 9, 0.3); cv.hi(spr, sx / 2, fy - 2, { alpha: al }) }
  if (walking && al > 0.5 && tt < 1.3) skid(cv, sx + 4, yb, 1, tt, 3)
  // sling ring: a spark circle drawn at his hand, then portal A opens
  const hx = Math.round(W * 0.17) + 22
  if (tt > 1.7 && tt < 3.0) {
    const q = clamp01((tt - 1.7) / 1.2), rr = 2 + q * 5
    for (let i = 0; i < 14; i++) { const an = tt * 7 + i * 0.45; bs(cv, hx + 2 + Math.cos(an) * rr * 1.3, fy + 4 + Math.sin(an) * rr * 0.6, i % 2 ? 0xffe08a : 0xff8a28, 0.9 * clamp01(q * 2)) }
    lblob(cv, hx + 2, fy + 4, 5, 3, 0xffa43a, 0.5 * q)
  }
  const a1 = ease((tt - 2.2) / 0.8) * (1 - ease((tt - 4.0) / 0.45))
  portalL(cv, P1, py, 10 * a1, 5.5 * a1, tt, a1 > 0 ? 1 : 0)
  if (tt > 2.2 && tt < 3.0) { const q = (tt - 2.2) / 0.8; for (let i = 0; i < 10; i++) { const u = clamp01(q * 1.3 - i * 0.04); lplus(cv, hx + 2 + (P1 - 11 - hx) * u, fy + 4 + (py - fy - 4) * u + Math.sin(u * 9 + i) * 1.5, 0xffd070, 0.8 * Math.sin(u * 3.14)) } }
  if (tt > 3.9 && tt < 4.5) { const q = (tt - 3.9) / 0.6; for (let i = 0; i < 8; i++) lplus(cv, P1 + Math.cos(i * 0.8) * q * 14, py + Math.sin(i * 0.8) * q * 5, 0xffe08a, 1 - q) } // closing pop
  // mirror dimension: a few bold mirrored kaleidoscope tiles (flat colours, orange edge) slide, turn and fold away
  if (tt > 3.9 && tt < 5.7) {
    const q = tt - 3.9, env = Math.sin(clamp01(q / 1.8) * Math.PI), cx = W * 0.5
    for (let i = 0; i < 4; i++) {
      const slide = (i % 2 ? 1 : -1) * Math.sin(q * 1.8) * 10, ci = cx + (i - 1.5) * 27 + slide
      const sx2 = 0.35 + 0.65 * Math.abs(Math.cos(q * 2.4 + i * 0.9)), hw = 14 * sx2 * env, hh2 = 5.6 * env
      if (hw < 1) continue
      const cA = i % 2 ? 0x2a9a9a : 0x4a2a80, cB = i % 2 ? 0x1a6a78 : 0x32205c
      for (let y = y0; y < y0 + LH; y++) for (let x = Math.floor(ci - hw); x <= ci + hw; x++) {
        const d = Math.abs(x + 0.5 - ci) / hw + Math.abs(y + 0.5 - py) / hh2
        if (d <= 1) cv.blendSub(x, y, d > 0.8 ? 0xffa43a : y + 0.5 < py ? cA : cB, 0.95)
      }
    }
  }
  // portal B opens, he walks out; green Time Stone rewind; portal B closes
  const a2 = ease((tt - 5.0) / 0.7) * (1 - ease((tt - 6.9) / 0.6))
  portalL(cv, P2, py, 10 * a2, 5.5 * a2, tt + 1.7, a2 > 0 ? 1 : 0)
  if (tt > 5.95 && tt < 6.9) {
    const q = tt - 5.95
    if (q < 0.4) { lblob(cv, sx + 12, y0 + 6, Math.round(6 + q * 40), 5, 0x5cff90, 0.6 * (1 - q / 0.4)) }
    ringE(cv, sx + 12, y0 + 6, 5 + q * 22, 3 + q * 4, 0x5cff90, 0.7 * (1 - q / 0.95), 0.2)
    for (let g = 1; g <= 3; g++) { const gx = sx + 22 - g * 10 - q * 18, ga = 0.38 * (1 - g * 0.22) * clamp01(1 - q / 0.9) // rewinding afterimages
      if (gx > P2 - 8) cv.hi(strWalk[(g + Math.floor(tt * 12)) & 3]!, gx / 2, fy - 2, { alpha: ga, tint: 0x5cff90, tintAmt: 0.6 }) }
    for (let i = 0; i < 8; i++) { const u = mod(q * 1.4 + i / 8, 1); bs(cv, sx + 22 - u * (sx + 22 - P2), y0 + 3 + (i % 4) * 2, 0x9cffb8, 0.6 * (1 - u)) }
  }
}

// ---- Wanda: halts a missile mid-air in hex ribbons, crushes it, flicks it back ----
const WITL: Pal = { A: 0x9a3a1c, C: 0xff4a6a, S: 0xf4bc98, K: 0x3a1020, T: 0xe0203e, t: 0x8a1030, b: 0x5a1020, a: 0xc0304c, h: 0xf4bc98, L: 0x7a1428, F: 0x4a1020, c: 0x6a1028 }
const WIT_HEAD = ['ACCA', 'ASKS', 'AASS']
POSES.float = { a: [[2, 6], [8, 6]], l: [[3, 9], [5, 9]] }
POSES.windW = { a: [[1, 2], [3, 6]], l: [[3, 9], [5, 9]] }
POSES.both = { a: [[8, 5], [10, 4]], l: [[3, 9], [5, 9]] }
POSES.pull = { a: [[2, 3], [1, 5]], l: [[3, 9], [5, 9]] }
const witFr: Record<string, HiSprite> = {}
for (const k of ['float', 'windW', 'both', 'pull', 'fwd', 'shrug', 'stand']) witFr[k] = mkFig(WIT_HEAD, WITL, k, { cape: 3 })
const witRun = [mkFig(WIT_HEAD, WITL, 'r1', { cape: 3 }), mkFig(WIT_HEAD, WITL, 'r2', { cape: 4 }), mkFig(WIT_HEAD, WITL, 'r3', { cape: 3 }), mkFig(WIT_HEAD, WITL, 'r4', { cape: 4 })]
const MSP: Pal = { R: 0xe0303a, W: 0xc8d0dc, w: 0x8c98ac, K: 0x4a4a62, Y: 0xff9a30, D: 0x2a2a40 }
const missileA = pixmap(['..................KK......', '..RRWWWWWWWWWWWWWWWWKK....', '.RRRWWwwwwwwwwwwwwWWKKKK..', '..RRWWDDDDDDDDDDDDWWKK....', '..................KK......'], MSP)
const missileB = pixmap(['..................KK....', '..RRWWWWWWWWWWWWWWKK....', '.RRRWWwwwwwwwwWWWKKKK...', '..RRWDDDDDDDDDWWWKK.....', '..................KK....'], MSP)
const missileC = pixmap(['.....W..K.....', '.RRWWWwWW.KK..', 'RRWwWWwWWWKKK.', '.RRWWDwWWWKK..', '..R.WW.W.K....'], MSP)
LANES.witch = (cv, y0, t, calm) => {
  LY0 = y0
  const tt = calm ? 3.3 : mod(t, 8), W = cv.W, yb = y0 + LH, fy = figY(y0), WX = Math.round(W * 0.12), M = Math.round(W * 0.5)
  ground(cv, y0)
  const wx = Math.round(kfe(tt, [[0, 10], [1.0, WX]]))
  const floatY = tt < 6.0 ? -1 : 0
  const landed = 0
  let spr: HiSprite = witFr.stand!
  if (tt < 1.6) spr = witFr.float!
  else if (tt < 1.9) spr = witFr.windW! // anticipation
  else if (tt < 2.4) spr = witFr.fwd!
  else if (tt < 4.4) spr = witFr.both!
  else if (tt < 4.7) spr = witFr.pull!
  else if (tt < 6.0) spr = witFr.fwd!
  else if (tt < 6.6) spr = witFr.stand!
  else if (tt < 7.3) spr = Math.floor(tt * 6) & 1 ? witFr.shrug! : witFr.stand!
  else spr = witFr.stand!
  const alpha = 1
  const bob = floatY && !calm ? Math.round(Math.sin(tt * 2.6)) : 0
  const sy = fy + floatY + bob + landed
  const hx = wx + 22, hy = sy + 4
  if (floatY) shadowE(cv, wx + 12, y0, 6, 0.25 + 0.08 * Math.sin(tt * 3))
  else shadowE(cv, wx + 12, y0, 8, 0.3)
  if (alpha > 0.02) cv.hi(spr, wx / 2, sy, { alpha })
  // missile
  const mx = tt < 1.0 ? W + 40 : tt < 2.4 ? kfe(tt, [[1.0, W + 40], [2.4, M]]) : tt < 4.7 ? M : M + (W - 16 - M) * Math.pow(clamp01((tt - 4.7) / 0.7), 2)
  const rattle = tt > 2.4 && tt < 4.6 ? (Math.floor(tt * 24) & 1) * (tt < 3.6 ? 1 : 0) : 0
  const ms = tt < 3.0 || (tt >= 4.7 && false) ? missileA : tt < 3.6 ? missileB : missileC
  if (tt >= 1.0 && tt < 5.45) {
    const mxr = Math.round(mx), myr = y0 + 4 + rattle - (tt > 3.6 ? 0 : 0)
    cv.hi(ms, mxr / 2, myr)
    const tail = mxr + ms.w
    if (tt < 2.4 || tt >= 4.8) { // exhaust and speed lines while it flies
      const L = tt < 2.4 ? 6 + 10 * (1 - ease((tt - 1.0) / 1.4)) : 5
      for (let i = 0; i < L; i++) for (const dyy of [-1, 0, 1]) bs(cv, tail + i, myr + 2 + dyy, i < L / 3 ? 0xffe08a : 0xff8a28, (1 - i / L) * (dyy ? 0.6 : 1))
      speedL(cv, tail + 6, y0, -1, 14, tt >= 4.8 ? 0xff8aa0 : 0xe8ecff)
    }
    if (tt >= 4.8 && tt < 5.45) for (let i = 0; i < 18; i++) bs(cv, mxr + ms.w + 2 + i, y0 + 5 + (i % 3) - 1, 0xff2a50, 0.7 * (1 - i / 18)) // red hex trail
  }
  const hg = 0.4 + 0.25 * Math.sin(tt * 7); lblob(cv, wx + 20, sy + 4, 3, 2, 0xff3a5a, hg * 0.9); lblob(cv, wx + 5, sy + 6, 3, 2, 0xff3a5a, hg * 0.7)
  // ribbons: curved strands from her hand to the missile nose
  if (tt > 1.85 && tt < 4.75) {
    const reach = tt < 2.4 ? ease((tt - 1.85) / 0.55) : 1, nx = M - 2, len = (nx - hx) * reach, squeeze = tt > 3.0 ? clamp01((tt - 3.0) / 1.2) : 0
    for (let m = 0; m < 2; m++) { // two flowing strands, one sub-pixel sine point per column, soft red glow, wisps at the tip
      const sgn = m ? -1 : 1, am = 3.4 * (0.8 + 0.2 * Math.sin(tt * 0.9 + m * 2))
      let ey = hy + 1
      for (let x = 0; x < len; x++) {
        const u = x / (nx - hx), env = Math.min(1, u * 3) * (1 - squeeze * 0.4)
        const y = hy + 1 + Math.sin(x * 0.055 - tt * 3.4 + m * 3.1) * am * env * sgn
        bs(cv, hx + x, y - 1, 0x7a0c28, 0.45); bs(cv, hx + x, y + 1, 0x7a0c28, 0.45)
        bs(cv, hx + x, y, u > 0.85 ? 0xffb0c4 : 0xff4a6e, 1)
        if (x % 6 === 0) lblob(cv, hx + x, Math.round(y), 3, 2, 0xff2a50, 0.16)
        ey = y
      }
      if (len > 8) for (let i = 0; i < 3; i++) { const r = mod(tt * 1.3 + i / 3 + m * 0.3, 1); lplus(cv, hx + len + r * 5, ey + Math.sin(r * 6 + m) * 2 * sgn, 0xff8aa4, 0.9 * (1 - r)) }
    }
    lblob(cv, hx, hy + 1, 5, 3, 0xff2a50, 0.45 + 0.2 * Math.sin(tt * 9))
    ringE(cv, hx + 1, hy + 1, 4, 2.4, 0xff6a88, 0.8, 1.047) // hex rune at the hand
    if (tt > 2.4) { // wrapped rings around the missile
      for (let r = 0; r < 3; r++) { const rxm = ms.w * 0.5 + 2 - squeeze * 4; ringE(cv, M + ms.w * 0.5 - 1 - squeeze * 2, y0 + 6, rxm * (0.45 + 0.15 * r), 4 - r * 0.4 - squeeze, r === 1 ? 0xff9ab0 : 0xe0203e, 0.65, 0.22) }
    }
  }
  if (tt > 2.35 && tt < 2.7) { const q = (tt - 2.35) / 0.35; lblob(cv, M, y0 + 6, Math.round(5 + q * 12), 5, 0xff5a7a, 0.7 * (1 - q)); ringE(cv, M + 3, y0 + 6, 3 + q * 14, 4, 0xffd0dc, 0.8 * (1 - q), 0.2) } // catch flash
  if (tt > 3.0 && tt < 4.6) for (let i = 0; i < 6; i++) { const q = mod(tt * 2 + i * 0.4, 1); lplus(cv, M + 6 + (i * 5) % 18 - 9, y0 + 6 - q * 5 + (i % 2) * 2, i % 2 ? 0xffb040 : 0xff5a28, 1 - q) } // crushed sparks
  if (tt > 4.4 && tt < 4.75) lblob(cv, hx, hy + 1, 7, 4, 0xff2a50, 0.8 * ((tt - 4.4) / 0.35))
  if (tt >= 4.7 && tt < 5.15) { const q = (tt - 4.7) / 0.45; lblob(cv, hx + 3, hy + 1, Math.round(5 + q * 14), 5, 0xff5a7a, 0.8 * (1 - q)); ringE(cv, hx + 3, hy + 1, 3 + q * 16, 4, 0xffd0dc, 0.9 * (1 - q), 0.22) } // hex burst flick
  fireball(cv, W - 12, y0 + 6, tt - 5.4, 9)
  if (tt >= 5.4 && tt < 5.55) lblob(cv, W - 12, y0 + 6, 18, 6, 0xffffff, 0.8) // impact hold flash
  // landing dust + hands dusted off
  if (tt >= 6.0 && tt < 6.7) { const q = (tt - 6.0) / 0.7; for (const d of [-1, 1]) for (let i = 0; i < 4; i++) bs(cv, wx + 12 + d * (4 + q * 10 + i * 2), yb - 1 - (i & 1), 0xb8b8d8, 0.6 * (1 - q)) }
  if (tt > 6.6 && tt < 7.3) for (let i = 0; i < 5; i++) { const q = mod(tt * 2 + i * 0.3, 1); lplus(cv, wx + 20 + i * 2 + q * 4, y0 + 7 - q * 4, 0xff6a88, 0.8 * (1 - q)) }
  if (tt > 7.2) for (let i = 0; i < 8; i++) { const q = clamp01((tt - 7.2) / 0.8); bs(cv, wx + 6 + i * 2, y0 + 10 - q * (4 + (i % 4) * 2), 0xff3e6c, 0.8 * (1 - q)) }
}

// ---- Ant-Man: rides a flying ant, hops off, Pym-pops up to Giant-Man, stomps, shrinks, rides off ----
const ANTL: Pal = { R: 0xd8303a, C: 0x9ffaff, w: 0xc8d0e0, T: 0xd8303a, t: 0x8c1424, b: 0xc8d0e0, a: 0x5a5a7e, h: 0xc8d0e0, L: 0x4a4a6e, F: 0xd8303a }
const ANT_HEAD = ['RRRR', 'RRCC', 'wwww']
const antFr: Record<string, HiSprite> = {}
for (const k of ['stand', 'crouch', 'wave', 'raise', 'leap', 'lunge']) antFr[k] = mkFig(ANT_HEAD, ANTL, k)
const antRun = (['r1', 'r2', 'r3', 'r4'] as const).map(k => mkFig(ANT_HEAD, ANTL, k))
const ANTP: Pal = { k: 0x8a5e46, K: 0xc08a6a, e: 0xff5a4a, l: 0x5a3e30, v: 0xcfeeff }
function antSprite(wing: number, leg: number): HiSprite {
  const g: string[][] = Array.from({ length: 8 }, () => Array<string>(20).fill('.'))
  const ell = (cx: number, cy: number, rx: number, ry: number, c: string) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 20; x++) { const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) g[y]![x] = c } }
  const ln = (x0: number, y0: number, x1: number, y1: number, c: string) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n); if (g[y]?.[x] !== undefined) g[y]![x] = c } }
  ell(4.5, 4.5, 4.5, 1.9, 'k'); ell(10, 4.2, 2.6, 1.8, 'K'); ell(14.5, 4.4, 2.6, 1.8, 'k')
  g[4]![16] = 'e'; ln(15, 3, 18, 2, 'l'); ln(16, 3, 19, 3, 'l')
  const w = [[[9, 3, 6, 0], [10, 3, 13, 0]], [[9, 3, 5, 1], [10, 3, 14, 1]], [[9, 3, 4, 2], [10, 3, 15, 2]]][wing]!
  for (const [a, b, c, d] of w) ln(a!, b!, c!, d!, 'v')
  const legs = leg ? [[8, 5, 6, 7], [10, 5, 10, 7], [12, 5, 15, 7]] : [[8, 5, 5, 7], [10, 5, 11, 7], [12, 5, 14, 7]]
  for (const [a, b, c, d] of legs) ln(a!, b!, c!, d!, 'l')
  return pixmap(g.map(r => r.join('')), ANTP)
}
const antSpr = [antSprite(0, 0), antSprite(1, 1), antSprite(2, 0), antSprite(1, 1)]
const antFly = (cv: Canvas, x: number, yTop: number, tt: number) => { cv.hi(antSpr[Math.floor(tt * 18) & 3]!, x / 2, yTop) }
function pymPop(cv: Canvas, x: number, y: number, q: number, r: number) { // q: 0..1 since the pop
  if (q < 0 || q > 1) return
  if (q < 0.4) { lblob(cv, x, y, Math.round(r * (0.4 + q * 2)), 5, 0x7ff0ff, 0.9 * (1 - q / 0.4)); lblob(cv, x, y, Math.round(r * 0.5), 3, 0xffffff, 0.9 * (1 - q / 0.4)) }
  ringE(cv, x, y, r * 0.5 + q * r * 2.2, 2 + q * 3.5, 0x9ffaff, 0.9 * (1 - q), 0.16)
  for (let i = 0; i < 8; i++) { const a = i * 0.785; lplus(cv, x + Math.cos(a) * (r * 0.4 + q * r * 1.8), y + Math.sin(a) * (2 + q * 4), 0x7ff0ff, 1 - q) }
}
function tinyAt(cv: Canvas, s: HiSprite, x: number, yb: number, k: number) { scaled(cv, s, Math.round(x), yb, k, 1) }
const antK = (cv: Canvas, x: number, yBottom: number, tt: number) => scaled(cv, antSpr[Math.floor(tt * 18) & 3]!, Math.round(x), yBottom, 0.7, 1) // the ant: 14 x 6 subpx
function giantLeg(cv: Canvas, y0: number, lx: number, lift: number, k: number) { // one huge leg + boot, cropped by the top of the lane
  const yb = y0 + LH - lift, wl = Math.max(2, Math.round(10 * k)), bh = Math.max(2, Math.round(4 * k)), bw = Math.round(16 * k)
  for (let y = y0; y < yb - bh; y++) for (let x = 0; x < wl; x++) bs(cv, lx - (wl >> 1) + x, y, x === 0 ? 0x7a7aa0 : x >= wl - 2 ? 0x34344e : 0x4e4e74, 1)
  for (let y = yb - bh; y < yb; y++) {
    const r = y - (yb - bh)
    for (let x = -1; x < bw - (wl >> 1); x++) { if (r === 0 && x < wl) { bs(cv, lx - (wl >> 1) + x, y, 0xc8d0e0, 1); continue } bs(cv, lx - (wl >> 1) + x, y, r === bh - 1 ? 0x8c1424 : x < 1 ? 0xff6a70 : 0xd8303a, 1) }
  }
}
function stompFx(cv: Canvas, x: number, yb: number, age: number) { // dust puff + ground crack for one footfall
  if (age < 0 || age > 1.4) return
  const q = clamp01(age / 0.9)
  for (const d of [-1, 1]) for (let i = 0; i < 5; i++) { bs(cv, x + d * (4 + q * 22 + i * 2), yb - 1 - (i & 1) - (q > 0.4 ? 1 : 0), i & 1 ? 0xa8a8c8 : 0xd0d0e8, 0.8 * (1 - q)); if (q < 0.6) bs(cv, x + d * (3 + q * 14 + i * 2), yb - 3 - (i % 3), 0xb8b8d8, 0.6 * (1 - q)) }
  const cr = clamp01(1 - (age - 0.3) / 1.1)
  for (let i = 0; i < 12; i++) for (const d of [-1, 1]) bs(cv, x + d * (2 + i * 1.5), yb - 1 - ((i * 7 + (d > 0 ? 1 : 0)) % 3 === 0 ? 1 : 0) - (i % 4 === 0 ? 1 : 0), 0x10101e, 0.9 * cr)
}
LANES.antman = (cv, y0, t, calm) => {
  LY0 = y0
  const tt = calm ? 5.0 : mod(t, 8), W = cv.W, yb = y0 + LH, G0 = Math.round(W * 0.3), sxg = G0 + 14
  ground(cv, y0)
  const bob = Math.round(Math.sin(tt * 7))
  // 0..2.0 the ant flies tiny Scott in
  if (tt < 2.0) {
    const ax = Math.round(kfl(tt, [[0, -8], [2.0, G0 - 4]])), ay = y0 + 10 + bob
    shadowE(cv, ax + 7, y0, 5, 0.3); antK(cv, ax, ay, tt)
    tinyAt(cv, antRun[Math.floor(tt * 4) & 3]!, ax + 4, ay - 4, 0.35)
    speedL(cv, ax + 2, y0 + 3, 1, 7, 0xb8c8e8)
  }
  // 2.0..2.5 Scott hops off (arc), the ant buzzes off
  if (tt >= 2.0 && tt < 2.5) { const q = (tt - 2.0) / 0.5; tinyAt(cv, antFr.leap!, G0 + 4 + q * 10, Math.round(yb - 5 - 3 * Math.sin(q * Math.PI) * (1 - q) * 1.6 + q * 5), 0.35) }
  if (tt >= 2.0 && tt < 3.4) { const q = tt - 2.0, ax = Math.round(G0 - 4 + q * q * 60), ay = y0 + 10 - Math.round(Math.min(3, q * 6)); antK(cv, ax, ay, tt); speedL(cv, ax + 2, y0 + 2, 1, 8, 0xb8c8e8) }
  // 2.5..3.3 stand, crouch while Pym particles converge; 3.3 POP (hold)
  if (tt >= 2.5 && tt < 3.35) {
    const crouch = tt > 2.85
    tinyAt(cv, crouch ? antFr.crouch! : antFr.stand!, sxg, yb, 0.35)
    if (crouch) for (let i = 0; i < 10; i++) { const q = mod(tt * 2.2 + i * 0.1, 1), an = i * 0.63 + tt * 4; lplus(cv, sxg + 4 + Math.cos(an) * (1 - q) * 20, y0 + 9 + Math.sin(an) * (1 - q) * 3, 0x7ff0ff, 0.9 * q) }
  }
  if (tt >= 3.3 && tt < 3.45) lblob(cv, sxg + 4, y0 + 7, 16, 6, 0xffffff, 0.8)
  pymPop(cv, sxg + 4, y0 + 7, (tt - 3.3) / 0.9, 18)
  // 3.4..6.0 Giant-Man: only his huge legs and boots, stomping across
  const c1 = Math.min(W - 26, sxg + 120), amp = Math.max(7, Math.min(15, (c1 - sxg) / 8))
  const cxAt = (x: number) => x < 4.2 ? sxg + 4 : sxg + 4 + (c1 - sxg - 4) * clamp01((x - 4.2) / 1.8)
  if (tt >= 3.4 && tt < 6.0) {
    const k = tt < 3.95 ? 0.15 + 0.85 * ease((tt - 3.4) / 0.55) : 1, cx = cxAt(tt)
    if (tt < 4.2) { const off = Math.round(amp * 0.6 * k); giantLeg(cv, y0, Math.round(cx - off), 0, k); giantLeg(cv, y0, Math.round(cx + off), 0, k) }
    else {
      const ph = (tt - 4.2) / 0.9 * 6.2832, c = Math.cos(ph), s = Math.sin(ph)
      giantLeg(cv, y0, Math.round(cx + amp * c), Math.round(Math.max(0, s) * 4), 1)
      giantLeg(cv, y0, Math.round(cx - amp * c), Math.round(Math.max(0, -s) * 4), 1)
    }
  }
  if (tt >= 3.9) { // footfalls: the landing, then one per half-stride
    stompFx(cv, sxg + 4 + 8, yb, tt - 3.95)
    for (let n = 0; n < 4; n++) { const tn = 4.2 + n * 0.45 + 0.45; if (tn < 6.2) stompFx(cv, Math.round(cxAt(tn) + amp + 8), yb, tt - tn) }
  }
  // 6.0 shrink pop, tiny Scott fist-pumps, the ant returns and carries him off
  const cEnd = Math.round(cxAt(6.0)), tx = cEnd - 2
  if (tt >= 6.0) {
    if (tt < 6.12) lblob(cv, cEnd, y0 + 6, 18, 6, 0xffffff, 0.8)
    pymPop(cv, cEnd, y0 + 7, (tt - 6.0) / 0.7, 16)
    if (tt < 6.25) { const k = 1 - 0.85 * ease((tt - 6.0) / 0.25); giantLeg(cv, y0, cEnd - Math.round(amp * 0.6 * k), 0, k); giantLeg(cv, y0, cEnd + Math.round(amp * 0.6 * k), 0, k) }
    if (tt >= 6.25 && tt < 7.3) tinyAt(cv, tt < 6.9 ? (Math.floor(tt * 7) & 1 ? antFr.wave! : antFr.raise!) : antFr.crouch!, tx, yb - (tt > 7.0 ? Math.round(Math.sin(clamp01((tt - 7.0) / 0.25) * Math.PI) * 2) : 0), 0.35)
    if (tt >= 6.7) {
      const ax = Math.round(kfl(tt, [[6.7, -14], [7.2, tx - 4], [7.3, tx - 4], [8.0, W - 40]])), ay = y0 + 10 + (tt < 7.3 ? 0 : bob)
      antK(cv, ax, ay, tt); shadowE(cv, ax + 7, y0, 5, 0.3)
      if (tt >= 7.3) tinyAt(cv, antRun[0]!, ax + 4, ay - 4, 0.35)
      speedL(cv, ax + 2, y0 + 3, 1, 9, 0xb8c8e8)
    }
  }
}

// ---- Deadpool and Wolverine: charge, SNIKT, twin-katana X, fourth wall wave, Wolverine slices the katana ----
const DPL: Pal = { R: 0xd8222e, r: 0x8a1220, B: 0x16121e, W: 0xffffff, T: 0xd8222e, t: 0x8a1220, b: 0x5a3a28, a: 0xc41e2a, h: 0x2a2236, L: 0x3a3048, F: 0x2a2236 }
const DP_HEAD = ['RRRR', 'RBWW', 'rRRr'], DP_FRONT = ['RRRR', 'WBBW', 'rRRr']
const dpFr: Record<string, HiSprite> = {}
for (const k of ['stand', 'crouch', 'leap', 'lunge', 'fwd', 'wave', 'wave2', 'shrug', 'raise']) dpFr[k] = mkFig(DP_HEAD, DPL, k)
dpFr.waveF = mkFig(DP_FRONT, DPL, 'wave'); dpFr.wave2F = mkFig(DP_FRONT, DPL, 'wave2'); dpFr.standF = mkFig(DP_FRONT, DPL, 'stand'); dpFr.shrugF = mkFig(DP_FRONT, DPL, 'shrug')
const dpRun = (['r1', 'r2', 'r3', 'r4'] as const).map(k => mkFig(DP_HEAD, DPL, k))
const WVL: Pal = { B: 0x2a4a9a, Y: 0xf4c818, S: 0xf0b090, K: 0x20202e, T: 0xf4c818, t: 0xb08a10, b: 0x2a4a9a, a: 0xf4c818, h: 0xf0b090, L: 0x2a4a9a, F: 0x20305a }
const WV_HEAD = ['B..B', 'BBSS', 'YYSY']
const wvFr: Record<string, HiSprite> = {}
for (const k of ['stand', 'crouch', 'leap', 'lunge', 'fwd', 'shrug', 'raise']) wvFr[k] = mkFig(WV_HEAD, WVL, k)
const wvRun = (['r1', 'r2', 'r3', 'r4'] as const).map(k => mkFig(WV_HEAD, WVL, k))
const GNP: Pal = { G: 0x7a8a9c, K: 0x10101a, T: 0x56667a, t: 0x3e4a5c, b: 0x2a2a34, a: 0x56667a, h: 0x2a2a34, L: 0x46566a, F: 0x20242c }
const GN_HEAD = ['GGGG', 'GKKK', 'GGGG']
const gnStand = mkFig(GN_HEAD, GNP, 'stand'), gnAir = mkFig(GN_HEAD, GNP, 'leap'), gnFall = mkFig(GN_HEAD, GNP, 'shrug')
function katana(cv: Canvas, x0: number, y0: number, x1: number, y1: number, upto = 1) { // a continuous blade with a bright tip
  lseg(cv, x0, y0, x1, y1, 0xc8d4e8, 1, upto); lseg(cv, x0, y0 + 1, x1, y1 + 1, 0x6a7a98, 0.7, upto)
  lseg(cv, x0 + (x1 - x0) * upto * 0.8, y0 + (y1 - y0) * upto * 0.8, x0 + (x1 - x0) * upto, y0 + (y1 - y0) * upto, 0xffffff, 1)
}
function bang(cv: Canvas, x: number, y: number, q: number, big: number) { // impact starburst
  if (q < 0 || q > 0.6) return
  lblob(cv, x, y, Math.round(big * (0.5 + q)), 5, 0xfff0a0, 0.9 * (1 - q / 0.6))
  for (let i = 0; i < 8; i++) { const a = i * 0.785, r = 3 + q * big * 1.3; lplus(cv, x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 0.6, i % 2 ? 0xffffff : 0xffe060, 1 - q / 0.6) }
}
// Deadpool & Wolverine, back to back. Story (8 s): they walk in back to back; SNIKT, Wolverine's claws pop;
// Deadpool draws both katanas; three goons (one left, two right) charge in; Wolverine rakes three claw marks,
// Deadpool spins and slashes, the goons drop; Deadpool gives the viewer a thumbs-up + heart, Wolverine retracts.
// Both heroes are drawn procedurally, 12 subpx tall (rows 0..11), so every pose is exact.
let GA = 1
const dp = (cv: Canvas, x: number, y: number, c: number, a = 1) => bs(cv, x, y, c, a * GA)
const dline = (cv: Canvas, x0: number, y0: number, x1: number, y1: number, c: number, a = 1, upto = 1) => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n * upto; i++) dp(cv, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a)
}
const dspan = (cv: Canvas, x: number, y: number, a: number, b: number, c: number, d: number) => { for (let i = a; i <= b; i++) dp(cv, x + d * i, y, c) } // dx a..b mirrored by d
const WOP = { Y: 0xf8d020, y: 0xc89a10, B: 0x3558e0, b: 0x1c2c90, K: 0x22222e, S: 0x34344c, F: 0xf0b890, W: 0xffffff, N: 0x7a4020, G: 0xfff0a0 }
const DPQ = { R: 0xe02430, r: 0x9c1420, K: 0x16161e, P: 0x383850, W: 0xffffff, G: 0xe8e8f0 }
const legsAt = (cv: Canvas, cx: number, y0: number, d: number, hips: [number, number], w: number, st: [number, number], top: number, bot: number, boot: number, side?: number) => {
  for (let k = 0; k < 2; k++) for (let r = 8; r <= 11; r++) {
    const sx = Math.round(st[k]! * (r - 8) / 3), c = r >= 10 ? boot : r === 8 && k === 1 ? bot : k === 0 ? top : bot
    for (let i = 0; i < w; i++) dp(cv, cx + d * (hips[k]! + sx + i), y0 + r, side !== undefined && i === 0 && r < 10 ? side : c)
  }
}
const LEGP: [number, number][] = [[3, -3], [1, -1], [-3, 3], [-1, 1]]
const clawsAt = (cv: Canvas, hx: number, hy: number, d: number, ex: number, ey: number, ext: number, tt: number, gleam = true) => {
  // three short adamantium blades out of the knuckles: thin, parallel, a dark row between
  // each so they read as three (not a slab, not a flared trident), silver with a white point
  const n = Math.round(5 * ext)
  for (let o = -1; o <= 1; o++) for (let i = 0; i < n; i++) {
    const y = hy + o * 2 + Math.round(ey * i / 5) - (i >= 3 ? 1 : 0) // tipped up a touch at the end, like a curved claw
    dp(cv, hx + d * (2 + i), y, i === n - 1 ? 0xffffff : 0xb9c6d8)
  }
}
function wolverine(cv: Canvas, cx: number, y0: number, d: number, o: { st: [number, number]; hA: [number, number]; hB: [number, number]; ext: number; ey?: number; tt: number }) {
  const X = (dx: number) => cx + d * dx, T = WOP
  legsAt(cv, cx, y0, d, [-4, 1], 4, o.st, T.B, T.B, T.b, T.b)
  for (let r = 4; r <= 7; r++) { const w = r === 4 ? 6 : 5; for (let i = -w; i <= w; i++) dp(cv, X(i), y0 + r, r === 7 ? (i === 0 ? T.G : T.N) : Math.abs(i) >= 4 ? T.B : Math.abs(i) === 3 && r > 4 ? T.y : T.Y) }
  // cowl: two pointed yellow fins, black crown, big sideburns, face with white eyes
  for (const s of [-1, 1]) { dp(cv, X(5 * s), y0, T.Y); dp(cv, X(4 * s), y0 + 1, T.Y); dp(cv, X(5 * s), y0 + 1, T.Y); dp(cv, X(4 * s), y0, T.y)
    for (let r = 2; r <= 3; r++) { dp(cv, X(4 * s), y0 + r, T.S); dp(cv, X(5 * s), y0 + r, T.K) } dp(cv, X(5 * s), y0 + 4, T.K) }
  dspan(cv, cx, y0 + 1, -3, 3, T.K, d); dp(cv, X(0), y0 + 1, T.Y)
  for (let i = -3; i <= 3; i++) dp(cv, X(i), y0 + 2, Math.abs(i) === 3 ? T.K : Math.abs(i) === 2 ? T.W : T.F)
  for (let i = -3; i <= 3; i++) dp(cv, X(i), y0 + 3, Math.abs(i) === 3 ? T.K : Math.abs(i) <= 1 ? 0xa86a50 : T.F)
  dp(cv, X(1), y0 + 2, 0x22222e); dp(cv, X(-1), y0 + 2, 0x22222e)
  // arms: B (the far one, behind the body line) then A, with 3x3 yellow fists
  for (const [h, sx, sy] of [[o.hB, 3, 5], [o.hA, 4, 4]] as [[number, number], number, number][]) {
    for (let k = 0; k < 2; k++) dline(cv, X(sx) + d * k, y0 + sy, X(h[0] - 1) + d * k, y0 + h[1], k ? T.b : T.B)
    for (let i = 0; i < 3; i++) for (let j = -1; j <= 1; j++) dp(cv, X(h[0] - 1 + i), y0 + h[1] + j, i === 0 ? T.y : T.Y)
    if (o.ext > 0 && h === o.hA) clawsAt(cv, X(h[0] - 1), y0 + h[1], d, 0, o.ey ?? 0, o.ext, o.tt)
  }
}
function katanaD(cv: Canvas, hx: number, hy: number, d: number, ex: number, ey: number, up: number, tt: number) { // blade from the fist, with guard and gleam
  if (up <= 0) return
  const x1 = hx + d * ex * up, y1 = hy + ey * up
  dp(cv, hx - d, hy, 0x7a1018); dp(cv, hx - d, hy + 1, 0x7a1018)
  dp(cv, hx + d, hy - 1, 0xe8b030); dp(cv, hx + d, hy, 0xe8b030); dp(cv, hx + d, hy + 1, 0xe8b030)
  dline(cv, hx + 2 * d, hy, x1, y1, 0xe8f0ff); dp(cv, x1, y1, 0xffffff); dp(cv, x1 + d, y1, 0xffffff)
  if (up >= 1 && (Math.floor(tt * 3) & 1)) dp(cv, hx + 2 * d + Math.round((x1 - hx - 2 * d) * 0.5), hy + Math.round((y1 - hy) * 0.5) - 1, 0xffffff)
}
function deadpoolFig(cv: Canvas, cx: number, y0: number, d: number, o: { st: [number, number]; hF: [number, number]; hB: [number, number]; kat: number; hilts: boolean; tt: number; kF?: [number, number]; kB?: [number, number]; thumb?: boolean; front?: boolean }) {
  const X = (dx: number) => cx + d * dx, T = DPQ
  legsAt(cv, cx, y0, d, [-2, 1], 2, o.st, T.R, T.r, 0x3c3c52)
  for (let r = 4; r <= 7; r++) for (let i = -3; i <= 3; i++) dp(cv, X(i), y0 + r, r === 7 ? (i === 0 ? T.G : 0x2a2a3a) : Math.abs(i) === 3 && r > 4 ? T.P : Math.abs(i) === 2 && r === 6 ? T.r : T.R)
  dspan(cv, cx, y0, -2, 2, T.R, d); dspan(cv, cx, y0 + 1, -3, 3, T.R, d); dspan(cv, cx, y0 + 3, -3, 3, T.r, d); dp(cv, X(0), y0 + 3, T.R)
  for (const s of [-1, 1]) { dp(cv, X(3 * s), y0 + 1, T.K); dp(cv, X(2 * s), y0 + 1, T.K); for (const i of [1, 2, 3]) dp(cv, X(i * s), y0 + 2, T.K); dp(cv, X(2 * s), y0 + 2, T.W); dp(cv, X(3 * s), y0 + 3, T.R) }
  if (o.hilts) for (const s of [-1, 1]) { dline(cv, X(4 * s), y0 + 4, X(6 * s), y0 + 1, 0xc0c0d8); dp(cv, X(6 * s), y0, 0xe02430); dp(cv, X(4 * s), y0 + 3, 0x7a1018) }
  for (const [h, sx] of [[o.hB, -3], [o.hF, 3]] as [[number, number], number][]) {
    dline(cv, X(sx), y0 + 5, X(h[0]), y0 + h[1], T.R); dline(cv, X(sx), y0 + 6, X(h[0]), y0 + h[1] + 1, T.r)
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) dp(cv, X(h[0] + i), y0 + h[1] + j, 0x4a4a62)
  }
  if (o.thumb) { dp(cv, X(o.hF[0]), y0 + o.hF[1] - 1, 0xe8e8f4); dp(cv, X(o.hF[0]), y0 + o.hF[1] - 2, 0xffffff) }
  if (o.kF) katanaD(cv, X(o.hF[0]), y0 + o.hF[1], d, o.kF[0], o.kF[1], o.kat, o.tt)
  if (o.kB) katanaD(cv, X(o.hB[0]), y0 + o.hB[1], d, o.kB[0], o.kB[1], o.kat, o.tt)
}
const GOONS: { suit: number; rim: number; acc: number; hair: number; hrim: number; skin: number; shades: boolean }[] = [
  { suit: 0xb01e30, rim: 0xf06a78, acc: 0x40101c, hair: 0x484862, hrim: 0xa0a0c0, skin: 0xf0c098, shades: false },
  { suit: 0x34344a, rim: 0x8a8aae, acc: 0xe02a38, hair: 0xd8b058, hrim: 0xfff0a0, skin: 0xe8b088, shades: false },
  { suit: 0x7e1626, rim: 0xe0505e, acc: 0x26262e, hair: 0xf0c098, hrim: 0xfff0d8, skin: 0xf0c098, shades: true },
]
function goonFig(cv: Canvas, cx: number, y0: number, d: number, k: number, st: 'run' | 'aim' | 'fall', ph: number, q: number, flash: boolean) {
  const G = GOONS[k]!, X = (dx: number) => cx + d * dx
  if (st === 'fall') { // flat dark-red silhouette lying away from the hero, X eye and two stars
    const a = -d, air = q < 0.22 ? Math.sin(q / 0.22 * Math.PI) * 3 : 0, sl = Math.min(1, q / 0.22) * 6, base = Math.round(y0 + 9 - air)
    const L = (dx: number) => cx + a * (dx - 5 + sl), dk = 0x70162a, hi = 0xb02a40
    for (let i = 0; i <= 10; i++) { dp(cv, L(i), base, i < 3 ? 0x8a1c32 : hi); dp(cv, L(i), base + 1, i < 3 ? 0x7a1a30 : dk); if (i > 2) dp(cv, L(i), base + 2, dk) }
    for (let i = 0; i < 3; i++) dp(cv, L(i), base + 2, 0x5a1020)
    dp(cv, L(1), base + 1, 0xffe8e8); dp(cv, L(0), base + 2, 0xffe8e8); dp(cv, L(2), base + 2, 0xffe8e8)
    if (q > 0.22) { const k = Math.floor(q * 6) & 1; dp(cv, L(0 + k), y0 + 7, 0xffe060); dp(cv, L(2 - k), y0 + 6, 0xffe060) }
    return
  }
  const sw = LEGP[ph & 3]!
  for (let kk = 0; kk < 2; kk++) for (let r = 8; r <= 11; r++) { const sx = st === 'run' ? Math.round(sw[kk]! * (r - 8) / 3) : 0; for (let i = 0; i < 2; i++) dp(cv, X((kk ? 1 : -2) + sx + i), y0 + r, r >= 10 ? 0x1e1e2a : kk && i === 1 ? G.rim : G.suit) }
  for (let r = 4; r <= 7; r++) for (let i = -3; i <= 3; i++) dp(cv, X(i), y0 + r, r === 4 ? G.rim : r === 7 ? 0x20202c : Math.abs(i) <= 1 && r < 7 ? G.acc : G.suit)
  for (let i = -2; i <= 2; i++) { dp(cv, X(i), y0 + 1, G.hair); dp(cv, X(i), y0 + 2, G.skin); dp(cv, X(i), y0 + 3, G.skin) }
  dp(cv, X(-2), y0, G.hrim); dp(cv, X(2), y0 + 1, G.hrim); dp(cv, X(-1), y0 + 1, G.hrim)
  if (G.shades) for (let i = -2; i <= 2; i++) dp(cv, X(i), y0 + 2, 0x101018); else { dp(cv, X(1), y0 + 2, 0x16161e); dp(cv, X(-1), y0 + 2, 0x16161e); dp(cv, X(1), y0 + 1, 0x16161e) }
  dp(cv, X(0), y0 + 3, 0xa86a50)
  dline(cv, X(3), y0 + 5, X(5), y0 + 6, G.suit) // arm and gun
  for (let i = 5; i <= 11; i++) dp(cv, X(i), y0 + 6, i < 8 ? 0x70708c : 0xb0b0cc)
  for (let i = 5; i <= 7; i++) dp(cv, X(i), y0 + 7, 0x44445a)
  if (flash) { dp(cv, X(12), y0 + 6, 0xfff0a0); dp(cv, X(13), y0 + 6, 0xffb030); dp(cv, X(12), y0 + 5, 0xffd060); dp(cv, X(12), y0 + 7, 0xffd060) }
}
const HEART2 = ['.X.X.', 'XXXXX', '.XXX.', '..X..']
LANES.deadpool = (cv, y0, t, calm) => {
  LY0 = y0
  const tt = calm ? 5.45 : mod(t, 8), W = cv.W
  ground(cv, y0)
  const C = Math.round(W * 0.46), WX0 = C - 8, DX0 = C + 9
  const fade = kfl(tt, [[7.3, 1], [7.95, 0]]); GA = fade
  const walking = tt < 1.8, ph = Math.floor(tt * 9) & 3, st = LEGP[ph]!, nst: [number, number] = [0, 0]
  const px = tt < 1.8 ? kfl(tt, [[0, -16], [1.5, -3], [1.8, 0]]) : 0 // pair offset (x) while walking in (ends at 0)
  const sw = walking ? (ph & 1 ? 1 : -1) : 0
  // ---- Wolverine (faces left) ----
  const q5 = tt - 5.0
  const lungeW = Math.round(kfl(tt, [[5.0, 0], [5.15, 0], [5.3, 6], [5.9, 3], [6.3, 0]]))
  const wcx = WX0 + px - lungeW
  let hA: [number, number] = [5, 8], hB: [number, number] = [-5, 8], ext = 0, ey = 0
  if (walking) { hA = [4 + sw, 8]; hB = [-4 - sw, 8] }
  else if (tt >= 2.5 && tt < 2.7) { hA = [6, 6]; hB = [6, 9] } // anticipation: fists up
  else if (tt >= 2.7 && tt < 5.0) { hA = [10, 3]; hB = [-5, 8]; ext = Math.min(1, (tt - 2.7) / 0.08) }
  else if (tt >= 5.0 && tt < 6.2) {
    hA = [Math.round(kfl(tt, [[5.0, 7], [5.15, 6], [5.35, 12], [5.9, 10]])), Math.round(kfl(tt, [[5.0, 4], [5.15, 3], [5.35, 9], [5.9, 4]]))]
    hB = [-5, 8]; ext = 1; ey = kfl(tt, [[5.0, -1], [5.15, -4], [5.35, 3], [5.9, 0]])
  } else if (tt >= 6.2) { hA = [10, 3]; hB = [-5, 8]; ext = 1 - clamp01((tt - 6.2) / 0.3); if (ext <= 0) { hA = [5, 8]; hB = [-5, 8] } }
  wolverine(cv, wcx, y0, -1, { st: walking ? st : nst, hA, hB, ext, ey, tt })
  // ---- Deadpool (faces right) ----
  const lungeD = Math.round(kfl(tt, [[5.0, 0], [5.25, 8], [5.6, 8], [6.1, 0]]))
  const dcx = DX0 + px + lungeD
  let hF: [number, number] = [4, 8], hBk: [number, number] = [-4, 8], kat = 0, kF: [number, number] = [11, -2], kB: [number, number] = [11, 2], hilts = true, thumb = false, dd = 1
  if (walking) { hF = [3 + sw, 8]; hBk = [-3 - sw, 8] }
  if (tt >= 3.2 && tt < 3.45) { hF = [4, 2]; hBk = [-4, 2]; kat = 0; hilts = tt < 3.3 }
  else if (tt >= 3.45 && tt < 6.1) {
    hilts = false; kat = clamp01((tt - 3.45) / 0.12)
    const f = clamp01((tt - 3.45) / 0.3); hF = [Math.round(4 + 2 * f), Math.round(2 + 3 * f)]; hBk = [Math.round(-4 + 9 * f), Math.round(2 + 5 * f)]
    if (tt >= 3.45 && tt < 3.7) { kF = [11, -2]; kB = [11, 2] }
    if (tt >= 6.0) kat = 1 - clamp01((tt - 6.0) / 0.1)
  }
  const spinning = tt >= 5.0 && tt < 5.6
  if (spinning) { const sp = Math.floor((tt - 5.0) * 16) & 3; dd = sp === 2 ? -1 : 1; if (sp & 1) { hF = [2, 7]; hBk = [-2, 7]; kat = 0 } else kat = 0 }
  if (tt >= 6.1) { hilts = tt >= 6.3; hF = [6, 4]; hBk = [3, 7]; thumb = true; kat = 0 }
  const kFp = kF, kBp = kB
  shadowE(cv, wcx, y0, 8, 0.28 * GA); shadowE(cv, dcx, y0, 6, 0.28 * GA)
  deadpoolFig(cv, dcx, y0, dd, { st: walking ? [-st[0], -st[1]] : nst, hF, hB: hBk, kat: spinning ? 0 : kat, hilts, tt, kF: kFp, kB: kBp, thumb })
  // flourish gleam when the swords come out
  if (tt >= 3.55 && tt < 3.95) { const k = (tt - 3.55) / 0.4; lplus(cv, dcx + 17, y0 + 3, 0xffffff, 1 - k); lplus(cv, dcx + 17, y0 + 8, 0xffffff, 1 - k) }
  // SNIKT: the claws pop with a bright burst
  if (tt >= 2.7 && tt < 3.2) {
    const q = tt - 2.7, f = 1 - q / 0.5
    for (const sy of [3, 5, 7, 9, 11]) if (q < 0.2) dp(cv, wcx - 8 - 11, y0 + sy - 1, 0xffffff, f)
    lplus(cv, wcx - 20, y0 + 3, 0xffffff, f); lplus(cv, wcx - 18, y0 + 9, 0xffffff, f)
  }
  // spin: ONE crisp 1-subpx white arc around Deadpool (two quick sweeps)
  if (spinning) {
    const q = tt - 5.0, th = q * 6.283 * 2
    for (let tr = 0; tr < 18; tr++) { const a = th - tr * 0.1, b = a - 0.1; dline(cv, dcx + Math.cos(a) * 20, y0 + 6 + Math.sin(a) * 4, dcx + Math.cos(b) * 20, y0 + 6 + Math.sin(b) * 4, 0xffffff, 1) }
  }
  // ---- the goons ----
  const gTarget: number[] = [C - 29, C + 28, C + 40], gStart: number[] = [-14, W + 14, W + 30], gT0: number[] = [3.5, 3.6, 3.75], fallAt: number[] = [5.3, 5.3, 5.45]
  for (let i = 0; i < 3; i++) {
    const d = i === 0 ? 1 : -1, t0 = gT0[i]!, gx = Math.round(kfl(tt, [[t0, gStart[i]!], [4.95, gTarget[i]!]])), fa = tt - fallAt[i]!
    if (tt < t0) continue
    const gaf = i === 0 ? GA : GA * clamp01(1 - (tt - 6.9) / 0.5), saved = GA; GA = tt > 6.9 ? Math.min(GA, clamp01(1 - (tt - 6.9) / 0.5)) : GA; void gaf
    if (fa < 0) { const run = tt < 4.95; goonFig(cv, gx, y0, d, i, run ? 'run' : 'aim', Math.floor(tt * 10 + i), 0, !run && tt < 5.08 && (Math.floor(tt * 25) & 1) === 0 || (run && tt > 4.4 && (Math.floor(tt * 7 + i) % 4) === 0)) }
    else goonFig(cv, gx, y0, d, i, 'fall', 0, fa, false)
    if (tt < 4.95) shadowE(cv, gx, y0, 5, 0.22 * GA)
    GA = saved
  }
  // ---- the hits: Wolverine's three thin white claw marks, a one-frame flash on each goon ----
  const gl = C - 29
  if (tt >= 5.2 && tt < 5.5) {
    const q = tt - 5.2, p = clamp01(q / 0.08)
    for (let j = 0; j < 3; j++) dline(cv, gl + 5 + j * 3, y0 + 1, gl - 4 + j * 3, y0 + 10, 0xffffff, 1, p)
  }
  for (let i = 0; i < 3; i++) { const q = tt - fallAt[i]!; if (q > 0 && q < 0.12) lplus(cv, gTarget[i]!, y0 + 6, 0xffffff, 1 - q / 0.12) }
  // ---- finale: a heart for the viewer, a glint on the retracted claws ----
  if (tt >= 6.2 && tt < 7.5) {
    const q = tt - 6.2, hx = dcx + 11, hy = Math.round(y0 + 6 - clamp01(q / 0.9) * 5)
    if (q > 0.1) HEART2.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === 'X') dp(cv, hx + i, hy + j, j === 0 && (i === 1) ? 0xffa0b8 : 0xff4a78, clamp01(1 - (q - 0.8) / 0.4)) })
    if (q > 0.0 && q < 0.35) lplus(cv, dcx + 6 * dd, y0 + 2, 0xffffff, 1 - q / 0.35)
    if (tt >= 6.45 && tt < 6.75) { const k = (tt - 6.45) / 0.3; lplus(cv, wcx - 14, y0 + 5, 0xffffff, 1 - k); lblob(cv, wcx - 8, y0 + 5, 7, 4, 0xbcd0ff, 0.5 * (1 - k)) }
  }
  GA = 1
}

// ---- Fury: the Infinity War pager. He dusts away from the feet up, the pager calls Captain Marvel ----
const FUL: Pal = { S: 0xb87a50, H: 0xe8b488, D: 0x2a1812, W: 0xf4ece4, E: 0x14100c, P: 0x000000, G: 0x2c2024, T: 0x1e1e2c, t: 0x14141f, b: 0x0e0e16, a: 0x1e1e2c, h: 0x9a6240, L: 0x1a1a28, F: 0x0c0c14, C: 0x1e1e2c }
const FU_HEAD = ['SHHS', 'SSDD', 'SPWE', 'SGGS']
const fuWalk = (['r1', 'r2', 'r3', 'r4'] as const).map(k => mkFig(FU_HEAD, FUL, k, { coat: 2 }))
const fuStand = mkFig(FU_HEAD, FUL, 'stand', { coat: 2 }), fuHold = mkFig(FU_HEAD, FUL, 'fwd', { coat: 2 })
function dissolve(cv: Canvas, s: HiSprite, xs: number, ys: number, prog: number, seed: number) {
  const w = s.w, h = s.h
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const si = j * w + i
    if (!s.a[si]) continue
    const hs = hash(si + seed), th = ((h - 1 - j) + hs * 3) / (h + 3), c = s.px[si]!
    if (prog <= th) { bs(cv, xs + i, ys + j, c, 1); continue }
    const d = (prog - th) * 2.2, a = 1 - d
    if (a <= 0.04) continue
    bs(cv, xs + i + d * (14 + hs * 22), ys + j - d * (3 + hash(si + 7) * 9) + d * d * 2, lerpC(c, 0xb4b4cc, Math.min(1, d * 2)), a)
  }
}
function pager(cv: Canvas, x: number, y: number, led: number, lit: number) { // 5x3 subpx pager; led colour, lit 0..1
  for (let i = 0; i < 5; i++) { bs(cv, x + i, y, 0x8a8aa8, 1); bs(cv, x + i, y + 1, i > 0 && i < 4 ? lerpC(0x20304a, 0x7ad0ff, lit) : 0x6a6a88, 1); bs(cv, x + i, y + 2, 0x56567a, 1) }
  bs(cv, x + 4, y - 1, led, lit > 0.2 ? 1 : 0.4)
}
const HILP: Pal = { H: 0x2a2a40, S: 0x6a5a70, T: 0x3a3e64, t: 0x2a2e50, b: 0x22243c, a: 0x3a3e64, h: 0x6a5a70, L: 0x2c3050, F: 0x1a1c30, C: 0x3a3e64 }
const hillS = mkFig(['HHHH', 'HSSS', 'HSSH'], HILP, 'stand', { coat: 1 })
const STARC = [0xffd040, 0xe03a3a, 0x3a6aff, 0xffd040, 0xe03a3a, 0x3a6aff, 0xffd040, 0xe03a3a]
const FU_NOD = mkFig(FU_HEAD, FUL, 'stand', { coat: 2, dy: 1 })
// Fury (Infinity War post-credits): walks in, raises the pager, it beeps, the Captain Marvel star forms, a comet streaks off, he lowers it and nods
const rimSprite = (s: HiSprite): HiSprite => { // 1-subpx light rim round a dark figure, padded by 1 each side
  const w = s.w + 2, px = new Int32Array(w * s.h), a = new Uint8Array(w * s.h), on = (x: number, y: number) => x >= 0 && x < s.w && y >= 0 && y < s.h && s.a[y * s.w + x]! > 0
  for (let y = 0; y < s.h; y++) for (let x = -1; x <= s.w; x++) {
    const i = y * w + x + 1
    if (on(x, y)) { px[i] = s.px[y * s.w + x]!; a[i] = 255 } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) { px[i] = 0x6a72b8; a[i] = 255 }
  }
  return { w, h: s.h, px, a }
}
const fuRW = fuWalk.map(rimSprite), fuRS = rimSprite(fuStand), fuRH = rimSprite(fuHold), fuRN = rimSprite(FU_NOD)
function pagerBox(cv: Canvas, x: number, y: number, lit: number) { // small dark box, bright green-amber screen
  if (lit > 0.1) lblob(cv, x + 3, y + 2, 7, 4, 0xc8ff50, 0.35 * lit)
  for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) {
    const edge = i === 0 || i === 6 || j === 0 || j === 4
    bs(cv, x + i, y + j, edge ? 0x9a9ab4 : j === 3 ? 0x4a4a60 : lerpC(0x303a20, i < 4 ? 0xb8ff60 : 0xffc040, lit), 1)
  }
  bs(cv, x + 6, y - 1, 0xff4a4a, lit > 0.5 ? 1 : 0.3)
}
function starCM(cv: Canvas, sx: number, sy: number, r: number, f: number) { // clean 8-point star, ~8 subpx tall, centre gold, cardinal points red, diagonals blue
  const R = Math.round(4 * r)
  if (R < 1) return
  for (let k = 1; k <= R; k++) { // cardinals: red, 2 wide horizontally
    for (const s of [-1, 1]) { bs(cv, sx, sy + s * k, 0xe03a3a, f); bs(cv, sx + 1, sy + s * k, 0xe03a3a, f) }
    for (const s of [-1, 1]) for (let q = 0; q < 2; q++) { bs(cv, sx + s * (k * 2 + q) + (s > 0 ? 1 : 0), sy, 0xe03a3a, f) }
  }
  for (let k = 1; k <= Math.round(R * 0.6); k++) for (const sy2 of [-1, 1]) for (const sx2 of [-1, 1]) { bs(cv, sx + sx2 * k * 3 + (sx2 > 0 ? 1 : 0), sy + sy2 * k, 0x3a6aff, f); bs(cv, sx + sx2 * k * 3 + (sx2 > 0 ? 1 : 0) + sx2, sy + sy2 * k, 0x3a6aff, f) }
  for (let j = -1; j <= 1; j++) for (let i = -2; i <= 3; i++) if (Math.abs(j) + Math.abs(i - 0.5) < 2.6) bs(cv, sx + i, sy + j, j === 0 ? 0xfff0a0 : 0xffd040, f)
}
LANES.fury = (cv, y0, t, calm) => {
  LY0 = y0
  const tt = calm ? 5.2 : mod(t, 8), W = cv.W, yb = y0 + LH, fy = figY(y0) - 1, FX = Math.round(W * 0.14)
  ground(cv, y0)
  const walking = tt < 1.2
  const fx = Math.round(kfe(tt, [[0, -16], [1.2, FX]]))
  const holding = tt >= 2.0 && tt < 5.8, nod = tt >= 6.1 && tt < 7.5 && Math.floor((tt - 6.1) / 0.35) % 2 === 0
  const spr = walking ? fuRW[Math.floor(tt * 5) & 3]! : holding ? fuRH : nod ? fuRN : fuRS
  shadowE(cv, fx + 11, y0, 8, 0.4)
  if (walking) skid(cv, fx + 4, yb, 1, tt, 2)
  cv.hi(spr, (fx - 1) / 2, fy)
  const px0 = fx + 27, py0 = y0 + 2 // held out at arm's length, clear of the body
  if (holding) {
    const lit = tt < 2.8 ? 0.15 : Math.floor((tt - 2.8) / 0.4) & 1 ? 0.35 : 1
    pagerBox(cv, px0, py0, tt < 4.4 ? lit : 0.8)
    if (tt >= 2.8 && tt < 4.4) for (let k = 0; k < 2; k++) { // thin clean arcs, only to the right
      const r = mod((tt - 2.8) * 1.25 + k / 2, 1), rx = 5 + r * 34, ry = 2 + r * 3.5
      for (let an = -1.15; an <= 1.15; an += 0.09) bs(cv, px0 + 6 + Math.cos(an) * rx, py0 + 2 + Math.sin(an) * ry, 0xc8ff60, 0.9 * (1 - r))
    }
  }
  // the Captain Marvel star: forms to the right, holds
  const sx = px0 + 40, sy = y0 + 6
  if (tt >= 4.4 && tt < 5.9) {
    const q = tt - 4.4, r = ease(q / 0.45), f = q > 1.3 ? clamp01(1 - (q - 1.3) / 0.2) : 1
    lblob(cv, sx + 1, sy, 12, 5, 0xffd040, 0.25 * f)
    starCM(cv, sx, sy, r, f)
  }
  // fiery comet from the star to the right edge
  if (tt >= 5.8 && tt < 7.4) {
    const hxx = kfl(tt, [[5.8, sx + 2], [7.4, W + 100]]), hy = kfl(tt, [[5.8, sy], [7.4, y0 + 4]])
    for (let i = 0; i < 90; i++) { const u = i / 90, th = Math.round(2 * (1 - u)), x = hxx - i * 1.4
      if (x < sx - 6) break
      for (let j = -th; j <= th; j++) bs(cv, x, hy + j + (i * 0.04), lerpC(0xff9a20, 0xe03a1a, Math.min(1, u * 1.5)), (1 - u) * (j === 0 ? 1 : 0.6)) }
    for (let j = -2; j <= 2; j++) for (let i = -4; i <= 2; i++) if (Math.abs(j) * 2 + Math.abs(i) <= 5) bs(cv, hxx + i, hy + j, Math.abs(i) < 2 && Math.abs(j) < 2 ? 0xfff6c0 : 0xffd040, 1)
  }
}

// ---- The Avengers: six heroes run in and line up, a flash, a glint ----
const TPL = ['..hhhhh..', '.hhfffhh.', '.hfefefh.', '..hfffh..', '.bbbcbbb.', 'bbbbcbbbb', 'bb.bcb.bb', 'fb.bbb.bf', '..lllll..', '..ll.ll..', '..ll.ll..', '..ss.ss..']
const TPLB = [...TPL.slice(0, 8), '..lllll..', '...lll...', '...lll...', '...sss...']
const HERO_PAL: Pal[] = [
  { h: 0xd02a2a, f: 0xf4c040, e: 0x9ff0ff, b: 0xd02a2a, c: 0x9ff0ff, l: 0xd02a2a, s: 0xf4c040 },
  { h: 0x2c52c0, f: 0xf0b090, e: 0x20204a, b: 0x2c52c0, c: 0xf0f0f0, l: 0x2c52c0, s: 0xd02a2a },
  { h: 0xf4d060, f: 0xf0b090, e: 0x3040a0, b: 0x6a7a9a, c: 0xd02a2a, l: 0x4a4a62, s: 0x8a5a2a },
  { h: 0x2a6a32, f: 0x4ac05a, e: 0xffffff, b: 0x4ac05a, c: 0x3a9048, l: 0x7a4ab0, s: 0x7a4ab0 },
  { h: 0xc03a1a, f: 0xf0b090, e: 0x20204a, b: 0x4a4a62, c: 0xe0233a, l: 0x4a4a62, s: 0x6a6a84 },
  { h: 0x7a4ab0, f: 0xf0b090, e: 0x20204a, b: 0x7a4ab0, c: 0xa078d0, l: 0x5a3a88, s: 0x4a4a62 },
]
const HSP = HERO_PAL.map(p => [sp2(TPL, p, 9), sp2(TPLB, p, 9)] as const)
LANES.assemble = (cv, y0, t, calm) => {
  const tt = calm ? 3.2 : t % 7.5, W = cv.W, cx = Math.floor(W / 2), yb = y0 + LH
  ground(cv, y0)
  const fade = tt > 7 ? 1 - (tt - 7) / 0.5 : 1, ch = Math.max(0, tt - 3.8)
  HSP.forEach((fr, i) => {
    const slot = cx + (i - 2.5) * 26 - 9, start = -30 - i * 6, p = Math.min(1, Math.max(0, (tt - i * 0.22) / 2.4)), e = 1 - Math.pow(1 - p, 2)
    const x = Math.round(start + (slot - start) * e + ch * ch * 38 + ch * 20), running = p < 1 || ch > 0
    const fi = running && Math.floor(tt * 9 + i) % 2 ? 1 : 0
    cv.hi(fr[fi]!, x / 2, y0, { alpha: fade })
    if (running) dust(cv, x + 4, yb, tt)
    if (ch > 0.3) for (let k = 0; k < 2; k++) for (let l = 0; l < 7 + (i % 3) * 3; l++) cv.blendSub(x - 2 - l - k * 3, y0 + 3 + ((i * 3 + k * 4) % 7), 0xe8ecff, 0.5 * (1 - l / 12))
  })
  if (tt > 2.9 && tt < 3.6) { const f = (tt - 2.9) / 0.7; blob(cv, cx, y0 + 6, Math.round(20 + 90 * f), 6, 0xf4c040, 0.4 * (1 - f)) }
  if (tt > 3.0 && tt < 3.8) { const gx = Math.round(cx - 40 + (tt - 3) * 100); for (let j = 0; j < LH; j++) cv.glowSub(gx + Math.round((LH - j) * 0.4), y0 + j, 0xffffff, 0.22) }
}

