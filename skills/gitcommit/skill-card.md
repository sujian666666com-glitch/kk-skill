## Description:

Use when the user explicitly asks to prepare, review, or create a Git commit, including "提交", "提交代码", "帮我提交", "commit", "git commit", "确认提交", or requests a commit message.

This skill is ready for commercial/non-commercial use.

## Publisher:

[wlykan](https://clawhub.ai/user/wlykan)

### License/Terms of Use:

MIT-0

## Use Case:

Developers and engineers use this skill to inspect all uncommitted repository changes, group them into atomic Conventional Commit proposals, and create commits only after explicit confirmation.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The skill inspects repository diffs and untracked text files, which can include sensitive content.

Mitigation: Review the generated plan carefully and explicitly exclude sensitive files before confirming a commit.

Risk: A generated commit plan or message can misclassify changes or miss repository conventions.

Mitigation: Check the reported rule sources, file grouping, and commit messages before approving execution.

Risk: Confirmed execution writes Git commits to the local repository.

Mitigation: Confirm only after validating the displayed plan; the skill rechecks repository state and stops if the current changes differ from the confirmed plan.

## Reference(s):


## Skill Output:

**Output Type(s):** [Text, Markdown, Shell commands, Guidance]

**Output Format:** [Markdown plan with Conventional Commit messages and execution summaries]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Requires explicit confirmation before Git write operations.]

## Skill Version(s):

1.0.4 (source: release evidence)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
