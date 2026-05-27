function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function getNameParts(name) {
  return normalize(name)
    .split(/\s+/)
    .filter((part) => part.length >= 3);
}

function getEmailParts(email) {
  const normalized = normalize(email);
  const [localPart = ''] = normalized.split('@');

  return localPart
    .split(/[._\-+]+/)
    .filter((part) => part.length >= 3);
}

function containsPersonalData(password, context = {}) {
  const normalizedPassword = normalize(password);
  const passwordDigits = onlyDigits(password);

  const parts = [
    ...getNameParts(context.name),
    ...getEmailParts(context.email),
  ];

  const phoneDigits = onlyDigits(context.whatsapp || context.phone);

  if (phoneDigits.length >= 6 && passwordDigits.includes(phoneDigits.slice(-6))) {
    return true;
  }

  return parts.some((part) => normalizedPassword.includes(part));
}

export function getPasswordChecklist(password = '', context = {}) {
  const value = String(password || '');

  return [
    {
      key: 'length',
      ok: value.length >= 8,
      label: 'Mínimo de 8 caracteres',
    },
    {
      key: 'lower',
      ok: /[a-z]/.test(value),
      label: 'Pelo menos uma letra minúscula',
    },
    {
      key: 'upper',
      ok: /[A-Z]/.test(value),
      label: 'Pelo menos uma letra maiúscula',
    },
    {
      key: 'number',
      ok: /\d/.test(value),
      label: 'Pelo menos um número',
    },
    {
      key: 'special',
      ok: /[^A-Za-z0-9]/.test(value),
      label: 'Pelo menos um caractere especial',
    },
    {
      key: 'personal',
      ok: value.length > 0 && !containsPersonalData(value, context),
      label: 'Não usar nome, e-mail ou telefone',
    },
  ];
}

export function validateStrongPassword(password = '', context = {}) {
  const checklist = getPasswordChecklist(password, context);
  const missing = checklist.filter((item) => !item.ok);

  return {
    valid: missing.length === 0,
    checklist,
    missing,
    message: missing.length
      ? `A senha ainda não atende aos requisitos: ${missing.map((item) => item.label).join(', ')}.`
      : '',
  };
}

export function getPasswordStrengthLabel(password = '', context = {}) {
  const checklist = getPasswordChecklist(password, context);
  const score = checklist.filter((item) => item.ok).length;

  if (!password) return 'Não informada';
  if (score <= 2) return 'Fraca';
  if (score <= 4) return 'Média';
  if (score <= 5) return 'Boa';

  return 'Forte';
}

export function escapePasswordHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderClientPasswordChecklist(password = '', context = {}) {
  const items = getPasswordChecklist(password, context);
  const label = getPasswordStrengthLabel(password, context);

  return `
    <div
      style="
        margin-top:10px;
        border:1px solid rgba(79,195,247,.16);
        border-radius:14px;
        background:rgba(79,195,247,.04);
        padding:12px;
        display:grid;
        gap:8px;
      "
    >
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
        <span style="font-size:12px;color:#8fa3c7;font-weight:700;">Segurança da senha</span>
        <strong style="font-size:12px;color:#7dd3fc;">${escapePasswordHtml(label)}</strong>
      </div>

      <div style="display:grid;gap:6px;">
        ${items.map((item) => `
          <div
            style="
              display:flex;
              gap:8px;
              align-items:center;
              font-size:12px;
              color:${item.ok ? '#00e676' : '#8fa3c7'};
            "
          >
            <span
              style="
                width:18px;
                height:18px;
                border-radius:999px;
                display:inline-flex;
                align-items:center;
                justify-content:center;
                flex-shrink:0;
                border:1px solid ${item.ok ? 'rgba(0,230,118,.28)' : 'rgba(143,163,199,.20)'};
                background:${item.ok ? 'rgba(0,230,118,.10)' : 'rgba(255,255,255,.03)'};
                font-size:11px;
              "
            >
              ${item.ok ? '✓' : '•'}
            </span>
            <span>${escapePasswordHtml(item.label)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
