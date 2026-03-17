#!/usr/bin/env python3
"""
Test Runner for Narralytics Backend
Runs all available tests and provides a comprehensive health check
"""

import os
import sys
import subprocess
from pathlib import Path

def run_test_file(test_file):
    """Run a specific test file"""
    print(f"🧪 Running {test_file}...")
    try:
        result = subprocess.run([sys.executable, test_file], 
                              capture_output=True, text=True, cwd="tests")
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Failed to run {test_file}: {e}")
        return False

def main():
    """Main test runner"""
    print("🧠 Narralytics Backend Test Suite")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not Path("main.py").exists():
        print("❌ main.py not found!")
        print("Make sure you're running this from the backend directory")
        sys.exit(1)
    
    # Find all test files
    test_files = list(Path("tests").glob("test_*.py"))
    
    if not test_files:
        print("❌ No test files found in tests/ directory")
        sys.exit(1)
    
    print(f"Found {len(test_files)} test files")
    
    passed = 0
    failed = 0
    
    for test_file in test_files:
        if run_test_file(test_file.name):
            passed += 1
        else:
            failed += 1
        print("-" * 30)
    
    print(f"\n📊 Test Results:")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"📈 Success Rate: {passed/(passed+failed)*100:.1f}%")
    
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    main()