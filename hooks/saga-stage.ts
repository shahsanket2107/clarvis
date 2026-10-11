// clarvis AVENGERS THEATER: the ensemble. Staging for more than two characters:
// a line-up that spaces everyone by real drawn width, bystanders who react (turn to the
// speaker, shift weight, flinch, cheer, walk in and off), team-vs-team battles shown a few
// duels at a time and cut between, and the combined team-up moves.
//
// One scale per shot. A shot's characters are all drawn at the same integer multiple of
// their sheet's own pixels (1 or 2; 0.5 when the pane is tiny), the far plane (armies,
// fights behind the talkers) at exactly half of it, nearest-neighbour. Nothing here, and
// no camera move, ever enlarges a sprite.
//
// Budget: figures are blitted from cached sprites (one per character, pose, scale and
// facing; fog is applied as they are blitted). Nothing here allocates per frame.
import { Canvas, CLEAR, clamp01, easeInOut, easeOut, hash, lerp } from './pixel'
import { CHAR_IDS, type CharId, type FxKind } from './saga-types'
import type { PBeat } from './saga-plan'
import { CHARS, FX, P, drawChar, bodyW, sheetBox, fxOf, handOf, shot, speedLines, starburst, spark, renderMode, type DrawOpt, type Rect } from './saga'

// ── cached figure sprites ───────────────────────────────────────────────────
const SC = new Canvas(170, 150) // the scratch a sprite is drawn into once
const OX = 170, OY = 146 // the feet, in scratch subpixels / rows
let SPR_INTS = 0 // pixels held by cached sprites (bounded)
type Spr = { w: number; h: number; ox: number; oy: number; px: Int32Array }
const SPR = new Map<number, Spr>()
const LADDER = [8, 16, 32, 64] // the only figure heights there are: 0.25, 0.5, 1 or 2 sheet pixels per pixel, times 32
const IDX = new Map<string, number>()
CHAR_IDS.forEach((c, i) => IDX.set(c, i))
const NO: DrawOpt = {}
const OPT: DrawOpt = {}
let FIGS = 0
const SEEN: number[] = [] // the distinct figure heights drawn this frame (tests: one scale per shot)
export const resetFigs = () => { FIGS = 0; SEEN.length = 0 }
export const addFig = (h = 32, n = 1) => { FIGS += n; if (SEEN.indexOf(h) < 0) SEEN.push(h) }
export const figsDrawn = () => FIGS // characters drawn this frame (tests)
export const figScales = (): readonly number[] => SEEN
export const spriteCount = () => SPR.size
const rung = (h: number) => { let b = 0, bd = 1e9; for (let i = 0; i < LADDER.length; i++) { const d = Math.abs(LADDER[i]! - h); if (d < bd) { bd = d; b = i } } return b }
function capture(id: CharId, fr: number, ri: number, face: number): Spr {
  SC.clear()
  drawChar(SC, id, fr, OX / 2, OY, LADDER[ri]!, face, 0, NO)
  let x0 = SC.W, x1 = -1, y0 = SC.h, y1 = -1
  for (let y = 0; y < SC.h; y++) for (let x = 0; x < SC.W; x++) if (SC.px[y * SC.W + x]! !== CLEAR) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return { w: 0, h: 0, ox: 0, oy: 0, px: new Int32Array(0) }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Int32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = SC.px[(y + y0) * SC.W + x + x0]!
  return { w, h, ox: OX - x0, oy: OY - y0, px }
}
// One character at height `h` (32 x the shot's scale): the cached sprite where it can be, else drawn directly (flash, dust, holograms).
export function fig(cv: Canvas, id: CharId, fr: number, fx: number, fy: number, h: number, face: number, t: number, fog = 0, fogc = 0, flash = 0, dust = 0) {
  addFig(h)
  const D = CHARS[id]
  if (!D || D.size === 0) return
  const ri = rung(h), hh = LADDER[ri]!
  const [sw, sh, sax] = sheetBox(id), kk = hh / 32
  if (flash || dust || D.holo || D.ghost || sax * 2 * kk > OX - 2 || (sw - sax) * 2 * kk > SC.W - OX - 2 || sh * kk > OY - 2) {
    OPT.fog = fog; OPT.fogc = fogc; OPT.flash = flash; OPT.dust = dust
    drawChar(cv, id, fr, fx, fy, hh, face, t, fog || flash || dust ? OPT : NO)
    return
  }
  const f = fr > 10 ? 10 : fr
  const key = ((((IDX.get(id) ?? 0) * 11 + f) * 4 + ri) * 2 + (face > 0 ? 1 : 0)) * 24 + renderMode()
  let s = SPR.get(key)
  if (!s) {
    if (SPR.size >= 3000 || SPR_INTS > 6e6) { OPT.fog = fog; OPT.fogc = fogc; OPT.flash = 0; OPT.dust = 0; drawChar(cv, id, fr, fx, fy, hh, face, t, fog ? OPT : NO); return }
    s = capture(id, f, ri, face); SPR.set(key, s); SPR_INTS += s.px.length
  }
  const xs = Math.round(fx * 2) - s.ox, y0 = Math.round(fy) - s.oy, W = cv.W, H = cv.h, px = cv.px, cl = cv.cl, cr = cv.cr
  for (let j = 0; j < s.h; j++) {
    const yy = y0 + j
    if (yy < 0 || yy >= H) continue
    for (let i = 0; i < s.w; i++) {
      const c = s.px[j * s.w + i]!
      if (c === CLEAR) continue
      const x = xs + i
      if (x < cl || x >= cr || x < 0 || x >= W) continue
      px[yy * W + x] = fog > 0.01 ? lerp(c, fogc, fog) : c
    }
  }
}

