package repository

import (
	"context"
	"encoding/json"
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

	platforms := normalizePlatformFilters(params.Platforms, params.Platform)
	if len(platforms) > 0 {
		whereConditions = append(whereConditions, fmt.Sprintf("LOWER(p.platform) = ANY($%d)", argIdx))
		args = append(args, platforms)
		argIdx++
	}

	regions := normalizeRegionFilters(params.Regions, params.Region)
	if len(regions) > 0 {
		whereConditions = append(whereConditions, fmt.Sprintf("LOWER(p.region) = ANY($%d)", argIdx))
		args = append(args, regions)
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

	// Filter by computed lowest_price_cents directly on the filtered_products CTE
	var priceConditions []string
	if params.MinPriceCents != nil {
		priceConditions = append(priceConditions, fmt.Sprintf("lowest_price_cents >= $%d", argIdx))
		args = append(args, *params.MinPriceCents)
		argIdx++
	}
	if params.MaxPriceCents != nil {
		priceConditions = append(priceConditions, fmt.Sprintf("lowest_price_cents <= $%d", argIdx))
		args = append(args, *params.MaxPriceCents)
		argIdx++
	}

	priceWhereClause := ""
	if len(priceConditions) > 0 {
		priceWhereClause = "WHERE " + strings.Join(priceConditions, " AND ")
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
	`, relevanceSelect, whereClause, priceWhereClause, orderBy, argIdx, argIdx+1)

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


// EnsureFeaturedGTAVI idempotently upserts Grand Theft Auto VI, its competing seller offers,
// available digital keys, and homepage spotlight placement so existing DBs receive it on startup.
func (r *CatalogRepository) EnsureFeaturedGTAVI(ctx context.Context) error {
	const gtaProductID = "11111111-0000-0000-0000-000000000017"
	const gtaCoverURL = "https://upload.wikimedia.org/wikipedia/en/4/46/Grand_Theft_Auto_VI.png"

	if _, err := r.pool.Exec(ctx, `
		INSERT INTO products (id, title, slug, description, cover_image_url, platform, region, genre, release_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (id) DO UPDATE SET
			title = EXCLUDED.title,
			slug = EXCLUDED.slug,
			description = EXCLUDED.description,
			cover_image_url = EXCLUDED.cover_image_url,
			platform = EXCLUDED.platform,
			region = EXCLUDED.region,
			genre = EXCLUDED.genre,
			release_date = EXCLUDED.release_date,
			updated_at = NOW()
	`,
		gtaProductID,
		"Grand Theft Auto VI",
		"grand-theft-auto-vi",
		"Head to the state of Leonida, home to the neon-soaked streets of Vice City and beyond, in the biggest, most immersive evolution of the Grand Theft Auto series yet. Tags: Action, Open World, Blockbuster.",
		gtaCoverURL,
		"PSN",
		"GLOBAL",
		"Action / Open World / Blockbuster",
		"2025-11-19",
	); err != nil {
		return fmt.Errorf("failed to upsert Grand Theft Auto VI product: %w", err)
	}

	type offerSeed struct {
		id            string
		sellerName    string
		rating        float64
		reviews       int
		priceCents    int
		originalCents int
		featured      bool
	}
	offers := []offerSeed{
		{"20000017-0000-0000-0000-000000000001", "RockstarVault", 4.99, 6420, 6999, 8999, true},
		{"20000017-0000-0000-0000-000000000002", "KeyEmpire", 4.95, 2890, 7250, 8999, false},
		{"20000017-0000-0000-0000-000000000003", "NordicKeys", 4.91, 1540, 7499, 8999, false},
	}
	for _, o := range offers {
		if _, err := r.pool.Exec(ctx, `
			INSERT INTO seller_offers (id, product_id, seller_name, seller_rating, review_count, price_cents, original_price_cents, is_featured)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				seller_name = EXCLUDED.seller_name,
				seller_rating = EXCLUDED.seller_rating,
				review_count = EXCLUDED.review_count,
				price_cents = EXCLUDED.price_cents,
				original_price_cents = EXCLUDED.original_price_cents,
				is_featured = EXCLUDED.is_featured,
				updated_at = NOW()
		`, o.id, gtaProductID, o.sellerName, o.rating, o.reviews, o.priceCents, o.originalCents, o.featured); err != nil {
			return fmt.Errorf("failed to upsert GTA VI seller offer %s: %w", o.sellerName, err)
		}
	}

	keySeeds := []struct {
		offerID string
		key     string
	}{
		{"20000017-0000-0000-0000-000000000001", "GTA6-RV01-1001"},
		{"20000017-0000-0000-0000-000000000001", "GTA6-RV01-1002"},
		{"20000017-0000-0000-0000-000000000001", "GTA6-RV01-1003"},
		{"20000017-0000-0000-0000-000000000001", "GTA6-RV01-1004"},
		{"20000017-0000-0000-0000-000000000002", "GTA6-KE02-2001"},
		{"20000017-0000-0000-0000-000000000002", "GTA6-KE02-2002"},
		{"20000017-0000-0000-0000-000000000002", "GTA6-KE02-2003"},
		{"20000017-0000-0000-0000-000000000002", "GTA6-KE02-2004"},
		{"20000017-0000-0000-0000-000000000003", "GTA6-NK03-3001"},
		{"20000017-0000-0000-0000-000000000003", "GTA6-NK03-3002"},
		{"20000017-0000-0000-0000-000000000003", "GTA6-NK03-3003"},
		{"20000017-0000-0000-0000-000000000003", "GTA6-NK03-3004"},
	}
	for _, ks := range keySeeds {
		if _, err := r.pool.Exec(ctx, `
			INSERT INTO digital_keys (seller_offer_id, license_key, status)
			VALUES ($1, $2, 'AVAILABLE')
			ON CONFLICT (license_key) DO NOTHING
		`, ks.offerID, ks.key); err != nil {
			return fmt.Errorf("failed to seed GTA VI key %s: %w", ks.key, err)
		}
	}

	// Ensure GTA VI is the #1 slide in hero_banner (30000000-0000-0000-0000-000000000001)
	if err := r.ensureHeroSlideFirst(ctx, "30000000-0000-0000-0000-000000000001", map[string]interface{}{
		"product_id":   gtaProductID,
		"headline":     "Grand Theft Auto VI",
		"subheading":   "Return to Vice City & Leonida — Secure Your PSN Global Key",
		"badge":        "MOST ANTICIPATED",
		"banner_image": gtaCoverURL,
		"cta_text":     "Pre-Order Key from €69.99",
	}); err != nil {
		return err
	}

	// Ensure GTA VI is the #1 product in best_sellers (30000000-0000-0000-0000-000000000002)
	if err := r.ensureBlockProductFirst(ctx, "30000000-0000-0000-0000-000000000002", gtaProductID, 8); err != nil {
		return err
	}

	return nil
}

func (r *CatalogRepository) ensureHeroSlideFirst(ctx context.Context, blockID string, slide map[string]interface{}) error {
	var raw []byte
	err := r.pool.QueryRow(ctx, `SELECT config FROM homepage_blocks WHERE id = $1`, blockID).Scan(&raw)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return fmt.Errorf("failed to load hero_banner for GTA VI migration: %w", err)
	}

	var cfg map[string]interface{}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil
	}

	targetID, _ := slide["product_id"].(string)
	existingItems, _ := cfg["items"].([]interface{})
	if len(existingItems) > 0 {
		if first, ok := existingItems[0].(map[string]interface{}); ok {
			if firstID, _ := first["product_id"].(string); firstID == targetID {
				return nil
			}
		}
	}

	reordered := []interface{}{slide}
	for _, item := range existingItems {
		if m, ok := item.(map[string]interface{}); ok {
			if pid, _ := m["product_id"].(string); pid == targetID {
				continue
			}
		}
		reordered = append(reordered, item)
	}
	cfg["items"] = reordered

	updated, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `UPDATE homepage_blocks SET config = $1, updated_at = NOW() WHERE id = $2`, updated, blockID)
	return err
}

func (r *CatalogRepository) ensureBlockProductFirst(ctx context.Context, blockID string, productID string, maxLen int) error {
	var raw []byte
	err := r.pool.QueryRow(ctx, `SELECT config FROM homepage_blocks WHERE id = $1`, blockID).Scan(&raw)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return fmt.Errorf("failed to load block %s for GTA VI migration: %w", blockID, err)
	}

	var cfg map[string]interface{}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil
	}

	rawPids, _ := cfg["product_ids"].([]interface{})
	if len(rawPids) > 0 {
		if firstID, _ := rawPids[0].(string); firstID == productID {
			return nil
		}
	}

	reordered := []interface{}{productID}
	for _, item := range rawPids {
		if idStr, ok := item.(string); ok && idStr != "" && idStr != productID {
			reordered = append(reordered, idStr)
		}
	}
	if maxLen > 0 && len(reordered) > maxLen {
		reordered = reordered[:maxLen]
	}
	cfg["product_ids"] = reordered

	updated, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `UPDATE homepage_blocks SET config = $1, updated_at = NOW() WHERE id = $2`, updated, blockID)
	return err
}

// SyncProductCovers updates cover artwork for seeded products idempotently.
func (r *CatalogRepository) SyncProductCovers(ctx context.Context, covers map[string]string) error {
	for id, url := range covers {
		if _, err := r.pool.Exec(ctx, `
			UPDATE products SET cover_image_url = $1, updated_at = NOW()
			WHERE id = $2 AND cover_image_url <> $1
		`, url, id); err != nil {
			return fmt.Errorf("failed to sync cover for product %s: %w", id, err)
		}
	}
	return nil
}

// SyncHeroBannerImages updates banner_image URLs on the seeded hero_banner block idempotently.
func (r *CatalogRepository) SyncHeroBannerImages(ctx context.Context, blockID string, bannerByProduct map[string]string) error {
	var raw []byte
	err := r.pool.QueryRow(ctx, `SELECT config FROM homepage_blocks WHERE id = $1`, blockID).Scan(&raw)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil
		}
		return fmt.Errorf("failed to load hero_banner config: %w", err)
	}

	var cfg map[string]interface{}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil
	}

	items, ok := cfg["items"].([]interface{})
	if !ok {
		return nil
	}

	changed := false
	for i, item := range items {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		pid, _ := m["product_id"].(string)
		if targetURL, exists := bannerByProduct[pid]; exists && m["banner_image"] != targetURL {
			m["banner_image"] = targetURL
			items[i] = m
			changed = true
		}
	}
	if !changed {
		return nil
	}

	cfg["items"] = items
	updated, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	_, err = r.pool.Exec(ctx, `UPDATE homepage_blocks SET config = $1, updated_at = NOW() WHERE id = $2`, updated, blockID)
	return err
}


func normalizePlatformFilters(platforms []string, single string) []string {
	var raw []string
	raw = append(raw, platforms...)
	if strings.TrimSpace(single) != "" {
		raw = append(raw, strings.Split(single, ",")...)
	}

	seen := make(map[string]struct{})
	var normalized []string
	add := func(v string) {
		if _, exists := seen[v]; !exists {
			seen[v] = struct{}{}
			normalized = append(normalized, v)
		}
	}

	for _, item := range raw {
		val := strings.ToLower(strings.TrimSpace(item))
		if val == "" {
			continue
		}
		add(val)
		switch val {
		case "nintendo":
			add("nintendo switch")
		case "nintendo switch":
			add("nintendo")
		case "playstation":
			add("psn")
		case "psn":
			add("playstation")
		}
	}
	return normalized
}

func normalizeRegionFilters(regions []string, single string) []string {
	var raw []string
	raw = append(raw, regions...)
	if strings.TrimSpace(single) != "" {
		raw = append(raw, strings.Split(single, ",")...)
	}

	seen := make(map[string]struct{})
	var normalized []string
	for _, item := range raw {
		val := strings.ToLower(strings.TrimSpace(item))
		if val == "" {
			continue
		}
		if _, exists := seen[val]; !exists {
			seen[val] = struct{}{}
			normalized = append(normalized, val)
		}
	}
	return normalized
}
