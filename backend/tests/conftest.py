"""
Make sure the tests read the code beside them.

The virtual environment was built in one checkout, so its
`site-packages` path can point at a different one. Without this,
a test run in a worktree silently tests the other checkout, and a
fix that was never written looks like a fix that works.

This puts the backend directory of this checkout at the front of the
path, so `import app` finds the code the tests are sitting next to.
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if BACKEND_DIR in sys.path:
    sys.path.remove(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)
