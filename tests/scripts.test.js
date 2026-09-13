"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DELY_JS = path.join(ROOT, "skills/delivery/scripts/dely.js");
const DELY_SH = path.join(ROOT, "skills/delivery/scripts/dely");
const FAKE = path.join(ROOT, "tests/fixtures/fake-orca.js");

const DEFAULT_AGENTS = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Cursor Agent CLI | cursor-grok-4.6-high | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dely-test-"));
}

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

function keyOf(repo, control, wake, implement, review) {
  return `repo=${repo};control=${control}/${wake};implement=${implement};review=${review}`;
}

function objectiveOf(key) {
  return `dely verify ${crypto.createHash("sha256").update(key, "utf8").digest("hex").slice(0, 12)}`;
}

function defaultKey(repo, control, wake) {
  return keyOf(
    repo,
    control,
    wake,
    "cursor/cursor-grok-4.6-high/default",
    "codex/gpt-5.6-sol/high"
  );
}

function passRun(id, key) {
  return {
    id,
    objective: objectiveOf(key),
    created_at: "2026-09-11T09:00:00Z",
    tasks: [
      {
        task_title: "dely-verify-verdict",
        result: { verdict: "PASS", key },
      },
    ],
  };
}

function readLog(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function runDely(args, ctx, extraEnv) {
  extraEnv = extraEnv || {};
  const timeout = extraEnv.SPAWN_TIMEOUT_MS;
  const cwd = extraEnv.CWD || ctx.repo;
  const env = Object.assign({}, process.env, extraEnv, {
    ORCA_CLI_COMMAND: FAKE,
    FAKE_ORCA_SCENARIO: ctx.scenarioPath,
    FAKE_ORCA_LOG: ctx.logPath,
    FAKE_ORCA_STATE: ctx.statePath,
    HOME: ctx.home,
    DELY_POLL_MS: extraEnv.DELY_POLL_MS != null ? String(extraEnv.DELY_POLL_MS) : "20",
    DELY_ACK_S: extraEnv.DELY_ACK_S != null ? String(extraEnv.DELY_ACK_S) : "1",
    DELY_SILENCE_S: extraEnv.DELY_SILENCE_S != null ? String(extraEnv.DELY_SILENCE_S) : "60",
    DELY_DEADLINE_S: extraEnv.DELY_DEADLINE_S != null ? String(extraEnv.DELY_DEADLINE_S) : "30",
    DELY_QUIET_S: extraEnv.DELY_QUIET_S != null ? String(extraEnv.DELY_QUIET_S) : "0.05",
    DELY_QUIET_MIN_S: extraEnv.DELY_QUIET_MIN_S != null ? String(extraEnv.DELY_QUIET_MIN_S) : "0.05",
    DELY_VERIFY_DEADLINE_S:
      extraEnv.DELY_VERIFY_DEADLINE_S != null ? String(extraEnv.DELY_VERIFY_DEADLINE_S) : "30",
  });
  delete env.SPAWN_TIMEOUT_MS;
  delete env.CWD;
  return spawnSync(process.execPath, [DELY_JS, ...args], {
    encoding: "utf8",
    env,
    cwd,
    timeout,
  });
}

function setup(agents, scenarioFn) {
  const dir = tmpDir();
  const repo = fs.realpathSync(dir);
  write(path.join(repo, "AGENTS.md"), agents || DEFAULT_AGENTS);
  write(path.join(repo, "task.md"), "# task\n");
  const home = path.join(repo, "home");
  fs.mkdirSync(home, { recursive: true });
  const ctx = {
    repo,
    home,
    scenarioPath: path.join(repo, "scenario.json"),
    logPath: path.join(repo, "orca.log"),
    statePath: path.join(repo, "orca.state.json"),
  };
  const scenario = typeof scenarioFn === "function" ? scenarioFn(repo) : scenarioFn;
  if (scenario && scenario.currentRun === undefined) scenario.currentRun = "run_live";
  write(ctx.scenarioPath, JSON.stringify(scenario, null, 2));
  gitInit(repo);
  return ctx;
}

function hasFlagPair(argv, a, b) {
  const i = argv.indexOf(a);
  return i >= 0 && argv[i + 1] === b;
}

function hasRelease(log, dispatchId) {
  return log.some(
    (argv) =>
      argv[0] === "orchestration" && argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", dispatchId)
  );
}

function hasClose(log, handle) {
  return log.some((argv) => argv[0] === "terminal" && argv[1] === "close" && hasFlagPair(argv, "--terminal", handle));
}

function adoptedWorkerDoneScenario() {
  return {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", from_handle: "term_ag", dispatchId: "disp_ag", body: "ok" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_ag",
        dispatchStatus: "settled",
        agentTerminalHandle: "term_ag",
        ownershipState: "external",
        retainedReason: "external_terminal",
        terminalState: "retained",
      },
    ],
  };
}

test("dispatch refuses without a PASS verdict for the exact key", () => {
  let cursorKey = "";
  const ctx = setup(DEFAULT_AGENTS, (repo) => {
    cursorKey = defaultKey(repo, "cursor", "background");
    return {
      runs: [passRun("run_other", defaultKey(repo, "claude", "background"))],
      workerStart: { dispatchId: "disp_x", state: "ready", handle: "term_w" },
    };
  });
  const status = runDely(["status", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(status.status, 1);
  assert.match(status.stdout, /^NONE\n/);
  const dispatched = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx
  );
  assert.equal(dispatched.status, 3);
  assert.equal(
    dispatched.stdout,
    `REFUSED no PASS verdict for key ${cursorKey}; run dely verify\n`
  );
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
});

test("adopt starts the worker only after output quiescence", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const ctx = setup(agents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "antigravity/default/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_ag", state: "ready", handle: "term_ag" },
    terminalHandle: "term_ag",
    changeLastOutputForMs: 4000,
    deliveries: [
      {
        deliveryId: "dv_ack",
        messages: [{ type: "heartbeat", from_handle: "term_ag", subject: "ack", dispatchId: "disp_ag" }],
      },
    ],
  }));
  const t0 = Date.now();
  const r = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
      "--title",
      "dryrun-implement",
    ],
    ctx
  );
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^DISPATCHED disp_ag term_ag ack=/);
  assert.ok(elapsed >= 4000, `adopt returned in ${elapsed}ms, expected >= 4000`);
  const log = readLog(ctx.logPath);
  const start = log.find((argv) => argv[0] === "orchestration" && argv[1] === "worker-start");
  assert.ok(start);
  assert.ok(start.includes("--terminal"));
  assert.ok(!log.some((argv) => argv.includes("tui-idle")));
  const showsBeforeStart = log.filter((argv) => argv[0] === "terminal" && argv[1] === "show").length;
  assert.ok(showsBeforeStart >= 2);
});

test("every spec carries the acknowledgement instruction", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: { dispatchId: "disp_1", state: "ready", handle: "term_w" },
    deliveries: [
      {
        deliveryId: "dv_ack",
        messages: [{ type: "heartbeat", from_handle: "term_w", subject: "ack", dispatchId: "disp_1" }],
      },
    ],
  }));
  const r = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx
  );
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const start = readLog(ctx.logPath).find((argv) => argv[0] === "orchestration" && argv[1] === "worker-start");
  const spec = start[start.indexOf("--spec") + 1];
  assert.equal(
    spec,
    "Read task.md in the worktree root and follow it exactly. FIRST ACTION: send one heartbeat with --subject ack --phase investigating using the command in your Orca preamble."
  );
  assert.ok(start.includes("--model"));
  assert.equal(start[start.indexOf("--model") + 1], "cursor-grok-4.6-high");
  assert.ok(!start.includes("--effort"));
});

test("NO_ACK stops the dispatch and never retries into the same terminal", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: { dispatchId: "disp_1", state: "ready", handle: "term_w" },
    deliveries: [],
    screenTail: ["still starting"],
  }));
  const r = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx,
    { DELY_ACK_S: "0.15" }
  );
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stdout, /^NO_ACK disp_1 /);
  const log = readLog(ctx.logPath);
  assert.ok(log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "disp_1")));
  assert.ok(log.some((argv) => argv[0] === "terminal" && argv[1] === "close" && hasFlagPair(argv, "--terminal", "term_w")));
  assert.ok(
    !log.some(
      (argv) =>
        argv[0] === "orchestration" &&
        argv[1] === "worker-start" &&
        argv.includes("--terminal") &&
        argv.includes("--retry-of")
    )
  );
});

test("wait swallows heartbeats and exits only on settle", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      { deliveryId: "dv1", messages: [{ type: "heartbeat", from_handle: "term_w", dispatchId: "disp_1" }] },
      {
        deliveryId: "dv2",
        messages: [{ type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "ok" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_w",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
      },
    ],
    lastOutputAt: "now",
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^SETTLED worker_done /);
  assert.ok(r.stdout.indexOf("heartbeat") < 0 || r.stdout.indexOf("SETTLED heartbeat") < 0);
  const log = readLog(ctx.logPath);
  const acks = log.filter((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--ack"));
  assert.ok(acks.some((argv) => hasFlagPair(argv, "--ack", "dv1")));
  assert.ok(acks.some((argv) => hasFlagPair(argv, "--ack", "dv2")));
});

test("wait exits DEADLINE while output is fresh", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_w",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
        projection: { liveness: { verdict: "live" } },
      },
    ],
    lastOutputAt: "now",
    liveness: "live",
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, { DELY_DEADLINE_S: "0.2", DELY_SILENCE_S: "30" });
  assert.equal(r.status, 7, r.stdout + r.stderr);
  assert.match(r.stdout, /^DEADLINE /);
});

test("wait exits SILENT when output is stale after ACK even though Orca says live", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      { deliveryId: "dv1", messages: [{ type: "heartbeat", from_handle: "term_w", dispatchId: "disp_1" }] },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_w",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
        projection: { liveness: { verdict: "live" } },
      },
    ],
    lastOutputAt: "stale",
    staleMs: 200000,
    liveness: "live",
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, { DELY_SILENCE_S: "0.15", DELY_DEADLINE_S: "30" });
  assert.equal(r.status, 6, r.stdout + r.stderr);
  assert.match(r.stdout, /^SILENT disp_1 /);
  const log = readLog(ctx.logPath);
  const stopAt = log.findIndex(
    (argv) => argv[0] === "orchestration" && argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "disp_1")
  );
  assert.ok(stopAt >= 0, "wait did not stop the silent dispatch");
  const again = runDely(["collect", "--run", "run_live"], ctx);
  assert.notEqual(again.status, 6, again.stdout + again.stderr);
  assert.doesNotMatch(again.stdout, /SILENT disp_1/);
  assert.doesNotMatch(again.stdout, /WAITING disp_1/);
  assert.notEqual(again.status, 8, again.stdout + again.stderr);
  assert.doesNotMatch(again.stdout, /FAILED /);
});

