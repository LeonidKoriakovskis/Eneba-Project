package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"eneba-marketplace/backend/internal/config"
	"eneba-marketplace/backend/internal/db"
	"eneba-marketplace/backend/internal/handlers"
	"eneba-marketplace/backend/internal/repository"
	"eneba-marketplace/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Server struct {
	cfg            *config.Config
	db             *db.Database
	catalogHandler *handlers.CatalogHandler
	healthHandler  *handlers.HealthHandler
}

func main() {
	cfg := config.Load()
	log.Printf("Starting Eneba Marketplace Backend [Env: %s, Port: %s]...", cfg.Environment, cfg.Port)

	// Attempt connecting to database
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	database, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Printf("⚠️ Warning: Initial database connection failed: %v", err)
	} else {
		defer database.Close()
	}

	var catalogHandler *handlers.CatalogHandler
	var healthHandler *handlers.HealthHandler

	if database != nil && database.Pool != nil {
		catalogRepo := repository.NewCatalogRepository(database.Pool)
		catalogService := services.NewCatalogService(catalogRepo)
		catalogHandler = handlers.NewCatalogHandler(catalogService)
		healthHandler = handlers.NewHealthHandler(database)
	} else {
		healthHandler = handlers.NewHealthHandler(nil)
	}

	srv := &Server{
		cfg:            cfg,
		db:             database,
		catalogHandler: catalogHandler,
		healthHandler:  healthHandler,
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

	// API Routes
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", s.healthHandler.HandleHealth)

		if s.catalogHandler != nil {
			r.Get("/homepage", s.catalogHandler.HandleGetHomepage)
			r.Get("/products", s.catalogHandler.HandleListProducts)
			r.Get("/products/{slug}", s.catalogHandler.HandleGetProductBySlug)
		}
	})

	return r
}
