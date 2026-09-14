"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DELY_JS = path.join(ROOT, "skills/delivery/scripts/dely.js");
const FAKE = path.join(ROOT, "tests/fixtures/fake-orca.js");

const DEFAULT_AGENTS = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Cursor Agent CLI | cursor-grok-4.6-high | default |
| \`review\` | Claude Code | claude-opus-5 | medium |
`;

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dely-test-"));
}

function write(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
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

function hasFlagPair(argv, a, b) {
  const i = argv.indexOf(a);
  return i >= 0 && argv[i + 1] === b;
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
    DELY_POLL_S: extraEnv.DELY_POLL_S != null ? String(extraEnv.DELY_POLL_S) : "0.05",
    DELY_ACK_S: extraEnv.DELY_ACK_S != null ? String(extraEnv.DELY_ACK_S) : "1",
    DELY_PREFLIGHT_S: extraEnv.DELY_PREFLIGHT_S != null ? String(extraEnv.DELY_PREFLIGHT_S) : "1",
    DELY_PROGRESS_S: extraEnv.DELY_PROGRESS_S != null ? String(extraEnv.DELY_PROGRESS_S) : "0",
    DELY_QUIET_S: extraEnv.DELY_QUIET_S != null ? String(extraEnv.DELY_QUIET_S) : "0.05",
    DELY_QUIET_MIN_S: extraEnv.DELY_QUIET_MIN_S != null ? String(extraEnv.DELY_QUIET_MIN_S) : "0.05",
    DELY_QUIET_CAP_S: extraEnv.DELY_QUIET_CAP_S != null ? String(extraEnv.DELY_QUIET_CAP_S) : "2",
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
  const scenario = typeof scenarioFn === "function" ? scenarioFn(repo) : scenarioFn || {};
  write(ctx.scenarioPath, JSON.stringify(scenario, null, 2));
  return ctx;
}

function payload(id) {
  return JSON.stringify({ dispatchId: id, taskId: "task_1" });
}

function startArgv(log) {
  return log.find((argv) => argv[0] === "orchestration" && argv[1] === "worker-start");
}

function checks(log) {
  return log.filter((argv) => argv[0] === "orchestration" && argv[1] === "check");
}

function acks(log) {
  return checks(log).filter((argv) => argv.includes("--ack"));
}

test("1 pin argv: Copilot default omits flags; Claude default effort omits --effort", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | GitHub Copilot CLI | default | default |
| \`review\` | Claude Code | claude-opus-5 | default |
`;
  const ctx = setup(agents, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ab12") }],
  });
  const impl = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_1", "--phase", "implement", "--spec-file", "task.md"],
    ctx
  );
  assert.equal(impl.status, 0, impl.stderr + impl.stdout);
  const copilot = startArgv(readLog(ctx.logPath));
  assert.ok(copilot, "worker-start recorded");
  assert.equal(copilot.includes("--model"), false, "Copilot must not get --model");
  assert.equal(copilot.includes("--effort"), false, "Copilot must not get --effort");

  const ctx2 = setup(agents, {
    workerStarts: [{ dispatchId: "ctx_cd34" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_cd34") }],
  });
  const rev = runDely(
    ["dispatch", "--repo", ctx2.repo, "--run", "run_1", "--phase", "review", "--spec-file", "task.md"],
    ctx2
  );
  assert.equal(rev.status, 0, rev.stderr + rev.stdout);
  const claude = startArgv(readLog(ctx2.logPath));
  assert.ok(hasFlagPair(claude, "--model", "claude-opus-5"));
  assert.equal(claude.includes("--effort"), false, "Claude default effort omits --effort");
});

test("1 pin fail-closed: non-default model on Copilot starts no worker", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | GitHub Copilot CLI | gpt-4.1 | default |
| \`review\` | Claude Code | claude-opus-5 | default |
`;
  const ctx = setup(agents, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ab12") }],
  });
  const r = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_1", "--phase", "implement", "--spec-file", "task.md"],
    ctx
  );
  assert.equal(r.status, 5, r.stdout);
  assert.match(
    r.stdout,
    /FAILED pin implement copilot: Orca cannot pin this model; write default and set the model in Orca's agent default arguments/
  );
  assert.equal(readLog(ctx.logPath).filter((argv) => argv[1] === "worker-start").length, 0);
});

test("1 pin fail-closed: effort without model starts no worker", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Cursor Agent CLI | default | high |
| \`review\` | Claude Code | default | medium |
`;
  const ctx = setup(agents, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ab12") }],
  });
  const impl = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_1", "--phase", "implement", "--spec-file", "task.md"],
    ctx
  );
  assert.equal(impl.status, 5, impl.stdout);
  assert.match(impl.stdout, /FAILED pin implement cursor: --effort requires --model/);
  assert.equal(readLog(ctx.logPath).filter((argv) => argv[1] === "worker-start").length, 0);

  const pf = setup(agents, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
  });
  const pre = runDely(["preflight", "--repo", pf.repo, "--run", "run_1"], pf);
  assert.equal(pre.status, 1, pre.stdout);
  assert.match(pre.stdout, /PREFLIGHT implement cursor FAIL pin implement cursor: --effort requires --model/);
  assert.match(pre.stdout, /PREFLIGHT review claude FAIL pin review claude: --effort requires --model/);
  assert.equal(readLog(pf.logPath).filter((argv) => argv[1] === "worker-start").length, 0);
});

test("1 preflight fail-closed: Copilot non-default model starts no worker", () => {
  const agents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | GitHub Copilot CLI | gpt-4.1 | high |
| \`review\` | GitHub Copilot CLI | gpt-4.1 | default |
`;
  const ctx = setup(agents, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
  });
  const r = runDely(["preflight", "--repo", ctx.repo, "--run", "run_1"], ctx);
  assert.equal(r.status, 1, r.stdout);
  assert.match(
    r.stdout,
    /PREFLIGHT implement copilot FAIL pin implement copilot: Orca cannot pin this model; write default and set the model in Orca's agent default arguments/
  );
  assert.equal(readLog(ctx.logPath).filter((argv) => argv[1] === "worker-start").length, 0);
});

test("2 ACK matches its own dispatch: foreign heartbeat is NO_ACK and worker-stop", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ffff") }],
  });
  const r = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_1", "--phase", "implement", "--spec-file", "task.md"],
    ctx,
    { DELY_ACK_S: "1" }
  );
  assert.equal(r.status, 4, r.stdout);
  assert.match(r.stdout, /NO_ACK ctx_ab12/);
  const log = readLog(ctx.logPath);
  assert.ok(
    log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "ctx_ab12"))
  );
  assert.ok(
    log.some((argv) => argv[0] === "orchestration" && argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", "ctx_ab12")),
    "NO_ACK must also worker-release"
  );
});

test("3 settling batch left unacked", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_mix",
        messages: [
          { type: "heartbeat", subject: "ack", payload: payload("ctx_ab12") },
          { type: "worker_done", subject: "done", payload: payload("ctx_ab12") },
        ],
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--timeout-min", "0.05"], ctx, { SPAWN_TIMEOUT_MS: 15000 });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /SETTLED/);
  assert.match(r.stdout, /dv_mix/);
  assert.match(r.stdout, /heartbeat/);
  assert.match(r.stdout, /worker_done/);
  assert.equal(acks(readLog(ctx.logPath)).length, 0, "settling batch must not be acked");
});

test("3 question-only batch SETTLED unacked", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_q",
        messages: [{ type: "question", subject: "ask", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--timeout-min", "0.05"], ctx, { SPAWN_TIMEOUT_MS: 15000 });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /SETTLED/);
  assert.match(r.stdout, /dv_q/);
  assert.match(r.stdout, /question/);
  assert.equal(acks(readLog(ctx.logPath)).length, 0, "question batch must not be acked");
});

test("3 escalation-only batch SETTLED unacked", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_esc",
        messages: [{ type: "escalation", subject: "blocked", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--timeout-min", "0.05"], ctx, { SPAWN_TIMEOUT_MS: 15000 });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /SETTLED/);
  assert.match(r.stdout, /dv_esc/);
  assert.match(r.stdout, /escalation/);
  assert.equal(acks(readLog(ctx.logPath)).length, 0, "escalation batch must not be acked");
});

test("3 non-settling batch acked then SETTLED", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_hb",
        messages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ab12") }],
      },
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", subject: "done", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--timeout-min", "0.08"], ctx, { SPAWN_TIMEOUT_MS: 15000 });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /SETTLED/);
  assert.match(r.stdout, /dv_done/);
  const ackFlags = acks(readLog(ctx.logPath)).map((argv) => argv[argv.indexOf("--ack") + 1]);
  assert.deepEqual(ackFlags, ["dv_hb"]);
});

