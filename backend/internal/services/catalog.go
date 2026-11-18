package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/repository"
)

var (
	ErrProductNotFound = errors.New("product not found")
)

type CatalogService struct {
	repo *repository.CatalogRepository
}

func NewCatalogService(repo *repository.CatalogRepository) *CatalogService {
	return &CatalogService{repo: repo}
}

func (s *CatalogService) GetHomepage(ctx context.Context) ([]models.HydratedHomepageBlock, error) {
	blocks, err := s.repo.GetActiveHomepageBlocks(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch active blocks: %w", err)
	}

	// 1. Collect all referenced product IDs across all blocks
	productIDMap := make(map[string]bool)
	type BlockMeta struct {
		ConfigMap  map[string]interface{}
		ProductIDs []string
	}
	blockMetas := make([]BlockMeta, len(blocks))

	for i, b := range blocks {
		var cfg map[string]interface{}
		if err := json.Unmarshal(b.Config, &cfg); err != nil {
			cfg = make(map[string]interface{})
		}

		var pids []string

		// Check for "product_ids": ["uuid", ...]
		if rawPids, ok := cfg["product_ids"].([]interface{}); ok {
			for _, item := range rawPids {
				if idStr, ok := item.(string); ok && idStr != "" {
					pids = append(pids, idStr)
					productIDMap[idStr] = true
				}
			}
		}

		// Check for "items": [{"product_id": "uuid", ...}] in hero_banner
		if rawItems, ok := cfg["items"].([]interface{}); ok {
			for _, item := range rawItems {
				if itemMap, ok := item.(map[string]interface{}); ok {
					if idStr, ok := itemMap["product_id"].(string); ok && idStr != "" {
						pids = append(pids, idStr)
						productIDMap[idStr] = true
					}
				}
			}
		}

		blockMetas[i] = BlockMeta{
			ConfigMap:  cfg,
			ProductIDs: pids,
		}
	}

	// 2. Fetch all products in a single batch query
	var allIDs []string
	for id := range productIDMap {
		allIDs = append(allIDs, id)
	}

	productsMap, err := s.repo.GetProductsByIDs(ctx, allIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to batch load block products: %w", err)
	}

	// 3. Hydrate each block
	hydrated := make([]models.HydratedHomepageBlock, len(blocks))
	for i, b := range blocks {
		meta := blockMetas[i]
		var blockProducts []models.ProductSummary

		for _, pid := range meta.ProductIDs {
			if prod, exists := productsMap[pid]; exists {
				blockProducts = append(blockProducts, prod)
			}
		}

		// If hero_banner has items, also enrich each item with live lowest price & stock
		if rawItems, ok := meta.ConfigMap["items"].([]interface{}); ok {
			for j, item := range rawItems {
				if itemMap, ok := item.(map[string]interface{}); ok {
					if idStr, ok := itemMap["product_id"].(string); ok {
						if prod, exists := productsMap[idStr]; exists {
							itemMap["lowest_price_cents"] = prod.LowestPriceCents
							itemMap["original_price_cents"] = prod.OriginalPriceCents
							itemMap["discount_percent"] = prod.DiscountPercent
							itemMap["total_stock_count"] = prod.TotalStockCount
							itemMap["product_slug"] = prod.Slug
							rawItems[j] = itemMap
						}
					}
				}
			}
			meta.ConfigMap["items"] = rawItems
		}

		hydrated[i] = models.HydratedHomepageBlock{
			ID:        b.ID,
			BlockType: b.BlockType,
			Title:     b.Title,
			SortOrder: b.SortOrder,
			Config:    meta.ConfigMap,
			Products:  blockProducts,
		}
	}

	return hydrated, nil
}

func (s *CatalogService) ListProducts(ctx context.Context, params models.ProductFilterParams) (*models.ProductListResponse, error) {
	products, total, err := s.repo.ListProducts(ctx, params)
	if err != nil {
		return nil, err
	}

	if products == nil {
		products = []models.ProductSummary{}
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}

	return &models.ProductListResponse{
		Products:   products,
		TotalCount: total,
		Limit:      limit,
		Offset:     params.Offset,
	}, nil
}

func (s *CatalogService) GetProductBySlug(ctx context.Context, slug string) (*models.ProductDetail, error) {
	if slug == "" {
		return nil, ErrProductNotFound
	}

	product, err := s.repo.GetProductBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if product == nil {
		return nil, ErrProductNotFound
	}

	return product, nil
}


// EnsureCatalogArtwork keeps seeded vertical box art and hero banner images synced on startup.
func (s *CatalogService) EnsureCatalogArtwork(ctx context.Context) error {
	if err := s.repo.EnsureFeaturedGTAVI(ctx); err != nil {
		return err
	}

	covers := map[string]string{
		"11111111-0000-0000-0000-000000000001": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000002": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000003": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/292030/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000004": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2669320/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000005": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/271590/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000006": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/553850/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000007": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000008": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000009": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2322010/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000010": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/990080/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000011": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1551360/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000012": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1817070/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000013": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2050650/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000014": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2344520/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000015": "https://upload.wikimedia.org/wikipedia/en/f/fb/The_Legend_of_Zelda_Tears_of_the_Kingdom_cover.jpg",
		"11111111-0000-0000-0000-000000000016": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/library_600x900.jpg",
		"11111111-0000-0000-0000-000000000017": "https://upload.wikimedia.org/wikipedia/en/4/46/Grand_Theft_Auto_VI.png",
	}
	if err := s.repo.SyncProductCovers(ctx, covers); err != nil {
		return err
	}

	heroBanners := map[string]string{
		"11111111-0000-0000-0000-000000000017": "https://upload.wikimedia.org/wikipedia/en/4/46/Grand_Theft_Auto_VI.png",
		"11111111-0000-0000-0000-000000000016": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2358720/library_hero.jpg",
		"11111111-0000-0000-0000-000000000002": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1245620/library_hero.jpg",
		"11111111-0000-0000-0000-000000000001": "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1091500/library_hero.jpg",
	}
	return s.repo.SyncHeroBannerImages(ctx, "30000000-0000-0000-0000-000000000001", heroBanners)
}
