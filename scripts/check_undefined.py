#!/usr/bin/env python3
"""
Catch the "X is not defined" class of bug before the browser does.

A component that uses a helper it never imported still builds fine.
Vite and esbuild only complain about syntax, not about names that
simply do not exist in the module. The page then dies at runtime and
the React root stays empty.

This walks every source file, collects the names it imports and
declares, and then looks for the well known helpers being used
without ever being brought into the file.

Usage:
    python3 scripts/check_undefined.py

Exit code 0 means nothing was found.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "frontend", "src")

# The helpers the app uses that must come from an import. They are
# listed by name because they are the ones that have bitten us.
TRACKED = [
    "formatCurrency",
    "formatNative",
    "formatNumber",
    "formatPercent",
    "formatDate",
    "convertCurrency",
    "useCurrency",
    "currencyStore",
    "CURRENCIES",
    "CURRENCY_CODES",
    "useTranslation",
    "useTheme",
    "api",
    "batch1",
    "batch2",
    "batch3",
    "getCurrentLanguage",
]

# A name that is only ever written as part of a path or a url is not
# a use of the helper.
CONTEXT = re.compile(
    r"(?<![\w$.'\"`/\\-])"          # not a property, not a path
    r"(?<!://)"
)
CALL = re.compile(r"^[\s]*[\w.]*\(")

# After one of these characters (ignoring whitespace), a slash starts a
# regular-expression literal rather than a division. A test often embeds
# a snippet of source inside such a literal - `!/return api\.request/` -
# and the name inside it must not be read as a real use of the helper.
# `<` is deliberately excluded so a JSX closing tag `</div>` is never
# mistaken for the start of a regex.
_REGEX_PREV_CHARS = set("(,{[;:=!&|?")
_REGEX_PREV_KEYWORDS = {
    "return", "typeof", "instanceof", "new", "delete",
    "void", "do", "else", "yield", "await", "case",
}


def strip_comments_and_strings(src):
    """
    Blank out comments, string bodies and regex literals.

    This walks the text once instead of running a pattern per quote
    kind. Separate patterns get out of step: an apostrophe inside a
    comment opens a "string" that runs on until the next apostrophe
    somewhere else, and everything between is swallowed.

    The comments, the strings and the regular-expression literals are
    blanked at the same time, so a url inside a string is never mistaken
    for a comment, and a helper name written inside a regex pattern (as
    tests often do) is never read as a real use of that helper.
    """
    out = []
    # A short tail of what has been emitted, so a slash can be placed as
    # either a regex literal (in a value position) or a division.
    recent = ""
    i = 0
    n = len(src)

    def emit(text):
        nonlocal recent
        out.append(text)
        recent = (recent + text)[-24:]

    def blank_body(body):
        # Keep the delimiters and the line breaks; blank everything
        # else, so line numbers and import statements survive.
        if len(body) <= 1:
            return body
        return (
            body[0]
            + "".join(c if c == "\n" else " " for c in body[1:-1])
            + body[-1]
        )

    while i < n:
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""

        if ch == "/" and nxt == "*":
            end = src.find("*/", i + 2)
            end = n if end < 0 else end + 2
            body = src[i:end]
            # The whole comment is blanked, but the line breaks stay
            # so the line numbers of what follows are still right.
            emit("".join(c if c == "\n" else " " for c in body))
            i = end
            continue

        if ch == "/" and nxt == "/":
            end = src.find("\n", i)
            end = n if end < 0 else end
            emit(" " * (end - i))
            i = end
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
            body = src[i:j]
            # The quote marks are kept so that an import statement can
            # still be read. Only the body of the string is blanked,
            # and the line breaks stay so the line numbers are right.
            emit(blank_body(body))
            i = j
            continue

        # A regular-expression literal, when the slash sits in a value
        # position. Its body is blanked like a string, so a name written
        # inside the pattern is not read as a use of a helper.
        if ch == "/":
            prefix = recent.rstrip()
            prev = prefix[-1] if prefix else ""
            value_pos = prev == "" or prev in _REGEX_PREV_CHARS
            if not value_pos:
                m = re.search(r"([A-Za-z_$][\w$]*)$", prefix)
                if m and m.group(1) in _REGEX_PREV_KEYWORDS:
                    value_pos = True
            if value_pos:
                j = i + 1
                in_class = False
                closed = False
                while j < n:
                    c = src[j]
                    if c == "\\":
                        j += 2
                        continue
                    if c == "\n":
                        break
                    if c == "[":
                        in_class = True
                    elif c == "]":
                        in_class = False
                    elif c == "/" and not in_class:
                        j += 1
                        closed = True
                        break
                    j += 1
                if closed:
                    emit(blank_body(src[i:j]))
                    i = j
                    continue
            # Not a regex after all - an ordinary division slash.

        emit(ch)
        i += 1

    return "".join(out)


def imported_names(src):
    """The names an import statement brings into the file."""
    names = set()
    for group in re.findall(r"import\s+([^;]+?)\s+from\s+['\"]", src):
        group = group.strip()
        braced = re.match(r"\{([^}]*)\}", group)
        if braced:
            for item in braced.group(1).split(","):
                item = item.strip()
                if not item:
                    continue
                # "a as b" brings both the alias and the original in.
                names.add(item.split(" as ")[-1].strip())
                if " as " in item:
                    names.add(item.split(" as ")[0].strip())
            # A default import can sit beside the braces.
            rest = group[braced.end():].strip().lstrip(",").strip()
            if rest:
                names.add(rest.split(" as ")[-1].strip())
            continue
        # A plain default import, on its own or with a namespace.
        default_part = group.split(",")[0].strip()
        if default_part:
            names.add(default_part.split(" as ")[-1].strip())
    # A dynamic import brings the module in at run time. The names it
    # gives are read from the assignment it feeds.
    for group in re.findall(r"\{([^{}]*)\}\s*=\s*await\s+import\(", src):
        for part in group.split(","):
            name = part.split(":")[-1].strip()
            if name:
                names.add(name)

    return names


def declared_names(src):
    """The names the file declares on its own."""
    names = set(re.findall(r"\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)", src))
    names.update(re.findall(r"\b([A-Za-z_$][\w$]*)\s*=>", src))

    for group in re.findall(r"\{([^{}]*)\}\s*=\s*await\s+import\(", src):
        for part in group.split(","):
            name = part.split(":")[-1].strip()
            if name:
                names.add(name)

    for group in re.findall(r"const\s*\{([^}]*)\}\s*=\s*useTranslation\(\)", src):
        for part in group.split(","):
            name = part.split(":")[-1].strip()
            if name:
                names.add(name)

    for group in re.findall(r"function\s+[A-Za-z_$][\w$]*\s*\(([^)]*)\)", src):
        for part in group.split(","):
            name = part.split("=")[0].strip().lstrip(".").strip()
            if name:
                names.add(name)

    # A re-export is a declaration too.
    for group in re.findall(r"export\s*\{([^}]*)\}", src):
        for item in group.split(","):
            name = item.split(" as ")[-1].strip()
            if name:
                names.add(name)

    # A dynamic import brings the module in at run time. The names it
    # gives are read from the assignment it feeds.
    for group in re.findall(r"\{([^{}]*)\}\s*=\s*await\s+import\(", src):
        for part in group.split(","):
            name = part.split(":")[-1].strip()
            if name:
                names.add(name)

    return names


def real_use(src, name):
    """Where the name is used as a value, not as part of a path."""
    hits = []
    for m in re.finditer(r"(?<![\w$.])" + re.escape(name) + r"\b", src):
        before = src[max(0, m.start() - 2):m.start()]
        after = src[m.end():m.end() + 2]
        # "https://x/api" or a path such as "../services/api" is a
        # place, not a use of the helper.
        if before.endswith("/") or before.endswith("\\"):
            continue
        if after.startswith("/"):
            continue
        hits.append(m.start())
    return hits


def main():
    if not os.path.isdir(SRC):
        print(f"no source directory at {SRC}")
        return 1

    problems = 0
    files = []
    for base, _dirs, names in os.walk(SRC):
        for n in names:
            if n.endswith((".js", ".jsx")):
                files.append(os.path.join(base, n))

    for path in sorted(files):
        with open(path, encoding="utf-8") as fh:
            raw = fh.read()
        src = strip_comments_and_strings(raw)
        rel = os.path.relpath(path, ROOT)

        # If the import statements could not be read at all, the file
        # is skipped rather than reported wrongly.
        if "import" in raw and not imported_names(src):
            continue

        available = imported_names(src) | declared_names(src)

        for name in TRACKED:
            if name in available:
                continue
            hits = real_use(src, name)
            if not hits:
                continue
            # Only a use as a value counts. A name in a comment or in
            # a doc line was blanked out already.
            first = hits[0]
            line = src[:first].count("\n") + 1
            print(f"USED BUT NOT IMPORTED  {name}  {rel}:{line}")
            problems += 1

    if problems:
        print(f"\n{problems} name(s) are used without being brought into the file")
        return 1

    print(f"OK: every helper that is used is imported or declared "
          f"({len(files)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
