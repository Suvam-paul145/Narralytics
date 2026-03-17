# Design Document: Enhanced S3 Client

## Overview

This document outlines the technical design for enhancing the existing S3Client wrapper in the Narralytics backend. The design focuses on thread safety, performance optimization, robust error handling, and comprehensive monitoring while maintaining full backward compatibility.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Enhanced S3 Client Architecture              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Public API    │    │  Configuration  │    │   Logging    │ │
│  │   Interface     │◄──►│    Manager      │◄──►│   System     │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                     │       │
│           ▼                       ▼                     ▼       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  Thread-Safe    │    │     Retry       │    │   Metrics    │ │
│  │  S3 Client      │◄──►│    Handler      │◄──►│  Collector   │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                     │       │
│           ▼                       ▼                     ▼       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │  Connection     │    │   Exception     │    │    Batch     │ │
│  │     Pool        │◄──►│   Hierarchy     │◄──►│  Operations  │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                       │                     │       │
│           ▼                       ▼                     ▼       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    AWS Boto3 S3 Client                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Design

### 1. Configuration Manager

**File:** `backend/storage/config.py`

```python
@dataclass
class S3Config:
    """Configuration for S3 client operations"""
    
    # AWS Configuration
    region: str = "us-east-1"
    endpoint_url: Optional[str] = None
    
    # Connection Configuration
    max_connections: int = 10
    connection_timeout: int = 60
    read_timeout: int = 300
    
    # Retry Configuration
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 30.0
    backoff_multiplier: float = 2.0
    
    # Performance Configuration
    multipart_threshold: int = 64 * 1024 * 1024  # 64MB
    multipart_chunksize: int = 16 * 1024 * 1024  # 16MB
    
    # Logging Configuration
    log_level: str = "INFO"
    redact_sensitive: bool = True
    
    @classmethod
    def from_environment(cls) -> 'S3Config':
        """Create configuration from environment variables"""
        
    def validate(self) -> None:
        """Validate configuration parameters"""
        
    def to_boto3_config(self) -> Dict[str, Any]:
        """Convert to boto3 client configuration"""
```

### 2. Exception Hierarchy

**File:** `backend/storage/exceptions.py`

```python
class S3OperationError(Exception):
    """Base exception for S3 operations"""
    
    def __init__(self, message: str, operation: str = None, 
                 bucket: str = None, key: str = None, 
                 aws_error_code: str = None, **kwargs):
        super().__init__(message)
        self.operation = operation
        self.bucket = bucket
        self.key = key
        self.aws_error_code = aws_error_code
        self.context = kwargs

class S3ClientError(S3OperationError):
    """Client-side errors (4xx HTTP status codes)"""
    pass

class S3ServerError(S3OperationError):
    """Server-side errors (5xx HTTP status codes)"""
    pass

class S3CredentialsError(S3ClientError):
    """AWS credentials related errors"""
    pass

class S3BucketNotFoundError(S3ClientError):
    """Bucket does not exist"""
    pass

class S3ObjectNotFoundError(S3ClientError):
    """Object does not exist"""
    pass

class S3AccessDeniedError(S3ClientError):
    """Access denied to resource"""
    pass

class S3TransientError(S3ServerError):
    """Transient errors that can be retried"""
    pass
```

### 3. Thread-Safe S3 Client

**File:** `backend/storage/enhanced_s3_client.py`

