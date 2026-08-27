from __future__ import annotations

import base64
import hashlib
import json
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markdown_it import MarkdownIt

from northlight.models import Artifact, ReportVersion
from northlight.repository import Repository
from northlight.workspace import project_root


def render_report_markdown(markdown: str) -> str:
    renderer = MarkdownIt("commonmark", {"html": False}).enable("table")

    def table_open(*_: object) -> str:
        return (
            '<div class="report-table-frame">'
            '<div class="report-table-hint">横向滚动查看全部字段</div>'
            '<div class="report-table-scroll" role="region" aria-label="报告数据表"><table>\n'
        )

    def table_close(*_: object) -> str:
        return "</table></div></div>\n"

    rules = cast(Any, renderer.renderer).rules
    rules["table_open"] = table_open
    rules["table_close"] = table_close
    return cast(str, renderer.render(markdown))


class ReportService:
    def __init__(self, repository: Repository):
        self.repository = repository
        template_root = Path(__file__).resolve().parent / "templates"
        self.environment = Environment(
            loader=FileSystemLoader(template_root),
            autoescape=select_autoescape(["html"]),
        )

    def create(
        self,
        project_id: str,
        title: str,
        summary: str | None,
        artifact_ids: list[str],
        trigger_message_id: str | None = None,
        run_id: str | None = None,
        restrict_to_run: bool = False,
        business_question: str | None = None,
    ) -> ReportVersion:
        if run_id and restrict_to_run:
            run = self.repository.get_run(project_id, run_id)
            if set(artifact_ids) - set(run.artifact_ids):
                raise ValueError("Run report may only consume artifacts produced by that run")
        report_key = str(uuid4())
        audit = self.evidence_audit(project_id, artifact_ids)
        markdown = self._default_markdown(
            project_id, title, summary, artifact_ids, audit, business_question
        )
        skill_path = (
            Path(__file__).resolve().parent / "skills" / "complete-analysis-report" / "SKILL.md"
        )
        skill_hash = hashlib.sha256(skill_path.read_bytes()).hexdigest()
        return self._save_version(
            project_id,
            report_key,
            title,
            markdown,
            artifact_ids,
            "Initial report",
            None,
            {
                "generator_skill": "complete-analysis-report",
                "generator_skill_version": "1.1.0",
                "generator_skill_sha256": skill_hash,
                "trigger_message_id": trigger_message_id,
                "evidence_audit": audit,
            },
            run_id,
        )

    def revise(
        self,
        project_id: str,
        report_key: str,
        markdown: str,
        note: str,
        based_on_version: int | None = None,
    ) -> ReportVersion:
        versions = self.repository.list_report_versions(project_id, report_key)
        if not versions:
            raise KeyError(f"Report not found: {report_key}")
        latest = versions[0]
        return self._save_version(
            project_id,
            report_key,
            latest.title,
            markdown,
            latest.artifact_ids,
            note,
            based_on_version,
            None,
            latest.run_id,
        )

    def restore(self, project_id: str, report_key: str, version: int) -> ReportVersion:
        source = self.repository.get_report_version(project_id, report_key, version)
        markdown = (project_root(project_id) / source.markdown_path).read_text(encoding="utf-8")
        return self._save_version(
            project_id,
            report_key,
            source.title,
            markdown,
            source.artifact_ids,
            f"Restored from version {version}",
            version,
            None,
            source.run_id,
        )

    def render_html(self, project_id: str, report_key: str, version: int) -> Path:
        report = self.repository.get_report_version(project_id, report_key, version)
        root = project_root(project_id)
        markdown = (root / report.markdown_path).read_text(encoding="utf-8")
        body = render_report_markdown(markdown)
        mountain_path = (
            Path(__file__).resolve().parents[2] / "design" / "assets" / "mountain-report.png"
        )
        mountain_data = ""
        if mountain_path.is_file():
            mountain_data = base64.b64encode(mountain_path.read_bytes()).decode()
        echarts_path = (
            Path(__file__).resolve().parents[2]
            / "frontend"
            / "node_modules"
            / "echarts"
            / "dist"
            / "echarts.min.js"
        )
        echarts_js = echarts_path.read_text(encoding="utf-8") if echarts_path.is_file() else ""
        charts = build_interactive_charts(self.repository, project_id, report.artifact_ids)
        template = self.environment.get_template("report.html.j2")
        rendered = template.render(
            title=report.title,
            version=report.version,
            body=body,
            mountain_data=mountain_data,
            charts=charts,
            chart_options={chart["element_id"]: chart["option"] for chart in charts},
            echarts_js=echarts_js,
        )
        output = root / "reports" / "html" / f"{report_key}-v{version}.html"
        output.write_text(rendered, encoding="utf-8")
        report.html_path = str(output.relative_to(root))
        self.repository.session.commit()
        artifact = self.repository.add_artifact(
            project_id,
            "html",
            f"{report.title} · HTML v{version}",
            output,
            {
                "report_key": report_key,
                "version": version,
                "template": "northlight-v1",
                "interactive_charts": len(charts),
                "self_contained": bool(echarts_js),
                "run_id": report.run_id,
            },
            report.artifact_ids,
        )
        if report.run_id:
            self.repository.attach_run_artifacts(project_id, report.run_id, [artifact.id])
        return output

    def _save_version(
        self,
        project_id: str,
        report_key: str,
        title: str,
        markdown: str,
        artifact_ids: list[str],
        note: str,
        based_on_version: int | None,
        artifact_metadata: dict[str, object] | None = None,
        run_id: str | None = None,
    ) -> ReportVersion:
        version = self.repository.next_report_version(project_id, report_key)
        root = project_root(project_id)
        output = root / "reports" / "versions" / f"{report_key}-v{version}.md"
        output.write_text(markdown.rstrip() + "\n", encoding="utf-8")
        report = self.repository.add_report_version(
            project_id,
            report_key,
            version,
            title,
            str(output.relative_to(root)),
            artifact_ids,
            note,
            based_on_version,
            run_id,
        )
        artifact = self.repository.add_artifact(
            project_id,
            "report",
            f"{title} · v{version}",
            output,
            {
                "report_key": report_key,
                "version": version,
                "note": note,
                "run_id": run_id,
                **(artifact_metadata or {}),
            },
            artifact_ids,
        )
        if run_id:
            self.repository.attach_run_artifacts(project_id, run_id, [artifact.id])
        return report

    def evidence_audit(self, project_id: str, artifact_ids: list[str]) -> dict[str, object]:
        sources = self.repository.list_sources(project_id)
        artifacts = [self.repository.get_artifact(project_id, item) for item in artifact_ids]
        types = {artifact.type for artifact in artifacts}
        dimensions = sorted(
            {
                str(artifact.artifact_metadata["analysis_dimension"])
                for artifact in artifacts
                if artifact.artifact_metadata.get("analysis_dimension")
            }
        )
        model_algorithms = sorted(
            {
                str(artifact.artifact_metadata["algorithm"])
                for artifact in artifacts
                if artifact.type == "model" and artifact.artifact_metadata.get("algorithm")
            }
        )
        tabular_count = sum(
            artifact.type in {"extract", "derived"} for artifact in artifacts
        )
        quality_count = sum(
            artifact.type in {"profile", "analysis"} for artifact in artifacts
        )
        visual_count = sum(artifact.type == "visual" for artifact in artifacts)
        model_count = sum(artifact.type == "model" for artifact in artifacts)
        prediction_count = sum(artifact.type == "predictions" for artifact in artifacts)
        aggregate_count = sum(
            artifact.artifact_metadata.get("query_shape") == "aggregate"
            or artifact.artifact_metadata.get("analysis_kind") in {"aggregate", "comparison"}
            for artifact in artifacts
        )
        coverage = {
            "sources": len(sources),
            "tabular_results": tabular_count,
            "quality_profiles": quality_count,
            "visuals": visual_count,
            "models": model_count,
            "predictions": prediction_count,
            "aggregate_results": aggregate_count,
            "analysis_dimensions": dimensions,
            "model_algorithms": model_algorithms,
        }
        blockers = []
        gaps = []
        if not sources:
            blockers.append("没有登记数据源")
        if not ({"extract", "derived"} & types):
            blockers.append("没有可引用的数据查询或衍生数据产物")
        if tabular_count < 3:
            gaps.append("可引用的数据结果少于 3 个，无法覆盖总体、结构与细分分析")
        if aggregate_count < 3:
            gaps.append("有明确聚合口径的分析结果少于 3 个，不能生成可靠业务洞察")
        if len(dimensions) < 4:
            gaps.append("已登记业务分析维度少于 4 个，完整报告仍缺多维覆盖")
        if visual_count < 2:
            gaps.append("登记图表少于 2 个，HTML 的图文证据密度不足")
        if "profile" not in types and "analysis" not in types:
            gaps.append("没有独立数据质量分析产物，只能引用接入基线")
        if "model" in types and len(model_algorithms) < 2:
            gaps.append("只有一个模型实验，无法形成公平的候选/融合比较")
        if "model" in types and "predictions" not in types:
            gaps.append("已有模型但没有预测产物，模型闭环不完整")
        return {
            "status": "ready" if not blockers and not gaps else "evidence_gaps",
            "coverage": coverage,
            "blockers": blockers,
            "gaps": gaps,
        }

    def _default_markdown(
        self,
        project_id: str,
        title: str,
        summary: str | None,
        artifact_ids: list[str],
        audit: dict[str, object],
        business_question: str | None = None,
    ) -> str:
        sources = self.repository.list_sources(project_id)
        artifacts = [self.repository.get_artifact(project_id, item) for item in artifact_ids]
        findings = derive_findings(artifacts)
        evidence_tables = render_evidence_tables(project_id, artifacts)
        quality_summary = render_quality_summary(artifacts)
        model_summary = render_model_summary(artifacts)
        visual_summary = render_visual_summary(artifacts)
        action_summary = render_action_summary(artifacts)
        question = business_question or next(
            (
                str(item.artifact_metadata["business_question"])
                for item in artifacts
                if item.artifact_metadata.get("business_question")
            ),
            "当前业务表现如何，哪些因素值得优先干预，模型能否支持下一步决策？",
        )
        raw_blockers = audit.get("blockers", [])
        raw_gaps = audit.get("gaps", [])
        issues = [
            str(item)
            for item in [
                *(raw_blockers if isinstance(raw_blockers, list) else []),
                *(raw_gaps if isinstance(raw_gaps, list) else []),
            ]
        ]
        source_lines = []
        for source in sources:
            baseline = source.baseline
            size = baseline.get("rows") or baseline.get("table_count") or baseline.get("sheet_count")
            source_lines.append(f"- **{source.name}**（{source.type}）：{size or '规模见数据资产'}。")
        artifact_lines = [
            f"- `{item.id}` · {item.name}（{item.type}）· `{item.sha256[:12]}`"
            for item in artifacts
        ]
        executive = summary or build_executive_summary(artifacts)
        readiness = "证据覆盖已达到完整报告基线。" if not issues else "待补证：" + "；".join(issues)
        return f"""# {title}

> **核心问题**：{question}

## 一页结论

{executive}

{render_kpi_snapshot(artifacts) or "当前证据尚不足以形成可靠的经营指标快照。"}

### 建议先做的三件事

{action_summary or "1. 先补齐关键维度的聚合结果；2. 明确业务口径；3. 再进入模型验证。"}

## 分析范围与口径

本报告只使用当前项目中已经真实生成的查询、画像、图表、模型与预测产物。观察性数据可以支持
结构判断和预测，不把相关性直接写成因果性。{readiness}

### 数据基础

{chr(10).join(source_lines) if source_lines else "- 当前项目尚未登记数据源。"}

## 数据质量：哪些结论可以放心使用

先核对缺失、重复、字段类型、异常值、时间字段与表关系；所有聚合均以已保存的数据片段为边界。

{quality_summary or "当前版本没有独立质量画像，涉及缺失与异常值的结论需要谨慎解释。"}

## 经营表现：趋势、结构与差异

下面的数据表来自真实查询结果。报告 HTML 与 Canvas 中的交互图表使用同一份数据，切换视图不会改变分析口径。

{evidence_tables or "当前版本未引用带预览的数据产物，不能生成可信的描述性数字。"}

### 可交互图表

{visual_summary or "- 当前版本没有显式引用图表产物。"}

## 关键洞察：发生了什么，意味着什么

{findings or "当前引用产物不足以形成承重业务结论；应先补做分组、趋势或模型分析。"}

这些结果描述“发生了什么”。形成机制仍需通过地区、品类、客户和时间段反例，以及业务实验进一步验证。

## 模型：能预测什么，不能替你决定什么

{render_model_comparison(artifacts) or "当前版本没有模型产物，因此不对预测能力作出结论。"}

{model_summary}

## 行动路线图

{action_summary or "- **P0**：先补齐承重分析，并给每项行动绑定观察指标。"}

## 风险与下一步验证

- 观察性数据支持关联和预测，不自动支持因果结论；
- 训练分数不等于线上效果，需要时间外或新数据验证；
- 数据源变化、字段漂移或口径改变时，应建立新基线并重跑关键分析；
- 先对优先动作设计业务实验，再用收入、成本、效率、风险或体验指标评估真实影响。

## 技术附录：证据与复现

这部分服务审计与复现，不参与正文阅读。

{chr(10).join(artifact_lines) if artifact_lines else "- 当前版本尚未显式引用分析产物。"}

- 项目：`{project_id}` · 数据源：{len(sources)} · 引用产物：{len(artifacts)}
- Markdown 为版本真相源；HTML 从本版本固定模板生成。
- 图表与模型均可沿产物血缘回溯到数据片段；旧报告版本不会被覆盖。
"""


