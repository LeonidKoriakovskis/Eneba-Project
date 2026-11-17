package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"eneba-marketplace/backend/internal/models"
)

const defaultStripeBaseURL = "https://api.stripe.com"

var (
	ErrStripeDisabled = errors.New("stripe checkout is not configured on the server")
	ErrStripeUnpaid   = errors.New("stripe checkout session is not paid")
	ErrStripeAPI      = errors.New("stripe api error")
)

type StripeService struct {
	secretKey   string
	frontendURL string
	baseURL     string
	client      *http.Client
}

func NewStripeService(secretKey, frontendURL string) *StripeService {
	trimmedFront := strings.TrimRight(strings.TrimSpace(frontendURL), "/")
	if trimmedFront == "" {
		trimmedFront = "http://localhost:5173"
	}
	return &StripeService{
		secretKey:   strings.TrimSpace(secretKey),
		frontendURL: trimmedFront,
		baseURL:     defaultStripeBaseURL,
		client:      &http.Client{Timeout: 10 * time.Second},
	}
}

// SetBaseURL overrides the Stripe REST endpoint (primarily for httptest integration tests).
func (s *StripeService) SetBaseURL(baseURL string) {
	s.baseURL = strings.TrimRight(baseURL, "/")
}

func (s *StripeService) Enabled() bool {
	return s.secretKey != ""
}

type stripeAPIErrorPayload struct {
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

type stripeCheckoutSessionPayload struct {
	ID            string `json:"id"`
	URL           string `json:"url"`
	PaymentStatus string `json:"payment_status"`
	Status        string `json:"status"`
}

// CreateCheckoutSession creates a hosted Stripe Checkout Session in Test Mode for the given DB-verified lines.
func (s *StripeService) CreateCheckoutSession(ctx context.Context, lines []models.CheckoutLinePreview, userID string) (*models.StripeSessionResponse, error) {
	if !s.Enabled() {
		return nil, ErrStripeDisabled
	}

	form := url.Values{}
	form.Set("mode", "payment")
	form.Set("success_url", s.frontendURL+"/checkout/success?session_id={CHECKOUT_SESSION_ID}")
	form.Set("cancel_url", s.frontendURL+"/checkout?canceled=1")
	form.Set("client_reference_id", userID)

	for i, line := range lines {
		prefix := fmt.Sprintf("line_items[%d]", i)
		form.Set(prefix+"[price_data][currency]", "eur")
		form.Set(prefix+"[price_data][unit_amount]", strconv.Itoa(line.UnitPriceCents))
		form.Set(prefix+"[price_data][product_data][name]", line.ProductTitle)
		form.Set(
			prefix+"[price_data][product_data][description]",
			fmt.Sprintf("%s · %s · Seller: %s", line.Platform, line.Region, line.SellerName),
		)
		form.Set(prefix+"[quantity]", strconv.Itoa(line.Quantity))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/v1/checkout/sessions", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("%w: build request: %v", ErrStripeAPI, err)
	}
	req.Header.Set("Authorization", "Bearer "+s.secretKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	payload, err := s.doStripeRequest(req)
	if err != nil {
		return nil, err
	}
	if payload.ID == "" || payload.URL == "" {
		return nil, fmt.Errorf("%w: stripe response missing session id or redirect url", ErrStripeAPI)
	}

	return &models.StripeSessionResponse{
		URL:       payload.URL,
		SessionID: payload.ID,
	}, nil
}

// VerifySessionPaid fetches the Stripe Checkout Session and ensures payment_status is "paid".
func (s *StripeService) VerifySessionPaid(ctx context.Context, sessionID string) error {
	if !s.Enabled() {
		return ErrStripeDisabled
	}
	if strings.TrimSpace(sessionID) == "" {
		return fmt.Errorf("%w: empty session_id", ErrStripeUnpaid)
	}

	endpoint := s.baseURL + "/v1/checkout/sessions/" + url.PathEscape(sessionID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return fmt.Errorf("%w: build verification request: %v", ErrStripeAPI, err)
	}
	req.Header.Set("Authorization", "Bearer "+s.secretKey)

	payload, err := s.doStripeRequest(req)
	if err != nil {
		return err
	}
	if payload.PaymentStatus != "paid" {
		return fmt.Errorf("%w: status is %q", ErrStripeUnpaid, payload.PaymentStatus)
	}
	return nil
}

func (s *StripeService) doStripeRequest(req *http.Request) (*stripeCheckoutSessionPayload, error) {
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrStripeAPI, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("%w: read response: %v", ErrStripeAPI, err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errBody stripeAPIErrorPayload
		_ = json.Unmarshal(body, &errBody)
		if errBody.Error.Message != "" {
			return nil, fmt.Errorf("%w: %s", ErrStripeAPI, errBody.Error.Message)
		}
		return nil, fmt.Errorf("%w: unexpected status %d", ErrStripeAPI, resp.StatusCode)
	}

	var session stripeCheckoutSessionPayload
	if err := json.Unmarshal(body, &session); err != nil {
		return nil, fmt.Errorf("%w: decode response: %v", ErrStripeAPI, err)
	}
	return &session, nil
}
