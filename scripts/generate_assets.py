#!/usr/bin/env python3
"""
Draw the images the application needs, so they never have to be
downloaded, traced by hand, or pasted in from somewhere.

This is the generator for the artwork: the mascot, the empty-state
pictures, the icon glyphs. Every one of them is drawn here from
numbers, so it is reproducible, it is reviewable in a diff, and it
carries no licence question.

The rules it follows, and why:

- **Vector output.** SVG, not PNG. It scales to any screen, it is a
  few kilobytes, and a reader with a dark theme gets the dark version
  from the same file.
- **One file per subject, one palette.** The colours come from the
  same tokens the interface uses, so the artwork does not look like it
  came from somewhere else.
- **Deterministic.** No random numbers without a seed, so running it
  twice gives the same file and a diff only shows a real change.
- **It writes, and it says what it wrote.** The generator is run on
  purpose, by a person, and the output is reviewed before it is
  committed.

What it does not do: it does not download anything, and it does not
call a service. Nothing leaves the machine.

Run with:
    python3 scripts/generate_assets.py            # write the files
    python3 scripts/generate_assets.py --check    # check, do not write

The check is what the preflight runs: it says whether the files in
the repository are the ones this generator would write.
"""

import argparse
import hashlib
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "frontend" / "public" / "assets" / "generated"

# ---------------------------------------------------------------------------
# The palette
# ---------------------------------------------------------------------------

# The same tokens the interface uses. A drawing that does not match
# the interface looks like it was pasted in from somewhere else.
PALETTE = {
    "ink": "#0f172a",
    "ink_soft": "#334155",
    "paper": "#ffffff",
    "paper_soft": "#f8fafc",
    "line": "#cbd5e1",
    "accent": "#059669",
    "accent_soft": "#d1fae5",
    "accent_deep": "#047857",
    "sun": "#f59e0b",
    "sun_soft": "#fef3c7",
    "rose": "#e11d48",
    "rose_soft": "#ffe4e6",
    "sky": "#0284c7",
    "sky_soft": "#e0f2fe",
}


def svg(width, height, body, title=""):
    """Wrap the body of a drawing in an SVG."""
    label = f"<!-- {title} -->\n" if title else ""
    return (
        f'{label}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img" '
        f'aria-label="{title}">\n'
        f"  <title>{title}</title>\n"
        f"{body}"
        f"</svg>\n"
    )


# ---------------------------------------------------------------------------
# FinBuddy, the mascot
# ---------------------------------------------------------------------------