test("launcher falls back to Orca's runtime when node is absent", () => {
  const ctx = setup(DEFAULT_AGENTS, { runs: [] });
  const app = path.join(ctx.repo, "Orca.app");
  const mac = path.join(app, "Contents", "MacOS");
  const binDir = path.join(app, "Contents", "Resources", "bin");
  fs.mkdirSync(mac, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  fs.symlinkSync(process.execPath, path.join(mac, "Orca"));
  write(
    path.join(binDir, "orca"),
    `#!/bin/sh
src=$0
while [ -L "$src" ]; do
  dir=$(dirname "$src")
  next=\`readlink "$src"\` || break
  case "$next" in
    /*) src=$next ;;
    *) src="$dir/$next" ;;
  esac
done
ROOT="$(CDPATH= cd -- "$(dirname "$src")/../../.." && pwd)"
ELECTRON="$ROOT/Contents/MacOS/Orca"
CLI="$ROOT/Contents/Resources/app.asar.unpacked/out/cli/index.js"
ELECTRON_RUN_AS_NODE=1 exec "$ELECTRON" "$CLI" "$@"
`
  );
  fs.chmodSync(path.join(binDir, "orca"), 0o755);
  const pathBin = path.join(ctx.repo, "path");
  fs.mkdirSync(pathBin, { recursive: true });
  fs.symlinkSync(path.join(binDir, "orca"), path.join(pathBin, "orca"));
  const pathDirs = [pathBin];
  for (const dir of ["/bin", "/usr/bin", "/sbin", "/usr/sbin"]) {
    if (!fs.existsSync(path.join(dir, "node")) && !fs.existsSync(path.join(dir, "node.exe"))) pathDirs.push(dir);
  }
  const cliDir = path.join(app, "Contents", "Resources", "app.asar.unpacked", "out", "cli");
  fs.mkdirSync(cliDir, { recursive: true });
  fs.copyFileSync(FAKE, path.join(cliDir, "index.js"));
  const env = Object.assign({}, process.env, {
    PATH: pathDirs.join(path.delimiter),
    HOME: ctx.home,
    FAKE_ORCA_SCENARIO: ctx.scenarioPath,
    FAKE_ORCA_LOG: ctx.logPath,
    FAKE_ORCA_STATE: ctx.statePath,
  });
  delete env.ORCA_CLI_COMMAND;
  delete env.DELY_NODE;
  const r = spawnSync(DELY_SH, ["status", "--repo", ctx.repo, "--control", "cursor"], {
    encoding: "utf8",
    env,
  });
  assert.notEqual(r.status, 10, r.stdout + r.stderr);
  assert.match(r.stdout, /^NONE\n/);
});

test("dispatch ACK wait leaves worker_done queued for collect", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: { dispatchId: "disp_1", state: "ready", handle: "term_w" },
    deliveries: [
      {
        deliveryId: "mixed1",
        messages: [
          { type: "heartbeat", from_handle: "term_w", subject: "ack", dispatchId: "disp_1" },
          { type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" },
        ],
      },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "settled",
        agentTerminalHandle: "term_w",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
      },
    ],
  }));
  const dispatched = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx
  );
  assert.equal(dispatched.status, 0, dispatched.stdout + dispatched.stderr);
  assert.match(dispatched.stdout, /^DISPATCHED disp_1 term_w ack=/);
  const afterDispatch = readLog(ctx.logPath);
  assert.ok(
    afterDispatch.some(
      (argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--peek")
    )
  );
  assert.ok(
    !afterDispatch.some(
      (argv) =>
        argv[0] === "orchestration" &&
        argv[1] === "check" &&
        !argv.includes("--peek") &&
        !argv.includes("--all") &&
        !argv.includes("--ack")
    )
  );
  assert.ok(
    !afterDispatch.some((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--ack"))
  );
  const collected = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(collected.status, 0, collected.stdout + collected.stderr);
  assert.match(collected.stdout, /^SETTLED disp_1 worker_done done\n/);
});

test("adopt readiness timeout does not start the worker", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const ctx = setup(agents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "antigravity/default/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_ag", state: "ready", handle: "term_ag" },
    terminalHandle: "term_ag",
    changeLastOutputForMs: 60000,
  }));
  const r = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx,
    { DELY_QUIET_CAP_S: "0.4" }
  );
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAILED readiness timeout after \d+s\n/);
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
  assert.ok(log.some((argv) => argv[0] === "terminal" && argv[1] === "close" && hasFlagPair(argv, "--terminal", "term_ag")));
});

test("adopt keeps polling a failed terminal show until the cap", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const ctx = setup(agents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "antigravity/default/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_ag", state: "ready", handle: "term_ag" },
    terminalHandle: "term_ag",
    terminalShow: "fail",
    terminalShowReason: "terminal not found",
  }));
  const t0 = Date.now();
  const r = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx,
    { DELY_QUIET_CAP_S: "0.35" }
  );
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAILED readiness timeout after \d+s\n/);
  assert.ok(elapsed >= 300, `failed show returned in ${elapsed}ms, expected to poll until the cap`);
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
  assert.ok(log.filter((argv) => argv[0] === "terminal" && argv[1] === "show").length >= 2);
  assert.ok(log.some((argv) => argv[0] === "terminal" && argv[1] === "close"));
});

test("status finds a PASS verdict on run-list page two", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => {
    const key = defaultKey(repo, "cursor", "background");
    const filler = [];
    for (let i = 0; i < 100; i++) {
      filler.push({
        id: "run_old_" + i,
        objective: "other " + i,
        created_at: "2026-09-11T08:00:00Z",
      });
    }
    return { runs: filler.concat([passRun("run_pass", key)]) };
  });
  const r = runDely(["status", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "PASS\n");
  const log = readLog(ctx.logPath);
  const pages = log.filter((argv) => argv[0] === "orchestration" && argv[1] === "run-list");
  assert.ok(pages.length >= 2);
  assert.deepEqual(pages[1], ["orchestration", "run-list", "--limit", "100", "--cursor", "100", "--json"]);
});

test("status surfaces a failed run-list page", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => {
    const filler = [];
    for (let i = 0; i < 100; i++) {
      filler.push({ id: "run_old_" + i, objective: "other", created_at: "2026-09-11T08:00:00Z" });
    }
    return {
      runs: filler.concat([passRun("run_pass", defaultKey(repo, "cursor", "background"))]),
      runListFailCursor: "100",
      runListFailReason: "Unknown command: orchestration run-list 100",
    };
  });
  const r = runDely(["status", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(r.status, 9, r.stdout + r.stderr);
  assert.match(r.stdout, /^ERROR run-list failed: /);
  assert.notEqual(r.stdout, "NONE\n");
});

test("collect surfaces a failed worker-list", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerListError: "connection lost",
    deliveries: [],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_w",
      },
    ],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 9, r.stdout + r.stderr);
  assert.equal(r.stdout, "ERROR worker-list failed: connection lost\n");
});

function fakeOrca(ctx, args) {
  return spawnSync(process.execPath, [FAKE, ...args], {
    encoding: "utf8",
    env: Object.assign({}, process.env, {
      FAKE_ORCA_SCENARIO: ctx.scenarioPath,
      FAKE_ORCA_LOG: ctx.logPath,
      FAKE_ORCA_STATE: ctx.statePath,
    }),
  });
}

function consumingCheck(argv) {
  return (
    argv[0] === "orchestration" &&
    argv[1] === "check" &&
    !argv.includes("--peek") &&
    !argv.includes("--all") &&
    !argv.includes("--ack")
  );
}

const MIXED_DELIVERY = {
  deliveryId: "mixed1",
  messages: [
    { type: "heartbeat", from_handle: "term_w", subject: "ack", dispatchId: "disp_1" },
    { type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" },
  ],
};

test("dispatch observes its ACK without consuming a Delivery", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: { dispatchId: "disp_1", state: "ready", handle: "term_w" },
    deliveries: [MIXED_DELIVERY],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "settled",
        agentTerminalHandle: "term_w",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
      },
    ],
  }));
  const dispatched = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx
  );
  assert.equal(dispatched.status, 0, dispatched.stdout + dispatched.stderr);
  assert.match(dispatched.stdout, /^DISPATCHED disp_1 term_w ack=/);
  const afterDispatch = readLog(ctx.logPath);
  assert.ok(afterDispatch.some((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--peek")));
  assert.ok(!afterDispatch.some(consumingCheck));
  assert.ok(
    !afterDispatch.some((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--ack"))
  );
  const collected = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(collected.status, 0, collected.stdout + collected.stderr);
  assert.match(collected.stdout, /^SETTLED disp_1 worker_done done\n/);
});

test("wait judges a Delivery as a whole", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [MIXED_DELIVERY],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_w",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
      },
    ],
    lastOutputAt: "now",
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, { DELY_DEADLINE_S: "0.2", DELY_SILENCE_S: "30" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^SETTLED heartbeat,worker_done /);
  const log = readLog(ctx.logPath);
  const acks = log.filter((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--ack"));
  assert.equal(acks.length, 1);
  assert.ok(hasFlagPair(acks[0], "--ack", "mixed1"));
});

test("collect reports settles already present in check --all history", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    history: [
      {
        deliveryId: "mixed1",
        messages: [
          { type: "heartbeat", from_handle: "term_w", subject: "ack" },
          { type: "worker_done", from_handle: "term_w", body: "done" },
        ],
      },
    ],
    deliveries: [],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "settled",
        agentTerminalHandle: "term_w",
      },
    ],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^SETTLED disp_1 worker_done done\n/);
  const log = readLog(ctx.logPath);
  assert.ok(
    log.some((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--all"))
  );
});

