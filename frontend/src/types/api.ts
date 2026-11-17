// TypeScript contracts mirroring the Go backend JSON responses
// (see backend/internal/models/models.go).

export type Platform = 'Steam' | 'PSN' | 'Xbox' | 'Nintendo Switch';
export type Region = 'GLOBAL' | 'EUROPE' | 'US';
export type SortOption = 'popular' | 'price_asc' | 'price_desc' | 'newest';

// ---- Catalog ----

export interface ProductSummary {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  platform: Platform;
  region: Region;
  genre: string;
  release_date: string; // YYYY-MM-DD
  lowest_price_cents: number;
  original_price_cents: number;
  discount_percent: number;
  best_seller_name: string;
  best_seller_rating: number;
  total_stock_count: number;
  total_offers_count: number;
  relevance_score?: number;
}

export interface SellerOffer {
  id: string;
  product_id: string;
  seller_name: string;
  seller_rating: number;
  review_count: number;
  price_cents: number;
  original_price_cents: number;
  discount_percent: number;
  is_featured: boolean;
  available_keys_count: number;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductDetail extends ProductSummary {
  offers: SellerOffer[] | null;
}

export interface ProductListResponse {
  products: ProductSummary[] | null;
  total_count: number;
  limit: number;
  offset: number;
}

export interface ProductQuery {
  q?: string;
  platform?: string | string[];
  region?: string | string[];
  genre?: string;
  min_price?: number; // cents
  max_price?: number; // cents
  sort?: SortOption;
  limit?: number;
  offset?: number;
}

// ---- Homepage ----

export type KnownBlockType = 'hero_banner' | 'best_sellers' | 'flash_deals' | 'recommended';

export interface HomepageBlock {
  id: string;
  /** Known types are rendered specially; unknown types fall back to a product grid. */
  block_type: KnownBlockType | (string & {});
  title: string;
  sort_order: number;
  config: Record<string, unknown> | null;
  products: ProductSummary[] | null;
}

export interface HomepageResponse {
  blocks: HomepageBlock[] | null;
}

/** A hero_banner slide, parsed from block.config.items[] (enriched by the backend). */
export interface HeroItem {
  productId: string;
  slug: string;
  headline: string;
  subheading?: string;
  badge?: string;
  bannerImage?: string;
  lowestPriceCents: number;
  originalPriceCents: number;
  discountPercent: number;
  totalStockCount: number;
}

// ---- Auth ----

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ---- Checkout & Orders ----

export interface CheckoutItemRequest {
  seller_offer_id: string;
  quantity: number;
}

export interface CheckoutRequest {
  items: CheckoutItemRequest[];
  payment_method: 'card_sim';
}

export interface OrderItem {
  id: string;
  seller_offer_id: string;
  product_id: string;
  product_title: string;
  product_slug: string;
  platform: Platform;
  region: Region;
  seller_name: string;
  unit_price_cents: number;
  license_key: string;
}

export interface Order {
  id: string;
  user_id: string;
  total_cents: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  payment_method?: string;
  created_at: string;
  items: OrderItem[];
}

export interface OrdersResponse {
  orders: Order[];
}

// ---- Misc ----

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
}

export interface ApiErrorBody {
  error: string;
  [key: string]: unknown;
}
