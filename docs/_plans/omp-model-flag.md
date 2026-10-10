# Plan — OMP is pinned by Orca's `--model` flag; the `spec` pin mode is deleted

Decision record: `docs/decisions.md`, section "2026-10-10 — OMP is pinned by
Orca's `--model` flag, with the effort joined to the model; the `spec` pin
mode is deleted".

**Baseline:**

## Goal

On Orca 1.4.224 or newer, a pinned OMP worker is launched with
`--model <selector>[:<level>]` composed by the helper from the Model and Effort
cells, with no `dely-pin:` spec line and no Dely install in OMP. The `spec`
value of `modelPin` and its post-acknowledgement check no longer exist. Pi
keeps `spec-unchecked` and the extension. Out of reach: OMP's missing status
in Orca (the false `ATTENTION` stays), OMP effort by flag, and the silent
Effort drop on Cursor and Antigravity.

## Allowed scope

```
harnesses.json
skills/delivery/scripts/dely.js
skills/delivery/SKILL.md
skills/setup/SKILL.md
README.md
probe/checklist.md
AGENTS.md
.claude-plugin/plugin.json
.codex-plugin/plugin.json
package.json
```

Produced by `git grep -lnE "dely-pin|modelPin|install Dely in OMP|DELY_PIN_CHECK" -- . ':!docs/decisions.md'`
(output: `AGENTS.md README.md extensions/dely-pin.ts harnesses.json
package.json probe/checklist.md skills/delivery/SKILL.md
skills/delivery/scripts/dely.js skills/setup/SKILL.md`) and
`git grep -n "0\.25\.0" -- . ':!docs/decisions.md'` (the two plugin manifests,
`package.json`, `AGENTS.md`). `extensions/dely-pin.ts` is forbidden (below).
There is no test suite, so no colocated tests apply. Owning documents: README
(role row, install text, checked versions) and `probe/checklist.md` own the
changed behaviour; both are listed.

## Forbidden scope

- `docs/decisions.md` and this plan: Control owns them.
- `extensions/dely-pin.ts`: Pi still uses it unchanged; OMP no longer
  receives a `dely-pin:` line, so the extension needs no edit.
- `package.json`'s `pi` key: Pi needs it, and OMP reads it for its Control
  install; only `version` changes.
- Every other `harnesses.json` entry, including `pi`.
- `probe/mkrepo.sh`, `probe/trust.sh`: they write pins and trust, which do
  not change.

## Execution envelope

Protected dirty paths: none; the tree was clean at `eaa011e` before this plan.

Branch, base, remote, and pull-request target: `feat/omp-model-flag` from
`main` at `eaa011e`, remote `origin` (github.com/hieuphung97/dely), pull
request into `main`.

Resolved phase pins (`dely pins --repo .`): implement Claude Code
`claude-sonnet-5-5` `medium`, source `team`; review Codex CLI `gpt-6.1-sol`
`high`, source `team`; both from `.dely/pins.json`.

Authority: this plan may branch, commit only its own owned paths, run gates,
push `feat/omp-model-flag`, and open or update its pull request. It may not
merge, force-push, stash, reset, clean, or edit anything outside owned scope.

## Tasks

### 1. A pinned OMP worker launches with `--model selector[:level]`, and the `spec` mode is gone

**Behaviour.** For a harness whose entry has `effortInModel` and
`modelFlag: true`, `dely dispatch` and `dely preflight` pass
`--model <model><effortInModel><effort>` when Effort is pinned and
`--model <model>` when Effort is `default`; they pass no `--effort` and add
no `dely-pin:` line. Model `default` with a pinned Effort is refused before
any `worker-start`, with the existing message. The `omp` entry uses this. No
code path reads `modelPin: "spec"`, and the closure gate rejects it. Pi's
launch is unchanged.

**Direction.**

- `harnesses.json` `omp`: `modelFlag: true`, `effortInModel: ":"`, drop
  `modelPin`. `limits`: keep the trust sentence; the worker sentence names
  Orca 1.4.224 or newer and keeps "Dely reports a working OMP worker as
  needing attention" with stablyai/orca#24436; delete the sentence about
  installing Dely in OMP to pin a model. `notes`: say the pin travels as
  `--model selector:level`, that Orca reports no model so dispatch does not
  check it, how an unknown selector and a bad level fail (decision Context),
  and end with the decision sections list plus `2026-10-10`.
- `dely.js`: carry `effortInModel` into the resolved pin; compose the model
  value in `start()`; delete `PIN_CHECK_DEFAULT_S`, `pinCheckMs`,
  `shownModel`, `waitShownModel`, and the `p.modelPin === "spec"` branch in
  `dispatch()`; `specPin` tests only `spec-unchecked`.
- `AGENTS.md`: gate 3 accepts `modelPin` absent or `spec-unchecked`, and
  `effortInModel` absent or a non-empty string on an entry with
  `modelFlag: true` and `effortFlag: false` and no `modelPin`; add
  `shownModel|waitShownModel|pinCheckMs|PIN_CHECK|pin_not_applied` to the
  identifier grep; version gate 0.26.0.
- `skills/delivery/SKILL.md` "Name the model and effort on every dispatch":
  describe `effortInModel`; `spec-unchecked` receives the pin as a spec line
  and the helper never verifies the reported model; remove `spec`.
