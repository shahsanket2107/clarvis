// Hand-drawn pixel art for the Guardians (see ../portraits.ts for the format).
// Each portrait is drawn as the RIGHT half only (right-aligned, '.' clear) and mirrored
// to 36 x 14 subpixels; a few asymmetric tweaks and animation patches are applied after.
import { pixmap, type LaneArt, type StageArt } from './pixmap'
import type { Canvas, HiSprite } from '../pixel'
import { hash, lerp } from '../pixel'
export const STAGES: Partial<Record<string, StageArt>> = {}
export const LANES: Partial<Record<string, LaneArt>> = {}

type Pal = Record<string, number>
type Patch = Record<number, string> // half-row replacements
const W = 36
function half(r: string) { return r.padStart(18, '.') }
function mirror(rows: readonly string[]): string[] {
  return rows.map(r => { const h = half(r); return h + [...h].reverse().join('') })
}
function build(rows: string[], pal: Pal, patch: Patch = {}, tweaks: [number, number, string][] = []): HiSprite {
  const out = mirror(rows.map((r, y) => patch[y] ?? r)).map(r => r.split(''))
  for (const [x, y, c] of tweaks) out[y]![x] = c
  return pixmap(out.map(r => r.join('')), pal)
}
type Glow = [number, number, number] // subpixel x, y, colour
// the same sprite one row higher (a 1-px breath up; the last row repeats so nothing leaves the box)
function rise(s: HiSprite): HiSprite {
  const n = s.w * s.h, px = new Int32Array(n), a = new Uint8Array(n)
  px.set(s.px.subarray(s.w), 0); a.set(s.a.subarray(s.w), 0); px.set(s.px.subarray(n - s.w), n - s.w); a.set(s.a.subarray(n - s.w), n - s.w)
  return { w: s.w, h: s.h, px, a }
}
type Alt = { rows: string[]; blink?: Patch; from: number; to: number; per: number }
function hero(key: string, rows: string[], pal: Pal, o: {
  blink?: Patch; sway?: Patch; tweaks?: [number, number, string][]; glows?: Glow[]; period?: number; bEvery?: number; bLen?: number
  swayAt?: [number, number, number]; beat?: Patch; beatTweaks?: [number, number, string][]; alt?: Alt; fx?: (cv: Canvas, tt: number) => void
}) {
  const mk = (r: string[], blink?: Patch, sway?: Patch) => { const b = build(r, pal, {}, o.tweaks), bl = blink ? build(r, pal, blink, o.tweaks) : b, sw = sway ? build(r, pal, sway, o.tweaks) : b; return [b, bl, sw, rise(b), rise(bl), rise(sw)] }
  const main = mk(rows, o.blink, o.sway), alt = o.alt ? mk(o.alt.rows, o.alt.blink) : null
  const bt = o.beat ? (() => { const b = build(rows, pal, o.beat!, o.beatTweaks ?? []); return [b, rise(b)] })() : null
  const glows = o.glows ?? []
  STAGES[key] = (cv, t, calm) => {
    const tt = calm ? 0 : t
    const up = !calm && tt % 2.6 < 0.8 ? 3 : 0
    const bl = !calm && tt % (o.bEvery ?? 4.2) < (o.bLen ?? 0.16)
    const sw = !calm && (o.swayAt ? tt % o.swayAt[0] >= o.swayAt[1] && tt % o.swayAt[0] < o.swayAt[2] : Math.floor(tt / (o.period ?? 0.9)) % 2 === 1)
    const isAlt = !calm && !!alt && tt % o.alt!.per >= o.alt!.from && tt % o.alt!.per < o.alt!.to
    const set = isAlt ? alt! : main
    const beat = !calm && !!bt && tt % 3 >= 1.4 && tt % 3 < 1.9
    cv.hi(beat && !isAlt ? bt![up ? 1 : 0]! : set[(bl ? 1 : sw ? 2 : 0) + up]!, 0, 0)
    if (!isAlt) { const a = beat ? 0.75 : 0.22 + 0.2 * Math.sin(tt * 3); for (const [x, y, c] of glows) cv.glowSub(x, y, c, a) }
    o.fx?.(cv, tt)
  }
}
void W

// ── Star-Lord: silver/bronze mask, red eyes, Walkman headphones ─────────────
hero('starlord', [
  'oooooooo',
  'ooSssssss',
  'ooSssshhssss',
  '..oSskrrrrrrrrkk',
  '..oSskrrrrrrrrkk',
  'eeoSskrrrrrrrrkk',
  'eeoSbkkkkkkkkkkk',
  'eeoSbbBsssssssss'.slice(0, 16),
  'oBbBmmmmmmmmmm',
  'ooBmmmmmmmmmmm',
  'oojjjmmmmmmm',
  'oooJjjjjjjjjjjjj',
  'ooJjjjjjjjjjjjjjjj',
  'oJJjjjjjjjjjjjjjjj',
], {
  o: 0x2b1a33, s: 0xd5dbe6, S: 0x8892aa, h: 0xffffff, b: 0xd9903f, B: 0x935a2a, k: 0x2a1e3a,
  r: 0xea2c3e, R: 0xd01c34, j: 0x7a4a2e, J: 0x4a2c20, e: 0xff9a2a, m: 0xe8b890,
}, { blink: { 3: '..oSskkkkkkkkkkk', 4: '..oSskkkkkkkkkkk', 5: 'eeoSskkkkkkkkkkk' }, glows: [[14, 3, 0xff3040], [15, 3, 0xff3040], [20, 3, 0xff3040], [21, 3, 0xff3040]] , alt: { from: 3, to: 5.2, per: 6.5, blink: { 6: '..oeeemmmmmmmmmm' }, rows: ['.........ooooooo'.slice(0, 16), '.......obbbbbbbb', '.....oeeeeeeeeee', '...oebbbbbbbbbbb', '..oeeemmmmmmmmmm', '..oeeemmBBBBmmmm', '..oeeemmkkkmmmmm', '..oeeemmmmmmmmmm', '..oeeemmmmmmmMmm', '...oemmmmmmmmmmm', '....oommmmmmmmmm', '.....ommmmkkkkkk', '.....oommmmmmmmm', '..oojjjjjjjjjjjj'] } })

// ── Gamora: green skin, dark hair with magenta tips, silver cheek lines ─────
hero('gamora', [
  'dddddddd',
  'ddDDdddddd',
  'dDddDDdddddd',
  'dDdddgggggggg',
  'dDdgggggggggg',
  'dDdgkkkkgggggg',
  'dDdgkwkkkgggggg'.slice(0, 14),
  'dDdgggggggggGG',
  'dDdgsgggggggGG',
  'mdDdgsggglllllll'.slice(0, 14),
  'mMdDgGGGGGGGG',
  'mMdDcccccgGGGGGG',
  'mMdDcccccccccccccc',
  'MMDDccccccccccccccc'.slice(0, 18),
], {
  d: 0x241830, D: 0x3e2850, g: 0x4fbf6a, G: 0x2f8f55, H: 0x8be89a, m: 0xe0306e, M: 0xff6fa8,
  k: 0x101018, w: 0xf0fff0, s: 0xe6f0f8, l: 0xc03060, c: 0x5a3a2a,
}, { blink: { 5: 'dDdgGGGGgggggg', 6: 'dDdgGkkkGgggggg'.slice(0, 14) }, sway: { 10: 'mMdDgGGGGGGGG', 11: 'MMdDcccccgGGGGGG' }, period: 1.2, tweaks: [[8, 7, 's'], [9, 8, 's'], [10, 9, 's'], [27, 7, 's'], [26, 8, 's'], [25, 9, 's']], fx: (cv, tt) => {
  const g = tt % 3.6
  if (g < 0.22) for (const x of [9, 26]) { cv.setSub(x, 5, 0xffffff); if (g > 0.05) { cv.setSub(x, 4, 0xd8f4ff); cv.setSub(x - 1, 5, 0xd8f4ff); cv.setSub(x + 1, 5, 0xd8f4ff) } }
} })

// ── Drax: grey-green bald head, strong brow, red tribal lines ───────────────
hero('drax', [
  '.........oooooo',
  '......oooaaaaaaaa',
  '....ooaaaHHHaaaaa',
  '...oaaaaaaaaaaaaa',
  '...oaaaAAAAAAAAAA',
  '...oaaaaaWWWWaaaa',
  '...oaaaaakkkkaaaa',
  '...oaarraaaaaaaaa',
  '...oaaaraaaaaaaaA',
  '...ooaaaaAAAAAAAA',
  '....ooaaaaaaaaaa',
  '..oorraaraaaaaaaaa',
  '.oaaraaaaraaaaaaaaa'.slice(0, 18),
  'oaaaaraaaaraaaaaaa',
], {
  o: 0x1f2a28, a: 0x6f9a86, A: 0x4b7466, H: 0x9bc4aa, r: 0xd8303a, R: 0x8a1a28, k: 0x141820, w: 0xe8e0c8, W: 0xf4f0d8,
}, { blink: { 5: '...oaaaaaAAAAaaaa', 6: '...oaaaaaAAAAaaaa' }, bEvery: 5.6, bLen: 0.42 })

// ── Rocket: raccoon face, tall ears, white muzzle, dark mask, orange collar ─
hero('rocket', [
  '.ooo...........',
  'oiiFo..........',
  'oiiFfoooooooooo',
  'oiFffffffffffff',
  'ooFfffffffffffff'.slice(0, 15),
  '.oFfmmmmffffffff'.slice(0, 15),
  '.oFmmkkmmmmmffff'.slice(0, 15),
  '.oFmmkwmmmwwwwww'.slice(0, 15),
  '..oFffwwwwwwwwww'.slice(0, 15),
  '..oFfwwwwnnnwww'.slice(0, 15),
  '...ooFwwwwnnnnnn'.slice(0, 15),
  '....occcccccccc',
  '...oCCccccccccc',
  '..oFFCCCccccccc',
], {
  o: 0x22181a, f: 0x8a6f5e, F: 0x5e4638, H: 0xb89c86, i: 0xd98a8a, w: 0xf0e8dc, m: 0x2a2024,
  n: 0x1a1216, k: 0x0e0e12, c: 0xff8a1e, C: 0xc4561a,
}, { blink: { 6: '.oFmmmmmmmmmffff'.slice(0, 15), 7: '.oFmmmmmmmwwwwww'.slice(0, 15) }, sway: { 0: '..oo...........', 1: '.oiio..........' }, swayAt: [3.6, 3.1, 3.3], beat: { 9: '..oFfwwwwnnnnnn'.slice(0, 15) } })

// ── Groot: bark face, wood grain, small eyes, leaves ────────────────────────
hero('groot', [
  '.....lL..lLl',
  '....llLlllLlLllL',
  '....oooLlooooo',
  '..ooobbbbbbbbbb',
  '.obbHbbbggbbbbb'.slice(0, 15),
  '.obbbbBBBBBBbbb',
  '.obbbbbyyyyybbb',
  '.obbbbBBBBBBbbb',
  '.obbggbbbbbbbbb'.slice(0, 15),
  '..obbbbbggbbbbB'.slice(0, 15),
  '..ooBbbbbbbBBBB'.slice(0, 15),
  '...oBBbbbbBbbbbbb'.slice(0, 17),
  '..oBbbbgbbbbbbbbbb'.slice(0, 18),
  '.oBbbbbbbgbbbbbbbb'.slice(0, 18),
], {
  o: 0x2a1a10, b: 0x7a5230, B: 0x4e321c, H: 0xb98a56, l: 0x62c23c, L: 0xa8ec70, e: 0x141008, y: 0xffc030, g: 0x3a2414,
}, { blink: { 6: '.obbbbbBBBBBbbb' }, sway: { 0: '.....Ll..Lll', 1: '....lLllLlLllll' }, period: 1.1 })

