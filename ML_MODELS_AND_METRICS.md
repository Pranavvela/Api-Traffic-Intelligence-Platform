# ML Models & Chart Generation Guide

## ML Models in Use

Your system uses **4 ML models** for anomaly detection:

### 1. **Z-Score Engine** (Statistical)
- **Algorithm**: Statistical mean/standard deviation analysis
- **How it works**: Calculates z-scores for request features; anomalies > 3σ from mean
- **Features tracked**: requests/min, login failures, unique endpoints, response time, burst ratio, error rate, alerts, blocked requests
- **Strength**: Interpretable, fast, good for known anomalies
- **Weakness**: Assumes normal distribution

### 2. **Isolation Forest Engine** (Density-based)
- **Algorithm**: Scikit-learn Isolation Forest
- **How it works**: Isolates anomalies by building decision trees; anomalies isolated faster
- **Strength**: Handles multivariate anomalies, no distribution assumptions
- **Weakness**: Less interpretable

### 3. **Ensemble Engine** (Default - Recommended) ⭐
- **Algorithm**: Weighted voting of Z-Score + Isolation Forest
- **Weights**: Z-Score 60% + Isolation Forest 40%
- **How it works**: Runs both engines, combines scores for robust decisions
- **Strength**: Most robust; leverages strengths of both models
- **Output**: Enhanced explainability with per-engine breakdown
- **Metrics**: Computes agreement score showing when models agree

### 4. **External Engine** (Optional)
- **Purpose**: Delegate to external ML microservice
- **When used**: If `ML_SERVICE_URL` environment variable is set
- **Use case**: For custom ML models (Python Flask, etc.)

---

## Step 1: Fix Simulator Auth Token

The simulator needs a **valid JWT token** to authenticate with your server.

### Generate a Fresh Token

**Option A: Via Web UI** (Easiest)
```bash
1. Navigate to http://localhost:3000
2. Login with your credentials (or register)
3. Open DevTools (F12) → Application tab
4. Find "token" in localStorage
5. Copy the full JWT
6. Paste into traffic-simulator/.env:
   SIM_AUTH_TOKEN=<your_copied_token_here>
```

**Option B: Via API**
```powershell
# Login to get token
$response = Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/auth/login" `
  -ContentType 'application/json' `
  -Body (@{ email = "your-email@test.com"; password = "your-password" } | ConvertTo-Json)

$token = $response.token

# Update traffic-simulator/.env
$envFile = "traffic-simulator/.env"
(Get-Content $envFile) -replace 'SIM_AUTH_TOKEN=.*', "SIM_AUTH_TOKEN=$token" | Set-Content $envFile
```

**Option C: Via Python Script** (30-day token)
```powershell
# Install PyJWT if needed
pip install PyJWT

# Run token generator
python get-simulator-token.py
```

### Verify Token is Valid

```powershell
# Test simulator authentication
npm run normal:safe
# Should print: [Simulator] Fetching registered APIs... (no "Unauthorized" error)
```

---

## Step 2: Set Up ML Metrics Database

To store and analyze ML model performance, create the metrics tables:

```powershell
# Create tables for ML detection results and metrics
cd server
psql -d api_traffic_db -U postgres -f ..\scripts\add-ml-metrics-table.sql

# Verify tables created
psql -d api_traffic_db -U postgres -c "\dt ml_*"
# Should show: ml_detection_results, ml_model_metrics
```

---

## Step 3: Generate Charts with ML Metrics

Now run the chart generator to get accuracy, precision, recall, and F1 scores:

```powershell
# Activate venv
.\.venv\Scripts\Activate.ps1

# Install/update dependencies
pip install -r "graph generation/requirements.txt"

# Generate all charts including ML metrics
python "graph generation/generate_charts.py" --all

# Output will be in: graph generation/output/
```

### Output Charts Generated