def markdown_value(value: object) -> str:
    if value is None:
        return "—"
    if isinstance(value, float):
        return f"{value:,.4g}"
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_executive_summary(artifacts: list[Artifact]) -> str:
    findings = derive_findings(artifacts).splitlines()
    if findings:
        clean = [line.split(". ", 1)[-1] for line in findings[:3]]
        return "本次分析最值得管理者关注的三条信号是：\n\n" + "\n".join(
            f"- {line}" for line in clean
        )
    return "当前产物尚不足以形成有数据支撑的执行摘要，应先补齐总体、趋势与分群分析。"


def render_kpi_snapshot(artifacts: list[Artifact]) -> str:
    for artifact in artifacts:
        preview = artifact.artifact_metadata.get("preview")
        columns = artifact.artifact_metadata.get("columns")
        if not isinstance(preview, list) or len(preview) != 1 or not isinstance(columns, list):
            continue
        row = preview[0]
        if not isinstance(row, dict):
            continue
        numeric = [(str(column), row.get(column)) for column in columns if isinstance(row.get(column), (int, float))]
        if len(numeric) < 2:
            continue
        header = "| " + " | ".join(label for label, _ in numeric[:6]) + " |"
        divider = "| " + " | ".join("---:" for _ in numeric[:6]) + " |"
        values = "| " + " | ".join(markdown_value(value) for _, value in numeric[:6]) + " |"
        return "### 核心指标快照\n\n" + "\n".join([header, divider, values])
    return ""


