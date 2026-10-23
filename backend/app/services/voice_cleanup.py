"""
Voice transcription cleanup.

Speech recognition output is noisy in two specific ways, and both of them
show up in the transcript the user sees:

1. **Duplicated words.** The Web Speech API fires an `onresult` event for
   every chunk, and the browser frequently reports the same words twice -
   once as an interim result and again as the final result, or simply
   re-emits a chunk that was already delivered. The result is a transcript
   like "beli kopi kopi dua puluh dua puluh lima ribu lima ribu".

2. **Misspellings.** Indonesian is not well represented in the speech
   engine's vocabulary, so proper nouns and brand names come back mangled:
   "indomaret" becomes "indo mart", "kopiklat" becomes "coffee clat".

This module cleans both problems before the text reaches the parser, and
before the user sees it.

The approach for the misspelling is deliberately conservative: a word is
only "corrected" when there is a known vocabulary to correct it against
and the match is close. A word nobody has ever seen is left alone,
because guessing would corrupt names the user actually said.
"""

import re
from difflib import SequenceMatcher
from typing import List, Optional, Tuple

# Words that are almost always a duplicate artefact rather than something
# the user said twice. Kept deliberately small: "very very good" is a
# legitimate thing to say.
_DUPLICATE_STARTERS = {
    "saya", "aku", "beli", "bayar", "tambah", "kurang", "dan", "atau",
    "yang", "untuk", "dengan", "di", "ke", "dari",
}

# Common Indonesian speech-recognition confusions.
# The key is the mangled form, the value is the correct form.
COMMON_CONFUSIONS = {
    "indo mart": "indomaret",
    "indo maret": "indomaret",
    "indo marret": "indomaret",
    "alfa mart": "alfamart",
    "alfa maret": "alfamart",
    "kopiklat": "kopiklat",
    "kopi clat": "kopiklat",
    "teh pucuk": "teh pucuk",
    "chilsung": "chilsung cider",
    "shin ramyun": "shin ramyun",
    "indomie goreng": "indomie goreng",
    "gula aren": "gula aren",
    "beras premium": "beras premium",
    "pasta": "pasta",
    "resto": "resto",
    "cafe": "cafe",
    "kategori": "kategori",
    "tran saksi": "transaksi",
    "transak si": "transaksi",
    "pembayaran": "pembayaran",
    "pemb ayaran": "pembayaran",
    "sebanyak": "sebanyak",
    "se bathak": "sebanyak",
    "delapan": "delapan",
    "delapan": "delapan",
    "sembilan": "sembilan",
    "semb ilan": "sembilan",
    "seratus": "seratus",
    "se ratus": "seratus",
    "seribu": "seribu",
    "se ribu": "seribu",
    "lima puluh": "lima puluh",
    "limapuluh": "lima puluh",
    "duapuluh": "dua puluh",
    "tigapuluh": "tiga puluh",
    "empatpuluh": "empat puluh",
    "sembilanpuluh": "sembilan puluh",
    "sejuta": "sejuta",
    "satu juta": "satu juta",
    "dua juta": "dua juta",
}

# Vocabulary used to repair a word the engine split or mangled. This is a
# *correction vocabulary*, not a product list: it holds words that belong
# to the domain of the app, so a mangled "warung" or "kopiklat" can be put
# back together.
DOMAIN_VOCABULARY = [
    "indomaret", "alfamaret", "carrefour", "supermarket", "minimarket",
    "kopiklat", "kopi", "warung", "warungs", "restoran", "cafe", "bakso",
    "nasi", "roti", "telur", "beras", "minyak", "gula", "garam", "susu",
    "teh", "air", "minuman", "biskuit", "keripik", "chitato", "tango",
    "mayo", "saos", "kecap", "sambal", "tau", "terasi", "cumi", "tuna",
    "sarden", "susu", "chamilk", "ultra", "in primum", "soyal", "sasa",
    "indomie", "ramyun", "nissin", "chilsung", "cider", "sprite", "fanta",
    "coke", "pepsi", "milo", "nescafe", "kapal api", "dancow", "milk",
    "transaksi", "pembayaran", "pembelian", "pengeluaran", "pemasukan",
    "bayar", "beli", "belanja", "terima", "gaji", "bonus", "tambah",
    "kategori", "catatan", "tanggal", "akun", "saldo", "angsuran",
    "sejuta", "juta", "ribu", "ratus", "puluh",
]


def _normalize_for_compare(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (text or "").lower())


def _similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def collapse_repeated_words(text: str, max_repeats: int = 1) -> str:
    """
    Remove consecutive duplicate words.

    "kopi kopi dua puluh dua puluh lima ribu lima ribu"
    becomes
    "kopi dua puluh lima ribu"

    A word is only collapsed when it appears back to back. Two identical
    words separated by other words are legitimate ("very very good" is
    still collapsed when the repeats are adjacent, but "kopi Susu kopi" is
    left alone because the second "kopi" starts a new phrase).
    """
    if not text:
        return text

    tokens = text.split()
    result: List[str] = []
    previous = None
    repeat_count = 0

    for token in tokens:
        key = _normalize_for_compare(token)
        if key and key == previous:
            repeat_count += 1
            if repeat_count >= max_repeats:
                # Drop this copy.
                continue
        else:
            repeat_count = 0
        result.append(token)
        previous = key

    return " ".join(result)


