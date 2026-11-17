package handlers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"eneba-marketplace/backend/internal/db"
	"eneba-marketplace/backend/internal/handlers"
	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/repository"
	"eneba-marketplace/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/joho/godotenv"
)

func setupTestRouter(t *testing.T) *chi.Mux {
	// Try loading .env from various parent directories
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:password123@localhost:5432/eneba_marketplace?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	database, err := db.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("Failed to connect to database for integration tests: %v", err)
	}

	catalogRepo := repository.NewCatalogRepository(database.Pool)
	catalogService := services.NewCatalogService(catalogRepo)
	catalogHandler := handlers.NewCatalogHandler(catalogService)
	healthHandler := handlers.NewHealthHandler(database)

	r := chi.NewRouter()
	r.Route("/api", func(r chi.Router) {
		r.Get("/health", healthHandler.HandleHealth)
		r.Get("/homepage", catalogHandler.HandleGetHomepage)
		r.Get("/products", catalogHandler.HandleListProducts)
		r.Get("/products/{slug}", catalogHandler.HandleGetProductBySlug)
	})

	return r
}

func TestHealthEndpoint(t *testing.T) {
	router := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var res map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if res["status"] != "ok" || res["database"] != "connected" {
		t.Errorf("Unexpected health response: %+v", res)
	}
}

func TestHomepageEndpoint_HydratedBlocks(t *testing.T) {
	router := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/homepage", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Blocks []models.HydratedHomepageBlock `json:"blocks"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to decode homepage response: %v", err)
	}

	if len(res.Blocks) < 4 {
		t.Fatalf("Expected at least 4 homepage blocks, got %d", len(res.Blocks))
	}

	// Verify sort order
	for i := 1; i < len(res.Blocks); i++ {
		if res.Blocks[i].SortOrder < res.Blocks[i-1].SortOrder {
			t.Errorf("Blocks not ordered by sort_order: %d < %d", res.Blocks[i].SortOrder, res.Blocks[i-1].SortOrder)
		}
	}

	// Verify hydration of products in blocks
	bestSellersFound := false
	for _, b := range res.Blocks {
		if b.BlockType == "best_sellers" {
			bestSellersFound = true
			if len(b.Products) == 0 {
				t.Errorf("best_sellers block should have hydrated products, found 0")
			}
			for _, p := range b.Products {
				if p.LowestPriceCents <= 0 {
					t.Errorf("Expected product %s to have lowest_price_cents > 0, got %d", p.Title, p.LowestPriceCents)
				}
				if p.TotalStockCount <= 0 {
					t.Errorf("Expected product %s to have stock > 0, got %d", p.Title, p.TotalStockCount)
				}
			}
		}
	}

	if !bestSellersFound {
		t.Errorf("best_sellers block not found in homepage response")
	}
}

func TestProductsEndpoint_TypoTolerantSearch(t *testing.T) {
	router := setupTestRouter(t)

	// Intentional typo search: "cybrpunk" should match "Cyberpunk 2077"
	req := httptest.NewRequest(http.MethodGet, "/api/products?q=cybrpunk", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var res models.ProductListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to decode search response: %v", err)
	}

	if res.TotalCount == 0 || len(res.Products) == 0 {
		t.Fatalf("Expected search for 'cybrpunk' to return results via pg_trgm, got 0")
	}

	firstMatch := res.Products[0]
	if firstMatch.Slug != "cyberpunk-2077-phantom-liberty-bundle" {
		t.Errorf("Expected top match to be Cyberpunk 2077, got %s (%s)", firstMatch.Title, firstMatch.Slug)
	}

	if firstMatch.LowestPriceCents <= 0 {
		t.Errorf("Expected valid lowest price, got %d", firstMatch.LowestPriceCents)
	}
}

func TestProductsEndpoint_FilterAndSort(t *testing.T) {
	router := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/products?platform=Steam&region=GLOBAL&sort=price_asc", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var res models.ProductListResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if len(res.Products) == 0 {
		t.Fatalf("Expected matching Steam GLOBAL products, got 0")
	}

	for i, p := range res.Products {
		if p.Platform != "Steam" {
			t.Errorf("Product %s has platform %s, expected Steam", p.Title, p.Platform)
		}
		if p.Region != "GLOBAL" {
			t.Errorf("Product %s has region %s, expected GLOBAL", p.Title, p.Region)
		}
		if i > 0 && p.LowestPriceCents < res.Products[i-1].LowestPriceCents {
			t.Errorf("Products not sorted by price_asc: %d < %d", p.LowestPriceCents, res.Products[i-1].LowestPriceCents)
		}
	}
}

func TestProductBySlugEndpoint_DetailAndOffers(t *testing.T) {
	router := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/products/cyberpunk-2077-phantom-liberty-bundle", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var detail models.ProductDetail
	if err := json.Unmarshal(rec.Body.Bytes(), &detail); err != nil {
		t.Fatalf("Failed to decode product detail: %v", err)
	}

	if detail.Slug != "cyberpunk-2077-phantom-liberty-bundle" {
		t.Errorf("Expected slug 'cyberpunk-2077-phantom-liberty-bundle', got %s", detail.Slug)
	}

	if len(detail.Offers) < 2 {
		t.Fatalf("Expected at least 2 seller offers, got %d", len(detail.Offers))
	}

	// Verify offers ordered by price_cents ASC and stock counts
	for i, o := range detail.Offers {
		if o.PriceCents <= 0 {
			t.Errorf("Offer %s has invalid price %d", o.SellerName, o.PriceCents)
		}
		if o.AvailableKeysCount <= 0 {
			t.Errorf("Expected offer %s to have available keys, got %d", o.SellerName, o.AvailableKeysCount)
		}
		if !o.InStock {
			t.Errorf("Expected offer %s to be flagged in_stock=true", o.SellerName)
		}
		if i > 0 && o.PriceCents < detail.Offers[i-1].PriceCents {
			t.Errorf("Offers not sorted by price ASC: %d < %d", o.PriceCents, detail.Offers[i-1].PriceCents)
		}
	}
}

func TestProductBySlugEndpoint_NotFound(t *testing.T) {
	router := setupTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/products/non-existent-game-slug-404", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("Expected status 404, got %d", rec.Code)
	}
}
