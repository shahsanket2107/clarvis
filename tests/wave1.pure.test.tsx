import { expect } from 'claude-code/testing'
import { test } from './timed'
import { addToLedger, bumpStreak, dayDiff, dayKey, emptyLedger, KEEP_DAYS, mvp, sanitizeLedger, sanitizeStreak, streakNow, sumDays } from '../hooks/daily'
import { TROPHIES, earned, extOf, sanitizeTrophies, trophiesText } from '../hooks/trophies'
import { TEAMS, findHero, orderFor, pickable, pinHere, sanitizeHere, sanitizeSel, stageIds, HERE_MAX } from '../hooks/team'
import { EGG_CAPTIONS, isThursday, rollEgg, seasonCaption, seasonOf, VILLAINS } from '../hooks/season'
import { CARD_W, missionCard, parseCardArgs } from '../hooks/card'
import { CLIPS, RATE, SOUND_GAP_MS, clipOf, soundChoice, soundGate, synth, toBase64, wavBytes } from '../hooks/sound'
import { contextNudge, crossed, fmtCost, milestoneText, statsText, newStats } from '../hooks/metrics'
import { HERO, ROSTER } from '../hooks/scenes'

const D = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)

// ── F. trophies ─────────────────────────────────────────────────────────────
test('the trophy list: about 25, unique ids, every trophy has a hint and a toast text', () => {
  expect(TROPHIES.length).toBeGreaterThanOrEqual(25)
  expect(new Set(TROPHIES.map(t => t.id)).size).toBe(TROPHIES.length)
  for (const t of TROPHIES) { expect(t.hint.length).toBeGreaterThan(5); expect(t.text.length).toBeGreaterThan(5) }
  for (const id of ['hulk', 'hawkeye', 'century', 'ironman', 'snap', 'firstCommit', 'greenWall', 'nightShift', 'endgame', 'binge', 'arcade50k', 'streak7', 'million', 'cacheWizard', 'thousand', 'polyglot', 'nightOwl']) expect(TROPHIES.some(t => t.id === id)).toBe(true)
})
test('earned: each fact earns its trophy and no fact earns another', () => {
  expect(earned({})).toEqual([])
  expect(earned({ commits: 1 })).toEqual(['firstCommit'])
  expect(earned({ commits: 100 })).toEqual(expect.arrayContaining(['firstCommit', 'tenCommits', 'hundredCommits']))
  expect(earned({ green: 9 })).toEqual([]); expect(earned({ green: 10 })).toEqual(['greenWall'])
  expect(earned({ hour: 1 })).toEqual(['nightShift']); expect(earned({ hour: 0 })).toEqual([]); expect(earned({ hour: 5 })).toEqual(['earlyBird'])
  expect(earned({ durationMs: 3_599_000 })).toEqual([]); expect(earned({ durationMs: 3_600_000 })).toEqual(['endgame'])
  expect(earned({ moviesSeen: 10, moviesTotal: 10 })).toEqual(expect.arrayContaining(['binge', 'opening'])); expect(earned({ moviesSeen: 9, moviesTotal: 10 })).toEqual(['opening'])
  expect(earned({ arcadeBest: 49_999 })).toEqual([]); expect(earned({ arcadeBest: 50_000 })).toEqual(['arcade50k'])
  expect(earned({ streak: 7 })).toEqual(expect.arrayContaining(['streak3', 'streak7'])); expect(earned({ streak: 30 })).toContain('streak30')
  expect(earned({ tokens: 1_000_000 })).toEqual(['million']); expect(earned({ toolCalls: 1000 })).toEqual(['thousand'])
  expect(earned({ session: { input: 49_000, cacheHit: 0.95 } })).toEqual([]); expect(earned({ session: { input: 60_000, cacheHit: 0.89 } })).toEqual([])
  expect(earned({ session: { input: 60_000, cacheHit: 0.9 } })).toEqual(['cacheWizard'])
  expect(earned({ session: { extensions: 4 } })).toEqual([]); expect(earned({ session: { extensions: 5 } })).toEqual(['polyglot'])
  expect(earned({ nights: 3 })).toEqual(['nightOwl'])
  expect(earned({ tokens: NaN, commits: -4, hour: NaN } as any)).toEqual([])
})
test('extOf and sanitizeTrophies', () => {
  expect(extOf('/a/b/c.TS')).toBe('ts'); expect(extOf('Makefile')).toBe(''); expect(extOf('.env')).toBe(''); expect(extOf(5)).toBe(''); expect(extOf('a.')).toBe('')
  expect(sanitizeTrophies({ hulk: 5, nope: 7, snap: 'x', century: -1, ironman: NaN })).toEqual({ hulk: 5 })
  expect(sanitizeTrophies(null)).toEqual({}); expect(sanitizeTrophies([1])).toEqual({})
})
test('trophiesText: unlocked with the date, locked as ??? with the hint, and N/M', () => {
  const t0 = new Date(2026, 2, 14, 9).getTime()
  const t = trophiesText({ hulk: t0, firstCommit: t0 })
  expect(t).toContain(`${TROPHIES.length > 0 ? 2 : 0}/${TROPHIES.length} unlocked`)
  expect(t).toMatch(/★ Hulk Out\s+2026-03-14/)
  expect(t).toMatch(/★ First Commit\s+2026-03-14/)
  expect(t).toContain('??? · hint: ')
  expect(t).not.toContain('Hundred Commits') // locked: the name stays hidden
  const lines = t.split('\n').filter(l => l.includes('★ '))
  const col = (l: string) => l.search(/\d{4}-\d{2}-\d{2}/)
  expect(new Set(lines.map(col)).size).toBe(1) // dates line up
  expect(trophiesText({})).toContain(`0/${TROPHIES.length} unlocked`)
})

