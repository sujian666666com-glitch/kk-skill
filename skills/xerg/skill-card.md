## Description:

Audit and reduce AI agent runtime spend in dollars. Use for AI costs, agent spend, token waste, runtime attribution, detector coverage, and FinOps. Works with OpenClaw, Hermes, QM, Claude Code, Cursor, and generic event ingest.

This skill is ready for commercial/non-commercial use.

## Publisher:

[xerg](https://clawhub.ai/user/xerg)

### License/Terms of Use:

MIT-0

## Use Case:

Developers, engineering leaders, and FinOps teams use this skill to run local-first audits of AI agent runtime spend, identify evidence-strict waste findings, review neutral efficiency signals, and measure compatible fixes with compare workflows.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The skill drives a closed-source npm CLI that can read local AI runtime logs, transcripts, state databases, snapshots, and audit exports.

Mitigation: Confirm user approval before npm execution or local data inspection, prefer local-only audit mode by default, and avoid placing API keys, database URLs, or provider credentials in chat or commands.

Risk: Hosted pairing or push can upload audit summaries and source metadata when explicitly requested.

Mitigation: Ask for separate approval before any hosted upload or pairing step, and use local audit results when the user does not want cloud sync.

Risk: Runtime costs may be observed, locally estimated, or unpriced and are not authoritative provider invoices.

Mitigation: Present Xerg findings as runtime audit evidence, disclose pricing coverage and limitations, and avoid treating modeled runtime spend as invoice reconciliation.

## Reference(s):

- [Xerg homepage](https://xerg.ai)
- [Xerg documentation](https://xerg.ai/docs)
- [Xerg skill](https://xerg.ai/skill.md)
- [Xerg service status](https://status.xerg.ai)
- [@xerg/cli npm package](https://www.npmjs.com/package/@xerg/cli)
- [OpenSSH](https://www.openssh.com/)
- [rsync](https://rsync.samba.org/)
- [Railway CLI](https://github.com/railwayapp/cli)
- [Fly.io flyctl documentation](https://fly.io/docs/flyctl/)

## Skill Output:

**Output Type(s):** [text, markdown, shell commands, configuration, guidance]

**Output Format:** [Markdown guidance with shell commands and JSON-oriented CLI output]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Local-first audit workflow; hosted upload, npm package fetches, and local runtime-data inspection require explicit user approval.]

## Skill Version(s):

0.27.4 (source: server release evidence)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
