"""
The drawings the asset generator makes must stay valid.

The generator writes SVG into `frontend/public/assets/generated`. If
it writes something a browser cannot draw, the artwork is broken and
nobody notices until a page that uses it is opened.

So this checks three things:

- every drawing in the manifest exists;
- every one of them is well-formed XML, which is what a browser needs
  before it will draw them at all;
- every one of them is inside the size it says it is, so nothing is
  cut off.

Run with:
    venv/bin/python -m pytest tests/unit/test_generated_assets.py -q
"""

import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
GENERATOR = ROOT / "scripts" / "generate_assets.py"

SVG_NS = "{http://www.w3.org/2000/svg}"


def load_generator():
    """The generator as a module, so the manifest can be read."""
    import importlib.util

    spec = importlib.util.spec_from_file_location("generate_assets", GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def generator():
    return load_generator()


@pytest.fixture(scope="module")
def drawings(generator):
    """Every file the generator would write, as text."""
    return generator.build_all()


def test_the_generator_exists():
    assert GENERATOR.exists(), "scripts/generate_assets.py is missing"


def test_every_drawing_is_in_the_manifest(generator):
    """There is at least one drawing, and each one has a kind."""
    assert generator.ASSETS, "the manifest is empty"
    for name, (kind, maker) in generator.ASSETS.items():
        assert kind in {"mascot", "empty"}, f"{name} has an unknown kind: {kind}"
        assert callable(maker), f"{name} has no maker"


def test_every_drawing_is_well_formed_xml(drawings):
    """
    A drawing that is not well formed does not draw at all.

    This is the check that matters most. The generator builds SVG by
    joining strings, so a missing quote or a stray character produces
    a file that is written without complaint and renders as nothing.
    """
    for path, content in drawings.items():
        try:
            root = ET.fromstring(content)
        except ET.ParseError as err:
            pytest.fail(f"{path.name} is not valid XML: {err}")

        assert root.tag == f"{SVG_NS}svg", f"{path.name} is not an SVG"


def test_every_drawing_has_a_view_box_and_a_title(drawings):
    """
    A drawing without a view box does not scale, and one without a
    title is not announced to a screen reader.
    """
    for path, content in drawings.items():
        root = ET.fromstring(content)
        assert root.get("viewBox"), f"{path.name} has no viewBox"
        assert root.get("role") == "img", f"{path.name} is not marked as an image"
        assert root.get("aria-label"), f"{path.name} has no aria-label"

        titles = root.findall(f"{SVG_NS}title")
        assert titles, f"{path.name} has no title element"
        assert (titles[0].text or "").strip(), f"{path.name} has an empty title"


def test_every_drawing_fits_inside_its_own_view_box(drawings):
    """
    Nothing is drawn outside the frame.

    A shape that runs past the edge is cut off, and the drawing looks
    broken in a way that is hard to see in the code.
    """
    for path, content in drawings.items():
        root = ET.fromstring(content)
        _, _, width, height = (float(v) for v in root.get("viewBox").split())

        for circle in root.iter(f"{SVG_NS}circle"):
            cx = float(circle.get("cx", 0))
            cy = float(circle.get("cy", 0))
            r = float(circle.get("r", 0))
            assert cx - r >= -1, f"{path.name}: a circle runs off the left edge"
            assert cx + r <= width + 1, f"{path.name}: a circle runs off the right edge"
            assert cy - r >= -1, f"{path.name}: a circle runs off the top edge"
            assert cy + r <= height + 1, f"{path.name}: a circle runs off the bottom edge"

        for rect in root.iter(f"{SVG_NS}rect"):
            x = float(rect.get("x", 0))
            y = float(rect.get("y", 0))
            w = float(rect.get("width", 0))
            h = float(rect.get("height", 0))
            assert x >= -1, f"{path.name}: a rectangle runs off the left edge"
            assert x + w <= width + 1, f"{path.name}: a rectangle runs off the right edge"
            assert y >= -1, f"{path.name}: a rectangle runs off the top edge"
            assert y + h <= height + 1, f"{path.name}: a rectangle runs off the bottom edge"


def test_the_four_moods_are_four_different_drawings(generator):
    """
    The moods have to look different from each other.

    Two moods that come out identical are two moods the reader cannot
    tell apart, and the point of having moods is that they can.
    """
    moods = [name for name, (kind, _) in generator.ASSETS.items() if kind == "mascot"]
    assert len(moods) == 4, f"there should be four moods, there are {len(moods)}"

    drawings = {mood: generator.mascot(mood.replace("mascot-", "")) for mood in moods}
    assert len(set(drawings.values())) == 4, "two moods come out the same"


def test_the_generator_writes_the_same_thing_twice(generator, drawings):
    """
    The generator is deterministic.

    If it produced something different each time, every run would
    show up as a diff, and the diff would mean nothing.
    """
    first = generator.build_all()
    assert {path: content for path, content in first.items()} == drawings


def test_the_check_mode_says_the_files_are_up_to_date(drawings):
    """
    The check must pass for the files that are committed.

    This is the check the preflight runs, so if it fails there, the
    artwork in the repository has drifted away from the code.
    """
    for path, content in drawings.items():
        assert path.exists(), f"{path.name} is in the manifest but not on disk"
        assert path.read_text(encoding="utf-8") == content, (
            f"{path.name} on disk is not what the generator writes. "
            f"Run: python3 scripts/generate_assets.py"
        )
