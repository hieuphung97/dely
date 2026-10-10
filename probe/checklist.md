# Live checklist

A separate agent session runs this against a candidate installed from a
`git archive` snapshot, before review. Record every row's candidate SHA,
Orca version, harness version, model, effort, verdict and residue. A human
answers first-launch trust dialogs; Dely never answers them. `trust.sh`
can stand in for the human only for Claude Code.

## Input and release floor

- candidate SHA and checkout path;
- last-release SHA (the newest `v*` tag) and its snapshot path;
- Orca running with orchestration enabled (live rows only);
- each harness being tested installed and signed in (live rows only);
- Node and `~/dely-probe/` writable.

Run rows by what changed, against **every supported entry** in the candidate's
`harnesses.json`. The argv stub row compares stdout and `worker-start` argv
for every supported entry to the last release snapshot, and also runs
`dely preflight` for each entry and compares its output and launches; it
stands in for the live worker row of every entry whose `harnesses.json`
entry did not change. An **entry changed** when one of these fields differs
from the last release: `id`, `name`, `binary`, `status`, `controlWake`,
`modelFlag`, `effortFlag`, `effortInModel`, `modelPin`, `permissionDefault`, `discovery`,
`trust`. A change to `limits` or `notes` does not count.

Run the live worker row for each entry that changed and for each harness
upgrade that a deployment uses. Each worker row covers implementer and
reviewer in separate sessions. A **deployment** is this repository's
pins plus the harness the owner uses as Control. A **harness
upgrade** is a version different from the newest live report that ran that
harness. If none did, treat the harness as upgraded.

When the argv stub reports a difference it does not list as intended,
whether or not the change meant it, record it and run the live worker row
for every entry it names.

Run the Control row once per wake mode (`background`, `waker`) whenever
`wait`, `wait-bg`, `notify`, the acknowledgement or settle logic, or the
`SKILL.md` sections "The control session" and "Orca and the helper" change;
this is in addition to any per-harness Control rows. Those per-wake-mode
rows use Claude Code for `background` and Codex CLI for `waker`, unless a
deployment's Control uses another harness of that mode. Skip Control when
`controlWake` is `unsupported`, and record that reason. Run the Control row
per harness when its entry changed, or when that harness upgraded and a
deployment uses it as Control.

The release floor is the argv stub row, the pin-resolution stub row when its
trigger fired, the rejected-message stub row, the worker-release stub row
when `wait`, `log`, or the settle logic changes, the
live worker rows the rules above require, the Control rows those rules
require, and rows 4–7. Rows 8–10 and 12 run when `start()` or the `omp` entry
changes; row 11 runs when the pin extension changes. Rows 13–16 run when
`start()`, the extension or the Pi entry changes, after a Pi upgrade, and
after an Orca upgrade. After an Orca upgrade, run the live worker row for
each harness a deployment uses, the Control row once per wake mode, rows 4
and 5, and Pi rows 13 to 16. The argv stub does not test Orca and is not on
this list. Rerun OMP pin rows and its Control row after an OMP upgrade;
rerun Pi pin rows and its Control row after a Pi upgrade. A release that
skips required rows names them and the reason in its decision record;
structural gates cannot substitute for them.

## Step 1 — install the candidate from a snapshot

Never point a harness at the working tree. Take a snapshot, install from it,
and check what actually landed:

```bash
sha=<candidate SHA>
snap=~/dely-probe/.snap-$sha
rm -rf "$snap" && mkdir -p "$snap"
git -C <checkout> archive "$sha" | tar -x -C "$snap"
```

The last release is the newest `v*` tag. Snapshot
it the same way; the argv stub row needs both trees and does not install either:

