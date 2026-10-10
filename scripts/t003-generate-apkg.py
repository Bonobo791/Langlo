"""Build deterministic synthetic APKG variants for the bounded T003 import check."""

from __future__ import annotations

import hashlib
import os
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path

import genanki

DECK_SOURCE_ID = "deck-10000000-0000-4000-8000-000000000001"
BASIC_NOTE_ID = "note-10000000-0000-4000-8000-000000000001"
CLOZE_NOTE_ID = "note-10000000-0000-4000-8000-000000000004"
PACKAGE_TIMESTAMP = 1_791_624_000
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)


def stable_number(source_identity: str) -> int:
    return int.from_bytes(hashlib.sha256(source_identity.encode()).digest()[:8], "big") & ((1 << 63) - 1) or 1


def stable_guid(source_identity: str) -> str:
    return hashlib.sha256(source_identity.encode()).hexdigest()[:32]


def normalize_package(output: Path, *, note_modified: int) -> None:
    with zipfile.ZipFile(output) as source:
        members = [(info.filename, source.read(info.filename)) for info in source.infolist()]

    with tempfile.TemporaryDirectory(dir=output.parent) as directory:
        directory_path = Path(directory)
        collection_path = directory_path / "collection.anki2"
        collection_path.write_bytes(
            next(data for name, data in members if name == "collection.anki2")
        )
        connection = sqlite3.connect(collection_path)
        connection.execute("UPDATE notes SET mod = ?", (note_modified,))
        connection.commit()
        connection.close()
        collection = collection_path.read_bytes()

        normalized_path = directory_path / "normalized.apkg"
        with zipfile.ZipFile(
            normalized_path,
            "w",
            compression=zipfile.ZIP_STORED,
        ) as normalized:
            for name, data in members:
                info = zipfile.ZipInfo(name, date_time=ZIP_TIMESTAMP)
                info.compress_type = zipfile.ZIP_STORED
                info.create_system = 3
                info.external_attr = 0o100600 << 16
                normalized.writestr(
                    info,
                    collection if name == "collection.anki2" else data,
                )
        os.replace(normalized_path, output)


def build(output: Path, *, edited: bool = False, renamed: bool = False) -> None:
    deck_id = stable_number(DECK_SOURCE_ID)
    basic_model_id = stable_number("langlo:model:basic:v1")
    cloze_model_id = stable_number("langlo:model:cloze:v1")
    deck_name = "Langlo T003 Synthetic French" + (" Renamed" if renamed else "")
    deck = genanki.Deck(deck_id, deck_name)
    basic = genanki.Model(
        basic_model_id,
        "Langlo T003 Basic",
        fields=[{"name": "Front"}, {"name": "Back"}],
        templates=[{"name": "Card 1", "qfmt": "{{Front}}", "afmt": "{{FrontSide}}<hr id=answer>{{Back}}"}],
    )
    cloze = genanki.Model(
        cloze_model_id,
        "Langlo T003 Cloze (single-group feasibility subset)",
        model_type=genanki.Model.CLOZE,
        fields=[{"name": "Text"}],
        templates=[{"name": "Cloze", "qfmt": "{{cloze:Text}}", "afmt": "{{cloze:Text}}"}],
    )
    edited = edited or renamed
    basic_back = "Hello (edited export)" if edited else "Hello"
    deck.add_note(genanki.Note(
        model=basic,
        fields=["Bonjour", basic_back],
        guid=stable_guid(BASIC_NOTE_ID),
        tags=["langlo-t003", "synthetic"],
    ))
    deck.add_note(genanki.Note(
        model=cloze,
        fields=["{{c1::Je}} {{c1::suis}} prêt."],
        guid=stable_guid(CLOZE_NOTE_ID),
        tags=["langlo-t003", "synthetic"],
    ))
    package = genanki.Package(deck)
    package.write_to_file(str(output), timestamp=PACKAGE_TIMESTAMP)
    note_modified = PACKAGE_TIMESTAMP + int(edited) + int(renamed)
    normalize_package(output, note_modified=note_modified)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: t003-generate-apkg.py OUTPUT_DIRECTORY")
    output_dir = Path(sys.argv[1])
    output_dir.mkdir(parents=True, exist_ok=True)
    build(output_dir / "T003-initial.apkg")
    build(output_dir / "T003-unchanged-reexport.apkg")
    build(output_dir / "T003-edited-content.apkg", edited=True)
    build(output_dir / "T003-renamed-deck.apkg", edited=True, renamed=True)


if __name__ == "__main__":
    main()
