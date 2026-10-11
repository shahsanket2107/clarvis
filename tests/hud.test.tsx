import { expect, mock } from 'claude-code/testing'
import { test } from './timed'
import { MOMENT_ROWS, MOMENT_SECONDS, WORK_ROWS, IDLE_ROWS } from '../hooks/scenes'
import { footerRow } from '../hooks/art'
import { COMMANDS } from '../hooks/register'
import { statsText, newStats } from '../hooks/metrics'
import {
  CMD_GROUPS, FURY_LINES, LITE_HINT, WELCOME_TOAST, briefing, demoDone, demoPhaseAt, demoWork, endCaption, furyLine, liteRows, needsLite, DEMO_WORK_S,
  parseNotify, notifyChoice, notifyBody,
} from '../hooks/hud'
import { DONE } from '../hooks/lines'
import * as B from '../hooks/baked'

// ── helpers (the same shape as the band tests') ─────────────────────────────
const flat = (n: any): string => typeof n === 'string' ? n : !n ? '' : (n.children ?? []).map(flat).join(n.props?.flexDirection === 'column' ? '\n' : '')
const findRaster = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(findRaster).find(Boolean))
function rasterText(n: any): string {
  const r = findRaster(n)
  if (!r) return ''
  const bin = atob(r.props.cells), u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  const w = new Uint32Array(u8.buffer)
  const out: string[] = []
  for (let y = 0; y < r.props.rows; y++) { let s = ''; for (let x = 0; x < r.props.columns; x++) s += String.fromCodePoint(w[(y * r.props.columns + x) * 3]!); out.push(s) }
  return out.join('\n')
}
const band = async ($: any, props: Record<string, unknown> = {}) => {
  const m = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { bodyRows: 19 }, view: {}, ...props } })
  const d = await m.drawn()
  return { tree: d, raster: findRaster(d), rows: findRaster(d)?.props.rows as number | undefined, text: findRaster(d) ? rasterText(d) : flat(d) }
}
type Opts = { usage?: () => any; env?: Record<string, string>; cost?: number; durations?: number[]; toasts?: string[]; notes?: { text: string; title?: string }[]; reg?: any[]; blits?: { n: number }; open?: () => any; tool?: (e: any) => any }
function session(on: any, o: Opts = {}) {
  mock.store(on)
  mock.env(on, { COLORTERM: 'truecolor', CLARVIS_EGG: 'never', ...(o.env ?? {}) })
  const clock = mock.clock(on, { now: 0 })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'sonnet' }))
  on('session.end', (_$: any, e: any) => ({ sessionId: e.sessionId }))
  on('session.usage', o.usage ?? (() => ({ value: { startedAt: 0, cost: { usd: o.cost ?? 1.5 }, context: { window: 200000, percent: 41, tokens: 82400 }, rateLimits: [] } })))
  on('command.register', (_$: any, e: any) => { o.reg?.push(e); return { value: undefined } })
  on('ui.blit', () => { if (o.blits) o.blits.n++; return { value: {} } })
  on('ui.toast', (_$: any, e: any) => { o.toasts?.push(e.text ?? JSON.stringify(e)); return { value: undefined } })
  on('ui.notify', (_$: any, e: any) => { o.notes?.push({ text: e.text, title: e.title }); return { value: { isSent: true, channel: 'x' } } as any })
  on('ui.notice', () => ({ value: undefined }))
  on('ui.open', o.open ?? (() => ({ value: { isPlaced: true } }) as any))
  on('tool.call', (_$: any, e: any) => (o.tool ? o.tool(e) : { result: { ok: true } }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '', reason: 'answer' }) as any)
  return clock
}
const start = ($: any) => $.session.start({ cwd: '/work/auth-api', surface: 'terminal', isInteractive: true })
const hero = ($: any, args: string, presentation?: any) => $.command.run({ command: 'clarvis', args, ...(presentation ? { presentation } : {}) } as any).then((r: any) => String(r?.text ?? JSON.stringify(r)))
const begin = ($: any) => $.turn.start({ text: 'go', turnId: 't1' })
const done = ($: any, o: Record<string, unknown> = {}) => $.turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: 't1', reason: 'answer', ...o })

