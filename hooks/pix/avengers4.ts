// Hand-drawn pixel art: Falcon, War Machine, Captain Marvel, Bucky (see ../portraits.ts).
import { pixmap, type LaneArt, type StageArt } from './pixmap'
import { type Canvas, type HiSprite } from '../pixel'
export const STAGES: Partial<Record<string, StageArt>> = {}
export const LANES: Partial<Record<string, LaneArt>> = {}

// ---------- shared helpers ----------
const rj = (r: string) => r.padStart(18, '.')
const mir = (rows: string[]) => rows.map(r => { const p = r.length < 18 ? rj(r) : r; return p + [...p].reverse().join('') })
const over = (rows: string[], ov: string[], x0: number, y0: number) => rows.map((r, j) => {
  const o = ov[j - y0]; if (!o) return r
  return [...r].map((ch, i) => { const c = o[i - x0]; return c && c !== '.' ? c : ch }).join('')
})
const sub = (rows: string[], a: string, b: string) => rows.map(r => r.split(a).join(b))
const P = pixmap
const P2 = (rows: string[], pal: Record<string, number>) => pixmap(rows.map(r => [...r].map(ch => ch + ch).join('')), pal)
const half = (rows: string[]) => rows.map(r => r + [...r].reverse().join(''))
const shear = (rows: string[], k: number) => { // bank: left side up, right side down by k rows
  const w = rows[0]!.length, h = rows.length + 2 * k, out = Array.from({ length: h }, () => Array<string>(w).fill('.'))
  for (let i = 0; i < w; i++) { const d = Math.round(((i - (w - 1) / 2) / ((w - 1) / 2)) * k); rows.forEach((r, j) => { out[j + k + d]![i] = r[i]! }) }
  return out.map(r => r.join(''))
}

// ---------- Falcon ----------
const FAL_PAL = { o: 0x1a0c10, r: 0xe0343a, R: 0x8a1c28, h: 0xff7a6a, g: 0x9aa2bc, G: 0xd0d6e8, d: 0x4a5068, s: 0x9a6244, S: 0xc2845c, k: 0x2a1c1c, e: 0xff3a3a, w: 0xffffff }
const FAL_ROWS = mir([
  '.rr.......oooooooo', '.rhr.....okkkkkkkk', '.rhRr...okkkkkkkkk', '..rhRr..osssssssss', '..rRrr..oddddddddd',
  '...rRr..oddeweeeed', '....rr..odeeeeeeed', '....rRr.osssssssss', '....rRr.ossssssSss', '.....rRrooosssdddd',
  '....rrRRoossssssss', '...rhrRRoooossssss', 'rhrrRooddgggggGGRR', 'rrrRRodgggggGGGGRR'])
const FAL_A = P(FAL_ROWS, FAL_PAL), FAL_B = P(sub(FAL_ROWS, 'w', 'e'), FAL_PAL)
STAGES.falcon = (cv, t, calm) => {
  const pu = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3), br = !calm && Math.sin(t * 1.8) > 0.5 ? -1 : 0
  cv.radial(18, 7, 9, 0xe0343a, 0.18 + 0.12 * pu)
  const blink = !calm && (t % 3.4) > 3.25
  cv.hi(blink ? FAL_B : FAL_A, 0, br)
  for (const x of [11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24]) cv.glowSub(x, 5 + br, 0xff3030, 0.25 + 0.4 * pu)
  if (!calm) { const j = Math.floor(t * 9) % 10; if (j < 5) { cv.setSub(1 + j, j + br, 0xffffff); cv.setSub(34 - j, j + br, 0xffffff) } }
}

// ---------- War Machine ----------
const WM_PAL = { o: 0x0b0d14, m: 0x5b6272, M: 0x929bb2, d: 0x262a36, e: 0x9be8ff, E: 0xffffff, k: 0x1a1c24, y: 0xffb040 }
const WM_BASE = mir([
  '........oooooooooo'.slice(0, 18), rj('ommmmMMMMMMM'), rj('ommmmMMMMMMM'), rj('ommmmmmmmmmm'), rj('ommddddddddd'),
  rj('ommdeeeeeeee'), rj('ommdddddddddd'.slice(0, 11)), rj('ommmmmmmmmm'), rj('ommmmmdmdmdm'.slice(0, 11)), rj('ommmmmmmmmm'),
  rj('oooodmmmmmmmmmm'), rj('oommmmMMmmmmmmmmm'), rj('oommmmMMMMmmmmmmmm'), 'ommmmmMMMMMMmmmmmm'])
const GUN_A = ['.oooo..', 'oMkMkMo', 'okMkMko', 'oMkMkMo', '.oooo..', 'ooMMMoo']
const GUN_B = sub(GUN_A, 'M', 'x').map(r => r.split('k').join('M').split('x').join('k'))
const WM_A = P(over(WM_BASE, GUN_A, 29, 5), WM_PAL), WM_B = P(over(WM_BASE, GUN_B, 29, 5), WM_PAL)
STAGES.warmachine = (cv, t, calm) => {
  const pu = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3), br = !calm && Math.sin(t * 1.8) > 0.5 ? -1 : 0
  cv.radial(14, 5, 8, 0x4a78c8, 0.12 + 0.1 * pu)
  cv.hi(!calm && Math.floor(t * 8) % 2 ? WM_B : WM_A, 0, br)
  const sc = calm ? 8 : Math.floor(t * 12) % 22
  for (let i = 0; i < 4; i++) { const x = 7 + sc + i; if (x >= 7 && x < 29) cv.setSub(x, 5 + br, 0xffffff) }
  for (const x of [11, 12, 13, 14, 21, 22, 23, 24]) cv.glowSub(x, 5 + br, 0x9be8ff, 0.3 + 0.3 * pu)
  if (!calm && (t % 2.6) > 2.4) { cv.glowSub(32, 1 + br, 0xffb040, 0.7); cv.glowSub(31, 1 + br, 0xffe27a, 0.4) } // muzzle spark
}

