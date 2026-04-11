# API Sentinel (API Traffic Intelligence Platform)

**Real-Time API Threat Detection & Mitigation Platform**

API Sentinel monitors application-layer API traffic, detects anomalous behavior with explainable rules and lightweight ML, and applies mitigation actions such as blocking and throttling.

---

## Project Structure

```
api-traffic-intelligence-platform/
├── server/               # Node.js + Express backend
├── client/               # React frontend dashboard
├── traffic-simulator/    # Simulated normal and attack traffic
└── docs/                 # Architecture and design documentation
```

---

## Quick Start (Local)

### 1. Server

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

### 2. Client

```bash
cd client
npm install
cp .env.example .env
npm start
```

### 3. Traffic Simulator

```bash
cd traffic-simulator
npm install
# Normal traffic:
npm run normal
# Attack simulation:
npm run attack
# Mixed mode:
npm run mixed
```

---

## Key Features

- Real-time API logging with PostgreSQL persistence
- Rule-based detection with configurable thresholds
- Alert lifecycle with deduplication and mitigation actions
- Blocklist and throttling safeguards
- ML-ready feature engineering and anomaly scoring
- Analyst-focused Threat Analysis console
- External traffic simulator (normal, attack, mixed)

## Detection Rules (Rule Engine)

| Rule | Condition | Threshold |
|------|-----------|-----------|
| Rate Limit Violation | Requests per IP per endpoint (60s) | > 10 |
| Repeated Login Failure | Failed `/login` requests per IP (60s) | > 5 |
| Endpoint Flooding | Rapid repeated hits to same endpoint | > 15 in 60s |
| Burst Detection | Current rate vs rolling average | > 3× average |

All detection is **deterministic**, **explainable**, and **threshold-configurable** via `server/.env` or the Settings UI.

---

## Architecture Summary

- Detection logic is isolated in `server/src/services/`
- Rules are defined in `ruleEngine.js` and use dynamic settings
- Sliding window state is in-memory and evicted via binary search
- Database stores persisted logs, alerts, blocklist, and settings
- Frontend polls the API for live updates
- ML layer provides explainable anomaly scores without replacing rules

## ML Workflow

1. Generate traffic using the simulator.
2. Train the model:
	- API: `POST /ml/train`
	- UI: Threat Analysis → “Train Model”
3. Detect anomalies:
	- API: `GET /ml/detect`
	- UI: Threat Analysis → “View Anomalies”
4. Export dataset:
	- API: `GET /ml/export`

## Simulator Usage

From repo root:

```bash
npm run simulate:normal
npm run simulate:attack
npm run simulate:mixed
```

Optional env vars in `traffic-simulator/.env`:

- `API_URL`
- `USERS`
- `REQUEST_TIMEOUT_MS`
- `SUMMARY_INTERVAL_MS`
- `ATTACK_INTERVAL_MS`

## Environment Configuration

Copy `.env.example` files and adjust for your environment:

```
server/.env.example
client/.env.example
traffic-simulator/.env.example
```

## Deployment Notes

- **Frontend**: Vercel or Netlify
  - Set `REACT_APP_API_URL` to your backend URL
- **Backend**: Render or Railway
  - Provide PostgreSQL connection vars and thresholds
- **Database**: Neon, Supabase, or Railway Postgres

Recommended production layout:

- Vercel/Netlify (React)
- Render/Railway (Express API)
- Neon/Supabase (PostgreSQL)

---

## Future Work

- Model persistence and scheduled retraining
- Advanced unsupervised models (Isolation Forest / autoencoders)
- Alert suppression and correlation rules
- WebSocket streaming for live dashboards