// ── Mantis: antennae with glowing tips, big black eyes, pale face, green collar
hero('mantis', [
  '.....yy..........',
  '......yo.........',
  '.......o.........',
  '.....ooooooooo',
  '...oohhhhhhhhhh'.slice(0, 15),
  '..odhppppppppp'.slice(0, 14),
  '..odpkkkkpppppp'.slice(0, 15),
  '..odpkkvkkppppp'.slice(0, 15),
  '..odpkkkkkpppppp'.slice(0, 16),
  '..oddppppppppnp'.slice(0, 15),
  '...ooppppppllll'.slice(0, 15),
  '....ogggggggggg'.slice(0, 15),
  '..oogGGgggggggggg'.slice(0, 17),
  '.oogggGGgggggggggg'.slice(0, 18),
], {
  o: 0x2a2038, d: 0x1a1428, h: 0x241a38, p: 0xece4d6, k: 0x0e0818, v: 0x9a9aff, y: 0x9bffe0, n: 0xd8b8a8,
  l: 0xc87878, g: 0x3aa05a, G: 0x2a7a46,
}, { blink: { 6: '..odpppppppppp'.slice(0, 15), 7: '..odpkkkkkppppp'.slice(0, 15), 8: '..odpppppppppppp'.slice(0, 16) }, glows: [[10, 0, 0x9bffe0], [11, 0, 0x9bffe0], [24, 0, 0x9bffe0], [25, 0, 0x9bffe0]] })

// ── Yondu: vivid blue face, red eyes, scars, gold-tooth grin, glowing red fin ─
hero('yondu', [
  '..............rr',
  '..............rR',
  '........oooooorR',
  '......oobbbbbbbb',
  '....oobbbbbbbbbb',
  '...obbHHbbbbbbbb',
  '..obbBBBBBBBBBBB',
  '..obbbbbkEeeEbbb',
  '..obbSbbbbbbbbbb',
  '...obSbbbbbbbbBb',
  '...obbSbbbbbbbBB',
  '....obbbkkkkkkkk',
  '....obbbwwwwwwww',
  '..occcgggggggggg',
], {
  o: 0x0a1c5a, b: 0x1e78ff, B: 0x1050c8, H: 0x6ab8ff, S: 0xb4e0ff, r: 0xe02828, R: 0x9a1420, E: 0x1a0a14, e: 0xff3030,
  k: 0x14081a, w: 0xf0e8d0, g: 0x2a1810, c: 0x7a4a2a, Y: 0xffd040,
}, { blink: { 7: '..obbbbbbbbbbbbb' }, tweaks: [[21, 12, 'Y'], [22, 12, 'Y']], beat: { 11: '....obbbbbbbbbkk', 12: '....obbbbbbbbbbb' }, beatTweaks: [],
  glows: [[17, 1, 0xff4030], [18, 1, 0xff4030], [17, 2, 0xff4030], [18, 2, 0xff4030]] })

// ════════════════ LANES: 12 subpixels tall, across the whole band ════════════════
const BG = 0x202038, LH = 12, TAU = Math.PI * 2
const px2 = (rows: readonly string[], pal: Pal) => { const w = Math.max(...rows.map(r => r.length)); return pixmap(rows.map(r => [...r.padEnd(w, '.')].map(c => c + c).join('')), pal) }
let LY = 0 // the current lane's top row
const put = (cv: Canvas, x: number, y: number, c: number) => { x = Math.round(x); y = Math.round(y); if (y < LY || y >= LY + LH || x < 0 || x >= cv.W) return; cv.setSub(x, y, c) }
const fade = (c: number, a: number) => lerp(BG, c, a < 0 ? 0 : a > 1 ? 1 : a)
const ease = (x: number) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x) }
function flare(cv: Canvas, cx: number, cy: number, r: number, c1: number, c2: number, c3: number, a = 1) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r * 2.4); x <= Math.ceil(cx + r * 2.4); x++) {
    const d = Math.hypot((x - cx) / 2.4, y - cy) / r
    if (d < 1) put(cv, x, y, fade(d < 0.4 ? c1 : d < 0.72 ? c2 : c3, a))
  }
}
// n small 2-wide sparks thrown from (cx,cy); age 0..1
function sparks(cv: Canvas, cx: number, cy: number, age: number, n: number, seed: number, speed: number, c1: number, c2: number, grav = 5) {
  if (age <= 0 || age >= 1) return
  for (let i = 0; i < n; i++) {
    const a = hash(i, seed) * TAU, d = speed * age * (0.5 + hash(i, seed + 7)), x = cx + Math.cos(a) * d * 2.4, y = cy + Math.sin(a) * d * 0.9 + age * age * grav
    const c = fade(lerp(c1, c2, age), 1 - age); put(cv, x, y, c); put(cv, x + 1, y, c)
  }
}
function ground(cv: Canvas, y0: number) { for (let x = 0; x < cv.W; x++) put(cv, x, y0 + 11, 0x2a2a48) }


// ════════════════ shared lane toolkit ════════════════
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const ph = (t: number, a: number, b: number) => clamp((t - a) / (b - a))
const CY = 8 // every lane is one 8 s story
const fi = (cv: Canvas, s: HiSprite, x: number, y: number, flip = false, al = 1) => cv.hi(s, x / 2, y, flip ? { flip: true, alpha: al } : { alpha: al })
function ln(cv: Canvas, x0: number, y0: number, x1: number, y1: number, c: number, th = 1) {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; put(cv, x, y, c); for (let k = 1; k < th; k++) put(cv, x + k, y, c) }
}
function zap(cv: Canvas, x0: number, y0: number, x1: number, y1: number, seed: number, c: number, a = 1) {
  let px = x0, py = y0
  for (let i = 1; i <= 5; i++) { const u = i / 5, nx = x0 + (x1 - x0) * u, ny = y0 + (y1 - y0) * u + (i < 5 ? (hash(i, seed) - 0.5) * 5 : 0); ln(cv, px, py, nx, ny, fade(c, a)); px = nx; py = ny }
}
function burst(cv: Canvas, x: number, y: number, r: number, c1: number, c2: number, a = 1) {
  const rx = Math.round(r * 2.4)
  for (let i = 1; i <= rx; i++) { const c = fade(i < rx * 0.5 ? c1 : c2, a * (1 - i / (rx + 1))); put(cv, x + i, y, c); put(cv, x - i, y, c) }
  for (let i = 1; i <= r; i++) { const c = fade(i < r * 0.6 ? c1 : c2, a * (1 - i / (r + 1))); put(cv, x, y + i, c); put(cv, x, y - i, c) }
  for (let i = 1; i <= r * 0.7; i++) { const dx = Math.round(i * 2.4 * 1.2), c = fade(c2, a * (1 - i / (r + 1))); put(cv, x + dx, y + i, c); put(cv, x - dx, y + i, c); put(cv, x + dx, y - i, c); put(cv, x - dx, y - i, c) }
  put(cv, x, y, fade(c1, a)); put(cv, x + 1, y, fade(c1, a)); put(cv, x - 1, y, fade(c1, a))
}
function puff(cv: Canvas, x: number, y: number, age: number, s = 2, c = 0x7a7aa0) {
  if (age <= 0 || age >= 1) return
  const col = fade(c, 0.75 * (1 - age)), r = s + Math.round(age * 2), yy = y - Math.round(age * 3)
  for (let i = -r; i <= r; i++) put(cv, x + i, yy, col)
  for (let i = -r + 2; i <= r - 2; i++) put(cv, x + i, yy - 1, col)
}
function note(cv: Canvas, x: number, y: number, c: number) {
  put(cv, x, y, c); put(cv, x + 1, y, c); put(cv, x, y + 1, c); put(cv, x + 1, y + 1, c)
  for (let i = -3; i <= 1; i++) put(cv, x + 2, y + i, c)
  put(cv, x + 3, y - 3, c); put(cv, x + 3, y - 2, c)
}
function zzz(cv: Canvas, x: number, y: number, c: number) {
  for (let i = 0; i < 5; i++) { put(cv, x + i, y, c); put(cv, x + i, y + 4, c) }
  put(cv, x + 3, y + 1, c); put(cv, x + 2, y + 2, c); put(cv, x + 1, y + 3, c)
}
// a '?' glyph, 3 wide x 5 tall, drawn 2x wide
function qmark(cv: Canvas, x: number, y: number, c: number) {
  for (const [a, b] of [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [1, 3], [1, 5]] as const) { put(cv, x + a * 2, y + b, c); put(cv, x + a * 2 + 1, y + b, c) }
}
function boom(cv: Canvas, x: number, y: number, h: number, s = 1) {
  if (h <= 0 || h >= 1) return
  if (h < 0.1) flare(cv, x, y, 3 + h * 45, 0xffffff, 0xffffff, 0xfff0b0, 1)
  if (h >= 0.06 && h < 0.5) { // hard-edged fireball, about 12 x 10 subpx
    const u = (h - 0.06) / 0.44, k = (u < 0.45 ? 0.45 + u * 1.2 : 1 - (u - 0.45) * 0.9) * s, rx = 6 * k, ry = 5 * k
    for (let yy = -5; yy <= 5; yy++) for (let xx = -7; xx <= 7; xx++) { const d = Math.hypot(xx / rx, yy / ry); if (d < 1) put(cv, x + xx, y + yy, d < 0.4 ? (u < 0.5 ? 0xfff0a0 : 0xffc040) : d < 0.72 ? 0xffa030 : 0xe8602a) }
  }
  if (h > 0.08 && h < 0.6) { const f = (h - 0.08) / 0.52, rx = 6 + f * 44, ry = 2 + f * 3, c = fade(f < 0.3 ? 0xffe8b0 : 0xff9a4a, 1 - f); for (let i = 0; i < 48; i++) { const an = (i / 48) * TAU; put(cv, x + Math.cos(an) * rx, y + Math.sin(an) * ry, c) } }
  for (let i = 0; i < 7; i++) { // chunky debris on arcs, landing and staying a while
    const vx = (i - 3) * 5 + (hash(i, 9) - 0.5) * 3, vy = 7 + hash(i, 4) * 6, ty = h * 2.2
    const dx = x + vx * ty * 1.6, dy = Math.min(LY + 10, y - vy * ty * 1.4 + 22 * ty * ty), c = i % 2 ? 0xff8a2a : 0x7a7a8c
    if (h < 0.9) { put(cv, dx, dy, c); put(cv, dx + 1, dy, c); put(cv, dx, dy + 1, i % 2 ? 0xc4561a : 0x4a4a5c) }
  }
  for (let i = 0; i < 3; i++) { // grey smoke puffs rise and shrink
    const a = clamp((h - 0.3 - i * 0.04) / 0.62); if (a <= 0 || a >= 1) continue
    const r = Math.round(3 * (1 - a)) + 1, px = x - 6 + i * 6, py = y - 1 - a * 7 - i, c = fade(a < 0.5 ? 0x9a9aac : 0x6a6a7c, 1)
    for (let yy = -1; yy <= 1; yy++) for (let xx = -r - (yy === 0 ? 2 : 0); xx <= r + (yy === 0 ? 2 : 0); xx++) if (r > 1 || yy === 0) put(cv, px + xx, py + yy, c)
  }
}
function flame(cv: Canvas, x: number, y: number, t: number, len: number) {
  for (let i = 0; i < len; i++) { const c = i < 2 ? 0xffffff : i < len * 0.5 ? 0xffe070 : 0xff7a1e, w = (Math.floor(t * 30 + i) % 2) * (i > 3 ? 1 : 0); put(cv, x - i, y - w, fade(c, 1 - i / (len + 2))); put(cv, x - i, y + 1 - w, fade(c, 0.7 * (1 - i / (len + 2)))) }
}
function shadow(cv: Canvas, x: number, y0: number, w: number, a = 0.5) { for (let i = -w; i <= w; i++) put(cv, x + i, y0 + 11, fade(0x0c0c18, a * (1 - Math.abs(i) / (w + 2)))) }
const dust2 = (cv: Canvas, y0: number, x: number, t: number) => { for (let i = 0; i < 4; i++) puff(cv, x - i * 5 - 2, y0 + 10, clamp((t * 3 + i * 0.25) % 1)) }

