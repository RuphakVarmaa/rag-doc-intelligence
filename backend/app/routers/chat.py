import uuid
import time
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import AsyncGenerator

from app.db.connection import get_db
from app.models.session import ChatSession, ChatMessage
from app.services.auth import get_current_user

router = APIRouter()


class ChatRequest(BaseModel):
    session_id: uuid.UUID | None = None
    message: str
    document_ids: list[uuid.UUID] = []


async def _chat_stream(
    request: ChatRequest,
    db: AsyncSession,
    user_id: uuid.UUID,
) -> AsyncGenerator[str, None]:
    from app.services.agent import run_rag_pipeline

    start = time.monotonic()

    session = None
    if request.session_id:
        result = await db.execute(select(ChatSession).where(ChatSession.id == request.session_id))
        session = result.scalar_one_or_none()

    if not session:
        session = ChatSession(
            user_id=user_id,
            document_ids=request.document_ids or None,
        )
        db.add(session)
        await db.flush()

    user_msg = ChatMessage(session_id=session.id, role="user", content=request.message)
    db.add(user_msg)
    await db.flush()

    full_response = ""
    citations: dict = {}

    async for event in run_rag_pipeline(request.message, request.document_ids, db):
        yield f"data: {json.dumps(event)}\n\n"
        if event["type"] == "token":
            full_response += event["content"]
        elif event["type"] == "citations":
            citations = event["citations"]

    latency_ms = int((time.monotonic() - start) * 1000)
    asst_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=full_response,
        citations=citations,
        latency_ms=latency_ms,
    )
    db.add(asst_msg)

    yield f"data: {json.dumps({'type': 'done', 'session_id': str(session.id)})}\n\n"


@router.post("/stream")
async def chat_stream(request: ChatRequest, db: AsyncSession = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user)) -> StreamingResponse:
    return StreamingResponse(
        _chat_stream(request, db, user_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user)) -> list[dict]:
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [{"id": str(s.id), "title": s.title, "created_at": s.created_at.isoformat()} for s in sessions]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db), user_id: uuid.UUID = Depends(get_current_user)) -> dict:
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.commit()
    return {"deleted": True}
