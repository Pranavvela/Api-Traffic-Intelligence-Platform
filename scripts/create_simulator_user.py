#!/usr/bin/env python3
import os
import psycopg2

# Parse .env file
env_file = 'server/.env'
for line in open(env_file):
    if '=' in line and not line.startswith('#'):
        k, v = line.strip().split('=', 1)
        os.environ[k.strip()] = v.strip().strip('"').strip("'")

# Connect and create user
conn_string = os.getenv('DB_URL') or f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'api_traffic')}"

try:
    conn = psycopg2.connect(conn_string)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users (id, email, password)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email
        RETURNING id, email;
    """, [999, 'simulator@traffic-intel.local', 'dummy_password'])
    result = cur.fetchone()
    conn.commit()
    print(f'✅ Created/updated user {result[0]}: {result[1]}')
    conn.close()
except Exception as e:
    print(f'❌ Error: {e}')
    exit(1)
