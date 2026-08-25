# Dely design continuity — 2026-08-23

Read this file first in a new session before continuing design. **Do not implement until the owner asks.**

**Approved direction:** `docs/_plans/2026-08-23-sequential-identity-design.md`. That file is the contract. Order: **P1 (`0.11.0`) → Docs (this repo, no plugin bump) → P2 (`0.12.0`) → P3 prep (live Grok adapter on installed `0.12.0`) → P3 (`0.13.0`)**.

Codex GPT-5.6-Sol extra high reviewed the contract (2026-08-24). Owner folded issues 1–6 into the spec and declined issue 7 (no TSV schema for `~/.dely/log`).

Long draft, superseded as product shape: `docs/_plans/2026-08-23-composition-kernel-design.md`. Treat it as a research draft with withdrawn sections, not as an approved contract.

Repository artifacts stay English. Conversation follows the user (Vietnamese in the originating session).

---

## Status

- Package on disk: `dely` **0.10.0**.
- Direction chosen: sequential four-phase skill is the product (no kernel split, no overlay). **P1–P3 and Docs not started.**
- `docs/decisions.md` Rejected table still lists Superpowers `writing-plans` / `executing-plans` as protocol-rejected. **Do not amend that table** in P1; the freeze becomes Settled in P1 without rewriting that row.

---

## Owner decisions (research freeze — treat as given)

These were stated by the product owner in the originating Control session. They override conflicting text in the composition-kernel draft.

1. **No implementation until a direction is chosen.** Design and research only.

2. **Dely is sequential and controllable, with a choice of harness per phase.** One job at a time, on the checkout the session is in.

3. **Dely does not use in-harness subagents** (`Task`, Superpowers SDD, nested reviewer subagents).

4. **Dely does not orchestrate parallel worktrees.** If a human wants parallelism, they create worktrees themselves (git or Orca) and run Dely **independently** on each. Those runs do not share a Dely Run, mailbox, or coordinator.

5. **Isolation/Concurrency are not Dely profile keys.** Earlier draft Decision 13 (`parallel` requires `worktree`) is **withdrawn**. Serial-on-current-checkout is product identity, not a flip.

6. **Superpowers is a habit outside Dely**, not a Dely `Process` pack. Dely does not compose, rewrite, catalogue, or select Superpowers. Compatible skills remain invocable because the **harness** installs them. `Process: superpowers` is **withdrawn**. The Superpowers composition procedure in the long draft is **withdrawn**. **Do not name Superpowers in `skills/delivery/SKILL.md`.**

7. **Herdr is hidden** until one real Dely plan has run with Herdr as coordinator. Coordinator enum in any later design: `orca | none` only. Do not offer Herdr in setup even if `herdr` is on `PATH`. Never stack Herdr with Orca in one protocol.

8. **Orca first** as coordinator (transport: TUI, `ask`/`reply`, `worker_done`). Direct headless `claude -p` / `codex exec` / `grok --prompt-file` is fallback only. Do not wrap those in a visible shell and call it a TUI.

9. **P1 public copy** (locked): the sentence `Sequential delivery. One job, current checkout, harness per phase. No subagents, no worktree fan-out.` on **four** fields — both plugin.json descriptions and both description fields in `.claude-plugin/marketplace.json`. README H1 = `# Dely`. Codex `interface.shortDescription` / `defaultPrompt` **unchanged**.

10. **Superpowers pack pin**, if anyone ever needed filenames: schema is **roles**, not a doctor catalogue; 6.3.0 names are dated observations. Moot while Superpowers is outside Dely.

11. **Journal** is an optional evidence rail. Absence is not a failed delivery. Doctor is an ops CLI, not an implement step. Process notes are not committed protocol (`docs/delivery-log.md` is deleted in Docs; README/Settled/options present-tense protocol claims are superseded in that unit). Opt-in corpus is `~/.dely/log` after P2, file-exists only, no setup question, no `bin/delivery-record`, no frozen line schema.

