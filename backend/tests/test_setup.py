#!/usr/bin/env python3
"""
Step-by-Step Setup Test for Narralytics Backend
Guides you through testing each component individually
"""

import os
import sys
import asyncio
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def test_step(step_name, test_func):
    """Run a test step and return result"""
    print(f"\n🔍 Testing: {step_name}")
    print("-" * 40)
    try:
        result = test_func()
        if result:
            print(f"✅ {step_name}: PASSED")
        else:
            print(f"❌ {step_name}: FAILED")
        return result
    except Exception as e:
        print(f"❌ {step_name}: ERROR - {e}")
        return False

def test_basic_imports():
    """Test basic Python imports"""
    try:
        import fastapi
        import uvicorn
        import pandas
        import numpy
        print("✅ Core packages imported successfully")
        return True
    except ImportError as e:
        print(f"❌ Missing package: {e}")
        print("Run: pip install -r requirements.txt")
        return False

def test_config_loading():
    """Test configuration loading"""
    try:
        from config import settings
        print(f"✅ Configuration loaded")
        print(f"   - MongoDB DB: {settings.MONGODB_DB}")
        print(f"   - Upload Dir: {settings.UPLOAD_DIR}")
        print(f"   - Frontend URL: {settings.FRONTEND_URL}")
        return True
    except Exception as e:
        print(f"❌ Config error: {e}")
        print("Check your .env file")
        return False

def test_mongodb_connection():
    """Test MongoDB connection"""
    try:
        from database.mongodb import connect_mongodb, get_db
        
        async def test_mongo():
            await connect_mongodb()
            db = get_db()
            # Simple test - list collections
            collections = await db.list_collection_names()
            print(f"✅ MongoDB connected successfully")
            print(f"   - Database: {db.name}")
            print(f"   - Collections: {len(collections)} found")
            return True
        
        return asyncio.run(test_mongo())
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        print("Check your MONGODB_URI in .env file")
        return False

def test_gemini_api():
    """Test Gemini API connection"""
    try:
        from config import settings
        import google.generativeai as genai
        
        if not settings.GEMINI_API_KEY:
            print("❌ GEMINI_API_KEY not configured")
            return False
        
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        # Simple test prompt
        response = model.generate_content("Say 'Hello from Gemini!'")
        print(f"✅ Gemini API connected successfully")
        print(f"   - Response: {response.text.strip()}")
        return True
    except Exception as e:
        print(f"❌ Gemini API failed: {e}")
        print("Check your GEMINI_API_KEY in .env file")
        return False

def test_file_operations():
    """Test file operations"""
    try:
        from config import settings
        import pandas as pd
        from sqlite.loader import load_csv_to_sqlite
        from sqlite.executor import execute_query
        from sqlite.schema_detector import detect_schema
        
        # Create test data
        test_data = pd.DataFrame({
            'date': ['2024-01-01', '2024-01-02', '2024-01-03'],
            'revenue': [1000, 1500, 1200],
            'region': ['North', 'South', 'East']
        })
        
        # Test schema detection
        schema = detect_schema(test_data)
        print(f"✅ Schema detection working")
        print(f"   - Columns: {len(schema['columns'])}")
        print(f"   - Numeric: {schema['numeric_columns']}")
        
        # Test SQLite operations
        test_db_path = Path(settings.UPLOAD_DIR) / "test.db"
        test_db_path.parent.mkdir(exist_ok=True)
        
        load_csv_to_sqlite(test_data, str(test_db_path))
        result = execute_query(str(test_db_path), "SELECT COUNT(*) as count FROM data")
        
        print(f"✅ SQLite operations working")
        print(f"   - Rows inserted: {result[0]['count']}")
        
        # Cleanup
        if test_db_path.exists():
            test_db_path.unlink()
        
        return True
    except Exception as e:
        print(f"❌ File operations failed: {e}")
        return False

def test_fastapi_app():
    """Test FastAPI app creation"""
    try:
        from main import app
        print(f"✅ FastAPI app created successfully")
        print(f"   - App title: {app.title}")
        print(f"   - Routes: {len(app.routes)} registered")
        return True
    except Exception as e:
        print(f"❌ FastAPI app failed: {e}")
        return False

def main():
    """Run all setup tests"""
    print("🧪 Narralytics Backend Setup Test")
    print("=" * 50)
    print("This will test each component step by step...")
    
    tests = [
        ("Basic Package Imports", test_basic_imports),
        ("Configuration Loading", test_config_loading),
        ("MongoDB Connection", test_mongodb_connection),
        ("Gemini API Connection", test_gemini_api),
        ("File Operations", test_file_operations),
        ("FastAPI App Creation", test_fastapi_app),
    ]
    
    results = []
    for test_name, test_func in tests:
        result = test_step(test_name, test_func)
        results.append((test_name, result))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\nResults: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Your backend is ready to run.")
        print("\nNext steps:")
        print("1. Start server: python start_server.py")
        print("2. Or manually: uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    else:
        print(f"\n⚠️  {total - passed} tests failed. Please fix the issues above.")
        print("\nCommon fixes:")
        print("- Install dependencies: pip install -r requirements.txt")
        print("- Check .env file has all required values")
        print("- Verify MongoDB Atlas and Gemini API credentials")

if __name__ == "__main__":
    main()