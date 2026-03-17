#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Test Script for Narralytics Backend
Tests all environment variables and external service connections
"""

import os
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent  # Go up one level from tests/ to backend/
sys.path.insert(0, str(backend_dir))

try:
    from config import settings
    print("OK Configuration module loaded successfully!")
except ImportError as e:
    print(f"ERROR Failed to import config module: {e}")
    print("Make sure you're running this from the backend directory")
    sys.exit(1)
except Exception as e:
    print(f"ERROR Configuration error: {e}")
    print("Check your .env file and environment variables")
    sys.exit(1)

def test_environment_variables():
    """Test all required environment variables"""
    print("\nTesting Environment Variables:")
    
    # Required variables
    required_vars = {
        'GOOGLE_CLIENT_ID': settings.GOOGLE_CLIENT_ID,
        'GOOGLE_CLIENT_SECRET': settings.GOOGLE_CLIENT_SECRET,
        'REDIRECT_URI': settings.REDIRECT_URI,
        'FRONTEND_URL': settings.FRONTEND_URL,
        'JWT_SECRET': settings.JWT_SECRET,
        'MONGODB_URI': settings.MONGODB_URI,
        'MONGODB_DB': settings.MONGODB_DB,
        'GROQ_API_KEY': settings.GROQ_API_KEY,
        'UPLOAD_DIR': settings.UPLOAD_DIR,
    }
    
    all_good = True
    
    for var_name, var_value in required_vars.items():
        if not var_value or var_value == "":
            print(f"ERROR {var_name}: Not set or empty")
            all_good = False
        elif isinstance(var_value, str) and (var_value.startswith('your-') or '<YOUR_' in var_value):
            print(f"ERROR {var_name}: Placeholder value detected. Please provide actual credentials.")
            all_good = False
        elif var_name == 'JWT_SECRET' and len(var_value) < 32:
            print(f"WARN {var_name}: Too short (should be 32+ characters)")
            all_good = False
        elif var_name == 'GROQ_API_KEY' and not var_value.startswith('gsk_'):
            print(f"WARN {var_name}: Invalid format (should start with 'gsk_')")
            all_good = False
        elif var_name == 'MONGODB_URI' and not var_value.startswith('mongodb'):
            print(f"WARN {var_name}: Invalid format (should start with 'mongodb')")
            all_good = False
        else:
            # Mask sensitive values for display
            if var_name in ['JWT_SECRET', 'GOOGLE_CLIENT_SECRET', 'GROQ_API_KEY']:
                display_value = f"{var_value[:10]}..." if len(var_value) > 10 else "***"
            elif var_name == 'MONGODB_URI':
                # Hide password in MongoDB URI
                if '@' in var_value:
                    parts = var_value.split('@')
                    if ':' in parts[0]:
                        user_pass = parts[0].split(':')
                        display_value = f"{user_pass[0]}:***@{parts[1]}"
                    else:
                        display_value = var_value
                else:
                    display_value = var_value
            else:
                display_value = var_value
            
            print(f"OK {var_name}: {display_value}")
    
    return all_good

def test_file_structure():
    """Test if required directories and files exist"""
    print("\nTesting File Structure:")
    
    required_paths = [
        'auth/__init__.py',
        'database/__init__.py', 
        'llm/__init__.py',
        'models/__init__.py',
        'routers/__init__.py',
        'sqlite/__init__.py',
        'storage/__init__.py',
        'main.py',
        'config.py',
        'requirements.txt'
    ]
    
    all_good = True
    
    for path in required_paths:
        full_path = backend_dir / path
        if full_path.exists():
            print(f"OK {path}: Found")
        else:
            print(f"ERROR {path}: Missing")
            all_good = False
    
    # Check upload directory
    upload_dir = Path(settings.UPLOAD_DIR)
    if upload_dir.exists():
        print(f"OK Upload directory: {upload_dir}")
    else:
        print(f"WARN Upload directory: {upload_dir} (will be created automatically)")
    
    return all_good

def test_dependencies():
    """Test if all required Python packages are installed"""
    print("\nTesting Python Dependencies:")
    
    required_packages = [
        'fastapi',
        'uvicorn',
        'motor',
        'pymongo', 
        'pandas',
        'groq',
        'pydantic',
        'authlib',
        'httpx',
        'jose',
        'reportlab',
        'numpy',
        'mangum'
    ]
    
    all_good = True
    
    for package in required_packages:
        try:
            if package == 'groq':
                import groq
                print(f"OK {package}: Installed")
            elif package == 'jose':
                from jose import jwt
                print(f"OK python-{package}: Installed")
            else:
                __import__(package)
                print(f"OK {package}: Installed")
        except ImportError:
            print(f"ERROR {package}: Not installed")
            all_good = False
    
    return all_good

def main():
    """Run all configuration tests"""
    print("Narralytics Backend Configuration Test")
    print("=" * 50)
    
    # Test environment variables
    env_ok = test_environment_variables()
    
    # Test file structure
    files_ok = test_file_structure()
    
    # Test dependencies
    deps_ok = test_dependencies()
    
    # Final result
    print("\n" + "=" * 50)
    if env_ok and files_ok and deps_ok:
        print("SUCCESS All configuration tests passed!")
        print("Your backend is ready to run.")
        print("\nNext steps:")
        print("1. Start the server: uvicorn main:app --reload --host 0.0.0.0 --port 8000")
        print("2. Test health endpoint: http://localhost:8000/health")
        print("3. View API docs: http://localhost:8000/docs")
        sys.exit(0)
    else:
        print("ERROR Some configuration tests failed!")
        print("\nPlease fix the issues above before starting the server.")
        
        if not env_ok:
            print("\nEnvironment Variable Issues:")
            print("- Check your .env file exists and has all required values")
            #print("- Ensure you've replaced placeholders like '<YOUR_CLIENT_ID>' with real credentials")
            print("- Generate JWT secret: python -c \"import secrets; print(secrets.token_hex(32))\"")
            
        if not files_ok:
            print("\nFile Structure Issues:")
            print("- Make sure you're in the backend directory")
            print("- Verify all modules were created correctly")
            
        if not deps_ok:
            print("\nDependency Issues:")
            print("- Install missing packages: pip install -r requirements.txt")
            print("- Make sure virtual environment is activated")
        
        sys.exit(1)

if __name__ == "__main__":
    main()
