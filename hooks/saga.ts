// clarvis AVENGERS THEATER: draws a resolved movie (saga-plan.ts) as
// comic-book panels. Each beat is one panel: flat colour and Ben-Day dots
// behind, the arcade fighters (heroes without a sheet wear a tinted body and
// their baked band portrait as a big comic head), ink borders, yellow caption
// boxes, white balloons with tails (jagged for shouts, puffy for thoughts),
// big slanted sound effects with an outline, starbursts, speed lines.
//
// Pure: a panel is a function of (beat, rect, time). Sheets are decoded once
// per fighter and sampled at draw time (no scaled copies are kept).
import { Canvas, clamp01, easeIn, easeInOut, easeOut, easeOutBack, hash, lerp, rgb, scale, type HiSprite } from './pixel'
import * as FT from './arcade-fighters'
import { STAGE_ART } from './portraits'
import { MSPRITES } from './msprites'
import type { Bg, CharId, FxKind } from './saga-types'
import { beatAt, type PBeat, type Plan } from './saga-plan'
import { addFig, battle, battleCam, bystanders, fig, lineup, LX, RX, resetFigs, teamup, wanted, capFor } from './saga-stage'

// Film grammar (the theater): shots, not panels; light, not drawn bursts; subtitles, not balloons.
export const FILM = true
export const INK = 0x0b0b12, PAPER = rgb('#F3E9D2'), WHITE = 0xfffdf6, YEL = rgb('#FFE14D'), RED = rgb('#D7262E')
const TAU = Math.PI * 2

// ── the cast ────────────────────────────────────────────────────────────────
type FKey = 'CAP' | 'IRONMAN' | 'THOR' | 'HULK' | 'HULKBUSTER' | 'THANOS' | 'BUCKY' | 'FALCON' | 'ANTMAN' | 'HAWKEYE' | 'WANDA' | 'WARMACHINE' | 'WIDOW' | 'PANTHER' | 'SPIDEY' | 'VISION'
type Def = { name: string; c: number; f: FKey; size?: number; holo?: boolean; ghost?: boolean }
const d = (name: string, c: string, f: FKey, o: Partial<Omit<Def, 'name' | 'c' | 'f'>> = {}): Def => ({ name, c: rgb(c), f, ...o })
export const CHARS: Record<CharId, Def> = {
  CAP: d('CAPTAIN AMERICA', '#5C8BFF', 'CAP'), IRONMAN: d('IRON MAN', '#E5383F', 'IRONMAN'), THOR: d('THOR', '#BFD4FF', 'THOR'), HULK: d('HULK', '#7CD650', 'HULK'),
  HULKBUSTER: d('HULKBUSTER', '#E5383F', 'HULKBUSTER'), THANOS: d('THANOS', '#A98AE0', 'THANOS'), BUCKY: d('BUCKY', '#9AA4B8', 'BUCKY'), FALCON: d('FALCON', '#D23B3B', 'FALCON'),
  ANTMAN: d('ANT-MAN', '#E5383F', 'ANTMAN'), HAWKEYE: d('HAWKEYE', '#B48AF0', 'HAWKEYE'), WANDA: d('SCARLET WITCH', '#FF3E6C', 'WANDA'), WARMACHINE: d('WAR MACHINE', '#A5AFC2', 'WARMACHINE'),
  WIDOW: d('BLACK WIDOW', '#E0233A', 'WIDOW'), PANTHER: d('BLACK PANTHER', '#8E6CFF', 'PANTHER'), SPIDEY: d('SPIDER-MAN', '#FF4B5C', 'SPIDEY'), VISION: d('VISION', '#E0306A', 'VISION'),
  LOKI: d('LOKI', '#3FBF5A', 'CAP'), ULTRON: d('ULTRON', '#FF2A2A', 'IRONMAN'),
  STRANGE: d('DOCTOR STRANGE', '#FFA43A', 'VISION'), JARVIS: d('J.A.R.V.I.S.', '#5FE1FF', 'IRONMAN', { holo: true }),
  FURY: d('NICK FURY', '#FFB020', 'BUCKY'), DEADPOOL: d('DEADPOOL', '#FF4B5C', 'SPIDEY'),
  WOLVERINE: d('WOLVERINE', '#F5C542', 'CAP'),
  STARLORD: d('STAR-LORD', '#FF8A1E', 'FALCON'), GAMORA: d('GAMORA', '#62C23C', 'WIDOW'),
  DRAX: d('DRAX', '#C0242C', 'HULK'), ROCKET: d('ROCKET', '#F07A1C', 'SPIDEY'),
  GROOT: d('GROOT', '#9A6A3C', 'HULK'), MANTIS: d('MANTIS', '#7CD650', 'WIDOW'),
  NEBULA: d('NEBULA', '#4A6CD0', 'WIDOW'), YONDU: d('YONDU', '#3A6FD8', 'FALCON'),
  DRONE: d('ULTRON DRONE', '#A5AFC2', 'IRONMAN'), CHITAURI: d('CHITAURI', '#8E7CA8', 'BUCKY'),
  GIANTMAN: d('GIANT-MAN', '#E5383F', 'ANTMAN'), WONG: d('WONG', '#E08A2A', 'CAP'),
  SHURI: d('SHURI', '#B48AF0', 'WIDOW'), OKOYE: d('OKOYE', '#E03A3A', 'WIDOW'), DORA: d('DORA MILAJE', '#E03A3A', 'WIDOW'),
  MBAKU: d("M'BAKU", '#E6E6F5', 'THOR'), DRAUGR: d('DRAUGR', '#7FA89A', 'BUCKY'), REBEL: d('SAKAAR REBEL', '#E0842A', 'CAP'), CULTIST: d('CULTIST', '#9A4AD0', 'VISION'), KILLMONGER: d('KILLMONGER', '#F5C542', 'PANTHER'),
  VALKYRIE: d('VALKYRIE', '#C8D0E0', 'WIDOW'), KORG: d('KORG', '#8098B0', 'HULK'), HELA: d('HELA', '#3FBF5A', 'WIDOW'),
  GRANDMASTER: d('GRANDMASTER', '#F5C542', 'CAP'), RESCUE: d('RESCUE', '#6A7CFF', 'IRONMAN'), CMARVEL: d('CAPTAIN MARVEL', '#F5C542', 'WIDOW'),
  MAW: d('EBONY MAW', '#A5AFC2', 'VISION'), DORMAMMU: d('DORMAMMU', '#FF4FD8', 'THANOS', { ghost: true }),
  SYLVIE: d('SYLVIE', '#3FBF5A', 'WIDOW'), KIDLOKI: d('KID LOKI', '#3FBF5A', 'SPIDEY'),
  CROCLOKI: d('ALLIGATOR LOKI', '#5FAF3A', 'HULK'), HOWARD: d('HOWARD THE DUCK', '#F5E6B0', 'SPIDEY'),
  PEPPER: d('PEPPER POTTS', '#F0B080', 'WIDOW'), COULSON: d('AGENT COULSON', '#8C90B4', 'CAP'), MARIA: d('MARIA HILL', '#8C90B4', 'WIDOW'),
  TEAM: d('THE AVENGERS', '#F5C542', 'CAP', { size: 0 }),
}
export const nameOf = (c: string) => (CHARS as Record<string, Def>)[c]?.name ?? c

// ── sheets: decoded once per fighter, a shrunken copy cached per fighter ─────
type Sheet = { w: number; h: number; n: number; px: Int32Array; a: Uint8Array; ax: number; ay: number; hand: number[]; top: Int16Array; mid: Int16Array }
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64I = new Int8Array(128).fill(-1)
for (let i = 0; i < 64; i++) B64I[B64.charCodeAt(i)] = i
function unb64(s: string): Uint8Array {
  let n = s.length
  while (n && s[n - 1] === '=') n--
  const out = new Uint8Array((n * 3) >> 2)
  let acc = 0, bits = 0, o = 0
  for (let i = 0; i < n; i++) { acc = ((acc << 6) | B64I[s.charCodeAt(i)]!) & 0xffffff; bits += 6; if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255 } }
  return out
}
const BASES = new Map<FKey, Sheet>()
function headInfo(s: Sheet) { // the topmost ink row of each frame and its centre: where a portrait head goes
  for (let f = 0; f < s.n; f++) {
    let top = -1
    for (let y = 0; y < s.h && top < 0; y++) for (let x = 0; x < s.w; x++) if (s.a[f * s.w * s.h + y * s.w + x]! > 100) { top = y; break }
    let sx = 0, cnt = 0
    for (let y = Math.max(0, top); y < Math.min(s.h, top + Math.ceil(s.h * 0.12)); y++) for (let x = 0; x < s.w; x++) if (s.a[f * s.w * s.h + y * s.w + x]! > 100) { sx += x; cnt++ }
    s.top[f] = Math.max(0, top); s.mid[f] = cnt ? Math.round(sx / cnt) : s.w >> 1
  }
}
function build(F: (typeof FT)[FKey]): Sheet {
  const b = unb64(F.data), N = F.w * F.h * F.n, px = new Int32Array(N), a = new Uint8Array(N)
  for (let i = 0; i < N; i++) { const k = b[i]!; if (k) { px[i] = F.pal[k - 1]!; a[i] = 255 } }
  const s: Sheet = { w: F.w, h: F.h, n: F.n, px, a, ax: F.ax, ay: F.ay, hand: F.hand, top: new Int16Array(F.n), mid: new Int16Array(F.n) }
  headInfo(s)
  return s
}
function base(f: FKey): Sheet {
  let s = BASES.get(f)
  if (!s) { s = build(FT[f]); BASES.set(f, s) }
  return s
}
// A hand-drawn movie sprite (hooks/msprites): its own body, no tint, no pasted head. Held apart from the arcade sheets.
const MBASES = new Map<string, Sheet>()
function mbase(id: string): Sheet | undefined {
  const F = MSPRITES[id]
  if (!F) return undefined
  let s = MBASES.get(id)
  if (!s) { s = build(F); MBASES.set(id, s) }
  return s
}
// How tall a character stands against a normal hero: a hand-drawn sheet by its own height, else the borrowed body's size.
export const heightK = (id: CharId) => { const F = MSPRITES[id]; return F ? F.h / 32 : CHARS[id]?.size ?? 1 }
// A character's sheet box (width, height, feet x, body scale): what a cached sprite must fit.
export function sheetBox(id: CharId): [number, number, number, number] {
  const D = CHARS[id], M = mbase(id), S = M ?? (D ? base(D.f) : undefined)
  return S ? [S.w, S.h, S.ax, M ? 1 : D?.size ?? 1] : [32, 32, 18, 1]
}
// How wide a character's body is drawn (columns) at a normal hero's height `figH`: the ink of its idle frame. Layout spaces figures by this.
const BODYPX = new Map<string, number>()
export function bodyW(id: CharId, figH: number): number {
  let px = BODYPX.get(id)
  if (px === undefined) {
    const D = CHARS[id], S = mbase(id) ?? (D ? base(D.f) : undefined)
    px = 16
    if (S) { let x0 = S.w, x1 = -1; for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) if (S.a[y * S.w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x } if (x1 >= 0) px = x1 - x0 + 1 }
    BODYPX.set(id, px)
  }
  return px * (figH / 32) + 1
}
export const hasSprite = (id: string) => !!MSPRITES[id]
// How many fighter sheets are held (tests: the caches stay bounded).
export const sheetCount = () => BASES.size

