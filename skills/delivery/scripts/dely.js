#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ACK_S = Number(process.env.DELY_ACK_S || 60);
const POLL_S = Number(process.env.DELY_POLL_S || 15);
const PROGRESS_S = Number(process.env.DELY_PROGRESS_S || 60);
const seconds = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
const PREFLIGHT_S = seconds(process.env.DELY_PREFLIGHT_S, 150);
const QUIET_S = seconds(process.env.DELY_QUIET_S, 3);
const QUIET_MIN_S = seconds(process.env.DELY_QUIET_MIN_S, 5);
const QUIET_CAP_S = seconds(process.env.DELY_QUIET_CAP_S, 90);
const NOTIFY_RETRY_S = seconds(process.env.DELY_NOTIFY_RETRY_S, 30);
const NOTIFY_GIVEUP_S = seconds(process.env.DELY_NOTIFY_GIVEUP_S, 1800);

const GATES = [
  "Do you trust the contents",
  "Confirm folder trust",
  "Workspace Trust Required",
  "Security guide",
  "No, exit",
  "Select login method",
  "posing security risks",
  "Session ended",
  "hit your free usage limit",
];

function orca(args) {
  const bin = process.env.ORCA_CLI_COMMAND || "orca";
  const argv = /\.m?js$/i.test(bin) ? [bin, ...args, "--json"] : [...args, "--json"];
  const cmd = /\.m?js$/i.test(bin) ? process.execPath : bin;
  try {
    const out = execFileSync(cmd, argv, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 << 20,
      env: process.env,
    });
    return JSON.parse(out || "{}");
  } catch (e) {
    try {
      return JSON.parse(String(e.stdout || "{}"));
    } catch (_) {
      return { ok: false, error: { message: String((e.stderr || e.message || "").trim() || e) } };
    }
  }
}

function flags(argv) {
  const f = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const n = argv[i + 1];
      if (n != null && !String(n).startsWith("--")) {
        f[argv[i].slice(2)] = n;
        i++;
      } else {
        f[argv[i].slice(2)] = true;
      }
    }
  }
  return f;
}

const AGENTS = {
  "Claude Code": "claude",
  "Codex CLI": "codex",
  "Cursor Agent CLI": "cursor",
  "GitHub Copilot CLI": "copilot",
  "Antigravity CLI": "antigravity",
  "Grok Build": "grok",
  "Kiro CLI": "kiro",
};

function pin(repo, phase) {
  const md = fs.readFileSync(path.join(repo, "AGENTS.md"), "utf8");
  const row = md.split("\n").find((l) => new RegExp("^\\|\\s*`?" + phase + "`?\\s*\\|").test(l));
  if (!row) throw new Error("no " + phase + " pin in AGENTS.md");
  const [, harness, model, effort] = row.split("|").slice(1).map((c) => c.trim().replace(/`/g, ""));
  if (!AGENTS[harness]) throw new Error("unknown harness " + harness);
  return { phase, agent: AGENTS[harness], model, effort };
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const out = (line, code) => {
  console.log(typeof line === "string" ? line : JSON.stringify(line));
  if (code != null) process.exit(code);
};

function pinWhy(p) {
  const can = ["claude", "codex", "cursor"].includes(p.agent);
  if (!can && p.model !== "default") {
    return (
      "pin " +
      p.phase +
      " " +
      p.agent +
      ": Orca cannot pin this model; write default and set the model in Orca's agent default arguments"
    );
  }
  if (p.effort !== "default" && p.model === "default") {
    return "pin " + p.phase + " " + p.agent + ": --effort requires --model";
  }
  return null;
}

function harnessCell(agent, col) {
  const md = fs.readFileSync(path.join(__dirname, "../references/harnesses.md"), "utf8");
  for (const line of md.split("\n")) {
    const c = line.split("|").map((x) => x.trim().replace(/`/g, ""));
    if (c[2] === agent) return c[col] || "";
  }
  return "";
}

function launchKind(agent) {
  return agent === "antigravity" ? "adopt" : "worker-start";
}

