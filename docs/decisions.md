# Decisions

What has been settled, what is still open, and what was rejected and why.
Rationale is kept because the reasons are the reusable part.

Last updated 2026-08-21.

---

## Settled

### The problem is the identifier and evidence path, not model judgement

Three independent failures in this session all occurred at the point where an
identifier or a piece of evidence travelled from where it was produced to where
it was used — including one committed by the assistant while explaining the
failure. Model reasoning was not the weak link in any of them. See
`findings.md` sections 2 and 3.

Consequence: build rails at the boundary, not more instructions inside the
prompt.

### Three harnesses. Kiro is out for now

Claude Code, Codex CLI, Grok Build. Kiro performed the Plan A review well, but it
would be a third hook format, no first-party multi-session dashboard covers it,
and `abtop` does not see it. Revisit when the first two rails are proven.

### Transport is `claude -p --resume <id> < file`. Not `acpx`

Verified working three times, byte-clean. `acpx` is well-built and covers all
three harnesses, but the workflow is serial — one worker at a time — so a
structured multi-agent transport buys little, and it is pre-1.0 with
third-party adapters underneath. Keep it in reserve for `acpx compare` and for
fully unattended CI runs.

### Monitoring uses each harness's own dashboard

`claude agents`, `grok dashboard`, the Codex app. First-party, already built,
and no orchestrator can attach live to a session it is driving anyway because
all three enforce one writer per transcript.

Trade-off accepted: `--bg` cannot combine with `-p`, so background sessions
give up `--output-format json`. Resolved by having workers write their result
to a file in the repository instead. This agrees with the founding ADR's fifth
decision driver — durable truth in the repository, not in chat history — so
the repository *is* the structured output channel.

### Payloads travel as files, and identifiers are derived, never typed

Two rules, both from `findings.md`:

- Write the payload to a file and pipe it on stdin. Never inline it in a shell
  argument, and never retype it.
- Select the payload with a derived selector (`last`, a path, a `git`
  invocation), not a hand-copied id.

Better still where possible: pass a path and let the reader open it. A wrong
path fails loudly; a corrupted quotation reads fine.

### Hooks replace prose. They do not sit alongside it

Each hook ships with the list of paragraphs it deletes, and is not worth
merging if that list is empty. The entire simplification benefit is in the
deletion.

| Hook | Prose it retires |
| --- | --- |
| `SessionStart` injecting resolved git identifiers | identifier-validation rules in `transitions.md` |
| `PostToolUse` recording command and exit code | the per-tool summary-line table in `implementation-handoff.md` |
| `Stop` requiring a structured result | "print the whole result as your final message" |

**Under review.** The `PostToolUse` row above predates the discovery that Claude
Code and Codex both ship OpenTelemetry instrumentation. `claude_code.tool_result`
already carries the tool name, success, duration, and — with
`OTEL_LOG_TOOL_DETAILS=1` — the full Bash command and the commit SHA of a
successful `git commit`. What it does not carry is the tool's output text, which
is what a verbatim gate summary line is. The hook may reduce to capturing output
only, or may not be needed. `docs/options.md` layer B ranks the alternatives.

The planned fourth hook — `PreToolUse` guarding authority boundaries — is
dropped. Under the unrestricted policy it has nothing to block, and
`PostToolUse` on `Bash` already records every shell command including commits,
pushes and merges, with the response attached. Three hooks, not four. The
authority paragraphs in `release.md` are deleted as obsolete policy rather than
handed to a hook.

Caveat: prose may only be deleted per harness, and only after that harness's
hook has been observed working. Codex runs `command` handlers only; Grok's
hooks default to a 5-second timeout and fail open.

### Governance is split

Slimming and generalising the skill changes a contract the four phases depend
on, so it goes through the reference consumer's own workflow: an ADR, a plan, four phases.
Building this repository and its hooks changes no contract and lives outside
the reference consumer, so it is Routine work. The two tracks do not wait on each other.

### This repository is the package; the reference consumer is its first consumer

Installed by symlink or `--plugin-dir` during development so a change takes
effect immediately, without a version tag and without modifying any tracked
file in the reference consumer. Move to versioned installation when a second consumer
exists.

### Artifacts are English; conversation follows the user

One boundary, stated once: anything a program reads is English or an
identifier; anything only a human reads may be localised. Enum values, paths,
SHAs, commands and branch names are never translated.

The elaborate localisation contract in the current skill exists only because
the transition card is an artifact a human transports. Remove the human from
the transport and the contract disappears with it.

### Real work in the reference consumer is the test bed

Each new rail is exercised on the next actual plan rather than on a synthetic
fixture. Three tests have run this way already: transport into the Control
Session, derived extraction of a payload, and Grok Build as the release worker.
Next is the Plan B design phase with the two hooks active.

Risk accepted: a failed experiment costs a real round on a real plan. Mitigated
by the shape of the first two hooks — one only injects context, the other only
appends to a journal. Neither can change what an agent does to the repository.
That property is a requirement for anything tested this way, not an accident.

---

### Agents run unrestricted. The review gate moves to the pull request

Decided by the product owner, 2026-08-19, having read the objection below.

- Full bypass on every harness: `--permission-mode bypassPermissions` on Claude
  Code, `--always-approve` on Grok Build,
  `--dangerously-bypass-approvals-and-sandbox` on Codex.
- No rule blocks `git commit`, `git push`, or opening a pull request. Agents do
  all three unattended.
- **No sandbox.** Tasks legitimately need the network to look things up, and a
  network-restricted profile would break them.

Rationale: agent capability has moved far enough that per-action approval costs
more than it returns, and the product owner reviews the pull request and orders
corrections when something looks wrong. An approval prompt inside a headless
turn stalls the turn, so prompts are incompatible with the automation being
built.

Consequences accepted, recorded so a later reader does not mistake them for
oversights:

- The founding ADR's seventh decision driver — human approval at consequential
  Git, infrastructure, data and production boundaries — no longer holds. The ADR
  and `release.md` must be amended, or the skill will keep instructing workers
  to stop and ask. That prose is load-bearing: in this session Grok obeyed it
  and reported "Did not merge. Did not mark ready." Changing flags without
  changing prose achieves neither policy.
- Command-pattern deny lists were evaluated and rejected as a rail regardless.
  The rule tried this session was defeated by a shorter spelling of the same
  command (`git push` against a pattern of `git push *`). There is no finite
  pattern set, because the agent chooses the wording.

What pull-request review does **not** cover, and therefore the only residual
exposure worth engineering against:

| Not covered | Why review misses it |
| --- | --- |
| `git push --force` in any form | rewrites history the review never saw |
| push straight to the default branch | skips the pull request entirely |
| `gh pr merge` | merges before the review happens |
| `git reset --hard`, `git clean -fd` | destroys uncommitted work; nothing reaches a diff |
| writes outside the repository | never appears in any diff |

Reviewing a pull request reviews a *diff*. It does not review history mutation,
and it cannot review a merge that already happened.

