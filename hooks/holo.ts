// clarvis: a tiny ray marcher. Each hero prop is a signed distance field
// (spheres, boxes, tori, cylinders) with materials painted by position, lit
// toon style (three cel bands, a hard specular, a rim light) and inked at the
// silhouette, the look of a cel-shaded sticker, but in 3D and turning.
// Frames are rendered once, lazily, into a ring of HiSprites (one per angle)
// and replayed after: animating costs a sprite copy, never a ray march.
import { CLEAR, add, lerp, rgb, type HiSprite } from './pixel'

type V = [number, number, number]
// What a model returns at a point: distance, and material id.
export type Hit = { d: number; m: number }
export type Model = {
  sdf: (x: number, y: number, z: number, out: Hit) => void
  // colour of material `m` at the (object-space) point, toon tones: [hi, base, shade]
  paint: (m: number, x: number, y: number, z: number) => [number, number, number] | number
  emissive?: (m: number) => boolean
  extent: number // the model fits in [-extent, extent] on every axis
  toon?: [number, number] // light above which a surface takes its highlight, below which its shadow
  glow?: number // how far emissive light bleeds (default 0.12)
  rim?: boolean // the cool arc-light rim from the right (default on)
  ink?: number
}

// ── distance functions ──────────────────────────────────────────────────────
export const sphere = (x: number, y: number, z: number, r: number) => Math.hypot(x, y, z) - r
export function box(x: number, y: number, z: number, bx: number, by: number, bz: number, r = 0) {
  const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r
}
export const torus = (x: number, y: number, z: number, R: number, r: number) => Math.hypot(Math.hypot(x, z) - R, y) - r
export function cylinder(x: number, y: number, z: number, r: number, h: number) { // axis y
  const dx = Math.hypot(x, z) - r, dy = Math.abs(y) - h
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
}
export const ellipsoid = (x: number, y: number, z: number, a: number, b: number, c: number) => {
  const k0 = Math.hypot(x / a, y / b, z / c), k1 = Math.hypot(x / (a * a), y / (b * b), z / (c * c))
  return k1 === 0 ? -Math.min(a, b, c) : (k0 * (k0 - 1)) / k1
}
export const smin = (a: number, b: number, k: number) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25 }

// ── the renderer ────────────────────────────────────────────────────────────
// Physical shape of one subpixel (width / height): half a cell across, half
// a cell down, a cell being 8.4 × 20.3 in a Ghostty.
export const SUB_ASPECT = 4.2 / 10.15
const L = norm([-0.55, 0.65, 0.75]) // key light: upper left, in front
const H = norm([L[0], L[1], L[2] + 1])
function norm(v: V): V { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n] }

