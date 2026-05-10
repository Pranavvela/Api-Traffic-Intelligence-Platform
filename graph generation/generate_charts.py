#!/usr/bin/env python3
"""
Generate key charts from the project's Postgres DB and save to output/.
Run: python "graph generation/generate_charts.py"
"""
import os
import sys
from pathlib import Path
import argparse
import pandas as pd
from sqlalchemy import create_engine
import plotly.express as px
import plotly.io as pio
from sklearn.metrics import confusion_matrix, roc_curve, auc, precision_recall_curve, average_precision_score
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / 'output'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_project_env_files():
    # Load without overriding shell-exported variables.
    candidates = [
        ROOT.parent / 'server' / '.env',
        ROOT.parent / '.env',
        ROOT / '.env',
    ]
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path, override=False)


def get_db_url_from_env():
    load_project_env_files()

    db_url = os.getenv('DB_URL')
    if db_url:
        return db_url

    database_url = os.getenv('DATABASE_URL')
    if database_url:
        return database_url

    user = os.getenv('DB_USER') or os.getenv('PG_USER', 'postgres')
    pwd = os.getenv('DB_PASSWORD') or os.getenv('PG_PASS', 'postgres')
    host = os.getenv('DB_HOST') or os.getenv('PG_HOST', 'localhost')
    port = os.getenv('DB_PORT') or os.getenv('PG_PORT', '5432')
    db = os.getenv('DB_NAME') or os.getenv('PG_DB', 'api_traffic')
    return f'postgresql://{user}:{pwd}@{host}:{port}/{db}'


def create_engine_from_env():
    url = get_db_url_from_env()
    try:
        engine = create_engine(url, connect_args={'connect_timeout': 5})
        return engine
    except Exception as exc:
        print('Could not create DB engine:', exc)
        sys.exit(1)


def run_sql(engine, query, params=None):
    return pd.read_sql_query(query, con=engine, params=params)


def save_fig(fig, name_base):
    html_path = OUTPUT_DIR / f"{name_base}.html"
    fig.write_html(str(html_path), include_plotlyjs='cdn')
    print('Saved', html_path)
    # try to save PNG if kaleido present
    try:
        png_path = OUTPUT_DIR / f"{name_base}.png"
        fig.write_image(str(png_path))
        print('Saved', png_path)
    except Exception:
        pass


def rpm_chart(engine):
    query = """
    SELECT date_trunc('minute', timestamp) AS minute, count(*) AS requests
    FROM api_logs
    WHERE timestamp >= now() - interval '60 minutes'
    GROUP BY minute ORDER BY minute ASC;
    """
    df = run_sql(engine, query)
    if df.empty:
        print('RPM query returned no rows')
        return
    df['minute'] = pd.to_datetime(df['minute'])
    fig = px.line(df, x='minute', y='requests', title='Requests per Minute (last 60m)')
    save_fig(fig, 'rpm_60m')


def alerts_by_rule_chart(engine):
    query = """
    SELECT rule_triggered, count(*) AS cnt
    FROM alerts
    WHERE timestamp >= now() - interval '24 hours'
    GROUP BY rule_triggered ORDER BY cnt DESC LIMIT 50;
    """
    df = run_sql(engine, query)
    if df.empty:
        print('Alerts query returned no rows')
        return
    fig = px.bar(df, x='rule_triggered', y='cnt', title='Alerts by Rule (24h)')
    fig.update_layout(xaxis={'categoryorder':'total descending'})
    save_fig(fig, 'alerts_by_rule_24h')


def top_ips_chart(engine):
    query = """
    SELECT ip, count(*) AS requests
    FROM api_logs
    WHERE timestamp >= now() - interval '5 minutes'
    GROUP BY ip ORDER BY requests DESC LIMIT 20;
    """
    df = run_sql(engine, query)
    if df.empty:
        print('Top IPs query returned no rows')
        return
    fig = px.bar(df, x='ip', y='requests', title='Top IPs (last 5m)')
    fig.update_layout(xaxis_tickangle=-45)
    save_fig(fig, 'top_ips_5m')


def anomaly_dist_chart(engine):
    query = """
    SELECT anomaly_score, timestamp
    FROM api_logs
    WHERE anomaly_score IS NOT NULL
    AND timestamp >= now() - interval '7 days'
    LIMIT 200000;
    """
    df = run_sql(engine, query)
    if df.empty:
        print('Anomaly score query returned no rows')
        return
    fig = px.histogram(df, x='anomaly_score', nbins=80, title='Anomaly Score Distribution (7d)')
    save_fig(fig, 'anomaly_score_dist_7d')


