# Agent Inbox skills

Agent skills for [Agent Inbox](https://www.agentinbox.md), an inbox for your agent. People write to the agent on Telegram, Slack and email, and the agent can ask a real person a question and wait for the answer. These skills teach a coding agent when to reach a person, how to read and answer its conversations, and how to set up the CLI or the MCP server.

They follow the [Agent Skills](https://agentskills.io) format, so they work in Claude Code, Codex, Cursor, GitHub Copilot, Gemini CLI and the other agents that read it.

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

In Claude Code you can install them as a plugin instead. The plugin also adds the Agent Inbox MCP server, so the agent gets the inbox tools without the CLI. Sign in to Agent Inbox when Claude Code asks, or with `/mcp`.

```text
/plugin marketplace add agentinboxhq/skills
/plugin install agentinbox@agentinbox
```

Or from a shell: `claude plugin install agentinbox --marketplace agentinboxhq/skills`.

Claude Code doesn't update plugins from marketplaces other than Anthropic's on its own. Run `claude plugin update agentinbox@agentinbox`, or turn on auto-update for the `agentinbox` marketplace in `/plugin`.

Cursor, Codex, GitHub Copilot, VS Code and the other [Agent Plugins clients](https://agent-plugins.org/compatible-clients) can load this repository as a plugin too, with the same skills and MCP server.

## Skills

| Skill | What it's for |
| --- | --- |
| `agentinbox` | Ask a person and wait for the answer: questions, approvals before anything hard to undo, choices, and a message when a job is done. Read and answer the conversations people start with the agent, and reach other contacts. |
| `agentinbox-cli` | Set up and script `npx @agentinbox/cli`: setup, login, connecting a computer with a one-time code, channels, CI and sandboxes, exit codes, and what each error means. |
| `agentinbox-mcp` | Connect Claude, ChatGPT, Cursor, Claude Code or another app to the hosted MCP server, finish setting up from the app, and fix that connection. |

## What's where

```text
skills/<name>/SKILL.md       one folder per skill, where npx skills and plugin hosts look
skills/<name>/references/    detail a skill reads only when it needs it
evals/<name>/<case>/         test prompts for each skill, for claude plugin eval
evals/mocks/inbox/           the stand-in MCP server those tests call
.claude-plugin/              the Claude Code plugin and its marketplace
.cursor-plugin/              the same plugin for the Cursor Marketplace, which Grok Bot installs from too
.mcp.json                    the MCP server the Claude Code plugin adds
mcp.json                     the same server for Agent Plugins clients
assets/icon.png              the plugin's icon in Anthropic's plugin directory and the Cursor Marketplace
plugin.json                  the same plugin in the open Agent Plugins format
skills.sh.json               how skills.sh groups the skills on its page
scripts/validate.mjs         the checks CI runs
```

## Change a skill

The skills describe the CLI (`packages/agentinbox`) and the MCP server (`apps/agent-inbox-mcp`) in [novuhq/novu](https://github.com/novuhq/novu). When a command, a flag, a tool or an error message changes there, change the skills too.

Check your change before you open a pull request:

```bash
node scripts/validate.mjs                                      # this repo's rules
node --test scripts/validate.test.mjs                          # tests for those rules
uvx --from skills-ref agentskills validate skills/agentinbox   # the Agent Skills spec, one skill at a time
claude plugin validate .                                       # the Claude Code plugin and marketplace
```

CI runs all four on every pull request. A merge to `main` ships right away for new installs: `npx skills add` and the Claude Code marketplace both read `main`, and the plugin has no `version`, so each commit is a new version. Existing installs get it with `npx skills update` or `claude plugin update`.

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
- **The Agent Inbox CLI**, when the agent runs `npx @agentinbox/cli`. npm downloads the package the first time. The CLI talks only to the Agent Inbox API at `https://www.agentinbox.md/api`, and keeps the account's key in `~/.agentinbox/config.json`.
- **The people the agent reaches.** Its messages go out on Telegram, Slack or email, wherever each contact connected, and their answers come back the same way.

## License

[MIT](LICENSE)
