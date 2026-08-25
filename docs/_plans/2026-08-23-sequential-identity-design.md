# Sequential Dely — approved direction

| Field | Value |
| --- | --- |
| Status | Approved direction. **Do not implement until the owner asks.** |
| Date | 2026-08-23 |
| Package on disk | `dely` 0.10.0 |
| Supersedes (direction) | `docs/_plans/2026-08-23-composition-kernel-design.md` as the product shape |
| Does not supersede yet | `docs/decisions.md` Rejected Superpowers row; shipped 0.10.0 skill |

Repository artifacts stay English. Conversation follows the user.

This file is the design contract. It is not an execution plan and not a decision record. When the owner asks to implement, classify Planned, write a **new** decision record from this file, and start at **P1**.

**Order:** P1 (`0.11.0`) → Docs (this repository, no plugin bump) → P2 (`0.12.0`) → **P3 prep** (refresh live Grok wiring onto installed `0.12.0`) → P3 (`0.13.0`). Do not start a later unit until the previous is accepted. Edit `hooks/session-start-context.sh` and `hooks/post-tool-journal.sh` only in **P3**, and only after P3 prep has made the live adapter point at an installed copy that is **not** this checkout. See P3.

Codex GPT-5.6-Sol extra high reviewed this contract (read-only, 2026-08-24). Owner accepted issues 1–6 into this file and declined issue 7 (no frozen TSV schema for `~/.dely/log`).

---

## Product

Dely is a sequential delivery workflow. One job at a time, on the checkout you are in, with a harness chosen per phase. It does not spawn subagents or create worktrees. If you want parallelism, you create the checkouts and run Dely independently on each.

The four-phase skill **is** the product. There is no composition kernel, no `dely:phases` pack, no `~/.dely/profile.md`, and no Isolation/Concurrency keys.

It serves the maintainer by staying a thin protocol over tools already on the machine (Orca TUIs; harness plugins such as Superpowers and Ponytail). It serves open source by **not** shipping that personal stack. Installers get sequence, per-phase pins, Counterexample, optional journaled stdout, and two-way recurrence — not Superpowers, Ponytail, or a second orchestrator.

**Wrong product for:** spec-kit SDD, BMAD, GSD, Superpowers *with* subagents/worktrees as the workflow, Orca-style parallel worktree fan-out as the process.

Stay on `0.x` until a second coordinator is observed. Coordinator remains `orca | none`. Do not offer Herdr.

### What is mandatory vs optional vs out

| Piece | Role | In the portable skill? |
| --- | --- | --- |
| Four-phase workflow, classify, Counterexample, plan sizing, independent review that reproduces, two-way recurrence, human merge | Product | Yes |
| Managed block (coordinator + phase table) | Project pins | Setup writes it; skill reads `AGENTS.md` |
| Journal + `delivery-evidence` | Optional evidence rail (what the implementer ran) | Cite **if** a path is available; absence is not a failed delivery |
| `bin/delivery-doctor` | Ops CLI (is wiring present) | **No.** README/setup, not implement/review |
| Process log `~/.dely/log` | Maintainer/forker corpus | **No** until P2, and then only one Control sentence; never required |
| `git-hooks/pre-push` | Safety, not protocol | Unchanged |
| Grok adapter | Glue so Grok journals | README/doctor, not skill prose |

User taste (Superpowers, Ponytail) follows harness plugins, not Dely.

### Freeze (do not relitigate)

- Sequential, one job, current checkout; harness chosen per phase.
- No in-harness subagents; no Dely-owned worktree fan-out (DIY worktrees = independent Dely runs).
- Superpowers is outside Dely. In-session rituals may still be used; do not follow their subagent/worktree/merge branches while Dely owns the run. **Do not name Superpowers in `skills/delivery/SKILL.md`.**
- Orca is coordinator; Herdr deferred.
- No auto-written `AGENTS.md` or live skill mutation.
- No composition kernel, no overlay, no Isolation/Concurrency keys.
- Process notes are not a committed protocol artifact. Journal is not a failed-delivery condition.
- No shipped compatibility with `~/.delivery-journal`.

---

## P1 — Identity (`0.11.0`)

Portable contract and public claim. **Do not edit hooks.** Do not mention `~/.dely/log`. Do not add `bin/delivery-record`. Do not change `dely:setup` log behaviour. Do not edit this repository's `AGENTS.md` source-of-truth list (that is Docs). Do not delete `docs/delivery-log.md` (that is Docs).

### Skill — opener (replace the 41-plans paragraph)

