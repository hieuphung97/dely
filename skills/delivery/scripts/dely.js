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
const VERIFY_DEADLINE_S = numEnv("DELY_VERIFY_DEADLINE_S", 300);

let restoreOnExit = null;

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

function restorePrev(prev) {
  if (!prev) return;
  orca(["orchestration", "run-use", "--id", prev, "--json"]);
}

function withPrevRestore(fn) {
  try {
    fn();
  } catch (err) {
    const prev = restoreOnExit;
    restoreOnExit = null;
    restorePrev(prev);
    finish(1, `ERROR ${err && err.message ? err.message : err}`);
  } finally {
    if (restoreOnExit) {
      restorePrev(restoreOnExit);
      restoreOnExit = null;
    }
  }
}

function finish(code, line) {
  if (restoreOnExit) {
    restorePrev(restoreOnExit);
    restoreOnExit = null;
  }
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
      setup: (rec.Setup || "").trim(),
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

function payloadFields(m) {
  if (!m) return {};
  const raw = m.payload;
  if (raw && typeof raw === "object") return raw;
  if (typeof raw === "string") {
    const parsed = parseJson(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  }
  return {};
}

function messageDispatchId(m) {
  if (!m) return "";
  if (m.dispatchId) return m.dispatchId;
  if (m.dispatch_id) return m.dispatch_id;
  const payload = payloadFields(m);
  return payload.dispatchId || payload.dispatch_id || "";
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

function hasSettle(messages) {
  return (messages || []).some(
    (m) => m && (m.type === "worker_done" || m.type === "escalation" || m.type === "question")
  );
}

function stopDispatch(id) {
  if (!id) return;
  orca(["orchestration", "worker-stop", "--dispatch", id, "--json"]);
}

function parseDispatchedAt(raw) {
  if (raw == null || raw === "") return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

function checkDeadline(run) {
  const listed = workerList(run);
  if (!listed.ok) return null;
  for (const worker of listed.workers) {
    if (worker.dispatchStatus !== "dispatched") continue;
    const shown = orca(["orchestration", "worker-show", "--dispatch", worker.dispatchId, "--json"]);
    const at = parseDispatchedAt((result(shown).dispatch || {}).dispatchedAt);
    if (at == null) continue;
    const seconds = (Date.now() - at) / 1000;
    if (seconds > DEADLINE_S) {
      return { dispatchId: worker.dispatchId, seconds: Math.floor(seconds) };
    }
  }
  return null;
}

function waitForAck(run, handle, startedAt) {
  while ((Date.now() - startedAt) / 1000 <= ACK_S) {
    const r = orca(["orchestration", "check", "--peek", "--run", run, "--json"]);
    const messages = messagesOf(r);
    const hit = messages.some((m) => m && m.type === "heartbeat" && m.from_handle === handle);
    if (hit) return (Date.now() - startedAt) / 1000;
    sleepMs(Math.max(1, Math.floor(POLL_MS)));
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
  const out = launchDispatch({
    repo,
    run: flags.run,
    phase,
    specFile: flags["spec-file"],
    title: flags.title || `dely-${phase}`,
    pin,
    entry,
  });
  finish(out.code, out.line);
}

function launchDispatch({ repo, run, phase, specFile, title, pin, entry }) {
  const spec = buildSpec(specFile);
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
    if (!handle) return { code: 5, line: "FAILED terminal create" };
    created = true;
    if (!waitQuiet(handle, launchedAt)) {
      const secs = Math.max(1, Math.floor((Date.now() - launchedAt) / 1000));
      orca(["terminal", "close", "--terminal", handle, "--json"]);
      return { code: 5, line: `FAILED readiness timeout after ${secs}s` };
    }
    const args = workerStartBase({ spec, repo, run, title });
    args.push("--terminal", handle, "--timeout-ms", "60000");
    started = startReceipt(orca(args));
  } else {
    const args = workerStartBase({ spec, repo, run, title });
    args.push("--agent", entry.agent, "--timeout-ms", "90000");
    addOrcaModelFlags(args, entry, entry.agent, pin.model, pin.effort);
    started = startReceipt(orca(args));
  }
  const dispatchId = started.dispatchId;
  handle = workerHandle(dispatchId, handle || started.handle);
  if (started.state !== "ready") {
    return { code: 5, line: `FAILED ${lastFailure(dispatchId, started)}`, dispatchId, handle, created };
  }
  const ack = waitForAck(run, handle, Date.now());
  if (ack == null) {
    if (dispatchId) orca(["orchestration", "worker-stop", "--dispatch", dispatchId, "--json"]);
    if (created && handle) orca(["terminal", "close", "--terminal", handle, "--json"]);
    return {
      code: 4,
      line: `NO_ACK ${dispatchId || "-"} ${classify(handle)}`,
      dispatchId,
      handle,
      created,
    };
  }
  return {
    code: 0,
    line: `DISPATCHED ${dispatchId} ${handle} ack=${Math.floor(ack)}`,
    dispatchId,
    handle,
    created,
    adopted: created,
    ack,
  };
}

function waitStep(run, startedAt, seen, deadlineS) {
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
    if (!acked.ok) return { type: "error", reason: `ack failed: ${acked.reason}` };
    markHeartbeats(messages, seen);
    if (hasSettle(messages)) {
      return { type: "settled", messages, types: uniqueTypes(messages) };
    }
  }
  const elapsed = (Date.now() - startedAt) / 1000;
  if (elapsed > deadlineS) return { type: "deadline", seconds: Math.floor(elapsed) };
  const silent = checkSilent(run, seen);
  if (silent) return { type: "silent", dispatchId: silent.dispatchId, seconds: silent.seconds };
  return { type: "idle" };
}

function cmdWait(flags) {
  const seen = new Set();
  for (;;) {
    const step = waitStep(flags.run, Date.now(), seen, Number.POSITIVE_INFINITY);
    if (step.type === "settled") {
      finish(0, `SETTLED ${step.types.join(",")} ${JSON.stringify(step.messages)}`);
    }
    if (step.type === "error") finish(9, `ERROR ${step.reason}`);
    const deadline = checkDeadline(flags.run);
    if (deadline) finish(7, `DEADLINE ${deadline.dispatchId} ${deadline.seconds}`);
    if (step.type === "silent") {
      stopDispatch(step.dispatchId);
      finish(6, `SILENT ${step.dispatchId} ${step.seconds}`);
    }
  }
}

function sendWake(run, reason) {
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
    `dely wake: ${reason}`,
    "--json",
  ]);
}

function cmdSidecar(flags) {
  const run = flags.run;
  const terminal = flags["control-handle"];
  const seen = new Set();
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
      "heartbeat,worker_done,escalation,question",
      "--timeout-ms",
      String(Math.max(1, Math.floor(POLL_MS))),
      "--json",
    ]);
    const id = deliveryId(r);
    if (id) {
      const messages = messagesOf(r);
      markHeartbeats(messages, seen);
      const acked = ackDelivery(run, id, terminal);
      if (!acked.ok) finish(9, `ERROR ack failed: ${acked.reason}`);
      if (hasSettle(messages)) {
        sendWake(run, uniqueTypes(messages).join(","));
        process.exit(0);
      }
    }
    const deadline = checkDeadline(run);
    const silent = checkSilent(run, seen);
    if (deadline) {
      sendWake(run, `DEADLINE ${deadline.dispatchId} ${deadline.seconds}`);
      process.exit(0);
    }
    if (silent) {
      sendWake(run, `SILENT ${silent.dispatchId} ${silent.seconds}`);
      process.exit(0);
    }
    const listed = workerList(run);
    if (listed.ok) {
      const open = listed.workers.filter((w) => w.dispatchStatus === "dispatched");
      if (!open.length) process.exit(0);
    }
  }
}

