package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"eneba-marketplace/backend/internal/models"
)

const defaultResendEndpoint = "https://api.resend.com/emails"

type EmailService struct {
	resendAPIKey   string
	emailFrom      string
	frontendURL    string
	resendEndpoint string
	client         *http.Client
}

func NewEmailService(resendAPIKey, emailFrom, frontendURL string) *EmailService {
	from := strings.TrimSpace(emailFrom)
	if from == "" {
		from = "onboarding@resend.dev"
	}
	front := strings.TrimRight(strings.TrimSpace(frontendURL), "/")
	if front == "" {
		front = "http://localhost:5173"
	}
	return &EmailService{
		resendAPIKey:   strings.TrimSpace(resendAPIKey),
		emailFrom:      from,
		frontendURL:    front,
		resendEndpoint: defaultResendEndpoint,
		client:         &http.Client{Timeout: 8 * time.Second},
	}
}

// SetResendEndpoint overrides Resend's API URL (useful for testing).
func (s *EmailService) SetResendEndpoint(endpoint string) {
	s.resendEndpoint = endpoint
}

func formatCentsEUR(cents int) string {
	return fmt.Sprintf("€%.2f", float64(cents)/100.0)
}

// BuildWelcomeEmailHTML builds the Eneba-themed transactional registration HTML email.
func BuildWelcomeEmailHTML(fullName, frontendURL string) string {
	front := strings.TrimRight(strings.TrimSpace(frontendURL), "/")
	if front == "" {
		front = "http://localhost:5173"
	}
	safeName := html.EscapeString(strings.TrimSpace(fullName))
	if safeName == "" {
		safeName = "Gamer"
	}
	storeURL := html.EscapeString(front + "/store")

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Welcome to Eneba Demo Marketplace</title></head>
<body style="margin:0;padding:0;background-color:#1F0A4D;font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background-color:#1F0A4D;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%%;background-color:#2B0F6B;border:1px solid #5B2FC4;">
          <tr>
            <td style="background-color:#4618AC;padding:24px 28px;border-bottom:2px solid #FFDC00;">
              <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#FFFFFF;">eneba</span>
              <span style="display:inline-block;margin-left:8px;padding:2px 6px;border:1px solid #FFDC00;color:#FFDC00;font-size:10px;font-weight:800;letter-spacing:1.5px;">DEMO</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#FFFFFF;">Welcome aboard, %s!</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#D8CCF5;">
                Your Eneba Demo Marketplace account is ready. Compare verified sellers across Steam, PlayStation, Xbox, and Nintendo Switch and receive instant activation keys.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#FFDC00;">
                    <a href="%s" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:900;color:#1F0A4D;text-decoration:none;text-transform:uppercase;letter-spacing:0.5px;">
                      Browse Store Deals
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;color:#A996DC;">
                Marketplace prototype built for the Eneba Engineering Internship Assignment &bull; Test mode only.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, safeName, storeURL)
}

// BuildOrderKeyEmailHTML builds the Eneba-themed digital key fulfillment HTML email.
func BuildOrderKeyEmailHTML(fullName string, order *models.OrderDetail, frontendURL string) string {
	front := strings.TrimRight(strings.TrimSpace(frontendURL), "/")
	if front == "" {
		front = "http://localhost:5173"
	}
	safeName := html.EscapeString(strings.TrimSpace(fullName))
	if safeName == "" {
		safeName = "Gamer"
	}

	shortID := order.ID
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	orderURL := html.EscapeString(front + "/orders/" + order.ID)

	var rows strings.Builder
	for _, it := range order.Items {
		rows.WriteString(fmt.Sprintf(`
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #3F1C8A;background-color:#1F0A4D;">
              <div style="font-size:15px;font-weight:800;color:#FFFFFF;">%s</div>
              <div style="margin-top:4px;font-size:12px;color:#A996DC;">%s &bull; %s &bull; Seller: %s &bull; %s</div>
              <div style="margin-top:10px;padding:10px 12px;background-color:#12052E;border:1px solid #00D1B2;font-size:13px;color:#00D1B2;">
                <span style="font-family:monospace;font-size:16px;font-weight:900;letter-spacing:2px;color:#FFFFFF;">••••-••••-••••</span>
                <span style="margin-left:8px;font-style:italic;color:#00D1B2;">&bull; Key ready in your account</span>
              </div>
            </td>
          </tr>`,
			html.EscapeString(it.ProductTitle),
			html.EscapeString(it.Platform),
			html.EscapeString(it.Region),
			html.EscapeString(it.SellerName),
			html.EscapeString(formatCentsEUR(it.UnitPriceCents)),
		))
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Your Digital Keys — Order #%s</title></head>
<body style="margin:0;padding:0;background-color:#1F0A4D;font-family:Arial,Helvetica,sans-serif;color:#FFFFFF;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background-color:#1F0A4D;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%%;background-color:#2B0F6B;border:1px solid #5B2FC4;">
          <tr>
            <td style="background-color:#4618AC;padding:24px 28px;border-bottom:2px solid #FFDC00;">
              <span style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#FFFFFF;">eneba</span>
              <span style="display:inline-block;margin-left:8px;padding:2px 6px;border:1px solid #FFDC00;color:#FFDC00;font-size:10px;font-weight:800;letter-spacing:1.5px;">DEMO</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <div style="display:inline-block;padding:4px 10px;background-color:#123C4A;border:1px solid #00D1B2;color:#00D1B2;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
                Keys Unlocked &bull; Order #%s
              </div>
              <h1 style="margin:14px 0 8px;font-size:22px;color:#FFFFFF;">Thanks for your order, %s!</h1>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#D8CCF5;">
                Total Paid: <strong style="color:#FFDC00;font-size:16px;">%s</strong>. For your security, activation keys are masked in email — click below to reveal and copy your keys in your account:
              </p>

              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="border:1px solid #5B2FC4;">
                %s
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                <tr>
                  <td style="background-color:#FFDC00;">
                    <a href="%s" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:900;color:#1F0A4D;text-decoration:none;text-transform:uppercase;letter-spacing:0.5px;">
                      CLICK TO SEE KEY
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;color:#A996DC;">
                Marketplace prototype built for the Eneba Engineering Internship Assignment &bull; Test mode only.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
		html.EscapeString(shortID),
		html.EscapeString(shortID),
		safeName,
		html.EscapeString(formatCentsEUR(order.TotalCents)),
		rows.String(),
		orderURL,
	)
}

