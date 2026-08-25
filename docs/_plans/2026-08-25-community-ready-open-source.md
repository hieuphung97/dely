# Plan — make Dely community-ready without adding a second documentation system

Decision record: `docs/decisions.md`

**Baseline:** `0a04ad5f0c59fef1261e987457f6d05261ed850a`

## Goal

Dely 0.13.0 ships a canonical MIT grant, a self-service install and ordinary-use
path, a human contribution and security contract, and one automated repository
gate. GitHub Free protects `main` with that gate and accepts private vulnerability
reports, while external contributors remain free to use a normal fork and pull
request without installing Dely or Orca.

## Allowed scope

```text
.claude-plugin/plugin.json
.codex-plugin/plugin.json
.github/ISSUE_TEMPLATE/bug_report.yml
.github/ISSUE_TEMPLATE/feature_request.yml
.github/pull_request_template.md
.github/workflows/contracts.yml
AGENTS.md
CODE_OF_CONDUCT.md
CONTRIBUTING.md
LICENSE
README.md
SECURITY.md
docs/decisions.md
docs/_plans/2026-08-25-community-ready-open-source.md
tests/contracts.sh
```

The colocated and registry-test search found one owner: `tests/contracts.sh` is
the structural package test and is updated by each task for the public invariant
that task adds. `README.md`, `AGENTS.md`, and `docs/decisions.md` are the owning
documents; the decision is already reconciled. No other colocated test,
generated registry, or owning document exists.

## Forbidden scope

- `skills/delivery/**` and `skills/setup/**`: the runtime protocol does not
  change.
- `.claude-plugin/marketplace.json`: it has no version field and its source and
  description remain correct.
- `CLAUDE.md`: its one-line import remains correct.
- A support forum, `SUPPORT.md`, `CODEOWNERS`, governance, funding, roadmap,
  changelog, CLA, DCO, code scanning, or paid GitHub feature: each is an explicit
  non-goal of the approved decision.
- Plugin caches and live worker hook wiring: this delivery uses the frozen
  installed Dely version and does not refresh them between tasks.

## Execution envelope

Protected dirty paths: none; the tree was clean at baseline.

Branch, base, remote, and pull-request target:
`community-ready-open-source` from
`7f34a67b0f7fb2a628029d47b06ecd9d2f4fa711`, pushing to `origin` and opening a
pull request against `main`.

Resolved phase pins:

| Phase | Harness | Model | Effort | Sandbox |
| --- | --- | --- | --- | --- |
| `implement` | Claude Code | `sonnet` | `medium` | project default; no phase-added sandbox |
| `review` | Codex CLI | `gpt-5.6-sol` | `high` | project default; no phase-added sandbox |

Authority: this plan may commit only the allowed paths, run local and remote
checks, push the named branch, open or update its draft pull request, enable
private vulnerability reporting, and create one active default-branch ruleset
after the `contracts` check has succeeded. It may not merge, publish a release
or tag, force-push, stash, reset, clean, change repository visibility, buy a
GitHub plan, or edit anything outside allowed scope.

The ruleset targets the default branch, requires a pull request with zero
approving reviews, requires the unique `contracts` status check and resolved
conversations, and rejects deletion and non-fast-forward updates. Control owns
those two forge mutations during release; implementers only prepare and verify
the candidate artifacts.

## Tasks

### 1. Contributors receive an actionable and safe collaboration contract

**Behaviour.** GitHub can surface contribution, conduct, security, bug, feature,
and pull-request guidance at the interaction where it is needed. A normal
external contributor can follow the repository gates without installing Dely or
Orca, and private reports have a non-public route.

**Direction.** Write the shortest complete human contribution path. Adopt the
official Contributor Covenant 2.1 text with `contact@hieuphung97.com` as the
enforcement contact. Support only the latest Dely release in `SECURITY.md`, make
GitHub private vulnerability reporting primary and the same email the fallback,
and explicitly reject public vulnerability issues. Use two valid GitHub issue
forms and one small pull-request template; do not copy the Dely handoff or design
templates into them. Extend the structural test with exact file and required-key
checks plus a fixture proving a syntactically valid issue form without
`description` is rejected.

