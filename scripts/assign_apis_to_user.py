#!/usr/bin/env python3
import os
import psycopg2

# Parse .env
for line in open('server/.env'):
    if '=' in line and not line.startswith('#'):
        k, v = line.strip().split('=', 1)
        os.environ[k.strip()] = v.strip().strip('"').strip("'")

# Connect
conn_string = os.getenv('DB_URL') or f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'api_traffic')}"

conn = psycopg2.connect(conn_string)
cur = conn.cursor()
cur.execute('UPDATE registered_apis SET user_id = 999 WHERE user_id IS NULL;')
count = cur.rowcount
conn.commit()
print(f'✅ Updated {count} APIs to user_id=999')
conn.close()
