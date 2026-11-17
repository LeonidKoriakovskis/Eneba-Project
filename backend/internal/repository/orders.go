package repository

import (
	"context"
	"errors"
	"fmt"

	"eneba-marketplace/backend/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrOfferNotFound = errors.New("seller offer not found")

// OutOfStockError is returned when an offer has fewer AVAILABLE keys than requested.
type OutOfStockError struct {
	SellerOfferID string
	SellerName    string
	ProductTitle  string
	Requested     int
	Available     int
}

func (e *OutOfStockError) Error() string {
	return fmt.Sprintf(
		"out of stock: offer %s (%q by seller %q) has %d key(s) available but %d requested",
		e.SellerOfferID, e.ProductTitle, e.SellerName, e.Available, e.Requested,
	)
}

type OrderRepository struct {
	pool *pgxpool.Pool
}

func NewOrderRepository(pool *pgxpool.Pool) *OrderRepository {
	return &OrderRepository{pool: pool}
}

// EnsureSchema adds columns required for idempotent Stripe fulfillment on existing databases.
func (r *OrderRepository) EnsureSchema(ctx context.Context) error {
	_, err := r.pool.Exec(ctx, `ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id TEXT UNIQUE`)
	if err != nil {
		return fmt.Errorf("failed to ensure orders stripe_session_id column: %w", err)
	}
	return nil
}

type offerInfo struct {
	ID           string
	ProductID    string
	SellerName   string
	PriceCents   int
	ProductTitle string
	ProductSlug  string
	Platform     string
	Region       string
}

type lockedUnit struct {
	keyID      string
	licenseKey string
	offer      offerInfo
}

type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func loadOfferInfo(ctx context.Context, q rowQuerier, offerID string) (offerInfo, error) {
	var o offerInfo
	err := q.QueryRow(ctx, `
		SELECT so.id, so.product_id, so.seller_name, so.price_cents,
		       p.title, p.slug, p.platform, p.region
		FROM seller_offers so
		JOIN products p ON p.id = so.product_id
		WHERE so.id = $1
	`, offerID).Scan(
		&o.ID, &o.ProductID, &o.SellerName, &o.PriceCents,
		&o.ProductTitle, &o.ProductSlug, &o.Platform, &o.Region,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return o, ErrOfferNotFound
		}
		return o, fmt.Errorf("failed to load offer: %w", err)
	}
	return o, nil
}

// PreviewItems fetches authoritative pricing and validates key stock upfront for Checkout Session creation.
func (r *OrderRepository) PreviewItems(ctx context.Context, items []models.CheckoutItem) ([]models.CheckoutLinePreview, error) {
	lines := make([]models.CheckoutLinePreview, 0, len(items))
	for _, it := range items {
		o, err := loadOfferInfo(ctx, r.pool, it.SellerOfferID)
		if err != nil {
			return nil, err
		}

		var available int
		if err := r.pool.QueryRow(ctx, `
			SELECT count(*) FROM digital_keys
			WHERE seller_offer_id = $1 AND status = 'AVAILABLE'
		`, it.SellerOfferID).Scan(&available); err != nil {
			return nil, fmt.Errorf("failed to count available keys: %w", err)
		}

		if available < it.Quantity {
			return nil, &OutOfStockError{
				SellerOfferID: o.ID,
				SellerName:    o.SellerName,
				ProductTitle:  o.ProductTitle,
				Requested:     it.Quantity,
				Available:     available,
			}
		}

		lines = append(lines, models.CheckoutLinePreview{
			SellerOfferID:  o.ID,
			ProductID:      o.ProductID,
			ProductTitle:   o.ProductTitle,
			ProductSlug:    o.ProductSlug,
			Platform:       o.Platform,
			Region:         o.Region,
			SellerName:     o.SellerName,
			UnitPriceCents: o.PriceCents,
			Quantity:       it.Quantity,
		})
	}
	return lines, nil
}

