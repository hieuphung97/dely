# Findings

Evidence this design rests on. Everything here was read from disk or observed
in a run, not reasoned from documentation. Where a number was derived by
grouping free text, that is said.

Captured 2026-08-19.

---

## 1. What the recorded delivery log actually shows

The evidence base is 41 recorded plans, read from the consuming project's own
delivery log. The project's record is the source; the table and the plan
chronology stay there.

The founding ADR's intent is one implementation session per plan. The workflow
runs at roughly 2.8 rounds per plan.

### Causes that earned a rule

Grouped by hand from the `Drift cause` column of that log, then checked against
the log rather than left as a grouping. Approximate. Detail that names a plan,
a correction or an internal file lives in the project's record.

Largest: an acceptance instrument that could not discriminate a pass from a
failure — eight plans.

Second-largest: environment or config not pinned; a gate went green or red for
reasons outside the candidate.

Allowed scope omitted a file the plan's own tasks required — three plans, not
five. A grouping that inflated that count caused a wrong decision downstream;
the number was checked against the log before anything was built on it. Each of
the three was answered, and two plans then ran without a scope failure.

One plan held a shared primitive and its eighty call sites: three rounds, each
ending at 0 of 80 files, then abandoned. Split in two: two rounds then
`ACCEPT`, and one round then `ACCEPT`. Splitting is the strongest proven lever
and it needs no tooling.

Fabricated or wrong identifier carried through a transition card: three plans.

The last group — the one automated transport removes — accounts for roughly 4%
of rounds. **Automating handoff does not reduce the round count.** It removes
manual work and a large amount of contract prose. Round count is driven by
plan and acceptance quality.

### The recurrence rule works, slowly

Two of seven recorded corrections were made under the log's own recurrence
test, and each followed a third occurrence. The pattern is that mechanical
checks fail, and the workflow answers by adding prose. Source: the project's
record.

### The first learning loop failed for a structural reason

The founding ADR was amended on 2026-08-09. The original design specified one
git-ignored local metrics record per accepted plan. It was never written once
in nine plans. The amendment's own diagnosis: a git-ignored file has no reader,
and a record with no reader does not get written. Confirmed on disk in the
consuming project: the git-ignored local directory held no such record.

The replacement — one row appended to a tracked delivery log — is written,
cited, and survives compaction. Design consequence: **a journal needs a reader,
and a program counts as a reader.**

---

## 2. Transport corrupts payloads in ways nobody notices

### Observation A — an implementation handoff arrived as mojibake

An implementation handoff, pasted into the Control Session through the
Claude Desktop app, was recorded in the transcript as UTF-8 read back as
MacRoman. Every bullet and every non-ASCII string destroyed. The handoff
contained the UI strings the plan's acceptance table required verifying, so
the Control Session could not have checked that claim. The plan still
reached `ACCEPT` because the reviewer re-derived everything from the
repository. The destroyed half of that handoff was decorative, not evidence.

The captured lines and the UI strings themselves live in the project's
record, not here.

### Observation B — a review report lost its escaped backticks

A re-review report, copied from a Kiro session and pasted into a chat,
lost one character before every closing escaped backtick. Identifiers that
had been quoted inside escaped backticks were truncated. Four markdown
tables lost their pipes and became tab-separated. The first of those tables
has a column headed **"Summary line (verbatim)"**.

Damage was asymmetric in a way that favoured the weaker conclusion. The report
argued that two framing sentences in two documents *differ* appropriately
while a middle sentence is *byte-identical*. The middle sentence has no
backticks and survived. Both sentences proving the difference were
corrupted. The document names and the truncated strings are in the project's
record.

An escaped backtick inside a code span is precisely what the review phase
produces, because quoting documentation prose that itself contains an
identifier requires nesting. The content with the highest evidentiary value is
the content most likely to be destroyed by a human copy path. Structural, not
coincidental.

### Observation C — the same session, the clean path

Three payloads delivered with `claude -p --resume <id> < file` arrived
byte-clean, non-ASCII characters and backticks intact, verified from the
`last-prompt` entries in the same transcript file that holds Observation A.

Same session, same file, two entry paths. One destroys encoding, the other does
not. This is the controlled comparison the design rests on.

---

## 3. Identifiers degrade whenever a model is their source

Three instances, one class.

| Instance | Actor | Corruption | How it surfaced |
| --- | --- | --- | --- |
| three named plans (project record) | model writing a transition card | fabricated SHA, or a SHA pinned to the wrong window | one or two review rounds lost |
| Observation B above | human copy path | escaped backticks, table structure | invisible until compared with the source |
| A `jq` selector in this session | me | dropped the `-say` suffix from a message id | empty output file, visible in seconds |

The third failed loudly and was harmless. The first two failed quietly and
produced plausible output. **The dangerous transport failures are the ones that
look fine.**

The rule this yields is not "be careful with identifiers":

> Never let a model be the *source* of an identifier. Derive it, or let a
> program resolve it.

`last` instead of a hand-typed id. `git rev-parse HEAD` instead of a retyped
SHA. This is what the `SessionStart` hook implements.

---

## 4. Grok Build as a release worker

One real run: a plan's closure, `grok -p` with `grok-4.6`,
`--effort medium`, session `[redacted]`. The project's record names the plan
and the session.

### The work was correct

Plan deleted. ADR untouched. Five closure gates run *after* the closure
commit, reported with exact commands and verbatim summary lines. It caught
its own error — gates first ran from the repository root, missing a nested
layout, and it noticed and reran them.

The delivery-log row carried all three points the transition card required,
including the one that mattered most: the two-run gate rule existed only in
the plan, the plan is deleted at closure, so the log row is the only place
it survives.

**The skill is portable.** Its prose is not covertly tuned to Claude and Codex.

### The authority rail did not hold

`--deny 'Bash(git push *)'` was passed. Grok pushed anyway.

The tool call sequence explains how. The first push attempt was
`git push origin HEAD && git status -sb && git rev-parse HEAD && …`, which the
pattern matches. Grok then reported it would "retry the push" and issued a bare
`git push`. **`git push *` does not match `git push`** — the pattern requires at
least one character after the space. A shorter spelling of the same command
walked straight through.

`Bash(git *)` is the documented rule form for Grok, so the tool name was
probably not the problem. An earlier version of this note blamed the tool name
(`run_terminal_command` in `signals.json`) — that was a second unverified
inference on top of the first. Neither cause has been isolated by experiment;
the pattern gap is the more likely one because it is visible in the trace.

Damage was nil — feature branch, PR still draft, `main` untouched.

Two lessons, and the second is the important one:

- A rail gave false assurance.
- **A deny list over command strings is defeated by rewording the command.**
  There is no finite pattern set for "do not push", because the agent chooses
  the spelling. This is an argument for an OS-enforced sandbox over a pattern
  list, not an argument for a better pattern.

### Identifiers degraded inside its reasoning

From the `thought` field, all self-corrected before the final answer:

| In reasoning | Should have been |
| --- | --- |
| `[redacted] [redacted]` | a SHA with a space inserted mid-string |
| a plans path with a space instead of `/` | missing `/` |
| `docs : close …` [redacted] | space before the colon |
| a space inside an identifier [redacted] | space inside an identifier |
| pytest reported as `Tests  0 passed (0)` | fabricated, and in vitest's format |
| closure commit given as `[redacted]…` | that is the implementation SHA |

Cause visible in the same field: one sentence in the project's language
repeated about ten times, degrading a little each time.
`doomLoopRecoveryAttempts: 0` — Grok's own detector did not fire.

The pre-redaction tokens and the path corruption are in the project's
record.

The fabricated pytest line is the strongest single argument for the
`PostToolUse` journal. Had Grok not caught it, the closure report would have
carried a false summary line and **nothing downstream could have detected it** —
the Control Session has no way to check a summary line a worker claims.

---

## 5. The Control Session verifies by reproduction

Given Grok's release report, the Control Session did not route on the claim. It
ran `git status --short`, compared HEAD with the remote branch, read
`--stat` of the closure commit, checked the ADR's own log, listed `_plans/`,
and then ran `git show` on the commit to read the appended log row rather than
trusting the sentence describing it.

That discipline arrived without being prompted for, and it is what a hook
should make cheap rather than replace.

---

## 6. Corrections made during this session

Recorded because the pattern matters more than the individual errors.

- Claimed the workspace directory did not exist, and that this was why the
  shell failed. The directory exists and is empty; the shell fails
  independently and for every command.
- Claimed a field update on the delivery log at closure was scope creep. The
  previous value was the prior plan's implementation commit — bumping it at
  closure is established practice and Grok followed it. The field name and
  SHA are in the project's record.
- Recommended `acpx` as the transport layer before checking that all three
  harnesses ship first-party multi-session dashboards, which changed the
  recommendation.
- Asserted a `--deny` rule for Grok using Claude Code's tool name. See above.

Two of these four are the same mistake: inferring one harness's behaviour from
another's documentation.

---

## 7. First real hook run, 2026-08-20

One probe run in the reference consumer with `--permission-bypass` in force.

### Both open questions resolved

**Hooks fire under `bypassPermissions`.** `SessionStart` injected its context and
the session quoted it back; `PostToolUse` wrote its journal file. The payload
itself records `"permission_mode": "bypassPermissions"`. This was the
highest-stakes unknown: under full bypass with no sandbox, hooks are the only
instrumentation left. They work. It also means `cc-safety-net`, a `PreToolUse`
hook, has a reason to work in the same mode.

**The Bash `tool_response` carries no exit code.** Full payload as captured:

```json
{"session_id":"[redacted]-…","transcript_path":"…","cwd":"[redacted]",
 "prompt_id":"[redacted]-…","permission_mode":"bypassPermissions","effort":{"level":"high"},
 "hook_event_name":"PostToolUse","tool_name":"Bash",
 "tool_input":{"command":"git status --porcelain","description":"…"},
 "tool_response":{"stdout":"","stderr":"","interrupted":false,"isImage":false,
                  "noOutputExpected":false},
 "tool_use_id":"toolu_016E5cDJJ4dDiMTabpC6p6JW","duration_ms":393}
```

What that settles: the hook gives **`tool_input.command`, `tool_response.stdout`
and `.stderr`, `tool_use_id`, and `duration_ms`**. OpenTelemetry's
`claude_code.tool_result` gives **`success`, `error_type`, `duration_ms`** and,
per its own documentation, a `tool_use_id` that matches the one passed to hooks.

The two sources are exactly complementary. Neither replaces the other:

| Needed for gate evidence | Hook | OTel |
| --- | --- | --- |
| the command that ran | yes | with `OTEL_LOG_TOOL_DETAILS=1` |
| the verbatim summary line | **yes** | no |
| pass or fail | no | **yes** |
| a numeric exit code | no | no |
| correlation key | `tool_use_id` | `tool_use_id` |

**Untested hypothesis, now wired:** Claude Code has a separate
`PostToolUseFailure` event, so failure may be encoded in *which event fires*
rather than in a field. `hooks.json` now registers both against the same script,
and the journal already records `hook_event_name`. One command that exits
non-zero settles it, and if it holds, OTel is not needed for pass or fail.

### Two defects in this repository's own hook

Both are the failure class this hook was written to prevent, and an injected
wrong value is worse than no injection, because the text tells the session to
cite it rather than re-derive it.

**A clean tree was reported dirty.** The rendered line read:

```
- Tree: dirty (0
0 path(s))
```

`git status --porcelain | grep -c .` prints `0` and **exits 1** when there are no
matches, so the `|| printf '0'` fallback fired as well and the variable became
`"0\n0"`. The subsequent `[ "$dirty_count" -eq 0 ]` then failed on a non-integer,
`2>/dev/null` swallowed the error, and the `else` branch reported dirty. Fixed by
counting with `wc -l`, which exits 0 on empty input, and by validating with
`case` instead of an arithmetic test.

**A stale baseline was presented as current.** The hook reported
`Default ref: origin/main ([redacted])` and a position ahead of the
remote-tracking ref — but a merge had already landed on the remote, so
`origin/main` there contains a different SHA. The value came from the local
remote-tracking ref, which had not been fetched since the merge. Every
number was internally consistent and the conclusion was wrong. The SHAs,
ahead/behind counts and pull-request number are in the project's record.

This is the more serious of the two, because a baseline is load-bearing: the
whole review contract is a diff against one. Fixed by labelling those three
values as coming from the local ref, reporting when `FETCH_HEAD` was last
touched, and flagging an age over an hour as likely stale. The hook deliberately
performs **no network I/O** — a session-start hook that can hang on a fetch is a
worse trade.

