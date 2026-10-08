# Secure Agent Runtime — Integration Contract

The app never executes project code. Builds, tests, and clones run in an external
isolated runtime (e.g. on Railway). Until it is configured, the app shows a truthful
"runtime unavailable" state and records validation runs as `UNAVAILABLE`.

## Configuration (server-only secrets)
| Secret | Purpose |
| --- | --- |
| `AGENT_RUNTIME_BASE_URL` | HTTPS base URL of the runtime |
| `AGENT_RUNTIME_SHARED_SECRET` | ≥32 chars, HMAC key shared with the runtime |

## Authentication
Every request carries:
- `X-Runtime-Timestamp`: unix seconds (reject if skew > 300 s)
- `X-Runtime-Signature`: hex HMAC-SHA256 of `${timestamp}.${METHOD}.${path}.${rawBody}`

The runtime must verify the signature with a constant-time compare and reject replays.

## Endpoints
| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/v1/workspaces` | `{ projectId, source: { type: "github", fullName, ref } \| { type: "archive", url } }` | `{ workspaceId }` |
| POST | `/v1/workspaces/{id}/sync` | `{ files: [{ path, content }] }` | `{ ok: true }` |
| POST | `/v1/workspaces/{id}/apply-patch` | `{ diff }` | `{ ok, conflicts? }` |
| POST | `/v1/workspaces/{id}/validate` | `{ jobId, commands?: string[] }` | `{ status: "PASSED"\|"FAILED"\|"ERROR", summary, output }` |
| GET | `/v1/jobs/{id}` | — | `{ status, progress, summary }` |
| POST | `/v1/jobs/{id}/cancel` | — | `{ ok: true }` |

## Runtime requirements
- One ephemeral container/VM per workspace, no host mounts, CPU/memory/time limits.
- Network egress denied by default (allow package registries only if needed).
- No access to this app's secrets; GitHub credentials, if needed for clone, are short-lived and never logged.
- Output truncated and secrets redacted before returning.
