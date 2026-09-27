# Plan — OMP is a supported harness with a spec-carried model pin

Decision record: `docs/decisions.md`, section "2026-09-27 — OMP is a supported
harness, and its model pin travels in the spec".

**Baseline:**

## Goal

A project can pin OMP (Orca agent id `omp`) for `implement` or `review` with a
model selector and a thinking level, and Dely's helper carries that pin to the
worker as a `dely-pin:` spec line that a shipped OMP extension applies before
the first model request. A pin OMP cannot resolve stops the worker before its
first request, visible as `NO_ACK`. OMP can be Control by waker. Every other
harness behaves exactly as in 0.20.1. Out of reach: detecting a dead OMP
worker sooner than `STALLED`, background-wake OMP Control, and installing OMP
from a git URL.

## Allowed scope

```
harnesses.json
package.json                      (new, repository root)
omp/dely-pin.ts                   (new)
skills/delivery/scripts/dely.js
skills/delivery/SKILL.md
skills/setup/SKILL.md
.claude-plugin/plugin.json        (version only)
.codex-plugin/plugin.json         (version only)
AGENTS.md                         (version gate lines only)
README.md
probe/checklist.md
docs/decisions.md                 (Control only)
docs/_plans/omp-harness.md        (Control only; deleted before the release-binding review)
```

Listed by hand from the approved design contract. Carried without being
listed: none. This repository has no test suite and no registry test
(`AGENTS.md`, "Source of truth"), so no colocated test exists for any allowed
file. `plugin.json` at the root, `.claude-plugin/marketplace.json` and
`.cursor-plugin/plugin.json` carry no version string (checked with
`jq -r '.version // "none"' plugin.json .claude-plugin/marketplace.json .cursor-plugin/plugin.json`
on this baseline) and are not touched.

## Forbidden scope

- `probe/trust.sh`, `probe/mkrepo.sh`: they refuse to act for any harness but
  Claude Code by design; OMP shows no trust dialog, so nothing there changes.
- `skills/delivery/templates/`: the protocol's templates do not name harnesses.
- `.cursor-plugin/`, `.claude-plugin/marketplace.json`, root `plugin.json`:
  OMP does not install through them (decision record), and they carry no
  version.
- `CONTRIBUTING.md`, `SECURITY.md`, `.github/`: no harness-specific content.
- Any `.omp/` directory or file inside a user project: the decision rejects
  pinning through one.

## Execution envelope

Protected dirty paths: none. The tree was clean at baseline after the owner's
pending `AGENTS.md` pin change was committed separately, at their request, as
`a45a86a`.

Branch, base, remote, and pull-request target: `feat/omp-harness`, based on
`main` at `ce7a29c`, remote `origin`, pull request into `main`.

Resolved phase pins, from `AGENTS.md` and checked against the live harness
surface on 2026-09-27 (`cursor-agent models` lists `cursor-grok-4.6-high`;
`codex debug models` lists `gpt-5.6-sol` with visibility `list` and `high`
among its levels):

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | Cursor Agent CLI | cursor-grok-4.6-high | default |
| `review` | Codex CLI | gpt-5.6-sol | high |

Authority: this plan may branch, commit only its own owned paths, run gates,
push `feat/omp-harness`, and open or update its pull request into `main`. It
may not merge, force-push, stash, reset, clean, or edit anything outside owned
scope.

## Tasks

### 1. The helper carries an OMP pin in the spec and the shipped extension applies it

**Behaviour.** With an `AGENTS.md` pin whose harness entry has
`modelPin: "spec"`:

- Model not `default`, Effort `default`: the spec passed to `worker-start`
  ends with the line `dely-pin: <model>`.
- Model and Effort both not `default`: the line is
  `dely-pin: <model>:<effort>`.
- Model `default`, Effort `default`: no `dely-pin:` line.
- Model `default`, Effort not `default`: `dely dispatch` refuses before any
  `worker-start`, naming the harness and saying effort requires a model.

No `--model` or `--effort` is passed for such a harness. For every harness
without `modelPin`, the argv and the spec are byte-for-byte what 0.20.1
produced. The pin line is a spec line, so it also reaches `dely preflight`'s
launches when preflight dispatches the pin.