// ── the pose rig: a 16 x 12 char grid (each char is 2 subpx wide); hip row 7, ground row 11 ──
type P2 = [number, number]
interface Look { coat?: string; out?: string; thick?: boolean; pal: Pal; hd: string[]; tor: string[]; leg: string; legF: string; ft: string; arm: string; farm: string; hand: string }
interface Pose { l?: number; d?: number; lf: P2; rf: P2; lh: P2; rh: P2; h?: string[] }
function gline(g: string[][], a: P2, b: P2, ch: string, end: string) {
  let [x, y] = a; const dx = Math.abs(b[0] - x), dy = Math.abs(b[1] - y), sx = x < b[0] ? 1 : -1, sy = y < b[1] ? 1 : -1; let e = dx - dy
  const st = (c: number, r: number, v: string) => { if (r >= 0 && r < 12 && c >= 0 && c < 16) g[r]![c] = v }
  for (let n = 0; n < 40; n++) { st(x, y, ch); if (x === b[0] && y === b[1]) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x += sx } if (e2 < dx) { e += dx; y += sy } }
  st(b[0], b[1], end)
}
function rigGrid(L: Look, p: Pose): string[][] {
  const g = Array.from({ length: 12 }, () => Array<string>(16).fill('.')), d = p.d ?? 0, l = p.l ?? 0
  const st = (c: number, r: number, v: string) => { if (r >= 0 && r < 12 && c >= 0 && c < 16 && v !== '.') g[r]![c] = v }
  const lim = (a: P2, b: P2, ch: string, end: string) => { gline(g, a, b, ch, end); if (L.thick) gline(g, [a[0] + 1, a[1]], [b[0] + 1, b[1]], ch, end) }
  lim([5, 7 + d], p.lf, L.legF, L.ft); st(p.lf[0] + 1, p.lf[1], L.ft)
  lim([4 + l, 3 + d], p.lh, L.farm, L.hand)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) st(5 + c + (l >= 1 ? (r < 2 ? l : l >> 1) : l < 0 ? (r < 2 ? l : l >> 1) : 0), 3 + d + r, L.tor[r]![c > 1 ? c - 1 : c]!)
  if (L.coat) for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) st(5 + c + (l > 0 ? l >> 1 : l < 0 ? l >> 1 : 0), 7 + d + r, L.coat[r]!)
  lim([8, 7 + d], p.rf, L.leg, L.ft); st(p.rf[0] + 1, p.rf[1], L.ft)
  const hd = p.h ?? L.hd
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) st(4 + l + c, d + r, hd[r]![c]!)
  lim([9 + (l > 0 ? l >> 1 : l), 3 + d], p.rh, L.arm, L.hand)
  if (L.out) { const c = g.map(r => r.slice()); for (let r = 0; r < 12; r++) for (let q = 0; q < 16; q++) if (c[r]![q] === '.' && ((r > 0 && c[r - 1]![q] !== '.') || (r < 11 && c[r + 1]![q] !== '.') || (q > 0 && c[r]![q - 1] !== '.') || (q < 15 && c[r]![q + 1] !== '.'))) g[r]![q] = L.out }
  return g
}
function rig(L: Look, p: Pose, vflip = false, lift = 0): HiSprite { const g = rigGrid(L, p).map(r => r.join('')); if (vflip) g.reverse(); for (let i = 0; i < lift; i++) { g.shift(); g.push('.'.repeat(16)) } return px2(g, L.pal) }
function lying(L: Look): HiSprite {
  const g = Array.from({ length: 12 }, () => Array<string>(16).fill('.'))
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const ch = L.hd[r]![c]!; if (ch !== '.') g[9 + r]![c] = ch }
  for (let k = 0; k < 4; k++) for (let r = 0; r < 3; r++) g[9 + r]![5 + k] = L.tor[k]![r]!
  for (let k = 0; k < 5; k++) { g[10]![9 + k] = L.legF; g[11]![9 + k] = L.leg }
  g[10]![14] = L.ft; g[11]![14] = L.ft; g[11]![15] = L.ft
  return px2(g.map(r => r.join('')), L.pal)
}
// [stagger, tilt, lying] for something hit from the front (falls backward)
function falls(L: Look): HiSprite[] {
  return [rig(L, { l: -3, d: 1, lf: [4, 11], rf: [8, 10], lh: [3, 7], rh: [9, 5] }), rig(L, { l: -4, d: 3, lf: [4, 10], rf: [7, 9], lh: [2, 6], rh: [8, 6] }), lying(L)]
}
const stand: Pose = { lf: [5, 11], rf: [8, 11], lh: [4, 8], rh: [10, 8] }
const WALK: Pose[] = [
  { lf: [4, 11], rf: [9, 10], lh: [8, 8], rh: [5, 8] }, { lf: [6, 10], rf: [7, 11], lh: [6, 9], rh: [9, 9] },
  { lf: [9, 10], rf: [4, 11], lh: [5, 8], rh: [8, 8] }, { lf: [7, 11], rf: [6, 10], lh: [6, 9], rh: [9, 9] },
]
const RUN: Pose[] = [
  { l: 1, lf: [3, 9], rf: [10, 11], lh: [10, 5], rh: [4, 8] }, { l: 1, d: 1, lf: [6, 11], rf: [7, 11], lh: [5, 7], rh: [10, 7] },
  { l: 1, lf: [10, 11], rf: [3, 9], lh: [4, 8], rh: [10, 5] }, { l: 1, d: 1, lf: [6, 11], rf: [7, 11], lh: [10, 7], rh: [5, 7] },
]
const hx = (c: number, x: number, flip: boolean) => x + (flip ? 30 - 2 * c : 2 * c + 1) // screen x of a rig column

// ── Star-Lord: the Morag dance, a kicked critter, mask snap, rocket-boot exit ──
{
  const SL: Look = { coat: 'jJ', out: 'O', thick: true, pal: { O: 0x1c1024, b: 0xb27a3a, e: 0xff9a2a, m: 0xe8b890, k: 0x2a1e3a, s: 0xd5dbe6, S: 0x8892aa, r: 0xff3b4c, j: 0xa02a40, J: 0x601a30, p: 0x6a5a88, q: 0x4a3e68, B: 0x2e2030 },
    hd: ['.bbb.', 'ekmke', '.mmm.'], tor: ['jjj', 'jjj', 'jJj', 'JJJ'], leg: 'p', legF: 'q', ft: 'B', arm: 'j', farm: 'J', hand: 'm' }
  const MH = ['.sss.', 'srsrs', '.SSS.']
  const DANCE: Pose[] = [{ l: -1, lf: [4, 11], rf: [8, 11], lh: [2, 8], rh: [11, 5] }, { l: 1, lf: [5, 11], rf: [10, 11], lh: [3, 5], rh: [11, 9] }, { lf: [5, 11], rf: [9, 11], lh: [3, 9], rh: [12, 2] }, { l: 1, lf: [3, 11], rf: [10, 11], lh: [4, 8], rh: [9, 8] },
    { d: 1, lf: [4, 11], rf: [9, 11], lh: [2, 5], rh: [12, 5] }, { lf: [6, 11], rf: [8, 11], lh: [6, 8], rh: [8, 8] }, { l: -1, lf: [4, 11], rf: [8, 11], lh: [2, 8], rh: [11, 5] }, { l: -1, d: 1, lf: [4, 11], rf: [8, 10], lh: [3, 3], rh: [12, 9] }]
  const dn = DANCE.map(p => rig(SL, p)), wind = rig(SL, { l: -1, lf: [4, 11], rf: [3, 10], lh: [4, 6], rh: [11, 7] }), kick = rig(SL, { l: -1, lf: [5, 11], rf: [13, 8], lh: [3, 5], rh: [12, 6] })
  const crouch = rig(SL, { l: 1, d: 2, lf: [4, 11], rf: [10, 11], lh: [5, 9], rh: [10, 9], h: MH }), fly = rig(SL, { l: 2, lf: [2, 9], rf: [4, 10], lh: [11, 6], rh: [13, 5], h: MH })
  const maskStand = rig(SL, { ...stand, h: MH })
  // the Orloni: a long, low rat-lizard. 18 x 7 chars, facing right; tail drawn per frame so it swishes
  const OP = { g: 0x8fae52, G: 0x5a7430, l: 0x3c4c20, y: 0xffe040, k: 0x101010, n: 0xff8aa0, t: 0xa8c070, h: 0xd8e8a0 }
  const orRows = ['.........gyyg.', '....gggggykgn.'.slice(0, 14).padEnd(14, '.'), '....GGGGGGGGgg', '']
  const orLegs = ['.....l..l.l..l', '....l..l..l..l', '.....ll.l.ll.l', '....ll..l..ll.']
  const curlRows = ['..............', '.........gg...', '........gykg..', '........tGGGt.']
  const mkOr = (k: number, curl = false) => {
    if (curl) return px2(curlRows, OP)
    const g = [orRows[0]!, orRows[1]!, orRows[2]!, orLegs[k & 3]!].map(r => r.split(''))
    // long thin tail off the rump, swishing with the frame
    const ty = k & 1 ? 1 : 2
    for (let i = 0; i < 4; i++) { const y = i < 2 && ty === 1 ? 2 : ty; if (g[y]![i] === '.') g[y]![i] = i > 1 ? 'h' : 't' }
    return px2(g.map(r => r.join('')), OP)
  }
  const orS = [0, 1, 2, 3].map(k => mkOr(k)), orBall = mkOr(0, true)
  LANES.starlord = (cv, y0, t, calm) => {
    LY = y0
    const tt = calm ? 3.8 : t % CY, W = cv.W
    const xe = Math.round(W * 0.34) - 15
    ground(cv, y0)
    const cr0 = xe + 40, ox0 = W + 4
    // Star-Lord
    let sx = xe, spr: HiSprite, dflip = false
    if (tt < 2.4) { const bi = Math.floor(tt / 0.3) % 8; spr = dn[bi]!; dflip = bi === 6 }
    else if (tt < 3.3) { spr = dn[Math.floor(tt / 0.3) % 8]!; dflip = false }
    else if (tt < 4.6) { spr = dn[Math.floor(tt / 0.2) & 1 ? 7 : 2]! }
    else if (tt < 4.9) spr = wind
    else if (tt < 5.3) spr = kick
    else if (tt < 5.7) spr = maskStand
    else if (tt < 6.1) spr = crouch
    else { sx = xe + (W + 40 - xe) * Math.pow(ph(tt, 6.1, 7.7), 2.2); spr = fly }
    // the Orloni's story
    let ox = -99, oy = y0 + 8, os: HiSprite | null = null, oflip = false
    if (tt >= 2.4 && tt < 3.3) { ox = ox0 + (cr0 - ox0) * ph(tt, 2.4, 3.3); os = orS[Math.floor(tt * 14) & 3]!; oflip = true }
    else if (tt >= 3.3 && tt < 3.55) { ox = cr0 - 12 * ph(tt, 3.3, 3.55); oy = y0 + 8 - 7 * ph(tt, 3.3, 3.55); os = orS[Math.floor(tt * 14) & 3]!; oflip = true }
    else if (tt >= 3.55 && tt < 4.6) { ox = xe + 22 + Math.sin(tt * 18) * 1; oy = y0 + 1 + (Math.floor(tt * 10) & 1); os = orS[Math.floor(tt * 10) & 3]!; oflip = true }
    else if (tt >= 4.6 && tt < 5.1) { const u = ph(tt, 4.6, 4.9); ox = xe + 22 + 8 * u; oy = y0 + 1 + 7 * u; os = orS[0]!; oflip = true }
    else if (tt >= 5.1 && tt < 6.2) { const u = ph(tt, 5.1, 6.2); ox = xe + 32 + 80 * u; oy = y0 + 8 - Math.sin(u * Math.PI) * 7; os = Math.floor(tt * 12) & 1 ? orBall : orS[0]!; oflip = Math.floor(tt * 9) & 1 ? true : false }
    else if (tt >= 6.2 && tt < 7.6) { const u = ph(tt, 6.2, 7.6); ox = xe + 112 + (W - xe - 100) * u * u; os = orS[Math.floor(tt * 14) & 3]!; oflip = false }
    if (os) { shadow(cv, ox + 14, y0, 5, 0.4); fi(cv, os, ox, oy, oflip) }
    if (tt >= 5.1 && tt < 5.9) { const u = ph(tt, 5.1, 5.9), qx = ox + 14, qy = Math.max(y0, Math.round(oy) - 7) // the squeak: "!" in a flash of yellow
      for (let j = 0; j < 4; j++) { put(cv, qx, qy + j, fade(0xffe040, 1 - u)); put(cv, qx + 1, qy + j, fade(0xffe040, 1 - u)) }
      put(cv, qx, qy + 5, fade(0xffe040, 1 - u)); put(cv, qx + 1, qy + 5, fade(0xffe040, 1 - u)) }
    if (tt >= 3.3 && tt < 3.55) puff(cv, cr0 + 10, y0 + 10, ph(tt, 3.3, 3.55))
    if (tt >= 6.2 && tt < 7.4) for (let i = 0; i < 2; i++) puff(cv, ox + 4 - i * 6, y0 + 10, ((tt * 4 + i * 0.5) % 1))
    if (sx < W + 40) {
      if (tt >= 6.1) { for (let r = 0; r < 3; r++) { const yy = y0 + 2 + r * 3, L2 = 10 + r * 6; for (let k = 0; k < L2; k++) put(cv, sx - 4 - k, yy, fade(0x9bb0e8, 0.55 * (1 - k / L2))) } flame(cv, sx + 5, y0 + 9, tt, 12) }
      shadow(cv, sx + 15, y0, 6, tt >= 6.1 ? 0.2 : 0.45)
      fi(cv, spr, sx, y0, dflip)
    }
    // music notes: floating while he dances, a big burst while he sings into the Orloni
    if (tt < 3.3) for (let k = 0; k < 4; k++) { const a = ((tt - k * 0.55) / 1.5); if (tt > k * 0.55 && a < 1) note(cv, xe + 34 + k * 6, y0 + 7 - a * 6, fade(k % 2 ? 0x7af0ff : 0xff7ac8, 1 - a * a)) }
    if (tt >= 3.55 && tt < 4.6) for (let i = 0; i < 4; i++) { const a = ((tt - 3.55) * 1.6 + i / 4) % 1; note(cv, xe + 46 + i * 7 + a * 6, y0 + 8 - a * 7, fade(i % 2 ? 0x7af0ff : 0xff7ac8, 1 - a)) }
    if (tt >= 4.9 && tt < 5.1) burst(cv, xe + 33, y0 + 5, 4, 0xffffff, 0xffe070, 1 - (tt - 4.9) / 0.2)
    if (tt >= 5.3 && tt < 5.5) burst(cv, sx + 15, y0 + 1, 3, 0xffffff, 0xff7a8a, 1 - (tt - 5.3) / 0.2)
    if (tt >= 6.0 && tt < 6.3) flare(cv, sx + 4, y0 + 10, 2.5, 0xffffff, 0xffe070, 0xff7a1e, 1 - (tt - 6.0) / 0.3)
  }
}

