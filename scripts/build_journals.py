#!/usr/bin/env python3
"""Download SJR data and merge with UTD24/FT50 into a single journals.json."""

import csv
import json
import re
from datetime import date
from pathlib import Path

import requests

SJR_URL = (
    "https://www.scimagojr.com/journalrank.php"
    "?area=1400&country=US&type=j&year=2025&out=xls"
)

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

ALIASES = {
    "Academy of Management Journal": ["amj", "acad manage j", "acad. manage. j."],
    "Academy of Management Review": ["amr", "acad manage rev", "acad. manage. rev."],
    "Accounting, Organizations and Society": ["aos", "account organ soc"],
    "Administrative Science Quarterly": ["asq", "admin sci q", "admin. sci. quart."],
    "American Economic Review": ["aer", "am econ rev", "amer. econ. rev."],
    "Contemporary Accounting Research": ["car", "contemp account res"],
    "Econometrica": [],
    "Entrepreneurship Theory and Practice": ["etp", "entrep theory pract"],
    "Harvard Business Review": ["hbr", "harv bus rev"],
    "Human Relations": ["hum relat"],
    "Human Resource Management": ["hrm", "hum resour manage"],
    "Information Systems Research": ["isr", "inform syst res", "inf. syst. res."],
    "INFORMS Journal on Computing": ["ijoc", "j on computing", "journal on computing", "informs j comput"],
    "Journal of Accounting and Economics": ["jae", "j account econ", "j. account. econ."],
    "Journal of Accounting Research": ["jar", "j account res", "j. account. res."],
    "Journal of Applied Psychology": ["jap", "j appl psychol"],
    "Journal of Business Ethics": ["jbe", "j bus ethics"],
    "Journal of Business Venturing": ["jbv", "j bus ventur"],
    "Journal of Consumer Psychology": ["jcp", "j consum psychol"],
    "Journal of Consumer Research": ["jcr", "j consumer res", "j. consum. res."],
    "Journal of Finance": ["jf", "j financ", "j. financ."],
    "Journal of Financial and Quantitative Analysis": ["jfqa", "j financ quant anal"],
    "Journal of Financial Economics": ["jfe", "j financ econ", "j. financ. econ."],
    "Journal of International Business Studies": ["jibs", "j int bus stud", "j. int. bus. stud."],
    "Journal of Management": ["jom", "j manage", "j. manage."],
    "Journal of Management Information Systems": ["jmis", "j manage inform syst"],
    "Journal of Management Studies": ["jms", "j manage stud"],
    "Journal of Marketing": ["jm", "j marketing", "j. marketing"],
    "Journal of Marketing Research": ["jmr", "j marketing res", "j. marketing res."],
    "Journal of Operations Management": ["j oper manage", "j. oper. manage."],
    "Journal of Political Economy": ["jpe", "j polit econ", "j. polit. economy"],
    "Journal of the Academy of Marketing Science": ["jams", "j acad market sci", "j. acad. marketing sci."],
    "Management Science": ["manage sci", "manage. sci.", "mgmt sci"],
    "Manufacturing and Service Operations Management": ["msom", "m&som", "manuf serv oper manage"],
    "Marketing Science": ["market sci", "mktg sci", "marketing sci"],
    "MIS Quarterly": ["misq", "mis q"],
    "Operations Research": ["oper res", "oper. res."],
    "Organization Science": ["organ sci", "org. sci.", "orgsci", "org sci"],
    "Organization Studies": ["organ stud", "org stud"],
    "Organizational Behavior and Human Decision Processes": ["obhdp", "organ behav hum decis process"],
    "Production and Operations Management": ["pom", "prod oper manage", "prod. oper. manag."],
    "Quarterly Journal of Economics": ["qje", "q j econ", "quart. j. econ."],
    "Research Policy": ["res policy"],
    "Review of Accounting Studies": ["rev account stud"],
    "Review of Economic Studies": ["rev econ stud", "r econ stud"],
    "Review of Finance": ["rev financ"],
    "Review of Financial Studies": ["rfs", "rev financ stud", "rev. financ. stud."],
    "Sloan Management Review": ["smr", "mit sloan manage rev", "sloan manage rev"],
    "Strategic Entrepreneurship Journal": ["sej", "strateg entrep j"],
    "Strategic Management Journal": ["smj", "strateg manage j", "strat. mgmt. j."],
    "The Accounting Review": ["tar", "account rev", "accounting review"],
    "The Review of Financial Studies": ["rfs", "rev financ stud", "review of financial studies"],
}