// ---------- Captain Marvel ----------
const CM_PAL = { o: 0x1a0a2a, Y: 0xffd23a, y: 0xfff0a0, G: 0xb87a14, b: 0x2a46c8, B: 0x16256e, c: 0x5a7aff, r: 0xe0283a, R: 0x8a1424, s: 0xf2c09c, S: 0xd0906c, E: 0xfffbc0 }
const CM_ROWS = mir([
  rj('oGy'), rj('oYYy'), rj('obbYYYy'), rj('obbbbcYYy'), rj('obBBBBBBBBBB'), rj('obssssssss'), rj('obssEEEsss'),
  rj('obssssSsss'), rj('ooSssssrrr'), rj('oosssssSss'), rj('oRrrosssss'), rj('ooRrrrbbbbbbY'),
  rj('oRrrrrbbbbbbYYYYY'), 'rrrrrrbbbbbbbYYbbb'].map(r => r.length < 18 ? rj(r) : r))
const CM_A = P(CM_ROWS, CM_PAL), CM_B = P(sub(CM_ROWS, 'E', 's'), CM_PAL)
STAGES.cmarvel = (cv, t, calm) => {
  const pu = calm ? 0.6 : 0.5 + 0.5 * Math.sin(t * 3.4), br = !calm && Math.sin(t * 1.8) > 0.5 ? -1 : 0
  cv.radial(18, 6, 10, 0xffb830, 0.18 + 0.22 * pu)
  cv.hi(!calm && (t % 3.5) > 3.35 ? CM_B : CM_A, 0, br)
  for (const x of [15, 16, 17, 18, 19, 20]) cv.glowSub(x, 6 + br, 0xfff7a0, 0.35 + 0.5 * pu)
  if (!calm) for (let i = 0; i < 4; i++) { const y = ((t * 7 + i * 3) % 6); cv.glowSub(17 + (i % 2), 4 - Math.floor(y) + br, 0xff9a30, 0.7 * (1 - y / 6)) } // mohawk embers
  cv.glowSub(17, 12 + br, 0xffffff, 0.2 + 0.4 * pu); cv.glowSub(18, 12 + br, 0xffffff, 0.2 + 0.4 * pu)
}

// ---------- Bucky ----------
const BK_PAL = { o: 0x0c0a14, q: 0x8aa6f4, h: 0x7a5240, H: 0xc29468, g: 0x4e3428, s: 0xe0b090, S: 0xa87858, m: 0x1c1a28, M: 0x5a5a82, e: 0xd8f0ff, j: 0x34436e, J: 0x6a82c0, t: 0x161c36, u: 0xd0d6e8, A: 0xf4f7ff, a: 0xa0aac8, d: 0x5a6688, r: 0xff2a2a, R: 0x8a1018 }
const bkGrid = (sway: number, blink: number) => {
  const g = Array.from({ length: 14 }, () => Array<string>(36).fill('.'))
  const at = (y: number, x0: number, s: string) => [...s].forEach((c, i) => { if (c !== '.' && g[y] && x0 + i < 36) g[y]![x0 + i] = c })
  const J = (n: number) => 'j'.repeat(n)
  at(0, 11, 'qqqqqqqqqqqq'); at(1, 10, 'ohHHHHhhhhhhhhhq'); at(2, 9, 'ohhHHHhhhhhhhhhhhq')
  at(3, 9, 'ohhggssssssssgghhq'); at(4, 9, 'ohh' + (blink ? 'ssSSssssSSss' : 'sseesssseess') + 'hhq')
  at(5, 9, 'ohhsSmmmMMmmmSshhq'); at(6, 9, 'ohhhmmmMMMMmmmhhhq'); at(7, 9, 'ohhhmmmmmmmmmmhhhq'); at(8, 10, 'ohhhmmmmmmmmhhhq')
  at(9, 6, 'o' + J(4) + 'hhh' + 'ttMMMMtt' + 'hhh' + J(4) + 'q')
  at(10, 4, 'o' + J(7) + 'hh' + 'ttJttJtt' + 'hh' + J(7) + 'q')
  at(11, 3, 'oJ' + J(8) + 'tt' + J(6) + 'tt' + J(8) + 'Jq')
  at(12, 2, 'oJ' + J(9) + 'tt' + 'jj' + 'uu' + 'jj' + 'tt' + J(9) + 'Jq')
  at(13, 1, 'oJ' + J(9) + 'tt' + J(8) + 'tt' + J(9) + 'Jq')
  // slim silver arm: plated pauldron + upper arm, sharp red star
  at(9, 2, 'oAAArAAo'); at(10, 1, 'oAArrrAdo'); at(11, 1, 'oAdrArdAo'); at(12, 2, 'odddddddo'); at(13, 3, 'oAAaAAdo')
  if (sway) { g[9]![10] = 'h'; g[10]![10] = 'h'; g[9]![24] = 't'; g[9]![25] = 'j' }
  return g.map((r, y) => { if (y > 8) return r.join(''); const f = r.slice(12, 24).flatMap(c => [c, c]); return [...r.slice(0, 12), ...f, ...r.slice(24)].slice(6, 42).join('') })
}
const BK_SP = [[P(bkGrid(0, 0), BK_PAL), P(bkGrid(0, 1), BK_PAL)], [P(bkGrid(1, 0), BK_PAL), P(bkGrid(1, 1), BK_PAL)]]
STAGES.bucky = (cv, t, calm) => {
  const pu = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3), sw = !calm && Math.sin(t * 1.5) > 0.2 ? 1 : 0, bl = !calm && (t % 3.8) > 3.62 ? 1 : 0
  cv.radial(18, 6, 11, 0x6a82d0, 0.16 + 0.06 * pu)
  cv.hi(BK_SP[sw]![bl]!, 0, 0)
  const k = calm ? 4 : Math.floor(t * 9) % 18 // arm-plate glint sweeps
  if (k < 8) { cv.glowSub(2 + k, 9 + Math.floor(k / 3), 0xffffff, 0.75); cv.glowSub(3 + k, 9 + Math.floor(k / 3), 0xbfd8ff, 0.4) }
  cv.glowSub(5, 10, 0xff3030, 0.25 + 0.4 * pu)
  if (!bl) for (const x of [10, 11, 12, 13, 22, 23, 24, 25]) cv.glowSub(x, 4, 0xbfe6ff, 0.25 + 0.25 * pu)
}