const idle = (t: number, ph = 0) => (Math.floor(t * 2.2 + ph) & 1 ? P.idle1 : P.idle0)
const walk = (t: number) => (Math.floor(t * 8) & 1 ? P.walk1 : P.walk0)
// How many characters a shot may hold: 6 in a small pane, 8 in a big one.
export const capFor = (Wc: number) => (Wc >= 150 ? 8 : 6)

// ── the line-up ─────────────────────────────────────────────────────────────
// Everyone of a staged shot in one row, spaced by their real drawn widths (neighbours overlap by at most
// 12%), the speakers l and r in the middle and the bystanders outward on either side, the row centred.
// Fills ROWID/ROWX/ROWK (K: 0 bystander, 1 l, 2 r) and LX/RX, and returns how many fit: it drops the
// outermost bystanders until the row fits the width.
const NONE: readonly CharId[] = []
const PRID: CharId[] = [], PRK = new Uint8Array(12), PRE = new Uint8Array(12)
export const ROWID: CharId[] = []
export const ROWX = new Float32Array(12), ROWK = new Uint8Array(12)
export let LX = NaN, RX = NaN
const TMPW = new Float32Array(12)
export function lineup(b: PBeat, h: number, x0: number, x1: number): number {
  const ext = b.brawl ? NONE : b.ext, avail = x1 - x0 - 2, cap = capFor(x1 - x0)
  let m = 0
  if (b.l) { PRID[m] = b.l; PRK[m] = 1; m++ }
  if (b.r) { PRID[m] = b.r; PRK[m] = 2; m++ }
  for (let i = 0; i < ext.length && m < 12; i++) { PRID[m] = ext[i]!; PRK[m] = 0; PRE[m] = i; m++ }
  let k = Math.min(m, cap)
  for (; k >= 1; k--) {
    // the row: right-to-left bystanders (even ext index) on the left, l, r, odd ones on the right
    let n = 0
    for (let pass = 0; pass < 4; pass++) {
      if (pass === 0) { for (let q = k - 1; q >= 0; q--) if (PRK[q] === 0 && !(PRE[q]! & 1)) { ROWID[n] = PRID[q]!; ROWK[n] = 0; n++ } }
      else if (pass === 1) { for (let q = 0; q < k; q++) if (PRK[q] === 1) { ROWID[n] = PRID[q]!; ROWK[n] = 1; n++ } }
      else if (pass === 2) { for (let q = 0; q < k; q++) if (PRK[q] === 2) { ROWID[n] = PRID[q]!; ROWK[n] = 2; n++ } }
      else { for (let q = 0; q < k; q++) if (PRK[q] === 0 && (PRE[q]! & 1)) { ROWID[n] = PRID[q]!; ROWK[n] = 0; n++ } }
    }
    let total = 0
    for (let i = 0; i < n; i++) { TMPW[i] = bodyW(ROWID[i]!, h); total += i ? ((TMPW[i - 1]! + TMPW[i]!) / 2) * 0.88 : TMPW[i]! / 2 }
    total += TMPW[n - 1]! / 2
    if (total <= avail || k === 1) {
      const slack = Math.max(0, avail - total), extra = n > 1 ? Math.min(slack / (n - 1), 6) : 0
      let x = x0 + 1 + (slack - extra * (n - 1)) / 2
      LX = RX = NaN
      for (let i = 0; i < n; i++) {
        x += i ? ((TMPW[i - 1]! + TMPW[i]!) / 2) * 0.88 + extra : TMPW[i]! / 2
        ROWX[i] = x
        if (ROWK[i] === 1) LX = x; else if (ROWK[i] === 2) RX = x
      }
      ROWN = n
      return n
    }
  }
  ROWN = 0
  return 0
}
export let ROWN = 0
// How many of the shot's characters the line-up would hold at `h` (the planner shrinks the shot's scale until all fit).
export function wanted(b: PBeat, Wc: number): number { return Math.min((b.l ? 1 : 0) + (b.r ? 1 : 0) + (b.brawl ? 0 : b.ext.length), capFor(Wc)) }

