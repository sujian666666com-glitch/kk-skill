---
name: huawei-cloud-dcs-count
description: >-
  Count the number of Huawei Cloud DCS (Distributed Cache Service) instances —
  managed Redis and Memcached — in a region and output the count. Returns the
  authoritative instance_num from the ListInstances API, so the reported number
  is always exact regardless of page size. Supports counting all instances,
  counting Redis-only (or Memcached-only) instances via the per-engine
  breakdown, filtering by status (RUNNING, FROZEN, etc.), and a per-status count
  breakdown via ListNumberOfInstancesInDifferentStatus. Read-only — never
  creates, modifies or deletes any resource.
  Use for Redis/DCS instance inventory, daily inspection, or cost review.
  Triggers include: count Redis, Redis count, DCS instance count, how many
  Redis instances, number of Redis instances, Redis数量, DCS实例数量,
  Redis实例数量, 查询Redis数量, 查询redis数量, 缓存实例数量, DCS数量,
  统计Redis实例数, redis实例个数.
tags:
  - huawei-cloud
  - dcs
  - redis
  - count
  - inventory
---

# Huawei Cloud DCS Count Skill

## Overview

This skill counts Huawei Cloud DCS (Distributed Cache Service) instances — the
managed Redis / Memcached service — in a region and outputs the number. It
supports four counting modes:

- **Total count** — number of all DCS instances in a region.
- **Redis / Memcached count** — number of instances for a specific engine,
  derived from the per-engine breakdown of `ListNumberOfInstancesInDifferentStatus`.
- **Filtered count** — number of instances matching a status (e.g. `RUNNING`).
- **Per-status breakdown** — counts of instances grouped by lifecycle status
  (running, creating, frozen, error, etc.) via `ListNumberOfInstancesInDifferentStatus`.

The total count is taken from the authoritative `instance_num` field returned
by the list API, so the result is exact regardless of page size — no pagination
sum is needed for the count itself.

**Architecture:**

```
Agent → hcloud CLI (primary) → Huawei Cloud DCS API
       ↘ Python SDK (fallback) ↗
```

**Applicable Scenarios:**

- Daily inspection: how many Redis/DCS instances exist in a region
- Cache instance inventory and cost review
- Redis-only inventory when the project also uses Memcached
- Capacity planning and pre-migration verification
- Quick health check of how many instances are running vs. non-running

## Prerequisites

1. **hcloud CLI** installed and authenticated — See `references/cli-installation-guide.md`
2. **Python 3.8+** with the `huaweicloudsdkdcs` package (SDK fallback)
3. **Huawei Cloud AK/SK** configured via environment variables or the hcloud CLI profile
4. **IAM permissions** — read-only access to DCS instances — See `references/iam-policies.md`

## Workflow

1. **Identify query scope** — Decide which region to query and which counting
   mode to use (total, engine-specific, status-filtered, or per-status breakdown)
2. **Select execution mode** — Use the hcloud CLI by default; fall back to the
   Python SDK if the CLI is unavailable
3. **Execute the query** — Run the count commands and capture `instance_num` from
   each response
4. **Present results** — Output the DCS instance count to the user

## Core Commands

### Count All DCS Instances

| Purpose | Command |
|---------|---------|
| Count all DCS (Redis/Memcached) instances | `hcloud DCS ListInstances --cli-region={region} --limit={limit}` |

### Count-Only Lookup (jq)

To return just the numeric count:

```bash
hcloud DCS ListInstances --cli-region={region} --limit={limit} | jq -r '.instance_num'
```

### Count Redis-Only Instances

The `ListNumberOfInstancesInDifferentStatus` API returns per-engine status
statistics. Sum the `redis.*` status counters for the total Redis count:

```bash
hcloud DCS ListNumberOfInstancesInDifferentStatus --cli-region={region} | jq '[.redis | to_entries[].value | tonumber] | add'
```

For just the number of running Redis instances:

```bash
hcloud DCS ListNumberOfInstancesInDifferentStatus --cli-region={region} | jq -r '.redis.running_count'
```

### Filtered Count by Status

| Purpose | Command |
|---------|---------|
| Count instances in a given status | `hcloud DCS ListInstances --cli-region={region} --status={status} --limit={limit}` |

To return just the numeric count for a status:

```bash
hcloud DCS ListInstances --cli-region={region} --status=RUNNING --limit={limit} | jq -r '.instance_num'
```

Valid `{status}` values include: `RUNNING`, `CREATING`, `FROZEN`, `ERROR`,
`RESTARTING`, `EXTENDING`, `CLOSING`, `CLOSED`, `FLUSHING`, `UPGRADING`,
`RESTORING`, `MIGRATING`.

### Per-Status Count Breakdown

| Purpose | Command |
|---------|---------|
| Count instances grouped by lifecycle status | `hcloud DCS ListNumberOfInstancesInDifferentStatus --cli-region={region}` |

To extract the number of running Redis instances:

```bash
hcloud DCS ListNumberOfInstancesInDifferentStatus --cli-region={region} | jq -r '.redis.running_count'
```

### SDK Fallback Examples

When the CLI is unavailable, use the Python SDK:

```python
import os
from huaweicloudsdkcore.auth.credentials import BasicCredentials
from huaweicloudsdkdcs.v2.region.dcs_region import DcsRegion
from huaweicloudsdkdcs.v2 import DcsClient, ListInstancesRequest

credentials = BasicCredentials().with_ak(os.getenv("HUAWEI_ACCESS_KEY")) \
                                .with_sk(os.getenv("HUAWEI_SECRET_KEY"))

client = DcsClient.new_builder() \
    .with_credentials(credentials) \
    .with_region(DcsRegion.value_of("{region}")) \
    .build()

response = client.list_instances(ListInstancesRequest(limit={limit}))
print(response.instance_num)
```

Per-engine count via SDK:

```python
from huaweicloudsdkdcs.v2 import ListNumberOfInstancesInDifferentStatusRequest

resp = client.list_number_of_instances_in_different_status(
    ListNumberOfInstancesInDifferentStatusRequest())
redis_total = sum(int(v) for k, v in resp.redis.to_dict().items() if isinstance(v, int))
print(resp.redis.running_count)
```

A ready-to-run helper script is provided in `scripts/count_dcs_instances.py`.

## Parameter Confirmation

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `{region}` | Yes | Huawei Cloud region | `cn-north-4` |
| `{limit}` | No | Max records per page (1-1000, default 10); does not affect `instance_num` | `100` |
| `{status}` | No | Instance status filter (see valid values above) | `RUNNING` |
| `{engine}` | No | Engine filter for SDK helper (`redis` or `memcached`) | `redis` |

## Reference Documents

- [CLI Installation Guide](references/cli-installation-guide.md)
- [IAM Policies](references/iam-policies.md)
- [Verification Method](references/verification-method.md)
- [Data Flow Diagram](references/dataflow-diagram.md)
- [Acceptance Criteria](references/acceptance-criteria.md)

## KooCLI Command Format Standard

```bash
hcloud <Service> <Operation> --cli-region=<region> [--key=value ...]
```

| Feature | Description | Example |
|---------|-------------|---------|
| Service name | `DCS` | `hcloud DCS ListInstances --cli-region={region}` |
| Operation name | PascalCase | `ListInstances`, `ListNumberOfInstancesInDifferentStatus` |
| Region parameter | `--cli-region=<value>` | `--cli-region=cn-north-4` |
| Simple parameter | `--key=value` | `--limit=100` |