`omp/dely-pin.ts` exports the default extension factory OMP loads. On the
session's first `before_agent_start` only, it looks for a line matching
`^dely-pin:\s*(\S+)\s*$` (multiline). It splits an optional `:<level>`
suffix off the last `:` that follows the first `/`. It finds the model among
`ctx.modelRegistry.getAvailable()` by exact `provider + "/" + id`, calls
`pi.setModel`, and, when a level was given, `pi.setThinkingLevel`. When the
model is not offered, `setModel` returns false, or the level is not one of
that model's thinking levels, it writes one line beginning `DELY-PIN-FAIL`
naming the selector to stderr and calls `process.exit` with a non-zero code.
Without a matching line, or after the first agent start, it does nothing.

`harnesses.json` gains the `omp` entry the decision record states, including
`modelPin: "spec"` and `discovery` with `models: "omp models --json"`,
`modelField: "selector"`, `effortFrom: "thinking"`, and `notes` carrying the
measured facts. A root `package.json` declares
`{"name": "dely", "version": "0.21.0", "private": true, "omp": {"extensions": ["./omp/dely-pin.ts"], "skills": ["./skills"]}}`.

`skills/delivery/SKILL.md`, paragraph "Name the model and effort on every
dispatch", says that a harness whose entry names `modelPin: spec` receives
its pin as a spec line instead of flags, and that a pin such a harness cannot
resolve stops the worker before its first request and surfaces as `NO_ACK`.
`skills/setup/SKILL.md`, section "Discovery", says that when
`discovery.modelField` is set, each model's value is that field rather than
`slug`. Both manifests, `package.json` and the `AGENTS.md` version gate move
to `0.21.0`.

**Direction.** In `dely.js`, carry `modelPin` out of `pin()` next to
`modelFlag`, and make `start()` (or the caller that builds the spec) append
the line. Reuse the existing refusal wording shape of the
`effortRequiresModel` check. Do not branch on the harness id. Keep the
extension dependency-free: it runs inside OMP, and a stand-alone check runs it
under Node 26 with type stripping.

**Files.** `skills/delivery/scripts/dely.js`, `omp/dely-pin.ts`,
`package.json`, `harnesses.json`, `skills/delivery/SKILL.md`,
`skills/setup/SKILL.md`, `.claude-plugin/plugin.json`,
`.codex-plugin/plugin.json`, `AGENTS.md`.

**Focused verification.**

- Helper: run `skills/delivery/scripts/dely dispatch` against a scratch
  repository under `~/dely-probe/` whose `AGENTS.md` pins OMP, with
  `ORCA_CLI_COMMAND` pointing at a stub that records its argv and returns a
  `worker-start` receipt. Assert the recorded `--spec` for the four Model and
  Effort combinations above, and that a Claude Code pin still produces
  `--model` and no `dely-pin:` line.
- Extension: a Node 26 script imports `omp/dely-pin.ts` with a fake `pi`
  (recording `on`, `setModel`, `setThinkingLevel`) and a fake registry, and
  asserts: a valid pin calls both setters once; a second start is ignored; no
  line means no call; an unknown selector or a level the model does not offer
  exits non-zero after writing a `DELY-PIN-FAIL` line.

**Document impact.** `skills/delivery/SKILL.md` and `skills/setup/SKILL.md`
own the protocol text the helper and discovery implement; `AGENTS.md` owns the
version gate the manifests must match.

### 2. OMP users can install Dely, and the live checklist covers OMP

**Behaviour.** `README.md` names OMP among the harnesses supported today,
keeping the list open-ended, and has an OMP install section: clone or
snapshot the repository, `omp plugin install <path>`, verify with
`omp plugin list --json` and `omp skill list`, update with `git pull` in that
checkout and a new OMP session, and uninstall with `omp plugin uninstall dely`,
which needs `bun` on PATH. It states that the `dely` marketplace does not
install OMP's extension. It records how to pin OMP: Model is an
`omp models --json` `selector`, Effort one of that model's `thinking` levels,
and no `.omp/config.yml` is needed. The Checked versions table gains OMP
`18.3.3` and Orca `1.4.212`.