// ── bystanders ──────────────────────────────────────────────────────────────
// 0 nothing, 1 a flinch (the blow lands, a shout), 2 a cheer
function react(b: PBeat, u: number): number {
  switch (b.k) {
    case 'say': return b.style === 1 && u > 0.15 && u < 0.7 ? 1 : 0
    case 'trade': { const e = Math.min(b.n - 1, Math.floor(u / 1.4)), ue = u - e * 1.4; return b.hit[e] && ue > 0.45 && ue < 1.0 ? 1 : 0 }
    case 'special': return u > 1.1 && u < 1.8 ? 1 : 0
    case 'super': return u > 2.2 && u < 3.2 ? 1 : 0
    case 'clash': return u > 0.7 && u < 1.4 ? 1 : 0
    case 'ko': return u > 0.65 && u < 1.4 ? 1 : u > 1.6 && u < 3.0 ? 2 : 0
    default: return 0
  }
}
// Draws the line-up's bystanders (call lineup() first), and, when the beat has a brawl, the fights behind the talkers at half scale.
export function bystanders(cv: Canvas, b: PBeat, r: Rect, u: number, t: number, figH: number, floor: number, spk: 'l' | 'r' | '', talking: boolean, sky: number) {
  const Wc = r.x1 - r.x0, rc = react(b, u)
  const spId = b.k === 'say' && b.by && b.by !== 'l' && b.by !== 'r' ? b.by : ''
  let focus = (LX + RX) / 2
  if (spk === 'l') focus = LX; else if (spk === 'r') focus = RX
  else if (spId) for (let i = 0; i < ROWN; i++) if (ROWID[i] === spId && ROWK[i] === 0) focus = ROWX[i]!
  if (!(focus === focus)) focus = r.x0 + Wc / 2
  for (let j = 0; j < b.extOut.length && !b.brawl && ROWN + j < capFor(Wc); j++) { // those who leave walk off the nearest edge (while the shot has room)
    const k = easeOut(clamp01(u / 1.7)), x0 = r.x0 + Wc * (0.2 + 0.6 * hash(j, 2)), right = x0 > r.x0 + Wc / 2
    if (k < 1) fig(cv, b.extOut[j]!, walk(t + j * 0.3), x0 + (right ? r.x1 + 8 - x0 : r.x0 - 8 - x0) * k, floor, figH, right ? 1 : -1, t, 0.04, sky)
  }
  for (let i = 0; i < ROWN; i++) {
    if (ROWK[i] !== 0) continue
    const id = ROWID[i]!
    let x = ROWX[i]!, y = floor - ((i & 1) * 3), fr: number = idle(t * (0.7 + 0.5 * hash(i, 3)), i * 0.37)
    let face = x < focus - 1 ? 1 : x > focus + 1 ? -1 : (i & 1 ? 1 : -1)
    if (Math.floor(t * 0.6 + hash(i, 1) * 9) % 9 === 0) y -= 1 // a shift of weight
    if (id === spId && talking) { fr = Math.floor(t * 7) & 1 ? P.idle1 : P.idle0; y -= Math.floor(t * 7) & 1 }
    else if (rc === 1 && hash(i, 4) > 0.35) fr = hash(i, 5) > 0.5 ? P.block : P.hurt
    else if (rc === 2 && hash(i, 6) > 0.4) { fr = P.jump; y -= 2 }
    const inn = b.extIn.indexOf(id)
    if (inn >= 0) { const k = easeOut(clamp01((u - inn * 0.25) / 1.7)); if (k < 1) { const from = x < r.x0 + Wc / 2 ? r.x0 - 8 : r.x1 + 8; x = from + (x - from) * k; fr = walk(t + i * 0.2); face = from < x ? 1 : -1 } }
    fig(cv, id, fr, x, y, figH, face, t, 0.04, sky)
  }
  // the fights behind: pairs at half scale on either flank, fog to their name
  if (b.brawl && figH >= 32) {
    const pairs = Math.min(Math.floor(b.ext.length / 2), Wc >= 150 ? 3 : 2), h = figH / 2
    for (let q = pairs - 1; q >= 0; q--) {
      const A = b.ext[q * 2]!, B = b.ext[q * 2 + 1]!, sx = r.x0 + Wc * PAIR_X[q]!
      duel(cv, b, A, B, sx, floor - 5, h, 0.1, sky, u + b.start * 0.37 + q * 1.3, t, q + 3)
    }
  }
}
const PAIR_X = [0.12, 0.88, 0.5]

