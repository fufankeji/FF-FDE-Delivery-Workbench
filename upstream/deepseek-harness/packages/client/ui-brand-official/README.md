# @deepseek-ai/dsh-client-ui-brand-official

English | [中文](README.zh.md)

This downstream package fills `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark` with the FF-FDE product identity in every build profile. Both marks render the unmodified `/ff-brand/ff-logo.png` asset with the same 20% presentation radius, while the sidebar name renders the exact `FF-FDE工作台` product copy. Occupying the sidebar name slot also removes the shell fallback's `DSH Local Build` and commit badge without changing the sidebar shell.

The three occupants install as one declaration-aware registration set through nested `slots.inject()` calls. The package therefore works whether its row activates before or after the sidebar and conversation declarers, withdraws all occupants when either declaration collapses, and leaves no partial brand mix during HMR. It retains no runtime state. The node half is an empty Loader seat, and the browser title remains a build-environment concern outside this package.

## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The package supplies one FF-FDE occupant set** — alternative presentation belongs in another Cordis package occupying the same slots.
- **The browser title is independent** — `DSH_CLIENT_TITLE` selects title text at build time rather than through a UI slot.
