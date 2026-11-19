package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"eneba-marketplace/backend/internal/auth"
	"eneba-marketplace/backend/internal/db"
	"eneba-marketplace/backend/internal/handlers"
	"eneba-marketplace/backend/internal/models"
	"eneba-marketplace/backend/internal/repository"
	"eneba-marketplace/backend/internal/router"
	"eneba-marketplace/backend/internal/services"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

// Seeded offers used by these tests (each has 3 AVAILABLE keys in 002_seed.sql).
const (
	offerGTAFirst     = "20000005-0000-0000-0000-000000000001" // checkout happy path
	offerBG3Third     = "20000008-0000-0000-0000-000000000003" // out-of-stock test
	offerWitcherFirst = "20000003-0000-0000-0000-000000000001" // atomicity test (second line)
	offerHogwartsSec  = "20000010-0000-0000-0000-000000000002" // concurrency test
)

type testEnv struct {
	handler       http.Handler
	pool          *pgxpool.Pool
	stripeService *services.StripeService
}

func setupFullEnv(t *testing.T) *testEnv {
	return setupEnvWithStripeKey(t, "")
}

func setupEnvWithStripeKey(t *testing.T, stripeKey string) *testEnv {
	t.Helper()
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../../.env.local")
	_ = godotenv.Load("../../../.env")
	_ = godotenv.Load("../.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:password123@localhost:5432/eneba_marketplace?sslmode=disable"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	database, err := db.Connect(ctx, dbURL)
	if err != nil {
		t.Fatalf("failed to connect to database: %v", err)
	}
	t.Cleanup(database.Close)

	pool := database.Pool
	userRepo := repository.NewUserRepository(pool)
	orderRepo := repository.NewOrderRepository(pool)
	if err := orderRepo.EnsureSchema(ctx); err != nil {
		t.Fatalf("failed to ensure order schema: %v", err)
	}

	tokens := auth.NewTokenManager("test-secret-test-secret-test-secret", time.Hour)
	authService := services.NewAuthService(userRepo, tokens)
	if err := authService.EnsureDemoUsers(ctx); err != nil {
		t.Fatalf("failed to seed demo users: %v", err)
	}

	stripeService := services.NewStripeService(stripeKey, "http://localhost:5173")
	emailService := services.NewEmailService("", "onboarding@resend.dev", "http://localhost:5173")
	orderService := services.NewOrderService(orderRepo, stripeService)

	h := router.New(router.Deps{
		AllowedOrigins: []string{"http://localhost:5173"},
		Tokens:         tokens,
		Health:         handlers.NewHealthHandler(database),
		Catalog:        handlers.NewCatalogHandler(services.NewCatalogService(repository.NewCatalogRepository(pool))),
		Auth:           handlers.NewAuthHandler(authService, emailService),
		Orders:         handlers.NewOrderHandler(orderService, userRepo, emailService),
		Stripe:         handlers.NewStripeHandler(stripeService, orderService),
	})
	return &testEnv{handler: h, pool: pool, stripeService: stripeService}
}

func (e *testEnv) do(t *testing.T, method, path, token string, body interface{}) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	e.handler.ServeHTTP(rec, req)
	return rec
}

// registerUser creates a unique user and schedules full cleanup (restoring keys first).
func (e *testEnv) registerUser(t *testing.T) models.AuthResponse {
	t.Helper()
	email := fmt.Sprintf("tester-%d@example.com", time.Now().UnixNano())
	rec := e.do(t, http.MethodPost, "/api/auth/register", "", models.RegisterRequest{
		Email: email, Password: "Sup3rSecret!", FullName: "Test User",
	})
	if rec.Code != http.StatusCreated {
		t.Fatalf("register: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var resp models.AuthResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode register response: %v", err)
	}

	t.Cleanup(func() {
		ctx := context.Background()
		// Restore any keys sold to this user so the seed data stays pristine.
		_, _ = e.pool.Exec(ctx, `
			UPDATE digital_keys SET status='AVAILABLE', order_item_id=NULL, sold_at=NULL
			WHERE order_item_id IN (
				SELECT oi.id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = $1
			)`, resp.User.ID)
		_, _ = e.pool.Exec(ctx, `DELETE FROM orders WHERE user_id = $1`, resp.User.ID)
		_, _ = e.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, resp.User.ID)
	})
	return resp
}

