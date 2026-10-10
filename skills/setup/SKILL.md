---
name: setup
description: Configure a project's Dely pins — per-phase harness, model and effort for implement and review, written to .dely/pins.json (team) or .dely/local/pins.json (only this person), discovered from the live harness surface. Use at the start of a Control Session, when the project has no pins, or when pins need rewriting from the installed harnesses. Not for installing plugins, trusting hooks, or delivering a change; that is delivery.
---

# Setup

Write the project's Dely pins into one JSON file, and one routing sentence
into `AGENTS.md`. Discover models and effort from the installed harnesses. Do
not store a catalogue. Do not install, trust, or enumerate anything.

Harness facts live in `../../harnesses.json` relative to this skill
(repository root `harnesses.json`). Read that file. Do not copy a list from
this package, from memory, or from `docs/`.

## Two files

```
.dely/pins.json            team pins, tracked
.dely/local/pins.json      personal pins, never tracked
.dely/local/.gitignore     contains *, so nothing under .dely/local is tracked
.dely/local/runs/<run>/    prompts and handoffs of one Orca Run, written by delivery
```

Each file is an object whose only keys are `implement` and `review`. Each
value has exactly the string keys `harness` (an `id` from `harnesses.json`),
`model` and `effort`. A file may name one phase or both. Per phase, the
personal file wins over the team file, and the team file over Control's own
harness with `default` for Model and Effort. In a linked worktree, the
personal file is looked for in that worktree first and then in the main
checkout; only one personal file is read, never both. `dely pins --repo <path>`
prints what resolves and from where.

Pins configure `implement` and `review` — nothing else. There is no control
row, because the current interactive session already exists and is never
dispatched; there is no release row, because release has no LLM worker; there
is no Plan Mode or design-skill field.

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

Ask which path, and whether the choice is for the team or only for this
person. Do not start writing until both are answered.

## What to write

For a team choice, write `.dely/pins.json`. For a personal choice, write
`.dely/local/pins.json`, and write `.dely/local/.gitignore` containing the
single line `*` first, so the personal file never shows in `git status`. Never
edit the repository's root `.gitignore`. Create the directories as needed.

```json
{
  "implement": { "harness": "claude", "model": "default", "effort": "default" },
  "review": { "harness": "codex", "model": "default", "effort": "default" }
}
```

Use the harness `id`, not its display name. If the target file exists, show
what it holds and write only on a yes. A personal file shadows the team file
per phase; say so when writing one.

Then make sure `AGENTS.md` carries the routing line. If it has no
`dely:delivery`, append:

> Bounded or Architectural work invokes `dely:delivery`; Spike starts no
> delivery run.

If `AGENTS.md` contains an old `<!-- dely:begin -->` block, the helper stops
until it is gone. Offer to replace the block, from its begin marker through its
end marker, with the routing line, and carry its table over to
`.dely/pins.json` as the proposed team pins. Change `AGENTS.md` only on a yes.
Prose outside the block is never touched.

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

The literal `default` in Model or Effort means the harness default is wanted:
omit that flag. That is not the same as an unset phase: defaults are a
deployment preference, not a reproducible pin, and the execution envelope
records the configured value and, where the harness exposes it, the actual
observed model and effort.

Where no file names a phase, `delivery` runs it on Control's own harness with
`default` for Model and Effort. Setup is a convenience over that fallback, not
a precondition for it. The run stops only when Control's harness is unknown.

## When a choice cannot be offered

Where a choice cannot be offered, do not make it. Take the conservative
action — which may be writing a conservative value, and may be doing
nothing — and report the choice that was not offered, naming what was
available and how to set it; do not write that report into a pins file.

For the instructions-file import: if the current harness's
`instructionsFile.needsImport` is true, the import is absent, and setup
cannot ask, write nothing and report the offer that was not made.

## Refusals

Stop and report to the human, unchanged, when an existing pins file is not
valid JSON in the format above. Do not repair it or guess what it meant.

## Instructions file

Read the current harness's `instructionsFile`. The persistent instruction
reaches a harness natively when `readsAgentsMd` is true. It reaches a
harness that does not read `AGENTS.md` only where the project has
`instructionsFile.file` containing `instructionsFile.importLine`.

Where `needsImport` is true and that import is absent, offer to create a
one-line file at `instructionsFile.file` containing
`instructionsFile.importLine`. The human accepts or declines. Never write it
unasked.

This carries no configuration: it points at `AGENTS.md`, it does not copy it.

The offer follows `needsImport`. Files listed in `inert` are not imported.
Files listed in `alsoApplies` are applied as rules by that harness; that
does not by itself trigger the write offer.

## Trust

After the pins are written, for each pinned harness whose `trust` is
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
