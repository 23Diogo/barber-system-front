import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const FILTER_STORAGE_KEY = 'barberflow.loyalty.filter';

const LOYALTY_FILTERS = [
  { id: 'all', label: 'Todos', hint: 'Clientes ativos' },
  { id: 'with_points', label: 'Com pontos', hint: 'Membros do clube' },
  { id: 'ready_to_redeem', label: 'Pode resgatar', hint: 'Pronto para benefício' },
  { id: 'near_reward', label: 'Quase lá', hint: 'Perto de ganhar' },
  { id: 'inactive_points', label: 'Sumidos', hint: 'Com pontos parados' },
  { id: 'vip', label: 'VIP', hint: 'Alto valor' },
  { id: 'plan_clients', label: 'Com plano', hint: 'Assinantes' },
  { id: 'no_points', label: 'Sem pontos', hint: 'Ativar no clube' },
  { id: 'attention', label: 'Atenção', hint: 'Oportunidades' },
];

const fidelidadeState = {
  program: null,
  dashboard: null,
  rewards: [],
  members: [],
  isLoading: false,
  modalMode: 'closed',
  activeClientId: null,
  activeRewardId: null,
  activeFilter: getInitialFilter(),
  searchTerm: '',
};

function getInitialFilter() {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    return LOYALTY_FILTERS.some(item => item.id === stored) ? stored : 'all';
  } catch {
    return 'all';
  }
}

