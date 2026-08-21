#!/usr/bin/env bash
# Focused check: delivery-doctor distinguishes an absent managed block from a
# well-formed one and from a broken one; the setup skill exists and states the
# non-offerable-choice rule in its Coordinator section; both plugin manifests
# share a bumped version. Does not require claude, codex, grok or orca.
set -u

root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
doctor="$root/bin/delivery-doctor"
[ -f "$doctor" ] || { printf '%s\n' "missing doctor: $doctor" >&2; exit 1; }

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "jq not on PATH; cannot parse plugin manifests" >&2
  exit 1
fi

scratch=$(mktemp -d "${TMPDIR:-/tmp}/managed-block-contract.XXXXXX")
cleanup() { rm -rf "$scratch"; }
trap cleanup EXIT

failures=0
fail() {
  printf '%s\n' "FAIL: $*" >&2
  failures=$((failures + 1))
}

run_doctor() {
  local repo="$1"
  local out="$2"
  bash "$doctor" "$repo" >"$out" 2>&1 || true
}

line_ok() { grep -E '^  ok[[:space:]]+.*managed block' "$1" >/dev/null; }
line_warn() { grep -E '^  warn[[:space:]]+.*managed block' "$1" >/dev/null; }
line_fail() { grep -E '^  FAIL[[:space:]]+.*managed block' "$1" >/dev/null; }

expect_ok() {
  local out="$1"
  local why="$2"
  if ! line_ok "$out"; then
    fail "expected ok managed-block line for ${why}"
    cat "$out" >&2
  fi
  if line_fail "$out"; then
    fail "unexpected FAIL managed-block line for ${why}"
    cat "$out" >&2
  fi
}

expect_warn() {
  local out="$1"
  local why="$2"
  local needle="$3"
  if ! line_warn "$out"; then
    fail "expected warn managed-block line for ${why}"
    cat "$out" >&2
  fi
  if ! grep -E '^  warn[[:space:]]+.*managed block' "$out" | grep -F "$needle" >/dev/null; then
    fail "warn managed-block line for ${why} did not mention ${needle}"
    cat "$out" >&2
  fi
  if line_fail "$out"; then
    fail "unexpected FAIL managed-block line for ${why} (absence is not a failure)"
    cat "$out" >&2
  fi
}

expect_fail() {
  local out="$1"
  local why="$2"
  local needle="$3"
  if line_ok "$out"; then
    fail "expected FAIL managed-block line for ${why}, got ok"
    cat "$out" >&2
  fi
  if ! line_fail "$out"; then
    fail "missing FAIL managed-block line for ${why}"
    cat "$out" >&2
  fi
  if ! grep -E '^  FAIL[[:space:]]+.*managed block' "$out" | grep -F "$needle" >/dev/null; then
    fail "FAIL managed-block line for ${why} did not mention ${needle}"
    cat "$out" >&2
  fi
}

