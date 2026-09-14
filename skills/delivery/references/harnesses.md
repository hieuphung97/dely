# Harness launch mechanics

`worker-start --agent` resolves these ids; the binary names `agy`,
`kiro-cli` and `cursor-agent` return `agent_unconfigured` and create no
terminal. `worker-start --model` supports Claude, Codex and Cursor ids;
`--effort` requires `--model`. Models for harnesses other than Claude,
Codex and Cursor come from Orca's per-agent default arguments.

| Harness | Orca agent id | Permission default | Forbidden headless forms | Launch notes | Control wake | Setup |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `claude` | `--dangerously-skip-permissions` | `claude -p` | `--model` pin honoured | background | trust dialog |
| Codex CLI | `codex` | `--dangerously-bypass-approvals-and-sandbox` | `codex exec` | | waker | Orca preflight |
| Grok Build | `grok` | `--permission-mode bypassPermissions` | `grok --prompt-file` | | waker | y/n security question |
| Antigravity CLI | `antigravity` | `--dangerously-skip-permissions` | `agy -p`/`--print` | | waker | trust dialog |
| Kiro CLI | `kiro` | none; `--trust-all-tools` is forbidden on the launch argv | `kiro-cli chat --no-interactive` | | unsupported | trust-all confirmation |
| Cursor Agent CLI | `cursor` | `--force` | `cursor-agent -p`/`--print` | `--model` pin honoured; omit `--effort` when Effort is `default` | background | trust dialog |
| GitHub Copilot CLI | `copilot` | `--allow-all` | `copilot -p`/`--prompt` | | background | trust dialog |
