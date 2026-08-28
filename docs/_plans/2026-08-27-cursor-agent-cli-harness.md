# Plan — Cursor Agent CLI is a first-class sixth harness

Decision record: `docs/decisions.md` (2026-08-27 — Cursor Agent CLI is a first-class sixth harness)

**Baseline:** `5f5b6ab847533af8e173eff97cbc9351340e8417`

## Goal

Dely treats Cursor Agent CLI as a first-class harness without a sixth skill tree and without a second install story: one `skills/` directory, a thin `.cursor-plugin/` sidecar, native Cursor install, live setup discovery, Orca-dispatched interactive TUI workers, and a bug-form name.

Existing Claude Code, Codex CLI, Grok Build, Antigravity CLI, and Kiro CLI install/update/remove paths stay the command surfaces they are today. Root `plugin.json` stays the Antigravity manifest. Portable `skills/delivery/SKILL.md` still names no harness.

## Allowed scope

```
docs/decisions.md
docs/_plans/2026-08-27-cursor-agent-cli-harness.md
.cursor-plugin/plugin.json
skills/setup/SKILL.md
AGENTS.md
README.md
tests/contracts.sh
.github/ISSUE_TEMPLATE/bug_report.yml
.claude-plugin/plugin.json
.codex-plugin/plugin.json
.github/workflows/contracts.yml
```

Carried: `tests/contracts.sh`. The existing `jq -e .` closure line gains `.cursor-plugin/plugin.json` (AGENTS.md, workflow, contracts required run-lines). `.github/workflows/contracts.yml` is listed because that run-line lives there; it is not a new workflow.

The managed-block pin rewrite on this branch (`344fb7d`) is the user's prior setup change, not this contract. Implementers must not rewrite the `implement`/`review` rows.

## Forbidden scope

- `skills/delivery/SKILL.md` — portable protocol still names no harness.
- `plugin.json` — Antigravity schema; Grok validates it.
- `.cursor-plugin/marketplace.json` — not until live indexing proves `plugin.json` alone still indexes 0.
- `hooks/`, `.cursor/`, `.agents/`, skill copies, Cursor rules/agents/commands.
- Managed Dely block pin rows.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
- Orca, `~/.cursor` writes, MCP, Cloud Agent, ACP.

## Execution envelope

Protected dirty paths: none at this plan's baseline commit. `AGENTS.md` pin rewrite was committed separately as `344fb7d` and must not be restaged as Cursor work.

Branch, base, remote, and pull-request target: `feat/cursor-agent-cli-harness` from `main`, PR against `origin/main`.

Resolved phase pins:

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | Antigravity CLI | `claude-sonnet-4-6` | `medium` |
| `review` | Grok Build | `grok-4.6` | `high` |

Authority: this plan may branch, commit only its own owned paths, run gates, push the named branch, and open or update the named pull request. It may not merge, force-push, stash, reset, clean, or edit anything outside owned scope.

## Tasks

### 1. Cursor sidecar points at the canonical skills tree

**Behaviour.** `.cursor-plugin/plugin.json` exists, is valid JSON, `.name` is `dely`, `.skills` is `./skills/`, and it does not declare `version` or `hooks`. Root `plugin.json` is unchanged. `agy plugin validate .` and `grok plugin validate .` still pass. The `jq -e .` gate lists the new file.

**Direction.** Superpowers' Cursor manifest, minus hooks and minus a third version field.

**Files.** `.cursor-plugin/plugin.json`. Extend the existing `jq -e .` closure command in `AGENTS.md`, `.github/workflows/contracts.yml`, and `tests/contracts.sh`.

**Focused verification.** `jq -e . .cursor-plugin/plugin.json`. `tests/contracts.sh` asserts `.name == "dely"`, `.skills == "./skills/"`, and no `version` key. A manifest that omits `skills` or points at `.cursor/skills/` must fail. A root `plugin.json` that gained `$schema` must fail the existing Antigravity name-only checks.

**Document impact.** The jq command is owned by AGENTS.md and the contracts workflow.

### 2. Setup discovers Cursor Agent CLI from the live CLI

**Behaviour.** Customize offers Cursor Agent CLI when `cursor-agent` is installed and `cursor-agent models` is usable; it offers each slug and writes Effort as `default`. Unusable discovery is omitted. Setup does not write `~/.cursor`. Cursor is listed among harnesses that read `AGENTS.md` natively. `CLAUDE.md` is not called inert on Cursor. The write offer stays Claude-Code-only. The Kiro discovery subsection stays verbatim.

**Direction.** Add a `### Cursor Agent CLI` Discovery subsection, verbatim-stable like Kiro's. Extend the do-not-write list with `~/.cursor`. Do not mention launch argv in setup.

**Files.** `skills/setup/SKILL.md`.

