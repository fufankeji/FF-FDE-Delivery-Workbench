# Agent Note: FDE appearance stays browser-local over the official theme runtime

Status: implemented

English | [中文](2026-08-27-fde-browser-local-appearance.zh.md)

## Problem

The FDE Web profile already inherits Harness light, dark, and system preferences, but those choices do not provide the bundled image skins and local custom background available in the separate Studio application. Reusing the Studio feature unchanged would import an Electron preload bridge, update controls, and unrelated visual-model behavior into an ordinary browser profile. Storing a personal background with project data would also expose a presentation preference to Workspace, Session, Agent, and observability paths that do not need it.

The skin must remain readable across both official color schemes, survive a fixed-Origin browser refresh, and fail without replacing the user's current appearance. Plugin unload and the image-free original option must also remove only the styles this feature owns.

## Decision

`@deepseek-ai/dsh-client-ui-fde-appearance` is an independent browser Client plugin. It contributes one `settings.section` entry named “界面主题” and creates one apply-scoped `AppearanceController`. The controller owns the `body[data-fde-skin]` marker, the two `--fde-background-*` properties, and one reversible `ctx.theme.overrideTokens('fde-appearance', …)` layer; components receive its observable and actions through the slot inject face rather than accessing ctx or constructing subscriptions.

The original interface plus five 1920×1080 WebP backgrounds ship under `apps/web/public/fde-themes/` with stable identities: `official`, `whale-maid`, `cloud-cat`, `jiutian-deep-space`, `jiutian-quantum-glass`, and `jiutian-dawn-horizon`. `whale-maid` is the first-run and reset default. `official` has no image and removes the FDE token layer, while the other skins provide paired light/dark semantic-token values so changing the official color preference preserves the selected skin. AppFrame keeps one translucent `--dsw-specific-sidebar-fill`; the slot system's stable `[data-slot='sidebar']` anchor removes SidebarRoot's duplicate fill and applies backdrop blur, so the background reaches the navigation column without patching either owner.

Card selection, file selection, focus, and glass changes remain preview drafts until `Save and apply`. PNG, JPEG, and WebP source images up to 16 MiB are decoded in the browser, cover-cropped to a 1920×1080 WebP, and sampled for four theme colors. The complete built-in identity or processed custom value is serialized to `fde.appearance.v1`; a safe serialized-size limit leaves headroom under common localStorage quotas. The controller writes the complete value before applying it, so validation, encoding, policy, or quota failure retains the previous persisted snapshot, DOM background, and token layer.

No image or appearance value crosses an RPC, enters a Workspace or Session log, reaches an Agent request, or becomes observability data. Clearing browser site data intentionally clears the preference. Disposing the plugin restores the marker and inline properties that preceded it and invokes the current token disposer, leaving foreign DOM attributes and theme layers intact.

## Alternatives considered

**Install the Desktop customization plugin unchanged.** Its persistence authority is an Electron main-process `appearance.json` reached through a fixed preload bridge, and the same package owns software updates and visual enhancement. Those capabilities and trust boundaries do not exist in the ordinary Web profile.

**Add the skins as registered light/dark themes inside `ui-theme`.** A skin and a color scheme are independent choices. Registering each image as one concrete theme would multiply light/dark variants, replace the user's system preference, and put FDE-specific assets in the global theme owner.

**Persist custom images through Host settings or project files.** Host persistence would transport a personal image over RPC, while project storage would make appearance part of delivery data and Agent-visible filesystem state. Neither is needed for one fixed browser Origin.

**Apply colors independently in every FDE component.** Per-component branches would miss official and third-party pages, duplicate readability rules, and make unload incomplete. One ThemeRuntime override layer reaches every semantic-token consumer and has one disposer.

## Consequences

The Web profile gains the same six stable skin choices and local-image workflow without inheriting the Desktop shell. Light, dark, and system preferences keep their existing persistence and semantics, while the FDE skin remains a separate browser-local value. Image processing and storage failures are visible and cannot partially replace the active theme; removing the plugin restores the ordinary Harness appearance without affecting any project.

Custom images are limited by browser Canvas support and per-Origin localStorage quota, and they do not synchronize across browsers or devices. The five bundled images add about 460 KiB to the Web static payload. Focused controller, component, and real Slot-composition tests pin default/loading, explicit save, original/reset, paired tokens, invalid storage, quota failure, and effect disposal; visual judgment remains a manual product check.