// ---------- Lanes (12 subpx tall, 8 s stories) ----------
const LH = 12, TT = 8
const hs = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
const seg = (t: number, a: number, b: number) => { const v = (t - a) / (b - a); return v < 0 ? 0 : v > 1 ? 1 : v }
const ease = (k: number) => 1 - (1 - k) ** 3
const lerp = (a: number, b: number, k: number) => a + (b - a) * k
const dot = (cv: Canvas, y0: number, x: number, y: number, c: number, a = 1) => { y = Math.round(y); if (y < 0 || y >= LH) return; if (a >= 1) cv.setSub(Math.round(x), y0 + y, c); else if (a > 0.02) cv.blendSub(Math.round(x), y0 + y, c, a) }
const lit = (cv: Canvas, y0: number, x: number, y: number, c: number, a: number) => { y = Math.round(y); if (y >= 0 && y < LH && a > 0.02) cv.glowSub(Math.round(x), y0 + y, c, a) }
const spr = (cv: Canvas, y0: number, s: HiSprite, x: number, y: number, o: { tint?: number; tintAmt?: number; alpha?: number; flip?: boolean } = {}) => {
  y = Math.round(y); if (y < 0) y = 0; if (y + s.h > LH) y = LH - s.h
  cv.hi(s, Math.round(x) / 2, y0 + y, o)
}
const ground = (cv: Canvas, y0: number) => { for (let x = 0; x < cv.W; x++) dot(cv, y0, x, LH - 1, x % 6 < 4 ? 0x3a3a62 : 0x2c2c4e) }
const plus = (cv: Canvas, y0: number, x: number, y: number, c: number, a: number) => { dot(cv, y0, x, y, c, a); dot(cv, y0, x - 1, y, c, a * 0.7); dot(cv, y0, x + 1, y, c, a * 0.7); dot(cv, y0, x, y - 1, c, a * 0.7); dot(cv, y0, x, y + 1, c, a * 0.7) }
const rad = (cv: Canvas, y0: number, sx: number, sy: number, r: number, c: number, a = 1) => { // sx in subpx, sy lane row
  const cy = y0 + sy, cx = sx / 2, r2 = r * r
  for (let y = Math.max(y0, Math.floor(cy - r)); y <= Math.min(y0 + LH - 1, Math.ceil(cy + r)); y++) for (let xs = Math.floor((cx - r / 0.8276) * 2); xs <= Math.ceil((cx + r / 0.8276) * 2); xs++) {
    const d2 = (((xs + 0.5) / 2 - cx) * 0.8276) ** 2 + (y + 0.5 - cy) ** 2
    if (d2 < r2) { const f = 1 - Math.sqrt(d2) / r; cv.glowSub(xs, y, c, a * f * f) }
  }
}
const ellipse = (cv: Canvas, y0: number, cx: number, cy: number, rx: number, ry: number, c: number, a: number) => {
  const n = Math.max(12, Math.round(rx * 1.6)); for (let i = 0; i < n; i++) { const A = (i / n) * Math.PI * 2; lit(cv, y0, cx + Math.cos(A) * rx, cy + Math.sin(A) * ry, c, a) }
}
const boom = (cv: Canvas, y0: number, cx: number, cy: number, k: number, R: number) => {
  if (k <= 0 || k >= 1) return
  if (k < 0.25) rad(cv, y0, cx, cy, R, 0xffffff, 0.9 * (1 - k / 0.25))
  rad(cv, y0, cx, cy, R * (0.6 + 0.9 * k), 0xff8a30, 0.95 * (1 - k)); rad(cv, y0, cx, cy, R * (0.3 + 0.4 * k), 0xffe27a, 0.9 * (1 - k))
  ellipse(cv, y0, cx, cy, R * 2 * k + 2, R * 0.8 * k + 1, 0xffc060, 0.9 * (1 - k))
  for (let i = 0; i < 8; i++) { const A = i * 0.785 + 0.3, r = R * (0.4 + 1.8 * k); plus(cv, y0, cx + Math.cos(A) * r * 1.7, cy + Math.sin(A) * r * 0.7, i % 2 ? 0xffe27a : 0xff7a30, 1 - k) }
}
const debris = (cv: Canvas, y0: number, cx: number, cy: number, t0: number, t: number, n: number, seed: number, sp: number, c1: number, c2: number) => {
  const d = t - t0; if (d <= 0 || d > 1.8) return
  for (let i = 0; i < n; i++) {
    const vx = (hs(seed + i) - 0.5) * 2 * sp, vy = -(0.4 + hs(seed + i * 3)) * sp * 0.5
    const x = cx + vx * d, y = Math.min(LH - 2, cy + vy * d + 22 * d * d), a = d > 1.2 ? 1 - (d - 1.2) / 0.6 : 1
    dot(cv, y0, x, y, c1, a); dot(cv, y0, x + 1, y, c2, a)
  }
}
const bolt = (cv: Canvas, y0: number, x0: number, ya: number, x1: number, yb: number, seed: number, c: number) => {
  const n = Math.max(1, Math.round(Math.abs(x1 - x0))), dir = x1 > x0 ? 1 : -1
  for (let i = 0; i <= n; i++) { const f = i / n, env = Math.sin(f * Math.PI), y = lerp(ya, yb, f) + (hs(seed + i * 0.7) - 0.5) * 3.2 * env; dot(cv, y0, x0 + dir * i, y, 0xffffff); lit(cv, y0, x0 + dir * i, y, c, 0.8); lit(cv, y0, x0 + dir * i, y + 1, c, 0.35) }
}
const speedL = (cv: Canvas, y0: number, x: number, c: number, a: number, t: number, rows = [1, 3, 5, 7]) => {
  for (const r of rows) { const L = 8 + ((r * 7) % 5) * 3, o = Math.floor(t * 20 + r) % 3 * 2; for (let i = 0; i < L; i++) dot(cv, y0, x - 4 - o - i * 1.4, r, c, a * (1 - i / L) * 0.7) }
}
const puff = (cv: Canvas, y0: number, x: number, k: number, dir = 1) => {
  if (k <= 0 || k >= 1) return
  for (let i = 0; i < 3; i++) { const px = x + dir * (i * 3 + k * 6), py = LH - 2 - k * (1.5 + i * 0.8); dot(cv, y0, px, py, 0x7a74a4, 0.7 * (1 - k)); dot(cv, y0, px + 1, py, 0x9892c4, 0.5 * (1 - k)) }
}
const shadow = (cv: Canvas, y0: number, x: number, w: number, a = 0.8) => { for (let i = 0; i < w; i++) dot(cv, y0, x + i, LH - 2, 0x10102a, a * (1 - Math.abs(i - w / 2) / (w / 2) * 0.5)) }

