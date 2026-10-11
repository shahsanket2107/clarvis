// clarvis: the text pieces drawn outside the band: the quiet spinner line
// (calm mode, or when the band has no room) and the turn's closing line, plus
// what a tool call is working on, short. The band itself is scenes.ts.

export type Seg = { text: string; color: string; bg?: string; bold?: boolean }
export type Row = Seg[]
const C = { text: '#E6E6F5', muted: '#8A8FB0', arc: '#5FE1FF', gold: '#F5C542', thanos: '#8E5BD6' }
const seg = (text: string, color: string, bold = false): Seg => ({ text, color, bold })
function merge(row: Row): Row {
  const out: Row = []
  for (const s of row) {
    const p = out[out.length - 1]
    if (p && p.color === s.color && p.bg === s.bg && !!p.bold === !!s.bold) out[out.length - 1] = { ...p, text: p.text + s.text }
    else out.push({ ...s })
  }
  return out
}
function fit(row: Row, w: number): Row {
  const out: Row = []
  let left = Math.max(0, w)
  for (const s of row) {
    if (left <= 0) break
    const chars = [...s.text]
    out.push({ ...s, text: chars.slice(0, left).join('') })
    left -= Math.min(chars.length, left)
  }
  return out
}

// The quiet spinner: ◉ JARVIS and what's running, the clock kept visible.
const VERB: Record<string, string> = { 'tool-use': 'running', 'tool-input': 'assembling the suit…', responding: 'composing a reply…', requesting: 'uplink to the satellite…', thinking: 'analysing…' }
export type SpinnerArgs = { mode: string; hero?: string; tool?: string; detail?: string; elapsed: string; tools: number; width: number }
export function spinnerRow(a: SpinnerArgs): Row {
  const tail: Row = [seg(`  ${a.elapsed}${a.tools ? ` · ${a.tools} tool${a.tools === 1 ? '' : 's'}` : ''}`, C.muted)]
  const what = a.mode === 'tool-use' && a.tool ? a.tool /* the tool, never its command */ : VERB[a.mode] ?? VERB.thinking!
  const who = a.mode === 'tool-use' && a.hero ? a.hero : 'JARVIS'
  const row: Row = [seg('◉', C.arc, true), seg(`  ${who}: `, C.arc, true), seg(what, C.text)]
  const used = tail.reduce((n, s) => n + [...s.text].length, 0)
  return merge([...fit(row, a.width - used), ...tail])
}

// 42s · 1m 04s · 1h 02m: the one format every elapsed time here uses.
export const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000)), p2 = (n: number) => String(n).padStart(2, '0')
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${p2(s % 60)}s` : `${Math.floor(s / 3600)}h ${p2(Math.floor((s % 3600) / 60))}m`
}
export function footerRow(durationMs: number, tools: number, outcome: 'done' | 'failed' | 'aborted'): Row {
  const what = outcome === 'failed' ? [seg('◆ ', C.thanos, true), seg('Snapped', C.thanos, true)]
    : outcome === 'aborted' ? [seg('■ ', C.muted, true), seg('Stood down', C.muted, true)]
    : [seg('✓ ', C.gold, true), seg('Mission complete', C.gold, true)]
  return merge([...what, seg(` in ${fmtDur(durationMs)}${tools ? ` · ${tools} tool${tools === 1 ? '' : 's'}` : ''}`, C.muted)])
}

// What to say a tool is working on, short.
export function detailOf(e: Record<string, unknown>): string {
  const pick = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  let s = pick('file_path') || pick('notebook_path') || pick('command') || pick('pattern') || pick('query') || pick('url') || pick('description') || pick('path')
  s = s.split('\n')[0] ?? ''
  if (s.includes('/') && !s.includes(' ')) s = s.split('/').slice(-2).join('/')
  const a = [...s] // by code point: never split a pair
  return a.length > 48 ? a.slice(0, 47).join('') + '…' : s
}
