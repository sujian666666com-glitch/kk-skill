## Description:

保险理赔纠纷维权辅助分析。当保险顾问的客户被保险公司拒赔时使用，逐条拆解拒赔理由、匹配保险法依据、规划维权路径，并生成申诉函、投诉书和证据清单。

This skill is ready for commercial/non-commercial use.

## Publisher:

[baozhiyin](https://clawhub.ai/user/baozhiyin)

### License/Terms of Use:

MIT-0

## Use Case:

Insurance consultants and claim-support professionals use this skill to analyze health-insurance claim denials, organize evidence, compare appeal paths, and draft appeal or complaint materials. It is positioned as insurance consultation support rather than legal practice.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: Insurance claim files can contain sensitive identity, policy, contact, and medical information.

Mitigation: Redact nonessential ID numbers, phone numbers, addresses, policy numbers, and unrelated medical records before using the skill.

Risk: Generated appeal or complaint materials may require legal or medical judgment.

Mitigation: Review outputs with a qualified professional when legal strategy, litigation, arbitration, diagnosis, or treatment judgment is involved.

Risk: Incomplete case materials can lead to weak or misleading appeal analysis.

Mitigation: Base clause citations and factual analysis on the user-provided policy, denial notice, medical records, and supporting evidence; ask for missing materials before drawing conclusions.

## Reference(s):

- [ClawHub skill page](https://clawhub.ai/baozhiyin/skills/insurance-claim-appeal)
- [Claim appeal paths](references/appeal_paths.md)
- [Compliance boundaries](references/compliance.md)
- [Legal basis](references/legal_basis.md)
- [Rejection scenarios](references/rejection_scenarios.md)
- [Appeal letter template](assets/appeal_letter_template.md)
- [Complaint letter template](assets/complaint_letter_template.md)
- [Evidence checklist](assets/evidence_checklist.md)

## Skill Output:

**Output Type(s):** [Analysis, Markdown, Guidance, Files]

**Output Format:** [Markdown with structured sections and draft document templates]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [May include case summaries, rejection analysis, appeal-path recommendations, evidence checklists, appeal letters, complaint drafts, and compliance disclaimers.]

## Skill Version(s):

1.0.0 (source: frontmatter and server release metadata)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
