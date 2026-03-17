#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Narralytics Backend Server Launcher
Comprehensive startup script with health checks and error handling
"""

import os
import sys
import subprocess
import time
from pathlib import Path
from typing import Optional, Tuple
import logging

# Configuration constants
MIN_PYTHON_VERSION = (3, 10)
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8000
DEPENDENCY_TIMEOUT = 300
LOG_LEVEL = "info"

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ServerStartupError(Exception):
    """Custom exception for server startup failures"""
    pass


def check_python_version() -> bool:
    """Check if Python version is compatible"""
    version = sys.version_info
    if version[:2] < MIN_PYTHON_VERSION:
        logger.error(f"Python {version.major}.{version.minor} detected. Python {MIN_PYTHON_VERSION[0]}.{MIN_PYTHON_VERSION[1]}+ required.")
        return False
    logger.info(f"Python {version.major}.{version.minor}.{version.micro} - Compatible")
    return True

def check_environment() -> bool:
    """Check if we're in the correct directory and environment"""
    required_files = ["main.py", "requirements.txt"]
    
    for file_name in required_files:
        if not Path(file_name).exists():
            logger.error(f"{file_name} not found! Make sure you're in the backend directory.")
            return False
    
    logger.info("Environment check passed")
    return True

def install_dependencies() -> bool:
    """Install or update dependencies"""
    logger.info("Installing/updating dependencies...")
    
    cmd = [
        sys.executable, "-m", "pip", "install", 
        "-r", "requirements.txt", "--upgrade", "--quiet"
    ]
    
    try:
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True, 
            timeout=DEPENDENCY_TIMEOUT,
            check=False
        )
        
        if result.returncode != 0:
            logger.error(f"Dependency installation failed: {result.stderr}")
            return False
        
        logger.info("Dependencies installed successfully")
        return True
        
    except subprocess.TimeoutExpired:
        logger.error(f"Dependency installation timed out after {DEPENDENCY_TIMEOUT} seconds")
        return False
    except Exception as e:
        logger.error(f"Dependency installation error: {e}")
        return False

def run_health_check() -> bool:
    """Run basic configuration and import tests"""
    logger.info("Running health checks...")
    
    # Test core imports
    required_modules = [
        ("fastapi", "FastAPI framework"),
        ("uvicorn", "ASGI server"),
        ("pydantic", "Data validation"),
        ("motor", "MongoDB async driver")
    ]
    
    for module_name, description in required_modules:
        try:
            __import__(module_name)
            logger.debug(f"✓ {description} import successful")
        except ImportError as e:
            logger.error(f"Import error for {module_name} ({description}): {e}")
            return False
    
    # Test configuration
    try:
        from config import settings
        logger.info("Configuration loaded successfully")
    except Exception as e:
        logger.error(f"Configuration error: {e}")
        return False
    
    logger.info("All health checks passed")
    return True

def start_development_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    """Start the FastAPI development server"""
    print(f"\n🚀 Starting Narralytics Backend Server...")
    print(f"📍 Server URL: http://localhost:{port}")
    print(f"📚 API Docs: http://localhost:{port}/docs")
    print(f"🏥 Health Check: http://localhost:{port}/health")
    print(f"🔄 Auto-reload: Enabled")
    print("\n" + "="*50)
    print("Press Ctrl+C to stop the server")
    print("="*50 + "\n")
    
    cmd = [
        sys.executable, "-m", "uvicorn", 
        "main:app", 
        "--reload", 
        "--host", host, 
        "--port", str(port),
        "--log-level", LOG_LEVEL
    ]
    
    try:
        subprocess.run(cmd, check=False)
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
    except FileNotFoundError:
        logger.error("uvicorn not found. Please install it: pip install uvicorn")
        raise ServerStartupError("uvicorn not available")
    except Exception as e:
        logger.error(f"Server error: {e}")
        print(f"\n❌ Server error: {e}")
        print("\n🔧 Troubleshooting:")
        print(f"1. Check if port {port} is available")
        print("2. Verify all dependencies are installed")
        print("3. Check your .env configuration")
        raise ServerStartupError(f"Failed to start server: {e}")

def run_startup_sequence() -> None:
    """Execute the complete startup sequence with proper error handling"""
    startup_steps = [
        ("Python version check", check_python_version),
        ("Environment check", check_environment),
        ("Health checks", run_health_check),
    ]
    
    for step_name, step_func in startup_steps:
        logger.info(f"Executing: {step_name}")
        if not step_func():
            logger.error(f"Failed: {step_name}")
            raise ServerStartupError(f"{step_name} failed")
    
    # Optional dependency installation
    logger.info("Executing: Dependency installation")
    if not install_dependencies():
        logger.warning("Dependency installation failed, continuing with existing dependencies...")


def main() -> None:
    """Main startup function with comprehensive error handling"""
    print("🎯 Narralytics Backend Startup")
    print("=" * 40)
    
    try:
        run_startup_sequence()
        start_development_server()
    except ServerStartupError as e:
        logger.error(f"Startup failed: {e}")
        print(f"\n❌ Startup failed: {e}")
        print("Please fix the issues above before starting the server.")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n🛑 Startup cancelled by user")
        sys.exit(0)
    except Exception as e:
        logger.exception("Unexpected error during startup")
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()