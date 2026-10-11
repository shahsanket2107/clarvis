// clarvis: the pure parts of the HUD's own words and plans. No engine access
// here: register.tsx feeds these plain values and draws what comes back.
//   · the terminal check that picks lite mode for a 256-colour terminal
//   · the /clarvis briefing card (built from the command table, so a new command
//     shows up in it by being added to that table)
//   · Fury's captions and the one place the end-of-turn caption is chosen
//   · the lite band's text rows
//   · the /clarvis demo showreel's script
import type { Piece, Tone } from './metrics'
import { fmtCost, fmtTokens } from './metrics'
import { fmtDur, type Row, type Seg } from './art'
import type { Ship } from './ship'

// ── terminal colour check ───────────────────────────────────────────────────
export type TermEnv = { colorterm?: unknown; termProgram?: unknown; tmux?: unknown; tmuxTruecolor?: unknown }
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
/** True when the terminal is not known to show 24-bit colour: the full art would band into 256 colours. */
export function needsLite(e: TermEnv): boolean {
  if (s(e.termProgram) === 'Apple_Terminal') return true
  const ct = s(e.colorterm).toLowerCase()
  if (ct !== 'truecolor' && ct !== '24bit') return true
  if (s(e.tmux) && s(e.tmuxTruecolor) !== '1') return true
  return false
}
export const LITE_HINT = 'Your terminal shows 256 colours, so Clarvis is in lite mode. Ghostty, iTerm2, WezTerm or kitty get the full art · /clarvis full to force it.'
export const WELCOME_TOAST = 'Clarvis is online. Type /clarvis for the briefing · /clarvis calm for no motion · /clarvis off for stock · /clarvis sound off to mute'
export const WELCOME_CAPTION = 'Welcome home, sir. Type /clarvis.'

// ── Nick Fury's captions (original lines, short) ────────────────────────────
export const FURY_LINES: string[] = [
  'Eyes up. I need a call from you.',
  'The team is holding. Your move.',
  'Decision needed. Make it quick.',
  'Not my call this time. Yours.',
  'Standing by for your word.',
  'One question stands between us and done.',
  'Brief me. Then we move.',
  'Orders, please. The clock is running.',
]
export const furyLine = (n: number): string => `"${FURY_LINES[Math.abs(Math.floor(Number.isFinite(n) ? n : 0)) % FURY_LINES.length]!}"`

/** The end-of-turn caption: the one place it is chosen. `done` is the ASSEMBLE caption, `fury` the question-for-you caption. */
export type CaptionKind = 'done' | 'fury'
export function endCaption(kind: CaptionKind, o: { n: number; big?: boolean; pool: readonly string[]; ship?: string; egg?: string; season?: string }): string {
  if (kind === 'fury') return furyLine(o.n)
  // what was shipped outranks a rare egg, which outranks the season's line, which outranks the big-mission line
  if (o.ship) return o.ship
  if (o.egg) return o.egg
  if (o.season) return o.season
  return o.big ? '"I am Iron Man."' : o.pool[Math.abs(o.n) % o.pool.length]!
}

// ── the /clarvis command table's shape, and the briefing card ──────────────────
export type CmdGroup = 'Look' | 'Play' | 'Stats' | 'Hero'
export const CMD_GROUPS: CmdGroup[] = ['Look', 'Play', 'Stats', 'Hero']
export type CmdInfo = { group: CmdGroup; usage: string; summary: string }
export function briefing(o: { mode: string; cmds: readonly CmdInfo[]; fullscreen?: boolean }): string {
  const rows: string[] = [`CLARVIS · ${o.mode} · unofficial fan mod`, '']
  for (const g of CMD_GROUPS) {
    const mine = o.cmds.filter(c => c.group === g)
    if (!mine.length) continue
    rows.push(g.toUpperCase())
    for (const c of mine) rows.push(`  /clarvis ${c.usage.padEnd(24)}${c.summary}`)
    rows.push('')
  }
  if (o.fullscreen === false) rows.push('Play and movies need fullscreen: /tui fullscreen')
  else rows.pop()
  return rows.join('\n')
}

