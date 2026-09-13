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

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function publicMessage(m) {
  const out = {};
  Object.keys(m).forEach((k) => {
    if (k === "acked" || k === "uid" || k === "groupId") return;
    out[k] = m[k];
  });
  if (out.deliveryId == null && m.groupId) out.deliveryId = m.groupId;
  const folded = {};
  if (typeof out.payload === "string" && out.payload) {
    try {
      const parsed = JSON.parse(out.payload);
      if (parsed && typeof parsed === "object") Object.assign(folded, parsed);
    } catch (_) {
      /* keep folded empty; payload still rewritten below if keys exist */
    }
  } else if (out.payload && typeof out.payload === "object") {
    Object.assign(folded, out.payload);
  }
  if (out.dispatchId) folded.dispatchId = folded.dispatchId || out.dispatchId;
  if (out.dispatch_id) folded.dispatchId = folded.dispatchId || out.dispatch_id;
  if (out.outcome) folded.outcome = folded.outcome || out.outcome;
  if (out.taskId) folded.taskId = folded.taskId || out.taskId;
  delete out.dispatchId;
  delete out.dispatch_id;
  delete out.outcome;
  delete out.taskId;
  if (Object.keys(folded).length) out.payload = JSON.stringify(folded);
  else delete out.payload;
  return out;
}

function seedMessages(list, acked, startUid) {
  const out = [];
  let uid = startUid;
  for (const d of list || []) {
    const groupId = d.deliveryId || null;
    for (const m of d.messages || []) {
      const copy = Object.assign(clone(m), {
        acked: Boolean(acked),
        uid: uid,
        groupId,
      });
      if (m.id === false || m.id === null) {
        delete copy.id;
      } else if (copy.id == null || copy.id === "") {
        copy.id = "msg_" + uid;
      }
      uid++;
      out.push(copy);
    }
  }
  return { messages: out, nextUid: uid };
}

