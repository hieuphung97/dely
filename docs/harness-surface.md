# Harness surface

Verified programmatic surface of the CLI harnesses an orchestrator drives.
Every row is either marked verified with a source, or flagged as unverified.
Nothing here was inferred from another harness's behaviour — two such
inferences were made during research and both turned out wrong (recorded in
`findings.md`).

Captured 2026-08-19. Claude Code observed at v2.1.229 / 2.1.234 / 2.1.235;
Grok Build docs page last updated 2026-07-21.

Model and effort sections for all three harnesses were re-read from the
installed CLIs on 2026-08-21 and corrected; see `findings.md` §33 for what
changed and why a catalogue is read rather than stored.

Isolation, command-network and hosted-web rows in the role matrix were
corrected 2026-08-20 from first-party documentation. Those cells are labelled
documented versus locally observed. They are not a probe of the currently
installed build of each harness. Plugin caches still run a copied version
until refreshed; see `findings.md` §22 and §29.

---

## Claude Code

Source: <https://code.claude.com/docs/en/cli-reference>,
<https://code.claude.com/docs/en/headless>,
<https://code.claude.com/docs/en/hooks>,
<https://code.claude.com/docs/en/sessions>,
<https://code.claude.com/docs/en/agent-view>,
<https://code.claude.com/docs/en/sandboxing>,
<https://code.claude.com/docs/en/sandbox-environments>,
<https://code.claude.com/docs/en/tools-reference>

### Non-interactive

| Flag | Effect |
| --- | --- |
| `-p`, `--print` | one turn, then exit |
| `--output-format text\|json\|stream-json` | machine-readable result |
| `--input-format text\|stream-json` | input shape |
| `--json-schema '<JSONSchema>'` | structured result under `structured_output`; print mode only |
| `--include-partial-messages`, `--include-hook-events` | extra stream events |
| `--max-turns`, `--max-budget-usd` | run bounds; failures surface as `error_max_turns` / `error_max_budget_usd` |
| `--bare` | skips hooks, skills, plugins, MCP, CLAUDE.md; needs `ANTHROPIC_API_KEY` |

Piped stdin is accepted as the prompt. Verified by use: three payloads were
delivered with `claude -p --resume <id> < file` and arrived byte-clean.

### Sessions

| Flag | Effect |
| --- | --- |
| `-r`, `--resume <id\|name>` | resume; cross-project id search since v2.1.223 |
| `-c`, `--continue` | most recent for this directory |
| `--session-id <UUID>` | pin a new session's id |
| `--fork-session` | branch instead of continue |
| `--no-session-persistence` | print mode only |

Transcripts: `~/.claude/projects/<cwd-with-non-alphanumerics-as-dashes>/<session-id>.jsonl`.
The docs state the entry format is internal and changes between versions, so
parsing it is not a stable interface. Observed entry kinds beyond messages:
`queue-operation`, `last-prompt`, `custom-title`, `mode`, `permission-mode`,
`pr-link`, `file-history-snapshot`, `atis-latch`.

Sessions created with `-p` are resumable by id but do not appear in the picker.
Resume does **not** restore `--mcp-config`, `--settings`, `--plugin-dir`,
`--fallback-model`, `--add-dir`. `plan` and `bypassPermissions` are never
restored.

An entrypoint field records which surface wrote each entry. Observed values:
`claude-desktop`, `cli`, `sdk-cli`. `sdk-cli` marks a `-p` turn.

### Model and effort

Re-read from the installed CLI 2026-08-21. Both probes are answered locally:
`claude -p "/model" --output-format json` and `claude -p "/effort"
--output-format json` each return `duration_api_ms 0`, `num_turns 0`,
`total_cost_usd 0`, so discovery costs nothing and reaches no model.

`--model` takes an alias or a full model ID. `/model` reports the aliases as
`sonnet`, `opus`, `haiku`, `fable`, `best`, `sonnet[1m]`, `opus[1m]`,
`fable[1m]`, `opusplan`, `default`.

`--effort low|medium|high|xhigh|max|auto`. Overrides the `effortLevel` setting
for that run only.

