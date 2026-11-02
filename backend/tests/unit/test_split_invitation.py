"""
Invitations to a shared bill, tested.

A host invites somebody by email. The invitation is a row. The
invited person gets a link with a token in it, opens it, and is in
the group.

The rules that matter here:

- the token is single use. A second use of the same token fails
  cleanly, and says so.
- the token is stored hashed. A copy of the database does not give
  away an invitation.
- an invitation that has been used is JOINED, and one that has run
  out of time is EXPIRED.
- a malformed email is refused.
- a reader cannot invite anybody into a group that is not theirs.
- and the one that is really important: joining an invitation never
  makes an account. A person who has never heard of this
  application joins the group as a guest, exactly like somebody who
  opens a link from a chat window. No account is created from an
  email address that somebody else wrote down.
"""

import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.database import Base, get_db  # noqa: E402
from app.core.security import get_current_user  # noqa: E402
from app.api.routes import split_bills, split_invitation  # noqa: E402

TABLES = (
    "users",
    "accounts",
    "categories",
    "transactions",
    "receipt_scans",
    "split_groups",
    "split_members",
    "split_expenses",
    "split_payers",
    "split_items",
    "split_item_claims",
    "split_calculated_shares",
    "split_settlements",
    "split_payment_methods",
    "split_invitations",
)


class TheHost:
    """The reader who owns the group."""

    id = 1
    email = "host@example.test"
    is_active = True
    full_name = "The Host"
    username = None


class AStranger:
    """A reader who owns nothing."""

    id = 2
    email = "stranger@example.test"
    is_active = True
    full_name = "A Stranger"
    username = None


@pytest.fixture()
def client():
    """The application, with a small database behind it."""
    import app.models.user  # noqa: F401
    import app.models.account  # noqa: F401
    import app.models.category  # noqa: F401
    import app.models.transaction  # noqa: F401
    import app.models.receipt  # noqa: F401

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    private = MetaData()

    copied = set()

    def copy_table(name):
        if name in copied or name not in Base.metadata.tables:
            return
        copied.add(name)
        source = Base.metadata.tables[name]
        for column in source.columns:
            for foreign_key in column.foreign_keys:
                copy_table(foreign_key.target_fullname.split(".")[0])
        source.to_metadata(private)

    for name in TABLES:
        copy_table(name)

    private.create_all(engine)
    Session = sessionmaker(bind=engine)

    app = FastAPI()
    app.include_router(split_bills.router, prefix="/api/split")
    app.include_router(split_invitation.router, prefix="/api/split-invitations")

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = lambda: TheHost()

    with TestClient(app) as test_client:
        test_client.db = Session
        yield test_client


