# Graph generation

This folder contains a lightweight script to generate key charts from the project's Postgres DB and save them to `output/`.

Files:
- `generate_charts.py` — main script that runs queries and writes Plotly HTML/PNG outputs to `output/`.
- `requirements.txt` — Python dependencies.

Quick start (PowerShell):

```powershell
# create virtualenv
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r "graph generation/requirements.txt"

# DB config is auto-loaded from server/.env by default.
# Optional override with a full URL:
# $env:DB_URL = 'postgresql://USER:PASS@HOST:5432/DB'

# run core charts
python "graph generation/generate_charts.py"

# run all charts (including ML performance/drift if tables exist)
python "graph generation/generate_charts.py" --all
```

Output will be written to `graph generation/output/`.

If you need to change DB credentials, edit `server/.env` values:
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
