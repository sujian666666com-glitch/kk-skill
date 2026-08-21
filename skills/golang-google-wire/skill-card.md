## Description:

Compile-time dependency injection in Golang using google/wire, including provider sets, injectors, interface bindings, struct providers, value providers, cleanup functions, build tags, and generated wire_gen.go files.

This skill is ready for commercial/non-commercial use.

## Publisher:

[samber](https://clawhub.ai/user/samber)

### License/Terms of Use:

MIT-0

## Use Case:

Developers and engineers use this skill when adopting or maintaining google/wire in Go projects. It helps them design provider sets, write injector files, resolve common Wire errors, regenerate committed wire_gen.go files, and test wired applications.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The skill may propose edits to Go providers or injectors and regenerate committed wire_gen.go files, which can change application startup behavior.

Mitigation: Review generated diffs like normal code changes and run wire check, wire generation, and Go tests before merging.

Risk: The documented install flow can install or run the wire tool in a Go workspace.

Mitigation: Install tools in a controlled developer or CI environment and pin tool versions when reproducible builds are required.

## Reference(s):

- [ClawHub skill page](https://clawhub.ai/samber/skills/golang-google-wire)
- [OpenClaw skill repository homepage](https://github.com/samber/cc-skills-golang)
- [google/wire package documentation](https://pkg.go.dev/github.com/google/wire)
- [google/wire repository](https://github.com/google/wire)
- [google/wire user guide](https://github.com/google/wire/blob/main/docs/guide.md)
- [google/wire best practices](https://github.com/google/wire/blob/main/docs/best-practices.md)
- [Advanced google/wire reference](references/advanced.md)
- [google/wire recipes](references/recipes.md)
- [google/wire testing guidance](references/testing.md)

## Skill Output:

**Output Type(s):** [Text, Markdown, Code, Shell commands, Configuration, Guidance]

**Output Format:** [Markdown with inline Go and bash code blocks]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [May include proposed edits to Go provider and injector files, wire commands, testing commands, and generated-code review guidance.]

## Skill Version(s):

1.1.0 (source: release evidence and frontmatter)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