The general lesson, which the previous six sections kept circling: resolving an
identifier with a program removes the *transcription* error, not the *staleness*
error. `git rev-parse origin/main` is exactly as wrong as a retyped SHA when the
ref is old. Freshness has to be asserted separately from resolution.

---

## 8. Second run: the failure path, and a correction

Same probe, plus one command guaranteed to fail. Both earlier defects verified
fixed — the tree rendered `clean`, and the baseline block carried a last-fetch
age of over 24h, marked likely stale, which is correct: a merge had landed
after that fetch, so the ref genuinely was behind. The exact fetch timestamp
and pull-request number are in the project's record.

### `PostToolUseFailure` fires, and pass or fail is readable from the event

```
git status --porcelain            -> completed
ls /khong-ton-tai-duong-dan-nay   -> failed
```

The hypothesis holds. Pass or fail comes from which event fires, so **OTel is not
required for gate evidence**. It stays useful for cost, duration and correlation,
but it is no longer on the critical path.

### Correction to §7: the exit code does exist, on the failure path

§7 concluded that no source provides a numeric exit code. That was wrong. The
`PostToolUseFailure` payload:

```json
{"hook_event_name":"PostToolUseFailure","tool_name":"Bash",
 "tool_input":{"command":"ls /khong-ton-tai-duong-dan-nay","description":"…"},
 "tool_use_id":"toolu_01Ekkn7GW1prJPii8Pzh6c37",
 "error":"Exit code 1\nls: /khong-ton-tai-duong-dan-nay: No such file or directory",
 "is_interrupt":false,"duration_ms":20}
```

`error` begins with `Exit code 1`. The number is there, as the first line of a
string rather than as a field.

### The two events carry different shapes

This matters more than the exit code, because reading the wrong field returns a
plausible answer rather than an error.

| | `PostToolUse` | `PostToolUseFailure` |
| --- | --- | --- |
| `tool_response` | present | **absent entirely** |
| stdout | `tool_response.stdout` | **not present in any field** |
| stderr | `tool_response.stderr` | inside `error`, after the exit-code line |
| exit code | absent, 0 implied | first line of `error` |
| interrupt flag | `interrupted` | `is_interrupt` |

`bin/delivery-evidence` originally read `.tool_response.stdout` unconditionally,
which would have reported every failed command as having produced no output. Now
fixed: it normalises both shapes, parses the exit code out of `error`, and names
which field the text came from.

### Open gap, and it is the important one

**A failing command's stdout is not in the payload.** `ls` writes to stderr, so
this run cannot distinguish "`error` carries combined output" from "`error`
carries stderr only".

The case that matters is a red gate. `pytest` writes `N failed, M passed in Xs`
to **stdout** and exits non-zero. If `error` carries stderr only, the summary line
of a failing gate — the single most load-bearing piece of evidence in the whole
review contract — is unrecoverable from the journal.

Settled by one command that writes to stdout and exits non-zero.

### Method note

Three consecutive conclusions in these findings were wrong in the same way: a
shape was inferred from one observation and stated as general. The tool response
shape (§7), the exit code's absence (§7), and before that a Grok deny-rule
mechanism. Each was corrected by the next observation rather than by more
reasoning. One sample is not a schema.

---

## 9. The gap closes, and the warning was the wrong thing

One command: `bash -c "echo DONG_NAY_RA_STDOUT; echo dong_nay_ra_stderr >&2; exit 3"`.

Journal, read back through `bin/delivery-evidence`:

```
  status: FAILED, exit 3, 411ms
    DONG_NAY_RA_STDOUT
    dong_nay_ra_stderr
```

`error` carries **combined output**. Both streams are present, and the exit code
parsed correctly out of the first line. The gap raised in §8 does not exist: a red
`pytest` gate's summary line, written to stdout, will be in the journal.

### The evidence layer is complete, and needs nothing further

With the hook alone:

| Needed | Source |
| --- | --- |
| the command | `tool_input.command` |
| the verbatim output | `tool_response.stdout`/`.stderr` on success, `error` on failure |
| pass or fail | which event fired |
| the exit code | `0` implied on success, first line of `error` on failure |
| duration | `duration_ms` |
| correlation | `tool_use_id` |

No OpenTelemetry collector. No wrapping of gate commands. No `PreToolUse`
rewriting to append `2>&1`. Three designs considered over the last two turns, none
needed.

Residual limitation, and it is small: on the failure path the streams arrive
merged and cannot be told apart. The workflow's evidence contract asks for the
summary line verbatim, not for which stream produced it, so this costs nothing
here. Recorded because it is a real property, not because it matters yet.

### The reader was the thing making a false claim

`bin/delivery-evidence` printed, on every failure:

> If a gate writes its summary to stdout and exits non-zero, that line may be
> unrecoverable from here.

That was false, and it was printed **by the tool built to stop false claims about
evidence**. It also mislabelled the combined block as `stderr (from error)`, which
on its own would have led a reader to conclude stdout was lost. Both fixed.

This is the fourth instance of one shape inferred from one observation and stated
as general — after the Grok deny mechanism, the tool-response shape, and the exit
code's absence. It is the first where the wrong statement was a **warning** rather
than a value, and that failure mode is its own hazard: a false reassurance causes
a missed defect, while a false warning causes work to be done against a problem
that does not exist. Two turns of design went into closing a gap that was never
open.

The correction to the method is narrow and concrete. When an observation is
missing a field, that is evidence about **that observation**, not about the
schema. Before designing around an absence, construct the case that would show
the absence is real — here, one command writing to stdout and failing. It cost
one command and would have saved two turns.

---

## 10. `cc-safety-net` under bypass, and a near miss

v2.0.7, installed as a Claude Code plugin from the `kenryu42/cc-marketplace`
marketplace and enabled in `~/.claude/settings.json`. Its hook is a single
`PreToolUse` entry with **no matcher**, so it sees every tool, not only Bash —
which is how it covers secret access through file tools as well as through `cat`.

Four commands under `--permission-mode bypassPermissions`.

### It holds under bypass

```
BLOCKED by CC Safety Net
Reason: git reset --hard destroys all uncommitted changes permanently.
Rule: git.reset-hard
```

```
BLOCKED by CC Safety Net
Reason: Access to a sensitive path is not allowed.
Rule: secret.basename.env
Segment: /tmp/khong-ton-tai-ccsn/.env
```

The second is worth noting: the path **did not exist**, and it was still blocked.
The rule name says why — `secret.basename.env` matches on the basename, before
execution, so existence is irrelevant. That is the correct design for a guard, and
it means the probe carried no risk of exposing a real secret.

`git status --porcelain` ran normally, so the guard is not over-broad.

### `git push` is not covered, and this run nearly proved it the hard way

`git push --dry-run origin HEAD:main` was **not blocked**, exactly as documented.
Git itself refused it:

```
! [rejected]          HEAD -> main (fetch first)
```

Read that carefully. The command was a push of a feature branch **directly onto
`main`**, and the only thing that stopped it was git's fast-forward rule — because
`main` on the remote had moved ahead. No guard was involved. Had the local ref
been current, that push would have succeeded and put unreviewed work on the
default branch, bypassing the pull-request review that is now the entire review
gate.

So `git-hooks/pre-push` is retained, and this is empirical justification rather
than reasoning: the exposure identified in `decisions.md` is real, reachable in
one command, and unguarded.

### The stale marker was right, and the remote confirmed it

`fetch first` means the remote `main` holds commits the local clone does not —
a merge had landed. The `SessionStart` hook had already marked
`Default ref: origin/main ([redacted]…)  [STALE: 24h since fetch]`. The
pull-request number is in the project's record.

That marker was added on suspicion after §7 exposed the defect. It is now
independently confirmed by the remote itself. Freshness labelling earns its place.

### Blocked calls are invisible to this journal

`cc-safety-net logs` recorded both denials with rule names, timestamps and the
project path. `bin/delivery-evidence` recorded **two** Bash calls, not four — the
blocked pair never reached `PostToolUse`.

Neither log is sufficient alone:

| | attempted and refused | ran, with output |
| --- | --- | --- |
| `cc-safety-net logs` | yes | decisions only |
| `delivery-evidence` | **no** | yes |

A reviewer reading only the journal would conclude the agent attempted two
commands when it attempted four. The reader now says so explicitly in its own
output rather than leaving the omission to be discovered.

### Two more defects in the reader

**"no output captured" was ambiguous where it mattered most.** `git status
--porcelain` on a clean tree prints nothing, and empty output *is* the result. The
reader called that "no output captured", which reads as a capture failure. A
reviewer could conclude evidence was lost when the absence of output was the
evidence. Now split into two distinct statements.

**Tail-only selection dropped the important line.** With `-n 4`, the rejected push
showed four `hint:` lines and elided `! [rejected] HEAD -> main`. Test runners put
their summary last; git puts the error first and pads afterwards. Fixed to keep the
first two lines and the last `n`, with an explicit elision marker.

That is the third defect in this repository's own tooling found by running it, and
all three were found by *reading the output as a reviewer would* rather than by
checking whether the code ran. The tool ran correctly in every case.

---

## 11. What Grok Build actually inherits

`git fetch origin && grok inspect` in the reference consumer.

### The baseline is a merge commit, not the branch tip

```
[redacted]..[redacted]  main -> origin/main
```

`origin/main` is now `[redacted]`. §10 predicted it would read `[redacted]` — the
closure commit — and that was wrong: GitHub merged with a merge commit, so
the closure commit is a parent of the tip, not the tip. The next plan's
baseline is that merge commit. The SHAs and pull-request number are in the
project's record.

Small, but it is the same mistake shape one more time: a value predicted from a
model of how something works rather than read from the thing itself. The fix is
the one already built — the hook resolves it, so nobody has to predict it.

### Grok finds the project skill without help

```
Skills (55)
└ [redacted]    project
```

No symlink needed. The `.grok/skills/` workaround considered earlier is
unnecessary.

**Still unresolved:** which path it came from. `grok inspect` reports the scope as
`project` without a path, and Grok's compatibility table shows `claude → skills:
on`, so it may have arrived through the Claude scanner reading `.claude/skills/`
rather than through `.agents/skills/` directly. Functionally it does not matter
today; it matters if the thin Claude adapter is ever removed.

### Grok inherits Claude Code plugins, hooks included

```
Plugins (4)
└ cc-safety-net (user, enabled)  1 skills, hooks
Hooks (3)
└ file  plugin: cc-safety-net
```

`cc-safety-net` is **not** among the twelve agents it officially supports, and it
is loaded in Grok anyway, through Grok's zero-configuration reading of Claude
Code's plugin set. Same for the `codex` and `superpowers` plugins.

**Loading is not enforcing, and this is the open question that matters.** Two
reasons it could be inert:

1. Grok's hook timeout defaults to **5 seconds and fails open**. `cc-safety-net`
   spawns `node` on every tool call. A cold Node start is normally well inside
   five seconds, but a timeout here means the command runs, silently.
2. The deny formats differ. Claude Code expects
   `hookSpecificOutput.permissionDecision: "deny"`; Grok's documented form is
   `{"decision":"deny","reason":"…"}`. If `cc-safety-net` emits only the Claude
   shape, Grok may load the hook, run it, ignore its verdict, and fail open.

`grok inspect` cannot distinguish "loaded and enforcing" from "loaded and
ignored". Only running a command that should be blocked can.

### Grok loads no permission rules at all

```
Permissions
└ Source: (none)
└ 0 loaded, 0 skipped
```

Consistent with §10 in `findings.md` on the `--deny` rule that did not fire, and
another reason not to rely on Grok's permission layer for anything.

### Two incidental observations

**`Claude.md` is about 2 tokens.** It presumably contains only an import of
`Agents.md`, which Claude Code expands and Grok does not. The content still
arrives because Grok reads `Agents.md` directly at 418 tokens — so the outcome is
correct by a different route, not because the import worked. Anything that
depends on Claude Code's import expansion will not reach Grok.

**`/review` collides three ways** — bundled, `codex`, and again bundled — resolved
by Grok as `/bundled:review` and `/codex:review`. The consumer's delivery skill has a review
phase but its own distinct name, so it is unaffected. Worth knowing before naming
any future command `review`.

---

## 12. The safety rail does not reach Grok, and the fix is Grok's own sandbox

### Loaded, and inert

Both commands ran in Grok:

```
1. git reset --hard          → ran.  HEAD is now at [redacted] …
2. cat /tmp/…/.env           → ran.  No such file or directory
```

`grok inspect` reported `cc-safety-net (user, enabled) 1 skills, hooks` and listed
its hook. It is loaded and its verdict is ignored — fail open, exactly the risk
raised in §11. Grok is not among the twelve agents `cc-safety-net` supports, and
inheriting a plugin is not the same as honouring its protocol.

Most likely cause is the deny format, not the timeout: Claude Code expects
`hookSpecificOutput.permissionDecision`, Grok's documented form is
`{"decision":"deny","reason":"…"}`, and neither command was slow enough to hit a
five-second timeout. Not isolated by experiment, and it does not need to be — the
fix below does not depend on which cause it is.

**The general lesson, and it is the sharpest one in this file:** a configuration
listing is not a behavioural test. `grok inspect` answered "is it loaded" and was
read as answering "is it working". Those are different questions, and only the
second one matters.

### Grok's own sandbox covers most of it, with network intact

From <https://docs.x.ai/build/features/sandbox>:

| Profile | Filesystem read | Filesystem write | Child network |
| --- | --- | --- | --- |
| `off` | unrestricted | unrestricted | allowed | default |
| `workspace` | everywhere | CWD, `~/.grok/`, temp | **allowed** |
| `read-only` | everywhere | `~/.grok/` and temp | blocked |
| `strict` | CWD and system paths | CWD, `~/.grok/`, temp | blocked |

`workspace` allows child network. The objection that made sandboxing unacceptable
— tasks need the internet — does not apply to this profile. It is enforced by
Seatbelt on macOS, so it is not defeatable by rewording a command.

Secrets need a custom profile, and the documentation says so directly: built-ins
"do not permanently protect paths such as `~/.ssh`; use a custom deny list".

```toml
# ~/.grok/sandbox.toml
[profiles.delivery]
extends = "workspace"
deny = ["**/.env", "**/.env.*", "**/*.pem", "**/*.key",
        "~/.ssh/**", "~/.aws/**",
        "~/.claude/.credentials.json", "~/.codex/auth.json"]
