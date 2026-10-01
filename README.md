# dely

Dely takes a coding change through design approval, implementation, independent
review, and a pull request. You approve the design and merge the result.

## Install Orca

1. Install the [desktop app](https://www.onorca.dev/docs/install).
2. Register the CLI: Settings → General → Orca CLI.
3. Enable orchestration: Settings → Experimental.
4. Check it:

```bash
orca open
orca status --json
orca orchestration run-list --json
```

On Linux, the binary is `orca-ide`.

## Choose harnesses

Supported choices include the following. See [harnesses.json](harnesses.json)
for launch settings and measured versions; the list can grow.

| Harness | Control wake | Limits |
| --- | --- | --- |
| Claude Code | background | — |
| Codex CLI | waker | As Control, it can start the next helper command before the last one ends; 0.157.1's shell lacked `ORCA_TERMINAL_HANDLE`. |
| Grok Build | waker | Every repository with `AGENTS.md` needs a per-path trust answer; no model pin. |
| Antigravity CLI | waker | First launch on a new path can lose the prompt; no effort pin. |
| Cursor Agent CLI | background | No effort pin. |
| GitHub Copilot CLI | background | Orca misses its trust dialog and first-launch app promo (`NO_ACK`); no model pin; prompts can remain unsent. |
| OMP | waker | A dead worker surfaces only at `STALLED`; OMP 18.4.4 workers do not start on Orca 1.4.217 ([orca#24068](https://github.com/stablyai/orca/issues/24068)). |
| Pi | waker | As Control, run the helper with no tool timeout; the pin is unchecked. |

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
Invoke `/skill:delivery` or `/skill:setup`.

Kiro CLI was measured but is not supported: workers never became ready.

Checked versions (observations, not minimums): Orca 1.4.217; Claude Code
2.1.285; Codex CLI 0.159.2; Cursor Agent CLI 2026.09.28-64d2043; Copilot CLI
1.0.89; Antigravity CLI 1.2.14; Grok Build 1.0.44; OMP 18.3.4 (install);
Pi 0.99.1.

## Pin a model

Invoke setup to select live model and effort values for each phase. Copilot
and Grok have neither model nor effort pins; Cursor and Antigravity have no
effort pin.

OMP uses a selector from `omp models --json` and that model's `thinking`
levels. Pi uses `<provider>/<model>` from `pi --list-models` and
levels from `pi --help`. Pi's pin is unchecked by Orca; verify it in the
session transcript under `~/.pi/agent/sessions/`. For Pi, instruct Control
to run the helper with no tool timeout.

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
