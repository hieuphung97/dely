# Plan — close the architecture review's OMP gaps on pull request #60

Decision record: `docs/decisions.md`, section "2026-09-27 — OMP is a supported
harness, and its model pin travels in the spec", as amended after the
architecture review (paragraph beginning "Amended the same day").

**Baseline:**

## Goal

The OMP pin cannot be silently wrong when a Model is pinned: the pin line has
an unambiguous whitespace format, the extension applies the last pin line,
and after acknowledgement the helper fails a `modelPin: spec` dispatch whose
Orca-reported model is not the pinned selector. The root `package.json` is
gated like the manifests. Setup offers OMP pins. OMP's trust, permission,
install and skill-name consequences are stated, the checklist asks OMP what
it resolved and hashes the extension, and the release floor is ten rows with
an OMP-upgrade rerun rule. Claude Code, Codex CLI and Cursor Agent CLI stay
byte-identical to 0.20.1 at `worker-start`. Version stays `0.22.0`. Out of
reach: a Model `default` dispatch whose spec itself carries a pin line, dead
worker detection, git-URL install.

## Allowed scope

```
skills/delivery/scripts/dely.js
omp/dely-pin.ts
harnesses.json
skills/setup/SKILL.md
skills/delivery/SKILL.md          (only if the pin-format sentence must change)
AGENTS.md                          (closure gates and the version-bump sentence only)
README.md
probe/checklist.md
docs/decisions.md                  (Control only)
docs/_plans/omp-review-fixes.md    (Control only; deleted before the release-binding review)
```

Listed by hand from the approved amendment. No colocated tests exist in this
repository. `package.json` is not in scope: its content stays as it is; only
gates about it change.

## Forbidden scope

`package.json` content, the plugin manifests, `.cursor-plugin/`,
`.claude-plugin/marketplace.json`, `probe/trust.sh`, `probe/mkrepo.sh`,
`skills/delivery/templates/`, `CONTRIBUTING.md`, `SECURITY.md`, `.github/`.

## Execution envelope

Protected dirty paths: none; the tree is clean at the baseline commit.

Branch, base, remote, and pull-request target: `feat/omp-harness` at
`b3a5f1f`, remote `origin`, pull request #60 into `main` (returned to draft).

Resolved phase pins, as in `AGENTS.md`: `implement` Cursor Agent CLI
`cursor-grok-4.6-high` `default`; `review` Codex CLI `gpt-5.6-sol` `high`.

Authority: commit owned paths, run gates, push `feat/omp-harness`, update
pull request #60. No merge, force-push, stash, reset, clean, or edit outside
owned scope.

## Tasks

### 1. The OMP pin is unambiguous and verified after acknowledgement

**Behaviour.**

- For a harness with `modelPin: "spec"`: Model not `default` and Effort
  `default` appends `dely-pin: <model>`; both set appends
  `dely-pin: <model> <effort>`; Model `default` and Effort `default` appends
  nothing; Model `default` with an Effort refuses before `worker-start`
  with a message saying a pinned Effort requires a pinned Model.
- `omp/dely-pin.ts` applies the **last** line matching
  `^dely-pin:[ \t]+(\S+)(?:[ \t]+(\S+))?[ \t]*$` (multiline), on the
  session's first agent start only. The first token is the selector,
  matched exactly against `provider + "/" + id`; the optional second token is
  the level, validated against the model's offered levels (the registry
  shape measured on 2026-09-27: `thinking.efforts`; keep accepting an array)
  before `setModel`. Failure keeps the existing `DELY-PIN-FAIL` stderr line
  from an exit handler and `process.exit`.
- In `dely dispatch`, after the acknowledgement and before printing
  `DISPATCHED`, for a `modelPin: "spec"` pin with Model not `default`: read
  `orca orchestration worker-show --dispatch <id>` `result.projection.provider.model`,
  retrying for a short bounded time. If it equals the pinned selector,
  continue to `DISPATCHED` as today. Otherwise stop and release the worker,
  log an event, and print
  `FAILED <id> pin not applied: expected <selector>, saw <value or none>`
  with the existing `FAILED` exit code. No other harness reaches this code.
- `harnesses.json` `omp`: `permissionDefault` becomes `none`; `notes` gain
  that approvals follow the user's `tools.approvalMode`, that OMP has no
  workspace-trust gate (a repository's `.omp/extensions`, `.omp/skills` and
  `.omp/config.yml` take effect without a prompt), and the new pin format.
- `skills/setup/SKILL.md` gains one sentence: an entry with `modelPin: spec`
  can be pinned — offer its discovered models and effort levels as for a
  flag harness, and write Effort `default` for a model whose effort field is
  `null`. `skills/delivery/SKILL.md` changes only if its existing sentence
  names the old pin format.
- `AGENTS.md`: the version gate also runs
  `test "$(jq -r .version package.json)" = 0.22.0`; the `jq -e .` gate also
  parses `package.json`; a new gate
  `test "$(jq -r 'has("type")' package.json)" = false`; the version-bump
  sentence names both manifests and `package.json`.

