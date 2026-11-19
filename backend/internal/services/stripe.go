package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
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

func cleanStripeConfigValue(raw string) string {
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

func normalizeStripeFrontendURL(raw string) string {
	val := strings.TrimRight(cleanStripeConfigValue(raw), "/")
	if val == "" {
		return "http://localhost:5173"
	}
	lower := strings.ToLower(val)
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		val = "https://" + val
	}
	return strings.TrimRight(val, "/")
}

func NewStripeService(secretKey, frontendURL string) *StripeService {
	return &StripeService{
		secretKey:   cleanStripeConfigValue(secretKey),
		frontendURL: normalizeStripeFrontendURL(frontendURL),
		baseURL:     defaultStripeBaseURL,
		client:      &http.Client{Timeout: 15 * time.Second},
	}
}

// SetBaseURL overrides the Stripe REST endpoint (primarily for httptest integration tests).
func (s *StripeService) SetBaseURL(baseURL string) {
	s.baseURL = strings.TrimRight(baseURL, "/")
}

func (s *StripeService) Enabled() bool {
	return s.secretKey != ""
}

// ResolveFrontendURL returns the sanitized redirect base URL for Stripe success/cancel links.
// When an origin header from a HTTPS/Vercel client is available and server FRONTEND_URL is
// still the localhost default, prefer the caller's origin so production redirects back to Vercel.
func (s *StripeService) ResolveFrontendURL(requestOrigin string) string {
	reqOrigin := strings.TrimRight(cleanStripeConfigValue(requestOrigin), "/")
	if reqOrigin != "" {
		lower := strings.ToLower(reqOrigin)
		if (strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "http://localhost")) &&
			(s.frontendURL == "" || s.frontendURL == "http://localhost:5173") {
			return reqOrigin
		}
	}
	return s.frontendURL
}

type stripeAPIErrorPayload struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

type stripeCheckoutSessionPayload struct {
	ID            string            `json:"id"`
	URL           string            `json:"url"`
	PaymentStatus string            `json:"payment_status"`
	Status        string            `json:"status"`
	Metadata      map[string]string `json:"metadata"`
}

// CreateCheckoutSession creates a hosted Stripe Checkout Session in Test Mode for the given DB-verified lines.
func (s *StripeService) CreateCheckoutSession(ctx context.Context, lines []models.CheckoutLinePreview, userID string, requestOrigin ...string) (*models.StripeSessionResponse, error) {
	if !s.Enabled() {
		return nil, ErrStripeDisabled
	}

	origin := ""
	if len(requestOrigin) > 0 {
		origin = requestOrigin[0]
	}
	redirectBase := s.ResolveFrontendURL(origin)

	form := url.Values{}
	form.Set("mode", "payment")
	form.Set("success_url", redirectBase+"/checkout/success?session_id={CHECKOUT_SESSION_ID}")
	form.Set("cancel_url", redirectBase+"/checkout?canceled=1")
	form.Set("client_reference_id", userID)

	metaItems := make([]models.CheckoutItem, 0, len(lines))
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
		metaItems = append(metaItems, models.CheckoutItem{
			SellerOfferID: line.SellerOfferID,
			Quantity:      line.Quantity,
		})
	}
	if metaJSON, err := json.Marshal(metaItems); err == nil && len(metaJSON) <= 490 {
		form.Set("metadata[items_json]", string(metaJSON))
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

// VerifySession fetches the Stripe Checkout Session, verifies payment_status == "paid",
// and extracts any checkout items saved in Stripe session metadata as a backup to browser storage.
func (s *StripeService) VerifySession(ctx context.Context, sessionID string) ([]models.CheckoutItem, error) {
	if !s.Enabled() {
		return nil, ErrStripeDisabled
	}
	trimmedID := strings.TrimSpace(sessionID)
	if trimmedID == "" {
		return nil, fmt.Errorf("%w: empty session_id", ErrStripeUnpaid)
	}

	endpoint := s.baseURL + "/v1/checkout/sessions/" + url.PathEscape(trimmedID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: build verification request: %v", ErrStripeAPI, err)
	}
	req.Header.Set("Authorization", "Bearer "+s.secretKey)

	payload, err := s.doStripeRequest(req)
	if err != nil {
		return nil, err
	}
	if !strings.EqualFold(payload.PaymentStatus, "paid") && !strings.EqualFold(payload.PaymentStatus, "no_payment_required") {
		return nil, fmt.Errorf("%w: payment_status=%q status=%q", ErrStripeUnpaid, payload.PaymentStatus, payload.Status)
	}

	var metaItems []models.CheckoutItem
	if raw := strings.TrimSpace(payload.Metadata["items_json"]); raw != "" {
		if err := json.Unmarshal([]byte(raw), &metaItems); err != nil {
			log.Printf("[stripe] warning: failed to parse metadata items_json for session %s: %v", trimmedID, err)
		}
	}
	return metaItems, nil
}

// VerifySessionPaid fetches the Stripe Checkout Session and ensures payment_status is "paid".
func (s *StripeService) VerifySessionPaid(ctx context.Context, sessionID string) error {
	_, err := s.VerifySession(ctx, sessionID)
	return err
}

func (s *StripeService) doStripeRequest(req *http.Request) (*stripeCheckoutSessionPayload, error) {
	resp, err := s.client.Do(req)
	if err != nil {
		log.Printf("[stripe] HTTP request %s %s failed: %v", req.Method, req.URL.Path, err)
		return nil, fmt.Errorf("%w: transport error: %v", ErrStripeAPI, err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		log.Printf("[stripe] read response body failed (%d): %v", resp.StatusCode, err)
		return nil, fmt.Errorf("%w (HTTP %d): read response: %v", ErrStripeAPI, resp.StatusCode, err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errBody stripeAPIErrorPayload
		_ = json.Unmarshal(body, &errBody)
		detail := strings.TrimSpace(errBody.Error.Message)
		if detail == "" {
			snippet := strings.TrimSpace(string(body))
			if len(snippet) > 300 {
				snippet = snippet[:300]
			}
			detail = snippet
		}
		if detail == "" {
			detail = resp.Status
		}
		log.Printf("[stripe] %s %s returned HTTP %d: %s", req.Method, req.URL.Path, resp.StatusCode, detail)
		return nil, fmt.Errorf("%w (HTTP %d): %s", ErrStripeAPI, resp.StatusCode, detail)
	}

	var session stripeCheckoutSessionPayload
	if err := json.Unmarshal(body, &session); err != nil {
		log.Printf("[stripe] invalid JSON response (%d): %v", resp.StatusCode, err)
		return nil, fmt.Errorf("%w: decode response: %v", ErrStripeAPI, err)
	}
	return &session, nil
}