test("4 ATTENTION on a failed row", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workers: [
      {
        dispatchId: "ctx_dead",
        dispatchStatus: "failed",
        projection: {
          attention: { requiresAction: true },
          liveness: { verdict: "exited" },
          nextAction: { kind: "release", argv: ["orchestration", "worker-release", "--dispatch", "ctx_dead"] },
        },
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--timeout-min", "0.2"], ctx);
  assert.equal(r.status, 8, r.stdout);
  assert.match(r.stdout, /ATTENTION/);
  assert.match(r.stdout, /ctx_dead/);
  assert.match(r.stdout, /exited/);
  assert.match(r.stdout, /worker-release/);
});

test("4 no ATTENTION noise: completed and dispatched unverifiable with nextAction none keep waiting", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workers: [
      {
        dispatchId: "ctx_done",
        dispatchStatus: "completed",
        projection: {
          attention: { requiresAction: true },
          liveness: { verdict: "unverifiable" },
          nextAction: { kind: "none", argv: [] },
        },
      },
      {
        dispatchId: "ctx_live",
        dispatchStatus: "dispatched",
        projection: {
          attention: { requiresAction: true },
          liveness: { verdict: "unverifiable" },
          nextAction: { kind: "none", argv: [] },
        },
      },
      {
        dispatchId: "ctx_skip",
        dispatchStatus: "failed",
        projection: {
          attention: { requiresAction: true },
          liveness: { verdict: "exited" },
          nextAction: { kind: "release", argv: ["orchestration", "worker-release"] },
        },
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--skip", "ctx_skip", "--timeout-min", "0.05", "--stall-min", "10"], ctx, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(r.status, 7, r.stdout);
  assert.match(r.stdout, /DEADLINE/);
  assert.equal(/ATTENTION/.test(r.stdout), false);
});

test("5 STALLED when cursor is unchanged; advancing cursor is not STALLED", () => {
  const stalled = setup(DEFAULT_AGENTS, {
    workers: [
      {
        dispatchId: "ctx_idle",
        dispatchStatus: "dispatched",
        projection: {
          attention: { requiresAction: false },
          liveness: { verdict: "live" },
          nextAction: null,
        },
      },
    ],
    workerRead: { nextCursor: "c0", limited: false, returnedMessageCount: 0 },
  });
  const red = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.15"], stalled, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(red.status, 6, red.stdout);
  assert.match(red.stdout, /STALLED/);
  assert.match(red.stdout, /ctx_idle/);

  const moving = setup(DEFAULT_AGENTS, {
    workers: [
      {
        dispatchId: "ctx_busy",
        dispatchStatus: "dispatched",
        projection: {
          attention: { requiresAction: false },
          liveness: { verdict: "live" },
          nextAction: null,
        },
      },
    ],
    workerRead: { advance: true },
  });
  const green = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.08"], moving, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(green.status, 7, green.stdout);
  assert.match(green.stdout, /DEADLINE/);
  assert.equal(/STALLED/.test(green.stdout), false);

  const termPage = setup(DEFAULT_AGENTS, {
    workers: [
      {
        dispatchId: "ctx_term",
        dispatchStatus: "dispatched",
        projection: {
          attention: { requiresAction: false },
          liveness: { verdict: "live" },
          nextAction: null,
        },
      },
    ],
    workerRead: { terminalAdvance: true },
  });
  const term = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.08"], termPage, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(term.status, 7, term.stdout);
  assert.match(term.stdout, /DEADLINE/);
  assert.equal(/STALLED/.test(term.stdout), false, "terminal nextCursor progress must not stall");
});

test("5 STALLED names worker-read error for an open dispatch", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workers: [
      {
        dispatchId: "ctx_idle",
        dispatchStatus: "dispatched",
        projection: {
          attention: { requiresAction: false },
          liveness: { verdict: "live" },
          nextAction: { kind: "none", argv: [] },
        },
      },
    ],
    workerRead: { error: "worker_identity_changed" },
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.15"], ctx, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(r.status, 6, r.stdout);
  assert.match(r.stdout, /STALLED ctx_idle/);
  assert.match(r.stdout, /worker_identity_changed/);
  assert.equal(/no new output/.test(r.stdout), false);
});

test("5 stall detection ignores non-dispatched rows", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workers: [
      {
        dispatchId: "ctx_done",
        dispatchStatus: "completed",
        projection: {
          attention: { requiresAction: true },
          liveness: { verdict: "exited" },
          nextAction: { kind: "none", argv: [] },
        },
      },
    ],
    workerRead: { nextCursor: "c0", limited: false, returnedMessageCount: 0 },
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.15"], ctx, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(r.status, 7, r.stdout);
  assert.match(r.stdout, /DEADLINE/);
  assert.equal(/STALLED/.test(r.stdout), false, "completed rows must not stall");
  assert.equal(
    readLog(ctx.logPath).filter((argv) => argv[0] === "orchestration" && argv[1] === "worker-read").length,
    0,
    "must not worker-read a non-dispatched row"
  );
});

test("5 advance stops paging on a 0-row limited page", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workers: [
      {
        dispatchId: "ctx_idle",
        dispatchStatus: "dispatched",
        projection: {
          attention: { requiresAction: false },
          liveness: { verdict: "live" },
          nextAction: { kind: "none", argv: [] },
        },
      },
    ],
    workerRead: { nextCursor: "c0", limited: true, returnedMessageCount: 0 },
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.12"], ctx, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(r.status, 6, r.stdout);
  assert.match(r.stdout, /STALLED ctx_idle/);
  const log = readLog(ctx.logPath);
  const reads = log.filter((argv) => argv[0] === "orchestration" && argv[1] === "worker-read");
  const cycles = log.filter((argv) => argv[0] === "orchestration" && argv[1] === "worker-list").length;
  assert.ok(reads.length > 0, "must read the open dispatch");
  assert.ok(cycles > 0, "must list workers each progress cycle");
  const per = reads.length / cycles;
  assert.ok(per <= 2, "reads per progress cycle must be ≤ 2, got " + per + " (" + reads.length + "/" + cycles + ")");
});

test("6 waiter names Control: wait --as records --terminal on check", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--as", "term_x"], ctx);
  assert.equal(r.status, 0, r.stdout);
  const waitChecks = checks(readLog(ctx.logPath));
  assert.ok(waitChecks.length);
  for (const argv of waitChecks) {
    assert.ok(hasFlagPair(argv, "--terminal", "term_x"), String(argv));
  }
});

test("7 one waiter: live recorded terminal is ALREADY_WAITING; missing terminal is stale", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    terminals: [{ handle: "term_w" }],
    terminalHandle: "term_w",
  });
  const outFile = path.join(ctx.repo, "wait.out");
  const lock = outFile + ".lock";
  write(lock, JSON.stringify({ terminal: "term_w" }));
  const fresh = runDely(["wait-bg", "--run", "run_1", "--control", "cursor", "--out", outFile], ctx, {
    ORCA_TERMINAL_HANDLE: "term_ctrl",
  });
  assert.match(fresh.stdout, /ALREADY_WAITING/);
  const afterFresh = readLog(ctx.logPath).filter((argv) => argv[0] === "terminal" && argv[1] === "create");
  assert.equal(afterFresh.length, 0);
  assert.ok(
    readLog(ctx.logPath).some((argv) => argv[0] === "terminal" && argv[1] === "list"),
    "must consult terminal list"
  );

  const ctxDead = setup(DEFAULT_AGENTS, {
    terminals: [{ handle: "term_other" }],
    terminalHandle: "term_w",
  });
  const outDead = path.join(ctxDead.repo, "wait.out");
  const lockDead = outDead + ".lock";
  write(lockDead, JSON.stringify({ terminal: "term_dead" }));
  const stale = runDely(["wait-bg", "--run", "run_1", "--control", "cursor", "--out", outDead], ctxDead, {
    ORCA_TERMINAL_HANDLE: "term_ctrl",
  });
  assert.match(stale.stdout, /^WAITING\b/m);
  assert.equal(/ALREADY_WAITING/.test(stale.stdout), false);
  const created = readLog(ctxDead.logPath).filter((argv) => argv[0] === "terminal" && argv[1] === "create");
  assert.equal(created.length, 1);
  assert.ok(fs.readFileSync(lockDead, "utf8").includes("term_w"), "lock must record the new waiter handle");
});

