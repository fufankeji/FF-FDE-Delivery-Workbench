# Agent Note: Stage-four Semantica provider and project knowledge-graph renderer

Status: implemented

English | [中文](2026-09-04-fde-stage-four-project-knowledge-graph-renderer.zh.md)

## Problem

Stage four must decide both how the project should implement its minimum vertical slice and whether it needs a formal ontology. The old generic stage panel could express neither a simple route without a graph nor a trustworthy path from project sources to schema, reviewed knowledge, validation, Agent context, and a real slice. Displaying a Semantica example or treating a successful build command as a validated project result would turn demonstration data and process state into false business evidence.

The integration also crosses a process boundary. Semantica is a separately installed Python runtime with parsing, ontology, graph, provenance, temporal, validation, and query modules, not a single reliable arbitrary-document-to-production-graph endpoint. Every graph fact must stay isolated to one registered Workspace and retain its source version, permission scope, confidence, time, schema version, and graph revision.

## Decision

- Stage four uses a dedicated workbench. It records execution mechanism and semantic foundation as two independent choices; ordinary Schema is a complete first-class route and creates no ontology or graph placeholder.
- `@deepseek-ai/dsh-fde-semantica` is the trusted Host boundary for the optional local Semantica `0.6.7` runtime. Configuration supplies the Python command and optional source directory; no local path, global graph, or demonstration record is compiled into product code.
- The ontology route is explicitly staged as project-source binding, candidate extraction, schema proposal and editing, candidate review, schema publication, graph construction, independent validation, bounded Agent-context query, real vertical-slice report, and FDE decision. Build, validation, slice, mechanism conclusion, and FDE decision remain different facts.
- Definitions include competency questions, classes, aliases, identity keys, typed properties, field mappings, relationships and cardinality, extraction patterns, provenance, time, confidence, and SHACL severity. Definition or source changes mark dependent evidence stale.
- The Host writes versioned project state under `.fde/design/semantica/`; the renderer reads only structurally validated `.fde/design/knowledge-graph.json`. Shared `3d-force-graph` owns the single live 3D force simulation. The snapshot adapter supplies evidence and endpoints without coordinates or artificial links. A renderer-local soft force gathers real connected components around display anchors; initial framing fits their bounds. Custom luminous meshes, degree-based rings, Bloom and camera-relative stars enhance the real scene without inventing entities. All links appear by default; the optional maximum-spanning-forest backbone preserves connectivity and does not assert business importance. Persistent collision-aware names support reading, while hover/selection reveals neighborhoods and evidence. Particles indicate registered relationship direction, not live execution. Automatic orbit and layout motion can be paused, stop on direct manipulation or selection, and start settled for reduced motion. Reheating is reserved for user resume after initialization. Search, community filtering, fullscreen and related-entity navigation preserve the project snapshot.
- Agent preparation uses `semantic_workspace` to inspect project state, bind authorized source versions, edit drafts and execute SDK steps through the workbench's Provider. `semantic_context_query` returns a bounded current-project subgraph with governing metadata; `semantic_slice_report` records evidence for a task actually run. These tools cannot select a route, publish a schema, approve candidates, submit an FDE decision or advance the stage. Publication metadata is rejected in definition edits. Re-extraction invalidates dependent evidence; consumption checks live runtime and source versions without changing the design state. Operator paths persist in the existing ignored Harness-home environment file rather than compiled defaults.
- `Go`, `Revise`, `Narrow`, and `Stop` are stored with the exact evidence digest and rationale. Only a current `Go` may invoke the existing stage gate; later governed evidence makes the decision stale.

## Alternatives considered

**Always require an ontology in stage four.** Rejected because many projects need only a development specification and ordinary data or interface schemas. Complexity alone is not evidence that a graph creates value.

**Use Semantica's Explorer or one build endpoint as the product boundary.** Rejected because that would couple the workbench to global runtime state and conflate module availability with an auditable project workflow.

**Let extraction write directly to the formal graph.** Rejected because model- or pattern-derived entities and relationships are candidates. They require explicit review before becoming governed project knowledge.

**Inject the complete graph into every Agent request.** Rejected because it expands permissions and tokens, loses task relevance, and obscures which schema and graph revision supported a result.

**Show a static example while the current project is empty.** Rejected because a polished placeholder is indistinguishable from project evidence in this workflow. The product displays an honest empty or blocked state instead.

## Consequences

- Simple and ontology projects share one stage language without forcing the same implementation mechanism or visual surface.
- Project files, not React state or an external global graph, are the durable source of truth; refresh and stage history can reproduce the current evidence status.
- Ontology and graph operations have more explicit steps, but each step is independently retryable and a stale or failed step cannot masquerade as completion.
- The graph explorer appears only for a non-empty current project snapshot. Visual quality is separated from semantic validity, and node details retain source, time, and confidence evidence.
- Semantica remains an optional operator-managed runtime. Its virtual environment and generated stores are not versioned or distributed with DeepSeek Harness.
- A recorded `Stop` remains in stage four because the project currently has no separate lifecycle archive transition.

## Testing

Host and integration tests run the real local Semantica `0.6.7` bridge through source binding, extraction, schema publication, reviewed graph construction, validation, bounded context, and slice reporting. They also cover the simple route, project isolation, invalid and stale evidence, source-version invalidation, independent build and validation states, all four FDE outcomes, and rejection of stale human decisions. Client tests cover both routes, structured ontology editing, decision behavior, absence of demonstration nodes, immutable coordinate-free input, native 3D motion startup, pause/resume, reduced motion, undeclared project communities, complete community legends, search, and related-entity navigation.
