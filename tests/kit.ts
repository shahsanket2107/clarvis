// Shared helpers for the wave-1 test files (not a test itself).
import { mock } from 'claude-code/testing'

export type Opts = { percent?: number; usage?: any; playThrows?: boolean; env?: Record<string, string>; cost?: number; toasts?: string[]; notes?: { text: string }[]; plays?: any[]; copies?: any[]; copyResult?: any; clock?: number; tool?: (e: any) => any; options?: never }
// The store the plugin sees and the fx values it has set, readable by the test (reset by each session()).
export const K = { db: new Map<string, unknown>(), fxs: [] as any[], rosters: [] as string[][] }
export const rotation = (): string[] => K.rosters.at(-1) ?? []
export const lastFx = (): { moment: string; caption?: string; flair?: string } | null => K.fxs.at(-1) ?? null
export function session(on: any, o: Opts = {}) {
  K.db.clear(); K.fxs.length = 0; K.rosters.length = 0
  on('store.get', (_$: any, e: any) => ({ value: K.db.get(e.key) }))
  on('store.set', (_$: any, e: any) => { K.db.set(e.key, e.value); return { value: undefined } })
  on('store.delete', (_$: any, e: any) => { K.db.delete(e.key); return { value: undefined } })
  on('store.keys', () => ({ value: [...K.db.keys()] }))
  on('state.set', { plugin: 'clarvis', key: 'roster' } as any, async (_$: any, e: any, next: any) => { K.rosters.push(e.value); return next(e) })
  on('state.set', { plugin: 'clarvis', key: 'fx' } as any, async (_$: any, e: any, next: any) => { K.fxs.push(e.value); return next(e) })
  mock.env(on, { COLORTERM: 'truecolor', CLARVIS_EGG: 'never', ...(o.env ?? {}) })
  const clock = mock.clock(on, { now: o.clock ?? 0 })
  on('session.start', (_$: any, e: any) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: 'sonnet' }))
  on('session.end', (_$: any, e: any) => ({ sessionId: e.sessionId }))
  on('session.usage', () => ({ value: { startedAt: o.clock ?? 0, cost: { usd: o.cost ?? 1.5 }, context: { window: 200000, percent: o.percent ?? 41, tokens: 82400 }, rateLimits: [] } }))
  on('command.register', () => ({ value: undefined }))
  on('ui.blit', () => ({ value: {} }))
  on('ui.toast', (_$: any, e: any) => { o.toasts?.push(e.text ?? JSON.stringify(e)); return { value: undefined } })
  on('ui.notify', (_$: any, e: any) => { o.notes?.push({ text: e.text }); return { value: { isSent: true, channel: 'x' } } as any })
  on('ui.notice', () => ({ value: undefined }))
  on('ui.open', () => ({ value: { isPlaced: true } }) as any)
  on('ui.copy', (_$: any, e: any) => { o.copies?.push(e); return { value: o.copyResult ?? { isCopied: true } } as any })
  on('audio.play', (_$: any, e: any) => { o.plays?.push(e); if (o.playThrows) throw new Error('no player'); return { value: undefined } as any })
  on('tool.call', (_$: any, e: any) => (o.tool ? o.tool(e) : { result: { ok: true } }))
  on('turn.start', (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '', reason: 'answer', ...(o.usage ? { usage: o.usage } : {}) }) as any)
  return clock
}
export const start = ($: any, cwd = '/work/auth-api') => $.session.start({ cwd, surface: 'terminal', isInteractive: true })
export const hero = ($: any, args: string, presentation?: any) => $.command.run({ command: 'clarvis', args, ...(presentation ? { presentation } : {}) } as any).then((r: any) => String(r?.text ?? JSON.stringify(r)))
export const begin = ($: any) => $.turn.start({ text: 'go', turnId: 't1' })
export const done = ($: any, o: Record<string, unknown> = {}) => $.turn.complete({ answer: 'ok', durationMs: 9000, isAborted: false, turnId: 't1', reason: 'answer', ...o })
// 14 Mar 2026 (a Saturday) and friends at local noon, as the mock clock's milliseconds.
export const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
export const band = async ($: any, cols = 100, props: Record<string, unknown> = {}) => {
  const m = await $.ui.mount({ plugin: 'clarvis', surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: cols, scroll: { bodyRows: 19, offset: 0 }, view: {}, ...props } })
  return m.drawn()
}
export const rasterRow = (d: any, row = 0): string => {
  const find = (n: any): any => (!n || typeof n !== 'object' ? undefined : n.props?.cells ? n : (n.children ?? []).map(find).find(Boolean))
  const r = find(d)
  if (!r) return ''
  const bin = atob(r.props.cells), u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  const w = new Uint32Array(u8.buffer)
  let s = ''
  for (let x = 0; x < r.props.columns; x++) s += String.fromCodePoint(w[(row * r.props.columns + x) * 3] || 32)
  return s
}
