"""Behavioral regression tests for the synthetic T003 APKG artifacts."""

from __future__ import annotations

import json
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts" / "t003-generate-apkg.py"
CHECKER = ROOT / "scripts" / "t003-check-apkg.py"


def generate(output_dir: Path) -> None:
    subprocess.run(
        [sys.executable, str(GENERATOR), str(output_dir)],
        check=True,
        capture_output=True,
        text=True,
    )


def package_data(path: Path) -> tuple[dict[str, tuple[int, int, str]], dict[str, dict]]:
    with zipfile.ZipFile(path) as archive:
        with tempfile.NamedTemporaryFile(suffix=".sqlite") as file:
            file.write(archive.read("collection.anki2"))
            file.flush()
            connection = sqlite3.connect(file.name)
            notes = {
                guid: (model_id, modified, fields)
                for guid, model_id, modified, fields in connection.execute(
                    "SELECT guid, mid, mod, flds FROM notes"
                )
            }
            models = connection.execute("SELECT models FROM col").fetchone()[0]
            connection.close()
    return notes, json.loads(models)


def reassign_cloze_card_to_basic(path: Path) -> None:
    """Corrupt only the model distribution while preserving total note/card counts."""
    with zipfile.ZipFile(path) as source:
        members = [(info, source.read(info.filename)) for info in source.infolist()]
    with tempfile.NamedTemporaryFile(suffix=".sqlite") as file:
        file.write(next(data for info, data in members if info.filename == "collection.anki2"))
        file.flush()
        connection = sqlite3.connect(file.name)
        models_json = json.loads(connection.execute("SELECT models FROM col").fetchone()[0])
        basic_mid = next(int(key) for key, model in models_json.items() if model["type"] == 0)
        cloze_mid = next(int(key) for key, model in models_json.items() if model["type"] == 1)
        basic_note_id = connection.execute(
            "SELECT id FROM notes WHERE mid = ?", (basic_mid,)
        ).fetchone()[0]
        cloze_note_id = connection.execute(
            "SELECT id FROM notes WHERE mid = ?", (cloze_mid,)
        ).fetchone()[0]
        connection.execute("UPDATE cards SET nid = ? WHERE nid = ?", (basic_note_id, cloze_note_id))
        connection.commit()
        connection.close()
        corrupted_collection = Path(file.name).read_bytes()
    with tempfile.NamedTemporaryFile(suffix=".apkg", dir=path.parent, delete=False) as output:
        output_path = Path(output.name)
    try:
        with zipfile.ZipFile(output_path, "w") as target:
            for info, data in members:
                target.writestr(
                    info,
                    corrupted_collection if info.filename == "collection.anki2" else data,
                )
        output_path.replace(path)
    finally:
        output_path.unlink(missing_ok=True)


class T003ApkgRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory(prefix="t003-apkg-test-")
        cls.root = Path(cls.temporary.name)
        cls.first = cls.root / "first-build"
        cls.second = cls.root / "second-build"
        generate(cls.first)
        # A fresh process in a later ZIP timestamp second exposes timestamp-dependent bytes.
        time.sleep(2.1)
        generate(cls.second)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def test_fresh_builds_of_every_variant_are_byte_identical(self) -> None:
        first = {path.name: path.read_bytes() for path in self.first.glob("*.apkg")}
        second = {path.name: path.read_bytes() for path in self.second.glob("*.apkg")}
        self.assertEqual(first, second)

    def test_renamed_variant_keeps_the_edited_note_fields(self) -> None:
        edited, _ = package_data(self.first / "T003-edited-content.apkg")
        renamed, _ = package_data(self.first / "T003-renamed-deck.apkg")
        self.assertEqual(
            {guid: fields for guid, (_, _, fields) in edited.items()},
            {guid: fields for guid, (_, _, fields) in renamed.items()},
        )

    def test_note_modification_times_increase_through_changed_exports(self) -> None:
        initial, _ = package_data(self.first / "T003-initial.apkg")
        unchanged, _ = package_data(self.first / "T003-unchanged-reexport.apkg")
        edited, _ = package_data(self.first / "T003-edited-content.apkg")
        renamed, _ = package_data(self.first / "T003-renamed-deck.apkg")
        self.assertEqual(
            {guid: modified for guid, (_, modified, _) in initial.items()},
            {guid: modified for guid, (_, modified, _) in unchanged.items()},
        )
        for guid in initial:
            self.assertLess(initial[guid][1], edited[guid][1])
            self.assertLess(edited[guid][1], renamed[guid][1])

    def test_checker_rejects_wrong_basic_and_cloze_card_distribution(self) -> None:
        intact = subprocess.run(
            [sys.executable, str(CHECKER), str(self.first)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(
            intact.returncode,
            0,
            f"checker rejected intact package: {intact.stderr or intact.stdout}",
        )
        corrupted = self.root / "wrong-model-counts"
        shutil.copytree(self.first, corrupted)
        for name in ("T003-initial.apkg", "T003-unchanged-reexport.apkg"):
            reassign_cloze_card_to_basic(corrupted / name)
        result = subprocess.run(
            [sys.executable, str(CHECKER), str(corrupted)],
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(
            result.returncode,
            0,
            "checker accepted a two-card package with no Cloze card",
        )


if __name__ == "__main__":
    unittest.main()
