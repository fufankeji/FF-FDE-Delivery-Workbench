# Agent Note: Project resource intake is project storage, not a conversation attachment

Status: implemented

English | [中文](2026-08-26-project-resource-intake.zh.md)

## Problem

The official attachment pipeline accepts raster images and makes a submitted attachment part of a Session message. Community generic-file plugins mostly preserve that conversation-first posture: they mount a paperclip in the composer, store by Session or in a global DSH directory, inject a path into the draft, expire files on a TTL, or call a model-side parser. The FDE product needs a different first action. An operator may receive customer requirements, meeting notes, system descriptions, and data samples before asking the Agent to do anything. Importing those files must establish durable project facts without manufacturing a conversation turn or silently authorizing model access.

The project already maps one FDE project to one Harness Workspace and allows several Sessions below it. A Session-keyed upload directory would therefore split one project's material across conversations, while a global attachment library would hide the files from later Workspace file-tree and editor plugins. Putting an upload control back in the composer would also tell the user that the files belong to the next message, contradicting the product distinction between “store this project material” and “use this material in the current conversation.”

## Decision

`@deepseek-ai/dsh-fde-source` owns one loopback/same-origin exact HTTP route. A multipart request addresses an explicit Workspace id; the Host resolves that id through `ctx.workspaceRegistry` and never falls back to a current Session, recent Workspace, or caller-supplied path. The whole batch is bounded before publication (defaults: 25 MiB per file, 20 files, 100 MiB of file content), staged inside the project, and then linked into the visible `<workspace>/fde-resources/` directory. Filename sanitization preserves readable Unicode while removing traversal, control, and cross-platform forbidden characters. Exclusive link publication allocates `-1`, `-2`, and later suffixes instead of replacing an existing file; an ordinary mid-publication failure unlinks every new member of that batch.

`ui-workspace` declares `sidebar.workspaces.projectActions`, a root-scoped list Slot rendered only in real project rows. Its owner props carry the exact Workspace id, title, and canonical path. `@deepseek-ai/dsh-client-ui-fde-sources` contributes the “Add project files” action to that Slot, sends one FormData batch, and reports the Host response through the shared Toast. It has no Conversation, Session, Input, Agent, parser, or credential dependency. Upload success therefore changes no draft, appends no `user/message`, starts no Agent turn, and makes no external model request.

The implementation is informed by the MIT-licensed `dsh-local-file-upload@0.1.4` source at commit `94118e7cfb0fc96ce7c9854aad0859e8e468e8d9`, particularly its readable filename sanitation, collision avoidance, and symlink refusal. The external package is not installed: its Composer placement, automatic `@path` insertion, 10 MiB base64 Remote carrier, and Session-to-cwd addressing are replaced by the current `0.1.1-rc.2` Slot, Workspace, WebServer, and browser-trust contracts.

## Alternatives considered

- **Install `HongMing-Huang/dsh-file-upload` unchanged** — rejected because its storage and client state are Session-oriented, its default TTL can remove customer material, its current UI has unresolved drag/reference failures, and text-only image handling may send a customer image to an automatically discovered external vision endpoint.
- **Install `dsh-local-file-upload` unchanged** — rejected because its paperclip lives in the composer and appends an `@.dsh-uploads/...` mention immediately. Its storage mechanics are a useful baseline, but its user intent is the opposite of project-only import.
- **Expand the official image attachment union to generic files** — rejected because generic customer documents do not share the image pipeline's validation, model modality, history rendering, and provider serialization semantics.
- **Store originals under a hidden `.fde/sources/` directory** — rejected for this slice because later VS Code and file-tree plugins should see the same authoritative files without a second resource catalog. Hidden FDE metadata and derived artifacts may still live under `.fde/`; original customer files stay visible in `fde-resources/`.

## Consequences

Every Session in one Workspace shares the same ordinary customer files, and those files survive browser refresh and Host restart because the project directory is authoritative. The upload capability can be removed from the profile without deleting already committed user files. The slot keeps FDE business behavior outside `ui-workspace` while giving later project actions the same explicit owner currency.

This is only the first F002 slice. There is no SourceId/event, project resource list, preview, parser, OCR, permission record, version relationship, delete action, drag/drop, or conversation reference yet. The multipart parser buffers one bounded request body in memory; the 100 MiB file-content cap plus a 1 MiB envelope allowance is the current resident upper bound. The route stays loopback-only until authenticated remote project upload exists. A future conversation attachment path may reuse a stored resource, but only an explicit message send may make that resource model-visible.
