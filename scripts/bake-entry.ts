// Runs in headless Chrome: rasterises every piece of art at the size the
// terminal draws it, box-downsamples to subpixels (2 per cell across, 2 per
// cell down), and writes the RGBA into the page for scripts/bake.ts.
import * as A from './art'

const SX = 6, SY = 14 // hi-res pixels per subpixel: the cell's 8.4 × 20.3 shape
type Bake = { name: string; rows: number; art?: A.Art; word?: A.Word }
const BAKES: Bake[] = [
  { name: 'helmetIdle', rows: 5, art: A.helmet }, { name: 'helmetIdleEyes', rows: 5, art: A.helmetEyes },
  { name: 'helmetHud', rows: 8, art: A.helmet }, { name: 'helmetHudEyes', rows: 8, art: A.helmetEyes },
  { name: 'helmetIcon', rows: 4, art: A.helmet }, { name: 'helmetIconEyes', rows: 4, art: A.helmetEyes },
  { name: 'ironman', rows: 11, art: A.ironman }, { name: 'ironmanFire', rows: 11, art: A.ironmanFire },
  { name: 'hulkFist', rows: 9, art: A.hulkFist }, { name: 'fistStage', rows: 6, art: A.hulkFist }, { name: 'spideyStage', rows: 5, art: A.spidey }, { name: 'fistIcon', rows: 4, art: A.hulkFist },
  { name: 'mjolnir', rows: 10, art: A.mjolnir }, { name: 'mjolnirIcon', rows: 4, art: A.mjolnir },
  ...[1, 0.72, 0.45, 0.2, 0.06].map((sx, i) => ({ name: `shield${i}`, rows: 10, art: A.shieldArt(sx) })),
  ...[1, 0.5, 0.12].map((sx, i) => ({ name: `shieldIcon${i}`, rows: 4, art: A.shieldArt(sx) })),
  { name: 'spidey', rows: 7, art: A.spidey }, { name: 'spideyIcon', rows: 4, art: A.spidey },
  { name: 'gauntlet', rows: 11, art: A.gauntlet },
  { name: 'laneHelmet', rows: 3, art: A.helmet }, { name: 'laneIronman', rows: 4, art: A.ironmanFire }, { name: 'laneSpidey', rows: 3, art: A.spidey }, { name: 'laneShield', rows: 3, art: A.shieldArt(1) },
  { name: 'laneHammer', rows: 3, art: A.mjolnir }, { name: 'laneFist', rows: 3, art: A.hulkFist }, { name: 'laneDeadpool', rows: 3, art: A.deadpool }, { name: 'laneWolverine', rows: 3, art: A.wolverine },
  { name: 'laneAntman', rows: 3, art: A.antman }, { name: 'laneWidow', rows: 3, art: A.widow },
  { name: 'lanePanther', rows: 3, art: A.panther }, { name: 'laneVision', rows: 3, art: A.vision }, { name: 'laneLoki', rows: 3, art: A.loki }, { name: 'laneUltron', rows: 3, art: A.ultron },
  { name: 'ultronIcon', rows: 4, art: A.ultron }, { name: 'ultronStage', rows: 7, art: A.ultron },
  { name: 'deadpool', rows: 6, art: A.deadpool }, { name: 'wolverine', rows: 6, art: A.wolverine }, { name: 'antman', rows: 7, art: A.antman }, { name: 'witchCrown', rows: 3, art: A.witch },
  { name: 'fury', rows: 6, art: A.fury },
  { name: 'logo', rows: 10, art: A.logo }, { name: 'logoStage', rows: 7, art: A.logo }, { name: 'furyStage', rows: 7, art: A.fury },
  { name: 'widowIcon', rows: 4, art: A.widow },
  { name: 'pantherIcon', rows: 4, art: A.panther }, { name: 'visionIcon', rows: 4, art: A.vision }, { name: 'lokiIcon', rows: 4, art: A.loki },
  { name: 'pantherStage', rows: 7, art: A.panther }, { name: 'visionStage', rows: 7, art: A.vision }, { name: 'lokiStage', rows: 7, art: A.loki },
  { name: 'laneStarlord', rows: 4, art: A.starlord }, { name: 'starlordStage', rows: 6, art: A.starlord },
  { name: 'laneGamora', rows: 4, art: A.gamora }, { name: 'gamoraStage', rows: 6, art: A.gamora },
  { name: 'laneDrax', rows: 4, art: A.drax }, { name: 'draxStage', rows: 6, art: A.drax },
  { name: 'laneRocket', rows: 4, art: A.rocket }, { name: 'rocketStage', rows: 6, art: A.rocketFace },
  { name: 'laneGroot', rows: 4, art: A.groot }, { name: 'grootStage', rows: 6, art: A.groot },
  { name: 'laneMantis', rows: 4, art: A.mantis }, { name: 'mantisStage', rows: 6, art: A.mantis },
  { name: 'laneNebula', rows: 4, art: A.nebula }, { name: 'nebulaStage', rows: 6, art: A.nebula },
  { name: 'laneYondu', rows: 4, art: A.yondu }, { name: 'yonduStage', rows: 6, art: A.yonduFace },
  { name: 'arrow', rows: 2, art: A.arrow },
  { name: 'wordAssembleLine', rows: 4, word: A.WORDS.assembleLine },
  { name: 'wordAssemble', rows: 5, word: A.WORDS.assemble }, { name: 'wordSmash', rows: 5, word: A.WORDS.smash },
  { name: 'wordBullseye', rows: 4, word: A.WORDS.bullseye }, { name: 'wordLane', rows: 4, word: A.WORDS.assembleLine },
]