// GetByStripeSessionID returns an existing completed order matching a Stripe checkout session ID.
func (r *OrderRepository) GetByStripeSessionID(ctx context.Context, userID, stripeSessionID string) (*models.OrderDetail, error) {
	if stripeSessionID == "" {
		return nil, nil
	}

	var o models.OrderDetail
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, total_cents, status, created_at
		FROM orders
		WHERE stripe_session_id = $1 AND user_id = $2
	`, stripeSessionID, userID).Scan(&o.ID, &o.UserID, &o.TotalCents, &o.Status, &o.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query order by stripe session: %w", err)
	}

	orders := []models.OrderDetail{o}
	if err := r.loadItemsForOrders(ctx, orders); err != nil {
		return nil, err
	}
	return &orders[0], nil
}

// Checkout atomically locks AVAILABLE keys, creates the order and its items, and
// marks the keys SOLD. Returns (order, createdNew, err). If stripeSessionID was
// already fulfilled, returns the existing receipt with createdNew=false.
func (r *OrderRepository) Checkout(ctx context.Context, userID string, items []models.CheckoutItem, stripeSessionID *string) (*models.OrderDetail, bool, error) {
	if stripeSessionID != nil && *stripeSessionID != "" {
		existing, err := r.GetByStripeSessionID(ctx, userID, *stripeSessionID)
		if err != nil {
			return nil, false, err
		}
		if existing != nil {
			return existing, false, nil
		}
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Rollback is a no-op after a successful Commit.
	defer func() { _ = tx.Rollback(ctx) }()

	var units []lockedUnit
	totalCents := 0

	for _, it := range items {
		o, err := loadOfferInfo(ctx, tx, it.SellerOfferID)
		if err != nil {
			return nil, false, err
		}

		rows, err := tx.Query(ctx, `
			SELECT id, license_key
			FROM digital_keys
			WHERE seller_offer_id = $1 AND status = 'AVAILABLE'
			LIMIT $2
			FOR UPDATE SKIP LOCKED
		`, it.SellerOfferID, it.Quantity)
		if err != nil {
			return nil, false, fmt.Errorf("failed to lock digital keys: %w", err)
		}

		var locked []lockedUnit
		for rows.Next() {
			u := lockedUnit{offer: o}
			if err := rows.Scan(&u.keyID, &u.licenseKey); err != nil {
				rows.Close()
				return nil, false, fmt.Errorf("failed to scan digital key: %w", err)
			}
			locked = append(locked, u)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, false, fmt.Errorf("failed to read digital keys: %w", err)
		}

		if len(locked) < it.Quantity {
			return nil, false, &OutOfStockError{
				SellerOfferID: o.ID,
				SellerName:    o.SellerName,
				ProductTitle:  o.ProductTitle,
				Requested:     it.Quantity,
				Available:     len(locked),
			}
		}

		units = append(units, locked...)
		totalCents += o.PriceCents * it.Quantity
	}

	detail := &models.OrderDetail{
		UserID:     userID,
		TotalCents: totalCents,
		Status:     "COMPLETED",
		Items:      make([]models.OrderItemDetail, 0, len(units)),
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO orders (user_id, total_cents, status, stripe_session_id)
		VALUES ($1, $2, 'COMPLETED', $3)
		RETURNING id, created_at
	`, userID, totalCents, stripeSessionID).Scan(&detail.ID, &detail.CreatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if stripeSessionID != nil && *stripeSessionID != "" && errors.As(err, &pgErr) && pgErr.Code == "23505" {
			_ = tx.Rollback(ctx)
			existing, lookupErr := r.GetByStripeSessionID(ctx, userID, *stripeSessionID)
			if lookupErr == nil && existing != nil {
				return existing, false, nil
			}
		}
		return nil, false, fmt.Errorf("failed to create order: %w", err)
	}

	for _, u := range units {
		var orderItemID string
		err := tx.QueryRow(ctx, `
			INSERT INTO order_items (order_id, seller_offer_id, unit_price_cents)
			VALUES ($1, $2, $3)
			RETURNING id
		`, detail.ID, u.offer.ID, u.offer.PriceCents).Scan(&orderItemID)
		if err != nil {
			return nil, false, fmt.Errorf("failed to create order item: %w", err)
		}

		tag, err := tx.Exec(ctx, `
			UPDATE digital_keys
			SET status = 'SOLD', order_item_id = $1, sold_at = NOW()
			WHERE id = $2 AND status = 'AVAILABLE'
		`, orderItemID, u.keyID)
		if err != nil {
			return nil, false, fmt.Errorf("failed to mark key sold: %w", err)
		}
		if tag.RowsAffected() != 1 {
			return nil, false, fmt.Errorf("digital key %s was not available during fulfillment", u.keyID)
		}

		detail.Items = append(detail.Items, models.OrderItemDetail{
			ID:             orderItemID,
			SellerOfferID:  u.offer.ID,
			ProductID:      u.offer.ProductID,
			ProductTitle:   u.offer.ProductTitle,
			ProductSlug:    u.offer.ProductSlug,
			Platform:       u.offer.Platform,
			Region:         u.offer.Region,
			SellerName:     u.offer.SellerName,
			UnitPriceCents: u.offer.PriceCents,
			LicenseKey:     u.licenseKey,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, false, fmt.Errorf("failed to commit checkout: %w", err)
	}
	return detail, true, nil
}

// ListByUser returns all orders of a user (newest first) with items and license keys.
func (r *OrderRepository) ListByUser(ctx context.Context, userID string) ([]models.OrderDetail, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, total_cents, status, created_at
		FROM orders
		WHERE user_id = $1
		ORDER BY created_at DESC, id
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query orders: %w", err)
	}
	defer rows.Close()

	orders := []models.OrderDetail{}
	for rows.Next() {
		var o models.OrderDetail
		if err := rows.Scan(&o.ID, &o.UserID, &o.TotalCents, &o.Status, &o.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan order: %w", err)
		}
		o.Items = []models.OrderItemDetail{}
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	if err := r.loadItemsForOrders(ctx, orders); err != nil {
		return nil, err
	}
	return orders, nil
}

func (r *OrderRepository) loadItemsForOrders(ctx context.Context, orders []models.OrderDetail) error {
	if len(orders) == 0 {
		return nil
	}

	index := make(map[string]int, len(orders))
	ids := make([]string, len(orders))
	for i := range orders {
		orders[i].Items = []models.OrderItemDetail{}
		index[orders[i].ID] = i
		ids[i] = orders[i].ID
	}

	itemRows, err := r.pool.Query(ctx, `
		SELECT oi.id, oi.order_id, oi.seller_offer_id, oi.unit_price_cents,
		       so.product_id, so.seller_name,
		       p.title, p.slug, p.platform, p.region,
		       COALESCE(dk.license_key, '')
		FROM order_items oi
		JOIN seller_offers so ON so.id = oi.seller_offer_id
		JOIN products p ON p.id = so.product_id
		LEFT JOIN digital_keys dk ON dk.order_item_id = oi.id
		WHERE oi.order_id = ANY($1)
		ORDER BY oi.created_at, oi.id
	`, ids)
	if err != nil {
		return fmt.Errorf("failed to query order items: %w", err)
	}
	defer itemRows.Close()

	for itemRows.Next() {
		var it models.OrderItemDetail
		var orderID string
		if err := itemRows.Scan(
			&it.ID, &orderID, &it.SellerOfferID, &it.UnitPriceCents,
			&it.ProductID, &it.SellerName,
			&it.ProductTitle, &it.ProductSlug, &it.Platform, &it.Region,
			&it.LicenseKey,
		); err != nil {
			return fmt.Errorf("failed to scan order item: %w", err)
		}
		if i, ok := index[orderID]; ok {
			orders[i].Items = append(orders[i].Items, it)
		}
	}
	return itemRows.Err()
}
