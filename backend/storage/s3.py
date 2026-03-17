"""AWS S3 storage backend."""

import os
import logging
from typing import Optional
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_s3_client():
    """Get cached S3 client instance."""
    try:
        return boto3.client("s3", region_name=settings.AWS_REGION)
    except NoCredentialsError as e:
        logger.error("AWS credentials not configured")
        raise RuntimeError("AWS credentials not configured for S3 access") from e
    except Exception as e:
        logger.error(f"Failed to create S3 client: {e}")
        raise RuntimeError(f"S3 client initialization failed: {e}") from e


def save_upload(file_bytes: bytes, filename: str, upload_dir: Optional[str] = None) -> str:
    """
    Save uploaded file to S3.
    
    Args:
        file_bytes: The file content as bytes
        filename: Name of the file to save
        upload_dir: Not used in S3 backend (for interface compatibility)
        
    Returns:
        str: The S3 key where the file was saved
        
    Raises:
        ValueError: If configuration is invalid or filename is empty
        RuntimeError: If S3 upload fails
    """
    if not filename or filename.strip() == "":
        raise ValueError("Filename cannot be empty")
    
    if not settings.AWS_BUCKET:
        raise ValueError("AWS_BUCKET is not configured")
    
    # Sanitize filename and create S3 key
    safe_filename = filename.replace(" ", "_").replace("\\", "/")
    s3_key = f"uploads/{safe_filename}"
    
    try:
        s3_client = _get_s3_client()
        
        s3_client.put_object(
            Bucket=settings.AWS_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ServerSideEncryption='AES256'  # Enable server-side encryption
        )
        
        logger.info(f"File uploaded to S3: s3://{settings.AWS_BUCKET}/{s3_key}")
        return s3_key
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        logger.error(f"S3 upload failed ({error_code}): {e}")
        raise RuntimeError(f"Failed to upload file to S3: {error_code}") from e
    except Exception as e:
        logger.error(f"Unexpected error during S3 upload: {e}")
        raise RuntimeError(f"S3 upload failed: {e}") from e


def get_file_path(filename: str, upload_dir: Optional[str] = None) -> str:
    """
    Download file from S3 to local temporary storage and return the local path.
    
    Args:
        filename: Name of the file to retrieve
        upload_dir: Not used in S3 backend (for interface compatibility)
        
    Returns:
        str: The local temporary file path
        
    Raises:
        ValueError: If configuration is invalid or filename is empty
        FileNotFoundError: If file doesn't exist in S3
        RuntimeError: If S3 download fails
    """
    if not filename or filename.strip() == "":
        raise ValueError("Filename cannot be empty")
    
    if not settings.AWS_BUCKET:
        raise ValueError("AWS_BUCKET is not configured")
    
    # Sanitize filename and create S3 key
    safe_filename = filename.replace(" ", "_").replace("\\", "/")
    s3_key = f"uploads/{safe_filename}"
    
    # Create local temporary path
    local_path = os.path.join("/tmp", safe_filename)
    
    # Return existing file if already downloaded
    if os.path.exists(local_path):
        logger.debug(f"File already exists locally: {local_path}")
        return local_path
    
    try:
        s3_client = _get_s3_client()
        
        # Check if file exists in S3
        try:
            s3_client.head_object(Bucket=settings.AWS_BUCKET, Key=s3_key)
        except ClientError as e:
            if e.response.get('Error', {}).get('Code') == '404':
                raise FileNotFoundError(f"File not found in S3: {s3_key}")
            raise
        
        # Ensure local directory exists
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # Download file
        s3_client.download_file(settings.AWS_BUCKET, s3_key, local_path)
        
        logger.debug(f"File downloaded from S3 to: {local_path}")
        return local_path
        
    except FileNotFoundError:
        raise  # Re-raise as-is
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        logger.error(f"S3 download failed ({error_code}): {e}")
        raise RuntimeError(f"Failed to download file from S3: {error_code}") from e
    except Exception as e:
        logger.error(f"Unexpected error during S3 download: {e}")
        raise RuntimeError(f"S3 download failed: {e}") from e
