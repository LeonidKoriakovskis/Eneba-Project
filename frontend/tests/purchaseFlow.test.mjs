import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  AuthProvider,
  CartDrawer,
  CartPage,
  CartProvider,
  CheckoutPage,
  CustomSelect,
  MAX_QTY_PER_OFFER,
  MemoryRouter,
  Navbar,
  OrderDetailPage,
  OrderKeyCard,
  OrdersPage,
  ProductCard,
  Route,
  Routes,
  STORE_PLATFORMS,
  STORE_REGIONS,
  StorePage,
  WISHLIST_STORAGE_KEY,
  WishlistPage,
  WishlistProvider,
  AuthPage,
  cartReducer,
  isFuzzyMatch,
  parseMultiParam,
  sanitizeRedirect,
  serializeMultiParam,
  toggleMultiSelect,
  validateAuthInput,
  wishlistReducer,
} = require('../.vite-temp/tests/bundle.cjs');

function makeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();

const sampleCartItem = {
  sellerOfferId: '20000001-0000-0000-0000-000000000001',
  productId: '11111111-0000-0000-0000-000000000001',
  slug: 'cyberpunk-2077-phantom-liberty-bundle',
  title: 'Cyberpunk 2077: Phantom Liberty Bundle',
  coverImageUrl: 'https://example.com/cp77.jpg',
  platform: 'Steam',
  region: 'GLOBAL',
  sellerName: 'PixelVault Deals',
  unitPriceCents: 2899,
  originalPriceCents: 5999,
  maxQuantity: 3,
};

const sampleOrderItem = {
  id: 'oi-001',
  seller_offer_id: '20000001-0000-0000-0000-000000000001',
  product_id: '11111111-0000-0000-0000-000000000001',
  product_title: 'Cyberpunk 2077: Phantom Liberty Bundle',
  product_slug: 'cyberpunk-2077-phantom-liberty-bundle',
  platform: 'Steam',
  region: 'GLOBAL',
  seller_name: 'PixelVault Deals',
  unit_price_cents: 2899,
  license_key: 'CP77-PV01-9X82',
};

function renderWithProviders(node, initialEntries = ['/']) {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries },
      React.createElement(
        AuthProvider,
        null,
        React.createElement(CartProvider, null, React.createElement(WishlistProvider, null, node)),
      ),
    ),
  );
}

test('cartReducer adds, merges, clamps at stock max, updates quantity, and removes items', () => {
  let state = cartReducer([], { type: 'add', item: sampleCartItem, quantity: 2 });
  assert.equal(state.length, 1);
  assert.equal(state[0].quantity, 2);

  // Adding same offer again merges and clamps at maxQuantity (3)
  state = cartReducer(state, { type: 'add', item: sampleCartItem, quantity: 5 });
  assert.equal(state.length, 1);
  assert.equal(state[0].quantity, 3);

  // Decrement below 1 clamps to 1
  state = cartReducer(state, { type: 'setQuantity', sellerOfferId: sampleCartItem.sellerOfferId, quantity: 0 });
  assert.equal(state[0].quantity, 1);

  // Respects MAX_QTY_PER_OFFER even if maxQuantity were higher
  const largeStockItem = { ...sampleCartItem, sellerOfferId: 'offer-2', maxQuantity: 99 };
  state = cartReducer(state, { type: 'add', item: largeStockItem, quantity: 25 });
  assert.equal(state[1].quantity, MAX_QTY_PER_OFFER);

  // Remove first item leaves only second item
  state = cartReducer(state, { type: 'remove', sellerOfferId: sampleCartItem.sellerOfferId });
  assert.equal(state.length, 1);
  assert.equal(state[0].sellerOfferId, 'offer-2');

  // Clear empties cart
  state = cartReducer(state, { type: 'clear' });
  assert.equal(state.length, 0);
});

test('CartPage renders empty state and populated cart summary from localStorage', () => {
  localStorage.clear();
  const emptyHtml = renderWithProviders(React.createElement(CartPage), ['/cart']);
  assert.match(emptyHtml, /Your cart is empty/);
  assert.match(emptyHtml, /Browse Store/);

  localStorage.setItem('eneba.cart', JSON.stringify([{ ...sampleCartItem, quantity: 2 }]));
  const fullHtml = renderWithProviders(React.createElement(CartPage), ['/cart']);
  assert.match(fullHtml, /Cyberpunk 2077: Phantom Liberty Bundle/);
  assert.match(fullHtml, /PixelVault Deals/);
  assert.match(fullHtml, /Proceed to Checkout/);
  assert.match(fullHtml, /€57\.98/);
  localStorage.clear();
});

