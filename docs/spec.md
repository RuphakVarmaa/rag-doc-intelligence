# Agentic RAG Document Intelligence System — Full Spec

## Overview
Production-grade, fully deployed Agentic RAG Document Intelligence System as a complete monorepo.

## Repository & Deployment

- GitHub repo: `rag-doc-intelligence`
- Frontend: Next.js 14 → Vercel (preview deployments on every PR, edge middleware rate limiting 50 req/min/IP, Vercel Analytics + Speed Insights)
- Backend: FastAPI → Railway or Fly.io (health checks, auto-scaling, Dockerfile)
- GitHub Actions CI/CD:
  - On PR: lint (ruff + eslint), type-check (mypy + tsc), unit tests, integration tests
  - On merge to main: build → test → deploy backend → promote Vercel preview → E2E smoke test
  - Secrets via GitHub Environments

## Frontend — Next.js 14 App Router (TypeScript)

**Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Zustand, TanStack Query v5, react-dropzone, react-pdf

### Pages

#### `/app/page.tsx` — Landing
- Animated hero, feature grid, demo CTA, dark/light mode toggle

#### `/app/dashboard/page.tsx` — Main Workspace (auth required)
Three-panel layout:
- **Left sidebar**: Document library tree (folder/file hierarchy, drag-to-reorder, bulk delete with undo toast)
- **Center**: Streaming chat interface
  - Auto-scroll with "jump to bottom" pill on user scroll-up
  - Message bubbles: sender avatar, timestamp, copy button
  - Streaming token-by-token via SSE (EventSource)
  - Typing indicator during inference
  - Empty state with 3 suggested starter questions
- **Right panel** (collapsible): Source citations viewer
  - PDF page thumbnail with highlighted bounding box of cited text
  - Confidence score badge (green >85%, amber 65–85%, red <65%)
  - "View in document" button scrolling PDF to exact page
  - Chunk metadata: document name, page, section heading, token count

#### `/app/documents/[id]/page.tsx` — PDF Viewer
- react-pdf with annotation layer
- Text selection → "Ask about this" right-click menu → pre-fills chat input

#### `/app/upload/page.tsx` — Upload
- Multi-file drop zone: PDF, DOCX, TXT, MD up to 50MB
- Per-file: upload progress bar, processing status (uploaded → chunking → embedding → ready), error state + retry, file icon/size/page count

**Auth:** NextAuth.js with GitHub OAuth + magic link email. Protect all `/dashboard` routes.

**State:** Zustand for document library + active chat. TanStack Query for server state, optimistic updates on message send.

Error boundaries on every major component. Skeleton loaders for all async content. Mobile-responsive to 375px.

---

## Backend — FastAPI (Python 3.11)

```
app/
  main.py
  config.py
  routers/
    documents.py
    chat.py
    embeddings.py
  services/
    chunker.py
    embedder.py
    retriever.py
    reranker.py
    agent.py
    citation.py
  models/
    document.py
    chunk.py
    session.py
  db/
    connection.py
    migrations/
```

### API Endpoints
```
POST   /api/documents/upload
GET    /api/documents/{id}/status   (SSE)
GET    /api/documents
DELETE /api/documents/{id}
POST   /api/chat/stream             (SSE)
GET    /api/chat/sessions
DELETE /api/chat/sessions/{id}
```

### Chunking Strategy
- Parse structure: headers, paragraphs, tables, lists
- Adaptive size: 256 tokens for tables/code, 512 for prose
- 64-token overlap between consecutive chunks
- Metadata: document_id, page_number, section_heading, char_offset_start, char_offset_end, chunk_index

### RAG Pipeline
1. Embed query with text-embedding-3-small
2. pgvector: top-20 by cosine similarity (HNSW index)
3. Cross-encoder rerank top-20 → top-5 (ms-marco-MiniLM)
4. Build context: sort by doc+page, deduplicate overlaps
5. Inject into GPT-4o prompt with `[CITE:chunk_id]` markers
6. Parse response → resolve citations → stream tokens via SSE, flush citation block at end

### Multi-Agent Setup
- **RouterAgent**: classifies query as factual/analytical/comparison
- **FactAgent**: single-document targeted retrieval
- **AnalysisAgent**: multi-document synthesis with cross-references
- **FallbackAgent**: triggers web search if all chunk confidence <0.5

---

## Database — PostgreSQL + pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  github_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  page_count INTEGER,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','chunking','embedding','ready','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER,
  page_number INTEGER,
  section_heading TEXT,
  char_offset_start INTEGER,
  char_offset_end INTEGER,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  document_ids UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  citations JSONB,
  latency_ms INTEGER,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Infrastructure & Observability

**Environment variables** (all in `.env.example`):
DATABASE_URL, OPENAI_API_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL,
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, RESEND_API_KEY,
STORAGE_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

**Docker:**
- Multi-stage Dockerfile for FastAPI (builder + runtime)
- docker-compose.yml: fastapi + postgres + redis
- .dockerignore

**Logging:** Structured JSON logs with request_id correlation. Log level from env.

**Error handling:**
- FastAPI global exception handler → RFC 7807 Problem Details
- Frontend: React Error Boundary per route + toast notifications
- Async jobs: retry with exponential backoff (max 3 attempts)
- Sentry on both frontend and backend

---

## Testing

**Backend (pytest):**
- Unit: chunker, embedder (mock OpenAI), retriever, citation parser
- Integration: full upload → chunk → embed → query pipeline against real test PostgreSQL
- API: httpx AsyncClient tests for every endpoint
- Min 80% coverage enforced in CI

**Frontend (Vitest + Playwright):**
- Unit: Zustand store actions, utility functions
- Component: upload dropzone, chat bubble, citation viewer
- E2E: login → upload PDF → ask question → verify citation appears with correct page number

---

## Deliverables
- [ ] GitHub repo with full commit history
- [ ] README.md: Mermaid architecture diagram, setup instructions, env var table, API reference
- [ ] Live Vercel URL in README
- [ ] All GitHub Actions green on main
- [ ] Zero TypeScript errors (strict mode)
- [ ] Zero Python type errors (mypy strict)
- [ ] Lighthouse >= 90 performance, >= 95 accessibility
