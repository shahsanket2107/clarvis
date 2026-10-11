// clarvis: a Marvel-themed Claude Code mod.
//
//   AbovePrompt  one truecolor Raster (2 × 2 subpixels a cell, quadrant blocks):
//                idle, one Stark line (who, the suit's Mark, the core gauge,
//                the power draw); working, 8 rows: a 3D stage (ray-marched,
//                toon-shaded, pre-rendered turns) where the hero of the moment
//                plays, beside the content: what runs, on what, JARVIS, the
//                mission log, the gauges. Moments take it for a few seconds:
//                Stark boot (session start), CLAUVENGERS, ASSEMBLE! (done), Thanos
//                (error), Nick Fury (a permission ask waiting on you).
//   Spinner      folded into the band while the band shows
//   TurnDuration "✓ Mission complete in 1m 04s"
//
// Frames are repainted with $.ui.blit (no render pass) from a clock that runs
// only while something moves; at rest nothing ticks and nothing redraws.
// Modes: full (default) · calm (no motion, same words) · lite (text rows, no
// art, no clock) · off (stock UI). Which one a session starts in, first match
// wins: CLARVIS, the choice `/clarvis <mode>` stored, the `mode` option, a
// 256-colour terminal (lite), then full. Observe-only: no hook here changes a
// tool call, a verdict or a prompt.
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'
import type { AvengersMode, AvengersTurn, AvengersUsage, Fx, Hud } from '../types'
import { detailOf, footerRow, spinnerRow, type Row } from './art'
import { surface } from './pixel'
import {
  addLifetime, addTool, addTurn, bandNumbers, bandPieces, cacheHit, cleanLimits, contextNudge, crossed, emptyLifetime, fmtTokens, inputTotal, lifetimeTokens, milestoneText, newStats, num, sanitizeLifetime, statsText,
  type Limit, type Lifetime,
} from './metrics'
import { lineFor, DONE } from './lines'
import {
  DEMO_CAST, DEMO_NOTE, DEMO_WORK_S, LITE_HINT, WELCOME_CAPTION, WELCOME_TOAST, briefing, folderName, demoDone, fmtMin, notifyBody, notifyChoice, parseNotify, demoPhaseAt, demoWork, endCaption, furyLine, liteRows, needsLite,
  type CmdGroup, type CmdInfo, type DemoPhase,
} from './hud'
import { MOVIES, findMovie } from './movies'
import { shipOf, mergeShip, shipCaption, type Ship } from './ship'
import { addToLedger, bumpStreak, sanitizeLedger, sanitizeStreak, streakNow, sumDays, STREAK_TOASTS, dayKey } from './daily'
import { earned, extOf, sanitizeTrophies, trophiesText, trophyOf, type Facts } from './trophies'
import { TEAM_IDS, TEAMS, findHero, isTeam, orderFor, pickable, pinHere, sanitizeHere, sanitizeSel, stageIds, type TeamId } from './team'
import { EGG_CAPTIONS, flairOf, isRealDate, isThursday, rollEgg, seasonCaption, seasonOf, type Flair } from './season'
import { applyFlair, snow } from './flair'
import { missionCard, parseCardArgs } from './card'
import { COIN_DEFER_MS, coinReady, SOUND_GAIN, SOUND_NOTE, clipOf, soundChoice, soundGate, type ClipName } from './sound'
import { BURST_S, transcriptFx, type BurstKind } from './burst'
import {
  HERO, IDLE_ROWS, ROSTER, ROSTER_SECONDS, MOMENTS, WORK_ROWS_COMPACT, heroFor, MOMENT_ROWS, MOMENT_SECONDS, WORK_ROWS, clip, drawIdle, drawWorking, fmtDur, fury,
  type Activity, type Hero, type LogEntry, type Moment,
} from './scenes'

const hud = atom({ plugin: 'clarvis', key: 'hud' } as const, null as Hud | null)
const mode = atom({ plugin: 'clarvis', key: 'mode' } as const, 'full' as AvengersMode)
const turn = atom({ plugin: 'clarvis', key: 'turn' } as const, null as AvengersTurn | null)
// A moment holding the band; a change is a new size, so a redraw.
const fx = atom({ plugin: 'clarvis', key: 'fx' } as const, null as Fx | null)
const usage = atom({ plugin: 'clarvis', key: 'usage' } as const, { percent: 0, tokens: 0, cost: 0 } as AvengersUsage) // + the session's token totals, cache hit and 5-hour window, for the band
// A theater burst echoed on the transcript (fullscreen only): which, and its quarter-second step.
const tfx = atom({ plugin: 'clarvis', key: 'tfx' } as const, null as { kind: string; step: number } | null)
// Redraw requests, as counters only one kind of hook reads: `$.ui.invalidate('ui.render')` can't name a
// component (every render hook of the plugin, the transcript rows too, would draw again), but a write
// to a value redraws just the instances that read it.
// Who is on the stage, in rotation order (what /clarvis pick, /clarvis team and the seasons made of the roster).
const rosterAtom = atom({ plugin: 'clarvis', key: 'roster' } as const, [] as string[])
const bandNudge = atom({ plugin: 'clarvis', key: 'bandNudge' } as const, 0) // the AbovePrompt hook reads it
const paneNudge = atom({ plugin: 'clarvis', key: 'paneNudge' } as const, 0) // the theater pane reads it

const FRAME_MS = 100 // 10 fps while something moves
const CALM_MS = 1000 // calm mode: only the clock moves
const MODES: AvengersMode[] = ['full', 'calm', 'lite', 'off']
const isMode = (s: unknown): s is AvengersMode => typeof s === 'string' && (MODES as string[]).includes(s)
const shortModel = (m: string) => /opus|sonnet|haiku|fable/.exec(m.toLowerCase())?.[0] ?? m
// Fury, holding the band when a turn ends on a question for you, animates
// this long and then holds still (an idle session draws nothing).
const FURY_ANIM_MS = 6000

// ── JARVIS's lines and the team's ───────────────────────────────────────────
const doneLine = (n: number) => DONE[Math.abs(n) % DONE.length]!

// ── the band's live state (module-local: a reload starts it over) ───────────
// The clock: a chain of $.clock.after laid by session.start (whose `$` timers
// outlive their hook). It parks when nothing moves; `kick` lays it again.
let timer: unknown, timerAt = 0, chain = 0 // the pending step, when it was laid, and which chain it belongs to
let kick: () => void = () => {}
let fullMode = true, calmMode = false, liteMode = false
const isOff = () => !fullMode && !calmMode && !liteMode
// The plugin's options (manifest userConfig), read in register: showCost hides every $, notifyMin
// is the minutes a turn must run before a native notification at its end (0: never), cfgMode the
// `mode` option (undefined: unset).
let showCost = true, notifyMin = 0, notifyCfg = 0, cfgMode: AvengersMode | undefined
// /clarvis demo: a scripted showreel painted over the real band. Nothing is counted while it plays;
// the next real turn.start (or any mode change) ends it.
let demo: { at: number; phase: DemoPhase } | null = null
let working = false
let compacting = false // a compaction is running (it may come outside a turn)
let lastCells = '' // the cells last sent, so a still frame costs nothing
let bandReq = '', bandKey = '' // the band's requestId and the mounted Raster's key
let bandCols = 100, bandMaxRows = 20
let deniedAt = -1e12 // when a blit was last refused (the band is not mounted)
// Subagents at work (by agentId, with when each was last heard from): the band keeps
// working while any runs, even after the main turn has ended. One silent for
// AGENT_STALE_MS is let go (a loop that ended without its turn.complete reaching us).
const agents = new Map<string, number>()
const AGENT_STALE_MS = 3 * 60_000 // an engine fork (compaction, memory) can call a tool and never raise a turn.complete: don't hold the band for it long
const agentRunning = new Map<string, number>() // tool calls an agent has in flight: such an agent is not silent, however long the call
function agentsBusy(): number { const t = now(); for (const [id, at] of agents) if (t - at > AGENT_STALE_MS && !agentRunning.get(id)) { agents.delete(id); agentRunning.delete(id) } return agents.size }
const busy = (isWorking: boolean) => isWorking || working || compacting || agentsBusy() > 0 || demo?.phase === 'work'
let act: Activity = 'thinking', actAt = 0, curTool = '', curDetail = '', toolAt = 0
let line = '"At your service, sir."', lineBy = 'JARVIS', lineAt = 0
let log: LogEntry[] = []
let lastToolFailed = false // the turn's last (main-thread) tool call failed: Claude ended without recovering
let spinMode = 'thinking'
let hudInfo: Hud | null = null, usageNow: AvengersUsage = { percent: 0, tokens: 0, cost: 0 }, turnNow: AvengersTurn | null = null
let currentFx: Fx | null = null
let nextFx: Fx | null = null // a moment queued behind the one playing (no caller now: a success plays ASSEMBLE alone)
let bump = 0
const running: string[] = [] // the tools running right now (the newest last): row 0 says so at once
let rotIdx = 0, rotStart = 0 // the roster: whose turn it is, and since when
// Who is on the stage: /clarvis team and /clarvis pick (global, or pinned to this project), kept in $.store.
let sel: { team: TeamId; pick?: string } = { team: 'all' }, hereMap: Record<string, string> = {}, sessionCwd = ''
// The rotation's order: shuffled afresh for each session (and module load), so no two
// sessions open on the same hero or run the same sequence; within a session every lap
// runs that order, so each hero comes round exactly once every lap. The roster is filtered
// by the team or pick, then the seasons touch it (Halloween's villains first, Thor twice on Thursdays).
let order: (typeof ROSTER)[number][] = []
function shuffleRoster(d?: Date) {
  const ids = stageIds(ROSTER, sel, hereMap[sessionCwd])
  const whole = ids.length > 1
  const season = d ? seasonOf(d) : null
  order = orderFor(ids, { rng: dice.rng, villains: whole && fullMode && season === 'halloween', thursday: whole && fullMode && !!d && isThursday(d) }) as (typeof ROSTER)[number][]
  rotIdx = 0; rotStart = 0
}
// The dice: a test swaps in its own.
export const dice = { rng: (() => Math.random()) as () => number }
let eggs: 'always' | 'never' | 'chance' = 'chance' // CLARVIS_EGG=always|never: a test knob for the rare after-turn eggs
shuffleRoster()
// The order this session runs (tests read it).
export const rotation = (): readonly (typeof ROSTER)[number][] => order
function rosterAt(k: number): (typeof ROSTER)[number] { const n = order.length; return order[((k % n) + n) % n]! }
// The session's real numbers (module-local: a reload starts them over): token totals from each
// main turn's usage, tool counts, and the last reading of the engine's usage.
const stats = newStats()
let reading: { startedAt?: number; ctxTokens?: number; ctxWindow?: number; ctxPercent?: number; cost?: number; limits: Limit[] } = { limits: [] }
let costAtStart = 0 // the session's spend when this turn began: the mission's cost is the difference
const counts: Record<string, number> = {}
// This session's shipped work and edits, and the streak, the sound and the hints that fire once a session.
let turnShip: Ship | undefined, turnHeroes: Record<string, number> = {}
const exts = new Set<string>()
let streakDays = 0, nudged = false
let soundOn = true, cfgSound = true, soundAt = -1e12, burstAt = -1e12, soundName: ClipName | undefined, coinDue = 0, closing = false
let startedWall = 0 // when this session began, on the engine's clock (the shawarma egg)
// AVENGERS THEATER: the movie to open straight into (a nonce per request), screen FX on or off,
// and the transcript echo of a burst (when it began, its last step written)
let theaterStart: number | undefined, theaterNonce = 0, fxOn = false // fxOn: the transcript echo of a theater burst (opt in with /clarvis fx on); the theater's own bursts need only full mode
let echo: { kind: string; at: number; step: number } | undefined, echoLast = -1e12
const ECHO_GAP_MS = 20_000
// How the recent turns ended, by duration (what the engine's TurnDuration line carries): the closing line's words.
const outcomes = new Map<number, { outcome: 'done' | 'failed' | 'aborted'; tools: number }>()

