// clarvis: SCREEN FX bursts. One full-screen, one-second signature per hero,
// drawn over whatever the theater canvas already holds. Pure: the same
// (kind, u, size) draws the same pixels. Photosensitivity: every wash is capped
// at 50% alpha and rises/falls smoothly (no strobing, no white frames); every
// burst eases in over 0.1 and fades over the last 0.3, so u = 1 adds nothing.
import { Canvas, CLEAR, BACKDROP, PXW, rgb, lerp, hash, easeOut, easeInOut, clamp01 } from './pixel'

export const BURST_KINDS = ['THOR', 'HULK', 'IRONMAN', 'CAP', 'WIDOW', 'HAWKEYE', 'SPIDEY', 'STRANGE', 'WANDA', 'ANTMAN', 'PANTHER', 'VISION', 'LOKI', 'ULTRON', 'FURY', 'DEADPOOL', 'JARVIS', 'THANOS', 'YONDU', 'GROOT', 'ROCKET', 'CMARVEL', 'STARLORD', 'WOLVERINE'] as const
export type BurstKind = (typeof BURST_KINDS)[number]
export const BURST_S = 1

const TAU = Math.PI * 2
const INK = 0x0b0b14, WHITE = 0xffffff
const K = {
  blue: rgb('#2f7bff'), ice: rgb('#bfe4ff'), green: rgb('#2fd24a'), lime: rgb('#8cff5a'), cyan: rgb('#27d8ff'), red: rgb('#e0212b'), blueD: rgb('#1d3fd0'),
  orange: rgb('#ff8a1c'), yellow: rgb('#ffd21f'), gold: rgb('#ffc83a'), violet: rgb('#9b4dff'), purple: rgb('#6b2fb8'), crimson: rgb('#d1122e'), pink: rgb('#ff4f7a'),
  amber: rgb('#ffb000'), paper: rgb('#f0e8d8'), darkRed: rgb('#5a0a10'), hot: rgb('#b0121c'), vine: rgb('#2f9e3a'), vine2: rgb('#6fd04a'), steel: rgb('#dfe8f2'),
}