// ── drawing a character ─────────────────────────────────────────────────────
// Posterising: a busy frame draws its figures in fewer tones (flat comic colour,
// and far fewer colour runs for the pane's tree). 0 = full colour.
const QT = new Uint8Array(256)
let QN = 0
export function setQuant(n: number) {
  if (n === QN) return
  QN = n
  for (let v = 0; v < 256; v++) QT[v] = n > 1 ? Math.round(Math.round((v * (n - 1)) / 255) * (255 / (n - 1))) : v
}
// Flat: figures as two-tone pop-art (ink and their own colour): the frozen panels of a
// busy page and a crowd's back rank. Far fewer colour runs, and every hero still reads.
let FLAT = 0 // 1 flat (4 tones), 2 a one-tone silhouette (a frozen panel of a very busy page)
export function setFlat(v: number) { FLAT = v }
// The figure render mode (flat/posterised): part of a cached sprite's key.
export const renderMode = () => FLAT * 8 + QN
let FLATSIL = false, FLATC = 0, FLATS = 0, FLATH = 0 // the colour, its shade and its highlight (visors, eyes)
const quant = (c: number) => {
  if (FLATSIL && FLATC) return FLATC
  if (FLATC) { const l = ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11; return l < 44 ? INK : l < 110 ? FLATS : l < 205 ? FLATC : FLATH }
  return QN ? (QT[(c >> 16) & 255]! << 16) | (QT[(c >> 8) & 255]! << 8) | QT[c & 255]! : c
}
export const P = { idle0: 0, idle1: 1, walk0: 2, walk1: 3, punch: 4, special: 5, block: 6, hurt: 7, jump: 8, super: 9, ko: 10 } as const
export type DrawOpt = { flash?: number; alpha?: number; dust?: number; dim?: number; flat?: boolean; sil?: boolean; dark?: boolean; fog?: number; fogc?: number }
const NO: DrawOpt = {}
// Draws `id` in pose `fr` with its feet at logical (fx, fy), `figH` px the height of a
// normal-sized hero, facing right (face 1) or left (-1). Returns the head's top y.
export function drawChar(cv: Canvas, id: CharId, fr: number, fx: number, fy: number, figH: number, face: number, t: number, o: DrawOpt = NO): number {
  const D = CHARS[id]
  if (!D || D.size === 0) return fy - figH
  const M = mbase(id), k = figH / 32, S = M ?? base(D.f), sk = Math.max(0.12, k) // never scaled by anything but the shot's scale
  const F = Math.min(fr, S.n - 1), W = S.w, Hh = S.h, off = F * W * Hh
  const alpha = (o.alpha ?? 1) * (D.ghost ? 0.78 + 0.12 * Math.sin(t * 5) : D.holo ? 0.62 : 1)
  const dust = o.dust ?? 0, flash = o.flash ?? 0, tint = D.holo ? 0x5fe1ff : undefined, ta = D.holo ? 0.7 : 0
  const dw = Math.round(W * sk * 2), dh = Math.round(Hh * sk) // destination, in subpixels across
  const xs0 = Math.round(fx * 2 - (face > 0 ? S.ax * sk * 2 : (W - S.ax) * sk * 2)), ys0 = Math.round(fy - S.ay * sk)
  const scan = D.holo ? Math.floor(t * 12) : 0
  const sil = !M && (FLAT === 2 || !!o.sil) // a hand-drawn sprite is never a silhouette
  const ink = !D.holo && !D.ghost && dust === 0 && alpha >= 1 && !o.dim && !sil
  FLATSIL = sil
  FLATC = (!M && (FLAT || o.flat)) || sil ? (o.dim ? lerp(D.c, PAPER, o.dim) : D.c) : 0
  if (sil) FLATC = FLATS = FLATH = o.dark ? lerp(D.c, INK, 0.8) : o.sil ? (o.dim ? lerp(D.c, PAPER, o.dim) : D.c) : lerp(D.c, INK, 0.35)
  else if (FLATC) { FLATS = lerp(FLATC, INK, 0.45); FLATH = lerp(FLATC, 0xffffff, 0.65) }
  for (let pass = ink ? 0 : 1; pass < 2; pass++) for (let j = 0; j < dh; j++) {
    const sy = Math.min(Hh - 1, Math.floor((j + 0.5) / sk))
    for (let i = 0; i < dw; i++) {
      let sx = Math.min(W - 1, Math.floor((i + 0.5) / (2 * sk)))
      if (face < 0) sx = W - 1 - sx
      const si = off + sy * W + sx
      if (!S.a[si]) continue
      let x = xs0 + i, y = ys0 + j
      if (pass === 0) { cv.setSub(x - 2, y, INK); cv.setSub(x + 2, y, INK); cv.setSub(x, y - 1, INK); cv.setSub(x, y + 1, INK); continue }
      let c = S.px[si]!
      if (tint !== undefined && ta) c = lerp(c, tint, ta * (0.55 + 0.45 * (((c >> 8) & 255) / 255)))
      if (D.holo && (j + scan) % 3 === 0) c = lerp(c, 0xffffff, 0.35)
      if (flash) c = lerp(c, 0xffffff, flash)
      if (o.dim) c = lerp(c, PAPER, o.dim)
      if (o.fog) c = lerp(c, o.fogc ?? 0, o.fog)
      c = quant(c)
      let a = alpha
      if (dust > 0) {
        const h = hash(i * 7 + j * 131, F)
        if (h < dust * 1.15) { const p = clamp01((dust * 1.15 - h) * 2.2); x += Math.round(p * (6 + h * 30)); y -= Math.round(p * (2 + hash(i, j) * 8)); a *= 1 - p; c = lerp(c, rgb('#B49A7A'), 0.6) }
      }
      if (a >= 0.92) cv.setSub(x, y, c); else cv.blendSub(x, y, c, a)
    }
  }
  FLATC = 0
  return ys0 + S.top[F]! * sk
}
// The band's hand-drawn portraits as comic heads: each rendered once into one shared
// scratch canvas and cropped to its ink, so the theater's cameos wear the band's faces.
const PIX = new Map<string, HiSprite | null>()
let scratch: Canvas | undefined
function pixHead(key: string): HiSprite | undefined {
  if (PIX.has(key)) return PIX.get(key) ?? undefined
  const art = STAGE_ART[key]
  if (!art) { PIX.set(key, null); return undefined }
  const cv = (scratch ??= new Canvas(18, 14))
  cv.clear(); art(cv, 0, true)
  let x0 = cv.W, x1 = -1, y0 = cv.h, y1 = -1
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.W; x++) if (cv.px[y * cv.W + x]! >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) { PIX.set(key, null); return undefined }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Int32Array(w * h), a = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = cv.px[(y + y0) * cv.W + x + x0]!; if (c >= 0) { px[y * w + x] = c; a[y * w + x] = 255 } else px[y * w + x] = -1 }
  const hs = { w, h, px, a }
  PIX.set(key, hs)
  return hs
}
// The front hand of a pose, in logical coordinates.
export function handOf(id: CharId, fr: number, fx: number, fy: number, figH: number, face: number): [number, number] {
  const D = CHARS[id]
  if (!D || D.size === 0) return [fx, fy - figH / 2]
  const M = mbase(id), k = figH / 32, b = M ?? base(D.f), F = Math.min(fr, b.n - 1)
  return [fx + (b.hand[F * 2]! - b.ax) * k * face, fy - (b.ay - b.hand[F * 2 + 1]!) * k]
}
const widthOf = (id: CharId | '', figH: number) => (id ? bodyW(id, figH) : 0)

// ── the comic font: 5 × 7, drawn slanted with an outline ───────────────────
const FONT: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16], G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17], S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31], 3: [30, 1, 1, 14, 1, 1, 30],
  4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14], 6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14], 9: [14, 17, 17, 15, 1, 2, 12],
  '!': [4, 4, 4, 4, 4, 0, 4], '-': [0, 0, 0, 31, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0, 4], ':': [0, 4, 0, 0, 0, 4, 0], '?': [14, 17, 1, 2, 4, 0, 4],
  ' ': [0, 0, 0, 0, 0, 0, 0], "'": [4, 4, 8, 0, 0, 0, 0], ',': [0, 0, 0, 0, 0, 4, 8], '#': [10, 31, 10, 10, 31, 10, 0], '&': [12, 18, 20, 8, 21, 18, 13], '/': [1, 1, 2, 4, 8, 16, 16],
}
export const wordW = (s: string, sc: number) => s.length * 6 * sc - sc
// Big word: `sc` px per font pixel, centred at cx (logical), top at y; slanted; fill fades c1→c2; outline `ol`, ink shadow.
export function bigWord(cv: Canvas, s: string, cx: number, y: number, sc: number, c1: number, c2: number, ol: number, a = 1, slant = 0.35, wob = 1) {
  const w = wordW(s, sc), x0 = Math.round(cx - w / 2), H = 7 * sc
  for (let pass = 0; pass < 3; pass++) { // shadow, outline, fill
    for (let n = 0; n < s.length; n++) {
      const g = FONT[s[n]!] ?? FONT['?']!, lx = x0 + n * 6 * sc, ly = y + Math.round(Math.sin(n * 1.9) * wob * sc * 0.6)
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) {
        if (!(g[r]! & (16 >> q))) continue
        for (let yy = 0; yy < sc; yy++) for (let xx = 0; xx < sc; xx++) {
          const py = ly + r * sc + yy, px = lx + q * sc + xx + Math.round((H - (r * sc + yy)) * slant * 0.5)
          if (pass === 0) { cv.blend(px + 1, py + 1, INK, a) }
          else if (pass === 1) { for (const [ox, oy] of OUT) cv.blend(px + ox, py + oy, ol, a) }
          else cv.blend(px, py, lerp(c1, c2, (r * sc + yy) / H), a)
        }
      }
    }
  }
}
const OUT = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]] as const

