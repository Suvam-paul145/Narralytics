# Narralytics - Vercel Deployment Guide

## Overview
This guide covers deploying Narralytics to Vercel with a backend deployed separately.

---

## Architecture

```
┌─────────────────────────────────────────┐
│  VERCEL (Frontend)                      │
│  - React + Vite                         │
│  - Static HTML/JS/CSS                   │
│  - Deployed from frontend/ folder       │
└─────────────────┬───────────────────────┘
                  │
                  │ API calls (HTTPS)
                  ▼
          ┌───────────────────┐
          │  Backend (External)│
          │  - FastAPI        │
          │  - Render.com OR  │
          │  - Railway.app OR │
          │  - AWS Lightsail  │
          │  - Your own server│
          └───────────────────┘
```

---

## Step 1: Vercel CLI Installation & Login

```bash
npm install -g vercel
vercel login
# Follow the browser to authenticate with your Vercel account
```

---

## Step 2: Deploy Frontend to Vercel

### Option A: Using Vercel Dashboard (Easiest)
1. Go to https://vercel.com/new
2. Select "Import Project"
3. Paste your GitHub repository URL
4. Select **Framework Preset**: Vite  
5. **Root Directory**: `./frontend`
6. Click "Deploy"

### Option B: Using Vercel CLI
From the project root (c:\Users\suvam\Desktop\VS code\Projects\Narralytics):

```bash
vercel deploy --prod
```

You'll be prompted for:
- Project name: `narralytics` (or your choice)
- Directory to publish: `frontend/dist`
- Build command: `cd frontend && npm run build`

---

## Step 3: Set Environment Variables in Vercel

After deployment, configure the backend URL:

### Via Vercel Dashboard:
1. Go to your project settings: https://vercel.com/dashboard
2. Select "narralytics" project
3. Navigate to **Settings → Environment Variables**
4. Add variable: `VITE_API_URL` = `https://your-backend-url.com`
   - Example: `https://narralytics-api.render.com`
   - Or: `http://localhost:8000` (for local development)
5. Redeploy: Click "Deployments" → Click latest → "Redeploy"

### Via CLI:
```bash
vercel env add VITE_API_URL
# Paste your backend URL
vercel deploy --prod
```

---

## Step 4: Backend Deployment Options

### Option A: Deploy to Render (Recommended for FastAPI)

1. Go to https://render.com/register
2. Connect your GitHub repo
3. Create a **New Web Service**
4. Configure:
   - **Repository**: Your Narralytics fork
   - **Branch**: `copilot/build-conversational-ai-dashboard`
   - **Runtime**: `Python 3.10`
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
   - **Environment Variables** (add all from backend/config.py):
     - `GROQ_API_KEY`: Your Groq API key
     - `MONGODB_URI`: Your MongoDB connection string
     - `GOOGLE_CLIENT_ID`: OAuth client ID
     - `GOOGLE_CLIENT_SECRET`: OAuth client secret
     - `JWT_SECRET`: A secure random string
     - `FRONTEND_URL`: Your Vercel frontend URL  
     - `FRONTEND_ORIGINS`: Your Vercel frontend URL
     - `REDIRECT_URI`: `https://<your-render-url>/auth/callback`

5. Click "Deploy"
6. Copy the deployment URL (e.g., `https://narralytics-api.onrender.com`)
7. Set `VITE_API_URL` in Vercel to this URL

### Option B: Deploy to Railway

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Select your repository
4. Configure:
   - **Python Version**: 3.10
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Environment Variables**: Same as Render (above)
5. Deploy and grab the URL

### Option C: Keep Backend Local (Development Only)

For testing, keep your backend running locally:
```bash
cd backend
python start_server.py
```

Then set `VITE_API_URL` in Vercel to:
- **For production**: Point to your deployed backend (Render/Railway)
- **For development**: Leave as `http://localhost:8000` and test locally

---

## Step 5: Verify Deployment

1. **Frontend**: Open your Vercel URL (e.g., `https://narralytics.vercel.app`)
2. **Backend**: Should auto-connect if `VITE_API_URL` is set correctly
3. **Test**: Upload a CSV, ask a query → Should see chart or response
4. **Check Logs**: 
   - Vercel: Dashboard → Project → "Deployments" → View logs
   - Render/Railway: Dashboard → View logs

---

## Step 6: Custom Domain (Optional)

1. In Vercel Dashboard → Settings → Domains
2. Add your custom domain
3. Update DNS records with Vercel's instructions
4. Backend URL might need updating if using custom domain

---

## Troubleshooting

### Frontend shows "Cannot reach API"
- **Check**: Is backend URL set in `VITE_API_URL`?
- **Check**: Is backend running/reachable?
- **Check**: Browser Console (F12) for CORS errors
- **Fix**: Add backend URL to CORS whitelist in backend/config.py

### Build fails on Vercel
- **Check**: Is `frontend/package.json` up to date?
- **Check**: Check build logs in Vercel Dashboard
- **Fix**: `npm ci` instead of `npm install`

### "GROQ_API_KEY is missing"
- **Check**: Is environment variable set in Render/Railway?
- **Fix**: Set all required variables from backend/config.py

### File uploads not working
- **Issue**: Render/Railway has ephemeral storage
- **Solution**: AWS S3 or MongoDB File Storage
- **For now**: Test locally with backend running on your machine

---

## Files Reference

- **Frontend entry**: `frontend/src/main.jsx`
- **Build output**: `frontend/dist/` (auto-generated on deploy)
- **Backend entry**: `backend/main.py`
- **Configuration**: `vercel.json` (for Vercel) + environment variables
- **API Base URL**: Set via `VITE_API_URL` environment variable

---

## Environment Variables Checklist

### Required for Frontend (in Vercel):
- [ ] `VITE_API_URL` - Backend URL

### Required for Backend (in Render/Railway):
- [ ] `GROQ_API_KEY` - Get from https://console.groq.com
- [ ] `MONGODB_URI` - MongoDB connection string
- [ ] `GOOGLE_CLIENT_ID` - OAuth credentials
- [ ] `GOOGLE_CLIENT_SECRET` - OAuth credentials
- [ ] `JWT_SECRET` - Random secure string (e.g., `openssl rand -hex 32`)
- [ ] `FRONTEND_URL` - Your Vercel frontend URL
- [ ] `FRONTEND_ORIGINS` - Same as FRONTEND_URL
- [ ] `REDIRECT_URI` - Backend URL + `/auth/callback`
- [ ] `AWS_REGION` - AWS region (e.g., `us-east-1`)
- [ ] `AWS_BUCKET` - S3 bucket name (if using S3)
- [ ] `DYNAMODB_TABLE` - DynamoDB table name (if using AWS)

---

## Next Steps

1. **Frontend**: Deploy to Vercel using CLI or Dashboard
2. **Backend**: Choose Render or Railway
3. **Connect**: Set `VITE_API_URL` in Vercel
4. **Test**: Load the frontend and try a query
5. **Monitor**: Check logs if issues arise

Good luck! 🚀