// ── daily buckets, streak, card ranges ──────────────────────────────────────
test('dayKey is the local date; dayDiff counts calendar days', () => {
  expect(dayKey(D(2026, 3, 4, 0))).toBe('2026-03-04'); expect(dayKey(D(2026, 12, 31, 23))).toBe('2026-12-31'); expect(dayKey(new Date(NaN))).toBe('1970-01-01')
  expect(dayDiff('2026-02-28', '2026-03-01')).toBe(1); expect(dayDiff('2025-12-31', '2026-01-01')).toBe(1); expect(dayDiff('2026-03-01', '2026-03-01')).toBe(0)
})
test('the ledger adds to today, keeps 35 days, and survives junk', () => {
  let lg = addToLedger(undefined, D(2026, 3, 1), { turns: 1, actions: 5, commits: 1, inTok: 1000, cacheTok: 800, cost: 0.5, heroes: { ironman: 3, hulk: 2 } })
  lg = addToLedger(lg, D(2026, 3, 1), { turns: 1, actions: 2, heroes: { hulk: 4 } })
  expect(lg.days['2026-03-01']).toMatchObject({ turns: 2, actions: 7, commits: 1, heroes: { ironman: 3, hulk: 6 } })
  expect(lg.life).toMatchObject({ commits: 1, cacheTok: 800, heroes: { hulk: 6 } })
  for (let i = 0; i < 50; i++) lg = addToLedger(lg, D(2026, 3, 1 + i % 28 + (i >= 28 ? 0 : 0)), {})
  lg = addToLedger(lg, D(2026, 4, 20), { turns: 1 })
  expect(Object.keys(lg.days).every(k => k >= dayKey(new Date(2026, 3, 20 - (KEEP_DAYS - 1))))).toBe(true)
  expect(lg.days['2026-04-20']!.turns).toBe(1)
  expect(sanitizeLedger('x')).toEqual(emptyLedger()); expect(sanitizeLedger({ days: { bad: { turns: 3 }, '2026-01-01': { turns: 'x', cost: -1, heroes: { 'Bad Id': 3, ok: 2 } } }, life: { commits: -1 } }))
    .toEqual({ life: { commits: 0, green: 0, prs: 0, cacheTok: 0, heroes: {} }, days: { '2026-01-01': { turns: 0, actions: 0, commits: 0, green: 0, prs: 0, inTok: 0, outTok: 0, cacheTok: 0, cost: 0, heroes: { ok: 2 } } } })
})
test('sumDays: today, the last 7 days, all; mvp picks the busiest hero', () => {
  let lg = emptyLedger()
  for (let i = 0; i < 10; i++) lg = addToLedger(lg, D(2026, 3, 20 - i), { turns: 1, actions: 10, heroes: { [i < 3 ? 'ironman' : 'hulk']: 10 } })
  const now = D(2026, 3, 20)
  expect(sumDays(lg, now, 'today')).toMatchObject({ turns: 1, actions: 10, days: 1 })
  expect(sumDays(lg, now, 'week')).toMatchObject({ turns: 7, actions: 70, days: 7 })
  expect(sumDays(lg, now, 'all').turns).toBe(10)
  expect(mvp(sumDays(lg, now, 'week').heroes)).toBe('hulk'); expect(mvp({})).toBeUndefined(); expect(mvp({ b: 3, a: 3 })).toBe('a')
})
test('the streak: next day extends, a gap restarts, the same day is a no-op; the band drops a dead run', () => {
  let s = bumpStreak(undefined, D(2026, 3, 1)); expect(s).toEqual({ last: '2026-03-01', n: 1, best: 1 })
  expect(bumpStreak(s, D(2026, 3, 1, 23))).toEqual(s)
  s = bumpStreak(s, D(2026, 3, 2)); s = bumpStreak(s, D(2026, 3, 3)); expect(s).toMatchObject({ n: 3, best: 3 })
  expect(bumpStreak(s, D(2026, 3, 5))).toEqual({ last: '2026-03-05', n: 1, best: 3 })
  expect(streakNow(s, D(2026, 3, 3))).toBe(3); expect(streakNow(s, D(2026, 3, 4))).toBe(3); expect(streakNow(s, D(2026, 3, 5))).toBe(0)
  expect(sanitizeStreak('x')).toEqual({ last: '', n: 0, best: 0 }); expect(bumpStreak({ last: 'nope', n: 9 }, D(2026, 3, 1)).n).toBe(1)
  expect(bumpStreak({ last: '2026-02-28', n: 4, best: 4 }, D(2026, 3, 1)).n).toBe(5) // across a month end
})

