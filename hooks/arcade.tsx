// clarvis arcade: the surface module a Pane's <Client module="./arcade.tsx">
// runs on the drawing thread. It owns the clock (30 fps), the keys and the
// pointer, steps the game (arcade-engine.ts) and draws each frame as rows of
// Text runs (half blocks, merged where colours repeat). It posts the final
// score to the hooks module, which keeps the high score in $.store.
//   props: { best?: number }   posts: { score } on game over, { close: true } on q
import type { ClientSurface, JsonValue } from 'claude-code'
import { Game } from './arcade-engine'
import { Versus } from './arcade-versus'

type Props = { best?: number; focused?: boolean } | null | undefined
type State = { f: number }
const games = new WeakMap<object, Game>()
// Whether the game has the keyboard: Claude Code hands it over on a click inside
// the game and takes it back on Esc, and tells the Client neither, so the game
// shows CLICK TO PLAY until a key or a click arrives, and again when the pane
// loses the keyboard.
const engaged = new WeakMap<object, boolean>()
const still = new WeakMap<object, boolean>()
const clocks = new WeakMap<object, () => void>()
const lastInput = new WeakMap<object, number>()
const IDLE_MS = 20_000 // no key or click for this long: the clock stops until the next one

export default function Arcade(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const cols = surface.columns || 100, rows = surface.rows || 30
  let g = games.get(surface)
  if (!g) {
    g = new Game(cols, rows, (Date.now() & 0xffff) || 7)
    g.vs = new Versus(g)
    games.set(surface, g)
  }
  const game = g
  game.resize(cols, rows)
  const best = typeof props?.best === 'number' ? props.best : 0
  if (best > game.best) game.best = best
  if (surface.state === undefined) {
    surface.setState({ f: 0 })
    // The 30 fps clock runs only while the game has the keyboard: unfocused, it is stopped (one
    // dimmed CLICK TO PLAY frame stays up) and a key or a click starts it again. A closed pane
    // unmounts the instance, which ends its timers.
    const run = () => {
      if (clocks.get(surface)) return
      clocks.set(surface, surface.every(33, () => {
        if (engaged.get(surface) && Date.now() - (lastInput.get(surface) ?? 0) > IDLE_MS) engaged.set(surface, false)
        if (!engaged.get(surface)) { clocks.get(surface)?.(); clocks.delete(surface); still.set(surface, true); surface.setState({ f: game.frame }); return }
        if (still.get(surface)) { still.set(surface, false); game.resumeReady() }
        game.tick()
        if (game.outbox) { surface.post(game.outbox as unknown as JsonValue); game.outbox = undefined }
        if (game.wantsClose) { game.wantsClose = false; surface.post({ close: true }) }
        surface.setState({ f: game.frame })
      }))
    }
    run()
    surface.onKey(e => { engaged.set(surface, true); lastInput.set(surface, Date.now()); run(); game.key(e.key) })
    surface.onPointer(e => { if (e.type === 'down') { engaged.set(surface, true); lastInput.set(surface, Date.now()); run() } game.pointer(e.type, e.fine?.x ?? e.x, e.fine?.y ?? e.y, e.button) })
  }
  // (the pane's isFocused is not the Client's keyboard: a click inside flips it, so it is ignored)
  game.clickHint = !engaged.get(surface)
  game.draw()
  const { specs } = game.frameOut()
  return (
    <Box flexDirection="column" width={game.W} height={specs.length}>
      {specs.map(spec => <Text {...spec.props}>{spec.kids.map(k => (typeof k === 'string' ? k : <Text {...k.props}>{k.s}</Text>))}</Text>)}
    </Box>
  )
}
