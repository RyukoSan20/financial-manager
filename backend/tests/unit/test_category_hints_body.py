"""
The category hint endpoints have to accept what the page sends.

This is the bug that was found by driving the real application in a
browser: a transaction was saved, and the learning that follows it
answered 422.

The page sends a body:

    POST /api/category-hints/record-batch
    {"tokens": ["kopi", "susu"], "category_id": 6}

The endpoint had been written to read the same words from the query
string, so FastAPI looked for them there, found nothing, and refused
the request. The learning never happened, so the reader's own words
never became the suggestion.

These tests pin both ways in: the body the page sends, and the query
string the endpoint used to read, so neither one can break the other.
"""

import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, UUID  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402

from app.api.routes.category_hints import router as hints_router  # noqa: E402
from app.core.security import get_current_user  # noqa: E402
from app.models.user import User  # noqa: E402


# The database in the test is SQLite, and these types are the ones
# PostgreSQL has. The compilers make them readable in SQLite too.
@compiles(JSONB, "sqlite")
def _jsonb_as_text(element, compiler, **kw):
    return "TEXT"


@compiles(ARRAY, "sqlite")
def _array_as_text(element, compiler, **kw):
    return "TEXT"


@compiles(INET, "sqlite")
def _inet_as_text(element, compiler, **kw):
    return "TEXT"


@compiles(UUID, "sqlite")
def _uuid_as_text(element, compiler, **kw):
    return "TEXT"