// ── H. the card ─────────────────────────────────────────────────────────────
const cardIn = (o: Record<string, unknown> = {}) => ({
  range: 'week' as const, today: D(2026, 3, 20), sum: { ...sumDays(addToLedger(undefined, D(2026, 3, 20), { turns: 12, actions: 341, commits: 4, inTok: 1_000_000, outTok: 200_000, cacheTok: 870_000, cost: 12.4, heroes: { ironman: 9 } }), D(2026, 3, 20), 'week') },
  extras: emptyLedger().life, streak: 5, showCost: true, quote: '"Avengers... assemble."', heroName: (id: string) => HERO[id as keyof typeof HERO]?.name ?? id, ...o,
})
test('the card: box-drawing, at most 44 columns, every row the same width', () => {
  const t = missionCard(cardIn() as any)
  const lines = t.split('\n')
  expect(lines[0]![0]).toBe('╭'); expect(lines.at(-1)![0]).toBe('╰')
  for (const l of lines) expect([...l].length).toBe(CARD_W)
  for (const w of ['missions  12', 'actions  341', 'commits   4', '1.2M', 'cache     87%', '$12.40', 'IRON MAN', '▲5d', 'clarvis · unofficial fan mod', 'WEEK']) expect(t).toContain(w)
})
test('the card with nocost or showCost off shows no money; a long quote wraps inside the box', () => {
  const t = missionCard(cardIn({ showCost: false, quote: 'A very long quote that goes on and on and on and on and on and on forever and ever, never ending, amen.' }) as any)
  expect(t).not.toContain('$'); expect(t).not.toContain('cost')
  for (const l of t.split('\n')) expect([...l].length).toBe(CARD_W)
  expect(t).toContain('IRON MAN')
})
test('the card for an empty ledger and for all time', () => {
  const t = missionCard(cardIn({ sum: sumDays(emptyLedger(), D(2026, 3, 20), 'week') }) as any)
  expect(t).toContain('missions  0'); expect(t).toContain('cache     —'); expect(t).toContain('MVP       —')
  const all = missionCard({ ...cardIn(), range: 'all', life: { turns: 100, toolCalls: 9000, inputTokens: 5_000_000, outputTokens: 1_000_000, cost: 99 }, extras: { commits: 40, green: 3, prs: 1, cacheTok: 4_000_000, heroes: { hulk: 5 } } } as any)
  expect(all).toContain('ALL · all time'); expect(all).toContain('actions  9000'); expect(all).toContain('cache     80%'); expect(all).toContain('HULK'); expect(all).toContain('6.0M')
  for (const l of all.split('\n')) expect([...l].length).toBe(CARD_W)
})
test('parseCardArgs', () => {
  expect(parseCardArgs('')).toEqual({ range: 'today', nocost: false }); expect(parseCardArgs('week nocost')).toEqual({ range: 'week', nocost: true }); expect(parseCardArgs('nocost all')).toEqual({ range: 'all', nocost: true })
  expect(parseCardArgs('month')).toBeUndefined(); expect(parseCardArgs('week extra')).toBeUndefined()
})

