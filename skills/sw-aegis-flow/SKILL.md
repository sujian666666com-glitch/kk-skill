---
name: sw-aegis-flow
description: 端到端完成 OpenSpec spec-driven 闭环：创建或继续 change、通过 Codex/Claude CLI 并发生成与审核 artifact、提交文档快照、按依赖并发实现任务、每 task 主 agent 审查、测试验收并归档。适用于希望减少人工切换步骤、让 CLI 子 agent 驱动多实例并发推进 OpenSpec 工作的场景。
license: MIT
compatibility: Requires OpenSpec CLI and at least one of Codex CLI / Claude CLI. When neither is available, degrade to single-agent sequential execution.
metadata:
  author: swclaw
  version: "5.1"
---

# Sw Aegis Flow

把 OpenSpec 默认 `spec-driven` 工作流收敛成一条连续主线：

`new/continue change -> proposal/specs/design/tasks -> 文档快照(stp1) -> 并发审核 -> 审核后快照(stp2) -> apply -> batch并发实现(stp3+) -> 测试验收 -> 归档(stp-last)`

默认执行策略是 **双子 agent（Codex CLI + Claude CLI）多实例并发**：artifact 生成后的审核通过并发拉起多个子 agent 实例进行，任务按 batch 分组后在 batch 内并发拉起多个子 agent 实例实现，每个 task 完成后由主 agent 审查。Codex 为优先子 agent，当任务总数 >= 10 时启用 Claude CLI 分流。两者均不可用时，降级为主 agent 内串行完成。

## 双子 agent 并发执行模型

通过 `codex` 和 `claude` 命令行工具拉起独立 agent 实例，取代固定子 agent 池。每个实例是独立进程，天然支持并发，不依赖宿主平台的子 agent 能力。

### 子 agent 选择策略

```text
IF tasks.md 中待完成任务总数 < 10:
    全部使用 codex
ELSE:
    codex 为主（占约 60-70% 任务）
    claude 分流剩余任务（占约 30-40%）
    同一 batch 内可混用 codex 和 claude 实例
```

- 选择在 batch 规划阶段一次性确定，不在运行中动态切换
- 审核场景（artifact 审核、集成复核）仍全用 codex（只读、稳定性优先）
- 只有**实现场景**在任务总数 >= 10 时才使用 claude 分流

### 标准调用格式

**Codex CLI（优先）**

```bash
codex --approval-mode full-auto -q "<prompt>"
```

**Claude CLI（溢出分流）**

```bash
claude -p "<prompt>" --allowedTools "Read,Edit,Bash"
```

- `-p` = 非交互模式，执行完输出到 stdout 后退出
- `--allowedTools` 控制可用工具：审核场景只给 `Read`；实现场景给 `Read,Edit,Bash`
- 如需指定模型，使用 `claude -p "<prompt>" --model <model>`，由调用者决定

### 并发场景

| 场景 | 子 agent | 并发粒度 |
|------|----------|----------|
| Artifact 审核 | codex | 最多 4 个并发（proposal/specs/design/tasks） |
| 最终一致性复审 | codex | 单实例 |
| Batch 内任务实现 | codex 优先；任务总数 >= 10 时混用 claude | 按 batch 内任务数 |
| 集成复核 | codex | 单实例 |

### 调用模板

```bash
# 审核单个 artifact（codex）
codex --approval-mode full-auto -q "请只读审核 openspec/changes/<name>/<artifact>.md，\
检查与 change 目标和前序 artifact 的一致性。\
输出严重问题/一般问题/建议/结论。不要修改任何文件。" &

# 最终一致性复审（codex）
codex --approval-mode full-auto -q "请只读复审 openspec/changes/<name>/ 下的 \
proposal、specs、design、tasks 最终版本。重点检查四者一致性，\
是否存在阻塞实现或验收的问题。输出严重问题/一般问题/建议/结论。不要修改文件。"

# 并发实现任务（codex）
codex --approval-mode full-auto -q "请实现 OpenSpec 任务 <task-id>，\
严格遵循 openspec/changes/<name>/ 下的 proposal、specs、design、tasks。\
完成后将 tasks.md 对应项标记为 [x]。只修改以下文件范围：<file-list>" &

# 并发实现任务（claude，任务总数 >= 10 时启用）
claude -p "请实现 OpenSpec 任务 <task-id>，\
严格遵循 openspec/changes/<name>/ 下的 proposal、specs、design、tasks。\
完成后将 tasks.md 对应项标记为 [x]。只修改以下文件范围：<file-list>" \
--allowedTools "Read,Edit,Bash" &

# 集成复核（codex）
codex --approval-mode full-auto -q "请检查以下文件的接口一致性和回归风险：<file-list>。\
只读审核，不修改文件。输出严重问题/一般问题/建议/结论。"
```

