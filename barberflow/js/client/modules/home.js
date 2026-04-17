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

  return `
    <div id="hero">
      <div class="hero-logo">
        <div class="hero-B">B</div>
        <div class="hero-name">Barber<span>Flow</span></div>
      </div>

      <div class="orbit" style="width:340px;height:170px">
        <div class="orbit-dot" style="background:#4fc3f7;color:#4fc3f7"></div>
      </div>

      <div class="orbit orbit-2" style="width:420px;height:210px">
        <div class="orbit-dot" style="background:#9c6fff;color:#9c6fff"></div>
      </div>

      <div class="chair-wrap">
        ${buildChairSvg()}
        <div class="chair-glow"></div>
        <div class="chair-ring"></div>
      </div>

      <div
        class="analytics-card pos-tl dashboard-widget"
        data-client-route="agendamentos"
        role="button"
        tabindex="0"
        title="Abrir meus agendamentos"
      >
        ${renderWidgetTopbar('Próximo agendamento', 'agendamentos')}
        <div class="ac-value">${escapeHtml(nextAppointment.title)}</div>
        <div class="ac-sub">${escapeHtml(nextAppointment.subtitle)}</div>

        <div class="data-row">
          <span class="data-name">Status</span>
          <div class="data-bar">
            <div class="data-fill" style="width:68%"></div>
          </div>
          <span class="data-val">Agenda</span>
        </div>

        <div class="widget-module">Módulo: Agendamentos</div>
      </div>

      <div
        class="analytics-card pos-tr dashboard-widget"
        data-client-route="assinatura"
        role="button"
        tabindex="0"
        title="Abrir meu plano"
      >
        ${renderWidgetTopbar('Meu plano', 'assinatura')}
        <div class="ac-value" style="font-size:18px;line-height:1.3;">${escapeHtml(plan.planName)}</div>
        <div class="ac-sub">${escapeHtml(plan.planStatus)}</div>

        <div class="data-row">
          <span class="data-name">Acompanhar</span>
          <div class="data-bar">
            <div class="data-fill" style="width:74%;background:linear-gradient(90deg,#9c6fff,#4fc3f7)"></div>
          </div>
          <span class="data-val">Plano</span>
        </div>

        <div class="widget-module" style="color:#d8b4fe;border-color:rgba(156,111,255,.24);background:rgba(156,111,255,.08)">
          Módulo: Assinatura
        </div>
      </div>

      <div
        class="analytics-card pos-ml dashboard-widget"
        data-client-route="agendar"
        role="button"
        tabindex="0"
        title="Abrir agendamento"
      >
        ${renderWidgetTopbar('Agendar agora', 'agendar')}
        <div class="ac-value">Olá, ${escapeHtml(firstName)}</div>
        <div class="ac-sub">Escolha serviço, profissional e horário com poucos toques.</div>

        <div class="data-row">
          <span class="data-name">Corte</span>
          <div class="data-bar">
            <div class="data-fill" style="width:88%"></div>
          </div>
          <span class="data-val">Rápido</span>
        </div>

        <div class="data-row">
          <span class="data-name">Barba</span>
          <div class="data-bar">
            <div class="data-fill" style="width:64%;background:linear-gradient(90deg,#ff6b00,#ff3d00)"></div>
          </div>
          <span class="data-val" style="color:#ff6b00;">Prático</span>
        </div>

        <div class="widget-module">Módulo: Agendamento</div>
      </div>

      <div
        class="analytics-card pos-mr dashboard-widget"
        data-client-route="dados"
        role="button"
        tabindex="0"
        title="Abrir meus dados"
      >
        ${renderWidgetTopbar('Meus dados', 'dados')}
        <div class="ac-value" style="font-size:16px;line-height:1.5;">${escapeHtml(profile?.name || 'Cliente')}</div>
        <div class="ac-sub">Telefone editável · E-mail protegido para rastreabilidade</div>

        <div class="data-row">
          <span class="data-name">Telefone</span>
          <div class="data-bar">
            <div class="data-fill" style="width:72%;background:linear-gradient(90deg,#00e676,#10b981)"></div>
          </div>
          <span class="data-val" style="color:#00e676;">Editar</span>
        </div>

        <div class="data-row">
          <span class="data-name">E-mail</span>
          <div class="data-bar">
            <div class="data-fill" style="width:96%;background:linear-gradient(90deg,#4fc3f7,#0066ff)"></div>
          </div>
          <span class="data-val">Seguro</span>
        </div>

        <div class="widget-module">Módulo: Dados</div>
      </div>

      <div
        class="analytics-card pos-bl dashboard-widget"
        data-client-route="barbearias"
        role="button"
        tabindex="0"
        title="Abrir minhas barbearias"
      >
        ${renderWidgetTopbar('Minhas barbearias', 'barbearias')}
        <div class="ac-value">${escapeHtml(String(barbershopSummary.count))}</div>
        <div class="ac-sub">${escapeHtml(barbershopSummary.supportText)}</div>

        <div class="data-row">
          <span class="data-name">Atual</span>
          <div class="data-bar">
            <div class="data-fill" style="width:82%;background:linear-gradient(90deg,#4fc3f7,#9c6fff)"></div>
          </div>
          <span class="data-val">${escapeHtml(barbershopSummary.activeShopName)}</span>
        </div>

        <div class="widget-module">Módulo: Barbearias</div>
      </div>

      <div
        class="analytics-card pos-br dashboard-widget"
        data-client-route="pagamentos"
        role="button"
        tabindex="0"
        title="Abrir pagamentos"
      >
        ${renderWidgetTopbar('Pagamentos e suporte', 'pagamentos')}
        <div class="ac-value">Portal</div>
        <div class="ac-sub">Acompanhe pagamentos, histórico e canais de atendimento.</div>

        <div class="data-row">
          <span class="data-name">Pagamentos</span>
          <div class="data-bar">
            <div class="data-fill" style="width:58%"></div>
          </div>
          <span class="data-val">Financeiro</span>
        </div>

        <div class="data-row">
          <span class="data-name">Suporte</span>
          <div class="data-bar">
            <div class="data-fill" style="width:46%;background:linear-gradient(90deg,#9c6fff,#6c3fff)"></div>
          </div>
          <span class="data-val" style="color:#9c6fff;">Ajuda</span>
        </div>

        <div class="widget-module">Módulo: Portal</div>
      </div>
    </div>
  `;
}

export function initClientHomePage() {}
