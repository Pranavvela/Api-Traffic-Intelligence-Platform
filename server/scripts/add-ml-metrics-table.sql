-- Migration: Add ML detection results table for metrics calculation
-- Run this against your Postgres DB: psql -d api_traffic_db -f add-ml-metrics-table.sql

CREATE TABLE IF NOT EXISTS ml_detection_results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  ip VARCHAR(50),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ground truth label (NORMAL=0, ANOMALY=1)
  y_true SMALLINT NOT NULL,
  
  -- Model output
  anomaly_score FLOAT NOT NULL,           -- Raw score from ensemble
  y_pred SMALLINT NOT NULL,               -- Predicted label (0=NORMAL, 1=ANOMALY)
  
  -- Component scores (for debugging)
  zscore_score FLOAT,
  isolation_forest_score FLOAT,
  ensemble_confidence FLOAT,              -- Confidence level
  
  -- Created when detection runs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ml_results_user_ts 
  ON ml_detection_results(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_results_created 
  ON ml_detection_results(created_at DESC);

-- Summary table for tracking model performance over time
CREATE TABLE IF NOT EXISTS ml_model_metrics (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  model_name VARCHAR(100),
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metrics
  accuracy FLOAT,
  precision FLOAT,
  recall FLOAT,
  f1_score FLOAT,
  roc_auc FLOAT,
  
  -- Samples used
  total_samples INTEGER,
  anomalies_detected INTEGER,
  false_positives INTEGER,
  false_negatives INTEGER,
  true_positives INTEGER,
  true_negatives INTEGER,
  
  CONSTRAINT fk_user_metrics FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ml_metrics_user_ts 
  ON ml_model_metrics(user_id, calculated_at DESC);

GRANT SELECT, INSERT ON ml_detection_results TO postgres;
GRANT SELECT, INSERT ON ml_model_metrics TO postgres;
