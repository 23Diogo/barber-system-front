const financeiroState = {
  summaryBase: {
    revenueBaseline: 18235,
    expensesBaseline: 2756,
    commissions: 4800,
    revenueTrend: '↑ 8% vs anterior',
    expensesTrend: '↑ 3%',
  },
  payables: [
    {
      id: 'aluguel',
      icon: '🏠',
      title: 'Aluguel',
      dateLabel: 'Vence amanhã · 14/04',
      amount: 1800,
      highlight: 'warning',
      notes: 'Pagamento mensal do ponto comercial.',
    },
    {
      id: 'energia-eletrica',
      icon: '⚡',
      title: 'Energia elétrica',
      dateLabel: 'Vence 20/04 · 7 dias',
      amount: 380,
      highlight: 'danger',
      notes: 'Conta de energia da unidade.',
    },
    {
      id: 'reposicao-estoque',
      icon: '📦',
      title: 'Reposição estoque',
      dateLabel: 'Vence 25/04',
      amount: 620,
      highlight: 'info',
      notes: 'Compra de insumos e produtos.',
    },
    {
      id: 'barberflow-pro',
      icon: '💻',
      title: 'BarberFlow Pro',
      dateLabel: 'Automático · 30/04',
      amount: 399,
      highlight: 'success',
      notes: 'Assinatura do sistema.',
    },
  ],
  transactions: [
    {
      id: 'corte-barba-rafael',
      icon: '💇',
      title: 'Corte + Barba — Rafael',
      dateLabel: 'Hoje · Pix',
      amount: 70,
      notes: 'Recebimento confirmado.',
    },
    {
      id: 'fade-medio-pedro',
      icon: '💇',
      title: 'Fade médio — Pedro',
      dateLabel: 'Hoje · Dinheiro',
      amount: 50,
      notes: 'Pagamento recebido em dinheiro.',
    },
    {
      id: 'compra-produtos',
      icon: '🧴',
      title: 'Compra de produtos',
      dateLabel: 'Ontem · Débito',
      amount: -245,
      notes: 'Reposição de pomadas e óleos.',
    },
    {
      id: 'barba-andre',
      icon: '💇',
      title: 'Barba — André',
      dateLabel: 'Ontem · Pix',
      amount: 45,
      notes: 'Recebimento confirmado.',
    },
  ],
  modalMode: 'closed', // closed | view | edit | create
  activeEntryId: null,
  activeSection: null, // payables | transactions
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const abs = Math.abs(Number(value || 0));
  if (abs >= 1000) {
    return `R$${(abs / 1000).toFixed(1)}k`;
  }
  return formatCurrency(abs);
}

