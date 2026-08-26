#!/usr/bin/env bash
# Focused structural contract checks for the dely package.
# Usage: tests/contracts.sh [root]
#   root defaults to "." so a fixture copy can be checked in isolation.
set -uo pipefail

root="${1:-.}"
fail=0

fail_with() {
  echo "FAIL: $1" >&2
  fail=1
}

root_manifest="$root/plugin.json"
claude_manifest="$root/.claude-plugin/plugin.json"
codex_manifest="$root/.codex-plugin/plugin.json"
skill="$root/skills/delivery/SKILL.md"

claude_version="$(jq -r .version "$claude_manifest" 2>/dev/null)"
codex_version="$(jq -r .version "$codex_manifest" 2>/dev/null)"

if [ "$claude_version" != "0.13.0" ] || [ "$codex_version" != "0.13.0" ]; then
  fail_with "manifest versions must both be 0.13.0 (claude=$claude_version codex=$codex_version)"
fi

root_name="$(jq -r .name "$root_manifest" 2>/dev/null)"
if [ "$root_name" != "dely" ]; then
  fail_with "$root_manifest .name must be dely (got $root_name)"
fi

# Canonical MIT text (github.com/licenses/mit) with [year] -> 2026 and
# [fullname] -> Hieu Phung, whitespace-normalized. A present LICENSE that only
# names the license by word (e.g. "MIT") is not the grant itself.
expected_license='MIT License Copyright (c) 2026 Hieu Phung Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.'

license_file="$root/LICENSE"
if [ ! -f "$license_file" ]; then
  fail_with "missing LICENSE"
else
  actual_license="$(tr '\n' ' ' < "$license_file" | tr -s ' ')"
  actual_license="${actual_license# }"
  actual_license="${actual_license% }"
  if [ "$actual_license" != "$expected_license" ]; then
    fail_with "LICENSE is not the canonical MIT text for 2026 Hieu Phung"
  fi
fi

# The whole maintenance-log section is matched verbatim (whitespace-normalized)
# rather than by scattered substrings: a substring check only proves a required
# clause is present somewhere, so a fixture that leaves it untouched but adds a
# contradictory instruction elsewhere (e.g. "Control creates the log if
# missing"), or one that flips a single word in a required clause (e.g. "are
# not recorded" -> "are recorded"), still passed. Exact-section matching
# rejects any such addition or mutation.
expected_log_section='Maintenance logging is machine-local and opt-in at `~/.dely/log`. Dely never creates the directory or file: a missing path is skipped silently, and deleting the file opts out. Only after a delivery is accepted and all required checks are green does Control append exactly one physical line; aborted or incomplete deliveries are not recorded. The line carries an ISO-8601 UTC timestamp and labelled fields for the Git-root basename, plan, pull request or `none`, implementation-round count, ordered review dispositions, and one short drift-cause sentence. Tabs separate fields; embedded tabs and newlines become spaces. Dely never reads this file for routing, recovery, or runtime decisions, and its text layout is not a public parsing schema. An append failure produces a visible warning but does not invalidate or block an otherwise accepted release.'

actual_log_section="$(awk '/^### Maintenance log$/{flag=1; next} flag && /^#/{exit} flag' "$skill" | tr '\n' ' ' | tr -s ' ')"
actual_log_section="${actual_log_section# }"
actual_log_section="${actual_log_section% }"

if [ "$actual_log_section" != "$expected_log_section" ]; then
  fail_with "maintenance log section in $skill no longer matches the approved opt-in, accepted-only, non-blocking contract verbatim"
fi

# Setup's managed block: the fenced "What to write" template must carry
# exactly two data rows, phases {implement, review} with no duplicate or
# extra phase (e.g. a lingering control/release row). Word-presence alone
# cannot catch an extra row that still contains the right words.
setup_skill="$root/skills/setup/SKILL.md"

managed_block_template() {
  awk '
    /^## What to write[[:space:]]*$/ { p = 1; next }
    p && /^```/ { fence = !fence }
    p && !fence && /^## / { exit }
    p { print }
  ' "$1"
}

setup_block_check="$(managed_block_template "$setup_skill" | awk '
  function trim(s) { gsub(/^[[:space:]]+|[[:space:]]+$/, "", s); return s }
  /^\|/ {
    if (!header_seen) { header_seen = 1; next }
    t = $0; gsub(/[|:[:space:]-]/, "", t)
    if (t == "") next
    n = split($0, a, "|")
    phase = trim(a[2]); gsub(/`/, "", phase)
    rows++
    count[phase]++
  }
  END {
    if (rows != 2 || count["implement"] != 1 || count["review"] != 1) {
      print "bad"
      exit
    }
    for (p in count) if (p != "implement" && p != "review") { print "bad"; exit }
    print "ok"
  }
')"

if [ "$setup_block_check" != "ok" ]; then
  fail_with "$setup_skill managed block does not have exactly one implement and one review row"
fi

# Setup's Discovery section must name the live `agy models` command, not just
# mention Antigravity in prose elsewhere in the file.
discovery_section="$(awk '/^## Discovery[[:space:]]*$/{p=1;next} p && /^## /{exit} p' "$setup_skill")"
if ! printf '%s\n' "$discovery_section" | grep -Fq 'agy models'; then
  fail_with "$setup_skill Discovery section does not name agy models"
fi

