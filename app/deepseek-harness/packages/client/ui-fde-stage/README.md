# @deepseek-ai/dsh-client-ui-fde-stage

English | [中文](README.zh.md)

Browser presentation for one Workspace project's six-stage FDE progress. One apply-scoped Host-backed observable is shared by two contextual Conversation contributions: a compact stage-and-action row above the blank composer and a current-stage label in the active Session header. The blank row reads the Conversation's shared card-width and side-clearance variables, so its outer edges stay aligned with the composer rather than with the wider Slot container. Its explicit Project Progress action publishes the current Workspace id for `ui-fde-project` to open that project's detail; full stage flow, inputs, outputs, and gates stay off the work entry. Session ownership resolves only through the Workspace list's `sessionIds`; cwd and recent-project fallbacks are forbidden.

This package exposes no stage-completion or advance action. After another authorized FDE surface commits a stage gate, a Workspace-scoped browser invalidation makes both contextual contributions re-read the durable Host value; it does not carry or invent the new stage itself. A failed Host read remains a visible retry state instead of falling back to another project's cache.

## Model Experience

None, as the package renders project state in the browser and registers no message, prompt, schema, tool, or request context.

#### KV Cache effect

None; no provider request is assembled or changed.

## Known Limitations and Deferred Work

- Detailed inputs, artifacts, blockers, and two-step confirmations belong to `ui-fde-project`; transition history remains deferred.
