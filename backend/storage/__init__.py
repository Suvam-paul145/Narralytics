"""
Environment-aware storage module.

Automatically switches between local and S3 storage based on configuration.
Provides a unified interface for file storage operations that selects the
appropriate backend (local filesystem or S3) based on runtime environment.

Selection Logic:
- S3 backend: AWS_BUCKET configured AND running in Lambda environment
- Local backend: All other cases (development, missing config, etc.)
"""

import logging
import os
from typing import Callable, Optional

from config import settings

logger = logging.getLogger(__name__)

# Type aliases for the storage functions
SaveUploadFunc = Callable[[bytes, str, Optional[str]], str]
GetFilePathFunc = Callable[[str, Optional[str]], str]


def _initialize_storage_backend() -> tuple[SaveUploadFunc, GetFilePathFunc]:
    """
    Initialize and return the appropriate storage backend functions.
    
    Returns:
        tuple: (save_upload function, get_file_path function)
        
    Raises:
        RuntimeError: If no storage backend can be initialized
    """
    # Check environment conditions for S3
    is_lambda = bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
    has_s3_config = bool(settings.AWS_BUCKET and settings.AWS_REGION)
    
    if has_s3_config and is_lambda:
        try:
            logger.info("Initializing S3 storage backend (Lambda environment)")
            from .s3 import save_upload, get_file_path
            logger.debug("S3 storage backend successfully initialized")
            return save_upload, get_file_path
        except ImportError as e:
            logger.warning(f"S3 backend import failed, falling back to local: {e}")
        except Exception as e:
            logger.warning(f"S3 backend initialization failed, falling back to local: {e}")
    
    # Fallback to local storage
    try:
        env_type = "Lambda" if is_lambda else "local"
        s3_status = "configured" if has_s3_config else "not configured"
        logger.info(f"Initializing local storage backend ({env_type} environment, S3 {s3_status})")
        
        from .local import save_upload, get_file_path
        logger.debug("Local storage backend successfully initialized")
        return save_upload, get_file_path
    except ImportError as e:
        logger.error(f"Local storage backend import failed: {e}")
        raise RuntimeError(f"No storage backend available: {e}") from e


# Initialize storage backend at module load time
try:
    save_upload, get_file_path = _initialize_storage_backend()
except Exception as e:
    logger.critical(f"Storage module initialization failed: {e}")
    raise

__all__ = ["save_upload", "get_file_path"]