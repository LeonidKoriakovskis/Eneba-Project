package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"eneba-marketplace/backend/internal/db"
)

type HealthHandler struct {
	db *db.Database
}

func NewHealthHandler(db *db.Database) *HealthHandler {
	return &HealthHandler{db: db}
}

type HealthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"`
}

func (h *HealthHandler) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if h.db == nil || h.db.Pool == nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(HealthResponse{
			Status:   "degraded",
			Database: "disconnected",
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	if err := h.db.Ping(ctx); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(HealthResponse{
			Status:   "degraded",
			Database: "disconnected",
		})
		return
	}

	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(HealthResponse{
		Status:   "ok",
		Database: "connected",
	})
}
