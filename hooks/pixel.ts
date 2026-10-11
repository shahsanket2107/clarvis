// clarvis: the pixel engine. A Canvas is a grid of truecolor pixels; it
// encodes to Raster cells as half blocks (▀ with the top pixel as foreground
// and the bottom as background), so one terminal row holds two pixel rows.
// Pure and allocation-free per frame: a Canvas and its cell buffer are made
// once per size and reused, so animating never grows memory.

export const CLEAR = -1 // a transparent pixel: the card's surface (or the terminal's background) shows
export const HOLE = -2 // through the card too: the terminal's own background (the card's rounded corners)
export const DEFAULT = 0x01000000 // Raster's "terminal default" colour
// What a half-transparent pixel is blended onto: a Ghostty background.
// A dark page behind the art; on any other dark theme the art still reads.
export const BACKDROP = 0x1b1b29
// A logical pixel (one column across, half a row down) is not square: in
// a Ghostty a cell is 8.4 × 20.3, so a pixel is 0.83 as wide as tall.
// Round things measure x in heights: dx * PXW.
export const PXW = 8.4 / 10.15

export const rgb = (hex: string) => parseInt(hex.slice(1, 7), 16)
const R = (c: number) => (c >> 16) & 255, G = (c: number) => (c >> 8) & 255, B = (c: number) => c & 255
export function lerp(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  return ((R(a) + (R(b) - R(a)) * k) << 16) | ((G(a) + (G(b) - G(a)) * k) << 8) | (B(a) + (B(b) - B(a)) * k) | 0
}
// Adds light (glows, beams, sparks): saturates instead of washing out.
export function add(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  return (Math.min(255, R(a) + R(b) * k) << 16) | (Math.min(255, G(a) + G(b) * k) << 8) | Math.min(255, B(a) + B(b) * k)
}
export const scale = (c: number, k: number) => lerp(0, c, k)

// ── sprites ─────────────────────────────────────────────────────────────────
// Drawn as text art: one character per pixel, looked up in a palette; '.' is clear.
export type Sprite = { w: number; h: number; px: Int32Array }
export function sprite(rows: string[], pal: Record<string, string>): Sprite {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length
  const px = new Int32Array(w * h).fill(CLEAR)
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const ch = r[x]!; if (ch !== '.' && ch !== ' ') { const c = pal[ch]; if (c === undefined) throw new Error(`sprite: no colour for '${ch}'`); px[y * w + x] = rgb(c) } } })
  return { w, h, px }
}
// A sprite mirrored.
export function flipX(s: Sprite): Sprite {
  const px = new Int32Array(s.w * s.h)
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) px[y * s.w + x] = s.px[y * s.w + (s.w - 1 - x)]!
  return { w: s.w, h: s.h, px }
}

