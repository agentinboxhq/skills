# Agent Inbox skills

Agent skills for [Agent Inbox](https://www.agentinbox.md), an inbox for your agent. People write to the agent on Telegram, Slack and email, and the agent can ask a real person a question and wait for the answer. These skills teach a coding agent when to reach a person, how to read and answer its conversations, and how to set up the CLI or the MCP server.

They follow the [Agent Skills](https://agentskills.io) format, so they work in Claude Code, Codex, OpenCode, Cursor, GitHub Copilot, Gemini CLI, Hermes, OpenClaw and the other agents that read it.

## Install

```bash
# Every skill, into the project you're in
npx skills add agentinboxhq/skills

# One skill
npx skills add agentinboxhq/skills --skill agentinbox

# For one agent only
npx skills add agentinboxhq/skills --agent claude-code
```

`npx skills update` brings them up to date later.

The website publishes the same skills for [Agent Skills discovery](https://github.com/cloudflare/agent-skills-discovery-rfc), so `npx skills add https://www.agentinbox.md` installs them too.

Hermes and OpenClaw read skills from their own folder in your home directory, so install them there once, for all your projects. A new session picks them up.

```bash
npx skills add agentinboxhq/skills -g --agent hermes-agent -y   # into ~/.hermes/skills
npx skills add agentinboxhq/skills -g --agent openclaw -y       # into ~/.openclaw/skills
```

Without a terminal, as when an agent runs it, `npx skills add` needs `--agent` and `-y`, or it stops before installing anything.

### Claude Code

In Claude Code you can install them as a plugin instead. The plugin also adds the Agent Inbox MCP server, so the agent gets the inbox tools without the CLI. Sign in to Agent Inbox when Claude Code asks, or with `/mcp`.

```text
/plugin marketplace add agentinboxhq/skills
/plugin install agentinbox@agentinbox
```

Or from a shell: `claude plugin install agentinbox --marketplace agentinboxhq/skills`.

Claude Code doesn't update plugins from marketplaces other than Anthropic's on its own. Run `claude plugin update agentinbox@agentinbox`, or turn on auto-update for the `agentinbox` marketplace in `/plugin`.

### Codex

Codex installs the same plugin from this repository, with the MCP server and the skills. `codex mcp login AgentInbox` signs in to Agent Inbox in the browser.

```bash
codex plugin marketplace add agentinboxhq/skills
codex plugin add agentinbox@agentinbox
codex mcp login AgentInbox
```

Once the marketplace is added, Agent Inbox is also in `/plugins` in Codex. Codex checks the marketplace for a new commit each time it starts and updates the plugin; `codex plugin marketplace upgrade agentinbox` does it right away.

### OpenCode

OpenCode reads the skills `npx skills add` installs. For the inbox tools, add the MCP server in your project, or with `--global` for every project:

```bash
opencode mcp add AgentInbox --url https://mcp.agentinbox.md
```

Or add it to `opencode.json` yourself, in your project or in `~/.config/opencode/opencode.json` for every project:

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

Then sign in with `opencode mcp auth AgentInbox`. `opencode mcp list` shows whether it's signed in.

### Other agents

Cursor, GitHub Copilot, VS Code and the other [Agent Plugins clients](https://agent-plugins.org/compatible-clients) can load this repository as a plugin too, with the same skills and MCP server.

## Skills

| Skill | What it's for |
| --- | --- |
| `agentinbox` | Ask a person and wait for the answer: questions, approvals before anything hard to undo, choices, and a message when a job is done. Read and answer the conversations people start with the agent, also in a run their message started, and reach other contacts. |
| `agentinbox-cli` | Set up and script `npx @agentinbox/cli`: setup and login, by the operator or by an agent they ask, connecting a computer with a one-time code, channels, listening for messages so that one starts Claude Code on a computer, CI and sandboxes, exit codes, and what each error means. |
| `agentinbox-mcp` | Connect Claude, ChatGPT, Cursor, Claude Code, Codex, OpenCode or another app to the hosted MCP server, finish setting up from the app, and fix that connection. |

## What's where

```text
skills/<name>/SKILL.md       one folder per skill, where npx skills and plugin hosts look
skills/<name>/references/    detail a skill reads only when it needs it
evals/<name>/<case>/         test prompts for each skill, for claude plugin eval
evals/mocks/inbox/           the stand-in MCP server those tests call
.claude-plugin/              the Claude Code plugin and its marketplace
.cursor-plugin/              the same plugin for the Cursor Marketplace, which Grok Bot installs from too
.agents/plugins/             the Codex marketplace
.mcp.json                    the MCP server the Claude Code plugin adds
mcp.json                     the same server for Codex and the other Agent Plugins clients
assets/icon.png              the plugin's icon in Anthropic's plugin directory, Codex and the Cursor Marketplace
plugin.json                  the same plugin in the open Agent Plugins format, with Codex's listing under extensions
skills.sh.json               how skills.sh groups the skills on its page
scripts/validate.mjs         the checks CI runs
scripts/check-codex-plugin.mjs   installs the plugin into a throwaway Codex home and checks it
```

## Change a skill

The skills describe the CLI (`packages/agentinbox`) and the MCP server (`apps/agent-inbox-mcp`) in [novuhq/novu](https://github.com/novuhq/novu). When a command, a flag, a tool or an error message changes there, change the skills too.

Check your change before you open a pull request:

```bash
node scripts/validate.mjs                                      # this repo's rules
node --test scripts/validate.test.mjs                          # tests for those rules
uvx --from skills-ref agentskills validate skills/agentinbox   # the Agent Skills spec, one skill at a time
claude plugin validate .                                       # the Claude Code plugin and marketplace
node scripts/check-codex-plugin.mjs                            # the Codex plugin, installed for real
```

CI runs all five on every pull request. A merge to `main` ships right away for new installs: `npx skills add` and both plugin marketplaces read `main`. The plugin has no `version`, so Claude Code treats each commit as a new version, and Codex reinstalls it whenever its marketplace has a new commit. Existing installs get it with `npx skills update`, `claude plugin update`, or `codex plugin marketplace upgrade agentinbox`; Codex also checks each time it starts.

When you write:

- Keep `SKILL.md` under 500 lines. Move detail into `references/`, and say in `SKILL.md` when to read each file.
- Write the `description` in the third person: what the skill does, then "Use when…", then what it's not for. It's all an agent sees before it loads the skill, and it must stay under 1,024 characters.
- Add what an agent would get wrong without the skill; leave out what it already knows.
- Use the product's words: conversation (not thread), contact (not recipient), operator, one-time code.

### Evals

`evals/` holds realistic prompts for each skill: requests that should load it, near misses that shouldn't, and a few that check what the agent then does. They run in Claude Code and cost model calls, so CI doesn't run them:

```bash
claude plugin eval . --ablation none --tag triggers   # does each skill load when it should?
claude plugin eval .                                  # every case, with a no-plugin baseline
```

See [evals/README.md](evals/README.md) for what each case checks.

## What it sends where

The plugin has no hooks or scripts. Everything happens when the agent calls an inbox tool or runs a command a skill gives it:

- **The Agent Inbox MCP server**, `https://mcp.agentinbox.md`. The agent's tool calls go there, such as a message to send or a conversation to read, with the sign-in you approved. The server acts on your Agent Inbox account, and the account's key never leaves it.
- **The Agent Inbox CLI**, when the agent runs `npx @agentinbox/cli`. npm downloads the package the first time. The CLI talks only to the Agent Inbox API at `https://www.agentinbox.md/api`, and keeps the account's key in `~/.agentinbox/config.json`. With `listen claude-code`, once the operator allows it, a background program stays on the computer: it waits on that API, and starts the operator's own Claude Code in the project when a message comes.
- **The people the agent reaches.** Its messages go out on Telegram, Slack or email, wherever each contact connected, and their answers come back the same way.

## License

[MIT](LICENSE)
