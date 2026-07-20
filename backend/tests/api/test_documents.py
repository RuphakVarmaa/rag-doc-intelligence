import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.auth import get_current_user
from app.db.connection import get_db

USER_ID = uuid.uuid4()
DOC_ID = uuid.uuid4()


def _make_doc(**kwargs):
    doc = MagicMock()
    doc.id = kwargs.get("id", DOC_ID)
    doc.user_id = kwargs.get("user_id", USER_ID)
    doc.original_name = kwargs.get("original_name", "test.pdf")
    doc.filename = kwargs.get("filename", f"{DOC_ID}.pdf")
    doc.file_size_bytes = kwargs.get("file_size_bytes", 1024)
    doc.status = kwargs.get("status", "ready")
    doc.page_count = kwargs.get("page_count", 5)
    doc.error_message = None
    doc.deleted_at = None
    from datetime import datetime, timezone
    doc.created_at = datetime.now(timezone.utc)
    return doc


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.__aenter__ = AsyncMock(return_value=db)
    db.__aexit__ = AsyncMock(return_value=False)
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def client(mock_db):
    app.dependency_overrides[get_current_user] = lambda: USER_ID
    app.dependency_overrides[get_db] = lambda: mock_db
    yield mock_db
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_documents_empty(client):
    mock_db = client
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    mock_db.execute = AsyncMock(return_value=result)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/documents")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_documents_returns_docs(client):
    mock_db = client
    doc = _make_doc()
    result = MagicMock()
    result.scalars.return_value.all.return_value = [doc]
    mock_db.execute = AsyncMock(return_value=result)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get("/api/documents")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["original_name"] == "test.pdf"
    assert data[0]["status"] == "ready"


@pytest.mark.asyncio
async def test_get_document_not_found(client):
    mock_db = client
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=result)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get(f"/api/documents/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_document_success(client):
    mock_db = client
    doc = _make_doc()
    result = MagicMock()
    result.scalar_one_or_none.return_value = doc
    mock_db.execute = AsyncMock(return_value=result)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.get(f"/api/documents/{DOC_ID}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(DOC_ID)
    assert body["status"] == "ready"


@pytest.mark.asyncio
async def test_delete_document_not_found(client):
    mock_db = client
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    mock_db.execute = AsyncMock(return_value=result)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.delete(f"/api/documents/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_document_success(client):
    mock_db = client
    doc = _make_doc()
    result = MagicMock()
    result.scalar_one_or_none.return_value = doc
    mock_db.execute = AsyncMock(return_value=result)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.delete(f"/api/documents/{DOC_ID}")
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
    assert doc.deleted_at is not None


@pytest.mark.asyncio
async def test_upload_unsupported_type(client):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        resp = await c.post(
            "/api/documents/upload",
            files={"file": ("malware.exe", b"binary", "application/octet-stream")},
        )
    assert resp.status_code == 415
