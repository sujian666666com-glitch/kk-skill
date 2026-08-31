---
name: xerg
description: Audit and reduce AI agent runtime spend in dollars. Use for AI costs, agent spend, token waste, runtime attribution, detector coverage, and FinOps. Works with OpenClaw, Hermes, QM, Claude Code, Cursor, and generic event ingest.
homepage: https://xerg.ai
metadata:
  xerg:
    homepage: https://xerg.ai
    links:
      skill: https://xerg.ai/skill.md
      documentation: https://xerg.ai/docs
      status: https://status.xerg.ai
    requires:
      anyBins:
        - xerg
        - npx
      config:
        - ~/.xerg/config.json
        - ~/.config/xerg/credentials.json
        - ~/.xerg/remotes.json
        - ~/.xerg/qm.json
    install:
      - kind: node
        package: "@xerg/cli"
        bins:
          - xerg
    envVars:
      - name: XERG_API_KEY
        required: false
        description: Advanced CI-only credential for non-interactive hosted push and MCP setup.
      - name: XERG_API_URL
        required: false
        description: Optional override for the Xerg API endpoint; defaults to https://api.xerg.ai.
      - name: XERG_AGENT_HOST
        required: false
        description: Best-effort bounded host hint for an explicitly approved hosted pairing or push; not authentication.
    dependencies:
      - name: "@xerg/cli"
        type: npm
        url: https://www.npmjs.com/package/@xerg/cli
      - name: ssh
        type: other
        url: https://www.openssh.com/
      - name: rsync
        type: other
        url: https://rsync.samba.org/
      - name: railway
        type: npm
        repository: https://github.com/railwayapp/cli
      - name: fly
        type: other
        url: https://fly.io/docs/flyctl/
---

# Xerg

Xerg is a local-first CLI for finding wasted AI runtime spend. Runtime audits separate three evidence-strict monetary findings from seven neutral signals, report detector coverage, and use `--compare` to measure compatible changes. Runtime costs may be observed, locally estimated, or unpriced; they are not authoritative provider invoices.

Hosted pricing uses Monthly Audited Agent Spend from known spend in explicitly pushed runtime audits: Free through $2,000 per UTC month, Team at $99 through $10,000, Growth at $299 through $50,000, Scale at $799 through $250,000, and custom Enterprise above $250,000. Team, Growth, and Scale have identical capabilities. Historical imports, duplicate-review spend, and unpriced usage do not count toward MAAS.

## Cold-fetch setup

When this file was fetched from `https://xerg.ai/skill.md` (including via the link on the npm listing for `@xerg/cli`) rather than loaded from an installed skill:

1. Identify the current agent host. OpenClaw, Hermes, QM, Claude Code, Cursor, and Codex are setup hosts; they are not automatically the data source being audited. QM can also be the audit source, but only through its explicit administrator-provisioned Xerg connection.
2. Check whether Xerg is already installed for this host. Before writing to a persistent or global skill directory, explain the destination and ask the user for permission.
3. If the host has a supported skill installer, use it after permission. OpenClaw can install `xerg` from ClawHub. Agent Skills hosts can install the public `xergai/skills` repository. Hermes can use Xerg's well-known skill discovery. Deterministic host-specific commands live at [xerg.ai/agents](https://xerg.ai/agents).
4. If persistent installation is unavailable or declined, use these fetched instructions for the current session. Do not invent an install location.
5. Ask permission before any npm download or install, including the transient package fetch that `npx` may perform. Separately ask permission before reading/analyzing local runtime data. After both applicable approvals, run `npx --yes @xerg/cli@latest doctor --json`, parse its `canAudit` and `recommendedCommand`, and offer to execute that exact recommendation. On QM, do not use bare doctor: follow the private-scope QM procedure below.

Always ask before uploading. A local audit needs no account and must not be pushed automatically. On an approved hosted command only, set `XERG_SETUP_METHOD=skill` and set `XERG_AGENT_HOST` to the current execution host: `claude_code`, `cursor`, `hermes`, `codex`, `openclaw`, `qm`, or `other`. These are best-effort, content-free analytics metadata, not authentication or the audit source. If the user's setup prompt includes an Xerg organization ID, preserve it with `--organization-id` on activation. After a successful local result, offer to connect and push it with both markers on that same command, for example from Codex:

