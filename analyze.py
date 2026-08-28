#!/usr/bin/env python3
"""Деtermінований аналіз збережених вакансій DOU (без AI): regex/keyword-екстракція + звіт."""

import csv
import re
from collections import Counter
from pathlib import Path

VACANCIES_DIR = Path.home() / "Downloads" / "dou-vacancies"
OUT_CSV = Path(__file__).parent / "vacancies_analysis.csv"

TECH_KEYWORDS = {
    "Node.js": r"\bnode\.?js\b",
    "TypeScript": r"\btypescript\b",
    "JavaScript": r"\bjavascript\b",
    "NestJS": r"\bnest\.?js\b",
    "Express": r"\bexpress(\.js)?\b",
    "Fastify": r"\bfastify\b",
    "PostgreSQL": r"\bpostgres(ql)?\b",
    "MySQL": r"\bmysql\b",
    "MongoDB": r"\bmongo(db)?\b",
    "Redis": r"\bredis\b",
    "Kafka": r"\bkafka\b",
    "RabbitMQ": r"\brabbitmq\b",
    "GraphQL": r"\bgraphql\b",
    "gRPC": r"\bgrpc\b",
    "Docker": r"\bdocker\b",
    "Kubernetes": r"\bkubernetes\b|\bk8s\b",
    "AWS": r"\baws\b",
    "GCP": r"\bgcp\b|google cloud",
    "Azure": r"\bazure\b",
    "Terraform": r"\bterraform\b",
    "Elasticsearch": r"\belastic\s?search\b",
    "ClickHouse": r"\bclickhouse\b",
    "React": r"\breact(\.js)?\b",
    "Next.js": r"\bnext\.?js\b",
    "Vue": r"\bvue(\.js)?\b",
    "Angular": r"\bangular\b",
    "Python": r"\bpython\b",
    "Rust": r"\brust\b",
    "Golang": r"\bgo(lang)?\b(?!\s*(to|through|for|ahead))",
    "Java": r"\bjava\b(?!script)",
    ".NET/C#": r"\.net\b|\bc#\b",
    "Microservices": r"\bmicroservices?\b|\bмікросервіс",
    "WebSocket": r"\bwebsocket",
    "Prisma": r"\bprisma\b",
    "TypeORM": r"\btypeorm\b",
    "Sequelize": r"\bsequelize\b",
    "Drizzle": r"\bdrizzle\b",
    "Temporal": r"\btemporal\b",
    "OAuth/JWT": r"\boauth\b|\bjwt\b",
    "Keycloak": r"\bkeycloak\b",
    "CI/CD": r"\bci/cd\b",
}

SENIORITY_PATTERNS = [
    ("Lead/Head", r"\b(lead|head|принципал|principal|staff)\b"),
    ("Senior", r"\bsenior\b"),
    ("Middle", r"\bmiddle\b"),
    ("Junior", r"\bjunior\b"),
]

CITY_WORDS = [
    "Київ", "Львів", "Харків", "Одеса", "Дніпро", "Вінниця", "Івано-Франківськ",
    "Ужгород", "Черкаси", "Рівне", "Тернопіль", "Хмельницький", "Запоріжжя",
    "Ukraine", "Польща", "Варшава", "Краків", "Кіпр", "Пафос",
]


def read_header_block(text: str) -> list[str]:
    """Рядок H1 (назва) + до 3 наступних непорожніх рядків (там живуть локація/зарплата)."""
    lines = [l.strip() for l in text.split("\n")]
    try:
        h1_idx = next(i for i, l in enumerate(lines) if re.match(r"^# [^#]", l))
    except StopIteration:
        return []

    header = []
    for line in lines[h1_idx + 1:]:
        if not line:
            continue
        if line.startswith("### ") or re.match(r"^\*\*[^*]+\*\*:?$", line):
            break
        header.append(line)
        if len(header) >= 3:
            break
    return header


def extract_salary(header_lines: list[str]) -> str:
    for line in header_lines:
        if re.match(r"^\[.*\]\(.*\)$", line):
            continue
        m = re.search(r"(від\s*|до\s*)?\$\s?[\d,]{3,6}(\s?[–-]\s?\$?[\d,]{3,6})?(?!\w)", line)
        if m:
            return m.group(0).strip()
    return ""


def extract_location(header_lines: list[str]) -> str:
    for line in header_lines:
        if line.startswith("#"):
            continue
        if re.match(r"^\[.*\]\(.*\)$", line):
            continue
        if re.match(r"^\d+\s+\S+\s+\d{4}$", line):  # дата типу "21 серпня 2026"
            continue
        if "$" in line:
            continue
        if len(line) < 100 and ("," in line or line in ("віддалено",) or any(c in line for c in CITY_WORDS)):
            return line
    return ""


def extract_english(text: str) -> str:
    m = re.search(
        r"English[^\n]{0,25}?\b(Upper-Intermediate|Pre-Intermediate|Intermediate|Advanced|Fluent|B2\+|B1|B2|C1|C2|A2)\b",
        text, re.IGNORECASE,
    )
    return m.group(1).title() if m else ""


def extract_experience_years(text: str) -> str:
    m = re.search(r"(\d{1,2})\+?\s*(?:years?|років|роки|рік)\b", text, re.IGNORECASE)
    return m.group(1) if m else ""


def extract_seniority(title: str) -> str:
    for label, pattern in SENIORITY_PATTERNS:
        if re.search(pattern, title, re.IGNORECASE):
            return label
    return ""


def extract_apply_link(text: str) -> str:
    m = re.search(r"^Посилання \(відгукнутись\):\s*(\S+)", text, re.MULTILINE)
    return m.group(1) if m else ""


def analyze_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    company, _, title = path.stem.partition(" - ")
    header = read_header_block(text)

    tech = [label for label, pattern in TECH_KEYWORDS.items() if re.search(pattern, text, re.IGNORECASE)]

    return {
        "company": company,
        "title": title,
        "seniority": extract_seniority(title),
        "location": extract_location(header),
        "remote": "так" if "віддалено" in text.lower() else ("гібрид" if "гібрид" in text.lower() else ""),
        "salary": extract_salary(header),
        "english": extract_english(text),
        "experience_years": extract_experience_years(text),
        "tech_stack": "; ".join(tech),
        "apply_link": extract_apply_link(text),
        "file": path.name,
    }


def main():
    files = sorted(VACANCIES_DIR.glob("*.md"))
    if not files:
        print(f"Немає .md файлів у {VACANCIES_DIR}")
        return

    rows = [analyze_file(f) for f in files]

    with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    print(f"Проаналізовано {len(rows)} вакансій -> {OUT_CSV}\n")

    tech_counter = Counter()
    for r in rows:
        tech_counter.update(r["tech_stack"].split("; ") if r["tech_stack"] else [])
    tech_counter.pop("", None)

    print("=== Топ технологій ===")
    for tech, count in tech_counter.most_common(20):
        print(f"  {tech:15s} {count}")

    print("\n=== Seniority ===")
    print(Counter(r["seniority"] or "не вказано" for r in rows))

    print("\n=== Формат роботи ===")
    print(Counter(r["remote"] or "офіс/не вказано" for r in rows))

    print("\n=== English ===")
    print(Counter(r["english"] or "не вказано" for r in rows))

    print("\n=== Зарплата вказана ===")
    with_salary = [r for r in rows if r["salary"]]
    print(f"{len(with_salary)} з {len(rows)} вакансій:")
    for r in with_salary:
        print(f"  {r['salary']:20s} {r['company']} — {r['title']}")


if __name__ == "__main__":
    main()