test("fake Orca replays the oldest Delivery until acknowledged", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_old",
        messages: [
          { type: "status", subject: "s1" },
          { type: "status", subject: "s2" },
        ],
      },
    ],
  });
  const first = JSON.parse(fakeOrca(ctx, ["orchestration", "check", "--run", "run_live", "--json"]).stdout);
  assert.equal(first.result.deliveryId, "dv_old");
  assert.deepEqual(
    first.result.messages.map((m) => m.subject),
    ["s1", "s2"]
  );
  fakeOrca(ctx, ["orchestration", "send", "--run", "run_live", "--type", "status", "--subject", "s3", "--json"]);
  const second = JSON.parse(fakeOrca(ctx, ["orchestration", "check", "--run", "run_live", "--json"]).stdout);
  assert.equal(second.result.deliveryId, "dv_old");
  assert.deepEqual(
    second.result.messages.map((m) => m.subject),
    ["s1", "s2"]
  );
  fakeOrca(ctx, ["orchestration", "check", "--run", "run_live", "--ack", "dv_old", "--json"]);
  const third = JSON.parse(fakeOrca(ctx, ["orchestration", "check", "--run", "run_live", "--json"]).stdout);
  assert.equal(third.result.deliveryId, "dv_2");
  assert.deepEqual(
    third.result.messages.map((m) => m.subject),
    ["s3"]
  );
  const peeked = JSON.parse(
    fakeOrca(ctx, ["orchestration", "check", "--peek", "--run", "run_live", "--json"]).stdout
  );
  assert.equal(peeked.result.deliveryId, null);
  assert.equal(peeked.result.messages.length, 0);
  const mixed = setup(DEFAULT_AGENTS, { deliveries: [MIXED_DELIVERY] });
  const typed = JSON.parse(
    fakeOrca(mixed, [
      "orchestration",
      "check",
      "--wait",
      "--run",
      "run_live",
      "--types",
      "heartbeat",
      "--timeout-ms",
      "20",
      "--json",
    ]).stdout
  );
  assert.equal(typed.result.deliveryId, "mixed1");
  assert.deepEqual(
    typed.result.messages.map((m) => m.type),
    ["heartbeat", "worker_done"]
  );
});

test("fake Orca typed wait wakes on a newer unread type and replays the frozen Delivery", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_frozen",
        messages: [{ type: "status", subject: "s1" }],
      },
    ],
  });
  const frozen = JSON.parse(fakeOrca(ctx, ["orchestration", "check", "--run", "run_live", "--json"]).stdout);
  assert.equal(frozen.result.deliveryId, "dv_frozen");
  assert.deepEqual(
    frozen.result.messages.map((m) => m.type),
    ["status"]
  );
  fakeOrca(ctx, ["orchestration", "send", "--run", "run_live", "--type", "heartbeat", "--subject", "hb", "--json"]);
  const waited = JSON.parse(
    fakeOrca(ctx, [
      "orchestration",
      "check",
      "--wait",
      "--run",
      "run_live",
      "--types",
      "heartbeat",
      "--timeout-ms",
      "20",
      "--json",
    ]).stdout
  );
  assert.equal(waited.result.deliveryId, "dv_frozen");
  assert.notEqual(waited.result.timedOut, true);
  assert.deepEqual(
    waited.result.messages.map((m) => m.type),
    ["status"]
  );
  assert.deepEqual(
    waited.result.messages.map((m) => m.subject),
    ["s1"]
  );
});

test("collect surfaces a failed consuming check", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    checkFailConsume: "mailbox error",
    deliveries: [
      {
        deliveryId: "dv_frozen",
        messages: [{ type: "heartbeat", from_handle: "term_w", subject: "ack" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "settled",
        agentTerminalHandle: "term_w",
      },
    ],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 9, r.stdout + r.stderr);
  assert.equal(r.stdout, "ERROR check failed: mailbox error\n");
  const log = readLog(ctx.logPath);
  assert.ok(log.some((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--all")));
  assert.ok(log.some(consumingCheck));
});

test("collect surfaces a failed acknowledgement", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, {
    rejectAck: true,
    rejectAckReason: "ack rejected",
    deliveries: [
      {
        deliveryId: "dv1",
        messages: [{ type: "heartbeat", from_handle: "term_w", subject: "ack" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_w",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
        projection: { liveness: { verdict: "live" } },
      },
    ],
    lastOutputAt: "now",
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 9, r.stdout + r.stderr);
  assert.equal(r.stdout, "ERROR ack failed: ack rejected\n");
});

test("collect keeps distinct settling messages that share dispatch type and body", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_same",
        messages: [
          { id: "m1", type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" },
          { id: "m2", type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" },
        ],
      },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "settled",
        agentTerminalHandle: "term_w",
      },
    ],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "SETTLED disp_1 worker_done done\nSETTLED disp_1 worker_done done\n");
});

function waitingCollectScenario(extra) {
  return Object.assign(
    {
      deliveries: [],
      workers: [
        {
          dispatchId: "disp_1",
          dispatchStatus: "dispatched",
          agentTerminalHandle: "term_w",
          lastHeartbeatAt: "2026-09-11T09:00:00Z",
          projection: { liveness: { verdict: "live" } },
        },
      ],
      lastOutputAt: "now",
      liveness: "live",
    },
    extra || {}
  );
}

test("collect stops a silent dispatch before SILENT and does not report it again", () => {
  const ctx = setup(
    DEFAULT_AGENTS,
    waitingCollectScenario({
      lastOutputAt: "stale",
      staleMs: 200000,
    })
  );
  const r = runDely(["collect", "--run", "run_live"], ctx, {
    DELY_SILENCE_S: "0.15",
    DELY_DEADLINE_S: "30",
  });
  assert.equal(r.status, 6, r.stdout + r.stderr);
  assert.match(r.stdout, /^SILENT disp_1 /);
  const log = readLog(ctx.logPath);
  assert.ok(
    log.some(
      (argv) => argv[0] === "orchestration" && argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "disp_1")
    ),
    "collect did not stop the silent dispatch"
  );
  const again = runDely(["collect", "--run", "run_live"], ctx, {
    DELY_SILENCE_S: "0.15",
    DELY_DEADLINE_S: "30",
  });
  assert.notEqual(again.status, 6, again.stdout + again.stderr);
  assert.doesNotMatch(again.stdout, /SILENT disp_1/);
  assert.doesNotMatch(again.stdout, /WAITING disp_1/);
  assert.notEqual(again.status, 8, again.stdout + again.stderr);
  assert.doesNotMatch(again.stdout, /FAILED /);
});

test("collect reports DEADLINE from the dispatch dispatchedAt", () => {
  const ctx = setup(
    DEFAULT_AGENTS,
    waitingCollectScenario({
      workers: [
        {
          dispatchId: "disp_1",
          dispatchStatus: "dispatched",
          agentTerminalHandle: "term_w",
          lastHeartbeatAt: "2026-09-11T09:00:00Z",
          dispatchedAt: "2026-09-01 00:00:00",
          projection: { liveness: { verdict: "live" } },
        },
      ],
    })
  );
  const r = runDely(["collect", "--run", "run_live"], ctx, {
    DELY_DEADLINE_S: "30",
    DELY_SILENCE_S: "60",
  });
  assert.equal(r.status, 7, r.stdout + r.stderr);
  assert.match(r.stdout, /^DEADLINE disp_1 /);
});

function deadDispatchScenario(extra) {
  return Object.assign(
    {
      deliveries: [],
      workers: [
        {
          dispatchId: "disp_1",
          dispatchStatus: "failed",
          agentTerminalHandle: "term_w",
          workerState: "exited",
          stage: "stopped",
          lastError: "process died",
          projection: { liveness: { verdict: "exited" } },
        },
      ],
    },
    extra || {}
  );
}

test("collect reports a failed dispatch that sent no message", () => {
  const ctx = setup(DEFAULT_AGENTS, deadDispatchScenario());
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 8, r.stdout + r.stderr);
  assert.equal(r.stdout, "FAILED disp_1 exited process died liveness=exited\n");
});

test("wait reports a failed dispatch that sent no message", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, deadDispatchScenario());
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, {
    DELY_DEADLINE_S: "30",
    DELY_SILENCE_S: "60",
    SPAWN_TIMEOUT_MS: 3000,
  });
  assert.equal(r.status, 8, r.stdout + r.stderr);
  assert.equal(r.stdout, "FAILED disp_1 exited process died liveness=exited\n");
});

test("collect does not report FAILED for a dispatch that settled normally", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    history: [
      {
        deliveryId: "mixed1",
        messages: [
          { type: "heartbeat", from_handle: "term_w", subject: "ack" },
          { type: "worker_done", from_handle: "term_w", body: "done" },
        ],
      },
    ],
    deliveries: [],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "failed",
        agentTerminalHandle: "term_w",
        workerState: "exited",
        lastError: "process died",
        terminalState: "reclaimable",
        projection: { liveness: { verdict: "exited" } },
      },
    ],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^SETTLED disp_1 worker_done done\n/);
  assert.doesNotMatch(r.stdout, /FAILED /);
});

test("collect releases a dead dispatch before FAILED and does not report it again", () => {
  const ctx = setup(DEFAULT_AGENTS, deadDispatchScenario());
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 8, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAILED disp_1 /);
  const log = readLog(ctx.logPath);
  const releaseAt = log.findIndex(
    (argv) =>
      argv[0] === "orchestration" && argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", "disp_1")
  );
  assert.ok(releaseAt >= 0, "collect did not release the dead dispatch");
  const again = runDely(["collect", "--run", "run_live"], ctx);
  assert.notEqual(again.status, 8, again.stdout + again.stderr);
  assert.doesNotMatch(again.stdout, /FAILED /);
});

test("collect reports FAILED and WAITING when one dispatch is dead and one is open", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [],
    workers: [
      {
        dispatchId: "disp_dead",
        dispatchStatus: "failed",
        agentTerminalHandle: "term_dead",
        workerState: "crashed",
        lastError: "boom",
        terminalState: "reclaimable",
        projection: { liveness: { verdict: "exited" } },
      },
      {
        dispatchId: "disp_open",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_open",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
        projection: { liveness: { verdict: "live" } },
      },
    ],
    lastOutputAt: "now",
    liveness: "live",
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.match(r.stdout, /FAILED disp_dead /);
  assert.match(r.stdout, /WAITING disp_open/);
  assert.equal(r.status, 2, r.stdout + r.stderr);
});

test("wait settles a live dispatch after reporting a dead one", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      { deliveryId: "dv1", messages: [{ type: "heartbeat", from_handle: "term_open", dispatchId: "disp_open" }] },
      {
        deliveryId: "dv2",
        messages: [{ type: "worker_done", from_handle: "term_open", dispatchId: "disp_open", body: "ok" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_dead",
        dispatchStatus: "failed",
        agentTerminalHandle: "term_dead",
        workerState: "crashed",
        lastError: "boom",
        terminalState: "reclaimable",
        projection: { liveness: { verdict: "exited" } },
      },
      {
        dispatchId: "disp_open",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_open",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
        projection: { liveness: { verdict: "live" } },
      },
    ],
    lastOutputAt: "now",
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, {
    DELY_DEADLINE_S: "30",
    DELY_SILENCE_S: "60",
    SPAWN_TIMEOUT_MS: 3000,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /FAILED disp_dead /);
  assert.match(r.stdout, /SETTLED /);
});

