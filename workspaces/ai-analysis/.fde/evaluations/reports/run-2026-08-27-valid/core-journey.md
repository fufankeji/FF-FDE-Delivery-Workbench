# 核心分析链路（run-2026-08-27-valid）

通过运行中的候选系统（HTTP API，`http://127.0.0.1:8000/api`）完成一条连续链路，每步均产生真实项目产物并保留血缘：

| 步骤 | 端点 | 结果 | 产物 ID / 证据 |
|---|---|---|---|
| 项目创建 | POST /projects | 200 | `a9a6b185-9228-4af9-98f8-0327369691c3` |
| 接入样例 CSV | POST /projects/{id}/sources/file | ready, 520 行 | source `ee4d589b-37fd-4185-90a5-9f6fbc27297a`, fingerprint `b44c966361fee66d...` |
| 只读查询 | POST /projects/{id}/query | extract | `2227e3a2-57ef-4d55-aecb-f0b1bace38e2`, lineage→source |
| 质量画像 | POST /projects/{id}/analysis/profile | profile | `fcb41ee5-6e5e-4631-b70f-0808c5fb2074` |
| 图表 | POST /projects/{id}/charts | visual(bar) | `04454dcd-e892-4167-b1f7-6dfaf12c15af`, data_scope rows_used=500/520 |
| 模型实验 | POST /projects/{id}/models | clustering | code `5bbfe04f...`, model `5bbfe04f-b371-49ff-8923-2f8ab1f5da83`, predictions `83abc2f3-f826-4107-b698-e325fd94e029` |
| 报告 v1 | POST /projects/{id}/reports | report v1 | key `fa6741a1-e17f-44ee-afc0-7b69ef4869a9` |

链路完成后，`GET /projects/{id}/artifacts` 可见 extract/visual/profile/model/predictions/report 产物，血缘（lineage）指向源数据。结论可回到项目内 数据→查询→图表→模型→报告版本。

原始步骤与状态详见 `validation-run.json`。