// ── battles ─────────────────────────────────────────────────────────────────
const TA: CharId[] = [], TB: CharId[] = []
function teams(b: PBeat): number {
  TA.length = 0; TB.length = 0
  let giant = 0
  for (const id of b.who) { if (id === 'GIANTMAN') giant = 1; else TA.push(id) }
  for (const id of b.rw) { if (id === 'GIANTMAN') giant = 1; else TB.push(id) }
  return giant
}
const duelsOf = () => Math.min(TA.length, TB.length, 6)
// The backdrop drifts a little as a battle runs (the camera moves; the figures never change size).
export function battleCam(_b: PBeat, u: number, _Wc: number): number { return u * 1.5 }
// One duel, a pure function of time: the attacker steps in, strikes (a punch, a projectile or a jump kick) and
// steps back, the other takes it (a flinch and a flash), dodges or blocks; they swap turns each cycle.
function duel(cv: Canvas, b: PBeat, A: CharId, B: CharId, sx: number, y: number, h: number, fog: number, sky: number, uu: number, t: number, i: number, stomp = 0) {
  const fw = (bodyW(A, h) + bodyW(B, h)) / 2, gap = fw * 0.55
  const T = 2.3 + 0.5 * hash(i, 1), q = uu + hash(i, 2) * T, k = Math.floor(q / T), e = q / T - k
  const att = (k + i) & 1, dir = att ? -1 : 1, kind = Math.floor(hash(i, k + 10) * 4), hit = hash(i, k + 60) < 0.62, dodge = !hit && hash(i, k + 90) > 0.4
  const ax0 = att ? sx + gap : sx - gap, dx0 = att ? sx - gap : sx + gap, reach = dx0 - dir * fw * 0.8, AI = att ? B : A, DI = att ? A : B
  y -= stomp
  let axp = ax0, af: number = idle(t, i), ay = y
  if (kind === 1) { if (e > 0.2 && e < 0.5) af = P.special }
  else if (e < 0.22) { axp = ax0 + (reach - ax0) * easeOut(e / 0.22); af = walk(t) }
  else if (e < 0.5) { axp = reach; af = kind === 2 ? P.jump : P.punch; if (kind === 2) ay = y - Math.sin(Math.PI * (e - 0.22) / 0.28) * h * 0.3 }
  else if (e < 0.72) { axp = reach + (ax0 - reach) * easeOut((e - 0.5) / 0.22); af = walk(t) }
  const ie = kind === 1 ? 0.5 : 0.36
  let dxp = dx0, df: number = idle(t, i + 1), dy = y, flash = 0
  if (e > ie - 0.02 && e < ie + 0.35) {
    if (hit) { df = P.hurt; dxp = dx0 + dir * Math.min(2.5, (e - ie) * 10); flash = e < ie + 0.06 ? 0.8 : 0 }
    else if (dodge) { df = P.jump; dy = y - Math.sin(Math.PI * clamp01((e - ie + 0.02) / 0.3)) * h * 0.3 } else df = P.block
  }
  fig(cv, DI, df, dxp, dy, h, -dir, t, fog, sky, flash)
  fig(cv, AI, af, axp, ay, h, dir, t, fog, sky)
  if (kind === 1 && e > 0.2 && e < 0.5) { const [hx, hy] = handOf(AI, P.special, axp, ay, h, dir); shot(cv, fxOf(b, AI) as FxKind, hx, hy, dxp - dir * fw * 0.3, y - h * 0.6, (e - 0.2) / 0.3, t, false, h) }
  if (hit && e > ie && e < ie + 0.15) { const sxp = dxp - dir * fw * 0.2, syp = y - h * 0.6; starburst(cv, sxp, syp, h * 0.28 * (1 - (e - ie) / 0.15), 0xffe14d, 0xd7262e, 10, e * 3); spark(cv, sxp, syp, h * 0.2, 0xffb020, (e - ie) / 0.15) }
}
// A battle is shown a few duels at a time (3 in a small pane, 4 in a big one, fewer if they would crowd), side by side with
// clear gaps; every 4 s the picture cuts to the next group. Giant-Man stomps far behind at half scale.
export function battle(cv: Canvas, b: PBeat, r: Rect, u: number, t: number, figH: number, floor: number, sky: number) {
  const giant = teams(b), Wc = r.x1 - r.x0, H = r.y1 - r.y0, N = duelsOf()
  let pw = 0
  for (let i = 0; i < N; i++) pw = Math.max(pw, bodyW(TA[i]!, figH) + bodyW(TB[i]!, figH))
  const gs = Math.max(1, Math.min(Wc >= 150 ? 4 : 3, N, Math.floor((Wc - 2) / Math.max(1, pw * 1.3)))), groups = Math.ceil(N / Math.max(1, gs))
  const g = groups ? Math.floor(u / 4.2) % groups : 0, first = g * gs, cnt = Math.min(gs, N - first), slot = (Wc - 2) / Math.max(1, cnt)
  const stomp = giant && u % 2.6 < 0.14 ? 1 : 0
  if (giant && figH >= 32) { // Giant-Man strides through the back
    const gx = r.x0 + Wc * (0.14 + 0.72 * (0.5 + 0.5 * Math.sin(u * 0.22 + 1))), gy = floor - H * 0.14
    fig(cv, 'GIANTMAN', walk(t * 0.6), gx, gy, figH / 2, Math.cos(u * 0.22 + 1) > 0 ? 1 : -1, t, 0.15, sky)
    if (stomp) cv.ring(gx, gy, 0, figH * 0.3 + (u % 2.6) * 30, () => 0xc8b08a)
  }
  for (let q = 0; q < cnt; q++) {
    const i = first + q, sx = r.x0 + 1 + slot * (q + 0.5), A = TA[i]!, B = TB[i]!, gap = (bodyW(A, figH) + bodyW(B, figH)) * 0.5
    const ru = u < 2.2 && g === 0 ? 1 - easeOut(u / 2.2) : 0
    if (ru > 0.02) { // the run-in
      const xa = sx - gap - ru * (sx - r.x0 + 14), xb = sx + gap + ru * (r.x1 - sx + 14)
      fig(cv, A, walk(t * 1.3 + i * 0.4), xa, floor, figH, 1, t, 0, sky); fig(cv, B, walk(t * 1.3 + i * 0.2), xb, floor, figH, -1, t, 0, sky)
      continue
    }
    duel(cv, b, A, B, sx, floor, figH, 0, sky, u - 2.2, t, i, stomp)
  }
}

