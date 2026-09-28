# Plan — Pi is a supported harness and shares OMP's package and pin extension

Decision record: `docs/decisions.md`, section "2026-09-28 — Pi is a supported
harness and shares OMP's package and pin extension", and the amendment note it
adds to the 2026-09-27 OMP record.

**Baseline:**

## Goal

A project can pin Pi (Orca agent id `pi`) for `implement` or `review`; the pin
reaches the worker as the existing `dely-pin:` spec line and the shipped
extension applies it before the first request, failing closed on a bad
selector or level. One root `package.json` key (`pi`) and one extension file
(`extensions/dely-pin.ts`) serve Pi and OMP. The extension checks a level by
setting it and reading it back. OMP keeps its post-acknowledgement projection
check; Pi, whose model Orca does not report, uses `modelPin: spec-unchecked`
and skips it. Claude Code, Codex CLI and Cursor Agent CLI are byte-identical
to 0.22.0 at `worker-start`. Version `0.23.0`. Out of reach: seeing that Pi did
not load the extension; a stuck live Pi worker before `DEADLINE`.

## Allowed scope

```
package.json
extensions/dely-pin.ts            (moved from omp/dely-pin.ts; omp/ removed)
skills/delivery/scripts/dely.js
harnesses.json
skills/delivery/SKILL.md
skills/setup/SKILL.md
.claude-plugin/plugin.json        (version only)
.codex-plugin/plugin.json         (version only)
AGENTS.md                         (version gate lines only)
README.md
probe/checklist.md
docs/decisions.md                 (Control only)
docs/_plans/pi-harness.md         (Control only; deleted before the release-binding review)
```

References to the old extension path, enumerated with
`git grep -n 'omp/dely-pin' -- . ':!docs/decisions.md'` on the baseline:
`package.json:6`, `harnesses.json:208` (inside `omp` notes), and
`probe/checklist.md` lines 80, 105, 106, 113, 208, 372, 395, 404. All are in
scope. No colocated tests exist in this repository.

## Forbidden scope

`probe/trust.sh`, `probe/mkrepo.sh`, `skills/delivery/templates/`,
`.cursor-plugin/`, `.claude-plugin/marketplace.json`, root `plugin.json`,
`CONTRIBUTING.md`, `SECURITY.md`, `.github/`, and any user configuration
(`~/.pi`, `~/.omp`, `~/.claude`, `~/.codex`, `~/.cursor`, Orca settings)
except the temporary installs Task 1's instructions allow.

## Execution envelope

Protected dirty paths: none; the owner's `AGENTS.md` pin change is committed
separately as `abc9a2a`.

Branch, base, remote, pull-request target: `feat/pi-harness` from `main` at
`3155c22`, remote `origin`, pull request into `main`.

Resolved phase pins (`AGENTS.md`, checked 2026-09-28): `implement` OMP
`google-vertex/gemini-3.8-flash` `high` (`omp models --json` offers `high`);
`review` Codex CLI `gpt-5.6-sol` `high` (Codex 0.157.1, visibility `list`).

Authority: commit owned paths, run gates, push `feat/pi-harness`, open or
update its pull request into `main`. No merge, force-push, stash, reset,
clean, or edit outside owned scope.

## Tasks

### 1. One package and one extension pin Pi and OMP; the helper skips the check only for `spec-unchecked`

**Behaviour.**

- `package.json`: the `omp` key becomes `pi` with the same shape,
  `{"extensions": ["./extensions/dely-pin.ts"], "skills": ["./skills"]}`;
  version `0.23.0`; no `type` field.
- `extensions/dely-pin.ts` replaces `omp/dely-pin.ts` (the `omp/` directory is
  removed). Unchanged: acts only on the session's first `before_agent_start`;
  applies the **last** line matching
  `^dely-pin:[ \t]+(\S+)(?:[ \t]+(\S+))?[ \t]*$`; exact
  `provider + "/" + id` lookup; failure prints `DELY-PIN-FAIL <selector>` from
  a `process.on("exit")` handler and calls `process.exit(1)`. Changed: no
  reading of `model.thinking`, `thinking.efforts` or any registry shape. After
  `setModel` succeeds and a level was given, call `pi.setThinkingLevel(level)`
  then `pi.getThinkingLevel()`; if the result is not exactly the requested
  level, fail. `setModel` returning false still fails.
