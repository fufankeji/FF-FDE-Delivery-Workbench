# dsh-openapi

**Give DeepSeek Harness a safe, structured doorway into any OpenAPI 3.x API.**

[中文说明](README.zh-CN.md) · [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

`dsh-openapi` is a native DeepSeek Harness bundle that indexes configured OpenAPI documents and adds three model-facing tools:

- `openapi_list` discovers APIs and searches operations.
- `openapi_describe` returns parameters, request bodies, servers, and responses for one operation.
- `openapi_call` validates and invokes an operation with bounded output.

It is plain ESM JavaScript, so installing from GitHub does **not** run a build or `prepare` script.

## Why this plugin

Harness already gives an agent a shell. APIs still benefit from a narrower interface: operation discovery without reading a huge spec into the model context, declared-parameter validation, environment-backed credentials, read-only defaults, SSRF checks, and response limits. This plugin provides those controls without patching the Harness agent loop.

## Install

```sh
dsh plugin --profile web add github:Degurechaff57/dsh-openapi
```

The bundle installs with an empty API catalog. Add API entries to your profile's `cordis.patch.yml`:

```yaml
- id: openapi
  config:
    apis:
      - id: petstore
        source: https://petstore3.swagger.io/api/v3/openapi.json
        baseUrl: https://petstore3.swagger.io/api/v3
        allowedMethods: [GET, HEAD]
```

Start Harness and ask:

> Use `openapi_list` to find the operation that lists pets, describe it, then call it.

For a source checkout, install the local directory instead:

```sh
dsh plugin --profile web add /absolute/path/to/dsh-openapi
```

## Credentials

Keep secrets out of YAML. Map a request header to an environment variable:

```yaml
- id: openapi
  config:
    apis:
      - id: internal-api
        source: ./openapi/internal.yml
        baseUrl: https://api.example.com/v1
        headers:
          Accept: application/json
        credentials:
          - header: Authorization
            env: INTERNAL_API_TOKEN
            prefix: 'Bearer '
        allowedMethods: [GET, HEAD, POST]
```

The credential header is applied after model-supplied header parameters, so a tool call cannot override it. Missing environment variables fail the call before network I/O.

## Configuration

Top-level options:

| Field | Default | Purpose |
|---|---:|---|
| `apis` | `[]` | Configured API documents |
| `timeoutMs` | `30000` | Per-call timeout |
| `maxSpecBytes` | `2097152` | Maximum local or remote spec size |
| `maxResponseBytes` | `262144` | Maximum response body returned to the model |
| `maxRedirects` | `3` | Redirect limit; every destination is rechecked |
| `maxOperationsPerApi` | `1000` | Catalog size limit per API |

Each `apis` entry accepts:

| Field | Default | Purpose |
|---|---:|---|
| `id` | required | Stable id used in tool calls |
| `source` | required | HTTP(S) URL, `file:` URL, absolute path, or path relative to the Harness process |
| `baseUrl` | spec server | Explicit API server override |
| `headers` | `{}` | Static non-secret headers |
| `credentials` | `[]` | Header/environment-variable mappings |
| `allowedMethods` | `[GET, HEAD]` | Methods the tool may invoke |
| `allowPrivateNetwork` | `false` | Opt in to loopback/private-network destinations |

## Security defaults

- Specs are administrator-configured; the model cannot load an arbitrary spec at runtime.
- APIs start read-only: only `GET` and `HEAD` are enabled.
- Calls accept only parameters declared by the selected operation.
- URL credentials, localhost names, private IP literals, and hostnames resolving to private IPs are blocked by default. Redirect destinations are checked again, and credentials are stripped on cross-origin redirects.
- Response bodies are capped and sensitive response headers such as `set-cookie` are not returned.
- Credential values come from the environment, override call-supplied values, and are never included in tool results.

`allowPrivateNetwork: true` is necessary for local development servers. It is an explicit trust decision, not a substitute for a network sandbox. DNS can change between validation and connection, so do not use untrusted OpenAPI documents or hostile DNS infrastructure for high-assurance isolation.

## Current scope

- OpenAPI 3.0 and 3.1 JSON/YAML
- Local `#/...` references
- Common path, query, header, and cookie serialization
- JSON and text responses

Remote `$ref` documents and specialized serialization such as `deepObject` are intentionally not followed yet. The plugin fails loudly instead of making an ambiguous request.

DeepSeek Harness is in developer preview. This release is tested against the current source CLI (`0.1.0-rc.5`) and npm prerelease (`0.1.0-rc.6`); compatibility updates will follow upstream breaking changes.

## Development

```sh
npm install
npm run check
```

The test suite covers parsing, references, catalog generation, request construction, credential precedence, method restrictions, private-network rejection, redirect validation, output truncation, and plugin registration.

## License

[MIT](LICENSE)
