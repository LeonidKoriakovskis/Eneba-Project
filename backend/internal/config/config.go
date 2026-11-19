package config

import (
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

const DefaultProdFrontendURL = "https://eneba-project-lime.vercel.app"

type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	JWTExpirationHours int
	AllowedOrigins     []string
	Environment        string
	FrontendURL        string
	StripeSecretKey    string
	BrevoAPIKey        string
	ResendAPIKey       string
	EmailFrom          string
	SMTPHost           string
	SMTPPort           string
	SMTPUser           string
	SMTPPass           string
	SMTPFrom           string
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

// ValidateSingleHTTPURL parses a concrete HTTP/HTTPS origin (rejecting wildcards like '*',
// commas, whitespace, or invalid hosts) and returns canonical scheme://host.
func ValidateSingleHTTPURL(raw string) (string, bool) {
	cleaned := CleanEnvValue(raw)
	if cleaned == "" || strings.ContainsAny(cleaned, "*, \t\r\n") {
		return "", false
	}

	lower := strings.ToLower(cleaned)
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		cleaned = "https://" + cleaned
	}

	u, err := url.Parse(cleaned)
	if err != nil {
		return "", false
	}
	scheme := strings.ToLower(u.Scheme)
	if (scheme != "http" && scheme != "https") || u.Host == "" {
		return "", false
	}
	return scheme + "://" + u.Host, true
}

// CleanFrontendURL normalizes FRONTEND_URL, picking the first valid non-wildcard HTTP/HTTPS URL
// or falling back to DefaultProdFrontendURL in production / http://localhost:5173 in dev.
func CleanFrontendURL(raw, env string) string {
	for _, token := range strings.Split(CleanEnvValue(raw), ",") {
		if valid, ok := ValidateSingleHTTPURL(token); ok {
			return valid
		}
	}
	if strings.EqualFold(CleanEnvValue(env), "production") {
		return DefaultProdFrontendURL
	}
	return "http://localhost:5173"
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
		BrevoAPIKey:        CleanEnvValue(os.Getenv("BREVO_API_KEY")),
		ResendAPIKey:       CleanEnvValue(os.Getenv("RESEND_API_KEY")),
		EmailFrom:          getEnv("EMAIL_FROM", "onboarding@resend.dev"),
		SMTPHost:           CleanEnvValue(os.Getenv("SMTP_HOST")),
		SMTPPort:           getEnv("SMTP_PORT", "587"),
		SMTPUser:           CleanEnvValue(os.Getenv("SMTP_USER")),
		SMTPPass:           CleanEnvValue(os.Getenv("SMTP_PASS")),
		SMTPFrom:           CleanEnvValue(os.Getenv("SMTP_FROM")),
	}
}

func getEnv(key, defaultVal string) string {
	if val := CleanEnvValue(os.Getenv(key)); val != "" {
		return val
	}
	return defaultVal
}
