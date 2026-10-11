# Security

Clarvis is a Claude Code mod: code that runs inside Claude Code with your permissions. It is built to be safe to run:

- It only observes and draws. It never changes a tool call, a prompt or a permission decision.
- It makes no network requests, starts no processes and reads or writes no files of yours.
- It stores only its own settings and scores in Claude Code's per-plugin store.

Check this yourself before installing: `claude plugin validate .` on a clone lists every hook and every call the mod makes.

## Reporting a vulnerability

Please don't open a public issue. Use GitHub's **Report a vulnerability** button on the repository's Security tab
(private vulnerability reporting). You'll get a reply within a few days.