function messageIdentity(m, index, deliveryId) {
  if (m && m.id != null && String(m.id) !== "") return "id:" + m.id;
  const dv = deliveryId || (m && (m.deliveryId || m.delivery_id)) || "";
  if (dv) return "dv:" + dv + ":" + index;
  return "pos:" + index;
}

function deliveryIndex(messages, i) {
  const dv = (messages[i] && (messages[i].deliveryId || messages[i].delivery_id)) || "";
  let n = 0;
  for (let j = 0; j < i; j++) {
    const other = (messages[j] && (messages[j].deliveryId || messages[j].delivery_id)) || "";
    if (other === dv) n++;
  }
  return n;
}

function collectSettles(run, opts) {
  const print = !opts || opts.print !== false;
  const listed = workerList(run);
  if (!listed.ok) return { ok: false, reason: `worker-list failed: ${listed.reason}` };
  const byHandle = new Map();
  for (const worker of listed.workers) {
    if (worker.agentTerminalHandle) byHandle.set(worker.agentTerminalHandle, worker.dispatchId);
  }
  const all = orca(["orchestration", "check", "--all", "--run", run, "--json"]);
  if (orcaFailed(all)) return { ok: false, reason: `check --all failed: ${orcaReason(all, "check failed")}` };
  const printed = new Set();
  const settles = [];
  function report(list, i) {
    const m = list[i];
    if (!hasSettle([m])) return;
    const dispatchId = messageDispatchId(m) || byHandle.get(m.from_handle) || "-";
    const key = messageIdentity(m, deliveryIndex(list, i), m.deliveryId || m.delivery_id);
    if (printed.has(key)) return;
    printed.add(key);
    const line = `SETTLED ${dispatchId} ${m.type} ${m.body || ""}`;
    settles.push({ dispatchId, type: m.type, body: m.body || "", message: m, line });
    if (print) process.stdout.write(line + "\n");
  }
  const history = messagesOf(all);
  for (let i = 0; i < history.length; i++) report(history, i);
  for (;;) {
    const r = orca(["orchestration", "check", "--run", run, "--json"]);
    if (orcaFailed(r)) return { ok: false, reason: `check failed: ${orcaReason(r, "check failed")}` };
    const id = deliveryId(r);
    if (!id) break;
    const acked = ackDelivery(run, id);
    if (!acked.ok) return { ok: false, reason: `ack failed: ${acked.reason}` };
    const batch = messagesOf(r);
    for (let i = 0; i < batch.length; i++) report(batch, i);
  }
  const open = listed.workers.filter((w) => w.dispatchStatus === "dispatched").map((w) => w.dispatchId);
  return { ok: true, settles, open, workers: listed.workers, history };
}

