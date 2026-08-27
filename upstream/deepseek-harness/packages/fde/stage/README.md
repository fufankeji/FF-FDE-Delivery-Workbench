# @deepseek-ai/dsh-fde-stage

English | [中文](README.zh.md)

Host-side current-stage state for FDE projects. The package opens one `storage-domain` table keyed by Harness WorkspaceId and exposes a trusted same-origin POST route that reads the record or durably initializes it to `requirements`. Concurrent first reads for one Workspace share a single write. The current slice accepts no target stage, completion claim, or transition operation.

The six product stages are requirements research, solution design, project development, validation and evaluation, deployment and pilot, and acceptance and handoff. Their detailed inputs, artifacts, confirmations, and completion rules belong to later stage-gate slices.

## Model Experience

None, as reading or initializing project progress creates no Session event, prompt, tool, message, or model request.

#### KV Cache effect

None; no provider request is assembled or changed.

## Known Limitations and Deferred Work

- The route is loopback/same-origin only and requires an existing WorkspaceId.
- The record contains only the current stage, revision, and timestamps; transition history, affected-stage state, delivery-gate evidence, and browser push updates are deferred to F005.
- The current stage is not model-visible until the later `fde-context` consumer records a reconstructable project snapshot in each addressed Session.