def render_model_comparison(artifacts: list[Artifact]) -> str:
    rows: list[str] = []
    metric_names: set[str] = set()
    model_rows: list[tuple[Artifact, dict[str, object]]] = []
    for artifact in artifacts:
        metrics = artifact.artifact_metadata.get("metrics")
        if artifact.type != "model" or not isinstance(metrics, dict):
            continue
        scalars: dict[str, object] = {
            str(key): value for key, value in metrics.items() if isinstance(value, (int, float))
        }
        if scalars:
            metric_names.update(scalars)
            model_rows.append((artifact, scalars))
    if not model_rows:
        return ""
    preferred: list[str] = [
        name
        for name in ("accuracy", "f1", "roc_auc", "r2", "mae", "rmse", "silhouette")
        if name in metric_names
    ]
    shown = (preferred or sorted(metric_names))[:4]
    rows.append("| 模型 | 算法 | " + " | ".join(shown) + " |")
    rows.append("| --- | --- | " + " | ".join("---:" for _ in shown) + " |")
    for artifact, metrics in model_rows:
        rows.append(
            "| " + artifact.name + " | " + str(artifact.artifact_metadata.get("algorithm", "—"))
            + " | " + " | ".join(markdown_value(metrics.get(name)) for name in shown) + " |"
        )
    return "\n".join(rows)


