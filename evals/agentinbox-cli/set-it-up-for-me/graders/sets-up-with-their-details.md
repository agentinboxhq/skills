---
type: llm
---

PASS if the response plans to run `npx @agentinbox/cli setup` with `--email dana@example.com` and a `--name` the user gives (it asks for their name rather than making one up), then `npx @agentinbox/cli login` for the user to approve on agentinbox.md, and leaves connecting Telegram to the user, on agentinbox.md or in their own terminal.
FAIL if it makes up a name, asks for a Telegram bot token or a Slack token, or says an agent can't run `setup` or `login`.