// ── the canvas ──────────────────────────────────────────────────────────────
// Scenes draw in logical pixels: one terminal column wide, half a row tall
// (about square). Underneath, each logical pixel is two subpixels across, so
// a cell holds 2 × 2 subpixels and encodes as a quadrant block: twice the
// horizontal detail at edges. Baked art (HiSprite) is drawn at subpixel
// resolution; the logical-pixel calls fill both subpixels.
export type HiSprite = { w: number; h: number; px: Int32Array; a: Uint8Array } // w in subpixels
export class Canvas {
  readonly W: number // subpixels across
  readonly px: Int32Array
  // Text drawn over the art, one code point per cell (0 = none) with its colour.
  readonly glyph: Uint32Array
  readonly glyphFg: Int32Array
  // A text cell's own background (-1: the card's surface), for speech bubbles and caption boxes.
  readonly glyphBg: Int32Array
  // The card's surface: what clear pixels and text sit on (DEFAULT: no card).
  panel = DEFAULT
  // A horizontal clip, in subpixels: drawing outside [cl, cr) is dropped (comic panels).
  cl = 0
  cr = 1e9
  static made = 0 // canvases made since load: a frame must never make one
  constructor(readonly w: number, readonly h: number) {
    Canvas.made++
    this.W = w * 2
    this.px = new Int32Array(this.W * h).fill(CLEAR)
    const cells = w * Math.ceil(h / 2)
    this.glyph = new Uint32Array(cells)
    this.glyphFg = new Int32Array(cells)
    this.glyphBg = new Int32Array(cells).fill(-1)
  }
  get rows() { return Math.ceil(this.h / 2) }
  clear() { this.px.fill(CLEAR); this.glyph.fill(0); this.glyphBg.fill(-1); this.panel = DEFAULT; this.cl = 0; this.cr = 1e9 }
  clip(xs0: number, xs1: number) { this.cl = Math.floor(xs0); this.cr = Math.floor(xs1) }
  unclip() { this.cl = 0; this.cr = 1e9 }
  get(x: number, y: number) { const xs = Math.floor(x * 2); y = Math.floor(y); return xs < 0 || y < 0 || xs >= this.W || y >= this.h ? CLEAR : this.px[y * this.W + xs]! }
  // one subpixel, at subpixel column xs
  setSub(xs: number, y: number, c: number) {
    xs = Math.floor(xs); y = Math.floor(y)
    if (xs >= this.cl && xs < this.cr && xs >= 0 && y >= 0 && xs < this.W && y < this.h) this.px[y * this.W + xs] = c
  }
  glowSub(xs: number, y: number, c: number, a: number) {
    xs = Math.floor(xs); y = Math.floor(y)
    if (a <= 0 || xs < this.cl || xs >= this.cr || xs < 0 || y < 0 || xs >= this.W || y >= this.h) return
    const i = y * this.W + xs, under = this.px[i]!
    if (under === CLEAR) { if (a >= 0.12) this.px[i] = add(BACKDROP, c, a) }
    else this.px[i] = add(under, c, a)
  }
  blendSub(xs: number, y: number, c: number, a: number) {
    xs = Math.floor(xs); y = Math.floor(y)
    if (a <= 0 || xs < this.cl || xs >= this.cr || xs < 0 || y < 0 || xs >= this.W || y >= this.h) return
    const i = y * this.W + xs, under = this.px[i]!
    this.px[i] = a >= 1 ? c : lerp(under === CLEAR ? BACKDROP : under, c, a)
  }
  set(x: number, y: number, c: number) { const xs = Math.floor(x) * 2; this.setSub(xs, y, c); this.setSub(xs + 1, y, c) }
  blend(x: number, y: number, c: number, a: number) { const xs = Math.floor(x) * 2; this.blendSub(xs, y, c, a); this.blendSub(xs + 1, y, c, a) }
  // Adds light; a faint glow over clear stays clear, so the art never paints
  // muddy squares on the terminal's background.
  glow(x: number, y: number, c: number, a: number) { const xs = Math.floor(x) * 2; this.glowSub(xs, y, c, a); this.glowSub(xs + 1, y, c, a) }
  rect(x: number, y: number, w: number, h: number, c: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w * 2; i++) this.setSub(Math.floor(x * 2) + i, y + j, c)
  }
  // A text-art sprite (logical pixels) with its top-left at x, y.
  draw(s: Sprite, x: number, y: number, o: { tint?: number; tintAmt?: number; alpha?: number; flip?: boolean } = {}) {
    x = Math.round(x); y = Math.round(y)
    const a = o.alpha ?? 1
    for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
      let c = s.px[j * s.w + (o.flip ? s.w - 1 - i : i)]!
      if (c === CLEAR) continue
      if (o.tint !== undefined) c = lerp(c, o.tint, o.tintAmt ?? 0.5)
      if (a >= 1) this.set(x + i, y + j, c); else this.blend(x + i, y + j, c, a)
    }
  }
  // Baked art, anti-aliased, with its top-left at logical x, y.
  hi(s: HiSprite, x: number, y: number, o: { tint?: number; tintAmt?: number; alpha?: number; flip?: boolean; add?: boolean } = {}) {
    const xs0 = Math.round(x * 2), y0 = Math.round(y), k = o.alpha ?? 1
    for (let j = 0; j < s.h; j++) {
      const yy = y0 + j
      if (yy < 0 || yy >= this.h) continue
      for (let i = 0; i < s.w; i++) {
        const xx = xs0 + i
        if (xx < 0 || xx >= this.W || xx < this.cl || xx >= this.cr) continue
        const si = j * s.w + (o.flip ? s.w - 1 - i : i), a = (s.a[si]! / 255) * k
        if (a < 0.08) continue
        let c = s.px[si]!
        if (o.tint !== undefined) c = lerp(c, o.tint, o.tintAmt ?? 0.5)
        if (o.add) this.glowSub(xx, yy, c, a)
        else this.blendSub(xx, yy, c, a >= 0.92 ? 1 : a)
      }
    }
  }
  // A sprite (either kind) rotated by `ang` and scaled, its centre at cx, cy.
  drawRot(s: Sprite | HiSprite, cx: number, cy: number, ang: number, o: { sx?: number; sy?: number } = {}) {
    const hiRes = 'a' in s, sw = hiRes ? s.w / 2 : s.w // logical width
    const sx = o.sx ?? 1, sy = o.sy ?? 1
    const cos = Math.cos(ang), sin = Math.sin(ang)
    const r = Math.ceil(Math.hypot(sw * sx, s.h * sy) / 2) + 1
    for (let y = -r; y <= r; y++) for (let xs = -r * 2; xs <= r * 2; xs++) {
      const x = (xs + 0.5) / 2, yy = y + 0.5
      const u = (cos * x + sin * yy) / sx + sw / 2, v = (-sin * x + cos * yy) / sy + s.h / 2
      if (u < 0 || v < 0 || u >= sw || v >= s.h) continue
      const iu = hiRes ? Math.floor(u * 2) : Math.floor(u), iv = Math.floor(v)
      const c = s.px[iv * s.w + iu]!
      if (c === CLEAR) continue
      if (hiRes) { const a = (s as HiSprite).a[iv * s.w + iu]! / 255; if (a >= 0.08) this.blendSub(Math.round(cx * 2) + xs, Math.round(cy) + y, c, a >= 0.92 ? 1 : a) }
      else this.setSub(Math.round(cx * 2) + xs, Math.round(cy) + y, c)
    }
  }
  // A soft round light: brightest at the centre, falling off to nothing at `r`.
  radial(cx: number, cy: number, r: number, c: number, a = 1) {
    const r2 = r * r
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let xs = Math.floor((cx - r / PXW) * 2); xs <= Math.ceil((cx + r / PXW) * 2); xs++) {
      const d2 = (((xs + 0.5) / 2 - cx) * PXW) ** 2 + (y + 0.5 - cy) ** 2
      if (d2 < r2) { const f = 1 - Math.sqrt(d2) / r; this.glowSub(xs, y, c, a * f * f) }
    }
  }
  // A filled ring between radii r0 and r1, coloured by `fn(angle)`.
  ring(cx: number, cy: number, r0: number, r1: number, fn: (ang: number, d: number) => number) {
    for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++) for (let xs = Math.floor((cx - r1 / PXW) * 2); xs <= Math.ceil((cx + r1 / PXW) * 2); xs++) {
      const dx = ((xs + 0.5) / 2 - cx) * PXW, dy = y + 0.5 - cy, d = Math.hypot(dx, dy)
      if (d >= r0 && d < r1) { const c = fn(Math.atan2(dy, dx), d); if (c !== CLEAR) this.setSub(xs, y, c) }
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number, a = 1) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0) * 2, Math.abs(y1 - y0))))
    for (let i = 0; i <= n; i++) {
      const t = i / n, xs = (x0 + (x1 - x0) * t) * 2, y = y0 + (y1 - y0) * t
      if (a >= 1) this.setSub(xs, y, c); else this.glowSub(xs, y, c, a)
    }
  }
  // Writes text into cells (row = terminal row), over the art. Whatever it is
  // given (a command, a prompt, a question), only safe cells come out.
  text(col: number, row: number, s: string, color: number, bg = -1) {
    let x = Math.round(col)
    for (const ch of s) {
      if (x >= this.w) break
      if (ZERO_WIDTH.test(ch)) continue
      const cp = safeCell(ch)
      if (x >= 0 && row >= 0 && row < this.rows && x * 2 >= this.cl && x * 2 < this.cr) { const i = row * this.w + x; this.glyph[i] = cp; this.glyphFg[i] = color; this.glyphBg[i] = bg }
      x++
    }
  }
}

