// Contact sheet of hand-drawn movie sprites, at the theater's true pixel shape.
//   bun scripts/msprite-png.ts <out.png> [ID,ID,...]
// One row per character, its 11 poses left to right, over the movie floor colour,
// with a small (far-plane, half size) copy at the end of the row.
import { deflateSync } from 'node:zlib'
import { MSPRITES } from '../hooks/msprites'
import { POSE_ORDER } from '../hooks/msprites/sheet'

const out = process.argv[2] ?? '/tmp/msprites.png'
const only = process.argv[3]?.split(',')
const ids = Object.keys(MSPRITES).filter(k => !only || only.includes(k))
const PW = 8, PH = 10 // one logical pixel: 2 subpixels across (4.2 px each), 1 down (10.15 px)
const BG = [0x2a, 0x2a, 0x3a], GAP = 12
const sheets = ids.map(id => {
  const F = MSPRITES[id]!, b = Buffer.from(F.data, 'base64')
  return { id, F, b }
})
const cellW = Math.max(1, ...sheets.map(s => s.F.w)) * PW + GAP, cellH = Math.max(1, ...sheets.map(s => s.F.h)) * PH + GAP
const W = cellW * (POSE_ORDER.length + 1), H = Math.max(1, sheets.length) * cellH
const img = new Uint8Array(W * H * 3)
for (let i = 0; i < W * H; i++) img.set(BG, i * 3)
const put = (x: number, y: number, c: number) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; img[i] = c >> 16; img[i + 1] = (c >> 8) & 255; img[i + 2] = c & 255 }
sheets.forEach(({ F, b }, row) => {
  const draw = (n: number, ox: number, oy: number, s: number) => {
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
      const k = b[n * F.w * F.h + y * F.w + x]
      if (!k) continue
      const c = F.pal[k - 1]!
      for (let j = 0; j < PH * s; j++) for (let i = 0; i < PW * s; i++) put(ox + Math.floor(x * PW * s) + i, oy + Math.floor(y * PH * s) + j, c)
    }
  }
  for (let n = 0; n < F.n; n++) draw(n, n * cellW + GAP / 2, row * cellH + GAP / 2 + (cellH - GAP - F.h * PH), 1)
  draw(0, POSE_ORDER.length * cellW + GAP / 2, row * cellH + GAP / 2 + (cellH - GAP - F.h * PH / 2), 0.5)
})
// PNG
const crc = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return (buf: Uint8Array) => { let c = 0xffffffff; for (const v of buf) c = t[(c ^ v) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 } })()
const chunk = (type: string, data: Uint8Array) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); Buffer.from(data).copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + data.length)), 8 + data.length); return b }
const raw = Buffer.alloc((W * 3 + 1) * H)
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.subarray(y * W * 3, (y + 1) * W * 3)).copy(raw, y * (W * 3 + 1) + 1) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2
await Bun.write(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]))
console.log(out, ids.join(' '))
