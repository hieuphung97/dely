#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const logPath = process.env.FAKE_ORCA_LOG;
if (logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, JSON.stringify(process.argv.slice(2)) + "\n");
}

const scenarioPath = process.env.FAKE_ORCA_SCENARIO;
if (!scenarioPath) {
  process.stdout.write(JSON.stringify({ ok: false, error: { message: "FAKE_ORCA_SCENARIO unset" } }) + "\n");
  process.exit(1);
}
const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
const statePath = process.env.FAKE_ORCA_STATE || scenarioPath + ".state.json";

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (_) {
    return {
      deliveryIndex: 0,
      controlIndex: 0,
      collectIndex: 0,
      terminalCreatedAt: null,
      stopped: {},
      acked: [],
    };
  }
}

function saveState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state));
}

function parseArgv(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") {
      flags.json = true;
      continue;
    }
    if (a === "--wait") {
      flags.wait = true;
      continue;
    }
    if (a === "--peek") {
      flags.peek = true;
      continue;
    }
    if (a.startsWith("--")) {
      const name = a.slice(2);
      const next = argv[i + 1];
      if (next != null && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
      continue;
    }
    positional.push(a);
  }
  return { positional, flags };
}

function reply(obj, code) {
  process.stdout.write(JSON.stringify(obj) + "\n");
  process.exit(code == null ? 0 : code);
}

function ok(result) {
  reply({ ok: true, result: result || {} }, 0);
}

function nowMs() {
  return Date.now();
}

function lastOutputAt(state) {
  const busy = scenario.changeLastOutputForMs || 0;
  if (busy) {
    const created = state.terminalCreatedAt || nowMs();
    if (nowMs() - created < busy) return nowMs();
    return created + busy;
  }
  const spec = scenario.lastOutputAt || "now";
  if (spec === "stale") return nowMs() - (scenario.staleMs || 200000);
  if (typeof spec === "number") return spec;
  return nowMs();
}

function workers(state) {
  return (scenario.workers || []).map((w) => {
    const copy = Object.assign({}, w);
    if (state.stopped[w.dispatchId]) copy.dispatchStatus = "stopped";
    return copy;
  });
}

const { positional, flags } = parseArgv(process.argv.slice(2));
const group = positional[0];
const cmd = positional[1];
const state = loadState();

if (group === "orchestration" && cmd === "run-list") {
  const all = scenario.runs || [];
  const limit = Number(flags.limit || 100);
  const offset = flags.cursor ? Number(flags.cursor) || 0 : 0;
  const slice = all.slice(offset, offset + limit);
  const nextCursor = offset + limit < all.length ? String(offset + limit) : null;
  saveState(state);
  ok({ runs: slice, nextCursor });
}

if (group === "orchestration" && cmd === "task-list") {
  const run = (scenario.runs || []).find((r) => r.id === flags.run) || {};
  saveState(state);
  ok({ runId: flags.run, tasks: run.tasks || [], count: (run.tasks || []).length });
}

if (group === "orchestration" && cmd === "worker-start") {
  const ws = scenario.workerStart || {
    dispatchId: "disp_1",
    state: "ready",
    handle: "term_w",
  };
  if (ws.state !== "ready") {
    saveState(state);
    reply(
      {
        ok: false,
        result: {
          dispatchId: ws.dispatchId || "",
          state: ws.state,
          worker: { agentTerminalHandle: ws.handle || "" },
        },
        error: { message: ws.reason || ws.state },
      },
      1
    );
  }
  saveState(state);
  ok({
    dispatchId: ws.dispatchId,
    state: "ready",
    worker: { agentTerminalHandle: ws.handle || flags.terminal || "term_w" },
  });
}

if (group === "orchestration" && cmd === "worker-show") {
  const id = flags.dispatch;
  const w = workers(state).find((row) => row.dispatchId === id) || {};
  const ws = scenario.workerStart || {};
  saveState(state);
  ok({
    dispatch: {
      id,
      lastFailure: w.lastFailure || ws.lastFailure || null,
      lastHeartbeatAt: w.lastHeartbeatAt || null,
      status: w.dispatchStatus || "dispatched",
    },
    worker: {
      state: w.workerState || "ready",
      agentTerminalHandle: w.agentTerminalHandle || ws.handle || "",
    },
    projection: w.projection || { liveness: { verdict: scenario.liveness || "live" } },
  });
}

if (group === "orchestration" && cmd === "worker-list") {
  saveState(state);
  ok({
    workers: workers(state).map((w) => ({
      dispatchId: w.dispatchId,
      dispatchStatus: w.dispatchStatus,
      agentTerminalHandle: w.agentTerminalHandle,
      lastHeartbeatAt: w.lastHeartbeatAt || null,
      projection: w.projection || { liveness: { verdict: scenario.liveness || "live" } },
    })),
  });
}

if (group === "orchestration" && cmd === "worker-stop") {
  state.stopped[flags.dispatch] = true;
  saveState(state);
  ok({ dispatchId: flags.dispatch, state: "stopped" });
}

if (group === "orchestration" && cmd === "check") {
  const types = String(flags.types || "");
  const heartbeatOnly = types === "heartbeat";
  const controlHandle = flags.terminal;
  let list;
  let indexKey;
  if (heartbeatOnly && controlHandle) {
    list = scenario.controlDeliveries || [];
    indexKey = "controlIndex";
  } else if (flags.wait) {
    list = scenario.deliveries || [];
    indexKey = "deliveryIndex";
  } else {
    list = scenario.collectDeliveries || scenario.deliveries || [];
    indexKey = "collectIndex";
  }
  if (flags.ack) {
    state.acked.push(flags.ack);
    saveState(state);
    ok({ deliveryId: null, messages: [], acknowledged: flags.ack });
  }
  const idx = state[indexKey] || 0;
  if (idx < list.length) {
    const d = list[idx];
    state[indexKey] = idx + 1;
    saveState(state);
    ok({ deliveryId: d.deliveryId, messages: d.messages || [], count: (d.messages || []).length });
  }
  if (flags.wait) {
    const ms = Number(flags["timeout-ms"] || 20);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, Math.min(ms, 50)));
  }
  saveState(state);
  ok({ deliveryId: null, messages: [], count: 0, timedOut: Boolean(flags.wait) });
}

if (group === "orchestration" && cmd === "send") {
  saveState(state);
  ok({ ok: true, subject: flags.subject || "" });
}

if (group === "terminal" && cmd === "create") {
  state.terminalCreatedAt = nowMs();
  const handle = scenario.terminalHandle || "term_w";
  saveState(state);
  ok({ terminal: { handle } });
}

if (group === "terminal" && cmd === "show") {
  saveState(state);
  ok({ terminal: { handle: flags.terminal, lastOutputAt: lastOutputAt(state) } });
}

if (group === "terminal" && cmd === "wait") {
  saveState(state);
  ok({ wait: { satisfied: true, for: flags.for || "tui-idle" } });
}

if (group === "terminal" && cmd === "close") {
  saveState(state);
  ok({ terminal: { handle: flags.terminal, closed: true } });
}

if (group === "terminal" && cmd === "read") {
  saveState(state);
  const tail = scenario.screenTail || [];
  ok({ terminal: { handle: flags.terminal, tail: Array.isArray(tail) ? tail : [String(tail)] } });
}

saveState(state);
reply({ ok: false, error: { message: `unhandled ${positional.join(" ")}` } }, 1);
