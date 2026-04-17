import { getApiBaseUrl } from './api.js';

const CLIENT_TOKEN_STORAGE_KEY = 'barberflow.clientToken';
const CLIENT_PROFILE_STORAGE_KEY = 'barberflow.clientProfile';

function sanitizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/$/, '');
}

function getClientApiBaseUrl() {
  return sanitizeBaseUrl(getApiBaseUrl());
}

export function getClientToken() {
  return String(localStorage.getItem(CLIENT_TOKEN_STORAGE_KEY) || '').trim();
}

export function setClientToken(token) {
  const value = String(token || '').trim();

  if (value) {
    localStorage.setItem(CLIENT_TOKEN_STORAGE_KEY, value);
  } else {
    localStorage.removeItem(CLIENT_TOKEN_STORAGE_KEY);
  }

  return value;
}

export function clearClientToken() {
  localStorage.removeItem(CLIENT_TOKEN_STORAGE_KEY);
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
    localStorage.setItem(CLIENT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(CLIENT_PROFILE_STORAGE_KEY);
  }
}

export function clearClientProfile() {
  localStorage.removeItem(CLIENT_PROFILE_STORAGE_KEY);
}

export function logoutClient() {
  clearClientToken();
  clearClientProfile();
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
      throw new Error('Sessão do cliente não encontrada.');
    }

    headers.set('Authorization', `Bearer ${token}`);
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
    const message =
      payload?.error ||
      payload?.message ||
      `Erro HTTP ${response.status}`;

    throw new Error(message);
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

  return data;
}

export async function meClient() {
  const data = await clientFetch('/api/client-auth/me', { method: 'GET' }, true);

  if (data?.client) {
    setClientProfile(data.client);
  }

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

/* aliases temporários */
export const clientRegister = registerClient;
export const clientLogin = loginClient;
export const getClientMe = meClient;
export const requestClientPasswordReset = forgotPasswordClient;
