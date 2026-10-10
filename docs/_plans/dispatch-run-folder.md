# Plan — every dispatch file lives in its Run's folder, kept until the run closes

Decision record: `docs/decisions.md`, section `2026-10-10 — Every dispatch file
lives in its Run's folder under .dely/local/runs/, kept until the run closes`.

**Baseline:** the commit carrying this plan and that record (resolve with
`git log -1 --format=%H -- docs/_plans/dispatch-run-folder.md`).

## Goal

Issue #69. Every prompt and handoff of an Orca Run lives in
`<repo>/.dely/local/runs/<run>/`; `dely dispatch` refuses a spec file anywhere
else and makes sure `.dely/local/` is ignored; the files stay until the run
closes, when Control deletes the folder and `dely log` records any file still
there as `residue`. A Spike that dispatches workers follows the same rule.
Out of reach: making a worker write its handoff where the prompt says.

## Allowed scope

```
skills/delivery/scripts/dely.js
skills/delivery/SKILL.md
skills/setup/SKILL.md
probe/checklist.md
README.md
AGENTS.md
.claude-plugin/plugin.json
.codex-plugin/plugin.json
package.json
```

Produced by `git grep -nE 'spec-file|reportPath|untracked file|prompt file|delete it|Spike' -- ':!docs/decisions.md'`
and `git grep -n '\.dely/local' -- ':!docs/decisions.md'` on the baseline; the
hits are in `dely.js` (591, 955), `SKILL.md` (3, 46, 117–123, 180, 185, 193),
`probe/checklist.md` (329, 475, 477, 560–693 pin-resolution fixtures, 695,
821, 905), `README.md` (49, 240, 263), `skills/setup/SKILL.md` (3, 20–21, 58,
76), `AGENTS.md` (30, 55) and `probe/mkrepo.sh` (93). `AGENTS.md` is in scope
for the version gate only; its two Spike lines stay true. The repository has
no test suite, so no colocated test applies. `skills/setup/SKILL.md` owns the
`.dely/local/` layout and is reconciled only if its layout block must name
`runs/`.

## Forbidden scope

- `docs/decisions.md` — Control owns the record; the implementer reports a
  needed amendment instead of making it.
- `probe/mkrepo.sh` — its line 93 is the routing line, which stays true.
- `harnesses.json`, `extensions/` — no harness fact changes.
- `wait-bg --out` and its system-temp default — a non-goal.

## Execution envelope

Protected dirty paths: none; the tree was clean at `572f039`.

Branch, base, remote, and pull-request target: `fix/dispatch-run-folder` from
`main` at `572f039`, remote `origin`, pull request into `main`.

Resolved phase pins (`dely pins --repo .`, both `team` from `.dely/pins.json`):
implement `claude` / `claude-sonnet-5-5` / `medium`; review `codex` /
`gpt-6.1-sol` / `high`. The integration review is a different fresh session
on the review pin.

Authority: branch, commit only owned paths, run gates, push
`fix/dispatch-run-folder`, open or update its pull request. No merge,
force-push, stash, reset, clean, or edit outside owned scope.

## Tasks

### 1. Dispatch files have one home per Run, and the close is visible in the log

**Behaviour.**

- `dely dispatch` resolves `--spec-file` against `--repo`. If the resolved
  path is not inside `<repo>/.dely/local/runs/<run>/` (compare resolved paths
  with a separator, so `runs/<run>2/` and `runs/<run>/../x` are outside), it
  prints a `REFUSED` line naming that folder and exits non-zero before any
  `worker-start`. Otherwise, when `<repo>/.dely/local/.gitignore` is absent,
  it writes that file with the single line `*`; an existing file is left
  byte-identical. Then it dispatches exactly as before.
- `dely log` adds `residue` to the record: the sorted repo-relative paths of
  every file (recursively) under `<repo>/.dely/local/runs/<run>/`, where repo
  is `--repo`, else the object's `repo`; `[]` when the folder is absent or
  empty; `null` when no repo is known. It deletes nothing, and still writes
  and creates nothing when `~/.dely/` is absent.
- `SKILL.md`: the "Orca and the helper" paragraph on prompt files names the
  Run's folder for the prompt and the handoff, withdraws deleting the prompt
  after the worker returns, and says the folder is kept until close; the
  Release section's logging paragraph says Control deletes the folder at
  close, then runs `dely log --run <run> --repo <path> --json '<object>'`;
  the shape table or a sentence near it says a Spike that dispatches workers
  opens its own Run and follows the same rule, closing when it reports its
  recommendation; the `description` says the same in one clause, keeping
  "Spike starts no delivery run" true. No sentence may still tell Control to
  delete a prompt when its worker returns.