// ----- Falcon: "On your left." Falcon soars in wings spread, banks hard, Redwing launches off his back, flies to a bullseye target and zaps it; the target blows up and Redwing docks as he flies on. -----
const FALH = ['rh....kk', 'rRhr..ks', 'GRRrr.ke', 'ggRRrrgs', '.gGgRrrg', '..dgGRrr', '....dgGR', '......dd']
const FALF = half(FALH)
const FLY0 = P2(FALF, FAL_PAL), FLY1 = P2(shear(FALF, 1), FAL_PAL), FLY2 = P2(shear(FALF, 2), FAL_PAL)
const RWP = { r: 0xff4a4a, R: 0x9a1c2a, g: 0xd0d6e8, G: 0xffffff, e: 0x9bf0ff, d: 0x4a5068 }
const REDW = P2(['r.ggg.r', 'rrgGgrr', '.rReRRr.', '..r.r..'].map(r => r), RWP)
const BULL = P2(['..rr..', '.rwwr.', 'rwrrwr', 'rwrrwr', '.rwwr.', '..rr..', '..dd..', '..dd..'], { r: 0xe8343a, w: 0xffffff, d: 0x8a92b8 })
LANES.falcon = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 4.9 : t0 % TT, cx = Math.round(W * 0.34), tx = W - 30
  ground(cv, y0)
  let fx: number
  if (t < 2.2) fx = -36 + (cx + 36) * ease(t / 2.2)
  else if (t < 5.8) fx = cx + Math.min(t - 2.2, 1.5) * 4 + Math.max(0, t - 3.7) * 1.5
  else fx = cx + 12 + (W + 50 - cx) * seg(t, 5.8, 8) ** 2
  const bob = Math.sin(t * 5) * 0.7
  const bk = t < 2.2 || t >= 3.7 ? 0 : t < 2.45 || t >= 3.4 ? 1 : 2
  const fs = bk === 2 ? FLY2 : bk === 1 ? FLY1 : FLY0
  const fy = bk === 2 ? 0 : bk === 1 ? 1 : 2 + bob
  // target
  if (t < 5.15) { const hit = t >= 4.5; spr(cv, y0, BULL, tx, 4, hit && Math.floor(t * 16) % 2 ? { tint: 0xffffff, tintAmt: 0.6 } : {}) }
  boom(cv, y0, tx + 6, 6, seg(t, 5.1, 6.4), 11)
  debris(cv, y0, tx + 6, 6, 5.15, t, 8, 7, 22, 0xe8343a, 0xffffff)
  // falcon
  if (t < 2.4 || t >= 5.8) speedL(cv, y0, fx, 0xff7a7a, 0.7, t, [2, 4, 6])
  shadow(cv, y0, fx + 6, 20, 0.7)
  spr(cv, y0, fs, fx, fy)
  if (bk === 2) rad(cv, y0, fx + 16, 5, 7, 0xffffff, 0.12)
  // Redwing
  const rl = 3.5, rd = 4.5
  if (t >= rl) {
    let rx: number, ry: number
    if (t < rd) { const k = ease(seg(t, rl, rd)); rx = lerp(fx + 8, tx - 14, k); ry = lerp(3, 4, k) - Math.sin(k * Math.PI) * 1.5 }
    else if (t < 5.9) { rx = tx - 14; ry = 4 + Math.sin(t * 9) * 0.5 }
    else { const k = ease(seg(t, 5.9, 6.7)); rx = lerp(tx - 14, fx + 8, k); ry = lerp(4, 3, k) }
    if (t < 6.7) {
      if (t < rd) for (let q = 0; q < 10; q++) lit(cv, y0, rx - q * 1.6, ry + 2, 0xff6a6a, 0.6 * (1 - q / 10))
      if (t < rl + 0.25) { plus(cv, y0, fx + 8, 3, 0xffffff, 1 - seg(t, rl, rl + 0.25)) }
      spr(cv, y0, REDW, rx, ry)
      if (t >= rd && t < 5.1) { // zap
        const sh = Math.floor(t * 30)
        bolt(cv, y0, rx + 14, ry + 2, tx + 4, 6, sh * 3.1, 0x6ad8ff)
        rad(cv, y0, tx + 6, 6, 5 + (sh % 2), 0xbfeaff, 0.5); plus(cv, y0, tx + 6, 6, 0xffffff, 1)
        lit(cv, y0, rx + 14, ry + 2, 0xffffff, 0.9)
      }
    }
  }
}

// ----- War Machine: Rhodey plants his feet; the shoulder minigun chews through a cluster of three hostile drones, then three missiles streak out and each drone explodes. He thrusts off. -----
const WMP = { o: 0x0b0d14, m: 0x6a7388, M: 0xaab3ca, d: 0x262a36, e: 0x9be8ff, k: 0x1a1c24, r: 0xe0402e }
const WMH = [
  '..oooo......', '.ogMMdo.....', '.oeeeeo.....', '..oddo.ooooo', '.ogMmMgoMMMMk', 'ogMMmmMdoMkkk'.slice(0, 12), 'ogMmmMmdooooo'.slice(0, 12),
  'odgMmmMdo...', '.odgmmmdo...', '..oddgo.....', '..omo.mo....', '..oo..oo....'].map(r => r.padEnd(12, '.').slice(0, 12))
