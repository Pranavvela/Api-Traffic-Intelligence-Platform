#!/usr/bin/env python3
"""
Insert a legacy (user_id NULL) registered API so the simulator can find endpoints.
Run from repo root: .venv\Scripts\python.exe scripts/insert_legacy_api.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / 'server' / '.env')

def get_db_url():
    db_url = os.getenv('DB_URL')
    if db_url:
        return db_url
    user = os.getenv('DB_USER', 'postgres')
    pwd = os.getenv('DB_PASSWORD', os.getenv('PG_PASS', 'postgres'))
    host = os.getenv('DB_HOST', 'localhost')
    port = os.getenv('DB_PORT', '5432')
    db = os.getenv('DB_NAME', os.getenv('PG_DB', 'api_traffic'))
    return f'postgresql://{user}:{pwd}@{host}:{port}/{db}'

def main():
    url = get_db_url()
    engine = create_engine(url)
    insert_sql = text("""
    INSERT INTO registered_apis (user_id, endpoint, method, threshold, is_active, api_type, validation_status)
    VALUES (NULL, '/simulator/test', 'POST', 100, true, 'INTERNAL', 'PENDING')
    RETURNING id;
    """)
    with engine.connect() as conn:
        try:
            res = conn.execute(insert_sql)
            new_id = res.scalar()
            print('Inserted registered_api id=', new_id)
        except Exception as e:
            print('Insert failed:', e)

if __name__ == '__main__':
    main()
