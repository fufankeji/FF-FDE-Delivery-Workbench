# @deepseek-ai/dsh-fde-discovery-lab

English | [中文](README.zh.md)

Independent Host plugin for business-discovery training. It serves five versioned cases, native role interviews, authorized originals, evidence checks, fixed Python calculations, report history and Markdown/PDF export. It neither registers a Workspace nor changes project stages.

## Setup and storage

Required material for all five cases ships in the source and package `assets/` directory; normal installation needs no extra ZIP. Before installing dependencies, run `node packages/fde/discovery-lab/scripts/verify-assets.mjs` from the Harness root; the complete build also verifies the material. See [source and adaptation notes](SOURCE.md). Node 24.9+ and Python 3.9+ are required; `FDE_PYTHON` can select the Python executable. `import:assets` remains a maintainer tool for reproducing identical content from the pinned original delivery, not an installation prerequisite.

Start with explicit `DSH_HOME`. Fixed material resides in package-local `assets/` (248 files, about 36.7 MB); `assets-manifest.json` checks sizes, digests and the 234 case-original references. Mutable training state resides in `$DSH_HOME/fde-discovery-lab/training.sqlite`, and native logs stay in the Host session backend. Keep both database and native logs when preserving training; restoring static material never overwrites training.

Routes are `/api/fde-discovery-lab` and `/fde-discovery-lab`. The latter serves only the three built Client application files, never case definitions. The shared Host/Origin/Fetch-Metadata check applies to both routes. Missing or damaged material produces an explicit 503 for this module: obtain the complete source, build and restart without deleting training data. This state is not a successful installation.

## Model Experience

Opening the lobby, selecting a role and restoring records do not call a model. Submitting an interview invokes a role-owned native Agent restricted to `lookupRoleFacts` and `offerCaseAsset`; committed replies can trigger a separate evidence-check Agent. Report generation also uses a separate Agent, after required evidence is complete. Helpers have no business or workspace tools. These actions can incur provider charges.

Each training Agent mounts `dsh-tool-executor-native` in its own scope and retains its tool allowlist and guard. It does not inherit a project's PTC mode or change global tool configuration.

The original training route is retained: `DEEPSEEK_PROVIDER` defaults to `deepseek-official`, and `DEEPSEEK_MODEL` to `deepseek-v4-flash`. Credentials come from the existing Host provider configuration. Training does not follow or change a project's model picker.

Interviews, evidence checks and reports leave `reasoningEffort` unset and use the selected provider/model defaults. Models without reasoning capability receive no forced effort; omission does not mean reasoning is disabled. Request-preparation errors retain their native error message in the interview receipt or helper failure, including failures before a user message is committed. Actual cancellation retains its existing fallback message.

For a custom `llm-pi-ai` gateway that rejects the `developer` role, set `compat.supportsDeveloperRole: false` on that provider or model, not globally. Declare only the reasoning levels the model supports. If its wire protocol requires `reasoning_effort: none`, the mapping is `reasoningEfforts: { off: none }`; `none` is not an internal effort name, and non-reasoning models do not require a fabricated effort declaration. See [provider reasoning and compatibility](../../llm/llm-pi-ai/README.md). Gateway-specific acceptance still requires validation against that gateway.

#### KV Cache effect

Role prompts are stable within a case version. Each role has its own durable native conversation; evidence checks and report drafts use separate sessions and add model usage, without injecting content into project sessions.

## Known Limitations and Deferred Work

- One current run per case is shared by users of the same Host, matching the source delivery. No accounts, classroom isolation or concurrent-user permissions.
- No report backflow, project creation or automatic stage advancement.
- HTTP routes require Connection's authenticated owner identity and same-origin request checks. Local binding is the default; explicit LAN access uses a concrete `--host` IP and the startup authorization URL. The retired `--lan` flag cannot disable authentication.
- Deterministic tests and scripted native integration do not establish live-model answer quality or visual acceptance.
- The user authorized this repository and student bundles to carry the runtime-allowlisted material. Original notices and font licensing remain; the integration packages stay private / UNLICENSED without a new blanket MIT license.