**Focused verification.** `tests/contracts.sh` verbatim match of the new subsection (and the existing Kiro subsection still matches). A setup text that lists hardcoded Cursor model names, or that copies Antigravity's `low|medium|high` onto Cursor, must fail that match.

**Document impact.** `skills/setup/SKILL.md` owns discovery policy.

### 3. This repository can dispatch Cursor Agent CLI as a TUI worker

**Behaviour.** `AGENTS.md` names Cursor Agent CLI as a supported harness. Hand-composed argv carries `--force`. The headless-forbid sentence lists `cursor-agent -p`/`--print`. Launch notes: interactive `cursor-agent`, pin `--model` from the block unless `default`, omit effort flags, no `-w`/`--worktree`. Kiro's existing two-step paragraph stays. Claude/Codex/Grok/agy permission flags stay.

**Direction.** Edit prose **outside** the managed-block markers. Do not rewrite the `implement`/`review` rows.

**Files.** `AGENTS.md`.

**Focused verification.** `tests/contracts.sh` greps `--force` among hand-composed permission defaults **and** still greps the existing three flags, and verbatim-matches the updated dispatch sentence. An `AGENTS.md` that adds Cursor to the intro list but still omits `cursor-agent -p`/`--print` from the forbid sentence must fail. Naming `--yolo` or `--trust` instead of `--force` as the permission default must fail.

**Document impact.** `AGENTS.md` owns this repository's dispatch notes.

### 4. Public install is native Cursor, one path

**Behaviour.** README lists Cursor Agent CLI, documents `cursor-agent plugin marketplace add` plus `/add-plugin dely` (not `npx skills`, not manual copy, not PATH `agent`), and records checked CLI version `2026.08.25-3e8eec8`. Cache-refresh groups Cursor with the plugin-copy harnesses, not Kiro's shared store. The Kiro `npx skills` section is untouched. Bug-report dropdown offers the exact label `Cursor Agent CLI`. Both versioned manifests are `0.15.0`.

**Direction.** Mirror Superpowers' Cursor section: in-session `/add-plugin`, plus the verifiable CLI marketplace add.

