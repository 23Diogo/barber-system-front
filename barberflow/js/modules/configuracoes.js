import { state } from '../state.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderConfiguracoes() {
  const brandName = state.shopBrandName || 'BarberFlow';

  const logoPreview = state.uploadedLogo
    ? `<img src="${escapeHtml(state.uploadedLogo)}" class="cfg-logo-image" alt="Logo da barbearia">`
    : 'B';

  return /* html */ `
<section class="page-shell page--configuracoes">

  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Configurações da Barbearia</div>
      </div>

      <div class="cfg-row" data-open-modal="true">
        <div>
          <div class="cfg-label">📷 Logo e identidade visual</div>
          <div class="cfg-sub">Logo, cores e nome do sistema</div>
        </div>
        <div class="cfg-action-link">Personalizar →</div>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">🕐 Horário de funcionamento</div>
          <div class="cfg-sub">Seg–Sex 08:00–19:00 · Sáb 08:00–17:00</div>
        </div>
        <div class="cfg-action-muted">Editar →</div>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">📱 WhatsApp Business</div>
          <div class="cfg-sub">Número: (11) 99999-0000 · Conectado</div>
        </div>
        <div class="cfg-badge cfg-badge--success">● Ativo</div>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">💳 Plano atual</div>
          <div class="cfg-sub">BarberFlow Pro · R$399/mês</div>
        </div>
        <div class="cfg-badge cfg-badge--info">⚡ Pro</div>
      </div>

      <div class="cfg-row">
        <div>
          <div class="cfg-label">👥 Limite de barbeiros</div>
          <div class="cfg-sub">3 de 5 slots utilizados</div>
        </div>
        <div class="cfg-action-muted">3/5</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">Personalizar Sistema</div>
      </div>

      <div class="cfg-custom-card" data-open-modal="true">
        <div class="cfg-custom-title">🎨 Identidade visual</div>

        <div class="cfg-custom-content">
          <div id="cfgLogoPreview" class="cfg-logo-preview">
            ${logoPreview}
          </div>

          <div>
            <div id="cfgNameDisplay" class="cfg-brand-name">${escapeHtml(brandName)}</div>
            <div class="cfg-brand-subtitle">Clique para personalizar</div>
          </div>
        </div>
      </div>
    </div>
  </div>

</section>
  `;
}
