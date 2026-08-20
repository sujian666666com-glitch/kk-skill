## Description:

Queries Huawei Cloud ELB load balancers within a configured region and project, with optional name and operating-status filters and JSON or Markdown output.

This skill is ready for commercial/non-commercial use.

## Publisher:

[yangaiwu](https://clawhub.ai/user/yangaiwu)

### License/Terms of Use:

MIT-0

## Use Case:

Developers and cloud operators use this skill to inspect Huawei Cloud Elastic Load Balancer inventory for a selected region and project, including load balancer identifiers, status, VIP, EIP, availability zones, and type.

### Deployment Geography for Use:

Global; operation is limited to the configured Huawei Cloud region and project.

## Known Risks and Mitigations:

Risk: Huawei Cloud access keys could expose broader account access if used in a shared agent environment.

Mitigation: Use an IAM identity limited to read-only ELB listing for the intended region and project, and provide credentials only through environment variables in trusted sessions.

Risk: Unpinned Huawei SDK dependencies can make installs less repeatable over time.

Mitigation: Pin or lock huaweicloudsdkelb and huaweicloudsdkcore versions before deploying the skill in a controlled environment.

## Reference(s):

- [ClawHub skill page](https://clawhub.ai/yangaiwu/skills/hcs-elb-loadbalancers)
- [Huawei Cloud ELB load balancer API notes](artifact/elb-loadbalancers-api.md)

## Skill Output:

**Output Type(s):** [text, markdown, code, shell commands, configuration]

**Output Format:** [JSON by default, with optional Markdown table output.]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Supports mock output without credentials and live read-only API calls when Huawei Cloud credentials are provided.]

## Skill Version(s):

0.1.0 (source: frontmatter and release evidence)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