// ── Gamora vs Nebula: two clashes, a flip over the shoulder, Godslayer at the throat ──
{
  const GA: Look = { pal: { d: 0x2a1c3a, m: 0xff6fa8, g: 0x5fd37e, k: 0x101018, b: 0x8a5a3a, B: 0x5a3a28, c: 0x4a5a7a, C: 0x2e3a58, s: 0xeef6ff }, hd: ['mddd.', 'dgkgd', '.mggg'], tor: ['bbb', 'bsb', 'bbb', 'BBB'], leg: 'c', legF: 'C', ft: 'B', arm: 'g', farm: 'g', hand: 'g' }
  const NE: Look = { pal: { b: 0x4a82e8, B: 0x2a4fa0, s: 0xc4ccdc, S: 0x6a7388, k: 0x1a0a2a, p: 0xc060ff, d: 0x6c5ca6, D: 0x3c3470 }, hd: ['.sbb.', 'bkpkb', '.bBb.'], tor: ['ddd', 'dsd', 'ddd', 'DDD'], leg: 'D', legF: 'D', ft: 'k', arm: 's', farm: 'S', hand: 's' }
  const stp: Pose = { lf: [5, 11], rf: [9, 11], lh: [5, 7], rh: [12, 6] }, lun: Pose = { l: 1, lf: [3, 11], rf: [10, 11], lh: [4, 6], rh: [13, 5] }, hi2: Pose = { lf: [5, 11], rf: [9, 11], lh: [5, 5], rh: [11, 2] }, dr: Pose = { lf: [5, 11], rf: [9, 11], lh: [5, 8], rh: [11, 9] }
  const gw = WALK.map(p => rig(GA, p)), gst = rig(GA, stp), glun = rig(GA, lun), ghi = rig(GA, hi2)
  const nw = WALK.map(p => rig(NE, p)), nst = rig(NE, stp), nlun = rig(NE, lun), nhi = rig(NE, hi2), ndr = rig(NE, dr)
  const crouch = rig(GA, { l: 1, d: 2, lf: [4, 11], rf: [9, 11], lh: [4, 9], rh: [11, 9] }), rise = rig(GA, { d: 3, l: 1, lf: [6, 10], rf: [8, 9], lh: [4, 5], rh: [11, 4] }, false, 1)
  const tuck = rig(GA, { d: 3, l: 1, lf: [6, 9], rf: [8, 9], lh: [5, 7], rh: [9, 7] }, false, 2), inv = rig(GA, { d: 3, l: 1, lf: [6, 9], rf: [8, 9], lh: [5, 7], rh: [9, 7] }, true, 2), down = rig(GA, { d: 3, lf: [5, 10], rf: [9, 9], lh: [4, 4], rh: [11, 5] }, false, 2)
  const land = crouch, fin = rig(GA, { lf: [5, 11], rf: [9, 11], lh: [4, 8], rh: [12, 3] })
  const sword = (cv: Canvas, x: number, y: number, dx: number, dy: number, len: number, c1: number, c2: number) => {
    const n2 = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy)))); for (let i = 0; i <= n2; i++) { const u = i / n2, px = x + dx * u, py = y + dy * u; put(cv, px, py, i > n2 - 4 ? c1 : c2); put(cv, px, py - 1, fade(c1, 0.5)) }
  }
  LANES.gamora = (cv, y0, t, calm) => {
    LY = y0
    const tt = calm ? 3.0 : t % CY, W = cv.W, c = W / 2, fa = tt > 7.6 ? 1 - (tt - 7.6) / 0.4 : 1
    ground(cv, y0)
    const Gc = c - 26, Nc = c + 26, wk = ph(tt, 0, 1.2)
    let gx = 6 + (Gc - 15 - 6) * wk, nx = W - 38 - (W - 38 - (Nc - 16)) * wk
    let gs: HiSprite = tt < 1.2 ? gw[Math.floor(tt * 7) % 4]! : gst, ns: HiSprite = tt < 1.2 ? nw[Math.floor(tt * 7) % 4]! : nst
    let gb = 0, nb = 0, gdy = 0, gflip = false, hiAtk = false, lunge = false, spark = 0
    const glen = 4 + 16 * ease(ph(tt, 1.2, 1.9))
    if (tt >= 1.9 && tt < 2.3) { gs = glun; ns = nlun; gb = 5; nb = -5; lunge = true; spark = 1 - (tt - 2.1) / 0.2 }
    if (tt >= 2.3 && tt < 2.75) { gb = -3; nb = 3 }
    if (tt >= 2.75 && tt < 3.3) { gs = ghi; ns = nhi; hiAtk = true; gb = 4; nb = -4; spark = tt > 2.95 ? 1 - (tt - 2.95) / 0.2 : 0 }
    let mode = 0
    if (tt >= 3.3 && tt < 4.7) {
      const fu = ph(tt, 3.3, 4.5); mode = 1
      gb = -3 + (Nc + 20 - Gc + 3) * ease(fu)
      if (fu < 0.18) { gs = crouch; gb = -3 } else if (fu < 0.34) { gs = rise; gdy = -1 } else if (fu < 0.52) { gs = tuck; gdy = -2 } else if (fu < 0.68) { gs = inv; gdy = -3 } else if (fu < 0.85) { gs = down; gdy = -2 } else gs = land
      gflip = fu > 0.85; ns = nst
    }
    if (tt >= 4.7) { mode = 2; gs = fin; gflip = true; gb = Nc + 20 - Gc + 3; ns = ndr }
    gx += gb; nx += nb
    fi(cv, ns, nx, y0, true, fa); fi(cv, gs, gx, y0, gflip, fa)
    if (mode === 2) { const bx = nx + 8; ln(cv, bx, y0 + 10, bx + 13, y0 + 10, 0xc4ccdc); if (tt < 4.85) burst(cv, bx + 8, y0 + 9, 2, 0xffffff, 0xc4ccdc, 1 - (tt - 4.7) / 0.15) }
    else if (mode === 0) sword(cv, hx(12, nx, true), hiAtk ? y0 + 2 : y0 + 6, hiAtk ? -14 : -34, hiAtk ? 5 : -1, hiAtk ? 8 : 16, 0xffffff, 0xaab6cc)
    if (mode === 0) {
      const hxg = hx(lunge ? 13 : 12, gx, false), hyg = hiAtk ? y0 + 2 : y0 + (lunge ? 5 : 6)
      sword(cv, hxg, hyg, hiAtk ? 24 : glen * 1.7, hiAtk ? 5 : -1, glen, 0xffffff, 0x9bd8ff)
      if (tt >= 1.2 && tt < 1.9) burst(cv, hxg + glen * 1.7 * ease((tt - 1.2) / 0.7), hyg, 1 + (Math.floor(tt * 14) % 2), 0xffffff, 0x9bd8ff, 0.8)
    } else if (mode === 1) sword(cv, hx(11, gx, gflip), y0 + gdy + 5, gflip ? -24 : 24, 0, 18, 0xffffff, 0x9bd8ff)
    else {
      const hxg = hx(12, gx, true), hyg = y0 + 3
      sword(cv, hxg, hyg, -30, 1, 20, 0xffffff, 0x9bd8ff)
      const gl = (tt * 1.3) % 1; if (gl < 0.3 && tt < 7.6) burst(cv, hxg - 28, hyg, 2 + Math.floor(gl * 8) % 2, 0xffffff, 0x9bd8ff, 1 - gl / 0.3)
    }
    if (spark > 0) { const sy = hiAtk ? y0 + 4 : y0 + 6; burst(cv, c + 1, sy, 4, 0xffffff, 0xffe070, spark); sparks(cv, c, sy, 1 - spark, 10, 4, 9, 0xffffff, 0xff9a2a) }
    if (tt > 4.3 && tt < 4.7) puff(cv, Nc + 28, y0 + 10, (tt - 4.3) / 0.4)
  }
}