test("wait checks for a dead dispatch only after consuming", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, {
    checkAllAckedOnly: true,
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "failed",
        agentTerminalHandle: "term_w",
        workerState: "exited",
        lastError: "process died",
        terminalState: "reclaimable",
        projection: { liveness: { verdict: "exited" } },
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, {
    DELY_DEADLINE_S: "30",
    DELY_SILENCE_S: "60",
    SPAWN_TIMEOUT_MS: 3000,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /SETTLED /);
  assert.doesNotMatch(r.stdout, /FAILED /);
  const log = readLog(ctx.logPath);
  const waitAt = log.findIndex(
    (argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--wait")
  );
  const listAt = log.findIndex((argv) => argv[0] === "orchestration" && argv[1] === "worker-list");
  assert.ok(waitAt >= 0, "wait did not consume before judging a dead dispatch");
  assert.ok(listAt < 0 || waitAt < listAt, "dead check ran before consume");
});

test("FAILED reason does not name a stale ready worker state as the cause", () => {
  const ctx = setup(
    DEFAULT_AGENTS,
    deadDispatchScenario({
      workers: [
        {
          dispatchId: "disp_f",
          dispatchStatus: "failed",
          agentTerminalHandle: "term_w",
          workerState: "ready",
          lastError: "boom",
          terminalState: "reclaimable",
          projection: { liveness: { verdict: "live" } },
        },
      ],
    })
  );
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 8, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAILED disp_f /);
  assert.doesNotMatch(r.stdout, /\bready\b/);
});

function runFake(ctx, argv) {
  return spawnSync(process.execPath, [FAKE, ...argv], {
    encoding: "utf8",
    env: Object.assign({}, process.env, {
      FAKE_ORCA_SCENARIO: ctx.scenarioPath,
      FAKE_ORCA_STATE: ctx.statePath,
      FAKE_ORCA_LOG: ctx.logPath,
    }),
  });
}

function gitRunMemory(ctx, run) {
  const file = path.join(ctx.repo, ".git", "dely", "runs", run + ".json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function memoryHolds(memory, id) {
  if (!memory) return false;
  return (memory.stopped || []).indexOf(id) >= 0 || (memory.reported || []).indexOf(id) >= 0;
}

function keepWorkerStateReady(ctx, workers) {
  const scenario = JSON.parse(fs.readFileSync(ctx.scenarioPath, "utf8"));
  scenario.workers = workers;
  write(ctx.scenarioPath, JSON.stringify(scenario, null, 2));
  if (!fs.existsSync(ctx.statePath)) return;
  const state = JSON.parse(fs.readFileSync(ctx.statePath, "utf8"));
  state.stopped = {};
  fs.writeFileSync(ctx.statePath, JSON.stringify(state));
}

test("NO_ACK enters the run memory so a later collect does not name it FAILED", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: { dispatchId: "disp_na", state: "ready", handle: "term_w" },
    deliveries: [],
    screenTail: ["still starting"],
  }));
  const dispatched = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx,
    { DELY_ACK_S: "0.15" }
  );
  assert.equal(dispatched.status, 4, dispatched.stdout + dispatched.stderr);
  assert.match(dispatched.stdout, /^NO_ACK disp_na /);
  keepWorkerStateReady(ctx, [
    {
      dispatchId: "disp_na",
      dispatchStatus: "failed",
      agentTerminalHandle: "term_w",
      workerState: "ready",
      lastError: "no ack",
      projection: { liveness: { verdict: "exited" } },
    },
  ]);
  const listed = JSON.parse(runFake(ctx, ["orchestration", "worker-list", "--run", "run_live", "--json"]).stdout);
  const row = listed.result.workers.find((w) => w.dispatchId === "disp_na");
  assert.equal(row.workerState, "ready");
  assert.equal(row.dispatchStatus, "failed");
  const memory = gitRunMemory(ctx, "run_live");
  const collected = runDely(["collect", "--run", "run_live"], ctx);
  assert.ok(memoryHolds(memory, "disp_na"), "memory=" + JSON.stringify(memory) + " collect=" + collected.status + " " + collected.stdout);
  assert.doesNotMatch(collected.stdout, /FAILED /);
  assert.notEqual(collected.status, 8, collected.stdout + collected.stderr);
});

test("a launch that never reached ready enters the run memory so a later collect does not name it FAILED", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: { dispatchId: "disp_fl", state: "failed", handle: "term_w", reason: "agent_readiness: timeout" },
  }));
  const dispatched = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx
  );
  assert.equal(dispatched.status, 5, dispatched.stdout + dispatched.stderr);
  assert.match(dispatched.stdout, /^FAILED /);
  keepWorkerStateReady(ctx, [
    {
      dispatchId: "disp_fl",
      dispatchStatus: "failed",
      agentTerminalHandle: "term_w",
      workerState: "ready",
      lastError: "agent_readiness",
      projection: { liveness: { verdict: "exited" } },
    },
  ]);
  const listed = JSON.parse(runFake(ctx, ["orchestration", "worker-list", "--run", "run_live", "--json"]).stdout);
  const row = listed.result.workers.find((w) => w.dispatchId === "disp_fl");
  assert.equal(row.workerState, "ready");
  assert.equal(row.dispatchStatus, "failed");
  const memory = gitRunMemory(ctx, "run_live");
  const collected = runDely(["collect", "--run", "run_live"], ctx);
  assert.ok(memoryHolds(memory, "disp_fl"), "memory=" + JSON.stringify(memory) + " collect=" + collected.status + " " + collected.stdout);
  assert.doesNotMatch(collected.stdout, /FAILED /);
  assert.notEqual(collected.status, 8, collected.stdout + collected.stderr);
});

function adoptedFailedWorker(extra) {
  return Object.assign(
    {
      dispatchId: "disp_adopted",
      dispatchStatus: "failed",
      agentTerminalHandle: "term_a",
      workerState: "exited",
      lastError: "boom",
      terminalState: "retained",
      retainedReason: "external_terminal",
      ownershipState: "external",
      projection: { liveness: { verdict: "exited" } },
    },
    extra || {}
  );
}

test("collect reports a retained adopted dispatch once even when worker-release is refused", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [],
    workers: [adoptedFailedWorker()],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 8, r.stdout + r.stderr);
  assert.equal((r.stdout.match(/^FAILED disp_adopted /gm) || []).length, 1, r.stdout);
  const again = runDely(["collect", "--run", "run_live"], ctx);
  assert.notEqual(again.status, 8, again.stdout + again.stderr);
  assert.doesNotMatch(again.stdout, /FAILED /);
});

test("collect reports a dead dispatch once outside a git repository", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [],
    workers: [adoptedFailedWorker()],
  });
  const outside = tmpDir();
  const realRuns = path.join(os.homedir(), ".dely", "runs");
  const beforeReal = fs.existsSync(realRuns) ? fs.readdirSync(realRuns).sort() : [];
  const r1 = runDely(["collect", "--run", "run_live"], ctx, { CWD: outside });
  const r2 = runDely(["collect", "--run", "run_live"], ctx, { CWD: outside });
  const r3 = runDely(["collect", "--run", "run_live"], ctx, { CWD: outside });
  const gitRepo = tmpDir();
  gitInit(gitRepo);
  const gitDirPath = path.join(gitRepo, ".git");
  fs.chmodSync(gitDirPath, 0);
  let r4;
  try {
    r4 = runDely(["collect", "--run", "run_live"], ctx, { CWD: gitRepo });
  } finally {
    try {
      fs.chmodSync(gitDirPath, 0o755);
    } catch (_) {
      /* restore so the temp tree can be removed */
    }
  }
  assert.equal(r1.status, 8, r1.stdout + r1.stderr);
  assert.equal((r1.stdout.match(/^FAILED disp_adopted /gm) || []).length, 1, r1.stdout);
  assert.notEqual(r2.status, 8, r2.stdout + r2.stderr);
  assert.doesNotMatch(r2.stdout, /FAILED /);
  assert.notEqual(r3.status, 8, r3.stdout + r3.stderr);
  assert.doesNotMatch(r3.stdout, /FAILED /);
  assert.notEqual(r4.status, 8, r4.stdout + r4.stderr);
  assert.doesNotMatch(r4.stdout, /FAILED /);
  assert.equal(fs.existsSync(path.join(ctx.home, ".dely", "runs", "run_live.json")), true);
  assert.equal(fs.existsSync(path.join(outside, ".dely")), false);
  const afterReal = fs.existsSync(realRuns) ? fs.readdirSync(realRuns).sort() : [];
  assert.deepEqual(afterReal, beforeReal);
});

test("collect reports once when worker-release returns retained without releasing", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "failed",
        agentTerminalHandle: "term_w",
        workerState: "exited",
        lastError: "boom",
        terminalState: "reclaimable",
        releaseReceipt: "retained",
        projection: { liveness: { verdict: "exited" } },
      },
    ],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 8, r.stdout + r.stderr);
  assert.equal((r.stdout.match(/^FAILED disp_1 /gm) || []).length, 1, r.stdout);
  const again = runDely(["collect", "--run", "run_live"], ctx);
  assert.notEqual(again.status, 8, again.stdout + again.stderr);
  assert.doesNotMatch(again.stdout, /FAILED /);
});

test("wait prints one FAILED line across polls for a retained adopted dispatch", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      { deliveryId: "dv1", messages: [{ type: "heartbeat", from_handle: "term_open", dispatchId: "disp_open" }] },
      { deliveryId: "dv2", messages: [{ type: "heartbeat", from_handle: "term_open", dispatchId: "disp_open" }] },
      { deliveryId: "dv3", messages: [{ type: "heartbeat", from_handle: "term_open", dispatchId: "disp_open" }] },
      {
        deliveryId: "dv4",
        messages: [{ type: "worker_done", from_handle: "term_open", dispatchId: "disp_open", body: "ok" }],
      },
    ],
    workers: [
      adoptedFailedWorker(),
      {
        dispatchId: "disp_open",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_open",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
        projection: { liveness: { verdict: "live" } },
      },
    ],
    lastOutputAt: "now",
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, {
    DELY_DEADLINE_S: "30",
    DELY_SILENCE_S: "60",
    SPAWN_TIMEOUT_MS: 3000,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal((r.stdout.match(/^FAILED disp_adopted /gm) || []).length, 1, r.stdout);
  assert.match(r.stdout, /SETTLED /);
});