well_formed_block() {
  local model="${1:-opus}"
  cat <<EOF
<!-- dely:begin -->
## Dely

Planned or Critical work must invoke \`dely:delivery\`.

Coordinator: Orca

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`control\` | Claude Code | \`${model}\` | \`high\` |
| \`implement\` | Grok Build | \`grok-4.6\` | \`medium\` |
| \`review\` | Codex | \`gpt-5.6-sol\` | \`medium\` |
| \`release\` | Grok Build | \`grok-4.6\` | \`medium\` |
<!-- dely:end -->
EOF
}

# Text of ## Coordinator up to the next ## heading.
coordinator_section() {
  awk '
    /^## Coordinator[[:space:]]*$/ { p = 1; next }
    p && /^## / { exit }
    p { print }
  ' "$1"
}

# Returns 0 if the document states the non-offerable-choice rule in the
# Coordinator section. Prints FAIL lines to stderr and returns 1 otherwise.
# Inspects only the given file; does not increment the driver counter.
check_setup_skill_rule() {
  local file=$1
  local section
  local tmp=0

  if [ ! -f "$file" ]; then
    printf '%s\n' "FAIL: missing setup skill: $file" >&2
    return 1
  fi

  section=$(coordinator_section "$file")
  if [ -z "$section" ]; then
    printf '%s\n' "FAIL: $file has no Coordinator section" >&2
    return 1
  fi

  if ! printf '%s\n' "$section" | grep -Ei 'cannot|could not|unable' >/dev/null; then
    printf '%s\n' "FAIL: Coordinator section does not state a choice that cannot be offered" >&2
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'report' >/dev/null; then
    printf '%s\n' "FAIL: Coordinator section does not report a choice that could not be offered" >&2
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'available' >/dev/null; then
    printf '%s\n' "FAIL: Coordinator section does not name what was available" >&2
    tmp=1
  fi
  if ! printf '%s\n' "$section" | grep -Ei 'how to set' >/dev/null; then
    printf '%s\n' "FAIL: Coordinator section does not say how to set the unoffered choice" >&2
    tmp=1
  fi
  return $tmp
}

# --- skill frontmatter -------------------------------------------------------

skill="$root/skills/setup/SKILL.md"
if [ ! -f "$skill" ]; then
  fail "skills/setup/SKILL.md is absent"
else
  skill_check=$(awk '
    /^---$/ { n++; next }
    n == 1 && $0 ~ /^name:[[:space:]]*setup[[:space:]]*$/ { name = 1 }
    n == 1 && $0 ~ /^description:[[:space:]]*.+/ {
      desc = $0
      sub(/^description:[[:space:]]*/, "", desc)
      if (length(desc) > 0) d = 1
    }
    n >= 2 { exit }
    END {
      if (!name) print "name"
      if (!d) print "description"
    }
  ' "$skill")
  case "$skill_check" in
    *name*) fail "skills/setup/SKILL.md frontmatter name is not setup" ;;
  esac
  case "$skill_check" in
    *description*) fail "skills/setup/SKILL.md frontmatter description is empty or missing" ;;
  esac
  if ! check_setup_skill_rule "$skill"; then
    fail "skills/setup/SKILL.md does not state the non-offerable-choice rule"
  fi

  # Negative: Coordinator section unchanged; the words live only in Refusals.
  skill_ce="$scratch/skill-not-offered-in-refusals.md"
  awk '
    /^## Coordinator[[:space:]]*$/ { print; in_c = 1; next }
    in_c && /^## / { in_c = 0 }
    in_c && tolower($0) ~ /cannot|could not|unable|report|how to set|conservative/ { next }
    /^## Refusals[[:space:]]*$/ { print; in_r = 1; next }
    in_r && /^## / {
      print "A coordinator that was not offered is still a legal configuration."
      print ""
      in_r = 0
    }
    { print }
  ' "$skill" >"$skill_ce"
  ce_out="$scratch/out-skill-not-offered"
  if check_setup_skill_rule "$skill_ce" >"$ce_out" 2>&1; then
    fail "skill document with unchanged Coordinator and \"not offered\" only in Refusals passed the rule check"
    cat "$ce_out" >&2
  fi
fi

# --- manifests --------------------------------------------------------------

claude_ver=$(jq -r '.version // empty' "$root/.claude-plugin/plugin.json")
codex_ver=$(jq -r '.version // empty' "$root/.codex-plugin/plugin.json")
if [ -z "$claude_ver" ] || [ -z "$codex_ver" ]; then
  fail "a plugin manifest is missing version"
elif [ "$claude_ver" != "$codex_ver" ]; then
  fail "plugin manifest versions differ: claude=${claude_ver} codex=${codex_ver}"
elif [ "$claude_ver" = "0.7.0" ]; then
  fail "plugin manifest version is still 0.7.0"
fi

# --- doctor fixtures --------------------------------------------------------

# 1. no AGENTS.md at all
repo1="$scratch/no-agents"
mkdir -p "$repo1"
out1="$scratch/out-no-agents"
run_doctor "$repo1" "$out1"
expect_warn "$out1" "no AGENTS.md" "no AGENTS.md"

# 2. AGENTS.md with no markers
repo2="$scratch/no-markers"
mkdir -p "$repo2"
printf '%s\n' '# Project' >"$repo2/AGENTS.md"
out2="$scratch/out-no-markers"
run_doctor "$repo2" "$out2"
expect_warn "$out2" "AGENTS.md with no markers" "no markers"

# 3. complete well-formed block
repo3="$scratch/well-formed"
mkdir -p "$repo3"
well_formed_block >"$repo3/AGENTS.md"
out3="$scratch/out-well-formed"
run_doctor "$repo3" "$out3"
expect_ok "$out3" "a complete well-formed block"

# 4. incomplete block; the missing required row lives only outside the markers
repo4="$scratch/bounded"
mkdir -p "$repo4"
{
  printf '%s\n' '# Outside — review row is only here'
  printf '%s\n' '| Phase | Harness | Model | Effort |'
  printf '%s\n' '| --- | --- | --- | --- |'
  printf '%s\n' '| `review` | Codex | `gpt-5.6-sol` | `medium` |'
  printf '\n'
  well_formed_block | grep -v '`review`'
} >"$repo4/AGENTS.md"
out4="$scratch/out-bounded"
run_doctor "$repo4" "$out4"
expect_fail "$out4" "incomplete block with the missing row only outside the markers" "review"

# 5. two begin markers
repo5="$scratch/two-begin"
mkdir -p "$repo5"
{
  well_formed_block
  printf '\n'
  well_formed_block
} >"$repo5/AGENTS.md"
out5="$scratch/out-two-begin"
run_doctor "$repo5" "$out5"
expect_fail "$out5" "two begin markers" "more than one"

# 6. begin with no end
repo6="$scratch/no-end"
mkdir -p "$repo6"
well_formed_block | grep -v 'dely:end' >"$repo6/AGENTS.md"
out6="$scratch/out-no-end"
run_doctor "$repo6" "$out6"
expect_fail "$out6" "begin with no end" "no matching end"

# 7. missing Coordinator line
repo7="$scratch/no-coordinator"
mkdir -p "$repo7"
well_formed_block | grep -v Coordinator >"$repo7/AGENTS.md"
out7="$scratch/out-no-coordinator"
run_doctor "$repo7" "$out7"
expect_fail "$out7" "missing Coordinator line" "Coordinator"

# 8. missing review row
repo8="$scratch/no-review"
mkdir -p "$repo8"
well_formed_block | grep -v '`review`' >"$repo8/AGENTS.md"
out8="$scratch/out-no-review"
run_doctor "$repo8" "$out8"
expect_fail "$out8" "missing review row" "review"

# 9. wrong table header
repo9="$scratch/wrong-header"
mkdir -p "$repo9"
well_formed_block | sed 's/Phase | Harness | Model | Effort/Phase | Harness | Model | Reasoning effort/' >"$repo9/AGENTS.md"
out9="$scratch/out-wrong-header"
run_doctor "$repo9" "$out9"
expect_fail "$out9" "wrong table header" "Phase | Harness | Model | Effort"

# 10. novel Model and Effort — not a stored catalogue value
repo10="$scratch/novel-values"
mkdir -p "$repo10"
{
  cat <<'EOF'
<!-- dely:begin -->
## Dely

Planned or Critical work must invoke `dely:delivery`.

Coordinator: Orca

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `control` | Claude Code | `not-a-catalogue-slug` | `not-a-catalogue-effort` |
| `implement` | Grok Build | `not-a-catalogue-slug` | `not-a-catalogue-effort` |
| `review` | Codex | `not-a-catalogue-slug` | `not-a-catalogue-effort` |
| `release` | Grok Build | `not-a-catalogue-slug` | `not-a-catalogue-effort` |
<!-- dely:end -->
EOF
} >"$repo10/AGENTS.md"
out10="$scratch/out-novel-values"
run_doctor "$repo10" "$out10"
expect_ok "$out10" "a block whose Model and Effort cells are novel non-empty values"

# 11. Model cell is the literal default — still legal, distinct from unset
repo11="$scratch/literal-default"
mkdir -p "$repo11"
well_formed_block default >"$repo11/AGENTS.md"
out11="$scratch/out-literal-default"
run_doctor "$repo11" "$out11"
expect_ok "$out11" "a block whose Model cell is the literal default"

# 12. required Harness/Model/Effort cells empty
repo12="$scratch/empty-cells"
mkdir -p "$repo12"
{
  cat <<'EOF'
<!-- dely:begin -->
## Dely

Planned or Critical work must invoke `dely:delivery`.

Coordinator: Orca

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `control` | | | |
| `implement` | | | |
| `review` | | | |
| `release` | | | |
<!-- dely:end -->
EOF
} >"$repo12/AGENTS.md"
out12="$scratch/out-empty-cells"
run_doctor "$repo12" "$out12"
expect_fail "$out12" "phase rows with empty Harness/Model/Effort cells" "empty"

# 13. duplicate phase row
repo13="$scratch/duplicate-phase"
mkdir -p "$repo13"
{
  cat <<'EOF'
<!-- dely:begin -->
## Dely

Planned or Critical work must invoke `dely:delivery`.

Coordinator: Orca

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| `control` | Claude Code | `opus` | `high` |
| `control` | Claude Code | `opus` | `high` |
| `implement` | Grok Build | `grok-4.6` | `medium` |
| `review` | Codex | `gpt-5.6-sol` | `medium` |
| `release` | Grok Build | `grok-4.6` | `medium` |
<!-- dely:end -->
EOF
} >"$repo13/AGENTS.md"
out13="$scratch/out-duplicate-phase"
run_doctor "$repo13" "$out13"
expect_fail "$out13" "duplicate phase row" "duplicate"

# Final: this repository itself
out_self="$scratch/out-self"
run_doctor "$root" "$out_self"
expect_ok "$out_self" "this repository's own AGENTS.md"

if [ "$failures" -ne 0 ]; then
  printf '%s\n' "managed-block-contract: ${failures} failure(s)" >&2
  exit 1
fi
printf '%s\n' "managed-block-contract: ok"
