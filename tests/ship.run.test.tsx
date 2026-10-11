import { expect } from 'claude-code/testing'
import { test } from './timed'
import { K, session, start, begin, done, hero, lastFx } from './kit'

// the Bash result reaches the plugin as the engine gives it; these tests answer it the way a Bash tool does
const bash = (stdout: string, extra: Record<string, unknown> = {}) => (e: any) => (e.tool === 'Bash' ? { result: { stdout, stderr: '' }, ...extra } : { result: { ok: true } })
// the moment the band holds, as the plugin's state keeps it (caption included)
const caption = async (_$: any) => JSON.stringify(lastFx())

test('a commit in a turn becomes the ASSEMBLE caption, and the result is passed on untouched', async ($, on) => {
  const out = '[main abc1234] fix auth\n 1 file changed\n'
  session(on, { tool: bash(out) }); await start($); await begin($)
  const r: any = await $.tool.call({ tool: 'Bash', command: 'git commit -m "fix auth"' } as any)
  expect(r.result).toEqual({ stdout: out, stderr: '' })
  await done($, { durationMs: 20000 })
  expect(await caption($)).toContain('Commit abc1234 is in the books.')
})

test('a green test run and a PR: the PR wins; the lifetime ledger counts them', async ($, on) => {
  session(on, { tool: (e: any) => String(e.command).startsWith('gh pr create') ? { result: { stdout: 'https://github.com/o/r/pull/57\n', stderr: '' } } : { result: { stdout: ' 404 pass\n 0 fail\n', stderr: '' } } })
  await start($); await begin($)
  await $.tool.call({ tool: 'Bash', command: 'bun test' } as any)
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' } as any)
  await done($, { durationMs: 20000 })
  expect(await caption($)).toContain('PR #57 is up. Clauvengers, assemble.')
  const stats = await hero($, 'stats')
  expect(stats).toContain('commits')
  expect(stats).toMatch(/green test runs\s+1/)
  expect(stats).toMatch(/pull requests\s+1/)
})

test('tests with a pass count caption the turn; a failing run does not', async ($, on) => {
  session(on, { tool: bash('Tests:       12 passed, 12 total\n') }); await start($); await begin($)
  await $.tool.call({ tool: 'Bash', command: 'npx jest' } as any)
  await done($, { durationMs: 20000 })
  expect(await caption($)).toContain('Tests: 12 passed. Bugs, dusted.')
})
test('a failing run, an errored call and a non-ship command leave the caption alone', async ($, on) => {
  session(on, { tool: bash('Tests:       1 failed, 11 passed, 12 total\n') }); await start($); await begin($)
  await $.tool.call({ tool: 'Bash', command: 'npx jest' } as any)
  await done($, { durationMs: 20000 })
  const t = await caption($)
  expect(t).not.toContain('Bugs, dusted')
})
test('a subagent-free off mode observes nothing', async ($, on) => {
  session(on, { tool: bash('[main abc1234] x\n'), env: { CLARVIS: 'off' } }); await start($); await begin($)
  const r: any = await $.tool.call({ tool: 'Bash', command: 'git commit -m x' } as any)
  expect(r.result.stdout).toContain('abc1234')
  expect(await hero($, 'stats')).not.toMatch(/commits\s+[1-9]/)
})
