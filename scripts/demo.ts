// Preview clarvis without a Claude session: plays every view of the band
// in this terminal (truecolor, quadrant blocks), or records it.
//   bun scripts/demo.ts            play it here (Ctrl-C to stop)
//   bun scripts/demo.ts --cast F   save an asciinema recording (asciinema play F)
// The browser gallery (demo/gallery.html, built by scripts/gallery.ts) shows the same.
import { DEFAULT, Surface, encode } from '../hooks/pixel'
import { Session, type Kind } from './chrome'
import { IDLE_ROWS, MOMENTS, MOMENT_ROWS, MOMENT_SECONDS, WORK_ROWS, drawIdle, drawWorking, type Activity, type Moment } from '../hooks/scenes'

const W = Math.min(170, (process.stdout.columns || 120) - 7) // the band; the engine's [-] takes five more
const who = { name: 'auth-api', model: 'opus' }
const usage = { percent: 41, tokens: 82400, cost: 3.18 }
const log = [{ ok: true, tool: 'Read', detail: 'src/auth/session.ts', ms: 120 }, { ok: false, tool: 'Bash', detail: 'bun test tests/auth', ms: 2300 }]
const STAGE: [Activity, string, string, string][] = [
  ['thinking', '', '◇ "fix the token refresh race"', 'cross-referencing Stark archives…'], ['ironman', 'Edit', 'src/auth/session.ts', '"Suit up."'],
  ['hulk', 'Bash', 'bun run build', '"HULK SMASH!"'], ['deadpool', 'Bash', 'bun run build', 'DEADPOOL: "Still running? I could\'ve regrown a leg by now."'],
  ['cap', 'Read', 'src/auth/index.ts', '"I can do this all day."'], ['thor', 'WebFetch', 'docs.example.com/oauth', '"Bring me Thanos!"'],
  ['ultron', 'Bash', 'bun run build', '"There are no strings on me."'],
  ['panther', 'Grep', 'handlers in src/auth', '"Wakanda forever!"'], ['vision', 'Agent', 'review the retry path', '"I am... I am."'], ['loki', 'Task', 'draft three variants', '"I am burdened with glorious purpose."'],
  ['starlord', 'Bash', 'bun run build', '"I\'m Star-Lord, man. Legendary outlaw?"'],
  ['gamora', 'Grep', 'TODO in src/', '"I\'m going to die surrounded by the biggest idiots in the galaxy."'],
  ['drax', 'Read', 'src/auth/session.ts', '"I\'m just going to stand here really still."'],
  ['rocket', 'Bash', 'bun test', '"Ain\'t nothing like me, except me!"'],
  ['groot', 'Edit', 'src/auth/session.ts', '"I am Groot."'],
  ['mantis', 'Agent', 'review the retry path', '"I am Mantis."'],
  ['nebula', 'Write', 'src/auth/refresh.ts', '"I just wanted a sister."'],
  ['falcon', 'Grep', 'callers of refreshToken', '"Hey, Cap. On your left."'], ['warmachine', 'Bash', 'bun run build', '"War Machine, rollin\' out."'],
  ['cmarvel', 'Agent', 'audit the retry path', '"Higher, further, faster, baby."'], ['bucky', 'Read', 'src/auth/session.ts', '"Till the end of the line, punk."'],
  ['yondu', 'Glob', 'src/**/*.ts', '"I\'m Mary Poppins, y\'all!"'],
  ['widow', 'WebSearch', 'refresh token rotation best practice', '"Gathering intel."'], ['hawkeye', 'Grep', '"refreshToken" in src/', '"Never miss."'],
  ['spidey', 'Glob', 'src/**/*.test.ts', '"Thwip!"'], ['witch', 'Write', 'src/auth/refresh.ts', '"Chaos magic, rewriting reality."'],
  ['strange', 'Agent', 'audit the retry path', '"Dormammu, I\'ve come to bargain."'], ['antman', 'compact', 'shrinking the context with Pym particles', '"Pym particles, engaged."'],
  ['jarvis', 'TodoWrite', '3 tasks', '"At your service, sir."'],
]
type Clip = { title: string; rows: number; seconds: number; draw: (s: Surface, t: number) => void; kind?: Kind }
const CLIPS: Clip[] = [
  { title: 'Session start · Stark boot', rows: MOMENT_ROWS.boot, seconds: MOMENT_SECONDS.boot, draw: (s, t) => MOMENTS.boot(s.cv, t, { who, usage, detail: '', caption: '' }) },
  { title: 'Idle · one Stark line', rows: IDLE_ROWS, seconds: 1, draw: s => drawIdle(s.cv, who, usage), kind: 'idle' },
  ...STAGE.map(([act, tool, detail, line]) => ({ title: `Working · ${act}`, rows: WORK_ROWS, seconds: 3, draw: (s: Surface, t: number) => drawWorking(s.cv, { who, usage, calm: false, act, actAt: 0, tool, detail, line, lineAt: 0.1, elapsed: '42s', tools: 7, log, lane: true }, t), kind: 'work' as Kind })),
  ...(['assemble', 'snap', 'fury'] as Moment[]).map(m => ({ title: `Moment · ${m}`, rows: MOMENT_ROWS[m], seconds: m === 'fury' ? 3 : MOMENT_SECONDS[m], draw: (s: Surface, t: number) => MOMENTS[m](s.cv, t, { who, usage, detail: m === 'fury' ? 'Should I run the migration against staging now?' : m === 'snap' ? 'bun run build exited 1' : '✓ mission complete · 1m 04s · 7 actions', caption: m === 'assemble' ? '"I am Iron Man."' : '' }) })),
]