```bash
release_sha=<last release SHA>
release_snap=~/dely-probe/.snap-$release_sha
rm -rf "$release_snap" && mkdir -p "$release_snap"
git -C <checkout> archive "$release_sha" | tar -x -C "$release_snap"
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

## Stub row — launch argv against the last release

Run this from the observer shell with `snap` set to the candidate snapshot and
`release_snap` to the last release snapshot. Set `DELY_NAMED_INTENDED` to the
differences the candidate's decision record names for this release, one per
line (empty if it names none). The row prints only these line forms:
`<name> --model`, `<name> --effort`, `<name> is new`, `<name> missing from
candidate`, `<name> deferred in candidate`, and the preflight-labelled flag
forms `<name> preflight --model` and `<name> preflight --effort`. Only
differences of those kinds go in `DELY_NAMED_INTENDED`. "This release" means
the `docs/decisions.md` sections dated after the commit date of the newest
`v*` tag. Write the list from the record before the row runs; never edit it
from the row's output. A mismatch is a finding against the record or the
data. A flag change gives both its dispatch line and its `preflight` line;
`<name> is new` means the entry is absent from the release's
`harnesses.json`, not that it became supported. It uses a fake Orca
executable and isolated home, creates no real Run or worker, and checks a
deliberately wrong copy (a mutant that drops `--effort`) before the
candidate. It stands in for the live worker row of
every supported entry whose `harnesses.json` entry did not change. The argv
stub does not test Orca. It writes each helper's pins where that helper reads
them: the table in `AGENTS.md` for the release snapshot, `.dely/pins.json` for
the candidate.

```bash
stub=$(mktemp -d "$HOME/dely-probe/argv.XXXXXX")
cat > "$stub/check.cjs" <<'JS'
const fs = require('fs'), path = require('path'), assert = require('assert');
const {spawnSync} = require('child_process');
const [snap, release, root] = process.argv.slice(2);
assert(snap && release && root, 'usage: check.cjs <candidate-snap> <release-snap> <fixture-root>');
const helper = (tree) => path.join(tree, 'skills/delivery/scripts/dely.js');
const load = (tree) => JSON.parse(fs.readFileSync(path.join(tree, 'harnesses.json'), 'utf8')).harnesses;
const candH = load(snap), relH = load(release);
fs.mkdirSync(path.join(root, 'home/.dely'), {recursive: true});
fs.mkdirSync(path.join(root, 'repo/.dely/local/runs/fixture-run'), {recursive: true});
fs.writeFileSync(path.join(root, 'repo/.dely/local/runs/fixture-run/spec.md'), 'Fixture only.');
fs.cpSync(snap, path.join(root, 'wrong'), {recursive: true});
const wrong = helper(path.join(root, 'wrong'));
const source = fs.readFileSync(wrong, 'utf8');
const needle = '  if (wantsEffort) args.push("--effort", p.effort);\n';
assert(source.includes(needle), 'update the --effort mutation for this candidate');
fs.writeFileSync(wrong, source.replace(needle, ''));
fs.writeFileSync(path.join(root, 'orca.js'), `
const fs = require('fs');
const a = process.argv.slice(2), cmd = a[1], root = process.env.FIXTURE_ROOT;
fs.appendFileSync(root+'/calls.jsonl', JSON.stringify(a)+'\\n');
let result = {};
if (cmd === 'worker-start') result = {dispatchId:'d-1'};
if (cmd === 'check') result = {deliveryId:'batch-1',messages:[
  {type:'heartbeat',subject:'ack',payload:{dispatchId:'d-1'}},
  {type:'worker_done',subject:'preflight ok',payload:{dispatchId:'d-1'}}]};
if (cmd === 'worker-list') result = {workers:[]};
if (cmd === 'worker-read') result = {terminal:{tail:[]}};
if (cmd === 'worker-stop' || cmd === 'worker-release') result = {};
if (cmd === 'status') result = {runtime:{appVersion:'stub'}};
console.log(JSON.stringify({ok:true,result}));
`);
function pinOf(h, other, mode) {
  const o = other || {};
  const modelCap = !!(h.modelFlag || h.modelPin || o.modelFlag || o.modelPin);
  // A modelFlag entry gets a pinned Effort too, so an argv that starts using it is seen.
  const effortCap = !!(h.effortFlag || h.effortInModel || h.modelFlag || h.modelPin || o.effortFlag || o.effortInModel || o.modelFlag || o.modelPin);
  if (mode === 'default') return {model:'default', effort:'default'};
  if (mode === 'effortdefault') return {model:'pin-model', effort:'default'};
  if (mode === 'effort') return {model:'default', effort:'high'};
  return {
    model: modelCap ? 'pin-model' : 'default',
    effort: effortCap ? 'high' : 'default',
  };
}
function flagsOf(argv) {
  const f = {};
  if (!argv) return f;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--model' || argv[i] === '--effort') f[argv[i]] = argv[++i];
  }
  return f;
}
function stripped(argv) {
  const out = [];
  if (!argv) return out;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--model' || argv[i] === '--effort') { i++; continue; }
    // A spec pin line is compared by the candidate-only assertions below.
    if (argv[i] === '--spec') { out.push(argv[++i].replace(/\ndely-pin: .*/, '')); continue; }
    out.push(argv[i]);
  }
  return out;
}
function add(arr, line) {
  if (!arr.includes(line)) arr.push(line);
}
function launch(file, h, other, mode, verb) {
  const pin = pinOf(h, other, mode);
  // Each helper reads its own form: the 0.23.1 release reads this table in
  // AGENTS.md, the candidate reads .dely/pins.json. The table carries no
  // dely:begin marker, which the candidate would refuse.
  fs.writeFileSync(path.join(root, 'repo/AGENTS.md'),
    '| Phase | Harness | Model | Effort |\n| --- | --- | --- | --- |\n' +
    '| `implement` | ' + h.name + ' | ' + pin.model + ' | ' + pin.effort + ' |\n' +
    '| `review` | ' + h.name + ' | ' + pin.model + ' | ' + pin.effort + ' |\n');
  const one = {harness: h.id, model: pin.model, effort: pin.effort};
  fs.mkdirSync(path.join(root, 'repo/.dely'), {recursive: true});
  fs.writeFileSync(path.join(root, 'repo/.dely/pins.json'),
    JSON.stringify({implement: one, review: one}));
  fs.writeFileSync(path.join(root, 'calls.jsonl'), '');
  const args = [file, verb, '--run', 'fixture-run', '--repo', path.join(root, 'repo')];
  if (verb === 'dispatch') args.push('--phase', 'implement', '--spec-file', '.dely/local/runs/fixture-run/spec.md');
  const r = spawnSync(process.execPath, args,
    {encoding:'utf8', timeout:10000, env:{...process.env,
      HOME:path.join(root, 'home'), ORCA_TERMINAL_HANDLE:'fixture-terminal',
      ORCA_CLI_COMMAND:path.join(root, 'orca.js'), FIXTURE_ROOT:root,
      DELY_ACK_S:'0.2', DELY_POLL_S:'0.02', DELY_PREFLIGHT_S:'0.2'}});
  const starts = [];
  for (const line of fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').split('\n').filter(Boolean)) {
    const a = JSON.parse(line);
    if (a[1] === 'worker-start') starts.push(a);
  }
  let out = (r.stdout || '').trim();
  if (verb === 'preflight') out = out.replace(/PASS \d+s/g, 'PASS');
  const ok = verb === 'preflight' ? / PASS/.test(out) && starts.length > 0
    : out.includes('DISPATCHED') && starts.length > 0;
  const startArgv = starts[0] || null;
  const si = startArgv ? startArgv.indexOf('--spec') : -1;
  return {out, startArgv, starts, ok, status: r.status, spec: si < 0 ? null : startArgv[si + 1]};
}
function diffLaunch(label, cand, rel, h, other, intended, unexpected, mode) {
  const tag = label === 'dispatch' ? h.name : h.name + ' ' + label;
  const okNeedle = label === 'preflight' ? 'preflight' : 'dispatch';
  const ftag = label === 'preflight' ? h.name + ' preflight' : h.name;
  if (mode === 'effort') {
    if (cand.out !== rel.out) add(unexpected, tag + ' stdout');
    if (JSON.stringify(cand.starts.map(stripped)) !== JSON.stringify(rel.starts.map(stripped)))
      add(unexpected, tag + ' argv');
  } else {
    if (!cand.ok) add(unexpected, tag + ' candidate did not ' + okNeedle + ': ' + cand.out);
    if (!rel.ok) add(unexpected, tag + ' last release did not ' + okNeedle + ': ' + rel.out);
    if (cand.ok && rel.ok && cand.out !== rel.out) add(unexpected, tag + ' stdout');
    if (JSON.stringify(cand.starts.map(stripped)) !== JSON.stringify(rel.starts.map(stripped)))
      add(unexpected, tag + ' argv');
  }
  const cf = flagsOf(cand.startArgv), rf = flagsOf(rel.startArgv);
  for (const flag of ['--model', '--effort']) {
    if (cf[flag] === rf[flag]) continue;
    const field = flag === '--model' ? 'modelFlag' : 'effortFlag';
    if (h[field] !== other[field]) add(intended, ftag + ' ' + flag);
    else add(unexpected, ftag + ' ' + flag);
  }
}
// Candidate-only: what the candidate's own entries must launch. The release
// comparison cannot see these, because the release launched them differently.
function assertCandidate(candTree, unexpected) {
  for (const h of load(candTree).filter((x) => x.status === 'supported')) {
    for (const verb of ['dispatch', 'preflight']) {
      const tag = verb === 'dispatch' ? h.name : h.name + ' preflight';
      if (h.effortInModel && h.modelFlag) {
        const hi = launch(helper(candTree), h, null, 'pinned', verb);
        const f = flagsOf(hi.startArgv);
        if (f['--model'] !== 'pin-model' + h.effortInModel + 'high') add(unexpected, tag + ' --model ' + f['--model']);
        if ('--effort' in f) add(unexpected, tag + ' passes --effort');
        if (hi.spec == null || /dely-pin:/.test(hi.spec)) add(unexpected, tag + ' spec carries a dely-pin line');
        const lo = launch(helper(candTree), h, null, 'effortdefault', verb);
        const g = flagsOf(lo.startArgv);
        if (g['--model'] !== 'pin-model') add(unexpected, tag + ' Effort default --model ' + g['--model']);
        if ('--effort' in g) add(unexpected, tag + ' Effort default passes --effort');
        const rf = launch(helper(candTree), h, null, 'effort', verb);
        if (rf.starts.length) add(unexpected, tag + ' launched with Model default and a pinned Effort');
      }
      if (h.modelPin) {
        const m = launch(helper(candTree), h, null, 'pinned', verb);
        const f = flagsOf(m.startArgv);
        if (m.spec == null || !m.spec.includes('\ndely-pin: pin-model high')) add(unexpected, tag + ' spec lacks dely-pin: pin-model high');
        if ('--model' in f || '--effort' in f) add(unexpected, tag + ' passes a flag beside the spec pin');
      }
    }
  }
}
function compare(candTree, relTree) {
  const intended = [], unexpected = [];
  const candHs = load(candTree), relHs = load(relTree);
  const supported = candHs.filter((h) => h.status === 'supported');
  assert(supported.length, 'candidate has no supported entries');
  assertCandidate(candTree, unexpected);
  for (const h of supported) {
    const other = relHs.find((x) => x.name === h.name);
    if (!other) {
      for (const mode of ['pinned', 'default']) {
        const candD = launch(helper(candTree), h, other, mode, 'dispatch');
        const candP = launch(helper(candTree), h, other, mode, 'preflight');
        const relD = launch(helper(relTree), h, other, mode, 'dispatch');
        if (!candD.ok) add(unexpected, h.name + ' is new but candidate did not dispatch');
        else if (relD.startArgv) add(unexpected, h.name + ' is new but last release dispatched');
        if (!candP.ok) add(unexpected, h.name + ' is new but candidate preflight failed: ' + candP.out);
      }
      add(intended, h.name + ' is new');
      continue;
    }
    for (const mode of ['pinned', 'default'].concat(
      (h.effortFlag || h.effortInModel || h.modelPin || other.effortFlag || other.effortInModel || other.modelPin) ? ['effort'] : []
    )) {
      diffLaunch('dispatch',
        launch(helper(candTree), h, other, mode, 'dispatch'),
        launch(helper(relTree), h, other, mode, 'dispatch'),
        h, other, intended, unexpected, mode);
      diffLaunch('preflight',
        launch(helper(candTree), h, other, mode, 'preflight'),
        launch(helper(relTree), h, other, mode, 'preflight'),
        h, other, intended, unexpected, mode);
    }
  }
  for (const h of relHs.filter((x) => x.status === 'supported')) {
    const cand = candHs.find((x) => x.name === h.name);
    if (!cand) add(intended, h.name + ' missing from candidate');
    else if (cand.status === 'deferred') add(intended, h.name + ' deferred in candidate');
  }
  return {intended, unexpected};
}
assert(process.env.DELY_NAMED_INTENDED != null,
  'set DELY_NAMED_INTENDED to the decision-record names, one per line');
