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
	SMTPHost           string
	SMTPPort           string
	SMTPUser           string
	SMTPPass           string
}

// CleanEnvValue trims whitespace/newlines and strips accidental surrounding single/double quotes.
func CleanEnvValue(raw string) string {
	val := strings.TrimSpace(strings.Trim(raw, "\r\n"))
	for len(val) >= 2 {
		if (val[0] == '"' && val[len(val)-1] == '"') || (val[0] == '\'' && val[len(val)-1] == '\'') {
			val = strings.TrimSpace(val[1 : len(val)-1])
			continue
		}
		break
	}
	return val
}

// CleanFrontendURL normalizes FRONTEND_URL, ensuring a scheme and no trailing slash.
func CleanFrontendURL(raw, env string) string {
	val := strings.TrimRight(CleanEnvValue(raw), "/")
	if val == "" {
		if strings.EqualFold(env, "production") {
			return "https://eneba-project-lime.vercel.app"
		}
		return "http://localhost:5173"
	}
	if !strings.HasPrefix(strings.ToLower(val), "http://") && !strings.HasPrefix(strings.ToLower(val), "https://") {
		val = "https://" + val
	}
	return strings.TrimRight(val, "/")
}

func Load() *Config {
	// Try loading from .env / .env.local (in backend dir or repo root)
	_ = godotenv.Load(".env")
	_ = godotenv.Load(".env.local")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load("../.env.local")

	environment := getEnv("ENV", "development")
	frontendURL := CleanFrontendURL(os.Getenv("FRONTEND_URL"), environment)

	seenOrigins := make(map[string]struct{})
	var origins []string
	addOrigins := func(csv string) {
		for _, o := range strings.Split(CleanEnvValue(csv), ",") {
			cleaned := strings.TrimRight(CleanEnvValue(o), "/")
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
		Environment:        environment,
		FrontendURL:        frontendURL,
		StripeSecretKey:    CleanEnvValue(os.Getenv("STRIPE_SECRET_KEY")),
		ResendAPIKey:       CleanEnvValue(os.Getenv("RESEND_API_KEY")),
		EmailFrom:          getEnv("EMAIL_FROM", "onboarding@resend.dev"),
		SMTPHost:           CleanEnvValue(os.Getenv("SMTP_HOST")),
		SMTPPort:           getEnv("SMTP_PORT", "587"),
		SMTPUser:           CleanEnvValue(os.Getenv("SMTP_USER")),
		SMTPPass:           CleanEnvValue(os.Getenv("SMTP_PASS")),
	}
}

func getEnv(key, defaultVal string) string {
	if val := CleanEnvValue(os.Getenv(key)); val != "" {
		return val
	}
	return defaultVal
}
