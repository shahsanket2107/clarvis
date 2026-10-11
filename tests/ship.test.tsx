import { expect } from 'claude-code/testing'
import { test } from './timed'
import { commitSha, greenRun, mergeShip, prNumber, shipCaption, shipOf } from '../hooks/ship'
import { endCaption } from '../hooks/hud'
import { DONE } from '../hooks/lines'

const BUN = '\nbun test v1.2\n\n 404 pass\n 0 fail\n 1200 expect() calls\nRan 404 tests across 10 files. [58.44s]\n'
const JEST = 'PASS src/a.test.js\n\nTest Suites: 2 passed, 2 total\nTests:       12 passed, 12 total\nSnapshots:   0 total\nTime:        2.1 s\n'
const VITEST = ' ✓ src/a.test.ts (5 tests) 3ms\n\n Test Files  1 passed (1)\n      Tests  5 passed (5)\n   Duration  400ms\n'
const PYTEST = '============================= test session starts ==============================\ncollected 12 items\n\n.......... [100%]\n============================== 12 passed in 0.52s ==============================\n'
const GO = 'ok  \texample.com/a\t0.012s\nok  \texample.com/b\t(cached)\n'
const GO_OK = 'ok  \texample.com/a\t0.012s\nok  \texample.com/b\t0.4s\n'
const CARGO = 'running 3 tests\ntest result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s\n\ntest result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s\n'

test('green runs with an explicit count, per runner', () => {
  expect(shipOf('bun test', BUN)?.tests).toEqual({ pass: 404, unit: 'tests' })
  expect(shipOf('npx jest', JEST)?.tests?.pass).toBe(12)
  expect(shipOf('npm test', JEST)?.tests?.pass).toBe(12)
  expect(shipOf('npx vitest run', VITEST)?.tests?.pass).toBe(5)
  expect(shipOf('pytest -q', PYTEST)?.tests?.pass).toBe(12)
  expect(shipOf('python -m pytest tests/', PYTEST)?.tests?.pass).toBe(12)
  expect(shipOf('go test ./...', GO_OK)?.tests).toEqual({ pass: 2, unit: 'packages' })
  expect(shipOf('cargo test', CARGO)?.tests?.pass).toBe(7)
  expect(shipOf('cd app && CI=1 pnpm test', JEST)?.tests?.pass).toBe(12)
  expect(shipOf('go test -v ./...', '--- PASS: TestA (0.00s)\n--- PASS: TestB (0.00s)\nok  \tx\t0.1s\n')?.tests).toEqual({ pass: 2, unit: 'tests' })
  expect(greenRun(GO)?.pass).toBe(2)
})

test('false positives: failures, zero counts, errors, and commands that are not test runs', () => {
  expect(shipOf('bun test', ' 403 pass\n 1 fail\n')).toBeUndefined()
  expect(shipOf('bun test', ' 0 pass\n 0 fail\n')).toBeUndefined()
  expect(shipOf('npx jest', 'Tests:       1 failed, 11 passed, 12 total\n')).toBeUndefined()
  expect(shipOf('npx jest', 'Test Suites: 1 failed, 1 passed, 2 total\nTests:       12 passed, 12 total\n')).toBeUndefined()
  expect(shipOf('npx vitest run', ' Test Files  1 failed | 1 passed (2)\n      Tests  1 failed | 4 passed (5)\n')).toBeUndefined()
  expect(shipOf('pytest', '=========== 1 failed, 11 passed in 0.5s ===========\n')).toBeUndefined()
  expect(shipOf('pytest', '=========== 11 passed, 1 error in 0.5s ===========\n')).toBeUndefined()
  expect(shipOf('go test ./...', 'ok  \tx\t0.1s\nFAIL\ty\t0.2s\nFAIL\n')).toBeUndefined()
  expect(shipOf('go test ./...', '--- FAIL: TestA (0.00s)\nFAIL\n')).toBeUndefined()
  expect(shipOf('cargo test', 'test result: FAILED. 3 passed; 1 failed; 0 ignored\n')).toBeUndefined()
  expect(shipOf('cargo test', 'test result: ok. 3 passed; 0 failed;\ntest result: FAILED. 1 passed; 1 failed;\n')).toBeUndefined()
  expect(shipOf('cargo test', 'test result: ok. 0 passed; 0 failed; 0 ignored;\n')).toBeUndefined()
  // output that merely looks green, from a command that is not a test run
  expect(shipOf('cat build.log', BUN)).toBeUndefined()
  expect(shipOf('echo "404 pass"', ' 404 pass\n 0 fail\n')).toBeUndefined()
  expect(shipOf('grep -r passed .', PYTEST)).toBeUndefined()
  expect(shipOf('npm install', ' 12 passed\n')).toBeUndefined()
  expect(shipOf('ls', 'Tests: 5 passed, 5 total')).toBeUndefined()
  expect(shipOf('bun test --help', ' 5 pass\n 0 fail\n')).toBeUndefined()
  // an errored call is never a celebration
  expect(shipOf('bun test', BUN, true)).toBeUndefined()
  // junk input
  expect(shipOf(undefined, BUN)).toBeUndefined(); expect(shipOf('bun test', undefined)).toBeUndefined(); expect(shipOf('', '')).toBeUndefined()
})