```python
class EnhancedS3Client:
    """
    Thread-safe S3 client with advanced features
    
    Features:
    - Thread-safe singleton per configuration
    - Connection pooling and reuse
    - Automatic retry with exponential backoff
    - Comprehensive error handling
    - Context manager support
    - Batch operations
    - Detailed logging and metrics
    """
    
    _instances: Dict[str, 'EnhancedS3Client'] = {}
    _lock = threading.RLock()
    
    def __new__(cls, config: S3Config = None) -> 'EnhancedS3Client':
        """Thread-safe singleton factory"""
        config = config or S3Config.from_environment()
        config_key = cls._generate_config_key(config)
        
        with cls._lock:
            if config_key not in cls._instances:
                instance = super().__new__(cls)
                instance._initialized = False
                cls._instances[config_key] = instance
            return cls._instances[config_key]
    
    def __init__(self, config: S3Config = None):
        """Initialize S3 client with configuration"""
        if self._initialized:
            return
            
        with self._lock:
            if self._initialized:
                return
                
            self.config = config or S3Config.from_environment()
            self.config.validate()
            
            self._client = None
            self._retry_handler = RetryHandler(self.config)
            self._metrics = MetricsCollector()
            self._logger = self._setup_logger()
            
            self._initialized = True
    
    @property
    def client(self) -> boto3.client:
        """Get or create boto3 S3 client with connection pooling"""
        if self._client is None:
            with self._lock:
                if self._client is None:
                    self._client = self._create_client()
        return self._client
    
    def _create_client(self) -> boto3.client:
        """Create boto3 client with optimized configuration"""
        boto3_config = self.config.to_boto3_config()
        
        return boto3.client(
            's3',
            region_name=self.config.region,
            endpoint_url=self.config.endpoint_url,
            config=boto3_config
        )
    
    # Context Manager Support
    def __enter__(self) -> 'EnhancedS3Client':
        """Enter context manager"""
        self._logger.debug("Entering S3 client context")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit context manager with cleanup"""
        self._logger.debug("Exiting S3 client context")
        self._cleanup_resources()
    
    def _cleanup_resources(self) -> None:
        """Clean up client resources"""
        if self._client:
            # Close connection pool if available
            if hasattr(self._client, '_client_config'):
                self._client._client_config.loader.close()
```

### 4. Retry Handler with Exponential Backoff

**File:** `backend/storage/retry.py`

```python
class RetryHandler:
    """Handles retry logic with exponential backoff"""
    
    def __init__(self, config: S3Config):
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    def execute_with_retry(self, operation: Callable, *args, **kwargs) -> Any:
        """Execute operation with retry logic"""
        last_exception = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                start_time = time.time()
                result = operation(*args, **kwargs)
                
                # Log successful operation
                duration = time.time() - start_time
                self.logger.debug(f"Operation succeeded on attempt {attempt + 1}, "
                                f"duration: {duration:.3f}s")
                return result
                
            except Exception as e:
                last_exception = e
                
                if not self._is_retryable(e) or attempt >= self.config.max_retries:
                    break
                
                delay = self._calculate_delay(attempt)
                self.logger.warning(f"Operation failed on attempt {attempt + 1}, "
                                  f"retrying in {delay:.1f}s: {e}")
                time.sleep(delay)
        
        # All retries exhausted
        self.logger.error(f"Operation failed after {self.config.max_retries + 1} attempts")
        raise last_exception
    
    def _is_retryable(self, exception: Exception) -> bool:
        """Determine if exception is retryable"""
        if isinstance(exception, S3TransientError):
            return True
            
        if isinstance(exception, ClientError):
            error_code = exception.response.get('Error', {}).get('Code', '')
            http_status = exception.response.get('ResponseMetadata', {}).get('HTTPStatusCode', 0)
            
            # Retry on server errors (5xx) and specific client errors
            retryable_codes = {
                'ServiceUnavailable', 'SlowDown', 'RequestTimeout',
                'InternalError', 'RequestTimeTooSkewed'
            }
            
            return (http_status >= 500 or 
                   error_code in retryable_codes or
                   http_status == 429)  # Rate limiting
        
        # Retry on network-related exceptions
        return isinstance(exception, (ConnectionError, TimeoutError))
    
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate exponential backoff delay"""
        delay = self.config.base_delay * (self.config.backoff_multiplier ** attempt)
        return min(delay, self.config.max_delay)
```

### 5. Batch Operations

**File:** `backend/storage/batch_operations.py`

