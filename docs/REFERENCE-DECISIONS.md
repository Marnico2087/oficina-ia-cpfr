# Technical reference projects

These repositories inform design reviews; Agent Office keeps its own code, visual identity and architecture. No third-party source code, models, textures or screenshots are copied into this project. Recheck upstream code and license terms before considering any direct reuse.

| Project | Useful idea for Agent Office | Fit and caution |
| --- | --- | --- |
| [Agent Office](https://github.com/AgentSystemLabs/agent-office) | Separate provider/session state from the visual client; represent work as explicit queue and worker state. | MIT. Useful architecture reference; active development means upstream behavior needs review before adoption. |
| [AI Office](https://github.com/Gaurav2693/ai-office) | Three.js room composition, lighting and contextual furnishings. | MIT. Visual simulation only; its animations are not evidence of real agent activity. |
| [Hermes Virtual Office](https://github.com/JuniorXcoder/hermes-virtual-office) | Derive behavior from prioritized, real events; use navigable paths and actual communication records. | MIT. A2A event model is a future integration idea; Agent Office currently launches independent CLI jobs. |
| [Hermes Virtual Office fork](https://github.com/dian003/virtual-office) | Compare alternate implementation choices for the Hermes office. | MIT. The inspected behavior substantially overlaps upstream; no separate feature justified copying. |
| [VirtOffice](https://github.com/OneByJorah/VirtOffice) | Self-hosted collaboration workspace patterns. | MIT. Primarily chat/video/docs; limited relevance to articulated 3D character locomotion. |
| [Claude Office](https://github.com/paulrobello/claude-office) | Observe real sessions through hooks and batch state updates for rendering. | MIT. Hooks and session state are provider-specific; keep provider adapters isolated. |
| [Claude Code Park](https://github.com/t-soda/claude-code-park) | Map actual tool events into named states such as reading, editing, running and awaiting input. | MIT. Claude JSONL/hooks and macOS packaging do not transfer directly to every provider or Windows. |
| [Agent Town](https://github.com/rafapetter/agent-town) | Organize 2D agents into zones and use explicit task-state transitions. | MIT. Useful state and room concepts; its rendering approach differs from this Three.js office. |
| [Agent Town RPG](https://github.com/geezerrrr/agent-town) | Model queued, running, returning and finished work as separate lifecycle states. | The repository declares MIT in package metadata, but the inspected root had no LICENSE file. Treat as ideas only; do not reuse code until licensing is clarified. |
| [Agent Virtual Office](https://github.com/KbWen/agent-virtual-office) | Classify real tool families and cap simultaneous trips; avoid depicting unsupported group activity. | MIT. A useful principle for honest visual status; its orchestration model is not Agent Office's current backend. |
| [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) | Isolate provider/event adapters from the visual layer and support IDE workflows. | MIT. Helpful integration pattern; pixel-art presentation is not a fit for the current 3D visual identity. |

## Decisions applied here

- API task snapshots remain the source of truth for running, completed and failed work. Demo activity is clearly marked as a preview.
- Idle coffee breaks and walking describe presentation behavior only. The renderer must not label these states as conversations, collaboration or real task progress.
- The current local CLI integrations start independent jobs; they are not a coordinated agent swarm. Actual meetings or agent-to-agent chat require recorded backend events before characters can portray them.
- Keep deterministic walk routes and collision/layout checks in the application; adopt navigation ideas only when they fit the current room geometry and tests.
- Keep provider-specific event readers behind adapters. Claude hooks, Codex CLI output and other provider events must not be assumed interchangeable.
- Preserve the existing procedural avatar and furniture implementation. Reassess imported assets or source code separately, with license and dependency review.

This is a maintained decision record, not an assertion that every upstream project has been fully audited or benchmarked. The upstream repositories can change; verify their current source, maintenance and license before a future implementation decision.
