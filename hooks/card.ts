// clarvis mission card: /clarvis card [today|week|all] [nocost]. A small
// box-drawing card, 44 columns at the widest, of plain single-width characters.
// Pure: the numbers, the date and the quote are handed in.
import { fmtCost, fmtTokens } from './metrics'
import { dayKey, daysAgo, type Extras, type Range, type Sum } from './daily'
import { mvp } from './daily'

export const CARD_W = 44
const INNER = CARD_W - 2, TEXT = INNER - 2
const len = (s: string) => [...s].length
const cut = (s: string, n: number) => { const a = [...s]; return a.length <= n ? s : n <= 1 ? '…' : a.slice(0, n - 1).join('') + '…' }
const pad = (s: string, n: number) => { const l = len(s); return l >= n ? cut(s, n) : s + ' '.repeat(n - l) }

export type CardArgs = { range: Range; nocost: boolean }
/** `[today|week|all] [nocost]` in any order; undefined when a word is neither. */
export function parseCardArgs(rest: string): CardArgs | undefined {
  let range: Range = 'today', nocost = false
  for (const w of rest.split(/\s+/).filter(Boolean)) {
    if (w === 'today' || w === 'week' || w === 'all') range = w
    else if (w === 'nocost') nocost = true
    else return undefined
  }
  return { range, nocost }
}

export type CardIn = {
  range: Range; today: Date
  sum: Sum // the days in range (today, week); for `all` the lifetime figures below are used
  life?: { turns: number; toolCalls: number; inputTokens: number; outputTokens: number; cost: number }
  extras: Extras
  streak: number
  showCost: boolean // false: no money on the card (the showCost option or the nocost word)
  quote: string
  heroName: (id: string) => string
}
function wrap(s: string, w: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const word of s.split(/\s+/).filter(Boolean)) {
    const w2 = len(word) > w ? cut(word, w) : word
    if (!cur) cur = w2
    else if (len(cur) + 1 + len(w2) <= w) cur += ' ' + w2
    else { out.push(cur); cur = w2 }
  }
  if (cur) out.push(cur)
  return out.slice(0, 3)
}
export function missionCard(i: CardIn): string {
  const all = i.range === 'all' && i.life
  const turns = all ? i.life!.turns : i.sum.turns
  const actions = all ? i.life!.toolCalls : i.sum.actions
  const inTok = all ? i.life!.inputTokens : i.sum.inTok, outTok = all ? i.life!.outputTokens : i.sum.outTok
  const cacheTok = all ? i.extras.cacheTok : i.sum.cacheTok
  const commits = all ? i.extras.commits : i.sum.commits
  const cost = all ? i.life!.cost : i.sum.cost
  const heroes = all ? i.extras.heroes : i.sum.heroes
  const hit = inTok > 0 ? Math.min(100, Math.round((cacheTok / inTok) * 100)) : undefined
  const star = mvp(heroes)
  const span = i.range === 'today' ? dayKey(i.today) : i.range === 'week' ? `${dayKey(daysAgo(i.today, 6))} to ${dayKey(i.today)}` : 'all time'
  const sk = i.streak > 0 ? `▲${i.streak}d` : '—'
  const half = Math.floor(TEXT / 2)
  const two = (a: string, b: string) => pad(a, half) + pad(b, TEXT - half)
  const line = (s: string) => `│ ${pad(s, TEXT)} │`
  const rule = (l: string, r: string) => l + '─'.repeat(INNER) + r
  const rows = [
    rule('╭', '╮'),
    line('CLARVIS · MISSION CARD'),
    line(`${i.range.toUpperCase()} · ${span}`),
    rule('├', '┤'),
    line(two(`missions  ${turns}`, `actions  ${actions}`)),
    line(two(`commits   ${commits}`, `tokens   ${fmtTokens(inTok + outTok)}`)),
    line(two(`cache     ${hit === undefined ? '—' : hit + '%'}`, i.showCost ? `cost     ${fmtCost(cost)}` : `streak   ${sk}`)),
    line(`MVP       ${star ? i.heroName(star) : '—'}`),
    ...(i.showCost ? [line(`streak    ${sk}`)] : []),
    rule('├', '┤'),
    ...wrap(i.quote, TEXT).map(line),
    line('clarvis · unofficial fan mod'),
    rule('╰', '╯'),
  ]
  return rows.join('\n')
}
