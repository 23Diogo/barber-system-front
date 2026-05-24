import { apiFetch } from '../services/api.js';

const state = {
  settings: null,
  rules: [],
  ledger: [],
  dashboard: null,
  loading: false,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function centsToCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
}

function moneyToCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function labelPaymentChannel(value) {
  const map = {
    online_checkout: 'Checkout online',
    barbershop_card_machine: 'Maquininha da barbearia',
    direct_pix: 'Pix direto',
    direct_transfer: 'Transferência direta',
    cash: 'Dinheiro',
    courtesy: 'Cortesia',
    pending: 'Pendente',
  };
  return map[value] || value || '—';
}

function labelPaymentMethod(value) {
  const map = {
    cash: 'Dinheiro',
    credit_card: 'Crédito',
    debit_card: 'Débito',
    pix: 'Pix',
    transfer: 'Transferência',
    other: 'Outro',
  };
  return map[value] || value || '—';
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#8ea0c2';
}

function renderHero() {
  const d = state.dashboard || {};
  return `
    <div class="repasse-hero">
      <div>
        <div class="repasse-eyebrow">Transparência financeira</div>
        <h1>Taxas e repasse</h1>
        <p>Mostre ao dono quanto entrou, quanto saiu em taxa, quanto é da plataforma e quanto fica líquido para a barbearia.</p>
      </div>
      <div class="repasse-hero-badge">Não segura dinheiro</div>
    </div>

    <div class="repasse-cockpit">
      <div class="repasse-card repasse-card--hero"><span>Bruto</span><strong>${centsToCurrency(d.grossAmountCents)}</strong><small>${escapeHtml(d.items || 0)} lançamento(s)</small></div>
      <div class="repasse-card"><span>Taxas pagamento</span><strong>${centsToCurrency(d.paymentFeeCents)}</strong><small>Gateway ou maquininha</small></div>
      <div class="repasse-card"><span>Taxa BBarberFlow</span><strong>${centsToCurrency(d.platformFeeCents)}</strong><small>Cobrança transparente</small></div>
      <div class="repasse-card"><span>Líquido barbearia</span><strong>${centsToCurrency(d.netAmountCents)}</strong><small>Estimado/confirmado</small></div>
    </div>
  `;
}

function renderSettings() {
  const s = state.settings || {};
  return `
    <section class="repasse-panel">
      <div class="repasse-panel-head">
        <div><h2>Configuração da plataforma</h2><p>Regras da cobrança BBarberFlow, sem caixa-preta.</p></div>
      </div>
      <form id="repasse-settings-form" class="repasse-form-grid">
        <label><span>Taxa por agenda concluída (R$)</span><input name="completed_appointment_fee" type="number" step="0.01" value="${Number(s.completed_appointment_fee_cents || 500) / 100}" /></label>
        <label><span>Cobrar agenda manual?</span><select name="manual_appointment_fee_enabled"><option value="true" ${s.manual_appointment_fee_enabled !== false ? 'selected' : ''}>Sim</option><option value="false" ${s.manual_appointment_fee_enabled === false ? 'selected' : ''}>Não</option></select></label>
        <label><span>Cobrar encaixe/balcão?</span><select name="walk_in_fee_enabled"><option value="true" ${s.walk_in_fee_enabled !== false ? 'selected' : ''}>Sim</option><option value="false" ${s.walk_in_fee_enabled === false ? 'selected' : ''}>Não</option></select></label>
        <label><span>Taxa plano (%)</span><input name="plan_fee_pct" type="number" step="0.01" value="${escapeHtml(s.plan_fee_pct || 5)}" /></label>
        <label><span>Mínimo plano (R$)</span><input name="plan_fee_min" type="number" step="0.01" value="${Number(s.plan_fee_min_cents || 250) / 100}" /></label>
        <label><span>Máximo plano (R$)</span><input name="plan_fee_max" type="number" step="0.01" value="${Number(s.plan_fee_max_cents || 1500) / 100}" /></label>
        <label><span>Split marketplace futuro?</span><select name="marketplace_split_enabled"><option value="false" ${s.marketplace_split_enabled !== true ? 'selected' : ''}>Não</option><option value="true" ${s.marketplace_split_enabled === true ? 'selected' : ''}>Sim, preparar</option></select></label>
        <div class="repasse-form-actions"><span id="repasse-settings-feedback"></span><button class="btn-primary-gradient" type="submit">Salvar configuração</button></div>
      </form>
    </section>
  `;
}

