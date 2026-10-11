// The gallery's browser side: runs the mod's own art code and paints its
// Raster cells the way a terminal does (▀ = fg on top, bg below; text glyphs).
import { Surface, DEFAULT } from '../hooks/pixel'
import { Theater } from '../hooks/theater-engine'
import { lineFor } from '../hooks/lines'
import { Session, type Kind } from './chrome'
import { HERO, ROSTER, ROSTER_SECONDS, MOMENTS, MOMENT_ROWS, MOMENT_SECONDS, IDLE_ROWS, WORK_ROWS, drawIdle, drawWorking, type Activity, type Moment, type WorkState } from '../hooks/scenes'

const BG = '#1B1B29', CW = 10, CH = 24 // a Ghostty cell shape: JetBrains Mono 14pt, +10% height
const QMASK: Record<number, number> = { 0x2598: 8, 0x259D: 4, 0x2596: 2, 0x2597: 1, 0x2580: 12, 0x2584: 3, 0x258C: 10, 0x2590: 5, 0x259A: 9, 0x259E: 6, 0x259B: 14, 0x259C: 13, 0x2599: 11, 0x259F: 7, 0x2588: 15 }
const who = { name: 'memory', model: 'opus' }
const usage = { percent: 48, tokens: 483500, cost: 4.12 }
const log = [{ ok: true, tool: 'Read', detail: 'src/memory/store.ts', ms: 120 }, { ok: false, tool: 'Bash', detail: 'bun test tests/memory.test.ts', ms: 2300 }, { ok: true, tool: 'Grep', detail: '"embedding" in src/', ms: 340 }]
const DEMO: Record<string, [string, string, string]> = {
  thinking: ['', '◇ "add vector search to the memory store"', 'cross-referencing Stark archives…'], responding: ['', '◇ "add vector search to the memory store"', 'composing the reply, sir…'],
  fury: ['Bash', 'bun test tests/memory.test.ts', '"Eyes open."'],
  ironman: ['Edit', 'src/memory/store.ts', '"Sometimes you gotta run before you can walk."'], hulk: ['Bash', 'bun test tests/memory.test.ts', '"HULK SMASH!"'],
  thor: ['WebSearch', 'sqlite vector extension benchmarks', '"Bring me Thanos!"'], cap: ['Read', 'src/memory/index.ts', '"I can do this all day."'],
  hawkeye: ['Grep', '"embedding" in src/', '"I see better from a distance."'], spidey: ['Glob', 'src/**/*.test.ts', '"Hey everyone."'],
  strange: ['Agent', 'audit the retrieval path', '"Dormammu, I\'ve come to bargain."'], witch: ['Write', 'src/memory/schema.ts', '"Chaos magic, rewriting reality."'],
  ultron: ['Bash', 'bun run build', '"There are no strings on me."'],
  panther: ['Grep', 'handlers in src/api', '"Wakanda forever!"'], vision: ['Agent', 'review the schema change', '"I am... I am."'], loki: ['Task', 'draft three variants', '"I am burdened with glorious purpose."'],
  starlord: ['Bash', 'bun run build', '"I\'m Star-Lord, man. Legendary outlaw?"'],
  gamora: ['Grep', 'TODO in src/', '"I\'m going to die surrounded by the biggest idiots in the galaxy."'],
  drax: ['Read', 'src/auth/session.ts', '"I\'m just going to stand here really still."'],
  rocket: ['Bash', 'bun test', '"Ain\'t nothing like me, except me!"'],
  groot: ['Edit', 'src/auth/session.ts', '"I am Groot."'],
  mantis: ['Agent', 'review the retry path', '"I am Mantis."'],
  nebula: ['Write', 'src/auth/refresh.ts', '"I just wanted a sister."'],
  falcon: ['Grep', 'callers of refreshToken', '"Hey, Cap. On your left."'], warmachine: ['Bash', 'bun run build', '"War Machine, rollin\' out."'],
  cmarvel: ['Agent', 'audit the retry path', '"Higher, further, faster, baby."'], bucky: ['Read', 'src/auth/session.ts', '"Till the end of the line, punk."'],
  yondu: ['Glob', 'src/**/*.ts', '"I\'m Mary Poppins, y\'all!"'],
  widow: ['WebSearch', 'sqlite-vec vs pgvector 2026', '"Gathering intel."'], antman: ['compact', 'shrinking the context with Pym particles', '"Is it too late to change the name to Giant-Man?"'],
  deadpool: ['Bash', 'bun run build', 'DEADPOOL: "Still running? I could\'ve regrown a leg by now."'],
  assemble: ['Agent', 'audit the retrieval path', '"Avengers… assemble."'], jarvis: ['TodoWrite', '3 tasks', '"At your service, sir."'], snap: ['Bash', 'bun run build', '"I am inevitable."'],
}
const work = (act: Activity, calm = false, n = 1): WorkState => { const [tool, detail] = DEMO[act]!; const l = lineFor(act, n, detail); return { who, usage, calm, act, actAt: 0, tool, detail, line: l.text, speaker: l.by, lineAt: 0.2, elapsed: '1m 04s', tools: 7, log, lane: true } }
type Clip = { id: string; title: string; note: string; rows: number; seconds: number; draw: (s: Surface, t: number) => void }
const moment = (m: Moment, title: string, note: string, detail: string, caption = ''): Clip => ({
  id: m, title, note, rows: MOMENT_ROWS[m], seconds: m === 'fury' ? 3 : MOMENT_SECONDS[m], draw: (s, t) => MOMENTS[m](s.cv, t, { who, usage, detail, caption }),
})
export const CLIPS: Clip[] = [
  { id: 'idle', title: 'Idle · one Stark line', note: 'Who, the suit Mark, context used, what the session has spent. Static: no redraws while idle.', rows: IDLE_ROWS, seconds: 1, draw: s => drawIdle(s.cv, who, usage) },
  // every hero of the rotation, in its order: the stage on the left and the lane's whole ROSTER_SECONDS story beneath
  ...(ROSTER as readonly Activity[]).map((a, i) => ({ id: `work-${a}`, title: `${i + 1} / ${ROSTER.length} · ${HERO[a]?.name ?? a}`, note: `Working, ${HERO[a]?.name ?? a} on stage: the portrait on the left beside the live content (what runs, the line, the mission log, context, spend), and the full-width lane beneath, a ${ROSTER_SECONDS} s story.`, rows: WORK_ROWS, seconds: ROSTER_SECONDS, draw: (s: Surface, t: number) => { const loop = Math.floor(Date.now() / ((ROSTER_SECONDS + 0.8) * 1000)), l = lineFor(a, loop + i, DEMO[a]![1]); drawWorking(s.cv, { ...work(a), cast: a, line: l.text, speaker: l.by }, t) } })), // a new line each loop, as a session shuffles them
  { id: 'rotate', title: 'Working · thinking, the team rotating', note: 'While no tool runs, the stage and the lane cycle through the whole roster, 6 s each.', rows: WORK_ROWS, seconds: ROSTER.length * ROSTER_SECONDS, draw: (s: Surface, t: number) => { const k = Math.floor(t / ROSTER_SECONDS), c = ROSTER[k % ROSTER.length]!, l = lineFor(c, k + 1, 'the plan'); drawWorking(s.cv, { ...work('thinking'), cast: c, line: l.text, speaker: l.by, lineAt: k * ROSTER_SECONDS }, t) } },
  { id: 'calm', title: 'Working · calm mode', note: '/clarvis calm: the same content, nothing moves.', rows: WORK_ROWS, seconds: 1, draw: (s, t) => drawWorking(s.cv, work('thinking', true), t) },
  moment('boot', 'Session start · Stark boot', 'The helmet powers up while JARVIS runs the systems check.', ''),
  moment('assemble', 'Turn done · CLAUVENGERS, ASSEMBLE!', 'The A gathers from sparks, the wordmark lands with a glint, the team flies in.', '✓ mission complete · 1m 04s · 7 actions · $0.42', '"I am Iron Man."'),
  moment('snap', 'Error · Thanos', 'Six stones light, the snap, the error turns to dust.', 'bun run build exited 1: Cannot find module "./store"'),
  moment('fury', 'Needs you · Nick Fury', 'A turn ended on a question for you: S.H.I.E.L.D. alert until you reply (animates 6 s, then holds still).', 'Should I run the migration against staging now?', '"I need your answer on this one, Agent."'),
]

