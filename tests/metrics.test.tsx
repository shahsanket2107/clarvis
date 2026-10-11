import { expect, mock } from 'claude-code/testing'
import { test } from './timed'
import {
  addLifetime, addTool, addTurn, bandNumbers, bandPieces, burnRate, cacheHit, emptyLifetime, fmtCost, fmtTokens, newStats, outputSpeed, resetsIn,
  sanitizeLifetime, statsText, topTools,
} from '../hooks/metrics'

const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-6
// ── pure maths ──────────────────────────────────────────────────────────────
test('numbers format as tokens and cost', () => {
  expect([950, 12_400, 3_100_000, 0].map(fmtTokens)).toEqual(['950', '12.4k', '3.1M', '0'])
  expect([0.42, 12.34, 1234.56].map(fmtCost)).toEqual(['$0.42', '$12.34', '$1.2k'])
  for (const bad of [NaN, Infinity, -Infinity, -5, undefined, null, 'x']) { expect(fmtTokens(bad)).toBe('0'); expect(fmtCost(bad)).toBe('$0.00') }
})

test('turns accumulate across turns; agent turns are kept apart', () => {
  const s = newStats()
  addTurn(s, { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 800, cache_creation_input_tokens: 100, model: 'm1' }, { ms: 4000 })
  addTurn(s, { input_tokens: 10, output_tokens: 30, cache_read_input_tokens: 90, cache_creation_input_tokens: 0, model: 'm1' }, { ms: 9000 })
  addTurn(s, { input_tokens: 5000, output_tokens: 700, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }, { agent: true })
  expect(s).toMatchObject({ turns: 2, agentTurns: 1, input: 110, output: 80, cacheRead: 890, cacheWrite: 100, longestMs: 9000, agentInput: 5000, agentOutput: 700, model: 'm1' })
  expect(s.last).toMatchObject({ input: 100, output: 30, ms: 9000 })
})

test('tool counts and the top three', () => {
  const s = newStats()
  for (const t of ['Read', 'Read', 'Read', 'Bash', 'Bash', 'Edit', 'Grep']) addTool(s, t)
  addTool(s, 'Bash', true); addTool(s, undefined)
  expect(s.toolCalls).toBe(9); expect(s.errors).toBe(1)
  expect(topTools(s, 3)).toEqual([['Bash', 3], ['Read', 3], ['Edit', 1]])
})

test('cache hit rate, burn rate and output speed', () => {
  expect(near(cacheHit({ input: 100, cacheRead: 800, cacheWrite: 100 }), 0.8)).toBe(true)
  expect(cacheHit({ input: 0, cacheRead: 0, cacheWrite: 0 })).toBeUndefined()
  expect(near(burnRate(6, 3_600_000), 6)).toBe(true)
  expect(burnRate(1, 119_999)).toBeUndefined() // under two minutes: too noisy
  expect(burnRate(0, 3_600_000)).toBeUndefined()
  expect(near(burnRate(1, 120_000), 30)).toBe(true)
  expect(near(outputSpeed(500, 10_000), 50)).toBe(true)
  expect(outputSpeed(0, 10_000)).toBeUndefined()
  expect(outputSpeed(500, 0)).toBeUndefined()
  expect(outputSpeed(NaN, NaN)).toBeUndefined()
})

test('absent and absurd data never yields NaN', () => {
  const s = newStats()
  addTurn(s, undefined); addTurn(s, { input_tokens: NaN, output_tokens: -4, cache_read_input_tokens: Infinity }, { ms: NaN })
  expect(s).toMatchObject({ turns: 2, input: 0, output: 0, cacheRead: 0, longestMs: 0 })
  expect(bandNumbers(s, undefined)).toEqual({ inTok: 0, outTok: 0 })
  expect(bandPieces(bandNumbers(s, 'junk'))).toEqual([])
  const t = statsText({ stats: s, now: NaN, startedAt: NaN, costUsd: NaN, contextTokens: NaN, contextWindow: NaN, limits: [null, { kind: 5 }, { kind: 'five_hour', percentUsed: NaN }], lifetime: 'junk' })
  expect(t).not.toMatch(/NaN|undefined|Infinity|null/)
})

test('junk lifetime values are cleaned, and totals add up', () => {
  expect(sanitizeLifetime(null)).toEqual(emptyLifetime())
  expect(sanitizeLifetime([1, 2])).toEqual(emptyLifetime())
  expect(sanitizeLifetime({ sessions: 'x', turns: -3, toolCalls: NaN, inputTokens: Infinity, outputTokens: 7.9, cost: '5', longestMs: {} })).toEqual({ ...emptyLifetime(), outputTokens: 7 })
  let lt = addLifetime('garbage' as any, { sessions: 1, turns: 1, toolCalls: 4, inputTokens: 1000, outputTokens: 200, cost: 0.5, longestMs: 9000, turnTools: 4 })
  lt = addLifetime(lt, { turns: 1, toolCalls: 2, cost: NaN, longestMs: 1000, turnTools: 2 })
  expect(lt).toEqual({ sessions: 1, turns: 2, toolCalls: 6, inputTokens: 1000, outputTokens: 200, cost: 0.5, longestMs: 9000, bestTurnTools: 4 })
})

