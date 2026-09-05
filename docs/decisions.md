# Decisions

What has been settled, what is still open, and what was rejected and why.
Rationale is kept because the reasons are the reusable part.

Last updated 2026-09-04.

---

## Settled

### 2026-09-04 — Orca orchestration is the execution plane, and Dely stops hand-rolling dispatch

#### Context

Dely already requires Orca and forbids headless dispatch, but it wrote its own
procedure for the parts of a dispatch Orca can perform: waiting for a worker,
deciding whether a prompt was submitted, recovering from a harness dialog, and
identifying a session. That procedure is prose, and it has been failing.

Twenty-eight accepted deliveries are recorded in the opt-in machine-local
maintenance log. Across them, roughly one hundred and forty review dispositions
carry about fifty-five `CHANGES_REQUESTED` — near two in five. Twenty of the
twenty-eight deliveries carry at least one, and thirteen fail their first review.
The rate is not converging: deliveries in the first half of the window carry
zero to three, deliveries in the last week carry four, five and eight. The
protocol repository fares far better than the consuming application repository
that exercises it at scale, which is where the contract's assumptions break.

Sixteen frictions recurred across four consecutive delivery waves in that
consuming repository. Nine of the ten worst deliveries name Control's own
contract — an under-scoped plan, an unchecked premise, a wrong census, a rule
defined twice — rather than an implementer's work, as the drift source. The
remediation clause routes an in-contract finding to "the original implementer",
which is the wrong party for a defect in the plan.

A probe on 2026-09-04 measured the execution plane rather than reasoning about
it, and it changed the design:

- Orca knows all seven harnesses, but under agent ids that are not the binary
  names. `agy`, `kiro-cli` and `cursor-agent` return `agent_unconfigured`;
  `antigravity`, `kiro` and `cursor` are the ids that resolve.
- `worker-start` exits 0 with a receipt that reports `launch.requested`
  beside `launch.effective`. The rule "name the model and effort on every
  dispatch" had had no evidence behind it until this record cited that
  receipt; a later measurement withdrew that evidence. The rule stands, and
  now rests on the launch argv rather than on a receipt.
- Two typed failures correspond exactly to two paragraphs Dely wrote by hand.
  `agent_prompt_blocked` is a modal sitting between launch and composer.
  `agent_prompt_stalled` is input that never took — the readiness failure this
  skill described as a ninety-second allowance and a single Enter.
- The modal that actually blocked a launch was not a trust dialog. It was a
  version-update prompt. The trust-handling column has been enumerating
  instances of a class it cannot finish enumerating: trust dialogs, update
  nags, session-restore pickers, changelogs.
- Worse, one of its cells is wrong. On a path with no entry in Claude Code's
  exact-path trust store, a launch carrying `--dangerously-skip-permissions`
  reached the composer with no dialog shown and no entry created. The cell
  asserts that flag "does not suppress it" and tells Control to select an
  option that never appears — while the same cell warns that a bare Enter
  quits the worker. Acting on the stale instruction is actively harmful.
- Orca's injected worker preamble already requires a short executive summary in
  the message body and a `payload.reportPath` pointing at any long-form
  artifact. The convention this project was about to invent already exists.

#### Decision

1. Orchestration is a required Orca capability. When it is absent, the existing
   rule applies unchanged: stop, with no headless fallback. `README.md`
   documents enabling it once, in the shared prerequisites, because the
   requirement is harness-independent.
2. Dispatch mechanics come from the plane. `worker-start` establishes
   readiness, `check --wait` is the completion wait, the worker reports once
   with `worker_done` and an outcome, `worker-release` returns the terminal,
   and `worker-read` is the bounded evidence read. The blocking-wait paragraph,
   the submission-detection paragraph with its ninety-second allowance and
   single-Enter procedure, and the session-id capture instruction are deleted;
   the dispatch id replaces the last of these.
3. Two typed errors replace the dialog catalogue. `agent_prompt_blocked` means
   read that terminal and clear the modal that is actually there;
   `agent_prompt_stalled` is a liveness inspection. Neither enumerates a
   vendor's dialogs, so neither goes stale when a vendor ships a new one.
4. The prompt and the handoff stay files inside the worktree. Messages carry a
   short body and a `payload.reportPath`. The reason is this skill's own rule:
   a task spec and a message body are shell arguments, and prompts do not go in
   shell arguments.
5. `references/harnesses.md` keeps only facts verified in this delivery — the
   Orca agent id, the forbidden headless forms, and answers whose wrong choice
   destroys the worker. An unverified per-harness fact is deleted rather than
   carried, because this skill tells Control to prefer that file over a
   harness's own help output, which makes a stale cell worse than an empty one.
   This supersedes the column list settled on 2026-08-28, which named trust
   handling as a column of this table; that record is amended in place rather
   than rewritten, because its reason for the file's existence still holds.
6. No worker runs while a review of the same working tree runs, and the reason
   is stated: the tree and its gate surface are shared mutable state, and a
   review reproduces gates in that tree.
7. A review states what it did not verify, mirroring the design side's existing
   record of what the instruments cannot observe.
8. Control owns the plan and the decision record for the whole run, including
   remediating findings inside them. Amending them is not implementing the
   candidate. The reviewer that raised such a finding scope-checks the
   amendment.
9. Any claim about extent — an allowed scope, a count, a set of call sites —
   states the command that produced it, and where the claim is a count or a
   scope its instrument enumerates rather than samples.
10. `One pass` means one remediation pass per finding, not per review.
11. The plan is deleted in the release commit, before the release-binding
    review, so its deletion is inside the candidate that review verdicts.
12. The maintenance log's field labels are named. The text has said "labelled
    fields" without saying which, and five different spellings are already in
    service across the recorded lines.

#### Alternatives considered

**Terminal primitives plus a sentinel file.** Wait on `tui-idle` and have the
worker end a handoff file with the existing end-of-handoff sentinel. Rejected:
idle cannot distinguish a finished worker from one waiting on a question, which
is a distinction this skill already depends on; the idle detector is documented
for six agent CLIs that do not include four of the seven harnesses here; and a
worker's death stays silent until a deadline instead of arriving as an outcome.
The file half survives in decision four for a different reason — shell-argument
safety — not as a completion mechanism.

**Optional orchestration with a fallback path.** Rejected: two dispatch paths in
one contract, of which the rare one rots unexercised. The probe also showed the
adoption cost is lower than assumed; the feature was already enabled and already
carrying this project's own deliveries.

**Task graphs with dependencies, and the plane's decision gates.** Rejected:
tasks are sequential by contract, so a dependency graph buys nothing and invites
the concurrency that decision six forbids. Decision gates would add a second
approval surface beside the in-chat approval this skill treats as its boundary.

**A ready-indicator column in the harness reference.** This was the shape
proposed before the probe. Rejected by the probe itself: a cell can go stale, and
one already had. A typed error cannot go stale the way an enumerated fact does.

**Deleting the maintenance log as redundant with the plane's run records.** The
run records hold dispatch lifecycle; they do not hold why a delivery drifted.
Reading the log showed its drift-cause sentences are the source of nearly every
friction this record fixes, at a cost of one appended line per accepted delivery.
Rejected, and the log's field labels are named instead.

**Raising the contract script's line ceiling.** Rejected for this delivery. The
budget is met by removing a check the hosting platform already performs, and the
ceiling should be revisited on its own evidence rather than inside the change it
constrains.

**A mandatory read-only scoping dispatch before planning.** Correct in diagnosis
and wrong in shape: it adds a phase, taxing every future delivery, to fix what
decision nine fixes with one sentence. Deferred rather than adopted.

#### Consequences

This decision ships in **0.17.1**. `0.17.0` was not reusable: that number had
already been tagged and released on 2026-09-01 for the tree that added the
seventh harness, and this record's own change merged three days later. Bumping
the manifests without advancing the number left two contents sharing one
version, and an install of `0.17.0` from the release surface returned the
protocol this decision replaced. A decision that changes the shipped protocol
names the version that carries it, in this section, before the tag is cut.

Dely's dependence on Orca deepens from launching terminals to owning the worker
lifecycle. The orchestration guide documents its own contract migrations, so the
mitigation is the practice this skill already follows: reference the version-
matched guide, state invariants, and never pin argv.

Control must run inside an Orca-managed terminal, because a run binds to a
coordinator handle. Users must enable a feature that ships disabled.

Removing the issue-form checker trades a fast local signal for a slower one: the
hosting platform surfaces a malformed issue form on its own pages rather than in
continuous integration.

The skill gets shorter while gaining rules, because the deleted procedure is
longer than the delegation that replaces it.

This decision is **not** expected to improve: concurrency safety, which the plane
explicitly declines to schedule or infer, leaving decision six as Dely's own
rule; mid-run dispatch drops in any individual harness; or a vendor's first-run
modals, which decision three routes rather than prevents.

#### Non-goals

Parallel task execution. Workers on another connected host. Nested workers.
Replacing the in-chat approval gate. A capability matrix describing the harness
that Control itself runs on.

