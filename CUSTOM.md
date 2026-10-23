# CUSTOM.md — 二次开发改动清单

> 本仓库 fork 自上游 `QuantumNous/new-api`。
> 规则：`main` 只同步上游、一行不改；所有二次开发都在 `custom` 分支（功能分支从 `custom` 拉出，写完合回 `custom`）。
> 本文件只放在 `custom` 分支，用来记录每一处改动，合并上游新版时先看这里。

## 分支说明

| 分支 | 用途 |
|---|---|
| `main` | 与上游保持一致，只做 `Sync fork` / `merge upstream/main`，禁止直接改代码 |
| `custom` | 自己的正式版本，部署用这个分支 |
| `feature/<功能名>` | 单个功能的开发分支，从 `custom` 拉出，完成后合回 `custom` 并删除 |

## 上游同步记录

| 日期 | 同步到的上游版本/提交 | 合并到 custom 时的冲突文件 | 处理人 |
|---|---|---|---|
| 2026-10-23 | main @ 33c61a2（建 custom 分支时） | 无 | Muse（辛欣授权） |

同步步骤：

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main

git checkout custom
git merge main
git push origin custom
```

## 改动总览（一行一个功能）

| 日期 | 功能/改动 | 类型 | 涉及文件 | 是否改了上游原文件 |
|---|---|---|---|---|
| 2026-10-23 | 建立 custom 分支 + 本清单 | 基础设施 | `CUSTOM.md`（新增） | 否 |
| 2026-10-23 | 工单功能：登录后提交工单、我的工单、回复、管理员处理全部工单 | 新增功能 | 新增 `model/ticket.go`、`controller/ticket.go`、`web/src/features/tickets/`、`web/src/routes/_authenticated/tickets/`；修改 `model/main.go`（AutoMigrate 注册 2 行）、`router/api-router.go`（路由 15 行）、`web/src/hooks/use-sidebar-data.ts`、`web/src/hooks/use-sidebar-config.ts`、`web/src/routeTree.gen.ts`（构建生成）、`web/src/i18n/locales/*.json`（7 个文件各加 36 个键） | 是（仅上述小改动） |
| 2026-10-23 | 监控中心：使用状态监控（今日用量概览 + 渠道健康探测与历史）+ 智商监控（固定探针题自动评分、掉分预警） | 新增功能 | 新增 `model/monitor.go`、`controller/monitor.go`、`controller/monitor_engine.go`、`setting/operation_setting/monitor_center_setting.go`、`web/src/features/monitor/`、`web/src/routes/_authenticated/monitor/`；修改 `model/main.go`（AutoMigrate 2 行）、`model/system_task.go`（任务类型常量 1 行）、`controller/system_task_handlers.go`（注册定时探测 1 行）、`router/api-router.go`（路由 14 行）、侧边栏两处 hooks、`web/src/i18n/locales/*.json`（7 个文件各加 45 个键） | 是（仅上述小改动） |

类型可选：新增功能 / 接口 / 页面 / 配置 / 修复 / 数据库

## 改动详情

### 2026-10-23 — 建立 custom 分支

- 内容：从 `main` 拉出 `custom` 长期分支，新增本清单文件。
- 原因：二次开发与上游更新隔离，后续同步上游不冲掉自己的改动。
- 影响的上游原文件：无。

### 2026-10-23 — 工单功能

- 内容：登录用户可在左侧「个人」区进入「工单」页提交工单（标题/分类/优先级/内容）、查看自己的工单、点开看回复并继续回复、可关闭自己的工单；管理员多一个「全部工单」视图，可回复（状态自动变「已回复」）、标记已回复、关闭任意工单。普通用户看不到别人的工单（接口层校验）。
- 接口：`POST /api/ticket/` 提交；`GET /api/ticket/self` 我的工单；`GET /api/ticket/` 全部工单（管理员）；`GET /api/ticket/:id` 详情（含回复）；`POST /api/ticket/:id/reply` 回复；`PUT /api/ticket/:id/status` 改状态（普通用户仅能关闭自己的）。
- 涉及文件：新增 `model/ticket.go`、`controller/ticket.go`、`web/src/features/tickets/`（types/constants/api/index + 两个 dialog 组件）、`web/src/routes/_authenticated/tickets/index.tsx`；修改 `model/main.go`（AutoMigrate 加 `&Ticket{}`、`&TicketReply{}`）、`router/api-router.go`（新增 ticket 路由组）、侧边栏两处 hooks、7 个 i18n 文件（各 +36 键）、`web/src/routeTree.gen.ts`（构建自动生成）。
- 数据库：新增 `tickets`、`ticket_replies` 两张表（AutoMigrate 自动建），不改上游原有表。
- 验证：本地 `go build ./...` 通过、`bun run build` 通过、typecheck/lint（改动文件）通过；本地实跑（SQLite）完整走通：提交→列表→详情→回复→状态变化→关闭→关闭后拒绝回复→普通用户越权访问被拒→普通用户访问管理员列表被拒。
- 回滚办法：删除上述新增文件，还原 `model/main.go`、`router/api-router.go`、侧边栏 hooks 与 i18n 的对应改动，重新构建；数据库两张新表可保留不用或手动 DROP。

### 2026-10-23 — 监控中心（使用状态 + 智商监控）

- 内容：管理员在左侧「管理员」区进入「监控中心」页。①使用状态：顶部概览卡（今日请求数/Token 数/错误率/渠道健康汇总）；渠道状态列表显示每个渠道的最新探测结果（健康/慢/很慢/不可用四档 + 延迟 + 报错信息），可单渠道手动探测、一键全量探测，也可开启定时自动探测（间隔可配，走系统任务框架 `monitor_probe`，多节点防重复）；每条探测结果都落库留历史。②智商监控：内置 12 道固定探针题（数学/逻辑/知识/推理/指令遵循，答案可确定性判定），选渠道+模型手动跑一轮，逐题自动评分（0–100），结论分正常/注意/疑似降智三档；与该渠道+模型上次成绩对比，掉分达到阈值（默认 20，可配）自动亮「掉分预警」；点记录可看逐题的期望值与实际回答。
- 方法来源（开源借鉴，只借方法不整仓合并）：探测分档与指标借鉴 `idemerge/llm-api-bench`（四档健康）与 `yigehaozi/relay-status-monitor`（对 New API 的采集项）；智商探针与确定性评分借鉴 `HoneyMeta/ccfingerprint`、`mintesnot-teshome/llm-verify` 的探针思路与 `haowang02/codex-candy-eval` 的固定题批量测正确率方法（后者无许可证，题面为本项目原创，未复制其代码与原题）。
- 接口（均需管理员）：`GET /api/monitor/overview` 今日用量与健康汇总；`GET /api/monitor/channels` 渠道+最新探测+最新智商分；`POST /api/monitor/probe/:id` 单渠道探测；`POST /api/monitor/probe-all` 全量异步探测；`GET /api/monitor/probes` 探测历史；`POST /api/monitor/iq/run` 跑一轮智商测试；`GET /api/monitor/iq/runs` 智商记录；`GET/PUT /api/monitor/settings` 监控设置（存为 `monitor_center_setting.*` 配置项）。
- 实现要点：健康探测复用上游渠道测试通道（`testChannel`，全渠道类型可用）；智商测试按渠道类型直调上游原生接口（OpenAI 兼容 / Anthropic Messages / Gemini generateContent 三种格式，Azure 与 VertexAI 暂不支持智商测试、会明确报错），temperature=0，本地确定性判分（数字题取回答中最后一个数字比对，文本题关键词包含匹配）。
- 涉及文件：新增 `model/monitor.go`、`controller/monitor.go`、`controller/monitor_engine.go`、`setting/operation_setting/monitor_center_setting.go`、`web/src/features/monitor/`（types/constants/api/index + 3 个 dialog 组件）、`web/src/routes/_authenticated/monitor/index.tsx`；修改 `model/main.go`（AutoMigrate 加 `&ChannelProbe{}`、`&IQTestRun{}`）、`model/system_task.go`（加 `SystemTaskTypeMonitorProbe` 常量）、`controller/system_task_handlers.go`（注册 `monitorProbeHandler` 一行）、`router/api-router.go`（新增 monitor 路由组）、侧边栏两处 hooks、7 个 i18n 文件（各 +45 键）、`web/src/routeTree.gen.ts`（构建自动生成）。
- 数据库：新增 `channel_probes`、`iq_test_runs` 两张表（AutoMigrate 自动建），不改上游原有表。
- 验证：`go build ./...` 通过；前端 build/typecheck/lint（改动文件）全过；本地实跑（SQLite + 本地 mock 上游）全流程：探测健康（39ms）→智商测试满分 100（12/12、结论正常）→把 mock 切成全答「不知道」后重测得 0 分、结论「疑似降智」且掉分预警亮起→设置保存回读一致→普通用户访问监控接口被拒。
- 回滚办法：删除上述新增文件，还原 `model/main.go`、`model/system_task.go`、`controller/system_task_handlers.go`、`router/api-router.go`、侧边栏 hooks 与 i18n 的对应改动，重新构建；两张新表可保留不用或手动 DROP。
- 2026-10-23 晚调整（辛欣拍板）：入口由左侧「管理员」区挪到「个人」区，权限放开给普通登录用户——`router/api-router.go` 中 monitor 路由组改 `UserAuth`，仅 `PUT /api/monitor/settings` 单独保留 `AdminAuth`（防普通用户改全局探测配置）；前端去掉 monitor 路由的管理员守卫，「监控设置」按钮仅管理员可见；侧边栏配置 `/monitor` 改属 personal 区。已实跑验证：普通用户可看概览/渠道、可探测、可跑智商测试（100 分），改设置被拒。

<!-- 新改动按下面格式往下加：
### YYYY-MM-DD — 功能名
- 内容：改了什么
- 原因：为什么改
- 涉及文件：新增 `xxx`；修改 `yyy`（改了哪几处）
- 数据库：是否加了新表/新字段，无则写“无”
- 回滚办法：删哪个文件 / 还原哪处即可
-->

## 二开约定（减少合并冲突）

1. 能新增文件就不改上游原文件；必须改时改动尽量小、集中，不顺手格式化、不重构。
2. 配置走 `.env` 和后台设置，不把密钥、地址写死进代码。
3. 数据库只加新表、新字段，不改、不删上游原有字段。
4. 每一处改动都登记到上面的表格和详情里，不登记的改动视为不存在。
5. 勤同步上游（建议 1–2 周一次），不要攒几个月再合。
