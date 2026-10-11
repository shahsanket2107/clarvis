# Launch media

All of it is generated from the mod's own drawing code (no real-time capture, no film audio). Rebuild everything:

```
bun scripts/gallery.ts && MEDIA_TMP=/some/scratch/dir bun scripts/record.ts
```

Needs bun, ffmpeg and headless Chrome (`CHROME`, `FFMPEG` env override the paths; `MEDIA_TMP` holds the frame cache, ~1300 frames at 30 fps, so a rerun reuses it; `FRESH=1` re-renders). Steps can be run alone: `bun scripts/record.ts frames|stills|gif|mp4|theater|text|social|arcade`. Chrome always runs with a throwaway `--user-data-dir` under `MEDIA_TMP`. All text samples (stats, card, trophies) use made-up data.

| file | size | dimensions | regenerate |
|---|---|---|---|
| hero.gif | 1.6 MB | 1160x346, 10 fps, 37 s | `bun scripts/record.ts gif` |
| hero-short.gif | 1.0 MB | 1160x346, 10 fps, 19.4 s | `bun scripts/record.ts gif` |
| demo.mp4 | 1.6 MB | 1920x1080, 30 fps H.264, 45 s, no audio | `bun scripts/record.ts mp4` |
| demo-square.mp4 | 1.5 MB | 1080x1080, 30 fps | `bun scripts/record.ts mp4` |
| band.png | 46 KB | 1450x432 (Thor mid-animation, 140 columns) | `bun scripts/record.ts stills` (`BAND_T=<s>`) |
| moment.png | 21 KB | 1450x360 (CLAUVENGERS, ASSEMBLE!) | `bun scripts/record.ts stills` (`MOMENT_T=<s>`) |
| idle.png | 23 KB | 1450x144 | `bun scripts/record.ts stills` |
| theater.png | 16 KB | 1000x672 (movie 8, 100x28) | `bun scripts/record.ts theater` |
| arcade.png | 43 KB | 900x582 (demo/arcade/title-menu.png without its debug line) | `bun scripts/record.ts arcade` |
| social-preview.png | 197 KB | 1280x640 | `bun scripts/record.ts stills social` |
| stats.png, card.png, trophies.png | 106 / 36 / 119 KB | 618x1200, 618x481, 645x898 | `bun scripts/record.ts text` |

Sources: `scripts/record.ts` (pipeline, timelines, captions), `scripts/media/html.ts` (caption, social and terminal pages, sample data), `?frames=` mode of `scripts/gallery-entry.ts`.


The LinkedIn videos (`demo.mp4`, `demo-square.mp4`) and `hero-short.gif` are generated here too, then moved out of the repo:
they aren't used by the README or the site, and every install would otherwise download them.
