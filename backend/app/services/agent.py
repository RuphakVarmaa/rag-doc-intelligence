import uuid
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from openai import AsyncOpenAI
import structlog

from app.services.retriever import retrieve_chunks
from app.services.reranker import rerank
from app.services.citation import build_context_with_citations, extract_citations
from app.services.embedder import get_openai_client
from app.config import get_settings

log = structlog.get_logger()
settings = get_settings()

SYSTEM_PROMPT = """You are a precise document analysis assistant. Answer questions using ONLY
the provided context. Wrap every sentence that draws from a source chunk with [CITE:chunk_id]
markers exactly as they appear in the context. If you cannot answer from the context alone,
say so — do not hallucinate. Be concise and cite every claim."""


async def _classify_query(query: str, client: AsyncOpenAI) -> str:
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Classify this query as exactly one word: factual, analytical, or comparison."},
            {"role": "user", "content": query},
        ],
        max_tokens=5,
    )
    return (resp.choices[0].message.content or "factual").strip().lower()


async def run_rag_pipeline(
    query: str,
    document_ids: list[uuid.UUID],
    db: AsyncSession,
) -> AsyncGenerator[dict, None]:
    client = get_openai_client()

    # Retrieve + rerank
    raw_chunks = await retrieve_chunks(query, document_ids, db)
    if not raw_chunks:
        yield {"type": "token", "content": "No relevant content found in the selected documents."}
        yield {"type": "citations", "citations": {}}
        return

    top_chunks = rerank(query, raw_chunks)
    context, chunk_map = build_context_with_citations(top_chunks)

    query_type = await _classify_query(query, client)
    log.info("rag_query", type=query_type, chunks=len(top_chunks))

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
    ]

    full_response = ""
    async with client.chat.completions.stream(
        model=settings.chat_model,
        messages=messages,
        temperature=0.1,
    ) as stream:
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                full_response += delta
                yield {"type": "token", "content": delta}

    _, citations = extract_citations(full_response, chunk_map)
    yield {
        "type": "citations",
        "citations": {
            c.chunk_id: {
                "document_id": c.document_id,
                "page_number": c.page_number,
                "section_heading": c.section_heading,
                "content_preview": c.content_preview,
                "confidence": c.confidence,
            }
            for c in citations
        },
    }