// ── width-aware rows (team-ups) ─────────────────────────────────────────────
const SELF = new Int8Array(10), SELB = new Int8Array(10), PXF = new Float32Array(10), PXB = new Float32Array(10)
// Positions of ids[sel[0..cnt)] in a row from `from` going `dir` (+1 right, -1 left), neighbours overlapping by at most 12%.
function block(ids: readonly CharId[], sel: Int8Array, cnt: number, h: number, from: number, dir: number, out: Float32Array) {
  let x = from, pw = 0
  for (let q = 0; q < cnt; q++) { const w = bodyW(ids[sel[q]!]!, h); x += q ? dir * ((pw + w) / 2) * 0.88 : dir * (w / 2); out[q] = x; pw = w }
}
// Two rows (front, back; the small ones in front) packed across [lo, hi]: fills outX/outRow per figure.
function rows(ids: readonly CharId[], n: number, h: number, lo: number, hi: number, outX: Float32Array, outRow: Uint8Array) {
  let c0 = 0, c1 = 0
  for (let i = 0; i < n; i++) { const back = (i & 1) === 1 && sheetBox(ids[i]!)[1] >= 28; if (back) { SELB[c1++] = i; outRow[i] = 1 } else { SELF[c0++] = i; outRow[i] = 0 } }
  for (let pass = 0; pass < 2; pass++) {
    const sel = pass ? SELB : SELF, cnt = pass ? c1 : c0, out = pass ? PXB : PXF
    if (!cnt) continue
    let tot = 0, pw = 0
    for (let q = 0; q < cnt; q++) { const w = bodyW(ids[sel[q]!]!, h); tot += q ? ((pw + w) / 2) * 0.88 : w / 2; pw = w }
    tot += pw / 2
    const start = lo + Math.max(0, (hi - lo - tot) / 2) + (pass ? bodyW(ids[sel[0]!]!, h) * 0.4 : 0) // the back row stands between the front figures
    block(ids, sel, cnt, h, start, 1, out)
    for (let q = 0; q < cnt; q++) outX[sel[q]!] = out[q]!
  }
}
const HX = new Float32Array(10), HRW = new Uint8Array(10), EXXP = new Float32Array(10), ERW = new Uint8Array(10)

