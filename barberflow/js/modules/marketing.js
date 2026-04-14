const marketingState = {
  campaigns: [
    {
      id: 'aniversariantes-abril',
      icon: '🎂',
      name: 'Aniversariantes de Abril',
      status: 'active',
      audience: '12 clientes',
      detail: '8 enviadas · Desconto 20%',
      channel: 'WhatsApp',
      offer: 'Desconto 20%',
      schedule: 'Em andamento',
      notes: 'Campanha focada em aniversariantes do mês.',
    },
    {
      id: 'reativacao-inativos-30d',
      icon: '👥',
      name: 'Reativação — inativos 30d',
      status: 'scheduled',
      audience: '12 clientes',
      detail: 'Amanhã 10:00',
      channel: 'WhatsApp',
      offer: 'Cupom retorno 15%',
      schedule: 'Amanhã 10:00',
      notes: 'Enviar para clientes sem visita há mais de 30 dias.',
    },
    {
      id: 'pos-atendimento-automatico',
      icon: '⭐',
      name: 'Pós-atendimento automático',
      status: 'automatic',
      audience: '94 enviadas',
      detail: 'após cada atendimento',
      channel: 'WhatsApp',
      offer: 'Pedido de avaliação',
      schedule: 'Automática',
      notes: 'Mensagem enviada após finalização do atendimento.',
    },
  ],
  inactiveClients: [
    {
      id: 'marcos-lima',
      initials: 'ML',
      avatarGradient: 'linear-gradient(135deg,#6b6880,#3a3a4a)',
      name: 'Marcos Lima',
      daysInactive: 62,
      lastVisit: '62 dias sem visita',
      phone: '(11) 96666-4444',
      lastService: 'Corte simples',
    },
    {
      id: 'felipe-oliveira',
      initials: 'FO',
      avatarGradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
      name: 'Felipe Oliveira',
      daysInactive: 45,
      lastVisit: '45 dias sem visita',
      phone: '(11) 95555-1111',
      lastService: 'Barba completa',
    },
  ],
  modalMode: 'closed', // closed | viewCampaign | editCampaign | createCampaign | viewInactive
  activeCampaignId: null,
  activeClientId: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeId(value) {
  const base = String(value || 'novo-item')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'novo-item';

  let candidate = base;
  let counter = 2;

  while (marketingState.campaigns.some((item) => item.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function getCampaignById(campaignId) {
  return marketingState.campaigns.find((item) => item.id === campaignId) || null;
}

function getInactiveClientById(clientId) {
  return marketingState.inactiveClients.find((item) => item.id === clientId) || null;
}

function getCampaignStatusMeta(status) {
  const map = {
    active: {
      label: '● Ativa',
      color: '#00e676',
      bg: 'rgba(0,230,118,.1)',
      border: '#00e676',
    },
    scheduled: {
      label: 'Agendada',
      color: '#4fc3f7',
      bg: 'rgba(79,195,247,.1)',
      border: '#4fc3f7',
    },
    automatic: {
      label: 'Automática',
      color: '#9c6fff',
      bg: 'rgba(156,111,255,.1)',
      border: '#9c6fff',
    },
    paused: {
      label: 'Pausada',
      color: '#f97316',
      bg: 'rgba(249,115,22,.1)',
      border: '#f97316',
    },
  };

  return map[status] || map.active;
}

function getInactiveBarMeta(daysInactive) {
  if (daysInactive >= 60) {
    return { color: '#ff1744', width: '100%' };
  }

  if (daysInactive >= 45) {
    return { color: '#f97316', width: '72%' };
  }

  return { color: '#4fc3f7', width: '48%' };
}

function renderCampaignRow(campaign) {
  const meta = getCampaignStatusMeta(campaign.status);

  return `
    <button
      type="button"
      class="marketing-row-button"
      data-campaign-id="${escapeHtml(campaign.id)}"
      title="Ver detalhes de ${escapeHtml(campaign.name)}"
    >
      <div class="camp-row" style="border-color:${meta.border}">
        <div class="camp-top">
          <div class="camp-name">${escapeHtml(campaign.icon)} ${escapeHtml(campaign.name)}</div>
          <div class="camp-status" style="background:${meta.bg};color:${meta.color}">
            ${meta.label}
          </div>
        </div>
        <div class="camp-detail">${escapeHtml(`${campaign.audience} · ${campaign.detail}`)}</div>
      </div>
    </button>
  `;
}

function renderInactiveClientRow(client) {
  const progress = getInactiveBarMeta(client.daysInactive);

  return `
    <button
      type="button"
      class="marketing-row-button"
      data-inactive-client-id="${escapeHtml(client.id)}"
      title="Ver detalhes de ${escapeHtml(client.name)}"
    >
      <div class="row-item marketing-inactive-row">
        <div class="row-avatar" style="background:${client.avatarGradient}">
          ${escapeHtml(client.initials)}
        </div>
        <div class="row-info">
          <div class="row-name">${escapeHtml(client.name)}</div>
          <div class="row-sub">${escapeHtml(client.lastVisit)}</div>
          <div class="row-prog">
            <div class="row-fill" style="width:${progress.width};background:${progress.color}"></div>
          </div>
        </div>
        <div class="marketing-inactive-days" style="color:${progress.color}">
          ${escapeHtml(`${client.daysInactive}d`)}
        </div>
      </div>
    </button>
  `;
}

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
          <div class="mini-val" style="font-size:15px;color:${meta.color}">
            ${escapeHtml(meta.label)}
          </div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Canal</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(campaign.channel)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Público</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(campaign.audience)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Oferta</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(campaign.offer)}</div>
        </div>
      </div>

      <div class="marketing-modal-info">
        <div class="marketing-modal-info-row">
          <strong>Agendamento:</strong> ${escapeHtml(campaign.schedule)}
        </div>
        <div class="marketing-modal-info-row">
          <strong>Resumo:</strong> ${escapeHtml(campaign.detail)}
        </div>
        <div class="marketing-modal-info-row">
          <strong>Observações:</strong> ${escapeHtml(campaign.notes || '—')}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="marketing-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="marketing-edit-button" data-campaign-id="${escapeHtml(campaign.id)}">
          Editar informações
        </button>
      </div>
    </div>
  `;
}

function renderInactiveClientDetails(client) {
  return `
    <div class="marketing-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(client.name)}</div>
        <div class="modal-sub" style="margin-top:4px;">Cliente inativo</div>
      </div>

      <div class="marketing-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Dias sem visita</div>
          <div class="mini-val" style="color:#ff1744">${escapeHtml(client.daysInactive)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">WhatsApp</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(client.phone)}</div>
        </div>
      </div>

      <div class="marketing-modal-info">
        <div class="marketing-modal-info-row">
          <strong>Última atividade:</strong> ${escapeHtml(client.lastVisit)}
        </div>
        <div class="marketing-modal-info-row">
          <strong>Último serviço:</strong> ${escapeHtml(client.lastService)}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="marketing-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="marketing-create-from-client" data-client-id="${escapeHtml(client.id)}">
          Criar campanha para cliente
        </button>
      </div>
    </div>
  `;
}

function renderCampaignForm(mode, campaign = null) {
  const isEdit = mode === 'editCampaign';
  const safeCampaign = campaign || {
    name: '',
    icon: '📣',
    status: 'scheduled',
    audience: '1 cliente',
    detail: '',
    channel: 'WhatsApp',
    offer: '',
    schedule: '',
    notes: '',
  };

  return `
    <div class="marketing-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar campanha' : 'Nova campanha'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados da campanha.' : 'Preencha as informações para criar uma campanha.'}
        </div>
      </div>

      <form id="marketing-form" class="marketing-form">
        <div class="marketing-form-grid">
          <div>
            <div class="color-section-label">Nome</div>
            <input class="modal-input" name="name" type="text" value="${escapeHtml(safeCampaign.name)}" placeholder="Nome da campanha" />
          </div>

          <div>
            <div class="color-section-label">Ícone</div>
            <input class="modal-input" name="icon" type="text" value="${escapeHtml(safeCampaign.icon)}" placeholder="Ex.: 🎂" />
          </div>

          <div>
            <div class="color-section-label">Status</div>
            <select class="modal-input" name="status">
              <option value="active" ${safeCampaign.status === 'active' ? 'selected' : ''}>Ativa</option>
              <option value="scheduled" ${safeCampaign.status === 'scheduled' ? 'selected' : ''}>Agendada</option>
              <option value="automatic" ${safeCampaign.status === 'automatic' ? 'selected' : ''}>Automática</option>
              <option value="paused" ${safeCampaign.status === 'paused' ? 'selected' : ''}>Pausada</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Canal</div>
            <input class="modal-input" name="channel" type="text" value="${escapeHtml(safeCampaign.channel)}" placeholder="Ex.: WhatsApp" />
          </div>

          <div>
            <div class="color-section-label">Público</div>
            <input class="modal-input" name="audience" type="text" value="${escapeHtml(safeCampaign.audience)}" placeholder="Ex.: 12 clientes" />
          </div>

          <div>
            <div class="color-section-label">Oferta</div>
            <input class="modal-input" name="offer" type="text" value="${escapeHtml(safeCampaign.offer)}" placeholder="Ex.: Desconto 20%" />
          </div>

          <div>
            <div class="color-section-label">Agendamento</div>
            <input class="modal-input" name="schedule" type="text" value="${escapeHtml(safeCampaign.schedule)}" placeholder="Ex.: Amanhã 10:00" />
          </div>

          <div>
            <div class="color-section-label">Resumo</div>
            <input class="modal-input" name="detail" type="text" value="${escapeHtml(safeCampaign.detail)}" placeholder="Ex.: 8 enviadas · desconto 20%" />
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input marketing-textarea" name="notes" placeholder="Observações da campanha">${escapeHtml(safeCampaign.notes || '')}</textarea>
        </div>

        <div id="marketing-form-feedback" class="marketing-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'marketing-form-back' : 'marketing-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Criar campanha'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function setMarketingFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('marketing-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function openCampaignModal(campaignId) {
  marketingState.activeCampaignId = campaignId;
  marketingState.activeClientId = null;
  marketingState.modalMode = 'viewCampaign';
  renderMarketingModal();
}

function openEditCampaignModal(campaignId) {
  marketingState.activeCampaignId = campaignId;
  marketingState.activeClientId = null;
  marketingState.modalMode = 'editCampaign';
  renderMarketingModal();
}

function openCreateCampaignModal(prefill = null) {
  marketingState.activeCampaignId = null;
  marketingState.activeClientId = null;
  marketingState.modalMode = 'createCampaign';
  renderMarketingModal(prefill);
}

function openInactiveClientModal(clientId) {
  marketingState.activeClientId = clientId;
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

function buildCampaignPrefillFromClient(client) {
  return {
    name: `Reativação — ${client.name}`,
    icon: '📣',
    status: 'scheduled',
    audience: '1 cliente',
    detail: `Contato individual · ${client.daysInactive} dias sem visita`,
    channel: 'WhatsApp',
    offer: 'Cupom retorno 15%',
    schedule: 'Hoje 18:00',
    notes: `Cliente inativo: ${client.name}. Último serviço: ${client.lastService}.`,
  };
}

function collectMarketingFormData() {
  const form = document.getElementById('marketing-form');
  const formData = new FormData(form);

  return {
    name: String(formData.get('name') || '').trim(),
    icon: String(formData.get('icon') || '📣').trim() || '📣',
    status: String(formData.get('status') || 'scheduled').trim(),
    audience: String(formData.get('audience') || '').trim(),
    detail: String(formData.get('detail') || '').trim(),
    channel: String(formData.get('channel') || '').trim(),
    offer: String(formData.get('offer') || '').trim(),
    schedule: String(formData.get('schedule') || '').trim(),
    notes: String(formData.get('notes') || '').trim(),
  };
}

function handleMarketingFormSubmit(event) {
  event.preventDefault();

  const data = collectMarketingFormData();

  if (!data.name) {
    setMarketingFormFeedback('Informe o nome da campanha.', 'error');
    return;
  }

  if (!data.audience) {
    setMarketingFormFeedback('Informe o público da campanha.', 'error');
    return;
  }

  if (marketingState.modalMode === 'createCampaign') {
    const newCampaign = {
      id: normalizeId(data.name),
      ...data,
    };

    marketingState.campaigns = [newCampaign, ...marketingState.campaigns];
    rerenderMarketing();
    openCampaignModal(newCampaign.id);
    return;
  }

  if (marketingState.modalMode === 'editCampaign' && marketingState.activeCampaignId) {
    marketingState.campaigns = marketingState.campaigns.map((item) => {
      if (item.id !== marketingState.activeCampaignId) return item;
      return { ...item, ...data };
    });

    rerenderMarketing();
    openCampaignModal(marketingState.activeCampaignId);
  }
}

function renderMarketingModal(prefill = null) {
  const modal = document.getElementById('marketing-details-modal');
  const content = document.getElementById('marketing-details-content');
  if (!modal || !content) return;

  if (marketingState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const campaign = marketingState.activeCampaignId ? getCampaignById(marketingState.activeCampaignId) : null;
  const client = marketingState.activeClientId ? getInactiveClientById(marketingState.activeClientId) : null;

  if (marketingState.modalMode === 'viewCampaign' && !campaign) {
    closeMarketingModal();
    return;
  }

  if (marketingState.modalMode === 'editCampaign' && !campaign) {
    closeMarketingModal();
    return;
  }

  if (marketingState.modalMode === 'viewInactive' && !client) {
    closeMarketingModal();
    return;
  }

  if (marketingState.modalMode === 'viewCampaign') {
    content.innerHTML = renderCampaignDetails(campaign);
  }

  if (marketingState.modalMode === 'editCampaign') {
    content.innerHTML = renderCampaignForm('editCampaign', campaign);
  }

  if (marketingState.modalMode === 'createCampaign') {
    content.innerHTML = renderCampaignForm('createCampaign', prefill);
  }

  if (marketingState.modalMode === 'viewInactive') {
    content.innerHTML = renderInactiveClientDetails(client);
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindMarketingModalEvents();
}

function bindMarketingCampaignEvents() {
  document.querySelectorAll('.marketing-row-button[data-campaign-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openCampaignModal(button.dataset.campaignId);
    });
  });
}

function bindMarketingInactiveEvents() {
  document.querySelectorAll('.marketing-row-button[data-inactive-client-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openInactiveClientModal(button.dataset.inactiveClientId);
    });
  });
}

