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

// ProductSummary represents a catalog listing item with computed best offer & stock
type ProductSummary struct {
	ID                 string  `json:"id"`
	Title              string  `json:"title"`
	Slug               string  `json:"slug"`
	Description        string  `json:"description"`
	CoverImageURL      string  `json:"cover_image_url"`
	Platform           string  `json:"platform"`
	Region             string  `json:"region"`
	Genre              string  `json:"genre"`
	ReleaseDate        string  `json:"release_date"`
	LowestPriceCents   int     `json:"lowest_price_cents"`
	OriginalPriceCents int     `json:"original_price_cents"`
	DiscountPercent    int     `json:"discount_percent"`
	BestSellerName     string  `json:"best_seller_name"`
	BestSellerRating   float64 `json:"best_seller_rating"`
	TotalStockCount    int     `json:"total_stock_count"`
	TotalOffersCount   int     `json:"total_offers_count"`
	RelevanceScore     float64 `json:"relevance_score,omitempty"`
}

// SellerOfferWithStock represents an individual seller's pricing with live available key count
type SellerOfferWithStock struct {
	ID                 string    `json:"id"`
	ProductID          string    `json:"product_id"`
	SellerName         string    `json:"seller_name"`
	SellerRating       float64   `json:"seller_rating"`
	ReviewCount        int       `json:"review_count"`
	PriceCents         int       `json:"price_cents"`
	OriginalPriceCents int       `json:"original_price_cents"`
	DiscountPercent    int       `json:"discount_percent"`
	IsFeatured         bool      `json:"is_featured"`
	AvailableKeysCount int       `json:"available_keys_count"`
	InStock            bool      `json:"in_stock"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// ProductDetail represents the rich product page payload
type ProductDetail struct {
	ProductSummary
	Offers []SellerOfferWithStock `json:"offers"`
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

// HomepageBlock represents dynamic dynamic-driven layout sections in the DB
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

// HydratedHomepageBlock represents the enriched block payload sent to the frontend
type HydratedHomepageBlock struct {
	ID        string                 `json:"id"`
	BlockType string                 `json:"block_type"`
	Title     string                 `json:"title"`
	SortOrder int                    `json:"sort_order"`
	Config    map[string]interface{} `json:"config"`
	Products  []ProductSummary       `json:"products"`
}

// ProductFilterParams encapsulates user search, filtering, and sorting parameters
type ProductFilterParams struct {
	Query         string
	Platform      string
	Platforms     []string
	Region        string
	Regions       []string
	Genre         string
	MinPriceCents *int
	MaxPriceCents *int
	Sort          string // price_asc, price_desc, newest, popular (default)
	Limit         int
	Offset        int
}

// ProductListResponse represents the paginated result of ListProducts
type ProductListResponse struct {
	Products   []ProductSummary `json:"products"`
	TotalCount int              `json:"total_count"`
	Limit      int              `json:"limit"`
	Offset     int              `json:"offset"`
}

// ---- Authentication ----

// UserProfile is the public representation of a user.
type UserProfile struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
}

// AuthResponse is returned by register and login.
type AuthResponse struct {
	Token string      `json:"token"`
	User  UserProfile `json:"user"`
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ---- Checkout & Orders ----

type CheckoutItem struct {
	SellerOfferID string `json:"seller_offer_id"`
	Quantity      int    `json:"quantity"`
}

type CheckoutRequest struct {
	Items         []CheckoutItem `json:"items"`
	PaymentMethod string         `json:"payment_method"`
}

// OrderItemDetail is one purchased unit including its revealed license key.
type OrderItemDetail struct {
	ID             string `json:"id"`
	SellerOfferID  string `json:"seller_offer_id"`
	ProductID      string `json:"product_id"`
	ProductTitle   string `json:"product_title"`
	ProductSlug    string `json:"product_slug"`
	Platform       string `json:"platform"`
	Region         string `json:"region"`
	SellerName     string `json:"seller_name"`
	UnitPriceCents int    `json:"unit_price_cents"`
	LicenseKey     string `json:"license_key"`
}

// OrderDetail is the full order receipt / history entry.
type OrderDetail struct {
	ID            string            `json:"id"`
	UserID        string            `json:"user_id"`
	TotalCents    int               `json:"total_cents"`
	Status        string            `json:"status"`
	PaymentMethod string            `json:"payment_method,omitempty"`
	CreatedAt     time.Time         `json:"created_at"`
	Items         []OrderItemDetail `json:"items"`
}