function cmdCollect(flags) {
  const collected = collectSettles(flags.run);
  if (!collected.ok) finish(9, `ERROR ${collected.reason}`);
  const seen = new Set();
  markHeartbeats(collected.history || [], seen);
  const silent = checkSilent(flags.run, seen);
  if (silent) {
    stopDispatch(silent.dispatchId);
    finish(6, `SILENT ${silent.dispatchId} ${silent.seconds}`);
  }
  const deadline = checkDeadline(flags.run);
  if (deadline) finish(7, `DEADLINE ${deadline.dispatchId} ${deadline.seconds}`);
  if (collected.open.length) {
    ensureRunSidecar(absRepo(flags.repo), flags.run);
    finish(2, `WAITING ${collected.open.join(" ")}`);
  }
  process.exit(0);
}

function pinGroups(pins, harnesses) {
  const groups = [];
  const seen = new Map();
  for (const phase of ["implement", "review"]) {
    const pin = pins[phase];
    if (!pin) continue;
    const entry = harnesses[pin.harness];
    const agent = entry ? entry.agent : "unknown";
    const k = agent + "|" + pin.model + "|" + pin.effort;
    if (seen.has(k)) {
      seen.get(k).phases.push(phase);
      continue;
    }
    const g = { phases: [phase], pin, entry, agent, status: "", reason: "", ack: null, done: null };
    seen.set(k, g);
    groups.push(g);
  }
  return groups;
}

function groupForPhase(groups, phase) {
  return groups.find((g) => g.phases.indexOf(phase) >= 0);
}