// Time comes from $.clock (a test's mock clock too), read at each hook's start.
let clockNow = Date.now()
const now = () => clockNow
const sync = async ($: any) => { try { clockNow = await $.clock.now() } catch { clockNow = Date.now() } }
const secs = (ms: number) => ms / 1000 // seconds on one clock, never wrapping
function say(next: { by: string; text: string } | string) {
  const l = typeof next === 'string' ? { by: 'JARVIS', text: next } : next
  if (l.text !== line) { line = l.text; lineBy = l.by; lineAt = now() }
}
function onStage(a: Activity) { if (a !== act) { act = a; actAt = now() } }
// Nothing changes faster than you can read it: a hero and their line hold the
// stage at least this long; a newer one waits its turn (the latest wins).
const HOLD_MS = 7000
let shownAt = 0
let pending: { a: Activity; line: { by: string; text: string }; tool: string } | undefined
function show(a: Activity, l: { by: string; text: string }, tool = '') {
  if (now() - shownAt < HOLD_MS) { pending = { a, line: l, tool }; return }
  pending = undefined; shownAt = now()
  onStage(a); curTool = tool; say(l)
}
function showPending() { if (pending && now() - shownAt >= HOLD_MS) { const p = pending; pending = undefined; show(p.a, p.line, p.tool) } }

// What the band is now, and its height.
type View = { kind: 'idle'; busy?: boolean } | { kind: 'work' } | { kind: 'moment'; m: Moment; at: number; detail: string; caption: string; flair?: Flair }
const NARROW_MIN = 16 // the least the band draws at: the name and the spend
const WIDE_MIN = 40 // the stage and the moments need this much; narrower, the band is its one line
function viewOf(x: Fx | null, isWorking: boolean): View {
  if (bandCols < WIDE_MIN) return { kind: 'idle', busy: isWorking }
  if (x) {
    const m = x.moment as Moment
    if (MOMENT_ROWS[m] && MOMENT_ROWS[m] <= bandMaxRows - 2) return { kind: 'moment', m, at: x.at, detail: x.detail ?? '', caption: x.caption ?? '', flair: x.flair as Flair | undefined }
  }
  return isWorking && bandMaxRows >= WORK_MIN ? { kind: 'work' } : { kind: 'idle', busy: isWorking } // too few rows to work in: the one line says so
}
// The working band takes the full-width lane when the terminal has the room. With
// less (a notice, the tasks list growing a row per subagent) the lane is squeezed,
// down to LANE_MIN rows, then the stage gives up its log rows: the lane always stays.
// A tree of at most maxRows shows whole, so no margin is kept.
const LANE_MIN = 3
const WORK_MIN = 7 // the least a working band takes: 4 stage rows (head, line, gauges) and the lane
const laneRows = () => Math.max(LANE_MIN, Math.min(WORK_ROWS - WORK_ROWS_COMPACT, bandMaxRows - WORK_ROWS_COMPACT))
const stageRows = () => Math.min(WORK_ROWS_COMPACT, Math.max(WORK_MIN - LANE_MIN, bandMaxRows - laneRows()))
const rowsOf = (v: View) => (v.kind === 'moment' ? MOMENT_ROWS[v.m] : v.kind === 'work' ? stageRows() + laneRows() : IDLE_ROWS)
// Fits the full working frame into `to`: the stage's top rows as they are, the lane
// (rows WORK_ROWS_COMPACT..WORK_ROWS) squeezed into the rest, its name tag on the last row.
function squeeze(from: ReturnType<typeof surface>['cv'], to: ReturnType<typeof surface>['cv'], stage: number) {
  const W = from.W, src0 = WORK_ROWS_COMPACT * 2, src = from.h - src0, top = stage * 2, dst = to.h - top
  to.panel = from.panel
  to.px.set(from.px.subarray(0, top * W))
  for (let j = 0; j < dst; j++) { const sy = src0 + Math.min(src - 1, Math.floor(((j + 0.5) * src) / dst)); to.px.set(from.px.subarray(sy * W, (sy + 1) * W), (top + j) * W) }
  const w = from.w, keep = stage * w, last = (to.rows - 1) * w, tag = (from.rows - 1) * w
  to.glyph.set(from.glyph.subarray(0, keep)); to.glyphFg.set(from.glyphFg.subarray(0, keep)); to.glyphBg.set(from.glyphBg.subarray(0, keep))
  to.glyph.set(from.glyph.subarray(tag, tag + w), last); to.glyphFg.set(from.glyphFg.subarray(tag, tag + w), last); to.glyphBg.set(from.glyphBg.subarray(tag, tag + w), last)
}

// The extras after the spend (tokens, cache, rate limit), and the usage the gauges draw: showCost off hides every $.
const piecesOf = (turnCost?: number) => {
  const p = bandPieces(usageNow, showCost && turnCost !== undefined ? { turnCost } : {})
  if (streakDays >= 2) p.push({ text: `▲${streakDays}d`, tone: 'steel' }) // last: the first piece to go when the line is short
  return p
}
const usageFor = (turnCost?: number) => ({ ...usageNow, pieces: piecesOf(turnCost), ...(showCost ? {} : { hideCost: true }) })
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

// Draws the band's current frame; returns its cells.
function frame(v: View): { cells: string; rows: number } {
  const rows = rowsOf(v)
  const squeezed = v.kind === 'work' && rows < WORK_ROWS
  const sf = surface('band', bandCols, squeezed ? WORK_ROWS : rows), cv = sf.cv
  cv.clear()
  const t = now()
  const who = hudInfo ?? { name: 'session', model: 'opus' }
  if (v.kind === 'moment') {
    const s = (t - v.at) / 1000, args = { who, usage: usageNow, detail: v.detail, caption: v.caption }
    if (v.m === 'fury') fury(cv, calmMode ? 0 : s, args, calmMode)
    else MOMENTS[v.m](cv, calmMode ? Math.max(0, MOMENT_SECONDS[v.m] - 0.5) : Math.min(s, MOMENT_SECONDS[v.m]), args) // calm: one still frame, everything shown
    if (fullMode && v.flair) applyFlair(cv, v.flair, Math.max(0, s)) // seasonal and easter-egg touches: full mode only
  } else if (v.kind === 'work') {
    // thinking or writing, the team takes turns on stage, each with a line of their own
    // the whole team takes turns on stage, ROSTER_SECONDS each, in order, whatever
    // the tool: the clock is the wall clock, so the order runs on across turns and
    // every hero comes round. Calm mode keeps the hero of the job, still.
    // each hero gets a full ROSTER_SECONDS from the moment they arrive; the order
    // carries on across turns (a long pause resumes with the next hero, not a jump)
    const step = ROSTER_SECONDS * 1000
    if (!rotStart || t < rotStart || t - rotStart > step * 3) { if (rotStart) rotIdx++; rotStart = t }
    while (t - rotStart >= step) { rotIdx++; rotStart += step }
    const k = rotIdx
    const D = demo?.phase === 'work' ? demoWork(secs(t - demo.at) - demoStart()) : null // the showreel: five heroes and a ticking log, sample numbers
    const cast = D ? D.cast : compacting ? 'antman' : calmMode ? undefined : rosterAt(k)
    const castLine = D ? lineFor(D.cast, D.idx, D.detail) : cast ? lineFor(cast, Math.floor(k / ROSTER.length), curDetail || curTool) : undefined
    if (D) drawWorking(cv, {
      who, usage: usageFor(0.42), calm: false, act: D.cast, actAt: secs(demo!.at) + demoStart() + D.idx * (DEMO_WORK_S / DEMO_CAST.length), tool: D.tool, detail: D.detail,
      line: castLine!.text, speaker: castLine!.by, lineAt: secs(demo!.at) + demoStart() + D.idx * (DEMO_WORK_S / DEMO_CAST.length), elapsed: D.elapsed, tools: D.tools, log: D.log, lane: true, cast: D.cast,
    }, secs(t))
    else drawWorking(cv, {
      who, usage: usageFor(Math.max(0, usageNow.cost - costAtStart)), calm: calmMode, act, actAt: cast ? secs(rotStart) : secs(actAt), tool: running[running.length - 1] ?? (!working && agents.size ? `${agents.size} agent${agents.size > 1 ? 's' : ''}` : ''), // a new hero starts their animation from the top
      detail: curDetail || (turnNow?.prompt ? `◇ "${clip(turnNow.prompt, 120)}"` : ''),
      line: castLine?.text ?? line, speaker: castLine?.by ?? lineBy, lineAt: castLine ? secs(rotStart) : secs(lineAt), elapsed: turnNow ? fmtDur(t - turnNow.startedAt) : '', tools: turnNow?.tools ?? 0, log, lane: true,
      // thinking or writing, the team takes turns on stage
      cast,
    }, secs(t))
  } else {
    const n = agents.size, label = n && !working ? `◓ ${n} agent${n > 1 ? 's' : ''} at work` : '◓ at work'
    drawIdle(cv, who, usageFor(), v.busy ? label : undefined)
  }
  if (fullMode && v.kind !== 'moment' && seasonOf(new Date(now())) === 'winter') snow(cv, secs(now())) // December: snow falls through the empty cells
  if (squeezed) { const out = surface('band-squeezed', bandCols, rows); out.cv.clear(); squeeze(cv, out.cv, stageRows()); return { cells: out.cells(), rows } }
  return { cells: sf.cells(), rows }
}

