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
	FrontendURL        string
	StripeSecretKey    string
	ResendAPIKey       string
	EmailFrom          string
}

func Load() *Config {
	// Try loading from .env / .env.local (in backend dir or repo root)
	_ = godotenv.Load(".env")
	_ = godotenv.Load(".env.local")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load("../.env.local")

	originsStr := os.Getenv("ALLOWED_ORIGINS")
	if originsStr == "" {
		originsStr = getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
	}

	var origins []string
	for _, o := range strings.Split(originsStr, ",") {
		o = strings.TrimRight(strings.TrimSpace(o), "/")
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
		FrontendURL:        strings.TrimRight(getEnv("FRONTEND_URL", "http://localhost:5173"), "/"),
		StripeSecretKey:    strings.TrimSpace(os.Getenv("STRIPE_SECRET_KEY")),
		ResendAPIKey:       strings.TrimSpace(os.Getenv("RESEND_API_KEY")),
		EmailFrom:          getEnv("EMAIL_FROM", "onboarding@resend.dev"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
