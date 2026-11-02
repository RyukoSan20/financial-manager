"""
Inviting somebody to a shared bill by email.

A host of a shared bill can invite a person who is not a reader of
this application. The host writes down an email address and the
application makes an invitation: a row, a token, and a link.

**The application does not send the mail.** This is the important
decision in this file, and it is deliberate.

If the server sent the mail, then anybody who could make an
invitation could make the server send mail to any address at all.
That is a spam relay with a signup form on it. It is also mail that
the host never saw and cannot stop, arriving from an address the host
does not own, on behalf of a group that may not exist.

So the invitation is written down, and the host is given two things
to click:

- a `mailto:` link, which opens the host's own mail client with the
  address, the group and the link already filled in. The host can
  read it, change it, and decide whether to send it.
- a Gmail compose link, which is the same thing for the readers who
  use Gmail.

If the host has connected their Gmail account, a draft is created
through the same path the receipt reader uses, so that the mail is in
their drafts folder rather than sent behind their back. A draft is a
proposal: the host presses send. If the Gmail connection is not there
or the draft cannot be made, the invitation still works - the host
gets the `mailto:` link and carries on.

**Joining never makes an account.** The invited person may not have
ever heard of this application. The join works off the token alone:
it makes a member of the group, with a name the person gives, and
nothing else. No user row is created from an email address that
somebody else wrote down. This is the same shape as the guest flow in
`split_guest.py`, and it is followed for the same reason: an email
address is data, and data is not an identity.

The token is single use and is not guessable: it is
`secrets.token_urlsafe(32)`, and only its hash is written down, so a
copy of the database does not give away an invitation. It also runs
out of time, because an invitation that was never used should stop
working.
"""

from __future__ import annotations

import hashlib
import secrets
import urllib.parse
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

# The three states an invitation can be in.
STATUS_INVITED = "INVITED"
STATUS_JOINED = "JOINED"
STATUS_EXPIRED = "EXPIRED"

INVITATION_STATUSES = (STATUS_INVITED, STATUS_JOINED, STATUS_EXPIRED)

# The two roles a person can be invited as.
ROLE_ADMIN = "ADMIN"
ROLE_MEMBER = "MEMBER"

INVITATION_ROLES = (ROLE_ADMIN, ROLE_MEMBER)

# How long an invitation lasts. A week is long enough for somebody to
# find the mail and short enough that an old link in a chat log is
# not a way in.
INVITATION_LIFETIME = timedelta(days=7)

# The bytes of the token. 32 bytes is 256 bits, which is more than
# enough to be unguessable.
TOKEN_BYTES = 32

# The address the invitation link points at. The screen puts the
# reader's own host in front of it when the link is built, so this is
# only the fallback.
DEFAULT_INVITE_BASE_URL = "https://my-financial-manager.online/split/invite"


# ---------------------------------------------------------------------------
# The token
# ---------------------------------------------------------------------------


def new_token() -> str:
    """A token that cannot be guessed."""
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> str:
    """
    The hash of a token.

    What is written down is this, not the token. A copy of the
    database then gives an attacker nothing: the tokens are long
    enough that guessing one is not possible, and the hash cannot be
    turned back into the token.
    """
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


def _constant_time_equals(left: str, right: str) -> bool:
    """Whether two strings are the same, without leaking how much."""
    import hmac

    return hmac.compare_digest(left or "", right or "")


# ---------------------------------------------------------------------------
# The address
# ---------------------------------------------------------------------------


def normalise_email(email: str) -> str:
    """An address, in the shape it is stored in."""
    return (email or "").strip().lower()


def is_valid_email(email: str) -> bool:
    """
    Whether an address is an address.

    The check is deliberately simple and deliberately strict: one `@`,
    something before it, something after it, and a dot in the part
    after it. A full RFC parser would accept addresses that no mail
    provider would ever deliver to, and it would also accept some
    that are useful for sending spam to nobody.
    """
    candidate = normalise_email(email)
    if not candidate or len(candidate) > 254:
        return False
    if " " in candidate:
        return False
    if candidate.count("@") != 1:
        return False
    local, _, domain = candidate.partition("@")
    if not local or len(local) > 64:
        return False
    if "." not in domain or domain.startswith(".") or domain.endswith("."):
        return False
    if ".." in candidate:
        return False
    return True


# ---------------------------------------------------------------------------
# The link
# ---------------------------------------------------------------------------


