#!/usr/bin/env python3
"""Merge UTD24, FT50, and ABDC journal lists into a single journals.json."""

import json
import re
from datetime import date
from pathlib import Path

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
    "Journal of Services Marketing": ["j serv market", "j. serv. marketing"],
    "Journal of Interactive Marketing": ["j interact market", "j. interact. marketing"],
    "Journal of Business Research": ["jbr", "j bus res", "j. bus. res."],
}


def normalize(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r"^the\s+", "", name)
    name = name.replace("&", "and")
    name = re.sub(r"[:.,'\"()\[\]]", " ", name)
    name = re.sub(r"\s+", " ", name)
    return name.strip()


def load_list(json_path: Path) -> list[str]:
    with open(json_path) as f:
        return json.load(f)


def load_abdc(json_path: Path) -> list[dict]:
    with open(json_path) as f:
        return json.load(f)


def build_journals_json(
    utd24: list[str],
    ft50: list[str],
    abdc: list[dict],
    custom: list[str],
) -> dict:
    merged = {}

    def get_entry(name, norm):
        return merged.setdefault(norm, {
            "name": name,
            "normalized": norm,
            "aliases": [],
            "lists": [],
            "abdc": None,
        })

    for name in utd24:
        entry = get_entry(name, normalize(name))
        if "utd24" not in entry["lists"]:
            entry["lists"].append("utd24")

    for name in ft50:
        entry = get_entry(name, normalize(name))
        if "ft50" not in entry["lists"]:
            entry["lists"].append("ft50")

    for aj in abdc:
        norm = normalize(aj["name"])
        entry = get_entry(aj["name"], norm)
        if "abdc" not in entry["lists"]:
            entry["lists"].append("abdc")
        entry["abdc"] = aj["rating"]

    for name in custom:
        entry = get_entry(name, normalize(name))
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

    list_order = ["utd24", "ft50", "abdc", "custom"]
    for j in journals_list:
        j["lists"] = [l for l in list_order if l in j["lists"]]

    return {
        "version": 3,
        "updated": date.today().isoformat(),
        "journals": journals_list,
    }


def main():
    print("Loading lists...")
    utd24 = load_list(DATA_DIR / "utd24.json")
    ft50 = load_list(DATA_DIR / "ft50.json")
    abdc = load_abdc(DATA_DIR / "abdc.json")
    custom = load_list(DATA_DIR / "custom.json")
    print(f"  UTD24: {len(utd24)}")
    print(f"  FT50: {len(ft50)}")
    print(f"  ABDC: {len(abdc)}")
    print(f"  Custom: {len(custom)}")

    print("Building merged journals.json...")
    result = build_journals_json(utd24, ft50, abdc, custom)
    print(f"  Total unique journals: {len(result['journals'])}")

    for listname in ["utd24", "ft50", "abdc", "custom"]:
        c = sum(1 for j in result["journals"] if listname in j["lists"])
        print(f"  In {listname}: {c}")

    output_path = DATA_DIR / "journals.json"
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Written to {output_path}")

    ext_path = ROOT / "extension" / "journals.json"
    with open(ext_path, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"Copied to {ext_path}")


if __name__ == "__main__":
    main()
