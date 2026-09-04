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

if [ "$claude_version" != "0.17.0" ] || [ "$codex_version" != "0.17.0" ]; then
  fail_with "manifest versions must both be 0.17.0 (claude=$claude_version codex=$codex_version)"
fi

root_name="$(jq -r .name "$root_manifest" 2>/dev/null)"
[ "$root_name" = "dely" ] || fail_with "$root_manifest .name must be dely (got $root_name)"
jq -e '[keys[]] | sort == ["description","name"]' "$root_manifest" > /dev/null 2>&1 || fail_with "$root_manifest must have exactly keys name and description (no \$schema or extra keys)"

# Canonical MIT grant for 2026 Hieu Phung, whitespace-normalized; a file that only names "MIT" is not the grant.
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

# Maintenance-log section is matched verbatim so a contradictory extra clause or a flipped word fails.
expected_log_section='Maintenance logging is machine-local and opt-in at `~/.dely/log`. Dely never creates the directory or file: a missing path is skipped silently, and deleting the file opts out. Only after a delivery is accepted and all required checks are green does Control append exactly one physical line; aborted or incomplete deliveries are not recorded. The line carries an ISO-8601 UTC timestamp and labelled fields for the Git-root basename, plan, pull request or `none`, implementation-round count, ordered review dispositions, and one short drift-cause sentence. Tabs separate fields; embedded tabs and newlines become spaces. Dely never reads this file for routing, recovery, or runtime decisions, and its text layout is not a public parsing schema. An append failure produces a visible warning but does not invalidate or block an otherwise accepted release.'

actual_log_section="$(awk '/^### Maintenance log$/{flag=1; next} flag && /^#/{exit} flag' "$skill" | tr '\n' ' ' | tr -s ' ')"
actual_log_section="${actual_log_section# }"
actual_log_section="${actual_log_section% }"

[ "$actual_log_section" = "$expected_log_section" ] || fail_with "maintenance log section in $skill no longer matches the approved opt-in, accepted-only, non-blocking contract verbatim"

harnesses="$root/skills/delivery/references/harnesses.md"
grep -Fq 'configured permission default' "$skill" && grep -Fq 'sandbox the project did not pin' "$skill" && ! grep -Fq 'launch command as-is' "$skill" || fail_with "$skill launch-argv guidance does not carry the execution plane's configured permission default onto composed argv"
grep -Fq 'references/harnesses.md' "$skill" && [ -f "$harnesses" ] && ! tr '\n' ' ' < "$skill" | grep -Fq 'no compatibility matrix' || fail_with "$skill does not name an existing $harnesses, or still denies having a compatibility matrix"
# Dispatch mechanics come from the execution plane: deleted procedures absent; named verbs and typed recovery routes present.
grep -Fq 'Keep waiting blocking' "$skill" || grep -Fq '`input_accepted` is not submission' "$skill" || grep -Fq 'Allow 90 seconds' "$skill" && fail_with "$skill still carries a hand-rolled readiness or submission procedure"
grep -Fq 'worker-start' "$skill" && grep -Fq 'worker_done' "$skill" && grep -Fq 'agent_prompt_blocked' "$skill" && grep -Fq 'agent_prompt_stalled' "$skill" && grep -Fq 'payload.reportPath' "$skill" || fail_with "$skill does not name the orchestration verbs and both typed recovery routes"
grep -Fq 'do not infer it from reading' "$skill" || fail_with "$skill does not pin that completion cannot be inferred from reading a worker's terminal"
for f in '--permission-mode bypassPermissions' '--dangerously-skip-permissions' '--trust-all-tools' '--force' 'claude -p' 'codex exec' 'grok --prompt-file' 'agy -p' 'kiro-cli chat --no-interactive' 'cursor-agent -p' 'copilot -p' '--allow-all'; do
  grep -Fq -- "$f" "$harnesses" || fail_with "$harnesses does not name: $f"
  grep -Fq -- "$f" "$root/AGENTS.md" && fail_with "AGENTS.md must not name: $f"
