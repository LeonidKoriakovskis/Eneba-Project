package services

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"strings"
	"time"

	"eneba-marketplace/backend/internal/config"
	"eneba-marketplace/backend/internal/models"
)

const (
	defaultResendEndpoint = "https://api.resend.com/emails"
	defaultBrevoEndpoint  = "https://api.brevo.com/v3/smtp/email"
)

type SMTPConfig struct {
	Host string
	Port string
	User string
	Pass string
	From string
}

type SMTPSendFunc func(addr string, auth smtp.Auth, from string, to []string, msg []byte) error

type EmailService struct {
	brevoAPIKey    string
	brevoEndpoint  string
	resendAPIKey   string
	emailFrom      string
	frontendURL    string
	resendEndpoint string
	smtp           SMTPConfig
	smtpSender     SMTPSendFunc
	client         *http.Client
}

func normalizeEmailFrontendURL(raw string) string {
	for _, token := range strings.Split(config.CleanEnvValue(raw), ",") {
		if valid, ok := config.ValidateSingleHTTPURL(token); ok {
			return valid
		}
	}
	return config.DefaultProdFrontendURL
}

func NewEmailService(resendAPIKey, emailFrom, frontendURL string) *EmailService {
	from := config.CleanEnvValue(emailFrom)
	if from == "" {
		from = "onboarding@resend.dev"
	}
	return &EmailService{
		brevoEndpoint:  defaultBrevoEndpoint,
		resendAPIKey:   config.CleanEnvValue(resendAPIKey),
		emailFrom:      from,
		frontendURL:    normalizeEmailFrontendURL(frontendURL),
		resendEndpoint: defaultResendEndpoint,
		client:         &http.Client{Timeout: 15 * time.Second},
	}
}

// ConfigureBrevo enables Brevo HTTPS transactional email delivery (port 443).
// Whenever BREVO_API_KEY is non-empty, Brevo HTTPS API is prioritized first over SMTP.
func (s *EmailService) ConfigureBrevo(apiKey string) {
	s.brevoAPIKey = config.CleanEnvValue(apiKey)
}

// SetBrevoEndpoint overrides Brevo's API URL (primarily for automated tests).
func (s *EmailService) SetBrevoEndpoint(endpoint string) {
	s.brevoEndpoint = endpoint
}

// BrevoEnabled returns true when BREVO_API_KEY is configured.
func (s *EmailService) BrevoEnabled() bool {
	return s.brevoAPIKey != ""
}

// ConfigureSMTP enables SMTP delivery (e.g., Brevo or Gmail App Password) with optional SMTP_FROM.
// Whenever SMTP_HOST is configured, SMTP is prioritized over Resend.
func (s *EmailService) ConfigureSMTP(host, port, user, pass string, from ...string) {
	p := config.CleanEnvValue(port)
	if p == "" {
		p = "587"
	}
	smtpFrom := ""
	if len(from) > 0 {
		smtpFrom = config.CleanEnvValue(from[0])
	}
	s.smtp = SMTPConfig{
		Host: config.CleanEnvValue(host),
		Port: p,
		User: config.CleanEnvValue(user),
		Pass: config.CleanEnvValue(pass),
		From: smtpFrom,
	}
	if s.smtp.Host != "" && s.smtpSender == nil {
		s.smtpSender = sendMailTLSOrSTARTTLS
	}
}

// SetSMTPSender overrides SMTP transport (primarily for automated tests).
func (s *EmailService) SetSMTPSender(fn SMTPSendFunc) {
	s.smtpSender = fn
}

func (s *EmailService) smtpEnabled() bool {
	return s.smtp.Host != "" && s.smtp.User != "" && s.smtp.Pass != ""
}

