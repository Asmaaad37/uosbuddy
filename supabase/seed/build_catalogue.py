"""Turn the pasted UoS program list into supabase/seed/uos-catalogue.json."""
import json, re, sys
from pathlib import Path

src, out = Path(sys.argv[1]), Path(sys.argv[2])

# Department display name (cleaned) -> (short_code, aliases seen on the campus banners)
DEPTS = {
    "Department of Mechanical, Industrial and Energy Systems": ("DMIES", ["College of Engineering & Technology"]),
    "Department of Electrical, Electronics and Computer Systems": ("DEECS", ["College of Engineering & Technology"]),
    "Department of Civil, Environment and Transportation Systems": ("DCETS", ["College of Engineering & Technology"]),
    "Department of Animal Sciences": ("ANS", ["College of Agriculture"]),
    "Institute of Food Science & Nutrition": ("IFSN", []),
    "Department of Agricultural Extension & Rural Studies": ("AERS", ["College of Agriculture"]),
    "Department of Entomology": ("ENT", ["College of Agriculture"]),
    "Department of Agronomy": ("AGR", ["College of Agriculture"]),
    "Department of Horticulture": ("HORT", ["College of Agriculture"]),
    "Department of Plant Breeding and Genetics": ("PBG", ["College of Agriculture"]),
    "Department of Plant Pathology": ("PP", ["College of Agriculture"]),
    "Department of Soil and Environmental Sciences": ("SES", ["College of Agriculture"]),
    "Department of Agricultural Economics": ("AGECON", ["College of Agriculture"]),
    "Department of Forestry": ("FOR", ["College of Agriculture"]),
    "Department of Allied Health Sciences": ("AHS", []),
    "University Nursing College": ("NUR", []),
    "Malik Firoz Khan Noon Business School": ("MFKNBS", ["Malik Feroz Khan Noon Business School", "Business School"]),
    "Department of Economics": ("ECO", []),
    "Institute of Education": ("EDU", ["Department of Education"]),
    "Department of International Relations": ("IR", ["Department of Politics & International Relations"]),
    "Department of History & Pakistan Studies": ("HPS", []),
    "Department of Social Work": ("SW", []),
    "Department of Sociology and Criminology": ("SOC", []),
    "Department of Psychology": ("PSY", []),
    "Department of Political Science": ("POL", ["Department of Politics & International Relations"]),
    "Department of Islamic Studies": ("ISL", []),
    "Department of Urdu Language and Literature": ("URDU", ["Department of Urdu Languages & Literature", "Department of Oriental Languages"]),
    "Department of English": ("ENG", []),
    "Institute of Art & Design": ("IAD", ["Institute of Arts & Design"]),
    "Department of Information Management": ("IM", ["Department of Information and Management"]),
    "College of Law": ("LAW", []),
    "Department of Sports Sciences": ("SPS", []),
    "Department of Communication and Media Studies": ("CMS", []),
    "Department of Punjabi Language, Literature and Culture": ("PJB", ["Department of Oriental Languages"]),
    "Department of Arabic Language & Literature": ("ARB", ["Department of Oriental Languages"]),
    "Department of Linguistics and Language Studies": ("DLLS", []),
    "Department of Biotechnology": ("BIOTECH", []),
    "Department of Botany": ("BOT", []),
    "Institute of Chemistry": ("CHEM", []),
    "Department of Earth Sciences": ("ES", []),
    "Department of Mathematics": ("MATH", []),
    "Department of Physics": ("PHY", []),
    "Department of Statistics": ("STAT", []),
    "Department of Zoology": ("ZOO", []),
    "College of Pharmacy": ("PHARM", []),
    "Department of Computer Science": ("CS", ["Department of Computer Science & IT"]),
    "Department of Information Technology": ("IT", ["Department of Computer Science & IT"]),
    "Department of Software Engineering": ("SE", ["Department of Computer Science & IT"]),
}
DEPT_RENAME = {
    "Department of Mechanical Industrial and Energy Systems (DMIES)": "Department of Mechanical, Industrial and Energy Systems",
    "Department of Electrical, Electronics and Computer Systems (DEECS)": "Department of Electrical, Electronics and Computer Systems",
    "Department Of Civil, Environment and Transportation Systems (DCETS)": "Department of Civil, Environment and Transportation Systems",
    "Department of Punjabi Language Literature and Culture": "Department of Punjabi Language, Literature and Culture",
    "Department of Linguistics and Language Studies (DLLS)": "Department of Linguistics and Language Studies",
}
PROGRAM_FIX = [
    (r"^Mphil\b|^M Phil\b", "MPhil"),
    (r"^BSC\b", "BSc"),
    (r"^Ph\.D\b", "PhD"),
    (r"^B\.Sc\. \(Hons\)\.", "BSc (Hons)"),
    (r"^B\.Sc\. \(Hons\.\)", "BSc (Hons)"),
    (r"^B\.Ed \(Hons\.\)", "BEd (Hons)"),
    (r"^B\.Ed \(1\.5 year\)", "BEd (1.5 Year)"),
    (r"^BSc Civil Engineering \(Civil\)$", "BSc Civil Engineering"),
    (r"^Bachelor Business Administration \(BBA\)$", "Bachelor of Business Administration (BBA)"),
    (r"^Bachelor Business Administration \(5th Intake\)$", "Bachelor of Business Administration (5th Semester Intake)"),
    (r"^Master Business Administration", "Master of Business Administration"),
    (r"^Bachelor of Engineering Technology \((\w+)\) \[.*\]$", r"Bachelor of Engineering Technology (\1)"),
    (r"^PhD in Geology$", "PhD Geology"),
    (r"^LL\.B\. 5 years$", "LLB (5 years)"),
    (r"^LL\.M$", "LLM"),
]