// ── helpers ─────────────────────────────────────────────────────────────────
// A whole-canvas tint, capped at 50%.
function wash(cv: Canvas, c: number, a: number) {
  if (a <= 0) return
  if (a > 0.5) a = 0.5
  const p = cv.px
  for (let i = 0; i < p.length; i++) { const q = p[i]!; p[i] = lerp(q === CLEAR ? BACKDROP : q, c, a) }
}
// A line of round-ish thickness r (rows); thin lines blend one subpixel per step.
function thick(cv: Canvas, x0: number, y0: number, x1: number, y1: number, r: number, c: number, a: number) {
  if (a <= 0 || r <= 0) return
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0) * 2, Math.abs(y1 - y0)))), ir = Math.ceil(r), ix = Math.ceil((r / PXW) * 2), r2 = r * r
  for (let i = 0; i <= n; i++) {
    const t = i / n, xs = (x0 + (x1 - x0) * t) * 2, y = y0 + (y1 - y0) * t
    if (r <= 0.6) cv.blendSub(xs, y, c, a)
    else for (let dy = -ir; dy <= ir; dy++) for (let dx = -ix; dx <= ix; dx++) if ((dx / 2) ** 2 * PXW * PXW + dy * dy <= r2) cv.blendSub(xs + dx, y + dy, c, a)
  }
}
// A soft round light, clamped to the canvas so huge radii stay cheap.
function halo(cv: Canvas, cx: number, cy: number, r: number, c: number, a: number) {
  if (a <= 0 || r <= 0) return
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(cv.h - 1, Math.ceil(cy + r))
  const x0 = Math.max(0, Math.floor((cx - r / PXW) * 2)), x1 = Math.min(cv.W - 1, Math.ceil((cx + r / PXW) * 2)), r2 = r * r
  for (let y = y0; y <= y1; y++) for (let xs = x0; xs <= x1; xs++) {
    const d2 = (((xs + 0.5) / 2 - cx) * PXW) ** 2 + (y + 0.5 - cy) ** 2
    if (d2 < r2) { const f = 1 - Math.sqrt(d2) / r; cv.glowSub(xs, y, c, a * f * f) }
  }
}
// A ring of width th at radius r, soft edges, blended.
function ringA(cv: Canvas, cx: number, cy: number, r: number, th: number, c: number, a: number) {
  if (a <= 0 || r <= 0 || th <= 0) return
  const o = r + th, y0 = Math.max(0, Math.floor(cy - o)), y1 = Math.min(cv.h - 1, Math.ceil(cy + o))
  const x0 = Math.max(0, Math.floor((cx - o / PXW) * 2)), x1 = Math.min(cv.W - 1, Math.ceil((cx + o / PXW) * 2)), hw = th / 2
  for (let y = y0; y <= y1; y++) for (let xs = x0; xs <= x1; xs++) {
    const dx = ((xs + 0.5) / 2 - cx) * PXW, dy = y + 0.5 - cy, f = 1 - Math.abs(Math.sqrt(dx * dx + dy * dy) - r) / hw
    if (f > 0) cv.blendSub(xs, y, c, a * Math.min(1, f * 1.6))
  }
}
// Spokes from radius r0 to r1 at angles rot + i*TAU/n.
function spokes(cv: Canvas, cx: number, cy: number, n: number, r0: number, r1: number, rot: number, th: number, c: number, a: number) {
  for (let i = 0; i < n; i++) {
    const g = rot + (i * TAU) / n, co = Math.cos(g), si = Math.sin(g)
    thick(cv, cx + (co * r0) / PXW, cy + si * r0, cx + (co * r1) / PXW, cy + si * r1, th, c, a)
  }
}
// A jagged electric line, glow under a bright core.
function zap(cv: Canvas, x0: number, y0: number, x1: number, y1: number, seed: number, jit: number, c: number, core: number, a: number) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, n = Math.max(4, Math.floor(len / 2.5)), px = -dy / len, py = dx / len
  let lx = x0, ly = y0
  for (let i = 1; i <= n; i++) {
    const t = i / n, j = i === n ? 0 : (hash(seed, i) - 0.5) * 2 * jit, x = x0 + dx * t + px * j, y = y0 + dy * t + py * j
    cv.glow(lx, ly - 1, c, 0.3 * a); cv.glow(lx, ly + 1, c, 0.3 * a)
    thick(cv, lx, ly, x, y, 0.5, core, a)
    lx = x; ly = y
  }
}
function bolt(cv: Canvas, x0: number, y0: number, y1: number, seed: number, a: number, bias: number, depth: number) {
  let x = x0, y = y0, i = 0
  while (y < y1) {
    const nx = x + (hash(seed, i) - 0.5) * 3 + bias, ny = y + 1
    cv.glow(nx - 1, ny, K.blue, 0.4 * a); cv.glow(nx + 1, ny, K.blue, 0.4 * a)
    thick(cv, x, y, nx, ny, 0.5, a > 0.6 ? WHITE : K.ice, Math.min(1, a * 1.4))
    if (depth < 1 && hash(seed + 3, i) > 0.9) bolt(cv, nx, ny, Math.min(y1, ny + 6 + hash(seed, i + 40) * 8), seed * 1.7 + i, a * 0.7, (hash(seed, i + 9) - 0.5) * 3, 1)
    x = nx; y = ny; i++
  }
}
function web(cv: Canvas, ox: number, oy: number, sx: number, sy: number, len: number, n: number, a: number) {
  const step = Math.PI / 2 / (n - 1)
  for (let i = 0; i < n; i++) {
    const g = i * step
    thick(cv, ox, oy, ox + (sx * Math.cos(g) * len) / PXW, oy + sy * Math.sin(g) * len, 0.5, WHITE, a)
  }
  for (let k = 1; k <= 6; k++) {
    const rk = (len * k) / 6
    for (let i = 0; i < n - 1; i++) {
      const g0 = i * step, g1 = g0 + step, gm = (g0 + g1) / 2, sag = rk * 0.86
      const ax = ox + (sx * Math.cos(g0) * rk) / PXW, ay = oy + sy * Math.sin(g0) * rk
      const mx = ox + (sx * Math.cos(gm) * sag) / PXW, my = oy + sy * Math.sin(gm) * sag
      const bx = ox + (sx * Math.cos(g1) * rk) / PXW, by = oy + sy * Math.sin(g1) * rk
      thick(cv, ax, ay, mx, my, 0.5, K.steel, a * 0.8); thick(cv, mx, my, bx, by, 0.5, K.steel, a * 0.8)
    }
  }
}