const WMH2 = WMH.map((r, i) => i === 10 ? '..om..om....' : i === 11 ? '..oo..oo....' : r)
const WMF = [P2(WMH, WMP), P2(WMH2, WMP)]
const DRP = { o: 0x1c2036, g: 0xc4cce4, G: 0xeef2ff, r: 0xff3a3a, y: 0xffc030 }
const DRONE = P2(['.oooo.', 'oggGgo', 'ogrrgo', 'oggggo', '.oyyo.'], DRP)
LANES.warmachine = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 4.05 : t0 % TT
  const bx = Math.max(6, Math.round(W * 0.1)), DX = [W - 64, W - 44, W - 24].map(x => Math.max(x, bx + 70)), DY = [1, 5, 2]
  const hitT = [3.75, 4.05, 4.35]
  ground(cv, y0)
  let x = bx
  if (t < 0.9) x = -30 + (bx + 30) * ease(t / 0.9)
  const lift = t >= 6.0 ? seg(t, 6.0, 7.6) : 0
  if (lift > 0) x = bx + (W + 40 - bx) * lift * lift
  const firing = t >= 1.2 && t < 4.0 && !calm || (calm && false)
  const mx = x + 25, my = 4
  // drones
  for (let j = 0; j < 3; j++) {
    const bobv = Math.sin(t * 3 + j * 2) * 0.8
    if (t < hitT[j]!) {
      const fl = t >= 1.5 && t < hitT[j]! && Math.floor(t * 14 + j) % 4 === 0
      spr(cv, y0, DRONE, DX[j]!, DY[j]! + bobv, fl ? { tint: 0xffffff, tintAmt: 0.6 } : {})
      lit(cv, y0, DX[j]! + 6, DY[j]! + 7 + bobv, 0xffc030, 0.3)
    }
    boom(cv, y0, DX[j]! + 6, DY[j]! + 3, seg(t, hitT[j]!, hitT[j]! + 1.1), 11)
    debris(cv, y0, DX[j]! + 6, DY[j]! + 3, hitT[j]! + 0.05, t, 6, 11 + j * 5, 26, 0xc4cce4, 0xff8a30)
  }
  // tracers
  if (t >= 1.2 && t < 4.6) for (let i = 0; i < 60; i++) {
    const ts = 1.2 + i * 0.05, d = t - ts; if (d < 0 || ts > 4.0) continue
    const j = i % 3, tx = DX[j]! + 2, ty = DY[j]! + 3, fx0 = bx + 25
    const xx = fx0 + d * 150; if (xx > tx) { if (t < hitT[j]! && d < (tx - fx0) / 150 + 0.1) { plus(cv, y0, tx, ty + (i % 2), 0xffe27a, 0.9) } continue }
    const yy = lerp(my, ty, (xx - fx0) / (tx - fx0))
    dot(cv, y0, xx, yy, 0xffffff); dot(cv, y0, xx - 1, yy, 0xffe27a, 0.9); dot(cv, y0, xx - 2, yy, 0xff9a30, 0.6); dot(cv, y0, xx - 3, yy, 0xff7a30, 0.3)
  }
  // missiles
  for (let m = 0; m < 3; m++) {
    const ls = hitT[m]! - 0.7, d = t - ls; if (d < 0 || d > 0.7) continue
    const k = d / 0.7, sx = bx + 14, tx = DX[m]! - 1, ty = DY[m]! + 3
    const px = lerp(sx, tx, k), py = lerp(2, ty, k) - Math.sin(k * Math.PI) * 2
    for (let q = 0; q < 12; q++) { const a = 1 - q / 12; dot(cv, y0, px - q * 1.5, lerp(2, ty, Math.max(0, k - q * 0.02)) - Math.sin(Math.max(0, k - q * 0.02) * Math.PI) * 2, q < 3 ? 0xffd45a : 0xc8c8dc, 0.8 * a) }
    dot(cv, y0, px, py, 0xff4a3a); dot(cv, y0, px - 1, py, 0xffffff); dot(cv, y0, px - 2, py, 0xe0e0f0); dot(cv, y0, px - 3, py, 0xe0e0f0)
    if (d < 0.2) rad(cv, y0, sx, 3, 4, 0xffa040, 0.7 * (1 - d / 0.2))
  }
  // rhodey
  const rec = firing && Math.floor(t * 14) % 2 ? -1 : 0
  const walk = t < 0.9 && Math.floor(t * 10) % 2 ? 1 : 0
  const sx0 = Math.round(x) + rec
  if (lift > 0) { for (let i = 0; i < 12; i++) { lit(cv, y0, sx0 + 8 + (i % 2) * 6, LH - 1 - Math.min(i, 3) * 0.1, 0xffffff, 0.5); } for (let q = 0; q < 8; q++) lit(cv, y0, sx0 + 9 - q, LH - 2 + 0, 0x9be8ff, 0.4) }
  spr(cv, y0, WMF[walk]!, sx0, lift > 0 ? Math.max(0, 0 - lift * 0) : 0)
  if (firing || calm) { // muzzle flash
    const f = calm ? 1 : Math.floor(t * 28) % 2
    for (let i = 0; i < 4; i++) lit(cv, y0, sx0 + 25 + i, 4, i < 2 ? 0xffffff : 0xffb040, f ? 0.95 : 0.5)
    rad(cv, y0, sx0 + 27, 4, 4, 0xffa030, f ? 0.7 : 0.35)
    if (!calm && f) { dot(cv, y0, sx0 + 14 + (Math.floor(t * 14) % 3), 2 - 1, 0xf0c040); dot(cv, y0, sx0 + 15 + (Math.floor(t * 9) % 3), 1, 0xf0c040) }
  }
  // smoke after the blasts
  if (t > 4.4 && t < 7.4) for (let j = 0; j < 3; j++) for (let q = 0; q < 3; q++) {
    const d = t - 4.4 - q * 0.3 - j * 0.1; if (d < 0) continue
    const yy = DY[j]! + 3 - d * 2.2, a = Math.max(0, 0.7 - d * 0.22); dot(cv, y0, DX[j]! + 4 + q * 3 + Math.sin(d * 3 + j) * 2, yy, 0x8c88b0, a); dot(cv, y0, DX[j]! + 5 + q * 3 + Math.sin(d * 3 + j) * 2, yy, 0xa8a4cc, a * 0.7)
  }
}

