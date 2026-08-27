# 项目导出、备份与恢复（run-2026-08-27-valid）

导出（备份）已验证：`GET /projects/{id}/export` 生成 zip（2.2MB、15 文件），包含：

- `northlight-export.json`：project、sources、artifacts、messages、runs、reports（最新版）、enabled_skills。
- `workspace/...`：数据（datasets/extracts、source 复制）、visuals、models、predictions、reports（含 Markdown/HTML）。

即项目、数据源配置（不含凭证）、报告与模型产物均可导出为一份可迁移备份。

**恢复项**：应用内**未暴露项目恢复/导入端点**（经核对仅存在 `POST /system/mysql/import` 与报告恢复 `/reports/{key}/restore/{version}`），因此「导入恢复」无法在本轮通过页面/API 复验；待确认数据保留于 `.runtime/` 工作区，恢复需人工或后续导入能力。