func (e *testEnv) availableKeys(t *testing.T, offerID string) int {
	t.Helper()
	var n int
	err := e.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM digital_keys WHERE seller_offer_id=$1 AND status='AVAILABLE'`, offerID).Scan(&n)
	if err != nil {
		t.Fatalf("count keys: %v", err)
	}
	return n
}

func (e *testEnv) orderCount(t *testing.T, userID string) int {
	t.Helper()
	var n int
	if err := e.pool.QueryRow(context.Background(),
		`SELECT count(*) FROM orders WHERE user_id=$1`, userID).Scan(&n); err != nil {
		t.Fatalf("count orders: %v", err)
	}
	return n
}

func checkoutBody(items ...models.CheckoutItem) models.CheckoutRequest {
	return models.CheckoutRequest{Items: items, PaymentMethod: "card_sim"}
}

func TestAuth_RegisterLoginAndProtectedRoute(t *testing.T) {
	env := setupFullEnv(t)

	// Unauthenticated access is rejected.
	if rec := env.do(t, http.MethodGet, "/api/orders", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", rec.Code)
	}
	if rec := env.do(t, http.MethodGet, "/api/orders", "not-a-jwt", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 with garbage token, got %d", rec.Code)
	}

	reg := env.registerUser(t)
	if reg.Token == "" || reg.User.ID == "" || reg.User.FullName != "Test User" {
		t.Fatalf("unexpected register response: %+v", reg)
	}

	// Duplicate email -> 409.
	dup := env.do(t, http.MethodPost, "/api/auth/register", "", models.RegisterRequest{
		Email: reg.User.Email, Password: "AnotherPass123", FullName: "Dup",
	})
	if dup.Code != http.StatusConflict {
		t.Errorf("expected 409 for duplicate email, got %d", dup.Code)
	}

	// Validation -> 400.
	bad := env.do(t, http.MethodPost, "/api/auth/register", "", models.RegisterRequest{
		Email: "nope", Password: "short", FullName: "X",
	})
	if bad.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid input, got %d", bad.Code)
	}

	// Wrong password / unknown user -> 401.
	if rec := env.do(t, http.MethodPost, "/api/auth/login", "", models.LoginRequest{
		Email: reg.User.Email, Password: "wrong-password",
	}); rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for wrong password, got %d", rec.Code)
	}
	if rec := env.do(t, http.MethodPost, "/api/auth/login", "", models.LoginRequest{
		Email: "ghost@example.com", Password: "whatever123",
	}); rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unknown user, got %d", rec.Code)
	}

	// Successful login (email is case-insensitive).
	rec := env.do(t, http.MethodPost, "/api/auth/login", "", models.LoginRequest{
		Email: reg.User.Email, Password: "Sup3rSecret!",
	})
	if rec.Code != http.StatusOK {
		t.Fatalf("login: expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var login models.AuthResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &login)
	if login.Token == "" || login.User.ID != reg.User.ID {
		t.Fatalf("unexpected login response: %+v", login)
	}

	// Protected route works with the token and starts empty.
	rec = env.do(t, http.MethodGet, "/api/orders", login.Token, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with valid token, got %d: %s", rec.Code, rec.Body.String())
	}
	var list struct {
		Orders []models.OrderDetail `json:"orders"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if list.Orders == nil || len(list.Orders) != 0 {
		t.Errorf("expected empty (non-null) orders list, got %+v", list.Orders)
	}

	// Demo reviewer account (gamer@eneba-demo.com / Password123!) can also log in.
	demoRec := env.do(t, http.MethodPost, "/api/auth/login", "", models.LoginRequest{
		Email: "gamer@eneba-demo.com", Password: "Password123!",
	})
	if demoRec.Code != http.StatusOK {
		t.Fatalf("demo login: expected 200, got %d: %s", demoRec.Code, demoRec.Body.String())
	}
	var demoLogin models.AuthResponse
	_ = json.Unmarshal(demoRec.Body.Bytes(), &demoLogin)
	if demoLogin.Token == "" || demoLogin.User.Email != "gamer@eneba-demo.com" {
		t.Errorf("unexpected demo login response: %+v", demoLogin)
	}
}