// SendWelcomeEmailAsync sends a welcome HTML email in a non-blocking goroutine (or logs preview).
func (s *EmailService) SendWelcomeEmailAsync(toEmail, fullName string) {
	if strings.TrimSpace(toEmail) == "" {
		return
	}
	subject := "Welcome to Eneba Demo Marketplace!"
	storeURL := s.frontendURL + "/store"
	htmlBody := BuildWelcomeEmailHTML(fullName, s.frontendURL)
	s.dispatchAsync(toEmail, subject, storeURL, "Welcome account activated", htmlBody)
}

// SendOrderKeyEmailAsync sends the digital key fulfillment receipt HTML email asynchronously (or logs preview).
func (s *EmailService) SendOrderKeyEmailAsync(toEmail, fullName string, order *models.OrderDetail) {
	if strings.TrimSpace(toEmail) == "" || order == nil {
		return
	}
	shortID := order.ID
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	subject := fmt.Sprintf("Your Digital Game Keys (Order #%s)", shortID)
	orderURL := fmt.Sprintf("%s/orders/%s", s.frontendURL, order.ID)

	var itemsSummary []string
	for _, it := range order.Items {
		itemsSummary = append(itemsSummary, fmt.Sprintf("%s (%s): ••••-••••-••••", it.ProductTitle, it.Platform))
	}
	preview := fmt.Sprintf("Total=%s | CTA=CLICK TO SEE KEY | Items=[%s]", formatCentsEUR(order.TotalCents), strings.Join(itemsSummary, "; "))
	htmlBody := BuildOrderKeyEmailHTML(fullName, order, s.frontendURL)

	s.dispatchAsync(toEmail, subject, orderURL, preview, htmlBody)
}

func (s *EmailService) dispatchAsync(toEmail, subject, ctaURL, previewSummary, htmlBody string) {
	if s.resendAPIKey == "" {
		go func() {
			log.Printf("[EMAIL PREVIEW] To=%s | Subject=%q | CTA=%s | %s", toEmail, subject, ctaURL, previewSummary)
		}()
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		payload := map[string]interface{}{
			"from":    s.emailFrom,
			"to":      []string{toEmail},
			"subject": subject,
			"html":    htmlBody,
		}
		raw, err := json.Marshal(payload)
		if err != nil {
			log.Printf("⚠️ email marshal failed (%s): %v", toEmail, err)
			return
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.resendEndpoint, bytes.NewReader(raw))
		if err != nil {
			log.Printf("⚠️ email request build failed (%s): %v", toEmail, err)
			return
		}
		req.Header.Set("Authorization", "Bearer "+s.resendAPIKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := s.client.Do(req)
		if err != nil {
			log.Printf("⚠️ Resend email delivery failed (%s): %v", toEmail, err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
			log.Printf("⚠️ Resend email non-2xx (%d) for %s: %s", resp.StatusCode, toEmail, string(errBody))
			return
		}
		log.Printf("✓ Sent transactional email %q to %s", subject, toEmail)
	}()
}
