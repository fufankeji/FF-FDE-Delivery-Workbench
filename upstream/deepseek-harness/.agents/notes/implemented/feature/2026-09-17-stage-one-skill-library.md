# Agent Note: Read-only stage-one Skill library

Status: implemented

English | [中文](2026-09-17-stage-one-skill-library.zh.md)

## Problem

The platform Skills entry needs readable, downloadable methods without changing project execution or presenting external references as included files.

## Decision

The library derives seven packages from the existing fixed stage catalog. The reader and ZIP encoder share each file string, retain pinned source notices and licenses, and label the content as a workbench adaptation. Viewing and downloading do not enumerate user directories or invoke an agent. The existing stage method dialog and automatic selection remain unchanged.

## Alternatives considered

**A second authored Skill directory** would let downloads drift from the methods registered by the Host. The library instead derives its files from the same read-only catalog.

**Bundling upstream references** would imply that linked templates and scripts were reviewed and included. The reader keeps those references as external links and lists only its actual package files.

## Consequences

The exported text preserves workbench paths and collaborator dependencies; it is not a promise of installation or execution compatibility elsewhere. Focused tests cover the seven real methods, ZIP/file equality, search, recovery, reading and return state. Browser visual acceptance remains manual under the product repository's rules.
