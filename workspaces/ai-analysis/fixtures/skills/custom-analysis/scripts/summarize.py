import csv
import json
import sys
from pathlib import Path


source = Path(sys.argv[1]).resolve()
project = Path.cwd().resolve()
source.relative_to(project)
with source.open(newline="", encoding="utf-8") as handle:
    rows = list(csv.DictReader(handle))
columns = list(rows[0]) if rows else []
numeric_totals = {}
for column in columns:
    try:
        numeric_totals[column] = sum(float(row[column]) for row in rows if row[column] != "")
    except ValueError:
        continue
payload = {"rows": len(rows), "columns": columns, "numeric_totals": numeric_totals}
Path("custom-analysis-summary.json").write_text(
    json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(payload, ensure_ascii=False))
