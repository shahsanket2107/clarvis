// The pixel-art format the artists' files share (no imports of theirs: no cycle).
import { CLEAR, type Canvas, type HiSprite } from '../pixel'

// The stage box is STAGE (18) cells x STAGE_ROWS (7) rows = 36 x 14 subpixels.
// The lane is the band's full width x LANE_ROWS (6) rows = 12 subpixels tall, from y0 (height = cv.h - y0).
export type StageArt = (cv: Canvas, t: number, calm: boolean) => void
export type LaneArt = (cv: Canvas, y0: number, t: number, calm: boolean) => void

// rows: one string per subpixel row, one char per subpixel; '.' or ' ' is clear.
// pal: char -> 0xRRGGBB. All rows the same length.
export function pixmap(rows: readonly string[], pal: Readonly<Record<string, number>>): HiSprite {
  const h = rows.length, w = Math.max(0, ...rows.map(r => r.length)), n = w * h
  const px = new Int32Array(n).fill(CLEAR), a = new Uint8Array(n)
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]!]; if (c !== undefined) { px[y * w + x] = c; a[y * w + x] = 255 } } })
  return { w, h, px, a }
}

