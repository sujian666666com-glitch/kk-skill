## Description:

Accesses Wikipedia through MCP to search articles, retrieve summaries and extracts, fetch images and media lists, inspect categories, links, pageviews, current news, top reads, and daily historical content across supported language editions.

This skill is ready for commercial/non-commercial use.

## Publisher:

[evanfoglia](https://clawhub.ai/user/evanfoglia)

### License/Terms of Use:

MIT

## Use Case:

External users, developers, and content or research workflows use this MCP server to retrieve Wikipedia article information, media, popularity signals, and daily topical content without an API key.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: The skill makes outbound requests to Wikipedia and Wikimedia services.

Mitigation: Deploy only where outbound access to those public endpoints is acceptable and monitor responses according to local data handling policy.

Risk: The local quote feature is English-only despite the skill's broader multi-language Wikipedia support.

Mitigation: Treat quote output as English-only and use the language parameter for Wikipedia-backed tools rather than quote localization.

Risk: Dependency reproducibility depends on an unpinned lower bound for requests.

Mitigation: Install with a pinned requests version or lockfile when reproducible deployments are required.

## Reference(s):

- [ClawHub skill page](https://clawhub.ai/evanfoglia/skills/wikipedia)
- [Wikipedia REST API endpoint](https://en.wikipedia.org/api/rest_v1)
- [MediaWiki Action API endpoint](https://en.wikipedia.org/w/api.php)

## Skill Output:

**Output Type(s):** [text, markdown, API calls]

**Output Format:** [Markdown text with article links, image URLs, media metadata, trend summaries, and source links.]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Requires outbound Wikipedia/Wikimedia access; the quote tool accepts a language parameter but returns English-only curated quotes.]

## Skill Version(s):

1.1.11 (source: server-resolved release metadata and server.py; SKILL.md frontmatter lists 1.1.10)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