test('CheckoutPage and OrdersPage redirect unauthenticated users to /login with redirect query', () => {
  localStorage.clear();

  const checkoutHtml = renderWithProviders(React.createElement(CheckoutPage), ['/checkout']);
  assert.match(checkoutHtml, /data-redirect-to="\/login\?redirect=\/checkout"/);

  const ordersHtml = renderWithProviders(React.createElement(OrdersPage), ['/orders']);
  assert.match(ordersHtml, /data-redirect-to="\/login\?redirect=\/orders"/);

  // sanitizeRedirect prevents open redirects
  assert.equal(sanitizeRedirect('/checkout'), '/checkout');
  assert.equal(sanitizeRedirect('https://evil.example/phish'), '/');
  assert.equal(sanitizeRedirect('//evil.example/phish'), '/');
});

test('Authenticated user sees Checkout payment simulator and AuthPage redirects to target', () => {
  localStorage.setItem(
    'eneba.auth',
    JSON.stringify({
      token: 'jwt-demo-token',
      user: { id: 'u1', email: 'gamer@eneba-demo.com', full_name: 'Alex Gamer' },
    }),
  );
  localStorage.setItem('eneba.cart', JSON.stringify([{ ...sampleCartItem, quantity: 1 }]));

  const authHtml = renderWithProviders(React.createElement(AuthPage, { mode: 'login' }), ['/login?redirect=/checkout']);
  assert.match(authHtml, /data-redirect-to="\/checkout"/);

  const checkoutHtml = renderWithProviders(React.createElement(CheckoutPage), ['/checkout']);
  assert.match(checkoutHtml, /Test Mode — No Real Money Charged/);
  assert.match(checkoutHtml, /Credit \/ Debit Card \(Test Mode\)/);
  assert.match(checkoutHtml, /Pay €28\.99 &amp; Reveal Keys/);

  // Stripe Test Mode UI + canceled notice
  const stripeCheckoutHtml = renderWithProviders(
    React.createElement(CheckoutPage, { defaultStripeEnabled: true }),
    ['/checkout?canceled=1'],
  );
  assert.match(stripeCheckoutHtml, /Stripe Checkout \(Test Mode\)/);
  assert.match(stripeCheckoutHtml, /4242 4242 4242 4242/);
  assert.match(stripeCheckoutHtml, /Stripe checkout was canceled/);
  assert.match(stripeCheckoutHtml, /Continue to Stripe \(€28\.99\)/);

  localStorage.clear();
});

test('OrderKeyCard masks key by default, reveals exact key when toggled, and shows platform redemption info', () => {
  const maskedHtml = renderWithProviders(
    React.createElement(OrderKeyCard, { item: sampleOrderItem, defaultRevealed: false }),
  );
  assert.doesNotMatch(maskedHtml, /CP77-PV01-9X82/);
  assert.match(maskedHtml, /••••-••••-••••/);
  assert.match(maskedHtml, /Key ready in your account/);
  assert.match(maskedHtml, /Click to See Key/);
  assert.doesNotMatch(maskedHtml, /Copy Key/);

  const revealedHtml = renderWithProviders(
    React.createElement(OrderKeyCard, { item: sampleOrderItem, defaultRevealed: true }),
  );
  assert.match(revealedHtml, /CP77-PV01-9X82/);
  assert.match(revealedHtml, /Hide Key/);
  assert.match(revealedHtml, /Copy Key/);
  assert.match(revealedHtml, /Activate a Product on Steam/);
});

