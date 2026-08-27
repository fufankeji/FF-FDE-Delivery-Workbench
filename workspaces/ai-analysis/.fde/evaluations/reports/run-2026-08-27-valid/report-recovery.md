# 报告版本与恢复（run-2026-08-27-valid）

| 版本操作 | 结果 | 证据 |
|---|---|---|
| 创建 v1（引用图表+查询产物） | version=1 | POST /projects/{id}/reports |
| 修订为 v2 | version=2 | POST /reports/{key}/revisions |
| 从 v1 恢复为 v3 | version=3, based_on_version=1 | POST /reports/{key}/restore/1 |
| 版本列表 | versions=[3,2,1]（历史未被覆盖） | GET /reports/{key} |
| 生成 HTML(v2) | HTTP 200，路径 `reports/html/{key}-v2.html` | POST /reports/{key}/html/2 |

report_key `fa6741a1-e17f-44ee-afc0-7b69ef4869a9`。结论：v1/v2/v3 均可读取，恢复不覆盖历史，HTML 生成成功。