function initialMailbox() {
  const seeded = seedMessages(scenario.history || scenario.ackedDeliveries || [], true, 1);
  const groups = scenario.deliveries || [];
  const first = groups[0] ? seedMessages([groups[0]], false, seeded.nextUid) : { messages: [], nextUid: seeded.nextUid };
  return {
    arrived: seeded.messages.concat(first.messages),
    pending: groups.slice(1),
    nextUid: first.nextUid,
    nextDeliverySeq: 1,
    frozen: null,
  };
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch (_) {
    const mailbox = initialMailbox();
    return Object.assign(
      {
        terminalCreatedAt: null,
        stopped: {},
        acked: [],
        boundRun: scenario.currentRun || null,
        createdRuns: [],
        dynamicWorkers: [],
        workerStartCount: 0,
        tasks: [],
        released: [],
      },
      mailbox
    );
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

function utcStamp(ms) {
  const d = new Date(ms == null ? Date.now() : ms);
  const p = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    "-" +
    p(d.getUTCMonth() + 1) +
    "-" +
    p(d.getUTCDate()) +
    " " +
    p(d.getUTCHours()) +
    ":" +
    p(d.getUTCMinutes()) +
    ":" +
    p(d.getUTCSeconds())
  );
}

function dispatchedAtOf(w, state) {
  if (w && w.dispatchedAt) return w.dispatchedAt;
  if (scenario.dispatchedAt) return scenario.dispatchedAt;
  const id = (w && w.dispatchId) || "";
  state.dispatchedAt = state.dispatchedAt || {};
  if (!state.dispatchedAt[id]) state.dispatchedAt[id] = utcStamp();
  return state.dispatchedAt[id];
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

function isAdopted(w) {
  return Boolean(w && (w.ownershipState === "external" || w.retainedReason === "external_terminal"));
}

function workers(state) {
  const base = (scenario.workers || []).map((w) => Object.assign({}, w));
  const extra = (state.dynamicWorkers || []).filter(
    (w) => !base.some((b) => b.dispatchId === w.dispatchId)
  );
  return base.concat(extra).map((w) => {
    const copy = Object.assign({}, w);
    const stopKind = state.stopped[w.dispatchId];
    if (stopKind === "adopt") {
      copy.workerState = "stop_unknown";
      copy.terminalState = "retained";
      copy.projection = Object.assign({}, copy.projection, {
        liveness: { verdict: "exited" },
      });
    } else if (stopKind) {
      copy.dispatchStatus = "failed";
      copy.workerState = "stopped";
      copy.stage = { detail: "process_stopped" };
      copy.terminalState = "retained";
      copy.projection = Object.assign({}, copy.projection, {
        liveness: { verdict: "exited" },
      });
    }
    if ((state.released || []).indexOf(w.dispatchId) >= 0) {
      copy.terminalState = "released";
    } else if (!copy.terminalState && copy.dispatchStatus === "failed") {
      copy.terminalState = "reclaimable";
    }
    return copy;
  });
}

const { positional, flags } = parseArgv(process.argv.slice(2));
const group = positional[0];
const cmd = positional[1];
const state = loadState();

if (group === "orchestration" && cmd === "run-list") {
  if (positional.length > 2) {
    saveState(state);
    reply(
      { ok: false, error: { message: `Unknown command: orchestration run-list ${positional.slice(2).join(" ")}` } },
      1
    );
  }
  if (scenario.runListFailCursor != null && String(flags.cursor || "") === String(scenario.runListFailCursor)) {
    saveState(state);
    reply({ ok: false, error: { message: scenario.runListFailReason || "run-list failed" } }, 1);
  }
  const all = (scenario.runs || []).concat(state.createdRuns || []);
  const limit = Number(flags.limit || 100);
  const offset = flags.cursor ? Number(flags.cursor) || 0 : 0;
  const slice = all.slice(offset, offset + limit);
  const nextCursor = offset + limit < all.length ? String(offset + limit) : null;
  saveState(state);
  ok({ runs: slice, nextCursor });
}

if (group === "orchestration" && cmd === "task-list") {
  const run =
    (scenario.runs || []).find((r) => r.id === flags.run) ||
    (state.createdRuns || []).find((r) => r.id === flags.run) ||
    {};
  const tasks = (run.tasks || []).concat(
    (state.tasks || []).filter((t) => !flags.run || t.runId === flags.run || !t.runId)
  );
  saveState(state);
  ok({ runId: flags.run, tasks, count: tasks.length });
}

if (group === "orchestration" && cmd === "run-current") {
  saveState(state);
  ok({ run: state.boundRun ? { id: state.boundRun } : null });
}

if (group === "orchestration" && cmd === "run-create") {
  if (scenario.runCreateNoId) {
    saveState(state);
    ok({ run: {} });
  }
  const id = scenario.createdRunId || "run_verify";
  state.boundRun = id;
  const run = {
    id,
    objective: flags.objective || "",
    created_at: "2026-09-11T10:00:00Z",
    coordinator_handle: scenario.coordinatorHandle || "term_ctrl",
    tasks: [],
  };
  state.createdRuns = (state.createdRuns || []).concat([run]);
  saveState(state);
  ok({ run: { id, objective: run.objective, coordinator_handle: run.coordinator_handle }, id });
}

if (group === "orchestration" && cmd === "run-use") {
  state.boundRun = flags.id || null;
  saveState(state);
  ok({ run: state.boundRun ? { id: state.boundRun } : null });
}

if (group === "orchestration" && cmd === "task-create") {
  const id = "task_verdict";
  const task = {
    id,
    taskId: id,
    task_title: flags["task-title"] || "",
    spec: flags.spec || "",
    runId: flags.run || "",
    status: "pending",
    result: null,
  };
  state.tasks = (state.tasks || []).concat([task]);
  saveState(state);
  ok({ task: { id }, taskId: id, id });
}

if (group === "orchestration" && cmd === "task-update") {
  const task = (state.tasks || []).find((t) => t.id === flags.id) || {
    id: flags.id,
  };
  task.status = flags.status || task.status;
  task.result = flags.result != null ? flags.result : task.result;
  task.runId = flags.run || task.runId;
  state.tasks = (state.tasks || []).filter((t) => t.id !== flags.id).concat([task]);
  saveState(state);
  ok({ task });
}

if (group === "orchestration" && cmd === "worker-release") {
  const current = workers(state).find((row) => row.dispatchId === flags.dispatch) || {};
  const refuseIds = scenario.releaseRefuseIds || [];
  if (isAdopted(current) || refuseIds.indexOf(flags.dispatch) >= 0) {
    saveState(state);
    reply({ ok: false, error: { message: "worker-release refused" } }, 1);
  }
  if (current.releaseReceipt === "retained" || scenario.releaseState === "retained") {
    saveState(state);
    ok({ dispatchId: flags.dispatch, state: "retained", processAction: "none" });
  }
  state.released = (state.released || []).concat([flags.dispatch]);
  saveState(state);
  ok({ dispatchId: flags.dispatch, state: "released", processAction: "none" });
}

if (group === "orchestration" && cmd === "worker-start") {
  const queue = scenario.workerStarts || (scenario.workerStart ? [scenario.workerStart] : null);
  const ws = (queue && queue[state.workerStartCount || 0]) ||
    (queue && queue[queue.length - 1]) || {
      dispatchId: "disp_1",
      state: "ready",
      handle: "term_w",
    };
  state.workerStartCount = (state.workerStartCount || 0) + 1;
  const handle = ws.handle || flags.terminal || "term_w";
  if (ws.state !== "ready") {
    saveState(state);
    reply(
      {
        ok: false,
        result: {
          dispatchId: ws.dispatchId || "",
          state: ws.state,
          worker: { agentTerminalHandle: handle },
        },
        error: { message: ws.reason || ws.state },
      },
      1
    );
  }
  const adopted = Boolean(flags.terminal);
  state.dynamicWorkers = (state.dynamicWorkers || []).concat([
    {
      dispatchId: ws.dispatchId,
      dispatchStatus: "dispatched",
      agentTerminalHandle: handle,
      lastHeartbeatAt: null,
      terminalState: adopted ? "retained" : undefined,
      retainedReason: adopted ? "external_terminal" : undefined,
      ownershipState: adopted ? "external" : undefined,
    },
  ]);
  saveState(state);
  ok({
    dispatchId: ws.dispatchId,
    state: "ready",
    worker: { agentTerminalHandle: handle },
  });
}

if (group === "orchestration" && cmd === "worker-show") {
  const id = flags.dispatch;
  const w = workers(state).find((row) => row.dispatchId === id) || {};
  const ws = scenario.workerStart || {};
  const dispatchedAt = dispatchedAtOf(w, state);
  const lastError = w.lastError || null;
  saveState(state);
  ok({
    dispatch: {
      id,
      lastFailure: w.lastFailure || ws.lastFailure || null,
      lastHeartbeatAt: w.lastHeartbeatAt || null,
      dispatchedAt,
      status: w.dispatchStatus || "dispatched",
      lastError,
    },
    worker: {
      state: w.workerState || w.state || "ready",
      stage: w.stage || "",
      lastError,
      agentTerminalHandle: w.agentTerminalHandle || ws.handle || "",
    },
    projection: w.projection || { liveness: { verdict: scenario.liveness || "live" } },
  });
}

if (group === "orchestration" && cmd === "worker-list") {
  if (scenario.workerListError) {
    saveState(state);
    reply({ ok: false, error: { message: scenario.workerListError } }, 1);
  }
  if (scenario.workerListMalformed) {
    saveState(state);
    process.stdout.write(String(scenario.workerListMalformed) + "\n");
    process.exit(0);
  }
  saveState(state);
  ok({
    workers: workers(state).map((w) => ({
      dispatchId: w.dispatchId,
      dispatchStatus: w.dispatchStatus,
      agentTerminalHandle: w.agentTerminalHandle,
      lastHeartbeatAt: w.lastHeartbeatAt || null,
      terminalState: w.terminalState,
      retainedReason: w.retainedReason,
      ownershipState: w.ownershipState,
      workerState: w.workerState,
      stage: w.stage,
      projection: w.projection || { liveness: { verdict: scenario.liveness || "live" } },
    })),
  });
}

if (group === "orchestration" && cmd === "worker-stop") {
  const current = workers(state).find((row) => row.dispatchId === flags.dispatch) || {};
  const adopted = isAdopted(current);
  state.stopped[flags.dispatch] = adopted ? "adopt" : "agent";
  saveState(state);
  ok({ dispatchId: flags.dispatch, state: adopted ? "stop_unknown" : "stopped" });
}

function peekMessages(st) {
  const frozenUids = {};
  if (st.frozen) {
    for (const uid of st.frozen.uids || []) frozenUids[uid] = true;
  }
  return (st.arrived || []).filter((m) => !m.acked && !frozenUids[m.uid]);
}

function unackedOf(st) {
  return (st.arrived || []).filter((m) => !m.acked);
}

function typesMatch(messages, types) {
  if (!types) return true;
  const wanted = String(types)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (!wanted.length) return true;
  return (messages || []).some((m) => m && wanted.indexOf(m.type) >= 0);
}

function nextBatch(st) {
  const unread = unackedOf(st);
  if (!unread.length) return [];
  return unread.slice(0, 50);
}

function freezeBatch(st, batch) {
  const id = batch[0].groupId || "dv_" + st.nextDeliverySeq;
  st.nextDeliverySeq += 1;
  st.frozen = { deliveryId: id, uids: batch.map((m) => m.uid) };
  return st.frozen;
}

function frozenMessages(st) {
  if (!st.frozen) return [];
  const byUid = {};
  for (const m of st.arrived || []) byUid[m.uid] = m;
  return (st.frozen.uids || []).map((uid) => byUid[uid]).filter(Boolean);
}

function releasePending(st) {
  if (!(st.pending || []).length) return;
  const next = st.pending.shift();
  const seeded = seedMessages([next], false, st.nextUid || 1);
  st.nextUid = seeded.nextUid;
  st.arrived = (st.arrived || []).concat(seeded.messages);
}

function waitSleep() {
  const ms = Number(flags["timeout-ms"] || 20);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, Math.min(ms, 50)));
}

