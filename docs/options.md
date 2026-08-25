# Options per layer, ranked for testing

**Historical research, superseded 2026-08-25.** This document is a snapshot of
the option comparison that led to the pre-migration evidence journal, doctor,
and hook rails. Those rails were removed as product components — see
"2026-08-25 — Dely is an automation-first thin control protocol" in
`docs/decisions.md` and the probe record in `docs/harness-surface.md`. Every
present-tense claim below about a hook, journal, or doctor being current,
needed, or in place describes that retired state, not the shipped product.
Read this as the record of a past evaluation, not current guidance.

The brief: prefer what already exists, keep it minimal, enumerate every option
rather than commit to one design per layer, and only consider tools that are
stable and actively maintained.

Constraints in force (from `decisions.md`): three harnesses, serial workflow, no
sandbox, full permission bypass, the reference consumer private on GitHub Free, real plans as
the test bed.

## Health bar

A candidate passes only if **all** of these hold:

- ≥ 1,000 stars, **or** first-party (Anthropic, OpenAI, xAI, GitHub, CNCF)
- last push within 90 days of 2026-08-19
- has a license
- not archived

Measured, 2026-08-19, from the GitHub API. Every candidate previously marked `?`
is now resolved.

**Pass**

| Repository | Stars | Last push | Licence | Note |
| --- | --- | --- | --- | --- |
| `github/spec-kit` | 130,334 | 2026-08-19 | MIT | GitHub first-party |
| `gastownhall/beads` | 26,458 | 2026-08-19 | MIT | 719 open issues — large backlog |
| `MrLesk/Backlog.md` | 6,499 | 2026-08-19 | MIT | |
| `graykode/abtop` | 3,457 | 2026-07-27 | MIT | |
| `openclaw/acpx` | 3,141 | 2026-08-19 | MIT | pre-1.0 by its own README |
| `intellectronica/ruler` | 2,877 | 2026-08-19 | MIT | |
| `nizos/tdd-guard` | 2,311 | 2026-08-16 | MIT | |
| `kenryu42/cc-safety-net` | 1,494 | 2026-08-19 | MIT | |

**Borderline**

| Repository | Stars | Last push | Licence | Why |
| --- | --- | --- | --- | --- |
| `humanlayer/humanlayer` | 11,296 | 2026-06-19 (61 d) | **NOASSERTION** | no recognised open-source licence |
| `coder/agentapi` | 1,485 | 2026-05-27 (84 d) | MIT | inside 90 days, only just |
| `gotalab/cc-sdd` | 3,626 | 2026-05-20 (91 d) | MIT | one day outside |

**Fail — recency**

| Repository | Stars | Last push | Stale by |
| --- | --- | --- | --- |
| `parcadei/Continuous-Claude-v3` | 3,931 | 2026-01-26 | ~7 months |
| `Pimzino/claude-code-spec-workflow` | 3,848 | 2025-09-07 | ~11 months |
| `ColeMurray/claude-code-otel` | 487 | 2025-06-17 | ~14 months |

**Fail — adoption**

| Repository | Stars | Licence |
| --- | --- | --- |
| `KB1SLN-Labs/agent-observability` | 13 | none |
| `KubeRocketCI/claude-code-telemetry` | 1 | Apache-2.0 |
| `dakshgulecha/rewind-ai` | 6 | MIT |

Not checked individually because the first-party rule already admits them:
`openai/symphony`, `github/gh-aw`. `agentsmd/agents.md` is a specification
rather than a tool.

### Two method notes worth keeping

**`updated_at` is not `pushed_at`.** `Pimzino/claude-code-spec-workflow` reports
`updated_at: 2026-08-18` while its last commit is `2025-09-07`. The first field
moves when anyone stars the repository. Casual browsing and most star-counting
tools show the misleading one.

**Paths rot.** Two of twelve had moved: `steveyegge/beads` is now
`gastownhall/beads`, and `claude-code-safety-net` is now `cc-safety-net`. Curated
lists keep the old paths. Resolve through the API before trusting a name.

