#!/usr/bin/env python3
"""
Simple Gemini API test
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

try:
    from config import settings
    import google.generativeai as genai
    
    print("🧪 Testing Gemini API with gemini-2.5-flash...")
    
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    response = model.generate_content("Say 'Hello from Gemini 2.5 Flash!'")
    print(f"✅ Success! Response: {response.text.strip()}")
    
except Exception as e:
    print(f"❌ Error: {e}")