// ResolveSMTPFrom returns the From header value and bare envelope email address for SMTP delivery.
func (s *EmailService) ResolveSMTPFrom() (string, string) {
	raw := s.smtp.From
	if raw == "" && !strings.EqualFold(s.emailFrom, "onboarding@resend.dev") {
		raw = s.emailFrom
	}
	if raw == "" && strings.Contains(s.smtp.User, "@") {
		raw = s.smtp.User
	}
	if raw == "" {
		raw = s.emailFrom
	}

	if parsed, err := mail.ParseAddress(raw); err == nil && parsed.Address != "" {
		if parsed.Name != "" {
			return parsed.String(), parsed.Address
		}
		return fmt.Sprintf("Eneba Demo Marketplace <%s>", parsed.Address), parsed.Address
	}
	return fmt.Sprintf("Eneba Demo Marketplace <%s>", raw), raw
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
	front := normalizeEmailFrontendURL(frontendURL)
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
	front := normalizeEmailFrontendURL(frontendURL)
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
	if !s.BrevoEnabled() && !s.smtpEnabled() && s.resendAPIKey == "" {
		go func() {
			log.Printf("[EMAIL PREVIEW] To=%s | Subject=%q | CTA=%s | %s", toEmail, subject, ctaURL, previewSummary)
		}()
		return
	}

	go func() {
		// Prioritize Brevo HTTPS API (port 443) whenever BREVO_API_KEY is set.
		// Only fall back to SMTP if BREVO_API_KEY is empty.
		if s.BrevoEnabled() {
			if err := s.SendViaBrevo(toEmail, subject, htmlBody); err == nil {
				log.Printf("[Brevo API] ✓ Successfully delivered %q to=%s", subject, toEmail)
				return
			} else {
				log.Printf("[Brevo API] ❌ Failed sending %q to=%s: %v", subject, toEmail, err)
			}
		} else if s.smtpEnabled() {
			_, envelopeFrom := s.ResolveSMTPFrom()
			log.Printf("[SMTP] Sending %q to=%s via %s:%s (user=%s, from=%s)", subject, toEmail, s.smtp.Host, s.smtp.Port, s.smtp.User, envelopeFrom)
			if err := s.SendViaSMTP(toEmail, subject, htmlBody); err == nil {
				log.Printf("[SMTP] ✓ Successfully delivered %q to=%s via %s:%s", subject, toEmail, s.smtp.Host, s.smtp.Port)
				return
			} else {
				log.Printf("[SMTP] ❌ Failed sending %q to=%s via %s:%s: %v", subject, toEmail, s.smtp.Host, s.smtp.Port, err)
			}
		}

		if s.resendAPIKey != "" {
			if err := s.sendViaResend(toEmail, subject, htmlBody); err == nil {
				log.Printf("✓ Sent transactional email %q via Resend to %s", subject, toEmail)
				return
			} else {
				log.Printf("⚠️ Resend email delivery failed (%s): %v", toEmail, err)
			}
		}

		log.Printf("[EMAIL PREVIEW Fallback] To=%s | Subject=%q | CTA=%s | %s", toEmail, subject, ctaURL, previewSummary)
	}()
}

