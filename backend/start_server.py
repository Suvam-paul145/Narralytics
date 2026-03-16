#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Quick Start Script for Narralytics Backend
Runs configuration tests and starts the development server
"""

import os
import sys
import subprocess
from pathlib import Path

def run_config_test():
    """Run configuration test first"""
    print("Running configuration tests...")
    try:
        # Set environment to handle Unicode properly
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        
        result = subprocess.run([sys.executable, "tests/test_config.py"], 
                              capture_output=True, text=True, env=env, encoding='utf-8')
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
        return result.returncode == 0
    except Exception as e:
        print(f"Failed to run config test: {e}")
        return False

def start_server():
    """Start the FastAPI development server"""
    print("\nStarting Narralytics Backend Server...")
    print("Server will be available at: http://localhost:8000")
    print("API Documentation: http://localhost:8000/docs")
    print("Health Check: http://localhost:8000/health")
    print("\nPress Ctrl+C to stop the server")
    print("-" * 50)
    
    try:
        # Start uvicorn server
        subprocess.run([
            sys.executable, "-m", "uvicorn", 
            "main:app", 
            "--reload", 
            "--host", "0.0.0.0", 
            "--port", "8000"
        ])
    except KeyboardInterrupt:
        print("\n\nServer stopped by user")
    except Exception as e:
        print(f"\nFailed to start server: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure you're in the backend directory")
        print("2. Check if port 8000 is already in use")
        print("3. Verify uvicorn is installed: pip install uvicorn")

def main():
    """Main function"""
    print("Narralytics Backend Quick Start")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not Path("main.py").exists():
        print("main.py not found!")
        print("Make sure you're running this from the backend directory")
        sys.exit(1)
    
    # Run configuration test
    if not run_config_test():
        print("\nConfiguration test failed!")
        print("Please fix the configuration issues before starting the server.")
        print("Run 'python tests/test_config.py' for detailed error information.")
        sys.exit(1)
    
    # Start the server
    start_server()

if __name__ == "__main__":
    main()