function getPayablesTotal() {
  return financeiroState.payables.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getPositiveTransactionsTotal() {
  return financeiroState.transactions
    .filter((item) => Number(item.amount || 0) > 0)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function getNegativeTransactionsTotal() {
  return financeiroState.transactions
    .filter((item) => Number(item.amount || 0) < 0)
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
}

function getFinanceMetrics() {
  const revenue = financeiroState.summaryBase.revenueBaseline + getPositiveTransactionsTotal();
  const expenses = financeiroState.summaryBase.expensesBaseline + getPayablesTotal() + getNegativeTransactionsTotal();
  const commissions = financeiroState.summaryBase.commissions;
  const profit = revenue - expenses;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  return {
    revenue,
    expenses,
    profit,
    commissions,
    revenueTrend: financeiroState.summaryBase.revenueTrend,
    expensesTrend: financeiroState.summaryBase.expensesTrend,
    marginLabel: `Margem ${margin}%`,
    commissionsLabel: '3 barbeiros',
  };
}

function getPayableHighlightMeta(highlight) {
  const map = {
    warning: { color: '#f97316', border: '#f97316' },
    danger: { color: '#ff1744', border: '#ff1744' },
    info: { color: '#4fc3f7', border: '#4fc3f7' },
    success: { color: '#00e676', border: '#00e676' },
  };

  return map[highlight] || map.info;
}

function getTransactionMeta(amount) {
  if (Number(amount || 0) >= 0) {
    return { color: '#00e676', border: '#00e676', prefix: '+' };
  }

  return { color: '#ff1744', border: '#ff1744', prefix: '-' };
}

function getEntryById(section, entryId) {
  const source = section === 'payables' ? financeiroState.payables : financeiroState.transactions;
  return source.find((item) => item.id === entryId) || null;
}

function normalizeEntryId(title) {
  const base = String(title || 'novo-lancamento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'novo-lancamento';

  let candidate = base;
  let counter = 2;

  while (
    financeiroState.payables.some((item) => item.id === candidate) ||
    financeiroState.transactions.some((item) => item.id === candidate)
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function renderFinanceMetrics() {
  const metrics = getFinanceMetrics();

  return `
    <div class="grid-4 finance-metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Receita do mês</div>
        <div class="metric-value">${escapeHtml(formatCompactCurrency(metrics.revenue))}</div>
        <div class="metric-sub color-up">${escapeHtml(metrics.revenueTrend)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Despesas</div>
        <div class="metric-value" style="color:#ff1744">${escapeHtml(formatCompactCurrency(metrics.expenses))}</div>
        <div class="metric-sub color-dn">${escapeHtml(metrics.expensesTrend)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Lucro líquido</div>
        <div class="metric-value" style="color:#00e676">${escapeHtml(formatCompactCurrency(metrics.profit))}</div>
        <div class="metric-sub color-up">${escapeHtml(metrics.marginLabel)}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Comissões</div>
        <div class="metric-value">${escapeHtml(formatCompactCurrency(metrics.commissions))}</div>
        <div class="metric-sub color-nt">${escapeHtml(metrics.commissionsLabel)}</div>
      </div>
    </div>
  `;
}

function renderPayableRow(entry) {
  const meta = getPayableHighlightMeta(entry.highlight);

  return `
    <button
      type="button"
      class="finance-row-button"
      data-entry-id="${escapeHtml(entry.id)}"
      data-entry-section="payables"
      title="Ver detalhes de ${escapeHtml(entry.title)}"
    >
      <div class="fin-row" style="border-color:${meta.border}">
        <div class="fin-icon">${escapeHtml(entry.icon)}</div>
        <div class="fin-info">
          <div class="fin-title">${escapeHtml(entry.title)}</div>
          <div class="fin-date">${escapeHtml(entry.dateLabel)}</div>
        </div>
        <div class="fin-val" style="color:${meta.color}">${escapeHtml(formatCurrency(entry.amount))}</div>
      </div>
    </button>
  `;
}

function renderTransactionRow(entry) {
  const meta = getTransactionMeta(entry.amount);
  const amountLabel = `${meta.prefix}${formatCurrency(Math.abs(entry.amount))}`;

  return `
    <button
      type="button"
      class="finance-row-button"
      data-entry-id="${escapeHtml(entry.id)}"
      data-entry-section="transactions"
      title="Ver detalhes de ${escapeHtml(entry.title)}"
    >
      <div class="fin-row" style="border-color:${meta.border}">
        <div class="fin-icon">${escapeHtml(entry.icon)}</div>
        <div class="fin-info">
          <div class="fin-title">${escapeHtml(entry.title)}</div>
          <div class="fin-date">${escapeHtml(entry.dateLabel)}</div>
        </div>
        <div class="fin-val" style="color:${meta.color}">${escapeHtml(amountLabel)}</div>
      </div>
    </button>
  `;
}

function renderFinanceDetails(entry, section) {
  const isPayable = section === 'payables';
  const amountMeta = isPayable ? getPayableHighlightMeta(entry.highlight) : getTransactionMeta(entry.amount);
  const amountLabel = isPayable
    ? formatCurrency(entry.amount)
    : `${amountMeta.prefix}${formatCurrency(Math.abs(entry.amount))}`;

  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(entry.title)}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${escapeHtml(isPayable ? 'Conta a pagar' : 'Transação financeira')}
        </div>
      </div>

      <div class="finance-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Valor</div>
          <div class="mini-val" style="color:${amountMeta.color}">${escapeHtml(amountLabel)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Categoria</div>
          <div class="mini-val" style="font-size:15px;">${escapeHtml(isPayable ? 'Despesa planejada' : (entry.amount >= 0 ? 'Entrada' : 'Saída'))}</div>
        </div>
      </div>

      <div class="finance-modal-info">
        <div class="finance-modal-info-row">
          <strong>Data/descrição:</strong> ${escapeHtml(entry.dateLabel)}
        </div>
        <div class="finance-modal-info-row">
          <strong>Observações:</strong> ${escapeHtml(entry.notes || '—')}
        </div>
      </div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="finance-modal-close">Fechar</button>
        <button
          type="button"
          class="btn-save"
          id="finance-edit-button"
          data-entry-id="${escapeHtml(entry.id)}"
          data-entry-section="${escapeHtml(section)}"
        >
          Editar informações
        </button>
      </div>
    </div>
  `;
}

function renderFinanceForm(mode, section = 'payables', entry = null) {
  const isEdit = mode === 'edit';
  const safeEntry = entry || {
    title: '',
    icon: '💸',
    dateLabel: '',
    amount: 100,
    notes: '',
    highlight: 'info',
  };

  const transactionType = !entry ? 'income' : Number(entry.amount || 0) >= 0 ? 'income' : 'expense';

  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar lançamento' : 'Novo lançamento'}</div>
        <div class="modal-sub" style="margin-top:4px;">
          ${isEdit ? 'Atualize os dados do lançamento financeiro.' : 'Preencha os dados para adicionar um novo item financeiro.'}
        </div>
      </div>

      <form id="finance-form" class="finance-form">
        <div class="finance-form-grid">
          <div>
            <div class="color-section-label">Seção</div>
            <select class="modal-input" name="section">
              <option value="payables" ${section === 'payables' ? 'selected' : ''}>Contas a pagar</option>
              <option value="transactions" ${section === 'transactions' ? 'selected' : ''}>Transações</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Ícone</div>
            <input class="modal-input" name="icon" type="text" value="${escapeHtml(safeEntry.icon)}" placeholder="Ex.: 💇" />
          </div>

          <div>
            <div class="color-section-label">Título</div>
            <input class="modal-input" name="title" type="text" value="${escapeHtml(safeEntry.title)}" placeholder="Nome do lançamento" />
          </div>

          <div>
            <div class="color-section-label">Data / descrição</div>
            <input class="modal-input" name="dateLabel" type="text" value="${escapeHtml(safeEntry.dateLabel)}" placeholder="Ex.: Hoje · Pix" />
          </div>

          <div>
            <div class="color-section-label">Valor</div>
            <input class="modal-input" name="amount" type="number" min="1" step="1" value="${escapeHtml(Math.abs(safeEntry.amount || 0))}" />
          </div>

          <div>
            <div class="color-section-label">Tipo da transação</div>
            <select class="modal-input" name="transactionType">
              <option value="income" ${transactionType === 'income' ? 'selected' : ''}>Entrada</option>
              <option value="expense" ${transactionType === 'expense' ? 'selected' : ''}>Saída</option>
            </select>
          </div>

          <div>
            <div class="color-section-label">Destaque visual</div>
            <select class="modal-input" name="highlight">
              <option value="warning" ${safeEntry.highlight === 'warning' ? 'selected' : ''}>Laranja</option>
              <option value="danger" ${safeEntry.highlight === 'danger' ? 'selected' : ''}>Vermelho</option>
              <option value="info" ${safeEntry.highlight === 'info' ? 'selected' : ''}>Azul</option>
              <option value="success" ${safeEntry.highlight === 'success' ? 'selected' : ''}>Verde</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input finance-textarea" name="notes" placeholder="Observações do lançamento">${escapeHtml(safeEntry.notes || '')}</textarea>
        </div>

        <div id="finance-form-feedback" class="finance-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'finance-form-back' : 'finance-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">
            ${isEdit ? 'Salvar alterações' : 'Adicionar lançamento'}
          </button>
        </div>
      </form>
    </div>
  `;
}

function setFinanceFormFeedback(message, variant = 'neutral') {
  const el = document.getElementById('finance-form-feedback');
  if (!el) return;

  el.textContent = message || '';
  el.style.color =
    variant === 'error' ? '#ff8a8a' :
    variant === 'success' ? '#00e676' :
    '#5a6888';
}

function openFinanceModal(section, entryId) {
  financeiroState.activeSection = section;
  financeiroState.activeEntryId = entryId;
  financeiroState.modalMode = 'view';
  renderFinanceModal();
}

function openCreateFinanceModal(defaultSection = 'payables') {
  financeiroState.activeSection = defaultSection;
  financeiroState.activeEntryId = null;
  financeiroState.modalMode = 'create';
  renderFinanceModal();
}

function openEditFinanceModal(section, entryId) {
  financeiroState.activeSection = section;
  financeiroState.activeEntryId = entryId;
  financeiroState.modalMode = 'edit';
  renderFinanceModal();
}

function closeFinanceModal() {
  const modal = document.getElementById('finance-details-modal');
  const content = document.getElementById('finance-details-content');
  if (!modal) return;

  financeiroState.modalMode = 'closed';
  financeiroState.activeSection = null;
  financeiroState.activeEntryId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';

  if (content) content.innerHTML = '';
}

function collectFinanceFormData() {
  const form = document.getElementById('finance-form');
  const formData = new FormData(form);

  const section = String(formData.get('section') || 'payables');
  const amountAbs = Number(formData.get('amount') || 0);
  const transactionType = String(formData.get('transactionType') || 'income');

  return {
    section,
    entry: {
      title: String(formData.get('title') || '').trim(),
      icon: String(formData.get('icon') || '💸').trim() || '💸',
      dateLabel: String(formData.get('dateLabel') || '').trim(),
      amount: section === 'payables'
        ? amountAbs
        : transactionType === 'expense'
          ? -amountAbs
          : amountAbs,
      notes: String(formData.get('notes') || '').trim(),
      highlight: String(formData.get('highlight') || 'info').trim(),
    },
  };
}

function handleFinanceFormSubmit(event) {
  event.preventDefault();

  const { section, entry } = collectFinanceFormData();

  if (!entry.title) {
    setFinanceFormFeedback('Informe o título do lançamento.', 'error');
    return;
  }

  if (!entry.dateLabel) {
    setFinanceFormFeedback('Informe a data ou descrição do lançamento.', 'error');
    return;
  }

  if (Math.abs(Number(entry.amount || 0)) <= 0) {
    setFinanceFormFeedback('Informe um valor válido.', 'error');
    return;
  }

  if (financeiroState.modalMode === 'create') {
    const newEntry = {
      id: normalizeEntryId(entry.title),
      ...entry,
    };

    if (section === 'payables') {
      financeiroState.payables = [newEntry, ...financeiroState.payables];
    } else {
      financeiroState.transactions = [newEntry, ...financeiroState.transactions];
    }

    rerenderFinanceiro();
    openFinanceModal(section, newEntry.id);
    return;
  }

  if (financeiroState.modalMode === 'edit' && financeiroState.activeEntryId && financeiroState.activeSection) {
    const oldSection = financeiroState.activeSection;
    const oldId = financeiroState.activeEntryId;

    const currentEntry = getEntryById(oldSection, oldId);
    if (!currentEntry) return;

    const updatedEntry = {
      ...currentEntry,
      ...entry,
    };

    financeiroState.payables = financeiroState.payables.filter((item) => item.id !== oldId);
    financeiroState.transactions = financeiroState.transactions.filter((item) => item.id !== oldId);

    if (section === 'payables') {
      financeiroState.payables = [updatedEntry, ...financeiroState.payables];
    } else {
      financeiroState.transactions = [updatedEntry, ...financeiroState.transactions];
    }

    rerenderFinanceiro();
    openFinanceModal(section, updatedEntry.id);
  }
}

function renderFinanceModal() {
  const modal = document.getElementById('finance-details-modal');
  const content = document.getElementById('finance-details-content');
  if (!modal || !content) return;

  if (financeiroState.modalMode === 'closed') {
    modal.classList.remove('open');
    modal.style.display = 'none';
    content.innerHTML = '';
    return;
  }

  const entry = financeiroState.activeEntryId && financeiroState.activeSection
    ? getEntryById(financeiroState.activeSection, financeiroState.activeEntryId)
    : null;

  if ((financeiroState.modalMode === 'view' || financeiroState.modalMode === 'edit') && !entry) {
    closeFinanceModal();
    return;
  }

  if (financeiroState.modalMode === 'view') {
    content.innerHTML = renderFinanceDetails(entry, financeiroState.activeSection);
  }

  if (financeiroState.modalMode === 'edit') {
    content.innerHTML = renderFinanceForm('edit', financeiroState.activeSection, entry);
  }

  if (financeiroState.modalMode === 'create') {
    content.innerHTML = renderFinanceForm('create', financeiroState.activeSection || 'payables');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');

  bindFinanceModalEvents();
}

function bindFinanceRowsEvents() {
  document.querySelectorAll('.finance-row-button[data-entry-id]').forEach((button) => {
    button.addEventListener('click', () => {
      openFinanceModal(button.dataset.entrySection, button.dataset.entryId);
    });
  });
}

function bindFinanceModalEvents() {
  document.getElementById('finance-modal-close')?.addEventListener('click', closeFinanceModal);

  document.getElementById('finance-edit-button')?.addEventListener('click', () => {
    const button = document.getElementById('finance-edit-button');
    if (!button?.dataset.entryId || !button?.dataset.entrySection) return;
    openEditFinanceModal(button.dataset.entrySection, button.dataset.entryId);
  });

  document.getElementById('finance-form-back')?.addEventListener('click', () => {
    if (!financeiroState.activeSection || !financeiroState.activeEntryId) return;
    openFinanceModal(financeiroState.activeSection, financeiroState.activeEntryId);
  });

  document.getElementById('finance-form-cancel')?.addEventListener('click', closeFinanceModal);
  document.getElementById('finance-form')?.addEventListener('submit', handleFinanceFormSubmit);
}

function bindFinanceiroStaticEvents() {
  document.getElementById('finance-new-button')?.addEventListener('click', () => {
    openCreateFinanceModal('payables');
  });

  document.getElementById('finance-details-modal')?.addEventListener('click', (event) => {
    if (event.target?.id === 'finance-details-modal') {
      closeFinanceModal();
    }
  });
}

function rerenderFinanceiro() {
  const metrics = document.getElementById('finance-metrics');
  const payables = document.getElementById('finance-payables-list');
  const transactions = document.getElementById('finance-transactions-list');

  if (metrics) metrics.innerHTML = renderFinanceMetrics();

  if (payables) {
    payables.innerHTML = financeiroState.payables.map(renderPayableRow).join('');
  }

  if (transactions) {
    transactions.innerHTML = financeiroState.transactions.map(renderTransactionRow).join('');
  }

  bindFinanceRowsEvents();
}

export function renderFinanceiro() {
  return /* html */ `
<section class="page-shell page--financeiro">
  <div id="finance-metrics">
    ${renderFinanceMetrics()}
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Contas a Pagar</div>
        <button type="button" class="btn-primary-gradient" id="finance-new-button">+ Adicionar</button>
      </div>

      <div id="finance-payables-list">
        ${financeiroState.payables.map(renderPayableRow).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Últimas Transações</div>
      </div>

      <div id="finance-transactions-list">
        ${financeiroState.transactions.map(renderTransactionRow).join('')}
      </div>
    </div>
  </div>

  <div id="finance-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 620px);">
      <div id="finance-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initFinanceiroPage() {
  bindFinanceiroStaticEvents();
  bindFinanceRowsEvents();
}
