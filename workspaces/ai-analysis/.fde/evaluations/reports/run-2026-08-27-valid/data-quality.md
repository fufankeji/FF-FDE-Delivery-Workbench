# 样例数据质量检出（run-2026-08-27-valid）

对完整源数据（全 27 列、520 行）执行应用质量画像（POST /projects/{id}/analysis/profile），画像产物 id `3395752b-1cb2-4cf2-b929-6d2bbe4cd99a`：

| 预期问题 | 实际检出 | 证据 |
|---|---|---|
| 4 条重复明细 | `duplicate_rows = 4`；`order_line_id.unique=516`（520 行） | profile metadata |
| 关键字段缺失 | `missing_cells = 844`：delivered_at 67、aftersale_type 497(95.6%)、satisfaction_score 264(50.8%)、shipped_at 15、province 1 | profile fields 各列 null/nulls_rate |
| 渠道枚举不一致 | `channel.unique = 5`，包含「抖音」与「抖音商城」并存（不一致） | profile field channel |
| 满意度异常 | `satisfaction_score.max = 6.0`（>5 越界），min=1，null=264 | profile field satisfaction_score |

结论：应用质量画像可定位预期数据质量问题，字段级证据齐备。
