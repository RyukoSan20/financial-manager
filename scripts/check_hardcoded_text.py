#!/usr/bin/env python3
"""
Find the user-visible text that is still hardcoded in the frontend.

A hardcoded string is one the reader sees on the screen that does not
come from a translation file. Those are the strings that stay in one
language when the reader picks another one.

The sweep walks the source and looks at the places a string can reach
the screen:

  - the text between two tags
  - the value of an attribute a person reads: label, placeholder,
    title, aria-label, alt
  - the text of a message that is shown: a toast, an alert, a hint

It leaves out the strings that are not shown to the reader:

  - class names, ids, keys, routes, api paths
  - data files, test files
  - a name that came from the server
  - a currency code, a language code, a country code
"""

import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "frontend", "src")
FRONTEND = os.path.join(ROOT, "frontend")

# Files that hold data rather than interface text.
SKIP_DIRS = {"__tests__", "node_modules", "dist", "nlp/data", "__mocks__"}

# Files that are known to be about parsing rather than about showing.
SKIP_FILES = {
    "features/transactions/nlp/fuzzyMatch.js",
    "features/transactions/nlp/parseQuickEntry.js",
    "features/transactions/nlp/suggestCategory.js",
}

# Attributes whose value a person reads.
READABLE_ATTRS = {
    "label", "placeholder", "title", "aria-label", "alt",
    "helperText", "emptyText", "confirmText", "cancelText",
    "description", "subtitle", "message", "tooltip",
}

# Values that are never interface text.
NOT_TEXT = {
    "id", "en", "ja", "IDR", "USD", "EUR", "JPY", "GBP", "AUD", "SGD",
    "MYR", "CNY", "INR", "THB", "PHP", "KRW", "VND", "HKD", "CAD", "CHF",
    "NZD", "SEK", "NOK", "DKK", "MXN", "BRL", "ZAR",
    "button", "submit", "text", "email", "password", "number", "date",
    "checkbox", "radio", "hidden", "file", "search", "tel", "url",
    "dark", "light", "system", "auto",
    "none", "true", "false", "null", "undefined", "NaN",
}

# Words that are the same in every language the app is used in, so
# there is nothing to translate.
SAME_IN_ALL = {
    "QRIS", "Cash", "FinManager", "OpenStreetMap", "Google", "Email",
    "PDF", "CSV", "JSON", "URL", "ID", "OK", "PIN", "ATM",
}


def readable(text):
    """Is this a piece of interface text a person would read?"""
    if not text or not text.strip():
        return False
    stripped = text.strip()

    if stripped in NOT_TEXT or stripped in SAME_IN_ALL:
        return False

    # A single word with no space and no letter is not text.
    if len(stripped) < 2:
        return False

    # Anything that looks like a path, a route, a key or a class name.
    if stripped.startswith(("/" , "http", ".", "#")):
        return False
    if "/" in stripped and " " not in stripped:
        return False
    if "_" in stripped and " " not in stripped:
        return False
    if "-" in stripped and " " not in stripped and stripped.islower():
        return False

    # A camelCase or snake_case identifier.
    if re.fullmatch(r"[A-Za-z_$][\w$]*", stripped) and (
        re.search(r"[a-z][A-Z]", stripped) or "_" in stripped
    ):
        return False

    # Has to have at least one letter.
    if not re.search(r"[A-Za-z\u3040-\u30ff\u4e00-\u9fff]", stripped):
        return False

    # A piece of code that the sweep caught between two angle brackets.
    # These have operators in them and never reach the screen.
    if re.search(r"(===|!==|==|&&|\|\||=>|\)\s*;|\{\s*$)", stripped):
        return False

    # A line of code: it has a semicolon, a brace or an arrow in it.
    if any(mark in stripped for mark in (";", "=>", "()", "){", ");")):
        return False

    return True


def collect():
    """The hardcoded strings, by file."""
    findings = {}

    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if not name.endswith((".jsx", ".js")):
                continue
            path = os.path.join(root, name)
            rel = os.path.relpath(path, SRC)
            if rel in SKIP_FILES:
                continue

            source = open(path, errors="ignore").read()
            hits = []

            # The text between two tags.
            for match in re.finditer(r">([^<>{}]{3,90})<", source):
                text = match.group(1).strip()
                if readable(text):
                    hits.append({"text": text, "kind": "text"})

            # The value of an attribute a person reads.
            for match in re.finditer(
                r"\b(" + "|".join(READABLE_ATTRS) + r")\s*=\s*[\"']([^\"']{2,90})[\"']",
                source,
            ):
                text = match.group(2).strip()
                if readable(text):
                    hits.append({"text": text, "kind": match.group(1)})

            if hits:
                findings[rel] = hits

    return findings


def main():
    findings = collect()
    total = sum(len(v) for v in findings.values())

    if "--json" in sys.argv:
        print(json.dumps(findings, indent=2, ensure_ascii=False))
        return 0

    print(f"{len(findings)} files, {total} hardcoded strings\n")
    for rel in sorted(findings, key=lambda r: -len(findings[r])):
        hits = findings[rel]
        print(f"{len(hits):3}  {rel}")
        seen = set()
        for hit in hits:
            if hit["text"] in seen:
                continue
            seen.add(hit["text"])
            print(f"        [{hit['kind']:14}] {hit['text']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
