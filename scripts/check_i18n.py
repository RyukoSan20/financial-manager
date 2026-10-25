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

def check_batch_values_exist(root):
    """
    Every K.name that a page reads has to be in the batch file.

    A missing value reads as undefined in the markup. The page still
    renders, but the label is gone. This gate reads the batch files
    the way the browser does and checks each lookup against them.
    """
    import json
    import re
    import subprocess
    import tempfile

    batches = {}
    i18n = root / "i18n"
    for name in ("keys_batch1", "keys_batch2", "keys_batch3"):
        path = i18n / f"{name}.js"
        if not path.exists():
            continue
        batches[name] = {}
        for lang in ("id", "en", "ja"):
            with tempfile.NamedTemporaryFile(suffix=".cjs", delete=False) as tmp:
                out = tmp.name
            subprocess.run(
                ["npx", "--no-install", "esbuild", f"src/i18n/{name}.js",
                 "--bundle", "--format=cjs", f"--outfile={out}"],
                cwd=str(root.parent), capture_output=True, text=True,
            )
            try:
                raw = subprocess.run(
                    ["node", "-e",
                     f"const m = require('{out}').default;"
                     f"console.log(JSON.stringify(m['{lang}']));"],
                    capture_output=True, text=True,
                )
                batches[name][lang] = json.loads(raw.stdout)
            except (json.JSONDecodeError, ValueError):
                batches[name][lang] = {}
            os.unlink(out)

    def lookup(table, path):
        current = table
        for part in path.split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None
        return current

    problems = []
    namespace_pattern = re.compile(
        r"const (K\w*) = (\w+)\[language\]\?\.((?:[A-Za-z0-9_]+\??\.?)+)"
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
            kname, variable, chain = m.group(1), m.group(2), m.group(3)
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
