#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BINARY = {
  claude: "claude",
  codex: "codex",
  grok: "grok",
  antigravity: "agy",
  kiro: "kiro-cli",
  cursor: "cursor-agent",
  copilot: "copilot",
};

const POLL_MS = numEnv("DELY_POLL_MS", 10000);
const ACK_S = numEnv("DELY_ACK_S", 120);
const SILENCE_S = numEnv("DELY_SILENCE_S", 90);
const DEADLINE_S = numEnv("DELY_DEADLINE_S", 3600);
const QUIET_S = numEnv("DELY_QUIET_S", 3);
const QUIET_MIN_S = numEnv("DELY_QUIET_MIN_S", 5);

function numEnv(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function sleepMs(ms) {
  if (!(ms > 0)) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.ceil(ms));
}

function parseJson(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch (_) {
    /* fall through */
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }
  return null;
}

function orca(args) {
  const bin = process.env.ORCA_CLI_COMMAND || "orca";
  const opts = { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: process.env };
  const r = /\.m?js$/i.test(bin)
    ? spawnSync(process.execPath, [bin, ...args], opts)
    : spawnSync(bin, args, opts);
  return {
    status: r.status,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    json: parseJson(r.stdout),
    error: r.error,
  };
}

function result(r) {
  return r && r.json && r.json.result ? r.json.result : {};
}

function finish(code, line) {
  process.stdout.write(String(line) + "\n");
  process.exit(code);
}

