// Hand-drawn pixel art: Black Panther, Vision, Loki, Ultron, JARVIS (see ../portraits.ts).
import { pixmap, type LaneArt, type StageArt } from './pixmap'
import { CLEAR, type Canvas, type HiSprite } from '../pixel'
export const STAGES: Partial<Record<string, StageArt>> = {}
export const LANES: Partial<Record<string, LaneArt>> = {}

// Mirror a left half (18 wide; short rows are padded with their last char) into 36 columns.
const mirror = (rows: string[], sw?: (s: string) => string, hw = 18) => rows.map(r => {
  const p = r.padEnd(hw, r[r.length - 1]); return p + [...p].reverse().join('')
}).map(r => sw ? sw(r) : r)
const frame = (n: number, t: number, speed: number) => Math.floor(t * speed) % n

// ---------- Black Panther ----------
const PAN_PAL = { o: 0x0a0818, b: 0x373060, h: 0x7358d0, v: 0xa970ff, w: 0xffffff, s: 0xe2e5ff, d: 0x8a92bd, p: 0x6d3fd0 }
const PAN = mirror([
  '.....oo.', '.....ohbo.', '.....ohbbo.', '.....ohbbboooo', '.....ohbbbbbbbbb',
  '....ohbbbbbbbbbb', '....ohbbwwwbbbbb', '....ohbbbbbwwwwb', '....ohbbbbbbbbbb',
  '.....ohbbbbbbbbb', '......ohbbbbbbbb', '.......ooobbbbbb', '..oooooooodsdsds', '.ohbbbpbooosvsvs'
])
const PAN_A = pixmap(PAN, PAN_PAL)
const PAN_B = pixmap(PAN.map((r, i) => (i === 6 || i === 7) ? r.replace(/w/g, 'b') : r), PAN_PAL)
STAGES.panther = (cv, t, calm) => {
  const pu = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.4), br = !calm && Math.sin(t * 1.8) > 0.5 ? -1 : 0
  cv.radial(9, 7, 8, 0x8a4dff, 0.25 + 0.2 * pu)
  const blink = !calm && (t % 3.6) > 3.4
  cv.hi(blink ? PAN_B : PAN_A, 0, br)
  if (!calm) { const k = Math.floor(t * 14) % 44 - 4; for (let i = 0; i < 4; i++) { const x = k - i; if (x >= 4 && x < 32) { cv.setSub(x, 12 + br, i === 0 ? 0xffffff : 0xcfa8ff); cv.glowSub(x, 11, 0xa970ff, 0.5 - i * 0.12) } } } // purple kinetic ripple along the necklace
}

// ---------- Vision ----------
const VIS_PAL = { o: 0x340a22, r: 0xc92b50, h: 0xff6f80, d: 0x86193f, g: 0xf7c948, G: 0xb8861e, e: 0x2cb06c, n: 0x146a40, y: 0xffe94d, w: 0xfff4c0 }
const VIS = mirror([
  '..........oooo', '........oorrhhhh', '......oorrrhhhhrr', '.....orrrggrrrrrry',
  '.....orrrrggrrrrry', '....orgrrrrrrrrrrr', '....orgrrdddrrrrrr', '....orgrrrwwwwrrr',
  '....orgrrrrrrrrrr', '.....orrrdrrrrrrr', '......orrrrdrrrrr', '.....ooooggoooooo',
  '...oonneeeeggeeee', '.oonneegeegeegeeg',
])
const VIS_A = pixmap(VIS, VIS_PAL)
STAGES.vision = (cv, t, calm) => {
  const pu = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3), br = !calm && Math.sin(t * 1.8) > 0.5 ? -1 : 0
  cv.radial(9, 4, 6, 0xffe14a, 0.15 + 0.35 * pu)
  cv.hi(VIS_A, 0, br)
  if (!calm && (t % 3.3) > 3.12) for (const x of [10, 11, 12, 13, 22, 23, 24, 25]) cv.setSub(x, 7 + br, 0xc92b50)
  cv.glowSub(17, 3 + br, 0xffffff, 0.2 + 0.6 * pu); cv.glowSub(18, 3 + br, 0xffffff, 0.2 + 0.6 * pu); cv.glowSub(16, 3 + br, 0xffe14a, 0.5 * pu); cv.glowSub(19, 3 + br, 0xffe14a, 0.5 * pu)
}

// ---------- Loki ----------
const LOK_PAL = { o: 0x1a1226, G: 0xf0b92c, g: 0xa8741a, H: 0xffe98a, s: 0xecdfcb, k: 0xb8a28c, a: 0x14141e, e: 0x1f9a58, n: 0x0f4a30, c: 0x7cf0ff }
const LOK = mirror([
  '.HG.', '.HGg.', '..HGg.', '...HGGg..gGGGGGGGGG', '....HGGGGgGGGGGGGHG',
  '.....gaaaGsssssssss', '....aaaaassssssss', '....aaaasaaasssaaa', '....aaaasseeesssss',
  '....aaaassskssssss', '.....aaasssssssss', '...aaaaaassskkkkks', '..aaaaaoeeeeeeeeee',
  '.aaaaaoennGeGeGeGe',
])
const LOK_A = pixmap(LOK, LOK_PAL)
STAGES.loki = (cv, t, calm) => {
  const pu = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3.2), br = !calm && Math.sin(t * 1.8) > 0.5 ? -1 : 0
  cv.radial(16, 2.5, 2.5, 0x58e6ff, 0.12 + 0.2 * pu)
  cv.hi(LOK_A, 0, br)
  if (!calm && (t % 3.7) > 3.52) for (const x of [10, 11, 12, 23, 24, 25]) cv.setSub(x, 8 + br, 0xecdfcb)
  if (!calm && (t % 5) > 3.6 && (t % 5) < 4.8) for (const x of [20, 21, 22, 23]) { cv.setSub(x, 11 + br, 0xecdfcb); cv.setSub(x, 10 + br, 0xb8a28c) } // smirk
  if (!calm) { const g = Math.max(0, Math.sin(t * 2.2)); if (g > 0.5) { cv.setSub(2, 1 + br, 0xffffff); cv.glowSub(2, 1 + br, 0xffffff, g); cv.glowSub(3, 2 + br, 0xffe98a, g * 0.6) } } // horn glint
  for (let y = 6; y < 14; y++) { cv.setSub(32, y, y % 3 === 0 ? 0xffe98a : 0xc99a2a) }
  cv.glowSub(32, 4, 0xa8f6ff, 0.5 + 0.5 * pu); cv.glowSub(32, 5, 0x58e6ff, 0.6 + 0.4 * pu); cv.glowSub(31, 5, 0x58e6ff, 0.3 * pu); cv.glowSub(33, 5, 0x58e6ff, 0.3 * pu)
}

// ---------- Ultron ----------
const ULT_PAL = { o: 0x12142a, c: 0xcfd6e6, C: 0xf6f9ff, m: 0x8e98b6, d: 0x4a5272, k: 0x080812, r: 0xff3030, R: 0x9a1020 }
const ULT = mirror([
  '.......oooooo', '.....ooccCCCCCC', '....occcccCCCCc', '....ocmmmmmmmmmm', '....ocdkkkkkkkkk',
  '....ocdkrrrrkkkk', '....occddkkkkkkk', '....occcccccccmd', '.....ocmcccccccc', '.....odrCrCrCrCr',
  '.....odCrCrCrCrC', '......ocmmmmmmmm', '....ooodddddddd', '..ooddddmmddmdmd',
])
const ULT_A = pixmap(ULT, ULT_PAL)
STAGES.ultron = (cv, t, calm) => {
  const pu = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2.6), br = !calm && Math.sin(t * 1.8) > 0.5 ? -1 : 0
  cv.radial(9, 5, 7, 0xff2020, 0.1 + 0.18 * pu)
  cv.hi(ULT_A, 0, br)
  if (!calm && (t % 4.1) > 3.95) for (const x of [8, 9, 10, 11, 24, 25, 26, 27]) cv.setSub(x, 5 + br, 0x080812)
  if (!calm && (t % 4) > 2 && (t % 4) < 3.4) { const ph = Math.floor(t * 9) % 2; for (let x = 10; x < 26; x++) for (const y of [9, 10]) cv.setSub(x, y + br, ((x + ph) & 1) ? 0xff3030 : 0x5a1020) } // talking mouth slats
  for (const x of [8, 9, 10, 11]) { cv.glowSub(x * 2 - 6, 5, 0xff4040, 0.2 + 0.5 * pu); cv.glowSub(36 - (x * 2 - 6) - 1, 5, 0xff4040, 0.2 + 0.5 * pu) }
}