- `dely.js`: the spec pin line is written for `modelPin` `spec` **and**
  `spec-unchecked`, exactly as today for `spec`, including the refusal of an
  Effort pinned with Model `default`. The post-acknowledgement projection
  check runs only for `spec`. Nothing branches on a harness id. Claude Code,
  Codex CLI and Cursor Agent CLI pins produce the same argv, spec and stdout
  as the 0.22.0 helper and never call `worker-show`.
- `harnesses.json`: a new `pi` entry after `omp` — name `Pi`, id `pi`, binary
  `pi`, `status: supported`, `controlWake: waker`, `trust: dialog`,
  `modelFlag: false`, `effortFlag: false`, `modelPin: "spec-unchecked"`,
  `permissionDefault: "none"`, `forbiddenHeadless`
  `["pi -p", "pi --print", "pi --mode json", "pi --mode rpc"]`,
  `instructionsFile` `{file: AGENTS.md, readsAgentsMd: true, needsImport: false, alsoApplies: [CLAUDE.md]}`,
  `discovery`
  `{"models": "pi --list-models | awk 'NR>1 && $1!=\"\" {print $1\"/\"$2}'", "effort": "pi --help | sed -n 's/.*--thinking <level> *Set thinking level: //p' | tr -d ' ' | tr ',' '\\n'"}`
  (verify each command's output before writing it), and `notes` carrying the
  decision record's measured facts, including the trust condition and that
  Orca reports neither the model nor a transcript. In the `omp` entry's
  `notes`, update the extension path and the level-check description only.
- `skills/delivery/SKILL.md`: the `modelPin` sentence in "Name the model and
  effort on every dispatch" covers `spec` and `spec-unchecked` and says the
  helper verifies the reported model only for `spec`.
  `skills/setup/SKILL.md`: the `modelPin: spec` sentence covers
  `spec-unchecked` too.
- Version `0.23.0` in both plugin manifests, `package.json` and the
  `AGENTS.md` version gate.

**Direction.** Keep the diff small: the extension should end shorter than it
starts. Do not add a harnesses.json field.

**Focused verification.** Build these as scratch scripts under
`~/dely-probe/pi-task1/`; they are evidence, not deliverables.

- Stub-`orca` helper check (reuse or adapt `~/dely-probe/task1-fix/`): a
  `spec-unchecked` pin whose `worker-show` projection model is `null` →
  `DISPATCHED` with no `worker-show` call required; a `spec` pin with `null`
  → `FAILED … pin not applied`; `spec-unchecked` with Model `default` and an
  Effort → refused before `worker-start`; Claude Code, Codex CLI and Cursor
  Agent CLI pins byte-identical to a `git archive 3155c22` helper.
- Node fake-`pi` extension check: `getThinkingLevel` that clamps
  (`max` → `high`) fails; exact level passes; unknown selector and
  `setModel` false fail; last line wins; a model id containing `:` with no
  effort resolves; second start ignored.
- Real harness check without Orca workers: in a scratch repository under
  `~/dely-probe/`, launch `pi --no-extensions -e <candidate extensions/dely-pin.ts>`
  and `omp --no-extensions -e <same file>` in Orca terminals you create
  (`orca terminal create … --command …`), with a first prompt carrying
  `dely-pin: google-vertex/gemini-3.5-flash low` (not either harness's
  default); read each session JSONL (`~/.pi/agent/sessions/`,
  `~/.omp/agent/sessions/`) and show the last `model_change` before the first
  user message is `gemini-3.5-flash` and the level `low`; then `max` on the
  same model must print `DELY-PIN-FAIL` on the terminal after exit. Close
  every terminal you create.
- Package check in scratch homes (`HOME=<scratch>`): `pi install <snapshot>`
  and `omp plugin install <snapshot>` of your working commit; Pi's
  `pi --verbose` startup lists both skills and `extensions/dely-pin.ts`;
  `omp skill list --json` lists both skills and `omp plugin list --json` shows
  the extension in the manifest. Delete the scratch homes after.

Never create, bind, `run-use` or `check` any Orca Run; none of the checks above
needs one.

**Document impact.** Both skills and `harnesses.json` own the facts changed;
`AGENTS.md` owns the version gate.

### 2. Pi install, pin and checklist are documented and checked

**Behaviour.**

- `README.md`: Pi joins the harnesses supported today (the list stays
  open-ended). A Pi section: install
  `pi install git:github.com/hieuphung97/dely@v0.23.0`; verify with
  `pi list` and the `[Skills]`/`[Extensions]` block Pi prints at start;
  update by installing the new tag; remove with `pi remove <source>`; the
  trust condition; `/skill:delivery` and `/skill:setup`; pinning (Model
  `<provider>/<model>` from `pi --list-models`, Effort one of the `--thinking`
  levels); and that Dely cannot see a pin Pi ignored when the extension is not
  loaded. The OMP section's extension path is updated. Checked versions gains
  Pi `0.87.1` and sets Orca `1.4.215`.
- `probe/checklist.md`: every `omp/dely-pin.ts` reference becomes
  `extensions/dely-pin.ts`. Pi in Input. A Pi install step from the snapshot
  (`pi install "$snap"`), checked by Pi's startup listing naming both skills
  and `extensions/dely-pin.ts` under the snapshot path, with removal by
  `pi remove "$snap"`. Pi rows: a valid pin differing from Pi's default gives
  `DISPATCHED`, and the Pi session's last `model_change` before the first user
  message and every assistant message are the pin; an unknown selector gives
  `NO_ACK` quoting `DELY-PIN-FAIL`; a level the model does not offer gives the
  same; a killed Pi worker gives `ATTENTION`; Pi as Control completes a
  `dely wait-bg --control pi` cycle and `dely wait --control pi` prints
  `REFUSED`. The Pi rows run when `start()`, the extension or the `pi` entry
  changes, and after a Pi upgrade; the release floor stays ten rows.

**Focused verification.** A human-equivalent read against the decision
record; `git diff --check` and the disclosure greps.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| A valid Pi pin applies before the first request | Task 1 real Pi check; live Pi row | Package keeps `omp` key so Pi skips the extension; extension still reads a registry shape and fails a valid pin | |
| A level the model does not offer fails on both harnesses | Fake `pi` with clamping read-back; real `max` check on Pi and OMP | No read-back: `max` silently runs as `high` | |
| OMP behaves as in 0.22.0 | Scratch-home OMP package check; live OMP rows 8 and 9 | OMP does not load the extension from the `pi` key → `FAILED pin not applied` | |
| `spec-unchecked` skips only Pi's check | Stub `orca`: Pi `null` → `DISPATCHED`, OMP `null` → `FAILED` | Check skipped for every `modelPin` harness, or kept for Pi | |
| Claude, Codex, Cursor unchanged | Stub comparison with a `3155c22` helper; no `worker-show` | Pin line or check reaches them | |
| Pi discovery yields selectors and levels | Run both commands | `$2` alone, without the provider, which the extension rejects | none: a human reads the output |
| Pi worker death and Pi Control | Live Pi rows | Entry says `background`; ATTENTION route broken | |
| Version and package | `AGENTS.md` gates | A manifest left at `0.22.0` | |

**Cannot be observed:** a Pi worker that did not load the extension; Pi
versions other than 0.87.1; whether Pi's trust dialog appears on another
machine's layout.

## Stop conditions

- OMP stops loading the extension or the skills from the `pi` key:
  `NEEDS_REPLAN`.
- `getThinkingLevel` is missing, or does not distinguish an unoffered level, on
  either harness: `NEEDS_REPLAN`.
- The change needs a new `harnesses.json` field or a branch on a harness id:
  `NEEDS_REPLAN`.

## Closure gates

Every gate in `AGENTS.md`, with the version gate at `0.23.0`, from the
repository root.
