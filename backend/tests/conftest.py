import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.auth import get_current_user
from app.db.connection import get_db


TEST_USER_ID = uuid.uuid4()


def _mock_db():
    """Returns an AsyncMock that quacks like AsyncSession."""
    db = AsyncMock()
    db.__aenter__ = AsyncMock(return_value=db)
    db.__aexit__ = AsyncMock(return_value=False)
    return db


@pytest.fixture
def mock_db():
    return _mock_db()


@pytest.fixture
def authed_client(mock_db):
    """AsyncClient with auth and DB overridden."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    app.dependency_overrides[get_db] = lambda: mock_db

    async def _client():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c

    return _client


@pytest.fixture
def user_id():
    return TEST_USER_ID
