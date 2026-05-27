import { getApiBaseUrl } from './api.js';
import { initPWABanner } from '../pwa-install.js';

const CLIENT_TOKEN_STORAGE_KEY = 'barberflow.clientToken';
const CLIENT_PROFILE_STORAGE_KEY = 'barberflow.clientProfile';
const CLIENT_FLASH_STORAGE_KEY = 'barberflow.clientFlash';

const CLIENT_LICENSE_ERRORS = ['license_suspended', 'license_cancelled'];

const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Faça login novamente.';
const CLIENT_LICENSE_MESSAGE =
  'Esta barbearia está temporariamente indisponível. Entre em contato com a barbearia para mais informações.';

function sanitizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getClientApiBaseUrl() {
  return sanitizeBaseUrl(getApiBaseUrl());
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

function safeRemoveLocalStorageItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

function safeSetSessionStorageItem(key, value) {
  try {
    if (value) {
      sessionStorage.setItem(key, value);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {
    // noop
  }
}

function normalizeErrorCode(payload) {
  return String(payload?.error || payload?.code || '').trim().toLowerCase();
}

function normalizeErrorMessage(payload, response) {
  if (payload && typeof payload === 'object') {
    return String(payload.message || payload.error || payload.code || '').trim();
  }

  if (typeof payload === 'string') {
    return payload.trim();
  }

  return `Erro HTTP ${response.status}`;
}

function isClientLicenseErrorCode(code) {
  return CLIENT_LICENSE_ERRORS.includes(String(code || '').toLowerCase());
}

function redirectToClientLogin() {
  const path = window.location.pathname;

  if (path === '/client/login') return;

  window.location.replace('/client/login');
}

export class ClientHttpError extends Error {
  constructor(message, { status = 0, code = '', payload = null } = {}) {
    super(message);
    this.name = 'ClientHttpError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function isClientLicenseUnavailableError(error) {
  return (
    isClientLicenseErrorCode(error?.code) ||
    CLIENT_LICENSE_ERRORS.some((code) =>
      String(error?.message || '').toLowerCase().includes(code)
    )
  );
}

export function getClientToken() {
  return String(safeGetLocalStorageItem(CLIENT_TOKEN_STORAGE_KEY) || '').trim();
}

export function setClientToken(token) {
  const value = String(token || '').trim();
  safeSetLocalStorageItem(CLIENT_TOKEN_STORAGE_KEY, value);
  return value;
}

export function clearClientToken() {
  safeRemoveLocalStorageItem(CLIENT_TOKEN_STORAGE_KEY);
}

export function hasClientToken() {
  return Boolean(getClientToken());
}

export function getClientProfile() {
  try {
    const raw = localStorage.getItem(CLIENT_PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setClientProfile(profile) {
  if (profile) {
    safeSetLocalStorageItem(CLIENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } else {
    safeRemoveLocalStorageItem(CLIENT_PROFILE_STORAGE_KEY);
  }
}

export function clearClientProfile() {
  safeRemoveLocalStorageItem(CLIENT_PROFILE_STORAGE_KEY);
}

export function logoutClient() {
  clearClientToken();
  clearClientProfile();
}

export function getClientFlash() {
  try {
    const raw = sessionStorage.getItem(CLIENT_FLASH_STORAGE_KEY);
    sessionStorage.removeItem(CLIENT_FLASH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setClientFlash(message, variant = 'neutral') {
  safeSetSessionStorageItem(
    CLIENT_FLASH_STORAGE_KEY,
    JSON.stringify({ message, variant })
  );
}

async function clientFetch(path, options = {}, requireAuth = false) {
  const baseUrl = getClientApiBaseUrl();

  if (!baseUrl) {
    throw new Error('URL da API não configurada.');
  }

  const headers = new Headers(options.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (requireAuth) {
    const token = getClientToken();

    if (!token) {
      throw new ClientHttpError('Sessão do cliente não encontrada.', {
        status: 401,
        code: 'client_session_missing',
      });
    }

    headers.set('Authorization', `Bearer ${token}`);
  }

  let response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.');
  }

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
    const code = normalizeErrorCode(payload);
    const rawMessage = normalizeErrorMessage(payload, response);

    if (response.status === 401 && requireAuth) {
      logoutClient();
      setClientFlash(SESSION_EXPIRED_MESSAGE, 'error');
      redirectToClientLogin();

      throw new ClientHttpError(SESSION_EXPIRED_MESSAGE, {
        status: response.status,
        code: code || 'client_session_expired',
        payload,
      });
    }

    if (response.status === 403 && isClientLicenseErrorCode(code)) {
      throw new ClientHttpError(rawMessage || CLIENT_LICENSE_MESSAGE, {
        status: response.status,
        code,
        payload,
      });
    }

    throw new ClientHttpError(rawMessage || `Erro HTTP ${response.status}`, {
      status: response.status,
      code,
      payload,
    });
  }

  return payload;
}

export async function registerClient(payload) {
  const data = await clientFetch('/api/client-auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (data?.token) {
    setClientToken(data.token);
  }

  if (data?.client) {
    setClientProfile(data.client);
  }

  return data;
}

export async function loginClient(payload) {
  const data = await clientFetch('/api/client-auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (data?.token) {
    setClientToken(data.token);
  }

  if (data?.client) {
    setClientProfile(data.client);
  }

  initPWABanner();

  return data;
}

export async function meClient() {
  const data = await clientFetch('/api/client-auth/me', { method: 'GET' }, true);

  if (data?.client) {
    setClientProfile(data.client);
  }

  initPWABanner();

  return data;
}

export async function forgotPasswordClient(payload) {
  return clientFetch('/api/client-auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resetPasswordClient(payload) {
  return clientFetch('/api/client-auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getClientPortalContext() {
  return clientFetch('/api/client-portal/context', { method: 'GET' }, true);
}

export async function getClientPortalServices() {
  return clientFetch('/api/client-portal/services', { method: 'GET' }, true);
}

export async function getClientPortalBarbers(params = {}) {
  return clientFetch(
    `/api/client-portal/barbers${buildQueryString(params)}`,
    { method: 'GET' },
    true
  );
}

export async function getClientPortalAvailableSlots(params = {}) {
  return clientFetch(
    `/api/client-portal/available-slots${buildQueryString(params)}`,
    { method: 'GET' },
    true
  );
}

export async function createClientPortalAppointment(payload) {
  return clientFetch('/api/client-portal/appointments', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

export async function getClientPortalAppointments() {
  return clientFetch('/api/client-portal/appointments', { method: 'GET' }, true);
}

export async function cancelClientPortalAppointment(appointmentId, reason = '') {
  return clientFetch(`/api/client-portal/appointments/${appointmentId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  }, true);
}

export async function rateClientPortalAppointment(appointmentId, payload) {
  return clientFetch(`/api/client-portal/appointments/${appointmentId}/rate`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

export async function getClientPortalPlans() {
  return clientFetch('/api/client-portal/plans', { method: 'GET' }, true);
}

export async function getClientPortalSubscription() {
  return clientFetch('/api/client-portal/subscription', { method: 'GET' }, true);
}

export async function createClientPortalSubscriptionCheckout(payload) {
  return clientFetch('/api/client-portal/subscriptions/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

export async function cancelClientPortalPendingSubscription(reason = '') {
  return clientFetch('/api/client-portal/subscription/cancel', {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  }, true);
}

export async function getClientPortalProfile() {
  return clientFetch('/api/client-portal/profile', { method: 'GET' }, true);
}

export async function updateClientPortalProfile(payload) {
  return clientFetch('/api/client-portal/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }, true);
}

export async function changeClientPortalPassword(payload) {
  return clientFetch('/api/client-portal/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

/**
 * Aliases temporários para manter compatibilidade com imports antigos.
 */
export const clientRegister = registerClient;
export const clientLogin = loginClient;
export const getClientMe = meClient;
export const requestClientPasswordReset = forgotPasswordClient;
