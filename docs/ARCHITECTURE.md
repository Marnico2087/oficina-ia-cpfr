# Architecture

Agent Office is a local web interface for starting and observing local coding-agent CLI tasks.

```text
Browser / VS Code Simple Browser (local port)
  React + TypeScript + Vite
   ├─ src/views/          Studio, task history, team, settings
   ├─ src/components/     Sidebar, avatars, task cards, task dialog
   ├─ src/scene/          Three.js office / React Three Fiber
   └─ src/locales/        Translation engine, provider, 20 locale packs
            │ REST / Server-Sent Events
            ▼
Local Express API (127.0.0.1:4300, or a CLI-selected port)
   ├─ discovers Codex CLI, Claude Code and Gemini CLI at startup
   ├─ starts/cancels local CLI subprocesses
   ├─ streams task status and progress events
   └─ writes private task history (source .local/ or user state directory)
            │
            ▼
Selected CLI → filesystem inside the selected project directory
```

## Modes and data

Demo mode creates simulated tasks in browser memory. Live mode asks the local API to launch independently managed CLI jobs. Agent profiles are user-editable task slots, not a coordinated agent swarm. No agent-to-agent communication or shared memory is currently implemented.

`server/agents.mjs` validates and persists each local roster atomically to `agents.json`, separate from task history. The REST API exposes `GET /api/state`, `POST /api/agents`, `PUT /api/agents/:id`, and `DELETE /api/agents/:id`. Updates stream over the existing SSE channel; concurrent edits are serialized before acknowledgement. Profiles start with four examples on first use but can be reduced to zero or expanded as needed. Agents cannot be deleted while they have a running task; deleted agents retain their completed history.

`src/scene/officeLayout.ts` deterministically groups every agent into one of nine functional sectors, arranges small teams close together, and grows the open-plan floor as the roster grows. `OfficeCampus.tsx` renders a continuous shared floor with differentiated team bays, contextual props and accessible circulation lanes rather than isolated rooms. The client suggests a sector from the agent's role and mission while allowing a manual override and a general fallback. With more than one agent, the camera initially fits the campus; selecting an agent zooms into their station, and the overview button restores the full view. For 3D rendering efficiency, teams over 50 prioritize the 50 nearest avatar/workstation details around the selected agent; the underlying layout, roster cards and navigation still include all agents.

The office appearance context persists theme, workstation spacing, office accent, per-department colors, avatar movement speed and ambient social toggles in browser localStorage under `agent-office-appearance-v1`. `officePreferences.ts` validates persisted values before rendering. Layout generation creates circulation strips between adjacent open bays. `officeMotion.ts` provides deterministic clear-aisle routes and an explicit standing, walking, returning, sitting, working and rising state machine. The worker approaches its chair from the side, rotates toward the monitor and remains seated during active PC work. A new task during a walk requests a safe return before sitting. Avatar world transforms drive HTML status-label projection, so labels do not drift away from their characters. Social bubbles are ambient presentation only: **there is no actual agent-to-agent messaging or multi-agent orchestration**. The API remains the source of truth for execution status.

The API is local-only, unauthenticated, and restricted to loopback host/origins. It **must not be published or proxied to the internet or a LAN**. Real CLI jobs can change files in the selected workspace. The API rejects concurrent office tasks targeting the same or nested workspace; it cannot detect writes by other apps or instances.

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
| `server/index.mjs` | Local Express API, event parser, file history and CLI process control |
| `server/providers.mjs` | CLI adapters, binary discovery and folder overlap checking |
| `bin/agent-office.mjs` | Globally installed terminal launcher with workspace selection |
| `vscode-extension/` | VS Code companion that launches CLI and opens a Simple Browser tab |
| `START-WINDOWS.cmd` | One-click Windows startup and first-run dependency installation |
| `scripts/` | Dev launcher, translation generator, validation and smoke tests |
| `public/` | Static assets |
| `docs/` | Documentation and reference screenshot |
| `.github/workflows/` | GitHub Actions checks |

## Security boundaries

The API accepts a local workspace path and starts a tool with code-execution capabilities. Only use it on a trusted machine. Confirm the selected project directory before running Live tasks. The task data file is not encrypted, so avoid inserting secrets in prompts or outputs. See [Security](../SECURITY.md).

## Known limitations

3D rendering depends on WebGL/GPU/browser drivers, and the first visit still downloads the 3D engine. Automatic translations can require correction by native speakers. Real execution requires CLI authentication and follows its separate usage/approval policies. The integration launches fresh CLI processes; existing chats in Codex, Claude, Gemini or Codex Web GPT are not tracked. Gemini and Claude compatibility can vary with CLI updates.
