import { getClientProfile } from '../../services/client-auth.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNextAppointment(appointment) {
  if (!appointment) {
    return {
      title: 'Nenhum horário',
      subtitle: 'Você ainda não possui agendamento confirmado.',
    };
  }

  const rawDate =
    appointment.date ||
    appointment.start_at ||
    appointment.startAt ||
    appointment.datetime;

  const date = rawDate ? new Date(rawDate) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return {
      title: 'Agendamento',
      subtitle: 'Seu próximo horário aparecerá aqui.',
    };
  }

  const dateLabel = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  const timeLabel = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return {
    title: `${dateLabel} • ${timeLabel}`,
    subtitle: appointment.service_name || appointment.service || 'Serviço agendado',
  };
}

function getActiveBarbershop(profile) {
  const shops = Array.isArray(profile?.barbershops) ? profile.barbershops : [];

  return (
    shops.find((item) => item?.is_active || item?.is_selected) ||
    shops[0] ||
    null
  );
}

function buildBarbershopSummary(profile) {
  const shops = Array.isArray(profile?.barbershops) ? profile.barbershops : [];
  const activeShop = getActiveBarbershop(profile);

  return {
    count: shops.length,
    activeShopName: activeShop?.name || 'Nenhuma barbearia vinculada',
    supportText:
      shops.length > 1
        ? 'Sua conta já suporta múltiplas barbearias parceiras.'
        : 'Sua conta está pronta para múltiplas barbearias.',
  };
}

function getPlanSummary(profile) {
  const planName =
    profile?.subscription?.plan_name ||
    profile?.plan?.name ||
    'Sem plano ativo';

  const planStatus =
    profile?.subscription?.status ||
    profile?.plan?.status ||
    'Disponível para contratação';

  return { planName, planStatus };
}

function buildChairSvg() {
  return `
    <svg fill="none" width="185" height="205" viewBox="0 0 185 205">
      <ellipse cx="92" cy="196" rx="55" ry="9" fill="#2a3570" opacity=".65"></ellipse>
      <rect x="82" y="170" width="22" height="27" rx="5" fill="#252e58"></rect>
      <rect x="46" y="162" width="92" height="14" rx="7" fill="#252e58"></rect>
      <rect x="60" y="157" width="62" height="9" rx="4" fill="#1c2448"></rect>

      <rect x="32" y="108" width="17" height="52" rx="6" fill="#1c2248"></rect>
      <rect x="28" y="100" width="24" height="13" rx="6" fill="#3a4278"></rect>

      <rect x="136" y="108" width="17" height="52" rx="6" fill="#1c2248"></rect>
      <rect x="133" y="100" width="24" height="13" rx="6" fill="#3a4278"></rect>

      <rect x="44" y="120" width="96" height="34" rx="9" fill="url(#seat)"></rect>
      <rect x="51" y="124" width="82" height="12" rx="6" fill="rgba(255,255,255,.07)"></rect>

      <rect x="52" y="38" width="80" height="86" rx="12" fill="url(#back)"></rect>
      <rect x="62" y="50" width="60" height="64" rx="8" fill="url(#panel)"></rect>
      <rect x="69" y="56" width="46" height="28" rx="5" fill="rgba(255,255,255,.05)"></rect>

      <rect x="58" y="10" width="68" height="36" rx="11" fill="url(#head)"></rect>
      <rect x="67" y="17" width="50" height="18" rx="7" fill="rgba(255,255,255,.06)"></rect>

      <rect x="52" y="46" width="3" height="74" rx="1.5" fill="url(#neon1)"></rect>
      <rect x="130" y="46" width="3" height="74" rx="1.5" fill="url(#neon1)"></rect>
      <rect x="59" y="12" width="66" height="3" rx="1.5" fill="url(#neon2)"></rect>
      <rect x="44" y="120" width="96" height="3" rx="1.5" fill="url(#neon2)" opacity=".5"></rect>

      <circle cx="92" cy="5" r="5" fill="#4fc3f7" opacity=".9"></circle>
      <circle cx="92" cy="5" r="9" fill="#4fc3f7" opacity=".12"></circle>
      <circle cx="44" cy="120" r="4" fill="#00b4ff" opacity=".7"></circle>
      <circle cx="140" cy="120" r="4" fill="#00b4ff" opacity=".7"></circle>

      <path d="M18 94 L6 82 M6 82 L13 82 M6 82 L6 89" stroke="#4fc3f7" stroke-width="1.8" stroke-linecap="round" opacity=".6"></path>
      <path d="M167 110 L179 98 M179 98 L172 98 M179 98 L179 105" stroke="#4fc3f7" stroke-width="1.8" stroke-linecap="round" opacity=".6"></path>

      <defs>
        <linearGradient id="seat" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#7e3222"></stop>
          <stop offset="50%" stop-color="#9e3e2a"></stop>
          <stop offset="100%" stop-color="#6e2a1a"></stop>
        </linearGradient>

        <linearGradient id="back" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#5e261a"></stop>
          <stop offset="100%" stop-color="#8e3422"></stop>
        </linearGradient>

        <linearGradient id="panel" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#7e301e" stop-opacity=".85"></stop>
          <stop offset="100%" stop-color="#9e3c26" stop-opacity=".65"></stop>
        </linearGradient>

        <linearGradient id="head" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#6e2c1a"></stop>
          <stop offset="100%" stop-color="#8e3422"></stop>
        </linearGradient>

        <linearGradient id="neon1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#4fc3f7" stop-opacity=".9"></stop>
          <stop offset="100%" stop-color="#0066ff" stop-opacity=".3"></stop>
        </linearGradient>

        <linearGradient id="neon2" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="#4fc3f7" stop-opacity=".15"></stop>
          <stop offset="50%" stop-color="#4fc3f7" stop-opacity=".9"></stop>
          <stop offset="100%" stop-color="#4fc3f7" stop-opacity=".15"></stop>
        </linearGradient>
      </defs>
    </svg>
  `;
}

