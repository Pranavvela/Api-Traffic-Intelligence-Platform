#!/usr/bin/env python3
import os, psycopg2

for line in open('server/.env'):
    if '=' in line and not line.startswith('#'):
        k, v = line.strip().split('=', 1)
        os.environ[k.strip()] = v.strip().strip('"').strip("'")

conn_string = os.getenv('DB_URL') or f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'api_traffic')}"
conn = psycopg2.connect(conn_string)
cur = conn.cursor()

print('User_id distribution:')
cur.execute('SELECT user_id, COUNT(*) FROM registered_apis GROUP BY user_id ORDER BY COUNT(*) DESC;')
for row in cur.fetchall():
    uid = row[0] if row[0] else 'NULL'
    print(f'  user_id {uid}: {row[1]} APIs')

print('\nSample APIs for user 999:')
cur.execute('SELECT id, endpoint, method FROM registered_apis WHERE user_id = 999 LIMIT 5;')
for row in cur.fetchall():
    print(f'  {row[0]}: {row[1]} ({row[2]})')

conn.close()