> Every rule here exists because a delivery lost a round without it. Nothing is here for symmetry. If a rule stops earning its place, delete it.
>
> This workflow is sequential. One job at a time, on the checkout this session is in. Do not spawn in-harness subagents. Do not create worktrees. A checkout the human created is a separate run of this workflow; do not share a coordinator, mailbox, or plan with it.

Keep the `Read AGENTS.md…` sentence immediately after.

Identity is stated **here and in worker-entry only**. Do not repeat it under `## The control session drives`. Keep Control's existing "It does not implement, and it does not review."

### Skill — `## Phases` worker-entry

Replace the current worker sentence with:

> A worker selects the phase it was sent to and does only that phase. It does not classify the change, does not launch further workers, and does not spawn subagents.

### Skill — `### Changing this skill` (two-way recurrence)

> **Add a rule only when the same failure recurs under this workflow.** One incident is not policy.
>
> **Delete a rule when its failure can no longer happen under this workflow**, or when the sentence no longer changes what a worker does. Historical notes are not a reason to keep it.
>
> Before adding a rule, check whether a mechanism can enforce the fact instead. A rule asking a worker to be careful with a value is weaker than a program that supplies the value. Before keeping a rule, check that its failure mode is still possible.

Drop “two of seven recorded corrections.”

### Skill — handoff / journal / doctor

Keep the handoff template and `END OF HANDOFF`.

Replace the block that **begins at the existing** “Under `Verification`” paragraph (`skills/delivery/SKILL.md` immediately after `END OF HANDOFF`) **through** “wait is the point”. Do not leave the old paragraph in place and insert a second one. The replacement is:

> Under `Verification`, cite each gate by command. Do not transcribe output.
>
> Where a journal path is available, cite `delivery-evidence -g` for that command. Do not dump the session, and do not read raw journal files. Where the harness recorded nothing, say so and paste the summary line. Treat that line as the claim under check, not as the check.
>
> **Never background a gate.** A backgrounded call is recorded as finished with no output.

Do not require `delivery-doctor` in implement. Do not explain the Grok adapter in the skill.

### Skill — `## release`

> Commit the implementation. Reconcile the documents that own changed paths. Delete the plan, having moved anything durable into the decision record or those documents. Run the closure gates.
>
> Then prepare the pull request. Merging is the product owner's act.

**Delete** `### Delivery log` (heading and body).

### Skill — `## What the harness supplies`

Keep the three identifier/evidence bullets. Add:

> A journal, when wired, is optional evidence of what ran. It does not replace running the gates. Absence of a journal is not a failed delivery.

### Skill — `### Launching a worker` (one added sentence, no new heading)

After the existing “Write the prompt to a file…” paragraph, add:

> The prompt names the role and the artifact paths. It does not paste this skill or `docs/findings.md`.

Keep the rest of the section. Cut autobiography (9m49s, etc.) per the audit table. **Do not** rename `### Launching a worker` or `### Acceptance` (tests bind those headings).

### Skill audit (cut autobiography, keep rules)

No `##` heading is deleted. Frontmatter and Codex `interface.shortDescription` / `defaultPrompt` stay.

| Part | Action |
| --- | --- |
| Frontmatter | Keep |
| Opener (41 plans + AGENTS.md) | Rewrite (ethic, no count; identity) |
| `## Classify first` | Keep |
| `## Phases` | Rewrite worker-entry only |
| `## The control session drives` | Keep existing implement/review ban; **do not** restate identity |
| `### Launching a worker` | Keep + prompt-paths sentence; cut 9m49s; keep “timeout with headroom”; keep 90s Enter glue |
| `### Model and effort per phase` | Keep |
| `### Escalate rather than guess` | Keep |
| `## design` | Keep |
| `### Plan sizing` | Keep the rule; drop the eighty-call-site story |
| `### Allowed scope` | Keep the rule; drop “Three plans lost” |
| `### Acceptance` | Keep Counterexample; drop “nine plans” / “ninth was this repo” |
| `## implement` | Keep |
| `### Handoff` | Rewrite journal/doctor as above |
| `## review` + remediation | Keep |
| `## release` | Rewrite; delete `### Delivery log` |
| `### Changing this skill` | Rewrite (two-way recurrence) |
| `## What the harness supplies` | Keep + journal-optional sentence |
| `## Language` | Keep |

### Token rules (skill)