#### Deferred

- Giving the repeated completion wait a stated exit. `timeout` occurs nowhere in
  the skill; the wait is bounded only by whatever deadline Control passes the
  plane. Trigger: a measurement showing the plane does not always surface a dead
  worker as an arriving settling message.
- A worker that ends its turn without finishing or reporting has no typed error.
  The plane reports the terminal alive and ready, so only a Control-side deadline
  distinguishes it from slow work. Trigger: a second occurrence, or a typed
  signal appearing in the plane.
- The prerequisite command is unverified against a disabled runtime. `README.md`
  tells a reader that `orca orchestration run-list --json` confirms orchestration
  is enabled; nobody has observed it fail when orchestration is disabled. An
  instrument only ever seen green is the defect this record is about. Trigger: a
  runtime with the feature off.
- The issue-form checker's removal rests on an unobserved premise: that the
  hosting platform rejects a malformed issue form. Nothing in the repository
  depended on the checker, but that argument was not tested. Trigger: a malformed
  form reaching a contributor.
- Absence assertions are literal, so a paraphrased restoration of deleted text
  passes. Inside the limit already stated: the checker proves a phrase present or
  absent, never that a rule means what it says.
- Wording defects left unabsorbed, each recorded rather than fixed because none
  lets an instrument accept a wrong implementation: the launch table's intro
  promises a note per harness while two of seven carry one, with no statement
  that an empty cell means "not measured here"; the Claude Code cell records the
  model pin but not the effort pin the receipts also show; a general rule about
  omitting effort sits in one row; the troubleshooting entry names orchestration
  as a possible missing capability but offers no command that distinguishes it;
  the preflight fence's comment column is misaligned; and the release-ordering
  check pins a line whose semantics-preserving rewrap would turn it red, and
  lacks a guard that keeps shell noise off a correct failure.

- Restoring any per-harness behavioural claim deleted by decision 5. The launch
  table previously asserted, for each harness, whether an interactive launch
  prompts a workspace trust dialog, whether the permission-default flag suppresses
  it, which option is preselected, and which keystroke is destructive; plus
  per-harness launch notes covering the `--agent` launcher, Kiro's `/tools
  trust-all` step and its interactive flag, Cursor's `--force --trust` and its
  `-w` prohibition, and Copilot's unavailable-model fallback and its
  session-restore picker answered with Escape. One of those claims was measured
  false on 2026-09-04 and the rest were not measured at all. Trigger for restoring
  any single one: a launch that a probe shows it would have prevented.
- Requiring the implementer to re-run the scope command before implementing.
  Trigger: drift-cause sentences still naming late scope discovery after roughly
  ten further deliveries.
- Raising the contract script's line ceiling. Trigger: an eighth harness, whose
  README and discovery assertions do not fit the remaining budget.
- Flipping the Kiro launch prescription away from its interactive flag. Trigger:
  a second machine or a second version reproducing the stall.
- Handling a first-run vendor modal beyond reading the terminal. Trigger: a
  blocked launch that reading the terminal cannot clear.

#### Limits of this delivery's evidence

`tests/contracts.sh` is a structural checker. It proves a phrase present or absent
and that a named section contains it; it cannot prove a rule means what it says,
that Control will follow it, or that the execution plane behaves as described.
Runtime behaviour was measured once, on one machine and one Orca build, by the
2026-09-04 probe and by this delivery's own dispatches; no gate re-measures it.
Several rules ship with no executable instrument and a human reading the diff as
their declared check, which is only worth keeping if someone reads it.

### 2026-08-31 — GitHub Copilot CLI is a first-class seventh harness, and it needs no sidecar

#### Context

Dely ships as an installable package for Claude Code, Codex CLI, Grok Build,
Antigravity CLI, Kiro CLI, and Cursor Agent CLI. The 2026-08-27 packaging rule
says a plugin-capable harness gets a thin nested sidecar pointing at `./skills/`,
root `plugin.json` does not grow for another vendor, and `npx skills` is the
fallback only where no such sidecar exists. That record also rejected raising the
`tests/contracts.sh` 250-line cap, on the grounds that a sixth harness must not
make a seventh impossible. This is that seventh harness.

Live GitHub Copilot CLI 1.0.82 was probed on macOS on 2026-08-31, against the
already-configured user profile:

- `copilot plugin marketplace add https://github.com/hieuphung97/dely.git`
  reports `Marketplace "dely" added successfully` and caches this repository's
  existing `.claude-plugin/marketplace.json`. `copilot plugin marketplace browse
  dely` lists the `dely` plugin. `copilot plugin install dely@dely` reports
  `Installed 2 skills`, `copilot plugin update dely` reports `Updated 2 skills`,
  `copilot plugin uninstall dely` succeeds, and `copilot skill list` shows
  `delivery` and `setup`. Install copies the whole package into
  `~/.copilot/installed-plugins/dely/dely/`.
- Copilot therefore resolves this repository through manifests that already
  exist. It reads the root `plugin.json` and finds `skills/` by convention; no
  Copilot-specific manifest was present during any of those runs.
- `copilot plugins list` reports repository instructions `AGENTS.md` and
  `CLAUDE.md` as loaded; `--no-custom-instructions` is the flag that disables
  that loading.
- `copilot --help` enumerates `--effort, --reasoning-effort` as
  `none|minimal|low|medium|high|xhigh|max`.
- There is no non-interactive model listing. `copilot models` fails with
  `Invalid command format`. `copilot -p "/model"` is not answered locally: it
  dispatched a real turn that auto-routed to `claude-haiku-4.5`. An unavailable
  `--model` value neither lists alternatives nor stops the run — the TUI prints
  `Model "claude-sonnet-4.5" from --model flag is not available. Using "auto"
  instead.` and continues. Entitlement is per account, so any stored slug list
  would be wrong for some reader.
- An interactive launch carrying `--allow-all` still opens `Confirm folder
  trust` — `Do you trust the files in this folder?` with `1. Yes` preselected,
  `2. Yes, and remember this folder for future sessions`, and `3. No (Esc)`. The
  permission flag does not suppress it.
- A second surface follows trust: `Restore interrupted sessions`, listing
  interrupted sessions from every folder with them preselected, footed
  `enter restore · esc start fresh`. It appeared on a first launch in a
  brand-new empty directory, listing sessions belonging to other paths. Enter
  there adopts an unrelated session instead of starting the dispatched worker.
- `-p, --prompt` is the non-interactive form. `--allow-all` is the documented
  equivalent of `--allow-all-tools --allow-all-paths --allow-all-urls`, with
  `--yolo` as its alias.

#### Decision

GitHub Copilot CLI is a first-class harness, equal in kind to the other six.
Its exact label everywhere a human reads or selects one is `GitHub Copilot CLI`.

Packaging adds nothing. The 2026-08-27 rule is satisfied by observation rather
than by a new file: Copilot installs from the manifests already in this
repository, so there is no `.copilot-plugin/` sidecar, no growth of root
`plugin.json`, no second skill tree, and no `npx skills` path for Copilot. A
sidecar is added later only if Copilot stops resolving this repository.

Install is documented with native Copilot verbs and the same shape as the Claude
and Codex sections: `copilot plugin marketplace add` of the git URL, then
`copilot plugin install dely@dely`, with `copilot plugin list`, `copilot plugin
update dely`, and `copilot plugin uninstall dely`. Because Copilot registers the
marketplace separately, uninstalling the plugin leaves that entry behind, and
`copilot plugin marketplace remove dely` is documented beside it.

Setup discovers Copilot effort from `copilot --help`'s `--effort` flag and does
not discover a model. Model is written as the literal `default`, which omits the
flag. A human may still name a slug, and setup does not invent one, store a
catalogue, or learn one by prompting the model. Setup does not write
`~/.copilot`. Copilot is a native `AGENTS.md` reader and also loads `CLAUDE.md`,
so neither file is called inert on Copilot; the `CLAUDE.md` write offer stays
Claude-Code-only.

Workers launch as an interactive `copilot` TUI carrying `--allow-all`. Never
`-p`/`--prompt`. `--model` and `--effort` are pinned from the managed block, each
omitted when its cell is `default`. A pin the account cannot use is not an
error: Control reads the `Using "auto" instead` line rather than assuming the pin
held. Trust is answered with the preselected `1. Yes`, never
`2. Yes, and remember this folder for future sessions`, because a dispatch must
not leave persistent trusted-folder state on the machine. Where the
`Restore interrupted sessions` picker follows, Control presses Esc to start
fresh; Enter there is a wrong-session hazard, not a submission.

The two versioned manifests advance together to `0.17.0`; root `plugin.json` and
`.cursor-plugin/plugin.json` stay versionless and unchanged. Human bug reports
offer the exact label `GitHub Copilot CLI`. `tests/contracts.sh` covers the
harness row, the discovery subsection, the README path, the permission default,
the forbidden headless form, and the dropdown **without exceeding 250 lines**, by
sharing loops and folding the existing per-harness verbatim subsection checks
into one helper rather than pasting a third block. The portable delivery protocol
still names no harness, and this repository's own phase pins are unchanged:
harness support is not deployment selection.