// ── /clarvis notify: the ping for a long mission ────────────────────────────
export const NOTIFY_MAX_MIN = 24 * 60
/** `/clarvis notify <minutes|off>`: minutes (0 = off) or undefined for anything else. Decimals are fine (0.5); capped at a day. */
export function parseNotify(s: string): number | undefined {
  const t = s.trim().toLowerCase()
  if (t === 'off' || t === 'no' || t === 'none' || t === '0') return 0
  const m = /^(\d+(?:\.\d+)?)\s*(?:m|min|mins|minutes?)?$/.exec(t)
  if (!m) return undefined
  const n = Number(m[1])
  return Number.isFinite(n) && n > 0 ? Math.min(NOTIFY_MAX_MIN, n) : n === 0 ? 0 : undefined
}
/** The stored choice (a number of minutes, 0 = off) beats the `notifyAfterMinutes` option; junk in the store is ignored. */
export function notifyChoice(stored: unknown, option: number): number {
  return typeof stored === 'number' && Number.isFinite(stored) && stored >= 0 && stored <= NOTIFY_MAX_MIN ? stored : option
}
/** 5 → "5", 0.5 → "0.5": minutes as the person typed them. */
export const fmtMin = (n: number): string => String(Math.round(n * 100) / 100)
/** The notification's body, in Clarvis's voice, with the turn's ship-it facts when it had any. */
export function notifyBody(durationMs: number, actions: string, ship?: Ship): string {
  const extra = [ship?.tests ? 'tests green' : '', ship?.commit ? `commit ${ship.commit}` : '', ship?.pr ? `PR #${ship.pr}` : ''].filter(Boolean)
  return ['Mission complete, sir. ' + fmtDur(durationMs), actions, ...extra].join(' · ')
}

// ── lite mode: the band as text ─────────────────────────────────────────────
const LC = { text: '#E6E6F5', muted: '#8A8FB0', arc: '#5FE1FF', gold: '#F5C542', green: '#5FD38D', amber: '#FFB020', red: '#FF5C5C', steel: '#9AA7C7' }
const TONES: Record<Tone, string> = { steel: LC.steel, arc: LC.arc, text: LC.text, amber: LC.amber, red: LC.red }
export type LiteIn = {
  name: string; model: string; percent: number; tokens: number; cost: number; showCost: boolean
  pieces: readonly Piece[]
  work?: { hero: string; tool: string; detail: string } | null
  agents?: number
  cols: number
}
const len = (x: string) => [...x].length
const cut = (x: string, n: number) => { const a = [...x]; return a.length <= n ? x : n <= 1 ? '…' : a.slice(0, n - 1).join('') + '…' }
function clipRow(row: Row, w: number): Row {
  const out: Row = []
  let left = w
  for (const sg of row) { if (left <= 0) break; out.push({ ...sg, text: cut(sg.text, left) }); left -= len(sg.text) }
  return out
}
/** One row when idle, two while working. Plain text runs: nothing here moves, and a screen reader gets words. */
export function liteRows(i: LiteIn): Row[] {
  const w = Math.max(10, i.cols - 1)
  const num0 = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)
  const state = i.work ? '◓ at work' : i.agents ? `◓ ${i.agents} agent${i.agents > 1 ? 's' : ''} at work` : '✓ standing by'
  const parts: Seg[] = [
    { text: '◢ ', color: LC.arc, bold: true }, { text: cut(i.name, Math.max(6, Math.floor(w * 0.3))), color: LC.text }, { text: ` · ${state}`, color: i.work ? LC.gold : LC.green },
  ]
  const tail: Seg[] = []
  const add = (t: string, color: string) => tail.push({ text: ` · ${t}`, color })
  add(`ctx ${Math.round(Math.min(999, num0(i.percent)))}%`, num0(i.percent) > 85 ? LC.red : LC.text)
  if (i.showCost) add(`${fmtCost(i.cost)} spent`, LC.text)
  if (num0(i.tokens) > 0) add(`${fmtTokens(i.tokens)} tok`, LC.text)
  for (const p of i.pieces) add(p.text, TONES[p.tone] ?? LC.text)
  add(i.model.toUpperCase(), LC.muted)
  let used = parts.reduce((n, p) => n + len(p.text), 0)
  for (const t of tail) { const l = len(t.text); if (used + l > w) break; parts.push(t); used += l }
  const out: Row[] = [clipRow(parts, w)]
  if (i.work) out.push([
    { text: '▸ ', color: LC.gold, bold: true },
    { text: cut(`${i.work.hero}${i.work.tool ? ` · ${i.work.tool}` : ''}${i.work.detail ? ` ${i.work.detail}` : ''}`, w - 2), color: LC.text },
  ])
  return out
}

