# User Guide — How to Use the API Traffic Intelligence Platform

A simple guide to monitor your APIs, detect threats, and manage anomaly detection.

---

## 🏠 Dashboard Overview

When you log in, the **Dashboard** shows you a live snapshot of your API traffic:

### Dashboard Cards (Top Section)

| Card | What It Means |
|------|---------------|
| **Threat Level** | High/Medium/Low risk status based on recent alerts and threats |
| **Requests/min (avg 5m)** | Average API requests per minute over last 5 minutes |
| **Requests (60s)** | Total API calls in the last 60 seconds |
| **Unresolved Alerts** | Number of security issues that still need your attention |
| **Threat Score** | Numerical risk score (higher = more dangerous) |
| **Top IP** | The IP address making the most API requests |

### Active Alerts (Top Right)
Large red number showing how many active security threats exist right now.

---

## 📊 Traffic Graph

The graph shows API request volume over time.

**Time Range Buttons (top right):**
- **5m** — Last 5 minutes (most detailed)
- **1h** — Last hour
- **12h** — Last 12 hours
- **24h** — Last full day (shows day/time labels)
- **7d** — Last 7 days
- **1m** — Last 30 days
- **1y** — Last 12 months

**How to read it:**
- X-axis = time
- Y-axis = number of requests
- Orange peak dot = highest traffic point
- Blue line = traffic trend

**Why use it?**
- Spot when traffic spikes (might indicate an attack)
- Identify normal traffic patterns
- See if an IP is behaving unusually

---

## 🚨 Live Alerts Tab

Shows active security threats that need your attention.

**Each alert shows:**
- **IP Address** — Where the threat came from
- **Type** — What rule it triggered (rate limit, brute force, etc.)
- **Severity** — Low/Medium/High/Critical
- **Status** — Active or Resolved
- **Action** — Buttons to resolve or block the IP

