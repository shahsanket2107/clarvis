// Hand-drawn pixel art for some of the heroes (see ../portraits.ts for the format).
// Portraits are drawn as the right half of a symmetric face (right-aligned to the centre line) and mirrored.
import { pixmap, type LaneArt, type StageArt } from './pixmap'
import type { Canvas } from '../pixel'
export const STAGES: Partial<Record<string, StageArt>> = {}
export const LANES: Partial<Record<string, LaneArt>> = {}

const SW = 36
// halves: 14 rows, each the left half ending at the centre; '|' prefix = full row (36 wide)
function mirror(halves: string[]): string[] {
  return halves.map(r => {
    if (r[0] === '|') return r.slice(1).padEnd(SW, '.')
    const h = r.padStart(SW / 2, '.').slice(-SW / 2)
    return h + [...h].reverse().join('')
  })
}
type Pal = Record<string, number>
// A pulse of light around a subpixel (no allocation).
function pulse(cv: Canvas, xs: number, y: number, c: number, a: number) {
  const g = (x: number, yy: number, al: number) => { if (yy >= 0 && yy < 14 && x >= 0 && x < SW) cv.glowSub(x, yy, c, al) }
  g(xs, y, a); g(xs - 1, y, a * 0.45); g(xs + 1, y, a * 0.45); g(xs, y - 1, a * 0.35); g(xs, y + 1, a * 0.35)
}
interface Hero { rows: string[]; pal: Pal; blink?: [string, string]; glow: [number, number][]; gc: number; dx?: number; edit?: (rows: string[]) => string[]; squint?: (rows: string[]) => string[]; squintAt?: (t: number) => boolean; extra?: (cv: Canvas, t: number, calm: boolean) => void }
function stage(h: Hero): StageArt {
  const rows = h.edit ? h.edit(h.rows) : h.rows
  const open = pixmap(rows, h.pal)
  const shut = h.blink ? pixmap(rows.map(r => r.split(h.blink![0]).join(h.blink![1])), h.pal) : open
  const sq = h.squint ? pixmap(h.squint(rows), h.pal) : null
  const blank = '.'.repeat(SW)
  const bot = pixmap(rows.map((r, i) => i >= 11 ? r : blank), h.pal) // the shoulder rows, redrawn 1 px higher to breathe
  const dx = h.dx ?? 0
  return (cv, t, calm) => {
    const tt = calm ? 0 : t
    const ph = tt % 3.4
    let f = open
    if (!calm) {
      if (h.blink && ph > 3.2 && ph < 3.3) f = shut
      else if (sq && ph > 3.14 && ph < 3.36) f = sq
      else if (sq && h.squintAt && h.squintAt(tt)) f = sq
    }
    cv.hi(f, dx, 0)
    if (!calm && Math.sin(tt * 1.7) > 0.5) cv.hi(bot, dx, -1)
    if (f === open || f === sq) {
      const a = 0.28 + 0.2 * Math.sin(tt * 2.6)
      for (const [x, y] of h.glow) pulse(cv, x + dx * 2, y, h.gc, a)
    }
    h.extra?.(cv, tt, calm)
  }
}
// lane: a small sprite crossing the width, with an optional trail
function lane(rows: string[], pal: Pal, o: { speed: number; bob?: number; trail?: number; flip?: boolean }): LaneArt {
  const s = pixmap(rows, pal)
  return (cv, y0, t, calm) => {
    const span = cv.W + s.w * 2
    const x = calm ? (cv.W - s.w) / 2 : ((t * o.speed) % span) - s.w
    const y = y0 + (o.bob && !calm ? Math.round(Math.sin(t * 3) * o.bob) : 0)
    if (o.trail !== undefined) for (let i = 1; i <= 6; i++) cv.glowSub(x - i * 2 + (o.flip ? s.w + i * 4 : 0), y0 + 4, o.trail, 0.5 / i)
    cv.hi(s, x / 2, y, { flip: o.flip })
  }
}

// ---------------------------------------------------------------- IRON MAN
const IM: Pal = { o: 0x3a0a14, r: 0xc41e2c, R: 0xf2503c, d: 0x7e1022, g: 0xf4b830, G: 0xffe69a, y: 0xb27418, e: 0xf0ffff, k: 0x16101e }
STAGES.ironman = stage({
  pal: IM, gc: 0x9ff0ff, glow: [[10, 6], [11, 6], [12, 6], [13, 6], [22, 6], [23, 6], [24, 6], [25, 6]], blink: ['e', 'y'],
  rows: mirror([
    'oooooooo',
    'oorrRRRRRR',
    'orrRRrrrrrr',
    'orrrrrrrrrrr',
    'orrgGGGggggg',
    'orgGGGGgggGg',
    'ogeeeeeegggG',
    'ogyyyyyyyggg',
    'ogGggggggGyy',
    'oggyggyggyyy',
    'ooggGgyyyy',
    '..oorrrrrrooyyyy',
    '.orrRRrrrrrdddddoo',
    'orrrrrrrrrrdddddddd',
  ]),
  extra: (cv, t, calm) => {
    const u = calm ? 0.5 : ((t % 3) - 2.2) / 0.7
    if (u >= 0 && u <= 1) for (let k = 0; k < 6; k++) { const x = 9 + Math.round(u * 18) + (k >> 1), y = 4 + k; if (x >= 8 && x < 28) cv.glowSub(x, y, 0xffffff, 0.55) }
  },
})

// ---------------------------------------------------------------- CAPTAIN AMERICA
const CA: Pal = { o: 0x0a1446, b: 0x2c4cbc, B: 0x5a86ea, d: 0x182a84, w: 0xf6f6ff, s: 0xf2b88e, S: 0xc88862, e: 0xf2f6ff, i: 0x2a5ad0, r: 0xc41f2e, n: 0x7a4a36 }
STAGES.cap = stage({
  pal: CA, gc: 0xffffff, glow: [[28, 2]], blink: ['e', 's'],
  rows: mirror([
    'oooooooo',
    'oobbBBBBBw',
    'owwbBBbbbww',
    'owwwbbbbbwww',
    'obwwbbbbbbwb',
    'obbbbbbbbbbb',
    'obbddddddddd',
    'obbsseeiisss',
    'obbbsssssssS',
    '.obbsssssSnn',
    '.obbssssssss',
    '..obbsssSSnn',
    '.oobbbbbbbwwwwww',
    'obbBBbbbbbwwBBBB',
  ]),
  extra: (cv, t, calm) => {
    const u = calm ? 0.5 : ((t % 3.6) - 2.9) / 0.6
    if (u >= 0 && u <= 1) for (let k = 0; k < 4; k++) cv.glowSub(10 + Math.round(u * 16) + (k >> 1), 1 + k, 0xffffff, 0.7)
  },
})

// ---------------------------------------------------------------- THOR
const TH: Pal = { o: 0x2a1608, y: 0xf0be3c, Y: 0xffe58a, h: 0xb07a20, s: 0xdce2f0, S: 0x8892b8, k: 0xf4bc92, K: 0xc88a68, e: 0x58d4ff, c: 0xc41e2c, l: 0xcdeeff }
STAGES.thor = stage({
  pal: TH, gc: 0x9fe4ff, glow: [[13, 5], [14, 5], [21, 5], [22, 5]], blink: ['e', 'k'],
  rows: mirror([
    '..ss....oooooo',
    '.sSSs.osssssss',
    'sSSSsosssssSss',
    '.SSsoysssssSss',
    '..oyyYyykkkkkk',
    '..oyyyykkkkkkk',
    '..oyyykeekkkkk',
    '..oyyykkkkkkKK',
    '..oyyyhkkkhhhh',
    '..oyyyhhhhhhhh',
    '...oyyyhhhhhhh',
    '...oyyyyyhhhhh',
    '..oyyccccccsss',
    '.oyyycccccssSS',
  ]),
  extra: (cv, t, calm) => {
    const k = Math.floor(t * 3) % 4
    for (const [x, y] of [[3, 7], [2, 8], [3, 9], [32, 7], [33, 8], [32, 9]] as const) if ((x + y + k) % 4 === 0) cv.glowSub(x, y, 0xbfeaff, 0.8)
    const fl = calm ? 0 : Math.max(0, Math.sin(t * 2.6 - 1.6)) ** 6
    for (const x of [13, 14, 21, 22]) { cv.glowSub(x, 5, 0x58d4ff, 0.8 * fl); cv.glowSub(x, 4, 0xbfeaff, 0.35 * fl) }
  },
})

// ---------------------------------------------------------------- HULK
const HK: Pal = { o: 0x0c2410, g: 0x38a038, G: 0x68cc48, d: 0x1c6428, h: 0x1a1030, H: 0x3c2a5c, e: 0xe8ff80, t: 0xf0f4d8, m: 0x3a101c, p: 0x7a3aa8, q: 0x1a0a14 }
STAGES.hulk = stage({
  pal: HK, gc: 0xc8ff60, glow: [[13, 6], [14, 6], [21, 6], [22, 6]], blink: ['e', 'd'],
  squint: rows => rows.map((r, i) => i === 6 ? r.replace(/e+/g, m => 'd' + m.slice(1, -1) + 'd') : r), squintAt: t => (t % 4) > 2.9 && (t % 4) < 3.9,
  rows: mirror([
    '...oooooooooooo',
    '..ohhHhhhhhhhhh',
    '.ohhhhhhhhhhhhh',
    '.oogggGGGggggggg',
    '.ogggggggggddddd',
    '.oggddddddddddddd'.slice(0, 16),
    '.ogggdeeeedgggg'.padEnd(16, 'g'),
    '.oggggggggggggg'.padEnd(16, 'g'),
    '.ogggggGgggdddd'.padEnd(16, 'd'),
    '.oggggmmmmmmmmm'.padEnd(16, 'm'),
    '.ogggmtmtmtmtmtt'.padEnd(16, 't'),
    '..ooggmmmmmmmmm'.padEnd(16, 'm'),
    '.oggggggggggggg'.padEnd(16, 'g'),
    'oggGGgggggpppppp',
  ]),
})

// ---------------------------------------------------------------- BLACK WIDOW
const BW: Pal = { o: 0x200808, r: 0xd02818, R: 0xff6a28, d: 0x80140e, k: 0xf6c8a4, K: 0xd09878, e: 0x2a1820, b: 0x1c1c2a, B: 0x444864, u: 0x48b4ff, L: 0xd03040 }
STAGES.widow = stage({
  extra: (cv, t) => { const sw = Math.sin(t * 2) > 0 ? 1 : 0; cv.setSub(1 + sw, 12, 0xd02818); cv.setSub(34 - sw, 12, 0xd02818); cv.glowSub(4 + sw, 9, 0xff6a28, 0.6); cv.glowSub(31 - sw, 9, 0xff6a28, 0.6); const a = 0.5 + 0.4 * Math.sin(t * 4); for (const x of [4, 5, 6, 29, 30, 31]) { cv.glowSub(x, 12, 0x48b4ff, a * 0.6); cv.glowSub(x, 13, 0x9fe0ff, a) } },
  pal: BW, gc: 0x48b4ff, glow: [[7, 13], [8, 13], [27, 13], [28, 13], [7, 12], [28, 12]], blink: ['e', 'K'],
  rows: mirror([
    '.....ooooooooo',
    '...oorrRRRRRRR',
    '..orrRRrrrrrrr',
    '.orrrRrrdrrrrr',
    '.orrrrrkkkkkkk',
    '.orrrdkkkkkkkk',
    '.orrrdkkeekkkk',
    '.orrrdkkkkkkKK',
    '.orrrdkkkkkkkk',
    '.orrrrdkkkLLLL',
    '.orrrrrdkkkkkk',
    '.orrrrrrbbbkkkk',
    'orrrrrbbbbbbbbbbb',
    'orruuubBBbbbbbbbbb',
  ]),
})

// ---------------------------------------------------------------- SPIDER-MAN
const SP: Pal = { o: 0x2a0810, r: 0xd82030, R: 0xff5050, d: 0x8a1020, b: 0x2c50b4, B: 0x5a86e8, k: 0x14061a, w: 0xf6f6ff }
STAGES.spidey = stage({
  pal: SP, gc: 0xffffff, glow: [[13, 6], [22, 6]], blink: ['w', 'k'],
  squint: rows => rows.map((r, i) => i === 5 || i === 7 ? r.split('w').join('k') : r), squintAt: t => (t % 4.6) > 4.0 && (t % 4.6) < 4.3,
  edit: rows => rows.map((r, y) => [...r].map((ch, x) => {
    if (ch !== 'r' && ch !== 'R') return ch
    const dx = x - 17.5, dy = (y - 7) * 2.4, rad = Math.hypot(dx, dy); if (rad < 5) return ch
    const m = Math.atan2(dy, dx) / (Math.PI / 5), rr = rad / 8
    if (Math.abs(m - Math.round(m)) * rad * (Math.PI / 5) < 0.75 || Math.abs(rr - Math.round(rr)) * 8 < 0.7) return 'd'
    return ch
  }).join('')),
  rows: mirror([
    '..oooooooo',
    '.oorrRRRrd',
    '.orrrdrrrrd',
    '.orrdrrdrrrd',
    '.orkkkkkrrrd',
    '.okkwwwwkkrd',
    '.orkwwwwwkkd',
    '.orrkwwwkkrd',
    '.orrrkkkrrrd',
    '..ordrrrdrrrd',
    '..oorrrrrrd',
    '...ooddrrrrdd',
    '.oobbbbrrrrbbb',
    'obbBbbbdrrrbbbbb',
  ]),
})

