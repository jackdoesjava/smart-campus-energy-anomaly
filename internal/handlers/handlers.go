package handlers

import (
	"database/sql"
	"encoding/json"
	"math"
	"net/http"
	"smart-campus-dashboard/internal/models"
	"strconv"
	"strings"
	"time"
)

type Handlers struct {
	db *sql.DB
}

func NewHandlers(db *sql.DB) *Handlers {
	return &Handlers{db: db}
}

func jsonResponse(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func parseTimestamp(s string) time.Time {
	for _, layout := range []string{"2006-01-02 15:04:05", time.RFC3339, "2006-01-02T15:04:05Z"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

// GET /api/readings?building=X&limit=N
func (h *Handlers) GetReadings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	building := r.URL.Query().Get("building")
	limit := 60
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 1000 {
			limit = n
		}
	}

	var (
		rows *sql.Rows
		err  error
	)
	if building != "" {
		rows, err = h.db.Query(
			`SELECT id, building_id, timestamp, kwh, temperature, co2_ppm FROM readings WHERE building_id = ? ORDER BY timestamp DESC LIMIT ?`,
			building, limit,
		)
	} else {
		rows, err = h.db.Query(
			`SELECT id, building_id, timestamp, kwh, temperature, co2_ppm FROM readings ORDER BY timestamp DESC LIMIT ?`,
			limit,
		)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	readings := []models.Reading{}
	for rows.Next() {
		var rd models.Reading
		var ts string
		if err := rows.Scan(&rd.ID, &rd.BuildingID, &ts, &rd.KWh, &rd.Temperature, &rd.CO2PPM); err != nil {
			continue
		}
		rd.Timestamp = parseTimestamp(ts)
		readings = append(readings, rd)
	}

	jsonResponse(w, http.StatusOK, readings)
}

// GET /api/anomalies?building=X&severity=Y  |  PATCH /api/anomalies?id=X
func (h *Handlers) GetAnomalies(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.listAnomalies(w, r)
	case http.MethodPatch:
		h.updateAnomalyTag(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handlers) listAnomalies(w http.ResponseWriter, r *http.Request) {
	building := r.URL.Query().Get("building")
	severity := r.URL.Query().Get("severity")

	query := `SELECT a.id, a.reading_id, a.detected_at, a.severity, COALESCE(a.tag,''),
		r.building_id, r.kwh, r.temperature, r.co2_ppm
		FROM anomalies a JOIN readings r ON a.reading_id = r.id`

	var conds []string
	var args []interface{}
	if building != "" {
		conds = append(conds, "r.building_id = ?")
		args = append(args, building)
	}
	if severity != "" {
		conds = append(conds, "a.severity = ?")
		args = append(args, severity)
	}
	if len(conds) > 0 {
		query += " WHERE " + strings.Join(conds, " AND ")
	}
	query += " ORDER BY a.detected_at DESC LIMIT 100"

	rows, err := h.db.Query(query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	anomalies := []models.Anomaly{}
	for rows.Next() {
		var a models.Anomaly
		var ts string
		if err := rows.Scan(&a.ID, &a.ReadingID, &ts, &a.Severity, &a.Tag,
			&a.BuildingID, &a.KWh, &a.Temperature, &a.CO2PPM); err != nil {
			continue
		}
		a.DetectedAt = parseTimestamp(ts)
		anomalies = append(anomalies, a)
	}

	jsonResponse(w, http.StatusOK, anomalies)
}

func (h *Handlers) updateAnomalyTag(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "id required", http.StatusBadRequest)
		return
	}

	var body struct {
		Tag string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	if _, err := h.db.Exec("UPDATE anomalies SET tag = ? WHERE id = ?", body.Tag, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]string{"status": "updated"})
}

// POST /api/reports  — no IP or identity data logged
func (h *Handlers) CreateReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		BuildingID  string `json:"building_id"`
		Category    string `json:"category"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	if body.Category == "" || body.Description == "" {
		http.Error(w, "category and description required", http.StatusBadRequest)
		return
	}

	result, err := h.db.Exec(
		`INSERT INTO reports (building_id, created_at, category, description) VALUES (?, datetime('now'), ?, ?)`,
		body.BuildingID, body.Category, body.Description,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := result.LastInsertId()
	jsonResponse(w, http.StatusCreated, map[string]interface{}{"id": id, "status": "created"})
}

// GET /api/forecast?building=X  — linear regression over last 24 h of readings
func (h *Handlers) GetForecast(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	building := r.URL.Query().Get("building")
	if building == "" {
		building = "library"
	}

	rows, err := h.db.Query(
		`SELECT CAST(strftime('%s', timestamp) AS INTEGER), kwh FROM readings WHERE building_id = ? ORDER BY timestamp DESC LIMIT 144`,
		building,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type pt struct{ x, y float64 }
	var pts []pt
	for rows.Next() {
		var p pt
		if err := rows.Scan(&p.x, &p.y); err != nil {
			continue
		}
		pts = append(pts, p)
	}

	if len(pts) < 2 {
		jsonResponse(w, http.StatusOK, []interface{}{})
		return
	}

	n := float64(len(pts))
	var sumX, sumY, sumXY, sumX2 float64
	for _, p := range pts {
		sumX += p.x
		sumY += p.y
		sumXY += p.x * p.y
		sumX2 += p.x * p.x
	}

	denom := n*sumX2 - sumX*sumX
	if denom == 0 {
		jsonResponse(w, http.StatusOK, []interface{}{})
		return
	}
	slope := (n*sumXY - sumX*sumY) / denom
	intercept := (sumY - slope*sumX) / n

	type prediction struct {
		Timestamp string  `json:"timestamp"`
		Predicted float64 `json:"predicted"`
	}

	now := time.Now().Unix()
	preds := make([]prediction, 0, 12)
	for step := 1; step <= 12; step++ {
		futureX := float64(now + int64(step)*300)
		val := slope*futureX + intercept
		if val < 0 {
			val = 0
		}
		preds = append(preds, prediction{
			Timestamp: time.Unix(int64(futureX), 0).UTC().Format(time.RFC3339),
			Predicted: math.Round(val*100) / 100,
		})
	}

	jsonResponse(w, http.StatusOK, preds)
}