test("7 wait-bg records the created terminal handle in the lock", () => {
  const ctx = setup(DEFAULT_AGENTS, { terminalHandle: "term_wait1" });
  const outFile = path.join(ctx.repo, "wait.out");
  const lock = outFile + ".lock";
  const r = runDely(["wait-bg", "--run", "run_1", "--control", "cursor", "--out", outFile], ctx, {
    ORCA_TERMINAL_HANDLE: "term_ctrl",
  });
  assert.match(r.stdout, /^WAITING\b/m);
  const body = JSON.parse(fs.readFileSync(lock, "utf8"));
  assert.equal(body.terminal, "term_wait1");
});

test("7 wait-bg uses execPath and quotes run id, handle and skip", () => {
  const ctx = setup(DEFAULT_AGENTS, {});
  const outFile = path.join(ctx.repo, "wait.out");
  const r = runDely(["wait-bg", "--run", "run_1", "--control", "cursor", "--out", outFile, "--skip", "ctx_a,ctx_b"], ctx, {
    ORCA_TERMINAL_HANDLE: "term_ctrl",
  });
  assert.match(r.stdout, /^WAITING\b/m);
  const created = readLog(ctx.logPath).find((argv) => argv[0] === "terminal" && argv[1] === "create");
  assert.ok(created, "terminal create recorded");
  const cmd = created[created.indexOf("--command") + 1];
  const q = JSON.stringify;
  assert.ok(cmd.startsWith("DELY_WAITER=1 " + q(process.execPath) + " "), cmd);
  assert.ok(cmd.includes(" wait --run " + q("run_1") + " "), cmd);
  assert.ok(cmd.includes(" --as " + q("term_ctrl")), cmd);
  assert.ok(cmd.includes(" --control " + q("cursor")), cmd);
  assert.ok(cmd.includes(" --skip " + q("ctx_a,ctx_b")), cmd);
});

test("8 wake target: notify uses run-show coordinator_handle, not --as", () => {
  const ctx = setup(DEFAULT_AGENTS, { coordinatorHandle: "term_new" });
  const outFile = path.join(ctx.repo, "wait.out");
  const r = runDely(["notify", "--run", "run_1", "--as", "term_old", "--out", outFile], ctx);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const sent = readLog(ctx.logPath).find((argv) => argv[0] === "terminal" && argv[1] === "send");
  assert.ok(sent, "terminal send recorded");
  assert.ok(hasFlagPair(sent, "--terminal", "term_new"));
  assert.equal(sent.includes("term_old"), false);
  assert.ok(sent.includes("--enter"));
  assert.ok(String(sent).includes(outFile));
});

test("9 preflight: two pins PASS+FAIL exit 1; identical pins start one worker", () => {
  const two = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    deliveries: [
      {
        deliveryId: "dv_pf",
        messages: [{ type: "worker_done", payload: payload("ctx_aa11") }],
      },
    ],
    workers: [
      { dispatchId: "ctx_aa11", dispatchStatus: "dispatched", projection: {} },
      { dispatchId: "ctx_bb22", dispatchStatus: "dispatched", projection: {} },
    ],
  });
  const mixed = runDely(["preflight", "--repo", two.repo, "--run", "run_1"], two, {
    DELY_ACK_S: "1",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(mixed.status, 1, mixed.stdout);
  assert.match(mixed.stdout, /PREFLIGHT implement cursor PASS /);
  assert.match(mixed.stdout, /PREFLIGHT review claude FAIL /);
  const log = readLog(two.logPath);
  assert.ok(log.some((argv) => argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "ctx_bb22")));
  assert.ok(log.some((argv) => argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", "ctx_bb22")));
  assert.ok(log.some((argv) => argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", "ctx_aa11")));

  const sameAgents = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Cursor Agent CLI | cursor-grok-4.6-high | default |
| \`review\` | Cursor Agent CLI | cursor-grok-4.6-high | default |
`;
  const same = setup(sameAgents, {
    workerStarts: [{ dispatchId: "ctx_cc33" }],
    deliveries: [
      {
        deliveryId: "dv_one",
        messages: [{ type: "worker_done", payload: payload("ctx_cc33") }],
      },
    ],
  });
  const one = runDely(["preflight", "--repo", same.repo, "--run", "run_1"], same);
  assert.equal(one.status, 0, one.stdout);
  const starts = readLog(same.logPath).filter((argv) => argv[1] === "worker-start");
  assert.equal(starts.length, 1);
});

test("9 preflight reports a failing check instead of spinning", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    checkError: "a waiter is already active on this Run",
  });
  const r = runDely(["preflight", "--repo", ctx.repo, "--run", "run_1"], ctx, {
    DELY_ACK_S: "2",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /PREFLIGHT implement cursor FAIL a waiter is already active on this Run/);
  assert.match(r.stdout, /PREFLIGHT review claude FAIL a waiter is already active on this Run/);
  assert.equal(/no worker_done/.test(r.stdout), false);
  const log = readLog(ctx.logPath);
  const checksOnly = log.filter((argv) => argv[0] === "orchestration" && argv[1] === "check");
  assert.ok(checksOnly.length < 10, "must not spin on a failing check: " + checksOnly.length);
  assert.ok(log.some((argv) => argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "ctx_aa11")));
  assert.ok(log.some((argv) => argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "ctx_bb22")));
  assert.ok(log.some((argv) => argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", "ctx_aa11")));
  assert.ok(log.some((argv) => argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", "ctx_bb22")));
});

test("preflight without required flags prints usage and exits 2", () => {
  const ctx = setup();
  const bare = runDely(["preflight"], ctx);
  assert.equal(bare.status, 2, bare.stderr + bare.stdout);
  assert.match(bare.stdout, /^usage:/);
  assert.equal(/ERR_INVALID_ARG_TYPE/.test(bare.stderr + bare.stdout), false);
  assert.equal(/TypeError/.test(bare.stderr + bare.stdout), false);

  const noRun = runDely(["preflight", "--repo", ctx.repo], ctx);
  assert.equal(noRun.status, 2, noRun.stderr + noRun.stdout);
  assert.match(noRun.stdout, /^usage:/);
  assert.equal(/FAIL start:/.test(noRun.stdout), false);
  assert.equal(readLog(ctx.logPath).filter((argv) => argv[1] === "worker-start").length, 0);
});

test("7 wait-bg default output lives under os.tmpdir keyed by run id", () => {
  const ctx = setup(DEFAULT_AGENTS, { terminalHandle: "term_w" });
  const r = runDely(["wait-bg", "--run", "run_xyz", "--control", "cursor"], ctx, {
    ORCA_TERMINAL_HANDLE: "term_ctrl",
  });
  assert.match(r.stdout, /^WAITING\b/m);
  assert.equal(fs.existsSync(path.join(ctx.repo, ".dely-wait.out")), false);
  assert.equal(fs.existsSync(path.join(ctx.repo, ".dely-wait.out.lock")), false);
  const created = readLog(ctx.logPath).find((argv) => argv[0] === "terminal" && argv[1] === "create");
  assert.ok(created, "terminal create recorded");
  const cmd = created[created.indexOf("--command") + 1];
  const expected = path.join(os.tmpdir(), "dely-wait-run_xyz.out");
  assert.ok(cmd.includes(JSON.stringify(expected)), cmd);
  assert.ok(cmd.includes("notify --run " + JSON.stringify("run_xyz")), cmd);
  assert.ok(cmd.includes(" --out " + JSON.stringify(expected)), cmd);
});

test("7 wait-bg lock vanished between wx and read does not throw", () => {
  const ctx = setup(DEFAULT_AGENTS, { terminalHandle: "term_w" });
  const outFile = path.join(ctx.repo, "wait.out");
  const lock = outFile + ".lock";
  fs.mkdirSync(lock);
  const r = runDely(["wait-bg", "--run", "run_1", "--control", "cursor", "--out", outFile], ctx, {
    ORCA_TERMINAL_HANDLE: "term_ctrl",
  });
  assert.equal(/EISDIR/.test(r.stderr), false, r.stderr);
  assert.equal(/ENOENT/.test(r.stderr), false, r.stderr);
  assert.equal(/Error:/.test(r.stderr), false, r.stderr);
  assert.match(r.stdout, /WAITING|ALREADY_WAITING|ERROR/);
});

test("flags() does not take a following --flag as a value", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "cursor", "--skip", "--as", "term_x"], ctx);
  assert.equal(r.status, 0, r.stdout);
  const waitChecks = checks(readLog(ctx.logPath));
  assert.ok(waitChecks.length);
  for (const argv of waitChecks) {
    assert.ok(hasFlagPair(argv, "--terminal", "term_x"), String(argv));
    assert.equal(hasFlagPair(argv, "--terminal", "--skip"), false);
  }
});

