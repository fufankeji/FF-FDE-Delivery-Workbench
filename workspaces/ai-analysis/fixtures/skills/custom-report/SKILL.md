---
name: cohort-report-method
version: 1.0.0
description: 为经营分析报告增加分群、反例和证据边界检查。
applies_to: [reporting]
permissions:
  files: project-read
  database: read-only
  network: none
  code: structured-tools-only
---

# 分群经营报告方法

生成报告时，在基础经营结论之后增加“分群与反例”章节：至少比较两个真实业务分群，并检查整体趋势
是否被单一地区、品类或时间段主导。每个承重数字必须引用项目内登记的产物 ID；证据不足时明确写成
待补分析，不得用常识补成确定结论。
