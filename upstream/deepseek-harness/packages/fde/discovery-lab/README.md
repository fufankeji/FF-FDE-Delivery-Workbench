# @deepseek-ai/dsh-fde-discovery-lab

English | [中文](README.zh.md)

Independent Host plugin for business-discovery training. It serves five versioned cases, native role interviews, authorized originals, evidence checks, fixed Python calculations, report history and Markdown/PDF export. It neither registers a Workspace nor changes project stages.

## Setup and storage

From the Harness root, run `corepack pnpm --filter @deepseek-ai/dsh-fde-discovery-lab import:assets /absolute/path/to/FDE-业务挖掘实验室-完整交付-v0.3.2-2026-09-15.zip` before starting the existing Web profile. The importer verifies the pinned runtime digest and every authorized asset. See [source and adaptation notes](SOURCE.md). Node 24+ and Python 3.9+ are required; `FDE_PYTHON` can select the Python executable.

Start with explicit `DSH_HOME`. Case assets reside in package-local `.assets/` (about 36 MB, regenerable); mutable training state resides in `$DSH_HOME/fde-discovery-lab/training.sqlite`. Native logs stay in the Host session backend. Keep both database and native logs when preserving training. Re-importing assets never overwrites training.

Routes are `/api/fde-discovery-lab` and `/fde-discovery-lab`. The latter serves only the three built Client application files, never case definitions. The shared Host/Origin/Fetch-Metadata check applies to both routes. Missing assets produce an explicit 503 for this module without removing existing workbench routes.

## Model Experience

Opening the lobby, selecting a role and restoring records do not call a model. Submitting an interview invokes a role-owned native Agent restricted to `lookupRoleFacts` and `offerCaseAsset`; committed replies can trigger a separate evidence-check Agent. Report generation also uses a separate Agent, after required evidence is complete. Helpers have no business or workspace tools. These actions can incur provider charges.

The original training route is retained: `DEEPSEEK_PROVIDER` defaults to `deepseek-official`, and `DEEPSEEK_MODEL` to `deepseek-v4-flash`. Credentials come from the existing Host provider configuration. Training does not follow or change a project's model picker.

#### KV Cache effect

Role prompts are stable within a case version. Each role has its own durable native conversation; evidence checks and report drafts use separate sessions and add model usage, without injecting content into project sessions.

## Known Limitations and Deferred Work

- One current run per case is shared by users of the same Host, matching the source delivery. No accounts, classroom isolation or concurrent-user permissions.
- No report backflow, project creation or automatic stage advancement.
- Explicit LAN mode remains unauthenticated and is appropriate only for a trusted network.
- Deterministic tests and scripted native integration do not establish live-model answer quality or visual acceptance.
- Source delivery has no declared overall public redistribution license; the integration packages remain private.