// A Raster cell must hold one printable, width-1 BMP character, or the host
// refuses the whole band. Anything else (emoji, CJK, controls, tabs) is '?'.
const ZERO_WIDTH = /[\p{M}\u200B-\u200F\u2060-\u206F\uFE00-\uFE0F\uFEFF]/u
const BAD = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}]/u
const WIDE: [number, number][] = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3], [0x25fd, 0x25fe],
  [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be],
  [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa],
  [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755],
  [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
  [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6],
]
export function safeCell(ch: string): number {
  const cp = ch.codePointAt(0) ?? 0x3f
  if (cp > 0xffff || cp < 0x20 || BAD.test(ch)) return 0x3f
  for (const [a, b] of WIDE) if (cp >= a && cp <= b) return 0x3f
  return cp
}

// ── cells ───────────────────────────────────────────────────────────────────
// Each cell's 2 × 2 subpixels become the quadrant block (or half block) whose
// two colours fit them best. Bits: top-left 8, top-right 4, bottom-left 2,
// bottom-right 1.
const QUAD = [0x20, 0x2597, 0x2596, 0x2584, 0x259D, 0x2590, 0x259E, 0x259F, 0x2598, 0x259A, 0x258C, 0x2599, 0x2580, 0x259C, 0x259B, 0x2588]
const DEFAULT_BG = DEFAULT
const sq = (a: number, b: number) => { const dr = ((a >> 16) & 255) - ((b >> 16) & 255), dg = ((a >> 8) & 255) - ((b >> 8) & 255), db = (a & 255) - (b & 255); return dr * dr + dg * dg + db * db }
function avg(c: number[], n: number): number {
  let r = 0, g = 0, b = 0
  for (let i = 0; i < n; i++) { r += (c[i]! >> 16) & 255; g += (c[i]! >> 8) & 255; b += c[i]! & 255 }
  return (((r / n) & 0xfc) << 16) | (((g / n) & 0xfc) << 8) | ((b / n) & 0xfc)
}
const BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]
const quad = [0, 0, 0, 0], fgs = [0, 0, 0, 0], bgs = [0, 0, 0, 0]
// Fills `out` (columns * rows * 3 u32 words) with the canvas as Raster cells.
export function encode(cv: Canvas, out: Uint32Array): Uint32Array {
  const { w, W, px, glyph, glyphFg } = cv, rows = cv.rows
  for (let row = 0; row < rows; row++) for (let x = 0; x < w; x++) {
    const ci = row * w + x, o = ci * 3
    const g = glyph[ci]!
    const pnl = cv.panel
    if (g) { const gb = cv.glyphBg[ci]!; out[o] = g; out[o + 1] = glyphFg[ci]! & 0xffffff; out[o + 2] = gb >= 0 ? gb & 0xfcfcfc : pnl === DEFAULT ? DEFAULT : pnl & 0xfcfcfc; continue } // text sits on the card, through the art
    const y0 = row * 2, y1 = y0 + 1 < cv.h ? y0 + 1 : -1
    quad[0] = px[y0 * W + x * 2]!; quad[1] = px[y0 * W + x * 2 + 1]!
    quad[2] = y1 < 0 ? CLEAR : px[y1 * W + x * 2]!; quad[3] = y1 < 0 ? CLEAR : px[y1 * W + x * 2 + 1]!
    let clear = 0
    for (let i = 0; i < 4; i++) { if (quad[i] === CLEAR && pnl !== DEFAULT) quad[i] = pnl; else if (quad[i] === HOLE) quad[i] = CLEAR; if (quad[i] === CLEAR) clear |= 8 >> i }
    if (clear === 15) { out[o] = 0x20; out[o + 1] = DEFAULT_BG; out[o + 2] = DEFAULT_BG; continue }
    if (!clear && quad[0] === quad[1] && quad[1] === quad[2] && quad[2] === quad[3]) { out[o] = 0x20; out[o + 1] = DEFAULT_BG; out[o + 2] = quad[0]! & 0xfcfcfc; continue } // one colour: a space on it, so it matches the text cells exactly
    let best = Infinity, bm = 15, bf = 0, bb = DEFAULT_BG
    for (let m = 1; m < 16; m++) {
      if (m & clear) continue // the foreground is drawn ink: never a clear subpixel
      let nf = 0, nb = 0, bgClear = true
      for (let i = 0; i < 4; i++) {
        const c = quad[i]!
        if (m & (8 >> i)) fgs[nf++] = c
        else { bgs[nb++] = c === CLEAR ? BACKDROP : c; if (c !== CLEAR) bgClear = false }
      }
      const f = avg(fgs, nf), b = nb ? (bgClear ? DEFAULT_BG : avg(bgs, nb)) : DEFAULT_BG
      let err = 0
      for (let i = 0; i < nf; i++) err += sq(fgs[i]!, f)
      if (nb && !bgClear) for (let i = 0; i < nb; i++) err += sq(bgs[i]!, b)
      // ties: the half block ▀, else the fewer-ink glyph (the commoner colour is the background, so runs merge)
      if (err < best || (err === best && bm !== 12 && (m === 12 || BITS[m]! < BITS[bm]!))) { best = err; bm = m; bf = f; bb = b }
    }
    out[o] = QUAD[bm]!; out[o + 1] = bf; out[o + 2] = bm === 15 ? DEFAULT_BG : bb
  }
  return out
}

