import uuid
import json
import asyncio
import boto3
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import structlog

from app.models.chunk import Chunk
from app.config import get_settings

log = structlog.get_logger()
settings = get_settings()

_bedrock: boto3.client | None = None


def get_bedrock_client():
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client(
            "bedrock-runtime",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )
    return _bedrock


def _embed_batch_sync(texts: list[str]) -> list[list[float]]:
    client = get_bedrock_client()
    results = []
    for text in texts:
        body = json.dumps({
            "inputText": text[:8192],  # Titan V2 max input
            "dimensions": settings.embedding_dimensions,
            "normalize": True,
        })
        response = client.invoke_model(
            modelId=settings.embedding_model,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        results.append(json.loads(response["body"].read())["embedding"])
    return results


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts via Amazon Titan Text V2 on Bedrock."""
    BATCH = 20  # stay well within Bedrock rate limits
    all_embeddings: list[list[float]] = []
    loop = asyncio.get_event_loop()
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        embeddings = await loop.run_in_executor(None, _embed_batch_sync, batch)
        all_embeddings.extend(embeddings)
    return all_embeddings


async def embed_document_chunks(doc_id: uuid.UUID, db: AsyncSession) -> None:
    result = await db.execute(
        select(Chunk).where(Chunk.document_id == doc_id, Chunk.embedding.is_(None))
    )
    chunks = result.scalars().all()
    if not chunks:
        return

    texts = [c.content for c in chunks]
    embeddings = await embed_texts(texts)

    for chunk, embedding in zip(chunks, embeddings):
        chunk.embedding = embedding

    log.info("chunks_embedded", doc_id=str(doc_id), count=len(chunks))


async def embed_query(query: str) -> list[float]:
    embeddings = await embed_texts([query])
    return embeddings[0]
