#!/usr/bin/env python3
"""Build the DS4 architecture manifest from exact source ranges."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

PROJECT_DIR = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT_DIR / "frontend" / "src" / "features" / "architecture" / "architecture-manifest.json"


FLOWS = [
    {
        "id": "data",
        "label": "数据接入",
        "description": "CSV、Excel、SQLite 或 MySQL 从画像、隔离复制到可查询数据底座。",
        "accent": "#71a9be",
    },
    {
        "id": "conversation",
        "label": "Agent 分析",
        "description": "自然语言进入意图识别，按最小工具面完成查询、分析与可视化。",
        "accent": "#e49a45",
    },
    {
        "id": "modeling",
        "label": "机器学习",
        "description": "结构化特征进入隔离训练进程，产出模型、指标、预测和复现代码。",
        "accent": "#8eaa78",
    },
    {
        "id": "reporting",
        "label": "报告证据链",
        "description": "Skills 约束报告方法，登记产物生成可版本化 Markdown 与自包含 HTML。",
        "accent": "#b889ae",
    },
]

GROUPS = [
    {"id": "experience", "label": "交互与接入层", "y": 36, "height": 188},
    {"id": "intelligence", "label": "Agent 智能编排层", "y": 244, "height": 238},
    {"id": "capability", "label": "分析能力层", "y": 502, "height": 306},
    {"id": "foundation", "label": "证据与存储底座", "y": 828, "height": 250},
]

NODE_SPECS: list[dict[str, Any]] = [
    {
        "id": "workbench",
        "title": "对话式分析工作台",
        "group": "experience",
        "summary": "把消息、实时工具状态、Run、结果和 Report Canvas 汇聚为同一条任务体验。",
        "input": "用户问题、已选数据源、项目上下文",
        "output": "SSE 请求、实时消息、结果卡片与报告 Canvas",
        "failure": "流式错误进入显式失败态；已登记的历史消息与产物仍可恢复。",
        "flows": ["data", "conversation", "modeling", "reporting"],
        "external": False,
        "path": "frontend/src/pages/ChatPage.tsx",
        "start": 43,
        "end": 78,
        "x": 112,
        "y": 76,
        "width": 252,
        "icon": "monitor",
    },
    {
        "id": "api-stream",
        "title": "FastAPI + SSE 网关",
        "group": "experience",
        "summary": "校验项目请求，将 Agent 事件逐类转成浏览器可消费的 Server-Sent Events。",
        "input": "项目 ID 与 ChatRequest",
        "output": "intent、plan、tool、token、message、done 事件",
        "failure": "领域异常被统一映射为明确 HTTP 或流式错误，不静默吞掉。",
        "flows": ["data", "conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/api.py",
        "start": 722,
        "end": 749,
        "x": 536,
        "y": 76,
        "width": 252,
        "icon": "radio",
    },
    {
        "id": "agent-runtime",
        "title": "任务意图与 Run 编排",
        "group": "intelligence",
        "summary": "区分普通对话和数据任务，创建可恢复 Run，并持续登记步骤、取消与最终状态。",
        "input": "消息、数据源选择、Skills 选择、可选重试 Run",
        "output": "意图、执行计划、AnalysisRun 与流式事件",
        "failure": "失败或取消写入 Run 与 agent_run 证据，已完成产物继续保留。",
        "flows": ["conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/agent_runtime.py",
        "start": 182,
        "end": 228,
        "x": 112,
        "y": 298,
        "width": 252,
        "icon": "brain",
    },
    {
        "id": "deepseek",
        "title": "DeepSeek-V4-Flash",
        "group": "intelligence",
        "summary": "兼容 OpenAI 协议的外部推理模型；只接收完成当前任务所需的最小上下文。",
        "input": "系统约束、当前问题、最小画像与工具描述",
        "output": "流式文本或结构化工具调用",
        "failure": "连接、鉴权或模型异常回到 Agent 失败语义；凭证永不进入页面和产物。",
        "flows": ["conversation", "modeling", "reporting"],
        "external": True,
        "path": "backend/northlight/agent_runtime.py",
        "start": 493,
        "end": 499,
        "x": 500,
        "y": 298,
        "width": 252,
        "icon": "sparkles",
    },
    {
        "id": "tool-router",
        "title": "意图最小工具路由",
        "group": "intelligence",
        "summary": "按意图开放查询、分析、建模、Skill 或报告工具，普通对话工具集为空。",
        "input": "已判定 Intent 与项目启用 Skills",
        "output": "受范围约束的 Deep Agents 工具集与 /skills 虚拟树",
        "failure": "未启用 Skill、跨项目数据源或越界工具请求被拒绝。",
        "flows": ["conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/agent_runtime.py",
        "start": 780,
        "end": 853,
        "x": 888,
        "y": 298,
        "width": 252,
        "icon": "network",
    },
    {
        "id": "skill-runtime",
        "title": "Skills 渐进披露与沙箱",
        "group": "intelligence",
        "summary": "按意图组装受限 Skill 文件树；脚本只从声明入口在无网络沙箱运行。",
        "input": "项目启用版本、权限清单、当前意图",
        "output": "虚拟 /skills 内容、Skill 运行记录与登记产物",
        "failure": "路径穿越、未声明入口、权限不一致和超时均显式拒绝。",
        "flows": ["conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/skill_service.py",
        "start": 406,
        "end": 473,
        "x": 1276,
        "y": 298,
        "width": 252,
        "icon": "library",
    },
    {
        "id": "source-service",
        "title": "多数据源接入与画像",
        "group": "capability",
        "summary": "校验格式、复制本地文件、建立初始画像和指纹，并隔离到当前项目。",
        "input": "CSV、Excel、SQLite 文件或 MySQL 只读连接",
        "output": "ready Source、字段画像、数据指纹",
        "failure": "格式、容量或画像失败会留下 failed 状态和错误类型。",
        "flows": ["data"],
        "external": False,
        "path": "backend/northlight/data_sources.py",
        "start": 211,
        "end": 275,
        "x": 36,
        "y": 580,
        "width": 240,
        "icon": "database",
    },
    {
        "id": "query-engine",
        "title": "只读查询引擎",
        "group": "capability",
        "summary": "用 SQL AST 限制只读语句和表范围，再对四类数据源执行限时、限行查询。",
        "input": "Source、SQL 与结果名称",
        "output": "查询 SQL、Parquet 数据片段、preview 与血缘",
        "failure": "写操作、越界表、源变化、超时与缺失连接均被拒绝。",
        "flows": ["conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/query_service.py",
        "start": 90,
        "end": 158,
        "x": 320,
        "y": 580,
        "width": 240,
        "icon": "search",
    },
    {
        "id": "analysis-engine",
        "title": "探索、清洗与特征工程",
        "group": "capability",
        "summary": "对登记数据片段计算质量画像，并以结构化配方产出清洗和特征工程结果。",
        "input": "项目内 CSV 或 Parquet Artifact",
        "output": "画像、衍生数据、配置和复现代码",
        "failure": "不支持的文件、缺失字段和非法特征定义会明确失败。",
        "flows": ["conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/analysis_service.py",
        "start": 30,
        "end": 80,
        "x": 604,
        "y": 580,
        "width": 240,
        "icon": "chart",
    },
    {
        "id": "model-jobs",
        "title": "异步训练进程管理",
        "group": "capability",
        "summary": "用 spawn 隔离训练，限制并发，并提供轮询、取消、超时和异常退出语义。",
        "input": "ModelRunRequest 与项目 Artifact",
        "output": "Job 状态和模型产物 ID",
        "failure": "并发超限、用户取消、超时或子进程异常均形成终态。",
        "flows": ["modeling"],
        "external": False,
        "path": "backend/northlight/model_jobs.py",
        "start": 71,
        "end": 116,
        "x": 888,
        "y": 580,
        "width": 240,
        "icon": "clock",
    },
    {
        "id": "ml-service",
        "title": "机器学习与模型融合",
        "group": "capability",
        "summary": "构建预处理 Pipeline，覆盖分类、回归、聚类、调参、交叉验证与融合算法。",
        "input": "特征、目标、算法、随机种子与登记数据",
        "output": "模型、指标、预测、评估数据和复现代码",
        "failure": "缺失字段、目标缺失、模型类型不兼容或训练失败会停止登记。",
        "flows": ["modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/ml_service.py",
        "start": 156,
        "end": 257,
        "x": 1172,
        "y": 580,
        "width": 240,
        "icon": "cpu",
    },
    {
        "id": "report-service",
        "title": "版本化分析报告",
        "group": "capability",
        "summary": "先审计证据覆盖，再以默认报告 Skill 生成不可变 Markdown 版本并支持 HTML。",
        "input": "Run 归属的表格、图表、模型、预测和说明产物",
        "output": "ReportVersion、Markdown Artifact 与自包含 HTML",
        "failure": "跨 Run 产物、证据不足或 HTML 渲染失败不会覆盖已有版本。",
        "flows": ["reporting"],
        "external": False,
        "path": "backend/northlight/report_service.py",
        "start": 26,
        "end": 63,
        "x": 1456,
        "y": 580,
        "width": 240,
        "icon": "report",
    },
    {
        "id": "external-data",
        "title": "本地与数据库数据",
        "group": "foundation",
        "summary": "用户明确选择的 CSV、Excel、SQLite 文件和 MySQL 指定表。",
        "input": "业务系统导出或只读数据库表",
        "output": "结构化行列、表结构与数据规模",
        "failure": "文件不可读、连接不可用或未纳管表不会进入分析工具面。",
        "flows": ["data", "conversation", "modeling"],
        "external": True,
        "source": None,
        "code": None,
        "x": 36,
        "y": 900,
        "width": 240,
        "icon": "files",
    },
    {
        "id": "repository",
        "title": "项目隔离仓储与血缘",
        "group": "foundation",
        "summary": "以 project_id 强制隔离实体，为每个 Artifact 保存相对路径、SHA-256 与 lineage。",
        "input": "项目实体、消息、Run、Artifact 与 ReportVersion",
        "output": "可查询元数据、稳定 ID、内容哈希和血缘关系",
        "failure": "跨项目 ID、越界路径和不存在的实体被拒绝。",
        "flows": ["data", "conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/repository.py",
        "start": 230,
        "end": 254,
        "x": 392,
        "y": 900,
        "width": 240,
        "icon": "git",
    },
    {
        "id": "metadata-store",
        "title": "SQLite 元数据存储",
        "group": "foundation",
        "summary": "持久化项目、消息、Run、步骤、数据源、Skills、报告版本与 Artifact 索引。",
        "input": "SQLAlchemy 领域实体与事务",
        "output": "northlight.sqlite3 与会话查询结果",
        "failure": "事务异常回滚；初始化只执行显式兼容迁移。",
        "flows": ["data", "conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/database.py",
        "start": 13,
        "end": 46,
        "x": 748,
        "y": 900,
        "width": 240,
        "icon": "storage",
    },
    {
        "id": "project-workspace",
        "title": "独立项目文件空间",
        "group": "foundation",
        "summary": "每个会话拥有 sources、datasets、queries、code、models、predictions、reports、skills 和 runs。",
        "input": "源文件与各服务生成的真实结果",
        "output": "可导出、可追溯、可版本化的项目目录",
        "failure": "项目 ID 必须是 UUID，任何解析后的路径必须留在 projects_root 内。",
        "flows": ["data", "conversation", "modeling", "reporting"],
        "external": False,
        "path": "backend/northlight/workspace.py",
        "start": 12,
        "end": 48,
        "x": 1104,
        "y": 900,
        "width": 264,
        "icon": "hard-drive",
    },
]

EDGES = [
    ("workbench-api", "workbench", "api-stream", "control", "发送问题 / 管理操作", ["data", "conversation", "modeling", "reporting"]),
    ("api-agent", "api-stream", "agent-runtime", "control", "进入 Agent Run", ["conversation", "modeling", "reporting"]),
    ("agent-model", "agent-runtime", "deepseek", "control", "最小上下文 + 工具描述", ["conversation", "modeling", "reporting"]),
    ("model-tools", "deepseek", "tool-router", "control", "结构化工具调用", ["conversation", "modeling", "reporting"]),
    ("tools-agent", "tool-router", "agent-runtime", "evidence", "工具事件与 Artifact ID", ["conversation", "modeling", "reporting"]),
    ("tools-query", "tool-router", "query-engine", "control", "只读 SQL", ["conversation", "modeling", "reporting"]),
    ("tools-analysis", "tool-router", "analysis-engine", "control", "画像 / 清洗 / 特征", ["conversation", "modeling", "reporting"]),
    ("tools-jobs", "tool-router", "model-jobs", "control", "启动、轮询或取消", ["modeling"]),
    ("jobs-ml", "model-jobs", "ml-service", "control", "隔离训练", ["modeling"]),
    ("tools-skills", "tool-router", "skill-runtime", "control", "渐进读取 / 沙箱执行", ["conversation", "modeling", "reporting"]),
    ("tools-report", "tool-router", "report-service", "control", "生成 / 修订 / 恢复", ["reporting"]),
    ("external-source", "external-data", "source-service", "data", "文件或只读表", ["data"]),
    ("source-query", "external-data", "query-engine", "data", "受白名单约束的数据", ["conversation", "modeling"]),
    ("source-repo", "source-service", "repository", "evidence", "Source + 指纹 + 画像", ["data"]),
    ("source-workspace", "source-service", "project-workspace", "storage", "隔离复制与画像快照", ["data"]),
    ("query-repo", "query-engine", "repository", "evidence", "SQL、预览与血缘", ["conversation", "modeling", "reporting"]),
    ("query-workspace", "query-engine", "project-workspace", "storage", "SQL + Parquet 数据片段", ["conversation", "modeling", "reporting"]),
    ("analysis-repo", "analysis-engine", "repository", "evidence", "配置、质量指标与血缘", ["conversation", "modeling", "reporting"]),
    ("analysis-workspace", "analysis-engine", "project-workspace", "storage", "衍生数据 + 复现代码", ["conversation", "modeling", "reporting"]),
    ("ml-repo", "ml-service", "repository", "evidence", "指标、模型与预测索引", ["modeling", "reporting"]),
    ("ml-workspace", "ml-service", "project-workspace", "storage", "模型、预测和复现代码", ["modeling", "reporting"]),
    ("skill-repo", "skill-runtime", "repository", "evidence", "版本、权限与运行记录", ["conversation", "modeling", "reporting"]),
    ("skill-workspace", "skill-runtime", "project-workspace", "storage", "Skill 输出产物", ["conversation", "modeling", "reporting"]),
    ("report-repo", "report-service", "repository", "evidence", "版本、证据审计与 lineage", ["reporting"]),
    ("report-workspace", "report-service", "project-workspace", "storage", "Markdown + HTML", ["reporting"]),
    ("repo-metadata", "repository", "metadata-store", "storage", "事务化领域元数据", ["data", "conversation", "modeling", "reporting"]),
    ("agent-response", "agent-runtime", "api-stream", "data", "token、状态与最终消息", ["conversation", "modeling", "reporting"]),
    ("api-response", "api-stream", "workbench", "data", "实时呈现与恢复", ["data", "conversation", "modeling", "reporting"]),
]


def source_payload(spec: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    if spec.get("source") is None and "path" not in spec:
        return None, None
    relative = Path(str(spec["path"]))
    path = PROJECT_DIR / relative
    lines = path.read_text(encoding="utf-8").splitlines()
    start = int(spec["start"])
    end = int(spec["end"])
    code = "\n".join(lines[start - 1 : end])
    return (
        {
            "path": relative.as_posix(),
            "start_line": start,
            "end_line": end,
            "sha256": hashlib.sha256(code.encode("utf-8")).hexdigest(),
            "language": "typescript" if relative.suffix == ".tsx" else "python",
        },
        code,
    )


def source_revision(paths: list[Path]) -> str:
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=PROJECT_DIR, check=True, capture_output=True, text=True
    ).stdout.strip()
    digest = hashlib.sha256()
    for path in sorted(set(paths)):
        digest.update(path.relative_to(PROJECT_DIR).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return f"git:{commit};read-set-sha256:{digest.hexdigest()}"


def main() -> None:
    nodes: list[dict[str, Any]] = []
    source_paths: list[Path] = []
    for raw in NODE_SPECS:
        spec = dict(raw)
        path_value = spec.pop("path", None)
        start_value = spec.pop("start", None)
        end_value = spec.pop("end", None)
        if path_value is not None:
            spec["path"], spec["start"], spec["end"] = path_value, start_value, end_value
            source, code = source_payload(spec)
            spec.pop("path")
            spec.pop("start")
            spec.pop("end")
            spec["source"] = source
            spec["code"] = code
            source_paths.append(PROJECT_DIR / str(path_value))
        nodes.append(spec)
    payload = {
        "schema_version": 1,
        "title": "DS4-AI数据分析系统 · 项目功能架构",
        "scope": "产品运行时：前端交互、后端 Agent 与分析服务、外部依赖、元数据及项目文件空间。",
        "source_revision": source_revision(source_paths),
        "canvas": {"width": 1744, "height": 1110},
        "groups": GROUPS,
        "flows": FLOWS,
        "nodes": nodes,
        "edges": [
            {
                "id": edge_id,
                "source": source,
                "target": target,
                "kind": kind,
                "label": label,
                "flows": flows,
            }
            for edge_id, source, target, kind, label, flows in EDGES
        ],
        "limitations": [
            "DeepSeek-V4-Flash 是外部服务，页面展示的是本地适配器与已验证调用边界，不展示供应商内部实现。",
            "本页只覆盖产品运行时；课程生产、CI、验收脚本和一次性数据准备脚本不在图中。",
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(OUTPUT)


if __name__ == "__main__":
    main()
