// Launch media pipeline: exact frames at fixed times from the mod's own art code (no real-time capture).
//   bun scripts/gallery.ts && bun scripts/record.ts [all|frames|stills|gif|mp4|theater|text|social]
// Needs bun, ffmpeg and headless Chrome (CHROME, FFMPEG env override; MEDIA_TMP = scratch dir for the frame cache).
// Chrome paints ?frames=<clip> pages of demo/gallery.html (bare, no labels), ffmpeg splits, pads and encodes.
import { mkdirSync, existsSync, rmSync, symlinkSync, writeFileSync, readdirSync, statSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { MOMENT_ROWS, WORK_ROWS, IDLE_ROWS } from '../hooks/scenes'
import { captionPage, socialPage, terminalPage, sampleStats, sampleCard, sampleTrophies } from './media/html'

const ROOT = new URL('..', import.meta.url).pathname
const OUT = ROOT + 'docs/media/'
const TMP = process.env.MEDIA_TMP ?? join(tmpdir(), 'clarvis-media')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FFMPEG = process.env.FFMPEG ?? (existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg')
const GAL = ROOT + 'demo/gallery.html'
const FONT = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
const COLS = 140, CW = 10, CH = 24, FPS = 30, W = (COLS + 5) * CW // 1450 px wide
const BGHEX = '0x1B1B29'
const rowsOf: Record<string, number> = { idle: IDLE_ROWS, boot: MOMENT_ROWS.boot, assemble: MOMENT_ROWS.assemble, snap: MOMENT_ROWS.snap, fury: MOMENT_ROWS.fury }
const rows = (id: string) => (id.startsWith('work-') ? WORK_ROWS : rowsOf[id]!)
const fh = (id: string) => (rows(id) + 5) * CH
const HMAX = (WORK_ROWS + 5) * CH
const SECONDS: Record<string, number> = { boot: 2.6, assemble: 4.4, snap: 3.6, fury: 3 }
const secs = (id: string) => SECONDS[id] ?? 6

async function run(cmd: string[], quiet = true) {
  const p = Bun.spawn(cmd, { stdin: 'ignore', stdout: quiet ? 'ignore' : 'inherit', stderr: quiet ? 'pipe' : 'inherit' })
  const code = await p.exited
  if (code !== 0) throw new Error(`${cmd[0]} failed (${code}): ${cmd.slice(1).join(' ').slice(0, 300)}\n${p.stderr ? await new Response(p.stderr).text() : ''}`)
}
const ff = (...a: string[]) => run([FFMPEG, '-nostdin', '-hide_banner', '-loglevel', 'error', '-y', ...a])
let uid = 0
async function shot(url: string, w: number, h: number, out: string, extra: string[] = []) {
  for (let attempt = 1; ; attempt++) try { return await shot1(url, w, h, out, extra) } catch (e) { if (attempt >= 3) throw e; console.log('retry', attempt) }
}
async function shot1(url: string, w: number, h: number, out: string, extra: string[]) {
  // a headless Chrome with its own profile writes the PNG but then idles instead of exiting: wait for the file to settle, then kill it
  const prof = join(TMP, 'prof', String(process.pid) + '-' + uid++)
  mkdirSync(prof, { recursive: true }); rmSync(out, { force: true })
  const p = Bun.spawn([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--no-first-run', `--user-data-dir=${prof}`, '--virtual-time-budget=9000', `--window-size=${w},${h}`, ...extra, `--screenshot=${out}`, url], { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
  let done = false; void p.exited.then(() => { done = true })
  let last = -1
  for (let i = 0; i < 600 && !done; i++) {
    await Bun.sleep(100)
    const sz = existsSync(out) ? statSync(out).size : -1
    if (sz > 0 && sz === last) break
    last = sz
  }
  p.kill(); await p.exited
  rmSync(prof, { recursive: true, force: true })
  if (!existsSync(out) || statSync(out).size === 0) throw new Error('chrome produced no screenshot for ' + url.slice(0, 200))
}
async function pool<T>(items: T[], n: number, f: (x: T) => Promise<void>) { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { for (let x = q.shift(); x !== undefined; x = q.shift()) await f(x) })) }

// ── frames: every clip at 30 fps into TMP/f/<clip>/00000.png, padded on top to one height ──────────
const frameDir = (id: string) => join(TMP, 'f', id)
const count = (id: string) => Math.max(1, Math.round(secs(id) * FPS))
async function renderFrames(id: string) {
  const dir = frameDir(id), N = count(id)
  if (existsSync(dir) && readdirSync(dir).length >= N && !process.env.FRESH) return
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const per = Math.max(1, Math.floor(7000 / fh(id)))
  const chunks = Array.from({ length: Math.ceil(N / per) }, (_, k) => k)
  await pool(chunks, 4, async k => {
    const a = k * per, n = Math.min(per, N - a), png = join(TMP, `chunk-${id}-${k}.png`)
    await shot(`file://${GAL}?frames=${id}&fps=${FPS}&from=0&to=${secs(id)}&w=${COLS}&chunk=${k}&per=${per}`, W, n * fh(id), png)
    await ff('-loop', '1', '-framerate', String(FPS), '-i', png, '-vf', `crop=${W}:${fh(id)}:0:n*${fh(id)},pad=${W}:${HMAX}:0:${HMAX - fh(id)}:color=${BGHEX}`, '-frames:v', String(n), '-start_number', String(a), join(dir, '%05d.png'))
    rmSync(png)
  })
  console.log('frames', id, N)
}

// ── timelines ───────────────────────────────────────────────────────────────────────────────────
type Seg = { id: string; len: number; caption?: string } // len seconds from t=0; past the clip's end the last frame holds
const HEROES: [string, string][] = [['work-thinking', 'Iron Man'], ['work-thor', 'Thor'], ['work-loki', 'Loki'], ['work-spidey', 'Spider-Man'], ['work-starlord', 'Star-Lord']]
const hero = (n: string) => `${n} takes the stage · a new hero every 8 s`
const HERO_SEGS: Seg[] = [
  { id: 'boot', len: 2.6, caption: 'Claude Code + Clarvis: heroes above your prompt' },
  { id: 'work-thinking', len: 6, caption: 'Iron Man suits up while Claude works' },
  ...HEROES.slice(1).map(([id, n]) => ({ id, len: 6, caption: hero(n) })),
  { id: 'assemble', len: 4.4, caption: 'Task done: CLAUVENGERS, ASSEMBLE!' },
]
const SHORT_SEGS: Seg[] = [
  { id: 'boot', len: 0 }, // skipped
  { id: 'work-thinking', len: 4 }, ...HEROES.slice(1).map(([id]) => ({ id, len: 3 })), { id: 'assemble', len: 4.4 },
].filter(s => s.len > 0)
const DEMO_SEGS: Seg[] = [...HERO_SEGS,
  { id: 'snap', len: 3.6, caption: 'Something breaks? Thanos shows up.' },
  { id: 'fury', len: 4.5, caption: 'Fury: Claude has a question for you' }]
const CLIP_IDS = [...new Set([...DEMO_SEGS, ...SHORT_SEGS].map(s => s.id))]

// symlinks one sequence dir for a timeline, taking every `step`th 30 fps frame
function sequence(name: string, segs: Seg[], step: number): { dir: string; n: number; bounds: number[] } {
  const dir = join(TMP, 'seq', name); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  let n = 0; const bounds = [0]
  for (const s of segs) {
    const total = count(s.id)
    for (let k = 0; k < Math.round(s.len * FPS); k += step) symlinkSync(join(frameDir(s.id), String(Math.min(k, total - 1)).padStart(5, '0') + '.png'), join(dir, String(n++).padStart(5, '0') + '.png'))
    bounds.push(n)
  }
  return { dir, n, bounds }
}
const kb = (f: string) => (statSync(f).size / 1024).toFixed(0)

async function gif(name: string, segs: Seg[], width: number) {
  const { dir } = sequence(name, segs, 3)
  const out = OUT + name + '.gif', pal = join(TMP, name + '-pal.png')
  const scale = `fps=10,scale=${width}:-1:flags=lanczos`
  await ff('-framerate', '10', '-i', join(dir, '%05d.png'), '-vf', `${scale},palettegen=stats_mode=diff:max_colors=${process.env.GIF_COLORS ?? 192}`, pal)
  await ff('-framerate', '10', '-i', join(dir, '%05d.png'), '-i', pal, '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=${process.env.GIF_DITHER ?? 'bayer:bayer_scale=4'}:diff_mode=rectangle`, '-loop', '0', out)
  console.log(name + '.gif', kb(out), 'KB')
}

// ── mp4 with burned-in captions (captions are Chrome-rendered PNGs: this ffmpeg has no drawtext) ───
const CORNER = 'Clarvis · unofficial fan project · github.com/shahsanket2107/clarvis'
async function mp4(name: string, CW_: number, CH_: number) {
  const square = CW_ === CH_
  const bandW = square ? 1040 : W, bandH = Math.round((HMAX * bandW) / W)
  const top = square ? 190 : 140
  const capTop = square ? top + bandH + 70 : top + bandH + 120
  const { dir } = sequence(name, DEMO_SEGS, 1)
  // captions: one PNG per segment, as an image sequence at 30 fps (symlinked per frame, like the frames)
  const cdir = join(TMP, 'cap', name); rmSync(cdir, { recursive: true, force: true }); mkdirSync(cdir, { recursive: true })
  let n = 0
  for (const [i, s] of DEMO_SEGS.entries()) {
    const png = join(cdir, `seg${i}.png`)
    await shot('data:text/html;base64,' + Buffer.from(captionPage(CW_, CH_, s.caption!.replace(/CLAUVENGERS, ASSEMBLE!/, '<b>CLAUVENGERS, ASSEMBLE!</b>'), { top: capTop, size: square ? 56 : 64, corner: CORNER, cornerSize: square ? 22 : 26, maxw: CW_ - 120 })).toString('base64'), CW_, CH_, png, ['--default-background-color=00000000'])
    for (let k = 0; k < Math.round(s.len * FPS); k++) symlinkSync(png, join(cdir, String(n++).padStart(5, '0') + '.png'))
  }
  const out = OUT + name + '.mp4'
  const scaled = square ? `scale=${bandW}:${bandH}:flags=lanczos,` : ''
  await ff('-framerate', String(FPS), '-i', join(dir, '%05d.png'), '-framerate', String(FPS), '-i', join(cdir, '%05d.png'), '-filter_complex',
    `[0:v]${scaled}pad=${CW_}:${CH_}:(${CW_}-iw)/2:${top}:color=0x0E0E16,format=rgba[b];[b][1:v]overlay=0:0,format=yuv420p[v]`, '-map', '[v]', '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out)
  console.log(name + '.mp4', kb(out), 'KB')
}

// ── stills ────────────────────────────────────────────────────────────────────────────────────────
async function still(file: string, id: string, t: number, cols = COLS) {
  const w = (cols + 5) * CW, h = fh(id), png = join(TMP, 'still-' + file)
  await shot(`file://${GAL}?frames=${id}&fps=1&from=${t}&to=${t + 1}&w=${cols}&chunk=0&per=1`, w, h, png)
  await ff('-i', png, '-vf', `crop=${w}:${h}:0:0`, '-frames:v', '1', OUT + file)
}
export const STILLS: [string, string, number][] = [['band.png', 'work-thor', Number(process.env.BAND_T ?? 2.4)], ['moment.png', 'assemble', Number(process.env.MOMENT_T ?? 3.8)], ['idle.png', 'idle', 0]]

// theater: ens-shot style panel, cropped from the contact-sheet canvas (16 px side and 24 px top padding, 24 px title line)
const THEATER = { movie: 8, seed: 42, cols: 100, rows: 28 }
async function theater() {
  const { movie, seed, cols, rows: r } = THEATER, png = join(TMP, 'theater.png')
  await shot(`file://${GAL}?theater=${movie}&w=${cols}&h=${r}&n=1&seed=${seed}`, cols * CW + 40, r * CH + 80, png)
  await ff('-i', png, '-vf', `crop=${cols * CW}:${r * CH}:16:48`, '-frames:v', '1', OUT + 'theater.png')
}

async function page(file: string, html: string, outName: string, size?: [number, number], pad = 0) {
  const f = join(TMP, file + '.html'); writeFileSync(f, html)
  let [w, h] = size ?? [0, 0]
  if (!size) { // measure: the page writes its size into the title
    const p = Bun.spawn([CHROME, '--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${join(TMP, 'prof-m')}`, '--virtual-time-budget=3000', '--window-size=1600,1600', '--dump-dom', 'file://' + f], { stdin: 'ignore', stdout: 'pipe', stderr: 'ignore' })
    let dom = ''; const rd = p.stdout.getReader(), dec = new TextDecoder()
    while (!/<\/html>/.test(dom)) { const r = await rd.read(); if (r.done) break; dom += dec.decode(r.value) }
    p.kill()
    const m = /<title>(\d+)x(\d+)<\/title>/.exec(dom); if (!m) throw new Error('measure failed ' + file); w = +m[1]! + pad; h = +m[2]! + pad
  }
  await shot('file://' + f, w, h, OUT + outName)
}
const text = async () => {
  await page('stats', terminalPage('clarvis — my-app', '/clarvis stats', sampleStats()), 'stats.png')
  await page('card', terminalPage('clarvis — my-app', '/clarvis card week', sampleCard()), 'card.png')
  await page('trophies', terminalPage('clarvis — my-app', '/clarvis trophies', sampleTrophies()), 'trophies.png')
}
const social = async () => {
  await page('social', socialPage('file://' + OUT + 'moment.png'), 'social-preview.png', [1280, 640])
}

mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true })
const steps = process.argv.slice(2).length ? process.argv.slice(2) : ['all']
const want = (s: string) => steps.includes('all') || steps.includes(s)
if (!existsSync(GAL)) throw new Error('run `bun scripts/gallery.ts` first')
if (want('frames') || want('gif') || want('mp4')) { for (const id of CLIP_IDS) await renderFrames(id) }
if (want('stills')) for (const [f, id, t] of STILLS) await still(f, id, t)
if (want('gif')) { await gif('hero', HERO_SEGS, 1160); await gif('hero-short', SHORT_SEGS, 1160) }
if (want('mp4')) { await mp4('demo', 1920, 1080); await mp4('demo-square', 1080, 1080) }
if (want('theater')) await theater()
if (want('text')) await text()
if (want('social')) await social()
if (want('arcade')) await ff('-i', ROOT + 'demo/arcade/title-menu.png', '-vf', 'crop=iw:ih-18:0:18', '-frames:v', '1', OUT + 'arcade.png') // drops the capture's debug line