// ---------- JARVIS: a rotating blue holographic wireframe head ----------
const JW = 36, JH = 14, JN = 8
const taper = (_l: number) => 1
function jarvisFrame(f: number, blink: boolean): HiSprite {
  const I = new Float32Array(JW * JH), cx = 17.5, cy = 5.4, rx = 12.5, ry = 5.2
  const put = (x: number, y: number, v: number) => { const xi = Math.round(x), yi = Math.round(y); if (xi >= 0 && xi < JW && yi >= 0 && yi < JH) I[yi * JW + xi] = Math.max(I[yi * JW + xi]!, v) }
  const rad = Math.PI / 180, phase = (f / JN) * 30 * rad
  for (let k = 0; k < 6; k++) { // meridians
    const a = k * 30 * rad + phase
    for (let l = -90; l <= 90; l += 2) {
      const L = l * rad, x = cx + rx * taper(L) * Math.cos(L) * Math.sin(a), y = cy - ry * Math.sin(L)
      put(x, y, Math.cos(a) * Math.cos(L) > 0 ? 0.5 : 0.26)
    }
  }
  for (const lat of [-60, -30, 0, 30, 60]) { // parallels
    const L = lat * rad, hw = rx * taper(L) * Math.cos(L), y = cy - ry * Math.sin(L)
    for (let a = 0; a < 360; a += 3) { const A = a * rad; put(cx + hw * Math.sin(A), y, Math.cos(A) > 0 ? 0.5 : 0.24) }
  }
  for (let l = -90; l <= 90; l += 1) { const L = l * rad, hw = rx * taper(L) * Math.cos(L), y = cy - ry * Math.sin(L); put(cx - hw, y, 0.95); put(cx + hw, y, 0.95) } // silhouette
  const px = new Int32Array(JW * JH).fill(CLEAR), a = new Uint8Array(JW * JH)
  for (let y = 0; y < JH; y++) for (let x = 0; x < JW; x++) {
    const i = y * JW + x, v = I[i]!, nx = (x + 0.5 - cx - 0.5) / rx, ny = (y + 0.5 - cy) / ry
    if (v > 0) {
      px[i] = v > 1 ? 0xf2fdff : v > 0.85 ? 0xb4f0ff : v > 0.45 ? 0x4cc6f2 : 0x24679c; a[i] = 255
    } else if (nx * nx + ny * ny < 0.96) { px[i] = 0x123a62; a[i] = 110 }
  }
  return { w: JW, h: JH, px, a }
}
const JARV: HiSprite[] = [], JARV_B = jarvisFrame(0, true)
for (let f = 0; f < JN; f++) JARV.push(jarvisFrame(f, false))
STAGES.jarvis = (cv, t, calm) => {
  const pu = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 3)
  cv.radial(17.5, 5.5, 8, 0x2aa8ff, 0.18 + 0.12 * pu)
  cv.hi(JARV[calm ? 0 : frame(JN, t, 5)]!, 0, 0)
  if (!calm) { const y = Math.floor((t * 5) % 16) - 1; if (y >= 0 && y < 11) for (let x = 6; x < 30; x++) cv.glowSub(x, y, 0x9be8ff, 0.2) } // scanline sweep
  const amp = calm ? 0.7 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2)) * (0.6 + 0.4 * Math.sin(t * 7)) // voice waveform under the globe
  for (let x = 3; x < 33; x++) { const env = Math.sin(((x - 3) / 30) * Math.PI), y = 12.4 + Math.sin(x * 0.9 - t * 9) * amp * 1.3 * env; cv.setSub(x, Math.max(11, Math.min(13, Math.round(y))), amp > 0.8 ? 0xe8fbff : 0x9be8ff); cv.glowSub(x, 12, 0x2aa8ff, 0.2 * env) }
}

// ---------- Lanes (12 subpixels tall, full width, 8 s stories) ----------
const LH = 12
const hs = (n: number) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x) }
const cl01 = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v
const seg = (t: number, a: number, b: number) => cl01((t - a) / (b - a)) // 0..1 progress of t within [a,b]
const ease = (k: number) => 1 - (1 - k) ** 3
const dot = (cv: Canvas, y0: number, x: number, y: number, c: number, a = 1) => { y = Math.round(y); if (y < 0 || y >= LH) return; if (a >= 1) cv.setSub(Math.round(x), y0 + y, c); else if (a > 0.02) cv.blendSub(Math.round(x), y0 + y, c, a) }
const lit = (cv: Canvas, y0: number, x: number, y: number, c: number, a: number) => { y = Math.round(y); if (y >= 0 && y < LH && a > 0.02) cv.glowSub(Math.round(x), y0 + y, c, a) }
// Draw a sprite only if it fits the lane vertically (never leaks above/below the lane rows).
const spr = (cv: Canvas, y0: number, s: HiSprite, x: number, y: number, o: { tint?: number; tintAmt?: number; alpha?: number; flip?: boolean } = {}) => {
  y = Math.round(y); if (y < 0) y = 0; if (y + s.h > LH) y = LH - s.h
  cv.hi(s, Math.round(x) / 2, y0 + y, o)
}
const ground = (cv: Canvas, y0: number) => { const W = cv.W; for (let x = 0; x < W; x++) dot(cv, y0, x, LH - 1, x % 6 < 4 ? 0x3a3a62 : 0x2c2c4e, 1) }
// A deliberate plus-shaped spark.
const plus = (cv: Canvas, y0: number, x: number, y: number, c: number, a: number) => { dot(cv, y0, x, y, c, a); dot(cv, y0, x - 1, y, c, a * 0.7); dot(cv, y0, x + 1, y, c, a * 0.7); dot(cv, y0, x, y - 1, c, a * 0.7); dot(cv, y0, x, y + 1, c, a * 0.7) }
// Dust puff at ground position x; k 0..1 is its age.
const puff = (cv: Canvas, y0: number, x: number, k: number, dir = 1) => {
  if (k <= 0 || k >= 1) return
  for (let i = 0; i < 3; i++) { const px = x + dir * (i * 3 + k * 6), py = LH - 2 - k * (1.5 + i * 0.8); dot(cv, y0, px, py, 0x7a74a4, 0.7 * (1 - k)); dot(cv, y0, px + 1, py, 0x9892c4, 0.5 * (1 - k)) }
}
const speed = (cv: Canvas, y0: number, x: number, c: number, n: number, t: number) => { // horizontal speed streaks trailing left of x
  for (const r of [1, 3, 5, 8]) { const L = 6 + ((r * 7) % 5) * 3, o = Math.floor(t * 20 + r) % 3 * 2; for (let i = 0; i < L; i++) dot(cv, y0, x - 4 - o - i * 1.4, r, c, n * (1 - i / L) * 0.6) }
}
function ellipse(cv: Canvas, y0: number, cx: number, cy: number, rx: number, ry: number, c: number, a: number, a0 = 0, a1 = Math.PI * 2) {
  const n = Math.max(12, Math.round(rx * 1.6))
  for (let i = 0; i < n; i++) { const A = a0 + (i / n) * (a1 - a0); lit(cv, y0, cx + Math.cos(A) * rx, cy + Math.sin(A) * ry, c, a) }
}
const P = pixmap
const half = (rows: string[]) => rows.map(r => r + [...r].reverse().join(''))
const P2 = (rows: string[], pal: Record<string, number>) => pixmap(rows.map(r => [...r].map(ch => ch + ch).join('')), pal) // double width: figures read better on tall pixels
// Pixel dissolve: erodes a sprite and emits green plus-shaped sparkles (precomputed at load).
type Dis = { n: number; x: Int16Array; y: Int16Array; c: Int32Array; r: Float32Array; pn: number; px: Int16Array; py: Int16Array; pr: Float32Array; pc: Int32Array; w: number }
const mixc = (a: number, b: number, k: number) => { const f = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k); return (f(16) << 16) | (f(8) << 8) | f(0) }
function mkDis(s: HiSprite, tint: number, amt: number): Dis {
  const X: number[] = [], Y: number[] = [], C: number[] = [], R: number[] = [], PX: number[] = [], PY: number[] = [], PR: number[] = [], PC: number[] = []
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const c = s.px[j * s.w + i]!; if (c === CLEAR || (s.a[j * s.w + i] ?? 255) < 100) continue
    const r = 0.75 * hs(i * 7.3 + j * 13.1) + 0.25 * (1 - j / s.h); X.push(i); Y.push(j); C.push(mixc(c, tint, amt)); R.push(r)
    if ((i + j * 2) % 7 === 0) { PX.push(i); PY.push(j); PR.push(r); PC.push(hs(i + j * 9) > 0.5 ? 0xa6ffcf : 0x3cd98a) }
  }
  return { n: X.length, x: Int16Array.from(X), y: Int16Array.from(Y), c: Int32Array.from(C), r: Float32Array.from(R), pn: PX.length, px: Int16Array.from(PX), py: Int16Array.from(PY), pr: Float32Array.from(PR), pc: Int32Array.from(PC), w: s.w }
}
function drawDis(cv: Canvas, y0: number, d: Dis, x: number, y: number, k: number, flip = false, a = 0.85) {
  for (let i = 0; i < d.n; i++) if (d.r[i]! > k) dot(cv, y0, x + (flip ? d.w - 1 - d.x[i]! : d.x[i]!), y + d.y[i]!, d.c[i]!, a)
  for (let i = 0; i < d.pn; i++) { const tp = (k - d.pr[i]!) / 0.4; if (tp <= 0 || tp >= 1) continue
    const sx = flip ? d.w - 1 - d.px[i]! : d.px[i]!, dx = (hs(i * 3.1) - 0.5) * 16 * tp
    plus(cv, y0, x + sx + dx, y + d.py[i]! - tp * 7, d.pc[i]!, 1 - tp) }
}
// Lane-clipped soft radial light (same falloff as Canvas.radial but never outside [y0, y0+12)).
const rad = (cv: Canvas, y0: number, cx: number, cy: number, r: number, c: number, a = 1) => {
  const r2 = r * r
  for (let y = Math.max(y0, Math.floor(cy - r)); y <= Math.min(y0 + LH - 1, Math.ceil(cy + r)); y++) for (let xs = Math.floor((cx - r / 0.8276) * 2); xs <= Math.ceil((cx + r / 0.8276) * 2); xs++) {
    const d2 = (((xs + 0.5) / 2 - cx) * 0.8276) ** 2 + (y + 0.5 - cy) ** 2
    if (d2 < r2) { const f = 1 - Math.sqrt(d2) / r; cv.glowSub(xs, y, c, a * f * f) }
  }
}

