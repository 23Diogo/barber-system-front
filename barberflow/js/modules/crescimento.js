import { apiFetch } from '../services/api.js';

var state = { data: null };

function fmt(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function fmtNum(value) {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

function deltaHtml(val) {
  if (val === null || val === undefined) return '<span style="color:var(--color-text-tertiary)">—</span>';
  var abs = Math.abs(val).toFixed(1);
  if (val > 0) return '<span style="color:#3B6D11">&#9650; ' + abs + '%</span>';
  if (val < 0) return '<span style="color:#A32D2D">&#9660; ' + abs + '%</span>';
  return '<span style="color:var(--color-text-tertiary)">= 0%</span>';
}

function setFeedback(msg, variant) {
  var el = document.getElementById('crescimento-feedback');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = variant === 'error' ? '#A32D2D' : 'var(--color-text-secondary)';
}

function renderMetrics(o) {
  var el = document.getElementById('crescimento-metrics');
  if (!el) return;
  el.innerHTML =
    metricCard('Receita do mês', fmt(o.revenueThis), deltaHtml(o.revenueGrowth), 'vs mês anterior') +
    metricCard('Ticket médio', fmt(o.ticketMedio), o.totalAppointments + ' atend.', '') +
    metricCard('Ocupação', o.occupationRate.toFixed(1) + '%', ocupacaoBadge(o.occupationRate), '') +
    metricCard('Clientes ativos', fmtNum(o.totalClients), '', '') +
    metricCard('Assinaturas', fmtNum(o.activeSubscriptions), 'MRR ' + fmt(o.mrr), '') +
    metricCard('Cancelamentos', o.cancellationRate.toFixed(1) + '%', o.cancellationRate > 20 ? '<span style="color:#A32D2D">Alto</span>' : '<span style="color:#3B6D11">Normal</span>', '');
}

function metricCard(label, value, delta, sub) {
  return '<div class="cres-metric">'
    + '<div class="cres-metric-label">' + label + '</div>'
    + '<div class="cres-metric-value">' + value + '</div>'
    + (delta ? '<div class="cres-metric-delta">' + delta + (sub ? ' <span style="color:var(--color-text-tertiary)">' + sub + '</span>' : '') + '</div>' : '')
    + '</div>';
}

function ocupacaoBadge(rate) {
  if (rate >= 70) return '<span style="color:#3B6D11">&#9679; Boa</span>';
  if (rate >= 40) return '<span style="color:#854F0B">&#9679; Média</span>';
  return '<span style="color:#A32D2D">&#9679; Baixa</span>';
}

var chartsRendered = false;

function renderCharts(d) {
  if (typeof Chart === 'undefined') return;
  if (chartsRendered) {
    Chart.getChart('chartReceita') && Chart.getChart('chartReceita').destroy();
    Chart.getChart('chartBarbeiro') && Chart.getChart('chartBarbeiro').destroy();
    Chart.getChart('chartFidelizacao') && Chart.getChart('chartFidelizacao').destroy();
    Chart.getChart('chartProjecao') && Chart.getChart('chartProjecao').destroy();
  }
  chartsRendered = true;

  var isDark = document.body.classList.contains('theme-dark') || !document.body.classList.contains('theme-light');
  var gridColor  = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)';
  var tickColor  = isDark ? '#8fa3c7' : '#888';
  var baseScales = {
    x: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } } },
    y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { size: 11 } } }
  };

  var labels = d.monthlyRevenue.map(function(m) { return m.label; });
  var avulso = d.monthlyRevenue.map(function(m) { return m.avulso; });
  var assin  = d.monthlyRevenue.map(function(m) { return m.assinatura; });

  new Chart(document.getElementById('chartReceita'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Avulso', data: avulso, backgroundColor: '#378ADD', borderRadius: 4, stack: 'a' },
        { label: 'Assinatura', data: assin, backgroundColor: '#639922', borderRadius: 4, stack: 'a' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: baseScales.x,
        y: { grid: baseScales.y.grid, ticks: { color: tickColor, font: { size: 11 }, callback: function(v) { return 'R$' + v; } }, stacked: true }
      }
    }
  });

  var barNames = d.barberRevenue.map(function(b) { return b.name; });
  var barVals  = d.barberRevenue.map(function(b) { return b.revenue; });
  var barH = Math.max(120, barNames.length * 48 + 40);
  document.getElementById('chartBarberiroWrap').style.height = barH + 'px';

  new Chart(document.getElementById('chartBarbeiro'), {
    type: 'bar',
    data: {
      labels: barNames.length ? barNames : ['Sem dados'],
      datasets: [{ label: 'Receita', data: barVals.length ? barVals : [0], backgroundColor: '#378ADD', borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: baseScales.x.grid, ticks: { color: tickColor, font: { size: 11 }, callback: function(v) { return 'R$' + v; } } },
        y: baseScales.y
      }
    }
  });

  var nc = d.clients.newClients;
  var rc = d.clients.returningClients;
  new Chart(document.getElementById('chartFidelizacao'), {
    type: 'doughnut',
    data: {
      labels: ['Novos', 'Retorno'],
      datasets: [{ data: [nc || 0, rc || 0], backgroundColor: ['#378ADD', '#639922'], borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      cutout: '65%'
    }
  });

  var pLabels = d.projection.map(function(p) { return p.label; });
  var pCons   = d.projection.map(function(p) { return p.conservador; });
  var pOtim   = d.projection.map(function(p) { return p.otimista; });

  new Chart(document.getElementById('chartProjecao'), {
    type: 'line',
    data: {
      labels: pLabels,
      datasets: [
        { label: 'Conservador (+15%/mês)', data: pCons, borderColor: '#378ADD', backgroundColor: 'rgba(55,138,221,.08)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#378ADD' },
        { label: 'Otimista (+30%/mês)', data: pOtim, borderColor: '#639922', backgroundColor: 'rgba(99,153,34,.05)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#639922', borderDash: [5, 4] }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: baseScales.x,
        y: { grid: baseScales.y.grid, ticks: { color: tickColor, font: { size: 11 }, callback: function(v) { return 'R$' + v; } } }
      }
    }
  });
}

function renderProjecaoCards(o, proj) {
  var el = document.getElementById('crescimento-projecao');
  if (!el) return;
  var ocupAtual = o.occupationRate;
  var ticket    = o.ticketMedio || 40;
  var barberCt  = 1;
  var diasUteis = 22;
  var slotsPerDay = 16;
  var totalSlots  = barberCt * diasUteis * slotsPerDay;

  var rev50 = Math.round(totalSlots * 0.5 * ticket);
  var rev80 = Math.round(totalSlots * 0.8 * ticket);

  el.innerHTML =
    projRow('Ocupação atual', ocupAtual.toFixed(1) + '%', ocupacaoBadge(ocupAtual)) +
    projRow('Receita com 50% de ocupação', fmt(rev50) + '/mês', '<span style="color:#185FA5">Meta</span>') +
    projRow('Receita com 80% de ocupação', fmt(rev80) + '/mês', '<span style="color:#3B6D11">Potencial</span>') +
    projRow('MRR de assinaturas', fmt(o.mrr), o.activeSubscriptions + ' ativa(s)') +
    projRow('Próx. mês conservador', fmt(proj[0] && proj[0].conservador || 0), '+15% ao mês') +
    projRow('Próx. mês otimista', fmt(proj[0] && proj[0].otimista || 0), '+30% ao mês');
}

function projRow(label, value, badge) {
  return '<div class="cres-proj-row">'
    + '<span class="cres-proj-label">' + label + '</span>'
    + '<span class="cres-proj-val">' + value + ' ' + badge + '</span>'
    + '</div>';
}

async function loadData() {
  try {
    setFeedback('Carregando painel...', 'neutral');
    var data = await apiFetch('/api/reports/growth');
    state.data = data;
    renderMetrics(data.overview);
    renderProjecaoCards(data.overview, data.projection);
    renderCharts(data);
    setFeedback('', '');
  } catch (err) {
    setFeedback('Não foi possível carregar os dados: ' + (err.message || err), 'error');
  }
}

function renderLegendReceita() {
  var el = document.getElementById('legend-receita');
  if (!el) return;
  el.innerHTML =
    '<span><span class="cres-leg-dot" style="background:#378ADD"></span>Avulso</span>' +
    '<span><span class="cres-leg-dot" style="background:#639922"></span>Assinatura</span>';
}

function renderLegendProjecao() {
  var el = document.getElementById('legend-projecao');
  if (!el) return;
  el.innerHTML =
    '<span><span class="cres-leg-dot" style="background:#378ADD"></span>Conservador (+15%/mês)</span>' +
    '<span><span class="cres-leg-dot" style="background:#639922;opacity:.6"></span>Otimista (+30%/mês)</span>';
}

function renderLegendFidelizacao() {
  var el = document.getElementById('legend-fidelizacao');
  if (!el) return;
  el.innerHTML =
    '<span><span class="cres-leg-dot" style="background:#378ADD"></span>Novos</span>' +
    '<span><span class="cres-leg-dot" style="background:#639922"></span>Retorno</span>';
}

export function renderCrescimento() {
  return '<div class="cres-page">'

    + '<div class="card">'
    + '<div class="card-header"><div class="card-title">Painel de Crescimento</div>'
    + '<button id="cres-refresh-btn" class="btn-secondary" style="font-size:13px;padding:4px 12px;">Atualizar</button>'
    + '</div>'
    + '<div id="crescimento-feedback" style="min-height:18px;font-size:13px;color:var(--color-text-secondary);margin-bottom:8px;"></div>'
    + '<div id="crescimento-metrics" class="cres-metrics"></div>'
    + '</div>'

    + '<div class="card">'
    + '<div class="card-header"><div class="card-title">Receita mensal</div></div>'
    + '<div id="legend-receita" class="cres-legend"></div>'
    + '<div style="position:relative;width:100%;height:220px"><canvas id="chartReceita" role="img" aria-label="Receita mensal empilhada por tipo"></canvas></div>'
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
    + '<div style="position:relative;width:100%;height:220px"><canvas id="chartProjecao" role="img" aria-label="Projeção de receita 6 meses"></canvas></div>'
    + '</div>'

    + '</div>';
}

export function initCrescimentoPage() {
  renderLegendReceita();
  renderLegendFidelizacao();
  renderLegendProjecao();

  if (typeof Chart === 'undefined') {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.onload = function() { loadData(); };
    document.head.appendChild(script);
  } else {
    loadData();
  }

  document.getElementById('cres-refresh-btn') && document.getElementById('cres-refresh-btn').addEventListener('click', loadData);
}
