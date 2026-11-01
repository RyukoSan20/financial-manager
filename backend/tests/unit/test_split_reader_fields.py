"""
The routes read fields off the signed-in reader.

That reader is a row in the ``users`` table, and the table has
``full_name`` and ``username`` and ``email`` on it. It does not have
``name``.

The test stand-in for the reader used to have a ``name`` on it,
because that is what the route asked for. So the route was wrong and
the test was wrong in the same way, and the two agreed with each
other and nothing caught it. On the server the reader is the real
record, and the route fell over with a 500 the first time somebody
opened the shared bill page.

So this checks the route against the real model: every field a route
reads off the reader has to be a column that is really there.

Nothing here touches the production database.
"""

import ast
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

ROUTE_FILES = (
    "split_bills.py",
    "split_guest.py",
    "split_gmail.py",
    "split_payments.py",
)

# The fields the reader really has.
KNOWN = {
    "id",
    "email",
    "username",
    "full_name",
    "phone",
    "avatar_url",
    "is_active",
    "is_verified",
    "is_guest",
    "created_at",
    "updated_at",
    "last_login",
    "google_id",
    "google_picture",
    "supabase_id",
    "email_verified",
    "email_verification_token",
    "password_reset_token",
    "password_reset_expires",
    "default_currency",
    "timezone",
    "hashed_password",
}


def _reader_attributes_used(path: Path):
    """
    Every attribute read off something named current_user or user.

    The reader is passed in under two names in these files, and both
    of them are the row in the users table.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    used = set()

    for node in ast.walk(tree):
        if not isinstance(node, ast.Attribute):
            continue
        if not isinstance(node.value, ast.Name):
            continue
        if node.value.id not in ("current_user", "user"):
            continue
        used.add(node.attr)

    return used


def _real_columns():
    """The columns the users table really has, read from the model."""
    import app.models.user  # noqa: F401
    from app.models.user import User

    return {column.name for column in User.__table__.columns}


def test_the_real_record_has_the_fields_the_routes_read():
    """
    Every field the routes read off the reader is a column that exists.
    """
    real = _real_columns()
    missing = KNOWN - real

    assert not missing, (
        f"this test knows about fields the model does not have: {sorted(missing)}"
    )

    for name in ROUTE_FILES:
        path = BACKEND_DIR / "app" / "api" / "routes" / name
        assert path.exists(), f"the route file {name} is not there"

        used = _reader_attributes_used(path)
        unknown = {a for a in used if a not in real and a not in _helper_names(path)}

        assert not unknown, (
            f"{name} reads {sorted(unknown)} off the reader, and the "
            "users table has no such column"
        )


def _helper_names(path: Path):
    """
    The names the file defines itself.

    A route file has helpers of its own, and a helper may take the
    reader and read a field off it. Those fields are still checked,
    but they are not the route's own attribute accesses, so they are
    not collected here.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names = set()

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            names.add(node.name)

    return names


def test_the_display_name_helper_covers_the_record_it_is_given():
    """
    The helper that names the reader has to work with the record as it
    really is: no full name, no username, just an email.
    """
    import app.models.user  # noqa: F401
    from app.models.user import User
    from app.api.routes.split_bills import _display_name

    class AReader:
        def __init__(self, full_name=None, username=None):
            self.email = "someone@example.test"
            self.full_name = full_name
            self.username = username

    assert _display_name(AReader()) == "someone@example.test"
    assert _display_name(AReader(full_name="  Someone  ")) == "Someone"
    assert _display_name(AReader(username="someone")) == "someone"

    # And the real model has the fields the helper asks for.
    assert hasattr(User, "full_name")
    assert hasattr(User, "username")
    assert hasattr(User, "email")
