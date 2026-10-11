// clarvis metrics: real numbers only, pure functions only.
//
// What the engine gives us is folded here into session totals (from each main
// turn's `usage`), derived figures (cache hit rate, burn rate, output speed),
// lifetime totals (kept in $.store by register.tsx) and the C.L.A.R.V.I.S.
// mission report. Nothing here touches the engine: every function takes plain
// values and returns plain values, and no result is ever NaN, Infinity or
// negative.

// ── guards and formats ──────────────────────────────────────────────────────
const CAP = 1e15
/** A finite, non-negative number or 0: the only way a figure enters this module. */
export const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.min(x, CAP) : 0)

/** 950, 12.4k, 3.1M, 1.2B. */
export function fmtTokens(n: unknown): string {
  const v = Math.round(num(n))
  if (v < 1000) return String(v)
  if (v < 999_950) return `${(v / 1000).toFixed(1)}k`
  if (v < 999_950_000) return `${(v / 1e6).toFixed(1)}M`
  return `${(v / 1e9).toFixed(1)}B`
}
/** $0.42, $12.34, $1.2k, $3.4M. */
export function fmtCost(n: unknown): string {
  const v = num(n)
  if (v < 1000) return `$${v.toFixed(2)}`
  if (v < 999_950) return `$${(v / 1000).toFixed(1)}k`
  return `$${(v / 1e6).toFixed(1)}M`
}
/** An integer percent, clamped to 0..999. */
export const fmtPct = (n: unknown): string => `${Math.min(999, Math.round(num(n)))}%`
/** 45s, 12m 04s, 2h 05m. */
export function fmtSpan(ms: unknown): string {
  const s = Math.round(num(ms) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
}
/** In how long an ISO timestamp comes: 45m, 2h 14m, 3d 4h; "now" when past; "—" when unreadable. */
export function resetsIn(iso: unknown, now: number): string {
  const at = typeof iso === 'string' ? Date.parse(iso) : NaN
  if (!Number.isFinite(at) || !Number.isFinite(now)) return '—'
  const m = Math.floor((at - now) / 60_000)
  if (m <= 0) return 'now'
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h ${m % 60}m`
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`
}

// ── session totals ──────────────────────────────────────────────────────────
export type TurnTokens = { input: number; output: number; cacheRead: number; cacheWrite: number }
export type LastTurn = { input: number; output: number; ms: number; cost: number }
export type Stats = {
  turns: number; agentTurns: number; toolCalls: number; errors: number
  tools: Map<string, number>
  longestMs: number
  input: number; output: number; cacheRead: number; cacheWrite: number // the main thread: input is the uncached part only
  agentInput: number; agentOutput: number // subagents' turns, counted apart
  last: LastTurn | null
  model: string
}
export const newStats = (): Stats => ({
  turns: 0, agentTurns: 0, toolCalls: 0, errors: 0, tools: new Map(), longestMs: 0,
  input: 0, output: 0, cacheRead: 0, cacheWrite: 0, agentInput: 0, agentOutput: 0, last: null, model: '',
})

/** A turn's `usage` (TurnUsage, or nothing) as four clean counts. */
export function tokensOf(u: unknown): TurnTokens {
  const o = (u && typeof u === 'object' ? u : {}) as Record<string, unknown>
  return { input: num(o.input_tokens), output: num(o.output_tokens), cacheRead: num(o.cache_read_input_tokens), cacheWrite: num(o.cache_creation_input_tokens) }
}
/** Everything the prompt carried: fresh, cache-written and cache-read. */
export const inputTotal = (t: { input: number; cacheRead: number; cacheWrite: number }) => t.input + t.cacheRead + t.cacheWrite

/** Folds one finished turn in. `agent` turns (a subagent's loop) are kept apart from the main thread. */
export function addTurn(s: Stats, usage: unknown, o: { ms?: unknown; agent?: boolean; cost?: unknown } = {}): TurnTokens {
  const t = tokensOf(usage)
  const model = usage && typeof usage === 'object' ? (usage as { model?: unknown }).model : undefined
  if (o.agent) { s.agentTurns++; s.agentInput += inputTotal(t); s.agentOutput += t.output; return t }
  s.turns++
  s.input += t.input; s.output += t.output; s.cacheRead += t.cacheRead; s.cacheWrite += t.cacheWrite
  const ms = num(o.ms)
  s.longestMs = Math.max(s.longestMs, ms)
  s.last = { input: inputTotal(t), output: t.output, ms, cost: num(o.cost) }
  if (typeof model === 'string' && model) s.model = model
  return t
}
export function addTool(s: Stats, tool: unknown, isError = false) {
  s.toolCalls++
  if (isError) s.errors++
  const k = typeof tool === 'string' && tool ? tool : 'unknown'
  s.tools.set(k, (s.tools.get(k) ?? 0) + 1)
}
export function topTools(s: Stats, n = 3): [string, number][] {
  return [...s.tools].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n)
}