@pytest.fixture()
def client():
    """
    The category hint endpoints, on a database that is thrown away
    after, with the reader already signed in.

    The endpoints open their own session, so the session that is
    created here is used for reading the rows back.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    from app.core.database import Base
    from app.models.category_hint import CategoryHint  # noqa: F401

    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    reader = User(
        email="hint-reader@example.com",
        username="hint-reader",
        hashed_password="not-used-here",
        is_active=True,
    )
    session.add(reader)
    session.commit()
    session.refresh(reader)
    reader_id = reader.id

    app = FastAPI()
    app.include_router(hints_router)

    def override_current_user():
        return reader

    app.dependency_overrides[get_current_user] = override_current_user

    # The endpoints open their own session rather than taking one, so
    # the session they open has to be the session of the test.
    #
    # The session is made with autoflush off, the way the application's
    # own session is made. That is the whole point: with the flush on,
    # a query finds a row that was only added a moment ago, and the
    # code looks as though it handles the duplicate. With the flush
    # off - which is how the server runs - the query does not find it,
    # the word is added a second time, and the unique index refuses
    # it. The test has to be the shape the server is, or it passes
    # while the server fails.
    import app.api.routes.category_hints as hints_module

    original_session_local = hints_module.SessionLocal
    hints_module.SessionLocal = sessionmaker(bind=engine, autoflush=False)

    try:
        with TestClient(app) as test_client:
            yield test_client, session, reader_id
    finally:
        hints_module.SessionLocal = original_session_local
        session.close()
        engine.dispose()


def test_recording_a_batch_from_a_body_is_accepted(client):
    """The way the page sends it. This is the one that was broken."""
    test_client, session, reader_id = client

    response = test_client.post(
        "/api/category-hints/record-batch",
        json={"tokens": ["kopi", "susu"], "category_id": 6},
    )

    assert response.status_code == 200, (
        f"the body the page sends was refused: {response.text}"
    )
    assert response.json()["count"] == 2


def test_the_words_the_page_sent_are_stored(client):
    """The words are remembered, which is the whole point."""
    test_client, session, reader_id = client

    test_client.post(
        "/api/category-hints/record-batch",
        json={"tokens": ["kopi", "susu"], "category_id": 6},
    )

    from app.models.category_hint import CategoryHint

    rows = (
        session.query(CategoryHint)
        .filter(CategoryHint.user_id == reader_id)
        .all()
    )
    assert {row.token for row in rows} == {"kopi", "susu"}, (
        f"the words were not stored: {[r.token for r in rows]}"
    )


def test_recording_a_batch_from_the_query_string_still_works(client):
    """The older way in. A client that still does this must not break."""
    test_client, session, reader_id = client

    response = test_client.post(
        "/api/category-hints/record-batch?tokens=kopi&tokens=susu&category_id=6"
    )

    assert response.status_code == 200, (
        f"the query string was refused: {response.text}"
    )


def test_recording_one_word_from_a_body_is_accepted(client):
    test_client, session, reader_id = client

    response = test_client.post(
        "/api/category-hints/record",
        json={"token": "kopi", "category_id": 6},
    )

    assert response.status_code == 200, f"the body was refused: {response.text}"


def test_a_correction_from_a_body_is_accepted(client):
    test_client, session, reader_id = client

    response = test_client.post(
        "/api/category-hints/correct",
        json={"token": "kopi", "correct_category_id": 6, "wrong_category_id": 9},
    )

    assert response.status_code == 200, f"the body was refused: {response.text}"


def test_a_correction_from_the_query_string_still_works(client):
    test_client, session, reader_id = client

    response = test_client.post(
        "/api/category-hints/correct?token=kopi&correct_category_id=6"
    )

    assert response.status_code == 200, (
        f"the query string was refused: {response.text}"
    )


def test_a_batch_with_nothing_in_it_is_refused(client):
    """Nothing to learn is a mistake, not a silent success."""
    test_client, session, reader_id = client

    response = test_client.post(
        "/api/category-hints/record-batch",
        json={"tokens": [], "category_id": 6},
    )

    assert response.status_code == 422, (
        f"an empty batch was accepted: {response.text}"
    )


def test_a_correction_of_a_word_known_under_another_category(client):
    """
    The bug that was found in production.

    The table holds one row for a word - the unique index is on
    ``(user_id, token)`` - so a reader cannot have two categories for
    the same word. The code looked for a row that included the
    category, found nothing when the word was already known under a
    different one, and inserted a second row. The insert collided with
    that index, and the server answered 500.

    The test database is SQLite, which does not enforce the index the
    way PostgreSQL does, so this has to be checked by reading the rows
    back: a second row for the same word is the bug.
    """
    test_client, session, reader_id = client

    # The word is learned under one category.
    first = test_client.post(
        "/api/category-hints/record",
        json={"token": "kopi", "category_id": 6},
    )
    assert first.status_code == 200, f"the first sighting failed: {first.text}"

    # The reader corrects it: the word belongs to another category.
    second = test_client.post(
        "/api/category-hints/correct",
        json={"token": "kopi", "correct_category_id": 9, "wrong_category_id": 6},
    )
    assert second.status_code == 200, (
        f"the correction was refused: {second.text}"
    )

    from app.models.category_hint import CategoryHint

    rows = (
        session.query(CategoryHint)
        .filter(CategoryHint.user_id == reader_id)
        .all()
    )
    assert len(rows) == 1, (
        f"the word has {len(rows)} rows: a word has one category"
    )
    assert rows[0].category_id == 9, (
        f"the correction did not take: the category is {rows[0].category_id}"
    )


def test_a_word_taught_again_under_another_category_is_moved(client):
    """
    Teaching a word again moves it, rather than keeping both.

    A reader who uses the word under a different category has changed
    their mind about it, so the old association goes.
    """
    test_client, session, reader_id = client

    test_client.post(
        "/api/category-hints/record",
        json={"token": "susu", "category_id": 6},
    )
    again = test_client.post(
        "/api/category-hints/record",
        json={"token": "susu", "category_id": 11},
    )
    assert again.status_code == 200, f"the second sighting failed: {again.text}"

    from app.models.category_hint import CategoryHint

    rows = (
        session.query(CategoryHint)
        .filter(CategoryHint.user_id == reader_id)
        .all()
    )
    assert len(rows) == 1, f"the word has {len(rows)} rows"
    assert rows[0].category_id == 11, (
        f"the word was not moved: the category is {rows[0].category_id}"
    )


def test_the_same_word_in_one_batch_is_stored_once(client):
    """
    A batch that says the same word twice is one hint.

    Without this the second occurrence collided with the unique index
    and the whole batch was lost.
    """
    test_client, session, reader_id = client

    response = test_client.post(
        "/api/category-hints/record-batch",
        json={"tokens": ["kopi", "kopi", "susu"], "category_id": 6},
    )
    assert response.status_code == 200, f"the batch was refused: {response.text}"

    from app.models.category_hint import CategoryHint

    rows = (
        session.query(CategoryHint)
        .filter(CategoryHint.user_id == reader_id)
        .all()
    )
    assert len(rows) == 2, f"the batch made {len(rows)} rows, not 2"