// ── A. first run and help ───────────────────────────────────────────────────
test('the briefing card is grouped, data-driven, and lists only commands that exist', () => {
  const t = briefing({ mode: 'full', cmds: COMMANDS })
  for (const g of ['LOOK', 'PLAY', 'STATS']) expect(t).toContain(g)
  expect(t).toContain('HERO\n') // the Hero group has rows now
  for (const there of ['card', 'trophies', 'pick', 'team', 'sound', 'notify']) expect(t).toMatch(new RegExp(`/clarvis ${there}\\b`))
  const lines = t.split('\n')
  expect(lines.every(l => [...l].length <= 90)).toBe(true)
  expect(briefing({ mode: 'full', cmds: COMMANDS.filter(c => c.group !== 'Hero') })).not.toContain('HERO\n') // no rows, no empty group
  for (const c of COMMANDS) expect(t).toContain(`/clarvis ${c.usage}`)
  // a command added to the table shows up with no other change
  const more = briefing({ mode: 'calm', cmds: [...COMMANDS, { id: 'x', group: 'Hero', names: ['pick'], tag: 'pick', usage: 'pick <name>', summary: 'choose your hero' }] })
  expect(more).toContain('HERO')
  expect(more).toContain('/clarvis pick <name>')
  expect(more).toContain('calm')
  expect(CMD_GROUPS).toEqual(['Look', 'Play', 'Stats', 'Hero'])
})

test('the fullscreen hint shows only when the presentation says it is not fullscreen', () => {
  expect(briefing({ mode: 'full', cmds: COMMANDS, fullscreen: false })).toContain('/tui fullscreen')
  expect(briefing({ mode: 'full', cmds: COMMANDS, fullscreen: true })).not.toContain('/tui fullscreen')
  expect(briefing({ mode: 'full', cmds: COMMANDS })).not.toContain('/tui fullscreen')
})

test('/clarvis alone returns the briefing with the mode; the hint follows the presentation', async ($, on) => {
  session(on); await start($)
  const t = await hero($, '', { isFullscreen: true, columns: 120 })
  expect(t).toContain('CLARVIS · full')
  expect(t).toContain('/clarvis full|calm|lite|off')
  expect(t).not.toContain('/tui fullscreen')
  expect(await hero($, '', { isFullscreen: false, columns: 120 })).toContain('/tui fullscreen')
})

test('an unknown /clarvis argument names it and points at the list; nothing changes', async ($, on) => {
  session(on); await start($)
  expect(await hero($, 'banana split')).toBe('No /clarvis command "banana". Type /clarvis for the list.')
  expect(await hero($, 'FULLY')).toContain('No /clarvis command "FULLY"')
  expect(await hero($, '')).toContain('CLARVIS · full')
})

test('the command is registered with a short, data-driven description and hint', async ($, on) => {
  const reg: any[] = []
  session(on, { reg }); await start($)
  const r = reg[0]
  expect(r.name).toBe('clarvis')
  expect(r.description.startsWith('Clarvis: ')).toBe(true)
  expect(r.description.length).toBeLessThanOrEqual(90)
  for (const w of ['full', 'calm', 'lite', 'off', 'play', 'movies', 'stats', 'demo']) { expect(r.description).toContain(w); expect(r.argumentHint).toContain(w) }
  expect(r.description + r.argumentHint).not.toContain('Avengers UI')
})

test('first run: one welcome toast ever, and the boot says where to start', async ($, on) => {
  const toasts: string[] = []
  const clock = session(on, { toasts }); await start($)
  expect(toasts).toEqual([WELCOME_TOAST])
  await band($)
  await clock.advance(2300)
  expect((await band($)).text).toContain('Type /clarvis.')
  await start($) // a second session: no toast, the plain boot
  expect(toasts.length).toBe(1)
  await band($); await clock.advance(2300)
  expect((await band($)).text).not.toContain('Type /clarvis.')
})

test('first run in the stock look says nothing and is not used up', async ($, on) => {
  const toasts: string[] = []
  session(on, { env: { CLARVIS: 'off' }, toasts }); await start($)
  expect(toasts).toEqual([])
})

test('a pane that cannot be placed says the engine\'s own reason, in the reply and the toast', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts, open: () => ({ value: { isPlaced: false, reason: 'the floor is 144 columns; this is 90' } }) as any }); await start($)
  const t = await hero($, 'play', { isFullscreen: true, columns: 90 })
  expect(t).toContain('the floor is 144 columns; this is 90')
  expect(t).not.toContain('is up')
  expect(toasts.join(' ')).toContain('the floor is 144 columns; this is 90')
  expect(await hero($, 'movies', { isFullscreen: true, columns: 90 })).toContain('the floor is 144 columns; this is 90')
})

