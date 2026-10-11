// clarvis arcade: STARK ARCADE · ULTRON SIEGE, the game itself.
// Pure logic + a truecolor framebuffer (1 px = 1 column x half a row), encoded
// to runs of half-block cells ('▀': top pixel = fg, bottom = bg) with text
// overlays. No `$`, no elements, no timers: arcade.tsx drives it on the
// drawing thread; tests and the preview script drive it headless.
// Every pool is fixed-size, so nothing grows while you play.
import * as SP from './arcade-sprites'

// ── colour ──────────────────────────────────────────────────────────────────
const R = (c: number) => (c >> 16) & 255, G = (c: number) => (c >> 8) & 255, B = (c: number) => c & 255
const k01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)
export function mix(a: number, b: number, t: number) {
  const k = k01(t)
  return (((R(a) + (R(b) - R(a)) * k) | 0) << 16) | (((G(a) + (G(b) - G(a)) * k) | 0) << 8) | ((B(a) + (B(b) - B(a)) * k) | 0)
}
export function addc(a: number, b: number, t: number) {
  const k = k01(t)
  return (Math.min(255, R(a) + R(b) * k) << 16) | (Math.min(255, G(a) + G(b) * k) << 8) | Math.min(255, (B(a) + B(b) * k) | 0)
}
const hexc = (h: string) => parseInt(h.slice(1), 16)
export const ease = (t: number) => 1 - (1 - k01(t)) ** 3
export const easeBack = (t: number) => { t = k01(t); const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }

export const C = {
  bg: 0x1b1b29, ink: 0x07060c, white: 0xffffff,
  gold: 0xf5c542, gold2: 0xffe08a, red: 0xd8262f, red2: 0xff5a4a, arc: 0x38c4f0, arc2: 0xa6f1ff,
  ultron: 0xff3a2e, hulk: 0x46a034, hulk2: 0x9be36e, bolt: 0x9db8ff, bolt2: 0xe4efff, cap: 0x3f74f0,
  dim: 0x8c90b4, text: 0xe6e6f5, hudbg: 0x10101c,
}

// ── sprites: the baked 3D sheets, decoded once ─────────────────────────────
export type Spr = { w: number; h: number; n: number; px: Int32Array; a: Uint8Array }
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export function unb64(s: string): Uint8Array {
  const map = new Int8Array(128).fill(-1)
  for (let i = 0; i < 64; i++) map[B64.charCodeAt(i)] = i
  let n = s.length
  while (n && s[n - 1] === '=') n--
  const out = new Uint8Array((n * 3) >> 2)
  let acc = 0, bits = 0, o = 0
  for (let i = 0; i < n; i++) {
    acc = (acc << 6) | map[s.charCodeAt(i)]!; bits += 6
    if (bits >= 8) { bits -= 8; out[o++] = (acc >> bits) & 255 }
  }
  return out
}
export function decode(s: { w: number; h: number; n: number; data: string }): Spr {
  const b = unb64(s.data), N = s.w * s.h * s.n, px = new Int32Array(N), a = new Uint8Array(N)
  for (let i = 0; i < N; i++) { px[i] = (b[i * 4]! << 16) | (b[i * 4 + 1]! << 8) | b[i * 4 + 2]!; a[i] = b[i * 4 + 3]! }
  return { w: s.w, h: s.h, n: s.n, px, a }
}
let SPR: Record<'im' | 'drone' | 'heavy' | 'prime' | 'shield' | 'helmet' | 'hammer' | 'reactor' | 'fist', Spr> | undefined
export function sprites() {
  return (SPR ??= {
    im: decode(SP.IRONMAN), drone: decode(SP.DRONE), heavy: decode(SP.HEAVY), prime: decode(SP.PRIME),
    shield: decode(SP.SHIELD), helmet: decode(SP.HELMET), hammer: decode(SP.HAMMER), reactor: decode(SP.REACTOR), fist: decode(SP.FIST),
  })
}

// ── a 5x7 pixel font for the big words ─────────────────────────────────────
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
  '!': [4, 4, 4, 4, 4, 0, 4], '-': [0, 0, 0, 31, 0, 0, 0], '.': [0, 0, 0, 0, 0, 0, 4], ':': [0, 4, 0, 0, 0, 4, 0], '?': [14, 17, 1, 2, 4, 0, 4], ' ': [0, 0, 0, 0, 0, 0, 0],
}
export const bigWidth = (s: string, sx: number, gap = sx) => s.length * (5 * sx + gap) - gap

// A sheet resampled by k (every frame): area-averaged when shrinking, so a
// small pane still shows a clean little figure; nearest when growing. Cached.
const SCALED = new Map<Spr, Map<number, Spr>>()
export function scaleSpr(s: Spr, k: number): Spr {
  k = Math.round(k * 20) / 20
  if (k === 1) return s
  let byK = SCALED.get(s)
  if (!byK) SCALED.set(s, (byK = new Map()))
  const hit = byK.get(k)
  if (hit) return hit
  const w = Math.max(1, Math.round(s.w * k)), h = Math.max(1, Math.round(s.h * k)), n = s.n
  const px = new Int32Array(w * h * n), a = new Uint8Array(w * h * n)
  for (let f = 0; f < n; f++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx0 = x / k, sx1 = (x + 1) / k, sy0 = y / k, sy1 = (y + 1) / k
    let r = 0, g = 0, b = 0, al = 0, cnt = 0
    for (let yy = Math.floor(sy0); yy < Math.max(Math.floor(sy0) + 1, Math.ceil(sy1)); yy++) for (let xx = Math.floor(sx0); xx < Math.max(Math.floor(sx0) + 1, Math.ceil(sx1)); xx++) {
      if (xx >= s.w || yy >= s.h) continue
      const i = f * s.w * s.h + yy * s.w + xx, aa = s.a[i]!
      cnt++
      if (aa < 20) continue
      const c = s.px[i]!
      r += ((c >> 16) & 255) * aa; g += ((c >> 8) & 255) * aa; b += (c & 255) * aa; al += aa
    }
    const o = f * w * h + y * w + x
    if (al > 0) { px[o] = ((r / al) << 16) | ((g / al) << 8) | (b / al) | 0; a[o] = Math.min(255, Math.round((al / Math.max(1, cnt)) * 1.35)) }
  }
  const out = { w, h, n, px, a }
  byK.set(k, out)
  return out
}

// Word-wraps text to a width: lines never cut mid-word unless a word is longer than the width.
export function wrap(text: string, width: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) {
      if (!line) line = word
      else if (line.length + 1 + word.length <= width) line += ' ' + word
      else { out.push(line); line = word }
      while (line.length > width) { out.push(line.slice(0, width)); line = line.slice(width) }
    }
    out.push(line)
  }
  return out
}

// ── the framebuffer ─────────────────────────────────────────────────────────
export class FB {
  readonly px: Int32Array
  readonly och: Uint16Array // overlay glyph per cell (0 = none)
  readonly ocol: Int32Array // its colour
  readonly obg: Int32Array // a cell background override (-1 = the pixels')
  readonly rows: number
  constructor(readonly W: number, readonly H: number) {
    this.rows = H >> 1
    this.px = new Int32Array(W * H)
    this.och = new Uint16Array(W * this.rows); this.ocol = new Int32Array(W * this.rows); this.obg = new Int32Array(W * this.rows).fill(-1)
  }
  clearOverlay() { this.och.fill(0); this.obg.fill(-1) }
  set(x: number, y: number, c: number) {
    x |= 0; y |= 0
    if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.px[y * this.W + x] = c
  }
  blend(x: number, y: number, c: number, a: number) {
    x = Math.round(x); y = Math.round(y)
    if (a <= 0.02 || x < 0 || y < 0 || x >= this.W || y >= this.H) return
    const i = y * this.W + x
    this.px[i] = a >= 0.98 ? c : mix(this.px[i]!, c, a)
  }
  add(x: number, y: number, c: number, a: number) {
    x = Math.round(x); y = Math.round(y)
    if (a <= 0.02 || x < 0 || y < 0 || x >= this.W || y >= this.H) return
    const i = y * this.W + x
    this.px[i] = addc(this.px[i]!, c, a)
  }
  rect(x: number, y: number, w: number, h: number, c: number, a = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.blend(x + i, y + j, c, a)
  }
  // a sprite sheet frame, top-left at x, y; `flash` whitens, `tint` recolours
  spr(s: Spr, k: number, x: number, y: number, flash = 0, alpha = 1, tint = -1, tintAmt = 0, flip = false, outline = false) {
    const f = (((k | 0) % s.n) + s.n) % s.n, base = f * s.w * s.h, x0 = Math.round(x), y0 = Math.round(y)
    for (let j = 0; j < s.h; j++) {
      const yy = y0 + j
      if (yy < 0 || yy >= this.H) continue
      for (let i = 0; i < s.w; i++) {
        const xx = x0 + i
        if (xx < 0 || xx >= this.W) continue
        const si = base + j * s.w + (flip ? s.w - 1 - i : i), a = (s.a[si]! / 255) * alpha
        if (a < 0.1) continue
        let c = s.px[si]!
        if (tint >= 0) c = mix(c, tint, tintAmt)
        if (flash > 0) {
          // a hurt flash lights the outline only (negative flash): the hero keeps their colours
          if (flash < 0 || outline) {
            const fx = flip ? s.w - 1 - i : i, edge = fx === 0 || fx === s.w - 1 || j === 0 || j === s.h - 1 || s.a[si - 1]! < 26 || s.a[si + 1]! < 26 || s.a[si - s.w]! < 26 || s.a[si + s.w]! < 26
            if (edge) c = mix(c, 0xffffff, flash)
          } else c = mix(c, 0xffffff, flash)
        }
        const o = yy * this.W + xx
        this.px[o] = a > 0.9 ? c : mix(this.px[o]!, c, a)
      }
    }
  }
  // additive radial light; r in px
  glow(cx: number, cy: number, r: number, c: number, a = 1) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.W - 1, Math.ceil(cx + r))
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.H - 1, Math.ceil(cy + r))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.2) / r
      // light in a few bands, pixel-art style (and far fewer distinct colours to send)
      if (d < 1) { const k = Math.round((1 - d) * (1 - d) * a * 6) / 6; if (k > 0) { const i = y * this.W + x; this.px[i] = addc(this.px[i]!, c, k) } }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, a = 1, add = true) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n
      if (add) this.add(x, y, c, a); else this.blend(x, y, c, a)
    }
  }
  ring(cx: number, cy: number, r: number, th: number, c: number, a = 1) {
    const x0 = Math.max(0, Math.floor(cx - r - th)), x1 = Math.min(this.W - 1, Math.ceil(cx + r + th))
    const y0 = Math.max(0, Math.floor(cy - r - th)), y1 = Math.min(this.H - 1, Math.ceil(cy + r + th))
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.abs(Math.hypot(x - cx, (y - cy) * 1.2) - r) / th
      if (d < 1) this.add(x, y, c, (1 - d) * a)
    }
  }
  // big pixel letters: gradient fill (top→bottom), ink outline, drop shadow
  big(s: string, x: number, y: number, sx: number, sy: number, top: number, bot: number, o: { outline?: number; shadow?: number; alpha?: number; shine?: number; gap?: number } = {}) {
    const a = o.alpha ?? 1, H = 7 * sy, adv = 5 * sx + (o.gap ?? sx)
    const each = (fn: (px: number, py: number, fy: number) => void) => {
      for (let n = 0; n < s.length; n++) {
        const g = FONT[s[n]!.toUpperCase()] ?? FONT[' ']!
        for (let r = 0; r < 7; r++) for (let b = 0; b < 5; b++) if (g[r]! & (16 >> b))
          for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) fn(x + n * adv + b * sx + i, y + r * sy + j, (r * sy + j) / (H - 1))
      }
    }
    if (o.shadow !== undefined) each((px, py) => this.blend(px + sx, py + sy, o.shadow!, 0.75 * a))
    if (o.outline !== undefined) each((px, py) => { for (let d = 0; d < 8; d++) this.blend(px + [1, -1, 0, 0, 1, 1, -1, -1][d]!, py + [0, 0, 1, -1, 1, -1, 1, -1][d]!, o.outline!, a) })
    each((px, py, fy) => {
      let c = mix(top, bot, fy)
      if (o.shine !== undefined) { const d = Math.abs(px - y * 0.5 - o.shine - (py - y)); if (d < 3) c = mix(c, 0xffffff, (1 - d / 3) * 0.8) }
      this.blend(px, py, c, a)
    })
  }
  // crisp terminal text over the pixels, at a cell (col, row)
  text(col: number, row: number, s: string, color: number, bg = -1) {
    col |= 0; row |= 0
    if (row < 0 || row >= this.rows) return
    for (let i = 0; i < s.length; i++) {
      const x = col + i
      if (x < 0 || x >= this.W) continue
      const o = row * this.W + x
      this.och[o] = s.charCodeAt(i); this.ocol[o] = color
      if (bg >= 0) this.obg[o] = bg
    }
  }
  textC(row: number, s: string, color: number, bg = -1) { this.text(Math.floor((this.W - s.length) / 2), row, s, color, bg) }
  // A headline that obeys the visibility rules for an arena A px tall: big
  // letters only while they take at most a quarter of it (2x from 56 px, 1x
  // from 28), else one crisp text row. Anchored at y (px) under the HUD, never
  // centred on the action. Returns the px height used.
  headline(s: string, y: number, top: number, bot: number, alpha = 1, maxSc = 2) {
    const A = this.H
    for (const sc of [2, 1]) {
      if (sc > maxSc) continue
      if (A < (sc === 2 ? 56 : 28) || 7 * sc > A * 0.25 + 0.5 || bigWidth(s, sc, 1) > this.W - 4) continue
      this.big(s, Math.floor((this.W - bigWidth(s, sc, 1)) / 2), y, sc, sc, top, bot, { outline: 0x07060c, shadow: 0x020104, gap: 1, alpha })
      return 7 * sc + 2
    }
    if (alpha > 0.3) this.textC(y >> 1, ' ' + s + ' ', alpha > 0.6 ? mix(top, 0xffffff, 0.3) : mix(top, 0x404050, 0.5), mix(bot, 0x000000, 0.65))
    return 2
  }
  darken(x: number, y: number, w: number, h: number, k: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const xx = x + i, yy = y + j
      if (xx < 0 || yy < 0 || xx >= this.W || yy >= this.H) continue
      const o = yy * this.W + xx; this.px[o] = mix(this.px[o]!, 0x07060e, k)
    }
  }
}