1. Agents do not write the journal.
2. Teach citation once in the skill. SessionStart value injection is a later hook trim (P3), not P1.
3. Handoff cites `delivery-evidence -g` or a summary line — no pasted gate stdout.
4. Doctor is not part of implement.
5. Worker prompts: role + paths; do not paste the skill or `docs/findings.md`.
6. Workers read findings/decisions/options only when the plan names those paths.

### Public copy

Set this sentence on **four** public description fields: `.claude-plugin/plugin.json` `description`, `.codex-plugin/plugin.json` `description`, `.claude-plugin/marketplace.json` top-level `description`, and `.claude-plugin/marketplace.json` `plugins[0].description`:

> Sequential delivery. One job, current checkout, harness per phase. No subagents, no worktree fan-out.

Codex `interface.shortDescription` stays `Design, implement, review independently, close`. `defaultPrompt` stays.

README — replace the H1 and the four opening lines:

```markdown
# Dely

A sequential delivery workflow and the rails that make its guarantees mechanical, packaged for Claude Code, Codex CLI and Grok Build. One job at a time, on the checkout you are in. It does not spawn subagents or create worktrees. If you want parallelism, you create the checkouts and run Dely independently on each.

The workflow is `skills/delivery/SKILL.md`. Every rule exists because a delivery lost a round without it. Nothing is here for symmetry. Project pins — coordinator and per-phase harness, model and effort — are written into `AGENTS.md` by `dely:setup`.
```

Do not rewrite the rest of the README in P1. Drop “41 recorded plans” from that opener only.

### Decisions

Move the 2026-08-23 Open freeze into Settled, from this file. **Do not edit** the Rejected row for Superpowers `writing-plans` / `executing-plans` (those skills still mandate SDD/worktrees).

Bump both plugin `version` fields and `tests/managed-block-contract.sh` to `0.11.0`.

### P1 acceptance (discriminating)

Each instrument must be red on shipped 0.10.0 for the **positive** half of the row. Invariants that are already true (Control does not restate identity; Superpowers is unnamed) are folded into a row whose positive half is new.

| Requirement | Instrument | Counterexample |
| --- | --- | --- |
| Opener + worker-entry state sequential identity; Control does not repeat that paragraph; skill does not name Superpowers | Focused test on `skills/delivery/SKILL.md` only: opener identity present, worker-entry present, Control section has no second copy of the opener identity paragraph, case-insensitive Superpowers absent | Fence only in README; or opener + Phases + Control all repeat the same three sentences; or a do-not-follow catalogue of Superpowers skill names |
| Skill does not require doctor or a committed delivery-log; Handoff has exactly one `Under Verification` block | Same file | 0.10.0 handoff still says run doctor; `### Delivery log` still present; or two consecutive `Under Verification` paragraphs |
| Two-way recurrence is in `### Changing this skill` | Same file contains both the add-on-recurrence rule and the delete-when-unearned rule | Only the 0.10.0 add-only paragraph remains |
| Worker prompt is role and paths only | `### Launching a worker` contains the role-and-paths sentence | Sentence missing after the rest of P1 is applied |
| Journal is optional; citation taught once | `## What the harness supplies` has the optional-journal sentence; implement does not require doctor; Handoff cites `delivery-evidence -g` or a summary line | Optional sentence missing, or doctor still required, or Grok-adapter essay still in the skill |
| Autobiography cut | Same file does not contain `41 recorded plans`, `nine plans`, `eighty call sites`, `9m49s`, or `414ms` | Identity added, 41-plans opener still present |
| All four public descriptions match the locked sentence | `jq` on both plugin.json files **and** both description fields in `.claude-plugin/marketplace.json` | plugin.json updated, marketplace.json still “cross-harness delivery workflow” |
| README H1 is `Dely` | `README.md` first heading | Description changed, title still `delivery-evidence` |
| Version pin | `tests/managed-block-contract.sh` and both plugin.json `version` fields are `0.11.0` | Description changed, version left `0.10.0` |

A row whose instrument is already green on 0.10.0 does not count. “The feature is absent” is not a Counterexample.

---

## Docs — this repository only (no plugin bump)

After P1 is accepted. Not a portable-contract change. **Do not edit hooks.** **Do not bump** plugin versions.

### `AGENTS.md` prose (outside the managed block)

Workers delivering a change read: the delivery skill, the gates and paths in this file, and the plan. They do not treat package history as intake.

Replace `## Source of truth` so that:

