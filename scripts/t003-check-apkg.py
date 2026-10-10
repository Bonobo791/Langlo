"""Assert stable identities, note/card counts and expected changes in the T003 APKGs."""

from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path


def collection(path: Path) -> tuple[list[tuple[str, int, str]], dict, dict, int, int]:
    with zipfile.ZipFile(path) as archive:
        assert "collection.anki2" in archive.namelist()
        with tempfile.NamedTemporaryFile(suffix=".sqlite") as file:
            file.write(archive.read("collection.anki2"))
            file.flush()
            connection = sqlite3.connect(file.name)
            notes = connection.execute("SELECT guid, mid, flds FROM notes ORDER BY guid").fetchall()
            card_count = connection.execute("SELECT count(*) FROM cards").fetchone()[0]
            review_count = connection.execute("SELECT count(*) FROM revlog").fetchone()[0]
            decks, models = connection.execute("SELECT decks, models FROM col").fetchone()
            connection.close()
    return notes, json.loads(decks), json.loads(models), card_count, review_count


def main() -> None:
    root = Path(sys.argv[1])
    initial_path = root / "T003-initial.apkg"
    unchanged_path = root / "T003-unchanged-reexport.apkg"
    edited_path = root / "T003-edited-content.apkg"
    renamed_path = root / "T003-renamed-deck.apkg"
    assert initial_path.read_bytes() == unchanged_path.read_bytes()
    initial, decks, models, cards, reviews = collection(initial_path)
    edited, _, _, edited_cards, edited_reviews = collection(edited_path)
    renamed, renamed_decks, renamed_models, renamed_cards, renamed_reviews = collection(renamed_path)
    assert len(initial) == 2 and cards == 2 and reviews == 0
    assert edited_cards == renamed_cards == 2
    assert edited_reviews == renamed_reviews == 0
    assert [(guid, mid) for guid, mid, _ in initial] == [(guid, mid) for guid, mid, _ in edited]
    assert [(guid, mid) for guid, mid, _ in initial] == [(guid, mid) for guid, mid, _ in renamed]
    assert [fields for _, _, fields in initial] != [fields for _, _, fields in edited]
    assert decks.keys() == renamed_decks.keys()
    package_deck_ids = set(decks) - {"1"}
    assert len(package_deck_ids) == 1
    deck_id = next(iter(package_deck_ids))
    assert decks[deck_id]["name"] != renamed_decks[deck_id]["name"]
    assert models.keys() == renamed_models.keys()
    assert len(models) == 2
    assert {model["type"] for model in models.values()} == {0, 1}
    assert all(model["id"] == key for key, model in models.items())
    assert all(str(model["did"]) == deck_id for model in models.values())
    print("PASS: unchanged export is byte-identical; edited fields keep note/model IDs; deck rename keeps deck/model IDs; Basic and Cloze each generate one card; APKG revlog is empty.")


if __name__ == "__main__":
    main()