Changed since the 2026-08-19 capture: `ultracode` is gone and `auto` is new; the
alias list gained `best`, `opusplan`, `default` and the `[1m]` variants. Read the
vocabulary rather than storing it.

### Permissions

`--permission-mode default|acceptEdits|plan|auto|dontAsk|bypassPermissions|manual`.
`--dangerously-skip-permissions` is shorthand for `bypassPermissions` and
requires a one-time interactive acceptance before it works in `--bg`.
`--allow-dangerously-skip-permissions` makes the mode reachable without
starting in it. Also `--allowedTools` / `--disallowedTools` / `--tools`.

Workspace trust: `-p` and SDK sessions never show the trust dialog and treat
the folder as trusted, so a repository's `.claude/settings.json` hooks run
without being accepted. Mitigate with `--bare` or
`--settings '{"disableAllHooks": true}'`.

**Documented, not locally probed on this install:** Claude Code has an
OS-enforced sandboxed Bash tool (Seatbelt on macOS, bubblewrap on Linux and
WSL2). It restricts Bash commands and their children. Built-in file tools,
MCP servers and hooks still run on the host unless the whole process is wrapped
in the separate sandbox runtime. `WebSearch` and `WebFetch` are in-process
tools gated by permission rules, not by the Bash network allowlist. See
<https://code.claude.com/docs/en/sandboxing> and
<https://code.claude.com/docs/en/tools-reference>.

### Background sessions and monitoring

`claude --bg "<prompt>"` starts a supervisor-hosted session. `claude agents`
opens agent view: one row per background session, states `working` /
`blocked` / `idle` / `completed` / `failed` / `stopped`. `Space` peeks and
replies, `Enter` attaches. From the shell: `claude attach|logs|stop|respawn|rm <id>`,
`claude agents --json`, `claude daemon status`.

`--bg` cannot be combined with `-p`; the combination is rejected before a
session is created. Background sessions move into a worktree under
`.claude/worktrees/` before editing — disable with `worktree.bgIsolation: "none"`
in the project's `.claude/settings.json`.

State: `~/.claude/jobs/<id>/state.json`, `~/.claude/daemon/roster.json`.

### Hooks

31 events: SessionStart, Setup, UserPromptSubmit, UserPromptExpansion,
PreToolUse, PermissionRequest, PermissionDenied, PostToolUse,
PostToolUseFailure, PostToolBatch, Notification, MessageDisplay, SubagentStart,
SubagentStop, TaskCreated, TaskCompleted, Stop, StopFailure, TeammateIdle,
InstructionsLoaded, ConfigChange, CwdChanged, DirectoryAdded, FileChanged,
WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, Elicitation,
ElicitationResult, SessionEnd.

Handler types: `command`, `http`, `mcp_tool`, `prompt`, `agent`.

Config shape is three levels — event, then matcher groups, then handlers:

```json
{ "hooks": { "PostToolUse": [ { "matcher": "Bash",
  "hooks": [ { "type": "command", "command": "…" } ] } ] } }
```

Exit codes: `0` success and stdout is parsed as JSON when it starts with `{`;
`2` blocks regardless of any JSON, and beats `permissionDecision: "allow"`;
anything else is a non-blocking error, though schema-valid JSON is still
honoured.

`PreToolUse` decision field `permissionDecision` takes
`allow|deny|ask|defer`, precedence deny > defer > ask > allow. `defer` is
honoured only under `-p`: the turn exits with `stop_reason: "tool_deferred"`
and a `deferred_tool_use` payload, and resumes with
`claude -p --resume <session-id>`. This is the only human-in-the-loop gate of
its kind among the three harnesses.

Plugin hooks live at `<plugin-root>/hooks/hooks.json` with
`${CLAUDE_PLUGIN_ROOT}` available for script paths. `--plugin-dir <path>`
loads a plugin from a local directory for one invocation.

**Unverified:** whether hooks still run under `--permission-mode bypassPermissions`.
This matters — the whole "bypass plus a small deny hook" design depends on it.
**Unverified:** whether the Bash `tool_response` in a `PostToolUse` payload
carries an exit code. A probe hook exists to answer this.

---

## Codex CLI