**A repository can pass the bar and still be superseded.** `nizos/tdd-guard`
passed cleanly — 2,311★, pushed three days before measurement — and the first
admonition in its README says the project grew into `nizos/probity` and that new
projects should start there. `probity` has **171★**, pushed 2026-08-16, MIT, and
covers Claude Code, Codex and Copilot CLI rather than Claude Code alone.

Applied mechanically, the health bar picks the deprecated project. Stars and
recency measure adoption and liveness; neither detects a rename or a rewrite.
The cheap fix is to read the top of the README before trusting a number — which
is the only way this was caught.

**Consequence worth stating as a rule:** for glue, prefer writing fifty lines
against a CNCF-grade dependency over adopting a thirteen-star wrapper around it.
The OTel Collector, Prometheus and Grafana are the maintained parts; what the
small repos add is a pre-baked config file.

## Discovery sources beyond GitHub search

`subinium/awesome-claude-code` lists only repositories with 1,000+ stars and
spans Claude Code, Codex, Gemini CLI and Cursor — the health filter already
applied by someone else. `hesreallyhim/awesome-claude-code`,
`ithiria894/awesome-claude-code-hooks` and `heilcheng/awesome-agent-skills` cover
hooks and skills specifically. Hacker News threads worth reading rather than
citing: *Ask HN: Are you using an agent orchestrator to write code?* (item
46993479) and *Ask HN: Are cloud coding agents useful in real workflows yet?*
(item 47862274). The recurring finding in both is that framework adopters hit a
wall past the prototype, which is consistent with the decision here not to adopt
one.

Rank meaning: **1** try first, near-zero cost. **2** try if 1 leaves a gap.
**3** fallback, real work or a real dependency. **✗** rejected, reason given.
**?** newly found, passes the star bar, recency unverified.

---

## Layer A — Identifier resolution

| Rank | Option | Health | Notes |
| --- | --- | --- | --- |
| 1 | `SessionStart` hook injecting `additionalContext` | first-party mechanism | Written. Claude Code only; Grok inherits, Codex needs its own |
| 2 | Codex `notify` program | first-party | Fires at turn completion, wrong end of the turn |
| 3 | A generated file the skill is told to read | — | Harness-agnostic, needs a pre-step |
| ✗ | Values in `CLAUDE.md` / `AGENTS.md` | — | Static, no evaluation; a SHA there is stale next commit |
| ✗ | Ask the model to run `git rev-parse` itself | — | Current behaviour, and where Plan J, Plan K and Plan L failed |

---

## Layer B — Evidence capture

| Rank | Option | Health | Notes |
| --- | --- | --- | --- |
| 1 | Claude Code native OTel | first-party | `claude_code.tool_result` gives `tool_name`, `tool_use_id`, `success`, `duration_ms`, `error_type`, `decision_source`. With `OTEL_LOG_TOOL_DETAILS=1` Bash adds `bash_command`, `full_command`, `dangerouslyDisableSandbox`, and **`git_commit_id`** on a successful commit |
| 1 | Codex native OTel | first-party | Metrics, logs and traces for API requests, tool calls, approvals; plus `hooks.run` metrics |
| 2 | `PostToolUse` hook journal | first-party mechanism | The one thing OTel lacks: the tool's **output text**, which is what a verbatim summary line is |
| 3 | Grok `signals.json` + `terminal/*.log` | first-party, undocumented | Observed directly. Treat the shape as unstable |
| ✗ | Shell auditing (`script`, `atuin`, `asciinema`) | healthy tools | Wrong layer — captures the terminal, not the agent, with no session correlation |

Grok has no CLI-level OTel. Third-party xAI observability guides instrument the
*API*, not Grok Build. Plan around the asymmetry.

---

## Layer C — Payload transport