// ── Drax: "I'm invisible" ──────────────────────────────────────────────────
{
  const DX: Look = { pal: { a: 0x7ea896, A: 0x4b7466, W: 0xf4f0d8, k: 0x141820, r: 0xe0323c, d: 0x3a2e3a, D: 0x2a2028, b: 0x6a4a30, o: 0x1f2a28 }, hd: ['.aaa.', 'akkka', '.aAa.'], tor: ['aAa', 'rar', 'aaa', 'bbb'], leg: 'd', legF: 'D', ft: 'k', arm: 'a', farm: 'A', hand: 'a' }
  const chew = ['.aaa.', 'akkka', '.aka.']
  const SK: Look = { pal: { h: 0xff7a3a, H: 0xc04a20, y: 0xffe040, k: 0x1a1018, t: 0xe0a050, T: 0x9a6a30, G: 0x4a4458 }, hd: ['.hhh.', 'hykyh', '.hHh.'], tor: ['ttt', 'tTt', 'ttt', 'TTT'], leg: 'T', legF: 'G', ft: 'G', arm: 't', farm: 'T', hand: 'h' }
  const run = RUN.map(p => rig(DX, { ...p, lh: [p.lh[0] + 1, p.lh[1]], rh: [p.rh[0] + 1, p.rh[1]] }))
  const skid = rig(DX, { l: -1, lf: [4, 11], rf: [9, 11], lh: [4, 7], rh: [11, 8] })
  const frozen = rig(DX, { lf: [4, 11], rf: [10, 11], lh: [4, 9], rh: [10, 9] }), frozenC = rig(DX, { lf: [4, 11], rf: [10, 11], lh: [4, 9], rh: [10, 9], h: chew })
  const eat = rig(DX, { lf: [4, 11], rf: [10, 11], lh: [4, 9], rh: [9, 3] }), eatC = rig(DX, { lf: [4, 11], rf: [10, 11], lh: [4, 9], rh: [9, 3], h: chew })
  const wind = rig(DX, { l: -2, lf: [3, 11], rf: [9, 11], lh: [3, 5], rh: [4, 6] }), slash = rig(DX, { l: 2, lf: [3, 11], rf: [11, 11], lh: [12, 8], rh: [13, 5] })
  const sw = SK && WALK.map(p => rig(SK, p)), skf = falls(SK), skst = rig(SK, stand)
  LANES.drax = (cv, y0, t, calm) => {
    LY = y0
    const tt = calm ? 5.1 : t % CY, W = cv.W, dxs = W * 0.28 - 15, fa = tt > 7.7 ? 1 - (tt - 7.7) / 0.3 : 1
    ground(cv, y0)
    // Sakaaran: walks in from the right, stops, looks around, gets slashed
    const sTarget = dxs + 66, sx0 = W - 40
    const sx = tt < 3.3 ? sx0 + (sTarget - sx0) * ph(tt, 0.2, 3.3) : sTarget
    let ss: HiSprite = tt < 3.3 && tt > 0.2 ? sw[Math.floor(tt * 5) % 4]! : skst, sflip = true
    if (tt >= 3.3 && tt < 5.0) sflip = Math.floor((tt - 3.3) / 0.55) % 2 === 0
    let sdx = 0
    if (tt >= 5.0) { const u = tt - 5.0; ss = u < 0.12 ? skf[0]! : u < 0.3 ? skf[1]! : skf[2]!; sdx = u < 0.12 ? 2 : u < 0.3 ? 6 : 10 }
    const alive = tt < 5.0
    if (tt > 0.2 && tt < 3.3) dust2(cv, y0, sx + 26, tt)
    fi(cv, ss, sx + sdx, y0, sflip, fa)
    if (alive && tt >= 3.3 && tt < 5.0 && Math.floor(tt * 3) % 2 === 0) qmark(cv, sx + 12, y0 - 0, 0xffe070)
    // Drax
    let x: number, ds: HiSprite
    if (tt < 1.4) { x = 6 + (dxs - 6) * ph(tt, 0, 1.4); ds = run[Math.floor(tt * 9) % 4]!; if (tt > 1.1) ds = skid }
    else if (tt < 4.7) { x = dxs; const ch = Math.floor(tt * 4) % 2 === 1; ds = tt < 1.9 ? skid : tt < 2.2 ? frozen : ch ? eatC : eat }
    else if (tt < 4.85) { x = dxs + 6 * ease((tt - 4.7) / 0.15); ds = wind }
    else if (tt < 5.5) { x = dxs + 22; ds = slash }
    else { x = dxs + 22; ds = Math.floor(tt * 4) % 2 ? frozenC : frozen }
    if (tt < 4.7 && tt > 1.9 && tt < 2.2) ds = frozen
    if (tt >= 5.5) { x = dxs + 22 - 22 * ease(ph(tt, 5.5, 6.1)); ds = tt < 6.1 ? slash : (Math.floor(tt * 4) % 2 ? frozenC : frozen) }
    if (tt < 1.4 && tt > 0.1) dust2(cv, y0, x + 6, tt)
    if (tt >= 1.4 && tt < 1.8) puff(cv, x - 2, y0 + 10, (tt - 1.4) / 0.4, 3)
    fi(cv, ds, x, y0, false, fa)
    // knives in hand (until the snack comes out)
    const knife = (kx: number, ky: number, dx: number, dy: number) => { ln(cv, kx, ky, kx + dx, ky + dy, 0xdfe6f2); put(cv, kx, ky, 0x6a5a40) }
    if (tt < 1.4) { knife(hx(11, x, false), y0 + 6, 8, -1); knife(hx(5, x, false), y0 + 6, -6, -2) }
    else if (tt >= 4.7 && tt < 4.85) { knife(hx(4, x, false) - 2, y0 + 6, -6, -3) }
    else if (tt >= 4.85 && tt < 5.5) { knife(hx(12, x, false), y0 + 7, 8, 3); knife(hx(13, x, false), y0 + 5, 9, -2) }
    // snack and crumbs
    if (tt >= 2.2 && tt < 4.7 || tt >= 6.1) { const sn = ds === eat || ds === eatC; if (sn) { const bx = hx(9, x, false) + 1, by = y0 + 2; put(cv, bx, by, 0xffb030); put(cv, bx + 1, by, 0xffb030); put(cv, bx, by + 1, 0xd08020); put(cv, bx + 1, by + 1, 0xd08020); put(cv, bx + 2, by, 0xfff0a0) }
      for (let i = 0; i < 3; i++) { const a = (tt * 2.2 + i / 3) % 1; if (ds === eatC || ds === frozenC) { put(cv, x + 16 + i * 3 + a * 3, y0 + 3 + a * 8, fade(0xffc060, 1 - a)); put(cv, x + 17 + i * 3 + a * 3, y0 + 3 + a * 8, fade(0xffc060, 1 - a)) } } }
    // the slash: a bright X of two crossing streaks over the Sakaaran
    if (tt >= 4.95 && tt < 5.4) {
      const u = (tt - 4.95) / 0.45, a = 1 - u * u, cx = sx + 18, cy = y0 + 5
      const n = 14 * Math.min(1, u * 6)
      for (let i = 0; i < n; i++) { put(cv, cx - 12 + i * 1.8, cy - 5 + i * 0.75, fade(i > n - 4 ? 0xffffff : 0xff6a6a, a)); put(cv, cx + 12 - i * 1.8, cy - 5 + i * 0.75, fade(i > n - 4 ? 0xffffff : 0xffb0a0, a)) }
      if (u < 0.5) burst(cv, cx, cy, 4, 0xffffff, 0xff6a5a, 1 - u * 2)
      sparks(cv, cx, cy, u, 10, 6, 8, 0xffffff, 0xff4a3a)
    }
  }
}

