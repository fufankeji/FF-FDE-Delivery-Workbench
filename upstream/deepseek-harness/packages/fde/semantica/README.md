# @deepseek-ai/dsh-fde-semantica

English | [中文](README.zh.md)

Workspace-scoped Semantica integration for stage four of an FDE project. The package keeps mechanism selection, semantic design, knowledge candidates, graph construction, independent validation, bounded Agent context, vertical-slice evidence, and the FDE decision as separate facts. It never selects the ontology route, promotes extracted candidates, claims a business task ran, or advances a stage on behalf of the FDE.

## Stage-four contract

The workbench first records two independent choices: how the system should perform the work, and whether ordinary data/interface schemas are sufficient. The simple route proceeds through development specifications and one real vertical slice without creating ontology or graph placeholders. The ontology route adds a two-loop workflow: publish the minimum semantic definition, then build and validate a project graph against that exact definition before an Agent may query it.

Ontology work is stored under `.fde/design/semantica/`; the renderer reads only the validated project snapshot at `.fde/design/knowledge-graph.json`. A content digest ties the selected route, bound source versions, definition, candidate decisions, provider runs, graph revision, validation receipt, bounded context, vertical slice, and FDE decision together. Changing any governed evidence makes dependent results and the prior decision stale instead of silently preserving a completed state.

The final mechanism conclusion is one of `not_required`, `validated`, `validation_failed`, or `insufficient_evidence`. That conclusion remains independent from the FDE's `Go`, `Revise`, `Narrow`, or `Stop` decision. Only a current `Go` may invoke the existing stage-transition gate.

## Semantica runtime boundary

The Host adapter targets Semantica `0.6.7`. Configure one local installation through the web-app Loader environment; no machine-specific path is hard-coded and no Semantica source, virtual environment, global graph, or demonstration data is bundled.

```yaml
pythonCommand: !!js process.env.FDE_SEMANTICA_PYTHON ?? 'python3'
semanticaSource: !!js process.env.FDE_SEMANTICA_SOURCE ?? ''
operationTimeoutMs: 60000
maxSourceBytes: 2097152
maxSources: 12
```

The bundled Python bridge uses Semantica's SDK for provider health, extraction, ontology proposal and validation, graph construction, graph validation, and bounded graph queries. Every operation is explicit and separately recorded. A successful process exit is not interpreted as schema quality, graph validity, or vertical-slice success.

## Project data and operations

Only already indexed and locally parsed Sources from the current registered Workspace can be bound. Each binding pins the source id, digest, local content reference, authority, and project-specific permission scope; changed source bytes require rebinding. Candidate entities and relationships remain pending until an explicit accept or reject decision.

The editable definition includes competency questions, classes, aliases, identity keys, typed properties, source-field mappings, relationships with domain/range and cardinality, extraction patterns, provenance rules, temporal rules, confidence threshold, and SHACL severity. Publishing runs structural validation and writes the versioned ontology plus SHACL before graph construction becomes available.

| Same-origin action | Purpose |
| --- | --- |
| `/api/fde-semantica/route` | Save the execution mechanism and semantic-foundation choice. |
| `/api/fde-semantica/sources` | Bind versioned project Sources and their allowed use. |
| `/api/fde-semantica/definition` | Save one exact editable ontology-definition revision. |
| `/api/fde-semantica/candidates` | Apply bounded human accept or reject decisions. |
| `/api/fde-semantica/run` | Run one explicit health, extract, propose, publish, build, validate, or context step. |
| `/api/fde-semantica/slice/report` | Persist the truthful result and project evidence for an executed slice. |
| `/api/fde-semantica/decision` | Persist a version-bound FDE decision without conflating it with provider results. |

All actions require a trusted local request, an existing WorkspaceId, and bounded JSON. Paths are resolved inside the registered project, writes are atomic, and stale browser revisions are rejected where a human decision could otherwise overwrite newer evidence.

## Agent integration

The package registers two stable model tools. `semantic_context_query` queries only the current project's independently validated graph and persists a bounded context containing relevant entities, relationships, provenance, time, confidence, schema version, graph revision, and permission scope. `semantic_slice_report` records the observed result of a slice that the visible Agent or FDE actually ran; it requires project-local evidence and cannot manufacture execution or submit an FDE decision.

The context operation requires a published competency question or exact seed entity and caps traversal depth at three. It does not inject the entire graph into the model. The slice report must cite ordinary files that currently exist inside the same project; the ontology route additionally requires the current context run id.

## Model Experience

### Semantica Agent tools

#### What the model sees

Two fixed tool schemas: `semantic_context_query` and `semantic_slice_report`. Route selection, source binding, schema editing, candidate review, build, validation, and FDE decisions remain trusted workbench actions and are not exposed as model tools.

#### Token effect

The fixed schemas add input tokens to requests that can see the global tool registry. Project graph content enters context only through one bounded query result, and vertical-slice evidence enters only through the explicit report result.

#### KV Cache effect

The tool schemas are stable across projects and requests. Project-specific questions, graph facts, revisions, and evidence affect only the ordinary conversation suffix after a tool call.

## Known Limitations and Deferred Work

- Semantica's default extraction quality depends on installed optional models and source language. Chinese free text may need reviewed extraction patterns, aliases, and field mappings; provider success is not a quality verdict.
- Semantica currently exposes useful SDK modules rather than one reliable arbitrary-document-to-production-graph operation. This adapter deliberately orchestrates and validates each step instead of calling one build endpoint.
- The package does not execute the project's business slice. The visible Agent or FDE runs the real task and then reports project-local evidence.
- `Stop` records the current stage-four decision and keeps the project in stage four; a separate project lifecycle or archive operation is not yet defined.
- The three-dimensional explorer is a bounded inspection surface, not an ontology editor or proof of graph validity. It appears only when the current project has a non-empty validated graph snapshot.