```python
class BatchOperations:
    """Handles batch S3 operations for improved performance"""
    
    def __init__(self, client: EnhancedS3Client):
        self.client = client
        self.logger = logging.getLogger(__name__)
    
    def batch_upload(self, 
                    files: List[Tuple[Union[str, Path], str, str]], 
                    progress_callback: Optional[Callable] = None,
                    max_workers: int = 5) -> BatchResult:
        """
        Upload multiple files concurrently
        
        Args:
            files: List of (local_path, bucket, key) tuples
            progress_callback: Optional callback for progress updates
            max_workers: Maximum concurrent uploads
            
        Returns:
            BatchResult with success/failure details
        """
        results = BatchResult()
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_file = {
                executor.submit(self._upload_single, local_path, bucket, key): 
                (local_path, bucket, key)
                for local_path, bucket, key in files
            }
            
            for future in as_completed(future_to_file):
                local_path, bucket, key = future_to_file[future]
                
                try:
                    result = future.result()
                    results.add_success(local_path, bucket, key, result)
                    
                    if progress_callback:
                        progress_callback(results.progress_percentage())
                        
                except Exception as e:
                    results.add_failure(local_path, bucket, key, e)
                    self.logger.error(f"Batch upload failed for {local_path}: {e}")
        
        return results
    
    def batch_delete(self, 
                    objects: List[Tuple[str, str]], 
                    progress_callback: Optional[Callable] = None) -> BatchResult:
        """
        Delete multiple objects using S3 batch delete API
        
        Args:
            objects: List of (bucket, key) tuples
            progress_callback: Optional callback for progress updates
            
        Returns:
            BatchResult with success/failure details
        """
        results = BatchResult()
        
        # Group objects by bucket for efficient batch deletion
        buckets = {}
        for bucket, key in objects:
            if bucket not in buckets:
                buckets[bucket] = []
            buckets[bucket].append(key)
        
        for bucket, keys in buckets.items():
            # Process in chunks of 1000 (S3 batch delete limit)
            for chunk in self._chunk_list(keys, 1000):
                try:
                    delete_objects = [{'Key': key} for key in chunk]
                    
                    response = self.client.client.delete_objects(
                        Bucket=bucket,
                        Delete={'Objects': delete_objects}
                    )
                    
                    # Process successful deletions
                    for deleted in response.get('Deleted', []):
                        results.add_success(bucket, deleted['Key'], None)
                    
                    # Process errors
                    for error in response.get('Errors', []):
                        results.add_failure(bucket, error['Key'], 
                                          S3OperationError(error['Message']))
                    
                    if progress_callback:
                        progress_callback(results.progress_percentage())
                        
                except Exception as e:
                    # Mark all keys in chunk as failed
                    for key in chunk:
                        results.add_failure(bucket, key, e)
        
        return results

@dataclass
class BatchResult:
    """Results from batch operations"""
    successes: List[Dict] = field(default_factory=list)
    failures: List[Dict] = field(default_factory=list)
    
    def add_success(self, *args):
        """Add successful operation"""
        
    def add_failure(self, *args):
        """Add failed operation"""
        
    def progress_percentage(self) -> float:
        """Calculate completion percentage"""
        total = len(self.successes) + len(self.failures)
        return (len(self.successes) / total * 100) if total > 0 else 0
```

### 6. Metrics and Monitoring

**File:** `backend/storage/metrics.py`