// ---------------------------------------------------------------- HAWKEYE
const HE: Pal = { b: 0x6a4a1c, o: 0x1a0a30, p: 0x6c2cb8, P: 0xa468ee, d: 0x381470, k: 0xf2b890, K: 0xc88a68, h: 0xc89a3c, e: 0xf4f4ff, i: 0x2a2a48 }
const BOW = 0xe0a050, BOWD = 0x9a6428, STR = 0xe8e8f0
const bowArt = (cv: Canvas, t: number, calm: boolean) => {
  const wob = calm ? 0 : Math.round(Math.sin(t * 2) * 0.6)
  for (let y = 0; y < 14; y++) {
    const x = 29 + Math.round(4 * Math.sin(Math.PI * (y + 0.5) / 14))
    cv.setSub(x, y, y % 4 < 2 ? BOW : BOWD); cv.setSub(x + 1, y, BOWD)
  }
  // string drawn back to the nock
  for (let y = 0; y < 7; y++) { const x = 30 - Math.round(y * 0.86) + wob * (y === 6 ? 1 : 0); cv.setSub(x, y, STR); cv.setSub(x, 13 - y, STR) }
  // arrow: fletching, shaft, glinting tip
  for (let x = 23; x <= 36; x++) cv.setSub(x, 6, x < 27 ? 0xd02838 : 0xd8d8e8)
  for (let x = 23; x <= 26; x++) { cv.setSub(x, 5, 0xd02838); cv.setSub(x, 7, 0xd02838) }
  cv.setSub(35, 5, 0xf4f8ff); cv.setSub(35, 7, 0xf4f8ff); cv.setSub(36, 6, 0xffffff)
  if (!calm) { const g = 0.35 + 0.35 * Math.sin(t * 3); cv.glowSub(36, 6, 0xffffff, g); cv.glowSub(35, 6, 0xffffff, g * 0.5); cv.glowSub(36, 5, 0xffffff, g * 0.5); cv.glowSub(36, 7, 0xffffff, g * 0.5) }
}
STAGES.hawkeye = stage({
  pal: HE, gc: 0xe8d8ff, glow: [], dx: -3, blink: ['e', 'k'],
  squint: rows => rows.map((r, i) => i === 6 ? r.split('e').join('k') : r),
  rows: mirror([
    '...oooooo',
    '..oppPPPPP',
    '.oppPPppppp',
    '.opppppppppp',
    '.opdddddddddd',
    '.opkbbbbbbbbb',
    '.opkkeeiikkkk',
    '.opkkkkkkkkKK',
    '..opkkkkkkkkk',
    '..ophhhhkkkhh',
    '..ohhhhhhhhhh',
    '...ohhhhhhhhh',
    '..oppppppppPP',
    '.opppPPpppppdd',
  ]),
  extra: bowArt,
})

// ---------------------------------------------------------------- LANES (12 subpx tall, 8 s stories)
const ff = (n: number) => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v) }
let LY = 0 // the current lane's top row: every lane pixel is clipped to [LY, LY + 12)
let LOX = 0, LOY = 0 // impact shake applied to solid sprites only
const P = (cv: Canvas, x: number, y: number, c: number) => { y = Math.floor(y) + LOY; if (y >= LY && y < LY + 12) cv.setSub(x + LOX, y, c) }
const GL = (cv: Canvas, x: number, y: number, c: number, a: number) => { y = Math.floor(y); if (y >= LY && y < LY + 12) cv.glowSub(x, y, c, a) }
const BL = (cv: Canvas, x: number, y: number, c: number, a: number) => { y = Math.floor(y); if (y >= LY && y < LY + 12) cv.blendSub(x, y, c, a) }
const RC = (cv: Canvas, x: number, y: number, w: number, h: number, c: number) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(cv, x + i, y + j, c) }
function sl(cv: Canvas, x0: number, y0: number, x1: number, y1: number, c: number, a = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; if (a >= 1) P(cv, Math.round(x), y, c); else GL(cv, Math.round(x), y, c, a) }
}
const GROUND = 0x34345a
function ground(cv: Canvas, y0: number) { LOX = 0; LOY = 0; for (let x = 0; x < cv.W; x++) P(cv, x, y0 + 11, GROUND) }
function puff(cv: Canvas, x: number, y: number, r: number, a: number, c = 0xc8b898) {
  for (let j = -1; j <= 1; j++) for (let i = -r; i <= r; i++) { const d = Math.abs(i) / (r + 1) + Math.abs(j) * 0.4; if (d < 1) GL(cv, Math.round(x + i), y + j, c, a * (1 - d)) }
}
const clamp = (v: number, a = 0, b = 1) => v < a ? a : v > b ? b : v
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const ease = (u: number) => u * u * (3 - 2 * u)
const LT = 8
function flashAll(cv: Canvas, y0: number, x0: number, x1: number, c: number, a: number) { const cx = (x0 + x1) / 2, hw = Math.max(1, (x1 - x0) / 2); for (let y = 0; y < 12; y++) for (let x = Math.max(0, x0); x < x1; x++) GL(cv, x, y0 + y, c, a * (1 - Math.abs(x - cx) / hw) * (1 - Math.abs(y - 5.5) / 8)) }
function blob(cv: Canvas, x: number, y: number, rx: number, ry: number, c0: number, c1: number, a: number) {
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) { const d = Math.hypot(i / (rx + 0.5), j / (ry + 0.5)); if (d < 1) GL(cv, Math.round(x + i), y + j, d < 0.45 ? c0 : c1, a * (1 - d * 0.8)) }
}
// a spark burst (diag), age in seconds
function burst(cv: Canvas, x: number, y: number, age: number, c: number, dur = 0.25) {
  if (age < 0 || age > dur) return
  const r = 1 + age / dur * 4, a = 1 - age / dur
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) GL(cv, Math.round(x + dx * r * 1.6), y + dy * r * 0.9, c, a)
  GL(cv, x, y, 0xffffff, a)
}
function lightning(cv: Canvas, x0: number, y0: number, x1: number, y1: number, seed: number, c: number, amp = 2) {
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, (y1 - y0) * 2.4) / 5)); let px = x0, py = y0
  for (let i = 1; i <= n; i++) {
    const nx = x0 + (x1 - x0) * i / n, ny = y0 + (y1 - y0) * i / n + (i < n ? (ff(seed * 1.7 + i * 5.3) > 0.5 ? 1 : -1) * (0.4 + ff(seed + i * 3.1)) * amp : 0)
    sl(cv, Math.round(px), py, Math.round(nx), ny, c); px = nx; py = ny
  }
}
// forked bolt: white core, tinted glow, and two branches
function bolt(cv: Canvas, x0: number, y0: number, x1: number, y1: number, seed: number, glow: number) {
  const n = 7; let px = x0, py = y0
  for (let i = 1; i <= n; i++) {
    const f = i / n, nx = x0 + (x1 - x0) * f, ny = y0 + (y1 - y0) * f + (i < n ? (ff(seed + i * 3.7) - 0.5) * 4 : 0)
    sl(cv, Math.round(px), py, Math.round(nx), ny, 0xffffff); sl(cv, Math.round(px), py - 1, Math.round(nx), ny - 1, glow, 0.5); sl(cv, Math.round(px), py + 1, Math.round(nx), ny + 1, glow, 0.5)
    if (i === 3 || i === 5) { const bx = nx + (i === 3 ? 12 : -8), by = i === 3 ? y0 + 9 : y0 - 3; sl(cv, Math.round(nx), ny, Math.round(bx), by, glow); sl(cv, Math.round(bx), by, Math.round(bx + 5), by + (i === 3 ? 0 : 4), glow, 0.5) }
    px = nx; py = ny
  }
}
function boom(cv: Canvas, x: number, yc: number, age: number, sz: number, y0: number) {
  if (age < 0 || age > 1.5) return
  if (age < 0.1) blob(cv, x, yc, Math.round(11 * sz), 5, 0xffffff, 0xfff0b0, 1)
  if (age < 0.75) { const u = age / 0.75; blob(cv, x, yc, Math.round((3 + u * 10) * sz), Math.round(2 + u * 3), 0xffe070, 0xff7020, 1 - u * 0.7); if (u < 0.5) blob(cv, x, yc, Math.round((2 + u * 6) * sz), 2, 0xffffff, 0xffd040, 0.8 - u) }
  if (age > 0.25) { const v = (age - 0.25) / 1.25; for (let k = 0; k < 4; k++) blob(cv, x + (k - 1.5) * 4 * sz, yc - 1 - v * 5 - k * 0.6, 3, 2, 0x5a5a74, 0x3a3a50, 0.55 * (1 - v)) }
  for (let k = 0; k < 8; k++) {
    const vx = (ff(k * 2.3) - 0.5) * 46 * sz, vy = 12 + ff(k * 5.1) * 16
    const yy = Math.min(y0 + 10, Math.floor(yc - (vy * age - 40 * age * age)))
    if (age < 1.3) RC(cv, Math.round(x + vx * Math.min(age, 0.9)), yy, 2, 1, k % 3 === 0 ? 0xffb040 : k % 3 === 1 ? 0x8a90b8 : 0x5a5e80)
  }
}

// ---- tiny sprite toolkit (everything precomputed at load; drawing only clips + sets cells)
interface Spr { w: number; h: number; px: Int32Array }
const grid = (w: number, h: number): Spr => ({ w, h, px: new Int32Array(w * h).fill(-1) })
const gput = (g: Spr, x: number, y: number, c: number) => { if (x >= 0 && x < g.w && y >= 0 && y < g.h) g.px[y * g.w + x] = c }
const grect = (g: Spr, x: number, y: number, w: number, h: number, c: number) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) gput(g, x + i, y + j, c) }
function fromRows(rows: string[], pal: Pal): Spr {
  const g = grid(rows[0]!.length, rows.length)
  rows.forEach((r, j) => [...r].forEach((ch, i) => { const c = pal[ch]; if (c !== undefined) gput(g, i, j, c) }))
  return g
}
function blit(cv: Canvas, s: Spr, x: number, y: number, flip = false, over = -1) {
  x = Math.round(x); y = Math.round(y)
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) { const c = s.px[j * s.w + i]!; if (c >= 0) P(cv, x + (flip ? s.w - 1 - i : i), y + j, over >= 0 ? over : c) }
}
// rotate about the sprite centre; the 2.4:1 pixel aspect is respected
function blitRot(cv: Canvas, s: Spr, cx: number, cy: number, ang: number, flip = false, over = -1) {
  const co = Math.cos(ang), si = Math.sin(ang), R = Math.ceil(Math.hypot(s.w, s.h * 2.4) / 2), Ry = Math.ceil(R / 2.4)
  cx = Math.round(cx)
  for (let dy = -Ry; dy <= Ry; dy++) for (let dx = -R; dx <= R; dx++) {
    const ux = dx, uy = dy * 2.4
    const i = Math.round(ux * co + uy * si + (s.w - 1) / 2), j = Math.round((-ux * si + uy * co) / 2.4 + (s.h - 1) / 2)
    if (i < 0 || i >= s.w || j < 0 || j >= s.h) continue
    const c = s.px[j * s.w + (flip ? s.w - 1 - i : i)]!; if (c >= 0) P(cv, cx + dx, Math.round(cy) + dy, over >= 0 ? over : c)
  }
}

