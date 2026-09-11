# Harness launch mechanics

`dely.js` reads the Launch, Model pin, Control wake and Setup columns.
An adopted harness is launched in an Orca terminal and handed to
`worker-start --terminal` after its output goes quiet. `worker-start --agent`
resolves these ids; the binary names `agy`, `kiro-cli` and `cursor-agent`
return `agent_unconfigured` and create no terminal. `worker-start --model`
supports Claude, Codex and Cursor ids; `--effort` requires `--model`; neither
combines with `--terminal`.

| Harness | Orca agent id | Permission default | Forbidden headless forms | Launch notes | Launch | Model pin | Control wake | Setup |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claude Code | `claude` | `--dangerously-skip-permissions` | `claude -p` | `--model` pin honoured | `worker-start` | Orca `--model`/`--effort` | background | trust dialog |
| Codex CLI | `codex` | `--dangerously-bypass-approvals-and-sandbox` | `codex exec` | | `worker-start` | Orca `--model`/`--effort` | nudge | Orca preflight |
| Grok Build | `grok` | `--permission-mode bypassPermissions` | `grok --prompt-file` | | `worker-start` | argv (adopt) | nudge | none |
| Antigravity CLI | `antigravity` | `--dangerously-skip-permissions` | `agy -p`/`--print` | | adopt | argv (adopt) | nudge | trust dialog |
| Kiro CLI | `kiro` | none; `--trust-all-tools` is forbidden on the launch argv | `kiro-cli chat --no-interactive` | | `worker-start` | argv (adopt) | unsupported | trust-all confirmation |
| Cursor Agent CLI | `cursor` | `--force` | `cursor-agent -p`/`--print` | `--model` pin honoured; omit `--effort` when Effort is `default` | `worker-start` | Orca `--model` | background | trust dialog |
| GitHub Copilot CLI | `copilot` | `--allow-all` | `copilot -p`/`--prompt` | | `worker-start` | argv (adopt) | nudge | trust dialog |