def ml_performance_charts(engine):
    query = """
    SELECT y_true, anomaly_score as y_score, y_pred FROM ml_detection_results WHERE created_at >= now() - interval '7 days' LIMIT 200000;
    """
    try:
        df = run_sql(engine, query)
    except Exception:
        print('ml_detection_results table not found or query failed; skipping ML performance charts')
        return
    if df.empty:
        print('No ML detection rows; skipping ML performance charts')
        return
    y_true = df['y_true'].astype(int).values
    y_score = df['y_score'].astype(float).values
    y_pred = df['y_pred'].astype(int).values
    
    # Compute metrics
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
    accuracy = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, zero_division=0)
    recall = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    
    print(f"\n{'='*60}")
    print(f"ML Model Performance Metrics (7-day window)")
    print(f"{'='*60}")
    print(f"  Accuracy:   {accuracy:.4f}")
    print(f"  Precision:  {precision:.4f}")
    print(f"  Recall:     {recall:.4f}")
    print(f"  F1 Score:   {f1:.4f}")
    print(f"  Samples:    {len(y_true):,}")
    print(f"{'='*60}\n")
    
    # Save metrics to output
    metrics_file = OUTPUT_DIR / 'ml_metrics.txt'
    with open(metrics_file, 'w') as f:
        f.write(f"ML Detection Metrics Report\n")
        f.write(f"Generated: {pd.Timestamp.now()}\n")
        f.write(f"Data window: 7 days\n")
        f.write(f"Sample size: {len(y_true):,}\n\n")
        f.write(f"Accuracy:   {accuracy:.4f}\n")
        f.write(f"Precision:  {precision:.4f}\n")
        f.write(f"Recall:     {recall:.4f}\n")
        f.write(f"F1 Score:   {f1:.4f}\n")
    print(f'Saved metrics to {metrics_file}')
    
    # ROC
    fpr, tpr, _ = roc_curve(y_true, y_score)
    roc_auc = auc(fpr, tpr)
    fig = px.area(x=fpr, y=tpr, title=f'ROC Curve - AUC={roc_auc:.4f} | Accuracy={accuracy:.4f}', labels={'x':'False Positive Rate','y':'True Positive Rate'})
    save_fig(fig, 'roc_curve')
    
    # PR
    precision_vals, recall_vals, _ = precision_recall_curve(y_true, y_score)
    ap = average_precision_score(y_true, y_score)
    fig2 = px.area(x=recall_vals, y=precision_vals, title=f'Precision-Recall - AP={ap:.4f} | F1={f1:.4f}', labels={'x':'Recall','y':'Precision'})
    save_fig(fig2, 'pr_curve')
    
    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    cm_df = pd.DataFrame(cm, index=['Actual Normal','Actual Anomaly'], columns=['Pred Normal','Pred Anomaly'])
    fig3 = px.imshow(cm_df, text_auto=True, color_continuous_scale='Blues', title=f'Confusion Matrix - Accuracy={accuracy:.4f}')
    save_fig(fig3, 'confusion_matrix')
    
    # Score distribution
    fig4 = px.histogram(df, x='y_score', nbins=50, color='y_true', 
                       title='ML Anomaly Score Distribution (Ensemble Engine)',
                       labels={'y_score': 'Anomaly Score', 'y_true': 'Ground Truth (0=Normal, 1=Anomaly)'},
                       barmode='overlay')
    save_fig(fig4, 'ml_score_distribution')


def drift_timeline_chart(engine):
    query = """
    SELECT recorded_at, drift_score, model_name FROM ml_health WHERE recorded_at >= now() - interval '30 days' ORDER BY recorded_at;
    """
    try:
        df = run_sql(engine, query)
    except Exception:
        print('ml_health table not found or query failed; skipping drift timeline')
        return
    if df.empty:
        print('No drift records; skipping drift timeline')
        return
    df['recorded_at'] = pd.to_datetime(df['recorded_at'])
    fig = px.line(df, x='recorded_at', y='drift_score', color='model_name', title='Drift Score Timeline (30d)')
    save_fig(fig, 'drift_timeline_30d')


def main():
    parser = argparse.ArgumentParser(description='Generate charts from DB')
    parser.add_argument('--all', action='store_true', help='Generate all charts')
    parser.add_argument('--output', type=str, default=str(OUTPUT_DIR), help='Output directory')
    args = parser.parse_args()
    engine = create_engine_from_env()
    if args.all:
        rpm_chart(engine)
        alerts_by_rule_chart(engine)
        top_ips_chart(engine)
            # anomaly_dist_chart(engine)
            # ml_performance_charts(engine)
            # drift_timeline_chart(engine)
    else:
        # default: run core operational charts
        rpm_chart(engine)
        alerts_by_rule_chart(engine)
        top_ips_chart(engine)


if __name__ == '__main__':
    main()