// ── effects ─────────────────────────────────────────────────────────────────
// A jagged starburst behind an impact: `spikes` points, radius r (in heights).
export function starburst(cv: Canvas, cx: number, cy: number, r: number, c: number, edge: number, spikes = 12, rot = 0, a = 1) {
  if (FILM) { cv.radial(cx, cy, r * 1.3, c === WHITE ? 0xfff2c8 : c, 0.9 * a); cv.radial(cx, cy, r * 0.5, 0xffffff, a); void edge; void spikes; void rot; return } // an explosion's light, not a drawn burst
  const PX = 0.83
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let xs = Math.floor((cx - r / PX) * 2); xs <= Math.ceil((cx + r / PX) * 2); xs++) {
    const dx = ((xs + 0.5) / 2 - cx) * PX, dy = y + 0.5 - cy, dd = Math.hypot(dx, dy)
    const ang = Math.atan2(dy, dx) + rot, f = (ang / TAU) * spikes, fr = f - Math.floor(f), lim = r * (0.55 + 0.45 * Math.abs(fr * 2 - 1))
    if (dd < lim - 1) cv.blendSub(xs, y, c, a)
    else if (dd < lim + 0.3) cv.blendSub(xs, y, edge, a)
  }
}
export function spark(cv: Canvas, x: number, y: number, R: number, c: number, u: number) {
  const a = 1 - clamp01(u)
  if (a <= 0) return
  cv.radial(x, y, R * 1.2, c, a)
  for (let i = 0; i < 8; i++) { const ang = i * TAU / 8 + 0.3, r0 = R * 0.3 + u * R, r1 = r0 + R * 0.7; cv.line(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0 * 0.9, x + Math.cos(ang) * r1, y + Math.sin(ang) * r1 * 0.9, i % 2 ? WHITE : c, a) }
}
export function speedLines(cv: Canvas, x0: number, x1: number, y0: number, y1: number, dir: number, t: number, a = 0.8) {
  for (let i = 0; i < 6; i++) {
    const y = y0 + hash(i, 3) * (y1 - y0), len = 4 + hash(i, 5) * 8, x = dir > 0 ? x0 - len - ((t * 40 + i * 7) % 6) : x1 + ((t * 40 + i * 7) % 6)
    cv.line(x, y, x + len, y, WHITE, a * (0.5 + hash(i) * 0.5))
  }
}
function jag(cv: Canvas, x0: number, y0: number, x1: number, y1: number, seed: number, c: number, core: number, thick: number) {
  const n = Math.max(3, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4))
  let px = x0, py = y0
  for (let i = 1; i <= n; i++) {
    const k = i / n, nx = x0 + (x1 - x0) * k + (i < n ? (hash(i, seed) - 0.5) * 4 : 0), ny = y0 + (y1 - y0) * k + (i < n ? (hash(seed, i) - 0.5) * 4 : 0)
    for (let o = -thick; o <= thick; o++) cv.line(px, py + o, nx, ny + o, o ? c : core)
    px = nx; py = ny
  }
}
type FxDef = { c: number; c2: number; kind: 'beam' | 'bolt' | 'orb' | 'spin' | 'line' | 'wave' | 'slash' | 'ring' | 'swarm' | 'ground' | 'wisp' | 'dup' | 'thrown'; sfx: string }
const fd = (c: string, c2: string, kind: FxDef['kind'], sfx: string): FxDef => ({ c: rgb(c), c2: rgb(c2), kind, sfx })
export const FX: Record<FxKind, FxDef> = {
  bolt: fd('#8FB4FF', '#FFFFFF', 'bolt', 'KRAKA-THOOM!'), repulsor: fd('#5FE1FF', '#FFFFFF', 'orb', 'FWOOSH!'), unibeam: fd('#7FEFFF', '#FFFFFF', 'beam', 'VRRRMMM!'),
  shield: fd('#D7262E', '#5C8BFF', 'spin', 'CLANG!'), hammer: fd('#A5AFC2', '#5C3A1E', 'thrown', 'THOOM!'), web: fd('#FFFFFF', '#D0D8E8', 'line', 'THWIP!'),
  arrow: fd('#B48AF0', '#FFFFFF', 'thrown', 'THUNK!'), blast: fd('#FF9A2A', '#FFF2A8', 'orb', 'BLAM!'), hex: fd('#FF3E6C', '#FFB0C8', 'wisp', 'SHRAAAK!'),
  mind: fd('#FFD42A', '#FFFFFF', 'beam', 'ZZZAP!'), claws: fd('#E6E6F5', '#FFFFFF', 'slash', 'SNIKT!'), kinetic: fd('#9A6CFF', '#E0D0FF', 'wave', 'VWOOM!'),
  smash: fd('#7CD650', '#F5E6B0', 'ground', 'SMASH!'), portal: fd('#FFA43A', '#FFE0A0', 'ring', 'SHING!'), illusion: fd('#3FBF5A', '#C8FFD0', 'dup', 'SHIMMER!'),
  missile: fd('#FF8A2A', '#FFFFFF', 'swarm', 'KA-BOOM!'), gun: fd('#FFB020', '#FFFFFF', 'swarm', 'BRRRAP!'), yaka: fd('#FF2A2A', '#FFB0A0', 'thrown', 'FWEEEET!'),
  vines: fd('#5FAF3A', '#9A6A3C', 'ground', 'KRRRAK!'), bite: fd('#5FB8FF', '#FFFFFF', 'bolt', 'ZZZT!'), laser: fd('#FF2A2A', '#FFD0D0', 'beam', 'ZARK!'),
  gauntlet: fd('#A98AE0', '#FFE0FF', 'orb', 'KRAKOOM!'), sleep: fd('#FF9AD8', '#FFFFFF', 'wave', 'SLEEP!'), teleport: fd('#E0233A', '#8C90B4', 'ring', 'BAMF!'),
  katana: fd('#E6E6F5', '#FFFFFF', 'slash', 'SHING!'), wings: fd('#D23B3B', '#FFFFFF', 'slash', 'WHOOSH!'), shrink: fd('#E5383F', '#FFFFFF', 'ring', 'ZWOOP!'),
  photon: fd('#FFC84A', '#FFFFFF', 'beam', 'FWOOOM!'), dagger: fd('#3FBF5A', '#E6E6F5', 'thrown', 'SHUNK!'), spear: fd('#C8D0E0', '#FFFFFF', 'thrown', 'SHUNK!'), sword: fd('#C8D0E0', '#FFFFFF', 'slash', 'SHING!'),
}
const FX_OF: Partial<Record<CharId, FxKind>> = {
  THOR: 'bolt', IRONMAN: 'repulsor', HULKBUSTER: 'smash', CAP: 'shield', SPIDEY: 'web', HAWKEYE: 'arrow', WIDOW: 'bite', WANDA: 'hex', VISION: 'mind', PANTHER: 'kinetic', HULK: 'smash',
  STRANGE: 'portal', LOKI: 'illusion', WARMACHINE: 'missile', ROCKET: 'gun', YONDU: 'yaka', GROOT: 'vines', ULTRON: 'laser', DRONE: 'laser', THANOS: 'gauntlet', MANTIS: 'sleep',
  DEADPOOL: 'katana', WOLVERINE: 'claws', FALCON: 'wings', ANTMAN: 'shrink', GIANTMAN: 'smash', CMARVEL: 'photon', GAMORA: 'katana', DRAX: 'dagger', OKOYE: 'spear', DORA: 'spear',
  VALKYRIE: 'sword', HELA: 'dagger', STARLORD: 'blast', RESCUE: 'repulsor', SHURI: 'blast', KILLMONGER: 'claws', MAW: 'blast', DORMAMMU: 'blast', SYLVIE: 'dagger', NEBULA: 'blast', WONG: 'portal',
}
export const fxOf = (b: PBeat, attacker: CharId | ''): FxKind => (b.fx || (attacker && FX_OF[attacker]) || 'blast') as FxKind
// One projectile (or effect) from (x0, y0) to (x1, y1), p = 0..1 of its flight; big for supers.
export function shot(cv: Canvas, fx: FxKind, x0: number, y0: number, x1: number, y1: number, p: number, t: number, big: boolean, figH: number) {
  const F = FX[fx], th = big ? Math.max(1, Math.round(figH / 14)) : Math.max(0, Math.round(figH / 30))
  const hx = x0 + (x1 - x0) * p, hy = y0 + (y1 - y0) * p
  switch (F.kind) {
    case 'beam': for (let o = -th - 1; o <= th + 1; o++) cv.line(x0, y0 + o, hx, hy + o, Math.abs(o) <= th ? (o === 0 ? F.c2 : F.c) : F.c, Math.abs(o) <= th ? 1 : 0.5); cv.radial(hx, hy, 2 + th * 2, F.c, 0.8); break
    case 'bolt': jag(cv, x0, y0, hx, hy, Math.floor(t * 12), F.c, F.c2, th); if (big) jag(cv, hx + (hash(Math.floor(t * 9)) - 0.5) * 6, hy - figH * 1.4, hx, hy, Math.floor(t * 9) + 7, F.c, F.c2, th); break
    case 'orb': { const r = 1.5 + th * 1.5; for (let i = 1; i < 6; i++) cv.radial(hx - (x1 - x0) * 0.04 * i, hy - (y1 - y0) * 0.04 * i, r * (1 - i / 7), F.c, 0.5 - i * 0.07); cv.radial(hx, hy, r + 1, F.c, 1); cv.radial(hx, hy, r * 0.6, F.c2, 1); break }
    case 'spin': { const q = p < 0.5 ? p * 2 : 2 - p * 2, sx = x0 + (x1 - x0) * Math.min(1, p * 2), r = 1.6 + th; cv.ring(sx, hy, 0, r * 0.45, () => F.c2); cv.ring(sx, hy, r * 0.45, r * 0.75, () => WHITE); cv.ring(sx, hy, r * 0.75, r, () => F.c); void q; break }
    case 'line': cv.line(x0, y0, hx, hy, F.c); cv.line(x0, y0 + 0.5, hx, hy + 0.5, F.c2); if (p >= 0.98) starburst(cv, hx, hy, 2 + th, WHITE, INK, 8); break
    case 'thrown': { const dx = x1 - x0 >= 0 ? 1 : -1; cv.line(hx - dx * 5, hy, hx, hy, F.c2); cv.line(hx - dx * 6, hy - 0.5, hx - dx * 4, hy, F.c); cv.rect(hx, hy - 1, 1, 2 + th, F.c); if (fx === 'yaka') for (let i = 1; i < 10; i++) cv.glow(hx - dx * i, hy + Math.sin(i * 1.4 + t * 20) * 1.5, F.c, 0.7 - i * 0.06); break }
    case 'wave': for (let i = 0; i < 4; i++) { const k = clamp01(p - i * 0.15); if (k <= 0) continue; const cx = x0 + (x1 - x0) * k; cv.ring(cx, hy, 2 + th + i, 2.8 + th + i, () => (i % 2 ? F.c2 : F.c)) } break
    case 'slash': if (p > 0.6) for (let i = 0; i < 3; i++) cv.line(x1 - 3 + i * 1.5, y1 - figH * 0.35, x1 + 1 + i * 1.5, y1 + figH * 0.25, i === 1 ? F.c2 : F.c); break
    case 'ring': { const r = (2 + th * 2) * easeOutBack(Math.min(1, p * 1.4)); cv.ring(x1, y1, Math.max(0, r - 1 - th), r, a => (Math.floor((a + t * 6) * 3) % 2 ? F.c : F.c2)); break }
    case 'swarm': for (let i = 0; i < 4; i++) { const k = clamp01(p * 1.3 - i * 0.1), mx = x0 + (x1 - x0) * k, my = y0 + (y1 - y0) * k + Math.sin(k * 6 + i) * 2 - (1 - k) * k * 6; cv.line(mx - 3, my, mx, my, F.c, 0.8); cv.set(mx, my, F.c2) } break
    case 'ground': { const gy = Math.max(y0, y1) + figH * 0.45; for (let x = Math.min(x0, hx); x <= Math.max(x0, hx); x++) { cv.set(x, gy - (hash(x) > 0.6 ? 1 : 0), F.c); if (hash(x, 2) > 0.8) cv.set(x, gy - 2 - hash(x, 9) * 3, F.c2) } break }
    case 'wisp': for (let i = 0; i < 3; i++) for (let k = 0; k < 1; k += 0.03) { if (k > p) break; const x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k + Math.sin(k * 12 + i * 2 + t * 8) * (2 + th); cv.glow(x, y, i ? F.c : F.c2, 0.9) } break
    case 'dup': for (let i = 0; i < 3; i++) cv.radial(x1 + (i - 1) * 5 * (1 - p), y1, 3 + th, F.c, 0.35); break
  }
}

// ── backdrops: flat colour, Ben-Day dots, one silhouette ────────────────────
type BgDef = { sky: number; dot: number; gnd: number; sil: number; kind: number }
const bd = (sky: string, dot: string, gnd: string, sil: string, kind: number): BgDef => ({ sky: rgb(sky), dot: rgb(dot), gnd: rgb(gnd), sil: rgb(sil), kind })
export const BACK: Record<Bg, BgDef> = {
  city: bd('#3A6FD8', '#6A9AF0', '#4A4A5A', '#24305A', 1), tower: bd('#E08A3A', '#F5B06A', '#3A3A48', '#2A2238', 1), forest: bd('#1E3A5A', '#2E5A7A', '#20301E', '#14281A', 2),
  heli: bd('#5A8AC8', '#8AB4E8', '#5A6070', '#3A4050', 4), lab: bd('#2A6A8A', '#3A8AAA', '#30384A', '#1E5070', 10), street: bd('#C8A050', '#E0C080', '#5A5048', '#6A5A48', 1),
  sokovia: bd('#6A8AB8', '#9AB8E0', '#6A5A48', '#3A3A48', 8), airport: bd('#7AB8E8', '#A8D8F8', '#6A6A70', '#4A5868', 4), bunker: bd('#5A6A80', '#7A8AA0', '#3A4048', '#2A3038', 10),
  arena: bd('#C83A8A', '#F06AB0', '#6A3A2A', '#3A1A48', 5), space: bd('#2A1A4A', '#4A2A7A', '#3A2A5A', '#1A1030', 6), knowhere: bd('#5A2A6A', '#8A4A9A', '#4A3A3A', '#2A1A30', 6),
  ship: bd('#3A4A6A', '#5A6A8A', '#4A3A30', '#2A3048', 4), jungle: bd('#3A8A4A', '#5AAA5A', '#3A2A1A', '#1E4A24', 2), falls: bd('#4A9AC8', '#8AC8F0', '#5A5040', '#3A3A3A', 7),
  titan: bd('#E07A3A', '#F0A060', '#7A4A3A', '#5A2A2A', 8), ruins: bd('#8A6A5A', '#B08A70', '#4A3A30', '#3A2A28', 8), dark: bd('#3A0A4A', '#7A1A8A', '#2A0A2A', '#FF8A2A', 9),
  mirror: bd('#4A6A9A', '#8AA8D8', '#3A4A6A', '#C8D8F0', 9), void: bd('#E8E0C8', '#C8C0A8', '#B8B098', '#A8A088', 0), sanctum: bd('#6A3A2A', '#8A5A3A', '#3A2A20', '#C8A050', 10),
  asgard: bd('#D8A830', '#F0C860', '#5A4A3A', '#8A6A2A', 10), snow: bd('#A8C0D8', '#D0E0F0', '#E8F0F8', '#6A7A90', 3), night: bd('#1A2A4A', '#2A3A6A', '#2A2A3A', '#101828', 1),
  farm: bd('#F0B060', '#F8D090', '#7A8A3A', '#5A6A2A', 3), shield: bd('#5A7AAA', '#7A9ACA', '#4A505C', '#2A3248', 4),
}
// Set dressing for the sky, by place: far, pale and slow (parallax), never busy.
const wrap = (v: number, m: number) => ((v % m) + m) % m
function dress(cv: Canvas, bg: Bg, D: BgDef, x0: number, x1: number, y0: number, gy: number, H: number, pan: number) {
  const Wc = x1 - x0, far = lerp(D.sky, D.sil, 0.28), mid = lerp(D.sky, D.sil, 0.5), tri = (cx: number, base: number, h: number, w: number, c: number) => { for (let j = 0; j < h; j++) { const hw = Math.round((w * (h - j)) / h / 2); for (let x = cx - hw; x <= cx + hw; x++) cv.set(x, base - j, c) } }
  const ridge = (c: number, amp: number, f: number, sp: number) => { for (let x = x0; x < x1; x++) { const wx = x + pan * sp, h = Math.round(H * amp * (0.55 + 0.3 * Math.sin(wx * f) + 0.15 * Math.sin(wx * f * 2.7 + 1))); for (let j = 0; j < h; j++) cv.set(x, gy - 1 - j, c) } }
  switch (bg) {
    case 'airport': {
      const tx = x0 + wrap(Wc * 0.72 - pan * 0.2, Wc + 24) - 12, th = Math.round(H * 0.36)
      cv.rect(tx - 1, gy - th, 3, th, mid); cv.rect(tx - 5, gy - th - 5, 11, 5, far); cv.rect(tx - 5, gy - th - 3, 11, 1, 0xfff2c8); cv.rect(tx - 1, gy - th - 9, 1, 4, mid)
      for (let k = 0; k < 2; k++) { // planes crossing slowly
        const px = x0 + wrap(Wc * (0.2 + k * 0.5) - pan * (0.6 + k * 0.3), Wc + 40) - 20, py = y0 + Math.round(H * (0.14 + k * 0.1))
        cv.rect(px - 6, py, 12, 2, 0xe8eef8); cv.rect(px - 7, py - 3, 2, 3, 0xd8e0f0); cv.rect(px - 2, py + 2, 5, 1, 0xb8c4d8); cv.rect(px + 5, py, 1, 1, 0x4a5868)
      }
      break
    }
    case 'arena': {
      for (let k = 0; k < 7; k++) { const cx = x0 + wrap(k * (Wc / 5.5) + 9 - pan * 0.3, Wc + 30) - 15, h = Math.round(H * (0.22 + hash(k, 4) * 0.2)); tri(cx, gy - 1, h, 5, k & 1 ? far : mid); cv.set(cx, gy - h - 2, 0xffe14d) }
      cv.radial(x0 + Wc * 0.8 - pan * 0.1, y0 + H * 0.2, H * 0.12, 0xff9ad8, 0.55)
      break
    }
    case 'falls': case 'jungle': ridge(far, 0.34, 0.07, 0.25); ridge(mid, 0.24, 0.11, 0.5); break
    case 'snow': case 'farm': ridge(lerp(D.sky, D.sil, 0.2), 0.3, 0.06, 0.25); break
    case 'titan': case 'ruins': case 'sokovia': {
      for (let k = 0; k < 10; k++) { const cx = x0 + wrap(k * (Wc / 8) + 5 - pan * 0.2, Wc + 20) - 10, cy = y0 + Math.round(H * (0.08 + hash(k, 8) * 0.28)), w = 2 + Math.floor(hash(k, 2) * 5), c = lerp(D.sil, D.sky, 0.25)
        cv.rect(cx - w, cy, w * 2, 3, c); cv.rect(cx - w + 1, cy + 3, w * 2 - 2, 2, c); cv.rect(cx - 1, cy + 5, 2, 2, c) }
      if (bg === 'titan') cv.ring(x0 + Wc * 0.72, y0 + H * 0.24, H * 0.14, H * 0.16, () => far)
      break
    }
    case 'city': case 'tower': case 'street': case 'night': case 'shield': { for (let x = x0; x < x1; x++) { const wx = x + Math.floor(pan * 0.5), b = Math.floor(wx / 7), h = Math.round(H * (0.2 + hash(b, 3) * 0.28)); if (wx % 7 === 0) continue; for (let j = 0; j < h; j++) cv.set(x, gy - 1 - j, far) } if (bg === 'tower') { const tx = x0 + Wc * 0.5 - pan * 0.1; cv.rect(tx - 2, gy - Math.round(H * 0.5), 5, Math.round(H * 0.5), mid); cv.rect(tx, gy - Math.round(H * 0.56), 1, Math.round(H * 0.07), mid) } break }
    case 'asgard': case 'sanctum': for (let k = 0; k < 6; k++) { const cx = x0 + wrap(k * (Wc / 4.5) + 7 - pan * 0.25, Wc + 20) - 10; tri(cx, gy - 1, Math.round(H * (0.3 + hash(k, 5) * 0.2)), 4, far); cv.set(cx, gy - Math.round(H * 0.5) - 1, 0xffe14d) } break
    case 'space': case 'knowhere': cv.radial(x0 + Wc * 0.75 - pan * 0.05, y0 + H * 0.26, H * 0.17, lerp(D.sky, D.dot, 0.7), 0.8); cv.ring(x0 + Wc * 0.75 - pan * 0.05, y0 + H * 0.26, H * 0.2, H * 0.215, () => far); break
    default: break
  }
}
function backdrop(cv: Canvas, bg: Bg, x0: number, x1: number, y0: number, y1: number, pan: number, low = false, near = pan) {
  const D = BACK[bg] ?? BACK.city, H = y1 - y0, gy = y0 + Math.round(H * (low ? 0.4 : 0.46)) // a crowd stands on a deep ground plane, rows receding to the horizon
  for (let y = y0; y < y1; y++) {
    const ground = y >= gy, base = ground ? D.gnd : D.sky, dot = ground ? scale(D.gnd, 0.75) : D.dot
    const dots = (y & 1) === 0 && y > y0 + 2 && y < y1 - 3 && y !== gy - 1 // never in a border's cell: a lone dot there splits the row's colour runs
    for (let xs = x0 * 2; xs < x1 * 2; xs++) cv.setSub(xs, y, dots && ((xs + (y & 2 ? 2 : 0)) & 3) === 0 ? dot : base)
  }
  dress(cv, bg, D, x0, x1, y0, gy, H, pan)
  // the silhouette, between sky and ground, drifting with `pan`
  const sil = D.sil, sh = Math.max(3, Math.round(H * (low ? 0.13 : 0.3)))
  for (let x = x0; x < x1; x++) {
    const wx = x + Math.floor(pan)
    let h = 0
    switch (D.kind) {
      case 1: { const b = Math.floor(wx / 5); h = Math.round(sh * (0.35 + hash(b, 7) * 0.65)); if (x % 5 === 0) h = 0; break } // skyline
      case 2: { const b = Math.floor(wx / 6), k = Math.abs((wx % 6) - 3) / 3; h = Math.round(sh * (0.6 + hash(b) * 0.5) * (1 - k * 0.7)); break } // pines
      case 3: h = Math.round(sh * (0.4 + 0.25 * Math.sin(wx * 0.08) + 0.15 * Math.sin(wx * 0.23))); break // hills
      case 4: h = wx % 9 === 0 ? sh : Math.round(sh * 0.25); break // rails / deck
      case 5: h = Math.round(sh * (0.8 + 0.2 * Math.sin(wx * 0.5))); break // stands
      case 7: h = Math.round(sh * (0.8 + 0.5 * hash(Math.floor(wx / 3), 1))); break // cliffs (the falls cut through below)
      case 8: { const b = Math.floor(wx / 4); h = Math.round(sh * hash(b, 3) * 0.9); break } // rubble
      case 10: h = wx % 12 < 2 ? Math.round(H * 0.7) : 0; break // columns / pillars
    }
    for (let j = 0; j < h; j++) cv.set(x, gy - 1 - j, sil)
    // the near layer (parallax: it slides faster than the skyline): stones and posts on the ground line
    const nx = x + Math.floor(near), nh = nx % 17 === 0 ? 3 : nx % 7 === 0 ? 1 : 0
    for (let j = 0; j < nh; j++) cv.set(x, gy + 1 - j, D.kind === 6 || D.kind === 9 ? scale(D.gnd, 0.6) : lerp(D.gnd, INK, 0.5))
  }
  if (D.kind === 6) for (let i = 0; i < (x1 - x0) / 3; i++) { const sx = x0 + hash(i, 11) * (x1 - x0), sy = y0 + hash(i, 12) * (gy - y0); cv.set(sx, sy, hash(i) > 0.5 ? WHITE : D.dot) }
  if (D.kind === 7) { const fx = x0 + (x1 - x0) * 0.5; for (let y = y0; y < gy + 2; y++) for (let x = fx - 4; x < fx + 4; x++) cv.set(x, y, (y + x * 3 + Math.floor(pan * 2)) % 5 ? rgb('#C8E8FF') : WHITE) }
  if (D.kind === 9) for (let i = 0; i < 24; i++) { const ang = i * 0.7, r = (H * 0.15) + i * (x1 - x0) / 60; cv.line(x0 + (x1 - x0) / 2 + Math.cos(ang + pan * 0.05) * r, y0 + H * 0.4 + Math.sin(ang + pan * 0.05) * r * 0.5, x0 + (x1 - x0) / 2 + Math.cos(ang + 0.5 + pan * 0.05) * r, y0 + H * 0.4 + Math.sin(ang + 0.5 + pan * 0.05) * r * 0.5, sil, 0.6) }
}

