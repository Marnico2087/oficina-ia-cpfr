# Architecture

Agent Office is a local web interface for observing and starting Codex CLI coding tasks.

```text
Browser (127.0.0.1:5173)
  React + TypeScript + Vite
   ├─ src/views/          Studio, task history, team, settings
   ├─ src/components/     Sidebar, avatars, task cards, task dialog
   ├─ src/scene/          Three.js office / React Three Fiber
   └─ src/locales/        Translation engine, provider, 20 locale packs
            │ REST / Server-Sent Events
            ▼
Local Express API (127.0.0.1:4300)
   ├─ reads Codex CLI availability
   ├─ starts/cancels local CLI subprocesses
   ├─ streams task status and progress events
   └─ writes private .local/tasks.json (ignored)
            │
            ▼
Codex CLI → filesystem inside the selected project directory
```

## Modes and data

Demo mode creates simulated tasks in browser memory. Live mode asks the local API to launch independently managed CLI jobs. The four avatars are task slots, not a coordinated agent swarm. No agent-to-agent communication or shared memory is currently implemented.

The API is local-only, unauthenticated, and restricted to loopback host/origins. It **must not be published or proxied to the internet or a LAN**. Real CLI jobs can change files in the selected workspace. Two jobs targeting the same directory may conflict.

The browser uses the EventSource API to receive snapshots. The server stores bounded task history in `.local/tasks.json`, which can include the prompts, workspace paths, and short command output excerpts. It is intentionally private and excluded from version control.

## Directories

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Application state, API connection and task lifecycle |
| `src/components/` | Shared UI controls, task cards, avatars and display functions |
| `src/views/` | Studio, Tasks, Team, Settings screens |
| `src/scene/` | Lazily loaded interactive 3D office |
| `src/locales/` | Translations, locale metadata and language provider |
| `src/types.ts` | Agent and task data models |
| `src/index.css` | Styling and responsive layout |
| `server/index.mjs` | Local Express API and Codex process control |
| `scripts/` | Dev launcher, translation generator, validation and smoke tests |
| `public/` | Static assets |
| `docs/` | Documentation and reference screenshot |
| `.github/workflows/` | GitHub Actions checks |

## Security boundaries

The API accepts a local workspace path and starts a tool with code-execution capabilities. Only use it on a trusted machine. Confirm the selected project directory before running Live tasks. The task data file is not encrypted, so avoid inserting secrets in prompts or outputs. See [Security](../SECURITY.md).

## Known limitations

3D rendering depends on WebGL/GPU/browser drivers. The 3D scene is loaded separately; its JavaScript bundle is larger than the rest of the interface. Automatic translations can require correction by native speakers. Real Codex execution requires your own CLI authentication and follows its separate usage/approval policies.
