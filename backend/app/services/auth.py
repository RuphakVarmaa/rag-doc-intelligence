import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.db.connection import get_db
from app.config import get_settings

settings = get_settings()
bearer = HTTPBearer(auto_error=True)

ALGORITHM = "HS256"


async def _get_or_create_user(sub: str, email: str, db: AsyncSession) -> uuid.UUID:
    result = await db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": email},
    )
    row = result.fetchone()
    if row:
        return uuid.UUID(str(row.id))

    user_id = uuid.uuid4()
    await db.execute(
        text("INSERT INTO users (id, email, github_id) VALUES (:id, :email, :github_id)"),
        {"id": str(user_id), "email": email, "github_id": sub if sub.startswith("github_") else None},
    )
    return user_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.nextauth_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    sub: str = payload.get("sub", "")
    email: str = payload.get("email", "")
    if not sub or not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token")

    return await _get_or_create_user(sub, email, db)