// ── B. lite mode and the colour check ───────────────────────────────────────
test('needsLite: truecolor and 24bit pass; anything else, Terminal.app and bare tmux do not', () => {
  expect(needsLite({ colorterm: 'truecolor' })).toBe(false)
  expect(needsLite({ colorterm: '24BIT' })).toBe(false)
  expect(needsLite({})).toBe(true)
  expect(needsLite({ colorterm: 'yes' })).toBe(true)
  expect(needsLite({ colorterm: 'truecolor', termProgram: 'Apple_Terminal' })).toBe(true)
  expect(needsLite({ colorterm: 'truecolor', tmux: '/tmp/tmux-1/default,1,0' })).toBe(true)
  expect(needsLite({ colorterm: 'truecolor', tmux: '/tmp/tmux-1/default,1,0', tmuxTruecolor: '1' })).toBe(false)
  expect(needsLite({ colorterm: 'truecolor', tmux: '', termProgram: 'iTerm.app' })).toBe(false)
})

test('liteRows: one row idle, two working; cost hidden on request; always fits', () => {
  const base = { name: 'auth-api', model: 'sonnet', percent: 41, tokens: 82_400, cost: 1.5, showCost: true, pieces: [{ text: '↑120k ↓3.1k', tone: 'steel' as const }], cols: 100 }
  const idle = liteRows(base)
  expect(idle.length).toBe(1)
  const text = (r: any) => r.map((s: any) => s.text).join('')
  expect(text(idle[0])).toContain('auth-api')
  expect(text(idle[0])).toContain('standing by')
  expect(text(idle[0])).toContain('$1.50 spent')
  const work = liteRows({ ...base, work: { hero: 'IRON MAN', tool: 'Edit', detail: 'src/a.ts' } })
  expect(work.length).toBe(2)
  expect(text(work[1])).toBe('▸ IRON MAN · Edit src/a.ts')
  expect(text(liteRows({ ...base, showCost: false })[0])).not.toContain('$')
  for (const cols of [10, 16, 30, 60, 200]) for (const r of liteRows({ ...base, work: { hero: 'IRON MAN', tool: 'Edit', detail: 'x'.repeat(200) }, cols })) expect([...text(r)].length).toBeLessThanOrEqual(Math.max(10, cols - 1))
})

test('CLARVIS=lite: text rows, no Raster, no clock, the hero and tool while working', async ($, on) => {
  const blits = { n: 0 }
  const clock = session(on, { env: { CLARVIS: 'lite' }, blits }); await start($)
  const idle = await band($)
  expect(idle.raster).toBeUndefined()
  expect(idle.text).toContain('auth-api')
  expect(idle.text).toContain('standing by')
  expect(idle.text).toContain('$1.50 spent')
  await begin($)
  await $.tool.call({ tool: 'Edit', file_path: '/w/src/a.ts' } as any)
  const w = await band($, { isWorking: true })
  expect(w.raster).toBeUndefined()
  expect(w.text).toContain('at work')
  expect(w.text).toContain('IRON MAN')
  expect(w.text).toContain('Edit')
  await clock.advance(30_000)
  await done($)
  await clock.advance(30_000)
  expect(blits.n).toBe(0) // no motion clock: nothing is ever painted
  expect((await band($)).text).toContain('standing by')
})

test('lite folds the spinner into the band; the footer still reports the mission', async ($, on) => {
  session(on, { env: { CLARVIS: 'lite' } }); await start($)
  await begin($)
  const sp = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'Spinner', viewport: { columns: 120, rows: 40 }, props: { word: 'x', message: null, suffix: '…', mode: 'thinking' } })
  expect(flat(await sp.drawn())).toBe('')
  const f = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'TurnDuration', viewport: { columns: 120, rows: 40 }, props: { word: 'x', durationMs: 9000 } })
  expect(flat(await f.drawn())).toContain('✓ Mission complete in 9s')
})

test('lite plays no moment at the end of a turn and has no boot', async ($, on) => {
  const clock = session(on, { env: { CLARVIS: 'lite' } }); await start($)
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/a' } as any); await done($)
  await clock.advance(1000)
  const b = await band($)
  expect(b.raster).toBeUndefined()
})

test('/clarvis lite switches live, is remembered, and /clarvis full comes back to the art', async ($, on) => {
  session(on); await start($)
  expect(await hero($, 'lite')).toContain('Clarvis: lite')
  expect((await band($)).raster).toBeUndefined()
  await start($) // a new session keeps it
  expect((await band($)).raster).toBeUndefined()
  expect(await hero($, '')).toContain('CLARVIS · lite')
  await hero($, 'full')
  expect((await band($)).raster).toBeDefined()
})

test('lite: off leaves the stock UI, calm leaves lite', async ($, on) => {
  session(on, { env: {} })
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>stock-band</Text> })
  await start($)
  await hero($, 'lite'); await hero($, 'calm')
  expect((await band($)).raster).toBeDefined()
  await hero($, 'lite'); await hero($, 'off')
  expect((await band($)).text).toContain('stock-band')
})

