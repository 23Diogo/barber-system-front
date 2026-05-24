import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const MARKETING_FILTER_STORAGE_KEY = 'barberflow.marketing.segment';

const marketingState = {
  dashboard: null,
  campaigns: [],
  templates: [],
  segments: [],
  audience: [],
  selectedSegment: getInitialSegment(),
  searchTerm: '',
  isLoading: false,
  modalMode: 'closed',
  activeCampaignId: null,
  preview: null,
};

function getInitialSegment() {
  try {
    return localStorage.getItem(MARKETING_FILTER_STORAGE_KEY) || 'inactive_30';
  } catch {
    return 'inactive_30';
  }
}

function persistSegment(segment) {
  try { localStorage.setItem(MARKETING_FILTER_STORAGE_KEY, segment); } catch {}
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

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

function debounce(fn, ms = 350) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function getCampaignById(id) {
  return marketingState.campaigns.find(c => String(c.id) === String(id)) || null;
}

function getSegmentByKey(key) {
  return marketingState.segments.find(s => String(s.key) === String(key)) || marketingState.segments[0] || null;
}

function getInitials(name) {
  return String(name || 'C').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || 'C';
}

function getToneMeta(tone) {
  const map = {
    success: { className: 'marketing-chip--success', icon: '✓' },
    info: { className: 'marketing-chip--info', icon: 'i' },
    warning: { className: 'marketing-chip--warning', icon: '!' },
    danger: { className: 'marketing-chip--danger', icon: '!' },
    purple: { className: 'marketing-chip--purple', icon: '✦' },
    gold: { className: 'marketing-chip--gold', icon: '★' },
    neutral: { className: 'marketing-chip--neutral', icon: '•' },
  };
  return map[tone] || map.neutral;
}

function getCampaignStatusMeta(status) {
  const map = {
    active:    { label: 'Ativa',      className: 'marketing-chip--success', icon: '●' },
    scheduled: { label: 'Agendada',   className: 'marketing-chip--info', icon: '⌚' },
    automatic: { label: 'Automática', className: 'marketing-chip--purple', icon: '✦' },
    completed: { label: 'Concluída',  className: 'marketing-chip--success', icon: '✓' },
    paused:    { label: 'Pausada',    className: 'marketing-chip--warning', icon: '⏸' },
    failed:    { label: 'Falhou',     className: 'marketing-chip--danger', icon: '!' },
    draft:     { label: 'Rascunho',   className: 'marketing-chip--neutral', icon: '•' },
  };
  return map[status] || map.draft;
}

function renderChip(label, className = 'marketing-chip--neutral', icon = '') {
  return `<span class="marketing-chip ${escapeHtml(className)}">${escapeHtml(icon)} ${escapeHtml(label)}</span>`;
}

function renderSegmentChip(segment) {
  const tone = getToneMeta(segment?.tone);
  return renderChip(segment?.label || 'Segmento', tone.className, tone.icon);
}

function getDefaultMessage(segmentKey) {
  const map = {
    inactive_30: 'Olá {{primeiro_nome}}, sentimos sua falta na {{barbearia}}! Já faz {{dias}} dias desde sua última visita. Agende seu próximo horário: {{link}}',
    inactive_60: 'Olá {{primeiro_nome}}, faz um tempinho que não te vemos na {{barbearia}}. Que tal voltar para renovar o visual? {{link}}',
    birthdays_month: 'Parabéns, {{primeiro_nome}}! 🎉 A {{barbearia}} deseja um novo ciclo incrível. Temos um convite especial para você: {{link}}',
    vip: 'Olá {{primeiro_nome}}, você está na nossa lista VIP da {{barbearia}}. Quer garantir seu próximo horário? {{link}}',
    active_plan: 'Olá {{primeiro_nome}}, seu plano na {{barbearia}} está ativo. Agende seu próximo uso: {{link}}',
    plan_attention: 'Olá {{primeiro_nome}}, seu plano na {{barbearia}} precisa de atenção. Acesse ou fale conosco para regularizar: {{link}}',
    pays_no_use: 'Olá {{primeiro_nome}}, seu plano está ativo e você ainda tem benefícios para usar na {{barbearia}}. Agende aqui: {{link}}',
    heavy_users: 'Olá {{primeiro_nome}}, vimos que você está aproveitando bem seu plano na {{barbearia}}. Garanta seu próximo horário: {{link}}',
    no_future_appointment: 'Olá {{primeiro_nome}}, você ainda não tem próximo horário marcado na {{barbearia}}. Escolha o melhor dia aqui: {{link}}',
    new_clients: 'Olá {{primeiro_nome}}, seja bem-vindo(a) à {{barbearia}}! Quando quiser, você pode agendar pelo link: {{link}}',
    good_campaign: 'Olá {{primeiro_nome}}, temos uma oportunidade especial para você voltar à {{barbearia}}. Agende aqui: {{link}}',
  };
  return map[segmentKey] || map.inactive_30;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderDashboard() {
  const d = marketingState.dashboard || {
    whatsapp: { connected: false },
    totals: { clients: 0, whatsapp_opt_in: 0, campaigns: 0, sent: 0, failed: 0, opportunities: 0 },
  };

  return `
    <div class="marketing-cockpit">
      <div class="marketing-metric marketing-metric--hero">
        <div class="marketing-metric-label">Oportunidades com WhatsApp</div>
        <div class="marketing-metric-value color-info">${escapeHtml(formatNumber(d.totals?.opportunities || 0))}</div>
        <div class="marketing-metric-sub">${escapeHtml(formatNumber(d.totals?.whatsapp_opt_in || 0))} cliente(s) elegíveis · ${escapeHtml(formatNumber(d.totals?.clients || 0))} no cadastro</div>
      </div>
      <div class="marketing-metric">
        <div class="marketing-metric-label">WhatsApp</div>
        <div class="marketing-metric-value ${d.whatsapp?.connected ? 'color-success' : 'color-danger'}">${d.whatsapp?.connected ? 'On' : 'Off'}</div>
        <div class="marketing-metric-sub">${escapeHtml(d.whatsapp?.phone || 'Conecte para disparar campanhas')}</div>
      </div>
      <div class="marketing-metric">
        <div class="marketing-metric-label">Campanhas</div>
        <div class="marketing-metric-value color-purple">${escapeHtml(formatNumber(d.totals?.campaigns || 0))}</div>
        <div class="marketing-metric-sub">${escapeHtml(formatNumber(d.totals?.sent || 0))} enviada(s) · ${escapeHtml(formatNumber(d.totals?.failed || 0))} falha(s)</div>
      </div>
      <div class="marketing-metric">
        <div class="marketing-metric-label">Segmento ativo</div>
        <div class="marketing-metric-value color-gold">${escapeHtml(formatNumber(getSegmentByKey(marketingState.selectedSegment)?.eligible_count || 0))}</div>
        <div class="marketing-metric-sub">${escapeHtml(getSegmentByKey(marketingState.selectedSegment)?.label || 'Selecione um segmento')}</div>
      </div>
    </div>
  `;
}

function renderSegments() {
  if (!marketingState.segments.length) {
    return `<div class="marketing-empty"><strong>Nenhum segmento carregado</strong><span>Os segmentos aparecem conforme clientes, agenda, planos e WhatsApp.</span></div>`;
  }

  return `
    <div class="marketing-segment-grid">
      ${marketingState.segments.map(segment => {
        const tone = getToneMeta(segment.tone);
        return `
          <button type="button" class="marketing-segment ${marketingState.selectedSegment === segment.key ? 'is-active' : ''}" data-marketing-segment="${escapeHtml(segment.key)}">
            <div class="marketing-segment-top">
              ${renderChip(segment.label, tone.className, tone.icon)}
              <strong>${escapeHtml(formatNumber(segment.eligible_count || 0))}</strong>
            </div>
            <span>${escapeHtml(segment.hint)}</span>
            <small>${escapeHtml(formatNumber(segment.count || 0))} cliente(s) no segmento</small>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderAudienceRow(client, index) {
  const gradient = [
    'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    'linear-gradient(135deg,#9c6fff,#5530dd)',
    'linear-gradient(135deg,#00e676,#00b248)',
    'linear-gradient(135deg,#ffd700,#ff8c00)',
    'linear-gradient(135deg,#6b6880,#3a3a4a)',
  ][index % 5];

  const chips = [
    client.days_inactive !== null && client.days_inactive !== undefined ? renderChip(`${client.days_inactive}d sem visita`, client.days_inactive >= 60 ? 'marketing-chip--danger' : 'marketing-chip--warning', '!') : '',
    client.is_vip ? renderChip('VIP', 'marketing-chip--purple', '★') : '',
    client.active_subscription ? renderChip(`Plano ${client.active_subscription.status}`, 'marketing-chip--success', '✓') : '',
    client.whatsapp_opt_in === false ? renderChip('Opt-out', 'marketing-chip--danger', '!') : '',
    client.future_appointments_count > 0 ? renderChip('Tem agenda', 'marketing-chip--info', '⌚') : '',
  ].filter(Boolean).join('');

  return `
    <div class="marketing-client-row">
      <div class="marketing-client-avatar" style="background:${gradient}">${escapeHtml(getInitials(client.name))}</div>
      <div class="marketing-client-main">
        <strong>${escapeHtml(client.name)}</strong>
        <span>${escapeHtml(client.whatsapp || client.phone || 'Sem WhatsApp')} · ${escapeHtml(client.last_service_name || 'Sem último serviço')}</span>
        <div class="marketing-client-chips">${chips}</div>
      </div>
      <div class="marketing-client-side">
        <strong>${escapeHtml(formatCurrency(client.total_spent || 0))}</strong>
        <span>${escapeHtml(formatNumber(client.total_visits || 0))} visita(s)</span>
      </div>
    </div>
  `;
}

function renderAudience() {
  if (marketingState.isLoading) {
    return `<div class="marketing-empty"><strong>Carregando público...</strong><span>Montando oportunidades por clientes, planos e agenda.</span></div>`;
  }

  if (!marketingState.audience.length) {
    return `<div class="marketing-empty"><strong>Nenhum cliente neste segmento</strong><span>Troque o segmento ou ajuste a busca.</span></div>`;
  }

  return `<div class="marketing-client-list">${marketingState.audience.map(renderAudienceRow).join('')}</div>`;
}

function renderCampaignRow(campaign) {
  const meta = getCampaignStatusMeta(campaign.status);
  const segment = getSegmentByKey(campaign.segment_key);
  const sent = Number(campaign.sent_count || 0);
  const failed = Number(campaign.failed_count || 0);

  return `
    <button type="button" class="marketing-campaign-card" data-campaign-id="${escapeHtml(campaign.id)}">
      <div class="marketing-campaign-top">
        <div>
          <strong>${escapeHtml(campaign.name)}</strong>
          <span>${escapeHtml(formatDate(campaign.created_at))}</span>
        </div>
        ${renderChip(meta.label, meta.className, meta.icon)}
      </div>
      <div class="marketing-campaign-message">${escapeHtml(campaign.message || 'Sem mensagem cadastrada.')}</div>
      <div class="marketing-campaign-footer">
        ${renderSegmentChip(segment || { label: campaign.segment_key || 'Segmento', tone: 'neutral' })}
        <span>${escapeHtml(formatNumber(campaign.audience_size || 0))} público · ${escapeHtml(sent)} enviadas · ${escapeHtml(failed)} falhas</span>
      </div>
    </button>
  `;
}

function renderCampaigns() {
  if (!marketingState.campaigns.length) {
    return `<div class="marketing-empty"><strong>Nenhuma campanha cadastrada</strong><span>Crie uma campanha a partir de um segmento inteligente.</span></div>`;
  }

  return `<div class="marketing-campaign-list">${marketingState.campaigns.map(renderCampaignRow).join('')}</div>`;
}

function renderTemplatesPanel() {
  const templates = Array.isArray(marketingState.templates) ? marketingState.templates : [];
  return `
    <div class="marketing-template-grid">
      ${templates.length ? templates.slice(0, 8).map(template => `
        <button type="button" class="marketing-template-card" data-template-content="${escapeHtml(template.content || '')}">
          <strong>${escapeHtml(template.name || template.key || 'Template')}</strong>
          <span>${escapeHtml(template.category || 'mensagem')}</span>
          <p>${escapeHtml(template.content || '')}</p>
        </button>
      `).join('') : '<div class="marketing-empty">Nenhum template encontrado.</div>'}
    </div>
  `;
}

function renderSidePanel() {
  return `
    <div class="marketing-side-grid">
      <div class="marketing-side-card marketing-side-card--spotlight">
        <div class="marketing-section-title">Crescimento com contexto</div>
        <div class="marketing-flow"><span>Cliente</span><b>→</b><span>Segmento</span><b>→</b><span>Mensagem</span><b>→</b><span>Agenda</span></div>
        <p>A campanha nasce dos dados reais: retorno, plano, agenda, VIP, aniversário e uso.</p>
      </div>

      <div class="marketing-side-card">
        <div class="marketing-section-title">Templates rápidos</div>
        ${renderTemplatesPanel()}
      </div>

      <div class="marketing-side-card">
        <div class="marketing-section-title">Variáveis aceitas</div>
        <div class="marketing-var-list">
          ${['{{nome}}', '{{primeiro_nome}}', '{{dias}}', '{{link}}', '{{barbearia}}', '{{ultimo_servico}}', '{{pontos}}'].map(v => `<span>${escapeHtml(v)}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function renderCampaignDetails(campaign) {
  const meta = getCampaignStatusMeta(campaign.status);
  const segment = getSegmentByKey(campaign.segment_key);
  const preview = campaign.preview_snapshot?.preview || marketingState.preview?.preview || [];

  return `
    <div class="marketing-modal-body">
      <div class="marketing-modal-hero">
        <div>
          <div class="marketing-section-title">Detalhes da campanha</div>
          <h2>${escapeHtml(campaign.name)}</h2>
          <p>${escapeHtml(campaign.message || 'Sem mensagem cadastrada.')}</p>
          <div class="marketing-chip-row">
            ${renderChip(meta.label, meta.className, meta.icon)}
            ${renderSegmentChip(segment || { label: campaign.segment_key || 'Segmento', tone: 'neutral' })}
          </div>
        </div>
      </div>

      <div class="marketing-modal-grid">
        <div class="mini-card"><div class="mini-lbl">Público</div><div class="mini-val color-info">${escapeHtml(formatNumber(campaign.audience_size || 0))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Enviadas</div><div class="mini-val color-success">${escapeHtml(formatNumber(campaign.sent_count || 0))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Falhas</div><div class="mini-val color-danger">${escapeHtml(formatNumber(campaign.failed_count || 0))}</div></div>
        <div class="mini-card"><div class="mini-lbl">Concluída</div><div class="mini-val" style="font-size:13px;">${escapeHtml(formatDate(campaign.completed_at))}</div></div>
      </div>

      <section class="marketing-panel">
        <div class="marketing-section-title">Prévia</div>
        <div id="marketing-preview-list">
          ${preview.length ? preview.map(item => `
            <div class="marketing-preview-bubble">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.whatsapp || '')}</span>
              <p>${escapeHtml(item.message)}</p>
            </div>
          `).join('') : '<div class="marketing-empty">Clique em pré-visualizar para ver as mensagens personalizadas.</div>'}
        </div>
      </section>

      <div id="marketing-modal-feedback" class="marketing-form-feedback"></div>

      <div class="modal-buttons marketing-modal-actions">
        <button type="button" class="btn-cancel" id="marketing-modal-close">Fechar</button>
        <button type="button" class="marketing-action-btn" id="marketing-preview-campaign-btn" data-campaign-id="${escapeHtml(campaign.id)}">Pré-visualizar</button>
        ${campaign.status !== 'completed' ? `
          <button type="button" class="btn-save" id="marketing-send-campaign-btn" data-campaign-id="${escapeHtml(campaign.id)}">Disparar WhatsApp</button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderCreateCampaignForm(prefill = null) {
  const p = prefill || {};
  const segmentKey = p.segment_key || marketingState.selectedSegment || 'inactive_30';
  const message = p.message || getDefaultMessage(segmentKey);
  const segment = getSegmentByKey(segmentKey);

  return `
    <div class="marketing-modal-body">
      <div class="marketing-modal-hero">
        <div>
          <div class="marketing-section-title">Nova campanha</div>
          <h2>Criar campanha</h2>
          <p>Escolha um segmento, ajuste a mensagem e confira a prévia antes de disparar.</p>
          <div class="marketing-chip-row">${segment ? renderSegmentChip(segment) : ''}</div>
        </div>
      </div>

      <form id="marketing-form" class="marketing-form">
        <div class="marketing-form-grid">
          <div>
            <div class="color-section-label">Nome da campanha</div>
            <input class="modal-input" name="name" type="text" value="${escapeHtml(p.name || '')}" placeholder="Ex: Reativação clientes sumidos" />
          </div>
          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="status">
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendada</option>
              <option value="active">Ativa</option>
            </select>
          </div>
          <div>
            <div class="color-section-label">Segmento</div>
            <select class="modal-input" name="segment_key" id="marketing-form-segment">
              ${marketingState.segments.map(segment => `<option value="${escapeHtml(segment.key)}" ${segment.key === segmentKey ? 'selected' : ''}>${escapeHtml(segment.label)} · ${escapeHtml(segment.eligible_count || 0)} elegíveis</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="color-section-label">Template rápido</div>
            <select class="modal-input" id="marketing-template-select">
              <option value="">Selecionar template...</option>
              ${marketingState.templates.map(template => `<option value="${escapeHtml(template.content || '')}">${escapeHtml(template.name || template.key || 'Template')}</option>`).join('')}
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Mensagem</div>
          <textarea class="modal-input marketing-textarea" name="message" id="marketing-message-input" placeholder="Use {{primeiro_nome}}, {{dias}}, {{link}}...">${escapeHtml(message)}</textarea>
        </div>

        <section class="marketing-panel">
          <div class="marketing-section-title">Prévia personalizada</div>
          <div id="marketing-create-preview" class="marketing-preview-list">
            <div class="marketing-empty">Clique em pré-visualizar para testar as variáveis.</div>
          </div>
        </section>

        <div id="marketing-form-feedback" class="marketing-form-feedback"></div>

        <div class="modal-buttons marketing-modal-actions">
          <button type="button" class="btn-cancel" id="marketing-form-cancel">Cancelar</button>
          <button type="button" class="marketing-action-btn" id="marketing-create-preview-btn">Pré-visualizar</button>
          <button type="submit" class="btn-save">Criar campanha</button>
        </div>
      </form>
    </div>
  `;
}

function openCampaignModal(id) {
  marketingState.activeCampaignId = id;
  marketingState.modalMode = 'viewCampaign';
  marketingState.preview = null;
  renderMarketingModal();
}

function openCreateCampaignModal(prefill = null) {
  marketingState.activeCampaignId = null;
  marketingState.modalMode = 'createCampaign';
  marketingState.preview = null;
  renderMarketingModal(prefill);
}

function closeMarketingModal() {
  const modal = document.getElementById('marketing-details-modal');
  const content = document.getElementById('marketing-details-content');
  if (!modal) return;

  marketingState.modalMode = 'closed';
  marketingState.activeCampaignId = null;
  marketingState.preview = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderMarketingModal(prefill = null) {
  const modal = document.getElementById('marketing-details-modal');
  const content = document.getElementById('marketing-details-content');
  if (!modal || !content) return;

  if (marketingState.modalMode === 'closed') {
    closeMarketingModal();
    return;
  }

  if (marketingState.modalMode === 'viewCampaign') {
    const campaign = getCampaignById(marketingState.activeCampaignId);
    if (!campaign) { closeMarketingModal(); return; }
    content.innerHTML = renderCampaignDetails(campaign);
  }

  if (marketingState.modalMode === 'createCampaign') {
    content.innerHTML = renderCreateCampaignForm(prefill);
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindMarketingModalEvents();
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadMarketingData() {
  marketingState.isLoading = true;
  rerenderMarketing();

  try {
    const [dashboard, segmentsResp, campaigns, templates] = await Promise.all([
      apiFetch('/api/marketing/dashboard'),
      apiFetch('/api/marketing/segments'),
      apiFetch('/api/marketing/campaigns'),
      apiFetch('/api/marketing/templates'),
    ]);

    marketingState.dashboard = dashboard || null;
    marketingState.segments = Array.isArray(segmentsResp?.segments) ? segmentsResp.segments : [];
    marketingState.campaigns = Array.isArray(campaigns) ? campaigns : [];
    marketingState.templates = Array.isArray(templates) ? templates : [];

    if (!marketingState.segments.some(s => s.key === marketingState.selectedSegment) && marketingState.segments[0]) {
      marketingState.selectedSegment = marketingState.segments[0].key;
    }

    await loadAudience();
  } catch (error) {
    console.error('Erro ao carregar marketing:', error);
  } finally {
    marketingState.isLoading = false;
    rerenderMarketing();
  }
}

async function loadAudience() {
  const query = new URLSearchParams();
  query.set('segment', marketingState.selectedSegment);
  if (marketingState.searchTerm) query.set('q', marketingState.searchTerm);

  const data = await apiFetch(`/api/marketing/audience?${query.toString()}`);
  marketingState.audience = Array.isArray(data?.items) ? data.items : [];
}

async function reloadAudienceOnly() {
  try {
    marketingState.isLoading = true;
    rerenderMarketing();
    await loadAudience();
  } catch (error) {
    console.error('Erro ao carregar público:', error);
  } finally {
    marketingState.isLoading = false;
    rerenderMarketing();
  }
}

async function handleCreatePreview() {
  const form = document.getElementById('marketing-form');
  const formData = new FormData(form);
  const segmentKey = String(formData.get('segment_key') || marketingState.selectedSegment);
  const message = String(formData.get('message') || '').trim();

  if (!message) {
    setFeedback('marketing-form-feedback', 'Informe a mensagem para pré-visualizar.', 'error');
    return;
  }

  try {
    setFeedback('marketing-form-feedback', 'Gerando prévia...', 'neutral');
    const data = await apiFetch('/api/marketing/preview', {
      method: 'POST',
      body: JSON.stringify({ segment_key: segmentKey, message, limit: 5 }),
    });

    const container = document.getElementById('marketing-create-preview');
    if (container) {
      container.innerHTML = data?.preview?.length
        ? data.preview.map(item => `
          <div class="marketing-preview-bubble">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.whatsapp || '')}</span>
            <p>${escapeHtml(item.message)}</p>
          </div>
        `).join('')
        : '<div class="marketing-empty">Nenhum cliente elegível para prévia.</div>';
    }

    setFeedback('marketing-form-feedback', 'Prévia gerada.', 'success');
  } catch (error) {
    setFeedback('marketing-form-feedback', error instanceof Error ? error.message : 'Erro ao gerar prévia.', 'error');
  }
}

async function handleCampaignPreview(campaignId) {
  const campaign = getCampaignById(campaignId);
  if (!campaign) return;

  try {
    setFeedback('marketing-modal-feedback', 'Gerando prévia...', 'neutral');
    const data = await apiFetch(`/api/marketing/campaigns/${campaignId}/send`, {
      method: 'POST',
      body: JSON.stringify({ dryRun: true }),
    });

    marketingState.preview = data;
    renderMarketingModal();
    setFeedback('marketing-modal-feedback', 'Prévia gerada.', 'success');
  } catch (error) {
    setFeedback('marketing-modal-feedback', error instanceof Error ? error.message : 'Erro ao gerar prévia.', 'error');
  }
}

async function handleCreateCampaign(event) {
  event.preventDefault();

  const form = document.getElementById('marketing-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  const name = String(formData.get('name') || '').trim();
  const segmentKey = String(formData.get('segment_key') || marketingState.selectedSegment);
  const message = String(formData.get('message') || '').trim();

  if (!name) { setFeedback('marketing-form-feedback', 'Informe o nome da campanha.', 'error'); return; }
  if (!message) { setFeedback('marketing-form-feedback', 'Informe a mensagem.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('marketing-form-feedback', 'Criando campanha...', 'neutral');

    await apiFetch('/api/marketing/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name,
        status: String(formData.get('status') || 'draft'),
        segment_key: segmentKey,
        message,
      }),
    });

    closeMarketingModal();
    await loadMarketingData();
  } catch (error) {
    setFeedback('marketing-form-feedback', error instanceof Error ? error.message : 'Erro ao criar campanha.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleSendCampaign(campaignId) {
  const campaign = getCampaignById(campaignId);
  const ok = window.confirm(`Disparar campanha "${campaign?.name || ''}" para o público elegível?`);
  if (!ok) return;

  try {
    setFeedback('marketing-modal-feedback', 'Disparando WhatsApp...', 'neutral');

    const result = await apiFetch(`/api/marketing/campaigns/${campaignId}/send`, {
      method: 'POST',
      body: JSON.stringify({ dryRun: false }),
    });

    setFeedback('marketing-modal-feedback', `Concluído: ${result?.sent || 0} enviada(s), ${result?.failed || 0} falha(s).`, result?.failed ? 'neutral' : 'success');

    setTimeout(async () => {
      closeMarketingModal();
      await loadMarketingData();
    }, 1700);
  } catch (error) {
    setFeedback('marketing-modal-feedback', error instanceof Error ? error.message : 'Erro ao disparar campanha.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindMarketingModalEvents() {
  document.getElementById('marketing-modal-close')?.addEventListener('click', closeMarketingModal);
  document.getElementById('marketing-form-cancel')?.addEventListener('click', closeMarketingModal);

  document.getElementById('marketing-form')?.addEventListener('submit', handleCreateCampaign);
  document.getElementById('marketing-create-preview-btn')?.addEventListener('click', handleCreatePreview);

  document.getElementById('marketing-template-select')?.addEventListener('change', (event) => {
    const value = event.target.value;
    const input = document.getElementById('marketing-message-input');
    if (value && input) input.value = value;
  });

  document.getElementById('marketing-form-segment')?.addEventListener('change', (event) => {
    const input = document.getElementById('marketing-message-input');
    if (input && !input.dataset.userChanged) input.value = getDefaultMessage(event.target.value);
  });

  document.getElementById('marketing-message-input')?.addEventListener('input', (event) => {
    event.target.dataset.userChanged = 'true';
  });

  document.getElementById('marketing-preview-campaign-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.campaignId;
    if (id) handleCampaignPreview(id);
  });

  document.getElementById('marketing-send-campaign-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.campaignId;
    if (id) handleSendCampaign(id);
  });
}

function bindMarketingDynamicEvents() {
  document.querySelectorAll('[data-marketing-segment]').forEach(btn => {
    btn.addEventListener('click', async () => {
      marketingState.selectedSegment = btn.dataset.marketingSegment || 'inactive_30';
      persistSegment(marketingState.selectedSegment);
      await reloadAudienceOnly();
    });
  });

  document.querySelectorAll('[data-campaign-id]').forEach(btn => {
    btn.addEventListener('click', () => openCampaignModal(btn.dataset.campaignId));
  });

  document.querySelectorAll('[data-template-content]').forEach(btn => {
    btn.addEventListener('click', () => {
      openCreateCampaignModal({
        segment_key: marketingState.selectedSegment,
        name: `${getSegmentByKey(marketingState.selectedSegment)?.label || 'Campanha'} — ${new Date().toLocaleDateString('pt-BR')}`,
        message: btn.dataset.templateContent,
      });
    });
  });
}

const debouncedAudience = debounce(async () => {
  await reloadAudienceOnly();
}, 350);

function bindMarketingStaticEvents() {
  document.getElementById('marketing-new-button')?.addEventListener('click', () => {
    openCreateCampaignModal({
      segment_key: marketingState.selectedSegment,
      name: `${getSegmentByKey(marketingState.selectedSegment)?.label || 'Campanha'} — ${new Date().toLocaleDateString('pt-BR')}`,
      message: getDefaultMessage(marketingState.selectedSegment),
    });
  });

  document.getElementById('marketing-send-button')?.addEventListener('click', () => {
    openCreateCampaignModal({
      segment_key: marketingState.selectedSegment,
      name: `${getSegmentByKey(marketingState.selectedSegment)?.label || 'Campanha'} — ${new Date().toLocaleDateString('pt-BR')}`,
      message: getDefaultMessage(marketingState.selectedSegment),
    });
  });

  document.getElementById('marketing-search-input')?.addEventListener('input', (event) => {
    marketingState.searchTerm = event.target.value || '';
    debouncedAudience();
  });

  document.getElementById('marketing-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'marketing-details-modal') closeMarketingModal();
  });
}

function rerenderMarketing() {
  const cockpit = document.getElementById('marketing-cockpit-wrap');
  const segments = document.getElementById('marketing-segments-wrap');
  const audience = document.getElementById('marketing-audience-list');
  const campaigns = document.getElementById('marketing-campaigns-list');
  const side = document.getElementById('marketing-side-wrap');

  if (cockpit) cockpit.innerHTML = renderDashboard();
  if (segments) segments.innerHTML = renderSegments();
  if (audience) audience.innerHTML = renderAudience();
  if (campaigns) campaigns.innerHTML = renderCampaigns();
  if (side) side.innerHTML = renderSidePanel();

  bindMarketingDynamicEvents();
}

export function renderMarketing() {
  return /* html */ `
<section class="page-shell page--marketing">
  <div class="marketing-hero">
    <div>
      <div class="marketing-section-title">Marketing e relacionamento</div>
      <h1>Central de Crescimento</h1>
      <p>Transforme dados de cliente, agenda, planos e WhatsApp em campanhas claras, segmentadas e rastreáveis.</p>
    </div>
    <button type="button" class="btn-primary-gradient" id="marketing-new-button">+ Nova campanha</button>
  </div>

  <div id="marketing-cockpit-wrap">${renderDashboard()}</div>

  <div class="marketing-toolbar">
    <div class="marketing-search-wrap">
      <span>🔍</span>
      <input id="marketing-search-input" class="marketing-search-input" type="text" placeholder="Buscar público por nome, WhatsApp, último serviço ou status..." value="${escapeHtml(marketingState.searchTerm)}" />
    </div>
    <button type="button" class="marketing-action-btn marketing-action-btn--primary" id="marketing-send-button">Criar campanha do segmento</button>
  </div>

  <div id="marketing-segments-wrap">${renderSegments()}</div>

  <div class="marketing-layout">
    <main class="marketing-main-grid">
      <section class="marketing-panel">
        <div class="marketing-panel-head">
          <div>
            <div class="marketing-section-title">Público inteligente</div>
            <h2>${escapeHtml(getSegmentByKey(marketingState.selectedSegment)?.label || 'Segmento')}</h2>
          </div>
          ${renderSegmentChip(getSegmentByKey(marketingState.selectedSegment) || { label: 'Segmento', tone: 'neutral' })}
        </div>
        <div id="marketing-audience-list">${renderAudience()}</div>
      </section>

      <section class="marketing-panel">
        <div class="marketing-panel-head">
          <div>
            <div class="marketing-section-title">Histórico</div>
            <h2>Campanhas</h2>
          </div>
        </div>
        <div id="marketing-campaigns-list">${renderCampaigns()}</div>
      </section>
    </main>

    <aside id="marketing-side-wrap">${renderSidePanel()}</aside>
  </div>

  <div id="marketing-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal marketing-modal">
      <div id="marketing-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initMarketingPage() {
  bindMarketingStaticEvents();
  bindMarketingDynamicEvents();
  loadMarketingData();
}
