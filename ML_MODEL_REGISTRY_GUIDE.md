# ML Model Registry — Complete Guide

## Overview

The **ML Model Registry** is a persistent, versioned storage system for trained machine learning models used in anomaly detection. It enables you to:

- **Train** new baseline models from API traffic patterns
- **Detect** anomalies by comparing live traffic against the active model
- **Version** models so you can compare and roll back to previous baselines
- **Manage** multiple model snapshots with activation/deactivation
- **Integrate** multiple ML engines (Z-Score, Isolation Forest, External services)

---

## Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────────┐
│         Frontend (ThreatAnalysis.jsx)       │
│    - Train button                           │
│    - View Anomalies button                  │
│    - Model version table + activate         │
└────────────────┬────────────────────────────┘
                 │ REST API
┌────────────────▼────────────────────────────┐
│      ML Routes (/ml/...)                    │
│    - GET  /ml/status                        │
│    - POST /ml/train                         │
│    - GET  /ml/detect                        │
│    - GET  /ml/models                        │
│    - POST /ml/models/:id/activate           │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│     ML Controller (mlController.js)         │
│    - Routes requests to mlService           │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│     ML Service (mlService.js)               │
│    - Engine selector (ZScore/IF/External)   │
│    - Unified API for all engines            │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼─────────────┬──────────────┬──────────────┐
│                              │              │              │
│                    ┌─────────▼───────────┐  │              │
│                    │ ZScore Engine       │  │              │
│                    │ (default, in-memory)│  │              │
│                    └─────────┬───────────┘  │              │
│                              │              │              │
│                    ┌─────────▼─────────────┐│  ┌──────────▼──────────┐
│                    │ Isolation Forest      ││  │ External ML Service  │
│                    │ (via external/zscore) ││  │ (HTTP delegation)    │
│                    └───────────────────────┘│  └─────────────────────┘
│                                             │
└─────────────────────────────────────────────┘
         │
┌────────▼──────────────────────────────────────┐
│  ML Model Repository (mlModelRepository.js)   │
│  - saveModel()                                │
│  - loadLatestModel()                          │
│  - getAllModels()                             │
│  - activateModel()                            │
│  - pruneOldModels()                           │
└────────┬───────────────────────────────────────┘
         │
