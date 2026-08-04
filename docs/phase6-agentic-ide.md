# Phase 6 — Agentic IDE

## What landed

Extends the existing **IDEa IDE** workspace (not a greenfield rewrite):

- **Project explorer** — already real (`ide.listTree` / `GOD_MACHINE_REPO_ROOT`)
- **Monaco editor** — read + save (`ide.readFile` / `ide.writeFile`, Ctrl/Cmd+S)
- **Terminal** — allowlisted commands only (`ide.listCommands` / `ide.runCommand`)
- **Agent inspector** — Command Center → Inspect (`ide.getTask` events/result/worktree)
- **Worktree management** — list / select / remove (`ide.listWorktrees` / `ide.removeWorktree`)
- **Patch review** — live `git diff` + status (`ide.getDiff` / `ide.repoStatus`)
- **Tests** — Terminal → `npm run test` (and typecheck/lint/build/validate)
- **Browser preview** — live iframe (`VITE_PREVIEW_URL` or `http://localhost:5173`)
- **PR preparation** — draft body from status/diff; optional open via GitHub (`ide.preparePr`)

## Files

- `server/services/ide/repoFs.ts` — `writeRepoFile`
- `server/services/ide/gitOps.ts` — status/diff/worktrees/commands/PR
- `server/routers/ide.router.ts` — new procedures
- `client/src/features/idea-ide/MonacoEditorPane.tsx`
- `client/src/features/idea-ide/IdeTerminalPanel.tsx`
- `client/src/features/idea-ide/IdeWorktreesPanel.tsx`
- `client/src/features/idea-ide/IdePatchReviewPanel.tsx`
- `client/src/features/idea-ide/IdeBrowserPreview.tsx`
- `client/src/features/idea-ide/IdeAgentInspector.tsx`
- `client/src/features/idea-ide/IdeWorkspace.tsx`

## Permissions

- `script:write` — write file, run command, remove worktree
- `agent:dispatch` — prepare/open PR
- Org-scoped session required for all IDE procedures

## How to try

1. Open **IDEa IDE**
2. Explorer → open a file → edit in Monaco → Save
3. Bottom **Terminal** → Run `npm run test`
4. **Worktrees** / **Patches** after dispatching a coder goal
5. **Preview** loads the Vite app (or Open in a tab if iframe blocked)
6. **Draft PR body** / **Open PR** when `GITHUB_TOKEN` + `GITHUB_REPO` are set

## Remaining limits

- No interactive PTY / xterm — allowlisted batch commands only
- Worktrees table is not org-column-scoped (joined via org `agent_tasks`)
- Open PR requires branch already pushed; does not auto-push from main checkout
- Monaco loads from CDN on first open (network)
- Nested iframe of same app may be limited by browser CSP / frame ancestors
