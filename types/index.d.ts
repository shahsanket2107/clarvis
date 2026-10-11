export type AvengersMode = 'full' | 'calm' | 'lite' | 'off'
export type Hud = { name: string; model: string }
export type AvengersTurn = { startedAt: number; tools: number; active?: boolean; tool?: string; detail?: string; prompt?: string }
// A moment that holds the band for a while: boot, assemble, snap, fury.
export type Fx = { moment: string; at: number; detail?: string; caption?: string; flair?: string }
// context fill and spend, plus the session's token totals (inTok: everything the prompts carried,
// outTok: what the model wrote), the cache hit % and the 5-hour rate-limit window % when known
export type AvengersUsage = { percent: number; tokens: number; cost: number; inTok?: number; outTok?: number; cachePct?: number; fiveHour?: number }

declare module 'claude-code' {
  interface PluginState {
    'clarvis': {
      hud: Hud | null
      mode: AvengersMode
      turn: AvengersTurn | null
      fx: Fx | null
      usage: AvengersUsage
      tfx: { kind: string; step: number } | null // a theater burst echoed on the transcript
      roster: string[] // the rotation's order: who takes the stage, in turn
      bandNudge: number // a counter only the band's hook reads: a write redraws the band alone
      paneNudge: number // the same for the theater pane
    }
  }
}
