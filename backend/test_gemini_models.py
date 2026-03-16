#!/usr/bin/env python3
"""
Test script to check available Gemini models
"""

import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

try:
    from config import settings
    import google.generativeai as genai
    
    print("🔍 Testing Gemini API and listing available models...")
    
    if not settings.GEMINI_API_KEY:
        print("❌ GEMINI_API_KEY not configured")
        sys.exit(1)
    
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    # List available models
    print("\n📋 Available Gemini Models:")
    models = genai.list_models()
    
    for model in models:
        if 'generateContent' in model.supported_generation_methods:
            print(f"✅ {model.name}")
    
    # Test with the first available model
    available_models = [m for m in models if 'generateContent' in m.supported_generation_methods]
    
    if available_models:
        test_model_name = available_models[0].name
        print(f"\n🧪 Testing with model: {test_model_name}")
        
        model = genai.GenerativeModel(test_model_name)
        response = model.generate_content("Say 'Hello from Gemini!'")
        print(f"✅ Success! Response: {response.text.strip()}")
        
        print(f"\n💡 Use this model name in your LLM modules: {test_model_name}")
    else:
        print("❌ No models support generateContent")

except Exception as e:
    print(f"❌ Error: {e}")