// ---- a humanoid rig facing right. Body anchor = body centre. 11 rows tall, feet on row 10, ground on row 11.
interface Look { hood: number; hoodL: number; side: number; sideLen: number; skin: number; lower: number; torso: number; torsoL: number; belt: number; legs: number; boots: number; eye: number; deco?: (g: Spr, bx: number, d: number) => void }
const BX = 10, SWD = 30, SHT = 11, ANCH = BX + 5
type Legs = 'stand' | 'runA' | 'runB' | 'runC' | 'air'
type Fr = 'down' | 'fwd' | 'up' | 'back' | 'swing' | 'ground'
type Bk = 'down' | 'bent' | 'draw' | 'up'
function human(k: Look, legs: Legs, fr: Fr, bk: Bk, d = 0): Spr {
  const g = grid(SWD, SHT), bx = BX, r0 = 8 + d
  const lg = (x: number, y: number, w: number, c: number) => grect(g, x, y, w, 1, c)
  if (legs === 'stand') { for (let y = r0; y <= 9; y++) { lg(bx + 3, y, 3, k.legs); lg(bx + 6, y, 3, k.legs) } lg(bx + 3, 10, 3, k.boots); lg(bx + 6, 10, 4, k.boots) }
  else if (legs === 'runA') { lg(bx + 3, 8, 3, k.legs); lg(bx + 2, 9, 3, k.legs); lg(bx, 10, 4, k.boots); lg(bx + 6, 8, 3, k.legs); lg(bx + 7, 9, 3, k.legs); lg(bx + 8, 10, 4, k.boots) }
  else if (legs === 'runB') { lg(bx + 6, 8, 3, k.legs); lg(bx + 6, 9, 3, k.legs); lg(bx + 6, 10, 4, k.boots); lg(bx + 3, 8, 3, k.legs); lg(bx + 2, 9, 3, k.legs); lg(bx, 9, 2, k.boots) }
  else if (legs === 'runC') { lg(bx + 3, 8, 3, k.legs); lg(bx + 3, 9, 3, k.legs); lg(bx + 3, 10, 3, k.boots); lg(bx + 6, 8, 3, k.legs); lg(bx + 7, 9, 3, k.legs); lg(bx + 8, 9, 3, k.boots) }
  else { lg(bx + 3, 8, 6, k.legs); lg(bx + 2, 9, 3, k.boots); lg(bx + 7, 9, 4, k.boots) }
  grect(g, bx + 2, 4 + d, 8, 3, k.torso); grect(g, bx + 2, 4 + d, 8, 1, k.torsoL); grect(g, bx + 2, 7 + d, 8, 1, k.belt)
  grect(g, bx + 2, d, 8, 2, k.hood); grect(g, bx + 2, d, 8, 1, k.hoodL)
  grect(g, bx + 2, 2 + d, 2, Math.max(1, k.sideLen), k.side)
  grect(g, bx + 4, 2 + d, 6, 1, k.skin); grect(g, bx + 4, 3 + d, 6, 1, k.lower)
  gput(g, bx + 6, 2 + d, k.eye); gput(g, bx + 8, 2 + d, k.eye)
  // back arm
  if (bk === 'down') { grect(g, bx, 4 + d, 2, 3, k.torso); grect(g, bx, 7 + d, 2, 1, k.skin) }
  else if (bk === 'up') { grect(g, bx, 1 + d, 2, 4, k.torso); grect(g, bx, d, 2, 1, k.skin) }
  else if (bk === 'draw') { grect(g, bx + 4, 5 + d, 6, 1, k.torso); grect(g, bx + 9, 5 + d, 2, 1, k.skin) }
  else { grect(g, bx - 2, 4 + d, 4, 2, k.torso); grect(g, bx - 3, 4 + d, 1, 2, k.skin) }
  // front arm
  if (fr === 'down') { grect(g, bx + 10, 4 + d, 2, 3, k.torso); grect(g, bx + 10, 7 + d, 2, 1, k.skin) }
  else if (fr === 'fwd') { grect(g, bx + 10, 4 + d, 6, 2, k.torso); grect(g, bx + 16, 4 + d, 2, 2, k.skin) }
  else if (fr === 'swing') { grect(g, bx + 10, 4 + d, 2, 2, k.torso); grect(g, bx + 12, 5 + d, 2, 2, k.torso); grect(g, bx + 14, 6 + d, 2, 2, k.skin) }
  else if (fr === 'up') { grect(g, bx + 10, 1 + d, 2, 4, k.torso); grect(g, bx + 10, d, 2, 1, k.skin) }
  else if (fr === 'back') { grect(g, bx - 6, 4 + d, 8, 2, k.torso); grect(g, bx - 8, 4 + d, 2, 2, k.skin) }
  else if (fr === 'ground') { grect(g, bx + 10, 6 + d - 2, 2, 4, k.torso); grect(g, bx + 10, 9, 2, 2, k.skin) }
  k.deco?.(g, bx, d)
  return g
}
function rig(k: Look) {
  return {
    stand: human(k, 'stand', 'down', 'down'), runA: human(k, 'runA', 'swing', 'bent'), runB: human(k, 'runB', 'down', 'bent'),
    air: human(k, 'air', 'fwd', 'down'), wind: human(k, 'stand', 'back', 'down', 1), reach: human(k, 'stand', 'fwd', 'down'),
    up: human(k, 'stand', 'up', 'down'), crouch: human(k, 'stand', 'down', 'down', 2), land: human(k, 'stand', 'ground', 'bent', 2),
    aim: human(k, 'stand', 'fwd', 'down'), drawn: human(k, 'stand', 'fwd', 'draw'), swing: human(k, 'stand', 'swing', 'bent'),
    hang: human(k, 'air', 'up', 'down'), up2: human(k, 'stand', 'up', 'up'), runA2: human(k, 'runA', 'down', 'bent'), runC: human(k, 'runC', 'swing', 'bent'),
  }
}
function fig(cv: Canvas, s: Spr, x: number, y0: number, flip = false, over = -1, dy = 0) {
  blit(cv, s, x - (flip ? s.w - 1 - ANCH : ANCH), y0 + dy, flip, over)
}
const RUN = (rg: ReturnType<typeof rig>, tt: number) => { const f = Math.floor(tt / 0.1) & 3; return f === 0 ? rg.runA : f === 1 ? rg.runB : f === 2 ? rg.runA2 : rg.runC }
const RBOB = (tt: number) => (Math.floor(tt / 0.1) & 1) ? -1 : 0
const AXE = fromRows(['.........oo...', '........osSo..', 'hhhhhhhhsSSSso', '........osSo..', '.........oo...'], { o: 0x3a4a7a, s: 0xe8f0ff, S: 0x8a98c0, h: 0x8a5a20 })
const DR_PAL = { o: 0x20203a, G: 0x6a6e90, g: 0x9a9ec0, R: 0xff3030, k: 0x20203a, d: 0x6a6a86, x: 0x4a4c68 }
const DR_ON = fromRows(['....oooooo....', '..ooggggggoo..', '.oGGGGGGGGGGo.', 'oGGGkRRRRkGGGo', '.oGGGGGGGGGGo.', '..oodGGGGdoo..', '..oo..oo..oo..'], DR_PAL)
const DR_OFF = fromRows(['....oooooo....', '..ooddddddoo..', '.oxxxxxxxxxxo.', 'oxxxkxxxxkxxxo', '.oxxxxxxxxxxo.', '..ooxxxxxxoo..', '..oo..oo..oo..'], DR_PAL)
function drone(cv: Canvas, y0: number, cx: number, top0: number, th: number, tt: number, flipDir = 1) {
  const hov = Math.round(Math.sin(tt * 4 + cx) * 0.7)
  if (tt < th) { blit(cv, DR_ON, cx - 7, top0 + hov); GL(cv, cx - 1, top0 + 3 + hov, 0xff3030, 0.3 + 0.2 * Math.sin(tt * 9)); GL(cv, cx, top0 + 3 + hov, 0xff3030, 0.3 + 0.2 * Math.sin(tt * 9)); GL(cv, cx - 4, y0 + 8 + hov, 0x9fe4ff, 0.15); GL(cv, cx + 3, y0 + 8 + hov, 0x9fe4ff, 0.15); return }
  const a = tt - th, f = Math.min(1, a / 0.55), top = Math.min(y0 + 4, top0 + Math.round((y0 + 4 - top0) * f * f))
  blit(cv, a < 0.1 ? DR_ON : DR_OFF, cx - 7 + Math.round(f * 3 * flipDir), top, false, a < 0.07 ? 0xffffff : -1)
  if (a < 0.55) { const sy = top; GL(cv, cx + 1, sy, 0xffa040, 0.6); puff(cv, cx + 1, sy - 1 - a * 3, 2, 0.4, 0x6a6a80) }
  else { burst(cv, cx + 3, y0 + 9, a - 0.55, 0xffd060, 0.25); if (a < 3.4) puff(cv, cx + 4, y0 + 4 - Math.min(3, (a - 0.55) * 2), 2, 0.4 * (1 - (a - 0.55) / 2.9), 0x5a5a72) }
}

// ---- CAPTAIN AMERICA: sprints in, throws the shield in a V ricochet (ground, drone, drone), catches it with a CLANG
function shield(cv: Canvas, cx: number, cy: number, rx: number) {
  for (let j = -3; j <= 3; j++) for (let i = -rx; i <= rx; i++) {
    const d = Math.hypot(i / (rx + 0.5), j / 3.5); if (d > 1) continue
    let c = d > 0.86 ? 0x9a1828 : d > 0.7 ? 0xe03040 : d > 0.52 ? 0xf6f6ff : d > 0.3 ? 0xe03040 : 0x2c4cbc
    if (d <= 0.3 && Math.abs(i) <= 1 && Math.abs(j) <= 1) c = 0xf6f6ff
    P(cv, Math.round(cx + i), Math.round(cy + j), c)
  }
}
const CAL: Look = {
  hood: 0x2c4cbc, hoodL: 0x5a86ea, side: 0x2c4cbc, sideLen: 2, skin: 0xf2b88e, lower: 0xe0a07a, torso: 0x2c4cbc, torsoL: 0x5a86ea, belt: 0xf6f6ff, legs: 0x2c4cbc, boots: 0xc41f2e, eye: 0xffffff,
  deco: (g, bx, d) => { grect(g, bx + 5, 5 + d, 2, 1, 0xf6f6ff); grect(g, bx + 3, 7 + d, 2, 1, 0xd02838); grect(g, bx + 7, 7 + d, 2, 1, 0xd02838); grect(g, bx + 6, 1 + d, 2, 1, 0xf6f6ff); gput(g, bx + 2, 1 + d, 0xf6f6ff); gput(g, bx + 2, 2 + d, 0xf6f6ff) },
}
const CAPR = rig(CAL)
const SWX = new Float64Array(6), SWY = new Float64Array(6), SWT = [1.5, 2.0, 2.45, 2.95, 3.1, 4.4]
LANES.cap = (cv, y0, t, calm) => {
  LY = y0
  const W = cv.W, tt = calm ? 5.4 : t % LT, gy = y0 + 11, xc = 24
  ground(cv, y0)
  const hx = xc + 14, hy = y0 + 5.5
  const gx = Math.round(W * 0.36), ax = Math.round(W * 0.58), bx = Math.round(W * 0.8)
  SWX[0] = hx; SWY[0] = hy; SWX[1] = gx; SWY[1] = y0 + 9.5; SWX[2] = ax; SWY[2] = y0 + 4; SWX[3] = bx; SWY[3] = y0 + 3; SWX[4] = bx; SWY[4] = y0 + 3; SWX[5] = hx; SWY[5] = hy
  drone(cv, y0, ax, y0 + 1, 2.45, tt); drone(cv, y0, bx, y0, 2.95, tt, -1)
  let X = xc, s = CAPR.stand, dxo = 0, bob = 0
  const run = Math.floor(tt / 0.1) & 1
  if (tt < 1.0) { const u = tt / 1.0; X = Math.round(-6 + (xc + 6) * (1 - (1 - u) * (1 - u))); s = RUN(CAPR, tt); bob = RBOB(tt) }
  else if (tt < 1.5) s = tt < 1.15 ? CAPR.runB : CAPR.wind
  else if (tt < 1.8) s = CAPR.reach
  else if (tt < 4.3) s = CAPR.stand
  else if (tt < 6.3) { s = CAPR.reach; if (tt >= 4.4 && tt < 4.7) dxo = tt < 4.55 ? -2 : -1 }
  else if (tt < 6.6) s = CAPR.crouch
  else { const u = (tt - 6.6) / 1.4; X = Math.round(xc + (W + 30 - xc) * u * u); s = RUN(CAPR, tt); bob = RBOB(tt) }
  const Xd = X + dxo
  for (let i = 0; i < 12; i++) BL(cv, Xd - 6 + i, gy, 0x0c0c1a, 0.6)
  fig(cv, s, Xd, y0, false, -1, bob)
  if (tt < 1.0 || tt >= 6.6) { shield(cv, Xd + 8, y0 + 7 + bob, 2); if (run && tt < 0.95) puff(cv, Xd - 7, gy - 1, 2, 0.35) }
  else if (tt < 1.5) shield(cv, Xd - 14 + (tt > 1.3 ? -1 : 0), y0 + 6, 3)
  else if (tt >= 4.4 && tt < 6.3) {
    shield(cv, Xd + 14, hy, 3)
    const gl = seg(tt, 5.2, 5.6); if (gl > 0 && gl < 1) GL(cv, Xd + 11 + Math.round(gl * 6), y0 + 3 + Math.round(gl * 5), 0xffffff, 0.9)
    if (tt > 5.55 && tt < 5.8) { const a = 1 - (tt - 5.55) / 0.25; GL(cv, Xd + 17, y0 + 3, 0xffffff, a); GL(cv, Xd + 15, y0 + 3, 0xffffff, a * 0.5); GL(cv, Xd + 19, y0 + 3, 0xffffff, a * 0.5); GL(cv, Xd + 17, y0 + 1, 0xffffff, a * 0.6); GL(cv, Xd + 17, y0 + 5, 0xffffff, a * 0.6) }
  }
  if (tt >= 1.5 && tt < 4.4) {
    let k = 0; while (k < 4 && tt >= SWT[k + 1]!) k++
    const u = (tt - SWT[k]!) / (SWT[k + 1]! - SWT[k]!)
    let sx = SWX[k]! + (SWX[k + 1]! - SWX[k]!) * u, sy = SWY[k]! + (SWY[k + 1]! - SWY[k]!) * u
    if (k === 4) { const e = ease(u); sx = SWX[4]! + (SWX[5]! - SWX[4]!) * e; sy = SWY[4]! + (SWY[5]! - SWY[4]!) * e + Math.sin(u * Math.PI * 2) * 3 }
    const rx = Math.max(1, Math.round(5 * Math.abs(Math.cos(tt * 22))) + 1)
    const dirx = k === 4 ? -1 : 1
    for (let i = 1; i <= 6; i++) GL(cv, Math.round(sx - dirx * (i * 2 + 3)), sy, 0xbfd4ff, 0.55 / i * 1.6)
    if (k === 3) shield(cv, sx, sy, 5); else shield(cv, sx, sy, rx)
  }
  burst(cv, gx, y0 + 10, tt - 2.0, 0xffe080, 0.28); burst(cv, ax - 4, y0 + 4, tt - 2.45, 0xffffff, 0.3); burst(cv, ax - 4, y0 + 3, tt - 2.45, 0xffd060, 0.4); burst(cv, bx - 4, y0 + 3, tt - 2.95, 0xffffff, 0.3); burst(cv, bx - 4, y0 + 4, tt - 2.95, 0xffd060, 0.4)
  if (tt >= 2.0 && tt < 2.3) puff(cv, gx, gy - 1, 3, 0.45 * (1 - (tt - 2.0) / 0.3))
  if (tt >= 4.4 && tt < 4.7) { burst(cv, hx + 5, y0 + 5, tt - 4.4, 0xffffff, 0.3); const a = 1 - (tt - 4.4) / 0.3; GL(cv, hx + 7, y0 + 5, 0xffffff, a); GL(cv, hx + 9, y0 + 4, 0xffe080, a * 0.7); if (tt < 4.46) flashAll(cv, y0, hx - 10, hx + 14, 0xdfe8ff, 0.3) }
}

