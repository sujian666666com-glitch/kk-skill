## Description:

AI合同审核工具 — 规则引擎 + AI语义分析 + 民法典背书，签合同前先瞄一眼.

This skill is ready for commercial/non-commercial use.

## Publisher:

[moan19921019-code](https://clawhub.ai/user/moan19921019-code)

### License/Terms of Use:

MIT-0

## Use Case:

External users and teams use this skill to review pasted contract text or uploaded .docx/.pdf files before signing. It checks required clauses, contract metadata, semantic risk patterns, and relevant Civil Code references, then summarizes findings and recommended edits.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: Contracts may contain personal data, signatures, seals, pricing, or trade secrets.

Mitigation: Redact sensitive details where possible before use and verify where contract_audit_report.html will be stored or synced.

Risk: The generated review can miss context, attachments, jurisdictional nuance, or legal consequences.

Mitigation: Treat the report as a review aid and consult a qualified lawyer before signing important agreements.

## Reference(s):

- [Server-resolved GitHub provenance](https://github.com/moan19921019-code/hetong-audit)
- [ClawHub release page](https://clawhub.ai/moan19921019-code/skills/hetong-audit)
- [Artifact README](artifact/README.md)

## Skill Output:

**Output Type(s):** [text, HTML, files, guidance]

**Output Format:** [Chat summary plus a local HTML report file named contract_audit_report.html]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Risk scoring, issue severity labels, clause-completeness checks, Civil Code references, and recommended edits.]

## Skill Version(s):

0.1.0 (source: server release metadata)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
