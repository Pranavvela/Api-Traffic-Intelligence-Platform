# Traffic Simulator: Modes Explained

## Quick Answer
**External API testing is orthogonal to `:safe` modes.**

- **`:safe` scripts** control **traffic intensity** (how aggressively to test)
- **External API support** controls **which API types** can be tested

You can combine them: `npm run normal:safe` with external APIs = safe testing of external APIs.

---

## The :safe Scripts (Traffic Intensity)

### npm run normal:safe
```bash
cross-env SAFE_MODE=true ALLOW_WRITE_NORMAL=false ENABLE_RUSH_HOUR=false node run.js normal
```

**What it does:**
- ✅ Limits concurrent requests (`MAX_IN_FLIGHT=8` in safe mode)
- ✅ Disables POST/PUT/PATCH operations on internal APIs
- ✅ Disables rush hour spikes (prevents sudden traffic bursts)
- ✅ Paces requests conservatively (120ms between requests)

**Use case:** Testing detection rules without overloading the system during development

---

### npm run attack:safe
```bash
cross-env SAFE_MODE=true ENABLE_BRUTE_FORCE=true ATTACK_SCALE=2 ATTACK_PACING_MS=80 node run.js attack
```

**What it does:**
- ✅ Sets `SAFE_MODE=true` (limits in-flight requests to 8)
- ✅ **Enables brute-force attacks** (despite safe mode)
- ✅ Scales attacks to 2x base intensity (20 requests instead of 10)
- ✅ Paces attacks at 80ms (slightly faster than normal safe)

**Use case:** Safely test attack detection without overloading the system, but still generate meaningful threat patterns

---

## External API Support (API Type)

What I fixed:

| Feature | Before | After |
|---------|--------|-------|
| API types supported | INTERNAL only | INTERNAL + EXTERNAL |
| Request routing | All through `/proxy/` | INTERNAL via proxy, EXTERNAL direct |
| Use case | Internal API testing | Internal + external dependencies |

**This is independent of `:safe` modes.**

You can:
- ✅ Run `npm run normal` (uses SAFE_MODE=true by default) with external APIs
- ✅ Run `npm run normal:safe` with external APIs  
- ✅ Run `npm run attack:safe` with external APIs
- ✅ Run any mode with any mix of internal/external APIs

---

## Configuration Comparison

### SAFE_MODE Behavior

**SAFE_MODE=true (default, `:safe` scripts):**
```javascript
const MAX_IN_FLIGHT = 8;              // Limit concurrent requests
const ENABLE_BRUTE_FORCE = false;     // No brute-force by default
const ATTACK_SCALE = 1;               // Attacks at 1x intensity
const ATTACK_PACING_MS = 120;         // 120ms between attack requests
```

**SAFE_MODE=false (stress testing):**
```javascript
const MAX_IN_FLIGHT = 40;             // Allow many concurrent requests
const ENABLE_BRUTE_FORCE = true;      // Brute-force enabled
const ATTACK_SCALE = 2;               // Attacks at 2x intensity
const ATTACK_PACING_MS = 50;          // 50ms between requests
```

### External API Routing (New Feature)

**INTERNAL API:**
```
Simulator → Backend Proxy (/proxy/...) → Internal Endpoint
Headers: X-Forwarded-For, Authorization token
Logged: Yes
```

**EXTERNAL API:**
```
Simulator → External Endpoint (direct)
Headers: Basic simulator headers only
Logged: Limited (external, not logged by backend)
```

---

## Available Scripts

| Script | SAFE_MODE | Write Ops | Rush Hour | Brute Force | Best For |
|--------|-----------|-----------|-----------|-------------|----------|
| `npm run normal` | true | false | false | false | Default normal traffic |
| `npm run normal:safe` | true | false | false | false | Same as above (explicit) |
| `npm run attack` | true | — | — | false | Default attack traffic |
| `npm run attack:safe` | true | — | — | **true** | Safe but realistic attacks |
| `npm run mixed` | true | false | false | false | Both traffic types |
| `npm run mixed:safe` | true | false | false | false | Both types, no spike |
| `npm run mixed:stress` | **false** | true | true | true | Load testing, not safe |

---

## Use Cases: When to Use What?

### During Development
Use **`:safe` scripts** with **internal APIs only**
```bash
npm run normal:safe    # Conservative traffic
npm run attack:safe    # Controlled attacks
```

### Testing Attack Detection
Use **`:safe` scripts** with **internal + external APIs**
```bash
npm run attack:safe    # Brute-force enabled, still safe
```
Register external APIs, let simulator test them too.

### Stress Testing / CI
Use **`:stress` scripts** with **production APIs only**
```bash
npm run mixed:stress   # Full load, unrestricted
```
Only in isolated environments.

### Third-Party Integration Testing
Register external APIs → Run any simulator mode
```bash
npm run normal      # Tests GitHub API, internal APIs, etc.
npm run attack:safe # Attacks against all API types
```

---

## The Key Difference

```
┌─────────────────────────┐
│  :safe scripts          │  ← Controls TRAFFIC INTENSITY
│  (traffic intensity)    │    • Concurrent requests
├─────────────────────────┤    • Request pacing
│  External API support   │    • Brute-force enabled?
│  (API types)            │    • Attack scale
└─────────────────────────┘
                ↓
         Independent features
         Can be combined freely
```

**Example:**
- Register 5 internal APIs + 3 external APIs
- Run `npm run normal:safe`
- Result: Conservative traffic to all 8 APIs simultaneously

---

## Configuration Examples

### Scenario 1: Test internal APIs only, conservatively
```bash
npm run normal:safe
# Simulates normal traffic on INTERNAL APIs only
# Uses SAFE_MODE=true
```

### Scenario 2: Test internal + external APIs, conservatively
```bash
# Register external APIs in UI first, then:
npm run normal:safe
# Simulates normal traffic on both INTERNAL and EXTERNAL APIs
# Still uses SAFE_MODE=true (safe)
```

### Scenario 3: Stress test everything
```bash
# Register both types, then:
npm run mixed:stress
# SAFE_MODE=false, aggressive traffic to all API types
# Only in isolated test environments!
```

---

## Summary

| Aspect | :safe Scripts | External API Support |
|--------|---------------|--------------------|
| Controls | Traffic intensity | API type routing |
| Sets | MAX_IN_FLIGHT, ATTACK_SCALE, PACING | INTERNAL vs EXTERNAL request handling |
| Orthogonal? | Yes, independent features |
| Combinable? | Yes, use together freely |
| Default SAFE_MODE | true (conservative) | true (conservative) |

**TL;DR:** External APIs work with all simulator modes. The `:safe` suffix just means "gentle load and pacing". Register external APIs and run any mode—they'll be tested appropriately.
