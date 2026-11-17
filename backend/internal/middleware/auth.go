package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"eneba-marketplace/backend/internal/auth"
)

type ctxKey struct{}

// Authenticate validates the "Authorization: Bearer <token>" header and stores
// the authenticated user_id in the request context.
func Authenticate(tm *auth.TokenManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			parts := strings.SplitN(header, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
				unauthorized(w, "Missing or malformed Authorization header")
				return
			}

			userID, err := tm.Parse(strings.TrimSpace(parts[1]))
			if err != nil {
				unauthorized(w, "Invalid or expired token")
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