// ---- IRON MAN: dives in, superhero landing, repulsor blast, unibeam, dusts off, takes off
const IR = { r: 0xc41e2c, R: 0xf2503c, d: 0x7e1022, g: 0xf4b830, G: 0xffe69a }
const IML: Look = {
  hood: 0xc41e2c, hoodL: 0xf2503c, side: 0xc41e2c, sideLen: 2, skin: 0xf4b830, lower: 0xb27418, torso: 0xc41e2c, torsoL: 0xf2503c, belt: 0xf4b830, legs: 0xa01828, boots: 0xf4b830, eye: 0xf0ffff,
  deco: (g, bx, d) => { gput(g, bx + 2, d, -1); gput(g, bx + 9, d, -1); grect(g, bx + 5, 2 + d, 2, 1, 0xdffcff); grect(g, bx + 8, 2 + d, 2, 1, 0xdffcff); grect(g, bx + 4, 4 + d, 4, 1, 0x5a1020); grect(g, bx + 5, 5 + d, 2, 1, 0xdffcff); grect(g, bx + 3, 6 + d, 1, 1, 0xf4b830); grect(g, bx + 8, 6 + d, 1, 1, 0xf4b830) },
}
const IMR = rig(IML)
function ironFig(cv: Canvas, x: number, y: number) {
  RC(cv, x, y + 5, 9, 2, IR.d); RC(cv, x, y + 5, 2, 2, IR.g)
  RC(cv, x + 1, y + 3, 9, 2, IR.r); RC(cv, x + 1, y + 3, 2, 2, IR.g)
  RC(cv, x + 8, y + 1, 9, 4, IR.r); RC(cv, x + 8, y + 1, 9, 1, IR.R)
  RC(cv, x + 12, y + 2, 4, 2, IR.g)
  RC(cv, x + 16, y, 5, 4, IR.r); RC(cv, x + 16, y, 5, 1, IR.R)
  RC(cv, x + 18, y + 1, 3, 3, IR.g); RC(cv, x + 18, y + 1, 3, 1, IR.G); RC(cv, x + 19, y + 2, 2, 1, 0xf0ffff)
  RC(cv, x + 11, y + 6, 6, 2, IR.d)
  RC(cv, x + 15, y + 4, 6, 2, IR.r); RC(cv, x + 21, y + 3, 3, 3, IR.g); RC(cv, x + 21, y + 3, 3, 1, IR.G)
  GL(cv, x + 13, y + 3, 0x9ff0ff, 0.5); GL(cv, x + 14, y + 3, 0x9ff0ff, 0.5)
}
function flame(cv: Canvas, fx: number, fy: number, fl: number, len: number) {
  for (let i = 0; i < len; i++) { const a = (1 - i / len) * fl; GL(cv, fx - i, fy, i < 3 ? 0xfff0a0 : 0xff9040, a); GL(cv, fx - i, fy + 1, 0xff7030, a * 0.6); GL(cv, fx - i, fy - 1, 0xff7030, a * 0.45) }
}
function speedLines(cv: Canvas, x: number, y0: number, a: number) {
  for (let k = 0; k < 6; k++) { const ly = y0 + 1 + k * 2, ln = 10 + (k * 7) % 14; for (let i = 0; i < ln; i++) GL(cv, x - 8 - i - (k * 5) % 9, ly, 0xaee4ff, 0.5 * a * (1 - i / ln)) }
}
LANES.ironman = (cv, y0, t, calm) => {
  LY = y0
  const W = cv.W, tt = calm ? 3.15 : t % LT, gy = y0 + 11, xL = Math.round(W * 0.22), fl = calm ? 0.8 : 0.7 + 0.3 * Math.sin(t * 40)
  ground(cv, y0)
  const xd1 = Math.round(W + 14 + (W * 0.58 - W - 14) * (1 - Math.pow(1 - seg(tt, 1.6, 2.5), 2))), xd2 = Math.round(W + 14 + (W * 0.78 - W - 14) * (1 - Math.pow(1 - seg(tt, 3.5, 4.3), 2)))
  if (tt >= 1.6) drone(cv, y0, xd1, y0 + 1, 3.15, tt)
  if (tt >= 3.5 && tt < 4.7) drone(cv, y0, xd2, y0 + 1, 99, tt)
  const la = tt - 1.35
  if (tt >= 3.3) { for (const dx of [xd1, xd2]) { for (let i = -5; i <= 5; i++) BL(cv, dx + i, gy - 1, 0x0a0a16, 0.55 - Math.abs(i) * 0.05); puff(cv, dx, y0 + 8 - ((tt * 1.5) % 4), 3, 0.28, 0x5a5a72) } }
  if (la > 0) {
    for (const sg of [-1, 1]) { let yy = gy - 1; const reach = Math.min(34, la * 140); for (let d = 0; d < reach; d++) { if (d % 3 === 0) yy = Math.max(y0 + 8, Math.min(gy - 1, yy + (ff(Math.floor(d / 3) + sg * 7) > 0.5 ? 1 : -1))); P(cv, xL + 4 + sg * (d + 4), yy, 0x14142a); if (la < 0.8 && d < 12) GL(cv, xL + 4 + sg * (d + 4), yy - 1, 0xffa040, 0.5 * (1 - la / 0.8)) } }
    for (let k = 0; k < 4; k++) { const sg = k & 1 ? 1 : -1; puff(cv, xL + 4 + sg * (6 + (k >> 1) * 7 + la * 12), gy - 2, 3, 0.55 * Math.max(0, 1 - la / 1.4)) }
  }
  let flip = false, s = IMR.stand, dxo = 0
  if (tt < 1.35) {
    const u = tt / 1.35, x = Math.round(-16 + (xL - 10 + 16) * (1 - Math.pow(1 - u, 2))), y = y0 + Math.round(-1 + 4 * u * u)
    speedLines(cv, x, y0, 1); flame(cv, x - 1, y + 6, fl, 10); ironFig(cv, x, y); return
  }
  if (tt < 2.1) s = IMR.land
  else if (tt < 2.4) s = IMR.crouch
  else if (tt < 3.3) s = tt < 2.6 ? IMR.stand : IMR.aim
  else if (tt < 4.2) s = IMR.stand
  else if (tt < 5.0) { s = IMR.stand; dxo = tt < 4.7 ? 0 : -1 }
  else if (tt < 5.2) s = IMR.stand
  else if (tt < 6.0) { flip = true; s = (Math.floor(tt / 0.18) & 1) ? IMR.swing : IMR.stand }
  else if (tt < 6.25) s = IMR.wind
  else if (tt < 6.55) s = IMR.crouch
  else if (tt < 6.9) s = IMR.up
  else {
    const u = (tt - 6.9) / 1.1, x = Math.round(xL - 6 + (W + 36 - xL) * Math.pow(u, 1.5)), y = y0 + 2 - Math.round(u * 1)
    speedLines(cv, x, y0, Math.min(1, u * 3)); flame(cv, x - 1, y + 6, fl, 14); ironFig(cv, x, y)
    if (u < 0.3) puff(cv, xL, gy - 1, 5, 0.5 * (1 - u / 0.3))
    return
  }
  let dy = 0
  if (tt >= 6.55 && tt < 6.9) { const u = (tt - 6.55) / 0.35; dy = -Math.round(u * u * 9); for (let yy = y0 + 11 + dy; yy <= y0 + 11; yy++) for (let q = -2; q <= 3; q++) GL(cv, xL + q, yy, yy === y0 + 11 + dy ? 0xfff0a0 : 0xff9040, (0.9 - Math.abs(q - 0.5) * 0.2) * fl); blob(cv, xL, y0 + 10, 8, 2, 0xfff0a0, 0xff9040, 0.8); puff(cv, xL, gy - 1, 6, 0.5 * (1 - u * 0.5)) }
  if (tt >= 6.25 && tt < 6.55) GL(cv, xL, y0 + 10, 0xffa040, 0.4 + 0.4 * ((tt - 6.25) / 0.3))
  for (let i = 0; i < 12; i++) BL(cv, xL - 6 + i, gy, 0x0c0c1a, 0.6)
  fig(cv, s, xL + dxo, y0, flip, -1, dy)
  GL(cv, xL, y0 + 5 + (s === IMR.land ? 2 : 0), 0x9ff0ff, 0.35 + 0.2 * Math.sin(tt * 6))
  const px = xL + 14, py = y0 + 4.5
  if (tt > 2.6 && tt < 3.0) { const a = (tt - 2.6) / 0.4; for (let r = 0; r < 2 + a * 3; r++) for (let j = -1; j <= 1; j++) GL(cv, px + 2 + r, py + j, 0xbff4ff, 0.7 * a / (1 + r)); GL(cv, px + 2, py, 0xffffff, a) }
  if (tt >= 3.0 && tt < 3.3) {
    const len = Math.min(xd1 - 8 - px, Math.round((tt - 3.0) / 0.07 * (xd1 - 8 - px)))
    for (let i = 0; i < len; i++) { P(cv, px + i, py, 0xffffff); P(cv, px + i, py + 1, 0xffffff); GL(cv, px + i, py - 1, 0x7fe0ff, 0.8); GL(cv, px + i, py + 2, 0x7fe0ff, 0.8); GL(cv, px + i, py - 2, 0x40a0ff, 0.25); GL(cv, px + i, py + 3, 0x40a0ff, 0.25) }
    blob(cv, px + 1, py, 2, 2, 0xffffff, 0x9ff0ff, 0.9)
  }
  boom(cv, xd1, y0 + 4, tt - 3.15, 1, y0)
  if (tt >= 4.2 && tt < 4.7) blob(cv, xL + 2, y0 + 5, 3, 2, 0xffffff, 0x9ff0ff, (tt - 4.2) / 0.5)
  if (tt >= 4.5 && tt < 4.85) {
    const len = Math.min(xd2 - 8 - (xL + 5), Math.round((tt - 4.5) / 0.08 * (xd2 - xL)))
    for (let i = 0; i < len; i++) { const x = xL + 5 + i; for (let j = 4; j <= 6; j++) P(cv, x, y0 + j, j === 5 ? 0xffffff : 0xcff8ff); GL(cv, x, y0 + 3, 0x7fe0ff, 0.8); GL(cv, x, y0 + 7, 0x7fe0ff, 0.8); GL(cv, x, y0 + 2, 0x40a0ff, 0.3); GL(cv, x, y0 + 8, 0x40a0ff, 0.3) }
  }
  boom(cv, xd2, y0 + 4, tt - 4.7, 1.5, y0)
  if (tt >= 4.7 && tt < 4.76) flashAll(cv, y0, xd2 - 20, xd2 + 20, 0xffffff, 0.3)
  if (tt >= 1.35 && tt < 1.42) flashAll(cv, y0, xL - 14, xL + 22, 0xffffff, 0.35)
}