// ----- Black Panther: a black panther sprints in and leaps; a purple flash turns him into Black Panther mid-air; he lands in a crouch and soaks two soldiers' shots
// (purple ripples); he slams the ground and a kinetic shockwave rolls out and knocks both soldiers flat. -----
const BPL = { o: 0x9a72ff, b: 0x120d1c, d: 0x2e2450, v: 0xc090ff, s: 0xe8ecff, w: 0xffffff }
const BPH = ['..o...', '..ob..', '..obbb', '.obwwb', '.obbbb', '..obbb', 'ooosss', 'obbsvb', 'obvbbb', 'obbbbb', '.obbvbb', '.obbb..']
const BP_ST = P2(half(BPH), BPL)
const BP_CR = BP_ST
const BP_SL = P2(half(BPH).map((r, i, a) => i >= a.length - 4 ? r + 'vvvvvvvv' : r + '........'), BPL)
const CL = { b: 0x120d1c, p: 0x9a68ff, w: 0xffffff, v: 0xd8bcff }
const CAT_A = P(['.................p.p...', '..pppp..........pbwwbpp', '.pbbbbpppppppppbbbbbbp.', 'pbbbbbbbbbbbbbbbbbbbbpp', '.pp.pbbp.....pbbp.pp...', '.pp...pp......pp...pp..'], CL)
const CAT_B = P(['.................p.p...', '......ppppp.....pbwwbpp', '..ppppbbbbbpppppbbbbbp.', '.pbbbbbbbbbbbbbbbbbbpp.', '....pbbbp.....pbbp.....', '.....pp.........pp.....'], CL)
const CAT_L = P(['.................p.p...', '......pp........pbwwbpp', 'pp.pppbbpppppppbbbbbbp.', 'ppbbbbbbbbbbbbbbbbbbbpp', '..ppbbbbbbbbbbbbpppp...', '.....pp................'], CL)
const SOL = { h: 0x4f6a2a, H: 0x7a9a3c, g: 0x6f8f3a, G: 0x93b64a, s: 0xf0c8a0, k: 0x1a1a24, K: 0x6a6e86, d: 0x39491f }
const SOLDIER = P2(['...hhh..', '..hHHhh.', '..hsshh.', '...ssh..', '..GgGgg.', 'KKkgGggg', '.kkgggg.', '..gggg..', '..g..g..', '..g..g..', '.dd..dd.', '.dd..dd.'], SOL)
const SOLFLAT = P2(['..............', '..............', '.hh.ddd.......', 'hhsGgggggkkKK.', 'hhsgGgggg.....', '.dd.ddd.......'], SOL)
const PURP = 0xb078ff
const PT = 8
LANES.panther = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 6.0 : t0 % PT
  const bx = W * 0.40, SX = [W * 0.70, W * 0.86], gy = LH - 8
  ground(cv, y0)
  // wave front position (shockwave from the slam at 5.6 rolls right)
  const cx0 = bx + 10, wf = cx0 + Math.max(0, t - 5.6) * 60
  // soldiers
  for (let i = 0; i < 2; i++) {
    const x = SX[i]!, fell = t >= 5.6 && wf > x
    if (fell) {
      const d = t - (5.6 + (x - cx0) / 60), hop = d < 0.4 ? Math.sin(d / 0.4 * Math.PI) * 4 : 0
      spr(cv, y0, SOLFLAT, x + Math.min(8, d * 20), LH - 6 - hop)
      if (d < 0.25) { rad(cv, y0, (x + 8) / 2, y0 + 6, 6, 0xffffff, 0.6 * (1 - d / 0.25)); plus(cv, y0, x - 2, 3, PURP, 1 - d / 0.25); plus(cv, y0, x + 18, 3, PURP, 1 - d / 0.25) }
    } else {
      const rec = t >= 3.4 && t < 5.6 ? ((t - 3.4 - i * 0.25) % 1 < 0.1 ? 1 : 0) : 0
      spr(cv, y0, SOLDIER, x + rec, 0)
      if (rec) { lit(cv, y0, x - 2, 5, 0xffb040, 1); plus(cv, y0, x - 3, 5, 0xffffff, 1) }
    }
  }
  // enemy shots (orange) fly left and splash purple on BP's chest
  if (t >= 3.4 && t < 5.6) for (let i = 0; i < 2; i++) for (let n = 0; n < 3; n++) {
    const ts = 3.45 + i * 0.25 + n * 0.8, d = t - ts, x0 = SX[i]! - 3, hit = bx + 22, dur = (x0 - hit) / 90
    if (d < 0 || d > dur + 0.45) continue
    if (d < dur) { const sx = x0 - d * 90; for (let k = 0; k < 6; k++) dot(cv, y0, sx + k, 6, k < 2 ? 0xffffff : k < 4 ? 0xffb040 : 0xe0601a, 1); lit(cv, y0, sx + 1, 6, 0xffa030, 0.7) }
    else { const k = (d - dur) / 0.45; ellipse(cv, y0, hit - 2, 6, 3 + 9 * k, 3 + 3 * k, PURP, 0.9 * (1 - k)); rad(cv, y0, hit / 2, y0 + 6, 5, PURP, 0.6 * (1 - k)) }
  }
  const run = t < 2.0 && !calm
  if (run) {
    const x = -26 + (W * 0.30 + 26) * (t / 2.0), fr = Math.floor(t * 9) % 2
    for (let i = 0; i < 3; i++) { const k = ((t * 3 + i * 0.33) % 1); dot(cv, y0, x - 6 - k * 12, LH - 2 - k * 1.5, 0x8a84b8, 0.7 * (1 - k)); dot(cv, y0, x - 7 - k * 12, LH - 2 - k * 1.5, 0xb0a8e0, 0.5 * (1 - k)) }
    speed(cv, y0, x + 6, 0x6a4ac0, 0.5, t)
    spr(cv, y0, fr ? CAT_A : CAT_B, x, LH - 6)
    lit(cv, y0, x + 20, LH - 5, 0xffffff, 0.5)
  } else if (t >= 2.0 && t < 2.5 && !calm) { // spring: panther in the air
    const k = seg(t, 2.0, 2.5), x = W * 0.30 + k * (bx - W * 0.30) * 0.7, y = LH - 6 - Math.sin(k * Math.PI * 0.5) * 5
    spr(cv, y0, CAT_L, x, y); speed(cv, y0, x + 6, 0x6a4ac0, 0.6, t)
  } else if (t >= 2.5 && t < 2.85 && !calm) { // flash: transformation
    const k = seg(t, 2.5, 2.85), x = bx - 6 + k * 6
    rad(cv, y0, (x + 10) / 2, y0 + 5, 10 + 4 * k, 0xffffff, 0.9 * (1 - k * 0.7)); rad(cv, y0, (x + 10) / 2, y0 + 5, 14, PURP, 0.8)
    spr(cv, y0, k < 0.45 ? CAT_L : BP_ST, k < 0.45 ? x - 4 : x, k < 0.45 ? 0 : 0, { tint: 0xffffff, tintAmt: 0.6 * (1 - k) })
    for (let i = 0; i < 6; i++) { const A = i * 1.05, r = 6 + k * 14; plus(cv, y0, x + 10 + Math.cos(A) * r * 1.6, 5 + Math.sin(A) * r * 0.5, PURP, 1 - k) }
  } else if (t >= 2.85 || calm) {
    const slam = t >= 5.6 && t < 7.0, rise = t >= 5.0 && t < 5.6, stand = t >= 6.6
    const sp = BP_ST
    const land = t >= 2.85 && t < 3.15 && !calm, hit = t >= 3.6 && t < 5.0 && !calm
    const sh = slam && t < 5.75 ? { tint: 0xffffff, tintAmt: 0.5 } : hit && (Math.floor(t * 8) % 2) ? { tint: PURP, tintAmt: 0.3 } : {}
    const px = stand ? bx : bx
    spr(cv, y0, sp, px, land ? LH - sp.h : LH - sp.h, sh)
    if (land) { puff(cv, y0, px, seg(t, 2.85, 3.15), -1); puff(cv, y0, px + 20, seg(t, 2.85, 3.15), 1) }
    if (rise) { const k = seg(t, 5.0, 5.6); for (let i = 0; i < 8; i++) { const A = i * 0.8, r = (1 - ((k * 1.5 + i * 0.13) % 1)) * 12; plus(cv, y0, px + 10 + Math.cos(A) * r * 1.6, 7 + Math.sin(A) * r * 0.5, PURP, 0.9) } rad(cv, y0, (px + 10) / 2, y0 + 7, 4 + 4 * k, PURP, 0.5 * k) }
    // absorb: BP glows brighter purple with each hit, holds, then releases a circular kinetic blast from his chest
    if (!calm && t >= 3.6 && t < 5.6) { const g = seg(t, 3.6, 5.5); rad(cv, y0, cx0 / 2, y0 + 5, 7 + 5 * g, PURP, 0.25 + 0.55 * g); for (let i = 0; i < 3; i++) lit(cv, y0, px + 7 + i * 3, 5, 0xe8d0ff, 0.2 + 0.6 * g) }
    if (slam) { const k = seg(t, 5.6, 7.0) * 0.8, R = wf - cx0
      rad(cv, y0, cx0 / 2, y0 + 5, 12 + R * 0.25, 0xffffff, 0.9 * Math.max(0, 1 - k * 4)); rad(cv, y0, cx0 / 2, y0 + 5, 10 + R * 0.4, PURP, 0.6 * (1 - k))
      for (let j = 0; j < 3; j++) { const rx = R - j * 9; if (rx < 3) continue; const ry = rx * 0.45, a = (1 - k) * (1 - j * 0.25), n = Math.ceil(rx * 5)
        for (let i = 0; i < n; i++) { const A = i / n * Math.PI * 2, X = cx0 + Math.cos(A) * rx, Y = 5 + Math.sin(A) * ry, X2 = cx0 + Math.cos(A) * (rx - 1.2), Y2 = 5 + Math.sin(A) * (ry - 0.5)
          dot(cv, y0, X, Y, j === 0 ? 0xf4eaff : j === 1 ? 0xc89aff : PURP, a); lit(cv, y0, X, Y, PURP, 0.7 * a); dot(cv, y0, X2, Y2, PURP, 0.6 * a) } }
      for (let i = 0; i < 16; i++) { const A = i * 0.3927 + 0.2, r2 = R * (0.7 + 0.35 * hs(i * 3.7)), X = cx0 + Math.cos(A) * r2, Y = 5 + Math.sin(A) * r2 * 0.45; plus(cv, y0, X, Y, i % 2 ? 0xe8d0ff : PURP, 1 - k) } }
    if (stand || calm) { const f = 0.5 + 0.5 * Math.sin(t * 6); lit(cv, y0, bx + 8, 3, 0xffffff, 0.5 * f); lit(cv, y0, bx + 12, 3, 0xffffff, 0.5 * f) }
  }
  if (calm) { spr(cv, y0, SOLFLAT, SX[0]! + 8, LH - 6); spr(cv, y0, SOLFLAT, SX[1]! + 8, LH - 6) }
}

