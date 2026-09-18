# Agent Note: Complete project-creation directory interaction

Status: implemented

English | [中文](2026-09-18-project-creation-picker.zh.md)

## Problem

The FDE Web profile pins a browse Host backend but omits its Client surface. Project Center emits a creation request while WorkspaceBrowser registers its receiver only when that surface exists, so a missing composition produces no visible response. Tests that insert their own picker pair hide the shipped-profile defect.

## Decision

The Web bundle declares both browse entries. Desktop disables both inherited entries before mounting its native pair, preserving a single directory-flow owner. The Web preset fixture consumes the shipped pair without a corrective insert.

WorkspaceBrowser always receives Project Center creation requests. Its existing form reports an unavailable directory surface, disables create/location/import operations and prevents writes. When availability changes, the same form recovers without discarding the draft. The sidebar's own unavailable add control stays hidden.

## Alternatives considered

**Restore automatic selection.** Native selection does not supply the child-directory creation operation that the FDE Web form requires, and a host OS dialog is not suitable for LAN browsers.

**Insert only the Client row.** It repairs the Web roster but leaves a duplicate Client interaction under the Desktop overlay and retains silent failure when the surface is unavailable.

**Add another creation form or replace the navigation architecture.** The existing owner already manages validation, directory creation, Workspace registration and metadata. Reusing it fixes the missing behavior without introducing a second flow.

## Consequences

Fresh Web profiles need no user workaround. An earlier workaround insert must be removed on upgrade to avoid duplicate entries. Default-profile composition checks cover the Web pair and Desktop replacement; component checks cover existing creation, missing capability and recovery. The keyless preset smoke no longer supplies the missing row itself. No model call, authentication change or project-data migration is introduced.
