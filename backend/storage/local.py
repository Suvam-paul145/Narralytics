import os


def save_upload(file_bytes: bytes, filename: str, upload_dir: str) -> str:
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, filename)
    with open(path, "wb") as file_handle:
        file_handle.write(file_bytes)
    return path


def get_file_path(filename: str, upload_dir: str) -> str:
    return os.path.join(upload_dir, filename)