test('resets-in reads an ISO time', () => {
  const now = Date.parse('2026-01-01T00:00:00Z')
  expect(resetsIn('2026-01-01T00:45:00Z', now)).toBe('45m')
  expect(resetsIn('2026-01-01T02:14:00Z', now)).toBe('2h 14m')
  expect(resetsIn('2026-01-04T04:00:00Z', now)).toBe('3d 4h')
  expect(resetsIn('2025-12-31T00:00:00Z', now)).toBe('now')
  expect(resetsIn('nope', now)).toBe('—')
  expect(resetsIn(undefined, now)).toBe('—')
})

test('the 5-hour piece is amber from 70 and red from 90', () => {
  const tone = (p: number) => bandPieces({ fiveHour: p }).find(x => x.text.startsWith('5h'))?.tone
  expect([10, 70, 89, 90, 100].map(tone)).toEqual(['arc', 'amber', 'amber', 'red', 'red'])
})

// ── the stats text ──────────────────────────────────────────────────────────
test('the report has every section and aligned columns', () => {
  const s = newStats()
  addTurn(s, { input_tokens: 1000, output_tokens: 3100, cache_read_input_tokens: 9000, cache_creation_input_tokens: 2400, model: 'claude-x' }, { ms: 62_000, cost: 0.4 })
  for (const t of ['Read', 'Read', 'Bash', 'Edit']) addTool(s, t)
  s.last!.cost = 0.42
  const now = Date.parse('2026-01-01T01:00:00Z')
  const t = statsText({
    stats: s, now, model: 'sonnet', startedAt: now - 3_600_000, contextTokens: 82_400, contextWindow: 200_000, costUsd: 6,
    limits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-01-01T02:14:00Z' }, { kind: 'seven_day', percentUsed: 7.4, resetsAt: '2026-01-04T04:00:00Z' }],
    lifetime: { sessions: 12, turns: 340, toolCalls: 2100, inputTokens: 4_200_000, outputTokens: 310_000, cost: 88.1 },
  })
  for (const h of ['MISSION REPORT', 'SESSION', 'TOKENS', 'COST', 'RATE LIMITS', 'LIFETIME']) expect(t).toContain(h)
  expect(t).toContain('1h 00m'); expect(t).toContain('sonnet'); expect(t).toContain('Read ×2')
  expect(t).toContain('82.4k / 200.0k  (41%)')
  expect(t).toContain('$6.00/h'); expect(t).toContain('$0.42')
  expect(t).toContain('5-hour window'); expect(t).toContain('42% used · resets in 1h 14m'); expect(t).toContain('7-day window')
  expect(t).toContain('cache hit'); expect(t).toContain('73%')
  expect(t).toContain('$88.10')
  expect(t).not.toMatch(/NaN|undefined|\x1b/)
})

test('an empty session shows dashes, not junk', () => {
  const t = statsText({ stats: newStats(), now: 1000 })
  expect(t).toContain('—'); expect(t).not.toMatch(/NaN|undefined|null/)
})

// ── in the mod ──────────────────────────────────────────────────────────────
const findRaster = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(findRaster).find(Boolean))
function rasterText(n: any): string {
  const r = findRaster(n)
  if (!r) return ''
  const bin = atob(r.props.cells), u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  const w = new Uint32Array(u8.buffer), out: string[] = []
  for (let y = 0; y < r.props.rows; y++) { const row: string[] = []; for (let x = 0; x < r.props.columns; x++) row.push(String.fromCodePoint(w[(y * r.props.columns + x) * 3]!)); out.push(row.join('')) }
  return out.join('\n')
}
const band = async ($: any, props: Record<string, unknown> = {}) => {
  const m = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 100, scroll: { bodyRows: 19 }, view: {}, ...props } })
  const d = await m.drawn()
  return { text: rasterText(d), rows: findRaster(d)?.props.rows as number }
}
const usageWith = (cost: number, limits: any[] = [], tokens = 82400) => () => ({ value: { startedAt: 0, cost: { usd: cost }, context: { window: 200000, percent: 41, tokens }, rateLimits: limits } })
const TURN_USAGE = { input_tokens: 2000, output_tokens: 3100, cache_read_input_tokens: 8000, cache_creation_input_tokens: 2400, model: 'claude-x' }
function session(on: any, o: { usage?: () => any; turnUsage?: any; store?: Record<string, unknown> } = {}) {
  mock.store(on, o.store)
  mock.env(on, { COLORTERM: 'truecolor' })
  const clock = mock.clock(on, { now: 0 })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'sonnet' }))
  on('session.usage', o.usage ?? usageWith(1.5))
  on('command.register', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('ui.toast', () => ({ value: undefined }))
  on('tool.call', () => ({ result: { ok: true } }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '', reason: 'answer', ...(o.turnUsage ? { usage: o.turnUsage } : {}) }) as any)
  return clock
}
const start = ($: any, cwd = '/work/auth-api') => $.session.start({ cwd, surface: 'terminal', isInteractive: true })
const run = async ($: any, tools = 2, ms = 9000) => {
  await $.turn.start({ text: 'go', turnId: 't1' })
  for (let i = 0; i < tools; i++) await $.tool.call({ tool: i % 2 ? 'Bash' : 'Read', file_path: '/a' } as any)
  return $.turn.complete({ answer: 'ok', durationMs: ms, isAborted: false, turnId: 't1', reason: 'answer' })
}
const hero = ($: any, args: string) => $.command.run({ command: 'clarvis', args } as any)

