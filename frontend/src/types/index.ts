export type Platform = 'Steam' | 'PSN' | 'Xbox' | 'Nintendo Switch';
export type Region = 'GLOBAL' | 'EUROPE' | 'US';

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  cover_image_url: string;
  platform: Platform;
  region: Region;
  genre: string;
  release_date: string;
  created_at: string;
  updated_at: string;
  min_price_cents?: number;
  best_offer_price?: number;
  best_offer_seller?: string;
  total_offers_count?: number;
  offers?: SellerOffer[];
}

export interface SellerOffer {
  id: string;
  product_id: string;
  seller_name: string;
  seller_rating: number;
  review_count: number;
  price_cents: number;
  original_price_cents: number;
  is_featured: boolean;
  available_keys_count?: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export type BlockType = 'hero_banner' | 'best_sellers' | 'flash_deals' | 'recommended';

export interface HomepageBlock {
  id: string;
  block_type: BlockType;
  title: string;
  sort_order: number;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  service: string;
  timestamp: string;
  database: {
    connected: boolean;
    latency_ms?: number;
    message: string;
  };
  details?: Record<string, string>;
}
