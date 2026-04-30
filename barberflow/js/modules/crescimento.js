import { apiFetch } from '../services/api.js';

var state = { data: null, activeTooltip: null };

var TOOLTIPS = {
  receita:      { title: 'Receita do mês', text: 'Total faturado com atendimentos concluídos neste mês. Quanto maior, melhor o desempenho da barbearia.' },
  ticket:       { title: 'Ticket médio', text: 'Valor médio cobrado por atendimento. Aumentar o ticket é uma forma eficiente de crescer sem precisar de mais clientes.' },
  ocupacao:     { title: 'Taxa de ocupação', text: 'Percentual do tempo disponível dos barbeiros que está sendo utilizado. Acima de 70% é saudável. Abaixo de 40% indica potencial ocioso.' },
  clientes:     { title: 'Clientes ativos', text: 'Total de clientes cadastrados e ativos na barbearia. Crescer essa base é essencial para aumentar a receita.' },
  assinaturas:  { title: 'Planos ativos', text: 'Clientes que pagam mensalmente por um plano. Geram receita previsível todo mês, independente de agendamentos avulsos.' },
  cancelamentos:{ title: 'Taxa de cancelamento', text: 'Percentual de agendamentos cancelados. Acima de 20% indica problema na retenção ou na política de cancelamento.' },
  ocupacao_atual:{ title: 'Ocupação atual', text: 'Percentual do tempo dos seus barbeiros que está sendo aproveitado este mês. Meta ideal: acima de 70%.' },
  meta50:       { title: 'Meta 50% de ocupação', text: 'Se seus barbeiros trabalharem 50% do tempo disponível, esta seria a receita mensal estimada. É um objetivo realista de curto prazo.' },
  potencial80:  { title: 'Potencial 80% de ocupação', text: 'Receita possível com alta ocupação. Atingir esse nível pode indicar o momento certo de contratar mais um barbeiro ou abrir uma segunda cadeira.' },
  receita_fixa: { title: 'Receita fixa de planos', text: 'Valor garantido que entra todo mês pelos planos ativos, independente de qualquer atendimento avulso. Quanto mais planos, mais previsível o negócio.' },
  conservador:  { title: 'Projeção conservadora', text: 'Estimativa de receita no próximo mês considerando crescimento de 15% ao mês — ritmo alcançável com foco em fidelização e divulgação.' },
  otimista:     { title: 'Projeção otimista', text: 'Estimativa com crescimento de 30% ao mês — possível com campanhas ativas, planos e alta retenção de clientes.' },
};

function fmt(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function fmtNum(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function deltaHtml(val) {
  if (val === null || val === undefined) return '<span style="color:#3a4568">—</span>';
  var abs = Math.abs(val).toFixed(1);
  if (val > 0) return '<span style="color:#00e676">&#9650; ' + abs + '%</span>';
  if (val < 0) return '<span style="color:#ff4444">&#9660; ' + abs + '%</span>';
  return '<span style="color:#3a4568">= 0%</span>';
}

function ocupacaoBadge(rate) {
  if (rate >= 70) return '<span style="color:#00e676">&#9679; Boa</span>';
  if (rate >= 40) return '<span style="color:#ffb300">&#9679; Média</span>';
  return '<span style="color:#ff4444">&#9679; Baixa</span>';
}

function setFeedback(msg, variant) {
  var el = document.getElementById('crescimento-feedback');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = variant === 'error' ? '#ff4444' : '#3a4568';
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function tipBtn(key) {
  return '<button type="button" class="cres-tip-btn" data-tip="' + key + '" title="Saiba mais" aria-label="Explicação">'
    + '<span>?</span>'
    + '</button>';
}

function showTooltip(key, triggerEl) {
  closeTooltip();

  var tip = TOOLTIPS[key];
  if (!tip) return;

  var box = document.createElement('div');
  box.className = 'cres-tooltip';
  box.id = 'cres-tooltip-active';
  box.innerHTML = '<div class="cres-tooltip-title">' + tip.title + '</div>'
    + '<div class="cres-tooltip-text">' + tip.text + '</div>';

  document.body.appendChild(box);

  var rect = triggerEl.getBoundingClientRect();
  var boxW = 240;
  var left = rect.right + 10;
  var top  = rect.top + rect.height / 2 - 30;
  
  if (left + boxW > window.innerWidth - 12) left = rect.left - boxW - 10;
  if (top < 8) top = 8;
  
  box.style.left  = left + 'px';
  box.style.top   = top + 'px';
  box.style.width = boxW + 'px';

  state.activeTooltip = key;

  setTimeout(function() {
    document.addEventListener('click', closeTooltipOnOutside, { once: true });
  }, 10);
}

function closeTooltip() {
  var el = document.getElementById('cres-tooltip-active');
  if (el) el.remove();
  state.activeTooltip = null;
}

function closeTooltipOnOutside(e) {
  if (!e.target.closest('.cres-tip-btn')) closeTooltip();
}

function bindTooltips() {
  document.querySelectorAll('.cres-tip-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var key = btn.getAttribute('data-tip');
      if (state.activeTooltip === key) { closeTooltip(); return; }
      showTooltip(key, btn);
    });
  });
}