```bash
XERG_SETUP_METHOD=skill XERG_AGENT_HOST=codex npx --yes @xerg/cli@latest activate --push-latest
```

`activate` opens Xerg in the browser. The signed-in user explicitly approves the currently active workspace; the page shows its full organization ID, live plan, and API environment before any credential is issued. If the intended Clerk ID is already known, recommend `--organization-id org_...` so both the page and API reject another active workspace. The organization switcher preserves the pairing code. The workspace key is encrypted to the initiating CLI and stored with owner-only, environment-bound metadata; never ask the user to paste a key into chat or expose one in a command.

If approval covers pairing only, use `activate --connect-only --organization-id org_...`. It must stop after verified credential storage and must not be combined with a source or push flag. A later audit or push requires its own explicit approval.

Codex is an execution host, not a native Xerg audit source. A Codex user audits whatever `doctor` finds: OpenClaw, Hermes, Claude Code, a Cursor export, or a generic ingest payload.

Local commands remain telemetry-free and add no analytics call. Pairing creation and explicit push requests send a fixed, content-free execution-context envelope. Do not infer Codex from `CODEX_*`, process names, ancestry, or undocumented runtime state; use the explicit hint above only when this skill is running the user-approved hosted command.

If the current host is QM, a cold `set up https://xerg.ai/skill.md` request can explain prerequisites but cannot claim it persisted an admin skill pack, created PostgreSQL privileges, or provisioned secrets. Require an administrator-only private scope. Refuse deployment-wide output in public/shared scopes. Never ask anyone to paste a DSN, identity key, Fly token, provider credential, or Xerg API key into Slack or chat.

## First run (agent execution path)

Use the non-interactive commands. Do not run `xerg init` unless the user explicitly asks for guided interactive setup — it is TTY-only and prompts for input.

Before running the command, ask the user for permission for any npm download/install and separately for permission to inspect local runtime data. A persistent skill write, a transient `npx` package fetch, and local analysis are distinct actions; do not infer approval for one from another.

```bash
npx --yes @xerg/cli@latest doctor --json
```

1. Run doctor in JSON mode first. It returns the CLI version, runtime/product, `canAudit`, checked sources, runtime evidence, notes, pricing-catalog provenance, and a shell-safe `recommendedCommand`. QM is never auto-probed.
2. If doctor resolves Hermes, classify the purpose before starting any new Xerg-directed workload. Always run `npx --yes @xerg/cli@latest doctor --runtime hermes --require-observer-live --json` first. A workload intended to test observer-backed or sequence-dependent findings must hard-stop when this preflight exits `5`. For an already-existing or historical aggregate-economics audit, show the aggregate-only coverage warning and continue with the ordinary recommended audit command; live observer health is not a prerequisite for reading existing economics. Treat this as a continuous production-coverage check, not merely a test prerequisite.
3. When `canAudit` is true, execute the exact `recommendedCommand`; it already selects the detected runtime/path and requests audit JSON. Do not reconstruct the command from prose.
4. If an old global CLI or stale snapshot emits a finding with `ruleId: tool_sequence_repetition_v1`, do not summarize or recommend from that amount. Rerun doctor and the audit through `npx --yes @xerg/cli@latest`, then use only the current result.
5. When any active-finding coverage is none, partial, unsupported, or unknown, put the aggregate-only coverage warning before all spend totals and conclusions. State that aggregate economics remain available where priced, identify the unavailable sequence-dependent analysis, explain that missing historical request sequence cannot be reconstructed and repairs cover only future activity, and never translate zero identified findings into “no waste.” Lead with pricing coverage whenever any calls/tokens are unpriced or limited-estimate. Then summarize total known spend, identified waste (`wasteSpendUsd`), assessed spend from `detectionCoverage`, active findings, neutral signals, and `spendByAgent` when present.
6. Before recommending remediation for any monetary finding, pin the lookup to the audit JSON that produced it: run `npx --yes @xerg/cli@latest explain <finding-id> --audit <auditId>:<generatedAt> --db <dbPath> --json`, using the JSON's exact `auditId`, `generatedAt`, and `dbPath` values with shell-safe quoting. Never use a bare newest-snapshot lookup. If `dbPath` is absent because the audit used `--no-db`, inspect its inline evidence packet and explain that later lookup is unavailable. Verify the required observations, economic meaning, pricing coverage, limitations, and next step; do not recommend a fix from the summary row alone.
7. Present repeated tool-chain and `deep-loop-activity` rows as neutral observations. A high distinct ratio is consistent with fan-out and argues against an identical-input loop, but does not prove success. A low ratio is a reason to inspect, not proof of waste or recoverability. Associated spend is not classified as waste.
8. If the user applies a fix, re-run the same audit with `--compare` to report the before/after delta:

```bash
npx --yes @xerg/cli@latest audit --json --compare
```

If no local data is found, `doctor` prints the paths it checked. Fallbacks:

- Cursor usage CSV export: `npx --yes @xerg/cli@latest audit --cursor-usage-csv ./cursor-usage.csv`
- Claude Code transcripts elsewhere: `--claude-code-dir <path>`
- Hermes profile database: `--runtime hermes --state-db <path>`
- Any framework's exported event payload: `npx --yes @xerg/cli@latest ingest --file payload.json`
- Existing sanitized OpenClaw trace capture: `npx --yes @xerg/cli@latest audit --otlp-file <capture.jsonl>`
- New local OpenClaw trace capture: `npx --yes @xerg/cli@latest collect openclaw` (interactive until `Ctrl-C`; use only when the user asks to collect a workload)
- Certified local Hermes trace enrichment: `npx --yes @xerg/cli@latest collect hermes --state-db <path>` (interactive until `Ctrl-C`; state.db remains required)
- Remote OpenClaw over SSH: `npx --yes @xerg/cli@latest audit --remote user@host`
- Railway-hosted OpenClaw: `npx --yes @xerg/cli@latest audit --railway`
- Existing QM snapshot: `npx --yes @xerg/cli@latest audit --runtime qm --qm-snapshot <snapshot.jsonl>`
- Configured QM direct/Fly source: an operator collects outside Slack; follow the private-scope procedure below only for an authorized snapshot

Use the `npx --yes @xerg/cli@latest` path for first-run and rerun analysis so an old global CLI cannot reintroduce the retired name-only detector. A user may choose a verified current global install for later manual work.

Remote comparison identity includes the normalized `--since` window. Treat `024h` and `24h` as equivalent, treat omitted `--since` as `all`, and never claim comparison or hosted dedup continuity across pre-0.22 and current SSH/Railway snapshots. The first upgraded remote push may consume one Free snapshot or receive the existing at-quota response.

## What It Audits

- OpenClaw gateway logs and session transcripts
- Optional independent OpenClaw trace captures created by the loopback traces-only collector
- Hermes v0.17-v0.20.1 `state.db` (read-only), with legacy log/transcript fallback where present
- QM durable run/model economics and current retained activity through `xerg_export/v1` and `qm-snapshot/v1`
- Claude Code session transcripts via `xerg audit --runtime claude-code`
- Cursor usage CSV exports via `xerg audit --cursor-usage-csv ./cursor-usage.csv`
- Any framework's exported event payload via `xerg ingest --file payload.json`

Xerg does not currently ingest provider bills, reconcile invoices, or convert runtime observations into FOCUS. If a user asks for one of those capabilities, explain the boundary and do not present modeled runtime spend as invoice-authoritative.

## What It Finds

- Retry waste only from a stable charged failed/aborted attempt chain that ends in a higher successful attempt
- Tool-loop waste only from exact repeated tool name/input/result/state evidence with no progress and exact cost correlation
- Cache churn only when a cache-entry lifecycle costs more than its uncached counterfactual
- Neutral signals for deep loops, context outliers/growth, fixed cadence, premium-model routine labels, cache-read concentration, and Max Mode concentration; ordered metrics, optional human-readable workflow/run labels, and optional associated spend remain descriptive, and signals have no avoidable-spend, recommendation, optimization, or CI effect
- Local digest-only evidence packets and `xerg explain` for findings, signals, and qualifying repeated tool chains; raw and truncated tool arguments/results are never retained
- Claude Code streaming reconstruction and argument-aware chain diagnostics; Claude remains ineligible for monetary tool-loop findings because its transcript supplies no defensible state/progress fingerprint
- Per-agent spend attribution, including delegated sub-agent spend for Claude Code sidechains and ingest payloads
- Cost per outcome when runs carry outcome signals; declare outcomes with `xerg outcome --workflow <name> --status success|failure`
- Separate local Hermes mechanical metrics when the optional observer is enabled; these have no dollar classification, recommendation impact, or CI-gate effect
- Shared local `analysisCoverage`, `toolActivity`, and `workloadEconomics` blocks for OpenClaw and Hermes; these are neutral evidence and never affect findings, recommendations, waste totals, or CI gates
- QM request-versus-aggregate reconciliation, pricing coverage, source stability, pseudonymous scope attribution, and current-window unassociated tool activity

