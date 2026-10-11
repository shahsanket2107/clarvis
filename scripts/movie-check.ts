// Checks the AVENGERS THEATER movie scripts: runtime per movie (over several
// viewings), lines too long for a balloon, and who the library leaves out.
//   bun scripts/movie-check.ts [file-substring]
import { Glob } from 'bun'
import { CHAR_IDS, type CharId, type Movie } from '../hooks/saga-types'
import { castOf, plan } from '../hooks/saga-plan'

const dir = new URL('../hooks/', import.meta.url).pathname
const only = process.argv[2] ?? ''
const all = new Set<CharId>()
let bad = 0
for (const f of [...new Glob('movie-*.ts').scanSync(dir)].sort()) {
  if (only && !f.includes(only)) continue
  const mod = await import(dir + f) as Record<string, unknown>
  for (const m of Object.values(mod) as Movie[]) {
    if (!m || typeof m !== 'object' || !('scenes' in m)) continue
    const lens: number[] = []
    for (let s = 1; s <= 8; s++) { const p = plan(m, s * 7919); lens.push(p.len); for (const c of castOf(p)) all.add(c) }
    const p = plan(m, 1)
    const long = p.beats.filter(b => b.k === 'say' && [...b.text].length > 90)
    const beats = p.beats.length
    const mn = Math.min(...lens), mx = Math.max(...lens)
    const ok = mn >= 300 && mx <= 600
    if (!ok || long.length) bad++
    console.log(`${ok ? 'ok ' : 'BAD'} #${m.n} ${m.title.padEnd(26)} ${(mn / 60).toFixed(1)}–${(mx / 60).toFixed(1)} min · ${beats} panels · ${castOf(p).size} cast${long.length ? ` · ${long.length} lines over 90 chars: ${long.slice(0, 3).map(b => JSON.stringify(b.text)).join(' ')}` : ''}`)
  }
}
const missing = CHAR_IDS.filter(c => !all.has(c))
console.log(missing.length ? `not in any movie yet: ${missing.join(' ')}` : 'every character appears')
if (bad) process.exitCode = 1
