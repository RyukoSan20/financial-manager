"""
The household.

These checks hold the things that would hurt if they broke:

- the tables are there, even on a database nobody prepared;
- every tab of the page writes to the database and reads it back;
- one household cannot see or change another's rows;
- being in a household does not show anybody your money;
- buying something from the list writes exactly one expense.

Nothing here touches the production server or a real database.
"""

import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TODAY = date.today()

# Everything except the household's own tables. Those are left for the
# application to make, so the checks prove that it does.
PREPARED = (
    "users", "accounts", "categories", "transactions", "transfers",
    "recurring_rules", "receipt_scans", "merchants", "transaction_items",
    "breakdown_items", "budgets", "goals", "goal_contributions",
    "wishlist_items", "shopping_items_new", "category_hints",
    "split_groups", "split_members", "split_expenses",
)


@pytest.fixture()
def engine():
    from app.core.database import Base
    import app.models  # noqa: F401
    from app.models.user import User  # noqa: F401 - not in the models package's list

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _connect(dbapi_connection, _record):
        # The balance update says NOW(), which SQLite does not have.
        dbapi_connection.create_function("NOW", 0, lambda: "2026-11-10 00:00:00")

    Base.metadata.create_all(
        bind=engine,
        tables=[t for name, t in Base.metadata.tables.items() if name in PREPARED],
    )
    # The wishlist is declared on a metadata of its own.
    from app.models.shopping_item import WishlistItem

    WishlistItem.__table__.create(bind=engine, checkfirst=True)

    yield engine
    engine.dispose()


@pytest.fixture()
def db(engine):
    from app.models.account import Account
    from app.models.category import Category
    from app.models.user import User

    session = sessionmaker(bind=engine)()
    session.add(User(id=1, email="ani@example.com", full_name="Ani", hashed_password="x",
                     avatar_url="/assets/generated/brand/avatar-sun.svg"))
    session.add(User(id=2, email="budi@example.com", full_name="Budi", hashed_password="x"))
    session.add(User(id=3, email="cici@example.com", full_name="Cici", hashed_password="x"))
    session.add(Account(id=1, user_id=1, name="BCA", account_type="bank", balance=1000000, currency="IDR"))
    session.add(Account(id=2, user_id=2, name="Mandiri", account_type="bank", balance=500000, currency="IDR"))
    session.add(Category(id=1, name="Gaji", type="income", system_key="salary"))
    session.add(Category(id=6, name="Makanan & Minuman", type="expense", system_key="food_drink"))
    session.add(Category(id=8, name="Belanja", type="expense", system_key="shopping"))
    session.add(Category(id=11, name="Hiburan", type="expense", system_key="entertainment"))
    session.add(Category(id=13, name="Investasi & Tabungan", type="expense", system_key="savings_investment"))
    session.add(Category(id=20, name="Kopi", type="expense", parent_id=6))
    session.commit()
    try:
        yield session
    finally:
        session.close()


class _Who:
    """Which reader is asking. The checks change it to change seats."""
    user_id = 1


@pytest.fixture()
def client(db):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.routes import household
    from app.core.database import get_db
    from app.core.security import get_current_user
    from app.models.user import User

    _Who.user_id = 1

    application = FastAPI()
    application.include_router(household.router, prefix="/api/household")
    application.dependency_overrides[get_db] = lambda: db
    application.dependency_overrides[get_current_user] = (
        lambda: db.query(User).filter(User.id == _Who.user_id).first()
    )
    return TestClient(application, raise_server_exceptions=False)


def as_user(user_id):
    _Who.user_id = user_id


def add_tx(db, id, user, account, kind, amount, category, day=None):
    from app.models.transaction import Transaction

    db.add(Transaction(
        id=id, user_id=user, account_id=account, type=kind, amount=amount,
        date=day or TODAY, category_id=category, description=f"tx {id}",
    ))
    db.commit()


# ---------------------------------------------------------------------------
# The tables
# ---------------------------------------------------------------------------

def test_the_tables_are_made_on_a_database_nobody_prepared(client, engine):
    from sqlalchemy import inspect

    from app.models.household import HOUSEHOLD_TABLES

    assert not set(HOUSEHOLD_TABLES) & set(inspect(engine).get_table_names())

    response = client.get("/api/household")
    assert response.status_code == 200, response.text[:400]

    assert set(HOUSEHOLD_TABLES) <= set(inspect(engine).get_table_names())