function splitRow(line) {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

function stripTicks(s) {
  return String(s || "").replace(/`/g, "").trim();
}

function parseHarnessTable(md) {
  const lines = String(md).split(/\r?\n/).filter((l) => l.startsWith("|"));
  if (lines.length < 3) return {};
  const header = splitRow(lines[0]);
  const by = {};
  for (const line of lines.slice(2)) {
    const cells = splitRow(line);
    if (!cells.length) continue;
    const rec = {};
    header.forEach((h, i) => {
      rec[h] = cells[i] || "";
    });
    const name = rec.Harness;
    const agent = stripTicks(rec["Orca agent id"]);
    const entry = {
      name,
      agent,
      permission: rec["Permission default"] || "",
      launch: stripTicks(rec.Launch),
      modelPin: rec["Model pin"] || "",
      wake: (rec["Control wake"] || "").trim(),
    };
    if (name) by[name] = entry;
    if (agent) by[agent] = entry;
  }
  return by;
}

function parsePins(md) {
  const pins = {};
  for (const line of String(md).split(/\r?\n/)) {
    if (!/^\|\s*`?(implement|review)`?\s*\|/.test(line)) continue;
    const cells = splitRow(line);
    const phase = stripTicks(cells[0]);
    pins[phase] = {
      harness: (cells[1] || "").trim(),
      model: (cells[2] || "").replace(/\s+/g, ""),
      effort: (cells[3] || "").replace(/\s+/g, ""),
    };
  }
  return pins;
}

function loadHarnesses() {
  const file = path.join(__dirname, "..", "references", "harnesses.md");
  return parseHarnessTable(fs.readFileSync(file, "utf8"));
}

function loadPins(repo) {
  const file = path.join(repo, "AGENTS.md");
  return parsePins(fs.readFileSync(file, "utf8"));
}

function absRepo(repo) {
  const resolved = path.resolve(repo);
  try {
    return fs.realpathSync(resolved);
  } catch (_) {
    return resolved;
  }
}

function permissionFromCell(cell) {
  const t = String(cell || "").trim();
  if (/^none\b/i.test(t)) return "";
  const m = t.match(/`([^`]+)`/);
  return m ? m[1] : "";
}

function orcaDataPath() {
  return path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "orca",
    "profiles",
    "local-default",
    "orca-data.json"
  );
}

function adoptedPermission(agent, tableCell) {
  try {
    const data = JSON.parse(fs.readFileSync(orcaDataPath(), "utf8"));
    const v = data && data.settings && data.settings.agentDefaultArgs && data.settings.agentDefaultArgs[agent];
    if (v != null && v !== "") return Array.isArray(v) ? v.join(" ") : String(v);
  } catch (_) {
    /* table fallback */
  }
  return permissionFromCell(tableCell);
}

function makeKey(repo, controlAgent, harnesses, pins) {
  const control = harnesses[controlAgent];
  const wake = control ? control.wake : "unknown";
  const impl = pinTriple(pins.implement, harnesses);
  const rev = pinTriple(pins.review, harnesses);
  return `repo=${repo};control=${controlAgent}/${wake};implement=${impl};review=${rev}`;
}

function pinTriple(pin, harnesses) {
  if (!pin) return "unknown/unknown/unknown";
  const h = harnesses[pin.harness];
  const agent = h ? h.agent : "unknown";
  return `${agent}/${pin.model}/${pin.effort}`;
}

function keyHash(key) {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex").slice(0, 12);
}

function objectiveFor(key) {
  return `dely verify ${keyHash(key)}`;
}

function parseTaskResult(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
  return raw;
}

function orcaFailed(r) {
  return Boolean(r.error) || r.status !== 0 || !r.json || r.json.ok === false;
}

function orcaReason(r, fallback) {
  if (r.error && r.error.message) return r.error.message;
  if (r.json && r.json.error && r.json.error.message) return r.json.error.message;
  const errText = String(r.stderr || "").trim();
  if (errText) return errText;
  if (!r.json) return fallback;
  if (r.status) return `exit ${r.status}`;
  return fallback;
}

function listAllRuns() {
  const runs = [];
  let cursor;
  for (;;) {
    const args = ["orchestration", "run-list", "--limit", "100"];
    if (cursor) args.push("--cursor", cursor);
    args.push("--json");
    const r = orca(args);
    if (orcaFailed(r)) return { ok: false, reason: orcaReason(r, "run-list failed") };
    const page = result(r).runs;
    if (!Array.isArray(page)) return { ok: false, reason: orcaReason(r, "malformed run-list") };
    runs.push(...page);
    cursor = result(r).nextCursor;
    if (!cursor || !page.length) break;
  }
  return { ok: true, runs };
}

function newestMatchingRun(runs, objective) {
  const matches = runs.filter((run) => run && run.objective === objective);
  if (!matches.length) return null;
  return matches.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
}

function lookupVerdict(key) {
  const objective = objectiveFor(key);
  const listed = listAllRuns();
  if (!listed.ok) return { status: "ERROR", reason: listed.reason };
  const run = newestMatchingRun(listed.runs, objective);
  if (!run) return { status: "NONE" };
  const tasksRes = orca(["orchestration", "task-list", "--run", run.id, "--json"]);
  const tasks = result(tasksRes).tasks || [];
  const task = tasks.find((t) => (t.task_title || t.title || t.display_name) === "dely-verify-verdict");
  if (!task) return { status: "NONE" };
  const parsed = parseTaskResult(task.result);
  if (parsed && parsed.verdict === "PASS" && parsed.key === key) {
    return { status: "PASS", runId: run.id };
  }
  return { status: "NONE" };
}

function buildSpec(specFile) {
  return `Read ${specFile} in the worktree root and follow it exactly. FIRST ACTION: send one heartbeat with --subject ack --phase investigating using the command in your Orca preamble.`;
}

function launchKind(entry, model) {
  if (String(entry.launch).toLowerCase() === "adopt") return "adopt";
  if (model !== "default" && /argv/i.test(entry.modelPin)) return "adopt";
  return "worker-start";
}

function workerStartBase({ spec, repo, run, title }) {
  const args = [
    "orchestration",
    "worker-start",
    "--spec",
    spec,
    "--worktree",
    `path:${repo}`,
    "--run",
    run,
    "--json",
  ];
  if (title) args.splice(4, 0, "--task-title", title);
  return args;
}

function addOrcaModelFlags(args, entry, agent, model, effort) {
  if (!/Orca/i.test(entry.modelPin)) return;
  if (model !== "default") args.push("--model", model);
  if (agent === "cursor") return;
  if (/--effort/.test(entry.modelPin) && effort !== "default") args.push("--effort", effort);
}

function adoptCommand(agent, perm, model, effort) {
  const parts = [BINARY[agent] || agent];
  if (perm) parts.push(...String(perm).split(/\s+/).filter(Boolean));
  if (model !== "default") parts.push("--model", model);
  if (effort !== "default") parts.push("--effort", effort);
  return parts.join(" ");
}

function startReceipt(r) {
  const res = result(r);
  const dispatchId = res.dispatchId || (res.dispatch && res.dispatch.id) || "";
  const state = res.state || (res.worker && res.worker.state) || (r.json && r.json.ok === false ? "error" : "");
  let handle =
    (res.worker && res.worker.agentTerminalHandle) ||
    res.agentTerminalHandle ||
    "";
  return { dispatchId, state, handle, json: r.json, status: r.status };
}

function workerHandle(dispatchId, known) {
  if (known) return known;
  if (!dispatchId) return "";
  const shown = orca(["orchestration", "worker-show", "--dispatch", dispatchId, "--json"]);
  const res = result(shown);
  return (res.worker && res.worker.agentTerminalHandle) || "";
}

function lastFailure(dispatchId, start) {
  if (dispatchId) {
    const shown = orca(["orchestration", "worker-show", "--dispatch", dispatchId, "--json"]);
    const lf = result(shown).dispatch && result(shown).dispatch.lastFailure;
    if (lf) return typeof lf === "string" ? lf : JSON.stringify(lf);
  }
  if (start && start.json && start.json.error && start.json.error.message) return start.json.error.message;
  if (start && start.state) return start.state;
  return "worker-start not ready";
}

function deliveryId(r) {
  const res = result(r);
  return res.deliveryId || "";
}

function messagesOf(r) {
  return result(r).messages || [];
}

function ackDelivery(run, id, terminal) {
  const args = ["orchestration", "check", "--run", run];
  if (terminal) args.push("--terminal", terminal);
  args.push("--ack", id, "--json");
  const r = orca(args);
  if (orcaFailed(r)) return { ok: false, reason: orcaReason(r, "ack rejected") };
  return { ok: true };
}

function uniqueTypes(messages) {
  const seen = [];
  for (const m of messages) {
    if (m && m.type && seen.indexOf(m.type) < 0) seen.push(m.type);
  }
  return seen;
}

function messageDispatchId(m) {
  if (!m) return "";
  if (m.dispatchId) return m.dispatchId;
  if (m.dispatch_id) return m.dispatch_id;
  if (m.payload && (m.payload.dispatchId || m.payload.dispatch_id)) {
    return m.payload.dispatchId || m.payload.dispatch_id;
  }
  return "";
}

function lastOutputAt(handle) {
  const shown = orca(["terminal", "show", "--terminal", handle, "--json"]);
  if (orcaFailed(shown)) return null;
  const raw = result(shown).terminal && result(shown).terminal.lastOutputAt;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function waitQuiet(handle, launchedAt) {
  const capS = numEnv("DELY_QUIET_CAP_S", 60);
  const cap = launchedAt + capS * 1000;
  for (;;) {
    const now = Date.now();
    if (now >= cap) return false;
    const lo = lastOutputAt(handle);
    const sinceLaunch = (now - launchedAt) / 1000;
    if (lo == null) {
      sleepMs(Math.min(200, Math.max(10, POLL_MS)));
      continue;
    }
    const sinceOut = (now - lo) / 1000;
    if (sinceLaunch >= QUIET_MIN_S && sinceOut >= QUIET_S) return true;
    sleepMs(Math.min(200, Math.max(10, POLL_MS)));
  }
}

function classify(handle) {
  if (!handle) return "no known cause on screen";
  const read = orca(["terminal", "read", "--terminal", handle, "--limit", "200", "--json"]);
  const tail = result(read).terminal && result(read).terminal.tail;
  const text = Array.isArray(tail) ? tail.join("") : String(tail || "");
  const packed = text.replace(/\s+/g, "");
  if (/Quicksafetycheck|Doyoutrustthecontents|WorkspaceTrustRequired|Confirmfoldertrust/.test(packed)) {
    return "trust dialog on screen; fix: accept trust once in an interactive launch";
  }
  if (/Updateavailable/.test(packed)) return "harness update prompt on screen; fix: update the harness between plans";
  if (/usagelimit|quota|RESOURCE_EXHAUSTED|429/.test(packed)) {
    return "usage limit or quota; fix: wait for reset, switch account, or change the pin";
  }
  if (/Signin|notloggedin/.test(packed)) return "not signed in; fix: sign in to the harness";
  try {
    const dir = path.join(os.homedir(), ".gemini", "antigravity-cli", "log");
    const logs = fs.readdirSync(dir).filter((f) => f.startsWith("cli-") && f.endsWith(".log"));
    for (const f of logs.slice(0, 3)) {
      const body = fs.readFileSync(path.join(dir, f), "utf8");
      if (body.indexOf("RESOURCE_EXHAUSTED") >= 0) return "Antigravity quota (RESOURCE_EXHAUSTED in its log)";
    }
  } catch (_) {
    /* optional */
  }
  const snippet = packed.slice(-100);
  return snippet ? `no known cause on screen; last output: ${snippet}` : "no known cause on screen";
}

function waitForAck(run, handle, startedAt) {
  while ((Date.now() - startedAt) / 1000 <= ACK_S) {
    const r = orca([
      "orchestration",
      "check",
      "--wait",
      "--run",
      run,
      "--types",
      "heartbeat",
      "--timeout-ms",
      String(Math.max(1, Math.floor(POLL_MS))),
      "--json",
    ]);
    const id = deliveryId(r);
    if (id) {
      const messages = messagesOf(r);
      const onlyHb = messages.length > 0 && messages.every((m) => m && m.type === "heartbeat");
      if (!onlyHb) continue;
      const acked = ackDelivery(run, id);
      if (!acked.ok) finish(9, `ERROR ack failed: ${acked.reason}`);
      const hit = messages.some((m) => m && m.type === "heartbeat" && m.from_handle === handle);
      if (hit) return (Date.now() - startedAt) / 1000;
    }
  }
  return null;
}

function workerList(run) {
  const r = orca(["orchestration", "worker-list", "--run", run, "--json"]);
  if (orcaFailed(r)) return { ok: false, reason: orcaReason(r, "worker-list failed") };
  const rows = result(r).workers;
  if (!Array.isArray(rows)) return { ok: false, reason: orcaReason(r, "malformed worker-list") };
  return { ok: true, workers: rows };
}

function heartbeatSeen(worker, seen) {
  if (seen.has(worker.dispatchId) || seen.has(worker.agentTerminalHandle)) return true;
  if (worker.lastHeartbeatAt) return true;
  const shown = orca(["orchestration", "worker-show", "--dispatch", worker.dispatchId, "--json"]);
  const dispatch = result(shown).dispatch || {};
  return Boolean(dispatch.lastHeartbeatAt);
}

function checkSilent(run, seen) {
  const listed = workerList(run);
  if (!listed.ok) return null;
  for (const worker of listed.workers) {
    if (worker.dispatchStatus !== "dispatched") continue;
    if (!heartbeatSeen(worker, seen)) continue;
    const handle = worker.agentTerminalHandle;
    if (!handle) continue;
    const lo = lastOutputAt(handle);
    if (lo == null) continue;
    const silentFor = (Date.now() - lo) / 1000;
    if (silentFor > SILENCE_S) {
      return { dispatchId: worker.dispatchId, seconds: Math.floor(silentFor) };
    }
  }
  return null;
}

function markHeartbeats(messages, seen) {
  for (const m of messages) {
    if (!m || m.type !== "heartbeat") continue;
    const id = messageDispatchId(m);
    if (id) seen.add(id);
    if (m.from_handle) seen.add(m.from_handle);
  }
}

function cmdStatus(flags) {
  const repo = absRepo(flags.repo);
  const harnesses = loadHarnesses();
  const pins = loadPins(repo);
  const key = makeKey(repo, flags.control, harnesses, pins);
  const found = lookupVerdict(key);
  if (found.status === "ERROR") finish(9, `ERROR run-list failed: ${found.reason}`);
  if (found.status === "PASS") finish(0, `PASS ${found.runId}`);
  finish(1, "NONE");
}

function cmdDispatch(flags) {
  const repo = absRepo(flags.repo);
  const harnesses = loadHarnesses();
  const pins = loadPins(repo);
  const key = makeKey(repo, flags.control, harnesses, pins);
  const found = lookupVerdict(key);
  if (found.status === "ERROR") finish(9, `ERROR run-list failed: ${found.reason}`);
  if (found.status !== "PASS") {
    finish(3, `REFUSED no PASS verdict for key ${key}; run dely verify`);
  }
  const phase = flags.phase;
  const pin = pins[phase];
  if (!pin) finish(5, `FAILED unknown phase ${phase}`);
  const entry = harnesses[pin.harness];
  if (!entry) finish(5, `FAILED unknown harness ${pin.harness}`);
  const spec = buildSpec(flags["spec-file"]);
  const title = flags.title || `dely-${phase}`;
  const kind = launchKind(entry, pin.model);
  let created = false;
  let handle = "";
  let started;
  const launchedAt = Date.now();
  if (kind === "adopt") {
    const perm = adoptedPermission(entry.agent, entry.permission);
    const command = adoptCommand(entry.agent, perm, pin.model, pin.effort);
    const createdTerm = orca([
      "terminal",
      "create",
      "--worktree",
      `path:${repo}`,
      "--title",
      title,
      "--command",
      command,
      "--json",
    ]);
    handle = result(createdTerm).terminal && result(createdTerm).terminal.handle;
    if (!handle) finish(5, "FAILED terminal create");
    created = true;
    if (!waitQuiet(handle, launchedAt)) {
      const secs = Math.max(1, Math.floor((Date.now() - launchedAt) / 1000));
      orca(["terminal", "close", "--terminal", handle, "--json"]);
      finish(5, `FAILED readiness timeout after ${secs}s`);
    }
    const args = workerStartBase({ spec, repo, run: flags.run, title });
    args.push("--terminal", handle, "--timeout-ms", "60000");
    started = startReceipt(orca(args));
  } else {
    const args = workerStartBase({ spec, repo, run: flags.run, title });
    args.push("--agent", entry.agent, "--timeout-ms", "90000");
    addOrcaModelFlags(args, entry, entry.agent, pin.model, pin.effort);
    started = startReceipt(orca(args));
  }
  const dispatchId = started.dispatchId;
  handle = workerHandle(dispatchId, handle || started.handle);
  if (started.state !== "ready") {
    finish(5, `FAILED ${lastFailure(dispatchId, started)}`);
  }
  const ack = waitForAck(flags.run, handle, Date.now());
  if (ack == null) {
    if (dispatchId) orca(["orchestration", "worker-stop", "--dispatch", dispatchId, "--json"]);
    if (created && handle) orca(["terminal", "close", "--terminal", handle, "--json"]);
    finish(4, `NO_ACK ${dispatchId || "-"} ${classify(handle)}`);
  }
  finish(0, `DISPATCHED ${dispatchId} ${handle} ack=${Math.floor(ack)}`);
}

function cmdWait(flags) {
  const run = flags.run;
  const startedAt = Date.now();
  const seen = new Set();
  for (;;) {
    const r = orca([
      "orchestration",
      "check",
      "--wait",
      "--run",
      run,
      "--types",
      "heartbeat,worker_done,escalation,question",
      "--timeout-ms",
      String(Math.max(1, Math.floor(POLL_MS))),
      "--json",
    ]);
    const id = deliveryId(r);
    if (id) {
      const messages = messagesOf(r);
      const acked = ackDelivery(run, id);
      if (!acked.ok) finish(9, `ERROR ack failed: ${acked.reason}`);
      markHeartbeats(messages, seen);
      const types = uniqueTypes(messages);
      const onlyHb = types.length > 0 && types.every((t) => t === "heartbeat");
      if (!onlyHb && types.length) {
        finish(0, `SETTLED ${types.join(",")} ${JSON.stringify(messages)}`);
      }
    }
    const elapsed = (Date.now() - startedAt) / 1000;
    if (elapsed > DEADLINE_S) finish(7, `DEADLINE ${Math.floor(elapsed)}`);
    const silent = checkSilent(run, seen);
    if (silent) finish(6, `SILENT ${silent.dispatchId} ${silent.seconds}`);
  }
}

function sendWatchdog(run, reason) {
  orca([
    "orchestration",
    "send",
    "--to",
    `run:${run}`,
    "--run",
    run,
    "--type",
    "status",
    "--priority",
    "high",
    "--subject",
    `dely watchdog: ${reason}`,
    "--json",
  ]);
}

function cmdSidecar(flags) {
  const run = flags.run;
  const terminal = flags["control-handle"];
  const startedAt = Date.now();
  const seen = new Set();
  const sent = new Set();
  for (;;) {
    const r = orca([
      "orchestration",
      "check",
      "--wait",
      "--run",
      run,
      "--terminal",
      terminal,
      "--types",
      "heartbeat",
      "--timeout-ms",
      String(Math.max(1, Math.floor(POLL_MS))),
      "--json",
    ]);
    const id = deliveryId(r);
    if (id) {
      markHeartbeats(messagesOf(r), seen);
      const acked = ackDelivery(run, id, terminal);
      if (!acked.ok) finish(9, `ERROR ack failed: ${acked.reason}`);
    }
    const elapsed = (Date.now() - startedAt) / 1000;
    const silent = checkSilent(run, seen);
    if (silent && !sent.has("silent")) {
      sent.add("silent");
      sendWatchdog(run, `SILENT ${silent.dispatchId} ${silent.seconds}`);
    }
    if (elapsed > DEADLINE_S && !sent.has("deadline")) {
      sent.add("deadline");
      sendWatchdog(run, `DEADLINE ${Math.floor(elapsed)}`);
    }
    const listed = workerList(run);
    if (listed.ok) {
      const open = listed.workers.filter((w) => w.dispatchStatus === "dispatched");
      if (!open.length) process.exit(0);
    }
    if (elapsed > DEADLINE_S + 120) process.exit(0);
  }
}

function cmdCollect(flags) {
  const run = flags.run;
  for (;;) {
    const r = orca(["orchestration", "check", "--run", run, "--json"]);
    const id = deliveryId(r);
    if (!id) break;
    const messages = messagesOf(r);
    const acked = ackDelivery(run, id);
    if (!acked.ok) finish(9, `ERROR ack failed: ${acked.reason}`);
    for (const m of messages) {
      if (!m || m.type === "heartbeat") continue;
      const dispatchId = messageDispatchId(m) || "-";
      process.stdout.write(`SETTLED ${dispatchId} ${m.type} ${m.body || ""}\n`);
    }
  }
  const listed = workerList(run);
  if (!listed.ok) finish(9, `ERROR worker-list failed: ${listed.reason}`);
  const open = listed.workers.filter((w) => w.dispatchStatus === "dispatched").map((w) => w.dispatchId);
  if (open.length) finish(2, `WAITING ${open.join(" ")}`);
  process.exit(0);
}

function parseArgs(argv) {
  const cmd = argv[0];
  const flags = {};
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    }
  }
  return { cmd, flags };
}

function main(argv) {
  const { cmd, flags } = parseArgs(argv);
  switch (cmd) {
    case "status":
      if (!flags.repo || !flags.control) finish(2, "usage: dely status --repo <path> --control <agent>");
      return cmdStatus(flags);
    case "dispatch":
      if (!flags.repo || !flags.run || !flags.phase || !flags["spec-file"] || !flags.control) {
        finish(2, "usage: dely dispatch --repo <path> --run <runId> --phase <implement|review> --spec-file <path> --control <agent>");
      }
      return cmdDispatch(flags);
    case "wait":
      if (!flags.run) finish(2, "usage: dely wait --run <runId>");
      return cmdWait(flags);
    case "sidecar":
      if (!flags.run || !flags["control-handle"]) {
        finish(2, "usage: dely sidecar --run <runId> --control-handle <handle>");
      }
      return cmdSidecar(flags);
    case "collect":
      if (!flags.run) finish(2, "usage: dely collect --run <runId>");
      return cmdCollect(flags);
    default:
      finish(2, "usage: dely status|dispatch|wait|sidecar|collect");
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { makeKey, buildSpec, launchKind, lookupVerdict };