// ----- Captain Marvel: she hovers and ignites in binary mode (gold fire, flaring hair), charges, PUNCHES through the Kree warship and out the far side; the ship cracks and explodes behind her. -----
const CMF = P2(['.......yYy....', '......YYYYo...', '.rr..obbbbsso.', 'rrRbbbbbbbsEo.', 'RrrbbYYbbBrrrr', '.rRbbYYbbbBrr.', '..r..obbbo....'], CM_PAL)
const SHP = { o: 0x0d1020, H: 0xa8bce8, b: 0x4a5a8c, d: 0x2c3558, w: 0xffe27a }
const SHIP = P2(['.........oooooo.......', '......oooHHHHHHoooo...', '....ooHHbbbbbbbbHHoo..', '..ooHbbbbbbbbbbbbbbHoo', 'ooHHbbwbwbwbwbwbbbbbHo', 'oHbbbbddddddddddbbbbbo',
  'ooHbbbbbbbbbbbbbbbbHoo', '.ooHbbbddbbbbddbbbHoo.', '..ooHHbbbbbbbbbbHHoo..', '....oooHHHHHHHHHooo...', '.......oooooooooo.....'], SHP)
LANES.cmarvel = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 3.55 : t0 % TT
  const shx = Math.round(W * 0.52), shy = 0, hullL = shx + 4, hullR = shx + 40, home = Math.round(W * 0.14), park = Math.min(W - 40, shx + 54)
  ground(cv, y0)
  let cx: number
  if (t < 1.2) cx = -32 + (home + 32) * ease(t / 1.2)
  else if (t < 2.4) cx = home
  else if (t < 3.2) cx = lerp(home, hullL - 18, ((t - 2.4) / 0.8) ** 2)
  else if (t < 3.35) cx = hullL - 18
  else if (t < 3.95) cx = lerp(hullL - 18, park, ease((t - 3.35) / 0.6))
  else if (t < 7.0) cx = park
  else cx = lerp(park, W + 40, ((t - 7.0) / 1.0) ** 2)
  const cy = 3 + (t < 1.2 ? Math.sin(t * 5) * 0.6 : 0) + (t >= 3.95 && t < 7 ? Math.sin(t * 3) * 0.5 : 0)
  const ign = seg(t, 1.2, 2.4), bin = t >= 1.5 && (t < 7.0) ? 1 : 0
  // ship (stays until it blows)
  const dead = t >= 4.1
  if (!dead) {
    const shake = t >= 3.3 ? Math.round((hs(Math.floor(t * 30)) - 0.5) * 2) : 0
    spr(cv, y0, SHIP, shx + shake, 0, t >= 3.6 ? { tint: 0xff8a30, tintAmt: 0.15 + 0.3 * seg(t, 3.6, 4.1) } : {})
    // damage: glowing crack lines and the punched hole
    if (t >= 3.3) { const k = seg(t, 3.3, 4.1); for (let i = 0; i < 18; i++) { const px = shx + 6 + i * 2, py = 2 + (hs(i * 3.3) * 7); lit(cv, y0, px, py, 0xffa040, 0.3 + 0.6 * k) } }
    if (t >= 3.3) { rad(cv, y0, hullL + 6, 5, 6, 0xffb040, 0.8); for (const [hx, hy] of [[0, 3], [1, 4], [2, 5], [3, 4], [4, 3], [2, 6], [0, 6]] as const) dot(cv, y0, hullL + 3 + hx * 2, hy + 1, 0x0d0610) }
    if (t >= 3.5 && t < 4.1) { const k = seg(t, 3.5, 4.1); boom(cv, y0, shx + 14, 5, seg(t, 3.55, 3.95), 6); boom(cv, y0, shx + 30, 4, seg(t, 3.75, 4.1), 6); void k }
  } else {
    boom(cv, y0, shx + 22, 5, seg(t, 4.1, 5.9), 22)
    debris(cv, y0, shx + 22, 5, 4.15, t, 14, 3, 56, 0x8aa0d0, 0xff8a30)
    if (t > 4.6 && t < 7.4) for (let q = 0; q < 6; q++) { const d = t - 4.6 - q * 0.25; if (d < 0) continue; dot(cv, y0, shx + 10 + q * 5 + Math.sin(d * 2 + q) * 2, 7 - d * 1.8, 0x70689c, Math.max(0, 0.7 - d * 0.2)); dot(cv, y0, shx + 11 + q * 5, 7 - d * 1.8, 0x9490c0, Math.max(0, 0.5 - d * 0.18)) }
  }
  // carol
  if (ign > 0 && t < 7.0) { // binary aura
    const a = t < 2.4 ? ign : 1
    rad(cv, y0, cx + 14, 4, 9 + 3 * Math.sin(t * 12), 0xffb830, 0.55 * a); rad(cv, y0, cx + 14, 4, 5, 0xfff7c0, 0.5 * a)
    if (t < 2.4) { ellipse(cv, y0, cx + 14, 4, 6 + ign * 22, 3 + ign * 6, 0xffe27a, 0.8 * (1 - ign * 0.6)); for (let i = 0; i < 6; i++) { const A = i * 1.05 + t * 4, r = 14 * (1 - (ign * 1.6 + i * 0.15) % 1); plus(cv, y0, cx + 14 + Math.cos(A) * r * 1.7, 4 + Math.sin(A) * r * 0.55, 0xffe27a, 0.9) } }
  }
  if (t >= 2.4 && t < 3.4) { for (let r = 1; r < 10; r += 1) { const L = 10 + hs(r) * 18; for (let i = 0; i < L; i++) lit(cv, y0, cx + 4 - i * 1.3, r + 0.5, i < 4 ? 0xfff0a0 : 0xff8a30, 0.8 * (1 - i / L)) } }
  if (t >= 3.2 && t < 3.55) { rad(cv, y0, hullL + 2, 5, 9 * (1 - (t - 3.2) / 0.5), 0xffffff, 0.95); for (let i = 0; i < 8; i++) { const A = i * 0.785, r = 5 + (t - 3.2) * 40; plus(cv, y0, hullL + 4 + Math.cos(A) * r * 1.7, 5 + Math.sin(A) * r * 0.6, 0xfff7c0, 0.9) } }
  if (t >= 3.4 && t < 4.4) for (let i = 0; i < 12; i++) lit(cv, y0, cx - 2 - i * 1.5, 3 + (i % 3), 0xffb030, 0.6 * (1 - i / 12))
  shadow(cv, y0, cx + 6, 20, 0.5)
  spr(cv, y0, CMF, cx, cy, bin ? { tint: 0xfff0a0, tintAmt: 0.2 } : {})
  if (bin) for (let i = 0; i < 5; i++) { const A = ((t * 6 + i * 1.3) % 3) / 3; lit(cv, y0, cx + 10 - A * 12, cy - 1 - A * 3, 0xff7a20, 0.9 * (1 - A)) } // flaring hair embers
  if (t >= 7.0) speedL(cv, y0, cx, 0xffd060, 0.6, t, [2, 4, 6])
}

