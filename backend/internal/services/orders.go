package services

import (
	"context"
	"regexp"
	"sort"

	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/repository"
)

const (
	maxCheckoutLines   = 20
	maxQuantityPerLine = 10
	paymentMethodSim   = "card_sim"
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type OrderService struct {
	orders *repository.OrderRepository
}

func NewOrderService(orders *repository.OrderRepository) *OrderService {
	return &OrderService{orders: orders}
}

func (s *OrderService) Checkout(ctx context.Context, userID string, req models.CheckoutRequest) (*models.OrderDetail, error) {
	if req.PaymentMethod != paymentMethodSim {
		return nil, &ValidationError{`payment_method must be "card_sim"`}
	}
	if len(req.Items) == 0 {
		return nil, &ValidationError{"items must contain at least one entry"}
	}
	if len(req.Items) > maxCheckoutLines {
		return nil, &ValidationError{"too many items in a single checkout"}
	}

	// Merge duplicate offers and validate.
	merged := map[string]int{}
	for _, it := range req.Items {
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

	order, err := s.orders.Checkout(ctx, userID, items)
	if err != nil {
		return nil, err
	}
	order.PaymentMethod = req.PaymentMethod
	return order, nil
}

func (s *OrderService) ListOrders(ctx context.Context, userID string) ([]models.OrderDetail, error) {
	return s.orders.ListByUser(ctx, userID)
}
