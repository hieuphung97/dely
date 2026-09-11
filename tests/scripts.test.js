"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
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
  return spawnSync(process.execPath, [DELY_JS, ...args], {
    encoding: "utf8",
    env: Object.assign({}, process.env, extraEnv, {
      ORCA_CLI_COMMAND: FAKE,
      FAKE_ORCA_SCENARIO: ctx.scenarioPath,
      FAKE_ORCA_LOG: ctx.logPath,
      FAKE_ORCA_STATE: ctx.statePath,
      HOME: ctx.home,
      DELY_POLL_MS: extraEnv && extraEnv.DELY_POLL_MS != null ? String(extraEnv.DELY_POLL_MS) : "20",
      DELY_ACK_S: extraEnv && extraEnv.DELY_ACK_S != null ? String(extraEnv.DELY_ACK_S) : "1",
      DELY_SILENCE_S: extraEnv && extraEnv.DELY_SILENCE_S != null ? String(extraEnv.DELY_SILENCE_S) : "60",
      DELY_DEADLINE_S: extraEnv && extraEnv.DELY_DEADLINE_S != null ? String(extraEnv.DELY_DEADLINE_S) : "30",
      DELY_QUIET_S: extraEnv && extraEnv.DELY_QUIET_S != null ? String(extraEnv.DELY_QUIET_S) : "0.05",
      DELY_QUIET_MIN_S: extraEnv && extraEnv.DELY_QUIET_MIN_S != null ? String(extraEnv.DELY_QUIET_MIN_S) : "0.05",
    }),
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
  write(ctx.scenarioPath, JSON.stringify(scenario, null, 2));
  return ctx;
}

function hasFlagPair(argv, a, b) {
  const i = argv.indexOf(a);
  return i >= 0 && argv[i + 1] === b;
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
    ctx,
    { DELY_ACK_S: "15" }
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
  const r = runDely(["wait", "--run", "run_live"], ctx);
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
  const r = runDely(["wait", "--run", "run_live"], ctx, { DELY_DEADLINE_S: "0.2", DELY_SILENCE_S: "30" });
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
  const r = runDely(["wait", "--run", "run_live"], ctx, { DELY_SILENCE_S: "0.15", DELY_DEADLINE_S: "30" });
  assert.equal(r.status, 6, r.stdout + r.stderr);
  assert.match(r.stdout, /^SILENT disp_1 /);
});

test("sidecar swallows only heartbeats on the Control handle", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    controlDeliveries: [
      { deliveryId: "hb1", messages: [{ type: "heartbeat", from_handle: "term_w", subject: "ack" }] },
    ],
    deliveries: [
      {
        deliveryId: "done1",
        messages: [{ type: "worker_done", from_handle: "term_w", dispatchId: "disp_1", body: "done" }],
      },
    ],
    workers: [],
    lastOutputAt: "now",
  });
  const r = runDely(["sidecar", "--run", "run_live", "--control-handle", "term_ctrl"], ctx);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const log = readLog(ctx.logPath);
  const waits = log.filter((argv) => argv[0] === "orchestration" && argv[1] === "check" && argv.includes("--wait"));
  assert.ok(waits.length >= 1);
  for (const argv of waits) {
    assert.ok(hasFlagPair(argv, "--terminal", "term_ctrl"));
    assert.ok(hasFlagPair(argv, "--types", "heartbeat"));
  }
  assert.ok(!log.some((argv) => argv.includes("--ack") && hasFlagPair(argv, "--ack", "done1")));
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
ROOT="$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)"
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
