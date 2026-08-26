# Plan — First-class Antigravity CLI harness

Decision record: `docs/decisions.md` (settled 2026-08-26 — Antigravity CLI is a first-class fourth harness)

**Baseline:** leave empty until the commit that carries this plan exists.

## Goal

A consuming project can install Dely into Antigravity CLI (`agy`) the same way it
installs into Claude Code, Codex CLI, and Grok Build: native plugin install, live
model and effort discovery in `dely:setup`, and `AGENTS.md` read natively. This
repository's own Dely phase table stays Claude Code / Codex CLI. Out of reach:
Orca changes, Antigravity 2.0 desktop, hooks, `GEMINI.md`, headless `agy -p`.

## Allowed scope

```
plugin.json
.claude-plugin/plugin.json
.codex-plugin/plugin.json
skills/setup/SKILL.md
README.md
AGENTS.md
docs/decisions.md
docs/_plans/2026-08-26-antigravity-cli-support.md
tests/contracts.sh
```

Carried: colocated checks in `tests/contracts.sh`; the jq gate list in `AGENTS.md`.
No `GEMINI.md`. `CLAUDE.md` stays `@AGENTS.md`.

## Forbidden scope

`skills/delivery/SKILL.md` — portable protocol, does not name harnesses.
Hook files, `.agents/`, Orca, this repository's Dely table pins.

## Execution envelope

Protected dirty paths: the tree was clean at the design baseline.

Branch, base, remote, and pull-request target: `feat/antigravity-cli-support`,
base `main`, remote `origin`, draft pull request to `main`.

Resolved phase pins: `implement` Claude Code `sonnet` `medium`; `review` Codex
CLI `gpt-5.6-sol` `high`.

Authority: this plan may branch, commit only its own owned paths, run gates,
push the named branch, and open or update the named pull request. It may not
merge, force-push, stash, reset, clean, or edit anything outside owned scope.

## Tasks

### 1. Native `agy` plugin marker and versioned manifests

**Behaviour.** `agy plugin validate` of the repository root processes `delivery`
and `setup`. Versioned Claude and Codex manifests are `0.13.0`. `jq` accepts
root `plugin.json`. Root `.name` is `dely`.

**Direction.** Add a root `plugin.json` with `name` and `description` only. Bump
the two versioned manifests together. Extend `tests/contracts.sh` for `0.13.0`
and `.name == "dely"` on the root file. Do not require the `agy` binary inside
`contracts.sh`.

**Files.** `plugin.json`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
`tests/contracts.sh`, `AGENTS.md` (jq gate includes `plugin.json`).

**Focused verification.** `agy plugin validate .` reports skills processed (two).
`jq -e '.name == "dely"' plugin.json`. `bash tests/contracts.sh`.

**Document impact.** `AGENTS.md` owns the jq gate command. Version pin lives in
`tests/contracts.sh`.

### 2. Live setup discovery

**Behaviour.** Customize can offer Antigravity CLI when `agy` is installed, using
`agy models` and help-derived effort, and omits it when `agy` is missing. Setup
never writes `~/.gemini` and never offers `GEMINI.md`.

**Direction.** Add discovery commands. Effort is `low|medium|high` from
`agy --help`; do not prompt the model. Do not strip effort suffixes from slugs.
Add `~/.gemini` to the write-refusal list. Update the paragraph that currently
says only Codex and Grok read `AGENTS.md`. Add a section-bounded structural
check that Discovery names `agy models`. Stay within 250 lines in
`tests/contracts.sh`.

**Files.** `skills/setup/SKILL.md`, `tests/contracts.sh`, reader sentences in
`README.md` and `AGENTS.md`.

**Focused verification.** Parser requires `agy models` inside Discovery.
`grep` that setup refuses `~/.gemini`. `test ! -e GEMINI.md`.

**Document impact.** Setup owns discovery. README and `AGENTS.md` own the
instruction-file reader list.

### 3. Install docs

**Behaviour.** README install includes `agy plugin install`. The intro lists
four harnesses. The headless-forbidden list in `AGENTS.md` includes `agy -p` or
`--print`. The durable decision is already in `docs/decisions.md`.

**Direction.** Edit README and `AGENTS.md` intro and headless list. Do not
retarget this repository's Dely table. Do not document a plugin cache path.

**Files.** `README.md`, `AGENTS.md`.

**Focused verification.** README Install contains `agy plugin install`. Managed
block still pins implement to Claude Code and review to Codex CLI.

**Document impact.** README owns install. `AGENTS.md` owns this repository's
intro and headless list.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Repo root is a valid `agy` plugin whose `skills/` are loaded | `agy plugin validate .` reports `✔ skills` and `2 processed` | `agy plugin validate .claude-plugin` is `[ok]` with skills skipped | 2026-08-26 on `7f34a67`: root `Error: missing plugin.json`; `.claude-plugin` `[ok]` with `skills : skipped (not found)` |
| Root manifest identity is `dely` and JSON-valid | `jq -e '.name == "dely"' plugin.json` | `plugin.json` present with another name still validates as a plugin | 2026-08-26: no root `plugin.json`, so a name-less or misnamed file cannot yet be distinguished from absence; the `.claude-plugin` empty plugin is the present-and-wrong shape |
| Versioned Claude/Codex manifests stay aligned at `0.13.0` | `tests/contracts.sh` version check | Only one of the two bumped | 2026-08-26: both manifests `0.12.0`; `tests/contracts.sh` still requires `0.12.0` |
| Setup discovers Antigravity from live `agy models`, not a catalogue | Structural parse of Setup Discovery requiring the `agy models` command | Prose says Antigravity is supported but Discovery still lists only claude/codex/grok commands | 2026-08-26: Discovery lists only those three CLIs; no `agy models` |
| Setup does not write `~/.gemini` and does not add `GEMINI.md` | grep refusals; `test ! -e GEMINI.md` | CLAUDE.md-style offer copied for GEMINI.md | 2026-08-26: `test ! -e GEMINI.md` holds; setup refusals name `~/.claude`, `~/.codex`, `~/.grok` only |
| README install documents `agy plugin install` | grep Install section | Intro lists four harnesses; Install still has only three commands | 2026-08-26: Install has claude, codex, grok only; intro names three harnesses |
| This repo's Dely table still pins implement=Claude Code, review=Codex CLI | `AGENTS.md` managed-block rows | Support change silently retargets this repo's workers | 2026-08-26: table already has those pins; the row stays a regression check after edits |

**Cannot be observed:** whether Orca's `agy` launcher applies `--model` and
`--effort` on a live TUI; whether `agy plugin install <git-url>` over the
network copies the same tree as a local path; skill activation inside an
interactive `agy` session.

## Stop conditions

- `agy plugin validate .` with a correct `plugin.json` still skips `skills/` —
  packaging layout is wrong; do not invent `.agents/skills/` copies.
- Live validator rejects `description` — drop it and keep `name` only.
- Adding Discovery checks pushes `tests/contracts.sh` over 250 lines — shrink
  the parser, do not drop the discriminating check.
- Orca cannot launch `agy` as a worker TUI — out of scope; escalate, do not add
  headless `agy -p`.

## Closure gates

From the repository root:

```bash
git diff --check
bash -n tests/contracts.sh
jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json >/dev/null
bash tests/contracts.sh
test "$(wc -l < tests/contracts.sh)" -le 250
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
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
agy plugin validate .
```