- `skills/setup/SKILL.md`: offer models and effort levels for an
  `effortInModel` entry as for a flag harness; remove `spec`.
- `README.md`: regenerate the OMP role row from `harnesses.json` (the
  role-table gate's jq prints it); "A pinned OMP or Pi worker also needs that
  harness's Dely install" names Pi only; the OMP install block's
  `# verify dely-pin.ts` comment no longer implies workers need it; checked
  versions add Orca 1.4.224 (OMP and Pi worker), OMP 18.6.1 (worker), Pi
  1.0.2.
- `probe/checklist.md`:
  - argv stub: `pinOf` and the `effort` mode list treat `effortInModel` as an
    effort capability; add candidate-only assertions that an `effortInModel`
    entry's pinned launch carries `--model pin-model<sep>high` and no
    `--effort`, its Effort-`default` launch carries `--model pin-model`, and
    a `modelPin` entry's spec carries `dely-pin: pin-model high` and no
    `--model`; drop the fake `worker-show` model and `DELY_PIN_CHECK_S`.
  - rows 8–10 rewritten for the flag: row 8 checks the receipt's
    `launch.effective.model` equals `selector:level` and the session log's
    model and level; row 9 (unknown selector) passes on `NO_ACK` with no
    assistant message; row 10 (Model `default`) passes when the
    `worker-start` argv has no `--model` and the first user message has no
    `dely-pin:` line.
  - new row 12: OMP with a level the model does not offer
    (`selector:bogus`) passes on `NO_ACK` or `FAILED` and no assistant
    message.
  - the floor names rows 8–10 and 12 for a change to `start()` or the `omp`
    entry; row 11 stays tied to the extension.
  - "What this cannot see": Pi versions include 1.0.2; replace the sentence
    claiming an Orca upgrade reruns only deployment harnesses with the floor's
    actual list (it also reruns Pi rows 13–16); an OMP worker on Orca older
    than 1.4.224.
- Version 0.26.0 in both plugin manifests and `package.json`.

**Files.** The allowed scope above.

**Focused verification.** The acceptance rows below, each with its
counterexample observed red first. Run instruments against a scratch HOME so
nothing reaches the real `~/.dely/log.jsonl`. Keep throwaway instrument files
in this Run's folder.

**Document impact.** README and `probe/checklist.md` own the user-visible and
verification surfaces of the changed launch; `SKILL.md` and
`skills/setup/SKILL.md` own the protocol text for `modelPin` and effort.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| OMP Model `selector` + Effort `level` launches `--model selector:level`, no `--effort`, no `dely-pin:` line, for both `dispatch` and `preflight` | The checklist's argv stub candidate-only assertion (fake Orca), reading the recorded `worker-start` argv and `--spec` | Helper passes `--model selector` and drops the effort, or passes `--effort level` beside it | |
| OMP Model `selector` + Effort `default` launches exactly `--model selector` | Same assertion, Effort-`default` mode | `--model selector:` or `--model selector:default` | |
| OMP Model `default` + pinned Effort is refused before `worker-start` | Same stub's `effort` mode (refusal on both sides, no `worker-start` call) | Launch with `--model :high` or with no model and the effort dropped | |
| Pi is unchanged: spec carries `dely-pin: pin-model high`, no `--model`/`--effort` | Argv stub candidate-only assertion for `modelPin` entries, plus no Pi line in INTENDED | `effortInModel` or flag handling applied to every `spec-unchecked` entry | |
| Only OMP's argv changes against `v0.25.0` | Argv stub GREEN with `DELY_NAMED_INTENDED` = `OMP --model` and `OMP preflight --model` | Joining the effort for every `modelFlag` entry without `effortFlag` (Cursor, Antigravity): INTENDED gains Cursor and Antigravity lines | |
| `spec` is gone and cannot come back silently | Gate 3 run on a copy of `harnesses.json` with `omp.modelPin = "spec"`, and on a copy with `effortInModel` on an entry with `modelFlag: false`; identifier grep | The check is deleted but gate 3 still accepts `spec`, so a `spec` entry would launch unchecked | |
| Closure gates pass on the candidate | AGENTS.md closure gates, including the role-table gate | README's OMP row not regenerated after `limits` changes | |
| Setup offers OMP effort levels | None executable; a human reads the `skills/setup/SKILL.md` diff | — (no instrument; reviewer reads the diff) | n/a |

**Cannot be observed:** whether a live OMP session runs the composed model and
level, an unknown selector's live `NO_ACK`, a bad level's live outcome, and
Pi's live pin on the candidate. Those are `probe/checklist.md` rows 8–10, 12
and 13–15, run by a separate session before review. Setup's wording is read,
not run.

## Stop conditions

- Composing the model needs a change to `extensions/dely-pin.ts` or to the
  `pi` entry.
- The argv stub reports a difference for an entry other than OMP that the
  record does not name.
- A gate in `AGENTS.md` cannot express the `effortInModel` constraint without
  rejecting a current entry.
- The fake Orca in the argv stub cannot record the `--spec` text needed for
  the Pi assertion.

## Closure gates

From the repository root, every block in `AGENTS.md` "Closure gates", plus
the argv stub row of `probe/checklist.md` against a `git archive` snapshot of
HEAD and of `v0.25.0`, with
`DELY_NAMED_INTENDED=$'OMP --model\nOMP preflight --model'`.
