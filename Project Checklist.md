# Smart Campus Anomaly Dashboard — Project Checklist

## Current Status Summary

> **Backend: ✅ Fully implemented and compiling**
> All Go backend code lives under `cmd/server/main.go` + `internal/` (module: `smart-campus-dashboard`).
> The `backend/` directory contains stale stub code from an earlier layout and should be removed.

---

## Remaining Work — In Order

### Phase 1 — Wire frontend to real backend (biggest unlock)
- [x] 1. Build `frontend/src/hooks/useWebSocket.js` — connect, exponential-backoff reconnect, JSON parse, unmount cleanup
- [x] 2. Replace mock simulation in `frontend/src/hooks/useEnergyData.ts` with real `GET /api/readings` fetch
- [x] 3. Wire one live sparkline per building to WebSocket-driven state (kWh, last hour)
- [x] 4. Add anomaly toast/banner that fires on WebSocket payload arrival
- [x] 5. Wire `components/ForecastChart.jsx` to `GET /api/forecast`
- [x] 6. Confirm all three routes render: `/` (Dashboard), `/log` (Event Log), `/report` (Report)

### Phase 2 — Close remaining frontend gaps
- [ ] 7. Event Log: severity filter (low / medium / high)
- [ ] 8. Event Log: inline tag editing → `PATCH /api/anomalies/:id`
- [ ] 9. Event Log: new anomalies appear live via WebSocket (no refresh)
- [ ] 10. Report form: category dropdown (lighting, HVAC, other)
- [ ] 11. Report form: submit button posts to `POST /api/reports`

### Phase 3 — Backend tests
- [ ] 12. Unit tests: z-score, rolling average, threshold logic (incl. out-of-hours + holiday), linear regression
- [ ] 13. `go vet` + `gofmt` clean across the repo
- [ ] 14. End-to-end test: ingestor run → anomaly detected → DB record present
- [ ] 15. API response tests for every REST endpoint
- [ ] 16. Verify zero PII stored after a report submission

### Phase 4 — Critical performance gate (success criterion)
- [ ] 17. Write WebSocket latency load test (spike injection → client receipt)
- [ ] 18. Confirm sub-2-second alert delivery under load — **must pass before Final Audit**

### Phase 5 — Dockerise
- [ ] 19. `backend/Dockerfile` — multi-stage Go builder → Alpine runtime
- [ ] 20. `frontend/Dockerfile` — Vite build served via Nginx
- [ ] 21. `docker-compose.yml` — backend + frontend wired, SQLite volume mounted
- [ ] 22. `docker compose up` brings up the full stack with no extra steps

### Phase 6 — Railway deploy
- [ ] 23. Connect backend service to GitHub repo on Railway
- [ ] 24. Connect frontend service to GitHub repo on Railway
- [ ] 25. Configure persistent SQLite volume on Railway
- [ ] 26. Pipeline green end-to-end (note: original Week 7 target has slipped)
- [ ] 27. Local Docker fallback tested as Final Audit backup

### Phase 7 — Repo hygiene
- [ ] 28. Remove stale `backend/` directory (code lives under root `cmd/` + `internal/`)
- [ ] 29. Branch protection enabled on `main`
- [ ] 30. PR-only workflow with at least one peer review required
- [ ] 31. No committed secrets — confirm all API keys via env vars
- [ ] 32. All commits reference a task ID from the project schedule

### Phase 8 — Final QA sign-off
- [ ] 33. UX review by QA Lead (Mubeen)
- [ ] 34. Marking rubric criteria verified end-to-end
- [ ] 35. Virtual sensor stream validated end-to-end
- [ ] 36. External API integrations (weather + holidays) verified live
- [ ] 37. Scope confirmed — no out-of-scope features included

---

## Backend (Go) — Implementation Details

> **All items below are ✅ implemented, compiling, and working.**
> Source: `cmd/server/main.go`, `internal/{database,models,handlers,workers,ws,integrations}/`

### Database
- [x] `internal/database/schema.sql` — embedded schema with three tables (`readings`, `anomalies`, `reports`)
- [x] `internal/database/database.go` — `InitDB()` opens SQLite, runs embedded schema on startup via `//go:embed`
- [x] `internal/database/migrate.go` — additional `RunMigrations()` helper using `golang-migrate`
- [x] No PII fields exist anywhere in the schema (no name, email, IP)
- [x] Indexes on `readings(building_id, timestamp)`, `reports(building_id, created_at)`, `anomalies(reading_id)`

### Models (`internal/models/models.go`)
- [x] `Reading` struct — ID, BuildingID, Timestamp, KWh, Temperature, CO2PPM
- [x] `Anomaly` struct — ID, ReadingID, DetectedAt, Severity, Tag + JOIN fields (BuildingID, KWh, etc.)
- [x] `Report` struct — ID, BuildingID, CreatedAt, Category, Description
- [x] `AnomalyAlert` struct — Type, Anomaly, Reading (used for WebSocket broadcast payloads)