| Rank | Option | Health | Notes |
| --- | --- | --- | --- |
| 1 | `claude -p --resume <id> < file` | first-party | Proven three times byte-clean |
| 1 | `grok export <id> <file>` as producer | first-party | Whole transcript, reasoning filtered out |
| 2 | Pass a path, not a body | — | Strictly better when the artifact is in the repository |
| 3 | `coder/agentapi` | 1,485★, 84 days | **Newly found.** HTTP API over Claude Code, Codex, Aider, Goose, Gemini, Amp. Backed by a company. A real alternative to `acpx` with a lower protocol ceiling — worth comparing |
| 3 | `acpx` | 3,141★, pushed today | Best-maintained of the abstraction layers. Pre-1.0, third-party adapters |
| 3 | `codex-plugin-cc` `/codex:transfer` | first-party, installed | One direction only |
| ✗ | Human copy-paste through a GUI | — | Measured failure twice |

---

## Layer D — Safety net under full bypass

| Rank | Option | Health | Notes |
| --- | --- | --- | --- |
| 1 | **`kenryu42/cc-safety-net`** | 1,494★, pushed today, MIT | Blocks destructive git commands, destructive filesystem commands, and secret-file access **before they execute**. Supports Claude Code, Codex, Copilot CLI, Cursor, Gemini CLI, OpenCode, Amp, Antigravity, Kimi, OpenClaw, Pi. Has a project site |
| 1 | Claude Code checkpointing / `/rewind` | first-party, default on | Checkpoint per prompt, 100 per session, survives resume |
| 2 | `pre-commit` + `gitleaks` | both mature | Only if `cc-safety-net`'s secret-file blocking proves insufficient. Otherwise redundant |
| 2 | `git-hooks/pre-push` (ours) | ~70 lines | Keep only for what `cc-safety-net` does not cover: push to the default branch and non-fast-forward pushes as a category |
| 3 | GitHub Actions alert on push to default branch | first-party | Detection, not prevention. Works on Free for private repos |
| 3 | APFS local snapshots | OS built-in | Coarse, but the only option covering damage outside the repository |
| ✗ | `dakshgulecha/rewind-ai` | 6★ | Right idea, fails the bar |
| ✗ | Command-pattern deny lists | — | Measured failure: `git push *` beaten by `git push` |
| ✗ | Sandbox with restricted network | first-party | Rejected: tasks need the network |

`cc-safety-net` is the strongest single find of this research pass. Read from its
README and installation docs:

- It is a **PreToolUse hook that parses command semantics**, and states that flag
  reordering, shell wrappers and interpreter one-liners cannot bypass it. That is
  the exact defect measured here: a `Bash(git push *)` rule beaten by `git push`.
  Semantic parsing is the correct answer to that; a longer pattern list is not.
- **Always-on protections that no override can lower:** recursive deletion of
  root or home, mutation of the git control plane (`.git`, hooks, worktrees,
  submodules), and mutation of its own policy file. That last two close the hole
  flagged as unavoidable in `decisions.md` — an agent removing the rail.
- Presets `standard` / `strict` / `paranoid`, per-rule overrides, trusted delete
  allow-paths. Environment variables **can only raise** protection, with one
  documented exception for linked worktrees.
- Built-in secret protection covering SSH keys, `.env`, cloud credentials and
  coding-CLI credential stores, across both shell commands and file tools.
- **A command-decision audit trail**, on by default: allowed *and* blocked
  decisions written to per-project JSONL with secret redaction, 30-day retention,
  browsable with `cc-safety-net logs`.
- Installs per agent with `npx -y cc-safety-net@latest install --claude-code`
  (also `--codex`, `--cursor`, and nine others). Node 18+, no daemon. `doctor`
  and `gui` subcommands exist.

Consequences for what is built here:

| Piece | Verdict |
| --- | --- |
| `pre-commit` + `gitleaks` | Likely redundant. `cc-safety-net` blocks secret *access*; confirm whether it also stops a hand-written secret being committed |
| `hooks/post-tool-journal.sh` | Redundant for the audit trail. Its JSONL already records decisions per project. **Still needed as a probe**, because the audit trail records decisions, not tool output |
| `git-hooks/pre-push` | **Still needed.** Push to the default branch and non-fast-forward pushes are not in the always-on set, and `cc-safety-net` deliberately leaves push alone |

Two things to verify. Grok Build is **not** among the twelve supported agents,
though Grok reads Claude Code hooks with no configuration, so it may work by
inheritance. And like every hook here, it depends on the unanswered question of
whether hooks fire under `bypassPermissions`.

