# QUICK START: Deploy Narralytics to Vercel in 5 Minutes

## Option 1: Deploy via Vercel Dashboard (Easiest - 2 min)

### Steps:
1. **Go to**: https://vercel.com/new
2. **Click**: "Import Project" 
3. **Enter GitHub URL**: `https://github.com/Suvam-paul145/Narralytics`
   - *If not connected to GitHub, click "Sign in with GitHub"*
4. **Configure Project**:
   - **Project Name**: `narralytics` (or your choice)
   - **Framework**: `Vite`
   - **Root Directory**: `./` (or leave default)
   - **Build Command**: `cd frontend && npm run build`
   - **Output Directory**: `frontend/dist`

5. **Add Environment Variable**:
   - Click "Add"
   - **Name**: `VITE_API_URL`
   - **Value**: `http://localhost:8000` (for now - change later)
   - Click "Add"

6. **Deploy**: Click "Deploy" button
   - Wait 1-2 minutes for build
   - You'll see your **live URL**: `https://narralytics.vercel.app`

✅ **Done!** Your frontend is live.

---

## Option 2: Deploy via Terminal (If you prefer CLI)

### Prerequisites:
- Node.js installed
- GitHub repository connected to Vercel

### Steps:

```bash
# Login to Vercel
npm run vercel:login

# Link your project
npm run vercel:link

# Set backend URL
npm run vercel:env

# Deploy to production
npm run vercel:deploy
```

---

## Option 3: Deploy with npm Scripts (Automatic)

We've added convenient npm scripts to `package.json`. From the project root:

```bash
npm run deploy:vercel
```

This runs all steps automatically.

---

## After Deployment

### 1. Verify Frontend is Live
- Open your Vercel URL in browser
- You should see the Narralytics login page

### 2. Configure Backend

The frontend is now deployed, but needs a backend API. Choose one:

#### A. Keep Backend Local (Development)
```bash
cd backend
python start_server.py
```
- Backend runs at `http://localhost:8000`
- Frontend will connect via `VITE_API_URL`

#### B. Deploy Backend to Render (Recommended)
1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Runtime**: Python 3.10
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && uvicorn main:app --host 0.0.0.0 --port 8000`
   - **Environment Variables**:
     ```
     GROQ_API_KEY=your_key_here
     MONGODB_URI=your_mongodb_uri
     JWT_SECRET=your_secret
     FRONTEND_URL=your_vercel_url
     FRONTEND_ORIGINS=your_vercel_url
     GOOGLE_CLIENT_ID=your_google_id
     GOOGLE_CLIENT_SECRET=your_google_secret
     REDIRECT_URI=https://your-render-url/auth/callback
     ```
5. Deploy and grab the URL (e.g., `https://narralytics-api.onrender.com`)
6. Update `VITE_API_URL` in Vercel to this URL
7. Redeploy frontend in Vercel

---

## Environment Variables Reference

### For Vercel (Frontend):
| Variable | Value | Example |
|----------|-------|---------|
| `VITE_API_URL` | Backend URL | `http://localhost:8000` or `https://narralytics-api.onrender.com` |

### For Backend (Render/Railway):
| Variable | Where to Get | Example |
|----------|--------------|---------|
| `GROQ_API_KEY` | https://console.groq.com | `gsk_xxxxxxxxxxxx` |
| `MONGODB_URI` | MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/narralytics` |
| `JWT_SECRET` | Generate random | `openssl rand -hex 32` |
| `FRONTEND_URL` | Your Vercel URL | `https://narralytics.vercel.app` |
| `FRONTEND_ORIGINS` | Your Vercel URL | `https://narralytics.vercel.app` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console | `xxx...yyy.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | `xxx` |
| `REDIRECT_URI` | Backend URL | `https://narralytics-api.onrender.com/auth/callback` |

---

## Troubleshooting

### Frontend shows "Cannot connect to API"
- **Check**: Is `VITE_API_URL` set in Vercel?
- **Check**: Is backend running or deployed?
- **Fix**: Set correct backend URL and redeploy

### Build fails on Vercel
- **Check**: Is Node.js version compatible?
- **Fix**: Ensure `frontend/package-lock.json` exists
- **Fix**: Run `cd frontend && npm ci`

### Backend deployment fails
- **Check**: Are all environment variables set?
- **Check**: Is `backend/requirements.txt` up to date?
- **Fix**: Add missing variables in Render/Railway dashboard

---

## Monitoring & Debugging

### Vercel Dashboard:
- https://vercel.com/dashboard
- Click project → Deployments → View logs

### Render Dashboard:
- https://dashboard.render.com
- Click service → Runtime logs

### Frontend Console (Browser):
- Press F12 → Console tab
- Look for network errors or CORS issues

---

## All Set! 🚀

Your Narralytics app is now deployed! 

**Next**: Follow "Configure Backend" section above to get the full app working.

Need help? Check `VERCEL_DEPLOYMENT.md` for detailed architecture and all options.