// SendViaBrevo sends an HTML email over HTTPS (port 443) via Brevo's /v3/smtp/email API.
func (s *EmailService) SendViaBrevo(toEmail, subject, htmlBody string) error {
	if !s.BrevoEnabled() {
		return fmt.Errorf("Brevo API is not configured (missing BREVO_API_KEY)")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	_, senderEmail := s.ResolveSMTPFrom()
	payload := map[string]interface{}{
		"sender": map[string]string{
			"email": senderEmail,
			"name":  "Eneba Demo",
		},
		"to": []map[string]string{
			{"email": toEmail},
		},
		"subject":     subject,
		"htmlContent": htmlBody,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal brevo payload failed: %w", err)
	}

	endpoint := s.brevoEndpoint
	if endpoint == "" {
		endpoint = defaultBrevoEndpoint
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return fmt.Errorf("build brevo request failed: %w", err)
	}
	req.Header.Set("api-key", s.brevoAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		log.Printf("[Brevo API] POST %s to=%s from=%s subject=%q -> ERROR: %v", endpoint, toEmail, senderEmail, subject, err)
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	trimmedBody := strings.TrimSpace(string(respBody))
	log.Printf("[Brevo API] POST %s to=%s from=%s subject=%q -> HTTP %d | body=%s", endpoint, toEmail, senderEmail, subject, resp.StatusCode, trimmedBody)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("brevo HTTP %d: %s", resp.StatusCode, trimmedBody)
	}
	return nil
}

func (s *EmailService) sendViaResend(toEmail, subject, htmlBody string) error {
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
		return fmt.Errorf("marshal failed: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.resendEndpoint, bytes.NewReader(raw))
	if err != nil {
		return fmt.Errorf("build request failed: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.resendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(errBody)))
	}
	return nil
}

// SendViaSMTP sends an HTML email using configured SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM.
func (s *EmailService) SendViaSMTP(toEmail, subject, htmlBody string) error {
	if !s.smtpEnabled() {
		return fmt.Errorf("SMTP is not configured (missing SMTP_HOST, SMTP_USER, or SMTP_PASS)")
	}

	headerFrom, envelopeFrom := s.ResolveSMTPFrom()
	addr := net.JoinHostPort(s.smtp.Host, s.smtp.Port)
	auth := smtp.PlainAuth("", s.smtp.User, s.smtp.Pass, s.smtp.Host)

	msg := strings.Join([]string{
		fmt.Sprintf("From: %s", headerFrom),
		fmt.Sprintf("To: %s", toEmail),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/html; charset=UTF-8",
		"",
		htmlBody,
	}, "\r\n")

	sender := s.smtpSender
	if sender == nil {
		sender = sendMailTLSOrSTARTTLS
	}
	return sender(addr, auth, envelopeFrom, []string{toEmail}, []byte(msg))
}

func sendMailTLSOrSTARTTLS(addr string, auth smtp.Auth, from string, to []string, msg []byte) error {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("invalid SMTP address %q: %w", addr, err)
	}

	rawConn, err := net.DialTimeout("tcp", addr, 15*time.Second)
	if err != nil {
		return fmt.Errorf("dial %s: %w", addr, err)
	}
	_ = rawConn.SetDeadline(time.Now().Add(25 * time.Second))

	var client *smtp.Client
	if port == "465" {
		tlsConn := tls.Client(rawConn, &tls.Config{
			ServerName: host,
			MinVersion: tls.VersionTLS12,
		})
		if err := tlsConn.Handshake(); err != nil {
			_ = rawConn.Close()
			return fmt.Errorf("implicit TLS handshake with %s: %w", addr, err)
		}
		client, err = smtp.NewClient(tlsConn, host)
		if err != nil {
			_ = tlsConn.Close()
			return fmt.Errorf("SMTP client init (465): %w", err)
		}
	} else {
		client, err = smtp.NewClient(rawConn, host)
		if err != nil {
			_ = rawConn.Close()
			return fmt.Errorf("SMTP client init: %w", err)
		}
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{
				ServerName: host,
				MinVersion: tls.VersionTLS12,
			}); err != nil {
				_ = client.Close()
				return fmt.Errorf("STARTTLS upgrade with %s: %w", addr, err)
			}
		}
	}
	defer client.Quit()

	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP auth with %s: %w", addr, err)
		}
	}
	if err := client.Mail(from); err != nil {
		return fmt.Errorf("SMTP MAIL FROM <%s>: %w", from, err)
	}
	for _, rcpt := range to {
		if err := client.Rcpt(rcpt); err != nil {
			return fmt.Errorf("SMTP RCPT TO <%s>: %w", rcpt, err)
		}
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		return fmt.Errorf("SMTP write body: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("SMTP finalize message: %w", err)
	}
	return nil
}
