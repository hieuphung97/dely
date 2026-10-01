# Live checklist

A separate agent session runs this against a candidate installed from a
`git archive` snapshot, before review. Record every row's candidate SHA,
Orca version, harness version, model, effort, verdict and residue. A human
answers first-launch trust dialogs; Dely never answers them. `trust.sh`
can stand in for the human only for Claude Code.

## Input and release floor

- candidate SHA and checkout path;
- Orca running with orchestration enabled;
- each harness being tested installed and signed in;
- Node and `~/dely-probe/` writable.

Run the parameterized worker and Control rows for every supported harness
whose entry changed. If shared worker-launch code changed, run both rows for
**every supported harness** in the candidate's `harnesses.json`; skip Control
only when `controlWake` is `unsupported`, and record that reason. Each worker
row covers implementer and reviewer in separate sessions. For this candidate,
the shared launch changes require Claude, Codex, Cursor, Copilot, Antigravity,
Grok, OMP and Pi. Kiro stays deferred.

The release floor is those parameterized rows plus rows 4–9 and the rejected
message stub row. Rows 10–11 run when `start()` or the pin extension changes.
Rows 13–16 run when `start()`, the extension or the Pi entry changes, or Pi
upgrades. The parameterized Control row replaces the former OMP and Pi
Control rows. Rerun the parameterized rows and rows 4–5 after an Orca upgrade;
rerun OMP pin rows and its parameterized Control row after an OMP upgrade;
rerun Pi pin rows and its parameterized Control row after a Pi upgrade.
A release that skips required rows names them and the reason in its decision
record; structural gates cannot substitute for them.

## Step 1 — install the candidate from a snapshot

Never point a harness at the working tree. Take a snapshot, install from it,
and check what actually landed:

```bash
sha=<candidate SHA>
snap=~/dely-probe/.snap-$sha
rm -rf "$snap" && mkdir -p "$snap"
git -C <checkout> archive "$sha" | tar -x -C "$snap"
```

Install Claude Code and Codex CLI with their marketplace commands using
`"$snap"` as the marketplace source instead of the git URL. Watch the Codex marketplace: `codex plugin marketplace add` was
observed keeping a stale marketplace of the same name, installing the previous
version, and reporting success. Remove the marketplace and the plugin, then add
and install again.

**There is no snapshot install for Cursor Agent CLI.** `cursor-agent plugin
marketplace add` takes a git URL only — a local path is refused — and installing
what it indexes needs the interactive `/plugin` panel. Cursor reads the Claude
plugin cache, measured during the 2026-09-14 probe rounds, so a Cursor row runs
on the Claude install; confirm that rather than assuming it. It only holds once
every older Cursor copy is gone or already matches the snapshot hash:

```bash
find ~/.cursor/plugins/cache/dely \
     ~/.cursor/plugins/marketplaces/github.com/hieuphung97/dely \
     -name SKILL.md -path '*delivery*' -exec shasum -a 256 {} + 2>/dev/null
```

Anything there with a different hash wins over the Claude cache. Until it is
removed or refreshed, a row with Cursor in any role cannot run, and saying so is
the correct outcome for that row — not running it against whatever Cursor has.
On 2026-09-16 two such copies blocked every Cursor row of the 0.19.0 release.

For Copilot, Antigravity and Grok Controls, use the measured local installs:

```bash
copilot plugin install "$snap"
copilot skill list --json
agy plugin install "$snap"
agy plugin list
grok plugin install "$snap" --trust
grok inspect --json
```

Run only the commands for the harness under test. Verify both loaded skills
against the snapshot; for Grok check the resolved paths so a Claude import
does not substitute for the candidate. Copilot project or personal skills can
hide the plugin. Check Antigravity's fixed install directory
`~/.gemini/config/plugins/dely/` by hash and confirm `/dely:delivery` and
`/dely:setup` in its TUI autocomplete; `plugin list` alone gives no paths.
Record prior installs and restore them after the probe.

Install OMP from the snapshot for its Control or pin rows. OMP has no trust step.

```bash
omp plugin install "$snap"
omp plugin list --json
omp skill list --json
```

Ask OMP what it resolved. `omp skill list --json` must give `delivery` and
`setup` with `source` `omp-plugins:user` and `filePath` under the linked
`dely` package. Then SHA-256 of those resolved `SKILL.md` files, of
`scripts/dely.js` next to `delivery`, and of `extensions/dely-pin.ts` at the
linked package must equal the snapshot's:

