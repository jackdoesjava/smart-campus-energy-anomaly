# Smart Campus Anomaly Dashboard

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch)
![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker)

A real-time, privacy-first IoT telemetry dashboard designed to monitor campus energy usage, detect statistical anomalies, and forecast future consumption using Machine Learning. Developed by **Team Hendrixx** for the COM2042 Software Engineering Project at the University of Surrey.

---

## Key Features

* **Real-Time Telemetry:** Ingests mock IoT sensor data (kWh, Temp, CO₂) across 5 campus buildings via a 5-minute cron scheduler.
* **Z-Score Anomaly Detection:** Server-side statistical analysis detects energy spikes using rolling averages, dynamically adjusting thresholds for out-of-hours and UK public holidays.
* **Sub-2-Second Alerts:** A highly concurrent Go WebSocket hub broadcasts anomaly events to connected React clients in under 1.92 seconds.
* **Machine Learning Forecasting:** A Python/PyTorch sidecar provides autoregressive energy consumption predictions layered directly onto the frontend charts.
* **Privacy by Design:** The anonymous reporting system and SQLite schema structurally exclude all Personally Identifiable Information (PII) like IPs, User-Agents, or session tokens.

---

## Architecture & Tech Stack

The system is built on a microservices-inspired architecture, divided into three core domains:

### 1. Frontend (React SPA)
* **Framework:** React 18 (TypeScript) + Vite
* **Routing:** React Router 6
* **UI/Styling:** TailwindCSS + shadcn/ui
* **Data Visualization:** Recharts (Multi-axis time-series charting)
* **Real-time:** Native WebSocket hooks

### 2. Backend (Go Server)
* **Language:** Go (Golang)
* **Database:** SQLite (via `glebarez/go-sqlite` pure-Go driver)
* **Concurrency:** Native Goroutines & Channels for the WebSocket Hub
* **External APIs:** Open-Meteo (Weather), Nager.Date (Public Holidays)

### 3. Machine Learning (Python Sidecar)
* **Framework:** PyTorch
* **Server:** FastAPI inference server
* **Pipeline:** Custom data scaling (`make_scalar.py`) and neural network architecture (`brain.py`)

---

## Project Structure

```text
├── cmd/
│   ├── server/           # Main Go application entry point (main.go)
│   └── loadtest/         # WebSocket concurrency load-testing script
├── frontend/             # React SPA (components, hooks, pages)
├── internal/             
│   ├── database/         # SQLite initialisation and schema.sql
│   ├── handlers/         # REST API routes and ML proxy bridge
│   ├── integrations/     # Weather and Holiday external API clients
│   ├── models/           # Go data structs
│   ├── workers/          # Ingestor cron jobs and Anomaly Detector logic
│   └── ws/               # WebSocket Hub and client connection management
├── python_ml/            # PyTorch ML pipeline (brain.py, train.py, best_model.pth)
├── docker-compose.yml    # Multi-container orchestration
├── Dockerfile            # Multi-stage Go backend build
└── run.sh                # Local dev runner script
```
## Getting Started

### Prerequisites
* **Docker & Docker Compose** (Recommended for production)
* **Go 1.22+** (For local backend dev)
* **Node.js 18+** (For local frontend dev)
* **Python 3.10+** (For local ML dev)

### Option A: Run via Docker (Production / Evaluation)
The entire stack (Frontend, Go Backend, and Python ML sidecar) is containerized.

```bash
# Clone the repository
git clone [https://gitlab.surrey.ac.uk/com2042/team-hendrixx.git](https://gitlab.surrey.ac.uk/com2042/team-hendrixx.git)
cd team-hendrixx

# Build and start all services
docker compose up -d --build
```

* **Dashboard:** `http://localhost:3000` (or `5173` depending on env)
* **API Base:** `http://localhost:8080/api`

### Option B: Run Locally (Development)
We have provided a bash script to concurrently launch the Go server and the React frontend.

```bash
# Make the script executable
chmod +x run.sh

# Start the stack
./run.sh
```

## Testing & Quality Assurance
The backend features a comprehensive test suite covering mathematical anomaly boundaries, REST API contracts, and database schema integrity.

To run the Go test suite:

```bash
# Run all unit and integration tests with verbose output
go test -v ./...
```

**Key Test Coverage:**
* `internal/workers/detector_test.go`: Validates z-score calculations, out-of-hours tagging, and minimum history constraints.
* `internal/handlers/handlers_test.go`: Validates JSON parsing, method restrictions, and privacy/PII stripping.
* `cmd/loadtest/main.go`: Simulates 50 concurrent WebSocket clients to empirically validate sub-2-second latency limits.

---

## Core API Endpoints

| Method  | Endpoint         | Description |
| :------ | :--------------- | :---------- |
| `GET`   | `/api/readings`  | Fetches historical building sensor data (caps at 3000 rows). |
| `GET`   | `/api/anomalies` | Fetches anomaly events joined with underlying sensor data. |
| `PATCH` | `/api/anomalies` | Updates inline contextual tags for the event log. |
| `POST`  | `/api/reports`   | Submits an anonymous staff report (PII stripped). |
| `GET`   | `/api/forecast`  | Proxies to the Python sidecar to fetch future ML predictions. |

---

## Team Hendrixx (COM2042)

* **Rohan Rajput** — DevOps, Backend Lead & Documentation
* **Jack Humphries** — Full-Stack & Machine Learning Lead
* **Matthew Mcmillan** — Backend Implementation & Hardening
* **Timothee Thienpont** — QA & Automated Testing
* **Aditya Sahasrabuddhe** — UI/UX & Design Documentation
* **Mubeen Ashfaq** — Challenge Lead

---
*University of Surrey — Department of Computer Science (2026)*
