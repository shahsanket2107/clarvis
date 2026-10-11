// clarvis flair: seasonal and easter-egg touches drawn over a finished frame.
// Drawing only, on the canvas the frame already made; nothing here allocates
// a canvas or touches the engine.
import { CLEAR, HOLE, DEFAULT, lerp, hash, rgb, type Canvas } from './pixel'
import type { Flair } from './season'

const PUMPKIN = rgb('#FF7A18')
const TAU = Math.PI * 2

/** Every drawn pixel pulled toward pumpkin orange. */
export function tint(cv: Canvas, c: number, amt: number) {
  const px = cv.px
  for (let i = 0; i < px.length; i++) { const p = px[i]!; if (p !== CLEAR && p !== HOLE && p !== DEFAULT && p >= 0) px[i] = lerp(p, c, amt) }
}
/** A few bursts of sparks, staggered; they loop every couple of seconds. */
function fireworks(cv: Canvas, t: number) {
  const cols = [rgb('#FFD84D'), rgb('#FF5C8A'), rgb('#5FE1FF'), rgb('#7CFF8A')]
  for (let b = 0; b < 4; b++) {
    const k = ((t - b * 0.45) % 1.8) / 1.8
    if (t < b * 0.45 || k < 0 || k > 1) continue
    const seed = Math.floor((t - b * 0.45) / 1.8) * 7 + b
    const cx = 6 + hash(seed, 1) * Math.max(1, cv.w - 12), cy = 1 + hash(seed, 2) * Math.max(1, cv.h - 3)
    const r = k * 5, fade = 1 - k
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU
      cv.glowSub((cx + Math.cos(a) * r * 1.4) * 2, cy + Math.sin(a) * r * 0.7, cols[b % cols.length]!, 0.8 * fade)
    }
  }
}
/** Snow: single dots falling through empty cells only, so no word is touched. */
export function snow(cv: Canvas, t: number) {
  const n = Math.max(2, Math.floor(cv.w / 14)), rows = cv.rows
  for (let i = 0; i < n; i++) {
    const col = Math.floor((hash(i, 5) * cv.w + t * 0.7 * (1 + hash(i, 6))) % cv.w)
    const row = Math.floor((hash(i, 7) * rows + t * (0.6 + hash(i, 8))) % rows)
    if (col < 0 || row < 0 || cv.glyph[row * cv.w + col] !== 0) continue
    cv.text(col, row, hash(i, 9) > 0.5 ? '·' : '*', rgb('#DDEBFF'))
  }
}
/** Groot, dancing along the bottom of the moment. Empty cells only. */
function groot(cv: Canvas, t: number) {
  const row = Math.max(0, cv.rows - 2), art = Math.floor(t * 4) % 2 ? '/(^o^)\\' : '\\(^o^)/'
  const x = Math.floor(((t % 4.4) / 4.4) * (cv.w + 4)) - 4
  for (let i = 0; i < art.length; i++) {
    const c = x + i
    if (c >= 0 && c < cv.w && cv.glyph[row * cv.w + c] === 0) cv.text(c, row, art[i]!, rgb('#A8EC70'))
  }
  const n = x + art.length + 1
  if (n >= 0 && n < cv.w - 1 && cv.glyph[row * cv.w + n] === 0) cv.text(n, row, Math.floor(t * 3) % 2 ? '♪' : '♫', rgb('#A8EC70'))
}
/** The flair of a moment, over its finished frame. */
export function applyFlair(cv: Canvas, f: Flair | undefined, t: number) {
  if (!f) return
  if (f === 'halloween') tint(cv, PUMPKIN, 0.32)
  else if (f === 'newyear') fireworks(cv, t)
  else if (f === 'groot') groot(cv, t)
}