// ----- thinking: "Suit up" (nanotech armour clamps onto Tony one piece at a time, faceplate snaps down, he blasts off) -----
const TP = { o: 0x2a0a10, r: 0xe0402e, R: 0x8a1822, g: 0xf8cc4a, w: 0xffffff, c: 0x9bf0ff, h: 0x2a1c18, s: 0xf0b890, k: 0x30304a, j: 0x2c3558, z: 0x1b1b2c }
const IMF = half(['....oo', '...orr', '...rwg', '...rgg', '....og', '.oorrr', 'orrrrc', 'ogrrRr', 'ogo.rr', '..orrr', '..orr.', '.oggg.'])
const IMO = half(['....oo', '...orr', '...rzs', '...rss', '....sh', '.oorrr', 'orrrrc', 'ogrrRr', 'ogo.rr', '..orrr', '..orr.', '.oggg.'])
const CIV = half(['....hh', '...hhh', '...hzs', '...sss', '....sh', '..kkkk', '.kkkkc', '.skkkk', '.s.kkk', '...jjj', '...jj.', '..jjj.'])
const comp = (st: number) => CIV.map((cr, i) => [...cr].map((cc, j) => {
  const arm = i >= 6 && i <= 8 && (j <= 2 || j >= 9)
  const pick = i <= 4 ? (st >= 5 ? IMF : st === 4 ? IMO : CIV) : i >= 9 ? (st >= 1 ? IMF : CIV) : arm ? (st >= 2 ? IMF : CIV) : (st >= 3 ? IMF : CIV)
  return pick[i]![j]!
}).join(''))
const TS = [0, 1, 2, 3, 4, 5].map(i => P2(comp(i), TP))
const TCROUCH = P2([...Array(2).fill('............'), ...IMF.filter((_, i) => i !== 7 && i !== 9)], TP)
const TFLY = P(['..............oooo....', '.............orwgro...', '......ooooooorrgggro..', '...oooorrrrcrrrrrrrro.', '..ogooorrrrrrrrrrrroo.', '...oggo..orrrro.......', '..............oggo....'], TP)
const GLV = P(['..oooooo....', '.orrrrrroo..', 'orrggrrrrco.', 'orrrrrrrrco.', '.orrrrrroo..', '..oggggo....'], TP)
const TT = 8
LANES.thinking = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 5.0 : t0 % TT, cx = Math.max(30, W * 0.42), A = [2.0, 2.7, 3.4, 4.1]
  ground(cv, y0)
  const st = t < A[0]! ? 0 : t < A[1]! ? 1 : t < A[2]! ? 2 : t < A[3]! ? 3 : t < 4.7 ? 4 : 5
  const gone = t >= 6.1 && !calm
  // armour pieces streak in one at a time, alternating edges: [from x, from y, to x, to y]
  const PC = [[-10, 10, cx + 12, 10], [W + 10, 7, cx + 4, 7], [-10, 5, cx + 12, 6], [W + 10, 1, cx + 12, 2]]
  if (!calm) for (let i = 0; i < 4; i++) {
    const k = seg(t, A[i]! - 0.55, A[i]!), tx = PC[i]![2]!, ty = PC[i]![3]!
    if (k <= 0 || k >= 1) { const d = t - A[i]!; if (d >= 0 && d < 0.3) { const f = 1 - d / 0.3; plus(cv, y0, tx, ty, 0xffffff, f); plus(cv, y0, tx - 4, ty - 1, 0xffd45a, f); plus(cv, y0, tx + 4, ty + 1, 0xffd45a, f); rad(cv, y0, tx / 2, y0 + ty, 5, 0xffd45a, 0.8 * f) } continue }
    const e = k * k, px = PC[i]![0]! + (tx - PC[i]![0]!) * e, py = PC[i]![1]! + (ty - PC[i]![1]!) * e, dir = PC[i]![0]! < 0 ? -1 : 1
    for (let q = 0; q < 26; q++) lit(cv, y0, px - dir * (q * 1.8 + 1), py + 1 + (q > 12 ? hs(q + i) - 0.5 : 0), q < 6 ? 0xffd45a : 0xff7a30, 0.8 * (1 - q / 26))
    for (let q = 0; q < 8; q++) { dot(cv, y0, px + q * dir, py, q < 3 ? 0xf8cc4a : 0xe0402e); dot(cv, y0, px + q * dir, py + 1, 0xe0402e); dot(cv, y0, px + q * dir, py + 2, 0x8a1822) }
  }
  if (gone) {
    const k = seg(t, 6.1, 7.2), x = cx + 4 + (W + 30 - cx) * k * k * k
    if (t < 6.2) rad(cv, y0, (cx + 14) / 2, y0 + 8, 10, 0xffffff, 0.8 * (1 - (t - 6.1) / 0.1))
    if (t < 6.7) { const q = seg(t, 6.1, 6.7); ellipse(cv, y0, cx + 14, 8, q * 50, q * 10, 0xdfe8ff, 0.7 * (1 - q)); puff(cv, y0, cx + 4, seg(t, 6.1, 6.8), -1); puff(cv, y0, cx + 26, seg(t, 6.15, 6.85), 1) }
    const fl = 8 + k * 20 + (hs(Math.floor(t * 40)) * 5)
    for (let i = 0; i < fl; i++) { const a = 1 - i / fl; for (const r of [4, 5]) lit(cv, y0, x - i * 1.1, r, i < 4 ? 0xffffff : i < 10 ? 0xffe27a : 0xff8a30, 0.95 * a) }
    speed(cv, y0, x - 30, 0xffd9a0, 0.8 * k, t)
    spr(cv, y0, TFLY, x, 2)
  } else {
    let s = TS[st]!, x = cx
    if (!calm && t < 1.2) { x = 2 + (cx - 2) * ease(t / 1.2); s = TS[0]!; if (Math.floor(t * 8) % 2) puff(cv, y0, x - 2, (t * 8) % 1, -1) }
    if (!calm && t >= 5.3) { s = TCROUCH; if (t < 6.1) { const q = seg(t, 5.3, 6.1); for (let i = 0; i < 6; i++) lit(cv, y0, cx + 8 + i * 3, LH - 1, 0xff9a30, 0.3 + 0.5 * q); rad(cv, y0, (cx + 6) / 2, y0 + 11, 5, 0xffa040, 0.6 * q); rad(cv, y0, (cx + 18) / 2, y0 + 11, 5, 0xffa040, 0.6 * q) } }
    spr(cv, y0, s, x, 0)
    if (st === 5 || calm) { // eye slits and arc reactor glow; they flash on the faceplate snap
      const snap = !calm && t >= 4.7 && t < 4.95 ? 1 - (t - 4.7) / 0.25 : 0, g = 0.6 + 0.4 * Math.sin(t * 8) + snap
      const ey = s === TCROUCH ? 4 : 2, ry = s === TCROUCH ? 6 : 6
      for (const ex of [8, 9, 14, 15]) lit(cv, y0, x + ex, ey, 0xffffff, Math.min(1, g))
      for (const rx of [10, 11, 12, 13]) lit(cv, y0, x + rx, ry, 0x9bf0ff, Math.min(1, 0.5 + 0.4 * g))
      rad(cv, y0, (x + 12) / 2, y0 + ry, 3 + 2 * snap, 0x9bf0ff, 0.25 + 0.3 * g)
    }
    if (st === 0 && !calm) for (const rx of [10, 11, 12, 13]) lit(cv, y0, x + rx, 6, 0x9bf0ff, 0.5 + 0.3 * Math.sin(t * 5)) // Tony's reactor glows through the tee
  }
  if (!calm && t >= 6.8) { // a stray gauntlet arrives late, finds nobody, clatters
    const k = seg(t, 6.8, 7.35), d = t - 7.35
    let gx = -14 + (cx + 8 + 14) * k, gy = 3
    if (d > 0) { gy = Math.min(LH - 7, 3 + 40 * d * d); const bn = Math.abs(Math.sin(d * 6)) * 3 * Math.exp(-d * 2.5); if (gy >= LH - 7) gy = LH - 7 - bn; gx += d * 8 * Math.exp(-d * 2) }
    if (t < 7.35) for (let q = 0; q < 12; q++) lit(cv, y0, gx - q * 1.6, 5, 0xff8a40, 0.6 * (1 - q / 12))
    spr(cv, y0, GLV, gx, gy)
    if (d > 0.3 && d < 0.7) puff(cv, y0, gx + 4, (d - 0.3) / 0.4, 1)
  }
}