done

# Cursor sidecar: .name must be dely, .skills must be ./skills/, no version key.
cursor_manifest="$root/.cursor-plugin/plugin.json"
[ -f "$cursor_manifest" ] || fail_with "missing $cursor_manifest"
cursor_name="$(jq -r .name "$cursor_manifest" 2>/dev/null)"
cursor_skills="$(jq -r .skills "$cursor_manifest" 2>/dev/null)"
[ "$cursor_name" = "dely" ] || fail_with "$cursor_manifest .name must be dely (got $cursor_name)"
[ "$cursor_skills" = "./skills/" ] || fail_with "$cursor_manifest .skills must be ./skills/ (got $cursor_skills)"
jq -e 'has("version") | not' "$cursor_manifest" > /dev/null 2>&1 || fail_with "$cursor_manifest must not have a version field"

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

[ "$setup_block_check" = "ok" ] || fail_with "$setup_skill managed block does not have exactly one implement and one review row"

# Setup's discovery subsections are matched verbatim via one helper.
norm() { tr '\n' ' ' | tr -s ' ' | sed -e 's/^ //' -e 's/ $//'; }
discovery_section="$(awk '/^## Discovery[[:space:]]*$/{p=1;next} p && /^## /{exit} p' "$setup_skill")"
printf '%s\n' "$discovery_section" | grep -Fq -- 'agy models' || fail_with "$setup_skill Discovery section does not name: agy models"
assert_discovery() { [ "$(awk "/^### ${1}[[:space:]]*\$/{p=1;next} p && /^#/{exit} p" "$setup_skill" | norm)" = "$2" ] || fail_with "$setup_skill ### $1 Discovery subsection no longer matches the approved policy verbatim"; }
assert_discovery 'Kiro CLI' 'Kiro CLI models: `kiro-cli chat --list-models --format json` (offer each `model_id`). Kiro CLI effort is read from `kiro-cli chat --help`'"'"'s `--effort` flag; do not prompt the model to learn it and do not store a catalogue. Live discovery may offer only `auto` — that is a valid result, not a reason to invent model names. Omit Kiro discovery that is unavailable or unusable rather than guessing.'
assert_discovery 'Cursor Agent CLI' 'Cursor Agent CLI models: `cursor-agent models` (offer the slug before ` - `). There is no `--effort` flag: write the literal `default` for Effort. Do not invent an effort vocabulary, do not strip effort suffixes from slugs, and do not synthesize parameterized `[effort=…]` forms. Omit Cursor discovery that is unavailable or unusable rather than guessing.'
assert_discovery 'GitHub Copilot CLI' 'GitHub Copilot CLI models: there is no non-interactive listing. Write the literal `default` for Model; do not invent a catalogue, do not prompt the model to learn one, and do not treat `copilot -p "/model"` as discovery. GitHub Copilot CLI effort is read from `copilot --help`'"'"'s `--effort` flag. Omit Copilot discovery that is unavailable or unusable rather than guessing.'
expected_harness_table='| Harness | Orca agent id | Permission default | Forbidden headless forms | Launch notes | | --- | --- | --- | --- | --- | | Claude Code | `claude` | `--dangerously-skip-permissions` | `claude -p` | `--model` pin honoured | | Codex CLI | `codex` | `--dangerously-bypass-approvals-and-sandbox` | `codex exec` | | | Grok Build | `grok` | `--permission-mode bypassPermissions` | `grok --prompt-file` | | | Antigravity CLI | `antigravity` | `--dangerously-skip-permissions` | `agy -p`/`--print` | | | Kiro CLI | `kiro` | none; `--trust-all-tools` is forbidden on the launch argv | `kiro-cli chat --no-interactive` | | | Cursor Agent CLI | `cursor` | `--force` | `cursor-agent -p`/`--print` | `--model` pin honoured; omit `--effort` when Effort is `default` | | GitHub Copilot CLI | `copilot` | `--allow-all` | `copilot -p`/`--prompt` | |'
[ "$(awk '/^\|/' "$harnesses" | norm)" = "$expected_harness_table" ] || fail_with "$harnesses table rows no longer match the approved per-harness facts verbatim"
grep -Eq "Prefer Orca's|Load Orca's native skill to launch and supervise each worker TUI\." "$harnesses" && fail_with "$harnesses carries the deleted prose paragraph alongside the table"
for id in claude codex grok antigravity kiro cursor copilot; do
  grep -Eq "^[|] [^|]+[|] \`$id\` [|]" "$harnesses" || fail_with "$harnesses does not name Orca agent id: $id"
done
grep -Fq 'does not suppress it' "$harnesses" || grep -Fq 'may not suppress it' "$harnesses" && fail_with "$harnesses still carries the stale Claude Code trust claim"
header="$(awk '/^\|/{print; exit}' "$harnesses")"; for doc in "$skill" "$root/AGENTS.md" "$root/README.md"; do for p in "trust handling" "permission default" "forbidden headless" "launch notes" "orca agent id"; do tr '\n' ' ' < "$doc" | grep -Fiq "$p" && ! printf '%s\n' "$header" | grep -Fiq "$p" && fail_with "$doc names a column the table does not have: $p"; done; done

# README install sections: Kiro requires npx skills; Cursor requires marketplace add + /plugin + /dely.
readme_section() { awk "/^### ${1}[[:space:]]*\$/{p=1;next} p && /^#{2,3} /{exit} p" "$root/README.md"; }
kiro_section="$(readme_section 'Kiro CLI')"
[ -n "$kiro_section" ] || fail_with "README.md is missing a ### Kiro CLI section"
printf '%s\n' "$kiro_section" | grep -Eiq 'copy (the |both )?skills? (files? )?(manually|by hand)' && fail_with "README.md Kiro CLI section instructs manual copying instead of npx skills" || true
for needle in 'npx skills add' 'npx skills update' 'npx skills remove' '--agent kiro-cli' '--global' '--skill delivery' '--skill setup' '/delivery' '/setup'; do
  printf '%s\n' "$kiro_section" | grep -Fq -- "$needle" || fail_with "README.md Kiro CLI section is missing: $needle"
done
cursor_section="$(readme_section 'Cursor Agent CLI')"
[ -n "$cursor_section" ] || fail_with "README.md is missing a ### Cursor Agent CLI section"
printf '%s\n' "$cursor_section" | grep -Fiq 'npx skills' && fail_with "README.md Cursor Agent CLI section must not document npx skills" || true
printf '%s\n' "$cursor_section" | grep -Eiq 'copy (the |both )?skills? (files? )?(manually|by hand)' && fail_with "README.md Cursor Agent CLI section instructs manual copying instead of plugin marketplace add" || true
cursor_fence="$(printf '%s\n' "$cursor_section" | awk '/^```/{f=!f;next} f')"
for needle in 'plugin marketplace add' 'plugin marketplace list' 'plugin marketplace update' 'plugin marketplace remove' '# removes the marketplace, not the plugin'; do printf '%s\n' "$cursor_fence" | grep -Fq -- "$needle" || fail_with "README.md Cursor Agent CLI fenced block is missing: $needle"; done
for needle in '`/plugin`' '`/dely`' '/delivery' '/setup'; do printf '%s\n' "$cursor_section" | grep -Fq -- "$needle" || fail_with "README.md Cursor Agent CLI section is missing: $needle"; done
for needle in '/add-plugin' '#[[:space:]]*uninstall'; do printf '%s\n' "$cursor_section" | grep -Eiq -- "$needle" && fail_with "README.md Cursor Agent CLI section must not contain: $needle" || true; done
copilot_section="$(readme_section 'GitHub Copilot CLI')"
[ -n "$copilot_section" ] || fail_with "README.md is missing a ### GitHub Copilot CLI section"
printf '%s\n' "$copilot_section" | grep -Fiq 'npx skills' && fail_with "README.md GitHub Copilot CLI section must not document npx skills" || true
copilot_fence="$(printf '%s\n' "$copilot_section" | awk '/^```/{f=!f;next} f')"
for needle in 'plugin marketplace add' 'plugin install dely@dely' 'plugin list' 'plugin update dely' 'plugin uninstall dely' 'plugin marketplace remove dely' '# removes the marketplace, not the plugin'; do printf '%s\n' "$copilot_fence" | grep -Fq -- "$needle" || fail_with "README.md GitHub Copilot CLI fenced block is missing: $needle"; done

# Orchestration prerequisite lives in the shared Quickstart preflight, not a per-harness section.
quickstart="$(awk '/^## Quickstart[[:space:]]*$/{p=1;next} p && /^## /{exit} p' "$root/README.md")"
[ -n "$quickstart" ] || fail_with "README.md is missing a ## Quickstart section"
printf '%s\n' "$quickstart" | grep -Fq 'orca orchestration run-list --json' || fail_with "README.md Quickstart does not give orca orchestration run-list --json as the confirmation command"

# Plan template's acceptance header: the four named columns must all be present.
plan_template="$root/skills/delivery/templates/plan.md"
acceptance_header="$(awk '
  /^## Acceptance[[:space:]]*$/ { in_acc = 1; next }
  in_acc && /^## / { exit }
  in_acc && /^\|/ && /[A-Za-z]/ { print; exit }
' "$plan_template")"
for col in Requirement Instrument Counterexample "Observed red"; do
  if ! printf '%s\n' "$acceptance_header" | grep -F "| $col " > /dev/null && \
     ! printf '%s\n' "$acceptance_header" | grep -F "| $col |" > /dev/null; then
    fail_with "$plan_template acceptance header is missing column: $col"
  fi
done

# Community collaboration contract: the six community artifacts must exist.
for f in CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md .github/ISSUE_TEMPLATE/bug_report.yml \
         .github/ISSUE_TEMPLATE/feature_request.yml .github/pull_request_template.md; do
  [ -f "$root/$f" ] || fail_with "missing required community artifact: $f"
done

# Bug form's harness dropdown must offer all seven exact harness names.
harness_options="$(awk '/^ *id: harness$/{f=1} f&&/^ *validations:/{exit} f' "$root/.github/ISSUE_TEMPLATE/bug_report.yml" | sed 's/^ *- //')"
for h in "Claude Code" "Codex CLI" "Grok Build" "Antigravity CLI" "Kiro CLI" "Cursor Agent CLI" "GitHub Copilot CLI"; do
  printf '%s\n' "$harness_options" | grep -Fxq -- "$h" || fail_with "bug_report.yml harness dropdown is missing: $h"
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
    'git diff --check', 'bash -n tests/contracts.sh',
    'jq -e . plugin.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .codex-plugin/plugin.json .cursor-plugin/plugin.json >/dev/null',
    'bash tests/contracts.sh', 'test "$(wc -l < tests/contracts.sh)" -le 250',
    'test ! -e git-hooks/pre-push', 'test ! -e docs/delivery-log.md', 'test ! -e docs/findings.md',
    'test ! -e docs/harness-surface.md', 'test ! -e docs/options.md',
    'test ! -e docs/_plans/2026-08-24-automation-first-dely-design.md',
    'test ! -e bin/delivery-doctor', 'test ! -e bin/delivery-evidence',
    'test ! -e hooks/hooks.json', 'test ! -e hooks/grok-hooks.json.template',
    'test ! -e hooks/post-tool-journal.sh', 'test ! -e hooks/session-start-context.sh',
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
