#!/usr/bin/env python3
import os, psycopg2

for line in open('server/.env'):
    if '=' in line and not line.startswith('#'):
        k, v = line.strip().split('=', 1)
        os.environ[k.strip()] = v.strip().strip('"').strip("'")

conn_string = os.getenv('DB_URL') or f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'api_traffic')}"

conn = psycopg2.connect(conn_string)
cur = conn.cursor()

# Create ml_detection_results table
try:
    cur.execute("""
    CREATE TABLE IF NOT EXISTS ml_detection_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      ip VARCHAR(50),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      y_true SMALLINT NOT NULL,
      anomaly_score FLOAT NOT NULL,
      y_pred SMALLINT NOT NULL,
      
      zscore_score FLOAT,
      isolation_forest_score FLOAT,
      ensemble_confidence FLOAT,
      
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.commit()
    print('✅ Created ml_detection_results table')
except Exception as e:
    conn.rollback()
    print(f'⚠️ ml_detection_results: {str(e)[:80]}')

# Create ml_model_metrics table
try:
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS ml_model_metrics (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      model_name VARCHAR(100),
      calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      accuracy FLOAT,
      precision FLOAT,
      recall FLOAT,
      f1_score FLOAT,
      roc_auc FLOAT,
      
      total_samples INTEGER,
      anomalies_detected INTEGER,
      false_positives INTEGER,
      false_negatives INTEGER,
      true_positives INTEGER,
      true_negatives INTEGER
    );
    """)
    conn.commit()
    print('✅ Created ml_model_metrics table')
except Exception as e:
    conn.rollback()
    print(f'⚠️ ml_model_metrics: {str(e)[:80]}')

conn.close()
print('✅ Migration complete')