### 并发控制

- 使用 Shell `&` 后台运行多个子 agent 实例，`wait` 收齐全部结果
- 审核实例只读，不修改文件，天然无冲突
- 实现实例之间必须先做文件级冲突分析，确保写入范围不重叠
- 如需指定模型，使用 `codex --model <model>` 或 `claude -p "<prompt>" --model <model>`，由调用者决定
- codex 与 claude 实例可在同一 batch 内混用，`wait` 统一收齐

## 何时使用

- 用户希望从一个变更描述直接推进到 OpenSpec 闭环完成
- 用户希望减少在多个 `openspec-*` skill 或多个命令之间手动切换
- 用户希望先完成文档，再统一审核，再进入实现
- 用户希望实现前保留一份文档快照，避免文档与代码脱节
- 用户希望按任务依赖关系推进实现，而不是无序开发

## 不适用范围

- 用户明确要求的不是 OpenSpec 默认 `spec-driven` workflow
- 用户只想做单一步骤，例如仅创建 proposal、仅补 tasks、仅归档
- 用户要求交互式、逐步确认式流程，而不是连续推进式流程

## 输入要求

用户输入应至少包含以下之一：

- 清晰的变更目标或 bug 修复描述
- 已存在的 change 名称

如果目标完全不清楚，先询问一次高价值澄清问题；除该场景外，默认持续推进，不因中间步骤反复向用户确认。

## 能力要求与降级策略

### 必需能力

- 能执行 OpenSpec CLI
- 能读写仓库文件
- 能进行基本的代码修改与测试

### 默认执行能力

- Codex CLI（`codex` 命令可用）— 优先子 agent
- Claude CLI（`claude` 命令可用）— 溢出分流子 agent
- 并发启动多个子 agent 实例

### 其他可选能力

- 自动待办跟踪
- 自动 git 提交
- 自动测试与重试

### 降级规则

1. **Codex + Claude 均可用** → 按子 agent 选择策略混用（任务总数 >= 10 时启用 claude 分流）
2. **Codex 可用但 Claude 不可用** → 回退到仅 codex 模式（等同 v5.0 行为）
3. **Codex 不可用但 Claude 可用** → 全部使用 `claude -p` 替代 codex
4. **两者均不可用**（未安装、无网络、无 API Key）→ 降级为主 agent 内串行执行全部审核与实现任务
5. **不支持并发执行**（环境限制无法后台启动多进程）→ 仍先做依赖分析和批次规划，按 batch 串行执行
6. **不支持自动 git 提交** → 必须明确记录文档快照提交时机和建议命令
7. **不支持自动化测试** → 必须至少记录建议测试命令、重点验收场景和未验证风险

## 工作流

### 1. 识别需求并确定 change

1. 如果用户已给出 change 名称，直接使用。
2. 如果只有自然语言目标，派生一个 kebab-case change 名称。
3. 如果目标完全不清楚，先问一次用户要构建或修复什么。
4. 执行：

```bash
openspec new change "<name>"
```

5. 进入后续阶段，不等待额外确认。

如果 change 已存在，优先继续该 change，避免创建重复 change。

### 2. 建立 artifact 计划

执行：

```bash
openspec status --change "<name>" --json
```

从状态中识别：

- 当前 schema 名称
- `apply.requires`
- artifact 列表、状态、依赖关系

如果 schema 不是 `spec-driven`，记录"当前 workflow 不受本 skill 覆盖"并结束本次运行；这属于边界外场景，不属于流程性暂停。

### 3. 连续生成 artifact

按默认顺序推进：

`proposal -> specs -> design -> tasks`

对每个已满足依赖、状态为 `ready` 的 artifact：

1. 执行：

```bash
openspec instructions <artifact-id> --change "<name>" --json
```

2. 读取依赖 artifact
3. 根据 `template`、`instruction`、`context`、`rules` 生成目标文件
4. 写入文件并校验文件已存在
5. 生成完成后立即启动 codex 实例进行只读审核（后台运行）：

```bash
codex --approval-mode full-auto -q "请只读审核 openspec/changes/<name>/<artifact>.md，..." &
```

规则：

- `template` 是输出结构
- `instruction` 是该 artifact 的内容指导
- `context` 和 `rules` 是生成约束，不应原样写入文件
- 后续 artifact 生成前必须先读取前置 artifact

