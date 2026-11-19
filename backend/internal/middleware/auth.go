package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"eneba-marketplace/backend/internal/auth"
)

type ctxKey struct{}

// extractToken reads the JWT from the Authorization Bearer header first, falling back to
// auth cookies ("eneba_token" or "token") when browsers send cross-site credentials.
func extractToken(r *http.Request) (string, string) {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if header != "" {
		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
			return "", "malformed Authorization header"
		}
		return strings.TrimSpace(parts[1]), ""
	}

	for _, name := range []string{"eneba_token", "token"} {
		if cookie, err := r.Cookie(name); err == nil && strings.TrimSpace(cookie.Value) != "" {
			return strings.TrimSpace(cookie.Value), ""
		}
	}

	return "", "missing Authorization Bearer header or auth cookie"
}

// Authenticate validates the Bearer JWT header or auth cookie and stores
// the authenticated user_id in the request context.
func Authenticate(tm *auth.TokenManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr, reason := extractToken(r)
			if tokenStr == "" {
				log.Printf("[auth] %s %s rejected (401): %s", r.Method, r.URL.Path, reason)
				unauthorized(w, fmt.Sprintf("Authentication failed: %s", reason))
				return
			}

			userID, err := tm.Parse(tokenStr)
			if err != nil {
				log.Printf("[auth] %s %s token parse failed (401): %v", r.Method, r.URL.Path, err)
				unauthorized(w, fmt.Sprintf("Invalid or expired token: %v", err))
				return
			}

			ctx := context.WithValue(r.Context(), ctxKey{}, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext returns the authenticated user ID set by Authenticate.
func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(ctxKey{}).(string)
	return id, ok && id != ""
}

func unauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("WWW-Authenticate", `Bearer realm="eneba-marketplace"`)
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
