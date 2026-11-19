package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

// resolveDirectDatabaseURL prefers DATABASE_URL_UNPOOLED (recommended by Neon for DDL
// migrations), falling back to stripping "-pooler." from DATABASE_URL if needed.
func resolveDirectDatabaseURL() string {
	_ = godotenv.Load(".env", ".env.local", "../.env", "../.env.local")

	if direct := strings.TrimSpace(os.Getenv("DATABASE_URL_UNPOOLED")); direct != "" {
		return direct
	}
	pooled := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if strings.Contains(pooled, "-pooler.") {
		return strings.Replace(pooled, "-pooler.", ".", 1)
	}
	return pooled
}

func main() {
	dbURL := resolveDirectDatabaseURL()
	if dbURL == "" {
		log.Fatal("DATABASE_URL_UNPOOLED or DATABASE_URL must be set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	cfg, err := pgx.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("invalid database URL: %v", err)
	}
	// Multi-statement migration scripts must use Postgres simple protocol.
	cfg.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		log.Fatalf("failed to connect to direct Postgres endpoint: %v", err)
	}
	defer conn.Close(ctx)

	migrations := []string{
		filepath.Join("migrations", "001_init.sql"),
		filepath.Join("migrations", "002_seed.sql"),
	}

	for _, path := range migrations {
		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("failed to read %s: %v", path, err)
		}
		if _, err := conn.Exec(ctx, string(sqlBytes)); err != nil {
			log.Fatalf("failed executing %s: %v", path, err)
		}
		log.Printf("✓ Applied %s", path)
	}

	var productCount, offerCount, availableKeys, blockCount int
	if err := conn.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM products),
			(SELECT COUNT(*) FROM seller_offers),
			(SELECT COUNT(*) FROM digital_keys WHERE status = 'AVAILABLE'),
			(SELECT COUNT(*) FROM homepage_blocks WHERE is_active = true)
	`).Scan(&productCount, &offerCount, &availableKeys, &blockCount); err != nil {
		log.Fatalf("verification query failed: %v", err)
	}

	var gtaTitle string
	if err := conn.QueryRow(ctx, `SELECT title FROM products WHERE slug = 'grand-theft-auto-vi'`).Scan(&gtaTitle); err != nil {
		log.Fatalf("GTA VI check failed: %v", err)
	}

	fmt.Printf("Neon production DB seeded successfully: products=%d offers=%d available_keys=%d active_blocks=%d spotlight=%q\n",
		productCount, offerCount, availableKeys, blockCount, gtaTitle)
}
