## Description: <br>
Mandatory verification steps for all code reviews to reduce false positives. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[anderskev](https://clawhub.ai/user/anderskev) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
Developers and review agents use this skill to apply a stricter verification protocol before reporting Rust code review findings. It emphasizes same-turn evidence, full-scope reading, usage searches, edition checks, and distinguishing defects from style preferences. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: The protocol may cause review agents to inspect more project files during code review. <br>
Mitigation: Use it in repositories where broader context reading is acceptable, and review cited file paths and lines before acting on findings. <br>


## Reference(s): <br>
- [ClawHub skill page](https://clawhub.ai/anderskev/review-verification-protocol) <br>


## Skill Output: <br>
**Output Type(s):** [guidance, markdown, shell commands] <br>
**Output Format:** [Markdown guidance with checklist items and command references] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [No executable code, credentials, persistence, or hidden data flow were identified in the security evidence.] <br>

## Skill Version(s): <br>
1.0.18 (source: server release evidence) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
