// `test` with a roomy time limit. The engine's default is 5000 ms, and a render-heavy test that takes
// 1.5 s alone takes 5 s+ when another suite, a build or a laptop's thermal throttling shares the CPU:
// that is a timeout, not a bug. A test that really hangs still fails, a minute later. An explicit
// `{ timeoutMs }` on a test wins.
import { test as engineTest } from 'claude-code/testing'
import { setLineSeed } from '../hooks/lines'

// Each session shuffles the heroes' lines with a random seed; pin it so a run never depends on the dice.
// (quips.test.tsx sets its own seeds where the order is the point.)
setLineSeed(0x5eed1234)

const DEFAULT_MS = 60_000
export const test: typeof engineTest = ((name: string, ...rest: unknown[]) => {
  const [a, b] = rest
  return typeof a === 'function'
    ? (engineTest as any)(name, { timeoutMs: DEFAULT_MS }, a)
    : (engineTest as any)(name, { timeoutMs: DEFAULT_MS, ...(a as object) }, b)
}) as unknown as typeof engineTest