**Files.** `README.md`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`.

**Focused verification.** `tests/contracts.sh` Cursor README section requires `plugin marketplace add`, `/add-plugin`, `/delivery`, `/setup`; rejects manual-copy wording; rejects documenting `npx skills` as the Cursor install. Kiro section still has its `npx skills` needles. Bug-form loop includes `Cursor Agent CLI`. Manifest versions both `0.15.0`.

**Document impact.** `README.md` owns the user path; the bug form owns the human report vocabulary; the two manifests own the public version.

### 5. Structural checks cover Cursor and stay ≤ 250 lines

**Behaviour.** `tests/contracts.sh` enforces tasks 1–4 and still satisfies `test "$(wc -l < tests/contracts.sh)" -le 250`. Kiro (`npx skills`) and Cursor (native sidecar + `/add-plugin`) share helpers where the shape matches (dropdown names, discovery-subsection verbatim, README-section extract) and keep distinct needles for the two install families.

**Direction.** Refactor first if needed so the new assertions fit. Keep the 250-line gate. Observe each named counterexample red on a fixture copy before relying on the new assertion. Do not change the workflow except the existing `jq -e .` run-line's file list.

**Files.** `tests/contracts.sh`. AGENTS.md / `.github/workflows/contracts.yml` only for that jq line (if not already done in task 1).

**Focused verification.** `bash tests/contracts.sh` green on the candidate. `wc -l` ≤ 250. Against a fixture root whose README Cursor section says `npx skills add` or to copy skills manually, the script exits non-zero. Against a fixture whose sidecar omits `skills`, the script exits non-zero. Against a fixture whose `contracts.sh` is 251 lines, the wc gate fails. A Kiro README missing `npx skills add` still fails.

**Document impact.** `tests/contracts.sh` owns the structural public invariants.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Cursor sidecar shares `./skills/`, no third version | `tests/contracts.sh` on `.cursor-plugin/plugin.json` | `"skills": "./.cursor/skills/"` or a `"version"` field while README claims support | `bash tests/contracts.sh /tmp/fix-r5a` → `FAIL: .cursor-plugin/plugin.json .skills must be ./skills/ (got ./.cursor/skills/)` line 74; `bash tests/contracts.sh /tmp/fix-r5b` → `FAIL: .cursor-plugin/plugin.json must not have a version field` line 75 |
| Root Antigravity/Grok manifest unchanged; no extra keys | `tests/contracts.sh` root key check `[keys[]] | sort == ["description","name"]` | `plugin.json` gains `$schema` or any extra key | `bash tests/contracts.sh /tmp/fix-r1` → `FAIL: /tmp/fix-r1/plugin.json must have exactly keys name and description (no $schema or extra keys)` line 29 |
| Setup discovers Cursor from live `cursor-agent models`, Effort `default` | verbatim `### Cursor Agent CLI` subsection | hardcoded slugs or copied `low\|medium\|high` as Cursor effort | `bash tests/contracts.sh /tmp/fix-r5i` → `FAIL: skills/setup/SKILL.md ### Cursor Agent CLI Discovery subsection no longer matches the approved policy verbatim` line 124 |
| Kiro discovery policy unchanged | existing verbatim Kiro subsection | Cursor edit rewrites the Kiro subsection but it still "mentions Kiro" | `bash tests/contracts.sh /tmp/fix-r2a` → `FAIL: /tmp/fix-r2a/skills/setup/SKILL.md ### Kiro CLI Discovery subsection no longer matches the approved policy verbatim` line 121 |
| README Cursor path is marketplace add + `/add-plugin`, not `npx skills` or manual copy | Cursor README section needles + reject `npx skills`; reject manual-copy wording | Cursor section says `npx skills add … --agent cursor`; or says "copy the skills manually" but has the marketplace needle | `bash tests/contracts.sh /tmp/fix-r5c` → `FAIL: README.md Cursor Agent CLI section must not document npx skills` line 139; `bash tests/contracts.sh /tmp/fix-r3` → `FAIL: README.md Cursor Agent CLI section instructs manual copying instead of plugin marketplace add` line 140 |
| Kiro README path remains `npx skills` | existing Kiro README needles | Cursor work deletes or genericizes the Kiro section | `bash tests/contracts.sh /tmp/fix-r5h` → `FAIL: README.md is missing a ### Kiro CLI section` and 9 missing-needle FAILs lines 132–137 |
| Bug form offers exact `Cursor Agent CLI` | harness dropdown loop | option `Cursor` or `cursor-agent` | `bash tests/contracts.sh /tmp/fix-r2b` → `FAIL: bug_report.yml harness dropdown is missing: Cursor Agent CLI` line 180 |
| Headless `cursor-agent -p`/`--print` is forbidden | verbatim AGENTS.md dispatch sentence | intro lists Cursor; forbid list is the pre-change sentence | `bash tests/contracts.sh /tmp/fix-r5d` → `FAIL: AGENTS.md headless-forbidden dispatch sentence no longer matches the approved policy verbatim` line 127 |
| Permission default is `--force`; other harness flags remain | grep includes `--force` and the existing three flags | replaces `--dangerously-skip-permissions` with `--force`, or names `--yolo`/`--trust` | `bash tests/contracts.sh /tmp/fix-r5e` → `FAIL: AGENTS.md does not name a permission default for each hand-composed-argv harness` line 66 |
| Versioned manifests are both `0.15.0` | existing version equality check, updated to `0.15.0` | only Codex left at `0.14.1` | `bash tests/contracts.sh /tmp/fix-r2c` → `FAIL: manifest versions must both be 0.15.0 (claude=0.15.0 codex=0.14.1)` line 24 |
| `tests/contracts.sh` stays ≤ 250 lines | existing `wc -l` closure gate | new Cursor checks pasted as a second Kiro block at 251+ lines | `test "$(wc -l < /tmp/fix-r5f/tests/contracts.sh)" -le 250` → FAIL: wc -l is 252 > 250 |

Design fills Counterexample; implement fills Observed red by running the instrument against a present-but-wrong fixture and citing the FAIL line.

**Cannot be observed:** live `/add-plugin dely` (interactive; mutates user plugin cache); official Marketplace search; live TUI whether `--force` on argv is fatal; Orca `--agent cursor --model` pinning; PATH `agent` collision on machines without Grok. Optional Control probe after the sidecar exists: `cursor-agent plugin marketplace update dely` on the already-added marketplace, only if the human allows that reindex.

## Stop conditions

- Implementer rewrites managed-block pin rows → `NEEDS_REPLAN`.
- After sidecar exists, human-approved `cursor-agent plugin marketplace update dely` still indexes 0 → `NEEDS_REPLAN` for marketplace.json.
- `agy plugin validate .` or `grok plugin validate .` or `claude plugin validate .` fails on the candidate → `NEEDS_REPLAN`; do not "fix" by editing root `plugin.json` extra fields.
- Live `cursor-agent --force` TUI opens a confirmation whose default exits the session → `NEEDS_REPLAN`.
- Orca cannot launch an interactive `cursor-agent` TUI → stop; no headless fallback.
- Work needs skill copies, root Agent Plugins fields, Cursor hooks, `npx skills` as a documented Cursor path, or a harness name in `skills/delivery/SKILL.md` → `NEEDS_REPLAN`.

## Closure gates

From the repository root:

```
git diff --check
bash -n tests/contracts.sh
jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .cursor-plugin/plugin.json >/dev/null
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
```

Plus focused fixture observations named in Acceptance, from a temp copy via `bash tests/contracts.sh <fixture-root>`. Focused existing-harness validators (`agy plugin validate .`, `grok plugin validate .`, `claude plugin validate .`) run on the candidate as additional instruments, not new AGENTS.md gates.