Amended 2026-08-31, after the first live Copilot dispatch, which implemented the
`AGENTS.md` edit described below. Every claim in the row above held against a
real worker. Orca documents no `copilot` launcher id, so Control composed
`copilot --allow-all --effort high` itself and ran it through an Orca terminal in
the worktree; the `--effort` flag was accepted and, with `--model` omitted, the
TUI reported `Auto`. `Confirm folder trust` appeared for a path already holding
the repository, with `--allow-all` on the argv and `1. Yes` preselected;
confirming it left `trustedFolders` empty, which is the point of preferring it
over the remembering option. The `Restore interrupted sessions` picker then
appeared and listed sessions belonging to four other directories, so Esc was
load-bearing rather than theoretical. The work prompt submitted on the first
Enter; no second Enter was needed. One difference from the other harnesses is
worth noting without being made into a rule from a single incident: this worker
reported its closure gates as a count rather than per-command output, so Control
reproduced them itself rather than accepting that account as the check.

`AGENTS.md` was deliberately outside this change for as long as it carried an
uncommitted managed-block edit at baseline, because Dely does not combine
ownership with a protected dirty path. Amended 2026-08-31: after both tasks were
accepted, the human released that path and asked for it in this delivery, so it
is now inside the change — commit `2abdb26`, the Copilot dispatch described
above, adds the seventh harness to its intro sentence and corrects the `review`
model cell. The ownership rule did not bend; the path stopped being protected.

#### Alternatives considered

- Add a `.copilot-plugin/plugin.json` sidecar for symmetry with Claude, Codex,
  and Cursor. Rejected: a live install, update, and uninstall cycle succeeded
  without it. A manifest whose absence changes nothing observable is decoration,
  and the packaging rule exists to prevent duplicate identity, not to require a
  file per vendor.
- `npx skills --agent copilot` as the install path. Rejected: Copilot has native
  plugin verbs, and the rule gives `npx skills` only to a harness that lacks
  them.
- Discover Copilot models by reading the `/model` picker in a session, or by
  calling the Copilot models endpoint. Rejected: setup's discovery is
  non-interactive by contract, and no local command lists models. Writing
  `default` is the honest result of live discovery finding nothing.
- Store a Copilot model list in this package. Rejected for the same reason as
  every other harness, and additionally because entitlement is per account —
  `claude-sonnet-4.5` was refused on the probing account while auto-routing
  chose `claude-haiku-4.5`.
- Treat the `Restore interrupted sessions` picker as a dispatch heartbeat and
  press Enter. Rejected: Enter there restores whatever session is preselected,
  including one from another folder.
- Answer trust with `2. Yes, and remember this folder for future sessions` to
  make later dispatches quieter. Rejected: a worker dispatch must not write
  persistent machine state that outlives it.
- Raise the `tests/contracts.sh` 250-line cap for the seventh harness. Rejected
  again, on the reasoning already recorded on 2026-08-27.
- Pin this repository's `implement` or `review` phase to Copilot to dogfood it.
  Rejected: harness support is not deployment selection.
- Include the `AGENTS.md` prose that enumerates supported harnesses. Rejected:
  that path is protected-dirty at baseline. Amended 2026-08-31: once both tasks
  were accepted, the human released that path and asked for it in this delivery,
  so a later commit adds `GitHub Copilot CLI` to the sentence and corrects the
  managed block's `review` model to `gpt-5.6-sol` — `gpt-5.6-sol-medium` is not
  a Kiro model id, and the effort belongs in the separate `--effort` flag. That
  is still not a phase pin change: the harnesses selected there are the human's.

#### Consequences

Copilot users get the same two skills through the manifests that already exist,
and the package gains a seventh harness without gaining a seventh file. Existing
Claude, Codex, Grok, Antigravity, Kiro, and Cursor surfaces are unchanged.
Copilot joins the copy-on-install family, so the cache-refresh boundary now
covers six plugin harnesses against Kiro's shared store, and `0.17.0` is what
makes those copies refresh.

Folding the per-harness verbatim subsection checks into one helper makes the
approved-policy strings data rather than pasted blocks. That is what buys room
under the 250-line cap; it also means a future harness costs roughly one line
there instead of three.

This does not improve model pinning on Copilot. The block can carry a slug, but
nothing in Dely can prove the account is entitled to it before the TUI reports a
substitution, and nothing here makes Copilot's model surface scriptable.

`AGENTS.md` named six harnesses while the README named seven, until the human
released that protected path late in the delivery. It now names seven, so this
repository's own instructions and its README agree, and the interim disagreement
this record originally predicted never reached `main`.

#### Non-goals

No `.copilot-plugin/` sidecar, root `plugin.json` growth, second skill tree,
`npx skills` path for Copilot, Copilot hooks, custom agents, MCP configuration,
`--add-dir` skill loading, autopilot or plan mode, ACP server use, remote or
cloud session control, headless `-p` dispatch, write to `~/.copilot`, Orca
change, phase-pin change, change to review depth, remediation routing, the
two-row managed block, or `skills/delivery/SKILL.md`.

#### Deferred

Add a `.copilot-plugin/` sidecar only if Copilot stops resolving this repository
from root `plugin.json` — the observable being `copilot plugin install dely@dely`
no longer reporting two installed skills. Document a Copilot model pin path only
when a non-interactive listing exists. Adopt an Orca `--agent copilot` launcher
if one appears; the first live dispatch, recorded above, used a hand-composed
argv because no such launcher id is documented, and that stays the route until
one is. Revisit the
250-line cap only if an eighth harness cannot fit after the helper refactor —
the trigger is a measured overrun, not a preference.

### 2026-08-29 — Workspace trust is a second gate; Control answers it in the TUI


**Superseded on 2026-09-04.** Measurement contradicted this record's central
instruction. On a path with no entry in Claude Code's exact-path trust store, a
launch carrying `--dangerously-skip-permissions` reached the composer with no
dialog shown and no trust entry created. The instruction to select
`Yes, I trust this folder`, the warning that a bare Enter quits the worker, the
Trust handling column this record defends, and its rejection of leaving that
column empty are all withdrawn: the column was deleted outright. What stands is
the observation that a modal can sit between launch and composer — but it is not
always a trust dialog, and it is now routed by the execution plane's typed
`agent_prompt_blocked` rather than by an enumerated per-harness answer. See
`2026-09-04 — Orca orchestration is the execution plane, and Dely stops
hand-rolling dispatch`.
#### Context

`skills/delivery/references/harnesses.md` already records a per-harness
permission default, which covers tool approval only. Four of the six
harnesses still prompt a workspace-trust dialog on first interactive launch
in a path that is not yet trusted: Claude Code, Codex CLI, Antigravity CLI,
and Cursor Agent CLI. Grok Build and Kiro CLI open at the composer with no
workspace-trust surface. Kiro still has a separate tool-trust step,
`/tools trust-all`, already in Launch notes.

Probes on 2026-08-29, each in a fresh `git init` directory with the argv the
table records, showed: Claude Code defaults to `No, exit`; Codex CLI to
`Yes, continue`; Antigravity CLI to `Yes, I trust this folder`; Cursor Agent
CLI to `[a] Trust this workspace` when launched with `--force` alone.
`cursor-agent --force --trust` opens at the composer. `--help` documents
`--trust  Trust the current workspace without prompting`. The other three
prompting harnesses persist trust in machine-global config
(`~/.claude.json`, `~/.codex/config.toml`,
`~/.gemini/antigravity-cli/settings.json`).

These probes bind to the CLI builds installed on one machine on 2026-08-29.
A harness that redesigns its dialog silently invalidates a cell, and no
check in this repository catches that.

#### Decision

The two gates stay distinct. Permission default remains tool approval.
Trust handling records the workspace-trust surface. Only Cursor has an
argv flag for it (`--trust`), so Launch notes carry `--force --trust`.
Dely's envelope does not authorise writing those machine-global config
files, so for Claude Code, Codex CLI, and Antigravity CLI, Control answers
the dialog in the TUI — the same shape as the existing Kiro
`/tools trust-all` step. Claude Code's dialog defaults to exit: a bare
Enter quits the worker, so Control selects `Yes, I trust this folder` and
confirms before sending the work prompt.

#### Alternatives considered

- Write the machine-global trust stores from the envelope. Rejected: the
  envelope does not authorise that write.
- Treat a bare Enter as "accept trust" on every harness. Rejected: Claude
  Code's default is `No, exit`.
- Leave the Trust handling column empty. Rejected: a dispatched worker TUI
  stalls on a dialog the record never mentions.

#### Consequences

Control must confirm workspace trust in the TUI for Claude Code, Codex CLI,
and Antigravity CLI, and must not send Enter on Claude Code until
`Yes, I trust this folder` is selected. Cursor workers launch with
`--trust`. The table pin in `tests/contracts.sh` tracks the cells
verbatim; it does not re-probe the live TUIs.

