"""
Example file demonstrating AWS S3 usage for IAM Policy Autopilot demo

This module provides a clean interface for common S3 operations with proper
error handling, logging, and performance optimizations.
"""
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Union

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Configure logging
logger = logging.getLogger(__name__)


class S3OperationError(Exception):
    """Custom exception for S3 operation failures"""
    pass


class S3Client:
    """
    S3 client wrapper with connection pooling and error handling
    
    Uses singleton pattern to reuse client connections and improve performance.
    """
    
    _instance: Optional['S3Client'] = None
    _client: Optional[boto3.client] = None
    
    def __new__(cls) -> 'S3Client':
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @property
    def client(self) -> boto3.client:
        """Get or create S3 client with connection reuse"""
        if self._client is None:
            try:
                self._client = boto3.client('s3')
                logger.info("S3 client initialized successfully")
            except NoCredentialsError:
                logger.error("AWS credentials not found")
                raise S3OperationError("AWS credentials not configured")
            except Exception as e:
                logger.error(f"Failed to initialize S3 client: {e}")
                raise S3OperationError(f"S3 client initialization failed: {e}")
        return self._client


@lru_cache(maxsize=1)
def get_s3_client() -> S3Client:
    """Get cached S3 client instance"""
    return S3Client()


def upload_file_to_s3(
    file_path: Union[str, Path], 
    bucket_name: str, 
    object_key: str,
    extra_args: Optional[Dict] = None
) -> bool:
    """
    Upload a file to S3 bucket with enhanced error handling and validation
    
    Args:
        file_path: Local path to the file to upload
        bucket_name: Target S3 bucket name
        object_key: S3 object key (path within bucket)
        extra_args: Optional extra arguments for upload (e.g., metadata, ACL)
    
    Returns:
        bool: True if upload successful, False otherwise
        
    Raises:
        S3OperationError: If upload fails due to configuration or permission issues
    """
    file_path = Path(file_path)
    
    # Validate inputs
    if not file_path.exists():
        logger.error(f"File not found: {file_path}")
        raise S3OperationError(f"File not found: {file_path}")
    
    if not bucket_name or not object_key:
        logger.error("Bucket name and object key are required")
        raise S3OperationError("Bucket name and object key cannot be empty")
    
    try:
        s3_client = get_s3_client().client
        
        # Add default extra args if not provided
        upload_args = extra_args or {}
        
        # Add file size for progress tracking on large files
        file_size = file_path.stat().st_size
        if file_size > 100 * 1024 * 1024:  # 100MB
            logger.info(f"Uploading large file ({file_size / 1024 / 1024:.1f}MB): {file_path}")
        
        s3_client.upload_file(str(file_path), bucket_name, object_key, ExtraArgs=upload_args)
        logger.info(f"Successfully uploaded {file_path} to s3://{bucket_name}/{object_key}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        
        if error_code == 'NoSuchBucket':
            logger.error(f"Bucket does not exist: {bucket_name}")
        elif error_code == 'AccessDenied':
            logger.error(f"Access denied to bucket: {bucket_name}")
        else:
            logger.error(f"S3 upload failed [{error_code}]: {error_msg}")
            
        raise S3OperationError(f"Upload failed: {error_msg}")
    
    except Exception as e:
        logger.error(f"Unexpected error during upload: {e}")
        raise S3OperationError(f"Upload failed: {e}")


def download_file_from_s3(
    bucket_name: str, 
    object_key: str, 
    local_path: Union[str, Path],
    create_dirs: bool = True
) -> bool:
    """
    Download a file from S3 bucket with enhanced error handling
    
    Args:
        bucket_name: Source S3 bucket name
        object_key: S3 object key to download
        local_path: Local path where file will be saved
        create_dirs: Whether to create parent directories if they don't exist
    
    Returns:
        bool: True if download successful, False otherwise
        
    Raises:
        S3OperationError: If download fails due to configuration or permission issues
    """
    local_path = Path(local_path)
    
    # Validate inputs
    if not bucket_name or not object_key:
        logger.error("Bucket name and object key are required")
        raise S3OperationError("Bucket name and object key cannot be empty")
    
    # Create parent directories if requested
    if create_dirs and local_path.parent:
        local_path.parent.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created directory: {local_path.parent}")
    
    try:
        s3_client = get_s3_client().client
        
        # Check if object exists first
        try:
            s3_client.head_object(Bucket=bucket_name, Key=object_key)
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                logger.error(f"Object not found: s3://{bucket_name}/{object_key}")
                raise S3OperationError(f"Object not found: {object_key}")
            raise
        
        s3_client.download_file(bucket_name, object_key, str(local_path))
        logger.info(f"Successfully downloaded s3://{bucket_name}/{object_key} to {local_path}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        
        if error_code == 'NoSuchBucket':
            logger.error(f"Bucket does not exist: {bucket_name}")
        elif error_code == 'AccessDenied':
            logger.error(f"Access denied to object: s3://{bucket_name}/{object_key}")
        else:
            logger.error(f"S3 download failed [{error_code}]: {error_msg}")
            
        raise S3OperationError(f"Download failed: {error_msg}")
    
    except Exception as e:
        logger.error(f"Unexpected error during download: {e}")
        raise S3OperationError(f"Download failed: {e}")


def list_s3_objects(
    bucket_name: str, 
    prefix: str = "", 
    max_keys: int = 1000,
    include_metadata: bool = False
) -> List[Dict]:
    """
    List objects in an S3 bucket with pagination support
    
    Args:
        bucket_name: S3 bucket name to list objects from
        prefix: Optional prefix to filter objects
        max_keys: Maximum number of objects to return
        include_metadata: Whether to include object metadata
    
    Returns:
        List[Dict]: List of object information dictionaries
        
    Raises:
        S3OperationError: If listing fails due to configuration or permission issues
    """
    if not bucket_name:
        logger.error("Bucket name is required")
        raise S3OperationError("Bucket name cannot be empty")
    
    try:
        s3_client = get_s3_client().client
        objects = []
        
        # Use paginator for efficient handling of large buckets
        paginator = s3_client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(
            Bucket=bucket_name,
            Prefix=prefix,
            PaginationConfig={'MaxItems': max_keys}
        )
        
        for page in page_iterator:
            if 'Contents' in page:
                for obj in page['Contents']:
                    obj_info = {
                        'key': obj['Key'],
                        'size': obj['Size'],
                        'last_modified': obj['LastModified'],
                        'etag': obj['ETag'].strip('"')
                    }
                    
                    # Add metadata if requested
                    if include_metadata:
                        try:
                            metadata_response = s3_client.head_object(
                                Bucket=bucket_name, 
                                Key=obj['Key']
                            )
                            obj_info['metadata'] = metadata_response.get('Metadata', {})
                            obj_info['content_type'] = metadata_response.get('ContentType', '')
                        except ClientError:
                            logger.warning(f"Could not retrieve metadata for {obj['Key']}")
                    
                    objects.append(obj_info)
        
        logger.info(f"Listed {len(objects)} objects from s3://{bucket_name}/{prefix}")
        return objects
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        
        if error_code == 'NoSuchBucket':
            logger.error(f"Bucket does not exist: {bucket_name}")
        elif error_code == 'AccessDenied':
            logger.error(f"Access denied to bucket: {bucket_name}")
        else:
            logger.error(f"S3 list failed [{error_code}]: {error_msg}")
            
        raise S3OperationError(f"List operation failed: {error_msg}")
    
    except Exception as e:
        logger.error(f"Unexpected error during list operation: {e}")
        raise S3OperationError(f"List operation failed: {e}")


def delete_s3_object(bucket_name: str, object_key: str) -> bool:
    """
    Delete an object from S3 bucket
    
    Args:
        bucket_name: S3 bucket name
        object_key: S3 object key to delete
    
    Returns:
        bool: True if deletion successful
        
    Raises:
        S3OperationError: If deletion fails
    """
    if not bucket_name or not object_key:
        logger.error("Bucket name and object key are required")
        raise S3OperationError("Bucket name and object key cannot be empty")
    
    try:
        s3_client = get_s3_client().client
        s3_client.delete_object(Bucket=bucket_name, Key=object_key)
        logger.info(f"Successfully deleted s3://{bucket_name}/{object_key}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_msg = e.response['Error']['Message']
        logger.error(f"S3 delete failed [{error_code}]: {error_msg}")
        raise S3OperationError(f"Delete failed: {error_msg}")
    
    except Exception as e:
        logger.error(f"Unexpected error during delete: {e}")
        raise S3OperationError(f"Delete failed: {e}")


def check_bucket_exists(bucket_name: str) -> bool:
    """
    Check if an S3 bucket exists and is accessible
    
    Args:
        bucket_name: S3 bucket name to check
    
    Returns:
        bool: True if bucket exists and is accessible
    """
    if not bucket_name:
        return False
    
    try:
        s3_client = get_s3_client().client
        s3_client.head_bucket(Bucket=bucket_name)
        return True
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code in ['NoSuchBucket', 'AccessDenied']:
            logger.debug(f"Bucket check failed [{error_code}]: {bucket_name}")
        else:
            logger.warning(f"Unexpected error checking bucket {bucket_name}: {e}")
        return False
    except Exception as e:
        logger.warning(f"Error checking bucket {bucket_name}: {e}")
        return False