**Limitation that decides this layer:** native checkpointing does **not** track
files modified by bash commands, nor most subagent edits, nor symlinked paths.
Since most of this workflow's damage potential is shell commands, `/rewind` is a
partial net. Test 5 below measures how partial.

---

## Layer E — Observability

| Rank | Option | Health | Notes |
| --- | --- | --- | --- |
| 1 | `claude agents` (agent view) | first-party | States, peek-and-reply, attach, `--json`, `Notification` hook |
| 1 | `grok dashboard` | first-party | Same shape for Grok |
| 1 | Codex app for macOS | first-party | Shares local rollouts with the CLI |
| 2 | `abtop` | 3,457★, 23 days | Read-only, no keys, `--json`, jumps to the pane. Claude Code + Codex + OpenCode, **not Grok** |
| 2 | Plain OTel Collector + Prometheus + Grafana | CNCF | Write the ~50-line config yourself instead of adopting a 13-star wrapper |
| ✗ | `KB1SLN-Labs/agent-observability` | 13★, no licence | Was rank 2 in the previous revision. Demoted |
| ✗ | `KubeRocketCI/claude-code-telemetry` | 1★ | Demoted |
| ✗ | `ColeMurray/claude-code-otel` | 487★, 14 months stale | Demoted |

Gotcha before wiring a collector: Claude Code defaults to Delta temporality, so
short sessions vanish before Prometheus scrapes them. Set
`OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=cumulative`.

---

## Layer F — Skill packaging and portability

| Rank | Option | Health | Notes |
| --- | --- | --- | --- |
| 1 | `SKILL.md` in `.agents/skills/` plus per-harness manifests | convention; Ponytail 4.9.0 ships seven | Already the shape the reference consumer uses |
| 1 | Grok's zero-config Claude compatibility | first-party | `grok inspect` verifies |
| 2 | `npx skills` (vercel-labs) | Vercel-backed | Installs across ~77 agents |
| 1 | **`intellectronica/ruler`** | 2,877★, pushed today, MIT | Applies one rule set to Claude Code, Codex, Cursor, Copilot, Windsurf, Aider. May remove the need for hand-maintained per-harness manifests entirely |
| 2 | `agentsmd/agents.md` | first-party spec | The AGENTS.md format itself, not a tool |
| 3 | Published marketplace entry | first-party mechanism | Only once a second consumer exists |
| ✗ | Superpowers `writing-plans` / `executing-plans` | healthy | Mandate subagents, tiny steps, per-task commits, worktrees |

---

## Layer G — Feedback and learning loop

| Rank | Option | Health | Notes |
| --- | --- | --- | --- |
| 1 | The existing `delivery-log.md` row per plan | 41 rows in use | The only version of this that survived |
| 2 | Derive the row from the journal rather than recall it | — | Fixes the four `not recorded` rows. Needs Layer B |
| 2? | `steveyegge/beads` | listed at 1,000+★ | **Newly found.** "Memory upgrade for coding agents" — assess against the recurrence rule before adopting |
| 3 | CAO's shape — journal, retrospector proposes, human promotes | 1,074★ | Copy the shape, not the tool |
| ✗ | `claude-reflect`, `self-improving-agent`, `claude-smart` | mixed | Auto-promote lessons into instructions, contradicting the recurrence rule |

---

## Layer H — Phase orchestration

This is where the newly found candidates matter most, because the workflow *is*
requirements → design → tasks → implementation with review gates, and several
well-starred projects implement exactly that shape. It was a gap not to have
compared them.

