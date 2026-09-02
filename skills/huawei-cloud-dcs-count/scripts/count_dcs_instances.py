#!/usr/bin/env python3
# count_dcs_instances.py — Count Huawei Cloud DCS (Redis/Memcached) instances via SDK.
#
# Usage:
#   python3 count_dcs_instances.py [--region cn-north-4] [--limit 100] [--engine redis]
#
# Requires HUAWEI_ACCESS_KEY / HUAWEI_SECRET_KEY (or HUAWEICLOUD_SDK_AK/SK)
# environment variables. Read-only — never creates, modifies or deletes resources.
#
# --engine filters the per-status breakdown to a single engine ("redis" or
# "memcached"); without it the total DCS instance count is reported.
import argparse
import os
import sys


def get_credentials():
    ak = os.getenv("HUAWEI_ACCESS_KEY") or os.getenv("HUAWEICLOUD_SDK_AK")
    sk = os.getenv("HUAWEI_SECRET_KEY") or os.getenv("HUAWEICLOUD_SDK_SK")
    if not ak or not sk:
        print("ERROR: HUAWEI_ACCESS_KEY / HUAWEI_SECRET_KEY not set", file=sys.stderr)
        sys.exit(2)
    from huaweicloudsdkcore.auth.credentials import BasicCredentials
    return BasicCredentials(ak, sk)


def make_client(credentials, region):
    try:
        from huaweicloudsdkdcs.v2.region.dcs_region import DcsRegion
        from huaweicloudsdkdcs.v2 import DcsClient
    except ImportError:
        print("ERROR: huaweicloudsdkdcs not installed", file=sys.stderr)
        sys.exit(2)
    try:
        return DcsClient.new_builder() \
            .with_credentials(credentials) \
            .with_region(DcsRegion.value_of(region)) \
            .build()
    except Exception as exc:
        print("ERROR: cannot initialize DCS client for region '{}': {}".format(region, exc),
              file=sys.stderr)
        sys.exit(2)


def count_instances(client, limit):
    from huaweicloudsdkdcs.v2 import ListInstancesRequest
    response = client.list_instances(ListInstancesRequest(limit=limit))
    return response.instance_num or 0


def status_totals(client):
    from huaweicloudsdkdcs.v2 import ListNumberOfInstancesInDifferentStatusRequest
    resp = client.list_number_of_instances_in_different_status(
        ListNumberOfInstancesInDifferentStatusRequest())
    result = {}
    for engine in ("redis", "memcached"):
        stat = getattr(resp, engine, None)
        if stat is None:
            result[engine] = 0
            continue
        total = 0
        for _, value in stat.to_dict().items():
            if isinstance(value, int):
                total += value
        result[engine] = total
        result[engine + "_running"] = stat.running_count or 0
    return result


def main():
    parser = argparse.ArgumentParser(description="Count DCS instances (SDK fallback)")
    parser.add_argument("--region", default="cn-north-4", help="Huawei Cloud region")
    parser.add_argument("--limit", type=int, default=100, help="Max records per page (1-1000)")
    parser.add_argument("--engine", choices=["redis", "memcached"], default=None,
                        help="Restrict count to a single engine")
    args = parser.parse_args()

    credentials = get_credentials()
    try:
        client = make_client(credentials, args.region)
        if args.engine:
            totals = status_totals(client)
            print("DCS {} instance count: {}".format(
                args.engine, totals[args.engine]))
            print("{} running: {}".format(args.engine, totals[args.engine + "_running"]))
        else:
            total = count_instances(client, args.limit)
            print("DCS instance count: {}".format(total))
            totals = status_totals(client)
            print("Redis: {} | Memcached: {} | Running: {}".format(
                totals["redis"], totals["memcached"], totals["redis_running"]))
    except Exception as exc:
        print("ERROR: DCS query failed for region '{}': {}".format(args.region, exc),
              file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