test("8 notify retries --enter after a block clears and never sends without it", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    coordinatorHandle: "term_new",
    sendEnterBlocked: true,
    sendEnterBlockedUntil: 1,
  });
  const outFile = path.join(ctx.repo, "wait.out");
  const line = "dely wait finished for run_1. Finish your current step, then read " + outFile + " and continue.";
  const r = runDely(["notify", "--run", "run_1", "--as", "term_old", "--out", outFile], ctx, {
    DELY_NOTIFY_RETRY_S: "0.05",
    DELY_NOTIFY_GIVEUP_S: "2",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const sends = readLog(ctx.logPath).filter((argv) => argv[0] === "terminal" && argv[1] === "send");
  const withoutEnter = sends.filter((argv) => !argv.includes("--enter"));
  assert.equal(withoutEnter.length, 0, "must never send without --enter: " + JSON.stringify(sends));
  assert.equal(
    sends.some((argv) => hasFlagPair(argv, "--text", "\r")),
    false,
    "must never send a bare CR: " + JSON.stringify(sends)
  );
  const afterClear = sends.filter((argv) => argv.includes("--enter") && hasFlagPair(argv, "--text", line));
  assert.equal(afterClear.length, 2, "one blocked --enter then one after clear: " + JSON.stringify(sends));
});

test("8 notify gives up on a lasting block and never sends without --enter", () => {
  const ctx = setup(DEFAULT_AGENTS, { coordinatorHandle: "term_new", sendEnterBlocked: true });
  const outFile = path.join(ctx.repo, "wait.out");
  const r = runDely(["notify", "--run", "run_1", "--as", "term_old", "--out", outFile], ctx, {
    DELY_NOTIFY_RETRY_S: "0.05",
    DELY_NOTIFY_GIVEUP_S: "0.15",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.notEqual(r.status, 0, "give-up must exit non-zero: " + r.stderr + r.stdout);
  const sends = readLog(ctx.logPath).filter((argv) => argv[0] === "terminal" && argv[1] === "send");
  assert.ok(sends.length >= 1, JSON.stringify(sends));
  for (const argv of sends) {
    assert.ok(argv.includes("--enter"), "must never send without --enter: " + JSON.stringify(argv));
    assert.equal(hasFlagPair(argv, "--text", "\r"), false, JSON.stringify(argv));
  }
});

const SIGNED_OUT = "You are currently not signed in";

function lastOutput(stdout) {
  const i = String(stdout).lastIndexOf("last output: ");
  return i < 0 ? "" : String(stdout).slice(i + "last output: ".length);
}

function assertQuotedScreen(stdout, needle) {
  const quoted = lastOutput(stdout);
  assert.match(quoted, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(/^\s*\{/.test(quoted), false, "must not quote Orca JSON: " + quoted);
  assert.equal(/"tail"/.test(quoted), false, quoted);
  assert.equal(/"transcript"/.test(quoted), false, quoted);
  assert.equal(/"source"/.test(quoted), false, quoted);
}

function assertReadBeforeRelease(log, id) {
  let lastRead = -1;
  let firstRelease = -1;
  log.forEach((argv, i) => {
    if (argv[0] === "orchestration" && argv[1] === "worker-read" && hasFlagPair(argv, "--dispatch", id)) lastRead = i;
    if (firstRelease < 0 && argv[0] === "orchestration" && argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", id)) {
      firstRelease = i;
    }
  });
  assert.ok(lastRead >= 0, "must worker-read " + id);
  assert.ok(firstRelease >= 0, "must worker-release " + id);
  assert.ok(lastRead < firstRelease, "must worker-read before release (live may still return an archived tail): read=" + lastRead + " release=" + firstRelease);
}

function liveMsg(text, extra) {
  extra = extra || {};
  return {
    id: extra.id || "msg_1",
    role: extra.role || "assistant",
    blocks: extra.blocks || [{ type: "text", text: text }],
    timestamp: extra.timestamp || "2026-09-14T07:00:00.000Z",
    source: extra.source || "hook",
  };
}

const signedOutTerminal = {
  source: "terminal",
  terminal: {
    handle: "term_w",
    status: "running",
    tail: ["", SIGNED_OUT, ""],
    truncated: false,
    nextCursor: "t0",
    returnedLineCount: 3,
  },
};

test("failure text quotes terminal tail before release on PREFLIGHT FAIL and NO_ACK", () => {
  const pf = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    workerRead: signedOutTerminal,
  });
  const pre = runDely(["preflight", "--repo", pf.repo, "--run", "run_1"], pf, {
    DELY_ACK_S: "1",
    DELY_PREFLIGHT_S: "1",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(pre.status, 1, pre.stdout);
  assert.match(pre.stdout, /PREFLIGHT implement cursor FAIL /);
  assert.match(pre.stdout, /PREFLIGHT review claude FAIL /);
  assertQuotedScreen(pre.stdout, SIGNED_OUT);
  const pfLog = readLog(pf.logPath);
  assertReadBeforeRelease(pfLog, "ctx_aa11");
  assertReadBeforeRelease(pfLog, "ctx_bb22");

  const nack = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ffff") }],
    workerRead: signedOutTerminal,
  });
  const r = runDely(
    ["dispatch", "--repo", nack.repo, "--run", "run_1", "--phase", "implement", "--spec-file", "task.md"],
    nack,
    { DELY_ACK_S: "1" }
  );
  assert.equal(r.status, 4, r.stdout);
  assert.match(r.stdout, /NO_ACK ctx_ab12/);
  assertQuotedScreen(r.stdout, SIGNED_OUT);
  assertReadBeforeRelease(readLog(nack.logPath), "ctx_ab12");
});

test("5 STALLED only for transcript; terminal source reaches DEADLINE however idle", () => {
  const workers = [
    {
      dispatchId: "ctx_idle",
      dispatchStatus: "dispatched",
      projection: {
        attention: { requiresAction: false },
        liveness: { verdict: "live" },
        nextAction: null,
      },
    },
  ];
  const movingTerm = setup(DEFAULT_AGENTS, {
    workers,
    workerRead: { source: "terminal", terminalAdvance: true, tail: [SIGNED_OUT] },
  });
  const moving = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.08"], movingTerm, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(moving.status, 7, moving.stdout);
  assert.match(moving.stdout, /DEADLINE/);
  assert.equal(/STALLED/.test(moving.stdout), false, "advancing terminal cursor must not stall");

  const idleTerm = setup(DEFAULT_AGENTS, {
    workers,
    workerRead: {
      source: "terminal",
      terminal: {
        handle: "term_w",
        status: "running",
        tail: ["", SIGNED_OUT],
        truncated: false,
        nextCursor: "t0",
        returnedLineCount: 2,
      },
    },
  });
  const idle = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.15"], idleTerm, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(idle.status, 7, idle.stdout);
  assert.match(idle.stdout, /DEADLINE/);
  assert.equal(/STALLED/.test(idle.stdout), false, "terminal source never yields STALLED");

  const frozenTx = setup(DEFAULT_AGENTS, {
    workers,
    workerRead: {
      source: "transcript",
      nextCursor: "c0",
      limited: false,
      returnedMessageCount: 0,
      messages: [liveMsg(SIGNED_OUT)],
    },
  });
  const stalled = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.15"], frozenTx, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(stalled.status, 6, stalled.stdout);
  assert.match(stalled.stdout, /STALLED ctx_idle/);
  assertQuotedScreen(stalled.stdout, SIGNED_OUT);

  const toolOnly = setup(DEFAULT_AGENTS, {
    workers,
    workerRead: {
      source: "transcript",
      nextCursor: "c0",
      limited: false,
      returnedMessageCount: 0,
      messages: [
        liveMsg("older text that must not win"),
        liveMsg("", {
          id: "msg_2",
          blocks: [
            { type: "tool-call", name: "Shell", input: { command: "true" } },
            { type: "tool-result", output: SIGNED_OUT, isError: true },
          ],
        }),
      ],
    },
  });
  const toolStalled = runDely(["wait", "--run", "run_1", "--control", "cursor", "--stall-min", "0.02", "--timeout-min", "0.15"], toolOnly, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(toolStalled.status, 6, toolStalled.stdout);
  assert.match(toolStalled.stdout, /STALLED ctx_idle/);
  assertQuotedScreen(toolStalled.stdout, SIGNED_OUT);
  assert.equal(/older text that must not win/.test(lastOutput(toolStalled.stdout)), false);
});

test("DELY_PREFLIGHT_S defaults to 150", () => {
  const src = fs.readFileSync(DELY_JS, "utf8");
  assert.match(src, /seconds\(process\.env\.DELY_PREFLIGHT_S,\s*150\)/);
  assert.equal(/seconds\(process\.env\.DELY_PREFLIGHT_S,\s*90\)/.test(src), false);
});

test("9 preflight worker_done budget uses DELY_PREFLIGHT_S not DELY_ACK_S", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    workerRead: signedOutTerminal,
  });
  const t0 = Date.now();
  const r = runDely(["preflight", "--repo", ctx.repo, "--run", "run_1"], ctx, {
    DELY_ACK_S: "1",
    DELY_PREFLIGHT_S: "2",
    SPAWN_TIMEOUT_MS: 15000,
  });
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /no worker_done in 2s/);
  assert.equal(/no worker_done in 1s/.test(r.stdout), false, r.stdout);
  assert.ok(elapsed >= 1500, "must wait the preflight budget, not ACK_S: " + elapsed + "ms");
  assertQuotedScreen(r.stdout, SIGNED_OUT);
});

