// Guard: hooks/ run inside Claude Code, which has no Node. `process.`, `require(` or a leftover
// experiment marker breaks the mod at load. (The test sandbox cannot read files, so this is a script.)
//   bun scripts/check-hooks.ts
import { Glob } from 'bun'
const dir = new URL('../hooks/', import.meta.url).pathname
const bad: string[] = []
let files = 0
for await (const f of new Glob('**/*.{ts,tsx}').scan(dir)) {
  files++
  ;(await Bun.file(dir + f).text()).split('\n').forEach((l, i) => { if (/\bprocess\.|\brequire\(|TMPEXP/.test(l.replace(/^\s*\/\/.*$/, ''))) bad.push(`${f}:${i + 1}`) })
}
if (bad.length) { console.error('hooks/ must not use process., require( or TMPEXP:\n' + bad.join('\n')); process.exit(1) }
console.log(`hooks ok: ${files} files, no process./require(/TMPEXP`)
