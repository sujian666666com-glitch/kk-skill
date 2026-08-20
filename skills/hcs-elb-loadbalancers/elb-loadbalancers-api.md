# 华为云 ELB 负载均衡实例相关 API（文档摘录）

> 依据华为云 ELB 服务 API 文档整理。真实调用使用官方 Python SDK `huaweicloudsdkelb`（V3 客户端 `ElbClient`），等价 REST 接口如下。

## 1. 查询 ELB 负载均衡实例列表（能力 A）

```
GET /v3/{project_id}/elb/loadbalancers
```

- 分页参数：`limit`（默认 2000，最大 2000）、`marker`（page_info.next_marker）。
- 过滤参数：
  - `name`：按实例名称匹配（数组，支持多个）
  - `operating_status`：按运行状态过滤（ONLINE / FROZEN）
  - `provisioning_status`：按供给状态过滤（ACTIVE / PENDING_DELETE）
  - `admin_state_up`：按启用状态过滤（true / false）
  - `guaranteed`：按类型过滤（true=独享型 / false=共享型）
  - `vpc_id`：按 VPC ID 过滤
  - `vip_address`：按私网 VIP 地址过滤
  - `enterprise_project_id`：按企业项目过滤
  - `availability_zone_list`：按可用区过滤
- 返回 `loadbalancers` 数组 + `page_info`（分页信息），每项含：
  - `id`：实例 ID
  - `name`：实例名称
  - `provisioning_status`：供给状态
  - `operating_status`：运行状态
  - `admin_state_up`：是否启用
  - `guaranteed`：是否独享型
  - `vip_address`：私网 VIP 地址
  - `vip_subnet_cidr_id`：前端子网 ID
  - `vpc_id`：所属 VPC ID
  - `availability_zone_list`：可用区列表
  - `eips`：弹性公网 IP 列表
  - `publicips`：公网 IP 列表
  - `enterprise_project_id`：企业项目 ID
  - `created_at`：创建时间
  - `updated_at`：更新时间
- SDK：`ListLoadBalancersRequest` / `client.list_load_balancers`

## PageInfo 结构

| 字段 | 说明 |
|---|---|
| `previous_marker` | 上一页标记 |
| `next_marker` | 下一页标记 |
| `current_count` | 当前页记录数 |

## EipInfo 结构

| 字段 | 说明 |
|---|---|
| `eip_id` | 弹性公网 IP ID |
| `eip_address` | 弹性公网 IP 地址 |
| `ip_version` | IP 版本（4 / 6） |

## PublicIpInfo 结构

| 字段 | 说明 |
|---|---|
| `publicip_id` | 公网 IP ID |
| `publicip_address` | 公网 IP 地址 |
| `ip_version` | IP 版本（4 / 6） |

## 区域域名

- 上海一（cn-east-3，默认）：`https://elb.cn-east-3.myhuaweicloud.com`
- 其他区域：`https://elb.{region}.myhuaweicloud.com`

## 认证

- AK/SK 方式（环境变量 `HWCLOUD_AK` / `HWCLOUD_SK`），由 `huaweicloudsdkcore.auth.credentials.BasicCredentials` 构造。
- 项目 ID：`BasicCredentials.with_project_id()` 显式指定；缺省由 AK/SK 自动解析默认项目。

## 常见运行状态

| 状态 | 说明 |
|---|---|
| `ONLINE` | 运行中 |
| `FROZEN` | 已冻结 |

## 常见供给状态

| 状态 | 说明 |
|---|---|
| `ACTIVE` | 使用中 |
| `PENDING_DELETE` | 删除中 |

## 负载均衡类型

| 类型 | guaranteed 值 | 说明 |
|---|---|---|
| 独享型 | `true` | 专用负载均衡，资源独占 |
| 共享型 | `false` | 共享负载均衡，多租户共用 |
