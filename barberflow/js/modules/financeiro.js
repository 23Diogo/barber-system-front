export function renderFinanceiro() {
  return /* html */ `
<section class="page-shell page--financeiro">

<div class="grid-4" style="margin-bottom:14px">
<div class="metric-card"><div class="metric-label">Receita do mês</div><div class="metric-value">R$18.4k</div><div class="metric-sub color-up">↑ 8% vs anterior</div></div>
<div class="metric-card"><div class="metric-label">Despesas</div><div class="metric-value" style="color:#ff1744">R$6.2k</div><div class="metric-sub color-dn">↑ 3%</div></div>
<div class="metric-card"><div class="metric-label">Lucro líquido</div><div class="metric-value" style="color:#00e676">R$12.2k</div><div class="metric-sub color-up">Margem 66%</div></div>
<div class="metric-card"><div class="metric-label">Comissões</div><div class="metric-value">R$4.8k</div><div class="metric-sub color-nt">3 barbeiros</div></div>
</div>
<div class="grid-2">
<div class="card">
<div class="card-header"><div class="card-title">Contas a Pagar</div><div class="card-action">+ Adicionar</div></div>
<div class="fin-row" style="border-color:#f97316"><div class="fin-icon">🏠</div><div class="fin-info"><div class="fin-title">Aluguel</div><div class="fin-date">Vence amanhã · 14/04</div></div><div class="fin-val" style="color:#f97316">R$1.800</div></div>
<div class="fin-row" style="border-color:#ff1744"><div class="fin-icon">⚡</div><div class="fin-info"><div class="fin-title">Energia elétrica</div><div class="fin-date">Vence 20/04 · 7 dias</div></div><div class="fin-val" style="color:#ff1744">R$380</div></div>
<div class="fin-row" style="border-color:#4fc3f7"><div class="fin-icon">📦</div><div class="fin-info"><div class="fin-title">Reposição estoque</div><div class="fin-date">Vence 25/04</div></div><div class="fin-val" style="color:#4fc3f7">R$620</div></div>
<div class="fin-row" style="border-color:#00e676"><div class="fin-icon">💻</div><div class="fin-info"><div class="fin-title">BarberFlow Pro</div><div class="fin-date">Automático · 30/04</div></div><div class="fin-val" style="color:#00e676">R$399</div></div>
</div>
<div class="card">
<div class="card-header"><div class="card-title">Últimas Transações</div></div>
<div class="fin-row" style="border-color:#00e676"><div class="fin-icon">💇</div><div class="fin-info"><div class="fin-title">Corte + Barba — Rafael</div><div class="fin-date">Hoje · Pix</div></div><div class="fin-val" style="color:#00e676">+R$70</div></div>
<div class="fin-row" style="border-color:#00e676"><div class="fin-icon">💇</div><div class="fin-info"><div class="fin-title">Fade médio — Pedro</div><div class="fin-date">Hoje · Dinheiro</div></div><div class="fin-val" style="color:#00e676">+R$50</div></div>
<div class="fin-row" style="border-color:#ff1744"><div class="fin-icon">🧴</div><div class="fin-info"><div class="fin-title">Compra de produtos</div><div class="fin-date">Ontem · Débito</div></div><div class="fin-val" style="color:#ff1744">-R$245</div></div>
<div class="fin-row" style="border-color:#00e676"><div class="fin-icon">💇</div><div class="fin-info"><div class="fin-title">Barba — André</div><div class="fin-date">Ontem · Pix</div></div><div class="fin-val" style="color:#00e676">+R$45</div></div>
</div>
</div>

</section>
  `;
}
