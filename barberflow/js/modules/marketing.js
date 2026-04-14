export function renderMarketing() {
  return /* html */ `
<section class="page-shell page--marketing">

<div class="grid-2">
<div class="card">
<div class="card-header"><div class="card-title">Campanhas</div><div class="card-action">+ Nova campanha</div></div>
<div class="camp-row" style="border-color:#00e676"><div class="camp-top"><div class="camp-name">🎂 Aniversariantes de Abril</div><div class="camp-status" style="background:rgba(0,230,118,.1);color:#00e676">● Ativa</div></div><div class="camp-detail">12 clientes · 8 enviadas · Desconto 20%</div></div>
<div class="camp-row" style="border-color:#4fc3f7"><div class="camp-top"><div class="camp-name">👥 Reativação — inativos 30d</div><div class="camp-status" style="background:rgba(79,195,247,.1);color:#4fc3f7">Agendada</div></div><div class="camp-detail">12 clientes · Amanhã 10:00</div></div>
<div class="camp-row" style="border-color:#9c6fff"><div class="camp-top"><div class="camp-name">⭐ Pós-atendimento automático</div><div class="camp-status" style="background:rgba(156,111,255,.1);color:#9c6fff">Automática</div></div><div class="camp-detail">94 enviadas após cada atendimento</div></div>
</div>
<div class="card">
<div class="card-header"><div class="card-title">Clientes Inativos</div><div class="card-action">Enviar campanha →</div></div>
<div class="row-item"><div class="row-avatar" style="background:linear-gradient(135deg,#6b6880,#3a3a4a)">ML</div><div class="row-info"><div class="row-name">Marcos Lima</div><div class="row-sub">62 dias sem visita</div><div class="row-prog"><div class="row-fill" style="width:100%;background:#ff1744"></div></div></div><div style="font-size:11px;color:#ff1744;font-weight:700">62d</div></div>
<div class="row-item"><div class="row-avatar" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8)">FO</div><div class="row-info"><div class="row-name">Felipe Oliveira</div><div class="row-sub">45 dias sem visita</div><div class="row-prog"><div class="row-fill" style="width:72%;background:#f97316"></div></div></div><div style="font-size:11px;color:#f97316;font-weight:700">45d</div></div>
</div>
</div>

</section>
  `;
}
