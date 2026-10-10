"""Assert stable identities, note/card counts and expected changes in the T003 APKGs."""

from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def collection(
    path: Path,
) -> tuple[
    list[tuple[str, int, int, str]],
    dict,
    dict,
    int,
    dict[int, int],
    int,
]:
    with zipfile.ZipFile(path) as archive:
        require("collection.anki2" in archive.namelist(), "missing collection.anki2")
        with tempfile.NamedTemporaryFile(suffix=".sqlite") as file:
            file.write(archive.read("collection.anki2"))
            file.flush()
            connection = sqlite3.connect(file.name)
            notes = connection.execute(
                "SELECT guid, mid, mod, flds FROM notes ORDER BY guid"
            ).fetchall()
            card_count = connection.execute("SELECT count(*) FROM cards").fetchone()[0]
            cards_by_model = dict(
                connection.execute(
                    """
                    SELECT notes.mid, count(cards.id)
                    FROM notes
                    LEFT JOIN cards ON cards.nid = notes.id
                    GROUP BY notes.mid
                    """
                ).fetchall()
            )
            review_count = connection.execute("SELECT count(*) FROM revlog").fetchone()[0]
            decks, models = connection.execute("SELECT decks, models FROM col").fetchone()
            connection.close()
    return (
        notes,
        json.loads(decks),
        json.loads(models),
        card_count,
        cards_by_model,
        review_count,
    )


def validate_note_exports(
    initial_notes: list[tuple[str, int, int, str]],
    edited_notes: list[tuple[str, int, int, str]],
    renamed_notes: list[tuple[str, int, int, str]],
    counts: tuple[int, int, int, int, int, int],
) -> None:
    initial_cards, initial_reviews, edited_cards, edited_reviews, renamed_cards, renamed_reviews = counts
    require(
        len(initial_notes) == 2 and initial_cards == 2 and initial_reviews == 0,
        "invalid initial package counts",
    )
    require(edited_cards == renamed_cards == 2, "edited or renamed package has invalid card count")
    require(edited_reviews == renamed_reviews == 0, "test packages unexpectedly contain reviews")
    identities = [
        [(guid, model_id) for guid, model_id, _, _ in notes]
        for notes in (initial_notes, edited_notes, renamed_notes)
    ]
    require(identities[0] == identities[1], "edited package changed note or model identities")
    require(identities[0] == identities[2], "renamed package changed note or model identities")
    initial_fields = [fields for _, _, _, fields in initial_notes]
    edited_fields = [fields for _, _, _, fields in edited_notes]
    renamed_fields = [fields for _, _, _, fields in renamed_notes]
    require(initial_fields != edited_fields, "edited package did not change note content")
    require(edited_fields == renamed_fields, "renamed package reverted edited note content")
    initial_mods = {guid: modified for guid, _, modified, _ in initial_notes}
    edited_mods = {guid: modified for guid, _, modified, _ in edited_notes}
    renamed_mods = {guid: modified for guid, _, modified, _ in renamed_notes}
    require(
        initial_mods.keys() == edited_mods.keys() == renamed_mods.keys(),
        "changed packages do not contain matching note identities",
    )
    require(
        all(initial_mods[guid] < edited_mods[guid] < renamed_mods[guid] for guid in initial_mods),
        "note modification times did not advance for changed exports",
    )


def validate_package_structure(
    decks: dict,
    renamed_decks: dict,
    models: dict,
    renamed_models: dict,
    card_counts: tuple[dict[int, int], ...],
) -> None:
    require(decks.keys() == renamed_decks.keys(), "renamed package changed deck identity")
    package_deck_ids = set(decks) - {"1"}
    require(len(package_deck_ids) == 1, "initial package must contain one Langlo deck")
    deck_id = next(iter(package_deck_ids))
    require(decks[deck_id]["name"] != renamed_decks[deck_id]["name"], "deck rename was not applied")
    require(models.keys() == renamed_models.keys(), "renamed package changed model identities")
    require(len(models) == 2, "package must contain Basic and Cloze models")
    require({model["type"] for model in models.values()} == {0, 1}, "package models are not Basic and Cloze")
    require(all(model["id"] == key for key, model in models.items()), "model IDs do not match model keys")
    require(all(str(model["did"]) == deck_id for model in models.values()), "model deck IDs do not match deck")
    basic_id = next(int(key) for key, model in models.items() if model["type"] == 0)
    cloze_id = next(int(key) for key, model in models.items() if model["type"] == 1)
    for counts in card_counts:
        require(counts.get(basic_id, 0) == 1, "package must contain one Basic card")
        require(counts.get(cloze_id, 0) == 1, "package must contain one Cloze card")


def main() -> None:
    root = Path(sys.argv[1])
    initial_path = root / "T003-initial.apkg"
    unchanged_path = root / "T003-unchanged-reexport.apkg"
    edited_path = root / "T003-edited-content.apkg"
    renamed_path = root / "T003-renamed-deck.apkg"
    require(
        initial_path.read_bytes() == unchanged_path.read_bytes(),
        "unchanged re-export differs from the initial package",
    )
    (
        initial,
        decks,
        models,
        cards,
        initial_cards_by_model,
        reviews,
    ) = collection(initial_path)
    (
        edited,
        _,
        _,
        edited_cards,
        edited_cards_by_model,
        edited_reviews,
    ) = collection(edited_path)
    (
        renamed,
        renamed_decks,
        renamed_models,
        renamed_cards,
        renamed_cards_by_model,
        renamed_reviews,
    ) = collection(renamed_path)
    validate_note_exports(
        initial,
        edited,
        renamed,
        (cards, reviews, edited_cards, edited_reviews, renamed_cards, renamed_reviews),
    )
    validate_package_structure(
        decks,
        renamed_decks,
        models,
        renamed_models,
        (initial_cards_by_model, edited_cards_by_model, renamed_cards_by_model),
    )
    print(
        "PASS: unchanged export is byte-identical; fresh builds are deterministic; "
        "edited and renamed exports preserve note/model IDs and content; note "
        "modifications advance; Basic and Cloze each generate one card; APKG revlog is empty."
    )


if __name__ == "__main__":
    main()