// ── balloons and captions ───────────────────────────────────────────────────
export function wrapText(s: string, w: number, max: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const word of s.split(/\s+/)) {
    if (!word) continue
    if (!cur) cur = word
    else if (cur.length + 1 + word.length <= w) cur += ' ' + word
    else { out.push(cur); cur = word }
    while (cur.length > w) { out.push(cur.slice(0, w)); cur = cur.slice(w) }
  }
  if (cur) out.push(cur)
  if (out.length > max) { out.length = max; const l = out[max - 1]!; out[max - 1] = (l.length >= w ? l.slice(0, w - 1) : l) + '…' }
  return out
}
// A caption box: yellow, ink text, top-left of a panel. Returns the rows it took.
export function caption(cv: Canvas, s: string, col: number, row: number, maxW: number, bg = YEL, fg = INK): number {
  if (!s || maxW < 6) return 0
  const lines = wrapText(s.toUpperCase(), maxW - 2, 2)
  const w = Math.max(...lines.map(l => l.length)) + 2
  lines.forEach((l, i) => cv.text(col, row + i, (' ' + l).padEnd(w), fg, bg))
  for (let x = col + 1; x <= col + w; x++) cv.set(x, (row + lines.length) * 2, INK) // a drop shadow under it
  return lines.length
}
// A balloon over a speaker: text rows from `row`, tail down to (tx, ty). style 0 speech, 1 shout, 2 thought.
function balloon(cv: Canvas, lines: string[], col: number, row: number, tx: number, ty: number, style: number, rim = INK, shown = 1e9) {
  const w = Math.max(...lines.map(l => l.length)) + 2, rows = lines.length
  const fill = style === 1 ? rgb('#FFF7C8') : WHITE
  const yT = row * 2 - 1, yB = (row + rows) * 2 // pixel rows just outside the text
  // the body: rounded ends in the padding cells, a pixel rim above and below
  for (let x = col; x < col + w; x++) { cv.set(x, yT, fill); cv.set(x, yB, fill); cv.set(x, yT - 1, rim); cv.set(x, yB + 1, rim) }
  for (let y = yT; y <= yB; y++) {
    const edge = y === yT || y === yB
    cv.setSub(col * 2 - 1, y, edge ? rim : fill); cv.setSub(col * 2 - 2, y, edge ? 0 : rim)
    cv.setSub((col + w) * 2, y, edge ? rim : fill); cv.setSub((col + w) * 2 + 1, y, edge ? 0 : rim)
  }
  for (const y of [yT, yB]) { cv.setSub(col * 2 - 1, y, rim); cv.setSub((col + w) * 2, y, rim) }
  if (style === 1) for (let x = col - 1; x <= col + w; x += 2) { cv.set(x, yT - 2, rim); cv.set(x + 1, yB + 2, rim) } // the jags of a shout
  let left = shown
  lines.forEach((l, i) => { cv.text(col, row + i, (' ' + l.slice(0, Math.max(0, left))).padEnd(w), INK, fill); left -= l.length + 1 })
  // the tail: from the balloon's bottom toward the speaker's head
  const bx = Math.max(col + 1, Math.min(col + w - 2, tx)), sy = yB + 1, len = Math.max(0, ty - sy)
  if (style === 2) { for (let i = 0; i < 3; i++) { const k = (i + 1) / 4, x = bx + (tx - bx) * k, y = sy + 1 + len * k; cv.ring(x, y, 0, 1.4 - i * 0.3, () => fill) } return }
  for (let j = 0; j < len; j++) {
    const k = j / Math.max(1, len), x = bx + (tx - bx) * k, half = Math.max(0, (1 - k) * 1.6)
    for (let xs = Math.floor((x - half) * 2); xs <= Math.ceil((x + half) * 2); xs++) cv.setSub(xs, sy + j, fill)
    cv.setSub(Math.floor((x - half) * 2) - 1, sy + j, rim); cv.setSub(Math.ceil((x + half) * 2) + 1, sy + j, rim)
  }
}


// ── film: shots, slow motion, over-the-shoulder, title card, credits ────────
// Which shot a line plays in: 0 two-shot, 1 over-the-shoulder, 2 close-up; a long line cuts once.
// Slow motion around a big hit: 0.9 s of the beat plays at a third of the speed.
function slowmo(b: PBeat, u: number): number {
  const imp = b.k === 'super' || b.k === 'ko' || b.k === 'clash' ? impactOf(b) : -1
  if (imp < 0) return u
  const a = imp - 0.15, L = 0.9
  return u < a ? u : u < a + L ? a + (u - a) * 0.33 : u - L * 0.67
}
// The studio card: hero portraits flip by in red (a few a second, even in brightness),
// the studio slab, then the movie's title on black.
const FLIP = ['ironman', 'cap', 'thor', 'hulk', 'widow', 'spidey', 'panther', 'strange', 'witch', 'loki', 'starlord', 'rocket', 'groot', 'vision', 'hawkeye', 'antman']
function titleCard(cv: Canvas, plan: Plan, r: Rect, u: number, t: number) {
  const W = r.x1 - r.x0, H = r.y1 - r.y0
  for (let y = r.y0; y < r.y1; y++) for (let xs = r.x0 * 2; xs < r.x1 * 2; xs++) cv.setSub(xs, y, 0)
  if (u < 2.2) {
    const hs = pixHead(FLIP[Math.floor(u * 5 + plan.movie.n) % FLIP.length]!)
    for (let y = r.y0 + 2; y < r.y1 - 2; y++) for (let xs = Math.round((r.x0 + W * 0.3) * 2); xs < Math.round((r.x0 + W * 0.7) * 2); xs++) cv.setSub(xs, y, rgb('#7A0E14'))
    if (hs) { const m = (H * 0.8) / hs.h, w = Math.round(hs.w * m), h = Math.round(hs.h * m), x0 = Math.round((r.x0 + W / 2) * 2 - w / 2), y0 = r.y0 + Math.round((H - h) / 2); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const si = Math.min(hs.h - 1, Math.floor(j / m)) * hs.w + Math.min(hs.w - 1, Math.floor(i / m)); if (hs.a[si]! > 40) cv.setSub(x0 + i, y0 + j, lerp(hs.px[si]!, rgb('#C8141E'), 0.55)) } }
  } else if (u < 3.4) {
    const slab = ' AVENGERS THEATER ', y = Math.floor((r.y0 + H / 2) / 2)
    for (let yy = (y - 1) * 2; yy < (y + 2) * 2; yy++) for (let xs = Math.round((r.x0 + W / 2 - slab.length / 2 - 2) * 2); xs < Math.round((r.x0 + W / 2 + slab.length / 2 + 2) * 2); xs++) cv.setSub(xs, yy, rgb('#C8141E'))
    cv.text(Math.round(r.x0 + W / 2 - slab.length / 2), y, slab, 0xffffff, rgb('#C8141E'))
  } else {
    const k = clamp01((u - 3.4) / 0.8), title = plan.movie.title.toUpperCase()
    let sc = Math.max(1, Math.floor((H * 0.3) / 7))
    while (sc > 1 && wordW(title, sc) > W - 6) sc--
    if (wordW(title, sc) <= W - 4) bigWord(cv, title, r.x0 + W / 2, r.y0 + Math.round(H * 0.32), sc, rgb('#F5C542'), rgb('#C8941E'), 0, k, 0, 0)
    else cv.text(Math.round(r.x0 + (W - title.length) / 2), Math.floor((r.y0 + H * 0.4) / 2), title, rgb('#F5C542'), 0)
    const sub = `THE AVENGERS SAGA · #${plan.movie.n}`
    if (k > 0.5) cv.text(Math.round(r.x0 + (W - sub.length) / 2), Math.floor((r.y0 + H * 0.78) / 2), sub, rgb('#C8CCD6'), 0)
  }
  void t
}
// The end credits: everyone in the movie, rolling up on black.
function credits(cv: Canvas, plan: Plan, r: Rect, u: number) {
  for (let y = r.y0; y < r.y1; y++) for (let xs = r.x0 * 2; xs < r.x1 * 2; xs++) cv.setSub(xs, y, 0)
  const names = creditNames(plan), rows = Math.floor((r.y1 - r.y0) / 2), total = names.length + rows
  const d = plan.beats.find(b => b.k === 'credits')?.d ?? 10, off = Math.floor((u / d) * total)
  for (let k = 0; k < rows; k++) {
    const i = k + off - rows
    if (i < 0 || i >= names.length) continue
    const [s, c] = names[i]!
    cv.text(Math.round(r.x0 + (r.x1 - r.x0 - s.length) / 2), Math.ceil(r.y0 / 2) + k, s, c, 0)
  }
}
const CREDITS = new WeakMap<Plan, [string, number][]>()
function creditNames(p: Plan): [string, number][] {
  let n = CREDITS.get(p)
  if (n) return n
  const cast = new Set<string>()
  for (const b of p.beats) for (const c of [b.l, b.r, ...b.who, ...b.rw]) if (c && c !== 'TEAM') cast.add(nameOf(c))
  n = [[`THE AVENGERS SAGA #${p.movie.n}`, rgb('#F5C542')], [p.movie.title.toUpperCase(), rgb('#F5C542')], ['', 0], ['STARRING', rgb('#A4A8C8')], ...[...cast].map((s): [string, number] => [s, 0xffffff]), ['', 0], ['AND J.A.R.V.I.S. AS THE PROJECTIONIST', rgb('#5FE1FF')], ['', 0], ['STAY FOR ONE MORE SCENE', rgb('#A4A8C8')]]
  CREDITS.set(p, n)
  return n
}

