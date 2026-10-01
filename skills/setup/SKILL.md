---
name: setup
description: Configure a project's AGENTS.md with one managed Dely block — per-phase harness, model and effort for implement and review, discovered from the live harness surface. Use at the start of a Control Session, when the project has no managed block, or when those pins need rewriting from the installed harnesses. Not for installing plugins, trusting hooks, or delivering a change; that is delivery.
---

# Setup

Write exactly one managed block into the project's `AGENTS.md`. Discover
models and effort from the installed harnesses. Do not store a catalogue. Do
not install, trust, or enumerate anything.

Read `AGENTS.md` first. Replace only the region between this skill's own
markers. Prose outside the block is not read, merged, moved, or deleted.

Harness facts live in `../../harnesses.json` relative to this skill
(repository root `harnesses.json`). Read that file. Do not copy a list from
this package, from memory, or from `docs/`.

## Two rows only

The managed block configures deployment preferences for `implement` and
`review` — nothing else. There is no coordinator or orchestrator field,
because Orca is the constant, required execution plane. There is no control
row, because the current interactive session already exists and is never
dispatched. There is no release row, because release has no LLM worker. There
is no Plan Mode field and no design-skill field: the active design method is
a property of the harness and session, not a Dely setting.

## Two paths

**Quick.** Use the current harness for both `implement` and `review`. Use
that harness's defaults for model and effort, written as the literal
`default`.

**Customize.** For each of `implement` and `review`, offer the discovered
harnesses, models and effort levels and write what the human chooses. Where a
harness exposes no way to pin a model or an effort, write the literal `default`
for that cell and point to Orca's agent default arguments. An entry with
`modelPin: spec` or `modelPin: spec-unchecked` can be pinned — offer its
discovered models and effort levels as for a flag harness, and write
Effort `default` for a model whose effort field is `null`.

Ask which path. Do not start writing until that is answered.

## What to write

Exactly one block, and nothing else:

```markdown
<!-- dely:begin -->
## Dely

Bounded or Architectural work invokes `dely:delivery`; Spike starts no
delivery run.

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `implement` | … | … | … |
| `review` | … | … | … |
<!-- dely:end -->
```

If the markers already exist, replace the region between them. If they do
not, append the block. Touch nothing else.

## Discovery

Offer only entries whose `status` is `supported`. A `deferred` entry is
omitted, not an error. When an offered entry has `limits`, print it next
to that harness.

For each supported entry whose `binary` is installed, run that entry's
`discovery`. `discovery` is `null` when the harness has no listing command;
then write the literal `default` for Model and Effort and point the human to
Orca's agent default arguments to set the model. When `discovery` is an
object, run `discovery.models` and, when `discovery.effort` is set, that
command too.

They are the catalogue. Do not invent a catalogue, do not prompt a model to
learn one, and do not treat a `/model` slash command as discovery.

When `discovery.answeredLocally` is true, the probe is answered locally: do
not treat it as a dispatch.

When `discovery.omitVisibility` is set, slugs whose `visibility` equals that
value are not offered. When `discovery.effortFrom` is set, effort levels are
that field on each slug, not one vocabulary per harness. When
`discovery.modelSlugBefore` is set, offer the slug before that separator.
When `discovery.modelField` is set, each model's value is that field rather
than `slug`.

When `effortFlag` is false and `discovery.effort` and `discovery.effortFrom`
are both absent, write the literal `default` for Effort. Do not invent an
effort vocabulary, do not strip effort suffixes from slugs, and do not
synthesize parameterized `[effort=…]` forms. Omit discovery that is
unavailable or unusable rather than guessing.

A harness that is not installed is omitted from the offer, not an error.

## Pinning

Where a managed block exists, pin its Harness, Model and Effort for
`implement` and `review` on every dispatch. The literal `default` in Model or
Effort means the harness default is wanted: omit that flag. That is not the
same as an unset cell — defaults are a deployment preference, not a
reproducible pin, and the execution envelope records the configured value and,
where the harness exposes it, the actual observed model and effort.

Where `AGENTS.md` carries no managed block, `delivery` runs `implement` and
`review` on the current harness with harness defaults and omits the model and
effort flags. Setup is a convenience over that fallback, not a precondition
for it.

## When a choice cannot be offered

Where a choice cannot be offered, do not make it. Take the conservative
action — which may be writing a conservative value, and may be doing
nothing — and report the choice that was not offered, naming what was
available and how to set it; do not write that report into the managed
block.

For the instructions-file import: if the current harness's
`instructionsFile.needsImport` is true, the import is absent, and setup
cannot ask, write nothing and report the offer that was not made.

## Refusals

Stop and report to the human, unchanged, when:

- the markers are broken (a `begin` without a matching `end`, or an `end`
  before its `begin`)
- more than one `<!-- dely:begin -->` is present
- a legacy phase table outside the block contradicts the block

Do not merge two tables, delete a legacy table, or guess which is
authoritative.

## Instructions file

Read the current harness's `instructionsFile`. The persistent instruction
reaches a harness natively when `readsAgentsMd` is true. It reaches a
harness that does not read `AGENTS.md` only where the project has
`instructionsFile.file` containing `instructionsFile.importLine`.

Where `needsImport` is true and that import is absent, offer to create a
one-line file at `instructionsFile.file` containing
`instructionsFile.importLine`. The human accepts or declines. Never write it
unasked.

This is not a second managed block: no markers, no configuration, a pointer
at the block rather than a copy of it.

The offer follows `needsImport`. Files listed in `inert` are not imported.
Files listed in `alsoApplies` are applied as rules by that harness; that
does not by itself trigger the write offer.

## Trust

After the managed block is written, for each pinned harness whose `trust` is
`dialog`, open it once for the human with
`orca terminal create --worktree path:<repo> --command "<binary> <permissionDefault>"`,
taking `binary` and `permissionDefault` from that entry in `harnesses.json`.
If `permissionDefault` is `none`, the command is the binary alone. The human
answers that harness's own dialog; setup never answers it and never writes a
harness store. The human closes the terminal when done. `orca-preflight` and
`none` need no step.

## Preflight

Open a Run first as `orca skills get orchestration` describes. Then run
`../delivery/scripts/dely preflight --repo <path> --run <runId>` relative
to this skill. Any `PREFLIGHT … FAIL` (exit 1): do not dispatch to any pin;
relay the printed reason to the human.

## What setup will not do

No plugin or skill install. No hook trust. Setup may open a pinned harness
in an Orca terminal so the human can answer that harness's own trust dialog;
it still never answers the dialog and never writes a harness store. No custom
agent creation or modification. No coordinator installation or field. No
control or release row. No enumeration or invocation of project-owned
workflow plugins. No model catalogue.

Print verified install guidance only when the human explicitly asks for it.
