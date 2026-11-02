"""
An invitation to a shared bill, sent to an email address.

A group can be shared with people who are not readers of this
application. The way that works is an invitation: the host writes
down an email address, the application makes a row, and the host
sends the link themselves (the application never sends mail on its
own - see `split_invitation_service` for why).

The invitation carries three things that matter:

- **the token.** A long, unguessable string, given to the host once
  and never written down again. What is stored is its hash, so a copy
  of the database does not hand out invitations to anybody who asks
  for it.
- **the status.** `INVITED` while it is waiting, `JOINED` once it has
  been used, `EXPIRED` once it has run out of time. A status that is
  only ever `INVITED` says nothing.
- **the expiry.** An invitation that was never used should stop
  working. A week is long enough for somebody to find the mail and
  short enough that an old link in a chat log is not a way in.

The email address is the host's note about who the invitation is for.
It is not a claim about who the person is, and it is never used to
make an account: a person who joins this way joins as a guest, the
same as somebody who opens a link from a chat window.
"""

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class SplitInvitation(Base):
    """
    One invitation to one group.

    The token is single use. Once it has been used the status says so,
    and the token does not work again.
    """

    __tablename__ = "split_invitations"

    id = Column(Integer, primary_key=True, index=True)

    # The group being shared.
    group_id = Column(
        Integer, ForeignKey("split_groups.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # The reader who wrote the invitation down.
    invited_by = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True, index=True,
    )

    # Who the invitation is for, as the host wrote it. Kept in lower
    # case so that the same address is the same address however it
    # was typed.
    email = Column(String(255), nullable=False, index=True)

    # ADMIN or MEMBER.
    role = Column(String(20), default="MEMBER", nullable=False)

    # INVITED, JOINED, or EXPIRED.
    status = Column(String(20), default="INVITED", nullable=False, index=True)

    # The hash of the token. The token itself is given to the host
    # once and is not kept anywhere.
    token_hash = Column(String(128), nullable=False, unique=True, index=True)

    # The member that was made when the invitation was used.
    member_id = Column(
        Integer, ForeignKey("split_members.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )

    # When the invitation stops working.
    expires_at = Column(DateTime, nullable=False, index=True)

    # When it was used, if it was.
    joined_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    group = relationship("SplitGroup")
    member = relationship("SplitMember")

    __table_args__ = (
        Index("ix_split_invitations_group_email", "group_id", "email"),
    )

    def __repr__(self):
        return f"<SplitInvitation {self.id} {self.email!r} {self.status}>"