const sgr = (c: number, bg: boolean) => (c === DEFAULT ? (bg ? '49' : '39') : `${bg ? 48 : 38};2;${(c >> 16) & 255};${(c >> 8) & 255};${c & 255}`)
function ansi(s: Surface): string[] {
  const w = encode(s.cv, s.words), out: string[] = []
  for (let r = 0; r < s.rowCount; r++) {
    let line = ''
    for (let c = 0; c < s.columns; c++) { const o = (r * s.columns + c) * 3; line += `\x1b[${sgr(w[o + 1]!, false)};${sgr(w[o + 2]!, true)}m${String.fromCodePoint(w[o]!)}` }
    out.push(line + '\x1b[0m')
  }
  return out
}
const events: [number, string][] = []
let t = 0
const emit = (x: string) => events.push([+t.toFixed(3), x])
emit('\x1b[?25l')
for (const c of CLIPS) {
  emit(`\r\n\x1b[1;38;2;245;197;66m── ${c.title}\x1b[0m\r\n`)
  const ss = new Session(W, c.rows, c.kind ?? 'moment', who.name) // the band inside the bottom of a session
  for (let f = 0; f * 0.066 < c.seconds; f++) {
    ss.band.cv.clear(); c.draw(ss.band, f * 0.066)
    const s = ss.compose()
    emit((f ? `\x1b[${s.rowCount}F` : '') + ansi(s).map(l => `\x1b[2K${l}\r\n`).join(''))
    t += 0.066
  }
  t += 0.5
}
emit('\x1b[?25h')
const args = process.argv.slice(2)
if (args[0] === '--cast') {
  const head = { version: 2, width: W + 2, height: 40, title: 'clarvis', env: { TERM: 'xterm-256color' } }
  await Bun.write(args[1] ?? 'clarvis.cast', [JSON.stringify(head), ...events.map(e => JSON.stringify([e[0], 'o', e[1]]))].join('\n') + '\n')
} else {
  let last = 0
  for (const [at, x] of events) { await Bun.sleep((at - last) * 1000); last = at; process.stdout.write(x) }
}
