#!/usr/bin/env python3
import os, psycopg2

for line in open('server/.env'):
    if '=' in line and not line.startswith('#'):
        k, v = line.strip().split('=', 1)
        os.environ[k.strip()] = v.strip().strip('"').strip("'")

conn_string = os.getenv('DB_URL') or f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'api_traffic')}"
conn = psycopg2.connect(conn_string)
cur = conn.cursor()

# Reassign all GET endpoints (safe) to user 999
cur.execute("""
    UPDATE registered_apis
    SET user_id = 999
    WHERE is_active = true
    AND method IN ('GET', 'POST')
    AND (
        endpoint NOT LIKE '%/auth%'
        AND endpoint NOT LIKE '%login%'
        AND endpoint NOT LIKE '%password%'
    );
""")
count = cur.rowcount
conn.commit()
print(f'✅ Reassigned {count} safe APIs to user_id=999')

# Verify
cur.execute('SELECT COUNT(*) FROM registered_apis WHERE user_id = 999 AND is_active = true;')
total = cur.fetchone()[0]
print(f'✅ User 999 now has {total} active APIs')

conn.close()