test("collect does not report FAILED or WAITING for a Dely-stopped agent dispatch", () => {
  const ctx = setup(
    DEFAULT_AGENTS,
    waitingCollectScenario({
      lastOutputAt: "stale",
      staleMs: 200000,
    })
  );
  const silent = runDely(["collect", "--run", "run_live"], ctx, {
    DELY_SILENCE_S: "0.15",
    DELY_DEADLINE_S: "30",
  });
  assert.equal(silent.status, 6, silent.stdout + silent.stderr);
  const listed = JSON.parse(runFake(ctx, ["orchestration", "worker-list", "--run", "run_live", "--json"]).stdout);
  const row = listed.result.workers.find((w) => w.dispatchId === "disp_1");
  assert.equal(row.dispatchStatus, "failed");
  assert.equal(row.workerState, "stopped");
  assert.equal(row.stage && row.stage.detail, "process_stopped");
  const again = runDely(["collect", "--run", "run_live"], ctx, {
    DELY_SILENCE_S: "0.15",
    DELY_DEADLINE_S: "30",
  });
  assert.doesNotMatch(again.stdout, /FAILED /);
  assert.doesNotMatch(again.stdout, /WAITING disp_1/);
  assert.notEqual(again.status, 8, again.stdout + again.stderr);
  assert.notEqual(again.status, 2, again.stdout + again.stderr);
});

test("collect does not WAITING for a Dely-stopped adopted dispatch", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [],
    workers: [
      {
        dispatchId: "disp_adopt",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_a",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
        terminalState: "retained",
        retainedReason: "external_terminal",
        ownershipState: "external",
        projection: { liveness: { verdict: "live" } },
      },
    ],
    lastOutputAt: "stale",
    staleMs: 200000,
  });
  const silent = runDely(["collect", "--run", "run_live"], ctx, {
    DELY_SILENCE_S: "0.15",
    DELY_DEADLINE_S: "30",
  });
  assert.equal(silent.status, 6, silent.stdout + silent.stderr);
  const listed = JSON.parse(runFake(ctx, ["orchestration", "worker-list", "--run", "run_live", "--json"]).stdout);
  const row = listed.result.workers.find((w) => w.dispatchId === "disp_adopt");
  assert.equal(row.dispatchStatus, "dispatched");
  assert.equal(row.workerState, "stop_unknown");
  const again = runDely(["collect", "--run", "run_live"], ctx, {
    DELY_SILENCE_S: "0.15",
    DELY_DEADLINE_S: "30",
  });
  assert.notEqual(again.status, 6, again.stdout + again.stderr);
  assert.doesNotMatch(again.stdout, /SILENT /);
  assert.doesNotMatch(again.stdout, /FAILED /);
  assert.doesNotMatch(again.stdout, /WAITING disp_adopt/);
  assert.notEqual(again.status, 2, again.stdout + again.stderr);
});

test("fake worker-stop and worker-release match the measured agent and adopt rows", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workers: [
      { dispatchId: "disp_agent", dispatchStatus: "dispatched", agentTerminalHandle: "term_g" },
      {
        dispatchId: "disp_adopt",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_a",
        terminalState: "retained",
        retainedReason: "external_terminal",
        ownershipState: "external",
      },
    ],
  });
  const stopAgent = JSON.parse(
    runFake(ctx, ["orchestration", "worker-stop", "--dispatch", "disp_agent", "--json"]).stdout
  );
  assert.equal(stopAgent.ok, true);
  assert.equal(stopAgent.result.state, "stopped");
  const afterAgentStop = JSON.parse(
    runFake(ctx, ["orchestration", "worker-list", "--run", "run_live", "--json"]).stdout
  );
  const agent = afterAgentStop.result.workers.find((w) => w.dispatchId === "disp_agent");
  assert.equal(agent.dispatchStatus, "failed");
  assert.equal(agent.workerState, "stopped");
  assert.equal(agent.stage.detail, "process_stopped");
  assert.equal(agent.terminalState, "retained");
  const releaseAgent = JSON.parse(
    runFake(ctx, ["orchestration", "worker-release", "--dispatch", "disp_agent", "--json"]).stdout
  );
  assert.equal(releaseAgent.ok, true);
  assert.equal(releaseAgent.result.state, "released");
  assert.equal(releaseAgent.result.processAction, "none");
  const afterAgentRelease = JSON.parse(
    runFake(ctx, ["orchestration", "worker-list", "--run", "run_live", "--json"]).stdout
  );
  const agentReleased = afterAgentRelease.result.workers.find((w) => w.dispatchId === "disp_agent");
  assert.equal(agentReleased.dispatchStatus, "failed");
  assert.equal(agentReleased.terminalState, "released");

  const stopAdopt = JSON.parse(
    runFake(ctx, ["orchestration", "worker-stop", "--dispatch", "disp_adopt", "--json"]).stdout
  );
  assert.equal(stopAdopt.ok, true);
  assert.equal(stopAdopt.result.state, "stop_unknown");
  const afterAdoptStop = JSON.parse(
    runFake(ctx, ["orchestration", "worker-list", "--run", "run_live", "--json"]).stdout
  );
  const adopted = afterAdoptStop.result.workers.find((w) => w.dispatchId === "disp_adopt");
  assert.equal(adopted.dispatchStatus, "dispatched");
  assert.equal(adopted.workerState, "stop_unknown");
  assert.equal(adopted.terminalState, "retained");
  const releaseAdopt = JSON.parse(
    runFake(ctx, ["orchestration", "worker-release", "--dispatch", "disp_adopt", "--json"]).stdout
  );
  assert.equal(releaseAdopt.ok, false);
  const afterAdoptRelease = JSON.parse(
    runFake(ctx, ["orchestration", "worker-list", "--run", "run_live", "--json"]).stdout
  );
  const adoptedAfter = afterAdoptRelease.result.workers.find((w) => w.dispatchId === "disp_adopt");
  assert.equal(adoptedAfter.dispatchStatus, "dispatched");
  assert.equal(adoptedAfter.terminalState, "retained");
});

test("wait reports a dead sibling when another dispatch settles in the same wait", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", from_handle: "term_new", dispatchId: "disp_new", body: "done" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_dead",
        dispatchStatus: "failed",
        agentTerminalHandle: "term_dead",
        workerState: "crashed",
        lastError: "boom",
        terminalState: "reclaimable",
        projection: { liveness: { verdict: "exited" } },
      },
      {
        dispatchId: "disp_new",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_new",
        lastHeartbeatAt: "2026-09-11T09:00:00Z",
        projection: { liveness: { verdict: "live" } },
      },
    ],
    lastOutputAt: "now",
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, {
    DELY_DEADLINE_S: "30",
    DELY_SILENCE_S: "60",
    SPAWN_TIMEOUT_MS: 3000,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /FAILED disp_dead /);
  assert.match(r.stdout, /SETTLED /);
});

test("FAILED reason falls back when no lastError and the worker state is not evidence", () => {
  const ctx = setup(
    DEFAULT_AGENTS,
    deadDispatchScenario({
      workers: [
        {
          dispatchId: "disp_f",
          dispatchStatus: "failed",
          agentTerminalHandle: "term_w",
          workerState: "ready",
          terminalState: "reclaimable",
          projection: { liveness: { verdict: "live" } },
        },
      ],
    })
  );
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 8, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAILED disp_f /);
  assert.doesNotMatch(r.stdout, /^FAILED disp_f liveness=/);
  assert.match(r.stdout, /\bfailed\b|\bno evidence\b/);
});

test("nudge-mode collect opens no terminal when a dispatch is still open", () => {
  const ctx = setup(DEFAULT_AGENTS, waitingCollectScenario());
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout, /^WAITING disp_1/);
  const log = readLog(ctx.logPath);
  assert.ok(
    !log.some((argv) => argv[0] === "terminal" && argv[1] === "create"),
    "collect opened a terminal"
  );
  assert.ok(
    !log.some((argv) => argv[0] === "terminal" && argv[1] === "list"),
    "collect listed terminals"
  );
});

test("the runtime has no sidecar command", () => {
  const ctx = setup(DEFAULT_AGENTS, { workers: [], lastOutputAt: "now" });
  const r = runDely(["sidecar", "--run", "r", "--control-handle", "h"], ctx);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(r.stdout, "usage: dely open|status|dispatch|wait|collect|verify\n");
});