// ── encoding: framebuffer → runs of cells ──────────────────────────────────
// A run is text drawn in one fg/bg; `b` bold. fg -1 means "any" (spaces only).
export type Run = { s: string; fg: number; bg: number; b?: boolean }
const HALF = '▀', LOWER = '▄', FULL = '█'
export function encodeRow(fb: FB, row: number, mask: number, out: Run[]) {
  out.length = 0
  const W = fb.W, px = fb.px
  let s = '', fg = -1, bg = -1
  const flush = () => { if (s) out.push({ s, fg, bg }); s = '' }
  for (let x = 0; x < W; x++) {
    const o = row * W + x, ch = fb.och[o]!
    if (ch) {
      const top = px[2 * row * W + x]!, bot = px[(2 * row + 1) * W + x]!
      const b = (fb.obg[o]! >= 0 ? fb.obg[o]! : mix(top, bot, 0.5)) & mask, f = fb.ocol[o]! & mask
      if (!(s && b === bg && (fg === f || fg === -1))) { flush(); bg = b }
      fg = f; s += String.fromCharCode(ch)
      continue
    }
    const t = px[2 * row * W + x]! & mask, b = px[(2 * row + 1) * W + x]! & mask
    if (s) {
      if (t === b) {
        if (t === bg) { s += ' '; continue }
        if (t === fg) { s += FULL; continue }
      } else if (t === fg && b === bg) { s += HALF; continue }
      else if (t === bg && b === fg) { s += LOWER; continue }
      else if (fg === -1 && b === bg) { fg = t; s += HALF; continue }
      else if (fg === -1 && t === bg) { fg = b; s += LOWER; continue }
    }
    flush()
    if (t === b) { fg = -1; bg = t; s = ' ' } else { fg = t; bg = b; s = HALF }
  }
  flush()
  return out
}

// ── the game ────────────────────────────────────────────────────────────────
type Mode = 'title' | 'howto' | 'play' | 'pause' | 'over' | 'vs'
// Every game on the title menu, each with its own colour: a solid plate with
// white text (readable over anything), brighter when picked.
export const MENU: { label: string; bg: number; hi: number }[] = [
  { label: 'ULTRON SIEGE · shoot down the drones', bg: 0x8e1a26, hi: 0xc42232 },
  { label: 'CIVIL WAR · 3 vs 3 at the airport', bg: 0x1b3f8a, hi: 0x2a5cc4 },
  { label: 'ARENA · Iron Man vs Thor, or anyone', bg: 0x4a3196, hi: 0x6a48d0 },
  { label: 'ARENA · Hulkbuster vs Hulk, or anyone', bg: 0x23642a, hi: 0x2f8a38 },
  { label: 'ENDGAME · face Thanos and the snap', bg: 0x5c2a7a, hi: 0x8a3cb8 },
]

// HOW TO PLAY, per game: three columns (MOVE, FIGHT, WIN) and one gold
// SIGNATURE line, 5 rows at most at any width; shown before every game.
const DUEL_MOVE = ['←→ step · ←← run', '↑ jump · ↓ guard']
const DUEL_FIGHT = ['SPACE ×3 → C → X', '→ + SPACE throw']
export const HOWTO: { move: string[]; fight: string[]; win: string[]; sig: string }[] = [
  { move: ['↑↓←→ fly', 'or the mouse'], fight: ['SPACE repulsor', '1 2 3 powers'], win: ['down the drones', 'boss every 4th'], sig: '1 Cap\'s shield · 2 Mjölnir lightning · 3 Hulk SMASH (green meter)' },
  { move: DUEL_MOVE, fight: DUEL_FIGHT, win: ['KO all 3 of theirs', 'Z tags a teammate'], sig: 'Tap ↓ just as a hit lands: PARRY · Ant-Man\'s X: GIANT-MAN' },
  { move: DUEL_MOVE, fight: DUEL_FIGHT, win: ['best of 3 rounds', '60 s each'], sig: 'Iron Man: parry Thor\'s lightning → POWER AT 400%' },
  { move: DUEL_MOVE, fight: DUEL_FIGHT, win: ['best of 3 rounds', '60 s each'], sig: 'Hulk hits harder the more he is hurt · tap ↓ to PARRY' },
  { move: DUEL_MOVE, fight: DUEL_FIGHT, win: ['beat Thanos', '1 2 3 assists'], sig: 'At the gold flash of THE SNAP, tap ↓ · hit him to break it' },
]

// A second game that borrows this one's screen, effects and HUD (VERSUS).
export interface SubGame { enter(): void; start(i: number): void; begin(): void; quit(): boolean; tick(dt: number): void; draw(): void; key(k: string): void; pointer(type: string, x: number, y: number, button?: string): void; hud(): Run[]; right(): string }
type Kind = 0 | 1 | 2 | 3 // drone, striker, heavy, prime
type Enemy = { on: boolean; kind: Kind; x: number; y: number; vx: number; vy: number; hp: number; max: number; t: number; flash: number; y0: number; fire: number; ph: number; lastShield: number }
type Shot = { on: boolean; x: number; y: number; vx: number; vy: number; t: number; big: boolean }
type Pop = { on: boolean; x: number; y: number; t: number; s: string; c: number }
type Pick = { on: boolean; x: number; y: number; t: number; kind: 0 | 1 } // reactor (repair), hammer (thunder)
type Boom = { on: boolean; x: number; y: number; t: number; r: number; c: number }

const NE = 24, NPB = 48, NEB = 64, NP = 360, NPOP = 10, NPICK = 6, NBOOM = 12, NSTAR = 48
const DT = 1 / 30

const QUIPS = {
  start: ['Welcome home, sir. Ultron drones inbound.', 'Suit at 100%. Do try not to scratch the paint.', 'All wrapped up here, sir. Will there be anything else? ...ah. Drones.'],
  wave: ['Wave {n}. They appear to be multiplying, sir.', 'Wave {n}. I am detecting more of them. Many more.', 'Wave {n}. Sir, may I remind you it is past midnight.'],
  boss: ['Ultron Prime approaching. He seems rather upset.', '"There are no strings on me." He did say that, sir.', 'Ultron Prime. I believe he wants a word with your creator.'],
  hit: ['Shields down, sir.', 'That one stung.', 'Sir, the suit is... not doing well.'],
  low: ['Power at 33%. I would advise against heroics.', 'One more hit and we are a very expensive paperweight.'],
  shield: ["Captain Rogers' shield, sir. He says you owe him.", '"I can do this all day."', 'Vibranium ricochet. Physics is weeping.'],
  hulk: ['HULK SMASH. Structural damage: considerable.', 'Dr. Banner sends his... regards.', 'Puny drones.'],
  thunder: ['"Bring me Thanos!" ...wrong villain, sir.', 'Point Break has entered the chat.', 'Lightning, sir. Chained, as requested.'],
  combo: ['Combo x{n}. Showing off, sir?', 'x{n}. Even Rhodey would be impressed.', 'x{n} chain. I am logging this for the press.'],
  repair: ['Arc reactor recovered. Repairs at 100%... ish.', 'A spare palladium-free core. Lovely.'],
  hammer: ['Mjolnir recharged. You are, apparently, worthy.', 'He left his hammer again, sir.'],
  bosskill: ['Ultron Prime is down. For now.', 'Excellent work, sir. Shawarma is on me.'],
  over: ['Suit offline. I am... inevitable? No, sir, that is the other one.', 'We will get them next time. I have ordered shawarma.', 'Rebooting. Sir? Sir... I am still here.'],
  record: ['A new record, sir. Shall I alert the press?'],
  pause: ['Holding the timeline, sir. Strange would approve.'],
}
type QuipKey = keyof typeof QUIPS

export class Game {
  fb: FB
  W = 0; H = 0
  mode: Mode = 'title'
  // the title menu: every game, each its own colour; where each row is drawn (for clicks)
  menuSel = 0
  lastGame = 0; vsNext = false; quitArmed = false
  // set by the Client while the game doesn't have the keyboard: draws CLICK TO PLAY
  clickHint = false
  menuHit: { row: number; x0: number; x1: number; i: number }[] = []
  t = 0; frame = 0; modeT = 0
  rnd: () => number
  best = 0; score = 0; shown = 0; wave = 0; hp = 3; inv = 0; combo = 0; comboT = 0; rage = 0; kills = 0
  cdShield = 0; cdThunder = 0; fireCd = 0; muzzle = 0; triple = 0; thunderCharges = 0; readyFlash = 0
  px = 10; py = 20; tx = 10; ty = 20; vy = 0
  shake = 0; flashA = 0; flashC = 0xffffff; hitstop = 0; slow = 0
  toSpawn = 0; spawnT = 0; bossWave = false; bossOn = false; bannerT = -9; newRecord = false; overT = 0
  scroll = 0; speed = 1
  jarvis = ''; jarvisT = 0; jarvisPri = 0
  speaker = 'JARVIS'; speakerC = C.arc
  vs: SubGame | undefined
  outbox: { score: number } | undefined
  wantsClose = false
  E: Enemy[] = []; PB: Shot[] = []; EB: Shot[] = []; POP: Pop[] = []; PK: Pick[] = []; BM: Boom[] = []
  // particles, struct-of-arrays
  pX = new Float32Array(NP); pY = new Float32Array(NP); pVX = new Float32Array(NP); pVY = new Float32Array(NP)
  pL = new Float32Array(NP); pM = new Float32Array(NP); pC = new Int32Array(NP); pK = new Uint8Array(NP); pN = 0
  sX = new Float32Array(NSTAR); sY = new Float32Array(NSTAR); sZ = new Float32Array(NSTAR)
  sky = new Int32Array(0)
  skyStops: readonly (readonly [number, number])[] = [[0, 0x07061a], [0.35, 0x140d33], [0.62, 0x2b1446], [0.8, 0x5a1e4e], [1, 0x8a3a3a]]
  shield = { on: false, x: 0, y: 0, vx: 0, vy: 0, bounces: 0, back: false, t: 0, target: -1 }
  smash = { on: false, t: 0 }
  bolt = { on: false, t: 0, n: 0, x: new Float32Array(7), y: new Float32Array(7) }
  runs: Run[] = []
  mask = 0xffffff; level = 0

