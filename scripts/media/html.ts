// HTML pages the media pipeline screenshots: captions, social preview, terminal-styled command output.
// Pure string builders; scripts/record.ts renders them with headless Chrome.
import { statsText, newStats, type ReportInput } from '../../hooks/metrics'
import { missionCard } from '../../hooks/card'
import { trophiesText, TROPHIES } from '../../hooks/trophies'
import { HERO } from '../../hooks/scenes'
import { emptyBucket } from '../../hooks/daily'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fence = (s: string) => s.replace(/^```\n/, '').replace(/\n```$/, '')

// ── captions: a transparent PNG per segment, laid over the video ────────────────
export function captionPage(w: number, h: number, text: string, o: { top: number; size: number; corner: string; cornerSize: number; maxw: number }): string {
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:${w}px;height:${h}px;background:transparent;overflow:hidden}
.cap{position:absolute;left:50%;top:${o.top}px;transform:translateX(-50%);width:${o.maxw}px;text-align:center;font:700 ${o.size}px/1.22 "Arial","Helvetica",sans-serif;color:#fff;
  text-shadow:0 3px 0 #000,0 0 18px rgba(0,0,0,.9),3px 3px 0 #000,-3px 3px 0 #000}
.cap b{color:#ffcf3f;font-weight:700}
.corner{position:absolute;left:0;right:0;bottom:${Math.round(o.cornerSize * 0.9)}px;text-align:center;font:400 ${o.cornerSize}px/1.2 "Arial",sans-serif;color:#b9b6e0;opacity:.9}
</style><div class="cap">${text}</div><div class="corner">${esc(o.corner)}</div>`
}

// ── social preview ──────────────────────────────────────────────────────────────
export function socialPage(imgUrl: string): string {
  return `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;width:1280px;height:640px;overflow:hidden;background:#1d1a45}
body{background:radial-gradient(900px 420px at 50% 0%,#2e2a72 0%,#1d1a45 60%,#14122f 100%);position:relative;font-family:"Arial",sans-serif}
.dots{position:absolute;inset:0;background-image:radial-gradient(#ffffff14 1.5px,transparent 1.6px);background-size:22px 22px}
h1{position:absolute;left:0;right:0;top:44px;margin:0;text-align:center;font:400 128px/1 "Bangers","Impact","Arial Black",sans-serif;letter-spacing:.07em;color:#ffcf3f;
  text-shadow:6px 6px 0 #e2403a,8px 8px 0 #14122f}
.sub{position:absolute;left:0;right:0;top:190px;text-align:center;font:700 34px/1.2 "Arial",sans-serif;color:#fff;letter-spacing:.01em}
.frame{position:absolute;left:50%;top:262px;transform:translateX(-50%);padding:10px;background:#0E0E16;border:3px solid #ffcf3f;border-radius:6px;box-shadow:8px 8px 0 #e2403a}
.frame img{display:block;width:1010px;image-rendering:pixelated}
.fine{position:absolute;left:0;right:0;top:576px;text-align:center;font:400 20px/1 "Arial",sans-serif;color:#b9b6e0}
</style><div class="dots"></div><h1>CLARVIS</h1><div class="sub">Heroes above your Claude Code prompt</div>
<div class="frame"><img src="${imgUrl}"></div><div class="fine">Unofficial fan project · not affiliated with Marvel or Disney</div>`
}

// ── terminal-styled command output ──────────────────────────────────────────────
const NOW = Date.UTC(2026, 9, 8, 15, 0, 0)
export function sampleStats(): string {
  const s = newStats()
  Object.assign(s, { turns: 38, agentTurns: 6, toolCalls: 142, errors: 3, longestMs: 6 * 60_000 + 12_000, input: 40_000, output: 52_000, cacheRead: 1_000_000, cacheWrite: 150_000, agentInput: 88_000, agentOutput: 21_000, model: 'opus' })
  s.tools = new Map([['Read', 51], ['Edit', 37], ['Bash', 29], ['Grep', 14], ['Write', 6], ['Glob', 5]])
  s.last = { input: 30_000, output: 2_400, ms: 31_000, cost: 0.12 }
  const i: ReportInput = {
    stats: s, now: NOW, startedAt: NOW - (2 * 60 + 10) * 60_000, contextTokens: 96_000, contextWindow: 200_000, costUsd: 4.1,
    limits: [{ kind: 'five_hour', percentUsed: 38, resetsAt: new Date(NOW + 2 * 3600_000 + 14 * 60_000).toISOString() }, { kind: 'seven_day', percentUsed: 12, resetsAt: new Date(NOW + 4 * 86400_000 + 3 * 3600_000).toISOString() }],
    lifetime: { sessions: 41, turns: 1180, toolCalls: 5320, inputTokens: 38_400_000, outputTokens: 1_900_000, cost: 163.4, longestMs: 3 * 3600_000 + 5 * 60_000, bestTurnTools: 74 },
    extras: { commits: 63, green: 48, prs: 9 },
  }
  return fence(statsText(i))
}
export function sampleCard(): string {
  const sum = { ...emptyBucket(), days: 5, turns: 74, actions: 412, commits: 17, green: 22, prs: 3, inTok: 3_100_000, outTok: 190_000, cacheTok: 2_600_000, cost: 27.4, heroes: { ironman: 31, thor: 14, cap: 11, hulk: 9, spidey: 9 } }
  return missionCard({
    range: 'week', today: new Date(2026, 9, 8, 12), sum, extras: { commits: 63, green: 48, prs: 9, cacheTok: 0, heroes: {} }, streak: 5, showCost: true,
    quote: '"I can do this all day."', heroName: id => (HERO as Record<string, { name: string }>)[id]?.name.replace(/^./, c => c).toLowerCase().replace(/(^|[ -])(\w)/g, (_, a, b) => a + b.toUpperCase()) ?? id,
  })
}
export function sampleTrophies(): string {
  const have = ['opening', 'firstCommit', 'tenCommits', 'firstPr', 'ironman', 'hulk', 'greenWall', 'streak3', 'million', 'regular', 'snap']
  const un: Record<string, number> = {}
  have.forEach((id, k) => { un[id] = Date.UTC(2026, 8, 12 + k * 2, 14) })
  return fence(trophiesText(un))
}
export const TROPHY_TOTAL = TROPHIES.length

export function terminalPage(title: string, cmd: string, text: string): string {
  const body = esc(text).split('\n').map(l => {
    if (/^(C\.L\.A\.R\.V\.I\.S\.|TROPHIES|=+$)/.test(l)) return `<span class="h">${l}</span>`
    if (/^[A-Z][A-Z ]+$/.test(l)) return `<span class="s">${l}</span>`
    if (/^\s+★/.test(l)) return l.replace('★', '<span class="h">★</span>')
    if (/hint:/.test(l)) return `<span class="d">${l}</span>`
    if (/^[╭╰├]/.test(l)) return `<span class="box">${l}</span>`
    if (/^│/.test(l)) return l.replace(/^│/, '<span class="box">│</span>').replace(/│$/, '<span class="box">│</span>')
    return l
  }).join('\n')
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0E0E16;padding:28px;display:inline-block}
.win{background:#1B1B29;border:1px solid #2A2A40;border-radius:10px;box-shadow:0 10px 30px #0008;display:inline-block;min-width:560px}
.bar{height:34px;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:1px solid #2A2A40;color:#6C7090;font:13px "Menlo",monospace;position:relative}
.bar i{width:12px;height:12px;border-radius:50%;display:inline-block}.bar span{position:absolute;left:0;right:0;text-align:center}
pre{margin:0;padding:18px 24px 22px;font:16px/1.45 "JetBrains Mono","Menlo",monospace;color:#E6E6F5}
.p{color:#B8A8FF}.h{color:#ffcf3f;font-weight:700}.s{color:#6fd8ff;font-weight:700}.d{color:#8C90B4}.box{color:#ffcf3f}
</style><div class="win" id="win"><div class="bar"><i style="background:#e2403a"></i><i style="background:#ffcf3f"></i><i style="background:#62C23C"></i><span>${esc(title)}</span></div>
<pre><span class="p">❯</span> ${esc(cmd)}\n\n${body}</pre></div>
<script>document.title=document.body.offsetWidth+'x'+document.body.offsetHeight</script>`
}
