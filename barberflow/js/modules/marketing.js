import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const marketingState = {
  campaigns: [],
  inactiveClients: [],
  isLoading: false,
  modalMode: 'closed', // closed | viewCampaign | createCampaign | viewInactive
  activeCampaignId: null,
  activeClientId: null,
};

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
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function getCampaignById(id) {
  return marketingState.campaigns.find(c => c.id === id) || null;
}

function getInactiveClientById(id) {
  return marketingState.inactiveClients.find(c => c.id === id) || null;
}

function getCampaignStatusMeta(status) {
  const map = {
    active:    { label: '● Ativa',      color: '#00e676', bg: 'rgba(0,230,118,.1)',    border: '#00e676' },
    scheduled: { label: 'Agendada',     color: '#4fc3f7', bg: 'rgba(79,195,247,.1)',   border: '#4fc3f7' },
    automatic: { label: 'Automática',   color: '#9c6fff', bg: 'rgba(156,111,255,.1)',  border: '#9c6fff' },
    completed: { label: 'Concluída',    color: '#00e676', bg: 'rgba(0,230,118,.1)',    border: '#00e676' },
    paused:    { label: 'Pausada',      color: '#f97316', bg: 'rgba(249,115,22,.1)',   border: '#f97316' },
    draft:     { label: 'Rascunho',     color: '#5a6888', bg: 'rgba(90,104,136,.1)',   border: '#5a6888' },
  };
  return map[status] || map.draft;
}

function getInactiveBarMeta(days) {
  if (days >= 60) return { color: '#ff1744', width: '100%' };
  if (days >= 45) return { color: '#f97316', width: '72%' };
  return { color: '#4fc3f7', width: '48%' };
}

function getInitials(name) {
  return String(name || 'C').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || 'C';
}

const clientThemes = [
  'linear-gradient(135deg,#6b6880,#3a3a4a)',
  'linear-gradient(135deg,#3b82f6,#1d4ed8)',
  'linear-gradient(135deg,#9c6fff,#5530dd)',
  'linear-gradient(135deg,#00e676,#00b248)',
  'linear-gradient(135deg,#ffd700,#ff8c00)',
];

// ─── Render rows ──────────────────────────────────────────────────────────────

function renderCampaignRow(campaign) {
  const meta = getCampaignStatusMeta(campaign.status);
  const sentInfo = campaign.sent_count ? `${campaign.sent_count} enviadas` : 'Não enviada';
  const audience = campaign.audience_size ? `${campaign.audience_size} clientes` : sentInfo;

  return `
    <button type="button" class="marketing-row-button"
      data-campaign-id="${escapeHtml(campaign.id)}"
      title="Ver detalhes de ${escapeHtml(campaign.name)}">
      <div class="camp-row" style="border-color:${meta.border}">
        <div class="camp-top">
          <div class="camp-name">📣 ${escapeHtml(campaign.name)}</div>
          <div class="camp-status" style="background:${meta.bg};color:${meta.color}">${meta.label}</div>
        </div>
        <div class="camp-detail">${escapeHtml(audience)} · ${escapeHtml(formatDate(campaign.created_at))}</div>
      </div>
    </button>
  `;
}

function renderInactiveClientRow(client, index) {
  const days = Number(client.days_inactive || 0);
  const progress = getInactiveBarMeta(days);
  const gradient = clientThemes[index % clientThemes.length];
  const initials = getInitials(client.name);

  return `
    <button type="button" class="marketing-row-button"
      data-inactive-client-id="${escapeHtml(client.id)}"
      title="Ver detalhes de ${escapeHtml(client.name)}">
      <div class="row-item marketing-inactive-row">
        <div class="row-avatar" style="background:${gradient}">${escapeHtml(initials)}</div>
        <div class="row-info">
          <div class="row-name">${escapeHtml(client.name)}</div>
          <div class="row-sub">${escapeHtml(`${days} dias sem visita`)}</div>
          <div class="row-prog">
            <div class="row-fill" style="width:${progress.width};background:${progress.color}"></div>
          </div>
        </div>
        <div class="marketing-inactive-days" style="color:${progress.color}">${escapeHtml(`${days}d`)}</div>
      </div>
    </button>
  `;
}

// ─── Modal renders ────────────────────────────────────────────────────────────

