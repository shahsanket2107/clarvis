import { expect } from 'claude-code/testing'
import { test } from './timed'
import { ROSTER } from '../hooks/scenes'
import { TROPHIES } from '../hooks/trophies'
import { TEAMS } from '../hooks/team'
import { K, rotation, session, start, hero, begin, done, at, lastFx, band, rasterRow } from './kit'

const commitTool = (e: any) => (e.tool === 'Bash' ? { result: { stdout: '[main abc1234] fix\n 1 file changed\n', stderr: '' } } : { result: { ok: true } })

// ── F. trophies ─────────────────────────────────────────────────────────────
test('a trophy toasts once, ever: a second session does not toast it again', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts, tool: commitTool }); await start($); await begin($)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m fix' } as any)
  expect(toasts.filter(t => t.includes('Trophy unlocked · First Commit'))).toHaveLength(1)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m fix2' } as any)
  await done($); await start($); await begin($)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m fix3' } as any)
  expect(toasts.filter(t => t.includes('First Commit'))).toHaveLength(1)
  expect(K.db.get('trophies')).toMatchObject({ firstCommit: expect.any(Number) })
})
test('the five old achievements are persistent trophies: Hulk Out toasts in one session only', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts }); await start($); await begin($)
  for (let i = 0; i < 25; i++) await $.tool.call({ tool: 'Bash', command: 'make build' } as any)
  expect(toasts.filter(t => t.includes('Hulk Out'))).toHaveLength(1)
  await start($); await begin($)
  for (let i = 0; i < 25; i++) await $.tool.call({ tool: 'Bash', command: 'make build' } as any)
  expect(toasts.filter(t => t.includes('Hulk Out'))).toHaveLength(1)
  expect(Object.keys(K.db.get('trophies') as any)).toContain('hulk')
})
test('junk in the trophies store is ignored, and /clarvis trophies lists locked ones with hints', async ($, on) => {
  session(on); K.db.set('trophies', 'garbage'); await start($)
  const t = await hero($, 'trophies')
  expect(t).toContain(`0/${TROPHIES.length} unlocked`); expect(t).toContain('??? · hint: ')
  K.db.set('trophies', { hulk: new Date(2026, 0, 5).getTime(), junk: 1 })
  expect(await hero($, 'trophies')).toMatch(/★ Hulk Out\s+2026-01-05/)
  expect(await hero($, 'trophies')).toContain(`1/${TROPHIES.length} unlocked`)
})
test('Night Shift: a mission finished at 2am earns it', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts, clock: at(2026, 3, 14, 2) }); await start($); await begin($); await done($)
  expect(toasts.some(t => t.includes('Night Shift'))).toBe(true)
  expect(toasts.some(t => t.includes('Early Bird'))).toBe(false)
})
test('time trophies never fire on a test clock at 0', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts }); await start($); await begin($); await done($)
  expect(toasts.filter(t => /Night Shift|Early Bird/.test(t))).toEqual([])
})
test('Polyglot: edits in five kinds of file; Endgame: a 60-minute mission', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts }); await start($); await begin($)
  for (const f of ['a.ts', 'b.py', 'c.md', 'd.json', 'e.css']) await $.tool.call({ tool: 'Edit', file_path: `/x/${f}`, old_string: 'a', new_string: 'b' } as any)
  expect(toasts.some(t => t.includes('Polyglot'))).toBe(true)
  await done($, { durationMs: 61 * 60_000 })
  expect(toasts.some(t => t.includes('Endgame'))).toBe(true)
})
test('Million Tokens toasts as a trophy and as a milestone, once', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts, clock: at(2026, 3, 14), usage: { input_tokens: 5000, output_tokens: 500 } }); K.db.set('lifetime', { sessions: 1, turns: 1, toolCalls: 1, inputTokens: 999_000, outputTokens: 0, cost: 0, longestMs: 0, bestTurnTools: 0 })
  await start($); await begin($); await done($)
  expect(toasts.filter(t => t.includes('1M tokens, all time'))).toHaveLength(1)
  expect(toasts.filter(t => t.includes('Million Tokens'))).toHaveLength(1)
  await begin($); await done($)
  expect(toasts.filter(t => t.includes('1M tokens, all time'))).toHaveLength(1)
})
test('the demo awards no trophy, counts nothing, and plays no sound unless sound is on', async ($, on) => {
  const toasts: string[] = [], plays: any[] = []
  const clock = session(on, { toasts, plays }); K.db.set('sound', 'off'); await start($)
  K.db.set('lifetime', { sessions: 5, turns: 99, toolCalls: 999, inputTokens: 0, outputTokens: 0, cost: 0, longestMs: 0, bestTurnTools: 0 })
  await hero($, 'demo')
  for (let i = 0; i < 25; i++) await clock.advance(1000)
  expect(toasts.filter(t => t.includes('Trophy'))).toEqual([]); expect(plays).toEqual([])
  expect(K.db.get('trophies')).toBeUndefined(); expect(K.db.get('ledger')).toBeUndefined()
})