| Chart | Metric | File |
|-------|--------|------|
| **ML Model Metrics** | Accuracy, Precision, Recall, F1 | `ml_metrics.txt` |
| **ROC Curve** | AUC, TPR vs FPR | `roc_curve.html` |
| **Precision-Recall** | Average Precision | `pr_curve.html` |
| **Confusion Matrix** | TP/FP/TN/FN counts | `confusion_matrix.html` |
| **Score Distribution** | Ensemble anomaly score histogram | `ml_score_distribution.html` |
| **Requests/Min** | Traffic volume over time | `rpm_60m.html` |
| **Alerts by Rule** | Rule trigger frequency | `alerts_by_rule_24h.html` |
| **Top IPs** | Most active IPs | `top_ips_5m.html` |

---

## Step 4: Run Simulator with Valid Token

Now the simulator can authenticate:

```powershell
cd traffic-simulator

# Run normal traffic (safe mode)
npm run normal:safe

# Or attack traffic with normal
npm run mixed:safe

# Or custom duration
cross-env SAFE_MODE=true RUN_DURATION_MS=300000 node run.js normal
```

Simulator will now:
1. ✅ Authenticate with server
2. ✅ Fetch registered APIs
3. ✅ Generate requests
4. ✅ Server logs ML detection results
5. ✅ Charts report accuracy/precision/recall

---

## Metrics Explained

### Accuracy
- Formula: (TP + TN) / Total
- Meaning: Overall correctness; what % of predictions were right?
- Good for: Balanced datasets

### Precision
- Formula: TP / (TP + FP)  
- Meaning: Of anomalies we flagged, how many were actually anomalies?
- Good for: High precision = fewer false alarms

### Recall (Sensitivity)
- Formula: TP / (TP + FN)
- Meaning: Of actual anomalies, how many did we catch?
- Good for: High recall = catch most attacks

### F1 Score
- Formula: 2 * (Precision * Recall) / (Precision + Recall)
- Meaning: Harmonic mean of precision & recall; balances both
- Good for: Overall model quality assessment

### ROC-AUC
- Measures: True positive rate vs false positive rate at all thresholds
- Range: 0-1 (1 = perfect classification)
- Interpretation: Area under the ROC curve

---

## Common Issues & Solutions

### "Unauthorized to list registered APIs"
**Solution**: Token is missing or expired
```powershell
# Step 1: Get new token (see Step 1 above)
# Step 2: Update SIM_AUTH_TOKEN in traffic-simulator/.env
# Step 3: Retry: npm run normal:safe
```

### "ml_detection_results table not found"
**Solution**: Create the table
```powershell
cd server
psql -d api_traffic_db -U postgres -f ..\scripts\add-ml-metrics-table.sql
```

### "No ML detection rows"
**Solution**: Run simulator to generate data
```powershell
npm run normal:safe
# Wait 60-90 seconds for data to accumulate
# Then re-run chart generator
```

### Charts show zero values
**Solution**: Database might have no recent data
```powershell
# Check if api_logs has data
psql -d api_traffic_db -U postgres -c "SELECT COUNT(*) FROM api_logs WHERE timestamp > now() - interval '1 hour';"

# If 0, run simulator for at least 2 minutes
npm run normal:safe
```

---

## Next Steps

1. ✅ Generate traffic: `npm run normal:safe`
2. ✅ Wait 2-3 minutes for data accumulation
3. ✅ Generate charts: `python "graph generation/generate_charts.py" --all`
4. ✅ Open `graph generation/output/ml_metrics.txt` to see metrics
5. ✅ Open `.html` charts in browser for interactive visualizations
6. ✅ Use metrics for your report showing model accuracy & performance

---

## ML Model Comparison (What Each Detects Best)

| Scenario | Z-Score | Isolation Forest | Ensemble |
|----------|---------|------------------|----------|
| Spike in requests/min | ✅ Excellent | ⚠️ Good | ✅ Excellent |
| Distributed attacks | ⚠️ Fair | ✅ Excellent | ✅ Excellent |
| New attack pattern | ❌ Poor | ✅ Good | ✅ Good |
| High-volume DDoS | ✅ Excellent | ⚠️ Fair | ✅ Excellent |
| Low-and-slow attack | ⚠️ Fair | ✅ Excellent | ✅ Excellent |
| **Overall** | **Good** | **Excellent** | **⭐ Best** |

**Current default: Ensemble** (best overall performance)

---

For questions, check logs at `server/logs/` or enable DEBUG mode:
```powershell
$env:DEBUG='*'; npm start
```
