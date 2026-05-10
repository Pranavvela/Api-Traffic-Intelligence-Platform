# ML Report Generation Guide

## End-to-End Workflow

### Step 1: Start PostgreSQL
Ensure PostgreSQL is running on `localhost:5433` (or update server/.env DB_PORT).

**Check connection:**
```bash
node server/test-db-connection.js
```
Expected output: `✓ Database connected successfully`

---

### Step 2: Start Server + Client
Open **Terminal 1** and run:
```bash
npm start
```
This starts both server (port 4000) and client (port 3000) concurrently. You'll see:
```
Server listening on port 4000
Client app running on port 3000
Schema initialised
```

---

### Step 3: Generate JWT for Simulator (User 999)
Open **Terminal 2** and run:
```bash
node server/scripts/generate_jwt.js --sub=999 --email=simulator@traffic-intel.local --expires=1d
```
Copy the JWT token and update `traffic-simulator/.env`:
```
SIM_AUTH_TOKEN=<paste-token-here>
```

---

### Step 4: Generate Traffic (Normal + Attack Modes)
Open **Terminal 3** and run:

**Normal traffic (recommended for ML training):**
```bash
cd traffic-simulator
npm run normal:safe
```
This sends ~250 normal requests. Wait ~1 min for completion.

**Attack traffic (for anomaly detection):**
```bash
npm run attack:safe
```
This sends ~50 attack requests with suspicious patterns.

**Expected server logs:**
```
INSERT INTO api_logs... SUCCESS
SELECT * FROM api_logs WHERE... SUCCESS
eventBus.emit('log', ...)
```

---

### Step 5: Wait for ML Detection Pipeline
The server's `detectionService` processes each log and:
1. Calls `mlService.scoreIpWindow(ip, userId)` 
2. Inserts result into `ml_detection_results` 
3. Emits SSE `ml` event

**Monitor in server logs for:**
```
Inserted ML detection result: {...}
```

This happens automatically as traffic arrives. Let it run for 30-60 seconds.

---

### Step 6: Verify ML Data Was Populated
Open **Terminal 4** and run:
```bash
psql -h localhost -p 5433 -U postgres -d api_traffic_db -c "SELECT COUNT(*) FROM ml_detection_results WHERE user_id = 999;"
```
Expected: `count > 0`

---

### Step 7: Generate ML Report (CSV + PNG)
Run the report script:
```bash
python server/scripts/generate_ml_report.py --user-id 999 --days 7 --out ml_report.csv --png ml_report.png
```

**Output:**
- `ml_report.csv` — Comparison table (model_name, accuracy%, precision%, recall%, f1%, total_samples)
- `ml_report.png` — Rendered table image for slides/reports

---

## Troubleshooting

### "No ML data found" Error
- ✅ Check: Did traffic actually run? (Check server logs for `INSERT INTO api_logs`)
- ✅ Check: `SELECT COUNT(*) FROM ml_detection_results WHERE user_id = 999;` returns > 0?
- ✅ Fix: Re-run traffic simulator (step 4) and wait 60 seconds.

### "No rows in ml_model_metrics"
- Normal — script falls back to computing from `ml_detection_results`

### DB Connection Failed (ECONNREFUSED)
- Ensure PostgreSQL is running on the configured host/port
- Verify `.env` DB settings match your instance

---

## Colab Alternative

If you prefer cloud execution:

1. Install dependencies:
```bash
!pip install psycopg2-binary pandas matplotlib
```

2. Set DB connection env vars:
```python
import os
os.environ['PGHOST'] = '...'  # your Postgres IP or tunnel
os.environ['PGPORT'] = '5433'
os.environ['PGDATABASE'] = 'api_traffic_db'
os.environ['PGUSER'] = 'postgres'
os.environ['PGPASSWORD'] = '...'
```

3. Upload and run script:
```bash
!python generate_ml_report.py --user-id 999 --days 7 --out ml_report.csv --png ml_report.png
```

---

## Quick Commands Summary

```bash
# Terminal 1: Start everything
npm start

# Terminal 2: Generate JWT
node server/scripts/generate_jwt.js --sub=999 --email=simulator@traffic-intel.local --expires=1d

# Terminal 3: Generate traffic
cd traffic-simulator && npm run normal:safe

# Terminal 4: Generate report
python server/scripts/generate_ml_report.py --user-id 999 --days 7 --out ml_report.csv --png ml_report.png
```
