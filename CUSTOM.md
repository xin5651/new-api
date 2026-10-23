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
