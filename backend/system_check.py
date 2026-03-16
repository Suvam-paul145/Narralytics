#!/usr/bin/env python3
"""
System Check Script
Verifies the entire system setup and organization
"""

import os
import sys
from pathlib import Path

def check_file_structure():
    """Check if the file structure is properly organized"""
    print("📁 Checking file structure...")
    
    required_files = [
        "main.py",
        "config.py",
        "requirements.txt",
        "start_server.py",
        "run_tests.py",
        "verify_health.py",
        ".gitignore"
    ]
    
    required_dirs = [
        "tests",
        "auth",
        "database", 
        "llm",
        "models",
        "routers",
        "storage"
    ]
    
    missing_files = []
    missing_dirs = []
    
    for file in required_files:
        if not Path(file).exists():
            missing_files.append(file)
    
    for dir in required_dirs:
        if not Path(dir).exists():
            missing_dirs.append(dir)
    
    if missing_files:
        print(f"❌ Missing files: {', '.join(missing_files)}")
        return False
    
    if missing_dirs:
        print(f"❌ Missing directories: {', '.join(missing_dirs)}")
        return False
    
    print("✅ File structure is properly organized")
    return True

def check_test_organization():
    """Check if tests are properly organized"""
    print("🧪 Checking test organization...")
    
    test_files = list(Path("tests").glob("test_*.py"))
    
    if len(test_files) == 0:
        print("❌ No test files found in tests/ directory")
        return False
    
    print(f"✅ Found {len(test_files)} test files in tests/ directory")
    
    # Check if start_server.py references the correct test path
    with open("start_server.py", "r", encoding="utf-8") as f:
        content = f.read()
        if "tests/test_config.py" in content:
            print("✅ start_server.py correctly references tests/test_config.py")
        else:
            print("❌ start_server.py does not reference tests/test_config.py")
            return False
    
    return True

def check_gitignore():
    """Check if .gitignore is comprehensive"""
    print("🚫 Checking .gitignore...")
    
    with open(".gitignore", "r", encoding="utf-8") as f:
        content = f.read()
    
    required_patterns = [
        "__pycache__/",
        "*.pyc",
        ".env",
        "/venv/",
        "*.log"
    ]
    
    missing_patterns = []
    for pattern in required_patterns:
        if pattern not in content:
            missing_patterns.append(pattern)
    
    if missing_patterns:
        print(f"❌ Missing .gitignore patterns: {', '.join(missing_patterns)}")
        return False
    
    print("✅ .gitignore is comprehensive")
    return True

def check_health_system():
    """Check if health check system is properly set up"""
    print("💓 Checking health check system...")
    
    # Check backend health endpoints
    with open("main.py", "r", encoding="utf-8") as f:
        content = f.read()
        if "/health" in content and "/api/health" in content:
            print("✅ Health endpoints are defined in main.py")
        else:
            print("❌ Health endpoints missing in main.py")
            return False
    
    # Check if health test exists
    if Path("tests/test_health_endpoint.py").exists():
        print("✅ Health endpoint test exists")
    else:
        print("❌ Health endpoint test missing")
        return False
    
    return True

def check_gemini_migration():
    """Check if Gemini SDK migration is complete"""
    print("🔄 Checking Gemini SDK migration...")
    
    # Check requirements.txt
    with open("requirements.txt", "r", encoding="utf-8") as f:
        requirements = f.read()
        if "google-genai" in requirements and "google-generativeai" not in requirements:
            print("✅ Requirements.txt updated to use google-genai")
        else:
            print("❌ Requirements.txt still contains old google-generativeai package")
            return False
    
    # Check LLM files for new import pattern
    llm_files = ["llm/chat_engine.py", "llm/chart_engine.py", "llm/report_engine.py", "llm/auto_dashboard.py"]
    
    for file_path in llm_files:
        if Path(file_path).exists():
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                if "from google import genai" in content and "import google.generativeai" not in content:
                    print(f"✅ {file_path} migrated to new SDK")
                else:
                    print(f"❌ {file_path} still uses old SDK")
                    return False
    
    print("✅ Gemini SDK migration completed successfully")
    return True

def main():
    """Main system check"""
    print("🔍 Narralytics System Check")
    print("=" * 50)
    
    if not Path("main.py").exists():
        print("❌ Not in backend directory!")
        sys.exit(1)
    
    checks = [
        check_file_structure,
        check_test_organization,
        check_gitignore,
        check_health_system,
        check_gemini_migration
    ]
    
    passed = 0
    total = len(checks)
    
    for check in checks:
        if check():
            passed += 1
        print("-" * 30)
    
    print(f"\n📊 System Check Results:")
    print(f"✅ Passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 System is properly organized and migrated!")
        return True
    else:
        print("❌ Some issues need to be addressed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)