- `README.md` line 49 and the `.dely/local/` lines say what the Run folders
  are. `skills/setup/SKILL.md` names `runs/` in its layout block if, and only
  if, that block lists the contents of `.dely/local/`.
- `probe/checklist.md`: every fixture or live row that dispatches writes its
  spec inside `.dely/local/runs/<run>/` of its repo (329, 695, 821, 475–477,
  and any other dispatch the implementer finds — enumerate with
  `grep -n "spec-file\|'dispatch'" probe/checklist.md`). The argv stub row
  must still pass against the `v0.24.1` snapshot, which accepts any path.
- Version 0.25.0 in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
  `package.json`, and the three version-gate lines in `AGENTS.md`.

**Direction.** Keep `dely.js` in its current style: one guard near the top of
`dispatch()` after `f.repo` is resolved, using `path.relative` and rejecting a
result that is empty, starts with `..`, or is absolute; one small recursive
listing used by `logCmd`. Use the helper's existing `out()` for `REFUSED`
with a distinct exit code not already used by `dispatch` (read the existing
codes first). Do not add a subcommand. Do not change `usageLine` output
except where a flag's meaning changes (it does not).

**Files.** `skills/delivery/scripts/dely.js`, `skills/delivery/SKILL.md`,
`probe/checklist.md`, `README.md`, `skills/setup/SKILL.md` (if needed),
`AGENTS.md`, the three manifests.

**Focused verification.** A fake-Orca script in the scratch area (not
committed), modelled on the checklist's argv stub (`ORCA_CLI_COMMAND`,
`ORCA_TERMINAL_HANDLE`, isolated `HOME`, `DELY_ACK_S` etc.), that runs each
acceptance row below against the candidate and against a deliberately wrong
copy for each counterexample, and prints which rows each copy fails. Then run
the checklist's argv stub row against a `git archive` snapshot of `v0.24.1`
with `DELY_NAMED_INTENDED` empty.

**Document impact.** `SKILL.md` owns the protocol; `README.md` owns the user
description of `.dely/local/` and Spikes; `probe/checklist.md` owns the
fixtures that call `dispatch`; `skills/setup/SKILL.md` owns the `.dely/local/`
layout.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| A spec outside the Run's folder is refused with no `worker-start` | fake Orca; spec at `repo/spec.md`, `.dely/local/runs/<run>2/spec.md`, `.dely/local/runs/<run>/../x/spec.md`; read the fake's `calls.jsonl` | a guard using `startsWith` without a trailing separator, or on the unresolved string | |
| A spec inside the Run's folder dispatches; `.dely/local/.gitignore` is created with `*` when absent and left byte-identical when present; `git status --porcelain` in the fixture repo is empty after dispatch | fake Orca in a `git init` fixture, once with no `.gitignore`, once with `.dely/local/.gitignore` holding `keep-me` | a helper that always writes `.gitignore` | |
| `residue` lists every file under the Run's folder, nested included, repo-relative, sorted | `dely log --repo <fixture>` from another cwd with `a.md` and `sub/b.md`; read `~/.dely/log.jsonl` in the isolated home | a top-level-only listing, or a listing of cwd instead of `--repo` | |
| Folder absent → `[]`; no `--repo` and no `repo` in the object → `null`; no `~/.dely` → no file or directory created, exit 0 | the same script | `residue: []` when the repo is unknown | |
| `SKILL.md` keeps no rule deleting a prompt when its worker returns | `git grep -n 'After the worker returns' skills/` empty, and a human reads the diff | text keeping both "delete after return" and "keep until close" | |
| The argv stub row passes against `v0.24.1` | `probe/checklist.md` stub row, `DELY_NAMED_INTENDED` empty | the fixture spec left at `repo/spec.md`, so the candidate refuses | |
| Closure gates and version gate pass | the commands in `AGENTS.md` | — (shape and syntax only) | n/a |

**Cannot be observed:** whether a live worker writes its handoff inside the
Run's folder (live Control rows only); symlinks inside the folder; a stray
file outside the folder.

## Stop conditions

- The argv stub cannot pass against `v0.24.1` without editing its comparison
  logic rather than its fixture paths → `NEEDS_REPLAN`.
- Any dispatch row in the checklist depends on a spec path the new guard
  refuses and cannot be moved → `NEEDS_REPLAN`.
- The decision record contradicts the code → `BLOCKED`, naming the sentence.

## Closure gates

From the repository root, every command in `AGENTS.md` under "Closure gates",
with the version gate at `0.25.0`.