def invite_link(token: str, base_url: str = DEFAULT_INVITE_BASE_URL) -> str:
    """The link the invited person opens."""
    return f"{base_url.rstrip('/')}/{urllib.parse.quote(token, safe='')}"


def _mailto_link(
    email: str, group_name: str, link: str, role: str, host_name: str
) -> str:
    """
    The link that opens the host's own mail client.

    The host can see the whole message before it is sent, and can
    change any part of it. That is the point: the mail is the host's,
    not the server's.
    """
    subject = f"You are invited to {group_name} on FinManager"
    body = (
        f"Hello,\n\n"
        f"{host_name} has invited you to the shared bill "
        f"\"{group_name}\" on FinManager.\n\n"
        f"Open this link to join the group:\n{link}\n\n"
        f"The link is good until it expires, and it can only be used once. "
        f"You do not need an account to join: the link is the pass.\n"
    )
    query = urllib.parse.urlencode(
        {"subject": subject, "body": body},
        quote_via=urllib.parse.quote,
    )
    return f"mailto:{email}?{query}"


def _gmail_draft_url(
    email: str, group_name: str, link: str, role: str, host_name: str
) -> str:
    """
    The link that opens Gmail with the message ready.

    The same thing as the `mailto:` link, for the readers whose mail
    is in Gmail. Nothing is sent from here either: it opens a compose
    window with the message in it.
    """
    subject = f"You are invited to {group_name} on FinManager"
    body = (
        f"Hello,\n\n"
        f"{host_name} has invited you to the shared bill "
        f"\"{group_name}\" on FinManager.\n\n"
        f"Open this link to join the group:\n{link}\n\n"
        f"The link is good until it expires, and it can only be used once. "
        f"You do not need an account to join: the link is the pass.\n"
    )
    params = {
        "view": "cm",
        "fs": "1",
        "to": email,
        "su": subject,
        "body": body,
    }
    return "https://mail.google.com/mail/?view=cm&fs=1&" + urllib.parse.urlencode(
        params, quote_via=urllib.parse.quote
    )


def _draft_body(
    group_name: str, link: str, host_name: str, role: str
) -> str:
    """The message, as text."""
    return (
        f"Hello,\n\n"
        f"{host_name} has invited you to the shared bill "
        f"\"{group_name}\" on FinManager, as a {role}.\n\n"
        f"Open this link to join the group:\n{link}\n\n"
        f"The link is good until it expires, and it can only be used once. "
        f"You do not need an account to join: the link is the pass.\n"
    )


# ---------------------------------------------------------------------------
# The service
# ---------------------------------------------------------------------------


def _host_name(user) -> str:
    """What to call the reader who made the invitation."""
    for part in (getattr(user, "full_name", None), getattr(user, "username", None)):
        if part and str(part).strip():
            return str(part).strip()
    return "The host"


def _group_of(db: Session, group_id: int, user_id: int):
    """
    The group, if the reader is allowed to invite into it.

    A group belongs to the reader who made it and to the people in
    it. Somebody else's group is not theirs to invite into.
    """
    from app.models.split_bill import SplitGroup, SplitMember

    group = db.query(SplitGroup).filter(SplitGroup.id == group_id).first()
    if group is None:
        return None, "not_found"
    if group.owner_id == user_id:
        return group, None

    member = (
        db.query(SplitMember)
        .filter(
            SplitMember.group_id == group.id,
            SplitMember.user_id == user_id,
        )
        .first()
    )
    if member is None:
        return None, "forbidden"
    return group, None


