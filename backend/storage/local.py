"""Local filesystem storage backend."""

import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def save_upload(file_bytes: bytes, filename: str, upload_dir: Optional[str] = None) -> str:
    """
    Save uploaded file to local filesystem.
    
    Args:
        file_bytes: The file content as bytes
        filename: Name of the file to save
        upload_dir: Directory to save the file (optional, uses default if None)
        
    Returns:
        str: The local file path where the file was saved
        
    Raises:
        OSError: If file cannot be written
        ValueError: If filename is invalid
    """
    if not filename or filename.strip() == "":
        raise ValueError("Filename cannot be empty")
    
    # Use provided upload_dir or fall back to settings
    from config import settings
    target_dir = upload_dir or settings.UPLOAD_DIR
    
    try:
        os.makedirs(target_dir, exist_ok=True)
        file_path = os.path.join(target_dir, filename)
        
        with open(file_path, "wb") as file_handle:
            file_handle.write(file_bytes)
            
        logger.debug(f"File saved to local storage: {file_path}")
        return file_path
        
    except OSError as e:
        logger.error(f"Failed to save file {filename} to {target_dir}: {e}")
        raise OSError(f"Cannot save file to local storage: {e}") from e


def get_file_path(filename: str, upload_dir: Optional[str] = None) -> str:
    """
    Get the local file path for a stored file.
    
    Args:
        filename: Name of the file
        upload_dir: Directory where the file is stored (optional)
        
    Returns:
        str: The local file path
        
    Raises:
        ValueError: If filename is invalid
        FileNotFoundError: If file doesn't exist
    """
    if not filename or filename.strip() == "":
        raise ValueError("Filename cannot be empty")
    
    # Use provided upload_dir or fall back to settings
    from config import settings
    target_dir = upload_dir or settings.UPLOAD_DIR
    
    file_path = os.path.join(target_dir, filename)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found in local storage: {file_path}")
    
    logger.debug(f"Retrieved file path from local storage: {file_path}")
    return file_path