┌────────▼─────────────────────────────────────┐
│         PostgreSQL (ml_model table)           │
│  - model_data (JSONB)                         │
│  - engine (varchar)                           │
│  - model_version (int)                        │
│  - is_active (bool)                           │
│  - created_at (timestamptz)                   │
└───────────────────────────────────────────────┘
```

---

## Database Schema

### `ml_model` Table

```sql
CREATE TABLE ml_model (
  id          SERIAL PRIMARY KEY,
  model_data  JSONB        NOT NULL,   -- Full trained model state (JSON)
  engine      VARCHAR(32)  NOT NULL DEFAULT 'zscore',  -- Engine name
  model_version INTEGER,               -- Sequential version number
  is_active   BOOLEAN      NOT NULL DEFAULT FALSE,     -- Active flag
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()      -- Training timestamp
);
```

**Key Points:**
- `model_data` stores the complete trained model state as JSON (e.g., means, stds, threshold for Z-Score)
- Only one model per engine can be `is_active = TRUE` at a time
- Models are versioned sequentially per engine
- Models are never deleted; you can prune old ones using `pruneOldModels(keep_count)`

---

## ML Model Repository API

### Core Functions

**File:** `server/src/models/mlModelRepository.js`

#### `saveModel(modelData, engine = 'zscore')`
Saves a trained model snapshot to the database.
```javascript
// Deactivates all previous models for the engine
// Increments version number
// Marks new model as active
const savedModel = await mlModelRepository.saveModel(
  {
    trained: true,
    trainedAt: "2026-04-24T10:30:00Z",
    sampleCount: 1000,
    features: ['rpm', 'error_rate', 'blocked_count'],
    means: { rpm: 50, error_rate: 0.02 },
    stds: { rpm: 10, error_rate: 0.01 },
    threshold: 3.0,
    windowMs: 60000,
    observationMs: 10000,
    trainingDurationMs: 245
  },
  'zscore'
);
// Returns: { id: 5, engine: 'zscore', model_version: 1, is_active: true, ... }
```

#### `loadLatestModel(engine = 'zscore')`
Loads the most recent active model (or fallback to latest by timestamp).
```javascript
const model = await mlModelRepository.loadLatestModel('zscore');
// Returns: { id: 5, model_data: {...}, engine, model_version, is_active, created_at }
// Returns null if no model exists
```

#### `getModelById(id, engine = 'zscore')`
Fetches a specific model by ID.
```javascript
const model = await mlModelRepository.getModelById(5, 'zscore');
```

#### `getAllModels(engine = 'zscore')`
Lists all saved models for an engine (for UI version selection).
```javascript
const allModels = await mlModelRepository.getAllModels('zscore');
// Returns: [
//   { id: 5, created_at, engine, model_version: 1, is_active: true, model_data },
//   { id: 4, created_at, engine, model_version: 0, is_active: false, model_data }
// ]
```

#### `activateModel(id, engine = 'zscore')`
Switches active model to a specific version.
```javascript
const activated = await mlModelRepository.activateModel(4, 'zscore');
// Deactivates model 5, activates model 4
// Returns the newly activated model record
```

#### `pruneOldModels(keepCount = 5, engine = 'zscore')`
Deletes old models, keeping only N most recent.
```javascript
const deletedCount = await mlModelRepository.pruneOldModels(5, 'zscore');
// Keeps 5 most recent models, deletes older ones
```

#### `getLatestModelTimestamp(engine = 'zscore')`
Returns when the model was last trained.
```javascript
const trainedAt = await mlModelRepository.getLatestModelTimestamp('zscore');
// Returns: Date object or null
```

---

## ML Service API

### Unified Interface

**File:** `server/src/services/mlService.js`

The `mlService` wraps engine-specific implementations and provides a consistent API.

#### `train(opts = {})`
Trains a new model from traffic data.
```javascript
const result = await mlService.train({
  windowMs: 60000,          // Look-back window for training data
  observationMs: 10000,     // Time to separate "recent" vs "baseline" activity
  start: '2026-04-24T00:00:00Z',  // Optional custom start time
  end: '2026-04-24T23:59:59Z',    // Optional custom end time
  userId: 42                // Optional user filter
});

// Returns:
// ✓ Success: { trained: true, trainedAt, sampleCount, featureCount, threshold, ... }
// ✗ Failure: { trained: false, reason: "Insufficient training data" }
```

#### `detect(opts = {})`
Finds anomalies in traffic using the active model.
```javascript
const result = await mlService.detect({
  windowMs: 60000,
  observationMs: 10000,
  ip: '192.168.1.100',  // Optional: filter by IP
  start: '2026-04-24T10:00:00Z',
  end: '2026-04-24T11:00:00Z',
  userId: 42
});

// Returns:
// { trained: true, results: [
//   {
//     ip: '192.168.1.100',
//     window_start: '2026-04-24T10:05:00Z',
//     anomaly_score: 4.2,
//     normalized_score: 0.85,
//     ml_label: 'ANOMALY',
//     explainability: { top_features: [...] }
//   },
//   ...
// ]}
```

#### `status()`
Returns current model and engine status.
```javascript
const status = await mlService.status();

// Returns:
// {
//   trained: true,
//   trainedAt: '2026-04-24T10:30:00Z',
//   sampleCount: 1000,
//   featureCount: 6,
//   threshold: 3.0,
//   windowMs: 60000,
//   observationMs: 10000,
//   modelId: 5,
//   modelVersion: 1,
//   isActive: true,
//   engine: 'zscore'
// }
```

#### `scoreIpWindow(ip, userId)`
Scores a single IP's recent window (used during live traffic processing).
```javascript
const result = await mlService.scoreIpWindow('192.168.1.100', 42);

