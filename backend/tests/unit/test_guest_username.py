"""
Guest login must not fail when two devices share a short prefix.

The guest account is named after the device that asked for it. The
name used to be made by cutting the device id to eight characters,
which meant two different devices whose ids started the same way
produced the same username. The database has a unique index on the
username, so the second one of them was refused with a 500.

The rule is in `app.core.guest_identity`. It is checked here because
the rule is easy to break by accident: the name has to be unique for
any two different device ids, and it has to fit the column.
"""

from app.core.guest_identity import (
    USERNAME_MAX_LENGTH,
    guest_email,
    guest_username,
)


def test_two_different_devices_get_two_different_usernames():
    """
    The bug: `guest_` plus the first eight characters of the device
    id. Two devices whose ids started the same way got the same
    username, and the second one was refused.
    """
    a = guest_username("previewcheck123456")
    b = guest_username("previewcheck999999")

    assert a != b, "two different devices got the same username"


def test_the_same_device_always_gets_the_same_username():
    """
    The same device has to keep the same account, otherwise a guest
    gets a new account every time they come back.
    """
    assert guest_username("abc123") == guest_username("abc123")


def test_the_username_fits_the_column():
    """The column is 100 characters. The name has to fit in it."""
    username = guest_username("x" * 300)

    assert len(username) <= USERNAME_MAX_LENGTH


def test_the_username_has_no_characters_that_break_a_query():
    """
    The name goes into a database and into an email, so it cannot
    hold a quote or a space.
    """
    username = guest_username("weird id/with'chars\"and spaces")

    assert " " not in username
    assert "'" not in username
    assert '"' not in username


def test_the_guest_email_is_built_from_the_whole_device_id():
    """
    The email is what the account is looked up by, so it has to hold
    the whole device id.
    """
    device_id = "previewcheck123456"

    assert device_id in guest_email(device_id)


def test_the_username_is_as_unique_as_the_email():
    """
    The username cannot be shorter than the part that makes the
    email unique, or the two would collide with each other.
    """
    device_id = "previewcheck123456"

    assert len(guest_username(device_id)) >= len(f"guest_{device_id}")
