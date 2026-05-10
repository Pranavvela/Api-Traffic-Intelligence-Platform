#!/usr/bin/env python3
"""
generate_ml_report.py

Pull ML metrics from the Postgres DB and produce a comparison table (CSV + PNG).

Usage examples (Colab or local):

Set env vars or pass params interactively when prompted:
PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD

Run:
python generate_ml_report.py --email pranavvela14@gmail.com --days 7 --out report.csv --png report.png

If `ml_model_metrics` has rows, it will use them. Otherwise it computes metrics from
`ml_detection_results` for the user/time-range.
"""

import os
import argparse
import datetime as dt
import pandas as pd
import matplotlib.pyplot as plt
import psycopg2
from psycopg2.extras import RealDictCursor


def get_conn_from_env():
    return psycopg2.connect(
        host=os.environ.get('PGHOST', 'localhost'),
        port=int(os.environ.get('PGPORT', 5433)),
        dbname=os.environ.get('PGDATABASE', 'api_traffic_db'),
        user=os.environ.get('PGUSER', 'postgres'),
        password=os.environ.get('PGPASSWORD', '1234567890'),
    )


def fetch_metrics(conn, user_id, start_ts, end_ts):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT model_name, accuracy, precision, recall, f1_score, total_samples, calculated_at
            FROM ml_model_metrics
            WHERE user_id = %s AND calculated_at >= %s AND calculated_at <= %s
            ORDER BY calculated_at DESC
            """,
            (user_id, start_ts, end_ts),
        )
        rows = cur.fetchall()
    return pd.DataFrame(rows)


def fetch_metrics_all_time(conn, user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT model_name, accuracy, precision, recall, f1_score, total_samples, calculated_at
            FROM ml_model_metrics
            WHERE user_id = %s
            ORDER BY calculated_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return pd.DataFrame(rows)


def fetch_detection_rows_all_time(conn, user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT y_true, y_pred, anomaly_score, zscore_score, isolation_forest_score, created_at
            FROM ml_detection_results
            WHERE user_id = %s
            ORDER BY created_at ASC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return pd.DataFrame(rows)


def resolve_user_id(conn, user_id=None, email=None):
    if user_id is not None:
        return user_id
    if not email:
        return None

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, email
            FROM users
            WHERE email = %s
            LIMIT 1
            """,
            (email,),
        )
        row = cur.fetchone()

    if row:
        return row['id']
    return None


