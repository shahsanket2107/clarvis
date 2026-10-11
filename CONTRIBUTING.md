# Contributing to Clarvis

Thanks for wanting to make the HUD better. Bug reports, new quips, sprite fixes, games and episodes are all welcome.

## Ground rules

- **Fan project rules apply.** Only original work: no film stills, comic scans, official logos, sound clips, or ripped
  game assets. Short, famous catchphrases are fine as homage; whole scenes or scripts are not. See [NOTICE.md](NOTICE.md).
- **Never get in the user's way.** The mod observes and draws. It must not change a tool call, a prompt or a permission,
  must not send data anywhere, and must do no work while idle.
- **Keep it free.** No ads, tracking, donation links or paid features.

## Set up

```bash
git clone https://github.com/shahsanket2107/clarvis && cd clarvis
claude --plugin-dir .          # run Claude Code with your working copy; edits hot-reload
```

Requires Claude Code 2.1.287 or later and [Bun](https://bun.sh) for the scripts.

## Before you open a PR

```bash
claude plugin validate .       # must pass
claude plugin test .           # all tests must pass
npx tsc -p .                   # after Claude Code has loaded the mod once (it writes the types)
```

- Add or update a test for any behaviour you change (`tests/`).
- Art changes: edit `scripts/art.ts`, then `bun scripts/bake.ts`. Don't hand-edit `hooks/baked.ts`.
- Rebuild the gallery with `bun scripts/gallery.ts` and attach a screenshot or GIF to the PR.
- Keep each line of dialogue short enough for an 80-column band.

## Good first contributions

- New in-character quips in `hooks/quips.ts` (keep them about coding, kind and short).
- A colour or layout fix at an odd terminal size: `bun scripts/demo.ts` shows every view.
- Docs: clearer install steps for your terminal or OS.