### 4. 提交未审核 artifact

所有 artifact 生成完成后、进入审核前，先提交一份原始文档快照，确保未审核版本有据可查。

推荐命令：

```bash
git add openspec/changes/<name>/
git commit -m 'docs(openspec): <name> stp1: 提交 <change 中文简述> 原始文档

change-id: <name>
- <按实际生成的 artifact 逐条列出，每条一行简述>'
```

规则：

- 提交范围只包含 `openspec/changes/<name>/`
- bullet 内容必须根据实际生成的 artifact 动态组装，禁止硬编码
- 如果 git 提交失败，记录失败原因和建议操作，但不阻塞后续审核

### 5. 审核与统一修订

使用 `wait` 收齐 Step 3 中后台启动的所有 codex 审核实例的结果，然后进入统一修订。

如果 Step 3 未并发启动审核（降级模式），则在此步骤串行执行审核。

审核规则：

- 审核总轮数上限为 2 轮
- 审核阶段只提出问题，不直接修改文档
- 不要边收到意见边改
- 必须等同一轮意见收齐后统一修订
- 修订时要联动检查 proposal、specs、design、tasks 的一致性
- 修订后如需再次审核，再拉起一轮 codex 实例

最终一致性复审（可选，建议执行）：

```bash
codex --approval-mode full-auto -q "请只读复审 openspec/changes/<name>/ 下全部 artifact..."
```

详细审核清单、审核模板和汇总模板见 `references/review-checklist.md`。

### 6. 审核后提交文档快照

审核通过，或达到 2 轮上限后，进入 apply 前应保留一份审核后文档快照。

推荐命令：

```bash
git add openspec/changes/<name>/
git commit -m 'docs(openspec): <name> stp2: 提交 <change 中文简述> 审核后文档快照

change-id: <name>
- <按实际 artifact 逐条列出修订要点或确认通过>'
```

标题中的标签规则：

- 审核通过：不需要额外标签
- 达到 2 轮上限仍有遗留：在 bullet 末尾追加 `- 遗留问题: <简述>`

规则：

- 提交范围只包含 `openspec/changes/<name>/`
- bullet 内容必须根据实际审核修订情况动态组装，禁止硬编码
- 如果 git 提交失败，记录失败原因和建议操作，但不阻塞后续实现

### 7. 进入实现阶段

执行：

```bash
openspec instructions apply --change "<name>" --json
```

读取 `contextFiles` 并理解 proposal、specs、design、tasks。

如果 apply 状态已是 `all_done`，直接跳到测试或归档判断；如果状态是 `blocked`，说明缺少前置 artifact，应记录阻塞原因，并将其视为当前运行的硬性失败而不是流程性暂停。

### 8. 任务依赖分析与批次执行

在修改代码前，先分析 `tasks.md` 中所有待完成任务的依赖关系，并输出任务执行计划，再开始实现。

详细批次划分规则、并发判定标准见 `references/batch-planning.md`。

**并发实现**

同一 batch 内互不冲突的任务，每个启动一个子 agent 实例并发实现（按选择策略分配 codex 或 claude）：

```bash
codex --approval-mode full-auto -q "请实现 OpenSpec 任务 <task-id>，..." &
codex --approval-mode full-auto -q "请实现 OpenSpec 任务 <task-id>，..." &
claude -p "请实现 OpenSpec 任务 <task-id>，..." --allowedTools "Read,Edit,Bash" &
wait
```

**每 task 主 agent 审查**

batch 内所有子 agent 实例 `wait` 完成后，由**主 agent**（执行本 skill 的编排侧 agent）逐 task 审查改动，确认实现质量后再进入集成复核。

审查流程：

1. 按 task 列表顺序，逐个审查本 batch 内已完成的 task
2. 审查内容：
   - 改动是否在 task 声明的文件范围内
   - 实现是否符合 specs/design 预期
   - 是否引入明显回归风险
3. 审查通过 → 继续下一个 task
4. 审查不通过 → 记录问题 → 修改代码 → 再次审查
5. **单 task 审查循环上限 2 轮**（与 §5 文档审核同构）
6. 达到 2 轮仍有遗留 → 记录遗留问题，继续下一个 task

审查规则：

- 审查与修改分离：先完整列出问题，再统一修改
- 主 agent 直接审查代码改动，不启动额外子 agent 实例
- 降级模式下（主 agent 串行实现）同样适用每 task 审查

**集成复核**

本 batch 全部 task 通过主 agent 审查后，启动一个 codex 实例检查接口一致性：

```bash
codex --approval-mode full-auto -q "请检查以下文件的接口一致性和回归风险：<file-list>..."
```