def render_evidence_tables(project_id: str, artifacts: list[Artifact]) -> str:
    sections: list[str] = []
    for artifact in artifacts:
        metadata = artifact.artifact_metadata
        preview = metadata.get("preview")
        columns = metadata.get("columns")
        if not isinstance(preview, list) or not preview or not isinstance(columns, list):
            continue
        shown_columns = [str(column) for column in columns[:8]]
        rows = [row for row in preview[:10] if isinstance(row, dict)]
        if not rows:
            continue
        header = "| " + " | ".join(shown_columns) + " |"
        divider = "| " + " | ".join("---" for _ in shown_columns) + " |"
        body = [
            "| " + " | ".join(markdown_value(row.get(column)) for column in shown_columns) + " |"
            for row in rows
        ]
        total_rows = metadata.get("rows", "未知")
        row_scope = f"全部 {len(rows)} 行" if isinstance(total_rows, int) and total_rows <= len(rows) else f"前 {len(rows)} 行"
        column_scope = f"全部 {len(shown_columns)} 列" if len(shown_columns) == len(columns) else f"前 {len(shown_columns)} 列"
        sections.append(
            f"### {artifact.name}\n\n"
            f"> 完整数据产物：{total_rows} 行 × {len(columns)} 列；报告摘要展示{row_scope} × {column_scope}。"
            f" [下载完整数据](/api/projects/{project_id}/artifacts/{artifact.id}/download)\n\n"
            + "\n".join([header, divider, *body])
        )
    return "\n\n".join(sections)


