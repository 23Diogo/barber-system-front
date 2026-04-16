import { getClientProfile } from '../../services/client-auth.js';

export function renderClientHome() {
  const profile = getClientProfile();

  return `
    <div class="client-home">
      <div class="client-home-card">
        <div class="client-home-title">Olá, ${profile?.name || 'Cliente'} 👋</div>
        <div class="client-home-text">
          Sua área do cliente está pronta. Agora vamos ligar:
          agendamento avulso, planos, assinatura e pagamentos.
        </div>
      </div>

      <div class="client-home-actions">
        <button type="button" class="client-primary-btn client-disabled-btn" disabled>Agendar horário</button>
        <button type="button" class="client-secondary-btn client-disabled-btn" disabled>Assinar plano</button>
        <button type="button" class="client-secondary-btn client-disabled-btn" disabled>Minha assinatura</button>
      </div>
    </div>
  `;
}

export function initClientHomePage() {}
