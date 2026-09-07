# Semantica 真实 SDK 验证

日期：2026-09-07。范围：用户要求补跑真实 Semantica SDK 测试，并允许必要模型测试。当前实现不调用大模型，实际没有读取全局凭证、调用计费 API 或发送客户资料。

## 实际运行环境

- SDK 源码：`/Volumes/SemanticaRuntime/semantica`。
- SDK 提交：`3acf8012733ec6a1b07508660fe69c1e58e70242`，工作树检查无修改。
- Python：`/Volumes/SemanticaRuntime/semantica/.venv/bin/python`，Python 3.12。
- 实际导入版本：Semantica `0.6.7`，模块来自上述本地源码。
- 上一轮跳过原因：`FDE_SEMANTICA_TEST_PYTHON` 未设置，测试入口执行 `it.skip`；不是已经确认缺少 API Key，也不是 SDK 验证失败。

## 结果

### 1. 已有真实 SDK 全链路

```sh
FDE_SEMANTICA_TEST_PYTHON=/Volumes/SemanticaRuntime/semantica/.venv/bin/python \
PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
corepack pnpm exec vitest run packages/fde/semantica/tests/semantica.spec.ts \
  -t 'runs the real pinned Semantica SDK'
```

退出 0；目标测试 1 项通过，约 12.54 秒（套件总计 13.43 秒）。另外 4 项因 `-t` 筛选未执行，不是 SDK 缺失跳过。

真实运行：项目资料写入与索引 → 本地解析 → 绑定版本化 Source → Provider 健康检查 → 规则候选抽取 → `OntologyEngine.from_data` 候选本体建议 → 重存确认定义与候选审核 → Ontology 校验及 SHACL 生成 → `GraphBuilder.build` → `GraphValidator.validate` 和项目约束检查 → 有边界上下文。得到 2 个实体、1 条关系及来源；重新绑定材料后依赖证据按预期过期。

该测试后半段的切片报告与 Go 是临时项目中的状态操作测试，不是实际客户业务运行或外部签收证据，不能据此宣称八阶段真实交付已完成。

实际运行通过 Node 子进程包装器创建独立临时 `TMPDIR`，测试结束在 finally 中删除该次拥有的临时项目；未修改当前 FDE-Agent 或注册表。

### 2. 不同领域与负例

```sh
FDE_SEMANTICA_TEST_PYTHON=/Volumes/SemanticaRuntime/semantica/.venv/bin/python \
PYTHONDONTWRITEBYTECODE=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
corepack pnpm exec vitest run packages/fde/semantica/tests/sdk-generality.spec.ts
```

退出 0；1 项通过，约 7.81 秒（套件总计 8.00 秒）。使用出版领域的作者、邮箱身份、文章和撰写关系，没有替换 Semantica 类、SDK 导入或外部识别器。

- 从样本文本得到 4 个实体、1 条无歧义关系。
- 两位同名作者因邮箱不同保持两个 ID，没有按名字合并。
- 同名作者的歧义关系不会自动连接，明确产生待消歧诊断。
- 含邮箱属性的 Ontology / SHACL 经真实 SDK 生成；真实建图和验证通过。
- 向真实图输出注入缺少身份字段、错误字段类型、错误 Domain／Range 和违规关系基数，独立验证失败并返回对应问题代码。
- 过期作者不进入上下文；把允许来源改成另一项目来源后返回空实体集合。

这个测试只交换内存输入与子进程 JSON，不创建长期数据副本或修改业务项目。

## 密钥与能力边界

当前 Adapter 指定 Pattern NER 和项目关系规则；本体建议基于候选数据，图谱构建使用已提取候选，图谱校验为本地 SDK 加项目约束。上下文查询由 Adapter 执行。因此本轮不需要 provider、model、base URL 或 API Key，也没有验证大模型语义抽取质量。

只有另行接入 SDK 的 LLM 抽取模式时，才需要具体模型服务、模型名称、地址和密钥；单纯填入密钥不会改变当前管线。全局凭证库未访问。

测试环境变量只用于这两次测试进程，没有改写 3080 的部署配置，没有重启 3080、3081、4177 或 Semantica 服务。测试成功说明当前 Adapter 与已部署 SDK 的上述操作兼容，不替代浏览器视觉验收、真实客户业务评测、完整 SHACL 语义支持或独立执行回执认证。

本轮新增 SDK 通用性回归测试，并补齐包级中英文运行说明。未安装依赖、下载模型、生成长期运行目录、修改上游 Semantica 源码或提交 Git。
