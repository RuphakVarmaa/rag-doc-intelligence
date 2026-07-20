import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from dataclasses import dataclass

from app.services.embedder import embed_query
from app.config import get_settings

settings = get_settings()


@dataclass
class RetrievedChunk:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    content: str
    page_number: int | None
    section_heading: str | None
    similarity: float
    token_count: int | None


async def retrieve_chunks(
    query: str,
    document_ids: list[uuid.UUID],
    db: AsyncSession,
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    k = top_k or settings.retrieval_top_k
    query_embedding = await embed_query(query)
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    doc_filter = ""
    if document_ids:
        ids = ", ".join(f"'{d}'" for d in document_ids)
        doc_filter = f"AND c.document_id IN ({ids})"

    sql = text(f"""
        SELECT
            c.id,
            c.document_id,
            c.content,
            c.page_number,
            c.section_heading,
            c.token_count,
            1 - (c.embedding <=> :embedding) AS similarity
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.deleted_at IS NULL
          AND c.embedding IS NOT NULL
          {doc_filter}
        ORDER BY c.embedding <=> :embedding
        LIMIT :k
    """)

    result = await db.execute(sql, {"embedding": embedding_str, "k": k})
    rows = result.fetchall()

    return [
        RetrievedChunk(
            chunk_id=row.id,
            document_id=row.document_id,
            content=row.content,
            page_number=row.page_number,
            section_heading=row.section_heading,
            similarity=float(row.similarity),
            token_count=row.token_count,
        )
        for row in rows
    ]
