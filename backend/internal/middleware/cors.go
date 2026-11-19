package middleware

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/go-chi/cors"
)

// IsAllowedOrigin reports whether an HTTP Origin header is authorized to call the API.
// It always permits localhost development origins, configured origins/wildcards, and any
// Vercel HTTPS deployment (https://*.vercel.app, including https://eneba-project-lime.vercel.app).
func IsAllowedOrigin(origin string, configured []string) bool {
	normalized := strings.TrimRight(strings.TrimSpace(origin), "/")
	if normalized == "" {
		return false
	}

	parsed, err := url.Parse(normalized)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return false
	}

	scheme := strings.ToLower(parsed.Scheme)
	host := strings.ToLower(parsed.Hostname())

	if scheme == "https" && (host == "eneba-project-lime.vercel.app" || strings.HasSuffix(host, ".vercel.app")) {
		return true
	}

	if scheme == "http" && (host == "localhost" || host == "127.0.0.1") {
		return true
	}

	originLower := strings.ToLower(normalized)
	for _, entry := range configured {
		candidate := strings.ToLower(strings.TrimRight(strings.TrimSpace(entry), "/"))
		if candidate == "" {
			continue
		}
		if candidate == "*" || candidate == originLower {
			return true
		}
		if strings.HasPrefix(candidate, "https://*.") && scheme == "https" {
			suffix := strings.TrimPrefix(candidate, "https://*")
			if strings.HasSuffix(host, suffix) && len(host) > len(suffix) {
				return true
			}
		}
	}

	return false
}

// CORS returns Chi-compatible CORS middleware wired with dynamic Vercel and configured origin checks.
func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowOriginFunc: func(_ *http.Request, origin string) bool {
			return IsAllowedOrigin(origin, allowedOrigins)
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}
