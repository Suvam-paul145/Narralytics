import hashlib
import hmac
import logging
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from starlette.routing import NoMatchFound
from urllib.parse import urlparse

from auth.dependencies import get_current_user
from auth.jwt_handler import create_jwt
from auth.oauth import exchange_code_for_user, get_google_auth_url
from config import settings
from database.users import upsert_user

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _normalize_origin(url: str | None) -> str | None:
    if not url:
        return None
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return None
    normalized = f"{parsed.scheme}://{parsed.netloc}"
    return normalized.rstrip("/")


def _allowed_frontend_origins(request: Request | None = None) -> set[str]:
    allowed: set[str] = set()
    primary = _normalize_origin(settings.FRONTEND_URL)
    if primary:
        allowed.add(primary)
    if settings.FRONTEND_ORIGINS:
        for origin in settings.FRONTEND_ORIGINS.split(","):
            normalized = _normalize_origin(origin.strip())
            if normalized:
                allowed.add(normalized)
    if request:
        backend_origin = _normalize_origin(str(request.base_url))
        if backend_origin:
            allowed.add(backend_origin)
        request_origin = _normalize_origin(request.headers.get("origin"))
        if request_origin:
            allowed.add(request_origin)
    return allowed


def _resolve_frontend_redirect(request: Request, requested: str | None = None) -> str:
    allowed = _allowed_frontend_origins(request)
    candidate = (
        _normalize_origin(requested)
        or _normalize_origin(request.headers.get("origin"))
        or _normalize_origin(settings.FRONTEND_URL)
        or _normalize_origin(str(request.base_url))
    )
    if candidate and candidate in allowed:
        return candidate
    raise HTTPException(status_code=400, detail="Invalid frontend redirect origin")


def _resolve_callback_uri(request: Request) -> str:
    try:
        return str(request.url_for("callback"))
    except NoMatchFound:
        return settings.REDIRECT_URI


def _build_state(frontend_origin: str) -> str:
    normalized = _normalize_origin(frontend_origin)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid redirect origin")
    signature = hmac.new(
        key=settings.JWT_SECRET.encode("utf-8"),
        msg=normalized.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()
    return f"{normalized}|{signature}"


def _parse_state(request: Request, state: str | None) -> str | None:
    if not state:
        return None
    try:
        origin, signature = state.rsplit("|", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Malformed state parameter")
    expected = hmac.new(
        key=settings.JWT_SECRET.encode("utf-8"),
        msg=origin.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=400, detail="Invalid state signature")
    normalized = _normalize_origin(origin)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid redirect origin")
    if normalized not in _allowed_frontend_origins(request):
        raise HTTPException(status_code=400, detail="Redirect origin not allowed")
    return normalized


@router.get("/google")
def login(request: Request, redirect: str | None = None):
    frontend_origin = _resolve_frontend_redirect(request, redirect)
    callback_uri = _resolve_callback_uri(request)
    state = _build_state(frontend_origin)
    return RedirectResponse(url=get_google_auth_url(redirect_uri=callback_uri, state=state))


@router.get("/callback")
async def callback(request: Request, code: str, state: str | None = None):
    try:
        callback_uri = _resolve_callback_uri(request)
        state_origin = _parse_state(request, state)
        frontend_origin = _resolve_frontend_redirect(request, state_origin)
        google_user = await exchange_code_for_user(code, redirect_uri=callback_uri)
        await upsert_user(google_user)
        token = create_jwt(
            {
                "sub": google_user["id"],
                "email": google_user["email"],
                "name": google_user.get("name", ""),
                "picture": google_user.get("picture", ""),
            }
        )
        return RedirectResponse(url=f"{frontend_origin}/auth/callback#token={token}")
    except Exception as exc:
        error_msg = urllib.parse.quote(str(exc))
        logger.exception("Auth error during OAuth callback")
        fallback_frontend = _resolve_frontend_redirect(request, None)
        return RedirectResponse(url=f"{fallback_frontend}?auth_error=true&error_msg={error_msg}")


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "sub": user["sub"],
        "email": user["email"],
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
    }
