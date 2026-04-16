import { meClient, logoutClient } from '/js/client-auth-api.js';

const profileEl = document.getElementById('client-home-profile');

function renderProfile(data) {
  const client = data?.client;

  profileEl.innerHTML = `
    <div><strong>Nome:</strong> ${client?.name || '-'}</div>
    <div><strong>WhatsApp:</strong> ${client?.whatsapp || '-'}</div>
    <div><strong>E-mail:</strong> ${client?.email || '-'}</div>
  `;
}

async function init() {
  try {
    const data = await meClient();
    renderProfile(data);
  } catch (error) {
    logoutClient();
    window.location.href = '/client/login/';
  }
}

document.getElementById('client-logout-btn')?.addEventListener('click', () => {
  logoutClient();
  window.location.href = '/client/login/';
});

init();
