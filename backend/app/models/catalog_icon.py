"""
The icon and colour the user chose for a catalogue entry.

The shops and products the system learns about carry a category and an
icon that the system guessed. The user can change both, and the change
has to stick, so it is kept here rather than on the catalogue rows
themselves.

The table is separate from `merchant_catalog` and `user_products` for
two reasons. The first is that an icon belongs to a shop or a product
depending on the kind, and one table with a kind column handles both
without two nearly identical sets of columns. The second is that this
is the user's own choice, while the catalogue rows are what the system
learned, and keeping them apart makes it obvious which is which.
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Index,
    Integer,
    String,
    UniqueConstraint,
)

from app.core.database import Base


class CatalogIcon(Base):
    """
    One icon the user picked.

    The pair (user, kind, id) is unique, so picking an icon twice
    updates the same row instead of making another one.
    """

    __tablename__ = "catalog_icons"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    # 'merchant' or 'product'
    target_type = Column(String(20), nullable=False)
    target_id = Column(Integer, nullable=False)

    # The emoji the user picked.
    icon = Column(String(20), nullable=True)
    # The colour to draw it in.
    color = Column(String(20), nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint(
            "user_id", "target_type", "target_id", name="uq_catalog_icon"
        ),
        Index("ix_catalog_icons_user_target", "user_id", "target_type"),
    )

    def __repr__(self):
        return (
            f"<CatalogIcon {self.target_type}:{self.target_id} "
            f"{self.icon!r}>"
        )
