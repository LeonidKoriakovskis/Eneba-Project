package config

import (
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	JWTSecret       string
	AllowedOrigins  []string
	Environment     string
}

func Load() *Config {
	// Try loading from .env if present (in root or backend)
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	port := getEnv("PORT", "8080")
	dbURL := getEnv("DATABASE_URL", "postgres://eneba_user:eneba_password@localhost:5432/eneba_marketplace?sslmode=disable")
	jwtSecret := getEnv("JWT_SECRET", "super-secret-development-jwt-key-change-in-production-min32chars")
	originsStr := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
	env := getEnv("ENV", "development")

	var origins []string
	for _, o := range strings.Split(originsStr, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}

	return &Config{
		Port:           port,
		DatabaseURL:    dbURL,
		JWTSecret:      jwtSecret,
		AllowedOrigins: origins,
		Environment:    env,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