12. **No runtime compatibility** with `~/.delivery-journal`. P3 changes the default to `~/.dely/journal` and `mv`s once on the implementing machine; shipped code does not mention the old path. **P3 prep:** before the P3 plan edits checkout hooks, refresh Grok wiring so the live adapter points at installed `0.12.0`, not this checkout.

---

## What Dely owns vs what it does not

**Owns (keep as the product):**

- Sequence: classify Routine / Planned / Critical; `design → implement → review → release` as today’s skill. Kernel + `dely:phases` **will not** be built.
- Harness/model/effort **per phase** in the `AGENTS.md` managed block (unpinned environment was a large loss class).
- Tool-layer **verbatim gate output** (journal), **when wired**. OTel lacks output text.
- Identifiers resolved by `git` at use-time; stale remote-tracking refs labelled.
- Recurrence **two ways**: add only when the same failure recurs under this workflow; delete when it can no longer happen or the sentence no longer changes worker behaviour. AI may propose; a human promotes. **No auto-written `AGENTS.md` or auto-mutated skills** (Gloaguen et al., arXiv:2602.11988, 2026: LLM-generated context files ~−3% success, ~+20% cost).
- Discriminating acceptance: Counterexample is a wrong implementation that **exists, runs, and passes**. Baseline-red is insufficient.
- Plan sizing: one implementation session finishes one coherent review unit; split is the strongest proven lever.
- Independent review **by role**: a fresh session that does not implement or edit. No phase-implied sandbox.
- Merge is the product owner's act. `git-hooks/pre-push` stays (`cc-safety-net` does not cover push-to-main).

**Does not own:**

- Superpowers (or any third-party process pack).
- Orchestration runtime (Orca).
- Safety parser (`cc-safety-net`).
- Parallelism / worktree graphs.
- Plugin install / skill discovery walks.
- Package diary as worker intake (`docs/findings.md` is archive; not default `AGENTS.md` source of truth after Docs).

**Glue, not product** (do not grow; upstream or delete when the native hole closes):

- Orca `input_accepted` ≠ submitted: 90s + TUI read + one Enter (`docs/decisions.md` 2026-08-22). Deferred native: `input_submitted`.
- Grok plugin hooks discovered but not dispatched: `~/.grok/hooks/delivery.json` from `hooks/grok-hooks.json.template`.
- `bin/delivery-doctor` as a platform; keep wiring checks, do not add Enter-recovery or Orca-liveness.

---

## Market sentence (P1 README opener)

> A sequential delivery workflow and the rails that make its guarantees mechanical, packaged for Claude Code, Codex CLI and Grok Build. One job at a time, on the checkout you are in. It does not spawn subagents or create worktrees. If you want parallelism, you create the checkouts and run Dely independently on each.

**Wrong product for:** spec-kit SDD, BMAD personas, GSD’s 29 skills, Superpowers *with* subagents/worktrees as the workflow, Orca-style parallel worktree fan-out as the process.

**Commodity (do not reinvent):** spec-kit constitution/presets; Superpowers process skills; cc-sdd/Kiro; BMAD; GSD; Beads; Orca; Herdr; `ruler`; `AGENTS.md`; Claude user/project/plugin scopes; `cc-safety-net` user/project/GitHub scopes.

**Unique enough to keep arguing for:** sequential multi-harness control with a **pinned** harness per phase; no subagents / no Dely worktrees; Counterexample; optional journaled stdout; two-way recurrence; thin protocol over Orca — not a second SDLC.

---

## Superpowers while Dely owns delivery

Probes (observational: sessions *read* skills and reported what they would do; they did **not** actually run SDD/`git worktree`):