  constructor(columns: number, rows: number, seed = 7) {
    let s = seed >>> 0
    this.rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    for (let i = 0; i < NE; i++) this.E.push({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 0, max: 1, t: 0, flash: 0, y0: 0, fire: 0, ph: 0, lastShield: -1 })
    for (let i = 0; i < NPB; i++) this.PB.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, big: false })
    for (let i = 0; i < NEB; i++) this.EB.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, big: false })
    for (let i = 0; i < NPOP; i++) this.POP.push({ on: false, x: 0, y: 0, t: 0, s: '', c: 0 })
    for (let i = 0; i < NPICK; i++) this.PK.push({ on: false, x: 0, y: 0, t: 0, kind: 0 })
    for (let i = 0; i < NBOOM; i++) this.BM.push({ on: false, x: 0, y: 0, t: 0, r: 0, c: 0 })
    this.fb = new FB(1, 2)
    this.resize(columns, rows)
    sprites()
    this.say('start', 0)
  }

  // the playfield is every row but the HUD's top and JARVIS's bottom row
  resize(columns: number, rows: number) {
    const W = Math.max(40, Math.min(220, columns | 0)), H = Math.max(16, (Math.max(10, rows | 0) - 2) * 2)
    if (W === this.W && H === this.H) return
    const ky = this.H ? H / this.H : 1
    this.W = W; this.H = H
    this.fb = new FB(W, H)
    this.sk = Math.max(0.45, Math.min(1, H / 56))
    this.sky = new Int32Array(H)
    this.paintSky()
    for (let i = 0; i < NSTAR; i++) { this.sX[i] = this.rnd() * W; this.sY[i] = this.rnd() * H * 0.62; this.sZ[i] = 0.2 + this.rnd() * 0.8 }
    this.py *= ky; this.ty *= ky
    this.px = Math.min(this.px, W * 0.45)
    this.clampTarget() // the suit's target too, or it eases back out of a shrunk arena
  }

  // the sky's gradient: stops from top (0) to bottom (1)
  setSky(stops: readonly (readonly [number, number])[]) { this.skyStops = stops; this.paintSky() }
  paintSky() {
    const H = this.H, stops = this.skyStops
    for (let y = 0; y < H; y++) {
      const f = y / (H - 1)
      let i = 0
      while (i < stops.length - 2 && f > stops[i + 1]![0]) i++
      const [a0, c0] = stops[i]!, [a1, c1] = stops[i + 1]!
      this.sky[y] = mix(c0, c1, (f - a0) / (a1 - a0))
    }
  }

  // ── input ────────────────────────────────────────────────────────────────
  key(k: string) {
    const key = k.length === 1 ? k.toLowerCase() : k
    // Q in a game pauses with QUIT armed; a second Q quits (one press never loses a run). In menus it quits.
    // Q and Esc are one key: on the title it closes the arcade; in a game it pauses with QUIT
    // armed and a second press closes; on HOW TO PLAY and game over it goes back to the menu.
    if (key === 'q' || key === 'escape') {
      if (this.mode === 'play') { this.mode = 'pause'; this.quitArmed = true; return }
      if (this.mode === 'pause' && !this.quitArmed) { this.quitArmed = true; return }
      if (this.mode === 'howto' || this.mode === 'over') { this.vsNext = false; this.mode = 'title'; return }
      if (this.mode === 'vs' && this.vs!.quit()) return
      this.wantsClose = true; return
    }
    if (this.mode === 'vs') { this.vs!.key(key); return }
    if (this.mode === 'title') {
      const n = Number(key)
      if (n >= 1 && n <= MENU.length) { this.launch(n - 1); return }
      if (key === 'up' || key === 'w' || key === 'k') { this.menuSel = (this.menuSel + MENU.length - 1) % MENU.length; return }
      if (key === 'down' || key === 's' || key === 'j') { this.menuSel = (this.menuSel + 1) % MENU.length; return }
      if (key === ' ' || key === 'space' || key === 'return' || key === 'enter') { this.launch(this.menuSel); return }
      return
    }
    if (this.mode === 'howto') {
      if (key === ' ' || key === 'space' || key === 'return' || key === 'enter') this.begin(this.menuSel)
      else if (key === 'b' || key === 'backspace' || key === 'escape') { if (this.vsNext) { this.vsNext = false; this.mode = 'vs' } else this.mode = 'title' }
      return
    }
    if (this.mode === 'over') {
      if ((key === ' ' || key === 'space' || key === 'return' || key === 'enter') && this.overT > 1) this.launch(0) // HOW TO PLAY first, every time
      else if (key === 'r' && this.overT > 1) this.launch(0)
      else if ((key === 'b' || key === 'backspace' || key === 'm') && this.overT > 0.5) this.mode = 'title'
      return
    }
    if (this.mode === 'pause' && (key === 'b' || key === 'backspace')) { this.mode = 'title'; return }
    if (this.mode === 'pause' && key === 'r') { this.launch(0); return }
    if (key === 'p') { this.mode = this.mode === 'pause' ? 'play' : 'pause'; this.quitArmed = false; if (this.mode === 'pause') this.say('pause', 3); return }
    if (this.mode === 'pause' && this.quitArmed) { this.quitArmed = false; return } // any other key disarms QUIT
    if (this.mode !== 'play') return
    const step = 5
    if (key === 'up' || key === 'w' || key === 'k') this.ty -= step
    else if (key === 'down' || key === 's' || key === 'j') this.ty += step
    else if (key === 'left' || key === 'a') this.tx -= step
    else if (key === 'right' || key === 'd') this.tx += step
    else if (key === ' ' || key === 'space' || key === 'f' || key === 'return' || key === 'enter') this.fire()
    else if (key === '1' || key === 'c') this.throwShield()
    else if (key === '2' || key === 't') this.thunder()
    else if (key === '3' || key === 'h') this.hulk()
    this.clampTarget()
  }
  pointer(type: string, x: number, y: number, button?: string) {
    if (this.mode === 'vs') { this.vs!.pointer(type, x, y, button); return }
    const py = (y - 1) * 2 + 1
    if (this.mode === 'play' && py >= 0 && py < this.H + 4) { this.ty = py - this.ph * 0.45; if (type !== 'down' || button === 'left') this.tx = Math.min(this.tx, this.W * 0.45) }
    if (type === 'down' && button === 'left') {
      if (this.mode === 'play') this.fire()
      else if (this.mode === 'title') { const hit = this.menuHit.find(h => h.row === Math.floor(y) - 1 && x >= h.x0 && x < h.x1); if (hit) this.launch(hit.i) } // a click picks the game it lands on, nothing else
      else if (this.mode === 'howto') this.begin(this.menuSel)
      else if (this.mode === 'over' && this.overT > 1) this.launch(0)
    }
    if (this.mode === 'title' && type === 'move') { const hit = this.menuHit.find(h => h.row === Math.floor(y) - 1 && x >= h.x0 && x < h.x1); if (hit) this.menuSel = hit.i } // hover picks
    if (type === 'down' && button === 'right' && this.mode === 'play') this.throwShield()
    this.clampTarget()
  }
  private clampTarget() {
    this.ty = Math.max(1, Math.min(this.H - this.ph * 0.7, this.ty))
    this.tx = Math.max(2, Math.min(this.W * 0.45, this.tx))
  }

  // Picks a game from the title menu. The siege shows HOW TO PLAY now; a fight
  // opens its select screen first and shows the card once the picks are in.
  launch(i: number) {
    this.menuSel = Math.max(0, Math.min(MENU.length - 1, i))
    this.lastGame = this.menuSel
    if (this.menuSel > 0 && this.vs) { this.vsNext = false; this.mode = 'vs'; this.vs.start(this.menuSel); return }
    this.vsNext = false; this.mode = 'howto'; this.modeT = 0
  }
  // A fight's picks are in: its HOW TO PLAY card, then the fight.
  howtoThen(i: number) { this.menuSel = i; this.vsNext = true; this.mode = 'howto'; this.modeT = 0 }
  // SPACE on the card: the siege starts, or the fight does.
  begin(i: number) {
    if (this.vsNext && this.vs) { this.vsNext = false; this.mode = 'vs'; this.vs.begin(); return }
    if (i === 0 || !this.vs) { this.start(); return }
    this.launch(i)
  }

  start() {
    this.mode = 'play'; this.modeT = 0
    this.score = 0; this.shown = 0; this.wave = 0; this.hp = 3; this.inv = 1.5; this.combo = 0; this.rage = 0; this.kills = 0
    this.cdShield = 0; this.cdThunder = 0; this.triple = 0; this.newRecord = false
    this.px = this.tx = 8; this.py = this.ty = this.H * 0.4
    for (const e of this.E) e.on = false
    for (const s of this.PB) s.on = false
    for (const s of this.EB) s.on = false
    for (const p of this.PK) p.on = false
    this.shield.on = false; this.smash.on = false; this.bolt.on = false; this.bossOn = false
    this.nextWave()
    this.say('start', 2)
  }
  private nextWave() {
    this.wave++
    this.bossWave = this.wave % 4 === 0
    this.toSpawn = this.bossWave ? 1 : 5 + this.wave * 3
    this.spawnT = 1.6
    this.bannerT = this.t
    this.speed = 1 + Math.min(1.5, this.wave * 0.12)
    if (this.bossWave) { this.say('boss', 2); if (this.hp < 3) { this.hp++; this.pop(this.px, this.py - 3, '+1 SUIT', C.arc2) } } else if (this.wave > 1) this.say('wave', 1)
  }

  talk(who: string, color: number, line: string) { this.speaker = who; this.speakerC = color; this.jarvis = line; this.jarvisT = this.t; this.jarvisPri = 0 }
  say(k: QuipKey, pri: number) {
    this.speaker = 'JARVIS'; this.speakerC = C.arc
    if (pri < this.jarvisPri && this.t - this.jarvisT < 2.5) return
    const list = QUIPS[k]
    this.jarvis = list[Math.floor(this.rnd() * list.length)]!.replace('{n}', String(k === 'combo' ? this.mult() : this.wave))
    this.jarvisT = this.t; this.jarvisPri = pri
  }
  mult() { return Math.min(8, 1 + Math.floor(this.combo / 5)) }

  // ── powers ───────────────────────────────────────────────────────────────
  fire() {
    if (this.fireCd > 0) return
    this.fireCd = 0.11
    const x = this.px + this.pw * 0.85, y = this.py + this.ph * 0.5
    const lanes = this.triple > 0 ? [-0.5, 0, 0.5] : [0]
    for (const vy of lanes) {
      const s = this.PB.find(s => !s.on)
      if (!s) break
      s.on = true; s.x = x; s.y = y; s.vx = 4.2; s.vy = vy; s.t = 0; s.big = false
    }
    this.muzzle = 1
  }
  throwShield() {
    if (this.cdShield > 0 || this.shield.on) return
    const sh = this.shield
    sh.on = true; sh.x = this.px + this.pw * 0.5; sh.y = this.py; sh.vx = 3.5; sh.vy = 0; sh.bounces = 6; sh.back = false; sh.t = 0; sh.target = this.nearest(sh.x, sh.y, -1)
    for (const e of this.E) e.lastShield = -1
    this.cdShield = 5
    this.say('shield', 1)
  }
  hulk() {
    if (this.rage < 100 || this.smash.on) return
    this.rage = 0; this.smash.on = true; this.smash.t = 0
    this.say('hulk', 2)
  }
  thunder() {
    if ((this.cdThunder > 0 && this.thunderCharges <= 0) || this.bolt.on) return
    const b = this.bolt
    b.n = 0; b.x[0] = this.px + this.pw * 0.76; b.y[0] = this.py + this.ph * 0.2
    const used: number[] = []
    let cx = b.x[0]!, cy = b.y[0]!
    for (let k = 0; k < 6; k++) {
      let best = -1, bd = 1e9
      for (let i = 0; i < NE; i++) {
        const e = this.E[i]!
        if (!e.on || used.includes(i) || e.x > this.W - 2) continue
        const d = Math.hypot(e.x - cx, e.y - cy)
        if (d < bd) { bd = d; best = i }
      }
      if (best < 0) break
      used.push(best)
      const e = this.E[best]!, [w, h] = this.size(e.kind)
      cx = e.x + w / 2; cy = e.y + h / 2
      b.n++; b.x[b.n] = cx; b.y[b.n] = cy
      this.damage(e, e.kind === 3 ? 8 : 6, cx, cy)
    }
    b.on = true; b.t = 0
    if (this.thunderCharges > 0) this.thunderCharges--; else this.cdThunder = 7
    this.flashA = Math.max(this.flashA, 0.35); this.flashC = 0xb8ccff; this.shake = Math.max(this.shake, 2.5)
    if (b.n === 0) { b.n = 1; b.x[1] = this.W - 4; b.y[1] = this.py + this.ph * 0.2 }
    this.say('thunder', 1)
  }

  private nearest(x: number, y: number, skip: number) {
    let best = -1, bd = 1e9
    for (let i = 0; i < NE; i++) {
      const e = this.E[i]!
      if (!e.on || i === skip || e.lastShield === this.shield.bounces || e.x > this.W) continue
      const d = Math.hypot(e.x - x, e.y - y)
      if (d < bd) { bd = d; best = i }
    }
    return best
  }
  // the siege's sprites at this pane's scale (the suit is ~a quarter of the field's height)
  sk = 1
  private spCache: { k: number; s: ReturnType<typeof sprites> } | undefined
  sp() {
    if (this.spCache?.k !== this.sk) { const S = sprites(); this.spCache = { k: this.sk, s: Object.fromEntries(Object.entries(S).map(([n, v]) => [n, n === 'helmet' ? v : scaleSpr(v, this.sk)])) as ReturnType<typeof sprites> } }
    return this.spCache.s
  }
  get pw() { return this.sp().im.w }
  get ph() { return this.sp().im.h }
  size(k: Kind): [number, number] {
    const S = this.sp()
    return k === 3 ? [S.prime.w, S.prime.h] : k === 2 ? [S.heavy.w, S.heavy.h] : [S.drone.w, S.drone.h]
  }

  // ── spawning ─────────────────────────────────────────────────────────────
  private spawn(kind: Kind) {
    const e = this.E.find(e => !e.on)
    if (!e) return false
    const [, h] = this.size(kind)
    e.on = true; e.kind = kind; e.t = 0; e.flash = 0; e.ph = this.rnd() * 6.28; e.lastShield = -1
    e.x = this.W + 2; e.y = e.y0 = 2 + this.rnd() * (this.H - h - 6)
    e.vx = kind === 0 ? -(0.45 + this.rnd() * 0.3) * this.speed : kind === 1 ? -(0.8 + this.rnd() * 0.3) * this.speed : -0.3 * this.speed
    e.vy = 0
    e.max = e.hp = kind === 0 ? 1 : kind === 1 ? 2 : kind === 2 ? 6 : 90 + this.wave * 20
    e.fire = 1 + this.rnd() * 2
    if (kind === 3) { e.y = e.y0 = (this.H - h) / 2; e.vx = -0.35; this.bossOn = true }
    return true
  }

  burst(x: number, y: number, n: number, c: number, sp: number, kind: number, life = 0.6) {
    for (let k = 0; k < n; k++) {
      const i = this.pN; this.pN = (this.pN + 1) % NP
      const a = this.rnd() * Math.PI * 2, v = sp * (0.3 + this.rnd() * 0.9)
      this.pX[i] = x; this.pY[i] = y; this.pVX[i] = Math.cos(a) * v; this.pVY[i] = Math.sin(a) * v * 0.8
      this.pM[i] = this.pL[i] = life * (0.5 + this.rnd() * 0.8); this.pC[i] = c; this.pK[i] = kind
    }
  }
  boom(x: number, y: number, r: number, c: number) {
    const b = this.BM.find(b => !b.on) ?? this.BM[0]!
    b.on = true; b.x = x; b.y = y; b.t = 0; b.r = r; b.c = c
  }
  pop(x: number, y: number, s: string, c: number) {
    const p = this.POP.find(p => !p.on) ?? this.POP[0]!
    p.on = true; p.x = x; p.y = y; p.t = 0; p.s = s; p.c = c
  }

  private damage(e: Enemy, d: number, hx: number, hy: number) {
    e.hp -= d; e.flash = 1
    this.burst(hx, hy, 4, 0xffe8b0, 1.2, 0, 0.25)
    if (e.kind === 3) { this.hitstop = Math.max(this.hitstop, 1); this.shake = Math.max(this.shake, 1) }
    if (e.hp <= 0) this.kill(e)
  }
  private kill(e: Enemy) {
    e.on = false
    const [w, h] = this.size(e.kind), cx = e.x + w / 2, cy = e.y + h / 2
    const big = e.kind === 3
    this.burst(cx, cy, big ? 120 : e.kind === 2 ? 46 : 26, 0, big ? 3.2 : 1.9, 0, big ? 1.6 : 0.8)
    this.burst(cx, cy, big ? 40 : 8, 0x8a93a6, big ? 2.4 : 1.4, 1, big ? 2 : 1.2)
    this.boom(cx, cy, big ? 30 : e.kind === 2 ? 14 : 9, big ? 0xff6a3a : 0xffa040)
    this.shake = Math.max(this.shake, big ? 9 : e.kind === 2 ? 3 : 1.6)
    this.hitstop = Math.max(this.hitstop, big ? 6 : 1)
    if (big) { this.flashA = 0.8; this.flashC = 0xffffff; this.bossOn = false; this.slow = 1.2; this.say('bosskill', 3) }
    this.combo++; this.comboT = 1.8; this.kills++
    if (this.combo > 0 && this.combo % 10 === 0) this.say('combo', 1)
    const base = e.kind === 0 ? 100 : e.kind === 1 ? 150 : e.kind === 2 ? 400 : 5000
    const pts = base * this.mult()
    this.score += pts
    this.pop(cx - 2, e.y, '+' + pts, this.mult() > 1 ? C.gold2 : C.text)
    this.rage = Math.min(100, this.rage + (e.kind === 2 ? 14 : 7))
    const r = this.rnd()
    if (e.kind === 2 ? r < 0.35 : r < 0.05) this.drop(cx, cy, 0)
    else if (r > (e.kind === 1 ? 0.9 : 0.97)) this.drop(cx, cy, 1)
  }
  private drop(x: number, y: number, kind: 0 | 1) {
    const p = this.PK.find(p => !p.on)
    if (p) { p.on = true; p.x = x; p.y = y; p.t = 0; p.kind = kind }
  }
  private hurt() {
    if (this.inv > 0 || this.mode !== 'play') return
    this.hp--; this.inv = 2; this.shake = 6; this.flashA = 0.55; this.flashC = 0xff2020; this.combo = 0; this.hitstop = 3
    this.burst(this.px + this.pw * 0.42, this.py + this.ph * 0.3, 30, 0, 2, 0, 0.6)
    if (this.hp <= 0) this.gameOver()
    else this.say(this.hp === 1 ? 'low' : 'hit', 2)
  }
  private gameOver() {
    this.mode = 'over'; this.overT = 0; this.slow = 1.5
    this.burst(this.px + this.pw * 0.42, this.py + this.ph * 0.3, 140, 0, 3, 0, 1.4)
    this.burst(this.px + this.pw * 0.42, this.py + this.ph * 0.3, 30, 0x8e141b, 2, 1, 2)
    this.boom(this.px + this.pw * 0.42, this.py + this.ph * 0.3, 26, 0xff7040)
    this.shake = 10; this.flashA = 0.9; this.flashC = 0xffffff
    this.newRecord = this.score > this.best
    if (this.newRecord) this.best = this.score
    this.outbox = { score: this.score }
    this.say(this.newRecord ? 'record' : 'over', 3)
  }

  // ── simulation ───────────────────────────────────────────────────────────
  tick() {
    this.frame++
    if (this.readyT > 0) { this.readyT -= DT; return } // READY, after the game gets the keys back
    if (this.mode === 'pause') { this.t += DT; return }
    let dt = DT
    if (this.slow > 0) { this.slow -= DT; dt *= 0.35 }
    this.t += dt; this.modeT += dt
    if (this.hitstop > 0) { this.hitstop--; this.decayFx(); return }
    if (this.mode === 'vs') {
      this.updParticles(dt)
      for (const b of this.BM) if (b.on && (b.t += dt) > 0.5 + b.r / 60) b.on = false
      for (const p of this.POP) if (p.on && (p.t += dt) > 1.1) p.on = false
      this.vs!.tick(dt); this.decayFx(); return
    }
    this.scroll += dt * 26 * this.speed
    for (let i = 0; i < NSTAR; i++) { this.sX[i] = this.sX[i]! - this.sZ[i]! * this.sZ[i]! * 30 * this.speed * dt; if (this.sX[i]! < 0) { this.sX[i] = this.W; this.sY[i] = this.rnd() * this.H * 0.62 } }
    this.updParticles(dt)
    for (const b of this.BM) if (b.on && (b.t += dt) > 0.5 + b.r / 60) b.on = false
    for (const p of this.POP) if (p.on && (p.t += dt) > 1.1) p.on = false
    if (this.mode === 'over') { this.overT += dt; this.updEnemies(dt, false); this.decayFx(); return }
    if (this.mode === 'title' || this.mode === 'howto') { this.updTitle(dt); this.decayFx(); return } // menus idle: nothing attacks while you read

    const wasS = this.cdShield, wasT = this.cdThunder
    this.fireCd -= dt; this.cdShield = Math.max(0, this.cdShield - dt); this.cdThunder = Math.max(0, this.cdThunder - dt)
    if (wasS > 0 && this.cdShield === 0) this.pop(this.px + this.pw * 0.3, this.py - 2, '1 READY', 0x7fa6ff)
    if (wasT > 0 && this.cdThunder === 0) this.pop(this.px + this.pw * 0.3, this.py - 2, '2 READY', C.bolt2)
    this.inv = Math.max(0, this.inv - dt); this.triple = Math.max(0, this.triple - dt)
    this.rage = Math.min(100, this.rage + dt * 0.5)
    if ((this.comboT -= dt) <= 0) this.combo = 0
    this.shown += (this.score - this.shown) * 0.25; if (Math.abs(this.score - this.shown) < 1) this.shown = this.score
    // player: eased toward the target, banking with vertical speed
    const oy = this.py
    this.py += (this.ty - this.py) * 0.3; this.px += (this.tx - this.px) * 0.25
    this.vy = this.vy * 0.6 + (this.py - oy) * 0.4
    this.muzzle = Math.max(0, this.muzzle - dt * 8)
    // boot jets
    for (let k = 0; k < 2; k++) {
      const i = this.pN; this.pN = (this.pN + 1) % NP
      this.pX[i] = this.px + 1 + this.rnd(); this.pY[i] = this.py + this.ph * (0.4 + this.rnd() * 0.2)
      this.pVX[i] = -1.6 - this.rnd() * 1.2; this.pVY[i] = (this.rnd() - 0.5) * 0.3 - this.vy * 0.3
      this.pM[i] = this.pL[i] = 0.22 + this.rnd() * 0.12; this.pC[i] = 0; this.pK[i] = 2
    }
    // spawning
    if (this.toSpawn > 0 && (this.spawnT -= dt) <= 0) {
      const w = this.wave, r = this.rnd()
      const kind: Kind = this.bossWave ? 3 : w >= 3 && r < 0.12 + w * 0.01 ? 2 : w >= 2 && r < 0.4 ? 1 : 0
      if (this.spawn(kind)) { this.toSpawn--; this.spawnT = Math.max(0.25, 0.9 - w * 0.05) * (0.6 + this.rnd() * 0.8) * (w <= 2 ? 1.5 : 1) } // an easier first minute
    }
    if (this.toSpawn <= 0 && !this.smash.on && !this.E.some(e => e.on)) this.nextWave()
    this.updShots(dt)
    this.updEnemies(dt, true)
    this.updPowers(dt)
    this.updPicks(dt)
    this.decayFx()
  }
  decayFx() {
    this.shake *= 0.82; if (this.shake < 0.3) this.shake = 0
    this.flashA *= 0.82; if (this.flashA < 0.02) this.flashA = 0
  }
  private updTitle(dt: number) {
    // an attract-mode demo: drones drift by, the suit idles
    const lap = (this.t % 7) / 7
    this.px = -40 + lap * (this.W + 80)
    this.py = this.H - this.ph * 1.5 + Math.sin(this.t * 1.3) * 2
    this.vy = Math.cos(this.t * 1.3) * 0.1
    for (let k = 0; k < 2; k++) {
      const i = this.pN; this.pN = (this.pN + 1) % NP
      this.pX[i] = this.px + 1; this.pY[i] = this.py + this.ph * (0.4 + this.rnd() * 0.2)
      this.pVX[i] = -1.4 - this.rnd(); this.pVY[i] = (this.rnd() - 0.5) * 0.3
      this.pM[i] = this.pL[i] = 0.25; this.pC[i] = 0; this.pK[i] = 2
    }
    void dt
  }
  updParticles(dt: number) {
    for (let i = 0; i < NP; i++) {
      if (this.pL[i]! <= 0) continue
      this.pL[i] = this.pL[i]! - dt
      this.pX[i] = this.pX[i]! + this.pVX[i]!; this.pY[i] = this.pY[i]! + this.pVY[i]!
      if (this.pK[i] === 3) { this.pVY[i] = this.pVY[i]! - 0.004 } else if (this.pK[i] === 1) { this.pVY[i] = this.pVY[i]! + 0.12; this.pVX[i] = this.pVX[i]! * 0.97 } else { this.pVX[i] = this.pVX[i]! * 0.92; this.pVY[i] = this.pVY[i]! * 0.92 }
    }
  }
  private updShots(dt: number) {
    const W = this.W, H = this.H
    for (const s of this.PB) {
      if (!s.on) continue
      s.x += s.vx; s.y += s.vy; s.t += dt
      if (s.x > W + 4) { s.on = false; continue }
      for (const e of this.E) {
        if (!e.on || e.x > W - 3) continue
        const [w, h] = this.size(e.kind)
        if (s.x + 3 >= e.x + 1 && s.x <= e.x + w - 1 && s.y >= e.y && s.y <= e.y + h) { s.on = false; this.damage(e, 1, s.x + 2, s.y); break }
      }
    }
    for (const s of this.EB) {
      if (!s.on) continue
      s.x += s.vx; s.y += s.vy; s.t += dt
      if (s.x < -4 || s.x > W + 4 || s.y < -4 || s.y > H + 4) { s.on = false; continue }
      if (this.hitsPlayer(s.x, s.y, 1)) { s.on = false; this.hurt() }
    }
  }
  private hitsPlayer(x: number, y: number, r: number) {
    return x + r >= this.px + this.pw * 0.42 && x - r <= this.px + this.pw * 0.78 && y + r >= this.py + this.ph * 0.22 && y - r <= this.py + this.ph * 0.45
  }
  private enemyShot(x: number, y: number, vx: number, vy: number, big = false) {
    const s = this.EB.find(s => !s.on)
    if (s) { s.on = true; s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.t = 0; s.big = big }
  }
  private updEnemies(dt: number, live: boolean) {
    const pyc = this.py + this.ph * 0.35
    for (const e of this.E) {
      if (!e.on) continue
      e.t += dt; e.flash = Math.max(0, e.flash - dt * 6)
      const [w, h] = this.size(e.kind)
      if (e.kind === 0) { e.x += e.vx; e.y = e.y0 + Math.sin(e.t * 2.2 + e.ph) * 5 }
      else if (e.kind === 1) {
        e.x += e.vx * (e.t > 1.2 ? 1.9 : 1)
        if (e.t > 1.2) e.y += Math.sign(pyc - (e.y + h / 2)) * Math.min(0.7, Math.abs(pyc - (e.y + h / 2)) * 0.1)
      } else if (e.kind === 2) {
        e.x = Math.max(this.W * 0.62, e.x + e.vx); e.y = e.y0 + Math.sin(e.t * 0.9 + e.ph) * 7
        if (live && (e.fire -= dt) <= 0) { e.fire = 1.8 - Math.min(0.8, this.wave * 0.05); const a = Math.atan2(pyc - (e.y + h * 0.7), this.px + this.pw * 0.5 - e.x); this.enemyShot(e.x, e.y + h * 0.7, Math.cos(a) * 1.3, Math.sin(a) * 1.3) }
      } else {
        // Ultron Prime: glides in, bobs, fans bolts, and sweeps
        e.x = Math.max(this.W - w - 4, e.x + e.vx); e.y = (this.H - h) / 2 + Math.sin(e.t * 0.7) * (this.H * 0.25)
        if (live && e.x <= this.W - w - 3 && (e.fire -= dt) <= 0) {
          const phase = Math.floor(e.t / 6) % 2, hp = e.hp / e.max
          if (phase === 0) { e.fire = hp < 0.5 ? 0.9 : 1.3; for (let k = -2; k <= 2; k++) this.enemyShot(e.x + 4, e.y + h * 0.55, -1.25, k * 0.32, true) }
          else { e.fire = 0.16; const a = Math.atan2(pyc - (e.y + h * 0.4), this.px - e.x) + Math.sin(e.t * 3) * 0.25; this.enemyShot(e.x + 4, e.y + h * 0.4, Math.cos(a) * 1.8, Math.sin(a) * 1.8) }
        }
      }
      if (e.x < -w - 2) { e.on = false; continue } // a drone slipping past costs nothing but the points
      const touching = e.x < this.px + this.pw * 0.78 && e.x + w > this.px + this.pw * 0.42 && e.y < this.py + this.ph * 0.45 && e.y + h > this.py + this.ph * 0.22
      if (live && touching && this.inv > 0 && this.frame % 6 === 0) { this.burst(this.px + this.pw * 0.6, this.py + this.ph * 0.3, 4, 0x7fe9ff, 1, 0, 0.25); if (this.frame % 30 === 0) this.pop(this.px + this.pw * 0.4, this.py - 2, 'SHIELDED', C.arc2) }
      if (live && this.inv <= 0 && touching) {
        this.hurt(); if (e.kind !== 3) this.damage(e, 99, e.x + w / 2, e.y + h / 2)
      }
    }
  }
  private updPowers(dt: number) {
    // Cap's shield: home on the nearest, bounce, come home
    const sh = this.shield
    if (sh.on) {
      sh.t += dt
      let gx: number, gy: number
      const tgt = sh.target >= 0 ? this.E[sh.target]! : undefined
      if (!sh.back && tgt?.on) { const [w, h] = this.size(tgt.kind); gx = tgt.x + w / 2; gy = tgt.y + h / 2 }
      else if (!sh.back) { sh.target = this.nearest(sh.x, sh.y, -1); if (sh.target < 0) sh.back = true; gx = sh.x + 4; gy = sh.y }
      else { gx = this.px + this.pw * 0.5; gy = this.py }
      const a = Math.atan2(gy! - sh.y, gx! - sh.x), sp = sh.back ? 4.2 : 3.8
      sh.vx = sh.vx * 0.55 + Math.cos(a) * sp * 0.45; sh.vy = sh.vy * 0.55 + Math.sin(a) * sp * 0.45
      sh.x += sh.vx; sh.y += sh.vy
      if (!sh.back && tgt?.on && Math.hypot(gx! - sh.x - 5, gy! - sh.y - 4) < 6) {
        tgt.lastShield = sh.bounces
        this.damage(tgt, tgt.kind === 3 ? 5 : 3, sh.x + 5, sh.y + 4)
        this.burst(sh.x + 5, sh.y + 4, 10, 0xe9edf5, 1.6, 0, 0.35)
        this.shake = Math.max(this.shake, 1.5)
        sh.bounces--
        sh.target = sh.bounces > 0 ? this.nearest(sh.x, sh.y, sh.target) : -1
        if (sh.target < 0) sh.back = true
      }
      if (sh.back && Math.hypot(this.px + this.pw * 0.5 - sh.x, this.py - sh.y) < 5) sh.on = false
      if (sh.t > 6) sh.on = false
    }
    // Hulk: the fist falls, the city quakes
    const sm = this.smash
    if (sm.on) {
      const before = sm.t
      sm.t += dt
      if (before < 0.42 && sm.t >= 0.42) {
        this.shake = 12; this.flashA = 0.7; this.flashC = 0xc8ffb0; this.hitstop = 4
        const cx = this.W / 2
        this.boom(cx, this.H - 2, 44, 0x76cf57)
        this.burst(cx, this.H - 3, 80, 0x8a93a6, 3.2, 1, 1.6)
        this.burst(cx, this.H - 3, 60, 0, 3, 0, 1)
        for (const e of this.E) if (e.on && e.x < this.W) { const [w, h] = this.size(e.kind); this.damage(e, e.kind === 3 ? e.max * 0.2 : 99, e.x + w / 2, e.y + h / 2) }
        for (const s of this.EB) s.on = false
      }
      if (sm.t > 1.6) sm.on = false
    }
    if (this.bolt.on && (this.bolt.t += dt) > 0.45) this.bolt.on = false
  }
  private updPicks(dt: number) {
    for (const p of this.PK) {
      if (!p.on) continue
      p.t += dt; p.x -= 0.4; p.y += Math.sin(p.t * 3) * 0.2
      if (p.x < -8) { p.on = false; continue }
      if (this.hitsPlayer(p.x + 4, p.y + 3, 4)) {
        p.on = false
        this.burst(p.x + 4, p.y + 3, 24, p.kind ? 0x9db8ff : 0x7fe9ff, 1.6, 0, 0.5)
        if (p.kind === 0) { this.hp = Math.min(3, this.hp + 1); this.triple = 8; this.say('repair', 2); this.pop(p.x, p.y - 2, 'REPAIR + TRI-BEAM', C.arc2) }
        else { this.cdThunder = 0; this.thunderCharges = 2; this.say('hammer', 2); this.pop(p.x, p.y - 2, 'WORTHY · 2 x2', C.bolt2) }
      }
    }
  }

  // Focus: without the keyboard the game stops (the Client stops ticking it) and shows a dimmed
  // frame with CLICK TO PLAY; given the keys back, READY for half a second, then on.
  readyT = 0
  resumeReady() { if (this.mode === 'play' || this.mode === 'vs') this.readyT = 0.5 }
  private overlays() {
    const fb = this.fb, W = this.W
    if (this.clickHint) {
      // a bar on the bottom row: the screen above (the instructions, the fighters) stays readable
      const s = W >= 50 ? '  ▶  CLICK HERE OR PRESS A KEY TO PLAY  ◀  ' : ' ▶ CLICK TO PLAY '
      fb.textC(Math.max(0, fb.rows - 1), s, 0xffffff, MENU[this.menuSel]?.hi ?? 0x8e1a26)
    } else if (this.readyT > 0) fb.textC(Math.max(0, (fb.rows >> 1) - 1), ' READY ', 0x1a0a00, C.gold2)
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  draw() {
    if (this.mode === 'vs') { this.fb.clearOverlay(); this.vs!.draw(); this.overlays(); return }
    const fb = this.fb, W = this.W, H = this.H, S = this.sp()
    fb.clearOverlay()
    const sx = this.shake ? Math.round((this.rnd() - 0.5) * this.shake) : 0
    const sy = this.shake ? Math.round((this.rnd() - 0.5) * this.shake * 0.7) : 0
    this.drawWorld(sx, sy)
    const title = this.mode === 'title' || this.mode === 'howto' // the menus: the attract-mode world behind them, no suit
    // pickups
    for (const p of this.PK) if (p.on) {
      const s = p.kind ? S.hammer : S.reactor
      fb.glow(p.x + s.w / 2 + sx, p.y + s.h / 2 + sy, 7, p.kind ? 0x5c6cff : 0x38c4f0, 0.5 + Math.sin(p.t * 8) * 0.2)
      fb.spr(s, Math.floor(p.t * 12), p.x + sx, p.y + sy)
    }
    // enemies
    for (const e of this.E) if (e.on) {
      const s = e.kind === 3 ? S.prime : e.kind === 2 ? S.heavy : S.drone
      const k = Math.floor(e.t * (e.kind === 3 ? 6 : 10) + e.ph * 3)
      const ex = e.x + sx, ey = e.y + sy
      // their eyes light the air around them
      fb.glow(ex + s.w * 0.45, ey + s.h * 0.4, e.kind === 3 ? 16 : 6, 0xff2a1a, e.kind === 3 ? 0.35 : 0.22)
      const fl = e.flash * (e.kind === 3 ? 0.45 : 0.75)
      if (e.kind === 1) fb.spr(s, k, ex, ey, fl, 1, 0xff7a2a, 0.35)
      else fb.spr(s, k, ex, ey, fl)
      if (e.kind === 2 || e.kind === 3) fb.glow(ex + s.w + 1, ey + s.h * 0.5, 4, 0xff5030, 0.25)
    }
    // enemy fire: hot red orbs
    for (const s of this.EB) if (s.on) {
      const x = s.x + sx, y = s.y + sy
      fb.glow(x, y, s.big ? 5 : 4, 0xff2a10, 0.8)
      fb.blend(x, y, 0xfff0e0, 1); if (s.big) { fb.blend(x + 1, y, 0xffb090, 1); fb.blend(x, y + 1, 0xffb090, 1) }
      fb.add(x + 1, y, 0xff4020, 0.6); fb.add(x + 2, y, 0xff4020, 0.3)
    }
    // repulsor beams: a white-hot core in a cyan sheath
    for (const s of this.PB) if (s.on) {
      const x = s.x + sx, y = s.y + sy
      fb.add(x + 2, y - 1, 0x2aa8ff, 0.5); fb.add(x + 2, y + 1, 0x2aa8ff, 0.5)
      for (let i = -5; i <= 3; i++) fb.add(x + i, y, i > 0 ? 0xffffff : 0x7fe9ff, i > 0 ? 1 : 0.9 + i * 0.15)
      fb.blend(x + 2, y, 0xffffff, 1); fb.blend(x + 3, y, 0xffffff, 1)
    }
    // Cap's shield, spinning, with an afterimage trail
    const sh = this.shield
    if (sh.on) {
      for (let k = 3; k >= 1; k--) fb.spr(S.shield, Math.floor(sh.t * 30) - k, sh.x - sh.vx * k * 1.2 + sx, sh.y - sh.vy * k * 1.2 + sy, 0, 0.18 * (4 - k))
      fb.glow(sh.x + 5 + sx, sh.y + 4 + sy, 8, 0x3f74f0, 0.4)
      fb.spr(S.shield, Math.floor(sh.t * 30), sh.x + sx, sh.y + sy)
    }
    // the suit (blinks while invulnerable)
    if (this.mode !== 'over' && !(this.inv > 0 && Math.floor(this.t * 14) % 2 === 0 && this.mode === 'play')) this.drawSuit(this.px + sx, this.py + sy)
    this.drawParticles(sx, sy)
    for (const b of this.BM) if (b.on) {
      const f = b.t / (0.5 + b.r / 60)
      fb.glow(b.x + sx, b.y + sy, b.r * (0.5 + ease(f) * 0.7), b.c, (1 - f) * 1.1)
      fb.glow(b.x + sx, b.y + sy, b.r * 0.4 * (1 - f), 0xfff6d8, (1 - f) * 1.2)
      fb.ring(b.x + sx, b.y + sy, b.r * ease(f) * 1.5, 1.6, b.c, (1 - f) * 0.9)
    }
    if (this.bolt.on) this.drawBolt(sx, sy)
    if (this.smash.on) this.drawSmash(sx, sy)
    if (this.flashA > 0) for (let i = 0; i < fb.px.length; i++) fb.px[i] = addc(fb.px[i]!, this.flashC, this.flashA * 0.6)
    // text above the pixels
    for (const p of this.POP) if (p.on) fb.text(Math.round(p.x), Math.round((p.y - p.t * 6) / 2), p.s, p.t > 0.8 ? mix(p.c, 0x404060, (p.t - 0.8) * 3) : p.c)
    for (const b of this.E) if (b.on && b.kind === 3) this.drawBossBar(b)
    if (this.mode === 'howto') this.drawHowto()
    else if (title) this.drawTitle()
    else if (this.mode === 'over') this.drawOver()
    else if (this.mode === 'pause') this.drawPause()
    else { this.drawBanner(); this.drawHints() }
    this.overlays()
    void H
  }

  drawWorld(sx: number, sy: number) {
    const fb = this.fb, W = this.W, H = this.H, px = fb.px
    for (let y = 0; y < H; y++) { const c = this.sky[Math.max(0, Math.min(H - 1, y - sy))]!; px.fill(c, y * W, y * W + W) }
    // a moon, high and cold
    const mx = W * 0.93 - ((this.scroll * 0.02) % (W * 1.4)), my = H * 0.14
    fb.glow(mx + sx * 0.3, my, 12, 0x3a3060, 0.6)
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) { const d = Math.hypot(x, y * 1.15); if (d < 3.3) fb.blend(mx + x, my + y, d < 2.2 && x < 1 ? 0xf2ecff : 0xb8b0d8, 1) }
    // stars, twinkling, three depths
    for (let i = 0; i < NSTAR; i++) {
      const z = this.sZ[i]!, tw = 0.55 + 0.45 * Math.sin(this.t * (2 + z * 3) + i * 1.7)
      const c = z > 0.75 ? 0xffffff : z > 0.45 ? 0xbfc8ff : 0x8890c8
      fb.add(this.sX[i]! + sx * z, this.sY[i]! + sy, c, tw * (0.35 + z * 0.65))
    }
    // the skyline: a far layer with Stark Tower, a near layer with lit windows
    const far = this.scroll * 0.35, near = this.scroll
    const hz = H * 0.72
    for (let x = 0; x < W; x++) {
      const wx = Math.floor(x + far), id = Math.floor(wx / 7), h01 = hash(id)
      let top = hz - 3 - h01 * H * 0.2
      // Stark (Avengers) Tower, every 230 px of travel
      const tw = ((wx % 230) + 230) % 230
      const tower = tw >= 120 && tw < 132
      if (tower) top = H * 0.24 + (tw < 123 || tw > 128 ? 6 : 0) + (tw === 120 || tw === 131 ? 4 : 0)
      for (let y = Math.max(0, Math.floor(top)); y < H; y++) {
        let c = tower ? 0x241a3e : 0x1a1232
        if (y === Math.floor(top)) c = tower ? 0x6a5ca8 : 0x3a2654
        if (!tower && (wx % 7) !== 6 && y > top + 2 && (y % 3) === 1 && (wx % 2) === 0 && hash(wx * 31 + y * 7) > 0.9) c = 0x5a4060
        if (tower && y > top + 7 && (y % 2) === 0 && (tw % 3) === 1) c = 0x5aa0d8
        px[(y) * W + x] = c
      }
      if (tower && tw === 125) { fb.glow(x, H * 0.24 + 9, 7, 0x38a8ff, 0.5 + 0.2 * Math.sin(this.t * 2)) }
    }
    // the "A" on the tower
    const towerX = 120 + 6 - (((Math.floor(far) % 230) + 230) % 230)
    for (const off of [0, 230, -230]) { const ax = towerX + off; if (ax > -4 && ax < W + 4) fb.big('A', ax - 2, Math.floor(H * 0.24) + 6, 1, 1, 0xd8f4ff, 0x38c4f0) }
    // haze at the horizon
    for (let y = Math.floor(hz - 8); y < hz + 2; y++) for (let x = 0; x < W; x++) if (y >= 0 && y < H) { const o = y * W + x; px[o] = addc(px[o]!, 0x401830, 0.25 * (1 - Math.abs(y - hz + 3) / 6)) }
    for (let x = 0; x < W; x++) {
      const wx = Math.floor(x + near), id = Math.floor(wx / 11), h01 = hash(id + 999)
      const top = Math.floor(H - 4 - h01 * H * 0.24 - (hash(id + 5) > 0.8 ? H * 0.08 : 0))
      const gapCol = (wx % 11) === 10
      for (let y = Math.max(0, top); y < H; y++) {
        let c = gapCol ? 0x0a0816 : 0x100b1e
        if (y === top) c = gapCol ? 0x0a0816 : 0x2c2044
        else if ((wx % 11) > 1 && (wx % 11) < 9 && (y - top) % 3 === 2 && (wx % 2) === 1) {
          const lit = hash(wx * 13 + (y - top) * 17 + id)
          if (lit > 0.84) c = lit > 0.95 ? 0xf5c542 : 0x8a6a3a
        }
        px[y * W + x] = c
      }
    }
    // street glow
    for (let y = H - 3; y < H; y++) for (let x = 0; x < W; x++) { const o = y * W + x; px[o] = addc(px[o]!, 0x8a3a1a, (y - H + 4) * 0.12) }
  }

  private drawSuit(x: number, y: number) {
    const fb = this.fb, S = this.sp(), s = S.im
    const f = Math.max(0, Math.min(4, Math.round(2 - this.vy * 1.6)))
    // boot-jet light, then the suit, then the reactor and palm glows
    const jet = 0.75 + 0.25 * Math.sin(this.t * 40)
    const k = this.sk
    fb.glow(x + 1, y + s.h * 0.55, 7 * k, 0xff8a2a, 0.55 * jet)
    fb.glow(x + 1, y + s.h * 0.55, 3 * k + 0.5, 0xfff0c0, 0.8 * jet)
    fb.spr(s, f, x, y)
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 5)
    fb.glow(x + s.w * 0.55, y + s.h * 0.62, 4 * k, 0x38c4f0, 0.35 * pulse + 0.2)
    fb.glow(x + s.w - 1, y + s.h * 0.62, (3 + this.muzzle * 4) * k, 0x7fe9ff, 0.3 + this.muzzle * 0.9)
    if (this.muzzle > 0.4) fb.ring(x + s.w, y + s.h * 0.62, (1 - this.muzzle) * 6 + 1, 1, 0xbff8ff, this.muzzle)
  }

  drawParticles(sx: number, sy: number) {
    const fb = this.fb
    for (let i = 0; i < NP; i++) {
      const l = this.pL[i]!
      if (l <= 0) continue
      const f = l / this.pM[i]!, x = this.pX[i]! + sx, y = this.pY[i]! + sy, kind = this.pK[i]!
      if (kind === 1) { fb.blend(x, y, mix(0x20202c, this.pC[i]!, f), 1); continue } // debris
      if (kind === 3) { fb.blend(x, y, this.pC[i]!, Math.min(1, f * 1.4)); continue } // dust
      if (kind === 2) { // jet exhaust: white → gold → red → smoke
        const c = f > 0.7 ? 0xfff2c8 : f > 0.45 ? 0xffb43a : f > 0.25 ? 0xe2402a : 0x5a2a3a
        fb.add(x, y, c, f > 0.25 ? 0.95 : f * 2); continue
      }
      const c = this.pC[i] || (f > 0.75 ? 0xffffff : f > 0.5 ? 0xffe070 : f > 0.25 ? 0xff7a28 : 0xb02818)
      fb.add(x, y, c, Math.min(1, f * 1.6))
      if (f > 0.6) fb.add(x - this.pVX[i]!, y - this.pVY[i]!, c, f * 0.5)
    }
  }

  private drawBolt(sx: number, sy: number) {
    const fb = this.fb, b = this.bolt, f = b.t / 0.45, a = 1 - f
    const zig = (xa: number, ya: number, xb: number, yb: number, amp: number, segs: number, core: boolean) => {
      const dx = xb - xa, dy = yb - ya, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len
      let x0 = xa, y0 = ya
      for (let s = 1; s <= segs; s++) {
        const t = s / segs, j = s === segs ? 0 : (this.rnd() - 0.5) * 2 * amp
        const x = xa + dx * t + nx * j, y = ya + dy * t + ny * j * 0.8
        fb.line(x0, y0, x, y, 0x4a5cff, a * 0.8)
        fb.line(x0, y0 + 1, x, y + 1, 0x3040c0, a * 0.5)
        if (core) fb.line(x0, y0, x, y, 0xffffff, a)
        else fb.line(x0, y0, x, y, 0xc8d8ff, a * 0.8)
        // a fork now and then
        if (core && s < segs && this.rnd() < 0.3) { const ba = Math.atan2(dy, dx) + (this.rnd() - 0.5) * 2.2, bl = 4 + this.rnd() * 7; zig(x, y, x + Math.cos(ba) * bl, y + Math.sin(ba) * bl, 1.5, 3, false) }
        x0 = x; y0 = y
      }
    }
    for (let k = 0; k < b.n; k++) {
      const x0 = b.x[k]! + sx, y0 = b.y[k]! + sy, x1 = b.x[k + 1]! + sx, y1 = b.y[k + 1]! + sy
      zig(x0, y0, x1, y1, 2 + Math.hypot(x1 - x0, y1 - y0) * 0.06, Math.max(4, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4)), true)
      fb.glow(x1, y1, 8, 0x9db8ff, a * 0.9)
    }
    // Mjölnir at the hand
    const S = this.sp()
    fb.spr(S.hammer, Math.floor(b.t * 30), b.x[0]! - 2 + sx, b.y[0]! - 8 + sy, 0, 1 - f * 0.5)
    fb.glow(b.x[0]! + sx, b.y[0]! - 4 + sy, 6, 0x9db8ff, 0.6 * (1 - f))
  }

  private drawSmash(sx: number, sy: number) {
    const fb = this.fb, W = this.W, H = this.H, t = this.smash.t
    const cx = Math.floor(W / 2)
    // the fist: drops from the sky, holds, lifts
    const fall = t < 0.42 ? easeIn3(t / 0.42) : t < 1.0 ? 1 : 1 - ease((t - 1.0) / 0.5)
    const fist = this.sp().fist, fh = fist.h
    const fy = Math.floor(-fh - 4 + fall * (H + 2)) - 0 + sy - 2
    const fx = cx - (fist.w >> 1) + sx
    if (t < 1.5) {
      // the forearm runs on up off the top of the screen
      for (let y = fy - 1; y >= 0; y--) for (let i = 0; i < fist.w; i++) { const o = 3 * fist.w + i; if (fist.a[o]! > 25) fb.blend(fx + i, y, fist.px[o]!, 1) }
      fb.spr(fist, 0, fx, fy)
      if (t < 0.42) for (let k = 1; k < 4; k++) fb.spr(fist, 0, fx, fy - k * 5, 0, 0.12 * (4 - k)) // motion smear
    }
    if (t > 0.42) {
      const f = (t - 0.42) / 1.1
      fb.ring(cx + sx, H - 2 + sy, ease(f) * W * 0.7, 3, 0x76cf57, (1 - f))
      fb.ring(cx + sx, H - 2 + sy, ease(f) * W * 0.5, 2, 0xd8ffc0, (1 - f) * 0.8)
      // cracks
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k / 6) * Math.PI, len = ease(f * 2) * (12 + hash(k) * 18)
        fb.line(cx + sx, H - 1 + sy, cx + sx + Math.cos(a) * len * 1.6, H - 1 + sy + Math.sin(a) * len * 0.5, 0xc8ff90, (1 - f) * 0.9)
      }
      // SMASH!
      if (t < 1.45) fb.headline('SMASH!', 2, 0xd8ff9a, 0x2f8a25, Math.min(1, (1.45 - t) * 4))
    }
  }

  private drawBossBar(e: Enemy) {
    const fb = this.fb, W = this.W
    const w = Math.min(46, W - 20), x0 = Math.floor((W - w) / 2), f = Math.max(0, e.hp / e.max)
    fb.text(x0 - 1, 0, ' ULTRON PRIME ', 0xffd0c8, 0x3a0a0e)
    for (let i = 0; i < w; i++) {
      const on = i / w < f
      const c = on ? mix(0xff3a2e, 0xffb040, i / w) : 0x2a1420
      fb.set(x0 + i, 3, on ? mix(c, 0xffffff, 0.35) : c); fb.set(x0 + i, 4, c)
    }
  }

  // the first wave teaches; a ready power says so; a live combo shows its clock
  private drawHints() {
    const fb = this.fb, W = this.W
    if (this.wave === 1 && this.modeT > 2.2 && this.modeT < 9) fb.textC(fb.rows - 1, W >= 60 ? ' ↑↓ move · SPACE fire · 1 shield · 2 lightning · 3 smash ' : ' ↑↓ · SPACE · 1 2 3 ', Math.floor(this.t * 3) % 2 ? 0xffffff : C.gold2, 0x0b0d18)
    if (this.combo >= 3) {
      const s = ` COMBO ${this.combo} · x${this.mult()} `
      fb.text(1, 0, s, this.mult() >= 3 ? C.gold2 : 0xffffff, 0x2a0d14)
      const n = Math.round((this.comboT / 1.8) * (s.length)), y = 2
      for (let i = 0; i < s.length; i++) fb.set(1 + i, y, i < n ? C.gold : 0x2a2a3a)
    }
  }
  private drawBanner() {
    const fb = this.fb, W = this.W, H = this.H, dt = this.t - this.bannerT
    if (dt < 0 || dt > 2.2 || this.smash.on) return
    const out = ease((dt - 1.7) / 0.5), a = 1 - out
    const label = this.bossWave ? 'WARNING' : 'WAVE ' + this.wave
    if (H >= 40) { const bh = Math.min(Math.floor(H * 0.35), H >= 56 ? 20 : 11); for (let j = 0; j < bh; j++) { const e = 1 - Math.abs(j - bh / 2) / (bh / 2); fb.darken(0, j, W, 1, 0.4 * Math.sqrt(e) * a) } }
    const h = this.bossWave ? fb.headline(label, 2, 0xffd0c0, 0xff2a1a, a) : fb.headline(label, 2, 0xffffff, 0xf5c542, a)
    const sub = this.bossWave ? 'ULTRON PRIME APPROACHING · +1 SUIT' : this.wave === 1 ? 'ULTRON SIEGE · NEW YORK' : 'INCOMING'
    if (dt > 0.3 && a > 0.5) fb.textC(Math.min(fb.rows - 1, (2 + h + 1) >> 1), ' ' + sub + ' ', this.bossWave ? 0xff8a7a : C.text, 0x0b0d18)
  }


  private drawTitle() {
    const fb = this.fb, W = this.W, H = this.H, S = sprites(), t = this.t
    fb.darken(0, 0, W, H, 0.55) // a calm backdrop so every word reads
    const R = H >> 1 // text rows
    const items = this.vs ? MENU : MENU.slice(0, 1)
    const help = W >= 76
      ? ['↑↓ choose · SPACE play · 1–5 or click · Q quit']
      : ['↑↓ · SPACE play · Q quit']
    // rows the menu and help need, then whatever is left for the title art
    const need = 2 + items.length + 1 + help.length + (this.best > 0 ? 1 : 0)
    const logoRows = (sc: number) => (Math.max(2, Math.floor(H * 0.08)) + 7 * sc * 2 + 3) >> 1
    const sc = W >= 70 && logoRows(2) + need + 1 <= R ? 2 : logoRows(1) + need + 1 <= R ? 1 : 0
    let row: number
    if (sc > 0) {
      const gap = 1, l1 = 'STARK', l2 = 'ARCADE', w2 = bigWidth(l2, sc, gap)
      const helm = S.helmet, showHelm = sc === 2 && W >= w2 + helm.w + 8 && R >= logoRows(2) + need + 6
      const blockW = showHelm ? helm.w + 5 + w2 : w2
      const bx = Math.floor((W - blockW) / 2) + (showHelm ? helm.w + 5 : 0), by = Math.max(2, Math.floor(H * 0.08))
      const intro = easeBack(t / 0.9)
      if (showHelm) {
        const hx = bx - helm.w - 5, hy = by + Math.floor((7 * sc * 2 + 3 - helm.h) / 2) + Math.round(Math.sin(t * 1.6) * 1.2)
        fb.glow(hx + helm.w / 2, hy + helm.h / 2, helm.w * 0.85, 0x6a1028, 0.7)
        fb.spr(helm, Math.floor(t * 9), hx, hy)
      }
      const shine = ((t * 45) % (w2 + 60)) - 30
      fb.big(l1, bx + Math.floor((w2 - bigWidth(l1, sc, gap)) / 2), by + Math.round((1 - intro) * -30), sc, sc, 0xfff4c8, 0xe0a030, { outline: 0x1c0a02, shadow: 0x05030a, shine, gap })
      fb.big(l2, bx, by + 7 * sc + 3 + Math.round((1 - intro) * 30), sc, sc, 0xffb4a0, 0xc8202c, { outline: 0x1c0204, shadow: 0x05030a, shine: shine - 10, gap })
      row = logoRows(sc) + 1
    } else {
      fb.textC(0, ' ◆  S T A R K   A R C A D E  ◆ ', 0xffe08a, 0x14101c)
      row = 1
    }
    fb.textC(row, ' PICK YOUR GAME ', 0xffffff, 0x0a1622)
    // the games: one row each, its own solid colour, white text, the picked one framed in gold
    const wid = Math.min(W - 4, Math.max(...items.map(m => m.label.length)) + 10)
    const x0 = Math.floor((W - wid) / 2)
    this.menuHit = []
    items.forEach((m, i) => {
      const r = row + 1 + i, on = i === this.menuSel
      const label = `${on ? '▶' : ' '} ${i + 1}  ${m.label}`
      const line = (label + ' '.repeat(wid)).slice(0, wid - 1) + (on ? '◀' : ' ')
      fb.text(x0, r, line, on ? 0xffffff : 0xf2f2f8, on ? m.hi : m.bg)
      this.menuHit.push({ row: r, x0, x1: x0 + wid, i })
    })
    const r2 = row + 1 + items.length + 1
    help.forEach((k, i) => fb.textC(r2 + i, ` ${k} `, 0xe6e8f5, 0x0b0d18))
    if (this.best > 0) fb.textC(r2 + help.length, ' SIEGE HIGH SCORE  ' + pad(this.best, 7) + ' ', 0xffe08a, 0x0b0d18)
  }

  // HOW TO PLAY: before every game, the controls for that game.
  private drawHowto() {
    const fb = this.fb, W = this.W, H = this.H, R = fb.rows, m = MENU[this.menuSel]!, h = HOWTO[this.menuSel]!
    fb.darken(0, 0, W, H, 0.7)
    const wid = Math.min(W - 2, 90), cw = Math.floor(wid / 3), x0 = Math.floor((W - cw * 3) / 2)
    const top = Math.max(0, Math.floor((R - 5) / 2))
    // row 1: three keycaps in the game's colour; rows 2-3: what each does; row 4: the signature; row 5: go
    const cols: [string, string[]][] = [['MOVE', h.move], ['FIGHT', h.fight], ['WIN', h.win]]
    // too narrow for three columns without cutting words: one row per section, the keycap then its lines
    if (cols.some(([, ls]) => ls.some(l => l.length > cw - 2))) {
      const room = Math.min(W - 2, 60), x = Math.max(0, Math.floor((W - room) / 2)), tagW = 7
      // a section's lines share a row when they fit, else take a row each
      const rowsOf = cols.map(([, ls]) => (ls.join(' · ').length <= room - tagW - 1 ? [ls.join(' · ')] : ls))
      const total = rowsOf.reduce((k, r) => k + r.length, 0)
      let y = Math.max(0, Math.floor((R - total - 2) / 2))
      cols.forEach(([cap], j) => rowsOf[j]!.forEach((l, i) => {
        if (y >= R - 2) return
        fb.text(x, y, i ? ' '.repeat(tagW) : ' ' + cap.padEnd(5) + ' ', 0xffffff, i ? 0x0b0d18 : m.hi)
        fb.text(x + tagW, y, (' ' + l + ' '.repeat(room)).slice(0, room - tagW), 0xffffff, 0x0b0d18)
        y++
      }))
      const sig = wrap(h.sig, W - 6)[0] ?? ''
      fb.textC(Math.min(R - 2, y), ` ★ ${sig} `, 0xffe08a, 0x1a1408)
      const go = W >= 60 ? '▶  SPACE start  ·  B back  ·  Q quit  ◀' : '▶ SPACE start · B back ◀'
      fb.textC(Math.min(R - 1, y + 1), ` ${go} `, Math.floor(this.t * 2.2) % 2 === 0 ? 0xffffff : 0xffe08a, m.bg)
      return
    }
    cols.forEach(([cap, lines], c) => {
      const x = x0 + c * cw
      fb.text(x, top, (' ' + cap + ' '.repeat(cw)).slice(0, cw - 1), 0xffffff, m.hi)
      lines.forEach((l, j) => { if (top + 1 + j < R) fb.text(x, top + 1 + j, (' ' + l + ' '.repeat(cw)).slice(0, cw - 1), j === 0 ? 0xffffff : 0xc8cce0, 0x0b0d18) })
    })
    const sig = h.sig.length > cw * 3 - 4 ? wrap(h.sig, cw * 3 - 4)[0]! : h.sig
    if (top + 3 < R) fb.textC(top + 3, ` ★ ${sig} `, 0xffe08a, 0x1a1408)
    const go = W >= 60 ? '▶  SPACE start  ·  B back  ·  Q quit  ◀' : '▶ SPACE start · B back ◀'
    fb.textC(Math.min(R - 1, top + 4), ` ${go} `, Math.floor(this.t * 2.2) % 2 === 0 ? 0xffffff : 0xffe08a, m.bg)
  }



  private drawOver() {
    const fb = this.fb, W = this.W, H = this.H, t = this.overT, R = fb.rows
    fb.darken(0, 0, W, H, (H >= 40 ? 0.55 : 0.35) * ease(t / 0.8))
    const h = fb.headline(W >= 76 ? 'SUIT OFFLINE' : 'OFFLINE', 2, 0xffd0c8, 0xc41f28, ease(t / 0.6))
    if (t < 0.6) return
    const row = Math.min(R - 3, (2 + h + 3) >> 1)
    fb.textC(row, ` SCORE ${pad(this.score, 7)} · WAVE ${this.wave} · KILLS ${this.kills} `, C.text, 0x0b0d18)
    fb.textC(row + 1, this.newRecord ? ' ★ NEW HIGH SCORE ★ ' : ` HIGH SCORE ${pad(this.best, 7)} `, this.newRecord ? (Math.floor(t * 4) % 2 ? C.gold2 : C.gold) : C.gold, 0x0b0d18)
    if (t > 1) fb.textC(Math.min(R - 1, row + 2), W >= 60 ? ' ▶ SPACE play again · B menu · Q quit ◀ ' : ' SPACE again · B menu ', Math.floor(t * 2.2) % 2 === 0 ? 0xffffff : C.gold2, 0x2a0d14)
  }


  private drawPause() {
    const fb = this.fb, W = this.W, H = this.H, r = Math.max(0, (fb.rows >> 1) - 1)
    fb.darken(0, 0, W, H, 0.45)
    fb.textC(r, this.quitArmed ? ' PAUSED · Q again to QUIT ' : ' PAUSED ', 0xffffff, this.quitArmed ? 0x8e1a26 : 0x1a3a5a)
    fb.textC(Math.min(fb.rows - 1, r + 1), W >= 56 ? ' P resume · R restart · B menu · Q quit ' : ' P · R · B · Q ', 0xe6e8f5, 0x0b0d18)
  }



  // ── the frame as runs: HUD row, playfield rows, JARVIS row ─────────────
  // Budget: a Client tree holds 100,000 serialized characters; colours are
  // coarsened (fewer, longer runs) when a frame comes close.
  frameRuns(): Run[][] { return this.frameOut().runs }
  frameOut(): { runs: Run[][]; specs: TextSpec[]; size: number } {
    // levels: full colour, then coarser colour, then (a big pane in a busy
    // moment) pixel pairs and quads sharing one colour across
    // pairing pixels across keeps gradients smooth, so it comes before strong colour masks
    const MASKS = [0xffffff, 0xfcfcfc, 0xf8f8f8, 0xfcfcfc, 0xf8f8f8, 0xf0f0f0, 0xf0f0f0, 0xe0e0e0, 0xc0c0c0]
    const WIDE = [0, 0, 0, 1, 1, 1, 3, 3, 3]
    // each frame tries one level finer than the last, so colour comes back once there is room
    let m = Math.max(0, this.level - 1)
    const hud = this.hudRuns(), jar = this.jarvisRuns()
    for (;;) {
      if (WIDE[m]) { const px = this.fb.px, k = WIDE[m]!, W = this.W; for (let y = 0; y < this.H; y++) for (let x = 0; x < W; x++) if (x & k) px[y * W + x] = px[y * W + (x & ~k)]! }
      const runs: Run[][] = [hud]
      for (let r = 0; r < this.fb.rows; r++) runs.push(encodeRow(this.fb, r, MASKS[m]!, []))
      runs.push(jar)
      const specs = runs.map(rowSpec), size = specSize(specs)
      if (size <= 92000 || m === MASKS.length - 1) {
        // ease back toward full colour once there is room again
        this.level = m; this.mask = MASKS[m]!
        return { runs, specs, size }
      }
      m++
    }
  }

  private hudRuns(): Run[] {
    if (this.mode === 'vs') return clip(this.vs!.hud(), this.W)
    const W = this.W, bg = C.hudbg, narrow = W < 96, runs: Run[] = []
    const put = (s: string, fg: number, b = false) => runs.push({ s, fg, bg, b })
    put(narrow ? ' ◆ ' : ' ◆ STARK ARCADE ', C.gold, true)
    if (this.mode === 'title' || this.mode === 'howto') {
      put(narrow ? 'STARK ARCADE ' : ' ', C.gold, true)
      put(this.mode === 'title' ? 'PICK YOUR GAME' : (MENU[this.menuSel]!.label.split(' · ')[0] ?? ''), this.mode === 'title' ? C.text : C.gold2, true)
    } else {
      put(narrow ? 'W' : ' WAVE ', C.dim); put(String(this.wave).padStart(2, '0'), C.text, true)
      put(narrow ? ' ' : '  SCORE ', C.dim); put(pad(Math.round(this.shown), 7), C.white, true)
      const m = this.mult()
      if (m > 1) put(' x' + m, m >= 6 ? 0xff5a4a : m >= 3 ? C.gold2 : C.gold, true)
      put(narrow ? ' ' : '  SUIT ', C.dim)
      for (let i = 0; i < 3; i++) put(i < this.hp ? '◉' : '○', i < this.hp ? (this.hp === 1 ? 0xff5a4a : C.arc) : 0x3a3a55, true)
      if (this.triple > 0 && !narrow) put(' TRI', C.arc2, true)
    }
    const used = runs.reduce((n, r) => n + r.s.length, 0)
    // power meters, right-aligned: full where there is room, compact where not
    const meters: Run[] = []
    const bar = (k: string, f: number, c: number, n: number) => {
      const on = Math.round(k01(f) * n), ready = f >= 1
      meters.push({ s: ' ' + k + (n > 3 ? ' ' : ''), fg: ready ? 0x10101c : C.dim, bg: ready ? c : bg, b: true })
      meters.push({ s: '▰'.repeat(on), fg: c, bg }, { s: '▱'.repeat(n - on), fg: 0x3a3a55, bg })
    }
    if (this.mode !== 'title' && this.mode !== 'howto') for (const n of [5, 3]) {
      meters.length = 0
      bar('1', 1 - this.cdShield / 5, C.cap, n)
      bar('2', this.thunderCharges > 0 ? 1 : 1 - this.cdThunder / 7, C.bolt, n)
      bar('3', this.rage / 100, C.hulk, n)
      if (used + meters.reduce((k, r) => k + r.s.length, 0) + 1 <= W) break
    }
    const mw = meters.reduce((n, r) => n + r.s.length, 0)
    if (used + mw + 1 <= W) { runs.push({ s: ' '.repeat(W - used - mw), fg: C.dim, bg }); runs.push(...meters) }
    else if (used < W) runs.push({ s: ' '.repeat(W - used), fg: C.dim, bg })
    return clip(runs, W)
  }

  private jarvisRuns(): Run[] {
    const W = this.W, bg = C.hudbg
    const n = Math.min(this.jarvis.length, Math.floor((this.t - this.jarvisT) * 45))
    const right = this.mode === 'vs' ? this.vs!.right() : this.mode === 'title' || this.mode === 'howto' ? '' : W >= 80 ? `BEST ${pad(Math.max(this.best, this.score), 7)} ` : ''
    const label = W >= 70 ? ' ◉ ' + this.speaker + ' ' : ' ◉ ' + this.speaker.slice(0, 6) + ' '
    const room = Math.max(8, W - label.length - 3 - right.length)
    let typed = this.jarvis.slice(0, n)
    // a line too long for the row scrolls: it types on, then glides to its end and holds
    if (typed.length > room) { const over = typed.length - room, held = n >= this.jarvis.length ? Math.min(over, Math.floor((this.t - this.jarvisT - this.jarvis.length / 45) * 18)) : over; typed = typed.slice(Math.max(0, held), Math.max(0, held) + room) }
    const caret = n < this.jarvis.length || Math.floor(this.t * 2) % 2 ? '▌' : ' '
    const runs: Run[] = [{ s: label, fg: this.speakerC, bg, b: true }, { s: '› ', fg: 0x3a6a80, bg }, { s: typed, fg: 0xbfeaff, bg }, { s: caret, fg: C.arc, bg }]
    const used = runs.reduce((k, r) => k + r.s.length, 0)
    if (used + right.length < W) runs.push({ s: ' '.repeat(W - used - right.length), fg: C.dim, bg }, { s: right, fg: C.gold, bg })
    else if (used < W) runs.push({ s: ' '.repeat(W - used), fg: C.dim, bg }) // no room for the right side: the row still spans the pane
    return clip(runs, W)
  }

}

