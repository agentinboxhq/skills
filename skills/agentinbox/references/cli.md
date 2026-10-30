# Conversation and contact commands

Every flag of the commands an agent uses, and what `--json` prints. Commands start with `npx @agentinbox/cli`.

## Contents

- `list`
- `show`, `read`, `resolve`
- `send` and `reply`
- Cards and buttons
- What `--json` prints
- `contact list` and `contact invite`
- In a run that `listen` started

## list

Open conversations with contacts, newest first, unless you filter.

| Flag | Default and meaning |
|---|---|
| `--filter unread\|read\|all` | `all` |
| `--status open\|resolved\|all` | `open` |
| `--senders contacts\|all` | `contacts`. `all` includes conversations with strangers |
| `--wait` | Block until a conversation matches the filters. Alone it waits forever |
| `--timeout <duration>` | With `--wait`: how long to block. When it runs out, the command prints an empty page and exits `11` |
| `--limit <n>` | 20, max 100 |
| `--after <cursor>` | Continue from the `next` cursor of the previous page |
| `--json` | Print `{ data, next }` |

## show, read, resolve

```bash
npx @agentinbox/cli show conv_123 [--limit <n>] [--before <messageId>] [--json]
npx @agentinbox/cli read conv_123
npx @agentinbox/cli resolve conv_123
```

- `show` lists messages oldest first: 20 by default, max 100. `--before` pages to older messages. It doesn't mark the conversation read.
- `read` marks the conversation read. Nothing is sent.
- `resolve` marks it finished. Nothing is sent, and it opens again when anyone writes in it.

## send and reply

```bash
npx @agentinbox/cli send [ask|approve|choose] <text...>
npx @agentinbox/cli reply <conversation> [ask|approve|choose] <text...>
```

| Flag | Meaning |
|---|---|
| `--to <id\|email>` | A contact, or comma-separated contacts (max 50; the first valid answer wins). On `send` the default is `INBOX_TO`, then your operator. On `reply` it limits who may answer; one who isn't in a direct conversation gets the question in their own chat too, and the answer comes back to the conversation |
| `--via <channel>` | `send` only: `telegram`, `slack` or `email` instead of each contact's default channel |
| `--anyone` | `reply` only: anyone in the conversation may answer, strangers included. Not with `--to` |
| `--from <name>` | The label the person sees, such as `deploy-bot` |
| `--ttl <duration>` | How long a question stays answerable: default 24h, max 5d |
| `--timeout <duration>` | How long this command waits. Default: until answered or expired. On timeout it exits `11` |
| `--async` | Return at once instead of waiting |
| `--json` | Print the full result instead of prose |

Durations look like `90s`, `10m`, `2h` or `1d`.

`--to` takes contact ids from `contact list`, or an email address. With an Agent Inbox account, a new conversation goes to the address as typed. A reply needs a contact that already confirmed that address.

## Cards and buttons

| Flag | Meaning |
|---|---|
| `--subtitle <text>`, `--body <text>` | Card text under the message. A plain message becomes a card when one of these, or `--icon`, is set |
| `--icon <id-or-url>` | Slack only: an MCP catalog id such as `stripe`, or an https URL (32×32). Other channels ignore it |
| `--approve-label <text>`, `--deny-label <text>` | `approve` only: the button labels |
| `--extra-action <spec>` | `approve` only: another button, as `id:label` or a label. Repeatable |
| `--option <label>` | `choose` only: one option, 2 to 10. `id:label` keeps a stable id, such as `--option stg:Staging` |

```bash
npx @agentinbox/cli send approve "Issue the refund?" \
  --icon stripe \
  --subtitle "issue_refund: ORD-42" \
  --body 'Refund $25.00' \
  --extra-action trust-tool:"Always allow this tool"

npx @agentinbox/cli send choose "Which environment?" \
  --option stg:Staging \
  --option prd:Production \
  --subtitle "This cannot be undone"
```

## What --json prints