**Files.** `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
`.github/ISSUE_TEMPLATE/bug_report.yml`,
`.github/ISSUE_TEMPLATE/feature_request.yml`,
`.github/pull_request_template.md`, `tests/contracts.sh`, and this plan's
Observed-red cells.

**Focused verification.** Run `bash tests/contracts.sh`. Parse both issue forms
with Ruby's standard YAML library and require top-level `name`, `description`,
and `body`:

```bash
ruby -e 'require "yaml"; ARGV.each { |f| d = YAML.safe_load_file(f); missing = %w[name description body].reject { |k| d.key?(k) }; abort "#{f}: missing #{missing.join(",")}" unless missing.empty? }' .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml
rg -n 'contact@hieuphung97\.com' CODE_OF_CONDUCT.md SECURITY.md
```

**Document impact.** `README.md` will link these surfaces in Task 2.
`AGENTS.md` will name their ownership and the automated gate in Task 3.
`docs/decisions.md` already owns the approved rationale.

### 2. Users receive a licensed, versioned, self-service Dely package

**Behaviour.** A new user can identify supported prerequisites, install and
preflight Orca, install Dely in one supported harness, verify it, use it, update
or remove it, and troubleshoot the documented failure boundaries. The package
contains the canonical MIT grant and both manifests report 0.13.0.

**Direction.** Add the canonical MIT text with copyright `2026 Hieu Phung`.
Keep one README path from requirements to ordinary use, link the official Orca
install documentation at `https://www.onorca.dev/docs/install`, and name the
checked local versions without promising them as permanent minimums. Document
the verified Claude, Codex, and Grok install, update, and uninstall surfaces;
distinguish default-branch tracking from a ref where supported. State the
clean-profile limitation from the decision instead of claiming an install that
was not isolated. Bump only the two versioned manifests and their structural
test. Use the canonical-license comparison to reject a one-word `LICENSE`; use
the live Codex command surface, not a prose grep, to reject the plausible but
unsupported `codex plugin install` README command.

**Files.** `LICENSE`, `README.md`, `.claude-plugin/plugin.json`,
`.codex-plugin/plugin.json`, `tests/contracts.sh`, and this plan's Observed-red
cells.

**Focused verification.** Run:

```bash
diff -u <(gh api licenses/mit --jq .body | sed 's/\[year\]/2026/; s/\[fullname\]/Hieu Phung/') LICENSE
jq -e '.version == "0.13.0"' .claude-plugin/plugin.json .codex-plugin/plugin.json >/dev/null
claude plugin validate .
grok plugin validate .
bash tests/contracts.sh
```

Re-run the documented command `--help` surfaces without installing, updating,
or removing a live plugin:

```bash
claude plugin marketplace add --help
claude plugin install --help
claude plugin update --help
claude plugin uninstall --help
codex plugin marketplace add --help
codex plugin marketplace upgrade --help
codex plugin add --help
codex plugin remove --help
grok plugin install --help
grok plugin update --help
grok plugin uninstall --help
orca status --json
test "$(git ls-remote https://github.com/hieuphung97/dely.git HEAD | wc -l)" -eq 1
```

**Document impact.** `README.md` becomes the user owner and links the community
files from Task 1. The existing decision already records the package-version and
compatibility rationale. No runtime skill text changes.

### 3. Every pull request receives one enforceable repository contract

**Behaviour.** GitHub Actions runs all repository closure gates under one unique
`contracts` job on pull requests and `main`. The repository instructions name
the community owners and keep the same local commands. The structural test
rejects a workflow that exists but calls the wrong contract entry point.

**Direction.** Add one dependency-free `ubuntu-latest` workflow with read-only
contents permission. Use only GitHub's `actions/checkout`; add no other action.
Run the closure commands already owned by `AGENTS.md`; do not invent a second CI script.
Extend `tests/contracts.sh` only for structural public invariants, keep it below
250 lines, and prove a fixture whose workflow calls `tests/missing.sh` fails for
that reason. Reconcile `AGENTS.md` with the community source files and CI owner;
keep developer setup concise. Control later pushes the draft PR, waits for the
exact-HEAD `contracts` check, then enables and verifies the approved ruleset and
private vulnerability reporting before integration review.