function wordArt(w: A.Word): A.Art {
  // measure the text, then frame it
  const ns = 'http://www.w3.org/2000/svg'
  const probe = document.createElementNS(ns, 'svg'); document.body.appendChild(probe)
  const t = document.createElementNS(ns, 'text')
  t.setAttribute('font-family', 'Impact, "Arial Black", sans-serif'); t.setAttribute('font-size', '100'); t.setAttribute('letter-spacing', '3')
  t.textContent = w.text; probe.appendChild(t)
  const b = t.getBBox(); probe.remove()
  const pad = 10, vw = Math.ceil(b.width + pad * 2), top = 14, vh = 100 // cap height of Impact ≈ 0.79em
  return { vb: [vw, vh], svg: k => `<svg xmlns="${ns}" viewBox="0 0 ${vw} ${vh}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.12" stop-color="${w.top}"/><stop offset="0.5" stop-color="${w.mid}"/><stop offset="0.92" stop-color="${w.bot}"/></linearGradient></defs>
    <text x="${pad - b.x}" y="${top + 79}" font-family='Impact, "Arial Black", sans-serif' font-size="100" letter-spacing="3" fill="url(#g)" stroke="${w.ink}" stroke-width="${12 * k}" paint-order="stroke" stroke-linejoin="round">${w.text}</text></svg>` }
}

async function bake(b: Bake) {
  const art = b.art ?? wordArt(b.word!)
  const subH = b.rows * 2
  const subW = Math.max(1, Math.round((subH * SY * art.vb[0]) / art.vb[1] / SX))
  const unitsPerPx = art.vb[1] / subH
  const k = Math.max(1, (0.9 * unitsPerPx) / 5)
  const src = art.svg(k)
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src)
  await img.decode()
  const cv = document.createElement('canvas'); cv.width = subW * SX; cv.height = subH * SY
  const ctx = cv.getContext('2d')!
  ctx.drawImage(img, 0, 0, cv.width, cv.height)
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data
  const out = new Uint8Array(subW * subH * 4)
  // Each subpixel takes the colour that covers most of it (a mode filter, the
  // pixel artist's downscale: flat fills stay flat, outlines stay dark) and
  // its coverage as alpha (the silhouette stays anti-aliased).
  const bucket = new Map<number, [number, number, number, number]>()
  for (let y = 0; y < subH; y++) for (let x = 0; x < subW; x++) {
    bucket.clear()
    let a = 0
    for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) {
      const o = ((y * SY + j) * cv.width + x * SX + i) * 4, al = d[o + 3]! / 255
      if (al < 0.02) continue
      a += al
      const key = ((d[o]! >> 4) << 8) | ((d[o + 1]! >> 4) << 4) | (d[o + 2]! >> 4)
      const e = bucket.get(key) ?? [0, 0, 0, 0]
      e[0] += d[o]! * al; e[1] += d[o + 1]! * al; e[2] += d[o + 2]! * al; e[3] += al
      bucket.set(key, e)
    }
    const o = (y * subW + x) * 4
    let best: [number, number, number, number] | undefined
    for (const e of bucket.values()) if (!best || e[3] > best[3]) best = e
    if (best) { out[o] = Math.round(best[0] / best[3]); out[o + 1] = Math.round(best[1] / best[3]); out[o + 2] = Math.round(best[2] / best[3]) }
    out[o + 3] = Math.round(Math.min(1, (a / (SX * SY)) * 1.15) * 255)
  }
  let bin = ''; for (const v of out) bin += String.fromCharCode(v)
  return { name: b.name, w: subW, h: subH, rgba: btoa(bin) }
}
// anchor points the scenes need, in subpixels of their bake
const anchors = { gauntletStones: A.STONE_XY }
;(async () => {
  await document.fonts.ready
  const all = []
  for (const b of BAKES) all.push(await bake(b))
  const pre = document.createElement('pre'); pre.id = 'out'
  pre.textContent = JSON.stringify({ sprites: all, anchors, gauntletVb: A.gauntlet.vb })
  document.body.appendChild(pre)
})()