def test_the_migration_and_the_models_name_the_same_columns():
    """A column added to a model and forgotten in the migration is a broken deploy."""
    import importlib.util

    from app.models.household import HOUSEHOLD_MODELS

    path = BACKEND_DIR / "alembic" / "versions" / "20261110_household.py"
    spec = importlib.util.spec_from_file_location("household_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    migrated = {name: {c.name for c in columns} for name, columns, _ in module._tables()}
    for model in HOUSEHOLD_MODELS:
        table = model.__tablename__
        assert table in migrated, f"the migration does not make {table}"
        assert migrated[table] == set(model.__table__.columns.keys()), table

    assert module.down_revision == "20261108_breakdown_items"


def test_the_server_startup_makes_the_tables_too():
    source = (BACKEND_DIR / "app" / "main.py").read_text(encoding="utf-8")
    assert "HOUSEHOLD_MODELS" in source
    assert 'prefix="/api/household"' in source


# ---------------------------------------------------------------------------
# GET /api/household
# ---------------------------------------------------------------------------

def test_the_first_visit_makes_a_household(client):
    body = client.get("/api/household").json()

    assert body["name"] == "Keuangan Keluarga & Partner"
    assert body["mode"] == "family"
    assert body["can_manage"] is True
    for key in ("members", "budget_pacing", "attention_items", "agendas",
                "tasks", "needs", "goals", "notes", "activity"):
        assert key in body, key

    assert len(body["members"]) == 1
    host = body["members"][0]
    assert host["name"] == "Ani"
    assert host["role"] == "host"
    assert host["avatar"] == "avatar-sun"
    assert host["online"] is True


def test_the_path_answers_with_and_without_the_slash(client):
    assert client.get("/api/household").status_code == 200
    assert client.get("/api/household/").status_code == 200


def test_the_second_visit_is_the_same_household(client):
    first = client.get("/api/household").json()
    second = client.get("/api/household").json()
    assert first["id"] == second["id"]
    assert first["invite_code"] == second["invite_code"]
    assert len(second["members"]) == 1


def test_the_invite_code_is_eight_capitals_and_digits(client):
    code = client.get("/api/household").json()["invite_code"]
    assert re.fullmatch(r"[A-Z0-9]{8}", code), code


def test_two_households_have_two_codes(client):
    first = client.get("/api/household").json()["invite_code"]
    as_user(2)
    second = client.get("/api/household").json()["invite_code"]
    assert first != second


def test_a_code_that_is_taken_is_not_given_again(db, monkeypatch):
    from app.models.household import Household
    from app.services import household_service as service

    service.ensure_tables(db)
    db.add(Household(owner_id=1, name="x", mode="family", invite_code="AAAAAAAA"))
    db.commit()

    # The first eight draws spell the taken code; the next eight a free one.
    draws = iter("AAAAAAAA" + "BBBBBBBB")
    monkeypatch.setattr(service.secrets, "choice", lambda _alphabet: next(draws))

    assert service.new_invite_code(db) == "BBBBBBBB"


# ---------------------------------------------------------------------------
# The pacing: real numbers, from the reader's own records
# ---------------------------------------------------------------------------

def test_the_pacing_sorts_spending_into_needs_wants_and_savings(client, db):
    from app.models.goal import Goal, GoalContribution

    add_tx(db, 1, 1, 1, "income", 10000000, 1)
    add_tx(db, 2, 1, 1, "expense", 300000, 6)     # food: a need
    add_tx(db, 3, 1, 1, "expense", 50000, 20)     # coffee, under food: a need
    add_tx(db, 4, 1, 1, "expense", 200000, 11)    # entertainment: a want
    add_tx(db, 5, 1, 1, "expense", 70000, None)   # no category: a want
    add_tx(db, 6, 1, 1, "expense", 400000, 13)    # savings category
    db.add(Goal(id=1, user_id=1, name="Dana Darurat", target_amount=5000000,
                current_amount=100000, target_date=TODAY + timedelta(days=90),
                goal_type="savings"))
    db.add(GoalContribution(goal_id=1, amount=100000, date=TODAY))
    db.commit()

    pacing = client.get("/api/household").json()["budget_pacing"]

    assert pacing["kebutuhan"]["spent"] == 350000
    assert pacing["keinginan"]["spent"] == 270000
    assert pacing["tabungan"]["spent"] == 500000
    assert pacing["current_day"] == TODAY.day
    assert 28 <= pacing["days_in_month"] <= 31


def test_the_pacing_agrees_with_the_total_every_other_page_shows(client, db):
    """The three parts are the month's spending, cut three ways."""
    from app.services import metrics

    add_tx(db, 1, 1, 1, "expense", 300000, 6)
    add_tx(db, 2, 1, 1, "expense", 200000, 11)
    add_tx(db, 3, 1, 1, "expense", 400000, 13)

    pacing = client.get("/api/household").json()["budget_pacing"]
    parts = sum(pacing[k]["spent"] for k in ("kebutuhan", "keinginan", "tabungan"))

    _, expense = metrics.period_totals(db, 1, *metrics.month_range(TODAY))
    assert parts == expense == 900000


def test_with_no_budgets_the_limits_are_shares_of_the_income(client, db):
    add_tx(db, 1, 1, 1, "income", 10000000, 1)

    pacing = client.get("/api/household").json()["budget_pacing"]

    assert pacing["kebutuhan"]["limit"] == 5000000
    assert pacing["keinginan"]["limit"] == 3000000
    assert pacing["tabungan"]["limit"] == 2000000
    assert pacing["kebutuhan"]["limit_source"] == "income_rule"


def test_a_budget_is_the_limit_when_there_is_one(client, db):
    from app.models.budget import Budget

    add_tx(db, 1, 1, 1, "income", 10000000, 1)
    db.add(Budget(user_id=1, name="Makan", amount=2000000, period="monthly",
                  start_date=TODAY.replace(day=1), category_id=6, is_active=True))
    db.add(Budget(user_id=1, name="Makan mingguan", amount=120000, period="weekly",
                  start_date=TODAY.replace(day=1), category_id=6, is_active=True))
    db.commit()

    pacing = client.get("/api/household").json()["budget_pacing"]

    # 2.000.000 a month, and 120.000 a week which is 520.000 a month.
    assert pacing["kebutuhan"]["limit"] == 2520000
    assert pacing["kebutuhan"]["limit_source"] == "budgets"
    # The bucket with no budget still falls back.
    assert pacing["keinginan"]["limit_source"] == "income_rule"


def test_with_nothing_at_all_the_limit_is_zero_and_says_so(client):
    pacing = client.get("/api/household").json()["budget_pacing"]
    assert pacing["kebutuhan"] == {"spent": 0, "limit": 0, "limit_source": "none"}


def test_last_months_spending_is_not_this_months_pacing(client, db):
    add_tx(db, 1, 1, 1, "expense", 999000, 6, day=TODAY.replace(day=1) - timedelta(days=1))
    pacing = client.get("/api/household").json()["budget_pacing"]
    assert pacing["kebutuhan"]["spent"] == 0


# ---------------------------------------------------------------------------
# What needs attention
# ---------------------------------------------------------------------------

def test_a_bill_due_this_week_needs_attention(client, db):
    from app.models.recurring import RecurringRule

    def rule(description, due, kind="expense", active=True):
        db.add(RecurringRule(
            user_id=1, type=kind, amount=350000, description=description,
            account_id=1, frequency="monthly", start_date=TODAY - timedelta(days=60),
            next_occurrence=due, is_active=active,
        ))

    rule("Listrik", TODAY + timedelta(days=3))
    rule("Sewa tahun depan", TODAY + timedelta(days=40))
    rule("Gaji", TODAY + timedelta(days=2), kind="income")
    rule("Langganan lama", TODAY + timedelta(days=1), active=False)
    db.commit()

    items = client.get("/api/household").json()["attention_items"]
    bills = [i for i in items if i["kind"] == "upcoming_bill"]

    assert [b["title"] for b in bills] == ["Listrik"]
    assert bills[0]["amount"] == 350000
    assert bills[0]["days_left"] == 3
    assert bills[0]["href"] == "/recurring"


def test_a_budget_that_is_gone_past_needs_attention(client, db):
    from app.models.budget import Budget

    db.add(Budget(user_id=1, name="Hiburan", amount=100000, period="monthly",
                  start_date=TODAY.replace(day=1), category_id=11, is_active=True))
    db.add(Budget(user_id=1, name="Makan", amount=900000, period="monthly",
                  start_date=TODAY.replace(day=1), category_id=6, is_active=True))
    db.commit()
    add_tx(db, 1, 1, 1, "expense", 250000, 11)
    add_tx(db, 2, 1, 1, "expense", 100000, 6)

    items = client.get("/api/household").json()["attention_items"]
    over = [i for i in items if i["kind"] == "over_budget"]

    assert [o["title"] for o in over] == ["Hiburan"]
    assert over[0]["amount"] == 150000
    assert over[0]["href"] == "/budgets"


def test_nothing_to_look_at_is_an_empty_list(client):
    assert client.get("/api/household").json()["attention_items"] == []


# ---------------------------------------------------------------------------
# Mode and name
# ---------------------------------------------------------------------------

def test_the_mode_is_switched_and_kept(client):
    response = client.post("/api/household/switch-mode", json={"mode": "business"})
    assert response.status_code == 200, response.text[:300]
    assert response.json()["mode"] == "business"

    body = client.get("/api/household").json()
    assert body["mode"] == "business"
    # The name it was given is changed with the mode.
    assert body["name"] == "Keuangan Rekan Bisnis"


def test_a_name_the_reader_chose_survives_a_change_of_mode(client):
    client.post("/api/household/switch-mode", json={"name": "Toko Ani & Budi"})
    client.post("/api/household/switch-mode", json={"mode": "business"})
    assert client.get("/api/household").json()["name"] == "Toko Ani & Budi"


def test_a_mode_that_does_not_exist_is_refused(client):
    response = client.post("/api/household/switch-mode", json={"mode": "kingdom"})
    assert response.status_code == 400
    assert response.json()["detail"] == "unknown_mode"


def test_an_empty_name_is_refused(client):
    response = client.post("/api/household/switch-mode", json={"name": "   "})
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# Invite and join
# ---------------------------------------------------------------------------

def test_an_invitation_gives_a_link_and_a_whatsapp_link(client):
    code = client.get("/api/household").json()["invite_code"]

    response = client.post("/api/household/invite",
                           json={"name": "Budi", "email": "Budi@Example.com"})
    assert response.status_code == 201, response.text[:300]
    body = response.json()

    assert body["invite_code"] == code
    assert body["invite_link"].endswith(f"/household?join={code}")
    assert body["whatsapp_link"].startswith("https://wa.me/?text=")
    assert code in body["whatsapp_link"]
    assert body["member"]["status"] == "invited"
    assert body["member"]["online"] is False

    members = client.get("/api/household").json()["members"]
    assert [m["name"] for m in members] == ["Ani", "Budi"]


def test_inviting_the_same_address_twice_is_one_person(client):
    client.post("/api/household/invite", json={"name": "Budi", "email": "budi@example.com"})
    client.post("/api/household/invite", json={"name": "Budi", "email": "budi@example.com"})
    assert len(client.get("/api/household").json()["members"]) == 2


def test_an_invitation_needs_a_name_and_a_real_address(client):
    assert client.post("/api/household/invite", json={"name": "  "}).status_code == 400
    assert client.post("/api/household/invite",
                       json={"name": "Budi", "email": "not an address"}).status_code == 400


def test_joining_with_the_code_puts_the_reader_in_the_household(client):
    host = client.get("/api/household").json()

    as_user(2)
    response = client.post("/api/household/join",
                           json={"invite_code": host["invite_code"].lower()})
    assert response.status_code == 200, response.text[:300]

    seen = client.get("/api/household").json()
    assert seen["id"] == host["id"]
    assert [m["name"] for m in seen["members"]] == ["Ani", "Budi"]
    assert seen["members"][1]["role"] == "member"
    assert seen["can_manage"] is False


def test_somebody_invited_by_email_takes_the_place_kept_for_them(client):
    code = client.get("/api/household").json()["invite_code"]
    client.post("/api/household/invite", json={"name": "Budi", "email": "budi@example.com"})

    as_user(2)
    client.post("/api/household/join", json={"invite_code": code})
    members = client.get("/api/household").json()["members"]

    assert len(members) == 2
    assert members[1]["status"] == "active"


def test_joining_twice_is_being_in_it_once(client):
    code = client.get("/api/household").json()["invite_code"]
    as_user(2)
    client.post("/api/household/join", json={"invite_code": code})
    client.post("/api/household/join", json={"invite_code": code})
    assert len(client.get("/api/household").json()["members"]) == 2


def test_a_code_nobody_has_is_not_found(client):
    client.get("/api/household")
    response = client.post("/api/household/join", json={"invite_code": "ZZZZ9999"})
    assert response.status_code == 404
    assert response.json()["detail"] == "code_not_found"


def test_a_code_of_the_wrong_shape_is_refused(client):
    assert client.post("/api/household/join", json={"invite_code": "abc"}).status_code == 400
    assert client.post("/api/household/join", json={"invite_code": "ABCD-123"}).status_code == 400


def test_somebody_who_only_joined_cannot_rename_the_household(client):
    code = client.get("/api/household").json()["invite_code"]
    as_user(2)
    client.post("/api/household/join", json={"invite_code": code})

    response = client.post("/api/household/switch-mode", json={"name": "Punya Budi"})
    assert response.status_code == 403

    as_user(1)
    assert client.get("/api/household").json()["name"] == "Keuangan Keluarga & Partner"


# ---------------------------------------------------------------------------
# Agendas, tasks, needs, notes
# ---------------------------------------------------------------------------

def test_an_agenda_is_written_and_read_back(client):
    response = client.post("/api/household/agendas", json={
        "title": "Rapat mingguan tim", "date": "2026-11-13",
        "time": "19.00", "location": "Rumah Nenek",
    })
    assert response.status_code == 201, response.text[:300]

    agendas = client.get("/api/household").json()["agendas"]
    assert len(agendas) == 1
    assert agendas[0]["title"] == "Rapat mingguan tim"
    assert agendas[0]["date"] == "2026-11-13"
    assert agendas[0]["time"] == "19.00"
    assert agendas[0]["location"] == "Rumah Nenek"
    assert agendas[0]["status"] == "upcoming"
    assert agendas[0]["created_by"] == "Ani"


def test_agendas_come_back_soonest_first(client):
    client.post("/api/household/agendas", json={"title": "Kedua", "date": "2026-12-20"})
    client.post("/api/household/agendas", json={"title": "Pertama", "date": "2026-11-15"})
    titles = [a["title"] for a in client.get("/api/household").json()["agendas"]]
    assert titles == ["Pertama", "Kedua"]


def test_an_agenda_is_marked_done_and_undone(client):
    agenda = client.post("/api/household/agendas",
                         json={"title": "Bayar listrik", "date": "2026-11-20", "kind": "bill"}).json()
    assert agenda["kind"] == "bill"

    done = client.patch(f"/api/household/agendas/{agenda['id']}/toggle").json()
    assert done["status"] == "done"
    again = client.patch(f"/api/household/agendas/{agenda['id']}/toggle").json()
    assert again["status"] == "upcoming"


def test_an_agenda_needs_a_title_and_a_date(client):
    assert client.post("/api/household/agendas",
                       json={"title": " ", "date": "2026-11-13"}).status_code == 400
    assert client.post("/api/household/agendas", json={"title": "Rapat"}).status_code == 422
    assert client.post("/api/household/agendas",
                       json={"title": "Rapat", "date": "besok"}).status_code == 422


def test_a_task_is_written_ticked_and_unticked(client):
    response = client.post("/api/household/tasks",
                           json={"title": "Buang sampah", "assignee": "Budi", "reward_points": 15})
    assert response.status_code == 201, response.text[:300]
    task = response.json()
    assert task["completed"] is False
    assert task["reward_points"] == 15

    ticked = client.patch(f"/api/household/tasks/{task['id']}/toggle")
    assert ticked.status_code == 200
    assert ticked.json()["completed"] is True
    assert ticked.json()["completed_at"]

    body = client.get("/api/household").json()
    assert body["tasks"][0]["completed"] is True
    assert body["reward_points"] == 15

    unticked = client.patch(f"/api/household/tasks/{task['id']}/toggle").json()
    assert unticked["completed"] is False
    assert unticked["completed_at"] is None
    assert client.get("/api/household").json()["reward_points"] == 0


def test_a_task_that_is_not_there_is_not_found(client):
    client.get("/api/household")
    assert client.patch("/api/household/tasks/999/toggle").status_code == 404


def test_a_need_is_written_with_its_price(client):
    response = client.post("/api/household/needs",
                           json={"title": "Beras 5kg", "estimated_price": 78000, "assignee": "Ani"})
    assert response.status_code == 201, response.text[:300]

    needs = client.get("/api/household").json()["needs"]
    assert needs[0]["title"] == "Beras 5kg"
    assert needs[0]["estimated_price"] == 78000
    assert needs[0]["assignee"] == "Ani"
    assert needs[0]["purchased"] is False


def test_a_need_cannot_cost_less_than_nothing(client):
    response = client.post("/api/household/needs",
                           json={"title": "Beras", "estimated_price": -1})
    assert response.status_code == 422


def test_a_note_is_written_and_read_back(client):
    response = client.post("/api/household/notes",
                           json={"body": "Jangan lupa bayar arisan", "color": "mint"})
    assert response.status_code == 201, response.text[:300]

    notes = client.get("/api/household").json()["notes"]
    assert notes[0]["body"] == "Jangan lupa bayar arisan"
    assert notes[0]["color"] == "mint"
    assert notes[0]["author"] == "Ani"


def test_a_note_with_no_colour_is_given_one(client):
    from app.services.household_service import NOTE_COLORS

    first = client.post("/api/household/notes", json={"body": "satu"}).json()
    second = client.post("/api/household/notes", json={"body": "dua"}).json()
    assert first["color"] in NOTE_COLORS
    assert second["color"] != first["color"]


def test_an_empty_note_is_refused(client):
    assert client.post("/api/household/notes", json={"body": "  "}).status_code == 400


def test_things_can_be_taken_off_the_list(client):
    note = client.post("/api/household/notes", json={"body": "hapus saya"}).json()
    task = client.post("/api/household/tasks", json={"title": "hapus saya"}).json()
    need = client.post("/api/household/needs", json={"title": "hapus saya"}).json()
    agenda = client.post("/api/household/agendas",
                         json={"title": "hapus saya", "date": "2026-11-13"}).json()

    assert client.delete(f"/api/household/notes/{note['id']}").status_code == 204
    assert client.delete(f"/api/household/tasks/{task['id']}").status_code == 204
    assert client.delete(f"/api/household/needs/{need['id']}").status_code == 204
    assert client.delete(f"/api/household/agendas/{agenda['id']}").status_code == 204

    body = client.get("/api/household").json()
    assert body["notes"] == body["tasks"] == body["needs"] == body["agendas"] == []


def test_what_happened_is_written_down_newest_first(client):
    client.post("/api/household/tasks", json={"title": "Cuci piring"})
    client.post("/api/household/notes", json={"body": "Halo"})

    activity = client.get("/api/household").json()["activity"]
    actions = [a["action"] for a in activity]

    assert actions[:2] == ["note_added", "task_added"]
    assert actions[-1] == "household_created"
    assert activity[0]["actor"] == "Ani"


def test_everybody_in_the_household_sees_the_same_lists(client):
    code = client.get("/api/household").json()["invite_code"]
    client.post("/api/household/tasks", json={"title": "Dari Ani"})

    as_user(2)
    client.post("/api/household/join", json={"invite_code": code})
    client.post("/api/household/notes", json={"body": "Dari Budi"})

    as_user(1)
    body = client.get("/api/household").json()
    assert [t["title"] for t in body["tasks"]] == ["Dari Ani"]
    assert [n["body"] for n in body["notes"]] == ["Dari Budi"]
    assert body["notes"][0]["author"] == "Budi"


# ---------------------------------------------------------------------------
# One household cannot reach into another
# ---------------------------------------------------------------------------

def test_another_households_rows_are_not_shown(client):
    client.post("/api/household/tasks", json={"title": "Rahasia Ani"})
    client.post("/api/household/notes", json={"body": "Rahasia Ani"})

    as_user(3)
    body = client.get("/api/household").json()
    assert body["tasks"] == []
    assert body["notes"] == []
    assert [m["name"] for m in body["members"]] == ["Cici"]


def test_another_households_rows_cannot_be_changed(client, db):
    from app.models.household import HouseholdNote, HouseholdTask

    task = client.post("/api/household/tasks", json={"title": "Punya Ani"}).json()
    note = client.post("/api/household/notes", json={"body": "Punya Ani"}).json()
    need = client.post("/api/household/needs",
                       json={"title": "Punya Ani", "estimated_price": 5000}).json()

    as_user(3)
    client.get("/api/household")
    assert client.patch(f"/api/household/tasks/{task['id']}/toggle").status_code == 404
    assert client.delete(f"/api/household/tasks/{task['id']}").status_code == 404
    assert client.delete(f"/api/household/notes/{note['id']}").status_code == 404
    assert client.post(f"/api/household/needs/{need['id']}/purchase",
                       json={"account_id": 1}).status_code == 404

    db.expire_all()
    assert db.query(HouseholdTask).filter(HouseholdTask.id == task["id"]).one().completed is False
    assert db.query(HouseholdNote).filter(HouseholdNote.id == note["id"]).count() == 1


def test_being_in_a_household_does_not_show_anybody_your_money(client, db):
    """The numbers on the page are the numbers of whoever is looking."""
    from app.models.budget import Budget

    code = client.get("/api/household").json()["invite_code"]
    add_tx(db, 1, 1, 1, "income", 10000000, 1)
    add_tx(db, 2, 1, 1, "expense", 750000, 11)
    db.add(Budget(user_id=1, name="Hiburan", amount=100000, period="monthly",
                  start_date=TODAY.replace(day=1), category_id=11, is_active=True))
    db.commit()

    as_user(2)
    client.post("/api/household/join", json={"invite_code": code})
    body = client.get("/api/household").json()

    assert body["budget_pacing"]["keinginan"]["spent"] == 0
    assert body["budget_pacing"]["kebutuhan"]["limit"] == 0
    assert body["attention_items"] == []
    assert "750000" not in str(body)


# ---------------------------------------------------------------------------
# Bought: one expense, on the buyer's own account
# ---------------------------------------------------------------------------

def test_buying_a_need_writes_the_expense_and_ticks_it_off(client, db):
    from app.models.account import Account
    from app.models.transaction import Transaction

    need = client.post("/api/household/needs",
                       json={"title": "Beras 5kg", "estimated_price": 78000}).json()

    response = client.post(f"/api/household/needs/{need['id']}/purchase",
                           json={"account_id": 1})
    assert response.status_code == 200, response.text[:400]
    body = response.json()
    assert body["created"] is True
    assert body["need"]["purchased"] is True

    db.expire_all()
    tx = db.query(Transaction).filter(Transaction.id == body["transaction_id"]).one()
    assert tx.user_id == 1
    assert tx.type == "expense"
    assert float(tx.amount) == 78000
    assert tx.description == "Beras 5kg"
    assert tx.category_id == 8          # Belanja
    assert tx.status == "approved"
    assert float(db.query(Account).filter(Account.id == 1).one().balance) == 1000000 - 78000


def test_buying_the_same_need_twice_is_one_expense(client, db):
    from app.models.account import Account
    from app.models.transaction import Transaction

    need = client.post("/api/household/needs",
                       json={"title": "Minyak", "estimated_price": 40000}).json()

    first = client.post(f"/api/household/needs/{need['id']}/purchase", json={"account_id": 1}).json()
    second = client.post(f"/api/household/needs/{need['id']}/purchase", json={"account_id": 1}).json()

    assert second["created"] is False
    assert second["transaction_id"] == first["transaction_id"]

    db.expire_all()
    assert db.query(Transaction).count() == 1
    assert float(db.query(Account).filter(Account.id == 1).one().balance) == 1000000 - 40000


def test_what_one_member_bought_is_not_bought_again_by_another(client, db):
    """Two people press the button for the same thing: it is paid for once."""
    from app.models.account import Account
    from app.models.transaction import Transaction

    code = client.get("/api/household").json()["invite_code"]
    need = client.post("/api/household/needs",
                       json={"title": "Galon", "estimated_price": 20000}).json()
    first = client.post(f"/api/household/needs/{need['id']}/purchase", json={"account_id": 1}).json()

    as_user(2)
    client.post("/api/household/join", json={"invite_code": code})
    second = client.post(f"/api/household/needs/{need['id']}/purchase", json={"account_id": 2})

    assert second.status_code == 200
    assert second.json()["created"] is False
    assert second.json()["transaction_id"] == first["transaction_id"]

    db.expire_all()
    assert db.query(Transaction).count() == 1
    assert float(db.query(Account).filter(Account.id == 2).one().balance) == 500000


def test_the_price_actually_paid_is_what_is_written_down(client, db):
    from app.models.transaction import Transaction

    need = client.post("/api/household/needs",
                       json={"title": "Gula", "estimated_price": 15000}).json()
    body = client.post(f"/api/household/needs/{need['id']}/purchase",
                       json={"account_id": 1, "amount": 17500}).json()

    db.expire_all()
    tx = db.query(Transaction).filter(Transaction.id == body["transaction_id"]).one()
    assert float(tx.amount) == 17500


def test_a_need_with_no_price_is_not_bought_for_nothing(client, db):
    from app.models.transaction import Transaction

    need = client.post("/api/household/needs", json={"title": "Entah berapa"}).json()
    response = client.post(f"/api/household/needs/{need['id']}/purchase", json={"account_id": 1})

    assert response.status_code == 400
    assert response.json()["detail"] == "amount_required"
    db.expire_all()
    assert db.query(Transaction).count() == 0
    assert client.get("/api/household").json()["needs"][0]["purchased"] is False


def test_a_need_cannot_be_paid_from_somebody_elses_account(client, db):
    from app.models.account import Account
    from app.models.transaction import Transaction

    need = client.post("/api/household/needs",
                       json={"title": "Sabun", "estimated_price": 9000}).json()
    response = client.post(f"/api/household/needs/{need['id']}/purchase", json={"account_id": 2})

    assert response.status_code == 403
    db.expire_all()
    assert db.query(Transaction).count() == 0
    assert float(db.query(Account).filter(Account.id == 2).one().balance) == 500000
    assert client.get("/api/household").json()["needs"][0]["purchased"] is False


def test_the_one_who_buys_is_the_one_who_pays(client, db):
    """A member buys from the shared list: it is their expense, on their account."""
    from app.models.transaction import Transaction

    code = client.get("/api/household").json()["invite_code"]
    need = client.post("/api/household/needs",
                       json={"title": "Telur", "estimated_price": 30000}).json()

    as_user(2)
    client.post("/api/household/join", json={"invite_code": code})
    body = client.post(f"/api/household/needs/{need['id']}/purchase", json={"account_id": 2}).json()

    db.expire_all()
    tx = db.query(Transaction).filter(Transaction.id == body["transaction_id"]).one()
    assert tx.user_id == 2
    assert tx.account_id == 2


# ---------------------------------------------------------------------------
# The wishlist and the targets
# ---------------------------------------------------------------------------

def test_the_wishlist_is_shared_only_when_the_reader_asks(client, db):
    from app.models.shopping_item import WishlistItem

    db.add(WishlistItem(id=1, user_id=1, name="Rice cooker", target_price=450000))
    db.add(WishlistItem(id=2, user_id=1, name="Kipas angin", target_price=None))
    db.add(WishlistItem(id=3, user_id=2, name="Punya Budi", target_price=1))
    db.commit()

    body = client.get("/api/household").json()
    assert body["needs"] == []
    assert body["wishlist_waiting"] == 2

    response = client.post("/api/household/needs/import-wishlist")
    assert response.status_code == 200, response.text[:300]
    assert len(response.json()["added"]) == 2

    body = client.get("/api/household").json()
    assert sorted(n["title"] for n in body["needs"]) == ["Kipas angin", "Rice cooker"]
    assert body["wishlist_waiting"] == 0

    # Asking again adds nothing.
    assert client.post("/api/household/needs/import-wishlist").json()["added"] == []
    assert len(client.get("/api/household").json()["needs"]) == 2


def test_a_target_is_shown_to_the_household_when_it_is_shared(client, db):
    from app.models.goal import Goal

    db.add(Goal(id=1, user_id=1, name="Liburan Bali", target_amount=8000000,
                current_amount=2000000, target_date=TODAY + timedelta(days=200),
                goal_type="savings"))
    db.add(Goal(id=2, user_id=1, name="Rahasia", target_amount=1000000,
                current_amount=0, target_date=TODAY + timedelta(days=200),
                goal_type="savings"))
    db.commit()

    host = client.get("/api/household").json()
    assert host["goals"] == []

    response = client.post("/api/household/goals/share", json={"goal_id": 1})
    assert response.status_code == 200, response.text[:300]

    as_user(2)
    client.post("/api/household/join", json={"invite_code": host["invite_code"]})
    goals = client.get("/api/household").json()["goals"]

    assert [g["name"] for g in goals] == ["Liburan Bali"]
    assert goals[0]["progress_percent"] == 25
    assert goals[0]["mine"] is False
    assert goals[0]["shared_by"] == "Ani"


def test_somebody_elses_target_is_not_yours_to_share(client, db):
    from app.models.goal import Goal

    db.add(Goal(id=1, user_id=2, name="Punya Budi", target_amount=1000000,
                current_amount=0, target_date=TODAY + timedelta(days=200),
                goal_type="savings"))
    db.commit()

    response = client.post("/api/household/goals/share", json={"goal_id": 1})
    assert response.status_code == 404
    assert client.get("/api/household").json()["goals"] == []


# ---------------------------------------------------------------------------
# The routes
# ---------------------------------------------------------------------------

def test_every_route_the_page_needs_is_on_the_real_application():
    from app.main import app

    have = {(method, route.path) for route in app.routes
            for method in getattr(route, "methods", ())}
    wanted = [
        ("GET", "/api/household"),
        ("POST", "/api/household/switch-mode"),
        ("POST", "/api/household/join"),
        ("POST", "/api/household/invite"),
        ("POST", "/api/household/agendas"),
        ("POST", "/api/household/tasks"),
        ("PATCH", "/api/household/tasks/{task_id}/toggle"),
        ("POST", "/api/household/needs"),
        ("POST", "/api/household/needs/{need_id}/purchase"),
        ("POST", "/api/household/notes"),
    ]
    for route in wanted:
        assert route in have, route


def test_the_page_is_not_answered_without_a_sign_in(db):
    """
    Every route of the household asks who is asking.

    The application here is built for this check alone. The real one
    is shared by the whole suite, and other checks leave a signed-in
    reader on it, which would make this one pass or fail by the order
    the files happen to run in.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from app.api.routes import household
    from app.core.database import get_db

    application = FastAPI()
    application.include_router(household.router, prefix="/api/household")
    application.dependency_overrides[get_db] = lambda: db
    anonymous = TestClient(application)

    calls = [
        ("get", "/api/household", None),
        ("post", "/api/household/switch-mode", {"mode": "business"}),
        ("post", "/api/household/join", {"invite_code": "AAAAAAAA"}),
        ("post", "/api/household/invite", {"name": "x"}),
        ("post", "/api/household/agendas", {"title": "x", "date": "2026-11-13"}),
        ("post", "/api/household/tasks", {"title": "x"}),
        ("patch", "/api/household/tasks/1/toggle", None),
        ("post", "/api/household/needs", {"title": "x"}),
        ("post", "/api/household/needs/1/purchase", {"account_id": 1}),
        ("post", "/api/household/notes", {"body": "x"}),
        ("delete", "/api/household/notes/1", None),
        ("post", "/api/household/goals/share", {"goal_id": 1}),
    ]
    for method, path, body in calls:
        kwargs = {"json": body} if body is not None else {}
        response = getattr(anonymous, method)(path, **kwargs)
        assert response.status_code in (401, 403), f"{method} {path} -> {response.status_code}"

    from sqlalchemy import inspect

    assert "households" not in inspect(db.get_bind()).get_table_names()



def test_the_page_opens_when_the_wishlist_cannot_be_read(client, engine):
    """Another feature's missing table must not take this page down."""
    from sqlalchemy import text

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE wishlist_items"))

    response = client.get("/api/household")
    assert response.status_code == 200, response.text[:300]
    assert response.json()["wishlist_waiting"] == 0
