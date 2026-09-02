# CLI Installation Guide

## Install KooCLI (hcloud)

Download and install the Huawei Cloud KooCLI:

```bash
# Linux amd64
curl -sL https://hwcloudcli.obs.cn-north-4.myhuaweicloud.com/cli/latest/hcloud_cli_linux_amd64.tar.gz -o hcloud.tar.gz
tar -xzf hcloud.tar.gz
chmod +x hcloud
sudo mv hcloud /usr/local/bin/

# macOS
curl -sL https://hwcloudcli.obs.cn-north-4.myhuaweicloud.com/cli/latest/hcloud_cli_mac_amd64.tar.gz -o hcloud.tar.gz
tar -xzf hcloud.tar.gz
chmod +x hcloud
sudo mv hcloud /usr/local/bin/
```

Verify the installation:

```bash
hcloud version
```

## Configure Authentication

Configure AK/SK (recommended):

```bash
hcloud configure set --cli-profile=default --cli-mode=AKSK --cli-access-key=<YOUR_ACCESS_KEY> --cli-secret-key=<YOUR_SECRET_KEY>
```

Alternative: set environment variables

```bash
export HUAWEI_ACCESS_KEY=<AK>
export HUAWEI_SECRET_KEY=<SK>
```

## Verify DCS service availability

```bash
hcloud DCS ListInstances --cli-region=cn-north-4 --help
hcloud DCS ListNumberOfInstancesInDifferentStatus --cli-region=cn-north-4 --help
```

> Credentials are read from the environment or the hcloud profile; never hardcode AK/SK in scripts or documents.