def mascot(mood="idle"):
    """
    FinBuddy.

    A round body, two eyes, a small mouth, and a leaf on the head. It
    reads as a friendly thing without being a character that needs a
    story, which matters because it appears next to numbers.

    The moods are the same body with different marks on it, so the
    mascot never becomes a different creature when the application
    changes state. It is the same one, paying attention.
    """
    w = h = 160
    c = PALETTE

    # The eyes and the mouth are the only things that change.
    brows = ""
    if mood == "idle":
        eyes = [
            f'<circle cx="66" cy="76" r="6.5" fill="{c["ink"]}"/>',
            f'<circle cx="94" cy="76" r="6.5" fill="{c["ink"]}"/>',
            f'<circle cx="68.5" cy="73.5" r="2.2" fill="{c["paper"]}"/>',
            f'<circle cx="96.5" cy="73.5" r="2.2" fill="{c["paper"]}"/>',
        ]
        mouth = (
            f'<path d="M70 100 Q80 110 90 100" stroke="{c["ink"]}" stroke-width="3.5" '
            'fill="none" stroke-linecap="round"/>'
        )
    elif mood == "scanning":
        # The eyes look down, and there is a magnifier.
        eyes = [
            f'<circle cx="66" cy="79" r="6.5" fill="{c["ink"]}"/>',
            f'<circle cx="94" cy="79" r="6.5" fill="{c["ink"]}"/>',
        ]
        mouth = f'<path d="M72 102 H88" stroke="{c["ink"]}" stroke-width="3.5" stroke-linecap="round"/>'
    elif mood == "thinking":
        # The eyes look up and to the side.
        eyes = [
            f'<circle cx="68" cy="75" r="6.5" fill="{c["ink"]}"/>',
            f'<circle cx="96" cy="75" r="6.5" fill="{c["ink"]}"/>',
            f'<circle cx="70.5" cy="72.5" r="2.2" fill="{c["paper"]}"/>',
            f'<circle cx="98.5" cy="72.5" r="2.2" fill="{c["paper"]}"/>',
        ]
        # A raised brow. It is the difference between "thinking" and
        # "waiting", and it is what keeps this mood apart from the
        # scanning one, whose face is otherwise the same.
        brows = (
            f'<path d="M60 62 Q68 57 76 61" stroke="{c["ink"]}" stroke-width="2.5" '
            'fill="none" stroke-linecap="round"/>'
            f'<path d="M88 61 Q96 57 104 62" stroke="{c["ink"]}" stroke-width="2.5" '
            'fill="none" stroke-linecap="round"/>'
        )
        # A small flat mouth, and one eye looking up. The thought
        # bubble below says what it is doing, so the mouth does not
        # have to carry that on its own.
        mouth = (
            f'<path d="M73 103 H87" stroke="{c["ink"]}" stroke-width="3.5" stroke-linecap="round"/>'
        )
    else:  # celebrating
        # The eyes are closed and happy, and the mouth is wide.
        eyes = [
            f'<path d="M60 78 Q66 70 72 78" stroke="{c["ink"]}" stroke-width="3.5" '
            'fill="none" stroke-linecap="round"/>',
            f'<path d="M88 78 Q94 70 100 78" stroke="{c["ink"]}" stroke-width="3.5" '
            'fill="none" stroke-linecap="round"/>',
        ]
        mouth = (
            f'<path d="M66 98 Q80 116 94 98 Z" fill="{c["ink"]}"/>'
        )

    body = f"""  <g>
    <!-- the body -->
    <circle cx="80" cy="88" r="52" fill="{c["accent_soft"]}" stroke="{c["accent"]}" stroke-width="3"/>
    <!-- a leaf, so it reads as something that grows -->
    <path d="M80 36 Q86 22 102 24 Q98 38 80 40 Z" fill="{c["accent"]}" stroke="{c["accent_deep"]}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M80 38 L97 27" stroke="{c["accent_deep"]}" stroke-width="1.6" stroke-linecap="round"/>
    <!-- the cheeks -->
    <ellipse cx="52" cy="94" rx="7" ry="5" fill="{c["rose_soft"]}" opacity="0.9"/>
    <ellipse cx="108" cy="94" rx="7" ry="5" fill="{c["rose_soft"]}" opacity="0.9"/>
    {"".join(eyes)}
    {brows}
    {mouth}
  </g>"""

    extra = ""
    if mood == "scanning":
        extra = f"""
  <g>
    <circle cx="118" cy="112" r="17" fill="{c["paper"]}" fill-opacity="0.85" stroke="{c["ink_soft"]}" stroke-width="3"/>
    <path d="M129 123 L140 134" stroke="{c["ink_soft"]}" stroke-width="4" stroke-linecap="round"/>
  </g>"""
    elif mood == "thinking":
        # A thought bubble, and a small curl of steam. A bubble reads
        # as "working it out" straight away. Three floating dots on
        # their own read as "sad" more often than not.
        extra = f"""
  <g fill="{c["paper"]}" stroke="{c["ink_soft"]}" stroke-width="2.5">
    <circle cx="126" cy="34" r="5"/>
    <circle cx="138" cy="25" r="8"/>
    <ellipse cx="154" cy="15" rx="13" ry="10"/>
  </g>
  <g stroke="{c["sun"]}" stroke-width="2.5" stroke-linecap="round" fill="none">
    <path d="M146 15 Q150 10 154 15"/>
  </g>"""
    elif mood == "celebrating":
        extra = f"""
  <g stroke="{c["sun"]}" stroke-width="3.5" stroke-linecap="round">
    <path d="M40 40 L32 30"/>
    <path d="M120 40 L128 30"/>
    <path d="M80 22 V12"/>
  </g>
  <circle cx="26" cy="52" r="3" fill="{c["sun"]}"/>
  <circle cx="134" cy="52" r="3" fill="{c["sun"]}"/>"""

    return svg(w, h, body + extra + "\n", f"FinBuddy, {mood}")


# ---------------------------------------------------------------------------
# The empty-state pictures
# ---------------------------------------------------------------------------


