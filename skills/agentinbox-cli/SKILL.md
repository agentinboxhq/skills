---
name: agentinbox-cli
description: Sets up and scripts the Agent Inbox CLI, `npx @agentinbox/cli`, covering setup, login, connecting a computer with a one-time code, adding Telegram, Slack or email, listening for messages so that one starts Claude Code in a project (`listen`), environment variables for CI, containers and sandboxes, exit codes in shell scripts, and the errors the CLI prints. Use when someone wants to set up Agent Inbox, connect this computer or a CI job to an agent, add a channel, have a message to the agent start Claude Code on this computer while nobody runs it, check where it listens or stop it, make a pipeline step wait for a person's approval, or when an `npx @agentinbox/cli` command fails because no inbox is set up, the keyless demo is used up, the agent is paused, or a code is wrong. Not for deciding what to ask people or how to answer conversations (agentinbox), or for connecting a chat app through MCP (agentinbox-mcp).
license: MIT
compatibility: Needs Node.js for npx, and network access to agentinbox.md.
---

# Agent Inbox CLI

`npx @agentinbox/cli` runs the CLI with nothing installed first; `npm install -g @agentinbox/cli` installs it as `agentinbox`. The conversation commands stand alone: `list`, `show`, `read`, `resolve`, `send`, `reply`. `contact` and `channel` take an action, as in `contact list`. The rest are `setup`, `login`, `connect` and `listen`.

How an agent uses the conversation and `contact` commands to ask people things and answer conversations is the agentinbox skill. This skill is about getting the CLI working on a computer or in automation.

## Who runs what

- **The operator** (the person the agent works for) runs `setup`, `login` and `channel add`, or asks an agent to set up for them, and changes settings on agentinbox.md: who can reach the agent, whose messages start a run (**Listen to**), pausing it, the API key.
- **An agent** runs the conversation and `contact` commands, and `connect` with a one-time code the operator gave it.
- An agent may run `setup` (with `--email` and `--name`) and `login` when its operator asks it to, and the operator approves the login on agentinbox.md. See "Set up for your operator".
- An agent may run `listen claude-code` when its operator asks it to, and the operator allows it on their channel. See "Listen for messages".
- An agent never asks for a Telegram bot token or a Slack token. When the host refuses to save the key, tell the operator the command to run instead.

## Set up an inbox

```bash
npx @agentinbox/cli setup                 # name, email, the agent's address; then offers Telegram or Slack
npx @agentinbox/cli setup telegram        # or slack: set up and connect that channel
npx @agentinbox/cli channel add slack     # one more channel later: telegram, slack or email
npx @agentinbox/cli channel list          # what's connected, and your default
npx @agentinbox/cli login                 # keep the setup in an Agent Inbox account
```

- `setup` asks for a name and an email address, creates the agent's inbox and prints its address. Enter skips the channel question. Running it again resumes whatever step is left.
- Without a terminal, pass the answers as flags: `--name "Ada Lovelace" --email ada@example.com --agent-name "Deploy bot"`. The rest are in [references/commands.md](references/commands.md).
- On a terminal, `channel add telegram` or `slack` asks whether to paste a token there or finish on a page. Without a terminal it prints a page link (`https://www.agentinbox.md/connect#…`, or `connect?channel=slack#…` for Slack) and waits up to 15 minutes while the person creates the bot with @BotFather and taps Start (Telegram), or pastes an App Configuration Token and clicks Add to Slack. Forward that link exactly. Exit `11` means they didn't finish in time; nothing is broken, and running the same command again resumes at the missing step.
- At the end, `setup` shows how to teach coding agents: `npx skills add agentinboxhq/skills`. Without a terminal it installs nothing unless it gets `--agent` and `-y`, such as `npx skills add agentinboxhq/skills --agent codex -y`; Hermes and OpenClaw also take `-g` (`--agent hermes-agent` or `--agent openclaw`).

### Keyless setup and login

`setup` without an account makes a **keyless setup**: a free demo with a small message allowance. Its email inbox can receive but sends nothing until the operator claims it. When the allowance runs out, commands exit `1` with "You've used the 5 free messages of this keyless demo." and a sign-up link.

`login` opens agentinbox.md, where the operator checks that the page shows the same code as the terminal and approves. The keyless setup moves into the account and its channels keep working. The CLI saves the key in `~/.agentinbox/config.json`.

### Set up for your operator

Only when the operator asks you to. Ask them for the name and email address to use; never make either up.

```bash
npx @agentinbox/cli setup --name "Ada Lovelace" --email ada@example.com
npx @agentinbox/cli login
```

