#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple Groq API connectivity test.
Replaces the previous test_gemini_simple.py.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

try:
    from config import settings
    from groq import Groq

    print("Testing Groq API with llama-3.3-70b-versatile...")

    client = Groq(api_key=settings.GROQ_API_KEY)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "Say 'Hello from Groq LLaMA 3.3!'"}],
    )
    text = response.choices[0].message.content or ""
    print(f"SUCCESS Response: {text.strip()}")

except Exception as e:
    print(f"ERROR: {e}")
