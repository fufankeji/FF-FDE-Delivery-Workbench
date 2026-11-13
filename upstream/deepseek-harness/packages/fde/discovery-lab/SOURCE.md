# 业务挖掘实验室来源与适配边界

来源是用户提供的 `FDE-业务挖掘实验室-完整交付-v0.3.2-2026-09-15.zip`。原包标识为 `@jiutian/fde-discovery-lab@0.3.2`，面向 Harness `0.1.5-rc.2`；平台当前基座以根仓库锁文件为准。用户于 2026-11-13 明确要求将运行必需素材纳入现有 GitHub 仓库与新学员源码包，正常部署不再依赖另行提供原 ZIP。

## 可追溯输入

- 运行包 `安装包/jiutian-fde-discovery-lab-0.3.2.tgz`，SHA-256：`2c68c7b2ef51f6e92c1cb00e796dbbdb249362eb249821152a9f26128e057678`。
- 源码归档 `源码/FDE-业务挖掘实验室-源码-v0.3.2-2026-09-15.zip`，SHA-256：`267f87063964110322211aed8666893757f94eacf1cfbcd28993468ece8af7f4`。
- [source-manifest.json](source-manifest.json) 记录初次导入、适配前的 23 个业务与界面文件摘要；并非最终修改后文件摘要。
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 保留运行包的第三方声明；字体许可随素材导入。

## 保留与修改

`src/vendor/` 来自原 `development/server/`；Client 包 `app/` 来自原界面源码。原岗位事实、工具授权、核对、计算、报告和 UI 主流程保留。原生事件读取改为当前宿主的 `session.events`，持久化刷新改为 `sessions.flush(session)`；当前 JSONL 延迟写入，因此先核对精确 Session 的物理记录，再决定恢复或创建，未发问的岗位可以重启恢复。插件卸载先结束自身 Agent 和后台工作再关闭 SQLite。

HTTP 与 Client API 基址改为 `/api/fde-discovery-lab`。Host 包独立处理请求信任、静态文件白名单和显式 `DSH_HOME`。固定 Python 程序仅继承运行必需的环境变量，不继承模型凭据或任意 Python 注入路径。原 `domain.test.mjs`、`finance_versioning.test.mjs`、`five_cases.test.mjs` 仅适配导入路径、素材根目录、API 前缀和当前宿主测试替身；新增真实 Loader 组合、计算/导出和入口测试。

`assets/` 是唯一受版本管理的运行素材源：五个案例、234 份授权资料、固定 Python、字体与许可，共 248 个文件、36,654,779 字节。`assets-manifest.json` 固定逐文件大小与摘要；构建、Host 初始化和学员包均检查此清单。`scripts/import-assets.py` 仅供维护者从上述精确运行包重建相同素材，不能静默覆盖不同内容。源码归档中的教师材料、未来事件、作者运行记录、打包工具和依赖不进入素材目录。完整交付 ZIP、构建产物、依赖、SQLite 和 Session 不进 Git。

## 使用范围

此次授权仅覆盖本平台已有运行白名单素材随 `fufankeji/FF-FDE-Delivery-Workbench` 和学员源码包交付，不包含原 ZIP 的教师材料与个人数据，也不等于对所有内容重新授予开源许可。两个集成包保持 `private: true`、`UNLICENSED`，第三方声明与字体许可原样保留。原始交付 ZIP、训练数据库、会话与凭据仍不上传。
