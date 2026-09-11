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
  return out;
}

function seedMessages(list, acked, startUid) {
  const out = [];
  let uid = startUid;
  for (const d of list || []) {
    const groupId = d.deliveryId || null;
    for (const m of d.messages || []) {
      out.push(
        Object.assign(clone(m), {
          acked: Boolean(acked),
          uid: uid++,
          groupId,
        })
      );
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
      projection: w.projection || { liveness: { verdict: scenario.liveness || "live" } },
    })),
  });
}

if (group === "orchestration" && cmd === "worker-stop") {
  state.stopped[flags.dispatch] = true;
  saveState(state);
  ok({ dispatchId: flags.dispatch, state: "stopped" });
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
    const messages = (state.arrived || []).map(publicMessage);
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
  const msg = {
    type: flags.type || "status",
    from_handle: flags.from || "",
    subject: flags.subject || "",
    body: flags.body || "",
    acked: false,
    uid: state.nextUid || 1,
    groupId: null,
  };
  if (flags["dispatch-id"]) msg.dispatchId = flags["dispatch-id"];
  state.nextUid = (state.nextUid || 1) + 1;
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
