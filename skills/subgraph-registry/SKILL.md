---
name: subgraph-registry-mcp
description: Discover and filter 15,330 The Graph subgraphs by domain, network, protocol type, or natural language goal. Each result includes an x402 query URL — $0.01 USDC on Base per call, no API key required.
metadata:
  {"openclaw": {"requires": {"bins": ["node"]}, "homepage": "https://github.com/PaulieB14/subgraph-registry"}}
---

# Subgraph Registry

Agent-friendly discovery of 15,330 classified subgraphs on The Graph Network. Search by domain, network, protocol type, or natural language goal — get reliability-scored results with **x402-ready query URLs**. Agents can go from question → answer without ever touching a Studio API key.

## Tools

- **search_subgraphs** — Filter by domain (defi, nfts, dao, gaming), network (ethereum, arbitrum, base — aliases resolve to mainnet, arbitrum-one, etc.), protocol type (dex, lending, bridge), entity type, or keyword. Testnets excluded by default (`include_testnets` to opt in); each result carries `testnet`. Returns `age_days` + `maturity` per result, and a separate `emerging` list of recent matches that the (cumulative, therefore age-biased) reliability score buries — read `emerging_caveat` before recommending one
- **recommend_subgraph** — Natural language goal like "find DEX trades on Arbitrum" returns the best matching subgraphs
- **get_subgraph_detail** — Full classification, entities, reliability score, x402 + legacy query URLs, and step-by-step query instructions for both paths
- **list_registry_stats** — Registry overview with available domains, networks, and protocol types
- **semantic_search_subgraphs** — Embedding-based natural-language search over the registry. Uses a bundled ONNX model via `@xenova/transformers`; **if the bundled model is missing it downloads it once from Hugging Face** (see Network & Data Behavior). Skip this tool for a strictly offline runtime.
- **get_schema_changes** — Report schema/entity changes for a subgraph across indexed versions

## Query paths

Every result now ships with two URLs and a `pricing` manifest:

- **`query_url_x402`** *(recommended)* — `https://gateway.thegraph.com/api/x402/subgraphs/id/{id}`. POST your GraphQL query; the gateway returns HTTP 402 with a payment manifest. Use an x402 client (`@graphprotocol/client-x402`, `x402-fetch`, or any generic wrapper) to sign **$0.01 USDC on Base** via EIP-3009 and retry. No signup, no Studio key, no GRT.
- **`query_url`** *(legacy)* — `https://gateway.thegraph.com/api/[api-key]/subgraphs/id/{id}`. Get an API key from [thegraph.com/studio/apikeys](https://thegraph.com/studio/apikeys/) and replace the placeholder.

## Requirements

- **Runtime:** Node.js >= 18 (runs via `npx`)
- **Environment variables:** None required. The registry is pre-built and bundled — no API key needed for read-only use.
- **For x402 queries:** USDC on Base in the agent's signing wallet (one query ≈ $0.01).

## Install

Pin a known-good version. Audit the source on GitHub before installing if you
plan to ship this in an autonomous-agent runtime.

```bash
# Pin to a published version, do not run unpinned (`npx subgraph-registry-mcp`
# without @VERSION will pull whatever's latest at the moment).
npx subgraph-registry-mcp@0.9.9
```

## Network & Data Behavior

- The `registry.db` (SQLite) is **bundled inside the npm package** — no download and no API key needed for read-only use. (If it's ever missing, e.g. a bare source checkout, the server falls back to downloading it from the [GitHub repository](https://github.com/PaulieB14/subgraph-registry).)
- The downloaded file's SHA-256 is **verified against a hash pinned in the npm package** before loading — see "Verifying the registry" below. A mismatched file is deleted and the server refuses to start.
- Filter/lookup tools (`search_subgraphs`, `recommend_subgraph`, `get_subgraph_detail`, `list_registry_stats`, `get_schema_changes`) run entirely against the local database — no external API calls at query time.
- **Exception — `semantic_search_subgraphs`:** it loads a bundled ONNX embedding model via `@xenova/transformers`. If that bundled model is not present, the runtime downloads it **once** from Hugging Face (`huggingface.co`), then caches it. This is the only query-time network call. Don't call this tool (or pre-bundle the model) for a strictly air-gapped runtime.
- **Optional local HTTP/SSE server:** default transport is **stdio** (no listener). Passing `--http` or `--http-only` starts a local HTTP/SSE server on port 3848 (`MCP_HTTP_PORT` to change), exposing `/messages`, health, and OpenAPI/manifest endpoints. It is off unless you pass those flags — bind only to trusted/firewalled environments.

## Verifying the registry

The npm package version `0.9.9` ships with this expected hash:

```
SHA-256(registry.db) = 425b7a5bde8f61d8ae2f26ea6e201ffd3308c3328a0547fb0d29530222eba0d2
```

This hash is hard-coded in `src/index.js` (`EXPECTED_DB_SHA256`). On every run,
the server checks the cached or freshly-downloaded `registry.db` against it. If
the hashes don't match — which would happen if the GitHub-hosted file were
swapped, or your local cache were tampered with — the server **refuses to load
the database** and exits with an error. The bad file is deleted so the next run
attempts a fresh download.

Verify manually:

```bash
shasum -a 256 ~/.npm/_npx/*/node_modules/subgraph-registry-mcp/data/registry.db
# (path varies by npx cache layout; the file is the one referenced as
# `data/registry.db` inside the package)
```

If you intentionally rebuilt the DB locally (using the optional Python
crawler), the hash will not match. Set `SUBGRAPH_REGISTRY_SKIP_VERIFY=1` to
bypass — never set this in an agent-runtime default config.

When the registry is regenerated, the maintainer bumps the npm version *and*
updates the hash constant atomically — so a given npm version uniquely
corresponds to a known DB.

## Use Cases

- Discover the right subgraph before querying The Graph
- Find high-reliability DeFi, NFT, DAO, or governance subgraphs by chain
- Get query URLs and entity schemas without manual exploration
- Compare subgraphs by reliability score (query fees, curation signal, indexer stake)