Source: <https://developers.openai.com/codex/noninteractive>,
<https://developers.openai.com/codex/hooks/>,
<https://developers.openai.com/codex/config-reference/>,
<https://developers.openai.com/codex/sdk/>,
<https://developers.openai.com/codex/app-server/>,
<https://developers.openai.com/codex/sandboxing>,
<https://developers.openai.com/codex/agent-approvals-security>,
<https://developers.openai.com/codex/web-search>,
and `codex-rs/exec/src/cli.rs` in the official repository.

The three sandbox and web URLs above redirected, on 2026-08-20, to
<https://learn.chatgpt.com/codex/sandboxing>,
<https://learn.chatgpt.com/codex/agent-approvals-security> and
<https://learn.chatgpt.com/codex/web-search>. The content cited below was read
from those live pages.

### Non-interactive

`codex exec "<prompt>"` — progress to stderr, final message to stdout.

| Flag | Effect |
| --- | --- |
| `--json` (alias `experimental-json`) | JSONL on stdout |
| `-o`, `--output-last-message <path>` | final message to a file as well as stdout |
| `--output-schema ./schema.json` | JSON Schema for the final response |
| `--ephemeral` | no session rollout files written |
| `--sandbox read-only\|workspace-write\|danger-full-access` | |
| `--skip-git-repo-check`, `--strict-config`, `--ignore-user-config` | |

`--full-auto` is a deprecated compatibility flag that prints a warning; prefer
`--sandbox workspace-write`.

Event types on `--json`: `thread.started` (carries `thread_id`),
`turn.started`, `turn.completed` (carries `usage`), `turn.failed`,
`item.started`, `item.completed`, `error`.

Piped stdin is appended as a `<stdin>` block when a prompt argument is also
given; `codex exec -` forces stdin as the prompt.

### Sessions

`codex exec resume <SESSION_ID>` or `resume --last`; `codex exec fork <SESSION_ID>`.
Session id accepts a UUID or a thread name, UUIDs taking precedence.
`--all` disables cwd filtering.

