// Builds demo/gallery.html: the mod's art code bundled for the browser, so
// the gallery draws exactly what the terminal draws.
//   bun scripts/gallery.ts      then open demo/gallery.html
const dir = new URL('..', import.meta.url).pathname
const out = await Bun.build({ entrypoints: [dir + 'scripts/gallery-entry.ts'], target: 'browser', format: 'iife', minify: false })
if (!out.success) { console.error(out.logs); process.exit(1) }
const js = await out.outputs[0]!.text()
// frames captured from a real Claude Code session (tmux capture-pane -e), if present
const live = process.env.LIVE ? await Bun.file(dir + 'demo/live-frames.html').text().catch(() => '') : '' // an old capture: only on request (LIVE=1), so the gallery shows today's band
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Clarvis Gallery</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0E0E16;--card:#1B1B29;--ink:#E6E6F5;--muted:#8C90B4;--gold:#F5C542}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 "JetBrains Mono",Menlo,monospace;padding:24px 16px}
h1{margin:0 0 4px;font-size:22px;letter-spacing:.2em;background:linear-gradient(90deg,#FFEFB0,#F5C542 40%,#C41F28);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{color:var(--muted);margin:0 0 24px;max-width:900px}
section{background:var(--card);border:1px solid #2A2A40;border-radius:8px;padding:12px 14px 14px;margin:0 0 18px;max-width:100%;overflow-x:auto}
h2{margin:0;font-size:14px;color:var(--gold);letter-spacing:.06em}
p{margin:2px 0 10px;color:var(--muted)}
canvas{display:block;image-rendering:pixelated}
pre.live{font:15px/18px "JetBrains Mono",Menlo,monospace;margin:0 0 14px;background:#1B1B29;padding:6px 8px;border-radius:6px;overflow-x:auto;color:#E6E6F5}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:10px}.shots img{width:100%;border-radius:6px;image-rendering:pixelated}
</style></head><body>
<h1>CLARVIS</h1>
<p class="lead">Every animation of the clarvis mod, drawn by the mod's own code into truecolor cells and painted as Ghostty paints them: quadrant blocks (2 × 2 subpixels a cell) in a 10 × 24 px cell on #1B1B29. Below the band views: the AVENGERS THEATER (the engine's own frames) and the STARK ARCADE game. Add <code>?w=160</code> for a wider band, <code>?sheet=hulk&amp;n=10</code> for a contact sheet, <code>?theater=8&amp;n=6</code> for a movie's contact sheet.</p>
${live ? `<section><h2>LIVE · captured from a real Claude Code session</h2><p>The same band, captured from a real session in tmux (truecolor via CLAUDE_CODE_TMUX_TRUECOLOR=1) as it worked through a turn: what your terminal shows.</p><div class="livebox">${live}</div></section>` : ''}
<div id="root"></div>
<section><h2>STARK ARCADE · /clarvis play</h2><p>Screens from the game pane, rendered by the game's own engine. The title offers five games, each in its own colour: 1 ULTRON SIEGE (repulsor SPACE; 1 Cap's shield, 2 Mjölnir, 3 Hulk SMASH; Ultron Prime every 4th wave) · 2 CIVIL WAR (pick a side, draft 3 of 6, tag with Z) · 3 and 4 ARENA (any of 16 fighters vs any, four AI tiers) · 5 ENDGAME vs THANOS (break or parry the snap). Every fight: select → HOW TO PLAY → VS → fight → ranked results. Sprites scale with the pane, down to an 11-row inline pane.</p>
<div class="shots">${['title-menu', 'draft', 'how-to-play', 'civil-war', 'select', 'thor', 'snap', 'finisher', 'results', 'siege', 'small-60x11', 'siege-60x11', 'big-180x60'].map(n => `<img src="arcade/${n}.png" alt="${n}" loading="lazy">`).join('')}</div></section>
<script>${js.replaceAll('</script', '<\\/script')}</script>
</body></html>`
const OUT = process.env.GAL ?? dir + 'demo/gallery.html'
await Bun.write(OUT, html)
console.log('wrote', OUT, (html.length / 1024).toFixed(0) + ' KB')
