# Agent Note: Standard platform Skill files

Status: implemented

English | [中文](2026-09-18-standard-platform-skills.zh.md)

## Problem

Short runtime adaptations omit useful methods; a separate complete-original browser snapshot fixes downloads but leaves the Agent using different instructions. The operator requires complete Chinese platform Skills, direct file loading, and a simple name-and-content reader.

## Decision

Seven maintained SKILL.md packages under fde/stage/skills own platform names, descriptions, complete workflows and required resources. The native FileSystemSkillProvider reads only that fixed directory and returns current file bodies with their resource base. A fixed rank of 250 preserves the previous project/runtime/user ordering. The seven hardcoded runtime definitions and independent browser snapshot are retired; other stages and course originals retain their existing mechanisms.

The trusted stage catalog reads the same packages for display and download, including shared-rule dependencies and byte hashes. Shared persistence rules remain in one referenced file. The reader exposes the name and body, follows packaged references and offers a return action without a directory tree or upstream details. Downloads retain necessary licensing and do not duplicate the outer Skill directory. Historical Session tool results are not rewritten.

## Alternatives considered

**Keep short inline instructions.** A name and attribution link cannot replace complete operational guidance.

**Keep complete original snapshots beside the adaptations.** This preserves original bytes but creates two maintained instruction sources and does not standardize actual execution. Original research copies remain available for maintenance and licensing, not runtime loading.

**Run untranslated upstream packages unchanged.** Their output paths, installation commands and authority assumptions differ from the platform. Chinese platform maintenance preserves substantive methods while applying the existing evidence, output and human-decision rules.

## Consequences

Platform Skill edits reach both new native loads and catalog reads without rebuilding an instruction snapshot. Loading is not a new execution permission, and course material is not automatically registered. Runtime, catalog and archive checks compare actual file contents; disposal removes all seven provider contributions. Skill-creator validation and an independent simulated procurement case cover structure and decision guidance, but do not claim real-provider business acceptance. Existing browser appearance remains a manual check.
