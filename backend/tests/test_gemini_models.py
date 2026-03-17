#!/usr/bin/env python3
"""
Test script to verify Groq API connectivity and list available models.
Replaces the previous test_gemini_models.py.
"""

import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

try:
    from config import settings
    from groq import Groq

    print("🔍 Testing Groq API connection...")

    if not settings.GROQ_API_KEY:
        print("❌ GROQ_API_KEY not configured")
        sys.exit(1)

    client = Groq(api_key=settings.GROQ_API_KEY)

    print("\n🧪 Testing with model: llama-3.3-70b-versatile")
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Say 'Hello from Groq LLaMA!'"}],
    )
    text = response.choices[0].message.content or ""
    print(f"✅ Success! Response: {text.strip()}")
    print("\n💡 Groq model in use: llama-3.3-70b-versatile")

except Exception as e:
    print(f"❌ Error: {e}")
