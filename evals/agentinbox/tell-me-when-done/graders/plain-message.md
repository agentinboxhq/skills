---
type: llm
---

PASS if the response plans to tell the person through Agent Inbox once the backfill finishes, with a plain message that doesn't wait for an answer: `npx @agentinbox/cli inbox send "…"` without `ask`, `approve` or `choose`, or `inbox_send` without a `kind`.
FAIL if it uses a question that waits for an answer, or doesn't use Agent Inbox to tell them.