export type View = { yaw: number; pitch: number; roll?: number; holo?: number }
// Renders `model` into a sprite of `cols` × `rows` cells (2 × 2 subpixels
// each), the model's extent filling the height.
export function render(model: Model, cols: number, rows: number, v: View): HiSprite {
  const W = cols * 2, Hh = rows * 2, n = W * Hh
  const px = new Int32Array(n).fill(CLEAR), al = new Uint8Array(n), mat = new Int16Array(n).fill(-1), depth = new Float32Array(n)
  const ext = model.extent, scaleY = (2 * ext) / Hh, scaleX = scaleY * SUB_ASPECT
  const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), cp = Math.cos(v.pitch), sp = Math.sin(v.pitch), cr = Math.cos(v.roll ?? 0), sr = Math.sin(v.roll ?? 0)
  // world → object: undo roll (z), pitch (x), yaw (y)
  const toObj = (x: number, y: number, z: number, o: V) => {
    let X = x * cr + y * sr, Y = -x * sr + y * cr, Z = z
    const Y2 = Y * cp + Z * sp, Z2 = -Y * sp + Z * cp
    Y = Y2; Z = Z2
    o[0] = X * cy - Z * sy; o[1] = Y; o[2] = X * sy + Z * cy
  }
  const toWorldN = (o: V): V => { // object normal → world (yaw, pitch, roll forward)
    let x = o[0] * cy + o[2] * sy, z = -o[0] * sy + o[2] * cy, y = o[1]
    const y2 = y * cp - z * sp, z2 = y * sp + z * cp
    y = y2; z = z2
    return [x * cr - y * sr, x * sr + y * cr, z]
  }
  const hit: Hit = { d: 0, m: 0 }, p: V = [0, 0, 0]
  const S = 2 // supersamples per axis
  const f = (x: number, y: number, z: number) => { toObj(x, y, z, p); model.sdf(p[0], p[1], p[2], hit); return hit.d }
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    let r = 0, g = 0, b = 0, cover = 0, mBest = -1, zBest = -9
    for (let sj = 0; sj < S; sj++) for (let si = 0; si < S; si++) {
      const x = (i + (si + 0.5) / S - W / 2) * scaleX, y = (Hh / 2 - j - (sj + 0.5) / S) * scaleY
      // march from the front (z = +ext·1.5) toward −z
      let z = ext * 1.6, hitAt = NaN
      for (let k = 0; k < 64; k++) {
        const d = f(x, y, z)
        if (d < 0.002) { hitAt = z; break }
        z -= Math.max(d, 0.004)
        if (z < -ext * 1.6) break
      }
      if (Number.isNaN(hitAt)) continue
      f(x, y, hitAt); const m = hit.m
      toObj(x, y, hitAt, p); const ox = p[0], oy = p[1], oz = p[2]
      const e = 0.003
      const nx = f(x + e, y, hitAt) - f(x - e, y, hitAt), ny = f(x, y + e, hitAt) - f(x, y - e, hitAt), nz = f(x, y, hitAt + e) - f(x, y, hitAt - e)
      const N = norm([nx, ny, nz])
      const tones = model.paint(m, ox, oy, oz)
      let c: number
      if (typeof tones === 'number' || model.emissive?.(m)) c = typeof tones === 'number' ? tones : tones[0]
      else {
        const dl = N[0] * L[0] + N[1] * L[1] + N[2] * L[2]
        const spec = N[0] * H[0] + N[1] * H[1] + N[2] * H[2]
        const [hiAt, loAt] = model.toon ?? [0.62, 0.12]
        c = dl > hiAt ? tones[0] : dl > loAt ? tones[1] : tones[2]
        if (spec > 0.975) c = lerp(c, 0xffffff, 0.75)
        const rim = 1 - Math.abs(N[2])
        if (model.rim !== false && rim > 0.82 && N[0] > 0.2) c = lerp(c, 0x7fe9ff, 0.35) // a cool rim from the right, arc-light
      }
      r += (c >> 16) & 255; g += (c >> 8) & 255; b += c & 255; cover++
      if (hitAt > zBest) { zBest = hitAt; mBest = m }
    }
    if (!cover) continue
    const idx = j * W + i
    px[idx] = ((r / cover) << 16) | ((g / cover) << 8) | (b / cover)
    al[idx] = Math.round((cover / (S * S)) * 255)
    mat[idx] = mBest; depth[idx] = zBest
  }
  // ink: the silhouette and creases between materials at a depth step
  const ink = model.ink ?? 0x140709
  const out = new Int32Array(px)
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const idx = j * W + i
    if (px[idx] === CLEAR) continue
    let edge = false
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const xx = i + dx, yy = j + dy
      if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) { edge = true; break }
      const o = yy * W + xx
      if (px[o] === CLEAR || al[o]! < 110) { edge = true; break }
      if (Math.abs(depth[o]! - depth[idx]!) > 0.18 * ext) { edge = true; break }
    }
    if (edge && !(model.emissive?.(mat[idx]!))) out[idx] = lerp(px[idx]!, ink, 0.82)
  }
  // emissive glow: light bleeds onto neighbours and out into the clear
  if (model.emissive) {
    const glow = new Float32Array(n * 3)
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const idx = j * W + i
      if (mat[idx]! < 0 || !model.emissive(mat[idx]!)) continue
      const c = px[idx]!
      for (let dy = -2; dy <= 2; dy++) for (let dx = -4; dx <= 4; dx++) {
        const xx = i + dx, yy = j + dy
        if (xx < 0 || yy < 0 || xx >= W || yy >= Hh) continue
        const d = Math.hypot(dx * SUB_ASPECT, dy), w = Math.max(0, 1 - d / 2.2) * (model.glow ?? 0.12)
        if (!w) continue
        const o = (yy * W + xx) * 3
        glow[o] = glow[o]! + ((c >> 16) & 255) * w; glow[o + 1] = glow[o + 1]! + ((c >> 8) & 255) * w; glow[o + 2] = glow[o + 2]! + (c & 255) * w
      }
    }
    for (let idx = 0; idx < n; idx++) {
      const gr = glow[idx * 3]!, gg = glow[idx * 3 + 1]!, gb = glow[idx * 3 + 2]!
      if (gr + gg + gb < 20) continue
      const k = Math.min(1, (gr + gg + gb) / 500)
      const gc = (Math.min(255, gr) << 16) | (Math.min(255, gg) << 8) | Math.min(255, gb)
      if (out[idx] === CLEAR || al[idx]! < 40) { out[idx] = add(0x1b1b29, gc, 1); al[idx] = Math.max(al[idx]!, Math.round(255 * Math.min(1, k * 1.3))) }
      else out[idx] = add(out[idx]!, gc, 0.6)
    }
  }
  return { w: W, h: Hh, px: out, a: al }
}