// ── ambient life, close-ups, impact frames ──────────────────────────────────
// Weather and motes for a live panel: a dozen particles, positions a pure function of t.
const AMB: Partial<Record<Bg, number>> = { snow: 1, night: 2, forest: 2, ruins: 3, titan: 3, dark: 3, sokovia: 3, sanctum: 3, space: 4, knowhere: 4, jungle: 5, arena: 6, street: 6, farm: 6, airport: 6, falls: 6, city: 6, tower: 6 }
function ambient(cv: Canvas, bg: Bg, r: Rect, t: number) {
  const k = AMB[bg]
  if (!k) return
  const W = r.x1 - r.x0, H = r.y1 - r.y0
  for (let i = 0; i < 12; i++) {
    const h1 = hash(i, 31), h2 = hash(i, 57)
    switch (k) {
      case 1: { const y = r.y0 + ((h2 * H + t * (4 + h1 * 3)) % H), x = r.x0 + ((h1 * W + Math.sin(t * 1.3 + i) * 2) % W); cv.set(x, y, WHITE); break } // snow
      case 2: { const y = r.y0 + ((h2 * H + t * 30) % H), x = r.x0 + ((h1 * W - t * 6) % W + W) % W; cv.line(x, y, x - 0.5, y + 2, rgb('#9AB8E0'), 0.7); break } // rain
      case 3: { const y = r.y1 - ((h2 * H + t * (5 + h1 * 4)) % H), x = r.x0 + ((h1 * W + Math.sin(t * 2 + i) * 1.5) % W); cv.set(x, y, h1 > 0.5 ? rgb('#FFB020') : rgb('#FF6A2A')); break } // embers
      case 4: { if (Math.sin(t * 3 + i * 1.7) > 0.4) cv.set(r.x0 + h1 * W, r.y0 + h2 * H * 0.6, WHITE); break } // stars twinkle
      case 5: { const y = r.y0 + ((h2 * H + t * 5) % H), x = r.x0 + ((h1 * W + Math.sin(t * 2.4 + i) * 3) % W); cv.set(x, y, rgb('#7CD650')); break } // leaves
      case 6: { if (i > 6) break; const y = r.y1 - 3 - ((h2 * H * 0.5 + t * 2) % (H * 0.5)), x = r.x0 + ((h1 * W + t * 3) % W); cv.set(x, y, rgb('#E8D8B0')); break } // dust motes
    }
  }
}
// The one-frame white of an impact (photosafe: one per hit, faded, never a strobe).
function flashAt(b: PBeat, u: number): boolean {
  const imp = b.k === 'special' ? 1.1 : impactOf(b)
  if (imp >= 0 && u > imp && u < imp + 0.07) return true
  if (b.k === 'trade') { const e = Math.min(b.n - 1, Math.floor(u / 1.4)), ue = u - e * 1.4; return !!b.hit[e] && ue > 0.42 && ue < 0.48 }
  return false
}
// ── a panel ─────────────────────────────────────────────────────────────────
export type Rect = { x0: number; x1: number; y0: number; y1: number } // columns, logical pixel rows
type Ctx = { cv: Canvas; r: Rect; b: PBeat; u: number; t: number; figH: number; floor: number; lx: number; rx: number; live: boolean; shake: number; typed: number; runIn?: number }
const idle = (t: number, ph = 0) => (Math.floor(t * 2.2 + ph) & 1 ? P.idle1 : P.idle0)
const walk = (t: number) => (Math.floor(t * 8) & 1 ? P.walk1 : P.walk0)
const sideOf = (b: PBeat): 'l' | 'r' => (b.by === 'r' || (b.by !== 'l' && b.by !== '' && b.by === b.r) ? 'r' : 'l')
// What the panel should fire: the moment (s into the beat) of its big hit, for a screen burst.
export function impactOf(b: PBeat): number { return b.k === 'super' ? 2.2 : b.k === 'clash' ? 0.7 : b.k === 'ko' ? 0.65 : b.k === 'charge' ? 3.8 : b.k === 'snap' ? 1.6 : -1 }
// The frozen frame of a panel once the story has moved on.
export function keyTime(b: PBeat): number {
  switch (b.k) {
    case 'special': return 1.65; case 'super': return 2.4; case 'clash': return 0.85; case 'ko': return 2.4; case 'trade': return 0.5
    case 'snap': return 3.4; case 'charge': return 3.0; case 'enter': return 2.0; case 'arrive': return b.d - 0.5; case 'crowd': return b.d * 0.5
    default: return Math.min(b.d - 0.2, 2.5)
  }
}

// An outer clip (subpixels) every panel also keeps to: the page turn.
let OC0 = 0, OC1 = 1e9
export function outerClip(a = 0, b = 1e9) { OC0 = a; OC1 = b }
export function drawPanel(cv: Canvas, plan: Plan, b: PBeat, r: Rect, u: number, t: number, live: boolean, reveal = 1) {
  const H = r.y1 - r.y0, Wc = r.x1 - r.x0
  if (H < 6 || Wc < 8) return
  resetFigs()
  // a little shake on the big hits (live panels only), never a strobe
  const imp = impactOf(b), sp = b.k === 'special' ? 1.1 : imp
  const shake = live && sp >= 0 && u > sp && u < sp + 0.35 ? Math.round(Math.sin((u - sp) * 70) * 1.2 * (1 - (u - sp) / 0.35)) : 0
  cv.clip(Math.max(OC0, r.x0 * 2), Math.min(OC1, (r.x0 + (r.x1 - r.x0) * clamp01(reveal)) * 2))
  if (b.k === 'cover') { if (FILM && b.scene === -1 && plan.beats.length) titleCard(cv, plan, r, u, t); else { cover(cv, plan, r, u, t); frame(cv, r) } cv.unclip(); return }
  if (b.k === 'card') { card(cv, b, r, u, t); if (!FILM) frame(cv, r); cv.unclip(); return }
  if (b.k === 'credits') { credits(cv, plan, r, u); cv.unclip(); return }
  if (b.k === 'sting' && u < 1.2) { for (let y = r.y0; y < r.y1; y++) for (let xs = r.x0 * 2; xs < r.x1 * 2; xs++) cv.setSub(xs, y, 0); cv.unclip(); return }
  // the camera: the background drifts (two layers, parallax), a slow push-in on a line,
  // a pull-out on an establishing shot, a punch-in on a hit, a low angle for arrivals
  const pan = (b.start + u) * 1.6
  // a fight moves across a world wider than the frame: the camera tracks it, the world scrolls
  // past, and the first exchange of a fight opens on both fighters running in
  let track = 0, runIn = 0
  if (FILM && FIGHTS.has(b.k)) {
    const bi = beatAt(plan, b.start), prev = plan.beats[bi - 1]
    track = (hash(b.start, 11) > 0.5 ? 1 : -1) * u * 8
    if (live && (!prev || !FIGHTS.has(prev.k))) runIn = u < 0.9 ? 1 - easeOut(u / 0.9) : 0
  }
  if (b.k === 'battle') track = battleCam(b, u, Wc)
  backdrop(cv, b.bg, r.x0, r.x1, r.y0, r.y1, pan * 0.5 + shake + track * 0.5 + runIn * 12, b.k === 'crowd' || b.k === 'charge', pan * 1.4 + shake + track * 1.4 + runIn * 40)
  if (live) ambient(cv, b.bg, r, t)
  const floor = r.y1 - 2 - Math.round(H * 0.06)
  const typed = b.k === 'say' ? (live ? clamp01(((u - 0.12) * 42) / Math.max(1, b.text.length)) : 1) : 1
  // One scale per shot, set by the pane and never changed by the camera: sheet pixels at 2x in a tall pane, 1x in a middling
  // one, half in a tiny one; the tallest sheet in the shot must fit, and the line-up must hold everyone it should (else the
  // whole shot steps down one size). Armies and fights behind the talkers are drawn at exactly half of it.
  let S = H >= 76 ? 2 : H >= 40 ? 1 : 0.5
  const far = b.k === 'crowd' || b.k === 'charge'
  if (!far) {
    let tall = 0
    const note = (id: string) => { if (id && !(b.k === 'battle' && id === 'GIANTMAN')) tall = Math.max(tall, sheetBox(id as CharId)[1]) }
    note(b.l); note(b.r); for (const id of b.ext) note(id); for (const id of b.who) note(id); for (const id of b.rw) note(id)
    while (S > 0.5 && tall * S > H - 2) S /= 2
  }
  const staged = STAGE.has(b.k)
  if (staged) { const want = Math.min(wanted(b, Wc), 4); while (S > 0.5 && lineup(b, 32 * S, r.x0, r.x1) < want) S /= 2; lineup(b, 32 * S, r.x0, r.x1) }
  const figH = 32 * S
  const uu = slowmo(b, u) // the big hit in slow motion
  const lx0 = r.x0 + Wc * 0.3, rx0 = r.x0 + Wc * 0.7
  const c: Ctx = { cv, r, b, u: uu, t, figH, floor, lx: (staged && LX === LX ? LX : lx0) + shake, rx: (staged && RX === RX ? RX : rx0) + shake, live, shake, typed, runIn }
  const heads = act(c)
  if (FILM && live && u < 0.2 && (b.k === 'trade' || b.k === 'special' || b.k === 'clash' || b.k === 'ko' || b.k === 'super')) for (let y = r.y0; y < r.y1; y += 1) { const k = hash(y, Math.floor(t * 30)); if (k > 0.55) cv.line(r.x0 + k * (r.x1 - r.x0) * 0.5, y, r.x0 + k * (r.x1 - r.x0) * 0.5 + (r.x1 - r.x0) * 0.4, y, 0xffffff, 0.25 * (1 - u / 0.2)) } // the whip-pan's blur
  if (live && flashAt(b, u)) for (let y = r.y0; y < r.y1; y++) for (let xs = r.x0 * 2; xs < r.x1 * 2; xs++) cv.glowSub(xs, y, 0xffffff, 0.22) // the impact frame (once a hit, faded)
  if (!FILM) frame(cv, r)
  if (FILM) { if (b.cap && u < 3.2) cv.text(r.x0 + 2, Math.floor(r.y1 / 2) - 2, ` ${b.cap.toUpperCase()} `, 0xffffff, 0); void heads; cv.unclip(); return }
  // text: the caption box, then the balloon (it pops in and the words type on)
  const row0 = Math.ceil(r.y0 / 2) + 1, capRows = caption(cv, b.cap, r.x0 + 2, row0, Math.min(36, Wc - 4))
  if (b.k === 'est' && b.text) caption(cv, b.text, r.x0 + 2, Math.floor((r.y1 - 1) / 2) - 2, Math.min(40, Wc - 4), WHITE)
  if (b.text && ((b.k === 'say' && (!live || u > 0.1)) || ((b.k === 'special' || b.k === 'super' || b.k === 'ko' || b.k === 'stand' || b.k === 'arrive' || b.k === 'crowd' || b.k === 'charge' || b.k === 'snap' || b.k === 'enter' || b.k === 'exit' || b.k === 'clash') && u > textAt(b)))) {
    talk(c, heads, row0 + capRows + (capRows ? 1 : 0), b.k === 'say' && live ? Math.floor((u - 0.12) * 42) : live ? Math.floor((u - textAt(b)) * 42) : 1e9)
  }
  // the big sound effect
  sfx(c)
  cv.unclip()
}
const textAt = (b: PBeat) => (b.k === 'super' ? 3 : b.k === 'ko' ? 1.8 : b.k === 'special' ? 1.7 : b.k === 'snap' ? 4.2 : b.k === 'charge' ? 4.2 : b.k === 'clash' ? 1.6 : b.k === 'enter' ? 1.4 : 0)
function frame(cv: Canvas, r: Rect) {
  const th = r.y1 - r.y0 >= 36 ? 2 : 1
  for (let x = r.x0; x < r.x1; x++) for (let i = 0; i < th; i++) { cv.set(x, r.y0 + i, INK); cv.set(x, r.y1 - 1 - i, INK) }
  for (let y = r.y0; y < r.y1; y++) for (let i = 0; i < th; i++) { cv.setSub(r.x0 * 2 + i, y, INK); cv.setSub(r.x1 * 2 - 1 - i, y, INK) }
}