const named = process.env.DELY_NAMED_INTENDED.split('\n').map((s) => s.trim()).filter(Boolean);
const red = compare(path.join(root, 'wrong'), release);
assert(red.unexpected.length, 'mutant dropping --effort must fail');
console.log('RED: mutant dropping --effort: ' + red.unexpected.join('; '));
const green = compare(snap, release);
assert.equal(green.unexpected.length, 0, green.unexpected.join('; ') || 'unexpected');
for (const line of green.intended) console.log('INTENDED: ' + line);
assert.deepEqual([...green.intended].sort(), [...named].sort(),
  'INTENDED ' + JSON.stringify(green.intended) + ' != named ' + JSON.stringify(named));
console.log('GREEN: candidate matches last release except named intended differences');
JS
test -n "${DELY_NAMED_INTENDED+x}" || { echo 'set DELY_NAMED_INTENDED to the decision-record names, one per line (empty if none)'; exit 1; }
node "$stub/check.cjs" "$snap" "$release_snap" "$stub"
```

**Pass:** RED prints (the `--effort`-dropping mutant fails the comparison), GREEN
prints, every supported entry was compared pinned and with `default`, entries
with `effortFlag`, `effortInModel` or `modelPin` were also compared with Effort
pinned and Model `default` (including the refusal), preflight output and
launches matched (a spec pin line is stripped from the comparison and asserted
for the candidate alone: an `effortInModel` entry launches `--model
pin-model<sep>high`, or `--model pin-model` with Effort `default`, with no
`--effort` and no `dely-pin:` line, and a `modelPin` entry's spec carries
`dely-pin: pin-model high` with no flag), every
release-supported entry missing or `deferred` in the candidate is reported, and
the printed INTENDED lines equal `DELY_NAMED_INTENDED`. An argv or stdout
difference always fails the row; the live worker rows it routes to replace the
row for those entries, and the floor is met when they pass. If the `--effort`
mutation assert fires, update the needle; it is not a candidate failure. Keep
the fixture directory and output with the probe report; remove it after
recording the result.

## Parameterized worker row

Run for each supported entry that changed and for each harness upgrade a
deployment uses. Unchanged entries are covered by the argv stub row.
Skip a deferred entry.

Vary exactly: `id`, `name`, `discovery`, Model
and Effort from the candidate's entry; the probe path `worker-<id>`; and phase
(`implement`, then `review`). Use `default` where no pin is supported; for
`modelPin` entries use a discovered selector and level, with the extension
loaded. Record the actual default model and effort when no pin is requested.
Use `"$snap/skills/delivery/scripts/dely"` as `dely` below, including waits.
Run preflight and dispatch with no tool timeout, or one of at least 300 s.

```bash
probe/mkrepo.sh worker-<id> <id> <model> <effort> <id> <model> <effort>
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
spec files under `<absolute probe path>/.dely/local/runs/<run>/`, the Run's
folder, which `dely dispatch` requires and in which the workers write their
handoffs:

- Implement: fix the `REQUEST.md` defect, add a regression test, run
  `node --test test/`, and commit. Report through the dispatched lifecycle
  commands, using its own task, dispatch and terminal identities.
- Review: read the implement commit against `REQUEST.md`, run the gates,
  and report `ACCEPT` or concrete findings through its lifecycle commands.
  Do not modify the repository.

```bash
dely preflight --repo <absolute probe path> --run <run>
dely dispatch --repo <absolute probe path> --run <run> --phase implement --spec-file <implement spec>
# After processing implement settlement and acknowledging it (the helper released the worker):
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

Run once per wake mode (`background`, `waker`) whenever `wait`, `wait-bg`,
`notify`, the acknowledgement or settle logic, or the `SKILL.md` sections
"The control session" and "Orca and the helper" change; this is in addition
to any per-harness rows. Use Claude Code for `background` and Codex CLI for
`waker`, unless a deployment's Control uses another harness of that mode.
Run per harness when its entry changed, or when that harness upgraded and a
deployment uses it as Control.
Skip when `controlWake` is `unsupported`, and record that reason.

Vary exactly: Control `id`, `binary`, `permissionDefault`, its discovered
model and effort launch arguments (from that Control CLI's `--help`, not
Orca's `modelFlag`/`effortFlag`), its `controlWake`, the invocation spelling from README, and path `control-<id>`.
Keep both worker pins Claude Code with the same discovered model and effort
for all Control variants. `permissionDefault: none` means omit the argument,
not the word `none`. Record Control's actual model and effort. Run the script
from the candidate Dely checkout; the new terminal runs in the probe repository.

```bash
probe/mkrepo.sh control-<id> claude <model> <effort> claude <model> <effort>
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
batch. Every settled worker's terminal leaves `orca terminal list` without
Control running `worker-release`, `worker-read` still returns that worker's
output afterwards, and `worker-list --run <run> --terminal-state reclaimable`
is empty after `dely log`. For waker Controls, every `wait_bg` log event is followed by `settled`,
`attention` or `stalled` before `notify`, and there is no `error` event.
`ALREADY_WAITING` starts no waiter and has no notify of its own. Confirm the
next Control turn acts on the wake. Merely seeing `wait_bg` and `notify` does
not prove the waiter watched the right terminal or exercised this path.

Record Control requests during each wait, their timing, and whether it read
`scripts/dely.js`. Use Codex rollout `token_usage_record`, Claude assistant
`usage`, or Cursor assistant transcript records (no local token counts).
For other harnesses, record the available source or say unobservable.

## Stub row — pin resolution

Run this when the pin resolver in `dely.js`, the `.dely/` file format, or the
text of `dely pins` changes. It runs from the observer shell with `snap` set to
the candidate snapshot, against a fake Orca executable and an isolated home;
it creates no real Run or worker. It checks six requirements, each against a
deliberately wrong copy of the candidate before the candidate itself:

| Row | Requirement | Mutant that must turn it RED |
| --- | --- | --- |
| 1 | the personal file overrides per phase | `first-file-only`: the first file found answers both phases, so `implement` falls to Control |
| 2 | worktree, then main checkout | `worktree-only`: reads only `<repo>/.dely/local`; `main-wins`: the main checkout's file beats the worktree's own |
| 3 | Control fallback | `control-throws`: no Control harness is an error as in 0.23.1; `control-claude`: hard-codes `claude` |
| 4 | an old `dely:begin` block stops the helper | `block-ignored`: the block is skipped and Control answers |
| 5 | strict format | `typo-ignored`: an unknown key such as `reveiw` is skipped and the team pin is used |
| 6 | `dispatch` and `preflight` use the resolver | `dispatch-agents-md`, `preflight-agents-md`: each still parses the `AGENTS.md` table |

```bash
stub=$(mktemp -d "$HOME/dely-probe/pins.XXXXXX")
cat > "$stub/check.cjs" <<'JS'
const fs = require('fs'), path = require('path'), assert = require('assert');
const {spawnSync, execFileSync} = require('child_process');
const [snap, rootArg] = process.argv.slice(2);
assert(snap && rootArg, 'usage: check.cjs <candidate-snap> <fixture-root>');
const root = fs.realpathSync(rootArg);
const sh = (cwd, ...a) => execFileSync(a[0], a.slice(1), {cwd, stdio: 'pipe'});
fs.mkdirSync(path.join(root, 'home'), {recursive: true});
fs.writeFileSync(path.join(root, 'orca.js'), `
const fs = require('fs');
const a = process.argv.slice(2), cmd = a[0] === 'terminal' ? 'terminal ' + a[1] : a[1], root = process.env.FIXTURE_ROOT;
fs.appendFileSync(root+'/calls.jsonl', JSON.stringify(a)+'\\n');
let result = {};
if (cmd === 'terminal list') result = {terminals:[Object.assign({handle:'fixture-terminal'},
  process.env.FIXTURE_IDENTITY ? {agentIdentity: process.env.FIXTURE_IDENTITY} : {})]};
if (cmd === 'worker-start') result = {dispatchId:'d-1'};
if (cmd === 'check') result = {deliveryId:'batch-1',messages:[
  {type:'heartbeat',subject:'ack',payload:{dispatchId:'d-1'}},
  {type:'worker_done',subject:'preflight ok',payload:{dispatchId:'d-1'}}]};
