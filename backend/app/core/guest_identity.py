"""
The name of a guest account.

A guest account is one the application makes for a reader who has not
signed up. It is named after the device that asked for it, so the
same device gets the same account back next time.

The rule this file holds is small, but it was broken once and the
break was invisible until two readers happened to collide:

- The username is built from the **whole** device id. It used to be
  cut to the first eight characters, and the database has a unique
  index on the username, so two devices whose ids started the same
  way were refused. The second one of them saw a 500.
- The characters that are not safe in a username are replaced, so
  the name can be put into a query and into an email without
  quoting it.
- The name fits the column.
"""

import re

# The username column is 100 characters wide.
USERNAME_MAX_LENGTH = 100

# Everything that is not a letter, a digit, an underscore, a dot or a
# dash becomes an underscore.
_UNSAFE = re.compile(r"[^A-Za-z0-9_.-]")


def guest_username(device_id: str) -> str:
    """
    The username for a guest account.

    The whole device id is used. Any two different device ids give
    two different usernames, unless they are longer than the column,
    and the column is wider than any device id the application
    issues.
    """
    clean = _UNSAFE.sub("_", str(device_id or ""))
    return f"guest_{clean}"[:USERNAME_MAX_LENGTH]


def guest_email(device_id: str) -> str:
    """
    The email for a guest account.

    It is what the account is looked up by, so it is built from the
    whole device id as well.
    """
    clean = _UNSAFE.sub("_", str(device_id or ""))
    return f"guest_{clean}@finmanager.local"
