# Plan — pins live in `.dely/`, with a personal file that overrides the team's per phase

Decision record: `docs/decisions.md`, section "2026-10-05 — Pins live in
`.dely/`, with a personal file that overrides the team's per phase".

**Baseline:** the SHA of the commit carrying the decision record and this plan
(resolve with `git log -1 --format=%H -- docs/_plans/project-pins.md`).

## Goal

Every `dely` command that needs pins resolves them from `.dely/local/pins.json`
(personal, ignored), then `.dely/pins.json` (team, tracked), then Control's own
harness with defaults, per phase, with one resolver that `dely pins` exposes.
The `AGENTS.md` managed block is no longer read; its presence stops the helper.
`setup` writes the new files and a one-line routing sentence. The README
explains it in plain words. Out of reach: migrating this repository's own
`AGENTS.md` block (follow-up delivery, see the decision record).

## Allowed scope

```
skills/delivery/scripts/dely.js
skills/delivery/SKILL.md
skills/delivery/templates/plan.md
skills/delivery/templates/decision-record.md
skills/setup/SKILL.md
probe/checklist.md
probe/mkrepo.sh
README.md
.claude-plugin/plugin.json
.codex-plugin/plugin.json
package.json
AGENTS.md          (the three version-gate lines only)
```

Produced from `git grep -n -E 'AGENTS\.md|managed block|dely:begin|dely:end' -- . ':!docs/decisions.md'`
(run 2026-10-05). Its hits outside this list and why they stay:
`.github/pull_request_template.md` and `CONTRIBUTING.md` refer to `AGENTS.md`
for closure gates, not pins; `CLAUDE.md` is the import line;
`harnesses.json` `instructionsFile` and `limits` concern which file a harness
reads, which is still `AGENTS.md` for the routing line. There is no test suite
and no registry. `docs/decisions.md` is owned by Control.

## Forbidden scope

- `AGENTS.md` outside the version gate: its `<!-- dely:begin -->` block and pin
  table stay. The installed 0.23.1 helper running this delivery reads them for
  every dispatch, including reviews.
- `harnesses.json`, `extensions/`, `start()` in `dely.js`, and `wait`,
  `wait-bg`, `notify`, `log`: unchanged launch argv and settle logic.
- `CLAUDE.md`, `CONTRIBUTING.md`, `.github/`.
- `docs/decisions.md` and this plan: Control's.

## Execution envelope

Protected dirty paths: none; the tree was clean at baseline (`git status
--porcelain` printed nothing on `main` at `9c5a4c8`).

Branch, base, remote, and pull-request target: `feat/project-pins`, based on
`main` at `9c5a4c8`, remote `origin` (`hieuphung97/dely`), pull request into
`main`.

Resolved phase pins, from this repository's `AGENTS.md` (the installed 0.23.1
helper reads them): `implement` — Claude Code, `claude-sonnet-5-5`, `medium`;
`review` — Codex CLI, `gpt-6.1-sol`, `high`. Control: Claude Code, wake mode
`background`.

Authority: this plan may branch, commit only its own owned paths, run gates,
push the named branch, and open or update the named pull request. It may not
merge, force-push, stash, reset, clean, or edit anything outside owned scope.

## Tasks

### 1. The helper resolves pins from `.dely/`, and the skills and probe use it

**Behaviour.**

- `dely pins --repo <path>` prints one JSON line:
  `{"implement":{"harness":"<id>","model":"…","effort":"…","source":"local|team|control","file":"<abs path or null>"},"review":{…}}`
  and exits 0, or prints `ERROR …` and exits non-zero.
- Format: each pins file is an object whose only keys are `implement` and
  `review`; each value is an object with exactly the string keys `harness`,
  `model`, `effort`; `harness` is an `id` in `harnesses.json`. Anything else
  (unknown key, missing or extra field, non-string, unknown harness, invalid
  JSON) is an error naming the file.
- Order per phase: personal file, team file, Control. Personal file is
  `<repo>/.dely/local/pins.json`; if that file does not exist, the main
  checkout's `.dely/local/pins.json`, where the main checkout is
  `dirname(path.resolve(repo, git -C repo rev-parse --git-common-dir))` used
  only when the common dir's basename is `.git` and it differs from `<repo>`.
  Exactly one personal file is read. Team file is `<repo>/.dely/pins.json`.
  Control is `selfHarness()` with Model and Effort `default`; if that is null,
  the error says no pin names the phase and Control's harness is unknown.
- If `<repo>/AGENTS.md` contains `<!-- dely:begin -->`, every command that
  resolves pins stops with an error saying pins moved to `.dely/pins.json` and
  to run `dely:setup`. The block is never parsed.
- `preflight` and `dispatch` use this resolver. Their stdout and the
  `worker-start` argv for the same pin are unchanged from 0.23.1.
- Version 0.24.0 in `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`,
  `package.json`, and the three version-gate lines in `AGENTS.md`.

**Direction.** Replace `pin(repo, phase)` with a resolver returning the same
fields `start()` uses (`agent`, `model`, `effort`, `modelFlag`, `effortFlag`,
`modelPin`, `phase`) plus `source` and `file`. Errors go through `fail()`.
Add `pins` to `COMMANDS` (required `--repo`). Do not touch `start()`.

`skills/delivery/SKILL.md`: line 13 stops naming `AGENTS.md` as the pin source
(gates, paths and branch stay there); the execution envelope says Control runs
`dely pins` and records each phase's source; "Orca and the helper" says the
helper resolves pins from `.dely/` as `setup` describes. Keep everything else.