const hex = (c: number) => '#' + (c & 0xffffff).toString(16).padStart(6, '0')
function paint(ctx: CanvasRenderingContext2D, s: Surface, ox: number, oy: number) {
  const w = s.words, cols = s.columns
  for (let r = 0; r < s.rowCount; r++) for (let c = 0; c < cols; c++) {
    const o = (r * cols + c) * 3, cp = w[o]!, fg = w[o + 1]!, bg = w[o + 2]!
    const x = ox + c * CW, y = oy + r * CH
    const F = fg === DEFAULT ? BG : hex(fg), B = bg === DEFAULT ? BG : hex(bg)
    ctx.fillStyle = B; ctx.fillRect(x, y, CW, CH)
    const m = QMASK[cp]
    if (m !== undefined) {
      ctx.fillStyle = F
      if (m & 8) ctx.fillRect(x, y, CW / 2, CH / 2)
      if (m & 4) ctx.fillRect(x + CW / 2, y, CW / 2, CH / 2)
      if (m & 2) ctx.fillRect(x, y + CH / 2, CW / 2, CH / 2)
      if (m & 1) ctx.fillRect(x + CW / 2, y + CH / 2, CW / 2, CH / 2)
    } else if (cp !== 0x20) { ctx.fillStyle = F; ctx.fillText(String.fromCodePoint(cp), x, y + CH - 6) }
  }
}
// a clip as a session shows it: the band between the transcript and the prompt, with the engine's buttons
const kindOf = (clip: Clip): Kind => (clip.id === 'idle' ? 'idle' : clip.id.startsWith('work') || clip.id === 'rotate' || clip.id === 'calm' ? 'work' : 'moment')
const SESSION_ROWS = 5 // the transcript line above; the prompt box and footer below
function frame(clip: Clip, cols: number, t: number): Surface {
  const ss = new Session(cols, clip.rows, kindOf(clip))
  ss.band.cv.clear(); clip.draw(ss.band, t)
  const s = ss.compose(); s.cells()
  return s
}

