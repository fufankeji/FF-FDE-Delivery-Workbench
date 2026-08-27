# 凭据与敏感字段导出边界（run-2026-08-27-valid）

对项目执行导出（GET /projects/{id}/export），得到 2.2MB zip `northlight-a9a6b185-...zip`（15 个文件）。检查：

| 检查项 | 结果 | 证据 |
|---|---|---|
| 导出/源码含数据库密码、模型 API Key | 未发现 | zip 内容 grep：api_key/password/secret 无匹配 |
| 导出/源码含日志敏感值 | 未发现 | 同上 |
| 手机号、地址、身份证进导出 | 未发现 | zip 内容 grep：mobile/address/手机号/身份证 无匹配（样例本身不含） |
| northlight-export.json 含 config/credential | 未发现 | manifest 仅 project/sources/artifacts/messages/runs/reports/enabled_skills，无配置/凭证字段 |

> 说明：本框架在导出 manifest 中不含数据库/模型连接配置或凭证；样例数据本身已脱敏且不含手机号/地址。

**待复核项**：条件「模型外发仅脱敏字段与聚合结果」在本轮未实际触发——当前环境无模型凭证（离线），未发起真正的外部模型调用。需在模型启用会话中复核模型外发字段是否仅含脱敏/聚合。
