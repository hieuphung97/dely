# dely

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/logo.svg">
  <img src="assets/logo-light.svg" alt="dely" width="72" height="72">
</picture>

Ask for a change; Dely takes it through design approval, implementation,
independent review, and a pull request you merge.

https://github.com/user-attachments/assets/83ec539a-6551-4807-8517-0c73e5d171d7

[YouTube](https://www.youtube.com/watch?v=6pRWkhlQSAc)

## Contents

- [Quickstart](#quickstart)
- [How Dely works](#how-dely-works)
- [Choose a harness for each role](#choose-a-harness-for-each-role)
- [Install Orca](#install-orca)
- [Install Dely](#install-dely)
- [Choose models](#choose-models)
- [Log](#log)
- [Troubleshooting](#troubleshooting)

## Quickstart

1. [Install Orca](#install-orca).
2. [Install Dely](#install-dely) in the harness you will talk to.
3. Open that harness in your project and optionally invoke `dely:setup`.
4. Ask for a change.

## How Dely works

You ask. Control designs. You approve. The implementer builds. The reviewer
checks. Control opens the pull request. You merge.

**Control** is the session you talk to. It writes the design, waits for your
approval, starts the other two sessions, and opens the pull request. Install
Dely here.

**Implementer** is a session Control starts to make the change.

**Reviewer** is a session Control starts to check the change independently
before the pull request. The implementer and the reviewer are the workers.

A Spike investigates only — no delivery run.

## Choose a harness for each role

Before the first delivery in a project, open each harness you chose there once
and answer its trust question. Setup opens them for you. OMP has no trust
question; Pi asks only when the project or a parent folder has `.pi/` or
`.agents/skills`.

✓ works · ⚠ works, read the note · ✗ not supported

| Harness | Control | Implementer | Reviewer | Watch out for |
| --- | --- | --- | --- | --- |
| Claude Code | ✓ | ✓ | ✓ | Put @AGENTS.md in CLAUDE.md. |
| Codex CLI | ⚠ | ✓ | ✓ | Use Codex CLI 0.159.2 or newer with Orca 1.4.217 or newer. As Control, it can start the next Dely step before the last one finishes. |
| Grok Build | ⚠ | ⚠ | ⚠ | Answer the trust question once in every project. As a worker, you cannot choose the model. As Control, a free account ran out of usage mid-delivery. |
| Antigravity CLI | ✓ | ⚠ | ⚠ | Choose the effort through the model name. Avoid gemini-3-flash-preview. As a worker, the first launch in a new folder can lose the task and show 'not signed in' while signed in; Dely retries once, then asks you to open agy there. |
| Kiro CLI | ✗ | ✗ | ✗ | Workers never start in Orca. |
| Cursor Agent CLI | ✓ | ✓ | ✓ | Choose the effort through the model name, for example cursor-grok-4.6-high. |
| GitHub Copilot CLI | ✓ | ⚠ | ⚠ | At the first launch, answer No, thanks to the app prompt; until then a launch can leave the task unsent. Answer the folder trust question once in every project and choose to remember the folder; Orca does not see it, so a missed one shows as NO_ACK. As a worker, you cannot choose the model. |
| OMP | ✓ | ⚠ | ⚠ | As a worker, OMP 18.4 does not start under Orca 1.4.217 (stablyai/orca#24068) until that issue closes, and a crash is noticed after about 10 minutes. It never asks for trust, so use it only in repositories you trust. As a worker, to pin a model, install Dely in OMP. |
| Pi | ⚠ | ⚠ | ⚠ | As Control, run Dely's commands with no time limit, and release leftover workers. As a worker, to pin a model, install Dely in Pi, then check the model in Pi's session log. |

Other agents Orca can launch may work too;
[`harnesses.json`](harnesses.json) records what was measured.

## Install Orca

Orca runs each session and launches the workers.

1. Install the [desktop app](https://www.onorca.dev/docs/install).
2. Register the CLI: Settings → General → Orca CLI. See the
   [CLI overview](https://www.onorca.dev/docs/cli/overview).
3. Enable orchestration: Settings → Experimental. See
   [orchestration](https://www.onorca.dev/docs/cli/orchestration).
4. Check it:

```bash
orca open
orca status --json
orca orchestration run-list --json
```

On Linux, the binary is `orca-ide`.

## Install Dely

**Install Dely only in the harness you use as the Control session.** A harness
used only as implementer or reviewer needs Orca and its own login. Workers
read no Dely skill. **A pinned OMP or Pi worker also needs that harness's
Dely install below**, which loads `dely-pin.ts`.

Have Node 18 or newer on PATH. Open Control in your project, invoke `dely:setup`
(optional) to choose implementer and reviewer harnesses, models and efforts,
then ask for a change using `dely:delivery`. Without setup, Dely uses Control's
harness and defaults. Use the invocation spelling listed below for your harness.

### Claude Code

```bash
claude plugin marketplace add https://github.com/hieuphung97/dely.git
claude plugin install dely@dely
claude plugin list                 # verify
claude plugin update dely          # update; restart to apply
claude plugin uninstall dely       # remove
```

Put `@AGENTS.md` in `CLAUDE.md` so Claude reads the project pins.
Invoke `/dely:delivery` or `/dely:setup`.

### Codex CLI

```bash
codex plugin marketplace add https://github.com/hieuphung97/dely.git
codex plugin add dely@dely
codex plugin list                  # verify
codex plugin marketplace upgrade   # update; open a new session
codex plugin remove dely@dely       # remove
```

If add keeps a stale marketplace, remove the marketplace and plugin, then add
again. Pin a tag or full commit SHA with
`codex plugin marketplace add --ref <ref> https://github.com/hieuphung97/dely.git`.
Do not use `codex plugin install`.
Invoke `$delivery (dely:delivery)` or `$setup (dely:setup)`.

### Cursor Agent CLI

```bash
cursor-agent plugin marketplace add https://github.com/hieuphung97/dely.git
cursor-agent plugin marketplace list          # verify marketplace
cursor-agent plugin marketplace update dely   # re-index only; does not fetch
cursor-agent plugin marketplace remove dely   # remove marketplace only
```

In a session, open `/plugin` → Marketplace → dely → Install for you.
To update, remove and re-add the marketplace, then uninstall and reinstall
Dely in `/plugin`. To remove Dely, use `/plugin` → Installed → dely → Uninstall.
Type `/dely` to find `/delivery` and `/setup`. Local snapshot installs are
unavailable; Cursor can read the Claude plugin cache.

### GitHub Copilot CLI

```bash
copilot plugin install https://github.com/hieuphung97/dely.git
copilot plugin install /path/to/dely       # local alternative
copilot skill list                        # verify delivery and setup
copilot plugin update dely                # update git or local install
copilot plugin uninstall dely             # remove
```

Invoke `/dely:delivery` or `/dely:setup`. Direct installs print a deprecation
warning. A same-named project or personal skill can hide the plugin skill.

### Antigravity CLI

```bash
agy plugin install https://github.com/hieuphung97/dely.git
agy plugin install /path/to/dely           # local alternative
agy plugin list                           # verify dely with skills
agy plugin install https://github.com/hieuphung97/dely.git   # update git install
agy plugin uninstall dely                 # remove
```

There is no plugin update subcommand. Re-run install with the same target to
update. Invoke `/dely:delivery` or `/dely:setup`.

### Grok Build

```bash
grok plugin install https://github.com/hieuphung97/dely.git --trust
grok plugin install /path/to/dely --trust  # local alternative
grok plugin details dely                  # verify
grok inspect                              # verify loaded delivery and setup
grok plugin update dely                   # update git install
grok plugin uninstall dely                # remove
```

For a local install, uninstall then install again; update does not re-copy.
Invoke `/delivery` or `/setup`. Grok also loads Claude Code plugins; its own
copy wins. To stop loading Dely completely, remove both copies if present.

### OMP

Use a dedicated clone or an unpacked snapshot; install links the source path.

```bash
git clone https://github.com/hieuphung97/dely.git
omp plugin install /path/to/dely
omp plugin list --json                    # verify dely-pin.ts
omp skill list --json                     # verify loaded skills
omp plugin uninstall dely                 # remove; needs bun on PATH
omp plugin disable dely                   # disable skills and extension
```

Update by pulling the dedicated clone, then opening a new OMP session.
Without bun, disable Dely; delete `~/.omp/plugins/node_modules/dely`, remove
the empty `node_modules` directory, and delete `.plugins.dely` from
`~/.omp/plugins/omp-plugins.lock.json`. Invoke `delivery` or `setup` without
namespacing. OMP has no workspace-trust gate; only use trusted repositories.

### Pi

```bash
pi install git:github.com/hieuphung97/dely@v<version>
pi install /path/to/dely                   # local alternative
pi list                                   # verify
pi --verbose                              # verify loaded paths at startup
pi remove git:github.com/hieuphung97/dely@v<version>
pi remove /path/to/dely                    # remove local install
```

Find `<version>` in [releases](https://github.com/hieuphung97/dely/releases).
Update by installing the new tag. At startup, check that Skills names
`delivery` and `setup`, and Extensions names `dely-pin.ts`.
Invoke `/skill:delivery` or `/skill:setup`. Check a pinned worker's model in
`~/.pi/agent/sessions/`.

Checked versions (observations, not minimums): Orca 1.4.217; Claude Code
2.1.285; Codex CLI 0.159.2; Cursor Agent CLI 2026.09.28-64d2043; Copilot CLI
1.0.89; Antigravity CLI 1.2.13 (install), 1.2.14 (worker, Control); Grok
Build 1.0.44; OMP 18.3.4 (install); Pi 0.99.1.

## Choose models

Invoke setup to list the models and efforts each installed harness offers, then
write your choice. The role table's notes say which harnesses cannot take a
model.

## Log

`~/.dely/log.jsonl` is machine-local JSON Lines, one object per line. It
is off unless `~/.dely/` exists; `mkdir ~/.dely` turns it on, and Dely
never creates that directory. A missing directory means nothing is
written and nothing is created.

The file may contain sensitive content. It quotes worker screen output
in full, so it can hold repository contents, error text, and whatever a
harness printed.

## Troubleshooting

- **Worker stays at startup:** read its screen. Answer shell startup prompts
  such as an oh-my-zsh update, then retry.
- **Orca disconnects:** reopen Orca, check the commands under Install Orca,
  and inspect workers with `orca orchestration worker-list --run <run>`
  before retrying.
- **First launch stops at trust:** open that harness in the same path and
  answer its dialog, then retry. Copilot can report only `NO_ACK`, and its
  first launch also shows an app promo: answer No, thanks once;
  Antigravity can lose the prompt on a new path; retry once. Pi asks when
  the path or an ancestor has `.pi/` resources or `.agents/skills`.
- **Codex helper says "not inside an Orca terminal":** ask Control to look up
  its handle with `orca terminal list --worktree active --json` only when
  that worktree has one agent terminal, then prefix helper and `orca` commands
  with `ORCA_TERMINAL_HANDLE=<handle>`. Otherwise, use another Control harness.
  Never use another pane's handle.
- **Old behavior after update:** open a new Control session. Ask Control to run
  its `scripts/dely` with no arguments to identify the running copy. Compare
  `skills/delivery/SKILL.md` by SHA-256 at every skill location, including
  `~/.agents/skills`, project and personal skills, plugin caches and
  marketplace sources; update or remove mismatched copies.
  Codex personal skills can shadow plugins; Cursor copies can override the
  Claude cache; Copilot project and personal skills can hide its plugin.

[Workflow contract](skills/delivery/SKILL.md) ·
[Contributing](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.md) ·
[Security](SECURITY.md) · [Decisions](docs/decisions.md) · [MIT](LICENSE)