`skills/setup/SKILL.md`: rewrite around two files and the routing line, per the
decision record. Keep discovery, instructions file, trust and preflight
sections; remove markers and their refusals; ask team or personal; write
`.dely/local/.gitignore` containing `*` with any personal file; append the
routing line to `AGENTS.md` when it has no `dely:delivery`; offer to replace an
old block, only on a yes. Update the frontmatter description.

Templates: `plan.md`'s "Resolved phase pins … taken from `AGENTS.md`" reads
from `dely pins`, with each source. `decision-record.md` line 7 is about
frontmatter conventions and stays unless it names pins.

Probe: `mkrepo.sh` writes `.dely/pins.json` (harness ids) and the routing line,
no block; its arguments keep their order but take harness ids. Both stub rows
in `checklist.md` write `.dely/pins.json` for the candidate and the old
`AGENTS.md` table for the 0.23.1 release snapshot (the argv stub compares the
two, so write each form where its helper reads it; the candidate must not see
`<!-- dely:begin -->`). Update "A deployment is this repository's `AGENTS.md`
pins" to "this repository's pins". Add a stub row "pin resolution" that runs
acceptance rows 1–6 below against a fake Orca, with a deliberately wrong copy
first, and state when it runs (the resolver or the `.dely` format changes).

**Files.** `skills/delivery/scripts/dely.js`, `skills/delivery/SKILL.md`,
`skills/delivery/templates/plan.md`, `skills/setup/SKILL.md`,
`probe/checklist.md`, `probe/mkrepo.sh`, the three manifests, `AGENTS.md`
version gate.

**Focused verification.** The new "pin resolution" stub row, RED then GREEN;
the argv stub row against a `v0.23.1` snapshot with `DELY_NAMED_INTENDED`
empty; closure gates.

**Document impact.** `SKILL.md` and `setup/SKILL.md` own the contract the
helper implements; the checklist owns the instruments; the README is task 2.

### 2. The README explains configuration in plain words

**Behaviour.** A reader can set up team pins and personal pins, knows which
wins, knows what happens with no pins, and knows how to upgrade from 0.23.

**Direction.** Rewrite Quickstart step 3, the paragraph under "Install Dely"
that mentions setup and defaults, the Claude Code line "so Claude reads the
project pins", and replace "Choose models" with "Configure a project": the two
files with a short JSON example, which wins, what happens with neither, that
`setup` writes them, that `.dely/local/` is never committed and `git clean -fdx`
deletes it, `dely pins` to see what is in use, and "Upgrading from 0.23"
(Dely stops until the old block is replaced; run setup). Update Contents.
Plain, direct sentences a person would write: no marketing, no stacked
qualifiers, no "seamless/robust/leverage", no em-dash chains. Do not touch the
role table rows (a closure gate derives them from `harnesses.json`).

**Files.** `README.md`.

**Focused verification.** Closure gates (the README role-row gate must stay
green); a human reads the changed sections.

**Document impact.** None beyond the README.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| Personal file overrides per phase | Pin-resolution stub: team `{implement: claude, review: codex}`, personal `{review: cursor}`; `dely pins` | Whole-file override: `implement` falls to Control instead of `claude`/`team` | |
| Worktree, then main checkout | Same stub, linked worktree; personal file only in main → found; worktree has its own → it wins | Reads only `<repo>/.dely/local`, or main always wins | |
| Control fallback | Fake Orca `agentIdentity: codex`, no files → both phases `codex`, `default`, `control` | Throws as in 0.23.1, or hard-codes `claude` | |
| Old block stops the helper | `AGENTS.md` with `<!-- dely:begin -->` → non-zero, message names `.dely/pins.json` | Silently falls back to Control | |
| Strict format | Typo key `reveiw`, unknown harness, missing `effort`, invalid JSON → error naming the file | Ignores the typo key and uses the team pin | |
| `dispatch`/`preflight` use the resolver | Fake Orca records `worker-start` argv with a personal override | Still parses `AGENTS.md` | |
| Launch argv unchanged for the same pin | Argv stub row vs `v0.23.1`, `DELY_NAMED_INTENDED` empty | Built-in mutant dropping `--effort` | |
| Personal setup leaves no trace in Git | Live `setup` "only me" in a probe repo → `git status --porcelain` empty; `dely pins` source `local` | Writes a root `.gitignore`, or the file shows in status | |
| README is plain and correct | Owner and reviewer read it; no instrument | None; a human reads the diff | |
| Gates, version 0.24.0 | Closure gates on exact HEAD | One manifest left at 0.23.1 | |

**Cannot be observed:** a bare repository with linked worktrees; a personal
file created by hand without its `.gitignore`; Orca reporting an
`agentIdentity` that is not a `harnesses.json` id for some harness.

## Stop conditions

- `selfHarness()` cannot be used outside `wait` (for example it needs
  something only `wait` sets up): `NEEDS_REPLAN`.
- Keeping `preflight`/`dispatch` stdout identical to 0.23.1 is impossible:
  `NEEDS_REPLAN`.
- Any change appears necessary in `start()`, `harnesses.json` or `extensions/`:
  `BLOCKED`.

## Closure gates

From the repository root, every command under "Closure gates" in `AGENTS.md`,
with the version gate at 0.24.0.
