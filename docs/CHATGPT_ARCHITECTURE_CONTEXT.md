# API Traffic Intelligence Platform - Full Working Context for Architecture Diagram

Use this document as direct input to ChatGPT (or any diagram generator) to produce architecture diagrams.

## 1) Project Purpose

API Traffic Intelligence Platform is a full-stack security analytics system for API traffic.
It monitors API behavior in real time, detects suspicious patterns, stores logs and alerts, and supports mitigation actions (block/throttle).
It also includes an ML subsystem and a traffic simulator for synthetic normal + attack traffic generation.

## 2) Top-Level Components

1. React Frontend (client)
- Analyst dashboard UI
- Authentication UI
- API registration and validation UI
- Threat analysis, settings, blocked IP management

2. Node.js Express Backend (server)
- REST API + proxy gateway
- Request logging middleware
- Rule-based detection engine
- ML orchestration layer
- Mitigation services (blocklist, throttling)
- Stats and threat analysis endpoints

3. PostgreSQL Database
- Persistent logs, alerts, users, registered APIs, settings, blocked IPs, ML model storage

4. Traffic Simulator (traffic-simulator)
- Generates realistic normal traffic
- Generates multiple attack patterns (brute-force, flood, burst, distributed)
- Supports safe mode and stress mode

## 3) Runtime Ports and Process Model

- Frontend default: 3000
- Backend default: 4000
- DB: PostgreSQL (configured via env)

Root scripts can run all components:
- install all dependencies
- run backend only
- run frontend only
- run both server + client concurrently
- run simulator modes (normal, attack, mixed)

## 4) Backend Startup Sequence

When backend starts, the server does this in order:

1. Load env config
2. Initialize database schema (idempotent table/index creation + migrations)
3. Seed blocklist in-memory cache from DB
4. Load user settings cache from DB
5. Load previously trained ML model from DB repository
6. Initialize automated ML features:
   - ensemble mode (enabled)
   - drift monitoring background loop
   - optional auto-retrain on drift
7. Start Express listener

## 5) Authentication and Access Model

- JWT bearer auth
- Public routes:
  - POST /api/register
  - POST /api/login
