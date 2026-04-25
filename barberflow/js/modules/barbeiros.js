import { apiFetch } from '../services/api.js';

// ─── State ────────────────────────────────────────────────────────────────────

const barberThemes = [
  { gradient: 'linear-gradient(135deg,#ffd700,#ff8c00)', color: '#000' },
  { gradient: 'linear-gradient(135deg,#6b6880,#3a3a4a)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#9c6fff,#5530dd)', color: '#fff' },
  { gradient: 'linear-gradient(135deg,#00e676,#00b248)', color: '#001b0b' },
];

const barbeirosState = {
  items: [],
  isLoading: false,
  isLoaded: false,
  modalMode: 'closed',
  activeBarberId: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function setFeedback(id, message, variant = 'neutral') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = variant === 'error' ? '#ff8a8a' : variant === 'success' ? '#00e676' : '#5a6888';
}

function getBarberById(id) {
  return barbeirosState.items.find(b => b.id === id) || null;
}

function getBarberName(barber) {
  const users = barber.users;
  if (Array.isArray(users)) return users[0]?.name || 'Barbeiro';
  return users?.name || 'Barbeiro';
}

function getBarberEmail(barber) {
  const users = barber.users;
  if (Array.isArray(users)) return users[0]?.email || '';
  return users?.email || '';
}

function getBarberAvatarUrl(barber) {
  const users = barber.users;
  if (Array.isArray(users)) return users[0]?.avatar_url || null;
  return users?.avatar_url || null;
}

function getBarberInitials(name) {
  return String(name || 'B').trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || 'BB';
}

function getBarberTheme(index) {
  return barberThemes[index % barberThemes.length];
}

function getSpecialtiesLabel(specialties) {
  if (!Array.isArray(specialties) || !specialties.length) return '—';
  return specialties.join(', ');
}

function getCommissionLabel(barber) {
  if (!barber.commission_type || !barber.commission_value) return '—';
  if (barber.commission_type === 'percentage') return `${barber.commission_value}%`;
  return formatCurrency(barber.commission_value);
}

function getStatusMeta(isAccepting) {
  return isAccepting
    ? { label: '● Disponível',    color: '#00e676', bg: 'rgba(0,230,118,.1)',   border: 'rgba(0,230,118,.18)' }
    : { label: '● Não aceitando', color: '#ff6b81', bg: 'rgba(255,107,129,.1)', border: 'rgba(255,107,129,.18)' };
}

function getWorkingHours(barber) {
  const wh = barber.working_hours || {};
  return {
    start:       wh.start       || '08:00',
    lunch_start: wh.lunch_start || '12:00',
    lunch_end:   wh.lunch_end   || '13:00',
    end:         wh.end         || '19:00',
  };
}

function formatWorkingHoursLabel(barber) {
  const wh = getWorkingHours(barber);
  return `${wh.start} – ${wh.end} (almoço ${wh.lunch_start}–${wh.lunch_end})`;
}

// ─── Compressão de imagem via Canvas ─────────────────────────────────────────

function compressImage(file, maxSize = 600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width  = maxSize;
      } else if (height > maxSize) {
        width  = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => reject(new Error('Não foi possível processar a imagem.'));
    img.src = url;
  });
}

// ─── Avatar render helper ─────────────────────────────────────────────────────

