---
name: english-native-reviewer
description: >
  审查、润色、优化英文材料——语法纠错、母语习惯表达替换、翻译腔识别、风格一致性检查。
  Use when user asks to 检查英文语法、润色英文、修改英文表达、把这段英文改得更地道、
  英文翻译腔检测、英文写作审查、帮我看下这段英文、rewrite this paragraph、
  make this more native、英文邮件润色、英文报告审查.
  不适用于中文写作审查、非英语语言翻译、编程代码审查.
  此技能需手动触发.
---

# English Native Reviewer

封装英文材料地道化审查的完整流程。

## 功能范围

- L1 语法与拼写纠错（硬错误）
- L2 翻译腔与中式英语（Chinglish）检测
- L3 用词精准度与母语习惯优化
- L4 风格一致性与可读性检查
- 多场景支持：商务邮件、正式报告、学术写作、营销文案
- 多种输出模式：直接修改、对比模式、仅标注

## 使用

### 场景 1：快速润色一段英文

用户提供一段英文，要求改得更地道。

**流程：**
1. 识别材料类型（邮件/报告/论文/文案等）和目标读者
2. 按四级递进审查（L1→L4）
3. 输出完整修改后的文本

**示例：**
```
用户：帮我把这段改得更地道一点：
"Through this project, we can make a decision to take measures to improve the quality."

输出：
"This project enables us to implement steps to improve quality."
（翻译腔：Through this we can → enables us to；冗余：make a decision to take measures → implement steps）
```

### 场景 2：正式文档审查（邮件/报告）

用户提交完整邮件或报告，要求全面审查。

**流程：**
1. 判断文档类型和正式度要求（默认 en-US，商务正式）
2. 四级递进审查，重点 L2（翻译腔）和 L4（风格一致）
3. 输出分级报告 + 完整修改版

**输出格式：**
```
## 🔴 必须修改（硬错误）
1. [段落/行] 原句 → 修改后 | 原因

## 🟡 建议修改（翻译腔/不地道）
1. [段落/行] 原句 → 修改后 | 原因

## 🟢 优化建议（提升表达质量）
1. [段落/行] 原句 → 修改后 | 原因

## 📊 整体评估
- 当前水平：[初级翻译腔 / 中级可理解 / 高级接近母语 / 母语级]
- 主要问题类型：[前2-3类]
- 风格判断：[正式度、目标变体、读者适配度]

## ✨ 完整修改版
[全文]
```

### 场景 3：仅标注不修改

用户想自己改，只需要标出问题。

**流程：** 正常审查，但只输出问题清单，不输出修改版。

### 场景 4：对比模式

用户需要看到原文和修改后的差异。

**流程：** 输出 markdown diff 格式或并排对比。

### 场景 5：风格改写

用户指定目标风格（更正式/更简洁/更口语化/更学术/en-GB）。

**流程：** 在 L4 层按指定风格调整，额外检查目标风格特征。

## 审查细则

### L1 · 语法与拼写（硬错误，必须改）

- 主谓一致、时态一致性、冠词 (a/an/the) 缺失或滥用
- 介词搭配错误（"discuss about" → "discuss"）
- 可数/不可数名词误用（"informations" → "information"）
- 中英文标点混用（，。"" → ,.""）
- 拼写错误、大小写不一致

### L2 · 翻译腔与中式英语

详见 `references/chinglish-patterns.md`。核心检测：
- 中国作者高频错误模式（discuss about / according to me think / very good quality 等）
- 句子过长（>40词）→ 拆分
- 过度被动 → 改为主动
- 连词堆砌（however, therefore, moreover）→ 自然过渡
- "there is/are" 开头滥用 → 直接用主语开头

### L3 · 用词精准度

- 模糊词替换：big→significant, good→effective, get→obtain/achieve
- 搭配地道性：raise awareness（而非 increase awareness）
- 避免冗余：in my personal opinion → in my opinion
- 商务正式度：don't → do not, can't → cannot

### L4 · 风格一致性

- 全篇语言变体一致（en-US vs en-GB）
- 标题格式一致（Title Case vs Sentence case）
- 缩写首次出现有全称展开
- 数字格式一致
- 段落长度合理（商务文档 ≤ 6 行/段）
- 语气一致，不跳跃

## 补充说明

### 依赖文件

- `references/chinglish-patterns.md` — 常见中式英语模式库（约 20+ 条）
- `references/business-style.md` — 商务写作风格指南
- `references/academic-style.md` — 学术写作要点

执行审查时按需读取，不需要全部加载。

### 长文本处理

文档超过 2000 字时：
1. 先通读全文判断整体问题类型
2. 分段审查，每段独立输出 L1-L4 结果
3. 最后合并整体评估和完整修改版
4. 不要在中间阶段就输出全部修改版（浪费 token）

### 默认行为

- 用户没指定语言变体 → 默认 en-US
- 用户没说输出模式 → 默认输出分级报告 + 完整修改版
- 商务场景 → 默认正式语气，避免口语化

### 边界情况

- **代码中的英文**：不审查代码注释/字符串中的英文，除非用户明确要求
- **品牌名/专有名词**：不修改，除非明显拼写错误
- **引用文本**：用引号或 blockquote 标记的内容，只检查语法不改变原意
- **极短文本**（<10 词）：快速检查 L1 即可，跳过 L2-L4
