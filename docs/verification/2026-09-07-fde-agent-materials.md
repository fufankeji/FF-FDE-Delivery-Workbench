# FDE-Agent 素材分发与 README 验证

日期：2026-09-07。

## 范围

用户要求推送最新代码，并让拉取者能够加载当前 FDE-Agent 项目资料。未修改工作台行为、真实项目阶段或现有服务；采用 `source-materials/fde-agent/` 保存普通项目文件，导入脚本只初始化全新隔离目录。

保留 192 份文件，1,265,124 字节：35 份原始资料、Source 索引与解析、阶段记录、图谱及业务系统代码。清单附带历史阶段状态；排除私人会话、凭证、可变业务记录、进程状态、旧旁路预览和大体积设计候选图。

## 实际验证

命令：

```sh
node --test source-materials/fde-agent/load.test.mjs source-materials/fde-agent/project/backend/tests/workflow.test.mjs
```

结果：退出 0，7 项通过。覆盖导入后文件摘要和资料时间、全新 Workspace/阶段关联、重复导入拒绝覆盖，以及业务规则、图谱来源、人工确认和随机端口上的真实 HTTP 持久化闭环。

另在临时独立 `DSH_HOME` 启动已构建 Host，端口 3092。未使用 3080/3081/4177 进行变更：

- 首页 HTTP 200；只登记导入项目，无作者 Session。
- `/api/fde-stage/open`：第八阶段 `improvement`，revision 9，improvementCycles 1。
- `/api/fde-project-resources/list`：35 份资料，31 ready、1 unsupported、3 needs-ocr，无 stale。
- `/api/fde-project/snapshot`：图谱 ready，56 nodes / 56 edges；项目运行状态 stopped。
- 第五阶段原测试指纹保持 `sha256:7b00d555eab26ab19a2c8096f09da3211b650a50aac767c0a77dd768492b9a27`，current 为 true；未修改历史测试结论，人工验收 PASS 的联调性质已在 README 和原证据中说明。
- 第六至八阶段状态 ready，versionCurrent 与 reviewReady 为 true，使用原项目交付链数据，不增加第二条状态链。
- Host 读取后 192 个文件 SHA-256 全部仍与清单一致。
- 原主运行区 Workspace 注册表 SHA-256 保持 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`。

## 发布检查与边界

GitHub 发布技能的只读扫描未发现敏感文件、匹配凭证或超限文件；仅报告根 `docs/` 已跟踪且未忽略。按本仓库与用户要求保留原规格文档，未执行技能默认的文档移除；已向用户说明该差异。

本轮验证环境为 macOS、Node.js 24.16.0。未执行跨平台或浏览器视觉验收，未调用模型、Semantica 重建或生产系统。保留历史证据不等于在接收者环境完成新一轮验收。临时验证服务结束后停止，运行副本可删除，仓库素材可重新生成相同输入。