def classify(name: str) -> tuple[str, int]:
    """(program_level, duration_semesters). Durations are defaults an admin can edit."""
    n = name
    if "5th Semester Intake" in n:
        return "bs_5th_semester", 4
    if n.startswith("PhD"):
        return "phd", 6
    if n.startswith(("MPhil", "MS ", "MS (", "LLM", "Master of Business", "Executive MBA")) or n.startswith("MSc (Hons)") \
            or re.match(r"MSc \w+ Engineering", n):
        return "ms_mphil", 4
    if n.startswith(("MA ", "MSc ")):
        return "other", 4  # 2-year master's: no dedicated enum value (see open question)
    if n.startswith(("Diploma", "Postgraduate Diploma", "Post Graduate Diploma", "ADCP")):
        return "other", 2
    if n.startswith("BEd (1.5 Year)"):
        return "other", 3
    if n.startswith(("LLB", "Pharm D", "DPT")):
        return "bs", 10
    return "bs", 8


faculties, fac, dept = [], None, None
for raw in src.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line:
        continue
    if line.startswith("Faculty of"):
        fac = {"name": line, "departments": []}
        faculties.append(fac)
    elif line.startswith("- "):
        name = line[2:].strip()
        for pat, rep in PROGRAM_FIX:
            name = re.sub(pat, rep, name)
        if any(p["name"].lower() == name.lower() for p in dept["programs"]):
            continue  # duplicate in the source list
        level, sems = classify(name)
        dept["programs"].append({"name": name, "level": level, "duration_semesters": sems})
    else:
        name = DEPT_RENAME.get(line, line)
        code, aliases = DEPTS[name]
        dept = {"name": name, "short_code": code, "aliases": aliases, "programs": []}
        fac["departments"].append(dept)

doc = {
    "$comment": "UoS academic catalogue, source: uos.edu.pk degree-programs list + campus banners (2026-10-23). "
                "Seeds universities/departments/programs in Phase 1. short_code and duration_semesters are "
                "defaults chosen by Claude; edit freely.",
    "university": {
        "slug": "uos", "name": "University of Sargodha", "short_name": "UoS", "city": "Sargodha",
        "domains": ["uos.edu.pk"],
        "roll_no_regex": r"^[A-Z]{2,8}\d{2}[FS]\d{2}[A-Z]\d{3}$",
        "registration_no_regex": r"^\d{2}[FS]-US-[A-Z]{2,5}-\d{1,5}$",
        "roll_no_format": "program letters (BSCS) + 2-digit code (51, believed to be the department; unconfirmed) "
                          "+ intake term F/S and 2-digit year (F22 = Fall 2022) + admission category "
                          "(R = regular, S = self-support) + 3-digit serial",
        "roll_no_examples": ["BSCS51F22S037", "BSAI51F25S005", "BSIT51S25R002"],
        "registration_no_format": "2-digit year + term F/S, 'US', subject code, serial (22F-US-CSC-401)",
        "registration_no_examples": ["22F-US-CSC-401"],
        "verification_review_sla_hours": 12,
    },
    "campuses": [{"name": "Main Campus, Sargodha", "is_main": True}],
    "faculties": faculties,
}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

depts = [d for f in faculties for d in f["departments"]]
progs = [p for d in depts for p in d["programs"]]
print(f"{len(faculties)} faculties, {len(depts)} departments, {len(progs)} programs")
from collections import Counter
print(Counter(p["level"] for p in progs))
print("no programs:", [d["name"] for d in depts if not d["programs"]])
print("level=other:", [p["name"] for p in progs if p["level"] == "other" and not p["name"].startswith(("Diploma", "MA "))])