if (cmd === 'worker-list') result = {workers:[]};
if (cmd === 'worker-read') result = {terminal:{tail:[]}};
if (cmd === 'status') result = {runtime:{appVersion:'stub'}};
console.log(JSON.stringify({ok:true,result}));
`);
let n = 0;
function repo(files, agents) {
  const dir = path.join(root, 'r' + (++n));
  fs.mkdirSync(dir);
  sh(dir, 'git', 'init', '-q', '-b', 'main');
  for (const [f, v] of Object.entries(files || {})) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), {recursive: true});
    fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v));
  }
  if (agents) fs.writeFileSync(path.join(dir, 'AGENTS.md'), agents);
  fs.mkdirSync(path.join(dir, '.dely/local/runs/fixture-run'), {recursive: true});
  fs.writeFileSync(path.join(dir, '.dely/local/runs/fixture-run/spec.md'), 'Fixture only.');
  return dir;
}
function commit(dir, ...paths) {
  sh(dir, 'git', 'add', ...paths);
  sh(dir, 'git', '-c', 'user.name=probe', '-c', 'user.email=p@example.invalid', 'commit', '-qm', 'x');
}
function helper(tree, args, ident) {
  const r = spawnSync(process.execPath, [path.join(tree, 'skills/delivery/scripts/dely.js'), ...args],
    {encoding: 'utf8', timeout: 10000, env: {...process.env, HOME: path.join(root, 'home'),
      ORCA_TERMINAL_HANDLE: 'fixture-terminal', ORCA_CLI_COMMAND: path.join(root, 'orca.js'),
      FIXTURE_ROOT: root, FIXTURE_IDENTITY: ident || '', DELY_ACK_S: '0.2', DELY_POLL_S: '0.02',
      DELY_PREFLIGHT_S: '0.2'}});
  return {status: r.status, out: (r.stdout || '').trim()};
}
function pins(tree, dir, ident) {
  const r = helper(tree, ['pins', '--repo', dir], ident);
  let json = null;
  try { json = JSON.parse(r.out); } catch (_) { /* error text */ }
  return {...r, json};
}
const P = (harness, model = 'm', effort = 'default') => ({harness, model, effort});
const same = (got, want) => JSON.stringify(got) === JSON.stringify(want);
function starts() {
  return fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').split('\n').filter(Boolean)
    .map((l) => JSON.parse(l)).filter((a) => a[1] === 'worker-start');
}
function argvOf(a, name) { const i = a.indexOf(name); return i < 0 ? null : a[i + 1]; }

// Each row returns null on pass or a string on failure.
const rows = {
  1(tree) {
    const dir = repo({'.dely/pins.json': {implement: P('claude', 'a'), review: P('codex', 'b')},
                      '.dely/local/pins.json': {review: P('cursor', 'c')}});
    const r = pins(tree, dir);
    const t = path.join(dir, '.dely/pins.json'), l = path.join(dir, '.dely/local/pins.json');
    const want = {implement: {harness: 'claude', model: 'a', effort: 'default', source: 'team', file: t},
                  review: {harness: 'cursor', model: 'c', effort: 'default', source: 'local', file: l}};
    return r.status === 0 && same(r.json, want) ? null : 'status ' + r.status + ' ' + r.out;
  },
  2(tree) {
    const main = repo({'.dely/pins.json': {implement: P('claude', 'a'), review: P('codex', 'b')}});
    commit(main, '.dely/pins.json');
    fs.mkdirSync(path.join(main, '.dely/local'), {recursive: true});
    fs.writeFileSync(path.join(main, '.dely/local/pins.json'), JSON.stringify({review: P('cursor', 'c')}));
    const wt = path.join(root, 'wt' + (++n));
    sh(main, 'git', 'worktree', 'add', '-q', '-b', 'w' + n, wt);
    const a = pins(tree, wt);
    if (a.status !== 0 || !a.json || a.json.review.source !== 'local' ||
        a.json.review.file !== path.join(main, '.dely/local/pins.json') || a.json.implement.source !== 'team')
      return 'worktree without its own file should read the main checkout: ' + a.out;
    fs.mkdirSync(path.join(wt, '.dely/local'), {recursive: true});
    fs.writeFileSync(path.join(wt, '.dely/local/pins.json'), JSON.stringify({review: P('antigravity', 'd')}));
    const b = pins(tree, wt);
    if (b.status !== 0 || !b.json || b.json.review.harness !== 'antigravity' ||
        b.json.review.file !== path.join(wt, '.dely/local/pins.json'))
      return 'worktree with its own file should win: ' + b.out;
    return null;
  },
  3(tree) {
    const dir = repo({});
    const r = pins(tree, dir, 'codex');
    const side = {harness: 'codex', model: 'default', effort: 'default', source: 'control', file: null};
    return r.status === 0 && same(r.json, {implement: side, review: side}) ? null : 'status ' + r.status + ' ' + r.out;
  },
  4(tree) {
    const dir = repo({}, '# x\n<!-- dely:begin -->\n| `implement` | Claude Code | m | e |\n<!-- dely:end -->\n');
    const r = pins(tree, dir, 'codex');
    return r.status !== 0 && r.out.includes('.dely/pins.json') && !r.json ? null : 'status ' + r.status + ' ' + r.out;
  },
  5(tree) {
    const ok = {implement: P('claude', 'a'), review: P('codex', 'b')};
    const cases = {
      'typo key': {...ok, reveiw: P('cursor')},
      'unknown harness': {...ok, review: P('nope')},
      'missing effort': {...ok, review: {harness: 'codex', model: 'b'}},
      'invalid JSON': '{"implement": ',
    };
    for (const [name, body] of Object.entries(cases)) {
      const dir = repo({'.dely/pins.json': body});
      const r = pins(tree, dir, 'codex');
      if (r.status === 0 || r.json || !r.out.includes(path.join(dir, '.dely/pins.json')))
        return name + ' should fail naming the file: status ' + r.status + ' ' + r.out;
    }
    return null;
  },
  6(tree) {
    const table = '| Phase | Harness | Model | Effort |\n| --- | --- | --- | --- |\n' +
      '| `implement` | Claude Code | old-model | low |\n| `review` | Claude Code | old-model | low |\n';
    const dir = repo({'.dely/pins.json': {implement: P('claude', 'a'), review: P('claude', 'b')},
                      '.dely/local/pins.json': {implement: P('codex', 'pin-model', 'high')}}, table);
    fs.writeFileSync(path.join(root, 'calls.jsonl'), '');
    const d = helper(tree, ['dispatch', '--repo', dir, '--run', 'fixture-run', '--phase', 'implement', '--spec-file', '.dely/local/runs/fixture-run/spec.md']);
    const s = starts();
    if (!d.out.includes('DISPATCHED') || !s.length || argvOf(s[0], '--agent') !== 'codex' ||
        argvOf(s[0], '--model') !== 'pin-model' || argvOf(s[0], '--effort') !== 'high')
      return 'dispatch should launch the personal pin: ' + d.out + ' ' + JSON.stringify(s[0]);
    fs.writeFileSync(path.join(root, 'calls.jsonl'), '');
    helper(tree, ['preflight', '--repo', dir, '--run', 'fixture-run']);
    const byTitle = Object.fromEntries(starts().map((a) => [argvOf(a, '--task-title'), a]));
    const pi = byTitle['preflight-implement'], pr = byTitle['preflight-review'];
    if (!pi || argvOf(pi, '--agent') !== 'codex' || argvOf(pi, '--model') !== 'pin-model')
      return 'preflight should launch the personal implement pin: ' + JSON.stringify(pi);
    if (!pr || argvOf(pr, '--agent') !== 'claude' || argvOf(pr, '--model') !== 'b')
      return 'preflight should launch the team review pin: ' + JSON.stringify(pr);
    return null;
  },
};

function mutant(name, edits) {
  const dir = path.join(root, 'mutant-' + name);
  fs.cpSync(snap, dir, {recursive: true});
  const file = path.join(dir, 'skills/delivery/scripts/dely.js');
  let src = fs.readFileSync(file, 'utf8');
  for (const [needle, repl] of edits) {
    assert(src.includes(needle), 'update the ' + name + ' mutation for this candidate: ' + needle);
    src = src.replace(needle, () => repl);
  }
  fs.writeFileSync(file, src);
  return dir;
}
const agentsTable = (phaseExpr) => `{ const md = fs.readFileSync(path.join(f.repo, "AGENTS.md"), "utf8");
    const row = md.split("\\n").find((l) => new RegExp("^\\\\|\\\\s*\`?" + ${phaseExpr} + "\`?\\\\s*\\\\|").test(l));
    const [, hn, mo, ef] = row.split("|").slice(1).map((c) => c.trim().replace(/\`/g, ""));
    const hh = loadHarnesses().find((x) => x.name === hn);
    return { phase: ${phaseExpr}, agent: hh.id, model: mo, effort: ef, modelFlag: hh.modelFlag, effortFlag: hh.effortFlag, modelPin: hh.modelPin }; }`;
const mutants = [
  ['first-file-only', 1, [['const hit = sources.find((s) => phase in s[2]);',
    'const hit = sources.length && phase in sources[0][2] ? sources[0] : undefined;']]],
  ['worktree-only', 2, [['const main = mainCheckout(repo);\n  if (!main) return null;', 'const main = null;\n  if (!main) return null;']]],
  ['main-wins', 2, [['if (fs.existsSync(own)) return own;', 'if (fs.existsSync(own) && !mainCheckout(repo)) return own;']]],
  ['control-throws', 3, [['const id = selfHarness();', 'const id = null;']]],
  ['control-claude', 3, [['const id = selfHarness();', 'const id = "claude";']]],
  ['block-ignored', 4, [['if (agents.includes(OLD_BLOCK)) {', 'if (false) {']]],
  ['typo-ignored', 5, [['if (!PHASES.includes(k)) fail(', 'if (false) fail(']]],
  ['dispatch-agents-md', 6, [['const p = pin(f.repo, f.phase);',
    'const p = (() => ' + agentsTable('f.phase') + ')();']]],
  ['preflight-agents-md', 6, [['const pins = PHASES.map((ph) => resolved[ph]);',
    'const pins = PHASES.map((ph) => (() => ' + agentsTable('ph') + ')());']]],
];
const redRows = new Set();
for (const [name, row, edits] of mutants) {
  const tree = mutant(name, edits);
  const why = rows[row](tree);
  assert(why, 'mutant ' + name + ' must fail row ' + row);
  redRows.add(row);
  console.log('RED: mutant ' + name + ' fails row ' + row + ': ' + String(why).split('\n')[0].slice(0, 150));
}
for (const r of [1, 2, 3, 4, 5, 6]) assert(redRows.has(r), 'no mutant turned row ' + r + ' RED');
for (const r of [1, 2, 3, 4, 5, 6]) {
  const why = rows[r](snap);
  assert.equal(why, null, 'candidate fails row ' + r + ': ' + why);
  console.log('GREEN: row ' + r);
}
console.log('GREEN: candidate resolves pins as specified');
JS
node "$stub/check.cjs" "$snap" "$stub"
```

**Pass:** every mutant prints RED for the row it is named for, and the candidate
prints GREEN for rows 1 to 6. If a mutation assert fires, update that needle;
it is not a candidate failure. A GREEN candidate with a row that no mutant
turned RED proves nothing, and the script refuses it. Keep the fixture
directory and output with the probe report; remove it after recording the
result.

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
fs.mkdirSync(path.join(root, 'repo/.dely'));
fs.writeFileSync(path.join(root, 'repo/.dely/pins.json'), JSON.stringify({
  implement: {harness: 'claude', model: 'default', effort: 'default'},
  review: {harness: 'claude', model: 'default', effort: 'default'}}));
fs.mkdirSync(path.join(root, 'repo/.dely/local/runs/fixture-run'), {recursive: true});
fs.writeFileSync(path.join(root, 'repo/.dely/local/runs/fixture-run/spec.md'), 'Fixture only.');
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
  if (verb === 'dispatch') args.push('--phase', 'implement', '--spec-file', '.dely/local/runs/fixture-run/spec.md');
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

## Stub row — worker release

Run this from the observer shell with `snap` set to the candidate snapshot.
It uses a fake Orca executable and isolated homes, creates no real Run or
worker, and checks seven deliberately wrong copies before the candidate. Run it
when `wait`, `log`, or the settle logic changes. Its fake Orca answers `wait`
with two batches: a first that never settles, carrying only an Orca-rejected
`worker_done` for `done-rejected`; then a settling batch with accepted
`worker_done` for `done-ok` (twice) and `done-kept`, an Orca-rejected
`worker_done` for `done-bad`, a `question` for `asks` and an `escalation` for
`escalates`.

```bash
stub=$(mktemp -d "$HOME/dely-probe/release.XXXXXX")
cat > "$stub/check.cjs" <<'JS'
const fs = require('fs'), path = require('path'), assert = require('assert');
const {spawnSync} = require('child_process');
const [snap, root] = process.argv.slice(2);
const rel = 'skills/delivery/scripts/dely.js';
fs.writeFileSync(path.join(root, 'orca.js'), `
const fs = require('fs');
const a = process.argv.slice(2), cmd = a[1], root = process.env.FIXTURE_ROOT;
fs.appendFileSync(root+'/calls.jsonl', JSON.stringify(a)+'\\n');
const arg = (k) => a[a.indexOf(k)+1];
const msg = (type, id, rejected) => ({type, subject: type+' '+id, payload: {dispatchId: id,
  ...(rejected ? {_orcaLifecycleRejection: {code:'dispatch_capability_invalid'}} : {})}});
let reply = {ok:true, result:{}};
if (cmd === 'check' && !a.includes('--ack')) {
  let n = 0; try {n = +fs.readFileSync(root+'/count','utf8')} catch {}
  fs.writeFileSync(root+'/count', String(n+1));
  reply.result = n === 0
    ? {deliveryId:'rejected-batch', messages:[msg('worker_done','done-rejected',true)]}
    : {deliveryId:'accepted-batch', messages:[msg('worker_done','done-ok'),
        msg('worker_done','done-bad',true), msg('worker_done','done-kept'),
        msg('worker_done','done-ok'), msg('question','asks'),
        msg('escalation','escalates')]};
}
if (cmd === 'worker-release') {
  const id = arg('--dispatch');
  reply.result = id === 'done-kept' ? {dispatchId:id, state:'retained', reason:'user_takeover'}
    : {dispatchId:id, state:'released', processAction:'none'};
}
if (cmd === 'worker-list') {
  if (process.env.FIXTURE_MODE === 'list-fails')
    reply = {ok:false, error:{code:'list_failed', message:'fixture list failure'}};
  else {
    const workers = [{dispatchId:'reclaimable-a', dispatchStatus:'completed'}];
    if (arg('--terminal-state') !== 'reclaimable')
      workers.push({dispatchId:'still-running', dispatchStatus:'dispatched'});
    reply.result = {workers, page:{hasMore:false}};
  }
}
console.log(JSON.stringify(reply));
`);
function run(copy, verb, mode) {
  const home = path.join(root, 'home-' + copy);
  fs.mkdirSync(path.join(home, '.dely'), {recursive: true});
  fs.rmSync(path.join(home, '.dely/log.jsonl'), {force: true});
  fs.rmSync(path.join(root, 'count'), {force: true});
  fs.writeFileSync(path.join(root, 'calls.jsonl'), '');
  const args = [path.join(root, copy, rel), verb, '--run', 'fixture-run'];
  if (verb === 'wait') args.push('--control', 'claude', '--timeout-min', '0.05');
  else args.push('--json', '{"outcome":"fixture"}');
  const r = spawnSync(process.execPath, args, {encoding:'utf8', timeout:10000,
    env:{...process.env, HOME:home, ORCA_TERMINAL_HANDLE:'fixture-terminal',
      ORCA_CLI_COMMAND:path.join(root,'orca.js'), FIXTURE_ROOT:root, FIXTURE_MODE:mode,
      DELY_POLL_S:'0.02'}});
  assert(!r.error, String(r.error));
  const lines = fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n');
  const calls = lines.filter(Boolean).map(l => JSON.parse(l));
  const logFile = path.join(home, '.dely/log.jsonl');
  const events = fs.existsSync(logFile) ?
    fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l)) : [];
  return {status: r.status, stdout: r.stdout, calls, events};
}
const released = (r) => r.calls.filter(c => c[1] === 'worker-release').map(c => c[3]).sort();
const expectWait = [{dispatchId:'done-ok', state:'released'},
  {dispatchId:'done-kept', state:'retained', reason:'user_takeover'}];
const checks = {
  wait(copy) {
    const r = run(copy, 'wait', 'wait');
    assert.equal(r.status, 0, 'wait must exit 0');
    const out = JSON.parse(r.stdout);
    assert.equal(out.SETTLED, 'accepted-batch');
    for (const id of ['done-rejected', 'done-bad'])
      assert(!released(r).includes(id), id + ' released');
    const alive = ['asks', 'escalates'].filter(id => released(r).includes(id));
    assert(!alive.length, alive.join(' and ') + ' released');
    for (const id of ['done-ok', 'done-kept'])
      assert(released(r).filter(x => x === id).length <= 1, id + ' released twice');
    assert.deepEqual(released(r), ['done-kept', 'done-ok'], 'no release of done-ok and done-kept once each');
    assert.deepEqual(Object.keys(out), ['SETTLED', 'messages', 'release']);
    assert.deepEqual(out.release, expectWait, "state not Orca's");
    const settled = r.events.filter(e => e.event === 'settled');
    assert.equal(settled.length, 1);
    assert.deepEqual(settled[0].release, expectWait, "logged state not Orca's");
  },
  log(copy) {
    const r = run(copy, 'log', 'ok');
    assert.equal(r.status, 0, 'log must exit 0');
    assert(!released(r).includes('still-running'), 'still-running released');
    assert.deepEqual(released(r), ['reclaimable-a'], 'no release of reclaimable-a');
    const listed = r.calls.filter(c => c[1] === 'worker-list');
    assert(listed.length >= 1 && listed.every(c => c.join(' ').includes('--terminal-state reclaimable')),
      'worker-list was not filtered');
    const ev = r.events.filter(e => e.event === 'delivery');
    assert.equal(ev.length, 1);
    assert.deepEqual(ev[0].release, [{dispatchId:'reclaimable-a', state:'released'}], 'delivery release');
    assert(!('releaseError' in ev[0]), 'releaseError without a failure');
  },
  logListFails(copy) {
    const r = run(copy, 'log', 'list-fails');
    assert.equal(r.status, 0, 'log must exit 0 when the listing fails');
    const ev = r.events.filter(e => e.event === 'delivery');
    assert.equal(ev.length, 1, 'delivery event still written');
    assert.equal(ev[0].releaseError, 'list_failed', 'releaseError');
    assert.deepEqual(ev[0].release, [], 'release when the listing fails');
    assert.deepEqual(released(r), []);
  },
};
const lines = (...l) => l.join('\n');
const none = [['const release = [...new Set(done.filter(Boolean))].map(releaseWorker);',
    'const release = [];'],
  ['const swept = releaseReclaimable(f.run);', 'const swept = {release: [], releaseError: null};']];
const mutants = [
  ['a: no release at all', none, 'wait', 'no release of done-ok'],
  ['b: releases every settling message', [[
    'const done = msgs.filter((m) => !isRejected(m) && m.type === "worker_done").map(messageDispatchId);',
    'const done = msgs.filter(settling).map(messageDispatchId);']], 'wait', 'asks and escalates released'],
  ['c: the settle filter drops the rejection test', [[
    'const done = msgs.filter((m) => !isRejected(m) && m.type === "worker_done").map(messageDispatchId);',
    'const done = msgs.filter((m) => m.type === "worker_done").map(messageDispatchId);']],
    'wait', 'done-bad released'],
  ['d: hard-coded state', [[
    'const entry = { dispatchId: id, state: res.state };',
    'const entry = { dispatchId: id, state: "released" };']], 'wait', "state not Orca's"],
  ['e: log lists without the filter', [[
    lines('      "--terminal-state",', '      "reclaimable",', ''), '']], 'log', 'still-running released'],
  ['f: releases in a batch that does not settle', [[
    '      if (msgs.some(settling)) {',
    lines('      for (const m of msgs) if (m.type === "worker_done" && messageDispatchId(m))',
      '        releaseWorker(messageDispatchId(m));', '      if (msgs.some(settling)) {')]],
    'wait', 'done-rejected released'],
  ['g: no de-duplication', [[
    '[...new Set(done.filter(Boolean))].map(releaseWorker)',
    'done.filter(Boolean).map(releaseWorker)']], 'wait', 'done-ok released twice'],
];
for (const copy of ['candidate', ...mutants.map((m, i) => 'wrong-' + 'abcdefg'[i])])
  fs.cpSync(snap, path.join(root, copy), {recursive: true});
mutants.forEach(([name, edits, check, token], i) => {
  const copy = 'wrong-' + 'abcdefg'[i], file = path.join(root, copy, rel);
  let source = fs.readFileSync(file, 'utf8');
  for (const [needle, text] of edits) {
    assert(source.includes(needle), 'update the wrong-copy mutation for this candidate: ' + name);
    source = source.replace(needle, () => text);
  }
  fs.writeFileSync(file, source);
  let failed = null;
  try { checks[check](copy); } catch (e) { failed = e; }
  assert(failed, 'wrong copy ' + name + ' passed ' + check);
  assert(String(failed.message).includes(token),
    'wrong copy ' + name + ' failed for another reason: ' + failed.message);
  console.log('RED: ' + name + ' fails ' + check + ': ' + failed.message.split('\n')[0]);
});
for (const name of Object.keys(checks)) { checks[name]('candidate'); console.log('GREEN: ' + name); }
console.log('GREEN: candidate releases exactly the accepted worker_done and reclaimable dispatches');
JS
node "$stub/check.cjs" "$snap" "$stub"
```

**Pass:** seven `RED` lines print, one per wrong copy, each failing for the
named reason; then three `GREEN` lines and the final `GREEN` line; every
assertion passes. The check proves, mechanically, that `wait` releases exactly
`done-ok` and `done-kept`, each once, and never `done-bad` (an Orca-rejected
`worker_done` inside the settling batch), `done-rejected` (one in a batch that
never settles), `asks` or `escalates`; that `SETTLED` and the `settled` event
carry the two states Orca returned, including `retained` with `user_takeover`;
and that `log` releases only what Orca lists under `--terminal-state
reclaimable`, records it, and still writes the event when the listing fails.
The wrong copies are: (a) no release; (b) every settling message released,
failing on `asks and escalates`; (c) the settle filter without its rejection
test, failing on `done-bad`; (d) a hard-coded state; (e) `log` without the
filter; (f) a release loop before the settle check, failing on
`done-rejected`; (g) no de-duplication, failing on `done-ok` released twice.
They run before the candidate and log into their own homes. Keep the fixture
directory and output with the probe report; remove it after recording the
result.

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

Run this row when `start()` in `dely.js` or the `omp` entry changes, and after
an OMP or Orca upgrade. Build a probe repository under `~/dely-probe/` whose
`implement` pin is OMP with a Model `selector` from `omp models --json` and an
Effort that is one of that model's `thinking` levels. The pinned model and
level must differ from OMP's configured default. `probe/mkrepo.sh` writes
whatever harness ids it is given; OMP needs no trust step. From that
repository run `dely dispatch` for `implement`.

**Pass:** `dely dispatch` prints `DISPATCHED <id>` without a model check,
because Orca does not report OMP's model (stablyai/orca#24436). The receipt's
`launch.effective.model` equals `selector:level`. In the OMP session JSONL
under `~/.omp/agent/sessions/`: the last `model_change` before the first user
message and every assistant message is the pinned model, and the last
`thinking_level_change` before the first user message is the pinned level.

## Step 9 — row 9, OMP worker with an invalid pin

Run this row when `start()` in `dely.js` or the `omp` entry changes. Same
probe-repository setup as row 8, with a selector `omp models --json` does not
offer.

**Pass:** `dely dispatch` prints `NO_ACK` and that session has no assistant
message. If the worker acknowledged and completed on OMP's default model, OMP
fell back instead of stopping.

## Step 10 — row 10, OMP worker with Model `default`

Run this row when `start()` in `dely.js` or the `omp` entry changes. Same
probe-repository setup as row 8, with Model `default` and Effort `default`.

**Pass:** the `worker-start` argv has no `--model`, and the worker
transcript's first user message has no `dely-pin:` line. Either present is a
fail.

## Step 11 — row 11, a second `dely-pin:` line in an interactive OMP session

Run this row when `extensions/dely-pin.ts` changes.
Open an interactive OMP session (not a `dely dispatch`). After it has
started, send a second prompt that carries a `dely-pin:` line and read its
model.

**Pass:** the session's model is unchanged from before that prompt. If the
model switched, the extension applied the pin on a start after the first.

## Step 12 — row 12, OMP worker with a level the model does not offer

Run this row when `start()` in `dely.js` or the `omp` entry changes. Same
probe-repository setup as row 8, with a valid Model `selector` and an Effort
the model does not offer, so the launch carries `--model selector:bogus`.

**Pass:** `dely dispatch` prints `NO_ACK` or `FAILED`, and no session has an
assistant message.

## Step 13 — row 13, Pi worker with a valid pin

Run this row when `start()` in `dely.js`, the extension or the `pi` entry
changes, after a Pi upgrade, and after an Orca upgrade.
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
changes, after a Pi upgrade, and after an Orca upgrade.
Same probe-repository setup as row 13's dispatch, with a selector
`pi --list-models` does not offer.

**Pass:** `dely dispatch` prints `NO_ACK` whose quote contains
`DELY-PIN-FAIL`, and that session has no assistant message.

## Step 15 — row 15, Pi worker with a level the model does not offer

Run this row when `start()` in `dely.js`, the extension or the `pi` entry
changes, after a Pi upgrade, and after an Orca upgrade.
Same probe-repository setup as row 13's dispatch, with a valid model selector
and an effort level that the model does not offer (for example `max` on
`google-vertex/gemini-3.5-flash`).

**Pass:** `dely dispatch` prints `NO_ACK` whose quote contains
`DELY-PIN-FAIL`, and that session has no assistant message.

## Step 16 — row 16, a Pi worker that dies after it acknowledges

Run this row when `start()` in `dely.js`, the extension or the `pi` entry
changes, after a Pi upgrade, and after an Orca upgrade.
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
- delete the candidate and last-release snapshots;
- keep parameterized worker and Control paths so their trust entries survive;
- remove the argv, rejected-message and worker-release fixture directories after
  recording them;
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
0.87.1, 0.99.1 and 1.0.2. Pi's trust layout on other machines. A pinned Pi worker that did
not load the extension, which runs its own default unseen. A preflight that leaks
its worker. A heartbeat-only acknowledgement, because the argv stub's fixture
returns one batch. An OMP worker on Orca older than 1.4.224, which refuses `--model`. An Orca
upgrade reruns the live worker row for each deployment harness, the Control row
once per wake mode, rows 4 and 5, and Pi rows 13–16, so the other supported
harnesses are not re-verified against the new Orca.

## Results

Put the table in the pull request body: one line per row, with the verdict, the
harness and role (or row number), and what was left behind.