function renderRules() {
  return `
    <section class="repasse-panel">
      <div class="repasse-panel-head"><div><h2>Taxas de pagamento</h2><p>Configure Mercado Pago, maquininha própria, Pix direto e dinheiro.</p></div></div>
      <div class="repasse-rules-list">
        ${state.rules.map(rule => `
          <div class="repasse-rule-row">
            <div><strong>${escapeHtml(rule.provider_name)}</strong><span>${escapeHtml(labelPaymentChannel(rule.payment_channel))} · ${escapeHtml(labelPaymentMethod(rule.payment_method))} · ${escapeHtml(rule.installments)}x</span></div>
            <div><strong>${escapeHtml(rule.fee_pct)}%</strong><span>+ ${centsToCurrency(rule.fixed_fee_cents)} · ${escapeHtml(rule.settlement_days)} dia(s)</span></div>
          </div>
        `).join('') || '<div class="repasse-empty">Nenhuma regra cadastrada.</div>'}
      </div>

      <form id="repasse-rule-form" class="repasse-form-grid repasse-rule-form">
        <label><span>Fornecedor</span><input name="provider_name" placeholder="Ex: Mercado Pago, Ton, Stone" /></label>
        <label><span>Canal</span><select name="payment_channel"><option value="online_checkout">Checkout online</option><option value="barbershop_card_machine">Maquininha própria</option><option value="direct_pix">Pix direto</option><option value="cash">Dinheiro</option></select></label>
        <label><span>Forma</span><select name="payment_method"><option value="pix">Pix</option><option value="credit_card">Crédito</option><option value="debit_card">Débito</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>
        <label><span>Parcelas</span><input name="installments" type="number" min="1" value="1" /></label>
        <label><span>Taxa (%)</span><input name="fee_pct" type="number" step="0.01" value="0" /></label>
        <label><span>Taxa fixa (R$)</span><input name="fixed_fee" type="number" step="0.01" value="0" /></label>
        <label><span>Recebimento (dias)</span><input name="settlement_days" type="number" min="0" value="0" /></label>
        <div class="repasse-form-actions"><span id="repasse-rule-feedback"></span><button class="btn-primary-gradient" type="submit">Salvar taxa</button></div>
      </form>
    </section>
  `;
}

function renderSimulator() {
  return `
    <section class="repasse-panel">
      <div class="repasse-panel-head"><div><h2>Simulador de líquido</h2><p>Use para mostrar o cálculo antes de fechar atendimento, plano ou pacote.</p></div></div>
      <form id="repasse-simulator-form" class="repasse-form-grid">
        <label><span>Tipo</span><select name="sourceType"><option value="appointment">Agenda avulsa</option><option value="subscription_invoice">Plano</option><option value="package">Pacote</option></select></label>
        <label><span>Valor bruto (R$)</span><input name="gross" type="number" step="0.01" value="40" /></label>
        <label><span>Origem</span><select name="bookingOrigin"><option value="client_app">Cliente pelo app</option><option value="owner_manual">Dono lançou manual</option><option value="barbershop_whatsapp">WhatsApp barbearia</option><option value="barber_whatsapp">WhatsApp barbeiro</option><option value="walk_in">Encaixe balcão</option><option value="courtesy">Cortesia</option></select></label>
        <label><span>Canal pagamento</span><select name="paymentChannel"><option value="online_checkout">Checkout online</option><option value="barbershop_card_machine">Maquininha própria</option><option value="direct_pix">Pix direto</option><option value="cash">Dinheiro</option></select></label>
        <label><span>Forma</span><select name="paymentMethod"><option value="pix">Pix</option><option value="credit_card">Crédito</option><option value="debit_card">Débito</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option><option value="other">Outro</option></select></label>
        <label><span>Parcelas</span><input name="paymentInstallments" type="number" min="1" value="1" /></label>
        <div class="repasse-form-actions"><span id="repasse-simulator-feedback"></span><button class="btn-primary-gradient" type="submit">Simular</button></div>
      </form>
      <div id="repasse-simulator-result" class="repasse-simulator-result"></div>
    </section>
  `;
}

function renderLedger() {
  return `
    <section class="repasse-panel">
      <div class="repasse-panel-head"><div><h2>Extrato transparente</h2><p>Bruto, taxas e líquido por lançamento.</p></div></div>
      <div class="repasse-ledger-list">
        ${state.ledger.map(item => `
          <div class="repasse-ledger-row">
            <div><strong>${escapeHtml(item.description)}</strong><span>${escapeHtml(item.source_type)} · ${escapeHtml(labelPaymentChannel(item.payment_channel))} · ${escapeHtml(formatDate(item.created_at))}</span></div>
            <div><small>Bruto</small><strong>${centsToCurrency(item.gross_amount_cents)}</strong></div>
            <div><small>Pagamento</small><strong>${centsToCurrency(item.payment_fee_cents)}</strong></div>
            <div><small>BBarberFlow</small><strong>${centsToCurrency(item.platform_fee_cents)}</strong></div>
            <div><small>Líquido</small><strong>${centsToCurrency(item.net_amount_cents)}</strong></div>
          </div>
        `).join('') || '<div class="repasse-empty">Nenhum lançamento ainda.</div>'}
      </div>
    </section>
  `;
}