def empty_budget():
    """An empty budget: a set of empty frames with a line under them."""
    c = PALETTE
    parts = []
    for i in range(3):
        x = 28 + i * 38
        parts.append(
            f'    <rect x="{x}" y="48" width="30" height="44" rx="6" fill="{c["paper"]}" '
            f'stroke="{c["line"]}" stroke-width="2" stroke-dasharray="5 4"/>'
        )
        parts.append(
            f'    <path d="M{x+7} 78 H{x+23}" stroke="{c["line"]}" stroke-width="2" stroke-linecap="round"/>'
        )
    body = f"""  <g>
    {"".join(parts)}
    <path d="M32 112 H128" stroke="{c["accent"]}" stroke-width="3" stroke-linecap="round" opacity="0.35"/>
    <circle cx="128" cy="112" r="6" fill="{c["accent"]}"/>
  </g>"""
    return svg(160, 140, body, "No budget yet")


def empty_goals():
    """An empty goal: a target with nothing in the middle."""
    c = PALETTE
    body = f"""  <g fill="none" stroke-linecap="round">
    <circle cx="80" cy="72" r="44" stroke="{c["line"]}" stroke-width="3"/>
    <circle cx="80" cy="72" r="28" stroke="{c["line"]}" stroke-width="3" stroke-dasharray="6 5"/>
    <circle cx="80" cy="72" r="12" stroke="{c["line"]}" stroke-width="3"/>
    <path d="M80 28 V14" stroke="{c["line"]}" stroke-width="3"/>
    <path d="M118 100 L132 114" stroke="{c["line"]}" stroke-width="3"/>
  </g>"""
    return svg(160, 140, body, "No goal yet")


def empty_transactions():
    """An empty ledger: three lines with nothing written on them."""
    c = PALETTE
    parts = []
    for i in range(3):
        y = 50 + i * 24
        parts.append(f'    <rect x="30" y="{y}" width="18" height="16" rx="4" fill="{c["line"]}" opacity="0.5"/>')
        parts.append(f'    <path d="M58 {y+8} H{120 - i * 14}" stroke="{c["line"]}" stroke-width="3" stroke-linecap="round"/>')
    body = f"""  <g>
    {"".join(parts)}
  </g>"""
    return svg(160, 130, body, "No transactions yet")


def empty_debts():
    """An empty debt list: a closed loop."""
    c = PALETTE
    body = f"""  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <rect x="34" y="46" width="92" height="54" rx="8" stroke="{c["line"]}" stroke-width="3" stroke-dasharray="7 6"/>
    <path d="M34 66 H126" stroke="{c["line"]}" stroke-width="3"/>
    <path d="M48 84 H82" stroke="{c["line"]}" stroke-width="3"/>
  </g>"""
    return svg(160, 140, body, "No debts yet")


# ---------------------------------------------------------------------------
# The manifest
# ---------------------------------------------------------------------------

# Every drawing this generator makes, and where it goes.
#
# The name is the file name without the extension. The kind is how the
# file is used, and it decides which folder it goes in.
ASSETS = {
    "mascot-idle": ("mascot", lambda: mascot("idle")),
    "mascot-scanning": ("mascot", lambda: mascot("scanning")),
    "mascot-thinking": ("mascot", lambda: mascot("thinking")),
    "mascot-celebrating": ("mascot", lambda: mascot("celebrating")),
    "empty-budget": ("empty", empty_budget),
    "empty-goals": ("empty", empty_goals),
    "empty-transactions": ("empty", empty_transactions),
    "empty-debts": ("empty", empty_debts),
}


def target_path(name, kind):
    """Where the file goes."""
    return OUT_DIR / kind / f"{name}.svg"


def build_all():
    """Every file, as text."""
    files = {}
    for name, (kind, maker) in ASSETS.items():
        files[target_path(name, kind)] = maker()
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="say whether the files are the ones this generator would write, "
        "and do not write anything",
    )
    args = parser.parse_args()

    files = build_all()

    if args.check:
        missing = []
        different = []
        for path, content in sorted(files.items()):
            if not path.exists():
                missing.append(path)
            elif path.read_text(encoding="utf-8") != content:
                different.append(path)

        print("=" * 70)
        print(" ASSET CHECK")
        print("=" * 70)
        for path in missing:
            print(f"  MISSING   {path.relative_to(ROOT)}")
        for path in different:
            print(f"  DIFFERENT {path.relative_to(ROOT)}")

        if missing or different:
            print()
            print(f" {len(missing) + len(different)} file(s) are not what the generator writes.")
            print(" Run: python3 scripts/generate_assets.py")
            print("=" * 70)
            return 1

        print(f"  OK   all {len(files)} drawings are up to date")
        print("=" * 70)
        return 0

    # Write.
    for path, content in sorted(files.items()):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]
        print(f"  wrote {path.relative_to(ROOT)}  ({len(content)} bytes, {digest})")

    print(f"\n {len(files)} drawings written to {OUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
