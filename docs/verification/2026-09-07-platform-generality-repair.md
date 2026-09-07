# 平台通用性修复验证记录

日期：2026-09-07。分支：canonical 仓库 `main`，基线 `2e57ccb01e690958f58b73f4e573cde50b0d7b8f`。本轮未提交或推送 Git。

后续补测：同日用户明确授权后，已找到本地 Semantica `0.6.7` 环境，并通过真实 SDK 全链路及出版领域约束测试，见[SDK 验证记录](2026-09-07-semantica-sdk-verification.md)。下文“未运行真实 SDK”为本次修复首次交付时的历史状态；独立执行回执与客户签收真实性的剩余边界不因此消除。

## 范围与结论

依据[通用性审计](2026-09-07-platform-generality-audit.md)，修复通用 Host、Client、阶段 Skills 与 Semantica Adapter，不根据门店案例名称、节点 ID、路径或指标增加特判。保留八阶段产品合同、项目文件、旧生命周期合法入口和已记录的历史决定，不新增演示模式或自动推进。

本轮完成文件完整性、明确模拟来源拦截、消费查询无副作用、项目基础约束和生命周期隔离。**尚未完成独立机器执行回执、客户签收真实性验证、任意材料自动抽取或第二个真实客户项目八阶段验收。** 文件存在、摘要一致和状态声明均不能单独证明业务事实真实。

## 对照审计的处理

| 问题 | 已实施 | 仍有的边界 |
| --- | --- | --- |
| A1 空产物与空调查 | 固定产物校验项目内真实路径、普通文件、非空白和大小；调查的未知、受阻及未明确责任进入阻塞；简单项目可填写带项目内证据的不适用理由 | 不判断 Markdown 自然语言结论是否正确；不适用理由仍需 FDE 核对 |
| A2 声明冒充执行 | 第五阶段 PASS 绑定每份输出的 SHA-256；证据变化或缺失摘要标为 STALE；消费阶段、运行与事项的明确联调来源；切片拒绝空证据 | 摘要不是执行证明；未接入独立执行回执和外部人工签署，不能彻底阻止作者伪造完整记录 |
| A3 查询撤销第四阶段成果 | `semantic_context_query` 默认只读消费；显式 `purpose=validation` 才替换验证上下文并使旧切片失效 | 变更 Schema、材料或构建版本仍需重新验证；不保留整张图到 Agent 上下文 |
| A4 编辑规则不生效 | 身份键用于候选标识；属性冲突不再静默覆盖；校验必填、类型、唯一性、关系类型与端点、基数、来源和时间；遍历前过滤来源、置信度与有效期 | 并非完整 OWL/SHACL 实例引擎；自由文本规则和 `permissionScope` 不是执行级权限政策 |
| A5 能力表述超出实现 | 明确为规则抽取，规则分数不是校准置信度；查询必须指定问题或节点，query 是任务说明 | 未接入任意行业材料的自动理解；能力问题结果数量不等于业务答案正确 |
| A6 生命周期交叉 | 读取不自动迁移 V1；完成、返回和提示词按版本区分；V2 不再经旧状态操作跳过现场调查 | 旧项目需明确迁移后才能采用 V2，不自动改写旧历史 |
| A7 固定案例示意 | 产品介绍页改为通用流程表述，移除维修人名、固定案例指标与“实时同步”暗示 | 方法目录中的案例仍是合法示例；随仓库素材仍须显式导入 |

## 直接受影响的操作

1. 新建或切换项目：数据仍按注册 Workspace 定位，不填入测试项目资料。
2. 阶段评审：产物存在之外，新增内容、调查条件、来源性质与输出完整性校验；不会替 FDE 做决定。
3. 后续开发消费图谱：普通查询不改 Schema、图谱、切片、阶段 JSON 或原决定；验证查询仍显式使旧切片失效。
4. 本体发布与验证：当前验证写入 `checksVersion=project-constraints-v1`。旧验证不伪装成已执行新检查，需重新验证后才用于新的放行或查询。
5. 既有数据：文件、历史完成记录与当前阶段不回滚。历史进度与“按当前规则是否仍可评审”是不同信息。

## 验证结果

在 `upstream/deepseek-harness/` 执行；只统计最终有效结果，不把重跑累计成更多覆盖。

