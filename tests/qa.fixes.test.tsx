import { expect } from 'claude-code/testing'
import { test } from './timed'
import { CLIP_PRIORITY, SOUND_GAP_MS, soundGate, coinReady } from '../hooks/sound'
import { K, session, start, hero, begin, done, lastFx, band, rasterRow } from './kit'

const commitTool = (e: any) => (e.tool === 'Bash' ? { result: { stdout: '[main abc1234] fix\n 1 file changed\n', stderr: '' } } : { result: { ok: true } })
const failing = (e: any) => (e.command === 'false' ? { result: { ok: false }, isError: true } : { result: { ok: true } }) as any
const clipsOf = (plays: any[]) => plays.map(p => p.base64.length)
const gate = (o: object) => soundGate({ on: true, mode: 'full', now: 10_000, lastAt: 9_000, burstAt: -1e12, ...o } as any)

// ── 1. Thanos ───────────────────────────────────────────────────────────────
test('a turn whose last tool failed ends in the snap and the whomp, not the fanfare', async ($, on) => {
  const plays: any[] = []
  session(on, { tool: failing, plays }); await start($); await hero($, 'sound on'); plays.length = 0
  await begin($)
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  await done($)
  expect(lastFx()?.moment).toBe('snap')
  expect(plays).toHaveLength(1)
})
test('a recovered turn plays the fanfare, not the whomp', async ($, on) => {
  const plays: any[] = []
  session(on, { tool: failing, plays }); await start($); await hero($, 'sound on'); plays.length = 0
  await begin($)
  await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  await $.tool.call({ tool: 'Bash', command: 'true' } as any)
  await done($)
  expect(lastFx()?.moment).toBe('assemble')
  expect(plays).toHaveLength(1)
})

// ── 2. sound priorities ─────────────────────────────────────────────────────
test('soundGate: a higher-priority clip plays inside the gap, a lower or equal one never', () => {
  expect(CLIP_PRIORITY.levelup).toBeGreaterThan(CLIP_PRIORITY.boot)
  expect(CLIP_PRIORITY.boot).toBeGreaterThan(CLIP_PRIORITY.coin)
  expect(gate({ name: 'levelup', lastName: 'coin' })).toBe(true)
  expect(gate({ name: 'assemble', lastName: 'boot' })).toBe(true)
  expect(gate({ name: 'whomp', lastName: 'coin' })).toBe(true)
  expect(gate({ name: 'boot', lastName: 'coin' })).toBe(true)
  expect(gate({ name: 'coin', lastName: 'levelup' })).toBe(false)
  expect(gate({ name: 'coin', lastName: 'coin' })).toBe(false)
  expect(gate({ name: 'assemble', lastName: 'levelup' })).toBe(false)
  expect(gate({ name: 'boot', lastName: 'assemble' })).toBe(false)
  expect(gate({ name: 'coin', lastName: 'coin', lastAt: 10_000 - SOUND_GAP_MS })).toBe(true) // out of the gap: anyone plays
  expect(gate({ name: 'levelup', lastName: 'coin', burstAt: 9_500 })).toBe(false) // a burst still silences everything
  expect(gate({ lastAt: 9_000 })).toBe(false) // unnamed callers keep the old rule
})
test('coinReady: only once due and out of the gap', () => {
  expect(coinReady({ now: 5000, dueAt: 0, lastAt: -1e12 })).toBe(false)
  expect(coinReady({ now: 1000, dueAt: 1500, lastAt: -1e12 })).toBe(false)
  expect(coinReady({ now: 1999, dueAt: 1500, lastAt: 0 })).toBe(false)
  expect(coinReady({ now: 2000, dueAt: 1500, lastAt: 0 })).toBe(true)
})
test('a trophy earned mid-turn does not swallow the end-of-turn clip; its coin comes after', async ($, on) => {
  const plays: any[] = []
  const clock = session(on, { tool: commitTool, plays }); await start($); await hero($, 'sound on'); await clock.advance(5000); plays.length = 0
  await begin($)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' } as any) // First Commit
  expect(K.db.get('trophies')).toMatchObject({ firstCommit: expect.any(Number) })
  expect(plays).toHaveLength(0) // no coin while the turn runs
  await clock.advance(1600)
  await done($)
  expect(plays).toHaveLength(1) // the end-of-turn clip
  const end = plays[0].clip.base64
  await clock.advance(3000)
  expect(plays.length).toBe(2)
  expect(plays[1].clip.base64).not.toBe(end)
})

// ── 3. Fury ─────────────────────────────────────────────────────────────────
test('a short chat answer ending in "?" gets no Fury moment; a real task does', async ($, on) => {
  session(on); await start($); await begin($)
  await done($, { answer: 'Hello! What can I help you with?', durationMs: 1500 })
  expect(lastFx()?.moment ?? null).not.toBe('fury')
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  await done($, { answer: 'Shall I ship it?', durationMs: 1500 })
  expect(lastFx()?.moment).toBe('fury')
  await begin($)
  await done($, { answer: 'Which one do you want?', durationMs: 6000 })
  expect(lastFx()?.moment).toBe('fury')
})