#### Non-goals

No write to `~/.claude.json`, `~/.codex/config.toml`, or
`~/.gemini/antigravity-cli/settings.json`. No change to permission
defaults, forbidden headless forms, or Kiro's `/tools trust-all` step
beyond recording that it is the tool-trust path, not a workspace-trust
dialog. No automated check that a harness still shows the recorded dialog.

### 2026-08-29 — Cursor keeps its sidecar, and its plugin surfaces are not what they appear

#### Context

A Spike after `0.16.0` probed Cursor Agent CLI 2026.08.25-3e8eec8 directly and
against Cursor's own documentation. Several beliefs this file records turned out
to rest on misread evidence.

`~/.claude/plugins/installed_plugins.json` holds `superpowers`, `codex`,
`ponytail` and `dely@0.14.1`, all user scope, while `~/.cursor/plugins/local/`
was empty. The four entries Cursor's `/plugin` → `Installed` list shows under
`User`, labelled `(Claude Code)`, are Claude Code's installed plugins surfaced by
Cursor, not Cursor installs. That is why `cursor-agent plugin marketplace remove
dely` left `dely` installed, and why those entries offer only `Try in chat` with
no `Uninstall`.

An earlier reading — that Cursor had indexed and installed this repository before
`.cursor-plugin/plugin.json` existed, so the sidecar was redundant — was that
same surfaced Claude Code install, at the very version, `0.14.1`, that predates
the Cursor work. That test never happened.

The test has now happened. Pinning the marketplace to tag `v0.14.1`, whose commit
`54623e1` carries no `.cursor-plugin/`, indexed `1 plugin` and its marketplace
detail resolved `Skills: 2 (delivery, setup)`. So the sidecar is not required by
this build.

**Which manifest it used is not established.** The probe observed an outcome, not
a mechanism, and `54623e1` ships three candidates: a root `plugin.json` of
`{name, description}`, the `.claude-plugin/` pair, and `.codex-plugin/plugin.json`.
Cursor's documentation says Agent Plugins "require a root `plugin.json` with the
standard's schema identifier", and this repository's root manifest deliberately
carries no `$schema` — the 2026-08-27 record settled that adding one would break
the Antigravity lock — so the root file probably does not qualify as an Agent
Plugin. That narrows the field; it does not identify the winner. Any sentence
naming the mechanism would repeat the misreading this section exists to correct.
Cursor's documentation names `.cursor-plugin/plugin.json`, required field `name`,
as the Cursor Plugin format.

Installing from the marketplace produced the first Cursor-managed copy:
`~/.cursor/plugins/cache/dely/dely/<merge SHA>`, a full clone pinned to the
commit. It is labelled by marketplace name, `dely (dely)`, and its detail view
does offer `Uninstall`.

Cursor's CLI changelog dates the shell marketplace commands to 2026-07-13 and
defines `remove` as deleting a user-scoped marketplace. Cursor staff, forum,
2026-07: "There isn't a separate non-interactive command like `cursor-agent
plugin install <plugin-id>` yet."

#### Decision

`.cursor-plugin/plugin.json` stays. It is the documented Cursor Plugin format.
The fallback observed on 2026.08.25 is undocumented behaviour and is recorded as
a datum, not relied on. Removing the sidecar would be a deliberate decision
against the documentation, not an inference from "it worked without it".

These surfaces are recorded so no later reading mistakes them again. The install
and uninstall behaviour is settled in the 2026-08-28 README record; the Context
above cites two of its facts as evidence, and this paragraph adds only what that
record does not say — the `(Claude Code)` entries are a read-only view of another
harness's store, which is why they resist `plugin marketplace remove` and offer
no `Uninstall`. `plugin marketplace add` on a URL
whose manifest carries an existing marketplace name overwrites that marketplace
rather than adding a second.

#### Alternatives considered

- Delete the sidecar as redundant. Rejected: the redundancy evidence was the
  misread described above, and the documented format is the sidecar.
- Say nothing and leave the earlier reading in place. Rejected: it had already
  produced one wrong conclusion and a deferred trigger keyed on a meaningless
  number.

#### Consequences

The 2026-08-27 deferred trigger for `.cursor-plugin/marketplace.json` is amended
in place: it was keyed on a reindex reporting 0 plugins, and `update` reports `0
plugins indexed` on the same URL where `add` reports `1 plugin` seconds later.
That count does not mean what the trigger assumed, so the trigger is replaced.

This repository ships a format the documentation names and this build does not
appear to require. That is a deliberate margin, not a dependency: if Cursor ever
begins enforcing the Cursor Plugin format, the sidecar is already there; if it
never does, the file costs one manifest.

#### Non-goals

No change to any manifest, to `README.md`, or to what `setup` writes. No Cursor
hooks, rules, MCP, or Marketplace submission. No attempt to make the Claude Code
store manageable from Cursor.

#### Deferred

Whether a Cursor-managed install classifies differently from a surfaced Claude
Code one in any way that matters beyond the label and the `Uninstall` action —
trigger: a behaviour difference actually bites. Refreshing the Cursor-managed
install past the commit it is pinned to — trigger: a human wants the newer
version in Cursor.

### 2026-08-28 — README's Cursor uninstall step names the marketplace, not the plugin

#### Context

`README.md`'s `### Cursor Agent CLI` fenced block labelled
`cursor-agent plugin marketplace remove dely` as `# uninstall`. It does not
uninstall. Verified twice on cursor-agent 2026.08.25-3e8eec8: after running
it, a new Cursor session still listed `dely` in `/plugin` → `Installed` with
both skills present. Cursor's own CLI changelog (2026-07-13) defines
`plugin marketplace remove` as deleting a user-scoped marketplace; installed
plugins are unaffected. Every other harness section in the README pairs
`# uninstall` with a command that actually uninstalls.

