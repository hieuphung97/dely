# Decisions

What has been settled, what is still open, and what was rejected and why.
Rationale is kept because the reasons are the reusable part.

Last updated 2026-08-25.

---

## Settled

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