function bindMarketingModalEvents() {
  document.getElementById('marketing-modal-close')?.addEventListener('click', closeMarketingModal);

  document.getElementById('marketing-edit-button')?.addEventListener('click', () => {
    const button = document.getElementById('marketing-edit-button');
    if (!button?.dataset.campaignId) return;
    openEditCampaignModal(button.dataset.campaignId);
  });

  document.getElementById('marketing-create-from-client')?.addEventListener('click', () => {
    const button = document.getElementById('marketing-create-from-client');
    if (!button?.dataset.clientId) return;

    const client = getInactiveClientById(button.dataset.clientId);
    if (!client) return;

    openCreateCampaignModal(buildCampaignPrefillFromClient(client));
  });

  document.getElementById('marketing-form-back')?.addEventListener('click', () => {
    if (!marketingState.activeCampaignId) return;
    openCampaignModal(marketingState.activeCampaignId);
  });

  document.getElementById('marketing-form-cancel')?.addEventListener('click', closeMarketingModal);
  document.getElementById('marketing-form')?.addEventListener('submit', handleMarketingFormSubmit);
}

function bindMarketingStaticEvents() {
  document.getElementById('marketing-new-button')?.addEventListener('click', () => {
    openCreateCampaignModal();
  });

  document.getElementById('marketing-send-button')?.addEventListener('click', () => {
    openCreateCampaignModal({
      name: 'Reativação — clientes inativos',
      icon: '📣',
      status: 'scheduled',
      audience: `${marketingState.inactiveClients.length} clientes`,
      detail: 'Disparo em massa para inativos',
      channel: 'WhatsApp',
      offer: 'Cupom retorno 10%',
      schedule: 'Hoje 19:00',
      notes: 'Campanha criada a partir da lista de clientes inativos.',
    });
  });

  document.getElementById('marketing-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'marketing-details-modal') {
      closeMarketingModal();
    }
  });
}

function rerenderMarketing() {
  const campaignsList = document.getElementById('marketing-campaigns-list');
  const inactiveList = document.getElementById('marketing-inactive-list');

  if (campaignsList) {
    campaignsList.innerHTML = marketingState.campaigns.map(renderCampaignRow).join('');
  }

  if (inactiveList) {
    inactiveList.innerHTML = marketingState.inactiveClients.map(renderInactiveClientRow).join('');
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
        <button type="button" class="card-action" id="marketing-new-button">+ Nova campanha</button>
      </div>

      <div id="marketing-campaigns-list">
        ${marketingState.campaigns.map(renderCampaignRow).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Clientes Inativos</div>
        <button type="button" class="card-action" id="marketing-send-button">Enviar campanha →</button>
      </div>

      <div id="marketing-inactive-list">
        ${marketingState.inactiveClients.map(renderInactiveClientRow).join('')}
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
  bindMarketingCampaignEvents();
  bindMarketingInactiveEvents();
}
