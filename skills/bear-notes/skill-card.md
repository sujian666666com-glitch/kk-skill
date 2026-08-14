## Description: <br>
Create, search, and manage Bear notes via the grizzly CLI. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[steipete](https://clawhub.ai/user/steipete) <br>

### License/Terms of Use: <br>


## Use Case: <br>
Developers and Bear users on macOS use this skill to have an agent create, read, search, append to, and organize Bear notes through the grizzly CLI. It supports local note-management workflows where the user controls Bear and can preview actions before they affect notes. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: The grizzly CLI stores the Bear API token in a local plaintext file. <br>
Mitigation: Treat the token like a password, restrict permissions on ~/.config/grizzly and the token file, and avoid putting real tokens into shell history. <br>
Risk: The skill can help an agent read or change local Bear notes. <br>
Mitigation: Review proposed commands before execution and use --dry-run or --print-url when previewing actions before they affect notes. <br>


## Reference(s): <br>
- [Bear Notes on ClawHub](https://clawhub.ai/steipete/skills/bear-notes) <br>
- [Bear](https://bear.app) <br>
- [grizzly CLI module](https://github.com/tylerwince/grizzly) <br>


## Skill Output: <br>
**Output Type(s):** [text, markdown, shell commands, configuration, guidance] <br>
**Output Format:** [Markdown guidance with bash and TOML snippets] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [Some grizzly commands can return JSON when Bear callbacks are enabled.] <br>

## Skill Version(s): <br>
1.0.0 (source: server release metadata) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
