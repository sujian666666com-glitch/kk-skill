## Description:

Multi-target parallel file copy CLI that reads a source directory once into memory and writes it to multiple USB drives or target directories concurrently.

This skill is ready for commercial/non-commercial use.

## Publisher:

[dongsheng123132](https://clawhub.ai/user/dongsheng123132)

### License/Terms of Use:

MIT-0

## Use Case:

Developers, operators, and automation agents use this skill to copy the same source directory to multiple removable drives or target directories in parallel, with optional verification, incremental copy, dry-run, quiet, verbose, and JSON output modes.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The tool writes to every listed target and may replace files at matching paths.

Mitigation: Run with --dry-run first and verify each target mount point or drive letter before copying.

Risk: Incorrect removable-drive targets can cause files to be copied to unintended destinations.

Mitigation: Use explicit, verified mount points or drive letters and review verification results after the run.

## Reference(s):

- [ClawHub Skill Page](https://clawhub.ai/dongsheng123132/skills/fastcp)

## Skill Output:

**Output Type(s):** [Shell commands, Configuration, JSON, Guidance]

**Output Format:** [Markdown with inline shell commands and optional JSON result schema]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Supports human-readable terminal output, auto-quiet non-TTY behavior, and machine-readable JSON output with ok, targets, and elapsed fields.]

## Skill Version(s):

1.1.1 (source: frontmatter and server release evidence)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