// ── team-ups ────────────────────────────────────────────────────────────────
const PX = new Float32Array(10), PY = new Float32Array(10)
const EXPOS = new Float32Array(10), HXP = new Float32Array(10), SELT = new Int8Array(10)
const exX = (_r: Rect, j: number, _M: number) => EXPOS[j]!
function disc(cv: Canvas, x: number, y: number, rr: number) {
  const F = FX.shield
  cv.ring(x, y, 0, rr * 0.45, () => F.c2); cv.ring(x, y, rr * 0.45, rr * 0.75, () => 0xfffdf6); cv.ring(x, y, rr * 0.75, rr, () => F.c)
}
export function teamup(cv: Canvas, b: PBeat, r: Rect, u: number, t: number, figH: number, floor: number, sky: number) {
  const Wc = r.x1 - r.x0, H = r.y1 - r.y0, W = b.who, E = b.rw, M = Math.min(E.length, 3), A = W[0], T = W[1]
  if (!A) return
  const ly = (_j: number) => floor, lh = (_j: number) => figH
  if (b.mv !== 'formation') { // heroes in a block from the left edge, the enemies in a block from the right
    SELT[0] = 0; SELT[1] = 1; block(W, SELT, Math.min(2, W.length), figH, r.x0 + 2, 1, HXP)
    if (W.length > 1) HXP[1] = Math.max(HXP[1]!, HXP[0]! + (bodyW(A, figH) + bodyW(T!, figH)) * 0.5 + 6)
    for (let q = 0; q < M; q++) SELT[q] = q
    block(E, SELT, M, figH, r.x1 - 2, -1, PXB)
    for (let q = 0; q < M; q++) EXPOS[M - 1 - q] = PXB[q]! // the enemy nearest the heroes is first
  }
  // the rest of the team stands behind, watching, and cheers at the end
  const sup = (_from: number) => {} // (the rest of the team is off this shot: one scale, a few figures)
  const enemy = (j: number, hitAt: number, dx = 0) => { // standing until hit at hitAt, then flung back and down
    const x = exX(r, j, M) + dx, y = ly(j), h = lh(j), e = u - hitAt
    if (e < 0) fig(cv, E[j]!, idle(t, j), x, y, h, -1, t, (j & 1) * 0.12, sky)
    else fig(cv, E[j]!, e < 0.9 ? P.hurt : P.ko, x + Math.min(5, e * 10), y - (e < 0.5 ? Math.sin(Math.PI * e / 0.5) * h * 0.25 : 0), h, -1, t, (j & 1) * 0.12, sky, e < 0.1 ? 0.8 : 0)
    if (e > 0 && e < 0.4) starburst(cv, x, y - h * 0.6, h * 0.3 * (1 - e / 0.4), 0xffe14d, 0xd7262e, 10, e * 3)
  }
  switch (b.mv) {
    case 'bounce': {
      const tx = HXP[0]!, ax = HXP[1]!, ay = floor, ah = figH
      const T0 = 1.0, T1 = T0 + 0.6, T2 = T1 + 0.4
      sup(2)
      for (let j = M - 1; j >= 0; j--) enemy(j, T2 + 0.5 * (j + 0.8))
      const retStart = T2 + 0.5 * M + 0.1, retEnd = retStart + 0.7
      if (T) fig(cv, T, u > T1 - 0.1 && u < T2 + 0.3 ? P.special : idle(t, 3), ax, ay, ah, 1, t, 0.08, sky)
      fig(cv, A, u > T0 && u < T0 + 0.5 ? P.special : u > retEnd - 0.1 ? P.block : idle(t), tx, floor, figH, 1, t)
      const [hx, hy] = handOf(A, P.special, tx, floor, figH, 1), [px, py] = T ? handOf(T, P.special, ax, ay, ah, 1) : [ax, ay - ah * 0.5]
      // the shield's path: Cap's hand, the repulsor, every enemy in turn, home again
      PX[0] = hx; PY[0] = hy; PX[1] = px; PY[1] = py
      for (let j = 0; j < M; j++) { PX[2 + j] = exX(r, j, M) - 1; PY[2 + j] = ly(j) - lh(j) * 0.6 }
      PX[2 + M] = hx; PY[2 + M] = hy
      let leg = -1, k = 0
      if (u >= T0 + 0.3 && u < T1) { leg = 0; k = (u - T0 - 0.3) / (T1 - T0 - 0.3) }
      else if (u >= T2 && u < retStart) { const q = (u - T2) / 0.5; leg = Math.min(M, 1 + Math.floor(q)); k = q - Math.floor(q); if (leg > M) leg = -1 }
      else if (u >= retStart && u < retEnd) { leg = M + 1; k = (u - retStart) / 0.7 }
      else if (u >= T1 && u < T2) { disc(cv, px, py, figH * 0.2); if (T) shot(cv, fxOf(b, T) as FxKind, px, py, px + 3, py, 1, t, false, figH); cv.radial(px, py, figH * 0.4, 0xffffff, 0.55) }
      if (leg >= 0 && leg <= M + 1) {
        const a = leg === 0 ? 0 : leg === M + 1 ? 1 + M : leg, bb = leg === 0 ? 1 : leg === M + 1 ? 2 + M : leg + 1
        const sx = PX[a]! + (PX[bb]! - PX[a]!) * k, sy = PY[a]! + (PY[bb]! - PY[a]!) * k - Math.sin(Math.PI * k) * figH * 0.12
        for (let q = 1; q < 5; q++) { const kk = Math.max(0, k - q * 0.07); cv.radial(PX[a]! + (PX[bb]! - PX[a]!) * kk, PY[a]! + (PY[bb]! - PY[a]!) * kk, figH * 0.1, 0xffffff, 0.35 - q * 0.06) }
        disc(cv, sx, sy, figH * 0.2)
      }
      break
    }
    case 'fastball': {
      const tx = HXP[0]!, th = figH, hx = tx + th * 0.35
      const tgX = exX(r, 0, M) - 2, tgY = floor - figH * 0.5, rel = 1.6, land = 2.5
      sup(2)
      for (let j = M - 1; j >= 0; j--) enemy(j, j === 0 ? land : land + 0.25 + 0.2 * j)
      fig(cv, A, u > 1.2 && u < 2.0 ? P.special : idle(t), tx, floor, th, 1, t)
      if (T) {
        const sh = figH
        if (u < 0.9) fig(cv, T, walk(t), r.x0 + 2 + (tx - 6 - r.x0 - 2) * easeOut(u / 0.9), floor, sh, 1, t)
        else if (u < rel) { const k = clamp01((u - 0.9) / 0.3); fig(cv, T, P.jump, tx - 6 + (hx - tx + 6) * k, floor - th * 0.45 * k - Math.sin(Math.PI * k) * th * 0.2, sh, 1, t) }
        else if (u < land) { // thrown: it spins down the length of the frame
          const k = (u - rel) / (land - rel), px = hx + (tgX - hx) * k, py = floor - th * 0.45 + (tgY + figH * 0.5 - (floor - th * 0.45)) * k - Math.sin(Math.PI * k) * H * 0.3
          fig(cv, T, P.jump, px, py, sh, Math.floor(t * 12) & 1 ? 1 : -1, t); speedLines(cv, px - 18, px - 4, py - sh, py, 1, t, 0.7)
        } else fig(cv, T, u < land + 0.9 ? P.punch : idle(t, 2), tgX - 3, floor, sh, 1, t)
        if (u > land && u < land + 0.5) { spark(cv, tgX, floor - figH * 0.5, figH * 0.5, 0xffb020, (u - land) / 0.5); starburst(cv, tgX, floor - figH * 0.5, figH * 0.55 * (1 - (u - land) / 0.5), 0xffe14d, 0xd7262e, 12, t) }
      }
      break
    }
    case 'thorcap': {
      const cx = Math.max(r.x0 + Wc * 0.3, HXP[1]! + 4), hit = 2.1
      sup(2)
      const waveR = u > hit ? (u - hit) * Wc * 0.55 : 0
      for (let j = M - 1; j >= 0; j--) enemy(j, hit + Math.max(0, (exX(r, j, M) - cx) / (Wc * 0.55)))
      if (T) fig(cv, T, u > 0.5 ? P.block : idle(t), cx, floor, figH, 1, t)
      const thX = u < hit - 0.3 ? r.x0 + 2 + (cx - figH * 0.5 - r.x0 - 2) * easeOut(clamp01(u / (hit - 0.3))) : cx - figH * 0.5
      fig(cv, A, u < hit - 0.3 ? walk(t * 1.5) : u < hit + 0.5 ? P.special : idle(t), thX, floor, figH, 1, t)
      if (u < hit - 0.3 && u > 0.3) speedLines(cv, thX - 16, thX - 3, floor - figH, floor, 1, t)
      if (u > hit && waveR < Wc) { cv.ring(cx + 2, floor - figH * 0.5, waveR, waveR + 2, () => 0xfff2c8); cv.ring(cx + 2, floor - figH * 0.5, Math.max(0, waveR - 3), waveR, a => (Math.floor(a * 6) & 1 ? 0x8fb4ff : 0xffffff)) }
      if (u > hit - 0.1 && u < hit + 0.5) { const k = (u - hit) / 0.5; starburst(cv, cx + figH * 0.18, floor - figH * 0.55, figH * 0.7 * (1 - k * 0.5), 0xffffff, 0xd7262e, 14, t); spark(cv, cx + figH * 0.2, floor - figH * 0.55, figH * 0.5, 0x8fb4ff, k) }
      break
    }
    default: { // formation: the team in two rows, firing in turn at the horde (a wide shot at half scale when it is a crowd)
      const nW = Math.min(W.length, 6), nE = Math.min(E.length, 8), hh = nW + nE > 6 && figH >= 32 ? figH / 2 : figH, fl = hh < figH ? floor - Math.round(H * 0.14) : floor
      rows(W, nW, hh, r.x0 + 1, r.x0 + Wc * 0.5, HX, HRW); rows(E, nE, hh, r.x0 + Wc * 0.54, r.x1 - 1, EXXP, ERW)
      const tgt = (i: number) => (i * 5 + 1) % Math.max(1, nE)
      const hitAt = (j: number) => { let best = 99; for (let i = 0; i < nW; i++) if (tgt(i) === j) best = Math.min(best, 1.0 + 0.3 * i + 0.55); return best }
      const ey = (j: number) => fl - (ERW[j] ? 4 : 0)
      for (let pass = 1; pass >= 0; pass--) for (let j = nE - 1; j >= 0; j--) {
        if (ERW[j] !== pass) continue
        const e = u - hitAt(j), adv = -easeInOut(clamp01(u / 1.2)) * Wc * 0.03
        fig(cv, E[j]!, e < 0 ? (u < 1.2 ? walk(t + j * 0.2) : idle(t, j)) : e > 1.2 ? P.ko : P.hurt, EXXP[j]! + adv + (e > 0 ? Math.min(4, e * 8) : 0), ey(j), hh, -1, t, ERW[j] ? 0.06 : 0, sky, e > 0 && e < 0.1 ? 0.8 : 0)
      }
      for (let pass = 1; pass >= 0; pass--) for (let i = nW - 1; i >= 0; i--) {
        if (HRW[i] !== pass) continue
        const id = W[i]!, ft = 1.0 + 0.3 * i, firing = u > ft && u < ft + 0.5, hy = fl - (pass ? 4 : 0)
        fig(cv, id, firing ? P.special : idle(t, i), HX[i]!, hy, hh, 1, t, pass ? 0.05 : 0, sky)
        if (firing) {
          const [px, py] = handOf(id, P.special, HX[i]!, hy, hh, 1), j = tgt(i)
          shot(cv, fxOf(b, id) as FxKind, px, py, EXXP[j]! - 2, ey(j) - hh * 0.5, clamp01((u - ft) / 0.45), t, false, hh)
        }
      }
      if (nW > 0 && u > 1.0 && u < 1.4) speedLines(cv, r.x0, r.x0 + Wc * 0.2, fl - hh, fl, 1, t, 0.3)
    }
  }
}
