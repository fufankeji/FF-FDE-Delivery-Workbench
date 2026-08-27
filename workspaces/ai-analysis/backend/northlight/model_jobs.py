from __future__ import annotations

import multiprocessing
import queue
import threading
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

from northlight.database import SessionLocal
from northlight.domain import ModelRunRequest
from northlight.ml_service import MLService
from northlight.repository import Repository
from northlight.settings import get_settings


def _run_model_job(
    project_id: str,
    payload: dict[str, Any],
    result_queue: Any,
) -> None:
    try:
        request = ModelRunRequest.model_validate(payload)
        with SessionLocal() as session:
            result = MLService(Repository(session)).run(
                project_id,
                request.artifact_id,
                request.task,
                request.target,
                request.features,
                request.algorithm,
                request.name,
                request.random_state,
                request.tune,
            )
            result_queue.put(
                {
                    "status": "succeeded",
                    "result": {key: artifact.id for key, artifact in result.items()},
                }
            )
    except Exception as exc:
        result_queue.put({"status": "failed", "error": f"{type(exc).__name__}: {exc}"})


@dataclass
class ModelJob:
    id: str
    project_id: str
    process: Any
    result_queue: Any
    started_at: float = field(default_factory=time.monotonic)
    status: str = "running"
    message: str = "训练进程已启动"
    result: dict[str, str] | None = None
    error: str | None = None

    def view(self) -> dict[str, object]:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "status": self.status,
            "message": self.message,
            "elapsed_seconds": round(time.monotonic() - self.started_at, 2),
            "result": self.result,
            "error": self.error,
        }


class ModelJobManager:
    def __init__(self) -> None:
        self.context = multiprocessing.get_context("spawn")
        self.jobs: dict[str, ModelJob] = {}
        self.lock = threading.Lock()

    def start(
        self, repository: Repository, project_id: str, payload: ModelRunRequest
    ) -> dict[str, object]:
        repository.get_project(project_id)
        repository.get_artifact(project_id, payload.artifact_id)
        with self.lock:
            for existing in self.jobs.values():
                self._refresh(existing)
            active = sum(job.status == "running" for job in self.jobs.values())
            if active >= 2:
                raise ValueError("At most two local model jobs may run concurrently")
            job_id = str(uuid4())
            result_queue = self.context.Queue()
            process = self.context.Process(
                target=_run_model_job,
                args=(project_id, payload.model_dump(), result_queue),
                name=f"northlight-model-{job_id[:8]}",
            )
            job = ModelJob(job_id, project_id, process, result_queue)
            self.jobs[job_id] = job
            process.start()
            return job.view()

    def status(self, project_id: str, job_id: str) -> dict[str, object]:
        job = self._get(project_id, job_id)
        self._refresh(job)
        return job.view()

    def cancel(self, project_id: str, job_id: str) -> dict[str, object]:
        job = self._get(project_id, job_id)
        self._refresh(job)
        if job.status == "running":
            job.process.terminate()
            job.process.join(timeout=5)
            if job.process.is_alive():
                job.process.kill()
                job.process.join(timeout=2)
            job.status = "cancelled"
            job.message = "训练已由用户取消"
        return job.view()

    def shutdown(self) -> None:
        """Terminate only model workers owned by this application process."""
        with self.lock:
            jobs = list(self.jobs.values())
        for job in jobs:
            self._refresh(job)
            if job.status != "running":
                continue
            job.process.terminate()
            job.process.join(timeout=5)
            if job.process.is_alive():
                job.process.kill()
                job.process.join(timeout=2)
            job.status = "cancelled"
            job.message = "应用停止，训练进程已终止"

    def _get(self, project_id: str, job_id: str) -> ModelJob:
        with self.lock:
            job = self.jobs.get(job_id)
        if not job or job.project_id != project_id:
            raise KeyError(f"Model job not found in project: {job_id}")
        return job

    def _refresh(self, job: ModelJob) -> None:
        if job.status != "running":
            return
        try:
            outcome = job.result_queue.get_nowait()
        except queue.Empty:
            outcome = None
        if outcome:
            job.process.join(timeout=2)
            job.status = str(outcome["status"])
            job.result = outcome.get("result")
            job.error = outcome.get("error")
            job.message = "模型与评估产物已登记" if job.status == "succeeded" else "训练失败"
            return
        if time.monotonic() - job.started_at > get_settings().training_timeout_seconds:
            job.process.terminate()
            job.process.join(timeout=5)
            job.status = "timed_out"
            job.error = "Training exceeded the configured timeout"
            job.message = "训练已达到超时上限并终止"
            return
        if not job.process.is_alive():
            job.process.join(timeout=1)
            job.status = "failed"
            job.error = f"Training process exited with code {job.process.exitcode} without a result"
            job.message = "训练进程异常结束"


model_job_manager = ModelJobManager()