**Files.** `.github/workflows/contracts.yml`, `AGENTS.md`,
`tests/contracts.sh`, and this plan's Observed-red cells.

**Focused verification.** Parse the workflow as YAML, run every closure gate
locally, then require the remote `contracts` check to succeed on the exact
pull-request HEAD. Verify forge state with:

```bash
ruby -e 'require "yaml"; YAML.safe_load_file(ARGV.fetch(0))' .github/workflows/contracts.yml
gh api repos/hieuphung97/dely/private-vulnerability-reporting | jq -e '.enabled == true'
ruleset_id="$(gh api repos/hieuphung97/dely/rulesets --jq '.[] | select(.name == "Protect main") | .id')"
gh api "repos/hieuphung97/dely/rulesets/$ruleset_id" | jq -e '
  .enforcement == "active" and
  any(.rules[]; .type == "pull_request" and .parameters.required_approving_review_count == 0) and
  any(.rules[]; .type == "required_status_checks" and any(.parameters.required_status_checks[]; .context == "contracts")) and
  any(.rules[]; .type == "required_conversation_resolution") and
  any(.rules[]; .type == "deletion") and
  any(.rules[]; .type == "non_fast_forward")'
```

**Document impact.** `AGENTS.md` owns local closure commands and contributor
document ownership. `README.md` owns the user-facing CI badge and links. The
decision owns why forge state is verified rather than represented in Git.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| GitHub-recognized community policies and forms | `bash tests/contracts.sh`, Ruby YAML parse, and post-merge community profile | A valid issue form has `name` and `body` but no `description`, so GitHub will not recognize it | |
| Canonical MIT grant and synchronized 0.13.0 manifests | Canonical-license `diff`, `jq`, and GitHub license detection on the pushed ref | `LICENSE` exists but contains only the word `MIT` | |
| Verified self-service README path | Harness `--help` surfaces, both validators, and remote-ref probe | README uses plausible `codex plugin install`; `codex plugin install --help` exits non-zero because the current CLI does not expose it | |
| One exact CI entry point and green exact-HEAD check | Workflow parse, fixture contract test, local gates, and pull-request check run | Workflow exists but calls `bash tests/missing.sh` | |
| Solo-maintainer-safe protected branch | GitHub ruleset API assertion | Ruleset exists but requires one approval or omits `contracts` | |
| Private vulnerability intake | GitHub private-vulnerability-reporting API assertion | `SECURITY.md` names private reporting while the forge setting remains disabled | |

Design fills Counterexample; implement fills Observed red. An empty cell is an
unfinished row. The fixtures must exercise present, parseable artifacts that are
wrong, not merely absent files.

**Cannot be observed:** Local checks cannot prove GitHub's post-merge community
profile, issue-form rendering, or license badge before the candidate reaches the
default branch. They also cannot prove a clean install where a harness lacks a
safe disposable configuration root. Release reports those boundaries; the human
merge gate owns the post-merge profile check.

## Stop conditions

Return `BLOCKED` or `NEEDS_REPLAN` if the official MIT or Contributor Covenant
text conflicts with the approved attribution; a documented CLI command is not
present on the checked command surface; Orca's official installation URL cannot
be verified; a required community artifact needs an unapproved contact or
policy; the workflow check context is not uniquely `contracts`; GitHub Free
rejects private vulnerability reporting or the approved ruleset; the contract
test would exceed 250 lines; a runtime skill must change; or any required edit
falls outside allowed scope.

## Closure gates

Run from `/Users/hieuphung/Projects/dely`:

```bash
git diff --check
bash -n tests/contracts.sh
jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json >/dev/null
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

Also run the focused commands in each task. After push, require the GitHub
Actions `contracts` check on exact HEAD and the two forge-state API assertions.
Report the exact command, summary, and exit code for every gate. Post-merge,
verify GitHub's community profile and license detection before publishing the
0.13.0 release.
