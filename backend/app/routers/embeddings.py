import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.connection import get_db
from app.models.document import Document

router = APIRouter()


@router.post("/{document_id}/reembed")
async def trigger_reembed(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.status = "pending"
    from app.services.embedder import embed_document_chunks
    await embed_document_chunks(document_id, db)
    return {"status": "queued"}
