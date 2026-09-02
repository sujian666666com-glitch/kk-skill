#!/bin/sh
# SessionEnd hook：为约束复盘留一条会话记录。
#
# 只记指针，不解析 transcript——复盘时由 agent 去读，避免依赖未公开的
# transcript JSONL 结构。
#
# 无论如何都 exit 0：这个 hook 绝不能影响会话正常结束。

LOG="${CLAUDE_CONSTRAINTS_LOG:-$HOME/.claude/constraint-review.log}"
mkdir -p "$(dirname "$LOG")" 2>/dev/null

python3 -c '
import sys, json, datetime
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
print("\t".join([
    datetime.datetime.now().isoformat(timespec="seconds"),
    d.get("cwd", "?"),
    d.get("reason", "?"),
    d.get("session_id", "?"),
    d.get("transcript_path", "?"),
]))
' >> "$LOG" 2>/dev/null

exit 0
