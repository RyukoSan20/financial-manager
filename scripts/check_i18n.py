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
from pathlib import Path
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


def _components_of(text):
    """The component blocks in a file, as (start, end, name)."""
    import re

    pattern = re.compile(
        r"(?:export const (\w+) = \([^)]*\)\s*=>\s*\{"
        r"|const (\w+) = \([^)]*\)\s*=>\s*\{"
        r"|function (\w+)\([^)]*\)\s*\{"
        r"|export default function (\w+)\([^)]*\)\s*\{)"
    )
    marks = []
    for m in pattern.finditer(text):
        name = next(g for g in m.groups() if g)
        depth = 0
        i = m.end() - 1
        started = False
        while i < len(text):
            c = text[i]
            if c == "{":
                depth += 1
                started = True
            elif c == "}":
                depth -= 1
                if started and depth == 0:
                    break
            i += 1
        marks.append((m.start(), i, name))
    return marks


def _defines_k_at_component_level(body):
    """
    Does this component body hold a K of its own?

    The check is on the indentation. A "const K = ..." that sits deeper
    than the body of the component belongs to a function inside the
    component, and it is out of reach of the markup. That is the shape
    of the bug where a page renders blank: the K is written, the
    markup reads it, and the two are not in the same place.
    """
    import re

    lines = body.split("\n")
    if not lines:
        return False

    # The indentation of the component's own first statement.
    own_indent = None
    for line in lines[1:]:
        if not line.strip():
            continue
        own_indent = len(line) - len(line.lstrip())
        break
    if own_indent is None:
        return False

    for line in lines:
        if not re.match(r"\s*const K\s*=", line):
            continue
        indent = len(line) - len(line.lstrip())
        if indent <= own_indent:
            return True
    return False


def _nested_function_bodies(body):
    """
    The bodies of the functions that are written inside a component.

    A K that is declared inside one of these is not visible to the
    markup of the component. The two places this happened were a
    handleQuickAction and a mode toggle that was written as a plain
    arrow with a body, so both shapes are looked for here.
    """
    import re

    bodies = []
    lines = body.split("\n")
    for index, line in enumerate(lines):
        stripped = line.strip()
        if not re.match(r"(?:const |let |var )?\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{", stripped):
            continue
        indent = len(line) - len(line.lstrip())
        depth = 0
        started = False
        for follow in lines[index:]:
            depth += follow.count("{") - follow.count("}")
            if "{" in follow:
                started = True
            if started and depth <= 0:
                bodies.append((indent, "\n".join(lines[index + 1:])))
                break
    return bodies


def check_batch_keys_in_scope(root):
    """
    Every {K.name} needs a K that is in reach where it is used.

    The batch locale files are read into a variable named K. A file
    that uses {K.total} has to have that K in the same component, or
    in one that surrounds it. When the K is in a sibling component the
    page throws while it renders and the reader gets a blank screen,
    which no build step catches.
    """
    import re

    problems = []
    for path in sorted(root.glob("**/*.jsx")) + sorted(root.glob("**/*.js")):
        if "i18n" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        if "{K." not in text:
            continue
        rel = path.relative_to(root)
        marks = _components_of(text)
        module_has_k = bool(re.search(r"^const K\s*=", text, re.M))
        for index, (start, end, name) in enumerate(marks):
            body = text[start:end]
            used = set(re.findall(r"\{K\.([A-Za-z_][A-Za-z0-9_]*)", body))
            if not used:
                continue

            # A K that only exists inside a nested function is not
            # visible to the markup, so it does not count.
            nested = _nested_function_bodies(body)
            own_lines = []
            for nested_indent, nested_body in nested:
                own_lines.extend(
                    line for line in nested_body.split("\n")
                    if len(line) - len(line.lstrip()) > nested_indent
                )
            body_without_nested = "\n".join(
                line for line in body.split("\n") if line not in own_lines
            )

            local = _defines_k_at_component_level(body_without_nested)
            outer = any(
                outer_start <= start < outer_end
                and _defines_k_at_component_level(text[outer_start:outer_end])
                for outer_start, outer_end, _ in marks[:index]
            )
            if not (local or outer or module_has_k):
                problems.append(
                    f"{rel}: {name} uses K.{sorted(used)[0]} but there is no K in reach"
                )
    return problems