// ---- THOR: Bifrost slam, Stormbreaker comes home, forked lightning, "Bring me Thanos", takeoff
const THL: Look = {
  hood: 0xf0be3c, hoodL: 0xffe58a, side: 0xf0be3c, sideLen: 4, skin: 0xf4bc92, lower: 0xb07a20, torso: 0x34487a, torsoL: 0x8892b8, belt: 0x8a5a20, legs: 0x3a3a58, boots: 0x6a4a28, eye: 0x58d4ff,
  deco: (g, bx, d) => { grect(g, bx + 7, 1 + d, 3, 1, 0xf4bc92); grect(g, bx + 5, 4 + d, 3, 1, 0xb07a20); gput(g, bx + 4, 5 + d, 0xdce2f0); gput(g, bx + 8, 5 + d, 0xdce2f0); grect(g, bx + 5, 6 + d, 3, 1, 0xdce2f0) },
}
const THR = rig(THL)
const THFLY = human(THL, 'air', 'fwd', 'down')
const TH_PAL = { p: 0x7a3aa8, P: 0xa868dc, g: 0xf0be3c, k: 0x1a0a24, o: 0x2a1040 }
const THANOS = fromRows(['..g..g..', '.gppppg.', '.pkppkp.', '.pPpppp.', '..pppp..', 'ggggggPg', 'gpgggpgg', 'pggggggp', '.gg..gg.', '.pp..pp.', '.oo..oo.'], TH_PAL)
const THANOS_X = fromRows(['..k..k..', '.kkkkkk.', '.kokkok.', '.kkkkkk.', '..kkkk..', 'kkkkkkkk', 'kkkkkkkk', 'kkkkkkkk', '.kk..kk.', '.kk..kk.', '.kk..kk.'], { k: 0x241e2c, o: 0x4a4458 })
const BIF = [0xff4060, 0xffc040, 0x60e070, 0x40c8ff, 0xb070ff]
LANES.thor = (cv, y0, t, calm) => {
  LY = y0
  const W = cv.W, tt = calm ? 3.4 : t % LT, gy = y0 + 11, xT = Math.round(W * 0.2), xg = Math.round(W * 0.74), n = calm ? 3 : Math.floor(t * 16)
  ground(cv, y0)
  {
    const tz = tt - 3.9
    if (tz < 0) blit(cv, THANOS, xg - 4, y0 + 0)
    else if (tz < 0.2) blit(cv, THANOS, xg - 4, y0 + 0, false, tz < 0.1 ? 0xffffff : 0x101018)
    else if (tz < 0.65) blit(cv, THANOS_X, xg - 4, y0 + 0)
    else if (tz < 1.1) blitRot(cv, THANOS_X, xg, y0 + 5.5 + (tz - 0.65) * 3, (tz - 0.65) / 0.45 * 1.5, false)
    else blitRot(cv, THANOS_X, xg + 2, y0 + 8.5, 1.5, false)
    if (tz > 0.2 && tz < 3) { puff(cv, xg - 1, y0 + 4 - Math.round(((tz * 4) % 4)), 2, 0.4 * (1 - tz / 3), 0x6a6a80); if (tz > 1.1) puff(cv, xg + 3, y0 + 7 - Math.round(((tz * 3) % 3)), 2, 0.3, 0x6a6a80) }
  }
  const bu = seg(tt, 0.0, 0.25), bf = tt < 1.7 ? 1 : 1 - seg(tt, 1.7, 2.3)
  if (bf > 0 && bu > 0) {
    const bot = Math.floor(bu * 12), pulseA = 0.85 + 0.1 * Math.sin(tt * 18)
    for (let i = -7; i <= 6; i++) { const c = BIF[Math.min(4, Math.floor((i + 7) * 5 / 14))]!; for (let yy = 0; yy < bot; yy++) BL(cv, xT + i, y0 + yy, c, pulseA * bf); GL(cv, xT + i, y0 + bot - 1, 0xffffff, 0.8 * bf) }
    for (let yy = 0; yy < bot; yy++) { GL(cv, xT - 8, y0 + yy, 0x9fe4ff, 0.25 * bf); GL(cv, xT + 7, y0 + yy, 0x9fe4ff, 0.25 * bf) }
    if (tt > 0.25 && tt < 1.4) { puff(cv, xT - 10, gy - 1, 4, 0.5 * (1 - (tt - 0.5) / 0.9), 0xd0e8ff); puff(cv, xT + 10, gy - 1, 4, 0.5 * (1 - (tt - 0.5) / 0.9), 0xd0e8ff) }
  }
  if (tt >= 0.25 && tt < 0.31) flashAll(cv, y0, xT - 22, xT + 22, 0xffffff, 0.4)
  const hx = xT + 14, hy = y0 + 4.5
  let s = THR.stand, show = tt >= 0.25
  if (tt < 1.4) s = THR.land
  else if (tt < 1.75) s = THR.crouch
  else if (tt < 2.8) s = THR.stand
  else if (tt < 5.9) s = THR.reach
  else if (tt < 6.4) s = THR.crouch
  else show = false
  if (show) {
    for (let j = 0; j < 7; j++) { const fl2 = Math.round(Math.sin((calm ? 0 : t) * 6 + j * 0.8) * (1 + j * 0.2)); RC(cv, xT - 8 - fl2, y0 + 3 + j + (s === THR.land || s === THR.crouch ? 2 : 0), 4, 1, j % 3 === 0 ? 0xe04050 : 0xc41e2c) }
    for (let i = 0; i < 12; i++) BL(cv, xT - 6 + i, gy, 0x0c0c1a, 0.6)
    fig(cv, s, xT, y0)
  }
  if (tt >= 2.2 && tt < 3.0) {
    const u = (tt - 2.2) / 0.8, e = u * u, ax = Math.round(W + 8 + (hx + 4 - W - 8) * e), ay = y0 + 1 + (hy - y0 - 1) * e + Math.sin(u * 5) * 1.5
    for (let k = 1; k <= 8; k++) { GL(cv, ax + k * 2 + 4, ay, 0x9fe4ff, 0.7 / k * 2); GL(cv, ax + k * 2 + 4, ay + 1, 0x7fc8ff, 0.4 / k * 2) }
    lightning(cv, ax + 6, ay, ax + 22, ay + (ff(n) - 0.5) * 5, n, 0xdff4ff, 1.4)
    blitRot(cv, AXE, ax, ay, -tt * 22)
  } else if (tt >= 3.0 && tt < 5.2) {
    blitRot(cv, AXE, hx + 5, y0 + 2.5, -0.85)
    GL(cv, hx + 10, y0 + 1, 0x9fe4ff, 0.4 + 0.2 * Math.sin(tt * 12))
    if (tt < 3.3) burst(cv, hx + 3, hy, tt - 3.0, 0xffffff, 0.3)
  } else if (tt >= 5.2 && tt < 6.4) {
    blitRot(cv, AXE, hx + 5, y0 + 2.5, -0.85 - seg(tt, 5.2, 5.8) * Math.PI * 2)
  }
  if (tt >= 3.0 && tt < 3.95) { const a = seg(tt, 3.0, 3.6); GL(cv, xT + 1, y0 + 2, 0x58d4ff, 0.9 * a); GL(cv, xT + 3, y0 + 2, 0x58d4ff, 0.9 * a); GL(cv, xT - 1, y0 + 2, 0xbfeaff, 0.35 * a); GL(cv, xT + 5, y0 + 2, 0xbfeaff, 0.35 * a) }
  if (tt >= 3.3 && tt < 3.9) { const a = seg(tt, 3.3, 3.9); for (let k = 0; k < 3; k++) lightning(cv, hx + 10 + (k - 1) * 9, y0, hx + 10, y0 + 1, n + k * 5, 0x9fe4ff, 1.4 + a); GL(cv, hx + 10, y0 + 1, 0xffffff, a) }
  if (tt >= 3.9 && tt < 4.45) { const hold = tt < 4.25; bolt(cv, hx + 11, y0 + 1, xg, y0 + 5, hold ? Math.floor(tt * 14) : n * 3 + 1, 0x7fd8ff); bolt(cv, hx + 11, y0 + 2, xg, y0 + 6, 5 + (hold ? Math.floor(tt * 14) : n), 0x7fd8ff); if (tt < 3.96) flashAll(cv, y0, 0, W, 0xcdeeff, 0.25); blob(cv, xg, y0 + 5, 6, 4, 0xffffff, 0x9fe4ff, 0.9 * (1 - (tt - 3.9) / 0.55)) }
  if (tt >= 6.4) {
    const u = (tt - 6.4) / 1.6, x = Math.round(xT + (W + 30 - xT) * Math.pow(u, 1.4)), yy = y0 + 6 - u * 12
    if (u < 0.2) { puff(cv, xT, gy - 1, 6, 0.55 * (1 - u / 0.2)); lightning(cv, xT, gy - 1, xT + 6, y0, n, 0xdff4ff, 1.5) }
    const fl2 = Math.floor((calm ? 0 : t) * 12) & 1
    for (let k = 0; k < 11; k++) { const cx2 = Math.round(x - 3 - k * 1.8), cy2 = yy + 3.4 + k * 0.5 + (k > 3 ? (fl2 ^ (k & 1)) : 0); const th2 = k < 6 ? 2 : 1; for (let j = 0; j < th2; j++) P(cv, cx2, cy2 + j, (j + k) & 1 ? 0xc41e2c : 0xe04050) ; P(cv, cx2 - 1, cy2, 0xc41e2c) }
    for (let k = 0; k < 3; k++) { const ly = Math.round(yy + 1 + k * 3 + 0.0); for (let i = 0; i < 12; i++) GL(cv, x - 16 - i - k * 4, ly + Math.floor(i * 0.25), 0xcff0ff, 0.5 * (1 - i / 12)) }
    blitRot(cv, THFLY, x, yy + 3, -0.6)
    blitRot(cv, AXE, x + 14, yy - 0.5, -0.9)
  }
}

