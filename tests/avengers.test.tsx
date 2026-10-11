import { expect, mock } from 'claude-code/testing'
import { test } from './timed'
import { Canvas, CLEAR, DEFAULT, Surface, base64, encode, surface } from '../hooks/pixel'
import { lineFor } from '../hooks/lines'
import { MOMENTS, MOMENT_ROWS, MOMENT_SECONDS, IDLE_ROWS, WORK_ROWS, drawIdle, drawWorking, ROSTER_SECONDS, type Activity, type Moment } from '../hooks/scenes'

const SPINNER = { plugin: 'clarvis', surface: 'terminal', component: 'Spinner', viewport: { columns: 120, rows: 40 } } as const
// The drawing's text, rows joined by newlines.
const flat = (n: any): string => typeof n === 'string' ? n : !n ? '' : (n.children ?? []).map(flat).join(n.props?.flexDirection === 'column' ? '\n' : '')
const text = async (m: { drawn: () => Promise<unknown> }) => flat(await m.drawn())
// A Raster's cells read back as text: its glyphs, one line per row.
const findRaster = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(findRaster).find(Boolean))
function rasterText(n: any): string {
  const r = findRaster(n)
  if (!r) return ''
  const bin = atob(r.props.cells), u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  const w = new Uint32Array(u8.buffer)
  const out: string[] = []
  for (let y = 0; y < r.props.rows; y++) {
    let s = ''
    for (let x = 0; x < r.props.columns; x++) s += String.fromCodePoint(w[(y * r.props.columns + x) * 3]!)
    out.push(s)
  }
  return out.join('\n')
}
const band = async ($: any, props: Record<string, unknown> = {}) => {
  const m = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { bodyRows: 19 }, view: {}, ...props } })
  const d = await m.drawn()
  return { tree: d, text: rasterText(d), rows: findRaster(d)?.props.rows as number | undefined }
}
const SNAP_MS = 0 /* a success plays ASSEMBLE alone: no snap first */, ASM_MS = MOMENT_SECONDS.assemble * 1000 // a finished task: the snap, then ASSEMBLE
function session(on: any, envIn: Record<string, string>, toolCall: any = () => ({ result: { ok: true } })) {
  const { _MODEL, ...env } = envIn // _MODEL is test-only: the session model
  mock.store(on)
  mock.env(on, { COLORTERM: 'truecolor', ...env })
  const clock = mock.clock(on, { now: 0 })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: _MODEL ?? 'sonnet' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, percent: 41, tokens: 82400 }, rateLimits: [] } }))
  on('command.register', () => ({ value: undefined }))
  on('ui.blit', () => { sent.blits++; return { value: {} } })
  on('ui.toast', () => ({ value: undefined }))
  on('ui.notice', () => ({ value: undefined }))
  on('tool.call', toolCall)
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  return clock
}
const sent = { blits: 0 } // blits the band sent, across a test

// ── the hooks ───────────────────────────────────────────────────────────────

