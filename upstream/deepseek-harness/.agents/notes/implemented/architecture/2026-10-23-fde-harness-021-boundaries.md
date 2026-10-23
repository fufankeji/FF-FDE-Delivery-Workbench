# Agent Note: FDE authorization and terminal ownership on Harness 0.2.1

Status: implemented

English | [中文](2026-10-23-fde-harness-021-boundaries.zh.md)

## Problem

The FDE workbench must preserve project identity and human stage decisions while adapting to the new Connection and terminal APIs. The previous LAN exception admitted unauthenticated callers, and the previous Sidebar terminal tools no longer exist.

## Decision

The operator confirmed concrete-IP LAN binding with browser authorization. FDE HTTP routes consume Connection admission and require owner identity. The retired `--lan` flag refuses startup and points to `--host`; this supersedes the [historical LAN exception](../../archived/bug-fix/2026-09-17-explicit-lan-access.md).

Runtime Output reads only the Agent PTY named by the registered project's runtime record. Viewing does not activate an Agent, create a replacement terminal or accept input. Manual Terminal uses the official user-terminal service independently. Both share project files and ports; manual service changes require a new health check. Start and stop retain the existing operation-id rules, and stop retains its original Session reference until the command is queued.

File Review remains at 0.5.0 with a versioned downstream patch: strict codecs expose the current lazy factory on both Host and Client, and compatibility metadata names only the tested 0.2.1-rc.2 runtime. The global plugin compatibility check stays enabled. Sidebar, Review and Observe resolve their DSH peers to this workspace's single runtime identities.

## Alternatives considered

**Keep unauthenticated LAN access.** The operator approved removing it; retaining a separate FDE bypass would defeat the shared authorization policy.

**Let humans and the Agent type into one PTY.** This needs explicit input ownership and a handoff protocol. The operator chose independent manual terminals for this upgrade.

**Grant a version exemption to File Review.** An exemption does not fix its obsolete strict codecs. The package patch and actual registration/undo checks make the supported scope explicit.

## Consequences

Original runtime data remains untouched during upgrade validation. The isolated Session migration preserves predecessor bytes, identity, assistant text, turn and tool-call counts. Missing Host output is explicit rather than fabricated recovery. Targeted tests cover admission, read-only output, project scope, reference use, plugin registration and reversible file edits; live-model quality and final visual acceptance remain manual.