// ── the bursts: (canvas, u, e) where e is the 0..1 envelope ─────────────────
function thor(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, s = Math.floor(u * 6), reach = h * easeOut(u * 5)
  wash(cv, K.blueD, 0.3 * e)
  for (let i = 0; i < 3; i++) bolt(cv, w * (0.18 + 0.32 * i) + (hash(s, i) - 0.5) * w * 0.12, -1, reach, s * 7 + i * 13 + 1, e, 0, 0)
}
function hulk(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, ix = w * 0.5, iy = h * 0.58, R = Math.hypot(w * PXW, h) * 0.5, g = easeOut(u * 4)
  wash(cv, K.green, 0.2 * e)
  ringA(cv, ix, iy, R * easeOut(u * 1.3), 2.5 * e + 0.5, K.lime, 0.8 * e)
  halo(cv, ix, iy, R * 0.35 * (1 - u), K.lime, 0.8 * e)
  for (let i = 0; i < 11; i++) {
    let a = (i / 11) * TAU + (hash(i, 1) - 0.5) * 0.5, x = ix, y = iy
    const len = R * (0.45 + 0.55 * hash(i, 2)) * g, steps = Math.floor(len)
    for (let k = 0; k < steps; k++) {
      a += (hash(i, k + 5) - 0.5) * 0.7
      const nx = x + Math.cos(a) / PXW, ny = y + Math.sin(a)
      thick(cv, x, y, nx, ny, 0.5 + 0.7 * (1 - k / steps), INK, e)
      cv.glow(nx, ny + 1, K.lime, 0.35 * e)
      x = nx; y = ny
    }
  }
  for (let i = 0; i < 26; i++) {
    const a = hash(i, 3) * TAU, sp = (0.3 + hash(i, 4)) * R * 0.8, t = easeOut(u * 1.2)
    const x = ix + (Math.cos(a) * sp * t) / PXW, y = iy + Math.sin(a) * sp * t - 6 * t * (1 - t) * h * 0.2 + u * u * h * 0.3
    cv.blend(x, y, i & 1 ? K.green : INK, e); cv.blend(x + 1, y, i & 1 ? K.green : INK, e)
  }
}
function ironman(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, cy = h * 0.5, th = Math.max(2, h * 0.18) * (0.5 + 0.5 * e), reach = Math.min(w * 2, w * 2 * easeOut(u * 6))
  wash(cv, K.cyan, 0.22 * e)
  for (let y = Math.max(0, Math.floor(cy - th)); y <= Math.min(h - 1, Math.ceil(cy + th)); y++) {
    const f = 1 - Math.abs(y + 0.5 - cy) / th, c = lerp(K.cyan, WHITE, clamp01(f * 1.6 - 0.3))
    for (let xs = 0; xs < Math.min(cv.W, reach); xs++) cv.blendSub(xs, y, c, Math.min(1, f * 1.5) * e)
  }
  halo(cv, 2, cy, th * 1.8, WHITE, 0.6 * e)
}
function shieldAt(cv: Canvas, cx: number, cy: number, r: number, a: number) {
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(cv.h - 1, Math.ceil(cy + r))
  const x0 = Math.max(0, Math.floor((cx - r / PXW) * 2)), x1 = Math.min(cv.W - 1, Math.ceil((cx + r / PXW) * 2))
  for (let y = y0; y <= y1; y++) for (let xs = x0; xs <= x1; xs++) {
    const d = Math.hypot(((xs + 0.5) / 2 - cx) * PXW, y + 0.5 - cy) / r
    if (d > 1) continue
    cv.blendSub(xs, y, d < 0.2 ? WHITE : d < 0.5 ? K.blueD : d < 0.72 ? WHITE : K.red, a)
  }
}
function capPos(w: number, h: number, t: number, out: number[]) {
  const ax = 4, ay = 3, bx = w - 5, by = h - 4, cx = w - 5, cy = 3
  if (t < 0.5) { const k = t * 2; out[0] = ax + (bx - ax) * k; out[1] = ay + (by - ay) * k }
  else { const k = (t - 0.5) * 2; out[0] = bx + (cx - bx) * k; out[1] = by + (cy - by) * k }
}
const POS = [0, 0], POS2 = [0, 0]
function cap(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, r = Math.max(3, Math.min(h * 0.2, w * PXW * 0.1)), t = clamp01((u - 0.04) / 0.9)
  capPos(w, h, t, POS); capPos(w, h, Math.max(0, t - 0.14), POS2)
  wash(cv, K.blueD, 0.15 * e)
  thick(cv, POS2[0]!, POS2[1]!, POS[0]!, POS[1]!, r * 0.5 * e, K.ice, 0.6 * e)
  for (let i = 0; i < 4; i++) thick(cv, POS2[0]! - 3 * i, POS2[1]! + (i - 1.5) * r * 0.5, POS[0]! - 3 * i, POS[1]! + (i - 1.5) * r * 0.5, 0.5, WHITE, 0.7 * e)
  shieldAt(cv, POS[0]!, POS[1]!, r, e)
  const hit = Math.abs(u - 0.5) < 0.12 ? 1 - Math.abs(u - 0.5) / 0.12 : 0
  if (hit > 0) { const bx = w - 5, by = h - 4; halo(cv, bx, by, r * 2.2, K.yellow, hit * e); spokes(cv, bx, by, 10, r * 0.8, r * 2.4, 0.2, 0.5, WHITE, hit * e) }
}
function widow(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, s = Math.floor(u * 8)
  wash(cv, K.blueD, 0.15 * e)
  for (let i = 0; i < 5; i++) {
    const side = hash(s, i) < 0.5
    const x0 = side ? -1 : w * hash(s, i + 20), y0 = side ? h * hash(s, i + 10) : -1, x1 = side ? w * (0.5 + 0.5 * hash(s, i + 30)) : w * hash(s, i + 40), y1 = h * (0.4 + 0.6 * hash(s, i + 50))
    zap(cv, x0, y0, x1, y1, s * 11 + i, 3.5, K.blue, i & 1 ? WHITE : K.cyan, e)
    halo(cv, x1, y1, 4, K.cyan, 0.7 * e)
  }
}
function hawkeye(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, ty = h * 0.45, tx = w * 0.78, R = Math.hypot(w * PXW, h) * 0.45
  if (u < 0.45) {
    const hx = -4 + (tx + 4) * clamp01(u / 0.38)
    thick(cv, hx - 14, ty, hx, ty, 0.5, K.steel, e); thick(cv, hx - 22, ty - 1, hx - 6, ty - 1, 0.5, K.orange, 0.6 * e); thick(cv, hx - 22, ty + 1, hx - 6, ty + 1, 0.5, K.orange, 0.6 * e)
    halo(cv, hx, ty, 3, K.orange, e)
  }
  if (u >= 0.36) {
    const p = (u - 0.36) / 0.64, g = easeOut(p)
    wash(cv, K.orange, 0.3 * e * (1 - p * 0.5))
    halo(cv, tx, ty, R * g, K.orange, 0.9 * e); halo(cv, tx, ty, R * g * 0.45, K.yellow, 0.9 * e)
    ringA(cv, tx, ty, R * g * 0.9, 1.5 * e + 0.4, K.yellow, e)
    spokes(cv, tx, ty, 14, R * g * 0.3, R * g * 1.05, 0.1, 0.5, K.yellow, 0.8 * e)
  }
}
function spidey(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, g = easeOut(u * 3), len = Math.hypot(w * PXW, h) * 1.05 * g
  wash(cv, K.crimson, 0.15 * e)
  web(cv, 0, 0, 1, 1, len, 9, e)
  web(cv, w - 1, h - 1, -1, -1, len * 0.8, 7, e * 0.9)
}
function strange(cv: Canvas, u: number, e: number) {
  const cx = cv.w / 2, cy = cv.h / 2, R = Math.min(Math.hypot(cv.w * PXW, cv.h) * 0.5, cv.h * 0.75), g = easeOut(u * 3), rot = u * 5
  halo(cv, cx, cy, R * g * 1.1, K.orange, 0.4 * e)
  for (let k = 0; k < 3; k++) {
    const r = R * (0.35 + 0.28 * k) * g, n = 150
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU
      if (Math.sin(a * (8 + 4 * k) + rot * (k & 1 ? -1 : 1)) < -0.25) continue
      const x = cx + (Math.cos(a) * r) / PXW, y = cy + Math.sin(a) * r
      cv.blend(x, y, k === 1 ? K.yellow : K.orange, e); cv.glow(x, y, K.orange, 0.3 * e)
    }
  }
  for (let q = 0; q < 2; q++) for (let i = 0; i < 4; i++) {
    const a0 = rot * 0.7 + q * Math.PI / 4 + (i * TAU) / 4, a1 = a0 + TAU / 4, r = R * 0.6 * g
    thick(cv, cx + (Math.cos(a0) * r) / PXW, cy + Math.sin(a0) * r, cx + (Math.cos(a1) * r) / PXW, cy + Math.sin(a1) * r, 0.5, K.gold, 0.9 * e)
  }
  for (let i = 0; i < 36; i++) {
    const a = hash(i, 1) * TAU, p = (u * 1.6 + hash(i, 2)) % 1, d = R * 1.1 * p * g
    cv.glow(cx + (Math.cos(a) * d) / PXW, cy + Math.sin(a) * d, K.yellow, (1 - p) * e)
  }
}
function wanda(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, t = u * 6
  wash(cv, K.crimson, 0.28 * e)
  for (let i = 0; i < 4; i++) halo(cv, w * hash(i, 1), h * hash(i, 2), h * 0.7, K.pink, 0.4 * e)
  for (let k = 0; k < 7; k++) {
    const base = h * (0.1 + 0.8 * hash(k, 3)), amp = h * (0.08 + 0.1 * hash(k, 4)), f = 0.08 + 0.1 * hash(k, 5), sp = (k & 1 ? 1 : -1) * (2 + hash(k, 6) * 2)
    for (let x = 0; x < w; x++) {
      const y = base + Math.sin(x * f + t * sp + k) * amp
      cv.blend(x, y, K.crimson, 0.7 * e); cv.glow(x, y - 1, K.pink, 0.45 * e); cv.glow(x, y + 1, K.pink, 0.3 * e)
    }
  }
}
function antman(cv: Canvas, u: number, e: number) {
  const cx = cv.w / 2, cy = cv.h / 2, R = Math.min(Math.hypot(cv.w * PXW, cv.h) * 0.5, cv.h * 0.9)
  const m = u < 0.5 ? 1 - 0.88 * easeInOut(u * 2) : 0.12 + 0.88 * easeInOut(u * 2 - 1)
  for (let k = 0; k < 5; k++) ringA(cv, cx, cy, (R * (k + 1) * m) / 5, 1.5, k & 1 ? K.blue : K.red, e)
  halo(cv, cx, cy, R * 0.25 * (1.3 - m), WHITE, 0.4 * e)
  const inset = (1 - m) * Math.min(cv.w, cv.h) * 0.3 + 2, l = 6
  for (let sx = 0; sx < 2; sx++) for (let sy = 0; sy < 2; sy++) {
    const x = sx ? cv.w - 1 - inset : inset, y = sy ? cv.h - 1 - inset : inset
    thick(cv, x, y, x + (sx ? -l : l), y, 0.5, K.yellow, e); thick(cv, x, y, x, y + (sy ? -l : l) / 2, 0.5, K.yellow, e)
  }
}
function panther(cv: Canvas, u: number, e: number) {
  const cx = cv.w / 2, cy = cv.h / 2, R = Math.hypot(cv.w * PXW, cv.h) * 0.52
  wash(cv, K.purple, 0.22 * e)
  halo(cv, cx, cy, R * 0.4 * (1 - u * 0.5), K.violet, 0.8 * e)
  for (let k = 0; k < 4; k++) {
    const p = clamp01((u - k * 0.08) / 0.7)
    ringA(cv, cx, cy, R * easeOut(p), 3 * (1 - p) + 0.6, k & 1 ? WHITE : K.violet, e * (1 - p * 0.6))
  }
}
function vision(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, x0 = w * 0.1, y0 = h * 0.3, y1 = h * 0.62, reach = (w - x0) * easeOut(u * 6), maxTh = Math.max(2, h * 0.14)
  wash(cv, K.yellow, 0.2 * e)
  for (let x = Math.floor(x0); x < x0 + reach; x++) {
    const t = (x - x0) / (w - x0), yc = y0 + (y1 - y0) * t + Math.sin(x * 0.35 - u * 22) * 1.2, th = (1 + (maxTh - 1) * t) * (0.5 + 0.5 * e)
    for (let y = Math.max(0, Math.floor(yc - th)); y <= Math.min(h - 1, Math.ceil(yc + th)); y++) {
      const f = 1 - Math.abs(y + 0.5 - yc) / th
      if (f > 0) cv.blend(x, y, lerp(K.yellow, WHITE, clamp01(f * 1.5 - 0.6)), Math.min(1, f * 1.5) * e)
    }
  }
  halo(cv, x0, y0, h * 0.3, K.yellow, 0.9 * e)
}
function loki(cv: Canvas, u: number, e: number) {
  const h = cv.h, W = cv.W, s = Math.floor(u * 6), p = cv.px
  for (let i = 0; i < 7; i++) {
    const by = Math.floor(hash(s, i) * h), bh = 2 + Math.floor(hash(s, i + 9) * 7), sh = Math.round((6 + hash(s, i + 20) * 40) * e) * (hash(s, i + 30) < 0.5 ? -1 : 1)
    for (let y = by; y < Math.min(h, by + bh); y++) {
      const o = y * W
      if (sh > 0 && sh < W) p.copyWithin(o + sh, o, o + W - sh)
      else if (sh < 0 && -sh < W) p.copyWithin(o, o - sh, o + W)
      for (let xs = 0; xs < W; xs += 1) cv.blendSub(xs, y, hash(y, s) > 0.5 ? K.green : K.lime, 0.28 * e)
    }
  }
  wash(cv, K.green, 0.12 * e)
  for (let i = 0; i < 5; i++) { const x = hash(s, i + 50) * cv.w; thick(cv, x, 0, x, h - 1, 0.5, K.lime, 0.35 * e) }
}
function ultron(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, W = cv.W, sw = (h + 4) * easeInOut(clamp01(u * 1.2)) - 2, s = Math.floor(u * 8)
  for (let y = 0; y < h; y++) {
    const a = (y & 1 ? 0.28 : 0.1) * e * (y < sw ? 1.4 : 0.6)
    for (let xs = 0; xs < W; xs++) cv.blendSub(xs, y, K.crimson, a)
  }
  for (let y = Math.max(0, Math.floor(sw)); y < Math.min(h, Math.floor(sw) + 3); y++) for (let xs = 0; xs < W; xs++) cv.blendSub(xs, y, K.red, 0.6 * e)
  for (let i = 0; i < 6; i++) { const bx = Math.floor(hash(s, i) * w), by = Math.floor(hash(s, i + 7) * h); for (let y = by; y < Math.min(h, by + 2 + (i & 3)); y++) for (let x = bx; x < Math.min(w, bx + 6 + 4 * i); x++) cv.blend(x, y, K.red, 0.5 * e) }
}
function fury(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, inset = 2 + (1 - easeOut(u * 4)) * Math.min(w, h) * 0.4, l = Math.max(6, w * 0.12), cx = w / 2, cy = h / 2
  wash(cv, K.amber, 0.12 * e)
  for (let sx = 0; sx < 2; sx++) for (let sy = 0; sy < 2; sy++) {
    const x = sx ? w - 1 - inset : inset, y = sy ? h - 1 - inset : inset, dx = sx ? -l : l, dy = sy ? -l * 0.4 : l * 0.4
    thick(cv, x, y, x + dx, y, 0.9 * e + 0.2, K.amber, e); thick(cv, x, y, x, y + dy, 0.9 * e + 0.2, K.amber, e)
  }
  const g = 3 + (1 - easeOut(u * 3)) * 6
  thick(cv, cx - g - 8, cy, cx - g, cy, 0.5, K.amber, e); thick(cv, cx + g, cy, cx + g + 8, cy, 0.5, K.amber, e)
  thick(cv, cx, cy - g * 0.5 - 4, cx, cy - g * 0.5, 0.5, K.amber, e); thick(cv, cx, cy + g * 0.5, cx, cy + g * 0.5 + 4, 0.5, K.amber, e)
  ringA(cv, cx, cy, g + 2, 1, K.amber, 0.8 * e)
  for (let x = Math.floor(inset); x < w - inset; x += 4) { cv.blend(x, inset + 2, K.amber, 0.7 * e); cv.blend(x, h - 3 - inset, K.amber, 0.7 * e) }
}
function deadpool(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, reach = h * easeOut(u * 6), gap = w * 0.1 * easeOut(u * 5) * e
  wash(cv, K.hot, 0.14 * e)
  for (let y = 0; y < Math.min(h, reach); y++) {
    const xc = w * 0.5 + (hash(Math.floor(y / 2), 7) - 0.5) * w * 0.1 + Math.sin(y * 0.4) * 2, g = gap * (0.5 + 0.5 * hash(Math.floor(y / 3), 8)) + 0.5
    for (let xs = Math.floor((xc - g) * 2); xs <= Math.ceil((xc + g) * 2); xs++) {
      const f = Math.abs((xs + 0.5) / 2 - xc) / g
      cv.setSub(xs, y, f > 0.86 ? K.paper : lerp(K.hot, K.darkRed, 1 - f))
    }
  }
  for (let i = 0; i < 8; i++) { const y = h * hash(i, 1) * (reach / h), x = w * 0.5 + (hash(i, 2) - 0.5) * gap * 3; cv.blend(x, y, K.paper, e) }
}
function jarvis(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, sx = (w + 24) * easeInOut(clamp01(u / 0.85)) - 12
  for (let dx = 0; dx < 24; dx++) {
    const x = Math.floor(sx - dx), f = (1 - dx / 24) ** 2
    if (x < 0 || x >= w) continue
    for (let y = 0; y < h; y++) cv.blend(x, y, K.cyan, (0.32 * f + (y % 6 === 0 ? 0.18 * f : 0)) * e)
  }
  for (let y = 0; y < h; y++) { cv.blend(sx, y, WHITE, 0.7 * e); cv.blend(sx + 1, y, K.cyan, 0.9 * e) }
  for (let x = 0; x < w; x += 5) { cv.blend(x, 1, K.cyan, 0.7 * e); cv.blend(x, h - 2, K.cyan, 0.7 * e) }
  thick(cv, 0, 0, w - 1, 0, 0.5, K.cyan, 0.8 * e); thick(cv, 0, h - 1, w - 1, h - 1, 0.5, K.cyan, 0.8 * e)
}
function thanos(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h
  wash(cv, K.purple, 0.25 * e)
  for (let i = 0; i < 140; i++) {
    const sp = 0.5 + hash(i, 2), x = hash(i, 1) * w * 0.9 - w * 0.1 + u * w * 0.5 * sp, y = hash(i, 3) * h + Math.sin(u * 6 + i) * 1.5 - u * h * 0.2 * sp
    const k = i % 3, c = k === 0 ? K.gold : k === 1 ? K.violet : K.purple
    cv.blend(x, y, c, e * (0.5 + 0.5 * hash(i, 4)))
    if (k === 0) cv.glow(x, y, K.gold, 0.4 * e)
  }
}
function yondu(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, head = 4 * easeOut(u * 2.2)
  wash(cv, K.red, 0.18 * e)
  let hx = 0, hy = h * 0.2
  for (let i = 0; i < 4; i++) {
    if (head <= i) break
    const t = Math.min(1, head - i), x0 = (w * i) / 4, y0 = i & 1 ? h * 0.8 : h * 0.2, x1 = (w * (i + 1)) / 4, y1 = i & 1 ? h * 0.2 : h * 0.8, x2 = x0 + (x1 - x0) * t, y2 = y0 + (y1 - y0) * t
    thick(cv, x0, y0, x2, y2, 1.4 * e, K.red, 0.8 * e); thick(cv, x0, y0, x2, y2, 0.5, K.pink, e)
    hx = x2; hy = y2
  }
  halo(cv, hx, hy, 5, K.red, e); halo(cv, hx, hy, 2.5, WHITE, e)
}
function groot(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, len = w * 0.42 * easeOut(u * 3)
  wash(cv, K.vine, 0.14 * e)
  for (let i = 0; i < 5; i++) for (let side = 0; side < 2; side++) {
    const y0 = (h * (i + 0.5)) / 5 + side * 2, amp = h * 0.07, f = 0.3 + 0.1 * hash(i, side)
    let lx = side ? w : -1, ly = y0
    for (let d = 1; d < len; d++) {
      const x = side ? w - d : d - 1, y = y0 + Math.sin(d * f + i * 2) * amp * Math.min(1, d / 8)
      thick(cv, lx, ly, x, y, 0.6 * e + 0.2, (i + d) & 4 ? K.vine : K.vine2, e)
      if (d % 7 === 3) { thick(cv, x, y, x + (side ? -2 : 2), y - 2 - (d & 1), 0.5, K.vine2, e); thick(cv, x, y, x + (side ? -2 : 2), y + 2 + (d & 1), 0.5, K.vine, e) }
      lx = x; ly = y
    }
  }
}
function rocket(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h, fx = w * 0.08, fy = h * 0.55, f = Math.max(0, 1 - u * 2.2), R = h * 0.7
  wash(cv, K.orange, 0.22 * f * e)
  halo(cv, fx, fy, R * (0.3 + 0.7 * f) * Math.max(e, 0.2), K.yellow, 0.9 * f); halo(cv, fx, fy, R * 0.18 * f, WHITE, 0.9 * f)
  spokes(cv, fx, fy, 8, 1, R * (0.4 + 0.6 * f), 0.2, 0.5 + f, K.yellow, f * 0.9)
  for (let i = 0; i < 6; i++) {
    const ty = fy + (i - 2.5) * h * 0.12, ang = (i - 2.5) * 0.05, t = clamp01(u * 3.5 - i * 0.1), x1 = fx + (w - fx + 10) * t, x0 = Math.max(fx, x1 - w * 0.3)
    thick(cv, x0, ty + (x0 - fx) * ang, x1, ty + (x1 - fx) * ang, 0.5, i & 1 ? K.yellow : K.orange, e); halo(cv, x1, ty + (x1 - fx) * ang, 2.5, WHITE, 0.7 * e)
  }
}
function cmarvel(cv: Canvas, u: number, e: number) {
  const cx = cv.w / 2, cy = cv.h / 2, R = Math.hypot(cv.w * PXW, cv.h) * 0.55 * easeOut(u * 3)
  wash(cv, K.gold, 0.3 * e)
  spokes(cv, cx, cy, 18, R * 0.1, R, u * 0.6, 1.2 * e + 0.3, K.gold, 0.8 * e)
  spokes(cv, cx, cy, 18, R * 0.1, R * 0.7, u * 0.6 + TAU / 36, 0.5, WHITE, 0.8 * e)
  halo(cv, cx, cy, R * 0.45, WHITE, 0.8 * e); halo(cv, cx, cy, R * 0.9, K.yellow, 0.5 * e)
  ringA(cv, cx, cy, R * 0.8, 1.2, K.red, 0.7 * e)
}
function starlord(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h
  for (let i = 0; i < 5; i++) {
    const p = clamp01((u - i * 0.1) / 0.45)
    if (p <= 0) continue
    const x = w * (0.15 + 0.7 * hash(i, 1)), y = h * (0.2 + 0.6 * hash(i, 2)), r = h * 0.4 * easeOut(p), a = e * (1 - p * 0.6)
    thick(cv, 2, h - 3, x, y, 0.5, K.yellow, 0.5 * a * (1 - p))
    halo(cv, x, y, r, K.orange, a); halo(cv, x, y, r * 0.4, K.yellow, a)
    ringA(cv, x, y, r * 1.1, 1.2, i & 1 ? K.cyan : K.orange, a)
    spokes(cv, x, y, 6, r * 0.5, r * 1.3, i, 0.5, K.yellow, a)
  }
  wash(cv, K.orange, 0.15 * e)
}
function wolverine(cv: Canvas, u: number, e: number) {
  const w = cv.w, h = cv.h
  wash(cv, K.hot, 0.1 * e)
  for (let i = 0; i < 3; i++) {
    const p = clamp01((u - 0.04 * i) / 0.22), sx = w * (0.55 + 0.17 * i), ex = sx - w * 0.38, n = Math.max(8, Math.ceil(h * 1.3))
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n
      if (t1 > p) break
      const r = 0.7 + (h / 22) * Math.sin(Math.PI * t0) + 0.4, x0 = sx + (ex - sx) * t0, y0 = -2 + (h + 4) * t0, x1 = sx + (ex - sx) * t1, y1 = -2 + (h + 4) * t1
      thick(cv, x0, y0, x1, y1, (r + 0.9) * e, K.darkRed, 0.9 * e)
      thick(cv, x0, y0, x1, y1, r * e, K.steel, e)
    }
  }
}