// Base64 of the cell words, little-endian, as Raster's `cells` wants.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export function base64(bytes: Uint8Array): string {
  const native = (bytes as unknown as { toBase64?: () => string }).toBase64
  if (native) return native.call(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0
    s += B64[a >> 2]! + B64[((a & 3) << 4) | (b >> 4)]! + (i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)]! : '=') + (i + 2 < bytes.length ? B64[c & 63]! : '=')
  }
  return s
}

// A canvas and its cell buffer for one size, reused frame after frame.
export class Surface {
  readonly cv: Canvas
  readonly words: Uint32Array
  constructor(readonly columns: number, readonly rowCount: number) {
    this.cv = new Canvas(columns, rowCount * 2)
    this.words = new Uint32Array(columns * rowCount * 3)
  }
  cells(): string { return base64(new Uint8Array(encode(this.cv, this.words).buffer)) }
}
// Keeps one Surface per name, replaced when its size changes.
const surfaces = new Map<string, Surface>()
export function surface(name: string, columns: number, rows: number): Surface {
  const s = surfaces.get(name)
  if (s && s.columns === columns && s.rowCount === rows) return s
  const n = new Surface(columns, rows)
  surfaces.set(name, n)
  return n
}

// ── easing ──────────────────────────────────────────────────────────────────
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3
export const easeIn = (t: number) => clamp01(t) ** 3
export const easeInOut = (t: number) => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2 }
export const easeOutBack = (t: number) => { t = clamp01(t); const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2 }
export const easeOutBounce = (t: number) => {
  t = clamp01(t); const n = 7.5625, d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}
