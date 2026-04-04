# Architecture — API Traffic Intelligence Platform (Semester 1)

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Traffic Simulator                           │
│   normalTraffic.js          attackTraffic.js                    │
│   (benign requests)         (brute-force, flood, burst)         │
└────────────────────────┬────────────────────────────────────────┘
                         │  HTTP
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express Server (:4000)                     │
│                                                                 │
│  POST /api/login   GET /api/search   GET /api/users  ...        │
│                          │                                      │
│              requestLogger middleware                           │
│                 ┌─────────────────┐                             │
│                 │  - stamp UUID   │                             │
│                 │  - record time  │                             │
│                 │  - detect IP    │                             │
│                 └────────┬────────┘                             │
│                          │                                      │
│              ┌──────async (non-blocking)──────┐                 │
│              │                               │                 │
│         insertLog()                   detectionService          │
│              │                        .analyse()               │
│              │                               │                 │
│         api_logs table           slidingWindowService           │
│         (PostgreSQL)              (in-memory Map)               │
│                                         │                       │
│                                   ruleEngine                    │
│                                   .evaluateAll()                │
│                                         │                       │
│                              ┌──────────┴──────────┐           │
│                              │  Rules evaluated:   │           │
│                              │  1. RATE_LIMIT       │           │
│                              │  2. LOGIN_FAILURE    │           │
│                              │  3. ENDPOINT_FLOOD   │           │
│                              │  4. BURST_DETECTION  │           │
│                              └──────────┬──────────┘           │
│                                         │ violation?            │
│                                   insertAlert()                 │
│                                   alerts table                  │
│                                   (PostgreSQL)                  │
│                                                                 │
│  GET /api/logs    GET /api/alerts    GET /api/stats/summary     │
└─────────────────────────────────────────────────────────────────┘
                         │  JSON REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   React Dashboard (:3000)                       │
│                                                                 │
│  StatsBar          AlertPanel        LogTable                   │
│  ├ RPM             ├ Active alerts   └ Recent requests          │
│  ├ Request count   ├ Rule triggered                             │
│  ├ Unresolved ⚠    ├ IP / endpoint                              │
│  └ Top IP          ├ Explainable reason                         │
│                    └ Resolve button                             │
│                                                                 │
│  TopIpsPanel                EndpointStatsPanel                  │
│  └ Bar chart — req/IP       └ Bar chart — req/endpoint          │
│                                                                 │
│  Polling interval: 5 seconds                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detection Algorithm

### Sliding Window (in-memory)

All counters are maintained in a `Map<key, number[]>` where each value is a sorted
array of event timestamps (milliseconds). On every request:

1. Timestamps older than `WINDOW_SIZE_MS` (default 60 s) are evicted via binary search.
2. The remaining count is compared against configured thresholds.

Memory is bounded: a background interval purges all expired entries every 2 minutes.

### Rule Evaluation Order

```
logEntry
  │
  ├─ Rule 1: RATE_LIMIT_VIOLATION
  │    count(rateKey(ip, endpoint)) > RATE_LIMIT_THRESHOLD (10)
  │
  ├─ Rule 2: REPEATED_LOGIN_FAILURE
  │    endpoint matches /login/ AND status IN (400,401,403)
  │    count(loginFailKey(ip)) > LOGIN_FAILURE_THRESHOLD (5)
  │
  ├─ Rule 3: ENDPOINT_FLOODING
  │    count(rateKey(ip, endpoint)) > FLOOD_THRESHOLD (15)
  │
  └─ Rule 4: BURST_DETECTION
       currentRate(key, 10s) > BURST_MULTIPLIER × rollingAvgRate(key)
       (only fires when baseline ≥ 0.1 req/s)
```

Multiple rules can fire for a single request — each generates a separate alert.

---

## Configuration (server/.env)

| Variable                 | Default | Description                          |
|--------------------------|---------|--------------------------------------|
| `PORT`                   | 4000    | Express listen port                  |
| `DB_HOST`                | localhost | PostgreSQL host                    |
| `DB_PORT`                | 5432    | PostgreSQL port                      |
| `DB_NAME`                | api_traffic_db | Database name               |
| `DB_USER`                | postgres | DB username                         |
| `DB_PASSWORD`            | —       | DB password                          |
| `WINDOW_SIZE_MS`         | 60000   | Sliding window duration (ms)         |
| `RATE_LIMIT_THRESHOLD`   | 10      | Max requests per IP per endpoint/60s |
| `LOGIN_FAILURE_THRESHOLD`| 5       | Max failed logins per IP/60s         |
| `FLOOD_THRESHOLD`        | 15      | Max requests per endpoint/60s        |
| `BURST_MULTIPLIER`       | 3       | Burst = current > N × baseline rate  |

---

## Semester Roadmap

### Semester 1 (current)
- Rule-based sliding window detection
- Deterministic, explainable alerts
- PostgreSQL persistence
- React live dashboard

### Semester 2 (planned)
- Unsupervised clustering (k-means / DBSCAN on feature vectors)
- Statistical baselines per endpoint (mean ± 3σ)
- Adaptive thresholds that self-tune to traffic patterns
- Alert suppression / deduplication logic

### Semester 3 (planned)
- Autoencoder-based reconstruction error anomaly detection
- Hybrid rule + ML scoring with confidence weights
- API gateway plugin (Express middleware or Nginx module)
- Real-time ML inference with model versioning