def _make_group(client, name="Friday dinner"):
    """A group the host owns."""
    response = client.post("/api/split/groups", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def _invite(client, group_id, email="friend@example.test", role="MEMBER"):
    return client.post(
        f"/api/split-invitations/groups/{group_id}/invitations",
        json={"email": email, "role": role},
    )


# ---------------------------------------------------------------------------
# The invitation itself
# ---------------------------------------------------------------------------


def test_creating_an_invitation_gives_a_token_and_the_status(client):
    """The invitation starts as INVITED, and carries a token."""
    group = _make_group(client)
    response = _invite(client, group["id"])
    assert response.status_code == 201, response.text

    body = response.json()
    assert body["status"] == "INVITED"
    assert body["token"], "the invitation has no token"
    assert body["invite_url"].endswith(body["token"])


def test_the_invitation_offers_a_link_the_reader_clicks(client):
    """
    The invitation does not send anything by itself.

    It gives the host a link to click, so the mail goes out from the
    host's own mail client and the host can see what is being sent.
    """
    group = _make_group(client)
    body = _invite(client, group["id"]).json()

    assert body["mailto_link"].startswith("mailto:")
    assert "friend@example.test" in body["mailto_link"]
    assert body["gmail_draft_url"].startswith("https://mail.google.com/")


def test_the_token_is_stored_hashed(client):
    """A copy of the database does not give away an invitation."""
    group = _make_group(client)
    body = _invite(client, group["id"]).json()

    db = client.db()
    try:
        row = (
            db.query(__import__(
                "app.models.split_invitation", fromlist=["SplitInvitation"]
            ).SplitInvitation)
            .filter_by(id=body["id"])
            .first()
        )
        assert row is not None
        assert row.token_hash != body["token"]
        assert row.token_hash
    finally:
        db.close()


def test_a_malformed_email_is_refused(client):
    """An address that is not an address is not an invitation."""
    group = _make_group(client)
    response = _invite(client, group["id"], email="not-an-address")
    assert response.status_code == 422, response.text


def test_a_reader_cannot_invite_into_a_group_that_is_not_theirs(client):
    """Somebody else's group is not theirs to invite into."""
    group = _make_group(client)

    app = client.app
    app.dependency_overrides[get_current_user] = lambda: AStranger()
    try:
        response = _invite(client, group["id"])
        assert response.status_code == 403, response.text
    finally:
        app.dependency_overrides[get_current_user] = lambda: TheHost()


# ---------------------------------------------------------------------------
# Joining
# ---------------------------------------------------------------------------


def test_joining_with_the_token_makes_a_member(client):
    """The invited person is in the group afterwards."""
    group = _make_group(client)
    token = _invite(client, group["id"]).json()["token"]

    response = client.post(
        "/api/split-invitations/join",
        json={"token": token, "display_name": "The Friend"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "JOINED"
    assert body["member"]["display_name"] == "The Friend"
    assert body["member"]["group_id"] == group["id"]


def test_joining_marks_the_invitation_joined(client):
    """The invitation has been used."""
    group = _make_group(client)
    invitation = _invite(client, group["id"]).json()

    client.post(
        "/api/split-invitations/join",
        json={"token": invitation["token"], "display_name": "The Friend"},
    )

    response = client.get(f"/api/split-invitations/groups/{group['id']}/invitations")
    assert response.status_code == 200
    rows = response.json()
    assert rows[0]["status"] == "JOINED"


def test_using_the_token_a_second_time_fails(client):
    """A token is good for one use only."""
    group = _make_group(client)
    token = _invite(client, group["id"]).json()["token"]

    first = client.post(
        "/api/split-invitations/join",
        json={"token": token, "display_name": "The Friend"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/split-invitations/join",
        json={"token": token, "display_name": "Someone Else"},
    )
    assert second.status_code == 409, second.text


def test_an_unknown_token_fails(client):
    """A token that was never given to anybody does not work."""
    response = client.post(
        "/api/split-invitations/join",
        json={"token": "not-a-real-token", "display_name": "The Friend"},
    )
    assert response.status_code == 404, response.text


def test_an_expired_token_fails(client):
    """An invitation that has run out of time does not work."""
    group = _make_group(client)
    invitation = _invite(client, group["id"]).json()

    from datetime import datetime, timedelta

    from app.models.split_invitation import SplitInvitation

    db = client.db()
    try:
        row = db.query(SplitInvitation).filter_by(id=invitation["id"]).first()
        row.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()

    response = client.post(
        "/api/split-invitations/join",
        json={"token": invitation["token"], "display_name": "The Friend"},
    )
    assert response.status_code == 410, response.text


def test_joining_does_not_make_an_account(client):
    """
    No account is made from somebody else's email address.

    This is the rule that keeps an invitation from becoming a way to
    make accounts for strangers. The join creates a member of the
    group and nothing else.
    """
    group = _make_group(client)
    token = _invite(client, group["id"], email="nobody@example.test").json()["token"]

    client.post(
        "/api/split-invitations/join",
        json={"token": token, "display_name": "The Friend"},
    )

    from app.models.user import User

    db = client.db()
    try:
        made = (
            db.query(User)
            .filter(User.email == "nobody@example.test")
            .count()
        )
        assert made == 0, "joining made an account out of an email address"
    finally:
        db.close()


def test_a_joined_member_has_no_user_id(client):
    """
    The member is a guest until they claim it with an account.

    The join flow works off the token alone, so there is no user to
    point at.
    """
    group = _make_group(client)
    token = _invite(client, group["id"]).json()["token"]

    body = client.post(
        "/api/split-invitations/join",
        json={"token": token, "display_name": "The Friend"},
    ).json()

    assert body["member"]["user_id"] is None