| 验证 | 结果与证明范围 |
| --- | --- |
| `stage.spec.ts`、`project.spec.ts`、`evaluation-workbench.spec.ts`、`delivery-workbench.spec.ts`、`generality-gates.spec.ts`、`semantica.spec.ts`、`routes.spec.ts`、`context-consumption.spec.ts` | 定向测试通过；真实 Semantica SDK 集成项因未配置测试解释器跳过 |
| `generality-gates.spec.ts` 最终单独回归 | 7 项通过，包含两个阶段空文件、外部符号链接、调查不适用、证据变动及六至八阶段模拟输入 |
| `python3 -B packages/fde/semantica/tests/bridge_test.py` | 6 项通过，出版领域 Schema 的身份、字段、关系基数、来源与时间过滤；抽取测试替换外部识别器，不宣称真实 SDK 抽取已验证 |
| `context-consumption.spec.ts` | 实际运行 Python Bridge 子进程；比较五份项目文件字节，普通查询不写设计状态；显式验证仍使旧切片失效 |
| `stage-workbench.client.spec.tsx`、`delivery-home-motion.client.spec.ts` | 55 项通过，直接受影响 Client 行为回归 |
| `tsc -b packages/fde/project packages/fde/stage packages/fde/semantica packages/client/ui-fde-project` | 通过 |
| `corepack pnpm run build` | 完整构建退出 0；产出 228 个 Client artifacts。存在 Vite 大包警告，不是运行验收结论 |
| 最终阻塞文案去重后的 Project Host | 定向测试与 `tsc -b packages/fde/project` 通过；`tsdown --env.DSH_BUILD_FACE host --filter @deepseek-ai/dsh-fde-project` 通过 |
| Product Spec 与受影响六个 Feature 校验 | 通过；同步既有中文 Spec / Plan / Tasks，未新拆 Feature 或重写方法论 |

构建曾误用不存在的包级 `bundle` script，随后按仓库实际 `tsdown --filter` 入口成功构建；该失败不作为构建通过证据。

### 真实插件加载快照

```sh
DSH_EXAMPLE_MODE=lib DSH_SNAPSHOT=replay corepack pnpm exec vitest run \
  --config vitest.snapshot.config.ts apps/cli/tests/fde-generality.snapshot.ts
```

1 项通过。测试经实际 App Boot / Loader 加载已构建的 Base 和 Web Bundle，使用共享子进程启动器与独立临时 DSH_HOME，绑定临时端口并调用真实 HTTP 路由，不使用手拼 Context 代替组装服务。不发送模型请求，不加载个人凭证，不启用遥测或浏览器。

固定输出已人工检查：

- 本地计算器、出版资料索引两个项目都从 discovery 开始。
- 三份空白产物显示 0 份有效记录，不能评审。
- 三份非空记录与完成声明可进入第二阶段人工评审，但不是内容真实性认证。
- 加入明确 `integration-fixture` 标记后不能按真实交付评审，来源阻塞只出现一次。
- 第二个项目仍无产物、不通过评审，未串入第一个项目数据。
- 读取前后阶段 JSON 字节一致。
- 模型可见查询说明与 `purpose` 参数由实际已加载工具注册表产生，并进入版本化快照。

快照准备过程中修正了测试自己的模块解析根和禁用纯浏览器依赖项；最终 replay 退出 0。生产 Bundle 配置没有因此修改。临时项目、模块链接和运行目录由启动器在退出后清理。

### 3080 实际服务

- 仅重新启动主工作树 3080，显式 `DSH_HOME=../../.runtime/dsh-home`；最终监听 PID 52412。
- 3081 PID 95068、4177 PID 54378 保持不变。
- 主页面 HTTP 200，实际服务的 FDE Project Client bundle 含“当前使用规则抽取”，不含旧“售后工单交付”“证据实时同步”文案。
- 真实已注册 Workspace 的只读 `/api/fde-project/snapshot` 返回 200。第二阶段可评审；第三阶段报告未明确现场条件；第四阶段旧验证要求重验；第五至八阶段明确联调来源均阻止新的真实评审。这不是删数据或自动退阶段。
- 重启前后运行注册表 SHA-256 相同：

```text
workspace.json  a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9
fde_stage.json  0e15ee61b2f68dfbbbc5ee1171ef81f69af61b579e26e6569347c10583f2037f
```

本轮未修改 `/Users/muyu/FDE-Agent/fde-agent`、其他注册项目或 `source-materials/fde-agent/project`，未调用付费模型、生成新的客户交付证明或触发真实业务外部动作。

## 未执行与使用注意

- 未做全仓覆盖率、浏览器截图验收、真实 Semantica SDK 构建或第二个真实客户项目八阶段回放；免密适配器检查不替代这些验证。
- 审计时已发现的 `controller.client.spec.ts` 跨项目预加载取消断言不一致仍未处理，本轮未修改该控制器，不宣称全仓测试全绿。
- 不要删除联调来源标记或自动重算旧摘要来恢复绿色状态。真实项目应保存真实运行输出后记录摘要，外部授权与签收仍由 FDE 核对；示例素材只用于了解格式与联调。
- 本轮已有构建产物继续位于 Git 忽略的 `lib/` 和 Web 构建目录，无新增长期运行副本、数据备份或依赖安装。
- 对应实现、规格与验证记录尚未提交 Git；本轮完成的是上述明确修复范围，不是对全部业务事实的独立认证。
