# @deepseek-ai/dsh-client-ui-fde-stage

English | [中文](README.zh.md)

Browser presentation for one Workspace project's six-stage FDE progress. One apply-scoped Host-backed observable is shared by two contextual Conversation contributions: a compact prompt above the blank composer and a current-stage label in the active Session header. The blank prompt reads the Conversation's shared card-width and side-clearance variables, so its outer edges stay aligned with the composer rather than with the wider Slot container. Session ownership resolves only through the Workspace list's `sessionIds`; cwd and recent-project fallbacks are forbidden. The global project-progress page belongs to `ui-fde-project`.

This package exposes no stage-completion or advance action, and a failed Host read remains a visible retry state instead of falling back to another project's cache.

## Model Experience

None, as the package renders project state in the browser and registers no message, prompt, schema, tool, or request context.

#### KV Cache effect

None; no provider request is assembled or changed.

## Known Limitations and Deferred Work

- Detailed inputs, artifacts, confirmations, completion criteria, transitions, and real-time stage updates are deferred to the corresponding stage and F005 specifications.
