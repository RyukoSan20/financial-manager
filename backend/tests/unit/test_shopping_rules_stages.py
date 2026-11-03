"""
The stages of the shopping board.

The board in the books has seven stages, because a thing that is on
its way and a thing that is on its way but late are not the same
thing. The reader thinks in four columns, and this is where the seven
stages are gathered into four.

These tests are about the rules of moving a card, because a card
that can be dragged anywhere makes a board that lies: it says a thing
was bought when no money changed hands, and it says a thing was never
wanted when it was bought and paid for.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services import shopping_rules as rules


class TestTheSevenStages:
    def test_the_stages_are_in_the_order_they_happen(self):
        assert rules.STAGE_ORDER == (
            "wishlist",
            "to_buy",
            "ready",
            "ordered",
            "shipped",
            "received",
            "cancelled",
        )

    def test_ready_stands_between_saving_and_ordering(self):
        """
        "Siap checkout" comes after the saving and before the money
        goes out. A card cannot be ready before it is being saved for.
        """
        order = rules.STAGE_ORDER
        assert order.index("to_buy") < order.index("ready")
        assert order.index("ready") < order.index("ordered")

    def test_the_stages_of_things_that_have_been_bought(self):
        """
        A thing is bought once the money has gone out. That is
        "ordered", and everything after it.
        """
        assert rules.PAID_STAGES == ("ordered", "shipped", "received")

    def test_ready_is_not_a_stage_of_things_that_have_been_bought(self):
        """
        "Ready" means the decision has been made but the money has not
        gone out yet. Treating it as bought would cut the money from
        the budget before it was spent.
        """
        assert "ready" not in rules.PAID_STAGES


class TestWhatMayMoveWhere:
    def test_a_wanted_thing_can_be_moved_to_the_saving_column(self):
        assert rules.can_move("wishlist", "to_buy") is True

    def test_a_wanted_thing_can_be_made_ready(self):
        assert rules.can_move("wishlist", "ready") is True

    def test_a_saved_thing_can_be_made_ready(self):
        assert rules.can_move("to_buy", "ready") is True

    def test_a_ready_thing_can_be_moved_back_to_the_saving_column(self):
        """
        A thing that was going to be bought this month can be put back
        to being saved for.
        """
        assert rules.can_move("ready", "to_buy") is True

    def test_a_ready_thing_can_be_cancelled(self):
        assert rules.can_move("ready", "cancelled") is True

    def test_a_ready_thing_cannot_jump_to_wishlist(self):
        """
        It goes back to the saving column, not to the beginning. A
        thing that was decided on is not the same as a thing that was
        never thought about.
        """
        assert rules.can_move("ready", "wishlist") is False

    def test_a_thing_that_arrived_cannot_go_back(self):
        """
        A return is written down by hand as a transaction. It is not
        something a drag of the mouse does.
        """
        assert rules.can_move("received", "ordered") is False
        assert rules.can_move("received", "ready") is False
        assert rules.can_move("received", "wishlist") is False

    def test_a_cancelled_thing_can_come_back_to_the_wishlist(self):
        assert rules.can_move("cancelled", "wishlist") is True
        assert rules.can_move("cancelled", "to_buy") is True

    def test_a_cancelled_thing_cannot_become_ready(self):
        """
        A thing that was given up has to be wanted again first.
        """
        assert rules.can_move("cancelled", "ready") is False


class TestWhatTheReaderIsOffered:
    def test_the_stages_offered_after_a_wanted_thing(self):
        assert rules.allowed_next("wishlist") == ["to_buy", "ready", "ordered", "cancelled"]

    def test_the_stages_offered_after_a_ready_thing(self):
        assert rules.allowed_next("ready") == ["to_buy", "ordered", "cancelled"]

    def test_a_thing_that_arrived_is_offered_nothing(self):
        assert rules.allowed_next("received") == []

    def test_every_stage_offers_only_stages_that_exist(self):
        """
        A stage that is offered but is not in the order would be a
        card that cannot be dragged anywhere.
        """
        for stage in rules.STAGE_ORDER:
            for offered in rules.allowed_next(stage):
                assert offered in rules.STAGE_ORDER