// ── Nebula: a clean duel. Two Sakaaran soldiers, a baton, a duck, a flash, a spin, then the eye scan ─────────
{
  const NE: Look = { pal: { b: 0x4a82e8, B: 0x2a4fa0, s: 0xc4ccdc, S: 0x6a7388, k: 0x1a0a2a, p: 0xc060ff, d: 0x6c5ca6, D: 0x3c3470 }, hd: ['.sbb.', 'bkpkb', '.bBb.'], tor: ['ddd', 'dsd', 'ddd', 'DDD'], leg: 'D', legF: 'D', ft: 'k', arm: 's', farm: 'S', hand: 's' }
  const SK: Look = { out: 'O', pal: { O: 0x0c0c14, g: 0xf0c050, G: 0xb87a24, k: 0x14101c, R: 0xff5a2a, t: 0xe8802c, T: 0x8a4a1a, j: 0x5a3010 }, hd: ['.ggg.', 'gkRkg', '.gGg.'], tor: ['ttt', 'tGt', 'ttt', 'TTT'], leg: 'T', legF: 'j', ft: 'k', arm: 'g', farm: 'G', hand: 'g' }
  const nw = WALK.map(p => rig(NE, p)), nrun = RUN.map(p => rig(NE, p))
  const ready = rig(NE, { l: 1, lf: [4, 11], rf: [10, 11], lh: [5, 8], rh: [12, 6] }), lunge = rig(NE, { l: 2, lf: [3, 11], rf: [11, 11], lh: [5, 8], rh: [13, 6] })
  const duck = rig(NE, { l: 1, d: 3, lf: [4, 11], rf: [10, 11], lh: [5, 9], rh: [12, 9] }), spin = rig(NE, { lf: [5, 11], rf: [9, 11], lh: [2, 6], rh: [13, 6] })
  const scan = rig(NE, { lf: [5, 11], rf: [9, 11], lh: [10, 6], rh: [12, 6] })
  const sst = rig(SK, { l: 1, lf: [4, 11], rf: [10, 11], lh: [5, 8], rh: [12, 3] }), sdn = rig(SK, { l: 2, lf: [3, 11], rf: [11, 11], lh: [5, 8], rh: [13, 8] })
  const srun = RUN.map(p => rig(SK, p)), sf = falls(SK), slie = lying(SK)
  const baton = (cv: Canvas, x: number, y: number, dx: number, dy: number, len: number, a = 1) => {
    if (len <= 0) return
    const m = Math.max(Math.abs(dx), Math.abs(dy)) || 1
    for (let i = 0; i <= len; i++) { const px = x + (dx / m) * i, py = y + (dy / m) * i; put(cv, px, py - 1, fade(0x2a6aff, 0.5 * a)); put(cv, px, py, fade(i > len - 3 ? 0xffffff : 0xb8e0ff, a)) }
    flare(cv, x + (dx / m) * len, y + (dy / m) * len, 1.6, 0xffffff, 0x9bd8ff, 0x4a82e8, a)
  }
  LANES.nebula = (cv, y0, t, calm) => {
    LY = y0
    const tt = calm ? 3.0 : t % CY, W = cv.W
    ground(cv, y0)
    const S1 = Math.round(W * 0.56), N0 = S1 - 56, N1 = N0 + 6
    // Nebula
    let nx = N0, sp: HiSprite = ready, nf = false, blen = 14, bdy = -1
    if (tt < 1.2) { nx = 4 + (N0 - 4) * ph(tt, 0, 1.2); sp = nw[Math.floor(tt * 8) & 3]!; blen = 0 }
    else if (tt < 1.7) { sp = ready; blen = Math.round(14 * ph(tt, 1.2, 1.6)) }
    else if (tt < 2.45) sp = ready
    else if (tt < 2.9) { sp = duck; bdy = 0 }
    else if (tt < 3.35) { nx = N0 + 10 * ph(tt, 2.9, 3.0); sp = lunge }
    else if (tt < 3.9) { nx = N0 + 10 - 4 * ph(tt, 3.35, 3.9); sp = ready }
    else if (tt < 4.55) { nx = N1; sp = ready }
    else if (tt < 5.1) { nx = N1; sp = Math.floor((tt - 4.55) / 0.1) & 1 ? spin : ready; nf = Math.floor((tt - 4.55) / 0.1) % 3 === 1 }
    else if (tt < 5.9) { nx = N1; sp = ready }
    else { nx = N1; sp = scan; blen = Math.round(14 * (1 - ph(tt, 5.9, 6.4))) }
    // soldier 1: stands, steps in and swings, is struck by the blue flash and falls
    const s1x = tt < 2.0 ? S1 : tt < 2.45 ? S1 - 8 * ph(tt, 2.0, 2.2) : S1 - 8
    if (tt < 4.2) {
      const u = tt - 3.0
      let s: HiSprite = tt < 2.0 ? sst : tt < 2.45 ? sdn : sst, dxo = 0
      if (tt >= 2.45 && tt < 2.9) s = sdn
      if (u >= 0) { s = u < 0.15 ? sf[0]! : u < 0.35 ? sf[1]! : slie; dxo = u < 0.15 ? 2 : u < 0.35 ? 8 : 14 }
      const al = tt > 3.7 ? 1 - (tt - 3.7) / 0.5 : 1
      shadow(cv, s1x + dxo + 15, y0, 7, 0.4 * al)
      fi(cv, s, s1x + dxo, y0, true, al)
      if (tt >= 2.0 && tt < 2.55) { const a = tt < 2.2 ? 1 : 1 - (tt - 2.2) / 0.35, gx = s1x + 6 // his swing: a hot arc over her head
        for (let i = 0; i < 16; i++) { const an = -1.1 + i * 0.1, px = gx - 4 - Math.cos(an) * 22 * ph(tt, 2.0, 2.2), py = y0 + 4 + Math.sin(an) * 7; put(cv, px, py, fade(i > 11 ? 0xffffff : 0xff7a3a, a)); put(cv, px, py + 1, fade(0xff3a1a, a * 0.6)) } }
    }
    // soldier 2: charges in from the right, is knocked flying
    if (tt >= 3.9 && tt < 6.0) {
      const x2 = N1 + 56
      if (tt < 4.75) { const sxx = W + 6 + (x2 - W - 6) * ph(tt, 3.9, 4.75); shadow(cv, sxx + 15, y0, 7, 0.4); fi(cv, srun[Math.floor(tt * 12) & 3]!, sxx, y0, true); if (tt > 4.1) for (let k = 0; k < 3; k++) for (let j = 0; j < 10; j++) put(cv, sxx + 32 + j, y0 + 3 + k * 3, fade(0xffb070, 0.5 * (1 - j / 10))) }
      else { const u = ph(tt, 4.75, 5.9), xx = x2 + 6 + 100 * u, yy = y0 - Math.sin(u * Math.PI) * 6
        if (u < 0.06) fi(cv, sst, x2, y0, true); else fi(cv, slie, xx, yy, Math.floor(u * 10) & 1 ? true : false, 1 - Math.max(0, u - 0.8) * 5) }
    }
    // baton
    const bx = hx(13, nx, nf) , by = y0 + 6 + (sp === duck ? 3 : 0)
    const pulseA = 0.8 + 0.2 * Math.sin(tt * 30)
    if (blen > 0 && !(tt >= 4.55 && tt < 5.1)) baton(cv, bx, by, 1, tt >= 2.9 && tt < 3.35 ? 0 : bdy === 0 ? 0 : -1, blen + (tt >= 2.9 && tt < 3.4 ? 6 : 0), pulseA)
    if (tt >= 1.2 && tt < 1.7) burst(cv, bx + blen, by - 1, 3, 0xffffff, 0x4a9aff, 1 - ph(tt, 1.2, 1.7) * 0.4)
    // the strike: a big blue flash on soldier 1
    if (tt >= 3.0 && tt < 3.35) { const u = ph(tt, 3.0, 3.35), cx = s1x + 12, cy = y0 + 6
      burst(cv, cx, cy, 5, 0xffffff, 0x4a9aff, 1 - u); flare(cv, cx, cy, 4 + u * 6, 0xffffff, 0x9bd8ff, 0x2a6aff, 1 - u)
      zap(cv, cx - 10, cy - 4, cx + 8, cy + 4, Math.floor(tt * 30), 0xffffff, 1 - u); zap(cv, cx + 10, cy - 4, cx - 8, cy + 4, Math.floor(tt * 30) + 7, 0x9bd8ff, 1 - u) }
    // the spin: a ring of blue sweeps through soldier 2
    if (tt >= 4.55 && tt < 5.1) { const u = ph(tt, 4.55, 5.1), cx = nx + 15
      for (let i = 0; i < 40; i++) { const an = u * 12 + i * 0.16, r = 1 - i / 60; put(cv, cx + Math.cos(an) * 26, y0 + 6 + Math.sin(an) * 5.4, fade(i < 4 ? 0xffffff : 0x6ab0ff, r)) } }
    if (tt >= 4.9 && tt < 5.25) { const u = ph(tt, 4.9, 5.25); burst(cv, N1 + 50, y0 + 6, 5, 0xffffff, 0x4a9aff, 1 - u) }
    shadow(cv, nx + 15, y0, 7, 0.4)
    fi(cv, sp, nx, y0, nf)
    // the cybernetic eye scans red
    if (tt >= 5.9 && tt < 7.7) { const u = ph(tt, 5.9, 7.7), ex = nx + 15, ey = y0 + 2, pu = 0.55 + 0.45 * Math.sin(tt * 10)
      flare(cv, ex, ey, 1.8, 0xffffff, 0xff8080, 0xff2030, pu)
      const sw = 0.5 + 0.5 * Math.sin(u * Math.PI * 3), ty = y0 + 3 + 7 * sw, len = Math.round(70 * (0.3 + 0.7 * ph(tt, 5.9, 6.3)))
      for (let i = 3; i < len; i++) { const f = i / len, yc = ey + (ty - ey) * f, hw = f * 3.2; put(cv, ex + i, yc, fade(0xff7080, 0.85 * (1 - f * 0.5))); if (i % 2 === 0) { put(cv, ex + i, yc - hw, fade(0xff2030, 0.45 * (1 - f))); put(cv, ex + i, yc + hw, fade(0xff2030, 0.45 * (1 - f))) } }
      burst(cv, ex + len, ty, 2, 0xffffff, 0xff9090, 0.9) }
  }
}

// ── Rocket: the big gun charges, fires, skids back squashed, blows up a barrel ──
{
  const P = { o: 0x22181a, f: 0x8a6f5e, F: 0x5e4638, i: 0xe0909a, w: 0xf6eee2, k: 0x0e0e12, n: 0x1a1216, c: 0xff8a1e, C: 0xc4561a, G: 0x7a8498, g: 0xc4ccdc, H: 0x464e60 }
  const AR = ['..oo....oo.........', '..oio..oio.........', '..ofooooof.........', '..offffffo.........', '..okkfffkko........', '..ofwwwwwfo........', '...owwnwo.GGGGGGGGGgg', '..occccccoGccccccGggg', '.occcccccoGGGGGGGGGgg', '..occcccco.HH.GG.....', '..oCo..oCo...........', '..FF....FF...........']
  const A = px2(AR, P), SQ = px2(['.', ...AR.slice(0, 3), ...AR.slice(4)], P)
  const B = px2(['.oo......oo.........', '.oio....oio.........', '.ofooooooof.........', '.offffffffo.........', '.okkfffkkfo.........', '.ofwwwwwwfo.........', '..owwnwwo..GGGGGGGGGgg', '.occccccocGccccccGggg', 'occcccccocGGGGGGGGGgg', '.occcccco..HH.GG.....', '.oCo..oCo...........', '.FF....FF...........'], P)
  LANES.rocket = (cv, y0, t, calm) => {
    LY = y0
    const tt = calm ? 3.0 : t % CY, W = cv.W, fire = 2.6, age = tt - fire, hitAge = 0.4, xs0 = 14, fa = tt > 7.7 ? 1 - (tt - 7.7) / 0.3 : 1
    ground(cv, y0)
    let xs = xs0
    if (age > 0) xs = age < 0.15 ? xs0 - 10 * ease(age / 0.15) : age < 0.9 ? xs0 - 10 : xs0 - 10 + 10 * ease(ph(age, 0.9, 1.8))
    const tipX = xs0 + 41, tipY = y0 + 7, barrelX = W - 16, hit = age > hitAge
    const spr = age > 0 && age < 0.12 ? B : age >= 0.12 && age < 0.45 ? SQ : A
    if (age > 0 && age < 1.0) for (let i = 0; i < 4; i++) puff(cv, xs + 12 + i * 4 + age * 6, y0 + 10, clamp(age / 1.0 + i * 0.08), 2)
    fi(cv, spr, xs, y0, false, fa)
    if (age < 0) {
      const q = clamp(tt / fire), r = 0.6 + 2 * q
      for (let i = 0; i < 12; i++) { const a = hash(i, 3) * TAU, k = 1 - ((q * 3 + i / 12) % 1), d = 4 + 26 * k, c = fade(i % 2 ? 0xffe070 : 0xff9a2a, 1 - k * 0.8); put(cv, tipX + 3 + Math.cos(a) * d * 2.4, tipY + Math.sin(a) * d * 0.5, c); put(cv, tipX + 4 + Math.cos(a) * d * 2.4, tipY + Math.sin(a) * d * 0.5, c) }
      flare(cv, tipX + 2, tipY, r, 0xffffff, 0xffe070, 0xff7a1e, 0.4 + 0.6 * q)
    } else {
      if (age < 0.45) flare(cv, tipX + 3, tipY, 2 + 4 * ease(age / 0.15) * (1 - age / 0.5), 0xffffff, 0xffe070, 0xff6a1a)
      if (age < 0.5) for (let v = 0; v < 2; v++) { const rr = age * 70 + v * 5, a = 1 - age / 0.5; for (let y = 1; y < 11; y++) put(cv, tipX + 4 + rr - ((y - 6.5) ** 2) * 0.3, y0 + y, fade(0xffe070, 0.6 * a)) }
      sparks(cv, tipX + 4, tipY, age / 0.8, 12, 2, 7, 0xffffff, 0xff7a1e, 4)
      const bp = age / hitAge, bx = tipX + 6 + bp * (barrelX - tipX - 8)
      if (bp > 0 && bp < 1) for (let i = 0; i < 18; i++) { const c = i < 2 ? 0xffffff : i < 6 ? 0xffe070 : 0xff7a1e; put(cv, bx - i, tipY, fade(c, 1 - i / 20)); put(cv, bx - i, tipY + 1, fade(c, 0.6 * (1 - i / 18))); if (i < 5) put(cv, bx - i, tipY - 1, fade(c, 0.6)) }
      if (hit) boom(cv, barrelX + 3, y0 + 7, (age - hitAge) / 1.9, 1)
      if (age > 1.2 && age < 4.6) for (let i = 0; i < 3; i++) puff(cv, tipX + 5, tipY - 2, clamp(((age - 1.2) / 1.6 + i / 3) % 1), 1, 0x9a9ab0) // blowing on the barrel
    }
    if (!hit) { for (let y = 5; y < 11; y++) for (let x = 0; x < 7; x++) put(cv, barrelX + x, y0 + y, x === 0 || x === 6 ? 0x3a4056 : y === 7 || y === 9 ? 0x9a3a2a : 0x6a748c); put(cv, barrelX + 2, y0 + 4, 0xffe070) }
    else if (age > hitAge + 1.2) { for (let x = 0; x < 6; x++) put(cv, barrelX + x, y0 + 10, 0x3a3038); for (let x = 1; x < 5; x++) put(cv, barrelX + x, y0 + 9, 0x4a4048); const e = (tt * 3) % 1; put(cv, barrelX + 2, y0 + 8, e < 0.5 ? 0xffa040 : 0xc4561a); put(cv, barrelX + 3, y0 + 8, e < 0.5 ? 0xc4561a : 0xffa040) }
  }
}

