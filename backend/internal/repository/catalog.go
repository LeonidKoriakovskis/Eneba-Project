package repository

import (
	"context"
	"fmt"
	"math"
	"strings"

	"eneba-marketplace/backend/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CatalogRepository struct {
	pool *pgxpool.Pool
}

func NewCatalogRepository(pool *pgxpool.Pool) *CatalogRepository {
	return &CatalogRepository{pool: pool}
}

func (r *CatalogRepository) GetActiveHomepageBlocks(ctx context.Context) ([]models.HomepageBlock, error) {
	query := `
		SELECT id, block_type, title, sort_order, config, is_active, created_at, updated_at
		FROM homepage_blocks
		WHERE is_active = true
		ORDER BY sort_order ASC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query homepage blocks: %w", err)
	}
	defer rows.Close()

	var blocks []models.HomepageBlock
	for rows.Next() {
		var b models.HomepageBlock
		if err := rows.Scan(
			&b.ID, &b.BlockType, &b.Title, &b.SortOrder, &b.Config,
			&b.IsActive, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan homepage block: %w", err)
		}
		blocks = append(blocks, b)
	}
	return blocks, rows.Err()
}

func (r *CatalogRepository) GetProductsByIDs(ctx context.Context, ids []string) (map[string]models.ProductSummary, error) {
	if len(ids) == 0 {
		return make(map[string]models.ProductSummary), nil
	}

	query := `
		WITH offer_stats AS (
			SELECT 
				so.product_id,
				MIN(so.price_cents) AS lowest_price_cents,
				COUNT(DISTINCT so.id) AS total_offers_count,
				COALESCE(SUM(CASE WHEN dk.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) AS total_stock_count
			FROM seller_offers so
			LEFT JOIN digital_keys dk ON dk.seller_offer_id = so.id
			GROUP BY so.product_id
		),
		best_offer AS (
			SELECT DISTINCT ON (so.product_id)
				so.product_id,
				so.seller_name,
				so.seller_rating,
				so.price_cents,
				so.original_price_cents
			FROM seller_offers so
			ORDER BY so.product_id, so.price_cents ASC, so.is_featured DESC
		)
		SELECT 
			p.id, p.title, p.slug, p.description, p.cover_image_url,
			p.platform, p.region, p.genre, to_char(p.release_date, 'YYYY-MM-DD'),
			COALESCE(os.lowest_price_cents, 0) AS lowest_price_cents,
			COALESCE(bo.original_price_cents, 0) AS original_price_cents,
			COALESCE(bo.seller_name, '') AS best_seller_name,
			COALESCE(bo.seller_rating, 0.0) AS best_seller_rating,
			COALESCE(os.total_stock_count, 0) AS total_stock_count,
			COALESCE(os.total_offers_count, 0) AS total_offers_count
		FROM products p
		LEFT JOIN offer_stats os ON os.product_id = p.id
		LEFT JOIN best_offer bo ON bo.product_id = p.id
		WHERE p.id = ANY($1)
	`

	rows, err := r.pool.Query(ctx, query, ids)
	if err != nil {
		return nil, fmt.Errorf("failed to query products by IDs: %w", err)
	}
	defer rows.Close()

	result := make(map[string]models.ProductSummary)
	for rows.Next() {
		var p models.ProductSummary
		if err := rows.Scan(
			&p.ID, &p.Title, &p.Slug, &p.Description, &p.CoverImageURL,
			&p.Platform, &p.Region, &p.Genre, &p.ReleaseDate,
			&p.LowestPriceCents, &p.OriginalPriceCents,
			&p.BestSellerName, &p.BestSellerRating,
			&p.TotalStockCount, &p.TotalOffersCount,
		); err != nil {
			return nil, fmt.Errorf("failed to scan product summary: %w", err)
		}
		if p.OriginalPriceCents > p.LowestPriceCents && p.OriginalPriceCents > 0 {
			discount := float64(p.OriginalPriceCents-p.LowestPriceCents) / float64(p.OriginalPriceCents) * 100.0
			p.DiscountPercent = int(math.Round(discount))
		}
		result[p.ID] = p
	}

	return result, rows.Err()
}

func (r *CatalogRepository) ListProducts(ctx context.Context, params models.ProductFilterParams) ([]models.ProductSummary, int, error) {
	var args []interface{}
	var whereConditions []string
	argIdx := 1

	var relevanceSelect string
	if params.Query != "" {
		relevanceSelect = fmt.Sprintf("GREATEST(similarity(p.title, $%d), word_similarity($%d, p.title)) AS relevance_score,", argIdx, argIdx)
		whereConditions = append(whereConditions, fmt.Sprintf("(similarity(p.title, $%d) > 0.15 OR word_similarity($%d, p.title) > 0.25 OR p.title ILIKE '%%' || $%d || '%%')", argIdx, argIdx, argIdx))
		args = append(args, params.Query)
		argIdx++
	} else {
		relevanceSelect = "0.0 AS relevance_score,"
	}

	if params.Platform != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("p.platform ILIKE '%%' || $%d || '%%'", argIdx))
		args = append(args, params.Platform)
		argIdx++
	}

	if params.Region != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("p.region = $%d", argIdx))
		args = append(args, params.Region)
		argIdx++
	}

	if params.Genre != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("p.genre ILIKE '%%' || $%d || '%%'", argIdx))
		args = append(args, params.Genre)
		argIdx++
	}

	whereClause := ""
	if len(whereConditions) > 0 {
		whereClause = "WHERE " + strings.Join(whereConditions, " AND ")
	}

	// Filter by price on lowest_price_cents
	var havingConditions []string
	if params.MinPriceCents != nil {
		havingConditions = append(havingConditions, fmt.Sprintf("COALESCE(os.lowest_price_cents, 0) >= $%d", argIdx))
		args = append(args, *params.MinPriceCents)
		argIdx++
	}
	if params.MaxPriceCents != nil {
		havingConditions = append(havingConditions, fmt.Sprintf("COALESCE(os.lowest_price_cents, 0) <= $%d", argIdx))
		args = append(args, *params.MaxPriceCents)
		argIdx++
	}

	havingClause := ""
	if len(havingConditions) > 0 {
		havingClause = "WHERE " + strings.Join(havingConditions, " AND ")
	}

	// Determine ordering
	var orderBy string
	switch params.Sort {
	case "price_asc":
		orderBy = "ORDER BY lowest_price_cents ASC, id"
	case "price_desc":
		orderBy = "ORDER BY lowest_price_cents DESC, id"
	case "newest":
		orderBy = "ORDER BY release_date DESC, created_at DESC"
	case "popular":
		fallthrough
	default:
		if params.Query != "" {
			orderBy = "ORDER BY relevance_score DESC, total_stock_count DESC"
		} else {
			orderBy = "ORDER BY total_stock_count DESC, created_at DESC"
		}
	}

	limit := params.Limit
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	baseQuery := fmt.Sprintf(`
		WITH offer_stats AS (
			SELECT 
				so.product_id,
				MIN(so.price_cents) AS lowest_price_cents,
				COUNT(DISTINCT so.id) AS total_offers_count,
				COALESCE(SUM(CASE WHEN dk.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) AS total_stock_count
			FROM seller_offers so
			LEFT JOIN digital_keys dk ON dk.seller_offer_id = so.id
			GROUP BY so.product_id
		),
		best_offer AS (
			SELECT DISTINCT ON (so.product_id)
				so.product_id,
				so.seller_name,
				so.seller_rating,
				so.price_cents,
				so.original_price_cents
			FROM seller_offers so
			ORDER BY so.product_id, so.price_cents ASC, so.is_featured DESC
		),
		filtered_products AS (
			SELECT 
				p.id, p.title, p.slug, p.description, p.cover_image_url,
				p.platform, p.region, p.genre, to_char(p.release_date, 'YYYY-MM-DD') AS release_date,
				p.created_at,
				%s
				COALESCE(os.lowest_price_cents, 0) AS lowest_price_cents,
				COALESCE(bo.original_price_cents, 0) AS original_price_cents,
				COALESCE(bo.seller_name, '') AS best_seller_name,
				COALESCE(bo.seller_rating, 0.0) AS best_seller_rating,
				COALESCE(os.total_stock_count, 0) AS total_stock_count,
				COALESCE(os.total_offers_count, 0) AS total_offers_count
			FROM products p
			LEFT JOIN offer_stats os ON os.product_id = p.id
			LEFT JOIN best_offer bo ON bo.product_id = p.id
			%s
		)
		SELECT 
			id, title, slug, description, cover_image_url,
			platform, region, genre, release_date,
			relevance_score, lowest_price_cents, original_price_cents,
			best_seller_name, best_seller_rating, total_stock_count, total_offers_count,
			COUNT(*) OVER() AS full_count
		FROM filtered_products
		%s
		%s
		LIMIT $%d OFFSET $%d
	`, relevanceSelect, whereClause, havingClause, orderBy, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := r.pool.Query(ctx, baseQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query products list: %w", err)
	}
	defer rows.Close()

	var products []models.ProductSummary
	totalCount := 0

	for rows.Next() {
		var p models.ProductSummary
		var count int
		if err := rows.Scan(
			&p.ID, &p.Title, &p.Slug, &p.Description, &p.CoverImageURL,
			&p.Platform, &p.Region, &p.Genre, &p.ReleaseDate,
			&p.RelevanceScore, &p.LowestPriceCents, &p.OriginalPriceCents,
			&p.BestSellerName, &p.BestSellerRating, &p.TotalStockCount, &p.TotalOffersCount,
			&count,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan product summary row: %w", err)
		}
		totalCount = count
		if p.OriginalPriceCents > p.LowestPriceCents && p.OriginalPriceCents > 0 {
			discount := float64(p.OriginalPriceCents-p.LowestPriceCents) / float64(p.OriginalPriceCents) * 100.0
			p.DiscountPercent = int(math.Round(discount))
		}
		products = append(products, p)
	}

	return products, totalCount, rows.Err()
}

func (r *CatalogRepository) GetProductBySlug(ctx context.Context, slug string) (*models.ProductDetail, error) {
	// 1. Fetch Product
	productQuery := `
		WITH offer_stats AS (
			SELECT 
				so.product_id,
				MIN(so.price_cents) AS lowest_price_cents,
				COUNT(DISTINCT so.id) AS total_offers_count,
				COALESCE(SUM(CASE WHEN dk.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) AS total_stock_count
			FROM seller_offers so
			LEFT JOIN digital_keys dk ON dk.seller_offer_id = so.id
			GROUP BY so.product_id
		),
		best_offer AS (
			SELECT DISTINCT ON (so.product_id)
				so.product_id,
				so.seller_name,
				so.seller_rating,
				so.price_cents,
				so.original_price_cents
			FROM seller_offers so
			ORDER BY so.product_id, so.price_cents ASC, so.is_featured DESC
		)
		SELECT 
			p.id, p.title, p.slug, p.description, p.cover_image_url,
			p.platform, p.region, p.genre, to_char(p.release_date, 'YYYY-MM-DD'),
			COALESCE(os.lowest_price_cents, 0) AS lowest_price_cents,
			COALESCE(bo.original_price_cents, 0) AS original_price_cents,
			COALESCE(bo.seller_name, '') AS best_seller_name,
			COALESCE(bo.seller_rating, 0.0) AS best_seller_rating,
			COALESCE(os.total_stock_count, 0) AS total_stock_count,
			COALESCE(os.total_offers_count, 0) AS total_offers_count
		FROM products p
		LEFT JOIN offer_stats os ON os.product_id = p.id
		LEFT JOIN best_offer bo ON bo.product_id = p.id
		WHERE p.slug = $1
	`

	var detail models.ProductDetail
	err := r.pool.QueryRow(ctx, productQuery, slug).Scan(
		&detail.ID, &detail.Title, &detail.Slug, &detail.Description, &detail.CoverImageURL,
		&detail.Platform, &detail.Region, &detail.Genre, &detail.ReleaseDate,
		&detail.LowestPriceCents, &detail.OriginalPriceCents,
		&detail.BestSellerName, &detail.BestSellerRating,
		&detail.TotalStockCount, &detail.TotalOffersCount,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil // Not found
		}
		return nil, fmt.Errorf("failed to query product detail: %w", err)
	}

	if detail.OriginalPriceCents > detail.LowestPriceCents && detail.OriginalPriceCents > 0 {
		discount := float64(detail.OriginalPriceCents-detail.LowestPriceCents) / float64(detail.OriginalPriceCents) * 100.0
		detail.DiscountPercent = int(math.Round(discount))
	}

	// 2. Fetch associated seller offers with live digital keys available count
	offersQuery := `
		SELECT 
			so.id, so.product_id, so.seller_name, so.seller_rating, so.review_count,
			so.price_cents, so.original_price_cents, so.is_featured,
			COALESCE(COUNT(dk.id) FILTER (WHERE dk.status = 'AVAILABLE'), 0) AS available_keys_count,
			so.created_at, so.updated_at
		FROM seller_offers so
		LEFT JOIN digital_keys dk ON dk.seller_offer_id = so.id
		WHERE so.product_id = $1
		GROUP BY so.id
		ORDER BY so.price_cents ASC
	`

	rows, err := r.pool.Query(ctx, offersQuery, detail.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to query seller offers: %w", err)
	}
	defer rows.Close()

	var offers []models.SellerOfferWithStock
	for rows.Next() {
		var o models.SellerOfferWithStock
		if err := rows.Scan(
			&o.ID, &o.ProductID, &o.SellerName, &o.SellerRating, &o.ReviewCount,
			&o.PriceCents, &o.OriginalPriceCents, &o.IsFeatured,
			&o.AvailableKeysCount, &o.CreatedAt, &o.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan seller offer: %w", err)
		}
		o.InStock = o.AvailableKeysCount > 0
		if o.OriginalPriceCents > o.PriceCents && o.OriginalPriceCents > 0 {
			discount := float64(o.OriginalPriceCents-o.PriceCents) / float64(o.OriginalPriceCents) * 100.0
			o.DiscountPercent = int(math.Round(discount))
		}
		offers = append(offers, o)
	}

	detail.Offers = offers
	return &detail, rows.Err()
}
