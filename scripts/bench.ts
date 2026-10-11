// Per-frame cost of the theater at 170x45: draw() and out() timed apart, every movie, 8 frames a beat.
//   bun scripts/bench.ts [cols rows]
import { MOVIES } from '../hooks/movies'
import { Theater } from '../hooks/theater-engine'
const C = +(process.argv[2] ?? 170), R = +(process.argv[3] ?? 45)
const th = new Theater(C, R, 9)
for (let pass = 0; pass < 2; pass++) {
  let nd = 0, td = 0, to = 0, worst = 0
  for (let i = 0; i < MOVIES.length; i++) {
    th.watch(i)
    const p = th.plan!
    let md = 0, mn = 0
    for (const b of p.beats) for (let k = 0; k < 8; k++) {
      th.tm = Math.min(p.len - 0.01, b.start + (b.d * (k + 0.5)) / 8); th.time += 0.083
      const a = performance.now(); th.draw(); const m = performance.now(); const o = th.out(); const e = performance.now()
      if (pass) { nd++; td += m - a; to += e - m; md += m - a; mn++; worst = Math.max(worst, o.size) }
    }
    if (pass) console.log(`#${i + 1} draw ${(md / mn).toFixed(2)} ms`)
  }
  if (pass) console.log(`avg draw ${(td / nd).toFixed(2)} ms, out ${(to / nd).toFixed(2)} ms, worst tree ${worst} chars`)
}