test('/clarvis stats reports a session with turns, tools, tokens and lifetime', async ($, on) => {
  const clock = session(on, { turnUsage: TURN_USAGE, usage: usageWith(2.5, [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-01-01T02:14:00Z' }]) })
  await start($); await clock.advance(6000)
  const r = await run($)
  expect((r as any).usage).toMatchObject({ output_tokens: 3100 }) // observed, passed on untouched
  const t = String(((await hero($, 'stats')) as any).text)
  for (const h of ['MISSION REPORT', 'SESSION', 'TOKENS', 'COST', 'RATE LIMITS', 'LIFETIME']) expect(t).toContain(h)
  expect(t).toContain('Read ×1'); expect(t).toContain('12.4k'); expect(t).toContain('3.1k'); expect(t).toContain('$2.50'); expect(t).toContain('5-hour window')
  expect(t).not.toMatch(/NaN|undefined/)
  expect(t).toMatch(/sessions\s+1\n/); expect(t).toMatch(/tool calls\s+2\n[\s\S]*tool calls\s+2\n/); expect(t).toContain('↑12.4k ↓3.1k')
})

test('/clarvis stats works with no turn yet and with junk in the store; reset clears lifetime', async ($, on) => {
  const clock = session(on, { store: { lifetime: { sessions: 'many', turns: NaN, cost: -9, toolCalls: Infinity, inputTokens: 'x' } } })
  await start($); await clock.advance(6000)
  const t = String(((await hero($, 'stats')) as any).text)
  expect(t).not.toMatch(/NaN|undefined|Infinity|-9/)
  await run($)
  const t2 = String(((await hero($, 'stats')) as any).text)
  expect(t2).toMatch(/LIFETIME[\s\S]*turns\s+1\n/)
  expect(String(((await hero($, 'stats reset')) as any).text)).toContain('cleared')
  expect(String(((await hero($, 'stats')) as any).text)).toMatch(/LIFETIME\n\s+sessions\s+0\n\s+turns\s+0\n/)
})

test('/clarvis help mentions stats', async ($, on) => {
  session(on)
  await start($)
  expect(String(((await hero($, '')) as any).text)).toContain('stats')
})

test('the idle line shows tokens, cache and the 5-hour window when wide', async ($, on) => {
  const clock = session(on, { turnUsage: TURN_USAGE, usage: usageWith(1.5, [{ kind: 'five_hour', percentUsed: 42 }]) })
  await start($); await clock.advance(6000)
  await run($)
  await clock.advance(15000)
  const wide = await band($, { bodyColumns: 200 })
  expect(wide.text).toContain('↑12.4k ↓3.1k'); expect(wide.text).toContain('cache 65%'); expect(wide.text).toContain('5h 42%')
  expect(wide.rows).toBe(1)
})

const NAME = '/work/' + '日本語🚀名前'.repeat(5)
for (const [name, limits] of [['without limits', []], ['with a 5-hour limit', [{ kind: 'five_hour', percentUsed: 95 }, { kind: 'seven_day', percentUsed: 10 }]]] as const) {
  test(`idle is one row and keeps the spend at 40..240 columns with big numbers ${name}`, async ($, on) => {
    const clock = session(on, {
      turnUsage: { input_tokens: 12_300_000, output_tokens: 4_500_000, cache_read_input_tokens: 9_000_000, cache_creation_input_tokens: 1, model: 'x' },
      usage: usageWith(1234.56, limits as any, 12_300_000),
    })
    await start($, NAME); await clock.advance(6000)
    await run($)
    await clock.advance(15000)
    for (const w of [40, 60, 80, 120, 200, 240]) {
      const b = await band($, { bodyColumns: w })
      expect(b.rows).toBe(1)
      expect(b.text.split('\n').length).toBe(1)
      expect([...b.text].length).toBe(w)
      expect(b.text).toContain('$1234.56')
      expect(b.text).not.toMatch(/NaN|undefined/)
    }
  })
}

test('the working band shows the cost and context while working', async ($, on) => {
  const clock = session(on, { turnUsage: TURN_USAGE })
  await start($); await clock.advance(6000)
  await $.turn.start({ text: 'go', turnId: 't1' })
  const b = await band($, { isWorking: true, bodyColumns: 160 })
  expect(b.text).toContain('REACTOR'); expect(b.text).toContain('$1.50 spent')
})

test('ASSEMBLE adds the turn tokens', async ($, on) => {
  const clock = session(on, { turnUsage: TURN_USAGE })
  await start($); await clock.advance(6000)
  await run($)
  await clock.advance(3600 + 2600)
  expect((await band($, { bodyColumns: 200 })).text).toContain('↑12.4k ↓3.1k')
})
