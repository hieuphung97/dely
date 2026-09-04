# Harness launch mechanics

Per-harness launch mechanics for `dely:delivery`'s worker dispatch: each
harness's Orca agent id, permission default, forbidden headless invocation
forms, and launch notes. `worker-start --agent` resolves these ids; the
binary names `agy`, `kiro-cli` and `cursor-agent` return `agent_unconfigured`
and create no terminal. `worker-start --model` supports Claude, Codex and
Cursor ids; `--effort` requires `--model`; neither combines with `--terminal`.

| Harness | Orca agent id | Permission default | Forbidden headless forms | Launch notes |
| --- | --- | --- | --- | --- |
| Claude Code | `claude` | `--dangerously-skip-permissions` | `claude -p` | `--model` pin honoured |
| Codex CLI | `codex` | `--dangerously-bypass-approvals-and-sandbox` | `codex exec` | |
| Grok Build | `grok` | `--permission-mode bypassPermissions` | `grok --prompt-file` | |
| Antigravity CLI | `antigravity` | `--dangerously-skip-permissions` | `agy -p`/`--print` | |
| Kiro CLI | `kiro` | none; `--trust-all-tools` is forbidden on the launch argv | `kiro-cli chat --no-interactive` | |
| Cursor Agent CLI | `cursor` | `--force` | `cursor-agent -p`/`--print` | `--model` pin honoured; omit `--effort` when Effort is `default` |
| GitHub Copilot CLI | `copilot` | `--allow-all` | `copilot -p`/`--prompt` | |