```bash
omp_path=$(omp plugin list --json | jq -er '.npm[] | select(.name=="dely") | .path')
skills_json=$(omp skill list --json)
delivery_path=$(jq -er --arg p "$omp_path" '
  [.skills[] | select(.name=="delivery")][0]
  | select(.source=="omp-plugins:user")
  | select(.filePath | startswith($p + "/"))
  | .filePath
' <<<"$skills_json")
setup_path=$(jq -er --arg p "$omp_path" '
  [.skills[] | select(.name=="setup")][0]
  | select(.source=="omp-plugins:user")
  | select(.filePath | startswith($p + "/"))
  | .filePath
' <<<"$skills_json")
test -n "$omp_path" && test -n "$delivery_path" && test -n "$setup_path" \
  && test "$(shasum -a 256 "$snap/skills/delivery/SKILL.md" | awk '{print $1}')" \
       = "$(shasum -a 256 "$delivery_path" | awk '{print $1}')" \
  && test "$(shasum -a 256 "$snap/skills/setup/SKILL.md" | awk '{print $1}')" \
       = "$(shasum -a 256 "$setup_path" | awk '{print $1}')" \
  && test "$(shasum -a 256 "$snap/skills/delivery/scripts/dely.js" | awk '{print $1}')" \
       = "$(shasum -a 256 "$(dirname "$delivery_path")/scripts/dely.js" | awk '{print $1}')" \
  && test "$(shasum -a 256 "$snap/extensions/dely-pin.ts" | awk '{print $1}')" \
       = "$(shasum -a 256 "$omp_path/extensions/dely-pin.ts" | awk '{print $1}')"
```

A missing `omp_path`, a `jq` failure, a `source` other than
`omp-plugins:user`, or a `filePath` outside the linked package is a fail:
OMP resolved another copy (a project skill, a marketplace install, or a
wrong `pi.skills` path), not the snapshot. A hash mismatch on
`SKILL.md`, `dely.js`, or `extensions/dely-pin.ts` is a fail: the linked tree is
not the snapshot, or the extension was altered. Comparing only a symlink
to `$snap` with `$snap` itself is not this check. Remove the OMP install
in cleanup.

Install Pi from the snapshot for its Control or pin rows:

```bash
pi install "$snap"
pi list
```

Check that Pi's startup listing names both skills (`delivery`, `setup`) and
`extensions/dely-pin.ts` under the snapshot path (`$snap/skills/delivery/SKILL.md`,
`$snap/skills/setup/SKILL.md`, and `$snap/extensions/dely-pin.ts`), and that no
second `delivery`, `setup` or `dely-pin.ts` appears (for example an older
`pi install git:…` copy under `~/.pi/agent/git/`, which loads alongside the
snapshot). Run `pi --verbose --approve` in an Orca terminal from a directory
under `~/dely-probe/`, read the screen with `orca terminal read --screen`, then
exit with `ctrl+d`. Pi's default startup listing prints names only; only
`--verbose` prints the resolved paths. Pi shows a "Trust project folder?"
dialog when the working directory or an ancestor holds `.pi/…` resources or a
project `.agents/skills`. A scratch home under the real home directory makes
the real `~/.agents/skills` such an ancestor: `--approve` (or keeping any scratch
home outside the home directory) ensures startup does not hang on that dialog.

Remove the Pi install in cleanup with `pi remove "$snap"`.

Then verify by hash, at every location that can serve the skill:

```bash
shasum -a 256 "$snap/skills/delivery/SKILL.md"
find ~/.claude/plugins ~/.claude/skills ~/.agents/skills ~/.codex ~/.cursor \
     ~/.copilot ~/.gemini/config/plugins ~/.grok/installed-plugins ~/.omp ~/.pi \
  -name SKILL.md -path '*delivery*' -exec shasum -a 256 {} +
```

`dely` with no arguments now prints the version, SHA and sha256 of
`SKILL.md`, so a candidate can identify itself from inside whichever copy
actually ran — a stronger check than hashing paths from outside.

Include the marketplace source directory, not only the plugin cache. A Claude
Control was observed running `scripts/dely` straight out of the marketplace
path it was added from, so a cache that matches proves nothing on its own.

