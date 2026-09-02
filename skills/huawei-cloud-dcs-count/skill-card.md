## Description:

Counts Huawei Cloud DCS Redis and Memcached instances in a region, including total, engine-specific, status-filtered, and per-status counts, using read-only API queries.

This skill is ready for commercial/non-commercial use.

## Publisher:

[erickeyhu-hug](https://clawhub.ai/user/erickeyhu-hug)

### License/Terms of Use:

MIT-0

## Use Case:

External developers, cloud engineers, and operators use this skill to count Huawei Cloud DCS Redis and Memcached instances by region, engine, and lifecycle status for inventory, daily inspection, cost review, capacity planning, and migration checks.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: Credentials may be exposed if Huawei Cloud AK/SK values are hardcoded or shared in commands.

Mitigation: Use environment variables or an hcloud CLI profile, and avoid storing AK/SK values in scripts, documents, or logs.

Risk: Overbroad cloud permissions can expose more DCS data than the counting workflow requires.

Mitigation: Use the documented read-only IAM policy or DCS ReadOnlyAccess rather than create, delete, or modify permissions.

Risk: Installing KooCLI with sudo from an unverified download source can introduce supply-chain risk.

Mitigation: Verify the KooCLI download source before running installation commands with elevated privileges.

Risk: Running the test script with untrusted region variables or template values can execute unintended CLI input.

Mitigation: Run tests only with trusted region values and reviewed template variables.

## Reference(s):

- [CLI Installation Guide](references/cli-installation-guide.md)
- [IAM Policies](references/iam-policies.md)
- [Verification Method](references/verification-method.md)
- [Data Flow Diagram](references/dataflow-diagram.md)
- [Acceptance Criteria](references/acceptance-criteria.md)
- [Security Audit Report](references/security-audit-report.txt)
- [ClawHub Skill Page](https://clawhub.ai/erickeyhu-hug/skills/huawei-cloud-dcs-count)

## Skill Output:

**Output Type(s):** [Text, Shell commands, Code, Configuration, Guidance]

**Output Format:** [Markdown with inline bash and Python code blocks; runtime results are plain text counts or JSON-derived values.]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Read-only Huawei Cloud DCS inventory queries requiring a region and authenticated CLI or SDK credentials.]

## Skill Version(s):

1.0.1 (source: server release evidence)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
