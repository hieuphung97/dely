#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ACK_S = Number(process.env.DELY_ACK_S || 60);
const POLL_S = Number(process.env.DELY_POLL_S || 15);
const PROGRESS_S = Number(process.env.DELY_PROGRESS_S || 60);
const seconds = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);
const PREFLIGHT_S = seconds(process.env.DELY_PREFLIGHT_S, 150);
const NOTIFY_RETRY_S = seconds(process.env.DELY_NOTIFY_RETRY_S, 30);
const NOTIFY_GIVEUP_S = seconds(process.env.DELY_NOTIFY_GIVEUP_S, 1800);

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

const PACKAGE_ROOT = path.resolve(__dirname, "../../..");
const HARNESSES_PATH = path.join(PACKAGE_ROOT, "harnesses.json");

let _harnesses;
function loadHarnesses() {
  if (_harnesses) return _harnesses;
  let raw;
  try {
    raw = fs.readFileSync(HARNESSES_PATH, "utf8");
  } catch (e) {
    fail("cannot read " + HARNESSES_PATH + ": " + (e.message || e));
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    fail("cannot parse " + HARNESSES_PATH + ": " + (e.message || e));
  }
  if (!data || !Array.isArray(data.harnesses)) {
    fail(HARNESSES_PATH + " has no harnesses array");
  }
  _harnesses = data.harnesses;
  return _harnesses;
}

function effortRequiresModel() {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(HARNESSES_PATH, "utf8"));
  } catch (_) {
    return true;
  }
  return raw && raw.effortRequiresModel !== false;
}

function harnessById(id) {
  return loadHarnesses().find((h) => h.id === id);
}