const DRAW: Record<BurstKind, (cv: Canvas, u: number, e: number) => void> = {
  THOR: thor, HULK: hulk, IRONMAN: ironman, CAP: cap, WIDOW: widow, HAWKEYE: hawkeye, SPIDEY: spidey, STRANGE: strange, WANDA: wanda, ANTMAN: antman, PANTHER: panther, VISION: vision,
  LOKI: loki, ULTRON: ultron, FURY: fury, DEADPOOL: deadpool, JARVIS: jarvis, THANOS: thanos, YONDU: yondu, GROOT: groot, ROCKET: rocket, CMARVEL: cmarvel, STARLORD: starlord, WOLVERINE: wolverine,
}
// The one comic word per burst: text, ink colour, background, row (fraction of the height).
const WORD: Record<BurstKind, [string, number, number, number]> = {
  THOR: ['KRAKA-THOOM!', INK, K.yellow, 0.82], HULK: ['SMASH!', INK, K.lime, 0.12], IRONMAN: ['BWAAAM!', INK, K.cyan, 0.72], CAP: ['CLANG!', WHITE, K.red, 0.12], WIDOW: ['BZZT!', INK, K.cyan, 0.8],
  HAWKEYE: ['BOOM!', INK, K.yellow, 0.15], SPIDEY: ['THWIP!', WHITE, K.red, 0.5], STRANGE: ['SHAZAM!', INK, K.orange, 0.88], WANDA: ['HEX!', WHITE, K.crimson, 0.85], ANTMAN: ['PINK!', WHITE, K.red, 0.85],
  PANTHER: ['WAKANDA!', WHITE, K.purple, 0.85], VISION: ['ZAAAP!', INK, K.yellow, 0.82], LOKI: ['GLITCH!', INK, K.lime, 0.85], ULTRON: ['OBSOLETE', WHITE, K.red, 0.85], FURY: ['S.H.I.E.L.D.', INK, K.amber, 0.8],
  DEADPOOL: ['RIIIP!', WHITE, K.hot, 0.85], JARVIS: ['SCANNING', INK, K.cyan, 0.85], THANOS: ['SNAP.', INK, K.gold, 0.85], YONDU: ['FWEEET!', WHITE, K.red, 0.88], GROOT: ['GROOT!', INK, K.vine2, 0.88],
  ROCKET: ['BLAM!', INK, K.yellow, 0.15], CMARVEL: ['PHOTON!', INK, K.gold, 0.88], STARLORD: ['BLAST!', INK, K.orange, 0.88], WOLVERINE: ['SNIKT!', INK, K.steel, 0.85],
}