// ── the clock: on while anything moves, off at rest ─────────────────────────
function wantMs(): number {
  if (!fullMode && !calmMode) return 0
  if (echo) return FRAME_MS // a transcript echo is stepping
  if (coinDue > 0 && fullMode) return 250 // a trophy's coin is waiting for the end-of-turn clip to clear
  if (!bandKey) return 0 // no band is mounted (Desktop, VS Code, -p, collapsed): nothing to paint; the band's hook kicks the clock when it mounts
  if (demo && fullMode) return FRAME_MS // the showreel moves all the way through, Fury's closing seconds too
  // Fury animates a few seconds, then holds still until you answer
  if (currentFx?.moment === 'fury' && !working) return now() - currentFx.at < FURY_ANIM_MS ? (fullMode ? FRAME_MS : 0) : 0
  if (fullMode && (working || compacting || currentFx || agentsBusy())) return FRAME_MS
  if (calmMode && (working || compacting || currentFx || agentsBusy())) return CALM_MS
  return 0
}
async function setFx($: any, x: Fx | null) {
  currentFx = x
  await update($, fx, () => x)
  kick()
}
async function moment($: any, m: Moment, detail: string, caption = '', flair?: Flair) {
  if (!fullMode && !(calmMode && (m === 'fury' || m === 'assemble'))) return // calm: Fury and the end-of-turn summary, both still
  await setFx($, { moment: m, at: now(), detail, caption, ...(flair && fullMode ? { flair } : {}) })
}
// The showreel's phases: each moment is set when its phase begins, in the moments' own lengths.
const demoStart = () => MOMENT_SECONDS.boot // the work phase begins when the boot ends
async function demoAdvance($: any) {
  if (!demo) return
  const ph = demoPhaseAt(secs(now() - demo.at), MOMENT_SECONDS)
  if (ph === demo.phase) return
  demo.phase = ph
  if (ph === 'done') { demo = null; await setFx($, null); return }
  const x: Fx | null = ph === 'assemble' ? { moment: 'assemble', at: now(), detail: demoDone(showCost), caption: '"Avengers... assemble."' }
    : ph === 'snap' ? { moment: 'snap', at: now(), detail: '✓', caption: lineFor('snap', 3).text }
    : ph === 'fury' ? { moment: 'fury', at: now(), detail: 'Demo: shall I ship this?', caption: furyLine(0) }
    : null
  if (ph === 'assemble') playSound($, 'assemble')
  else if (ph === 'snap') playSound($, 'whomp')
  await setFx($, x)
}
async function tick($: any) {
  await sync($)
  if (coinDue > 0 && !working && !closing && coinReady({ now: now(), dueAt: coinDue, lastAt: soundAt })) { coinDue = 0; playSound($, 'coin') }
  await demoAdvance($)
  if (echo) { // the transcript echo of a theater burst: four quarter-second steps, then gone
    const step = Math.floor((now() - echo.at) / ((BURST_S * 1000) / 4))
    if (step >= 4) { echo = undefined; await update($, tfx, () => null) }
    else if (step !== echo.step) { echo.step = step; const k = echo.kind; await update($, tfx, () => ({ kind: k, step })) }
  }
  showPending()
  const x = currentFx
  if (x && x.moment !== 'fury' && now() - x.at > MOMENT_SECONDS[x.moment as Moment] * 1000) { const n = nextFx; nextFx = null; await setFx($, n ? { ...n, at: now() } : null); return }
  if (!bandReq || !bandKey) return
  const f = frame(viewOf(x, busy(false)))
  if (`${f.rows}x${bandCols}` !== bandKey) { await update($, bandNudge, n => n + 1); return } // another size: the band's hook draws again
  if (f.cells === lastCells) return // nothing moved: send nothing
  lastCells = f.cells
  // never wait on the paint: a pane that isn't on screen can hold a blit back, and
  // the clock must keep running regardless
  const key = bandKey
  void Promise.resolve($.ui.blit({ requestId: bandReq, key, cells: f.cells })).then(r => {
    // refused: the band is not mounted (collapsed with [-], or gone). Stop painting and give the
    // spinner back its row; if the band is still there its hook draws again and takes the key back.
    if (r && typeof r === 'object' && 'deny' in r && key === bandKey) {
      bandKey = ''; lastCells = ''
      if (now() - deniedAt > 2000) { deniedAt = now(); void update($, bandNudge, n => n + 1) } // one redraw asked every 2 s: a band that is there takes the key back, one that isn't stays quiet
    }
  }).catch(() => {})
}

// Folds an engine reading (session.usage() or a session.measure) into the band's numbers.
async function applyUsage($: any, u: any) {
  const ctx = u?.context ?? {}
  reading = {
    startedAt: typeof u?.startedAt === 'number' && Number.isFinite(u.startedAt) ? u.startedAt : reading.startedAt,
    ctxTokens: typeof ctx.tokens === 'number' ? ctx.tokens : undefined, ctxWindow: typeof ctx.window === 'number' ? ctx.window : undefined, ctxPercent: typeof ctx.percent === 'number' ? ctx.percent : undefined,
    cost: typeof u?.cost?.usd === 'number' ? u.cost.usd : undefined, limits: cleanLimits(u?.rateLimits),
  }
  usageNow = { percent: ctx.percent ?? 0, tokens: ctx.tokens ?? 0, cost: u?.cost?.usd ?? 0, ...bandNumbers(stats, reading.limits) }
  await update($, usage, () => usageNow)
}
async function refreshUsage($: any) {
  try { await applyUsage($, await $.session.usage()) } catch { /* usage is decoration */ }
}
// Lifetime totals live in $.store; whatever is there is made safe before it is used.
// Store writes that read, change and write back go one at a time, so two hooks can't lose each other's update.
let storeQ: Promise<unknown> = Promise.resolve()
const queued = <T,>(f: () => Promise<T>): Promise<T | undefined> => { const r = storeQ.then(f, f); storeQ = r.catch(() => {}); return r.catch(() => undefined) }
// Adds to the lifetime totals; resolves the totals before and after (undefined if the store failed).
function bumpLifetime($: any, d: Parameters<typeof addLifetime>[1]): Promise<{ before: Lifetime; after: Lifetime } | undefined> {
  return queued(async () => {
    const before = sanitizeLifetime(await $.store.get('lifetime'))
    const after = addLifetime(before, d)
    await $.store.set('lifetime', after)
    return { before, after }
  })
}
const today = () => new Date(now())
// The ledger (daily buckets and shipped-work counts) gains a delta; resolves what it holds now.
function bumpLedger($: any, d: Parameters<typeof addToLedger>[2]) {
  return queued(async () => {
    const lg = addToLedger(await $.store.get('ledger'), today(), d)
    await $.store.set('ledger', lg)
    return lg
  })
}

// ── sound: opt-in, full mode only, one clip at a time, never in the way ──────
function playSound($: any, name: ClipName) {
  const m = fullMode ? 'full' : calmMode ? 'calm' : liteMode ? 'lite' : 'off'
  if (!soundGate({ on: soundOn, mode: m, now: now(), lastAt: soundAt, burstAt, name, lastName: soundName })) return
  soundAt = now(); soundName = name
  try { void Promise.resolve($.audio.play(clipOf(name), { gain: SOUND_GAIN })).catch(() => {}) } catch { /* no player: silence */ }
}

