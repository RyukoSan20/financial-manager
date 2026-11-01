"""
The board, live.

When somebody at the table taps an item, the host's screen should
change without the host pressing anything. Right now the host's
screen asks the server every couple of seconds, which works, but it
is wasteful and it lags.

This is the live feed: the server holds the connection open and
writes when something changes.

Each test here is a fake: it stands in for the browser, reads from
the feed, and checks that what arrives is what it should be.
"""

import asyncio
import json

import pytest

from app.services.split_live_service import (
    LiveBoard,
    event_to_bytes,
    parse_event,
)


def test_an_event_is_written_as_one_line_of_json():
    raw = event_to_bytes({"type": "claim", "item_id": 3})

    assert raw.endswith(b"\n")
    assert raw.count(b"\n") == 1

    # A browser reads the stream one event at a time, and the
    # newline is what tells it where one event ends.
    assert json.loads(raw.decode("utf-8"))["type"] == "claim"


def test_an_event_reads_back_to_what_it_was():
    original = {"type": "release", "item_id": 7, "member": "Budi"}

    assert parse_event(event_to_bytes(original)) == original


def test_a_board_tells_the_readers_when_something_changes():
    board = LiveBoard()

    written = []

    async def reader():
        async for chunk in board.subscribe():
            written.append(chunk)
            if len(written) >= 1:
                break

    async def claimer():
        await asyncio.sleep(0)
        await board.publish({"type": "claim", "item_id": 1})
        await asyncio.sleep(0.05)

    async def run():
        tasks = [asyncio.create_task(reader()), asyncio.create_task(claimer())]
        await asyncio.gather(*tasks)

    asyncio.run(run())

    assert len(written) == 1
    assert json.loads(written[0].decode("utf-8"))["item_id"] == 1


def test_a_board_tells_every_reader_not_only_the_first():
    board = LiveBoard()

    written = [[], []]

    async def reader(index):
        async for chunk in board.subscribe():
            written[index].append(chunk)
            break

    async def claimer():
        await asyncio.sleep(0)
        await board.publish({"type": "claim", "item_id": 2})
        await asyncio.sleep(0.05)

    async def run():
        tasks = [asyncio.create_task(reader(0)), asyncio.create_task(reader(1))]
        tasks.append(asyncio.create_task(claimer()))
        await asyncio.gather(*tasks)

    asyncio.run(run())

    assert len(written[0]) == 1
    assert len(written[1]) == 1


def test_a_reader_who_leaves_stops_counting():
    board = LiveBoard()

    assert board.reader_count == 0

    async def reader():
        async for _ in board.subscribe():
            break

    async def run():
        task = asyncio.create_task(reader())
        await asyncio.sleep(0.05)
        await board.publish({"type": "claim", "item_id": 1})
        await asyncio.sleep(0.05)
        await task

    asyncio.run(run())

    # A reader that has gone should not be waited for again.
    assert board.reader_count == 0


def test_publishing_to_nobody_is_not_an_error():
    board = LiveBoard()

    async def run():
        await board.publish({"type": "claim", "item_id": 1})

    asyncio.run(run())
