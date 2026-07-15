#!/usr/bin/env python3

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

JSON_FILE = DATA_DIR / "songs_master.json"
CSV_FILE = DATA_DIR / "songs_master.csv"

FIELDS = [
    "song_id",
    "title",
    "type",
    "singers",
    "release_date",
    "official_video_id",
    "composer",
    "lyricist",
    "arranger",
    "remarks",
]


def main():
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        songs = json.load(f)

    with open(CSV_FILE, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()

        for song in songs:
            row = {}

            for field in FIELDS:
                value = song.get(field, "")

                if field == "singers":
                    value = json.dumps(value, ensure_ascii=False)

                row[field] = value

            writer.writerow(row)

    print(f"Exported {len(songs)} songs")
    print(CSV_FILE)


if __name__ == "__main__":
    main()
