# DS4-AI 数据分析系统架构

> 状态：根据当前实现逆向形成的架构基线候选  
> 更新日期：2026-08-27

## 1. 系统边界

系统由本地 React Web、FastAPI API、SQLite 元数据、项目工作目录和可选外部模型/MySQL 组成。核心确定性能力在本机运行；在线模型和 MySQL 是用户显式配置的外部依赖。

```text
Browser / React 19 / Vite
        │ REST + SSE
        ▼
FastAPI / Northlight API
 ├─ Project & Repository services
 ├─ Data Asset / Source profiling
 ├─ DuckDB / SQLite / MySQL read-only query
 ├─ Analysis / scikit-learn model jobs
 ├─ Agent Runtime / LangChain / DeepAgents
 ├─ Skills / no-network Docker sandbox
 └─ Report versioning / HTML rendering
        │
        ├─ .runtime/northlight.db        元数据
        ├─ .runtime/projects/<id>/       项目文件与产物
        ├─ .runtime/agent-checkpoints*   Agent 检查点
        └─ .runtime/credentials*         本地受保护凭据
```

## 2. 前端

- `frontend/src/app/App.tsx` 定义首页、全局数据资产、项目对话/来源/探索/模型/产物/报告、Skills 和设置路由。
- React Query 管理服务端数据与失效刷新；React Router 管理项目级页面。
- ECharts/echarts-for-react 渲染交互图表；React Markdown 展示报告；TanStack Table 支持结果审阅。
- 页面不直接访问项目文件或数据库，所有项目身份、下载和执行通过 API 完成。

## 3. API 与应用服务

`backend/northlight/api.py` 暴露 `/api` 下的项目、数据资产、来源、查询、分析、模型、聊天、Run、报告、Skills 和系统接口。API 只做请求校验、项目寻址与响应映射；领域行为由以下服务承担：

- `Repository`：项目、Source、DataAsset、Artifact、Message、Run/Step、ReportVersion 和 Skill 关系的持久化。
- `DataAssetService` / `DataSourceService`：文件/数据库登记、画像、指纹、变化检测和项目绑定。
- `QueryService`：SQL AST 校验、只读范围、行数、超时和结果 Artifact。
- `AnalysisService`：画像、清洗、特征工程和 Derived Artifact。
- `MLService` / `model_job_manager`：同步建模逻辑、异步任务状态、取消、模型与预测产物。
- `AgentRuntime`：意图路由、受控工具装配、流式事件、Run/Step 和检查点。
- `SkillService`：内置/上传 Skill 的安装、版本、权限、项目启用和脚本沙箱。
- `ReportService`：证据审计、Markdown 不可变版本、恢复和 HTML 渲染。

## 4. 数据与文件

SQLAlchemy 模型保存在运行根的 SQLite 数据库。每个 Project 记录一个独立 workspace，Source 和 Artifact 同时携带 ProjectId。项目文件、查询结果、模型、预测、报告和导出物都必须位于受控项目路径。

全局 DataAsset 可以被多个项目复用，但 bind 会建立 `ProjectDataAsset` 并生成项目 Source；运行时仍以项目 Source 为查询和 Agent 边界。Artifact 使用 SHA-256、metadata 和 lineage 记录可复核关系。

## 5. 查询与分析安全

- SQLGlot 解析语句，拒绝写操作和多语句。
- 文件查询拒绝 DuckDB 主机文件读取函数越过已登记来源；MySQL 查询只允许已导入表。
- Query Service 应用结果上限，SQLite 查询可被超时中断。
- 上传、项目来源和预览有大小/行数限制；损坏来源以 failed 状态持久化，便于恢复。
- 清洗、特征、模型和报告始终创建新产物，不覆盖上游。

## 6. Agent 与 Skills

普通聊天与数据分析意图分离：普通对话不装载数据工具；数据意图创建持久 AnalysisRun 和 RunStep。在线 Agent 使用 LangChain/OpenAI 兼容模型、DeepAgents 与 SQLite Checkpointer；无模型时确定性能力和本地回退仍保留。

Skills 使用 Markdown 头部声明版本、适用范围和权限。上传归档经过路径与权限校验；项目启用后的权限不能超出声明。脚本型 Skill 通过固定 Docker 沙箱运行，禁用网络和宿主根写入。

## 7. 报告与证据

报告只接受当前项目已登记 ArtifactId。每次创建、修订或恢复都生成新的 Markdown 版本；HTML 是指定版本的派生交付物。Evidence Audit 记录缺口，交互图表的数据经安全 JSON 序列化后内联，避免脚本注入。

## 8. 运行与部署

- Python 3.12，uv 管理后端依赖；Node.js 22+、pnpm 管理前端。
- `scripts/start.sh` 启动 Uvicorn 与 Vite，默认端口 8000/5173；`stop.sh` 只停止本项目记录的进程。
- `.env` 提供非秘密默认配置，模型凭据由设置页写入权限为 600 的 `.runtime` 文件。
- CORS 接受 localhost 和私有局域网 Origin；模型连接写操作另要求同 Host Origin，不能据此推断完整多人鉴权已实现。

## 9. 验证边界

后端使用 Ruff、Mypy、Pytest；前端使用 Vitest、TypeScript/Vite build 和 Playwright。当前架构证据来自源码与现有测试文件，本轮逆向文档不把尚未重新执行的命令写成已通过；实际结果见研发基线。
