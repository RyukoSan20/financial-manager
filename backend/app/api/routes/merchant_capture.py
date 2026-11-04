"""
The flow that turns a photograph into a product.

The shop owner takes a picture of the goods. This reads the picture and
hands back a draft. The owner looks at the draft, corrects what is
wrong, and presses the button that saves it.

Those are two routes on purpose.

`POST /merchant/{merchant_id}/capture` reads the picture and answers
with a draft. It writes nothing.

`POST /merchant/{merchant_id}/products` is the one that writes, and it
has always been there. The capture feeds it; it does not replace it.

The split matters because a reading is a guess. It reads the price off
a label the same way a person squints at a label, and it gets the
wrong ones: the struck-through price, the size, the barcode. A
catalogue that saved those without asking would sell the goods at
them.

So the draft is shown with its picture, and its warnings, and the
owner decides.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services import merchant_capture

router = APIRouter(prefix="/merchant", tags=["Merchant"])

# How big a picture is allowed to be. The same limit as the picture
# upload, because it is the same phone and the same shop.
MAX_BYTES = 8 * 1024 * 1024

# What the picture may be.
ALLOWED_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
}


class CaptureDraft(BaseModel):
    """
    What was read out of the picture.

    It is a draft. The owner reads it, and the owner is the one who
    decides whether it becomes a product.
    """

    name: str
    price: Optional[float] = None
    currency: str = "IDR"
    brand: Optional[str] = None
    category: str = "other"
    unit: str = "pcs"
    size: Optional[str] = None
    sku: Optional[str] = None
    confidence: float = 0.0
    warnings: List[str] = []


class CaptureResponse(BaseModel):
    """The draft, and where the picture was put."""

    draft: CaptureDraft
    image_url: Optional[str] = None
    # The picture that was read, so that the owner can see the draft
    # next to the thing the draft was read from.
    image_base64: Optional[str] = None


def _merchant_or_404(db: Session, merchant_id: int, user: User):
    """
    The shop, if it is the reader's own.

    A picture of one shop's goods must never become a product in
    another shop's catalogue, so the shop is checked before anything
    is read.
    """
    from app.models.merchant import Merchant

    merchant = (
        db.query(Merchant)
        .filter(Merchant.id == merchant_id, Merchant.user_id == user.id)
        .first()
    )
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant


@router.post("/{merchant_id}/capture", response_model=CaptureResponse)
async def capture_product(
    merchant_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Read a product out of a photograph.

    Nothing is written. The answer is a draft, with the warnings that
    say what could not be read.
    """
    _merchant_or_404(db, merchant_id, current_user)

    content_type = (file.content_type or "").lower()
    if content_type and content_type not in ALLOWED_TYPES:
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

    product = merchant_capture.capture_product(raw)
    if product is None:
        # The picture could not be read. This is said plainly, because
        # a product with no name and no price is not a product, and
        # offering one would only confuse the owner.
        raise HTTPException(
            status_code=422,
            detail=(
                "The product could not be read from that picture. "
                "Try a clearer photo of the label, or type the product in."
            ),
        )

    # The picture is put on the server as well, so that the owner can
    # see it next to the draft and can save it as the picture of the
    # product when they accept the reading.
    image_url = None
    try:
        from app.api.routes.merchant_images import _square_and_shrink
        import uuid
        from pathlib import Path
        import os

        made, _width, _height = _square_and_shrink(raw)
        upload_dir = Path(
            os.environ.get("MERCHANT_UPLOAD_DIR", "/app/uploads/merchant")
        )
        name = f"{merchant_id}-{uuid.uuid4().hex[:12]}.webp"
        folder = upload_dir / str(merchant_id)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / name).write_bytes(made)
        image_url = f"/api/merchant/{merchant_id}/product-image/{name}"
    except Exception:  # noqa: BLE001 - the draft is still worth having
        image_url = None

    return CaptureResponse(
        draft=CaptureDraft(**product.to_dict()),
        image_url=image_url,
    )