// ---- HULK, "Puny god": stomps in, grabs a tiny Loki and ragdoll-slams him left, right, left
const HG = 0x44ac3c, HL = 0x78d654, HD = 0x1f6a2a, HP = 0x7a3aa8, HPL = 0xa868dc, HH = 0x2e1c52, HEY = 0xeaff7a
function hulkSpr(legs: 'stand' | 'runA' | 'runB', arms: 'down' | 'up' | 'fwd' | 'clasp', d: number): Spr {
  const g = grid(30, 11), c = 15
  const r = (x: number, y: number, w: number, h: number, col: number) => grect(g, c + x, y, w, h, col)
  // legs/feet
  if (legs === 'stand') { r(-5, 9 + d, 4, 2 - d, HD); r(1, 9 + d, 4, 2 - d, HD); r(-6, 10, 5, 1, HP); r(1, 10, 5, 1, HP) }
  else if (legs === 'runA') { r(-6, 9, 4, 1, HD); r(-8, 10, 5, 1, HP); r(3, 9, 4, 1, HD); r(3, 10, 6, 1, HP) }
  else { r(-4, 9, 4, 1, HD); r(-4, 10, 5, 1, HP); r(2, 9, 4, 1, HD); r(3, 9, 5, 1, HP) }
  // shorts, torso, shoulders
  r(-5, 8 + d, 10, 2, HP); r(-5, 8 + d, 10, 1, HPL)
  r(-5, 5 + d, 10, 3, HG); r(-5, 5 + d, 10, 1, HL); r(-1, 6 + d, 2, 1, HD); r(-3, 7 + d, 6, 1, HD)
  r(-8, 3 + d, 16, 2, HG); r(-8, 3 + d, 16, 1, HL); r(-4, 5 + d, 8, 1, HG)
  // head
  r(-3, d, 6, 3, HG); r(-3, d, 6, 1, HH); r(-3, 1 + d, 6, 1, HD); r(-2, 1 + d, 2, 1, HEY); r(1, 1 + d, 2, 1, HEY); r(-1, 2 + d, 2, 1, HD); r(-2, 2 + d, 1, 1, HL); r(1, 2 + d, 1, 1, HL)
  if (arms === 'down') { r(-11, 3 + d, 3, 5, HG); r(-12, 7 + d, 4, 2, HG); r(8, 3 + d, 3, 5, HG); r(8, 7 + d, 4, 2, HG); r(-11, 3 + d, 3, 1, HL); r(8, 3 + d, 3, 1, HL) }
  else if (arms === 'clasp') { r(-9, 3 + d, 3, 2, HG); r(-8, 1 + d, 3, 3, HG); r(-6, d, 3, 2, HG); r(-6, d, 3, 1, HL); r(6, 3 + d, 3, 2, HG); r(5, 1 + d, 3, 3, HG); r(3, d, 3, 2, HG); r(3, d, 3, 1, HL); r(-12, 5 + d, 3, 3, HG); r(9, 5 + d, 3, 3, HG) }
  else if (arms === 'up') { r(-11, 3 + d, 3, 3, HG); r(-12, 0 + d, 4, 3, HG); r(8, 3 + d, 3, 3, HG); r(9, 0 + d, 4, 3, HG); r(-12, d, 4, 1, HL); r(9, d, 4, 1, HL) }
  else { r(-11, 3 + d, 3, 5, HG); r(-12, 7 + d, 4, 2, HG); r(8, 4 + d, 7, 3, HG); r(14, 3 + d, 4, 4, HG); r(14, 3 + d, 4, 1, HL) }
  return g
}
const HU = { stand: hulkSpr('stand', 'down', 0), runA: hulkSpr('runA', 'down', 0), runB: hulkSpr('runB', 'down', 0), up: hulkSpr('stand', 'up', 0), fwd: hulkSpr('stand', 'fwd', 0), crouch: hulkSpr('stand', 'down', 2), clasp: hulkSpr('stand', 'clasp', 0), clenchC: hulkSpr('stand', 'clasp', 2) }
const LK_PAL = { g: 0xf0be3c, G: 0xffe58a, k: 0x14101c, s: 0xe8d4c0, c: 0x1a8a4a, C: 0x2fc06a, b: 0x2a5a2a }
const LOKI = fromRows(['g....g', 'g.gg.g', '.gssg.', '.cCCc.', 'cCbbCc', 'cbggbc', '.cbbc.', '.kk.kk'], LK_PAL)
const LOKI_FACE = fromRows(['g....g', 'g.gg.g', '.gsksg', '.cCCc.', 'cCbbCc', 'cbggbc', '.cbbc.', '.kk.kk'], LK_PAL)
// 3x5 pixel font for the SMASH! burst and the "puny god." beat
const FONT: Record<string, string> = { S: '111100111001111', M: '101111111101101', A: '010101111101101', H: '101101111101101', '!': '010010010000010', P: '111101111100100', U: '101101101101111', N: '110101101101101', Y: '101101010010010', G: '111100101101111', O: '111101101101111', D: '110101101101110', '.': '000000000000010', ' ': '000000000000000' }
function txt(cv: Canvas, str: string, x: number, y: number, c: number, sx: number, sy: number) {
  let cx = x
  for (const ch of str) {
    const f = FONT[ch]!
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (f[j * 3 + i] === '1') RC(cv, cx + i * sx, y + j * sy, sx, sy, c)
    cx += 3 * sx + sx
  }
}
// jagged floor cracks spreading out from a slam, age in seconds
function cracks(cv: Canvas, cx: number, y0: number, age: number) {
  if (age < 0) return
  const ext = Math.round(Math.min(1, age / 0.25) * 16)
  for (const dir of [-1, 1]) {
    let y = y0 + 11
    for (let i = 0; i <= ext; i++) {
      const x = cx + dir * i
      if ((i === 4 || i === 9 || i === 13) && y > y0 + 7) y -= 1
      RC(cv, x, y, 1, 1, 0x05050f); if (i % 3 === 0) GL(cv, x, y - 1, 0xeaffc8, 0.28)
    }
  }
}
function crater(cv: Canvas, cx: number, y0: number, age: number) {
  if (age < 0) return
  for (let i = -6; i <= 6; i++) { const dpt = Math.abs(i) < 4 ? 2 : 1; BL(cv, cx + i, y0 + 11, 0x0a0a16, 0.85); if (Math.abs(i) < 5) BL(cv, cx + i, y0 + 10, 0x12122a, dpt === 2 ? 0.9 : 0.5) }
  RC(cv, cx - 7, y0 + 10, 1, 1, 0x5a5a80); RC(cv, cx + 7, y0 + 10, 1, 1, 0x5a5a80)
  if (age < 0.5) for (let k = 0; k < 6; k++) { const a = age / 0.5; GL(cv, cx + Math.round((ff(k * 3.3) - 0.5) * 26 * a), y0 + 9 - Math.round(ff(k * 1.9) * 6 * a), 0xa8ff58, 0.5 * (1 - a)) }
}
const KT = [1.95, 2.35, 2.55, 2.85, 3.2, 3.35, 3.55, 3.85, 4.2, 4.35, 4.55, 5.0]
const KP = [2.0, 2.0, 4.83, 4.83, 4.7, 4.7, 1.45, 1.45, 2.0, 2.0, 4.83, 4.83]
const KH = [2.5, 2.5, 8, 8, 2.5, 2.5, 8, 8, 2.5, 2.5, 8, 8]
const IMPACT = [2.55, 3.55, 4.55], IDIR = [-1, 1, -1]
LANES.hulk = (cv, y0, t, calm) => {
  LY = y0
  const W = cv.W, tt = calm ? 3.0 : t % LT, gy = y0 + 11, xl = Math.round(W * 0.62), xH = xl - 28
  ground(cv, y0)
  crater(cv, xH - 15, y0, tt - 2.55); if (tt > 3.55) crater(cv, xH + 17, y0, tt - 3.55)
  cracks(cv, xH - 15, y0, tt - 2.55); cracks(cv, xH + 17, y0, tt - 3.55); if (tt > 4.55) { crater(cv, xH - 15, y0, tt - 4.55); cracks(cv, xH - 15, y0, tt - 4.55 + 1) }
  let X = xH, s = HU.stand, bob = 0
  const step = Math.floor(tt / 0.2) & 1
  if (tt < 1.5) { const u = tt / 1.5; X = Math.round(-2 + (xH + 2) * u); s = step ? HU.runA : HU.runB; bob = step ? 0 : -1 }
  else if (tt < 1.7) s = HU.stand
  else if (tt < 1.95) s = HU.fwd
  else if (tt >= 5.1 && tt < 6.2) s = HU.stand
  else if (tt >= 6.2) { const u = (tt - 6.2) / 1.8; X = Math.round(xH + (W + 30 - xH) * u * u); s = step ? HU.runA : HU.runB; bob = step ? 0 : -1 }
  // Loki on the ankle: keyframed angle psi (from straight down) and pivot height
  let holding = false, psi = 0, hy = 0.5
  if (tt >= KT[0]! && tt < 5.0) {
    holding = true
    let i = 0; while (i < KT.length - 2 && tt >= KT[i + 1]!) i++
    const u = (tt - KT[i]!) / (KT[i + 1]! - KT[i]!), up = KH[i + 1]! > KH[i]!, dn = KH[i + 1]! < KH[i]!
    const e = up ? u * u : dn ? 1 - (1 - u) * (1 - u) : u
    psi = KP[i]! + (KP[i + 1]! - KP[i]!) * e; hy = KH[i]! + (KH[i + 1]! - KH[i]!) * e
    if (tt < 2.35) psi += Math.sin(tt * 30) * 0.05
    s = hy > 4 ? HU.clenchC : HU.clasp
  }
  let shake = false
  for (let k = 0; k < 3; k++) if (tt >= IMPACT[k]! && tt < IMPACT[k]! + 0.12) shake = true
  // standing Loki, smug, then yanked in
  if (tt < 1.95) {
    const lx = tt >= 1.7 ? xl - 3 - Math.round(seg(tt, 1.7, 1.95) * (xl - 3 - (xH + 13))) : xl - 3
    blit(cv, tt >= 1.6 ? LOKI_FACE : (Math.floor(tt * 2) & 1) ? LOKI : LOKI_FACE, lx, y0 + 3)
    GL(cv, lx + 1 + (Math.floor(tt * 3) % 3), y0 + 3, 0xffffff, 0.35)
    if (tt > 0.5 && tt < 1.4) for (let k = 0; k < 3; k++) if (Math.floor(tt * 6) % 4 > k) RC(cv, xl + 3 + k * 2, y0, 1, 1, 0xf6f6ff)
  }
  if (shake) LOY = 1
  for (let i = 0; i < 16; i++) BL(cv, X - 8 + i, gy, 0x0c0c1a, 0.7)
  blit(cv, s, X - 15, y0 + bob)
  if (holding) {
    // the rope: two fists to the ankle
    if (hy < 4) { GL(cv, X, y0 + 1, 0xffe58a, 0.25) }
    blitRot(cv, LOKI, X + Math.sin(psi) * 15, y0 + hy + Math.cos(psi) * 5, Math.PI - psi)
  } else if (tt >= 5.0) {
    const tw = tt > 6.0 && (Math.floor(tt * 4) % 5 === 0)
    blitRot(cv, LOKI, xH - 15, y0 + 9, -1.69 + (tw ? 0.18 : 0))
    if (tt > 5.4 && tt < 6) GL(cv, xH - 17, y0 + 7, 0xffe58a, 0.5)
  }
  LOY = 0
  for (let i = 0; i < 3; i++) {
    const ia = tt - IMPACT[i]!, dir = IDIR[i]!, ix = xH + (dir < 0 ? -15 : 17)
    if (ia >= 0 && ia < 0.9) {
      const f = 1 - ia / 0.9
      puff(cv, ix - 6, gy - 2, 4, 0.55 * f); puff(cv, ix + 6, gy - 2, 4, 0.55 * f); puff(cv, ix + dir * ia * 14, gy - 3 - Math.round(ia * 3), 3, 0.4 * f)
      for (let k = 0; k < 4; k++) { const dd = Math.round(ia * 60), sgn = k & 1 ? 1 : -1; GL(cv, ix + sgn * (dd + k * 2), gy - 1 - (k >> 1), 0xeaffc8, 0.7 * f) }
      for (let k = 0; k < 6; k++) { const vx = (ff(k * 3.1 + i) - 0.5) * 30, vy = 14 + ff(k * 7.7) * 14, yy = Math.min(gy - 1, Math.floor(gy - 1 - (vy * ia - 40 * ia * ia))); if (ia < 0.7) RC(cv, Math.round(ix + vx * Math.min(ia, 0.7)), yy, 2, 1, k & 1 ? 0xbccaa0 : 0x8a9a70) }
      if (ia < 0.06) flashAll(cv, y0, ix - 18, ix + 18, 0xeaffc8, 0.4)
      if (ia < 0.3) burst(cv, ix, y0 + 9, ia, 0xa8ff58, 0.3)
    }
  }
  // SMASH! on the last slam, then the "puny god." beat
  if (tt >= 4.55 && tt < 5.5) {
    const sj = tt < 4.75 ? (Math.floor(tt * 40) & 1) : 0, tx = Math.min(xH + 22, W - 50), ty = y0 + 1
    if (tt < 4.62) flashAll(cv, y0, tx - 4, tx + 52, 0xffffff, 0.45)
    txt(cv, 'SMASH!', tx + 1 + sj, ty + 1, 0xc01810, 2, 2); txt(cv, 'SMASH!', tx + sj, ty, 0xffe030, 2, 2)
  }
  if (tt >= 5.6 && tt < 7.0) { const tx = Math.min(xH + 22, W - 74); txt(cv, 'PUNY GOD.', tx, y0 + 4, 0xffffff, 2, 1) }
  if (tt >= 5.1 && tt < 6.2) { const k = tt * 3 % 1; GL(cv, X + 1, y0 + 2 - Math.round(k * 2), 0xe6f6e0, 0.5 * (1 - k)); GL(cv, X - 2, y0 + 2 - Math.round(k * 2), 0xe6f6e0, 0.5 * (1 - k)) }
  if (!calm && (tt < 1.5 || tt >= 6.3) && step === 0) puff(cv, X - 2, gy - 1, 3, 0.35)
}

