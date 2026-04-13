# 审核清单

这个文件提供 Sw Aegis Flow 中的详细审核规则、Codex CLI 调用模板和汇总模板。`SKILL.md` 只保留主流程，这里负责承载可复用的细节。

## 审核目标

每轮审核至少检查以下维度：

- 与 change 目标是否一致
- proposal、specs、design、tasks 是否前后一致
- 能力命名是否稳定
- 场景与验收标准是否完整
- design 是否能支撑 tasks
- tasks 是否可执行、可验证
- 文档是否存在明显矛盾、遗漏或越界内容

## 审核执行规则

- 审核阶段只提出问题，不直接修改文档
- 不要边收到意见边改
- 必须等同一轮意见收齐后统一修订
- 修订时要联动检查四类 artifact，而不是只改单份文件
- 审核总轮数上限 2 轮
- 第 2 轮结束后，即使仍有遗留问题，也要记录问题并继续推进

## Codex CLI 并发审核策略

- 默认每个 artifact 启动一个独立 codex 实例审核
- 生成 proposal/specs/design/tasks 后立刻后台启动 codex 审核实例，可与后续 artifact 生成并行
- 所有 codex 审核实例完成后（`wait`），再统一修订
- 只有 Codex CLI 不可用时，才降级为主 agent 内串行审核

这种方式在文档链路较长的 change 中效率显著高于串行审核。

## Codex CLI 审核调用模板

### 单个 artifact 审核

```bash
codex --approval-mode full-auto -q "请只读审核 openspec/changes/<name>/<artifact>.md，\
不要直接修改文件。检查它是否与 change 目标、前序 artifact 和当前 workflow 规则一致。\
输出'严重问题 / 一般问题 / 建议'；如果没有问题，请明确写'通过'。" &
```

### 最终复审

```bash
codex --approval-mode full-auto -q "请只读复审 openspec/changes/<name>/ 下的 \
proposal、specs、design、tasks 最终版本，不要修改文件。\
重点检查四者是否一致，是否还存在阻塞实现或验收的问题。\
输出'严重问题 / 一般问题 / 建议'；如果没有阻塞问题，请明确写'通过'。"
```

## 审核汇总模板

```text
## 审核汇总（第 N 轮 / 上限 2 轮）

严重问题
- ...

一般问题
- ...

建议
- ...

本轮结论：通过 / 需修订进入下一轮 / 2 轮上限已到带遗留继续
```

## 修订后检查点

统一修订完成后，至少复核：

- proposal 中的目标、范围、不做什么是否仍准确
- specs 中的能力、场景、验收标准是否与 proposal 一致
- design 中的关键方案是否覆盖 specs
- tasks 是否完整映射 design 和 specs
- 是否新增了未在 proposal/specs/design 体现的实现内容
