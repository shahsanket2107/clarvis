// Hand-drawn full-body movie sprites: the format the artists' files share.
// A sheet is the same shape as an arcade fighter sheet (arcade-fighters.ts), so
// the theater draws it exactly like one, with no tint and no pasted head.
//
// Each frame is rows of palette letters, one char per logical pixel ('.' or ' '
// is clear). The theater doubles x when drawing (a subpixel is ~2.4x taller than
// wide), so author at true proportions: about 14-20 px wide x 30-34 px tall for
// a normal hero, with feet on the bottom row.
import type { Fighter } from '../arcade-fighters'

export type Pose = 'idle0' | 'idle1' | 'walk0' | 'walk1' | 'punch' | 'special' | 'block' | 'hurt' | 'jump' | 'super' | 'ko'
export const POSE_ORDER: readonly Pose[] = ['idle0', 'idle1', 'walk0', 'walk1', 'punch', 'special', 'block', 'hurt', 'jump', 'super', 'ko']
// a pose an artist leaves out borrows one that is drawn
const FALLBACK: Partial<Record<Pose, Pose>> = { idle1: 'idle0', block: 'idle0', jump: 'walk0', super: 'special', special: 'punch' }

export type SheetSpec = {
  pal: Readonly<Record<string, number>> // letter -> 0xRRGGBB
  frames: Partial<Record<Pose, readonly string[]>> // required: idle0, walk0, walk1, punch, hurt, ko
  hand?: Partial<Record<Pose, [number, number]>> // the front hand (x, y) per pose, for beams and blows
}

// One registry the theater reads: CharId -> sheet.
export const MSPRITES: Record<string, Fighter> = {}

export function sheet(spec: SheetSpec): Fighter {
  const need: Pose[] = ['idle0', 'walk0', 'walk1', 'punch', 'hurt', 'ko']
  for (const p of need) if (!spec.frames[p]) throw new Error(`movie sprite: missing ${p}`)
  const get = (p: Pose): readonly string[] => { let q: Pose | undefined = p; while (q && !spec.frames[q]) q = FALLBACK[q]; return spec.frames[q ?? 'idle0'] ?? spec.frames.idle0! }
  const all = POSE_ORDER.map(get)
  const w = Math.max(...all.flatMap(f => f.map(r => r.length))), h = Math.max(...all.map(f => f.length))
  const letters = Object.keys(spec.pal), pal = letters.map(k => spec.pal[k]!)
  const bytes = new Uint8Array(w * h * POSE_ORDER.length)
  all.forEach((f, n) => {
    const top = h - f.length // bottom-align: feet on the last row
    f.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const i = letters.indexOf(r[x]!); if (i >= 0) bytes[n * w * h + (top + y) * w + x] = i + 1 } })
  })
  // the feet's centre: the middle of the opaque pixels on idle0's bottom row
  const last = all[0]![all[0]!.length - 1]!, xs = [...last].map((c, i) => (letters.includes(c) ? i : -1)).filter(i => i >= 0)
  const ax = xs.length ? Math.round((xs[0]! + xs[xs.length - 1]!) / 2) : w >> 1
  const hand = POSE_ORDER.flatMap(p => spec.hand?.[p] ?? spec.hand?.[FALLBACK[p] ?? 'idle0'] ?? [Math.round(w * 0.8), Math.round(h * 0.4)])
  return { w, h, n: POSE_ORDER.length, ax, ay: h - 1, hand, pal, data: b64(bytes) }
}

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function b64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
    s += A[(n >> 18) & 63]! + A[(n >> 12) & 63]! + (i + 1 < b.length ? A[(n >> 6) & 63]! : '=') + (i + 2 < b.length ? A[n & 63]! : '=')
  }
  return s
}
