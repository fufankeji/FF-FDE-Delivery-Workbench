# 2026-09-07 本地维修验证版记录

## 范围

受测版本：`local-repair-v0.1`。源码：`backend/catalog.mjs`、`backend/workflow.mjs`、`backend/server.mjs`、`frontend/index.html`、`frontend/app.js`、`frontend/style.css`。测试：`backend/tests/workflow.test.mjs`。

已有目录和资料保留不变；完成本地报修、规则分析、图谱检索、资料预览、人工确认和草稿读回。没有开发或改动 FDE 工作台源码，也没有发布远端。

## 已执行验证

环境：macOS、本地 Node.js v24.16.0，无第三方运行依赖。

`node --test backend/tests/*.test.mjs`：退出 0，6 项全部通过：

1. 原始样本输入字段白名单；篡改历史答案不影响被测输入。
2. 应急规则、缺失保持待定、不可信指令与区域边界。
3. 相似报修两小时时间窗；不合并原始记录。
4. 真实图谱节点、边和 SourceId 来源。
5. 人工确认、资料指纹、重复操作返回原草稿与冲突拒绝。
6. 真实 HTTP 新增、分析、并发幂等保存、独立读取、服务重启后读取；拒绝未知资料路径和跨站请求；原件保持不变。

`node --check frontend/app.js`：退出 0。

## 服务检查

通过 `node backend/server.mjs` 启动，PID 54378，监听 `127.0.0.1:4177`。

`/api/health`、`/`、`/app.js`、`/style.css`、`/brand/ff-logo.png`、`/api/overview` 均返回 200，响应内容类型正确。概览读取到 12 条报修、35 份来源、56 个图谱实体和 56 条关系；正常运行区 0 条分析、0 份草稿，等待用户真实操作，不填演示结果。

## 原始材料保护

实施前读取 `.fde/`、`fde-resources/`、`fde-deliverables/`，共 144 个文件。按相对路径排序后的文件路径与内容哈希清单摘要为：

`918624510b5f9bfb0dbd0536e9bed281877ecb9b5d74b2aa2279ca33d13a5c48`

HTTP 集成测试前后逐个比较全部 144 份原件，完全相同。临时测试运行目录已清理，用户原始数据未删除。

## 尚未验证

未执行浏览器自动化或截图；实际 Apple 风格观感、窄屏、实体点击、表单操作和页面滚动由用户优先手动确认。技术测试通过不等于视觉验收。

没有调用付费模型、没有重建知识图谱、没有连生产接口，没有证明真实业务降本或客户验收。本轮不改写 FDE 阶段状态、架构发布记录或人工决定；工作台登记步骤见 `docs/TESTING.md`。
