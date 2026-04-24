# External API Testing Guide

## Overview
The traffic simulator now supports testing both **INTERNAL** and **EXTERNAL** APIs.

## What Changed
- ✅ Normal traffic simulator now tests external APIs
- ✅ Attack traffic simulator now tests external APIs  
- ✅ Proper request handling: Internal APIs go through `/proxy/`, External APIs request directly
- ✅ API type map ensures correct routing for each endpoint

## How to Test External APIs

### Step 1: Register an External API
1. Go to **API Management** page
2. Fill in the form:
   - **Endpoint**: Full URL (e.g., `https://api.github.com/users`)
   - **Method**: Choose `GET`, `POST`, etc.
   - **Type**: Select **EXTERNAL**
   - **Threshold**: Set monitoring threshold
3. Click **Register**

### Step 2: Validate the API
1. Click **Validate** on the registered API
2. The system will make a test request to verify connectivity
3. Look for **VALID** status (any response < 500 is valid)

### Step 3: Run Traffic Simulator
```bash
# Normal traffic (includes external APIs)
npm run simulate:normal

# Attack traffic (includes external APIs)
npm run simulate:attack

# Mixed mode
npm run simulate:mixed
```

The simulator will now:
- Test internal endpoints via the proxy (`/proxy/...`)
- Test external endpoints directly (no proxy)
- Show counts of both internal and external APIs being tested

## Example External APIs to Register

### GitHub API
- **Endpoint**: `https://api.github.com/users`
- **Method**: `GET`
- **Type**: `EXTERNAL`

### JSONPlaceholder (Test API)
- **Endpoint**: `https://jsonplaceholder.typicode.com/users`
- **Method**: `GET`
- **Type**: `EXTERNAL`

### OpenWeather API
- **Endpoint**: `https://api.openweathermap.org/data/2.5/weather`
- **Method**: `GET`
- **Type**: `EXTERNAL`

## How It Works

### Request Routing
**Internal APIs** (`api_type = 'INTERNAL'`):
```
Client → Simulator → Backend Proxy (`/proxy/...`) → Internal Endpoint
```
- Headers: `X-Forwarded-For`, `Authorization` token
- Request logged and monitored by backend

**External APIs** (`api_type = 'EXTERNAL'`):
```
Client → Simulator → External Endpoint (direct)
```
- No proxy, direct HTTP(S) request
- Basic simulator headers only
- Useful for testing API dependencies and third-party integrations

### Simulator Configuration
Environment variables in `traffic-simulator/.env`:

```env
# Test against external APIs
API_URL=http://localhost:4000
USERS=12              # Concurrent users
SAFE_MODE=true        # Prevents rate-limit violations
ALLOW_WRITE_NORMAL=false  # Disable write ops in normal traffic
ENABLE_BRUTE_FORCE=false  # Disable brute-force attacks by default
```

## Monitoring External API Tests

After running the simulator:
1. Check **Dashboard** for traffic patterns
2. View **Logs** to see external API requests
3. Check **Alerts** for any anomalies detected
4. Review **Threat Analysis** for ML-based insights

## Troubleshooting

### External API requests failing?
- ✅ Verify the endpoint is reachable (test in browser or curl)
- ✅ Check network connectivity from the server
- ✅ Validate URL format (must be full `https://...` URL)
- ✅ Some APIs may have CORS restrictions or rate limits

### Simulator not finding APIs?
- ✅ Ensure APIs are registered and `is_active = true`
- ✅ Check `validation_status` is `VALID`, not `INVALID`
- ✅ Mix of internal and external APIs is supported

### Want to exclude external APIs from testing?
Edit `traffic-simulator/.env` and add patterns:
```env
EXCLUDED_ENDPOINT_PATTERNS=/api/auth/register,https://api.external.com
```

## API Type Behavior Matrix

| Feature | INTERNAL | EXTERNAL |
|---------|----------|----------|
| Request routing | Via `/proxy/` | Direct |
| Headers | `X-Forwarded-For`, Auth | Minimal |
| IP spoofing | Supported | N/A |
| Throttling detection | Yes | Limited |
| Third-party rate limits | Not applicable | Must respect |

---

**Updated**: Traffic simulator fully supports external API testing alongside internal APIs.
