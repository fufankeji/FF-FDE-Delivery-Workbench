# fde/ — FDE 项目领域能力

[English](README.md) | 中文

围绕真实 FDE 交付项目组织官方 Harness 的下游产品能力。它们直接使用 Workspace 作为项目身份，并保持在 Agent Loop 之外。

| Package | 作用 |
|---|---|
| [`project/`](project/README.zh.md) | 提供项目交付产物，以及按 Workspace 隔离的 OpenAPI 和系统架构工具。 |
| [`stage/`](stage/README.zh.md) | 初始化并读取一个 Workspace 项目的六阶段当前进度。 |
| [`source/`](source/README.zh.md) | 把普通客户文件保存到指定项目共享的 `fde-resources/` 目录。 |