// ── trophies: earned once ever, kept in $.store as {id: unlockedAtMs} ────────
async function award($: any, id: string) {
  const t = trophyOf(id)
  if (!t || demo || isOff()) return // the showreel never awards
  const fresh = await queued(async () => {
    const got = sanitizeTrophies(await $.store.get('trophies'))
    if (got[id]) return false
    got[id] = Math.max(1, now())
    await $.store.set('trophies', got)
    return true
  })
  if (!fresh) return
  try { await $.ui.toast(`★ Trophy unlocked · ${t.text}`) } catch { /* decoration */ }
  // a coin earned while a turn runs (or as it closes) waits for the end-of-turn clip
  if (working || closing) coinDue = Math.max(coinDue, now() + COIN_DEFER_MS)
  else playSound($, 'coin')
}
/** Awards whatever these facts earn (the store says which are new). */
async function check($: any, f: Facts) {
  if (demo || isOff()) return
  for (const id of earned(f)) await award($, id)
}
/** Facts about the whole history, read from the store. */
async function history($: any): Promise<Facts> {
  const lt = sanitizeLifetime(await $.store.get('lifetime').catch(() => undefined)), lg = sanitizeLedger(await $.store.get('ledger').catch(() => undefined))
  return { commits: lg.life.commits, green: lg.life.green, prs: lg.life.prs, tokens: lifetimeTokens(lt), toolCalls: lt.toolCalls, sessions: lt.sessions, streak: streakDays }
}
// Panes need the fullscreen layout: only there does the Client get keys and clicks. On the main
// screen every pane is inline and cannot be played, so none is opened there.
const FULLSCREEN_HINT = 'Run /tui fullscreen to play'
/** A sentence end: a title that already ends in punctuation (WHAT IF...?) gets no extra full stop. */
const stop = (t: string) => (/[.!?…]$/.test(t) ? t : `${t}.`)
const notFullscreen = (fs: boolean | undefined) => fs === false
// Opens a pane; false when the engine left it unplaced (no attached surface places panes).
let paneWhy = '' // why the last pane was left unplaced: the engine's own reason
async function openPane($: any, id: string, title: string): Promise<boolean> {
  // as big as the layout allows: a wide dock beside a fullscreen transcript,
  // a tall block when inline (the person can still drag it to taste)
  // no closeOnEscape: Esc only hands the keys back to the prompt; q (in the game) or ✕ closes
  const r = await $.ui.open({ id, title, focus: true, rows: 60, columns: 180 })
  paneWhy = ''
  if (r && r.isPlaced === false) {
    paneWhy = typeof r.reason === 'string' && r.reason ? r.reason : 'no attached surface places panes here'
    try { await $.ui.toast(`${title} is open but not shown: ${paneWhy}`) } catch { /* decoration */ }
    return false
  }
  return true
}
// STARK ARCADE: `/clarvis play`, or the play button on the band.
const openArcade = ($: any) => openPane($, 'avengers-arcade', 'STARK ARCADE')
// AVENGERS THEATER: `/clarvis movies`, the movies button, or `/clarvis movie <n>` (start: that movie).
const notShown = (title: string) => `${title} is open but not shown: ${paneWhy || 'no attached surface places panes here'}. It appears once the layout allows it.`
async function openTheater($: any, start?: number) {
  theaterStart = start; theaterNonce++
  const placed = await openPane($, 'avengers-theater', 'AVENGERS THEATER')
  await update($, paneNudge, n => n + 1) // an open theater picks up the new movie
  return placed
}
// What a play button does: open the pane, or say what it needs when the layout can't play it.
async function playButton($: any, fullscreen: boolean | undefined, open: () => Promise<unknown>) {
  if (notFullscreen(fullscreen)) { try { await $.ui.toast(FULLSCREEN_HINT) } catch { /* decoration */ } return }
  await open()
}
async function seenMovies($: any): Promise<string[]> {
  const v = await $.store.get('moviesSeen')
  return Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === 'string') : []
}
async function standDownFury($: any) {
  if (currentFx?.moment === 'fury') await setFx($, null)
}

// Draws one row of styled runs (the calm spinner and the turn's footer).
function line1($: any, e: any, row: Row) {
  const { Box, Text } = $.ui.resolve(e)
  return (
    <Box flexDirection="row">
      {row.map(s => (s.bg
        ? <Text color={s.color} backgroundColor={s.bg} bold={!!s.bold} wrap="truncate">{s.text}</Text>
        : <Text color={s.color} bold={!!s.bold} wrap="truncate">{s.text}</Text>))}
    </Box>
  )
}

// A burst in the theater echoes on the transcript for a second (fullscreen only): a tint or
// a jolt around each row, never its words. No burst: the row is drawn untouched.
async function echoRow($: any, e: any, next: any) {
  if (e.surface !== 'terminal' || e.viewport?.isFullscreen !== true || !fxOn || !fullMode) return next(e) // the cheap checks first: this runs on every transcript row
  const x = await read($, tfx)
  if (!x) return next(e)
  const st = transcriptFx(x.kind as BurstKind, x.step / 4)
  if (!st) return next(e)
  const d = await next(e)
  const { Box } = $.ui.resolve(e)
  return <Box flexDirection="column" paddingLeft={st.pad ?? 0} {...(st.bg ? { backgroundColor: st.bg } : {})}>{d}</Box>
}
// The pane on the main screen: every pane is inline there and the Client gets no keys or clicks, so no game is drawn.
function needsFullscreen($: any, e: any, title: string, id: string) {
  const { Box, Text, Button } = $.ui.resolve(e)
  return (
    <Box flexDirection="row">
      <Box flexGrow={1}><Text color="#FFB020" wrap="truncate">{title}: {FULLSCREEN_HINT} (the main screen gives a pane no keys or clicks)</Text></Box>
      <Button key="close" plain label="✕ Close" onPress={() => { void $.ui.close({ id }) }} />
    </Box>
  )
}
function passRow($: any, e: any, next: any) { return next(e) } // decoration never stands in the way

// ── /clarvis's subcommands: one table. A command is added by pushing a row; the
// briefing card, the unknown-command reply, the command's description and its
// argument hint all read this table, so a new row shows up in all of them. ───
export type HeroCmd = CmdInfo & {
  id: string // which case of runCmd runs it
  names: string[] // what the person types (the first word of the args)
  tag: string // the short word in the command's description and hint
}
export const COMMANDS: HeroCmd[] = []
const findCmd = (verb: string) => COMMANDS.find(c => c.names.includes(verb))
const heroTags = () => COMMANDS.map(c => c.tag).filter(Boolean)

async function setMode($: any, want: AvengersMode) {
  await update($, mode, () => want)
  await $.store.set('mode', want)
  fullMode = want === 'full'; calmMode = want === 'calm'; liteMode = want === 'lite'
  const x = currentFx
  const hadDemo = !!demo
  if (!fullMode) demo = null
  if (want === 'off' || want === 'lite' || (x && x.moment !== 'fury' && x.moment !== 'assemble' && !fullMode) || (hadDemo && !fullMode)) await setFx($, null)
  if (want === 'off') { working = false; running.length = 0 }
  if ((want === 'off' || want === 'lite') && echo) { echo = undefined; await update($, tfx, () => null) } // no tint is left on the transcript
  await update($, bandNudge, n => n + 1)
  kick()
}

async function cmd_look($: any, _e: any, verb: string, rest: string): Promise<{ text: string }> {
    if (rest) return { text: `No /clarvis command "${verb} ${rest}". Type /clarvis for the list.` } // a mode takes no argument
    await setMode($, verb as AvengersMode)
    return { text: `Clarvis: ${verb}${verb === 'off' ? ' (stock Claude Code look)' : verb === 'lite' ? ' (text rows, no art, works with screen readers)' : ''}. New sessions start this way too.` }
}
async function cmd_fx($: any, _e: any, _v: string, rest: string): Promise<{ text: string }> {
    if (rest !== 'on' && rest !== 'off') return { text: `Transcript FX are ${fxOn ? 'on' : 'off'}. Use /clarvis fx on or off.` }
    fxOn = rest === 'on'; await $.store.set('fx', rest)
    if (!fxOn && echo) { echo = undefined; await update($, tfx, () => null) }
    await update($, paneNudge, n => n + 1)
    return { text: `Transcript FX ${rest}: ${!fxOn ? 'theater bursts stay inside the theater' : fullMode ? 'theater bursts also tint the transcript (fullscreen)' : 'the transcript tint is drawn in full mode only (/clarvis full)'}.` }
}
async function cmd_play($: any, e: any, _v: string, _r: string): Promise<{ text: string }> {
    if (notFullscreen(e.presentation?.isFullscreen)) return { text: `STARK ARCADE needs Claude Code's fullscreen mode (the main screen gives a game no keys or clicks). ${FULLSCREEN_HINT}, then /clarvis play.` }
    if (!(await openArcade($))) return { text: notShown('STARK ARCADE') }
    return { text: 'STARK ARCADE is up. Click the pane, then 1–5 or ↑↓ SPACE to pick a game; SPACE goes through every screen. Q quits. Drag the pane taller for a bigger arena, or use a terminal 110+ columns wide for the big docked pane.' }
}
async function cmd_movies($: any, e: any, _v: string, _r: string): Promise<{ text: string }> {
    if (notFullscreen(e.presentation?.isFullscreen)) return { text: `AVENGERS THEATER needs Claude Code's fullscreen mode. ${FULLSCREEN_HINT}, then /clarvis movies.` }
    if (!(await openTheater($))) return { text: notShown('AVENGERS THEATER') }
    return { text: 'AVENGERS THEATER is up: 10 movies. Click a movie or press 1–0 (0 opens #10), or use ↑↓ and SPACE to watch; ←/→ skip shots, P pauses, Q goes back to the list.' }
}
async function cmd_movie($: any, e: any, _v: string, q: string): Promise<{ text: string }> {
    if (!q) return { text: `Use /clarvis movie <1-9, 0 for 10>, a title (${MOVIES.map(x => x.title.toLowerCase()).join(', ')}), next or random.` }
    const seen = await seenMovies($)
    const unseen = MOVIES.filter(m => !seen.includes(m.id)), pool = unseen.length ? unseen : MOVIES
    const m = q === 'next' ? pool[0] : q === 'random' ? pool[Math.floor(Math.random() * pool.length)] : findMovie(q)
    if (!m) return { text: `No movie "${q}". Use /clarvis movie <1-9, 0 for 10>, a title (${MOVIES.map(x => x.title.toLowerCase()).join(', ')}), next or random.` }
    if (notFullscreen(e.presentation?.isFullscreen)) return { text: `AVENGERS THEATER needs Claude Code's fullscreen mode. ${FULLSCREEN_HINT}, then /clarvis movie ${m.n}.` }
    if (!(await openTheater($, MOVIES.indexOf(m)))) return { text: notShown('AVENGERS THEATER') }
    return { text: `AVENGERS THEATER: now showing #${m.n} ${stop(m.title)} P pauses, ←/→ skip beats, Q goes to the list.` }
}
async function cmd_demo($: any, _e: any, _v: string, _r: string): Promise<{ text: string }> {
    if (!fullMode) return { text: 'The demo needs full mode (it plays the band\'s art). Try /clarvis full, then /clarvis demo.' }
    if (working) return { text: 'A mission is running. Try /clarvis demo when it is done.' }
    demo = { at: now(), phase: 'boot' }
    nextFx = null; pending = undefined
    await setFx($, { moment: 'boot', at: now(), detail: '', caption: '' })
    await update($, bandNudge, n => n + 1)
    kick()
    return { text: `${DEMO_NOTE} It runs about 45 seconds.` }
}
async function cmd_stats($: any, _e: any, _v: string, rest: string): Promise<{ text: string }> {
    if (rest === 'reset') {
      await $.store.set('lifetime', emptyLifetime())
      await $.store.set('ledger', sanitizeLedger(undefined)) // the card's days and the shipped-work counts too (trophies are kept)
      return { text: 'Lifetime totals cleared: sessions, turns, tokens and cost start from zero. This session\'s numbers are untouched.' }
    }
    await refreshUsage($)
    const lifetime = await $.store.get('lifetime').catch(() => undefined)
    return { text: statsText({
      stats, now: now(), model: hudInfo?.model, startedAt: reading.startedAt, contextTokens: reading.ctxTokens, contextWindow: reading.ctxWindow, contextPercent: reading.ctxPercent,
      costUsd: reading.cost, limits: reading.limits, lifetime, showCost, extras: (await history($)) as { commits: number; green: number; prs: number },
    }) }
}

