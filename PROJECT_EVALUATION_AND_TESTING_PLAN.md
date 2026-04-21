# API Traffic Intelligence Platform - Project Documentation

## 1. Project Purpose

The API Traffic Intelligence Platform is a full-stack cybersecurity analytics system that monitors API request activity, detects suspicious behavior, and assists analysts in responding to threats.

It is designed to answer four core questions:

1. What is happening across API traffic right now?
2. Is the behavior normal, abusive, or anomalous?
3. Which clients and endpoints are the highest risk?
4. What mitigation actions should be taken next?

The platform combines deterministic security rules with machine learning based anomaly scoring to provide both fast detection and behavioral context.

---

## 2. What The Project Does

At a high level, the system:

1. Ingests API traffic metadata through backend middleware and proxy flows.
2. Stores request and alert data in PostgreSQL for persistence and analysis.
3. Evaluates each request with a rule engine (rate, flood, burst, login-failure patterns).
4. Computes engineered behavioral features and applies ML anomaly scoring.
5. Generates explainable alerts with severity and source attribution.
6. Applies mitigation controls such as blocklist and throttling policies.
7. Exposes a real-time dashboard for monitoring, triage, and configuration.

This enables near real-time threat visibility and operational response without requiring packet-level inspection.

---

## 3. Core Capabilities

### 3.1 Traffic Observability

- Per-request tracking with unique request identifiers.
- Endpoint, method, status, latency, IP, and user-agent metadata capture.
- Historical persistence for trend analysis and auditability.

### 3.2 Rule-Based Threat Detection

The detection pipeline identifies known abuse patterns such as:

- rate limit violations,
- repeated login failures,
- endpoint flooding,
- abrupt burst behavior.

Rules are implemented for explainability and deterministic incident triage.

### 3.3 ML Anomaly Detection

- Uses statistical anomaly scoring (Z-score based) on engineered traffic features.
- Learns baseline behavior from observed data.
- Highlights anomalous requests and contributing features.
- Supports model persistence and operational reuse.

### 3.4 Alerting And Escalation

- Alerts include severity, reason, source (rule/ML), and linkage to request context.
- Deduplication prevents alert storms for repeated events.
- Escalation policies support automatic mitigation for high-risk behavior.

### 3.5 Mitigation Controls

- IP blocking to stop repeated malicious requests.
- Throttling/rate control for abuse suppression.
- Analyst controls to unblock and adjust behavior through the UI.

### 3.6 Analyst Dashboard

The frontend provides:

- live security metrics,
- alert panels and history,
- top attacker and endpoint insights,
- registered API governance,
- blocked IP management,
- platform settings and thresholds.

---

## 4. System Architecture

The platform is organized into three layers.

### 4.1 Client Layer (React)

- Security operations dashboard and management pages.
- Polling-based near real-time updates.
- Role of UI: observability, investigation, and control actions.

### 4.2 API Layer (Node.js/Express)

- Middleware-driven request logging.
- Detection orchestration (rules + ML).
- Alert generation and escalation workflows.
- Management APIs for settings, blocklist, and registered APIs.

### 4.3 Data Layer (PostgreSQL)

- Durable storage for logs, alerts, blocked IPs, settings, user-scoped registry, and model metadata.
- Indexed query paths for dashboard analytics and operational views.

---

## 5. Main Functional Modules

### 5.1 Logging And Ingestion

Captures incoming request metadata and response outcomes, then persists records for downstream analytics.

### 5.2 Detection Engine

Coordinates sliding window state, rule checks, and ML feature extraction/scoring to classify suspicious activity.

### 5.3 Alert Management

Normalizes findings into analyst-readable alerts with severity, timestamps, and traceable context.

### 5.4 Blocklist And Throttling Services

Executes mitigation policies against abusive request sources while supporting analyst override actions.

### 5.5 Settings And Policy Controls

Supports runtime configuration for thresholds, model behavior, and escalation sensitivity.

### 5.6 Registered API Management

Lets analysts define monitored APIs, methods, thresholds, and validation/monitoring status.

---

## 6. Typical Operational Flow

1. A request reaches the backend.
2. Metadata is normalized and logged.
3. Rule engine evaluates immediate abuse patterns.
4. Feature engineering aggregates behavioral context.
5. ML scoring estimates anomaly likelihood.
6. Alerts are generated if criteria are met.
7. Escalation policies may trigger block or throttle actions.
8. Dashboard reflects updated metrics, alerts, and mitigation state.

---

## 7. Security And Governance Value

This project provides practical value for API security operations:

- Faster detection of abusive or anomalous traffic.
- Explainable findings for analyst decisions.
- Reduced manual effort through automated mitigation.
- Persistent evidence for incident review and reporting.
- Configurable controls adaptable to different API environments.

---

## 8. Scope Notes

- The platform focuses on API traffic intelligence, detection, and response workflows.
- It emphasizes analyst visibility and control over black-box automation.
- This document intentionally covers the main platform behavior and excludes simulator-specific workflow details.

---

## 9. Quick Component Map

- Frontend pages: dashboard, threat analysis, API management, blocked IPs, settings, authentication.
- Backend modules: controllers, middleware, routes, services, model repositories.
- Data entities: logs, alerts, blocked IPs, registered APIs, settings, model state, users.

---

## 10. Conclusion

The API Traffic Intelligence Platform is an end-to-end system for API security monitoring and response. It unifies real-time traffic visibility, rule-based and ML-driven threat detection, alert explainability, and mitigation controls in a single operational interface backed by persistent data storage.

It is structured to support both academic demonstration and practical SOC-style API monitoring workflows.