- The workflow contract is `skills/delivery/SKILL.md`.
- Gates, default branch, and artifact paths live in this file outside the managed block.
- Install and wiring live in `README.md`.
- `docs/decisions.md`, `docs/findings.md`, `docs/options.md`, and `docs/harness-surface.md` are package-maintainer documents. Read them when the **plan names those paths**, not by default.

Delete the bullet `The delivery log is docs/delivery-log.md`.

Do not edit the managed block.

The file's own H1 may become `Dely — Agent Instructions` so it matches README; that is not load-bearing.

### Delete `docs/delivery-log.md` from the tree

Git history keeps the file. `docs/findings.md` is **untouched** (no rewrite, no split).

### Present-tense reconciliation (not a docs sweep)

These statements treat a committed delivery log as **current protocol**. They are in scope. Historical narrative that a past plan used a log file may remain.

- `README.md`: stop saying a consuming project supplies where its delivery log lives, and stop saying the skill owns a five-column delivery-log shape. After P1 the skill does not own that shape. Optionally one forker line for `~/.dely/log` waits for P2; in Docs, omit it.
- `docs/decisions.md` Settled clauses that name a delivery-log path as a live protocol contract, learning input, or self-hosting requirement: add a **dated supersession** (the committed log is no longer protocol; process notes are machine-local after P2). Do not rewrite the rest of the file. **Do not amend** the Rejected Superpowers row.
- `docs/options.md` present-tense rows that call `docs/delivery-log.md` “existing” or “41 rows in use”: mark superseded, same date. Do not rank an artifact that no longer exists as the current answer.

Do not sweep `docs/findings.md`.

### Docs acceptance

| Requirement | Instrument | Counterexample |
| --- | --- | --- |
| Log file gone; findings remain; `AGENTS.md` is not default worker intake for findings | `test ! -e docs/delivery-log.md` AND `test -f docs/findings.md` AND focused test on `AGENTS.md` outside the managed block | File deleted, Source of truth still requires findings; or findings deleted in the same unit |
| README no longer requires a project delivery-log path or five-column skill-owned shape | Focused test on `README.md` | File deleted; README still says consuming projects supply a delivery log and the skill owns its shape |
| Settled protocol and options no longer treat the committed log as current | Dated supersession present in `docs/decisions.md`; `docs/options.md` does not rank the deleted file as the live answer | File gone; Settled still requires a delivery-log path as protocol |
| Plugin version still `0.11.0` | `jq` on both plugin.json files | Docs commit also bumped to `0.12.0` |

---

## P2 — Process log (`0.12.0`)

Machine-local corpus for people improving Dely. Ordinary users never need to know the file exists. **Not overlay:** doctor does not read `~/.dely/`; Control does not merge a profile.

**No `bin/delivery-record`.** No setup question on Quick or Customize.

**Opt-in.** Create `~/.dely/log` (or set `DELY_LOG` to a path). README, one line for forkers:

> Maintainers improving Dely may `touch ~/.dely/log`; at Planned close, Control appends one mechanical line if that file (or `DELY_LOG`) exists. Delete the file to opt out. Ordinary installs never create it.

**Skill — one sentence, Control, Planned close only** (including `ACCEPT` after `REMEDIATE_ONCE` / `REPLAN_OR_SPLIT`). Not Routine. Not implement/review:

> After closing a Planned unit, if `~/.dely/log` exists or `DELY_LOG` is set, append one line from the handoff (plan, harness, status, disposition). Otherwise do nothing. Do not write prose. Leave any Dely-drift column empty unless a human filled it.

Do **not** freeze a TSV/CSV/JSONL schema in this unit. One mechanical line is enough; aggregation across machines is the maintainer’s problem.

**Opt-out.** Delete or rename `~/.dely/log`. No second flag, no managed-block column, no `DELY_RECORD=0`. Doctor does not FAIL on a missing log and does not nag to enable it.

Creating `~/.dely/journal` (P3) does **not** create `~/.dely/log`.

Bump both plugin manifests and `tests/managed-block-contract.sh` to `0.12.0`.

### P2 acceptance

| Requirement | Instrument | Counterexample |
| --- | --- | --- |
| Control records when the file exists; setup stays silent; no `delivery-record` binary | Skill contains the one Control sentence AND `skills/setup/SKILL.md` does not mention `~/.dely/log` AND `test ! -e bin/delivery-record` | Binary added, or setup asks to create the log, or Control sentence missing after version bump |
| README documents forker `touch` / delete | README | Skill records, README silent |
| Doctor does not treat a missing log as wiring failure | `delivery-doctor` in a scratch HOME with no `~/.dely/log`: exit 0 on that concern; stdout does not tell the user to enable the log | Doctor FAIL or nags to create `~/.dely/log` |
| Version pin | Both plugin.json `version` fields and `tests/managed-block-contract.sh` are `0.12.0` | Skill sentence added, version left `0.11.0` |

