import sys
from pathlib import Path

# Ensure the backend package root is importable as `app` even when the project
# has not been installed in editable mode.
sys.path.insert(0, str(Path(__file__).parent))