function renderWidgetTopbar(title, route) {
  return `
    <div class="widget-topbar">
      <div class="ac-title">${escapeHtml(title)}</div>
      <div class="widget-actions">
        <span class="widget-open" data-client-route="${escapeHtml(route)}">abrir ↗</span>
      </div>
    </div>
  `;
}

function renderDataRows(rows = []) {
  return rows
    .map((row) => `
      <div class="data-row">
        <span class="data-name">${escapeHtml(row.name || '')}</span>
        <div class="data-bar">
          <div class="data-fill" style="${row.fillStyle || ''}; width:${row.fillWidth || '0%'}"></div>
        </div>
        <span class="data-val" style="${row.valueStyle || ''}">${escapeHtml(row.value || '')}</span>
      </div>
    `)
    .join('');
}

function renderHomeCard({
  title,
  route,
  value,
  subtitle,
  rows = [],
  module,
  moduleStyle = '',
  valueClass = '',
}) {
  return `
    <article
      class="analytics-card dashboard-widget client-home-card"
      data-client-route="${escapeHtml(route)}"
      role="button"
      tabindex="0"
      title="${escapeHtml(`Abrir ${title}`)}"
    >
      ${renderWidgetTopbar(title, route)}
      <div class="ac-value ${valueClass}">${escapeHtml(value)}</div>
      <div class="ac-sub">${escapeHtml(subtitle)}</div>
      ${renderDataRows(rows)}
      <div class="widget-module" style="${moduleStyle}">${escapeHtml(module)}</div>
    </article>
  `;
}

