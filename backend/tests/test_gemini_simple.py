#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple Gemini API test
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

try:
    from config import settings
    from google import genai
    
    print("Testing Gemini API with gemini-2.5-flash...")
    
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say 'Hello from Gemini 2.5 Flash!'"
    )
    print(f"SUCCESS Response: {response.text.strip()}")
    
except Exception as e:
    print(f"ERROR: {e}")