```

`~/.grok/` must stay out of the deny list — the documentation notes it stays
writable under sandboxed profiles so sessions can persist.

### Resulting coverage, stated honestly

| Risk | Claude Code | Grok | Codex |
| --- | --- | --- | --- |
| `rm -rf ~/`, writes outside the repo | `cc-safety-net` | `workspace` sandbox | untested |
| reading `.env` and credential stores | `cc-safety-net` | custom `deny` list | untested |
| `git reset --hard` inside the repo | `cc-safety-net` | **uncovered** | untested |
| `.git` control-plane mutation | `cc-safety-net` | **uncovered** | untested |
| push to the default branch | `pre-push` | `pre-push` | `pre-push` |

The two Grok gaps are in-repository git destruction. The cost is bounded: the
workflow commits and pushes at every phase boundary, so the only thing at risk is
the candidate diff, and losing it costs one round rather than the work.

### One conflict resolved by a subtraction

`core.hooksPath` and the `pre-commit` framework could not coexist —
`pre-commit install` refuses to run when `core.hooksPath` is set. Dropping
`pre-commit` and `gitleaks`, now that secret protection is covered per harness,
removes that conflict. `core.hooksPath` is free to use, and `git-hooks/pre-push`
is the only rail here that is **harness-agnostic**: it sits in git, so one
`git config` covers all three harnesses at once.

That property was incidental when the hook was written. It is now the reason it
survives.

### Not doing

A shim translating `cc-safety-net`'s Claude-format verdict into Grok's format was
considered and rejected. It would mean owning a compatibility layer between two
formats neither of which is ours, breaking whenever either changes — and this file
already records four occasions where a format was inferred wrongly from one
observation. `cc-safety-net` was pushed to today and already ships twelve
integrations; an upstream request for Grok Build is the cheaper and more durable
route.

---

## 13. The sandbox holds for writes, and two of my own errors

### Writes outside the workspace are genuinely blocked

```
touch ~/ccsn-probe-ngoai-repo  →  touch: /Users/[redacted]/ccsn-probe-ngoai-repo:
                                  Operation not permitted
```

Seatbelt enforcing. `workspace` restricts writes to CWD, `~/.grok/` and temp, and
it does so at the kernel, which no rewording of the command can defeat. The
catastrophic risk in Grok — `rm -rf ~/`, writes anywhere outside the repository —
is covered.

### The secret test was invalid, and I designed it that way

```
cat /tmp/khong-ton-tai-ccsn/.env  →  No such file or directory
```

This proves nothing about the `deny` list. The test was built for
`cc-safety-net`, which matches a **basename before execution**, so a non-existent
path is still blocked. It was then reused unchanged against an **OS sandbox**,
which intercepts real syscalls. The error is `ENOENT`, not `EPERM` — the call
reached the filesystem and found nothing there. The sandbox may never have been
consulted.

A valid test needs a real file at a denied path, created outside the sandboxed
process so its creation is not itself the thing under test.

### `pre-push` was installed and ignored

```
hint: The '…/git-hooks/pre-push' hook was ignored because it's not set as executable.
```

`fs_write` does not set the execute bit. The README asserted none was needed
because "both scripts are invoked through `bash`" — which is true of the **plugin
hooks**, where `hooks.json` spells the command as `bash "…"`, and false of **git
hooks**, which git execs directly.

Worse than the omission: git *warned* and pushed anyway. The rail was absent and
the only signal was one hint line in a wall of output. Had `main` been
fast-forwardable the push would have landed. This is the third occasion in this
session where git's own fast-forward rule was the only thing between an unreviewed
branch and the default branch.

### One error class, five occurrences

Both defects this turn are the same shape, and it is now the dominant pattern in
this file:

| Fact, true somewhere | Applied where it is false |
| --- | --- |
| `Bash(git push *)` is a valid Grok rule form | it does not match `git push` |
| the hook payload lacked an exit code | so no source has one — it is in `error` |
| a basename test blocks a non-existent path | so it tests an OS sandbox too |
| plugin hooks need no execute bit | so git hooks need none either |
| `grok inspect` lists a loaded hook | so the hook is enforcing |

Every one was a correct fact about one mechanism carried across to a different
mechanism. None was a reasoning error inside its own domain. The correction is not
"be more careful" — it is that a mechanism boundary is where an assumption must be
re-tested, and mechanism boundaries here are frequent: three harnesses, plugin
hooks versus git hooks, pattern matchers versus kernel sandboxes, configuration
listings versus behaviour.

### `bin/delivery-doctor`

Added in response to the silent absence. It checks the things that were wrong or
could have been: the execute bit, whether `core.hooksPath` is set and points here,
whether `hooks.json` parses, whether the hook scripts parse, whether `jq` exists,
whether anything has been captured.

It also prints what it cannot check — whether an inherited guard is honoured, and
whether a sandbox deny rule fires — because the failures above were all cases of a
check that looked conclusive and was not.

---

## 14. Two rails that report as installed and do not act

`delivery-doctor` passed every check — execute bit set, `core.hooksPath` pointing
here, `hooks.json` parsing, four sessions captured. Then both rails under test
failed to act.

### `pre-push` did not run, and the test cannot say why

```
! [rejected]  HEAD -> main (non-fast-forward)
```

No `pre-push:` line anywhere in the output. Two candidate explanations, and this
run distinguishes neither:

1. `git push --dry-run` may not invoke `pre-push` at all.
2. Git may reject a non-fast-forward update **before** invoking the hook, so a
   push git will refuse never reaches it.

Both are plausible and neither is established. Naming a cause here would be the
sixth instance of the error already tabulated in §13, so it is left open.

The deeper problem is the test, for the third time in this session: the probe's
outcome was decided by something other than the thing under test. Pushing to
`main` cannot exercise the hook while git rejects that push on its own grounds.
Isolating it needs the hook invoked directly with a synthetic ref line, which is
exactly how git invokes it, and separately a push git would otherwise accept.

`delivery-doctor` verified everything checkable about the wiring and the rail was
still inert. That is the correct outcome for a wiring check, and it is a reminder
of the boundary printed in the doctor's own output: wiring is not behaviour.

### The hook now announces itself

A silent guard is indistinguishable from an absent one, which is how the missing
execute bit escaped notice. The hook now writes one line on stderr on every run,
whether it allows or refuses, plus a count of ref updates checked. Presence
becomes observable at the cost of one line.

### Grok's sandbox does not block reading a denied path

```
cat /tmp/ccsn-probe/.env  →  FAKE_TOKEN=not-a-real-secret
```

This test **was** valid: a real file, created by the user's own shell rather than
by the sandboxed process, at a path matching `**/.env` in the profile's `deny`
list, with `--sandbox delivery` in force. The same profile blocked
`touch ~/ccsn-probe-ngoai-repo` in §13, so it was loaded and active.

Candidate causes, none established: `deny` may govern writes only — the profile
table lists filesystem read and write as separate columns and `workspace` reads
"everywhere"; or the glob may not match; or Seatbelt path rules may not follow
`/tmp` through its symlink to `/private/tmp` on macOS.

What is established is the part that matters for the decision: **there is no
verified way to stop Grok reading a secret from disk.** That belongs in the
coverage table as uncovered, not as probably-handled.

It is consequential rather than theoretical. A consuming project keeps a
secret file in tree — its own record names the path and the plan that failed
on it — and Grok runs the implement phase under `--always-approve`, so
nothing stands between a session and that file.

Untried option: Grok's `[permission]` rules. `grok inspect` reported
`Permissions: Source: (none), 0 loaded`, so they have never been configured in
this environment. A `Read(**/.env)` deny is pattern-based and therefore weaker
than a kernel rule, but read paths are a far narrower surface to enumerate than
command spellings, which is where every previous pattern attempt failed.

### Running total

| Rail | Claude Code | Grok | Codex |
| --- | --- | --- | --- |
| destructive git and filesystem | `cc-safety-net`, verified | uncovered in-repo; writes outside blocked | untested |
| reading secrets | `cc-safety-net`, verified | **uncovered, verified uncovered** | untested |
| push to default branch | **unverified — hook did not run** | unverified, same hook | unverified |

Two of the three verified protections belong to one harness. The one rail intended
to cover all three has not yet been observed acting even once.

---

## 15. The push rail works, and the blind test is explained

### Hook logic is correct

Invoked directly with a synthetic ref line, exactly as git invokes it:

```
pre-push: delivery guard active (remote origin)
pre-push: refusing to push directly to main on origin — open a pull request
pre-push: refused. Nothing was pushed. Override deliberately with --no-verify.
exit=1
```

### Git does invoke the hook on `--dry-run`

```
pre-push: delivery guard active (remote origin)
pre-push: 1 ref update(s) checked, all allowed
 * [new branch]        HEAD -> probe-prepush-delete-me