// ---- BLACK WIDOW: sprints in, thigh-choke flip onto a goon, three-point landing, a Bite for good measure
const BWL: Look = {
  hood: 0xd02818, hoodL: 0xff6a28, side: 0xd02818, sideLen: 4, skin: 0xf6c8a4, lower: 0xe0aa88, torso: 0x2a2c48, torsoL: 0x5a5e8c, belt: 0x8a90c8, legs: 0x2a2c48, boots: 0x14142a, eye: 0x2a1820,
  deco: (g, bx, d) => { gput(g, bx + 5, 5 + d, 0xff4040); gput(g, bx + 6, 5 + d, 0xff4040); gput(g, bx + 11, 7 + d, 0x58c0ff); gput(g, bx, 7 + d, 0x58c0ff) },
}
const WR = rig(BWL)
const GOONL: Look = { hood: 0x9a9ec0, hoodL: 0xc0c4e0, side: 0x9a9ec0, sideLen: 0, skin: 0x50546e, lower: 0x50546e, torso: 0x7a80a8, torsoL: 0xa8aed0, belt: 0x40445e, legs: 0x5a5e80, boots: 0x30344c, eye: 0xff3030, deco: (g, bx, d) => { grect(g, bx + 10, 5 + d, 4, 1, 0x40445e) } }
const GR = rig(GOONL)
const WP = { r: 0xd02818, R: 0xff6a28, k: 0xf6c8a4, b: 0x2a2c48, B: 0x5a5e8c, s: 0x8a90c8, u: 0x58c0ff, e: 0x2a1820 }
const W_LEAP = fromRows(['..rr.......rrr..', '.rRrr.....rkkkr.', 'rrRrbbbbbbbkekku', '..rrbBBBBBbbbbk.', '....bbb..bbb....', '...bb.....bb....'], WP)
const W_TUCK = fromRows(['...rrrr...', '..rRRRRr..', '.rR.kk.Rr.', '.r.kekk.r.', '..bbBBbb..', '.bbbBBbbb.', '..bb..bb..'], WP)
const W_CLAMP = fromRows(['..bbbbbb....', '.bbBBBBbb...', '.bb....bbb..', '..bbBBbbb...', '...bssb.....', '...bBBb.....', '....rkkr....', '...rRkekr...', '...rrRRrr...'], WP)
const W_SPIN = fromRows(['.......rrrr...', '....bb.rRRRr..', '..bbBBbkkekr..', '.bbBBBbbkkuk..', 'bbbBBbb.bbb...', '.bb...........'], WP)
function wpose(cv: Canvas, s: Spr, cx: number, cy: number, age: number, dir: number) {
  if (age < 0.06) blit(cv, s, Math.round(cx - s.w / 2) - 4 * dir, Math.round(cy - s.h / 2), false, 0x3a3e68)
  blit(cv, s, Math.round(cx - s.w / 2), Math.round(cy - s.h / 2))
}
const HEAP = fromRows(['..o...oo....o.', '.oGGo.oGGo.oGo', 'oGgGGoGGgGGGGo', 'oxxGGxxGGxxGxo'], DR_PAL)
LANES.widow = (cv, y0, t, calm) => {
  LY = y0
  const W = cv.W, tt = calm ? 3.3 : t % LT, gy = y0 + 11, xg = Math.round(W * 0.66), xw0 = xg - 30, n = Math.floor(t * 25)
  ground(cv, y0)
  const tl = 1.4, tc = 1.9, tf = 2.7 // leap, clamp on, thrown
  // goon (faces left, so flipped)
  const hurl = seg(tt, tc, tf)
  const goonBase = xg
  if (tt < tc) {
    const al = tt > tl - 0.05 && tt < tl + 0.4
    fig(cv, tt > 0.5 && (Math.floor(tt / 0.5) & 1) && tt < tl ? GR.stand : GR.stand, goonBase, y0, true)
    if (al) { RC(cv, goonBase - 1, y0 - 1 + 0, 1, 3, 0xffe040); RC(cv, goonBase - 1, y0 + 3, 1, 1, 0xffe040) }
  } else if (tt < tf + 0.5) {
    // thrown over her head: stand, tilt, flat; then he lands in a heap
    const e = hurl, gxx = goonBase - 22 * e, gyy = y0 + 5.5 - Math.sin(e * Math.PI) * 4 + (e >= 1 ? 3 : 0)
    if (e < 1) blitRot(cv, GR.stand, gxx, gyy, e < 0.3 ? 0.0 : e < 0.6 ? 0.9 : 1.57, true)
    else blit(cv, HEAP, goonBase - 22 - 7, y0 + 7)
  } else {
    blit(cv, HEAP, goonBase - 22 - 7, y0 + 7)
    const ha = tt - tf - 0.5
    if (ha < 1.5 || (ha > 2.4 && ha < 2.6) || (tt > 4.8 && tt < 5.4)) { for (let k = 0; k < 3; k++) { const r2 = Math.floor(tt * 14) + k * 5; GL(cv, goonBase - 28 + Math.floor(ff(r2) * 12), y0 + 6 + Math.floor(ff(r2 + 3) * 4), k & 1 ? 0xffe060 : 0x9fe0ff, 0.8) } }
  }
  // goon after landing: sparks and the Bite
  const bz = tt - 5.0
  if (tt >= 4.6 && tt < 5.5) { /* handled below */ }
  // Widow
  let drawn = true
  if (tt < 1.3) {
    const u = tt / 1.3, X = Math.round(-4 + (xw0 + 4) * u), r = Math.floor(tt / 0.1) & 1
    fig(cv, RUN(WR, tt), X, y0, false, -1, RBOB(tt))
    if (r) puff(cv, X - 7, gy - 1, 2, 0.35)
  } else if (tt < tl) fig(cv, WR.crouch, xw0, y0)
  else if (tt < tc) {
    const u = (tt - tl) / (tc - tl), x = xw0 + (xg - 3 - xw0) * u, y = y0 + 7.5 - Math.sin(u * Math.PI) * 2.8 - u * 3
    for (let k = 1; k <= 4; k++) GL(cv, Math.round(x - k * 3), y + 1, 0x58c0ff, 0.3 / k * 2)
    if (u < 0.45) wpose(cv, W_LEAP, x, y, u < 0.1 ? (u - 0) / 0.5 * 0.06 / 0.06 * 0.01 : 1, 1); else if (u < 0.8) wpose(cv, W_TUCK, x, y, (u - 0.45) / 0.35 * 0.2 > 0.06 ? 1 : 0, 1); else wpose(cv, W_CLAMP, x, y, 1, 1)
  } else if (tt < tf) {
    // clamped on his shoulders, then spinning out of the throw
    const e = hurl, x = xg - 3 - 6 * e, y = y0 + 3.5 + 2.5 * e - Math.sin(e * Math.PI) * 2.5
    if (e < 0.35) wpose(cv, W_CLAMP, xg - 3, y0 + 4, 1, 1); else wpose(cv, W_SPIN, x, y, e < 0.4 ? 0 : 1, 1)
    GL(cv, xg - 2, y0 + 3, 0x58c0ff, 0.5)
  } else if (tt < 4.0) { fig(cv, WR.land, xg - 12, y0) }
  else if (tt < 4.4) fig(cv, WR.crouch, xg - 12, y0)
  else if (tt < 6.0) {
    fig(cv, WR.reach, xg - 12, y0)
  } else if (tt < 6.3) fig(cv, WR.crouch, xg - 12, y0)
  else {
    const u = (tt - 6.3) / 1.7, X = Math.round(xg - 12 + (W + 30 - xg + 12) * u * u), r = Math.floor(tt / 0.1) & 1
    fig(cv, RUN(WR, tt), X, y0, false, -1, RBOB(tt)); if (r) puff(cv, X - 7, gy - 1, 2, 0.35)
  }
  void drawn
  // impact on landing
  const ia = tt - tf
  if (ia >= 0 && ia < 1.0) { const f = 1 - ia; puff(cv, xg - 22, gy - 2, 4, 0.55 * f); puff(cv, xg - 14, gy - 2, 4, 0.5 * f); puff(cv, xg - 30, gy - 2, 3, 0.45 * f); if (ia < 0.3) burst(cv, xg - 22, y0 + 9, ia, 0xffe080, 0.3); if (ia < 0.06) flashAll(cv, y0, xg - 36, xg - 6, 0xffffff, 0.35) }
  // Bite crackle on her fist during the landing hold
  if (tt >= tf && tt < 4.4) { const fx = xg - 12 + 12, fy = y0 + 10; for (let k = 0; k < 3; k++) lightning(cv, fx, fy, fx + 3 + k * 2, fy - 3 - k, n + k * 4, 0x58c0ff, 1.2); GL(cv, fx, fy, 0x9fe0ff, 0.8) }
  // the Bite: wrist to goon
  if (tt >= 4.8 && tt < 5.3) {
    const wx = xg - 12 + 13, wy = y0 + 5, gxx = xg - 22
    lightning(cv, wx, wy, gxx + 5, y0 + 8, n, 0xcff0ff, 2.5); lightning(cv, wx, wy, gxx + 5, y0 + 9, n + 7, 0x58c0ff, 2.5)
    burst(cv, wx + 1, wy, tt - 4.8, 0x9fe0ff, 0.2); blob(cv, gxx + 3, y0 + 8, 5, 2, 0xcff0ff, 0x58c0ff, 0.5)
    if (tt < 4.86) flashAll(cv, y0, gxx - 8, gxx + 14, 0x58c0ff, 0.25)
  }
  void bz
}

// ---- SPIDER-MAN, "Thwip, thwip": swings in on a web from the top edge, lands in a crouch, two web shots cocoon a thug, swings off
const SPL: Look = {
  hood: 0xd82030, hoodL: 0xff5050, side: 0xd82030, sideLen: 2, skin: 0xd82030, lower: 0xb01828, torso: 0xd82030, torsoL: 0xff5050, belt: 0x2c50b4, legs: 0x2c50b4, boots: 0xd82030, eye: 0xf6f6ff,
  deco: (g, bx, d) => { gput(g, bx + 5, 2 + d, 0xf6f6ff); gput(g, bx + 9, 2 + d, 0xf6f6ff); gput(g, bx + 6, 5 + d, 0x14061a); gput(g, bx + 5, 6 + d, 0x14061a); gput(g, bx + 7, 6 + d, 0x14061a); grect(g, bx + 2, 5 + d, 1, 2, 0x2c50b4); grect(g, bx + 9, 5 + d, 1, 2, 0x2c50b4) },
}
const SR = rig(SPL)
const SBALL = fromRows(['..rrrrrr..', '.rrwrrwrr.', 'rrrrrrrrrr', 'rrrrkkrrrr', 'rbbrkkrbbr', '.bbbrrbbb.'], { r: 0xd82030, w: 0xf6f6ff, k: 0x14061a, b: 0x2c50b4 })
const WEB = 0xf6f8ff
// a bright white web line, 2 columns wide with a lavender glow so it reads at once
function webLine(cv: Canvas, x0: number, y0: number, x1: number, y1: number) { sl(cv, Math.round(x0), y0, Math.round(x1), y1, WEB); sl(cv, Math.round(x0) + 1, y0, Math.round(x1) + 1, y1, WEB); sl(cv, Math.round(x0) - 1, y0, Math.round(x1) - 1, y1, 0x9aa8ff, 0.35) }
// the thug: orange jacket, flat cap, grey trousers (nothing else in the lane is orange)
const THUG = fromRows(['..kkkk..', '.kkkkkk.', '.sesses.', '..ssss..', 'jjjjjjjj', 'jJjjjjJj', 'sjjjjjjs', '.jjjjjj.', '.pppppp.', '.pp..pp.', '.kk..kk.'], { k: 0x14101c, s: 0xe8b890, e: 0x14101c, j: 0xe0701c, J: 0xffa848, p: 0x6a6a8a })
const THUGS = fromRows(['..kkkk..', '.kkkkkk.', '.sessse.', '..ssss..', 'jjjjjjjj', 'jJjjjjJj', 'jjjjjjjj', 'sjjjjjjs', '.pppppp.', '.pp..pp.', '.kk..kk.'], { k: 0x14101c, s: 0xe8b890, e: 0x14101c, j: 0xe0701c, J: 0xffa848, p: 0x6a6a8a })
// webbed bundles: legs/torso first, then the whole thug in a white cocoon
function cocoon(r0: number): Spr {
  const g = grid(10, 11), hw = [2, 3, 3, 4, 5, 5, 5, 5, 5, 4, 4]
  for (let j = r0; j < 11; j++) for (let i = 5 - hw[j]!; i < 5 + hw[j]!; i++) gput(g, i, j, (i + j) % 4 === 0 ? 0x8f9ee8 : (i - j + 20) % 5 === 0 ? 0xc4cdfa : 0xf6f8ff)
  return g
}
const COC1 = cocoon(5), COC2 = cocoon(0)
LANES.spidey = (cv, y0, t, calm) => {
  LY = y0
  const W = cv.W, tt = calm ? 4.8 : t % LT, gy = y0 + 11, xS = Math.round(W * 0.3), xt = Math.round(W * 0.7)
  ground(cv, y0)
  const L = 14, Lx = 2.4 * 17 * 0.9, aY = y0 - 10
  // the thug waits, with a nervous shuffle, until he is wrapped
  let wob = 0
  if (tt >= 4.0 && tt < 6.0) wob = (Math.floor(tt / 0.13) & 1) ? 1 : -1
  if (tt < 3.2) blit(cv, (Math.floor(tt * 3) & 1) ? THUG : THUGS, xt, y0)
  else if (tt < 3.7) { blit(cv, THUGS, xt, y0); blit(cv, COC1, xt - 1 + (Math.floor(tt / 0.1) & 1), y0) }
  else { blit(cv, COC2, xt - 1 + wob, y0); if (tt < 3.85) flashAll(cv, y0, xt - 12, xt + 14, 0xffffff, 0.35) }
  // 1: swing in on a web anchored above the lane, a clean pendulum arc (0..1.7)
  const ax = xS - 30
  if (tt < 1.7) {
    const th = -1.35 + 2.4 * ease(seg(tt, 0.0, 1.7)), hx = ax + Math.sin(th) * Lx, hy = aY + Math.cos(th) * L
    webLine(cv, ax, y0, hx, hy)
    for (let k = 1; k <= 4; k++) { const th2 = th - k * 0.09; GL(cv, Math.round(ax + Math.sin(th2) * Lx), aY + Math.cos(th2) * L + 5, 0xff6070, 0.45 / k * 1.5) }
    blitRot(cv, SR.hang, hx, hy + 1, -th * 0.5)
  } else if (tt < 2.2) {
    // let go, tuck and flip, drop to the ground
    const u = (tt - 1.7) / 0.5, sx0 = ax + Math.sin(1.05) * Lx, x = sx0 + (xS - sx0) * u, y = y0 + 2 - Math.sin(u * Math.PI) * 3 + u * 4
    for (let k = 1; k <= 3; k++) GL(cv, Math.round(x - k * 4), y + 1, 0xff6070, 0.4 / k * 2)
    blitRot(cv, SBALL, x, y, Math.floor(u * 5) * Math.PI / 2)
  } else if (tt < 2.5) {
    const a = 1 - (tt - 2.2) / 0.3
    fig(cv, SR.land, xS, y0); puff(cv, xS - 8, gy - 1, 4, 0.55 * a); puff(cv, xS + 8, gy - 1, 4, 0.55 * a)
    if (tt < 2.26) flashAll(cv, y0, xS - 14, xS + 14, 0xffffff, 0.2)
  } else if (tt < 2.95) fig(cv, SR.crouch, xS, y0)
  else if (tt < 3.55) fig(cv, SR.reach, xS, y0)
  else if (tt < 4.15) fig(cv, SR.aim, xS, y0)
  else if (tt < 5.6) { fig(cv, SR.stand, xS, y0); if (tt > 4.5 && tt < 5.4) RC(cv, xS + 7, y0 + 4, 2, 1, 0xf6c8a4) }
  else if (tt < 6.2) fig(cv, SR.crouch, xS, y0)
  // 2: shot 1 at the legs and body, shot 2 at the head and arms
  const fx = xS + 12, fy = y0 + 5
  for (let k = 0; k < 2; k++) {
    const ts = k === 0 ? 2.95 : 3.55, tgx = xt + 4, tgy = k === 0 ? y0 + 7 : y0 + 3
    if (tt >= ts && tt < ts + 0.45) {
      const p = seg(tt, ts, ts + 0.22), a = tt - ts
      webLine(cv, fx, fy, fx + (tgx - fx) * p, fy + (tgy - fy) * p)
      if (a < 0.2) burst(cv, fx, fy, a, 0xffffff, 0.2)
      if (a >= 0.22 && a < 0.45) { burst(cv, tgx, tgy, a - 0.22, 0xffffff, 0.23); blob(cv, tgx, tgy, 5, 2, 0xffffff, 0xb0c0ff, 0.5 * (1 - (a - 0.22) / 0.23)) }
    }
  }
  // 3: thwip up, swing off on a web from the top edge (6.2..8)
  if (tt >= 5.9 && tt < 6.2) { const sh = seg(tt, 5.9, 6.1); webLine(cv, xS + 6, y0 + 3, xS + 6 + 22 * sh, y0 + 3 - 3 * sh); burst(cv, xS + 6, y0 + 3, tt - 5.9, 0xffffff, 0.2) }
  if (tt >= 6.2) {
    const ax2 = xS + 28, u = seg(tt, 6.2, 7.3), th = -0.78 + 1.95 * ease(u)
    if (tt < 7.3) {
      const hx = ax2 + Math.sin(th) * Lx, hy = aY + Math.cos(th) * L
      webLine(cv, ax2, y0, hx, hy)
      for (let k = 1; k <= 4; k++) { const th2 = th - k * 0.09; GL(cv, Math.round(ax2 + Math.sin(th2) * Lx), aY + Math.cos(th2) * L + 5, 0xff6070, 0.45 / k * 1.5) }
      blitRot(cv, SR.hang, hx, hy + 1, -th * 0.5)
      if (u < 0.12) puff(cv, xS, gy - 1, 3, 0.4 * (1 - u / 0.12))
    } else {
      const x0 = ax2 + Math.sin(1.17) * Lx, y1 = aY + Math.cos(1.17) * L, v = seg(tt, 7.3, 8.0), x = x0 + (W + 24 - x0) * v, y = y1 - Math.sin(v * Math.PI * 0.8) * 2
      for (let k = 1; k <= 4; k++) GL(cv, Math.round(x - k * 4), y + 3, 0xff6070, 0.45 / k * 1.5)
      blitRot(cv, SBALL, x, y + 3, v * 9)
    }
  }
}

