package handlers

import (
	"errors"
	"log"
	"net/http"

	"eneba-marketplace/backend/internal/middleware"
	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/repository"
	"eneba-marketplace/backend/internal/services"
)

type OrderHandler struct {
	orderService *services.OrderService
}

func NewOrderHandler(orderService *services.OrderService) *OrderHandler {
	return &OrderHandler{orderService: orderService}
}

// HandleCheckout serves POST /api/orders/checkout (JWT protected)
func (h *OrderHandler) HandleCheckout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var req models.CheckoutRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	order, err := h.orderService.Checkout(r.Context(), userID, req)
	if err != nil {
		var vErr *services.ValidationError
		var oosErr *repository.OutOfStockError
		switch {
		case errors.As(err, &vErr):
			writeError(w, http.StatusBadRequest, vErr.Message)
		case errors.Is(err, repository.ErrOfferNotFound):
			writeError(w, http.StatusNotFound, "One or more seller offers do not exist")
		case errors.As(err, &oosErr):
			writeJSON(w, http.StatusConflict, map[string]interface{}{
				"error":           oosErr.Error(),
				"seller_offer_id": oosErr.SellerOfferID,
				"requested":       oosErr.Requested,
				"available":       oosErr.Available,
			})
		default:
			log.Printf("checkout error: %v", err)
			writeError(w, http.StatusInternalServerError, "Checkout failed")
		}
		return
	}

	writeJSON(w, http.StatusCreated, order)
}

// HandleListOrders serves GET /api/orders (JWT protected)
func (h *OrderHandler) HandleListOrders(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	orders, err := h.orderService.ListOrders(r.Context(), userID)
	if err != nil {
		log.Printf("list orders error: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to load orders")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"orders": orders})
}