func TestCheckout_Success_MarksKeySoldAndDecrementsStock(t *testing.T) {
	env := setupFullEnv(t)
	user := env.registerUser(t)

	before := env.availableKeys(t, offerGTAFirst)
	if before < 2 {
		t.Fatalf("seed precondition failed: need >=2 keys, have %d", before)
	}

	var serverPrice int
	if err := env.pool.QueryRow(context.Background(),
		`SELECT price_cents FROM seller_offers WHERE id=$1`, offerGTAFirst).Scan(&serverPrice); err != nil {
		t.Fatalf("price lookup: %v", err)
	}

	// Client tries to smuggle a fake price; it must be ignored.
	body := map[string]interface{}{
		"items":          []map[string]interface{}{{"seller_offer_id": offerGTAFirst, "quantity": 2, "price_cents": 1}},
		"payment_method": "card_sim",
		"total_cents":    2,
	}
	rec := env.do(t, http.MethodPost, "/api/orders/checkout", user.Token, body)
	if rec.Code != http.StatusCreated {
		t.Fatalf("checkout: expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	var order models.OrderDetail
	if err := json.Unmarshal(rec.Body.Bytes(), &order); err != nil {
		t.Fatalf("decode receipt: %v", err)
	}
	if order.Status != "COMPLETED" || order.TotalCents != serverPrice*2 {
		t.Errorf("expected COMPLETED with total %d, got %s / %d", serverPrice*2, order.Status, order.TotalCents)
	}
	if len(order.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(order.Items))
	}
	seen := map[string]bool{}
	for _, it := range order.Items {
		if it.LicenseKey == "" || seen[it.LicenseKey] {
			t.Errorf("missing or duplicate license key: %q", it.LicenseKey)
		}
		seen[it.LicenseKey] = true
		if it.ProductTitle == "" || it.Platform == "" || it.Region == "" || it.SellerName == "" || it.UnitPriceCents != serverPrice {
			t.Errorf("incomplete receipt item: %+v", it)
		}

		var status string
		var orderItemID *string
		var soldAt *time.Time
		err := env.pool.QueryRow(context.Background(),
			`SELECT status, order_item_id, sold_at FROM digital_keys WHERE license_key=$1`, it.LicenseKey).
			Scan(&status, &orderItemID, &soldAt)
		if err != nil {
			t.Fatalf("key lookup: %v", err)
		}
		if status != "SOLD" || orderItemID == nil || *orderItemID != it.ID || soldAt == nil {
			t.Errorf("key %s not properly sold: status=%s item=%v soldAt=%v", it.LicenseKey, status, orderItemID, soldAt)
		}
	}

	if after := env.availableKeys(t, offerGTAFirst); after != before-2 {
		t.Errorf("expected stock %d after purchase, got %d", before-2, after)
	}

	// Order history shows the order with revealed keys.
	rec = env.do(t, http.MethodGet, "/api/orders", user.Token, nil)
	var list struct {
		Orders []models.OrderDetail `json:"orders"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &list)
	if len(list.Orders) != 1 || list.Orders[0].ID != order.ID || len(list.Orders[0].Items) != 2 {
		t.Fatalf("unexpected order history: %+v", list.Orders)
	}
	for _, it := range list.Orders[0].Items {
		if !seen[it.LicenseKey] {
			t.Errorf("history key %q not in receipt", it.LicenseKey)
		}
	}
}

func TestCheckout_OutOfStock_ReturnsConflictWithoutPartialRows(t *testing.T) {
	env := setupFullEnv(t)
	user := env.registerUser(t)

	bgBefore := env.availableKeys(t, offerBG3Third)
	witcherBefore := env.availableKeys(t, offerWitcherFirst)

	// 1) Requesting more than available.
	rec := env.do(t, http.MethodPost, "/api/orders/checkout", user.Token,
		checkoutBody(models.CheckoutItem{SellerOfferID: offerBG3Third, Quantity: bgBefore + 1}))
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", rec.Code, rec.Body.String())
	}
	var errResp map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &errResp)
	if errResp["seller_offer_id"] != offerBG3Third {
		t.Errorf("409 should identify the lacking offer, got %+v", errResp)
	}

	// 2) Multi-line cart: first line is fine, second lacks stock -> everything rolls back.
	rec = env.do(t, http.MethodPost, "/api/orders/checkout", user.Token, checkoutBody(
		models.CheckoutItem{SellerOfferID: offerWitcherFirst, Quantity: 1},
		models.CheckoutItem{SellerOfferID: offerBG3Third, Quantity: 10},
	))
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409 for mixed cart, got %d: %s", rec.Code, rec.Body.String())
	}

	if n := env.orderCount(t, user.User.ID); n != 0 {
		t.Errorf("expected 0 orders after failed checkouts, found %d", n)
	}
	var orphanItems int
	_ = env.pool.QueryRow(context.Background(), `
		SELECT count(*) FROM order_items oi LEFT JOIN orders o ON o.id = oi.order_id
		WHERE o.id IS NULL`).Scan(&orphanItems)
	if orphanItems != 0 {
		t.Errorf("found %d orphan order_items", orphanItems)
	}
	if got := env.availableKeys(t, offerBG3Third); got != bgBefore {
		t.Errorf("BG3 stock changed: %d -> %d", bgBefore, got)
	}
	if got := env.availableKeys(t, offerWitcherFirst); got != witcherBefore {
		t.Errorf("Witcher stock changed despite rollback: %d -> %d", witcherBefore, got)
	}
}

func TestCheckout_Validation(t *testing.T) {
	env := setupFullEnv(t)
	user := env.registerUser(t)

	cases := map[string]models.CheckoutRequest{
		"empty cart":     checkoutBody(),
		"zero quantity":  checkoutBody(models.CheckoutItem{SellerOfferID: offerGTAFirst, Quantity: 0}),
		"bad uuid":       checkoutBody(models.CheckoutItem{SellerOfferID: "abc", Quantity: 1}),
		"bad payment":    {Items: []models.CheckoutItem{{SellerOfferID: offerGTAFirst, Quantity: 1}}, PaymentMethod: "bitcoin"},
	}
	for name, body := range cases {
		if rec := env.do(t, http.MethodPost, "/api/orders/checkout", user.Token, body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: expected 400, got %d", name, rec.Code)
		}
	}

	unknown := checkoutBody(models.CheckoutItem{SellerOfferID: "99999999-9999-9999-9999-999999999999", Quantity: 1})
	if rec := env.do(t, http.MethodPost, "/api/orders/checkout", user.Token, unknown); rec.Code != http.StatusNotFound {
		t.Errorf("unknown offer: expected 404, got %d", rec.Code)
	}

	if rec := env.do(t, http.MethodPost, "/api/orders/checkout", "", checkoutBody(
		models.CheckoutItem{SellerOfferID: offerGTAFirst, Quantity: 1})); rec.Code != http.StatusUnauthorized {
		t.Errorf("unauthenticated checkout: expected 401, got %d", rec.Code)
	}
}

func TestCheckout_ConcurrentBuyers_NeverDoubleSellKeys(t *testing.T) {
	env := setupFullEnv(t)
	user := env.registerUser(t)

	stock := env.availableKeys(t, offerHogwartsSec)
	const buyers = 8

	var wg sync.WaitGroup
	var mu sync.Mutex
	statuses := map[int]int{}
	keys := map[string]int{}

	for i := 0; i < buyers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rec := env.do(t, http.MethodPost, "/api/orders/checkout", user.Token,
				checkoutBody(models.CheckoutItem{SellerOfferID: offerHogwartsSec, Quantity: 1}))
			mu.Lock()
			defer mu.Unlock()
			statuses[rec.Code]++
			if rec.Code == http.StatusCreated {
				var o models.OrderDetail
				if err := json.Unmarshal(rec.Body.Bytes(), &o); err == nil {
					for _, it := range o.Items {
						keys[it.LicenseKey]++
					}
				}
			}
		}()
	}
	wg.Wait()

	if statuses[http.StatusCreated] != stock {
		t.Errorf("expected exactly %d successful orders, got %v", stock, statuses)
	}
	if statuses[http.StatusCreated]+statuses[http.StatusConflict] != buyers {
		t.Errorf("unexpected status distribution: %v", statuses)
	}
	for k, n := range keys {
		if n != 1 {
			t.Errorf("license key %s sold %d times", k, n)
		}
	}
	if left := env.availableKeys(t, offerHogwartsSec); left != 0 {
		t.Errorf("expected stock fully drained, %d left", left)
	}
}

func TestStripe_ConfigSessionAndIdempotentFulfillment(t *testing.T) {
	// 1) Disabled state reports stripe_enabled: false
	disabledEnv := setupFullEnv(t)
	cfgRec := disabledEnv.do(t, http.MethodGet, "/api/config/payment", "", nil)
	if cfgRec.Code != http.StatusOK {
		t.Fatalf("config/payment: expected 200, got %d", cfgRec.Code)
	}
	var cfg models.PaymentConfigResponse
	_ = json.Unmarshal(cfgRec.Body.Bytes(), &cfg)
	if cfg.StripeEnabled {
		t.Fatalf("expected stripe_enabled=false when secret key is empty")
	}

	// 2) Enabled state with mock Stripe REST API
	paidStatus := "unpaid"
	stripeSessionID := fmt.Sprintf("cs_test_%d", time.Now().UnixNano())
	mockStripe := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost && r.URL.Path == "/v1/checkout/sessions" {
			_ = r.ParseForm()
			if r.Form.Has("payment_method_types[0]") || r.Form.Has("payment_method_types") {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error":{"message":"The payment_method_types parameter is no longer supported when creating a Checkout Session."}}`))
				return
			}
			if r.FormValue("mode") != "payment" || !strings.Contains(r.FormValue("success_url"), "session_id={CHECKOUT_SESSION_ID}") {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error":{"message":"invalid session payload"}}`))
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]string{
				"id":  stripeSessionID,
				"url": "https://checkout.stripe.com/c/pay/" + stripeSessionID,
			})
			return
		}
		if r.Method == http.MethodGet && r.URL.Path == "/v1/checkout/sessions/"+stripeSessionID {
			_ = json.NewEncoder(w).Encode(map[string]string{
				"id":             stripeSessionID,
				"payment_status": paidStatus,
				"status":         "complete",
			})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(mockStripe.Close)

	env := setupEnvWithStripeKey(t, "sk_test_mock_key")
	env.stripeService.SetBaseURL(mockStripe.URL)

	cfgRec = env.do(t, http.MethodGet, "/api/config/payment", "", nil)
	_ = json.Unmarshal(cfgRec.Body.Bytes(), &cfg)
	if !cfg.StripeEnabled {
		t.Fatalf("expected stripe_enabled=true when secret key is configured")
	}

	user := env.registerUser(t)
	before := env.availableKeys(t, offerGTAFirst)

	// Out-of-stock check upfront before calling Stripe
	oosRec := env.do(t, http.MethodPost, "/api/checkout/stripe-session", user.Token, map[string]interface{}{
		"items": []models.CheckoutItem{{SellerOfferID: offerGTAFirst, Quantity: 10}},
	})
	if oosRec.Code != http.StatusConflict {
		t.Fatalf("stripe-session out of stock: expected 409, got %d: %s", oosRec.Code, oosRec.Body.String())
	}

	// Valid session creation returns URL + session_id
	sessRec := env.do(t, http.MethodPost, "/api/checkout/stripe-session", user.Token, map[string]interface{}{
		"items": []models.CheckoutItem{{SellerOfferID: offerGTAFirst, Quantity: 1}},
	})
	if sessRec.Code != http.StatusOK {
		t.Fatalf("stripe-session: expected 200, got %d: %s", sessRec.Code, sessRec.Body.String())
	}
	var sess models.StripeSessionResponse
	_ = json.Unmarshal(sessRec.Body.Bytes(), &sess)
	if sess.SessionID != stripeSessionID || !strings.Contains(sess.URL, stripeSessionID) {
		t.Fatalf("unexpected stripe session response: %+v", sess)
	}

	// Unpaid Stripe session must be rejected with 402
	unpaidRec := env.do(t, http.MethodPost, "/api/orders/checkout", user.Token, models.CheckoutRequest{
		Items:           []models.CheckoutItem{{SellerOfferID: offerGTAFirst, Quantity: 1}},
		PaymentMethod:   "stripe_test",
		StripeSessionID: stripeSessionID,
	})
	if unpaidRec.Code != http.StatusPaymentRequired {
		t.Fatalf("expected 402 for unpaid stripe session, got %d: %s", unpaidRec.Code, unpaidRec.Body.String())
	}

	// Mark paid -> allocates key cleanly (201)
	paidStatus = "paid"
	firstOrderRec := env.do(t, http.MethodPost, "/api/orders/checkout", user.Token, models.CheckoutRequest{
		Items:           []models.CheckoutItem{{SellerOfferID: offerGTAFirst, Quantity: 1}},
		PaymentMethod:   "stripe_test",
		StripeSessionID: stripeSessionID,
	})
	if firstOrderRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 on paid stripe fulfillment, got %d: %s", firstOrderRec.Code, firstOrderRec.Body.String())
	}
	var firstOrder models.OrderDetail
	_ = json.Unmarshal(firstOrderRec.Body.Bytes(), &firstOrder)
	if len(firstOrder.Items) != 1 || firstOrder.Items[0].LicenseKey == "" {
		t.Fatalf("expected revealed key on stripe fulfillment, got %+v", firstOrder)
	}

	if after := env.availableKeys(t, offerGTAFirst); after != before-1 {
		t.Fatalf("expected stock %d after first stripe checkout, got %d", before-1, after)
	}

	// Refresh/retry with identical stripe_session_id -> idempotent 200 OK with same order & key, stock unchanged!
	replayRec := env.do(t, http.MethodPost, "/api/orders/checkout", user.Token, models.CheckoutRequest{
		Items:           []models.CheckoutItem{{SellerOfferID: offerGTAFirst, Quantity: 1}},
		PaymentMethod:   "stripe_test",
		StripeSessionID: stripeSessionID,
	})
	if replayRec.Code != http.StatusOK {
		t.Fatalf("expected 200 on idempotent stripe replay, got %d: %s", replayRec.Code, replayRec.Body.String())
	}
	var replayOrder models.OrderDetail
	_ = json.Unmarshal(replayRec.Body.Bytes(), &replayOrder)
	if replayOrder.ID != firstOrder.ID || replayOrder.Items[0].LicenseKey != firstOrder.Items[0].LicenseKey {
		t.Fatalf("idempotent replay returned different order: got %+v want %+v", replayOrder, firstOrder)
	}
	if afterReplay := env.availableKeys(t, offerGTAFirst); afterReplay != before-1 {
		t.Fatalf("idempotent replay decremented stock again: got %d want %d", afterReplay, before-1)
	}
}

