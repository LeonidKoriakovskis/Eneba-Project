package handlers

import (
	"net/http"

	"eneba-marketplace/backend/internal/middleware"
	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/services"
)

type StripeHandler struct {
	stripe *services.StripeService
	orders *services.OrderService
}

func NewStripeHandler(stripe *services.StripeService, orders *services.OrderService) *StripeHandler {
	return &StripeHandler{stripe: stripe, orders: orders}
}

// HandleGetPaymentConfig serves GET /api/config/payment.
func (h *StripeHandler) HandleGetPaymentConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	writeJSON(w, http.StatusOK, models.PaymentConfigResponse{
		StripeEnabled: h.stripe != nil && h.stripe.Enabled(),
	})
}

// HandleCreateStripeSession serves POST /api/checkout/stripe-session (JWT protected).
func (h *StripeHandler) HandleCreateStripeSession(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	if h.stripe == nil || !h.stripe.Enabled() {
		writeError(w, http.StatusBadRequest, "Stripe Checkout is not enabled on this server")
		return
	}

	var req struct {
		Items []models.CheckoutItem `json:"items"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}

	lines, err := h.orders.PreviewCheckout(r.Context(), req.Items)
	if err != nil {
		writeCheckoutError(w, err, "stripe-session")
		return
	}

	session, err := h.stripe.CreateCheckoutSession(r.Context(), lines, userID, r.Header.Get("Origin"))
	if err != nil {
		writeCheckoutError(w, err, "stripe-session")
		return
	}

	writeJSON(w, http.StatusOK, session)
}