// ----- JARVIS: Iron Man 1 workshop. The silver Mark II hovers up on its boot jets inside a JARVIS HUD ring, wobbles, rockets across the lane, CLANGS into the ceiling beam
// and drops. DUM-E rolls over and smothers it in extinguisher foam. -----
const MK = { o: 0x151830, s: 0xa9b3cc, S: 0xe6ebf8, d: 0x5c6684, e: 0x7df3ff, a: 0xd8fcff, f: 0xff9a30, F: 0xffe27a }
const MKH = ['..ooo', '.osSs', '.oees', '..osd', 'ooSsS', 'osSdsa', 'osdsa', 'osSsa', '.osds', '.osds', '.odod'].map(r => r.slice(0, 5).padEnd(5, '.'))
const MK_ST = P2(half(MKH), MK)
const MK_FLY = P(['..........ooooo.', '..ooooooooosSsso', '.ossSsSsSsSseeso', 'ooddsdsddsdssooo', '.oo..........oo.', '................'], MK)
const MK_LIE = P(['...............', '...oooooooooo..', '..osSsdsddsseo.', '.oddsddsddsdoo.', '..ooo......ooo.'], MK)
const DM = { o: 0x2a2208, y: 0xf0c030, Y: 0xa87c10, k: 0x14141c, G: 0x9aa2bc, r: 0xe0402e, R: 0x8a1822, w: 0xffffff }
const DUME2 = P2(['.......oo......', '......oykyo....', '.....ooyyoGGw..', '....oyyo..rrrG.', '.oooyyooo.rRr..', 'oyyyyyyyyo.rRr.', 'oyyyyYyyyyo.oo.', 'oyyyyyyyyyo....', '.okko..okko....'], DM)
const JT = 8
const HUD = 0x3cd4ff
LANES.jarvis = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 2.0 : t0 % JT, sx = W * 0.30, bxl = W * 0.80
  ground(cv, y0)
  // steel ceiling beam (right) - the thing he hits
  for (let x = bxl - 10; x < bxl + 24; x++) { dot(cv, y0, x, 0, 0xaab2d0); dot(cv, y0, x, 1, 0x8a92b0); dot(cv, y0, x, 2, (x >> 2) % 2 ? 0x5a6284 : 0x4a5270) }
  let x = sx, y = LH - 11 - 1, sp = MK_ST, vis = true, fl = 0
  if (t < 1.0) fl = 0
  else if (t < 2.4) { const k = seg(t, 1.0, 2.4); y = 1 - ease(Math.min(1, k * 1.6)) * 1; x = sx + Math.sin(t * 9) * (k > 0.55 ? 1.5 : 0.4); fl = 1 }
  else if (t < 3.7) { const k = seg(t, 2.4, 3.7); sp = MK_FLY; x = sx + k * k * (bxl - 12 - sx); y = 6 - k * 5; fl = 2 }
  else if (t < 4.7) { const k = seg(t, 3.7, 4.7); sp = MK_FLY; x = bxl - 12 + k * 4; y = Math.min(LH - 5, 1 + 22 * k * k); fl = 0; if (y >= LH - 5) { sp = MK_LIE } }
  else { sp = MK_LIE; x = bxl - 8; y = LH - 5 }
  if (t < 4.7 && sp === MK_LIE) x = bxl - 8
  if (calm) { x = sx; y = 0; sp = MK_ST; fl = 1 }
  y = Math.max(0, y)
  if (t >= 2.4 && t < 2.5 && !calm) { x = sx; y = 0 }
  const foamK = calm ? 0 : seg(t, 6.0, 7.3), fade = t > 7.6 ? 1 - seg(t, 7.6, 8) : 1
  if (t < 0.3 && !calm) { /* reset fade-in */ }
  // HUD ring around the suit while it hovers
  if (fl === 1 || calm) { const k = 0.5 + 0.5 * Math.sin(t * 8); ellipse(cv, y0, x + 10, y + 5, 15, 6.5, HUD, 0.55 + 0.3 * k); ellipse(cv, y0, x + 10, y + 5, 11, 5, HUD, 0.35, t * 4, t * 4 + 2.2); plus(cv, y0, x + 26, y + 5, HUD, 0.8); plus(cv, y0, x - 6, y + 5, HUD, 0.8) }
  // boot jets / flight flame
  if (fl === 1) for (let i = 0; i < 6; i++) { const f = 1 - i / 6; lit(cv, y0, x + 6 + (i & 1) * 8 + (i % 3 - 1) * 0.6, y + 9 + i * 0.5, i < 2 ? 0xffe27a : 0xff8a30, 0.9 * f); lit(cv, y0, x + 13 + (i & 1), y + 9 + i * 0.5, i < 2 ? 0xffe27a : 0xff8a30, 0.9 * f) }
  if (fl === 2) { for (let i = 0; i < 14; i++) { const f = 1 - i / 14; lit(cv, y0, x - 1 - i * 1.3, y + 3, i < 3 ? 0xffffff : i < 7 ? 0xffe27a : 0xff8a30, 0.95 * f); lit(cv, y0, x - 1 - i * 1.3, y + 2, 0xff8a30, 0.5 * f) } speed(cv, y0, x - 14, 0x9aa4c8, 0.7, t) }
  if (vis) spr(cv, y0, sp, x, y, { alpha: fade })
  // CLANG: impact flash + starburst at the ceiling beam
  if (t >= 3.6 && t < 4.3 && !calm) {
    const k = seg(t, 3.6, 4.3), cx = bxl + 4
    rad(cv, y0, cx / 2, y0 + 1, 8 * (1 - k * 0.4), 0xffffff, 0.9 * (1 - k)); rad(cv, y0, cx / 2, y0 + 1, 12, 0xffe27a, 0.5 * (1 - k))
    for (let i = 0; i < 8; i++) { const A = i * 0.785, r = 3 + k * 12; plus(cv, y0, cx + Math.cos(A) * r * 1.6, 1.5 + Math.abs(Math.sin(A)) * r * 0.5 * (i < 4 ? 1 : 1), i % 2 ? 0xffe27a : 0xffffff, 1 - k) }
  }
  if (t >= 4.4 && t < 5.0 && !calm) puff(cv, y0, bxl + 4, seg(t, 4.4, 5.0), 1)
  if (t >= 4.7 && !calm) for (let i = 0; i < 3; i++) { const k = ((t * 1.1 + i * 0.33) % 1); plus(cv, y0, x + 6 + i * 5, y - k * 5, 0x8a86a8, 0.7 * (1 - k)) }
  // DUM-E
  const din = calm ? 0 : ease(seg(t, 4.7, 5.9)) - ease(seg(t, 7.6, 8.0)), dx = 4 + (bxl - 42 - 4) * din
  const tw = t > 4.7 && t < 5.9 ? Math.sin(t * 30) * 0.4 : 0
  spr(cv, y0, DUME2, dx + (calm ? 0 : Math.sin(t * 3) * 0.6), LH - DUME2.h + tw)
  if (!calm && t >= 4.7 && t < 5.9) puff(cv, y0, dx - 2, (t * 2.5) % 1, -1)
  // foam spray from the nozzle and the foam heap on the suit
  if (t >= 5.9 && t < 7.4 && !calm) for (let i = 0; i < 16; i++) { const u = (t * 2.2 + i * 0.0625) % 1, px = dx + 29 + u * (bxl + 4 - dx - 24), py = 5 + 4 * u * u - 1.5 * u; plus(cv, y0, px, py, i % 2 ? 0xffffff : 0xd8e6fa, 1 - u * 0.3) }
  if (foamK > 0) for (let i = 0; i < 28; i++) { const cx = bxl - 6 + i, e = Math.sin((i + 0.5) / 28 * Math.PI), h = e * 6.5 * foamK * (0.8 + 0.3 * Math.abs(Math.sin(i * 0.9))); for (let j = 0; j < h; j++) dot(cv, y0, cx, LH - 2 - j, j > h - 1.3 ? 0xffffff : j > h - 2.6 ? 0xe4eefc : 0xb4c8e8, fade) }
  if (!calm && t >= 7.3 && t < 8) { const f = 0.5 + 0.5 * Math.sin((t - 7.3) * 12); plus(cv, y0, bxl + 8, 1, HUD, f * fade) }
}