// ─── Métricas ─────────────────────────────────────────────────────────────────

function metricCard(label, value, delta, tipKey) {
  return '<div class="cres-metric">'
    + '<div class="cres-metric-label">' + label
    + (tipKey ? tipBtn(tipKey) : '')
    + '</div>'
    + '<div class="cres-metric-value">' + value + '</div>'
    + (delta ? '<div class="cres-metric-delta">' + delta + '</div>' : '')
    + '</div>';
}

function renderMetrics(o) {
  var el = document.getElementById('crescimento-metrics');
  if (!el) return;
  el.innerHTML =
    metricCard('Receita do mês',    fmt(o.revenueThis),             deltaHtml(o.revenueGrowth) + ' <span style="color:#3a4568;font-size:11px">vs mês ant.</span>', 'receita') +
    metricCard('Ticket médio',      fmt(o.ticketMedio),             o.totalAppointments + ' atend.', 'ticket') +
    metricCard('Ocupação',          o.occupationRate.toFixed(1) + '%', ocupacaoBadge(o.occupationRate), 'ocupacao') +
    metricCard('Clientes ativos',   fmtNum(o.totalClients),         '', 'clientes') +
    metricCard('Planos ativos',     fmtNum(o.activeSubscriptions),  'Receita fixa ' + fmt(o.mrr), 'assinaturas') +
    metricCard('Cancelamentos',     o.cancellationRate.toFixed(1) + '%', o.cancellationRate > 20 ? '<span style="color:#ff4444">Alto</span>' : '<span style="color:#00e676">Normal</span>', 'cancelamentos');
}

// ─── Projeção ─────────────────────────────────────────────────────────────────

function projRow(label, value, badge, tipKey) {
  return '<div class="cres-proj-row">'
    + '<span class="cres-proj-label">' + label + (tipKey ? tipBtn(tipKey) : '') + '</span>'
    + '<span class="cres-proj-val">' + value + ' ' + badge + '</span>'
    + '</div>';
}

function renderProjecaoCards(o, proj) {
  var el = document.getElementById('crescimento-projecao');
  if (!el) return;
  var ticket   = o.ticketMedio || 40;
  var diasUteis = 22;
  var slotsPerDay = 16;
  var totalSlots  = diasUteis * slotsPerDay;

  var rev50 = Math.round(totalSlots * 0.5 * ticket);
  var rev80 = Math.round(totalSlots * 0.8 * ticket);

  el.innerHTML =
    projRow('Ocupação atual',              o.occupationRate.toFixed(1) + '%', ocupacaoBadge(o.occupationRate), 'ocupacao_atual') +
    projRow('Receita com 50% de ocupação', fmt(rev50) + '/mês', '<span style="color:#4fc3f7">Meta</span>', 'meta50') +
    projRow('Receita com 80% de ocupação', fmt(rev80) + '/mês', '<span style="color:#00e676">Potencial</span>', 'potencial80') +
    projRow('Receita fixa de planos',      fmt(o.mrr), o.activeSubscriptions + ' ativa(s)', 'receita_fixa') +
    projRow('Próx. mês conservador',       fmt(proj[0] && proj[0].conservador || 0), '+15% ao mês', 'conservador') +
    projRow('Próx. mês otimista',          fmt(proj[0] && proj[0].otimista || 0), '+30% ao mês', 'otimista');
}