function gitInit(repo) {
  const r = spawnSync("git", ["init"], { cwd: repo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
}

function trustCursor(home, repo) {
  const slug = repo.replace(/^\//, "").replace(/\//g, "-");
  write(
    path.join(home, ".cursor", "projects", slug, ".workspace-trusted"),
    JSON.stringify({ workspacePath: repo })
  );
}

function bindingCalls(log) {
  return log.filter((argv) => argv[0] === "orchestration" && (argv[1] === "run-create" || argv[1] === "run-use"));
}

function lastBinding(log) {
  const calls = bindingCalls(log);
  return calls[calls.length - 1];
}

function hasVerdictWrite(log) {
  return log.some(
    (argv) =>
      argv[0] === "orchestration" &&
      argv[1] === "task-create" &&
      hasFlagPair(argv, "--task-title", "dely-verify-verdict")
  );
}

function verifyOk(phase, extra) {
  extra = extra || {};
  const payload = { outcome: extra.outcome || "succeeded" };
  if (extra.dispatchId) payload.dispatchId = extra.dispatchId;
  const msg = {
    type: "worker_done",
    payload: JSON.stringify(payload),
    body: extra.body || `dely verify ok phase=${phase} head=abc write=ok`,
  };
  if (extra.from_handle) msg.from_handle = extra.from_handle;
  return msg;
}

function verifyAck(handle, dispatchId) {
  return {
    type: "heartbeat",
    from_handle: handle,
    subject: "ack",
    payload: JSON.stringify({ dispatchId }),
  };
}

function checkWaitCalls(log) {
  return log.filter((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--wait"));
}

function verdictFromLog(log) {
  const update = log.find((argv) => argv[0] === "orchestration" && argv[1] === "task-update");
  if (!update) return null;
  const raw = update[update.indexOf("--result") + 1];
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function writeThrowInject(repo) {
  const file = path.join(repo, "inject-throw.cjs");
  const needle = [
    '    if (waitRes.type === "error") finish(9, `ERROR ${waitRes.reason}`);',
    "  }",
    "  finishVerify(ctx);",
  ].join("\n");
  const inserted = [
    '    if (waitRes.type === "error") finish(9, `ERROR ${waitRes.reason}`);',
    "  }",
    '  throw new Error("injected internal error");',
    "  finishVerify(ctx);",
  ].join("\n");
  fs.writeFileSync(
    file,
    [
      '"use strict";',
      'const fs = require("fs");',
      'const Module = require("module");',
      'const orig = Module._extensions[".js"];',
      "const target = " + JSON.stringify(DELY_JS) + ";",
      "const needle = " + JSON.stringify(needle) + ";",
      "const inserted = " + JSON.stringify(inserted) + ";",
      'Module._extensions[".js"] = function (module, filename) {',
      "  if (filename === target) {",
      '    const src = fs.readFileSync(filename, "utf8");',
      '    if (!src.includes(needle)) throw new Error("inject needle missing in dely.js");',
      "    module._compile(src.replace(needle, inserted), filename);",
      "    return;",
      "  }",
      "  return orig.call(this, module, filename);",
      "};",
      "",
    ].join("\n")
  );
  return file;
}

function defaultVerifyScenario(repo, extra) {
  extra = extra || {};
  return Object.assign(
    {
      currentRun: "run_delivery",
      createdRunId: "run_verify",
      coordinatorHandle: "term_ctrl",
      workerStarts: [
        { dispatchId: "disp_impl", state: "ready", handle: "term_impl" },
        { dispatchId: "disp_rev", state: "ready", handle: "term_rev" },
      ],
      lastOutputAt: "now",
      deliveries: [
        {
          deliveryId: "dv_verify",
          messages: [
            verifyAck("term_impl", "disp_impl"),
            verifyAck("term_rev", "disp_rev"),
            verifyOk("implement", { from_handle: "term_impl", dispatchId: "disp_impl" }),
            verifyOk("review", { from_handle: "term_rev", dispatchId: "disp_rev" }),
          ],
        },
      ],
    },
    extra
  );
}

function setupVerify(agents, scenarioFn) {
  const ctx = setup(agents, scenarioFn);
  gitInit(ctx.repo);
  trustCursor(ctx.home, ctx.repo);
  return ctx;
}

function waitUntil(fn, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
  return false;
}

function spawnDely(args, ctx, extraEnv) {
  extraEnv = extraEnv || {};
  const env = Object.assign({}, process.env, extraEnv, {
    ORCA_CLI_COMMAND: FAKE,
    FAKE_ORCA_SCENARIO: ctx.scenarioPath,
    FAKE_ORCA_LOG: ctx.logPath,
    FAKE_ORCA_STATE: ctx.statePath,
    HOME: ctx.home,
    DELY_POLL_MS: extraEnv.DELY_POLL_MS != null ? String(extraEnv.DELY_POLL_MS) : "20",
    DELY_ACK_S: extraEnv.DELY_ACK_S != null ? String(extraEnv.DELY_ACK_S) : "1",
    DELY_SILENCE_S: extraEnv.DELY_SILENCE_S != null ? String(extraEnv.DELY_SILENCE_S) : "60",
    DELY_DEADLINE_S: extraEnv.DELY_DEADLINE_S != null ? String(extraEnv.DELY_DEADLINE_S) : "30",
    DELY_VERIFY_DEADLINE_S: extraEnv.DELY_VERIFY_DEADLINE_S != null ? String(extraEnv.DELY_VERIFY_DEADLINE_S) : "30",
  });
  return spawn(process.execPath, [DELY_JS, ...args], { encoding: "utf8", env, cwd: ctx.repo });
}

test("verdict is written only after every dispatch settled, with the full key", { timeout: 8000 }, () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) =>
    defaultVerifyScenario(repo, {
      deliveries: [
        {
          deliveryId: "dv_one",
          messages: [
            verifyAck("term_impl", "disp_impl"),
            verifyAck("term_rev", "disp_rev"),
            verifyOk("implement", { from_handle: "term_impl", dispatchId: "disp_impl" }),
          ],
        },
      ],
    })
  );
  const child = spawnDely(["verify", "--repo", ctx.repo, "--control", "cursor"], ctx, {
    DELY_VERIFY_DEADLINE_S: "30",
  });
  try {
    const ready = waitUntil(() => {
      const log = readLog(ctx.logPath);
      const starts = log.filter((argv) => argv[0] === "orchestration" && argv[1] === "worker-start");
      const acks = log.filter(
        (argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--ack")
      );
      return starts.length >= 2 && acks.length >= 1;
    }, 4000);
    assert.ok(ready, "verify did not dispatch and settle the first worker");
    assert.equal(hasVerdictWrite(readLog(ctx.logPath)), false);
  } finally {
    child.kill("SIGTERM");
    child.unref();
  }
});

test("verify restores the Control terminal's previously bound Run", () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) => defaultVerifyScenario(repo));
  const pass = runDely(["verify", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  assert.match(pass.stdout, /RESULT PASS/);
  const passLast = lastBinding(readLog(ctx.logPath));
  assert.ok(passLast);
  assert.equal(passLast[1], "run-use");
  assert.ok(hasFlagPair(passLast, "--id", "run_delivery"));

  const failCtx = setupVerify(DEFAULT_AGENTS, (repo) =>
    defaultVerifyScenario(repo, {
      deliveries: [
        {
          deliveryId: "dv_fail",
          messages: [
            verifyAck("term_impl", "disp_impl"),
            verifyAck("term_rev", "disp_rev"),
            {
              type: "worker_done",
              from_handle: "term_impl",
              payload: JSON.stringify({ dispatchId: "disp_impl", outcome: "failed" }),
              body: "nope",
            },
            verifyOk("review", { from_handle: "term_rev", dispatchId: "disp_rev" }),
          ],
        },
      ],
    })
  );
  const fail = runDely(["verify", "--repo", failCtx.repo, "--control", "cursor"], failCtx);
  assert.equal(fail.status, 1, fail.stdout + fail.stderr);
  assert.match(fail.stdout, /RESULT FAIL/);
  const failLast = lastBinding(readLog(failCtx.logPath));
  assert.equal(failLast[1], "run-use");
  assert.ok(hasFlagPair(failLast, "--id", "run_delivery"));

  const claudeAgents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Claude Code | default | default |
| \`review\` | Claude Code | default | default |
`;
  const blockedCtx = setup(claudeAgents, () => ({
    currentRun: "run_delivery",
    createdRunId: "run_verify",
    coordinatorHandle: "term_ctrl",
  }));
  gitInit(blockedCtx.repo);
  const blocked = runDely(["verify", "--repo", blockedCtx.repo, "--control", "cursor"], blockedCtx);
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  assert.match(blocked.stdout, /RESULT FAIL/);
  const blockedLast = lastBinding(readLog(blockedCtx.logPath));
  assert.equal(blockedLast[1], "run-use");
  assert.ok(hasFlagPair(blockedLast, "--id", "run_delivery"));
});

test("BLOCKED preflight makes no worker-start call and records a FAIL verdict", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Claude Code | default | default |
| \`review\` | Claude Code | default | default |
`;
  const ctx = setup(agents, () => ({
    currentRun: "run_delivery",
    createdRunId: "run_verify",
    coordinatorHandle: "term_ctrl",
  }));
  gitInit(ctx.repo);
  write(
    path.join(ctx.home, ".claude.json"),
    JSON.stringify({ projects: { [ctx.repo]: { hasTrustDialogAccepted: false } } })
  );
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /BLOCKED /);
  assert.match(r.stdout, /RESULT FAIL/);
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "run-create"));
  assert.ok(!hasVerdictWrite(log));
  assert.ok(hasFlagPair(lastBinding(log), "--id", "run_delivery"));
});

test("verify start prints SLEEP and records no terminal create", () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) =>
    defaultVerifyScenario(repo, {
      deliveries: [
        {
          deliveryId: "dv_ack",
          messages: [verifyAck("term_impl", "disp_impl"), verifyAck("term_rev", "disp_rev")],
        },
      ],
    })
  );
  const started = runDely(["verify", "--repo", ctx.repo, "--control", "codex"], ctx);
  assert.equal(started.status, 0, started.stdout + started.stderr);
  assert.match(started.stdout, /^SLEEP /);
  const log = readLog(ctx.logPath);
  assert.ok(
    !log.some((argv) => argv[0] === "terminal" && argv[1] === "create"),
    "verify start opened a terminal"
  );
});

test("verify collect with one dispatch open prints WAITING and records no terminal create", () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) =>
    defaultVerifyScenario(repo, {
      deliveries: [
        {
          deliveryId: "dv_ack",
          messages: [verifyAck("term_impl", "disp_impl"), verifyAck("term_rev", "disp_rev")],
        },
      ],
    })
  );
  const started = runDely(["verify", "--repo", ctx.repo, "--control", "codex"], ctx);
  assert.equal(started.status, 0, started.stdout + started.stderr);
  const collected = runDely(["verify", "collect", "--repo", ctx.repo], ctx);
  assert.equal(collected.status, 2, collected.stdout + collected.stderr);
  assert.match(collected.stdout, /WAITING /);
  const log = readLog(ctx.logPath);
  assert.ok(
    !log.some((argv) => argv[0] === "terminal" && argv[1] === "create"),
    "verify collect opened a terminal"
  );
});

test("two id-less worker_done messages print two SETTLED lines", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_noid",
        messages: [
          { id: false, type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" },
          { id: false, type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" },
        ],
      },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "settled",
        agentTerminalHandle: "term_w",
      },
    ],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "SETTLED disp_1 worker_done done\nSETTLED disp_1 worker_done done\n");
});

test("PASS verify writes verdict PASS with the full key and status prints PASS", () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) => defaultVerifyScenario(repo));
  const key = defaultKey(ctx.repo, "cursor", "background");
  const pass = runDely(["verify", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(pass.status, 0, pass.stdout + pass.stderr);
  assert.match(pass.stdout, /RESULT PASS/);
  const verdict = verdictFromLog(readLog(ctx.logPath));
  assert.ok(verdict);
  assert.equal(verdict.verdict, "PASS");
  assert.equal(verdict.key, key);
  const status = runDely(["status", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(status.status, 0, status.stdout + status.stderr);
  assert.equal(status.stdout, "PASS\n");
});

test("an error thrown mid-run restores the previously bound Run", () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) => defaultVerifyScenario(repo));
  fs.writeFileSync(path.join(ctx.repo, ".dely-verify"), "not a directory\n");
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  const last = lastBinding(readLog(ctx.logPath));
  assert.ok(last);
  assert.equal(last[1], "run-use");
  assert.ok(hasFlagPair(last, "--id", "run_delivery"));
});

test("verify start finishes at once on NO_ACK without a consuming wait", () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) =>
    defaultVerifyScenario(repo, {
      deliveries: [
        {
          deliveryId: "dv_partial",
          messages: [verifyAck("term_impl", "disp_impl")],
        },
      ],
    })
  );
  const t0 = Date.now();
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "codex"], ctx, {
    DELY_VERIFY_DEADLINE_S: "3",
    DELY_ACK_S: "1",
  });
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /NO_ACK/);
  assert.match(r.stdout, /RESULT FAIL/);
  assert.equal(checkWaitCalls(readLog(ctx.logPath)).length, 0);
  assert.ok(elapsed < 2500, `start blocked for ${elapsed}ms`);
});

