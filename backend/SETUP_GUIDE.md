# 🚀 Narralytics Backend Setup Guide

Complete step-by-step guide to run the Narralytics backend system independently.

---

## 📋 Prerequisites

Before starting, ensure you have:

- **Python 3.11+** installed ([Download](https://www.python.org/downloads/))
- **MongoDB Atlas account** (free tier) ([Sign up](https://www.mongodb.com/cloud/atlas/register))
- **Google Cloud Console account** ([Sign up](https://console.cloud.google.com/))
- **Google AI Studio account** for Gemini API ([Get API Key](https://aistudio.google.com/app/apikey))
- **Git** installed (optional, for cloning)

---

## 🔧 Step 1: Clone or Download the Project

```bash
# If using Git
git clone <repository-url>
cd narralytics/backend

# Or download and extract the ZIP file, then navigate to backend folder
```

---

## 🐍 Step 2: Create Python Virtual Environment

### On Windows:
```bash
python -m venv venv
venv\Scripts\activate
```

### On macOS/Linux:
```bash
python3 -m venv venv
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

---

## 📦 Step 3: Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

This installs:
- FastAPI (web framework)
- Motor & PyMongo (MongoDB async driver)
- Pandas & NumPy (data processing)
- Google Generative AI (Gemini LLM)
- ReportLab (PDF generation)
- And all other dependencies

**Expected time**: 2-3 minutes

---

## 🔑 Step 4: Set Up Google OAuth 2.0

### 4.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "Narralytics" → Click "Create"
4. Wait for project creation (30 seconds)

### 4.2 Enable Google+ API

1. In the left sidebar, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it → Click "Enable"

### 4.3 Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" → Click "Create"
3. Fill in:
   - **App name**: Narralytics
   - **User support email**: Your email
   - **Developer contact**: Your email
4. Click "Save and Continue"
5. Click "Add or Remove Scopes"
   - Select: `openid`, `email`, `profile`
6. Click "Save and Continue"
7. Add test users (your email) → Click "Save and Continue"

### 4.4 Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Application type: "Web application"
4. Name: "Narralytics Backend"
5. **Authorized redirect URIs**: Add `http://localhost:8000/auth/callback`
6. Click "Create"
7. **IMPORTANT**: Copy the Client ID and Client Secret (you'll need these)

---

## 🗄️ Step 5: Set Up MongoDB Atlas

### 5.1 Create MongoDB Cluster

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Sign up or log in
3. Click "Build a Database"
4. Choose "M0 Free" tier
5. Select a cloud provider and region (closest to you)
6. Cluster name: "Narralytics" (or keep default)
7. Click "Create"

**Wait 3-5 minutes** for cluster provisioning.

### 5.2 Create Database User

1. Click "Database Access" in left sidebar
2. Click "Add New Database User"
3. Authentication Method: "Password"
4. Username: `narralytics_user`
5. Password: Click "Autogenerate Secure Password" → **Copy it!**
6. Database User Privileges: "Read and write to any database"
7. Click "Add User"

### 5.3 Configure Network Access

1. Click "Network Access" in left sidebar
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for development)
   - IP Address: `0.0.0.0/0`
4. Click "Confirm"

### 5.4 Get Connection String

1. Click "Database" in left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Driver: Python, Version: 3.12 or later
5. **Copy the connection string**
   - It looks like: `mongodb+srv://username:password@cluster.mongodb.net/`
6. **Replace `<password>` with your actual password** (from step 5.2)

---

## 🤖 Step 6: Get Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Select your Google Cloud project (or create new)
5. **Copy the API key** (starts with `AIza...`)

---

## 📝 Step 7: Create Environment File

Create a file named `.env` in the `backend` folder:

```bash
# In backend folder
touch .env  # macOS/Linux
# OR
type nul > .env  # Windows
```

Open `.env` in a text editor and add:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=<YOUR_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>
REDIRECT_URI=http://localhost:8000/auth/callback
FRONTEND_URL=http://localhost:5173

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=narralytics

# Google Gemini
GEMINI_API_KEY=AIza-your-gemini-api-key

# Storage
UPLOAD_DIR=./uploads

# AWS (leave empty for local development)
AWS_REGION=us-east-1
AWS_BUCKET=
DYNAMODB_TABLE=
```

### Generate Secure JWT Secret

Run this command to generate a secure JWT secret:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Copy the output and replace `your-super-secret-jwt-key-change-this-to-random-string` with it.

---

## ✅ Step 8: Verify Configuration

Create a test script `test_config.py` in the backend folder:

```python
from config import settings

print("✓ Configuration loaded successfully!")
print(f"✓ MongoDB URI: {settings.MONGODB_URI[:30]}...")
print(f"✓ Google Client ID: {settings.GOOGLE_CLIENT_ID[:20]}...")
print(f"✓ Gemini API Key: {settings.GEMINI_API_KEY[:10]}...")
print(f"✓ Frontend URL: {settings.FRONTEND_URL}")
print("\nAll environment variables are configured correctly!")
```

Run it:

```bash
python test_config.py
```

You should see checkmarks confirming all variables are loaded.

---

## 🚀 Step 9: Start the Backend Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:

```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
Connected to MongoDB: narralytics
INFO:     Application startup complete.
```

---

## 🧪 Step 10: Test the Backend

### Test 1: Health Check

Open your browser and go to:
```
http://localhost:8000/health
```

You should see:
```json
{"status": "ok"}
```

### Test 2: API Documentation

Go to:
```
http://localhost:8000/docs
```

You should see the interactive Swagger UI with all API endpoints.

### Test 3: MongoDB Connection

Create `test_db_connection.py`:

```python
import asyncio
from database.mongodb import connect_mongodb, get_db

async def test_connection():
    await connect_mongodb()
    db = get_db()
    
    # Test write
    result = await db.test_collection.insert_one({"test": "data"})
    print(f"✓ Write test successful! ID: {result.inserted_id}")
    
    # Test read
    doc = await db.test_collection.find_one({"test": "data"})
    print(f"✓ Read test successful! Document: {doc}")
    
    # Cleanup
    await db.test_collection.delete_one({"_id": result.inserted_id})
    print("✓ MongoDB connection is working perfectly!")

asyncio.run(test_connection())
```

Run it:
```bash
python test_db_connection.py
```

### Test 4: Google OAuth Flow

1. Go to: `http://localhost:8000/auth/google`
2. You should be redirected to Google sign-in
3. Sign in with your Google account
4. You should be redirected back with a JWT token in the URL

---

## 📂 Step 11: Create Upload Directory

```bash
mkdir uploads
```

This folder will store uploaded CSV files and SQLite databases.

---

## 🎯 Step 12: Test Full Workflow

### 12.1 Test File Upload

Create `test_upload.py`:

```python
import asyncio
import httpx
from pathlib import Path

async def test_upload():
    # First, get a JWT token (you'll need to do OAuth flow manually)
    token = "YOUR_JWT_TOKEN_HERE"  # Get from /auth/google flow
    
    # Create a test CSV
    test_csv = Path("test_data.csv")
    test_csv.write_text("date,revenue,region\n2024-01-01,1000,North\n2024-01-02,1500,South")
    
    async with httpx.AsyncClient() as client:
        with open(test_csv, "rb") as f:
            response = await client.post(
                "http://localhost:8000/datasets/upload",
                headers={"Authorization": f"Bearer {token}"},
                files={"file": ("test_data.csv", f, "text/csv")}
            )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    
    test_csv.unlink()  # Clean up

# Run: asyncio.run(test_upload())
```

---

## 🔍 Troubleshooting

### Issue: "ModuleNotFoundError"
**Solution**: Make sure virtual environment is activated and dependencies are installed:
```bash
pip install -r requirements.txt
```

### Issue: "MongoDB connection failed"
**Solution**: 
1. Check your MongoDB URI in `.env`
2. Ensure password is correct (no `<` `>` brackets)
3. Verify network access allows `0.0.0.0/0`

### Issue: "GEMINI_API_KEY is not configured"
**Solution**: 
1. Check `.env` file has `GEMINI_API_KEY=AIza...`
2. Restart the server after adding the key

### Issue: "OAuth redirect mismatch"
**Solution**: 
1. Go to Google Cloud Console → Credentials
2. Edit OAuth 2.0 Client
3. Ensure `http://localhost:8000/auth/callback` is in Authorized redirect URIs

### Issue: Port 8000 already in use
**Solution**: 
```bash
# Use a different port
uvicorn main:app --reload --port 8001

# Or kill the process using port 8000
# Windows: netstat -ano | findstr :8000
# macOS/Linux: lsof -ti:8000 | xargs kill
```

---

## 📊 Monitoring & Logs

### View Server Logs
The terminal running `uvicorn` shows all request logs:
```
INFO:     127.0.0.1:52000 - "GET /health HTTP/1.1" 200 OK
INFO:     127.0.0.1:52001 - "POST /datasets/upload HTTP/1.1" 200 OK
```

### Check MongoDB Data
1. Go to MongoDB Atlas → Database → Browse Collections
2. You should see:
   - `users` collection (after first login)
   - `datasets` collection (after first upload)
   - `conversation_history` collection (after first query)

---

## 🛑 Stopping the Server

Press `CTRL+C` in the terminal running uvicorn.

To deactivate the virtual environment:
```bash
deactivate
```

---

## 🔄 Restarting the Server

```bash
# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# OR
venv\Scripts\activate  # Windows

# Start server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📚 Next Steps

1. **Frontend Setup**: Follow the frontend setup guide to connect the React app
2. **Test Dataset**: Upload a real CSV file and test auto-dashboard generation
3. **API Testing**: Use the Swagger UI at `/docs` to test all endpoints
4. **Production Deployment**: See `AWS_MIGRATION_GUIDE.md` for AWS Lambda deployment

---

## 🆘 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review server logs for error messages
3. Verify all environment variables in `.env`
4. Ensure all external services (MongoDB, Google OAuth) are configured correctly

---

## ✅ Success Checklist

- [ ] Python 3.11+ installed
- [ ] Virtual environment created and activated
- [ ] All dependencies installed
- [ ] Google OAuth credentials created
- [ ] MongoDB Atlas cluster created
- [ ] Gemini API key obtained
- [ ] `.env` file configured
- [ ] Server starts without errors
- [ ] `/health` endpoint returns `{"status": "ok"}`
- [ ] `/docs` shows API documentation
- [ ] MongoDB connection test passes
- [ ] OAuth flow redirects correctly

---

**🎉 Congratulations! Your Narralytics backend is now running!**
