## Description:

本地优先的架构图与结构图生成工具，可帮助代理生成系统架构图、流程图、时序图、状态机图、网络拓扑图、ER 图、数据流图、微服务或云原生架构图和甘特图，并支持自包含 HTML、内联 SVG 与 Mermaid 输出。

This skill is ready for commercial/non-commercial use.

## Publisher:

[chesaram](https://clawhub.ai/user/chesaram)

### License/Terms of Use:

MIT-0

## Use Case:

Developers, architects, and technical writers use this skill to turn system descriptions, explicit workspace files, and diagram requests into local architecture or structure diagrams. It is suited for documenting software systems, workflows, network topology, data models, service interactions, and project timelines without requiring cloud services, Node.js, or API keys.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The skill can activate on broad diagram-related words such as draw or architecture.

Mitigation: Confirm the requested diagram type, output format, and scope before generating diagrams when intent is ambiguous.

Risk: Generated diagrams may summarize or transform user-provided workspace files incorrectly.

Mitigation: Review generated diagram content against the source files before relying on it for documentation or decision-making.

Risk: Providing unintended file paths can expose local workspace content to the diagram summary.

Mitigation: Only provide file paths that should be read and summarized for the diagram.

## Reference(s):

- [Skill page](https://clawhub.ai/chesaram/skills/architect-diagram-pro)
- [README](artifact/README.md)
- [Capability matrix](artifact/references/capability-matrix.md)
- [Clarification gate](artifact/references/clarification-gate.md)
- [Diagram types](artifact/references/diagram-types.md)
- [Architecture layout](artifact/references/architecture-layout.md)
- [Arrow text clearance](artifact/references/arrow-text-clearance.md)
- [HTML template guide](artifact/references/html-template-guide.md)
- [Self-check and errors](artifact/references/self-check-and-errors.md)

## Skill Output:

**Output Type(s):** [text, markdown, code, configuration, guidance]

**Output Format:** [Markdown with HTML, SVG, or Mermaid code blocks and concise guidance]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Generated artifacts are intended to remain local to the workspace; supported diagram outputs are self-contained HTML, inline SVG, and Mermaid source.]

## Skill Version(s):

1.0.0 (source: frontmatter and server release metadata)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
