# The Agent Inbox MCP tools

Chat apps such as ChatGPT and Claude, and some coding agents, reach Agent Inbox through its hosted MCP server instead of the CLI. With these tools you are already signed in, so there is nothing to set up on this computer, and the CLI's "No inbox set up yet" doesn't apply. If the account has no agent yet, the tools say so, and `inbox_setup` sets it up (see "Setting up from the chat"). The client may show the tools with the server's name in front, such as `mcp__inbox__inbox_send`.

Everything in the skill holds; only the way you call it changes.

## Contents

- From a command to a tool
- How a result reads
- Waiting for an answer
- Setting up from the chat
- Tool arguments
- What the tools can't do

## From a command to a tool

| CLI | MCP tool |
|---|---|
| `setup` (the agent and its email inbox) | `inbox_setup` with `agent_name` and `handle`, then `email` |
| `inbox send <text>` | `inbox_send` without a `kind` |
| `inbox send ask\|approve\|choose <text>` | `inbox_send` with `kind` set to `ask`, `approve` or `choose` |
| `inbox reply <conversation> …` | `inbox_reply` with `conversation`, and `kind` the same way |
| `inbox list`, `show`, `read`, `resolve` | `inbox_list`, `inbox_show`, `inbox_read`, `inbox_resolve` |
| `contact list --after <next>` | `contact_list` with `after` |
| `contact invite <id> --name "…"` | `contact_invite` with `id` and `name` |
| `--to`, `--via`, `--from`, `--option`, `--anyone`, `--ttl 2h` | `to`, `via`, `from`, `options`, `anyone_may_answer`, `ttl_seconds: 7200` |
| `inbox list --wait --timeout 25s` | `inbox_list` with `wait_seconds: 25` (25 at most) |

Before you send, call `inbox_list` with `filter: "unread"`. Someone may already have written to you, and you should reply in that conversation instead of starting a new one.

## How a result reads

There are no exit codes. The result says what happened in words:

| Result | What to do |
|---|---|
| `Approved`, `Answered` (with what they said), `Delivered` | Go on |
| `Denied` | Stop: don't go ahead |
| expired, or canceled | Treat it as not approved |
| the request is still open, with an id | Call `inbox_wait` with that id |
| Agent Inbox is not set up yet | The account has no agent: see "Setting up from the chat" |

A plain message (no `kind`) returns `Delivered` as soon as delivery is confirmed.

## Waiting for an answer

A tool call can't wait as long as the CLI does. `inbox_send` and `inbox_reply` wait 45 seconds by default and 50 at most (`wait_seconds`). If nobody has answered by then, the result says the request is still open and gives its id. Call `inbox_wait` with that id, and again for as long as it says the same. Never go ahead without the answer.

`wait_seconds` only applies to `ask`, `approve` and `choose`; a plain message with it is rejected.

## Setting up from the chat

Someone can connect an app before they have an agent. Then the tools say that Agent Inbox is not set up yet, and `inbox_setup` creates the agent and its email inbox from the chat:

1. Call `inbox_setup` with no arguments. It says how far setup got, and may suggest the email the person signed in with.
2. Ask the person what to call the agent and which inbox address it gets: the part before the `@`, such as `atlas`, in letters, digits and hyphens. Never pick them yourself. Call `inbox_setup` with `agent_name` (up to 60 characters) and `handle` (up to 32) together.
3. Confirm their email address with them, suggested or not, then call `inbox_setup` with `email`. A confirmation link goes to that address. Until they open it, `inbox_send` without `to` can't email them.
4. When they say they've opened it, call `inbox_setup` with no arguments to check.

A name never renames an existing agent, and a handle never moves an existing mailbox; `handle` alone finishes a mailbox that wasn't created. An email address that's already confirmed changes on agentinbox.md, not with this tool.

## Tool arguments

**`inbox_send`** starts a conversation:

| Argument | Meaning |
|---|---|
| `message` | The main text. Required |
| `kind` | `ask`, `approve` or `choose`. Leave it out for a plain message |
| `to` | A contact id, an email address, or up to 50 of them. Leave it out to reach your operator |
| `via` | `telegram`, `slack` or `email`, instead of each contact's default channel |
| `from` | The label the person sees, such as `deploy-bot` |
| `ttl_seconds` | How long a question stays answerable: default 86400, min 60, max 432000 |
| `wait_seconds` | How long to wait now: default 45, max 50. Questions only |
| `options` | `choose` only: 2 to 10 labels, or objects with a stable `id` and a `label` |
| `approve_label`, `deny_label` | `approve` only: the button labels |
| `extra_actions` | `approve` only: up to 4 more buttons |
| `subtitle`, `body` | Card text under the message |
| `icon` | Slack only: a catalog id, a display name, or an https URL |

**`inbox_reply`** sends into an existing conversation. It takes the same arguments except `via`, plus:

| Argument | Meaning |
|---|---|
| `conversation` | The conversation id (`conv_...`) from `inbox_list`. Required |
| `anyone_may_answer` | Anyone in the conversation may answer, strangers included. Not together with `to` |

A reply goes out on the conversation's own channel.

**`inbox_wait`** takes the `id` from an earlier result, and `wait_seconds` (default 45, max 50).

**`inbox_list`**:

| Argument | Default |
|---|---|
| `filter` | `all`; or `unread`, `read` |
| `status` | `open`; or `resolved`, `all` |
| `senders` | `contacts`; `all` includes strangers |
| `limit` | 20, max 100 |
| `after` | The cursor from the previous page |
| `wait_seconds` | 0. Holds until a conversation matches, 25 at most |

**`inbox_show`** takes `conversation` (required), `limit` (20, max 100) and `before`, a message id for older pages. It doesn't mark the conversation read. People and messages are labeled contact or stranger.

**`inbox_read`** and **`inbox_resolve`** take `conversation`. Neither sends anything. A resolved conversation opens again when anyone writes in it.

**`contact_list`** takes `limit` (50, max 100) and `after`. Each line is a contact (id, name, email), and your operator is marked `(you)`. When the result ends with a cursor, call it again with `after` before you decide someone isn't there.

**`contact_invite`** takes `id` (a short id such as `alice`, which you later pass as `to`) and `name`. It returns a link and sends nothing: give the link to the operator to pass on. It takes no channel. To reach someone by email, put the address in `to` on `inbox_send`: a new address on a send is delivered as typed, while a reply still needs a contact that already verified that address.

## What the tools can't do

There are no tools for `login`, `connect` or `channel`. Those happen on agentinbox.md or with the CLI on a computer (the agentinbox-cli skill says who runs which), and Telegram and Slack are set up there too.

When the operator has paused the agent on agentinbox.md, every tool returns an error that says so. Stop retrying and tell whoever you can reach; messages people send meanwhile wait in the inbox.