// A ring of pre-rendered turns of one model at one size, rendered on first use.
export class Turntable {
  private frames: (HiSprite | undefined)[]
  constructor(private model: Model, readonly cols: number, readonly rows: number, readonly count: number, private view: (k: number) => View) {
    this.frames = new Array(count)
  }
  // frame for angle fraction t (0..1, wraps)
  at(t: number): HiSprite {
    const k = ((Math.floor(t * this.count) % this.count) + this.count) % this.count
    return (this.frames[k] ??= render(this.model, this.cols, this.rows, this.view(k / this.count)))
  }
  // renders every frame now (the gallery; a warm start)
  warm() { for (let k = 0; k < this.count; k++) this.at(k / this.count) ; return this }
}

// ── the props ───────────────────────────────────────────────────────────────
const T = (hi: string, base: string, shade: string): [number, number, number] => [rgb(hi), rgb(base), rgb(shade)]
const RED = T('#F2453A', '#C81A24', '#760B13'), GOLD = T('#FFE58F', '#F4B536', '#B37614')
const STEEL = T('#EEF2FA', '#A5AFC2', '#5D6678'), GUNMETAL = T('#9AA6BC', '#5A6478', '#2E3442'), LEATHER = T('#C08A58', '#8B5A2E', '#4E2E14')
const CAPRED = T('#FF6B6B', '#D3222E', '#8A0F18'), CAPWHITE = T('#FFFFFF', '#E3E8F2', '#9AA4B8'), CAPBLUE = T('#5C8BFF', '#1F4BC0', '#0E2466')
const EYE = rgb('#BFF8FF'), CORE = rgb('#E8FDFF')

// Iron Man's helmet: a rounded head, a jaw, the gold faceplate painted on the
// front, slit eyes that glow, a mouth line, cheek seams.
export const HELMET: Model = {
  extent: 1.05,
  toon: [0.72, 0.14],
  rim: false,
  sdf(x, y, z, o) {
    const head = ellipsoid(x, y - 0.08, z, 0.82, 0.92, 0.86)
    const jaw = box(x, y + 0.5, z - 0.12, 0.5, 0.32, 0.55, 0.22)
    o.d = smin(head, jaw, 0.25); o.m = 0
    const ax = Math.abs(x)
    // the faceplate: the front below the brow, its sides angling in to the chin
    const half = y > -0.05 ? 0.56 : 0.56 - (-0.05 - y) * 0.55
    const top = 0.4 - ax * 0.12
    if (z > 0.2 && y < top && ax < half) {
      o.m = 1
      const ey = 0.07 + ax * 0.13 // the eyes rise to the outside
      if (ax > 0.13 && ax < 0.47 && Math.abs(y - ey) < 0.05 - (ax - 0.13) * 0.04) o.m = 2
      else if (Math.abs(y + 0.48) < 0.028 && ax < 0.24) o.m = 3
      else if (half - ax < 0.045 || top - y < 0.04) o.m = 3 // the seam round the plate
    }
  },
  paint: m => (m === 0 ? RED : m === 1 ? GOLD : m === 2 ? rgb('#E9FDFF') : rgb('#2A0E06')),
  emissive: m => m === 2,
}

// Mjölnir: a bevelled head, a leather-wrapped handle, a steel pommel.
export const HAMMER: Model = {
  extent: 1.1,
  sdf(x, y, z, o) {
    const head = box(x, y - 0.55, z, 0.78, 0.36, 0.42, 0.1)
    const handle = cylinder(x, y + 0.3, z, 0.11, 0.55)
    const pommel = cylinder(x, y + 0.9, z, 0.15, 0.08)
    o.d = Math.min(head, handle, pommel)
    o.m = o.d === head ? 0 : o.d === handle ? 1 : 2
    if (o.m === 0 && Math.abs(Math.abs(z) - 0.42) < 0.03 && Math.abs(x) < 0.45 && Math.abs(Math.sin(x * 9) * 0.12 - (y - 0.55)) < 0.03) o.m = 3 // the knot
  },
  paint: (m, x, y) => (m === 0 || m === 2 ? STEEL : m === 3 ? T('#7A8497', '#5D6678', '#3A4250') : Math.sin((y + x * 0.5) * 30) > 0.3 ? LEATHER : T('#8B5A2E', '#5C3618', '#3A220E')),
}