function persistFilter(filter) {
  try { localStorage.setItem(FILTER_STORAGE_KEY, filter); } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(fn, ms = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

function formatPoints(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getMemberById(id) {
  return fidelidadeState.members.find(c => String(c.id) === String(id)) || null;
}

function getRewardById(id) {
  return fidelidadeState.rewards.find(r => String(r.id) === String(id)) || null;
}

function getInitials(name) {
  return String(name || 'C').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || 'C';
}

const clientThemes = [
  { gradient: 'linear-gradient(135deg,#ffd700,#ff8c00)', color: '#000' },
  { gradient: 'linear-gradient(135deg,#6b6880,#3a3a4a)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#9c6fff,#5530dd)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#00e676,#00b248)', color: '#001b0b' },
];

function getClientTheme(index) {
  return clientThemes[index % clientThemes.length];
}

function getToneMeta(tone) {
  const map = {
    success: { className: 'loyalty-chip--success', icon: '✓' },
    info: { className: 'loyalty-chip--info', icon: 'i' },
    warning: { className: 'loyalty-chip--warning', icon: '!' },
    danger: { className: 'loyalty-chip--danger', icon: '!' },
    purple: { className: 'loyalty-chip--purple', icon: '✦' },
    gold: { className: 'loyalty-chip--gold', icon: '★' },
    neutral: { className: 'loyalty-chip--neutral', icon: '•' },
  };
  return map[tone] || map.neutral;
}

function renderChip(label, className = 'loyalty-chip--neutral', icon = '') {
  return `<span class="loyalty-chip ${escapeHtml(className)}">${escapeHtml(icon)} ${escapeHtml(label)}</span>`;
}

function renderAlertChip(alert) {
  if (!alert) return '';
  const meta = getToneMeta(alert.tone);
  return renderChip(alert.title, meta.className, meta.icon);
}

function getFilterMetric(filterId) {
  const d = fidelidadeState.dashboard || {};
  const map = {
    all: d.total_clients || 0,
    with_points: d.members || 0,
    ready_to_redeem: d.ready_to_redeem || 0,
    near_reward: d.near_reward || 0,
    inactive_points: d.inactive_with_points || 0,
    vip: fidelidadeState.members.filter(member => member.is_vip === true || Number(member.total_spent || 0) >= 500).length,
    plan_clients: fidelidadeState.members.filter(member => member.active_subscription).length,
    no_points: fidelidadeState.members.filter(member => Number(member.loyalty_points || 0) <= 0).length,
    attention: fidelidadeState.members.filter(member => member.needs_attention).length,
  };
  return map[filterId] ?? 0;
}

function getRewardIcon(reward) {
  if (reward?.icon) return reward.icon;
  if (reward?.reward_type === 'discount') return '🏷️';
  if (reward?.reward_type === 'cashback') return '💰';
  if (reward?.reward_type === 'service') return '✂️';
  return '🎁';
}

function getRewardLabel(reward) {
  if (!reward) return 'Sem próxima recompensa';
  return reward.name || reward.title || 'Recompensa';
}

function getTransactionLabel(action) {
  const map = {
    earn: 'Ganho',
    bonus: 'Bônus',
    redeem: 'Resgate',
    expire: 'Expiração',
  };
  return map[action] || action;
}

function getTransactionTone(action) {
  if (action === 'earn' || action === 'bonus') return 'success';
  if (action === 'redeem') return 'purple';
  if (action === 'expire') return 'warning';
  return 'neutral';
}

function buildProgressBar(value) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  return `<div class="loyalty-progress"><span style="width:${pct}%"></span></div>`;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderDashboard() {
  const d = fidelidadeState.dashboard || {
    members: 0,
    points_in_circulation: 0,
    active_rewards: 0,
    opportunities: 0,
    points_per_real: 1,
  };

  return `
    <div class="loyalty-cockpit">
      <div class="loyalty-metric loyalty-metric--hero">
        <div class="loyalty-metric-label">Pontos em circulação</div>
        <div class="loyalty-metric-value color-gold">${escapeHtml(formatPoints(d.points_in_circulation || 0))}</div>
        <div class="loyalty-metric-sub">${escapeHtml(formatPoints(d.members || 0))} membro(s) com pontos · ${escapeHtml(formatPoints(d.total_clients || 0))} cliente(s)</div>
      </div>
      <div class="loyalty-metric">
        <div class="loyalty-metric-label">Prontos para resgate</div>
        <div class="loyalty-metric-value color-success">${escapeHtml(formatPoints(d.ready_to_redeem || 0))}</div>
        <div class="loyalty-metric-sub">${escapeHtml(formatPoints(d.near_reward || 0))} quase ganhando</div>
      </div>
      <div class="loyalty-metric">
        <div class="loyalty-metric-label">Recompensas ativas</div>
        <div class="loyalty-metric-value color-purple">${escapeHtml(formatPoints(d.active_rewards || 0))}</div>
        <div class="loyalty-metric-sub">${escapeHtml(formatPoints(d.points_per_real || 0))} ponto(s) por R$ 1,00</div>
      </div>
      <div class="loyalty-metric">
        <div class="loyalty-metric-label">Oportunidades</div>
        <div class="loyalty-metric-value color-info">${escapeHtml(formatPoints(d.opportunities || 0))}</div>
        <div class="loyalty-metric-sub">${escapeHtml(formatPoints(d.inactive_with_points || 0))} sumido(s) com pontos</div>
      </div>
    </div>
  `;
}

function renderFilters() {
  return `
    <div class="loyalty-filters">
      ${LOYALTY_FILTERS.map(filter => `
        <button type="button" class="loyalty-filter ${fidelidadeState.activeFilter === filter.id ? 'is-active' : ''}" data-loyalty-filter="${escapeHtml(filter.id)}">
          <span>${escapeHtml(filter.label)}</span>
          <strong>${escapeHtml(formatPoints(getFilterMetric(filter.id)))}</strong>
          <small>${escapeHtml(filter.hint)}</small>
        </button>
      `).join('')}
    </div>
  `;
}

function renderMemberCard(member, index) {
  const theme = getClientTheme(index);
  const points = Number(member.loyalty_points || 0);
  const metrics = member.metrics || {};
  const nextReward = metrics.next_reward;
  const chips = [
    points > 0 ? renderChip(`${formatPoints(points)} pts`, 'loyalty-chip--gold', '★') : renderChip('Sem pontos', 'loyalty-chip--neutral', '•'),
    metrics.redeemable_count > 0 ? renderChip('Pode resgatar', 'loyalty-chip--success', '✓') : '',
    member.is_vip ? renderChip('VIP', 'loyalty-chip--purple', '✦') : '',
    member.active_subscription ? renderChip('Com plano', 'loyalty-chip--info', '✓') : '',
    member.primary_alert ? renderAlertChip(member.primary_alert) : '',
  ].filter(Boolean).join('');

  return `
    <button type="button" class="loyalty-member-card" data-client-id="${escapeHtml(member.id)}">
      <div class="loyalty-member-top">
        <div class="loyalty-avatar" style="background:${theme.gradient};color:${theme.color};">${escapeHtml(getInitials(member.name))}</div>
        <div class="loyalty-member-main">
          <strong>${escapeHtml(member.name)}</strong>
          <span>${escapeHtml(member.whatsapp || member.phone || member.email || 'Sem contato')}</span>
        </div>
        <div class="loyalty-member-points">${escapeHtml(formatPoints(points))}<small>pts</small></div>
      </div>

      <div class="loyalty-chip-row">${chips}</div>

      <div class="loyalty-card-grid">
        <span><small>Visitas</small><strong>${escapeHtml(formatPoints(metrics.total_visits || member.total_visits || 0))}</strong></span>
        <span><small>Gasto</small><strong>${escapeHtml(formatCurrency(member.total_spent || 0))}</strong></span>
        <span><small>Inativo</small><strong>${metrics.days_inactive === null || metrics.days_inactive === undefined ? '—' : `${escapeHtml(metrics.days_inactive)}d`}</strong></span>
        <span><small>Resgates</small><strong>${escapeHtml(formatPoints(metrics.redeemed_points || 0))}</strong></span>
      </div>

      <div class="loyalty-next-box">
        <div>
          <strong>${nextReward ? escapeHtml(getRewardLabel(nextReward)) : metrics.redeemable_count > 0 ? 'Recompensa disponível' : 'Configure recompensas'}</strong>
          <span>${nextReward ? `Faltam ${escapeHtml(formatPoints(metrics.points_to_next_reward || 0))} ponto(s)` : metrics.redeemable_count > 0 ? 'Cliente já pode resgatar benefício' : 'Sem próxima recompensa'}</span>
        </div>
        ${buildProgressBar(metrics.progress_to_next_reward_pct || 0)}
      </div>

      ${member.primary_alert ? `
        <div class="loyalty-alert loyalty-alert--${escapeHtml(member.primary_alert.tone)}">
          <strong>${escapeHtml(member.primary_alert.title)}</strong>
          <span>${escapeHtml(member.primary_alert.message)}</span>
        </div>
      ` : ''}
    </button>
  `;
}

function renderMembers() {
  if (fidelidadeState.isLoading) {
    return `<div class="loyalty-empty"><strong>Carregando clube...</strong><span>Buscando clientes, pontos, recompensas e oportunidades.</span></div>`;
  }

  if (!fidelidadeState.members.length) {
    return `<div class="loyalty-empty"><strong>Nenhum cliente neste filtro</strong><span>Troque o filtro ou processe atendimentos concluídos para gerar pontos.</span></div>`;
  }

  return `
    <div class="loyalty-list-head">
      <div>
        <strong>Clientes do clube</strong>
        <span>${escapeHtml(fidelidadeState.members.length)} cliente(s) encontrado(s)</span>
      </div>
    </div>
    <div class="loyalty-member-list">${fidelidadeState.members.map(renderMemberCard).join('')}</div>
  `;
}

function renderRewardCard(reward) {
  const points = Number(reward.points_required || reward.required_points || 0);
  const typeLabel = reward.reward_type || 'custom';

  return `
    <button type="button" class="loyalty-reward-card" data-reward-id="${escapeHtml(reward.id)}">
      <div class="loyalty-reward-icon">${escapeHtml(getRewardIcon(reward))}</div>
      <div class="loyalty-reward-main">
        <strong>${escapeHtml(reward.name || reward.title)}</strong>
        <span>${escapeHtml(reward.description || 'Sem descrição cadastrada.')}</span>
        <div class="loyalty-chip-row">
          ${renderChip(`${formatPoints(points)} pts`, 'loyalty-chip--gold', '★')}
          ${renderChip(typeLabel, 'loyalty-chip--info', '•')}
          ${reward.is_active !== false ? renderChip('Ativa', 'loyalty-chip--success', '✓') : renderChip('Inativa', 'loyalty-chip--neutral', '•')}
        </div>
      </div>
    </button>
  `;
}

function renderRewards() {
  if (!fidelidadeState.rewards.length) {
    return `<div class="loyalty-empty"><strong>Nenhuma recompensa</strong><span>Crie benefícios para transformar pontos em retorno.</span></div>`;
  }

  return `<div class="loyalty-reward-list">${fidelidadeState.rewards.map(renderRewardCard).join('')}</div>`;
}

function renderSidePanel() {
  const top = [...fidelidadeState.members].sort((a, b) => Number(b.loyalty_points || 0) - Number(a.loyalty_points || 0)).slice(0, 5);
  const opportunities = fidelidadeState.members.filter(member => member.primary_alert).slice(0, 5);

  return `
    <div class="loyalty-side-grid">
      <div class="loyalty-side-card loyalty-side-card--spotlight">
        <div class="loyalty-section-title">Clube que gera retorno</div>
        <div class="loyalty-flow"><span>Atendimento</span><b>→</b><span>Pontos</span><b>→</b><span>Recompensa</span><b>→</b><span>Retorno</span></div>
        <p>Fidelidade só vale quando traz o cliente de volta. Use pontos como gatilho para agenda, marketing e relacionamento.</p>
      </div>

      <div class="loyalty-side-card">
        <div class="loyalty-section-title">Configuração</div>
        ${renderProgramPanel()}
      </div>

      <div class="loyalty-side-card">
        <div class="loyalty-section-title">Ranking de pontos</div>
        <div class="loyalty-ranking">
          ${top.length ? top.map((member, index) => `
            <button type="button" class="loyalty-ranking-row" data-client-id="${escapeHtml(member.id)}">
              <div class="loyalty-ranking-index">${index + 1}</div>
              <div>
                <strong>${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(formatPoints(member.loyalty_points || 0))} pontos · ${escapeHtml(formatCurrency(member.total_spent || 0))}</span>
              </div>
            </button>
          `).join('') : '<div class="loyalty-empty">Sem clientes pontuados ainda.</div>'}
        </div>
      </div>

      <div class="loyalty-side-card">
        <div class="loyalty-section-title">Atenção do dono</div>
        <div class="loyalty-ranking">
          ${opportunities.length ? opportunities.map(member => `
            <button type="button" class="loyalty-attention-row" data-client-id="${escapeHtml(member.id)}">
              <strong>${escapeHtml(member.name)}</strong>
              <span>${escapeHtml(member.primary_alert?.title || 'Oportunidade')}</span>
            </button>
          `).join('') : '<div class="loyalty-empty">Nenhuma oportunidade crítica.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderProgramPanel() {
  const p = fidelidadeState.program || {};

  return `
    <form id="loyalty-program-form" class="loyalty-program-form">
      <div>
        <label>Nome do programa</label>
        <input class="modal-input" name="name" value="${escapeHtml(p.name || 'Clube de Fidelidade')}" />
      </div>
      <div class="loyalty-program-grid">
        <div>
          <label>Pontos por R$ 1</label>
          <input class="modal-input" name="points_per_real" type="number" min="0" step="0.1" value="${escapeHtml(p.points_per_real ?? 1)}" />
        </div>
        <div>
          <label>Visitas referência</label>
          <input class="modal-input" name="visits_for_free" type="number" min="1" step="1" value="${escapeHtml(p.visits_for_free ?? 10)}" />
        </div>
        <div>
          <label>Cashback %</label>
          <input class="modal-input" name="cashback_pct" type="number" min="0" step="0.1" value="${escapeHtml(p.cashback_pct ?? 0)}" />
        </div>
        <div>
          <label>Status</label>
          <select class="modal-input" name="is_active">
            <option value="true" ${p.is_active !== false ? 'selected' : ''}>Ativo</option>
            <option value="false" ${p.is_active === false ? 'selected' : ''}>Inativo</option>
          </select>
        </div>
      </div>
      <div id="loyalty-program-feedback" class="fidelidade-form-feedback"></div>
      <div class="loyalty-program-actions">
        <button type="button" class="loyalty-action-btn" id="loyalty-process-appointments">Processar atendimentos</button>
        <button type="submit" class="btn-save">Salvar programa</button>
      </div>
    </form>
  `;
}

// ─── Modal renders ────────────────────────────────────────────────────────────

function renderClientDetails(member) {
  const rewards = fidelidadeState.rewards || [];
  const redeemable = rewards.filter(r => Number(member.loyalty_points || 0) >= Number(r.points_required || 0) && r.is_active !== false);
  const transactions = Array.isArray(member.recent_transactions) ? member.recent_transactions : [];
  const appointments = Array.isArray(member.recent_appointments) ? member.recent_appointments : [];

  return `
    <div class="fidelidade-modal-body loyalty-detail">
      <div class="loyalty-detail-hero">
        <div class="loyalty-avatar loyalty-avatar--lg">${escapeHtml(getInitials(member.name))}</div>
        <div class="loyalty-detail-main">
          <div class="loyalty-section-title">Ficha de fidelidade</div>
          <h2>${escapeHtml(member.name)}</h2>
          <p>${escapeHtml(member.whatsapp || member.phone || member.email || 'Sem contato cadastrado')}</p>
          <div class="loyalty-chip-row">
            ${renderChip(`${formatPoints(member.loyalty_points || 0)} pontos`, 'loyalty-chip--gold', '★')}
            ${member.is_vip ? renderChip('VIP', 'loyalty-chip--purple', '✦') : ''}
            ${member.active_subscription ? renderChip('Com plano', 'loyalty-chip--info', '✓') : ''}
            ${member.primary_alert ? renderAlertChip(member.primary_alert) : ''}
          </div>
        </div>
      </div>

      <div class="loyalty-detail-grid">
        <div class="mini-card"><div class="mini-lbl">Pontos</div><div class="mini-val color-gold">${escapeHtml(formatPoints(member.loyalty_points || 0))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Ganhos</div><div class="mini-val color-success">${escapeHtml(formatPoints(member.metrics?.earned_points || 0))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Resgatados</div><div class="mini-val color-purple">${escapeHtml(formatPoints(member.metrics?.redeemed_points || 0))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Faltam</div><div class="mini-val color-info">${escapeHtml(formatPoints(member.metrics?.points_to_next_reward || 0))}</div></div>
      </div>

      <div class="loyalty-detail-columns">
        <section class="loyalty-panel">
          <div class="loyalty-section-title">Resgatar recompensa</div>
          <div class="loyalty-redeem-list">
            ${redeemable.length ? redeemable.map(reward => `
              <button type="button" class="loyalty-redeem-row" data-redeem-reward-id="${escapeHtml(reward.id)}" data-client-id="${escapeHtml(member.id)}">
                <div>
                  <strong>${escapeHtml(getRewardIcon(reward))} ${escapeHtml(reward.name)}</strong>
                  <span>${escapeHtml(formatPoints(reward.points_required || 0))} pontos</span>
                </div>
                ${renderChip('Resgatar', 'loyalty-chip--success', '✓')}
              </button>
            `).join('') : '<div class="loyalty-empty">Cliente ainda não possui pontos para resgate.</div>'}
          </div>
        </section>

        <section class="loyalty-panel">
          <div class="loyalty-section-title">Ajuste manual</div>
          <form id="loyalty-adjust-form" class="loyalty-adjust-form">
            <div class="loyalty-program-grid">
              <div>
                <label>Ação</label>
                <select class="modal-input" name="action">
                  <option value="bonus">Bônus</option>
                  <option value="earn">Ganho</option>
                  <option value="redeem">Resgate manual</option>
                  <option value="expire">Expiração</option>
                </select>
              </div>
              <div>
                <label>Pontos</label>
                <input class="modal-input" name="points" type="number" min="1" step="1" placeholder="Ex: 50" />
              </div>
            </div>
            <div>
              <label>Motivo</label>
              <input class="modal-input" name="description" placeholder="Ex: bônus de aniversário" />
            </div>
            <div id="loyalty-adjust-feedback" class="fidelidade-form-feedback"></div>
            <button type="submit" class="btn-save">Aplicar ajuste</button>
          </form>
        </section>
      </div>

      <div class="loyalty-detail-columns">
        <section class="loyalty-panel">
          <div class="loyalty-section-title">Histórico de pontos</div>
          <div class="loyalty-detail-list">
            ${transactions.length ? transactions.map(tx => {
              const tone = getToneMeta(getTransactionTone(tx.action));
              return `
                <div class="loyalty-detail-row">
                  <div>
                    <strong>${escapeHtml(getTransactionLabel(tx.action))}</strong>
                    <span>${escapeHtml(tx.description || '')} · ${escapeHtml(formatDateTime(tx.created_at))}</span>
                  </div>
                  ${renderChip(`${formatPoints(tx.points || 0)} pts`, tone.className, tone.icon)}
                </div>
              `;
            }).join('') : '<div class="loyalty-empty">Sem histórico de pontos.</div>'}
          </div>
        </section>

        <section class="loyalty-panel">
          <div class="loyalty-section-title">Atendimentos recentes</div>
          <div class="loyalty-detail-list">
            ${appointments.length ? appointments.map(app => `
              <div class="loyalty-detail-row">
                <div>
                  <strong>${escapeHtml(formatCurrency(app.final_price ?? app.price ?? 0))}</strong>
                  <span>${escapeHtml(formatDateTime(app.scheduled_at))} · ${escapeHtml(app.status || '')}</span>
                </div>
                ${renderChip(`${formatPoints(app.points_earned || 0)} pts`, 'loyalty-chip--gold', '★')}
              </div>
            `).join('') : '<div class="loyalty-empty">Sem atendimentos recentes.</div>'}
          </div>
        </section>
      </div>

      <div id="fidelidade-modal-feedback" class="fidelidade-form-feedback"></div>

      <div class="modal-buttons loyalty-modal-actions">
        <button type="button" class="btn-cancel" id="fidelidade-modal-close">Fechar</button>
      </div>
    </div>
  `;
}

function renderRewardDetails(reward) {
  return `
    <div class="fidelidade-modal-body">
      <div class="loyalty-detail-hero">
        <div class="loyalty-reward-icon loyalty-reward-icon--lg">${escapeHtml(getRewardIcon(reward))}</div>
        <div class="loyalty-detail-main">
          <div class="loyalty-section-title">Detalhes da recompensa</div>
          <h2>${escapeHtml(reward.name || reward.title)}</h2>
          <p>${escapeHtml(reward.description || 'Sem descrição cadastrada.')}</p>
          <div class="loyalty-chip-row">
            ${renderChip(`${formatPoints(reward.points_required || 0)} pontos`, 'loyalty-chip--gold', '★')}
            ${renderChip(reward.reward_type || 'custom', 'loyalty-chip--info', '•')}
            ${reward.is_active !== false ? renderChip('Ativa', 'loyalty-chip--success', '✓') : renderChip('Inativa', 'loyalty-chip--neutral', '•')}
          </div>
        </div>
      </div>

      <div id="fidelidade-modal-feedback" class="fidelidade-form-feedback"></div>

      <div class="modal-buttons loyalty-modal-actions">
        <button type="button" class="btn-cancel" id="fidelidade-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="fidelidade-edit-reward" data-reward-id="${escapeHtml(reward.id)}">Editar recompensa</button>
      </div>
    </div>
  `;
}

function renderRewardForm(mode, reward = null) {
  const isEdit = mode === 'editReward';
  const r = reward || {};
  return `
    <div class="fidelidade-modal-body">
      <div class="loyalty-detail-hero">
        <div class="loyalty-detail-main">
          <div class="loyalty-section-title">${isEdit ? 'Editar recompensa' : 'Nova recompensa'}</div>
          <h2>${isEdit ? 'Editar recompensa' : 'Criar recompensa'}</h2>
          <p>Configure o benefício que transforma pontos em retorno para a barbearia.</p>
        </div>
      </div>

      <form id="fidelidade-form" class="fidelidade-form">
        <div class="fidelidade-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" name="name" type="text" value="${escapeHtml(r.name || r.title || '')}" placeholder="Ex: Barba grátis" />
          </div>
          <div>
            <div class="color-section-label">Pontos necessários</div>
            <input class="modal-input" name="points_required" type="number" min="1" value="${escapeHtml(r.points_required || 100)}" />
          </div>
          <div>
            <div class="color-section-label">Tipo</div>
            <select class="modal-input" name="reward_type">
              <option value="custom" ${r.reward_type === 'custom' ? 'selected' : ''}>Personalizada</option>
              <option value="service" ${r.reward_type === 'service' ? 'selected' : ''}>Serviço</option>
              <option value="discount" ${r.reward_type === 'discount' ? 'selected' : ''}>Desconto</option>
              <option value="cashback" ${r.reward_type === 'cashback' ? 'selected' : ''}>Cashback</option>
            </select>
          </div>
          <div>
            <div class="color-section-label">Valor referência</div>
            <input class="modal-input" name="reward_value" type="number" min="0" step="0.01" value="${escapeHtml(r.reward_value ?? '')}" placeholder="Opcional" />
          </div>
          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="is_active">
              <option value="true" ${r.is_active !== false ? 'selected' : ''}>Ativa</option>
              <option value="false" ${r.is_active === false ? 'selected' : ''}>Inativa</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Descrição</div>
          <textarea class="modal-input fidelidade-textarea" name="description" placeholder="Explique a regra da recompensa">${escapeHtml(r.description || '')}</textarea>
        </div>

        <div id="fidelidade-form-feedback" class="fidelidade-form-feedback"></div>

        <div class="modal-buttons loyalty-modal-actions">
          <button type="button" class="btn-cancel" id="${isEdit ? 'fidelidade-form-back' : 'fidelidade-form-cancel'}">${isEdit ? 'Voltar' : 'Cancelar'}</button>
          <button type="submit" class="btn-save">${isEdit ? 'Salvar' : 'Criar recompensa'}</button>
        </div>
      </form>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openClientModal(id) {
  fidelidadeState.activeClientId = id;
  fidelidadeState.activeRewardId = null;
  fidelidadeState.modalMode = 'viewClient';
  renderFidelidadeModal();
}

function openRewardModal(id) {
  fidelidadeState.activeRewardId = id;
  fidelidadeState.activeClientId = null;
  fidelidadeState.modalMode = 'viewReward';
  renderFidelidadeModal();
}

function openCreateRewardModal() {
  fidelidadeState.activeRewardId = null;
  fidelidadeState.activeClientId = null;
  fidelidadeState.modalMode = 'createReward';
  renderFidelidadeModal();
}

function openEditRewardModal(id) {
  fidelidadeState.activeRewardId = id;
  fidelidadeState.activeClientId = null;
  fidelidadeState.modalMode = 'editReward';
  renderFidelidadeModal();
}

function closeFidelidadeModal() {
  const modal = document.getElementById('fidelidade-details-modal');
  const content = document.getElementById('fidelidade-details-content');
  if (!modal) return;

  fidelidadeState.modalMode = 'closed';
  fidelidadeState.activeClientId = null;
  fidelidadeState.activeRewardId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderFidelidadeModal() {
  const modal = document.getElementById('fidelidade-details-modal');
  const content = document.getElementById('fidelidade-details-content');
  if (!modal || !content) return;

  if (fidelidadeState.modalMode === 'closed') {
    closeFidelidadeModal();
    return;
  }

  const member = fidelidadeState.activeClientId ? getMemberById(fidelidadeState.activeClientId) : null;
  const reward = fidelidadeState.activeRewardId ? getRewardById(fidelidadeState.activeRewardId) : null;

  if (fidelidadeState.modalMode === 'viewClient') {
    if (!member) { closeFidelidadeModal(); return; }
    content.innerHTML = renderClientDetails(member);
  }

  if (fidelidadeState.modalMode === 'viewReward') {
    if (!reward) { closeFidelidadeModal(); return; }
    content.innerHTML = renderRewardDetails(reward);
  }

  if (fidelidadeState.modalMode === 'editReward') {
    if (!reward) { closeFidelidadeModal(); return; }
    content.innerHTML = renderRewardForm('editReward', reward);
  }

  if (fidelidadeState.modalMode === 'createReward') {
    content.innerHTML = renderRewardForm('createReward');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindFidelidadeModalEvents();
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadFidelidadeData() {
  fidelidadeState.isLoading = true;
  rerenderFidelidade();

  const query = new URLSearchParams();
  query.set('filter', fidelidadeState.activeFilter);
  if (fidelidadeState.searchTerm) query.set('q', fidelidadeState.searchTerm);

  try {
    const data = await apiFetch(`/api/loyalty/members?${query.toString()}`);
    fidelidadeState.program = data?.program || null;
    fidelidadeState.dashboard = data?.dashboard || null;
    fidelidadeState.rewards = Array.isArray(data?.rewards) ? data.rewards : [];
    fidelidadeState.members = Array.isArray(data?.items) ? data.items : [];
  } catch (error) {
    console.error('Erro ao carregar fidelidade:', error);
    fidelidadeState.program = null;
    fidelidadeState.dashboard = null;
    fidelidadeState.rewards = [];
    fidelidadeState.members = [];
  } finally {
    fidelidadeState.isLoading = false;
    rerenderFidelidade();
  }
}

async function handleSaveProgram(event) {
  event.preventDefault();
  const form = document.getElementById('loyalty-program-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  try {
    if (btn) btn.disabled = true;
    setFeedback('loyalty-program-feedback', 'Salvando programa...', 'neutral');

    await apiFetch('/api/loyalty/program', {
      method: 'PUT',
      body: JSON.stringify({
        name: String(formData.get('name') || 'Clube de Fidelidade'),
        points_per_real: Number(formData.get('points_per_real') || 1),
        visits_for_free: Number(formData.get('visits_for_free') || 10),
        cashback_pct: Number(formData.get('cashback_pct') || 0),
        is_active: String(formData.get('is_active')) === 'true',
      }),
    });

    setFeedback('loyalty-program-feedback', 'Programa salvo.', 'success');
    await loadFidelidadeData();
  } catch (error) {
    setFeedback('loyalty-program-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleProcessAppointments() {
  const ok = window.confirm('Processar pontos dos atendimentos concluídos ainda não pontuados?');
  if (!ok) return;

  const btn = document.getElementById('loyalty-process-appointments');

  try {
    if (btn) btn.disabled = true;
    setFeedback('loyalty-program-feedback', 'Processando atendimentos...', 'neutral');

    const result = await apiFetch('/api/loyalty/process-completed-appointments', {
      method: 'POST',
      body: JSON.stringify({ limit: 100 }),
    });

    setFeedback(
      'loyalty-program-feedback',
      `Processado: ${result?.processed || 0} atendimento(s), ${result?.total_points || 0} ponto(s).`,
      'success',
    );

    await loadFidelidadeData();
  } catch (error) {
    setFeedback('loyalty-program-feedback', error instanceof Error ? error.message : 'Erro ao processar.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function collectRewardPayload(form) {
  const formData = new FormData(form);
  return {
    name: String(formData.get('name') || '').trim(),
    points_required: Number(formData.get('points_required') || 0),
    reward_type: String(formData.get('reward_type') || 'custom'),
    reward_value: formData.get('reward_value') ? Number(formData.get('reward_value')) : null,
    description: String(formData.get('description') || '').trim() || null,
    is_active: String(formData.get('is_active')) === 'true',
  };
}

async function handleCreateReward(event) {
  event.preventDefault();
  const form = document.getElementById('fidelidade-form');
  const btn = form.querySelector('button[type="submit"]');
  const payload = collectRewardPayload(form);

  if (!payload.name) { setFeedback('fidelidade-form-feedback', 'Informe o nome da recompensa.', 'error'); return; }
  if (payload.points_required <= 0) { setFeedback('fidelidade-form-feedback', 'Informe os pontos necessários.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('fidelidade-form-feedback', 'Salvando...', 'neutral');

    await apiFetch('/api/loyalty/rewards', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    closeFidelidadeModal();
    await loadFidelidadeData();
  } catch (error) {
    setFeedback('fidelidade-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleEditReward(event) {
  event.preventDefault();
  const form = document.getElementById('fidelidade-form');
  const btn = form.querySelector('button[type="submit"]');
  const payload = collectRewardPayload(form);

  if (!payload.name) { setFeedback('fidelidade-form-feedback', 'Informe o nome da recompensa.', 'error'); return; }
  if (payload.points_required <= 0) { setFeedback('fidelidade-form-feedback', 'Informe os pontos necessários.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('fidelidade-form-feedback', 'Salvando...', 'neutral');

    await apiFetch(`/api/loyalty/rewards/${fidelidadeState.activeRewardId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    closeFidelidadeModal();
    await loadFidelidadeData();
  } catch (error) {
    setFeedback('fidelidade-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleAdjustPoints(event) {
  event.preventDefault();
  const member = getMemberById(fidelidadeState.activeClientId);
  const form = document.getElementById('loyalty-adjust-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  const points = Number(formData.get('points') || 0);
  if (points <= 0) {
    setFeedback('loyalty-adjust-feedback', 'Informe uma quantidade de pontos válida.', 'error');
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setFeedback('loyalty-adjust-feedback', 'Aplicando ajuste...', 'neutral');

    await apiFetch(`/api/loyalty/members/${member.id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({
        action: String(formData.get('action') || 'bonus'),
        points,
        description: String(formData.get('description') || 'Ajuste manual de fidelidade'),
      }),
    });

    setFeedback('loyalty-adjust-feedback', 'Ajuste aplicado.', 'success');
    closeFidelidadeModal();
    await loadFidelidadeData();
  } catch (error) {
    setFeedback('loyalty-adjust-feedback', error instanceof Error ? error.message : 'Erro ao ajustar pontos.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleRedeemReward(clientId, rewardId) {
  const reward = getRewardById(rewardId);
  const ok = window.confirm(`Confirmar resgate da recompensa "${reward?.name || 'selecionada'}"?`);
  if (!ok) return;

  try {
    setFeedback('fidelidade-modal-feedback', 'Registrando resgate...', 'neutral');

    await apiFetch(`/api/loyalty/members/${clientId}/redeem/${rewardId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    setFeedback('fidelidade-modal-feedback', 'Resgate registrado.', 'success');
    closeFidelidadeModal();
    await loadFidelidadeData();
  } catch (error) {
    setFeedback('fidelidade-modal-feedback', error instanceof Error ? error.message : 'Erro ao resgatar.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindFidelidadeModalEvents() {
  document.getElementById('fidelidade-modal-close')?.addEventListener('click', closeFidelidadeModal);
  document.getElementById('fidelidade-form-cancel')?.addEventListener('click', closeFidelidadeModal);

  document.getElementById('fidelidade-form-back')?.addEventListener('click', () => {
    if (fidelidadeState.activeRewardId) openRewardModal(fidelidadeState.activeRewardId);
  });

  document.getElementById('fidelidade-edit-reward')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.rewardId;
    if (id) openEditRewardModal(id);
  });

  document.getElementById('loyalty-adjust-form')?.addEventListener('submit', handleAdjustPoints);

  document.querySelectorAll('[data-redeem-reward-id]').forEach(btn => {
    btn.addEventListener('click', () => handleRedeemReward(btn.dataset.clientId, btn.dataset.redeemRewardId));
  });

  const form = document.getElementById('fidelidade-form');
  if (form) {
    if (fidelidadeState.modalMode === 'createReward') form.addEventListener('submit', handleCreateReward);
    if (fidelidadeState.modalMode === 'editReward') form.addEventListener('submit', handleEditReward);
  }
}

function bindDynamicEvents() {
  document.querySelectorAll('[data-client-id]').forEach(btn => {
    btn.addEventListener('click', () => openClientModal(btn.dataset.clientId));
  });

  document.querySelectorAll('[data-reward-id]').forEach(btn => {
    btn.addEventListener('click', () => openRewardModal(btn.dataset.rewardId));
  });

  document.querySelectorAll('[data-loyalty-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      fidelidadeState.activeFilter = btn.dataset.loyaltyFilter || 'all';
      persistFilter(fidelidadeState.activeFilter);
      loadFidelidadeData();
    });
  });

  document.getElementById('loyalty-program-form')?.addEventListener('submit', handleSaveProgram);
  document.getElementById('loyalty-process-appointments')?.addEventListener('click', handleProcessAppointments);
}

const debouncedLoad = debounce(() => loadFidelidadeData(), 350);

function bindStaticEvents() {
  document.getElementById('fidelidade-new-reward-button')?.addEventListener('click', openCreateRewardModal);

  document.getElementById('fidelidade-search-input')?.addEventListener('input', (event) => {
    fidelidadeState.searchTerm = event.target.value || '';
    debouncedLoad();
  });

  document.getElementById('fidelidade-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'fidelidade-details-modal') closeFidelidadeModal();
  });
}

function rerenderFidelidade() {
  const cockpit = document.getElementById('loyalty-cockpit-wrap');
  const filters = document.getElementById('loyalty-filters-wrap');
  const members = document.getElementById('loyalty-members-list');
  const rewards = document.getElementById('loyalty-rewards-list');
  const side = document.getElementById('loyalty-side-wrap');

  if (cockpit) cockpit.innerHTML = renderDashboard();
  if (filters) filters.innerHTML = renderFilters();
  if (members) members.innerHTML = renderMembers();
  if (rewards) rewards.innerHTML = renderRewards();
  if (side) side.innerHTML = renderSidePanel();

  bindDynamicEvents();
}

export function renderFidelidade() {
  return /* html */ `
<section class="page-shell page--fidelidade">
  <div class="loyalty-hero">
    <div>
      <div class="loyalty-section-title">Relacionamento e retorno</div>
      <h1>Clube de Fidelidade</h1>
      <p>Transforme atendimentos concluídos em pontos, recompensas, retorno de clientes e campanhas mais inteligentes.</p>
    </div>
    <button type="button" class="btn-primary-gradient" id="fidelidade-new-reward-button">+ Nova recompensa</button>
  </div>

  <div id="loyalty-cockpit-wrap">${renderDashboard()}</div>

  <div class="loyalty-toolbar">
    <div class="loyalty-search-wrap">
      <span>🔍</span>
      <input id="fidelidade-search-input" class="loyalty-search-input" type="text" placeholder="Buscar por cliente, telefone, WhatsApp, alerta ou status..." value="${escapeHtml(fidelidadeState.searchTerm)}" />
    </div>
  </div>

  <div id="loyalty-filters-wrap">${renderFilters()}</div>

  <div class="loyalty-layout">
    <main class="loyalty-main-grid">
      <section class="loyalty-panel">
        <div class="loyalty-panel-head">
          <div>
            <div class="loyalty-section-title">Clientes do clube</div>
            <h2>Membros e oportunidades</h2>
          </div>
        </div>
        <div id="loyalty-members-list">${renderMembers()}</div>
      </section>

      <section class="loyalty-panel">
        <div class="loyalty-panel-head">
          <div>
            <div class="loyalty-section-title">Benefícios</div>
            <h2>Recompensas</h2>
          </div>
        </div>
        <div id="loyalty-rewards-list">${renderRewards()}</div>
      </section>
    </main>

    <aside id="loyalty-side-wrap">${renderSidePanel()}</aside>
  </div>

  <div id="fidelidade-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal loyalty-modal">
      <div id="fidelidade-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initFidelidadePage() {
  bindStaticEvents();
  bindDynamicEvents();
  loadFidelidadeData();
}
