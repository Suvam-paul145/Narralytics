#!/usr/bin/env python3
"""
Simple Health Check Verification
Tests the health endpoints without requiring full dependencies
"""

import requests
import json
import sys
from datetime import datetime

def test_health_endpoints():
    """Test both health endpoints"""
    base_url = "http://localhost:8000"
    
    print("🔍 Testing Health Check Endpoints")
    print("=" * 50)
    
    # Test basic health endpoint
    try:
        print("Testing /health endpoint...")
        response = requests.get(f"{base_url}/health", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Basic health check: {data}")
        else:
            print(f"❌ Basic health check failed: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to server: {e}")
        print("Make sure the backend server is running on http://localhost:8000")
        return False
    
    # Test comprehensive health endpoint
    try:
        print("\nTesting /api/health endpoint...")
        response = requests.get(f"{base_url}/api/health", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ API health check successful!")
            print(f"   Status: {data.get('status', 'unknown')}")
            print(f"   API Service: {data.get('services', {}).get('api', 'unknown')}")
            print(f"   Database Service: {data.get('services', {}).get('database', 'unknown')}")
            print(f"   Timestamp: {data.get('timestamp', 'unknown')}")
            
            if data.get('status') == 'healthy':
                print("🎉 All systems are healthy!")
                return True
            elif data.get('status') == 'degraded':
                print("⚠️  System is in degraded state")
                return True
            else:
                print("❌ System is unhealthy")
                return False
        else:
            print(f"❌ API health check failed: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ API health check failed: {e}")
        return False

if __name__ == "__main__":
    success = test_health_endpoints()
    sys.exit(0 if success else 1)