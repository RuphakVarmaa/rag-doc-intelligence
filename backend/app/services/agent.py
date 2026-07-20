import uuid
import json
import asyncio
import boto3
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from app.services.retriever import retrieve_chunks
from app.services.reranker import rerank
from app.services.citation import build_context_with_citations, extract_citations
from app.config import get_settings

log = structlog.get_logger()
settings = get_settings()

SYSTEM_PROMPT = """You are a precise document analysis assistant. Answer questions using ONLY
the provided context. Wrap every sentence that draws from a source chunk with [CITE:chunk_id]
markers exactly as they appear in the context. If you cannot answer from the context alone,
say so — do not hallucinate. Be concise and cite every claim."""


def _get_bedrock_client() -> boto3.client:
    return boto3.client(
        "bedrock-runtime",
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        region_name=settings.aws_region,
    )


def _classify_sync(query: str) -> str:
    client = _get_bedrock_client()
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 5,
        "messages": [
            {
                "role": "user",
                "content": f"Classify this query as exactly one word — factual, analytical, or comparison. Query: {query}",
            }
        ],
    })
    response = client.invoke_model(
        modelId=settings.classify_model,
        body=body,
        contentType="application/json",
        accept="application/json",
    )
    result = json.loads(response["body"].read())
    return (result["content"][0]["text"] or "factual").strip().lower()


async def _classify_query(query: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _classify_sync, query)


async def run_rag_pipeline(
    query: str,
    document_ids: list[uuid.UUID],
    db: AsyncSession,
) -> AsyncGenerator[dict, None]:
    raw_chunks = await retrieve_chunks(query, document_ids, db)
    if not raw_chunks:
        yield {"type": "token", "content": "No relevant content found in the selected documents."}
        yield {"type": "citations", "citations": {}}
        return

    top_chunks = rerank(query, raw_chunks)
    context, chunk_map = build_context_with_citations(top_chunks)

    query_type = await _classify_query(query)
    log.info("rag_query", type=query_type, chunks=len(top_chunks))

    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 2048,
        "temperature": 0.1,
        "system": SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"},
        ],
    })

    loop = asyncio.get_event_loop()

    def _stream():
        client = _get_bedrock_client()
        return client.invoke_model_with_response_stream(
            modelId=settings.chat_model,
            body=body,
            contentType="application/json",
            accept="application/json",
        )

    response = await loop.run_in_executor(None, _stream)

    full_response = ""
    for event in response["body"]:
        chunk = json.loads(event["chunk"]["bytes"])
        if chunk.get("type") == "content_block_delta":
            delta = chunk.get("delta", {}).get("text", "")
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
