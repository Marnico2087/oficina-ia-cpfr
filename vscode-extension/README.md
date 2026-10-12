# Agent Office 3D for VS Code

Shows your local [Agent Office](https://github.com/Munizada/agent-office) in a VS Code Simple Browser tab. It uses the **active VS Code workspace folder** to launch local coding agents.

## Install

1. Install Node.js and the prebuilt CLI: `npm install -g https://github.com/Munizada/agent-office/releases/latest/download/agent-office.tgz`.
2. Install the `.vsix` extension distributed in GitHub Releases using **Extensions → … → Install from VSIX** or `code --install-extension agent-office-vscode.vsix`.
3. Open a project directory in VS Code.
4. Use **Ctrl+Shift+P → Agent Office: Open 3D Office**.

The tab opens locally inside VS Code. The agent CLIs must be installed and logged in separately. VS Code must be restarted after a global CLI installation if it cannot find the `agent-office` command. Optionally set `agentOffice.command` to the absolute path to the CLI executable.

Each VS Code instance starts its own local Agent Office server on an available port. Closing the VS Code window stops the server. To change workspaces, open a different project folder and run the command again. Codex Web GPT jobs and other external agent chats are not automatically tracked.

## Build the VSIX from source

In the repository root run `npm run package:vscode`. The file is written into `work/agent-office-vscode.vsix` and is ignored by Git.