test('thinking with no band shows a JARVIS line in place of the stock spinner', async ($, on) => {
  const m = await $.ui.mount({ ...SPINNER, props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' } })
  const t = await text(m)
  expect(t).toContain('JARVIS')
  expect(t).not.toContain('Sauteing')
})

test('an Edit is Iron Man, a Grep is Hawkeye', async ($, on) => {
  on('tool.call', () => ({ result: { ok: true } as any }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await $.turn.start?.({ text: 'go', turnId: 't1' } as any)
  await $.tool.call({ tool: 'Edit', file_path: '/x/src/auth/session.ts', old_string: 'a', new_string: 'b' } as any)
  const m = await $.ui.mount({ ...SPINNER, props: { word: 'Sauteing', message: null, suffix: '…', mode: 'tool-use' } })
  expect(await text(m)).toContain('IRON MAN')
  await $.tool.call({ tool: 'Grep', pattern: 'claudeCmd' } as any)
  const m2 = await $.ui.mount({ ...SPINNER, props: { word: 'Sauteing', message: null, suffix: '…', mode: 'tool-use' } })
  expect(await text(m2)).toContain('HAWKEYE')
})

test('/clarvis off hands the spinner and the band back to Claude Code', async ($, on) => {
  mock.store(on)
  on('ui.render', { component: 'Spinner' }, ($, e) => { const { Text } = $.ui.resolve(e); return <Text>stock</Text> })
  const r = await $.command.run({ command: 'clarvis', args: 'off' } as any)
  expect(JSON.stringify(r)).toContain('off')
  const m = await $.ui.mount({ ...SPINNER, props: { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' } })
  expect(await text(m)).toContain('stock')
})

test('the band is a Raster: the Stark boot, then one resting line with the Mark and the numbers', async ($, on) => {
  const clock = session(on, { _MODEL: 'opus' })
  await ($ as any).session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
  await band($)
  await clock.advance(1200)
  const boot = await band($)
  expect(boot.rows).toBe(MOMENT_ROWS.boot)
  expect(boot.text).toContain('STARK')
  await clock.advance(4000)
  const idle = await band($)
  expect(idle.rows).toBe(IDLE_ROWS)
  expect(idle.text).toContain('auth-api')
  expect(idle.text).toContain('MK-LXXXV OPUS')
  expect(idle.text).toContain('41%')
  expect(idle.text).toContain('spent')
})

test('a finished turn plays CLAUVENGERS, ASSEMBLE! in the band, then settles back to the HUD', async ($, on) => {
  const clock = session(on, { _MODEL: 'sonnet' })
  on('turn.complete', () => ({ text: '', reason: 'answer' }) as any)
  await ($ as any).session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
  await clock.advance(4000)
  await ($ as any).turn.start({ text: 'go', turnId: 't1' })
  const work = await band($, { isWorking: true })
  expect(work.rows).toBe(WORK_ROWS)
  expect(work.text).toMatch(/◢ [A-Z]/) // a hero on stage: the order is shuffled per session, so any of them
  await $.tool.call({ tool: 'Glob', pattern: 'src/*.ts' } as any)
  await clock.advance(ROSTER_SECONDS * 1000 + 500) // each hero holds the stage long enough to read
  const log = await band($, { isWorking: true })
  const hero = /◢ ([A-Z][A-Z .&'-]+)/.exec(log.text)?.[1]?.trim() // the hero on stage, and the tool at work
  expect(hero).toBeTruthy()
  await clock.advance(ROSTER_SECONDS * 1000 - 1500) // a hero holds the stage a full ROSTER_SECONDS
  expect(/◢ ([A-Z][A-Z .&'-]+)/.exec((await band($, { isWorking: true })).text)?.[1]?.trim()).toBe(hero)
  await clock.advance(1500) // then the next of the team takes over
  const next = /◢ ([A-Z][A-Z .&'-]+)/.exec((await band($, { isWorking: true })).text)?.[1]?.trim()
  expect(next).toBeTruthy()
  if (hero !== 'J.A.R.V.I.S.') expect(next).not.toBe(hero) // J.A.R.V.I.S. is the name of more than one stage, so two in a row can read alike
  expect(log.text).toMatch(/✓.Glob/) // the log's newest line (a card cell between)
  await ($ as any).turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(1500)
  expect((await band($)).text).not.toContain('the work is done') // no snap on success: ASSEMBLE alone
  await clock.advance(SNAP_MS)
  const done = await band($)
  expect(done.rows).toBe(MOMENT_ROWS.assemble)
  expect(done.text).toContain('mission complete · 9s')
  await clock.advance(ASM_MS)
  const rest = await band($)
  expect(rest.rows).toBe(IDLE_ROWS)
  expect(rest.text).toContain('auth-api')
  // at rest the clock has parked: time passing sends nothing more
  const before = sent.blits
  await clock.advance(10000)
  expect(sent.blits).toBe(before)
})

test('the band carries a STARK ARCADE button: a click opens the game pane', async ($, on) => {
  const clock = session(on, {})
  const opened: string[] = []
  on('ui.open', (_$: any, e: any) => { opened.push(e.id); return { value: undefined } as any })
  await ($ as any).session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
  await clock.advance(4000)
  const m = await ($ as any).ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { bodyRows: 19 }, view: {} } })
  await m.press({ key: 'play' })
  expect(opened).toContain('avengers-arcade')
})

test('a paint that never comes back cannot freeze the band on a moment', async ($, on) => {
  mock.store(on)
  mock.env(on, { COLORTERM: 'truecolor' })
  const clock = mock.clock(on, { now: 0 })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }) as any)
  on('session.model', () => ({ value: 'sonnet' }) as any)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1, percent: 10, tokens: 1 }, rateLimits: [] } }) as any)
  on('command.register', () => ({ value: undefined }) as any)
  on('ui.blit', () => new Promise(() => {}) as any) // a pane off screen: the paint is held back forever
  on('tool.call', () => ({ result: { ok: true } as any }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '', reason: 'answer' }) as any)
  await ($ as any).session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
  await ($ as any).turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: '/x/a.ts' } as any)
  await ($ as any).turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: 't1', reason: 'answer' })
  await band($)
  await clock.advance(SNAP_MS + ASM_MS + 1500)
  const b = await band($)
  expect(b.rows).toBe(IDLE_ROWS) // the moment ended on time; nothing stuck on its first frame
})

