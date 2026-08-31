# dely — Agent Instructions

This repository contains the `dely` package: the `delivery` skill and its
automation-first control protocol for Claude Code, Codex CLI, Grok Build,
Antigravity CLI, Kiro CLI, Cursor Agent CLI, and GitHub Copilot CLI.

## Source of truth

- The workflow contract is `skills/delivery/SKILL.md`.
- Settled, open, and rejected decisions are recorded in `docs/decisions.md`.
- Installation and onboarding instructions are in `README.md`.
- Structural contract checks live in `tests/contracts.sh`; GitHub Actions runs
  them on every pull request and `main` from
  `.github/workflows/contracts.yml`, whose unique required job is `contracts`.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and `.github/`
  (issue and pull-request templates) own the human contribution, conduct,
  security, and PR contract; they need no Dely or Orca install to follow.

Repository artifacts are written in English.

## Workflow

- Default branch: `main`.
- Bounded or Architectural work invokes the `delivery` skill; a Spike is
  investigation only and starts no delivery run.
- Durable decisions live in `docs/decisions.md`; transient plans live in
  `docs/_plans/`.
- Maintenance logging is machine-local and opt-in at `~/.dely/log`; no
  project-owned log file is tracked.
- A self-update runs its release phase through the frozen installed plugin
  version, because Control is already using it when the plan starts.
  Candidate changes in this checkout take effect for the next delivery, not
  the one shipping them. Plugin caches and any live worker hook wiring are
  refreshed only between plans.

## Phase dispatch

Name the model and reasoning effort on every dispatch.

<!-- dely:begin -->
## Dely

Bounded or Architectural work invokes `dely:delivery`; Spike starts no
delivery run.

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | Cursor Agent CLI | cursor-grok-4.6-medium | default |
| `review` | Kiro CLI | gpt-5.6-sol | medium |
<!-- dely:end -->

The table is this repository's deployment selection, not the portable
protocol. Per-harness launch mechanics — permission defaults, forbidden
headless forms, launch notes, and trust handling — live in
`skills/delivery/references/harnesses.md`.

This project adds no phase-implied sandbox. Native Internet access, closure
gates, result writes and coordinator completion stay available.

## Closure gates

Run from the repository root:

```bash
git diff --check
```

```bash
bash -n tests/contracts.sh
```

```bash
jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .cursor-plugin/plugin.json >/dev/null
```

```bash
bash tests/contracts.sh
```

```bash
test "$(wc -l < tests/contracts.sh)" -le 250
```

```bash
test ! -e git-hooks/pre-push
test ! -e docs/delivery-log.md
test ! -e docs/findings.md
test ! -e docs/harness-surface.md
test ! -e docs/options.md
test ! -e docs/_plans/2026-08-24-automation-first-dely-design.md
test ! -e bin/delivery-doctor
test ! -e bin/delivery-evidence
test ! -e hooks/hooks.json
test ! -e hooks/grok-hooks.json.template
test ! -e hooks/post-tool-journal.sh
test ! -e hooks/session-start-context.sh
```

```bash
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

The first three gates prove repository shape and syntax only. A Bounded or
Architectural change to runtime behaviour must also name a focused instrument
that distinguishes the changed behaviour from its failure mode. The absence
commands distinguish a deleted rail from documentation that merely says it is
deleted.

The disclosure grep is lexical. It catches named consumer identifiers; it does
not catch a quoted consumer path, a branch name, or a session id. A green result
is not a proof of non-disclosure.