1. `setup` makes a keyless setup with the agent's inbox, then emails a confirmation link to that address and waits up to 5 minutes for it to be opened, so tell the operator to open it now. If it stops first, run it again: it keeps the same inbox and sends a new link. Add `--agent-name` only if they named the agent.
2. `login` prints a link to agentinbox.md and a code, and waits up to an hour. Give the operator both: they sign in or sign up there, check that the page shows the same code, and approve. The keyless setup moves into their account. If the command stopped before they approved, run it again for a new code.
3. Telegram and Slack stay with the operator: they add them on agentinbox.md, or run `npx @agentinbox/cli channel add telegram` (or `slack`) in their own terminal.

Both commands wait for the operator, so give them time: run them in the background or with a long timeout if your host stops commands after a few minutes. Both save the key in `~/.agentinbox/config.json`. When the host refuses to save it there, or to run the command at all, don't look for a way around that: tell the operator the command to run in their own terminal.

## Connect this computer with a one-time code

The operator copies a one-time code on agentinbox.md, and the computer that should act as the agent runs:

```bash
npx @agentinbox/cli connect atlas --code BCDF-GHJK
```

- `atlas` is the agent's address before the `@`. The code works once, for 10 minutes. A used, expired or wrong code exits `1` and says which; ask for a new code instead of guessing, because the agent stops taking codes for a while after a few wrong ones.
- Keep `--api-url` when the command has it: a code only works on the API that made it.
- When this computer already has a setup, `connect` stops and asks before replacing it, and without a terminal it needs `--yes`. Commands copied from agentinbox.md already have `--yes`, because the operator wrote them. Otherwise tell the operator first, and add `--yes` only once they agree.
- After `connect`, every command on this computer acts as that agent. Check with `npx @agentinbox/cli list`.
- For Claude Code, `connect` ends by offering `listen claude-code` as an optional last step. Run it only when the operator wants a message to start Claude Code on this computer; see "Listen for messages".

## Listen for messages

Claude Code reads the inbox only while someone runs it. `listen` changes that: when the operator, or a contact they chose, writes to the agent, Claude Code starts on this computer, in the project, and answers in the conversation. Each start for a message is a **run**. Claude Code is the only host it starts for now.

```bash
npx @agentinbox/cli listen claude-code   # in the project folder: asks the operator, then listens in the background
npx @agentinbox/cli listen status        # where the agent listens, what this computer does, where the log is
npx @agentinbox/cli listen stop          # stop listening on this computer
```

- Run it in the project folder, and only when the operator asks for it. Every run starts Claude Code in that folder.
- **It asks first.** At a terminal, the person answers there. When an agent runs it, the operator gets an Allow/Deny message on their channel, and nothing listens until they allow it. The command waits until that question expires, in an hour; `--timeout 10m` stops sooner with exit `11`, and running the same command again goes on waiting for the same answer. Deny exits `10`, an expired question `12`. Tell the operator the question is waiting; never answer it for them or look for a way around it.
- **Whose messages start a run.** The operator's always do. A contact's do only once the operator turns on **Listen to** for them, on agentinbox.md under Contacts; it's off by default. A stranger's never do. An answer to a question the agent asked is different: it comes back to the conversation it was asked in, from whoever was asked.
- **What it needs.** Claude Code installed and signed in on this computer: runs use the operator's own Claude Code and plan. An Agent Inbox account: a keyless setup can't listen, so `login` first. And the connection that `setup`, `login` or `connect` saved on this computer: `listen` ignores `INBOX_SECRET_KEY` and `INBOX_API_URL`.
- **Background or foreground.** It listens in the background, and again after a restart: a launchd agent on macOS, a systemd user service on Linux, and on Windows inside WSL. On Linux, `loginctl enable-linger` keeps it listening while the operator is logged out. `--foreground` listens in that terminal only, until Ctrl-C, and only one can run on a computer. Don't use it to keep listening from your own shell: it ends with that shell.
- **One computer at a time.** `listen` on another computer asks the operator to move it there. On the same computer, for another project, it replaces the one running. `listen stop` stops this computer's listener, a foreground one too, and leaves another computer's alone. agentinbox.md shows where it listens, such as "Listening on MacBook (Claude Code)".
- **What the operator is asked during a run.** Claude Code follows its own settings for the project and may edit files inside it, and its own reading and answering in that conversation never asks. Anything else is an Allow/Deny message in the operator's chat, with `--foreground` too, even when a contact's message started the run: a command its settings don't allow, the network, files outside the project, writing to anyone else. **Allow for this session** lets the same request through until the session ends, and changes no settings. No answer in 10 minutes counts as Deny. A project Claude Code hasn't been opened in yet doesn't get its own allow list (`.claude/settings.json`) until the operator opens Claude Code there once and trusts the folder; `listen` says so.
- **Limits.** `--runs-per-hour` (default 20) and `--max-run` (default 30m). Messages over the hourly limit wait, and a run that goes on too long stops and says so in the conversation.

