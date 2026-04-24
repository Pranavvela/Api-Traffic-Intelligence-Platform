# API Sentinel

API Sentinel is a real-time API traffic intelligence platform for monitoring API usage, detecting suspicious behavior, and applying mitigation actions such as alerting, throttling, and blocklisting. The stack is split into three parts:

- `server/` for the Express API and detection logic
- `client/` for the React analyst dashboard
- `traffic-simulator/` for generating normal and attack traffic against registered APIs

## What The Platform Does

- Captures API requests and persists logs in PostgreSQL
- Detects rate spikes, login abuse, flooding, and burst behavior with explainable rules
- Supports lightweight anomaly scoring and model training workflows
- Lets analysts register, validate, monitor, and manage APIs from the UI
- Provides a simulator for testing both internal and external APIs

## Repository Layout

```text
api-traffic-intelligence-platform/
├── client/             React frontend dashboard
├── server/             Node.js and Express backend
├── traffic-simulator/   Separate simulator package for test traffic
├── docs/               Architecture and design notes
└── package.json        Root scripts for running the monorepo
```

## Prerequisites

- Node.js 18 or newer
- npm
- PostgreSQL
- A `.env` file in each package you run locally

## Local Setup

### 1. Install dependencies

From the repository root:

```bash
npm run install:all
```

This installs dependencies for the server, client, and simulator.

### 2. Configure the server

Copy `server/.env.example` to `server/.env` and adjust values for your environment. Important defaults:

- `PORT=4000`
- `CLIENT_ORIGIN=http://localhost:3000`
- PostgreSQL connection values in `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Detection thresholds in `RATE_LIMIT_THRESHOLD`, `LOGIN_FAILURE_THRESHOLD`, `FLOOD_THRESHOLD`, `BURST_MULTIPLIER`
- JWT settings in `JWT_SECRET` and `JWT_EXPIRES_IN`

### 3. Configure the client

Copy `client/.env.example` to `client/.env` and set:

- `REACT_APP_API_URL=http://localhost:4000`

The client runs on port `3000` by default.

### 4. Configure the simulator

Copy `traffic-simulator/.env.example` to `traffic-simulator/.env` if you want to change simulator behavior.

## Running The Platform

### Backend only

```bash
npm run server
```

This starts the Express API on port `4000`.

### Frontend only

```bash
npm run client
```

This starts the React app on port `3000`.

### Run server and client together

```bash
npm run dev
```

This starts both the backend and frontend together.

If you want the root start script instead, use:

```bash
npm run start
```

This also launches the server and client together, using each package's `start` command.

### Build the client

```bash
npm run build
```

### Initialize the database

```bash
npm run db:create
```

You can also run the server-level database script directly from `server/` with `npm run db:create`.

## Simulator Overview

The simulator is a separate package at `traffic-simulator/`. It reads the registered APIs from the backend and sends realistic traffic patterns to them. It supports both:

- `INTERNAL` APIs, which are routed through the backend proxy
- `EXTERNAL` APIs, which are called directly

### Simulator goals

- Generate realistic normal traffic
- Simulate attack-style patterns for detection testing
- Exercise both internal endpoints and external third-party dependencies
- Provide safe defaults so local development is not overwhelmed

### Simulator scripts

From the repository root:

```bash
npm run simulate:normal
npm run simulate:attack
npm run simulate:mixed
```

From `traffic-simulator/` directly:

```bash
npm run normal
npm run attack
npm run mixed
```

Safe presets are also available in the simulator package:

```bash
npm run normal:safe
npm run attack:safe
npm run mixed:safe
npm run mixed:stress
```

### Simulator modes

| Script | Purpose |
|--------|---------|
| `normal` | Sends realistic browse/search style traffic |
| `attack` | Runs attack scenarios such as flooding and brute-force login |
| `mixed` | Runs normal and attack traffic together |
| `normal:safe` | Normal traffic with conservative pacing and write operations disabled |
| `attack:safe` | Attack traffic with safe limits and controlled pacing |
| `mixed:safe` | Mixed traffic with conservative settings |
| `mixed:stress` | Higher-load mixed simulation for isolated test environments |

### Simulator environment variables

Important values in `traffic-simulator/.env`:

- `API_URL` - backend base URL, usually `http://localhost:4000`
- `USERS` - number of concurrent virtual users
- `REQUEST_TIMEOUT_MS` - request timeout in milliseconds
- `SUMMARY_INTERVAL_MS` - how often the simulator prints progress summaries
- `ATTACK_INTERVAL_MS` - delay between attack cycles in looped modes
- `SAFE_MODE` - conservative defaults for local testing
- `RUN_DURATION_MS` - duration for looped runs
- `MAX_IN_FLIGHT` - maximum concurrent requests
- `ENABLE_RUSH_HOUR` - enables short traffic spikes during normal simulation
- `ALLOW_WRITE_NORMAL` - allows write operations in normal traffic
- `ENABLE_BRUTE_FORCE` - enables brute-force login scenarios
- `ATTACK_SCALE` - scales attack intensity
- `ATTACK_PACING_MS` - pacing between attack requests
- `SIM_AUTH_TOKEN` - JWT for protected API listing if needed
- `EXCLUDED_ENDPOINT_PATTERNS` - endpoints the simulator should skip

### Simulator behavior notes

- Internal endpoints are sent through `/proxy/...`
- External endpoints are requested directly
- The simulator only uses registered APIs that are active and not marked invalid
- Safe mode keeps traffic low enough for development use

## API Registration And Validation

Analysts can register APIs from the UI and then validate them against the backend.

- `INTERNAL` APIs must use a path that starts with `/`
- `EXTERNAL` APIs should use a full URL such as `https://api.github.com/users`
- The validation endpoint marks APIs as reachable if the response is below a server error threshold

## Core Features

- User authentication and registration
- API registration, validation, update, and deletion
- Live logs, alert history, and threat analysis views
- Blocklist management and throttling controls
- Settings management for detection thresholds
- ML training and anomaly inspection workflow

## Detection Rules

| Rule | Condition | Default Threshold |
|------|-----------|-------------------|
| Rate limit violation | Requests per IP per endpoint in a 60 second window | 10 |
| Repeated login failure | Failed `/login` requests per IP in a 60 second window | 5 |
| Endpoint flooding | Rapid repeated hits to the same endpoint | 15 in 60 seconds |
| Burst detection | Current rate compared with rolling average | 3x average |

All detection is deterministic and explainable, with thresholds configurable in the server environment or via the Settings UI.

## ML Workflow

1. Generate traffic using the simulator.
2. Train the model using `POST /ml/train` or the Threat Analysis UI.
3. View anomalies using `GET /ml/detect` or the Threat Analysis UI.
4. Export datasets using `GET /ml/export`.

## Main Endpoints

The backend exposes routes for:

- Authentication
- Logs, alerts, stats, and settings
- Registered API management
- Blocked IP management
- Threat analysis and simulator orchestration
- ML training and detection
- Proxying protected APIs

## Deployment Notes

- Frontend: Vercel or Netlify
  - Set `REACT_APP_API_URL` to your backend URL
- Backend: Render or Railway
  - Provide PostgreSQL variables and the auth settings
- Database: Neon, Supabase, or Railway Postgres

Recommended production layout:

- Vercel or Netlify for the React client
- Render or Railway for the Express API
- Neon, Supabase, or Railway Postgres for the database

## Future Work

- Model persistence and scheduled retraining
- More advanced unsupervised models such as Isolation Forest or autoencoders
- Alert suppression and correlation rules
- WebSocket streaming for live dashboards