def create_invitation(
    db: Session,
    group_id: int,
    invited_by: int,
    email: str,
    role: str = ROLE_MEMBER,
    base_url: str = DEFAULT_INVITE_BASE_URL,
    host_name: str = "The host",
    group_name: str = "",
) -> Dict[str, Any]:
    """
    Write an invitation down and give the host the link to send.

    The row is made and committed. Nothing is sent: the answer carries
    a `mailto:` link and a Gmail compose link for the host to click,
    and a `draft_created` flag saying whether a Gmail draft was made
    for them.

    A malformed address is refused. So is a role that is not one of
    the two roles there are.
    """
    from app.models.split_invitation import SplitInvitation

    address = normalise_email(email)
    if not is_valid_email(address):
        raise ValueError("that is not an email address")

    wanted_role = (role or ROLE_MEMBER).strip().upper()
    if wanted_role not in INVITATION_ROLES:
        raise ValueError("that is not a role a person can be invited as")

    group, problem = _group_of(db, group_id, invited_by)
    if problem == "not_found":
        raise LookupError("the group was not found")
    if problem == "forbidden":
        raise PermissionError("this group is not yours")

    if not group_name:
        group_name = str(group.name or "a shared bill")

    token = new_token()
    invitation = SplitInvitation(
        group_id=group.id,
        invited_by=invited_by,
        email=address,
        role=wanted_role,
        status=STATUS_INVITED,
        token_hash=hash_token(token),
        expires_at=datetime.utcnow() + INVITATION_LIFETIME,
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    link = invite_link(token, base_url)
    mailto = _mailto_link(address, group_name, link, wanted_role, host_name)
    gmail_url = _gmail_draft_url(address, group_name, link, wanted_role, host_name)

    draft = _make_gmail_draft(
        db=db,
        user_id=invited_by,
        to=address,
        subject=f"You are invited to {group_name} on FinManager",
        body=_draft_body(group_name, link, host_name, wanted_role),
    )

    return {
        "id": invitation.id,
        "group_id": invitation.group_id,
        "email": invitation.email,
        "role": invitation.role,
        "status": invitation.status,
        "token": token,
        "invite_url": link,
        "mailto_link": mailto,
        "gmail_draft_url": gmail_url,
        "draft_created": bool(draft),
        "expires_at": invitation.expires_at.isoformat()
        if invitation.expires_at
        else None,
        "created_at": invitation.created_at.isoformat()
        if invitation.created_at
        else None,
    }


def _make_gmail_draft(
    db: Session,
    user_id: int,
    to: str,
    subject: str,
    body: str,
) -> Optional[Dict[str, Any]]:
    """
    Make a draft in the host's Gmail, if they have connected it.

    A draft is a proposal, not a message. Nothing is sent: the host
    opens their drafts, reads it, and presses send. If the connection
    is not there, or the call fails, this returns nothing and the
    invitation still works - the host has the `mailto:` link.
    """
    try:
        from app.models.gmail_credentials import GmailCredentials
    except Exception:  # noqa: BLE001
        return None

    try:
        credential = (
            db.query(GmailCredentials)
            .filter(GmailCredentials.user_id == user_id)
            .first()
        )
    except Exception:  # noqa: BLE001
        return None

    if credential is None:
        return None

    try:
        from app.modules.integrations.email_parser.gmail_oauth import GmailOAuth
        from app.modules.integrations.email_parser.gmail_router import decrypt_token

        refresh_token = decrypt_token(credential.encrypted_refresh_token)
        oauth = GmailOAuth()
        tokens = oauth.refresh_access_token(refresh_token)
        access_token = tokens.get("access_token")
        if not access_token:
            return None

        import base64

        from app.modules.integrations.email_parser.gmail_service import GmailService

        service = GmailService(access_token)
        raw = (
            f"To: {to}\r\n"
            f"Subject: {subject}\r\n"
            "Content-Type: text/plain; charset=\"UTF-8\"\r\n"
            "\r\n"
            f"{body}"
        ).encode("utf-8")
        encoded = base64.urlsafe_b64encode(raw).decode("ascii")

        import requests

        response = requests.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            },
            json={
                "message": {
                    "raw": encoded,
                    "threadId": None,
                }
            },
            timeout=20,
        )
        if response.status_code not in (200, 201):
            return None

        data = response.json() or {}
        return {"draft_id": data.get("id")}
    except Exception:  # noqa: BLE001 - the draft is a convenience
        return None


def invitation_response(invitation, token: Optional[str] = None) -> Dict[str, Any]:
    """One invitation, as the screen sees it."""
    answer = {
        "id": invitation.id,
        "group_id": invitation.group_id,
        "email": invitation.email,
        "role": invitation.role,
        "status": invitation.status,
        "expires_at": invitation.expires_at.isoformat()
        if invitation.expires_at
        else None,
        "joined_at": invitation.joined_at.isoformat()
        if invitation.joined_at
        else None,
        "created_at": invitation.created_at.isoformat()
        if invitation.created_at
        else None,
        "member_id": invitation.member_id,
    }
    if token is not None:
        answer["token"] = token
        answer["invite_url"] = invite_link(token)
    return answer


