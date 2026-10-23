---
kind: upgrade-guide
description: FDE runtime output is read-only and manual commands use a separate official user terminal.
---

# FDE runtime and manual terminals

English | [中文](guide.zh.md)

## Change

The FDE project workspace separates read-only Runtime Output from Manual Terminal. Agent runs use the official persistent-terminal tools instead of the removed Sidebar tools. The project start/stop operation and verified preview rules remain unchanged. Host restart cannot recover a lost PTY or its old output.

## Migration

1. Use Runtime Output to inspect the recorded project's Agent process. This action never creates a replacement terminal or sends a command. Use Manual Terminal for human commands; its shell state and transcript are separate, but project files and ports are shared.
2. Custom project instructions must use `terminal_open` with `type: shell` and `name: 项目运行`, then `terminal_send`, `terminal_read`, `terminal_list` and `terminal_signal`. Replace old `terminal_create` and `terminal_wait_for` instructions. A timeout or idle prompt does not establish service health; verify the actual project before `project_runtime_report`.
3. After manual service changes, ask the Agent to recheck the real project state. Do not treat a missing output pane or an independent manual shell as confirmation that a project has stopped.
4. Keep the pinned File Review patch when installing with the lockfile. It adapts strict Host/Client codecs and declares only the tested Harness version; do not disable the global compatibility check or grant broad version exemptions.
