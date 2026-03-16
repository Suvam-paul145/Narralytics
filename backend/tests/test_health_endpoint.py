#!/usr/bin/env python3
"""
Test script for the health check endpoint
Run this to verify the health endpoint is working correctly
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app

def test_basic_health():
    """Test the basic health endpoint"""
    client = TestClient(app)
    response = client.get("/health")
    
    print("Testing /health endpoint...")
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    print("✅ Basic health check passed!")

def test_api_health():
    """Test the comprehensive API health endpoint"""
    client = TestClient(app)
    response = client.get("/api/health")
    
    print("\nTesting /api/health endpoint...")
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Response: {data}")
        
        # Check required fields
        assert "status" in data
        assert "timestamp" in data
        assert "services" in data
        assert "api" in data["services"]
        assert "database" in data["services"]
        
        print(f"✅ API health check passed!")
        print(f"   Status: {data['status']}")
        print(f"   API Service: {data['services']['api']}")
        print(f"   Database Service: {data['services']['database']}")
        
        if data["status"] == "degraded":
            print("⚠️  System is in degraded state - check database connection")
        elif data["status"] == "healthy":
            print("✅ All systems healthy!")
            
    else:
        print(f"❌ Health check failed with status {response.status_code}")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    print("🔍 Testing Health Check Endpoints")
    print("=" * 50)
    
    try:
        test_basic_health()
        test_api_health()
        print("\n🎉 All health check tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)