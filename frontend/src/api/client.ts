import type {
  AuthResponse,
  CheckoutItemRequest,
  CheckoutRequest,
  HealthResponse,
  HomepageResponse,
  LoginRequest,
  Order,
  OrdersResponse,
  PaymentConfigResponse,
  ProductDetail,
  ProductListResponse,
  ProductQuery,
  RegisterRequest,
  StripeSessionResponse,
} from '../types/api';

export const DEFAULT_PROD_API_URL = 'https://eneba-api-ztqj.onrender.com';

export function resolveApiBaseUrl(apiUrl?: string, apiBaseUrl?: string, isProd = false): string {
  const cleaned = (apiUrl || apiBaseUrl || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/i, '');

  if (cleaned) return cleaned;
  return isProd ? DEFAULT_PROD_API_URL : '';
}

export const API_BASE_URL: string = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.VITE_API_BASE_URL,
  Boolean(import.meta.env.PROD),
);

export class ApiError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
}

async function request<T>(path: string, { method = 'GET', body, token, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Unable to reach the server. Is the API running?');
  }

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!res.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, payload);
  }

  if (payload === null) {
    throw new ApiError(
      res.status,
      'Unexpected non-JSON response from API server. Please retry or check VITE_API_URL configuration.',
    );
  }

  return payload as T;
}

function toQueryString(query: ProductQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      const cleaned = value.map((v) => v.trim()).filter(Boolean);
      if (cleaned.length > 0) params.set(key, cleaned.join(','));
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  getHealth: (signal?: AbortSignal) => request<HealthResponse>('/api/health', { signal }),

  getHomepage: (signal?: AbortSignal) => request<HomepageResponse>('/api/homepage', { signal }),

  listProducts: (query: ProductQuery = {}, signal?: AbortSignal) =>
    request<ProductListResponse>(`/api/products${toQueryString(query)}`, { signal }),

  getProduct: (slug: string, signal?: AbortSignal) =>
    request<ProductDetail>(`/api/products/${encodeURIComponent(slug)}`, { signal }),

  register: (payload: RegisterRequest) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: payload }),

  login: (payload: LoginRequest) => request<AuthResponse>('/api/auth/login', { method: 'POST', body: payload }),

  getPaymentConfig: (signal?: AbortSignal) => request<PaymentConfigResponse>('/api/config/payment', { signal }),

  createStripeSession: (items: CheckoutItemRequest[], token: string) =>
    request<StripeSessionResponse>('/api/checkout/stripe-session', {
      method: 'POST',
      body: { items },
      token,
    }),

  checkout: (payload: CheckoutRequest, token: string) =>
    request<Order>('/api/orders/checkout', { method: 'POST', body: payload, token }),

  listOrders: (token: string, signal?: AbortSignal) => request<OrdersResponse>('/api/orders', { token, signal }),
};

export const fetchProducts = api.listProducts;

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}