// ── trophies, the card, the team and the sound ──────────────────────────────
const heroNames = (): Record<string, string> => Object.fromEntries(ROSTER.map(id => [id, HERO[id].name]))
const idsLine = () => pickable(ROSTER).join(', ')
async function saveSel($: any) { await $.store.set('heroSel', sel); await $.store.set('heroHere', hereMap) }
async function reshuffle($: any) { shuffleRoster(today()); await update($, rosterAtom, () => [...order]) }
async function cmd_trophies($: any, _e: any, _v: string, _r: string): Promise<{ text: string }> {
    return { text: trophiesText(sanitizeTrophies(await $.store.get('trophies').catch(() => undefined))) }
}
async function cmd_card($: any, e: any, _v: string, rest: string): Promise<{ text: string }> {
    const a = parseCardArgs(rest)
    if (!a) return { text: `No card "${rest}". Use /clarvis card [today|week|all] [nocost].` }
    const [rawLg, rawLt, rawStreak] = await Promise.all(['ledger', 'lifetime', 'streak'].map(k => $.store.get(k).catch(() => undefined)))
    const lg = sanitizeLedger(rawLg), d = today()
    const text = missionCard({
      range: a.range, today: d, sum: sumDays(lg, d, a.range), life: sanitizeLifetime(rawLt), extras: lg.life, streak: streakNow(rawStreak, d),
      showCost: showCost && !a.nocost, quote: DONE[(Math.floor(now() / 86_400_000) + ['today', 'week', 'all'].indexOf(a.range)) % DONE.length]!, heroName: id => HERO[id as keyof typeof HERO]?.name ?? id,
    })
    let copied = false
    try { const r = await $.ui.copy({ text, ...(typeof e.surface === 'string' ? { surface: e.surface } : {}) }); copied = r?.isCopied === true } catch { /* no clipboard: the card is still the reply */ }
    return { text: text + (copied ? '\nCopied to clipboard' : '') }
}
async function cmd_pick($: any, _e: any, _v: string, rest: string): Promise<{ text: string }> {
    const here = /(?:^|\s)here$/.test(rest), q = rest.replace(/(?:^|\s)here$/, '').trim()
    if (!q) return { text: `Use /clarvis pick <name|auto> [here]. Now: ${hereMap[sessionCwd] ? `${HERO[hereMap[sessionCwd] as keyof typeof HERO]?.name} (this project)` : sel.pick ? HERO[sel.pick as keyof typeof HERO]?.name : 'auto'}. Heroes: ${idsLine()}.` }
    if (q === 'auto') {
      if (here) hereMap = pinHere(hereMap, sessionCwd, undefined); else sel = { team: sel.team }
      await saveSel($); await reshuffle($); await update($, bandNudge, n => n + 1)
      return { text: here ? 'This project is back on auto: the rotation, or your global pick.' : `Back on auto: the ${sel.team === 'all' ? 'whole team takes' : sel.team + ' team takes'} the stage in turn.` }
    }
    const m = findHero(q, ROSTER, heroNames())
    if (!m.id) return { text: `No hero "${q}". Try one of: ${(m.suggestions ?? []).join(', ')}.` }
    if (here) hereMap = pinHere(hereMap, sessionCwd, m.id); else sel = { ...sel, pick: m.id }
    await saveSel($); await reshuffle($); await update($, bandNudge, n => n + 1); kick()
    return { text: `${HERO[m.id as keyof typeof HERO].name} has the stage${here ? ' in this project' : ''}. /clarvis pick auto${here ? ' here' : ''} brings the rotation back.` }
}
async function cmd_team($: any, _e: any, _v: string, rest: string): Promise<{ text: string }> {
    if (!isTeam(rest)) return { text: `${rest ? `No team "${rest}". ` : ''}Use /clarvis team <${TEAM_IDS.join('|')}>. Now: ${sel.team}.` }
    sel = { ...sel, team: rest }
    await saveSel($); await reshuffle($); await update($, bandNudge, n => n + 1); kick()
    const who = rest === 'all' ? 'the whole roster' : TEAMS[rest].map(id => HERO[id as keyof typeof HERO].name).join(', ')
    return { text: `Team ${rest}: ${who}.${sel.pick || hereMap[sessionCwd] ? ' A pick still overrides the team (/clarvis pick auto).' : ''}` }
}
async function cmd_notify($: any, _e: any, _v: string, rest: string): Promise<{ text: string }> {
    const now0 = notifyMin > 0 ? `Clarvis pings you when a mission runs ${fmtMin(notifyMin)}+ minutes.` : 'Clarvis notifications are off.'
    if (!rest) return { text: `${now0} Use /clarvis notify <minutes|off>.` }
    const want = parseNotify(rest)
    if (want === undefined) return { text: `Use /clarvis notify <minutes|off>, for example /clarvis notify 5. ${now0}` }
    notifyMin = want; await $.store.set('notify', want)
    return { text: want > 0 ? `Clarvis will ping you when a mission runs ${fmtMin(want)}+ minutes.` : 'Clarvis will not send notifications. /clarvis notify <minutes> turns them back on.' }
}
async function cmd_sound($: any, _e: any, _v: string, rest: string): Promise<{ text: string }> {
    const where = fullMode ? '' : ` You are in ${calmMode ? 'calm' : liteMode ? 'lite' : 'off'} mode, which stays silent (/clarvis full).`
    if (rest !== 'on' && rest !== 'off') return { text: `Sound is ${soundOn ? 'on' : 'off'}. Use /clarvis sound ${soundOn ? 'off to mute' : 'on to turn it on'} (or /clarvis sound ${soundOn ? 'on' : 'off'} to set it). ${SOUND_NOTE}${where}` }
    soundOn = rest === 'on'; await $.store.set('sound', rest)
    if (soundOn) playSound($, 'coin')
    return { text: `Sound ${rest}. ${soundOn ? 'Original chiptune clips, a quiet volume. ' : ''}${SOUND_NOTE}${soundOn ? where : ''}` }
}

COMMANDS.push(
  { id: 'look', group: 'Look', names: ['full', 'calm', 'lite', 'off'], tag: 'full · calm · lite · off', usage: 'full|calm|lite|off', summary: 'art, no motion, text only, or stock' },
  { id: 'fx', group: 'Look', names: ['fx'], tag: '', usage: 'fx on|off', summary: 'tint the transcript with theater bursts (off)' },
  { id: 'play', group: 'Play', names: ['play'], tag: 'play', usage: 'play', summary: 'STARK ARCADE, five games' },
  { id: 'movies', group: 'Play', names: ['movies', 'theater'], tag: 'movies', usage: 'movies', summary: 'AVENGERS THEATER, ten comic movies' },
  { id: 'movie', group: 'Play', names: ['movie'], tag: '', usage: 'movie <1-9|0|name|next>', summary: 'open one movie straight away' },
  { id: 'demo', group: 'Play', names: ['demo'], tag: 'demo', usage: 'demo', summary: '45-second showreel (sample numbers)' },
  { id: 'stats', group: 'Stats', names: ['stats'], tag: 'stats', usage: 'stats [reset]', summary: 'C.L.A.R.V.I.S. mission report: tokens, limits' },
  { id: 'card', group: 'Stats', names: ['card'], tag: 'card', usage: 'card [today|week|all]', summary: 'a shareable mission card (nocost hides $)' },
  { id: 'trophies', group: 'Stats', names: ['trophies', 'trophy'], tag: 'trophies', usage: 'trophies', summary: 'your trophy case' },
  { id: 'pick', group: 'Hero', names: ['pick'], tag: 'pick', usage: 'pick <name|auto> [here]', summary: 'one hero on stage (here: pin to project)' },
  { id: 'team', group: 'Hero', names: ['team'], tag: '', usage: 'team <name>', summary: 'avengers · guardians · wakanda · cosmic · all' },
  { id: 'sound', group: 'Look', names: ['sound'], tag: '', usage: 'sound on|off', summary: 'chiptune sounds (on; macOS)' },
  { id: 'notify', group: 'Look', names: ['notify'], tag: '', usage: 'notify <minutes|off>', summary: 'ping me when a long mission ends' },
)

// To add a /clarvis command: a row in the table above, a function like these, and its case here.
async function runCmd($: any, e: any, cmd: HeroCmd, verb: string, rest: string): Promise<{ text: string }> {
  switch (cmd.id) {
    case 'look': return cmd_look($, e, verb, rest)
    case 'fx': return cmd_fx($, e, verb, rest)
    case 'play': return cmd_play($, e, verb, rest)
    case 'movies': return cmd_movies($, e, verb, rest)
    case 'movie': return cmd_movie($, e, verb, rest)
    case 'demo': return cmd_demo($, e, verb, rest)
    case 'stats': return cmd_stats($, e, verb, rest)
    case 'card': return cmd_card($, e, verb, rest)
    case 'trophies': return cmd_trophies($, e, verb, rest)
    case 'pick': return cmd_pick($, e, verb, rest)
    case 'team': return cmd_team($, e, verb, rest)
    case 'sound': return cmd_sound($, e, verb, rest)
    case 'notify': return cmd_notify($, e, verb, rest)
    default: return { text: `No /clarvis command "${verb}". Type /clarvis for the list.` }
  }
}