if (group === "orchestration" && cmd === "check") {
  if (flags.ack) {
    if (scenario.rejectAck) {
      saveState(state);
      reply({ ok: false, error: { message: scenario.rejectAckReason || "ack rejected" } }, 1);
    }
    if (state.frozen && state.frozen.deliveryId === flags.ack) {
      const uids = {};
      for (const uid of state.frozen.uids || []) uids[uid] = true;
      for (const m of state.arrived || []) {
        if (uids[m.uid]) m.acked = true;
      }
      state.acked.push(flags.ack);
      state.frozen = null;
      releasePending(state);
    } else if ((state.acked || []).indexOf(flags.ack) < 0) {
      state.acked.push(flags.ack);
    }
    saveState(state);
    ok({ deliveryId: null, messages: [], acknowledged: flags.ack });
  }
  if (flags.peek) {
    const messages = peekMessages(state).map(publicMessage);
    saveState(state);
    ok({ deliveryId: null, messages, count: messages.length });
  }
  if (flags.all) {
    const raw = (state.arrived || []).filter((m) => !scenario.checkAllAckedOnly || m.acked);
    const messages = raw.map(publicMessage);
    saveState(state);
    ok({ deliveryId: null, messages, count: messages.length });
  }
  if (scenario.checkFailConsume) {
    saveState(state);
    reply({ ok: false, error: { message: scenario.checkFailConsume } }, 1);
  }
  let msgs;
  if (state.frozen) {
    msgs = frozenMessages(state);
  } else {
    const batch = nextBatch(state);
    if (!batch.length) {
      msgs = [];
    } else if (flags.wait && !typesMatch(unackedOf(state), flags.types)) {
      waitSleep();
      saveState(state);
      ok({ deliveryId: null, messages: [], count: 0, timedOut: true });
    } else {
      freezeBatch(state, batch);
      msgs = frozenMessages(state);
    }
  }
  if (state.frozen) {
    if (flags.wait && !typesMatch(unackedOf(state), flags.types)) {
      waitSleep();
      saveState(state);
      ok({ deliveryId: null, messages: [], count: 0, timedOut: true });
    }
    saveState(state);
    ok({ deliveryId: state.frozen.deliveryId, messages: msgs.map(publicMessage), count: msgs.length });
  }
  if (flags.wait) waitSleep();
  saveState(state);
  ok({ deliveryId: null, messages: [], count: 0, timedOut: Boolean(flags.wait) });
}

if (group === "orchestration" && cmd === "send") {
  const uid = state.nextUid || 1;
  const msg = {
    id: "msg_" + uid,
    type: flags.type || "status",
    from_handle: flags.from || "",
    subject: flags.subject || "",
    body: flags.body || "",
    acked: false,
    uid,
    groupId: null,
  };
  const payload = {};
  if (flags["dispatch-id"]) payload.dispatchId = flags["dispatch-id"];
  if (flags.outcome) payload.outcome = flags.outcome;
  if (flags["task-id"]) payload.taskId = flags["task-id"];
  if (Object.keys(payload).length) msg.payload = JSON.stringify(payload);
  state.nextUid = uid + 1;
  state.arrived = (state.arrived || []).concat([msg]);
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
  if (scenario.terminalShow === "fail") {
    saveState(state);
    reply({ ok: false, error: { message: scenario.terminalShowReason || "terminal show failed" } }, 1);
  }
  if (scenario.terminalShow === "malformed") {
    saveState(state);
    process.stdout.write("{not-json\n");
    process.exit(0);
  }
  saveState(state);
  ok({ terminal: { handle: flags.terminal, lastOutputAt: lastOutputAt(state), running: true } });
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
