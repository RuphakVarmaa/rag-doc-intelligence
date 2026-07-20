import uuid
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI
import structlog

from app.models.chunk import Chunk
from app.config import get_settings

log = structlog.get_logger()
settings = get_settings()
_client: AsyncOpenAI | None = None


def get_openai_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def embed_texts(texts: list[str]) -> list[list[float]]:
    client = get_openai_client()
    BATCH = 100
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        response = await client.embeddings.create(
            model=settings.embedding_model,
            input=batch,
        )
        all_embeddings.extend([e.embedding for e in response.data])
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
