# Inbox and contact commands

Every flag of the commands an agent uses, and what `--json` prints. Commands start with `npx @agentinbox/cli`.

## Contents

- `inbox list`
- `inbox show`, `inbox read`, `inbox resolve`
- `inbox send` and `inbox reply`
- Cards and buttons
- What `--json` prints
- `contact list` and `contact invite`

## inbox list

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

## inbox show, inbox read, inbox resolve

```bash
npx @agentinbox/cli inbox show conv_123 [--limit <n>] [--before <messageId>] [--json]
npx @agentinbox/cli inbox read conv_123
npx @agentinbox/cli inbox resolve conv_123
```

- `show` lists messages oldest first: 20 by default, max 100. `--before` pages to older messages. It doesn't mark the conversation read.
- `read` marks the conversation read. Nothing is sent.
- `resolve` marks it finished. Nothing is sent, and it opens again when anyone writes in it.

## inbox send and inbox reply

```bash
npx @agentinbox/cli inbox send [ask|approve|choose] <text...>
npx @agentinbox/cli inbox reply <conversation> [ask|approve|choose] <text...>
```

| Flag | Meaning |
|---|---|
| `--to <id\|email>` | A contact, or comma-separated contacts (max 50; the first valid answer wins). On `send` the default is `INBOX_TO`, then your operator. On `reply` it limits who may answer |
| `--via <channel>` | `send` only: `telegram`, `slack` or `email` instead of each contact's default channel |
| `--anyone` | `reply` only: anyone in the conversation may answer, strangers included. Not with `--to` |
| `--from <name>` | The label the person sees, such as `deploy-bot` |
| `--ttl <duration>` | How long a question stays answerable: default 24h, max 5d |
| `--timeout <duration>` | How long this command waits. Default: until answered or expired. On timeout it exits `11` |
| `--async` | Return at once instead of waiting |
| `--json` | Print the full result instead of prose |

Durations look like `90s`, `10m`, `2h` or `1d`.

`--to` takes contact ids from `contact list`, or an email address. With an Agent Inbox account, a new conversation goes to the address as typed. A reply needs a contact that already verified that address.

## Cards and buttons

| Flag | Meaning |
|---|---|
| `--subtitle <text>`, `--body <text>` | Card text under the message. A plain message becomes a card when one of these, or `--icon`, is set |
| `--icon <id-or-url>` | Slack only: an MCP catalog id such as `stripe`, or an https URL (32×32). Other channels ignore it |
| `--approve-label <text>`, `--deny-label <text>` | `approve` only: the button labels |
| `--extra-action <spec>` | `approve` only: another button, as `id:label` or a label. Repeatable |
| `--option <label>` | `choose` only: one option, 2 to 10. `id:label` keeps a stable id, such as `--option stg:Staging` |

```bash
npx @agentinbox/cli inbox send approve "Issue the refund?" \
  --icon stripe \
  --subtitle "issue_refund: ORD-42" \
  --body 'Refund $25.00' \
  --extra-action trust-tool:"Always allow this tool"

npx @agentinbox/cli inbox send choose "Which environment?" \
  --option stg:Staging \
  --option prd:Production \
  --subtitle "This cannot be undone"
```

## What --json prints

**`inbox list`** prints `{ data, next }`. Each conversation in `data` has:

- `id`, `channel`, and `kind`: `contact` or `stranger`
- `people`: each with `id`, `name` and `kind`
- `unreadCount`
- `lastMessage`: `text`, `at`, and `from` (`human` or `agent`)
- `status`: `open` or `resolved`

When `next` isn't null, pass it to `--after` for the next page.

**`inbox show`** prints `{ conversation, messages, hasMore }`. Each message has:

- `from`: `human` for a person, `agent` or `system`
- `senderKind`: `contact` or `stranger`, on messages from a person
- `text` and `at`
- `interaction`: `id`, `kind` and `status`, on the questions you sent

When `hasMore` is true, page back with `--before <messages[0].id>`.

**`inbox send` and `inbox reply`** print the interaction:

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
- An email address instead of an id invites them on email. The contact gets an id from the address (`carol@acme.com` becomes `carol`, with a short suffix when that's taken), and they get a verification email to confirm. `--via email` with `--email <address>` does the same for an id you choose.
- `--async` prints the link, or sends the verification email, and returns without waiting.
- `--name` is what `contact list` shows next to the id. Pass it whenever you know who the person is.
- Inviting someone doesn't change who you are on this computer. Once they've connected, reach them with `--to alice`.
