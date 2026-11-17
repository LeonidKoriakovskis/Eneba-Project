package config

import (
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	JWTExpirationHours int
	AllowedOrigins     []string
	Environment        string
}

func Load() *Config {
	// Try loading from .env if present (in root or backend)
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	originsStr := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")

	var origins []string
	for _, o := range strings.Split(originsStr, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}

	expHours, err := strconv.Atoi(getEnv("JWT_EXPIRATION_HOURS", "72"))
	if err != nil || expHours <= 0 {
		expHours = 72
	}

	return &Config{
		Port:               getEnv("PORT", "8080"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://eneba_user:eneba_password@localhost:5432/eneba_marketplace?sslmode=disable"),
		JWTSecret:          getEnv("JWT_SECRET", "super-secret-development-jwt-key-change-in-production-min32chars"),
		JWTExpirationHours: expHours,
		AllowedOrigins:     origins,
		Environment:        getEnv("ENV", "development"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