// Captain America's shield: a shallow dish, red, white, red, blue, a star.
function inStar(x: number, y: number, r: number) {
  const ang = Math.atan2(x, y), d = Math.hypot(x, y)
  const k = (((ang / (Math.PI * 2)) * 5) % 1 + 1) % 1
  return d < r * (0.4 + 0.6 * Math.abs(1 - 2 * k) ** 1.5)
}
export const SHIELD: Model = {
  extent: 1.0,
  toon: [0.9, 0.4],
  sdf(x, y, z, o) {
    const r = Math.hypot(x, y)
    // a dish: thin, its face bowed toward the viewer
    o.d = Math.max(r - 0.98, Math.abs(z - (0.12 - r * r * 0.12)) - 0.06)
    o.m = r > 0.78 ? 0 : r > 0.58 ? 1 : r > 0.4 ? 0 : inStar(x, y, 0.37) && z > 0 ? 3 : 2
    if (z < 0 && r < 0.92) o.m = 4
  },
  paint: m => (m === 0 ? CAPRED : m === 1 ? CAPWHITE : m === 2 ? CAPBLUE : m === 3 ? CAPWHITE : T('#B0B8C8', '#8A93A6', '#5D6678')),
}

// The arc reactor, Mark VI: a steel housing, ten coil blocks with dark gaps
// between them, a dark inner ring, and the glowing triangle core.
const inTri = (x: number, y: number, r: number) => { // an upright equilateral triangle
  const k = Math.sqrt(3)
  return y > -r * 0.5 && k * x + y < r && -k * x + y < r
}
export const REACTOR: Model = {
  extent: 1.0,
  glow: 0.07,
  rim: false,
  toon: [0.7, 0.2],
  sdf(x, y, z, o) {
    const r = Math.hypot(x, y)
    const housing = torus(x, z, y, 0.84, 0.13)
    const plate = cylinder(x, z + 0.06, y, 0.9, 0.05)
    const ang = Math.atan2(y, x), seg = ((ang / (Math.PI * 2)) * 10 % 1 + 1) % 1
    const coils = seg > 0.14 && seg < 0.86 ? box(r - 0.6, y * 0, z - 0.04, 0.11, 9, 0.08) : 9 // radial blocks
    const core = cylinder(x, z - 0.06, y, 0.36, 0.06)
    o.d = Math.min(housing, plate, coils, core)
    o.m = o.d === housing ? 0 : o.d === coils ? 1 : o.d === core ? (inTri(x, -y, 0.3) ? 2 : 4) : 3
  },
  paint: m => (m === 0 ? GUNMETAL : m === 1 ? rgb('#29C8FF') : m === 2 ? rgb('#F2FEFF') : m === 4 ? T('#2A3140', '#1A1F2A', '#10131A') : T('#3E4554', '#2A303C', '#1A1E26')),
  emissive: m => m === 1 || m === 2,
}

// The six Infinity Stones, gems turning in a ring.
const GEMS = ['#3B82F6', '#FACC15', '#EF4444', '#A855F7', '#22C55E', '#F97316'].map(c => rgb(c))
export const STONES: Model = {
  extent: 1.05,
  sdf(x, y, z, o) {
    let best = 9, m = 0
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, gx = Math.cos(a) * 0.66, gy = Math.sin(a) * 0.66
      // an octahedron-ish gem
      const d = (Math.abs(x - gx) + Math.abs(y - gy) * 0.9 + Math.abs(z) * 1.3) * 0.62 - 0.2
      if (d < best) { best = d; m = i }
    }
    o.d = best; o.m = m
  },
  paint: m => [lerp(GEMS[m]!, 0xffffff, 0.55), GEMS[m]!, lerp(GEMS[m]!, 0, 0.5)],
  emissive: () => false,
}

// The JARVIS globe: a wire sphere (latitude and longitude lines).
export const GLOBE: Model = {
  extent: 1.0,
  sdf(x, y, z, o) {
    const r = Math.hypot(x, y, z)
    const shell = Math.abs(r - 0.9) - 0.025
    const lat = Math.asin(Math.max(-1, Math.min(1, y / Math.max(r, 1e-6)))), lon = Math.atan2(z, x)
    const onLat = Math.abs(((lat / (Math.PI / 8)) % 1 + 1) % 1 - 0.5) > 0.42
    const onLon = Math.abs(((lon / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.44
    o.d = onLat || onLon ? shell : Math.max(shell, 0.03); o.m = 0
  },
  paint: () => rgb('#5FE1FF'),
  emissive: () => true,
}
