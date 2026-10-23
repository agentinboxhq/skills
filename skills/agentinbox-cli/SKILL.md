---
name: agentinbox-cli
description: Sets up and scripts the Agent Inbox CLI, `npx @agentinbox/cli`, covering setup, login, connecting a computer with a one-time code, adding Telegram, Slack or email, environment variables for CI, containers and sandboxes, exit codes in shell scripts, and the errors the CLI prints. Use when someone wants to set up Agent Inbox, connect this computer or a CI job to an agent, add a channel, make a pipeline step wait for a person's approval, or when an `npx @agentinbox/cli` command fails because no inbox is set up, the keyless demo is used up, the agent is paused, or a code is wrong. Not for deciding what to ask people or how to answer conversations (agentinbox), or for connecting a chat app through MCP (agentinbox-mcp).
license: MIT
compatibility: Needs Node.js for npx, and network access to agentinbox.md.
---

# Agent Inbox CLI

`npx @agentinbox/cli` runs the CLI with nothing installed first; `npm install -g @agentinbox/cli` installs it as `agentinbox`. Every command is `<command> <action>`: `setup`, `login`, `connect`, `inbox`, `contact`, `channel`.

How an agent uses `inbox` and `contact` to ask people things and answer conversations is the agentinbox skill. This skill is about getting the CLI working on a computer or in automation.

## Who runs what

- **The operator** (the person the agent works for) runs `setup`, `login` and `channel add`, and changes settings on agentinbox.md: who can reach the agent, pausing it, the API key.
- **An agent** runs `inbox` and `contact` commands, and `connect` with a one-time code the operator gave it.
- An agent never runs `setup` or `login` for the operator, and never asks for a Telegram bot token or a Slack token. When a step needs the operator, tell them what to run.

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
- At the end, `setup` shows how to teach coding agents: `npx skills add agentinboxhq/skills`.

### Keyless setup and login

`setup` without an account makes a **keyless setup**: a free demo with a small message allowance. Its email inbox can receive but sends nothing until the operator claims it. When the allowance runs out, commands exit `1` with "You've used the 5 free messages of this keyless demo." and a sign-up link.

`login` opens agentinbox.md, where the operator checks that the page shows the same code as the terminal and approves. The keyless setup moves into the account and its channels keep working. The CLI saves the key in `~/.agentinbox/config.json`.

## Connect this computer with a one-time code

The operator copies a one-time code on agentinbox.md, and the computer that should act as the agent runs:

```bash
npx @agentinbox/cli connect atlas --code BCDF-GHJK
```

- `atlas` is the agent's address before the `@`. The code works once, for 10 minutes. A used, expired or wrong code exits `1` and says which; ask for a new code instead of guessing, because the agent stops taking codes for a while after a few wrong ones.
- Keep `--api-url` when the command has it: a code only works on the API that made it.
- When this computer already has a setup, `connect` stops and asks before replacing it, and without a terminal it needs `--yes`. Commands copied from agentinbox.md already have `--yes`, because the operator wrote them. Otherwise tell the operator first, and add `--yes` only once they agree.
- After `connect`, every command on this computer acts as that agent. Check with `npx @agentinbox/cli inbox list`.

## CI, containers and sandboxes

Where there is no config file, the CLI runs on environment variables alone:

| Variable | Meaning |
|---|---|
| `INBOX_SECRET_KEY` | The API key, from Settings on agentinbox.md. Takes priority over `login` and `setup` |
| `INBOX_TO` | Who a send without `--to` reaches: contact ids, comma-separated like `--to` (max 50) |
| `INBOX_VIA` | Default channel for `INBOX_TO`: `telegram`, `slack` or `email`. Ignored when `--to` names someone else |
| `INBOX_API_URL` | API URL. Default `https://www.agentinbox.md/api` |
| `INBOX_CONFIG` | Config file path. Default `~/.agentinbox/config.json` |

Flags beat environment variables, which beat the config file. Environment values are never written back to the file.

To make a pipeline step wait for a person, ask and let the exit code decide:

```yaml
# GitHub Actions: the step fails unless someone approves within 30 minutes
- name: Ask before deploying
  env:
    INBOX_SECRET_KEY: ${{ secrets.INBOX_SECRET_KEY }}
    INBOX_TO: alice
  run: npx @agentinbox/cli inbox send approve "Deploy ${{ github.sha }} to production?" --ttl 1h --timeout 30m --from ci
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
| `No inbox set up yet. Ask your operator to run: npx @agentinbox/cli setup (or set INBOX_SECRET_KEY + INBOX_TO).` | The operator runs `setup` or `connect`, or the job gets `INBOX_SECRET_KEY` and `INBOX_TO`. Pass the message on; don't set it up for them |
| `You've used the 5 free messages of this keyless demo.` | Stop retrying. The operator runs `login`, or signs up from the link and then runs `login` |
| `Outbound email needs an Agent Inbox account.` | A keyless setup can't send email. The operator runs `login` to claim it |
| `This agent is paused: …` | The operator paused it on agentinbox.md on purpose. Stop retrying until they resume it |
| A used, expired or wrong code | Ask the operator for a new one-time code |
| No linked channel for a contact | Invite them: `contact invite <id> --name "…"`, then send again once they've connected |

## Your own deployment

A self-hosted Agent Inbox dashboard is reached through its own `/api`, not through another product's API:

```bash
npx @agentinbox/cli setup --secret-key <key> --api-url https://your-dashboard.example/api
# or
export INBOX_SECRET_KEY=<key> INBOX_API_URL=https://your-dashboard.example/api
```

The hosted MCP server is for Agent Inbox cloud only and doesn't follow this URL.

## More detail

[references/commands.md](references/commands.md) lists every flag of `setup`, `login`, `connect` and `channel`, and the settings for how the terminal screen looks. Read it when you need a flag that isn't shown here.
