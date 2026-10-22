---
name: agent-inbox-mcp
description: Connects an AI app to the hosted Agent Inbox MCP server at https://mcp.agentinbox.md and troubleshoots that connection, for Claude, ChatGPT, Cursor, Claude Code or any client that supports remote MCP servers with OAuth sign-in. Use when someone wants Agent Inbox in a chat app or an IDE without the CLI, asks for the MCP address or config, can't finish the sign-in, doesn't see the inbox tools, or asks what the server's tools can do. Not for using the tools once they are connected (agent-inbox) or for the CLI (agent-inbox-cli).
license: MIT
---

# Agent Inbox MCP

The hosted MCP server lets an app act as the operator's agent without the CLI:

```text
https://mcp.agentinbox.md
```

The person signs in with their Agent Inbox account when the app asks, and approves the app. The app never sees the API key, so there is no key or header to configure. Someone without an agent yet is sent through onboarding on their next visit to agentinbox.md; to start, they sign up there and name the agent. Opening the address in a browser just shows the docs.

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
    "inbox": { "url": "https://mcp.agentinbox.md" }
  }
}
```

The first time Cursor uses the inbox, it opens the sign-in window.

**Claude Code**:

```bash
claude mcp add --transport http inbox https://mcp.agentinbox.md
```

Then run `/mcp` in a session and authenticate `inbox` in the browser.

**Any other client** that supports remote MCP servers over HTTP with OAuth sign-in: add `https://mcp.agentinbox.md` with no headers and no API key, then finish the sign-in in the browser.

## Check that it works

- The app now has tools named `inbox_send`, `inbox_list` and so on, sometimes with the server's name in front (`mcp__inbox__inbox_list`).
- Ask it to call `inbox_list`. It only reads, so it's a safe first call.
- agentinbox.md shows the app as connected, and when each app or computer last checked the inbox.

## What the tools do

| Tool | What it does |
|---|---|
| `inbox_send` | Starts a conversation. Without a `kind` it's a plain message; `ask`, `approve` or `choose` waits for the answer |
| `inbox_reply` | Sends into an existing conversation, with the same kinds |
| `inbox_wait` | Keeps waiting for an answer that hadn't come yet |
| `inbox_list` | Lists conversations: unread or read, open or resolved, contacts or everyone |
| `inbox_show` | Shows a conversation's messages, without marking it read |
| `inbox_read` | Marks a conversation read without replying |
| `inbox_resolve` | Marks a conversation finished; it opens again when anyone writes |
| `contact_list` | Lists the people the agent can reach |
| `contact_invite` | Returns a link for someone new to connect a channel |

How to use them well, including how waiting works, is the agent-inbox skill.

## Limits

- No tools for `setup`, `login`, `connect` or `channel`: the operator does those on agentinbox.md or with the CLI. Signing in an app doesn't set up the CLI on that computer either; the CLI connects with a one-time code (see the agent-inbox-cli skill).
- The server is for Agent Inbox cloud only. A self-hosted deployment has no hosted MCP server.
- Agent Inbox runs in the US region only.

## Troubleshoot

- **The sign-in never finishes, or the account has no agent.** Finish onboarding on agentinbox.md, then connect again.
- **The tools don't show up.** Check the address for typos, then reload the app or start a new session; most apps only read the tool list when they connect.
- **Every tool says the agent is paused.** The operator paused it on agentinbox.md. Messages wait in the inbox until they resume it.
- **A removed app still reads as connected on agentinbox.md.** Nothing tells the server that an app disconnected. It's harmless.
- **A result says the request is still open.** That's not an error: call `inbox_wait` with the id from the result.
