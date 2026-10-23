---
type: llm
---

PASS if the response starts by listing the unread conversations, such as `npx @agentinbox/cli inbox list --filter unread` or `inbox_list` with filter `unread`, and answers in those conversations with `reply` rather than starting new ones.
FAIL if it starts new conversations or sends messages without checking the unread conversations first.
