export function renderWhatsApp() {
  return /* html */ `
<section class="page-shell page--whatsapp">

<div class="grid-2">
<div class="card">
<div class="card-header"><div class="card-title">💬 Conversas</div><div style="font-size:10px;background:rgba(0,230,118,.1);color:#00e676;padding:3px 10px;border-radius:8px;font-weight:600">● Bot ativo</div></div>
<div class="row-item" style="border:1px solid rgba(79,195,247,.2);background:rgba(79,195,247,.04)">
<div class="row-avatar" style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000">RS</div>
<div class="row-info"><div class="row-name">Rafael Souza</div><div class="row-sub">Quero agendar para amanhã...</div></div>
<div style="text-align:right"><div style="font-size:9px;color:#3a4568">14:23</div><div style="background:#4fc3f7;color:#000;font-size:9px;font-weight:700;padding:1px 6px;border-radius:7px;margin-top:3px">2</div></div>
</div>
<div class="row-item"><div class="row-avatar" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8)">BF</div><div class="row-info"><div class="row-name">Bruno Freitas</div><div class="row-sub">Bot: "Horários disponíveis..."</div></div><div style="font-size:9px;color:#3a4568">13:55</div></div>
<div class="row-item"><div class="row-avatar" style="background:linear-gradient(135deg,#22c55e,#15803d)">MC</div><div class="row-info"><div class="row-name">Marcos Carvalho</div><div class="row-sub">Agendamento confirmado ✓</div></div><div style="font-size:9px;color:#3a4568">12:10</div></div>
</div>
<div class="card">
<div class="card-header"><div class="card-title">Rafael Souza</div><div style="font-size:10px;color:#00e676;font-weight:600">● Online</div></div>
<div class="chat-area">
<div style="display:flex;flex-direction:column;align-items:flex-start"><div style="font-size:8px;color:#3a4568;margin-bottom:2px">14:20</div><div class="bubble bubble-in">Oi, quero agendar um corte pra amanhã 🤙</div></div>
<div style="display:flex;flex-direction:column;align-items:flex-end"><div style="font-size:8px;color:#3a4568;margin-bottom:2px;text-align:right">14:20 · Bot</div><div class="bubble bubble-out">Olá, Rafael! 👋 Bem-vindo!<br/><br/>1️⃣ Agendar horário<br/>2️⃣ Meus agendamentos<br/>3️⃣ Falar com atendente</div></div>
<div style="display:flex;flex-direction:column;align-items:flex-start"><div style="font-size:8px;color:#3a4568;margin-bottom:2px">14:21</div><div class="bubble bubble-in">1</div></div>
<div style="display:flex;flex-direction:column;align-items:flex-end"><div style="font-size:8px;color:#3a4568;margin-bottom:2px;text-align:right">14:21 · Bot</div><div class="bubble bubble-out">✂️ Nossos serviços:<br/><br/>1️⃣ Corte — R$40<br/>2️⃣ Corte + Barba — R$70<br/>3️⃣ Fade médio — R$55<br/>4️⃣ Barba — R$45</div></div>
</div>
<div style="display:flex;gap:8px;margin-top:10px">
<div style="flex:1;background:#0d0f1e;border:1px solid #1e2345;border-radius:8px;padding:8px 12px;font-size:11px;color:#3a4568">Assumir conversa...</div>
<div style="padding:8px 16px;background:linear-gradient(90deg,#00b4ff,#6c3fff);color:#fff;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer">Enviar</div>
</div>
</div>
</div>

</section>
  `;
}