// ── G. team and pick ────────────────────────────────────────────────────────
const names = Object.fromEntries(ROSTER.map(id => [id, HERO[id].name]))
test('every team preset names ids that exist on the roster', () => {
  for (const [team, ids] of Object.entries(TEAMS)) { expect(ids.length).toBeGreaterThan(3); for (const id of ids) expect(ROSTER as string[]).toContain(id) }
  expect(pickable(ROSTER)).not.toContain('thinking')
})
test('findHero: ids, names, aliases, prefixes, near misses, and a list for nonsense', () => {
  const f = (q: string) => findHero(q, ROSTER, names).id
  expect(f('ironman')).toBe('ironman'); expect(f('Iron Man')).toBe('ironman'); expect(f('tony')).toBe('ironman'); expect(f('thr')).toBe('thor'); expect(f('spider-man')).toBe('spidey')
  expect(f('captain america')).toBe('cap'); expect(f('star-lord')).toBe('starlord'); expect(f('hulc')).toBe('hulk'); expect(f('winter soldier')).toBe('bucky'); expect(f('black panther')).toBe('panther')
  const bad = findHero('zzzzzz', ROSTER, names); expect(bad.id).toBeUndefined(); expect(bad.suggestions!.length).toBeGreaterThan(3)
  expect(findHero('', ROSTER, names).suggestions!.length).toBeGreaterThan(0)
  expect(findHero('thinking', ROSTER, names).id).toBeUndefined()
})
test('stageIds: a project pin beats a global pick beats a team beats all', () => {
  expect(stageIds(ROSTER, { team: 'all' })).toEqual(ROSTER)
  expect(stageIds(ROSTER, { team: 'guardians' }).sort()).toEqual([...TEAMS.guardians].sort())
  expect(stageIds(ROSTER, { team: 'guardians', pick: 'hulk' })).toEqual(['hulk'])
  expect(stageIds(ROSTER, { team: 'guardians', pick: 'hulk' }, 'thor')).toEqual(['thor'])
  expect(stageIds(ROSTER, { team: 'all' }, 'nope')).toEqual(ROSTER)
})
test('sanitizeSel / sanitizeHere / pinHere survive junk and stay bounded', () => {
  expect(sanitizeSel({ team: 'x', pick: 'zzz' }, ROSTER)).toEqual({ team: 'all' }); expect(sanitizeSel({ team: 'cosmic', pick: 'hulk' }, ROSTER)).toEqual({ team: 'cosmic', pick: 'hulk' }); expect(sanitizeSel(7, ROSTER)).toEqual({ team: 'all' })
  expect(sanitizeHere({ '/a': 'hulk', '/b': 'nope', '': 'hulk' }, ROSTER)).toEqual({ '/a': 'hulk' }); expect(sanitizeHere([1], ROSTER)).toEqual({})
  let h: Record<string, string> = {}
  for (let i = 0; i < HERE_MAX + 20; i++) h = pinHere(h, `/p${i}`, 'hulk')
  expect(Object.keys(h).length).toBe(HERE_MAX); expect(h['/p0']).toBeUndefined(); expect(pinHere(h, `/p${HERE_MAX + 19}`, undefined)[`/p${HERE_MAX + 19}`]).toBeUndefined()
})
test('orderFor: a permutation; villains first at Halloween; Thor twice on Thursdays; a pick stays one', () => {
  let n = 0; const rng = () => ((n = (n * 7 + 3) % 11), n / 11)
  const base = orderFor(ROSTER, { rng }); expect([...base].sort()).toEqual([...ROSTER].sort())
  const hw = orderFor(ROSTER, { rng, villains: true }); expect(hw.slice(0, VILLAINS.length).sort()).toEqual([...VILLAINS].sort()); expect([...hw].sort()).toEqual([...ROSTER].sort())
  const th = orderFor(ROSTER, { rng, thursday: true }); expect(th.filter(x => x === 'thor').length).toBe(2); expect(th.length).toBe(ROSTER.length + 1)
  for (let i = 0; i < th.length; i++) if (th[i] === 'thor') expect(th[(i + 1) % th.length]).not.toBe('thor')
  expect(orderFor(['hulk'], { rng, villains: true, thursday: true })).toEqual(['hulk'])
  expect(orderFor(['loki', 'hulk'], { rng, thursday: true })).toHaveLength(2) // no Thor, nothing to double
})