---

## P3 — Journal home (`0.13.0`)

### Prep (required before the P3 plan starts)

Grok executes `hooks/session-start-context.sh` and `hooks/post-tool-journal.sh` by **absolute path** from whichever copy the adapter points at. Editing the checkout copy while that copy is live changes the harness under a worker.

Before opening the P3 plan:

1. P2 (`0.12.0`) is accepted and installed.
2. Refresh plugin caches and Grok hook wiring so the **live** adapter points at the frozen **installed** `0.12.0` copy, not this checkout. Verify with `delivery-doctor` (absolute paths in `~/.grok/hooks/delivery.json` are under the installed plugin, not `…/Projects/dely/hooks/`).
3. Only then may the P3 plan edit the **checkout** hook files. They are no longer the live harness.

Do not weaken `AGENTS.md` into “edit hooks during P3 anyway.” After P3 is accepted, refresh wiring onto the new installed copy **between** plans, same as today.

This repo’s `AGENTS.md` hook-freeze sentence stays. Docs may add one clause: P3 is the only unit that edits those two files, and only after this prep.

### Runtime

Default journal directory becomes `~/.dely/journal`. `DELIVERY_JOURNAL_DIR` still overrides (tests stay isolated).

**No compatibility with `~/.delivery-journal`.** Shipped code must not mention, read, merge, or `mv` that path. Skill continues to say only: if a journal path is available, cite `delivery-evidence -g`. During **implementation of this unit**, on the machine doing the work, the human (or a one-off command in the plan that is **not** shipped) may `mv ~/.delivery-journal ~/.dely/journal` if the old directory exists. Other machines that never move it start an empty journal at the new path; leftover files sit unused.

Creating `~/.dely/journal` does **not** create `~/.dely/log`.

Optional same-unit trim: SessionStart injects identifier values and one journal path line; drop the journal tutorial duplicated in the skill.

Bump both plugin manifests and `tests/managed-block-contract.sh` to `0.13.0`.

The in-directory `.raw.jsonl` event layout is a different legacy; this unit does not retire it unless a later plan does.

### P3 acceptance

| Requirement | Instrument | Counterexample |
| --- | --- | --- |
| New default home is `~/.dely/journal`; override still wins; creating the journal dir does not create `~/.dely/log` | Doctor/evidence/hooks in a temp HOME with override unset write under `…/.dely/journal` and do not create `…/.dely/log`; existing tests with `DELIVERY_JOURNAL_DIR` still isolate | Code still writes `~/.delivery-journal`, or override ignored, or writer also `mkdir`s `log` |
| Repo shipped code does not mention `~/.delivery-journal` | `git grep` excluding `docs/_plans` and historical `docs/findings.md` / `docs/decisions.md` | Runtime still `mv`s or dual-reads the old path |
| Version pin | Both plugin.json `version` fields and `tests/managed-block-contract.sh` are `0.13.0` | Path changed, version left `0.12.0` |

---

## Non-goals (all units)

- Kernel + `dely:phases`, `Process: superpowers`, user overlay / doctor profile merge.
- Naming Superpowers in the delivery skill.
- Herdr; stacking coordinators.
- Auto-written `AGENTS.md` or auto-mutated skills.
- Rewriting the whole README; changing skill frontmatter or Codex `defaultPrompt`.
- `bin/delivery-record`; setup opt-in questions; agent-authored process-log prose.
- Runtime journal migration; dual-read of `~/.delivery-journal`.
- Growing doctor (Enter recovery, Orca liveness, FAIL on missing log).
- Rewriting `docs/findings.md`; amending the Rejected Superpowers row.
- Frozen TSV/CSV/JSONL schema for `~/.dely/log` (Codex review issue 7; declined).

---

## Market (why this is not spec-kit)

Listing must not stop at “across the harnesses you choose.” That slogan is occupied. The fence that is unique here: **one job, current checkout, harness pinned per phase, no subagents, no worktree fan-out**, plus Counterexample (a wrong implementation that exists, runs, and still passes), independent review as a **new session** that reproduces gates, and two-way recurrence that forbids LLM-authored `AGENTS.md`.

Journaled stdout is a rail, not the product pitch. `pre-push` / `cc-safety-net` are safety, not Dely.
