from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse

from auth.dependencies import get_current_user
from auth.jwt_handler import create_jwt
from auth.oauth import exchange_code_for_user, get_google_auth_url
from config import settings
from database.users import upsert_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/google")
def login():
    return RedirectResponse(url=get_google_auth_url())


@router.get("/callback")
async def callback(code: str):
    try:
        google_user = await exchange_code_for_user(code)
        await upsert_user(google_user)
        token = create_jwt(
            {
                "sub": google_user["id"],
                "email": google_user["email"],
                "name": google_user.get("name", ""),
                "picture": google_user.get("picture", ""),
            }
        )
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback#token={token}")
    except Exception as exc:
        print(f"Auth error: {exc}")
        return RedirectResponse(url=f"{settings.FRONTEND_URL}?auth_error=true")


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "sub": user["sub"],
        "email": user["email"],
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
    }