test('a 256-colour terminal and no choice yet: lite, with one toast ever', async ($, on) => {
  const toasts: string[] = []
  session(on, { env: { COLORTERM: '' }, toasts }); await start($)
  expect(toasts).toContain(LITE_HINT)
  expect(await hero($, '')).toContain('CLARVIS · lite')
  await start($)
  expect(toasts.filter(t => t === LITE_HINT).length).toBe(1)
  expect(await hero($, '')).toContain('CLARVIS · lite') // a guess is never stored as a choice
})

test('terminals that look 256-colour: Terminal.app and tmux without CLAUDE_CODE_TMUX_TRUECOLOR', async ($, on) => {
  session(on, { env: { TERM_PROGRAM: 'Apple_Terminal' } }); await start($)
  expect(await hero($, '')).toContain('CLARVIS · lite')
})
test('tmux is lite unless CLAUDE_CODE_TMUX_TRUECOLOR=1', async ($, on) => {
  session(on, { env: { TMUX: '/tmp/tmux-1/default,1,0' } }); await start($)
  expect(await hero($, '')).toContain('CLARVIS · lite')
})
test('tmux with CLAUDE_CODE_TMUX_TRUECOLOR=1 is full', async ($, on) => {
  session(on, { env: { TMUX: '/tmp/tmux-1/default,1,0', CLAUDE_CODE_TMUX_TRUECOLOR: '1' } }); await start($)
  expect(await hero($, '')).toContain('CLARVIS · full')
})

test('truecolor with no choice starts full, no lite toast', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts }); await start($)
  expect(await hero($, '')).toContain('CLARVIS · full')
  expect(toasts).not.toContain(LITE_HINT)
})

test('a chosen mode is never overridden by the colour check: env, stored choice, then the option', async ($, on) => {
  session(on, { env: { COLORTERM: '', CLARVIS: 'full' } }); await start($)
  expect(await hero($, '')).toContain('CLARVIS · full')
})
test('a stored choice beats the colour check', async ($, on) => {
  session(on, { env: { COLORTERM: '' } }); await start($)
  await hero($, 'full')
  await start($)
  expect(await hero($, '')).toContain('CLARVIS · full')
})

// ── K. userConfig ───────────────────────────────────────────────────────────
test('the mode option sets the starting look; auto means the colour check', { options: { mode: 'calm' } } as any, async ($, on) => {
  session(on); await start($)
  expect(await hero($, '')).toContain('CLARVIS · calm')
})
test('precedence: CLARVIS beats a stored choice beats the mode option', { options: { mode: 'calm' } } as any, async ($, on) => {
  session(on, { env: { CLARVIS: 'lite' } }); await start($)
  expect(await hero($, '')).toContain('CLARVIS · lite')
})
test('a stored /clarvis choice beats the mode option', { options: { mode: 'calm' } } as any, async ($, on) => {
  session(on); await start($)
  await hero($, 'full')
  await start($)
  expect(await hero($, '')).toContain('CLARVIS · full')
})
test('the mode option beats the colour check', { options: { mode: 'full' } } as any, async ($, on) => {
  session(on, { env: { COLORTERM: '' } }); await start($)
  expect(await hero($, '')).toContain('CLARVIS · full')
})
test('mode auto (the default) leaves the colour check in charge', { options: { mode: 'auto' } } as any, async ($, on) => {
  session(on, { env: { COLORTERM: '' } }); await start($)
  expect(await hero($, '')).toContain('CLARVIS · lite')
})

test('showCost off: no dollar sign in the idle line, the working line, ASSEMBLE or the stats', { options: { showCost: false } } as any, async ($, on) => {
  let cost = 1
  const clock = session(on, { usage: () => ({ value: { startedAt: 0, cost: { usd: cost }, context: { window: 1, percent: 41, tokens: 5000 }, rateLimits: [] } }) })
  await start($); await band($); await clock.advance(4000)
  expect((await band($)).text).not.toContain('$')
  await begin($)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  cost = 2.5
  await clock.advance(1000)
  expect((await band($, { isWorking: true })).text).not.toContain('$')
  await done($, { durationMs: 9000 })
  await clock.advance(3000)
  const m = await band($)
  expect(m.rows).toBe(MOMENT_ROWS.assemble)
  expect(m.text).toContain('mission complete')
  expect(m.text).not.toContain('$')
  const st = await hero($, 'stats')
  expect(st).not.toContain('$')
  expect(st).not.toContain('COST')
})
test('showCost on (the default) keeps the dollars', async ($, on) => {
  const clock = session(on); await start($); await band($); await clock.advance(4000)
  expect((await band($)).text).toContain('$1.50')
  expect(await hero($, 'stats')).toContain('COST')
})
test('showCost off in lite hides the dollars too', { options: { showCost: false } } as any, async ($, on) => {
  session(on, { env: { CLARVIS: 'lite' } }); await start($)
  expect((await band($)).text).not.toContain('$')
})
test('statsText: showCost false drops the money rows', () => {
  const t = statsText({ stats: newStats(), now: 0, costUsd: 4, lifetime: { cost: 9 }, showCost: false })
  expect(t).not.toContain('$'); expect(t).not.toContain('burn rate'); expect(t).toContain('output speed')
})

