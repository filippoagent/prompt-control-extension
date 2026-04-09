# Prompt Control Extension

Companion interface for improving Filippo -> Zoro communication.

## Goal
Allow Filippo to write naturally, improve the prompt using live context and helper rules, preview the refined prompt, and send it to Zoro.

## MVP
- raw prompt input
- Smart rewrite mode
- task-board-aware context
- preview before send
- send refined prompt into control chat

## Planned architecture
- frontend composer + preview UI
- local prompt refinement API
- task board context integration
- later: local-memory context integration

## Current send path
- explicit send button in the UI
- local helper API on port `4176`
- backend send bridge uses Gateway HTTP `POST /v1/chat/completions`
- local helper auto-reads Gateway auth from `~/.openclaw/openclaw.json` when env overrides are not provided
- clipboard fallback remains available when direct send fails
- older experimental WebSocket bridge was removed after hitting device-identity auth walls

## Status
MVP scaffold is active and the send flow is now centered on the Gateway HTTP route.

Current verified state:
- preview and rewrite flow works
- send button works through Gateway HTTP chat completions
- dynamic live session discovery works
- session selector prefers the main session and hides stale subagent sessions by default when primary sessions exist

Current session discovery path:
- frontend `src/contextApi.ts` -> local helper API `GET /api/context/sessions`
- backend `server/context-api.mjs` -> Gateway HTTP `POST /tools/invoke`
- tool call: `sessions_list`
- parser handles nested `result.details.sessions` and JSON text wrappers returned by the tool bridge

## Task context source
- frontend `src/contextApi.ts` -> local helper API `GET /api/context/task-board`
- backend `server/context-api.mjs` -> local read-only SQLite summary loader `server/task-context-store.mjs`
- default board DB path: `~/.openclaw/workspace/tasks/board.sqlite`
- override supported via `PROMPT_CONTROL_BOARD_DB_PATH`

## Security / repo hygiene
- No gateway secrets are stored in this repo.
- Local helper auth reads from `~/.openclaw/openclaw.json` at runtime, or from env vars when explicitly provided.
- Task context is read from the local board database at runtime and is not stored in this repo.
- `.gitignore` excludes common local/runtime artifacts like `node_modules`, `dist`, logs, and `.env*`.
- Before publishing, keep Filippo-specific local paths, tokens, and machine-only runtime data out of committed files.
