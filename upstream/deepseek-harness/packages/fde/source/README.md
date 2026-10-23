# @deepseek-ai/dsh-fde-source

English | [中文](README.zh.md)

Host-side FDE project source capability. A deployment-trusted same-origin multipart request addresses an explicit Harness Workspace, validates the whole batch, publishes originals into `fde-resources/`, and creates stable Source records under `.fde/sources/`. Separate same-origin routes list sources, read one verified original, and run local document-to-Markdown conversion into `.fde/derived/`.

The filename, collision, and filesystem-safety posture was informed by the MIT-licensed [`dsh-local-file-upload`](https://github.com/zhangbo1201/dsh-file-upload) source at commit `94118e7cfb0fc96ce7c9854aad0859e8e468e8d9`; this package is implemented against the pinned Harness `0.1.1-rc.2` Workspace and WebServer contracts and does not install the external plugin.

## Model Experience

None, as upload, listing, preview reads, and local conversion create no message, tool, prompt, Agent turn, or model request.

#### KV Cache effect

None; no provider request is assembled or changed.

## Known Limitations and Deferred Work

- The current defaults are 25 MiB per file, 20 files, and 100 MiB of file content per batch.
- Local conversion covers generated DOCX, XLSX, PPTX, PDF, CSV, Markdown, and text samples. OCR, audio transcription, source permissions, version relationships, deletion, and conversation references remain deferred.
- A changed original marks its derived result stale; local conversion failures retain the original.
- HTTP routes require Connection's authenticated owner identity and same-origin request checks. Local binding is the default; explicit LAN access uses a concrete `--host` IP and the startup authorization URL. The retired `--lan` flag cannot disable authentication.