test('notifyAfterMinutes: a long mission notifies once, with the title; a short one does not', { options: { notifyAfterMinutes: 2 } } as any, async ($, on) => {
  const notes: { text: string; title?: string }[] = []
  session(on, { notes }); await start($)
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/a' } as any); await $.tool.call({ tool: 'Read', file_path: '/b' } as any)
  await done($, { durationMs: 119_000 })
  expect(notes).toEqual([])
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($, { durationMs: 432_000 })
  expect(notes).toEqual([{ text: 'Mission complete, sir. 7m 12s · 1 action', title: 'Clarvis' }])
  await begin($)
  await done($, { durationMs: 500_000, reason: 'error', answer: '' })
  expect(notes.length).toBe(1) // a failed turn is not a completed mission
})
test('notifyAfterMinutes defaults to off', async ($, on) => {
  const notes: any[] = []
  session(on, { notes }); await start($)
  await begin($); await done($, { durationMs: 3_600_000 })
  expect(notes).toEqual([])
})
test('notifyAfterMinutes counts actions in the text', { options: { notifyAfterMinutes: 1 } } as any, async ($, on) => {
  const notes: { text: string }[] = []
  session(on, { notes }); await start($)
  await begin($)
  for (let i = 0; i < 41; i++) await $.tool.call({ tool: 'Read', file_path: `/a${i}` } as any)
  await done($, { durationMs: 432_000 })
  expect(notes[0]!.text).toBe('Mission complete, sir. 7m 12s · 41 actions')
})
test('notifications are not sent in the stock look', { options: { notifyAfterMinutes: 1 } } as any, async ($, on) => {
  const notes: any[] = []
  session(on, { notes, env: { CLARVIS: 'off' } }); await start($)
  await begin($); await done($, { durationMs: 600_000 })
  expect(notes).toEqual([])
})

test('the CLAUVENGERS, ASSEMBLE! wordmark fits a 140-column band beside the logo; narrower bands get ASSEMBLE! and it fits 100', () => {
  const wx = 1 + B.logo.w / 2 + 3 // scenes.ts assemble(): where the word starts
  expect(wx + B.wordAssembleLine.w / 2 + 2).toBeLessThan(140)
  expect(B.wordAssembleLine.w).toBeGreaterThan(B.wordAssemble.w) // the full title is the longer one
  expect(wx + B.wordAssemble.w / 2).toBeLessThan(100)
})

