export function renderClientes() {
  return /* html */ `
<section class="page-shell page--clientes">

<div style="display:flex;gap:10px;margin-bottom:14px">
<div style="flex:1;display:flex;align-items:center;gap:7px;background:#0a0c1a;border:1px solid #1e2345;border-radius:9px;padding:8px 13px;font-size:11px;color:#3a4568;cursor:pointer">🔍 Buscar por nome, telefone ou WhatsApp...</div>
<div style="padding:9px 16px;background:linear-gradient(90deg,#00b4ff,#6c3fff);color:#fff;border-radius:9px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">+ Novo cliente</div>
</div>
<div class="card">
<table class="data-table">
<thead><tr><th>Cliente</th><th>WhatsApp</th><th>Último corte</th><th>Visitas</th><th>Total gasto</th><th>Status</th></tr></thead>
<tbody>
<tr><td><div style="font-weight:600">Rafael Souza</div><div style="font-size:9px;color:#3a4568">Fade médio + navalha</div></td><td style="color:#5a6888">(11) 99999-1111</td><td>Hoje 09:00</td><td>24</td><td style="color:#ffd700;font-weight:600">R$1.680</td><td><span class="pill" style="background:rgba(255,215,0,.1);color:#ffd700">✦ VIP</span></td></tr>
<tr><td><div style="font-weight:600">Carlos Mendes</div><div style="font-size:9px;color:#3a4568">Corte curto + barba</div></td><td style="color:#5a6888">(11) 98888-2222</td><td>Hoje 14:30</td><td>15</td><td style="color:#4fc3f7;font-weight:600">R$975</td><td><span class="pill" style="background:rgba(0,230,118,.1);color:#00e676">Ativo</span></td></tr>
<tr><td><div style="font-weight:600">Pedro Costa</div><div style="font-size:9px;color:#3a4568">Fade alto + navalha</div></td><td style="color:#5a6888">(11) 95555-5555</td><td>08/03/2025</td><td>18</td><td style="color:#ffd700;font-weight:600">R$1.260</td><td><span class="pill" style="background:rgba(255,215,0,.1);color:#ffd700">✦ VIP</span></td></tr>
<tr><td><div style="font-weight:600">Bruno Alves</div><div style="font-size:9px;color:#3a4568">Barba completa</div></td><td style="color:#5a6888">(11) 97777-3333</td><td>15/03/2025</td><td>8</td><td style="color:#4fc3f7;font-weight:600">R$360</td><td><span class="pill" style="background:rgba(0,230,118,.1);color:#00e676">Ativo</span></td></tr>
<tr><td><div style="font-weight:600">Marcos Lima</div><div style="font-size:9px;color:#3a4568">—</div></td><td style="color:#5a6888">(11) 96666-4444</td><td>10/02/2025</td><td>3</td><td style="color:#5a6888;font-weight:600">R$120</td><td><span class="pill" style="background:rgba(249,115,22,.1);color:#f97316">Inativo</span></td></tr>
</tbody>
</table>
</div>

</section>
  `;
}