```

So of the two candidate explanations in §14, the first is wrong and the second is
right: **git rejects a non-fast-forward update before invoking `pre-push`.** The
earlier push-to-`main` probe never reached the hook because git refused it on its
own grounds first. The rail was never broken; the test could not see it.

### The protection is verified, by composition

The dangerous case — a push to `main` that git would otherwise accept — has not
been observed directly, and deliberately so: observing it means either landing
unreviewed work on the default branch or contriving a repository state to avoid
that. Both halves are established instead:

- git invokes the hook for a push it will accept (test B)
- the hook refuses a `main` refspec (test A)

Stated as composition rather than as a direct observation, because that is what it
is. It is the one inference in this file drawn across a boundary on purpose, and
the boundary is git's own documented hook contract rather than a third party's
undocumented payload.

The announcement line added in §14 is what made both tests readable. Without it,
test B would have printed only git's output and proved nothing.

### Grok's permission rules load

```
Permissions
└ Source: /Users/[redacted]/.grok/config.toml (config)
└ 4 loaded, 0 skipped
```

They had simply never been configured — `0 loaded` in §11 meant absent, not
unsupported. This also confirms the §10 correction: the `--deny 'Bash(git push *)'`
failure was the pattern gap, `git push *` not matching a bare `git push`, and not
a missing permission layer.

**Loaded is not enforcing**, which is the §12 lesson applied to itself. Four rules
parsed and accepted says nothing about whether a `Read(**/.env)` deny stops a read.
One command settles it, and the fixture from §13 is still on disk.

### Coverage after this turn

| Rail | Claude Code | Grok | Codex |
| --- | --- | --- | --- |
| destructive git and filesystem | `cc-safety-net`, verified | writes outside repo blocked; in-repo uncovered | untested |
| reading secrets | `cc-safety-net`, verified | `[permission]` loaded, **enforcement untested** | untested |
| push to default branch | **verified** | verified, same git hook | verified, same git hook |

The push rail is the only one covering all three harnesses, and it is now the only
one verified for all three — because it lives in git rather than in a harness.

---

## 16. Grok's permission layer enforces, and the sixth error caught early

### Reading a secret is blocked, and the mechanism is broader than expected

```
Tool `run_terminal_command` was not executed:
Denied by permission policy: deny rule on read matching "**/.env"
```

The rule was written `Read(**/.env)` and it stopped a **shell** call. Grok's
permission model classifies the *operation*, not the tool name, so `Read(…)`
covers reading through `cat` as well as through a read tool. That is stronger than
the documented examples implied.

The Grok secret gap from §14 is closed. Coverage:

| Rail | Claude Code | Grok | Codex |
| --- | --- | --- | --- |
| destructive git and filesystem | verified | writes outside repo blocked; in-repo uncovered | untested |
| reading secrets | verified | verified | untested |
| push to default branch | verified | verified | verified |

Codex remains untested, but both mechanisms already exist for it: `cc-safety-net`
ships a `--codex` integration, and the push rail is in `git` and therefore already
covers it.

Worth noting against §12: the sandbox `deny` list did **not** block the read, and
the permission rule did. Two features that look interchangeable from their
documentation are not, and only running both distinguished them.

### The sixth instance, and the first that cost nothing

The ADR drafted this turn listed a product-actions document as needing
reconciliation with the new authority boundary, on the strength of its name.
Reading it first showed it inventories user-triggered product actions and
their confirmation dialogs. It has no bearing on agent Git authority. The
filename and the actions are in the project's record.

Same error class as the five in §13: a property inferred across a boundary, here
from a filename to a file's contents. The difference is that it was caught before
the ADR was handed to anyone, because the file was read rather than assumed. Had it
shipped, a worker would have been sent to reconcile a document with no reason to
change, and the plan's scope would have carried a file that does not belong in it —
which is the shape of the three plans in §1 whose allowed scope was wrong.

The ADR now states the exclusion explicitly, so the next reader does not repeat the
inference.

---

## 17. One manifest reaches three harnesses, and the guards close

### Distribution

`.claude-plugin/marketplace.json` with `"source": "./"` — the form copied from
`ponytail`, which is the same shape of package — serves all three:

| Harness | How it arrives | Verified by |
| --- | --- | --- |
| Claude Code | `claude plugin marketplace add <local path>` then `plugin install` | `Successfully installed plugin: delivery@delivery-tools` |
| Grok Build | inherits Claude Code's enabled plugins, no configuration | `grok inspect`: `delivery (user, enabled) 1 skills, hooks`, and the skill count moved 55 → 56 |
| Codex | `codex plugin marketplace add` reads the **same** `.claude-plugin/marketplace.json`, then `codex plugin add` | `delivery@delivery-tools  installed, enabled  0.2.0` |

A local path works everywhere; `marketplace add` only failed initially because the
manifest did not exist yet, not because local paths are unsupported. The
`.claude/skills/` adapter and the `.grok/skills/` symlink that were considered are
both unnecessary.

Note for anyone copying this: a `$schema` field pointing at a remote URL was
rejected by the editing tool in supervised mode. `cc-marketplace` omits it too, so
it is optional.

### Codex guard coverage closes

`cc-safety-net --codex` installs but does **not** enforce until the hook is trusted:
Codex requires reviewing a non-managed command hook and pressing `t` in `/hooks`,
matched against the hook's current hash. Before trusting, `cat …/.env` succeeded and
printed the fixture. After trusting:

```
hook: PreToolUse
error=Command blocked by PreToolUse hook: BLOCKED by CC Safety Net
Rule: secret.basename.env
hook: PreToolUse Blocked
```

### Final coverage

| Rail | Claude Code | Grok Build | Codex |
| --- | --- | --- | --- |
| destructive git in-repo | `cc-safety-net` | **uncovered** | `cc-safety-net` |
| writes outside the repository | `cc-safety-net` | `workspace` sandbox | `cc-safety-net`, plus `read-only` for review |
| reading secrets | `cc-safety-net` | `[permission]` deny | `cc-safety-net` |
| push to default branch | `pre-push` in git | same | same |
| merge | unguarded by design | same | same |

Every cell is an observation, not an inference. Grok's one gap is in-repository git
destruction: its sandbox permits writes inside the workspace by design, and the
inherited `cc-safety-net` hook is loaded but ignored there.

### The same lesson in three different mechanisms

An earlier run showed `git reset --hard` blocked in Codex before the hook was
trusted. Read carelessly that looks like the guard working. The message was
`fatal: Unable to create '.git/index.lock': Operation not permitted` — exit 128, an
OS permission error from the read-only sandbox, with no `PreToolUse` line anywhere
in the transcript. The hook had not run at all.

Three harnesses, three unrelated ways for a guard to be installed and inert:

| Harness | Installed | Why it did nothing |
| --- | --- | --- |
| Claude Code | `pre-push` at the configured `core.hooksPath` | no execute bit; git printed one hint and pushed |
| Grok Build | `cc-safety-net` inherited and listed | verdict format not honoured; fails open |
| Codex | `cc-safety-net --codex` reported installed | untrusted hook; trust is a separate interactive step |

None shares a cause with another, so no single check finds all three. What they
share is that the affirmative signal — a config listing, an install message, a
doctor's green line — was read as evidence of enforcement. Only a command that
should be refused, and *reading which mechanism refused it*, distinguishes the two.

Codex's trust prompt is the best-behaved of the three: it states plainly that the
hook is not yet active. The other two said nothing.
---

## 18. First real use of the skill, and it found three defects in its own contract

Claude Code session `[redacted]`, the reference consumer, branch `[redacted]`,
opened as a Control Session against the committed decision record and plan. Read
from the transcript, not from a report.

### Attribution is the first behavioural proof that a skill is in use

Every assistant message in the turn carries `attributionSkill: "delivery:delivery"`
and `attributionPlugin: "delivery"`.

§12 and §17 both turn on the difference between a configuration listing and
behaviour, and §17's coverage table was built entirely from commands that should be
refused. Skill loading had only ever been evidenced by a listing — `grok inspect`
showing a count, `plugin list` showing `enabled`. Attribution in the transcript is
the behavioural equivalent: it records that the skill was *selected and applied* for
a given message, not that it exists on disk. It is the cheapest available check and
it needs no probe.

### The identifier rail holds in the control role

Its first assigned job was to fill the plan's deliberately empty `Baseline` field.
It resolved `[redacted]` with git and committed it
separately as `[redacted]`, because a commit cannot record its own SHA. The rail had
only been exercised in worker roles before.

### Three defects, all in artifacts written by the designing session

None was found by a gate. All three were found by reading the mechanism.

**An ownership check cannot report removed ownership.** Both the decision record and
the plan said a document's ownership list "becomes empty because the path
it owned no longer exists". It declares four paths; only two are being deleted.
Two other paths survive — and the same plan makes one of them the single home
for this project's delivery facts, so it becomes more load-bearing, not less.
The document, the field and the surviving paths are in the project's record.

The instrument cannot see it. The owning-docs gate reports documents that own
changed code and were not updated. Empty the ownership and nothing is owned, so
nothing can be unreconciled, so **the gate goes green**. The instruction written for
the worker — prove with the owning-docs gate that an empty ownership list does not
break it — would have returned green and shipped the coverage loss silently.

This is §1's largest cause, an acceptance instrument that cannot discriminate,
appearing in a plan explicitly written to avoid it. The corrected acceptance row is
a grep of the frontmatter block, which is the only thing that can discriminate here.

**A result file written into the repository corrupts the candidate.** The prompt
first named `<repo>/.delivery-result.md`. The project's owning-docs gate counts
untracked files as changed paths — stated in its own docstring, because a new
module is exactly the case where its owning document has never been written. So
the handoff would have appeared as an unowned change in the candidate the
reviewer reads. The skill now requires prompt and result to live outside the
working tree.

**The skill's own example contradicted the sentence above it.** The worker
invocation block read `grok -p "$(cat prompt.md)"` directly beneath "Write the
prompt to a file. Never inline it in a shell argument." It also carried
`--no-auto-update`, which `grok --help` does not list — an unknown flag fails the
whole invocation rather than being ignored. Both fixed, and the durable rule added:
check flags against `--help`, because these CLIs drift between releases.

### The escalation discipline arrived unprompted, as in §5

Asked to show its prompt before dispatching, it also volunteered the three
judgement calls it had made and named which was likeliest to stall the round — the
ownership-list tension. That is the behaviour the skill asks for: say what you know and
what the options are, do not pick one.

### What this says about the design

The evidence rails caught nothing here, and that is the correct result rather than a
disappointment. All three defects were contract errors in prose, and no hook,
sandbox or gate reads prose for meaning. What caught them was a session that read
the mechanisms it was about to rely on — the gate script's docstring, the
frontmatter, `--help` — before acting on the contract.

The rails remove the failure classes a program can see: transcription, fabricated
evidence, pushing to the default branch. §1's three largest causes are all failures
of judgement about instruments, and this turn is the first direct evidence that a
reading-first control session is what addresses them.
---

## 19. First full dispatch cycle: what the rails missed

Control Session `[redacted]` dispatched implement to Grok Build and review to Codex.
Both workers returned. Measured from file mtimes, the transcript, and re-running the
invocations here.

### The ten-minute wait was the work, not a hang

Reported as a hang: Grok finished but Claude Code waited the full ten-minute tool
timeout. The evidence says otherwise.

`EXIT=0`, twice, from the dispatch's own `echo "EXIT=$?"`. Grok exited on its own
after 9m49s. A probe here — `grok --prompt-file` with a trivial prompt — returned in
5.7s and exited 0, so the flag does not hang either. The per-event clock times
are in the project's record.

What made it look like a timeout is that 9m49s lands eleven seconds inside a
ten-minute default. **The defect is real but it is headroom, not hanging.** A
slightly larger task gets killed, and the dangerous part is what that leaves behind:
the handoff was on disk nine seconds before the process ended, so a kill
in that window leaves a file that reads as complete. Hence the terminal line now
required at the end of a handoff — it is the only way to tell one from the other.

Worth separating from the diagnosis: the reported symptom was wrong and the
underlying risk was real. Fixing the reported symptom would have added a polling
state machine against a process that exits correctly.

### Neither dispatch pinned a model or an effort

```
grok  --prompt-file … --always-approve --output-format json --cwd …
codex exec -s read-only -C … -o … < …
```

No `-m`, no effort, in either. `~/.codex/config.toml` holds
`model = "gpt-5.6-terra"`, so the review ran on the config default while the human
had chosen a different model for exactly that phase. Nothing in the transcript is
wrong; the choice simply never reached the command line.

All three harnesses can pin both, verified from `--help`:

| Harness | Model | Effort |
| --- | --- | --- |
| Claude Code | `--model` | `--effort` (low…max) |
| Codex | `-m` | `-c model_reasoning_effort="…"` |
| Grok Build | `-m` | `--reasoning-effort`, alias `--effort` |

`codex exec -m gpt-5.6-sol -c model_reasoning_effort="high"` was run here and
reported `model: gpt-5.6-sol`. The id is valid and the combination works.

This is the *environment not pinned* cause from §1, second-largest in the log, and it
arrived through a gap the ADR opened deliberately. Model routing was dropped as the
human's choice recorded back at them, which was right. Dropping the routing table
also dropped any requirement to *state* the choice, which was not. Choosing and
recording are different acts.

### Read-only review cannot run the gates

The reviewer reported all five `uv` gates exiting 2 because the read-only sandbox
prevented `uv` initialising `~/.cache/uv`, and called it a sandbox limitation rather
than a gate failure. Correct, and the obvious workaround does not work either:

```
codex exec -s read-only --add-dir /tmp/probe-uvcache …
  → error: Failed to initialize cache at `/tmp/probe-uvcache`
    Caused by: failed to open file `…/CACHEDIR.TAG`: Operation not permitted (os error 1)