test('a turn that ends on a question brings in Nick Fury; the next prompt stands him down', async ($, on) => {
  const clock = session(on, {})
  on('turn.complete', () => ({ text: '', reason: 'answer' }) as any)
  await ($ as any).session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
  await clock.advance(4000)
  await ($ as any).turn.start({ text: 'go', turnId: 't1' })
  await ($ as any).turn.complete({ answer: 'Two ways to fix it.\nShould I migrate the table now?', durationMs: 9000, isAborted: false, turnId: 't1', reason: 'answer' })
  await clock.advance(1000)
  const f = (await band($)).text
  expect(f).toContain('NICK FURY')
  expect(f).toContain('Should I migrate the table now?')
  await clock.advance(10000)
  expect((await band($)).text).toContain('NICK FURY') // holds, still, until you reply
  await ($ as any).turn.start({ text: 'yes', turnId: 't2' })
  expect((await band($, { isWorking: true })).text).not.toContain('PRIORITY ALERT') // the Fury moment, not Fury taking his rotation turn
})

test('a permission ask never puts Fury in the band (the dialog covers it); the tool runs untouched', async ($, on) => {
  const clock = session(on, {})
  on('tool.check', () => ({ decision: 'ask' }) as any)
  await ($ as any).session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
  await clock.advance(4000)
  await ($ as any).turn.start({ text: 'go', turnId: 't1' })
  const v = await ($ as any).tool.check({ tool: 'Bash', tool_use_id: 'tu1', input: { command: 'rm -rf dist' }, command: 'rm -rf dist' })
  expect(v.decision).toBe('ask') // observed, never answered by the mod
  await clock.advance(8000)
  expect((await band($, { isWorking: true })).text).not.toContain('PRIORITY ALERT') // the Fury moment, not Fury taking his rotation turn
})

test('calm mode keeps the words and drops the cinematics', async ($, on) => {
  const clock = session(on, { CLARVIS: 'calm' })
  await ($ as any).session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
  expect((await band($)).rows).toBe(IDLE_ROWS) // no boot
  await ($ as any).turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'git status' } as any)
  await clock.advance(7500)
  const b = await band($, { isWorking: true })
  expect(b.rows).toBe(WORK_ROWS) // no Hulk cinematic
  expect(b.text).toContain('HULK ▸') // the hero on the job speaks
})

// ── the sprite renderer ─────────────────────────────────────────────────────

test('half blocks: top pixel is the foreground, bottom the background, clear is the terminal default', async () => {
  const cv = new Canvas(4, 2)
  cv.set(0, 0, 0xff0000); cv.set(0, 1, 0x0000ff) // two colours
  cv.set(1, 1, 0x00ff00) // bottom only
  cv.set(2, 0, 0x123456); cv.set(2, 1, 0x123456) // the same twice
  const w = encode(cv, new Uint32Array(4 * 3))
  expect([w[0], w[1], w[2]]).toEqual([0x2580, 0xfc0000, 0x0000fc]) // colours kept to 6 bits a channel
  expect([w[3], w[4], w[5]]).toEqual([0x2584, 0x00fc00, DEFAULT])
  expect([w[6], w[7], w[8]]).toEqual([0x20, DEFAULT, 0x103454]) // one colour: a space on that background
  expect([w[9], w[10], w[11]]).toEqual([0x20, DEFAULT, DEFAULT])
  cv.setSub(7, 1, 0xffffff) // one subpixel of the last cell: a quadrant
  expect(encode(cv, new Uint32Array(12)).slice(9, 12)).toEqual(Uint32Array.of(0x2597, 0xfcfcfc, DEFAULT))
  cv.text(3, 0, 'A', 0xffffff)
  expect(encode(cv, new Uint32Array(12))[9]).toBe(65)
})

test('base64 of the cells matches the standard encoding', async () => {
  const bytes = new Uint8Array([0, 1, 2, 253, 254, 255, 7])
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  expect(base64(bytes)).toBe(btoa(bin))
})

test('a surface is reused while its size holds: animating allocates no new canvases', async () => {
  const a = surface('t', 80, 4), b = surface('t', 80, 4)
  expect(a).toBe(b)
  expect(surface('t', 81, 4)).not.toBe(a)
})

