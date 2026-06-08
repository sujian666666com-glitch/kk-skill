---
name: gaode-taxi
description: 高德打车，零配置即装即用，一键唤起高德地图APP打车。另含驾车/公交/步行/骑行路线规划（坐标版+地址版）、IP定位、周边搜索、POI搜索、POI详情，免申请Key即用。
tags:
  - 高德打车
  - 唤端打车
  - 路线规划
  - 周边搜索
  - POI搜索
  - IP定位
  - 地图API
  - 旅行助手
  - 导航
---

# 高德打车

零配置即装即用的高德打车技能，一键唤起高德地图APP打车，另含路线规划、IP定位、周边搜索等常用地图能力。

## 核心功能

### 🚕 唤端打车
- **schema_take_taxi** — 一键唤起高德地图APP打车，支持设置起终点坐标和名称

### 🗺️ 路线规划（坐标版）
- **driving_route** — 驾车路线规划（经纬度坐标）
- **transit_route** — 公交路线规划（经纬度坐标）
- **walking_route** — 步行路线规划（经纬度坐标）
- **cycling_route** — 骑行路线规划（经纬度坐标）

### 🗺️ 路线规划（地址版）
- **driving_route_by_address** — 驾车路线规划（文字地址，自动地理编码）
- **transit_route_by_address** — 公交路线规划（文字地址，自动地理编码）
- **walking_route_by_address** — 步行路线规划（文字地址，自动地理编码）
- **cycling_route_by_address** — 骑行路线规划（文字地址，自动地理编码）

### 📍 定位与搜索
- **ip_location** — IP定位，根据IP地址获取位置信息
- **poi_around** — 周边搜索，搜索指定位置周边的POI
- **poi_search** — POI搜索，按关键词和城市搜索兴趣点
- **poi_detail** — POI详情，查询POI的详细信息

## 参数说明

### 唤端打车
- **slon/slat** — 起点经纬度（可选，不传则用当前位置）
- **sname** — 起点名称（可选）
- **dlon/dlat** — 终点经纬度（推荐）
- **dname** — 终点名称（可选）

### 路线规划（坐标版）
- **origin** — 起点坐标，格式"经度,纬度"
- **destination** — 终点坐标，格式"经度,纬度"
- **city** — 公交路线必填，城市名

### 路线规划（地址版）
- **origin_address** — 起点文字地址
- **destination_address** — 终点文字地址
- **city** — 公交路线必填，城市名
- **origin_city/destination_city** — 起终点城市（可选）

### IP定位
- **ip** — IP地址（可选，不传则用请求方IP）

### 周边搜索
- **location** — 中心点坐标，格式"经度,纬度"
- **keywords** — 搜索关键词

### POI搜索
- **keywords** — 搜索关键词
- **city** — 城市名

### POI详情
- **id** — POI的ID

## 常用联动建议

- 先用 **ip_location** 获取当前位置 → 再用 **poi_around** 搜索周边 → 用 **schema_take_taxi** 打车前往
- 用 **poi_search** 找到目的地 → 用 **driving_route_by_address** 查路线 → 用 **schema_take_taxi** 打车
- 用 **walking_route** 步行导航 → 走累了用 **schema_take_taxi** 打车

## 不能做

- 唤端打车需要用户手机安装高德地图APP，无法在纯对话环境直接打车
- 坐标格式统一为"经度,纬度"（高德坐标系），不是"纬度,经度"
