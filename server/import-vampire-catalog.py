#!/usr/bin/env python3
"""Convert the discipline sheet's CSV export into the versioned database seed."""

import argparse
import csv
import json
from pathlib import Path
import re
import unicodedata

SOURCE_URL = "https://docs.google.com/spreadsheets/d/1ln-mxkyH1L_ekIYoQHNW1LXe2N-K_l2ELBTTHL3Fh90/edit?gid=766982432"

SECTION_KEYS = {
    "Cost": "cost", "Activation Cost": "activationCost", "Dice Pools": "dicePool",
    "System": "system", "Duration": "duration", "Amalgam": "amalgam",
    "Prerequisite": "prerequisite", "Ingredients": "ingredients",
    "Athanor Corporis": "athanorCorporis", "Calcinatio": "calcinatio",
}


def power_text(text, power_names):
    parts = re.split(r"■\s*([^:■]+):\s*", text.strip())
    description = [parts[0].strip()] if parts[0].strip() else []
    details = {}
    for index in range(1, len(parts), 2):
        label, value = parts[index].strip(), parts[index + 1].strip()
        # In the source, requirements precede the introductory paragraph without
        # a second marker. Separate the requirement from that paragraph.
        if label == "Amalgam":
            match = re.match(r"^(.+?\s+\d)\s+(.*)$", value, flags=re.S)
            if match:
                value = match[1]
                description.append(match[2])
        elif label == "Prerequisite":
            for name in power_names:
                if value.startswith(name + " "):
                    description.append(value[len(name):].strip())
                    value = name
                    break
        if label not in SECTION_KEYS:
            raise ValueError(f"Seção de poder desconhecida: {label}")
        details[SECTION_KEYS[label]] = value
    return "\n\n".join(description), details


def identifier(name):
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")


def convert(filename):
    disciplines = {}
    seen_powers = set()
    with open(filename, encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        required = {"Nome da Disciplina", "Nome do Poder", "Nível"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("CSV sem as colunas Nome da Disciplina, Nome do Poder e Nível")
        rows = list(reader)
        power_names = sorted((row["Nome do Poder"].strip() for row in rows), key=len, reverse=True)
        for line, row in enumerate(rows, start=2):
            name, power_name = row["Nome da Disciplina"].strip(), row["Nome do Poder"].strip()
            level = int(row["Nível"])
            discipline_id = identifier(name)
            power_id = f"{discipline_id}--{identifier(power_name)}"
            if not name or not power_name or not 1 <= level <= 5 or power_id in seen_powers:
                raise ValueError(f"Poder inválido ou duplicado na linha {line}")
            discipline = disciplines.setdefault(discipline_id, {"id": discipline_id, "name": name, "powers": []})
            if discipline["name"] != name:
                raise ValueError(f"Nomes de disciplinas conflitantes na linha {line}")
            seen_powers.add(power_id)
            description, details = power_text(row.get("Conteúdo e Texto Exato", ""), power_names)
            power = {"id": power_id, "name": power_name, "level": level, "description": description, "details": details}
            if row.get("Fonte", "").strip():
                power["details"]["sourceReference"] = row["Fonte"].strip()
            discipline["powers"].append(power)
    if not disciplines:
        raise ValueError("CSV sem poderes de disciplinas")
    for discipline in disciplines.values():
        discipline["powers"].sort(key=lambda power: (power["level"], power["name"]))
    return sorted(disciplines.values(), key=lambda discipline: discipline["name"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file")
    parser.add_argument("--source-url", default=SOURCE_URL)
    parser.add_argument("--output", type=Path, default=Path(__file__).parent / "data/vampire-disciplines.json")
    args = parser.parse_args()
    catalog = {"sourceUrl": args.source_url, "disciplines": convert(args.csv_file)}
    args.output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(catalog['disciplines'])} disciplinas e {sum(len(d['powers']) for d in catalog['disciplines'])} poderes importados")
