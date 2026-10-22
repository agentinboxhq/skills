# Setup, login, connect and channel commands

Every flag of the commands that set Agent Inbox up. Commands start with `npx @agentinbox/cli`. The `inbox` and `contact` commands are in the agent-inbox skill.

## Contents

- `setup`
- `login`
- `connect`
- `channel list`, `channel add`, `channel default`
- Config file and precedence
- How the terminal screen looks

## setup

```bash
npx @agentinbox/cli setup [telegram|slack|email]
```

Creates the agent's inbox without an account (a keyless setup), or in the account the computer is logged in to, then offers to connect Telegram or Slack. `email` verifies the operator's address on an account.

| Flag | Meaning |
|---|---|
| `--name <name>` | The operator's first and last name, shown to people they invite. Skips the question |
| `--email <address>` | The operator's email address, for the email channel. Skips the question |
| `--agent-name <name>` | What the agent is called, as people see it |
| `--agent-description <text>` | A line about what the agent does, shown with its name |
| `--agent-picture <file-or-url>` | A JPEG or PNG of up to 2 MB. Needs `login` first |
| `--telegram-bot-token <token>` | The BotFather token. Skips the paste-or-page question |
| `--slack-config-token <token>` | A Slack App Configuration Token (`xoxe.xoxp-…`). Skips the paste-or-page question |
| `--secret-key <key>` | Use an existing environment instead of a keyless one (self-hosted) |
| `--agent-identifier <identifier>` | The relay agent's identifier, `human-relay` by default. Rarely needed |
| `--api-url <url>` | API URL override |

The token flags are for the operator's own scripts. An agent never asks anyone for a token.

## login

```bash
npx @agentinbox/cli login [--api-url <url>]
```

Opens agentinbox.md, where the operator signs in or signs up, checks that the page shows the same code as the terminal, and approves. Deny on that page stops the login. A keyless setup made on this computer moves into the account, and its channels keep working. Afterwards the operator's contact in the account is who a send without `--to` reaches.

## connect

```bash
npx @agentinbox/cli connect <agent> --code <code> [--yes] [--api-url <url>]
```

| Flag | Meaning |
|---|---|
| `<agent>` | The agent's address before the `@`, such as `atlas` |
| `--code <code>` | Required. The one-time code from agentinbox.md, such as `BCDF-GHJK`. It works once, for 10 minutes |
| `--yes` | Replace a setup already on this computer without asking |
| `--api-url <url>` | The API the code came from. Keep it when the command has it |

`login` and `connect` leave the same key on the computer. In `login` the terminal shows the code and the operator types it on agentinbox.md; in `connect` agentinbox.md shows the code and the host types it.

## channel list, channel add, channel default

```bash
npx @agentinbox/cli channel list [--json]
npx @agentinbox/cli channel add <telegram|slack|email> [--telegram-bot-token <token>] [--slack-config-token <token>] [--email <address>]
npx @agentinbox/cli channel default <telegram|slack|email>
```

- `channel list` shows the channels the operator connected and marks the default.
- `channel add` connects one more channel. Telegram is a private bot only the operator controls: they create it with @BotFather and tap Start. Slack needs an App Configuration Token and an Add to Slack click. Email registers the operator's address; approvals arrive as emails with buttons, and questions are answered by replying.
- `channel default` sets where the operator's own messages land when a send has no `--via`. It's saved on this computer. Other people keep their own default.

## Config file and precedence

- `login`, `connect` and `setup` save to `~/.agentinbox/config.json`. `INBOX_CONFIG` moves it.
- Precedence is always flags, then environment variables, then the config file. `INBOX_SECRET_KEY` wins over a saved login.
- `INBOX_API_URL` (or `--api-url`) points at an Agent Inbox dashboard's `/api`, such as `http://localhost:4300/api` locally. The default is `https://www.agentinbox.md/api`.

## How the terminal screen looks

On a terminal, `setup`, `login`, `connect` and `channel add` draw one screen and update it in place: the agent's mascot, the command, the steps done, and what it's waiting for. Pipes, CI, `NO_COLOR`, `FORCE_COLOR=0`, `TERM=dumb` and terminals narrower than 48 columns get plain text instead, so what agents read stays the same. `inbox` and `contact` always print plain text.

| Variable | Effect |
|---|---|
| `AGENTINBOX_NO_ANIMATION=1` | Holds the screen still: no blinking and no spinner |
| `AGENTINBOX_THEME=light` or `dark` | Says whether the terminal background is light or dark, where the terminal can't be asked |
| `AGENTINBOX_MASCOT_ASPECT=1.2` | How tall a row of braille dots is for a dot's width, when the mascot comes out oval |
