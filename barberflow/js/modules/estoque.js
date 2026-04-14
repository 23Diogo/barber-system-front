export function renderEstoque() {
  return /* html */ `
<section class="page-shell page--estoque">

<div class="grid-2">
<div class="card">
<div class="card-header"><div class="card-title">⚠️ Estoque Crítico</div><div class="card-action" style="color:#ff1744">Repor tudo</div></div>
<div class="fin-row" style="border-color:#ff1744"><div class="fin-icon">🍯</div><div class="fin-info"><div class="fin-title">Pomada Dapper Dan</div><div class="fin-date">2 un restantes · Mín: 10 un</div></div><div class="fin-val" style="color:#ff1744">2 un</div></div>
<div class="fin-row" style="border-color:#f97316"><div class="fin-icon">🪒</div><div class="fin-info"><div class="fin-title">Lâmina Gillette Fusion</div><div class="fin-date">8 un restantes · Mín: 20 un</div></div><div class="fin-val" style="color:#f97316">8 un</div></div>
<div class="fin-row" style="border-color:#f97316"><div class="fin-icon">🧴</div><div class="fin-info"><div class="fin-title">Shampoo Profissional</div><div class="fin-date">1.5 L restantes · Mín: 5 L</div></div><div class="fin-val" style="color:#f97316">1.5 L</div></div>
<div class="fin-row" style="border-color:#00e676"><div class="fin-icon">✂️</div><div class="fin-info"><div class="fin-title">Tesoura Kamisori</div><div class="fin-date">Normal · 4 unidades</div></div><div class="fin-val" style="color:#00e676">4 un</div></div>
</div>
<div class="card">
<div class="card-header"><div class="card-title">Resumo do Estoque</div><div class="card-action">+ Produto</div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<div class="mini-card"><div class="mini-val">24</div><div class="mini-lbl">Produtos cadastrados</div></div>
<div class="mini-card" style="border:1px solid rgba(239,68,68,.2)"><div class="mini-val" style="color:#ff1744">3</div><div class="mini-lbl">Abaixo do mínimo</div></div>
<div class="mini-card"><div class="mini-val" style="color:#4fc3f7">R$2.4k</div><div class="mini-lbl">Valor em estoque</div></div>
<div class="mini-card" style="border:1px solid rgba(0,230,118,.2)"><div class="mini-val" style="color:#00e676">18</div><div class="mini-lbl">Em nível normal</div></div>
</div>
</div>
</div>

</section>
  `;
}
