import {
  apiFetch,
} from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const financeiroState = {
  bills: [],
  transactions: [],
  commissions: [],
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed',   // closed | viewBill | editBill | createBill | createTransaction
  activeEntryId: null,
  activeSection: null,   // bills | transactions
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

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const abs = Math.abs(Number(value || 0));
  if (abs >= 1000) return `R$${(abs / 1000).toFixed(1)}k`;
  return formatCurrency(abs);
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

// ─── Métricas ─────────────────────────────────────────────────────────────────

function getMetrics() {
  const revenue = financeiroState.transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const expenses = financeiroState.transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const commissions = financeiroState.commissions
    .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

  const profit = revenue - expenses - commissions;
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  return { revenue, expenses, profit, commissions, margin };
}

function renderMetrics() {
  const m = getMetrics();

  return `
    <div class="grid-4 finance-metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Receita do mês</div>
        <div class="metric-value">${escapeHtml(formatCompactCurrency(m.revenue))}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Despesas</div>
        <div class="metric-value" style="color:#ff1744">${escapeHtml(formatCompactCurrency(m.expenses))}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Lucro líquido</div>
        <div class="metric-value" style="color:#00e676">${escapeHtml(formatCompactCurrency(m.profit))}</div>
        <div class="metric-sub color-up">Margem ${escapeHtml(m.margin)}%</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Comissões</div>
        <div class="metric-value">${escapeHtml(formatCompactCurrency(m.commissions))}</div>
      </div>
    </div>
  `;
}

// ─── Bills ────────────────────────────────────────────────────────────────────

function getBillHighlight(bill) {
  if (bill.status === 'paid') return { color: '#00e676', border: '#00e676' };
  if (bill.status === 'cancelled') return { color: '#5a6888', border: '#5a6888' };

  const due = new Date(bill.due_date);
  const now = new Date();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { color: '#ff1744', border: '#ff1744' };
  if (diffDays <= 3) return { color: '#f97316', border: '#f97316' };
  return { color: '#4fc3f7', border: '#4fc3f7' };
}

function renderBillRow(bill) {
  const meta = getBillHighlight(bill);
  const duLabel = bill.due_date ? `Vence ${formatDate(bill.due_date)}` : '—';

  return `
    <button type="button" class="finance-row-button"
      data-entry-id="${escapeHtml(bill.id)}"
      data-entry-section="bills"
      title="Ver detalhes de ${escapeHtml(bill.description)}">
      <div class="fin-row" style="border-color:${meta.border}">
        <div class="fin-icon">💸</div>
        <div class="fin-info">
          <div class="fin-title">${escapeHtml(bill.description)}</div>
          <div class="fin-date">${escapeHtml(duLabel)}${bill.category ? ` · ${escapeHtml(bill.category)}` : ''}</div>
        </div>
        <div class="fin-val" style="color:${meta.color}">${escapeHtml(formatCurrency(bill.amount))}</div>
      </div>
    </button>
  `;
}

function renderBillsSection() {
  const pending = financeiroState.bills.filter(b => b.status !== 'cancelled');

  if (!pending.length) {
    return `<div class="finance-empty">Nenhuma conta a pagar cadastrada.</div>`;
  }

  return pending.map(renderBillRow).join('');
}

// ─── Transactions ─────────────────────────────────────────────────────────────

function renderTransactionRow(t) {
  const isIncome = t.type === 'income';
  const color = isIncome ? '#00e676' : '#ff1744';
  const prefix = isIncome ? '+' : '-';

  return `
    <button type="button" class="finance-row-button"
      data-entry-id="${escapeHtml(t.id)}"
      data-entry-section="transactions"
      title="Ver detalhes">
      <div class="fin-row" style="border-color:${color}">
        <div class="fin-icon">${isIncome ? '💇' : '🧴'}</div>
        <div class="fin-info">
          <div class="fin-title">${escapeHtml(t.description)}</div>
          <div class="fin-date">${escapeHtml(formatDate(t.transaction_date))}${t.payment_method ? ` · ${escapeHtml(t.payment_method)}` : ''}</div>
        </div>
        <div class="fin-val" style="color:${color}">${prefix}${escapeHtml(formatCurrency(t.amount))}</div>
      </div>
    </button>
  `;
}

function renderTransactionsSection() {
  const recent = [...financeiroState.transactions].slice(0, 20);

  if (!recent.length) {
    return `<div class="finance-empty">Nenhuma transação registrada.</div>`;
  }

  return recent.map(renderTransactionRow).join('');
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function renderBillDetails(bill) {
  const meta = getBillHighlight(bill);

  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${escapeHtml(bill.description)}</div>
        <div class="modal-sub" style="margin-top:4px;">Conta a pagar</div>
      </div>

      <div class="finance-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Valor</div>
          <div class="mini-val" style="color:${meta.color}">${escapeHtml(formatCurrency(bill.amount))}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Status</div>
          <div class="mini-val" style="font-size:15px;color:${meta.color}">${escapeHtml(bill.status || '—')}</div>
        </div>
      </div>

      <div class="finance-modal-info">
        <div class="finance-modal-info-row"><strong>Vencimento:</strong> ${escapeHtml(formatDate(bill.due_date))}</div>
        <div class="finance-modal-info-row"><strong>Categoria:</strong> ${escapeHtml(bill.category || '—')}</div>
        <div class="finance-modal-info-row"><strong>Fornecedor:</strong> ${escapeHtml(bill.supplier || '—')}</div>
        <div class="finance-modal-info-row"><strong>Observações:</strong> ${escapeHtml(bill.notes || '—')}</div>
      </div>

      <div id="finance-modal-feedback" class="finance-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="finance-modal-close">Fechar</button>
        ${bill.status !== 'paid' && bill.status !== 'cancelled' ? `
          <button type="button" class="btn-save" id="finance-pay-bill-btn" data-bill-id="${escapeHtml(bill.id)}">
            Marcar como paga
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderBillForm() {
  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">Nova conta a pagar</div>
        <div class="modal-sub" style="margin-top:4px;">Preencha os dados da conta.</div>
      </div>

      <form id="finance-bill-form" class="finance-form">
        <div class="finance-form-grid">
          <div>
            <div class="color-section-label">Descrição</div>
            <input class="modal-input" name="description" type="text" placeholder="Ex: Aluguel" />
          </div>
          <div>
            <div class="color-section-label">Categoria</div>
            <input class="modal-input" name="category" type="text" placeholder="Ex: Aluguel, Energia..." />
          </div>
          <div>
            <div class="color-section-label">Valor (R$)</div>
            <input class="modal-input" name="amount" type="number" min="0" step="0.01" placeholder="0,00" />
          </div>
          <div>
            <div class="color-section-label">Vencimento</div>
            <input class="modal-input" name="due_date" type="date" />
          </div>
          <div>
            <div class="color-section-label">Fornecedor</div>
            <input class="modal-input" name="supplier" type="text" placeholder="Nome do fornecedor" />
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input finance-textarea" name="notes" placeholder="Observações"></textarea>
        </div>

        <div id="finance-form-feedback" class="finance-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save">Salvar conta</button>
        </div>
      </form>
    </div>
  `;
}

function renderTransactionForm() {
  return `
    <div class="finance-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">Nova transação</div>
        <div class="modal-sub" style="margin-top:4px;">Registre uma entrada ou saída financeira.</div>
      </div>

      <form id="finance-transaction-form" class="finance-form">
        <div class="finance-form-grid">
          <div>
            <div class="color-section-label">Tipo</div>
            <select class="modal-input" name="type">
              <option value="income">Entrada</option>
              <option value="expense">Saída</option>
            </select>
          </div>
          <div>
            <div class="color-section-label">Descrição</div>
            <input class="modal-input" name="description" type="text" placeholder="Ex: Corte — Rafael" />
          </div>
          <div>
            <div class="color-section-label">Categoria</div>
            <input class="modal-input" name="category" type="text" placeholder="Ex: Serviço, Produto..." />
          </div>
          <div>
            <div class="color-section-label">Valor (R$)</div>
            <input class="modal-input" name="amount" type="number" min="0" step="0.01" placeholder="0,00" />
          </div>
          <div>
            <div class="color-section-label">Forma de pagamento</div>
            <select class="modal-input" name="payment_method">
              <option value="pix">Pix</option>
              <option value="cash">Dinheiro</option>
              <option value="credit_card">Cartão de crédito</option>
              <option value="debit_card">Cartão de débito</option>
            </select>
          </div>
          <div>
            <div class="color-section-label">Data</div>
            <input class="modal-input" name="transaction_date" type="date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
        </div>

        <div>
          <div class="color-section-label">Observações</div>
          <textarea class="modal-input finance-textarea" name="notes" placeholder="Observações"></textarea>
        </div>

        <div id="finance-form-feedback" class="finance-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="finance-form-cancel">Cancelar</button>
          <button type="submit" class="btn-save">Salvar transação</button>
        </div>
      </form>
    </div>
  `;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function openModal(mode, section = null, entryId = null) {
  financeiroState.modalMode = mode;
  financeiroState.activeSection = section;
  financeiroState.activeEntryId = entryId;
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

function renderFinanceModal() {
  const modal = document.getElementById('finance-details-modal');
  const content = document.getElementById('finance-details-content');
  if (!modal || !content) return;

  if (financeiroState.modalMode === 'closed') {
    modal.style.display = 'none';
    modal.classList.remove('open');
    content.innerHTML = '';
    return;
  }

  if (financeiroState.modalMode === 'viewBill') {
    const bill = financeiroState.bills.find(b => b.id === financeiroState.activeEntryId);
    if (!bill) { closeFinanceModal(); return; }
    content.innerHTML = renderBillDetails(bill);
  }

  if (financeiroState.modalMode === 'createBill') {
    content.innerHTML = renderBillForm();
  }

  if (financeiroState.modalMode === 'createTransaction') {
    content.innerHTML = renderTransactionForm();
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadFinanceiroData() {
  financeiroState.isLoading = true;
  rerenderFinanceiro();

  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [bills, transactions, commissions] = await Promise.all([
      apiFetch('/api/financial/bills'),
      apiFetch(`/api/financial/transactions?start=${start}&end=${end}`),
      apiFetch('/api/financial/commissions'),
    ]);

    financeiroState.bills = Array.isArray(bills) ? bills : [];
    financeiroState.transactions = Array.isArray(transactions) ? transactions : [];
    financeiroState.commissions = Array.isArray(commissions) ? commissions : [];
    financeiroState.isLoaded = true;
  } catch (error) {
    console.error('Erro ao carregar financeiro:', error);
  } finally {
    financeiroState.isLoading = false;
    rerenderFinanceiro();
  }
}

async function handleCreateBill(event) {
  event.preventDefault();
  const form = document.getElementById('finance-bill-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  const description = String(formData.get('description') || '').trim();
  const amount = Number(formData.get('amount') || 0);
  const due_date = String(formData.get('due_date') || '').trim();

  if (!description) { setFeedback('finance-form-feedback', 'Informe a descrição.', 'error'); return; }
  if (!amount || amount <= 0) { setFeedback('finance-form-feedback', 'Informe um valor válido.', 'error'); return; }
  if (!due_date) { setFeedback('finance-form-feedback', 'Informe o vencimento.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('finance-form-feedback', 'Salvando...', 'neutral');

    await apiFetch('/api/financial/bills', {
      method: 'POST',
      body: JSON.stringify({
        description,
        amount,
        due_date,
        category: String(formData.get('category') || '').trim() || null,
        supplier: String(formData.get('supplier') || '').trim() || null,
        notes: String(formData.get('notes') || '').trim() || null,
        status: 'pending',
      }),
    });

    closeFinanceModal();
    await loadFinanceiroData();
  } catch (error) {
    setFeedback('finance-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleCreateTransaction(event) {
  event.preventDefault();
  const form = document.getElementById('finance-transaction-form');
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');

  const description = String(formData.get('description') || '').trim();
  const amount = Number(formData.get('amount') || 0);
  const transaction_date = String(formData.get('transaction_date') || '').trim();

  if (!description) { setFeedback('finance-form-feedback', 'Informe a descrição.', 'error'); return; }
  if (!amount || amount <= 0) { setFeedback('finance-form-feedback', 'Informe um valor válido.', 'error'); return; }

  try {
    if (btn) btn.disabled = true;
    setFeedback('finance-form-feedback', 'Salvando...', 'neutral');

    await apiFetch('/api/financial/transactions', {
      method: 'POST',
      body: JSON.stringify({
        type: String(formData.get('type') || 'income'),
        description,
        amount,
        transaction_date: transaction_date || new Date().toISOString().split('T')[0],
        category: String(formData.get('category') || '').trim() || null,
        payment_method: String(formData.get('payment_method') || 'pix'),
        notes: String(formData.get('notes') || '').trim() || null,
      }),
    });

    closeFinanceModal();
    await loadFinanceiroData();
  } catch (error) {
    setFeedback('finance-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handlePayBill(billId) {
  try {
    setFeedback('finance-modal-feedback', 'Registrando pagamento...', 'neutral');
    await apiFetch(`/api/financial/bills/${billId}/pay`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentMethod: 'pix' }),
    });
    closeFinanceModal();
    await loadFinanceiroData();
  } catch (error) {
    setFeedback('finance-modal-feedback', error instanceof Error ? error.message : 'Erro ao pagar.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindModalEvents() {
  document.getElementById('finance-modal-close')?.addEventListener('click', closeFinanceModal);
  document.getElementById('finance-form-cancel')?.addEventListener('click', closeFinanceModal);

  document.getElementById('finance-pay-bill-btn')?.addEventListener('click', (e) => {
    const billId = e.currentTarget.dataset.billId;
    if (billId) handlePayBill(billId);
  });

  document.getElementById('finance-bill-form')?.addEventListener('submit', handleCreateBill);
  document.getElementById('finance-transaction-form')?.addEventListener('submit', handleCreateTransaction);
}

function bindRowEvents() {
  document.querySelectorAll('.finance-row-button[data-entry-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.entrySection;
      const id = btn.dataset.entryId;
      if (section === 'bills') openModal('viewBill', section, id);
    });
  });
}

function bindStaticEvents() {
  document.getElementById('finance-new-bill-btn')?.addEventListener('click', () => {
    openModal('createBill');
  });

  document.getElementById('finance-new-transaction-btn')?.addEventListener('click', () => {
    openModal('createTransaction');
  });

  document.getElementById('finance-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'finance-details-modal') closeFinanceModal();
  });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function rerenderFinanceiro() {
  const metrics = document.getElementById('finance-metrics');
  const bills = document.getElementById('finance-payables-list');
  const transactions = document.getElementById('finance-transactions-list');

  if (financeiroState.isLoading) {
    if (bills) bills.innerHTML = `<div class="finance-empty">Carregando...</div>`;
    if (transactions) transactions.innerHTML = `<div class="finance-empty">Carregando...</div>`;
    return;
  }

  if (metrics) metrics.innerHTML = renderMetrics();
  if (bills) bills.innerHTML = renderBillsSection();
  if (transactions) transactions.innerHTML = renderTransactionsSection();

  bindRowEvents();
}

export function renderFinanceiro() {
  return /* html */ `
<section class="page-shell page--financeiro">
  <div id="finance-metrics">
    ${renderMetrics()}
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Contas a Pagar</div>
        <button type="button" class="btn-primary-gradient" id="finance-new-bill-btn">+ Adicionar</button>
      </div>
      <div id="finance-payables-list">
        <div class="finance-empty">Carregando...</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Últimas Transações</div>
        <button type="button" class="btn-primary-gradient" id="finance-new-transaction-btn">+ Registrar</button>
      </div>
      <div id="finance-transactions-list">
        <div class="finance-empty">Carregando...</div>
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
  bindStaticEvents();
  loadFinanceiroData();
}
