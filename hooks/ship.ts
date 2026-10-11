// clarvis ship-it celebrations: read a finished Bash call and say whether it
// shipped something (a commit, a green test run, a pull request).
//
// Pure and conservative. Only small facts leave this file (a 7-character sha,
// a pass count, a PR number): the output text is read here and never kept.
// A false negative costs nothing; a false positive would cheer for a failure,
// so every rule asks for the command AND an unmistakable line in its output.

export type Ship = { commit?: string; tests?: { pass: number; unit: 'tests' | 'packages' }; pr?: number }

// ── the command side ────────────────────────────────────────────────────────
/** The command's simple commands: split on newlines, ;, &&, || and pipes. Quoted text is not parsed: a segment must START like the command. */
function segments(cmd: string): string[] {
  return cmd.split(/\n|;|&&|\|\||\|/).map(x => x.trim()).filter(Boolean)
}
const ENV = /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*/
const head = (seg: string) => seg.replace(ENV, '')

const isCommit = (seg: string) => /^git(?:\s+(?:-C\s+\S+|-c\s+\S+|--no-pager))*\s+commit(?:\s|$)/.test(head(seg)) && !/\s--dry-run\b/.test(seg) && !/\s--help\b/.test(seg)
const isPrCreate = (seg: string) => /^gh\s+pr\s+create(?:\s|$)/.test(head(seg)) && !/\s--help\b/.test(seg)
const RUNNERS = /^(?:npm|npx|pnpm|yarn|bun|bunx|node|deno|python3?|py\.test|pytest|go|cargo|jest|vitest|mocha|rspec|uv|uvx|poetry|tox|nox|make|mvn|gradle|\.\/gradlew)(?:\s|$)/
const TESTISH = /(?:^|[\s:/._-])(?:test|tests|jest|vitest|pytest|mocha|rspec|check|verify)(?:[\s:._-]|$)/
const isTestRun = (seg: string) => { const h = head(seg); return RUNNERS.test(h) && TESTISH.test(h) && !/\s--(?:help|version|list|collect-only|co)\b/.test(h) }

// ── the output side ─────────────────────────────────────────────────────────
const int = (s: string | undefined) => (s === undefined ? NaN : parseInt(s, 10))

/** `[main abc1234] message` / `[main (root-commit) abc1234] message`: the sha, shortened to 7. */
export function commitSha(out: string): string | undefined {
  const m = /^\[[^\]\s]+(?: \([^)]*\))? ([0-9a-f]{7,40})\] \S/m.exec(out)
  return m ? m[1]!.slice(0, 7) : undefined
}

