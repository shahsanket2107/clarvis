// The bottom of a Claude Code session around the band, for the demo and the
// gallery: the transcript's last line, the band with the buttons Claude Code
// lays over it (▶ MOVIES · ▶ STARK ARCADE · [-]), the prompt box and the footer.
// The band itself is drawn by the mod's own code; this adds what the engine adds.
import { CLEAR, DEFAULT, Surface, rgb } from '../hooks/pixel'

export type Kind = 'idle' | 'work' | 'moment'
const ABOVE = 1, BELOW = 4 // transcript line; separator, prompt, separator, footer
const DIM = rgb('#6C7090'), RULE = rgb('#3A3A55'), BTN = rgb('#E6E6F5'), PROMPT = rgb('#B8A8FF'), MODE = rgb('#C8A2FF')

export class Session {
  readonly band: Surface
  readonly out: Surface
  constructor(readonly columns: number, readonly bandRows: number, readonly kind: Kind, readonly project = 'my-app') {
    this.band = new Surface(columns, bandRows)
    this.out = new Surface(columns + 5, ABOVE + bandRows + BELOW) // the engine keeps five columns right of the band for its [-]
  }
  // copies the drawn band into the session frame and adds the engine's parts
  compose(): Surface {
    const b = this.band.cv, o = this.out.cv, W = b.W, w = b.w, OW = o.W, ow = o.w
    o.clear(); o.panel = DEFAULT
    o.text(0, 0, '⏺ Done: the refresh race is fixed and the auth tests pass.', DIM)
    // the band's clear pixels and plain text sit on its card: bake that in, since the session frame has none
    for (let y = 0; y < b.h; y++) for (let x = 0; x < W; x++) { const c = b.px[y * W + x]!; o.px[(ABOVE * 2 + y) * OW + x] = c === CLEAR ? b.panel : c }
    for (let r = 0; r < b.rows; r++) for (let x = 0; x < w; x++) { const i = r * w + x, j = (ABOVE + r) * ow + x; o.glyph[j] = b.glyph[i]!; o.glyphFg[j] = b.glyphFg[i]!; o.glyphBg[j] = b.glyphBg[i] === -1 ? b.panel : b.glyphBg[i]! }
    // the buttons over the band's top row (register.tsx: right 13 working, 1 idle; MOVIES 16 left of it), from 90 columns
    if (this.kind !== 'moment' && w >= 90) {
      const right = this.kind === 'work' ? 13 : 1
      o.text(w - right - 14, ABOVE, '▶ STARK ARCADE', BTN)
      if (this.kind === 'idle' || w >= 100) o.text(w - right - 16 - 8, ABOVE, '▶ MOVIES', BTN)
    }
    o.text(w + 1, ABOVE, '[-]', DIM) // the engine's collapse mark, in its five columns at the right
    const y = ABOVE + this.bandRows, tag = ` ${this.project} ─`
    o.text(0, y, '─'.repeat(ow - tag.length) + tag, RULE)
    o.text(0, y + 1, '❯ ', PROMPT)
    o.text(0, y + 2, '─'.repeat(ow), RULE)
    o.text(0, y + 3, '  ⏵⏵ auto mode on', MODE); o.text(19, y + 3, '(shift+tab to cycle)', DIM)
    return this.out
  }
}