```

`--add-dir` does not grant write under `-s read-only`. So the review contract as
written — read-only *and* reproduce the gates — is not satisfiable on this harness.
Resolved in the skill by separating the two purposes: independent judgement is what
review uniquely supplies, protection against a fabricated gate result is better
served by running gates where they are journaled.

Incidental, and a nice confirmation: the probe's own model noticed that `tail`
swallowed the exit code and said the pipeline reported 0 while `uv run` failed. That
is the `$?`-after-a-pipe hazard the skill warns about, observed unprompted.

### The journal does not cover the phase where gates run

The journal directory holds one file from the dispatch window, named for the
**control** session. Grok's five gate runs produced nothing. Of the 26 recorded
events, the four whose output matches gate-summary patterns are all the control
session reading files — `sed -n` on the gate script, `cat` of the result files.

The rail exists so a gate claim is checkable at the tool layer, and here it watched
the orchestrator, which ran no gates, while the worker ran all of them.

**Correction, from one more probe.** The first draft of this section concluded that
workers are never journaled. That is too general, and it is the fifth time in this
file a shape has been stated from one observation. A `claude -p` worker was then run
with a single `echo`, and it produced its own journal file containing the marker. So
the boundary is not control-versus-worker, it is **which harness**: Claude Code
journals in either role, Grok and Codex journal in neither.

That makes the gap narrower and the fix concrete. Gate evidence is checkable when
gates run in Claude Code and is a bare claim otherwise, which turns the role matrix
into something with a constraint in it rather than a free choice: the phase that runs
gates wants the harness whose hooks record them. §4's fabricated `pytest` summary line
remains unmitigated only for gates run outside Claude Code.

Stated plainly because it is the sharpest gap found so far: **the evidence layer
declared complete in §9 is complete for one session and empty for the sessions that
matter.** §9's table is still accurate about what a hook payload carries. It was read
as a statement about delivery, and delivery spans processes that hook does not enter.

Same shape as §12 and §13 — a property true of one mechanism carried to another
without re-testing. Here the boundary is a process boundary, which is easier to miss
than a harness boundary because both sides are the same harness's plugin.

### What worked

The reviewer earned its place in one round. It found a contradiction no gate could:
task 4 required `grep -rn` for the consumer's delivery skill to come back clean outside decision
records, while forbidden scope protected `delivery-log.md`, which carries the phrase
in a heading describing corrections to the old skill. The plan required an outcome
and forbade the only change achieving it — the *allowed scope omitted a file its own
tasks required* cause, third-largest in the log, in a plan written to avoid it.

It also confirmed the corrections from §18 landed: the ownership list was
exactly the two required paths, the project's ownership map covered both, and
the guard-coverage table matching this file's section 17 including both
caveats. The field and filename are in the project's record.

Three of the four defects this turn were found by reading, one by re-running the
invocation. None was found by a hook, a sandbox or a gate.
---

## 20. Dispatched Codex sessions are persisted but unlisted, and the model was recorded all along

### The picker filters, the store does not

A dispatched Codex review was reported as missing from `/resume` while sessions run
directly in the CLI were visible. The session is not missing.

| Where | Present |
| --- | --- |
| `~/.codex/sessions/2026/08/20/rollout-…-01a01d65-….jsonl` | yes |
| `state_5.sqlite` `threads` row | yes |
| `session_index.jsonl` | no — and that file stopped being written on 2026-08-17 |
| `codex resume` picker | no |

`codex resume` documents itself as resuming "a previous **interactive** session", and
the `threads` row explains the filter: `source = exec`, `has_user_event = 0`. A
session that was never typed into is not an interactive session.

It is fully reachable, two ways. `codex resume <SESSION_ID>` takes a UUID and skips
the picker, and `codex resume --all` drops the cwd filtering the picker applies by
default. The id is printed by the dispatch itself — `session id: 01a01d65-…` appears
in the exec log — so the fix is to capture it rather than to change anything.

Worth separating from the report: the comparison that made this look like a Codex
defect was between a dispatched session and older sessions, but the older session
checked here is *also* `source = exec` with `has_user_event = 0`. Whatever the user
was seeing in the picker, it was not the difference between harnesses.

### Codex records the model and effort of every session

```
id = 01a01d65-…   model = gpt-5.6-terra   reasoning_effort = high
```

This is a third-party record of what actually ran, written by the harness rather than
claimed by the agent. It independently confirms §19: the review ran on the config
default rather than on the model chosen for that phase.

It also adds a capability the evidence layer did not have. Claude Code records the
model per message in its transcript; Codex records model and effort per thread in
sqlite; Grok is unknown. So a *model* claim is checkable on two of three harnesses,
which is better coverage than gate output has.

### Every id and effort level, read from the harness

| Harness | Models | Effort levels |
| --- | --- | --- |
| Claude Code | aliases `opus`, `sonnet`, `fable`, or a full name | `low medium high xhigh max` |
| Codex | `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4` | `low medium high xhigh ultra max` |
| Grok Build | `grok-4.6` (default), `grok-4.5` | `low medium high xhigh` |

Grok validates both and says so usefully: an unknown model returns `unknown model id`
with a pointer to `grok models`, and an unknown effort returns the valid set inline.
The vocabularies are **not** identical, so an effort level valid on one harness is not
automatically valid on another — the same mechanism-boundary hazard tabulated in §13,
in a place where it would fail loudly rather than silently.

### Tiers in the skill, names in the project

The founding ADR dropped a model and effort routing table as the human's choice
recorded back at them. A per-phase policy has now been asked for, and it is worth
being explicit that this does not re-add what was dropped.

What was dropped was the skill choosing concrete models. What is added is the
*reason* a phase wants a capability tier: control and review buy judgement, implement
buys throughput on a task already specified, release is mechanical. That reasoning is
portable and a new consumer benefits from it. The names are environment facts that
differ per harness and change with each release, so they live in `AGENTS.md`.

Same split as the delivery log, decided earlier for the same reason: the skill owns
the shape, the project owns the values. §19 established that omitting the pin costs a
round; this establishes what to pin it to and where that decision lives.
---

## 21. The evidence rail gets used as designed, and the reviewer audits it

Round 2: implement on Claude Code, review on Codex read-only. Disposition `ACCEPT`.

### The journal fix from §19 works end to end

Moving the gate-running phase to Claude Code was the fix for §19's blind spot. It
holds. The implement session wrote `c5147e2e-….raw.jsonl`, 29 events, containing all
five closure gate commands with their output verbatim.

The part that matters is what the reviewer then did with it: it read the journal and
reported each gate's summary line from there rather than from the handoff's prose.
The consumer test-suite counts and the reconciled-path counts are in the
project's record. First time the evidence layer has been consumed by a
downstream reader instead of merely written.

### The reviewer audited the evidence layer and found two overstatements

Both in the handoff, neither affecting the candidate, and both worth fixing upstream.

**It cited the wrong journal session.** A worker had no way to know its own session
id: `session-start-context.sh` resolved everything from `git` and never read its own
hook payload, where `session_id` sits. So the one identifier the session could not
derive was the one it guessed — the exact failure class this hook exists to remove,
displaced from git onto the evidence layer. The hook now reads the payload and
injects both the session id and the full path to that session's journal file.

**It implied tool-captured exit codes for passing gates.** There are none. §8
established that `PostToolUse` carries no exit code and that a zero is implied by
which event fired; the numbers in the report came from the worker's own `EXIT=$?`
echoes. Accurate evidence, misattributed source. The hook's injected text and the
skill now both state the split: journal for output, the command's own echo for an
exit code.

A reviewer catching a defect in the instrumentation rather than in the candidate is
new here, and it is the strongest argument yet for review being a separate session
with a different model.

### `delivery-doctor` reported a failure for a correct state

Run inside the package repository it printed `FAIL core.hooksPath is not set — the
pre-push rail is not installed`. That repository has no remote, so a push guard has
nowhere to fire and its absence is correct.

Third occurrence of the pattern in this file and the second inside this package's own
tooling: §9's reader printed a false warning about unrecoverable stdout, and §10's
reader called an empty result a capture failure. A false warning is not a harmless
inverse of a false pass — it sends work against a problem that does not exist, and it
teaches a reader to skim the tool that was built to be read carefully. The doctor now
reports the rail as not applicable when there is no remote, and still verifies
`core.hooksPath` wherever one exists.
---

## 22. The plan closes, and the skill that produced it was never the skill on disk

The plan closed after four rounds. The project's record holds the
dispositions, the pull request, the ownership outcome and the delivery-log
row. Verified there rather than from the reports.

### The harnesses were running a cached copy the whole time

```
source                                     347 lines
~/.claude/plugins/cache/…/0.2.0/SKILL.md   217 lines
~/.codex/plugins/cache/…/0.2.0/SKILL.md    217 lines
```

Both caches contain zero occurrences of `END OF HANDOFF`, of `reasoning_effort`, and
of the phase capability table. Every rule added during this plan — pinned model and
effort, the handoff terminator, the journal precision, the tier table, session id
capture — reached no session at all. Installing a plugin from a local path **copies**
it at a version; editing the source does not update the copy.

So the disciplined behaviour observed across four rounds came from the dispatch
prompts, not from the skill. That is worth stating plainly because it invalidates the
obvious reading of §18 through §21. Those sections show a control session behaving
well while reading the mechanisms it relied on; they do not show the skill's new text
working, because that text was never loaded.

Sixth instance of this file's dominant error, and the most consequential: a property
true of the source tree was assumed true of what the harness reads. The two are
connected by a copy step nobody invoked. Version bumped to `0.3.0` so an update has
something to compare against.

### Codex journals after all, and the reader could not read it

§19 concluded gates are journaled only in Claude Code, and §21 repeated it. Wrong.
A Codex `exec` probe produced `01a01db9-….raw.jsonl`, and the round-3 review session
journaled too. What actually distinguishes the harnesses:

| Harness | Journals | Payload `tool_response` |
| --- | --- | --- |
| Claude Code | yes, control and worker | object with `.stdout`, `.stderr` |
| Codex | yes, once its hooks are trusted | **a bare string** |
| Grok Build | no | n/a |

Round 1's review left no journal and round 3's did, which fits §17's finding that
Codex hooks do nothing until trusted in `/hooks`. Grok remains the only harness that
does not journal.

`bin/delivery-evidence` read `.tool_response.stdout` unconditionally and died on the
string form with `Cannot index string with string`. Now normalises both and reports
which shape it found.

### The reader had been dead since section 10

Before any of that, the script would not parse at all:

```
bin/delivery-evidence: line 164: syntax error near unexpected token `)'
```

The jq program is a single-quoted shell string, and the §10 fix introduced the words
`the tool's result` and `that guard's own` into it. Each apostrophe closed the string.
The tool built to keep evidence honest had been completely non-functional for every
turn since, and nothing noticed because nothing ran it — `delivery-doctor` checks that
the two hook scripts parse and not that the readers do.

### The journal was destroying its own largest records

Four of 22 events in the round-3 Codex journal are unparseable. At column 4110 of one
line, a record ends mid-string and the next begins: two concurrent appends interleaved.
`jq` writes in roughly 4 KB chunks, so any payload above that arrives as several
writes and another hook can land between them.

The payloads that exceed 4 KB are gate outputs. A rail built so gate evidence could be
checked was silently shredding exactly the gate evidence and nothing else.

Fixed by writing one file per event into a per-session directory — no append, so no
interleaving, and no lock either. A lock was rejected: macOS has no `flock`, and a
lock that a crashed hook fails to release would make every later hook wait, against a
contract that says this hook must never delay or fail a turn. The reader takes both
layouts, and on a legacy file it now skips damaged records and says how many were lost
instead of aborting the whole read.

### Watching a dispatched worker needs no new tool

Measured on a live `codex exec`: the redirected log grows as the run proceeds — 471,
682, 790, 971, 1154, 1295, 1374 bytes, then flat at completion. The content is
readable as it lands, carrying the model, effort and sandbox in its header, then each
command with its output and duration.

So the answer to watching Codex is `tail -f` on the file the dispatch already writes.
The picker was never the way in.
---

## 23. Orca probed: the dispatch layer is real, worker death is invisible

Orca 1.4.185, orchestration RPC against a live runtime. Every line below was run,
not read from documentation. Probe repo `/tmp/orca-probe` in its own Orca worktree so
the reference consumer was never touched.

### Model and effort pinning: yes for Claude, no for Grok

```
launch: {requested: {agent: claude, model: sonnet, effort: low},
         effective: {agent: claude, model: sonnet, effort: low}}
```

Confirmed behaviourally, not just echoed: the worker's own banner read
`Sonnet 5 with low effort`, in the worktree, with `bypass permissions on`. The
`requested` versus `effective` split is exactly what the "record what actually ran"
rule wants, supplied by the substrate.

Grok is refused outright:

```
Agent grok does not support launch-time model selection.
```

The workaround runs: create the terminal with the flags baked in
(`orca terminal create --command "grok -m grok-4.6 --reasoning-effort medium"`), then
`worker-start --terminal <handle>`. It works, and the cost is precise — `launch`
comes back `{agent: null, model: null, effort: null}`. The process is pinned and
Orca's provenance does not know it. Two notes from getting there: `--terminal`
resolves the worktree from the coordinator's context rather than the terminal, so
`--worktree` must be passed too; and `worker-start` refuses a terminal that is not
running a recognised agent (`agent_unconfigured`), so a plain shell cannot be dressed
up as a worker.

### The delivery hooks survive Orca, and record Orca

An Orca-launched Claude worker produced journal directory
`1dd45460-cfb8-46d2-85c3-650a03033026` in the per-event layout from §22, read cleanly
by `bin/delivery-evidence`:

```
$ echo ORCA_PROBE_MARKER_7731
  status: completed, exit 0, 394ms
  stdout, verbatim, 1 of 1 non-blank line(s):
    ORCA_PROBE_MARKER_7731
$ orca orchestration send --dispatch-capability dcap_… --type worker_done
  --outcome succeeded …
```

