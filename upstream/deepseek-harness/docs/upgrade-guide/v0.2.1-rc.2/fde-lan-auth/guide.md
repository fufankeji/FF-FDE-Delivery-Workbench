---
kind: upgrade-guide
description: The FDE Web composition retires unauthenticated --lan access and requires a specific bind IP with browser authorization.
---

# FDE LAN browser authorization

English | [中文](guide.zh.md)

## Change

The FDE downstream Web composition no longer accepts `--lan` as an unauthenticated all-interface listener. That flag now exits with a migration error before binding. `--host` accepts a specific local IP, and the Connection authenticates browser requests. FDE project, stage, source, semantic and training HTTP routes require an authenticated owner; a limited API identity does not grant access to them.

## Migration

1. Keep your existing `DSH_HOME` explicit. During the Harness upgrade, use the isolated validation copy before opening original Session data with the new release.
2. Replace `--lan` with `--host <local-LAN-IP>`. For example, from the FDE checkout's `upstream/deepseek-harness` directory, run `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 192.168.1.20 --port 3080`, substituting an IP assigned to your machine.
3. Open the authorization URL printed by that process on each permitted device. Treat the URL as a credential. Opening the bare IP before authorization is expected to return an authentication error.
4. Confirm the authenticated workbench and project APIs load. An unauthenticated or cross-origin request must remain refused. Do not restore `browserAuthentication: false`, use a wildcard bind, or expose this local deployment to the public Internet.
