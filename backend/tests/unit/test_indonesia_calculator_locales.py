"""
Every code the server can send has a name in every language.

The Indonesian calculators send a code with a failure, so the screen
can say what went wrong in the language the reader picked. If a code
arrived with no name, the reader would fall back to the sentence the
server wrote, in the server's language. This test is what stops
that.

It reads the locale file directly, because the codes live in their
own batch file rather than in the main locale tables.
"""

from pathlib import Path
import re

BATCH = (
    Path(__file__).resolve().parents[3]
    / "frontend"
    / "src"
    / "i18n"
    / "keys_batch5.js"
)

CODES = {"unknown_status", "unknown_risk", "unknown_category", "unknown"}
LANGUAGES = ("id", "en", "ja")


def _language_block(text, language):
    """The part of the file that belongs to one language."""
    pattern = rf"{language}:\s*\{{(.*?)\n  \}}"
    found = re.search(pattern, text, re.DOTALL)
    assert found, f"no {language} block in {BATCH}"
    return found.group(1)


def test_the_batch_file_is_there():
    assert BATCH.exists(), f"{BATCH} is not there"


def test_every_code_has_a_name_in_every_language():
    text = BATCH.read_text(encoding="utf-8")
    for language in LANGUAGES:
        block = _language_block(text, language)
        for code in CODES:
            key = f"calc_error_{code}"
            assert key in block, f"{key} is missing from {language}"


def test_every_code_has_a_name_that_is_not_empty():
    text = BATCH.read_text(encoding="utf-8")
    for language in LANGUAGES:
        block = _language_block(text, language)
        for code in CODES:
            key = f"calc_error_{code}"
            found = re.search(rf"{key}:\s*'([^']*)'", block)
            assert found, f"{key} has no value in {language}"
            assert found.group(1).strip(), f"{key} is empty in {language}"
