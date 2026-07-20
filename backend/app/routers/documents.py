import uuid
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import AsyncGenerator
import asyncio
import json

from app.db.connection import get_db
from app.models.document import Document
from app.config import get_settings
from app.services.auth import get_current_user

router = APIRouter()
settings = get_settings()


async def _status_stream(document_id: uuid.UUID, db: AsyncSession) -> AsyncGenerator[str, None]:
    for _ in range(60):
        result = await db.execute(select(Document).where(Document.id == document_id))
        doc = result.scalar_one_or_none()
        if not doc:
            yield f"data: {json.dumps({'error': 'not_found'})}\n\n"
            return
        payload = {"status": doc.status, "error": doc.error_message}
        yield f"data: {json.dumps(payload)}\n\n"
        if doc.status in ("ready", "failed"):
            return
        await asyncio.sleep(2)


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: uuid.UUID = Depends(get_current_user),
) -> dict:
    if file.size and file.size > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 50MB limit")

    allowed = {".pdf", ".docx", ".txt", ".md"}
    suffix = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if suffix not in allowed:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {suffix}")

    doc = Document(
        user_id=user_id,
        filename=f"{uuid.uuid4()}{suffix}",
        original_name=file.filename or "upload",
        file_size_bytes=file.size,
        status="pending",
    )
    db.add(doc)
    await db.flush()
    doc_id = doc.id
    await db.commit()

    from app.services.chunker import process_document
    file_content = await file.read()
    background_tasks.add_task(process_document, doc_id, file.filename or "upload", file_content)

    return {"document_id": str(doc_id), "status": "pending"}


@router.get("/{document_id}/status")
async def document_status(document_id: uuid.UUID, db: AsyncSession = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user)) -> StreamingResponse:
    return StreamingResponse(
        _status_stream(document_id, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{document_id}", response_model=None)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user)) -> dict:
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id, Document.deleted_at.is_(None))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": str(doc.id),
        "original_name": doc.original_name,
        "status": doc.status,
        "page_count": doc.page_count,
        "file_size_bytes": doc.file_size_bytes,
        "created_at": doc.created_at.isoformat(),
        # file_url: served directly from storage; None if S3 not configured
        "file_url": f"{settings.backend_url}/api/documents/{doc.id}/file" if doc.filename else None,
    }


@router.get("/{document_id}/file")
async def serve_document_file(document_id: uuid.UUID, db: AsyncSession = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user)):
    """Proxy the raw file bytes back to the client for PDF rendering."""
    from fastapi.responses import Response

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id, Document.deleted_at.is_(None))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # When S3 is configured, redirect to a presigned URL instead
    if settings.storage_bucket and settings.aws_access_key_id:
        import boto3
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
        )
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.storage_bucket, "Key": doc.filename},
            ExpiresIn=300,
        )
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=url)

    raise HTTPException(status_code=501, detail="File serving requires S3 configuration")


@router.get("")
async def list_documents(db: AsyncSession = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user)) -> list[dict]:
    result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id, Document.deleted_at.is_(None))
        .order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "original_name": d.original_name,
            "status": d.status,
            "page_count": d.page_count,
            "file_size_bytes": d.file_size_bytes,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.delete("/{document_id}")
async def delete_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user)) -> dict:
    from datetime import datetime, timezone

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    doc.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"deleted": True}