// ----- Loki: illusion clones, Thor's hammer shatters one into green sparkles, the real Loki stabs from behind, Thor was an illusion too -----
const KP = { H: 0xffe98a, G: 0xf0b92c, a: 0x2a2a42, s: 0xecdfcb, z: 0x1b1b2c, e: 0x1f9a58, n: 0x0f4a30, d: 0xeaf6ff, E: 0x3cd98a }
const LKS = P2(half(['..H.....', '..HG....', '...HGGGG', '...GGGGG', '...aasss', '...aszss', '...assss', '....asss', '..aGeeee', '.aaeGeee', '.aneeeee', '.nneee..']), KP)
const LKB = P2(half(['........', '........', '..H.....', '..HG.GGG', '...GGGGG', '...aasss', '...aszss', '...assss', '..aGeeee', '.aaeGeee', '.aneeeee', '.nneee..']), KP)
const TPAL = { y: 0xf6d65a, s: 0xf0c8a0, k: 0x2a2a3a, r: 0xd23a32, b: 0x3a5ac8, G: 0xcfd4e6, o: 0x1a1a2a, m: 0xa6aec8, w: 0x8a5a2a }
const THS = P2(['..yyyyyy....', '..yskssky...', '..ysssssy...', '...yyyyy....', '..bGGGGGbrr.', '.bbGbbGbbrrr', '.bbbbbbbbrrr', '.sbbbbbbbrrr', '.s.bbbbbbrr.', '...bbbbb.rr.', '...bb.bb.r..', '..bbb.bbb...'], TPAL)
const GHOST = 0x3cff90
const LDIS = mkDis(LKS, GHOST, 0.45), TDIS = mkDis(THS, GHOST, 0.3)
// A procedural hammer: handle from the hand at angle a (radians, 0 = pointing left), head at its tip.
function hammer(cv: Canvas, y0: number, hx: number, hy: number, a: number, a2 = 1) {
  const c = Math.cos(a), s = Math.sin(a) * 0.5
  for (let i = 0; i < 12; i++) dot(cv, y0, hx - c * i, hy + s * i, 0x8a5a2a, a2)
  const ex = hx - c * 12, ey = hy + s * 12
  for (let j = -2; j <= 2; j++) for (let i = -3; i <= 3; i++) dot(cv, y0, ex + i, ey + j, j === -2 || i === -3 ? 0xdde3f4 : (j === 2 || i === 3) ? 0x6c7694 : 0xa6aec8, a2)
}
const LKT = 8
LANES.loki = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 4.8 : t0 % LKT, b = Math.round(W * 0.1), xt = b + 98, xl = b + 134
  ground(cv, y0)
  // clones
  const CX = [b, b + 32, b + 64], DT = [3.0, 3.15, 3.3]
  for (let c = 0; c < 3; c++) {
    const ap = c === 0 ? 1 : seg(t, c * 0.35, 0.6 + c * 0.35), dt = (t - DT[c]!) / 0.9
    if (calm) { spr(cv, y0, LKS, CX[c]!, 0, { alpha: 0.55, tint: GHOST, tintAmt: 0.45 }); continue }
    
    if (dt < 0) { if (ap < 1 && hs(Math.floor(t * 16) + c) < 0.4) continue; spr(cv, y0, LKS, CX[c]! + (hs(Math.floor(t * 12) + c * 3) > 0.9 ? 1 : 0), 0, { alpha: 0.6 * ap + 0.1, tint: GHOST, tintAmt: 0.45 })
      if (ap < 1) { ellipse(cv, y0, CX[c]! + 12, 6, 14 * (1 - ap) + 4, 6 * (1 - ap) + 1, 0x6cffb0, 0.6 * (1 - ap)) } }
    else if (dt < 1) drawDis(cv, y0, LDIS, CX[c]!, 0, dt)
  }
  // hit flash at the hammer's strike
  if (!calm && t >= 2.85 && t < 3.0) rad(cv, y0, (CX[2]! + 14) / 2, y0 + 6, 8, 0xffffff, 0.9 * (1 - (t - 2.85) / 0.15))
  // Thor
  const tin = ease(seg(t, 1.2, 2.2))
  let tx = xt + (W + 30 - xt) * (1 - tin)
  const thorDis = seg(t, 5.0, 5.9)
  if (calm) { /* still frame: real Loki bows beside Thor */ }
  else if (t >= 1.2 && thorDis < 1) {
    let a = 0.0, show = true
    if (t < 2.2) a = 0.5 // carried
    else if (t < 2.7) a = 0.5 - 2.0 * seg(t, 2.2, 2.7) // wind-up, hammer rises overhead
    else if (t < 3.0) a = -1.5 + 1.6 * seg(t, 2.7, 3.0) // swing down
    else a = 0.1 - 0.1 * seg(t, 3.0, 3.6)
    const lean = t >= 2.7 && t < 3.0 ? -3 : 0
    if (t >= 5.0) { drawDis(cv, y0, TDIS, tx, 0, thorDis, false) } else { spr(cv, y0, THS, tx + lean, 0, { tint: 0xffffff, tintAmt: t >= 4.65 && t < 4.95 ? 0.7 : 0 }); hammer(cv, y0, tx + lean + 3, 8, a, 1) }
    if (t >= 2.65 && t < 3.3) { const k = seg(t, 2.7, 3.0), f = 1 - seg(t, 3.0, 3.3); for (let q = 0; q < 14 * k; q++) { const aa = -1.5 + 1.6 * (q / 14), cc = Math.cos(aa), ss = Math.sin(aa) * 0.5; for (const r of [10, 13]) lit(cv, y0, tx - 3 + 3 - cc * r, 8 + ss * r, r > 11 ? 0xffffff : 0xa6aec8, 0.8 * f * (0.4 + q / 14)) } } // swing arc
    void show
  }
  // the real Loki appears behind Thor
  if (t >= 3.9 || calm) {
    const ap = calm ? 1 : seg(t, 3.9, 4.3)
    let lx = calm ? xl - 40 : xl, sy = 0, st = 0
    if (!calm && t >= 4.3 && t < 4.9) { st = seg(t, 4.5, 4.7); lx = xl - 28 * (t < 4.5 ? 0 : (t < 4.7 ? st : 1)) } // lunge: wind, thrust, hold
    if (!calm && t >= 4.9 && t < 5.6) lx = xl - 28 + 28 * seg(t, 4.9, 5.6)
    const bow = !calm && t >= 6.4 && t < 7.4
    if (!calm && t < 4.3 && ap < 1) { rad(cv, y0, (xl + 12) / 2, y0 + 6, 9 * (1 - ap) + 3, 0x58e6ff, 0.6 * (1 - ap)); if (hs(Math.floor(t * 20)) < 0.5) { /* flicker-in */ } }
    spr(cv, y0, bow ? LKB : LKS, lx, bow ? 0 : sy, { alpha: calm ? 1 : Math.min(1, ap + 0.2), tint: ap < 1 ? 0x58e6ff : 0xffffff, tintAmt: ap < 1 ? 0.4 * (1 - ap) : 0 })
    if (!calm && t >= 4.3 && t < 5.0) { // dagger and arm: extend, then a glint on the hit
      const ex = Math.min(1, seg(t, 4.5, 4.7)) * 12 + 0
      for (let i = 0; i < 8 + ex; i++) dot(cv, y0, lx - 1 - i, 8, i < 6 ? 0x1f9a58 : i < 8 + ex - 4 ? 0xeaf6ff : 0xffffff)
      if (t >= 4.65 && t < 4.95) { const f = 1 - (t - 4.65) / 0.3; plus(cv, y0, lx - 22, 8, 0xffffff, f); plus(cv, y0, lx - 23, 8, 0xffffff, f); plus(cv, y0, lx - 27, 6, 0xffffff, f); plus(cv, y0, lx - 18, 10, 0xbfffe0, f); plus(cv, y0, lx - 22, 4, 0xbfffe0, f); rad(cv, y0, (lx - 22) / 2, y0 + 8, 8, 0xffffff, 0.9 * f) }
    }
    if (!calm && t >= 6.4 && t < 7.4) { const f = Math.sin(seg(t, 6.4, 7.4) * Math.PI); for (let i = 0; i < 5; i++) plus(cv, y0, lx + 4 + i * 5, 2 - i % 2 * 2 + (1 - f) * 3, i % 2 ? 0xa6ffcf : 0x3cd98a, f) } // flourish
    if (!calm && t >= 7.4) { const g = 0.5 + 0.5 * Math.sin((t - 7.4) * 12); plus(cv, y0, lx + 2, 0, 0xffffff, g) } // horn glint
  }
}

