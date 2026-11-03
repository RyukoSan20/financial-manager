"""
The picture of a thing for sale.

A warung owner takes a photograph of the goods with the phone. The
photograph is resized, cropped square and made into a webp, so that a
shelf of a hundred things does not take a hundred photographs worth of
space and still be slow to draw.

The picture is written to the server's own folder and served from
there. It is not kept in the database, because the database holds the
address of the picture and the folder holds the picture.

Every file that is written is given a name of its own, made from the
identifier of the shop and a random string. The name the client sent
is never used as the name on disk, so a file called "../../etc/passwd"
cannot escape the folder.
"""

import io
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/merchant", tags=["Merchant"])


# Where the pictures are kept, and how big a picture is allowed to be.
UPLOAD_DIR = Path(os.environ.get("MERCHANT_UPLOAD_DIR", "/app/uploads/merchant"))
MAX_BYTES = 8 * 1024 * 1024
TARGET_EDGE = 800
MAX_BYTES_AFTER = 150 * 1024

# What the picture may be. A file that says it is a picture but is
# not one is refused before anything is decoded.
ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}


class UploadResponse(BaseModel):
    """Where the picture ended up."""

    image_url: str
    width: Optional[int] = None
    height: Optional[int] = None
    bytes: int = 0


def _square_and_shrink(raw: bytes) -> Tuple[bytes, int, int]:
    """
    Make the picture square and small.

    A picture of a packet of noodles is rarely square, and a shelf of
    pictures is much easier to look at when they all are. The middle
    is kept, because the middle of a photograph of a thing is the
    thing.
    """
    try:
        from PIL import Image
    except ImportError:
        # Without the picture library the picture is kept as it came.
        # It is better to store a large picture than to lose it.
        return raw, 0, 0

    try:
        with Image.open(io.BytesIO(raw)) as opened:
            opened.load()
            width, height = opened.size

            edge = min(width, height)
            left = (width - edge) // 2
            top = (height - edge) // 2
            cropped = opened.crop((left, top, left + edge, top + edge))

            if edge > TARGET_EDGE:
                # The name of the best resampler changed between
                # versions of the picture library, so both are tried
                # rather than the server failing to start on one of
                # them.
                resampler = getattr(Image, "LANCZOS", None) or getattr(
                    Image, "ANTIALIAS", None
                )
                if resampler is not None:
                    cropped = cropped.resize((TARGET_EDGE, TARGET_EDGE), resampler)

            if cropped.mode not in ("RGB", "RGBA"):
                cropped = cropped.convert("RGB")

            buffer = io.BytesIO()
            cropped.save(buffer, format="WEBP", quality=82, method=4)
            result = buffer.getvalue()
            return result, TARGET_EDGE if edge > TARGET_EDGE else edge, (
                TARGET_EDGE if edge > TARGET_EDGE else edge
            )
    except Exception:
        # A file that cannot be read as a picture is not a picture.
        raise ValueError("the file is not a picture that can be read")


@router.post("/{merchant_id}/product-image", response_model=UploadResponse)
async def upload_product_image(
    merchant_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    The photograph of a thing for sale.

    The shop has to be the reader's own, or the picture is not taken.
    """
    from app.models.merchant import Merchant

    merchant = (
        db.query(Merchant)
        .filter(Merchant.id == merchant_id, Merchant.user_id == current_user.id)
        .first()
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail="That is not a picture this server accepts.",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="The picture was empty.")
    if len(raw) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail="The picture is too large. Take a smaller one.",
        )

    try:
        made, width, height = _square_and_shrink(raw)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="That file could not be read as a picture."
        )

    # A name of its own, so that the name the client sent cannot
    # decide where the file is written.
    extension = ".webp"
    name = f"{merchant_id}-{uuid.uuid4().hex[:12]}{extension}"
    folder = UPLOAD_DIR / str(merchant_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / name

    try:
        path.write_bytes(made)
    except OSError:
        raise HTTPException(
            status_code=500,
            detail="The picture could not be saved on the server."
        )

    # The picture is served from under /api/, so that the proxy in
    # front of the server passes it on to this server and not to the
    # page of the website.
    return UploadResponse(
        image_url=f"/api/merchant/{merchant_id}/product-image/{name}",
        width=width or None,
        height=height or None,
        bytes=len(made),
    )


@router.delete("/{merchant_id}/product-image")
def delete_product_image(
    merchant_id: int,
    path: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Take a picture off the shelf.
    """
    from app.models.merchant import Merchant

    merchant = (
        db.query(Merchant)
        .filter(Merchant.id == merchant_id, Merchant.user_id == current_user.id)
        .first()
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # The name is checked against the folder of this shop, so that a
    # name with a path in it cannot reach another shop's pictures.
    name = os.path.basename(path)
    target = UPLOAD_DIR / str(merchant_id) / name
    folder = (UPLOAD_DIR / str(merchant_id)).resolve()
    if not str(target.resolve()).startswith(str(folder)):
        raise HTTPException(status_code=400, detail="That is not a picture of this shop.")

    if target.exists():
        try:
            target.unlink()
        except OSError:
            raise HTTPException(status_code=500, detail="The picture could not be removed.")

    return {"message": "Picture removed"}


@router.get("/{merchant_id}/product-image/{name}")
def get_product_image(
    merchant_id: int,
    name: str,
    db: Session = Depends(get_db),
):
    """
    The picture of a thing for sale, handed back.

    A browser asks for a picture with a plain address, and it sends
    no proof of who it is. A picture that demanded proof was a
    picture that never appeared, so this one asks for no proof.

    It is still not a way in. The shop has to exist, and the name of
    the file is used only as a name, never as a path, so that a name
    with a path in it cannot reach another shop's pictures.
    """
    from app.models.merchant import Merchant

    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")

    # Only the name of the file is used, never a path, so that a name
    # with a path in it cannot reach another shop's pictures.
    safe_name = os.path.basename(name)
    path = UPLOAD_DIR / str(merchant_id) / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Picture not found")

    return FileResponse(path, media_type="image/webp")
