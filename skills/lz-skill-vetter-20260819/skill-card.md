## Description:

Skill Vetter audits OpenClaw skills for security, performance, and quality issues, producing human-readable reports, JSON reports, and CI exit codes before installation or release.

This skill is ready for commercial/non-commercial use.

## Publisher:

[zuoyunlai](https://clawhub.ai/user/zuoyunlai)

### License/Terms of Use:

MIT-0

## Use Case:

Developers and security reviewers use Skill Vetter to audit OpenClaw and ClawHub skills before installing third-party skills, publishing their own skills, or adding CI checks.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The scanner reads the skill directories it is asked to audit.

Mitigation: Run audit.py against explicit target paths and avoid pointing it at directories that contain unrelated private files.

Risk: Batch audit mode uses predefined local skill directories.

Mitigation: Review or edit batch_audit.sh before using batch mode so the scan scope matches the intended environment.

Risk: Severity caps could otherwise make a serious finding look less severe.

Mitigation: Use the v2.1.3 primary verdict and review uncapped or original severity details when a cap warning appears.

## Reference(s):

- [Audit Protocol](artifact/references/audit_protocol.md)
- [Output Format Reference](artifact/references/output_format.md)
- [Patterns Reference](artifact/references/patterns.md)
- [ClawHub Skill Page](https://clawhub.ai/zuoyunlai/skills/lz-skill-vetter-20260819)
- [Fork Source Skill](https://clawhub.ai/spclaudehome/skills/skill-vetter)

## Skill Output:

**Output Type(s):** [Text, Markdown, JSON, Shell commands, Guidance]

**Output Format:** [Plain text or JSON audit reports, with optional Markdown and CI command guidance.]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [CI mode maps audit results to exit codes 0, 1, and 2.]

## Skill Version(s):

2.1.3 (source: server release metadata and SKILL.md frontmatter)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
