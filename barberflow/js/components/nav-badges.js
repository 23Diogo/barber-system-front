import { apiFetch, hasAuthToken, hasApiConfig, formatDateForApi } from '../services/api.js';

const BADGE_REFRESH_MS     = 5 * 60 * 1000; // 5 minutos
const CLIENTS_SEEN_KEY     = 'barberflow.clientsSeenCount';

let badgeRefreshTimer = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!count || count <= 0) {
    el.style.display = 'none';
    el.textContent = '0';
    return;
  }
  el.style.display = '';
  el.textContent = count > 99 ? '99+' : String(count);
}

function hideBadge(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ─── Lógica de novos clientes ─────────────────────────────────────────────────

function getSeenClientsCount() {
  try {
    return Number(localStorage.getItem(CLIENTS_SEEN_KEY) || 0);
  } catch { return 0; }
}

function saveSeenClientsCount(count) {
  try { localStorage.setItem(CLIENTS_SEEN_KEY, String(count)); } catch {}
}

function clearClientsBadge(totalCount) {
  hideBadge('badge-clientes');
  // Salva o total atual como "visto"
  if (totalCount !== null) saveSeenClientsCount(totalCount);
}

// ─── Fetch e cálculo ──────────────────────────────────────────────────────────

let _lastKnownClientCount = null;

async function fetchBadgeData() {
  const today = formatDateForApi(new Date());

  const [agendaRes, dashRes, campaignsRes, reviewsRes, clientsRes] = await Promise.allSettled([
    apiFetch(`/api/appointments?date=${today}`),
    apiFetch('/api/dashboard'),
    apiFetch('/api/marketing/campaigns'),
    apiFetch('/api/reviews'),
    apiFetch('/api/clients?limit=1'),
  ]);

  // ── Agenda: agendamentos de hoje não cancelados ──
  if (agendaRes.status === 'fulfilled') {
    const apts = Array.isArray(agendaRes.value) ? agendaRes.value : [];
    const count = apts.filter(a => !['cancelled', 'no_show'].includes(a.status)).length;
    setBadge('badge-agenda', count);
  }

  // ── Estoque: itens abaixo do mínimo ──
  if (dashRes.status === 'fulfilled') {
    const lowStock = Array.isArray(dashRes.value?.low_stock) ? dashRes.value.low_stock : [];
    setBadge('badge-estoque', lowStock.length);
  }

  // ── Marketing: campanhas ativas ou agendadas ──
  if (campaignsRes.status === 'fulfilled') {
    const campaigns = Array.isArray(campaignsRes.value) ? campaignsRes.value : [];
    const count = campaigns.filter(c => ['active', 'scheduled', 'automatic'].includes(c.status)).length;
    setBadge('badge-mkt', count);
  }

  // ── Avaliações: avaliações dos últimos 7 dias ──
  if (reviewsRes.status === 'fulfilled') {
    const reviews = Array.isArray(reviewsRes.value) ? reviewsRes.value : [];
    const cutoff  = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const count = reviews.filter(r => new Date(r.created_at) >= cutoff).length;
    setBadge('badge-aval', count);
  }

  // ── Clientes: novos desde a última visita ──
  if (clientsRes.status === 'fulfilled') {
    const payload  = clientsRes.value;

    // Suporta total como número direto, em payload.total ou payload.count
    const total =
      typeof payload === 'number' ? payload :
      Number(payload?.total ?? payload?.count ?? payload?.length ?? 0);

    _lastKnownClientCount = total;

    const seen = getSeenClientsCount();

    // Primeira vez que abre (seen = 0): salva o total atual sem mostrar badge
    if (seen === 0) {
      saveSeenClientsCount(total);
    } else {
      const novos = Math.max(0, total - seen);
      setBadge('badge-clientes', novos);
    }
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function refreshNavBadges() {
  if (!hasApiConfig() || !hasAuthToken()) {
    ['badge-agenda', 'badge-estoque', 'badge-mkt', 'badge-aval', 'badge-clientes'].forEach(hideBadge);
    return;
  }
  try {
    await fetchBadgeData();
  } catch (error) {
    console.error('[nav-badges] Erro ao atualizar badges:', error.message);
  }
}

export function initNavBadges() {
  ['badge-agenda', 'badge-estoque', 'badge-mkt', 'badge-aval', 'badge-clientes'].forEach(hideBadge);

  // Zera badge de clientes ao clicar no menu
  document.addEventListener('click', (event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;

    // Clique em qualquer elemento dentro do nav-item de clientes
    if (t.closest('[data-nav-target="clientes"]')) {
      clearClientsBadge(_lastKnownClientCount);
    }

    // Atualiza badges após login/logout
    if (t.closest('#authConnectBtn') || t.closest('#authDisconnectBtn')) {
      setTimeout(refreshNavBadges, 1500);
    }
  });

  window.addEventListener('storage', () => {
    setTimeout(refreshNavBadges, 500);
  });

  // Refresh periódico
  if (badgeRefreshTimer) clearInterval(badgeRefreshTimer);
  badgeRefreshTimer = setInterval(refreshNavBadges, BADGE_REFRESH_MS);

  // Primeira carga
  refreshNavBadges();
}
