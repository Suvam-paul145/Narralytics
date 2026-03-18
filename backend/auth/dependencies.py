from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from auth.jwt_handler import verify_jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    if not token:
        return {
            "sub": "guest",
            "email": "guest@narralytics.local",
            "name": "Guest User",
            "picture": "",
        }
    try:
        return verify_jwt(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
