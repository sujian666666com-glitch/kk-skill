# KK Skill

精选技能仓库 - 存放经过筛选和整理的高质量 OpenClaw Skills。

## 目录结构

```
kk-skill/
├── README.md           # 本文件
├── skills/             # 技能目录
│   ├── README.md       # 技能索引
│   └── [skill-name]/   # 具体技能
│       ├── SKILL.md
│       └── ...
├── docs/               # 文档
└── scripts/            # 辅助脚本
```

## 技能列表

| 技能名 | 描述 | 状态 |
|--------|------|------|
| sw-aegis-flow | OpenSpec spec-driven 闭环编排 skill，覆盖文档生成、审核、实现、测试与归档 | 已收录 |
| multi-search-engine | 多搜索引擎聚合检索说明型 skill，覆盖中外 16 个搜索入口 | 2026-04-29 新收录 |
| nano-pdf | 基于 `nano-pdf` 的自然语言 PDF 编辑 skill | 2026-04-29 新收录 |
| feishu-doc-manager | 飞书文档 Markdown 发布与权限管理说明型 skill | 2026-04-29 新收录 |
| smooth-browser-use | 面向真实浏览器事件、页面恢复与稳健文本输入的说明型 skill | 2026-04-29 新收录 |
| skill-vetter | 安全优先的 Skill 审核协议，适合在安装第三方 Skill 前做来源、权限和风险检查 | 已收录 |
| notion | Notion API 页面、数据源与区块管理 skill | 2026-05-04 新收录 |
| gemini | Gemini CLI 一次性问答与生成 skill | 2026-05-04 新收录 |
| openai-whisper-api | OpenAI Whisper API 音频转写 skill | 2026-05-04 新收录 |
| trello | Trello 看板、列表与卡片管理 skill | 2026-05-04 新收录 |
| gifgrep | GIF 搜索、下载与抽帧处理 skill | 2026-05-04 新收录 |
| goplaces | Google Places 查询与详情检索 skill | 2026-05-04 新收录 |
| tmux | tmux 会话控制与交互式 TTY 编排 skill | 2026-05-04 新收录 |
| apple-reminders | Apple Reminders 本地任务管理 skill | 2026-05-06 新收录 |
| sag | ElevenLabs 文本转语音与本地播放 skill | 2026-05-06 新收录 |
| oracle | 第二模型交叉审查与带上下文单次咨询 skill | 2026-05-06 新收录 |
| peekaboo | macOS UI 捕获与自动化控制 skill | 2026-05-06 新收录 |
| table-image | 将 Markdown 表格渲染为 PNG 图片的轻量 skill | 2026-05-06 增量收录 |
| web-perf | 基于 Chrome DevTools MCP 的网页性能审计 skill | 2026-05-06 增量收录 |
| jira | Jira 工单查看、检索与操作指引 skill | 2026-05-06 增量收录 |
| swiftui-ui-patterns | SwiftUI 组件与页面构建最佳实践参考 skill | 2026-05-07 新收录 |
| a-nach-b | 奥地利公共交通查询与路线规划 skill | 2026-05-07 新收录 |
| macos-spm-app-packaging | 无 Xcode 的 macOS SwiftPM App 打包与签名模板 skill | 2026-05-07 新收录 |
| bridle | 多 AI coding harness 配置与 profile 管理 skill | 2026-05-07 新收录 |
| performance-review-drafter | 经理绩效评语起草与偏差自检说明型 skill | 2026-05-19 新收录 |
| compliance-gap-analysis | 合规/安全框架差距评估与整改路线图说明型 skill | 2026-05-19 新收录 |
| vscode-agent-creator | VS Code Copilot 自定义 Agent 文件设计指南 skill | 2026-05-19 新收录 |
| chengxin | 同程官方旅行查询 API skill（机酒火车票/景区/度假） | 2026-05-19 新收录 |
| vmware-storage | VMware vSphere 存储管理 skill，覆盖 datastore / iSCSI / vSAN，需本地 VMware 凭证与人工批准后执行写操作 | 2026-05-19 latest 批次收录 |
| make-automation | 基于 ClawLink 的 Make 组织、团队、用量与账号信息检查 skill | 2026-05-24 latest 批次收录 |
| vercel-deployments | 基于 ClawLink 的 Vercel 项目、部署、域名与环境变量管理 skill | 2026-05-24 latest 批次收录 |
| ai | AI 常识与时效信息答题补强 skill，强调价格/榜单/硬件等信息要先查最新来源 | 2026-05-26 新收录 |
| ai-writing-agent | 面向文章、博客与营销文案的结构化写作说明型 skill | 2026-05-26 新收录 |
| ai-research-assistant | A 股投研场景的研报/公告/新闻摘要说明型 skill | 2026-05-26 新收录 |
| web-search-exa | 基于 Exa MCP 的语义搜索、内容提取与深度研究说明型 skill | 2026-05-26 新收录 |
| zt-web-fetcher | 基于 URL→Markdown 服务的轻量网页抓取说明型 skill | 2026-05-26 新收录 |
| healthcheck | 本地 JSON 水量/睡眠记录与统计 skill | 2026-05-26 新收录 |

## 使用说明

1. 浏览 `skills/` 目录查看可用技能
2. 每个技能包含独立的 `SKILL.md` 文档
3. 按文档说明安装和使用

## 贡献

欢迎提交 PR 添加新技能或改进现有技能。

## License

MIT