```python
class MetricsCollector:
    """Collects and manages S3 operation metrics"""
    
    def __init__(self):
        self.metrics = {
            'operations': defaultdict(int),
            'success_count': defaultdict(int),
            'error_count': defaultdict(int),
            'response_times': defaultdict(list),
            'bytes_transferred': defaultdict(int)
        }
        self.lock = threading.Lock()
    
    def record_operation(self, operation: str, success: bool, 
                        duration: float, bytes_count: int = 0):
        """Record operation metrics"""
        with self.lock:
            self.metrics['operations'][operation] += 1
            
            if success:
                self.metrics['success_count'][operation] += 1
            else:
                self.metrics['error_count'][operation] += 1
            
            self.metrics['response_times'][operation].append(duration)
            self.metrics['bytes_transferred'][operation] += bytes_count
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metrics summary"""
        with self.lock:
            summary = {}
            
            for operation in self.metrics['operations']:
                total = self.metrics['operations'][operation]
                success = self.metrics['success_count'][operation]
                errors = self.metrics['error_count'][operation]
                times = self.metrics['response_times'][operation]
                
                summary[operation] = {
                    'total_operations': total,
                    'success_rate': (success / total * 100) if total > 0 else 0,
                    'error_rate': (errors / total * 100) if total > 0 else 0,
                    'avg_response_time': sum(times) / len(times) if times else 0,
                    'total_bytes': self.metrics['bytes_transferred'][operation]
                }
            
            return summary
    
    def export_prometheus(self) -> str:
        """Export metrics in Prometheus format"""
        
    def export_json(self) -> str:
        """Export metrics in JSON format"""
```

---

## Public API Design

### Enhanced S3 Client Interface

The enhanced client maintains backward compatibility while adding new features:

```python
class EnhancedS3Client:
    """Enhanced S3 client with advanced features"""
    
    # Backward Compatible Methods (unchanged signatures)
    def upload_file_to_s3(self, file_path: Union[str, Path], 
                          bucket_name: str, object_key: str,
                          extra_args: Optional[Dict] = None) -> bool:
        """Upload file with retry and metrics"""
    
    def download_file_from_s3(self, bucket_name: str, object_key: str, 
                             local_path: Union[str, Path],
                             create_dirs: bool = True) -> bool:
        """Download file with retry and metrics"""
    
    def list_s3_objects(self, bucket_name: str, prefix: str = "", 
                       max_keys: int = 1000,
                       include_metadata: bool = False) -> List[Dict]:
        """List objects with optimized metadata fetching"""
    
    def delete_s3_object(self, bucket_name: str, object_key: str) -> bool:
        """Delete object with retry"""
    
    def check_bucket_exists(self, bucket_name: str) -> bool:
        """Check bucket existence"""
    
    # New Enhanced Methods
    def batch_upload(self, files: List[Tuple[Union[str, Path], str, str]], 
                    progress_callback: Optional[Callable] = None,
                    max_workers: int = 5) -> BatchResult:
        """Batch upload multiple files"""
    
    def batch_delete(self, objects: List[Tuple[str, str]], 
                    progress_callback: Optional[Callable] = None) -> BatchResult:
        """Batch delete multiple objects"""
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get operation metrics"""
    
    def configure_logging(self, level: str = "INFO", 
                         redact_sensitive: bool = True) -> None:
        """Configure logging settings"""
```

---

## Data Flow Design

### Operation Flow with Retry Logic

```
┌─────────────────┐
│   Client Call   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Input Validation│
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Metrics Start  │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Retry Handler  │◄─────┐
└─────────┬───────┘      │
          │              │
          ▼              │
┌─────────────────┐      │
│  AWS S3 Call    │      │
└─────────┬───────┘      │
          │              │
          ▼              │
┌─────────────────┐      │
│  Success?       │──No──┤
└─────────┬───────┘      │
          │Yes           │
          ▼              │
┌─────────────────┐      │
│  Metrics End    │      │
└─────────┬───────┘      │
          │              │
          ▼              │
┌─────────────────┐      │
│  Return Result  │      │
└─────────────────┘      │
                         │
          ┌──────────────┘
          │
          ▼
┌─────────────────┐
│  Is Retryable?  │──No──┐
└─────────┬───────┘      │
          │Yes           │
          ▼              │
┌─────────────────┐      │
│  Calculate      │      │
│  Backoff Delay  │      │
└─────────┬───────┘      │
          │              │
          ▼              │
┌─────────────────┐      │
│  Sleep & Retry  │──────┘
└─────────────────┘      │
                         │
          ┌──────────────┘
          │
          ▼
┌─────────────────┐
│  Raise Exception│
└─────────────────┘
```

---

## Configuration Schema

### Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_S3_ENDPOINT_URL=  # Optional, for testing

