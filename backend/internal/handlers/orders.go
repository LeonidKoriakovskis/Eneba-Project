package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"

	"eneba-marketplace/backend/internal/middleware"
	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/repository"
	"eneba-marketplace/backend/internal/services"
)

type OrderHandler struct {
	orderService *services.OrderService
	userRepo     *repository.UserRepository
	emailService *services.EmailService
}

func NewOrderHandler(orderService *services.OrderService, userRepo *repository.UserRepository, emailService *services.EmailService) *OrderHandler {
	return &OrderHandler{
		orderService: orderService,
		userRepo:     userRepo,
		emailService: emailService,
	}
}

func writeCheckoutError(w http.ResponseWriter, err error, logPrefix string) {
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
	case errors.Is(err, services.ErrStripeDisabled):
		log.Printf("[%s] stripe disabled: %v", logPrefix, err)
		writeError(w, http.StatusBadRequest, "Stripe checkout is not configured on this server")
	case errors.Is(err, services.ErrStripeUnpaid):
		log.Printf("[%s] stripe session unpaid: %v", logPrefix, err)
		writeError(w, http.StatusPaymentRequired, fmt.Sprintf("Stripe checkout session payment has not been completed: %v", err))
	case errors.Is(err, services.ErrStripeAPI):
		log.Printf("[%s] stripe API error: %v", logPrefix, err)
		writeError(w, http.StatusBadGateway, fmt.Sprintf("Unable to verify payment with Stripe: %v", err))
	default:
		log.Printf("[%s] error: %v", logPrefix, err)
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Checkout failed: %v", err))
	}
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

	order, createdNew, err := h.orderService.Checkout(r.Context(), userID, req)
	if err != nil {
		writeCheckoutError(w, err, "checkout")
		return
	}

	if createdNew && h.emailService != nil && h.userRepo != nil {
		if user, uErr := h.userRepo.GetByID(r.Context(), userID); uErr == nil {
			h.emailService.SendOrderKeyEmailAsync(user.Email, user.FullName, order)
		} else {
			log.Printf("⚠️ failed to load user %s for order key email: %v", userID, uErr)
		}
	}

	status := http.StatusCreated
	if !createdNew {
		status = http.StatusOK
	}
	writeJSON(w, status, order)
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
