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

function seedMessages(list, acked, startUid) {
  const out = [];
  let uid = startUid;
  for (const d of list || []) {
    const groupId = d.deliveryId || null;
    for (const m of d.messages || []) {
      const copy = Object.assign(clone(m), { acked: Boolean(acked), uid, groupId });
      if (copy.id == null || copy.id === "") copy.id = "msg_" + uid;
      uid++;
      out.push(copy);
    }
  }
  return { messages: out, nextUid: uid };
}

function initialMailbox() {
  const groups = scenario.deliveries || [];
  if (scenario.peekMessages) {
    const peek = seedMessages([{ deliveryId: null, messages: scenario.peekMessages }], false, 1);
    return {
      arrived: peek.messages,
      pending: groups,
      nextUid: peek.nextUid,
      nextDeliverySeq: 1,
      frozen: null,
    };
  }
  const first = groups[0] ? seedMessages([groups[0]], false, 1) : { messages: [], nextUid: 1 };
  return {
    arrived: first.messages,
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
        acked: [],
        workerStartCount: 0,
        readCount: {},
        waiter: null,
        stopped: [],
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
    if (a === "--json" || a === "--wait" || a === "--peek") {
      flags[a.slice(2)] = true;
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

function fail(message) {
  reply({ ok: false, error: { message } }, 1);
}

const { positional, flags } = parseArgv(process.argv.slice(2));
const group = positional[0];
const cmd = positional[1];
const state = loadState();

if (group === "orchestration" && cmd === "worker-start") {
  const queue = scenario.workerStarts || (scenario.workerStart ? [scenario.workerStart] : null);
  const ws = (queue && queue[state.workerStartCount || 0]) ||
    (queue && queue[queue.length - 1]) || { dispatchId: "ctx_ab12" };
  state.workerStartCount = (state.workerStartCount || 0) + 1;
  if (ws.error) {
    saveState(state);
    reply(
      { ok: false, error: { message: ws.error }, result: { failedStage: ws.failedStage || "start" } },
      1
    );
  }
  saveState(state);
  ok({ dispatchId: ws.dispatchId });
}

if (group === "orchestration" && cmd === "worker-stop") {
  state.stopped = (state.stopped || []).concat([flags.dispatch]);
  saveState(state);
  ok({ dispatchId: flags.dispatch });
}

if (group === "orchestration" && cmd === "worker-release") {
  state.released = (state.released || []).concat([flags.dispatch]);
  saveState(state);
  ok({ dispatchId: flags.dispatch });
}

if (group === "orchestration" && cmd === "worker-list") {
  saveState(state);
  ok({
    workers: (scenario.workers || []).map((w) => ({
      dispatchId: w.dispatchId,
      dispatchStatus: w.dispatchStatus,
      projection: {
        attention: (w.projection && w.projection.attention) || {},
        liveness: (w.projection && w.projection.liveness) || {},
        nextAction: (w.projection && w.projection.nextAction) || null,
        stage: (w.projection && w.projection.stage) || {},
      },
    })),
  });
}

if (group === "orchestration" && cmd === "worker-read") {
  const id = flags.dispatch || "";
  const released = (state.released || []).includes(id);
  const n = (state.readCount[id] || 0) + 1;
  state.readCount[id] = n;
  state.readAt = state.readAt || {};
  state.readAt[id] = (state.readAt[id] || []).concat([Date.now()]);
  const spec = (scenario.workerRead && scenario.workerRead[id]) || scenario.workerRead || {};
  if (spec.error) {
    saveState(state);
    if (spec.error && typeof spec.error === "object") {
      reply({ ok: false, error: spec.error }, 1);
    }
    fail(spec.error);
  }
  const term = spec.terminal || {};
  const isTerminal =
    spec.source === "terminal" || spec.terminalAdvance || (spec.terminal && spec.source !== "transcript");
  if (isTerminal) {
    const nextCursor = spec.terminalAdvance ? "t" + n : term.nextCursor || spec.nextCursor || "t0";
    const sequenced = Array.isArray(spec.tails) ? spec.tails : Array.isArray(term.tails) ? term.tails : null;
    const tail = sequenced
      ? sequenced[Math.min(n - 1, sequenced.length - 1)] || []
      : term.tail || spec.tail || [];
    saveState(state);
    const result = {
      source: "terminal",
      terminal: {
        handle: term.handle || spec.handle || "term_w",
        status: term.status || spec.status || "running",
        tail,
        truncated: Boolean(term.truncated || spec.truncated),
        nextCursor,
        returnedLineCount:
          term.returnedLineCount != null
            ? term.returnedLineCount
            : spec.returnedLineCount != null
              ? spec.returnedLineCount
              : tail.length || 2,
      },
    };
    if (released) result.archived = true;
    ok(result);
  }
  let transcript;
  if (spec.advance) {
    transcript = {
      messages: spec.messages || [],
      nextCursor: "c" + n,
      limited: false,
      returnedMessageCount: n === 1 || flags.cursor ? 2 : 0,
    };
  } else {
    transcript = {
      messages: spec.messages || [],
      nextCursor: spec.nextCursor || null,
      limited: Boolean(spec.limited),
      returnedMessageCount: spec.returnedMessageCount || 0,
    };
  }
  saveState(state);
  const result = { source: "transcript", transcript };
  if (released) result.archived = true;
  ok(result);
}

if (group === "orchestration" && cmd === "run-show") {
  saveState(state);
  ok({
    run: {
      coordinator_handle: scenario.coordinatorHandle || null,
    },
  });
}

function publicMessage(m) {
  const out = { id: m.id, type: m.type, from_handle: m.from_handle, subject: m.subject, body: m.body };
  if (m.payload != null) out.payload = typeof m.payload === "string" ? m.payload : JSON.stringify(m.payload);
  Object.keys(out).forEach((k) => {
    if (out[k] == null) delete out[k];
  });
  return out;
}

function unackedOf(st) {
  return (st.arrived || []).filter((m) => !m.acked);
}

function nextBatch(st) {
  const unread = unackedOf(st);
  if (!unread.length) return [];
  const gid = unread[0].groupId;
  if (gid == null) return [unread[0]];
  return unread.filter((m) => m.groupId === gid).slice(0, 50);
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
  if (scenario.checkError) {
    saveState(state);
    fail(scenario.checkError);
  }
  if (flags.ack) {
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
    const messages = unackedOf(state).map(publicMessage);
    saveState(state);
    ok({ deliveryId: null, messages, count: messages.length });
  }
  if (flags.wait) {
    const pid = String(process.pid);
    if (state.waiter && state.waiter !== pid) {
      saveState(state);
      fail("a waiter is already active on this Run");
    }
    state.waiter = pid;
    saveState(state);
  }
  let msgs;
  if (state.frozen) {
    msgs = frozenMessages(state);
  } else {
    const batch = nextBatch(state);
    if (!batch.length) {
      if (flags.wait) waitSleep();
      if (flags.wait) state.waiter = null;
      saveState(state);
      ok({ deliveryId: null, messages: [], count: 0, timedOut: Boolean(flags.wait) });
    }
    freezeBatch(state, batch);
    msgs = frozenMessages(state);
  }
  if (flags.wait) state.waiter = null;
  saveState(state);
  ok({ deliveryId: state.frozen.deliveryId, messages: msgs.map(publicMessage), count: msgs.length });
}

if (group === "terminal" && cmd === "create") {
  saveState(state);
  ok({ terminal: { handle: scenario.terminalHandle || "term_w" } });
}

if (group === "terminal" && cmd === "read") {
  const spec = scenario.terminalRead || {};
  saveState(state);
  ok({
    terminal: {
      handle: flags.terminal || scenario.terminalHandle || "term_w",
      tail: spec.tail || [],
    },
  });
}

if (group === "terminal" && cmd === "show") {
  const n = (state.showCount || 0) + 1;
  state.showCount = n;
  const spec = scenario.terminalShow || {};
  const busy = Number(spec.busyShows) || 0;
  const lastOutputAt = n <= busy ? Date.now() : spec.lastOutputAt != null ? spec.lastOutputAt : Date.now() - 60000;
  saveState(state);
  ok({
    terminal: {
      handle: flags.terminal || scenario.terminalHandle || "term_w",
      lastOutputAt,
    },
  });
}

if (group === "terminal" && cmd === "close") {
  state.closed = (state.closed || []).concat([flags.terminal]);
  saveState(state);
  ok({ terminal: { handle: flags.terminal } });
}

if (group === "terminal" && cmd === "list") {
  saveState(state);
  ok({ terminals: scenario.terminals || [] });
}

if (group === "terminal" && cmd === "send") {
  if (flags.enter && scenario.sendEnterBlocked) {
    const n = (state.sendEnterFails || 0) + 1;
    const until = scenario.sendEnterBlockedUntil;
    if (until == null || n <= until) {
      state.sendEnterFails = n;
      saveState(state);
      fail("agent_prompt_blocked");
    }
  }
  saveState(state);
  ok({ terminal: { handle: flags.terminal, sent: true } });
}

saveState(state);
fail("unhandled " + positional.join(" "));
