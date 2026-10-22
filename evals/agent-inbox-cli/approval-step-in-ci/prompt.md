---
description: Adds a CI step that waits for a person's approval, with the key kept in CI secrets.
tags: [triggers, behavior]
max_turns: 8
allowed_tools: [Skill, Read, Glob, Grep]
---

Our deploy workflow is .github/workflows/deploy.yml. Before the "Deploy to production" job runs, I want it to wait until Alice approves on Agent Inbox, and stop if she says no or doesn't answer within half an hour. What do I add?