// ----- Bucky: the Winter Soldier highway ambush. Bucky strides in, metal arm whirring; Cap hurls the shield over a taxi; Bucky CATCHES it with the metal hand (CLANG, sparks), hurls it back, rips the car door off and blocks the next throw with it (CLANG), then backs away. -----
const BKH = (arm: number, leg: number) => {
  const g = [
    '..kkkk........', '.kkKkkk.......', '.kkssek.......', '.kkmmmm.......', '.kkmmM........', '..jjjjjj......', '.jjJjjjjj.....',
    '.jjjjjjj......', '.jjjjjj.......', '..jjjjj.......', leg ? '.jj...jj......' : '..jj.jj.......', leg ? '.oo...oo......' : '..oo.oo.......'].map(r => r.split(''))
  const put = (x: number, y: number, c: string) => { if (g[y]) { while (g[y]!.length <= x) g[y]!.push('.'); g[y]![x] = c } }
  const row = (y: number, x: number, s: string) => [...s].forEach((c, i) => { if (c !== '.') put(x + i, y, c) })
  put(5, 5, 'r'); put(6, 5, 'A')
  if (arm === 0) { row(6, 6, 'A'); row(7, 6, 'd'); row(8, 6, 'A'); row(9, 6, 'a'); row(10, 6, 'A') }
  if (arm === 1) { row(5, 6, 'A'); row(4, 7, 'd'); row(3, 8, 'A'); row(2, 9, 'AA') }
  if (arm === 2) { row(5, 6, 'A'); row(5, 7, 'dAAdAAdA'); row(4, 14, 'A'); row(5, 14, 'AA'); row(6, 14, 'A') }
  return g.map(r => r.join(''))
}
const BKL = { ...BK_PAL, o: 0x2a2a48, m: 0x2c2a3c, M: 0x5a5a82, k: 0x7a5240, K: 0xc29468, s: 0xe0b090, S: 0xa87858, e: 0xd8f0ff, j: 0x4a5e98, J: 0x7a92d0, b: 0x3a3a4e }
const BKS = [P2(BKH(0, 0), BKL), P2(BKH(0, 1), BKL), P2(BKH(1, 0), BKL), P2(BKH(2, 0), BKL)]
const mkShield = (w: number, h: number) => { // round vibranium shield, face on
  const rows: string[] = []
  for (let y = 0; y < h; y++) { let r = ''; for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2), d = Math.sqrt(dx * dx + dy * dy)
    r += d > 1 ? '.' : d < 0.38 ? (Math.abs(dx) < 0.18 && Math.abs(dy) < 0.5 || Math.abs(dy) < 0.2 && Math.abs(dx) < 0.45 ? 'w' : 'b') : d < 0.62 ? 'r' : d < 0.82 ? 'W' : 'R' } rows.push(r) }
  return rows
}
const SHD = mkShield(16, 7)
const CAPH = ['..oooo..', '.obbbbo.', '.obwbso.', '.obbssso'.slice(0, 8), '..obbb..', '.ooRbbo.', 'ooRRbbb.', 'oRRRbbb.', '.RRRbb..', '..bbbb..', '..bb.bb.', '..oo.oo.'].map(r => r.padEnd(8, '.'))
const CAPG = CAPH.map(r => '.'.repeat(5) + [...r.slice(0, 8)].map(c => c + c).join('').slice(0, 11))
const capRows = (shy: number) => CAPG.map((r, j) => { const s = SHD[j - shy]; return s ? [...r].map((c, i) => i < 16 && s[i] !== '.' ? s[i]! : c).join('') : r })
const CAP_PAL = { o: 0x2a3a78, b: 0x2c52c8, w: 0xffffff, W: 0xf0f0f8, s: 0xf2c09c, R: 0xe0283a, r: 0xe0283a }
const CAPS = [P(capRows(4).map(r => r.padEnd(27, '.')), CAP_PAL), P(capRows(99).map(r => r.padEnd(27, '.')), CAP_PAL)]
const SHF = [14, 9, 4, 9].map(w => P(mkShield(w, 5), CAP_PAL))
const CAR_PAL = { o: 0x0c0a16, y: 0xf0a824, Y: 0xffd060, d: 0xa86412, g: 0x9fd8ff, G: 0x5a9ac8, w: 0x101018, h: 0xc8ccdc, i: 0x2a1a10, l: 0xfff0a0 }
const carRows = (door: boolean) => {
  const g = Array.from({ length: 7 }, () => Array<string>(34).fill('.'))
  const at = (y: number, x0: number, s: string) => [...s].forEach((c, i) => { if (c !== '.') g[y]![x0 + i] = c })
  at(0, 9, 'oooooooooooooo'); at(1, 7, 'oYgggggYgggggggYo'); at(2, 2, 'o' + 'Y'.repeat(29) + 'o'); at(3, 1, 'o' + 'y'.repeat(30) + 'lo')
  at(4, 1, 'o' + 'y'.repeat(31) + 'o'); at(5, 1, 'o' + 'd'.repeat(31) + 'o'); at(6, 5, 'ooowwwwoo'); at(6, 22, 'ooowwwwoo'); at(5, 6, 'whhw'); at(5, 23, 'whhw'); at(6, 6, 'whhw'); at(6, 23, 'whhw')
  if (door) { for (let y = 2; y <= 4; y++) { g[y]![5] = 'd'; g[y]![15] = 'd' } at(3, 13, 'h') }
  else { for (let y = 1; y <= 4; y++) for (let x = 5; x <= 15; x++) g[y]![x] = 'i' }
  return g.map(r => r.join(''))
}
const CARS = [P(carRows(true), CAR_PAL), P(carRows(false), CAR_PAL)]
const DOOR = P(['.oooooooo.', 'oYgggggGYo', 'oyggggGGyo', 'oyyyyyyhyo', 'oyyyyyyyyo', 'oddddddddo'], CAR_PAL)
const sparks = (cv: Canvas, y0: number, ix: number, iy: number, d: number, seed: number) => { // CLANG flash + radiating sparks
  if (d < 0 || d > 0.9) return
  if (d < 0.14) rad(cv, y0, ix, iy, 9, 0xffffff, 0.95 * (1 - d / 0.14))
  rad(cv, y0, ix, iy, 6, 0xffd060, 0.5 * (1 - d / 0.9))
  for (let i = 0; i < 9; i++) { const A = i * 0.7 + hs(seed + i) * 0.5, r = 3 + 12 * ease(Math.min(1, d / 0.5)); if (d < 0.6) plus(cv, y0, ix + Math.cos(A) * r * 1.8, iy + Math.sin(A) * r * 0.7 + 4 * d * d, i % 2 ? 0xffffff : 0xffc040, 1 - d / 0.6) }
  const k = d / 0.5; if (k < 1) ellipse(cv, y0, ix, iy, 2 + k * 14, 1 + k * 5, 0xffffff, 0.9 * (1 - k))
}
LANES.bucky = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 2.9 : t0 % TT
  const bx = Math.round(W * 0.16), carx = Math.round(W * 0.42), capx = Math.round(W * 0.72), ripx = carx - 32
  ground(cv, y0)
  // Bucky: walk in, catch, hurl, step to car, rip door, hold door, retreat
  let x = bx, pose = 0
  if (t < 1.4) { x = -26 + (bx + 26) * seg(t, 0, 1.4); pose = Math.floor(t * 8) % 2 }
  else if (t < 2.3) pose = 0
  else if (t < 3.3) { pose = 3; x = bx + 2 }
  else if (t < 3.7) { pose = 2; x = bx + 2 }
  else if (t < 4.5) { pose = 0; x = lerp(bx + 2, ripx, ease(seg(t, 3.7, 4.5))); if (t < 4.4) pose = Math.floor(t * 8) % 2 }
  else if (t < 5.4) { pose = 3; x = ripx }
  else if (t < 7.0) { pose = 3; x = ripx - 3 * Math.sin(Math.min(1, Math.max(0, t - 6.0) * 3) * Math.PI) }
  else { pose = Math.floor(t * 8) % 2; x = ripx - seg(t, 7.0, 8) * (ripx + 28) }
  const hasDoor = t < 4.5 || calm
  const doorOn = t >= 4.9 && t < 7.0 ? 1 : 0 // held
  // car (with its door until ripped)
  const ripD = t - 4.5
  const shake = ripD > 0 && ripD < 0.6 ? Math.round((hs(Math.floor(t * 30)) - 0.5) * 2) : 0
  spr(cv, y0, CARS[hasDoor || (t < 4.9) ? (t < 4.5 ? 0 : 1) : 1]!, carx + shake, 4)
  // Cap: shield thrown at 1.6 and 6.1; catches returning shield at 4.3 and 7.0
  const noShield = (t >= 1.6 && t < 4.3) || (t >= 6.1 && t < 7.0)
  spr(cv, y0, CAPS[noShield ? 1 : 0]!, capx, 0)
  shadow(cv, y0, x + 2, 16, 0.5)
  const fl = pose === 3 && t < 2.6 && Math.floor(t * 12) % 2 === 0 ? { tint: 0xffffff, tintAmt: 0.12 } : {}
  spr(cv, y0, BKS[pose]!, x, 0, fl)
  // arm whirr glints while Bucky winds up
  if (t >= 0.9 && t < 2.3) { const g = (t * 9) % 1; lit(cv, y0, x + 6 + g * 8, 5, 0xffffff, 0.6); lit(cv, y0, x + 6 + g * 8 + 3, 6, 0xbfd8ff, 0.4) }
  // shield flights (spinning), Cap -> Bucky and Bucky -> Cap
  const fly = (a: number, b: number, xa: number, xb: number, ya: number) => {
    if (t < a || t >= b) return
    const k = (t - a) / (b - a), fx = lerp(xa, xb, k), fy = ya - Math.sin(k * Math.PI) * 1.5
    for (let i = 1; i < 6; i++) { const kk = k - i * 0.03; if (kk > 0) lit(cv, y0, lerp(xa, xb, kk) + 7, fy + 2.5, 0xbfd8ff, 0.4 * (1 - i / 6)) }
    spr(cv, y0, SHF[Math.floor(t * 18) % 4]!, fx, fy)
  }
  fly(1.6, 2.4, capx, x + 20, 1)
  fly(3.5 - 0.0, 4.3, bx + 22, capx, 1)
  fly(6.1, 6.6, capx, ripx + 24, 2)
  fly(6.6, 7.0, ripx + 24, capx + 2, 2)
  if (pose === 3 && t < 3.3) spr(cv, y0, SHF[0]!, x + 24, 3) // caught shield held in the metal hand
  if (pose === 2) spr(cv, y0, SHF[0]!, x + 30, 2)
  // car door: ripped off (flies to Bucky's hand), then held as a shield
  if (t >= 4.5 && t < 4.9) { const k = ease(seg(t, 4.5, 4.9)); spr(cv, y0, DOOR, lerp(carx + 5, ripx + 24, k), lerp(5, 3, k) - Math.sin(k * Math.PI) * 2) }
  if (doorOn) spr(cv, y0, DOOR, x + 24, 3)
  if (t >= 4.5 && t < 5.1) for (let i = 0; i < 4; i++) plus(cv, y0, carx + 5 + hs(i + Math.floor(t * 20)) * 8, 3 + hs(i * 3) * 4, 0xffd060, 0.9) // metal-screech sparks
  // CLANG impacts: catch, shield returns to Cap, door block
  sparks(cv, y0, x + 26, 4, t - 2.4, 1)
  sparks(cv, y0, capx + 2, 4, t - 4.3, 7)
  sparks(cv, y0, ripx + 28, 5, t - 6.1 - 0.5 + 0.0, 13)
}
