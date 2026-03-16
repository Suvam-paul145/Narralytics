# Google OAuth Setup Guide

## Overview

This guide explains how to set up and use Google OAuth authentication in the Narralytics application. The OAuth system is fully implemented and ready to use with proper configuration.

## Current Status

✅ **Backend OAuth Implementation**: Complete
- OAuth endpoints (`/auth/google`, `/auth/callback`)
- User authentication and JWT token generation
- Database user management
- Secure credential handling

✅ **Frontend OAuth Integration**: Complete
- Google OAuth button enabled
- Authentication flow handling
- User context management
- Error handling and loading states

✅ **Configuration**: Ready
- Environment variables configured
- OAuth credentials set up
- Redirect URIs properly configured

## How It Works

### Authentication Flow

1. **User clicks "Continue with Google"** on the login page
2. **Redirect to Google**: User is redirected to Google's OAuth consent screen
3. **User grants permission**: User approves access to their Google account
4. **Google redirects back**: Google redirects to `/auth/callback` with authorization code
5. **Backend exchanges code**: Backend exchanges code for access token and user info
6. **User creation/update**: User is created or updated in MongoDB
7. **JWT token generation**: Backend generates JWT token with user information
8. **Frontend redirect**: User is redirected to frontend with token in URL hash
9. **Token storage**: Frontend stores token and fetches user information
10. **Dashboard access**: User is logged in and can access the dashboard

### User Experience

- **Seamless login**: Single click to authenticate with Google
- **Persistent sessions**: Users stay logged in across browser sessions
- **Profile information**: User's name, email, and profile picture are available
- **Secure logout**: Proper cleanup of tokens and session data

## Configuration Details

### Backend Configuration (`.env`)

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=<YOUR_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<YOUR_CLIENT_SECRET>

# OAuth Redirect URI
REDIRECT_URI=http://localhost:8000/auth/callback

# Frontend URL for post-auth redirects
FRONTEND_URL=http://localhost:5173

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret-key-here
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24
```

### Frontend Configuration (`.env`)

```env
VITE_API_URL=http://localhost:8000
```

## Google Cloud Console Setup

The OAuth credentials are already configured, but here's how they were set up:

### 1. Create Google Cloud Project
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select existing one

### 2. Enable Google+ API
- Navigate to "APIs & Services" → "Library"
- Search for "Google+ API" and enable it

### 3. Configure OAuth Consent Screen
- Go to "APIs & Services" → "OAuth consent screen"
- Choose "External" user type
- Fill in application information:
  - App name: "Narralytics"
  - User support email: Your email
  - Developer contact: Your email

### 4. Create OAuth 2.0 Credentials
- Go to "APIs & Services" → "Credentials"
- Click "Create Credentials" → "OAuth 2.0 Client ID"
- Choose "Web application"
- Configure:
  - Name: "Narralytics Web Client"
  - Authorized redirect URIs: `http://localhost:8000/auth/callback`

## Testing the OAuth Flow

### 1. Start the Backend
```bash
cd backend
python start_server.py
```

### 2. Start the Frontend
```bash
cd frontend
npm run dev
```

### 3. Test Authentication
1. Visit `http://localhost:5173`
2. Click "Continue with Google"
3. Complete Google OAuth flow
4. Verify you're redirected to the dashboard
5. Check that your profile information is displayed

### 4. Run OAuth Tests
```bash
cd backend
python test_oauth.py
```

## User Management

### Database Storage
Users are stored in MongoDB with the following structure:
```json
{
  "_id": "google_user_id",
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://profile-picture-url",
  "sub": "google_user_id",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### JWT Token Structure
```json
{
  "sub": "google_user_id",
  "email": "user@example.com", 
  "name": "User Name",
  "picture": "https://profile-picture-url",
  "exp": 1640995200,
  "iat": 1640908800
}
```

## Security Features

### Token Security
- JWT tokens are signed with a secure secret
- Tokens expire after 24 hours
- Tokens are stored securely in localStorage
- Invalid tokens are automatically cleared

### OAuth Security
- Uses PKCE (Proof Key for Code Exchange) flow
- Secure redirect URI validation
- State parameter for CSRF protection
- Proper scope limitations (openid, email, profile)

### API Security
- Protected routes require valid JWT tokens
- User context is validated on each request
- Proper error handling for invalid tokens

## Troubleshooting

### Common Issues

1. **"OAuth redirect failed"**
   - Check REDIRECT_URI matches Google Cloud Console exactly
   - Verify FRONTEND_URL is correct
   - Ensure OAuth consent screen is configured

2. **"Token validation failed"**
   - Check JWT_SECRET is properly set
   - Verify token hasn't expired
   - Ensure backend and frontend are using same API URL

3. **"User not found"**
   - Check MongoDB connection
   - Verify user creation in database
   - Check database permissions

### Debug Steps

1. **Check Configuration**
   ```bash
   python test_oauth.py
   ```

2. **Verify Endpoints**
   ```bash
   curl http://localhost:8000/auth/google
   curl http://localhost:8000/api/health
   ```

3. **Check Logs**
   - Backend logs show OAuth flow details
   - Browser console shows frontend errors
   - Network tab shows API requests

## Production Deployment

### Backend Changes
1. Update `REDIRECT_URI` to production API URL
2. Update `FRONTEND_URL` to production domain
3. Add production redirect URI to Google Cloud Console
4. Use environment variables for secrets

### Frontend Changes
1. Update `VITE_API_URL` to production API URL
2. Ensure CORS is properly configured
3. Use HTTPS for production URLs

### Security Considerations
- Use HTTPS in production
- Rotate JWT secrets regularly
- Monitor OAuth usage and errors
- Implement rate limiting
- Use secure cookie settings

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Run `python system_check.py` to verify configuration
3. Check backend and frontend logs for errors
4. Verify Google Cloud Console settings match configuration