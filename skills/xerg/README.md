# Xerg

Find wasted AI spend in OpenClaw, Hermes, QM, Claude Code, Cursor, and any framework that can export a JSON event payload.

Xerg is a local-first CLI for auditing AI spend in dollars, not raw token counts. It reads OpenClaw logs/transcripts or an independent sanitized trace capture, Hermes v0.17-v0.20.1 `state.db` with optional observer/certified trace enrichment, QM snapshots, Claude Code transcripts, and Cursor usage exports — plus event payloads from any framework via `xerg ingest` — separates three evidence-strict monetary findings from seven neutral signals, reports what each detector assessed, and lets you measure compatible fixes with `--compare`.

Everything runs locally by default. The CLI is publicly installable from npm as `@xerg/cli`, but it is not open source. No account is required for local audits. A Free hosted workspace keeps the last 30 days of pushed audits and groups related incremental snapshots into expandable series; hosted MCP is included with Team, Growth, Scale, and Enterprise.

Hosted pricing uses Monthly Audited Agent Spend from known spend in explicitly pushed runtime audits: Free through $2,000 per UTC month, Team at $99 through $10,000, Growth at $299 through $50,000, Scale at $799 through $250,000, and custom Enterprise above $250,000. Team, Growth, and Scale have identical capabilities. Historical imports, duplicate-review spend, and unpriced usage do not count toward MAAS.

The `npx @xerg/cli@latest` path fetches and executes the published npm package before running Xerg. If you want to avoid that fetch on each use, install the CLI globally with `npm install -g @xerg/cli`.

## Install

Give a terminal-capable agent the universal cold-fetch prompt:

```text
set up https://xerg.ai/skill.md
```

The agent must ask before persistent installation, runs `doctor`, and offers a local audit before any upload.

Install this skill into any agent that supports the Agent Skills standard (Claude Code, Codex, Cursor, and others):

```bash
npx skills add xergai/skills
```

Then ask your agent to audit your AI spend. The agent runs the CLI itself and explains the findings.

Install the CLI directly:

```bash
npm install -g @xerg/cli
```

Or run without installing:

```bash
npx @xerg/cli@latest init
```

## What It Finds

- **Retry waste** from stable charged failed/aborted attempt chains ending in success
- **Tool-loop waste** from exact no-progress tool input/result/state repetitions
- **Cache churn** only when a cache lifecycle costs more than its uncached counterfactual
- Seven separate neutral signals for deep loops, context outliers/growth, fixed cadence, premium-model routine labels, cache-read concentration, and Max Mode concentration

Current JSON findings carry affected and avoidable spend, evidence and impact bases, and detector version. Signals carry bounded observed metrics plus optional associated spend and basis; associated spend is never classified as waste. Compare output reports monetary deltas only when active-finding coverage is compatible.

Claude Code streaming records are reconstructed before analysis. Repeated tool-name chains are reported as neutral argument-diversity evidence, with only SHA-256 input/result digests and byte counts retained locally. A high distinct-input ratio is consistent with fan-out, while a low ratio is a reason to inspect; neither creates avoidable spend. Use `xerg explain <item-id>` to inspect a saved finding, signal, or chain packet.

## Quick Start

Interactive first run (humans):

```bash
xerg init
xerg audit --compare
```

Non-interactive path (agents, scripts, CI):

```bash
npx --yes @xerg/cli@latest doctor --json
xerg audit --json
xerg audit --json --compare
xerg collect openclaw
xerg collect hermes --state-db ~/.hermes/state.db
xerg doctor --runtime qm
xerg audit --runtime qm --since 7d
xerg audit --otlp-file ./openclaw.capture.jsonl
```

Add `--runtime openclaw`, `--runtime hermes`, or `--runtime claude-code` when more than one local runtime is detected. QM is never auto-detected and always uses `--runtime qm` after administrator setup.

SSH and Railway comparison identity includes the normalized `--since` window. Equivalent values such as `024h` and `24h` share identity; a different window intentionally starts a separate comparison and hosted-dedup history.

## Sources

- Local machine: OpenClaw, Hermes, and Claude Code (`xerg audit --runtime claude-code`)
- Explicit QM source: host-independent `qm-snapshot/v1`, strict view-only direct PostgreSQL, or the certified Fly-contained exporter
- Independent local OpenClaw traces: `xerg collect openclaw` or `xerg audit --otlp-file <capture.jsonl>`
- Certified local Hermes trace enrichment: `xerg collect hermes --state-db <path>` or `xerg audit --runtime hermes --state-db <path> --otlp-file <capture.jsonl>`
- Local Cursor usage export: `xerg audit --cursor-usage-csv ./cursor-usage.csv`
- Any framework's exported event payload: `xerg ingest --file payload.json`
- Remote OpenClaw sources via SSH or configured remote transports

If local defaults are empty, inspect the target directly first with `xerg doctor --remote user@host`.

## Optional Hosted Follow-Up

```bash
xerg activate --push-latest
xerg mcp-setup
```

