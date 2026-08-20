--- 
name: hcs-elb-loadbalancers
version: 0.1.0
description: 查询华为云 ELB（弹性负载均衡）实例列表，支持列出账号下（region/project 范围）全部负载均衡实例，可选按名称/状态过滤，输出实例名称、ID、运行状态、VIP 地址、EIP 地址、可用区、类型。
triggers:
  - 查询华为云ELB
  - 查询负载均衡
  - 列出ELB实例
  - 华为云ELB列表
  - 负载均衡查询
tags:
  - huawei-cloud
  - elb
  - loadbalancer
  - query
---

# hcs-elb-loadbalancers

查询华为云 ELB（弹性负载均衡）实例的技能，提供以下能力：

- **能力 A**：列出账号下（region/project 范围）全部 ELB 负载均衡实例，可按 `--name` 模糊过滤、`--status` 运行状态过滤。
- 输出字段：实例名称、ID、供给状态（provisioning_status）、运行状态（operating_status）、VIP 地址、EIP 地址、可用区、类型（独享/共享）、创建/更新时间。

## 环境变量（认证）

真实调用前需设置（不硬编码密钥）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `HWCLOUD_AK` | 是 | 华为云 Access Key |
| `HWCLOUD_SK` | 是 | 华为云 Secret Key |
| `HWCLOUD_PROJECT_ID` | 否 | 项目 ID，缺省由 AK/SK 解析默认项目 |

## 使用

```bash
# 列出全部 ELB 负载均衡实例（默认区域 cn-east-3）
python3 scripts/hcs-elb-loadbalancers.py list --region cn-east-3

# 按名称模糊过滤
python3 scripts/hcs-elb-loadbalancers.py list --name web-lb

# 按运行状态过滤（ONLINE / FROZEN 等）
python3 scripts/hcs-elb-loadbalancers.py list --status ONLINE

# Markdown 表格输出
python3 scripts/hcs-elb-loadbalancers.py list --format md

# 无凭证验证（内置模拟数据）
python3 scripts/hcs-elb-loadbalancers.py list --mock
python3 scripts/hcs-elb-loadbalancers.py list --mock --region cn-east-3 --format json
python3 scripts/hcs-elb-loadbalancers.py list --mock --format md
```

## 输出

默认 JSON，字段：

```json
{
  "capability": "list",
  "region": "cn-east-3",
  "project_id": "xxx",
  "count": 2,
  "loadbalancers": [
    {
      "id": "lb-0aaa1111bbbb2222cccc",
      "name": "web-lb-01",
      "provisioning_status": "ACTIVE",
      "operating_status": "ONLINE",
      "admin_state_up": true,
      "guaranteed": true,
      "vip_address": "192.168.1.100",
      "vip_subnet_cidr_id": "subnet-aaa111",
      "vpc_id": "vpc-prod-001",
      "availability_zone_list": ["cn-east-3a"],
      "eips": [{"eip_id": "eip-001", "eip_address": "121.36.10.50", "ip_version": 4}],
      "publicips": [],
      "enterprise_project_id": "0",
      "created_at": "2024-01-15T08:30:00Z",
      "updated_at": "2024-06-01T12:00:00Z"
    }
  ]
}
```

`--format md` 输出 Markdown 表格（实例名称/实例ID/运行状态/供给状态/VIP地址/EIP地址/可用区/类型）。

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 2 | 参数错误 |
| 3 | 缺少认证（未设置 HWCLOUD_AK/HWCLOUD_SK） |
| 4 | API 调用失败 |

## 依赖

- Python 3.8+
- 真实调用：`huaweicloudsdkelb`（见 `requirements.txt`）
- mock 模式无需任何第三方依赖

## 实现说明

使用华为云 ELB Python SDK (`huaweicloudsdkelb` V3) 的 `ListLoadBalancersRequest` 分页拉取全部负载均衡实例：

- API 端点：`GET /v3/{project_id}/elb/loadbalancers`
- 分页参数：`limit`（最大 2000）+ `marker`（page_info.next_marker）
- 过滤参数：`name`（名称匹配）、`operating_status`（运行状态）

负载均衡实例详情关键字段映射（SDK 属性 → JSON key）：

| SDK 属性 | JSON key | 说明 |
|---|---|---|
| `name` | `name` | 实例名称 |
| `id` | `id` | 实例 ID |
| `provisioning_status` | `provisioning_status` | 供给状态（ACTIVE/PENDING_DELETE 等） |
| `operating_status` | `operating_status` | 运行状态（ONLINE/FROZEN） |
| `admin_state_up` | `admin_state_up` | 是否启用 |
| `guaranteed` | `guaranteed` | 是否独享型负载均衡 |
| `vip_address` | `vip_address` | 私网 VIP 地址 |
| `vpc_id` | `vpc_id` | 所属 VPC ID |
| `availability_zone_list` | `availability_zone_list` | 可用区列表 |
| `eips` | `eips` | 弹性公网 IP 列表 |
| `created_at` | `created_at` | 创建时间 |
| `updated_at` | `updated_at` | 更新时间 |

详见 `references/elb-loadbalancers-api.md`。
