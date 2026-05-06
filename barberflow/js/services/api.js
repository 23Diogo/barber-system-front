const API_URL_STORAGE_KEY = 'barberflow.apiUrl';
const AUTH_TOKEN_STORAGE_KEY = 'barberflow.authToken';

const DEFAULT_LOCAL_API_URL = 'http://localhost:3002';
const DEFAULT_PRODUCTION_API_URL = 'https://api.bbarberflow.com.br';
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

const LICENSE_SUSPENDED_PATH = '/app/assinatura';
const LICENSE_SUSPENDED_ERRORS = ['license_suspended', 'license_cancelled'];

function sanitizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function safeGetLocalStorageItem(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSetLocalStorageItem(key, value) {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // noop
  }
}

function getMetaApiBaseUrl() {
  try {
    return sanitizeBaseUrl(
      document.querySelector('meta[name="barberflow-api-url"]')?.getAttribute('content') || ''
    );
  } catch {
    return '';
  }
}

function getWindowApiBaseUrl() {
  try {
    return sanitizeBaseUrl(window.BARBERFLOW_API_URL || '');
  } catch {
    return '';
  }
}

function getCurrentHostname() {
  try {
    return String(window.location.hostname || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function getCurrentHost() {
  try {
    return String(window.location.host || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function isLocalHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0'
  );
}

function isBarberFlowProductionHostname(hostname) {
  return (
    hostname === 'bbarberflow.com.br' ||
    hostname === 'www.bbarberflow.com.br' ||
    hostname === 'api.bbarberflow.com.br' ||
    hostname.endsWith('.bbarberflow.com.br')
  );
}

function inferApiBaseUrlFromHostname() {
  const hostname = getCurrentHostname();

  if (!hostname) return '';

  if (isLocalHostname(hostname)) {
    return DEFAULT_LOCAL_API_URL;
  }

  if (isBarberFlowProductionHostname(hostname)) {
    return DEFAULT_PRODUCTION_API_URL;
  }

  return '';
}

function getTenantSlugFromHostname(hostname = getCurrentHostname()) {
  const suffix = '.bbarberflow.com.br';

  if (!hostname.endsWith(suffix)) return '';

  const subdomain = hostname.slice(0, -suffix.length).trim();

  if (!subdomain || subdomain === 'www' || subdomain === 'api') {
    return '';
  }

  return subdomain;
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

// ─── Interceptor de licença suspensa ─────────────────────────────────────────
// Evita redirecionamentos em loop caso já esteja na tela de assinatura
function isLicenseSuspendedError(error) {
  return LICENSE_SUSPENDED_ERRORS.some(code =>
    String(error?.message || '').toLowerCase().includes(code)
  );
}

function redirectToLicensePage() {
  const currentPath = window.location.pathname;
  if (currentPath.startsWith(LICENSE_SUSPENDED_PATH)) return;
  window.location.replace(LICENSE_SUSPENDED_PATH);
}

export function getApiBaseUrl() {
  return sanitizeBaseUrl(
    getWindowApiBaseUrl() ||
    getMetaApiBaseUrl() ||
    safeGetLocalStorageItem(API_URL_STORAGE_KEY) ||
    inferApiBaseUrlFromHostname()
  );
}

export function setApiBaseUrl(url) {
  const value = sanitizeBaseUrl(url);
  safeSetLocalStorageItem(API_URL_STORAGE_KEY, value);
  return value;
}

export function clearApiBaseUrl() {
  safeSetLocalStorageItem(API_URL_STORAGE_KEY, '');
}

export function getAuthToken() {
  try {
    return String(
      window.BARBERFLOW_AUTH_TOKEN ||
      safeGetLocalStorageItem(AUTH_TOKEN_STORAGE_KEY) ||
      ''
    ).trim();
  } catch {
    return String(safeGetLocalStorageItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
  }
}

export function setAuthToken(token) {
  const value = String(token || '').trim();
  safeSetLocalStorageItem(AUTH_TOKEN_STORAGE_KEY, value);
  return value;
}

export function clearAuthToken() {
  safeSetLocalStorageItem(AUTH_TOKEN_STORAGE_KEY, '');
}

export function hasApiConfig() {
  return Boolean(getApiBaseUrl());
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

export function getTenantSlug() {
  return getTenantSlugFromHostname();
}

export async function apiFetch(path, options = {}) {
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    throw new Error(
      'URL da API não configurada. Configure window.BARBERFLOW_API_URL ou publique a API em https://api.bbarberflow.com.br.'
    );
  }

  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const authToken = getAuthToken();
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const tenantSlug = getTenantSlug();
  if (tenantSlug && !headers.has('X-BarberFlow-Tenant')) {
    headers.set('X-BarberFlow-Tenant', tenantSlug);
  }

  const currentHost = getCurrentHost();
  if (currentHost && !headers.has('X-BarberFlow-Host')) {
    headers.set('X-BarberFlow-Host', currentHost);
  }

  const timeoutMs =
    Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0
      ? Number(options.timeoutMs)
      : DEFAULT_REQUEST_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestUrl = String(path || '').startsWith('http')
    ? String(path)
    : `${baseUrl}${path}`;

  try {
    const response = await fetch(requestUrl, {
      ...options,
      headers,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload = null;

    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const errorCode = payload?.error || '';
      const message = payload?.message || payload?.error || `Erro HTTP ${response.status}`;

      // ─── Interceptor de licença suspensa ─────────────────────────────────
      if (response.status === 403 && LICENSE_SUSPENDED_ERRORS.includes(errorCode)) {
        redirectToLicensePage();
        throw new Error(message);
      }

      throw new Error(message);
    }

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('A API demorou para responder. Tente novamente.');
    }

    // Captura erros de licença que possam ter passado pelo catch acima
    if (isLicenseSuspendedError(error)) {
      redirectToLicensePage();
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function formatDateForApi(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function loginWithEmail(email) {
  const payload = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

  if (payload?.token) {
    setAuthToken(payload.token);
  }

  return payload;
}

export async function getMe() {
  return apiFetch('/api/auth/me');
}

export async function getAppointmentsByDate(date) {
  const query = new URLSearchParams({ date }).toString();
  return apiFetch(`/api/appointments?${query}`);
}

export async function getClients() {
  return apiFetch('/api/clients');
}

export async function getClientById(clientId) {
  return apiFetch(`/api/clients/${clientId}`);
}

export async function createClient(payload) {
  return apiFetch('/api/clients', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateClient(clientId, payload) {
  return apiFetch(`/api/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getBarbers() {
  return apiFetch('/api/barbers');
}

export async function getServices() {
  return apiFetch('/api/services');
}

export async function createAppointment(payload) {
  return apiFetch('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAppointmentStatus(appointmentId, status) {
  const payload = JSON.stringify({ status });

  try {
    return await apiFetch(`/api/appointments/${appointmentId}`, {
      method: 'PATCH',
      body: payload,
    });
  } catch (firstError) {
    try {
      return await apiFetch(`/api/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        body: payload,
      });
    } catch {
      throw firstError;
    }
  }
}

/* =========================
   LICENÇA DA PLATAFORMA
========================= */

export async function getPaymentLink() {
  return apiFetch('/api/auth/payment-link', {
    method: 'POST',
  });
}

/* =========================
   PLANOS
========================= */

export async function getPlans(filters = {}) {
  return apiFetch(`/api/plans${buildQueryString(filters)}`);
}

export async function getPlanById(planId) {
  return apiFetch(`/api/plans/${planId}`);
}

export async function createPlan(payload) {
  return apiFetch('/api/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePlan(planId, payload) {
  return apiFetch(`/api/plans/${planId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/* =========================
   ASSINATURAS
========================= */

export async function getSubscriptions(filters = {}) {
  return apiFetch(`/api/subscriptions${buildQueryString(filters)}`);
}

export async function getSubscriptionById(subscriptionId) {
  return apiFetch(`/api/subscriptions/${subscriptionId}`);
}

export async function getActiveSubscriptionByClient(clientId) {
  return apiFetch(`/api/subscriptions/client/${clientId}/active`);
}

export async function createSubscription(payload) {
  return apiFetch('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateSubscription(subscriptionId, payload) {
  return apiFetch(`/api/subscriptions/${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function activateSubscription(subscriptionId) {
  return apiFetch(`/api/subscriptions/${subscriptionId}/activate`, {
    method: 'POST',
  });
}

export async function pauseSubscription(subscriptionId) {
  return apiFetch(`/api/subscriptions/${subscriptionId}/pause`, {
    method: 'POST',
  });
}

export async function reactivateSubscription(subscriptionId) {
  return apiFetch(`/api/subscriptions/${subscriptionId}/reactivate`, {
    method: 'POST',
  });
}

export async function cancelSubscription(subscriptionId) {
  return apiFetch(`/api/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
  });
}

export async function generateNextSubscriptionCycle(subscriptionId, payload = {}) {
  return apiFetch(`/api/subscriptions/${subscriptionId}/generate-next-cycle`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function consumeSubscriptionBenefit(subscriptionId, payload) {
  return apiFetch(`/api/subscriptions/${subscriptionId}/consume`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/* =========================
   COBRANÇAS / PAGAMENTOS
========================= */

export async function getSubscriptionInvoices(filters = {}) {
  return apiFetch(`/api/payments/invoices${buildQueryString(filters)}`);
}

export async function createManualInvoice(payload) {
  return apiFetch('/api/payments/invoices/manual', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function markInvoicePaid(invoiceId) {
  return apiFetch(`/api/payments/invoices/${invoiceId}/mark-paid`, {
    method: 'POST',
  });
}

export async function markInvoiceFailed(invoiceId) {
  return apiFetch(`/api/payments/invoices/${invoiceId}/mark-failed`, {
    method: 'POST',
  });
}

export async function cancelInvoice(invoiceId) {
  return apiFetch(`/api/payments/invoices/${invoiceId}/cancel`, {
    method: 'POST',
  });
}

/* =========================
   MERCADO PAGO
========================= */

export async function createMercadoPagoPreference(payload) {
  return apiFetch('/api/mercadopago/create-preference', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

window.BarberFlowApi = {
  getApiBaseUrl,
  setApiBaseUrl,
  clearApiBaseUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  hasApiConfig,
  hasAuthToken,
  getTenantSlug,
  apiFetch,
  formatDateForApi,
  loginWithEmail,
  getMe,
  getAppointmentsByDate,
  getClients,
  getClientById,
  createClient,
  updateClient,
  getBarbers,
  getServices,
  createAppointment,
  updateAppointmentStatus,
  getPaymentLink,
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  getSubscriptions,
  getSubscriptionById,
  getActiveSubscriptionByClient,
  createSubscription,
  updateSubscription,
  activateSubscription,
  pauseSubscription,
  reactivateSubscription,
  cancelSubscription,
  generateNextSubscriptionCycle,
  consumeSubscriptionBenefit,
  getSubscriptionInvoices,
  createManualInvoice,
  markInvoicePaid,
  markInvoiceFailed,
  cancelInvoice,
  createMercadoPagoPreference,
};
