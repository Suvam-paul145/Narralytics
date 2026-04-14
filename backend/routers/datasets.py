import os
import uuid
from io import BytesIO
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from analytics.dataset_profile import (
    build_dataset_profile,
    clean_uploaded_dataframe,
    extract_embedded_csv_text,
    is_suspicious_dataframe,
    parse_csv_text,
)
from auth.dependencies import get_current_user
from config import settings
from database.datasets import delete_dataset_meta, get_dataset, get_user_datasets, save_dataset_metadata
from database.users import add_dataset_to_user, remove_dataset_from_user
from sqlite.loader import load_csv_to_sqlite
from sqlite.schema_detector import detect_schema
from storage import save_upload

router = APIRouter(prefix="/datasets", tags=["datasets"])


import chardet


def _decode_bytes(content: bytes, preferred_encoding: str | None = None) -> str:
    attempted_encodings = [
        preferred_encoding,
        "utf-8",
        "utf-8-sig",
        "latin1",
    ]
    for encoding in attempted_encodings:
        if not encoding:
            continue
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="ignore")


def _read_csv_dataframe(content: bytes) -> pd.DataFrame:
    detection = chardet.detect(content)
    encoding = detection.get("encoding", "utf-8")
    decoded_text = _decode_bytes(content, encoding)

    try:
        dataframe = parse_csv_text(decoded_text)
    except Exception:
        dataframe = pd.read_csv(BytesIO(content), encoding=encoding)

    if is_suspicious_dataframe(dataframe):
        extracted_csv = extract_embedded_csv_text(content)
        if extracted_csv:
            recovered = parse_csv_text(extracted_csv)
            if not recovered.empty:
                dataframe = recovered

    return dataframe


def _parse_uploaded_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    suffix = Path(filename).suffix.lower()
    
    # --- Binary signature protection ---
    # Check for Zip (PK\x03\x04) misidentified as CSV
    head = content[:2048]
    if suffix == ".csv" and head.startswith(b"PK\x03\x04"):
        raise HTTPException(
            status_code=422,
            detail="Binary Zip signature detected in CSV. Is this a renamed .xlsx or .zip file?"
        )
    
    # Catch binary files pretending to be CSVs by checking for null bytes
    if suffix == ".csv" and b"\x00" in head and head[:2] not in (b'\xff\xfe', b'\xfe\xff'):
        raise HTTPException(
            status_code=422,
            detail="The file contains binary data and is not a valid plain-text CSV."
        )

    buffer = BytesIO(content)
    try:
        if suffix == ".csv":
            return _read_csv_dataframe(content)
        
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
    dataframe, cleaning_report = clean_uploaded_dataframe(dataframe)
    if dataframe.empty or len(dataframe.columns) == 0:
        raise HTTPException(status_code=422, detail="No usable tabular data was found in the uploaded file.")

    schema = detect_schema(dataframe)
    profile = build_dataset_profile(schema, file.filename)

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
        "column_codes": schema["column_codes"],
        "date_columns": schema["date_columns"],
        "date_column_codes": schema["date_column_codes"],
        "numeric_columns": schema["numeric_columns"],
        "numeric_column_codes": schema["numeric_column_codes"],
        "categorical_columns": schema["categorical_columns"],
        "categorical_column_codes": schema["categorical_column_codes"],
        "db_path": db_path,
        "source_file_path": source_file_path,
        "file_size_bytes": len(content),
        "profile": profile,
        "cleaning_report": cleaning_report,
    }
    await save_dataset_metadata(metadata)
    await add_dataset_to_user(
        user["sub"],
        {
            "dataset_id": dataset_id,
            "name": file.filename,
            "row_count": schema["row_count"],
            "columns": [column["name"] for column in schema["columns"]],
            "column_codes": schema["column_codes"],
            "db_path": db_path,
            "profile": profile,
        },
    )

    return {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "row_count": schema["row_count"],
        "columns": [column["name"] for column in schema["columns"]],
        "column_codes": schema["column_codes"],
        "date_columns": schema["date_columns"],
        "date_column_codes": schema["date_column_codes"],
        "numeric_columns": schema["numeric_columns"],
        "numeric_column_codes": schema["numeric_column_codes"],
        "profile": profile,
        "cleaning_report": cleaning_report,
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


@router.get("/{dataset_id}/profile")
async def get_dataset_profile(dataset_id: str, user: dict = Depends(get_current_user)):
    dataset = await get_dataset(dataset_id, user["sub"])
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return {
        "dataset_id": dataset_id,
        "profile": dataset.get("profile", {}),
        "cleaning_report": dataset.get("cleaning_report", {}),
    }
