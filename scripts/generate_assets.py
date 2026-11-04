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
# The brand
#
# The logo and the avatar are drawn here from the same numbers as the
# rest of the artwork, so they carry no licence question and can be
# reviewed in a diff. The logo is the one bright thing in the corner of
# the application: a green field with a line that goes up, and the light
# of it catching the edge.
# ---------------------------------------------------------------------------


def brand_logo():
    """
    The logo: a rounded green tile with a line that goes up and to the
    right, and a small leaf at the end of it.

    The glow is drawn as a soft radial behind the tile rather than as a
    coloured shadow, so it stays a light rather than a blur.
    """
    c = PALETTE
    body = f"""  <defs>
    <radialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{c['accent']}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="{c['accent']}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="logoTile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{c['accent']}"/>
      <stop offset="100%" stop-color="{c['accent_deep']}"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="60" fill="url(#logoGlow)"/>
  <rect x="14" y="14" width="100" height="100" rx="26" fill="url(#logoTile)"/>
  <path d="M36 82 L56 60 L70 72 L92 42" stroke="{c['paper']}" stroke-width="7"
        fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="92" cy="42" r="7" fill="{c['paper']}"/>
  <path d="M92 35 C88 26 92 22 96 22 C98 30 96 34 92 35 Z" fill="{c['sun']}"/>
  <path d="M20 108 H108" stroke="{c['paper']}" stroke-width="2" stroke-linecap="round" opacity="0.18"/>"""
    return svg(128, 128, body, "Financial Manager")


def _avatar(fill_top, fill_bottom, figure):
    """
    An avatar: a round face over a round body, in two colours.

    It is a placeholder, and it looks like a placeholder. It is not a
    photograph of a stranger, and it is drawn here so it can be seen
    in a diff.
    """
    c = PALETTE
    body = f"""  <defs>
    <linearGradient id="avatarFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{fill_top}"/>
      <stop offset="100%" stop-color="{fill_bottom}"/>
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="60" fill="url(#avatarFill)"/>
  <circle cx="64" cy="52" r="19" fill="{figure}" opacity="0.9"/>
  <path d="M28 108 C28 86 44 74 64 74 C84 74 100 86 100 108 Z" fill="{figure}" opacity="0.9"/>
  <circle cx="58" cy="49" r="2.6" fill="{c['paper']}"/>
  <circle cx="70" cy="49" r="2.6" fill="{c['paper']}"/>
  <path d="M58 58 Q64 63 70 58" stroke="{c['paper']}" stroke-width="2.4"
        fill="none" stroke-linecap="round"/>"""
    return svg(128, 128, body, "Your profile")


def brand_avatar():
    """The default avatar: green, the same colour as the logo."""
    c = PALETTE
    return _avatar(c["accent_soft"], c["sky_soft"], c["accent"])


def avatar_sun():
    """A warm one: for the reader who wants something brighter."""
    c = PALETTE
    return _avatar(c["sun_soft"], c["rose_soft"], c["sun"])


def avatar_sky():
    """A cool one: for the reader who wants something calmer."""
    c = PALETTE
    return _avatar(c["sky_soft"], c["accent_soft"], c["sky"])


def avatar_rose():
    """A bright one."""
    c = PALETTE
    return _avatar(c["rose_soft"], c["sun_soft"], c["rose"])


# ---------------------------------------------------------------------------
# The map pins
#
# A pin says two things at once: what kind of place this is, and what
# kind of thing was bought there. The shape carries the place, the
# mark inside carries the thing, so two pins that differ in only one of
# the two can still be told apart.
# ---------------------------------------------------------------------------


def _pin(inner, tint):
    """
    A pin: a teardrop on a circle, with a mark inside it.
    """
    c = PALETTE
    body = f"""  <g>
    <path d="M32 60 C32 44 44 32 60 32 C76 32 88 44 88 60 C88 80 60 100 60 100 C60 100 32 80 32 60 Z"
          fill="{tint}" stroke="{c['paper']}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="60" cy="58" r="17" fill="{c['paper']}"/>
    {inner}
  </g>"""
    return svg(120, 108, body, "Place")


def pin_minimarket():
    """A small shop: a shopfront with an awning."""
    c = PALETTE
    inner = f"""    <path d="M48 52 H72 V64 H48 Z" fill="{c['accent']}"/>
    <path d="M46 52 L50 44 H70 L74 52 Z" fill="{c['accent_deep']}"/>"""
    return _pin(inner, c["accent"])


def pin_supermarket():
    """A big store: a shopping basket."""
    c = PALETTE
    inner = f"""    <path d="M48 48 H72 L69 64 H51 Z" fill="{c['sky']}"/>
    <path d="M54 48 C54 41 66 41 66 48" stroke="{c['sky']}" stroke-width="2.6"
          fill="none" stroke-linecap="round"/>"""
    return _pin(inner, c["sky"])


def pin_restaurant():
    """
    A place to eat: a plate with a fork beside it.

    The earlier version drew a fork and a spoon, and side by side at
    that size they read as the number ten. A plate and a fork are
    unmistakable at a glance.
    """
    c = PALETTE
    inner = f"""    <path d="M53 43 V65" stroke="{c['rose']}" stroke-width="3" stroke-linecap="round"/>
    <path d="M49 43 V49 M53 43 V49 M57 43 V49" stroke="{c['rose']}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M49 49 H57" stroke="{c['rose']}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M67 43 C72 45 72 51 67 53 V65" stroke="{c['rose']}" stroke-width="3"
          fill="none" stroke-linecap="round" stroke-linejoin="round"/>"""
    return _pin(inner, c["rose"])


def pin_fresh_produce():
    """Vegetables and fruit: a leaf and a round thing."""
    c = PALETTE
    inner = f"""    <circle cx="55" cy="56" r="8" fill="{c['sun']}"/>
    <path d="M62 54 C68 44 74 46 74 46 C74 56 68 58 62 54 Z" fill="{c['accent']}"/>"""
    return _pin(inner, c["sun"])


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
    "logo-dynamic-glow": ("brand", brand_logo),
    "avatar-default": ("brand", brand_avatar),
    "avatar-sun": ("brand", avatar_sun),
    "avatar-sky": ("brand", avatar_sky),
    "avatar-rose": ("brand", avatar_rose),
    "pin-minimarket": ("pin", pin_minimarket),
    "pin-supermarket": ("pin", pin_supermarket),
    "pin-restaurant": ("pin", pin_restaurant),
    "pin-fresh-produce": ("pin", pin_fresh_produce),
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
