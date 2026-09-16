# Agent Note: Independent business discovery lab

Status: implemented

English | [中文](2026-09-16-independent-discovery-lab.zh.md)

## Problem

The supplied training product includes five case journeys, a pixel office, role-specific tools, evidence checks and reports. The workbench's existing project stages must remain independently usable. The source plugin targets a newer Harness release with UI and session APIs absent from the pinned workbench.

## Decision

The fullscreen home and Project Center cover the sidebar. Their owner now declares `fde.workbench.module.action`; the lab registers a visible launcher there and retains its sidebar launcher. All entries share the lab's own store, with no project controller dependency. Returning restores the underlying page.

A [Host plugin](../../../../packages/fde/discovery-lab/README.md) owns training routes, SQLite state and its native Agents. A [Client plugin](../../../../packages/client/ui-fde-discovery-lab/README.md) appends navigation and embeds the original, separately bundled application in a same-origin iframe. Training never registers project Workspaces or writes stage decisions. The integration adapts native event snapshots, per-session durability checkpoints, lazy empty-session recovery and plugin teardown without modifying Agent Loop.

Only the pinned runtime's authorized assets are imported into an ignored, regenerable directory. Mutable training data remains under explicit `DSH_HOME`; native logs retain their Host ownership. Global workspace tools and synthetic workspace instructions are excluded from training scopes. No model calls occur merely to open or restore training.

## Alternatives considered

**Static case files in project stages** discard the interview, grant and report experience and mix training with production decisions.

**Upgrade Harness to the delivery's newer release** expands the regression surface beyond the authorized independent module.

**Rewrite the original app into current slots** changes its UI and rendering behavior. The wrapper uses existing slots while the iframe keeps the supplied application intact.

**Start the delivery's separate LAN host or proxy** duplicates runtime and persistence ownership. The current Host already provides the needed same-origin routes.

## Consequences

Existing entry points and state remain in place; the original desktop layout and independent visual style are retained. Each Host shares one active run per case. There is no project backflow or account isolation. Assets are not checked into Git and must be imported from the authorized delivery. Real Loader, native tool denial, persistence recovery, calculations and navigation have offline tests; scripted model responses do not establish live-model quality or human visual acceptance.