test("8 notify falls back from a non-numeric retry interval and still gives up", () => {
  const ctx = setup(DEFAULT_AGENTS, { coordinatorHandle: "term_new", sendEnterBlocked: true });
  const outFile = path.join(ctx.repo, "wait.out");
  const t0 = Date.now();
  const r = runDely(["notify", "--run", "run_1", "--as", "term_old", "--out", outFile], ctx, {
    DELY_NOTIFY_RETRY_S: "abc",
    DELY_NOTIFY_GIVEUP_S: "0.15",
    SPAWN_TIMEOUT_MS: 5000,
  });
  const elapsed = Date.now() - t0;
  assert.notEqual(r.status, null, "must not hang on NaN retry: " + ((r.error && r.error.code) || r.stderr));
  assert.notEqual(r.status, 0, "give-up must exit non-zero: " + r.stderr + r.stdout);
  assert.ok(elapsed < 4000, "must exit within the scaled give-up, not the default retry: " + elapsed + "ms");
});

const AGY_AGENTS = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Claude Code | claude-opus-5 | medium |
`;

const GATE_PREAMBLE = Array.from({ length: 30 }, (_, i) => "PREAMBLE_" + String(i).padStart(2, "0") + " " + "x".repeat(80));

test("antigravity adopt waits for quiet then worker-start --terminal; no --agent", () => {
  const ctx = setup(AGY_AGENTS, {
    terminalHandle: "term_agy",
    terminalShow: { busyShows: 2 },
    workerStarts: [{ dispatchId: "ctx_agy1" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_agy1") }],
  });
  const r = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_1", "--phase", "implement", "--spec-file", "task.md"],
    ctx
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const log = readLog(ctx.logPath);
  const createIdx = log.findIndex((argv) => argv[0] === "terminal" && argv[1] === "create");
  const startIdx = log.findIndex((argv) => argv[0] === "orchestration" && argv[1] === "worker-start");
  assert.ok(createIdx >= 0, "terminal create recorded");
  assert.ok(startIdx >= 0, "worker-start recorded");
  assert.ok(createIdx < startIdx, "create before worker-start");
  const showsBefore = log.slice(0, startIdx).filter((argv) => argv[0] === "terminal" && argv[1] === "show").length;
  assert.ok(showsBefore >= 2, "must wait for quiescence before adopt: showsBefore=" + showsBefore);
  const created = log[createIdx];
  assert.ok(hasFlagPair(created, "--command", "agy --dangerously-skip-permissions"), String(created));
  const started = log[startIdx];
  assert.ok(hasFlagPair(started, "--terminal", "term_agy"), String(started));
  assert.equal(started.includes("--agent"), false, "adopted start must not pass --agent: " + started);
  assert.equal(started.includes("--model"), false, started);
  assert.equal(started.includes("--effort"), false, started);
});

test("claude pin still uses worker-start --agent claude", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_cd34" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_cd34") }],
  });
  const r = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_1", "--phase", "review", "--spec-file", "task.md"],
    ctx
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const log = readLog(ctx.logPath);
  assert.equal(
    log.filter((argv) => argv[0] === "terminal" && argv[1] === "create").length,
    0,
    "claude must not adopt"
  );
  const started = startArgv(log);
  assert.ok(hasFlagPair(started, "--agent", "claude"), String(started));
  assert.equal(started.includes("--terminal"), false, String(started));
});

test("wait refuses a waker Control; missing --control is usage; wait-bg still waits", () => {
  const refused = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "codex", "--timeout-min", "0.05"], refused, {
    SPAWN_TIMEOUT_MS: 5000,
  });
  assert.equal(r.status, 3, r.stdout);
  assert.match(r.stdout, /^REFUSED codex wakes by waker; use dely wait-bg$/m);
  assert.equal(
    readLog(refused.logPath).filter((argv) => argv[0] === "orchestration" && argv[1] === "check").length,
    0,
    "REFUSED must not check"
  );

  const missing = setup();
  const bare = runDely(["wait", "--run", "run_1"], missing);
  assert.equal(bare.status, 2, bare.stdout);
  assert.match(bare.stdout, /^usage:/);

  const bg = setup(DEFAULT_AGENTS, { terminalHandle: "term_w" });
  const outFile = path.join(bg.repo, "wait.out");
  const waiting = runDely(["wait-bg", "--run", "run_1", "--control", "codex", "--out", outFile], bg, {
    ORCA_TERMINAL_HANDLE: "term_ctrl",
  });
  assert.match(waiting.stdout, /^WAITING\b/m);
  const created = readLog(bg.logPath).find((argv) => argv[0] === "terminal" && argv[1] === "create");
  const cmd = created[created.indexOf("--command") + 1];
  assert.ok(cmd.includes(" --control " + JSON.stringify("codex")), cmd);

  const waiter = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const inner = runDely(
    ["wait", "--run", "run_1", "--control", "codex", "--as", "term_x", "--timeout-min", "0.05"],
    waiter,
    { SPAWN_TIMEOUT_MS: 15000, DELY_WAITER: "1" }
  );
  assert.equal(inner.status, 0, inner.stdout);
  assert.match(inner.stdout, /SETTLED/);
});

test("failure quote prefers a gate line over a long preamble", () => {
  const tail = GATE_PREAMBLE.concat(["Security guide", "No, exit"], GATE_PREAMBLE);
  const nack = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ffff") }],
    workerRead: { source: "terminal", terminal: { handle: "term_w", status: "running", tail } },
  });
  const r = runDely(
    ["dispatch", "--repo", nack.repo, "--run", "run_1", "--phase", "implement", "--spec-file", "task.md"],
    nack,
    { DELY_ACK_S: "1" }
  );
  assert.equal(r.status, 4, r.stdout);
  const quoted = lastOutput(r.stdout);
  assert.match(quoted, /Security guide/);
  assert.equal(/PREAMBLE_00/.test(quoted), false, "must not quote the preamble: " + quoted);
});

test("preflight fails early on two consecutive gate polls, not one flash or an agy banner", () => {
  const two = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    workerRead: {
      source: "terminal",
      tails: [
        ["Security guide", "No, exit"],
        ["Security guide", "No, exit"],
      ],
    },
  });
  const t0 = Date.now();
  const early = runDely(["preflight", "--repo", two.repo, "--run", "run_1"], two, {
    DELY_PREFLIGHT_S: "2",
    SPAWN_TIMEOUT_MS: 15000,
  });
  const earlyMs = Date.now() - t0;
  assert.equal(early.status, 1, early.stdout);
  assert.match(early.stdout, /PREFLIGHT implement cursor FAIL gate on screen:.*Security guide/);
  assert.ok(earlyMs < 1200, "must fail well before the 2s budget: " + earlyMs + "ms");
  assert.equal(/no worker_done/.test(early.stdout), false, early.stdout);
  const twoLog = readLog(two.logPath);
  assert.ok(twoLog.some((argv) => argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "ctx_aa11")));
  assert.ok(twoLog.some((argv) => argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", "ctx_aa11")));

  const flash = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    workerRead: {
      source: "terminal",
      tails: [["Security guide"], ["ready"], ["ready"]],
    },
  });
  const flashR = runDely(["preflight", "--repo", flash.repo, "--run", "run_1"], flash, {
    DELY_PREFLIGHT_S: "0.4",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(flashR.status, 1, flashR.stdout);
  assert.equal(/gate on screen/.test(flashR.stdout), false, "one-poll flash must not fail: " + flashR.stdout);
  assert.match(flashR.stdout, /no worker_done/);

  const banner = setup(AGY_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    workerRead: {
      source: "terminal",
      tails: [[SIGNED_OUT], [SIGNED_OUT], [SIGNED_OUT]],
    },
  });
  const t1 = Date.now();
  const bannerR = runDely(["preflight", "--repo", banner.repo, "--run", "run_1"], banner, {
    DELY_PREFLIGHT_S: "0.4",
    SPAWN_TIMEOUT_MS: 15000,
  });
  const bannerMs = Date.now() - t1;
  assert.equal(bannerR.status, 1, bannerR.stdout);
  assert.equal(/gate on screen/.test(bannerR.stdout), false, "agy not-signed-in banner must not fail: " + bannerR.stdout);
  assert.match(bannerR.stdout, /no worker_done/);
  assert.ok(bannerMs >= 250, "banner must wait the budget, not fail early: " + bannerMs + "ms");
});

function adoptFile(run) {
  return path.join(os.tmpdir(), "dely-adopt-" + run + ".json");
}

function closes(log) {
  return log.filter((argv) => argv[0] === "terminal" && argv[1] === "close");
}

test("adopted worker_done closes the recorded terminal once; non-adopted and missing file close none", () => {
  const adoptedRun = "run_adopt_close";
  try {
    fs.unlinkSync(adoptFile(adoptedRun));
  } catch (_) {
    /* none */
  }
  const adopted = setup(AGY_AGENTS, {
    terminalHandle: "term_agy",
    workerStarts: [{ dispatchId: "ctx_agy1" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_agy1") }],
    deliveries: [
      {
        deliveryId: "dv_agy",
        messages: [{ type: "worker_done", payload: payload("ctx_agy1") }],
      },
    ],
  });
  const dispatched = runDely(
    ["dispatch", "--repo", adopted.repo, "--run", adoptedRun, "--phase", "implement", "--spec-file", "task.md"],
    adopted
  );
  assert.equal(dispatched.status, 0, dispatched.stderr + dispatched.stdout);
  const recorded = JSON.parse(fs.readFileSync(adoptFile(adoptedRun), "utf8"));
  assert.deepEqual(recorded, [{ dispatchId: "ctx_agy1", handle: "term_agy" }]);
  const settled = runDely(["wait", "--run", adoptedRun, "--control", "cursor", "--timeout-min", "0.05"], adopted, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(settled.status, 0, settled.stdout);
  assert.match(settled.stdout, /SETTLED/);
  const adoptedCloses = closes(readLog(adopted.logPath)).filter((argv) => hasFlagPair(argv, "--terminal", "term_agy"));
  assert.equal(adoptedCloses.length, 1, "adopted worker_done must close that handle once: " + JSON.stringify(adoptedCloses));
  assert.equal(fs.existsSync(adoptFile(adoptedRun)), false, "settled adopt entry must be removed");

  const other = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ab12") }],
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const otherRun = "run_non_adopt";
  const otherDispatch = runDely(
    ["dispatch", "--repo", other.repo, "--run", otherRun, "--phase", "implement", "--spec-file", "task.md"],
    other
  );
  assert.equal(otherDispatch.status, 0, otherDispatch.stdout);
  assert.equal(fs.existsSync(adoptFile(otherRun)), false, "non-adopted start must not write an adopt file");
  const otherWait = runDely(["wait", "--run", otherRun, "--control", "cursor", "--timeout-min", "0.05"], other, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(otherWait.status, 0, otherWait.stdout);
  assert.equal(closes(readLog(other.logPath)).length, 0, "non-adopted worker_done must not terminal close");

  const missingRun = "run_missing_adopt";
  try {
    fs.unlinkSync(adoptFile(missingRun));
  } catch (_) {
    /* none */
  }
  const missing = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const missingWait = runDely(["wait", "--run", missingRun, "--control", "cursor", "--timeout-min", "0.05"], missing, {
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(missingWait.status, 0, missingWait.stdout);
  assert.equal(closes(readLog(missing.logPath)).length, 0, "missing adopt file must not terminal close");
});

test("preflight PASS closes the adopted terminal", () => {
  const run = "run_pf_adopt";
  try {
    fs.unlinkSync(adoptFile(run));
  } catch (_) {
    /* none */
  }
  const ctx = setup(AGY_AGENTS, {
    terminalHandle: "term_agy",
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    deliveries: [
      {
        deliveryId: "dv_agy",
        messages: [{ type: "worker_done", payload: payload("ctx_aa11") }],
      },
      {
        deliveryId: "dv_claude",
        messages: [{ type: "worker_done", payload: payload("ctx_bb22") }],
      },
    ],
  });
  const r = runDely(["preflight", "--repo", ctx.repo, "--run", run], ctx, { SPAWN_TIMEOUT_MS: 15000 });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /PREFLIGHT implement antigravity PASS /);
  assert.match(r.stdout, /PREFLIGHT review claude PASS /);
  const agyCloses = closes(readLog(ctx.logPath)).filter((argv) => hasFlagPair(argv, "--terminal", "term_agy"));
  assert.equal(agyCloses.length, 1, "preflight PASS must close the adopted handle: " + JSON.stringify(agyCloses));
  assert.equal(fs.existsSync(adoptFile(run)), false);
});

test("wait --control codex --as without DELY_WAITER is REFUSED", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    deliveries: [
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", payload: payload("ctx_ab12") }],
      },
    ],
  });
  const r = runDely(["wait", "--run", "run_1", "--control", "codex", "--as", "term_x", "--timeout-min", "0.05"], ctx, {
    SPAWN_TIMEOUT_MS: 5000,
  });
  assert.equal(r.status, 3, r.stdout);
  assert.match(r.stdout, /^REFUSED codex wakes by waker; use dely wait-bg$/m);
  assert.equal(
    readLog(ctx.logPath).filter((argv) => argv[0] === "orchestration" && argv[1] === "check").length,
    0,
    "REFUSED must not check"
  );
});

test("wait-bg sets DELY_WAITER on the waiter command", () => {
  const ctx = setup(DEFAULT_AGENTS, {});
  const outFile = path.join(ctx.repo, "wait.out");
  const r = runDely(["wait-bg", "--run", "run_1", "--control", "codex", "--out", outFile], ctx, {
    ORCA_TERMINAL_HANDLE: "term_ctrl",
  });
  assert.match(r.stdout, /^WAITING\b/m);
  const created = readLog(ctx.logPath).find((argv) => argv[0] === "terminal" && argv[1] === "create");
  assert.ok(created, "terminal create recorded");
  const cmd = created[created.indexOf("--command") + 1];
  assert.ok(cmd.startsWith("DELY_WAITER=1 "), cmd);
  assert.ok(cmd.includes(" wait --run " + JSON.stringify("run_1") + " "), cmd);
});

test("preflight never fails a worker that already messaged on a gate line", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    deliveries: [
      {
        deliveryId: "dv_ack1",
        messages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_aa11") }],
      },
      {
        deliveryId: "dv_ack2",
        messages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_aa11") }],
      },
      {
        deliveryId: "dv_ack3",
        messages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_aa11") }],
      },
    ],
    workerRead: {
      source: "terminal",
      tails: [
        ["Security guide", "No, exit"],
        ["Security guide", "No, exit"],
        ["Security guide", "No, exit"],
      ],
    },
  });
  const r = runDely(["preflight", "--repo", ctx.repo, "--run", "run_1"], ctx, {
    DELY_PREFLIGHT_S: "0.8",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(r.status, 1, r.stdout);
  assert.equal(
    /PREFLIGHT implement cursor FAIL gate/.test(r.stdout),
    false,
    "a messaged worker must not fail on a gate line: " + r.stdout
  );
  assert.match(r.stdout, /PREFLIGHT implement cursor FAIL no worker_done/);
});

test("preflight ignores usage-limit footers and Update available; hit your free usage limit still gates", () => {
  function gateRun(tails) {
    const ctx = setup(DEFAULT_AGENTS, {
      workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
      workerRead: { source: "terminal", tails },
    });
    return runDely(["preflight", "--repo", ctx.repo, "--run", "run_1"], ctx, {
      DELY_PREFLIGHT_S: "2",
      SPAWN_TIMEOUT_MS: 15000,
    });
  }
  const approaching = gateRun([
    ["Approaching usage limit"],
    ["Approaching usage limit"],
    ["Approaching usage limit"],
  ]);
  assert.equal(/gate on screen/.test(approaching.stdout), false, "Approaching usage limit must not gate: " + approaching.stdout);
  assert.match(approaching.stdout, /no worker_done/);

  const update = gateRun([
    ["Update available"],
    ["Update available"],
    ["Update available"],
  ]);
  assert.equal(/gate on screen/.test(update.stdout), false, "Update available must not gate: " + update.stdout);
  assert.match(update.stdout, /no worker_done/);

  const blocked = gateRun([
    ["hit your free usage limit"],
    ["hit your free usage limit"],
  ]);
  assert.equal(blocked.status, 1, blocked.stdout);
  assert.match(blocked.stdout, /FAIL gate on screen:.*hit your free usage limit/);
});

test("preflight sleeps a poll interval between gate observations even when check returned a delivery", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_aa11" }, { dispatchId: "ctx_bb22" }],
    deliveries: [
      {
        deliveryId: "dv_f1",
        messages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ffff") }],
      },
      {
        deliveryId: "dv_f2",
        messages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ffff") }],
      },
    ],
    workerRead: {
      source: "terminal",
      tails: [
        ["Security guide"],
        ["Security guide"],
      ],
    },
  });
  const r = runDely(["preflight", "--repo", ctx.repo, "--run", "run_1"], ctx, {
    DELY_POLL_S: "0.4",
    DELY_PREFLIGHT_S: "3",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /FAIL gate on screen/);
  const state = JSON.parse(fs.readFileSync(ctx.statePath, "utf8"));
  const times = (state.readAt && state.readAt.ctx_aa11) || [];
  assert.ok(times.length >= 2, "must observe the screen at least twice: " + JSON.stringify(times));
  assert.ok(times[1] - times[0] >= 350, "must sleep a poll interval between gate observations: " + (times[1] - times[0]) + "ms");
});

test("waitQuiet polls no more often than every 500 ms", () => {
  const ctx = setup(AGY_AGENTS, {
    terminalHandle: "term_agy",
    workerStarts: [{ dispatchId: "ctx_agy1" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_agy1") }],
  });
  const r = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_quiet_poll", "--phase", "implement", "--spec-file", "task.md"],
    ctx,
    { DELY_QUIET_MIN_S: "1", DELY_QUIET_S: "0.01", DELY_QUIET_CAP_S: "2", SPAWN_TIMEOUT_MS: 15000 }
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const log = readLog(ctx.logPath);
  const startIdx = log.findIndex((argv) => argv[0] === "orchestration" && argv[1] === "worker-start");
  const showsBefore = log.slice(0, startIdx).filter((argv) => argv[0] === "terminal" && argv[1] === "show").length;
  assert.ok(showsBefore >= 2, "must poll at least twice while waiting for QUIET_MIN_S: " + showsBefore);
  assert.ok(showsBefore <= 5, "must not poll faster than 500ms: showsBefore=" + showsBefore);
  try {
    fs.unlinkSync(adoptFile("run_quiet_poll"));
  } catch (_) {
    /* none */
  }
});

const AGY_ONLY = `# dely

