## Description:

Drive a self-hosted gitrakz instance that syncs a GitHub user's activity into local SQLite, renders timelines and work sessions, and runs deterministic templates that export to CSV, PDF, or JSON.

This skill is ready for commercial/non-commercial use.

## Publisher:

[psyb0t](https://clawhub.ai/user/psyb0t)

### License/Terms of Use:

MIT-0

## Use Case:

Developers and engineers use this skill to install or run gitrakz, trigger or monitor GitHub activity syncs, query timelines and sessions, and run or export templates through REST or MCP.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The installer and Docker workflow can modify local configuration and start containers.

Mitigation: Inspect the downloaded installer before running it, pin released image tags, and confirm the intended config path before setup.

Risk: GitHub activity sync uses a GitHub token and can spend network and rate-limit budget.

Mitigation: Use a read-scoped GitHub token and trigger sync only for the user-requested task.

Risk: Exposed gitrakz APIs can reveal synced activity if the service is reachable without authentication.

Mitigation: Set GITRAKZ_AUTH_TOKEN whenever the service is reachable beyond the user's local trusted machine.

Risk: Optional LLM template steps may send commit titles or diffs to the configured LLM endpoint.

Mitigation: Configure an LLM endpoint only when the user accepts that data flow, or leave LLM settings empty for deterministic local features.

## Reference(s):

- [gitrakz setup](references/setup.md)
- [ClawHub skill page](https://clawhub.ai/psyb0t/skills/gitrakz)
- [gitrakz homepage](https://github.com/psyb0t/gitrakz)

## Skill Output:

**Output Type(s):** [Shell commands, Configuration, API Calls, JSON, Markdown, Guidance]

**Output Format:** [Markdown with shell commands, REST examples, MCP configuration snippets, and JSON responses]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [May produce CSV, PDF, or JSON exports when running gitrakz templates.]

## Skill Version(s):

0.7.2 (source: server release metadata)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