// ── /clarvis notify <minutes|off> ───────────────────────────────────────────
const bashOut = (stdout: string) => (e: any) => (e.tool === 'Bash' ? { result: { stdout, stderr: '' } } : { result: { ok: true } })
test('/clarvis notify: parseNotify takes minutes or off, and nothing else', () => {
  expect(parseNotify('5')).toBe(5); expect(parseNotify(' 5 min ')).toBe(5); expect(parseNotify('0.5')).toBe(0.5)
  expect(parseNotify('off')).toBe(0); expect(parseNotify('OFF')).toBe(0); expect(parseNotify('0')).toBe(0)
  expect(parseNotify('99999')).toBe(1440)
  for (const bad of ['', 'soon', '-3', '5x', '1e3', 'NaN', 'Infinity']) expect(parseNotify(bad)).toBeUndefined()
})
test('/clarvis notify: the stored choice beats the option, and junk in the store is ignored', () => {
  expect(notifyChoice(3, 10)).toBe(3); expect(notifyChoice(0, 10)).toBe(0)
  for (const junk of [undefined, null, 'x', -1, NaN, Infinity, 99999, {}]) expect(notifyChoice(junk, 10)).toBe(10)
})
test('notifyBody: duration and actions, plus the ship-it fact when there is one', () => {
  expect(notifyBody(432_000, '41 actions')).toBe('Mission complete, sir. 7m 12s · 41 actions')
  expect(notifyBody(432_000, '41 actions', { tests: { pass: 5, unit: 'tests' } })).toBe('Mission complete, sir. 7m 12s · 41 actions · tests green')
  expect(notifyBody(432_000, '41 actions', { commit: 'abc1234' })).toBe('Mission complete, sir. 7m 12s · 41 actions · commit abc1234')
})
test('/clarvis notify 5 confirms, persists to the next session, and pings at 5 minutes', async ($, on) => {
  const notes: { text: string; title?: string }[] = []
  session(on, { notes }); await start($)
  expect(await hero($, 'notify')).toContain('notifications are off')
  expect(await hero($, 'notify 5')).toBe('Clarvis will ping you when a mission runs 5+ minutes.')
  await begin($); await done($, { durationMs: 299_000 })
  expect(notes).toEqual([])
  await begin($); await done($, { durationMs: 300_000 })
  expect(notes).toEqual([{ text: 'Mission complete, sir. 5m 00s · 0 actions', title: 'Clarvis' }])
  await start($) // the next session reads the stored choice
  await begin($); await done($, { durationMs: 400_000 })
  expect(notes.length).toBe(2)
  expect(await hero($, 'notify')).toContain('5+ minutes')
})
test('/clarvis notify beats the option both ways: a stored value over it, and off over a positive option', { options: { notifyAfterMinutes: 2 } } as any, async ($, on) => {
  const notes: { text: string }[] = []
  session(on, { notes }); await start($)
  await begin($); await done($, { durationMs: 150_000 })
  expect(notes.length).toBe(1) // the option alone
  expect(await hero($, 'notify 10')).toContain('10+ minutes')
  await begin($); await done($, { durationMs: 150_000 })
  expect(notes.length).toBe(1)
  expect(await hero($, 'notify off')).toContain('will not send')
  await begin($); await done($, { durationMs: 3_600_000 })
  expect(notes.length).toBe(1)
  await start($) // off is stored too
  await begin($); await done($, { durationMs: 3_600_000 })
  expect(notes.length).toBe(1)
})
test('/clarvis notify with a bad value says how to use it and changes nothing', async ($, on) => {
  const notes: any[] = []
  session(on, { notes }); await start($)
  await hero($, 'notify 1')
  expect(await hero($, 'notify soon')).toContain('Use /clarvis notify <minutes|off>')
  await begin($); await done($, { durationMs: 90_000 })
  expect(notes.length).toBe(1)
})
test('the notification carries "tests green" or the commit when the turn shipped one', async ($, on) => {
  const notes: { text: string }[] = []
  session(on, { notes, tool: bashOut('[main abc1234] fix auth\n 1 file changed\n') }); await start($)
  await hero($, 'notify 1')
  await begin($); await $.tool.call({ tool: 'Bash', command: 'git commit -m x' } as any); await done($, { durationMs: 432_000 })
  expect(notes[0]!.text).toBe('Mission complete, sir. 7m 12s · 1 action · commit abc1234')
  await begin($); await done($, { durationMs: 432_000 })
  expect(notes[1]!.text).toBe('Mission complete, sir. 7m 12s · 0 actions') // the ship-it fact is per turn
})
test('the notification says "tests green" for a green run', async ($, on) => {
  const notes: { text: string }[] = []
  session(on, { notes, tool: bashOut(' 404 pass\n 0 fail\n') }); await start($)
  await hero($, 'notify 1')
  await begin($); await $.tool.call({ tool: 'Bash', command: 'bun test' } as any); await done($, { durationMs: 432_000 })
  expect(notes[0]!.text).toBe('Mission complete, sir. 7m 12s · 1 action · tests green')
})

// ── E. success is ASSEMBLE only ─────────────────────────────────────────────
test('a successful turn plays ASSEMBLE at once, never the snap', async ($, on) => {
  const clock = session(on); await start($); await band($); await clock.advance(4000)
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($, { durationMs: 9000 })
  await clock.advance(300)
  const b = await band($)
  expect(b.rows).toBe(MOMENT_ROWS.assemble)
  expect(b.text).not.toContain('the work is done')
  await clock.advance(MOMENT_SECONDS.assemble * 1000 + 500)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})
test('an error turn snaps, and ASSEMBLE does not follow it', async ($, on) => {
  const clock = session(on); await start($); await band($); await clock.advance(4000)
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($, { durationMs: 9000, reason: 'error', answer: '' })
  await clock.advance(300)
  expect((await band($)).rows).toBe(MOMENT_ROWS.snap)
  await clock.advance(MOMENT_SECONDS.snap * 1000 + 500)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})
