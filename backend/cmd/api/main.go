package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"eneba-marketplace/backend/internal/config"
	"eneba-marketplace/backend/internal/db"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Server struct {
	cfg *config.Config
	db  *db.Database
}

func main() {
	cfg := config.Load()
	log.Printf("Starting Eneba Marketplace Backend [Env: %s, Port: %s]...", cfg.Environment, cfg.Port)

	// Attempt connecting to database with a timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	database, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Printf("⚠️ Warning: Initial database connection failed: %v", err)
		log.Printf("Server will continue running in degraded mode. Start PostgreSQL or configure DATABASE_URL.")
	} else {
		defer database.Close()
	}

	srv := &Server{
		cfg: cfg,
		db:  database,
	}

	router := srv.setupRouter()

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Server run context for graceful shutdown
	serverCtx, serverStopCtx := context.WithCancel(context.Background())

	// Listen for syscall signals for process to interrupt/quit
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	go func() {
		<-sig
		log.Println("Shutting down server gracefully...")

		shutdownCtx, shutdownCancel := context.WithTimeout(serverCtx, 15*time.Second)
		defer shutdownCancel()

		go func() {
			<-shutdownCtx.Done()
			if errors.Is(shutdownCtx.Err(), context.DeadlineExceeded) {
				log.Fatal("Graceful shutdown timed out, forcing exit.")
			}
		}()

		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			log.Fatalf("Server shutdown error: %v", err)
		}
		serverStopCtx()
	}()

	log.Printf("🚀 Server listening at http://localhost:%s", cfg.Port)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("Failed to listen and serve: %v", err)
	}

	<-serverCtx.Done()
	log.Println("Server gracefully stopped.")
}

func (s *Server) setupRouter() *chi.Mux {
	r := chi.NewRouter()

	// Base middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health Check Endpoint
	r.Get("/api/health", s.handleHealthCheck)

	return r
}

type HealthResponse struct {
	Status    string            `json:"status"`
	Service   string            `json:"service"`
	Timestamp string            `json:"timestamp"`
	Database  DatabaseHealth    `json:"database"`
	Details   map[string]string `json:"details,omitempty"`
}

type DatabaseHealth struct {
	Connected   bool   `json:"connected"`
	LatencyMs   int64  `json:"latency_ms,omitempty"`
	Message     string `json:"message"`
}

func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	dbHealth := DatabaseHealth{
		Connected: false,
		Message:   "Database not configured or disconnected",
	}

	overallStatus := "ok"

	if s.db != nil && s.db.Pool != nil {
		start := time.Now()
		pingCtx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		if err := s.db.Ping(pingCtx); err != nil {
			dbHealth.Connected = false
			dbHealth.Message = err.Error()
			overallStatus = "degraded"
		} else {
			dbHealth.Connected = true
			dbHealth.LatencyMs = time.Since(start).Milliseconds()
			dbHealth.Message = "PostgreSQL pool connected and responsive"
		}
	} else {
		overallStatus = "degraded"
	}

	response := HealthResponse{
		Status:    overallStatus,
		Service:   "eneba-marketplace-api",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Database:  dbHealth,
	}

	if overallStatus == "ok" {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	_ = json.NewEncoder(w).Encode(response)
}
