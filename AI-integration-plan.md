# AI Integration Plan for ERD Design Engine

This document outlines how to integrate the Qwen model located in the AI folder into the ERD Design Engine to power:

- Database monitoring services
- AI-driven suggestions and optimizations
- Conversational chat assistant
- Natural‑language creation of tables and schema refactors

The plan is grounded in the actual model and files present under AI/.

## 1) Current AI Assets (what we have)

- Model: Qwen3-4B (quantized 4-bit) with chat template and long context support.
  - Path: AI/
  - Key files: model.safetensors, tokenizer.json, tokenizer_config.json, config.json, README.md
  - Config highlights (from AI/config.json):
    - architectures: Qwen3ForCausalLM
    - max_position_embeddings: 65,536 (long context)
    - quantization: 4-bit, group_size: 128
    - transformers_version: 4.51.3
- README guidance:
  - Use transformers ≥ 4.52.4 (recommended) or mlx_lm ≥ 0.25.2.
  - Chat template via `tokenizer.apply_chat_template`.
  - Thinking mode toggle via `enable_thinking`.
  - Best practices for decoding parameters.

Implication: We should serve Qwen locally from AI/ using a Python service with transformers and expose an OpenAI-compatible Chat Completions API. The Next.js app will call this service for chat, suggestions, SQL generation, and monitoring analyses.

## 2) High-level Architecture

- Backend model service (Python, FastAPI):
  - Loads local weights from AI/ using transformers; exposes OpenAI-compatible endpoints (e.g., /v1/chat/completions) for easy integration.
  - Provides request types: chat, structured JSON suggestions, SQL DDL generation.
  - Supports streaming tokens (SSE) for chat.
  - Controls thinking mode: enable_thinking=True for reasoning/chat, False for strict JSON outputs.

