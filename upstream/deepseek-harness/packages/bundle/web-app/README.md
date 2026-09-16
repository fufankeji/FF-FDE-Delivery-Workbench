---
description: "The browser GUI for dsh: interactive chat, model and settings management, and session history, for users running the dsh web surface."
kind: "package-bundle"
---

# @deepseek-ai/dsh-web-app

English | [中文](README.zh.md)

The dsh browser-surface bundle. [`cordis.patch.yml`](cordis.patch.yml) rides over [`dsh-base`](../base/README.md): it sets the coding persona, inserts the Web host rows (webserver, API gateway, workspace, projection cache, storage) and the browser plugin roster, the always-on client-plugin reload chain ([`dsh-client-hmr`](../../client/hmr/README.md), idle until a rebuild watcher rewrites client bundles), and mounts this package's `web-runtime` glue plugin (config `{openBrowser, printUrl, surfaceContext, trustedHosts}`). That plugin resolves the built frontend dist through `@deepseek-ai/dsh-web-frontend`'s exports, samples bind-dependent LAN trust once, provides it as `webRuntime` to the browser-trust fence and client roster, mounts the [`frontend-static`](../../host/frontend-static/README.md) fallback owner, and registers the harness-source and web-surface prompt sections plus the bash-visible `DSH_WEB_URL` runtime variable when `surfaceContext` is true. After its Loader tree settles, it prints the `dsh web:` URL line when `printUrl` is true and opens the canonical host URL in the default browser when `openBrowser` is true and the inherited `SSH_CONNECTION` and `SSH_TTY` are blank or absent. An SSH launch keeps the URL line but suppresses browser handoff because the SSH client or editor owns the local forwarded address. Immediately before a handoff, the runtime prints `dsh web: opening the default browser; pass --no-open to disable`. A short-lived Node helper runs the maintained platform opener with the canonical scrubbed child environment. On Windows it stays alive until the short-lived PowerShell launcher exits, because `open` reports spawn before that launcher has handed the URL to the shell; elsewhere the helper stops after the opener accepts spawn. A helper failure writes a diagnostic with its reason and the manual URL to stderr without stopping the server, and no path waits for the browser to exit. This bundle also owns the app command line: the ordinary `web-startup` provider ([`src/startup.ts`](src/startup.ts)) injects `ctx.cmdlineArgs` ([`dsh-cmdline`](../../boot/cmdline/README.md)), parses `--host`, `--port`, repeatable `--trusted-host`, `--no-open`, and the app's `--help`, then provides `webStartup`; browser opening defaults on for local launches, and `--no-open` turns it off for this invocation. `--lan` explicitly enables all-interface binding for trusted LAN devices without authentication; `--host 0.0.0.0` without this opt-in remains rejected, and conflicting host flags fail before binding. Flag-configured rows inject the service and read it directly from lazy config, so nothing binds a port before argument resolution and `dsh --profile web --help` starts no server. [`dsh-headless`](../headless/README.md) is a sibling surface over the same base and does not mount this bundle.

This downstream FDE profile pins the official browse directory-picker Host backend and Client surface. Structured project creation needs both in-app parent selection and `host.createDirectory`; the local native chooser supplies selection only and therefore cannot satisfy that flow.

The same downstream profile mounts `fde-source` and `ui-fde-sources`: every real project row can persist one bounded file batch into that Workspace's visible `fde-resources/` directory. This action is project storage only and does not alter a conversation draft or start an Agent turn.

It also mounts `fde-stage` and `ui-fde-stage`: one Workspace-scoped record starts at requirements research, blank Sessions show a compact current-stage prompt, and active Session headers show the current stage. The current slice is read-only and provides no stage transition action.

`ui-fde-appearance` contributes the Interface Theme settings page over the official ThemeRuntime. The original interface, five bundled WebP skins, and browser-local custom images remain independent from light/dark preference and never enter a Workspace, Session, Agent request, or Host RPC.

`fde-project` and `ui-fde-project` add the separate global Project Progress page and the project-level API Docs, System Architecture, Observability, and Evaluation views. From project development onward, an explicit header action records one Workspace-scoped start/stop operation, queues a visible instruction in the exact project Session, and accepts only that Session's `project_runtime_report`. The Agent reads project `AGENTS.md`, uses a persistent terminal, verifies the real loopback preview, and reports blockers instead of simulated success. API Docs appears only while the project is running with a real OpenAPI source. Project OpenAPI tools reuse the locked `dsh-openapi` parser and request implementation while resolving configuration from the calling Agent's registered Workspace. Architecture candidates use exact revisions and atomic replacement, and confirmation never advances the delivery stage. `dsh-observe@0.2.0` is mounted disabled with no backend, so local summaries work without capture or outbound traffic. The fixed `dsh-eval-harness@2f59376` tools run only after the user explicitly submits an evaluation from the page, and a Host pre-execution guard confines their paths and executable/profile choices to the current project policy.

