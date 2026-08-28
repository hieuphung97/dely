# Harness launch mechanics

Per-harness launch mechanics for `dely:delivery`'s worker dispatch: each
harness's permission default, forbidden headless invocation forms, launch
notes, and trust handling. The trust column is present and empty; a later
delivery fills it, since a column added later would be a schema change
instead of a row edit.

| Harness | Permission default | Forbidden headless forms | Launch notes | Trust handling |
| --- | --- | --- | --- | --- |
| Claude Code | `--dangerously-skip-permissions` | `claude -p` | Launch via Orca's `--agent` launcher when it can pin model and effort; hand-composed argv otherwise. | |
| Codex CLI | `--dangerously-bypass-approvals-and-sandbox` | `codex exec` | Launch via Orca's `--agent` launcher when it can pin model and effort; hand-composed argv otherwise. | |
| Grok Build | `--permission-mode bypassPermissions` | `grok --prompt-file` | Launch via Orca's `--agent` launcher when it can pin model and effort; hand-composed argv otherwise. | |
| Antigravity CLI | `--dangerously-skip-permissions` | `agy -p`/`--print` | Launch via Orca's `--agent` launcher when it can pin model and effort; hand-composed argv otherwise. | |
| Kiro CLI | none; `--trust-all-tools` is forbidden on the launch argv | `kiro-cli chat --no-interactive` | Launches as an interactive TUI, `kiro-cli chat --tui` with `--model` and `--effort` pinned from the managed block; once the TUI is idle at its prompt, send `/tools trust-all`, then the work prompt. | |
| Cursor Agent CLI | `--force` | `cursor-agent -p`/`--print` | Launches as an interactive `cursor-agent` TUI; pin `--model` from the managed block unless the cell is `default`, and omit effort flags; do not use `-w`/`--worktree`. | |
