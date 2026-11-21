# @deepseek-ai/dsh-client-ui-fde-sources

English | [中文](README.zh.md)

FDE project-source intake surface. It contributes one compact “Add project files” action to each real project row, sends the selected files as one Workspace-addressed batch, reports the durable Host result, refreshes project/source views, and starts model-free local conversion for newly saved supported documents. The action has no Conversation, Session, or Agent dependency and never changes the composer draft.

The root-scoped `fde.project.resources.upload` Component Factory accepts `workspaceId` and `path` and renders a labeled page action using the same intake control. It needs no selected Session or mounted sidebar. Page instances open their own picker directly and do not listen for the sidebar's upload-open event; successful writes emit the existing project-source refresh signal. The native composer action remains available for project-owned Sessions.

## Model Experience

None, as the surface performs project persistence only and registers no message, prompt, schema, or tool.

#### KV Cache effect

None; no provider request is assembled or changed.

## Known Limitations and Deferred Work

- Source listing, status, and preview live in Project Details and Better Sidebar; this package intentionally owns only intake and refresh signaling.
- Drag/drop, deletion, source versions, OCR, and conversation-reference UI remain deferred.
- Uploads always address a registered project; the ungrouped Session bucket has no project resource action.