**What to do:**
1. Click on an alert to see details
2. **Block IP** — Stop all traffic from that IP
3. **Resolve** — Mark it as handled (doesn't block the IP)

---

## 📋 Recent Logs Tab

Shows the last API requests made to your system.

**Each log shows:**
- **Time** — When the request happened
- **IP** — Where it came from
- **Endpoint** — What API path was accessed
- **Status** — 200 (OK), 400 (error), 403 (blocked), etc.
- **Response Time** — How fast your API responded

**Use this to:**
- Trace what an attacker did
- Debug API performance issues
- Find patterns in traffic

---

## 🎯 Top IPs & Endpoints Tab

### Top IPs Section
Lists the IP addresses making the most requests.

- **Volume column** = how many requests from that IP
- **Block button** = stop all traffic from that IP
- **View button** = see detail history

### Endpoints Section
Lists your API endpoints and which ones get the most traffic.

- Shows which endpoints are most popular
- Helps identify which endpoints might be under attack
- Shows request counts and error rates

---

## 👥 Top Attackers Tab

Shows the most dangerous IP addresses based on:
- Number of security alerts they triggered
- Severity of those alerts
- How recent the activity was
- Frequency of attacks

**What the score means:**
- Higher score = more dangerous
- Score combines: rule violations + severity + frequency
- Use this to prioritize which IPs to block

---

## ✅ Resolved Alerts Tab

Archive of alerts you've already handled.

- Shows past security incidents
- Lets you see what you blocked and when
- Useful for audits and reports

---

## 🛡️ Blocked IPs Page

Complete list of all IP addresses you've manually blocked.

**What you see:**
- **IP Address** — The blocked address
- **Block Date** — When you blocked it
- **Reason** — Why it was blocked
- **Unblock button** — Remove the block if needed

**To block a new IP:**
1. From Dashboard, find the IP in Top IPs section
2. Click "Block"
3. Enter a reason (optional)
4. Confirm

---

## 📋 API Management Page

Register the APIs you want to monitor.

**Why register APIs?**
- Tells the system which endpoints to watch
- Filters out noise from unregistered endpoints
- Helps distinguish normal traffic from attacks

**To add an API:**
1. Click "Add API"
2. Enter:
   - **API Name** — Friendly name (e.g., "User Login API")
   - **Endpoint** — The URL path (e.g., `/api/users/login`)
   - **Method** — GET, POST, PUT, DELETE
   - **Is Active** — Toggle on/off monitoring
3. Click "Save"

**To validate an API:**
- Click "Test" to verify the endpoint is reachable
- Green checkmark = API is responding
- Red X = API is down or unreachable

---

## ⚙️ Settings Page

Configure threat detection rules.

**Rate Limit Threshold**
- How many requests per minute before flagging
- Lower = more sensitive
- Default: 100 requests/min

**Brute Force Threshold**
- How many failed login attempts before blocking
- Lower = stricter security
- Default: 5 failed attempts

**Endpoint Flood Threshold**
- How many requests to one endpoint before flagging
- Lower = more sensitive
- Default: 50 requests

**Burst Multiplier**
- How much traffic spike = "burst attack"
- Default: 2.0x (traffic spike of 2x triggers alert)

**Sliding Window**
- Time period for analyzing traffic patterns
- Default: 10 seconds

**Auto Block**
- Toggle: automatically block IPs that trigger alerts
- ON = block immediately
- OFF = alert only, manual review required

**To change settings:**
1. Adjust sliders/numbers
2. Click "Save"
3. Changes take effect immediately

---

## 🤖 Threat Analysis & ML Models

This is where anomaly detection happens.

### What is ML Anomaly Detection?

The system learns normal traffic patterns, then flags anything that looks abnormal:
- Unusual request volume from an IP
- Strange error rates
- Unexpected endpoint access patterns
- Suspicious timing or sequences

### ML Model Registry (Threat Analysis Page)

#### Current Model Card
Shows which trained model is active:
- **Version** — Model number (v1, v2, etc.)
- **Engine** — Type of AI algorithm (Z-Score, etc.)
- **Status** — Trained or Idle
- **Samples** — How much traffic data it learned from
- **Threshold** — Sensitivity setting

#### Training a Model

**When to train?**
- When you first set up the system
- After major config changes
- If detection isn't working well
- Weekly or monthly for fresh baselines

**Steps:**
1. Click "Train Model" button
2. Wait for training to complete (usually 10-30 seconds)
3. Watch for success message at bottom
4. New model becomes active automatically

**What it learns:**
- Normal request rates per IP
- Normal error rates
- Normal endpoint access patterns
- Normal response times

#### Viewing Anomalies

**To see detected anomalies:**
1. Click "View Anomalies" button
2. See list of suspicious traffic patterns

**Each anomaly shows:**
- **IP** — The suspicious source
- **Anomaly Score** — How unusual (higher = more suspicious)
- **Label** — ANOMALY or NORMAL
- **Features** — What was unusual (high error rate, high volume, etc.)

#### Saved Model Versions

**Why keep old models?**
- Roll back if new model detects too many false positives
- Compare performance over time
- Preserve historical baselines

**To activate an old model:**
1. Find it in the Saved Versions table
2. Click "Activate" button
3. That model becomes active immediately
4. Detection switches to that model's rules

---

## 📊 Alert History & Timeline

View all alerts in time sequence.

**Timeline shows:**
- What alerts happened
- When they happened
- Which IP triggered it
- What endpoint was attacked
- Severity level
- Whether you resolved it

**Use this to:**
- Understand attack patterns
- See if same IP keeps attacking
- Track your response time

---

## Quick Workflow Examples

### Example 1: Block a Suspicious IP

1. **Dashboard** → see Alert in red
2. **Live Alerts tab** → find the IP
3. **Click "Block IP"** → enter reason
4. IP is now blocked → all future requests from it are rejected
5. **Blocked IPs page** → confirm it appears there

### Example 2: Train Anomaly Detection

1. Let traffic run normally for 30+ minutes
2. **Threat Analysis page**
3. Click **"Train Model"** button
4. Wait for success message
5. Click **"View Anomalies"** to test
6. System now flags unusual traffic

### Example 3: Respond to High Threat Score

1. Dashboard shows **Threat Score: 45** (red)
2. Click **"Unresolved Alerts"** card
3. See what triggered it (e.g., rate limit violation)
4. **Threat Analysis page** → check current active IP
5. Either:
   - **Block the IP** if it's an attacker
   - **Adjust settings** if it's a legitimate spike
6. Monitor for next 5 minutes

### Example 4: Find What an Attacker Did

1. **Blocked IPs page** → see IP you blocked
2. **Dashboard** → **Recent Logs tab**
3. Search or scroll for that IP
4. See all requests from that IP:
   - Which endpoints they hit
   - What status codes they got
   - Response times
5. Use this for incident reports

---

## 🔔 Understanding Alert Types

### Rate Limit Violation
- **What it means:** An IP sent too many requests too fast
- **Risk:** Could be DDoS attack or misbehaving client
- **Action:** Block if malicious, adjust settings if legitimate

### Brute Force Attack
- **What it means:** Many failed login attempts from one IP
- **Risk:** Someone trying to guess passwords
- **Action:** Always block these

### Endpoint Flooding
- **What it means:** One endpoint getting hammered
- **Risk:** Targeted attack on specific API
- **Action:** Block IP or rate-limit that endpoint

### ML Anomaly
- **What it means:** Traffic pattern looks very unusual
- **Risk:** New type of attack or misconfigured client
- **Action:** Review context; may need to add new rule

---

## 📈 Key Metrics to Watch

### Health Indicators

| Metric | Good Range | Warning Range | Action |
|--------|-----------|----------------|--------|
| **Threat Level** | Low | Medium | High = investigate |
| **Active Alerts** | 0-5 | 5-20 | 20+ = under attack |
| **Threat Score** | 0-10 | 10-25 | 25+ = respond now |
| **RPM Stable** | Flat line | Slight ups/downs | Sharp spikes = investigate |

### When to Act

- **Green indicators** — Monitor regularly (daily)
- **Yellow indicators** — Check within the hour
- **Red indicators** — Check immediately

---

## 🔒 Best Practices

1. **Check Dashboard daily**
   - Takes 2 minutes
   - Catch issues early

2. **Train models weekly**
   - Keeps detection fresh
   - Adapts to traffic patterns

3. **Review alerts promptly**
   - Don't let them pile up
   - Act within 1 hour if possible

4. **Keep blocked IPs minimal**
   - Review old blocks monthly
   - Unblock if no longer a threat

5. **Adjust settings based on your traffic**
   - If you get false alarms, loosen settings
   - If you're missing attacks, tighten settings

6. **Keep API registry up-to-date**
   - Add new endpoints as you release them
   - Remove old ones
   - Enable/disable as needed

7. **Archive resolved alerts regularly**
   - Keeps dashboard clean
   - Maintains audit trail

---

## ❓ Common Questions

**Q: What's the difference between "Block" and "Resolve"?**
A: Block = stop all traffic from that IP. Resolve = mark alert as handled but don't block the IP. Use Block for attackers, Resolve for false alarms.

**Q: Should I use Auto Block?**
A: For development = OFF (review each alert first). For production = ON (blocks attackers immediately).

**Q: How often should I train the model?**
A: Weekly is good. More often if traffic patterns change, less often if stable.

**Q: What if I block a legitimate IP by mistake?**
A: Go to Blocked IPs page and click "Unblock". No harm done.

**Q: Why did threat score go up suddenly?**
A: Check Recent Logs to see what changed. Could be new IP, new attack type, or misconfigured client.

**Q: Can I see historical data?**
A: Yes - use the time range buttons on the graph (24h, 7d, 1m, 1y). Use Alert History timeline.

**Q: What happens when the ML model detects an anomaly?**
A: It flags it in the Threat Analysis page. If Auto Block is ON and anomaly threshold is set, it may block. Otherwise it just alerts you.

---

## 📞 Troubleshooting

### Dashboard Shows "No Data"
- **Cause:** No traffic logged yet
- **Fix:** Generate some API traffic first, wait 1 minute

### Can't Login
- **Cause:** Wrong email/password or account doesn't exist
- **Fix:** Use "Register" to create account, or reset password

### Alerts Look Fake/Wrong
- **Cause:** Settings too sensitive or unregistered APIs generating noise
- **Fix:** Go to Settings, increase thresholds. Add APIs to registry.

### ML Model Won't Train
- **Cause:** Not enough traffic data
- **Fix:** Generate traffic for 30+ minutes, then try again

### Blocked IP Should Be Unblocked
- **Cause:** False positive
- **Fix:** Go to Blocked IPs page, click Unblock

---

## 📚 Next Steps

1. **Spend 5 minutes on Dashboard** — Get familiar with layout
2. **Generate some test traffic** — See data start appearing
3. **Train your first ML model** — Click "Train Model"
4. **Register your APIs** — Go to API Management
5. **Adjust Settings** — Customize for your environment
6. **Check daily** — Make it part of your routine

