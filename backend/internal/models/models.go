package models

import (
	"encoding/json"
	"time"
)

// User represents a registered marketplace user
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	FullName     string    `json:"full_name"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Product represents a digital game catalog item
type Product struct {
	ID            string    `json:"id"`
	Title         string    `json:"title"`
	Slug          string    `json:"slug"`
	Description   string    `json:"description"`
	CoverImageURL string    `json:"cover_image_url"`
	Platform      string    `json:"platform"` // e.g. Steam, PSN, Xbox, Nintendo Switch
	Region        string    `json:"region"`   // e.g. GLOBAL, EUROPE, US
	Genre         string    `json:"genre"`
	ReleaseDate   string    `json:"release_date"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// ProductWithOffers includes computed offer statistics
type ProductWithOffers struct {
	Product
	MinPriceCents    int           `json:"min_price_cents"`
	BestOfferPrice   int           `json:"best_offer_price"`
	BestOfferSeller  string        `json:"best_offer_seller"`
	TotalOffersCount int           `json:"total_offers_count"`
	Offers           []SellerOffer `json:"offers,omitempty"`
}

// SellerOffer represents an offer from a specific vendor for a product
type SellerOffer struct {
	ID                 string    `json:"id"`
	ProductID          string    `json:"product_id"`
	SellerName         string    `json:"seller_name"`
	SellerRating       float64   `json:"seller_rating"`
	ReviewCount        int       `json:"review_count"`
	PriceCents         int       `json:"price_cents"`
	OriginalPriceCents int       `json:"original_price_cents"`
	IsFeatured         bool      `json:"is_featured"`
	AvailableKeysCount int       `json:"available_keys_count,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// Order represents a user's purchase
type Order struct {
	ID         string      `json:"id"`
	UserID     string      `json:"user_id"`
	TotalCents int         `json:"total_cents"`
	Status     string      `json:"status"` // PENDING, COMPLETED, CANCELLED, REFUNDED
	Items      []OrderItem `json:"items,omitempty"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

// OrderItem represents a line item in an order
type OrderItem struct {
	ID             string      `json:"id"`
	OrderID        string      `json:"order_id"`
	SellerOfferID  string      `json:"seller_offer_id"`
	UnitPriceCents int         `json:"unit_price_cents"`
	LicenseKey     *DigitalKey `json:"license_key,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
}

// DigitalKey represents an activation key allocated to a seller offer
type DigitalKey struct {
	ID            string     `json:"id"`
	SellerOfferID string     `json:"seller_offer_id"`
	LicenseKey    string     `json:"license_key"`
	Status        string     `json:"status"` // AVAILABLE, SOLD
	OrderItemID   *string    `json:"order_item_id,omitempty"`
	SoldAt        *time.Time `json:"sold_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// HomepageBlock represents dynamic dynamic-driven layout sections
type HomepageBlock struct {
	ID        string          `json:"id"`
	BlockType string          `json:"block_type"` // hero_banner, best_sellers, flash_deals, recommended
	Title     string          `json:"title"`
	SortOrder int             `json:"sort_order"`
	Config    json.RawMessage `json:"config"`
	IsActive  bool            `json:"is_active"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}
