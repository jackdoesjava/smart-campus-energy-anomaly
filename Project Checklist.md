# Smart Campus Anomaly Dashboard — Project Checklist

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
- [ ] 28. Branch protection enabled on `main`
- [ ] 29. PR-only workflow with at least one peer review required
- [ ] 30. No committed secrets — confirm all API keys via env vars
- [ ] 31. All commits reference a task ID from the project schedule

### Phase 8 — Final QA sign-off
- [ ] 32. UX review by QA Lead (Mubeen)
- [ ] 33. Marking rubric criteria verified end-to-end
- [ ] 34. Virtual sensor stream validated end-to-end
- [ ] 35. External API integrations (weather + holidays) verified live
- [ ] 36. Scope confirmed — no out-of-scope features included

---

## Backend (Go)

### Database
- [x] Write `db/schema.sql` with all three tables (`readings`, `anomalies`, `reports`)
- [x] Write `db/db.go` — open connection, run migrations on startup
- [x] Confirm no PII fields exist anywhere in the schema (no name, email, IP)

### Mock IoT Ingestor (`workers/ingestor.go`)
- [x] Cron job runs every 5 minutes
- [x] Generates readings for all buildings: `library`, `sports-hall`, `main-hall`
- [x] Base ranges: kWh 10–200, temperature 18–28°C, CO2 400–1200 ppm
- [x] Occasionally injects a spike (±50% above baseline) to trigger detection
- [x] Writes each reading to the `readings` table

### Anomaly Detector (`workers/detector.go`)
- [x] Runs after every ingestion batch
- [x] Queries last 12 readings per building
- [x] Computes rolling average for kWh
- [x] Computes z-score for kWh
- [x] Flags anomaly if z-score > 2.5 OR value > 150% of rolling average
- [x] Adjusts threshold outside 08:00–18:00 (out-of-hours)
- [x] Adjusts threshold on public holidays
- [x] Writes anomaly record to `anomalies` table with severity and tag
- [x] Broadcasts anomaly to WebSocket hub immediately after writing

### WebSocket Hub (`handlers/ws.go`)
- [x] Maintains registry of all connected clients
- [x] Upgrades HTTP connection to WebSocket on `GET /ws`
- [x] Broadcasts JSON anomaly payload to all connected clients
- [ ] Alert reaches client within **2 seconds** of detection
- [x] Handles client disconnect gracefully (removes from registry without crashing)

### REST Endpoints
- [x] `GET /api/readings` — returns last N readings, filterable by building
- [x] `GET /api/anomalies` — returns anomaly log, filterable by building and severity
- [x] `POST /api/reports` — accepts anonymous staff report, **no IP or headers logged**
- [x] `PATCH /api/anomalies/:id` — allows updating the tag on an anomaly
- [x] `GET /api/forecast` — returns linear regression predictions per building
- [x] `GET /ws` — WebSocket upgrade endpoint

### External API Integrations
- [x] `integrations/weather.go` — fetches current temperature from Open-Meteo
- [x] `integrations/holidays.go` — fetches UK public holidays from `date.nager.at`
- [x] Both APIs cached server-side per day (in-memory map keyed by date)
- [x] Neither API is called more than once per day per endpoint

### ML Forecasting (`handlers/forecast.go`)
- [x] Pulls last 144 readings per building (24 hrs at 5-min intervals)
- [x] Implements linear regression: `x = Unix timestamp`, `y = kWh`
- [x] Computes slope and intercept correctly
- [x] Returns predictions for next 12 steps (1 hour ahead)
- [x] Implemented in pure Go — no external ML library

### Privacy
- [x] `POST /api/reports` does not log `r.RemoteAddr`
- [x] No client headers are stored or logged for any endpoint
- [x] `reports` table confirmed to have no PII fields at schema level

---

## Frontend (React)

### App Shell
- [x] Vite + React project scaffolded
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
- [ ] `backend/Dockerfile` — multi-stage build (Go builder → Alpine runtime)
- [ ] `frontend/Dockerfile` — builds React app, serves via Nginx
- [ ] `docker-compose.yml` — wires backend + frontend, mounts SQLite volume
- [ ] `docker compose up` runs the full stack locally without extra steps

### Railway CI/CD
- [ ] Backend service connected to GitHub repo
- [ ] Frontend service connected to GitHub repo
- [ ] SQLite volume configured to persist between deploys
- [ ] Pipeline configured and green by **Week 7**
- [ ] Local Docker fallback tested as backup for the Final Audit

### GitHub
- [ ] Branch protection enabled on `main`
- [ ] All changes go through Pull Requests
- [ ] At least one peer review required before merge
- [ ] No secrets committed — API keys via environment variables only
- [ ] All commits reference a task ID from the project schedule

---

## Testing & QA

### Backend Unit Tests
- [ ] Unit tests for z-score calculation
- [ ] Unit tests for rolling average calculation
- [ ] Unit tests for anomaly threshold logic (including out-of-hours and holiday adjustments)
- [ ] Unit tests for linear regression (slope + intercept values)
- [ ] All tests pass `go vet` and `gofmt`

### Integration & System Tests
- [ ] End-to-end test: ingestor runs → anomaly detected → written to DB
- [ ] API response tests for all REST endpoints
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