**Server-side branch protection is unavailable here.** Protected branches and
rulesets on GitHub Free apply to public repositories only; private repositories
need Pro, Team, or Enterprise
([protected branches](https://docs.github.com/articles/about-protected-branches),
[rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/converting-branch-protections-to-rulesets)).
The reference consumer is private on a Free plan — an unauthenticated fetch of the
repository returns 404. So the strongest mitigation is out of reach without
either upgrading the account or making the repository public.

What is left, in order of strength:

1. **A tracked `pre-push` hook** (`git-hooks/pre-push` in this repository).
   Refuses pushes to `main` or `master`, refuses their deletion, and refuses
   any non-fast-forward push on any branch. Installed per clone with
   `git config core.hooksPath …`. The property that matters: git invokes it
   regardless of how the push was spelled, so unlike a command-pattern rule it
   cannot be reworded around. It *can* be skipped with `--no-verify` or removed
   outright — one specific flag rather than infinite phrasings, and the
   `PostToolUse` journal records the command either way.
2. **Merge stays a human act.** Not a restriction being added: the product
   owner asked for commit, push, and pull-request creation, and did not ask for
   merge. Both pull requests were merged by hand.
3. **A GitHub Actions workflow** on `push` to the default branch that fails
   loudly or opens an issue. Detection after the fact, not prevention, but it
   works on Free for private repositories.

Honest limit: with full bypass and no sandbox, no local rail survives an agent
that decides to remove it. The realistic goal is not prevention but making the
accidental path hard and everything observable. That is what the journal is
for.

Remaining unprotected and accepted: destructive local operations
(`git reset --hard`, `git clean -fd`) and writes outside the repository. Both
appear in the `PostToolUse` journal after the fact.

### Adopt `cc-safety-net` for the safety layer, pending one test

Decided 2026-08-19 after reading its README and installation docs. It answers the
measured defect properly: it parses command **semantics**, so the reordering that
beat `Bash(git push *)` cannot beat it. Its always-on protections cover recursive
deletion of root or home, mutation of the git control plane including `.git/hooks`,
and mutation of its own policy file — which closes the "an agent could remove the
rail" hole that was previously accepted as unavoidable. It ships a per-project
JSONL audit trail of allowed and blocked decisions, on by default.

Health: 1,494★, pushed 2026-08-19, MIT, CI and coverage badges, a documented
threat model with a residual-risk registry, twelve supported agents.

**Confirmed by observation 2026-08-20**, `findings.md` §10. Installed as a Claude
Code plugin, v2.0.7, one `PreToolUse` hook with no matcher. Under
`bypassPermissions`, `git reset --hard` was blocked by rule `git.reset-hard` and
`cat …/.env` by `secret.basename.env` — the latter on a path that did not exist,
because the rule matches the basename before execution. `git status --porcelain`
ran normally, so the guard is not over-broad.

Settled consequences:

- **`pre-commit` plus `gitleaks` is dropped.** Secret-path blocking is covered.
- **`git-hooks/pre-push` is retained**, with empirical justification rather than
  reasoning: `git push --dry-run origin HEAD:main` was not blocked, and only
  git's own fast-forward rule stopped a feature branch from landing directly on
  `main`. Had the local ref been current it would have succeeded.
- **`hooks/post-tool-journal.sh` is retained.** A call refused at `PreToolUse`
  never reaches `PostToolUse`, so the two logs cover different things:
  `cc-safety-net logs` records what was attempted and refused, the journal records
  what ran and what it printed. Neither is sufficient alone, and the reader now
  states that limitation in its own output.

**Scope, measured across all three harnesses** (`findings.md` §12, §16, §17):

| Rail | Claude Code | Grok Build | Codex |
| --- | --- | --- | --- |
| destructive git in-repo | `cc-safety-net` | **uncovered** | `cc-safety-net` |
| writes outside the repository | `cc-safety-net` | `workspace` sandbox | `cc-safety-net`, plus `read-only` for review |
| reading secrets | `cc-safety-net` | `[permission]` deny | `cc-safety-net` |
| push to default branch | `pre-push` in git | same | same |
| merge | unguarded by design | same | same |

Grok inherits the `cc-safety-net` plugin and ignores its verdict, so its coverage
comes from its own sandbox and permission rules instead. Codex enforces the hook
only after it is trusted interactively in `/hooks`; the install alone does nothing.

One gap remains and is accepted: in-repository git destruction in Grok. Its sandbox
permits writes inside the workspace by design. The cost is bounded because every
phase boundary commits and pushes, so only the candidate diff is ever at risk.

### Roles are a choice per phase, not a property of a tool

Claude Code is the control session for the pilot. Any harness must be able to take
any role later — Codex as control, Claude Code as reviewer, Grok as implement and
release worker.

Most of that is already free: the three worker invocations are symmetric, all three
resume a session by id, and all three have a shell to launch the others. The skill
now says so rather than implying the pilot's assignment is the design.

Three things are Claude-Code-shaped and are recorded as a capability matrix in
`harness-surface.md` rather than fixed now: identifier injection is verified only in
Claude Code; the evidence journal reads Claude Code's payload shape and would file a
Grok session as `unknown`; and read-only for review is enforceable at the operating
system on Codex and Grok but not on Claude Code.

**Deliberately not fixed pre-emptively.** Normalising the hooks across three payload
shapes is small work, but `findings.md` records four occasions where a shape was
inferred wrongly from a single observation. It gets done when a real swap happens,
with the real payloads in hand. Until then both rails have a documented fallback —
resolve identifiers in the same turn, paste summary lines verbatim — so a swap
degrades rather than breaks.

The one substantive constraint the matrix exposes: a control session outside Claude
Code loses verified identifier injection, and that is the rail that removed the
fabricated-SHA failure class. Verify it for the chosen harness before moving control
there, or accept the fallback knowingly.

### The control session is the orchestrator, not a script

Decided 2026-08-20 after the product owner described the intended shape, which was
better than what had been built. One interactive session holds the contract, the
human talks to it and steers it, and it launches the implement, review and release
workers itself and reads their results. The human is interrupted only when it
cannot decide.

Feasible with nothing new. The control session has a shell; a worker is
`claude -p`, `codex exec` or `grok -p` with its final message captured to a file.
All three invocations are verified. What was missing was the skill telling the
control session to do it — it described phases as things a worker does and left the
human to move between sessions. That gap is now closed in `SKILL.md`.

**Amended 2026-08-21.** Those headless recipes remain the verified fallback. When a
coordinator is selected, workers launch as interactive harness TUIs through that
coordinator's native skill; wrapping a headless command in a visible shell does not
satisfy the contract. See the decision below.

Rejected in its favour: **a shell script driving the four phases.** A script would
have to reimplement the routing the skill already states, hold state the repository
already holds, and it could not brainstorm. The control session can do all three
and is already in the conversation. A script is the answer when there is no agent
in the loop; there is one.

Two design points worth keeping:

- **Read the result from a file, not from terminal output**, and write the prompt to
  a file rather than inlining it. Both follow the rule already established after a
  handoff arrived as mojibake and a review report lost its escaped backticks.
- **A failed worker is not a blocked worker.** An exhausted quota, an
  authentication error or a non-zero exit with no result file is an escalation to
  the human, not a routing decision. Conflating them loses the work, and the
  delivery log already records one worker returning `blocked` for what turned out to
  be an environment collision.

Start with blocking calls. A worker takes minutes and the human waits; background
execution with polling is a state machine, and it is only worth building once
waiting is measured to cost something.

### Superseded 2026-08-20 — Review runs on Codex under `--sandbox read-only`, not under full bypass

Full permission bypass is right for `implement`, and wrong for `review` — not for
safety, but because read-only *is* the review contract. The skill states that a
reviewer starts fresh and read-only; Codex can enforce that at the operating system
rather than asking the reviewer to comply, and `read-only` is already its default
for `codex exec`.

Pair it with `approval_policy = "never"` to keep the run unattended. That gives zero
prompts and a reviewer that provably cannot modify the candidate — a guarantee
neither Claude Code nor Grok Build offers for this phase.

This is the one place where a phase contract and an OS mechanism line up exactly, so
it is worth spending the asymmetry on: review goes to Codex.

**Amended 2026-08-20.** The decision stands and it has a cost that was not priced
here. Read-only also blocks the gates: every gate invoked through `uv` fails at
`Operation not permitted` because it cannot initialise its cache, and `--add-dir`
does not grant the write. So a read-only reviewer can read the diff and judge it
while being unable to reproduce a single gate.

That turned out to be affordable rather than fatal, twice. In two review rounds the
reviewer verified gate results by reading the evidence journal the implementer wrote,
and in one of them it caught a genuine contradiction in the plan that no gate could
have found. The two purposes had been conflated: independent judgement is what review
alone supplies, and protection against a fabricated gate result belongs to the
journal. Splitting them costs nothing and is what the skill now says.

The observations above remain evidence for the profile that was used. The conclusion
that the profile defines the phase, that only Codex can enforce the boundary, and that
review therefore belongs to Codex is superseded by the decision below.

### Grok is covered by its own sandbox, not by the shared hook

Grok's `workspace` sandbox profile allows child network, so the objection that
ruled sandboxing out — tasks need the internet — does not apply to it. It is
enforced by Seatbelt on macOS and therefore not defeatable by rewording a command,
which is the failure mode every pattern-based attempt here has hit.

Secrets need a custom profile; Grok's documentation says so explicitly rather than
this being a workaround:

```toml
# ~/.grok/sandbox.toml
[profiles.delivery]
extends = "workspace"
deny = ["**/.env", "**/.env.*", "**/*.pem", "**/*.key",
        "~/.ssh/**", "~/.aws/**",
        "~/.claude/.credentials.json", "~/.codex/auth.json"]
```

Two gaps remain in Grok and are accepted: `git reset --hard` inside the repository
and `.git` control-plane mutation. Both are writes inside the workspace, which the
profile permits by design. The cost is bounded because the workflow commits and
pushes at every phase boundary, so only the candidate diff is ever at risk — one
round, not the work.

**Rejected:** a shim translating `cc-safety-net`'s verdict into Grok's format. It
would mean owning a compatibility layer between two formats neither of which is
ours, and this session already records four occasions where a format was inferred
wrongly from one observation. An upstream request to `cc-safety-net`, which was
pushed to today and already ships twelve integrations, is cheaper and more durable.

**Amended 2026-08-20, twice over.**

The rejection above stands and its stated reason was wrong. It assumed Grok called
the hook and discarded its verdict. Grok never called it: it discovers plugin hooks,
reports `has_hooks=true`, and dispatches none of them — not `cc-safety-net`, not this
package's own, not any. Verified in Grok's own debug log, where the only hook sources
executed were `~/.grok/hooks/*.json` and `~/.claude/settings.json`.

Probing the shim afterwards made the rejection stronger. `cc-safety-net hook` ships
seven integrations and none is Grok. `--agy-cli` emits exactly Grok's
`{"decision":"deny","reason":…}` but its analyser fails closed on everything,
including `git status`. `--coding-cli` analyses correctly and emits Claude Code's
shape, which Grok discards, and silence is allow. So a shim needs two translations,
not one.

The secrets protection shown above is also misattributed. A `deny` entry in
`sandbox.toml` does **not** block a read — tested with a real file at a denied path.
What blocks it is a `[permission]` rule in `~/.grok/config.toml`, which classifies the
operation rather than the tool name and therefore stops a read issued through a shell
command. Keep the sandbox for writes outside the workspace; keep `[permission]` for
secrets.

Evidence capture, unlike the guard, **is** reachable: registering this package's three
events at `~/.grok/hooks/delivery.json` makes Grok journal like the others, and its
payload then turns out to carry a real numeric `exit_code` that Claude Code never
supplies. See `## Evidence is wired per harness` below.

### `git-hooks/pre-push` is the only harness-agnostic rail, and the only verified one

It sits in git rather than in a harness, so one `git config core.hooksPath` covers
Claude Code, Codex and Grok at once for the push risk — the one risk no harness
guard covers. That property was incidental when the hook was written and is now
the reason it survives.

Verified 2026-08-20, `findings.md` §15: the hook refuses a `main` refspec, and git
invokes it for any push it will accept. Two earlier probes showed nothing because
git rejects a non-fast-forward update **before** calling the hook, so a push git
would refuse anyway never reaches it.

It requires `chmod +x` — git execs its hooks, unlike the plugin hooks in `hooks/`
which are spelled `bash "…"`. It announces itself on stderr on every run, allowed
or refused, because a silent guard cannot be told apart from an absent one; that is
how the missing execute bit escaped notice for two turns.

Dropping `pre-commit` also removed the blocker: `pre-commit install` refuses to run
when `core.hooksPath` is set, so subtracting one tool unblocked the other.

### Borrow two ideas from `cc-sdd`, do not adopt it

`gotalab/cc-sdd` v3.0 is the closest existing design found — phase gates with
human approval, an independent reviewer, a bounded auto-debug pass after two
rejections, code as source of truth, Agent Skills across eight harnesses,
Kiro-compatible specs. It is nonetheless not adoptable: it assigns a fresh
implementer and reviewer **per task**, one task per iteration, and the founding
ADR rejects precisely that in favour of one implementation session owning one
complete plan. Adopting it would reverse a decision made with reasons.

Two of its mechanisms are worth taking, both aimed at measured failure classes:

1. **Boundary-first specs** — a File Structure Plan in `design.md` driving task
   boundaries, `_Boundary:_` and `_Depends:_` annotations on tasks, and review
   checking boundary violations rather than style. Targets the five plans whose
   allowed scope omitted a file their own tasks required. An annotation a reviewer
   can check beats the standing rule the correction added.
2. **Forward-propagating notes within one plan** — the equivalent of `cc-sdd`'s
   `## Implementation Notes`. The workflow currently has nothing between
   per-task verification and one log row at closure.

Both belong to the skill-slimming plan, which is Planned work in the reference consumer.

### Evidence is wired per harness, and the wiring fails silently

All three harnesses journal. None of them journals by the same route, and two of the
three report success when they are doing nothing.

| Harness | Where the hooks come from | Payload |
| --- | --- | --- |
| Claude Code | the plugin | snake_case, `tool_response` object, no exit code on success |
| Codex | the plugin, **after** the hooks are trusted in `/hooks` | snake_case, `tool_response` **string** |
| Grok Build | `~/.grok/hooks/delivery.json` only | camelCase, `toolResult` object, **real `exit_code`** |

Grok is the surprise twice over. It discovers the plugin and dispatches none of its
hooks, so the plugin route yields nothing; and once wired directly its payload is the
richest of the three, because `toolResult.exit_code` is a number on the success path
where Claude Code implies zero and Codex says nothing.

Codex's trust is keyed to hook content, so any change to a hook script revokes it
without a word. That is two silent-failure modes in one rail, which is why
`bin/delivery-doctor` now checks for the Grok file and why the README says to
re-trust after every package update.

The reader maps all three vocabularies in one place. Output selection follows the
payload shape rather than the pass/fail verdict, because only two of the three move a
failure's output into a separate field — keying it on the verdict blanked every failed
Grok command.

### Orca owns dispatch and observation; the checkout stays shared

`stablyai/orca` replaces the hand-rolled dispatch layer and nothing else. Adopted for
what it supplies that this package cannot cheaply build:

- `question` and `reply`, a blocking channel from worker to coordinator. Today a
  worker that needs an answer must return `BLOCKED` and lose the round.
- `escalation` as a typed message rather than a paragraph of prose.
- `worker_done` carrying `{taskId, dispatchId, outcome}` and gated by a capability
  token, so a completion is not a string the worker asserts.
- `check --wait` on typed messages, with keepalive every fifteen seconds.
- One dispatch id per worker across all three harnesses, replacing per-harness session
  archaeology, plus a desktop and phone view of runs in flight.

**Workers share the repository's own checkout.** Orca can give each worker a git
worktree, and that buys two real things: review independence enforced by git rather
than by sandbox, and a reviewer that can run the gates because its checkout is
writable. Both are declined. In 41 plans no round has been lost to a reviewer
touching the candidate, and the cost is a dependency install per worker, repeated.
The trigger for revisiting is recorded rather than left to taste: a review round that
misses a defect which running the gates would have caught.

Two things Orca documents are overridden, and both were established by probe:

- **A deadline outranks "keep waiting".** Orca tracks terminal liveness, not agent
  liveness. A worker killed with `SIGKILL` still reported `dispatched`, `ready`,
  `running`, `orphaned: false` ninety-five seconds later, while the terminal tail it
  serves contained the shell printing `killed`. Its guidance is to treat a
  `check --wait` timeout as a checkpoint and keep waiting; followed literally against
  a dead worker that never returns. So the existing escalation rule stays and becomes
  load-bearing: no message by the deadline is a failed worker and a call for the
  human.
- **Settle a dispatch before opening the next phase.** With one shared checkout, a
  zombie dispatch's terminal is still `writable`, so `worker-release` or
  `worker-abandon` runs between phases.

Also observed and worth knowing before relying on it: `worker-start` returns
`state: ready, stage: input_accepted`, and on a freshly launched agent terminal the
task text was typed into the input box and left unsubmitted for three minutes until
one `terminal send --enter`. It did not recur when the terminal already existed. And
an unacknowledged Delivery replays until `check --ack <delivery_id>`, so a loop that
forgets the id spins on its first message.

Grok keeps `implement` and `release`. `worker-start --model` refuses Grok outright, so
its model is pinned in the command that creates the terminal and the dispatch attaches
to that terminal instead. Orca then records no model for it, which does not matter:
Grok writes `current_model_id` and `reasoning_effort` into its own
`~/.grok/sessions/<cwd>/<id>/summary.json`, and the command that pinned them lands in
the coordinator's journal.

Coordinator fencing was a stop condition and is now verified safe. A second terminal
binding the same Run takes it: `consumer_generation` moves 1 to 2, the
`coordinator_handle` changes, and the first terminal is left bound to nothing. It is
not told, and it does not need to be, because its next action fails loudly rather than
quietly succeeding — `run_required` with `No effects were applied`, or
`consumer_fenced` naming both Run ids when one is given explicitly. A fenced
coordinator cannot half-act.

The runtime-death stop condition is also retired, and it failed safe. Quitting the app
with a 900-second command in flight killed the Electron main process and left the PTY
host and the entire worker tree running. Reopening produced a new `runtimeId`; the
dispatch survived in the database still recording the old epoch, the mailbox kept its
pre-restart heartbeat, and when the worker finished it sent `worker_done` with a
capability issued by the **dead** runtime, which the new one accepted and settled. The
control plane is interruptible; the work is not. A hard crash rather than a quit is
untested and is now a strictly smaller worry.

**Pass the coordinator handle explicitly on every call.** A Run bound from a shell that
is not a real Orca terminal came unbound twice with no event — `run-show` reporting the
right `coordinator_handle` while `check --run` answered `consumer_fenced`. `check` has no
`--from` and resolves "this terminal" from ambient context, so use
`check --terminal <handle>`. Ambient resolution is how a coordinator ends up silently
unbound.

**No stop conditions remain for this decision.**

### Withdrawn same day — tasks declare their boundary, so a program can check the scope

**Proposed and withdrawn on 2026-08-20, before any plan was written.** Kept rather than
deleted so the next reader does not re-propose it from the same wrong number.

The proposal below rested on "roughly five plans, and it recurred once more", taken from
this package's own hand-grouped cause table in `findings.md` §1. The delivery log counts
it explicitly and differently, and the log is the primary source:

| Row | Plan | Shape | Answer added |
| --- | --- | --- | --- |
| 29 | Plan F | allowed scope omitted an owning Reference | — |
| 42 | Plan D | omitted a colocated test, which that gate cannot see | standing rule: allowed scope always carries the colocated test of an allowed source file and any registry test |
| 43, 44 | Plan E, Plan A | no scope failure | — |
| 45 | Portable delivery skill | **different shape** — required an outcome its own forbidden scope prevented | — |

So the shape with three occurrences has been answered twice, and the last answer has
held across two plans. The shape that just occurred has occurred **once**, and this
skill's own rule is that one incident is not policy.

Worse for the proposal, a path comparison would not have caught row 45 anyway. That
failure was not a path missing from a list. Task 4 required a grep for the consumer's delivery skill to
come back clean while forbidden scope protected the one file still carrying the phrase;
catching it needs running the plan's own verification at the baseline and reconciling
what already fails against what the plan forbids fixing. That is a different and much
more invasive mechanism, and it would be built for a single incident.

**Revived by** either a second occurrence of row 45's shape, or any scope omission
recurring after Plan D's standing rule.

The reasoning below is left intact because it is still the right reasoning for the day
the trigger fires.

---

The largest cause left in the delivery log is a plan whose own tasks require a file its
scope does not cover. Roughly five plans, and it recurred once more in the plan that
released this workflow: task 4 required a grep for the consumer's delivery skill to come back clean
outside decision records while Forbidden scope protected `delivery-log.md`, the one
file still carrying the phrase. The plan demanded an outcome and forbade the only
change that achieves it. Round one was spent discovering that.

Six occurrences is well past the recurrence bar. What settles the shape is the second
half of that rule — prefer a mechanism to a rule — because this failure is not
carelessness. It is a contradiction between two sections of one document, which is
exactly the kind of thing a person misses and a program does not.

**Each task names the paths it may touch, in a fixed form, and a check compares those
against the plan's scope sections.** Every path a task declares must appear in Allowed
scope; no path in Forbidden scope may appear in any task's declaration; and a path
named in a focused verification command must be declared by the task that runs it. All
three are string comparisons over a list, not judgement.

That is the borrowed half of `cc-sdd`'s boundary annotations, already recorded here as
worth borrowing. What is not borrowed is its per-task implementer and reviewer, which
contradicts one session finishing one plan.

Rejected alternatives, both for the same reason — they ask a reader to be careful where
a list can be compared:

- A rule telling the plan author to re-read scope against the tasks. That is the prose
  answer this log already shows failing five times.
- A reviewer instruction to check scope coverage. Review already catches it, and
  catching it in review is what costs the round. The check has to run before dispatch.

**Not decided here:** where the check lives and how strictly it parses. A plan is
markdown prose, and this file records that mechanical checks over prose fail and get
answered with more prose. The annotation form has to be rigid enough to parse without
guessing, and picking it is the plan that follows this decision rather than part of it.

The second deferred mechanism — notes propagating forward inside one plan — stays
deferred. It has no new recurrence.

### The evidence reader marks pipeline commands; it does not judge them

#### Context

`findings.md` §28 records the third sighting of a shell pipeline being treated as
gate evidence after prose had already warned against it. In the Plan B design session,
35 of 61 journaled commands contained pipelines. The first Vitest command returned a
successful shell status while its output contained an internal error because
`| tail -20` supplied the status that the tool recorded.

The journal has the command and the shell call's result. It does not have the status
of every pipeline stage or the shell options that produced that result.

#### Decision

`delivery-evidence` exposes a conservative `pipeline_present` boolean in its JSON
records and prints a warning beside human-readable evidence when command text contains
a standalone `|` rather than `||`. The warning says that the recorded status does not
prove every stage and that gate evidence needs an explicit `pipefail` or a direct
rerun.

This is lexical detection, not shell interpretation. It does not decide whether a
command is a gate, parse quoting, infer active shell options, or change the recorded
status.

#### Alternatives considered

- Parsing shell syntax and proving `pipefail` lost because the executed shell and its
  inherited options are not recorded, and adding a shell parser would still not
  recover them.
- Rejecting or rewriting piped commands lost because the evidence reader is not a
  command guard and most observed pipelines were harmless reads.
- Keeping only the existing prose rule lost because the same failure shape recurred
  after that rule was added.

#### Consequences

Quoted standalone pipe characters and commands that correctly establish `pipefail`
may still receive the conservative warning. That costs one inspection and avoids a
false green claim. `||` fallback syntax is not marked as a pipeline.

The Grok hook errors observed during Plan B are routed separately rather than absorbed
into this reader. Across its three Grok sessions, `global/settings` failed 617 times
because `${SYSTEMROOT}` was absent, while the native `global/orca-status` hook
succeeded 620 times and `global/delivery` succeeded 85 times with no failure. The
failing hook is Orca's Claude-compatible entry inherited from
`~/.claude/settings.json`, not a delivery hook. Grok supports disabling that source
with `[compat.claude] hooks = false`, but applying it automatically would also disable
unrelated Claude-compatible hooks. Compatibility remains with Grok and Orca; this
package neither edits user config nor diagnoses third-party hook health.

#### Non-goals

- identifying which commands are closure gates;
- blocking pipelines or supplying a generic gate runner;
- changing `SKILL.md`, hook payloads, Grok configuration, or Orca hooks; and
- interpreting pipeline status as proof of individual stage outcomes.

#### Deferred

Raise the inherited Orca hook failure with Grok or Orca when an upstream issue can be
filed with the three-session evidence above. Add package behaviour only if a
delivery-owned hook fails in the same way; third-party noise alone is not that
trigger.

### The package is a thin protocol over native capabilities

Approved by the product owner on 2026-08-20 after the first plan in the reference consumer ran through
Claude Code control, Grok Build implementation and release, Codex review, and Orca
coordination. The first improvement proposal combined workflow routing, Orca lifecycle,
hook health, gate execution, learning, and the reference consumer's acceptance defects. That would turn
this package into another orchestrator and make one plan span independent owners.

The package instead owns only the protocol that must survive a change of project,
harness, or coordinator:

- the four phases and their dispositions;
- the human decision points when a result has no safe route;
- the decision record, transient plan, handoff, and delivery-log contracts;
- the requirement that identifiers and evidence come from observable sources; and
- the recurrence rule: evidence may produce a proposal automatically, but a human
  promotes a proposal into the workflow.

Everything else stays with the tool that already owns it:

| Concern | Owner |
| --- | --- |
| Task, Dispatch, inbox, ask/reply, waiting, terminal lifecycle | the selected coordinator; Orca is the reference implementation today |
| Model execution, sandbox, skill/plugin discovery, hook dispatch | the selected harness |
| Gates, model and effort choices, default branch, artifact and delivery-log paths | the consuming project's `AGENTS.md` |
| Candidate identity, branch protection, merge and authoritative automated checks | Git and the project's CI |
| Domain-specific acceptance, including viewport and capability-transition cases | the consuming project |

This clarifies two earlier terms rather than replacing their mechanisms. The Control
Session is the **semantic coordinator**: it holds the approved contract, talks to the
human, and decides the next phase. Orca owns the **transport and runtime** when present:
it carries tasks, messages, questions, completion and observation. Direct harness calls
and result files remain the fallback when no coordinator is installed.

No universal coordinator or harness interface is created now. Orca is the only
coordinator in use, and Claude Code, Codex and Grok are the only harnesses with observed
adapters. A second real coordinator or harness is the trigger to extract a shared
interface from two working integrations. Generality means that project facts stay out
of the core; it does not mean pre-building adapters for tools nobody has run.

Skills and plugins are integrated through each harness's native discovery and permission
mechanisms. The protocol asks for a capability such as candidate-isolated review or tool-layer
evidence; `AGENTS.md` selects the installed skill, plugin, harness and model that supply
it. This package does not become a plugin manager or translate one third-party hook
format into another.

#### Superseded 2026-08-21 — Review protects the authoritative candidate; a sandbox profile does not define the phase

Approved by the product owner on 2026-08-20 after a Codex reviewer completed its final
turn but could not send `worker_done` through the same read-only boundary that protected
the candidate. The earlier rule made the whole session read-only when the property review
actually needs is narrower: the reviewer must not modify the authoritative candidate.

That property is the portable contract. The selected harness owns how it enforces the
property, and the consuming project's `AGENTS.md` records the concrete profile. Scratch,
cache and result paths may remain writable outside the candidate. A harness that cannot
enforce the boundary declares that limit in its result; Control either accepts the weaker
isolation with the human's approval or selects another reviewer.

Internet access is independent of candidate isolation. For external documentation and
issue research, use the harness's native web or search tool and cite the source. Shell
network is not enabled merely because review may research. A gate that genuinely needs a
writable checkout or child-process network first relies on recorded implementation
evidence; a disposable review checkout is reconsidered only after a review misses a defect
that reproducing such a gate would have caught.

Completion also stays outside the review boundary. A blocking harness process ending with
a complete captured result is the portable completion signal. A coordinator-specific
`worker_done` may shorten observation, but it is not the only correctness path and the
reviewer is not required to cross its isolation boundary to send it. Where a coordinator
cannot observe that boundary, the phase uses the existing direct blocking fallback rather
than adding a relay or polling state machine.

Rejected in favour of this contract:

- one universal `read-only` profile, because the three harnesses give that name different
  filesystem and network semantics;
- a universal sandbox adapter, because native enforcement already owns the boundary and
  no second implementation has justified an interface;
- mandatory review worktrees, because no recorded round has yet been lost to reviewer
  mutation or to a gate that only a writable review checkout could run; and
- no sandbox plus a post-review tree check as the default, because detection after mutation
  is weaker than preventing it. It remains an explicitly degraded option for a trusted
  harness when a human accepts the limit.

The stronger candidate-immutability requirement and the direct blocking fallback are
superseded by the decision below. Their evidence remains valid: Codex read-only did block
candidate writes, gates, result paths and Orca completion. What changed is which cost is
worth paying before a reviewer has ever modified a candidate.

#### Interactive workers are coordinator-first; review independence does not imply a sandbox

Approved by the product owner on 2026-08-21 after the first self-update exposed two
coupled defaults. The Control Session launched six Codex and five Grok workers through
their headless entrypoints. After Orca was requested explicitly, it put the same headless
commands inside visible shell tabs rather than launching either harness TUI; six such
commands were observed and no Orca Run existed. Separately, Codex read-only had repeatedly
blocked gates, result writes and `worker_done`, although no recorded review had modified
the candidate it inspected.

When a project selects a coordinator, that coordinator owns dispatch and observation.
Workers launch through the harness's real interactive TUI, with the selected model and
effort pinned, and the coordinator carries the prompt, questions and completion. A direct
headless harness call is a fallback only when no coordinator is selected or the selected
coordinator is unavailable and the human accepts the loss of its capabilities. Putting a
headless command inside a coordinator terminal does not satisfy this contract.

Review remains a fresh session that receives the contract, candidate and evidence without
the implementer's reasoning. It reviews and reports; it does not implement or edit the
candidate. The phase adds no sandbox by default. The project may select a sandbox for a
concrete risk, but the fact that a harness is assigned to review is not such a risk by
itself. Ordinary project permissions keep native Internet access, gate execution, result
writes and coordinator completion available.

This deliberately relies on role discipline rather than pre-emptive OS enforcement. No
reviewer mutation exists in the recorded plans, while the cost of read-only isolation has
recurred. If a reviewer does edit the candidate, its result is invalid and Control
escalates; that incident is the trigger to design enforcement from the observed failure.
There is no candidate fingerprint, disposable review worktree, sandbox adapter, completion
relay or polling loop now.

Rejected in favour of this contract:

- retaining Codex read-only as the repository default, because it preserves an unobserved
  risk while reproducing blocked gates and completion;
- a writable disposable review worktree, because it adds checkout and dependency lifecycle
  before a reviewer mutation has occurred; and
- a generic coordinator adapter, because Orca is still the only selected coordinator and
  its native skills already own the required TUI and orchestration operations.

Consequences: review regains gate execution, ordinary Internet access, writable results
and native coordinator completion. A reviewer is technically able to edit the candidate;
doing so invalidates that review rather than opening an automatic repair path. A selected
coordinator becoming unavailable now interrupts the human before visibility is discarded.
This repository pins Codex review to `--dangerously-bypass-approvals-and-sandbox` in
`AGENTS.md`, so the absence of a sandbox is an explicit invocation rather than a hidden
default.

Non-goals: this does not standardise coordinator commands, add review hardening, prove
every harness/coordinator pairing or change the four phases and their dispositions.

Deferred: reconsider mechanical candidate protection after the first observed reviewer
mutation. Extract a coordinator adapter only after a second coordinator supplies a real
integration to compare with Orca.

Learning stays deliberately asymmetric. The journal and project delivery log are the
input. At closure an AI may compare the new drift with recorded shapes and propose a
mechanism or deletion. The proposal changes nothing until a human accepts it and a later
delivery reviews the change. No model edits the live skill, hook or project contract as
part of the run it is evaluating.

#### Self-hosting

This repository can consume its own protocol after one Routine bootstrap supplies the
`AGENTS.md`, gates and delivery-log path that every other consumer supplies. A
self-update then runs under one frozen installed version: the Control Session and every
worker use that version until review accepts the candidate. Candidate work happens in the project folder.

**Amended 2026-08-21.** This previously required a separate worktree, on the reasoning
that Grok's source-pointing hook must keep executing a stable checkout. The protection
was real but the mechanism was oversized: `findings.md` §30 established that what Grok
actually executes is `~/.grok/hooks/delivery.json`, pointing by absolute path at
`hooks/` and `bin/` in this checkout. Only those two directories can change a running
worker's harness. The rule is therefore not to edit them during a plan, which protects
the same property without maintaining a parallel checkout for every unit. Dissolving
the worktree also removed a real hazard of its own: recovering the candidate from it
required `git worktree remove --force`, which the safety layer correctly refused. Version bump, cache refresh, Grok wiring refresh and cross-harness smoke happen
between plans, never while a plan depends on the old contract.

#### Alternatives rejected

- **An all-in-one delivery engine** owning orchestration, gates, hook management and
  learning duplicates Orca, Git, CI and the harness plugin systems, and one failure in it
  would stop every combination at once.
- **An Orca-only workflow** is a useful deployment profile but would make a coordinator
  choice part of the protocol and remove the direct-CLI fallback.
- **A universal adapter layer now** would be an interface with one coordinator
  implementation and three already-different harness payloads. The record contains too
  many false conclusions from inferred payload shapes to design another one without a
  second observed implementation.

#### Consequences and non-goals

Improvements are delivered as small owner-aligned units. Evidence diagnostics can change
this package; Orca completion semantics first use or change Orca; product acceptance
stays in the product. Some coordinator/harness combinations may retain a documented
manual recovery until their native tool supplies the missing boundary. That is cheaper
and more honest than claiming seamlessness through an unverified compatibility layer.

This decision does not add a generic gate runner, typed human-override subsystem,
candidate fingerprint service, automatic skill mutation, or product-specific acceptance
checklist. Revisit a universal transport interface when a second coordinator is adopted;
revisit a local completion relay only if a bounded probe proves Orca cannot report a
read-only worker's completed final turn; revisit extra candidate identity machinery only
after a post-accept mutation causes a second lost round.

### 2026-08-21 — The package is published as `dely`, and every harness installs it from its own remote

#### Context

Approved by the product owner on 2026-08-21 in the control session for this
repository's first self-update, against frozen installed version 0.4.2 and a clean
`main` at `9d3c10c`.

Observed in this session rather than recalled:

- `claude plugin list` and `codex plugin list` both report `delivery@delivery-tools`
  0.4.2 installed and enabled. Both resolve that marketplace to this repository's
  own working tree.
- `grok plugin list` reports only `superpowers`, and `grok plugin marketplace list`
  does not contain `delivery-tools`. Grok reaches the skill through Claude Code's
  enabled plugins and runs the hooks from `~/.grok/hooks/delivery.json`, whose
  commands are absolute paths into the working tree.
- `grok plugin validate` on this package returns `Plugin manifest is valid`, with
  `1 skill dir(s), 0 command dir(s), 0 agent dir(s), hooks`. Grok 1.0.5 has native
  `plugin install`, `marketplace`, `validate` and `tag`, which §24 predates.
- Codex 0.148.0 exposes neither `validate` nor `scaffold`, so its manifest schema
  cannot be checked by command. Compared by hand against the first-party `browser`
  and `sites` manifests, `.codex-plugin/plugin.json` omits `skills`, `author`,
  `homepage` and `repository`, and gives `interface.defaultPrompt` as a string where
  both first-party manifests give an array. Codex installs and enables the package
  regardless.
- The repository has no remote and no tags. `core.hooksPath` is unset, so this
  repository does not run the `pre-push` guard that it ships.

Two problems follow. `delivery` is a generic name in a shared plugin namespace, and
`delivery-tools` names a marketplace after its only plugin. And the three harnesses
do not run the same bytes: two run a cache copy taken at install time while Grok runs
the live working tree, which `README.md` and `findings.md` §22 both record as having
already produced one false conclusion.

#### Decision

The published identity is `dely`: plugin `dely`, marketplace `dely`, installed and
cited as `dely@dely`. The plugin description is exactly
`A cross-harness delivery workflow for coding agents`.

The skill keeps the name `delivery` and the path `skills/delivery/`, giving
`dely:delivery`. A descriptive skill name routes better than a brand name, and it
leaves room for `dely` to carry further skills without renaming this one. No
compatibility alias skill is created.

The renamed release is `0.5.0` and it is the **first and only tag**. Nothing is
published under the retired identity. The remote receives the existing history
untagged first, so `9d3c10c` becomes an off-machine immutable rollback point without
`delivery@delivery-tools` ever existing as a release anyone can install.

Every harness installs from `git@github.com:hieuphung97/dely.git`. All three then run
a cache copy of a pushed commit, which removes the asymmetry above, and it makes the
published install path the same path this project uses daily. The local-directory
marketplace is removed from Claude Code and Codex in the same unit.

`.codex-plugin/plugin.json` is conformed in the same unit, on functional and
type-correct fields only: `skills`, `author`, `homepage`, `repository`, and
`defaultPrompt` as an array. The storefront presentation block —
`brandColor`, `logo`, `composerIcon`, `screenshots`, `capabilities`, `category` — is
not adopted.

Identity and manifest shape are one contract, not two: both declare what the package
claims to be, both live in the same three files, and both are proven by the same
gates and the same cross-harness smoke. Pairing them does not violate plan sizing the
way pairing a rename with a behaviour change would.

#### Alternatives considered

- **Tagging `v0.4.2` under the old identity first, as a rollback baseline.** Lost
  because rollback is served by the SHA, which the untagged bootstrap already puts on
  the remote. A tag would add a name, not a capability, while publishing an identity
  already decided against — and anything that installed or cached it would need
  migrating across three harnesses later.
- **Publishing nothing until the rename lands.** Lost because it leaves the Grok
  spike with no reachable repository and defers every publish risk to one act.
- **Identity only, deferring manifest conformance.** Lost on re-examination. The
  original objection was that a schema fix had no instrument distinguishing
  conforming from merely working. It does: `.skills` present and
  `defaultPrompt | type == "array"` are deterministic `jq` assertions, and one
  `codex exec` probe separates a skill that loads from a plugin that merely installs.
  Deferring would also pay the expensive part twice — the bump, three cache
  refreshes, the Codex re-trust by content hash and the Grok re-verify — for two
  fields, and would publish a type-divergent manifest inside a permanent tag.
- **Full conformance to the first-party interface block.** Lost because a CLI-only
  package cannot honestly supply a brand colour, a category, a capability list or
  logo assets, and inventing them is the ceremony this package's own decisions reject.
- **Keeping the local directory as the install source, or splitting remote for
  outsiders and local for this machine.** Lost because a published install path that
  nothing exercises is the reported-as-working-actually-inert shape recorded three
  times already (§14, §22, §24), and the split version lets the two paths drift with
  nothing detecting it.
- **`1.0.0` for the rename.** Lost because `decisions.md` still carries four Open
  questions and the Grok plugin-hook finding is stale pending a probe that may delete
  a documented rail. `0.5.0` says the contract is in use and still moving, which is
  what the record shows. `0.4.3` lost because the identity and the install source
  both change, which is more than a patch communicates.

#### Consequences

A change reaches a harness only after a push. That is a per-release cost, not a
per-edit one, because the self-hosting rule already fixes cache refresh at between
plans and never during. The fast local-edit loop for hook scripts is gone on Grok,
which is the point.

Each harness must clone a private SSH remote. Nothing here has verified that three
separate CLIs each hold working credentials for `git@github.com:hieuphung97/dely.git`,
and the spike will not verify it either, because the spike installs from a local
scratch copy by design. The rename plan carries this as its own acceptance row: a
real `marketplace add` against the remote from each harness.

The bootstrap push and the `pre-push` guard conflict. The guard tests the protected
branch list before it tests whether the branch is being created, so with
`core.hooksPath` set it refuses a push of `main` to an empty remote. `core.hooksPath`
is currently unset here, so the bootstrap succeeds today with no override. Installing
the guard in this repository therefore happens **after** the bootstrap, and from that
point this repository's own changes reach `main` through a pull request like any
consumer's.

Anyone who installed the old identity must uninstall and reinstall. That is two
people's machines and no published consumers, which is the cheapest this migration
will ever be.

**Amended 2026-08-21, same day.** The bootstrap push happened before the remote's
visibility was checked against its contents. `gh repo view` reported the remote
`PUBLIC` and empty; the product owner elected to push as-is; the push completed; the
decision was then reversed on the grounds that the evidence documents a private
consumer. The remote was set `PRIVATE` within about a minute, with `forkCount` 0 and
`stargazerCount` 0 observed after.

Two corrections follow. Visibility is now checked **before** a first push, not after
approval to push — an approval to publish is not an approval to publish to a public
place, and this session obtained the first without establishing the second. And the
remote is deleted and recreated once the pseudonymisation below lands, so the
unscrubbed commits do not survive as unreachable objects that GitHub still serves by
SHA. The rollback baseline is unaffected: this clone holds `9d3c10c`, and the
recreated history carries every commit with only the disclosing text changed.

The tag order in this record is unchanged but now follows the recreate: `v0.5.0` is
pushed to the recreated remote, so the first tag never sits on top of history that has
to be discarded.

#### Non-goals

- No universal installer, no plugin-manager abstraction, and no second marketplace
  manifest. Each harness's native `marketplace add` and `plugin install` are used
  directly.
- No compatibility alias skill, and no redirect from `delivery-tools`.
- No change to `SKILL.md`'s workflow rules, to the hook payloads, or to any harness's
  user configuration beyond the install and uninstall this decision names.
- Not a claim that Grok 1.0.5 dispatches plugin-bundled hooks. That is unsettled and
  is what the probe is for.

#### Deferred

**Answered 2026-08-21 — the Grok adapter stays.** The probe this paragraph called
for was run and settled it; evidence in `findings.md` §30. Grok 1.0.5 discovers a
plugin's hooks and dispatches none of them: `hooks: discovery complete total_hooks=0`
while every hook that ran came from a `global/` source, and the disposable plugin
appears only in `plugins::discovery`. The rename unit therefore changes the adapter's
path and nothing else about it — `hooks/grok-hooks.json.template`, the
`~/.grok/hooks/delivery.json` install step and the `delivery-doctor` check all stay.
Two constraints the probe added for that unit: `grok plugin install` refuses a local
directory without `--trust`, and Grok copies the plugin into
`~/.grok/installed-plugins/`, so all three harnesses now run a cache copy. Whether a
git remote install prompts for trust the same way is untested.

The original plan of record, kept because it is why the answer is trustworthy: A disposable copy of the package is installed into Grok from the scratch
directory under a throwaway plugin name, so its hook commands resolve to the scratch
path while the existing adapter resolves to the repository path; a journal record or
`--debug-file` line naming the scratch path is then produced only by native plugin
dispatch. One `grok plugin uninstall` reverts it, and no live wiring is moved. If
native dispatch is observed, the rename unit deletes `hooks/grok-hooks.json.template`,
the `~/.grok/hooks/delivery.json` step in `README.md`, and the `delivery-doctor` check
that fails without it. If it is not, all of that stays and only its path changes. The
plan is written after the result, so its acceptance table is built against an
observation.

**The Codex storefront metadata**, if Codex ever publishes a schema or a `validate`
command that reports the omission as an error. Documentation alone is not that
trigger.

**The inherited Orca hook failure**, unchanged from the entry above: 617
`global/settings` failures across three Grok sessions from `${SYSTEMROOT}` in a
dormant Windows branch, against 620 `global/orca-status` and 85 `global/delivery`
successes. Reproduce minimally on Grok 1.0.5 and route to Grok or Orca. This package
adds no workaround and does not disable Claude-compatible hooks as a class.

#### Amended 2026-08-21, after publication — the facts this record rests on, and where the Grok adapter points

This record was written against frozen 0.4.2, a clean `main` at `9d3c10c`, an empty
remote and an unset `core.hooksPath`. Four of those premises have moved. The contract
above is unchanged in substance; what follows corrects the state it rests on, so the
rename plan is not written against a repository that no longer exists.

**The rollback baseline is no longer `9d3c10c`.** The remote was deleted and recreated,
and now carries a fresh root, `338ed21`, with no ancestor in common with the
pre-publication history. `9d3c10c` survives only in this clone, on
`archive/pre-publication-history`. The off-machine rollback point for the rename is
`0b73f5c`, the merge of the first pull request, which is the published 0.4.3 state.

**Something is published under the retired identity, and the tag clause survives it.**
0.4.3 shipped and merged as plugin `delivery` from marketplace `delivery-tools`. The
clause that carried weight was that no *tag* names the retired identity, and none does:
`git tag` is empty. `0.5.0` remains the first and only tag.

**The private-clone risk is retired.** The recreated remote is public, so a
`marketplace add` needs no per-harness credential. The acceptance row this record
reserved for a real `marketplace add` from each harness stays, because per-harness
reachability is still unproven; what it no longer carries is a credential failure mode.

**`core.hooksPath` is installed**, so this repository now runs the `pre-push` guard it
ships and reaches `main` through a pull request. The bootstrap conflict described above
is spent: it applied to pushing to an empty remote, which has happened.

##### The Grok adapter points at Grok's own installed copy

The Deferred note above settled that the adapter stays and that the rename changes its
path. It did not say to what. Decided by the product owner on 2026-08-21: Grok installs
natively from the remote, the same as the other two, and
`~/.grok/hooks/delivery.json` is regenerated against the root that
`grok plugin details` reports for that install rather than against this working tree.

That is what the install-source decision above already says on its face — every harness
installs from the remote — and it is the only option that makes Grok independent of
Claude Code's enabled set. Two costs are accepted rather than discovered later. Whether
a git-remote install prompts for `--trust` the way a local directory does is untested;
findings §30 established the local behaviour and explicitly did not establish the remote
one. And the machine then holds two copies of the package, Claude Code's cache and
Grok's, which can drift when only one is refreshed.

Both costs land in the migration, not in the implementation, which is why the migration
is separated below.

##### The machine migration is a procedure between plans, not part of the implementation

The unit changes repository content only. Uninstalling the retired identity, removing
the local-directory marketplace, adding the `dely` marketplace in all three harnesses,
`grok plugin install`, regenerating the adapter, re-trusting Codex hooks and refreshing
caches all happen after release, between plans.

This is not a new rule. `AGENTS.md` already fixes cache and Grok hook refresh at between
plans and never during, and an implementation that uninstalled the running plugin would
change the harness under its own plan. The 0.4.3 correction was carried the same way:
accepted, released, installed, forward-tested, as four separate steps. The untested
`--trust` behaviour therefore cannot cost the plan a round; it can only cost the
migration a retry, where a human is present.

##### The instrument that proves the skill loads changes harness

This record proposed one `codex exec` probe to separate a skill that loads from a plugin
that merely installs. That instrument predates the 0.4.3 correction, which made a
headless harness call a fallback requiring explicit human approval. The equivalent
evidence is now produced by the forward smoke: an interactive worker launched through
the selected coordinator reports the namespaced skill it loaded and the root it loaded
it from. That is the same discrimination without a headless dispatch, and it is the
shape the 0.4.3 forward smoke already ran.

##### Deferred — the journal path the session-start hook injects does not exist

Observed 2026-08-21 while running the 0.4.3 forward smoke, and left alone because it is
a behaviour defect and this unit is an identity change. Three places disagree about the
journal's shape:

- `hooks/post-tool-journal.sh:45` writes a per-session **directory**,
  `${journal_dir}/${session_id}/`, one file per event.
- `hooks/session-start-context.sh:46` injects
  `${journal_dir}/${session_id}.raw.jsonl`, the flat file the writer no longer creates.
  Every session is therefore handed a path that does not exist.
- `bin/delivery-doctor:143` counts only `-name '*.raw.jsonl' -type f` at depth 1, so its
  "session file(s)" count reports the obsolete shape and ignores every current session.

`bin/delivery-evidence:59` already reads both shapes deliberately and is correct. The
trigger for acting is this rename reaching closure, so the fix lands between plans in
its own unit rather than under this one.

### 2026-08-21 — Consumer identifiers are pseudonymous; the evidence itself stays whole

#### Context

`dely` is intended for public use. Its central claim is that every rule in
`SKILL.md` cost a real delivery a real round, and `docs/findings.md` is where that
claim is checkable. That document, and four others, name a consumer project that
`decisions.md` itself records as private, together with its plan identifiers,
branch names, test counts and internal filenames — 26 mentions across
`README.md`, `AGENTS.md`, `docs/decisions.md`, `docs/findings.md`,
`docs/harness-surface.md` and `docs/options.md`.

The tension looks like a trade between credibility and confidentiality. It is not.
A public reader cannot resolve `Plan D` against anything, because the consumer's
delivery log is private. The identifier is therefore pure disclosure carrying no
evidentiary benefit to the reader who sees it. What is load-bearing in those
passages is the shape of each failure, its recurrence count, and the aggregate
measurements — 41 plans, 103 implementation rounds, roughly 2.8 rounds per plan,
8 of 35 accepted at first review. None of that requires a project's name to be
true, checkable in shape, or useful.

#### Decision

Consumer identifiers are replaced by stable pseudonyms. The project is
**the reference consumer**. Plan identifiers become opaque labels assigned in
order of first appearance. The mapping to real identifiers is a crosswalk the
product owner keeps outside this repository.

The mapping is **one-to-one and stable across all files**. Several arguments turn
on recurrence rather than on any single plan — `findings.md` §1 reasons from
"then the second occurrence, then the third" — and those arguments collapse if two
real plans share a label or one real plan takes two.

Nothing else in `findings.md` changes. Section order, wording, chronology, counts
and the record of this document correcting itself all stay exactly as they are.

Completeness is proved by a gate, not asserted:

```bash
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

must return no tracked matches. It joins the
closure gates in `AGENTS.md`, so the property cannot regress silently later.

The gate is two commands, not one. The project-name component needs
case-insensitivity; the identifier-family component must not have it. The two
were fused once, and that fusion certified the opposite of the contract.

The first identifier pattern covered one family. Review found other
letter-digit plan labels surviving a green gate. A gate that passes while the
contract fails is worse than no gate. The replacement is the anchored,
case-sensitive family in the second command. It was measured against the
candidate rather than assumed: 13 matching lines, 11 of them real consumer
identifiers, two others the contract wanted gone, measured false-positive rate
zero against that tree.

The replacement's own source text does not match it, so it can be written into
`AGENTS.md` verbatim. The superseded pattern cannot be kept beside it: that
pattern's literal source text itself contains a letter-digit pair the
replacement matches, so retaining the old spelling would make the gate fail on
its own definition.

The first correction was measured correctly and written down wrongly. What was
measured: `(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)`, case-sensitive
and anchored, 13 matching lines. What was written into the plan and
`AGENTS.md`: a single `git grep -Ei` that combined the project-name pattern
with the identifier family, anchors dropped and `-i` added. With `-i`,
`[A-Z]` matches lowercase, so the pattern matches a letter followed by digits
anywhere inside a token: hex SHAs, `WSL2`, `A2A`, version strings, `toolu_…`.
Measured on the candidate at that moment: 76 lines, against the 13 the plan
claimed.

Anchoring and case were the entire mechanism. Dropping them while keeping the
description is how a gate comes to certify the opposite of what it says.

Re-verified on the candidate: component 1 zero lines, component 2 zero lines,
no self-match on either, fails with one identifier reintroduced, passes after
restore.

An instrument is cited by running it, not by describing it. A pattern that
appears in a plan, a decision record and a gate must be the same bytes in all
three, and the measurement that justified it must have been run against that
exact text.

The pattern was checked against GNU and BSD `grep -E` behaviour only through
`git grep`, which uses its own regex engine. If a gate is ever run through a
different tool, re-verify the self-match result rather than carrying it over.

The contract extends to consumer hex identifiers: a commit SHA belonging to
the consumer's repository, and a session id whose working tree was the
consumer's repository, are redacted; identifiers belonging to this project's
own tooling stay. This class is enforced by human reading rather than by the
gate, because no pattern separates the consumer's identifiers from this
project's own.

The remote is deleted and recreated once this lands, and the scrubbed history is
pushed fresh. Publishing `dely` publicly stays a separate deliberate act after that.

**Amended 2026-08-21, same day.** The decision above was to keep the evidence
whole and replace identifiers with pseudonyms. That is now true only of what
remains in this package. Three rounds of redaction each found another class
of consumer residue the previous round had not named. The product owner
reframed the problem: content about the consumer is not scrubbed from `dely`;
it is not in `dely`.

`docs/findings.md` keeps findings about this package, any harness, the
protocol and the rails, plus the aggregate claims that justify a rule —
41 recorded plans, eight plans, eighty call sites, 2.8 rounds per plan —
because those identify nobody and `SKILL.md` depends on them. The project's
own record keeps its delivery-log table, cause-taxonomy detail, plan
chronology, UI copy, internal filenames, pull-request and correction
numbers, and run fingerprints. Where a passage carried both a mechanism and
a consumer instance, this package keeps the mechanism and cites the
project's record as the source.

The earlier reasoning still holds for the surviving text: identifiers there
are one-to-one pseudonyms, the mapping is a crosswalk the product owner
keeps, and the grep gate still enforces the named-identifier property. The
sentence that "nothing else in `findings.md` changes" does not apply to
passages the project owns. Those passages leave; they are not rewritten in
place.

#### Alternatives considered

- **Reorganising `findings.md` by rule** — harness evidence, then protocol failures
  indexed to the rule each produced, then corrections. It is what a public reader
  arriving from `SKILL.md` actually wants. Lost for now because the blocker is
  disclosure rather than organisation, because a 2,196-line rewrite makes the scrub
  unverifiable in the diff, and because chronology is itself evidence: a document
  that shows itself being corrected five times demonstrates what a tidy one merely
  asserts. Revisit when a reader reports that they could not find why a rule exists.
- **A curated public summary with the full journal kept private.** Lost because two
  documents drift, and because it moves the auditable evidence behind the wall while
  leaving the claim in front of it, which is the weaker half of both options.
- **Pushing as-is and accepting the disclosure.** Chosen briefly and reversed the
  same day; see the amendment above.
- **Leaving history and scrubbing only going forward.** Lost because it makes the
  repository permanently unpublishable as-is, enforced by memory rather than by a
  mechanism.
- **Force-pushing a rewritten history instead of recreating the remote.** Lost
  because unreachable objects stay retrievable by SHA on GitHub for an unbounded
  period, so it reduces the disclosure rather than removing it.

#### Consequences

The product owner must hold the crosswalk, and a finding traced back to a real plan
needs it. That is one small private table against a repository that can be published.

Anyone reading `findings.md` publicly must take the aggregate measurements on the
document's own account, since the source log is private. That was already true and
is not made worse by pseudonymisation.

The grep gate is lexical. It will flag a legitimate future use of the letter-digit
pattern it matches, which costs one inspection and is the correct direction for a
gate whose failure mode is silent disclosure.

The gate catches names, not structure. Two things were verified in this session
rather than assumed: the pattern does not match its own text, so it can be written
verbatim into `AGENTS.md` without triggering itself; and a sweep for consumer
artifacts outside the pattern still found residue it would never catch, a consumer
session id at `findings.md:1224`. The implementer therefore reads all 56 matching
lines and their surroundings rather than treating a green gate as completion. The
gate proves the named identifiers are gone. It proves nothing about a quoted path or
a session id from the consumer's tree.

#### Non-goals

- Not a reorganisation of `findings.md`, and not a rewrite of any observation.
- Not a redaction of the measurements, the failure shapes, or the corrections.
- Not a claim that the brief public window disclosed nothing; it is a claim that
  `forkCount` and `stargazerCount` were both 0 when the window closed.
- Not a decision to publish `dely` publicly. That remains separate and deliberate.

#### Deferred

**Reorganisation by rule**, triggered by a reader who could not locate the evidence
behind a rule they were asked to follow.

**Publishing publicly**, triggered by the product owner reading the scrubbed
`findings.md` once with a publisher's eye, after the recreate.

---

## Open

### Answered 2026-08-20 — hooks under bypass, and the exit code

Both were the two blocking unknowns. Evidence and full payload in
`findings.md` §7.

**Hooks do fire under `bypassPermissions`.** Both hooks ran and the payload
itself records the mode. The design is viable under the permission policy the
product owner chose, and `cc-safety-net` has a reason to work there too.

**Pass or fail comes from which event fires, and the exit code exists on the
failure path.** `PostToolUse` means completed; `PostToolUseFailure` means it did
not, and its `error` field begins with `Exit code N`. Confirmed by a second run,
`findings.md` §8, which also corrected an earlier wrong claim in §7 that no
source carries a numeric exit code.

**Therefore OTel is not on the critical path.** The hook alone yields the command,
the output, pass or fail, the exit code on failure, the duration and a
correlation id. OTel remains worth having for cost and duration across sessions,
but the evidence layer no longer depends on standing up a collector.
`hooks/post-tool-journal.sh` keeps its place: `cc-safety-net`'s audit trail
records decisions, not output.

**The two events carry different payload shapes**, which is the part that can
silently mislead. A failed call has no `tool_response` at all, so reading
`.tool_response.stdout` reports every failure as producing no output. Both shapes
are now normalised in `bin/delivery-evidence`.

**The gap raised above is closed.** `findings.md` §9: `error` carries stdout and
stderr **combined**, so a red gate's summary line is present. Nothing needs
wrapping, no collector, no `PreToolUse` rewriting.

The evidence layer is therefore **complete with the hook alone** — command,
verbatim output, pass or fail, exit code, duration, correlation id. The only
residual property is that on the failure path the two streams arrive merged and
cannot be separated, which the evidence contract does not ask for.

### Freshness is a separate property from resolution

Forced by a defect in this repository's own hook, recorded in `findings.md` §7.
It reported `origin/main` from the local remote-tracking ref after a merge had
landed on the remote, so a stale baseline was injected as authoritative fact.

Resolving an identifier with a program removes the transcription error. It does
not remove the staleness error. `git rev-parse origin/main` is exactly as wrong
as a retyped SHA when the ref is old.

Consequence adopted: anything derived from a remote-tracking ref is labelled as
such and carries the time of the last fetch. Hooks perform no network I/O — a
session-start hook that can hang on a fetch is the worse trade.

### Where the journal lives

Currently `${DELIVERY_JOURNAL_DIR:-$HOME/.delivery-journal}`, outside any
repository. Both obvious alternatives have already failed: git-ignored inside
the repository died of having no reader, and committing it would add noise to
every run and break the clean-tree assertion every handoff depends on. The
third way is a journal with a *program* reader, and the reader is what makes it
survive. Not yet written.

### Does Grok discover project-level `.agents/skills/`

`grok inspect` answers it for a given directory. Affects whether the canonical
skill entry point needs a `.grok/skills/` symlink, which would itself dirty the
tree unless gitignored first.

---

## Rejected

| Option | Reason |
| --- | --- |
| tmux and worktree orchestrators (CAO, cmux, kmux, Claude Squad) | solve parallel isolation, which this workflow explicitly does not want; PTY scraping cannot yield reliable structured results, and first-party dashboards now provide the observability they were wanted for |
| A2A protocol | no CLI harness implements it |
| Building a bespoke orchestrator or harness | the four-phase state machine has eleven transitions; the missing piece is input and output discipline, not coordination |
| Auto-promoting lessons into instructions (`claude-reflect`, `self-improving-agent` and similar) | contradicts the existing rule that instructions change only on recurrence; the correct shape is journal, then proposal, then explicit human promotion |
| Superpowers `writing-plans` and `executing-plans` | mandate subagent-driven execution, two-to-five-minute steps, per-task commits and worktrees — all four rejected by the founding ADR with reasons. Worth borrowing: the `Interfaces (Consumes / Produces)` block and a `Global Constraints` header |
| Retyping a payload into a file by hand | that makes the assistant the lossy transport the whole design removes |
