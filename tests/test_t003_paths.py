"""CLI output-path safety tests; genanki is stubbed because rejection precedes export."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts" / "t003-generate-apkg.py"


class T003OutputPathTests(unittest.TestCase):
    def run_generator(self, output: Path) -> subprocess.CompletedProcess[str]:
        with tempfile.TemporaryDirectory(prefix="t003-path-test-") as temporary:
            modules = Path(temporary) / "modules"
            modules.mkdir()
            (modules / "genanki.py").write_text("")
            environment = os.environ.copy()
            environment["PYTHONPATH"] = os.pathsep.join(
                filter(None, (str(modules), environment.get("PYTHONPATH")))
            )
            return subprocess.run(
                [sys.executable, str(GENERATOR), str(output)],
                capture_output=True,
                text=True,
                env=environment,
                check=False,
            )

    def test_generator_rejects_output_outside_artifact_and_temporary_roots(self) -> None:
        result = self.run_generator(ROOT / "docs" / ".." / "..")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("outside the allowed roots", result.stderr)

    def test_generator_rejects_temporary_root_itself(self) -> None:
        result = self.run_generator(Path(tempfile.gettempdir()))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be a child directory", result.stderr)


if __name__ == "__main__":
    unittest.main()
