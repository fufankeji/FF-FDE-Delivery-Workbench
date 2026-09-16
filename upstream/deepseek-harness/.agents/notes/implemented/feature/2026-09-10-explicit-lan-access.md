# Agent Note: Explicit LAN access for the FDE workbench

Status: implemented

English | [中文](2026-09-10-explicit-lan-access.zh.md)

## Decision

The downstream Web startup accepts `--lan` as explicit operator consent to unauthenticated network access. Local-only startup remains the default; all-interface `--host` without consent and conflicting flags fail before listening. Operators must use trusted networks without public forwarding because reachable clients can operate Agent tools and project files. This is not a multi-user authorization system.

FDE project, stage, source, Semantica and usage routes use Connection's `createWebRequestTrust` to capture local IPv4 addresses and the actual port when the server binds all interfaces. They retain the original Host, Origin and Fetch-Metadata checks. Ordinary RPC and WebSocket channels use the existing WebRuntime LAN trust. Settings, credentials and native-desktop RPC restrictions remain loopback-only; independent project preview listeners remain local.

## Alternatives and consequences

Changing only the listen address would leave project routes returning 403. Globally accepting arbitrary hosts or changing the empty trust list would weaken unrelated privileged methods. A login system is outside this explicitly requested trusted-LAN mode. No business data or project-specific IP is embedded in the implementation.

## Verification

LAN HTTP does not expose secure-context `crypto.randomUUID`. The browser WebApiClient overrides the existing correlation-ID extension point with Connection's `getRandomValues` UUID helper, also used by generic RPC, so readiness and Workspace reads work without changing the core API. The homepage distinguishes an unloaded baseline from zero projects. A raw HTTP 200 or WebSocket handshake alone does not verify browser-generated requests; the served Client bundle is also exercised with `randomUUID` absent against the real LAN server.

The theme bootstrap embeds the non-sensitive Host preference in `data-dsh-theme-preference`; ThemeRuntime adopts it before resolving the OS scheme. Remote settings stay in memory, but their initially empty value cannot reset the accepted Host theme to `system`. Later local Host snapshots and explicit user selections remain authoritative. This preserves the existing page palettes rather than adding per-page contrast overrides or exposing privileged settings remotely.

The real Loader startup tests cover opt-in and conflicting flags. Connection tests cover exact local IP and port, local-only defaults, untrusted hosts and origins, and privileged RPC restrictions. The running 3080 service is checked through its LAN address for project reads and both WebSocket streams; no model invocation or project transition is needed.
