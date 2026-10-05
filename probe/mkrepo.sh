#!/bin/bash
# Create a probe repository for probe/checklist.md.
#
# Usage: probe/mkrepo.sh <name> <implement harness id> <model> <effort> \
#                               <review harness id> <model> <effort>
#
# Example: probe/mkrepo.sh r1 claude claude-opus-5 medium \
#                                codex gpt-5.1-codex high
#
# Writes ~/dely-probe/<name> with a bare remote, a delivery-sized task, the
# team pins in .dely/pins.json, and the one-line routing sentence in AGENTS.md. Re-running it destroys and rebuilds
# the repository, which is the point: the harness trust entry is keyed on the
# path and survives, so only the first run needs a human.
set -eu

ROOT="$HOME/dely-probe"
name=${1-}
if [ $# -ne 7 ] || [ -z "$name" ]; then
  echo "usage: probe/mkrepo.sh <name> <implH id> <implM> <implE> <revH id> <revM> <revE>" >&2
  exit 2
fi

# Hard limit: this script only ever writes under ~/dely-probe/.
case "$name" in
  */*|.*|"") echo "REFUSED name must be a single path segment, not '$name'" >&2; exit 2 ;;
esac
mkdir -p "$ROOT"
base=$(cd "$ROOT" && pwd -P)
case "$base" in
  "$HOME"/dely-probe) ;;
  *) echo "REFUSED $ROOT resolves outside \$HOME/dely-probe" >&2; exit 2 ;;
esac

repo="$base/$name"
remote="$base/remotes/$name.git"

rm -rf "$repo" "$remote"
mkdir -p "$base/remotes"
git init -q --bare -b main "$remote"
mkdir -p "$repo/test"

cat > "$repo/slug.js" <<'SRC'
"use strict";

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "-");
}

module.exports = { slugify };
SRC

cat > "$repo/test/slug.test.js" <<'SRC'
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { slugify } = require("../slug.js");

test("lowercases and separates words", () => {
  assert.strictEqual(slugify("Hello World"), "hello-world");
});
SRC

cat > "$repo/REQUEST.md" <<'SRC'
# Request

`slugify` turns every non-alphanumeric character into its own dash, so a string
with punctuation or padding produces runs of dashes and dashes at the ends.

Make `slugify` collapse a run of non-alphanumeric characters into one dash and
trim the dashes at both ends. `slugify("  Hello,   World!  ")` must return
`hello-world`, and `slugify("Hello World")` must keep returning `hello-world`.
SRC

cat > "$repo/AGENTS.md" <<SRC
# ${name} — Agent Instructions

Default branch: \`main\`. Remote \`origin\` is a local bare repository with no
forge: release pushes the feature branch to \`origin\` and reports the pushed
SHA instead of opening a pull request. There is no remote CI; the closure
gates below on exact HEAD stand in for required checks.

## Closure gates

\`\`\`bash
git diff --check
\`\`\`

\`\`\`bash
node --test test/
\`\`\`

Bounded or Architectural work invokes \`dely:delivery\`; Spike starts no
delivery run.
SRC

mkdir -p "$repo/.dely"
cat > "$repo/.dely/pins.json" <<SRC
{
  "implement": { "harness": "${2}", "model": "${3}", "effort": "${4}" },
  "review": { "harness": "${5}", "model": "${6}", "effort": "${7}" }
}
SRC

printf '@AGENTS.md\n' > "$repo/CLAUDE.md"

cd "$repo"
git init -q -b main
git add -A
git -c user.name=probe -c user.email=probe@example.invalid commit -qm "Seed the probe repository."
git remote add origin "$remote"
git push -q origin main
orca repo add --path "$repo" --json >/dev/null

printf '%s %s implement=%s/%s/%s review=%s/%s/%s\n' \
  "$repo" "$(git rev-parse --short HEAD)" "$2" "$3" "$4" "$5" "$6" "$7"