function adoptedPermission(agent) {
  try {
    const data = JSON.parse(
      fs.readFileSync(
        path.join(os.homedir(), "Library", "Application Support", "orca", "profiles", "local-default", "orca-data.json"),
        "utf8"
      )
    );
    const v = data && data.settings && data.settings.agentDefaultArgs && data.settings.agentDefaultArgs[agent];
    if (v != null && v !== "") return Array.isArray(v) ? v.join(" ") : String(v);
  } catch (_) {
    /* table fallback */
  }
  return harnessCell(agent, 3);
}

function adoptCommand(agent, perm) {
  return [agent === "antigravity" ? "agy" : agent, perm].filter(Boolean).join(" ");
}

function lastOutputAt(handle) {
  const r = orca(["terminal", "show", "--terminal", handle]);
  const raw = r.result && r.result.terminal && r.result.terminal.lastOutputAt;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function terminalTail(handle) {
  if (!handle) return [];
  const r = orca(["terminal", "read", "--terminal", handle]);
  const tail = r.result && r.result.terminal && r.result.terminal.tail;
  return Array.isArray(tail) ? tail.filter((l) => String(l || "").trim()) : [];
}

function waitQuiet(handle, launchedAt) {
  const cap = launchedAt + QUIET_CAP_S * 1000;
  for (;;) {
    const now = Date.now();
    if (now >= cap) return false;
    const lo = lastOutputAt(handle);
    if (lo != null && (now - launchedAt) / 1000 >= QUIET_MIN_S && (now - lo) / 1000 >= QUIET_S) return true;
    sleep(500);
  }
}

function adoptPath(run) {
  return path.join(os.tmpdir(), "dely-adopt-" + run + ".json");
}

function readAdopts(run) {
  try {
    const j = JSON.parse(fs.readFileSync(adoptPath(run), "utf8"));
    return Array.isArray(j) ? j : [];
  } catch (_) {
    return [];
  }
}

function writeAdopts(run, rows) {
  const p = adoptPath(run);
  if (!rows.length) {
    try {
      fs.unlinkSync(p);
    } catch (_) {
      /* gone */
    }
    return;
  }
  fs.writeFileSync(p, JSON.stringify(rows));
}

function recordAdopt(run, dispatchId, handle) {
  if (!run || !dispatchId || !handle) return;
  const rows = readAdopts(run).filter((r) => r.dispatchId !== dispatchId);
  rows.push({ dispatchId, handle });
  writeAdopts(run, rows);
}

function takeAdopt(run, dispatchId) {
  const rows = readAdopts(run);
  const hit = rows.find((r) => r.dispatchId === dispatchId);
  writeAdopts(
    run,
    rows.filter((r) => r.dispatchId !== dispatchId)
  );
  return (hit && hit.handle) || "";
}

function closeAdopted(run, dispatchId) {
  closeCreated(takeAdopt(run, dispatchId));
}

function idOf(m) {
  const raw = m && m.payload;
  if (raw == null) return "";
  try {
    const p = typeof raw === "string" ? JSON.parse(raw) : raw;
    return (p && p.dispatchId) || "";
  } catch (_) {
    return "";
  }
}

function closeCreated(handle) {
  if (handle) orca(["terminal", "close", "--terminal", handle]);
}

function start(repo, run, p, spec, title) {
  const args = [
    "orchestration",
    "worker-start",
    "--spec",
    spec,
    "--worktree",
    "path:" + repo,
    "--run",
    run,
    "--task-title",
    title,
  ];
  let createdHandle = "";
  if (launchKind(p.agent) === "adopt") {
    const created = orca([
      "terminal",
      "create",
      "--worktree",
      "path:" + repo,
      "--command",
      adoptCommand(p.agent, adoptedPermission(p.agent)),
    ]);
    createdHandle = created.result && created.result.terminal && created.result.terminal.handle;
    if (!createdHandle) return { error: (created.error && created.error.message) || "terminal create" };
    if (!waitQuiet(createdHandle, Date.now())) {
      closeCreated(createdHandle);
      return { error: "readiness timeout" };
    }
    const launched = terminalTail(createdHandle);
    if (hasGate(launched.join("\n"))) {
      closeCreated(createdHandle);
      return { error: "gate on screen: " + quote(launched.join("\n")) };
    }
    args.push("--terminal", createdHandle);
  } else {
    args.push("--agent", p.agent);
    if (["claude", "codex", "cursor"].includes(p.agent)) {
      if (p.model !== "default") args.push("--model", p.model);
      if (p.effort !== "default") args.push("--effort", p.effort);
    }
  }
  const r = orca(args);
  const id = r.result && r.result.dispatchId;
  if (!id) {
    closeCreated(createdHandle);
    return { error: (r.error && r.error.message) || String((r.result && r.result.failedStage) || "worker-start") };
  }
  if (createdHandle) recordAdopt(run, id, createdHandle);
  return { id, createdHandle };
}

function namesDispatch(m, id) {
  return JSON.stringify(m).includes(id);
}

function clip(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-400);
}

