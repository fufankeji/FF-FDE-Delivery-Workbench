---
name: custom-analysis-check
version: 1.0.0
description: 在项目沙箱中生成一份可追溯的数据检查摘要。
applies_to: [exploration]
entrypoints: [summarize.py]
permissions:
  files: project-read-write
  database: none
  network: none
  code: sandbox-only
---

# 自定义分析检查

运行 `scripts/summarize.py`，读取当前项目中显式传入的相对路径，并把行数、字段名和数值列合计写入
项目根目录的 `custom-analysis-summary.json`。这个 Skill 不访问网络，也不读取其他项目。
