---
name: agentinbox-mcp
description: Connects an AI app to the hosted Agent Inbox MCP server at https://mcp.agentinbox.md and troubleshoots that connection, for Claude, ChatGPT, Cursor, Claude Code, Codex, OpenCode or any client that supports remote MCP servers with OAuth sign-in. Use when someone wants Agent Inbox in a chat app or an IDE without the CLI, asks for the MCP address or config, can't finish the sign-in, doesn't see the inbox tools, is told by the tools that Agent Inbox isn't set up yet, or asks what the server's tools can do. Not for using the tools once they are connected (agentinbox) or for the CLI (agentinbox-cli).
license: MIT
---

# Agent Inbox MCP

The hosted MCP server lets an app act as the operator's agent without the CLI:

```text
https://mcp.agentinbox.md
```

The person signs in with their Agent Inbox account when the app asks, and approves the app. The app never sees the API key, so there is no key or header to configure. Signing in opens an Agent Inbox account for someone who has none; the agent itself comes from `inbox_setup` in the app (see "Finish setup from the app") or from the onboarding on agentinbox.md. Opening the address in a browser just shows the docs.

## Add it to the app

**Claude** (claude.ai and the desktop app)

1. Open Settings › Connectors and choose Add custom connector.
2. Paste `https://mcp.agentinbox.md`.
3. Click Connect. Claude opens a sign-in window; sign in and approve.

**ChatGPT**

1. Open Settings › Apps & Connectors › Advanced and switch on Developer mode.
2. Create a connector with `https://mcp.agentinbox.md`.
3. ChatGPT opens a sign-in window; sign in and approve.

**Cursor**: agentinbox.md has an Add to Cursor button that does it in one click. Or add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "AgentInbox": { "url": "https://mcp.agentinbox.md" }
  }
}
```

The first time Cursor uses the inbox, it opens the sign-in window.

**Claude Code**: the Agent Inbox plugin comes with the server (`/plugin marketplace add agentinboxhq/skills`, then `/plugin install agentinbox@agentinbox`), listed as `plugin:agentinbox:inbox`. Without the plugin, add it:

```bash
claude mcp add --transport http AgentInbox https://mcp.agentinbox.md
```

Either way, run `/mcp` in a session and authenticate it in the browser. Don't add it by hand next to the plugin, or every tool shows up twice.

**Codex**: the Agent Inbox plugin comes with the server and the Agent Inbox skills:

```bash
codex plugin marketplace add agentinboxhq/skills
codex plugin add agentinbox@agentinbox    # or install it from /plugins in Codex
codex mcp login AgentInbox
```

`codex mcp login AgentInbox` opens the sign-in in the browser. Without the plugin, add the server with `codex mcp add AgentInbox --url https://mcp.agentinbox.md` and sign in the same way; use one or the other, not both.

**OpenCode**: run this in the project, or add `--global` to add it for every project:

```bash
opencode mcp add AgentInbox --url https://mcp.agentinbox.md
```

Or add the server to `opencode.json` yourself, in the project or in `~/.config/opencode/opencode.json` for every project:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "AgentInbox": {
      "type": "remote",
      "url": "https://mcp.agentinbox.md"
    }
  }
}
```

Then run `opencode mcp auth AgentInbox` and sign in in the browser. `opencode mcp list` shows whether it's signed in.

**Any other client** that supports remote MCP servers over HTTP with OAuth sign-in: add `https://mcp.agentinbox.md` with no headers and no API key, then finish the sign-in in the browser.

## Check that it works

- The app now has tools named `inbox_send`, `inbox_list` and so on, sometimes with the server's name in front (`mcp__AgentInbox__inbox_list`, `mcp__plugin_agentinbox_AgentInbox__inbox_list` from the Claude Code plugin, or `AgentInbox_inbox_list` in OpenCode).
- Ask it to call `inbox_list`. It only reads, so it's a safe first call.
- agentinbox.md shows the app as connected, and when each app or computer last checked the inbox.

## Finish setup from the app

When the account has no agent yet, the tools say that Agent Inbox is not set up yet. `inbox_setup` creates the agent and its email inbox without leaving the app:

1. Call `inbox_setup` with no arguments. It says how far setup got, and may suggest the email the person signed in with.
2. Ask the person what to call the agent and which inbox address it gets: the part before the `@`, such as `atlas`, in letters, digits and hyphens. Never pick them yourself. Call `inbox_setup` with `agent_name` (up to 60 characters) and `handle` (up to 32) together.
3. Confirm their email address with them, suggested or not, then call `inbox_setup` with `email`. A confirmation link goes to that address.
4. When they say they've opened it, call `inbox_setup` with no arguments to check.

A name never renames an existing agent, and a handle never moves an existing mailbox; `handle` alone finishes a mailbox that wasn't created. An email address that's already confirmed changes on agentinbox.md, not here. Telegram and Slack are set up on agentinbox.md or with the CLI.

## What the tools do

| Tool | What it does |
|---|---|
| `inbox_setup` | Creates the agent and its email inbox, sends the owner's confirmation link, or reports how far setup got |
| `inbox_send` | Starts a conversation. Without a `kind` it's a plain message; `ask`, `approve` or `choose` waits for the answer |
| `inbox_reply` | Sends into an existing conversation, with the same kinds |
| `inbox_wait` | Keeps waiting for an answer that hadn't come yet |
| `inbox_list` | Lists conversations: unread or read, open or resolved, contacts or everyone |
| `inbox_show` | Shows a conversation's messages, without marking it read |
| `inbox_read` | Marks a conversation read without replying |
| `inbox_resolve` | Marks a conversation finished; it opens again when anyone writes |
| `contact_list` | Lists the people the agent can reach |
| `contact_invite` | Returns a link for someone new to connect a channel |

How to use them well, including how waiting works, is the agentinbox skill.

## Limits

- No tools for `login`, `connect` or `channel`: those, and Telegram and Slack, happen on agentinbox.md or with the CLI (the agentinbox-cli skill says who runs which). Signing in an app doesn't set up the CLI on that computer either; the CLI connects with a one-time code.
- Nothing here starts an agent when a message comes. The CLI's `listen` does that, on the computer where Claude Code works (the agentinbox-cli skill).
- The server is for Agent Inbox cloud only. A self-hosted deployment has no hosted MCP server.
- Agent Inbox runs in the US region only.

## Troubleshoot

- **The sign-in never finishes.** Finish onboarding on agentinbox.md, then connect again.
- **The tools say Agent Inbox is not set up yet.** The account has no agent: create it with `inbox_setup`, as in "Finish setup from the app".
- **The tools don't show up.** Check the address for typos, then reload the app or start a new session; most apps only read the tool list when they connect.
- **Every tool says the agent is paused.** The operator paused it on agentinbox.md. Messages wait in the inbox until they resume it.
- **A removed app still reads as connected on agentinbox.md.** Nothing tells the server that an app disconnected. It's harmless.
- **A result says the request is still open.** That's not an error: call `inbox_wait` with the id from the result.