def compute_from_detection_results(conn, user_id, start_ts, end_ts):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT y_true, y_pred
            FROM ml_detection_results
            WHERE user_id = %s AND created_at >= %s AND created_at <= %s
            """,
            (user_id, start_ts, end_ts),
        )
        rows = cur.fetchall()

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    tp = int(((df.y_true == 1) & (df.y_pred == 1)).sum())
    fp = int(((df.y_true == 0) & (df.y_pred == 1)).sum())
    fn = int(((df.y_true == 1) & (df.y_pred == 0)).sum())
    tn = int(((df.y_true == 0) & (df.y_pred == 0)).sum())
    total = tp + fp + fn + tn

    def safe_div(a, b):
        return float(a) / float(b) if b else None

    accuracy = safe_div(tp + tn, total)
    precision = safe_div(tp, tp + fp)
    recall = safe_div(tp, tp + fn)
    if precision is None or recall is None or (precision + recall) == 0:
        f1 = None
    else:
        f1 = 2 * (precision * recall) / (precision + recall)

    out = pd.DataFrame([{
        'model_name': 'current_model',
        'accuracy': round(accuracy * 100, 2) if accuracy is not None else None,
        'precision': round(precision * 100, 2) if precision is not None else None,
        'recall': round(recall * 100, 2) if recall is not None else None,
        'f1_score': round(f1 * 100, 2) if f1 is not None else None,
        'total_samples': total,
    }])
    return out


def compute_from_detection_results_all_time(conn, user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT y_true, y_pred
            FROM ml_detection_results
            WHERE user_id = %s
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    tp = int(((df.y_true == 1) & (df.y_pred == 1)).sum())
    fp = int(((df.y_true == 0) & (df.y_pred == 1)).sum())
    fn = int(((df.y_true == 1) & (df.y_pred == 0)).sum())
    tn = int(((df.y_true == 0) & (df.y_pred == 0)).sum())
    total = tp + fp + fn + tn

    def safe_div(a, b):
        return float(a) / float(b) if b else None

    accuracy = safe_div(tp + tn, total)
    precision = safe_div(tp, tp + fp)
    recall = safe_div(tp, tp + fn)
    if precision is None or recall is None or (precision + recall) == 0:
        f1 = None
    else:
        f1 = 2 * (precision * recall) / (precision + recall)

    return pd.DataFrame([{
        'model_name': 'current_model',
        'accuracy': round(accuracy * 100, 2) if accuracy is not None else None,
        'precision': round(precision * 100, 2) if precision is not None else None,
        'recall': round(recall * 100, 2) if recall is not None else None,
        'f1_score': round(f1 * 100, 2) if f1 is not None else None,
        'total_samples': total,
    }])


def compute_metrics_from_predictions(y_true, y_pred):
    y_true = pd.Series(y_true).fillna(0).astype(int)
    y_pred = pd.Series(y_pred).fillna(0).astype(int)
    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())
    tn = int(((y_true == 0) & (y_pred == 0)).sum())
    total = tp + fp + fn + tn

    def safe_div(a, b):
        return float(a) / float(b) if b else None

    accuracy = safe_div(tp + tn, total)
    precision = safe_div(tp, tp + fp)
    recall = safe_div(tp, tp + fn)
    f1 = None if precision is None or recall is None or (precision + recall) == 0 else 2 * (precision * recall) / (precision + recall)

    return {
        'accuracy': round(accuracy * 100, 2) if accuracy is not None else None,
        'precision': round(precision * 100, 2) if precision is not None else None,
        'recall': round(recall * 100, 2) if recall is not None else None,
        'f1_score': round(f1 * 100, 2) if f1 is not None else None,
        'total_samples': total,
    }


def build_model_benchmark_from_detections(conn, user_id):
    df = fetch_detection_rows_all_time(conn, user_id)
    if df.empty:
        return pd.DataFrame()

    rows = []

    rows.append({
        'model_name': 'Ensemble (Current Model)',
        **compute_metrics_from_predictions(df['y_true'], df['y_pred']),
    })

    for column_name, label in [
        ('zscore_score', 'Z-Score'),
        ('isolation_forest_score', 'Isolation Forest'),
    ]:
        score_series = pd.to_numeric(df[column_name], errors='coerce').dropna()
        if score_series.empty:
            continue

        threshold = float(score_series.quantile(0.95))
        predicted = (pd.to_numeric(df[column_name], errors='coerce').fillna(0) >= threshold).astype(int)
        rows.append({
            'model_name': label,
            **compute_metrics_from_predictions(df['y_true'], predicted),
        })

    result = pd.DataFrame(rows)
    if not result.empty:
        result = result.sort_values(by=['accuracy', 'f1_score'], ascending=False, na_position='last').reset_index(drop=True)
    return result


def render_table(df, png_path=None):
    # format percentages
    display_df = df.copy()
    for col in ['accuracy', 'precision', 'recall', 'f1_score']:
        if col in display_df.columns:
            display_df[col] = display_df[col].apply(lambda v: f"{v:.2f}" if pd.notnull(v) else '')

    if png_path:
        fig, ax = plt.subplots(figsize=(10, max(1, 0.5 * len(display_df) + 1)))
        ax.axis('off')
        tbl = ax.table(cellText=display_df.values, colLabels=display_df.columns, cellLoc='center', loc='center')
        tbl.auto_set_font_size(False)
        tbl.set_fontsize(10)
        tbl.scale(1, 1.5)
        plt.tight_layout()
        plt.savefig(png_path, dpi=200)
        print(f'Wrote {png_path}')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--user-id', type=int, default=None)
    parser.add_argument('--email', type=str, default=None)
    parser.add_argument('--days', type=int, default=7)
    parser.add_argument('--start', type=str, default=None)
    parser.add_argument('--end', type=str, default=None)
    parser.add_argument('--out', type=str, default='ml_report.csv')
    parser.add_argument('--png', type=str, default='ml_report.png')
    args = parser.parse_args()

    end_ts = dt.datetime.utcnow() if args.end is None else dt.datetime.fromisoformat(args.end)
    start_ts = end_ts - dt.timedelta(days=args.days) if args.start is None else dt.datetime.fromisoformat(args.start)

    conn = get_conn_from_env()
    try:
        resolved_user_id = resolve_user_id(conn, args.user_id, args.email)
        if resolved_user_id is None:
            print('Could not resolve a user id. Pass --user-id or --email.')
            return

        label = args.email or f'user_id={resolved_user_id}'
        print(f'Generating ML report for {label}...')

        df = fetch_metrics(conn, resolved_user_id, start_ts, end_ts)
        if df.empty:
            print('No rows in ml_model_metrics for user/time-range, computing from ml_detection_results...')
            df = compute_from_detection_results(conn, resolved_user_id, start_ts, end_ts)

        if df.empty:
            print('No rows in the selected time range; falling back to all-time data for this user...')
            df = fetch_metrics_all_time(conn, resolved_user_id)
            if df.empty:
                df = build_model_benchmark_from_detections(conn, resolved_user_id)

        if df.empty:
            print('No ML data found for the specified user/time-range.')
            return

        # normalize column names and percentages
        df = df.rename(columns={'f1_score': 'f1_score'})
        # Ensure numeric and convert fractions (if stored 0..1) to percentages
        for col in ['accuracy', 'precision', 'recall', 'f1_score']:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                # If values look like 0..1, convert to percent
                if df[col].max(skipna=True) <= 1.01:
                    df[col] = df[col] * 100

        df_out = df[['model_name', 'accuracy', 'precision', 'recall', 'f1_score', 'total_samples']] if 'model_name' in df.columns else df
        df_out.to_csv(args.out, index=False)
        print(f'Wrote CSV to {args.out}')

        render_table(df_out, args.png)
    finally:
        conn.close()


if __name__ == '__main__':
    main()
