# FDE-Agent 项目素材

这份素材用于克隆仓库后，直接载入“连锁门店设备故障智能分诊项目”的文件与阶段记录。它是工作台的一个普通项目，不是针对门店业务写死的工作台逻辑，也不启用独立的演示状态链。

## 包含的内容

本版快照日期：2026-09-07。`manifest.json` 列出 192 份文件的相对路径、大小与 SHA-256，共约 1.21 MiB（不含清单与导入工具）。

| 路径 | 用途 |
| --- | --- |
| `project/fde-resources/` | 35 份原始资料，含文档、文本、结构化数据、PDF 和图片。 |
| `project/.fde/sources/`、`.fde/derived/` | 稳定 SourceId、原件版本及已有解析内容；未识别原件不伪装成已识别。 |
| `project/.fde/discovery/`、`.fde/stages/` | 第一阶段调查与后续各阶段结构化记录。 |
| `project/fde-deliverables/` | 各阶段固定产物。 |
| `project/.fde/design/` | Schema、知识候选、构建/验证/上下文记录和 56 实体、56 关系图谱快照。 |
| `project/.fde/architecture.json` | 业务项目架构记录。 |
| `project/frontend/`、`backend/`、`docs/` | 本地维修系统、测试、规格与历史证据。 |
| `manifest.json` 中的 `lifecycle` | 对应项目已有第八阶段状态和一轮改进记录，不是新执行回执。 |

数据来自脱敏仿真案例。后续交付链含人工构造的联调输入，具体见项目中的 `docs/verification/2026-09-07-delivery-flow-fixture.md`。历史文档保留原机路径、工作区标识、时间和结论用于追溯；这些不是接收者的本机配置，也不代表生产授权或实际客户签收。

## 导入和启动

在仓库根目录执行：

```bash
node source-materials/fde-agent/load.mjs
cd upstream/deepseek-harness
corepack pnpm install --frozen-lockfile
corepack pnpm run build
DSH_HOME="$PWD/../../.runtime/fde-agent-sample/dsh-home" \
  corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

进入项目中心中的项目后，从左侧回看各阶段；第四阶段可检查现有知识图谱，第五阶段可查看版本、架构和测试证据。已有历史结果不代表在接收者的机器上刚刚运行过。

脚本仅写入新建的 `.runtime/fde-agent-sample/`，生成新的 Workspace ID，保留空会话列表，首次进入项目时由工作台正常创建会话。它不读取本机凭证，不修改现有 `.runtime/dsh-home/` 或原 FDE-Agent 项目。

若要自选位置，传入一个**尚不存在**的目录：

```bash
node source-materials/fde-agent/load.mjs .runtime/fde-agent-second
```

使用输出中的 `dshHome` 启动。目标存在则拒绝覆盖；导入中途失败也不删除文件，请检查原因并使用另一个全新目录。资料校验失败时先恢复素材原件，不要通过重写证据摘要假装通过。应使用支持高精度修改时间的本地文件系统；无法恢复时间时脚本会报错，不登记工作区。

## 业务系统与验证

新终端中，从仓库根目录执行：

```bash
cd .runtime/fde-agent-sample/project
node backend/server.mjs
```

入口为 `http://127.0.0.1:4177`；冲突时设置 `REPAIR_PORT=4178`，不要停掉别人的进程。应用无需第三方依赖，使用已有图谱快照和本地规则，不调用付费模型。详细操作见 [业务系统 README](project/README.md)。

可在仓库根目录运行下面的最窄检查（业务 HTTP 测试使用随机端口和临时状态目录）：

```bash
node --test source-materials/fde-agent/load.test.mjs
node --test source-materials/fde-agent/project/backend/tests/workflow.test.mjs
```

## 保留、更新与边界

- 不包含作者的 Session 日志、模型配置、密钥、已有业务草稿、运行进程状态、缓存、构建产物和 UI 设计大图；不搬运其他项目。
- 仅查看历史图谱不需要 Semantica；重新构建需自行安装并配置 Provider，见仓库根 README。
- 原件与来源索引按字节保留，并通过 `.gitattributes` 禁止素材换行符自动转换；导入时恢复原始资料时间，不改 SourceId、不重签历史测试指纹。
- `git pull` 更新仓库素材，不更新你的可变运行区。想看新素材时载入另一个目录；旧目录中如有新会话和业务输入，先保留，不直接覆盖。
- 维护素材版本时，更新 `project/` 中相应文件与清单、保留引用闭环，并重新运行导入及业务测试；不要导出整个 `DSH_HOME`。已有测试证据如因文件变化失效，应重新运行测试，不修改旧结果来冒充通过。
- 只有未产生任何个人修改的导入副本才可完全由素材重新生成。会话在 `dsh-home/`，新增报修/草稿在 `project/.runtime/maintenance/`，这些不随 Git 备份。

`@赋范空间 独家研发`
