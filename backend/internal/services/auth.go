package services

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"eneba-marketplace/backend/internal/auth"
	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = repository.ErrEmailTaken
)

// ValidationError describes invalid client input (maps to HTTP 400).
type ValidationError struct{ Message string }

func (e *ValidationError) Error() string { return e.Message }

type AuthService struct {
	users  *repository.UserRepository
	tokens *auth.TokenManager
}

func NewAuthService(users *repository.UserRepository, tokens *auth.TokenManager) *AuthService {
	return &AuthService{users: users, tokens: tokens}
}

func (s *AuthService) Register(ctx context.Context, req models.RegisterRequest) (*models.AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	fullName := strings.TrimSpace(req.FullName)

	if addr, err := mail.ParseAddress(email); err != nil || addr.Address != email || len(email) > 255 {
		return nil, &ValidationError{"A valid email address is required"}
	}
	if len(fullName) < 2 || len(fullName) > 100 {
		return nil, &ValidationError{"full_name must be between 2 and 100 characters"}
	}
	if len(req.Password) < 8 {
		return nil, &ValidationError{"password must be at least 8 characters"}
	}
	if len(req.Password) > 72 { // bcrypt limit
		return nil, &ValidationError{"password must be at most 72 bytes"}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user, err := s.users.Create(ctx, email, string(hash), fullName)
	if err != nil {
		return nil, err
	}
	return s.buildResponse(user)
}

func (s *AuthService) Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error) {
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || req.Password == "" {
		return nil, ErrInvalidCredentials
	}

	user, err := s.users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}
	return s.buildResponse(user)
}

func (s *AuthService) buildResponse(u *models.User) (*models.AuthResponse, error) {
	token, err := s.tokens.Generate(u.ID)
	if err != nil {
		return nil, err
	}
	return &models.AuthResponse{
		Token: token,
		User:  models.UserProfile{ID: u.ID, Email: u.Email, FullName: u.FullName},
	}, nil
}
