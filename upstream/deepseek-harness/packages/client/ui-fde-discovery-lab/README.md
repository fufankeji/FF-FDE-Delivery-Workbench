# @deepseek-ai/dsh-client-ui-fde-discovery-lab

English | [中文](README.zh.md)

Contributes the training page through `fde.workbench.lab.page` and a read-only overview summary through `fde.workbench.lab.summary`. The introduction homepage has no separate lab shortcut. The platform navigation owns the Lab entry and retains the project-sidebar shortcut. No project is required. “返回原工作面” restores the previous platform page without changing project/session selection.

The React/Pixi application is built into `lib/app/` by the package `bundle` command, including when invoked through the root Client build. The [Host plugin](../../fde/discovery-lab/README.md) serves it at `/fde-discovery-lab/`. A same-origin iframe isolates its CSS, React runtime and rendering lifecycle. Its wrapper mirrors an explicit allowlist of display-only theme variables and light/dark state on load and shell changes; it does not copy credentials, application data or the background image, and never reloads training for a theme change. Observers and the load listener leave with the frame. No extra server or proxy is started.

## Model Experience

The overview summary renders two compact metrics and a Lab card into the owner's numeric grid tracks, coordinating the same typography and narrow-screen breakpoints without sharing package-local CSS Module area names. It reads the case catalog once per mount or explicit retry; the card reuses those values. Existing training appears only when `currentRunId` is present, and its action opens the same independent lab without creating a run. Native styling covers the lobby, training controls, material readers and report surfaces while preserving case artwork and the pixel office.

The wrapper adds no prompt, tool or model call. The framed application's explicit interview, evaluation and report actions use the Host plugin's training Agents and may incur provider charges.

#### KV Cache effect

None from the navigation wrapper. Native training conversations and helper usage belong to the Host plugin.

## Known Limitations and Deferred Work

- The source application's desktop layout retains a 1000 px minimum width and horizontal scrolling on narrow screens; this is not a mobile redesign.
- Standalone lab pages retain their own styling; workbench embedding follows shell theme colors without redrawing pixel scenes or copying wallpaper.
- Module switching hides but preserves the iframe after its first visit, including transient training input. Browser refresh, plugin disposal, or explicit retry after a loading failure recreates it; persisted records are restored from the Host.
- Live-model quality and the original pixel-office experience require human acceptance.
- Source provenance and private redistribution boundary are documented in the [source record](../../fde/discovery-lab/SOURCE.md).