Two things follow. Orca does not displace the evidence rail: it runs the real CLI, so
the plugin hooks fire inside it. And the journal captures the orchestration protocol
as well as the gates, so `worker_done` is checkable at the tool layer rather than
taken on the coordinator's word.

Grok produced no journal, as §21 predicted. Orca changes nothing there.

### `worker_done` has authority, and the mailbox is at-least-once

The payload is structured — `{"taskId":…,"dispatchId":…,"outcome":"succeeded"}` — and
sending it requires a `dcap_…` capability token, so it is not a string a worker can
assert. The injected preamble mandates `--outcome succeeded|failed`, forbids
encoding failure in prose only, and requires both ids "so a late completion from a
failed retry cannot complete the current dispatch". This is careful work aimed at the
failure modes this file already records.

One hazard for a coordinator loop: an unacknowledged Delivery **replays**. `--ack`
takes a `<delivery_id>`, and calling it bare does nothing. Two waits in a row
returned the same `worker_done` until the id was supplied. A naive loop spins on the
first message forever.

### `input_accepted` is not `input_submitted`

`worker-start` returned `state: ready, stage: input_accepted` and the task text was
typed into the agent's input box and left there. Three minutes later the worker was
still idle, `last_heartbeat_at: null`, `check --wait` returning `count: 0,
timedOut: true`. One `orca terminal send --enter` started it immediately.

It did not reproduce when the terminal already existed — a Grok worker attached to a
terminal created twelve seconds earlier submitted at once. So it is a TUI-boot race in
`--agent` launches, not a universal defect. It is still a green signal that is not
enforcement, which is this file's oldest theme.

### Worker death is invisible, and the guidance says to keep waiting

The decisive probe. A recognised Grok worker was attached, then its process was
`SIGKILL`ed. Ninety-five seconds later:

| Field | Value |
| --- | --- |
| `dispatch.status` | `dispatched` |
| `failure_count` | `0` |
| `last_failure` | `None` |
| `worker.state` | `ready` |
| `terminal.status` | `running` |
| `orphaned` | `false` |

Meanwhile the terminal tail Orca itself serves contains the evidence:

```
❯ [1]    75831 killed     grok -m grok-4.6 --reasoning-effort low
✘ [redacted] ~/orca/workspaces/orca-probe/probe-w1
```

Orca models **terminal** liveness, not **agent** liveness. Killing the agent leaves
the PTY alive, so every health field stays green while nothing will ever complete.

This matters because of what the documentation instructs: treat a `check --wait`
timeout or `{count:0}` as a checkpoint rather than a worker failure, and keep using
rolling waits. Followed literally against a dead worker, a coordinator waits forever.

The skill's existing escalation rule is the thing that saves it: *the worker failed
rather than returned a stop status — a failed worker is not a `BLOCKED` worker, and
treating one as the other loses the work.* Our own shell dispatch detects this in one
field, the process exit code. On this axis the hand-rolled mechanism is stronger, and
that is the first time in this evaluation that has been true.

### Coordinator identity is looser than expected

`run-create` and `task-create` succeed from an ordinary shell — Orca issues a
synthetic `term_…` handle and the binding survives across separate shell invocations.
`worker-start` does not: it needs `--from <handle>` or `ORCA_TERMINAL_HANDLE`. So a
control session outside Orca can own a Run but must carry a handle to dispatch. The
handle it was given pointed at a pane for the reference consumer, which is a placement to verify rather
than trust before any real use.

### Consequence for the role matrix

Grok is now the weakest link on both evidence axes at once: it does not journal, and
its model cannot be recorded by the orchestrator. Claude Code does both. That is a
converging argument the probes produced rather than a preference — if implement and
release move to Claude Code, gate evidence and model provenance both become
checkable, and Grok stays where neither is needed.

### Left behind

Orca has `repo add` but no `repo remove`, so `orca-probe` remains registered against
a deleted path and must be removed from the desktop UI. An empty probe Run also
remains: Runs cannot be deleted individually, and `orchestration reset` only offers
`--all|--tasks|--messages`, which would clear state belonging to the user.
---

## 24. Grok never ran a plugin hook, and its payload is the best of the three

Keeping Grok for implement and release needed two things it appeared not to have:
gate evidence and a record of which model ran. Both were already there.

### Grok dispatches no plugin hooks at all

`grok --debug-file` settles what §11, §12 and §19 each guessed at differently. The
plugin is discovered correctly:

```
plugin discovered name=delivery scope=user
  root=~/.claude/plugins/cache/delivery-tools/delivery/0.3.0 skills=1 has_hooks=true
```

Then 18 hooks load and the only ones that ever run come from two places:

```
hook_name=global/orca-status:post_tool_use[0].hooks[0]
hook_name=global/settings:post_tool_use[0].hooks[0]
```

`~/.grok/hooks/*.json` and `~/.claude/settings.json`. Not one plugin-bundled hook was
dispatched — not `delivery`, not `cc-safety-net`, not `codex`, not `superpowers`, all
of which report `has_hooks=true`.

This replaces the explanation this file carried for four sections. §12 concluded that
Grok honours the cc-safety-net hook and ignores its verdict, and reasoned about deny
formats and five-second timeouts. The truth is simpler and broader: **Grok never
called it.** Every plugin-bundled guard is inert there, and the deny-format theory was
an explanation for something that never happened.

Its own documented hook locations table said so all along — plugin hooks are listed
as `Per-plugin` trust while `~/.grok/hooks/*.json` is `Always`. Reading the table was
never a substitute for reading the log.

### The fix is one file in a location it already reads

`~/.grok/hooks/delivery.json`, same schema as `hooks/hooks.json`, absolute paths
because `CLAUDE_PLUGIN_ROOT` is a plugin variable and this is not a plugin hook. Orca
had already installed itself the same way, at `~/.grok/hooks/orca-status.json`, which
is the working example that was sitting in the directory the whole time.

The first run then filed everything under `unknown`: Grok sends `sessionId`, not
`session_id`, so the journal script's fallback caught every event. One `//` fixed it.

### Grok's payload carries what the other two do not

```json
{"hookEventName":"post_tool_use","sessionId":"01a01e1a-…","cwd":"/private/tmp/gh-probe",
 "toolName":"run_terminal_command",
 "toolInput":{"command":"echo GROK_HOOK_TEST_9911","description":"…"},
 "toolResult":{"output_for_prompt":"exit: 0\nGROK_HOOK_TEST_9911\n","exit_code":0,
               "signal":null,"timed_out":false,"total_bytes":20,"output_file":"…"},
 "permissionMode":"bypassPermissions","transcriptPath":"…"}
```

camelCase throughout, and `toolResult.exit_code` is **a real number on the success
path** — the field §7 and §8 established Claude Code does not provide. It also carries
`signal` and `timed_out`. Three vocabularies now, mapped once in the reader:

| | Claude Code | Codex | Grok |
| --- | --- | --- | --- |
| keys | snake_case | snake_case | camelCase |
| result | `tool_response` object | `tool_response` **string** | `toolResult` object |
| exit code | in `error`, failure only | same | `exit_code`, always |
| failure signal | which event fired | which event fired | non-zero `exit_code` |

Verified end to end: a Grok run of `echo`, then
`bash -c "echo TO_STDOUT; echo TO_STDERR >&2; exit 5"`, read back as
`status: FAILED, exit 5` with both lines verbatim.

Keying the output selection on the failure verdict blanked every failed Grok command,
because only two of the three harnesses move output into `error` when a call fails.
Output selection now follows the payload shape and the verdict follows the exit code.

The closing note was wrong in the same way — it told a reader that a failed call
carries no `tool_response` and that the output is in `error`, which is false for Grok
and printed directly beneath Grok evidence that contradicted it. Fourth false warning
from this package's own reader, after §9, §10 and §21. The note is now split by shape.

### Model provenance was recorded by Grok all along

`~/.grok/sessions/<encoded-cwd>/<session-id>/summary.json`:

```json
{"current_model_id":"grok-4.6","reasoning_effort":"low","sandbox_profile":…,
 "head_branch":…,"head_commit":…,"created_at":…,"num_messages":…}
```

Written by Grok, not claimed by the agent, and reachable from the `sessionId` the hook
payload already supplies. So the gap that made Orca's null `launch.effective` look
disqualifying does not exist: Orca not knowing the model is irrelevant when the harness
records it itself.

All three harnesses now have a non-claim model record — Claude Code per message in its
transcript, Codex per thread in `state_5.sqlite`, Grok per session in `summary.json`.

### What this changes

Nothing forces a harness for evidence reasons any more. §23's conclusion that implement
and release want Claude Code was correct on the evidence available and is now void:
Grok journals, with better exit codes, and records its own model.

What remains is a wiring step that differs per harness and fails silently, which is
the shape this file has recorded more than any other. `delivery-doctor` now checks that
the Grok hook exists, parses, and points at this package.
---

## 25. cc-safety-net cannot be wired into Grok, and the reason is two mismatches

§24 established that Grok dispatches no plugin hooks, which raised the obvious follow
up: register `cc-safety-net` at `~/.grok/hooks/` the same way, and Grok's one remaining
guard gap — destructive git inside the repository — closes.

It does not. Probed by feeding payloads straight to the binary rather than by wiring it
and hoping.

### The verdict format and the input format fail on different flags

`cc-safety-net hook` ships seven integrations: `--agy-cli`, `--coding-cli`, `--cursor`,
`--gemini-cli`, `--copilot-cli`, `--hermes-agent`, `--kimi-code`. None is Grok. Feeding
each a Grok-shaped `pre_tool_use` payload for `git reset --hard`:

| Flag | Emits | Grok honours it? |
| --- | --- | --- |
| `--coding-cli` | nothing at all | n/a — silence is allow |
| `--agy-cli` | `{"decision":"deny","reason":…}` | **yes, exactly the right shape** |
| `--cursor` | `{"permission":"deny",…}` | no |
| `--copilot-cli` | `{"permissionDecision":"deny",…}` | no |
| others | nothing | n/a |

Grok's documented decision shape is `{"decision":"deny","reason":"…"}`, and only
`--agy-cli` produces it. So the output side has an exact match already shipping.

The input side is where it breaks. `--coding-cli` reads snake_case correctly — a
Claude-shaped payload for `git reset --hard` returns a proper, specific deny naming
rule `git.reset-hard`, and a payload for `git status` returns nothing, so it allows.
That is the guard working. Fed Grok's camelCase, it produces nothing at all: it never
finds `tool_name` or `tool_input`, so it has no command to judge and stays silent.
**Silence is allow**, and Grok's own documentation says only an explicit `deny` blocks.

`--agy-cli` reads snake_case far enough to echo `Command: git reset --hard` back, and
then denies with `command analysis failed unexpectedly` — for `git status` as well,
with nothing on stderr. A guard that blocks `git status` blocks all work.

So: the flag with the right output has a broken analyser here, and the flag with the
working analyser has output Grok discards.

### Why not build the shim

A shim would translate camelCase to snake_case on the way in and Claude's
`hookSpecificOutput.permissionDecision` to `{"decision":…}` on the way out. Two
translations, of two formats neither of which is ours, wrapping a tool that ships
neither integration. §12 rejected exactly this and the reason has not changed: it
breaks whenever either side moves, and this file already records six occasions where a
format was inferred wrongly from one observation.

The durable route is the one §12 named: an upstream request for a Grok integration.
The output shape already exists in `--agy-cli`, so upstream is close.

### Correction to §4, while it is in view

§4 blamed a Grok deny rule failing on the pattern gap — `Bash(git push *)` not matching
a bare `git push` — and drew the conclusion that a deny list over command strings is
defeated by rewording. That conclusion still stands on its own merits, but the
*incident* it was drawn from is now better explained: §24 showed Grok never ran the
plugin hook at all. The pattern gap was real in the rule text and irrelevant to what
happened.

### What is left open

Grok's `[permission]` layer does enforce — §16 showed `Read(**/.env)` blocking a read
through a shell command, classifying the operation rather than the tool name. Its
vocabulary is `Bash(...)`, `Read(...)`, `Write(...)`, `Edit(...)`, with a `Bash(git
commit:*)` prefix form alongside globs.

Whether a `Bash(...)` deny set can cover destructive git without being reworded around
is untested, and it is a different mechanism from the one this section probed. The
honest current state of the coverage table is unchanged: **in-repository git
destruction remains uncovered in Grok**, and the cost is bounded to one round because
the workflow commits at every phase boundary.
---

## 26. Coordinator fencing is safe, and the cache split is now the standing hazard

### Fencing verified, and it cannot half-act