func TestEmailService_HTMLTemplatesAndResendDelivery(t *testing.T) {
	welcomeHTML := services.BuildWelcomeEmailHTML("Alex Gamer", "https://eneba-demo.vercel.app")
	for _, want := range []string{"#1F0A4D", "#FFDC00", "Welcome aboard, Alex Gamer!", "https://eneba-demo.vercel.app/store"} {
		if !strings.Contains(welcomeHTML, want) {
			t.Errorf("welcome email HTML missing %q", want)
		}
	}

	orderHTML := services.BuildOrderKeyEmailHTML("Alex Gamer", &models.OrderDetail{
		ID:         "12345678-0000-0000-0000-000000000001",
		TotalCents: 2899,
		Items: []models.OrderItemDetail{
			{
				ProductTitle:   "Cyberpunk 2077: Phantom Liberty Bundle",
				Platform:       "Steam",
				Region:         "GLOBAL",
				SellerName:     "PixelVault Deals",
				UnitPriceCents: 2899,
				LicenseKey:     "CP77-PV01-9X82",
			},
		},
	}, "https://eneba-demo.vercel.app")
	for _, want := range []string{
		"#FFDC00",
		"Order #12345678",
		"€28.99",
		"••••-••••-••••",
		"Key ready in your account",
		"CLICK TO SEE KEY",
		"https://eneba-demo.vercel.app/orders/12345678-0000-0000-0000-000000000001",
	} {
		if !strings.Contains(orderHTML, want) {
			t.Errorf("order email HTML missing %q", want)
		}
	}
	if strings.Contains(orderHTML, "CP77-PV01-9X82") {
		t.Errorf("order email HTML must not expose raw license key in plaintext")
	}

	delivered := make(chan map[string]interface{}, 2)
	mockResend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&body)
		delivered <- body
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"email_123"}`))
	}))
	t.Cleanup(mockResend.Close)

	svc := services.NewEmailService("re_test_123", "onboarding@resend.dev", "http://localhost:5173")
	svc.SetResendEndpoint(mockResend.URL)
	svc.SendWelcomeEmailAsync("alex@example.com", "Alex Gamer")

	select {
	case msg := <-delivered:
		if msg["subject"] != "Welcome to Eneba Demo Marketplace!" {
			t.Errorf("unexpected email subject: %+v", msg["subject"])
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for async welcome email delivery")
	}
}
