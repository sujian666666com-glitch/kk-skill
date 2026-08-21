## Description:

Build a Go service on psyb0t/servicepack, a clone-and-own framework for creating related Go services that can be debugged together locally and deployed as one binary or split into microservices with retry, dependency, readiness, CLI, lifecycle, logging, and graceful-shutdown patterns.

This skill is ready for commercial/non-commercial use.

## Publisher:

[psyb0t](https://clawhub.ai/user/psyb0t)

### License/Terms of Use:

MIT-0

## Use Case:

Developers and engineers use this skill when starting or extending Go service projects that need concurrent service execution, dependency-aware startup, readiness gates, retries, per-service commands, and graceful shutdown. It guides users through cloning the servicepack template, making it their own module, adding services, and using the Docker-backed make workflow.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The clone-and-own setup step can reset Git history in the cloned template.

Mitigation: Run `make own` only inside a fresh disposable clone of the template, not in an existing project or a repository with work that must be preserved.

Risk: Generated or framework-owned service files may be overwritten by servicepack update workflows.

Mitigation: Keep custom changes in documented extension points such as services, lifecycle hooks, and project-owned files, and review generated service code before deployment.

Risk: Docker-backed make targets build, test, generate, and run project code.

Mitigation: Review the make targets and generated code before using them in a production workflow.

## Reference(s):

- [servicepack ClawHub release](https://clawhub.ai/psyb0t/skills/servicepack)
- [servicepack GitHub repository](https://github.com/psyb0t/servicepack)
- [Setup](references/setup.md)

## Skill Output:

**Output Type(s):** [guidance, markdown, code, shell commands, configuration]

**Output Format:** [Markdown with Go code examples and shell command blocks]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [May include Docker-backed make targets, Go service scaffolding guidance, configuration notes, and review guidance for generated service code.]

## Skill Version(s):

1.9.1 (source: server release evidence)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
