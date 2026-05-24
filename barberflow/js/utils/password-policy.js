const COMMON_PASSWORDS = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '111111',
  '000000',
  '654321',
  '112233',
  '102030',
  'abc123',
  'abc12345',
  'qwerty',
  'qwerty123',
  'password',
  'password1',
  'password123',
  'senha',
  'senha123',
  'senha1234',
  'barberflow',
  'barberflow123',
  'bbarberflow',
  'barbearia',
  'barbearia123',
  'admin',
  'admin123',
]);

const COMMON_SEQUENCES = [
  '012345',
  '123456',
  '234567',
  '345678',
  '456789',
  '987654',
  '876543',
  '765432',
  '654321',
  'abcdef',
  'qwerty',
];

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function getEmailUser(email) {
  return normalize(email).split('@')[0] || '';
}

function getNameParts(name) {
  return normalize(name)
    .split(/\s+/)
    .map(part => part.trim())
    .filter(part => part.length >= 4);
}

function containsPersonalInfo(password, context = {}) {
  const lowerPassword = normalize(password);
  const emailUser = getEmailUser(context.email);
  const phoneDigits = digitsOnly(context.phone || context.whatsapp);
  const nameParts = getNameParts(context.name);

  if (emailUser && emailUser.length >= 4 && lowerPassword.includes(emailUser)) return true;

  if (phoneDigits && phoneDigits.length >= 6) {
    const lastSix = phoneDigits.slice(-6);
    if (lastSix && lowerPassword.includes(lastSix)) return true;
  }

  return nameParts.some(part => lowerPassword.includes(part));
}

export function validateStrongPassword(password, context = {}) {
  const raw = String(password ?? '');
  const value = raw.trim();
  const normalized = normalize(value);

  const checks = {
    minLength: value.length >= 8,
    hasLetter: /[A-Za-zÀ-ÿ]/.test(value),
    hasNumber: /\d/.test(value),
    notCommon: !COMMON_PASSWORDS.has(normalized) && !COMMON_SEQUENCES.some(sequence => normalized.includes(sequence)),
    notPersonal: !containsPersonalInfo(value, context),
    notRepeated: !/(.)\1{5,}/.test(normalized),
  };

  const score = Object.values(checks).filter(Boolean).length;
  const level = score >= 6 ? 'strong' : score >= 4 ? 'medium' : 'weak';

  let message = 'Senha segura.';
  if (!checks.minLength) message = 'A senha deve ter pelo menos 8 caracteres.';
  else if (!checks.hasLetter) message = 'A senha deve conter pelo menos uma letra.';
  else if (!checks.hasNumber) message = 'A senha deve conter pelo menos um número.';
  else if (!checks.notCommon) message = 'Essa senha é muito comum. Escolha uma senha mais segura.';
  else if (!checks.notPersonal) message = 'A senha não deve conter seu nome, e-mail ou telefone.';
  else if (!checks.notRepeated) message = 'Evite sequências repetidas como 111111 ou aaaaaa.';

  return { ok: score === 6, message, score, level, checks };
}

export function getPasswordChecklist(password, context = {}) {
  const result = validateStrongPassword(password, context);

  return [
    { key: 'minLength', label: '8 caracteres ou mais', ok: result.checks.minLength },
    { key: 'hasLetter', label: 'Pelo menos uma letra', ok: result.checks.hasLetter },
    { key: 'hasNumber', label: 'Pelo menos um número', ok: result.checks.hasNumber },
    { key: 'notCommon', label: 'Não usar senha comum', ok: result.checks.notCommon },
    { key: 'notPersonal', label: 'Não conter nome, e-mail ou telefone', ok: result.checks.notPersonal },
  ];
}

export function getPasswordStrengthLabel(password, context = {}) {
  const result = validateStrongPassword(password, context);
  if (!String(password || '')) return 'Digite uma senha';
  if (result.level === 'strong') return 'Senha forte';
  if (result.level === 'medium') return 'Senha média';
  return 'Senha fraca';
}