function hasGate(s) {
  return GATES.some((g) => String(s || "").includes(g));
}

function quote(s) {
  const text = String(s || "");
  const lines = text.split(/\n/).filter((l) => String(l || "").trim());
  const hits = lines.filter((l) => hasGate(l));
  return clip(hits.length ? hits.join("\n") : text);
}

function messageText(m) {
  if (m == null) return "";
  if (typeof m === "string") return m;
  const blocks = Array.isArray(m.blocks) ? m.blocks : [];
  let last = "";
  let toolOut = "";
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    if (b.type === "text" && typeof b.text === "string" && b.text.trim()) last = b.text;
    else if (!toolOut && b.type === "tool-result" && typeof b.output === "string" && b.output.trim()) {
      toolOut = b.output;
    }
  }
  return last || toolOut;
}

function screenLines(id) {
  const r = orca(["orchestration", "worker-read", "--dispatch", id, "--source", "auto", "--limit", "200"]);
  const res = r.result || {};
  if (res.terminal && Array.isArray(res.terminal.tail)) {
    return res.terminal.tail.filter((l) => String(l || "").trim());
  }
  const msgs = (res.transcript && res.transcript.messages) || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const t = messageText(msgs[i]);
    if (String(t).trim()) return [t];
  }
  return [];
}

function lastText(id, handle) {
  const lines = screenLines(id);
  if (lines.length) return quote(lines.join("\n"));
  if (handle) return quote(terminalTail(handle).join("\n"));
  return quote("");
}