实现规则：

- 完成任务后回写 `tasks.md`，将对应任务标记为 `[x]`
- 不得把会写同一文件或明显共享接口的任务放在同一并发 batch
- 每个子 agent 实例必须明确写入负责文件范围，不得越界修改其他实例的文件
- 每 task 必须通过主 agent 审查后，才进入集成复核
- 集成复核通过后再进入下一批次
- 如果子 agent CLI 均不可用，仍按 batch 顺序执行，batch 内由主 agent 串行完成

#### 实现提交

每完成一个 batch 后建议提交一次，提交粒度按 batch 而非全部完成后一次性提交。

推荐命令：

```bash
git add <本 batch 修改的代码文件> openspec/changes/<name>/tasks.md
git commit -m '<type>(<scope>): <name> stp<N>: <本 batch 中文简述>

change-id: <name>
- <逐条列出本 batch 完成的任务编号和摘要>'
```

规则：

- `<scope>` 根据实际改动模块确定（如 `admin`、`docker`、`lib` 等）
- `type` 根据改动性质选择：`feat`（新功能）、`fix`（修复）、`refactor`（重构）
- `stp<N>` 从 stp3 开始，每个 batch 递增（stp3、stp4、stp5...）
- 提交范围包含本 batch 实际修改的代码文件 + `openspec/changes/<name>/tasks.md`

### 9. 测试与验收闸门

实现完成后，必须输出：

- 改动涉及的模块、目录、关键入口
- 已执行或建议执行的测试命令
- 重点验收场景

执行测试时遵循：

- 自动化测试通过：继续
- 没有自动化测试：记录验收要点和未覆盖风险后继续
- 测试失败：优先尝试修复，最多重试 2 次；若仍失败，记录失败原因并继续到归档总结

### 10. 归档

满足测试闸门后，执行：

```bash
openspec archive change "<name>"
```

归档前必须再次确认：

- OpenSpec artifact 与真实实现一致
- `tasks.md` 状态已更新
- 测试状态已记录

#### 归档提交

推荐命令：

```bash
git add openspec/changes/<name>/ openspec/specs/
git commit -m 'docs(openspec): <name> stp<N>: 归档 <change 中文简述>

change-id: <name>
- <摘要归档内容和实现结果>'
```

规则：

- `stp<N>` 为本 change 最后一个步骤编号，紧接实现阶段最后一个 stp
- 提交范围包含归档产物 + `openspec/specs/` 同步后的 spec 文件（如有）

## 输出模板

### 阶段汇报

```text
Using change: <name>
当前阶段：artifact 生成 / 未审核提交 / 审核 / 审核后提交 / 实现 / 测试 / 归档
进度：<简短状态>
```

### 归档总结

```text
## Archive Complete

Change: <name>
Artifacts: 审核通过（第 N 轮）/ 2 轮上限后继续
文档快照: stp1 已提交 / stp2 已提交 / 未提交（附原因）
Implementation: 已完成（stp3-stpN）/ 部分完成
Tests: 已通过 / 部分通过 / 无自动化测试
遗留问题: 无 / <清单>
```

更详细的审核汇总模板和任务执行计划模板见 `references/`。

## 不中断原则

- 这是一个核心全自动闭环 skill，默认不中断，不等待中间确认。
- 遇到文档问题、审核问题、测试失败或局部实现阻塞时，应记录问题、做自主决策、继续推进剩余链路。
- 只有在 OpenSpec CLI 完全不可执行或宿主环境无法完成最基本文件操作时，才允许以"环境不可执行"结束本次运行；这不是流程性暂停，而是硬性失败。

## 提交信息规范

本 skill 所有 git commit 必须遵循统一格式：

```text
<type>(openspec|<scope>): <change-name> stp<N>: <阶段中文简述>

change-id: <change-name>
- <bullet 1>
- <bullet 2>
```

## Guardrails

- 始终先读依赖 artifact，再生成后续 artifact
- 审核与修订分离，不要边审边改
- 文档审核轮数上限 2 轮，禁止无限循环
- 实现阶段每 task 主 agent 审查上限 2 轮，与文档审核同构
- 进入 apply 前应保留文档快照
- 子 agent 审核实例只读，不得修改任何文件
- 子 agent 实现实例之间文件写入范围不得重叠
- 并发实例 `wait` 收齐后再做下一步决策
- 子 agent 选择优先级：codex 优先，任务总数 >= 10 时启用 claude 分流
- codex 与 claude 实例可在同一 batch 内混用，但审核场景仅用 codex