`probe/checklist.md` gains: OMP in the Input list; an OMP install step from
the snapshot with its hash check at the linked path; and rows that run OMP as
a worker with a valid pin (first request on the pinned model), with an
invalid pin (`NO_ACK` quoting `DELY-PIN-FAIL`), with Model `default` (no pin
line), and OMP as Control through `dely wait-bg` (and `dely wait --control omp`
refused). Each row names the observation that distinguishes pass from fail.

**Direction.** Follow the existing Cursor and Codex install sections' shape
and the checklist's existing row format. Do not add a trust step for OMP:
`trust` is `none`.

**Files.** `README.md`, `probe/checklist.md`.

**Focused verification.** A human reads the diff against the decision record;
`git diff --check` and the disclosure greps in `AGENTS.md` pass.

**Document impact.** `README.md` owns install guidance; `probe/checklist.md`
owns live verification.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| A valid OMP pin is in effect from the first request | Checklist row: `dely dispatch` with OMP pinned to a selector and level different from OMP's configured default; the worker session's first `model_change` and first assistant message, and `worker-show` `projection.provider.model` before release | Helper appends the line but the installed package does not load the extension: the first request runs OMP's default model | |
| An unresolvable pin stops the worker before any request | Checklist row with a selector OMP does not offer: `dely dispatch` prints `NO_ACK` whose quote contains `DELY-PIN-FAIL`; no assistant message in that session | Extension throws or calls `ctx.shutdown()`: the worker acknowledges and completes on the default model | |
| Model `default` writes no pin line | Stub-`orca` helper check, and checklist row reading the worker transcript's first user message | Helper writes `dely-pin: default` | |
| Effort without a model is refused | Stub-`orca` helper check: exit non-zero and no `worker-start` recorded | Helper appends `:<effort>` to an empty selector or dispatches unpinned | |
| The extension acts once, on the first start, only on the marker | Node fake-`pi` check; checklist row sending a second prompt with a `dely-pin:` line to an interactive OMP session and reading its model | Extension applies the pin on every `before_agent_start` | |
| Other harnesses are unchanged | Stub-`orca` check for a Claude Code pin: `--model` present, no `dely-pin:` line, spec otherwise identical to 0.20.1 output for the same input | Helper appends the pin line for every harness | |
| OMP installs skills and extension in one step | Checklist install step: `omp plugin install <snapshot>`, `omp skill list` shows `delivery` and `setup`, SHA-256 of `SKILL.md` and `dely.js` at the linked path equals the snapshot's | `package.json` points `skills` or `extensions` at a wrong path | |
| Setup offers OMP selectors and thinking levels | Human reads `skills/setup/SKILL.md` against `omp models --json` output | Setup offers `id` without the provider, which the extension then rejects | none: a human reads the diff |
| OMP Control wakes by waker | Checklist row: OMP Control runs `dely wait-bg` to `SETTLED`; `dely wait --control omp` prints `REFUSED` | Entry says `background`, and `dely wait` runs as a job killed at 3600 s | |
| Version is one string everywhere | `AGENTS.md` version gate, plus `jq -r .version package.json` | `package.json` left at another version | |

**Cannot be observed:** installing from a git URL or uninstalling (`bun` is
absent on the verification machine); how soon a dead OMP worker is detected
beyond reading the helper; OMP versions other than 18.3.3 and Orca builds
other than 1.4.212.

## Stop conditions

- OMP does not load `omp.extensions` or `omp.skills` from the root
  `package.json` of a `git archive` snapshot: `NEEDS_REPLAN`.
- `before_agent_start` no longer runs before the first request, or `setModel`
  is not on the extension API, in the installed OMP: `BLOCKED`.
- Making the helper change requires branching on a harness id rather than a
  `harnesses.json` field: `NEEDS_REPLAN`.
- Any facts above hold only for OMP 18.3.3 on Orca 1.4.212; a different
  installed version is recorded, not assumed equivalent.

## Closure gates

From the repository root, as `AGENTS.md` lists them, with the version gate at
`0.21.0`, plus:

```bash
jq -e . package.json >/dev/null
test "$(jq -r .version package.json)" = 0.21.0
```