- `activate` offers browser approval and pushes the latest audit; add `--organization-id org_...` to require one exact Clerk workspace, or `--connect-only` to pair without auditing or pushing
- `mcp-setup` prints or writes hosted MCP config for supported clients
- after an approved push, Overview leads with strictly validated seven-day before/after savings when available, keeps current waste separate, and can group identified-waste rates by department or runtime posture; runtime posture remains Not set until a workspace admin assigns `vpc`, `on-prem`, `saas`, `local`, `hybrid`, or `air-gap`, and is never inferred from audit evidence. Audit Detail adds daily Performance and detector-attributed Workflow economics, while Compare retains outcome evidence and Signal guidance remains explicitly non-monetary
- local audits and compare remain available if you skip hosted setup

## Security And Data Flow

- Local audits read OpenClaw, Hermes, QM snapshots, Claude Code, Cursor usage, or ingest payload files and may write local JSON snapshots for `--compare`.
- Local commands remain telemetry-free. Explicit hosted pairing and push requests carry only a fixed, content-free execution-context envelope; the canonical skill sets a bounded `XERG_AGENT_HOST` hint on the same approved hosted command.
- Hermes uses `~/.hermes/state.db` read-only by default and as its sole monetary authority. Optional observer telemetry and certified trace enrichment preserve authoritative token buckets and `economicAuditId`; analysis `auditId` changes when coverage/findings change. Push v7 includes content-free finding/signal coverage, daily pricing-coverage counts, and eligible evidence-strict results; detailed mechanics remain local.
- Xerg 0.24.2 certifies Hermes state schemas 16-25. Its observer maintains a bounded per-process health sidecar outside the evidence ledger. Before new Xerg-directed Hermes activity, run `xerg doctor --runtime hermes --require-observer-live`; failed preflight exits `5`, and restarting covers only future activity. Existing aggregate audits remain available with their limitation before totals and conclusions.
- Hermes v0.20 terminal generated/truncated values may be conservative byte floors and render as “At least”; returned bytes remain exact, and Xerg never dereferences a Hermes spill path. Xerg 0.24.0 terminal mechanics were not certified for v0.20.x and could understate these values. Hermes v0.20.1 auxiliary tasks such as `title_generation` remain task-scoped aggregates when public request hooks do not expose them; their economics stay included and their sequence analysis stays explicitly unavailable.
- QM currently supports one-shot snapshot, strict direct, and Fly-contained collection. Strict direct mode uses a dedicated export-view-only reader. Fly Managed Postgres instead uses a disclosed one-shot process boundary inside QM core and does not claim database least privilege. Both use a backed-up identity key and HMAC raw IDs before persistence; content fields are not exported, and `openrouter/auto` placeholders remain unpriced. Offline QM Slack audits accept only an authorized pre-created snapshot. The CLI must be explicitly approved, provisioned, and version-verified by an operator in the administrator's private runtime; agents must not install it implicitly or initiate live collection. The runtime receives no database URL, identity key, Fly token, provider credential, or Xerg credential. Continuous follow capture, durable tool-history capture beyond QM's retention window, and live Slack-triggered collection are not currently supported.
- Both trace collectors bind only to loopback, sanitize before persistence, receive traces only, and never push automatically. `analysisCoverage`, `toolActivity`, and `workloadEconomics` remain local.
- Remote OpenClaw audits pull selected files to local temporary storage before analysis.
- Xerg Cloud sync only happens when you run `connect`, `audit --push`, or `push`.
- Push payloads include audit totals, rollups, findings, recommendations, comparison deltas, and source metadata. They exclude raw prompt and response content, local source file paths, local snapshot store paths, and internal finding details.
- Push v7 carries separate content-free findings, signals, per-detector coverage, and daily pricing coverage. Signals may include an optional human-readable workflow/run label; current producers also add an optional requested audit interval, detector-attributed workflow waste, and detector-versioned comparison finding changes. Older v7/v6 payloads remain valid without those additive fields. Push v6 remains accepted and meters identically from daily known spend. Evidence references and internal details stay local.
- Local snapshots may contain versioned diagnostic packets with digests, byte counts, local paths, and inspection guidance. Raw or truncated tool arguments/results are never stored, and diagnostics, digests, paths, and per-TTL cache buckets never cross Push v7.
- Runtime costs may be observed, locally estimated, or unpriced. They are not authoritative provider invoices; Xerg does not currently ingest provider bills, reconcile invoices, or convert runtime audits to FOCUS.

## CI And Automation

```bash
xerg audit --push --fail-above-waste-rate 0.25
xerg audit --fail-above-waste-usd 100
xerg audit --json
```

## Links

- Docs: [xerg.ai/docs](https://xerg.ai/docs)
- Service status: [status.xerg.ai](https://status.xerg.ai)
- Skill: [xerg.ai/skill.md](https://xerg.ai/skill.md)
- npm: [@xerg/cli](https://www.npmjs.com/package/@xerg/cli)
- Pricing: [xerg.ai/pricing](https://xerg.ai/pricing)
- Support: `hello@xerg.ai`

## Ownership

This skill is maintained by [Xerg](https://xerg.ai) and synced to the public [xergai/skills](https://github.com/xergai/skills) repo from the Xerg release train, versioned with `@xerg/cli`. The skill content is free to install and use with any agent; the Xerg CLI it drives is publicly installable from npm but not open source.
