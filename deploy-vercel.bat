@echo off
REM Vercel Deployment Script for Narralytics
REM This script will authenticate and deploy your app to Vercel

setlocal enabledelayedexpansion

echo.
echo =====================================================
echo   NARRALYTICS - VERCEL DEPLOYMENT ASSISTANT
echo =====================================================
echo.

REM Step 1: Authenticate with Vercel
echo [Step 1/4] Authenticating with Vercel...
echo.
echo A browser window will open. Please login with your Vercel account.
echo If asked, authorize the Vercel CLI.
echo.
pause
vercel login

if errorlevel 1 (
    echo Error: Vercel login failed. Please try again.
    exit /b 1
)

echo Authentication successful!
echo.

REM Step 2: Link Project
echo [Step 2/4] Linking your project to Vercel...
echo.
cd /d "%~dp0"
vercel link --yes

if errorlevel 1 (
    echo Error: Failed to link project.
    exit /b 1
)

echo Project linked!
echo.

REM Step 3: Set Environment Variables
echo [Step 3/4] Setting up environment variables...
echo.
echo You'll now be asked to configure environment variables.
echo IMPORTANT: Set these values:
echo   - VITE_API_URL: Your backend URL (e.g., http://localhost:8000 for dev)
echo.
vercel env add VITE_API_URL

if errorlevel 1 (
    echo Warning: Could not set environment variable. You can add it manually in Vercel Dashboard.
)

echo.

REM Step 4: Deploy
echo [Step 4/4] Deploying to Vercel...
echo.
echo Deploying your application...
echo.
vercel deploy --prod

if errorlevel 1 (
    echo Error: Deployment failed.
    exit /b 1
)

echo.
echo =====================================================
echo   DEPLOYMENT SUCCESSFUL!
echo =====================================================
echo.
echo Your Narralytics app is now live on Vercel!
echo.
echo Next steps:
echo   1. Check your deployment URL (shown above)
echo   2. Make sure backend is running or deployed
echo   3. Test the app with a sample query
echo.
echo For backend deployment options, see VERCEL_DEPLOYMENT.md
echo.
pause
