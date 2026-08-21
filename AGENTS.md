# delivery-evidence — Agent Instructions

This repository contains the `dely` package: the `delivery` skill and its
evidence rails for Claude Code, Codex CLI, and Grok Build.

## Source of truth

- The workflow contract is `skills/delivery/SKILL.md`.
- Observations and corrections are recorded in `docs/findings.md`.
- Settled, open, and rejected decisions are recorded in `docs/decisions.md`.
- Verified harness capabilities are recorded in `docs/harness-surface.md`.
- Installation and wiring instructions are in `README.md`.

Repository artifacts are written in English.

## Workflow

- Default branch: `main`.
- Routine corrections follow the Routine path in the `delivery` skill.
- Planned or Critical work must invoke the `delivery` skill.
- Durable decisions live in `docs/decisions.md`; transient plans live in
  `docs/_plans/`.
- The delivery log is `docs/delivery-log.md`.
- A self-update uses the frozen installed plugin version. Candidate changes run in
  the project folder. Do not edit `hooks/session-start-context.sh` or
  `hooks/post-tool-journal.sh` while a plan is running: Grok executes those two
  scripts by absolute path from whichever copy the adapter points at — this
  checkout before migration, Grok's installed copy after — so editing one
  changes the harness under a live worker. Plugin caches and Grok hook wiring
  are refreshed only between plans.

## Phase dispatch

Name the model and reasoning effort on every dispatch.

| Phase | Coordinator | Worker surface | Harness | Model | Reasoning effort | Sandbox |
| --- | --- | --- | --- | --- | --- | --- |
| `control` | Orca | interactive TUI | Claude Code | `opus` | `high` | — |
| `implement` | Orca | interactive TUI | Grok Build | `grok-4.6` | `medium` | — |
| `review` | Orca | interactive TUI | Codex | `gpt-5.6-sol` | `medium` | `--dangerously-bypass-approvals-and-sandbox` |
| `release` | Orca | interactive TUI | Grok Build | `grok-4.6` | `medium` | — |

The table is this repository's deployment selection, not the portable protocol.
Load Orca's native skill to launch and supervise each worker TUI. Do not wrap a
headless `claude -p`, `codex exec` or `grok --prompt-file` in a shell tab.

Review is independent by role: a fresh session that does not implement or edit
the candidate. This project adds no phase-implied sandbox. Codex review is pinned
to `--dangerously-bypass-approvals-and-sandbox` so that choice is explicit rather
than a hidden default. Native Internet access, closure gates, result writes and
coordinator completion stay available. If the selected coordinator is unavailable,
stop and ask the human before any headless fallback.

`design` runs in the control session and is not dispatched.

## Closure gates

Run from the repository root:

```bash
git diff --check
```

```bash
bash -n bin/delivery-doctor bin/delivery-evidence git-hooks/pre-push hooks/post-tool-journal.sh hooks/session-start-context.sh
```

```bash
jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json hooks/hooks.json hooks/grok-hooks.json.template >/dev/null
```

```bash
bash tests/delivery-evidence-pipeline.sh
```

```bash
bash tests/delivery-doctor-grok-hook.sh
```

```bash
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

The first four gates prove repository shape and syntax only. A Planned change to
runtime behaviour must also name a focused instrument that distinguishes the
changed behaviour from its failure mode.

The disclosure grep is lexical. It catches named consumer identifiers; it does
not catch a quoted consumer path, a branch name, or a session id. A green result
is not a proof of non-disclosure.