| Phase | Harness | Model | Effort |
| --- | --- | --- | --- |
| \`implement\` | Antigravity CLI | default | default |
| \`review\` | Antigravity CLI | default | default |
`;

const TRUST_GATE = "Do you trust the contents of this project?";

function terminalReads(log) {
  return log.filter((argv) => argv[0] === "terminal" && argv[1] === "read");
}

test("adopted start fails on a gate after quiet and never worker-start", () => {
  function gated(agents) {
    return setup(agents, {
      terminalHandle: "term_agy",
      terminalShow: { busyShows: 2 },
      terminalRead: { tail: [TRUST_GATE] },
      workerStarts: [{ dispatchId: "ctx_agy_gate" }],
      workerRead: { error: { code: "worker_identity_changed" } },
    });
  }

  const pfRun = "run_agy_gate_pf";
  try {
    fs.unlinkSync(adoptFile(pfRun));
  } catch (_) {
    /* none */
  }
  const pf = gated(AGY_ONLY);
  const t0 = Date.now();
  const pre = runDely(["preflight", "--repo", pf.repo, "--run", pfRun], pf, {
    DELY_PREFLIGHT_S: "4",
    SPAWN_TIMEOUT_MS: 15000,
  });
  const pfMs = Date.now() - t0;
  assert.equal(pre.status, 1, pre.stderr + pre.stdout);
  assert.match(pre.stdout, /PREFLIGHT implement antigravity FAIL start: gate on screen:.*Do you trust the contents/);
  assert.equal(/no worker_done/.test(pre.stdout), false, pre.stdout);
  assert.ok(pfMs < 3000, "must fail in about the quiet time, not the 4s budget: " + pfMs + "ms");
  const pfLog = readLog(pf.logPath);
  assert.equal(startArgv(pfLog), undefined, "gated adopt must not worker-start: " + JSON.stringify(pfLog));
  const pfReadIdx = pfLog.findIndex((argv) => argv[0] === "terminal" && argv[1] === "read");
  assert.ok(pfReadIdx >= 0, "must terminal-read the adopted handle after quiet");
  assert.ok(hasFlagPair(pfLog[pfReadIdx], "--terminal", "term_agy"), String(pfLog[pfReadIdx]));
  const pfShowsBefore = pfLog.slice(0, pfReadIdx).filter((argv) => argv[0] === "terminal" && argv[1] === "show").length;
  assert.ok(pfShowsBefore >= 2, "must wait for quiescence before the gate read: showsBefore=" + pfShowsBefore);
  assert.ok(
    closes(pfLog).some((argv) => hasFlagPair(argv, "--terminal", "term_agy")),
    "must close the gated terminal"
  );
  assert.equal(fs.existsSync(adoptFile(pfRun)), false);

  const nackRun = "run_agy_gate_dispatch";
  try {
    fs.unlinkSync(adoptFile(nackRun));
  } catch (_) {
    /* none */
  }
  const nack = gated(AGY_AGENTS);
  const t1 = Date.now();
  const r = runDely(
    ["dispatch", "--repo", nack.repo, "--run", nackRun, "--phase", "implement", "--spec-file", "task.md"],
    nack,
    { DELY_ACK_S: "4", SPAWN_TIMEOUT_MS: 15000 }
  );
  const nackMs = Date.now() - t1;
  assert.equal(r.status, 5, r.stderr + r.stdout);
  assert.match(r.stdout, /^FAILED gate on screen:.*Do you trust the contents/m);
  assert.equal(/NO_ACK/.test(r.stdout), false, r.stdout);
  assert.ok(nackMs < 3000, "dispatch must fail in about the quiet time, not ACK_S: " + nackMs + "ms");
  const nackLog = readLog(nack.logPath);
  assert.equal(startArgv(nackLog), undefined, "gated dispatch must not worker-start: " + JSON.stringify(nackLog));
  const nackReadIdx = nackLog.findIndex((argv) => argv[0] === "terminal" && argv[1] === "read");
  assert.ok(nackReadIdx >= 0, "must terminal-read the adopted handle after quiet");
  const nackShowsBefore = nackLog.slice(0, nackReadIdx).filter((argv) => argv[0] === "terminal" && argv[1] === "show").length;
  assert.ok(nackShowsBefore >= 2, "must wait for quiescence before the gate read: showsBefore=" + nackShowsBefore);
  assert.equal(fs.existsSync(adoptFile(nackRun)), false);
});