**`list`** prints `{ data, next }`. Each conversation in `data` has:

- `id`, `channel`, and `kind`: `contact` or `stranger`
- `people`: each with `id`, `name` and `kind`
- `unreadCount`
- `lastMessage`: `text`, `at`, and `from` (`human` or `agent`)
- `status`: `open` or `resolved`

When `next` isn't null, pass it to `--after` for the next page.

**`show`** prints `{ conversation, messages, hasMore }`. Each message has:

- `from`: `human` for a person, `agent` or `system`
- `senderKind`: `contact` or `stranger`, on messages from a person
- `text` and `at`
- `interaction`: `id`, `kind` and `status`, on the questions you sent

When `hasMore` is true, page back with `--before <messages[0].id>`.

**`send` and `reply`** print the interaction:

- `id`, and `kind`: `ask`, `approve`, `choose`, or `tell` for a plain message
- `status`: `pending`, `answered`, `approved`, `denied`, `expired`, `canceled` or `delivered`
- `response`, once there is one: `type` (`text` or `option`), `text` or `optionId`, `respondedBy` and `respondedAt`
- `conversations`: each with `id` and `unreadBefore`, the unread messages that conversation had before this send marked it read
- `expiresAt` and `createdAt`

## contact list and contact invite

```bash
npx @agentinbox/cli contact list [--limit <n>] [--after <cursor>] [--json]
npx @agentinbox/cli contact invite <id|email> [--name "Alice Chen"] [--via <channel>] [--email <address>] [--async]
```

- `contact list` pages hold 50 contacts (max 100). `--json` prints `{ data, next }`; your operator's row has `self: true`.
- `contact invite alice --name "Alice Chen"` prints a link to a page, valid for 3 days, where Alice connects Telegram, Slack and/or email and picks her default.
- `--via telegram` or `--via slack` prints that channel's direct link instead, valid for minutes. It becomes their default channel.
- An email address instead of an id invites them on email. The contact gets an id from the address (`carol@acme.com` becomes `carol`, with a short suffix when that's taken), and they get a confirmation email. `--via email` with `--email <address>` does the same for an id you choose.
- `--async` prints the link, or sends the confirmation email, and returns without waiting.
- `--name` is what `contact list` shows next to the id. Pass it whenever you know who the person is.
- Inviting someone doesn't change who you are on this computer. Once they've connected, reach them with `--to alice`.

## In a run that listen started

When `listen` started you for a conversation, your own reading and answering in that conversation runs without asking anyone:

| Command, for that conversation | Flags that still run without asking |
|---|---|
| `show conv_123` | `--limit`, `--before`, `--json` |
| `read conv_123`, `resolve conv_123` | `--json` |
| `reply conv_123 …`, with `ask`, `approve` or `choose` too | `--from`, `--ttl`, `--timeout`, `--async`, `--option`, `--approve-label`, `--deny-label`, `--extra-action`, `--icon`, `--subtitle`, `--body`, `--json` |

```bash
npx @agentinbox/cli show conv_123 --json
npx @agentinbox/cli reply conv_123 choose "Deploy the fix?" --option prd:Production --option stg:Staging
npx @agentinbox/cli reply conv_123 "It's on staging." && npx @agentinbox/cli resolve conv_123
```

- `npx @agentinbox/cli` with or without `-y` or `--yes`, a pinned `@agentinbox/cli@<version>`, and an installed `agentinbox` all count. Several of these commands joined with `&&` are fine.
- The operator is asked first for `--to`, `--anyone`, `--via`, `--api-url`, `--`, any other flag, a flag before the conversation id, another conversation, `send`, and commands joined by anything other than `&&`, such as a pipe, `;` or a redirection.
- An answer to one of your questions that no waiting command takes, such as an `--async` one or one whose command timed out, comes back to the conversation you asked in, whoever gave it, also someone outside it you asked with `--to`: it joins the run going on, or goes on with this conversation's session in a new run.
