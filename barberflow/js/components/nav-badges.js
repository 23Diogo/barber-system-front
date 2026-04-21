import { apiFetch, hasAuthToken, hasApiConfig, formatDateForApi } from '../services/api.js';

const BADGE_REFRESH_MS = 5 * 60 * 1000; // 5 minutos
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

// ─── Fetch e cálculo ──────────────────────────────────────────────────────────

async function fetchBadgeData() {
  const today = formatDateForApi(new Date());

  const [agendaRes, dashRes, campaignsRes, reviewsRes] = await Promise.allSettled([
    apiFetch(`/api/appointments?date=${today}`),
    apiFetch('/api/dashboard'),
    apiFetch('/api/marketing/campaigns'),
    apiFetch('/api/reviews'),
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
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function refreshNavBadges() {
  if (!hasApiConfig() || !hasAuthToken()) {
    ['badge-agenda', 'badge-estoque', 'badge-mkt', 'badge-aval'].forEach(hideBadge);
    return;
  }

  try {
    await fetchBadgeData();
  } catch (error) {
    console.error('[nav-badges] Erro ao atualizar badges:', error.message);
  }
}

export function initNavBadges() {
  // Oculta todos os badges enquanto não há sessão
  ['badge-agenda', 'badge-estoque', 'badge-mkt', 'badge-aval'].forEach(hideBadge);

  // Atualiza quando o usuário faz login
  document.addEventListener('click', (event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;
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