test("failed worker-list row drops early and quotes the created terminal when worker-read fails", () => {
  function failedAgy(agents) {
    return setup(agents, {
      terminalHandle: "term_agy",
      terminalShow: { busyShows: 2 },
      terminalRead: { tail: [SIGNED_OUT] },
      workerStarts: [{ dispatchId: "ctx_aa11" }],
      workers: [
        {
          dispatchId: "ctx_aa11",
          dispatchStatus: "failed",
          projection: {
            stage: { detail: "agent_readiness" },
            attention: {},
            liveness: {},
            nextAction: null,
          },
        },
      ],
      workerRead: { error: { code: "worker_identity_changed" } },
    });
  }

  const pfRun = "run_agy_failed_pf";
  try {
    fs.unlinkSync(adoptFile(pfRun));
  } catch (_) {
    /* none */
  }
  const pf = failedAgy(AGY_ONLY);
  const t0 = Date.now();
  const pre = runDely(["preflight", "--repo", pf.repo, "--run", pfRun], pf, {
    DELY_PREFLIGHT_S: "4",
    SPAWN_TIMEOUT_MS: 15000,
  });
  const pfMs = Date.now() - t0;
  assert.equal(pre.status, 1, pre.stderr + pre.stdout);
  assert.match(
    pre.stdout,
    /PREFLIGHT implement antigravity FAIL worker failed: agent_readiness; last output:.*You are currently not signed in/
  );
  assert.equal(/no worker_done/.test(pre.stdout), false, pre.stdout);
  assert.equal(/worker_identity_changed/.test(pre.stdout), false, "must not key the drop on worker-read: " + pre.stdout);
  assert.ok(pfMs < 2500, "must drop well before the 4s budget: " + pfMs + "ms");
  const pfLog = readLog(pf.logPath);
  assert.ok(startArgv(pfLog), "worker-start must succeed so the failed row can appear");
  assert.ok(
    terminalReads(pfLog).some((argv) => hasFlagPair(argv, "--terminal", "term_agy")),
    "quote must come from terminal read of the created handle"
  );
  assert.ok(pfLog.some((argv) => argv[1] === "worker-stop" && hasFlagPair(argv, "--dispatch", "ctx_aa11")));
  assert.ok(pfLog.some((argv) => argv[1] === "worker-release" && hasFlagPair(argv, "--dispatch", "ctx_aa11")));
  try {
    fs.unlinkSync(adoptFile(pfRun));
  } catch (_) {
    /* none */
  }

  const nackRun = "run_agy_failed_dispatch";
  try {
    fs.unlinkSync(adoptFile(nackRun));
  } catch (_) {
    /* none */
  }
  const nack = failedAgy(AGY_AGENTS);
  const t1 = Date.now();
  const r = runDely(
    ["dispatch", "--repo", nack.repo, "--run", nackRun, "--phase", "implement", "--spec-file", "task.md"],
    nack,
    { DELY_ACK_S: "4", SPAWN_TIMEOUT_MS: 15000 }
  );
  const nackMs = Date.now() - t1;
  assert.equal(r.status, 4, r.stderr + r.stdout);
  assert.match(r.stdout, /NO_ACK ctx_aa11 stopped after /);
  assertQuotedScreen(r.stdout, SIGNED_OUT);
  assert.equal(/worker_identity_changed/.test(r.stdout), false, r.stdout);
  assert.ok(nackMs < 2500, "must stop ACK wait well before ACK_S: " + nackMs + "ms");
  const nackLog = readLog(nack.logPath);
  assert.ok(startArgv(nackLog), "dispatch worker-start must succeed");
  assert.ok(
    terminalReads(nackLog).some((argv) => hasFlagPair(argv, "--terminal", "term_agy")),
    "NO_ACK quote must come from terminal read of the created handle"
  );
  try {
    fs.unlinkSync(adoptFile(nackRun));
  } catch (_) {
    /* none */
  }
});