// Deterministic noise: the same frame draws the same every time.
export const hash = (a: number, b = 0) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x) }

// Baked art, decoded once at load: base64 RGBA into colours and coverage.
const B64I = new Int16Array(128).fill(-1)
for (let i = 0; i < 64; i++) B64I['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.charCodeAt(i)] = i
export function decodeSprite(w: number, h: number, b64: string): HiSprite {
  const n = w * h, bytes = new Uint8Array(n * 4)
  let o = 0
  for (let i = 0; i < b64.length && o < bytes.length; i += 4) {
    const a = B64I[b64.charCodeAt(i)]!, b = B64I[b64.charCodeAt(i + 1)]!, c = B64I[b64.charCodeAt(i + 2)]!, d = B64I[b64.charCodeAt(i + 3)]!
    bytes[o++] = (a << 2) | (b >> 4)
    if (c >= 0 && o < bytes.length) bytes[o++] = ((b & 15) << 4) | (c >> 2)
    if (d >= 0 && o < bytes.length) bytes[o++] = ((c & 3) << 6) | d
  }
  const px = new Int32Array(n), al = new Uint8Array(n)
  for (let i = 0; i < n; i++) { al[i] = bytes[i * 4 + 3]!; px[i] = al[i]! ? (bytes[i * 4]! << 16) | (bytes[i * 4 + 1]! << 8) | bytes[i * 4 + 2]! : CLEAR }
  return { w, h, px, a: al }
}