// ── I. seasons and eggs ─────────────────────────────────────────────────────
test('seasonOf: Halloween Oct 25 to Nov 1, snow in December, fireworks on Jan 1, plain otherwise', () => {
  expect(seasonOf(D(2026, 10, 24))).toBeNull()
  for (const [m, d] of [[10, 25], [10, 31], [11, 1]] as const) expect(seasonOf(D(2026, m, d, 0))).toBe('halloween')
  expect(seasonOf(D(2026, 11, 2))).toBeNull(); expect(seasonOf(D(2026, 12, 1))).toBe('winter'); expect(seasonOf(D(2026, 12, 31, 23))).toBe('winter')
  expect(seasonOf(D(2027, 1, 1))).toBe('newyear'); expect(seasonOf(D(2027, 1, 2))).toBeNull(); expect(seasonOf(D(2026, 6, 15))).toBeNull()
  expect(seasonOf(new Date(0))).toBeNull(); expect(isThursday(new Date(0))).toBe(false) // a test clock at 0 stays plain
  expect(seasonOf(new Date(NaN))).toBeNull()
})
test('isThursday and captions', () => {
  expect(isThursday(D(2026, 10, 15))).toBe(true); expect(isThursday(D(2026, 10, 16))).toBe(false)
  expect(seasonCaption('halloween')).toContain('Trick or treat'); expect(seasonCaption('winter')).toBeUndefined(); expect(seasonCaption(null)).toBeUndefined()
})
test('rollEgg: 1 in 150 with the dice handed in; shawarma only after three hours', () => {
  expect(rollEgg(() => 0.5, { sessionMs: 0 })).toBeUndefined(); expect(rollEgg(() => 1 / 150, { sessionMs: 0 })).toBeUndefined()
  expect(rollEgg(() => 0, { sessionMs: 0 })).toBe('groot'); expect(rollEgg(() => 0.006, { sessionMs: 60_000 })).toBe('groot')
  const seq = (...v: number[]) => () => v.shift() ?? 0.9
  expect(rollEgg(seq(0.001, 0.2), { sessionMs: 3 * 3600_000 })).toBe('shawarma'); expect(rollEgg(seq(0.001, 0.9), { sessionMs: 3 * 3600_000 })).toBe('groot')
  expect(rollEgg(() => NaN, { sessionMs: 0 })).toBeUndefined()
  let hits = 0; let s = 12345; const lcg = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff), s / 0x80000000)
  for (let i = 0; i < 30000; i++) if (rollEgg(lcg, { sessionMs: 0 })) hits++
  expect(hits).toBeGreaterThan(100); expect(hits).toBeLessThan(320) // about 200
  expect(EGG_CAPTIONS.shawarma).toContain('Shawarma')
})

