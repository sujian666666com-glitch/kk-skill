#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""查询华为云 ELB（弹性负载均衡）实例列表。

能力:
  A. 列出账号下（region/project 范围）全部 ELB 负载均衡实例，可选按名称/状态过滤。
  B. 按实例名称模糊匹配查询。
  C. 按运行状态过滤（ONLINE / FROZEN 等）。

认证:
  读取环境变量 HWCLOUD_AK / HWCLOUD_SK（真实验证必填，不硬编码密钥）。
  可选 HWCLOUD_PROJECT_ID（缺省由 AK/SK 解析默认项目）。

用法:
  python3 hcs-elb-loadbalancers.py list [--region cn-east-3] [--project-id <id>]
                                         [--name <名称>] [--status <状态>]
                                         [--format json|md] [--mock]
  python3 hcs-elb-loadbalancers.py list --mock --region cn-east-3 --format json

退出码: 0=成功; 2=参数错误; 3=缺少认证(未设置 HWCLOUD_AK/HWCLOUD_SK); 4=API 调用失败
"""

import argparse
import json
import os
import sys


MOCK_DATA = {
    "loadbalancers": [
        {"id": "lb-0aaa1111bbbb2222cccc", "name": "web-lb-01",
         "provisioning_status": "ACTIVE", "operating_status": "ONLINE",
         "admin_state_up": True, "guaranteed": True,
         "vip_address": "192.168.1.100", "vip_subnet_cidr_id": "subnet-aaa111",
         "vpc_id": "vpc-prod-001",
         "availability_zone_list": ["cn-east-3a"],
         "eips": [{"eip_id": "eip-001", "eip_address": "121.36.10.50", "ip_version": 4}],
         "publicips": [],
         "enterprise_project_id": "0",
         "created_at": "2024-01-15T08:30:00Z", "updated_at": "2024-06-01T12:00:00Z"},
        {"id": "lb-3333444455556666aaaa", "name": "api-lb-01",
         "provisioning_status": "ACTIVE", "operating_status": "ONLINE",
         "admin_state_up": True, "guaranteed": True,
         "vip_address": "192.168.1.200", "vip_subnet_cidr_id": "subnet-aaa111",
         "vpc_id": "vpc-prod-001",
         "availability_zone_list": ["cn-east-3a", "cn-east-3b"],
         "eips": [{"eip_id": "eip-002", "eip_address": "121.36.10.51", "ip_version": 4}],
         "publicips": [],
         "enterprise_project_id": "0",
         "created_at": "2024-02-20T10:00:00Z", "updated_at": "2024-06-02T15:30:00Z"},
        {"id": "lb-7777888899990000bbbb", "name": "test-lb-01",
         "provisioning_status": "ACTIVE", "operating_status": "FROZEN",
         "admin_state_up": False, "guaranteed": False,
         "vip_address": "192.168.2.100", "vip_subnet_cidr_id": "subnet-bbb222",
         "vpc_id": "vpc-dev-002",
         "availability_zone_list": ["cn-east-3a"],
         "eips": [],
         "publicips": [],
         "enterprise_project_id": "0",
         "created_at": "2024-03-10T14:20:00Z", "updated_at": "2024-05-15T09:00:00Z"},
    ],
}


def _attr(obj, name, default=None):
    """兼容 SDK 对象（属性访问）与普通 dict。"""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _norm_eips(eips):
    """将 eips（list[dict|EipInfo]）标准化。"""
    if not eips:
        return []
    result = []
    for e in eips:
        result.append({
            "eip_id": _attr(e, "eip_id"),
            "eip_address": _attr(e, "eip_address"),
            "ip_version": _attr(e, "ip_version"),
        })
    return result


def _norm_publicips(publicips):
    """将 publicips（list[dict|PublicIpInfo]）标准化。"""
    if not publicips:
        return []
    result = []
    for p in publicips:
        result.append({
            "publicip_id": _attr(p, "publicip_id"),
            "publicip_address": _attr(p, "publicip_address"),
            "ip_version": _attr(p, "ip_version"),
        })
    return result


def _norm_loadbalancer(lb):
    """将 LoadBalancer（dict 或 SDK 对象）标准化为输出 dict。"""
    return {
        "id": _attr(lb, "id"),
        "name": _attr(lb, "name"),
        "provisioning_status": _attr(lb, "provisioning_status"),
        "operating_status": _attr(lb, "operating_status"),
        "admin_state_up": _attr(lb, "admin_state_up"),
        "guaranteed": _attr(lb, "guaranteed"),
        "vip_address": _attr(lb, "vip_address"),
        "vip_subnet_cidr_id": _attr(lb, "vip_subnet_cidr_id"),
        "vpc_id": _attr(lb, "vpc_id"),
        "availability_zone_list": _attr(lb, "availability_zone_list") or [],
        "eips": _norm_eips(_attr(lb, "eips")),
        "publicips": _norm_publicips(_attr(lb, "publicips")),
        "enterprise_project_id": _attr(lb, "enterprise_project_id"),
        "created_at": _attr(lb, "created_at"),
        "updated_at": _attr(lb, "updated_at"),
    }


def _build_client(region_id, project_id):
    from huaweicloudsdkcore.auth.credentials import BasicCredentials
    from huaweicloudsdkcore.region.region import Region
    from huaweicloudsdkelb.v3 import ElbClient

    ak = os.environ.get("HWCLOUD_AK")
    sk = os.environ.get("HWCLOUD_SK")
    if not ak or not sk:
        print("错误：缺少认证，请设置环境变量 HWCLOUD_AK / HWCLOUD_SK", file=sys.stderr)
        sys.exit(3)
    creds = BasicCredentials(ak, sk)
    if project_id:
        creds = creds.with_project_id(project_id)
    region = Region(region_id, "https://elb.{}.myhuaweicloud.com".format(region_id))
    return ElbClient.new_builder().with_credentials(creds).with_region(region).build()


def _fetch_loadbalancers(client, name=None, status=None):
    """分页拉取账号下（region/project 范围）全部 ELB 负载均衡实例。"""
    from huaweicloudsdkelb.v3 import ListLoadBalancersRequest

    loadbalancers, marker = [], None
    while True:
        req = ListLoadBalancersRequest(limit=2000)
        if name:
            req.name = [name]
        if status:
            req.operating_status = [status]
        if marker:
            req.marker = marker
        resp = client.list_load_balancers(req)
        items = _attr(resp, "loadbalancers", []) or []
        loadbalancers.extend(items)
        page_info = _attr(resp, "page_info")
        current_count = _attr(page_info, "current_count", 0) or 0
        if current_count < 2000:
            break
        next_marker = _attr(page_info, "next_marker")
        if not next_marker:
            break
        marker = next_marker
    return loadbalancers


def capability_list(client, args):
    """能力 A：列出 ELB 负载均衡实例（可按名称/状态过滤）。"""
    if args.mock:
        loadbalancers = MOCK_DATA["loadbalancers"]
        if args.name:
            loadbalancers = [lb for lb in loadbalancers if args.name in (_attr(lb, "name") or "")]
        if args.status:
            loadbalancers = [lb for lb in loadbalancers if _attr(lb, "operating_status") == args.status]
    else:
        loadbalancers = _fetch_loadbalancers(client, name=args.name, status=args.status)

    items = [_norm_loadbalancer(lb) for lb in loadbalancers]
    items.sort(key=lambda x: (x["name"] or "", x["id"] or ""))
    payload = {
        "capability": "list",
        "region": args.region,
        "project_id": args.project_id,
        "filter_name": args.name,
        "filter_status": args.status,
        "count": len(items),
        "loadbalancers": items,
    }
    return payload


def render_md(payload):
    lines = ["## ELB 负载均衡实例列表（区域: {}）".format(payload["region"])]
    if payload.get("filter_name"):
        lines.append("按名称过滤: {}".format(payload["filter_name"]))
    if payload.get("filter_status"):
        lines.append("按状态过滤: {}".format(payload["filter_status"]))
    lines.append("实例数量: {}".format(payload["count"]))
    lines.append("")
    lines.append("| 实例名称 | 实例ID | 运行状态 | 供给状态 | VIP地址 | EIP地址 | 可用区 | 类型 |")
    lines.append("|---|---|---|---|---|---|---|---|")
    for lb in payload["loadbalancers"]:
        eip_addrs = ", ".join(
            e["eip_address"] for e in lb["eips"] if e.get("eip_address")
        )
        azs = ", ".join(lb["availability_zone_list"]) if lb["availability_zone_list"] else ""
        lb_type = "独享型" if lb["guaranteed"] else "共享型"
        lines.append("| {} | {} | {} | {} | {} | {} | {} | {} |".format(
            lb["name"], lb["id"], lb["operating_status"], lb["provisioning_status"],
            lb["vip_address"], eip_addrs, azs, lb_type))
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        prog="hcs-elb-loadbalancers",
        description="查询华为云 ELB 负载均衡实例列表（含 mock 无凭证模式）")

    def add_common_args(p):
        p.add_argument("--region", default="cn-east-3", help="区域，默认 cn-east-3（上海一）")
        p.add_argument("--project-id", default=None, help="项目 ID（默认由 AK/SK 解析）")
        p.add_argument("--format", choices=["json", "md"], default="json", help="输出格式，默认 json")
        p.add_argument("--mock", action="store_true", help="使用内置 mock 数据（无需凭证）")

    add_common_args(parser)
    sub = parser.add_subparsers(dest="command", required=True)

    p_list = sub.add_parser("list", help="列出账号下全部 ELB 负载均衡实例")
    p_list.add_argument("--name", default=None, help="按实例名称模糊过滤")
    p_list.add_argument("--status", default=None,
                        help="按运行状态过滤（ONLINE/FROZEN 等）")
    add_common_args(p_list)

    args = parser.parse_args()

    try:
        if args.mock:
            print("提示：使用 mock 数据验证（未访问真实华为云）。", file=sys.stderr)
            client = None
        else:
            client = _build_client(args.region, args.project_id)

        if args.command == "list":
            payload = capability_list(client, args)
        else:
            parser.error("未知命令: {}".format(args.command))

        if args.format == "md":
            print(render_md(payload))
        else:
            print(json.dumps(payload, ensure_ascii=False, indent=2))
    except SystemExit:
        raise
    except Exception as exc:
        print("错误：调用华为云 API 失败：{}".format(exc), file=sys.stderr)
        sys.exit(4)


if __name__ == "__main__":
    main()
