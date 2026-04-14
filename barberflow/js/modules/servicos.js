export function renderServicos() {
  return /* html */ `
<section class="page-shell page--servicos">

<div class="grid-2">
<div class="card">
<div class="card-header"><div class="card-title">Serviços Cadastrados</div><div class="card-action">+ Novo serviço</div></div>
<div class="svc-row"><div class="svc-icon">✂️</div><div class="svc-info"><div class="svc-name">Corte simples</div><div class="svc-detail">30 min · Todos os barbeiros</div></div><div class="svc-price">R$40</div></div>
<div class="svc-row"><div class="svc-icon">✂️</div><div class="svc-info"><div class="svc-name">Corte + Barba</div><div class="svc-detail">60 min · Todos os barbeiros</div></div><div class="svc-price">R$70</div></div>
<div class="svc-row"><div class="svc-icon">✨</div><div class="svc-info"><div class="svc-name">Fade médio</div><div class="svc-detail">45 min · Todos os barbeiros</div></div><div class="svc-price">R$55</div></div>
<div class="svc-row"><div class="svc-icon">🪒</div><div class="svc-info"><div class="svc-name">Barba completa</div><div class="svc-detail">30 min · Jorge, Lucas</div></div><div class="svc-price">R$45</div></div>
<div class="svc-row"><div class="svc-icon">💈</div><div class="svc-info"><div class="svc-name">Fade + Navalha</div><div class="svc-detail">60 min · Jorge</div></div><div class="svc-price">R$65</div></div>
</div>
<div class="card">
<div class="card-header"><div class="card-title">Mais Vendidos</div></div>
<div class="row-item"><div style="font-size:20px">✂️</div><div class="row-info"><div class="row-name">Corte + Barba</div><div class="row-sub">48 vezes este mês</div><div class="row-prog"><div class="row-fill" style="width:96%"></div></div></div><div class="row-value">R$3.360</div></div>
<div class="row-item"><div style="font-size:20px">✨</div><div class="row-info"><div class="row-name">Fade médio</div><div class="row-sub">32 vezes este mês</div><div class="row-prog"><div class="row-fill" style="width:64%"></div></div></div><div class="row-value">R$1.760</div></div>
<div class="row-item"><div style="font-size:20px">✂️</div><div class="row-info"><div class="row-name">Corte simples</div><div class="row-sub">28 vezes este mês</div><div class="row-prog"><div class="row-fill" style="width:56%"></div></div></div><div class="row-value">R$1.120</div></div>
</div>
</div>

</section>
  `;
}