test('calm plays ASSEMBLE alone as well', async ($, on) => {
  const clock = session(on, { env: { CLARVIS: 'calm' } }); await start($); await clock.advance(4000)
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($, { durationMs: 9000 })
  await clock.advance(300)
  expect((await band($)).rows).toBe(MOMENT_ROWS.assemble)
})
test('Fury\'s caption pool: 5 to 8 distinct short lines; they rotate; the caption is chosen in one place', () => {
  expect(FURY_LINES.length).toBeGreaterThanOrEqual(5); expect(FURY_LINES.length).toBeLessThanOrEqual(8)
  expect(new Set(FURY_LINES).size).toBe(FURY_LINES.length)
  for (const l of FURY_LINES) { expect([...l].length).toBeLessThanOrEqual(42); expect(l).not.toMatch(/donut|exit/i) }
  const seen = new Set(FURY_LINES.map((_, i) => furyLine(i)))
  expect(seen.size).toBe(FURY_LINES.length)
  expect(furyLine(-3)).toBe(furyLine(3)); expect(furyLine(NaN)).toBe(furyLine(0))
  expect(endCaption('fury', { n: 2, pool: DONE })).toBe(furyLine(2))
  expect(endCaption('done', { n: 1, pool: DONE })).toBe(DONE[1])
  expect(endCaption('done', { n: 1, big: true, pool: DONE })).toBe('"I am Iron Man."')
})
test('Fury asks with a line from the pool', async ($, on) => {
  const clock = session(on); await start($); await band($); await clock.advance(4000)
  await begin($)
  await done($, { answer: 'Should I go on?' })
  await clock.advance(3000)
  const b = await band($)
  expect(b.rows).toBe(MOMENT_ROWS.fury)
  expect(FURY_LINES.some(l => b.text.includes(l.slice(0, 20)))).toBe(true)
  expect(b.text).not.toContain('donut')
})
test('the footer says ✓ Mission complete (and keeps the failed and aborted forms)', () => {
  const t = (r: any[]) => r.map(s => s.text).join('')
  expect(t(footerRow(9000, 2, 'done'))).toBe('✓ Mission complete in 9s · 2 tools')
  expect(t(footerRow(9000, 0, 'failed'))).toContain('Snapped')
  expect(t(footerRow(9000, 0, 'aborted'))).toContain('Stood down')
  expect(t(footerRow(9000, 0, 'done'))).not.toContain('Ⓐ')
})

// ── C. /clarvis demo ───────────────────────────────────────────────────────────
test('demoPhaseAt walks boot, work, assemble, snap, fury, done', () => {
  const b = MOMENT_SECONDS.boot, a = MOMENT_SECONDS.assemble, s = MOMENT_SECONDS.snap
  const at = (t: number) => demoPhaseAt(t, MOMENT_SECONDS)
  expect([0, b - 0.1, b, b + DEMO_WORK_S - 0.1, b + DEMO_WORK_S, b + DEMO_WORK_S + a, b + DEMO_WORK_S + a + s, b + DEMO_WORK_S + a + s + 3].map(at))
    .toEqual(['boot', 'boot', 'work', 'work', 'assemble', 'snap', 'fury', 'done'])
  expect(at(NaN)).toBe('boot')
  expect(b + DEMO_WORK_S + a + s + 3).toBeGreaterThan(41); expect(b + DEMO_WORK_S + a + s + 3).toBeLessThan(47)
})
test('demoWork opens on Iron Man suiting up, then Thor, Loki, Spider-Man and Star-Lord, 6 s each, and a log that grows', () => {
  expect([0, 5.9, 6, 12, 18, 24, 29.9].map(t => demoWork(t).cast)).toEqual(['thinking', 'thinking', 'thor', 'loki', 'spidey', 'starlord', 'starlord'])
  expect(demoWork(30).log.length).toBe(3); expect(demoWork(29.9).tool).toBe('Bash')
  expect(demoWork(0).log.length).toBe(1); expect(demoWork(9).log.length).toBe(3)
  expect(demoWork(NaN).tools).toBeGreaterThan(0)
})
test('demo sample numbers have a cost only when costs show', () => {
  expect(demoDone(true)).toContain('$1.84'); expect(demoDone(false)).not.toContain('$')
})

