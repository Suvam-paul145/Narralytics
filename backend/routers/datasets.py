import os
import uuid
from io import BytesIO
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from auth.dependencies import get_current_user
from config import settings
from database.datasets import delete_dataset_meta, get_dataset, get_user_datasets, save_dataset_metadata
from database.users import add_dataset_to_user, remove_dataset_from_user
from sqlite.loader import load_csv_to_sqlite
from sqlite.schema_detector import detect_schema
from storage.local import save_upload

router = APIRouter(prefix="/datasets", tags=["datasets"])


import chardet

def _parse_uploaded_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    suffix = Path(filename).suffix.lower()
    
    # --- Binary signature protection ---
    # Check for Apple Binary Plist (bplist00) or Zip (PK\x03\x04) misidentified as CSV
    if content.startswith(b"bplist00"):
        raise HTTPException(
            status_code=422, 
            detail="The file appears to be a Binary Plist. Only CSV and Excel files are supported."
        )
    if content.startswith(b"PK\x03\x04") and suffix == ".csv":
        raise HTTPException(
            status_code=422,
            detail="Binary Zip signature detected in CSV. Is this a renamed .xlsx or .zip file?"
        )

    buffer = BytesIO(content)
    try:
        if suffix == ".csv":
            # 1. Detect encoding accurately
            detection = chardet.detect(content)
            encoding = detection.get("encoding", "utf-8")
            
            try:
                # 2. Try reading with detected encoding
                return pd.read_csv(buffer, encoding=encoding)
            except (UnicodeDecodeError, pd.errors.ParserError):
                # 3. Fallback to latin1 if still failing
                buffer.seek(0)
                return pd.read_csv(buffer, encoding="latin1")
        
        # Excel handling (read_excel handles its own binary detection)
        return pd.read_excel(buffer)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}") from exc


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not file.filename or not file.filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported")

    dataset_id = str(uuid.uuid4())
    content = await file.read()
    dataframe = _parse_uploaded_dataframe(file.filename, content)
    schema = detect_schema(dataframe)

    extension = Path(file.filename).suffix.lower() or ".csv"
    stored_filename = f"{dataset_id}{extension}"
    source_file_path = save_upload(content, stored_filename, settings.UPLOAD_DIR)

    db_path = os.path.join(settings.UPLOAD_DIR, f"{dataset_id}.db")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    load_csv_to_sqlite(dataframe, db_path, table_name="data")

    metadata = {
        "dataset_id": dataset_id,
        "user_id": user["sub"],
        "original_filename": file.filename,
        "row_count": schema["row_count"],
        "column_count": len(schema["columns"]),
        "columns": schema["columns"],
        "date_columns": schema["date_columns"],
        "numeric_columns": schema["numeric_columns"],
        "categorical_columns": schema["categorical_columns"],
        "db_path": db_path,
        "source_file_path": source_file_path,
        "file_size_bytes": len(content),
    }
    await save_dataset_metadata(metadata)
    await add_dataset_to_user(
        user["sub"],
        {
            "dataset_id": dataset_id,
            "name": file.filename,
            "row_count": schema["row_count"],
            "columns": [column["name"] for column in schema["columns"]],
            "db_path": db_path,
        },
    )

    return {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "row_count": schema["row_count"],
        "columns": [column["name"] for column in schema["columns"]],
        "date_columns": schema["date_columns"],
        "numeric_columns": schema["numeric_columns"],
        "message": "Dataset ready. Generating dashboard...",
    }


@router.get("/")
async def list_datasets(user: dict = Depends(get_current_user)):
    datasets = await get_user_datasets(user["sub"])
    return {"datasets": datasets}


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, user: dict = Depends(get_current_user)):
    dataset = await get_dataset(dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    for path_key in ("db_path", "source_file_path"):
        path = dataset.get(path_key)
        if path and os.path.exists(path):
            os.remove(path)

    await delete_dataset_meta(dataset_id, user["sub"])
    await remove_dataset_from_user(user["sub"], dataset_id)
    return {"message": "Dataset deleted"}