// ── /clarvis demo: a 45 s showreel, scripted ───────────────────────────────────
// boot → a fake working band (5 heroes, 6 s each so every animation plays whole, a ticking log) → ASSEMBLE with sample
// numbers → snap → Fury, then idle. The phases' lengths follow the moments' own.
export type DemoPhase = 'boot' | 'work' | 'assemble' | 'snap' | 'fury' | 'done'
export const DEMO_WORK_S = 30
export const DEMO_FURY_S = 3
export function demoPhaseAt(sec: number, secs: { boot: number; assemble: number; snap: number }): DemoPhase {
  const t = Number.isFinite(sec) ? sec : 0
  const b = secs.boot, w = b + DEMO_WORK_S, a = w + secs.assemble, sn = a + secs.snap
  return t < b ? 'boot' : t < w ? 'work' : t < a ? 'assemble' : t < sn ? 'snap' : t < sn + DEMO_FURY_S ? 'fury' : 'done'
}
// Iron Man suiting up (the nanotech suit-up animation), Thor, Loki, Spider-Man, Star-Lord
export const DEMO_CAST = ['thinking', 'thor', 'loki', 'spidey', 'starlord'] as const
const DEMO_STEPS: { tool: string; detail: string; ok: boolean }[] = [
  { tool: 'Read', detail: 'src/auth/session.ts', ok: true },
  { tool: 'Grep', detail: 'verifyToken', ok: true },
  { tool: 'Edit', detail: 'src/auth/session.ts', ok: true },
  { tool: 'Bash', detail: 'bun test', ok: false },
  { tool: 'Edit', detail: 'src/auth/token.ts', ok: true },
  { tool: 'Bash', detail: 'bun test', ok: true },
  { tool: 'Bash', detail: 'git commit -m "fix auth"', ok: true },
]
/** What the fake working band shows `w` seconds into the work phase. */
export function demoWork(w: number) {
  const t = Math.max(0, Math.min(DEMO_WORK_S, Number.isFinite(w) ? w : 0))
  const idx = Math.min(DEMO_CAST.length - 1, Math.floor(t / (DEMO_WORK_S / DEMO_CAST.length)))
  const n = Math.min(DEMO_STEPS.length, 1 + Math.floor(t * DEMO_STEPS.length / DEMO_WORK_S))
  const shown = DEMO_STEPS.slice(0, n)
  const cur = shown[n - 1]!
  const log = shown.slice(-3).reverse().map((x, k) => ({ ok: x.ok, tool: x.tool, detail: x.detail, ms: 400 + k * 730 }))
  return {
    cast: DEMO_CAST[idx]!, idx, tool: cur.tool, detail: cur.detail, log,
    elapsed: fmtDur((125 + t * 20) * 1000), tools: 12 + Math.floor(t * 4),
  }
}
/** The ASSEMBLE line of the demo, sample numbers only (never the session's). */
export const demoDone = (showCost: boolean) => `✓ mission complete · ${fmtDur(432_000)} · 41 actions${showCost ? ' · $1.84' : ''} · ↑312k ↓9.1k`
export const DEMO_NOTE = 'Clarvis demo: sample numbers, nothing is counted. Your next prompt ends it.'

// The name the band shows: the session's folder. Started from the home folder, or a drive or
// filesystem root, it says `~` or `/`, so a screenshot never shows the person's account name.
export function folderName(cwd: string, home?: string): string {
  const trim = (p: string) => p.replace(/[\\/]+$/, '').toLowerCase()
  if (home && trim(home) && trim(cwd) === trim(home)) return '~'
  return cwd.split(/[\\/]/).filter(Boolean).pop()?.replace(/^[A-Za-z]:$/, '/') || '/'
}
