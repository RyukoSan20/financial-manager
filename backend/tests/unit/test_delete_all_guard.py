"""
Deleting everything is guarded on the server.

The settings screen asks the reader to type a word before it deletes.
That check was only ever in the browser, so a request without it
deleted everything: a stray call, a retry, a link that was followed
by accident.

The server now asks for the same word. The words are the ones the
three languages use, because the reader must not have to switch
language to delete their data.
"""

import pytest
from fastapi.testclient import TestClient

from app.api.routes.data import DELETE_CONFIRMATION_WORDS
from app.core.security import get_current_user
from app.main import app


class FakeUser:
    """A reader who exists only for these tests."""

    id = 4242
    email = "reader@example.invalid"
    is_active = True


@pytest.fixture(scope="module")
def client():
    """
    A client with a reader already signed in.

    The dependency is replaced rather than a real account being made,
    so nothing here touches a real person or real money.
    """
    test_client = TestClient(app)
    test_client.app.dependency_overrides[get_current_user] = lambda: FakeUser()
    return test_client


def test_deleting_without_a_confirmation_is_refused(client):
    """
    The bare request does nothing.
    """
    response = client.delete("/api/data/delete-all")
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "confirmation_required"


def test_deleting_with_the_wrong_word_is_refused(client):
    response = client.delete("/api/data/delete-all?confirm=maybe")
    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "confirmation_wrong"


def test_an_empty_confirmation_is_refused(client):
    response = client.delete("/api/data/delete-all?confirm=")
    assert response.status_code == 400


def test_each_language_word_is_accepted():
    """
    The word the reader was shown is in their own language, and the
    server has to accept all three.
    """
    assert "HAPUS" in DELETE_CONFIRMATION_WORDS
    assert "DELETE" in DELETE_CONFIRMATION_WORDS
    assert "削除" in DELETE_CONFIRMATION_WORDS


def test_the_confirmation_words_match_the_screen():
    """
    The words on the server have to be the words the screen asks
    for. This reads the three locale files and compares them.
    """
    from pathlib import Path
    import re

    root = Path(__file__).resolve().parents[3]
    for language in ("id", "en", "ja"):
        locale = root / "frontend" / "src" / "i18n" / f"{language}.js"
        text = locale.read_text(encoding="utf-8")
        found = re.search(r'confirm_word:\s*"([^"]+)"', text)
        assert found, f"no confirm_word in {language}"
        word = found.group(1)
        assert word in DELETE_CONFIRMATION_WORDS, (
            f"the screen asks for {word!r} but the server does not accept it"
        )
