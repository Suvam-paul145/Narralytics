#!/usr/bin/env python3
"""
Simple MongoDB connection test
"""

import sys
import asyncio
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

async def test_mongodb():
    try:
        from config import settings
        from motor.motor_asyncio import AsyncIOMotorClient
        
        print("🧪 Testing MongoDB connection...")
        print(f"URI: {settings.MONGODB_URI[:50]}...")
        
        # Test connection
        client = AsyncIOMotorClient(settings.MONGODB_URI)
        
        # Test database access
        db = client[settings.MONGODB_DB]
        
        # Simple ping test
        await client.admin.command('ping')
        print("✅ MongoDB ping successful!")
        
        # Test database operations
        test_collection = db.test_connection
        
        # Insert test document
        result = await test_collection.insert_one({"test": "connection", "status": "working"})
        print(f"✅ Insert successful: {result.inserted_id}")
        
        # Read test document
        doc = await test_collection.find_one({"_id": result.inserted_id})
        print(f"✅ Read successful: {doc}")
        
        # Clean up
        await test_collection.delete_one({"_id": result.inserted_id})
        print("✅ Cleanup successful")
        
        client.close()
        print("🎉 MongoDB connection test passed!")
        
    except Exception as e:
        print(f"❌ MongoDB test failed: {e}")
        print("\nTroubleshooting:")
        print("1. Check MongoDB Atlas cluster is running")
        print("2. Verify username/password in connection string")
        print("3. Ensure IP address is whitelisted (0.0.0.0/0 for dev)")
        print("4. Check if database user has read/write permissions")

if __name__ == "__main__":
    asyncio.run(test_mongodb())