// ---- HAWKEYE: grapple arrow reels in a crate, explosive arrow blows it up, then a no-look shot splits the bullseye
const HEL: Look = {
  hood: 0x6c2cb8, hoodL: 0xa468ee, side: 0x6c2cb8, sideLen: 3, skin: 0xf2b890, lower: 0xc88a68, torso: 0x6c2cb8, torsoL: 0xa468ee, belt: 0xe0a050, legs: 0x4a1c88, boots: 0x2a1050, eye: 0xf4f4ff,
  deco: (g, bx, d) => { grect(g, bx + 2, d, 8, 1, 0x4a1c88); grect(g, bx + 5, 5 + d, 4, 1, 0x4a1c88); gput(g, bx + 9, 5 + d, 0xe0a050) },
}
const HR = rig(HEL)
const CRATE = fromRows(['oooooooooooo', 'owwwwwwwwwwo', 'owoooooooowo', 'owowwwwwwowo', 'owoooooooowo', 'owwwwwwwwwwo'], { o: 0x5a3a14, w: 0xb07a38 })
function arrow(cv: Canvas, x: number, y: number, len: number, tipC = 0xffffff, hot = false) {
  for (let i = 0; i < len; i++) P(cv, x - i, y, i < 4 ? 0xd02838 : 0xdcdcec)
  RC(cv, x - len + 1, y - 1, 3, 1, 0xd02838); RC(cv, x - len + 1, y + 1, 3, 1, 0xd02838)
  P(cv, x + 1, y, hot ? 0xff4020 : tipC)
}
function bowAt(cv: Canvas, bx: number, y0: number, pull: number, dir: number) {
  for (let j = -4; j <= 4; j++) { const xb = bx + dir * Math.round(1.8 * (1 - Math.abs(j) / 4.5)); P(cv, xb, y0 + 5 + j, Math.abs(j) % 2 ? 0xe0a050 : 0x9a6428) }
  const nx = bx - dir * (1 + pull)
  sl(cv, bx - dir, y0 + 1, nx, y0 + 5, 0xe8e8f0); sl(cv, nx, y0 + 5, bx - dir, y0 + 9, 0xe8e8f0)
}
// opaque palette fireball: white-yellow core, orange body, red-orange rim, then grey smoke
function fireball(cv: Canvas, x: number, yc: number, age: number) {
  if (age < 0 || age > 1.7) return
  const grow = Math.min(1, age / 0.35), shrink = age < 0.5 ? 1 : Math.max(0, 1 - (age - 0.5) / 0.4)
  if (shrink > 0 && age >= 0.04) {
    const rx = Math.round((4 + 14 * grow) * (0.5 + 0.5 * shrink)), ry = Math.round((2 + 3.5 * grow) * (0.5 + 0.5 * shrink))
    for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
      const d = Math.hypot(i / (rx + 0.5), j / (ry + 0.5)); if (d > 1) continue
      const lump = ff(Math.floor((i + 40) / 3) * 7 + j + Math.floor(age * 12)) * 0.12
      const dd = d + lump
      P(cv, x + i, yc + j, dd > 0.82 ? 0xe04a1e : dd > 0.5 ? 0xff9a2e : shrink > 0.5 ? 0xfff3b0 : 0xffc040)
    }
  }
  if (age >= 0.3) {
    const v = age - 0.3
    for (let k = 0; k < 5; k++) { const px = x + (k - 2) * 5 + Math.round(Math.sin(k + v * 3)), py = Math.round(yc - 2 - v * 5 - (k & 1) * 2); if (v < 1.4 - (k & 1) * 0.3) { RC(cv, px - 1, py, 4, 2, k & 1 ? 0x4a4a5e : 0x62627a); RC(cv, px, py - 1, 2, 1, 0x62627a) } }
  }
}
LANES.hawkeye = (cv, y0, t, calm) => {
  LY = y0
  const W = cv.W, tt = calm ? 3.55 : t % LT, gy = y0 + 11, xH = Math.round(W * 0.16), xt = W - 18, n = Math.floor(t * 20)
  ground(cv, y0)
  const bx = xH + 13
  // crate
  const crx0 = Math.round(W * 0.72), crx1 = Math.round(W * 0.5)
  const reel = seg(tt, 1.8, 2.8)
  const crx = Math.round(crx0 + (crx1 - crx0) * ease(reel))
  const crateAlive = tt < 3.75
  // target with a stuck arrow, splits at 6.25
  for (let j = -4; j <= 4; j++) for (let i = -6; i <= 6; i++) { const d = Math.hypot(i / 6.5, j / 4.5); if (d > 1) continue; const wob = tt > 6.25 && tt < 7.2 ? Math.round(Math.sin((tt - 6.25) * 40) * (1 - (tt - 6.25) / 0.95) * 1.2) : 0; P(cv, xt + i + wob, y0 + 5 + j, d > 0.8 ? 0xf6f6ff : d > 0.55 ? 0xe03040 : d > 0.3 ? 0xf6f6ff : 0xe03040) }
  RC(cv, xt - 1, y0 + 9, 2, 3, 0x7a5a30)
  if (tt < 6.25) arrow(cv, xt - 1, y0 + 5, 9)
  // hawkeye
  let s = HR.stand, flip = false, X = xH, pull = 0, bowOn = false, bob = 0
  if (tt < 0.9) { const u = tt / 0.9; X = Math.round(-4 + (xH + 4) * u); s = RUN(HR, tt); bob = RBOB(tt) }
  else if (tt < 3.7) { s = HR.drawn; bowOn = true; pull = tt < 1.0 ? 0 : tt < 1.5 ? seg(tt, 1.0, 1.5) * 8 : tt < 1.7 ? 0 : tt < 3.0 ? 0 : tt < 3.45 ? seg(tt, 3.0, 3.45) * 8 : 0 }
  else if (tt < 4.7) { s = HR.stand }
  else if (tt < 6.9) {
    flip = true; s = tt < 6.45 ? HR.wind : HR.stand
    bowOn = tt < 6.45; pull = tt < 5.7 ? 0 : tt < 6.0 ? seg(tt, 5.7, 6.0) * 4 : 0
  }
  else { const u = (tt - 6.9) / 1.1; X = Math.round(xH - 8 - (xH + 30) * u * u); flip = true; s = RUN(HR, tt); bob = RBOB(tt) }
  if (tt >= 0.9) for (let i = 0; i < 12; i++) BL(cv, X - 6 + i, gy, 0x0c0c1a, 0.6)
  if (tt >= 0.9 && tt < 1.0) { /* settle */ }
  fig(cv, s, X, y0, flip, -1, bob)
  if (bowOn && !flip) bowAt(cv, bx, y0, pull, 1)
  if (bowOn && flip) bowAt(cv, X + 13, y0, pull, 1)
  // nocked arrow while drawing
  if (!flip) {
    if (tt >= 1.0 && tt < 1.5) { const nx = bx - 1 - pull; arrow(cv, bx + 5, y0 + 5, bx + 5 - nx + 1, 0xffffff) }
    if (tt >= 3.0 && tt < 3.45) { const nx = bx - 1 - pull; arrow(cv, bx + 5, y0 + 5, bx + 5 - nx + 1, 0xffffff, true); GL(cv, bx + 6, y0 + 5, 0xff4020, 0.5 + 0.4 * Math.sin(tt * 40)) }
  } else if (tt >= 5.7 && tt < 6.0) { const nx = X + 13 - 1 - pull; arrow(cv, X + 13 + 5, y0 + 5, X + 13 + 5 - nx + 1) }
  // grapple arrow: flight, cable, crate yank
  if (tt >= 1.5 && tt < 3.0) {
    const fa = seg(tt, 1.5, 1.8), px = Math.round(bx + 5 + (crx0 - 2 - bx - 5) * fa)
    if (tt < 1.8) { arrow(cv, px, y0 + 5, 10); for (let i = 0; i < 22; i++) GL(cv, px - i, y0 + 5, 0xc8a0ff, 0.5 * (1 - i / 22)) }
    const ex = tt < 1.8 ? px : crx - 1
    sl(cv, bx + 2, y0 + 5, ex - 6, y0 + 5, 0xcfd2e0)
    if (tt >= 1.8) { arrow(cv, crx + 1, y0 + 5, 9); burst(cv, crx, y0 + 5, tt - 1.8, 0xffffff, 0.25) }
    if (reel > 0 && reel < 1) { puff(cv, crx + 8, gy - 1, 3, 0.5); puff(cv, crx + 13, gy - 1, 3, 0.35) }
  }
  if (crateAlive) blit(cv, CRATE, crx - 6, y0 + 5)
  // explosive arrow
  if (tt >= 3.45 && tt < 3.72) {
    const fa = seg(tt, 3.45, 3.72), px = Math.round(bx + 5 + (crx1 - 4 - bx - 5) * fa)
    arrow(cv, px, y0 + 5, 10, 0xffffff, true); for (let i = 0; i < 18; i++) GL(cv, px - i, y0 + 5, 0xff6030, 0.6 * (1 - i / 18)); GL(cv, px + 1, y0 + 5, 0xff3010, 0.8)
  }
  fireball(cv, crx1, y0 + 6, tt - 3.72)
  if (tt >= 6.45 && tt < 6.9) { const a = 1 - (tt - 6.45) / 0.45; GL(cv, X - 2, y0 + 2, 0xffffff, 0.9 * a); GL(cv, X - 3, y0 + 2, 0xffffff, 0.4 * a); GL(cv, X - 1, y0 + 2, 0xffffff, 0.4 * a); GL(cv, X - 2, y0 + 1, 0xffffff, 0.4 * a) }
  if (tt >= 3.72 && tt < 3.76) { for (let yy = 0; yy < 12; yy++) for (let xx = crx1 - 10; xx < crx1 + 10; xx++) if (Math.hypot((xx - crx1) / 10, (yy - 6) / 6) < 1) P(cv, xx, y0 + yy, 0xffffff) }
  if (tt >= 3.72 && tt < 4.6) for (let k = 0; k < 8; k++) { const a = tt - 3.72, vx = (ff(k * 4.1) - 0.5) * 48, vy = 10 + ff(k * 2.7) * 14, yy = Math.min(gy - 2, Math.floor(y0 + 8 - (vy * a - 38 * a * a))), px = Math.round(crx1 + vx * Math.min(a, 0.8)); if ((Math.floor(a * 10) + k) & 1) RC(cv, px, yy, 3, 1, k & 1 ? 0xb07a38 : 0x7a5018); else RC(cv, px, yy - 1, 1, 3, k & 1 ? 0xb07a38 : 0x7a5018) }
  // the no-look shot
  if (tt >= 6.0 && tt < 6.25) {
    const fa = seg(tt, 6.0, 6.25), px = Math.round(X + 18 + (xt - 10 - X - 18) * fa)
    arrow(cv, px, y0 + 5, 10); for (let i = 0; i < 24; i++) GL(cv, px - i, y0 + 5, 0xc8a0ff, 0.55 * (1 - i / 24))
    for (let k = 0; k < 4; k++) { const ly = y0 + 2 + k * 2, ln = 10 + k * 5; for (let i = 0; i < ln; i++) GL(cv, px - 6 - i - k * 3, ly, 0xb888ff, 0.35 * (1 - i / ln)) }
  }
  if (tt >= 6.25 && tt < 8.0) {
    const a = tt - 6.25
    arrow(cv, xt + 1, y0 + 5, 11)
    // the old arrow splits and flies apart
    if (a < 0.9) { const dy = Math.round(a * 9), dx = Math.round(a * 10); RC(cv, xt - 6 - dx, y0 + 3 - Math.round(a * 4), 4, 1, 0xdcdcec); RC(cv, xt - 8 - dx, y0 + 2 - Math.round(a * 4), 2, 1, 0xd02838); RC(cv, xt - 5 - dx, y0 + 7 + dy / 3, 4, 1, 0xdcdcec); RC(cv, xt - 7 - dx, y0 + 8 + dy / 3, 2, 1, 0xd02838) }
    burst(cv, xt - 2, y0 + 5, a, 0xffffff, 0.3)
    if (a < 0.4) blob(cv, xt, y0 + 5, 7, 4, 0xffffff, 0xc8a0ff, 0.7 * (1 - a / 0.4))
    if (a < 0.06) flashAll(cv, y0, xt - 16, W, 0xe8d8ff, 0.3)
  }
}
