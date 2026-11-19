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

	frontendURL := strings.TrimRight(getEnv("FRONTEND_URL", "http://localhost:5173"), "/")

	seenOrigins := make(map[string]struct{})
	var origins []string
	addOrigins := func(csv string) {
		for _, o := range strings.Split(csv, ",") {
			cleaned := strings.TrimRight(strings.TrimSpace(o), "/")
			if cleaned == "" {
				continue
			}
			key := strings.ToLower(cleaned)
			if _, exists := seenOrigins[key]; !exists {
				seenOrigins[key] = struct{}{}
				origins = append(origins, cleaned)
			}
		}
	}

	addOrigins(os.Getenv("ALLOWED_ORIGINS"))
	addOrigins(os.Getenv("CORS_ALLOWED_ORIGINS"))
	addOrigins(frontendURL)
	addOrigins("https://eneba-project-lime.vercel.app,http://localhost:5173,http://localhost:3000")

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
		FrontendURL:        frontendURL,
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