// ----- Ultron: a heap of drones lifts, swirls and assembles into a full Ultron, who raises his arms; a late drone bonks his head -----
const UPAL = { o: 0x12142a, c: 0xcfd6e6, C: 0xf6f9ff, m: 0x8e98b6, d: 0x4a5272, k: 0x080812, r: 0xff3030 }
const UROWS = ['...oooo', '..occcC', '..ocdrk', '..ocmmd', '.oommcc', 'occcCcc', 'ommdccr', 'ommdccr', 'ocmddmm', 'occ.ddd', '...odd.', '..oddd.']
const UB = P2(half(UROWS), UPAL)
const UBUP = P2(half(UROWS.map((r, i) => i >= 1 && i <= 4 ? 'cm' + r.slice(2) : i >= 6 && i <= 9 ? '...' + r.slice(3) : r)), UPAL)
const DRN = P(['d......d', '.dm..md.', '..mccm..', '.dcrrcd.', '..mccm..', '...dd...'], { d: 0x525b7a, m: 0x9aa2c4, c: 0xe8eefc, r: 0xff3030 })
const NDR = 10
const SLOTS = [[14, 0], [10, 3], [18, 3], [4, 6], [22, 6], [14, 6], [14, 9], [8, 10], [20, 10], [14, 3]]
const UTT = 8
LANES.ultron = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 5.2 : t0 % UTT, cx = Math.round(W * 0.5), bx = cx - 14
  ground(cv, y0)
  const bodyA = calm ? 1 : seg(t, 3.3, 3.7)
  const up = calm || (t >= 4.6 && t < 7.0)
  const bonk = !calm && t >= 6.95
  if (bodyA > 0) {
    if (!calm && t >= 3.3 && t < 3.75) rad(cv, y0, cx / 2, y0 + 6, 11, 0xffffff, 0.8 * (1 - seg(t, 3.5, 3.75)) * seg(t, 3.3, 3.5))
    const hold = calm || (t >= 4.9 && t < 5.9) ? 1 : 0
    rad(cv, y0, cx / 2, y0 + 6, 11, 0xff2020, (0.1 + 0.12 * hold) * bodyA)
    spr(cv, y0, up ? UBUP : UB, bx, 0, { alpha: bodyA })
    const ig = calm ? 1 : seg(t, 3.9, 4.3), ep = (0.6 + 0.4 * Math.sin(t * 9)) * ig * bodyA
    if (bonk) { for (const ex of [10, 11, 16, 17]) dot(cv, y0, bx + ex, 2, 0x9a1020); for (const ex of [9, 10, 11, 12, 15, 16, 17, 18]) dot(cv, y0, bx + ex, 1, 0x12142a) } // eyes narrow, a scowl
    else { for (const ex of [10, 11, 16, 17]) lit(cv, y0, bx + ex, 2, 0xff6060, ep); rad(cv, y0, (bx + 14) / 2, y0 + 2, 4, 0xff2020, 0.35 * ep) }
    const cp = 0.5 + 0.5 * Math.sin(t * (hold ? 8 : 5)) // chest core pulse
    for (const rx of [12, 13, 14, 15]) for (const ry of [6, 7]) lit(cv, y0, bx + rx, ry, 0xff5050, (0.3 + 0.5 * cp) * ig * bodyA)
    rad(cv, y0, (bx + 14) / 2, y0 + 6.5, 5, 0xff2020, (0.2 + 0.3 * cp) * ig * bodyA)
  }
  if (!calm) for (let i = 0; i < NDR; i++) {
    const left = i % 2 === 0
    const hx = cx - 20 + (i % 5) * 9 + ((i >> 1) & 1) * 3, hy = i < 5 ? 6 : 2
    const p1 = ease(seg(t, i * 0.02, 1.7)), th = i * 0.63 + t * 5, rr = (14 + (i % 3) * 8) * (1 - 0.4 * seg(t, 1.2, 2.4))
    const swx = cx - 4 + Math.cos(th) * rr * 1.5, swy = 2 + Math.sin(th) * 2.5 + 2
    const p2 = ease(seg(t, 2.1 + i * 0.03, 3.3))
    let x = hx + (swx - hx) * p1, y = hy + (swy - hy) * p1
    if (t < 0.5) { y = hy - (hs(Math.floor(t * 12) + i) > 0.85 ? 1 : 0); x = hx }
    const sx = bx + SLOTS[i]![0]! - 4, sy = SLOTS[i]![1]!
    x += (sx - x) * p2; y += (sy - y) * p2
    let al = 1 - bodyA
    if (t >= 5.2) { const p3 = seg(t, 5.2 + (i % 5) * 0.05, 6.6); al = p3 > 0 ? 1 : 0; x = sx + (left ? -1 : 1) * p3 * p3 * (W * 0.55); y = sy + p3 * ((i % 3) - 1) * 3 }
    if (al <= 0.02) continue
    const yy = Math.max(0, Math.min(LH - 7, Math.round(y)))
    if (t >= 5.2 || t < 3.4) for (let k = 1; k < 6; k++) lit(cv, y0, x + (left ? -k * 2 : k * 2 + 8), yy + 3, 0xff2020, 0.25 / k * al)
    spr(cv, y0, DRN, x, yy, { alpha: al })
    const ep = 0.6 + 0.4 * Math.sin(t * 6 + i); lit(cv, y0, x + 3, yy + 3, 0xff5050, ep * al); lit(cv, y0, x + 4, yy + 3, 0xff5050, ep * al)
  }
  if (!calm && t >= 6.4) { // the late drone zips in, bonks Ultron's head, falls, sits sparking
    const k = seg(t, 6.4, 6.95), d = t - 6.95, hx = cx - 4, hy = 0
    let gx = -10 + (hx + 10) * k, gy = hy
    if (d > 0) { gx = hx - d * 14; gy = Math.min(LH - 6, hy + 36 * d * d) - (d > 0.45 ? Math.abs(Math.sin((d - 0.45) * 9)) * 2 * Math.exp(-(d - 0.45) * 3) : 0) }
    if (k < 1) for (let q = 1; q < 9; q++) lit(cv, y0, gx - q * 2, gy + 3, 0xff2020, 0.35 / q * 3)
    spr(cv, y0, DRN, gx, gy)
    if (d > 0 && d < 0.3) { const f = 1 - d / 0.3; rad(cv, y0, (hx + 4) / 2, y0 + 3, 6, 0xffffff, 0.8 * f); plus(cv, y0, hx - 3, 1, 0xffe27a, f); plus(cv, y0, hx + 11, 1, 0xffe27a, f); plus(cv, y0, hx + 4, -1, 0xffffff, f) }
    if (d > 0.5 && d < 1.1) { const f = 1 - (d - 0.5) / 0.6; plus(cv, y0, gx + 10, LH - 7, 0xffe27a, f); plus(cv, y0, gx - 3, LH - 8, 0x9bf0ff, f) }
  }
}