function pin(repo, phase) {
  const md = fs.readFileSync(path.join(repo, "AGENTS.md"), "utf8");
  const row = md.split("\n").find((l) => new RegExp("^\\|\\s*`?" + phase + "`?\\s*\\|").test(l));
  if (!row) throw new Error("no " + phase + " pin in AGENTS.md");
  const [, harness, model, effort] = row.split("|").slice(1).map((c) => c.trim().replace(/`/g, ""));
  const h = loadHarnesses().find((x) => x.name === harness);
  if (!h) throw new Error("unknown harness " + harness);
  return { phase, agent: h.id, model, effort, modelFlag: h.modelFlag, effortFlag: h.effortFlag };
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const out = (line, code) => {
  console.log(typeof line === "string" ? line : JSON.stringify(line));
  if (code != null) process.exit(code);
};

let _sha;
function delySha() {
  if (_sha !== undefined) return _sha;
  try {
    _sha = String(
      execFileSync("git", ["-C", PACKAGE_ROOT, "rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })
    ).trim();
    if (!_sha) _sha = null;
  } catch (_) {
    _sha = null;
  }
  return _sha;
}

let _orcaVer;
function orcaVersion() {
  if (_orcaVer !== undefined) return _orcaVer;
  try {
    _orcaVer = ((orca(["status"]).result || {}).runtime || {}).appVersion || null;
  } catch (_) {
    _orcaVer = null;
  }
  return _orcaVer;
}

// Append one JSON object to ~/.dely/log.jsonl when that directory already
// exists. Never mkdir. A write failure must not change exit, print, or flow.
function logEvent(event, extra) {
  extra = extra || {};
  try {
    if (!fs.statSync(path.join(os.homedir(), ".dely")).isDirectory()) return;
    const rec = {
      ts: new Date().toISOString(),
      run: extra.run == null ? null : extra.run,
      repo: extra.repo == null ? null : extra.repo,
      sha: delySha(),
      orca: orcaVersion(),
      event,
    };
    for (const k of Object.keys(extra)) {
      if (k in rec) continue;
      rec[k] = extra[k];
    }
    fs.appendFileSync(path.join(os.homedir(), ".dely", "log.jsonl"), JSON.stringify(rec) + "\n");
  } catch (_) {
    /* observer */
  }
}

function fail(reason, extra) {
  logEvent("error", Object.assign({ reason }, extra || {}));
  out("ERROR " + reason, 9);
}

function printIdentity() {
  let version = "unknown";
  try {
    version = JSON.parse(
      fs.readFileSync(path.join(PACKAGE_ROOT, ".claude-plugin/plugin.json"), "utf8")
    ).version;
  } catch (_) {
    /* missing or unreadable */
  }
  let skill = "unreadable";
  try {
    skill = crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(PACKAGE_ROOT, "skills/delivery/SKILL.md")))
      .digest("hex");
  } catch (_) {
    /* missing */
  }
  console.log("dely " + version + " sha " + (delySha() || "null") + " sha256 " + skill);
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
    "--agent",
    p.agent,
  ];
  const wantsModel = p.modelFlag && p.model !== "default";
  const wantsEffort = p.effortFlag && p.effort !== "default";
  if (effortRequiresModel() && wantsEffort && !wantsModel) {
    return {
      error:
        "effort " + p.effort + " pinned with model default for " + p.agent +
        "; --effort requires --model, so set a model or set effort to default",
    };
  }
  if (wantsModel) args.push("--model", p.model);
  if (wantsEffort) args.push("--effort", p.effort);
  const r = orca(args);
  const id = r.result && r.result.dispatchId;
  if (!id) {
    return { error: (r.error && r.error.message) || String((r.result && r.result.failedStage) || "worker-start") };
  }
  return { id };
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

function screenText(id) {
  return screenLines(id).join("\n");
}

function lastText(id) {
  return clip(screenText(id));
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
    const s = start(f.repo, f.run, p, spec, "preflight-" + p.phase);
    if (s.error) {
      logEvent("preflight", {
        run: f.run,
        repo: f.repo,
        phase: p.phase,
        agent: p.agent,
        result: "FAIL",
        seconds: 0,
        reason: "start: " + s.error,
      });
      out("PREFLIGHT " + p.phase + " " + p.agent + " FAIL start: " + s.error);
      failed++;
    } else open[s.id] = Object.assign({ messaged: false }, p);
  }
  const drop = (id, rec, line) => {
    logEvent("preflight", {
      run: f.run,
      repo: f.repo,
      phase: rec.phase,
      agent: rec.agent,
      result: "FAIL",
      seconds: Math.round((Date.now() - t0) / 1000),
      reason: line.replace(/^PREFLIGHT \S+ \S+ FAIL /, ""),
    });
    out(line);
    orca(["orchestration", "worker-stop", "--dispatch", id]);
    orca(["orchestration", "worker-release", "--dispatch", id]);
    delete open[id];
    failed++;
  };
  const pollDead = () => {
    const rows = ((orca(["orchestration", "worker-list", "--run", f.run]).result || {}).workers || []);
    for (const [id, rec] of Object.entries(open)) {
      if (rec.messaged) continue;
      const w = rows.find((x) => x.dispatchId === id);
      if (!w) continue;
      const stage = (w.projection || {}).stage || {};
      let why = "";
      if (w.dispatchStatus === "failed") why = "worker failed: " + (stage.detail || "failed");
      else if (stage.worker === "start_unknown") why = "worker never started a turn: " + (stage.detail || "start_unknown");
      if (!why) continue;
      drop(id, rec, "PREFLIGHT " + rec.phase + " " + rec.agent + " FAIL " + why + "; last output: " + lastText(id));
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
          const secs = Math.round((Date.now() - t0) / 1000);
          logEvent("preflight", {
            run: f.run,
            repo: f.repo,
            phase: open[hit].phase,
            agent: open[hit].agent,
            result: "PASS",
            seconds: secs,
          });
          out("PREFLIGHT " + open[hit].phase + " " + open[hit].agent + " PASS " + secs + "s");
          orca(["orchestration", "worker-release", "--dispatch", hit]);
          delete open[hit];
        }
      }
      orca(["orchestration", "check", "--run", f.run, "--ack", res.deliveryId]);
    }
    pollDead();
  }
  for (const [id, rec] of Object.entries(open)) {
    drop(id, rec, "PREFLIGHT " + rec.phase + " " + rec.agent + " FAIL no worker_done in " + PREFLIGHT_S + "s; last output: " + lastText(id));
  }
  process.exit(failed ? 1 : 0);
}

function dispatch(f) {
  const p = pin(f.repo, f.phase);
  const spec =
    fs.readFileSync(path.resolve(f.repo, f["spec-file"]), "utf8") +
    "\n\nFirst action, before anything else: send a heartbeat with subject `ack`. The Orca preamble and this spec file are everything the worker needs; read no other skill.";
  const s = start(f.repo, f.run, p, spec, f.phase);
  if (s.error) {
    logEvent("error", { run: f.run, repo: f.repo, reason: s.error });
    out("FAILED " + s.error, 5);
  }
  const interval = Math.max(20, Math.min(5000, Math.floor(POLL_S * 1000)));
  const t0 = Date.now();
  for (; Date.now() - t0 < ACK_S * 1000; sleep(interval)) {
    const peek = orca(["orchestration", "check", "--peek", "--run", f.run]);
    if (((peek.result || {}).messages || []).some((m) => namesDispatch(m, s.id))) {
      logEvent("dispatch", {
        run: f.run,
        repo: f.repo,
        phase: p.phase,
        agent: p.agent,
        dispatchId: s.id,
        seconds: Math.round((Date.now() - t0) / 1000),
      });
      out("DISPATCHED " + s.id, 0);
    }
    const row = ((orca(["orchestration", "worker-list", "--run", f.run]).result || {}).workers || []).find((w) => w.dispatchId === s.id);
    if (row && row.dispatchStatus === "failed") break;
  }
  const raw = screenText(s.id);
  const secs = Math.round((Date.now() - t0) / 1000);
  orca(["orchestration", "worker-stop", "--dispatch", s.id]);
  orca(["orchestration", "worker-release", "--dispatch", s.id]);
  logEvent("no_ack", { run: f.run, repo: f.repo, dispatchId: s.id, seconds: secs, text: raw });
  out("NO_ACK " + s.id + " stopped after " + secs + "s; last output: " + clip(raw), 4);
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

// The harness this process is actually running in, read from the Orca terminal
// that launched it. --control is what the caller says it is; this is what it is.
// Measured on Orca 1.4.203: a Codex Control passed --control cursor and
// --control claude, naming the workers it waited on, and a guard that trusted
// the flag let a waker Control run a blocking wait. Null outside Orca.
function selfHarness() {
  const me = process.env.ORCA_TERMINAL_HANDLE;
  if (!me) return null;
  const terms = ((orca(["terminal", "list"]).result || {}).terminals || []);
  const t = terms.find((x) => x && x.handle === me);
  return (t && t.agentIdentity) || null;
}

function wait(f) {
  if (process.env.DELY_WAITER !== "1") {
    const self = selfHarness();
    const who = self || f.control;
    const wake = (harnessById(who) || {}).controlWake || "unknown";
    if (wake !== "background") {
      const said = self && self !== f.control ? " (called with --control " + f.control + ")" : "";
      out("REFUSED " + who + " wakes by " + wake + said + "; use dely wait-bg", 3);
    }
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
    if (r.ok === false) fail((r.error && r.error.message) || "check failed", { run: f.run });
    const res = r.result || {};
    if (res.deliveryId) {
      const msgs = res.messages || [];
      if (msgs.some((m) => ["worker_done", "escalation", "question"].includes(m.type))) {
        logEvent("settled", {
          run: f.run,
          deliveryId: res.deliveryId,
          messages: msgs.map((m) => ({ type: m.type, subject: m.subject })),
        });
        out(
          {
            SETTLED: res.deliveryId,
            messages: msgs.map((m) => ({
              id: m.id,
              type: m.type,
              from: m.from_handle,
              subject: m.subject,
              payload: m.payload,
            })),
          },
          0
        );
      }
      orca(["orchestration", "check", ...as, "--run", f.run, "--ack", res.deliveryId]);
      continue;
    }
    const rows = ((orca(["orchestration", "worker-list", "--run", f.run]).result || {}).workers || []).filter(
      (w) => !skip.includes(w.dispatchId)
    );
    // dispatched is load-bearing: pending+requiresAction is the start
    // transient; completed+release is a settled worker awaiting release.
    const act = rows.filter((w) => {
      const proj = w.projection || {};
      // An absent optional field is an absent field, not a value: a row with
      // no projection, or a projection with no nextAction, is not attention.
      const kind = (proj.nextAction || {}).kind || "none";
      const needs = (proj.attention || {}).requiresAction === true;
      return w.dispatchStatus === "dispatched" && (kind !== "none" || needs);
    });
    if (act.length) {
      const payload = act.map((w) => ({
        dispatchId: w.dispatchId,
        liveness: (w.projection || {}).liveness,
        nextAction: (w.projection || {}).nextAction,
        attention: (w.projection || {}).attention,
      }));
      logEvent("attention", { run: f.run, workers: payload });
      out({ ATTENTION: payload }, 8);
    }
    if (Date.now() - lastProgressCheck < PROGRESS_S * 1000) continue;
    lastProgressCheck = Date.now();
    for (const w of rows.filter((w) => w.dispatchStatus === "dispatched")) {
      const idle = advance(track, w.dispatchId);
      const rec = track[w.dispatchId] || {};
      if (!rec.error && rec.source !== "transcript") continue;
      if (idle >= stallMin) {
        const raw = screenText(w.dispatchId);
        const why = rec.error ? rec.error : "no new output for " + Math.floor(idle) + " min";
        logEvent("stalled", {
          run: f.run,
          dispatchId: w.dispatchId,
          idleMinutes: Math.floor(idle),
          liveness: (w.projection || {}).liveness,
          text: raw,
        });
        out(
          "STALLED " +
            w.dispatchId +
            " " +
            why +
            "; liveness " +
            JSON.stringify((w.projection || {}).liveness) +
            "; last output: " +
            clip(raw),
          6
        );
      }
    }
  }
  logEvent("deadline", { run: f.run });
  out("DEADLINE", 7);
}

function waitBg(f) {
  const me = process.env.ORCA_TERMINAL_HANDLE;
  if (!me) fail("not inside an Orca terminal", { run: f.run });
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
      logEvent("wait_bg", { run: f.run, which: "ALREADY_WAITING", path: file });
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
    fail((r.error && r.error.message) || "terminal create failed", { run: f.run });
  }
  writeLock((r.result && r.result.terminal && r.result.terminal.handle) || "");
  logEvent("wait_bg", { run: f.run, which: "WAITING", path: file });
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
    if (r.ok !== false) {
      logEvent("notify", { run: f.run, target: to, result: "sent" });
      return;
    }
    const msg = (r.error && r.error.message) || "";
    if (!/agent_prompt_blocked/.test(msg)) {
      logEvent("notify", { run: f.run, target: to, result: "failed" });
      return;
    }
    const left = giveUpMs - (Date.now() - t0);
    if (left <= 0) {
      logEvent("notify", { run: f.run, target: to, result: "gave_up" });
      process.exit(1);
    }
    sleep(Math.min(retryMs, left));
  }
}

function logCmd(f) {
  let payload;
  try {
    payload = JSON.parse(f.json);
  } catch (e) {
    fail("cannot parse --json: " + (e.message || e), { run: f.run });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("--json must be an object", { run: f.run });
  }
  logEvent("delivery", Object.assign({}, payload, { run: f.run, repo: f.repo || payload.repo || null }));
  process.exit(0);
}

const COMMANDS = {
  preflight: { required: [["repo", "PATH"], ["run", "RUN"]], optional: [] },
  dispatch: {
    required: [
      ["repo", "PATH"],
      ["run", "RUN"],
      ["phase", "implement|review"],
      ["spec-file", "FILE"],
    ],
    optional: [],
  },
  wait: {
    required: [["run", "RUN"], ["control", "HARNESS"]],
    optional: [
      ["as", "TERMINAL"],
      ["skip", "IDS"],
      ["stall-min", "N"],
      ["timeout-min", "N"],
    ],
  },
  "wait-bg": {
    required: [["run", "RUN"], ["control", "HARNESS"]],
    optional: [
      ["out", "FILE"],
      ["skip", "IDS"],
      ["stall-min", "N"],
      ["timeout-min", "N"],
    ],
  },
  notify: {
    required: [["run", "RUN"], ["out", "FILE"]],
    optional: [["as", "TERMINAL"]],
  },
  log: {
    required: [["run", "RUN"], ["json", "OBJ"]],
    optional: [["repo", "PATH"]],
  },
};

function usageLine(name) {
  const spec = COMMANDS[name];
  const bits = spec.required.map(([k, v]) => "--" + k + " " + v);
  const opts = spec.optional.map(([k, v]) => "[--" + k + " " + v + "]");
  return "  dely " + name + " " + bits.concat(opts).join(" ");
}

function printUsage() {
  console.log("usage:");
  for (const name of Object.keys(COMMANDS)) console.log(usageLine(name));
  console.log("  dely <subcommand> --help");
}

const [cmd, ...rest] = process.argv.slice(2);
const table = { preflight, dispatch, wait, "wait-bg": waitBg, notify, log: logCmd };
if (!cmd) {
  printIdentity();
  printUsage();
  process.exit(0);
}
if (!COMMANDS[cmd]) {
  printUsage();
  process.exit(2);
}
const f = flags(rest);
if (f.help === true) {
  const i = rest.indexOf("--help");
  if (!(i > 0 && String(rest[i - 1]).startsWith("--"))) {
    console.log(usageLine(cmd));
    process.exit(0);
  }
}
const missing = COMMANDS[cmd].required.filter(([k]) => !f[k]).map(([k]) => "--" + k);
if (missing.length) {
  console.log("missing " + missing.join(", "));
  console.log(usageLine(cmd));
  process.exit(2);
}
table[cmd](f);
