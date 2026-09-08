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

The bundled Python bridge uses Semantica's SDK for provider health, extraction, ontology proposal and validation, graph construction, and graph validation. Bounded task queries run in the adapter against that graph. Every operation is explicit and separately recorded. A successful process exit is not interpreted as schema quality, graph validity, or vertical-slice success.

The current pattern-based pipeline requires no model API key. To run the real SDK integration checks, set `FDE_SEMANTICA_TEST_PYTHON` to an interpreter that can import Semantica `0.6.7`; otherwise those tests skip. This test setting does not configure the running Web service, which uses `FDE_SEMANTICA_PYTHON`. Supplying a model key alone does not enable LLM extraction in this adapter.

```sh
FDE_SEMANTICA_TEST_PYTHON=/path/to/semantica/.venv/bin/python \
  corepack pnpm exec vitest run packages/fde/semantica/tests/semantica.spec.ts \
  packages/fde/semantica/tests/sdk-generality.spec.ts -t 'real.*SDK'
```

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

The package registers three stable model tools. `semantic_workspace` inspects current project state and runs source binding, draft editing, health, extraction, schema proposal, construction or independent validation through the same Provider as the workbench. Inspection pages Sources and candidates in batches of 20 and provides editable `definitionDraft` plus its revision; output is limited to 128 KiB. Mutations require an explicitly selected ontology route. Route selection, candidate acceptance/rejection, publication and FDE decisions remain human workbench actions, not accepted Agent operations.

`semantic_context_query` defaults to read-only consumption, leaving stage-four files, slice and FDE decision unchanged; its result is logged by Harness. Explicit `purpose=validation` creates replacement design context and invalidates the previous slice. `semantic_slice_report` saves the caller's reported result with nonblank project-local evidence; it does not execute the task or independently certify the claim and cannot submit an FDE decision.

Persist runtime paths in the invoking directory's or isolated Harness home's ignored `.env`, using `FDE_SEMANTICA_PYTHON` and optional `FDE_SEMANTICA_SOURCE`; inherited environment variables take precedence. The launch must still supply the intended `DSH_HOME`. Read-only consumption checks live SDK version and bound source versions without writing provider state; a cached ready status does not bypass those checks. Re-extraction invalidates dependent evidence, and stale candidates cannot be rebuilt until refreshed and reviewed.

The context operation requires a published competency question or exact seed entity and caps traversal depth at three. `query` describes the task; it is not free-text semantic search. Bound-source, confidence and declared valid-time filtering precedes traversal. Textual rules and `permissionScope` are instructions, not an executed authorization policy. The ontology slice must cite the current validation-context run id, not an ordinary consumption query.

## Model Experience

### Semantica Agent tools

#### What the model sees

Three fixed tool schemas: `semantic_workspace`, `semantic_context_query` and `semantic_slice_report`. Inspection returns project progress and human tasks; preparation returns actual Provider results. No tool can select the mechanism, approve knowledge, publish a schema or decide a stage.

#### Token effect

The fixed schemas add input tokens to requests that can see the global tool registry. Project data enters through an explicit inspection, bounded graph query or slice report; inspection does not return the complete graph or automatically read every source document.

#### KV Cache effect

The tool schemas are stable across projects and requests. Project-specific questions, graph facts, revisions, and evidence affect only the ordinary conversation suffix after a tool call.

## Known Limitations and Deferred Work

- This adapter uses pattern NER and project-defined relation patterns, not automatic model selection. Rule scores (0.82 for entity patterns and 0.78 for relation patterns) are heuristics, not calibrated factual confidence. Identity keys determine identity; missing keys and ambiguous relation endpoints are not silently merged. Attribute conflicts remain separate candidates for review.
- Independent graph validation enforces supported project property types, required/unique values, identity keys, domain/range, cardinality, provenance and valid-time structure in addition to SDK type checks. Exported SHACL is not a claim that every SHACL construct is executed. Competency-query cardinality proves retrievability, not business-answer correctness. Older validations must rerun to obtain a `project-constraints-v1` receipt; graph files and lifecycle history remain intact.
- Semantica currently exposes useful SDK modules rather than one reliable arbitrary-document-to-production-graph operation. This adapter deliberately orchestrates and validates each step instead of calling one build endpoint.
- The package does not execute the project's business slice. The visible Agent or FDE runs the real task and then reports project-local evidence.
- `Stop` records the current stage-four decision and keeps the project in stage four; a separate project lifecycle or archive operation is not yet defined.
- The three-dimensional explorer is a bounded inspection surface, not an ontology editor or proof of graph validity. It appears only when the current project has a non-empty validated graph snapshot.