// ─── Charts ───────────────────────────────────────────────────────────────────

var chartsRendered = false;

function renderCharts(d) {
  if (typeof Chart === 'undefined') return;
  if (chartsRendered) {
    ['chartReceita','chartBarbeiro','chartFidelizacao','chartProjecao'].forEach(function(id) {
      var c = Chart.getChart(id); if (c) c.destroy();
    });
  }
  chartsRendered = true;

  var gridColor = 'rgba(79,195,247,.06)';
  var tickColor = '#3a4568';
  var baseScales = {
    x: { grid:{ color:gridColor }, ticks:{ color:tickColor, font:{ size:11 } } },
    y: { grid:{ color:gridColor }, ticks:{ color:tickColor, font:{ size:11 } } }
  };

  var labels = d.monthlyRevenue.map(function(m){ return m.label; });
  new Chart(document.getElementById('chartReceita'), {
    type:'bar',
    data:{
      labels:labels,
      datasets:[
        { label:'Avulso', data:d.monthlyRevenue.map(function(m){ return m.avulso; }), backgroundColor:'#378ADD', borderRadius:4, stack:'a' },
        { label:'Assinatura', data:d.monthlyRevenue.map(function(m){ return m.assinatura; }), backgroundColor:'#639922', borderRadius:4, stack:'a' }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:baseScales.x,
        y:{ grid:baseScales.y.grid, stacked:true, ticks:{ color:tickColor, font:{ size:11 }, callback:function(v){ return 'R$'+v; } } }
      }
    }
  });

  var barNames = d.barberRevenue.map(function(b){ return b.name; });
  var barVals  = d.barberRevenue.map(function(b){ return b.revenue; });
  var barH = Math.max(120, barNames.length * 48 + 40);
  document.getElementById('chartBarberiroWrap').style.height = barH + 'px';

  new Chart(document.getElementById('chartBarbeiro'), {
    type:'bar',
    data:{
      labels: barNames.length ? barNames : ['Sem dados'],
      datasets:[{ label:'Receita', data: barVals.length ? barVals : [0], backgroundColor:'#378ADD', borderRadius:4 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, indexAxis:'y',
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ grid:baseScales.x.grid, ticks:{ color:tickColor, font:{ size:11 }, callback:function(v){ return 'R$'+v; } } },
        y:baseScales.y
      }
    }
  });

  var nc = d.clients.newClients;
  var rc = d.clients.returningClients;
  new Chart(document.getElementById('chartFidelizacao'), {
    type:'doughnut',
    data:{
      labels:['Novos','Retorno'],
      datasets:[{ data:[nc||0,rc||0], backgroundColor:['#378ADD','#639922'], borderWidth:0 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      cutout:'65%'
    }
  });

  var pLabels = d.projection.map(function(p){ return p.label; });
  new Chart(document.getElementById('chartProjecao'), {
    type:'line',
    data:{
      labels:pLabels,
      datasets:[
        { label:'Conservador', data:d.projection.map(function(p){ return p.conservador; }), borderColor:'#378ADD', backgroundColor:'rgba(55,138,221,.08)', fill:true, tension:.4, pointRadius:4, pointBackgroundColor:'#378ADD' },
        { label:'Otimista',    data:d.projection.map(function(p){ return p.otimista; }),    borderColor:'#639922', backgroundColor:'rgba(99,153,34,.05)',   fill:true, tension:.4, pointRadius:4, pointBackgroundColor:'#639922', borderDash:[5,4] }
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:baseScales.x,
        y:{ grid:baseScales.y.grid, ticks:{ color:tickColor, font:{ size:11 }, callback:function(v){ return 'R$'+v; } } }
      }
    }
  });
}

// ─── Legends ──────────────────────────────────────────────────────────────────

function renderLegend(id, items) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = items.map(function(item) {
    return '<span><span class="cres-leg-dot" style="background:' + item.color + '"></span>' + item.label + '</span>';
  }).join('');
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadData() {
  try {
    setFeedback('Carregando painel...', 'neutral');
    var data = await apiFetch('/api/reports/growth');
    state.data = data;
    renderMetrics(data.overview);
    renderProjecaoCards(data.overview, data.projection);
    renderCharts(data);
    renderLegend('legend-receita',    [{ color:'#378ADD', label:'Avulso' }, { color:'#639922', label:'Assinatura' }]);
    renderLegend('legend-fidelizacao',[{ color:'#378ADD', label:'Novos' },  { color:'#639922', label:'Retorno' }]);
    renderLegend('legend-projecao',   [{ color:'#378ADD', label:'Conservador (+15%/mês)' }, { color:'#639922', label:'Otimista (+30%/mês)' }]);
    bindTooltips();
    setFeedback('', '');
  } catch (err) {
    setFeedback('Não foi possível carregar: ' + (err.message || err), 'error');
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────

export function renderCrescimento() {
  return '<div class="cres-page">'

    + '<div class="card">'
    + '<div class="card-header"><div class="card-title">Painel de Crescimento</div>'
    + '<button id="cres-refresh-btn" style="font-size:11px;padding:4px 12px;border-radius:8px;border:1px solid #1e2345;background:#0d0f1e;color:#4fc3f7;cursor:pointer;">Atualizar</button>'
    + '</div>'
    + '<div id="crescimento-feedback" style="min-height:16px;font-size:11px;color:#3a4568;margin-bottom:8px;"></div>'
    + '<div id="crescimento-metrics" class="cres-metrics"></div>'
    + '</div>'

    + '<div class="card">'
    + '<div class="card-header"><div class="card-title">Receita mensal</div></div>'
    + '<div id="legend-receita" class="cres-legend"></div>'
    + '<div style="position:relative;width:100%;height:220px"><canvas id="chartReceita" role="img" aria-label="Receita mensal"></canvas></div>'
    + '</div>'

    + '<div class="cres-grid2">'
    + '<div class="card">'
    + '<div class="card-header"><div class="card-title">Receita por barbeiro</div></div>'
    + '<div id="chartBarberiroWrap" style="position:relative;width:100%;height:160px"><canvas id="chartBarbeiro" role="img" aria-label="Receita por barbeiro"></canvas></div>'
    + '</div>'
    + '<div class="card">'
    + '<div class="card-header"><div class="card-title">Fidelização</div></div>'
    + '<div id="legend-fidelizacao" class="cres-legend"></div>'
    + '<div style="position:relative;width:100%;height:140px"><canvas id="chartFidelizacao" role="img" aria-label="Clientes novos vs retorno"></canvas></div>'
    + '</div>'
    + '</div>'

    + '<div class="card">'
    + '<div class="card-header"><div class="card-title">Projeção de crescimento</div></div>'
    + '<div id="crescimento-projecao" class="cres-projecao"></div>'
    + '</div>'

    + '<div class="card">'
    + '<div class="card-header"><div class="card-title">Projeção 6 meses</div></div>'
    + '<div id="legend-projecao" class="cres-legend"></div>'
    + '<div style="position:relative;width:100%;height:220px"><canvas id="chartProjecao" role="img" aria-label="Projeção 6 meses"></canvas></div>'
    + '</div>'

    + '</div>';
}

export function initCrescimentoPage() {
  if (typeof Chart === 'undefined') {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = function() { loadData(); };
    document.head.appendChild(script);
  } else {
    loadData();
  }

  setTimeout(function() {
    var btn = document.getElementById('cres-refresh-btn');
    if (btn) btn.addEventListener('click', loadData);
  }, 100);
}