`CODEX_HOME` defaults to `~/.codex`. Rollouts at
`~/.codex/sessions/YYYY/MM/DD/rollout-<ISO-timestamp>-<uuid>.jsonl`, archived
copies at `~/.codex/archived_sessions/`. This path is **not** in the published
docs; it is attested by issues in the official `openai/codex` repository
(#20317 prints both paths verbatim).

Threads are shared across surfaces — CLI, VS Code extension, and the Codex
app read the same local rollouts (issues #20624 and #20131 describe a session
the extension cannot open but the CLI can resume). Only one surface may own a
thread at a time; the error is "thread already has an active writer".

`codex app-server` exposes `thread/resume {threadId}` over JSON-RPC.

### Model and effort

`--model`, or `-c model_reasoning_effort=<level>`.
`plan_mode_reasoning_effort` additionally accepts `none`.

**Reasoning levels are per slug, not per harness.** `codex debug models` returns
the catalogue as JSON, each entry carrying `slug`, `default_reasoning_level`,
`supported_reasoning_levels` and `visibility`. Read from the installed CLI
2026-08-21:

| Slug | Default | Supported levels | Visibility |
| --- | --- | --- | --- |
| `gpt-5.6-sol` | `low` | low, medium, high, xhigh, max, ultra | list |
| `gpt-5.6-terra` | `medium` | low, medium, high, xhigh, max, ultra | list |
| `gpt-5.6-luna` | `medium` | low, medium, high, xhigh, max | list |
| `gpt-reserve` | `medium` | low, medium, high, xhigh, max | hide |
| `gpt-5.5` | `medium` | low, medium, high, xhigh | list |
| `gpt-5.4` | `medium` | low, medium, high, xhigh | list |
| `gpt-5.4-mini` | `medium` | low, medium, high, xhigh | list |
| `codex-auto-review` | `medium` | low, medium, high, xhigh, max | hide |

A `visibility` of `hide` means the slug is not offered in the picker; it is still
returned by the catalogue. Anything selecting a model for a human should filter to
`list`.

This table is a snapshot for orientation, not a stored catalogue. The 2026-08-19
capture recorded five slugs and one shared effort vocabulary, and both were wrong
two days later.

### Config

`~/.codex/config.toml`, project `.codex/config.toml` (trusted projects only),
system `/etc/codex/config.toml`. Precedence, highest first: CLI flags and `-c`
overrides, project config closest to cwd, profile file
`~/.codex/<name>.config.toml` via `--profile`, user config, system config,
built-in defaults. Since 0.134.0 `[profiles.name]` tables inside
`config.toml` and a top-level `profile =` selector are no longer supported.

`approval_policy = untrusted | on-request | never`.
`sandbox_mode = read-only | workspace-write | danger-full-access`.
`--dangerously-bypass-approvals-and-sandbox` is the full-bypass flag.

**Documented:** spawned-command network is off by default and is a separate
control from hosted `web_search` (`cached` by default; `--search` or
`web_search = "live"` for live results; `disabled` turns the tool off). The
command-network proxy does not filter web search, MCP, or other hosted tools.
**Locally observed, Codex `--sandbox read-only`:** `uv` cannot initialise
`~/.cache/uv` (`Operation not permitted`); `--add-dir` does not grant that
write. See <https://learn.chatgpt.com/codex/agent-approvals-security> and
<https://learn.chatgpt.com/codex/web-search>.

`notify = ["python3", "/path/notify.py"]` receives one JSON argument with
`type` (currently only `agent-turn-complete`), `thread-id`, `turn-id`, `cwd`,
`input-messages`, `last-assistant-message`. Ignored in project-local config.

`AGENTS.md` is supported via `project_doc_max_bytes`,
`project_doc_fallback_filenames`, `project_root_markers` (default `.git`).

### Hooks

11 events: SessionStart, SessionEnd, SubagentStart, SubagentStop, PreToolUse,
PermissionRequest, PostToolUse, PreCompact, PostCompact, UserPromptSubmit,
Stop.

Only `type: "command"` handlers execute. `prompt` and `agent` handlers are
parsed and skipped. `ask`, legacy `approve`, `continue: false`, `stopReason`,
and `suppressOutput` are parsed but unsupported — the hook is marked failed and
the tool call continues. There is no `defer`.

Non-managed command hooks require review and trust against the hook's current
hash; `/hooks` inspects and trusts them, and
`--dangerously-bypass-hook-trust` skips it for one-off automation.

Tool naming for matchers: shell and unified exec both match `Bash`;
`apply_patch` matches `apply_patch`, `Edit`, or `Write`; MCP tools match
`mcp__server__tool`. Hosted tools such as WebSearch are not covered.

The docs state the transcript format is not a stable interface for hooks.

### SDK

TypeScript `@openai/codex-sdk` wraps the CLI over JSONL. Python
`openai-codex` drives the local app-server over JSON-RPC and can set the
sandbox per turn. `codex mcp` exposes Codex as an MCP server with `codex()`
and `codex-reply()` tools — the second continues a thread.

---

## Grok Build (xAI)

Binary is `grok`. Source: <https://docs.x.ai/build/cli/reference>,
<https://docs.x.ai/build/cli/headless-scripting>,
<https://docs.x.ai/build/features/hooks>,
<https://docs.x.ai/build/features/sessions>,
<https://docs.x.ai/build/features/dashboard>,
<https://docs.x.ai/build/features/sandbox>,
<https://docs.x.ai/build/settings/reference>

### Non-interactive

`grok -p "<prompt>"` (alias `--single`).
`--output-format plain|json|streaming-json`.
`--no-auto-update` is required in scripts and CI, otherwise it checks for
updates mid-run.

**Unverified:** whether `grok -p` accepts piped stdin. Documented usage passes
the prompt as an argument. `grok -p "$(cat file)"` is safe — bash does not
re-expand the result of a command substitution, so backticks in the file are
not evaluated.

### Sessions

`-r`, `--resume [<ID>]` resumes, or the most recent when the id is omitted.
`-c`, `--continue` continues the most recent for the directory.
`-s`, `--session-id <UUID>` **creates a new session with that id — it does not
resume.** `--fork-session` branches on resume.

Stored under `~/.grok/sessions/<url-encoded-absolute-cwd>/<session-id>/`.
Observed contents: `chat_history.jsonl`, `summary.json`, `signals.json`,
`prompt_context.json`, `terminal/`, `todos.json`, plus a
`chat_history.jsonl.lock`.

`summary.json` carries `model`, `reasoning_effort`, `agent_name`,
`sandbox_profile`, `head_commit`, `created_at`, `updated_at`.
`signals.json` carries per-session telemetry including `toolCallCount`,
`toolsUsed`, `gitCommitCount`, `prCreatedCount`, `prMergedCount`,
`sessionDurationSeconds`, `avgTimeToFirstTokenMs`, `doomLoopRecoveryAttempts`,
`bashBareEchoCount`, and context-window usage.

`grok sessions list|search|delete`, `grok export <id> [output]` (Markdown),
`grok import [targets…]` imports sessions from Claude Code.

`grok export` emits the **whole transcript** as `## User` / `## Assistant` /
`## Tools` sections, not just the final message. Raw reasoning is not
included.

### Model, effort, monitoring

`-m`, `--model <MODEL>`; `--reasoning-effort <LEVEL>`, aliased `--effort`.
`grok models` lists model ids locally: `grok-4.6` (default) and `grok-4.5`,
confirmed 2026-08-21. `grok dashboard` (also `/dashboard`, `Ctrl+\`) opens the
Agent Dashboard.

**Effort is not locally discoverable, and this is the asymmetry that matters.**
`--help` gives no enum for `--reasoning-effort`, and the flag is not validated by
local subcommands: `grok --reasoning-effort bogus models` was run 2026-08-21 and
exited 0 without complaint. The vocabulary only appears when a value reaches a
dispatch, where an invalid one fails loudly with the valid set inline. So Grok
effort is taken from documentation and from validation already observed —
`low / medium / high (default) / xhigh` — and is never discovered by calling the
model. One earlier probe of that shape cost money and another hung.

### Permissions

`--always-approve` (alias `--yolo`) skips permission prompts for tool calls.
The documentation states deny rules and hooks still apply.
`--allow <RULE>` / `--deny <RULE>`, `--sandbox <PROFILE>`,
`--tools <LIST>` / `--disallowed-tools <LIST>`, `--max-turns <N>`.
Headless permission modes `--permission-mode dontAsk|bypassPermissions|acceptEdits`
are documented in the enterprise material.

Claude Code flag names are accepted as aliases where they overlap:
`--allowedTools`, `--disallowedTools`, `--append-system-prompt`,
`--system-prompt`, `--dangerously-skip-permissions`.

Documented rule forms: `Bash(git *)`, `Read(src/**)`, `Edit(**/*.rs)`,
`MCPTool(server__*)`. Order is deny, then ask, then allow.

**Contradicted by observation:** a rule written as `Bash(git push *)` did not
prevent a push. The trace shows a first attempt of
`git push origin HEAD && …` — which the pattern matches — followed by a bare
`git push`, which it does not, since `*` requires at least one character. The
deny rule was defeated by a shorter spelling of the same command. The general
point is that a deny list over command strings has no finite pattern set,
because the agent chooses the wording. Prefer the `[sandbox]` profile, which is
enforced outside the model. Details in `findings.md`.

`[sandbox]` profiles come from `sandbox.toml` with `extends`,
`restrict_network`, `read_only`, `read_write`, and `deny` globs. This rail is
enforced outside the model.

**Documented at** <https://docs.x.ai/build/features/sandbox>: `read-only`
writes only `~/.grok/` and temp, and blocks child network; child-network
restriction is enforced on Linux only and is a no-op on macOS; in-process
model API and web tools are not blocked by child-network settings. The CLI
flag `--disable-web-search` exists independently of the sandbox profile
(<https://docs.x.ai/build/cli/reference>). **Locally observed:** a sandbox
`deny` glob does not block a read; `[permission]` does. In-repo git
destruction remains uncovered because `workspace` permits writes inside the
cwd.

### Hooks

15 events: SessionStart, SessionEnd, UserPromptSubmit, PreToolUse (the only
blocking one), PostToolUse, PostToolUseFailure, PermissionDenied, Stop,
StopFailure, Notification, SubagentStart, SubagentStop, PreCompact,
PostCompact.

JSON files at `~/.grok/hooks/*.json` and `<project>/.grok/hooks/*.json`. Grok
also reads Claude Code's `.claude/settings.json` hooks and Cursor's
`.cursor/hooks.json`. Handler types `command` and `http`. **Timeout defaults
to 5 seconds.** Stdin fields are camelCase — `hookEventName`, `sessionId`,
`cwd`, `workspaceRoot`, `toolName`, `toolInput` — unlike Claude Code and Codex.

Only an explicit `{"decision":"deny"}` or exit 2 blocks. Timeouts, crashes and
malformed output all fail open.

### Compatibility

Reads Claude Code marketplaces, plugins, skills, MCP servers, agents, hooks,
and instruction files (`CLAUDE.md`, `CLAUDE.local.md`, `.claude/rules/`) with
no configuration. Also reads `AGENTS.md`, `Agents.md`, `AGENT.md`, and
user-level `~/.agents/skills/` and `~/.agents/commands/`.

**Unverified:** whether Grok discovers project-level `./.agents/skills/`.
Documented discovery covers `./.grok/skills/`, `~/.grok/skills/`, plugin
`skills/`, and user-level `~/.agents/skills/`. The reference consumer's canonical skill sits
at `.agents/skills/` as the consumer's delivery skill. Observed indirectly: a Grok session read
that skill's `SKILL.md` by absolute path after being told
the phase, which does not prove autonomous discovery. `grok inspect` lists
what Grok actually finds for a directory.

---

## Cross-harness

**One writer per session.** All three refuse concurrent ownership of a
transcript. Live attachment to a session an orchestrator is driving is not
possible on any of them.

**ACP.** Grok Build speaks it natively via `grok agent stdio`. Claude Code and
Codex need adapters (`@agentclientprotocol/claude-agent-acp`,
`@agentclientprotocol/codex-acp`). `acpx` is a headless ACP client whose
built-in registry covers all three plus about twenty others; it exposes
`set model`, `set reasoning_effort`, and `acpx flow` with `checkpoint` nodes.
Pre-1.0. Not adopted — see `decisions.md`.

**Portable skills.** `SKILL.md` with YAML frontmatter is the shared format.
`.agents/skills/` is the emerging project-level convention. `npx skills`
(vercel-labs/skills) installs across harnesses. Its compatibility matrix
claims Codex has no hooks, which OpenAI's own documentation contradicts.

**Instruction files.** Codex and Grok read `AGENTS.md`. Claude Code does not —
it uses `CLAUDE.md` and `.claude/rules/*.md`.

**Read-only monitors.** `abtop` covers Claude Code, Codex CLI and OpenCode
from local process and file state, with `--json`. It does **not** cover Grok
Build. No read-only monitor covering all three was found.

---

## Role capability matrix

**Historical as of 2026-08-25.** The evidence-journal and `delivery-doctor`
references below describe the rails that motivated and were retired by the
three-harness Orca evidence probe recorded in `docs/decisions.md`,
"2026-08-25 — Dely is an automation-first thin control protocol". Dispatch
evidence is now read from Orca, not journaled by this package; the sandbox and
identifier-injection observations remain current.

Roles are meant to be swappable: any harness as control session, any as worker.
The invocations are already symmetric, and all three resume a session by id, so
most of a swap is free. Three things are not, and they are recorded here so a
future swap is a lookup rather than a discovery.

Measured 2026-08-20 unless marked otherwise.

| Capability a role needs | Claude Code | Codex | Grok Build |
| --- | --- | --- | --- |
| interactive with a human, has a shell | yes | yes | yes |
| resume its own session by id | `--resume <id>`, cross-project | `codex resume <id>` | `--resume <id>` |
| run another harness as a subprocess | yes, has Bash | yes | yes |
| final message captured to a file | `-p > file` | `-o file` | `--output-format json`, read `.result` |
| **identifiers injected at session start** | **verified** | **unverified** | inherited from Claude Code plugins, **unverified in effect** |
| **gate evidence captured to the journal** | **verified** | unverified | unverified, and the payload is camelCase |
| filesystem isolation for review | **documented:** sandboxed Bash (Seatbelt / bubblewrap) covers Bash and children only; Edit, Write, MCP and hooks stay on the host unless the whole process is wrapped. Not a local probe of this install | **documented:** `--sandbox read-only` on spawned commands. **locally observed:** `uv` cache write denied; `--add-dir` does not grant it | **documented:** `--sandbox read-only` writes `~/.grok/` and temp only. **locally observed:** `workspace` permits in-repo writes |
| child-process / command network | **documented:** sandboxed Bash has no domains pre-allowed; in-process `WebFetch` is not gated by that allowlist | **documented:** command network off by default; proxy and domain rules apply to spawned commands only | **documented:** `read-only` / `strict` child network blocked on Linux, **no-op on macOS**; in-process API and web tools are not blocked by that setting |
| harness-native web / search | **documented:** `WebSearch` and `WebFetch` are in-process tools, permission-gated | **documented:** hosted `web_search`, independent of command network (`cached` default) | **documented:** in-process web tools; `--disable-web-search` is independent of the sandbox profile |
| destructive git in-repo guarded | `cc-safety-net` | `cc-safety-net` once trusted | **uncovered** |
| secret access guarded | `cc-safety-net` | `cc-safety-net` once trusted | `[permission]` deny rule |
| push to default branch guarded | `pre-push` in git | same | same |

### The three asymmetries, stated plainly

**Identifier injection is verified only in Claude Code.** The `SessionStart` hook
emits Claude Code's `hookSpecificOutput.additionalContext` shape. Codex documents a
`SessionStart` hook that accepts both plain stdout as developer context and
`hookSpecificOutput.additionalContext`, so it may work — but in the one Codex run
observed, `hook: SessionStart` fired and the model never quoted an identifiers
block. That is consistent with either the hook not being this plugin's, or the
shape not being read. Not isolated.

**The evidence journal is Claude-Code-shaped.** `post-tool-journal.sh` reads
`.session_id`; Grok sends `sessionId`, so a Grok session would be filed as
`unknown`. `bin/delivery-evidence` parses Claude Code's `tool_response` and `error`
shapes, which no other harness is known to produce.

**Candidate isolation is a capability each harness implements differently, not a
reason to fix the phase to one profile.** First-party docs (2026-08-20) show an
OS sandbox on all three; they do not show the same boundary. Claude Code's
default sandbox is Bash-only. Codex `--sandbox read-only` applies to spawned
commands and, locally observed, also blocks gate cache writes. Grok
`read-only` keeps `~/.grok/` writable and does not enforce child-network
restriction on macOS. Hosted or in-process web tools are documented as
independent of command network on all three; that is not a claim that this
install's web tool is enabled. This repository's current review dispatch stays
Codex `--sandbox read-only` until a separately observed role swap. The stale
Claude Code cell is recorded in `findings.md` §29 rather than silently
rewritten.

### What this means for a role swap today

Control on Codex or Grok works for the parts that matter — conversation, routing,
launching workers, resuming. It loses verified identifier injection, which is the
rail that removes the fabricated-SHA failure class. Until that is verified for the
chosen harness, a control session there must resolve identifiers with a command in
the same turn it uses them, which is the documented fallback rather than a gap.

Worker on any harness works, and the journal travels once it is wired per harness.
Claude Code and Codex read the hooks from the plugin. Grok does not: it discovers the
plugin, reports `has_hooks=true`, and dispatches nothing from it. Registering the same
three events under `~/.grok/hooks/delivery.json` with absolute paths fixes that, and
Grok's payload then turns out to be the richest of the three — it carries a real
numeric `exit_code` on the success path, which Claude Code does not.

So there is no cell in this matrix that forces a harness for evidence reasons. What
there is instead is a wiring step that differs per harness and is easy to skip
silently, which is why `delivery-doctor` now checks for it.

**Not being fixed pre-emptively.** Making the two hooks harness-agnostic means
normalising three payload shapes, and this file records four occasions where a shape
was inferred wrongly from one observation. The work is small but it must be driven
by a real swap, with the real payloads in hand, not by a prediction of them.