function readHomeJson(rel, jsonc) {
  const file = path.join(os.homedir(), rel);
  try {
    let text = fs.readFileSync(file, "utf8");
    if (jsonc) text = text.replace(/^\s*\/\/.*$/gm, "");
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

function cursorTrusted(repo) {
  const root = path.join(os.homedir(), ".cursor", "projects");
  try {
    for (const name of fs.readdirSync(root)) {
      const file = path.join(root, name, ".workspace-trusted");
      try {
        if (!fs.statSync(file).isFile()) continue;
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (data && data.workspacePath === repo) return true;
      } catch (_) {
        /* next */
      }
    }
  } catch (_) {
    /* missing */
  }
  const slug = String(repo).replace(/^\//, "").replace(/\//g, "-");
  return fs.existsSync(path.join(root, slug, ".workspace-trusted"));
}

function installedCodexVersion() {
  if (process.env.DELY_CODEX_VERSION) return String(process.env.DELY_CODEX_VERSION);
  const r = spawnSync("codex", ["--version"], { encoding: "utf8" });
  const text = String(r.stdout || "").trim();
  const parts = text.split(/\s+/);
  return parts[1] || parts[0] || "";
}

function codexUpdatePending() {
  const data = readHomeJson(path.join(".codex", "version.json"));
  if (!data) return "";
  const latest = data.latest_version || "";
  if (!latest) return "";
  const installed = installedCodexVersion();
  const dismissed = data.dismissed_version || "";
  if (latest !== installed && latest !== dismissed) return latest;
  return "";
}

function preflightAgent(agent, repo) {
  const binary = BINARY[agent] || agent;
  const trustFix = `open ${binary} once in ${repo} and accept its trust dialog`;
  switch (agent) {
    case "claude": {
      const data = readHomeJson(".claude.json");
      const ok =
        data &&
        data.projects &&
        data.projects[repo] &&
        data.projects[repo].hasTrustDialogAccepted === true;
      if (!ok) {
        return { ok: false, reason: `workspace not trusted for Claude Code; fix: ${trustFix}` };
      }
      return { ok: true };
    }
    case "antigravity": {
      const data = readHomeJson(path.join(".gemini", "antigravity-cli", "settings.json"));
      const list = data && data.trustedWorkspaces;
      if (!(Array.isArray(list) && list.indexOf(repo) >= 0)) {
        return { ok: false, reason: `workspace not trusted for Antigravity CLI; fix: ${trustFix}` };
      }
      return { ok: true };
    }
    case "copilot": {
      const data = readHomeJson(path.join(".copilot", "config.json"), true);
      const list = data && data.trustedFolders;
      if (!(Array.isArray(list) && list.indexOf(repo) >= 0)) {
        return { ok: false, reason: `workspace not trusted for GitHub Copilot CLI; fix: ${trustFix}` };
      }
      return { ok: true };
    }
    case "cursor": {
      if (cursorTrusted(repo)) return { ok: true };
      return { ok: false, reason: `workspace not trusted for Cursor Agent CLI; fix: ${trustFix}` };
    }
    case "codex": {
      const pending = codexUpdatePending();
      if (pending) {
        return { ok: false, reason: `Codex update ${pending} pending; fix: update Codex between plans` };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

function gitPorcelain(repo) {
  const r = spawnSync("git", ["-C", repo, "status", "--porcelain"], { encoding: "utf8" });
  return r.stdout || "";
}

function boundRunId() {
  const r = orca(["orchestration", "run-current", "--json"]);
  const res = result(r);
  return (res.run && res.run.id) || res.id || "";
}

function workerOutcome(m) {
  if (!m) return "";
  if (m.outcome) return m.outcome;
  const payload = payloadFields(m);
  return payload.outcome || "";
}

function verifyPassMessage(m) {
  return (
    Boolean(m) &&
    m.type === "worker_done" &&
    workerOutcome(m) === "succeeded" &&
    String(m.body || "").startsWith("dely verify ok")
  );
}

function writeVerifyTask(repo, phase) {
  const dir = path.join(repo, ".dely-verify");
  fs.mkdirSync(dir, { recursive: true });
  const rel = `.dely-verify/TASK-${phase}.md`;
  const body =
    `# Dely verify (${phase})\n` +
    "This is a verify dispatch. Do exactly these steps and nothing else.\n" +
    "1. Run `mkdir -p .dely-verify && echo ok > .dely-verify/write-" +
    phase +
    ".txt && cat .dely-verify/write-" +
    phase +
    ".txt && rm .dely-verify/write-" +
    phase +
    ".txt`.\n" +
    "2. Run `git rev-parse --short HEAD`.\n" +
    "3. Send `worker_done --outcome succeeded` with the body `dely verify ok phase=" +
    phase +
    " head=<hash> write=<ok or the error>`, or `--outcome failed` if a step failed.\n" +
    "4. Do not edit, stage or commit anything else.\n";
  fs.writeFileSync(path.join(repo, rel), body);
  return rel;
}

function applySettled(groups, messages) {
  for (const m of messages || []) {
    const g =
      groups.find((x) => x.handle && m.from_handle === x.handle) ||
      groups.find((x) => x.dispatchId && messageDispatchId(m) === x.dispatchId);
    if (!g || g.status) continue;
    if (m.type === "worker_done") {
      g.done = Math.floor((Date.now() - (g.t0 || Date.now())) / 1000);
      if (verifyPassMessage(m)) {
        g.status = "PASS";
        g.reason = m.body || "";
      } else {
        g.status = "FAIL";
        g.reason = m.body || "worker_done not dely verify ok";
      }
    } else if (m.type === "escalation" || m.type === "question") {
      g.status = "FAIL";
      g.reason = m.type + ": " + String(m.body || "").slice(0, 200);
    }
  }
}

function consumeVerify(run, groups, startedAt, deadlineS) {
  const seen = new Set();
  function pending() {
    return groups.some((g) => g.dispatchId && !g.status);
  }
  while (pending()) {
    const step = waitStep(run, startedAt, seen, deadlineS);
    if (step.type === "error") return step;
    if (step.type === "settled") {
      applySettled(groups, step.messages);
      continue;
    }
    if (step.type === "silent") {
      for (const g of groups) {
        if (!g.status && g.dispatchId === step.dispatchId) {
          g.status = "SILENT";
          g.reason = `no terminal output for ${step.seconds}s`;
        }
      }
      continue;
    }
    if (step.type === "deadline") {
      for (const g of groups) {
        if (!g.status && g.dispatchId) {
          g.status = "DEADLINE";
          g.reason = `not done after ${step.seconds}s`;
        }
      }
      return step;
    }
  }
  return { type: "done" };
}

function coordinatorHandle(runId) {
  const listed = listAllRuns();
  if (listed.ok) {
    const run = listed.runs.find((r) => r.id === runId);
    if (run && run.coordinator_handle) return run.coordinator_handle;
  }
  return process.env.ORCA_TERMINAL_HANDLE || "";
}

function launcherPath() {
  return path.resolve(__dirname, "dely");
}

function startSidecar(repo, run, controlHandle, launcher, title) {
  const command = `${launcher} sidecar --run ${run} --control-handle ${controlHandle}`;
  const created = orca([
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
  return (result(created).terminal && result(created).terminal.handle) || "";
}

function startVerifySidecar(repo, verifyRun, controlHandle, launcher) {
  return startSidecar(repo, verifyRun, controlHandle, launcher, "dely-verify-sidecar");
}

function sidecarAlive(handle) {
  if (!handle) return false;
  const shown = orca(["terminal", "show", "--terminal", handle, "--json"]);
  if (orcaFailed(shown)) return false;
  const t = result(shown).terminal || {};
  if (t.running === false || t.closed) return false;
  return true;
}

function ensureRunSidecar(repo, run) {
  const title = "dely-sidecar " + run;
  const listed = orca(["terminal", "list", "--json"]);
  const terminals = result(listed).terminals;
  if (Array.isArray(terminals)) {
    for (const t of terminals) {
      if (!t || t.title !== title) continue;
      if (sidecarAlive(t.handle)) return t.handle;
    }
  }
  return startSidecar(repo, run, coordinatorHandle(run), launcherPath(), title);
}

function writeVerdict(verifyRun, key, pass) {
  const created = orca([
    "orchestration",
    "task-create",
    "--run",
    verifyRun,
    "--task-title",
    "dely-verify-verdict",
    "--spec",
    key,
    "--json",
  ]);
  const res = result(created);
  const taskId = (res.task && res.task.id) || res.taskId || res.id;
  const payload = JSON.stringify({ verdict: pass ? "PASS" : "FAIL", key });
  orca([
    "orchestration",
    "task-update",
    "--id",
    String(taskId || ""),
    "--run",
    verifyRun,
    "--status",
    "completed",
    "--result",
    payload,
    "--json",
  ]);
}

function cleanupVerify(repo, groups, sidecarHandle, run) {
  const listed = run ? workerList(run) : { ok: false, workers: [] };
  const open = new Set(
    (listed.ok ? listed.workers : [])
      .filter((w) => w.dispatchStatus === "dispatched")
      .map((w) => w.dispatchId)
  );
  for (const g of groups) {
    if (!g.dispatchId) continue;
    if (open.has(g.dispatchId)) {
      orca(["orchestration", "worker-stop", "--dispatch", g.dispatchId, "--json"]);
    }
    orca(["orchestration", "worker-release", "--dispatch", g.dispatchId, "--json"]);
    if (g.adopted && g.handle) orca(["terminal", "close", "--terminal", g.handle, "--json"]);
  }
  if (sidecarHandle) orca(["terminal", "close", "--terminal", sidecarHandle, "--json"]);
  try {
    fs.rmSync(path.join(repo, ".dely-verify"), { recursive: true, force: true });
  } catch (_) {
    /* optional */
  }
}

function phaseLine(phase, pin, g) {
  const status = (g && g.status) || "FAIL";
  const ack = g && g.ack != null ? g.ack : "-";
  const done = g && g.done != null ? g.done : "-";
  const extra = (g && g.reason) || "";
  return `PHASE ${phase} ${pin.harness} ${pin.model} ${pin.effort} ${status} ack=${ack} done=${done} ${extra}`.trimEnd();
}

function finishVerify(ctx) {
  cleanupVerify(ctx.repo, ctx.groups, ctx.sidecarHandle, ctx.verifyRun);
  const nowStatus = gitPorcelain(ctx.repo);
  const gitChanged = nowStatus !== ctx.baseline;
  const allPass = ["implement", "review"].every((phase) => {
    if (!ctx.pins[phase]) return true;
    const g = groupForPhase(ctx.groups, phase);
    return g && g.status === "PASS";
  });
  const pass = allPass && !gitChanged;
  if (ctx.verifyRun) writeVerdict(ctx.verifyRun, ctx.key, pass);
  for (const phase of ["implement", "review"]) {
    const pin = ctx.pins[phase];
    if (!pin) continue;
    process.stdout.write(phaseLine(phase, pin, groupForPhase(ctx.groups, phase)) + "\n");
  }
  process.stdout.write((gitChanged ? "git status CHANGED" : "git status unchanged") + "\n");
  restorePrev(ctx.prev);
  restoreOnExit = null;
  process.stdout.write((pass ? "RESULT PASS" : "RESULT FAIL") + "\n");
  process.exit(pass ? 0 : 1);
}

function prepareVerify(flags) {
  const repo = absRepo(flags.repo);
  const harnesses = loadHarnesses();
  const pins = loadPins(repo);
  const key = makeKey(repo, flags.control, harnesses, pins);
  const control = harnesses[flags.control];
  const wake = control ? control.wake : "unknown";
  const groups = pinGroups(pins, harnesses);
  if (wake === "unsupported") {
    for (const g of groups) {
      g.status = "BLOCKED";
      g.reason = `control ${flags.control} is unsupported`;
    }
  } else {
    for (const g of groups) {
      if (!g.entry) {
        g.status = "BLOCKED";
        g.reason = `unknown harness ${g.pin && g.pin.harness}`;
        continue;
      }
      const pf = preflightAgent(g.agent, repo);
      if (!pf.ok) {
        g.status = "BLOCKED";
        g.reason = pf.reason;
      }
    }
  }
  const prev = boundRunId();
  restoreOnExit = prev || null;
  const baseline = gitPorcelain(repo);
  const created = orca(["orchestration", "run-create", "--objective", objectiveFor(key), "--json"]);
  if (orcaFailed(created)) {
    return { error: orcaReason(created, "run-create failed"), prev, repo, key, pins, groups, baseline };
  }
  const verifyRun = (result(created).run && result(created).run.id) || result(created).id;
  return { repo, harnesses, pins, key, groups, prev, baseline, verifyRun, controlAgent: flags.control };
}

function dispatchVerifyGroups(ctx) {
  for (const g of ctx.groups) {
    if (g.status) continue;
    const phase = g.phases[0];
    const specFile = writeVerifyTask(ctx.repo, phase);
    g.t0 = Date.now();
    const out = launchDispatch({
      repo: ctx.repo,
      run: ctx.verifyRun,
      phase,
      specFile,
      title: `dely-verify-${phase}`,
      pin: g.pin,
      entry: g.entry,
    });
    g.adopted = Boolean(out.adopted);
    g.dispatchId = out.dispatchId || "";
    g.handle = out.handle || "";
    g.ack = out.ack != null ? Math.floor(out.ack) : null;
    if (out.code === 4) {
      g.status = "NO_ACK";
      g.reason = String(out.line || "").replace(/^NO_ACK \S+\s*/, "");
      continue;
    }
    if (out.code !== 0) {
      g.status = "FAIL";
      g.reason = out.line;
    }
  }
}

function writeVerifyState(ctx) {
  const dir = path.join(ctx.repo, ".dely-verify");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "state.json"),
    JSON.stringify({
      prev: ctx.prev,
      verifyRun: ctx.verifyRun,
      key: ctx.key,
      repo: ctx.repo,
      pins: ctx.pins,
      groups: ctx.groups,
      baseline: ctx.baseline,
      startTime: Date.now(),
      sidecarHandle: ctx.sidecarHandle,
      controlHandle: ctx.controlHandle,
      launcher: ctx.launcher,
    })
  );
}

function cmdVerifyRun(flags) {
  const ctx = prepareVerify(flags);
  if (ctx.error) finish(9, `ERROR ${ctx.error}`);
  dispatchVerifyGroups(ctx);
  if (ctx.groups.some((g) => g.dispatchId && !g.status)) {
    const waitRes = consumeVerify(ctx.verifyRun, ctx.groups, Date.now(), VERIFY_DEADLINE_S);
    if (waitRes.type === "error") finish(9, `ERROR ${waitRes.reason}`);
  }
  finishVerify(ctx);
}

function cmdVerifyStart(flags) {
  const ctx = prepareVerify(flags);
  if (ctx.error) finish(9, `ERROR ${ctx.error}`);
  if (ctx.groups.some((g) => g.status === "BLOCKED")) {
    finishVerify(ctx);
    return;
  }
  dispatchVerifyGroups(ctx);
  const anyOpen = ctx.groups.some((g) => g.dispatchId && !g.status);
  const failedLaunch = ctx.groups.some(
    (g) => g.status === "NO_ACK" || g.status === "FAIL" || g.status === "BLOCKED"
  );
  if (!anyOpen || failedLaunch) {
    finishVerify(ctx);
    return;
  }
  const launcher = launcherPath();
  ctx.launcher = launcher;
  ctx.controlHandle = coordinatorHandle(ctx.verifyRun);
  ctx.sidecarHandle = startVerifySidecar(ctx.repo, ctx.verifyRun, ctx.controlHandle, launcher);
  writeVerifyState(ctx);
  const peek = orca(["orchestration", "check", "--peek", "--run", ctx.verifyRun, "--json"]);
  const collectCmd = `${launcher} verify collect --repo ${ctx.repo}`;
  restoreOnExit = null;
  if (hasSettle(messagesOf(peek))) {
    process.stdout.write(`COLLECT_NOW ${collectCmd}\n`);
  } else {
    process.stdout.write(`SLEEP end your turn; when Orca wakes you, run: ${collectCmd}\n`);
  }
  process.exit(0);
}

function cmdVerifyCollect(flags) {
  const repo = absRepo(flags.repo);
  const stateFile = path.join(repo, ".dely-verify", "state.json");
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch (e) {
    finish(9, `ERROR missing verify state: ${e.message}`);
  }
  restoreOnExit = saved.prev || null;
  const collected = collectSettles(saved.verifyRun);
  if (!collected.ok) finish(9, `ERROR ${collected.reason}`);
  applySettled(saved.groups, collected.settles.map((s) => s.message));
  const startedAt = saved.startTime || Date.now();
  const elapsed = (Date.now() - startedAt) / 1000;
  const seen = new Set();
  for (const g of saved.groups) {
    if (g.ack == null) continue;
    if (g.dispatchId) seen.add(g.dispatchId);
    if (g.handle) seen.add(g.handle);
  }
  const silent = checkSilent(saved.verifyRun, seen);
  if (silent) {
    for (const g of saved.groups) {
      if (!g.status && g.dispatchId === silent.dispatchId) {
        g.status = "SILENT";
        g.reason = `no terminal output for ${silent.seconds}s`;
      }
    }
  }
  if (elapsed > VERIFY_DEADLINE_S) {
    for (const g of saved.groups) {
      if (!g.status && g.dispatchId) {
        g.status = "DEADLINE";
        g.reason = `not done after ${Math.floor(elapsed)}s`;
      }
    }
  }
  const limitHit = Boolean(silent) || elapsed > VERIFY_DEADLINE_S;
  const stillOpen = collected.open.length && saved.groups.some((g) => g.dispatchId && !g.status);
  if (stillOpen && !limitHit) {
    if (!sidecarAlive(saved.sidecarHandle)) {
      saved.sidecarHandle = startVerifySidecar(
        repo,
        saved.verifyRun,
        saved.controlHandle,
        saved.launcher || launcherPath()
      );
      fs.writeFileSync(stateFile, JSON.stringify(saved));
    }
    restoreOnExit = null;
    finish(
      2,
      `WAITING ${collected.open.join(" ")}; end your turn; when Orca wakes you, run the same collect command`
    );
  }
  finishVerify({
    repo,
    prev: saved.prev,
    verifyRun: saved.verifyRun,
    key: saved.key,
    groups: saved.groups,
    pins: saved.pins,
    sidecarHandle: saved.sidecarHandle,
    baseline: saved.baseline,
  });
}

function parseArgs(argv) {
  let cmd = argv[0];
  let i = 1;
  if (cmd === "verify") {
    cmd = argv[1] ? "verify:" + argv[1] : "verify";
    i = argv[1] ? 2 : 1;
  }
  const flags = {};
  for (; i < argv.length; i++) {
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
      if (!flags.run || !flags.repo) finish(2, "usage: dely collect --run <runId> --repo <path>");
      return cmdCollect(flags);
    case "verify:run":
      if (!flags.repo || !flags.control) finish(2, "usage: dely verify run --repo <path> --control <agent>");
      return withPrevRestore(() => cmdVerifyRun(flags));
    case "verify:start":
      if (!flags.repo || !flags.control) finish(2, "usage: dely verify start --repo <path> --control <agent>");
      return withPrevRestore(() => cmdVerifyStart(flags));
    case "verify:collect":
      if (!flags.repo) finish(2, "usage: dely verify collect --repo <path>");
      return withPrevRestore(() => cmdVerifyCollect(flags));
    default:
      finish(2, "usage: dely status|dispatch|wait|sidecar|collect|verify");
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { makeKey, buildSpec, launchKind, lookupVerdict };
