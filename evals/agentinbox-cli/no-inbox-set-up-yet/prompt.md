---
description: Passes "No inbox set up yet" on to the operator instead of setting it up for them.
tags: [triggers, behavior]
max_turns: 8
allowed_tools: [Skill, Read, Glob, Grep]
---

The approval step you added fails with this:

```text
No inbox set up yet. Ask your operator to run: npx @agentinbox/cli setup (or set INBOX_SECRET_KEY + INBOX_TO).
```

Can you fix it so the step works?