# -----------------------------------------------------------------------
# Reading a batch file without running it.
#
# The batch files hold nothing but object literals: one per language.
# They used to be read by bundling them with esbuild and running the
# result through node. That needs a node install and a bundler, and the
# job that runs this guard has neither - so the bundling failed, the
# file came back empty, and every key in it looked like a key that no
# language had. The guard was reporting twenty-four problems for files
# that were fine.
#
# So the file is read as plain data instead. It is a small, known
# shape: a comment block, a helper function, then the language tables.
# The tables are the only part that matters.
# -----------------------------------------------------------------------


def parse_batch_file(path):
    """
    Read one keys_batchN.js as plain data.

    Returns {language: {namespace: {...}}} or None if the file does
    not have the shape this expects.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None

    tables = {}
    for lang in ("id", "en", "ja"):
        marker = re.search(rf"^\s{{2,}}{lang}:\s*\{{", text, re.MULTILINE)
        if not marker:
            continue
        close = _read_balanced(text, marker.end() - 1)
        if close is None:
            continue
        tables[lang] = _parse_js_object(text[marker.end():close])
    return tables or None


def _read_balanced(text, open_index):
    """
    Return the index of the brace that closes the one at open_index.

    Returns None when the braces do not balance, which means the file
    is not the shape this reader understands.
    """
    depth = 0
    i = open_index
    n = len(text)
    while i < n:
        ch = text[i]
        if ch in "\"'":
            i = _skip_string(text, i)
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def _skip_string(text, start):
    """Return the index just past the string that begins at start."""
    quote = text[start]
    i = start + 1
    n = len(text)
    while i < n:
        ch = text[i]
        if ch == "\\":
            i += 2
            continue
        if ch == quote:
            return i + 1
        i += 1
    return n


def _parse_js_object(body):
    """
    Turn the inside of an object literal into a Python dict.

    The values here are strings, and a string is all that is needed to
    answer whether a key is present.

    A key is usually a plain name - `a5`, `sidebar_group_money` - and
    sometimes a quoted one. Both are handled, because the browser
    accepts both and a reader that only knows one of them reads half
    the file as empty.
    """
    result = {}
    i = 0
    n = len(body)
    pending_key = None

    while i < n:
        ch = body[i]

        # A comment. Everything to the end of the line is not part of
        # the object.
        if ch == "/" and i + 1 < n and body[i + 1] == "/":
            newline = body.find("\n", i)
            i = n if newline == -1 else newline + 1
            continue

        if ch in "\"'":
            end = _skip_string(body, i)
            literal = body[i:end]
            value = _string_value(literal)
            i = end
            # A string is either a key (followed by a colon) or a
            # value (preceded by one).
            j = i
            while j < n and body[j] in " \t\r\n":
                j += 1
            if j < n and body[j] == ":":
                pending_key = value
                i = j + 1
            else:
                if pending_key is not None:
                    result[pending_key] = value
                    pending_key = None
            continue

        # A plain name: a key.
        if ch.isalpha() or ch in "_$":
            start = i
            while i < n and (body[i].isalnum() or body[i] in "_$"):
                i += 1
            name = body[start:i]
            j = i
            while j < n and body[j] in " \t\r\n":
                j += 1
            if j < n and body[j] == ":":
                pending_key = name
                i = j + 1
            continue

        if ch == "{":
            close = _read_balanced(body, i)
            if close is None:
                break
            nested = _parse_js_object(body[i + 1:close])
            if pending_key is not None:
                result[pending_key] = nested
                pending_key = None
            i = close + 1
            continue

        i += 1
    return result


def _string_value(literal):
    """Take the text out of a quoted string, undoing the escapes."""
    quote = literal[0]
    inner = literal[1:-1] if len(literal) >= 2 else ""
    out = []
    i = 0
    while i < len(inner):
        ch = inner[i]
        if ch == "\\" and i + 1 < len(inner):
            nxt = inner[i + 1]
            out.append({"n": "\n", "t": "\t", "r": "\r"}.get(nxt, nxt))
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def check_batch_values_exist(root):
    """
    Every K.name that a page reads has to be in the batch file.

    A missing value reads as undefined in the markup. The page still
    renders, but the label is gone. This gate reads the batch files
    the way the browser does and checks each lookup against them.
    """
    import json
    import re

    batches = {}
    i18n = root / "i18n"
    # Every batch file, not just the first three. A page that reads
    # its words from keys_batch7 is checked the same way as one that
    # reads from keys_batch1, and a guard that only knows about the
    # first three quietly stops guarding the rest.
    for path in sorted(i18n.glob("keys_batch*.js")):
        name = path.stem
        batches[name] = {}
        for lang in ("id", "en", "ja"):
            tables = parse_batch_file(path)
            if tables is None:
                batches[name][lang] = {}
            else:
                batches[name][lang] = tables.get(lang, {})

    def lookup(table, path):
        # An empty namespace is the whole table. A page that takes
        # the table for the language rather than one namespace inside
        # it has its words at the top level.
        if not path:
            return table
        current = table
        for part in path.split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current

    problems = []

    # How a page names the place its words come from. There are four
    # ways it is written, and all four have to be understood:
    #
    #   batch3[language]?.kanban
    #   batch6[language]?.a5 || batch6.id.a5
    #   batch7[language] || batch7.id
    #   batch2[language]?.action_sheet
    #
    # The optional-chaining form and the fallback form say the same
    # thing: the namespace is the chain after the language. A page
    # that falls back to the Indonesian table is naming the same
    # namespace again, so it does not add a second source.
    #
    # The chain is optional because a page may take the whole table
    # for the language rather than one namespace inside it. That is
    # the `batch7[language] || batch7.id` form, where there is no
    # namespace at all and the words sit at the top level.
    namespace_pattern = re.compile(
        r"const (K\w*) = (\w+)\[language\](\??\.((?:[A-Za-z0-9_]+\??\.?)*))?"
    )
    import_pattern = re.compile(
        r"import \{ (\w+)(?:, fill)? \} from ['\"][^'\"]*keys_(batch\d)['\"]"
    )

    for path in sorted(root.glob("**/*.jsx")) + sorted(root.glob("**/*.js")):
        if "i18n" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        if "{K" not in text:
            continue
        rel = path.relative_to(root)

        imports = {}
        for m in import_pattern.finditer(text):
            imports[m.group(1)] = "keys_" + m.group(2)

        sources = {}
        for m in namespace_pattern.finditer(text):
            kname, variable = m.group(1), m.group(2)
            # Group 3 is the optional chain after the language. When it
            # is absent the page takes the whole table for the
            # language, so the namespace is empty and the words sit at
            # the top level.
            chain = m.group(4) or ""
            if variable in imports:
                namespace = ".".join(
                    part for part in chain.replace("?.", ".").split(".") if part
                )
                sources[kname] = (imports[variable], namespace)

        for kname, key in re.findall(r"\{(K\w*)\.([A-Za-z_][A-Za-z0-9_]*)", text):
            if kname not in sources:
                problems.append(f"{rel}: {kname} has no source")
                continue
            name, namespace = sources[kname]
            for lang in ("id", "en", "ja"):
                table = batches.get(name, {}).get(lang)
                if table is None:
                    continue
                values = lookup(table, namespace)
                if values is None:
                    problems.append(
                        f"{rel}: namespace '{namespace}' is not in {name}.{lang}"
                    )
                    continue
                if isinstance(values, dict) and key not in values:
                    problems.append(
                        f"{rel}: {kname}.{key} is not in {name}.{lang}.{namespace}"
                    )
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
    
    # Every {K.name} in a file needs a K in that same file.
    batch_problems = check_batch_keys_in_scope(Path(SRC))
    if batch_problems:
        for b in batch_problems:
            print(f"  {b}")
        print(f"FAILED: {len(batch_problems)} problem(s)")
        return 1
    print("OK: every batch key used in a file has its source in the same file")

    value_problems = check_batch_values_exist(Path(SRC))
    if value_problems:
        for v in value_problems:
            print(f"  {v}")
        print(f"FAILED: {len(value_problems)} problem(s)")
        return 1
    print("OK: every batch key a page reads is present in every language")

    return 0


if __name__ == "__main__":
    sys.exit(main())