test('/clarvis demo plays boot, a working band, ASSEMBLE with sample numbers, snap, Fury, then idle', async ($, on) => {
  const clock = session(on); await start($); await band($); await clock.advance(4000)
  const r = await hero($, 'demo')
  expect(r).toContain('demo')
  await clock.advance(300)
  expect((await band($)).rows).toBe(MOMENT_ROWS.boot)
  await clock.advance(MOMENT_SECONDS.boot * 1000 + 2500)
  const w = await band($)
  expect(w.rows).toBe(WORK_ROWS)
  expect(w.text).toMatch(/◢ [A-Z]/)
  expect(w.text).toContain('MISSION LOG')
  await clock.advance(DEMO_WORK_S * 1000 - 2500 + 3000) // into ASSEMBLE, past the logo's gathering
  const a = await band($)
  expect(a.rows).toBe(MOMENT_ROWS.assemble)
  expect(a.text).toContain('7m 12s')
  expect(a.text).toContain('41 actions')
  await clock.advance(MOMENT_SECONDS.assemble * 1000 - 3000 + 300)
  expect((await band($)).rows).toBe(MOMENT_ROWS.snap)
  await clock.advance(MOMENT_SECONDS.snap * 1000)
  expect((await band($)).rows).toBe(MOMENT_ROWS.fury)
  await clock.advance(3500)
  expect((await band($)).rows).toBe(IDLE_ROWS)
  await clock.advance(5000)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})
test('demo changes no lifetime or session total', async ($, on) => {
  const clock = session(on); await start($); await band($); await clock.advance(4000)
  const strip = (s: string) => s.replace(/elapsed\s+\S+/, '')
  const before = strip(await hero($, 'stats'))
  await hero($, 'demo')
  await clock.advance(25_000)
  expect(strip(await hero($, 'stats'))).toBe(before)
})
test('the next real prompt ends the demo', async ($, on) => {
  const clock = session(on); await start($); await band($); await clock.advance(4000)
  await hero($, 'demo')
  await clock.advance(MOMENT_SECONDS.boot * 1000 + 2000)
  expect((await band($)).text).toContain('MISSION LOG')
  await begin($)
  await clock.advance(1200)
  const w = await band($, { isWorking: true })
  expect(w.text).not.toContain('src/auth/session.ts')
  await done($, { durationMs: 1000 })
  await clock.advance(25_000)
  expect((await band($)).rows).toBe(IDLE_ROWS) // the showreel does not resume behind the real turn
})
for (const m of ['calm', 'lite', 'off']) test(`demo needs full mode (${m})`, async ($, on) => {
  session(on, { env: { CLARVIS: m } }); await start($)
  expect(await hero($, 'demo')).toContain('needs full mode')
})
test('demo is refused while a mission is running', async ($, on) => {
  session(on); await start($); await begin($)
  expect(await hero($, 'demo')).toContain('mission is running')
})
test('switching away from full cancels the demo', async ($, on) => {
  const clock = session(on); await start($); await band($); await clock.advance(4000)
  await hero($, 'demo'); await clock.advance(500)
  await hero($, 'calm')
  await clock.advance(1000)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

// ── L. transcript echo is opt-in ────────────────────────────────────────────
const pane = ($: any) => $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'Pane', requestId: 'avengers-theater', props: { title: 'AVENGERS THEATER', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { bodyRows: 30, offset: 0 }, view: {} }, viewport: { columns: 140, rows: 40, isFullscreen: true } })
const msgTree = async ($: any) => JSON.stringify(await (await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AssistantMessage', props: { text: 'hi', isFirstOfReply: true }, viewport: { columns: 120, rows: 40, isFullscreen: true } })).drawn())
test('fx default: a theater burst does not tint the transcript until /clarvis fx on', async ($, on) => {
  const clock = session(on)
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>hello stock</Text> })
  await start($)
  await clock.advance(4000)
  const pm = await pane($)
  expect(await hero($, 'fx')).toContain('Transcript FX are off')
  const base = await msgTree($)
  await pm.post({ fx: 'THOR' } as any, { in: 'theater' })
  expect(await msgTree($)).toBe(base)
  expect(await hero($, 'fx on')).toContain('Transcript FX on')
  await clock.advance(25_000)
  await pm.post({ fx: 'THOR' } as any, { in: 'theater' })
  expect(await msgTree($)).not.toBe(base)
  await start($) // persisted
  expect(await hero($, 'fx')).toContain('Transcript FX are on')
})
test('the theater\'s own bursts stay on with transcript FX off', async ($, on) => {
  session(on); await start($)
  const pm = await pane($)
  expect(JSON.stringify(await pm.drawn())).toContain('"fx":true')
})

// ── M. naming ───────────────────────────────────────────────────────────────
test('user-facing replies say Clarvis, not Avengers UI; the panes keep their in-fiction titles', async ($, on) => {
  session(on); await start($)
  const all = [await hero($, ''), await hero($, 'calm'), await hero($, 'off'), await hero($, 'full'), await hero($, 'lite'), await hero($, 'fx'), await hero($, 'x')].join('\n')
  expect(all).not.toContain('Avengers UI')
  expect(all).toContain('Clarvis')
  expect(await hero($, 'movies')).toContain('AVENGERS THEATER')
  expect(await hero($, 'play')).toContain('STARK ARCADE')
})