The FDE profile also pins `dsh-better-sidebar@0.16.1` and `dsh-file-review-tab@0.2.0`. The project/session browser remains on the left and the official Conversation remains in the center; a single collapsible right-side dock provides Files/Editor, Git diff, and per-session/per-turn Agent file review. The FDE patch disables the bottom workbench and unrelated Browser, Side Chat, Subagent, and Terminal pages by default. An explicit project start enables only the persistent terminal and embedded Browser capabilities required by that flow, and admits only the verified preview's exact loopback authority. Stop retains the terminal transcript; Open Project stays inside the right dock rather than handing off to the operating-system browser. Git diff remains distinct from Agent-attributed review, and the dock host clips overflow without becoming a scroll container so direct File Review navigation cannot move the entire dock off the viewport.
## Summary

Run `dsh --profile web` to open an interactive browser GUI with chat, model and settings management, and session history. It uses the same model access, tools, and safety defaults as other dsh surfaces. Startup prints an authenticated URL and normally opens it in the default browser; SSH sessions and `--no-open` leave the URL for manual opening. You can change the port and allow extra hosts, but cannot bind all network interfaces. Choose this package for interactive browser work; use `dsh-headless` for one-shot command-line tasks.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Start the GUI, open your browser, and start talking to the agent. The flags fine-tune the invocation.

### Starting the Web GUI

```sh
dsh --profile web
dsh --profile web --no-open --port 8080
```

After startup you see a `dsh web:` line whose root URL carries a fresh process token. Unless `--no-open` or an SSH session suppresses it, the default browser opens that URL, receives a signed cookie, and redirects to the clean root page. You know it worked when the page loads and you can chat with the agent. Two failures to expect: if the frontend is not built, startup stops with a build hint (`pnpm run build` in a checkout); if the browser cannot be opened, a credential-free diagnostic prints to stderr while the server keeps running — open the printed startup URL yourself.

**Settings → Models** displays **DeepSeek**, using `DEEPSEEK_API_KEY`. The default is `deepseek-official` / `deepseek-flash` (DeepSeek-V41-Flash). The [DeepSeek plugin](../../llm/llm-deepseek/README.md#choose-a-protocol) defaults to Messages; set `protocol: chat-completions` in Cordis YAML to select Chat Completions. Web has no protocol selector.

Saved model selections override the composition default. Both protocols share `deepseek-official` and `llm-deepseek` settings, so switching preserves model selections and credential references. Endpoint overrides retain their values; the settings card lets users supply a compatible API address.

### Configuration

Most users never set these; the command-line flags feed the four settings below — `--host`, `--port`, and `--trusted-host` come from the invocation, and `--no-open` turns the browser handoff off for that invocation:

| Field | Default | Meaning |
|---|---|---|
| `openBrowser` | `true` | Open the default browser after startup; SSH launches suppress it |
| `printUrl` | `true` | Print the `dsh web:` URL line at startup |
| `surfaceContext` | `true` | Give the agent GUI-orientation context and expose `DSH_WEB_URL` to its shell commands |
| `trustedHosts` | `[]` | Extra hosts allowed to reach the GUI from the network |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-web-app) is the exhaustive source for every accepted field and its JSDoc.

### LAN access and trusted hosts

By default the GUI accepts connections from this machine only. A deployment that binds all network interfaces also allows browsers from the LAN, and the printed URL then includes a LAN address; `--trusted-host` adds extra hosts in either case. Host and Origin checks control reachability, while the token exchange authenticates every Host API method and WebSocket stream. The LAN addresses are sampled once at startup, so a network change later is not picked up — restart the GUI to re-advertise.

### Running over SSH

When you launch `dsh --profile web` over SSH, the URL line still prints but the browser is not opened for you: the SSH client or editor owns the local forwarding address. Open the forwarded URL on your machine yourself; the printed URL names the remote host's loopback endpoint.

### Per-session agent setup

Each browser session composes its own agent from the shipped presets (the `standard` preset by default), instead of sharing one process-wide tool set. You can change the default preset or add your own presets under `$DSH_HOME/.agent-presets`.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The bundle is one patch plus one runtime glue plugin. The storage stack and projection cache come from `dsh-base`; the web overlay's workspace and message-feedback rows consume that shared `storageDomain` service. The patch restates the surface-specific values the base deliberately omits, inserts the web-only host rows and browser roster, then moves the agent plane behind presets. The glue plugin owns dist serving, trust sampling, prompt sections, the bash variable, and the readiness announcements.

### Patch semantics

