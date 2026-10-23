# Agent Note: Explicit unauthenticated LAN access

Status: implemented
Archived: 2026-10-23

English | [中文](2026-09-17-explicit-lan-access.zh.md)

## Problem

The downstream `--lan` option promises direct access from trusted devices, but the shared browser-session requirement returns 401 to a new device opening the advertised IP address. The operator explicitly chooses unauthenticated LAN access instead of distributing launch tokens.

## Decision

Connection's `browserAuthentication` defaults to true. Only an explicit `--lan` invocation makes the shipped Web composition pass false, using the startup host that the CLI resolves exclusively for this flag. Bind overrides and declared trusted hosts alone do not opt out. The default [browser-session policy](../architecture/2026-08-24-browser-token-authentication.md) remains intact elsewhere.

Unauthenticated mode skips browser-session initialization and token URLs, admits trusted index/API/WebSocket requests without cookies, and retains Host, Origin and Fetch-Metadata checks. Existing credential records are neither rewritten nor removed. Returning to ordinary startup restores authentication.

## Alternatives considered

**Send a launch token to each device.** This preserves the default security policy but does not satisfy the operator's explicit request for direct IP access.

**Disable authentication globally or only bypass the index.** A global bypass changes unrelated compositions; an index-only bypass leaves RPC and real-time streams unusable. The transport owner applies one opt-in policy to all three.

## Consequences

Every accepted caller can operate the complete Host API, including settings and tool-capable Sessions. UI-only loopback restrictions do not provide an authorization tier. This mode requires a trusted network and no public port forwarding; Host/Origin checks are not caller authentication. Targeted tests retain default 401 behavior and unauthenticated-mode 403 checks; live requests cover the index, a read-only FDE route and WebSocket upgrade without credentials.