const q = new URLSearchParams(location.search)
const cols = +(q.get('w') ?? 120)
const font = (ctx: CanvasRenderingContext2D) => { ctx.font = '15px "JetBrains Mono", Menlo, monospace'; ctx.textBaseline = 'alphabetic' }
const root = document.getElementById('root')!
const SEED = +(new URLSearchParams(location.search).get('seed') ?? 42)
const theaterFrame = (i: number, c: number, r: number, f: (th: Theater) => void): Surface => { const th = new Theater(c, r, SEED); th.watch(i); th.fx = false; f(th); th.draw(); th.sf.cells(); return th.sf }
const addCanvas = (title: string, parts: Surface[], gap = 10) => {
  const cv = document.createElement('canvas'); cv.width = parts[0]!.columns * CW; cv.height = parts.reduce((a, s) => a + s.rowCount * CH + gap, 24)
  const ctx = cv.getContext('2d')!; font(ctx); ctx.fillStyle = '#0E0E16'; ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.fillStyle = '#F5C542'; ctx.fillText(title, 4, 16)
  let y = 24; for (const s of parts) { paint(ctx, s, 0, y); y += s.rowCount * CH + gap }
  root.appendChild(cv)
}
const th = q.get('theater')
if (th || q.get('frames')) for (const el of Array.from(document.body.children)) if (el !== root && el.tagName !== 'SCRIPT') (el as HTMLElement).style.display = 'none'
if (th === 'list' || th === 'burst') {
  if (th === 'list') { const l = new Theater(170, 50, 42); l.fx = false; l.seen.add('assemble'); l.seen.add('endgame'); l.draw(); l.sf.cells(); addCanvas('the list (✓ = watched)', [l.sf]) }
  else { const b = new Theater(170, 40, 42); b.watch(7); for (let k = 0; k < 4000 && !b.burst; k++) b.tick(); for (let k = 0; k < 4; k++) b.tick(); b.draw(); b.sf.cells(); addCanvas('a screen burst (fx on)', [b.sf]) }
} else if (th) {
  const i = +th - 1, n = +(q.get('n') ?? 6), rows = +(q.get('h') ?? 40), parts: Surface[] = []
  const probe = new Theater(cols, rows, SEED); probe.watch(i)
  const len = probe.plan!.len
  // ?find=battle[:k] frames the k-th beat of that kind across its length; ?at=12,40 takes those seconds
  const find = q.get('find'), at = q.get('at')
  if (find) {
    const [k0, which] = find.split(':'), kind = k0 === 'talk' || k0 === 'group' ? 'say' : k0, bs = probe.plan!.beats.filter(b => b.k === kind), b = bs[+(which ?? 0)] // (a talk plans as say beats)
    if (!b) throw new Error(`no ${find} beat in movie ${th}: ${bs.length} of kind ${kind}`)
    if (b) for (let k = 0; k < n; k++) { const tm = b.start + b.d * (0.08 + (0.84 * k) / Math.max(1, n - 1)); parts.push(theaterFrame(i, cols, rows, t => { t.tm = tm })) }
  } else if (at) for (const s of at.split(',')) parts.push(theaterFrame(i, cols, rows, t => { t.tm = +s }))
  else for (let k = 0; k < n; k++) parts.push(theaterFrame(i, cols, rows, t => { t.tm = (len * (k + 0.5)) / n }))
  addCanvas(`THEATER · movie ${th}`, parts)
} else if (q.get('frames')) {
  // exact frames for recording: ?frames=<clip>&fps=30&from=0&to=6&w=140&chunk=0&per=16. Frames are stacked in one tall canvas with no
  // titles or labels (the session chrome only); chunk/per slice the run so a canvas stays under the browser's limits.
  Date.now = () => 0 // the lines shuffle per loop by the clock: pin it so every chunk draws the same story
  const clip = CLIPS.find(c => c.id === q.get('frames'))!
  const fps = +(q.get('fps') ?? 30), from = +(q.get('from') ?? 0), to = +(q.get('to') ?? clip.seconds), per = +(q.get('per') ?? 16), ck = +(q.get('chunk') ?? 0)
  const N = Math.max(1, Math.round((to - from) * fps)), fh = (clip.rows + SESSION_ROWS) * CH, a = ck * per, b = Math.min(N, a + per)
  document.body.style.cssText = 'margin:0;padding:0;background:' + BG
  const cv = document.createElement('canvas'); cv.width = (cols + 5) * CW; cv.height = (b - a) * fh
  const ctx = cv.getContext('2d')!; font(ctx); ctx.fillStyle = BG; ctx.fillRect(0, 0, cv.width, cv.height)
  for (let i = a; i < b; i++) paint(ctx, frame(clip, cols, Math.min(clip.seconds, from + i / fps)), 0, (i - a) * fh)
  root.appendChild(cv); cv.style.display = 'block'
  document.title = `frames ${N} ${cv.width}x${fh}`
} else if (q.get('sheet')) {
  // a contact sheet: n frames of one clip, stacked, for screenshots
  const ids = q.get('sheet')!.split(',')
  const n = +(q.get('n') ?? 8)
  for (const id of ids) {
    const clip = CLIPS.find(c => c.id === id)!
    const cv = document.createElement('canvas'), gap = 10
    cv.width = (cols + 5) * CW + 60; cv.height = n * ((clip.rows + SESSION_ROWS) * CH + gap) + 24
    const ctx = cv.getContext('2d')!; font(ctx)
    ctx.fillStyle = '#0E0E16'; ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.fillStyle = '#F5C542'; ctx.fillText(clip.title, 4, 16)
    for (let i = 0; i < n; i++) {
      const t = (q.get('t0') ? +q.get('t0')! : 0) + (Math.min(clip.seconds, 6) * i) / Math.max(1, n - (clip.seconds === 1 ? 0 : 1)) * (q.get('span') ? +q.get('span')! / Math.min(clip.seconds, 6) : 1)
      ctx.fillStyle = '#8C90B4'; ctx.fillText(t.toFixed(2), 4, 24 + i * ((clip.rows + SESSION_ROWS) * CH + gap) + 18)
      paint(ctx, frame(clip, cols, t), 56, 24 + i * ((clip.rows + SESSION_ROWS) * CH + gap))
    }
    root.appendChild(cv)
  }
} else {
  // the live gallery: every clip, animating at 15 fps
  const items = CLIPS.map(clip => {
    const card = document.createElement('section')
    card.innerHTML = `<h2>${clip.title}</h2><p>${clip.note}</p>`
    const cv = document.createElement('canvas'); cv.width = (cols + 5) * CW; cv.height = (clip.rows + SESSION_ROWS) * CH
    card.appendChild(cv); root.appendChild(card)
    const ctx = cv.getContext('2d')!; font(ctx)
    const ss = new Session(cols, clip.rows, kindOf(clip))
    const it = { clip, ctx, ss, seen: true, painted: false }
    new IntersectionObserver(es => { for (const x of es) it.seen = x.isIntersecting }, { rootMargin: '200px' }).observe(cv) // only cards on screen animate
    return it
  })
  const t0 = performance.now()
  const tick = () => {
    const now = (performance.now() - t0) / 1000
    for (const it of items) {
      if (!it.seen && it.painted) continue
      it.painted = true
      const loop = it.clip.seconds === Infinity ? 3 : it.clip.seconds + 0.8
      const t = now % loop
      it.ss.band.cv.clear(); it.clip.draw(it.ss.band, Math.min(t, it.clip.seconds)); const s = it.ss.compose(); s.cells(); paint(it.ctx, s, 0, 0)
    }
  }
  setInterval(tick, 1000 / 15); tick()
  // the AVENGERS THEATER, drawn by the real engine
  const h = document.createElement('h2'); h.textContent = 'AVENGERS THEATER · /clarvis movies'; root.appendChild(h)
  const lst = new Theater(170, 50, 42); lst.fx = false; lst.seen.add('assemble'); lst.seen.add('endgame'); lst.draw(); lst.sf.cells()
  addCanvas('the list (✓ = watched)', [lst.sf])
  for (let i = 0; i < 10; i++) { const len = (() => { const t = new Theater(170, 40, 42); t.watch(i); return t.plan!.len })(); addCanvas(`movie ${i + 1} · mid-movie`, [theaterFrame(i, 170, 40, t => { t.tm = len * 0.35 })]) }
  const b = new Theater(170, 40, 42); b.watch(7); for (let k = 0; k < 4000 && !b.burst; k++) b.tick(); for (let k = 0; k < 4; k++) b.tick(); b.draw(); b.sf.cells()
  addCanvas('a screen burst (fx on)', [b.sf])
}