export function drawBurst(cv: Canvas, kind: BurstKind, u: number): void {
  if (!(u > 0) || u >= 1) return
  const e = u < 0.1 ? u / 0.1 : u > 0.7 ? (1 - u) / 0.3 : 1
  DRAW[kind](cv, u, e)
  const [s, fg, bg, row] = WORD[kind]
  if (u > 0.14 && u < 0.8 && cv.w >= s.length + 2) cv.text(Math.floor((cv.w - s.length) / 2), Math.min(cv.rows - 1, Math.floor(cv.rows * row)), s, fg, bg)
}

// ── terminal transcript during the burst ────────────────────────────────────
const TINT: Record<BurstKind, string> = {
  THOR: '#0a1a3a', HULK: '#0c2a10', IRONMAN: '#2a1208', CAP: '#0c1438', WIDOW: '#0a1830', HAWKEYE: '#2a1606', SPIDEY: '#2a0a10', STRANGE: '#2a1606', WANDA: '#2a0614', ANTMAN: '#1a0a2a',
  PANTHER: '#1c0c33', VISION: '#2a2406', LOKI: '#0a2a14', ULTRON: '#2a0608', FURY: '#2a1c04', DEADPOOL: '#2a060a', JARVIS: '#06222a', THANOS: '#1c0c2a', YONDU: '#2a080a', GROOT: '#0c2610',
  ROCKET: '#2a1606', CMARVEL: '#2a2006', STARLORD: '#2a1406', WOLVERINE: '#2a1a06',
}
const SHAKE: Partial<Record<BurstKind, number[]>> = { THOR: [2, 0, 1], HULK: [3, 0, 2], CAP: [1, 0, 1], ROCKET: [2, 0, 1], WOLVERINE: [2, 1, 0], DEADPOOL: [1, 0, 1], THANOS: [0, 1, 0] }
const dim = (hex: string, k: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')
const FX = {} as Record<BurstKind, ({ bg?: string; pad?: number } | null)[]>
for (const k of BURST_KINDS) {
  const sh = SHAKE[k]
  FX[k] = [0, 1, 2, 3].map(q => q === 3 ? null : { bg: q === 2 ? dim(TINT[k], 0.5) : TINT[k], ...(sh && sh[q] ? { pad: sh[q] } : {}) })
}
export function transcriptFx(kind: BurstKind, u: number): { bg?: string; pad?: number } | null {
  if (!(u >= 0) || u >= 0.75) return null
  return FX[kind][Math.min(3, Math.floor(u * 4))]!
}

// ── who fires which burst ───────────────────────────────────────────────────
const FX_KIND: Record<string, BurstKind> = {
  bolt: 'THOR', hammer: 'THOR', unibeam: 'IRONMAN', repulsor: 'IRONMAN', shield: 'CAP', web: 'SPIDEY', hex: 'WANDA', portal: 'STRANGE', smash: 'HULK', gauntlet: 'THANOS', yaka: 'YONDU', vines: 'GROOT',
  gun: 'ROCKET', photon: 'CMARVEL', claws: 'WOLVERINE', kinetic: 'PANTHER', mind: 'VISION', illusion: 'LOKI', laser: 'ULTRON', bite: 'WIDOW', arrow: 'HAWKEYE', shrink: 'ANTMAN', katana: 'DEADPOOL', teleport: 'DEADPOOL',
}
const CHAR_KIND: Record<string, BurstKind> = {
  HULKBUSTER: 'IRONMAN', RESCUE: 'IRONMAN', WARMACHINE: 'IRONMAN', GIANTMAN: 'ANTMAN', NEBULA: 'STARLORD', GAMORA: 'STARLORD', DRAX: 'STARLORD', MANTIS: 'STARLORD',
  BLACKWIDOW: 'WIDOW', SPIDERMAN: 'SPIDEY', DOCTORSTRANGE: 'STRANGE', SCARLETWITCH: 'WANDA', BLACKPANTHER: 'PANTHER', CAPTAINAMERICA: 'CAP', CAPTAINMARVEL: 'CMARVEL', IRONMAN: 'IRONMAN',
  WINTERSOLDIER: 'CAP', FALCON: 'CAP', GAMORAS: 'STARLORD', STARLORD: 'STARLORD',
}
export function burstFor(char: string, fx?: string): BurstKind {
  if (fx) { const f = FX_KIND[fx.toLowerCase()]; if (f) return f }
  const id = char.toUpperCase().replace(/[^A-Z]/g, '')
  const c = CHAR_KIND[id]
  if (c) return c
  return (BURST_KINDS as readonly string[]).includes(id) ? (id as BurstKind) : 'JARVIS'
}
