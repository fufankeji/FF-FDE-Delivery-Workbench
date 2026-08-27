#!/usr/bin/env python3
"""DS4-AI 验证驱动（评估方案已由 FDE 确认；仅执行当前环境具备的真实检查）。

驱动运行中的候选系统（HTTP API），对合同允许的指标收集真实证据，写入 JSON。
依赖：项目 venv 中的 requests。证据路径：.fde/evaluations/reports/run-2026-08-27-valid/
"""
from __future__ import annotations

import json
import sys
import urllib3
import requests

# 关闭 https 告警不影响本地 http
urllib3.disable_warnings()

BASE = "http://127.0.0.1:8000/api"
EVID = ".fde/evaluations/reports/run-2026-08-27-valid"
SAMPLE = "fde-resources/05-脱敏订单数据样例.csv"

out: dict[str, object] = {"base": BASE, "step_results": []}


def rec(step: str, ok: bool, detail: object) -> None:
    out["step_results"].append({"step": step, "ok": ok, "detail": detail})
    print(f"[{'OK' if ok else 'FAIL'}] {step}: {json.dumps(detail, ensure_ascii=False)[:400]}")


def main() -> int:
    s = requests.Session()

    # 0) 环境健康与系统概览
    try:
        r = s.get(f"{BASE}/health", timeout=15)
        rec("health", r.status_code == 200, {"status_code": r.status_code, "json": r.json()})
    except Exception as exc:  # noqa: BLE001
        rec("health", False, {"error": str(exc)})
        _save()
        return 1

    # 1) 创建项目
    title = "验证旅程-脱敏样例"
    r = s.post(f"{BASE}/projects", json={"title": title}, timeout=30)
    if r.status_code != 200:
        rec("create_project", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    project = r.json()
    pid = project["id"]
    rec("create_project", True, {"id": pid, "title": project["title"], "created_at": project["created_at"]})

    # 2) 上传 CSV 为数据源
    with open(SAMPLE, "rb") as fh:
        r = s.post(
            f"{BASE}/projects/{pid}/sources/file",
            data={"source_type": "csv"},
            files={"upload": ("sample.csv", fh, "text/csv")},
            timeout=60,
        )
    if r.status_code != 200:
        rec("attach_csv", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    src = r.json()
    sid = src["id"]
    rec("attach_csv", True, {"source_id": sid, "type": src["type"], "status": src["status"],
                             "rows": src.get("baseline", {}).get("rows"),
                             "fingerprint": src.get("fingerprint", "")[:16]})

    # 3) 只读查询（data 视图）→ 数据产物
    sql = "SELECT channel, quantity, unit_price, paid_amount, order_status FROM data"
    r = s.post(f"{BASE}/projects/{pid}/query", json={"source_id": sid, "sql": sql, "name": "验证查询-样例"}, timeout=60)
    if r.status_code != 200:
        rec("query_select", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    qart = r.json()
    qid = qart["id"]
    rec("query_select", True, {"artifact_id": qid, "type": qart["type"], "cols": qart.get("metadata", {}).get("columns"),
                               "sha256": qart.get("sha256", "")[:16], "lineage": qart.get("lineage")})

    # 4) 质量画像
    r = s.post(f"{BASE}/projects/{pid}/analysis/profile", json={"artifact_id": qid, "name": "质量画像-样例"}, timeout=60)
    if r.status_code != 200:
        rec("profile", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    part = r.json()
    rec("profile", True, {"artifact_id": part["id"], "type": part["type"],
                          "metadata_keys": list(part.get("metadata", {}).keys())})

    # 5) 图表（bar x=channel y=paid_amount）
    r = s.post(f"{BASE}/projects/{pid}/charts", json={"artifact_id": qid, "chart_type": "bar", "x": "channel",
                                                      "y": ["paid_amount"], "title": "各渠道支付金额"}, timeout=60)
    if r.status_code != 200:
        rec("chart", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    cart = r.json()
    rec("chart", True, {"artifact_id": cart["id"], "type": cart["type"], "metadata": cart.get("metadata")})

    # 6) 模型实验（聚类，特征=数值列）
    r = s.post(f"{BASE}/projects/{pid}/models", json={"artifact_id": qid, "task": "clustering",
                                                      "features": ["quantity", "unit_price", "paid_amount"],
                                                      "algorithm": "kmeans", "name": "验证-聚类样例",
                                                      "random_state": 42, "tune": False}, timeout=120)
    if r.status_code != 200:
        rec("model_run", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    model_res = r.json()
    rec("model_run", True, {"result_keys": list(model_res.keys()),
                            "model_id": model_res.get("model", {}).get("id"),
                            "metrics_id": model_res.get("metrics", {}).get("id"),
                            "predictions_id": model_res.get("predictions", {}).get("id")})

    # 7) 报告 v1 创建（引用图表产物）
    r = s.post(f"{BASE}/projects/{pid}/reports", json={"title": "验证报告", "summary": "验证旅程报告",
                                                       "business_question": "各渠道支付金额结构如何？",
                                                       "artifact_ids": [cart["id"], qid]}, timeout=60)
    if r.status_code != 200:
        rec("report_v1", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    rep1 = r.json()
    rkey = rep1["report_key"]
    rec("report_v1", True, {"report_key": rkey, "version": rep1["version"]})

    # 8) 报告 v2（修订）
    r = s.post(f"{BASE}/projects/{pid}/reports/{rkey}/revisions",
               json={"markdown": "# 验证报告 v2\n\n修订后的内容。", "note": "修订为 v2"}, timeout=60)
    if r.status_code != 200:
        rec("report_v2", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    rep2 = r.json()
    rec("report_v2", True, {"version": rep2["version"], "based_on": rep2.get("based_on_version")})

    # 9) 报告 v3（从 v1 恢复）
    r = s.post(f"{BASE}/projects/{pid}/reports/{rkey}/restore/1", timeout=60)
    if r.status_code != 200:
        rec("report_v3_restore", False, {"status_code": r.status_code, "detail": r.text[:400]})
        _save()
        return 1
    rep3 = r.json()
    rec("report_v3_restore", True, {"version": rep3["version"], "based_on": rep3.get("based_on_version")})

    # 10) 版本列表（验证不覆盖历史）
    r = s.get(f"{BASE}/projects/{pid}/reports/{rkey}", timeout=30)
    versions = []
    if r.status_code == 200:
        versions = [v["version"] for v in r.json()]
    rec("report_versions", r.status_code == 200, {"versions": versions})

    # 11) 生成 HTML（v2）
    r = s.post(f"{BASE}/projects/{pid}/reports/{rkey}/html/2", timeout=60)
    html_ok = r.status_code == 200
    rec("report_html", html_ok, {"status_code": r.status_code, "detail": (r.json() if html_ok else r.text[:300])})

    # 12) 导出项目 zip（备份）
    r = s.get(f"{BASE}/projects/{pid}/export", timeout=120)
    export_path = None
    if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/zip"):
        export_path = f"{EVID}/northlight-{pid}.zip"
        open(export_path, "wb").write(r.content)
        rec("export_zip", True, {"path": export_path, "bytes": len(r.content), "filename": r.headers.get("content-disposition")})
    else:
        rec("export_zip", False, {"status_code": r.status_code, "detail": r.text[:300] if r.status_code != 200 else r.headers.get("content-type")})

    # 13) 只读安全边界：合法与越界 SQL
    readonly_cases = {
        "legit_select": ("SELECT channel, SUM(paid_amount) AS gmv FROM data GROUP BY channel", 200),
        "delete_dml": ("DELETE FROM data", "reject"),
        "multi_statement": ("SELECT 1; DELETE FROM data", "reject"),
        "host_file_function": ("SELECT * FROM read_text('/etc/hosts')", "reject"),
        "unregistered_table": ("SELECT * FROM secret_tbl", "reject"),
    }
    readonly = {}
    for name, (sqlv, expect) in readonly_cases.items():
        resp = s.post(f"{BASE}/projects/{pid}/query", json={"source_id": sid, "sql": sqlv, "name": name}, timeout=30)
        ok = (resp.status_code == 200) if expect == 200 else (resp.status_code >= 400)
        readonly[name] = {"status_code": resp.status_code, "ok": ok, "detail": (resp.json().get("detail") or resp.text[:200])}
        rec(f"readonly_{name}", ok, {"status_code": resp.status_code, "detail": readonly[name]["detail"]})

    # 14) 离线确定性能力：无模型凭证下 chat 走本地回退（不伪造结论）
    r = s.post(f"{BASE}/projects/{pid}/chat", json={"message": "汇总各渠道支付金额", "source_ids": [sid]}, timeout=30)
    chat_offline = {"status_code": r.status_code, "intent": None, "runtime_note": ""}
    if r.status_code == 200:
        j = r.json()
        chat_offline.update({"intent": j.get("intent"), "artifacts": j.get("artifacts"), "tool_calls": j.get("tool_calls"),
                             "content_excerpt": j.get("content", "")[:200]})
    rec("offline_chat_local_fallback", r.status_code == 200, chat_offline)

    # 15) 系统概览（状态）
    r = s.get(f"{BASE}/system/overview", timeout=30)
    if r.status_code == 200:
        ov = r.json()
        rec("system_overview", True, {"model": ov.get("model"), "project_count": ov.get("project_count"),
                                      "data_asset_count": ov.get("data_asset_count")})

    out["project_id"] = pid
    out["source_id"] = sid
    out["query_artifact_id"] = qid
    out["report_key"] = rkey
    out["export_path"] = export_path
    _save()
    return 0


def _save() -> None:
    with open(f"{EVID}/validation-run.json", "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    print("\nSaved:", f"{EVID}/validation-run.json")


if __name__ == "__main__":
    sys.exit(main())
