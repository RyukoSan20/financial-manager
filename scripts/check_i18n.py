#!/usr/bin/env python3
"""
Check that the translations line up with the pages.

Two things go wrong when a language is added or a page is changed:

  - a page asks for a key that no language has, so the person sees
    something like "nav.map" instead of a name;
  - a language has fewer keys than another one, so one language falls
    back to English without anyone noticing.

Both are silent. The app still runs, and the gap only shows up on the
screen of the person who happens to pick that language.

This walks the source for every t('...') call, walks the three locale
files for every key they hold, and reports the gaps both ways.

    python3 scripts/check_i18n.py

It exits non-zero when something is missing, so it can be put in CI.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "frontend", "src")
LOCALES = os.path.join(SRC, "i18n")
LANGS = ["id", "en", "ja"]

# t('key') and t("key"). The key is a dotted path.
CALL = re.compile(r"""\bt\(\s*(['"])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\1""")

# A line that opens a block: "  nav: {"
BLOCK = re.compile(r"^([A-Za-z0-9_]+):\s*\{$")
# A line with a key and a value: "  dashboard: "Beranda","
LEAF = re.compile(r"^([A-Za-z0-9_]+):")


def locale_keys(path):
    """
    The keys a locale file holds, as dotted paths.

    The nesting is read by counting the braces rather than by guessing
    from the shape of a line, because a block closes with a plain "}"
    and a value can itself be an object.
    """
    keys = set()
    stack = []

    for line in open(path, encoding="utf-8"):
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue

        # Everything before the first brace or comma is the key.
        m = re.match(r"^([A-Za-z0-9_]+)\s*:", stripped)
        key = m.group(1) if m else None

        opens = stripped.count("{")
        closes = stripped.count("}")

        if key and opens:
            stack.append(key)
            # The braces of this line balance out, so the block is a
            # single line and closes right away.
            if opens == closes:
                stack.pop()
            continue

        if key and not opens:
            # A plain value.
            if stack:
                keys.add(".".join(stack + [key]))
            continue

        if not key and closes:
            # A closing brace.
            for _ in range(closes):
                if stack:
                    stack.pop()

    return keys


def used_keys():
    """Every key the source asks for, and where it asks for it."""
    used = {}
    for base, _dirs, files in os.walk(SRC):
        if os.path.basename(base) == "i18n":
            continue
        for name in files:
            if not name.endswith((".jsx", ".js")):
                continue
            path = os.path.join(base, name)
            text = open(path, encoding="utf-8").read()
            for m in CALL.finditer(text):
                key = m.group(2)
                used.setdefault(key, []).append(
                    os.path.relpath(path, ROOT)
                )
    return used



def check_module_level_t(root):
    """A t() call outside a component is a crash, not a missing key.

    The translator only exists inside a component. A page that builds a
    constant array at module level and calls t() while building it
    throws "t is not defined" the moment the module is imported, and
    the whole page stays blank. The error arrives at run time, long
    after the build, so it is worth checking here.
    """
    problems = []
    src = os.path.join(root, "src")
    for dirpath, _dirs, files in os.walk(src):
        for name in files:
            if not name.endswith((".js", ".jsx")):
                continue
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, root)
            with open(path, encoding="utf-8") as handle:
                lines = handle.read().split("\n")

            # A top level "const X = [" or "= {" that is not a function.
            start = None
            for index, line in enumerate(lines):
                if not re.match(r"^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*[\[{]", line):
                    continue
                # skip the ones that are functions
                if "=>" in line or "function" in line:
                    continue
                depth = 0
                end = index
                for scan in range(index, len(lines)):
                    depth += lines[scan].count("[") - lines[scan].count("]")
                    depth += lines[scan].count("{") - lines[scan].count("}")
                    if depth <= 0:
                        end = scan
                        break
                block = "\n".join(lines[index:end + 1])
                if re.search(r"(?<![\w.])t\(", block):
                    problems.append((rel, index + 1, block.split("\n")[0][:70]))
                start = index
    return problems


def main():
    tables = {}
    for lang in LANGS:
        path = os.path.join(LOCALES, f"{lang}.js")
        if not os.path.exists(path):
            print(f"missing locale file: {path}")
            return 1
        tables[lang] = locale_keys(path)

    used = used_keys()
    problems = 0

    print(f"pages ask for {len(used)} keys")
    for lang in LANGS:
        print(f"  {lang}.js holds {len(tables[lang])} keys")
    print()

    # 1. A key that is used but that no language has.
    everywhere = set().union(*tables.values())
    for key in sorted(used):
        if key in everywhere:
            continue
        where = sorted(set(used[key]))
        print(f"USED BUT NOWHERE DEFINED  {key}")
        for w in where:
            print(f"      {w}")
        problems += 1

    # 2. A key that one language has and another does not.
    base = set(tables["en"]) | set(tables["id"]) | set(tables["ja"])
    for lang in LANGS:
        missing = sorted(base - tables[lang])
        if not missing:
            continue
        print(f"{lang}.js is missing {len(missing)} keys:")
        for key in missing:
            print(f"      {key}")
        problems += len(missing)

    # 3. A t() call at module level, which throws when the module loads.
    for rel, line, snippet in check_module_level_t(ROOT):
        print(f"T() CALLED AT MODULE LEVEL  {rel}:{line}")
        print(f"      {snippet}")
        problems += 1

    print()
    if problems:
        print(f"FAILED: {problems} problem(s)")
        return 1
    print("OK: every key the pages ask for exists in every language")
    print("OK: no translator is called outside a component")
    return 0


if __name__ == "__main__":
    sys.exit(main())
