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
  MAX_QTY_PER_OFFER,
  MemoryRouter,
  OrderDetailPage,
  OrderKeyCard,
  OrdersPage,
  Route,
  Routes,
  AuthPage,
  cartReducer,
  isFuzzyMatch,
  sanitizeRedirect,
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
      React.createElement(AuthProvider, null, React.createElement(CartProvider, null, node)),
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

  localStorage.clear();
});

test('OrderKeyCard masks key by default, reveals exact key when toggled, and shows platform redemption info', () => {
  const maskedHtml = renderWithProviders(
    React.createElement(OrderKeyCard, { item: sampleOrderItem, defaultRevealed: false }),
  );
  assert.doesNotMatch(maskedHtml, /CP77-PV01-9X82/);
  assert.match(maskedHtml, /••••-••••-••••/);
  assert.match(maskedHtml, /Reveal Key/);
  assert.match(maskedHtml, /Copy Key/);

  const revealedHtml = renderWithProviders(
    React.createElement(OrderKeyCard, { item: sampleOrderItem, defaultRevealed: true }),
  );
  assert.match(revealedHtml, /CP77-PV01-9X82/);
  assert.match(revealedHtml, /Hide Key/);
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
  assert.match(detailHtml, /Reveal All Keys/);

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