test("verify start with a BLOCKED pin does not dispatch the other pins", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Claude Code | default | default |
| \`review\` | Cursor Agent CLI | default | default |
`;
  const ctx = setup(agents, () => ({
    currentRun: "run_delivery",
    createdRunId: "run_verify",
    coordinatorHandle: "term_ctrl",
    workerStarts: [{ dispatchId: "disp_rev", state: "ready", handle: "term_rev" }],
  }));
  gitInit(ctx.repo);
  trustCursor(ctx.home, ctx.repo);
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "codex"], ctx);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /BLOCKED /);
  assert.match(r.stdout, /RESULT FAIL/);
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
  assert.equal(checkWaitCalls(log).length, 0);
});

test("a worker-start that is not ready closes the adopted terminal it created", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const ctx = setup(agents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "antigravity/default/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_ag", state: "failed", handle: "term_ag", reason: "agent_readiness: timeout" },
    terminalHandle: "term_ag",
    changeLastOutputForMs: 1,
  }));
  const r = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx
  );
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAILED /);
  const log = readLog(ctx.logPath);
  assert.ok(log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
  assert.ok(log.some((argv) => argv[0] === "terminal" && argv[1] === "close" && hasFlagPair(argv, "--terminal", "term_ag")));
});

test("a worker-start that is not ready closes the --agent terminal it created", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: { dispatchId: "disp_1", state: "failed", handle: "term_w", reason: "agent_readiness: timeout" },
  }));
  const r = runDely(
    [
      "dispatch",
      "--repo",
      ctx.repo,
      "--run",
      "run_live",
      "--phase",
      "implement",
      "--spec-file",
      "task.md",
      "--control",
      "cursor",
    ],
    ctx
  );
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(r.stdout, /^FAILED /);
  const log = readLog(ctx.logPath);
  assert.ok(log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start" && argv.includes("--agent")));
  assert.ok(log.some((argv) => argv[0] === "terminal" && argv[1] === "close" && hasFlagPair(argv, "--terminal", "term_w")));
});

test("after a failed launch, verify start launches no further pin", () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) =>
    defaultVerifyScenario(repo, {
      deliveries: [],
    })
  );
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "codex"], ctx, {
    DELY_ACK_S: "1",
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /NO_ACK/);
  assert.match(r.stdout, /PHASE review Codex CLI gpt-5.6-sol high FAIL ack=- done=- not launched/);
  const starts = readLog(ctx.logPath).filter((argv) => argv[0] === "orchestration" && argv[1] === "worker-start");
  assert.equal(starts.length, 1, `expected one worker-start, got ${starts.length}`);
});

test("a throw after a launch cleans up and records FAIL before restoring", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Cursor Agent CLI | cursor-grok-4.6-high | default |
| \`review\` | Cursor Agent CLI | cursor-grok-4.6-high | default |
`;
  const ctx = setupVerify(agents, (repo) =>
    defaultVerifyScenario(repo, {
      workerStarts: [{ dispatchId: "disp_impl", state: "ready", handle: "term_impl" }],
      deliveries: [
        {
          deliveryId: "dv_ack",
          messages: [verifyAck("term_impl", "disp_impl")],
        },
      ],
    })
  );
  fs.mkdirSync(path.join(ctx.repo, ".dely-verify", "state.json"), { recursive: true });
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "codex"], ctx);
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  const log = readLog(ctx.logPath);
  assert.ok(log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "disp_impl")));
  const verdict = verdictFromLog(log);
  assert.ok(verdict);
  assert.equal(verdict.verdict, "FAIL");
  const last = lastBinding(log);
  assert.ok(last);
  assert.equal(last[1], "run-use");
  assert.ok(hasFlagPair(last, "--id", "run_delivery"));
});

test("a throw after every group reached PASS reports the error and records FAIL", () => {
  const ctx = setupVerify(DEFAULT_AGENTS, (repo) => defaultVerifyScenario(repo));
  const preload = writeThrowInject(ctx.repo);
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "cursor"], ctx, {
    NODE_OPTIONS: "--require " + preload,
  });
  assert.notEqual(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /injected internal error/);
  assert.match(r.stdout, /RESULT FAIL/);
  const verdict = verdictFromLog(readLog(ctx.logPath));
  assert.ok(verdict);
  assert.equal(verdict.verdict, "FAIL");
});

function dispatchArgs(repo, run, phase, control) {
  return [
    "dispatch",
    "--repo",
    repo,
    "--run",
    run,
    "--phase",
    phase,
    "--spec-file",
    "task.md",
    "--control",
    control,
  ];
}

function writeAgyLog(home, name, body, mtimeMs) {
  const file = path.join(home, ".gemini", "antigravity-cli", "log", name);
  write(file, body);
  if (mtimeMs != null) {
    const t = mtimeMs / 1000;
    fs.utimesSync(file, t, t);
  }
}

function trustAntigravity(home, repo) {
  write(
    path.join(home, ".gemini", "antigravity-cli", "settings.json"),
    JSON.stringify({ trustedWorkspaces: [repo] })
  );
}

test("open creates a Run and binds it with run-use", () => {
  const ctx = setup(DEFAULT_AGENTS, { createdRunId: "run_opened", currentRun: null });
  const r = runDely(["open", "--repo", ctx.repo, "--objective", "ship the patch"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "RUN run_opened\n");
  const log = readLog(ctx.logPath);
  const createAt = log.findIndex((argv) => argv[0] === "orchestration" && argv[1] === "run-create");
  const useAt = log.findIndex((argv) => argv[0] === "orchestration" && argv[1] === "run-use");
  assert.ok(createAt >= 0, "open did not call run-create");
  assert.ok(useAt > createAt, "open printed the id without run-use");
  assert.ok(hasFlagPair(log[useAt], "--id", "run_opened"));
  assert.ok(hasFlagPair(log[createAt], "--objective", "ship the patch"));
});

test("open reports the run-create failure when no id is returned", () => {
  const ctx = setup(DEFAULT_AGENTS, { runCreateNoId: true, currentRun: null });
  const r = runDely(["open", "--repo", ctx.repo, "--objective", "ship the patch"], ctx);
  assert.equal(r.status, 9, r.stdout + r.stderr);
  assert.match(r.stdout, /run-create failed/);
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "run-use"));
});

test("dispatch refuses a Run that is not bound to Control", () => {
  let key = "";
  const ctx = setup(DEFAULT_AGENTS, (repo) => {
    key = defaultKey(repo, "cursor", "background");
    return {
      currentRun: "run_bound",
      runs: [passRun("run_listed", key)],
      workerStart: { dispatchId: "disp_x", state: "ready", handle: "term_w" },
    };
  });
  const r = runDely(dispatchArgs(ctx.repo, "run_listed", "implement", "cursor"), ctx);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.equal(
    r.stdout,
    "REFUSED run run_listed is not the Run bound to Control; fix: dely open\n"
  );
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
});

test("status prints PASS with no run id", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_hidden", defaultKey(repo, "cursor", "background"))],
  }));
  const r = runDely(["status", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "PASS\n");
});

test("verify picks the blocking form for background Control and SLEEP for nudge", () => {
  const nudge = setupVerify(DEFAULT_AGENTS, (repo) =>
    defaultVerifyScenario(repo, {
      deliveries: [
        {
          deliveryId: "dv_ack",
          messages: [verifyAck("term_impl", "disp_impl"), verifyAck("term_rev", "disp_rev")],
        },
      ],
    })
  );
  const slept = runDely(["verify", "--repo", nudge.repo, "--control", "codex"], nudge);
  assert.equal(slept.status, 0, slept.stdout + slept.stderr);
  assert.match(slept.stdout, /^SLEEP /);
  assert.equal(checkWaitCalls(readLog(nudge.logPath)).length, 0);

  const blocking = setupVerify(DEFAULT_AGENTS, (repo) => defaultVerifyScenario(repo));
  const done = runDely(["verify", "--repo", blocking.repo, "--control", "claude"], blocking);
  assert.equal(done.status, 0, done.stdout + done.stderr);
  assert.match(done.stdout, /RESULT PASS/);
  assert.ok(checkWaitCalls(readLog(blocking.logPath)).length > 0);
});

test("wait refuses a nudge-mode Control and requires --control", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [{ deliveryId: "dv1", messages: [{ type: "heartbeat", from_handle: "term_w" }] }],
    workers: [{ dispatchId: "disp_1", dispatchStatus: "dispatched", agentTerminalHandle: "term_w" }],
  });
  const refused = runDely(["wait", "--run", "run_live", "--control", "codex"], ctx);
  assert.equal(refused.status, 3, refused.stdout + refused.stderr);
  assert.equal(refused.stdout, "REFUSED codex wakes by nudge; use dely collect\n");
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "check"));
  const missing = runDely(["wait", "--run", "run_live"], ctx);
  assert.equal(missing.status, 2, missing.stdout + missing.stderr);
});

test("wait names unsupported or unknown Control wake instead of nudge", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [{ deliveryId: "dv1", messages: [{ type: "heartbeat", from_handle: "term_w" }] }],
    workers: [{ dispatchId: "disp_1", dispatchStatus: "dispatched", agentTerminalHandle: "term_w" }],
  });
  const kiro = runDely(["wait", "--run", "run_live", "--control", "kiro"], ctx);
  assert.equal(kiro.status, 3, kiro.stdout + kiro.stderr);
  assert.match(kiro.stdout, /unsupported/);
  assert.doesNotMatch(kiro.stdout, /wakes by nudge/);
  const unknown = runDely(["wait", "--run", "run_live", "--control", "nosuch"], ctx);
  assert.equal(unknown.status, 3, unknown.stdout + unknown.stderr);
  assert.match(unknown.stdout, /unknown/);
  assert.doesNotMatch(unknown.stdout, /wakes by nudge/);
});

test("wait with nothing open prints NOTHING_OPEN", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, deadDispatchScenario());
  write(
    path.join(ctx.repo, ".git", "dely", "runs", "run_live.json"),
    JSON.stringify({ reported: ["disp_1"], stopped: [] })
  );
  const t0 = Date.now();
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, {
    DELY_DEADLINE_S: "30",
    DELY_POLL_MS: "20",
    SPAWN_TIMEOUT_MS: 1500,
  });
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, "NOTHING_OPEN\n");
  assert.ok(elapsed < 1500, `wait looped for ${elapsed}ms`);
});