| Rank | Option | Health | Notes |
| --- | --- | --- | --- |
| 1 | Status quo — Control Session emits a card, transport carries it | in use | Works. The cost was toil and encoding, both now addressed |
| 2 | **`nizos/probity`** | 171★, 2026-08-16, MIT | The successor to `tdd-guard`, named as such by its own author. Same TDD enforcement for Claude Code, Codex **and** Copilot CLI, with no test reporters to configure. Fails the star bar and is still the right one to read |
| ✗ | `nizos/tdd-guard` | 2,311★, 3 days | Passes every number and is in maintenance mode by its author's own statement. Read `probity` instead |
| 2 | **`github/spec-kit`** | 130,334★, pushed today, MIT | Official Spec-Driven Development toolkit. By far the most adopted thing in this table; the closest institutional equivalent to the four phases |
| 2 | `MrLesk/Backlog.md` | 6,499★, pushed today, MIT | Human-AI collaboration managed inside git, matching the repository-as-truth principle |
| 3 | `gotalab/cc-sdd` | 3,626★, **91 days**, MIT | Read. Closest existing design by a wide margin — see the assessment below. Borrow from, do not adopt |
| 3 | `humanlayer/humanlayer` | 11,296★, 61 days, **NOASSERTION** | Human-in-the-loop for coding agents. Heavily adopted, but no recognised licence and pull requests are collaborators-only |
| 3 | `openai/symphony` | OpenAI first-party | Isolated autonomous agent runs. Isolation-oriented, likely a poor fit |
| 3 | `github/gh-aw` | GitHub first-party | Agentic Workflows CLI extension. CI-oriented |
| ✗ | `Pimzino/claude-code-spec-workflow` | 3,848★, **11 months stale** | Exactly the four-phase shape — requirements, design, tasks, implementation — and abandoned. Read the design, do not depend on it |
| ✗ | `parcadei/Continuous-Claude-v3` | 3,931★, **7 months stale** | "Hooks maintain state via ledgers and handoffs" is this project's problem statement verbatim. Same verdict: read it, do not depend on it |
| 3 | `acpx flow` with `checkpoint` nodes | 3,141★ | Typed routing, persisted replayable runs |
| 3 | A shell script driving four phases | — | Eleven transitions. Does it beat a human reading one card |
| ✗ | CAO, Maestro, superset, zeroshot, myclaude, claude-squad, vibe-kanban | several healthy | All parallel- and worktree-oriented, which this workflow rejects |
| ✗ | Writing a bespoke orchestrator | — | The missing piece is input and output discipline, not coordination |

### `cc-sdd` assessed

Read at v3.0. It is the closest existing design to this workflow found anywhere,
and the overlap is not superficial:

| `cc-sdd` v3.0 | This workflow |
| --- | --- |
| discovery → requirements → design → tasks → implementation, humans approving at phase gates | design → implement → review → release, human at checkpoints |
| an independent reviewer per task, plus an auto-debug pass when the reviewer rejects twice | independent review, `REMEDIATE_ONCE`, then `REPLAN_OR_SPLIT` |
| "Code remains the source of truth" | the repository is the delivery contract |
| learnings propagate forward via `## Implementation Notes` in `tasks.md` | the `delivery-log.md` row |
| 17 Agent Skills, progressive disclosure, 8 harnesses | `SKILL.md` phases, three harnesses |
| Kiro-inspired; Kiro specs remain compatible | Kiro was the Plan A reviewer |

**Not adoptable as-is**, for one structural reason: `cc-sdd` gives each task a
fresh implementer and an independent reviewer, one task per iteration. The
founding ADR rejects exactly that — "strict per-task implementer, spec-reviewer,
and quality-reviewer delegation is not the reference consumer's default" — and requires one
implementation session to own one complete plan. Adopting `cc-sdd` would reverse
a decision made with reasons, not fill a gap.

**Two ideas worth taking**, both aimed at measured failure classes:

1. **Boundary-first specs.** `design.md` carries a File Structure Plan that drives
   task boundaries, tasks carry `_Boundary:_` and `_Depends:_` annotations, and
   review checks for boundary violations rather than style. This targets the
   second-largest cause in `findings.md` — five plans whose allowed scope omitted
   a file their own tasks required. The correction addressed it with prose after
   the third occurrence; an annotation a reviewer can check is stronger than a
   standing rule.
2. **Forward-propagating notes inside one plan.** `## Implementation Notes` in
   `tasks.md` carries what earlier tasks learned to later ones. The current
   workflow has nothing between "focused verification per task" and "one row in
   the log at closure".