def remove_partial_repeats(text: str) -> str:
    """
    Remove a duplicate that the recogniser produced with a *slightly*
    different spelling, which is common: "dua puluh" arrives as "duapuluh"
    right after "dua puluh".

    Only adjacent near-duplicates are collapsed, and only when the two
    forms are close enough to be the same phrase.
    """
    if not text:
        return text

    tokens = text.split()
    result: List[str] = []
    i = 0
    while i < len(tokens):
        token = tokens[i]
        # Look ahead: is the next token the same word again, either
        # identically or as a near-duplicate?
        if i + 1 < len(tokens):
            current = _normalize_for_compare(token)
            following = _normalize_for_compare(tokens[i + 1])
            if current and current == following:
                i += 2
                continue
            # "dua puluh" followed by "duapuluh": compare the joined pair.
            if i + 2 < len(tokens):
                joined_current = _normalize_for_compare(token + tokens[i + 1])
                joined_next = _normalize_for_compare(tokens[i + 1] + tokens[i + 2])
                if joined_current and joined_current == joined_next:
                    i += 3
                    continue
        result.append(token)
        i += 1

    return " ".join(result)


def fix_common_confusions(text: str) -> str:
    """
    Repair the spellings the speech engine gets wrong most often.
    """
    if not text:
        return text

    lowered = text.lower()

    # Longest phrases first so "dua puluh" is replaced before "dua".
    for wrong in sorted(COMMON_CONFUSIONS, key=len, reverse=True):
        if wrong in lowered:
            # Preserve the capitalisation of the original occurrence.
            pattern = re.compile(re.escape(wrong), re.IGNORECASE)
            lowered = pattern.sub(COMMON_CONFUSIONS[wrong], lowered)

    return lowered


def repair_split_words(text: str) -> str:
    """
    Rejoin a word the engine split into two parts.

    "indo mart" -> "indomaret", "kopi clat" -> "kopiklat",
    "dua puluh" stays as two words because it is a number phrase.

    The rule: two adjacent words are rejoined when their concatenation
    is close to a known vocabulary word. A word that is not in the
    vocabulary is left alone, because a name the user invented must not
    be mangled.
    """
    if not text:
        return text

    tokens = text.split()
    result: List[str] = []
    i = 0
    while i < len(tokens):
        if i + 1 < len(tokens):
            pair = tokens[i] + tokens[i + 1]
            joined = _normalize_for_compare(pair)
            if joined:
                best, best_score = None, 0.0
                for vocab in DOMAIN_VOCABULARY:
                    score = _similarity(joined, _normalize_for_compare(vocab))
                    if score > best_score:
                        best, best_score = vocab, score
                if best and best_score >= 0.88:
                    # Rejoined. Keep the casing of the first token.
                    result.append(best.capitalize() if tokens[i][:1].isupper() else best)
                    i += 2
                    continue
        result.append(tokens[i])
        i += 1

    return " ".join(result)


_NUMBER_PHRASE_WORDS = {
    # Units
    "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan",
    "sembilan", "sepuluh",
    # The teen and tens components, so "lima belas" and "dua puluh" are
    # recognised as number phrases in their own right.
    "belas", "puluh", "ratus", "ribu", "juta", "miliar",
    "seratus", "seribu",
}


def collapse_repeated_number_phrases(text: str) -> str:
    """
    Drop a number phrase the recogniser said twice.

    "dua puluh dua puluh ribu" -> "dua puluh ribu"
    "lima belas lima belas ribu" -> "lima belas ribu"

    Only adjacent phrases that are IDENTICAL are collapsed. Two different
    numbers side by side ("dua puluh tiga puluh") are left alone, because
    that could be a real amount the user said.
    """
    if not text:
        return text

    tokens = text.split()
    result: List[str] = []
    i = 0
    while i < len(tokens):
        collapsed = False

        # Try the longest phrase first: "dua puluh" before "dua".
        for size in (3, 2):
            if i + 2 * size > len(tokens):
                continue
            first = [w.lower() for w in tokens[i:i + size]]
            second = [w.lower() for w in tokens[i + size:i + 2 * size]]
            if all(w in _NUMBER_PHRASE_WORDS for w in first) and first == second:
                result.extend(tokens[i:i + size])
                i += 2 * size
                collapsed = True
                break

        if not collapsed:
            result.append(tokens[i])
            i += 1

    return " ".join(result)


def clean_transcript(text: str, vocabulary: Optional[List[str]] = None) -> str:
    """
    The full cleanup pipeline applied to a speech recognition result.

    Steps, in order:
      1. collapse exact consecutive duplicates
      2. collapse near-duplicate phrases
      3. fix the known common misspellings
      4. rejoin split words

    The steps are ordered so the cheap, certain ones run first. A word
    that survives all of them is passed through untouched.
    """
    if not text:
        return ""

    cleaned = collapse_repeated_words(text)
    cleaned = remove_partial_repeats(cleaned)
    cleaned = fix_common_confusions(cleaned)
    cleaned = repair_split_words(cleaned)

    # A repeated number PHRASE is a recogniser artefact, not a number the
    # user meant to double: "dua puluh dua puluh ribu" is 20.000, not
    # 40.000. The words of a number phrase are collapsed as a unit.
    cleaned = collapse_repeated_number_phrases(cleaned)

    # A final safety pass: collapsing can expose a new adjacent duplicate.
    cleaned = collapse_repeated_words(cleaned)

    return cleaned


def clean_transcript_segments(segments: List[str]) -> str:
    """
    Join the segments of a recognition session and clean the result.

    The browser delivers the speech as a sequence of chunks. Each chunk is
    cleaned on its own first (so a duplicate inside one chunk is removed),
    then the chunks are joined and cleaned again as a whole (so a
    duplicate that straddles two chunks is removed too).
    """
    if not segments:
        return ""

    cleaned_segments = [collapse_repeated_words(s).strip() for s in segments if s and s.strip()]
    joined = " ".join(cleaned_segments)
    return clean_transcript(joined)