Uninstalling is interactive: `/plugin` → `Installed` → select `dely` →
`Uninstall`, observed present on a Cursor-managed install. That action
appears only for plugins Cursor manages; Cursor also lists Claude Code's own
installed plugins in the same panel, labelled `(Claude Code)`, offering only
`Try in chat`. Cursor staff, forum, 2026-07: "There isn't a separate
non-interactive command like `cursor-agent plugin install <plugin-id>` yet."
There is no non-interactive install or uninstall command from `cursor-agent`
itself (Claude Code has one, `claude plugin uninstall dely`, documented in
this repository's own `README.md`).

#### Decision

The fenced block's comment now says what `plugin marketplace remove` does —
removes the marketplace, not the plugin. The prose tells the reader that
uninstalling `dely` itself happens in `/plugin` → `Installed` → `Uninstall`,
that no non-interactive command exists for it, and that the `Uninstall`
action is absent for a `dely` installed through Claude Code.
`tests/contracts.sh` extracts the fenced block on its own and requires all
four `plugin marketplace` commands plus the new comment inside it, and
separately forbids `# uninstall` from appearing anywhere in the Cursor
section, so a half-edit that fixes the prose but leaves the fenced block's
`# uninstall` — or that re-adds `# uninstall` beside the fence's `remove`
line while keeping the new comment elsewhere in the block — still fails
contracts.

#### Alternatives considered

- Say uninstalling is impossible. Rejected: it is possible, just interactive.
- Drop the `remove` command from the fenced block. Rejected: it is still a
  real, useful command — it just isn't uninstall.

#### Consequences

The Cursor section stops promising a working `# uninstall` command that
silently no-ops. Readers who copy the fenced block get an accurate comment;
readers who want to actually uninstall are pointed at `/plugin` →
`Installed`.

#### Non-goals

No change to the four `plugin marketplace` commands, to `/plugin`, `/dely`,
`/delivery`, `/setup`, or to any other harness section.

#### Deferred

Document a non-interactive Cursor uninstall command if and when Cursor ships
one.

### 2026-08-28 — Harness launch mechanics ship inside the delivery skill

#### Context

`AGENTS.md:53-67` carries operational knowledge about six external CLIs: the
permission default for each, the headless invocation forms forbidden for each,
Kiro's two-step `/tools trust-all` launch, and Cursor's launch notes. It sits
under `AGENTS.md:52`, "The table is this repository's deployment selection, not
the portable protocol" — true of the pin table above it, false of the fifteen
lines below it. Changing a pin changes nothing there; those lines describe how
six tools behave, not what this repository chose.

None of it reaches another project. The managed block `setup` writes, templated
at `skills/setup/SKILL.md:40-52`, is one invocation sentence and a four-row pin
table. A project installing Dely gets the portable protocol and its own pins,
and nothing about launching any harness. A Kiro worker dispatched from another
project launches without `/tools trust-all`, because the only place that
instruction exists is a file that does not ship.

`skills/delivery/SKILL.md:134-136` states the skill "has no compatibility matrix
around one". The matrix exists; it was parked where that sentence could stay
literally true.

Probes on 2026-08-28 made the cost concrete. A blocking confirmation is
invisible to the execution plane: with Claude Code's workspace-trust dialog on
screen, `orca terminal wait --for tui-idle` returned `satisfied: true` and
`agentWait` was `null`. Following the documented dispatch procedure against that
state typed the work prompt into the dialog, and Enter selected its highlighted
row, `No, exit`; the worker exited and the prompt was never delivered. Workspace
trust is per-harness and per-path: after Claude Code recorded
`hasTrustDialogAccepted` for a directory, Antigravity CLI and Cursor Agent CLI
both still prompted for that same directory, while Codex, Grok and Kiro did not
prompt at all. The defaults disagree — Claude Code highlights `No, exit`,
Antigravity `Yes, I trust this folder`, Cursor `[a] Trust this workspace` — so no
single keystroke is safe.

That is the third item of its kind. Kiro's two-step has been stranded since
2026-08-26 and Cursor's launch notes since 2026-08-27. Recording trust handling
in `AGENTS.md` would strand a third.

Portability is constrained by how each harness installs. `.cursor-plugin/plugin.json`
points at `./skills/`, and the Kiro path installs with
`npx skills add … --skill delivery --skill setup`, which selects skill
directories. A file outside `skills/` reaches neither. A directory inside a skill
reaches all of them: `skills/delivery/templates/` is present in
`~/.agents/skills/delivery/`, `~/.grok/installed-plugins/dely-*/skills/delivery/`,
`~/.gemini/config/plugins/dely/skills/delivery/`, and the Claude plugin cache.

#### Decision

Per-harness launch mechanics live in `skills/delivery/references/harnesses.md`
and ship inside the delivery skill. The file is a table keyed by harness:
permission default, forbidden headless forms, launch notes, and trust handling.
The trust column is present and empty; filling it is a later delivery, and a
column added later would be a schema change instead of a row edit.

**Superseded in part on 2026-09-04.** The trust column was filled, then removed
together with the rest of the trust catalogue, and an Orca agent id column was
added. The reasoning above stands as the reason the file exists and ships inside
the skill; only its column list is out of date. See
`2026-09-04 — Orca orchestration is the execution plane, and Dely stops
hand-rolling dispatch`.

`skills/delivery/SKILL.md` names that path where it instructs Control to compose
a worker launch. The protocol body still names no harness: the matrix is a
reference the skill owns rather than prose the skill contains.
`SKILL.md:134-136` is rewritten to say where the matrix lives instead of denying
one exists. The denial is not left standing, because a shipped artifact that
contradicts its own contents is the defect corrected in `README.md` earlier the
same day.

`AGENTS.md` keeps what the protocol delegates to it — gate commands, artifact
paths, default branch, the managed pin block — plus this repository's own rules:
self-update ordering, the absence of a phase-implied sandbox, and native Internet
access. It loses lines 53-67 and gains a pointer.

`AGENTS.md` also loses three restatements that the shipped package already
carries and that arrive no earlier than it: review independence, the
no-headless-fallback rule, and the design/release dispatch rule. All three are
read only during a delivery, by which time the skill is loaded.

The three are not carried the same way, and the distinction is recorded because
an earlier draft of this record got it wrong. Review independence and the
no-headless-fallback rule are duplicated in `skills/delivery/SKILL.md`. The
design/release sentence is a compound: its release half is duplicated at
`SKILL.md:282`, but its design half — that design runs in the current
interactive session and is not dispatched — has no counterpart in
`skills/delivery/SKILL.md` at all. It is carried by `skills/setup/SKILL.md:19-21`,
"There is no control row, because the current interactive session already exists
and is never dispatched", which ships in the same package. So the rule is
entailed by the package rather than duplicated inside one skill, and removing it
from `AGENTS.md` loses nothing. Saying it "duplicates the protocol" without that
qualification was false, and a task 2 review blocked on it.

Restatements that do arrive earlier stay: the default branch and the sentence
selecting which shape invokes the skill are needed before any skill is invoked,
because `CLAUDE.md` is one line, `@AGENTS.md`, loaded every session, while
`SKILL.md` loads on invocation.

`tests/contracts.sh` retargets its permission-flag grep and its verbatim dispatch
pin from `AGENTS.md` to the reference, and adds a negative check that `AGENTS.md`
no longer carries the per-harness flags.

The reference states each harness fact once. An earlier form of this decision
required both a table and a retargeted verbatim pin on the original prose
paragraph, which forced the same facts into the file twice: a pinned paragraph
and an unpinned table. A task 1 review demonstrated that shape is not merely
redundant but unprotected — falsifying a table row to claim `--yolo` as Cursor's
permission default, contradicting the paragraph four lines above it, passed every
gate with `rc 0`, because the table was checked only for the presence of literal
flag strings that the paragraph already supplied. That is the drift class this
record's Context names as the problem being solved, reintroduced inside the file
built to end it. The verbatim pin therefore targets the table rows, and the prose
paragraph is deleted rather than carried alongside them. The protection an
earlier decision placed on that sentence survives; only its carrier changes.

This amends the 2026-08-27 "Composed TUI argv carries the execution plane's
permission default" decision, whose closing paragraph placed the per-harness
permission defaults in this repository's `AGENTS.md`. The rule it settled is
unchanged; only the file that carries the defaults moves. That record is amended
in place rather than rewritten.

#### Alternatives considered

- A third skill, `dely:harness`. Rejected: the Kiro install line names skills
  explicitly, so every existing user's documented install command would change,
  and the skill would surface as a slash command in every palette for no
  user-facing purpose.
- A data file at the package root, `harnesses.json`. Rejected on the portability
  constraint: it reaches neither the Cursor sidecar's `./skills/` tree nor a
  `--skill`-selected Kiro install.
- `setup` generates the mechanics into each project's `AGENTS.md`. Not rejected
  on merit — it is the only option putting the mechanics in context before the
  skill is invoked. Deferred: it ends the managed block's minimality, the
  generated text must vary with the pins chosen, and each project keeps a copy
  that goes stale when the plugin updates.
- Leave it in `AGENTS.md`. Rejected: that is the status quo that stranded Kiro's
  two-step and Cursor's launch notes, and would strand trust handling next.

#### Consequences

The shipped protocol changes, so the package version advances to `0.16.0`. Under
`AGENTS.md`'s self-update rule the change takes effect for the delivery after the
one shipping it.

`tests/contracts.sh` is at 247 lines against a hard `≤ 250` gate. Retargeting is
roughly neutral; the added negative check is not. If the work cannot fit, the
outcome is `NEEDS_REPLAN`, not a raised cap — raising a gate to fit a plan is the
failure the gate exists to catch.

A project already running Dely receives the reference only after it updates the
plugin. Until then its behaviour is unchanged, not worse.

The reference becomes a maintenance surface: when a harness changes its CLI, that
shows up there, versioned with the package rather than with any one project.

#### Non-goals

No trust-handling content in the reference; that is the next delivery and the
first real exercise of the new home. No change to the pin table, to how `setup`
discovers models and effort, or to what `setup` writes. No new ability for the
execution plane to distinguish a blocking confirmation from an idle prompt; that
limitation is recorded, not fixed.

#### Deferred

`setup` generating harness mechanics into a project's `AGENTS.md` — trigger: a
project needs them in context before the delivery skill is invoked. Trust
handling rows in the reference — trigger: this decision lands. Asking Orca to
expose a "blocked on confirmation" terminal state — trigger: a second observed
worker loss, or an Orca release offering such a state. The count stands at
one: the loss this record's own Context describes, not a further one. A second,
distinct legibility gap was observed on 2026-08-28 and gets its own trigger:
`orca terminal read` renders a harness's ghost-text suggestion in the same place
as a pending prompt, so reading the input box does not establish that anything is
waiting to be submitted — trigger: a dispatch that sends Enter on the strength of
that reading and loses or misdirects a worker. The stale line count in
this file's 2026-08-25 record, the `/add-plugin superpowers` reference, and the
`/dely` palette filter's undefended coupling to the word "Dely" in
`skills/setup/SKILL.md`'s description — no trigger; recorded and unowned.

### 2026-08-27 — Cursor Agent CLI is a first-class sixth harness

#### Context

Dely ships as an installable package for Claude Code, Codex CLI, Grok Build,
Antigravity CLI, and Kiro CLI. Those five adapters share one `skills/` tree.
Claude and Codex use nested sidecars (`.claude-plugin/`, `.codex-plugin/`).
Antigravity and Grok validate root `plugin.json` (`name` and `description`
only; Antigravity 1.1.19 is `additionalProperties: false`). Kiro has no
plugin sidecar that can share that tree, so it installs with `npx skills`.

Live Cursor Agent CLI 2026.08.25-3e8eec8 is an interactive TUI by default,
lists models through `cursor-agent models`, accepts `--model`, has no
`--effort` flag, and reads `AGENTS.md` natively. Its plugin CLI exposes
`plugin marketplace add|list|remove|update` and no `plugin install`. This
machine already had a user marketplace named `dely` pointing at this git
URL; `cursor-agent plugin marketplace update dely` indexed **0 plugins**.
Root `plugin.json` is not an Agent Plugin (`$schema` is required; adding it
would break the Antigravity lock). Cursor identifies format by path:
`.cursor-plugin/plugin.json` is a Cursor Plugin.

Superpowers installs on Cursor via `.cursor-plugin/plugin.json` with
`"skills": "./skills/"` and `/add-plugin superpowers`, not `npx skills`.

`tests/contracts.sh` is 249 lines with a hard `≤ 250` gate. A sixth
harness pasted as a second Kiro-sized block would blow that gate.

#### Decision

Cursor Agent CLI is a first-class harness, equal in kind to Claude Code,
Codex CLI, Grok Build, Antigravity CLI, and Kiro CLI.

Canonical skills stay in `skills/`. A plugin-capable harness gets a thin
nested sidecar that points at `./skills/` and does not copy the tree and
does not edit root `plugin.json`. A harness that owns the root manifest
(Antigravity; Grok also validates it) does not grow that file for another
vendor. `npx skills` remains the fallback only when a harness has no such
sidecar (Kiro). A harness with a native plugin path does not also get an
`npx skills` README section.

Cursor packaging is `.cursor-plugin/plugin.json` with `name` `dely`, the
same one-line description as the other manifests, and `"skills": "./skills/"`.
It carries no `version` (version stays the Claude and Codex pair), no hooks,
and no second skill tree. `.cursor-plugin/marketplace.json` is not added
unless a live reindex of this git marketplace still reports 0 plugins after
`plugin.json` exists. Amended 2026-08-29: that condition is unusable, because
`plugin marketplace update` reports `0 plugins indexed` where `add` reports
`1 plugin` on the same URL seconds later. The count is not a plugin count. The
file is added only if the marketplace detail view stops resolving this
repository's skills — it showed `Skills: 2 (delivery, setup)` on 2026-08-29.

Install is native Cursor: `cursor-agent plugin marketplace add` of the git
URL, then in a Cursor Agent session type `/plugin`, go to the `Marketplace`
tab, search `dely`, and choose `Install for you (user scope)`. Type `/dely`
to filter the palette to Dely's own `/delivery` and `/setup` before invoking
them. Do not document `npx skills --agent cursor`, PATH `agent`,
`cursor` (the IDE wrapper), or copying into `.cursor/skills/`.

Setup discovers models from `cursor-agent models` (offer the slug before
` - `). There is no `--effort` flag: write the literal `default` for Effort.
Do not invent an effort vocabulary, do not strip effort suffixes from slugs,
and do not synthesize parameterized `[effort=…]` forms. Omit unusable
discovery. Setup does not write `~/.cursor`. Cursor is a native `AGENTS.md`
reader; the CLI also applies `CLAUDE.md` as a rule, so that file is not
called inert on Cursor. The `CLAUDE.md` write offer stays Claude-Code-only.

Workers launch as an interactive `cursor-agent` TUI. Never PATH `agent`
(it collides with Grok). Never `-p`/`--print`. Never `-w`/`--worktree`.
Prefer Orca `--agent` when it can pin the block's model; otherwise
hand-compose `cursor-agent --model <slug>` (omit `--model` when the cell
is `default`) and carry `--force`. Do not put `--trust` or an unpinned
`--sandbox` on that argv. Do not copy Kiro's two-step unless `--force` on
argv is observed to be fatal.

The two versioned manifests advance together to `0.15.0`; root `plugin.json`
stays unchanged. Human bug reports offer the exact label `Cursor Agent CLI`.
`tests/contracts.sh` covers the new sidecar, discovery, README path, dispatch
sentence, permission default, and dropdown without exceeding 250 lines, by
sharing loops with the Kiro checks rather than pasting a second block. The
portable delivery protocol still names no harness. This repository's phase
pins are not a Cursor-support change.

#### Alternatives considered

- `npx skills --agent cursor --global` as the Cursor path. Rejected:
  Cursor has the sidecar family Dely already uses for Claude and Codex,
  and this git marketplace already indexed 0 plugins for lack of
  `.cursor-plugin/`.
- Native plugin and `npx skills`. Rejected: two install truths.
- Agent Plugins 1.0 at repo root (`$schema` on `plugin.json`). Rejected:
  conflicts with the checked Antigravity schema; Grok validates that
  file; Cursor might then see a second identity.
- Duplicate `skills/` under `.cursor/`. Rejected: that is the drift the
  packaging rule exists to prevent.
- PATH `agent` as the documented binary. Rejected: it collides with Grok.
- Raise the `tests/contracts.sh` 250-line cap. Rejected: that is how a
  sixth harness would make a seventh impossible.
- Change this repository's phase pins to Cursor. Rejected: harness
  support is not deployment selection.

#### Consequences

Cursor users get the same skills through a sidecar, not a sixth tree.
Existing Claude, Codex, Grok, Antigravity, and Kiro command surfaces are
unchanged. Plugin caches still copy the package at install time; Cursor
joins that copy-on-install family, not Kiro's shared symlink store.

Live `/plugin` → `Marketplace` tab install and official Marketplace search
remain consumer-profile checks: this repository does not mutate live harness
configuration during compatibility validation. Interactive plugin install is
the current Cursor CLI limit; there is no `plugin install` verb.

#### Non-goals

No Cursor hooks, rules, agents, commands, MCP, Cloud Agent, ACP, headless
`--print` dispatch, PATH `agent` launcher, `--worktree` worker checkout,
Orca change, write to `~/.cursor`, `npx skills` for Cursor, official
Marketplace submission, root `plugin.json` growth, change to review depth,
remediation, the two-row managed block, or `skills/delivery/SKILL.md`.

#### Deferred

Add `.cursor-plugin/marketplace.json` only if Cursor fails to resolve this
repository's plugin — the observable being the marketplace detail view showing
`Skills: 2 (delivery, setup)`, as it did on 2026-08-29. See that date's
amendment, which retires the reindex-count form of this trigger. Submit Dely
to the official Cursor Marketplace when a human wants Customize search
without a git URL. Prove Orca `--agent` plus `--model` on the first Cursor
dispatch; escalate if it cannot pin. Adopt a Kiro-style two-step only after
`--force` on argv is observed to be fatal. Offer parameterized `[effort=…]`
model forms in setup only if slugs that already encode effort are not
enough. The next harness follows this packaging rule rather than reopening
it.

### 2026-08-27 — Composed TUI argv carries the execution plane's permission default

#### Context

Commit `538bf9d` required Control, when composing a TUI launch argv itself, to
keep the execution plane's default permission-bypass flags for that harness
and add no unpinned sandbox. Twelve hours later, `1945bb8` rewrote that
sentence to stay harness-agnostic after a Kiro live-probe review. The rewrite
said to keep the launch command as-is and not add permission-bypass flags the
command did not already carry. That inverts the rule: Orca applies permission
defaults only on its `--agent` launcher path, and a hand-composed
`orca terminal create --command` gets none of them. Grok, Antigravity CLI, and
Kiro CLI cannot use launch-time model selection on `--agent`, so every
dispatch of those harnesses is composed by hand and hits the defect. The
released `v0.14.0` tag (`5c12c26`) carries the inversion, and a lexical
contract check required the inverted wording.

#### Decision

The portable delivery rule is restored without naming a harness. Composing
the TUI launch argv is not a request for a different permission posture than
the one the execution plane is already configured to apply for that agent;
that configured default is carried onto the composed argv. The rule still
forbids adding a sandbox the project did not pin. Kiro CLI's existing
exception stands: `--trust-all-tools` does not go on the argv.

This repository's `AGENTS.md` prefers Orca's `--agent` launcher whenever it
can pin the block's model and effort. Amended 2026-08-28: the per-harness
permission defaults used when argv is composed by hand moved out of `AGENTS.md`
into `skills/delivery/references/harnesses.md`, so they ship with the plugin.
The rule settled here is unchanged; only its carrier moved.

#### Alternatives considered

- Keep the inverted as-is wording because it is harness-agnostic. Rejected:
  agnostic wording that drops the configured default is the defect.
- Name harness-specific bypass flags in the portable skill. Rejected: that is
  what `1945bb8` set out to undo, and Kiro's default is not a bypass flag on
  argv.
- Rely on Orca's `--agent` path only. Rejected: three harnesses cannot pin
  model and effort that way, and `AGENTS.md` requires both on every dispatch.

#### Consequences

Hand-composed launches match the host's configured agent-tab permission
posture. The contract check now rejects the `v0.14.0` skill text. Live TUI
permission posture has no automated instrument; Control confirms it by
launching the composed argv and reading the TUI.

### 2026-08-26 — Kiro CLI is a first-class fifth harness

#### Context

Dely shipped as an installable package for Claude Code, Codex CLI, Grok Build,
and Antigravity CLI. `dely:setup` discovered models and effort from those four
CLIs, but it could not offer Kiro CLI. Live Kiro CLI 2.16.2 exposes an
interactive TUI, lists models as JSON through `kiro-cli chat --list-models
--format json`, accepts `--model` and `--effort`, and reads `AGENTS.md`
natively. Its default agent discovers skills from `.kiro/skills/` and
`~/.kiro/skills/`. The open `npx skills` installer supports Kiro CLI at those
paths, and Orca 1.4.188 ships a Kiro launcher.

The repository's root `plugin.json` is deliberately limited to `name` and
`description` for Antigravity CLI 1.1.19. A Kiro Power using Agent Plugins 1.0
would require additional root manifest fields, so one root manifest cannot
safely serve both checked command surfaces.

#### Decision

Kiro CLI is a first-class harness, equal in kind to Claude Code, Codex CLI,
Grok Build, and Antigravity CLI.

Kiro installs the existing `delivery` and `setup` skills with `npx skills`,
targeting the `kiro-cli` agent at global scope. The native Kiro commands are
`/delivery` and `/setup`; Dely does not add a Kiro-specific package or duplicate
the skill tree. Install, verification, update, and removal use the installer's
documented command surface.

Setup discovers Kiro models from `kiro-cli chat --list-models --format json`
and offers each `model_id`. It reads effort choices from `kiro-cli chat --help`
rather than prompting a model or storing a catalogue. An unavailable Kiro CLI
or an unusable discovery result is omitted, not guessed. Setup does not write
`~/.kiro` or create or modify custom agents. Kiro receives the managed Dely
block through its native `AGENTS.md` support.

Orca launches Kiro as a real interactive TUI, `kiro-cli chat --tui`, without
`--trust-all-tools` on that argv: putting it there opens a confirmation whose
default is "No, exit", and Orca's Enter kills the session. Once the TUI is
idle at its prompt, Control sends `/tools trust-all`, observed to trust tools
for the session with no confirmation dialog, then the work prompt. A headless
`kiro-cli chat --no-interactive` process in a shell tab is not a Dely worker. The portable delivery protocol
still names no harness and does not change. The two versioned manifests advance
together to `0.14.0`; root `plugin.json` stays unchanged. Human bug reports
offer all five supported harnesses.

#### Alternatives considered

- Package Dely as a Kiro Power at the repository root. Rejected because the
  required Agent Plugins manifest fields conflict with the checked strict
  Antigravity manifest.
- Add a nested Kiro Power with a second copy of `skills/`. Rejected because it
  creates two sources of truth for the delivery contract and templates.
- Tell Kiro users to copy or symlink the skills manually. Rejected because
  install, update, and removal would no longer be one verifiable public path.
- Create a custom Kiro agent for Dely. Rejected because Dely is a workflow skill,
  not a replacement agent, and setup does not mutate harness configuration.

#### Consequences

Kiro users get the same delivery and setup behaviour without a fifth package
format. The install command depends on the external `npx skills` command and
uses global scope, so running it intentionally mutates the user's Kiro skill
directory; Dely itself never performs that mutation. Kiro custom agents can
change default resource inheritance, so users of such agents remain responsible
for including the standard Kiro skill resources.

Live discovery may offer only `auto`, as observed on Kiro CLI 2.16.2. That is a
valid live result, not a reason to invent model names. This repository's own
phase pins remain Claude Code for implementation and Codex CLI for review.

#### Non-goals

No Kiro Power, `.kiro/` package, custom agent, hook, MCP server, steering file,
or write to `~/.kiro`. No Kiro IDE, Web, Mobile, Crew, ACP, or headless dispatch.
No Orca change. No change to review depth, remediation, the two-row managed
block, root `plugin.json`, or `skills/delivery/SKILL.md`.

#### Deferred

Adopt a Kiro Power only when one package manifest can satisfy every supported
harness without duplicating the skill tree. Configure custom-agent resources
only when a consumer explicitly needs an agent that disables default skill
inheritance. End-to-end global installation and live skill activation remain a
consumer-profile check because this repository does not mutate live harness
configuration during compatibility validation.

### 2026-08-26 — Antigravity CLI is a first-class fourth harness

#### Context

Dely shipped as an installable plugin for Claude Code, Codex CLI, and Grok Build.
`dely:setup` discovered models and effort from those three CLIs. The repository had
no root `plugin.json`. `agy plugin validate` of the checkout failed with
`missing plugin.json`. `agy plugin validate .claude-plugin` returned `[ok]` with
`skills : skipped (not found)`: a present, passing, empty plugin. Orca already
detects and launches `agy` as a TUI agent. Antigravity CLI reads `AGENTS.md`
natively. Its published plugin schema allows only `name` and `description`.
Live `agy` 1.1.19 lists models as TSV (`agy models`) and takes `--effort
low|medium|high`. Some model slugs already end in `-high`, `-medium`, or `-low`.

#### Decision

Antigravity CLI is a first-class harness, equal in kind to Claude Code, Codex CLI,
and Grok Build.

The repository root is the `agy` package: a root `plugin.json` with `name` `dely`
and the existing `skills/` tree. Version remains only in the Claude and Codex
manifests, bumped together. Install is `agy plugin install` of the git URL or a
local path. Setup discovers models with `agy models` (offer the slug column) and
effort from CLI help (`low|medium|high`), the same live-surface rule as the other
harnesses. An uninstalled `agy` is omitted, not an error. Model and Effort cells
are written as chosen; setup does not strip effort suffixes from slugs. Setup
does not write `~/.gemini` and does not offer `GEMINI.md`. This repository's
managed Dely table stays Claude Code for `implement` and Codex CLI for `review`.
`skills/delivery/SKILL.md` still does not name harnesses. It may carry two
portable launch rules only: write the worker prompt to an untracked file inside
the worktree, do not stage it, and delete that same file after the worker
returns; when composing TUI argv, keep the execution plane's default
permission-bypass flags and add no unpinned sandbox. Install documentation
does not restate those rules. Refresh of an `agy` install is a second
`agy plugin install` of the same source; the CLI has no `plugin update`.

#### Alternatives considered

- A nested `.agy/` or `.antigravity-plugin/` bundle. Rejected because `agy plugin
  validate` and `agy plugin install` target the given directory's `plugin.json`
  and sibling `skills/`; a nested layout needs a different install path or
  duplicated skills.
- Documenting `agy plugin import claude` as the supported path. Rejected because
  import is a migration of an already-installed Claude copy, not first-class
  install of this repository, and Customize cannot offer `agy` until setup
  discovers it.
- Storing an Antigravity model catalogue in setup. Rejected by the existing
  discovery contract.
- Adding `version` to root `plugin.json`. Rejected because the published schema
  is `additionalProperties: false` with only `name` and `description`.
- Changing this repository's phase pins to Antigravity CLI. Rejected as out of
  scope: harness support is not a deployment-selection change.
- Revert the launch-rule commit and leave dispatch undocumented. Rejected after
  review: the portable rule belongs in `delivery`, not in this repository's
  install docs or phase-table notes.
- Invent `agy plugin update`. Rejected: the live CLI has no such subcommand.

#### Consequences

Consumers can install and pin Dely on `agy` the same way they do on the other
three harnesses. Plugin caches still copy the package at install time. A future
strict validator may reject unknown root-manifest fields, which is why that file
stays within the published properties. Live docs and live install paths for
staged plugins have disagreed (`~/.gemini/antigravity-cli/plugins/` versus
`~/.gemini/config/plugins/`); Dely documents the command, not a cache path.

#### Non-goals

No Antigravity 2.0 desktop or IDE packaging. No Orca change. No hooks, agents,
MCP, `.agents/skills/`, or `GEMINI.md`. No headless `agy -p` dispatch. No
`plugin@marketplace` beyond git-URL or local-path install. No change to review
depth, remediation, or the two-row managed block.

#### Deferred

Orca's ability to pass `--model` and `--effort` into a live `agy` TUI is an
execution-time capability, not a repository instrument. Prove or escalate it
when a delivery first dispatches `agy`. Interactive skill activation inside an
`agy` session is the same class of observation. A native Antigravity marketplace
selector is deferred until a consumer needs `plugin@marketplace` rather than a
git URL.

### 2026-08-25 — Dely ships a verifiable community-ready open-source surface

#### Context

Dely was publicly readable and its manifests and README named the MIT license,
but the repository did not contain the license grant itself. GitHub therefore
reported no detected license. The repository's community profile was 28%: it
found the README but no contribution guide, code of conduct, issue template,
pull-request template, or license file.

The three documented plugin-install commands matched the installed Claude Code,
Codex CLI, and Grok Build command surfaces, and both available plugin validators
accepted the package. That proved package shape, not self-service onboarding.
Orca was mandatory with no fallback, yet the README did not tell a new user how
to obtain or preflight it, verify an installation, update or uninstall Dely, or
recover from common failures.

Repository contracts passed locally, but no CI workflow ran them for pull
requests. The default branch had neither protection nor a ruleset, private
vulnerability reporting was disabled, and every merged pull request so far came
from the maintainer. `AGENTS.md` was precise guidance for coding agents, not a
substitute for a human contribution path.

#### Decision

This decision amends the earlier lean-package decision only where that decision
limited the shipped surface and fixed the package version. Its thin-protocol,
state-ownership, testing, and maintenance-log decisions remain in force.

Dely's next public package version is `0.13.0` in both versioned manifests. The
repository carries the canonical MIT license text with copyright `2026 Hieu
Phung`; a manifest label or a one-word README declaration is not the license
artifact.

The README owns the complete user path: supported prerequisites and environment,
Orca installation and preflight, installation in each supported harness, one
ordinary-use quickstart, post-install verification, update and uninstall
commands, troubleshooting, and the versions against which those commands were
checked. Guidance distinguishes tracking the default branch from an immutable
release where the harness supports a ref.

The repository carries the smallest GitHub-recognized community surface:

- `CONTRIBUTING.md` explains issue-first public-contract work,
  fork/branch/pull-request flow, English artifacts, repository gates, decision
  ownership, version reconciliation, and review expectations. External
  contributors do not need Dely or Orca; maintainers own this repository's
  delivery protocol.
- `CODE_OF_CONDUCT.md` adopts Contributor Covenant 2.1 and names
  `contact@hieuphung97.com` for enforcement reports.
- `SECURITY.md` supports the latest release, directs vulnerabilities to GitHub
  private vulnerability reporting, names the same email as a fallback, and
  forbids public vulnerability issues.
- Structured bug and feature issue forms request reproducible, decision-useful
  evidence. One pull-request template asks for scope, verification, contract and
  documentation impact, without copying Dely's internal handoff format.

One GitHub Actions workflow runs the repository closure gates on pull requests
and the default branch. Its unique required job is `contracts`. The structural
contract test checks the community artifacts and the CI entry point with one
fixture that demonstrates an incorrect entry point is rejected; it does not grow
back into an English prose interpreter.

After the workflow has reported `contracts` successfully, the repository enables
an active default-branch ruleset that requires a pull request, the `contracts`
status check, and resolved conversations, and rejects deletion and
non-fast-forward updates. It requires zero approving reviews so a solo
maintainer is not locked out of their own pull request. Private vulnerability
reporting is enabled at the same release boundary. Both settings are verified
through GitHub's API because Git cannot own forge configuration.

#### Alternatives considered

- Put all community guidance in the README. Rejected because GitHub would not
  surface contribution, conduct, security, issue, and pull-request guidance at
  the interactions where contributors need it, and a README license label still
  would not ship the canonical grant.
- Add a complete governance, ownership, support, funding, roadmap, and changelog
  suite. Rejected because one maintainer and GitHub Releases do not yet justify
  those extra state owners.
- Require one approving review immediately. Rejected because the sole maintainer
  cannot approve their own pull request; CI plus an explicit pull-request path is
  the enforceable boundary until another maintainer exists.
- Leave repository checks local. Rejected because external contributors need the
  same deterministic result without reproducing maintainer machine state.

#### Consequences

The installed plugin copy becomes slightly larger because license and community
files travel with the repository. That cost is accepted: the files define the
rights and collaboration contract of the package being copied.

A new user gets one route from prerequisites to ordinary use, while an external
contributor can submit a normal pull request without owning the Dely/Orca control
plane. Pull requests receive the same structural check before merge. The solo
maintainer retains the ability to merge an accepted, green pull request without a
fictional second approver.

Rulesets and private vulnerability reporting remain forge state rather than Git
artifacts. Their API verification is therefore required release evidence. If the
repository becomes private, GitHub plan limits and Actions billing must be
re-evaluated before relying on the same deployment.

Compatibility evidence does not modify live harness caches during a delivery.
Where a harness does not expose a safe isolated profile, validation is limited to
public remote access, manifest validation, and the verified command surface, and
that limit is stated rather than described as a clean-install smoke.

#### Non-goals

No CLA or DCO, `CODEOWNERS`, mandatory reviewer, governance board, support forum,
funding file, public roadmap, standalone changelog, documentation site,
localization, paid GitHub feature, code-scanning rollout, or automated mutation
of a user's harness configuration. The delivery and setup skill protocols do not
change.

#### Deferred

Require an approving review when a second active maintainer can provide one.
Add a dedicated support channel when support traffic outgrows issues. Add a
governance or ownership document when decision authority extends beyond one
maintainer. Automate clean-profile installation only when every supported harness
offers a disposable configuration boundary that does not touch live caches.

### 2026-08-25 — Dely is a lean automation-first plugin with an opt-in machine-local maintenance log

#### Context

The repository had 9,850 tracked lines after the automation-first release. The
runtime and installation surface accounted for 837 lines, while `docs/` accounted
for 6,918 and contract tests for 1,896. Claude Code, Codex CLI, and Grok Build each
copied the whole repository into an installed plugin, although their validators
reported only one skill directory and no commands or agents. Historical research,
completed migration material, a standalone push guard, and three prose-contract
test programs therefore shipped to ordinary users without contributing to plugin
installation or execution.

The delivery log had the same ownership problem. Every consuming project named and
tracked its own Markdown file even though the record exists to help a
later Dely maintenance session establish recurrence. That made plugin observations
part of project history and required every project to carry Dely-specific state.

#### Decision

Dely remains an automation-first thin control protocol. It owns the approved design
boundary, sequential implementation, independent review, bounded remediation, and
exact-HEAD release convergence. Orca owns dispatch, Git owns candidate state, and CI
plus the forge own release state. The shipped plugin surface is limited to the two
skills, their two Architectural templates, the harness manifests, concise installation
guidance, repository-maintainer instructions, this current decision, and one focused
structural contract test.

Completed research, superseded decisions, transient designs, the tracked project log,
and ancillary tooling outside the plugin component surface do not remain in the
current tree. Git history is their archive. The contract test checks only structural
public invariants; it does not attempt to parse or prove the semantics of the complete
English workflow contract.

The plugin version is `0.12.0` in both versioned manifests.

Maintenance logging is machine-local and opt-in at `~/.dely/log`:

- Dely never creates the directory or file. A missing path is skipped silently, and
  deleting the file opts out.
- Control appends exactly one physical line only after a delivery is accepted and all
  required checks are green. Aborted or incomplete deliveries are not recorded.
- The line contains an ISO-8601 UTC timestamp and labelled fields for the Git-root
  basename, plan, pull request or `none`, implementation-round count, ordered review
  dispositions, and one short drift-cause sentence. Tabs separate fields; embedded
  tabs and newlines become spaces. Acceptance is implicit because every record has
  already crossed that gate.
- Dely never reads this file for routing, recovery, or runtime decisions, and the text
  layout is not a public parsing schema.
- An append failure produces a visible warning but does not invalidate or block an
  otherwise accepted release.

#### Alternatives considered

- Keep a Git-ignored log inside each project. Rejected because it still creates plugin
  state in every checkout, splits observations across worktrees, requires ignore
  configuration, and can be committed accidentally.
- Keep the tracked project log. Rejected because plugin-maintenance observations do not
  belong in the consuming project's durable product history.
- Partition machine-local logs by repository or add a registry and stable hash.
  Rejected because one labelled line in one file is sufficient until basename
  collisions are observed to cost maintenance work.
- Retain all research and contract-test fixtures as maintainer-only material. Rejected
  because plugin managers copy them to every installation and Git already preserves
  them without keeping the current product surface ambiguous.
- Remove every test and durable decision. Rejected because one small structural check
  and one current rationale provide useful regression protection without restoring the
  previous documentation system.

#### Consequences

Ordinary installations become materially smaller and current documentation stops
presenting retired components as part of Dely. Projects no longer configure or commit a
delivery-log path. A maintainer who wants observations must create `~/.dely/log`
explicitly and is responsible for its permissions, retention, and deletion.

The machine-local log is not portable across machines. Two repositories with the same
root basename are not distinguished when no pull-request URL supplies context. Short
concurrent appends have no lock. Those limits are accepted because the log is optional
maintenance evidence and never a state owner.

Removing the standalone push guard is breaking for anyone who manually wired that file
as a Git hook. No compatibility stub remains. Dely's release contract still forbids
direct protected-branch release, force-push, and merge, but this decision does not claim
to replace repository branch protection.

Reducing the prose-contract suite also reduces the number of wording mutations rejected
mechanically. Independent review owns semantic verification; the remaining program
checks only shapes it can discriminate honestly.

#### Non-goals

No log reader, query command, rotation policy, lock manager, telemetry upload, automatic
instruction mutation, compatibility adapter, package builder, or second distribution
repository. No change to Orca, phase roles, review depth, remediation routing, setup's
two-row managed block, or the Architectural plan templates.

#### Deferred

Partition or strengthen project identity only after an observed basename collision makes
a record ambiguous. Add locking only after an observed concurrent append corrupts a
short record. Add rotation only after file growth causes a maintenance problem. A public
schema or reader requires a separate approved use case; ordinary maintenance reading by
a person or agent does not trigger one.
