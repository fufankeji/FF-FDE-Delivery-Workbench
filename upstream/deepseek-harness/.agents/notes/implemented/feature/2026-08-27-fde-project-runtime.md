# Agent Note: Agent-driven FDE project runtime and embedded preview

Status: implemented

English | [中文](2026-08-27-fde-project-runtime.zh.md)

## Problem

The [project development docs](2026-08-27-fde-project-development-docs.md) make implementation work visible, but they do not run the delivered product. An FDE otherwise has to leave the workbench, infer a command, find a port, manage a process, and remember which browser page and terminal belong to which project. A generic “run” command would be dishonest because projects use different stacks and the only project-owned start instructions may be in `AGENTS.md` and files it references.

API Docs has the same boundary. Reaching the development stage does not prove that a server is running or that a real OpenAPI source exists. Showing that page early turns a planned capability into a false runtime fact. This note partially refines the stage-only view availability in the [project delivery pages](2026-08-26-project-delivery-pages.md); it does not move project lifecycle ownership into Better Sidebar.

## Decision

`@deepseek-ai/dsh-fde-project` owns one bounded `.fde/project-runtime.json` record per registered Workspace. A trusted same-origin start or stop route creates an exact `runtime_<uuid>` operation with a monotonic revision, initiating Session, action, and transitional state. Only that Session may settle the operation through the stable `project_runtime_report` tool. The Host rejects stale operation ids, invalid transitions, cross-Session reports, credentialed or non-loopback URLs, and OpenAPI paths outside the registered project.

`@deepseek-ai/dsh-client-ui-fde-project` adds one compact runtime control to the existing Session header from the development stage onward. Start first selects the current Session's Chat view, then enables the pinned Better Sidebar terminal and Browser capabilities through its persisted settings route, without enabling Side Chat, Subagent, or the bottom workbench. It creates the Host operation and queues a visible user instruction in the current project Session. The instruction tells the Agent to read project `AGENTS.md`, follow only real referenced run instructions, use the persistent terminal tools, validate readiness, report either verified facts or a concrete blocker, and then explain the result and next step in the normal conversation. The header remains a status summary and recovery surface; it never owns or replaces the central content. Failure to queue the visible instruction settles the pending Host operation instead of leaving a false indefinite start.

A start-side `blocked` report is recoverable rather than permanently terminal. The same initiating Session may settle the same current operation as `running` after the missing prerequisite is supplied and a valid loopback preview is verified; stale operation ids, another Session, blocked stops, and invalid URLs remain rejected. The header polls transitional states quickly and a blocked start at a lower frequency. On the first observed transition of that operation from `starting` or `blocked` to `running`, it opens the embedded project Browser once. The same snapshot simultaneously re-evaluates API Docs visibility, so a verified OpenAPI source appears without a second start or page refresh.

The header registration captures the Better Sidebar instance from the scoped context supplied by `ctx.inject(['betterSidebar'], ...)`. Runtime callbacks never read that service later from the plugin's parent context; doing so registers the UI successfully but fails only when the user clicks Start Project.

The Agent creates or reuses a persistent terminal titled “项目运行”. Starting, running, stopping, blocked, and previously stopped states expose that retained terminal where meaningful. Stop is sent to the original running Session, uses `terminal_signal(SIGINT)` plus terminal observation, and explicitly forbids broad `pkill` or `killall` and `terminal_close`. A confirmed stop clears preview and API runtime facts but retains the terminal title and transcript. An unresolved stop remains blocked and can only retry stop; it cannot start a duplicate server.

Open Project uses Better Sidebar's public `openTab` Browser surface. Before opening, the client adds only the verified preview's exact loopback `host:port` authority to `browserAllowedLoopback`. It never launches the operating-system browser. The API Docs conversation view keeps its development-stage floor but is registered only when the current snapshot is `running`, API docs are configured, and an OpenAPI source is present. Explicit `.fde/api-docs.json` remains valid, while a running Agent report may supply a verified OpenAPI URL or project-relative source.

## Verification

[`project-runtime.spec.ts`](../../../../packages/fde/project/tests/project-runtime.spec.ts) covers exact operation ownership, loopback enforcement, OpenAPI projection, retained terminal identity, blocked-start recovery, blocked-stop retry, duplicate-start prevention, and queue-failure recovery. [`project-runtime-header.client.spec.tsx`](../../../../packages/client/ui-fde-project/tests/project-runtime-header.client.spec.tsx) covers the visible start action, blocked-start polling, one-shot automatic Browser opening, and unresolved-stop controls. The apply integration test invokes Start Project through the registered header injection and proves that the scoped Better Sidebar instance opens the project explorer before the Agent instruction is queued. The controller and view-availability suites pin same-origin route bodies and the running-plus-OpenAPI API Docs gate.

The apply integration test also pins the blocked-path presentation contract: Start selects Chat and opens the current Session before the visible instruction is queued, and that instruction requires a normal Chinese reply after the runtime report. The scoped Host and Client TypeScript projects compile with `--noEmit`, the client package bundles, and the directly affected test selection passes. Browser automation is intentionally not part of this slice; manual use must still prove the target project's own `AGENTS.md`, native PTY availability, command, readiness URL, and rendered application.

## Alternatives considered

**Hard-code package-manager commands and ports in the workbench.** Rejected because the workbench is project-agnostic and would turn one sample stack into a false product contract.

**Let a button call a shell route directly.** Rejected because a generic Host route cannot interpret project instructions, repair common start failures, or explain an unstartable checkout through the existing visible Agent collaboration.

**Use ordinary Bash background jobs.** Rejected because the user cannot reliably observe, interrupt, or revisit them from the workbench. The pinned terminal tools already provide Session ownership, retained output, signalling, and a visible tab.

**Open the preview in the operating-system browser.** Rejected because it breaks the one-workbench delivery flow and loses the project/Session association. The embedded Browser already enforces a loopback allowlist.

**Show API Docs as soon as development starts.** Rejected because stage state proves workflow position, not runtime or OpenAPI availability.

## Consequences

An FDE can start, observe, open, and stop a real project without leaving the project delivery surface, while commands and ports remain owned by that project's instructions. A project that cannot start stays in the ordinary Agent conversation instead of presenting an empty central surface, so the same collaboration can continue immediately. Runtime success is an explicit, recoverable Workspace fact instead of an inference from an Agent reply. The same fact prevents API Docs from appearing before it can be useful.

The flow depends on the pinned Better Sidebar Host having native PTY support and a mounted settings service. Runtime records do not supervise processes after a Harness crash, probe arbitrary remote deployments, infer Docker topology, or guarantee that a service remains healthy after its last verified report. Such cases stay blocked or stale and require an explicit new operation rather than hidden retries.