- Protected routes require valid JWT:
  - /api/logs
  - /api/alerts
  - /api/stats
  - /api/block-ip
  - /api/registered-apis and other /api management routes
  - /ml/*
  - /proxy/*

Token flow:
- Frontend stores JWT in localStorage
- Axios interceptor injects Authorization: Bearer token
- On 401, frontend clears token and redirects to login

## 6) Main Backend Request Flow

The backend pipeline is:

1. attachAuth middleware reads JWT if present (non-blocking)
2. requestLogger middleware runs after auth routes
3. requestLogger determines if request should be logged and evaluated
4. request completion hook persists log row in api_logs
5. detectionService analyzes log asynchronously
6. if rule/ML anomaly found, alerts are inserted
7. progressive escalation may throttle or block IP

Important behavior details:
- Logging and detection run for both /api and /proxy traffic
- Some internal endpoints are excluded from logging to reduce noise
- Blocking and throttling are primarily enforced on proxy traffic
- Simulator requests include special headers and can be treated differently (normal-mode simulator traffic is not aggressively blocked)

## 7) Proxy Gateway Behavior

Proxy endpoint supports:
- /proxy?url=https://target
- /proxy/https://target

Forwarding logic:
1. Validate target URL (http/https only)
2. Build safe forward headers (remove host/content-length/connection)
3. Resolve per-user API policy from registered APIs + runtime overrides
4. Optionally enforce per-API rate limit override
5. Forward request upstream via axios
6. Capture response status/latency/payload metrics
7. Update per-API health and risk scores
8. Return upstream response back to client

Per-API metrics tracked:
- total requests
- error percentage
- response latency (baseline EWMA + recent EWMA)
- anomaly score from latency spike
- risk score with sensitivity weighting
- health state (HEALTHY/DEGRADED/UNHEALTHY)

## 8) Rule-Based Detection Engine

Detection service combines:
- sliding window counters (in-memory)
- rule engine evaluation
- optional ML anomaly signal
- progressive escalation logic

Sliding windows track keys like:
- IP + endpoint request rate
- login failures
- burst counters

Typical rule families:
- RATE_LIMIT_VIOLATION
- REPEATED_LOGIN_FAILURE
- ENDPOINT_FLOODING
- BURST_DETECTION

When violation(s) occur:
1. mark corresponding log as alert-triggered
2. insert alert rows into alerts table
3. if ML anomaly also present, insert ML_ANOMALY alert
4. compute suspicion score + repeat count in short-lived TTL stores
5. apply escalation:
   - throttle first for medium/high suspicion
   - block only at higher confidence/repeat thresholds

## 9) Mitigation Layer

Mitigation actions include:
- THROTTLED: temporary rate pressure reduction
- BLOCKED: persistent blocklist entry in DB + cache
- MONITORED/NONE: observation without strict action

Alert resolution flow:
- Analyst resolves alert from UI
- Backend may apply mitigation action based on rule + settings
- Alerts store resolved_at, resolved_by, mitigation_action, alert_state

## 10) ML Subsystem Architecture

ML API surface:
- GET /ml/features
- GET /ml/export
- POST /ml/train
- GET /ml/detect
- GET /ml/status
- GET /ml/models
- POST /ml/models/:id/activate
- GET /ml/drift
- GET /ml/drift/status

Engine orchestration:
- mlService selects/uses an engine abstraction
- Ensemble is hard-enabled by default in current code path
- Drift detection loop runs periodically
- Auto-retrain may execute when drift detected

External ML engine integration:
- If external ML service URL is configured, backend can call external endpoints:
  - /train
  - /detect
  - /status
- External requests include JSON payload and optional X-ML-Engine header
- If external service unavailable, graceful fallback responses are returned

Model persistence:
- ml_model table stores model_data JSONB, engine, version, active flag
- Backend loads active/latest model at startup

## 11) Database Entities

Core tables:

1. users
- id, email, password hash, created_at

2. api_logs
- request_id UUID
- user_id
- ip, method, endpoint, status_code
- response_ms, user_agent
- alert_triggered, is_blocked
- timestamp

3. alerts
- request linkage + user linkage
- rule_triggered, source (RULE/ML)
- reason, severity
- resolved flags and metadata
- aggregation fields (alert_count, first_seen, last_seen, confidence_score, timeline)

4. blocked_ips
- per-user blocked IP records
- reason and blocked timestamp

5. registered_apis
- per-user endpoint registry
- method, threshold, active flag
- API type (INTERNAL/EXTERNAL)
- validation status/check timestamps/messages

6. settings
- global defaults

7. user_settings
- tenant-scoped overrides (thresholds, windows, auto-block, etc.)

8. ml_model
- model_data JSONB
- engine/version
- active flag

## 12) Frontend Application Structure

Main frontend pages:

1. Login
- register and login flows
- stores JWT on successful login

2. Overview
- high-level status cards and threat score summary

3. Dashboard
- polling-based live observability
- logs, alerts, top IPs, endpoint stats, traffic graph, top attackers, resolved alerts
- default polling interval ~4 seconds

4. API Management
- register/list/validate/edit/delete APIs
- toggle monitoring state per API

5. Blocked IPs
- list blocked IPs and unblock action

6. Threat Analysis
- summary/rule breakdown/timeline views

7. Settings
- threshold and mitigation configuration updates

Frontend API client behavior:
- Axios with auth interceptors
- Normalized response extraction
- Explicit endpoint methods for logs, alerts, stats, settings, ML, threat analysis

## 13) Traffic Simulator Working

Simulator modes:
- normal
- attack
- mixed (normal + attack concurrently)

Configuration controls:
- SAFE_MODE, RUN_DURATION_MS, MAX_IN_FLIGHT
- ATTACK_SCALE, ATTACK_PACING_MS
- ENABLE_BRUTE_FORCE, ENABLE_RUSH_HOUR
- API_URL and optional SIM_AUTH_TOKEN

Normal simulator behavior:
- pulls active/valid registered APIs from backend
- builds realistic user flows with random think time
- uses large IP/user-agent pools
- supports both internal and external APIs
- can optionally disable write traffic

Attack simulator behavior:
- scenarios include:
  - brute-force login
  - endpoint flooding
  - traffic burst
  - distributed abuse
- sends simulator headers to emulate attack identity/mode
- supports pacing/scale controls

## 14) End-to-End Data Flow (Conceptual)

1. User logs into frontend and receives JWT
2. Analyst registers APIs to monitor (internal/external)
3. Real traffic and simulator traffic hit backend
4. requestLogger persists structured logs
5. detectionService applies rules + ML signal
6. alerts are stored and surfaced in dashboard
7. mitigation actions (throttle/block) may be applied
8. stats/threat endpoints aggregate DB + runtime metrics for visualization
9. optional ML training/detection/drift endpoints support advanced analysis

## 15) Architecture Diagram Prompt (ready to paste)

Create a production-style architecture diagram for a full-stack API Traffic Intelligence Platform with these components and flows:

- React frontend (dashboard, login, API management, threat analysis, settings) on port 3000
- Express backend on port 4000 with JWT auth
- PostgreSQL database for users, api_logs, alerts, blocked_ips, registered_apis, settings, user_settings, ml_model
- Traffic simulator service generating normal and attack traffic (normal/attack/mixed)
- Proxy gateway in backend that forwards requests to internal/external APIs and computes per-API health/risk metrics
- Request logger middleware that logs traffic and triggers asynchronous detection
- Detection engine with sliding-window rule detection + ML anomaly signal
- Mitigation layer for throttling and IP blocking
- ML subsystem with train/detect/status/models/drift endpoints and optional external ML service integration
- Threat analysis and stats aggregation APIs feeding dashboard cards, graphs, top IPs, attackers, timelines

Show directional data flow arrows for:
- frontend -> backend REST APIs
- backend -> postgres reads/writes
- simulator -> backend/proxy traffic
- backend detection -> alerts storage
- backend mitigation -> blocklist/throttle
- backend ML service -> external ML service (optional)

Use layered view:
- presentation layer
- application/service layer
- data layer
- simulation/testing layer

Also include key security and ops annotations:
- JWT auth on protected routes
- async detection pipeline
- per-user API policy and rate-limit overrides
- drift monitoring and optional auto-retrain
- polling-based dashboard updates.