function rerender() {
  const root = document.getElementById('repasse-root');
  if (!root) return;
  root.innerHTML = `
    ${renderHero()}
    <div class="repasse-layout">
      <div>
        ${renderSettings()}
        ${renderRules()}
      </div>
      <div>
        ${renderSimulator()}
        ${renderLedger()}
      </div>
    </div>
  `;
  bindEvents();
}

async function loadData() {
  state.loading = true;
  rerender();
  try {
    const [settings, rules, ledger, dashboard] = await Promise.all([
      apiFetch('/api/transparent-billing/settings'),
      apiFetch('/api/transparent-billing/payment-rules'),
      apiFetch('/api/transparent-billing/ledger'),
      apiFetch('/api/transparent-billing/dashboard'),
    ]);
    state.settings = settings;
    state.rules = Array.isArray(rules) ? rules : [];
    state.ledger = Array.isArray(ledger) ? ledger : [];
    state.dashboard = dashboard || null;
  } catch (error) {
    console.error(error);
  } finally {
    state.loading = false;
    rerender();
  }
}

function bindEvents() {
  document.getElementById('repasse-settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    try {
      setFeedback('repasse-settings-feedback', 'Salvando...');
      await apiFetch('/api/transparent-billing/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          completed_appointment_fee_cents: moneyToCents(fd.get('completed_appointment_fee')),
          manual_appointment_fee_enabled: String(fd.get('manual_appointment_fee_enabled')) === 'true',
          walk_in_fee_enabled: String(fd.get('walk_in_fee_enabled')) === 'true',
          plan_fee_pct: Number(fd.get('plan_fee_pct') || 0),
          plan_fee_min_cents: moneyToCents(fd.get('plan_fee_min')),
          plan_fee_max_cents: moneyToCents(fd.get('plan_fee_max')),
          marketplace_split_enabled: String(fd.get('marketplace_split_enabled')) === 'true',
        }),
      });
      setFeedback('repasse-settings-feedback', 'Salvo.', 'success');
      await loadData();
    } catch (error) {
      setFeedback('repasse-settings-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    }
  });

  document.getElementById('repasse-rule-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    try {
      setFeedback('repasse-rule-feedback', 'Salvando...');
      await apiFetch('/api/transparent-billing/payment-rules', {
        method: 'POST',
        body: JSON.stringify({
          provider_name: String(fd.get('provider_name') || 'Manual'),
          payment_channel: String(fd.get('payment_channel') || ''),
          payment_method: String(fd.get('payment_method') || ''),
          installments: Number(fd.get('installments') || 1),
          fee_pct: Number(fd.get('fee_pct') || 0),
          fixed_fee_cents: moneyToCents(fd.get('fixed_fee')),
          settlement_days: Number(fd.get('settlement_days') || 0),
        }),
      });
      setFeedback('repasse-rule-feedback', 'Taxa salva.', 'success');
      form.reset();
      await loadData();
    } catch (error) {
      setFeedback('repasse-rule-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    }
  });

  document.getElementById('repasse-simulator-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    const target = document.getElementById('repasse-simulator-result');
    try {
      setFeedback('repasse-simulator-feedback', 'Calculando...');
      const result = await apiFetch('/api/transparent-billing/simulate', {
        method: 'POST',
        body: JSON.stringify({
          sourceType: String(fd.get('sourceType') || 'appointment'),
          grossAmountCents: moneyToCents(fd.get('gross')),
          bookingOrigin: String(fd.get('bookingOrigin') || 'owner_manual'),
          paymentChannel: String(fd.get('paymentChannel') || 'direct_pix'),
          paymentMethod: String(fd.get('paymentMethod') || 'pix'),
          paymentInstallments: Number(fd.get('paymentInstallments') || 1),
          description: 'Simulação',
        }),
      });
      setFeedback('repasse-simulator-feedback', 'Simulado.', 'success');
      if (target) target.innerHTML = `
        <div><span>Bruto</span><strong>${centsToCurrency(result.gross_amount_cents)}</strong></div>
        <div><span>Taxa pagamento</span><strong>${centsToCurrency(result.payment_fee_cents)}</strong></div>
        <div><span>Taxa BBarberFlow</span><strong>${centsToCurrency(result.platform_fee_cents)}</strong></div>
        <div><span>Líquido barbearia</span><strong>${centsToCurrency(result.net_amount_cents)}</strong></div>
      `;
    } catch (error) {
      setFeedback('repasse-simulator-feedback', error instanceof Error ? error.message : 'Erro ao simular.', 'error');
    }
  });
}

export function renderRepasseTransparente() {
  return `<section class="page-shell page--repasse-transparente"><div id="repasse-root">${renderHero()}</div></section>`;
}

export function initRepasseTransparentePage() {
  loadData();
}