function renderAvatar(barber, index, size) {
  const theme     = getBarberTheme(index);
  const name      = getBarberName(barber);
  const initials  = getBarberInitials(name);
  const avatarUrl = getBarberAvatarUrl(barber);
  const cls       = size === 'lg' ? 'row-avatar barber-avatar barber-avatar--lg' : 'row-avatar barber-avatar';

  if (avatarUrl) {
    return `
      <div class="${cls}" style="background:none;padding:0;overflow:hidden;">
        <img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}"
          style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>
      </div>`;
  }

  return `
    <div class="${cls}" style="background:${theme.gradient};color:${theme.color};">
      ${escapeHtml(initials)}
    </div>`;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderBarberCard(barber, index) {
  const name   = getBarberName(barber);
  const status = getStatusMeta(barber.is_accepting !== false);

  return `
    <button type="button" class="barber-card-button"
      data-barber-id="${escapeHtml(barber.id)}"
      title="Ver detalhes de ${escapeHtml(name)}">
      <div class="card barber-card">
        ${renderAvatar(barber, index, 'md')}
        <div class="barber-name">${escapeHtml(name)}</div>
        <div class="barber-role">Comissão: ${escapeHtml(getCommissionLabel(barber))}</div>
        <div class="barber-stats">
          <div>
            <div class="barber-stat-value barber-stat-value--blue">${escapeHtml(barber.total_cuts || 0)}</div>
            <div class="barber-stat-label">Cortes</div>
          </div>
          <div>
            <div class="barber-stat-value barber-stat-value--purple">${escapeHtml(barber.rating_avg ? Number(barber.rating_avg).toFixed(1) + '★' : '—')}</div>
            <div class="barber-stat-label">Nota</div>
          </div>
          <div>
            <div class="barber-stat-value barber-stat-value--green">${escapeHtml(barber.rating_count || 0)}</div>
            <div class="barber-stat-label">Aval.</div>
          </div>
        </div>
        <div class="barber-status-badge"
          style="background:${status.bg};color:${status.color};border:1px solid ${status.border};">
          ${status.label}
        </div>
      </div>
    </button>`;
}

function renderBarberDetails(barber, index) {
  const avatarUrl = getBarberAvatarUrl(barber);
  const status    = getStatusMeta(barber.is_accepting !== false);
  const email     = getBarberEmail(barber);

  return `
    <div class="barber-modal-body">
      <div class="barber-modal-header">
        ${renderAvatar(barber, index, 'lg')}
        <div>
          <div class="modal-title" style="margin:0;">${escapeHtml(getBarberName(barber))}</div>
          <div class="modal-sub" style="margin-top:4px;">Comissão: ${escapeHtml(getCommissionLabel(barber))}</div>
        </div>
      </div>

      <!-- Upload de foto -->
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px;border-radius:12px;background:rgba(79,195,247,.04);border:1px solid rgba(79,195,247,.10);">
        <div>
          <div class="color-section-label" style="margin-bottom:2px;">📸 Foto do profissional</div>
          <div style="font-size:10px;color:#5a6888;">Qualquer tamanho · o sistema comprime automaticamente</div>
        </div>
        <label for="barber-avatar-input"
          style="min-height:34px;padding:0 14px;border-radius:10px;border:1px solid rgba(79,195,247,.25);background:rgba(79,195,247,.08);color:#7dd3fc;font:inherit;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;">
          ${avatarUrl ? '🔄 Trocar foto' : '📤 Enviar foto'}
        </label>
        <input type="file" id="barber-avatar-input" accept="image/*"
          style="display:none;" data-barber-id="${escapeHtml(barber.id)}"/>
        <div id="barber-avatar-feedback" style="min-height:14px;font-size:10px;color:#5a6888;width:100%;"></div>
      </div>

      <div class="barber-modal-grid">
        <div class="mini-card">
          <div class="mini-lbl">Cortes totais</div>
          <div class="mini-val" style="color:#4fc3f7">${escapeHtml(barber.total_cuts || 0)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Nota média</div>
          <div class="mini-val" style="color:#9c6fff">${escapeHtml(barber.rating_avg ? Number(barber.rating_avg).toFixed(1) + '★' : '—')}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Avaliações</div>
          <div class="mini-val" style="color:#00e676">${escapeHtml(barber.rating_count || 0)}</div>
        </div>
        <div class="mini-card">
          <div class="mini-lbl">Horário</div>
          <div class="mini-val" style="font-size:11px;color:#dce8ff;">${escapeHtml(formatWorkingHoursLabel(barber))}</div>
        </div>
      </div>

      <div class="barber-modal-info">
        <div class="barber-modal-info-row">
          <strong>Especialidades:</strong> ${escapeHtml(getSpecialtiesLabel(barber.specialties))}
        </div>
        ${barber.bio ? `<div class="barber-modal-info-row"><strong>Bio:</strong> ${escapeHtml(barber.bio)}</div>` : ''}
      </div>

      <div>
        <div class="barber-modal-section-title">Disponibilidade</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="button" class="barber-status-action ${barber.is_accepting !== false ? 'is-active' : ''}"
            data-barber-id="${escapeHtml(barber.id)}" data-is-accepting="true"
            style="border:1px solid rgba(0,230,118,.18);background:rgba(0,230,118,.1);color:#00e676;"
            ${barber.is_accepting !== false ? 'disabled' : ''}>
            ● Aceitando
          </button>
          <button type="button" class="barber-status-action ${barber.is_accepting === false ? 'is-active' : ''}"
            data-barber-id="${escapeHtml(barber.id)}" data-is-accepting="false"
            style="border:1px solid rgba(255,107,129,.18);background:rgba(255,107,129,.1);color:#ff6b81;"
            ${barber.is_accepting === false ? 'disabled' : ''}>
            ● Não aceitando
          </button>
        </div>
      </div>

      <!-- Acesso ao App Mobile -->
      <div style="padding:14px;border-radius:12px;background:rgba(156,111,255,.05);border:1px solid rgba(156,111,255,.18);">
        <div class="color-section-label" style="margin-bottom:6px;">📱 Acesso ao App BarberFlow</div>
        <div style="font-size:11px;color:#5a6888;margin-bottom:12px;">
          O barbeiro usa estas credenciais para entrar no app mobile e ver a agenda dele.
          A senha padrão é <strong style="color:#9c6fff;">barberflow123</strong> — recomende que ele troque.
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;">
          <div>
            <div class="color-section-label">E-mail de acesso</div>
            <div style="padding:8px 12px;border-radius:8px;background:#0e1022;border:1px solid #232845;font-size:13px;color:#c0cce8;font-family:monospace;">
              ${escapeHtml(email || '—')}
            </div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;align-items:end;gap:8px;flex-wrap:wrap;">
          <div style="flex:1;">
            <div class="color-section-label">Nova senha</div>
            <input type="password" id="barber-new-password" class="modal-input"
              placeholder="Mínimo 6 caracteres" style="margin:0;"/>
          </div>
          <button type="button" id="barber-reset-password-btn"
            data-barber-id="${escapeHtml(barber.id)}"
            class="btn-save" style="min-height:40px;padding:0 16px;white-space:nowrap;">
            Atualizar senha
          </button>
        </div>
        <div id="barber-password-feedback" style="min-height:16px;font-size:10px;margin-top:6px;color:#5a6888;"></div>
      </div>

      <div id="barber-modal-feedback" class="barber-form-feedback"></div>

      <div class="modal-buttons" style="margin-top:10px;">
        <button type="button" class="btn-cancel" id="barber-modal-close">Fechar</button>
        <button type="button" class="btn-save" id="barber-edit-button" data-barber-id="${escapeHtml(barber.id)}">
          Editar informações
        </button>
      </div>
    </div>`;
}

function renderBarberForm(mode, barber = null) {
  const isEdit = mode === 'edit';
  const b  = barber || {};
  const wh = isEdit ? getWorkingHours(barber) : { start: '08:00', lunch_start: '12:00', lunch_end: '13:00', end: '19:00' };

  return `
    <div class="barber-modal-body">
      <div>
        <div class="modal-title" style="margin:0;">${isEdit ? 'Editar barbeiro' : 'Novo barbeiro'}</div>
        <div class="modal-sub" style="margin-top:4px;">${isEdit ? 'Atualize os dados do profissional.' : 'Preencha os dados para adicionar um barbeiro.'}</div>
      </div>

      <form id="barber-form" class="barber-form">
        <div class="barber-form-grid">
          ${!isEdit ? `
            <div>
              <div class="color-section-label">Nome</div>
              <input class="modal-input" name="name" type="text" placeholder="Nome do barbeiro" />
            </div>
            <div>
              <div class="color-section-label">E-mail</div>
              <input class="modal-input" name="email" type="email" placeholder="email@dominio.com" />
            </div>
            <div>
              <div class="color-section-label">Telefone</div>
              <input class="modal-input" name="phone" type="text" placeholder="(11) 99999-9999" />
            </div>
          ` : ''}
          <div>
            <div class="color-section-label">Tipo de comissão</div>
            <select class="modal-input" name="commission_type">
              <option value="percentage" ${b.commission_type === 'percentage' ? 'selected' : ''}>Percentual (%)</option>
              <option value="fixed" ${b.commission_type === 'fixed' ? 'selected' : ''}>Valor fixo (R$)</option>
            </select>
          </div>
          <div>
            <div class="color-section-label">Valor da comissão</div>
            <input class="modal-input" name="commission_value" type="number" min="0" step="0.01"
              value="${escapeHtml(b.commission_value ?? '')}" placeholder="Ex: 40" />
          </div>
          <div>
            <div class="color-section-label">Aceitando agendamentos</div>
            <select class="modal-input" name="is_accepting">
              <option value="true" ${b.is_accepting !== false ? 'selected' : ''}>Sim</option>
              <option value="false" ${b.is_accepting === false ? 'selected' : ''}>Não</option>
            </select>
          </div>
        </div>

        <div>
          <div class="color-section-label">Especialidades (separe por vírgula)</div>
          <input class="modal-input" name="specialties"
            value="${escapeHtml(Array.isArray(b.specialties) ? b.specialties.join(', ') : '')}"
            placeholder="Ex: Fade, Barba, Corte social" />
        </div>

        <div>
          <div class="color-section-label">Bio</div>
          <textarea class="modal-input barber-textarea" name="bio"
            placeholder="Breve descrição do profissional">${escapeHtml(b.bio || '')}</textarea>
        </div>

        <!-- Horário de trabalho -->
        <div style="padding:12px 14px;border-radius:12px;background:rgba(79,195,247,.04);border:1px solid rgba(79,195,247,.10);display:grid;gap:12px;">
          <div>
            <div class="color-section-label" style="margin-bottom:2px;">🕐 Horário de trabalho</div>
            <div style="font-size:10px;color:#5a6888;">Define quais slots aparecem para o cliente ao agendar</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div>
              <div class="color-section-label">Início</div>
              <input class="modal-input" name="wh_start" type="time"
                value="${escapeHtml(wh.start)}" style="margin:0;" />
            </div>
            <div>
              <div class="color-section-label">Término</div>
              <input class="modal-input" name="wh_end" type="time"
                value="${escapeHtml(wh.end)}" style="margin:0;" />
            </div>
            <div>
              <div class="color-section-label">Início do almoço</div>
              <input class="modal-input" name="wh_lunch_start" type="time"
                value="${escapeHtml(wh.lunch_start)}" style="margin:0;" />
            </div>
            <div>
              <div class="color-section-label">Fim do almoço</div>
              <input class="modal-input" name="wh_lunch_end" type="time"
                value="${escapeHtml(wh.lunch_end)}" style="margin:0;" />
            </div>
          </div>
        </div>

        ${!isEdit ? `
          <!-- Senha de acesso ao app — apenas no cadastro -->
          <div style="padding:12px 14px;border-radius:12px;background:rgba(156,111,255,.05);border:1px solid rgba(156,111,255,.18);display:grid;gap:10px;">
            <div>
              <div class="color-section-label" style="margin-bottom:2px;">📱 Senha de acesso ao App</div>
              <div style="font-size:10px;color:#5a6888;">
                O barbeiro usará o e-mail acima + esta senha para entrar no app mobile.
                Se deixar em branco, a senha padrão será <strong style="color:#9c6fff;">barberflow123</strong>.
              </div>
            </div>
            <div>
              <div class="color-section-label">Senha inicial (opcional)</div>
              <input class="modal-input" name="password" type="password"
                placeholder="Deixe em branco para usar barberflow123" style="margin:0;" />
            </div>
          </div>
        ` : ''}

        <div id="barber-form-feedback" class="barber-form-feedback"></div>

        <div class="modal-buttons" style="margin-top:10px;">
          <button type="button" class="btn-cancel" id="${isEdit ? 'barber-form-back' : 'barber-form-cancel'}">
            ${isEdit ? 'Voltar' : 'Cancelar'}
          </button>
          <button type="submit" class="btn-save">${isEdit ? 'Salvar alterações' : 'Cadastrar barbeiro'}</button>
        </div>
      </form>
    </div>`;
}

// ─── Modal control ────────────────────────────────────────────────────────────

function getBarberIndex(id) {
  return barbeirosState.items.findIndex(b => b.id === id);
}

function openBarberModal(id) {
  barbeirosState.activeBarberId = id;
  barbeirosState.modalMode = 'view';
  renderBarberModal();
}

function openCreateBarberModal() {
  barbeirosState.activeBarberId = null;
  barbeirosState.modalMode = 'create';
  renderBarberModal();
}

function openEditBarberModal(id) {
  barbeirosState.activeBarberId = id;
  barbeirosState.modalMode = 'edit';
  renderBarberModal();
}

function closeBarberModal() {
  const modal   = document.getElementById('barber-details-modal');
  const content = document.getElementById('barber-details-content');
  if (!modal) return;
  barbeirosState.modalMode      = 'closed';
  barbeirosState.activeBarberId = null;
  modal.classList.remove('open');
  modal.style.display = 'none';
  if (content) content.innerHTML = '';
}

function renderBarberModal() {
  const modal   = document.getElementById('barber-details-modal');
  const content = document.getElementById('barber-details-content');
  if (!modal || !content) return;

  if (barbeirosState.modalMode === 'closed') {
    modal.style.display = 'none';
    modal.classList.remove('open');
    content.innerHTML = '';
    return;
  }

  const barber = barbeirosState.activeBarberId ? getBarberById(barbeirosState.activeBarberId) : null;
  const index  = barbeirosState.activeBarberId ? getBarberIndex(barbeirosState.activeBarberId) : 0;

  if (barbeirosState.modalMode === 'view') {
    if (!barber) { closeBarberModal(); return; }
    content.innerHTML = renderBarberDetails(barber, index);
  }
  if (barbeirosState.modalMode === 'edit') {
    if (!barber) { closeBarberModal(); return; }
    content.innerHTML = renderBarberForm('edit', barber);
  }
  if (barbeirosState.modalMode === 'create') {
    content.innerHTML = renderBarberForm('create');
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
  bindBarberModalEvents();
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function loadBarbeirosData() {
  barbeirosState.isLoading = true;
  rerenderBarbeirosGrid();
  try {
    const data = await apiFetch('/api/barbers');
    barbeirosState.items    = Array.isArray(data) ? data : [];
    barbeirosState.isLoaded = true;
  } catch (error) {
    console.error('Erro ao carregar barbeiros:', error);
  } finally {
    barbeirosState.isLoading = false;
    rerenderBarbeirosGrid();
  }
}

async function handleAvatarUpload(file, barberId) {
  const fb = document.getElementById('barber-avatar-feedback');
  if (!file || !barberId) return;

  try {
    if (fb) { fb.textContent = 'Processando imagem...'; fb.style.color = '#5a6888'; }
    const compressedBase64 = await compressImage(file);
    if (fb) { fb.textContent = 'Enviando foto...'; fb.style.color = '#5a6888'; }

    await apiFetch(`/api/barbers/${barberId}/avatar`, {
      method: 'POST',
      body: JSON.stringify({ imageBase64: compressedBase64, mimeType: 'image/jpeg' }),
    });

    if (fb) { fb.textContent = '✓ Foto atualizada!'; fb.style.color = '#00e676'; }
    await loadBarbeirosData();
    if (barbeirosState.activeBarberId) openBarberModal(barbeirosState.activeBarberId);
  } catch (error) {
    if (fb) {
      fb.textContent = error instanceof Error ? error.message : 'Erro ao enviar foto.';
      fb.style.color = '#ff8a8a';
    }
  }
}

async function handleResetPassword(barberId) {
  const input = document.getElementById('barber-new-password');
  const password = String(input?.value || '').trim();

  if (!password || password.length < 6) {
    setFeedback('barber-password-feedback', 'A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  const btn = document.getElementById('barber-reset-password-btn');
  if (btn) btn.disabled = true;
  setFeedback('barber-password-feedback', 'Atualizando senha...', 'neutral');

  try {
    await apiFetch(`/api/barbers/${barberId}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
    setFeedback('barber-password-feedback', '✓ Senha atualizada com sucesso!', 'success');
    if (input) input.value = '';
  } catch (error) {
    setFeedback('barber-password-feedback', error instanceof Error ? error.message : 'Erro ao atualizar senha.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleCreateBarber(event) {
  event.preventDefault();
  const form     = document.getElementById('barber-form');
  const formData = new FormData(form);
  const btn      = form.querySelector('button[type="submit"]');

  const name  = String(formData.get('name')  || '').trim();
  const email = String(formData.get('email') || '').trim();

  if (!name)  { setFeedback('barber-form-feedback', 'Informe o nome do barbeiro.', 'error'); return; }
  if (!email) { setFeedback('barber-form-feedback', 'Informe o e-mail.', 'error'); return; }

  const specialties = String(formData.get('specialties') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const working_hours = {
    start:       String(formData.get('wh_start')       || '08:00'),
    end:         String(formData.get('wh_end')         || '19:00'),
    lunch_start: String(formData.get('wh_lunch_start') || '12:00'),
    lunch_end:   String(formData.get('wh_lunch_end')   || '13:00'),
    slot_interval: 30,
  };

  const password = String(formData.get('password') || '').trim() || undefined;

  try {
    if (btn) btn.disabled = true;
    setFeedback('barber-form-feedback', 'Salvando...', 'neutral');

    const result = await apiFetch('/api/barbers', {
      method: 'POST',
      body: JSON.stringify({
        name, email,
        phone:            String(formData.get('phone') || '').trim() || null,
        commission_type:  String(formData.get('commission_type')  || 'percentage'),
        commission_value: Number(formData.get('commission_value') || 0),
        specialties,
        bio:          String(formData.get('bio') || '').trim() || null,
        is_accepting: String(formData.get('is_accepting')) === 'true',
        working_hours,
        password,
      }),
    });

    // Mostra a senha padrão se não foi definida uma senha personalizada
    if (result?.temp_password) {
      setFeedback('barber-form-feedback',
        `✓ Barbeiro cadastrado! Senha de acesso ao app: ${result.temp_password}`, 'success');
      setTimeout(() => { closeBarberModal(); loadBarbeirosData(); }, 3000);
    } else {
      closeBarberModal();
      await loadBarbeirosData();
    }
  } catch (error) {
    setFeedback('barber-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleEditBarber(event) {
  event.preventDefault();
  const form     = document.getElementById('barber-form');
  const formData = new FormData(form);
  const btn      = form.querySelector('button[type="submit"]');
  const barberId = barbeirosState.activeBarberId;

  const specialties = String(formData.get('specialties') || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  const working_hours = {
    start:       String(formData.get('wh_start')       || '08:00'),
    end:         String(formData.get('wh_end')         || '19:00'),
    lunch_start: String(formData.get('wh_lunch_start') || '12:00'),
    lunch_end:   String(formData.get('wh_lunch_end')   || '13:00'),
    slot_interval: 30,
  };

  try {
    if (btn) btn.disabled = true;
    setFeedback('barber-form-feedback', 'Salvando...', 'neutral');

    await apiFetch(`/api/barbers/${barberId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        commission_type:  String(formData.get('commission_type')  || 'percentage'),
        commission_value: Number(formData.get('commission_value') || 0),
        specialties,
        bio:          String(formData.get('bio') || '').trim() || null,
        is_accepting: String(formData.get('is_accepting')) === 'true',
        working_hours,
      }),
    });

    closeBarberModal();
    await loadBarbeirosData();
  } catch (error) {
    setFeedback('barber-form-feedback', error instanceof Error ? error.message : 'Erro ao salvar.', 'error');
    if (btn) btn.disabled = false;
  }
}

async function handleToggleAccepting(barberId, isAccepting) {
  try {
    setFeedback('barber-modal-feedback', 'Atualizando...', 'neutral');
    await apiFetch(`/api/barbers/${barberId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_accepting: isAccepting }),
    });
    await loadBarbeirosData();
    openBarberModal(barberId);
  } catch (error) {
    setFeedback('barber-modal-feedback', error instanceof Error ? error.message : 'Erro ao atualizar.', 'error');
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────

function bindBarberModalEvents() {
  document.getElementById('barber-modal-close')?.addEventListener('click', closeBarberModal);
  document.getElementById('barber-form-cancel')?.addEventListener('click', closeBarberModal);

  document.getElementById('barber-form-back')?.addEventListener('click', () => {
    if (barbeirosState.activeBarberId) openBarberModal(barbeirosState.activeBarberId);
  });

  document.getElementById('barber-edit-button')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.barberId;
    if (id) openEditBarberModal(id);
  });

  document.querySelectorAll('.barber-status-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const id          = btn.dataset.barberId;
      const isAccepting = btn.dataset.isAccepting === 'true';
      if (id) handleToggleAccepting(id, isAccepting);
    });
  });

  document.getElementById('barber-avatar-input')?.addEventListener('change', (e) => {
    const file     = e.target.files?.[0];
    const barberId = e.target.dataset.barberId;
    if (file && barberId) handleAvatarUpload(file, barberId);
  });

  // Reset de senha na tela de detalhes
  document.getElementById('barber-reset-password-btn')?.addEventListener('click', (e) => {
    const barberId = e.currentTarget.dataset.barberId;
    if (barberId) handleResetPassword(barberId);
  });

  const form = document.getElementById('barber-form');
  if (form) {
    if (barbeirosState.modalMode === 'create') {
      form.addEventListener('submit', handleCreateBarber);
    } else if (barbeirosState.modalMode === 'edit') {
      form.addEventListener('submit', handleEditBarber);
    }
  }
}

function bindBarbeirosGridEvents() {
  document.querySelectorAll('.barber-card-button[data-barber-id]').forEach(btn => {
    btn.addEventListener('click', () => openBarberModal(btn.dataset.barberId));
  });
}

function bindBarbeirosStaticEvents() {
  document.getElementById('barber-new-button')?.addEventListener('click', openCreateBarberModal);
  document.getElementById('barber-details-modal')?.addEventListener('click', (e) => {
    if (e.target?.id === 'barber-details-modal') closeBarberModal();
  });
}

function rerenderBarbeirosGrid() {
  const grid = document.getElementById('barbeiros-grid');
  if (!grid) return;

  if (barbeirosState.isLoading) {
    grid.innerHTML = `<div class="finance-empty" style="grid-column:1/-1;">Carregando barbeiros...</div>`;
    return;
  }

  grid.innerHTML = barbeirosState.items.length
    ? barbeirosState.items.map((b, i) => renderBarberCard(b, i)).join('')
    : `<div class="finance-empty" style="grid-column:1/-1;">Nenhum barbeiro cadastrado.</div>`;

  bindBarbeirosGridEvents();
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function renderBarbeiros() {
  return /* html */ `
<section class="page-shell page--barbeiros">
  <div class="barbeiros-topbar">
    <div>
      <div class="card-title">Time de barbeiros</div>
      <div class="barbeiros-subtitle">Visualize desempenho e atualize a disponibilidade da equipe.</div>
    </div>
    <button type="button" class="btn-primary-gradient" id="barber-new-button">+ Novo barbeiro</button>
  </div>

  <div class="grid-3" id="barbeiros-grid">
    <div class="finance-empty" style="grid-column:1/-1;">Carregando...</div>
  </div>

  <div id="barber-details-modal" class="modal-overlay" style="display:none;">
    <div class="modal" style="width:min(92vw, 560px);">
      <div id="barber-details-content"></div>
    </div>
  </div>
</section>
  `;
}

export function initBarbeirosPage() {
  bindBarbeirosStaticEvents();
  loadBarbeirosData();
}
