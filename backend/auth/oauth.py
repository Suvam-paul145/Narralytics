from urllib.parse import urlencode

import httpx

from config import settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def get_google_auth_url(redirect_uri: str | None = None, state: str | None = None) -> str:
    redirect_target = redirect_uri or settings.REDIRECT_URI
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_target,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    if state:
        params["state"] = state
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_user(code: str, redirect_uri: str | None = None) -> dict:
    redirect_target = redirect_uri or settings.REDIRECT_URI
    async with httpx.AsyncClient(timeout=20.0) as client:
        token_response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_target,
                "grant_type": "authorization_code",
            },
        )
        if token_response.status_code != 200:
            error_data = token_response.json()
            error_msg = error_data.get("error_description", error_data.get("error", "Unknown error"))
            raise ValueError(f"Google token exchange failed ({token_response.status_code}): {error_msg}")
        
        token_payload = token_response.json()

        access_token = token_payload.get("access_token")
        if not access_token:
            raise ValueError("Google token exchange did not return an access token")

        user_response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_response.raise_for_status()
        profile = user_response.json()

    google_sub = profile.get("sub") or profile.get("id")
    if not google_sub:
        raise ValueError("Google user info did not contain a subject identifier")

    profile["id"] = google_sub
    profile["sub"] = google_sub
    return profile