def derive_findings(artifacts: list[Artifact]) -> str:
    grouped: dict[str, list[Artifact]] = {}
    for artifact in artifacts:
        metadata = artifact.artifact_metadata
        if not (
            metadata.get("query_shape") == "aggregate"
            or metadata.get("analysis_kind") in {"aggregate", "comparison"}
        ):
            continue
        preview = artifact.artifact_metadata.get("preview")
        columns = artifact.artifact_metadata.get("columns")
        if not isinstance(preview, list) or not preview or not isinstance(columns, list):
            continue
        signature = json.dumps(
            {"columns": columns, "preview": preview}, ensure_ascii=False, sort_keys=True
        )
        grouped.setdefault(signature, []).append(artifact)

    findings: list[str] = []
    for matching in grouped.values():
        artifact = matching[0]
        preview = artifact.artifact_metadata["preview"]
        columns = artifact.artifact_metadata["columns"]
        assert isinstance(preview, list) and isinstance(columns, list)
        numeric = [
            column
            for column in columns
            if any(
                isinstance(row, dict) and isinstance(row.get(column), (int, float))
                for row in preview
            )
        ]
        configured_label = artifact.artifact_metadata.get("finding_label")
        configured_metric = artifact.artifact_metadata.get("finding_metric")
        label = (
            configured_label
            if configured_label in columns
            else next((column for column in columns if column not in numeric), None)
        )
        metric = configured_metric if configured_metric in numeric else (numeric[-1] if numeric else None)
        if not isinstance(label, str) or not isinstance(metric, str):
            continue
        valid = [
            row
            for row in preview
            if isinstance(row, dict) and isinstance(row.get(metric), (int, float))
        ]
        if not valid:
            continue
        ranked = sorted(valid, key=lambda row: float(row[metric]), reverse=True)
        top = ranked[0]
        total = sum(float(row[metric]) for row in valid)
        share = float(top[metric]) / total if total else 0
        additive = bool(
            artifact.artifact_metadata.get(
                "metric_additive",
                not metric.lower().startswith(("avg", "mean", "median", "rate", "ratio", "pct")),
            )
        )
        share_text = f"，占该结果合计的 {share:.1%}" if additive else ""
        comparison = ""
        if len(ranked) > 1 and float(ranked[1][metric]) != 0:
            ratio = float(top[metric]) / float(ranked[1][metric])
            comparison = f"，约为第二位的 {ratio:.2f} 倍"
        source_note = f"（{len(matching)} 个独立来源结果完全一致）" if len(matching) > 1 else ""
        findings.append(
            f"{len(findings) + 1}. **{artifact.name} 的首位是 {markdown_value(top.get(label))}。** "
            f"登记聚合结果中 `{metric}` 为 {markdown_value(top.get(metric))}{share_text}"
            f"{comparison}{source_note}。该结果说明结构差异，但不单独"
            "证明形成差异的原因。"
        )
        if len(findings) >= 6:
            break
    return "\n".join(findings)