test('OrderDetailPage renders confirmation screen from cached order receipt', () => {
  localStorage.setItem(
    'eneba.auth',
    JSON.stringify({
      token: 'jwt-demo-token',
      user: { id: 'u1', email: 'gamer@eneba-demo.com', full_name: 'Alex Gamer' },
    }),
  );
  const orderId = '99999999-0000-0000-0000-000000000001';
  sessionStorage.setItem(
    `eneba.lastOrder.${orderId}`,
    JSON.stringify({
      id: orderId,
      user_id: 'u1',
      total_cents: 2899,
      status: 'COMPLETED',
      created_at: '2026-11-17T14:45:00Z',
      items: [sampleOrderItem],
    }),
  );

  const detailHtml = renderWithProviders(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, { path: '/orders/:id', element: React.createElement(OrderDetailPage) }),
    ),
    [{ pathname: `/orders/${orderId}`, state: { justPurchased: true } }],
  );
  assert.match(detailHtml, /Payment Successful — Your Digital Keys Are Ready!/);
  assert.match(detailHtml, /#99999999/);
  assert.match(detailHtml, /••••-••••-••••/);
  assert.match(detailHtml, /Click to See Key/);
  assert.doesNotMatch(detailHtml, /CP77-PV01-9X82/);
  assert.match(detailHtml, /Reveal All Keys/);

  // Stripe Checkout return route (/checkout/success?session_id=...) renders fulfilled keys cleanly
  sessionStorage.setItem(
    'eneba.stripeOrder.cs_test_123',
    JSON.stringify({
      id: orderId,
      user_id: 'u1',
      total_cents: 2899,
      status: 'COMPLETED',
      created_at: '2026-11-17T14:45:00Z',
      items: [sampleOrderItem],
    }),
  );
  const stripeSuccessHtml = renderWithProviders(
    React.createElement(
      Routes,
      null,
      React.createElement(Route, { path: '/checkout/success', element: React.createElement(OrderDetailPage) }),
    ),
    ['/checkout/success?session_id=cs_test_123'],
  );
  assert.match(stripeSuccessHtml, /Payment Successful — Your Digital Keys Are Ready!/);
  assert.match(stripeSuccessHtml, /••••-••••-••••/);
  assert.match(stripeSuccessHtml, /Click to See Key/);
  assert.doesNotMatch(stripeSuccessHtml, /CP77-PV01-9X82/);

  localStorage.clear();
  sessionStorage.clear();
});


test('isFuzzyMatch detects typo-tolerant matches vs literal substring matches', () => {
  assert.equal(isFuzzyMatch('Cyberpunk 2077: Phantom Liberty Bundle', 'cybrpunk'), true);
  assert.equal(isFuzzyMatch('Elden Ring: Shadow of the Erdtree Edition', 'eldn'), true);
  assert.equal(isFuzzyMatch('Cyberpunk 2077: Phantom Liberty Bundle', 'cyber'), false);
  assert.equal(isFuzzyMatch('Cyberpunk 2077: Phantom Liberty Bundle', 'a'), false);
});

test('CartDrawer renders quick-cart items, savings, quantity controls, and checkout CTA', () => {
  localStorage.setItem('eneba.cart', JSON.stringify([{ ...sampleCartItem, quantity: 2 }]));
  const html = renderWithProviders(React.createElement(CartDrawer, { forceOpen: true }), ['/']);
  assert.match(html, /Your Cart/);
  assert.match(html, /Cyberpunk 2077: Phantom Liberty Bundle/);
  assert.match(html, /PixelVault Deals/);
  assert.match(html, /€57\.98/);
  assert.match(html, /Proceed to Checkout/);
  assert.match(html, /View Full Cart/);
  localStorage.clear();
});

test('OrderKeyCard renders Verify / Test Redeem trigger and platform redemption preview modal', () => {
  const closedHtml = renderWithProviders(
    React.createElement(OrderKeyCard, { item: sampleOrderItem, defaultRevealed: false }),
  );
  assert.match(closedHtml, /Verify \/ Test Redeem/);

  const modalHtml = renderWithProviders(
    React.createElement(OrderKeyCard, { item: sampleOrderItem, defaultRedeemOpen: true }),
  );
  assert.match(modalHtml, /Steam Client Product Activation/);
  assert.match(modalHtml, /CP77-PV01-9X82/);
  assert.match(modalHtml, /Key Verified &amp; Activated on Account/);
});


