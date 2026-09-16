# @deepseek-ai/dsh-client-ui-theme

English | [中文](README.zh.md)

Theme plugin: ThemeRuntime over the --dsw-* token base stylesheets (static scale + alias semantic layers). The service owns the live theme preference (`light`/`dark`/`system`), resolves `system` through `prefers-color-scheme`, and publishes immutable `ThemeSnapshot`s on the `theme/change` event; it never writes presentation DOM — ui-layout's presenter applies the resolved snapshot (`html { color-scheme }`, `body[data-ds-dark-theme]`, and inline alias tokens). The service starts with the Host preference embedded in the index bootstrap, or `system` when that marker is absent. A loopback browser then loads `ui-theme.preference` in the background and writes each built-in selection through the Host settings API, whose local provider stores it in `$DSH_HOME/settings.yaml` by default; pushed settings changes and reconnects refetch it, rapid selections are serialized in gesture order with namespace revisions, and a rejected latest write reloads the durable value. A remote browser starts with the same embedded preference without reading the privileged settings API; subsequent selections remain process-local. Third-party registered theme ids remain an in-process extension and do not cross the built-in settings schema; removing one never overwrites the last durable built-in preference. The [Host-backed preferences decision](../../../.agents/notes/implemented/bug-fix/2026-08-06-host-backed-web-preferences.md) owns the persistence boundary.

When the host composition includes an HTTP server, the host half injects a synchronous bootstrap immediately after the opening `<body>` tag. Each index response embeds the registered Host setting for `ui-theme.preference`, or `system` when no settings provider is present; the browser resolves `system` from the OS scheme, records the original preference in `data-dsh-theme-preference` on the document element for ThemeRuntime adoption, then sets `color-scheme` and `body[data-ds-dark-theme]` before the shell loading page renders. Compositions without an HTTP server remain unaffected, and ThemeRuntime and ui-layout remain authoritative for client state and subsequent DOM updates after the plugin tree activates.

`src/styles/` holds six sheets imported in order by ui-theme's dynamic client entry: `base.css`, `design-platform.css`, `fde-evaluation.css`, `scrollbar.css`, `gradient-shadow-text.css`, and `shiki.css`. The client bundle compiles and injects them as plugin-owned global styles, so unload and HMR remove them with ui-theme instead of leaving theme CSS in the static web shell. `scrollbar.css` is the sole consumer of the `--dsw-alias-scrollbar-*` tokens and must follow `design-platform.css`, which declares them.

`fde-evaluation.css` scopes the approved stage-five reference palette to `[data-fde-stage-workbench][data-stage='evaluation']`: opaque light surfaces and cobalt actions, plus `--dsw-alias-evaluation-*` hero/canvas roles. It does not recolor other stages or the shell; dark mode retains the base surface palette and uses the same dark hero with explicit light foreground.

The same sheet separately scopes the stage-six reference palette to `[data-delivery-workbench][data-stage='pilot']`: opaque light cards, cobalt controls and a navy-to-teal hero with light text. Dark mode preserves the base surface tokens. This does not recolor production, improvement or the application shell.

Stage seven has separate `[data-stage='production']` delivery roles: a light header, navy evidence strip, blue outlined diagrams and a pale violet review panel. Dark mode retains the base surface tokens; the production strip keeps explicit light text. Neither pilot nor improvement consumes these roles.

Stage eight scopes its navy illustrated hero, white evidence panels, cobalt navigation and amber human-review action to `[data-stage='improvement']`. The canvas is opaque in light mode; the shell and the other stages keep their own roles.

Scrollbar rebinding contract: `scrollbar.css` binds `--dsh-scrollbar-thumb` and `--dsh-scrollbar-thumb-hover` on `body` to the l1 (base-surface) tokens, and both rendering paths read that pair. An elevated surface (menu, popover, dialog) sets `--dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2)` and `--dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2)` on its own container; one rebind retints whichever path the engine took. The pair's other legal target is `transparent`, which draws no thumb at all — [ui-sidebar](../ui-sidebar/README.md) rebinds its column that way while the pointer is elsewhere. A rebind to the l1 pair is not a rebind; it restates the base-surface default. `--dsh-scrollbar-width` mirrors the WebKit bar's layout width for surfaces that align themselves beside a space-consuming bar — [ui-conversation](../ui-conversation/README.md) reads it for the overlay composer seat's `right` offset — and the scrollbar-styles spec pairs it with the mirrored rule and the consumer.

The two paths are mutually exclusive by construction. `scrollbar-width`/`scrollbar-color` sit inside `@supports not selector(::-webkit-scrollbar)` because a non-`auto` value of either makes Chromium and Safari discard every `::-webkit-scrollbar*` rule for that element, `::-webkit-scrollbar-thumb:hover` included — declaring both unconditionally leaves `--dsh-scrollbar-thumb-hover` with no rendering anywhere. Firefox therefore takes the standard properties and WebKit-based engines take the pseudo-elements, so the hover token only ever renders through the pseudo-element path. Reasoning and the measured computed values: [the scrollbar Agent Note](../../../.agents/notes/implemented/bug-fix/2026-07-28-themed-scrollbars-and-reserved-gutter.md).

`design-platform.css` also owns `--dsw-alias-graph-background`, `--dsw-alias-graph-foreground`, and `--dsw-alias-graph-accent`. The knowledge graph consumes these black/ice/cyan roles for its immersive dark canvas and readable overlays in either application theme; other workbench surfaces are unchanged.

## Model Experience

None, as the theme service manages a browser preference; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Third-party themes are an extension point, not a product** — registering one means overriding same-named alias variables; no validation exists that an override set is complete.
- **The token sheets are the sole color authority** — values absent from cssdesign (for example the design's #4176E6 tab blue) are deliberately not appended; the nearest semantic token wins. Design-owner-approved additions are the exception and enter as a static step plus a semantic alias in the same change (`--dsw-static-blue-900` / `--dsw-alias-label-primary-bluish`).