A patch replaces the targeted row's whole `config`, so each web row restates every key it owns: the persona prefix and suffix templates, the `DSH_TOOLS_MODE` PTC mode opt-in, and the `session-query-sqlite` values on the base rows, then `insert` adds the web host rows, transport, and browser roster. The per-agent tool rows the base mounts process-wide are disabled here and the preset roster takes over; the reasoning for each host-plane versus preset-plane decision is inline in the patch.

### Readiness

The URL line and browser handoff are readiness signals: supervisors RPC as soon as they observe the line, and a browser requests the page as soon as it opens, so both run only after the Loader tree settles, the required-startup audit passes, and Connection authentication is available — or immediately in a hand-built tree without a Loader. Optional plugin failures do not suppress readiness; a required startup failure or a tree disposed mid-boot announces nothing.

### LAN trust sampling

`resolveLanTrust` samples the network once at boot: a loopback bind (`127.0.0.1`) derives no LAN addresses, while an all-interfaces bind adds every non-internal IPv4 literal. The derived literals plus the explicit `--trusted-host` authorities form the `/api` browser-trust fence, and the printed LAN URL always matches that fence.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | The `web-app` glue plugin: dist resolution, LAN trust sampling, prompt sections, bash variable, URL line, browser handoff |
| [`src/startup.ts`](src/startup.ts) | The `web-startup` provider: `--host`, `--port`, `--trusted-host`, `--no-open`, `--help` |
| [`cordis.patch.yml`](cordis.patch.yml) | The web patch: restated base values, web host rows, browser roster, agent plane behind presets |
| — | No runtime invariant companion is published; every contribution (frontend-static child plugin, prompt section, bashEnv registration) is registry-disposed with the fiber, and each owning registry's package carries that relation's invariant; the package holds no mutable state of its own to audit. |
| [`tests/web-app.spec.ts`](tests/web-app.spec.ts) | Dist resolution, fallback seat, prompt sections, readiness |
| [`tests/startup.spec.ts`](tests/startup.spec.ts) | Command-line parsing over a real Loader tree |
| [`tests/trusted-hosts.spec.ts`](tests/trusted-hosts.spec.ts) | LAN-trust sampling |
| [`tests/browser-open.spec.ts`](tests/browser-open.spec.ts) | Default-browser handoff after the page is reachable |

### Invariant ownership

No invariant companion is published because every contribution — the frontend-static child plugin, the prompt sections, and the bash variable registration — is registry-disposed with the fiber, and each owning registry package carries that relation's invariant.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when you want to go deeper into the shared core, the browser reload pipeline, or the built frontend.

- [Bundle package map](../README.md) — the surfaces built on the same core.
- [dsh-base](../base/README.md) — the shared core the GUI runs on.
- [dsh-client-hmr](../../client/hmr/README.md) — how client-plugin changes reload during development.
- [frontend-static](../../host/frontend-static/README.md) — how the built frontend is served.
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-web-app) — every accepted config field and its source declaration.

-----

<a id="model-experience"></a>
## Model Experience

### Harness-source and Web-surface context

#### What the model sees

When `surfaceContext` is true, the `harness:source` section identifies the on-disk Harness implementation without claiming it is the working directory, and the `app:web-surface` global section (first-party order 10100, after reusable instructions) orients the model to the GUI: the canonical local URL, the "this page" referent, the update contract (the reload receiver is always on; no-refresh reloads additionally need the `pnpm run dev:web` watcher), and the instruction not to start replacement servers. `DSH_WEB_URL` additionally appears in the managed bash environment with its description, resolved per invocation from the live server. When it is false, neither section nor the variable is registered.

#### Token effect

One source line and one prompt paragraph per session plus two managed-environment variable lines; constant per process.

#### KV Cache effect

Source and Web sections follow first-party reusable instructions. Different checkout paths or local ports leave that preceding prefix unchanged when tools and configuration match; provider cache reuse is not guaranteed.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>


These limits tell you what to expect in unusual setups — a source checkout, SSH sessions, or strict networks. They are current package constraints, not a general browser comparison or a task backlog.

- **The frontend must be built** — a source checkout needs `pnpm run build` first; startup stops with a build hint when the dist is missing, and there is no source-serving fallback.
- **LAN addresses are sampled once at startup** — interface changes after boot are not re-advertised; the printed LAN URL always matches what was sampled.
- **Only the handoff start is observable** — the GUI reports that the browser was asked to open, not that it actually opened; a later browser exit is never reported, and the printed URL is your manual fallback.
- **SSH sessions keep the URL but skip the browser handoff** — the printed URL names the remote host's loopback endpoint; the SSH client or editor must expose and open the local forwarded address.
- **`BROWSER` overrides only come from the environment** — a discovered `.env` cannot set `BROWSER`; only an inherited value can choose the executable for the automatic handoff.
- **Binding all network interfaces is not supported** — `--host 0.0.0.0` is rejected at startup for safety; use the default loopback host.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