/** The mode a session starts in: CLARVIS, the stored choice, the `mode` option, a 256-colour terminal (lite), then full. */
async function startMode($: any): Promise<{ mode: AvengersMode; auto: boolean }> {
  const env = await $.env.get('CLARVIS')
  const fromEnv = typeof env === 'string' ? env.trim().toLowerCase() : ''
  if (isMode(fromEnv)) return { mode: fromEnv, auto: false }
  const saved = await $.store.get('mode')
  if (isMode(saved)) return { mode: saved, auto: false }
  if (cfgMode) return { mode: cfgMode, auto: false }
  const safe = async (f: () => unknown) => { try { return await f() } catch { return undefined } }
  const t = {
    colorterm: await safe(() => $.env.get('COLORTERM')), termProgram: await safe(() => $.env.get('TERM_PROGRAM')),
    tmux: await safe(() => $.env.get('TMUX')), tmuxTruecolor: await safe(() => $.env.get('CLAUDE_CODE_TMUX_TRUECOLOR')),
  }
  if (needsLite(t)) return { mode: 'lite', auto: true }
  return { mode: 'full', auto: false }
}

// The output text of a finished Bash call (stdout and stderr, however the result carries them), read and never kept.
function outputOf(r: any): string {
  const part = (v: unknown) => (typeof v === 'string' ? v : '')
  const res = r?.result
  const text = typeof res === 'string' ? res : res && typeof res === 'object' ? `${part(res.stdout)}\n${part(res.stderr)}`.trim() : ''
  return text || part(r?.text)
}
async function observe($: any, e: any, tool: string, r: any) {
  if (demo || isOff()) return
  if (/^(Edit|MultiEdit|Write|NotebookEdit)$/.test(tool) && !r.isError) {
    const x = extOf((e as { file_path?: unknown; notebook_path?: unknown }).file_path ?? (e as { notebook_path?: unknown }).notebook_path)
    if (x && !exts.has(x) && exts.size < 50) { exts.add(x); if (exts.size === 5) await check($, { session: { extensions: exts.size } }) }
    return
  }
  if (tool !== 'Bash') return
  const sh = shipOf((e as { command?: unknown }).command, outputOf(r), !!r.isError)
  if (!sh) return
  turnShip = mergeShip(turnShip, sh)
  const lg = await bumpLedger($, { commits: sh.commit ? 1 : 0, green: sh.tests ? 1 : 0, prs: sh.pr ? 1 : 0 })
  if (lg) await check($, { commits: lg.life.commits, green: lg.life.green, prs: lg.life.prs })
}