def compact_model_metrics(artifacts: list[Artifact]) -> list[dict[str, object]]:
    compact: list[dict[str, object]] = []
    retained_sequences = {"labels", "confusion_matrix", "cv_scores", "residual_quantiles"}
    for artifact in artifacts:
        if artifact.type != "model":
            continue
        raw = artifact.artifact_metadata.get("metrics")
        if not isinstance(raw, dict):
            continue
        metrics = {
            str(key): value
            for key, value in raw.items()
            if isinstance(value, (int, float)) or key in retained_sequences
        }
        compact.append(
            {
                "artifact_id": artifact.id,
                "name": artifact.name,
                "algorithm": artifact.artifact_metadata.get("algorithm"),
                "metrics": metrics,
            }
        )
    return compact


def render_quality_summary(artifacts: list[Artifact]) -> str:
    rows: list[str] = []
    for artifact in artifacts:
        if artifact.type not in {"profile", "analysis"}:
            continue
        metadata = artifact.artifact_metadata
        fields = metadata.get("fields", [])
        worst = []
        if isinstance(fields, list):
            worst = sorted(
                (
                    field
                    for field in fields
                    if isinstance(field, dict) and isinstance(field.get("null_rate"), (int, float))
                ),
                key=lambda field: float(field["null_rate"]),
                reverse=True,
            )[:3]
        risk = "、".join(
            f"{field.get('name')} 缺失 {float(field['null_rate']):.1%}" for field in worst
        ) or "未发现可量化字段缺失"
        rows.append(
            f"- **{artifact.name}**：{metadata.get('rows', '未知')} 行、"
            f"{metadata.get('columns', '未知')} 列、重复 {metadata.get('duplicate_rows', '未知')} 行、"
            f"缺失单元格 {metadata.get('missing_cells', '未知')}；{risk}。"
        )
    return "\n".join(rows)


def render_action_summary(artifacts: list[Artifact]) -> str:
    actions = {
        "fulfillment": ("监控非完成订单并拆分取消/不可用原因", "完成率、取消率"),
        "trend": ("按月份校准运营容量并复核异常波动", "月订单量、环比"),
        "region": ("优先复核高贡献地区的服务与履约差异", "地区订单、收入、时效"),
        "payment": ("评估支付方式集中度与高额分期风险", "支付金额、分期数"),
        "logistics": ("定位高时长地区并验证承运与线路假设", "交付天数、超时率"),
        "reviews": ("对低评分订单开展错误分析和定向干预", "低评分率、复购护栏"),
        "category": ("识别高贡献品类并同时检查利润与退货护栏", "品类订单、GMV"),
    }
    rows: list[str] = []
    seen: set[str] = set()
    for artifact in artifacts:
        dimension = str(artifact.artifact_metadata.get("analysis_dimension", ""))
        if dimension in seen or dimension not in actions:
            continue
        seen.add(dimension)
        action, metric = actions[dimension]
        rows.append(f"{len(rows) + 1}. **P{min(len(rows), 2)} · {action}** — 持续观察：{metric}。")
    return "\n".join(rows)


def render_model_summary(artifacts: list[Artifact]) -> str:
    lines: list[str] = []
    for artifact in artifacts:
        if artifact.type != "model":
            continue
        metadata = artifact.artifact_metadata
        metrics = metadata.get("metrics", {})
        if not isinstance(metrics, dict):
            continue
        scalar_metrics = {
            key: value for key, value in metrics.items() if isinstance(value, (int, float))
        }
        metric_line = "、".join(
            f"{key}={markdown_value(value)}" for key, value in scalar_metrics.items()
        )
        lines.append(
            f"- **{artifact.name}**：任务 `{metadata.get('task')}`，算法 `{metadata.get('algorithm')}`，"
            f"随机种子 `{metadata.get('random_state')}`；{metric_line or '未登记标量指标'}。"
            "指标只能比较候选模型，仍需时间外样本验证。"
        )
    return "\n".join(lines)


