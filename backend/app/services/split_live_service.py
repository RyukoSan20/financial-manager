"""
The live board, and the little stream of changes that feeds it.

The host of a shared bill watches a board where everybody at the
table taps what they ate. The screen should change the moment
somebody taps, not two seconds later.

The way this is done here is a stream: the browser opens a
connection and the server writes to it when something changes. The
server keeps one small board per group, and the board holds the
connections of everybody watching that group.

Nothing here touches the database. What changed is decided
elsewhere; this only carries the news.
"""

import asyncio
import json
from typing import Any, AsyncIterator, Dict, List, Optional, Set

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User


# The boards, one per group, kept in memory.
#
# They are not in the database because they are not worth keeping:
# a board is only interesting while somebody is watching it, and
# when everybody has gone, the group is free to be forgotten.
_BOARDS: Dict[str, "LiveBoard"] = {}


def event_to_bytes(event: Dict[str, Any]) -> bytes:
    """
    One event, written the way a browser reads a stream.

    A stream is a long run of text with no end. The browser needs
    to know where one thing ends and the next begins, so each event
    is written as one line of JSON with a newline at the end of it.
    """
    payload = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
    return (payload + "\n").encode("utf-8")


def parse_event(raw: bytes) -> Dict[str, Any]:
    """
    One line of the stream, read back into what it was.
    """
    return json.loads(raw.decode("utf-8").strip())


class LiveBoard:
    """
    One group's board, and the readers watching it.

    A reader is a connection. When something happens, every reader
    of that group is given the same news.
    """

    def __init__(self) -> None:
        self._readers: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

    @property
    def reader_count(self) -> int:
        return len(self._readers)

    async def publish(self, event: Dict[str, Any]) -> int:
        """
        Tell everybody watching.

        The number that comes back is how many were told. A board
        with nobody watching is not a problem; it just means the
        news was not interesting to anybody.
        """
        raw = event_to_bytes(event)

        async with self._lock:
            readers = list(self._readers)

        for queue in readers:
            try:
                queue.put_nowait(raw)
            except asyncio.QueueFull:
                # A reader that cannot keep up is dropped rather
                # than allowed to hold everybody else up. The
                # browser will reconnect and ask for the whole board
                # again.
                pass

        return len(readers)

    async def subscribe(self) -> AsyncIterator[bytes]:
        """
        Watch the board until the reader goes away.
        """
        queue: asyncio.Queue = asyncio.Queue(maxsize=64)

        async with self._lock:
            self._readers.add(queue)

        try:
            while True:
                raw = await queue.get()
                yield raw
        finally:
            async with self._lock:
                self._readers.discard(queue)


def get_board(group_id: str) -> LiveBoard:
    """
    The board for a group, made if it is not there yet.
    """
    board = _BOARDS.get(group_id)
    if board is None:
        board = LiveBoard()
        _BOARDS[group_id] = board
    return board


def drop_board(group_id: str) -> None:
    """
    Forget a board nobody is watching any more.
    """
    _BOARDS.pop(group_id, None)