The last cheap Orca stop condition. Two Orca terminals, `A` and `B`. `A` creates a Run
and holds it at `consumer_generation: 1`. `B` then runs
`run-use --id <run> --from B`:

| | before | after |
| --- | --- | --- |
| `coordinator_handle` | `A` | `B` |
| `consumer_generation` | 1 | 2 |
| `A`'s `run-current` | the Run | nothing |

`A` is not notified, and it does not need to be, because it cannot half-act. Its next
coordinator call fails loudly:

```
task-create --from A  →  run_required: No Run is bound. … No effects were applied.
check --run <B's run> →  consumer_fenced: This coordinator terminal is bound to
                         run_fe442c42c3b6, not run_3abd95493dbf.
```

`No effects were applied` is the part that matters. A fenced coordinator does not
partially mutate state and then discover it lost authority, which is the failure this
probe existed to rule out. One stop condition remains for Orca: the runtime dying
mid-round.

### The cache split, stated once so it stops recurring

§22 recorded four delivery rounds running against a skill from before that session's
rules, because installing a plugin from a local path copies it. The same condition was
live again this turn — four commits of rules sitting in the source while both caches
served the previous version — and it is now structural rather than accidental:

| Harness | Runs | Updated by |
| --- | --- | --- |
| Claude Code | cached copy at a versioned path | `claude plugin update delivery@delivery-tools`, then restart |
| Codex | cached copy at a versioned path | `codex plugin add delivery@delivery-tools`, then re-trust hooks in `/hooks` |
| Grok Build | the source scripts, via `~/.grok/hooks/delivery.json` | nothing — it is always current |

So Grok is always current and the other two are current only after two commands, one of
which silently revokes Codex's hook trust because trust is keyed to file content. A
mid-session edit to a hook script therefore reaches exactly one of three harnesses.

Pointing the Grok hook at a cache instead was considered and rejected: the cache path
carries a version number, so the hook file would need rewriting on every bump, which
trades a documented asymmetry for a step that fails silently. The README now states the
asymmetry where the install command is, and the version bump is the discipline that
keeps the three in agreement.

Both caches were brought to `0.4.0` and verified field by field — SKILL.md at 358 lines
with the Grok wiring rule present, the journal script carrying the `sessionId` fallback,
and the hook template shipped. Checking the content rather than the version number is
the lesson from §22 applied to its own fix.

### Confirmed after the 0.4.0 refresh

Behaviourally, not from a version string. One `claude -p` and one `codex exec`, each
running a single marked `echo` in a scratch repository:

| Harness | Journal | `tool_use_id` | Marker |
| --- | --- | --- | --- |
| Claude Code | `b9723267-…` | `toolu_01QTcTz…`, 622ms | `CC_VERIFY_0401` |
| Codex | `01a01e41-…` | `exec-35a167dc…` | `CX_VERIFY_0402` |

Codex's own log printed `hook: PostToolUse` four times, so the re-trust took. Grok was
verified in §24 and is unaffected by the refresh, because its hook file points at the
source scripts rather than at a versioned cache — the asymmetry recorded above, working
as described for once rather than biting.

All three harnesses now record gate evidence at the tool layer. That was the open item
behind every "the worker's account is a claim" caveat in this file.
---

## 27. Probe 5b: the runtime can die and the work survives. A backgrounded gate cannot be trusted

The last Orca stop condition, run end to end. A Claude Code worker was dispatched with a
900-second in-flight command, the Orca app was quit, reopened, and the completion
collected. Then the journal turned out to contain something worse than the thing being
probed.

### The probe is not hypothetical

`orca status` reports `remoteUpdateSupport: {"automatic": true}` and releases land every
one to two days. An app that updates itself on that cadence will restart mid-round. This
tests a scheduled event.

### Architecture: everything is a descendant of one process

```
sleep 900  ←  /bin/zsh  ←  claude  ←  -/bin/zsh  ←  /usr/bin/login  ←  Orca Helper 91346  ←  Orca 90463
```

So there is no way to kill "just the runtime" — the PTY host is an Electron helper and
the workers are its grandchildren. The probe had to quit the app.

### The work survives a graceful quit

`osascript -e 'quit app "Orca"'`, then eight seconds later:

| | after quit |
| --- | --- |
| main process 90463 | gone |
| PTY host helper 91346 | **alive** |
| `sleep 900` and its shell | **alive** |
| `orca status` | `reachable: false` |

The quit takes the Electron main process and leaves the whole worker tree running. What
dies is the control plane, not the work.

### And the completion still lands, across a new epoch

Reopened in five seconds with a **new** `runtimeId` (`ce596e10…` → `27feccf2…`). The
dispatch survived in the database, correctly recording the *old* epoch on the worker.
`worker-read` still returned the transcript. The pre-restart `heartbeat` was still in the
mailbox.

Nine minutes later the worker finished, sent `worker_done` using a `dcap_` capability
issued by the **dead** runtime, and the new runtime accepted it:

```
worker_done  {"taskId":…,"dispatchId":…,"outcome":"succeeded"}
dispatch: status completed, completed_at 08:46:22, failure_count 0
worker.runtime_epoch: ce596e10…   (current runtime: 27feccf2…)
```

**Probe 5b passes.** A graceful restart mid-round loses neither the work nor the
completion, and the bookkeeping stays honest about which epoch the worker came from. The
remaining unknown is a hard crash rather than a quit, which is a strictly smaller worry
now that a quit is clean.

### The coordinator binding is not durable without an explicit handle

Twice during setup, a Run bound from this shell became unbound with no event: `run-show`
reported the correct `coordinator_handle` while `check --run` answered
`consumer_fenced: no longer bound`. The cause is that `check` has no `--from` and
resolves "this terminal" from ambient context, which for a shell that is not a real Orca
terminal is not stable. `check --terminal <handle>` works and is the form to use.

For a real control session the rule is: pass the handle explicitly on every call, and get
it from a terminal you own. Relying on ambient resolution is how a coordinator ends up
silently unbound — the same implicit-resolution failure this file records everywhere
else.

### The finding that matters more than the probe

The worker's own journal recorded its 900-second command like this:

```
$ sleep 900 && echo PROBE5B_SURVIVED
  status: completed, exit 0, 414ms
  the command produced no output; that is the result reported by the tool, not a gap in capture
```

Every part of that is wrong, and the last sentence is one this package added in §10 to
fix an earlier false warning. The payload says why:

```json
"tool_input":  {"command":"sleep 900 && echo PROBE5B_SURVIVED","run_in_background":true}
"tool_response":{"stdout":"","stderr":"","backgroundTaskId":"bxdlg7ijw"}
```

Claude Code backgrounded it, so `PostToolUse` fired 414ms later with empty output. The
real exit code and output never reach the journal at all.

This is the worst failure shape available to an evidence rail: **a backgrounded gate is
indistinguishable from a gate that passed silently.** A slow suite is exactly what an
agent is tempted to background, and `uv run pytest` producing no output with exit 0
implied is a green light nothing can contradict. Five earlier sections in this file worry
about a worker fabricating a summary line; this needs no fabrication.

Both signals are in the payload, so the reader can refuse the claim, and now does:

```
$ sleep 900 && echo PROBE5B_SURVIVED
  status: DISPATCHED TO BACKGROUND after 414ms — this journal has no outcome for it
  the empty output is not the result. The call returned as soon as it was
  backgrounded as bxdlg7ijw, and its exit code and output are not in this journal.
  Treat a backgrounded gate as unevidenced.
```

The skill gains one rule with a mechanical reason rather than a caution: gates run in the
foreground, and the wait is the point.

Fifth false statement produced by this package's own reader, after §9, §10, §21 and §24.
The pattern in all five is the same and worth naming plainly: each was written to *fix* a
previous misreading, and each fixed it for the case in hand while asserting something
general. A reader that explains evidence is itself a claim about evidence, and it needs
the same suspicion as the worker's account it exists to check.
---

## 28. Monitor observation during a live design: the pipe hazard at scale

Recorded from outside a running plan, by a session acting only as an observer. Nothing
was changed in response, because changing the skill while a plan runs against it would
make the plan's contract move under it. This is an observation and a candidate, not a
decision. The plan id, session, branch, SHA, design frames and suite results
are in the project's record.

### The setup

A design phase opened as a Claude Code Control Session inside an Orca terminal,
`claude-opus-5` at high effort, session `[redacted]`. It read the governing
decision records, then ran the existing tests to measure the parity floor
rather than counting `it` blocks by eye.

That measurement is sound and was verified independently against the same
files. Baseline, branch and clean tree all check out. The evidence rail
worked on a real plan for the first time: 61 Bash calls journaled under the
control session's own id.

### What the journal showed that the summary did not

Its **first** test-runner invocation:

```
$ … npx vitest run … --reporter=basic 2>&1 | tail -20
  status: completed, exit 0, [redacted]
  stdout: a Vitest internal error stack, no summary line anywhere
```

Exit 0 on a run that failed, because of `| tail -20`. This is the hazard the skill
already names — `$?` after a pipe reports the last command in the pipe, not the gate —
appearing in the first gate-shaped command of the plan. It self-corrected by rerunning
without the pipe, so its conclusion stands. The rule did not prevent the mistake; the
retry did.

The scale is the part worth recording:

**35 of 61 journaled calls are pipelines reporting exit 0.**

Most are harmless reads. But it means any gate cited from a piped command in this plan
carries a meaningless exit code, and a reader has no way to tell the harmless majority
from the load-bearing few without inspecting each command.

### Third sighting, and the rule is not holding

One incident put the rule in the skill. §23 recorded a Codex model noticing `tail` had
swallowed an exit code during an Orca probe — caught, not lost. Now a control session
did it in its first command on a real plan. Three sightings, two self-caught, one
already answered with prose.

By this skill's own instruction to prefer a mechanism to a rule, the candidate is
mechanical and small: `bin/delivery-evidence` has the command text, so it can flag a
journaled call that contains a pipe and report that its exit code belongs to the last
stage. That is deterministic and needs no guessing about what a summary line looks
like. It does not stop anyone writing the pipe; it stops the exit code being read as
the gate's.

**Not done, deliberately.** The trigger for acting is this plan reaching closure, so the
change lands between plans rather than under one. Until then a reviewer should check
whether any gate evidence in the observed plan came through a pipe.
---

## 29. The review-isolation matrix mixed a missing-docs claim with a phase assignment

The role matrix in `harness-surface.md` said Claude Code had "no OS sandbox found"
and only a model-level `--disallowedTools` restriction, and the surrounding prose
concluded that read-only for review was strongest on Codex, which is why review
went there. That cell was treated as a verified capability. It was a documentation
miss.

First-party pages read on 2026-08-20, not a local enforcement probe of the
installed builds:

| Harness | Filesystem isolation | Child-process / command network | Native web / search |
| --- | --- | --- | --- |
| Claude Code | Sandboxed Bash: Seatbelt on macOS, bubblewrap on Linux/WSL2, covering Bash and children. Edit, Write, MCP and hooks still run on the host unless the whole process is wrapped. <https://code.claude.com/docs/en/sandboxing>, <https://code.claude.com/docs/en/sandbox-environments> | Sandboxed Bash has no domains pre-allowed. In-process `WebFetch` is not gated by that allowlist. | `WebSearch` and `WebFetch` are built-in in-process tools, permission-gated. <https://code.claude.com/docs/en/tools-reference> |
| Codex | `--sandbox read-only\|workspace-write\|danger-full-access`. Seatbelt / bwrap / Windows sandbox on spawned commands. <https://learn.chatgpt.com/codex/sandboxing> (the `developers.openai.com/codex/sandboxing` URL redirected here) | Command network off by default; `sandbox_workspace_write.network_access` and the network proxy apply to spawned commands. | Hosted `web_search` is independent of command network (`cached` default). <https://learn.chatgpt.com/codex/agent-approvals-security>, <https://learn.chatgpt.com/codex/web-search> |
| Grok Build | Profiles `off` / `workspace` / `read-only` / `strict`. `read-only` writes `~/.grok/` and temp only. <https://docs.x.ai/build/features/sandbox> | Child network blocked on `read-only` / `strict`, **enforced on Linux only, no-op on macOS**. In-process model API and web tools are not blocked by that setting. | In-process web tools; CLI `--disable-web-search` is independent of the sandbox profile. <https://docs.x.ai/build/cli/reference> |

Locally observed, and not transferred between harnesses:

- Codex `--sandbox read-only` refused `uv` cache writes at `~/.cache/uv` with
  `Operation not permitted`; `--add-dir` did not grant the write (`findings.md` §19).