### Mock IoT Ingestor (`internal/workers/ingestor.go`)
- [x] Cron job runs every 5 minutes (via `robfig/cron/v3`)
- [x] Generates readings for 5 buildings: `library`, `sports-hall`, `main-hall`, `engineering`, `admin`
- [x] Base ranges: kWh 10–200, temperature 18–28°C, CO2 400–1200 ppm
- [x] Occupancy factor of 0.25× applied during out-of-hours and holidays (reduces baselines)
- [x] Injects a kWh spike ~15% of the time (1.5–2.0× multiplier) to trigger anomaly detection
- [x] Writes each reading to the `readings` table
- [x] Seeds an initial batch on startup (goroutine in `main.go`)

### Anomaly Detector (`internal/workers/detector.go`)
- [x] Runs inline after every reading insertion (called from `Ingestor.Run()`)
- [x] Queries last 12 kWh readings per building
- [x] Computes rolling average (mean) for kWh
- [x] Computes z-score: `|value − mean| / stdDev`
- [x] Flags anomaly if z-score > threshold OR value > 150% of rolling average
- [x] Default threshold = 2.5; lowered to 2.0 outside 08:00–18:00 or on public holidays
- [x] Severity classification: z ≥ 4 → "high", z ≥ 3 → "medium", else → "low"
- [x] Tags anomalies: `holiday-spike` if holiday, `out-of-hours` if outside business hours
- [x] Writes anomaly record to `anomalies` table
- [x] Broadcasts `AnomalyAlert` to WebSocket hub immediately after writing

### WebSocket Hub (`internal/ws/hub.go`)
- [x] Maintains registry of all connected `Client` instances
- [x] Upgrades HTTP connection to WebSocket on `GET /ws` via gorilla/websocket
- [x] Channel-based architecture: register, unregister, broadcast channels
- [x] Broadcasts JSON anomaly payloads to all connected clients
- [x] Handles client disconnect gracefully (removes from registry, closes send channel)
- [x] `readPump` / `writePump` goroutines per client for concurrent I/O
- [ ] Alert reaches client within **2 seconds** of detection (needs load test — Phase 4)

### REST Endpoints (`internal/handlers/handlers.go`)
- [x] `GET /api/readings?building=X&limit=N` — returns last N readings (default 60, max 1000), filterable by building
- [x] `GET /api/anomalies?building=X&severity=Y` — returns anomaly log with JOIN on readings, filterable
- [x] `PATCH /api/anomalies?id=X` — updates tag on an anomaly (body: `{"tag": "..."}`)
- [x] `POST /api/reports` — accepts anonymous staff report, validates category + description, **no IP or headers logged**
- [x] `GET /api/forecast?building=X` — linear regression predictions (default building: library)
- [x] `GET /ws` — WebSocket upgrade endpoint
- [x] CORS middleware allowing `*` origin with `GET, POST, PATCH, OPTIONS` methods

### ML Forecasting (in `handlers.go` → `GetForecast`)
- [x] Pulls last 144 readings per building (24 hrs at 5-min intervals)
- [x] Implements linear regression: `x = Unix timestamp`, `y = kWh`
- [x] Computes slope and intercept using least-squares formula
- [x] Returns predictions for next 12 steps (1 hour ahead, 5-min intervals)
- [x] Clamps negative predictions to zero
- [x] Returns RFC3339 timestamps for each prediction
- [x] Implemented in pure Go — no external ML library

### External API Integrations
- [x] `internal/integrations/weather.go` — `WeatherClient` fetches current temperature from Open-Meteo (Guildford coordinates)
- [x] `internal/integrations/holidays.go` — `HolidayClient` fetches UK public holidays from `date.nager.at`
- [x] Both APIs cached server-side per day (in-memory `map[string]` keyed by date string)
- [x] Holiday client caches all holidays for the year in one call
- [x] Thread-safe with `sync.RWMutex`

### Privacy
- [x] `POST /api/reports` does not log `r.RemoteAddr`
- [x] No client headers are stored or logged for any endpoint
- [x] `reports` table has no PII fields at schema level (no name, email, IP)

### Server Entrypoint (`cmd/server/main.go`)
- [x] Initialises SQLite database with schema
- [x] Creates WebSocket hub and starts it in a goroutine
- [x] Creates weather + holiday clients
- [x] Creates ingestor with all dependencies injected
- [x] Seeds initial readings on startup
- [x] Schedules cron job for every 5 minutes
- [x] Registers all HTTP routes on `http.ServeMux`
- [x] CORS middleware wrapping all routes
- [x] Configurable port via `PORT` env var (default: 8080)
- [x] Configurable DB path via `DB_PATH` env var (default: `./data/campus.db`)

---

## Frontend (React)

### App Shell
- [x] Vite + React project scaffolded (TypeScript)
- [x] `react-router-dom` installed and routing configured
- [x] `recharts` installed for charts
- [x] Three routes: `/` (Dashboard), `/log` (Event Log), `/report` (Report)