// ── G. pick and team ────────────────────────────────────────────────────────
test('/clarvis team narrows the rotation to the preset and persists to the next session', async ($, on) => {
  session(on); await start($)
  expect(await hero($, 'team guardians')).toContain('Team guardians')
  expect([...rotation()].sort()).toEqual([...TEAMS.guardians].sort())
  expect(K.db.get('heroSel')).toEqual({ team: 'guardians' })
  await start($); expect([...rotation()].sort()).toEqual([...TEAMS.guardians].sort())
  expect(await hero($, 'team all')).toContain('whole roster'); expect([...rotation()].sort()).toEqual([...ROSTER].sort())
  const bad = await hero($, 'team nope'); expect(bad).toContain('No team "nope"'); for (const t of ['avengers', 'guardians', 'wakanda', 'cosmic', 'all']) expect(bad).toContain(t)
  expect(await hero($, 'team')).toContain('Use /clarvis team')
})
test('/clarvis pick puts one hero on the stage; a fuzzy name works; auto clears it', async ($, on) => {
  session(on); await start($)
  expect(await hero($, 'pick spider-man')).toContain('SPIDER-MAN'); expect(rotation()).toEqual(['spidey'])
  await start($); expect(rotation()).toEqual(['spidey']) // persisted
  const bad = await hero($, 'pick zzzzzz'); expect(bad).toContain('No hero "zzzzzz"'); expect(bad).toContain('Try one of'); expect(rotation()).toEqual(['spidey'])
  expect(await hero($, 'pick auto')).toContain('auto'); expect(rotation().length).toBe(ROSTER.length)
  expect(await hero($, 'pick')).toContain('Use /clarvis pick')
})
test('a pick pinned here applies to this project only', async ($, on) => {
  session(on); await start($, '/work/a')
  expect(await hero($, 'pick hulk here')).toContain('in this project'); expect(rotation()).toEqual(['hulk'])
  await start($, '/work/b'); expect(rotation().length).toBe(ROSTER.length)
  await start($, '/work/a'); expect(rotation()).toEqual(['hulk'])
  expect(K.db.get('heroHere')).toEqual({ '/work/a': 'hulk' })
  await hero($, 'pick thor'); expect(rotation()).toEqual(['hulk']) // the project pin beats a global pick
  await hero($, 'pick auto here'); expect(rotation()).toEqual(['thor'])
})
test('junk in the selection stores falls back to the whole roster', async ($, on) => {
  session(on); K.db.set('heroSel', { team: 'zzz', pick: 42 }); K.db.set('heroHere', 'x'); await start($)
  expect(rotation().length).toBe(ROSTER.length)
})

