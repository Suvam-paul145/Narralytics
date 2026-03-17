#!/usr/bin/env python3
"""
OAuth Flow Test Script
Tests the Google OAuth endpoints and configuration
"""

import sys
from pathlib import Path
import asyncio
import httpx

# Add backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config import settings
from auth.oauth import get_google_auth_url

def test_oauth_config():
    """Test OAuth configuration"""
    print("🔍 Testing OAuth Configuration")
    print("=" * 50)
    
    # Check required settings
    required_settings = [
        ('GOOGLE_CLIENT_ID', settings.GOOGLE_CLIENT_ID),
        ('GOOGLE_CLIENT_SECRET', settings.GOOGLE_CLIENT_SECRET),
        ('REDIRECT_URI', settings.REDIRECT_URI),
        ('FRONTEND_URL', settings.FRONTEND_URL),
    ]
    
    missing_settings = []
    for name, value in required_settings:
        if not value:
            missing_settings.append(name)
        else:
            print(f"✅ {name}: {value[:20]}{'...' if len(value) > 20 else ''}")
    
    if missing_settings:
        print(f"\n❌ Missing required settings: {', '.join(missing_settings)}")
        return False
    
    print("\n✅ All OAuth settings configured")
    return True

def test_auth_url():
    """Test Google Auth URL generation"""
    print("\n🔗 Testing Google Auth URL Generation")
    print("-" * 30)
    
    try:
        auth_url = get_google_auth_url()
        print(f"✅ Auth URL generated successfully")
        print(f"URL: {auth_url}")
        
        # Verify URL contains required parameters
        required_params = ['client_id', 'redirect_uri', 'response_type', 'scope']
        for param in required_params:
            if param not in auth_url:
                print(f"❌ Missing parameter: {param}")
                return False
        
        print("✅ All required parameters present")
        return True
        
    except Exception as e:
        print(f"❌ Failed to generate auth URL: {e}")
        return False

async def test_endpoints():
    """Test OAuth endpoints are accessible"""
    print("\n🌐 Testing OAuth Endpoints")
    print("-" * 30)
    
    base_url = "http://localhost:8000"
    endpoints = [
        "/auth/google",
        "/health",
        "/api/health"
    ]
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        for endpoint in endpoints:
            try:
                response = await client.get(f"{base_url}{endpoint}", follow_redirects=False)
                if endpoint == "/auth/google":
                    # Should redirect to Google
                    if response.status_code in [302, 307]:
                        print(f"✅ {endpoint}: Redirects correctly ({response.status_code})")
                    else:
                        print(f"❌ {endpoint}: Expected redirect, got {response.status_code}")
                else:
                    # Health endpoints should return 200
                    if response.status_code == 200:
                        print(f"✅ {endpoint}: OK ({response.status_code})")
                    else:
                        print(f"❌ {endpoint}: Error ({response.status_code})")
                        
            except Exception as e:
                print(f"❌ {endpoint}: Connection failed - {e}")
                print("   Make sure the backend server is running on http://localhost:8000")

def main():
    """Main test function"""
    print("🔐 OAuth Flow Test Suite")
    print("=" * 50)
    
    # Test configuration
    config_ok = test_oauth_config()
    
    # Test URL generation
    url_ok = test_auth_url()
    
    # Test endpoints (async)
    print("\nTesting endpoints (requires running server)...")
    try:
        asyncio.run(test_endpoints())
    except Exception as e:
        print(f"❌ Endpoint testing failed: {e}")
    
    print("\n" + "=" * 50)
    if config_ok and url_ok:
        print("🎉 OAuth configuration is ready!")
        print("\nNext steps:")
        print("1. Start the backend server: python start_server.py")
        print("2. Start the frontend: npm run dev (in frontend directory)")
        print("3. Visit http://localhost:5173 and test Google OAuth")
    else:
        print("❌ OAuth configuration needs attention")
        print("Please check the .env file and ensure all OAuth settings are configured")

if __name__ == "__main__":
    main()