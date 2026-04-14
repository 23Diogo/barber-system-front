import { state } from '../state.js';

export function renderConfiguracoes() {
  const logoPreview = state.uploadedLogo
    ? `<img src="${state.uploadedLogo}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`
    : 'B';

  return /* html */ `
<section class="page-shell page--configuracoes">

<div class="grid-2">
<div class="card">
<div class="card-header"><div class="card-title">Configurações da Barbearia</div></div>
<div class="cfg-row" data-open-modal="true"><div><div class="cfg-label">📷 Logo e identidade visual</div><div class="cfg-sub">Logo, cores e nome do sistema</div></div><div style="font-size:11px;color:#4fc3f7">Personalizar →</div></div>
<div class="cfg-row"><div><div class="cfg-label">🕐 Horário de funcionamento</div><div class="cfg-sub">Seg–Sex 08:00–19:00 · Sáb 08:00–17:00</div></div><div style="font-size:11px;color:#5a6888">Editar →</div></div>
<div class="cfg-row"><div><div class="cfg-label">📱 WhatsApp Business</div><div class="cfg-sub">Número: (11) 99999-0000 · Conectado</div></div><div style="font-size:10px;background:rgba(0,230,118,.1);color:#00e676;padding:3px 9px;border-radius:8px;font-weight:600">● Ativo</div></div>
<div class="cfg-row"><div><div class="cfg-label">💳 Plano atual</div><div class="cfg-sub">BarberFlow Pro · R$399/mês</div></div><div style="font-size:10px;background:rgba(79,195,247,.1);color:#4fc3f7;padding:3px 9px;border-radius:8px;font-weight:600">⚡ Pro</div></div>
<div class="cfg-row"><div><div class="cfg-label">👥 Limite de barbeiros</div><div class="cfg-sub">3 de 5 slots utilizados</div></div><div style="font-size:11px;color:#5a6888">3/5</div></div>
</div>
<div class="card">
<div class="card-header"><div class="card-title">Personalizar Sistema</div></div>
<div data-open-modal="true" style="padding:14px;background:rgba(255,255,255,.02);border-radius:10px;cursor:pointer;border:1px solid #1e2345;margin-bottom:10px">
<div style="font-size:10px;font-weight:700;color:#4fc3f7;margin-bottom:8px">🎨 Identidade visual</div>
<div style="display:flex;align-items:center;gap:10px">
<div id="cfgLogoPreview" style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#ffd700,#7a5a10);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:18px;font-weight:900;color:#000;overflow:hidden">B</div>
<div><div id="cfgNameDisplay" style="font-size:11px;font-weight:600">BarberFlow</div><div style="font-size:9px;color:#3a4568">Clique para personalizar</div></div>
</div>
</div>
</div>
</div>

</section>
  `
    .replace('id="cfgNameDisplay">BarberFlow</div>', `id="cfgNameDisplay">${state.shopBrandName || 'BarberFlow'}</div>`)
    .replace('value="Barbearia do Diogo"', `value="${state.shopName}"`)
    .replace(
      '<div id="cfgLogoPreview" style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#ffd700,#7a5a10);display:flex;align-items:center;justify-content:center;font-family:\'Orbitron\',sans-serif;font-size:18px;font-weight:900;color:#000;overflow:hidden">B</div>',
      `<div id="cfgLogoPreview" style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#ffd700,#7a5a10);display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-size:18px;font-weight:900;color:#000;overflow:hidden">${logoPreview}</div>`
    );
}