test("preflight PASS on a failed worker-list row after ack heartbeat then worker_done", () => {
  const pfRun = "run_agy_acked_failed_pf";
  try {
    fs.unlinkSync(adoptFile(pfRun));
  } catch (_) {
    /* none */
  }
  const pf = setup(AGY_ONLY, {
    terminalHandle: "term_agy",
    terminalShow: { busyShows: 2 },
    terminalRead: { tail: ["ready"] },
    workerStarts: [{ dispatchId: "ctx_aa11" }],
    workers: [
      {
        dispatchId: "ctx_aa11",
        dispatchStatus: "failed",
        projection: {
          stage: { detail: "agent_readiness" },
          attention: {},
          liveness: {},
          nextAction: null,
        },
      },
    ],
    deliveries: [
      {
        deliveryId: "dv_ack",
        messages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_aa11") }],
      },
      {
        deliveryId: "dv_done",
        messages: [{ type: "worker_done", payload: payload("ctx_aa11") }],
      },
    ],
  });
  const pre = runDely(["preflight", "--repo", pf.repo, "--run", pfRun], pf, {
    DELY_PREFLIGHT_S: "4",
    SPAWN_TIMEOUT_MS: 15000,
  });
  assert.equal(pre.status, 0, pre.stderr + pre.stdout);
  assert.match(pre.stdout, /PREFLIGHT implement antigravity PASS /);
  assert.equal(/FAIL worker failed/.test(pre.stdout), false, pre.stdout);
  const agyCloses = closes(readLog(pf.logPath)).filter((argv) => hasFlagPair(argv, "--terminal", "term_agy"));
  assert.equal(agyCloses.length, 1, "PASS must close the created terminal once: " + JSON.stringify(agyCloses));
  assert.equal(fs.existsSync(adoptFile(pfRun)), false);
});

test("dispatch prints DISPATCHED when an ACK and a failed row are both present", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    peekMessages: [{ type: "heartbeat", subject: "ack", payload: payload("ctx_ab12") }],
    workers: [
      {
        dispatchId: "ctx_ab12",
        dispatchStatus: "failed",
        projection: {
          stage: { detail: "agent_readiness" },
          attention: {},
          liveness: {},
          nextAction: null,
        },
      },
    ],
  });
  const r = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_ack_failed", "--phase", "implement", "--spec-file", "task.md"],
    ctx
  );
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /^DISPATCHED ctx_ab12$/m);
  assert.equal(/NO_ACK/.test(r.stdout), false, "ACK must win over a failed row: " + r.stdout);
});

test("NO_ACK on a failed row reports the seconds actually waited, not ACK_S", () => {
  const ctx = setup(DEFAULT_AGENTS, {
    workerStarts: [{ dispatchId: "ctx_ab12" }],
    workers: [
      {
        dispatchId: "ctx_ab12",
        dispatchStatus: "failed",
        projection: {
          stage: { detail: "agent_readiness" },
          attention: {},
          liveness: {},
          nextAction: null,
        },
      },
    ],
  });
  const t0 = Date.now();
  const r = runDely(
    ["dispatch", "--repo", ctx.repo, "--run", "run_nack_elapsed", "--phase", "implement", "--spec-file", "task.md"],
    ctx,
    { DELY_ACK_S: "8", SPAWN_TIMEOUT_MS: 15000 }
  );
  const elapsedS = (Date.now() - t0) / 1000;
  assert.equal(r.status, 4, r.stderr + r.stdout);
  const m = r.stdout.match(/^NO_ACK ctx_ab12 stopped after (\d+)s; last output: /m);
  assert.ok(m, "line shape must stay NO_ACK <id> stopped after <s>s; last output: <text>: " + r.stdout);
  const reported = Number(m[1]);
  assert.notEqual(reported, 8, "must report elapsed seconds, not ACK_S: " + r.stdout);
  assert.ok(
    reported <= Math.ceil(elapsedS),
    "reported wait must be the seconds actually waited: reported=" + reported + " elapsed=" + elapsedS + "s " + r.stdout
  );
});