Costs are priced across input, output, cache read, and cache write tokens using a reviewed local catalog covering hundreds of current models. Opus 5 includes separate five-minute and one-hour cache-write rates. If a transcript preserves only aggregate cache creation, Xerg uses the documented five-minute default, reports affected tokens, and discloses the possible additional one-hour-cache cost. Audits never fetch pricing from the network. Run `xerg doctor --verbose` to see per-file extraction coverage (which economic signals the parser found).

For current Hermes, use `xerg audit --runtime hermes`; Xerg prefers `~/.hermes/state.db`. Xerg 0.24.2 supports Hermes v0.17-v0.20.1 and certifies state schemas 16-25; later schemas are best-effort and explicitly uncertified. Use `--state-db` for another profile. `--state-db` is mutually exclusive with legacy `--log-file` and `--sessions-dir`. State-only audits retain aggregate spend, request/token/cache, workflow/model/tool, and delegated-workload totals, but first-request cost, initial context, request growth, retry sequences, and identical-input loops are unavailable. The optional `xergai/hermes-observer` plugin writes content-free local events under `~/.hermes/xerg/events/`; it never adds economics or sends content to Xerg Cloud. Complete observer evidence can split an aggregate only after exact request/token reconciliation. Xerg 0.24.2 also maintains a bounded per-process health sidecar for current gateway liveness; those health records never enter evidence, coverage, retention, economics, or audit identity.

Hermes v0.20.1 can record auxiliary tasks such as `title_generation` in `state.db` without firing its public per-request plugin hooks. Preserve their economics as task-scoped aggregates, disclose that their sequence-dependent analysis is unavailable, and do not let them invalidate exact evidence for observable main/delegated requests. Never call a mixed result full request coverage or imply that the observer transparently instruments Hermes's private auxiliary client.

On Hermes v0.20.x, treat generated and truncated terminal quantities labeled “At least” as conservative UTF-8 byte floors; returned bytes remain exact. Do not difference floors, even against other floors, and do not infer or compare generated/truncated values when the measurement basis is missing. Xerg never reads or retains `full_output_path`. A local source-integrity warning that says totals may be floors means Hermes's usage primary key may have dropped distinct task rows; also state the narrower guarantee that totals are exact for rows Hermes recorded. The warning is advisory, non-repairing, local-only, outside audit identity, and absent from pushed payloads. Xerg 0.24.0 was not certified for Hermes v0.20.x terminal mechanics and could understate those byte values; 0.24.1 is the fix.

After installing the observer, restart Hermes and run `xerg doctor --runtime hermes --require-observer-live` before starting new Xerg-directed activity. The strict preflight succeeds only when a current observer process is running and its writer is not known unhealthy; otherwise it exits `5` with the reason. A restart can cover only future activity and never reconstructs historical aggregate sessions. Ordinary historical audits remain available, but their aggregate-only limitation must be disclosed before totals or conclusions. Use `--require-detection-coverage full|partial` for audit-result CI; unmet coverage also exits `5`.

For OpenClaw traces, `xerg collect openclaw` binds only to `127.0.0.1`, accepts OTLP/HTTP protobuf traces, persists a bounded sanitized capture, and audits after shutdown. It does not modify OpenClaw configuration or push automatically. Without explicit `--runtime hermes`, `--otlp-file` is independent OpenClaw evidence and cannot be combined with transcript, log, other-runtime, or remote sources.

For certified Hermes traces, `xerg collect hermes` uses the same loopback traces-only protocol but HMACs identifiers with a persistent local key and requires `state.db`. Use only the exact certified `briancaffey/hermes-otel` commit printed in Xerg's docs. Xerg never installs or edits that plugin. The first-party observer stays primary; cache-inclusive plugin prompt totals are normalized into Xerg's separate input/cache buckets, optional enrichment preserves `economicAuditId` while analysis identity reflects changed coverage, and conflicting evidence restores the original aggregate. For non-default `HERMES_HOME` profiles, use the equivalent environment-variable block printed by the command because the pinned plugin resolves YAML under `~/.hermes`.

