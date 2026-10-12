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

The Studio execution inspector reuses task data from the same SSE snapshots. Its timeline shows the last 35 server-recorded events per task in newest-first order; phase, elapsed time, error details and token usage are derived from those snapshots. The elapsed clock runs in the browser while a task is active, and stops after the task finishes. Selecting an avatar shows its running task or most recent task; selecting a task tile/history entry inspects that specific execution. Demo events are simulated.

The 3D workstations also use those task snapshots. `src/scene/agentBehavior.ts` maps a running task phase to a character pose, or displays a celebration/error reaction for eight seconds after a completed/failed task. The scene temporarily prioritizes a recent terminal event over another running task on the same agent so that the reaction remains visible. After the reaction ends, the currently running task is shown again. Status labels are translated in the selected locale; demo mode drives the same animation system from simulated events. These gestures represent **reported task states**, not continuous observation of the agent's keyboard, reasoning or filesystem activity.

The browser uses the EventSource API to receive snapshots. The server stores bounded task history in `.local/tasks.json`, which can include the prompts, workspace paths, and short command output excerpts. It is intentionally private and excluded from version control. The browser smoke tests wait for the rendered UI rather than for a fully idle network, since the event stream is designed to stay connected.

The studio loads the 3D renderer on demand. Production builds split the Three.js engine into separately cached JavaScript chunks, reducing the size of the scene's own chunk and avoiding a full re-download of the engine after ordinary interface changes. This does not eliminate the cost of loading Three.js on the first visit.

## Directories

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Application state, API connection and task lifecycle |
| `src/components/` | Shared UI controls, task cards, avatars, execution inspector and display functions |
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

3D rendering depends on WebGL/GPU/browser drivers, and the first visit still downloads the 3D engine. Automatic translations can require correction by native speakers. Real Codex execution requires your own CLI authentication and follows its separate usage/approval policies.