function preflight(f) {
  const pins = ["implement", "review"].map((ph) => pin(f.repo, ph));
  const uniq = pins.filter(
    (p, i) => pins.findIndex((q) => q.agent === p.agent && q.model === p.model && q.effort === p.effort) === i
  );
  const spec =
    "Preflight only. Do not read, edit or run anything in the repository. Send a heartbeat with subject `ack`, then send worker_done --outcome succeeded with subject `preflight ok`, then stop.";
  const open = {};
  let failed = 0;
  for (const p of uniq) {
    const why = pinWhy(p);
    if (why) {
      out("PREFLIGHT " + p.phase + " " + p.agent + " FAIL " + why);
      failed++;
      continue;
    }
    const s = start(f.repo, f.run, p, spec, "preflight-" + p.phase);
    if (s.error) {
      out("PREFLIGHT " + p.phase + " " + p.agent + " FAIL start: " + s.error);
      failed++;
    } else open[s.id] = Object.assign({ createdHandle: s.createdHandle, gates: 0, messaged: false }, p);
  }
  const drop = (id, rec, line) => {
    out(line);
    orca(["orchestration", "worker-stop", "--dispatch", id]);
    orca(["orchestration", "worker-release", "--dispatch", id]);
    takeAdopt(f.run, id);
    closeCreated(rec.createdHandle);
    delete open[id];
    failed++;
  };
  const pollFailed = () => {
    const rows = ((orca(["orchestration", "worker-list", "--run", f.run]).result || {}).workers || []);
    for (const [id, rec] of Object.entries(open)) {
      if (rec.messaged) continue;
      const w = rows.find((x) => x.dispatchId === id);
      if (!w || w.dispatchStatus !== "failed") continue;
      const detail = ((w.projection || {}).stage || {}).detail || "failed";
      drop(
        id,
        rec,
        "PREFLIGHT " + rec.phase + " " + rec.agent + " FAIL worker failed: " + detail + "; last output: " + lastText(id, rec.createdHandle)
      );
    }
  };
  const pollGates = () => {
    for (const [id, rec] of Object.entries(open)) {
      if (rec.messaged) {
        rec.gates = 0;
        continue;
      }
      const lines = screenLines(id);
      rec.gates = hasGate(lines.join("\n")) ? rec.gates + 1 : 0;
      if (rec.gates >= 2) drop(id, rec, "PREFLIGHT " + rec.phase + " " + rec.agent + " FAIL gate on screen: " + quote(lines.join("\n")));
    }
  };
  const t0 = Date.now();
  while (Object.keys(open).length && Date.now() - t0 < PREFLIGHT_S * 1000) {
    const r = orca([
      "orchestration",
      "check",
      "--wait",
      "--run",
      f.run,
      "--timeout-ms",
      String(Math.max(1, Math.floor(POLL_S * 1000))),
    ]);
    if (r.ok === false) {
      const why = (r.error && r.error.message) || "check failed";
      for (const [id, rec] of Object.entries(open)) drop(id, rec, "PREFLIGHT " + rec.phase + " " + rec.agent + " FAIL " + why);
      process.exit(failed ? 1 : 0);
    }
    const res = r.result || {};
    if (res.deliveryId) {
      for (const m of res.messages || []) {
        const hit = Object.keys(open).find((id) => namesDispatch(m, id));
        if (hit) open[hit].messaged = true;
        if (hit && m.type === "worker_done") {
          out("PREFLIGHT " + open[hit].phase + " " + open[hit].agent + " PASS " + Math.round((Date.now() - t0) / 1000) + "s");
          orca(["orchestration", "worker-release", "--dispatch", hit]);
          closeAdopted(f.run, hit);
          delete open[hit];
        }
      }
      orca(["orchestration", "check", "--run", f.run, "--ack", res.deliveryId]);
    }
    pollFailed();
    pollGates();
    sleep(Math.max(1, Math.floor(POLL_S * 1000)));
  }
  for (const [id, rec] of Object.entries(open)) {
    drop(id, rec, "PREFLIGHT " + rec.phase + " " + rec.agent + " FAIL no worker_done in " + PREFLIGHT_S + "s; last output: " + lastText(id, rec.createdHandle));
  }
  process.exit(failed ? 1 : 0);
}

function dispatch(f) {
  const p = pin(f.repo, f.phase);
  const pinFail = pinWhy(p);
  if (pinFail) out("FAILED " + pinFail, 5);
  const spec =
    fs.readFileSync(path.resolve(f.repo, f["spec-file"]), "utf8") +
    "\n\nFirst action, before anything else: send a heartbeat with subject `ack`.";
  const s = start(f.repo, f.run, p, spec, f.phase);
  if (s.error) out("FAILED " + s.error, 5);
  const interval = Math.max(20, Math.min(5000, Math.floor(POLL_S * 1000)));
  const t0 = Date.now();
  for (; Date.now() - t0 < ACK_S * 1000; sleep(interval)) {
    const peek = orca(["orchestration", "check", "--peek", "--run", f.run]);
    if (((peek.result || {}).messages || []).some((m) => namesDispatch(m, s.id))) out("DISPATCHED " + s.id, 0);
    const row = ((orca(["orchestration", "worker-list", "--run", f.run]).result || {}).workers || []).find((w) => w.dispatchId === s.id);
    if (row && row.dispatchStatus === "failed") break;
  }
  const why = lastText(s.id, s.createdHandle);
  orca(["orchestration", "worker-stop", "--dispatch", s.id]);
  orca(["orchestration", "worker-release", "--dispatch", s.id]);
  takeAdopt(f.run, s.id);
  closeCreated(s.createdHandle);
  out("NO_ACK " + s.id + " stopped after " + Math.round((Date.now() - t0) / 1000) + "s; last output: " + why, 4);
}