# Connection Configuration
S3_MAX_CONNECTIONS=10
S3_CONNECTION_TIMEOUT=60
S3_READ_TIMEOUT=300

# Retry Configuration
S3_MAX_RETRIES=3
S3_BASE_DELAY=1.0
S3_MAX_DELAY=30.0
S3_BACKOFF_MULTIPLIER=2.0

# Performance Configuration
S3_MULTIPART_THRESHOLD=67108864  # 64MB
S3_MULTIPART_CHUNKSIZE=16777216  # 16MB

# Logging Configuration
S3_LOG_LEVEL=INFO
S3_REDACT_SENSITIVE=true
```

---

## Testing Strategy

### Unit Testing Structure

```
tests/
├── unit/
│   ├── test_config.py              # Configuration management
│   ├── test_exceptions.py          # Exception hierarchy
│   ├── test_retry_handler.py       # Retry logic
│   ├── test_enhanced_client.py     # Core client functionality
│   ├── test_batch_operations.py    # Batch operations
│   ├── test_metrics.py             # Metrics collection
│   └── test_thread_safety.py       # Thread safety tests
├── integration/
│   ├── test_s3_integration.py      # Real S3 operations
│   ├── test_performance.py         # Performance benchmarks
│   └── test_compatibility.py       # Backward compatibility
└── property/
    ├── test_upload_download.py     # Property-based tests
    └── test_round_trip.py          # Round-trip properties
```

### Mock Implementation

```python
class MockS3Client:
    """Mock S3 client for unit testing"""
    
    def __init__(self, fail_operations: List[str] = None,
                 latency_ms: int = 0):
        self.fail_operations = fail_operations or []
        self.latency_ms = latency_ms
        self.operations = []
    
    def upload_file(self, *args, **kwargs):
        """Mock upload with configurable failures"""
        
    def download_file(self, *args, **kwargs):
        """Mock download with configurable failures"""
```

---

## Migration Strategy

### Backward Compatibility

1. **Interface Preservation**: All existing method signatures remain unchanged
2. **Behavior Compatibility**: Existing error handling patterns preserved
3. **Gradual Migration**: New features opt-in through configuration
4. **Deprecation Path**: Clear migration path for advanced features

### Migration Steps

1. **Phase 1**: Deploy enhanced client with backward compatibility mode
2. **Phase 2**: Enable new features through configuration
3. **Phase 3**: Migrate existing code to use new features
4. **Phase 4**: Remove deprecated functionality (future release)

---

## Performance Considerations

### Optimization Strategies

1. **Connection Pooling**: Reuse HTTP connections (10 max per endpoint)
2. **Batch Operations**: Use S3 batch APIs for multiple operations
3. **Multipart Uploads**: Automatic multipart for large files (>64MB)
4. **Metadata Optimization**: Skip expensive metadata when not needed
5. **Concurrent Operations**: Thread pool for batch operations

### Expected Performance Improvements

- **Upload Performance**: 40-60% improvement for batch operations
- **Connection Overhead**: 70% reduction through connection pooling
- **Error Recovery**: 90% reduction in failed operations through retry logic
- **Memory Usage**: 30% reduction through optimized buffering

---

## Security Considerations

### Data Protection

1. **Credential Security**: No credentials logged or exposed
2. **PII Redaction**: Automatic redaction of sensitive data in logs
3. **Secure Defaults**: Conservative timeout and retry settings
4. **Access Control**: Proper IAM role validation

### Logging Security

```python
def redact_sensitive_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Redact sensitive information from log data"""
    sensitive_keys = {
        'aws_access_key_id', 'aws_secret_access_key', 
        'aws_session_token', 'password', 'token'
    }
    
    redacted = {}
    for key, value in data.items():
        if key.lower() in sensitive_keys:
            redacted[key] = '[REDACTED]'
        else:
            redacted[key] = value
    
    return redacted
```

This design provides a comprehensive enhancement to the S3 client while maintaining backward compatibility and focusing on reliability, performance, and observability.