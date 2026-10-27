# Setup, login, connect, channel and listen commands

Every flag of the commands that set Agent Inbox up. Commands start with `npx @agentinbox/cli`. The `inbox` and `contact` commands are in the agentinbox skill.

## Contents

- `setup`
- `login`
- `connect`
- `channel list`, `channel add`, `channel default`
- `listen`, `listen status`, `listen stop`
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
| `--email <address>` | The operator's email address, for the email channel. Skips the question. Without a terminal, a keyless setup needs it |
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

Opens agentinbox.md, where the operator signs in or signs up, checks that the page shows the same code as the terminal, and approves. Deny on that page stops the login. It also prints the link and the code, for when the browser opens somewhere the operator can't see, and waits up to an hour. A keyless setup made on this computer moves into the account, and its channels keep working. Afterwards the operator's contact in the account is who a send without `--to` reaches.

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

## listen, listen status, listen stop

```bash
npx @agentinbox/cli listen claude-code [--foreground] [--timeout <duration>] [--runs-per-hour <n>] [--max-run <duration>]
npx @agentinbox/cli listen status [--json]
npx @agentinbox/cli listen stop
```

`listen claude-code` listens for messages to the agent on this computer, for the folder it runs in. A message from the operator, or from a contact they turned on **Listen to** for, starts Claude Code there for that conversation: a run. Claude Code is the only host for now.

| Flag | Meaning |
|---|---|
| `--foreground` | Listen in this terminal only, until Ctrl-C, instead of in the background. One foreground listener per computer |
| `--timeout <duration>` | When an agent runs it: how long to wait for the operator's Allow. Default: until the question expires, in an hour. Exits `11` when it runs out |
| `--runs-per-hour <n>` | How many runs may start in an hour. Default 20 |
| `--max-run <duration>` | How long one run may go on, such as `30m` or `2h`. Default 30m |
| `--json` | `listen status` only: print JSON |

- **Asking first.** At a terminal, the person answers there. Without one, the operator gets an Allow/Deny message on their channel that names the computer and the folder, and says so when it moves the listener from another computer. The exit codes are those of `approve`: `0` listening, `10` denied, `11` still waiting (the same command run again goes on waiting for the same answer), `12` the question expired, `1` an error. When this computer already listens for the same host and folder, it says so and exits `0` without asking.
- **Where it runs.** On macOS, a launchd agent for the user, `md.agentinbox.listen`, listed as `agentinbox-listen` in System Settings › General › Login Items & Extensions. On Linux, a systemd user service, `agentinbox-listen.service`; `loginctl enable-linger` keeps it running while the user is logged out. On Windows, it runs inside WSL: as that systemd user service once systemd is on there (`[boot] systemd=true` in `/etc/wsl.conf`), or with `--foreground` until then. It starts again after a restart or a crash, but not after it stopped on purpose. Its log is `listen.log` in a `listen` folder next to the config file: `~/.agentinbox/listen/listen.log` by default.
- **Sessions.** Each conversation gets one Claude Code session. The next message in it goes on with that session until the conversation is resolved; after that, the next message starts a fresh one. A message that comes during a run joins it, and so does an answer to one of the agent's questions that no waiting command of the run takes, such as an `--async` one or one whose command timed out. An answer comes back to the conversation its question was asked in, whoever gave it, also someone outside it asked with `--to`; with no session here for that conversation, another host asked, and it starts nothing. `/stop` in the conversation stops its run. A message cut off by a restart isn't run again; the conversation is told instead. Messages older than a day never start a run.
- **Questions.** A permission always goes to the operator's chat as an Allow/Deny message, with `--foreground` too; only the question that turns listening on can be answered in the terminal. A question Claude Code asks that isn't a permission, such as which of two options to take, goes to the person who wrote, in the conversation.
- **Limits.** Messages over `--runs-per-hour` wait, and the operator hears about it once an hour. A run that goes on longer than `--max-run` stops, and the conversation is told to send another message to go on.
- **`listen status`** says where the agent listens (agentinbox.md shows it too, such as "Listening on MacBook (Claude Code)"), what this computer does, how many conversations have a session, and where the log is. With `--json`, `listening` is where the agent listens (`null` when nowhere), `thisComputer.listeningHere` whether that's this computer, `thisComputer.stopped.reason` why this computer stopped, and `thisComputer.lastRunAt` when a run last started here.
- **`listen stop`** stops listening on this computer, a foreground listener included. It leaves another computer alone, and says so when the agent listens there. Sessions stay until their conversations are resolved. `listen status` and `listen stop` both work while the agent is paused.

**When it stops by itself**, `listen status` says why, and `thisComputer.stopped.reason` in its JSON is one of these:

| Reason | What happened, and what to do |
|---|---|
| `key_changed` | The operator regenerated the key on agentinbox.md. It says "The key changed on agentinbox.md. Connect again, then listen again." and doesn't retry |
| `listening_elsewhere` | Another computer took over. `listen status` says which. Running `listen claude-code` here asks the operator to move it back |
| `host_missing` | Claude Code was gone or signed out when the listener started again. Once it's installed and signed in, run `listen claude-code` again |
| `connection_changed` | This computer was connected anew since listening was turned on, such as with `connect`, `login` or `setup`, so it runs nothing left for the old connection. Run `listen claude-code` again |

While the agent is paused, it doesn't stop: it waits, and runs start again once the operator resumes it.

`listen run` is what the background service starts. Don't run it yourself.

## Config file and precedence

- `login`, `connect` and `setup` save to `~/.agentinbox/config.json`. `INBOX_CONFIG` moves it.
- Precedence is always flags, then environment variables, then the config file. `INBOX_SECRET_KEY` wins over a saved login.
- `listen` is the exception: it uses only the connection saved in the config file, never `INBOX_SECRET_KEY` or `INBOX_API_URL`.
- `INBOX_API_URL` (or `--api-url`) points at an Agent Inbox dashboard's `/api`, such as `http://localhost:4300/api` locally. The default is `https://www.agentinbox.md/api`.

## How the terminal screen looks

On a terminal, `setup`, `login`, `connect`, `channel add` and `listen claude-code` draw one screen and update it in place: the agent's mascot, the command, the steps done, and what it's waiting for. Pipes, CI, `NO_COLOR`, `FORCE_COLOR=0`, `TERM=dumb` and terminals narrower than 48 columns get plain text instead, so what agents read stays the same. `inbox`, `contact`, `listen status` and `listen stop` always print plain text.

| Variable | Effect |
|---|---|
| `AGENTINBOX_NO_ANIMATION=1` | Holds the screen still: no blinking and no spinner |
| `AGENTINBOX_THEME=light` or `dark` | Says whether the terminal background is light or dark, where the terminal can't be asked |
| `AGENTINBOX_MASCOT_ASPECT=1.2` | How tall a row of braille dots is for a dot's width, when the mascot comes out oval |
