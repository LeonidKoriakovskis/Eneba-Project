package handlers

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/services"
)

type AuthHandler struct {
	authService  *services.AuthService
	emailService *services.EmailService
}

func NewAuthHandler(authService *services.AuthService, emailService *services.EmailService) *AuthHandler {
	return &AuthHandler{authService: authService, emailService: emailService}
}

// HandleRegister serves POST /api/auth/register
func (h *AuthHandler) HandleRegister(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.RegisterRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	resp, err := h.authService.Register(r.Context(), req)
	if err != nil {
		var vErr *services.ValidationError
		switch {
		case errors.As(err, &vErr):
			writeError(w, http.StatusBadRequest, vErr.Message)
		case errors.Is(err, services.ErrEmailTaken):
			writeError(w, http.StatusConflict, "An account with this email already exists")
		default:
			log.Printf("register error: %v", err)
			writeError(w, http.StatusInternalServerError, "Failed to register user")
		}
		return
	}

	if h.emailService != nil {
		h.emailService.SendWelcomeEmailAsync(resp.User.Email, resp.User.FullName)
	}

	writeJSON(w, http.StatusCreated, resp)
}

// HandleLogin serves POST /api/auth/login
func (h *AuthHandler) HandleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	var req models.LoginRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	resp, err := h.authService.Login(r.Context(), req)
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			writeError(w, http.StatusUnauthorized, "Invalid email or password")
			return
		}
		log.Printf("login error: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to log in")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// decodeJSON reads a size-limited JSON body; it writes a 400 and returns false on failure.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON request body")
		return false
	}
	return true
}
