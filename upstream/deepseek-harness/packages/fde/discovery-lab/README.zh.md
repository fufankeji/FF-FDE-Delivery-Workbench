# @deepseek-ai/dsh-fde-discovery-lab

[English](README.md) | 中文

独立业务挖掘训练 Host 插件，提供五个版本化案例、原生岗位访谈、授权原件、证据核对、固定 Python 计算、报告历史和 Markdown/PDF 导出。不登记 Workspace，不改变项目阶段。

## 安装与存储

五案例必需素材已随源码和包内 `assets/` 提供，正常安装无需额外 ZIP。安装依赖前可从 Harness 根目录执行 `node packages/fde/discovery-lab/scripts/verify-assets.mjs`，完整构建也会检查全部素材。详见[来源与适配说明](SOURCE.md)。需要 Node 24.9+ 和 Python 3.9+；可用 `FDE_PYTHON` 指定 Python 可执行文件。`import:assets` 仅保留为维护者从已锁定原始交付包重建相同内容的工具，不是部署前提。

启动必须显式指定 `DSH_HOME`。固定案例素材保存在包内 `assets/`（248 个文件，约 36.7 MB）；`assets-manifest.json` 校验文件大小、摘要与 234 份案例原件引用。可变训练状态在 `$DSH_HOME/fde-discovery-lab/training.sqlite`，原生日志仍由 Host Session 后端保存。保留训练时须同时保留数据库与原生日志；恢复静态素材不覆盖训练。

接口为 `/api/fde-discovery-lab` 和 `/fde-discovery-lab`。后者只提供三个已构建 Client 应用文件，不提供案例定义。两个路径共用 Host/Origin/Fetch-Metadata 校验。素材缺失或损坏时仅本模块接口明确返回 503；应重新获取完整源码、构建并重启，不删除训练数据，不把该状态当作安装成功。

## Model Experience

打开大厅、选择岗位和恢复记录不调用模型。提交访谈会运行岗位独立的原生 Agent，只允许 `lookupRoleFacts` 和 `offerCaseAsset`；成功提交的回答可触发另一个证据核对 Agent。必需证据完整后，报告也由独立 Agent 生成。辅助 Agent 没有业务或工作区工具。这些操作可能产生模型费用。

每个训练 Agent 在自己的作用域挂载 `dsh-tool-executor-native`，并保留工具白名单与守卫；不会继承项目的 PTC 执行模式，也不会改变全局工具配置。

保留原实验室模型路由：`DEEPSEEK_PROVIDER` 默认 `deepseek-official`，`DEEPSEEK_MODEL` 默认 `deepseek-v4-flash`。凭据由已有 Host Provider 配置提供。训练不跟随、不改变项目的模型选择器。

访谈、证据核对和报告均不指定 `reasoningEffort`，沿用所选 Provider/模型的默认配置。不支持推理的模型不会被强制传入档位；省略参数不代表关闭思考。请求准备错误会将原生错误消息保留到访谈回执或辅助任务失败信息中，包括用户消息尚未提交的情况。真正取消时仍使用已有的兜底提示。

自定义 `llm-pi-ai` 网关若拒绝 `developer` 角色，在该 Provider 或模型上设置 `compat.supportsDeveloperRole: false`，不要全局覆盖。只声明模型实际支持的推理档位。若其接口要求 `reasoning_effort: none`，映射写作 `reasoningEfforts: { off: none }`；`none` 不是内部档位名，不支持推理的模型也不需要虚构档位声明。详见 [Provider 推理与兼容配置](../../llm/llm-pi-ai/README.zh.md)。特定网关是否接受请求，仍须在对应网关上验证。

#### KV Cache effect

同一案例版本的岗位提示词保持稳定。每个岗位有独立、持久的原生对话；核对和报告草稿使用单独 Session，会增加模型用量，但不会向项目 Session 注入内容。

## Known Limitations and Deferred Work

- 同一 Host 的用户共享每案例一个当前轮次，与原交付一致；没有账号、班级隔离或多用户权限。
- 没有报告回流、项目创建或自动阶段推进。
- HTTP 接口要求 Connection 认证后的 owner 身份并遵守同源检查。默认仅本机监听；显式局域网访问使用具体 `--host` IP 和启动授权链接，退役的 `--lan` 不能关闭认证。
- 确定性测试和脚本化原生组合不证明真实模型回答质量或视觉验收。
- 用户已授权本仓库和学员包携带运行白名单素材；原第三方声明与字体许可保留，集成包仍为 private / UNLICENSED，不另行声明整体 MIT 许可。
