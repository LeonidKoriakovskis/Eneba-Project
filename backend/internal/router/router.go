package router

import (
	"net/http"
	"time"

	"eneba-marketplace/backend/internal/auth"
	"eneba-marketplace/backend/internal/handlers"
	authmw "eneba-marketplace/backend/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// Deps holds everything the HTTP layer needs. Nil handlers are simply not mounted.
type Deps struct {
	AllowedOrigins []string
	Tokens         *auth.TokenManager
	Health         *handlers.HealthHandler
	Catalog        *handlers.CatalogHandler
	Auth           *handlers.AuthHandler
	Orders         *handlers.OrderHandler
}

func New(d Deps) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(60 * time.Second))

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   d.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api", func(r chi.Router) {
		if d.Health != nil {
			r.Get("/health", d.Health.HandleHealth)
		}

		if d.Catalog != nil {
			r.Get("/homepage", d.Catalog.HandleGetHomepage)
			r.Get("/products", d.Catalog.HandleListProducts)
			r.Get("/products/{slug}", d.Catalog.HandleGetProductBySlug)
		}

		if d.Auth != nil {
			r.Post("/auth/register", d.Auth.HandleRegister)
			r.Post("/auth/login", d.Auth.HandleLogin)
		}

		if d.Orders != nil && d.Tokens != nil {
			r.Group(func(r chi.Router) {
				r.Use(authmw.Authenticate(d.Tokens))
				r.Post("/orders/checkout", d.Orders.HandleCheckout)
				r.Get("/orders", d.Orders.HandleListOrders)
			})
		}
	})

	return r
}
