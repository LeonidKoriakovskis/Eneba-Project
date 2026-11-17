package repository

import (
	"context"
	"errors"
	"fmt"

	"eneba-marketplace/backend/internal/models"

	"github.com/jackc/pgx/v5"
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

// Checkout atomically locks AVAILABLE keys, creates the order and its items, and
// marks the keys SOLD. Items must already be merged/sorted by the caller.
// Prices are always read from seller_offers inside the transaction.
func (r *OrderRepository) Checkout(ctx context.Context, userID string, items []models.CheckoutItem) (*models.OrderDetail, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	// Rollback is a no-op after a successful Commit.
	defer func() { _ = tx.Rollback(ctx) }()

	var units []lockedUnit
	totalCents := 0

	for _, it := range items {
		var o offerInfo
		err := tx.QueryRow(ctx, `
			SELECT so.id, so.product_id, so.seller_name, so.price_cents,
			       p.title, p.slug, p.platform, p.region
			FROM seller_offers so
			JOIN products p ON p.id = so.product_id
			WHERE so.id = $1
		`, it.SellerOfferID).Scan(
			&o.ID, &o.ProductID, &o.SellerName, &o.PriceCents,
			&o.ProductTitle, &o.ProductSlug, &o.Platform, &o.Region,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrOfferNotFound
			}
			return nil, fmt.Errorf("failed to load offer: %w", err)
		}

		rows, err := tx.Query(ctx, `
			SELECT id, license_key
			FROM digital_keys
			WHERE seller_offer_id = $1 AND status = 'AVAILABLE'
			LIMIT $2
			FOR UPDATE SKIP LOCKED
		`, it.SellerOfferID, it.Quantity)
		if err != nil {
			return nil, fmt.Errorf("failed to lock digital keys: %w", err)
		}

		var locked []lockedUnit
		for rows.Next() {
			u := lockedUnit{offer: o}
			if err := rows.Scan(&u.keyID, &u.licenseKey); err != nil {
				rows.Close()
				return nil, fmt.Errorf("failed to scan digital key: %w", err)
			}
			locked = append(locked, u)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("failed to read digital keys: %w", err)
		}

		if len(locked) < it.Quantity {
			return nil, &OutOfStockError{
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
		INSERT INTO orders (user_id, total_cents, status)
		VALUES ($1, $2, 'COMPLETED')
		RETURNING id, created_at
	`, userID, totalCents).Scan(&detail.ID, &detail.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	for _, u := range units {
		var orderItemID string
		err := tx.QueryRow(ctx, `
			INSERT INTO order_items (order_id, seller_offer_id, unit_price_cents)
			VALUES ($1, $2, $3)
			RETURNING id
		`, detail.ID, u.offer.ID, u.offer.PriceCents).Scan(&orderItemID)
		if err != nil {
			return nil, fmt.Errorf("failed to create order item: %w", err)
		}

		tag, err := tx.Exec(ctx, `
			UPDATE digital_keys
			SET status = 'SOLD', order_item_id = $1, sold_at = NOW()
			WHERE id = $2 AND status = 'AVAILABLE'
		`, orderItemID, u.keyID)
		if err != nil {
			return nil, fmt.Errorf("failed to mark key sold: %w", err)
		}
		if tag.RowsAffected() != 1 {
			return nil, fmt.Errorf("digital key %s was not available during fulfillment", u.keyID)
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
		return nil, fmt.Errorf("failed to commit checkout: %w", err)
	}
	return detail, nil
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
	index := map[string]int{}
	var ids []string
	for rows.Next() {
		var o models.OrderDetail
		if err := rows.Scan(&o.ID, &o.UserID, &o.TotalCents, &o.Status, &o.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan order: %w", err)
		}
		o.Items = []models.OrderItemDetail{}
		index[o.ID] = len(orders)
		ids = append(ids, o.ID)
		orders = append(orders, o)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	rows.Close()

	if len(ids) == 0 {
		return orders, nil
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
		return nil, fmt.Errorf("failed to query order items: %w", err)
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
			return nil, fmt.Errorf("failed to scan order item: %w", err)
		}
		if i, ok := index[orderID]; ok {
			orders[i].Items = append(orders[i].Items, it)
		}
	}
	return orders, itemRows.Err()
}
