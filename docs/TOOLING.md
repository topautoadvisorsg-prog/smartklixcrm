# SmartKlix Dev Tooling — What Works, What Doesn't

Last updated: May 9, 2026

This document is for any Claude session, developer, or AI agent working on this project.
Read this before trying to run any tooling.

---

## Environment

| Item | Value |
|------|-------|
| Node.js | v24.15.0 (ABI 137) |
| npm | bundled with Node 24 |
| OS | Windows (Git Bash + PowerShell available) |
| Package manager | npm |

---

## Tool Status

### ✅ Vitest — WORKS
```bash
npm run test
```
- 8 test files, 191/192 passing (1 skipped — spy on removed neo8-events module)
- Runs in ~2.5s
- Uses MemStorage (no DATABASE_URL needed for unit/integration tests)

### ✅ Graphify — WORKS
```
/graphify (invoke from Claude)
```
- Python-based knowledge graph. No native Node modules.
- Existing output: `server/graphify-out/` — graph.json, HTML viz, cached AST
- Use for: codebase exploration, cross-file relationships, community detection

### ✅ Repomix — WORKS
```bash
npx repomix
```
- v1.14.0 — pure JavaScript, no native Node modules. Works on Node 24.
- Packs entire codebase into a single AI-readable file (repomix-output.xml by default).
- Use when you need a full codebase snapshot for an AI context window.
- Output can be piped to Claude or saved for offline analysis.

### ✅ TypeScript build — WORKS
```bash
npx tsc --noEmit
```
- Type-checks without emitting. Run this before deploying.

### ✅ Drizzle / db:push — WORKS (requires DATABASE_URL)
```bash
npm run db:push
```
- Pushes schema to Supabase. Requires `DATABASE_URL` in `.env`.
- Run this after any changes to `shared/schema.ts`.
- **Pending:** Push the `correlationId` field + ledger enum additions from v2.3.0.

### ❌ GitNexus — BROKEN (Node.js v24 incompatibility)
> **Disabled:** GitNexus hooks removed from `~/.claude/settings.json` (May 10, 2026).
> To re-enable: add back PreToolUse/PostToolUse hooks for `gitnexus-hook.cjs` after switching to Node 20.
```bash
npx gitnexus analyze  # → Segmentation fault (exit code 139)
```
- **Root cause:** Native modules (tree-sitter + LevelDB) compiled for Node ABI 115/127. Node.js v24 uses ABI 137.
- **Workarounds tried:** All file size flags, clearing DB, limiting scope — all crash.
- **Fix when needed:** `nvm install 20 && nvm use 20` then retry.
- **Do NOT:** Keep retrying gitnexus on Node 24. It will always crash.
- **Use instead:** Graphify for knowledge graph. Grep/Glob/Read for targeted search.

---

## Dev Commands

```bash
# Run tests
npm run test

# Start dev server
npm run dev

# Type check
npx tsc --noEmit

# Push schema to DB
npm run db:push

# Start mock agent gateway (for integration testing)
npm run mock-gateway

# Build for production
npm run build
```

---

## Required Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Used for | Required |
|----------|----------|----------|
| `DATABASE_URL` | PostgreSQL (Supabase) | Production + db:push |
| `OPENAI_API_KEY` | GPT-4o-mini Proposal Agent | AI proposals |
| `ANTHROPIC_API_KEY` | External agent system | Agent dispatch |
| `AGENT_WEBHOOK_URL` | External agent endpoint | Dispatch |
| `AGENT_WEBHOOK_SECRET` | HMAC verification | Security |
| `N8N_INTERNAL_TOKEN` | Machine-to-machine auth | intake/sync |
| `RESEND_API_KEY` | Email dispatch | Emails |
| `STRIPE_SECRET_KEY` | Payments | Payments |

Without `DATABASE_URL`, the server runs in MemStorage mode (in-memory, resets on restart).

---

## Architecture Quick Reference

```
Lead intake  →  events_outbox  →  Proposal Agent (GPT-4o-mini)
                                        ↓
                               staged_proposals (pending)
                                        ↓
                              Human reviews + approves
                                        ↓
                            /api/proposals/:id/finalize
                                        ↓
                          events_outbox (proposal.execute)
                                        ↓
                         outbox-worker → agent-dispatcher
                                        ↓
                         External agent executes action
                                        ↓
                         POST /api/agent/callback (HMAC)
                                        ↓
                         automation_ledger (full audit trail)
```

**Kill switch:** `aiSettings.killSwitchActive` — checked at every AI execution point. Toggle from Settings tab.

**Correlation ID spine:** UUID flows through proposal → ledger → outbox → dispatch → callback. Used for tracing and deduplication.
