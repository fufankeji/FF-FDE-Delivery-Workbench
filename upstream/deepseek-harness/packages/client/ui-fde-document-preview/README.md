# @deepseek-ai/dsh-client-ui-fde-document-preview

English | [中文](README.zh.md)

Shared, read-only project document preview for the FDE project detail page and Better Sidebar. Office rendering uses the Apache-2.0 File Viewer packages; the plugin does not edit originals, create messages, or invoke an Agent.

## Model Experience

None, as this browser plugin only renders same-origin project files and registers no model-facing input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The first slice renders Word OpenXML, spreadsheet, and PowerPoint OpenXML families; legacy Word/PowerPoint, OCR, and audio are not preview commitments.
- The Office renderer is a larger lazy Client artifact and intentionally includes browser process/buffer/stream shims required by its spreadsheet dependency.
- Preview is read-only; source editing, deletion, version relationships, permissions, and Agent references remain outside this package.