| Harness | Session | Superpowers on disk |
| --- | --- | --- |
| Grok Build `grok-4.6` medium | `01a02d9d-2109-7d62-a9c8-727e881cc87e` (Orca tab `dely-superpowers-probe`) | `grok plugin list`: `superpowers`, `dely`, `ponytail` |
| Claude Code Opus | `fdd5954a-53a0-4505-9039-9f90cacfde9d` (Orca tab `dely-superpowers-probe-claude`) | `superpowers@claude-plugins-official` 6.3.0 enabled |
| Codex CLI `gpt-5.6-sol` high | `01a02da1-d0af-7331-b444-b5600d5d3da7` (Orca tab `dely-superpowers-probe-codex`) | `codex plugin list` did **not** show Superpowers; the session still loaded `~/.codex/plugins/cache/openai-curated-remote/superpowers/6.3.0/` |

All nine skills were discoverable on all three. `using-superpowers` auto-applies (Claude: SessionStart injects the full skill into `<EXTREMELY_IMPORTANT>`). Superpowers: user instructions (`AGENTS.md`) take precedence.

| Skill | In-session ritual under Dely | Do not follow as written |
| --- | --- | --- |
| `brainstorming` | Yes (Control/design talk) | Later handoff to `writing-plans` |
| `writing-plans` | Checklist only | `REQUIRED SUB-SKILL` SDD / executing-plans |
| `executing-plans` | No | worktree + SDD + finishing |
| `requesting-code-review` | No | dispatch `general-purpose` subagent |
| `receiving-code-review` | Yes | — |
| `finishing-a-development-branch` | Test/menu only | merge / `git worktree remove` |
| `test-driven-development` | Yes | — |
| `systematic-debugging` | Yes | — |
| `verification-before-completion` | Yes | — |

The behavioural fence belongs in `skills/delivery/SKILL.md` (P1 opener + worker-entry), not in a Superpowers compose layer. This repo’s `AGENTS.md` must **not** grow `Process: superpowers`.

---

## Withdrawn (do not resume)

From the composition-kernel draft and later reversals:

- Isolation/Concurrency keys; `Process: superpowers`; Superpowers compose procedure.
- Herdr as a legal slug; stacking coordinators.
- User overlay `~/.dely/profile.md` and doctor profile merge.
- Setup asking to create `~/.dely/log`; `bin/delivery-record`.
- Runtime `mv` / dual-read of `~/.delivery-journal`.
- Identity restated under Control as well as opener + worker-entry.
- Rewriting `docs/findings.md` in the Docs unit.
- Frozen TSV/CSV/JSONL schema for `~/.dely/log` (Codex review issue 7; declined).

---

## How to resume

1. Read `docs/_plans/2026-08-23-sequential-identity-design.md`, then this file, then `AGENTS.md`, `skills/delivery/SKILL.md`, `docs/decisions.md` Settled “thin protocol” and Rejected table.
2. Do **not** start PR1–PR5 from the composition-kernel draft.
3. If the owner asks to implement, classify Planned, write a **new** decision record from the sequential-identity design, and start at P1. Do not edit the two hook scripts until P3, and only after P3 prep.
4. Docs unit is this repository only: `AGENTS.md` prose + delete `docs/delivery-log.md` + present-tense reconciliation in README / Settled / options. No plugin bump. Leave `docs/findings.md`.
5. P3 does not start until Grok’s live adapter points at installed `0.12.0`.

---

## Probe artifacts (scratch; may vanish)

- Prompt: `/var/folders/kq/rgyys4bn28sc66mn8frgt2_40000gn/T/grok-hieuphung/dely-superpowers-probe.md`
- Grok export: same directory `dely-superpowers-probe-result.md`
- Claude transcript: `~/.claude/projects/-Users-hieuphung-Projects-dely/fdd5954a-53a0-4505-9039-9f90cacfde9d.jsonl`
- Codex rollout: `~/.codex/sessions/2026/08/23/rollout-2026-08-23T14-59-34-01a02da1-d0af-7331-b444-b5600d5d3da7.jsonl`

Orca tabs may still be open: `dely-superpowers-probe`, `dely-superpowers-probe-claude`, `dely-superpowers-probe-codex`. Safe to close; they were observational.
