# System Health Monitoring Setup

This document outlines the health monitoring system implemented for the Narralytics application.

## Backend Reorganization

### Test Files Moved
All test-related files have been moved from the backend root to `backend/tests/`:

- `test_config.py` → `backend/tests/test_config.py`
- `test_db_init.py` → `backend/tests/test_db_init.py`
- `test_gemini_models.py` → `backend/tests/test_gemini_models.py`
- `test_gemini_simple.py` → `backend/tests/test_gemini_simple.py`
- `test_mongodb_simple.py` → `backend/tests/test_mongodb_simple.py`
- `test_setup.py` → `backend/tests/test_setup.py`
- `api-testing/` → `backend/tests/api-testing/`

### New Test Files
- `backend/tests/test_health_endpoint.py` - Tests for the health check endpoints
- `backend/tests/README.md` - Documentation for running tests

## Health Check System

### Backend Health Endpoints

#### 1. Basic Health Check: `/health`
- Simple endpoint that returns `{"status": "ok"}`
- Confirms the API server is running
- Lightweight check for basic monitoring

#### 2. Comprehensive Health Check: `/api/health`
- Detailed system status including:
  - API server status
  - MongoDB connection status
  - System timestamp
  - Service-level health indicators

**Response Format:**
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "2026-03-16T23:30:00.000Z",
  "services": {
    "api": "healthy",
    "database": "healthy|disconnected|timeout|error"
  }
}
```

### Frontend Health Monitoring

#### 1. Health Check Hook: `useHealthCheck.js`
- Custom React hook for periodic health monitoring
- Configurable check interval (default: 30 seconds)
- Automatic error handling and retry logic
- Returns health status, loading state, and manual check function

#### 2. Health Status Component: `HealthStatus.jsx`
- Visual health indicator component
- Two modes: compact indicator and detailed status panel
- Color-coded status indicators (green/yellow/red)
- Real-time status updates

#### 3. System Status Page: `SystemStatus.jsx`
- Dedicated page for detailed system monitoring
- Manual health check trigger
- System information display
- Raw health data inspection

### Frontend Integration

#### App-Level Health Indicator
- Small health status indicator in top-right corner of all pages
- Always visible to users
- Non-intrusive monitoring

#### Navigation
- New route: `/system-status` for detailed health monitoring
- Protected route (requires authentication)

## Configuration

### Frontend Environment Variables
The frontend now uses a simplified `.env` file:
```
VITE_API_URL=http://localhost:8000
```

### API Configuration
New configuration file: `frontend/src/config/api.js`
- Centralized API endpoint definitions
- Environment-based URL configuration

## Testing the System

### Backend Testing
```bash
# Test health endpoints
cd backend
python tests/test_health_endpoint.py

# Run all tests
python -m pytest tests/ -v
```

### Manual Testing
1. Start the backend server: `python backend/main.py`
2. Test endpoints:
   - `GET http://localhost:8000/health`
   - `GET http://localhost:8000/api/health`

### Frontend Testing
1. Start the frontend: `npm run dev` (from frontend directory)
2. Check health indicator in top-right corner
3. Visit `/system-status` for detailed monitoring

## Monitoring Features

### Automatic Monitoring
- Health checks run every 30 seconds by default
- Failed checks trigger visual indicators
- Automatic retry on network errors

### Manual Monitoring
- Manual health check button on system status page
- Real-time status updates
- Detailed error information

### Status Indicators
- **Healthy (Green)**: All systems operational
- **Degraded (Yellow)**: API running but database issues
- **Unhealthy (Red)**: System errors or connectivity issues

## Benefits

1. **Proactive Monitoring**: Detect issues before users report them
2. **Clean Architecture**: Test files organized in dedicated directory
3. **Real-time Feedback**: Continuous health status visibility
4. **Debugging Support**: Detailed error information and system state
5. **Production Ready**: Scalable monitoring for deployment

## Future Enhancements

- Health check history/logging
- Performance metrics integration
- Alert notifications for critical failures
- Health check dashboard with charts
- Integration with external monitoring services