function advance(track, id) {
  const t = track[id] || (track[id] = { cursor: null, at: Date.now() });
  for (let page = 0; page < 20; page++) {
    const args = ["orchestration", "worker-read", "--dispatch", id, "--source", "auto", "--limit", "200"];
    if (t.cursor) args.push("--cursor", t.cursor);
    const r = orca(args);
    if (r.ok === false) {
      t.error = (r.error && r.error.message) || "worker-read failed";
      break;
    }
    const res = r.result || {};
    if (res.source) t.source = res.source;
    const body = res.transcript || res.terminal || {};
    const cursor = body.nextCursor || null;
    const n = Number(body.returnedMessageCount || body.returnedLineCount || 0);
    if (cursor && cursor !== t.cursor) t.at = Date.now();
    if (cursor) t.cursor = cursor;
    if (!body.limited || n === 0) break;
  }
  return (Date.now() - t.at) / 60000;
}

function wait(f) {
  const wake = harnessCell(f.control, 6) || "unknown";
  if (wake !== "background" && process.env.DELY_WAITER !== "1") {
    out("REFUSED " + f.control + " wakes by " + wake + "; use dely wait-bg", 3);
  }
  const deadline = Date.now() + Number(f["timeout-min"] || 60) * 60000;
  const stallMin = Number(f["stall-min"] || 10);
  const skip = String(f.skip || "").split(",").filter(Boolean);
  const as = f.as ? ["--terminal", f.as] : [];
  const track = {};
  let lastProgressCheck = 0;
  while (Date.now() < deadline) {
    const r = orca([
      "orchestration",
      "check",
      ...as,
      "--wait",
      "--run",
      f.run,
      "--timeout-ms",
      String(Math.max(1, Math.floor(POLL_S * 1000))),
    ]);
    if (r.ok === false) out("ERROR " + ((r.error && r.error.message) || "check failed"), 9);
    const res = r.result || {};
    if (res.deliveryId) {
      const msgs = res.messages || [];
      if (msgs.some((m) => ["worker_done", "escalation", "question"].includes(m.type))) {
        console.log(
          JSON.stringify({
            SETTLED: res.deliveryId,
            messages: msgs.map((m) => ({
              id: m.id,
              type: m.type,
              from: m.from_handle,
              subject: m.subject,
              payload: m.payload,
            })),
          })
        );
        for (const m of msgs) {
          if (m.type === "worker_done") closeAdopted(f.run, idOf(m));
        }
        process.exit(0);
      }
      orca(["orchestration", "check", ...as, "--run", f.run, "--ack", res.deliveryId]);
      continue;
    }
    const rows = ((orca(["orchestration", "worker-list", "--run", f.run]).result || {}).workers || []).filter(
      (w) => !skip.includes(w.dispatchId)
    );
    const act = rows.filter((w) => {
      const kind = ((w.projection || {}).nextAction || {}).kind;
      return kind && kind !== "none";
    });
    if (act.length) {
      out(
        {
          ATTENTION: act.map((w) => ({
            dispatchId: w.dispatchId,
            liveness: w.projection.liveness,
            nextAction: w.projection.nextAction,
          })),
        },
        8
      );
    }
    if (Date.now() - lastProgressCheck < PROGRESS_S * 1000) continue;
    lastProgressCheck = Date.now();
    for (const w of rows.filter((w) => w.dispatchStatus === "dispatched")) {
      const idle = advance(track, w.dispatchId);
      const rec = track[w.dispatchId] || {};
      if (!rec.error && rec.source !== "transcript") continue;
      if (idle >= stallMin) {
        const why = rec.error ? rec.error : "no new output for " + Math.floor(idle) + " min";
        out(
          "STALLED " +
            w.dispatchId +
            " " +
            why +
            "; liveness " +
            JSON.stringify((w.projection || {}).liveness) +
            "; last output: " +
            lastText(w.dispatchId),
          6
        );
      }
    }
  }
  out("DEADLINE", 7);
}

