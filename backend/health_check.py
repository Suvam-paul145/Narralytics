#!/usr/bin/env python3
"""
Quick health check script for Narralytics Backend
Tests all critical components without starting the full server
"""

import sys
import traceback
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Any, List, Callable, Tuple, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)


class HealthStatus(Enum):
    """Health check status enumeration"""
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"


@dataclass
class HealthResult:
    """Structured health check result"""
    status: HealthStatus
    details: List[str]
    
    def add_detail(self, message: str) -> None:
        """Add a detail message to the result"""
        self.details.append(message)
    
    def set_error(self) -> None:
        """Mark result as error status"""
        self.status = HealthStatus.ERROR
    
    def set_warning(self) -> None:
        """Mark result as warning status"""
        if self.status == HealthStatus.SUCCESS:
            self.status = HealthStatus.WARNING


class HealthChecker:
    """Health check orchestrator with improved error handling and structure"""
    
    # Critical dependencies with their version attributes
    CRITICAL_DEPENDENCIES = [
        ("fastapi", "__version__", "FastAPI"),
        ("uvicorn", "__version__", "Uvicorn"),
        ("pydantic", "__version__", "Pydantic"),
        ("motor", "version", "Motor"),
        ("pandas", "__version__", "Pandas"),
    ]
    
    # Optional dependencies
    OPTIONAL_DEPENDENCIES = [
        ("groq", "__version__", "Groq"),
    ]
    
    def __init__(self):
        self.results: Dict[str, HealthResult] = {}
    
    def _test_dependency(self, module_name: str, version_attr: Optional[str], 
                        display_name: str, is_critical: bool = True) -> Tuple[bool, str]:
        """Test a single dependency import and version"""
        try:
            if "." in module_name:
                # Handle nested imports like google.genai
                parts = module_name.split(".")
                module = __import__(parts[0])
                for part in parts[1:]:
                    module = getattr(module, part)
            else:
                module = __import__(module_name)
            
            if version_attr and hasattr(module, version_attr):
                version = getattr(module, version_attr)
                return True, f"✅ {display_name} {version}"
            else:
                return True, f"✅ {display_name}"
                
        except ImportError as e:
            status_icon = "❌" if is_critical else "⚠️"
            return False, f"{status_icon} {display_name} import failed: {e}"
        except Exception as e:
            status_icon = "❌" if is_critical else "⚠️"
            return False, f"{status_icon} {display_name} error: {e}"

    def test_imports(self) -> HealthResult:
        """Test all critical and optional imports"""
        result = HealthResult(HealthStatus.SUCCESS, [])
        
        # Test critical dependencies
        for module_name, version_attr, display_name in self.CRITICAL_DEPENDENCIES:
            success, message = self._test_dependency(module_name, version_attr, display_name, True)
            result.add_detail(message)
            if not success:
                result.set_error()
        
        # Test optional dependencies
        for module_name, version_attr, display_name in self.OPTIONAL_DEPENDENCIES:
            success, message = self._test_dependency(module_name, version_attr, display_name, False)
            result.add_detail(message)
            if not success:
                result.set_warning()
        
        return result

    def test_config(self) -> HealthResult:
        """Test configuration loading and critical settings"""
        result = HealthResult(HealthStatus.SUCCESS, [])
        
        try:
            from config import settings
            result.add_detail("✅ Configuration loaded")
            
            # Define critical configuration checks
            config_checks = [
                (settings.GROQ_API_KEY, "Groq API key", True),
                (settings.MONGODB_URI, "MongoDB URI", True),
                (getattr(settings, 'JWT_SECRET', None), "JWT secret", True),
                (getattr(settings, 'GOOGLE_CLIENT_ID', None), "Google Client ID", False),
            ]
            
            for value, name, is_critical in config_checks:
                if value:
                    result.add_detail(f"✅ {name} configured")
                else:
                    icon = "❌" if is_critical else "⚠️"
                    result.add_detail(f"{icon} {name} not set")
                    if is_critical:
                        result.set_error()
                    else:
                        result.set_warning()
                        
        except Exception as e:
            result.set_error()
            result.add_detail(f"❌ Configuration error: {e}")
            logger.exception("Configuration loading failed")
        
        return result

    def test_app_creation(self) -> HealthResult:
        """Test FastAPI app creation and route registration"""
        result = HealthResult(HealthStatus.SUCCESS, [])
        
        try:
            from main import app
            result.add_detail("✅ FastAPI app created successfully")
            
            # Check routes
            route_count = len(app.routes)
            result.add_detail(f"✅ {route_count} routes registered")
            
            # Validate minimum expected routes
            if route_count < 5:  # Adjust based on your app's minimum routes
                result.set_warning()
                result.add_detail("⚠️ Fewer routes than expected")
                
        except Exception as e:
            result.set_error()
            result.add_detail(f"❌ App creation failed: {e}")
            # Only log full traceback in debug mode
            logger.debug("App creation traceback: %s", traceback.format_exc())
        
        return result

    def test_database_modules(self) -> HealthResult:
        """Test database module imports"""
        result = HealthResult(HealthStatus.SUCCESS, [])
        
        database_modules = ["mongodb", "users", "datasets", "history"]
        
        try:
            for module_name in database_modules:
                try:
                    __import__(f"database.{module_name}")
                except ImportError as e:
                    result.set_error()
                    result.add_detail(f"❌ Database module '{module_name}' import failed: {e}")
                    return result
            
            result.add_detail("✅ All database modules imported successfully")
            
        except Exception as e:
            result.set_error()
            result.add_detail(f"❌ Database module error: {e}")
        
        return result

    def test_llm_modules(self) -> HealthResult:
        """Test LLM module imports"""
        result = HealthResult(HealthStatus.SUCCESS, [])
        
        llm_modules = ["auto_dashboard", "chart_engine", "chat_engine", "query_generator"]
        
        try:
            for module_name in llm_modules:
                try:
                    __import__(f"llm.{module_name}")
                except ImportError as e:
                    result.set_error()
                    result.add_detail(f"❌ LLM module '{module_name}' import failed: {e}")
                    return result
            
            result.add_detail("✅ All LLM modules imported successfully")
            
        except Exception as e:
            result.set_error()
            result.add_detail(f"❌ LLM module error: {e}")
        
        return result

    def run_all_checks(self) -> bool:
        """Run all health checks and return overall success status"""
        test_suite = [
            ("Core Dependencies", self.test_imports),
            ("Configuration", self.test_config),
            ("FastAPI App", self.test_app_creation),
            ("Database Modules", self.test_database_modules),
            ("LLM Modules", self.test_llm_modules),
        ]
        
        print("🏥 Narralytics Backend Health Check")
        print("=" * 40)
        
        overall_success = True
        
        for test_name, test_func in test_suite:
            print(f"\n📋 {test_name}:")
            try:
                result = test_func()
                self.results[test_name] = result
                
                for detail in result.details:
                    print(f"  {detail}")
                
                if result.status == HealthStatus.ERROR:
                    overall_success = False
                elif result.status == HealthStatus.WARNING:
                    logger.warning(f"{test_name} completed with warnings")
                    
            except Exception as e:
                print(f"  ❌ Test failed unexpectedly: {e}")
                logger.exception(f"Unexpected error in {test_name}")
                overall_success = False
        
        return overall_success

    def print_summary(self, success: bool) -> None:
        """Print final health check summary"""
        print("\n" + "=" * 40)
        
        if success:
            print("🎉 All health checks passed! Backend is ready.")
            
            # Count warnings
            warning_count = sum(1 for result in self.results.values() 
                              if result.status == HealthStatus.WARNING)
            if warning_count > 0:
                print(f"⚠️ Note: {warning_count} check(s) completed with warnings")
        else:
            print("⚠️ Some health checks failed. Please review the issues above.")
            
            # Provide helpful next steps
            print("\n🔧 Troubleshooting steps:")
            print("1. Install missing dependencies: pip install -r requirements.txt")
            print("2. Check your .env configuration file")
            print("3. Verify all required services are accessible")


def main() -> None:
    """Main entry point for health checks"""
    try:
        checker = HealthChecker()
        success = checker.run_all_checks()
        checker.print_summary(success)
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n\n🛑 Health check interrupted by user")
        sys.exit(130)  # Standard exit code for SIGINT
    except Exception as e:
        logger.exception("Unexpected error during health check")
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()