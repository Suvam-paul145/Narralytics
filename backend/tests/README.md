# Backend Tests

This directory contains all test files and testing utilities for the Narralytics backend.

## Structure

### Test Files
- `test_config.py` - Configuration testing and validation
- `test_db_init.py` - Database initialization tests
- `test_gemini_models.py` - Gemini AI model tests
- `test_gemini_simple.py` - Simple Gemini integration tests
- `test_health_endpoint.py` - Health check endpoint tests
- `test_mongodb_simple.py` - MongoDB connection tests
- `test_setup.py` - Setup and environment tests

### Directories
- `api-testing/` - API endpoint testing utilities

## Running Tests

### From Backend Root Directory

```bash
# Run the comprehensive test suite
python run_tests.py

# Run health check verification (requires server to be running)
python verify_health.py

# Run specific test file
python tests/test_health_endpoint.py

# Run configuration tests (used by start_server.py)
python tests/test_config.py
```

### Using pytest (if available)

```bash
# Run all tests
python -m pytest tests/

# Run specific test file
python -m pytest tests/test_mongodb_simple.py

# Run with verbose output
python -m pytest tests/ -v
```

## Health Check System

The backend includes a comprehensive health check system:

### Endpoints
- `/health` - Basic server status
- `/api/health` - Comprehensive health check including database connectivity

### Frontend Integration
The frontend automatically monitors system health using:
- `useHealthCheck` hook for periodic health monitoring
- `HealthStatus` component for displaying system status
- `SystemStatus` page for detailed health information

### Testing Health Checks
1. Start the backend server: `python start_server.py`
2. Run health verification: `python verify_health.py`
3. Or run the specific test: `python tests/test_health_endpoint.py`

## Test Environment

Make sure to set up your test environment variables in `.env` before running tests:

```env
MONGODB_URL=mongodb://localhost:27017
GEMINI_API_KEY=your_api_key_here
FRONTEND_URL=http://localhost:3000
```

## Continuous Integration

The health check system enables:
- Automatic system monitoring
- Early detection of service failures
- Real-time status updates in the frontend
- Graceful degradation when services are unavailable