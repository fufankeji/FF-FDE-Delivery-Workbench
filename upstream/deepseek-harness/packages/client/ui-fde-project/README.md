# @deepseek-ai/dsh-client-ui-fde-project

English | [中文](README.zh.md)

Browser presentation for the FDE project delivery workspace. It adds a root-level Project Progress page beside the persistent sidebar and four project-scoped conversation views: API Docs, System Architecture, Observability, and Evaluation.

## Behavior

- Project Progress replaces the center/right work surfaces while open, so the underlying conversation, composer, and Better Sidebar cannot show through or receive input.
- It reads the existing Workspace list, creation metadata, Session summaries, and Workspace-scoped six-stage projection. A project card opens a read-only Project Details page with the project's Source list, processing status, shared preview seat, and an explicit “Enter project delivery” action.
- API Docs, System Architecture, and Evaluation read the trusted `/api/fde-project/snapshot` route.
- Observability aggregates the current project's existing `sessionStats` and `tokenUsage` projections. External export remains disabled until deployment configuration opts in.
- Running an evaluation is an explicit user action. It queues a prompt asking the current Agent to invoke `eval_run`; mounting or viewing the page never starts a model call.

## Project files

```text
.fde/api-docs.json
.fde/architecture.json
.fde/evaluations/cases/*.yml
.fde/evaluations/reports/*/report.json
.fde/evaluations/baseline/report.json
```

## Model Experience

None, as the browser plugin registers UI contributions only; Host packages own every model-visible tool and prompt submitted by explicit user actions.

#### KV Cache effect

None; the browser package does not assemble or change provider requests.

## Known Limitations and Deferred Work

- Project creation metadata is browser-local in the current Workspace view store; a second browser does not receive company and schedule fields yet.
- API documentation embedded in an iframe depends on the target server's frame policy; the page always keeps an external-open fallback.
- The v1 architecture diagram uses a deterministic grouped layout rather than an interactive editor.
- External Langfuse/OTLP status is not shown while the exporter is disabled by deployment configuration.
- Project Details is intentionally read-only; editing, moving, deleting, and Agent use remain in Project Delivery or later confirmed features.
