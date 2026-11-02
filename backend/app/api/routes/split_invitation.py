"""
Inviting somebody to a shared bill, over the wire.

Two kinds of route are here, and the difference matters.

The routes that need the reader are the ones that make and read
invitations: a host lists the invitations of a group, a host invites
somebody, a host can see that an invitation has been used.

The route that does not need the reader is the one that joins. Somebody
who was invited opens a link in a browser, and they may not have an
account. The token is the pass, exactly as the invite code is the
pass in the guest flow, and joining makes a member of the group and
nothing else. No account is made from an email address that somebody
else wrote down.

The router is mounted at `/api/split-invitations`, which is its own
prefix and not a second `/api/split`. Two routers under one prefix is
how a route ends up answering twice and only the first one being
reached.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.split_invitation_service import (
    DEFAULT_INVITE_BASE_URL,
    INVITATION_ROLES,
    STATUS_EXPIRED,
    STATUS_INVITED,
    STATUS_JOINED,
    create_invitation,
    invitation_response,
    join_with_token,
    list_invitations,
    update_invitation_status,
)

router = APIRouter()


class SplitInvitationCreate(BaseModel):
    """
    Who to invite, and as what.

    The address is the host's own note about who the invitation is
    for. It is not checked against anything and it does not make an
    account.
    """

    email: str = Field(..., min_length=3, max_length=254)
    role: str = Field(default="MEMBER", max_length=20)


class SplitInvitationStatusUpdate(BaseModel):
    """A new status for an invitation."""

    status: str = Field(..., max_length=20)


class SplitInvitationJoin(BaseModel):
    """
    The token, and the name the person wants to be called.

    The name is the name the group knows them by. It is not an email
    address and it does not have to be one.
    """

    token: str = Field(..., min_length=8, max_length=200)
    display_name: str = Field(..., min_length=1, max_length=60)


def _host_name(user) -> str:
    """What to call the reader who is doing the inviting."""
    for part in (getattr(user, "full_name", None), getattr(user, "username", None)):
        if part and str(part).strip():
            return str(part).strip()
    return "The host"


@router.post(
    "/groups/{group_id}/invitations",
    status_code=status.HTTP_201_CREATED,
)
def invite_someone(
    group_id: int,
    payload: SplitInvitationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Write an invitation down and give the host the link to send.

    Nothing is sent from here. The answer carries a `mailto:` link and
    a Gmail compose link for the host to click, so the mail is the
    host's own and the host can read it before it goes.

    If the host has connected their Gmail account, a draft is made for
    them; `draft_created` says whether it happened.
    """
    role = (payload.role or "MEMBER").strip().upper()
    if role not in INVITATION_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That is not a role a person can be invited as.",
        )

    try:
        return create_invitation(
            db=db,
            group_id=group_id,
            invited_by=current_user.id,
            email=payload.email,
            role=role,
            host_name=_host_name(current_user),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/groups/{group_id}/invitations")
def list_group_invitations(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """The invitations of one group, newest first."""
    from app.models.split_bill import SplitGroup, SplitMember

    group = db.query(SplitGroup).filter(SplitGroup.id == group_id).first()
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The group was not found.",
        )
    if group.owner_id != current_user.id:
        member = (
            db.query(SplitMember)
            .filter(
                SplitMember.group_id == group.id,
                SplitMember.user_id == current_user.id,
            )
            .first()
        )
        if member is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This group is not yours.",
            )

    return list_invitations(db, group.id)


@router.put("/invitations/{invitation_id}/status")
def set_invitation_status(
    invitation_id: int,
    payload: SplitInvitationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Move an invitation to another status."""
    from app.models.split_invitation import SplitInvitation

    invitation = (
        db.query(SplitInvitation)
        .filter(SplitInvitation.id == invitation_id)
        .first()
    )
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That invitation was not found.",
        )

    from app.models.split_bill import SplitGroup

    group = db.query(SplitGroup).filter(SplitGroup.id == invitation.group_id).first()
    if group is None or group.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This group is not yours.",
        )

    try:
        update_invitation_status(db, invitation, payload.status)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return invitation_response(invitation)


@router.post("/join")
def join_with_an_invitation(
    payload: SplitInvitationJoin,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Join a group with an invitation.

    No account is needed. The token is the pass, and what is made is a
    member of the group - no user row, no account, nothing that would
    let an email address become an identity.

    A token that has been used does not work again, and a token that
    has run out of time does not work at all.
    """
    try:
        return join_with_token(
            db=db,
            token=payload.token,
            display_name=payload.display_name,
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="That invitation was not found.",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=str(exc),
        ) from exc
    except PermissionError as exc:
        message = str(exc)
        if "already been used" in message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message,
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
