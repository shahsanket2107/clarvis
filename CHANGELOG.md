# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - Unreleased

First public release of Clarvis, an unofficial Avengers fan mod for Claude Code.

### Added
- The band above the prompt: a rotating cast of 30 heroes on a 3D stage while Claude works, each with lines about what
  Claude is doing, a live mission log, and an idle line with context, tokens, cache hit rate, cost and rate limits.
- End-of-turn moments: CLAUVENGERS, ASSEMBLE! when a task finishes, the Thanos snap when it ends on a failure, Nick
  Fury when Claude asks you a question, and a boot screen once per session.
- Ship-it celebrations for commits, green test runs (jest, vitest, bun, pytest, go, cargo) and new PRs.
- `/clarvis stats` (the C.L.A.R.V.I.S. mission report), `/clarvis card` (a shareable mission card), and lifetime totals.
- 27 trophies (`/clarvis trophies`), daily streaks, seasonal events (Halloween villains, December snow, New Year
  fireworks, Thor's Thursdays) and rare easter eggs.
- `/clarvis pick` and `/clarvis team` to choose who takes the stage, globally or per project.
- Stark Arcade (five games) and Avengers Theater (ten comic episodes) in panes.
- Original chiptune sounds synthesized in code (on by default, macOS; `/clarvis sound off`).
- Modes: full, calm (no motion), lite (text only, chosen automatically on 256-colour terminals), off.
- `/clarvis demo`, a 45-second showreel; `/clarvis notify` for a desktop ping after long tasks.
- Plugin settings: look, show cost, sound, notify after minutes.