Every hash must match the snapshot. A copy with a different hash — including a
symlink left behind by an older install — wins over the plugin and silently
runs a different protocol. Stop and report rather than deleting someone's
install: report the path and the hash and ask.

**A harness reporting a successful install is not evidence.** Cursor once ran
an old branch for ten merges while reporting success every time.

## Parameterized worker row

Vary exactly: `id`, `name`, `discovery`, Model
and Effort from the candidate's entry; the probe path `worker-<id>`; and phase
(`implement`, then `review`). Use `default` where no pin is supported; for
`modelPin` entries use a discovered selector and level, with the extension
loaded. Record the actual default model and effort when no pin is requested.
Use `"$snap/skills/delivery/scripts/dely"` as `dely` below, including waits.
Run preflight and dispatch with no tool timeout, or one of at least 300 s.

```bash
probe/mkrepo.sh worker-<id> "<name>" <model> <effort> "<name>" <model> <effort>
```

Run `probe/mkrepo.sh` from the candidate Dely checkout. In an observer agent
terminal at `~/dely-probe/worker-<id>`, run
`orca orchestration run-create --objective "worker-<id> probe" --json`, which
creates and binds the Run; record its id as `<run>`. To resume an existing
probe Run there, use `orca orchestration run-use --id <run>`. Record the
observer's harness id as `<control-id>` for every wait's `--control`.
Answer the tested harness's trust dialog at this probe path before dispatch
(by hand except for Claude's `probe/trust.sh`). OMP and Pi pinned workers
need their README Dely install, which loads the pin extension. Create two
spec files under the probe path:

- Implement: fix the `REQUEST.md` defect, add a regression test, run
  `node --test test/`, and commit. Report through the dispatched lifecycle
  commands, using its own task, dispatch and terminal identities.
- Review: read the implement commit against `REQUEST.md`, run the gates,
  and report `ACCEPT` or concrete findings through its lifecycle commands.
  Do not modify the repository.

```bash
dely preflight --repo <absolute probe path> --run <run>
dely dispatch --repo <absolute probe path> --run <run> --phase implement --spec-file <implement spec>
# After processing implement settlement, acknowledging it and releasing:
dely dispatch --repo <absolute probe path> --run <run> --phase review --spec-file <review spec>
```

Use the Control wait below for each dispatch, replacing `--control <id>`
with `--control <control-id>` for the observer and using the snapshot helper.
**Pass:** preflight passes both
pins; both dispatches print `DISPATCHED` after a valid acknowledgement, both
settle on accepted `worker_done`, the regression passes and the review reports
`ACCEPT`. Record prompt retries and trust intervention separately; a launch
that loses its prompt is a failed attempt, even if its retry passes. Read the
worker screen with `orca terminal read --screen` on failure. Record pin
projection where available; for Pi inspect the session transcript instead.
A successful helper print alone does not prove the worker ran the task.

## Parameterized Control row

Vary exactly: Control `id`, `binary`, `permissionDefault`, its discovered
model and effort launch arguments (from that Control CLI's `--help`, not
Orca's `modelFlag`/`effortFlag`), its `controlWake`, the invocation spelling from README, and path `control-<id>`.
Keep both worker pins Claude Code with the same discovered model and effort
for all Control variants. `permissionDefault: none` means omit the argument,
not the word `none`. Record Control's actual model and effort. Run the script
from the candidate Dely checkout; the new terminal runs in the probe repository.

```bash
probe/mkrepo.sh control-<id> "Claude Code" <model> <effort> "Claude Code" <model> <effort>
orca terminal create --worktree path:~/dely-probe/control-<id> \
  --command "<binary> <permissionDefault> <supported model/effort arguments>"
```

Install the candidate in this Control harness and verify the loaded paths and
hashes. Pre-trust Claude workers with `probe/trust.sh` at this path; answer
Control's own dialog by hand. Wait for the composer before sending a prompt.
Tell Control: use the delivery skill for `REQUEST.md`, treat the design as
pre-approved Bounded, dispatch implement and review, push to the bare remote,
and stop only where the skill requires a human. Control uses
`orca orchestration run-create --objective "control-<id> probe" --json`
to create and bind its Run, or `orca orchestration run-use --id <run>`
to resume one. Do not bind it from the observer terminal.

For `background`, Control runs `dely wait --run <run> --control <id>` as a
background tool command and ends its turn. For `waker`, Control runs
`dely wait-bg --run <run> --control <id>` as its last command and ends its
turn. Run neither helper under a short tool timeout. Process each settled
batch, then pass its delivery id as `--ack <delivery>` to the next wait;
when no wait follows, run `orca orchestration check --ack <delivery>`.
After the active waiter settles, for each waker harness separately run `dely wait --run <run> --control <id>`
from a shell: it must print `REFUSED`.

Observe with `worker-list`, `worker-show`, and `terminal read --screen`.
**Pass:** the pushed SHA matches the reviewed head, review reports `ACCEPT`,
no human acts after initial trust, and Control wakes and processes the correct
batch. For waker Controls, every `wait_bg` log event is followed by `settled`,
`attention` or `stalled` before `notify`, and there is no `error` event.
`ALREADY_WAITING` starts no waiter and has no notify of its own. Confirm the
next Control turn acts on the wake. Merely seeing `wait_bg` and `notify` does
not prove the waiter watched the right terminal or exercised this path.

Record Control requests during each wait, their timing, and whether it read
`scripts/dely.js`. Use Codex rollout `token_usage_record`, Claude assistant
`usage`, or Cursor assistant transcript records (no local token counts).
For other harnesses, record the available source or say unobservable.

## Stub row — Orca-rejected messages

Run this from the observer shell with `snap` set to the candidate snapshot.
It uses a fake Orca executable and isolated home, creates no real Run or
worker, and checks a deliberately wrong copy before the candidate.

```bash
stub=$(mktemp -d "$HOME/dely-probe/rejected.XXXXXX")
cat > "$stub/check.cjs" <<'JS'
const fs = require('fs'), path = require('path'), assert = require('assert');
const {spawnSync} = require('child_process');
const [snap, root] = process.argv.slice(2);
const helper = path.join(snap, 'skills/delivery/scripts/dely.js');
for (const home of ['red-home', 'green-home'])
  fs.mkdirSync(path.join(root, home, '.dely'), {recursive: true});
fs.mkdirSync(path.join(root, 'repo'));
fs.writeFileSync(path.join(root, 'repo/AGENTS.md'),
  '| implement | Claude Code | default | default |\n' +
  '| review | Claude Code | default | default |\n');
fs.writeFileSync(path.join(root, 'repo/spec.md'), 'Fixture only.');
fs.cpSync(snap, path.join(root, 'wrong'), {recursive: true});
const wrong = path.join(root, 'wrong/skills/delivery/scripts/dely.js');
const source = fs.readFileSync(wrong, 'utf8');
const needle = 'return payloadOf(m)._orcaLifecycleRejection != null;';
assert(source.includes(needle), 'update the wrong-copy mutation for this candidate');
fs.writeFileSync(wrong, source.replace(needle, 'return false;'));
fs.writeFileSync(path.join(root, 'orca.js'), `
const fs = require('fs');
const a = process.argv.slice(2), cmd = a[1], root = process.env.FIXTURE_ROOT;
fs.appendFileSync(root+'/calls.jsonl', JSON.stringify(a)+'\\n');
let result = {};
if (cmd === 'worker-start') result = {dispatchId:'fixture-dispatch'};
if (cmd === 'check' && !a.includes('--ack')) {
  let n = 0; try {n = +fs.readFileSync(root+'/count','utf8')} catch {}
  fs.writeFileSync(root+'/count', String(n+1));
  const rejected = process.env.FIXTURE_MODE === 'reject' ||
    (process.env.FIXTURE_MODE === 'sequence' && n === 0);
  const payload = {dispatchId:'fixture-dispatch'};
  if (rejected) payload._orcaLifecycleRejection = {code:'dispatch_capability_invalid'};
  const messages = a.includes('--peek') ? [{type:'heartbeat',subject:'ack',payload}] :
    [{type:'worker_done',subject:'Rejected genuine subject',payload}];
  result = {deliveryId: rejected ? 'rejected-batch' : 'accepted-batch', messages};
}
console.log(JSON.stringify({ok:true,result}));
`);
function run(file, verb, mode) {
  fs.rmSync(path.join(root, 'count'), {force:true});
  fs.writeFileSync(path.join(root, 'calls.jsonl'), '');
  const args = [file, verb, '--run', 'fixture-run'];
  if (verb === 'wait') args.push('--control', 'claude', '--timeout-min', '0.05');
  else args.push('--repo', path.join(root, 'repo'));
  if (verb === 'dispatch') args.push('--phase', 'implement', '--spec-file', 'spec.md');
  const r = spawnSync(process.execPath, args, {encoding:'utf8', timeout:10000,
    env:{...process.env, HOME:path.join(root,file === wrong ? 'red-home' : 'green-home'),
      ORCA_TERMINAL_HANDLE:'fixture-terminal', ORCA_CLI_COMMAND:path.join(root,'orca.js'),
      FIXTURE_ROOT:root, FIXTURE_MODE:mode, DELY_ACK_S:'0.2',
      DELY_PREFLIGHT_S:'0.2', DELY_POLL_S:'0.02'}});
  assert(!r.error, String(r.error));
  return r.stdout;
}
for (const file of [wrong, helper]) {
  const red = file === wrong;
  assert.equal(run(file,'dispatch','reject').includes('DISPATCHED'), red);
  assert.equal(run(file,'preflight','reject').includes(' PASS '), red);
  const settled = JSON.parse(run(file,'wait','sequence'));
  assert.equal(settled.SETTLED, red ? 'rejected-batch' : 'accepted-batch');
  if (!red) {
    assert(fs.readFileSync(path.join(root,'calls.jsonl'),'utf8')
      .includes('"--ack","rejected-batch"'));
    const events = fs.readFileSync(path.join(root,'green-home/.dely/log.jsonl'),'utf8')
      .trim().split('\n').map(line => JSON.parse(line));
    const rejected = events.findIndex(e => e.event === 'rejected' &&
      e.deliveryId === 'rejected-batch');
    const accepted = events.findIndex(e => e.event === 'settled' &&
      e.deliveryId === 'accepted-batch');
    assert(rejected >= 0 && accepted > rejected, 'rejection must precede settlement');
    assert(!events.some(e => e.event === 'settled' && e.deliveryId === 'rejected-batch'),
      'candidate must never settle the rejected batch');
    console.log('LOG PASS: green rejection precedes accepted settlement; no rejected settlement');
  }
  assert(run(file,'dispatch','accept').includes('DISPATCHED'));
  assert(run(file,'preflight','accept').includes(' PASS '));
  console.log(red ? 'RED: wrong copy advances on rejected messages' :
    'GREEN: candidate ignores rejections and accepts genuine messages');
}
JS
node "$stub/check.cjs" "$snap" "$stub"
```

**Pass:** both RED and GREEN print, all assertions pass, and the candidate's
wait log in `$stub/green-home/.dely/log.jsonl` mechanically asserts rejection
before accepted settlement, with no rejected settlement. The wrong copy logs
separately in `$stub/red-home/.dely/log.jsonl`. Keep the fixture directory
and output with the probe report; remove it after recording the result. The accepted message's
subject intentionally begins `Rejected `; only the payload marker rejects it.

## Step 4 — row 4, a worker that dies after it acknowledges

Run row 4 once per Control wake mode, `background` and `waker`: two runs,
each on a harness covered by the parameterized Control row.
Inside that row, after the implement worker has acknowledged
**and** Control's own wait for that Run is running
(`pgrep -f "dely.js wait --run <run>"` for a background Control, the
`wait-bg` waiter for a waker one), kill the worker's agent process from outside
Orca. The kill trigger polls every 1 s and fires when that wait is running
**and** the implementer process is still alive **and** no `settled` event
exists yet. If the implementer settles first, record the row as not run for
that attempt rather than killing anything: a Sonnet 5 implementer settled
about 30 s after dispatch, and slower triggers missed it twice. An
acknowledgement is logged a few seconds after launch, but Control may
not start waiting for another 20 s while it finishes its turn; a kill in that
window measures Control's turn, not the helper. On `90fc7a9` a kill 4 s after
the `dispatch` event read 34 s to `ATTENTION`, of which 18 s passed before any
wait existed.

**Pass:** Control reports `ATTENTION` within 30 s and dispatches the same task
again exactly once. Expect about one `POLL_S` (15 s) plus a round-trip from the
start of the wait: `wait` blocks in `check --wait` before it reads
`worker-list`. Measured 16 s from wait start on Orca 1.4.203 and 1.4.204, and
8 s from a kill 8 s into the wait.

This is the row that catches a helper which prints `DISPATCHED` without ever
waiting for the acknowledgement: such a helper passes row 1 whenever the worker
happens to start, and fails here.

The signal is Orca's, not Dely's. `dely wait` reports `ATTENTION` when
`dispatchStatus` is `dispatched` and either `nextAction.kind` is not `none`
or `projection.attention.requiresAction` is true. An absent `nextAction` is
absent rather than `none`, and is not `ATTENTION`.

This row exercises the second of the skill's two `ATTENTION` routes: the
killed worker has `nextAction: none`, so there is no argv to run. Control
checks it with `worker-read` and `worker-show`, and with the process gone
runs `worker-stop`, then `worker-abandon` when the stop reports
`stop_unknown`, then `worker-release`, then one fresh `dely dispatch` with
the same prompt file. That is the "again exactly once" in the pass
condition. That projection has already changed shape between Orca releases,
so record the Orca version next to the result, and when this row fails,
check the projection directly before blaming the helper.

Measured on Orca 1.4.203 during this delivery's design:

| Worker state | `dispatchStatus` | `liveness.verdict` | `nextAction.kind` | `attention.requiresAction` |
| --- | --- | --- | --- | --- |
| Healthy, working (45 samples over 92 s) | `dispatched` | `live` | `none` | `false` |
| Killed after acknowledgement (from ≤1 s, held ≥132 s) | `dispatched` | `unverifiable` / `missing_status` | `none` | `true` |
| Settled, awaiting release | `completed` | `live` | `release` | `false` |
| Starting, ~1–2 s transient | `pending` | `unverifiable` | `none` | `true` |

`worker-show`'s `observation.status` and the terminal's `connected` flag
were both measured against the killed worker and neither moves, so
neither is a substitute.

## Step 5 — row 5, a pin that has not answered its dialog

Use a path that no harness has trusted — a new directory each time, never
the parameterized worker or Control paths — with a Claude Code pin, and run `dely preflight` inside a Run.

**Pass:** `PREFLIGHT … FAIL` in under 60 s, the printed `last output` contains
at least one line of the dialog, and `orca terminal list` shows nothing left
behind. One line is enough, and on Claude Code it is often only the tail: Orca's
prompt delivery presses Enter into the dialog, where `No, exit` is preselected,
so Claude has exited to a shell before the helper reads the last 400
characters. On `90fc7a9` the quote held `Security guide`, a line of that
dialog and one `probe/trust.sh` matches on; `harnesses.json` records the
mechanism.

The quote is the point, not the verdict. A failure that arrives on time with an
empty quote tells the human nothing, and that is exactly how this failed before
the launch-gate fix: 150 s and no cause.

## Step 6 — row 6, a worker that goes quiet

Dispatch a Claude Code worker whose spec is to acknowledge and then stay silent
for ten minutes.

**Pass:** `STALLED` at the configured threshold, with the idle minutes and the
last output. Orca's own liveness reads `live` throughout; that is the condition
this row exists for.

Terminal workers are out of scope here: a redrawing TUI keeps the stream
advancing, so their stall surfaces at `DEADLINE` instead.

## Step 7 — row 7, the trust intervention loop

This row checks the whole loop, not just the refusal: a delivery stops on an
untrusted pin, a human trusts it, and the same Run continues to `ACCEPT`.

Setup:

- a path no harness has trusted, `~/dely-probe/t-<sha>`;
- Control is Codex CLI or Cursor Agent CLI, **never Claude Code**, because
  Claude's own startup dialog is the trust step: answering it would pre-trust
  the path and the row would test nothing;
- the `implement` pin is Claude Code.

Steps and their pass conditions:

1. Control starts the delivery and dispatches the implementer, which cannot
   acknowledge behind Claude's dialog. From 0.20.0 a delivery does not
   preflight first, so the sequence is `NO_ACK` after `ACK_S` (60 s), then one
   `dely preflight` that fails the Claude pin. The clock starts at the Run's
   `no_ack` event: a dispatch that never acknowledges writes `no_ack`, not
   `dispatch`. **Pass:** within 150 s of the `no_ack` event, the log for the
   Run shows a `preflight` failing the Claude pin and Control has stopped on a
   message naming the harness, the path, and what the human must do; there is
   exactly one `no_ack` before that `preflight` and **no `dispatch` after
   it**; `orca orchestration worker-list` shows every dispatch released;
   `orca terminal list` has no leftover terminal. Measured on `b8094bf`: 63 s
   from the dispatch to `no_ack`, 79 s more to the failing `preflight` — a
   Control turn and a 56 s preflight — and 25 s more to the stop, 104 s from
   `no_ack`. The 150 s leaves room for a slower Control turn. On `90fc7a9`,
   whose skill had lost the `PREFLIGHT … FAIL` route, Control dispatched a
   second time into the same dialog and stopped about 4 min after the first
   dispatch.
2. Act as the human: `probe/trust.sh ~/dely-probe/t-<sha>`. It opens Claude in
   an Orca terminal, answers the dialog, verifies
   `projects[<path>].hasTrustDialogAccepted` in `~/.claude.json`, and closes
   the terminal. **Pass:** it prints `TRUSTED`. On `NOT_TRUSTED`, stop and
   call the human — do not loop.
3. Send Control one line: `Claude Code is trusted in this repository. Run
   preflight again and continue.` followed by Enter. If Orca answers
   `agent_prompt_blocked`, Control is holding a menu: send `\r` first, then the
   text.
4. **Pass:** the same Run gets a second preflight, it passes both pins, the
   delivery reaches `ACCEPT`, the SHA is on the remote, and nothing else was
   sent to Control.

Ways of failing that this row separates from passing: failing at 150 s with an
empty quote; telling the human to answer in a terminal that has already been
released; opening a new Run or dispatching without preflighting again; and
hanging because a batch was never acknowledged.

**Leaves behind:** a trust entry for `t-<sha>` in `~/.claude.json` and a
repository registered in Orca. Remove both by hand; Orca has no command for the
second.

## Step 8 — row 8, OMP worker with a valid pin

Build a probe repository under `~/dely-probe/` whose `implement` pin is OMP
with a Model `selector` from `omp models --json` and an Effort that is one of
that model's `thinking` levels, and with the pinned model different from
OMP's configured default.
`probe/mkrepo.sh` writes whatever harness names it is given; OMP needs no
trust step. From that repository run `dely dispatch` for `implement`.

**Pass:** `dely dispatch` prints `DISPATCHED <id>` — the post-acknowledgement
check passed. Record `worker-show` `result.projection.provider.model` at
the acknowledgement; if that value is not already the pinned selector,
record how long after the acknowledgement it became the pin. The last
`model_change` (and `thinking_level_change`, when an Effort is pinned)
before the first user message is the pinned model and level; every
assistant message, the first included, is the pinned model; and
`worker-show` `projection.provider.model` before release shows it.
If the helper prints `DISPATCHED` but the first request ran OMP's
configured default, the check compared a different field or format.

Then keep the same pin and stop this dispatch from loading `extensions/dely-pin.ts`
without touching any user configuration beyond this plugin:
`omp plugin disable dely`. Dispatch `implement` again. Re-enable with
`omp plugin enable dely` before later rows.

**Pass:** `dely dispatch` prints
`FAILED <id> pin not applied: expected <selector>, saw <value or none>`
and does not print `DISPATCHED`. A print of `DISPATCHED`, or a warning
that still dispatches, is a fail: the helper did not stop a worker that
was not running the pin.

## Step 9 — row 9, OMP worker with an invalid pin

Same probe-repository setup as row 8's first dispatch (plugin enabled), with
a selector `omp models --json` does not offer.

**Pass:** `dely dispatch` prints `NO_ACK` whose quote contains
`DELY-PIN-FAIL`, and that session has no assistant message. If the worker
acknowledged and completed on OMP's default model, the extension threw or
called `ctx.shutdown()` instead of exiting the process.

## Step 10 — row 10, OMP worker with Model `default`

Run this row when `start()` in `dely.js` or `extensions/dely-pin.ts` changes.
Same probe-repository setup as row 8's first dispatch, with Model `default`
and Effort `default`.

**Pass:** the worker transcript's first user message has no `dely-pin:`
line. A first user message that contains a `dely-pin:` line is a fail.

## Step 11 — row 11, a second `dely-pin:` line in an interactive OMP session

Run this row when `start()` in `dely.js` or `extensions/dely-pin.ts` changes.
Open an interactive OMP session (not a `dely dispatch`). After it has
started, send a second prompt that carries a `dely-pin:` line and read its
model.

**Pass:** the session's model is unchanged from before that prompt. If the
model switched, the extension applied the pin on a start after the first.

## Step 13 — row 13, Pi worker with a valid pin

Run this row when `start()` in `dely.js`, the extension or the `pi` entry
changes, and after a Pi upgrade.
Build a probe repository under `~/dely-probe/` whose `implement` pin is Pi
with a Model `<provider>/<model>` from `pi --list-models` and an Effort
that is one of the `--thinking` levels (from `pi --help`, which lists the
global levels; a model's own support shows only when the extension's read-back
fails), with the pinned model different from Pi's configured default, and
with the pinned Effort different from Pi's configured default thinking level
(the prober learns the default from the first `thinking_level_change` of an
unpinned Pi session).
Pi needs no trust step when the probe repository has no `.pi/` resources or
`.agents/skills`. From that repository run `dely dispatch` for `implement`.

**Pass:** `dely dispatch` prints `DISPATCHED <id>` without a model check,
because Orca does not report Pi's model. In the Pi session JSONL under
`~/.pi/agent/sessions/`: the last `model_change` before the first user message
and every assistant message, the first included, is the pinned model; and the
last `thinking_level_change` before the first user message is the pinned effort
level. The pinned model and level must differ from Pi's configured defaults.
If the helper prints `DISPATCHED` but the first request ran Pi's configured
default, the pin was not applied before the first request.

## Step 14 — row 14, Pi worker with an unknown selector

Run this row when `start()` in `dely.js`, the extension or the `pi` entry
changes, and after a Pi upgrade.
Same probe-repository setup as row 13's dispatch, with a selector
`pi --list-models` does not offer.

**Pass:** `dely dispatch` prints `NO_ACK` whose quote contains
`DELY-PIN-FAIL`, and that session has no assistant message.

## Step 15 — row 15, Pi worker with a level the model does not offer

Run this row when `start()` in `dely.js`, the extension or the `pi` entry
changes, and after a Pi upgrade.
Same probe-repository setup as row 13's dispatch, with a valid model selector
and an effort level that the model does not offer (for example `max` on
`google-vertex/gemini-3.5-flash`).

**Pass:** `dely dispatch` prints `NO_ACK` whose quote contains
`DELY-PIN-FAIL`, and that session has no assistant message.

## Step 16 — row 16, a Pi worker that dies after it acknowledges

Run this row when `start()` in `dely.js`, the extension or the `pi` entry
changes, and after a Pi upgrade.
Follow row 4's procedure inside a dispatch with a Pi worker: kill the Pi worker
process from outside Orca under row 4's kill guard (kill only while Control's
wait is running, the implementer process is still alive, and no `settled` event
exists yet; otherwise record "not run"). Sample `worker-show` at 1 s or less.

**Pass:** Control reports `ATTENTION` within 30 s and dispatches the same task
again exactly once. Killing the Pi worker process turns
`attention.requiresAction` true within 3 s.

## Cleanup

- uninstall candidate copies from every tested Control harness using README
  commands, restoring any prior installs; Grok can also import Claude copies;
- remove the OMP install (`omp plugin uninstall dely`; needs `bun` on PATH;
  when `bun` is absent, `omp plugin disable dely` stops OMP loading Dely's
  skills and extension and leaves `dely` listed, then delete
  `~/.omp/plugins/node_modules/dely`, `rmdir` the then-empty
  `~/.omp/plugins/node_modules` directory, and rewrite
  `~/.omp/plugins/omp-plugins.lock.json` with `jq 'del(.plugins.dely)'`);
- remove the Pi install (`pi remove "$snap"`);
- delete the snapshot;
- keep parameterized worker and Control paths so their trust entries survive;
- remove the row 5, row 7, OMP-row and Pi-row paths, and the trust entries of the
  first two.

## What this cannot see

Copilot, Antigravity and Grok on versions other than the ones measured.
The deferred harnesses. Installing OMP from a git URL, or uninstalling it
with `bun` present. Windows. A race between an acknowledgement and a
replayed batch in a live session (the stub covers only its fixtures). A quota exhausted mid-run. A Control that skips a gate because
the model was having a bad day. A shape change between two Orca releases, until
the rows are run again. A Model `default` dispatch whose spec itself carries
a pin line. A stuck live Pi worker before `DEADLINE`. Pi versions other than
0.87.1 and 0.99.1. Pi's trust layout on other machines. A pinned Pi worker that did not
load the extension, which runs its own default unseen.

## Results

Put the table in the pull request body: one line per row, with the verdict, the
harness and role (or row number), and what was left behind.
