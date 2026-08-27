from types import SimpleNamespace

import pandas as pd
from northlight import agent_runtime
from northlight.agent_runtime import (
    AgentRuntime,
    artifact_summary,
    classify_intent,
    minimal_baseline,
)
from northlight.data_sources import DataSourceService
from northlight.domain import Intent, SourceType
from northlight.ml_service import MLService
from northlight.repository import Repository
from northlight.skill_service import SkillService
from northlight.workspace import project_root
from sqlalchemy.orm import Session


def test_normal_chat_never_calls_data_tools_without_model(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("Chat")
    response = AgentRuntime(repository).respond(
        project.id, "Explain the difference between mean and median"
    )
    assert response.intent == Intent.NORMAL
    assert response.tool_calls == []


def test_local_default_report_message_references_registered_report_artifact(
    session: Session,
) -> None:
    repository = Repository(session)
    project = repository.create_project("Local report")
    response = AgentRuntime(repository).respond(project.id, "生成一份数据分析报告")
    artifact_types = {
        repository.get_artifact(project.id, artifact_id).type for artifact_id in response.artifacts
    }
    assert artifact_types == {"report", "agent_run"}


def test_intent_router_covers_report_and_model() -> None:
    assert classify_intent("请生成一份完整数据分析报告") == Intent.REPORTING
    assert classify_intent("建立低评分风险分类模型") == Intent.MODELING
    assert classify_intent("帮我写一段关于数据素养的课程介绍") == Intent.NORMAL
    assert classify_intent("解释什么是回归分析，不要对当前数据建模") == Intent.NORMAL
    assert classify_intent("解释什么是置信区间，不要查询当前数据") == Intent.NORMAL
    assert classify_intent("查询这份数据集中各地区的订单数量") == Intent.DATA_QA
    assert classify_intent("按地区汇总销售额并生成交互柱状图") == Intent.VISUALIZATION


def test_runtime_registers_no_data_tools_for_normal_chat(monkeypatch, session: Session) -> None:
    captured: list[list[str]] = []

    class FakeAgent:
        def invoke(self, *_args, **_kwargs):
            return {"messages": [SimpleNamespace(content="ok", type="assistant")]}

    def fake_create_deep_agent(**kwargs):
        captured.append([tool.__name__ for tool in kwargs["tools"]])
        return FakeAgent()

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-only-not-a-real-secret")
    monkeypatch.setattr(agent_runtime, "ChatOpenAI", lambda **_kwargs: object())
    monkeypatch.setattr(agent_runtime, "create_deep_agent", fake_create_deep_agent)
    repository = Repository(session)
    project = repository.create_project("Policy")
    runtime = AgentRuntime(repository)
    runtime._deep_agent(project.id, "hello", Intent.NORMAL)
    runtime._deep_agent(project.id, "query the data", Intent.DATA_QA)
    runtime._deep_agent(project.id, "build a model", Intent.MODELING)
    runtime._deep_agent(project.id, "revise report", Intent.REPORTING)
    assert captured[0] == []
    assert "run_read_only_query" in captured[1]
    assert "train_model" not in captured[1]
    assert {"engineer_features", "train_model", "predict_model", "run_project_skill"} <= set(
        captured[2]
    )
    assert {
        "create_complete_report",
        "revise_report",
        "restore_report",
        "render_report_html",
    } <= set(captured[3])
    disclosures = list((project_root(project.id) / "runs").glob("*-model-disclosure.json"))
    assert len(disclosures) == 4


def test_online_agent_events_are_streamed_and_run_is_persisted(
    monkeypatch, session: Session
) -> None:
    class FakeAgent:
        def stream(self, *_args, **_kwargs):
            yield {
                "type": "updates",
                "data": {
                    "model": {
                        "messages": [
                            SimpleNamespace(
                                type="ai",
                                tool_calls=[
                                    {
                                        "name": "list_data_sources",
                                        "id": "call-1",
                                        "args": {},
                                    }
                                ],
                            )
                        ]
                    }
                },
            }
            yield {
                "type": "messages",
                "data": (SimpleNamespace(content="真实流式回答"), {}),
            }
            yield {
                "type": "updates",
                "data": {
                    "tools": {
                        "messages": [
                            SimpleNamespace(
                                type="tool",
                                name="list_data_sources",
                                tool_call_id="call-1",
                                status="success",
                            )
                        ]
                    }
                },
            }

        def get_state(self, _config):
            return SimpleNamespace(
                values={
                    "messages": [
                        SimpleNamespace(
                            content="source result", type="tool", name="list_data_sources"
                        ),
                        SimpleNamespace(content="真实流式回答", type="assistant"),
                    ]
                }
            )

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-only-not-a-real-secret")
    monkeypatch.setattr(agent_runtime, "ChatOpenAI", lambda **_kwargs: object())
    monkeypatch.setattr(agent_runtime, "create_deep_agent", lambda **_kwargs: FakeAgent())
    repository = Repository(session)
    project = repository.create_project("Streaming")

    events = list(AgentRuntime(repository).respond_events(project.id, "查询当前数据"))

    assert [event["type"] for event in events] == [
        "intent",
        "run_created",
        "plan_ready",
        "tool",
        "token",
        "tool",
        "run_completed",
        "message",
        "done",
    ]
    response = events[-2]["response"]
    assert response.content == "真实流式回答"
    assert response.tool_calls == ["list_data_sources"]
    run = repository.get_artifact(project.id, response.artifacts[-1])
    assert run.type == "agent_run"
    assert run.artifact_metadata["status"] == "succeeded"
    assert len(repository.list_messages(project.id)) == 2
    persisted = repository.list_runs(project.id)
    assert len(persisted) == 1
    assert persisted[0].status == "succeeded"
    assert persisted[0].steps[0].status == "succeeded"
    assert persisted[0].steps[0].tool_names == ["list_data_sources"]


def test_normal_conversation_does_not_create_analysis_run(
    monkeypatch, session: Session
) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    repository = Repository(session)
    project = repository.create_project("Normal conversation")

    events = list(AgentRuntime(repository).respond_events(project.id, "解释什么是回归分析"))

    assert events[0] == {"type": "intent", "intent": "normal"}
    assert not any(event["type"].startswith("run_") for event in events)
    assert repository.list_runs(project.id) == []


def test_retry_resumes_from_failed_step(monkeypatch, session: Session) -> None:
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    repository = Repository(session)
    project = repository.create_project("Retry from failure")
    trigger = repository.add_message(project.id, "user", "查询当前数据")
    prior = repository.create_run(
        project.id,
        trigger.id,
        "查询当前数据",
        "data_qa",
        [],
        [],
        [dict(item) for item in agent_runtime.RUN_PLANS[Intent.DATA_QA]],
        "local-fallback",
    )
    repository.update_run_step(project.id, prior.id, "inspect", "succeeded")
    repository.update_run_step(
        project.id, prior.id, "analyze", "failed", error="字段不存在"
    )
    repository.complete_run(project.id, prior.id, "failed", error="字段不存在")

    list(
        AgentRuntime(repository).respond_events(
            project.id, prior.title, retry_of_run_id=prior.id
        )
    )

    retried = repository.list_runs(project.id)[0]
    assert retried.retry_of_run_id == prior.id
    assert [step.key for step in retried.steps] == ["analyze", "present"]


def test_agent_model_training_honors_unified_run_cancellation(
    monkeypatch, session: Session
) -> None:
    repository = Repository(session)
    project = repository.create_project("Cancelled agent model")
    data_path = project_root(project.id) / "datasets" / "derived" / "train.parquet"
    pd.DataFrame({"feature": [1, 2, 3], "target": [0, 1, 0]}).to_parquet(data_path)
    artifact = repository.add_artifact(
        project.id,
        "derived",
        "Training data",
        data_path,
        {"rows": 3, "columns": ["feature", "target"]},
    )
    trigger = repository.add_message(project.id, "user", "训练分类模型")
    run = repository.create_run(
        project.id,
        trigger.id,
        "训练分类模型",
        "modeling",
        [],
        [],
        [dict(item) for item in agent_runtime.RUN_PLANS[Intent.MODELING]],
        "deep-agents",
    )
    repository.request_run_cancel(project.id, run.id)
    cancelled: list[str] = []

    class FakeAgent:
        def __init__(self, tools):
            self.tools = tools

        def invoke(self, *_args, **_kwargs):
            tool = next(item for item in self.tools if item.__name__ == "train_model")
            return tool(
                artifact.id,
                "classification",
                "random_forest",
                "target",
                ["feature"],
                "Cancelled model",
            )

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-only-not-a-real-secret")
    monkeypatch.setattr(agent_runtime, "ChatOpenAI", lambda **_kwargs: object())
    monkeypatch.setattr(
        agent_runtime, "create_deep_agent", lambda **kwargs: FakeAgent(kwargs["tools"])
    )
    monkeypatch.setattr(
        agent_runtime.model_job_manager,
        "start",
        lambda *_args, **_kwargs: {"id": "job-1", "status": "running"},
    )
    monkeypatch.setattr(
        agent_runtime.model_job_manager,
        "cancel",
        lambda _project_id, job_id: cancelled.append(job_id) or {"status": "cancelled"},
    )

    try:
        AgentRuntime(repository)._deep_agent(
            project.id,
            "训练分类模型",
            Intent.MODELING,
            current_run_id=run.id,
        )
    except agent_runtime.RunCancelled:
        pass
    else:
        raise AssertionError("cancelled unified Run did not stop its model worker")
    assert cancelled == ["job-1"]


def test_agent_query_tool_registers_created_artifact_on_assistant_message(
    monkeypatch, tmp_path, session: Session
) -> None:
    repository = Repository(session)
    project = repository.create_project("Agent artifact")
    csv_path = tmp_path / "orders.csv"
    csv_path.write_text("state,revenue\nSP,12\nRJ,7\n", encoding="utf-8")
    source = DataSourceService(repository).attach_file(project.id, SourceType.CSV, csv_path)

    captured_result: dict[str, object] = {}

    class FakeAgent:
        def __init__(self, tools):
            self.tools = tools

        def invoke(self, *_args, **_kwargs):
            query_tool = next(tool for tool in self.tools if tool.__name__ == "run_read_only_query")
            captured_result.update(
                query_tool(source.id, "SELECT * FROM data", "Agent extract")
            )
            return {"messages": [SimpleNamespace(content="查询完成", type="assistant")]}

    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-only-not-a-real-secret")
    monkeypatch.setattr(agent_runtime, "ChatOpenAI", lambda **_kwargs: object())
    monkeypatch.setattr(
        agent_runtime,
        "create_deep_agent",
        lambda **kwargs: FakeAgent(kwargs["tools"]),
    )
    content, _tool_calls, artifacts = AgentRuntime(repository)._deep_agent(
        project.id, "查询这份数据", Intent.DATA_QA
    )
    assert content == "查询完成"
    assert len(artifacts) == 1
    assert repository.get_artifact(project.id, artifacts[0]).type == "extract"
    assert captured_result["result_preview"] == [
        {"state": "SP", "revenue": 12},
        {"state": "RJ", "revenue": 7},
    ]
    assert captured_result["result_preview_scope"] == {
        "rows_returned": 2,
        "total_result_rows": 2,
        "truncated": False,
    }


def test_enabled_report_skill_is_scoped_into_native_agent_skill_files(
    monkeypatch, tmp_path, session: Session
) -> None:
    captured: dict[str, object] = {}

    class FakeAgent:
        def invoke(self, payload, **_kwargs):
            captured["payload"] = payload
            return {"messages": [SimpleNamespace(content="ok", type="assistant")]}

    def fake_create_deep_agent(**kwargs):
        captured["agent_kwargs"] = kwargs
        return FakeAgent()

    skill_root = tmp_path / "custom-report"
    skill_root.mkdir()
    (skill_root / "SKILL.md").write_text(
        "---\nname: custom-report\nversion: 1.0.0\n"
        "description: Add a cohort retention appendix.\napplies_to: [reporting]\n"
        "permissions:\n  files: project-read\n  database: read-only\n"
        "  network: none\n  code: structured-tools-only\n---\n"
        "# Custom report\n\nAlways add a cohort-retention appendix backed by registered artifacts.\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("DEEPSEEK_API_KEY", "test-only-not-a-real-secret")
    monkeypatch.setattr(agent_runtime, "ChatOpenAI", lambda **_kwargs: object())
    monkeypatch.setattr(agent_runtime, "create_deep_agent", fake_create_deep_agent)
    repository = Repository(session)
    project = repository.create_project("Custom report Skill")
    service = SkillService(repository)
    skill = service._install_directory(skill_root)
    service.enable(project.id, skill.id, service.declared_permissions(skill))
    AgentRuntime(repository)._deep_agent(project.id, "生成报告", Intent.REPORTING)
    agent_kwargs = captured["agent_kwargs"]
    assert isinstance(agent_kwargs, dict)
    assert agent_kwargs["skills"] == ["/skills/"]
    assert "Always add a cohort-retention appendix" not in agent_kwargs["system_prompt"]
    payload = captured["payload"]
    assert isinstance(payload, dict)
    skill_files = payload["files"]
    assert isinstance(skill_files, dict)
    assert f"/skills/{skill.name}/SKILL.md" in skill_files
    assert all(f"/skills/{skill.id.replace('@', '-')}/" not in key for key in skill_files)
    matching = [value["content"] for key, value in skill_files.items() if key.endswith("SKILL.md")]
    assert any("Always add a cohort-retention appendix" in content for content in matching)
    disclosure = next((project_root(project.id) / "runs").glob("*-model-disclosure.json"))
    assert skill.id in disclosure.read_text(encoding="utf-8")
    monkeypatch.delenv("DEEPSEEK_API_KEY")
    response = AgentRuntime(repository).respond(project.id, "生成报告")
    assert "自定义报告 Skill" in response.content
    assert len(response.artifacts) == 1
    assert repository.get_artifact(project.id, response.artifacts[0]).type == "agent_run"
    assert repository.list_latest_reports(project.id) == []


def test_minimal_baseline_excludes_samples_paths_and_hashes() -> None:
    result = minimal_baseline(
        {
            "format": "csv",
            "rows": 10,
            "fields": [{"name": "customer", "dtype": "str"}],
            "sample": [{"customer": "private value"}],
            "source_sha256": "secret-ish-local-fingerprint",
            "path": "/private/path",
        }
    )
    assert result == {
        "format": "csv",
        "rows": 10,
        "fields": [{"name": "customer", "dtype": "str"}],
    }


def test_artifact_summary_excludes_row_samples_and_local_paths() -> None:
    artifact = SimpleNamespace(
        id="artifact-1",
        name="Private extract",
        type="extract",
        lineage=[],
        artifact_metadata={
            "rows": 1,
            "columns": ["customer"],
            "preview": [{"customer": "private value"}],
            "query_path": "/private/query.sql",
        },
    )
    assert artifact_summary(artifact)["metadata"] == {"rows": 1, "columns": ["customer"]}


def test_classification_and_soft_voting_persist_artifacts(session: Session) -> None:
    repository = Repository(session)
    project = repository.create_project("ML")
    frame = pd.DataFrame(
        {
            "delivery_days": list(range(10, 50)) * 3,
            "freight": [float(index % 17) for index in range(120)],
            "region": ["SE", "S", "NE"] * 40,
            "low_review": [0, 0, 1, 0, 1] * 24,
        }
    )
    path = project_root(project.id) / "datasets" / "derived" / "training.parquet"
    frame.to_parquet(path, index=False)
    source = repository.add_artifact(
        project.id,
        "derived",
        "Training data",
        path,
        {"rows": len(frame), "columns": list(frame.columns)},
    )
    results = MLService(repository).run(
        project.id,
        source.id,
        "classification",
        "low_review",
        ["delivery_days", "freight", "region"],
        "soft_voting",
        "Low review fusion",
        42,
    )
    assert set(results) == {"code", "model", "predictions"}
    assert results["model"].artifact_metadata["algorithm"] == "soft_voting"
    assert "f1_weighted" in results["model"].artifact_metadata["metrics"]
    assert "cv_mean" in results["model"].artifact_metadata["metrics"]
    code = (project_root(project.id) / results["code"].path).read_text(encoding="utf-8")
    assert "model.fit" in code
    predicted = MLService(repository).predict(
        project.id, results["model"].id, source.id, "Full predictions"
    )
    assert predicted.artifact_metadata["rows"] == len(frame)
    assert predicted.lineage == [source.id, results["model"].id]


def test_clustering_pipeline_predicts_raw_features_and_has_reproducible_code(
    session: Session,
) -> None:
    repository = Repository(session)
    project = repository.create_project("Clustering")
    frame = pd.DataFrame(
        {
            "revenue": [1.0, 1.2, 1.4, 8.0, 8.2, 8.4, 20.0, 21.0],
            "orders": [1, 1, 2, 7, 8, 8, 20, 22],
        }
    )
    path = project_root(project.id) / "datasets" / "derived" / "clusters.parquet"
    frame.to_parquet(path, index=False)
    source = repository.add_artifact(
        project.id, "derived", "Cluster data", path, {"rows": len(frame), "columns": list(frame)}
    )
    results = MLService(repository).run(
        project.id, source.id, "clustering", None, ["revenue", "orders"], "kmeans", "Segments", 42
    )
    predicted = MLService(repository).predict(
        project.id, results["model"].id, source.id, "Cluster predictions"
    )
    trained = pd.read_parquet(project_root(project.id) / results["predictions"].path)
    replayed = pd.read_parquet(project_root(project.id) / predicted.path)
    assert trained["cluster"].tolist() == replayed["prediction"].tolist()
    code = (project_root(project.id) / results["code"].path).read_text(encoding="utf-8")
    assert "KMeans" in code
    assert "target =" not in code