**Direction.** Keep the helper change keyed on `modelPin`, not the harness
id. Put the post-acknowledgement check where `dispatch()` is about to print
`DISPATCHED`; reuse its `orca()` wrapper, `worker-stop`/`worker-release`
sequence and `logEvent`. Before relying on it, **measure** on a real Orca
dispatch of OMP with the candidate extension loaded whether
`projection.provider.model` already holds the pinned selector when the `ack`
heartbeat arrives, and how long after it if not; size the retry bound from
that measurement and cite it.

**Focused verification.**

- Stub-`orca` helper check, extended so the stub answers `worker-show` with a
  chosen `projection.provider.model`: the pinned selector gives `DISPATCHED`;
  another selector, `null`, or no projection gives `FAILED … pin not applied`
  with `worker-stop` and `worker-release` recorded; Model `default` never
  calls `worker-show`; Claude Code, Codex CLI and Cursor Agent CLI pins
  produce argv, spec and stdout byte-identical to a `git archive ce7a29c`
  (0.20.1) helper for the same inputs and never call `worker-show`.
- Node fake-`pi` extension check with the measured registry shape: a model id
  containing `:` with no effort resolves; two pin lines apply the last; one
  token means no level; an unknown selector, an unoffered level, and
  `setModel` false each exit with `DELY-PIN-FAIL` before any request; a
  second agent start does nothing.
- Gates: each new `package.json` gate goes red on a scratch copy whose
  `package.json` has another version, invalid JSON, or a `type` field.

**Document impact.** `harnesses.json` notes and the two skills own the facts
this task changes; `AGENTS.md` owns the gates.

### 2. OMP's install, trust and checklist are stated and checked

**Behaviour.**

- `README.md` OMP section: install from a dedicated clone, never a working
  checkout, because `omp plugin install <path>` links rather than copies;
  `omp plugin disable dely` as the removal when `bun` is absent; Dely's
  `setup` and `delivery` are not namespaced in OMP and take precedence over a
  project's own skills of those names; OMP has no workspace-trust gate and
  follows the user's `tools.approvalMode`; the pin format
  `dely-pin: <selector> <effort>`; Checked versions OMP `18.3.4`.
- `probe/checklist.md`: the OMP install check asks OMP what it resolved —
  `omp skill list --json` must give `delivery` and `setup` with `filePath`
  under the linked `dely` package and `source` `omp-plugins:user` — and
  hashes `omp/dely-pin.ts` together with `SKILL.md` and `dely.js` against
  the snapshot. Step 13 uses `omp plugin disable dely` when `bun` is absent.
  Row 8 also requires `DISPATCHED` (the post-acknowledgement check passed);
  a new condition in row 8 or a new row: a pinned Model whose worker reports
  another model gives `FAILED … pin not applied`, observed by dispatching
  with the extension disabled (`omp plugin disable dely` and re-enable, or an
  equivalent that does not touch the user's configuration beyond this
  plugin). The release floor becomes ten rows: rows 10 and 11 run when
  `start()` in `dely.js` or `omp/dely-pin.ts` changes. Rows 8, 9 and 12 rerun
  after every OMP upgrade, recorded next to the OMP version.

**Direction.** Keep the checklist's row format; each changed pass condition
names the observation that distinguishes pass from fail.

**Focused verification.** Run the new install check against a stub `omp`
whose `skill list --json` reports (a) the linked package, (b) another source
for `delivery`, (c) a missing `setup`, and a snapshot whose extension was
altered; only (a) unaltered passes. A human-equivalent read of the rest.

**Document impact.** `README.md` owns install guidance; `probe/checklist.md`
owns live verification.

## Acceptance

| Requirement | Instrument | Counterexample | Observed red |
| --- | --- | --- | --- |
| A pinned Model that the worker is not running fails the dispatch | Stub `orca` answering `worker-show` with another model, `null`, none; live row 8 variant with the extension disabled | Helper prints `DISPATCHED` anyway, or only warns | |
| A pinned Model that the worker is running dispatches normally | Stub with the pinned selector; live row 8 | Check compares a different field or format and fails a correct pin | |
| The pin line is unambiguous | Fake `pi`: model id with `:` and no effort resolves | Extension still splits on `:` | |
| The helper's pin wins over a spec's | Fake `pi` with two lines; stub prompt from a spec containing a line | Extension applies the first line | |
| Other harnesses unchanged | Stub comparison against a `ce7a29c` snapshot helper; no `worker-show` call | Check or pin line reaches Claude, Codex or Cursor | |
| `package.json` is gated | Scratch copies with wrong version, invalid JSON, `type` field | A gate that passes on any of them | |
| The OMP install check discriminates | Stub `omp` cases (a)–(c) and altered extension | Check that compares a linked file with itself | |
| Setup offers an OMP pin | Human reads `skills/setup/SKILL.md` against `harnesses.json` and `omp models --json` | Setup writes `default` for a `modelPin: spec` harness | none: a human reads the diff |

**Cannot be observed:** a Model `default` dispatch whose spec carries its own
pin line; OMP versions other than the installed one; git-URL install and
`bun` uninstall.

## Stop conditions

- `projection.provider.model` is absent, lags without bound, or reports a
  format other than the selector at acknowledgement: `NEEDS_REPLAN`.
- The post-acknowledgement check needs a branch on the harness id:
  `NEEDS_REPLAN`.
- Anything in this plan requires changing `package.json` content or a
  manifest: `NEEDS_REPLAN`.

## Closure gates

From the repository root, every gate in `AGENTS.md` as amended by Task 1.
