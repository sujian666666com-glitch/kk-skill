## Description:

Discover and filter 15,330 The Graph subgraphs by domain, network, protocol type, or natural language goal. Each result includes an x402 query URL at $0.01 USDC on Base per call, with no API key required.

This skill is ready for commercial/non-commercial use.

## Publisher:

[paulieb14](https://clawhub.ai/user/paulieb14)

### License/Terms of Use:

MIT

## Use Case:

Developers and external agent builders use this skill to discover, filter, and select The Graph subgraphs before running their own GraphQL queries through an API-key or x402 payment path.

### Deployment Geography for Use:

Global

## Known Risks and Mitigations:

Risk: Optional HTTP/SSE transport can expose local MCP endpoints if intentionally enabled.

Mitigation: Keep the default stdio transport unless HTTP/SSE is required; if enabled, run it only on a trusted or firewalled host.

Risk: Returned x402 URLs may be used by downstream wallet-enabled agents to spend funds.

Mitigation: Set explicit spending limits and approval policy in any downstream agent or wallet client.

Risk: Dependency resolution can change when installing without a pinned version.

Mitigation: Install a pinned release such as subgraph-registry-mcp@0.9.9 and review dependency resolution for high-control runtimes.

Risk: Semantic search may need network access if its bundled embedding model is missing.

Mitigation: Pre-bundle the model or avoid semantic_search_subgraphs in strictly offline environments.

## Reference(s):

- [ClawHub skill page](https://clawhub.ai/paulieb14/skills/subgraph-registry)
- [Project homepage](https://github.com/PaulieB14/subgraph-registry)
- [The Graph](https://thegraph.com)
- [Graph Studio API keys](https://thegraph.com/studio/apikeys/)
- [Graph x402 client package](https://www.npmjs.com/package/@graphprotocol/client-x402)
- [Glama MCP listing](https://glama.ai/mcp/servers/PaulieB14/subgraph-registry)

## Skill Output:

**Output Type(s):** [Text, Markdown, JSON, API Calls, Guidance]

**Output Format:** [MCP tool responses with structured JSON data and human-readable query guidance]

**Output Parameters:** [1D]

**Other Properties Related to Output:** [Returns discovery results, reliability signals, example GraphQL queries, x402 payment URLs, legacy API-key URLs, registry statistics, and schema-change summaries.]

## Skill Version(s):

0.9.9 (source: package.json and server evidence)

## Ethical Considerations:

Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment.