test("wait consumes a pending worker_done when worker-list shows nothing open", { timeout: 5000 }, () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      { deliveryId: "dv_hb", messages: [{ type: "heartbeat", from_handle: "term_w", dispatchId: "disp_1" }] },
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" }],
      },
    ],
    workers: [],
  });
  const r = runDely(["wait", "--run", "run_live", "--control", "cursor"], ctx, {
    DELY_DEADLINE_S: "30",
    DELY_SILENCE_S: "60",
    SPAWN_TIMEOUT_MS: 3000,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /SETTLED /);
  assert.doesNotMatch(r.stdout, /NOTHING_OPEN/);
});

test("wait and collect release a worker_done dispatch only", { timeout: 5000 }, () => {
  const doneCtx = setup(DEFAULT_AGENTS, adoptedWorkerDoneScenario());
  const collected = runDely(["collect", "--run", "run_live"], doneCtx);
  assert.equal(collected.status, 0, collected.stdout + collected.stderr);
  const doneLog = readLog(doneCtx.logPath);
  assert.ok(hasRelease(doneLog, "disp_ag"));
  assert.ok(hasClose(doneLog, "term_ag"));

  const waited = setup(DEFAULT_AGENTS, adoptedWorkerDoneScenario());
  const waitR = runDely(["wait", "--run", "run_live", "--control", "cursor"], waited, {
    DELY_DEADLINE_S: "30",
    DELY_SILENCE_S: "60",
    SPAWN_TIMEOUT_MS: 3000,
  });
  assert.equal(waitR.status, 0, waitR.stdout + waitR.stderr);
  assert.match(waitR.stdout, /SETTLED /);
  const waitLog = readLog(waited.logPath);
  assert.ok(hasRelease(waitLog, "disp_ag"), "wait did not release the worker_done dispatch");
  assert.ok(hasClose(waitLog, "term_ag"), "wait did not close the adopted terminal");

  const asked = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_q",
        messages: [{ type: "question", from_handle: "term_w", dispatchId: "disp_1", body: "need a choice" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_1",
        dispatchStatus: "dispatched",
        agentTerminalHandle: "term_w",
      },
    ],
  });
  const questioned = runDely(["collect", "--run", "run_live"], asked);
  assert.match(questioned.stdout, /SETTLED disp_1 question /);
  const askLog = readLog(asked.logPath);
  assert.ok(
    !askLog.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-release"),
    "released on a question batch"
  );
  assert.ok(!askLog.some((argv) => argv[0] === "terminal" && argv[1] === "close"));
});

test("collect releases a worker_done when a dead sibling forces exit 8", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", from_handle: "term_new", dispatchId: "disp_new", body: "done" }],
      },
    ],
    workers: [
      {
        dispatchId: "disp_new",
        dispatchStatus: "settled",
        agentTerminalHandle: "term_new",
        ownershipState: "external",
        retainedReason: "external_terminal",
        terminalState: "retained",
      },
      {
        dispatchId: "disp_dead",
        dispatchStatus: "failed",
        agentTerminalHandle: "term_dead",
        workerState: "crashed",
        lastError: "boom",
        terminalState: "reclaimable",
        projection: { liveness: { verdict: "exited" } },
      },
    ],
  });
  const r = runDely(["collect", "--run", "run_live"], ctx);
  assert.equal(r.status, 8, r.stdout + r.stderr);
  assert.match(r.stdout, /SETTLED disp_new worker_done done/);
  assert.match(r.stdout, /FAILED disp_dead /);
  const log = readLog(ctx.logPath);
  assert.ok(hasRelease(log, "disp_new"), "collect did not release the worker_done dispatch");
  assert.ok(hasClose(log, "term_new"), "collect did not close the adopted terminal");
});

test("classify reads Antigravity logs only for an Antigravity worker", () => {
  const future = Date.now() + 60 * 1000;
  const kiroAgents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Kiro CLI | default | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const kiro = setup(kiroAgents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "kiro/default/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_k", state: "ready", handle: "term_k" },
    deliveries: [],
    screenTail: ["waiting"],
  }));
  writeAgyLog(kiro.home, "cli-old.log", "RESOURCE_EXHAUSTED\n", future);
  const kiroOut = runDely(dispatchArgs(kiro.repo, "run_live", "implement", "cursor"), kiro, {
    DELY_ACK_S: "0.15",
  });
  assert.equal(kiroOut.status, 4, kiroOut.stdout + kiroOut.stderr);
  assert.doesNotMatch(kiroOut.stdout, /Antigravity/);

  const agyAgents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const agy = setup(agyAgents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "antigravity/default/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_ag", state: "ready", handle: "term_ag" },
    terminalHandle: "term_ag",
    changeLastOutputForMs: 1,
    deliveries: [],
    screenTail: ["waiting"],
  }));
  trustAntigravity(agy.home, agy.repo);
  writeAgyLog(agy.home, "cli-old.log", "ok\n", Date.now() - 86_400_000);
  writeAgyLog(agy.home, "cli-new.log", "RESOURCE_EXHAUSTED\n", future);
  const agyOut = runDely(dispatchArgs(agy.repo, "run_live", "implement", "cursor"), agy, {
    DELY_ACK_S: "0.2",
  });
  assert.equal(agyOut.status, 4, agyOut.stdout + agyOut.stderr);
  assert.match(agyOut.stdout, /quota/);
});

test("an Antigravity NO_ACK whose only RESOURCE_EXHAUSTED log predates launch does not name quota", () => {
  const agyAgents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const agy = setup(agyAgents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "antigravity/default/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_ag", state: "ready", handle: "term_ag" },
    terminalHandle: "term_ag",
    changeLastOutputForMs: 1,
    deliveries: [],
    screenTail: ["waiting"],
  }));
  trustAntigravity(agy.home, agy.repo);
  writeAgyLog(agy.home, "cli-old.log", "RESOURCE_EXHAUSTED\n", Date.now() - 86_400_000);
  const agyOut = runDely(dispatchArgs(agy.repo, "run_live", "implement", "cursor"), agy, {
    DELY_ACK_S: "0.2",
  });
  assert.equal(agyOut.status, 4, agyOut.stdout + agyOut.stderr);
  assert.doesNotMatch(agyOut.stdout, /quota/);
});

test("classify recognises not authenticated on screen and in an Antigravity log", () => {
  const screen = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: { dispatchId: "disp_1", state: "ready", handle: "term_w" },
    deliveries: [],
    screenTail: ["not authenticated"],
  }));
  const screenOut = runDely(dispatchArgs(screen.repo, "run_live", "implement", "cursor"), screen, {
    DELY_ACK_S: "0.15",
  });
  assert.equal(screenOut.status, 4, screenOut.stdout + screenOut.stderr);
  assert.match(screenOut.stdout, /not authenticated/);

  const agyAgents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const agy = setup(agyAgents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "antigravity/default/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_ag", state: "ready", handle: "term_ag" },
    terminalHandle: "term_ag",
    changeLastOutputForMs: 1,
    deliveries: [],
    screenTail: ["waiting"],
  }));
  trustAntigravity(agy.home, agy.repo);
  writeAgyLog(agy.home, "cli-auth.log", "not authenticated\n", Date.now() + 60 * 1000);
  const agyOut = runDely(dispatchArgs(agy.repo, "run_live", "implement", "cursor"), agy, {
    DELY_ACK_S: "0.2",
  });
  assert.equal(agyOut.status, 4, agyOut.stdout + agyOut.stderr);
  assert.match(agyOut.stdout, /not authenticated/);
});

test("Kiro adopted argv puts chat before --model", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Kiro CLI | kiro-model | default |
| \`review\` | Codex CLI | gpt-5.6-sol | high |
`;
  const ctx = setup(agents, (repo) => ({
    runs: [
      passRun(
        "run_v",
        keyOf(repo, "cursor", "background", "kiro/kiro-model/default", "codex/gpt-5.6-sol/high")
      ),
    ],
    workerStart: { dispatchId: "disp_k", state: "ready", handle: "term_k" },
    terminalHandle: "term_k",
    changeLastOutputForMs: 1,
    deliveries: [
      {
        deliveryId: "dv_ack",
        messages: [{ type: "heartbeat", from_handle: "term_k", subject: "ack", dispatchId: "disp_k" }],
      },
    ],
  }));
  const r = runDely(dispatchArgs(ctx.repo, "run_live", "implement", "cursor"), ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const created = readLog(ctx.logPath).find((argv) => argv[0] === "terminal" && argv[1] === "create");
  assert.ok(created, "Kiro adopt did not create a terminal");
  const command = created[created.indexOf("--command") + 1];
  const chatAt = command.indexOf("kiro-cli chat");
  const modelAt = command.indexOf("--model");
  assert.ok(chatAt >= 0, command);
  assert.ok(modelAt > chatAt, `chat was appended after the flags: ${command}`);
});

test("a group skipped because another is BLOCKED reads SKIPPED", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Claude Code | default | default |
| \`review\` | Cursor Agent CLI | default | default |
`;
  const ctx = setup(agents, () => ({
    currentRun: "run_delivery",
    createdRunId: "run_verify",
    coordinatorHandle: "term_ctrl",
    workerStarts: [{ dispatchId: "disp_rev", state: "ready", handle: "term_rev" }],
  }));
  gitInit(ctx.repo);
  trustCursor(ctx.home, ctx.repo);
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "codex"], ctx);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /BLOCKED /);
  assert.match(r.stdout, /SKIPPED /);
  assert.doesNotMatch(r.stdout, /FAIL not launched/);
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
});

test("selector_not_found names orca repo add", () => {
  const ctx = setup(DEFAULT_AGENTS, (repo) => ({
    runs: [passRun("run_v", defaultKey(repo, "cursor", "background"))],
    workerStart: {
      dispatchId: "disp_1",
      state: "failed",
      handle: "term_w",
      reason: "selector_not_found",
    },
  }));
  const r = runDely(dispatchArgs(ctx.repo, "run_live", "implement", "cursor"), ctx);
  assert.equal(r.status, 5, r.stdout + r.stderr);
  assert.match(r.stdout, /selector_not_found/);
  assert.match(
    r.stdout,
    new RegExp(`fix: register the repository with orca repo add --path ${ctx.repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)
  );
});

test("verify creates no Run when every group is BLOCKED", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Claude Code | default | default |
| \`review\` | Claude Code | default | default |
`;
  const ctx = setup(agents, () => ({
    currentRun: "run_delivery",
    createdRunId: "run_verify",
    coordinatorHandle: "term_ctrl",
  }));
  gitInit(ctx.repo);
  const r = runDely(["verify", "--repo", ctx.repo, "--control", "cursor"], ctx);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /BLOCKED /);
  assert.match(r.stdout, /RESULT FAIL/);
  const log = readLog(ctx.logPath);
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "run-create"));
  assert.ok(!log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-start"));
});