def normalize(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r"^the\s+", "", name)
    name = name.replace("&", "and")
    name = re.sub(r"[:.,'\"()\[\]]", " ", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip()


def download_sjr(url: str, output_path: Path) -> bool:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/csv,text/plain,*/*",
        "Referer": "https://www.scimagojr.com/journalrank.php",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=60)
        resp.raise_for_status()
        output_path.write_bytes(resp.content)
        print(f"Downloaded SJR data: {len(resp.content)} bytes")
        return True
    except requests.RequestException as e:
        print(f"Warning: SJR download failed ({e})")
        return False


ALLOWED_AREAS = {
    "Business, Management and Accounting",
    "Economics, Econometrics and Finance",
    "Decision Sciences",
    "Social Sciences",
}


def parse_sjr(csv_path: Path) -> list[dict]:
    journals = []
    skipped = 0
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            title = row.get("Title", "").strip().strip('"')
            if not title:
                continue

            areas = {a.strip() for a in row.get("Areas", "").strip('"').split(";")}
            if not areas or not areas.issubset(ALLOWED_AREAS):
                skipped += 1
                continue

            sjr_raw = row.get("SJR", "0").replace(",", ".")
            try:
                sjr_score = float(sjr_raw)
            except ValueError:
                sjr_score = 0.0

            h_index_raw = row.get("H index", "0")
            try:
                h_index = int(h_index_raw)
            except ValueError:
                h_index = 0

            rank_raw = row.get("Rank", "0")
            try:
                rank = int(rank_raw)
            except ValueError:
                rank = 0

            journals.append({
                "name": title,
                "sjr_score": sjr_score,
                "quartile": row.get("SJR Best Quartile", "").strip(),
                "h_index": h_index,
                "rank": rank,
                "categories": row.get("Categories", "").strip().strip('"'),
            })
    print(f"  Skipped {skipped} non-business journals")
    return journals


def load_list(json_path: Path) -> list[str]:
    with open(json_path) as f:
        return json.load(f)


def load_abdc(json_path: Path) -> list[dict]:
    with open(json_path) as f:
        return json.load(f)


def build_journals_json(
    sjr_journals: list[dict],
    utd24: list[str],
    ft50: list[str],
    abdc: list[dict],
    custom: list[str],
) -> dict:
    utd24_norm = {normalize(n): n for n in utd24}
    ft50_norm = {normalize(n): n for n in ft50}
    custom_norm = {normalize(n): n for n in custom}

    merged = {}

    def get_entry(name, norm):
        return merged.setdefault(norm, {
            "name": name,
            "normalized": norm,
            "aliases": [],
            "lists": [],
            "sjr": None,
            "abdc": None,
        })

    for sj in sjr_journals:
        norm = normalize(sj["name"])
        entry = get_entry(sj["name"], norm)
        entry["lists"].append("sjr")
        entry["sjr"] = {
            "score": sj["sjr_score"],
            "quartile": sj["quartile"],
            "rank": sj["rank"],
            "hIndex": sj["h_index"],
        }

    for norm, name in utd24_norm.items():
        entry = get_entry(name, norm)
        if "utd24" not in entry["lists"]:
            entry["lists"].append("utd24")

    for norm, name in ft50_norm.items():
        entry = get_entry(name, norm)
        if "ft50" not in entry["lists"]:
            entry["lists"].append("ft50")

    for aj in abdc:
        norm = normalize(aj["name"])
        entry = get_entry(aj["name"], norm)
        if "abdc" not in entry["lists"]:
            entry["lists"].append("abdc")
        entry["abdc"] = aj["rating"]

    for norm, name in custom_norm.items():
        entry = get_entry(name, norm)
        if "custom" not in entry["lists"]:
            entry["lists"].append("custom")

    for canonical, alias_list in ALIASES.items():
        norm = normalize(canonical)
        if norm in merged:
            existing = set(merged[norm]["aliases"])
            for a in alias_list:
                a_lower = a.lower().strip()
                if a_lower and a_lower not in existing:
                    merged[norm]["aliases"].append(a_lower)

    journals_list = sorted(merged.values(), key=lambda j: j["name"].lower())

    list_order = ["utd24", "ft50", "abdc", "sjr", "custom"]
    for j in journals_list:
        j["lists"] = [l for l in list_order if l in j["lists"]]

    return {
        "version": 2,
        "updated": date.today().isoformat(),
        "journals": journals_list,
    }


def main():
    sjr_csv = DATA_DIR / "sjr_source.csv"

    if not sjr_csv.exists():
        print("ERROR: data/sjr_source.csv not found.")
        print("Download from: https://www.scimagojr.com/journalrank.php?area=1400&country=US&type=j")
        print("Save as data/sjr_source.csv")
        return

    print(f"Using SJR source: {sjr_csv}")
    sjr_journals = parse_sjr(sjr_csv)
    print(f"  Found {len(sjr_journals)} SJR journals")

    print("Loading lists...")
    utd24 = load_list(DATA_DIR / "utd24.json")
    ft50 = load_list(DATA_DIR / "ft50.json")
    abdc = load_abdc(DATA_DIR / "abdc.json")
    custom = load_list(DATA_DIR / "custom.json")
    print(f"  UTD24: {len(utd24)} journals")
    print(f"  FT50: {len(ft50)} journals")
    print(f"  ABDC: {len(abdc)} journals")
    print(f"  Custom: {len(custom)} journals")

    print("Building merged journals.json...")
    result = build_journals_json(sjr_journals, utd24, ft50, abdc, custom)
    print(f"  Total unique journals: {len(result['journals'])}")

    for listname in ["utd24", "ft50", "abdc", "sjr", "custom"]:
        c = sum(1 for j in result["journals"] if listname in j["lists"])
        print(f"  In {listname}: {c}")

    output_path = DATA_DIR / "journals.json"
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Written to {output_path}")



if __name__ == "__main__":
    main()
