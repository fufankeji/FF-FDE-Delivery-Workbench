# @deepseek-ai/dsh-client-ui-sidebar

English | [中文](README.zh.md)

Sidebar shell plugin: the presentation-only brand row, layout-owned collapse control, scroll-aware region seat, and bottom-pinned Settings seat. [ui-workspace](../ui-workspace/README.md) owns every project and Session action rendered into `sidebar.workspaces`; this package neither derives its rows nor owns its view preferences. Collapse into the layout-owned 56px rail remains presentation-local. Contract: the [slot system standard](../../../.agents/notes/implemented/architecture/2026-07-22-slot-type-chain-implementation.md).

The expanded brand row renders `sidebar.brand.mark` and `sidebar.brand.name` as independent single slots, while the collapsed rail renders the same mark slot. Without occupants, the shell uses the fish mark and a `DSH Local Build` label carrying the build's 7-character `DSH_CLIENT_COMMIT_HASH` badge. The brand is not an action: clicking product identity never creates or switches a Session. A deployment package can replace either value without replacing rail geometry; declaration-aware `slots.inject()` lets such a package activate before or after the sidebar.

The shell deliberately exposes no global New Session action. Project creation, project switching, and explicitly project-scoped Session creation belong to ui-workspace, preventing an unscoped action from silently falling back to the current or recent Workspace.

`SidebarRootComponentProps` composes the layout owner share, the global `useSessions` and `useWorkspaces` hooks, the declared brand, `sidebar.workspaces`, and `sidebar.settings` child slots, plus the injected sidebar-toggle callback. There is no plugin store.

During a live collapse, the shell holds the expanded content at its current width while it fades out for 150ms. The shell toggle plus New Project and search rendered through `sidebar.workspaces` share one 150ms fade and 49px leftward translation into the 56px rail, ending with the layout's 300ms column slide; every 36px control box follows the same path to the rail's 10px left inset. The bottom-pinned `sidebar.settings` control shares the fade timing but has no horizontal translation. A page that starts collapsed renders the rail statically, and reduced-motion mode disables both transitions.

Scrollbars in the column are a pointer affordance: the shell rebinds ui-theme's [scrollbar indirection](../ui-theme/README.md) to `transparent` whenever the pointer is outside it, and keeps the thumb drawn for 2s after the pointer leaves, so a list nobody is pointing at carries no bar. The reservation that keeps rows from moving belongs to the scrolling region ([ui-workspace](../ui-workspace/README.md)), so revealing a thumb never reflows.

The foot is the `sidebar.settings` seat: the sidebar renders only the bottom-pinned layout slot and shares its column state (`wide`); ui-settings registers the trigger row and settings panel there.

The `/client` exports are the plugin body (`apply`/`inject`) plus the contract types only; SidebarRoot, the row components, and the tree derivation remain package-internal behind the slot registration.

## Model Experience

None, as the sidebar renders the browser session list; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Session state-dot rendering is owned by [ui-workspace](../ui-workspace/README.md)** — no done/error notification sources are available.
- **Workspace browser behavior is composition-owned** — grouping, ordering, search, and row state belong to [ui-workspace](../ui-workspace/README.md), not this shell.
- **"New task completed" unread marking is local viewing state** — completion-time > last-seen never reaches the host.
