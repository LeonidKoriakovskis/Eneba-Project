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

	"eneba-marketplace/backend/internal/auth"
	"eneba-marketplace/backend/internal/config"
	"eneba-marketplace/backend/internal/db"
	"eneba-marketplace/backend/internal/handlers"
	"eneba-marketplace/backend/internal/repository"
	"eneba-marketplace/backend/internal/router"
	"eneba-marketplace/backend/internal/services"
)

func main() {
	cfg := config.Load()
	log.Printf("Starting Eneba Marketplace Backend [Env: %s, Port: %s]...", cfg.Environment, cfg.Port)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	database, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Printf("⚠️ Warning: Initial database connection failed: %v", err)
	} else {
		defer database.Close()
	}

	tokens := auth.NewTokenManager(cfg.JWTSecret, time.Duration(cfg.JWTExpirationHours)*time.Hour)
	deps := router.Deps{
		AllowedOrigins: cfg.AllowedOrigins,
		Tokens:         tokens,
		Health:         handlers.NewHealthHandler(database),
	}

	if database != nil && database.Pool != nil {
		pool := database.Pool

		userRepo := repository.NewUserRepository(pool)
		orderRepo := repository.NewOrderRepository(pool)

		if err := orderRepo.EnsureSchema(ctx); err != nil {
			log.Printf("⚠️ Warning: Failed to ensure order schema updates: %v", err)
		}

		stripeService := services.NewStripeService(cfg.StripeSecretKey, cfg.FrontendURL)
		emailService := services.NewEmailService(cfg.ResendAPIKey, cfg.EmailFrom, cfg.FrontendURL)

		catalogService := services.NewCatalogService(repository.NewCatalogRepository(pool))
		authService := services.NewAuthService(userRepo, tokens)
		orderService := services.NewOrderService(orderRepo, stripeService)

		if err := authService.EnsureDemoUsers(ctx); err != nil {
			log.Printf("⚠️ Warning: Failed to seed demo users: %v", err)
		}
		if err := catalogService.EnsureCatalogArtwork(ctx); err != nil {
			log.Printf("⚠️ Warning: Failed to sync catalog artwork: %v", err)
		}

		deps.Catalog = handlers.NewCatalogHandler(catalogService)
		deps.Auth = handlers.NewAuthHandler(authService, emailService)
		deps.Orders = handlers.NewOrderHandler(orderService, userRepo, emailService)
		deps.Stripe = handlers.NewStripeHandler(stripeService, orderService)
	}

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router.New(deps),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	serverCtx, serverStopCtx := context.WithCancel(context.Background())

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGHUP, syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT)

	go func() {
		<-sig
		log.Println("Shutting down server gracefully...")

		shutdownCtx, shutdownCancel := context.WithTimeout(serverCtx, 15*time.Second)
		defer shutdownCancel()

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
