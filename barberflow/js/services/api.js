const API_URL_STORAGE_KEY = 'barberflow.apiUrl';
const AUTH_TOKEN_STORAGE_KEY = 'barberflow.authToken';

function sanitizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

export function getApiBaseUrl() {
  return sanitizeBaseUrl(window.BARBERFLOW_API_URL || localStorage.getItem(API_URL_STORAGE_KEY) || '');
}

export function setApiBaseUrl(url) {
  const value = sanitizeBaseUrl(url);
  if (value) localStorage.setItem(API_URL_STORAGE_KEY, value);
  else localStorage.removeItem(API_URL_STORAGE_KEY);
  return value;
}

export function clearApiBaseUrl() {
  localStorage.removeItem(API_URL_STORAGE_KEY);
}

export function getAuthToken() {
  return String(window.BARBERFLOW_AUTH_TOKEN || localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
}

export function setAuthToken(token) {
  const value = String(token || '').trim();
  if (value) localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, value);
  else localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  return value;
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function hasApiConfig() {
  return Boolean(getApiBaseUrl());
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

export async function apiFetch(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error('URL da API não configurada.');

  const headers = new Headers(options.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const authToken = getAuthToken();
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
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
    const message = payload?.error || payload?.message || `Erro HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
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

window.BarberFlowApi = {
  getApiBaseUrl,
  setApiBaseUrl,
  clearApiBaseUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  loginWithEmail,
  getMe,
  getAppointmentsByDate,
  getClients,
  getBarbers,
  getServices,
  createAppointment,
  formatDateForApi,
};
