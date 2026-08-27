# 运维与维护指南（候选）

> 验收移交阶段产物（候选） ｜ 最终版本 `DS4-0.1.0-local-20260827`
> 说明：面向运维/维护职责的交接材料。基于 `fde-deliverables/05-deployment-trial/deployment-runbook.md` 与研发运行手册；**仅为候选指南，未获企业/FDE 确认**。

## 1. 运行架构与边界

- 本地优先、单用户分析工作台；数据接入、只读查询、探索、特征工程、机器学习、产物血缘、版本化报告、Skills 组织在同一项目工作区。
- 前端（5173）/ 后端 API（8000）/ 本地 SQLite 元数据与项目文件空间（`.runtime/`）。
- 确定性能力不依赖在线模型；仅「在线对话/模型服务」需要模型 API Key。

## 2. 安装与启动

```bash
uv sync --group dev
pnpm --dir frontend install --frozen-lockfile
cp .env.example .env && chmod 600 .env
./scripts/start.sh
```

- 页面 `http://127.0.0.1:5173/`；健康 `http://127.0.0.1:8000/api/health`；文档 `http://127.0.0.1:8000/docs`。
- 端口冲突：`NORTHLIGHT_API_PORT=18100 NORTHLIGHT_WEB_PORT=15180 ./scripts/start.sh`。
- 受限环境提示：`UV_CACHE_DIR` / `pnpm --store-dir` 指到工作区；esbuild 需 `pnpm --dir frontend rebuild esbuild`。

## 3. 停止与数据

```bash
./scripts/stop.sh
```
- 停止不删除 `.runtime/`；彻底重置前先备份；删除 `.runtime/` 会移除项目、来源、报告、模型配置与运行记录。

## 4. 健康与监控

- 健康接口、`/api/system/overview`（status/model/mysql/sandbox/项目数/资产数/技能数/运行时体积/限制配置）。
- 运行日志：`.runtime/logs/api.log`、`.runtime/logs/web.log`。

## 5. 安全与凭据运维

- 数据库/模型凭据仅存 `.runtime/settings/connections.json`（`600`）或进程环境；不进入源码、状态响应、Artifact 元数据或导出包。
- 查询只读（应用层 SQL AST + 数据库只读会话）；脚本型 Skill 在无网络沙箱运行。
- 敏感字段（手机号/地址/身份证）不进入首期样例；会员 ID 不可逆映射；导出不含这些字段与凭证（已验证样例）。
- **受控边界**：当前导出包可含原始/派生数据；正式运维需确认数据保留与脱敏策略、备份位置与保留时长。

## 6. 备份与恢复

- 备份：项目导出（`GET /projects/{id}/export`）生成含数据/产物/报告的 zip（可作为迁移备份）。
- 恢复：**应用内无项目导入/恢复端点**——恢复需人工（恢复到 `.runtime/` 工作区后启动），属待补能力/需运维约定（见 `handover-record.md`、`issue-closure-list.md`）。
- 模型/数据库连接与项目文件保留于 `.runtime/`；删除不可逆。

## 7. 故障与回滚

- API 未就绪：`api.log` + 端口；Web：`web.log` + 端口 + `NO_PROXY`。
- 回滚策略见部署运行手册 §5（应用回滚、前后端回滚、数据回滚）；正式回滚演练未执行，证据待补。

## 8. 维护关注项（未决）

- 模型凭证：未配置 → Agent 可追溯性/在线对话未验证。
- 性能：无正式性能设备/百万行基线。
- 报告导出：PDF/Word 未定，一期为自包含 HTML。
- 多用户/权限：一期单机，无企业级鉴权/审批/协作。

> 本指南为候选产物；运维责任移交需在 `handover-record.md` 中由 FDE/企业确认，不能被本材料代替确认。