// ── N. sound ────────────────────────────────────────────────────────────────
test('the WAV builder: a valid RIFF header, sizes that add up, no NaN, never clipping past 16 bits', () => {
  for (const name of Object.keys(CLIPS) as (keyof typeof CLIPS)[]) {
    const pcm = synth(CLIPS[name]), bytes = wavBytes(pcm), v = new DataView(bytes.buffer)
    const tag = (o: number) => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!)
    expect(tag(0)).toBe('RIFF'); expect(tag(8)).toBe('WAVE'); expect(tag(12)).toBe('fmt '); expect(tag(36)).toBe('data')
    expect(v.getUint32(4, true)).toBe(bytes.length - 8); expect(v.getUint32(40, true)).toBe(pcm.length * 2); expect(bytes.length).toBe(44 + pcm.length * 2)
    expect(v.getUint16(20, true)).toBe(1); expect(v.getUint16(22, true)).toBe(1); expect(v.getUint32(24, true)).toBe(RATE); expect(v.getUint16(34, true)).toBe(16)
    expect(v.getUint32(28, true)).toBe(RATE * 2)
    let peak = 0, nan = 0
    for (const s of pcm) { if (!Number.isFinite(s)) nan++; peak = Math.max(peak, Math.abs(s)) }
    expect(nan).toBe(0); expect(peak).toBeGreaterThan(1000); expect(peak).toBeLessThanOrEqual(32767)
    expect(pcm.length).toBe(Math.ceil((Math.max(...CLIPS[name].map(n => n.at + n.ms)) / 1000) * RATE))
  }
})
test('the clips have the lengths asked for, and are built once', () => {
  const secs = (n: keyof typeof CLIPS) => synth(CLIPS[n]).length / RATE
  expect(secs('assemble')).toBeGreaterThan(0.5); expect(secs('assemble')).toBeLessThan(0.7)
  expect(secs('whomp')).toBeGreaterThan(0.35); expect(secs('whomp')).toBeLessThan(0.45)
  expect(secs('coin')).toBeLessThan(0.2); expect(secs('levelup')).toBeGreaterThan(0.35); expect(secs('levelup')).toBeLessThan(0.45); expect(secs('boot')).toBeLessThan(0.3)
  expect(CLIPS.assemble.filter(n => n.wave === 'square').length).toBeGreaterThanOrEqual(4)
  expect(CLIPS.whomp.some(n => n.wave === 'noise')).toBe(true)
  expect(clipOf('coin')).toBe(clipOf('coin')); expect(clipOf('coin').mime).toBe('audio/wav')
  expect(clipOf('coin').base64).toMatch(/^UklGR[A-Za-z0-9+/]+=*$/) // "RIFF" in base64
  expect(Array.from(atob(clipOf('coin').base64), c => c.charCodeAt(0)).length).toBe(wavBytes(synth(CLIPS.coin)).length)
  expect(synth(CLIPS.whomp)).toEqual(synth(CLIPS.whomp)) // deterministic
})
test('toBase64 matches the platform for every remainder', () => {
  for (let n = 0; n < 8; n++) { const b = Uint8Array.from({ length: n }, (_, i) => i * 37 + 5); expect(toBase64(b)).toBe(btoa(String.fromCharCode(...b))) }
})
test('soundGate: on, full only, 2 s apart, quiet after a theater burst', () => {
  const ok = { on: true, mode: 'full', now: 100_000, lastAt: 0, burstAt: 0 }
  expect(soundGate(ok)).toBe(true)
  expect(soundGate({ ...ok, on: false })).toBe(false)
  for (const mode of ['calm', 'lite', 'off']) expect(soundGate({ ...ok, mode })).toBe(false)
  expect(soundGate({ ...ok, lastAt: ok.now - SOUND_GAP_MS + 1 })).toBe(false); expect(soundGate({ ...ok, lastAt: ok.now - SOUND_GAP_MS })).toBe(true)
  expect(soundGate({ ...ok, burstAt: ok.now - 1000 })).toBe(false); expect(soundGate({ ...ok, burstAt: ok.now - 3000 })).toBe(true)
  expect(soundGate({ ...ok, now: NaN })).toBe(false)
})
test('soundChoice: stored beats the option; with neither, sound is on', () => {
  expect(soundChoice(undefined, undefined)).toBe(true); expect(soundChoice('junk', undefined)).toBe(true); expect(soundChoice(undefined, false)).toBe(false)
  expect(soundChoice('on', false)).toBe(true); expect(soundChoice('off', true)).toBe(false); expect(soundChoice(undefined, true)).toBe(true); expect(soundChoice('junk', false)).toBe(false)
})