// Vision: he glides in, phases through the stone wall (turns ghostly, gold shimmer), solid again, Mind Stone beam blows up the sentry drone.
const VP = { o: 0x3a0c24, r: 0xd02e55, h: 0xff8a96, y: 0xffe94d, Y: 0xd9a81c, e: 0x2cb06c, n: 0x146a40, g: 0xf7c948, w: 0xfff4c0, d: 0x86193f }
const VBODY = P2(half(['....oo', '...orr', '..orrh', '..orry', '..orwr', '...orr', '...odr', '..oegg', '..oeng', '...eeg', '...nee', '...nn.']), VP)
const VCAPE = [P2(['............', '............', '............', '............', '............', '............', '..YYYYYYY...', '.YyyyyyyYY..', 'YyyyyyyyyY..', 'YyyyyyyyyYY.', 'Yy.yyy.yyY..', 'Y..Y..yY....'], VP), P2(['............', '............', '............', '............', '............', '............', '..YYYYYYY...', '.YyyyyyyYY..', 'YyyyyyyyyYY.', 'YyyyyyyyyY..', 'Y.yyy.yyyY..', '..Y..Y.Y....'], VP)]
const SENT = P2(['..dd..dd', '.dmmddmm', '.mcrrcmm', '..dmmdd.', '...dd...', '..d..d..'], { d: 0x525b7a, m: 0x9aa2c4, c: 0xe2e8f6, r: 0xff4030 })
const CHUNK = P(['.dd.', 'dmmd', '.mrd', '..d.'], { d: 0x525b7a, m: 0x9aa2c4, r: 0xff4030 })
const VT = 8
LANES.vision = (cv, y0, t0, calm) => {
  const W = cv.W, t = calm ? 5.3 : t0 % VT, wx = Math.round(W * 0.46), sxp = W - 30
  ground(cv, y0)
  for (let j = 0; j < LH - 1; j++) for (let i = 0; i < 8; i++) dot(cv, y0, wx + i, j, (j + (i >> 2)) % 3 === 0 ? 0x2e3050 : ((j >> 1) + (i >> 2)) % 2 ? 0x5a5f8c : 0x4a4f78)
  if (t > 2.5) for (let k = 0; k < 4; k++) dot(cv, y0, wx + 2 + (k & 1) * 3, 2 + k * 2, 0x2a2c48)
  let x = 4 + (W * 0.12 - 4) * ease(seg(t, 0, 1.2))
  if (t >= 3.0) x = W * 0.12 + (wx + 36 - W * 0.12) * (1 - (1 - seg(t, 3.0, 5.0)) ** 2)
  if (calm) x = wx + 36
  const over = x + 24 > wx && x < wx + 8, ph = over && t >= 3.0 && t < 5.4
  const sa = ease(seg(t, 0.4, 1.4)), sx = sxp + (W + 20 - sxp) * (1 - sa), dead = t >= 5.6
  const sy = 1 + Math.sin(t * 3) * 0.6
  if (!dead || calm) {
    if (!calm || true) spr(cv, y0, SENT, calm ? sxp : sx, sy, { flip: true }); lit(cv, y0, (calm ? sxp : sx) + 4, sy + 3, 0xff4030, 0.8)
    if (!calm) for (const ts of [2.3, 2.9]) {
      const d = t - ts, tw = (sx - 3 - wx - 8) / 120
      if (d >= 0 && d < 0.1) lit(cv, y0, sx - 2, 3, 0xffe27a, 0.9)
      const bx = sx - 3 - d * 120
      if (d >= 0 && bx > wx + 8) { for (let i = 0; i < 5; i++) dot(cv, y0, bx + i, 3, i ? 0xff6a4a : 0xffffff); lit(cv, y0, bx + 2, 3, 0xff4030, 0.5) }
      else if (d >= tw) { const k = (d - tw) / 0.3; if (k < 1) { rad(cv, y0, (wx + 8) / 2, y0 + 3, 3, 0xffd890, 0.7 * (1 - k)); plus(cv, y0, wx + 10 + k * 5, 2 - k * 3, 0xffe27a, 1 - k); plus(cv, y0, wx + 12 + k * 3, 5 + k * 3, 0xff9a40, 1 - k) } }
    }
  }
  const fi = Math.floor(t * 6) % 2, body = VBODY, gx = x + 12, gy = 3
  if (ph) {
    for (let g = 3; g >= 1; g--) spr(cv, y0, body, x - g * 6, 0, { alpha: 0.12 * (4 - g), tint: 0xffe94d, tintAmt: 0.5 })
    for (let j = 0; j < LH - 1; j++) lit(cv, y0, wx + 3 + Math.sin(t * 20 + j) * 1.5, j, 0xffe14a, 0.35)
    spr(cv, y0, body, x, 0, { alpha: 0.5, tint: 0xfff4c0, tintAmt: 0.3 })
  } else { const o = t > 6.5 && t < 7.0 ? { alpha: 0.55 } : {}; spr(cv, y0, body, x, 0, o) }
  const stoneP = 0.5 + 0.5 * Math.sin(t * 5)
  rad(cv, y0, gx / 2, y0 + gy, 2, 0xffe14a, 0.25 + 0.25 * stoneP)
  if (!calm && t >= 4.9 && t < 6.0) {
    const ch = seg(t, 4.9, 5.4), f = t < 5.8 ? 1 : 1 - seg(t, 5.8, 6.0)
    rad(cv, y0, gx / 2, y0 + gy, 3 + 3 * ch, 0xffe14a, 0.4 + 0.5 * ch)
    if (t < 5.4) for (let i = 0; i < 6; i++) { const A = i * 1.05 + 0.4, r = (1 - ((ch * 2 + i * 0.17) % 1)) * 14; plus(cv, y0, gx + Math.cos(A) * r, gy + Math.sin(A) * r * 0.5, 0xffe94d, 0.8) }
    if (t >= 5.4) {
      const len = Math.min(sx - gx, (sx - gx) * seg(t, 5.4, 5.6))
      for (let b = gx + 1; b < gx + len; b++) { const p = Math.sin(b * 0.9 - t * 40) > 0.8; dot(cv, y0, b, gy - 1, 0xffc83a, 0.8 * f); dot(cv, y0, b, gy + 1, 0xffc83a, 0.8 * f); dot(cv, y0, b, gy, p ? 0xffffff : 0xfffbd0, f); lit(cv, y0, b, gy - 2, 0xffe14a, 0.2 * f); lit(cv, y0, b, gy + 2, 0xffe14a, 0.2 * f) }
    }
  }
  if (!calm && t >= 5.6 && t < 6.9) {
    const k = seg(t, 5.6, 6.9), ex = sx + 4
    if (k < 0.1) rad(cv, y0, ex / 2, y0 + 4, 9, 0xffffff, 0.9 * (1 - k / 0.1))
    else { rad(cv, y0, ex / 2, y0 + 4, 3 + 8 * Math.sqrt(k), 0xff9a30, 0.7 * (1 - k)); ellipse(cv, y0, ex, 4, k * 22, k * 8, 0xffd890, 0.7 * (1 - k)) }
    for (let i = 0; i < 8; i++) { // deliberate grey and orange chunks, 2 wide x 1 tall, falling under gravity
      const A = i * 0.8 + 0.3, v = 10 + (i % 3) * 8, cxp = ex + Math.cos(A) * v * k * 1.6, cyp = 4 + Math.sin(A) * v * k * 0.5 + 14 * k * k, c = i % 2 ? 0xff9a30 : i % 4 === 0 ? 0xdde3f4 : 0x7a82a8
      if (cyp < LH - 1) { dot(cv, y0, cxp, cyp, c, 1 - k * 0.7); dot(cv, y0, cxp + 1, cyp, c, 1 - k * 0.7); if (i % 2) dot(cv, y0, cxp, cyp + 1, c, 0.6 * (1 - k)) }
    }
  }
}