`github/spec-kit` remains worth reading for the same reason at larger scale —
130,334 stars and GitHub-official — but its Copilot orientation makes it a source
of vocabulary rather than machinery.

---

## Revised test order

Ordered so that the steps most likely to **delete** later work come first. The
reading steps are complete; the rest need a working shell.

| # | Test | Answers | State |
| --- | --- | --- | --- |
| — | Read the healthiest hook-enforcement project | `tdd-guard` is superseded by `probity`; read that instead | **done** |
| — | Read `gotalab/cc-sdd` and `github/spec-kit` | `cc-sdd` is closest but conflicts with the founding ADR on per-task delegation. Two ideas worth borrowing | **done** |
| — | Read `cc-safety-net` README and install docs | Semantic parsing, always-on protections, built-in JSONL audit trail | **done** |
| — | Probe run with `--permission-mode bypassPermissions` | Hooks **do** fire under bypass. `tool_response` has no exit code but does carry `stdout`, `stderr` and `tool_use_id`. Also exposed two defects in this repository's own hook | **done** — `findings.md` §7 |
| — | One command that exits non-zero, `PostToolUseFailure` registered | Pass or fail **is** readable from the event. Exit code is the first line of `error`. The two events carry different shapes, and a failure has no `tool_response` | **done** — `findings.md` §8 |
| — | A command writing to **stdout** and exiting non-zero | `error` carries stdout and stderr **combined**. The gap did not exist. **Layer B is finished with the hook alone** | **done** — `findings.md` §9 |
| — | Install `cc-safety-net --claude-code`, attempt `git reset --hard` and a `.env` read | Holds under bypass. Secret rules match on basename before execution. `git push` **not** covered, so `pre-push` stays. `gitleaks` dropped | **done** — `findings.md` §10 |
| — | `git fetch origin && grok inspect` in the reference consumer | Grok finds the consumer's delivery skill unaided and inherits Claude Code plugins **including their hooks**. Baseline is the merge commit `[redacted]`, not the closure commit | **done** — `findings.md` §11 |
| — | Run a command in Grok that `cc-safety-net` should block | **Loaded and inert.** Both blocked commands ran. The rail does not reach Grok. Fix is Grok's own `workspace` sandbox, which allows network | **done** — `findings.md` §12 |
| 1 | Write `~/.grok/sandbox.toml`, re-run the two blocked commands under `--sandbox delivery` | Does the OS-level sandbox cover what the inherited hook did not? | pending |
| 2 | `git config core.hooksPath` and one `git push` attempt to `main` from each harness | Confirms the only harness-agnostic rail actually fires. Unblocked now that `pre-commit` is dropped | pending |
| 3 | Try `intellectronica/ruler` on the reference consumer | Does it replace hand-maintained per-harness manifests? | pending |
| 4 | `cc-safety-net --codex`, then the same two commands in `codex exec` | The third harness is entirely untested for safety coverage | pending |
| 5 | `/rewind` after a phase that used bash | How large is the untracked-bash gap in practice? | pending |
| 6 | One phase under `claude --bg` watched in `claude agents` | Is native monitoring enough to drop a separate reader? | pending |
| — | Which path Grok found the consumer's delivery skill at | `.agents/skills/` or `.claude/skills/` via the Claude scanner. Only matters if the thin adapter is ever removed | deferred |
| — | Claude Code OTel to a local collector | Off the critical path. Worth it only for cost and duration across sessions | optional |

All remaining steps are independent. Step 2 can still delete work that exists in
this repository, so it stays near the front. Step 3 is the cheapest and closes the
loop on the staleness defect from §7.

Reading `Pimzino/claude-code-spec-workflow` and `parcadei/Continuous-Claude-v3`
remains worthwhile despite both failing the bar — they are the two next-closest
existing designs, and a stale design is still a design.

---

## Known conflict

`core.hooksPath` and the `pre-commit` framework fight: `pre-commit install`
refuses to run when `core.hooksPath` is set. Let `pre-commit` manage both stages
— `pre-commit install --hook-type pre-commit --hook-type pre-push` — and express
the push rules as a local hook in `.pre-commit-config.yaml` rather than as a
separate directory.
