# Decisions

What has been settled, what is still open, and what was rejected and why.
Rationale is kept because the reasons are the reusable part.

Last updated 2026-08-27.

---

## Settled

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
`plugin.json` exists.

Install is native Cursor: `cursor-agent plugin marketplace add` of the git
URL, then `/add-plugin dely` in a Cursor Agent session. Invoke `/delivery`
and `/setup`. Do not document `npx skills --agent cursor`, PATH `agent`,
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

Live `/add-plugin` and official Marketplace search remain consumer-profile
checks: this repository does not mutate live harness configuration during
compatibility validation. Interactive plugin install is the current Cursor
CLI limit; there is no `plugin install` verb.

#### Non-goals

No Cursor hooks, rules, agents, commands, MCP, Cloud Agent, ACP, headless
`--print` dispatch, PATH `agent` launcher, `--worktree` worker checkout,
Orca change, write to `~/.cursor`, `npx skills` for Cursor, official
Marketplace submission, root `plugin.json` growth, change to review depth,
remediation, the two-row managed block, or `skills/delivery/SKILL.md`.

#### Deferred

Add `.cursor-plugin/marketplace.json` only if a live reindex of this git
marketplace still reports 0 plugins after `plugin.json` exists. Submit Dely
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
can pin the block's model and effort, and names the per-harness permission
default used when argv is composed by hand.

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