// ── derived ─────────────────────────────────────────────────────────────────
/** cache_read / (input + cache_read + cache_creation), 0..1; undefined with no input at all. */
export function cacheHit(t: { input: number; cacheRead: number; cacheWrite: number }): number | undefined {
  const all = inputTotal(t)
  return all > 0 ? Math.min(1, num(t.cacheRead) / all) : undefined
}
/** Dollars an hour over the session's elapsed time; undefined before two minutes (too noisy) or with no spend. */
export function burnRate(costUsd: unknown, elapsedMs: unknown): number | undefined {
  const c = num(costUsd), e = num(elapsedMs)
  if (e < 120_000 || c <= 0) return undefined
  return c / (e / 3_600_000)
}
/** Output tokens a second over a turn's wall time; undefined for a turn too short or silent to say. */
export function outputSpeed(outputTokens: unknown, ms: unknown): number | undefined {
  const o = num(outputTokens), m = num(ms)
  return m >= 500 && o > 0 ? o / (m / 1000) : undefined
}

// ── lifetime totals ─────────────────────────────────────────────────────────
export type Lifetime = { sessions: number; turns: number; toolCalls: number; inputTokens: number; outputTokens: number; cost: number; longestMs: number; bestTurnTools: number }
export const emptyLifetime = (): Lifetime => ({ sessions: 0, turns: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, cost: 0, longestMs: 0, bestTurnTools: 0 })
/** Whatever the store held, made safe: junk fields become 0, counts become whole numbers. */
export function sanitizeLifetime(raw: unknown): Lifetime {
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const w = (k: string) => Math.floor(num(o[k]))
  return { sessions: w('sessions'), turns: w('turns'), toolCalls: w('toolCalls'), inputTokens: w('inputTokens'), outputTokens: w('outputTokens'), cost: num(o.cost), longestMs: w('longestMs'), bestTurnTools: w('bestTurnTools') }
}
export type LifetimeDelta = Partial<{ sessions: number; turns: number; toolCalls: number; inputTokens: number; outputTokens: number; cost: number; longestMs: number; turnTools: number }>
export function addLifetime(lt: Lifetime, d: LifetimeDelta): Lifetime {
  const out = sanitizeLifetime(lt)
  out.sessions += Math.floor(num(d.sessions)); out.turns += Math.floor(num(d.turns)); out.toolCalls += Math.floor(num(d.toolCalls))
  out.inputTokens = Math.min(CAP, out.inputTokens + Math.floor(num(d.inputTokens))); out.outputTokens = Math.min(CAP, out.outputTokens + Math.floor(num(d.outputTokens)))
  out.cost = Math.min(CAP, out.cost + num(d.cost))
  out.longestMs = Math.max(out.longestMs, Math.floor(num(d.longestMs))); out.bestTurnTools = Math.max(out.bestTurnTools, Math.floor(num(d.turnTools)))
  return out
}