def list_invitations(db: Session, group_id: int) -> List[Dict[str, Any]]:
    """The invitations of one group, newest first."""
    from app.models.split_invitation import SplitInvitation

    rows = (
        db.query(SplitInvitation)
        .filter(SplitInvitation.group_id == group_id)
        .order_by(SplitInvitation.id.desc())
        .all()
    )
    return [invitation_response(row) for row in rows]


def find_by_token(db: Session, token: str):
    """The invitation a token points at."""
    from app.models.split_invitation import SplitInvitation

    if not token:
        return None
    return (
        db.query(SplitInvitation)
        .filter(SplitInvitation.token_hash == hash_token(token))
        .first()
    )


def _is_expired(invitation) -> bool:
    """Whether the invitation has run out of time."""
    if invitation.expires_at is None:
        return False
    return invitation.expires_at <= datetime.utcnow()


def expire_invitation(db: Session, invitation) -> None:
    """Mark an invitation as expired."""
    if invitation.status == STATUS_EXPIRED:
        return
    invitation.status = STATUS_EXPIRED
    db.commit()


def update_invitation_status(db: Session, invitation, status: str) -> None:
    """
    Move an invitation to another status.

    Only the three statuses there are. An invitation that has been
    used cannot go back to being waiting: the token is spent.
    """
    wanted = (status or "").strip().upper()
    if wanted not in INVITATION_STATUSES:
        raise ValueError("that is not a status an invitation can be in")
    if invitation.status == STATUS_JOINED and wanted != STATUS_JOINED:
        raise ValueError("an invitation that has been used cannot be used again")
    invitation.status = wanted
    db.commit()


def join_with_token(
    db: Session,
    token: str,
    display_name: str,
    role: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Join a group with an invitation token.

    This is the whole point of the file. The person who opens the link
    may have no account and may never make one. So the join works off
    the token alone:

    - the token is looked up by its hash;
    - if it has been used, the answer is that it cannot be used again;
    - if it has run out of time, the answer is that it has expired;
    - otherwise a member of the group is made, with the name the
      person gave, and no user row is created.

    The name is checked against the other members, because the name is
    what a line of the receipt is claimed against and two people with
    the same name would make the claim ambiguous. The same rule is in
    `split_guest.py`, for the same reason.
    """
    import secrets

    from app.models.split_bill import SplitGroup, SplitMember

    name = (display_name or "").strip()
    if not name:
        raise ValueError("a name is needed")
    if len(name) > 60:
        raise ValueError("that name is too long")

    invitation = find_by_token(db, token)
    if invitation is None:
        raise LookupError("that invitation was not found")

    if invitation.status == STATUS_JOINED:
        raise PermissionError("that invitation has already been used")
    if invitation.status == STATUS_EXPIRED:
        raise TimeoutError("that invitation has expired")
    if _is_expired(invitation):
        expire_invitation(db, invitation)
        raise TimeoutError("that invitation has expired")

    group = db.query(SplitGroup).filter(SplitGroup.id == invitation.group_id).first()
    if group is None:
        raise LookupError("the group was not found")
    if not group.is_active:
        raise PermissionError("this group has been closed")

    existing = (
        db.query(SplitMember)
        .filter(
            SplitMember.group_id == group.id,
            SplitMember.display_name == name,
        )
        .first()
    )
    if existing is not None:
        raise PermissionError("somebody at this table already has that name")

    member = SplitMember(
        group_id=group.id,
        user_id=None,
        display_name=name,
        claim_token=secrets.token_urlsafe(24),
        is_present=True,
        is_host=False,
    )
    db.add(member)
    db.flush()

    invitation.member_id = member.id
    invitation.status = STATUS_JOINED
    invitation.joined_at = datetime.utcnow()
    if role:
        wanted_role = role.strip().upper()
        if wanted_role in INVITATION_ROLES:
            invitation.role = wanted_role
    db.commit()
    db.refresh(member)

    return {
        "status": STATUS_JOINED,
        "group_id": group.id,
        "group_name": group.name,
        "role": invitation.role,
        "member": {
            "id": member.id,
            "group_id": member.group_id,
            "user_id": member.user_id,
            "display_name": member.display_name,
            "avatar_url": member.avatar_url,
            "avatar_color": member.avatar_color,
            "is_host": bool(member.is_host),
            "is_present": bool(member.is_present),
            "has_claim_token": bool(member.claim_token),
        },
    }
