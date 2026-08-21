---
name: setup
description: Configure a project's AGENTS.md with one managed Dely block — coordinator and per-phase harness, model and effort. Use at the start of a Control Session, when the project has no managed block, or when those pins need rewriting from the installed harnesses. Not for installing plugins, trusting hooks, or delivering a change; that is delivery.
---

# Setup

Write exactly one managed block into the project's `AGENTS.md`. Discover models
and effort from the installed harnesses. Do not store a catalogue. Do not
install, trust or enumerate anything.

Read `AGENTS.md` first. Replace only the region between this skill's own
markers. Prose outside the block is not read, merged, moved or deleted.

## Two paths

**Quick.** Use the current harness for every phase. Use that harness's defaults
for model and effort, written as the literal `default`.

**Customize.** For each of `control`, `implement`, `review` and `release`,
offer the discovered harnesses, models and effort levels and write what the
human chooses.

Ask which path. Do not start writing until that is answered.

## What to write

Exactly one block, and nothing else:

```markdown
<!-- dely:begin -->
## Dely

Planned or Critical work must invoke `dely:delivery`.

Coordinator: <name or none>

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `control` | … | … | … |
| `implement` | … | … | … |
| `review` | … | … | … |
| `release` | … | … | … |
<!-- dely:end -->
```

If the markers already exist, replace the region between them. If they do not,
append the block. Touch nothing else.

## Discovery

Run these commands. They are the catalogue. Do not copy a list from this
package, from memory, or from `docs/`.

- Claude Code models: `claude -p "/model" --output-format json`
- Claude Code effort: `claude -p "/effort" --output-format json`
- Codex: `codex debug models`
- Grok models: `grok models`

The two Claude probes are answered locally: `num_turns` 0, `total_cost_usd` 0,
no model turn. Do not treat them as a dispatch.

Codex slugs with `visibility: hide` are not offered. Codex reasoning levels
are `supported_reasoning_levels` on each slug, not one vocabulary per harness.

Grok effort is not discovered by calling the model. Read the installed CLI's
help and any validation already observed. Do not run a Grok prompt to learn
the flag.

A harness that is not installed is omitted from the offer, not an error.

## Pinning

Where a managed block exists, pin its Harness, Model and Effort on every
dispatch. The literal `default` in Model or Effort means the harness default
is wanted: omit that flag. That is not the same as an unset cell.

Where `AGENTS.md` carries no managed block, `delivery` runs on the current
harness with harness defaults and omits the model and effort flags. Setup is
a convenience over that fallback, not a precondition for it.

## Coordinator

Keep an existing selection. Where none exists, offer Orca only if it is
actually available; otherwise write `none`. Do not install a coordinator. Do
not invent an adapter.

## Refusals

Stop and report to the human, unchanged, when:

- the markers are broken (a `begin` without a matching `end`, or an `end`
  before its `begin`)
- more than one `<!-- dely:begin -->` is present
- a legacy phase table outside the block contradicts the block

Do not merge two tables, delete a legacy table, or guess which is
authoritative.

## Claude Code and `AGENTS.md`

Claude Code does not read `AGENTS.md`. The persistent instruction reaches
Codex and Grok natively. It reaches Claude Code only where the project has a
`CLAUDE.md` that imports `AGENTS.md`. Report this. Do not write `CLAUDE.md`.

## What setup will not do

No plugin or skill install. No hook trust. No writes to `~/.claude`,
`~/.codex` or `~/.grok`. No coordinator installation. No enumeration or
invocation of project-owned workflow plugins. No `Skills` column. No
dependency resolver.

Print verified install guidance only when the human explicitly asks for it.