### WebSocket Hook (`hooks/useWebSocket.js`)
- [x] Connects to backend WebSocket on component mount
- [x] Reconnects automatically with exponential back-off on disconnect
- [x] Parses incoming JSON and dispatches to state/context
- [x] Cleans up connection on unmount

### Dashboard Page (`pages/Dashboard.jsx`)
- [x] KPI card: total kWh today
- [x] KPI card: average CO2 across buildings
- [x] KPI card: out-of-hours usage share (%)
- [x] KPI card: energy use intensity (kWh/m²)
- [x] One live sparkline chart per building (kWh over last hour)
- [x] Sparklines update in real time via WebSocket
- [x] Anomaly toast/banner appears within 2 seconds of a WebSocket alert arriving

### Event Log Page (`pages/EventLog.jsx`)
- [x] Table showing all anomalies: timestamp, building, severity, tag
- [x] Filter by building
- [ ] Filter by severity (low / medium / high)
- [ ] Inline tag editing — sends `PATCH /api/anomalies/:id` to backend
- [ ] New anomalies appear live via WebSocket without page refresh

### Report Page (`pages/Report.jsx`)
- [x] Building selector dropdown
- [ ] Category dropdown (e.g. lighting, HVAC, other)
- [x] Free-text description field
- [ ] Submit button posts to `POST /api/reports`
- [x] No user identifier, login, or session is sent with the request
- [x] Success/error feedback shown after submission

### Forecast Chart (`components/ForecastChart.jsx`)
- [x] Fetches data from `GET /api/forecast`
- [x] Renders historical kWh alongside predicted values on one chart
- [x] Visually distinguishes historical vs. forecast data (e.g. dashed line)

---

## DevOps & Deployment

### Docker
- [ ] `Dockerfile` for backend — multi-stage build (Go builder → Alpine runtime)
- [ ] `Dockerfile` for frontend — builds React app, serves via Nginx
- [ ] `docker-compose.yml` — wires backend + frontend, mounts SQLite volume
- [ ] `docker compose up` runs the full stack locally without extra steps

### Railway CI/CD
- [ ] Backend service connected to GitHub repo
- [ ] Frontend service connected to GitHub repo
- [ ] SQLite volume configured to persist between deploys
- [ ] Pipeline configured and green by **Week 7**
- [ ] Local Docker fallback tested as backup for the Final Audit

### GitHub
- [ ] Remove stale `backend/` directory (duplicate code from old structure)
- [ ] Branch protection enabled on `main`
- [ ] All changes go through Pull Requests
- [ ] At least one peer review required before merge
- [ ] No secrets committed — API keys via environment variables only
- [ ] All commits reference a task ID from the project schedule

---

## Testing & QA

### Backend Unit Tests
- [ ] Unit tests for z-score calculation (`internal/workers/detector.go`)
- [ ] Unit tests for rolling average calculation
- [ ] Unit tests for anomaly threshold logic (including out-of-hours and holiday adjustments)
- [ ] Unit tests for linear regression slope + intercept (`handlers.go → GetForecast`)
- [ ] All tests pass `go vet` and `gofmt`

### Integration & System Tests
- [ ] End-to-end test: ingestor runs → anomaly detected → written to DB
- [ ] API response tests for all REST endpoints (GET /api/readings, GET /api/anomalies, POST /api/reports, GET /api/forecast, PATCH /api/anomalies)
- [ ] Verified no PII is stored after submitting a report

### WebSocket Latency Load Test
- [ ] Load test script written (validates the 2-second alert window)
- [ ] Test simulates a spike injection and measures time to client receipt
- [ ] **Must pass before Final Audit** — sub-2-second latency confirmed under load

### QA Sign-off
- [ ] User experience reviewed by QA Lead (Mubeen)
- [ ] All marking rubric criteria verified as met
- [ ] Virtual sensor data stream validated end-to-end
- [ ] External API integrations verified (weather + holidays)
- [ ] Scope confirmed — no out-of-scope features included

---

## File Map (Active Code)

| Component | File | Status |
|-----------|------|--------|
| Entrypoint | `cmd/server/main.go` | ✅ |
| Database | `internal/database/database.go` | ✅ |
| Migrations | `internal/database/migrate.go` | ✅ |
| Schema | `internal/database/schema.sql` | ✅ |
| Models | `internal/models/models.go` | ✅ |
| REST Handlers | `internal/handlers/handlers.go` | ✅ |
| WebSocket Hub | `internal/ws/hub.go` | ✅ |
| Ingestor Worker | `internal/workers/ingestor.go` | ✅ |
| Anomaly Detector | `internal/workers/detector.go` | ✅ |
| Weather API | `internal/integrations/weather.go` | ✅ |
| Holiday API | `internal/integrations/holidays.go` | ✅ |
| Run Script | `run.sh` | ✅ |

> ⚠️ The `backend/` directory is a stale duplicate — all active code uses `cmd/` + `internal/` at the project root.

---