// Where the speaker's head is, by side: [x, headTop] (NaN when off panel).
type Heads = { l: [number, number]; r: [number, number]; extra?: Map<string, [number, number]> }
const HEADS: Heads = { l: [NaN, NaN], r: [NaN, NaN] }
function act(c: Ctx): Heads {
  const { cv, b, u, t, figH, floor } = c
  HEADS.l[0] = HEADS.l[1] = HEADS.r[0] = HEADS.r[1] = NaN; HEADS.extra = undefined
  const put = (side: 'l' | 'r', id: CharId | '', fr: number, x: number, y = floor, o: DrawOpt = NO) => {
    if (!id) return
    addFig(figH)
    const top = drawChar(cv, id, fr, x, y, figH, side === 'l' ? 1 : -1, t, o)
    HEADS[side][0] = x; HEADS[side][1] = top
  }
  const L = b.l, R = b.r
  const gap = widthOf(L, figH) * 0.5 + widthOf(R, figH) * 0.5 + 2
  if ((c.runIn ?? 0) > 0.03 && L && R) { // the run-up: both charge in from the frame's edges, the camera racing with them
    const k = c.runIn!, W = c.r.x1 - c.r.x0
    put('l', L, walk(t * 1.4), c.lx - k * W * 0.45); put('r', R, walk(t * 1.4 + 0.3), c.rx + k * W * 0.45)
    speedLines(cv, c.r.x0, c.r.x1, floor - figH, floor, 1, t, 0.8)
    return HEADS
  }
  if (b.ext.length || b.extOut.length) {
    const spk = b.k === 'say' ? (b.by === 'l' || (b.by !== '' && b.by === b.l) ? 'l' : b.by === 'r' || (b.by !== '' && b.by === b.r) ? 'r' : '') : ''
    bystanders(cv, b, c.r, u, t, figH, floor, spk, b.k === 'say' && c.typed < 1, BACK[b.bg]?.sky ?? 0)
  }
  switch (b.k) {
    case 'battle': battle(cv, b, c.r, u, t, figH, floor, BACK[b.bg]?.sky ?? 0); break
    case 'teamup': teamup(cv, b, c.r, u, t, figH, floor, BACK[b.bg]?.sky ?? 0); break
    case 'est': case 'say': case 'stand': case 'sting': {
      if (!L && !R && b.k === 'say' && b.by && b.by !== 'l' && b.by !== 'r') { put('l', b.by as CharId, idle(t * 1.8), (c.r.x0 + c.r.x1) / 2); break }
      // they act: the speaker talks (a flap and a bob, leaning in), then gestures; the other reacts
      const sp = b.k === 'say' && !(b.by && b.ext.includes(b.by as CharId)) ? sideOf(b) : '', talking = c.typed < 1, done = b.k === 'say' && !talking
      const after = done ? (u - (0.12 + b.text.length / 42)) : -1
      const shout = b.text.includes('!'), ask = b.text.includes('?'), laugh = /\bha\b|haha|joke|funny/i.test(b.text)
      const walkIn = b.k === 'est' && c.live ? 1 - easeOut(clamp01(u / 1.0)) : 0
      for (const side of ['l', 'r'] as const) {
        const id = side === 'l' ? L : R, home = side === 'l' ? c.lx : c.rx, dir = side === 'l' ? 1 : -1
        if (!id) continue
        let fr: number = idle(t, side === 'l' ? 0 : 1), x = home - dir * walkIn * 6, y = floor
        if (walkIn > 0.02) fr = walk(t)
        if (b.k === 'stand') fr = P.block
        else if (side === sp) {
          if (talking) { fr = Math.floor(t * 7) & 1 ? P.idle1 : P.idle0; y -= Math.floor(t * 7) & 1; x += dir * 0.8 }
          else if (after >= 0 && after < 0.6) fr = shout ? P.punch : ask ? P.block : idle(t)
        } else if (sp && after >= 0 && after < 0.5) {
          if (shout) { fr = P.hurt; x -= dir * 1 } else if (laugh) { fr = P.jump; y -= 2 } else if (ask) fr = P.block; else y -= after < 0.15 ? 1 : 0
        }
        put(side, id, fr, x, y)
      }
      if (b.k === 'stand' && L && R) for (let i = 0; i < 3; i++) jag(cv, (c.lx + c.rx) / 2, floor - figH * (0.9 - i * 0.25), (c.lx + c.rx) / 2 + 2, floor - figH * (0.75 - i * 0.25), Math.floor(t * 6) + i, YEL, WHITE, 0)
      break
    }
    case 'enter': {
      const k = easeOut(clamp01(u / 1.2))
      if (L) { const x = c.r.x0 - 6 + (c.lx - c.r.x0 + 6) * k; put('l', L, u < 1.2 ? walk(t) : idle(t), x); if (u < 1.2) speedLines(cv, x - 14, x - 2, floor - figH, floor, 1, t) }
      if (R) { const x = c.r.x1 + 6 - (c.r.x1 + 6 - c.rx) * k, y = floor - Math.sin(Math.PI * clamp01(u / 1.2)) * figH * 0.5; put('r', R, u < 1.2 ? P.jump : idle(t, 1), x, y); if (u > 1.2 && u < 1.6) spark(cv, x, floor, 3, rgb('#C8B8A0'), (u - 1.2) / 0.4) }
      break
    }
    case 'exit': {
      const k = easeIn(clamp01(u / 1.6)), dx = k * (c.r.x1 - c.r.x0 + 20)
      put('l', L, walk(t), c.lx + dx); put('r', R, walk(t), c.rx + dx)
      if (u > 0.2) speedLines(cv, c.lx + dx - 16, c.lx + dx - 3, floor - figH, floor, 1, t)
      break
    }
    case 'trade': {
      const e = Math.min(b.n - 1, Math.floor(u / 1.4)), ue0 = u - e * 1.4, a = b.att[e] ?? 'l', hit = b.hit[e] ?? true, mv = b.move[e] ?? P.punch
      const ue = hit && ue0 > 0.42 && ue0 < 0.52 ? 0.42 : hit && ue0 >= 0.52 ? ue0 - 0.1 : ue0 // hit-stop: the blow lands and the frame holds
      const dodge = !hit && dodged(b, e)
      const A = a === 'l' ? L : R, D = a === 'l' ? R : L, home = a === 'l' ? c.lx : c.rx, dhome = a === 'l' ? c.rx : c.lx, dir = a === 'l' ? 1 : -1
      const reach = dhome - dir * gap
      let ax = home, af: number = idle(t), ay = floor
      if (ue < 0.35) { ax = home + (reach - home) * easeOut(ue / 0.35); af = walk(t) }
      else if (ue < 0.7) { ax = reach; af = mv; if (mv === P.jump) ay = floor - Math.sin(Math.PI * (ue - 0.35) / 0.35) * figH * 0.3 }
      else if (ue < 1.05) { ax = reach + (home - reach) * easeOut((ue - 0.7) / 0.35); af = walk(t) }
      let dx = dhome, df: number = idle(t, 1)
      let dy = floor
      if (ue > 0.3 && ue < 0.95) { if (hit) { if (ue > 0.42) { df = P.hurt; dx = dhome + dir * Math.min(2.5, (ue - 0.42) * 9) } } else if (dodge) { const k = clamp01((ue - 0.3) / 0.5); df = P.jump; dx = dhome + dir * Math.sin(Math.PI * Math.min(1, k * 1.4)) * 4; dy = floor - Math.sin(Math.PI * k) * figH * 0.35 } else if (ue > 0.38) df = P.block }
      put(a === 'l' ? 'r' : 'l', D, df, dx, dy, { flash: hit && ue0 > 0.42 && ue0 < 0.52 ? 0.8 : 0 })
      if (hit && ue > 0.45 && ue < 0.8) for (let k2 = 0; k2 < 3; k2++) cv.set(dhome + dir * (1 + k2 + (ue - 0.45) * 8), floor - k2 * 0.6, rgb('#C8B08A')) // skid dust
      put(a, A, af, ax, ay)
      if (ue < 0.35) speedLines(cv, ax - dir * 14, ax - dir * 2, floor - figH, floor, dir, t, 0.6)
      if (!dodge && ue0 > 0.42 && ue0 < 0.8) {
        const sx = dhome - dir * widthOf(D, figH) * 0.4, sy = floor - figH * 0.62
        starburst(cv, sx, sy, figH * 0.28 * (1 - (ue0 - 0.42)), hit ? YEL : rgb('#BFD4FF'), RED, 10, ue0 * 3)
        spark(cv, sx, sy, figH * 0.2, hit ? rgb('#FFB020') : rgb('#BFD4FF'), (ue0 - 0.42) / 0.38)
      }
      break
    }
    case 'special': case 'super': {
      const sup = b.k === 'super', by = sideOf(b), A = by === 'l' ? L : R, T = by === 'l' ? R : L
      const fx = fxOf(b, A), w0 = sup ? 1.4 : 0.5, hitT = sup ? 2.2 : 1.1, dir = by === 'l' ? 1 : -1
      const ax = by === 'l' ? c.lx : c.rx, tx0 = by === 'l' ? c.rx : c.lx
      const uk = u < hitT + 0.1 ? Math.min(u, hitT) : u - 0.1, knock = uk > hitT ? dir * Math.min(sup ? 6 : 4, (uk - hitT) * 14) : 0, tx = tx0 + knock
      const aPose = u < hitT + 0.4 ? (sup ? P.super : P.special) : idle(t)
      if (sup && u < hitT) { const g = clamp01(u / w0); cv.radial(ax, floor - figH * 0.5, figH * (0.4 + g * 0.5), CHARS[A || 'CAP']?.c ?? YEL, 0.35 + 0.4 * g); for (let i = 0; i < 6; i++) { const ang = i * TAU / 6 + t * 3; cv.line(ax + Math.cos(ang) * figH * 0.3, floor - figH * 0.5 + Math.sin(ang) * figH * 0.3, ax + Math.cos(ang) * figH * 0.55, floor - figH * 0.5 + Math.sin(ang) * figH * 0.5, WHITE, g * 0.7) } }
      put(by === 'l' ? 'r' : 'l', T, u > hitT && u < hitT + 1.1 ? P.hurt : idle(t, 1), tx, floor, { flash: u > hitT && u < hitT + 0.12 ? 0.8 : 0 })
      put(by, A, aPose, ax)
      if (A && u > w0 * 0.6 && u < hitT + 0.25) {
        const [hx, hy] = handOf(A, aPose, ax, floor, figH, dir)
        const p = clamp01((u - w0) / (hitT - w0))
        shot(cv, fx, hx, hy, tx0 - dir * widthOf(T, figH) * 0.3, floor - figH * 0.6, p, t, sup, figH)
      }
      if (u > hitT && u < hitT + 0.8) { const k = (u - hitT) / 0.8; starburst(cv, tx0, floor - figH * 0.6, figH * (sup ? 0.6 : 0.38) * (0.6 + 0.4 * easeOut(k * 3)), YEL, RED, 14, t); spark(cv, tx0, floor - figH * 0.6, figH * 0.4, FX[fx].c, k) }
      break
    }
    case 'clash': {
      const mid = (c.lx + c.rx) / 2, k = easeIn(clamp01(u / 0.6))
      const back = u > 0.7 ? Math.min(6, (u - 0.7) * 16) : 0
      const lxx = c.lx + (mid - gap / 2 - c.lx) * k - back, rxx = c.rx - (c.rx - mid - gap / 2) * k + back
      const pose = u < 0.6 ? walk(t) : u < 1.3 ? (u < 0.8 ? P.punch : P.hurt) : P.block
      if (u > 0.6 && u < 1.6) { const q = (u - 0.6) / 1.0; cv.ring(mid, floor - figH * 0.55, figH * q * 1.6, figH * q * 1.6 + 1.5, () => WHITE) }
      put('l', L, pose, lxx); put('r', R, pose, rxx)
      if (u > 0.62 && u < 1.5) starburst(cv, mid, floor - figH * 0.6, figH * 0.7 * (1.1 - (u - 0.62) * 0.5), WHITE, RED, 16, t * 2)
      if (u < 0.6) { speedLines(cv, lxx - 14, lxx - 2, floor - figH, floor, 1, t); speedLines(cv, rxx + 2, rxx + 14, floor - figH, floor, -1, t) }
      break
    }
    case 'ko': {
      const w = b.win, W = w === 'l' ? L : R, Lo = w === 'l' ? R : L, dir = w === 'l' ? 1 : -1
      const wh = w === 'l' ? c.lx : c.rx, lh = w === 'l' ? c.rx : c.lx, reach = lh - dir * gap
      const wx = u < 0.5 ? wh + (reach - wh) * easeOut(u / 0.5) : reach
      const wf = u < 0.5 ? walk(t) : u < 1.6 ? P.punch : P.super
      let lx = lh, ly = floor, lf: number = idle(t, 1)
      if (u > 0.65) { const k = clamp01((u - 0.65) / 0.65); lx = lh + dir * k * 8; ly = floor - Math.sin(Math.PI * k) * figH * 0.22; lf = k < 1 ? P.hurt : P.ko }
      put(w === 'l' ? 'r' : 'l', Lo, lf, lx, ly, { flash: u > 0.65 && u < 0.75 ? 0.8 : 0 })
      put(w, W, wf, wx)
      if (u > 0.65 && u < 1.3) starburst(cv, lh, floor - figH * 0.6, figH * 0.6, YEL, RED, 12, t)
      if (u > 1.5 && Lo) for (let i = 0; i < 3; i++) { const ang = t * 4 + i * TAU / 3; cv.set(lx + Math.cos(ang) * 3, floor - figH * 0.35 + Math.sin(ang) * 1.2, YEL) } // dizzy stars
      break
    }
    case 'arrive': {
      const cap = capFor(c.r.x1 - c.r.x0), all = b.earlier.concat(b.who), n = Math.min(all.length, cap), from = all.length - n, ne = Math.max(0, b.earlier.length - from), px = c.r.x0 + (c.r.x1 - c.r.x0) * 0.8
      const open = easeOutBack(clamp01(u / 0.6)), F = FX[b.fx || 'portal'] ?? FX.portal
      const rr = figH * 0.62 * open
      if (b.fx !== 'wings' && rr > 1) { cv.ring(px, floor - figH * 0.5, rr * 0.82, rr, a => (Math.floor((a + t * 7) * 4) & 1 ? F.c : F.c2)); for (let i = 0; i < 10; i++) { const ang = hash(i, Math.floor(t * 10)) * TAU; cv.set(px + Math.cos(ang) * (rr + 1 + hash(i) * 2), floor - figH * 0.5 + Math.sin(ang) * (rr + 1), F.c2) } }
      // everyone in a row spaced by real width, ending at the portal; the new ones step out of it one after another
      let x = px - 4
      for (let i = n - 1; i >= 0; i--) {
        const id = all[from + i]!, w = bodyW(id, figH) * 0.88
        x -= w / 2
        const slot = x, isNew = i >= ne, j = i - ne
        x -= w / 2
        let xx = slot, y = floor, fr: number = idle(t, i)
        if (isNew) {
          const t0 = 0.5 + j * 0.45, k = clamp01((u - t0) / 0.8)
          if (k <= 0) continue
          xx = px + (slot - px) * easeOut(k); fr = k < 1 ? walk(t) : idle(t, i)
          if (b.fx === 'wings') { y = floor - (1 - easeOut(k)) * figH * 0.6; xx = slot }
        }
        fig(cv, id, fr, xx, y, figH, -1, t, 0)
        if (i === n - 1) { HEADS.r[0] = xx; HEADS.r[1] = y - figH }
      }
      break
    }
    case 'crowd': case 'charge': crowd(c); break
    case 'snap': {
      const by = sideOf(b), named = b.by && b.by !== 'l' && b.by !== 'r' ? (b.by as CharId) : ''
      const A = named || (by === 'l' ? L : R), T = by === 'l' ? R : L
      const ax = by === 'l' ? c.lx : c.rx
      const dust = clamp01((u - 2) / 2.8)
      if (b.who.length) { let sx = by === 'l' ? c.r.x0 + (c.r.x1 - c.r.x0) * 0.42 : c.r.x0 + 3; const cap = capFor(c.r.x1 - c.r.x0) - 1; for (let i = 0; i < Math.min(b.who.length, cap); i++) { const id = b.who[i]!, w = bodyW(id, figH) * 0.9; sx += w / 2; fig(cv, id, idle(t, i), sx, floor - (i % 2) * 2, figH, by === 'l' ? -1 : 1, t, 0, 0, 0, clamp01(dust * 1.3 - (i % 4) * 0.1)); sx += w / 2 } }
      else put(by === 'l' ? 'r' : 'l', T, idle(t, 1), by === 'l' ? c.rx : c.lx, floor, { dust })
      put(by, A, u < 2 ? P.super : idle(t), ax)
      if (A && u < 2.2) { const [hx, hy] = handOf(A, P.super, ax, floor, figH, by === 'l' ? 1 : -1); const g = clamp01(u / 1.5); STONES.forEach((sc, i) => { const ang = i * TAU / 6 + t * 2; cv.radial(hx + Math.cos(ang) * 2.2, hy + Math.sin(ang) * 2, 1.2, sc, g) }) }
      if (u > 1.5 && u < 2.3) { const a = 0.45 * (1 - Math.abs(u - 1.75) / 0.55); for (let y = c.r.y0; y < c.r.y1; y++) for (let xs = c.r.x0 * 2; xs < c.r.x1 * 2; xs++) cv.glowSub(xs, y, 0xffffff, Math.max(0, a)) } // one soft flash, faded
      break
    }
  }
  return HEADS
}
const BACKRANK: DrawOpt = { dim: 0.1, flat: true }
const STONES = [rgb('#FF3B3B'), rgb('#FFA43A'), rgb('#FFE14D'), rgb('#3FBF5A'), rgb('#5C8BFF'), rgb('#B48AF0')]
// A crowd: `who` in up to three ranks across the panel, everyone at once (front rank big
// and in full colour on a name-tag bar, back ranks smaller and flat), `rw` facing them.
export const crowdSeen = new Uint8Array(64) // which of a crowd have been on screen (tests OR it over a shot)
export let crowdDrawn = 0 // how many of the crowd landed inside the panel (tests)
const RK_K = [1, 0.8, 0.7, 0.62] // each rank back is smaller, and stands higher up the frame
export let crowdTop = 0 // the crowd's highest head (the charge's title sits above it)
function crowd(c: Ctx) {
  const { cv, b, u, t, figH, floor, r } = c
  const Wc = r.x1 - r.x0, H = r.y1 - r.y0, L = b.who.length, R = b.rw.length, N = L + R
  const charge = b.k === 'charge', D = BACK[b.bg] ?? BACK.city
  const farH = figH >= 32 ? figH / 2 : figH, horizon = r.y0 + Math.round(H * 0.4), near = farH // an army stands at half the shot's scale, every figure the same size
  // a world wider than the frame: the camera pans along the ranks (a charge: it tracks them)
  const worldW = Math.max(Wc, L * near * 0.34 + 8), cam = (worldW - Wc) * easeInOut(clamp01(u / Math.max(1, b.d)))
  const run = charge ? easeIn(clamp01(u / 3.6)) : 0
  const portals = !charge && L >= 20
  if (portals) for (let k = 0; k < 4; k++) { const px = r.x0 + Wc * (0.15 + k * 0.24) - cam * 0.25, py = horizon - near * 0.25, rr = near * 0.35 * easeOutBack(clamp01((u - k * 0.4) / 0.8)); if (rr > 1) cv.ring(px, py, rr * 0.82, rr, a => (Math.floor((a + t * 6) * 4) & 1 ? rgb('#FFA43A') : rgb('#FFE0A0'))) }
  crowdDrawn = 0; crowdTop = floor
  HEADS.l[0] = (r.x0 + r.x1) / 2; HEADS.l[1] = floor - figH
  const sp = b.by && b.by !== 'l' && b.by !== 'r' ? b.who.indexOf(b.by as CharId) : -1
  // depth order: far first (an insertion sort into a fixed buffer; no allocation)
  const n = Math.min(N, ORD.length)
  for (let i = 0; i < n; i++) { DEP[i] = depthOf(i, L, b.start); ORD[i] = i }
  for (let i = 1; i < n; i++) { const k = ORD[i]!; let j = i - 1; while (j >= 0 && DEP[ORD[j]!]! < DEP[k]!) { ORD[j + 1] = ORD[j]!; j-- } ORD[j + 1] = k }
  for (let q = 0; q < n; q++) {
    const i = ORD[q]!, right = i >= L, id = right ? b.rw[i - L]! : b.who[i]!
    let d = DEP[i]!
    if (charge) d = right ? Math.max(0.55, d - run * 0.3) : d - run * 0.75 // they run at the camera
    if (d < -0.15) continue // past the lens
    const fh = farH
    const y = Math.round(floor - (floor - horizon) * Math.max(0, d) * 0.92)
    const wx = right ? worldW - 4 - (i - L) * near * 0.3 : 4 + hash(i, 5) * 3 + (i * (worldW - 8 - (R ? near * 1.4 : 0))) / Math.max(1, L)
    const par = 1 - Math.max(0, d) * 0.6 // far moves less as the camera pans (parallax)
    let x = r.x0 + wx - cam * par
    if (charge && !right) x = r.x0 + Wc / 2 + (x - r.x0 - Wc / 2) * (1 + run * 0.6) // spreading as they near
    // stepping out of a portal: the back half arrive first, one after another
    if (portals && i >= L / 2) { const t0 = ((i - L / 2) / (L / 2)) * b.d * 0.4, k = clamp01((u - t0) / 0.8); if (k <= 0) continue }
    if (x < r.x0 - 12 || x > r.x1 + 12) continue
    const fogK = Math.max(0, d) * 0.25 // a little haze on the far ranks
    const fr = charge && !right ? walk(t * 1.3 + i * 0.13) : charge ? walk(t + i * 0.2) : idle(t * (0.8 + hash(i) * 0.6), i) // each breathes on its own beat
    const top = y - fh
    fig(cv, id, fr, x, y + (charge ? Math.abs(Math.sin(t * 9 + i)) * -1 : 0), fh, right ? -1 : 1, t, fogK, D.sky)
    if (charge && !right && d < 0.4) for (let k2 = 0; k2 < 2; k2++) cv.ring(x - fh * 0.3 - k2 * fh * 0.2, y - 1, 0, fh * (0.1 + k2 * 0.05), () => DUST) // the dust they kick up
    if (x > r.x0 && x < r.x1) { crowdDrawn++; crowdSeen[i] = 1 }
    if (top < crowdTop) crowdTop = top
    if (i === sp) { HEADS.l[0] = x; HEADS.l[1] = top }
  }
  if (charge) for (let k = 0; k < 2; k++) speedLines(cv, r.x0 + k * Wc * 0.4, r.x0 + k * Wc * 0.4 + Wc * 0.3, floor - H * 0.45, floor, 1, t + k, 1)
}
// Where each member of a crowd stands: depth 0 (by the lens) to 1 (the horizon), staggered.
function depthOf(i: number, L: number, seed: number): number { return i >= L ? 0.35 + hash(i, 9) * 0.25 : Math.min(1, (i % 4) * 0.24 + hash(i, seed) * 0.2) }
const FIGHTS = new Set(['trade', 'special', 'super', 'clash', 'ko'])
const STAGE = new Set(['est', 'enter', 'say', 'stand', 'exit', 'trade', 'special', 'super', 'clash', 'ko', 'sting'])
const ORD = new Int16Array(64), DEP = new Float32Array(64)
const FOG: DrawOpt = { fog: 0, fogc: 0, alpha: 1 }
const MIDRANK: DrawOpt = { sil: true }
const DUST = rgb('#C8B08A')
let CROWD_FRONT: DrawOpt = NO
export function crowdFront(o: DrawOpt) { CROWD_FRONT = o }
// The balloon for the beat's line, over whoever says it.
function talk(c: Ctx, h: Heads, minRow: number, shown = 1e9) {
  const { cv, b, r } = c
  const Wc = r.x1 - r.x0, by = b.by || 'l'
  let hx = NaN, hy = NaN, radio = ''
  if (by === 'l' || by === 'r') [hx, hy] = h[by]
  else if (b.l === by) [hx, hy] = h.l
  else if (b.r === by) [hx, hy] = h.r
  else if (b.k === 'say' && !b.l && !b.r) [hx, hy] = h.l
  else if (b.k === 'crowd' || b.k === 'charge' || b.k === 'arrive') [hx, hy] = b.k === 'arrive' ? h.r : h.l
  else radio = nameOf(by)
  const maxW = Math.max(10, Math.min(Wc - 6, Math.round(Wc * 0.62), 44))
  const lines = wrapText(radio ? `${radio}: ${b.text}` : b.text, maxW - 2, 3)
  const w = Math.max(...lines.map(l => l.length)) + 2
  const top = Math.ceil(r.y0 / 2) + 1
  if (radio || !Number.isFinite(hx)) { // a voice off panel: top right, the tail to the edge
    const col = r.x1 - w - 3
    balloon(cv, lines, col, Math.max(top, minRow), r.x1 - 2, (Math.max(top, minRow) + lines.length) * 2 + 3, b.style, INK, shown + (radio ? radio.length + 2 : 0))
    return
  }
  // above the head if it fits, else beside it, toward the panel's middle
  const headRow = Math.floor((hy - 3) / 2)
  let row = Math.max(minRow, headRow - lines.length)
  if (row + lines.length > Math.floor((r.y1 - 2) / 2)) row = Math.max(top, Math.floor((r.y1 - 2) / 2) - lines.length)
  const mid = (r.x0 + r.x1) / 2, toward = hx < mid ? 1 : -1
  let col = Math.round(hx - w / 2 + toward * Math.min(w * 0.3, 6))
  col = Math.max(r.x0 + 2, Math.min(r.x1 - w - 2, col))
  balloon(cv, lines, col, row, hx, Math.max((row + lines.length) * 2 + 1, hy - 1), b.style, INK, shown)
}
function sfx(c: Ctx) {
  const { cv, b, u, figH, r } = c
  let at = -1, word = b.sfx, big = 1, x = (c.lx + c.rx) / 2
  switch (b.k) {
    case 'special': at = 1.1; word ||= FX[fxOf(b, sideOf(b) === 'r' ? b.r : b.l)].sfx; x = sideOf(b) === 'r' ? c.lx : c.rx; break
    case 'super': at = 2.2; word ||= FX[fxOf(b, sideOf(b) === 'r' ? b.r : b.l)].sfx; big = 1.4; break
    case 'clash': at = 0.62; word ||= 'CLANG!'; big = 1.3; break
    case 'ko': at = 0.65; word ||= 'K.O.!'; big = 1.3; x = b.win === 'l' ? c.rx : c.lx; break
    case 'snap': at = 1.55; word ||= 'SNAP.'; break
    case 'charge': at = 1.2; word ||= 'AVENGERS!'; big = 1.1; break
    case 'trade': { const e = Math.min(b.n - 1, Math.floor(u / 1.4)), ue = u - e * 1.4; if (ue > 0.42 && ue < 0.95) { const w = b.hit[e] ? HITS[(b.start * 7 + e) % HITS.length | 0]! : dodged(b, e) ? 'MISS!' : 'BLOCK!'; smallWord(c, w, b.att[e] === 'l' ? c.rx : c.lx, ue - 0.42) } return }
    case 'arrive': at = 0.3; word ||= FX[b.fx || 'portal']?.sfx ?? 'SHING!'; x = r.x0 + (r.x1 - r.x0) * 0.8; break
    case 'enter': if (b.sfx) { at = 1.2; x = c.rx } break
    default: if (b.sfx) at = 0.3
  }
  const hold = b.k === 'charge' ? b.d : 1.6
  if (at < 0 || !word || u < at || u > at + hold) return
  const k = u - at, Wc = r.x1 - r.x0, H = r.y1 - r.y0
  let sc = Math.max(1, Math.floor((H * 0.2 * big) / 7))
  while (sc > 1 && wordW(word, sc) > Wc - 6) sc--
  if (wordW(word, sc) > Wc - 4) { cv.text(Math.round(x - word.length / 2), Math.floor((r.y0 + H * 0.3) / 2), word, YEL, RED); return }
  const pop = k < 0.12 ? 0.6 + k * 3.3 : 1, cx = Math.max(r.x0 + wordW(word, sc) / 2 + 2, Math.min(r.x1 - wordW(word, sc) / 2 - 3, x)), y = (b.k === 'charge' ? Math.max(r.y0 + 3, crowdTop - 7 * sc - 4) : r.y0 + Math.round(H * 0.12)) + Math.round((1 - pop) * 3)
  const a = k > hold - 0.4 ? 1 - (k - hold + 0.4) / 0.4 : 1
  bigWord(cv, word, cx, y, sc, YEL, b.k === 'charge' ? YEL : rgb('#FF7A1A'), RED, a, 0.35, 1)
  void figH
}
export const dodged = (b: PBeat, e: number) => hash(b.start * 3.7, e) > 0.45
const HITS = ['POW!', 'WHAM!', 'BIFF!', 'KRAK!', 'THWACK!', 'SMACK!', 'BAM!', 'ZOK!']
function smallWord(c: Ctx, w: string, x: number, k: number) {
  const { cv, r } = c, H = r.y1 - r.y0
  const sc = Math.max(1, Math.floor(H * 0.12 / 7))
  if (wordW(w, sc) > r.x1 - r.x0 - 6) return
  bigWord(cv, w, Math.max(r.x0 + wordW(w, sc) / 2 + 2, Math.min(r.x1 - wordW(w, sc) / 2 - 3, x)), r.y0 + Math.round(H * 0.08), sc, WHITE, YEL, RED, k > 0.4 ? 1 - (k - 0.4) / 0.13 : 1, 0.3, 0.5)
}

