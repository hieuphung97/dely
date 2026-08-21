# Plan — the package declares itself as `dely` and installs from its own remote

Decision record: `docs/decisions.md`, "2026-08-21 — The package is published as
`dely`, and every harness installs it from its own remote", including the
amendment "after publication — the facts this record rests on, and where the Grok
adapter points".

**Baseline:** resolved with `git rev-parse HEAD` after this plan is committed, and
written into the implement prompt by the control session. It is not guessed here: a
commit cannot record its own SHA, and a previous plan in this repository was
committed with an empty Baseline field instead of resolving it at dispatch.

## Goal

Every forward-looking statement this package makes about itself says `dely`: the
plugin is `dely`, the marketplace is `dely`, the version is `0.5.0`, the Codex
manifest carries the fields Codex's own first-party manifests carry, and the install
instructions install all three harnesses from `git@github.com:hieuphung97/dely.git`
including Grok natively. `bin/delivery-doctor` still passes on a machine wired the
old way and still passes on a machine wired the new way, because its Grok check stops
asserting a specific root and starts asserting a usable one.

Out of reach: nothing on this machine is installed, uninstalled, re-trusted or
re-wired by this plan, and no tag is created. Those are release and post-release acts.
The skill keeps the name `delivery` and the path `skills/delivery/`; `dely:delivery`
is the namespaced result, not a rename of the skill.

## Allowed scope

```
.claude-plugin/plugin.json
.claude-plugin/marketplace.json
.codex-plugin/plugin.json
README.md
AGENTS.md
hooks/grok-hooks.json.template
bin/delivery-doctor
tests/delivery-doctor-grok-hook.sh        (new)
```

Carried without being listed, and checked rather than assumed:

- **The colocated test of an allowed source file.** `bin/delivery-doctor` has none
  today. Task 3 creates the first one, listed above because it is new rather than
  inherited.
- **A registry or inventory test enumerating what the plan adds.** None exists;
  `tests/delivery-evidence-pipeline.sh` tests the reader's classification and
  enumerates nothing this plan touches. Checked, yielded nothing.
- **A document owning an allowed path.** `README.md` owns the install and hook-wiring
  instructions, and `AGENTS.md` owns the closure-gate list and the rule about editing
  hook scripts during a plan. Both are already listed above because both change.

## Forbidden scope

- **`docs/findings.md`.** It records what was observed under the retired identity at
  the time it was observed. Rewriting `delivery@delivery-tools` inside a captured
  debug line or a dated observation turns evidence into paraphrase, which is the rule
  the previous unit spent four rounds establishing. Its filename suggests relevance
  and its contents are historical.
- **The `#### Context` and pre-amendment body of the `dely` decision record.** Same
  reason: it states what was true on the day it was approved. The amendment carries
  the correction; the original text is not edited to agree with it.
- **`hooks/session-start-context.sh` and `hooks/post-tool-journal.sh`.** These are the
  two scripts a Grok worker executes by absolute path from this checkout while the
  plan runs. Editing either changes the harness under a live worker. The journal-path
  defect recorded as Deferred in the decision record lives in both and stays there.
- **`skills/delivery/SKILL.md` and `skills/delivery/templates/`.** The skill name,
  frontmatter and workflow rules are unchanged by an identity change. If this plan
  finds a reason to edit them, the plan is wrong.
- **`docs/delivery-log.md`.** Release appends its row; implementation does not.
- **Harness configuration and installed plugins.** `~/.claude`, `~/.codex`, `~/.grok`
  and every `plugin install` or `marketplace add` belong to the post-release
  migration.

## Tasks

### 1. The three manifests declare `dely` at `0.5.0`, and the Codex manifest conforms

**Behaviour.** `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` name the
plugin `dely` at version `0.5.0` with the description exactly
`A cross-harness delivery workflow for coding agents.`
`.claude-plugin/marketplace.json` names the marketplace `dely` and lists the plugin
`dely`. `.codex-plugin/plugin.json` additionally carries `skills`, `author`,
`homepage` and `repository`, and `interface.defaultPrompt` becomes an array.

**Direction.** The storefront presentation block is not adopted — no `brandColor`,
`logo`, `composerIcon`, `screenshots`, `capabilities` or `category` in the Codex
manifest. `homepage` and `repository` point at `https://github.com/hieuphung97/dely`;
the marketplace entry keeps `"source": "./"`, which is what makes the plugin resolve
inside its own repository whether the marketplace is added by path or by git URL.
`author` mirrors the owner block already in `.claude-plugin/marketplace.json` rather
than inventing a second identity. The marketplace's own `description` and the plugin
entry's `description` are prose about the same package and are rewritten to match the
approved description rather than left naming the old identity.

**Files.** The three manifests.

**Focused verification.** `grok plugin validate .` from the repository root reports
`name: dely` and `version: 0.5.0`. It reports `name: delivery, version: 0.4.3` on the
baseline, so it distinguishes done from not-done by itself.

**Document impact.** None from this task alone. `README.md` names the identity in its
install block and is reconciled by task 2, which is where that document's ownership
sits.