// Returns:
// {
//   ip: '192.168.1.100',
//   anomaly_score: 2.1,
//   normalized_score: 0.42,
//   ml_label: 'NORMAL',
//   explainability: { top_features: [...] }
// }
// or null if model not trained or no data for IP
```

#### `listModels()`
Lists all saved model versions.
```javascript
const models = await mlService.listModels();
// Returns array of model records (same as getAllModels)
```

#### `activateModel(id)`
Switches to a different model version.
```javascript
const activated = await mlService.activateModel(4);
// Returns activated model record
```

#### `loadModel(modelData)`
Loads persisted model data into engine memory (called at server startup).
```javascript
const dbModel = await mlModelRepository.loadLatestModel('zscore');
if (dbModel) {
  mlService.loadModel(dbModel);  // Restores trained state
}
```

---

## REST API Endpoints

**Base URL:** `/ml`

### GET `/ml/status`
Returns current model and engine status.
```bash
curl http://localhost:4000/ml/status
```
Response:
```json
{
  "success": true,
  "data": {
    "trained": true,
    "trainedAt": "2026-04-24T10:30:00Z",
    "sampleCount": 1000,
    "featureCount": 6,
    "threshold": 3.0,
    "modelVersion": 1,
    "engine": "zscore"
  }
}
```

### GET `/ml/models`
Lists all saved model versions.
```bash
curl http://localhost:4000/ml/models
```
Response:
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": 5,
      "model_version": 1,
      "created_at": "2026-04-24T10:30:00Z",
      "is_active": true,
      "model_data": {
        "trained": true,
        "sampleCount": 1000,
        "features": [...],
        "threshold": 3.0
      }
    },
    ...
  ]
}
```

### POST `/ml/train`
Trains a new model from collected traffic.
```bash
curl -X POST http://localhost:4000/ml/train \
  -H "Content-Type: application/json" \
  -d '{
    "windowMs": 3600000,
    "observationMs": 10000
  }'
```
Response:
```json
{
  "success": true,
  "data": {
    "trained": true,
    "trainedAt": "2026-04-24T10:30:00Z",
    "sampleCount": 1234,
    "featureCount": 6,
    "threshold": 3.1,
    "modelVersion": 1
  }
}
```

### GET `/ml/detect`
Detects anomalies in traffic.
```bash
curl "http://localhost:4000/ml/detect?windowMs=60000&observationMs=10000"
```
Response:
```json
{
  "success": true,
  "data": {
    "trained": true,
    "results": [
      {
        "ip": "192.168.1.100",
        "window_start": "2026-04-24T10:05:00Z",
        "totalCount": 150,
        "errorCount": 3,
        "anomaly_score": 4.2,
        "normalized_score": 0.85,
        "ml_label": "ANOMALY",
        "explainability": {
          "top_features": [
            { "name": "errorCount", "contribution": 2.1 }
          ]
        }
      },
      ...
    ]
  }
}
```

### POST `/ml/models/:id/activate`
Activates a specific model version.
```bash
curl -X POST http://localhost:4000/ml/models/4/activate
```
Response:
```json
{
  "success": true,
  "data": {
    "id": 4,
    "model_version": 0,
    "is_active": true,
    "created_at": "2026-04-23T10:30:00Z"
  }
}
```

### GET `/ml/features`
Returns engineered feature vectors (for debugging).
```bash
curl "http://localhost:4000/ml/features?windowMs=60000&observationMs=10000"
```
Response:
```json
{
  "success": true,
  "count": 50,
  "data": [
    {
      "user_id": 1,
      "ip": "192.168.1.100",
      "window_start": "2026-04-24T10:00:00Z",
      "totalCount": 100,
      "errorCount": 2,
      "rpm": 50,
      "error_rate": 0.02,
      ...
    },
    ...
  ]
}
```

### GET `/ml/export`
Exports features as JSON (same as `/ml/features`).
```bash
curl "http://localhost:4000/ml/export" > features.json
```

---

## ML Engines

### 1. Z-Score Engine (Default)

**File:** `server/src/services/ml/zScoreEngine.js`