export const register: Register = (on, options) => {
  const opt = (options ?? {}) as Record<string, unknown>
  showCost = opt.showCost !== false
  notifyCfg = typeof opt.notifyAfterMinutes === 'number' && Number.isFinite(opt.notifyAfterMinutes) && opt.notifyAfterMinutes > 0 ? opt.notifyAfterMinutes : 0
  notifyMin = notifyCfg
  cfgMode = isMode(opt.mode) ? opt.mode : undefined
  cfgSound = opt.sound !== false
  on('session.start', async ($, e, next) => {
    await sync($)
    startedWall = now()
    nudged = false; turnShip = undefined; turnHeroes = {}; exts.clear(); for (const k of Object.keys(counts)) delete counts[k] // a new session: its own tallies
    sessionCwd = e.cwd
    { const v = String(await $.env.get('CLARVIS_EGG') ?? '').trim().toLowerCase(); eggs = v === 'always' || v === 'never' ? v : 'chance' }
    fxOn = (await $.store.get('fx')) === 'on' // the transcript echo is opt-in
    const start = await startMode($)
    const m = await update($, mode, () => start.mode)
    fullMode = m === 'full'; calmMode = m === 'calm'; liteMode = m === 'lite'
    demo = null
    try { // who takes the stage, the sound choice, the day streak: stored, and made safe on the way in
      sel = sanitizeSel(await $.store.get('heroSel'), ROSTER); hereMap = sanitizeHere(await $.store.get('heroHere'), ROSTER)
      soundOn = soundChoice(await $.store.get('sound'), cfgSound)
      notifyMin = notifyChoice(await $.store.get('notify'), notifyCfg)
      streakDays = streakNow(await $.store.get('streak'), today())
    } catch { sel = { team: 'all' }; hereMap = {}; soundOn = cfgSound; notifyMin = notifyCfg }
    await reshuffle($) // a new session, a new order
    echo = undefined; echoLast = -1e12; await update($, tfx, () => null) // a reload may have left a tint in the atom with no echo to clear it
    // A reload mid-turn keeps the state but not these flags: pick them back up.
    turnNow = await read($, turn)
    working = !!turnNow?.active
    currentFx = await read($, fx)
    const model = shortModel(await $.session.model())
    const name = folderName(e.cwd, (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')))
    hudInfo = await update($, hud, () => ({ name, model }))
    usageNow = await read($, usage)
    Object.assign(stats, newStats()); stats.model = model; reading = { limits: [] } // a new session: the totals start over
    await Promise.resolve($.command.register({ name: 'clarvis', description: `Clarvis: ${heroTags().join(' · ')}`, argumentHint: `[${heroTags().join('|').replace(/ · /g, '|')}]` })).catch(() => {})
    await refreshUsage($)
    let reloaded = false // the same session's module loaded again (a plugin update, or a hot reload while developing)
    try { // one more session in the lifetime totals (a reload of the same session is not another)
      const sid = String(reading.startedAt ?? '')
      if (sid && (await $.store.get('lifetimeSession')) === sid) reloaded = true
      else if (sid) { await $.store.set('lifetimeSession', sid); await bumpLifetime($, { sessions: 1 }) }
      else if (!sid) await bumpLifetime($, { sessions: 1 })
    } catch { /* decoration */ }
    if (m !== 'off') {
      try { // one more day on the streak: a toast at 3, 7 and 30 days
        const was = sanitizeStreak(await $.store.get('streak')), s2 = bumpStreak(was, today())
        if (s2.last !== was.last) await $.store.set('streak', s2)
        streakDays = streakNow(s2, today())
        if (s2.n !== was.n && STREAK_TOASTS.includes(s2.n)) await $.ui.toast(`★ ${s2.n}-day streak. The team is proud of you.`)
        await check($, { ...(await history($)) })
      } catch { /* decoration */ }
    }
    // first run: say once what this is and how to leave it; a terminal that shows 256 colours: say once why it is lite
    let firstRun = false
    if (m !== 'off') {
      try {
        if ((await $.store.get('firstRun')) !== true) { firstRun = true; await $.store.set('firstRun', true); await $.ui.toast(WELCOME_TOAST) }
        if (start.auto && (await $.store.get('liteHint')) !== true) { await $.store.set('liteHint', true); await $.ui.toast(LITE_HINT) }
      } catch { /* decoration */ }
    }
    const loop = (id: number) => {
      timerAt = Date.now()
      timer = $.clock.after(wantMs() || CALM_MS, () => {
        if (id !== chain) return // a dropped chain's late step: let it die
        void tick($).catch(() => {}).then(() => { if (id !== chain) return; timer = undefined; if (wantMs()) loop(id) })
      })
    }
    // a step that never came back (a stalled dispatch) is dropped and a new chain laid
    kick = () => { if (timer && Date.now() - timerAt > 3000) { timer = undefined; chain++ } if (!timer && wantMs()) loop(chain) }
    // the suit boots once a session: a reload of the module replays neither the boot moment nor its hum
    if (fullMode && !working && !currentFx && !reloaded) { await moment($, 'boot', '', firstRun ? WELCOME_CAPTION : ''); playSound($, 'boot') }
    kick()
    return next(e)
  }).catch(($, e, next) => next(e)) // decoration never stands in a session's way

  on('command.run', { command: 'clarvis' }, async ($, e) => {
    await sync($)
    const want = e.args.trim().toLowerCase()
    if (!want) return { text: briefing({ mode: await read($, mode), cmds: COMMANDS.map(c => c.id === 'sound' ? { ...c, summary: `chiptune sounds (${soundOn ? 'on' : 'off'}; macOS)` } : c), fullscreen: e.presentation?.isFullscreen }) }
    const sp = want.search(/\s/)
    const verb = sp < 0 ? want : want.slice(0, sp), rest = sp < 0 ? '' : want.slice(sp + 1).trim()
    const cmd = findCmd(verb)
    if (!cmd) return { text: `No /clarvis command "${e.args.trim().split(/\s+/)[0]}". Type /clarvis for the list.` }
    return runCmd($, e, cmd, verb, rest)
  })

  on('turn.start', async ($, e, next) => {
    const r = await next(e) // observe only: the turn goes on first, the bookkeeping follows
    if (isOff()) return r
    try {
      await sync($)
      working = true
      const text = (e as unknown as { text?: unknown }).text
      const prompt = (typeof text === 'string' ? text : '').split('\n').find(l => l.trim())?.trim() ?? ''
      turnNow = await update($, turn, () => ({ startedAt: now(), tools: 0, active: true, prompt }))
      try { // /model may have changed the model since the session began
        const model = shortModel(await $.session.model())
        stats.model = model
        if (hudInfo && model !== hudInfo.model) hudInfo = await update($, hud, h => (h ? { ...h, model } : h))
      } catch { /* decoration */ }
      await refreshUsage($)
      costAtStart = usageNow.cost
      bump++
      act = 'thinking'; actAt = now(); curTool = ''; curDetail = ''; log = []; lastToolFailed = false; closing = false; nextFx = null // a fresh turn: JARVIS opens, the roster starts over
      say(lineFor('thinking', bump)); shownAt = now(); pending = undefined
      demo = null // the showreel ends at the first real prompt
      await setFx($, null) // a new prompt: whatever held the band gives way
      kick()
    } catch { /* decoration never stands in the way */ }
    return r
  }).catch(($, e, next) => next(e)) // decoration never stands in the way

  on('tool.call', async ($, e, next) => {
    if (isOff()) return next(e) // the stock look: nothing to keep
    const agentId = (e as unknown as { agentId?: string }).agentId
    await sync($)
    if (agentId) { agents.set(agentId, now()); agentRunning.set(agentId, (agentRunning.get(agentId) ?? 0) + 1) } // heard from: still at work
    const detail = detailOf(e as unknown as Record<string, unknown>)
    const tool = String(e.tool)
    turnNow = await update($, turn, t => (t ? { ...t, tools: t.tools + 1, tool, detail } : t))
    const who = heroFor(tool, detail)
    bump++
    curDetail = detail; toolAt = now()
    show(who, lineFor(who, bump, detail || tool), tool)
    counts[who] = (counts[who] ?? 0) + 1; counts.all = (counts.all ?? 0) + 1
    turnHeroes[who] = (turnHeroes[who] ?? 0) + 1
    if (counts.hulk === 25) void award($, 'hulk').catch(() => {})
    if (counts.hawkeye === 15) void award($, 'hawkeye').catch(() => {})
    if (counts.all === 100) void award($, 'century').catch(() => {})
    // The tool is running, so any ask on it was answered: Fury stands down.
    await standDownFury($)
    kick()
    running.push(tool)
    let r: Awaited<ReturnType<typeof next>>
    try { r = await next(e) } finally {
      const i = running.lastIndexOf(tool); if (i >= 0) running.splice(i, 1)
      if (agentId) { const n = (agentRunning.get(agentId) ?? 1) - 1; if (n > 0) agentRunning.set(agentId, n); else agentRunning.delete(agentId) }
    }
    await sync($)
    if (agentId && agents.has(agentId)) agents.set(agentId, now())
    // The log gains a line.
    addTool(stats, tool, !!r.isError)
    log = [{ ok: !r.isError, tool, detail: detail || tool, ms: now() - toolAt }, ...log].slice(0, 3)
    if (!agentId) lastToolFailed = !!r.isError
    void refreshUsage($)
    if (r.isError) {
      counts.errors = (counts.errors ?? 0) + 1
    }
    // What the call shipped (a commit, a green test run, a pull request) and which kind of file an edit touched:
    // read from the finished call, small facts only; the result is returned exactly as it came.
    try { await observe($, e, tool, r) } catch { /* decoration */ }
    return r
  }).catch(($, e, next) => next(e)) // never in the way of a tool: replay or run it

  // Observe the permission verdict only; the answer always comes from the engine.
  on('tool.check', async ($, e, next) => {
    const v = await next(e)
    await sync($)
    // The permission dialog takes the band's place while it shows, so Fury
    // can't stand there; a line beneath the dialog says it instead.
    if (v.decision === 'ask' && (await read($, mode)) !== 'off' && e.tool_use_id) void Promise.resolve($.ui.notice(e.tool_use_id, '◐ Nick Fury: the team is holding for your call.')).catch(() => {})
    return v
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (isOff()) return result
    if (e.agentId) { agents.delete(e.agentId); agentRunning.delete(e.agentId); addTurn(stats, result?.usage, { agent: true }); kick(); await update($, bandNudge, n => n + 1); return result }
    await sync($)
    working = false; closing = true
    running.length = 0 // a tool that never came back (cancelled) can't hold the header past its turn
    turnNow = await update($, turn, x => (x ? { ...x, active: false } : x))
    const tools = turnNow?.tools ?? 0
    // the closing line is drawn from the engine's duration alone, so keep how this turn ended under it
    const ended = e.reason === 'error' || e.reason === 'refusal' ? 'failed' : e.reason === 'aborted' || (e as { isAborted?: boolean }).isAborted ? 'aborted' : 'done'
    outcomes.set(e.durationMs, { outcome: ended, tools }); if (outcomes.size > 50) outcomes.delete(outcomes.keys().next().value!)
    await setFx($, null)
    const tt = addTurn(stats, result?.usage, { ms: e.durationMs }) // the turn's real tokens (observed, never changed)
    await refreshUsage($)
    const spent = Math.max(0, usageNow.cost - costAtStart)
    if (stats.last) stats.last.cost = num(spent)
    const lifeRes = await bumpLifetime($, { turns: 1, toolCalls: tools, inputTokens: inputTotal(tt), outputTokens: tt.output, cost: spent, longestMs: e.durationMs, turnTools: tools })
    await bumpLedger($, { turns: 1, actions: tools, inTok: inputTotal(tt), outTok: tt.output, cacheTok: tt.cacheRead, cost: spent, heroes: turnHeroes })
    const ship = turnShip
    turnShip = undefined; turnHeroes = {}
    const toks = tt.output > 0 || inputTotal(tt) > 0 ? ` · ↑${fmtTokens(inputTotal(tt))} ↓${fmtTokens(tt.output)}` : ''
    const money = showCost && spent > 0 ? ` · $${spent.toFixed(2)}` : ''
    // Thanos snaps when the turn errored, or when Claude's last tool call failed and it never recovered
    const snapped = e.reason === 'error' || (e.reason === 'answer' && lastToolFailed)
    if (snapped) {
      counts.failedTurns = (counts.failedTurns ?? 0) + 1
      await moment($, 'snap', 'The turn hit an error.', log[0] && !log[0].ok ? `last: ${log[0].tool} failed` : '')
      playSound($, 'whomp')
    } else if (e.reason === 'answer' && (e.durationMs >= 5000 || tools > 0) && /\?\s*$/.test(String((e as unknown as { answer?: unknown }).answer ?? ''))) {
      // the turn ended on a question for you: Nick Fury holds the band until you reply
      const q = String((e as unknown as { answer?: unknown }).answer).trim().split('\n').filter(l => l.trim()).pop() ?? ''
      await moment($, 'fury', clip(q.replace(/[*_`#>]/g, '').trim(), 160), endCaption('fury', { n: bump, pool: DONE }))
    } else if (e.reason === 'answer' && (e.durationMs >= 5000 || tools > 0)) {
      const big = tools >= 25 || e.durationMs >= 5 * 60_000
      // the end of a task: the Avengers assemble (Thanos snaps only for a turn that failed)
      // the season (full mode only) and a rare egg colour the caption; what was shipped outranks them (see endCaption)
      const d = today(), season = fullMode && isRealDate(d) ? seasonOf(d) : null
      const egg = fullMode && isRealDate(d) ? rollEgg(eggs === 'always' ? () => 0 : eggs === 'never' ? () => 0.99 : dice.rng, { sessionMs: Math.max(0, now() - startedWall) }) : undefined
      const flair: Flair | undefined = egg ?? flairOf(season)
      const caption = endCaption('done', { n: bump, big, pool: DONE, ship: shipCaption(ship), ...(egg ? { egg: EGG_CAPTIONS[egg] } : {}), ...(seasonCaption(season) ? { season: seasonCaption(season)! } : {}) })
      await moment($, 'assemble', `✓ mission complete · ${fmtDur(e.durationMs)} · ${plural(tools, 'action')}${money}${toks}`, caption, flair)
      playSound($, ship ? 'levelup' : 'assemble')
      if (big) await award($, 'ironman')
      if ((counts.failedTurns ?? 0) > 0) await award($, 'snap')
    }
    // the history's trophies and the lifetime milestones (observed after the moment has been set: nothing here slows the turn's end)
    try {
      const d = today(), real = isRealDate(d)
      if (real && e.reason === 'answer') {
        const h = d.getHours()
        let nights = 0
        if (h >= 1 && h < 5) { // a mission past 1am: remember the night (the last 30)
          const list: unknown = await $.store.get('nights').catch(() => undefined)
          const k = dayKey(d), have = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
          if (!have.includes(k)) { have.push(k); await $.store.set('nights', have.slice(-30)) }
          nights = have.length
        }
        await check($, { hour: h, nights })
      }
      await check($, {
        durationMs: e.reason === 'answer' ? e.durationMs : 0, ...(await history($)),
        session: { input: inputTotal(stats), ...(cacheHit(stats) !== undefined ? { cacheHit: cacheHit(stats)! } : {}), extensions: exts.size },
      })
      if (lifeRes) for (const m of crossed(lifetimeTokens(lifeRes.before), lifetimeTokens(lifeRes.after))) {
        const done: unknown = await $.store.get('milestones').catch(() => undefined)
        const seen = Array.isArray(done) ? done.filter((x): x is number => typeof x === 'number') : []
        if (!seen.includes(m)) { await $.store.set('milestones', [...seen, m]); await $.ui.toast(milestoneText(m)) }
      }
      if (!nudged) { const n = contextNudge(usageNow.percent); if (n) { nudged = true; await $.ui.toast(n) } } // once a session, and sincere
    } catch { /* decoration */ }
    // a long mission: tell the person who has looked away (the notifyAfterMinutes option)
    if (notifyMin > 0 && e.reason === 'answer' && e.durationMs >= notifyMin * 60_000) {
      try { await $.ui.notify(notifyBody(e.durationMs, plural(tools, 'action'), ship), { title: 'Clarvis' }) } catch { /* decoration */ }
    }
    closing = false
    if (coinDue > 0) coinDue = Math.max(coinDue, now() + COIN_DEFER_MS) // trophies of this turn: after the end-of-turn clip
    kick()
    return result
  }).catch(($, e, next) => next(e)) // decoration never stands in the way

  // The engine measured the session (context, a rate-limit window or the cost moved): observe it
  // and keep the band's numbers fresh. The result is the engine's, passed on untouched.
  on('session.measure', async ($, e, next) => {
    const r = await next(e)
    if (isOff()) return r
    try { await applyUsage($, { ...e, startedAt: reading.startedAt }) } catch { /* decoration */ }
    return r
  }).catch(($, e, next) => next(e))

  // Compaction: Ant-Man shrinks the context, then grows back to size.
  on('session.compact', async ($, e, next) => {
    await sync($)
    compacting = true; curDetail = 'shrinking the context with Pym particles'
    shownAt = 0; show('antman', lineFor('antman', bump++), 'compact')
    kick()
    try { return await next(e) } finally {
      await sync($)
      compacting = false; curTool = ''; curDetail = ''
      say(lineFor('antman', 0))
      kick()
      await refreshUsage($) // the context shrank: the gauge must say so
    }
  }).catch(($, e, next) => next(e)) // decoration never stands in the way

  // /clear ends the conversation and starts another under the same process, with no session.start:
  // the context figures are stale until read again.
  on('session.end', async ($, e, next) => {
    const r = await next(e)
    if (e.reason === 'clear') { await sync($); await refreshUsage($) }
    return r
  }).catch(($, e, next) => next(e))

  // ── the spinner: folded into the band while it shows ─────────────────────
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    await sync($)
    const m = await read($, mode)
    if (m === 'off' || e.surface !== 'terminal') return next(e)
    // thinking and responding take the stage back from the last tool
    const sm = e.props.mode
    if (sm !== spinMode) {
      spinMode = sm
      if (sm === 'thinking' || sm === 'responding') { curDetail = ''; bump++; show(sm, lineFor(sm, bump)) }
    }
    const { Box } = $.ui.resolve(e)
    if (bandKey || m === 'lite') return <Box /> // the lite band's second row names the hero and the tool
    const t = await read($, turn)
    return line1($, e, spinnerRow({
      mode: sm, hero: t?.tool ? HERO[heroFor(t.tool, t.detail ?? '')].name : undefined, tool: t?.tool, detail: t?.detail, tools: t?.tools ?? 0,
      elapsed: t ? fmtDur(now() - t.startedAt) : '', width: Math.max(20, (e.viewport?.columns ?? 100) - 2),
    }))
  })

  // ── the band: one Raster ────────────────────────────────────────────────
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await sync($)
    const m = await read($, mode)
    const info = await read($, hud)
    await read($, bandNudge) // subscribes: the clock asks for a redraw (another size, an agent coming or going) through it
    if (m === 'off' || !info || e.props.hasSurvey || e.surface !== 'terminal' || e.props.maxRows < 3) { bandKey = ''; return next(e) }
    hudInfo = info
    if (m === 'lite') { // text rows: no Raster, no clock; a write to the turn or usage atoms redraws them
      bandKey = ''
      usageNow = await read($, usage); turnNow = await read($, turn)
      const { Box, Text } = $.ui.resolve(e)
      const isWork = !!turnNow?.active || e.props.isWorking
      const hero = turnNow?.tool ? HERO[heroFor(turnNow.tool, turnNow.detail ?? '')].name : 'JARVIS'
      const rows = liteRows({
        name: info.name, model: info.model, percent: usageNow.percent, tokens: usageNow.tokens, cost: usageNow.cost, showCost, pieces: piecesOf(), cols: Math.min(512, Math.max(NARROW_MIN, e.props.bodyColumns)),
        work: isWork ? { hero, tool: turnNow?.tool ?? '', detail: turnNow?.detail ?? '' } : null, agents: isWork ? 0 : agents.size,
      })
      return (
        <Box key="avengers-band" flexDirection="column">
          {rows.map((row, i) => (
            <Box key={`lite${i}`} flexDirection="row">
              {row.map(sg => <Text color={sg.color} bold={!!sg.bold} wrap="truncate">{sg.text}</Text>)}
            </Box>
          ))}
        </Box>
      )
    }
    showPending() // the clock parks without a band: a hero waiting its turn takes the stage now
    usageNow = await read($, usage) // subscribes: the idle line shows fresh numbers
    turnNow = await read($, turn)
    let x = await read($, fx)
    if (x && x.moment !== 'fury' && now() - x.at > MOMENT_SECONDS[x.moment as Moment] * 1000) x = null // over: never draw a stale moment
    currentFx = x
    bandReq = e.requestId
    bandCols = Math.min(512, Math.max(NARROW_MIN, e.props.bodyColumns)) // beside a docked pane the column can be ~20: draw at its true width, never wider (wider is clipped to nothing)
    bandMaxRows = e.props.maxRows
    const f = frame(viewOf(x, busy(e.props.isWorking)))
    bandKey = `${f.rows}x${bandCols}`
    lastCells = f.cells
    kick() // the band is mounted: the clock may run (it parks while no band is there)
    const { Raster, Box, Button } = $.ui.resolve(e)
    // the play button, over the band's top row: a click (or the band's hotkey) opens the arcade
    const v = viewOf(x, busy(e.props.isWorking))
    const fullscreen = e.viewport?.isFullscreen
    const right = v.kind === 'work' ? 13 : v.kind === 'idle' ? 1 : -1 // the arcade button; the movies button sits left of it
    return (
      <Box key="avengers-band">
        <Raster key={bandKey} columns={bandCols} rows={f.rows} cells={f.cells} />
        {right >= 0 && bandCols >= 90
          ? <Box position="absolute" top={0} right={right}><Button key="play" plain label="▶ STARK ARCADE" onPress={() => { void playButton($, fullscreen, () => openArcade($)) }} /></Box>
          : null}
        {right >= 0 && bandCols >= (v.kind === 'work' ? 100 : 90)
          ? <Box position="absolute" top={0} right={right + 16}><Button key="movies" plain label="▶ MOVIES" onPress={() => { void playButton($, fullscreen, () => openTheater($)) }} /></Box>
          : null}
      </Box>
    )
  })

  // ── STARK ARCADE: a pane the person opens with /clarvis play ────────────
  on('ui.render', { component: 'Pane', requestId: 'avengers-arcade' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    const { Box, Client, Text, Button } = $.ui.resolve(e as typeof e & { surface: 'terminal' })
    if (notFullscreen(e.viewport?.isFullscreen)) return needsFullscreen($, e, 'STARK ARCADE', 'avengers-arcade')
    const best = Number(await $.store.get('arcadeBest')) || 0
    const inline = e.props.placement === 'inline'
    // exactly the room the pane has, less the top row: the game fills it and never scrolls
    const rows = Math.max(8, (e.props.scroll?.bodyRows || 32) - 1)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexGrow={1}>
            {inline
              ? <Text color="#FFB020" wrap="truncate">Small view: this pane is under 110 columns. Widen it for the big docked arcade · click the game to play · q quits</Text>
              : <Text color="#8C90B4" wrap="truncate">Click the game to play · 1–5 pick · q quits · Esc gives the keys back to the prompt</Text>}
          </Box>
          <Button key="close" plain label="✕ Close" onPress={() => { void $.ui.close({ id: 'avengers-arcade' }) }} />
        </Box>
        <Client key="arcade" module="./arcade.tsx" props={{ best, focused: e.props.isFocused }} width={Math.max(40, e.props.bodyColumns)} height={rows} />
      </Box>
    )
  })
  // ── AVENGERS THEATER: the comic movies, in a pane ──────────────────────────
  on('ui.render', { component: 'Pane', requestId: 'avengers-theater' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return next(e)
    const { Box, Client, Text, Button } = $.ui.resolve(e as typeof e & { surface: 'terminal' })
    if (notFullscreen(e.viewport?.isFullscreen)) return needsFullscreen($, e, 'AVENGERS THEATER', 'avengers-theater')
    await read($, paneNudge) // subscribes: a new movie or setting redraws this pane alone
    const seen = await seenMovies($)
    const inline = e.props.placement === 'inline'
    const rows = Math.max(10, (e.props.scroll?.bodyRows || 32) - 1)
    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexGrow={1}>
            {inline
              ? <Text color="#FFB020" wrap="truncate">Small view: widen the pane for bigger panels · click the theater, then 1–0 · q closes</Text>
              : <Text color="#8C90B4" wrap="truncate">Click a movie or press 1–0 / ↑↓ + SPACE · ←/→ beats · P pause · Q list · Esc gives the keys back</Text>}
          </Box>
          <Button key="close" plain label="✕ Close" onPress={() => { void $.ui.close({ id: 'avengers-theater' }) }} />
        </Box>
        <Client key="theater" module="./theater.tsx" props={{ seen, fx: fullMode, ...(theaterStart !== undefined ? { start: theaterStart, nonce: theaterNonce } : {}) }} width={Math.max(40, e.props.bodyColumns)} height={rows} />
      </Box>
    )
  })
  on('ui.render', { component: 'AssistantMessage' }, echoRow).catch(passRow)
  on('ui.render', { component: 'UserMessage' }, echoRow).catch(passRow)
  on('ui.render', { component: 'ToolUse' }, echoRow).catch(passRow)
  on('ui.render', { component: 'ToolResult' }, echoRow).catch(passRow)
  on('ui.render', { component: 'ToolGroup' }, echoRow).catch(passRow)
  on('ui.message', async ($, e, next) => {
    if (e.element === 'theater') {
      const d = e.data as { watched?: unknown; close?: unknown; fx?: unknown } | null
      if (d?.close === true) { await $.ui.close({ id: 'avengers-theater' }); return {} }
      if (typeof d?.watched === 'string' && MOVIES.some(m => m.id === d.watched)) {
        const seen = await seenMovies($)
        const all = seen.includes(d.watched) ? seen : [...seen, d.watched]
        await $.store.set('moviesSeen', all)
        await sync($)
        await check($, { moviesSeen: all.length, moviesTotal: MOVIES.length })
        return { props: { seen: all, fx: fullMode } }
      }
      if (typeof d?.fx === 'string') { await sync($); burstAt = now() } // sound keeps quiet while the theater bursts
      if (typeof d?.fx === 'string' && fxOn && fullMode) {
        await sync($)
        if (now() - echoLast >= ECHO_GAP_MS) { echoLast = now(); echo = { kind: d.fx, at: now(), step: 0 }; await update($, tfx, () => ({ kind: d.fx as string, step: 0 })); kick() }
      }
      return {}
    }
    if (e.element !== 'arcade') return next(e)
    const d = e.data as { score?: unknown; close?: unknown } | null
    if (d?.close === true) { await $.ui.close({ id: 'avengers-arcade' }); return {} }
    if (typeof d?.score === 'number' && Number.isFinite(d.score)) {
      const best = Math.min(1e9, Math.max(Number(await $.store.get('arcadeBest')) || 0, Math.floor(d.score)))
      await $.store.set('arcadeBest', best)
      await sync($)
      await check($, { arcadeBest: best })
      return { props: { best } }
    }
    return {}
  })

  // ── the turn's closing line ─────────────────────────────────────────────
  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    if ((await read($, mode)) === 'off') return next(e)
    const o = outcomes.get(e.props.durationMs)
    return line1($, e, footerRow(e.props.durationMs, o?.tools ?? 0, o?.outcome ?? 'done'))
  })
}
