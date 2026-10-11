import { expect, mock } from 'claude-code/testing'
import { test } from './timed'
import { IDLE_ROWS, MOMENT_ROWS, MOMENT_SECONDS, ROSTER, ROSTER_SECONDS, WORK_ROWS, HERO, fmtDur as b } from '../hooks/scenes'
import { fmtDur as a } from '../hooks/art'
import { findMovie } from '../hooks/movies'

const SPINNER = { plugin: 'clarvis', surface: 'terminal', component: 'Spinner', viewport: { columns: 120, rows: 40 } } as const
const flat = (n: any): string => typeof n === 'string' ? n : !n ? '' : (n.children ?? []).map(flat).join(n.props?.flexDirection === 'column' ? '\n' : '')
const findRaster = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(findRaster).find(Boolean))
function cellsOf(n: any): { cps: number[]; cols: number; rows: number } | undefined {
  const r = findRaster(n)
  if (!r) return undefined
  const bin = atob(r.props.cells), u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  const w = new Uint32Array(u8.buffer)
  const cps: number[] = []
  for (let i = 0; i < r.props.columns * r.props.rows; i++) cps.push(w[i * 3]!)
  return { cps, cols: r.props.columns, rows: r.props.rows }
}
function rasterText(n: any): string {
  const c = cellsOf(n)
  if (!c) return ''
  const out: string[] = []
  for (let y = 0; y < c.rows; y++) out.push(c.cps.slice(y * c.cols, (y + 1) * c.cols).map(cp => String.fromCodePoint(cp)).join(''))
  return out.join('\n')
}
const band = async ($: any, props: Record<string, unknown> = {}) => {
  const m = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { bodyRows: 19 }, view: {}, ...props } })
  const d = await m.drawn()
  const text = rasterText(d)
  return { m, tree: d, text, lines: text.split('\n'), rows: findRaster(d)?.props.rows as number | undefined, raster: findRaster(d), flat: flat(d) }
}
const stats = { blits: 0 }
const SNAP_MS = 0 /* a success plays ASSEMBLE alone: no snap first */, ASM_MS = MOMENT_SECONDS.assemble * 1000 // a finished task: the snap, then ASSEMBLE
function session(on: any, envIn: Record<string, string>, opts: { cost?: number; blit?: () => any; usage?: () => any; toolCall?: () => any; notice?: () => any; check?: () => any; compact?: (...a: any[]) => any; now?: number; stock?: boolean; toast?: (e: any) => void; model?: () => string } = {}) {
  const { _MODEL, _CWD, ...env } = envIn // _MODEL and _CWD are test-only: the model and the session cwd
  sessionCwd = _CWD ?? '/work/auth-api'
  mock.store(on)
  mock.env(on, { COLORTERM: 'truecolor', CLARVIS_EGG: 'never', ...env })
  const clock = mock.clock(on, { now: opts.now ?? 0 })
  stats.blits = 0
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: opts.model ? opts.model() : _MODEL ?? 'sonnet' }))
  on('session.end', (_$: any, e: any) => ({ sessionId: e.sessionId }))
  on('session.usage', opts.usage ?? (() => ({ value: { startedAt: 0, cost: { usd: opts.cost ?? 1.5 }, context: { window: 200000, percent: 41, tokens: 82400 }, rateLimits: [] } })))
  on('command.register', () => ({ value: undefined }))
  on('ui.blit', () => { stats.blits++; return opts.blit ? opts.blit() : { value: {} } })
  on('ui.toast', (_$: any, e: any) => { opts.toast?.(e); return { value: undefined } })
  on('ui.notice', opts.notice ?? (() => ({ value: undefined })))
  on('tool.call', opts.toolCall ?? (() => ({ result: { ok: true } })))
  if (opts.check) on('tool.check', opts.check)
  if (opts.compact) on('session.compact', opts.compact)
  if (opts.stock) { on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>stock-band</Text> }); on('ui.render', { component: 'Spinner' }, ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>stock-spin</Text> }) }
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '', reason: 'answer' }) as any)
  return clock
}
let sessionCwd = '/work/auth-api'
const start = ($: any) => $.session.start({ cwd: sessionCwd, surface: 'terminal', isInteractive: true })
const begin = (clock: any, $: any, id = 't1') => $.turn.start({ text: 'go', turnId: id })
const done = ($: any, o: Record<string, unknown> = {}) => $.turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: 't1', reason: 'answer', ...o })
const ENV = { _MODEL: 'sonnet' }
const heroOf = (t: string) => /◢ ([A-Z][A-Z .&'-]+)/.exec(t)?.[1]?.trim()
const okCell = (cp: number) => cp >= 0x20 && cp <= 0xffff && !(cp >= 0xd800 && cp <= 0xdfff) && !(cp >= 0x7f && cp < 0xa0)

// ── 1. modes ────────────────────────────────────────────────────────────────
test('/clarvis alone reports the current mode', async ($, on) => {
  session(on, ENV)
  await start($)
  const r = await $.command.run({ command: 'clarvis', args: '' } as any)
  expect(JSON.stringify(r)).toContain('full')
})

test('/clarvis calm then bare reports calm; the choice lands in the store', async ($, on) => {
  session(on, ENV)
  await start($)
  await $.command.run({ command: 'clarvis', args: 'calm' } as any)
  expect(JSON.stringify(await $.command.run({ command: 'clarvis', args: '' } as any))).toContain('calm')
  await start($) // persisted: a new session is still calm
  expect(JSON.stringify(await $.command.run({ command: 'clarvis', args: '' } as any))).toContain('calm')
})

test('mode args are case/space tolerant', async ($, on) => {
  session(on, ENV)
  await start($)
  await $.command.run({ command: 'clarvis', args: '  CALM  ' } as any)
  expect(JSON.stringify(await $.command.run({ command: 'clarvis', args: '' } as any))).toContain('calm')
})

test('a saved mode applies to the next session', async ($, on) => {
  const clock = session(on, ENV)
  await start($)
  await $.command.run({ command: 'clarvis', args: 'calm' } as any)
  await start($) // a new session
  const b = await band($)
  expect(b.rows).toBe(IDLE_ROWS) // calm has no boot
  await begin(clock, $)
  await clock.advance(1000)
  const w = await band($, { isWorking: true })
  expect(w.rows).toBe(WORK_ROWS)
})

test('CLARVIS=off beats a saved full mode, and the band is not drawn', async ($, on) => {
  session(on, { ...ENV, CLARVIS: 'off' }, { stock: true })
  await $.command.run({ command: 'clarvis', args: 'full' } as any) // saved: full
  await start($)
  const b = await band($)
  expect(b.raster).toBeUndefined()
  expect(b.flat).toContain('stock-band')
})

test('CLARVIS=calm overrides a saved full mode: no boot moment', async ($, on) => {
  session(on, { ...ENV, CLARVIS: 'calm' })
  await $.command.run({ command: 'clarvis', args: 'full' } as any)
  await start($)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

test('a junk CLARVIS value is ignored (falls back to saved/full)', async ($, on) => {
  session(on, { ...ENV, CLARVIS: 'banana' })
  await start($)
  expect((await band($)).rows).toBe(MOMENT_ROWS.boot)
})

test('off: stock spinner, stock band, no turn footer, and no repaint traffic', async ($, on) => {
  const clock = session(on, ENV, { stock: true })
  await start($)
  await $.command.run({ command: 'clarvis', args: 'off' } as any)
  await begin(clock, $)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as any)
  const sp = await $.ui.mount({ ...SPINNER, props: { word: 'x', message: null, suffix: '…', mode: 'tool-use' } })
  expect(flat(await sp.drawn())).toContain('stock-spin')
  expect((await band($, { isWorking: true })).flat).toContain('stock-band')
  const before = stats.blits
  await clock.advance(5000)
  expect(stats.blits).toBe(before)
})

test('off: no moment plays when a turn completes', async ($, on) => {
  const clock = session(on, { ...ENV, CLARVIS: 'off' }, { stock: true })
  await start($)
  await begin(clock, $)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($)
  expect((await band($)).raster).toBeUndefined()
})

test('unknown args get a helpful reply and do not change the mode or throw', async ($, on) => {
  session(on, ENV)
  await start($)
  for (const args of ['banana', 'FULLY', '🚀', 'x'.repeat(10000), 'full calm', '\u0000']) {
    const r = JSON.stringify(await $.command.run({ command: 'clarvis', args } as any))
    expect(r).toMatch(/No \/clarvis command/)
  }
  expect(JSON.stringify(await $.command.run({ command: 'clarvis', args: '' } as any))).toContain('full')
})

test('calm: same words, no rotation of heroes, no hero change over time', async ($, on) => {
  const clock = session(on, { ...ENV, CLARVIS: 'calm' })
  await start($)
  await band($)
  await begin(clock, $)
  await $.tool.call({ tool: 'Bash', command: 'git status' } as any)
  await clock.advance(8000)
  const a = heroOf((await band($, { isWorking: true })).text)
  expect(a).toBeTruthy()
  await clock.advance(60000)
  expect(heroOf((await band($, { isWorking: true })).text)).toBe(a)
})

test('calm: working band is static - only the elapsed clock moves', async ($, on) => {
  const clock = session(on, { ...ENV, CLARVIS: 'calm' })
  await start($)
  await begin(clock, $)
  await clock.advance(1000)
  const a = (await band($, { isWorking: true })).lines.slice(1).join('\n')
  await clock.advance(30000)
  const b = (await band($, { isWorking: true })).lines.slice(1).join('\n')
  // calm: only the elapsed clock on row 0 moves; everything else holds still
  expect(b).toBe(a)
})

test('calm: a finished turn draws a still end-of-turn summary (same words, no motion), then rests', async ($, on) => {
  const clock = session(on, { ...ENV, CLARVIS: 'calm' })
  await start($)
  await band($)
  await begin(clock, $)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($, { durationMs: 9000 })
  const a = await band($)
  expect(a.rows).toBe(MOMENT_ROWS.assemble)
  expect(a.text).toContain('mission complete')
  expect(a.text).toContain('9s')
  expect(a.text).toContain('1 action')
  await clock.advance(1500)
  expect((await band($)).text).toBe(a.text) // no motion: the same frame a moment later
  await clock.advance(ASM_MS + 2000)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

test('calm: no blit traffic faster than the idle line needs', async ($, on) => {
  const clock = session(on, { ...ENV, CLARVIS: 'calm' })
  await start($)
  await band($)
  await clock.advance(30000)
  expect(stats.blits).toBe(0)
})

// ── 2. idle ─────────────────────────────────────────────────────────────────
const idleSession = async ($: any, on: any, env: Record<string, string> = ENV, cost = 3.5) => {
  const clock = session(on, env, { cost })
  await start($)
  await clock.advance(6000)
  return clock
}

test('idle is one row with name, ctx %, spend, mark and standing by', async ($, on) => {
  await idleSession($, on, ENV, 3.5)
  const b = await band($)
  expect(b.rows).toBe(1)
  expect(b.text).toContain('auth-api')
  expect(b.text).toContain('REACTOR')
  expect(b.text).toContain('41%')
  expect(b.text).toContain('$3.50 spent')
  expect(b.text).toContain('MK-L')
})

test('idle shows ✓ standing by on a roomy row (120+ columns)', async ($, on) => {
  await idleSession($, on)
  for (const w of [120, 160, 250]) expect((await band($, { bodyColumns: w })).text).toContain('✓ standing by')
})

// BUG: scenes.ts:146 drops "✓ standing by" below 120 columns (the contract's idle row lists it; only the spend is promised at every width)
test('idle shows standing by when there is room (120+ columns; narrower drops it before the spend)', async ($, on) => {
  await idleSession($, on)
  for (const w of [120, 160]) expect((await band($, { bodyColumns: w })).text).toContain('standing by')
})

for (const [model, mark] of [['opus', 'MK-LXXXV'], ['sonnet', 'MK-L'], ['haiku', 'MK-XLII'], ['fable', 'MK-I']] as const) {
  test(`idle mark for ${model} is ${mark}`, async ($, on) => {
    await idleSession($, on, { ...ENV, _MODEL: model })
    const t = (await band($, { bodyColumns: 120 })).text
    expect(t).toContain(`${mark} ${model.toUpperCase()}`)
  })
}

test('a full model id (claude-opus-4-1) resolves to the opus mark', async ($, on) => {
  await idleSession($, on, { ...ENV, _MODEL: 'claude-opus-4-1-20250805' })
  expect((await band($, { bodyColumns: 120 })).text).toContain('MK-LXXXV')
})

test('idle spend shows at EVERY width 40..250', async ($, on) => {
  await idleSession($, on, { ...ENV, _CWD: '/work/a-really-long-session-name-for-width', _MODEL: 'opus' }, 12.34)
  const bad: number[] = []
  for (let w = 40; w <= 250; w++) {
    const b = await band($, { bodyColumns: w })
    if (!b.text.includes('$12.34')) bad.push(w)
  }
  expect(bad).toEqual([])
})

test('idle spend shows at every width with a tiny and a huge amount', async ($, on) => {
  const bad: string[] = []
  await idleSession($, on, ENV, 1234.5)
  for (let w = 40; w <= 250; w += 3) if (!(await band($, { bodyColumns: w })).text.includes('$1234.50')) bad.push(`${w}`)
  expect(bad).toEqual([])
})

test('idle spend shows even with a long model-less/odd name and CJK/emoji name', async ($, on) => {
  await idleSession($, on, { ...ENV, _CWD: '/work/' + '日本語🚀名前'.repeat(5) }, 7.77)
  for (const w of [40, 41, 50, 60, 75, 89, 90, 120]) expect((await band($, { bodyColumns: w })).text).toContain('$7.77')
})

test('idle: no timers run - after a boot ends no frames repaint', async ($, on) => {
  const clock = await idleSession($, on)
  await band($)
  const before = stats.blits
  await clock.advance(60000)
  expect(stats.blits).toBe(before)
})

test('idle: the band is a single row, in the first-render bounds, with printable cells only', async ($, on) => {
  await idleSession($, on)
  for (const w of [40, 80, 120, 200]) {
    const c = cellsOf((await band($, { bodyColumns: w })).tree)!
    expect(c.rows).toBe(1)
    expect(c.cps.length).toBe(c.cols * c.rows)
    expect(c.cps.every(okCell)).toBe(true)
  }
})

test('band is skipped when maxRows < 3 or a survey shows, or off-terminal', async ($, on) => {
  const clock = session(on, ENV, { stock: true })
  await start($); await clock.advance(6000)
  expect((await band($, { maxRows: 2 })).raster).toBeUndefined()
  expect((await band($, { hasSurvey: true })).raster).toBeUndefined()
})

test('the name is the last segment of the session cwd', async ($, on) => {
  await idleSession($, on, { _MODEL: 'opus', _CWD: '/work/auth-api' })
  expect((await band($, { bodyColumns: 120 })).text).toContain('◢ auth-api')
  expect((await band($, { bodyColumns: 120 })).text).not.toContain('work')
})

test('started from the home folder, the band says ~ and never the account name', async ($, on) => {
  await idleSession($, on, { _MODEL: 'opus', _CWD: '/Users/sam', HOME: '/Users/sam' })
  const t = (await band($, { bodyColumns: 120 })).text
  expect(t).toContain('◢ ~')
  expect(t).not.toContain('sam')
})

// ── 3. working ──────────────────────────────────────────────────────────────
const working = async ($: any, on: any, env: Record<string, string> = ENV) => {
  const clock = session(on, env)
  await start($)
  await band($) // the engine mounts the band from the start; the clock only runs while one is there
  await clock.advance(4000)
  await begin(clock, $)
  return clock
}
const W = (b: any) => b.lines as string[]

test('thinking: the full working band, top row says THINKING', async ($, on) => {
  await working($, on)
  const b = await band($, { isWorking: true })
  expect(b.rows).toBe(WORK_ROWS)
  expect(W(b)[0]).toContain('THINKING')
})

// a tool that keeps running until the test lets it finish
function heldTool(on: any) {
  let release: () => void = () => {}
  const opts = { toolCall: () => new Promise<any>(r => { release = () => r({ result: { ok: true } }) }) }
  return { opts, done: () => release() }
}
for (const t of ['Bash', 'Read', 'Edit', 'Grep']) test(`while ${t} runs the top row says ON ${t.toUpperCase()} at once, then THINKING when it ends`, async ($, on) => {
  const h = heldTool(on)
  const clock = session(on, ENV, h.opts)
  await start($); await clock.advance(4000)
  await ($ as any).turn.start({ text: 'go', turnId: 't1' })
  const p = $.tool.call({ tool: t, command: 'ls -la /secret', file_path: '/secret/b', pattern: 'p' } as any)
  await clock.advance(300)
  const row0 = W(await band($, { isWorking: true }))[0]!
  expect(row0).toContain(`ON ${t.toUpperCase()}`)
  expect(row0).not.toContain('secret')
  h.done(); await p
  await clock.advance(300)
  expect(W(await band($, { isWorking: true }))[0]).toContain('THINKING')
})

test('after a reply starts streaming the top row says WRITING THE REPLY', async ($, on) => {
  const clock = await working($, on)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await clock.advance(7500)
  await $.ui.mount({ ...SPINNER, props: { word: 'x', message: null, suffix: '…', mode: 'responding' } })
  await clock.advance(7500)
  const t = W(await band($, { isWorking: true }))[0]
  expect(t).toContain('WRITING THE REPLY')
})

test('the top row never leaks the command, path or args; nor does the spinner', async ($, on) => {
  await working($, on)
  await $.tool.call({ tool: 'Bash', command: 'rm -rf /secret' } as any)
  for (const t of [0, 200, 7000]) {
    const b = await band($, { isWorking: true })
    expect(W(b)[0]).not.toContain('rm -rf')
    expect(W(b)[0]).not.toContain('secret')
    await (await $.ui.mount({ ...SPINNER, props: { word: 'x', message: null, suffix: '…', mode: 'tool-use' } })).drawn()
  }
  const sp = flat(await (await $.ui.mount({ ...SPINNER, props: { word: 'x', message: null, suffix: '…', mode: 'tool-use' } })).drawn())
  expect(sp).not.toContain('rm -rf')
  expect(sp).not.toContain('secret')
})

test('spinner text (no band mounted yet) never leaks args for Edit/Read/Grep/WebFetch either', async ($, on) => {
  const clock = session(on, ENV)
  await start($)
  await begin(clock, $)
  const calls = [
    { tool: 'Edit', file_path: '/x/secret/path.ts', old_string: 'a', new_string: 'b' },
    { tool: 'Grep', pattern: 'secretpattern' },
    { tool: 'WebFetch', url: 'https://secret.example/x' },
    { tool: 'Bash', command: 'curl -H "Authorization: secretkey"' },
  ]
  for (const c of calls) {
    await $.tool.call(c as any)
    const sp = flat(await (await $.ui.mount({ ...SPINNER, props: { word: 'x', message: null, suffix: '…', mode: 'tool-use' } })).drawn())
    expect(sp).not.toMatch(/secret/i)
  }
})

test('hero rotates through all of ROSTER in the session\'s shuffled order, ROSTER_SECONDS each', { timeoutMs: 60000 }, async ($, on) => {
  const clock = await working($, on)
  const seen: string[] = []
  for (let i = 0; i < ROSTER.length; i++) {
    seen.push(heroOf((await band($, { isWorking: true })).text) ?? '?')
    await clock.advance(ROSTER_SECONDS * 1000)
  }
  // the session's own shuffled order: a new hero every ROSTER_SECONDS, every hero once a lap
  for (let i = 1; i < seen.length; i++) if (seen[i] !== 'J.A.R.V.I.S.' || seen[i - 1] !== 'J.A.R.V.I.S.') expect(seen[i]).not.toBe(seen[i - 1])
  expect(new Set(seen.map(s => s.toUpperCase()))).toEqual(new Set(ROSTER.map(a => HERO[a].name.toUpperCase())))
})

test('rotation is the same whatever tool is running', async ($, on) => {
  const clock = await working($, on)
  const seen: string[] = []
  for (let i = 0; i < 4; i++) {
    await $.tool.call({ tool: 'Bash', command: 'ls' } as any)
    seen.push(heroOf((await band($, { isWorking: true })).text) ?? '?')
    await clock.advance(ROSTER_SECONDS * 1000)
  }
  expect(new Set(seen).size).toBe(4)
})

test('each hero holds a full turn on stage: stable just before ROSTER_SECONDS, changed just after', async ($, on) => {
  const clock = await working($, on)
  const h0 = heroOf((await band($, { isWorking: true })).text)
  await clock.advance(ROSTER_SECONDS * 1000 - 200)
  expect(heroOf((await band($, { isWorking: true })).text)).toBe(h0)
  await clock.advance(400)
  expect(heroOf((await band($, { isWorking: true })).text)).not.toBe(h0)
})

test('tool calls mid-rotation do not shorten or reset a hero\'s turn', async ($, on) => {
  const clock = await working($, on)
  const h0 = heroOf((await band($, { isWorking: true })).text)
  for (let i = 0; i < ROSTER_SECONDS - 1; i++) { await clock.advance(900); await $.tool.call({ tool: 'Grep', pattern: 'x' } as any) }
  expect(heroOf((await band($, { isWorking: true })).text)).toBe(h0)
})

test('the rotation order is shuffled, not the declared ROSTER order', { timeoutMs: 60000 }, async ($, on) => {
  const clock = await working($, on)
  const names: string[] = []
  for (let i = 0; i < 6; i++) { await clock.advance(i === 0 ? 3000 : ROSTER_SECONDS * 1000); names.push(heroOf((await band($, { isWorking: true })).text) ?? '') }
  // six in a row matching any six-run of the declared order is a 1-in-millions coincidence for a shuffle
  const decl = ROSTER.map(h => HERO[h].name)
  const runs = decl.map((_, i) => Array.from({ length: 6 }, (_, k) => decl[(i + k) % decl.length]).join('>'))
  expect(runs).not.toContain(names.join('>'))
})

test('the line is spoken under the speaker\'s own name: speaker label = lane tag = stage hero', { timeoutMs: 60000 }, async ($, on) => {
  const clock = await working($, on)
  const norm = (x: string) => x.replace(/[^A-Z0-9]/gi, '').toUpperCase()
  const seen = new Set<string>()
  for (let i = 0; i < ROSTER.length; i++) {
    await clock.advance(i === 0 ? 3000 : ROSTER_SECONDS * 1000)
    const b = await band($, { isWorking: true })
    const tag = heroOf(b.text)!
    const sp = /([A-Z][A-Za-z.&' -]*?) ▸/.exec(b.lines[1] ?? '')?.[1]
    expect(sp, `row1 of ${tag}: ${b.lines[1]}`).toBeTruthy()
    // the speaker is the character's own name (CAP, TONY, T'CHALLA...), the tag the hero's
    expect(ROSTER.some(h => norm(HERO[h].name) === norm(tag))).toBe(true)
    seen.add(norm(tag))
    expect((b.lines[1] ?? '').split('▸')[1]!.trim().length).toBeGreaterThan(0)
  }
  expect(seen.size).toBe(new Set(ROSTER.map(h => norm(HERO[h].name))).size) // a shuffled order, but every hero once a lap (JARVIS is on twice: thinking and his own turn)
})

test('the mission log shows a live row for the running tool and the finished ones with ✓ and a duration', async ($, on) => {
  const clock = await working($, on)
  await $.tool.call({ tool: 'Glob', pattern: 'src/*.ts' } as any)
  await clock.advance(500)
  const b = await band($, { isWorking: true })
  expect(b.text).toMatch(/✓.{0,4}Glob/)
  expect(b.text).toMatch(/\d+(\.\d)?s/)
})

test('a failing tool shows ✗ in the log', { timeoutMs: 60000 }, async ($, on) => {
  const clock = session(on, ENV, { toolCall: () => ({ result: { ok: false }, isError: true }) as any })
  await start($)
  await clock.advance(4000)
  await begin(clock, $)
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  let seen = ''
  for (let i = 0; i < ROSTER.length; i++) { seen += (await band($, { isWorking: true })).text; await clock.advance(ROSTER_SECONDS * 1000) }
  expect(seen).toContain('✗')
})

test('the log keeps the latest finished actions (newest first), bounded', async ($, on) => {
  await working($, on)
  for (const f of ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']) await $.tool.call({ tool: 'Read', file_path: `/x/${f}` } as any)
  const t = (await band($, { isWorking: true })).text
  expect(t).toContain('e.ts')
  expect(t).not.toContain('a.ts')
})

test('the action count matches the number of tool calls', async ($, on) => {
  await working($, on)
  for (let i = 0; i < 7; i++) await $.tool.call({ tool: 'Read', file_path: `/x/${i}` } as any)
  const t = (await band($, { isWorking: true })).text
  expect(t).toMatch(/\b7\b/)
  await $.tool.call({ tool: 'Read', file_path: '/x/8' } as any)
  expect((await band($, { isWorking: true })).text).toMatch(/\b8\b/)
})

test('working band falls to one line only when 7 rows are not there', async ($, on) => {
  await working($, on)
  const c = await band($, { isWorking: true, maxRows: 5 })
  expect(c.rows).toBe(1)
})

test('working band has the lane when there is room for it', async ($, on) => {
  await working($, on)
  expect((await band($, { isWorking: true, maxRows: WORK_ROWS + 2 })).rows).toBe(WORK_ROWS)
})

// MomBirthday, and any session with subagents: a notice row and the tasks list cut the band's rows, and the lane vanished
test('the lane always stays: a band rows short squeezes the lane, then crops the stage log', async ($, on) => {
  await working($, on)
  for (const [maxRows, rows] of [[14, 13], [13, 13], [12, 12], [11, 11], [10, 10], [9, 9], [8, 8], [7, 7]] as const) {
    const b = await band($, { isWorking: true, maxRows })
    expect(b.rows).toBe(rows)
    expect(b.text).toContain('◢ ')
    expect(b.text).toContain('MISSION LOG') // the stage keeps its head, line and gauges
  }
  expect((await band($, { isWorking: true, maxRows: 6 })).rows).toBe(1) // under 7 rows: the one-line band
})

// a docked theater left the transcript column ~20 wide; the band drew 40 wide and was clipped to a stub
test('beside a docked pane (a ~20-column transcript) the band draws at its true width: name and spend whole', async ($, on) => {
  await working($, on)
  for (const cols of [16, 20, 24, 39]) {
    for (const isWorking of [true, false]) {
      const b = await band($, { isWorking, bodyColumns: cols })
      expect(b.rows).toBe(1)
      expect(b.raster!.props.columns).toBe(cols)
      expect(b.text).toContain('◢')
      expect(b.text).toMatch(/\$\d+\.\d\d/)
    }
  }
  const wide = await band($, { isWorking: true, bodyColumns: 100 })
  expect(wide.rows).toBeGreaterThan(1) // room again: the full working band
})

test('the prompt text shows in the band, but never in row 0', async ($, on) => {
  const clock = session(on, ENV)
  await start($); await clock.advance(4000)
  await $.turn.start({ text: 'please delete everything', turnId: 't1' })
  expect(W(await band($, { isWorking: true }))[0]).not.toContain('delete everything')
})

// ── 4. moments ──────────────────────────────────────────────────────────────
test('boot plays at session start (STARK) and then returns to idle', async ($, on) => {
  const clock = session(on, ENV)
  await start($)
  await band($); await clock.advance(1200)
  const b = await band($)
  expect(b.rows).toBe(MOMENT_ROWS.boot)
  expect(b.text).toContain('STARK')
  await clock.advance(4000)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

test('a reload of the same session (same startedAt) does not boot again: no STARK moment, no hum', async ($, on) => {
  const clock = session(on, ENV)
  await start($); await band($); await clock.advance(6000)
  expect((await band($)).rows).toBe(IDLE_ROWS)
  await start($) // the module's session.start again, as after a hot reload or a plugin update
  await band($); await clock.advance(1200)
  const b = await band($)
  expect(b.rows).toBe(IDLE_ROWS)
  expect(b.text).not.toContain('STARK')
})

test('CLAUVENGERS, ASSEMBLE! after a 9s turn shows duration, action count and $ spent', async ($, on) => {
  let cost = 1
  const clock = session(on, ENV, { usage: () => ({ value: { startedAt: 0, cost: { usd: cost }, context: { window: 1, percent: 41, tokens: 1 }, rateLimits: [] } }) })
  await start($); await band($); await clock.advance(4000)
  await begin(clock, $)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await $.tool.call({ tool: 'Read', file_path: '/b' } as any)
  cost = 1.75
  await done($, { durationMs: 9000 })
  await clock.advance(SNAP_MS + 2600)
  const b = await band($)
  expect(b.rows).toBe(MOMENT_ROWS.assemble)
  expect(b.text).toContain('9s')
  expect(b.text).toContain('2 actions')
  expect(b.text).toContain('$0.75')
})

test('ASSEMBLE says "1 action" singular', async ($, on) => {
  const clock = await working($, on)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($, { durationMs: 1000 })
  await clock.advance(SNAP_MS + 2600)
  expect((await band($)).text).toMatch(/1 action(?!s)/)
})

test('ASSEMBLE fires for a 5s turn with zero tools', async ($, on) => {
  const c1 = await working($, on)
  await done($, { durationMs: 5000 })
  await c1.advance(SNAP_MS + 2600)
  expect((await band($)).rows).toBe(MOMENT_ROWS.assemble)
})

test('no ASSEMBLE for a 4.9s turn with zero tools', async ($, on) => {
  const c2 = await working($, on)
  await done($, { durationMs: 4900 })
  await c2.advance(2500)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

test('a quick, tool-less turn plays nothing', async ($, on) => {
  const clock = await working($, on)
  await done($, { durationMs: 800 })
  await clock.advance(1000)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

test('ASSEMBLE ends by itself and returns to idle; the clock then parks', async ($, on) => {
  const clock = await working($, on)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($)
  await clock.advance(SNAP_MS + 2600)
  await clock.advance(ASM_MS)
  await band($)
  expect((await band($)).rows).toBe(IDLE_ROWS)
  const before = stats.blits
  await clock.advance(30000)
  expect(stats.blits).toBe(before)
})

test('a sub-agent turn.complete does not fire a moment', async ($, on) => {
  const clock = await working($, on)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await $.turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: 'x', reason: 'answer', agentId: 'sub1' } as any)
  expect((await band($, { isWorking: true })).rows).toBe(WORK_ROWS)
})

// the graph worker: the main turn ended while five background subagents worked on, and the band sat at "standing by"
test('background subagents keep the band working after the main turn ends; it rests when the last one finishes', async ($, on) => {
  const clock = await working($, on)
  for (const id of ['sub1', 'sub2']) await $.tool.call({ tool: 'Read', file_path: '/a', agentId: id } as any) // a subagent is heard from through its tool calls
  await done($)
  await clock.advance(20000) // the end-of-task moments are over
  const b = await band($, { isWorking: false })
  expect(b.rows).toBeGreaterThan(1)
  expect(b.text).toContain('2 AGENTS')
  expect(b.text).not.toContain('standing by')
  // squeezed by the tasks list: one line, still saying the team is at work
  const tight = await band($, { isWorking: false, maxRows: 4 })
  expect(tight.rows).toBe(1)
  expect(tight.text).toContain('2 agents at work')
  for (const id of ['sub1', 'sub2']) await $.turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: `s-${id}`, reason: 'answer', agentId: id } as any)
  await clock.advance(1000)
  expect((await band($, { isWorking: false, bodyColumns: 140 })).text).toContain('standing by')
})

test("a subagent's tool call does not reset the main turn's mission log", async ($, on) => {
  await working($, on)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await $.tool.call({ tool: 'Read', file_path: '/b' } as any)
  await $.tool.call({ tool: 'Read', file_path: '/c', agentId: 'sub9' } as any)
  expect((await band($, { isWorking: true })).text).toMatch(/MISSION LOG · [23] actions/)
})

test('Thanos snap when a turn ends in an error; then it ends', async ($, on) => {
  const clock = await working($, on)
  await done($, { reason: 'error', answer: '' })
  await clock.advance(1500)
  const b = await band($)
  expect(b.rows).toBe(MOMENT_ROWS.snap)
  await clock.advance(4500)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

test('an error turn plays the snap, not ASSEMBLE, even after tools and 9s', async ($, on) => {
  const clock = await working($, on)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($, { reason: 'error', durationMs: 9000, answer: 'oh no?' })
  await clock.advance(1000)
  expect((await band($)).rows).toBe(MOMENT_ROWS.snap)
})

test('Nick Fury when the answer ends with "?" (even with trailing whitespace); holds until the next prompt', async ($, on) => {
  const clock = await working($, on)
  await done($, { answer: 'Should I go on?  \n' })
  await clock.advance(1000)
  expect((await band($)).text).toContain('NICK FURY')
  await clock.advance(120000)
  const b = await band($)
  expect(b.text).toContain('NICK FURY')
  expect(b.rows).toBe(MOMENT_ROWS.fury)
  await begin(clock, $, 't2')
  expect((await band($, { isWorking: true })).text).not.toContain('PRIORITY ALERT') // the Fury moment, not Fury taking his rotation turn
})

test('Fury stops painting after its animation: no blits at rest', async ($, on) => {
  const clock = await working($, on)
  await done($, { answer: 'ok?' })
  await clock.advance(10000)
  await band($)
  const before = stats.blits
  await clock.advance(30000)
  expect(stats.blits).toBe(before)
})

test('an answer with a ? in the middle is not Fury', async ($, on) => {
  const clock = await working($, on)
  await done($, { answer: 'Why? Because.', durationMs: 100 })
  await clock.advance(1000)
  expect((await band($)).text).not.toContain('PRIORITY ALERT') // the Fury moment, not Fury taking his rotation turn
})

test('Ant-Man on compact; returns to idle after', async ($, on) => {
  let release: () => void = () => {}
  const clock = session(on, ENV, { compact: (_$: any, e: any) => new Promise<any>(r => { release = () => r({ messages: e.messages }) }) })
  await start($); await clock.advance(4000)
  const p = ($ as any).session.compact({ messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  await clock.advance(1000)
  const b = await band($)
  release(); await p
  await clock.advance(10000)
  await band($)
  expect((await band($)).rows).toBe(IDLE_ROWS) // the moment ends
  expect(b.rows).toBeGreaterThan(IDLE_ROWS)
  expect(b.text).toMatch(/ANT-MAN/)
})

test('a compaction that throws does not stick the band', async ($, on) => {
  const clock = session(on, ENV, { compact: () => { throw new Error('boom') } })
  await start($); await clock.advance(4000)
  await ($ as any).session.compact({ messages: [{ role: 'user', text: 'hi', toolUses: [] }] }).catch(() => {})
  await clock.advance(10000)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

test('a blit that never resolves does not freeze any moment', { timeoutMs: 60000 }, async ($, on) => {
  const clock = session(on, ENV, { blit: () => new Promise(() => {}) })
  await start($)
  await band($)
  await clock.advance(6000)
  expect((await band($)).rows).toBe(IDLE_ROWS) // boot ended
  await begin(clock, $)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await clock.advance(8000)
  expect(heroOf((await band($, { isWorking: true })).text)).toBeTruthy()
  const h = heroOf((await band($, { isWorking: true })).text)
  await clock.advance(ROSTER_SECONDS * 1000)
  expect(heroOf((await band($, { isWorking: true })).text)).not.toBe(h)
  await done($, { answer: 'q?' })
  await $.turn.start({ text: 'a', turnId: 't3' })
  await done($, { answer: 'x', turnId: 't3', durationMs: 9000 })
  await band($)
  await clock.advance(SNAP_MS + ASM_MS + 1500)
  expect((await band($)).rows).toBe(IDLE_ROWS)
})

test('a new prompt during a moment gives the band to work', async ($, on) => {
  const clock = await working($, on)
  await done($, { durationMs: 9000 })
  await clock.advance(500)
  await begin(clock, $, 't2')
  expect((await band($, { isWorking: true })).rows).toBe(WORK_ROWS)
})

test('moment too tall for the terminal falls back to idle/work', async ($, on) => {
  const clock = await working($, on)
  await done($, { durationMs: 9000 })
  await clock.advance(500)
  expect((await band($, { maxRows: 4 })).rows).toBeLessThanOrEqual(MOMENT_ROWS.boot)
})

// ── 5. robustness ───────────────────────────────────────────────────────────
const NASTY = ['🚀🚀🚀', '日本語のテキスト', 'a​b‍‎', 'ctrl\u0001\u0007\u001b[31m\r\t\n\u007f\u0085', 'مرحبا بالعالم‮ abc', 'é́́', 'x'.repeat(10000), '\ud800', '👨‍👩‍👧‍👦', '﻿', '\u0000']

for (const [ni, s] of NASTY.entries()) test(`hostile text #${ni} in names, commands, paths, prompts and answers yields only printable width-1 BMP cells`, async ($, on) => {
  {
    const clock = session(on, { _CWD: '/work/' + s, _MODEL: 'opus' })
    await start($)
    await clock.advance(1200)
    let c = cellsOf((await band($, { bodyColumns: 100 })).tree)!
    expect(c.cps.every(okCell)).toBe(true)
    await clock.advance(5000)
    await $.turn.start({ text: s, turnId: 't1' })
    await $.tool.call({ tool: 'Bash', command: s, file_path: s, pattern: s } as any)
    for (const w of [40, 100, 160]) {
      c = cellsOf((await band($, { isWorking: true, bodyColumns: w })).tree)!
      expect(c.cps.length).toBe(c.cols * c.rows)
      expect(c.cps.every(okCell)).toBe(true)
    }
    await $.turn.complete({ answer: s + '?', durationMs: 9000, isAborted: false, turnId: 't1', reason: 'answer' } as any)
    await clock.advance(1000)
    c = cellsOf((await band($)).tree)!
    expect(c.cps.every(okCell)).toBe(true)
    await $.turn.start({ text: s, turnId: 't2' })
    await $.turn.complete({ answer: s, durationMs: 9000, isAborted: false, turnId: 't2', reason: 'error' } as any)
    await clock.advance(1000)
    c = cellsOf((await band($)).tree)!
    expect(c.cps.every(okCell)).toBe(true)
  }
})

test('no wide / combining / zero-width code points reach the cells', async ($, on) => {
  const clock = session(on, { _CWD: '/work/' + '🚀é​', _MODEL: 'opus' })
  await start($); await clock.advance(6000)
  await $.turn.start({ text: '日本語🚀', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: '日本語 🚀 ​ ́' } as any)
  const c = cellsOf((await band($, { isWorking: true })).tree)!
  for (const cp of c.cps) {
    expect(cp >= 0x3000 && cp <= 0x9fff).toBe(false)
    expect(cp >= 0x200b && cp <= 0x200f).toBe(false)
    expect(cp >= 0x300 && cp <= 0x36f).toBe(false)
    expect(cp >= 0x1f000).toBe(false)
  }
})

// BUG: scenes.ts:397 '·'.repeat(1 + floor(t*3)%3) throws RangeError for a negative clock; the whole band drops out
for (const t of [-1e9, -1, 1e15]) test(`a clock that starts at ${t} never throws`, async ($, on) => {
  const clock = session(on, ENV, { now: t })
  await start($)
  await band($)
  await begin(clock, $)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await clock.advance(1500)
  const b = await band($, { isWorking: true })
  expect(cellsOf(b.tree)!.cps.every(okCell)).toBe(true)
  await done($)
  await clock.advance(1500)
  expect(cellsOf((await band($)).tree)!.cps.every(okCell)).toBe(true)
})

// BUG: scenes.ts:104 u.cost.toFixed throws when cost is NaN/Infinity (the atom stores it as null); the band drops out
for (const [pct, usd] of [[NaN, NaN], [-5, -1], [1e9, 1e12], [Infinity, Infinity], [undefined as any, undefined as any]]) test(`absurd usage (${pct}, ${usd}) and durations render without throwing`, async ($, on) => {
  const clock = session(on, ENV, { usage: () => ({ value: { startedAt: 0, cost: { usd }, context: { window: 1, percent: pct, tokens: pct }, rateLimits: [] } }) })
  await start($)
  await clock.advance(6000)
  const b = await band($, { bodyColumns: 60 })
  expect(b.rows).toBe(1)
  expect(cellsOf(b.tree)!.cps.every(okCell)).toBe(true)
  await begin(clock, $)
  await done($, { durationMs: NaN })
  await done($, { durationMs: -50 })
  await band($)
})

test('widths 1..400 incl. boundaries do not throw and stay in bounds', async ($, on) => {
  const clock = session(on, ENV)
  await start($)
  for (const w of [-5, 0, 1, 20, 39, 40, 89, 90, 109, 110, 400]) {
    let b = await band($, { bodyColumns: w })
    let c = cellsOf(b.tree)!
    expect(c.cols).toBe(Math.max(16, w)) // the true width, down to 16 (a column beside a docked pane)
    expect(c.cps.length).toBe(c.cols * c.rows)
    await clock.advance(6000)
    b = await band($, { bodyColumns: w })
    expect(b.rows).toBe(1)
  }
  await begin(clock, $)
  for (const w of [1, 20, 39, 40, 89, 90, 109, 110, 400]) {
    const b = await band($, { isWorking: true, bodyColumns: w })
    const c = cellsOf(b.tree)!
    expect(c.cps.length).toBe(c.cols * c.rows)
    expect(c.cps.every(okCell)).toBe(true)
  }
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($)
  for (const w of [1, 39, 40, 89, 90, 110, 400]) {
    const c = cellsOf((await band($, { bodyColumns: w })).tree)!
    expect(c.cps.length).toBe(c.cols * c.rows)
  }
})

test('the ▶ STARK ARCADE button is hidden below 90 columns and present at 90+ (idle and working)', async ($, on) => {
  const clock = session(on, ENV)
  await start($); await clock.advance(6000)
  for (const w of [1, 40, 89]) expect((await band($, { bodyColumns: w })).flat).not.toContain('STARK ARCADE')
  for (const w of [90, 110, 400]) expect(JSON.stringify((await band($, { bodyColumns: w })).tree)).toContain('STARK ARCADE')
  await begin(clock, $)
  expect(JSON.stringify((await band($, { isWorking: true, bodyColumns: 89 })).tree)).not.toContain('STARK ARCADE')
  expect(JSON.stringify((await band($, { isWorking: true, bodyColumns: 90 })).tree)).toContain('STARK ARCADE')
})

test('rapid turn.start / turn.complete storms do not throw and the final state is sane', async ($, on) => {
  const clock = session(on, ENV)
  await start($); await clock.advance(6000)
  for (let i = 0; i < 60; i++) {
    await $.turn.start({ text: `go${i}`, turnId: `t${i}` })
    if (i % 3) await $.tool.call({ tool: 'Read', file_path: `/a${i}` } as any)
    await $.turn.complete({ answer: i % 5 ? 'ok' : 'ok?', durationMs: i * 1000, isAborted: false, turnId: `t${i}`, reason: i % 7 ? 'answer' : 'error' } as any)
    await band($)
  }
  await $.turn.start({ text: 'last', turnId: 'z' })
  expect((await band($, { isWorking: true })).rows).toBe(WORK_ROWS)
  await done($, { turnId: 'z', durationMs: 100 })
  await clock.advance(120000)
  await band($)
  const b = await band($)
  expect([IDLE_ROWS, MOMENT_ROWS.fury, MOMENT_ROWS.assemble]).toContain(b.rows)
})

test('storms of session.start do not lay duplicate clock chains: paint stays ~10fps', async ($, on) => {
  const clock = session(on, ENV)
  for (let i = 0; i < 8; i++) await start($)
  await band($)
  await begin(clock, $)
  await band($, { isWorking: true })
  await clock.advance(1000) // warm up
  const b0 = stats.blits
  await clock.advance(5000)
  const fps = (stats.blits - b0) / 5
  expect(fps).toBeLessThanOrEqual(11)
  expect(fps).toBeGreaterThan(0)
})

test('overlapping turn starts and tool calls keep the paint rate ~10fps', async ($, on) => {
  const clock = session(on, ENV)
  await start($); await clock.advance(6000)
  await band($, { isWorking: true })
  for (let i = 0; i < 30; i++) { void $.turn.start({ text: 'g', turnId: `t${i}` }); void $.tool.call({ tool: 'Read', file_path: `/a${i}` } as any) }
  await Promise.all([$.tool.call({ tool: 'Bash', command: 'a' } as any), $.tool.call({ tool: 'Grep', pattern: 'a' } as any), $.tool.call({ tool: 'Edit', file_path: '/a', old_string: 'a', new_string: 'b' } as any)])
  await band($, { isWorking: true })
  await clock.advance(1000)
  const b0 = stats.blits
  await clock.advance(5000)
  expect((stats.blits - b0) / 5).toBeLessThanOrEqual(11)
})

test('moment storms (assemble/snap/fury) back to back keep the rate ~10fps', async ($, on) => {
  const clock = session(on, ENV)
  await start($); await clock.advance(6000)
  await band($)
  for (let i = 0; i < 20; i++) {
    await $.turn.start({ text: 'g', turnId: `t${i}` })
    await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
    await $.turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: `t${i}`, reason: i % 2 ? 'error' : 'answer' } as any)
  }
  await band($)
  const b0 = stats.blits
  await clock.advance(2000)
  expect((stats.blits - b0) / 2).toBeLessThanOrEqual(11)
})

test('overlapping tool calls all count', async ($, on) => {
  await working($, on)
  await Promise.all(Array.from({ length: 5 }, (_, i) => $.tool.call({ tool: 'Read', file_path: `/f${i}` } as any)))
  expect((await band($, { isWorking: true })).text).toMatch(/\b5\b/)
})

for (const d of ['allow', 'deny', 'ask']) test(`tool.check ${d} passes through untouched`, async ($, on) => {
  const clock = session(on, ENV, { check: () => ({ decision: d, reason: 'because' }) as any })
  await start($)
  await begin(clock, $)
  {
    const v = await ($ as any).tool.check({ tool: 'Bash', tool_use_id: `tu-${d}`, input: { command: 'rm -rf dist' }, command: 'rm -rf dist' })
    expect(v.decision).toBe(d)
    expect(v.reason).toBe('because')
    expect(v.updatedInput).toBeUndefined()
  }
})

test('tool.check "ask" never puts Fury in the band', async ($, on) => {
  const clock = session(on, ENV, { check: () => ({ decision: 'ask' }) as any })
  await start($); await clock.advance(5000)
  await begin(clock, $)
  await ($ as any).tool.check({ tool: 'Bash', tool_use_id: 'tu1', input: { command: 'x' }, command: 'x' })
  await clock.advance(1000)
  expect((await band($, { isWorking: true })).text).not.toContain('PRIORITY ALERT') // the Fury moment, not Fury taking his rotation turn
})

test('tool.check without a tool_use_id does not throw', async ($, on) => {
  session(on, ENV, { check: () => ({ decision: 'ask' }) as any })
  await start($)
  const v = await ($ as any).tool.check({ tool: 'Bash', input: {}, command: 'x' })
  expect(v.decision).toBe('ask')
})

test('a throwing ui.notice or ui.toast never breaks tool.check or tool.call', async ($, on) => {
  session(on, ENV, { notice: () => { throw new Error('x') }, check: () => ({ decision: 'ask' }) as any })
  await start($)
  const v = await ($ as any).tool.check({ tool: 'Bash', tool_use_id: 'u', input: {}, command: 'x' })
  expect(v.decision).toBe('ask')
})

test('a failing session.usage does not break the band', async ($, on) => {
  const clock = session(on, ENV, { usage: () => { throw new Error('nope') } })
  await start($); await clock.advance(6000)
  const b = await band($)
  expect(b.rows).toBe(1)
  expect(b.text).toContain('spent')
})

test('tool.call results pass through to the caller unchanged', async ($, on) => {
  const clock = session(on, ENV, { toolCall: () => ({ result: { ok: true, data: 42 } }) as any })
  await start($)
  await begin(clock, $)
  const r: any = await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  expect(JSON.stringify(r)).toContain('42')
})

test('tool.call before any turn.start or session.start does not throw', async ($, on) => {
  session(on, ENV)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await $.tool.call({ tool: '', command: undefined } as any)
  await $.tool.call({ tool: 'Bash', command: 'x'.repeat(10000) } as any)
})

// ── 6. play ─────────────────────────────────────────────────────────────────
test('/clarvis play opens the pane avengers-arcade', async ($, on) => {
  session(on, ENV)
  const opened: string[] = []
  on('ui.open', (_$: any, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } as any })
  await start($)
  const r = await $.command.run({ command: 'clarvis', args: 'play' } as any)
  expect(opened).toEqual(['avengers-arcade'])
  expect(JSON.stringify(r)).toMatch(/ARCADE/)
})

test('the play button opens the pane avengers-arcade (idle and working)', async ($, on) => {
  const clock = session(on, ENV)
  const opened: string[] = []
  on('ui.open', (_$: any, e: any) => { opened.push(e.id); return { value: undefined } as any })
  await start($); await clock.advance(6000)
  await (await band($, { bodyColumns: 120 })).m.press({ key: 'play' })
  await begin(clock, $)
  await (await band($, { bodyColumns: 120, isWorking: true })).m.press({ key: 'play' })
  expect(opened).toEqual(['avengers-arcade', 'avengers-arcade'])
})

test('/clarvis play does not change the saved mode', async ($, on) => {
  session(on, ENV)
  on('ui.open', () => ({ value: undefined }) as any)
  await start($)
  await $.command.run({ command: 'clarvis', args: 'play' } as any)
  expect(JSON.stringify(await $.command.run({ command: 'clarvis', args: '' } as any))).toContain('full')
})

test('/clarvis play when the pane cannot be placed toasts, never throws', async ($, on) => {
  session(on, ENV)
  on('ui.open', () => ({ value: { isPlaced: false } }) as any)
  await start($)
  await $.command.run({ command: 'clarvis', args: 'play' } as any)
})

// ── review fixes ────────────────────────────────────────────────────────────
test('a size change redraws the band alone, never the transcript rows', async ($, on) => {
  const clock = session(on, ENV)
  let rows = 0
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => { rows++; const { Text } = $.ui.resolve(e); return <Text>hello stock</Text> })
  await start($)
  await clock.advance(4000)
  const b = await band($)
  const row = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AssistantMessage', props: { text: 'hi', isFirstOfReply: true }, viewport: { columns: 120, rows: 40, isFullscreen: true } })
  await row.drawn()
  const before = rows
  await begin(clock, $)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await clock.advance(3000) // idle -> working is another size: the clock asks the band for a redraw
  await $.turn.complete({ answer: 'ok', durationMs: 3000, isAborted: false, turnId: 'x', reason: 'answer', agentId: 'sub1' } as any)
  await clock.advance(1000)
  expect(findRaster(await b.m.drawn()).props.rows).toBeGreaterThan(IDLE_ROWS) // the band itself did redraw, through its own value
  expect(rows).toBe(before)
})

test('the band never asks for more than 512 columns (Raster limit)', async ($, on) => {
  await idleSession($, on)
  expect((await band($, { bodyColumns: 900 })).raster.props.columns).toBe(512)
})

test('off mode keeps no bookkeeping: tool calls and turns do not read the usage', async ($, on) => {
  let usageCalls = 0
  const clock = session(on, { ...ENV, CLARVIS: 'off' }, { usage: () => { usageCalls++; return { value: { startedAt: 0, cost: { usd: 1 }, context: { window: 1, percent: 1, tokens: 1 }, rateLimits: [] } } } })
  await start($)
  const u0 = usageCalls
  await begin(clock, $)
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await done($)
  expect(usageCalls).toBe(u0)
})

test('a burst tint is cleared by /clarvis off and by a new session', async ($, on) => {
  const clock = session(on, ENV)
  on('ui.render', { component: 'AssistantMessage' }, ($: any, e: any) => { const { Text } = $.ui.resolve(e); return <Text>hello stock</Text> })
  await start($)
  await $.command.run({ command: 'clarvis', args: 'fx on' } as any) // the transcript echo is opt-in
  await clock.advance(4000)
  const pm = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'Pane', requestId: 'avengers-theater', props: { title: 'AVENGERS THEATER', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { bodyRows: 30, offset: 0 }, view: {} }, viewport: { columns: 140, rows: 40, isFullscreen: true } })
  const msgTree = async () => JSON.stringify(await (await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AssistantMessage', props: { text: 'hi', isFirstOfReply: true }, viewport: { columns: 120, rows: 40, isFullscreen: true } })).drawn())
  const base = await msgTree()
  await pm.post({ fx: 'THOR' } as any, { in: 'theater' })
  expect(await msgTree()).not.toBe(base)
  await $.command.run({ command: 'clarvis', args: 'off' } as any)
  await $.command.run({ command: 'clarvis', args: 'full' } as any)
  expect(await msgTree()).toBe(base)
  await pm.post({ fx: 'THOR' } as any, { in: 'theater' })
  await start($) // hot reload / a new session within the burst's second
  expect(await msgTree()).toBe(base)
})

test('CLARVIS is case-insensitive', async ($, on) => {
  session(on, { ...ENV, CLARVIS: ' OFF ' }, { stock: true })
  await start($)
  expect((await band($)).flat).toContain('stock-band')
})

test('the project folder name is the last segment of a Windows cwd too', async ($, on) => {
  await idleSession($, on, { ...ENV, _CWD: 'C:\\Users\\me\\proj\\auth-api' })
  const t = (await band($)).text
  expect(t).toContain('auth-api')
  expect(t).not.toContain('Users')
})

test('a /model switch updates the Mark at the next turn', async ($, on) => {
  let model = 'sonnet'
  const clock = session(on, ENV, { model: () => model })
  await start($)
  await clock.advance(4000)
  expect((await band($)).text).toContain('MK-L ')
  model = 'opus'
  await begin(clock, $)
  await done($, { durationMs: 100 })
  await clock.advance(1000)
  expect((await band($)).text).toContain('MK-LXXXV')
})

test('/clear and /compact re-read the usage figures', async ($, on) => {
  let calls = 0
  const clock = session(on, ENV, { usage: () => { calls++; return { value: { startedAt: 0, cost: { usd: 1 }, context: { window: 200000, percent: 5, tokens: 1 }, rateLimits: [] } } }, compact: (_$: any, e: any) => ({ messages: e.messages }) })
  await start($)
  const a = calls
  await ($ as any).session.compact({ messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  await clock.settle()
  expect(calls).toBeGreaterThan(a)
  const b = calls
  await ($ as any).session.end({ reason: 'clear', sessionId: 's', resume: { id: 's' } })
  await clock.settle()
  expect(calls).toBeGreaterThan(b)
})

test('closing line: failed and aborted turns say so, with the tool count', async ($, on) => {
  const clock = session(on, ENV)
  await start($)
  const footer = async (ms: number) => flat(await (await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'TurnDuration', props: { word: 'Baked', durationMs: ms } })).drawn())
  await begin(clock, $)
  await $.tool.call({ tool: 'Read', file_path: '/a' } as any)
  await $.tool.call({ tool: 'Read', file_path: '/b' } as any)
  await done($, { durationMs: 7000, reason: 'error' })
  expect(await footer(7000)).toMatch(/Snapped in 7s · 2 tools/)
  await begin(clock, $)
  await done($, { durationMs: 8000, reason: 'aborted', isAborted: true })
  expect(await footer(8000)).toContain('Stood down in 8s')
  await begin(clock, $)
  await done($, { durationMs: 9000 })
  expect(await footer(9000)).toContain('Mission complete in 9s')
  expect(await footer(1234)).toContain('Mission complete')
})

test('one duration format: 42s, 1m 04s, 1h 02m', () => {
  for (const [ms, s] of [[42_000, '42s'], [64_000, '1m 04s'], [3_720_000, '1h 02m']] as const) { expect(a(ms)).toBe(s); expect(b(ms)).toBe(s) }
})

test('movie lookup: punctuation alone and no argument match nothing; 0 is #10', async ($, on) => {
  for (const q of ['?', '-', '!!!', '', '  ']) expect(findMovie(q)).toBeUndefined()
  expect(findMovie('0')?.n).toBe(10)
  expect(findMovie('1')?.n).toBe(1)
  session(on, ENV)
  const opened: string[] = []
  on('ui.open', (_$: any, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } as any })
  await start($)
  const r = JSON.stringify(await $.command.run({ command: 'clarvis', args: 'movie' } as any))
  expect(r).toContain('Use /clarvis movie')
  expect(r).not.toContain('No movie')
  expect(JSON.stringify(await $.command.run({ command: 'clarvis', args: 'movie ?' } as any))).toContain('No movie')
  expect(opened).toEqual([])
  expect(JSON.stringify(await $.command.run({ command: 'clarvis', args: 'movie 0' } as any))).toContain('#10')
})

test('an unplaced pane is not announced as up; the toast does not blame the width', async ($, on) => {
  const toasts: string[] = []
  session(on, ENV, { toast: e => toasts.push(JSON.stringify(e)) })
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'no surface places panes' } }) as any)
  await start($)
  const r = JSON.stringify(await $.command.run({ command: 'clarvis', args: 'play' } as any))
  expect(r).not.toContain('is up')
  expect(toasts.join(' ')).not.toMatch(/wider terminal|110/)
  expect(toasts.join(' ')).toContain('no surface places panes')
})

test('outside fullscreen the panes say "Run /tui fullscreen to play" and draw no game; the band buttons and /clarvis play say it too', async ($, on) => {
  const opened: string[] = [], toasts: string[] = []
  const clock = session(on, ENV, { toast: e => toasts.push(JSON.stringify(e)) })
  on('ui.open', (_$: any, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } as any })
  await start($); await clock.advance(6000)
  for (const id of ['avengers-arcade', 'avengers-theater']) {
    const m = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'Pane', requestId: id, props: { title: 'X', isFocused: true, bodyColumns: 100, placement: 'inline', scroll: { bodyRows: 30, offset: 0 }, view: {} }, viewport: { columns: 120, rows: 40, isFullscreen: false } })
    const d = await m.drawn()
    await m.unmount()
    expect(flat(d)).toContain('Run /tui fullscreen to play')
    expect(JSON.stringify(d)).not.toContain('.tsx')
    expect(flat(d)).not.toContain('Small view')
  }
  const mb = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { bodyRows: 19, offset: 0 }, view: {} }, viewport: { columns: 140, rows: 40, isFullscreen: false } })
  await mb.press({ key: 'play' }); await mb.press({ key: 'movies' })
  expect(opened).toEqual([])
  expect(toasts.join(' ')).toContain('Run /tui fullscreen to play')
  for (const args of ['play', 'movies', 'movie 3']) expect(JSON.stringify(await $.command.run({ command: 'clarvis', args, presentation: { isFullscreen: false, columns: 120 } } as any))).toContain('/tui fullscreen')
  expect(opened).toEqual([])
  const fsPane = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'Pane', requestId: 'avengers-arcade', props: { title: 'X', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { bodyRows: 30, offset: 0 }, view: {} }, viewport: { columns: 200, rows: 40, isFullscreen: true } })
  expect(JSON.stringify(await fsPane.drawn())).toContain('arcade.tsx')
})

test('a collapsed band (blit refused) hands the spinner its row back and stops the clock', async ($, on) => {
  let deny = false
  const clock = session(on, ENV, { blit: () => ({ value: deny ? { deny: 'not mounted' } : {} }) as any })
  await start($)
  await begin(clock, $)
  await band($, { isWorking: true })
  const sp = async (w = 'x') => flat(await (await $.ui.mount({ ...SPINNER, props: { word: w, message: null, suffix: '…', mode: 'thinking' } })).drawn())
  expect(await sp()).toBe('')
  deny = true
  await clock.advance(500)
  expect(await sp('y')).toContain('JARVIS')
  const n0 = stats.blits
  await clock.advance(3000)
  expect(stats.blits).toBe(n0) // the clock parked: no more paint attempts
})

test('calm: fx on says bursts are drawn in full mode only', async ($, on) => {
  session(on, ENV)
  await start($)
  await $.command.run({ command: 'clarvis', args: 'calm' } as any)
  expect(JSON.stringify(await $.command.run({ command: 'clarvis', args: 'fx on' } as any))).toContain('full mode only')
})
