"""
The reminders.

A reminder is a nudge to record the day's spending, or to pay a bill
that is coming due. It is opt-in: the reader turns the reminders on
and chooses how often they come.

The endpoint here works out what the reminder would say. It does not
send anything. The browser asks this, and shows what comes back, and
the browser is the one that shows it — so nothing leaves the device.

The text is a code as well as a sentence, for the same reason as
everywhere else in this application: a sentence written in one
language cannot be put into another, so the screen translates the
code. The sentence is still here, for a log or a developer.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.reminder_service import build_reminder

router = APIRouter(tags=["Reminders"])


@router.get("/next")
def get_next_reminder(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    What the reader should be reminded about, if anything.

    The answer says whether to remind at all. When there is nothing
    worth saying, `should_remind` is false, and the screen shows
    nothing rather than an empty reminder.
    """
    reminder = build_reminder(db, current_user.id)
    return {
        **reminder,
        # The screen reads the code and puts it in the reader's
        # language. The message is the fallback for when a code has no
        # name in that language.
        "message_key": f"reminder_code_{reminder['code']}",
    }
