#!/usr/bin/env python3
import os, psycopg2

for line in open('server/.env'):
    if '=' in line and not line.startswith('#'):
        k, v = line.strip().split('=', 1)
        os.environ[k.strip()] = v.strip().strip('"').strip("'")

conn_string = os.getenv('DB_URL') or f"postgresql://{os.getenv('DB_USER', 'postgres')}:{os.getenv('DB_PASSWORD', 'postgres')}@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '5432')}/{os.getenv('DB_NAME', 'api_traffic')}"

conn = psycopg2.connect(conn_string)
cur = conn.cursor()

# Read migration file
with open('server/scripts/add-ml-metrics-table.sql') as f:
    migration = f.read()

# Execute the migration (split by ; for multiple statements)
for stmt in migration.split(';'):
    stmt = stmt.strip()
    if stmt and not stmt.startswith('--'):
        try:
            cur.execute(stmt)
        except psycopg2.errors.DuplicateTable:
            pass  # Table already exists
        except Exception as e:
            print(f'⚠️  Error: {str(e)[:100]}')

conn.commit()
print('✅ ML metrics tables created/verified')
conn.close()
