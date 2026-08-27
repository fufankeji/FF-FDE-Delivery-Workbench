# @deepseek-ai/dsh-client-ui-fde-document-preview

English | [中文](README.zh.md)

Shared, read-only project document preview for FDE project inputs, fixed stage outputs, and Better Sidebar files. Office rendering uses the Apache-2.0 File Viewer packages; the plugin does not edit originals, create messages, or invoke an Agent.

Office files always use File Viewer's light document theme. This preserves the common white-page and light-sheet contrast for source-authored dark text even when the operating system or surrounding workbench uses a dark theme.

File Viewer selects its renderer from the stored filename extension. HTTP MIME values remain response and display metadata; this plugin does not pass values such as `application/vnd...` or `text/csv; charset=utf-8` into File Viewer's extension override.

PowerPoint OpenXML rendering uses the pinned File Viewer ES module Worker at the same-origin `/vendor/pptx/pptx.worker.js` URL. The Web build copies that dependency-owned file into `dist`; the generated Worker is not source-controlled.

## Model Experience

None, as this browser plugin only renders same-origin project files and registers no model-facing input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The first slice renders Word OpenXML, spreadsheet, and PowerPoint OpenXML families; legacy Word/PowerPoint, OCR, and audio are not preview commitments.
- The Office renderer is a larger lazy Client artifact and intentionally includes browser process/buffer/stream shims required by its spreadsheet dependency.
- A shell embedding this Client plugin must publish the pinned PPTX Worker at `/vendor/pptx/pptx.worker.js`; missing or non-JavaScript responses prevent slide rendering.
- Preview is read-only; source editing, deletion, version relationships, permissions, and Agent references remain outside this package.
