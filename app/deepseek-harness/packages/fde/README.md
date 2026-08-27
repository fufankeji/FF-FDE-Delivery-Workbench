# fde/ — FDE project-domain capabilities

English | [中文](README.zh.md)

Downstream product capabilities that organize the official Harness around a real FDE delivery project. They use Workspace as the project identity and remain outside the Agent Loop.

| Package | Purpose |
|---|---|
| [`project/`](project/README.md) | Serves project delivery artifacts and Workspace-scoped OpenAPI and architecture tools. |
| [`stage/`](stage/README.md) | Initializes and reads the six-stage current progress for one Workspace project. |
| [`source/`](source/README.md) | Stores ordinary customer files in the addressed project's shared `fde-resources/` directory. |
