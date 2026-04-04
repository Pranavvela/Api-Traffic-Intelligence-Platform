# API Traffic Intelligence Platform

**Semester 1 — Real-Time Rule-Based Anomaly Detection**

A modular, production-quality system for monitoring application-layer HTTP API traffic and detecting abnormal usage patterns using explainable, rule-based sliding-window logic.

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

## Quick Start

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
npm start
```

### 3. Traffic Simulator

```bash
cd traffic-simulator
npm install
# Normal traffic:
node normalTraffic.js
# Attack simulation:
node attackTraffic.js
```

---

## Detection Rules (Semester 1)

| Rule | Condition | Threshold |
|------|-----------|-----------|
| Rate Limit Violation | Requests per IP per endpoint (60s) | > 10 |
| Repeated Login Failure | Failed `/login` requests per IP (60s) | > 5 |
| Endpoint Flooding | Rapid repeated hits to same endpoint | > 15 in 60s |
| Burst Detection | Current rate vs rolling average | > 3× average |

All detection is **deterministic**, **explainable**, and **threshold-configurable** via `server/.env`.

---

## Architecture Notes

- Detection logic is fully isolated in `server/src/services/`
- Rules are defined separately in `ruleEngine.js` for easy extension
- Sliding window state is managed in-memory via `slidingWindowService.js`
- Database stores persisted logs and alerts (PostgreSQL)
- Frontend polls the API for live updates (WebSocket-ready architecture)

---

## Semester Roadmap

- **Semester 1 (current):** Rule-based sliding window detection
- **Semester 2:** Unsupervised clustering, statistical baselines, adaptive thresholds
- **Semester 3:** Autoencoders, hybrid rule + ML, API gateway plugin support