function waitBg(f) {
  const me = process.env.ORCA_TERMINAL_HANDLE;
  if (!me) out("ERROR not inside an Orca terminal", 9);
  const file = path.resolve(f.out || path.join(os.tmpdir(), "dely-wait-" + f.run + ".out"));
  const lock = file + ".lock";
  const recorded = () => {
    try {
      const j = JSON.parse(fs.readFileSync(lock, "utf8"));
      return (j && j.terminal) || "";
    } catch (_) {
      return "";
    }
  };
  const live = (handle) => {
    if (!handle) return false;
    const terms = ((orca(["terminal", "list"]).result || {}).terminals || []);
    return terms.some((t) => t && t.handle === handle);
  };
  const writeLock = (handle) => {
    try {
      fs.writeFileSync(lock, JSON.stringify({ terminal: handle || "" }));
    } catch (_) {
      /* vanished or unwritable */
    }
  };
  try {
    fs.writeFileSync(lock, JSON.stringify({ terminal: "" }), { flag: "wx" });
  } catch (_) {
    if (live(recorded())) {
      out("ALREADY_WAITING: a dely wait is running for this Run; end your turn, it will wake you.", 0);
    }
    writeLock("");
  }
  try {
    fs.unlinkSync(file);
  } catch (_) {
    /* no prior output */
  }
  const q = JSON.stringify;
  const self = q(__filename);
  const bin = q(process.execPath);
  const extra = ["control", "skip", "stall-min", "timeout-min"]
    .filter((k) => f[k] && f[k] !== true)
    .map((k) => " --" + k + " " + q(f[k]))
    .join("");
  const cmd =
    "DELY_WAITER=1 " +
    bin +
    " " +
    self +
    " wait --run " +
    q(f.run) +
    " --as " +
    q(me) +
    extra +
    " > " +
    q(file) +
    " 2>&1; rm -f " +
    q(lock) +
    "; " +
    bin +
    " " +
    self +
    " notify --run " +
    q(f.run) +
    " --as " +
    q(me) +
    " --out " +
    q(file) +
    "; exit";
  const r = orca(["terminal", "create", "--worktree", "path:" + process.cwd(), "--title", "dely-wait", "--command", cmd]);
  if (r.ok === false) {
    try {
      fs.unlinkSync(lock);
    } catch (_) {
      /* lock */
    }
    out("ERROR " + ((r.error && r.error.message) || "terminal create failed"), 9);
  }
  writeLock((r.result && r.result.terminal && r.result.terminal.handle) || "");
  out("WAITING", 0);
}

function notify(f) {
  const run = (orca(["orchestration", "run-show", "--id", f.run]).result || {}).run || {};
  const to = run.coordinator_handle || f.as;
  const text = "dely wait finished for " + f.run + ". Finish your current step, then read " + f.out + " and continue.";
  const retryMs = Math.max(1, Math.floor(NOTIFY_RETRY_S * 1000));
  const giveUpMs = NOTIFY_GIVEUP_S * 1000;
  for (const t0 = Date.now(); ; ) {
    const r = orca(["terminal", "send", "--terminal", to, "--text", text, "--enter"]);
    if (r.ok !== false) return;
    const msg = (r.error && r.error.message) || "";
    if (!/agent_prompt_blocked/.test(msg)) return;
    const left = giveUpMs - (Date.now() - t0);
    if (left <= 0) process.exit(1);
    sleep(Math.min(retryMs, left));
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const table = { preflight, dispatch, wait, "wait-bg": waitBg, notify };
const need = {
  preflight: ["repo", "run"],
  dispatch: ["repo", "run", "phase", "spec-file"],
  wait: ["run", "control"],
  "wait-bg": ["run", "control"],
  notify: ["run", "out"],
};
if (!table[cmd]) out("usage: dely preflight|dispatch|wait|wait-bg|notify", 2);
const f = flags(rest);
if (need[cmd].some((k) => !f[k])) out("usage: dely preflight|dispatch|wait|wait-bg|notify", 2);
table[cmd](f);
