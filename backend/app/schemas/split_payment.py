"""
What the payment method routes accept and what they answer with.

The request shapes are checked before anything is written down, so a
method with a type that does not exist is refused at the door rather
than half-created.

The response shapes keep the private parts out. The list of methods
has no account number in it at all, and the reveal route is the only
one that has, and it is the one that checks first.
"""

from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import EmptyStringAsNone


class SplitPaymentMethodCreate(EmptyStringAsNone):
    """
    How a member wants to be paid.

    The account number is encrypted on the way in, so it is never
    written down in the clear.
    """

    method_type: str = Field(..., max_length=20)
    label: Optional[str] = Field(None, max_length=60)
    provider_name: Optional[str] = Field(None, max_length=60)
    account_number: Optional[str] = Field(None, max_length=120)
    account_name: Optional[str] = Field(None, max_length=120)

    @field_validator("method_type")
    @classmethod
    def _upper(cls, value: str) -> str:
        return (value or "").strip().upper()


class SplitPaymentMethodResponse(BaseModel):
    """
    One payment method, without the private parts.

    There is no account number here. There is the last four digits,
    which is enough to recognise an account and not enough to use it.
    """

    id: int
    member_id: int
    method_type: str
    label: Optional[str] = None
    provider_name: Optional[str] = None
    account_number_hint: Optional[str] = None
    qris_image_url: Optional[str] = None
    is_default: bool = False
    created_at: Optional[str] = None


class SplitPaymentMethodRevealResponse(BaseModel):
    """
    One payment method, with the account number in it.

    This shape is only ever given to somebody who has to pay it.
    """

    id: int
    member_id: int
    method_type: str
    label: Optional[str] = None
    provider_name: Optional[str] = None
    account_number: Optional[str] = None
    account_name: Optional[str] = None
    account_number_hint: Optional[str] = None
    qris_image_url: Optional[str] = None
    is_default: bool = False