**How it works:**
- Computes mean and standard deviation for each feature across a training window
- Detects anomalies when observation distance from mean exceeds threshold (typically 3σ)
- Uses 95th percentile of training scores as the threshold
- Provides per-feature explainability (which features contributed most to anomaly score)

**Features engineered:**
- `rpm` (requests per minute)
- `error_rate` (% of 4xx/5xx responses)
- `blocked_count` (# of blocked requests)
- `failedLoginCount` (# of failed login attempts)
- `uniqueEndpoints` (# of unique endpoints hit)

**Advantages:**
- Fast, in-memory, lightweight
- Interpretable (statistical)
- Good for traffic baseline detection

**Model state stored in DB:**
```json
{
  "trained": true,
  "trainedAt": "2026-04-24T10:30:00Z",
  "sampleCount": 1234,
  "features": ["rpm", "error_rate", "blocked_count", ...],
  "means": {"rpm": 50.5, "error_rate": 0.02, ...},
  "stds": {"rpm": 10.2, "error_rate": 0.01, ...},
  "threshold": 3.0,
  "windowMs": 60000,
  "observationMs": 10000,
  "trainingDurationMs": 245
}
```

### 2. Isolation Forest Engine

**File:** `server/src/services/ml/isolationForestEngine.js`

**How it works:**
- Delegates to external ML service if configured (via `ML_SERVICE_URL`)
- Falls back to Z-Score if external service unavailable
- Isolation Forest is more powerful for complex anomalies but requires external compute

**Enable via environment:**
```bash
ML_ENGINE=isolation-forest
ML_SERVICE_URL=http://ml-service:5000
```

### 3. External ML Service

**File:** `server/src/services/ml/externalEngine.js`

**How it works:**
- Makes HTTP requests to an external ML microservice
- Passes features and receives scores/labels
- Falls back gracefully if service is down

**Enable via environment:**
```bash
ML_SERVICE_URL=http://ml-service:5000
```

**Expected external API:**
```
POST /train
Body: { windowMs, observationMs, ... }
Response: { trained, threshold, ... }

POST /detect
Body: { windowMs, observationMs, ip?, ... }
Response: { results: [{ip, anomaly_score, ml_label, ...}] }

GET /status
Response: { trained, engine, ... }
```

---

## How to Use the ML Model Registry

### Workflow 1: Train & Detect (Basic)

#### Step 1: Train a Model
In **ThreatAnalysis.jsx**, click **"Train Model"** button or call:

```javascript
const response = await trainMl();
// Returns trained model status with version, threshold, sample count
```

Backend flow:
1. `POST /ml/train` → mlController
2. `mlService.train()` → engine selector
3. Z-Score engine fetches features via `featureEngineeringService.getMlFeatures()`
4. Computes means/stds, sets threshold to 95th percentile
5. `mlModelRepository.saveModel()` → DB (increments version, deactivates old model)
6. Returns new model status

#### Step 2: Run Anomaly Detection
Click **"View Anomalies"** button:

```javascript
const response = await detectMl();
// Returns anomalies list with scores
```

Backend flow:
1. `GET /ml/detect` → mlController
2. `mlService.detect()` → loads active model
3. Fetches recent traffic features
4. Scores each window against model (distance from mean)
5. Flags as 'ANOMALY' if score > threshold
6. Returns results with explainability

---

### Workflow 2: Version Control (Manage Snapshots)

#### View Saved Models
In **"Saved Versions"** table (ThreatAnalysis.jsx):
- Lists all trained model snapshots
- Shows version, created date, samples, features, active status

#### Activate Previous Model
Click **"Activate"** on any archived version:

```javascript
const response = await activateMlModel(modelId);
// Switches to that version
// Returns updated status
```

Backend flow:
1. `POST /ml/models/:id/activate` → mlController
2. `mlService.activateModel(id)`
3. `mlModelRepository.activateModel(id)` → deactivates current, activates target
4. Returns activated model record

---

### Workflow 3: Programmatic Model Management

```javascript
const mlService = require('./services/mlService');
const mlModelRepository = require('./models/mlModelRepository');

// Get current status
const status = await mlService.status();
console.log(`Active model: v${status.modelVersion}, trained: ${status.trainedAt}`);

// List all versions
const allModels = await mlService.listModels();
console.log(`Saved models: ${allModels.length}`);

// Train new model
const trainResult = await mlService.train({
  windowMs: 3600000,      // 1 hour training window
  observationMs: 10000
});

if (trainResult.trained) {
  console.log(`New model trained: v${trainResult.modelVersion}`);
}

// Run detection
const detectResult = await mlService.detect({
  windowMs: 60000,
  ip: '192.168.1.100'
});

detectResult.results.forEach(r => {
  console.log(`IP ${r.ip}: score=${r.anomaly_score}, label=${r.ml_label}`);
});

// Rollback to previous version
const oldModel = allModels[allModels.length - 2];
if (oldModel) {
  const activated = await mlService.activateModel(oldModel.id);
  console.log(`Activated: v${activated.model_version}`);
}

// Cleanup old models (keep only 5)
const deleted = await mlModelRepository.pruneOldModels(5, 'zscore');
console.log(`Deleted ${deleted} old models`);
```

---

## Configuration

### Environment Variables

```bash
# ML Engine Selection
ML_ENGINE=zscore              # Options: zscore, isolation-forest, external
ML_SERVICE_URL=               # Optional: URL to external ML service

# Feature Engineering
# (in server/src/config/config.js)
WINDOW_SIZE_MS=60000          # Time window for features
OBSERVATION_MS=10000          # Recent vs baseline split

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=api_threat_db
DB_USER=postgres
DB_PASSWORD=***
```

### Runtime Settings

```javascript
// In server startup (server.js)
const modelData = await mlModelRepository.loadLatestModel('zscore');
if (modelData) {
  mlService.loadModel(modelData);  // Restores on server restart
}
```

---

## Troubleshooting

### Model Won't Train
**Issue:** `{ trained: false, reason: "Insufficient training data" }`

**Solution:**
- Generate traffic for at least 50-100 windows (default MIN_TRAINING_SAMPLES)
- Increase `windowMs` parameter to capture more historical data
- Check that traffic is being logged to `api_logs` table

```sql
SELECT COUNT(*) FROM api_logs WHERE user_id = 1;
```

### Detection Returns Empty
**Issue:** No anomalies detected even though model is trained

**Possible causes:**
- Model threshold too high → reduce `windowMs` during training
- No recent traffic → check live traffic is being logged
- All traffic is normal → detection is working correctly!

### Model Doesn't Persist After Server Restart
**Issue:** Model reverts to untrained state

**Solution:**
- Check `ml_model` table has records:
  ```sql
  SELECT * FROM ml_model ORDER BY created_at DESC LIMIT 1;
  ```
- Check server startup logs for model loading errors
- Verify `loadMlModel()` is called in `server.js` startup

---

## Performance Tuning

### Training Speed

| Parameter | Impact | Recommendation |
|-----------|--------|-----------------|
| `windowMs` | Larger = more data to analyze | 300,000 ms (5 min) for quick tests |
| `observationMs` | Larger = more baseline | 10,000 ms (10 sec) default |
| Min samples | More samples = better threshold | 50-100 minimum |

### Detection Latency
- Z-Score: < 10 ms per request
- Isolation Forest (external): 50-500 ms depending on service

### Database Size
- Each model = ~10-50 KB (depends on feature count)
- Prune old models to stay under 50 MB

---

## API Security Notes

- All `/ml/*` endpoints require authentication via JWT token
- Z-Score models are tenant-aware (filtered by `userId`)
- External ML service can be behind firewall; only POST/GET allowed

---

## Next Steps

1. **Start simple:** Train a model with 1 hour of traffic
2. **Test detection:** Click "View Anomalies" to verify scoring
3. **Evaluate threshold:** Adjust via feature engineering (mean/std)
4. **Version control:** Save snapshots before major config changes
5. **Integrate:** Use `mlService.scoreIpWindow()` in real-time threat rules

