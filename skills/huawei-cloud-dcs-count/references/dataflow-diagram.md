# Data Flow Diagram

```mermaid
flowchart TD
    A[User/Agent] -->|"Count DCS (Redis/Memcached) instances"| B{hcloud CLI available?}
    B -->|Yes| C["hcloud DCS ListInstances --cli-region={region} --limit={limit}"]
    B -->|Yes| D["hcloud DCS ListNumberOfInstancesInDifferentStatus --cli-region={region}"]
    B -->|No| E["Python SDK: DcsClient.list_instances()"]
    B -->|No| F["Python SDK: DcsClient.list_number_of_instances_in_different_status()"]
    C --> G["GET /v2/{project_id}/instances"]
    D --> H["GET /v2/{project_id}/instances/status"]
    E --> G
    F --> H
    G --> I[Huawei Cloud DCS API]
    H --> I
    I --> J["Response: instances[] + instance_num"]
    I --> K["Response: redis.* + memcached.* status counts"]
    J --> M["Read instance_num (authoritative total)"]
    K --> N["Sum redis.* (Redis count) / sum memcached.* (Memcached count) / read per-status counts"]
    M --> O["Output total DCS instance count"]
    N --> O["Output engine + per-status counts"]
    O --> P["Output DCS count to user"]
```

## API Endpoint

| Item | Value |
|------|-------|
| Method | `GET` |
| Path | `/v2/{project_id}/instances` (ListInstances) |
| Path | `/v2/{project_id}/instances/status` (ListNumberOfInstancesInDifferentStatus) |
| SDK method | `list_instances`, `list_number_of_instances_in_different_status` (huaweicloudsdkdcs v2) |
| Source | SDK `_list_instances_http_info` / `_list_number_of_instances_in_different_status_http_info` resource_path |
