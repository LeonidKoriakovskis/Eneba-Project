package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/services"

	"github.com/go-chi/chi/v5"
)

type CatalogHandler struct {
	catalogService *services.CatalogService
}

func NewCatalogHandler(catalogService *services.CatalogService) *CatalogHandler {
	return &CatalogHandler{catalogService: catalogService}
}

// HandleGetHomepage serves GET /api/homepage
func (h *CatalogHandler) HandleGetHomepage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	blocks, err := h.catalogService.GetHomepage(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to load homepage blocks: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"blocks": blocks,
	})
}

// parseMultiQueryParam parses both repeated (?platform=Steam&platform=PSN) and
// comma-separated (?platform=Steam,PSN) query values into deduplicated entries.
func parseMultiQueryParam(values []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, raw := range values {
		for _, part := range strings.Split(raw, ",") {
			trimmed := strings.TrimSpace(part)
			if trimmed == "" {
				continue
			}
			key := strings.ToLower(trimmed)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			out = append(out, trimmed)
		}
	}
	return out
}

// HandleListProducts serves GET /api/products
func (h *CatalogHandler) HandleListProducts(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	query := r.URL.Query()
	q := strings.TrimSpace(query.Get("q"))
	platforms := parseMultiQueryParam(query["platform"])
	regions := parseMultiQueryParam(query["region"])
	genre := strings.TrimSpace(query.Get("genre"))
	sort := strings.TrimSpace(query.Get("sort"))

	var minPrice *int
	if minStr := query.Get("min_price"); minStr != "" {
		if val, err := strconv.Atoi(minStr); err == nil && val >= 0 {
			minPrice = &val
		}
	}

	var maxPrice *int
	if maxStr := query.Get("max_price"); maxStr != "" {
		if val, err := strconv.Atoi(maxStr); err == nil && val >= 0 {
			maxPrice = &val
		}
	}

	limit := 20
	if limitStr := query.Get("limit"); limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 && val <= 100 {
			limit = val
		}
	}

	offset := 0
	if offsetStr := query.Get("offset"); offsetStr != "" {
		if val, err := strconv.Atoi(offsetStr); err == nil && val >= 0 {
			offset = val
		}
	}

	params := models.ProductFilterParams{
		Query:         q,
		Platforms:     platforms,
		Regions:       regions,
		Genre:         genre,
		MinPriceCents: minPrice,
		MaxPriceCents: maxPrice,
		Sort:          sort,
		Limit:         limit,
		Offset:        offset,
	}

	resp, err := h.catalogService.ListProducts(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to list products: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// HandleGetProductBySlug serves GET /api/products/{slug}
func (h *CatalogHandler) HandleGetProductBySlug(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeError(w, http.StatusBadRequest, "Product slug is required")
		return
	}

	product, err := h.catalogService.GetProductBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, services.ErrProductNotFound) {
			writeError(w, http.StatusNotFound, "Product not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "Failed to retrieve product: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, product)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