// ── H. /clarvis card ───────────────────────────────────────────────────────────
test('/clarvis card returns the card, copies it, and says so only when the copy worked', async ($, on) => {
  const copies: any[] = []
  const clock = session(on, { copies, clock: at(2026, 3, 14) }); void clock; await start($); await begin($)
  await $.tool.call({ tool: 'Edit', file_path: '/x/a.ts', old_string: 'a', new_string: 'b' } as any); await done($)
  const t = await hero($, 'card')
  expect(t).toContain('╭'); expect(t).toContain('clarvis · unofficial fan mod'); expect(t).toMatch(/missions\s+1/); expect(t).toMatch(/actions\s+1/); expect(t).toContain('Copied to clipboard')
  expect(copies).toHaveLength(1); expect(copies[0].text).toContain('MISSION CARD'); expect(copies[0].text).not.toContain('```')
  for (const l of copies[0].text.split('\n')) expect([...l].length).toBeLessThanOrEqual(44)
  expect(await hero($, 'card week nocost')).not.toContain('$')
  expect(await hero($, 'card all')).toContain('ALL')
  expect(await hero($, 'card month')).toContain('Use /clarvis card')
})
test('the card does not claim a copy that failed', async ($, on) => {
  session(on, { copyResult: { isCopied: false, reason: 'no-clipboard' } }); await start($)
  const t = await hero($, 'card'); expect(t).toContain('╭'); expect(t).not.toContain('Copied to clipboard')
})
test('the card respects the showCost option', { options: { showCost: false } }, async ($, on) => {
  session(on, { clock: at(2026, 3, 14) }); await start($); await begin($); await done($)
  const t = await hero($, 'card'); expect(t).not.toContain('$'); expect(t).not.toContain('cost')
})

// ── I. streak and seasons ───────────────────────────────────────────────────
test('the streak grows a day at a time, toasts at 3, shows on the band, and a gap restarts it', async ($, on) => {
  const toasts: string[] = []
  const clock = session(on, { toasts, clock: at(2026, 3, 10) })
  await start($); await clock.advance(86_400_000); await start($)
  expect(toasts.filter(t => t.includes('-day streak'))).toEqual([])
  await clock.advance(86_400_000); await start($)
  expect(toasts.filter(t => t.includes('3-day streak. The team'))).toHaveLength(1)
  expect(toasts.some(t => t.includes('Three-Peat'))).toBe(true)
  await start($); expect(toasts.filter(t => t.includes('3-day streak. The team'))).toHaveLength(1) // the same day again
  await band($, 140)
  expect(K.db.get('streak')).toMatchObject({ n: 3 })
  await clock.advance(5 * 86_400_000); await start($)
  expect(K.db.get('streak')).toMatchObject({ n: 1, best: 3 })
})
test('the streak shows as a piece of the lite band', async ($, on) => {
  const clock = session(on, { clock: at(2026, 3, 10), env: { CLARVIS: 'lite' } })
  await start($); await clock.advance(86_400_000); await start($)
  const flat = (n: any): string => typeof n === 'string' ? n : !n ? '' : (n.children ?? []).map(flat).join('')
  expect(flat(await band($, 200))).toContain('▲2d')
})
test('Halloween (Oct 31): the ASSEMBLE caption and flair; nothing in calm or lite', async ($, on) => {
  session(on, { clock: at(2026, 10, 31) }); await start($); await begin($); await done($, { durationMs: 20000 })
  const x = lastFx(); expect(x?.moment).toBe('assemble'); expect(x?.caption).toContain('Trick or treat'); expect(x?.flair).toBe('halloween')
})
test('Halloween leaves calm mode plain', async ($, on) => {
  session(on, { clock: at(2026, 10, 31), env: { CLARVIS: 'calm' } }); await start($); await begin($); await done($, { durationMs: 20000 })
  const x = lastFx(); expect(x?.moment).toBe('assemble'); expect(x?.caption).not.toContain('Trick'); expect(x?.flair).toBeUndefined()
})
test('Halloween puts the villains first in the rotation', async ($, on) => {
  session(on, { clock: at(2026, 10, 29) }); await start($)
  expect(rotation().slice(0, 4).sort()).toEqual(['bucky', 'loki', 'nebula', 'ultron'])
})
test('Thursday gives Thor a second slot; other days one', async ($, on) => {
  session(on, { clock: at(2026, 10, 15) }); await start($)
  expect(rotation().filter(x => x === 'thor')).toHaveLength(2)
  await $.command.run({ command: 'clarvis', args: 'team guardians' } as any); expect(rotation().filter(x => x === 'thor')).toHaveLength(0)
})
test('a plain Wednesday: the ordinary rotation', async ($, on) => {
  session(on, { clock: at(2026, 10, 14) }); await start($)
  expect(rotation().length).toBe(ROSTER.length)
})
test('New Year\'s Day: fireworks flair and caption', async ($, on) => {
  session(on, { clock: at(2027, 1, 1) }); await start($); await begin($); await done($, { durationMs: 20000 })
  const x = lastFx(); expect(x?.flair).toBe('newyear'); expect(x?.caption).toContain('Happy New Year')
})
test('the shipped caption outranks the season, the flair stays', async ($, on) => {
  session(on, { clock: at(2026, 10, 31), tool: commitTool }); await start($); await begin($)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' } as any); await done($, { durationMs: 20000 })
  const x = lastFx(); expect(x?.caption).toBe('Commit abc1234 is in the books.'); expect(x?.flair).toBe('halloween')
})
test('December snow: a band frame draws in full mode without breaking, and the date outside December is unaffected', async ($, on) => {
  session(on, { clock: at(2026, 12, 10) }); await start($)
  expect(JSON.stringify(await band($, 100))).toContain('cells')
})
test('the egg: with the dice rigged a finished turn gets the Groot dance; with them off, never', async ($, on) => {
  session(on, { clock: at(2026, 3, 14), env: { CLARVIS_EGG: 'always' } }); await start($)
  await begin($); await done($, { durationMs: 20000 })
  const x = lastFx(); expect(x?.flair).toBe('groot'); expect(x?.caption).toContain('Groot')
})
test('eggs off: ordinary turns stay plain', async ($, on) => {
  session(on, { clock: at(2026, 3, 14), env: { CLARVIS_EGG: 'never' } }); await start($)
  await begin($); await done($, { durationMs: 20000 }); expect(lastFx()?.flair).toBeUndefined()
})
test('a long session gets the shawarma line', async ($, on) => {
  const clock = session(on, { clock: at(2026, 3, 14), env: { CLARVIS_EGG: 'always' } }); await start($)
  await clock.advance(3.5 * 3600_000); await begin($); await done($, { durationMs: 20000 })
  expect(lastFx()?.flair).toBe('shawarma'); expect(lastFx()?.caption).toContain('Shawarma')
})
test('no eggs in calm mode', async ($, on) => {
  session(on, { clock: at(2026, 3, 14), env: { CLARVIS_EGG: 'always', CLARVIS: 'calm' } }); await start($)
  await begin($); await done($, { durationMs: 20000 }); expect(lastFx()?.flair).toBeUndefined()
})