test('multi-select platform and region helpers toggle, serialize, and reset to ALL when emptied', () => {
  const initial = parseMultiParam(['Steam,PSN'], STORE_PLATFORMS);
  assert.deepEqual(initial, ['Steam', 'PSN']);

  const added = toggleMultiSelect(initial, 'Xbox', STORE_PLATFORMS);
  assert.deepEqual(added, ['Steam', 'PSN', 'Xbox']);
  assert.equal(serializeMultiParam(added), 'Steam,PSN,Xbox');

  const removedOne = toggleMultiSelect(added, 'PSN', STORE_PLATFORMS);
  assert.deepEqual(removedOne, ['Steam', 'Xbox']);

  // Deselecting last remaining pill resets group to empty (ALL)
  const single = toggleMultiSelect(['Steam'], 'Steam', STORE_PLATFORMS);
  assert.deepEqual(single, []);
  assert.equal(serializeMultiParam(single), undefined);

  const regions = parseMultiParam(['global,EUROPE', 'europe'], STORE_REGIONS);
  assert.deepEqual(regions, ['GLOBAL', 'EUROPE']);
});

test('StorePage renders multi-select yellow pills and removable chips for multiple platforms & regions', () => {
  const html = renderWithProviders(
    React.createElement(StorePage),
    ['/store?platform=Steam,PSN&region=GLOBAL,EUROPE'],
  );
  assert.match(html, /aria-pressed="true"[^>]*>.*?Steam/s);
  assert.match(html, /aria-pressed="true"[^>]*>.*?PSN/s);
  assert.match(html, /aria-pressed="false"[^>]*>.*?Xbox/s);
  assert.match(html, /aria-pressed="true"[^>]*>GLOBAL<\/button>/);
  assert.match(html, /aria-pressed="true"[^>]*>EUROPE<\/button>/);
  assert.match(html, /Remove Steam filter/);
  assert.match(html, /Remove PSN filter/);
  assert.match(html, /Remove GLOBAL filter/);
  assert.match(html, /Remove EUROPE filter/);
  assert.match(html, /Clear All Filters \(4\)/);
  assert.match(html, /role="combobox"[^>]*aria-label="Sort by"/);
  assert.doesNotMatch(html, /<select[\s>]/);
  assert.match(html, /class="[^"]*no-spinner[^"]*"/);
});

test('AuthPage renders Show password toggles, Confirm Password on register, and validates matching passwords', () => {
  localStorage.clear();

  const loginHtml = renderWithProviders(React.createElement(AuthPage, { mode: 'login' }), ['/login']);
  assert.match(loginHtml, /Password/);
  assert.match(loginHtml, /aria-label="Show password"/);
  assert.doesNotMatch(loginHtml, /Confirm Password/);

  const registerHtml = renderWithProviders(React.createElement(AuthPage, { mode: 'register' }), ['/register']);
  assert.match(registerHtml, /Password/);
  assert.match(registerHtml, /Confirm Password/);
  assert.match(registerHtml, /placeholder="Re-enter your password"/);
  const showButtons = registerHtml.match(/aria-label="Show password"/g) ?? [];
  assert.equal(showButtons.length, 2);

  assert.equal(
    validateAuthInput({
      isRegister: true,
      fullName: 'Alex Gamer',
      email: 'gamer@eneba-demo.com',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    }),
    null,
  );
  assert.equal(
    validateAuthInput({
      isRegister: true,
      fullName: 'Alex Gamer',
      email: 'gamer@eneba-demo.com',
      password: 'Password123!',
      confirmPassword: 'DifferentPassword!',
    }),
    'Passwords do not match',
  );
});

