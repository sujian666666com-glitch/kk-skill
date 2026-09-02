# Acceptance Criteria

## Functional Criteria

- [x] **Count all DCS instances**: The skill returns the total number of DCS (Redis/Memcached) instances in a region
- [x] **Count by engine**: The skill reports the number of Redis-only (and Memcached-only) instances via the per-engine breakdown
- [x] **Count by status**: The skill returns the number of instances matching a status filter (e.g. `RUNNING`)
- [x] **Per-status breakdown**: The skill reports the number of instances per lifecycle status via `ListNumberOfInstancesInDifferentStatus`
- [x] **CLI mode**: `hcloud DCS ListInstances` and `hcloud DCS ListNumberOfInstancesInDifferentStatus` work when the CLI is installed
- [x] **SDK fallback**: Python SDK `list_instances()` and `list_number_of_instances_in_different_status()` work when the CLI is unavailable
- [x] **Accurate count**: The count is read from the authoritative `instance_num` field, never truncated to one page
- [x] **Read-only**: No write operation is ever performed

## Error Handling Criteria

- [x] **Invalid status**: `--status` accepts documented lifecycle values; invalid values surface a clear CLI error
- [x] **SDK failure**: SDK helper prints a friendly error (region / auth / query) instead of a raw Python traceback

## Non-Functional Criteria

- [x] No AK/SK hardcoding — credentials come from environment variables or hcloud profile
- [x] Least-privilege IAM policy documented
- [x] SKILL.md within 500 lines, file count within 30, total size within 40 MB
- [x] Reference documents use kebab-case filenames

## Out of Scope

- Creating / deleting / modifying DCS instances (write operations)
- Querying DCS instance details (CPU, memory, config) — use a separate detail/list skill