### 2. The install instructions install `dely@dely` from the remote, in all three harnesses

**Behaviour.** A reader following `README.md` adds the `dely` marketplace from
`git@github.com:hieuphung97/dely.git` and installs `dely@dely` in Claude Code, Codex
and Grok Build, then generates `~/.grok/hooks/delivery.json` against the root of
Grok's own installed copy. No forward-looking instruction in `README.md` or
`AGENTS.md` names `delivery@delivery-tools` or a local directory path as the install
source.

**Direction.** Grok gains its own `plugin marketplace add` and `plugin install`
step. The README says plainly that `grok plugin install` refuses a local directory
without `--trust` and that whether a git remote prompts the same way is untested, so
a reader hitting the prompt recognises it instead of treating it as a failure. The
adapter root is *derived*, not typed: `grok plugin details dely` reports the `path:`
of the install, and that value is what the `sed` line substitutes for
`__PACKAGE_ROOT__`. The existing paragraph about the source-versus-cache asymmetry is
rewritten rather than deleted — after this change all three run a cache copy, and the
new hazard worth naming is two copies drifting when only one is refreshed.

`hooks/grok-hooks.json.template` carries one false sentence in its `_comment` block:
that the README `sed` line substitutes "this repository's path". Correct it to name
the installed root. The template's structure, events and matcher do not change.

`AGENTS.md` has two obligations here. Its opening sentence names the package. And its
self-update rule says Grok "executes those scripts from this checkout by absolute
path" — after migration that premise is false, and the rule is also wider than its own
reason, since the adapter names exactly two scripts and nothing dispatches
`bin/delivery-doctor` or `bin/delivery-evidence`. Narrow it to the two scripts the
adapter names, and state the path as whichever copy the adapter points at — this
checkout before migration, Grok's installed copy after. Apply this narrowing before
the `bin/` edit in task 3, because it is what authorises that edit.

**Files.** `README.md`, `AGENTS.md`, `hooks/grok-hooks.json.template`.

**Focused verification.**
`grep -nE 'delivery@delivery-tools|marketplace add /path/to' README.md AGENTS.md`
returns nothing and exits 1. It returns four lines on the baseline, all in
`README.md`, so it discriminates. It is scoped to the two instruction documents on
purpose: the same string in `docs/findings.md` is evidence and must survive.

**Document impact.** `README.md` owns the install and hook-wiring procedure and is the
only place a new user learns it. `AGENTS.md` owns this project's own deployment rules
and its gate list; both are changed by this unit rather than merely mentioned by it.

### 3. `delivery-doctor` asserts a usable Grok adapter rather than a specific root

**Behaviour.** The Grok check passes when `~/.grok/hooks/delivery.json` is valid JSON
and the package root its commands reference exists and contains
`hooks/post-tool-journal.sh`. It warns when that root is absent or incomplete. It no
longer requires the referenced root to equal the directory `delivery-doctor` was run
from.

**Direction.** This is the one behaviour change in the unit, and it is here because
the identity change causes it: after migration the adapter points at Grok's installed
copy while `delivery-doctor` is run from the checkout, so today's `grep -q "$pkg_root"`
would warn on every correctly migrated machine. Shipping a release whose own doctor
reports a false warning is the reports-as-broken-and-is-not shape this project keeps
recording, so it is not deferred. The check must stay version-agnostic: the installed
root carries a version and a hash and changes at every release, and a doctor that
hard-codes either is a second thing to update per release.

Extract the referenced root from the JSON rather than pattern-matching the whole file
— the template writes `bash "<root>/hooks/<script>"`, so the root is derivable from
any one hook command with `jq`.

**Files.** `bin/delivery-doctor`, `tests/delivery-doctor-grok-hook.sh`.

**Focused verification.** `bash tests/delivery-doctor-grok-hook.sh`. It runs
`delivery-doctor` three times against a temporary `HOME`: with an adapter pointing at
a complete package root, with one pointing at a root that does not exist, and with
malformed JSON. It asserts `ok` for the first and a non-`ok` line for the other two.
It fails against the current `delivery-doctor` because case one — a valid adapter
pointing somewhere other than the package root — is exactly what today's check warns
about. Discrimination settled by running it against the baseline before the change.

**Document impact.** `AGENTS.md` owns the closure-gate list and gains this test as a
gate. The README sentence promising that `delivery-doctor` "fails if this file is
missing while `grok` is on `PATH`" stays true and needs no change; verify that rather
than assuming it.

## Acceptance