test('CustomSelect renders accessible violet listbox and ProductCard renders platform strip, teal region, inline discount, and slide-up buttons', () => {
  const closedSelectHtml = renderToStaticMarkup(
    React.createElement(CustomSelect, {
      ariaLabel: 'Sort by',
      value: 'price_asc',
      options: [
        { value: 'popular', label: 'Most Popular' },
        { value: 'price_asc', label: 'Price: Low to High' },
      ],
      onChange: () => {},
    }),
  );
  assert.match(closedSelectHtml, /role="combobox"/);
  assert.match(closedSelectHtml, /aria-expanded="false"/);
  assert.match(closedSelectHtml, /Price: Low to High/);

  const openSelectHtml = renderToStaticMarkup(
    React.createElement(CustomSelect, {
      ariaLabel: 'Sort by',
      value: 'price_asc',
      defaultOpen: true,
      options: [
        { value: 'popular', label: 'Most Popular' },
        { value: 'price_asc', label: 'Price: Low to High' },
      ],
      onChange: () => {},
    }),
  );
  assert.match(openSelectHtml, /role="listbox"/);
  assert.match(openSelectHtml, /role="option"[^>]*aria-selected="true"[^>]*>.*?Price: Low to High/);
  assert.match(openSelectHtml, /text-\[#FFDC00\]/);

  const cardHtml = renderWithProviders(
    React.createElement(ProductCard, {
      product: {
        id: '11111111-0000-0000-0000-000000000001',
        title: 'Cyberpunk 2077: Phantom Liberty Bundle',
        slug: 'cyberpunk-2077-phantom-liberty-bundle',
        description: 'Open-world RPG',
        cover_image_url: 'https://example.com/cp77.jpg',
        platform: 'Steam',
        region: 'GLOBAL',
        genre: 'Action RPG',
        release_date: '2020-12-10',
        lowest_price_cents: 2899,
        original_price_cents: 5999,
        discount_percent: 52,
        best_seller_name: 'PixelVault Deals',
        best_seller_rating: 4.9,
        total_stock_count: 5,
        total_offers_count: 3,
      },
    }),
  );
  assert.match(cardHtml, /aria-label="Add to wishlist"/);
  assert.match(cardHtml, /bottom-full[^>]*>.*?Steam/s);
  assert.match(cardHtml, /GLOBAL/);
  assert.match(cardHtml, /€59\.99/);
  assert.match(cardHtml, /-52%/);
  assert.match(cardHtml, /€28\.99/);
  assert.match(cardHtml, /Add to Cart/);
  assert.match(cardHtml, /View Offers/);
  assert.match(cardHtml, /href="\/product\/cyberpunk-2077-phantom-liberty-bundle"/);
});

test('wishlistReducer persists items in eneba_wishlist, Navbar shows live count badge, and WishlistPage renders empty and populated states', () => {
  const sampleProduct = {
    id: '11111111-0000-0000-0000-000000000001',
    title: 'Cyberpunk 2077: Phantom Liberty Bundle',
    slug: 'cyberpunk-2077-phantom-liberty-bundle',
    description: 'Open-world RPG',
    cover_image_url: 'https://example.com/cp77.jpg',
    platform: 'Steam',
    region: 'GLOBAL',
    genre: 'Action RPG',
    release_date: '2020-12-10',
    lowest_price_cents: 2899,
    original_price_cents: 5999,
    discount_percent: 52,
    best_seller_name: 'PixelVault Deals',
    best_seller_rating: 4.9,
    total_stock_count: 5,
    total_offers_count: 3,
  };

  let state = wishlistReducer([], { type: 'toggle', product: sampleProduct });
  assert.equal(state.length, 1);
  assert.equal(state[0].id, sampleProduct.id);

  // Toggling again removes the product
  state = wishlistReducer(state, { type: 'toggle', product: sampleProduct });
  assert.equal(state.length, 0);

  // Adding and removing by ID
  state = wishlistReducer([], { type: 'toggle', product: sampleProduct });
  state = wishlistReducer(state, { type: 'remove', productId: sampleProduct.id });
  assert.equal(state.length, 0);

  localStorage.clear();
  const emptyWishlistHtml = renderWithProviders(React.createElement(WishlistPage), ['/wishlist']);
  assert.match(emptyWishlistHtml, /Your wishlist is empty/);
  assert.match(emptyWishlistHtml, /href="\/store"/);
  assert.match(emptyWishlistHtml, /Browse Store/);

  assert.equal(WISHLIST_STORAGE_KEY, 'eneba_wishlist');
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([sampleProduct]));

  const navbarHtml = renderWithProviders(React.createElement(Navbar), ['/']);
  assert.match(navbarHtml, /href="\/wishlist"/);
  assert.match(navbarHtml, /data-testid="wishlist-badge"[^>]*>1<\/span>/);
  assert.match(navbarHtml, />eneba<\/span>/);
  assert.match(navbarHtml, />DEMO<\/span>/);
  assert.match(navbarHtml, /<polygon/);

  const fullWishlistHtml = renderWithProviders(React.createElement(WishlistPage), ['/wishlist']);
  assert.match(fullWishlistHtml, /My Wishlist/);
  assert.match(fullWishlistHtml, /Cyberpunk 2077: Phantom Liberty Bundle/);
  assert.match(fullWishlistHtml, /aria-label="Remove from wishlist"/);
  assert.match(fullWishlistHtml, /aria-pressed="true"/);
  assert.match(fullWishlistHtml, /Move to Cart/);
  localStorage.clear();
});