- Next.js integration (TypeScript):
  - API routes under app/api/ai/* proxy to the Python service.
  - Client utilities for streaming, retries, and schema context injection.
  - UI: Chat panel, AI suggestions integration, “Create Table” workflows.

- Optional DB telemetry collector (Node):
  - Connects to target DB (Postgres/MySQL/SQLite) to ingest stats and schema metadata.
  - Aggregates metrics and feeds compact summaries to Qwen for monitoring insights.

## 3) Serving Qwen locally (Python service)

- Stack: Python 3.10+, transformers ≥ 4.52.4, torch (CPU or CUDA), fastapi, uvicorn.
- Model path: environment var AI_MODEL_DIR=./AI (relative to repo root) or absolute path.
- Endpoints (OpenAI-compatible):
  - POST /v1/chat/completions
    - Request: { model: "qwen-local", messages: [...], temperature, top_p, max_tokens }
    - Implementation:
      - Convert messages to prompt with `tokenizer.apply_chat_template(messages, add_generation_prompt=True, enable_thinking=[True|False])`.
      - Generate with transformers (greedy disabled per README). Stream if requested.
      - For strict JSON tasks, set `enable_thinking=False` and instruct “respond ONLY with valid JSON”.
  - Optional: /v1/completions for non-chat prompts.

Performance notes:
- Qwen3-4B 4-bit runs on CPU but is faster with NVIDIA GPU + CUDA. Ensure torch CUDA install if available. For Windows-only CPU, expect slower latency; use streaming in UI.

## 4) Next.js integration points

- API proxy routes:
  - app/api/ai/chat/route.ts → forwards chat requests to Python service (streams back tokens).
  - app/api/ai/suggestions/route.ts → sends current ERD graph as JSON and requests structured suggestions.
  - app/api/ai/sql/route.ts → prompts Qwen to produce SQL DDL or migration diffs from natural language.
  - app/api/ai/monitor/route.ts → sends telemetry snapshot for monitoring analysis.

- Client utilities:
  - src/lib/ai/client.ts: configure OpenAI SDK with baseURL pointing to local Python service and apiKey=“EMPTY”.
  - src/lib/ai/prompts.ts: centralize prompt templates (see Section 6).

- UI surfaces:
  - Chat Assistant Panel: New sidebar in the editor with streaming chat and context toggles.
  - Suggestions Panel integration: Merge AI suggestions with existing heuristic suggestions; “Apply” buttons map to store actions.
  - “Create Table” dialog: Natural-language to draft table (preview and apply to diagram + SQL export).

## 5) Database Monitoring Services

Goal: Provide insights on performance, integrity, and maintenance with actionable recommendations.

- Data sources (pluggable):
  - Postgres: `pg_stat_statements`, `pg_indexes`, `information_schema`, table/idx size, vacuum/analyze recency.
  - MySQL: `performance_schema`, `information_schema`.
  - SQLite: pragma table_info, pragma index_list, basic stats (limited).

- Node collector (src/lib/db-monitor):
  - Connect via env (e.g., DATABASE_URL). Runs on interval or user-triggered.
  - Produces a compact JSON snapshot: schema, index coverage, slow/top queries, missing indexes (FKs, selective columns), estimated cardinalities, anomalies.

- AI analysis flow:
  1) Collector builds snapshot (bounded size).
  2) API /api/ai/monitor crafts a prompt with snapshot + business goals.
  3) Qwen returns:
     - Summary (in natural language)
     - Structured recommendations (JSON) with severities and fix actions (index create, column type change, vacuum/analyze, query rewrite hint).
  4) UI displays both. “Apply” maps to store actions (indexes, column properties) or generates SQL to run externally.

## 6) AI Suggestions & Refactors

We will unify AI suggestions with the existing panels (validation, suggestions):

- Inputs to Qwen:
  - Current ERD graph: tables, columns, PK/FK, indexes, nullability, data types.
  - Known issues from ValidationEngine (if any) for focus.

- Outputs (strict JSON, thinking disabled):
```
{
  "suggestions": [
    {
      "id": "sug-uuid",
      "type": "add_foreign_key" | "add_index" | "change_column_type" | "rename_column" | "normalize_table" | "add_unique_constraint",
      "title": "Short headline",
      "details": "Rationale",
      "actions": [
        {
          "action": "create_fk" | "create_index" | "update_column" | "create_table" | "rename_column",
          "payload": { /* minimal fields required to apply in the diagram */ }
        }
      ],
      "severity": "info" | "warning" | "error"
    }
  ]
}
```

- Application:
  - “Apply” invokes store actions to create FK/index or update columns.
  - For structural changes (normalize_table), show a diff preview and let the user accept per-table.

## 7) Natural-language “Create Table” and Migrations

- UX: “+ AI Table” button or via Chat (“Create a table for customers with name, email unique, created_at”).
- Flow:
  1) Prompt Qwen with NL description + existing schema context.
  2) Receive JSON with table draft and SQL DDL.
  3) Preview modal shows table columns, constraints, and SQL diff.
  4) On confirm, persist to diagram store and refresh panels.

- Output format from Qwen (strict JSON):
```
{
  "table": {
    "name": "customers",
    "columns": [
      { "name": "id", "type": "uuid", "pk": true, "default": "gen_random_uuid()" },
      { "name": "email", "type": "varchar(255)", "unique": true, "notNull": true },
      { "name": "created_at", "type": "timestamptz", "default": "now()" }
    ],
    "indexes": [ { "columns": ["email"], "unique": true } ],
    "fks": []
  },
  "sql": "CREATE TABLE ...; CREATE UNIQUE INDEX ...;"
}
```

## 8) Chat Assistant

- Capabilities:
  - General DB design Q&A.
  - Context-aware: current ERD snapshot, validation issues, and performance insights.
  - Commands: “/create-table …”, “/suggest-indexes”, “/explain-issues”, “/generate-sql <table>”.

- Implementation:
  - Streaming chat via /api/ai/chat → Python service.
  - Toggles: include schema context, include telemetry, enable thinking.
  - Safety: hide `<think>...</think>` content if thinking is enabled; only show final answer.

## 9) Prompting strategy

- System prompt (chat): Position Qwen as a senior database architect; follow JSON schemas when requested; never hallucinate SQL features for the declared dialect.
- Suggestions/migrations: `enable_thinking=False`, temperature 0.3–0.5, TopP 0.8, instruct “ONLY JSON, no extra text”.
- Chat/explanations: `enable_thinking=True` (optionally), temperature 0.6, TopP 0.95 per README.
- History: Do not include prior think content in the chat history.

## 10) Store and UI changes (ERD Design Engine)

- Store (Zustand): add actions to apply AI outputs safely:
  - addTableFromAI(draft)
  - createForeignKey(tableId, columnId, refTableId, refColumnId)
  - createIndex(tableId, columns, unique)
  - updateColumnProperties(tableId, columnId, props)
  - bulkApply(actions[])

- Components:
  - Chat panel component with schema-context checkbox and streaming view.
  - Suggestions panel: new “AI” section sourcing results from /api/ai/suggestions.
  - Create Table modal: accepts JSON draft from AI and maps to nodes/edges.

## 11) Security & Privacy

- Local inference by default (no external calls).
- Validate all model JSON with Zod/Pydantic before applying.
- Gated writes: always show a preview and require explicit user approval.
- Rate limit API endpoints; cap prompt sizes.

## 12) Performance & Observability

- Streaming for responsiveness.
- Cache recent schema encodings; truncate context prudently for large diagrams.
- Log token usage, latencies, and error rates.

## 13) Milestones (recommended sequence)

1) Model service up & reachable
   - FastAPI server loads AI/ model and exposes /v1/chat/completions.
2) Chat assistant MVP
   - Next.js chat panel with streaming; schema context toggle.
3) AI Suggestions
   - /api/ai/suggestions with strict JSON; apply FK/index; merge with heuristic panel.
4) Create Table
   - NL → JSON draft + SQL; preview + apply to diagram and export engine.
5) Monitoring Insights
   - DB collector + /api/ai/monitor; insights and fix-it actions.
6) Polish & Hardening
   - Validation, rate limiting, telemetry, error UX.

## 14) Dependencies & Setup

- Python (service): transformers≥4.52.4, fastapi, uvicorn, torch (+CUDA if available).
- Node: openai SDK (for OpenAI-compatible calls), SSE utilities.
- Env:
  - AI_MODEL_DIR (default ./AI)
  - AI_SERVER_URL (default http://localhost:8000)
  - DATABASE_URL (optional for monitoring)

## 15) Risks & Mitigations

- Windows performance without GPU: mitigate via streaming and batching, or run service on a GPU machine.
- Quantization compatibility: if 4-bit config causes load issues, fall back to fp16/bf16 or use compatible quant lib.
- JSON reliability: turn off thinking, add JSON schema, and enable constrained decoding when available.

---

If you want, I can scaffold the FastAPI server and the Next.js API routes in a follow-up PR.

