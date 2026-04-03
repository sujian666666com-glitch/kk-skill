#!/bin/bash

# ==========================================
# OpenClaw 自动化创建 Agent 脚本 (针对 openclaw.json 优化版)
# $1: agent_id (如 product_manager)
# $2: agent_display_name (如 产品经理)
# $3: identity_prompt (详细设定)
# ==========================================

if [ "$#" -ne 3 ]; then
    echo "❌ Error: 参数数量不正确。"
    exit 1
fi

AGENT_ID=$1
DISPLAY_NAME=$2
PERSONA=$3
WORKSPACE_DIR="$HOME/.openclaw/workspace-${AGENT_ID}"
# 指向你提到的主配置文件
CONFIG_FILE="$HOME/.openclaw/openclaw.json"

echo "🚀 [1/3] 开始创建 Agent ID: ${AGENT_ID}..."

# ------------------------------------------
# 步骤 1: 执行基础创建
# ------------------------------------------
if openclaw agents add "${AGENT_ID}" --workspace "${WORKSPACE_DIR}"; then
    echo "✅ Agent 基础记录已生成。"
else
    echo "❌ Agent 创建失败！可能是 ID [${AGENT_ID}] 已存在。"
    exit 1
fi

# ------------------------------------------
# 步骤 2: 修改 openclaw.json 里的显示名称 (name)
# ------------------------------------------
echo "📝 [2/3] 正在修改 ${CONFIG_FILE} 注入中文名称: ${DISPLAY_NAME}..."

if [ -f "$CONFIG_FILE" ]; then
    # 使用 Python 深入 JSON 层级修改 agents -> list -> name
    python3 -c "
import json, os
path = os.path.expanduser('$CONFIG_FILE')
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# 寻找 agents 下的 list
agents_list = data.get('agents', {}).get('list', [])
found = False
for agent in agents_list:
    if agent.get('id') == '$AGENT_ID':
        agent['name'] = '$DISPLAY_NAME'
        found = True
        break

if found:
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print('✅ 已成功将 ID [$AGENT_ID] 的名称修改为 [$DISPLAY_NAME]')
else:
    print('⚠️ 在 openclaw.json 中未找到匹配 ID 的 Agent 项')
"
else
    echo "❌ 错误: 未找到配置文件 $CONFIG_FILE"
    exit 1
fi

# ------------------------------------------
# 步骤 3: 注入身份设定 (Persona)
# ------------------------------------------
echo "🧠 [3/3] 正在通过 ID [${AGENT_ID}] 注入身份设定..."
FULL_MESSAGE="记住你的身份设定：\n${PERSONA}"

if openclaw agent --agent "${AGENT_ID}" --message "${FULL_MESSAGE}"; then
    echo "✅ 身份注入完成！"
else
    echo "❌ 身份注入失败，请手动检查 Agent 状态。"
fi

echo "🎉 SUCCESS! 代理 [${DISPLAY_NAME}] 已完全就绪！"
exit 0