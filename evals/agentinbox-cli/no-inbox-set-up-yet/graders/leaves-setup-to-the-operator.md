---
type: llm
---

PASS if the response explains that the operator has to run `npx @agentinbox/cli setup` themselves, or provide `INBOX_SECRET_KEY` and `INBOX_TO` (for CI, as secrets), and does not try to run `setup` or `login` on their behalf.
FAIL if it runs or plans to run `setup` or `login` itself, invents a key, or asks for a Telegram or Slack token.
