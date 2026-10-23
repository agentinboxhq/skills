---
type: llm
---

PASS if the response asks the user for the agent's name and its inbox address (or tells them to give both) before `inbox_setup` creates anything, and says a confirmation link goes to the user's email only once they confirm the address.
FAIL if it calls or plans to call `inbox_setup` with a name or address it made up, sends them to set up the CLI instead, or says setup can only happen on agentinbox.md.