// ── 4. no literal fences ────────────────────────────────────────────────────
test('no /clarvis reply carries literal ``` fences', async ($, on) => {
  session(on); await start($)
  for (const a of ['', 'stats', 'card', 'card week', 'trophies', 'help', 'sound', 'play', 'movies', 'movie 0', 'movie', 'team', 'pick', 'mode']) {
    const t = await hero($, a, { isFullscreen: true })
    expect(t).not.toContain('```')
  }
  const t = await hero($, '')
  expect(t).toContain('CLARVIS')
  expect(t.split('\n').some((l: string) => l.startsWith('  /clarvis '))).toBe(true)
})

// ── 5. glyphs ───────────────────────────────────────────────────────────────
// a '?' that is a real question follows a word ("outlaw?"); a sanitized glyph stands alone or sits against a number
const noQ = (t: string) => { expect(t).not.toMatch(/(?:^|[\s▌│])\?|\?[$\d]/m) }
test('the working band shows the live-turn cost as plain text, not a wide glyph', async ($, on) => {
  const clock = session(on, { tool: commitTool }); await start($); await clock.advance(4000); await begin($)
  await $.tool.call({ tool: 'Read', file_path: '/x' } as any)
  await clock.advance(1000)
  const all: string[] = []
  for (const cols of [120, 100, 70, 60]) {
    const d = await band($, cols, { isWorking: true })
    const find = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(find).find(Boolean))
    const r = find(d)
    for (let y = 0; y < r.props.rows; y++) all.push(rasterRow(d, y))
    noQ(all.join('\n'))
    all.length = 0
  }
})
test('idle, moments and lite at 120 columns draw no "?" garbage', async ($, on) => {
  const clock = session(on, { tool: failing }); await start($); await clock.advance(4000)
  const text = async (cols: number, props: Record<string, unknown> = {}) => {
    const d = await band($, cols, props)
    const find = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(find).find(Boolean))
    const r = find(d); const out: string[] = []
    if (!r) return JSON.stringify(d)
    for (let y = 0; y < r.props.rows; y++) out.push(rasterRow(d, y))
    expect(r.props.columns).toBeLessThanOrEqual(cols)
    return out.join('\n')
  }
  noQ(await text(120))
  await begin($); await $.tool.call({ tool: 'Bash', command: 'false' } as any)
  noQ(await text(120, { isWorking: true }))
  await done($); noQ(await text(120)) // snap
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/x' } as any); await done($, { answer: 'done.' }); noQ(await text(120)) // assemble
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/x' } as any); await done($, { answer: 'Ship it?' })
  const f = await text(120); expect(f).toContain('NICK FURY'); expect(f.replace('Ship it?', '').replace(/\?/g, '')).toBeTruthy()
  await hero($, 'lite'); await clock.advance(200000)
  noQ(await text(120)); noQ(await text(120, { isWorking: true }))
})

// ── 6. copy ─────────────────────────────────────────────────────────────────
test('play and movies do not claim fullscreen is needed when already in it', async ($, on) => {
  session(on); await start($)
  for (const a of ['play', 'movies', 'movie 3']) {
    const fs = await hero($, a, { isFullscreen: true })
    expect(fs).not.toMatch(/needs Claude Code's fullscreen/i)
    const no = await hero($, a, { isFullscreen: false })
    expect(no).toMatch(/fullscreen/i)
  }
  expect(await hero($, 'play', { isFullscreen: true })).toContain('Click the pane, then 1–5 or ↑↓ SPACE')
  expect(await hero($, 'movies', { isFullscreen: true })).toContain('Click a movie or press 1–0')
})
test('/clarvis movie 0 opens #10 with no doubled punctuation, and the usage says 0 is #10', async ($, on) => {
  session(on); await start($)
  const t = await hero($, 'movie 0', { isFullscreen: true })
  expect(t).toContain('#10')
  expect(t).not.toMatch(/\?\.|!\.|\.\.\.\./)
  expect(t).toContain('WHAT IF...? P pauses')
  expect(await hero($, 'movie')).toContain('0 for 10')
  expect(await hero($, '', { isFullscreen: true })).toContain('movie <1-9|0|name|next>')
})

// ── 7. narrow terminals ─────────────────────────────────────────────────────
test('at 60 and 70 columns the idle line, working band and moments stay clean and in width; the gauge falls back to CTX', async ($, on) => {
  const clock = session(on, { tool: commitTool }); await start($); await clock.advance(4000)
  const grab = async (cols: number, props: Record<string, unknown> = {}) => {
    const d = await band($, cols, props)
    const find = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(find).find(Boolean))
    const r = find(d); const rows: string[] = []
    for (let y = 0; y < r.props.rows; y++) rows.push(rasterRow(d, y))
    expect(r.props.columns).toBeLessThanOrEqual(cols)
    for (const row of rows) expect([...row].length).toBeLessThanOrEqual(cols)
    return rows.join('\n')
  }
  let sawCtx = false
  expect(await grab(70)).toContain('REACTOR'); noQ(await grab(70))
  { const idle = await grab(60); noQ(idle); expect(idle).toMatch(/REACTOR|CTX/) }
  for (const cols of [55, 50]) { const idle = await grab(cols); noQ(idle); sawCtx ||= idle.includes('CTX'); expect(idle).not.toContain('REACTOR') }
  expect(sawCtx).toBe(true)
  await begin($); await $.tool.call({ tool: 'Read', file_path: '/x' } as any); await clock.advance(1000)
  for (const cols of [70, 60]) noQ(await grab(cols, { isWorking: true }))
  await done($, { answer: 'done.' })
  for (const cols of [70, 60]) noQ(await grab(cols))
})