| Requirement | Instrument | Discriminates? |
| --- | --- | --- |
| Plugin, marketplace and namespaced identity are `dely`, `dely`, `dely:delivery` | `jq -e '.name == "dely"' .claude-plugin/plugin.json .codex-plugin/plugin.json` and `jq -e '.name == "dely" and (.plugins[0].name == "dely")' .claude-plugin/marketplace.json` | Yes. Baseline names are `delivery` and `delivery-tools`, so every assertion is red before and green after |
| The description is exactly the approved sentence | `jq -e '.description == "A cross-harness delivery workflow for coding agents."'` on both plugin manifests | Yes. The baseline description is the long rails sentence; string equality cannot pass by accident |
| Version is `0.5.0` in both plugin manifests | `jq -e '.version == "0.5.0"'` on both | Yes. Baseline is `0.4.3` |
| The Codex manifest carries the functional and type-correct fields | `jq -e '.skills and .author and .homepage and .repository and (.interface.defaultPrompt \| type == "array")' .codex-plugin/plugin.json` | Yes. All four keys are absent at baseline and `defaultPrompt` is a string, so the expression is false before and true after |
| The storefront block is still not adopted | `jq -e 'has("interface") and ([.interface \| has("brandColor"), has("logo"), has("screenshots"), has("capabilities")] \| any \| not)' .codex-plugin/plugin.json` | Partly. It proves absence after the change but is also true at baseline, so it is a regression guard rather than proof of work. Recorded as such |
| The package still validates on Grok under the new identity | `grok plugin validate .` reports `name: dely`, `version: 0.5.0`, `1 skill dir(s) … hooks` | Yes. It reports the old name and version at baseline, and it is the only instrument that reads the manifest the way a harness does |
| The skill name and path are unchanged | `grep -c '^name: delivery$' skills/delivery/SKILL.md` returns 1, and `git diff --stat` shows no path under `skills/` | Yes for the second half — any edit shows in the diff. The first half is a guard, since it is already true at baseline |
| No forward-looking instruction names the retired identity or a local install source | `grep -nE 'delivery@delivery-tools\|marketplace add /path/to' README.md AGENTS.md` exits 1 | Yes. Four matches at baseline, all in `README.md` |
| The Grok adapter root is derived from `grok plugin details`, not typed | A human reads the README block. No instrument | No. Recorded honestly: no check can tell a documented derivation from a documented constant, and the substituted value only exists at migration time |
| `delivery-doctor` accepts an adapter pointing at a root other than its own | `bash tests/delivery-doctor-grok-hook.sh` | Yes. Case one is red against the current script and green after, and cases two and three prove the check still refuses a broken adapter |
| Historical evidence is untouched | `git diff --stat` lists no change to `docs/findings.md` | Yes. Any edit appears |
| The repository still passes its own gates under the new identity | The closure-gate block below | Yes for shape and syntax. See the boundary note below for what it cannot see |

**Cannot be observed.** Nothing here proves that a harness can actually install
`dely@dely` from the remote. The manifests are read from the working tree, and
`grok plugin validate` reads a directory rather than performing a marketplace
resolution. Reachability, the `--trust` prompt on a git-remote install, the shape of
Grok's installed root, Codex hook re-trust after the content hash changes, and whether
`dely:delivery` actually loads in a session are all migration-time facts. They are
proven by the post-release forward smoke, not by this plan, and the plan must not
claim them.

Nothing here proves the description string is the one the product owner approved
rather than one an implementer retyped. String equality proves the file matches the
plan; the plan matching the decision record is what review checks by reading both.

## Stop conditions

- `grok plugin validate` refuses the renamed manifest for a reason the plan does not
  name — for example a constraint on plugin names, or a marketplace whose name equals
  its only plugin's name. That is `BLOCKED`, not something to work around by choosing
  a different name.
- The Codex manifest's `skills` key turns out to need a shape other than a path
  string. The comparison in the decision record was made against the first-party
  `browser` and `sites` manifests on 2026-08-21 and has not been re-read since;
  Codex 0.148.0 ships no `validate` command to settle it. If the first-party
  manifests now disagree, return `NEEDS_REPLAN` rather than guessing.
- The `delivery-doctor` change cannot be tested without an environment variable or a
  refactor larger than the check itself. The test drives it through a temporary
  `HOME`; if that does not work on this machine, say so rather than adding an
  injection point to make a test pass.
- Any task requires touching `hooks/session-start-context.sh`,
  `hooks/post-tool-journal.sh`, `docs/findings.md`, or anything under `skills/`. All
  four are forbidden scope for reasons the plan states, so needing one means the plan
  is wrong.
- Anything requires installing, uninstalling or re-wiring a harness on this machine.
  That is the post-release migration and it is not this plan's to perform.

## Closure gates

All from the repository root.

```bash
git diff --check
```

```bash
bash -n bin/delivery-doctor bin/delivery-evidence git-hooks/pre-push hooks/post-tool-journal.sh hooks/session-start-context.sh
```

```bash
jq -e . .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json hooks/hooks.json hooks/grok-hooks.json.template >/dev/null
```

```bash
bash tests/delivery-evidence-pipeline.sh
```

```bash
bash tests/delivery-doctor-grok-hook.sh
```

```bash
git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true
git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true
```

```bash
bash bin/delivery-doctor
```

The last one is not a gate in `AGENTS.md` and is not being added as one by this plan.
It is run because this unit changes the script itself, and a doctor that fails on the
machine that ships it is a defect the other gates cannot see.

Report every gate with the exact command, the summary line verbatim, and the exit
code. `$?` after a pipe reports the last command in the pipe, not the gate. The two
disclosure components are `git grep` calls wrapped in `&& exit 1 || true`; report the
grep's own status, not the wrapper's.