## QM private-scope procedure

QM currently supports bounded one-shot collection through a host-independent snapshot adapter. An operator outside Slack creates `qm-snapshot/v1` through either a strict view-only direct reader or the Fly-contained one-shot exporter. Fly contained mode uses QM core's existing `DATABASE_URL` only inside the hidden exporter, records a process boundary with no database-level least-privilege claim, and never exposes that credential to this skill. Do not mutate setup, install/persist the skill, activate, or push without explicit approval.

Offline QM Slack audits accept only an authorized pre-created snapshot. The CLI must be explicitly approved, provisioned, and version-verified by an operator in the administrator's private runtime; agents must not install it implicitly or initiate live collection. The runtime receives no database URL, identity key, Fly token, provider credential, or Xerg credential. Continuous follow capture, durable tool-history capture beyond QM's retention window, and live Slack-triggered collection are not currently supported.

Run doctor before every first audit:

```bash
xerg doctor --runtime qm --qm-snapshot <snapshot.jsonl>
xerg audit --runtime qm --qm-snapshot <snapshot.jsonl> --since 7d --json
```

Operator documentation may explain `--database-url-env`, `--fly-app`, `--print-sql`, and `--print-views-sql`, but the agent must not execute or provision those live paths from Slack. Direct, Fly, and `--qm-snapshot` modes are mutually exclusive.

Explain the result conservatively:

- positive QM cost is observed; an explicit deterministic model may be catalog-estimated
- zero/negative placeholders and unresolved `openrouter/auto` are unpriced, never free or actual `$0`
- unpriced patterns say “monetary impact unavailable” and monetary gates exit `5`
- Pi/OpenCode timestamps are flush/capture time; Claude is near result-step recording; Codex rows are turn aggregates
- request-sequence detectors run only on exactly reconciled request observations; aggregate rows are excluded
- QM keeps activity for one hour, so older tool history is unavailable and tool-to-model association is not claimed
- retry attempts are neutral evidence without spend attribution; unsupported findings are not described as assessed

Local snapshot audit is the default. Ask for explicit approval before `xerg activate --runtime qm`, `audit --push`, or any other hosted write. Xerg's hosted MCP can read an already-pushed pseudonymous summary but has no native QM database or Fly access.

## Optional Cloud

Local audits need no account. To connect a workspace and push the latest local result, ask permission and run:

After selecting the exact bounded value from the mapping above, put it on the same approved hosted command. Codex example:

```bash
XERG_AGENT_HOST=codex npx --yes @xerg/cli@latest activate --push-latest
```

For a website-first user with no cached audit, `npx --yes @xerg/cli@latest activate` securely connects, detects a supported local source, runs the audit, and pushes it. Hosted sync and hosted MCP remain optional and never run without explicit user action.

After an approved push, the hosted Overview leads with strictly validated seven-day before/after savings when available, keeps current waste separate, can group identified-waste rates by department or runtime posture, and retains Source Performance. Department and runtime-posture assignments are current attributes per source on Free and paid plans. Runtime posture remains Not set until a workspace admin assigns one of vpc, on-prem, saas, local, hybrid, or air-gap; Xerg never infers it from framework, host, collection environment, or audit evidence. Audit Detail adds daily Performance and detector-attributed Workflow economics; Compare retains outcome evidence, and every Signal presentation keeps suggested investigation guidance explicitly separate from savings estimates.

## Advanced authentication

Use `xerg login --replace` only as a manual recovery path when browser pairing is unavailable. It opens Workspace Settings and masks the key pasted into the terminal. Never ask for or paste a workspace key in agent chat.

Use `XERG_API_KEY` only for non-interactive CI or deployment automation. Store it in the CI provider's secret manager; never place it inline in a shell command, source file, log, URL, or conversation.

## Links

- Docs: [xerg.ai/docs](https://xerg.ai/docs)
- Service status: [status.xerg.ai](https://status.xerg.ai)
- Skill: [xerg.ai/skill.md](https://xerg.ai/skill.md)
- npm: [@xerg/cli](https://www.npmjs.com/package/@xerg/cli)
- Support: `hello@xerg.ai`