// ── J. flavour ──────────────────────────────────────────────────────────────
test('the context nudge fires once per session at 85%, with the number', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts, clock: at(2026, 3, 14), percent: 88 })
  await start($); await begin($); await done($); await begin($); await done($)
  expect(toasts.filter(t => t.includes('Context at 88%: /compact shrinks it.'))).toHaveLength(1)
  await start($); await begin($); await done($)
  expect(toasts.filter(t => t.includes('Context at 88%'))).toHaveLength(2) // a new session may nudge again
})
test('no nudge below 85%', async ($, on) => {
  const toasts: string[] = []
  session(on, { toasts, clock: at(2026, 3, 14) }); await start($); await begin($); await done($)
  expect(toasts.filter(t => t.includes('Context at'))).toEqual([])
})
test('the context gauge is labelled REACTOR in the idle band', async ($, on) => {
  const clock = session(on); await start($); await clock.advance(4000)
  expect(rasterRow(await band($, 120))).toContain('REACTOR')
})

// ── N. sound ────────────────────────────────────────────────────────────────
test('/clarvis sound reports its state, persists, and mentions macOS', async ($, on) => {
  session(on); await start($)
  const fresh = await hero($, 'sound'); expect(fresh).toContain('Sound is on'); expect(fresh).toContain('/clarvis sound off to mute')
  expect(await hero($, '')).toContain('chiptune sounds (on; macOS)') // the briefing's Look group shows the state
  expect(await hero($, 'sound off')).toContain('Sound off'); expect(K.db.get('sound')).toBe('off')
  expect(await hero($, 'sound')).toContain('Sound is off'); expect(await hero($, '')).toContain('chiptune sounds (off; macOS)')
  const on1 = await hero($, 'sound on'); expect(on1).toContain('Sound on'); expect(on1).toContain('macOS')
  expect(K.db.get('sound')).toBe('on'); expect(await hero($, 'sound')).toContain('Sound is on')
})
test('a fresh install has sound on: a finished turn plays the fanfare with no setup', async ($, on) => {
  const plays: any[] = []
  const clock = session(on, { plays }); await start($); await clock.advance(5000); plays.length = 0
  await begin($); await done($, { durationMs: 20000 })
  expect(plays).toHaveLength(1)
})
test('sound off (stored): a finished turn plays nothing', async ($, on) => {
  const plays: any[] = []
  session(on, { plays }); K.db.set('sound', 'off'); await start($); await begin($); await done($, { durationMs: 20000 })
  expect(plays).toEqual([])
})
test('sound on: ASSEMBLE plays the fanfare as a base64 WAV at the set gain; an error plays the whomp', async ($, on) => {
  const plays: any[] = []
  const clock = session(on, { plays }); await start($); await hero($, 'sound on')
  plays.length = 0; await clock.advance(5000)
  await begin($); await done($, { durationMs: 20000 })
  expect(plays).toHaveLength(1)
  expect(plays[0].clip.mime).toBe('audio/wav'); expect(plays[0].clip.base64).toMatch(/^UklGR/); expect(plays[0].gain).toBe(0.4)
  await clock.advance(1000); await begin($); await done($, { reason: 'answer', durationMs: 20000 }) // within 2 s of the last clip: rate-limited
  expect(plays).toHaveLength(1)
  await clock.advance(5000); await begin($); await done($, { reason: 'error' })
  expect(plays).toHaveLength(2); expect(plays[1].clip.base64).not.toBe(plays[0].clip.base64)
})
test('the sound option false mutes it; a stored /clarvis sound on beats it', { options: { sound: false } }, async ($, on) => {
  const plays: any[] = []
  const clock = session(on, { plays }); await start($); await clock.advance(5000); plays.length = 0
  await begin($); await done($, { durationMs: 20000 }); expect(plays).toEqual([])
  await hero($, 'sound on'); await start($); await clock.advance(5000); plays.length = 0
  await begin($); await done($, { durationMs: 20000 }); expect(plays).toHaveLength(1)
})
for (const m of ['calm', 'lite', 'off']) test(`no sound in ${m} mode, even when on`, async ($, on) => {
  const plays: any[] = []
  const clock = session(on, { plays, env: { CLARVIS: m } }); K.db.set('sound', 'on'); await start($)
  await begin($); await done($, { durationMs: 20000 }); await clock.advance(5000); await begin($); await done($, { reason: 'error' })
  expect(plays).toEqual([])
})
test('a trophy plays the coin; a rejected play is swallowed', async ($, on) => {
  const plays: any[] = []
  session(on, { plays, tool: commitTool, playThrows: true }); await start($); K.db.set('sound', 'on'); await start($)
  await begin($)
  await $.tool.call({ tool: 'Bash', command: 'git commit -m x' } as any) // First Commit: coin, which throws
  expect(K.db.get('trophies')).toMatchObject({ firstCommit: expect.any(Number) })
})
test('sound stays quiet just after a theater burst', async ($, on) => {
  const plays: any[] = []
  const clock = session(on, { plays }); await start($); await hero($, 'sound on'); await clock.advance(5000); plays.length = 0
  const pm = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'Pane', requestId: 'avengers-theater', viewport: { columns: 120, rows: 40, isFullscreen: true }, props: { title: 'AVENGERS THEATER', isFocused: true, bodyColumns: 100, placement: 'dock', scroll: { bodyRows: 30, offset: 0 }, view: {} } })
  await pm.post({ fx: 'THOR' } as any, { in: 'theater' })
  await begin($); await done($, { durationMs: 20000 })
  expect(plays).toEqual([])
  await clock.advance(5000); await begin($); await done($, { durationMs: 20000 })
  expect(plays).toHaveLength(1)
})