// ── cover and card ──────────────────────────────────────────────────────────
export const coverColor = (m: { color: string }) => rgb(m.color)
// Each issue's cover: who (the lead first), and a backdrop of its own.
const COVERS: Record<string, { cast: CharId[]; bg?: 'split' | 'portals' | 'stones'; pose?: number; big?: number }> = {
  assemble: { cast: ['IRONMAN', 'CAP', 'THOR', 'HULK', 'WIDOW', 'HAWKEYE'] },
  ultron: { cast: ['ULTRON', 'DRONE', 'DRONE', 'DRONE'], big: 1.08 },
  civilwar: { cast: ['CAP', 'IRONMAN'], bg: 'split' },
  ragnarok: { cast: ['THOR', 'HULK', 'VALKYRIE', 'LOKI'], pose: P.special },
  awesomemix: { cast: ['STARLORD', 'ROCKET', 'GROOT', 'GAMORA', 'DRAX'] },
  wakanda: { cast: ['PANTHER', 'OKOYE', 'SHURI', 'DORA'], pose: P.special },
  infinitywar: { cast: ['THANOS', 'MAW'], bg: 'stones', big: 1.06 },
  endgame: { cast: ['IRONMAN', 'CAP', 'THOR', 'CMARVEL', 'SPIDEY'], bg: 'portals' },
  multiverse: { cast: ['STRANGE', 'WANDA', 'LOKI'], bg: 'portals', pose: P.special },
  whatif: { cast: ['DEADPOOL', 'WOLVERINE', 'HOWARD'], pose: P.jump },
}
// The list draws covers as art only (its own solid plates carry the words).
let COVER_ART_ONLY = false
export function coverArtOnly(on: boolean) { COVER_ART_ONLY = on }
function cover(cv: Canvas, plan: Plan, r: Rect, u: number, t: number) {
  const m = plan.movie, col = rgb(m.color), H = r.y1 - r.y0, Wc = r.x1 - r.x0
  for (let y = r.y0; y < r.y1; y++) for (let xs = r.x0 * 2; xs < r.x1 * 2; xs++) {
    const dx = (xs / 2 - (r.x0 + Wc * 0.62)) * 0.83, dy = y - (r.y0 + H * 0.55), ang = Math.atan2(dy, dx)
    const ray = Math.floor((ang / TAU) * 24 + 24) & 1
    // (in the list, a flat two-band field: cheap runs, so the figures keep their detail)
    cv.setSub(xs, y, COVER_ART_ONLY ? (y < r.y0 + H * 0.62 ? col : lerp(col, INK, 0.3)) : ((xs + (y & 2 ? 2 : 0)) & 3) === 0 && (y & 1) === 0 ? lerp(col, WHITE, 0.35) : ray ? col : lerp(col, INK, 0.25))
  }
  const C = COVERS[m.id], floor = r.y1 - 3, figH = Math.round(Math.min(H * 0.56, Wc * 0.95)), split = C?.bg === 'split'
  if (C?.bg === 'split') for (let y = r.y0; y < r.y1; y++) for (let xs = Math.round((r.x0 + Wc * 0.52 + (y - r.y0) * 0.35) * 2); xs < r.x1 * 2; xs++) cv.setSub(xs, y, ((xs + (y & 2 ? 2 : 0)) & 3) === 0 && (y & 1) === 0 ? rgb('#F06060') : rgb('#C8282E'))
  if (C?.bg === 'portals') for (let i = 0; i < 5; i++) { const px = r.x0 + Wc * (0.2 + i * 0.16), py = r.y0 + H * (0.34 + (i % 2) * 0.1), rr = Math.min(H * 0.09, Wc * 0.12) * (1 + (i % 3) * 0.2); cv.ring(px, py, rr * 0.8, rr, a2 => (Math.floor((a2 + t * 5) * 4) & 1 ? rgb('#FFA43A') : rgb('#FFE0A0'))) }
  const cast = COVER_ART_ONLY ? (C?.bg === 'split' ? (C.cast.slice(0, 2) as CharId[]) : [C?.cast[0] ?? m.hero]) : C?.cast ?? [m.hero]
  // the supporting cast behind, smaller and spread across; the lead in front, mid-leap (split: face to face)
  const n = cast.length
  for (let i = n - 1; i >= 1; i--) {
    const x = split ? r.x0 + Wc * 0.74 : r.x0 + Wc * (0.12 + ((i - 1) / Math.max(1, n - 2)) * 0.78)
    drawChar(cv, cast[i]!, split ? P.super : idle(0, i), x, split ? floor : floor - H * 0.1, figH * (split ? 0.92 : 0.62), split ? -1 : i % 2 ? 1 : -1, t, split ? NO : MIDRANK)
  }
  const leadX = r.x0 + Wc * (split ? 0.28 : 0.55)
  drawChar(cv, cast[0]!, C?.pose ?? P.super, leadX, floor, figH * (split ? 0.92 : C?.big ?? 1), split ? 1 : -1, t)
  if (C?.bg === 'stones') { const [hx, hy] = handOf(cast[0]!, C?.pose ?? P.super, leadX, floor, figH * (C?.big ?? 1), -1); STONES.forEach((sc, i) => { const ang = i * TAU / 6 + t; cv.radial(hx + Math.cos(ang) * 2.5, hy + Math.sin(ang) * 2.2, 1.6, sc, 1) }) }
  // the masthead: THE AVENGERS SAGA, the issue number in a box, the title big
  const row0 = Math.ceil(r.y0 / 2) + 1
  const mast = 'THE AVENGERS SAGA'
  let sc = Math.max(1, Math.floor(H * 0.16 / 7))
  while (sc > 1 && wordW(mast, sc) > Wc - 12) sc--
  if (wordW(mast, sc) <= Wc - 8) bigWord(cv, mast, r.x0 + Wc / 2, r.y0 + 3, sc, WHITE, rgb('#FFD0D0'), RED, 1, 0.2, 0)
  else cv.text(r.x0 + 2, row0, mast, WHITE, RED)
  const issue = ` #${m.n} `
  cv.text(r.x0 + 2, row0 + Math.ceil((7 * sc + 4) / 2), issue, INK, YEL)
  const title = m.title.toUpperCase()
  let ts = Math.max(1, Math.floor(H * 0.2 / 7))
  while (ts > 1 && wordW(title, ts) > Wc * 0.62) ts--
  const ty = r.y0 + Math.round(H * 0.42)
  const pop = easeOutBack(clamp01(u / 0.5))
  if (wordW(title, ts) <= Wc - 6) bigWord(cv, title, r.x0 + Math.max(wordW(title, ts) / 2 + 3, Wc * 0.34), ty + Math.round((1 - pop) * 4), ts, YEL, rgb('#FF7A1A'), RED, clamp01(u * 4), 0.35, 0.6)
  else cv.text(r.x0 + 2, Math.floor(ty / 2), title, INK, YEL)
  if (!COVER_ART_ONLY) caption(cv, m.blurb, r.x0 + 2, Math.floor((r.y1 - 2) / 2) - 1, Math.min(48, Math.round(Wc * 0.5)), WHITE)
}
function card(cv: Canvas, b: PBeat, r: Rect, u: number, t: number) {
  const H = r.y1 - r.y0, Wc = r.x1 - r.x0
  for (let y = r.y0; y < r.y1; y++) for (let xs = r.x0 * 2; xs < r.x1 * 2; xs++) {
    const dx = (xs / 2 - (r.x0 + Wc / 2)) * 0.83, dy = y - (r.y0 + H / 2), ang = Math.atan2(dy, dx), ray = Math.floor((ang / TAU) * 20 + 20 + t * 0.4) & 1
    cv.setSub(xs, y, ray ? rgb('#1A1A2E') : rgb('#24243C'))
  }
  const words = (b.text || 'THE END').toUpperCase()
  const lines = words.length > 16 && Wc < wordW(words, 1) + 6 ? wrapText(words, Math.max(6, Math.floor((Wc - 6) / 6)), 3) : [words]
  let sc = Math.max(1, Math.floor(H * 0.22 / 7))
  while (sc > 1 && Math.max(...lines.map(l => wordW(l, sc))) > Wc - 6) sc--
  const a = clamp01(u * 2)
  if (Math.max(...lines.map(l => wordW(l, sc))) <= Wc - 4) lines.forEach((l, i) => bigWord(cv, l, r.x0 + Wc / 2, r.y0 + Math.round(H * 0.5) - Math.round(lines.length * 4.5 * sc) + i * 9 * sc, sc, YEL, rgb('#FF7A1A'), RED, a, 0.3, 0))
  else lines.forEach((l, i) => cv.text(r.x0 + Math.round((Wc - l.length) / 2), Math.floor((r.y0 + H / 2) / 2) + i, l, YEL))
  if (b.cap) { const w = Math.min(40, Wc - 4), ln = wrapText(b.cap.toUpperCase(), w - 2, 1)[0]!; caption(cv, ln, r.x0 + Math.round((Wc - ln.length - 2) / 2), Math.floor((r.y1 - 3) / 2), w) }
}
