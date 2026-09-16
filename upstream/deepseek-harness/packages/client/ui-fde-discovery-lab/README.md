# @deepseek-ai/dsh-client-ui-fde-discovery-lab

English | [中文](README.zh.md)

Adds “业务挖掘实验室” to the homepage navigation and the top of the fullscreen project center through `fde.workbench.module.action`, while retaining the sidebar action. No project is required. The full-page training frame offers “返回工作台”. Navigation is held in one plugin-owned store; opening and closing the page never reads or writes project/session selection.

The original React/Pixi application is built into `lib/app/` by the package `bundle` command, including when invoked through the root Client build. The [Host plugin](../../fde/discovery-lab/README.md) serves it at `/fde-discovery-lab/`. A same-origin iframe isolates its CSS, React runtime and rendering lifecycle from workbench UI. No extra server or proxy is started.

## Model Experience

The wrapper adds no prompt, tool or model call. The framed application's explicit interview, evaluation and report actions use the Host plugin's training Agents and may incur provider charges.

#### KV Cache effect

None from the navigation wrapper. Native training conversations and helper usage belong to the Host plugin.

## Known Limitations and Deferred Work

- The source application's desktop layout retains a 1000 px minimum width and horizontal scrolling on narrow screens; this is not a mobile redesign.
- The original application styling remains independent of workbench skins.
- Returning removes the iframe, not backend training records or an ongoing interview. Reopening restores records from the Host.
- Live-model quality and the original pixel-office experience require human acceptance.
- Source provenance and private redistribution boundary are documented in the [source record](../../fde/discovery-lab/SOURCE.md).
