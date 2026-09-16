# @deepseek-ai/dsh-fde-discovery-lab

[English](README.md) | 中文

独立业务挖掘训练 Host 插件，提供五个版本化案例、原生岗位访谈、授权原件、证据核对、固定 Python 计算、报告历史和 Markdown/PDF 导出。不登记 Workspace，不改变项目阶段。

## 安装与存储

从 Harness 根目录执行 `corepack pnpm --filter @deepseek-ai/dsh-fde-discovery-lab import:assets /absolute/path/to/FDE-业务挖掘实验室-完整交付-v0.3.2-2026-09-15.zip`，再启动现有 Web profile。导入器校验固定运行包摘要和每份授权资料。详见[来源与适配说明](SOURCE.md)。需要 Node 24+ 和 Python 3.9+；可用 `FDE_PYTHON` 指定 Python 可执行文件。

启动必须显式指定 `DSH_HOME`。案例素材保存在包内 `.assets/`（约 36 MB，可重建）；可变训练状态在 `$DSH_HOME/fde-discovery-lab/training.sqlite`。原生日志仍由 Host Session 后端保存。保留训练时须同时保留数据库与原生日志；重新导入素材不覆盖训练。

接口为 `/api/fde-discovery-lab` 和 `/fde-discovery-lab`。后者只提供三个已构建 Client 应用文件，不提供案例定义。两个路径共用 Host/Origin/Fetch-Metadata 校验。缺少素材时仅本模块接口明确返回 503，不移除已有工作台路由。

## Model Experience

打开大厅、选择岗位和恢复记录不调用模型。提交访谈会运行岗位独立的原生 Agent，只允许 `lookupRoleFacts` 和 `offerCaseAsset`；成功提交的回答可触发另一个证据核对 Agent。必需证据完整后，报告也由独立 Agent 生成。辅助 Agent 没有业务或工作区工具。这些操作可能产生模型费用。

保留原实验室模型路由：`DEEPSEEK_PROVIDER` 默认 `deepseek-official`，`DEEPSEEK_MODEL` 默认 `deepseek-v4-flash`。凭据由已有 Host Provider 配置提供。训练不跟随、不改变项目的模型选择器。

#### KV Cache effect

同一案例版本的岗位提示词保持稳定。每个岗位有独立、持久的原生对话；核对和报告草稿使用单独 Session，会增加模型用量，但不会向项目 Session 注入内容。

## Known Limitations and Deferred Work

- 同一 Host 的用户共享每案例一个当前轮次，与原交付一致；没有账号、班级隔离或多用户权限。
- 没有报告回流、项目创建或自动阶段推进。
- 显式 LAN 模式仍无登录鉴权，仅用于可信网络。
- 确定性测试和脚本化原生组合不证明真实模型回答质量或视觉验收。
- 原交付没有声明整体公开再分发许可；集成包保持 private。
