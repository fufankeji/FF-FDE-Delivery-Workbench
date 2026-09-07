# Agent Note: FDE project independence and evidence integrity

English | [中文](2026-09-07-fde-generality-and-evidence-integrity.zh.md)

Status: implemented

## Problem

Project-specific delivery records can look complete without sufficient evidence. Graph consumption can also change design-validation state, and legacy transition operations can bypass the V2 investigation stage.

## Decision

Stage records are read from the registered project. Blank or escaping artifacts do not count, empty investigation sections need evidenced non-applicability, and unresolved boundaries block review. Evaluation output hashes are pinned separately from the input fingerprint. Explicit synthetic provenance cannot establish real delivery readiness. These checks establish integrity, not independent execution or customer acceptance.

Ordinary semantic queries return context through the Harness tool result without writing design state. Only explicit validation queries replace the design context. Project identity, property, relation and valid-time checks execute in the adapter; validation receipts carry a checks version so older type-only validation is not reused. Textual rules remain instructions, not an authorization engine.

Existing legacy records are not migrated on read. Each transition executor accepts only its own lifecycle version, including return operations; prompts use the same discriminator.

Stage copy names delivery tasks and observable states: implementation selection, business queries, graph integration, test versions and stage review. Technical identifiers and established lifecycle titles remain stable. Selection records are not labeled human approval, and read-only history is not described as immutable storage. Customer-authored content is preserved verbatim.

## Alternatives considered

Case-name special handling, synthetic default facts and separate demonstration progress would conceal missing evidence and make new projects unreliable. Removing legacy entry points would break valid old projects. Automatically rewriting old receipts would invent verification history.

## Consequences

Existing files and lifecycle history remain intact. Older unbound results and graph validations need review or rerunning. Receipt authenticity, machine execution attestation and external signatures are not supplied by file hashing. The adapter's pattern scores are heuristics, and bounded competency queries do not certify business-answer correctness.

## Testing

Focused project and stage tests cover file integrity, provenance and lifecycle isolation. A real Python context query proves byte-for-byte design-state preservation; Python adapter tests cover a publishing schema with identity conflicts, typed properties, relation cardinality and excluded paths. SDK-backed construction is a separate opt-in integration check.

The CLI-owned keyless FDE snapshot boots the shipped Base and Web bundle patches through Loader from built packages, calls the real HTTP routes against isolated projects, and pins both the review output and the model-visible query schema. Browser-only surfaces and telemetry are disabled in the test overlay; production defaults are unchanged.

The same composition snapshot pins stage and method descriptions. Client tests retain file viewing, graph construction, runtime controls and explicit stage confirmation while asserting the readable labels.