export function renderClientHome() {
  const profile = getClientProfile() || {};
  const firstName = String(profile?.name || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';

  const nextAppointment = formatNextAppointment(
    profile?.next_appointment ||
    profile?.nextAppointment ||
    null
  );

  const plan = getPlanSummary(profile);
  const barbershopSummary = buildBarbershopSummary(profile);
  const activeShop = getActiveBarbershop(profile);

  return `
    <div class="client-home-shell">
      <section class="client-home-hero-card">
        <div class="client-home-hero-copy">
          <div class="client-home-kicker">Área do cliente</div>
          <h2 class="client-home-title">Olá, ${escapeHtml(firstName)}</h2>
          <p class="client-home-text">
            Gerencie seus horários, barbearias, plano e dados em um portal único.
          </p>

          <div class="client-home-pills">
            <span class="client-home-pill">
              Barbearia atual: ${escapeHtml(activeShop?.name || 'Nenhuma barbearia selecionada')}
            </span>
            <span class="client-home-pill client-home-pill--accent">
              ${escapeHtml(String(barbershopSummary.count))} barbearia(s) vinculada(s)
            </span>
          </div>
        </div>

        <div class="client-home-hero-visual" aria-hidden="true">
          <div class="client-home-brand">
            <div class="client-home-brand-mark">B</div>
            <div class="client-home-brand-name">Barber<span>Flow</span></div>
          </div>

          <div class="client-home-orbit client-home-orbit--one">
            <div class="client-home-orbit-dot"></div>
          </div>

          <div class="client-home-orbit client-home-orbit--two">
            <div class="client-home-orbit-dot client-home-orbit-dot--alt"></div>
          </div>

          <div class="client-home-chair-wrap">
            ${buildChairSvg()}
            <div class="client-home-chair-glow"></div>
            <div class="client-home-chair-ring"></div>
          </div>
        </div>
      </section>

      <section class="client-home-grid">
        ${renderHomeCard({
          title: 'Próximo agendamento',
          route: 'agendamentos',
          value: nextAppointment.title,
          subtitle: nextAppointment.subtitle,
          rows: [
            {
              name: 'Status',
              fillWidth: '68%',
              fillStyle: '',
              value: 'Agenda',
              valueStyle: '',
            },
          ],
          module: 'Módulo: Agendamentos',
        })}

        ${renderHomeCard({
          title: 'Meu plano',
          route: 'assinatura',
          value: plan.planName,
          subtitle: plan.planStatus,
          rows: [
            {
              name: 'Acompanhar',
              fillWidth: '74%',
              fillStyle: 'background:linear-gradient(90deg,#9c6fff,#4fc3f7)',
              value: 'Plano',
              valueStyle: '',
            },
          ],
          module: 'Módulo: Assinatura',
          moduleStyle: 'color:#d8b4fe;border-color:rgba(156,111,255,.24);background:rgba(156,111,255,.08)',
          valueClass: 'client-home-card-value--compact',
        })}

        ${renderHomeCard({
          title: 'Agendar agora',
          route: 'agendar',
          value: `Olá, ${firstName}`,
          subtitle: 'Escolha serviço, profissional e horário com poucos toques.',
          rows: [
            {
              name: 'Corte',
              fillWidth: '88%',
              fillStyle: '',
              value: 'Rápido',
              valueStyle: '',
            },
            {
              name: 'Barba',
              fillWidth: '64%',
              fillStyle: 'background:linear-gradient(90deg,#ff6b00,#ff3d00)',
              value: 'Prático',
              valueStyle: 'color:#ff6b00;',
            },
          ],
          module: 'Módulo: Agendamento',
        })}

        ${renderHomeCard({
          title: 'Meus dados',
          route: 'dados',
          value: profile?.name || 'Cliente',
          subtitle: 'Telefone editável · E-mail protegido para rastreabilidade',
          rows: [
            {
              name: 'Telefone',
              fillWidth: '72%',
              fillStyle: 'background:linear-gradient(90deg,#00e676,#10b981)',
              value: 'Editar',
              valueStyle: 'color:#00e676;',
            },
            {
              name: 'E-mail',
              fillWidth: '96%',
              fillStyle: 'background:linear-gradient(90deg,#4fc3f7,#0066ff)',
              value: 'Seguro',
              valueStyle: '',
            },
          ],
          module: 'Módulo: Dados',
          valueClass: 'client-home-card-value--compact',
        })}

        ${renderHomeCard({
          title: 'Minhas barbearias',
          route: 'barbearias',
          value: String(barbershopSummary.count),
          subtitle: barbershopSummary.supportText,
          rows: [
            {
              name: 'Atual',
              fillWidth: '82%',
              fillStyle: 'background:linear-gradient(90deg,#4fc3f7,#9c6fff)',
              value: barbershopSummary.activeShopName,
              valueStyle: '',
            },
          ],
          module: 'Módulo: Barbearias',
        })}

        ${renderHomeCard({
          title: 'Pagamentos e suporte',
          route: 'pagamentos',
          value: 'Portal',
          subtitle: 'Acompanhe pagamentos, histórico e canais de atendimento.',
          rows: [
            {
              name: 'Pagamentos',
              fillWidth: '58%',
              fillStyle: '',
              value: 'Financeiro',
              valueStyle: '',
            },
            {
              name: 'Suporte',
              fillWidth: '46%',
              fillStyle: 'background:linear-gradient(90deg,#9c6fff,#6c3fff)',
              value: 'Ajuda',
              valueStyle: 'color:#9c6fff;',
            },
          ],
          module: 'Módulo: Portal',
        })}
      </section>
    </div>
  `;
}

export function initClientHomePage() {}
