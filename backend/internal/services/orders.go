package services

import (
	"context"
	"regexp"
	"sort"
	"strings"

	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/repository"
)

const (
	maxCheckoutLines   = 20
	maxQuantityPerLine = 10
	paymentMethodSim   = "card_sim"
	paymentMethodStripe = "stripe_test"
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type OrderService struct {
	orders *repository.OrderRepository
	stripe *StripeService
}

func NewOrderService(orders *repository.OrderRepository, stripe *StripeService) *OrderService {
	return &OrderService{orders: orders, stripe: stripe}
}

func validateAndNormalizeItems(rawItems []models.CheckoutItem) ([]models.CheckoutItem, error) {
	if len(rawItems) == 0 {
		return nil, &ValidationError{"items must contain at least one entry"}
	}
	if len(rawItems) > maxCheckoutLines {
		return nil, &ValidationError{"too many items in a single checkout"}
	}

	merged := map[string]int{}
	for _, it := range rawItems {
		if !uuidRe.MatchString(it.SellerOfferID) {
			return nil, &ValidationError{"seller_offer_id must be a valid UUID"}
		}
		if it.Quantity < 1 || it.Quantity > maxQuantityPerLine {
			return nil, &ValidationError{"quantity must be between 1 and 10"}
		}
		merged[it.SellerOfferID] += it.Quantity
	}

	items := make([]models.CheckoutItem, 0, len(merged))
	for id, qty := range merged {
		if qty > maxQuantityPerLine {
			return nil, &ValidationError{"quantity per offer must not exceed 10"}
		}
		items = append(items, models.CheckoutItem{SellerOfferID: id, Quantity: qty})
	}
	// Deterministic lock order prevents deadlocks between concurrent checkouts.
	sort.Slice(items, func(i, j int) bool { return items[i].SellerOfferID < items[j].SellerOfferID })
	return items, nil
}

// PreviewCheckout validates cart items, reads exact DB pricing, and checks available stock upfront.
func (s *OrderService) PreviewCheckout(ctx context.Context, rawItems []models.CheckoutItem) ([]models.CheckoutLinePreview, error) {
	items, err := validateAndNormalizeItems(rawItems)
	if err != nil {
		return nil, err
	}
	return s.orders.PreviewItems(ctx, items)
}

// Checkout fulfills either a simulated checkout or an idempotent verified Stripe Test Mode checkout.
// Returns (order, createdNew, err).
func (s *OrderService) Checkout(ctx context.Context, userID string, req models.CheckoutRequest) (*models.OrderDetail, bool, error) {
	switch req.PaymentMethod {
	case paymentMethodSim:
		items, err := validateAndNormalizeItems(req.Items)
		if err != nil {
			return nil, false, err
		}
		order, created, err := s.orders.Checkout(ctx, userID, items, nil)
		if err != nil {
			return nil, false, err
		}
		order.PaymentMethod = req.PaymentMethod
		return order, created, nil

	case paymentMethodStripe:
		sessionID := strings.TrimSpace(req.StripeSessionID)
		if sessionID == "" {
			return nil, false, &ValidationError{"stripe_session_id is required for stripe_test"}
		}

		// Idempotent replay check before hitting Stripe API or touching stock.
		if existing, err := s.orders.GetByStripeSessionID(ctx, userID, sessionID); err != nil {
			return nil, false, err
		} else if existing != nil {
			existing.PaymentMethod = paymentMethodStripe
			return existing, false, nil
		}

		items, err := validateAndNormalizeItems(req.Items)
		if err != nil {
			return nil, false, err
		}

		if s.stripe == nil || !s.stripe.Enabled() {
			return nil, false, ErrStripeDisabled
		}
		if err := s.stripe.VerifySessionPaid(ctx, sessionID); err != nil {
			return nil, false, err
		}

		order, created, err := s.orders.Checkout(ctx, userID, items, &sessionID)
		if err != nil {
			return nil, false, err
		}
		order.PaymentMethod = paymentMethodStripe
		return order, created, nil

	default:
		return nil, false, &ValidationError{`payment_method must be "card_sim" or "stripe_test"`}
	}
}

func (s *OrderService) ListOrders(ctx context.Context, userID string) ([]models.OrderDetail, error) {
	return s.orders.ListByUser(ctx, userID)
}
