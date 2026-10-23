# @deepseek-ai/dsh-client-ui-fde-appearance

English | [中文](README.zh.md)

Browser presentation and local persistence for the FDE workbench's interface themes. The plugin contributes an `Interface theme` settings section with the original interface, five bundled 1920×1080 WebP skins, and a local custom-image path. A single apply-scoped controller owns the background DOM properties and one reversible `ThemeRuntime.overrideTokens()` layer, so the official light, dark, and system preferences remain independent. The AppFrame retains one translucent sidebar surface, while the stable `[data-slot='sidebar']` anchor removes the duplicate inner fill and adds backdrop blur, allowing the same skin to remain visible behind project and Session navigation.

Selecting a card or image changes only the settings preview. `Save and apply` first validates and serializes the complete value into the versioned `fde.appearance.v1` localStorage entry, then replaces the active background and tokens. Failed image processing or storage leaves the prior persisted value and active DOM untouched. Choosing the original interface or disposing the plugin removes only this package's background and token effects.

Custom PNG, JPEG, and WebP images up to 16 MiB are decoded, cover-cropped to 1920×1080 WebP, and sampled for four theme colors entirely in the browser. Neither the source nor processed image crosses an RPC, enters a Workspace, Session log, Agent request, or observability backend. Clearing site data removes this personal preference.

The settings page uses the native 20/28 heading and 13/20 description scale, light card borders and stable hover feedback; the image preview and saved preference format remain unchanged.

## Model Experience

None, as the package registers no message, prompt, schema, tool, request context, or Host call.

#### KV Cache effect

None; no provider request is assembled or changed.

## Known Limitations and Deferred Work

- Theme choices are local to one browser Origin; marketplace downloads, cross-device synchronization, team sharing, and project-scoped themes are not provided.
- localStorage quota differs by browser. Processed custom images above the package's safe serialized-size limit are rejected while the current theme remains active.
