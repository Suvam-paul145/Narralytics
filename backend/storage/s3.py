import os

import boto3

from config import settings

s3 = boto3.client("s3", region_name=settings.AWS_REGION)


def save_upload(file_bytes: bytes, filename: str, upload_dir: str | None = None) -> str:
    key = f"uploads/{filename}"
    if not settings.AWS_BUCKET:
        raise ValueError("AWS_BUCKET is not configured")
    s3.put_object(Bucket=settings.AWS_BUCKET, Key=key, Body=file_bytes)
    return key


def get_file_path(filename: str, upload_dir: str | None = None) -> str:
    if not settings.AWS_BUCKET:
        raise ValueError("AWS_BUCKET is not configured")

    local_path = os.path.join("/tmp", filename)
    if not os.path.exists(local_path):
        s3.download_file(settings.AWS_BUCKET, f"uploads/{filename}", local_path)
    return local_path
