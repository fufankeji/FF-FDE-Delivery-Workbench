# 只读查询安全边界（run-2026-08-27-valid）

对项目来源（`data` 视图）提交合法与越界 SQL，核对该应用的服务端校验：

| 用例 | 结果 | 服务端响应 |
|---|---|---|
| 合法 SELECT | HTTP 200 | 生成 extract 产物 |
| DML `DELETE FROM data` | HTTP 400 | 「Only read-only SELECT queries are allowed」 |
| 多语句 `SELECT 1; DELETE FROM data` | HTTP 400 | 「Exactly one SQL statement is allowed」 |
| 主机文件函数 `read_text('/etc/hosts')` | HTTP 400 | 「cannot call DuckDB table functions」 |
| 未登记表 `SELECT * FROM secret_tbl` | HTTP 400 | 「may read only the registered data view」 |

结论：合法只读查询成功；所有越界查询由服务端拒绝，不生成成功产物。