export const easeIn3 = (t: number) => k01(t) ** 3
export const pad = (n: number, w: number) => String(Math.max(0, Math.floor(n))).padStart(w, '0')
export function hash(n: number) { let x = Math.imul(n | 0, 0x45d9f3b) ^ 0x9e3779b9; x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); x ^= x >>> 16; return (x >>> 0) / 4294967296 }
function clip(runs: Run[], W: number): Run[] {
  let n = 0
  const out: Run[] = []
  for (const r of runs) { if (n >= W) break; const s = r.s.slice(0, W - n); n += s.length; out.push({ ...r, s }) }
  return out
}

// One terminal row as a Text spec: the row's commonest colours on the outer
// Text, its runs in those as bare strings, the rest as nested Texts naming
// only what differs (a Client tree is held to 100,000 serialized characters).
export type TextSpec = { props: Record<string, string | boolean>; kids: (string | { props: Record<string, string | boolean>; s: string })[] }
const hex = (c: number) => '#' + (c & 0xffffff).toString(16).padStart(6, '0')
export function rowSpec(runs: Run[]): TextSpec {
  let best = runs[0], most = -1
  const tally = new Map<string, number>()
  for (const r of runs) {
    if (r.fg === -1) continue
    const k = r.fg + ',' + r.bg + (r.b ? 'b' : '')
    const n = (tally.get(k) ?? 0) + r.s.length
    tally.set(k, n)
    if (n > most) { most = n; best = r }
  }
  const pf = best?.fg ?? -1, pb = best?.bg ?? C.bg, pB = !!best?.b
  const kids: TextSpec['kids'] = []
  for (const r of runs) {
    const fg = r.fg === -1 ? pf : r.fg
    if (fg === pf && r.bg === pb && !!r.b === pB) { kids.push(r.s); continue }
    const p: Record<string, string | boolean> = {}
    if (fg !== pf && fg !== -1) p.color = hex(fg)
    if (r.bg !== pb) p.backgroundColor = hex(r.bg)
    if (!!r.b !== pB) p.bold = !!r.b
    const last = kids[kids.length - 1]
    if (last && typeof last !== 'string' && sameProps(last.props, p)) last.s += r.s
    else kids.push({ props: p, s: r.s })
  }
  const props: Record<string, string | boolean> = { backgroundColor: hex(pb) }
  if (pf !== -1) props.color = hex(pf)
  if (pB) props.bold = true
  return { props, kids }
}
function sameProps(a: Record<string, unknown>, b: Record<string, unknown>) {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every(k => a[k] === b[k])
}
// What a frame's tree serializes to, in characters (the bound is 100,000).
export function specSize(rows: TextSpec[]) {
  return JSON.stringify({ type: 'Box', props: { flexDirection: 'column', width: 0, height: 0 }, children: rows.map(r => ({ type: 'Text', props: r.props, children: r.kids.map(k => (typeof k === 'string' ? k : { type: 'Text', props: k.props, children: [k.s] })) })) }).length
}
