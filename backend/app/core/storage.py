"""
Storage service for file uploads.
Uses local storage or S3-compatible storage.
"""

import os
import uuid
from typing import Optional
from datetime import datetime

class StorageService:
    """
    Simple file storage service.
    In production, use S3, GCS, or Supabase Storage.
    """

    def __init__(self):
        self.storage_dir = os.environ.get("STORAGE_DIR", "/tmp/financial-manager-storage")
        os.makedirs(self.storage_dir, exist_ok=True)

    async def upload_file(self, data: bytes, filename: str) -> str:
        """
        Upload file and return path.
        """
        # Create directory if not exists
        filepath = os.path.join(self.storage_dir, filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        # Write file
        with open(filepath, 'wb') as f:
            f.write(data)

        return filepath

    async def download_file(self, filepath: str) -> bytes:
        """
        Download file content.
        """
        with open(filepath, 'rb') as f:
            return f.read()

    async def delete_file(self, filepath: str) -> bool:
        """
        Delete file.
        """
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
            return True
        except Exception:
            return False

    def get_public_url(self, filepath: str) -> str:
        """
        Get public URL for file.
        Override this for CDN/cloud storage.
        """
        return f"/storage/{os.path.basename(filepath)}"
