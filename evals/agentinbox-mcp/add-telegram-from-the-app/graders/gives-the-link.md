---
type: llm
---

PASS if the response gives the user the whole setup link from `channel_add` (`https://www.agentinbox.md/connect#Zx8kQ2mVt4rNf7LpB1sYc9HdJ6wTg3Ae`) and tells them to say when they've finished, so the agent can call `channel_add` again.
FAIL if it tells them to go to agentinbox.md or run the CLI themselves, or asks them for a bot token.