def render_visual_summary(artifacts: list[Artifact]) -> str:
    lines = []
    for artifact in artifacts:
        if artifact.type == "visual":
            metadata = artifact.artifact_metadata
            lines.append(
                f"- **{artifact.name}**：`{metadata.get('chart_type')}`，横轴 "
                f"`{metadata.get('x')}`，纵轴 `{metadata.get('y')}`。"
            )
    return "\n".join(lines)


def build_interactive_charts(
    repository: Repository, project_id: str, artifact_ids: list[str]
) -> list[dict[str, object]]:
    charts: list[dict[str, object]] = []
    for artifact_id in artifact_ids:
        artifact = repository.get_artifact(project_id, artifact_id)
        if artifact.type != "visual" or not artifact.lineage:
            continue
        source = repository.get_artifact(project_id, artifact.lineage[0])
        preview = source.artifact_metadata.get("preview")
        if not isinstance(preview, list) or not preview:
            continue
        metadata = artifact.artifact_metadata
        x = metadata.get("x")
        y = metadata.get("y")
        chart_type = str(metadata.get("chart_type", "bar"))
        if not isinstance(x, str) or not isinstance(y, list) or not y:
            continue
        rows = [row for row in preview if isinstance(row, dict)]
        if not rows:
            continue
        option = chart_option(artifact.name, chart_type, x, [str(item) for item in y], rows)
        charts.append(
            {
                "element_id": f"report-chart-{len(charts) + 1}",
                "title": artifact.name,
                "artifact_id": artifact.id,
                "source_id": source.id,
                "source_name": source.name,
                "option": option,
            }
        )
    return charts


def chart_option(
    title: str,
    chart_type: str,
    x: str,
    y: list[str],
    rows: list[dict[str, object]],
) -> dict[str, object]:
    palette = ["#b8652b", "#d19a55", "#6e8c78", "#7d6d96", "#426d7c", "#c48372"]
    base: dict[str, object] = {
        "backgroundColor": "transparent",
        "color": palette,
        "animationDuration": 700,
        "title": {"text": title, "left": 0, "textStyle": {"fontSize": 17, "color": "#25211d"}},
        "tooltip": {"trigger": "item" if chart_type == "pie" else "axis"},
        "legend": {"top": 32, "textStyle": {"color": "#6f675e"}},
        "grid": {"left": 52, "right": 28, "top": 76, "bottom": 48},
    }
    if chart_type == "pie":
        metric = y[0]
        base["series"] = [
            {
                "name": metric,
                "type": "pie",
                "radius": ["40%", "68%"],
                "data": [
                    {"name": markdown_value(row.get(x)), "value": row.get(metric)} for row in rows
                ],
                "label": {"color": "#554d46"},
            }
        ]
        return base

    rendered_type = "line" if chart_type == "area" else chart_type
    if rendered_type not in {"bar", "line", "scatter"}:
        rendered_type = "bar"
    base["xAxis"] = {
        "type": "category",
        "data": [markdown_value(row.get(x)) for row in rows],
        "axisLabel": {"color": "#6f675e", "rotate": 18 if len(rows) > 8 else 0},
        "axisLine": {"lineStyle": {"color": "#cdbdaa"}},
    }
    base["yAxis"] = {
        "type": "value",
        "axisLabel": {"color": "#6f675e"},
        "splitLine": {"lineStyle": {"color": "#e1d5c6"}},
    }
    series = []
    for metric in y:
        entry: dict[str, object] = {
            "name": metric,
            "type": rendered_type,
            "data": [row.get(metric) for row in rows],
            "smooth": rendered_type == "line",
        }
        if chart_type == "area":
            entry["areaStyle"] = {"opacity": 0.22}
        series.append(entry)
    base["series"] = series
    return base