// ── what the band shows ─────────────────────────────────────────────────────
export type Tone = 'steel' | 'arc' | 'text' | 'amber' | 'red'
export type Piece = { text: string; tone: Tone }
export type BandNumbers = { inTok?: number; outTok?: number; cachePct?: number; fiveHour?: number }
export const limitTone = (pct: number): Tone => (pct >= 90 ? 'red' : pct >= 70 ? 'amber' : 'arc')
/** The extras after the spend, in the order they are dropped from the end: tokens in/out, cache hit, the 5-hour window. */
export function bandPieces(n: BandNumbers, o: { turnCost?: number } = {}): Piece[] {
  const out: Piece[] = []
  if (o.turnCost !== undefined && num(o.turnCost) > 0) out.push({ text: `turn ${fmtCost(o.turnCost)}`, tone: 'text' })
  if (n.inTok !== undefined || n.outTok !== undefined) {
    if (num(n.inTok) > 0 || num(n.outTok) > 0) out.push({ text: `↑${fmtTokens(n.inTok)} ↓${fmtTokens(n.outTok)}`, tone: 'steel' })
  }
  if (n.cachePct !== undefined && Number.isFinite(n.cachePct)) out.push({ text: `cache ${fmtPct(n.cachePct)}`, tone: 'arc' })
  if (n.fiveHour !== undefined && Number.isFinite(n.fiveHour)) out.push({ text: `5h ${fmtPct(n.fiveHour)}`, tone: limitTone(num(n.fiveHour)) })
  return out
}
/** The numbers the band keeps in its usage atom, from the totals and the engine's rate limits. */
export function bandNumbers(s: Stats, limits: unknown): BandNumbers {
  const hit = cacheHit(s), five = fiveHourOf(limits)
  const out: BandNumbers = {}
  if (s.turns > 0) { out.inTok = Math.round(inputTotal(s)); out.outTok = Math.round(s.output) }
  if (hit !== undefined) out.cachePct = Math.round(hit * 100)
  if (five !== undefined) out.fiveHour = five
  return out
}
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export function cleanLimits(raw: unknown): Limit[] {
  if (!Array.isArray(raw)) return []
  const out: Limit[] = []
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const o = r as Record<string, unknown>
    if (typeof o.kind !== 'string' || !o.kind) continue
    out.push({ kind: o.kind, percentUsed: num(o.percentUsed), ...(typeof o.resetsAt === 'string' ? { resetsAt: o.resetsAt } : {}) })
  }
  return out
}
export function fiveHourOf(limits: unknown): number | undefined {
  const l = cleanLimits(limits).find(x => x.kind === 'five_hour')
  return l ? Math.round(l.percentUsed) : undefined
}