function renderCampaignDetails(campaign) {
  const meta = getCampaignStatusMeta(campaign.status);

  return `
    <div class="marketing-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(campaign.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Detalhes da campanha</div>
      </div>

      <div class="marketing-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:14px;color:${meta.color}">${meta.label}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Enviadas</div>
          <div class="mini-val" style="color:#00e676">${escapeHtml(campaign.sent_count || 0)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Criada em</div>
          <div class="mini-val" style="font-size:13px;">${escapeHtml(formatDate(campaign.created_at))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Concluída em</div>
          <div class="mini-val" style="font-size:13px;">${escapeHtml(formatDate(campaign.completed_at))}</div>
        </div>
      </div>

      ${campaign.message ? `
        <div class="marketing-modal-info">
          <div class="marketing-modal-info-row"><strong>Mensagem:</strong> ${escapeHtml(campaign.message)}</div>
        </div>
      ` : ''}

      <div id="marketing-modal-feedback" class="marketing-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="marketing-modal-close">Fechar</button>
        ${campaign.status !== 'completed' ? `
          <button type="button" class="btn-save" id="marketing-send-campaign-btn"
            data-campaign-id="${escapeHtml(campaign.id)}"
            style="background:linear-gradient(135deg,#00e676,#00b248);">
            Disparar campanha
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderCreateCampaignForm(prefill = null) {
  const p = prefill || {};

  return `
    <div class="marketing-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">Nova campanha</div>
        <div class="modal-sub" style="margin-top:4px;">Preencha os dados para criar uma campanha.</div>
      </div>

      <form id="marketing-form" class="marketing-form">
        <div class="marketing-form-grid">
          <div>
            <div class="color-section-label">Nome da campanha</div>
            <input class="modal-input" name="name" type="text"
              value="${escapeHtml(p.name || '')}" placeholder="Ex: Reativação inativos 30d" />
          </div>
          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="status">
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendada</option>
              <option value="active">Ativa</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Mensagem</div>
          <textarea class="modal-input marketing-textarea" name="message"
            placeholder="Olá {{nome}}, sentimos sua falta! Volte e ganhe 15% de desconto.">${escapeHtml(p.message || '')}</textarea>
        </div>

        <div id="marketing-form-feedback" class="marketing-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="marketing-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save">Criar campanha</button>
        </div>
      </form>
    </div>
  `;
}

function renderInactiveClientDetails(client) {
  const days = Number(client.days_inactive || 0);

  return `
    <div class="marketing-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(client.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Cliente inativo</div>
      </div>

      <div class="marketing-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Dias sem visita</div>
          <div class="mini-val" style="color:#ff1744">${escapeHtml(days)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">WhatsApp</div>
          <div class="mini-val" style="font-size:13px;">${escapeHtml(client.whatsapp || '—')}</div>
        </div>
      </div>

      <div class="marketing-modal-info">
        ${client.last_service_name ? `<div class="marketing-modal-info-row"><strong>Último serviço:</strong> ${escapeHtml(client.last_service_name)}</div>` : ''}
        ${client.last_visit_at ? `<div class="marketing-modal-info-row"><strong>Última visita:</strong> ${escapeHtml(formatDate(client.last_visit_at))}</div>` : ''}
      </div>

      <div id="marketing-modal-feedback" class="marketing-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="marketing-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="marketing-create-from-client"
          data-client-name="${escapeHtml(client.name)}" data-client-days="${escapeHtml(days)}">
          Criar campanha para cliente
        </button>
      </div>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openCampaignModal(id) {
  marketingState.activeCampaignId = id;
  marketingState.activeClientId = null;
  marketingState.modalMode = 'viewCampaign';
  renderMarketingModal();
}

function openCreateCampaignModal(prefill = null) {
  marketingState.activeCampaignId = null;
  marketingState.activeClientId = null;
  marketingState.modalMode = 'createCampaign';
  renderMarketingModal(prefill);
}

function openInactiveClientModal(id) {
  marketingState.activeClientId = id;
  marketingState.activeCampaignId = null;
  marketingState.modalMode = 'viewInactive';
  renderMarketingModal();
}

function closeMarketingModal() {
  const modal = document.getElementById('marketing-details-modal');
  const content = document.getElementById('marketing-details-content');
  if (!modal) return;

  marketingState.modalMode = 'closed';
  marketingState.activeCampaignId = null;
  marketingState.activeClientId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderMarketingModal(prefill = null) {
  const modal = document.getElementById('marketing-details-modal');
  const content = document.getElementById('marketing-details-content');
  if (!modal || !content) return;

  if (marketingState.modalMode === 'closed') {
    modal.style.display = 'none';
    modal.classList.remove('open');
    content.innerHTML = '';
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

  if (marketingState.modalMode === 'viewInactive') {
    const client = getInactiveClientById(marketingState.activeClientId);
    if (!client) { closeMarketingModal(); return; }
    content.innerHTML = renderInactiveClientDetails(client);
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindMarketingModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadMarketingData() {
  marketingState.isLoading = true;
  rerenderMarketing();

  try {
    const [campaigns, inactiveClients] = await Promise.all([
      apiFetch('/api/marketing/campaigns'),
      apiFetch('/api/marketing/inactive-clients'),
    ]);

    marketingState.campaigns = Array.isArray(campaigns) ? campaigns : [];
    marketingState.inactiveClients = Array.isArray(inactiveClients) ? inactiveClients : [];
  } catch (error) {
    console.error('Erro ao carregar marketing:', error);
  } finally {
    marketingState.isLoading = false;
    rerenderMarketing();
  }
}

async function handleCreateCampaign(event) {
  event.preventDefault();
  const form = document.getElementById('marketing-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  const name = String(formData.get('name') || '').trim();
  if (!name) { setFeedback('marketing-form-feedback', 'Informe o nome da campanha.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('marketing-form-feedback', 'Criando campanha...', 'neutral');

    await apiFetch('/api/marketing/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name,
        status: String(formData.get('status') || 'draft'),
        message: String(formData.get('message') || '').trim() || null,
      }),
    });

    closeMarketingModal();
    await loadMarketingData();
  } catch (error) {
    setFeedback('marketing-form-feedback', error instanceof Error ? error.message : 'Erro ao criar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleSendCampaign(campaignId) {
  try {
    setFeedback('marketing-modal-feedback', 'Disparando campanha...', 'neutral');

    const result = await apiFetch(`/api/marketing/campaigns/${campaignId}/send`, {
      method: 'POST',
    });

    setFeedback('marketing-modal-feedback', `Campanha disparada com sucesso! ${result?.sent || 0} mensagens enviadas.`, 'success');

    setTimeout(async () => {
      closeMarketingModal();
      await loadMarketingData();
    }, 1500);
  } catch (error) {
    setFeedback('marketing-modal-feedback', error instanceof Error ? error.message : 'Erro ao disparar.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindMarketingModalEvents() {
  document.getElementById('marketing-modal-close')?.addEventListener('click', closeMarketingModal);
  document.getElementById('marketing-form-cancel')?.addEventListener('click', closeMarketingModal);

  document.getElementById('marketing-form')?.addEventListener('submit', handleCreateCampaign);

  document.getElementById('marketing-send-campaign-btn')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.campaignId;
    if (id) handleSendCampaign(id);
  });

  document.getElementById('marketing-create-from-client')?.addEventListener('click', (e) => {
    const name = e.currentTarget.dataset.clientName;
    const days = e.currentTarget.dataset.clientDays;
    openCreateCampaignModal({
      name: `Reativação — ${name}`,
      message: `Olá ${name}, sentimos sua falta! Faz ${days} dias que não te vemos. Volte e ganhe um desconto especial!`,
    });
  });
}

function bindMarketingCampaignEvents() {
  document.querySelectorAll('.marketing-row-button[data-campaign-id]').forEach(btn => {
    btn.addEventListener('click', () => openCampaignModal(btn.dataset.campaignId));
  });
}

function bindMarketingInactiveEvents() {
  document.querySelectorAll('.marketing-row-button[data-inactive-client-id]').forEach(btn => {
    btn.addEventListener('click', () => openInactiveClientModal(btn.dataset.inactiveClientId));
  });
}

function bindMarketingStaticEvents() {
  document.getElementById('marketing-new-button')?.addEventListener('click', () => openCreateCampaignModal());

  document.getElementById('marketing-send-button')?.addEventListener('click', () => {
    openCreateCampaignModal({
      name: 'Reativação — clientes inativos',
      message: 'Olá {{nome}}, sentimos sua falta! Volte e ganhe um desconto especial no seu próximo atendimento.',
    });
  });

  document.getElementById('marketing-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'marketing-details-modal') closeMarketingModal();
  });
}

function rerenderMarketing() {
  const campaignsList = document.getElementById('marketing-campaigns-list');
  const inactiveList = document.getElementById('marketing-inactive-list');

  if (marketingState.isLoading) {
    if (campaignsList) campaignsList.innerHTML = `<div class="finance-empty">Carregando campanhas...</div>`;
    if (inactiveList) inactiveList.innerHTML = `<div class="finance-empty">Carregando clientes inativos...</div>`;
    return;
  }

  if (campaignsList) {
    campaignsList.innerHTML = marketingState.campaigns.length
      ? marketingState.campaigns.map(renderCampaignRow).join('')
      : `<div class="finance-empty">Nenhuma campanha cadastrada.</div>`;
  }

  if (inactiveList) {
    inactiveList.innerHTML = marketingState.inactiveClients.length
      ? marketingState.inactiveClients.map((c, i) => renderInactiveClientRow(c, i)).join('')
      : `<div class="finance-empty">Nenhum cliente inativo encontrado.</div>`;
  }

  bindMarketingCampaignEvents();
  bindMarketingInactiveEvents();
}

export function renderMarketing() {
  return /* html */ `
<section class="page-shell page--marketing">
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Campanhas</div>
        <button type="button" class="btn-primary-gradient" id="marketing-new-button">+ Nova campanha</button>
      </div>
      <div id="marketing-campaigns-list">
        <div class="finance-empty">Carregando...</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Clientes Inativos</div>
        <button type="button" class="btn-primary-gradient" id="marketing-send-button">Enviar campanha →</button>
      </div>
      <div id="marketing-inactive-list">
        <div class="finance-empty">Carregando...</div>
      </div>
    </div>
  </div>

  <div id="marketing-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 620px);">
      <div id="marketing-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initMarketingPage() {
  bindMarketingStaticEvents();
  loadMarketingData();
}
