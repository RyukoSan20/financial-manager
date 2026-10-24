"""
Notes the user's own corrections are written into.

The classifier learns the direction of a phrase from the transactions
the user has already saved. That covers most corrections, but not the
one where the user fixed a classification and then chose not to save the
transaction at all. This table holds those.

The rows are read by the direction classifier before it falls back to
the wording, so a correction the user made once is remembered.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class LearningNote(Base):
    """One thing the user told the system."""

    __tablename__ = "learning_notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # What the note is about: "direction", "category", ...
    kind = Column(String(30), nullable=False, index=True)

    # The normalised wording the note is filed under, so it can be
    # looked up without a fuzzy search.
    token = Column(String(255), nullable=False, index=True)

    # The note itself, as JSON.
    payload = Column(Text, nullable=True)

    # How many times the same note was given.
    times = Column(Integer, default=1)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="learning_notes")

    __table_args__ = (
        Index("ix_learning_notes_user_kind_token", "user_id", "kind", "token"),
    )

    def __repr__(self):
        return f"<LearningNote {self.kind!r} {self.token!r}>"
