# Development and release workflow

## Requirements

Install Node.js with npm (Node 24 recommended; minimum supported by Vite: Node 20.19+ or 22.12+), a browser supporting WebGL, and optionally the [Codex CLI](https://github.com/openai/codex) for real tasks.

### Windows (PowerShell)

```powershell
git clone https://github.com/Munizada/agent-office.git
cd agent-office
npm ci
npm run dev:all
```

Then open http://127.0.0.1:5173/ . Demo mode works without a Codex account. For real execution install/login to Codex CLI, open Settings, set an absolute workspace directory and select Live mode.

### Linux and macOS

```bash
git clone https://github.com/Munizada/agent-office.git
cd agent-office
npm ci
npm run dev:all
```

CLI executable discovery uses PATH. `CODEX_BIN` may point to an executable. On Windows PowerShell, for example:

```powershell
$env:CODEX_BIN = 'C:\tools\codex.exe'
$env:AGENT_OFFICE_WORKSPACE = 'C:\projects\my-app'
$env:PORT = '4300'
npm run dev:all
```

These are optional **process environment variables**, not an automatically loaded .env file. Do not commit a local .env file or credentials. Use the default API port unless you also adjust the Vite proxy and allowed origins in the server.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev:all` | Local API + UI in one terminal |
| `npm run dev` | UI only |
| `npm run server` | API only |
| `npm run lint` | Source checks |
| `npm run build` | TypeScript and production build |
| `npm run check:server` | Server syntax check |
| `npm run check:public` | Scan tracked files for secrets and private paths |
| `npm run verify:public` | Pre-push full validation |
| `npm run smoke:browser` | Browser/WebGL and language regression tests with API + UI running |
| `npm run smoke:live` | **Executes real Codex tasks and consumes usage** |
| `npm run smoke:live-ui` | **Executes a real Codex task and consumes usage**; verifies Live mode from the browser to the final file |

For browser smoke tests, set `CHROME_BIN` if Chrome is not installed in the default location. The Demo test writes an ignored screenshot into `screenshots/`. The live UI test requires **both services running** and an authenticated Codex CLI; it writes only to a fresh ignored `.local/live-ui-smoke-*` folder and cancels its test task if validation fails. These live tests are opt-in and are never run in CI.

## Regular development and GitHub sync

Enable hooks in each clone with git config core.hooksPath .githooks. The Git pre-push hook runs `npm run verify:public` when `core.hooksPath` is set to `.githooks`. This prevents an ordinary Git push if checks or tracked-secret screening fail. GitHub Actions repeats checks on pushes and pull requests.

For every change: update source and docs, run the checks, inspect `git diff`, and commit a descriptive message. The local post-commit hook pushes `main` automatically through the pre-push validation. Verify the remote commit and GitHub Actions; if the push fails, resolve the cause and run `git push origin main`. When these local Git hooks are enabled, commits to `main` trigger GitHub synchronization. Editing a file without committing does **not** upload anything. Each clone must enable hooks separately; the GitHub CI also checks remote changes.

A failed check must be fixed before pushing. Never use `--no-verify` to bypass secret checks. Avoid `git push --all` and `git push --mirror`: old local branches or refs may contain historical private metadata.

## Troubleshooting

- **Blank 3D scene**: enable WebGL/hardware acceleration, update browser/GPU drivers, test Chrome.
- **API offline**: run `npm run dev:all` and check port 4300 is unused.
- **Codex missing**: install/login to Codex CLI, ensure `codex` is on PATH or set `CODEX_BIN`, and restart the API.
- **Task fails to start**: check absolute workspace path, write permissions, CLI configuration and the error shown in Activity.
- **Port occupied**: stop the previous Agent Office API/web instance before starting another.
- **Tasks missing after restart**: inspect `.local/tasks.json`; it is local-only and excluded from Git.
- **Language changed**: Settings → Language; selection is saved in browser local storage.