const twig = (cv: Canvas, x: number, y: number, sl: number, len: number, sd: number, f: number, dep: number) => {
  if (f <= 0) return
  let px = x, py = y
  const n = len * 2
  for (let j = 1; j <= n; j++) {
    const u = j / 2
    px = x + u * 1.9; py = y + sl * u * 1.1 + Math.sin(u * 0.45 + sd) * 1.1 * Math.min(1, u / 4)
    put(cv, px, py, fade(j > n - 3 ? 0xb0f070 : dep ? 0xa87040 : 0xc4905a, f))
    if (dep < 1 && j === Math.floor(n * 0.55) && len > 6) twig(cv, px, py, -sl * 0.5, Math.round(len * 0.5), sd + 3, f, 1)
  }
  put(cv, px + 1, py, fade(0xb0f070, f)); put(cv, px + 2, py, fade(0x62c23c, f)); put(cv, px + 1, py - 1, fade(0x62c23c, f)); put(cv, px, py + 1, fade(0x3f8a2a, f))
}
// ── Groot: arm out, vine across the lane, a woven dome, Baby Groot in a pot ─
{
  const P = { o: 0x2a1a10, b: 0x9a6a3c, B: 0x6a4224, k: 0x120a06, l: 0x62c23c, L: 0xb0f070, y: 0xffc030, g: 0x3a2414, r: 0xd2693c, p: 0xa8482a, P: 0x7a301c }
  const GR = ['..lL..lL......', '..oooooooo....', '.obbBbbBbbo...', '.obyybbyybo...', '.obbbggbbbo...', '..obbbbbbo....', 'b.obBbbbbo.b..', 'bboBbbbbBobb..', '.b.obbbbo..bb.', '...obBBbo.....', '..oBb..bBo....', '.oBB....BBo...']
  const G = px2(GR, P)
  const GA = px2(['..Ll..lL.......', ...GR.slice(1, 6), 'b.obBbbbbo..bb', 'bboBbbbbBobbb.', ...GR.slice(8)], P)
  const GU = px2(['..Ll..lL.......', ...GR.slice(1, 3), '.obyybbyybo.bb', '.obbbggbbbo.b.', '..obbbbbbo.b..', 'b.obBbbbbo.b..', 'bboBbbbbBobb..', ...GR.slice(8)], P)
  const GE = px2(['...lL..lL.....', '...oooooooo....', '..obbBbbBbbo...', '..obyybbyybo...', '..obbbggbbbo...', '...obbbbbbo....', 'b.obBbbbbobbbbbbb', 'bboBbbbbBobbbbbbb', '.b.obbbbo..bb.', ...GR.slice(9)], P)
  const BA = ['..lL..', '.bbbb.', 'bkbbkb', '.bbbb.', 'b.BB.b', 'rrrrrr', '.pPPp.', '..pp..']
  const BF = [BA, ['b.lL.b', 'bbbbbb', 'bkbbkb', '.bbbb.', '..BB..', 'rrrrrr', '.pPPp.', '..pp..'], ['......', '..lL..', '.bbbb.', 'bkbbkb', 'b.bb.b', 'rrrrrr', '.pPPp.', '..pp..'], ['b.Ll.b', 'bbbbbb', 'bkbbkb', '.bbbb.', '..BB..', 'rrrrrr', '.pPPp.', '..pp..']].map(r => px2(r, P))
  const seed = px2(['......', '......', '......', '..lL..', '..bb..', 'rrrrrr', '.pPPp.', '..pp..'], P), grow = Array.from({ length: 6 }, (_, k) => px2(BA.slice(7 - k), P))
  const pathY = (x: number) => 6.5 + Math.sin((x - 30) * 0.08) * 2.4
  LANES.groot = (cv, y0, t, calm) => {
    LY = y0
    const tt = calm ? 4.6 : t % CY, W = cv.W, endX = Math.round(W * 0.8), x0 = 34
    const gr = ease(ph(tt, 0.9, 3.5)), wither = ph(tt, 5.9, 6.7), tip = x0 + gr * (endX - 5 - x0)
    ground(cv, y0)
    // the pot at the end of the lane: a seedling from t = 0
    const px0 = endX - 5, wob = tt > 3.4 && tt < 3.9 ? (Math.floor(tt * 14) % 2 ? 1 : -1) : 0
    if (tt < 6.3) cv.hi(seed, (px0 + wob) / 2, y0 + 4)
    else { const u = (tt - 6.3) / 0.8, k = Math.min(6, Math.floor(u * 6) + 1); if (u < 1) cv.hi(grow[k - 1]!, px0 / 2, y0 + 4 + (8 - 1 - k)); else cv.hi(BF[Math.floor((tt - 7.1) * 5) % 4]!, px0 / 2, y0 + 4) }
    if (gr > 0) {
      for (let x = x0; x < tip; x++) {
        const s = ph(x, endX - 40, endX - 6), yi = Math.round(pathY(x) * (1 - s) + 9.5 * s) + y0, f = x > endX - 14 ? 1 : 1 - wither
        if (f <= 0) continue
        put(cv, x, yi, fade(x < x0 + (tip - x0) * 0.4 ? 0xd8a468 : 0xc4905a, f)); if (x < x0 + (tip - x0) * 0.4 && x % 3 !== 0) put(cv, x, yi + 1, fade(0x7a4e2a, f))
      }
      // thin organic tendrils: each branches once, tapers, and ends in a bright leaf
      for (let bi = 0; bi < 7; bi++) {
        const bx2 = x0 + 10 + bi * 11, sz = clamp((tip - bx2) / 26)
        if (sz <= 0 || bx2 > endX - 16) continue
        const f = 1 - wither, yb = Math.round(pathY(bx2) + y0), side = bi % 2 ? -1 : 1, sl = side * (0.5 + 0.35 * hash(bi, 7)), L = Math.round((10 + 4 * hash(bi, 9)) * sz)
        twig(cv, bx2, yb, sl, L, bi, f, 0)
      }
      if (gr < 1) flare(cv, tip, pathY(tip) + y0, 1.7, 0xf4ffc8, 0xb0f070, 0x62c23c)
    }
    // Groot: raises an arm, leans out as the vine grows, then guards under the dome
    const dome = ph(tt, 3.4, 4.6), dfade = 1 - ph(tt, 6.0, 6.6)
    if (dome > 0 && dfade > 0) {
      const cx = 16, cy = y0 + 11, N = 150
      for (let s2 = 0; s2 < 2; s2++) for (let i = 0; i <= N * dome; i++) {
        const a = Math.PI - (i / N) * Math.PI, off = Math.sin(i * 0.42 + s2 * Math.PI), x = cx + Math.cos(a) * (23 + off * 1.8), y = cy - Math.sin(a) * (10 + off * 1.2)
        const c = fade(s2 ? 0x7a4e2a : 0xc4905a, dfade); put(cv, x, y, c)
        if (s2 && i % 13 === 6) { put(cv, x - 1, y - 1, fade(0x62c23c, dfade)); put(cv, x, y - 1, fade(0xb0f070, dfade)); put(cv, x + 2, y - 1, fade(0x62c23c, dfade)) }
      }
      if (dome >= 1) for (let k = 0; k < 9; k++) { const p = (tt * 0.4 + k / 9) % 1, sx = 3 + ((k * 5) % 34), sy = y0 + 9 - p * 8, c = fade(k % 2 ? 0xb0f070 : 0xf4ffc8, Math.sin(p * Math.PI) * dfade); put(cv, sx, sy, c); put(cv, sx + 1, sy, c); put(cv, sx, sy - 1, fade(c, 0.5)); put(cv, sx + 1, sy + 1, fade(c, 0.4)) }
    }
    cv.hi(tt < 0.5 ? (Math.floor(tt * 3) % 2 ? GA : G) : tt < 1.0 ? GU : tt < 3.5 ? GE : tt < 4.9 ? GU : tt < 6.6 ? G : Math.floor(tt * 2) % 2 ? GA : G, 0, y0)
    if (tt > 6.0 && tt < 6.8) for (let k = 0; k < 8; k++) { const p = ph(tt, 6.0, 6.8), x = 4 + k * 5, y = y0 + 3 + p * 8 + (k % 3), c = fade(k % 2 ? 0x62c23c : 0xb0f070, 1 - p); put(cv, x, y, c); put(cv, x + 1, y, c) }
    if (tt >= 7.1) for (let i = 0; i < 2; i++) { const p = ((tt - 7.1) * 1.2 + i / 2) % 1, nx = px0 + 14 + i * 4; put(cv, nx, y0 + 6 - p * 5, fade(0xb0f070, 1 - p)); put(cv, nx + 1, y0 + 6 - p * 5, fade(0xb0f070, 1 - p)) }
  }
}

