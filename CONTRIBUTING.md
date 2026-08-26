# Contributing to Dely

Thanks for your interest in improving Dely. This guide covers the normal,
external contribution path. You do **not** need Dely or Orca installed to
contribute here — a standard GitHub fork and pull request is enough.

## Before you start

For anything that changes a public contract (a documented command, a file
this package ships, a skill's behavior, or the repository's structural
tests), please open an issue first using the bug report or feature request
form. That lets us agree on the change before you spend time on a patch, and
keeps duplicate or conflicting work from happening in parallel.

Small, obvious fixes (typos, broken links, clarified wording) don't need an
issue first — a pull request is fine.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Make your change. Keep commits focused and write commit messages and all
   repository artifacts (docs, code comments, templates) in English.
3. Run the repository's structural checks before opening a pull request:

   ```bash
   bash tests/contracts.sh
   ```

   If your change touches `.claude-plugin/plugin.json` or
   `.codex-plugin/plugin.json`, keep both manifests' `version` fields in
   sync — a mismatch is a structural failure.

4. Open a pull request against `main` using the pull request template. CI
   runs the same structural checks on every pull request; a green
   `contracts` check is required before merge.

## Decisions

Durable design decisions and their rationale live in `docs/decisions.md`.
Maintainers own recording decisions there as part of Dely's own delivery
process — you don't need to write a decision entry yourself, but it helps to
say in your pull request description what you expect the durable outcome to
be, so a maintainer can reconcile it.

## Review expectations

A maintainer will review your pull request, run or re-run the structural
checks, and may ask for changes. Because Dely currently has a solo
maintainer, merges happen once the required `contracts` check is green and
review feedback is addressed — an approving review from a second maintainer
is not required to merge.
