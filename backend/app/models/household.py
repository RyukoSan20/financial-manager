"""
A household, or a pair of business partners.

Money is rarely one person's. A family shares the groceries and the
school fees; two partners share a shop. The rest of the application
is about one reader's own accounts, and it stays that way - a
household does not open anybody's accounts to anybody else.

What a household shares is the things people agree on out loud: who
is in it, what is on the calendar, who is doing what, what has to be
bought, and the notes left on the fridge. Those are the tables here.

Every table hangs off ``households`` and is removed with it.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text,
)

from app.core.database import Base


# The two ways a household can be used. The tables are the same; the
# words on the page and the mascot's hat are what change.
HOUSEHOLD_MODES = ("family", "business")

# What a member is. The host made the household.
MEMBER_ROLES = ("host", "partner", "member")


class Household(Base):
    """The shared space itself."""

    __tablename__ = "households"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    mode = Column(String(20), nullable=False, default="family")
    # Eight capital letters and digits. Whoever holds it can join.
    invite_code = Column(String(8), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HouseholdMember(Base):
    """
    Somebody in the household.

    ``user_id`` is empty for somebody who was invited by name and has
    not signed in and joined yet. They are on the list so the others
    can assign things to them, and their status says "invited".
    """

    __tablename__ = "household_members"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False, default="member")
    # One of the application's own drawn faces, by its id.
    avatar = Column(String(40), nullable=False, default="avatar-default")
    # "active" or "invited".
    status = Column(String(20), nullable=False, default="active")
    joined_at = Column(DateTime, default=datetime.utcnow)
    last_active_at = Column(DateTime, nullable=True)


class HouseholdAgenda(Base):
    """Something on the shared calendar: a meeting, a bill to remember."""

    __tablename__ = "household_agendas"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    date = Column(Date, nullable=False)
    # "19.00" - what the reader typed, kept as they typed it.
    time = Column(String(20), nullable=True)
    location = Column(String(200), nullable=True)
    # "meeting" or "bill".
    kind = Column(String(20), nullable=False, default="meeting")
    # "upcoming" or "done".
    status = Column(String(20), nullable=False, default="upcoming")
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class HouseholdTask(Base):
    """Something somebody said they would do."""

    __tablename__ = "household_tasks"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    assignee = Column(String(100), nullable=True)
    completed = Column(Boolean, nullable=False, default=False)
    reward_points = Column(Integer, nullable=False, default=10)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class HouseholdNeed(Base):
    """
    Something the household has to buy.

    When it is bought, the transaction that paid for it is remembered
    here, so the list and the ledger say the same thing.
    """

    __tablename__ = "household_needs"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    estimated_price = Column(Numeric(20, 2), nullable=False, default=0)
    assignee = Column(String(100), nullable=True)
    purchased = Column(Boolean, nullable=False, default=False)
    # No foreign keys on these two: the transaction and the wishlist
    # item belong to one reader and can be deleted by them, and that
    # must not be stopped by a shopping list.
    transaction_id = Column(Integer, nullable=True)
    wishlist_item_id = Column(Integer, nullable=True)
    purchased_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class HouseholdNote(Base):
    """A note left for the others."""

    __tablename__ = "household_notes"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    author = Column(String(100), nullable=True)
    body = Column(Text, nullable=False)
    # The colour of the paper, by name.
    color = Column(String(20), nullable=False, default="lemon")
    created_at = Column(DateTime, default=datetime.utcnow)


class HouseholdGoalLink(Base):
    """
    A target somebody chose to show the household.

    The goal itself stays in ``goals`` and stays its owner's. This
    row only says "the others may see how this one is going".
    """

    __tablename__ = "household_goal_links"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    goal_id = Column(Integer, ForeignKey("goals.id", ondelete="CASCADE"), nullable=False, index=True)
    shared_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class HouseholdActivity(Base):
    """
    What happened in the household, in order.

    ``action`` is a short code ("task_done", "need_bought", ...) and
    not a sentence, so the page can say it in the reader's language.
    """

    __tablename__ = "household_activities"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    actor = Column(String(100), nullable=True)
    action = Column(String(40), nullable=False)
    detail = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# The order the tables are made in: the household first, because the
# others point at it.
HOUSEHOLD_MODELS = (
    Household,
    HouseholdMember,
    HouseholdAgenda,
    HouseholdTask,
    HouseholdNeed,
    HouseholdNote,
    HouseholdGoalLink,
    HouseholdActivity,
)

HOUSEHOLD_TABLES = tuple(model.__tablename__ for model in HOUSEHOLD_MODELS)
