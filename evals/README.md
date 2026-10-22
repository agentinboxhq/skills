# Evals

Test prompts for each skill, in the format [`claude plugin eval`](https://code.claude.com/docs/en/plugin-evals) runs. Each case is a folder with a `prompt.md`, the request a person might type, and `graders/`, the checks on what the agent did.

```text
evals/<skill>/<case>/prompt.md
evals/<skill>/<case>/graders/*.md
```

There are three kinds of case, marked with tags:

- **Should load the skill** (`triggers`): a realistic request the skill is for. `skill-fired.md` checks that the agent loaded it.
- **Shouldn't load it** (`triggers`): a near miss that sounds similar but needs something else. `no-agent-inbox-skill.md` checks that no Agent Inbox skill loaded.
- **What the agent then does** (`behavior`): a regex or a judge checks the answer, such as asking for approval before deleting data, or not obeying a stranger.

## Run them

Every run is a real Claude Code session on your account, so evals cost model calls and aren't part of CI.

```bash
# Does each skill load when it should, and stay quiet when it shouldn't? One run per case is enough to start.
claude plugin eval . --ablation none --tag triggers --runs 1

# Everything, three runs per case, against a baseline without the skills
claude plugin eval .
```

- `--ablation none` skips the no-skill baseline, which halves the cost. A skill can't load without the plugin, so the baseline adds nothing to a trigger check.
- The cases grant only read-only tools, so the agent explains the commands it would run instead of running them.
- Results go to `evals/results/`, which git ignores.

## Add a case

Add one when an agent gets something wrong in real use: the request it misread, a near miss that loaded the wrong skill, a mistake you had to correct. Keep the prompt the way a person would type it, with names, paths and the odd typo, and don't name the skill in it.

`claude plugin eval init --bare <case>` writes a blank case to start from; move it into its skill's folder. `node scripts/validate.mjs` checks that every skill has at least three cases and that each case has a prompt and a grader.
