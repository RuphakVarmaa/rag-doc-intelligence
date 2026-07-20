import uuid
import tiktoken
import structlog

from app.db.connection import AsyncSessionLocal
from app.models.document import Document
from app.models.chunk import Chunk
from app.config import get_settings

log = structlog.get_logger()
settings = get_settings()
enc = tiktoken.get_encoding("cl100k_base")


def _token_count(text: str) -> int:
    return len(enc.encode(text))


def _chunk_text(text: str, chunk_size: int, overlap: int) -> list[dict]:
    tokens = enc.encode(text)
    chunks = []
    start = 0
    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = enc.decode(chunk_tokens)
        char_start = len(enc.decode(tokens[:start]))
        chunks.append({
            "content": chunk_text,
            "token_count": len(chunk_tokens),
            "char_offset_start": char_start,
            "char_offset_end": char_start + len(chunk_text),
        })
        if end == len(tokens):
            break
        start += chunk_size - overlap
    return chunks


async def process_document(doc_id: uuid.UUID, filename: str, content: bytes) -> None:
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(Document).where(Document.id == doc_id))
        doc = result.scalar_one_or_none()
        if not doc:
            return

        try:
            doc.status = "chunking"
            await db.commit()

            text_chunks = _extract_text_and_chunk(filename, content)

            for idx, chunk_data in enumerate(text_chunks):
                chunk = Chunk(
                    document_id=doc_id,
                    chunk_index=idx,
                    content=chunk_data["content"],
                    token_count=chunk_data["token_count"],
                    page_number=chunk_data.get("page_number"),
                    section_heading=chunk_data.get("section_heading"),
                    char_offset_start=chunk_data["char_offset_start"],
                    char_offset_end=chunk_data["char_offset_end"],
                )
                db.add(chunk)

            # update page count on document
            pages = max((c.get("page_number") or 0 for c in text_chunks), default=0)
            if pages:
                doc.page_count = pages

            await db.commit()

            doc.status = "embedding"
            await db.commit()

            from app.services.embedder import embed_document_chunks
            await embed_document_chunks(doc_id, db)

            doc.status = "ready"
            await db.commit()
            log.info("document_processed", doc_id=str(doc_id), chunks=len(text_chunks))

        except Exception as exc:
            await db.rollback()
            result2 = await db.execute(select(Document).where(Document.id == doc_id))
            doc2 = result2.scalar_one_or_none()
            if doc2:
                doc2.status = "failed"
                doc2.error_message = str(exc)[:500]
                await db.commit()
            log.error("document_processing_failed", doc_id=str(doc_id), error=str(exc))


def _extract_text_and_chunk(filename: str, content: bytes) -> list[dict]:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    if ext == "pdf":
        return _chunk_pdf(content)
    elif ext == "docx":
        return _chunk_docx(content)
    else:
        text = content.decode("utf-8", errors="replace")
        return _chunk_text(text, settings.chunk_size_prose, settings.chunk_overlap)


def _chunk_pdf(content: bytes) -> list[dict]:
    from pypdf import PdfReader
    import io

    reader = PdfReader(io.BytesIO(content))
    all_chunks: list[dict] = []
    char_offset = 0
    for page_num, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        page_chunks = _chunk_text(text, settings.chunk_size_prose, settings.chunk_overlap)
        for c in page_chunks:
            c["page_number"] = page_num
            c["char_offset_start"] += char_offset
            c["char_offset_end"] += char_offset
        all_chunks.extend(page_chunks)
        char_offset += len(text)
    return all_chunks


def _chunk_docx(content: bytes) -> list[dict]:
    import io
    from docx import Document as DocxDocument

    doc = DocxDocument(io.BytesIO(content))
    full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return _chunk_text(full_text, settings.chunk_size_prose, settings.chunk_overlap)