# Plan template's acceptance header: the four named columns must all be
# present, in any order, alongside whatever else the row carries.
plan_template="$root/skills/delivery/templates/plan.md"

acceptance_header="$(awk '
  /^## Acceptance[[:space:]]*$/ { in_acc = 1; next }
  in_acc && /^## / { exit }
  in_acc && /^\|/ && /[A-Za-z]/ { print; exit }
' "$plan_template")"

for col in Requirement Instrument Counterexample "Observed red"; do
  if ! printf '%s\n' "$acceptance_header" | grep -F "| $col " >/dev/null && \
     ! printf '%s\n' "$acceptance_header" | grep -F "| $col |" >/dev/null; then
    fail_with "$plan_template acceptance header is missing column: $col"
  fi
done

# Community collaboration contract: the six community artifacts must exist,
# and both issue forms must be present, parseable YAML with the top-level
# keys GitHub requires to render an issue form (name, description, body).
for f in CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md \
         .github/ISSUE_TEMPLATE/bug_report.yml \
         .github/ISSUE_TEMPLATE/feature_request.yml \
         .github/pull_request_template.md; do
  if [ ! -f "$root/$f" ]; then
    fail_with "missing required community artifact: $f"
  fi
done

for f in .github/ISSUE_TEMPLATE/bug_report.yml .github/ISSUE_TEMPLATE/feature_request.yml; do
  path="$root/$f"
  [ -f "$path" ] || continue
  missing="$(ruby -ryaml -e '
    begin
      d = YAML.safe_load(File.read(ARGV[0]))
    rescue => e
      puts "parse-error(#{e.message})"
      exit
    end
    unless d.is_a?(Hash)
      puts "not-a-mapping"
      exit
    end
    m = %w[name description body].reject { |k| d.key?(k) }
    puts m.join(",") unless m.empty?
  ' "$path")"
  if [ -n "$missing" ]; then
    fail_with "$f is not a valid GitHub issue form: missing/invalid $missing"
  fi
done


# One CI entry point: the workflow must exist, parse as YAML, and match the
# approved shape exactly: name, triggers, top-level permissions, the sole
# "contracts" job id, its runner, its sole action, and every literal
# AGENTS.md closure command present as a whole normalized run line, never a
# substring. A heredoc keeps the required lines' own quoting literal.
workflow="$root/.github/workflows/contracts.yml"
if [ ! -f "$workflow" ]; then
  fail_with "missing $workflow"
else
  workflow_checker="$(mktemp)"
  cat >"$workflow_checker" <<'RUBY'
require "yaml"
begin
  d = YAML.safe_load(File.read(ARGV[0]))
rescue => e
  puts "parse-error(#{e.message})"
  exit
end
errs = []
errs << "bad-name" unless d.is_a?(Hash) && d["name"] == "contracts"
# YAML 1.1 parses the bare "on:" key as boolean true, not the string "on".
on = d.is_a?(Hash) ? (d.key?(true) ? d[true] : d["on"]) : nil
unless on.is_a?(Hash) && on.key?("pull_request") &&
       on["push"].is_a?(Hash) && on["push"]["branches"] == ["main"]
  errs << "bad-triggers"
end
errs << "bad-permissions" unless d["permissions"] == {"contents" => "read"}
jobs = d["jobs"]
if jobs.is_a?(Hash) && jobs.keys == ["contracts"]
  job = jobs["contracts"]
  errs << "bad-runner" unless job["runs-on"] == "ubuntu-latest"
  steps = job["steps"] || []
  uses_steps = steps.select { |s| s.key?("uses") }
  unless uses_steps.length == 1 && uses_steps.first["uses"] == "actions/checkout@v4"
    errs << "bad-checkout-step"
  end
  run_lines = steps.flat_map { |s| (s["run"] || "").split("\n") }.map(&:strip).reject(&:empty?)
  required = [
    'git diff --check',
    'bash -n tests/contracts.sh',
    'jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json >/dev/null',
    'bash tests/contracts.sh',
    'test "$(wc -l < tests/contracts.sh)" -le 250',
    'test ! -e git-hooks/pre-push',
    'test ! -e docs/delivery-log.md',
    'test ! -e docs/findings.md',
    'test ! -e docs/harness-surface.md',
    'test ! -e docs/options.md',
    'test ! -e docs/_plans/2026-08-24-automation-first-dely-design.md',
    'test ! -e bin/delivery-doctor',
    'test ! -e bin/delivery-evidence',
    'test ! -e hooks/hooks.json',
    'test ! -e hooks/grok-hooks.json.template',
    'test ! -e hooks/post-tool-journal.sh',
    'test ! -e hooks/session-start-context.sh',
    "git grep -Ei 'pace.?id' -- . ':!docs/_plans' && exit 1 || true",
    "git grep -E '(^|[^A-Za-z0-9])[A-Z][0-9]+[a-z]?([^A-Za-z0-9]|$)' -- . ':!docs/_plans' && exit 1 || true",
  ]
  errs << "missing-run-lines" unless (required - run_lines).empty?
else
  errs << "bad-jobs"
end
puts errs.join(",") unless errs.empty?
RUBY
  workflow_check="$(ruby "$workflow_checker" "$workflow")"
  rm -f "$workflow_checker"
  if [ -n "$workflow_check" ]; then
    fail_with "$workflow $workflow_check"
  fi
fi

exit "$fail"