/** The pull request number from the URL `gh pr create` prints. */
export function prNumber(out: string): number | undefined {
  const m = /https?:\/\/[^\s/]+\/[^\s]+\/pull\/(\d{1,7})(?![\d])/.exec(out)
  const n = m ? int(m[1]) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * A green run with an explicit count: jest/vitest ("Tests: 5 passed", "Tests  5 passed (5)"), bun ("5 pass" with "0 fail"),
 * pytest ("5 passed in 0.2s"), go ("ok pkg" lines, `--- PASS` counts with -v), cargo ("test result: ok. 5 passed; 0 failed").
 * Any failure line anywhere, or a count of zero, is not green.
 */
export function greenRun(out: string): { pass: number; unit: 'tests' | 'packages' } | undefined {
  const text = out.length > 60_000 ? out.slice(-60_000) : out
  // a failure marker anywhere vetoes the whole run
  if (/^\s*(?:Tests?:?\s+.*\b[1-9]\d*\s+failed|Test Suites:.*\b[1-9]\d*\s+failed|FAIL\b|--- FAIL|panic:|error(?:\[E\d+\])?:\s+(?:could not compile|test failed))/m.test(text)) return undefined
  if (/\b[1-9]\d*\s+(?:failed|failures?|errors?)\b/i.test(text)) return undefined
  if (/^\s*[1-9]\d*\s+fail\b/m.test(text)) return undefined
  if (/test result: FAILED/.test(text)) return undefined
  const ok = (n: number) => (Number.isFinite(n) && n > 0 ? { pass: n, unit: 'tests' as const } : undefined)

  // cargo: every "test result" line must be ok; sum the counts
  const cargo = [...text.matchAll(/^test result: (ok|FAILED)\. (\d+) passed; (\d+) failed;/gm)]
  if (cargo.length) {
    if (cargo.some(m => m[1] !== 'ok' || int(m[3]) !== 0)) return undefined
    return ok(cargo.reduce((n, m) => n + int(m[2]), 0))
  }
  // jest: "Tests:       5 passed, 5 total" (skipped/todo may sit between)
  const jest = /^\s*Tests:\s+(?:[^\n]*?,\s*)?(\d+) passed, \d+ total/m.exec(text)
  if (jest) return ok(int(jest[1]))
  // vitest: "      Tests  5 passed (5)" (also "5 passed | 1 skipped (6)")
  const vi = /^\s*Tests\s+(?:[^\n|]*\|\s*)*(\d+) passed(?:\s*\|[^\n(]*)?\s*\(\d+\)/m.exec(text)
  if (vi) return ok(int(vi[1]))
  // bun: " 404 pass" and " 0 fail" on their own lines
  const pass = /^\s*(\d+) pass\s*$/m.exec(text), fail = /^\s*0 fail\s*$/m.exec(text)
  if (pass && fail) return ok(int(pass[1]))
  // pytest: "== 12 passed, 1 skipped in 0.5s ==" or "12 passed in 0.5s"
  const py = /^(?:=+\s*)?(\d+) passed(?:,[^\n]*?)? in [\d.]+s?\b/m.exec(text)
  if (py) return ok(int(py[1]))
  // go: -v prints "--- PASS"; otherwise the "ok" package lines count packages
  const goPass = [...text.matchAll(/^\s*--- PASS: /gm)].length
  if (goPass > 0) return ok(goPass)
  const goOk = [...text.matchAll(/^ok\s+\S+\s+(?:[\d.]+s?\b|\(cached\))/gm)].length
  if (goOk > 0) return { pass: goOk, unit: 'packages' }
  return undefined
}

/** What a finished Bash call shipped, if anything. Nothing for an errored call. */
export function shipOf(command: unknown, output: unknown, isError = false): Ship | undefined {
  if (isError || typeof command !== 'string' || typeof output !== 'string' || !command || !output) return undefined
  const segs = segments(command.length > 4000 ? command.slice(0, 4000) : command)
  const out: Ship = {}
  if (segs.some(isCommit)) { const sha = commitSha(output); if (sha) out.commit = sha }
  if (segs.some(isPrCreate)) { const n = prNumber(output); if (n) out.pr = n }
  if (segs.some(isTestRun)) { const g = greenRun(output); if (g) out.tests = g }
  return out.commit || out.pr || out.tests ? out : undefined
}

/** Joins what several calls shipped in one turn. */
export function mergeShip(a: Ship | undefined, b: Ship | undefined): Ship | undefined {
  if (!a) return b
  if (!b) return a
  const t = a.tests && b.tests ? (b.tests.pass >= a.tests.pass ? b.tests : a.tests) : (a.tests ?? b.tests)
  return { ...(b.commit ?? a.commit ? { commit: b.commit ?? a.commit } : {}), ...(b.pr ?? a.pr ? { pr: b.pr ?? a.pr } : {}), ...(t ? { tests: t } : {}) }
}

/** The end-of-turn caption for what shipped: a pull request outranks a commit, a commit a green run. */
export function shipCaption(s: Ship | undefined): string | undefined {
  if (!s) return undefined
  if (s.pr) return `PR #${s.pr} is up. Clauvengers, assemble.`
  if (s.commit) return `Commit ${s.commit} is in the books.`
  if (s.tests) return s.tests.unit === 'packages' ? `Tests: ${s.tests.pass} package${s.tests.pass === 1 ? '' : 's'} ok. Bugs, dusted.` : `Tests: ${s.tests.pass} passed. Bugs, dusted.`
  return undefined
}
