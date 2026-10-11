import { expect } from 'claude-code/testing'
import { test } from './timed'
import { lineFor, quipPool, setLineSeed, QUOTES, DONE } from '../hooks/lines'
import { EXTRA } from '../hooks/quips'
import { ROSTER, HERO, WORK_ROWS, drawWorking } from '../hooks/scenes'
import { Surface } from '../hooks/pixel'
import type { Activity } from '../hooks/scenes'

const HEROES = ['thinking', 'jarvis', 'ironman', 'cap', 'thor', 'hulk', 'assemble', 'widow', 'hawkeye', 'spidey', 'fury', 'strange', 'witch', 'antman', 'deadpool', 'snap', 'panther', 'vision', 'loki', 'ultron', 'starlord', 'gamora', 'drax', 'rocket', 'groot', 'mantis', 'nebula', 'yondu', 'falcon', 'warmachine', 'cmarvel', 'bucky']

const all = (h: string) => [...(QUOTES[h as Activity] ?? []), ...(EXTRA[h] ?? [])]
test('every card hero has at least 45 lines (quotes + quips)', () => {
  for (const h of ROSTER) expect(all(h).length).toBeGreaterThanOrEqual(45)
})
test('every line is short, printable, one cell wide, with no command or path leaks', () => {
  for (const h of [...ROSTER, 'responding']) for (const s of [...all(h), ...(h === 'assemble' ? DONE : [])]) {
    expect(s.length).toBeLessThanOrEqual(90)
    expect(/^[\x20-\x7e\u2018\u2019\u201c\u201d]+$/.test(s)).toBe(true)
    expect(s.includes('`') || s.includes('$(') || /[\w.~-]\/[\w.~-]|~\//.test(s)).toBe(false)
  }
})
test('no line appears twice anywhere (quotes, quips, moment captions)', () => {
  const seen = new Set<string>()
  for (const h of ROSTER) for (const s of all(h)) { expect(seen.has(s.toLowerCase())).toBe(false); seen.add(s.toLowerCase()) }
  expect(DONE.length).toBeGreaterThanOrEqual(15)
})
test('quips are short, printable and one cell wide', () => {
  for (const h of HEROES) for (const s of EXTRA[h]!) {
    expect(s.length).toBeLessThanOrEqual(90)
    expect(/^[\x20-\x7e‘’“”]+$/.test(s)).toBe(true)
  }
})
test('no duplicate quips', () => {
  const seen = new Set<string>()
  for (const h of HEROES.filter(h => h !== 'jarvis')) for (const s of EXTRA[h]!) {
    expect(seen.has(s)).toBe(false)
    seen.add(s)
  }
})
test('no quip repeats until the pool wraps', () => {
  for (const h of HEROES) {
    const len = quipPool(h as Activity).length
    const texts: string[] = []
    for (let i = 0; i < 100 && texts.length < len; i++) {
      const n = h === 'deadpool' ? i : 2 * i + 1
      texts.push(lineFor(h as Activity, n).text)
    }
    expect(new Set(texts).size).toBe(texts.length)
    expect(lineFor(h as Activity, -5).text.length).toBeGreaterThan(0)
    expect(lineFor(h as Activity, NaN).text.length).toBeGreaterThan(0)
  }
})

test('every session opens on different lines: the order is shuffled per session, not fixed', () => {
  const opening = (s: number) => { setLineSeed(s); return (['ironman', 'thor', 'hulk', 'loki'] as Activity[]).map(a => [0, 1, 2, 3].map(n => lineFor(a, n).text).join('|')).join('\n') }
  const runs = new Set([1, 2, 3, 4, 5].map(opening))
  expect(runs.size).toBe(5) // five sessions, five different openings
  expect(opening(7)).toBe(opening(7)) // within one session the order holds (no repeats until the pool wraps)
})

test('ROSTER holds 30 heroes, each with a HERO entry, 45+ lines and a draw that does not throw', { timeoutMs: 60000 }, () => {
  expect(ROSTER.length).toBe(30)
  expect(new Set(ROSTER).size).toBe(30)
  for (const h of ['falcon', 'warmachine', 'cmarvel', 'bucky']) expect(ROSTER).toContain(h as Activity)
  const who = { name: 'x', model: 'opus' }, usage = { percent: 40, tokens: 1000, cost: 1 }
  for (const act of ROSTER) {
    expect(HERO[act]?.name.length).toBeGreaterThan(0)
    expect(all(act).length).toBeGreaterThanOrEqual(45)
    for (const lane of [false, true]) {
      const s = new Surface(120, WORK_ROWS)
      expect(() => drawWorking(s.cv, { who, usage, calm: false, act, actAt: 0, tool: 'Edit', detail: 'x', line: 'y', lineAt: 0, elapsed: '1s', tools: 1, log: [], lane } as any, 1.3)).not.toThrow()
    }
  }
})
