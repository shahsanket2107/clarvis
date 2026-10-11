// clarvis AVENGERS THEATER: the surface module a Pane's
// <Client module="./theater.tsx"> runs. It owns the clock (12 fps), the keys
// and the pointer, steps the Theater (theater-engine.ts) and draws each frame
// as rows of Text runs. It posts { watched } when a movie ends, { fx } when a
// screen burst fires (the hooks tint the transcript) and { close } on Q.
//   props: { seen?: string[]; start?: number; nonce?: number; fx?: boolean }
import type { ClientSurface, JsonValue } from 'claude-code'
import { FPS, Theater } from './theater-engine'

type Props = { seen?: string[]; start?: number; nonce?: number; fx?: boolean } | null | undefined
type State = { f: number }
const theaters = new WeakMap<object, Theater>()
// The arcade's pattern: the pane's isFocused is not the Client's keyboard, so it is
// ignored; a key or a click engages, and with no input for IDLE_MS the clock stops
// (a playing movie keeps it running: you sit back and watch).
const engaged = new WeakMap<object, boolean>()
const clocks = new WeakMap<object, () => void>()
const lastInput = new WeakMap<object, number>()
const nonces = new WeakMap<object, number>()
const IDLE_MS = 20_000

export default function TheaterClient(props: Props, surface: ClientSurface<State>) {
  const { Box, Text } = surface.elements
  const cols = surface.columns || 100, rows = surface.rows || 30
  let th = theaters.get(surface)
  if (!th) { th = new Theater(cols, rows, (Date.now() & 0xffffff) || 7); theaters.set(surface, th) }
  const T = th
  T.resize(cols, rows)
  for (const id of props?.seen ?? []) T.seen.add(id)
  T.fx = props?.fx !== false
  const run = () => {
    if (clocks.get(surface)) return
    clocks.set(surface, surface.every(Math.round(1000 / FPS), () => {
      const idle = Date.now() - (lastInput.get(surface) ?? 0) > IDLE_MS
      if (!engaged.get(surface) || (idle && !T.playing)) { engaged.set(surface, false); clocks.get(surface)?.(); clocks.delete(surface); surface.setState({ f: T.frame }); return }
      T.tick()
      for (const m of T.outbox.splice(0)) surface.post(m as JsonValue)
      surface.setState({ f: T.frame })
    }))
  }
  // opened straight into a movie (/clarvis movie N): that counts as engaging
  const nonce = typeof props?.nonce === 'number' ? props.nonce : 0
  if (typeof props?.start === 'number' && nonce !== (nonces.get(surface) ?? -1)) {
    nonces.set(surface, nonce); T.watch(props.start); engaged.set(surface, true); lastInput.set(surface, Date.now())
  }
  if (surface.state === undefined) {
    surface.setState({ f: 0 })
    surface.onKey(e => { engaged.set(surface, true); lastInput.set(surface, Date.now()); T.key(e.key); for (const m of T.outbox.splice(0)) surface.post(m as JsonValue); run(); surface.setState({ f: T.frame + 0.5 }) })
    surface.onPointer(e => {
      if (e.type === 'down') { engaged.set(surface, true); lastInput.set(surface, Date.now()) }
      T.pointer(e.type, e.x, e.y)
      run(); surface.setState({ f: T.frame + 0.25 })
    })
  }
  if (engaged.get(surface)) run()
  T.draw()
  const { specs } = T.out()
  return (
    <Box flexDirection="column" width={T.cols} height={specs.length}>
      {specs.map(spec => <Text {...spec.props}>{spec.kids.map(k => (typeof k === 'string' ? k : <Text {...k.props}>{k.s}</Text>))}</Text>)}
    </Box>
  )
}