// ── /clarvis stats ─────────────────────────────────────────────────────────────
export type ReportInput = {
  stats: Stats
  now: number
  model?: string
  startedAt?: number
  contextTokens?: number; contextWindow?: number; contextPercent?: number
  costUsd?: number
  limits?: unknown
  lifetime?: unknown
  showCost?: boolean // false: no money in the report (the showCost option)
  extras?: { commits: number; green: number; prs: number } // from the ledger: shipped work, all time
}
const LIMIT_NAMES: Record<string, string> = { five_hour: '5-hour window', seven_day: '7-day window', spend_limit: 'spend limit' }
const D = '—'
export function statsText(i: ReportInput): string {
  const s = i.stats
  const rows: string[] = []
  const W = 18
  const kv = (k: string, v: string) => rows.push(`  ${k.padEnd(W)}${v || D}`)
  const head = (t: string) => { rows.push(''); rows.push(t) }
  const started = typeof i.startedAt === 'number' && Number.isFinite(i.startedAt) ? i.startedAt : undefined
  const elapsed = started !== undefined && Number.isFinite(i.now) && i.now >= started ? i.now - started : undefined
  const model = (i.model || s.model || '').trim()

  rows.push('C.L.A.R.V.I.S. MISSION REPORT')
  rows.push('===========================')
  head('SESSION')
  kv('elapsed', elapsed !== undefined ? fmtSpan(elapsed) : D)
  kv('model', model)
  kv('turns', String(s.turns) + (s.agentTurns ? ` (+${s.agentTurns} agent)` : ''))
  kv('tool calls', String(s.toolCalls))
  const tops = topTools(s, 3)
  kv('top tools', tops.length ? tops.map(([k, n]) => `${k} ×${n}`).join(' · ') : D)
  kv('errors', String(s.errors))
  kv('longest turn', s.longestMs > 0 ? fmtSpan(s.longestMs) : D)

  head('TOKENS')
  const hit = cacheHit(s)
  const tot = inputTotal(s)
  kv('input', s.turns > 0 ? `${fmtTokens(tot)}  (${fmtTokens(s.input)} fresh)` : D)
  kv('output', s.turns > 0 ? fmtTokens(s.output) : D)
  kv('cache read', s.turns > 0 ? fmtTokens(s.cacheRead) : D)
  kv('cache write', s.turns > 0 ? fmtTokens(s.cacheWrite) : D)
  kv('cache hit', hit !== undefined ? fmtPct(hit * 100) : D)
  if (s.agentTurns > 0) kv('agent tokens', `↑${fmtTokens(s.agentInput)} ↓${fmtTokens(s.agentOutput)}`)
  const ctxT = i.contextTokens, ctxW = i.contextWindow
  const haveCtx = typeof ctxT === 'number' && Number.isFinite(ctxT) && typeof ctxW === 'number' && Number.isFinite(ctxW) && ctxW > 0
  const pct = haveCtx ? (ctxT! / ctxW!) * 100 : i.contextPercent
  kv('context', haveCtx ? `${fmtTokens(ctxT)} / ${fmtTokens(ctxW)}  (${fmtPct(pct)})` : typeof pct === 'number' && Number.isFinite(pct) ? fmtPct(pct) : D)

  const money = i.showCost !== false
  head(money ? 'COST' : 'SPEED')
  const haveCost = typeof i.costUsd === 'number' && Number.isFinite(i.costUsd)
  if (money) {
    kv('session', haveCost ? fmtCost(i.costUsd) : D)
    kv('last turn', s.last && s.last.cost > 0 ? fmtCost(s.last.cost) : D)
    const burn = elapsed !== undefined ? burnRate(i.costUsd, elapsed) : undefined
    kv('burn rate', burn !== undefined ? `${fmtCost(burn)}/h` : D)
  }
  const speed = s.last ? outputSpeed(s.last.output, s.last.ms) : undefined
  kv('output speed', speed !== undefined ? `${speed >= 100 ? Math.round(speed) : speed.toFixed(1)} tok/s (last turn)` : D)

  head('RATE LIMITS')
  const limits = cleanLimits(i.limits)
  if (!limits.length) kv('windows', D + ' (none reported)')
  for (const l of limits) kv(LIMIT_NAMES[l.kind] ?? l.kind, `${fmtPct(l.percentUsed)} used · resets in ${resetsIn(l.resetsAt, i.now)}`)

  head('LIFETIME')
  const lt = sanitizeLifetime(i.lifetime)
  kv('sessions', String(lt.sessions))
  kv('turns', String(lt.turns))
  kv('tool calls', String(lt.toolCalls))
  kv('tokens', `↑${fmtTokens(lt.inputTokens)} ↓${fmtTokens(lt.outputTokens)}`)
  if (money) kv('cost', fmtCost(lt.cost))
  kv('longest mission', lt.longestMs > 0 ? fmtSpan(lt.longestMs) : D)
  kv('biggest mission', lt.bestTurnTools > 0 ? `${lt.bestTurnTools} actions` : D)
  if (i.extras) { kv('commits', String(i.extras.commits)); kv('green test runs', String(i.extras.green)); kv('pull requests', String(i.extras.prs)) }
  rows.push('')
  rows.push('  /clarvis stats reset clears the lifetime totals.')
  return rows.join('\n')
}

// ── milestones and the context nudge ────────────────────────────────────────
export const TOKEN_MILESTONES = [1_000_000, 10_000_000, 100_000_000]
const MILESTONE_NAMES: Record<number, string> = { 1_000_000: '1M', 10_000_000: '10M', 100_000_000: '100M' }
export const lifetimeTokens = (lt: Lifetime) => lt.inputTokens + lt.outputTokens
/** The milestones a lifetime total crossed going from `before` to `after`, smallest first. */
export function crossed(before: number, after: number): number[] {
  const b = num(before), a = num(after)
  return TOKEN_MILESTONES.filter(m => b < m && a >= m)
}
export const milestoneText = (m: number) => `★ ${MILESTONE_NAMES[m] ?? fmtTokens(m)} tokens, all time. The suit has been busy.`
export const NUDGE_PERCENT = 85
/** Ant-Man's sincere nudge, once the context is nearly full; undefined below the line or on a bad reading. */
export function contextNudge(percent: unknown): string | undefined {
  const p = num(percent)
  return p >= NUDGE_PERCENT ? `Ant-Man: Context at ${Math.min(999, Math.round(p))}%: /compact shrinks it.` : undefined
}
