#!/usr/bin/env python3
"""
Simplified Gemini Client with Quota Management
Uses new google-genai package with intelligent fallbacks
"""

from google import genai
from config import settings
from llm.quota_manager import quota_manager
from llm.genai_client import generate_with_retry
from functools import lru_cache
import time


@lru_cache(maxsize=1)
def _get_client():
    """Get the Google GenAI client instance."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_content_with_fallback(prompt: str, request_type: str = "general", **kwargs):
    """
    Generate content with intelligent quota management and fallbacks
    
    Args:
        prompt: The prompt to send to Gemini
        request_type: Type of request for fallback handling
        **kwargs: Additional parameters for fallback responses
    
    Returns:
        Generated content or intelligent fallback
    """
    
    # Check quota before making request
    if not quota_manager.is_quota_available():
        print("⚠️  Gemini API quota exhausted, using fallback mode")
        return quota_manager.get_fallback_response(request_type, **kwargs)
    
    try:
        client = _get_client()
        
        response = generate_with_retry(
            client=client,
            model="gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
        )
        
        if response and response.text:
            return response.text.strip()
        else:
            print("⚠️  Empty response from Gemini, using fallback")
            return quota_manager.get_fallback_response(request_type, **kwargs)
            
    except Exception as exc:
        error_str = str(exc).lower()
        
        # Handle quota exhaustion
        if "quota_exhausted" in error_str or "429" in error_str or "quota" in error_str:
            print(f"⚠️  Gemini API quota exhausted: {exc}")
            return quota_manager.get_fallback_response(request_type, **kwargs)
        
        # Handle other errors
        print(f"⚠️  Gemini API error: {exc}")
        return quota_manager.get_fallback_response(request_type, **kwargs)


def test_gemini_connection():
    """Test if Gemini API is working"""
    try:
        client = _get_client()
        response = generate_with_retry(
            client=client,
            model="gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": "Say 'Hello' if you can read this."}]}],
        )
        return response.text.strip() if response and response.text else "No response"
    except Exception as e:
        return f"Error: {e}"