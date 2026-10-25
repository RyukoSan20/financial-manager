#!/usr/bin/env python3
"""
Catch the duplicate keys in the locale files.

A locale file is a javascript object. When the same key is written
twice, javascript keeps the last one and says nothing. So a word that
was translated can quietly revert to the English one, and the page
still works. The only sign is that the text on screen is in the wrong
language.

This walks each file and notes every key it writes together with the
object it sits in. A key that shows up twice inside the same object is
a duplicate. The same key in two different objects is fine, because
they are two different words.

Usage:
    python3 scripts/check_duplicate_keys.py

Exit code 0 means nothing was found.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCALES = os.path.join(ROOT, "frontend", "src", "i18n")

FILES = ["id.js", "en.js", "ja.js", "keys_batch1.js", "keys_batch2.js", "keys_batch3.js"]


def scan(src):
    """
    Walk the text and return every key with the object it sits in.

    The scanner skips strings and comments, so a word inside a
    sentence never counts as a key.
    """
    pairs = []
    stack = []          # the keys of the objects we are inside
    i = 0
    n = len(src)
    pending = None      # a key waiting for its value
    line = 1

    while i < n:
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""

        if ch == "\n":
            line += 1
            i += 1
            continue

        if ch == "/" and nxt == "*":
            end = src.find("*/", i + 2)
            end = n if end < 0 else end + 2
            line += src[i:end].count("\n")
            i = end
            continue

        if ch == "/" and nxt == "/":
            end = src.find("\n", i)
            i = n if end < 0 else end
            continue

        if ch in "\"'`":
            quote = ch
            j = i + 1
            while j < n:
                if src[j] == "\\":
                    j += 2
                    continue
                if src[j] == quote:
                    j += 1
                    break
                if quote != "`" and src[j] == "\n":
                    break
                j += 1
            line += src[i:j].count("\n")
            i = j
            continue

        if ch == "{":
            stack.append(pending)
            pending = None
            i += 1
            continue

        if ch == "}":
            if stack:
                stack.pop()
            pending = None
            i += 1
            continue

        # A key is a name followed by a colon.
        m = re.match(r"([A-Za-z_$][\w$]*|'[^']+'|\"[^\"]+\")\s*:", src[i:])
        if m and (i == 0 or not (src[i - 1].isalnum() or src[i - 1] in "_$")):
            key = m.group(1).strip("'\"")
            scope = [s for s in stack if s]
            pairs.append((tuple(scope), key, line))
            pending = key
            i += m.end()
            continue

        i += 1

    return pairs


def main():
    problems = 0
    for name in FILES:
        path = os.path.join(LOCALES, name)
        if not os.path.exists(path):
            print(f"missing locale file: {path}")
            return 1
        with open(path, encoding="utf-8") as fh:
            src = fh.read()
        rel = os.path.relpath(path, ROOT)

        seen = {}
        for scope, key, line in scan(src):
            full = ".".join(list(scope) + [key])
            if full in seen:
                print(f"DUPLICATE KEY  {full}  {rel}:{line} "
                      f"(first on line {seen[full]})")
                problems += 1
            else:
                seen[full] = line

    if problems:
        print(f"\n{problems} duplicate key(s) found")
        return 1

    print("OK: no key is written twice in the same object "
          "in any locale file")
    return 0


if __name__ == "__main__":
    sys.exit(main())