test('commits: the bracket line with a sha, from a real commit command', () => {
  expect(shipOf('git commit -m "fix auth"', '[main abc1234] fix auth\n 2 files changed, 3 insertions(+)\n')?.commit).toBe('abc1234')
  expect(shipOf('git add -A && git commit -m x', '[feature/a-b 0123456789ab] x\n 1 file changed\n')?.commit).toBe('0123456')
  expect(shipOf('git commit -m x', '[main (root-commit) deadbee] initial\n')?.commit).toBe('deadbee')
  expect(shipOf('git -C app commit -am x', '[main 1234567] x\n')?.commit).toBe('1234567')
  expect(commitSha('no bracket here')).toBeUndefined()
  // false positives
  expect(shipOf('git commit -m x', 'On branch main\nnothing to commit, working tree clean\n')).toBeUndefined()
  expect(shipOf('git commit -m x', 'On branch main\nnothing to commit', true)).toBeUndefined()
  expect(shipOf('git log --oneline', '[main abc1234] fix auth\n')).toBeUndefined()
  expect(shipOf('git status', '[main abc1234] fix auth\n')).toBeUndefined()
  expect(shipOf('echo "git commit"', '[main abc1234] fix auth\n')).toBeUndefined()
  expect(shipOf('git commit --dry-run', '[main abc1234] x\n')).toBeUndefined()
  expect(shipOf('git commit -m x', '[main xyz] x\n')).toBeUndefined() // not a hex sha
  expect(shipOf('cat notes.txt', '[main abc1234] fix auth\n')).toBeUndefined()
})

test('pull requests: gh pr create with the URL it prints', () => {
  expect(shipOf('gh pr create --title t --body b', 'https://github.com/o/r/pull/57\n')?.pr).toBe(57)
  expect(shipOf('git push && gh pr create --fill', 'Creating pull request for x into main\n\nhttps://github.com/o/r/pull/9\n')?.pr).toBe(9)
  expect(prNumber('see https://github.com/o/r/pull/123/files')).toBe(123)
  expect(shipOf('gh pr create', 'a pull request already exists for this branch')).toBeUndefined()
  expect(shipOf('gh pr view 5', 'https://github.com/o/r/pull/5\n')).toBeUndefined()
  expect(shipOf('gh pr list', 'https://github.com/o/r/pull/5\n')).toBeUndefined()
  expect(shipOf('gh pr create --help', 'https://github.com/o/r/pull/5\n')).toBeUndefined()
  expect(shipOf('gh pr create', 'https://github.com/o/r/issues/5\n')).toBeUndefined()
  expect(shipOf('gh pr create', 'https://github.com/o/r/pull/5\n', true)).toBeUndefined()
})

test('captions: a PR outranks a commit outranks a green run; merging keeps the best', () => {
  expect(shipCaption({ commit: 'abc1234' })).toBe('Commit abc1234 is in the books.')
  expect(shipCaption({ tests: { pass: 404, unit: 'tests' } })).toBe('Tests: 404 passed. Bugs, dusted.')
  expect(shipCaption({ tests: { pass: 2, unit: 'packages' } })).toBe('Tests: 2 packages ok. Bugs, dusted.')
  expect(shipCaption({ pr: 57, commit: 'abc1234' })).toBe('PR #57 is up. Clauvengers, assemble.')
  expect(shipCaption(undefined)).toBeUndefined()
  const m = mergeShip(mergeShip({ commit: 'aaaaaaa' }, { tests: { pass: 3, unit: 'tests' } }), { pr: 4 })
  expect(m).toEqual({ commit: 'aaaaaaa', tests: { pass: 3, unit: 'tests' }, pr: 4 })
  expect(mergeShip(undefined, undefined)).toBeUndefined()
})

test('endCaption: what shipped beats an egg, the season and the big-mission line', () => {
  const pool = DONE
  expect(endCaption('done', { n: 1, big: true, pool, ship: 'Commit abc1234 is in the books.', egg: 'e', season: 's' })).toBe('Commit abc1234 is in the books.')
  expect(endCaption('done', { n: 1, big: true, pool, egg: 'e', season: 's' })).toBe('e')
  expect(endCaption('done', { n: 1, big: true, pool, season: 's' })).toBe('s')
  expect(endCaption('done', { n: 1, big: true, pool })).toBe('"I am Iron Man."')
  expect(endCaption('done', { n: 1, pool })).toBe(pool[1])
  expect(endCaption('fury', { n: 0, pool, ship: 'x' })).not.toBe('x')
})