- Grok sandbox `deny` globs do not block a read; `[permission]` does (`findings.md` §14, §16).
- Grok `workspace` permits in-repo writes, so in-repo git destruction stays uncovered
  (`findings.md` §12, §17).

What the old cell was not: a probe that Claude Code's installed build lacks Seatbelt.
What the new cells are not: proof that this machine's Claude Code sandbox is enabled,
that a given account's hosted web tool is on, or that Grok's macOS child-network
no-op was reproduced here. Documentation is not a local enforcement probe. Plugin
caches still run a copied version until refreshed (`findings.md` §22). Before a
project changes its review harness, probe candidate write denial, native web lookup
and final-result completion under that exact invocation.

The three harnesses therefore all document an OS sandbox, and they do not document
the same review boundary. A profile name such as `read-only` is not portable. That
is why the protocol now states candidate immutability rather than a universal
sandbox flag, and why this repository's Codex `--sandbox read-only` dispatch remains
a deployment selection rather than the definition of the phase.

---

## 30. Grok 1.0.5 still dispatches no plugin hook, and the upstream bug reproduces in the same run

Probe run 2026-08-21, authorised by the product owner. Grok `1.0.5 (5115b46bc909)`,
`grok-4.6`, effort `low`, single turn, session
`01a02206-53e5-7ce0-9caf-29e7e35abef0`. Debug log captured with `--debug-file`.

§24 concluded that Grok dispatches no plugin-bundled hooks. That was recorded before
1.0.5 shipped `plugin install`, `marketplace`, `validate` and `tag`, so the
conclusion was stale rather than wrong, and the adapter under `~/.grok/hooks/` was
about to be deleted on the assumption that a native plugin subsystem would dispatch
what it discovers.

### Method, and why a negative result is trustworthy here

A disposable plugin `delyhookprobe` was built in the scratch directory with the same
component shape the real package reports, `1 skill dir(s) … hooks`. Its `hooks.json`
registered two commands per event: one an absolute path into the scratch copy, one
through `${CLAUDE_PLUGIN_ROOT}`. Each appends a line to a marker file and exits 0.

The two-command design removes the false negative that would otherwise sink this
probe. A single hook written against `${CLAUDE_PLUGIN_ROOT}` cannot distinguish "the
hook never ran" from "the hook ran and died on an unexpanded variable", and the
package's own `grok-hooks.json.template` exists precisely because that variable is a
plugin concept. The absolute-path entry answers dispatch; the variable entry answers
expansion.

The existing `~/.grok/hooks/delivery.json` adapter was deliberately **left in place**
as a positive control. If no hook of any kind had fired, the probe would prove
nothing about plugins.

### Result

**Zero markers.** The marker file was empty before and after.

**The plugin was discovered, with hooks.**

```
INFO xai_grok_agent::plugins::discovery: plugin discovered name=delyhookprobe
     scope=user root=/Users/[redacted]/.grok/installed-plugins/hookprobe-24ec99ff
```

**The hook subsystem found nothing at all.**

```
INFO xai_grok_hooks::discovery: hooks: discovery complete total_hooks=0
     session_start=0 pre_tool=0 post_tool=0 session_end=0 stop=0 notification=0
     user_prompt_submit=0 subagent_start=0 subagent_stop=0
INFO xai_grok_workspace::handle: hook discovery complete hook_count=0 error_count=0
```

**Every hook that did run came from a `global/` source.** Counted from the log:

| Source | Dispatches |
| --- | ---: |
| `global/settings` (inherited `~/.claude/settings.json`) | 12 |
| `global/orca-status` | 8 |
| `global/delivery` (this package's adapter) | 2 — `session_start[0]`, `post_tool_use[0]` |
| any plugin | 0 |

`delyhookprobe` appears four times in the log, all four in `plugins::discovery`, and
zero times anywhere in the hook subsystem.

The positive control held: a new journal directory appeared for the Grok session id,
written by the adapter.

### Consequence

**The adapter stays.** §24's conclusion holds on 1.0.5. Native plugin management and
native plugin hook dispatch are separate features and only the first has shipped.
`hooks/grok-hooks.json.template`, the `~/.grok/hooks/delivery.json` install step and
the `delivery-doctor` check that fails without it are all still load-bearing. The
rename unit changes the adapter's path and nothing else about it.

This is the second time a Grok conclusion would have been wrong without a probe, and
both times the wrong conclusion was the optimistic one: §24 corrected "the plugin
reports hooks, so its hooks run", and this corrects "native install shipped, so
plugin hooks now dispatch". Discovery is not dispatch, and a changelog is not a probe.

### Two things the probe was not looking for

**The upstream bug reproduces on 1.0.5, and it fails open.**

```
WARN hook.run{hook_name=global/settings:session_start[0].hooks[0]}: hook failed
     hook_failure=hook not executed: required env var(s) not set: ${SYSTEMROOT}
WARN hook.run{hook_name=global/settings:pre_tool_use[0].hooks[0]}: hook failed;
     ignoring (fail-open) … ${SYSTEMROOT}
```

Better than the earlier evidence in two ways: the message names the missing variable
outright, and the source file is identified as `~/.claude/settings.json`. `fail-open`
downgrades the severity honestly — these are noise, not blocked sessions. The report
routed upstream should say so rather than describing 617 failures as an outage.

**A second Claude-compatibility gap, unrelated to this package.**

```
WARN xai_grok_hooks::config: hooks: skipped unrecognized event names (check for
     typos) file=/Users/[redacted]/.claude/settings.json
     skipped=["TeammateIdle", "PermissionRequest"]
```

Grok reads Claude's settings and silently drops events it does not implement. Worth
knowing before anyone concludes a Claude-compatible hook is wired on Grok because the
file was read.

### Incidental, and relevant to the rename

`grok plugin install <dir>` refuses a local directory without `--trust`, printing the
exact command to re-run. On success it **copies** the plugin into
`~/.grok/installed-plugins/<name>-<hash>/`, so Grok joins Claude Code and Codex in
running a cache copy rather than the source. The install source decision for `dely`
must account for `--trust` being required, and the probe did not establish whether a
git remote install prompts the same way.

---

## 31. Coordinator-first dispatch and unsandboxed review, after a real Control miss

Recorded 2026-08-21 from the first self-update Control run, not inferred from
documentation. The decision
`docs/decisions.md#interactive-workers-are-coordinator-first-review-independence-does-not-imply-a-sandbox`
holds the contract; this section holds the recurrence.

### Headless workers while a coordinator was selected

The Control Session launched six Codex and five Grok workers through their
headless entrypoints. After Orca was requested explicitly, the same headless
commands were placed in visible shell tabs rather than either harness TUI. Six
such commands were observed. No Orca Run existed.

That is the same failure class as treating `claude -p`, `codex exec` and
`grok --prompt-file` as the default launch path. A visible shell is not an
interactive harness TUI, and wrapping a headless process does not create
coordinator lifecycle. The skill's unconditional non-interactive recipe was the
instruction that produced this.

### Read-only review still blocked the work it was asked to do

Separately, Codex `--sandbox read-only` again blocked closure gates, result
writes and `worker_done`. The cost is the same one measured in §19: `uv` cannot
initialise its cache, `--add-dir` does not grant the write, and a reviewer under
that profile can judge a diff without reproducing a gate or reporting completion
through the coordinator.

No recorded review in this package's plans has modified the candidate it
inspected. The sandbox therefore paid a recurring cost against an unobserved
risk. Historical probes that showed Codex read-only blocking candidate writes
remain valid; they are not rewritten. What changed is which cost this project
pays before a reviewer mutation has occurred.

### What follows, and what does not

The portable skill now launches through a selected coordinator's native skill,
keeps headless recipes as fallback, and treats review independence as role
ownership. This repository records Orca, interactive TUIs, and Codex
`--dangerously-bypass-approvals-and-sandbox` in `AGENTS.md`. Installed copies
still run frozen 0.4.2 until review accepts and caches refresh; source text is
not yet the executing contract.

This is not a probe of every future coordinator or harness pairing, and it is
not evidence that a reviewer will never edit a candidate. Enforcement of
candidate immutability is reconsidered only after that incident. A second
coordinator is still required before extracting an adapter.

---

## 32. The forward smoke for `dely:setup`, and the one prediction it confirmed

Recorded 2026-08-21 after `0.6.0` merged as `9e41a03` and every installed copy was
refreshed. The decision
`docs/decisions.md` — "Project configuration is a managed block in `AGENTS.md`,
written by a second core skill `dely:setup`" — deferred these observations to
after installation, because every harness runs a copy taken at install time and no
static check in the delivering plan could reach them.

### All three copies carry the new skill

`claude plugin list` and `codex plugin list` both report `dely@dely 0.6.0`.
`grok plugin update dely` reported `dely-33aded9b: updated (2838092 -> 9e41a03)`,
and its installed root holds both `skills/delivery` and `skills/setup` with
`version 0.6.0`. Codex resolves the plugin directly from its marketplace snapshot
at `~/.codex/.tmp/marketplaces/dely`, so upgrading the marketplace updated the
plugin in place rather than needing a separate install.

The Grok adapter was regenerated from the derived root. The installed path did not
change across this version bump, so the previous adapter would have kept working —
but that is luck, not a property, and the regeneration is what makes it a
property. `delivery-doctor` then passed every check, including the new
`managed block well formed` line against this repository's own `AGENTS.md`.

### Discovery works from the description alone

In a scratch repository with no `AGENTS.md`, each harness was asked to configure
the project for a delivery workflow **without the skill being named**, and told to
run nothing and edit nothing.

| Harness | Answer |
| --- | --- |
| Claude Code | `dely:setup` |
| Codex | `dely:setup` |
| Grok Build | `/setup` |

Grok's bare form is correct there rather than a defect: its installed set is
`dely` and `superpowers`, and nothing else ships a `setup` skill, so there is
nothing to namespace against. Claude Code, which *does* also carry `codex:setup`,
returned the namespaced form. §11 recorded `/review` colliding three ways and
resolving as `/bundled:review` and `/codex:review`; the same mechanism is what
would disambiguate `setup`.

**The latent hazard is worth stating before it bites.** `setup` is a generic name.
The `delivery` skill was deliberately given a distinct one after the `/review`
collision, and `setup` did not get that treatment. A consumer that installs the
Codex plugin alongside `dely` in Grok will have two `setup` skills, and the bare
`/setup` observed here will stop being unambiguous. Nothing needs changing today;
this is the recurrence marker.

### The quick path writes a block the doctor accepts

`dely:setup` was invoked on the scratch repository with instructions to take the
quick path and ask nothing. It created `AGENTS.md` containing exactly one managed
block, coordinator `none`, all four phases pinned to `claude` with `default` model
and `default` effort. `bin/delivery-doctor` reported `ok managed block well
formed` against it.

Two observations from that run:

**The literal `default` survived the round trip.** The quick path wrote it and the
doctor accepted it, which is the behaviour the remediated case in
`tests/managed-block-contract.sh` asserts against a stored catalogue.

**A non-interactive quick path cannot offer the coordinator.** Orca is installed
and running on this machine, and the contract says an absent coordinator selection
offers Orca when it is genuinely available. The run was told to ask nothing, so it
wrote `none`. That is defensible under the instruction it was given, and it means
the coordinator offer is an interactive step that a headless invocation silently
converts into `none`. Anyone scripting setup should pass the coordinator
explicitly rather than assume the quick path discovers it.

The skill also volunteered the Claude Code limitation in its own output without
being asked, which is the design's stated limitation reaching behaviour.

### The predicted asymmetry, measured

The decision record predicted that the persistent instruction inside the managed
block would reach Codex and Grok natively and would not reach Claude Code, because
Claude Code does not read `AGENTS.md` and this repository has no `CLAUDE.md`.

Each harness was asked, in this repository, what the project pins the implement
phase to — told to read no files and run no commands, so only injected context
could answer, and to say `UNKNOWN` otherwise.

| Harness | Answer |
| --- | --- |
| Claude Code | `UNKNOWN` |
| Codex | Grok Build, `grok-4.6`, medium reasoning effort |
| Grok Build | Grok Build, `grok-4.6`, `medium` |

The prediction holds exactly. This is the first measurement of it rather than an
inference from `harness-surface.md`, and it is the boundary of what a managed
block in `AGENTS.md` can do: it configures every harness that reads that file, and
on Claude Code it is inert until the project adds a `CLAUDE.md` that imports it —
an import §11 already recorded as expanded by Claude Code and not by Grok, so the
two routes are not interchangeable and a consumer needs both.

### What this smoke still did not observe

Whether the managed block reaches a *dispatched* worker as pins on its command
line, which needs a real delivery through a project configured by `dely:setup`
rather than by hand. This repository's own block was written by the delivering
plan, not by the skill, so it does not test that path either.