// ── J. flavour ──────────────────────────────────────────────────────────────
test('token milestones fire once on crossing 1M, 10M, 100M', () => {
  expect(crossed(999_999, 1_000_000)).toEqual([1_000_000]); expect(crossed(1_000_000, 1_500_000)).toEqual([]); expect(crossed(9_000_000, 120_000_000)).toEqual([10_000_000, 100_000_000])
  expect(crossed(NaN, 5)).toEqual([]); expect(milestoneText(10_000_000)).toContain('10M')
})
test('the Ant-Man nudge: from 85%, with the number, sincere', () => {
  expect(contextNudge(84.9)).toBeUndefined(); expect(contextNudge(85)).toBe('Ant-Man: Context at 85%: /compact shrinks it.'); expect(contextNudge(88)).toBe('Ant-Man: Context at 88%: /compact shrinks it.')
  expect(contextNudge(NaN)).toBeUndefined(); expect(contextNudge(undefined)).toBeUndefined()
})
test('/clarvis stats lists shipped work when given', () => {
  const t = statsText({ stats: newStats(), now: 1, extras: { commits: 3, green: 2, prs: 1 } })
  expect(t).toMatch(/commits\s+3/); expect(t).toMatch(/green test runs\s+2/); expect(t).toMatch(/pull requests\s+1/)
  expect(statsText({ stats: newStats(), now: 1 })).not.toContain('pull requests')
  expect(fmtCost(1)).toBe('$1.00')
})

test('a Halloween Thursday keeps the villains in front whatever the dice: Thor\'s second slot waits', () => {
  for (let seed = 1; seed <= 200; seed++) {
    let x = seed; const rng = () => ((x = (x * 16807) % 2147483647) / 2147483647)
    const out = orderFor(ROSTER, { rng, villains: true, thursday: true })
    expect(out.slice(0, 4).sort()).toEqual(['bucky', 'loki', 'nebula', 'ultron'])
    expect(out.filter(h => h === 'thor')).toHaveLength(1)
  }
})
