# Agent Note: FDE validation and pilot gate

Status: implemented

English | [中文](2026-08-27-fde-validation-stage.zh.md)

## Problem

Project development could produce code and development close-out documents, but the workbench had no project-level contract for deciding whether one specific candidate was ready for pilot deployment. The existing Evaluation page could run repeatable Agent trials, yet it did not identify the candidate, environment, project-specific inputs, acceptance thresholds, evidence, or unresolved issues. Treating file presence or an Agent statement as acceptance would also let automation make a delivery decision that belongs to the FDE.

## Decision

The Host reads one bounded schema-v2 contract at `.fde/evaluations/validation.json`. It records the candidate, environment, optional datasets or cases, project-specific metrics, thresholds, results, evidence paths, and issues. Every metric must cite real prior-stage project documents plus requirement, acceptance, or decision references. Sources and result evidence must resolve inside the current project. Dataset registration is optional; traceable metrics and evidence are the required business contract. Missing, invalid, not-run, failed, unsupported-warning, or high-severity unresolved entries remain explicit blockers.

The validation stage uses one on-demand `fde-validation` Skill with two explicit modes. Plan preparation may maintain the contract and `validation-plan.md`, but it keeps unexecuted results at `NOT_RUN`. Execution starts only after the FDE confirms the exact plan-definition digest. The digest covers the candidate, environment, datasets, metric definitions, and source-document content while excluding execution results, evidence, and issue state. The Host atomically writes that confirmation to `.fde/evaluations/validation-plan-approval.json`; the Agent cannot create or change it. Execution may then maintain `validation-report.md` and `validation-baseline.md`. It must not invent data, thresholds, results, evidence, or customer acceptance. Changing the candidate, environment, input, source document or its content, method, or threshold invalidates the prior confirmation and returns affected results to `NOT_RUN`; normal result updates do not invalidate it.

The Evaluation page exposes the visible sequence Generate Evaluation Plan, Confirm Evaluation Plan, and Start Validation. Its overview derives required-metric completion, execution status, evidence and artifact coverage, blockers, category coverage, and five-step progress directly from the current snapshot. Result and category filters change presentation only; they do not mutate the contract. It shows every metric's source references and retains the previous Trial runner under the narrower Run Fixed Cases action. Project Progress shows the same sources, approval state, evidence, and three fixed documents. The Host enables the final two-step FDE stage action only when the current plan is confirmed, all required results and evidence are complete, warnings have an acceptance reason, critical or high issues are closed, and all three documents exist. The final action performs exactly one revision-checked `validation` to `pilot` transition. The Agent and Skill have neither plan-confirmation nor stage-transition capability.

## Consequences

Each project can define evidence appropriate to its real delivery instead of inheriting a generic benchmark, while the source references make it visible where each requirement came from. Simple projects do not need a dedicated dataset, while data or AI projects can register versioned inputs and hashes. Fixed cases remain optional and do not block other validation methods. The first implementation does not execute every metric automatically, create a separate dataset service, or infer acceptance from Trial reports; those artifacts can be referenced as evidence only after they exist.
