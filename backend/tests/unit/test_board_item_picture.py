"""
The picture on the card.

A card with a picture in it is easier to recognise than a line of
text, so the board shows the picture of the thing when there is one.

These tests are about the picture reaching the board at all. It was
missing: the column was on the record, and the board simply did not
carry it across, so the card was written as bare text.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.schemas.kanban_board import BoardItem


class TestThePictureOnTheCard:
    def test_a_card_may_have_a_picture(self):
        """
        The board is allowed to carry a picture. Without this, every
        card would be a line of text.
        """
        item = BoardItem(
            id=1,
            name="Indomie Goreng",
            quantity=1,
            amount=3500,
            stage="wishlist",
            position=0,
            allowed_next=["to_buy"],
            image_url="/api/merchant/images/abc.webp",
        )
        assert item.image_url == "/api/merchant/images/abc.webp"

    def test_a_card_without_a_picture_is_still_a_card(self):
        """
        Most things have no picture. That is not a reason for the card
        to fail.
        """
        item = BoardItem(
            id=2,
            name="Beras 5 kg",
            quantity=1,
            amount=68000,
            stage="wishlist",
            position=0,
            allowed_next=["to_buy"],
        )
        assert item.image_url is None

    def test_the_picture_is_not_a_requirement(self):
        """
        The picture is never asked for. A thing that cannot be
        photographed is still a thing that goes on the list.
        """
        item = BoardItem(
            id=3,
            name="Sabun",
            quantity=1,
            amount=15000,
            stage="to_buy",
            position=0,
            allowed_next=["ready"],
        )
        assert item.image_url is None