What each subcommand prints, how sessions work, and when it stops by itself are in [references/commands.md](references/commands.md).

## CI, containers and sandboxes

Where there is no config file, the CLI runs on environment variables alone:

| Variable | Meaning |
|---|---|
| `INBOX_SECRET_KEY` | The API key, from Settings on agentinbox.md. Takes priority over `login` and `setup` |
| `INBOX_TO` | Who a send without `--to` reaches: contact ids, comma-separated like `--to` (max 50) |
| `INBOX_VIA` | Default channel for `INBOX_TO`: `telegram`, `slack` or `email`. Ignored when `--to` names someone else |
| `INBOX_API_URL` | API URL. Default `https://www.agentinbox.md/api` |
| `INBOX_CONFIG` | Config file path. Default `~/.agentinbox/config.json` |

Flags beat environment variables, which beat the config file. Environment values are never written back to the file. `listen` is the exception: it uses only the connection saved in the file.

To make a pipeline step wait for a person, ask and let the exit code decide:

```yaml
# GitHub Actions: the step fails unless someone approves within 30 minutes
- name: Ask before deploying
  env:
    INBOX_SECRET_KEY: ${{ secrets.INBOX_SECRET_KEY }}
    INBOX_TO: alice
  run: npx @agentinbox/cli send approve "Deploy ${{ github.sha }} to production?" --ttl 1h --timeout 30m --from ci
```

Keep the key in the CI system's secret store, never in the repository or a command line others can read.

## Exit codes

Scripts branch on these, never on the printed text:

| Code | Meaning |
|---|---|
| `0` | answered, approved, chosen or delivered |
| `10` | denied |
| `11` | timed out waiting; the question stays open and the answer shows up in the conversation |
| `12` | expired or canceled |
| `1` | error |

## Errors and what to do

| The CLI prints | What to do |
|---|---|
| `No inbox set up yet. Ask your operator to run: npx @agentinbox/cli setup (or set INBOX_SECRET_KEY + INBOX_TO).` | Pass the message on. The operator runs `setup` or `connect`, asks you to set up for them, or gives the job `INBOX_SECRET_KEY` and `INBOX_TO`. Don't set it up unasked |
| `You've used the 5 free messages of this keyless demo.` | Stop retrying. `login` claims the setup: the operator runs it, or asks you to and approves it on agentinbox.md |
| `Outbound email needs an Agent Inbox account.` | A keyless setup can't send email until `login` claims it, run by the operator or, when they ask, by you |
| `This agent is paused: …` | The operator paused it on agentinbox.md on purpose. Stop retrying until they resume it |
| A used, expired or wrong code | Ask the operator for a new one-time code |
| No linked channel for a contact | Invite them: `contact invite <id> --name "…"`, then send again once they've connected |
| Listening needs an Agent Inbox account (`listen_needs_account`) | A keyless setup can't listen. `login` claims it, run by the operator or, when they ask, by you; then run `listen` again |
| Another computer listens for the agent (`listening_elsewhere`) | So this computer stopped listening, or didn't start. `listen status` says where the agent listens now. `listen claude-code` here moves it back only once the operator allows it. To stop the other one, run `listen stop` on that computer |
| This computer isn't listening for the agent (`not_listening`) | It went quiet for a few minutes, say while it slept, or another computer took over. A running listener tries again by itself and stops if another computer listens now; `listen status` says which |
| `The key changed on agentinbox.md. Connect again, then listen again.` (`key_changed`) | The operator regenerated the key, so the listener stopped for good. Connect again with a new one-time code or `login`, then run `listen` again |
| Connected anew since listening was turned on (`connection_changed`) | This computer was connected anew, such as with `connect`, `login` or `setup`, so the listener stopped and runs nothing left for the old connection. Run `listen claude-code` again, and the operator allows it again |
| Claude Code isn't installed, or isn't signed in (`host_missing`) | Pass it on: the operator installs Claude Code and runs `claude` once to sign in, then `listen` again |

Why a listener stopped is also in `listen status --json`, as `thisComputer.stopped.reason`: `key_changed`, `listening_elsewhere`, `host_missing` or `connection_changed`.

## Your own deployment

A self-hosted Agent Inbox dashboard is reached through its own `/api`, not through another product's API:

```bash
npx @agentinbox/cli setup --secret-key <key> --api-url https://your-dashboard.example/api
# or
export INBOX_SECRET_KEY=<key> INBOX_API_URL=https://your-dashboard.example/api
```

`listen` needs the first way, since it ignores the variables. The hosted MCP server is for Agent Inbox cloud only and doesn't follow this URL.

## More detail

[references/commands.md](references/commands.md) lists every flag of `setup`, `login`, `connect`, `channel` and `listen`, what `listen` does on each system and when it stops by itself, and the settings for how the terminal screen looks. Read it when you need a flag that isn't shown here.