test('every view draws at every width, stays in its box, and keeps within the Raster palette', async () => {
  const who = { name: 'n', model: 'opus' }, usage = { percent: 50, tokens: 1, cost: 1 }
  const pairsOf = (s: Surface) => { const w = encode(s.cv, s.words), p = new Set<number>(); for (let i = 0; i < w.length; i += 3) p.add(w[i + 1]! * 0x1000000 + w[i + 2]!); return p.size }
  for (const cols of [60, 120, 180]) {
    for (const m of Object.keys(MOMENTS) as Moment[]) {
      const s = new Surface(cols, MOMENT_ROWS[m])
      for (let t = 0; t <= Math.min(MOMENT_SECONDS[m], 4); t += 0.4) {
        s.cv.clear()
        MOMENTS[m](s.cv, t, { who, usage, detail: 'src/auth/session.ts', caption: 'I can do this all day.' })
        expect(pairsOf(s)).toBeLessThan(1024)
      }
    }
    for (const act of ['thinking', 'responding', 'ironman', 'hulk', 'thor', 'cap', 'hawkeye', 'spidey', 'assemble', 'jarvis', 'snap', 'strange', 'witch', 'widow', 'ultron', 'panther', 'vision', 'loki', 'antman', 'deadpool', 'starlord', 'gamora', 'drax', 'rocket', 'groot', 'mantis', 'nebula', 'yondu', 'falcon', 'warmachine', 'cmarvel', 'bucky'] as Activity[]) {
      const s = new Surface(cols, WORK_ROWS)
      drawWorking(s.cv, { who, usage, calm: false, act, actAt: 0, tool: 'Edit', detail: 'x', line: 'y', lineAt: 0, elapsed: '1s', tools: 1, log: [{ ok: true, tool: 'Read', detail: 'a', ms: 5 }] }, 1.3)
      expect(pairsOf(s)).toBeLessThan(1024)
    }
    const i = new Surface(cols, IDLE_ROWS)
    drawIdle(i.cv, who, usage)
    expect(i.cv.glyph.some(g => g !== 0)).toBe(true)
  }
})

test('whatever text it is handed, the band only holds cells the host accepts', async () => {
  const s = new Surface(60, WORK_ROWS)
  const who = { name: 'n🚀', model: 'opus' }, usage = { percent: 10, tokens: 1, cost: 1 }
  for (const detail of ['echo 日本語', 'git commit -m "🚀 ship"', 'a\tb\rc', 'x'.repeat(46) + '🚀🚀', 'é', '​']) {
    s.cv.clear()
    drawWorking(s.cv, { who, usage, calm: false, act: 'hulk', actAt: 0, tool: 'Bash', detail, line: detail, speaker: 'HULK', lineAt: 0, elapsed: '1s', tools: 1, log: [{ ok: true, tool: 'Bash', detail, ms: 5 }], lane: true }, 1)
    const w = encode(s.cv, s.words)
    for (let i = 0; i < w.length; i += 3) {
      const cp = w[i]!
      expect(cp >= 0x20 && cp <= 0xffff && !(cp >= 0xd800 && cp <= 0xdfff) && !(cp >= 0x7f && cp < 0xa0)).toBe(true)
      expect((cp >= 0x3000 && cp <= 0x9fff) || cp === 0x2705 || cp === 0x26a1).toBe(false)
    }
  }
})

test('time running backwards (a clock step, an hour boundary) never throws', async () => {
  const s = new Surface(80, WORK_ROWS)
  const who = { name: 'n', model: 'opus' }, usage = { percent: 10, tokens: 1, cost: 1 }
  for (const act of ['strange', 'thinking', 'hulk', 'spidey', 'assemble', 'deadpool'] as Activity[]) for (const calm of [true, false]) {
    s.cv.clear()
    drawWorking(s.cv, { who, usage, calm, act, actAt: 3600, tool: '', detail: '', line: 'x', lineAt: 3600, elapsed: '1s', tools: 0, log: [], lane: true }, 4)
  }
  expect(lineFor('deadpool', -3).text.length).toBeGreaterThan(2)
  expect(lineFor('thor', -1).text).not.toContain('undefined')
})

test('the spend shows at every width, idle and working', async () => {
  const who = { name: 'a-long-session-name', model: 'opus' }, usage = { percent: 50, tokens: 1, cost: 12.34 }
  const textOf = (s: Surface) => { const w = encode(s.cv, s.words); let t = ''; for (let i = 0; i < w.length; i += 3) t += String.fromCodePoint(w[i]!); return t }
  for (const cols of [40, 60, 80, 100, 180]) {
    const i = new Surface(cols, IDLE_ROWS)
    drawIdle(i.cv, who, usage)
    expect(textOf(i)).toContain('$12.34')
    const s = new Surface(cols, WORK_ROWS)
    drawWorking(s.cv, { who, usage, calm: false, act: 'hulk', actAt: 0, tool: 'Bash', detail: 'x', line: 'y', lineAt: 0, elapsed: '1s', tools: 0, log: [], lane: true }, 1)
    expect(textOf(s)).toContain('$12.34')
  }
})

test('a failed tool mid-turn does not stop the work: no moment until the task ends', async ($, on) => {
  const clock = session(on, { _MODEL: 'sonnet' }, () => ({ result: { ok: false }, isError: true }))
  await ($ as any).session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
  await clock.advance(4000)
  await ($ as any).turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /secret-path' } as any)
  await clock.advance(500)
  const b = await band($, { isWorking: true })
  expect(b.text).toContain('MISSION LOG') // the work band, not a moment
  expect(b.text.split('\n')[0]).not.toContain('secret-path') // the header never shows a command
})
