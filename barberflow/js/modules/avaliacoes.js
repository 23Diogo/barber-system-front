export function renderAvaliacoes() {
  return /* html */ `
<section class="page-shell page--avaliacoes">

<div class="grid-3" style="margin-bottom:14px">
<div class="metric-card" style="text-align:center"><div class="metric-label">Nota média</div><div class="metric-value" style="color:#ffd700">4.8</div><div class="stars">★★★★★</div></div>
<div class="metric-card"><div class="metric-label">Total avaliações</div><div class="metric-value">127</div><div class="metric-sub color-up">↑ 8 este mês</div></div>
<div class="metric-card"><div class="metric-label">Google Reviews</div><div class="metric-value" style="color:#00e676">34</div><div class="metric-sub color-nt">enviados ao Google</div></div>
</div>
<div class="card">
<div class="card-header"><div class="card-title">Avaliações Recentes</div></div>
<div class="review-card"><div class="review-top"><div class="review-name">Rafael Souza</div><div class="stars">★★★★★</div></div><div class="review-text">"Melhor barbearia da cidade! Jorge é um artista, fade perfeito como sempre. Atendimento rápido e ambiente ótimo."</div><div class="review-meta">Atendido por Jorge · Hoje 09:00</div></div>
<div class="review-card"><div class="review-top"><div class="review-name">Pedro Lima</div><div class="stars">★★★★★</div></div><div class="review-text">"Marcos fez um trabalho impecável no fade. Primeira vez aqui e já voltarei com certeza!"</div><div class="review-meta">Atendido por Marcos · Hoje 10:00</div></div>
<div class="review-card" style="border-color:#4fc3f7"><div class="review-top"><div class="review-name">André Costa</div><div class="stars">★★★★<span style="color:#3a4568">★</span></div></div><div class="review-text">"Ótimo atendimento, só achei um pouco demorado. No geral, muito bom!"</div><div class="review-meta">Atendido por Lucas · 12/04/2025</div></div>
</div>

</section>
  `;
}
