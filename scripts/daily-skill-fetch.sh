#!/bin/bash
# 每日 Skill 抓取脚本
# 每天10点执行，从 ClawHub 获取热门 Skill

set -e

REPO_DIR="$HOME/clawd/kk-skill"
DATE=$(date +%Y-%m-%d)
LOG_FILE="$REPO_DIR/logs/fetch-$DATE.log"

mkdir -p "$REPO_DIR/logs"

echo "[$DATE] 开始抓取 Skill..." | tee -a "$LOG_FILE"

# 获取 Skill 列表
echo "[$DATE] 从 ClawHub 获取 Skill 列表..." | tee -a "$LOG_FILE"
clawhub list > /tmp/all-skills.txt 2>&1 || true

# 获取热门 Skill（这里需要根据实际热度排序）
# 暂时获取前10个
echo "[$DATE] 筛选前10个 Skill..." | tee -a "$LOG_FILE"

# TODO: 实现安全检验逻辑
# TODO: 将筛选后的 Skill 信息写入仓库

echo "[$DATE] 完成" | tee -a "$LOG_FILE"