// ── Mantis: lays a hand on a huge Sovereign guard; her antennae glow, empathic waves roll out, he goes limp and topples asleep ────
{
  const MP = { A: 0xc8f060, h: 0x3a2a68, s: 0xf8dcb8, k: 0x1a1030, g: 0x2ee05a, G: 0x159a3a, y: 0xffd040, B: 0x1fb050 }
  const mrows = (reach: boolean, step: number) => ['.A........A.', '..A.hhhh.A..', '...hssssh...', '...hkssk' + 'h...', '....ssss....', reach ? '..sggggggsss' : '..sggggggs..', '..sggGGggs..', '..syyyyyys..', '..gggggggg..', step ? '...ss...ss..' : '....ss.ss...', step ? '...ss...ss..' : '....ss.ss...', step ? '..GGG...GGG.' : '...GGG.GGG..']
  const mw = [px2(mrows(false, 0), MP), px2(mrows(false, 1), MP)], mreach = px2(mrows(true, 0), MP)
  const BP = { o: 0x3a2208, y: 0xffd34a, Y: 0xd09a20, e: 0xff3050, k: 0x3a2208, c: 0xff6a2a, p: 0x8a5ae0, P: 0x5a3aa8 }
  const BR = (eye: string) => ['......cccc......', '.....oyyyyo.....', '.....oy' + eye + 'yo.....', '.....oyyyyo.....', '..ooyyyyyyyyoo..', '.oyyyYYyyYYyyyo.', 'oyyyyYppppYyyyyo', 'oyyyyYppppYyyyyo', '.oyyyyYppYyyyyo.', '..ooYYYYYYYYoo..', '...oPPP..PPPo...', '...oPPP..PPPo...']
  const shear = (rows: string[], s: number) => px2(rows.map((r, i) => '.'.repeat(Math.round((s * (11 - i)) / 11)) + r), BP)
  const awake = BR('ee'), asleep = BR('kk')
  const brute = px2(awake, BP), limp = px2(asleep, BP)
  const tilt = [2, 4, 7, 11].map(s => shear(asleep, s))
  const flat = px2(['', '', '', '', '', '', '.cc...................', 'oyyyyoooooooooooo.....', 'oykkyoyyYpppppYyyPPPo.', 'oyyyyoyyYpppppYyyPPPo.', '.ooooYYYYYYYYYYYooooo.', '......oooooooooooo....'], BP)
  LANES.mantis = (cv, y0, t, calm) => {
    LY = y0
    const tt = calm ? 4.4 : t % CY, W = cv.W, bx = Math.round(W * 0.62), fa = tt > 7.7 ? 1 - (tt - 7.7) / 0.3 : 1
    ground(cv, y0)
    const stopX = bx - 22, walking = tt < 2.6
    const mx = walking ? 6 + (stopX - 6) * ph(tt, 0, 2.6) : stopX
    const ms = walking ? mw[Math.floor(tt * 4) & 1]! : tt < 6.0 ? mreach : mw[0]!
    // brute
    let bs: HiSprite = brute, bdx = 0, bdy = 0
    if (tt < 2.6) bdy = Math.floor(tt * 2) & 1 ? 0 : 0
    if (tt >= 3.7 && tt < 4.3) { bs = brute }
    if (tt >= 4.3) bs = limp
    if (tt >= 4.6 && tt < 5.6) { const sw = Math.sin((tt - 4.6) * 7); bs = sw > 0.35 ? tilt[0]! : limp; bdx = sw < -0.35 ? -1 : 0 }
    if (tt >= 5.6 && tt < 6.2) bs = tilt[Math.min(3, Math.floor((tt - 5.6) / 0.15))]!
    const down = tt >= 6.2
    shadow(cv, bx + (down ? 22 : 16), y0, down ? 20 : 15, 0.45)
    if (down) fi(cv, flat, bx - 4, y0, false, fa); else fi(cv, bs, bx + bdx, y0 + bdy, false, fa)
    fi(cv, ms, mx, y0, false, fa)
    // antennae glow ramps as she reaches, flares at the touch
    const glow = tt < 2.6 ? 0.45 : tt < 3.5 ? 0.45 + 0.55 * ph(tt, 2.6, 3.5) : tt < 6.0 ? 0.8 + 0.2 * Math.sin(tt * 12) : 0.5 * (1 - ph(tt, 6.0, 7.0)) + 0.35
    for (const ax of [mx + 3, mx + 21]) flare(cv, ax, y0 + 1, 0.9 + glow * 0.7, 0xffffff, 0xe8ff80, 0x2ee05a, fa * (0.75 + 0.25 * clamp(glow)))
    const hxx = mx + 23, hyy = y0 + 5
    if (tt >= 3.4 && tt < 3.9) { const u = ph(tt, 3.4, 3.9); burst(cv, hxx + 2, hyy, 3 + Math.round(2 * (1 - u)), 0xffffff, 0xffe070, 1 - u * 0.6) }
    // empathic waves: green-gold crescents roll out from her head across the brute
    if (tt >= 3.6 && tt < 6.0) { const cx = mx + 12, cy = y0 + 3, k = Math.min(1, (tt - 3.6) / 0.3) * (tt > 5.6 ? 1 - ph(tt, 5.6, 6.0) : 1)
      for (let r = 0; r < 5; r++) { const u = ((tt - 3.6) * 0.9 + r / 5) % 1, rr = 4 + u * 30, a = (0.35 + 0.65 * (1 - u)) * k
        for (let i = -16; i <= 16; i++) { const an = i * 0.075, wx = cx + Math.cos(an) * rr * 2.4, wy = cy + Math.sin(an) * rr * 0.55
          const c = fade(r % 2 ? 0xffe070 : 0x7aff9a, a); put(cv, wx, wy + 3, c); put(cv, wx + 1, wy + 3, c); put(cv, wx, wy + 4, fade(c, 0.5)) } } }
    // he slumps: dust puff on the thud
    if (tt >= 6.1 && tt < 6.6) { const u = ph(tt, 6.1, 6.6); for (let i = 0; i < 5; i++) puff(cv, bx + 4 + i * 9, y0 + 10, u, 3); if (u < 0.5) burst(cv, bx + 20, y0 + 10, 2, 0xffffff, 0xffe070, 1 - u * 2) }
    // big bright Zzz drift up from the sleeper
    if (tt >= 6.3 && tt < 7.8) for (let k = 0; k < 3; k++) { const p = ((tt - 6.3) * 0.7 + k / 3) % 1, zx = bx + 30 + k * 6 + p * 8, zy = y0 + 5 - p * 5 - k; zzz(cv, zx, Math.round(zy), fade(k === 1 ? 0xffffff : 0xd8c8ff, Math.sin(p * Math.PI) * fa)) }
  }
}

// ── Yondu: whistle, the Yaka arrow weaves through five Ravagers, Mary Poppins ─
{
  const YO: Look = { pal: { r: 0xf03030, b: 0x2a8cff, B: 0x1658c8, e: 0xff3030, g: 0x2a1810, c: 0x8a5230, C: 0x4a2a18, k: 0x1a0a14 }, hd: ['.rrr.', 'bebeb', '.bgb.'], tor: ['ccc', 'cCc', 'ccc', 'CCC'], leg: 'C', legF: 'k', ft: 'k', arm: 'b', farm: 'B', hand: 'b' }
  const whist = ['.rrr.', 'bebeb', '.bkb.']
  const ys = rig(YO, stand), yw = rig(YO, { ...stand, h: whist }), yp = rig(YO, { lf: [5, 11], rf: [9, 11], lh: [4, 8], rh: [12, 4] }), yh = rig(YO, { lf: [6, 9], rf: [8, 10], lh: [4, 7], rh: [12, 4] }), yh2 = rig(YO, { lf: [5, 10], rf: [9, 9], lh: [4, 7], rh: [12, 4] })
  const mkRav = (h: number, v: number): Look => ({ pal: { h, s: 0xe0b890, k: 0x1a1018, v, V: 0x3a2e48, p: 0x7a6a90, P: 0x4e4264, m: 0x6a5a40 }, hd: ['.hhh.', 'hsksh', '.sss.'], tor: ['vvv', 'vVv', 'vvv', 'VVV'], leg: 'p', legF: 'P', ft: 'k', arm: 'v', farm: 'V', hand: 's' })
  const lk = [mkRav(0xd8a030, 0xb04a3a), mkRav(0x3a3a50, 0x4a7ab0), mkRav(0xb04a3a, 0x7a9a3a), mkRav(0x8a8aa8, 0xb08a3a), mkRav(0x2a2a30, 0x8a4aa8)]
  const rs = lk.map(l => [rig(l, stand), rig(l, { ...stand, lh: [4, 7], rh: [11, 7] })]), rf = lk.map(falls)
  const rxF = [0.30, 0.43, 0.56, 0.69, 0.82], hitT = [2.7, 3.05, 3.4, 3.75, 4.1]
  LANES.yondu = (cv, y0, t, calm) => {
    LY = y0
    const tt = calm ? 3.4 : t % CY, W = cv.W, fa = tt > 7.7 ? 1 - (tt - 7.7) / 0.3 : 1
    ground(cv, y0)
    const ax0 = 4, mouthX = ax0 + 18, mouthY = y0 + 4
    const whistling = tt > 0.4 && tt < 2.2
    // Yondu: whistles, aims, then (after the carnage) floats off beneath an umbrella
    let yx = ax0, ysp = whistling ? (Math.floor(tt * 6) % 2 ? yw : ys) : ys, hover = 0
    if (tt >= 2.2 && tt < 4.9) ysp = yp
    if (tt >= 5.1) {
      const u = ph(tt, 5.1, 7.4); yx = ax0 + (W * 0.78 - ax0) * ease(u); hover = tt < 7.4 ? 2 : 0
      ysp = hover ? (Math.floor(tt * 3) % 2 ? yh : yh2) : ys
      if (tt >= 7.4) { ysp = ys; yx = W * 0.78 }
    }
    const hy = hover ? y0 - 0 : y0
    for (let i = 0; i < 5; i++) {
      const x1 = W * rxF[i]!, u = tt - hitT[i]!
      let s: HiSprite = rs[i]![Math.floor(tt * 1.5 + i) % 2]!, dxo = 0
      if (u >= 0) { s = u < 0.22 ? rf[i]![0]! : rf[i]![2]!; dxo = u < 0.22 ? 3 : 9 }
      fi(cv, s, x1 + dxo, y0, true, fa)
      if (u > 0.3 && u < 0.7) puff(cv, x1 + 24, y0 + 10, (u - 0.3) / 0.4)
      if (u >= 0 && u < 0.25) burst(cv, x1 + 14, y0 + 4, 3, 0xffffff, 0xff6a5a, 1 - u / 0.25)
    }
    if (hover) { shadow(cv, yx + 15, y0, 8, 0.5 - 0.1 * Math.sin(tt * 6)); fi(cv, ysp, yx, hy - 0, false, fa) } else fi(cv, ysp, yx, y0, false, fa)
    // fin glow when whistling, notes drifting out
    if (tt > 0.3 && tt < 2.6) { const pl = 0.5 + 0.5 * Math.sin(tt * 9); flare(cv, ax0 + 14, y0 + 1, 1 + pl * 0.6, 0xffffff, 0xff6a5a, 0xf03030, 0.3 + 0.4 * pl) }
    if (whistling) for (let k = 0; k < 3; k++) { const p = (tt * 0.9 + k / 3) % 1; note(cv, mouthX + 6 + p * 30, mouthY - 2 - p * 4 + Math.sin(p * 9 + k) * 1.2, fade(k % 2 ? 0x9bffe0 : 0xffffff, 1 - p)) }
    // the arrow: launched at 2.2, zig-zags through every Ravager head, then returns to hand
    const at = tt - 2.2
    if (at > 0 && at < 2.4) {
      const hxp = (px: number) => {
        let yy = 4, i = 0
        const xs2 = [mouthX, ...rxF.map(r => W * r + 14)]
        for (i = 0; i < 5; i++) if (px < xs2[i + 1]!) break
        i = Math.min(i, 4); const a = xs2[i]!, b = xs2[i + 1]!, f = clamp((px - a) / (b - a))
        yy = 4 + (i % 2 ? -1 : 1) * Math.sin(f * Math.PI) * (i % 2 ? 3 : 4.5) * (i === 4 && f > 0.99 ? 0 : 1)
        return y0 + yy
      }
      const endX = W * rxF[4]! + 20, head = mouthX + (endX - mouthX) * ease(clamp(at / 2.0))
      for (let i = 0; i < 40; i++) { const px = head - i * 1.6; if (px < mouthX) break; const c = i < 2 ? 0xfff4c8 : i < 7 ? 0xffc850 : i < 18 ? 0xff7a28 : 0xe8442a, al = i < 18 ? 1 : 1 - (i - 18) / 23, yy = hxp(px); put(cv, px, yy, fade(c, al)); put(cv, px + 1, yy, fade(c, al)); put(cv, px, yy + 1, fade(c, al * 0.8)); put(cv, px + 1, yy + 1, fade(c, al * 0.6)) }
      for (let k = 0; k < 6; k++) { const px = head - 8 - k * 6 - ((tt * 40) % 6), yy = hxp(px) + (hash(k, Math.floor(tt * 12)) - 0.5) * 5; if (px > mouthX) { put(cv, px, yy, fade(0xffa040, 1 - k / 7)); put(cv, px + 1, yy, fade(0xffd070, 0.8 - k / 8)) } }
      if (at < 2.0) { const hyy = hxp(head); put(cv, head + 2, hyy, 0xffffff); put(cv, head + 3, hyy, 0xffffff); put(cv, head + 1, hyy + 1, 0xffd0c0); put(cv, head + 2, hyy + 1, 0xffd0c0); flare(cv, head + 2, hyy, 2.2, 0xffffff, 0xffe070, 0xff7a28, 0.9) }
      if (at < 0.15) flare(cv, mouthX, mouthY, 2.4 * (1 - at / 0.15), 0xffffff, 0xff7a6a, 0xf03030)
    }
    // Mary Poppins: the umbrella pops open in his raised hand
    if (tt >= 4.9) {
      const op = ph(tt, 4.9, 5.3), ux = hx(12, yx, false), uy = y0 + 3
      for (let i = -Math.round(8 * op); i <= Math.round(8 * op); i++) { const yy = uy - Math.round(Math.sqrt(Math.max(0, 1 - (i / 9) ** 2)) * 3) + 1; put(cv, ux + i, yy, i % 4 === 0 ? 0xffd0c0 : 0xf03030); put(cv, ux + i, yy + 1, 0xa01420) }
      for (let y = uy + 1; y <= uy + 3; y++) put(cv, ux, y, 0x8a5230)
      if (tt < 5.3) burst(cv, ux, uy - 1, 3, 0xffffff, 0xffd0c0, 1 - op)
      if (tt >= 7.4 && tt < 7.8) puff(cv, yx + 6, y0 + 10, (tt - 7.4) / 0.4)
    }
  }
}
