import { state } from '../state.js';

function updateBrandPreview() {
  const shopSub = document.getElementById('shopSub');
  const cfgNameDisplay = document.getElementById('cfgNameDisplay');
  const shopNameInput = document.getElementById('shopNameInput');

  if (shopSub) shopSub.textContent = state.shopName;
  if (cfgNameDisplay) cfgNameDisplay.textContent = state.shopBrandName;
  if (shopNameInput && shopNameInput.value !== state.shopName) shopNameInput.value = state.shopName;

  if (state.uploadedLogo) {
    const logoMark = document.getElementById('logoMark');
    if (logoMark) {
      logoMark.innerHTML = `<img src="${state.uploadedLogo}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:9px">`;
    }

    const cfgPreview = document.getElementById('cfgLogoPreview');
    if (cfgPreview) {
      cfgPreview.innerHTML = `<img src="${state.uploadedLogo}" style="width:100%;height:100%;object-fit:cover;border-radius:9px">`;
    }

    ['sidebarAvatar', 'topAvatar'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = `<img src="${state.uploadedLogo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      }
    });
  }
}

export function openModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.add('open');
  updateBrandPreview();
}

export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.remove('open');
}

export function handleLogoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    state.uploadedLogo = ev.target?.result || null;
    const preview = document.getElementById('uploadPreview');
    if (preview && state.uploadedLogo) {
      preview.innerHTML = `<img src="${state.uploadedLogo}" style="width:50px;height:50px;border-radius:8px;object-fit:cover">`;
    }
  };
  reader.readAsDataURL(file);
}

export function saveCustomization() {
  const input = document.getElementById('shopNameInput');
  state.shopName = input?.value?.trim() || 'Barbearia';
  updateBrandPreview();
  closeModal();
}

export function initModal() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-modal]')) {
      openModal();
    }
  });

  const modal = document.getElementById('modal');
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  }

  const uploadZone = document.getElementById('uploadZone');
  const logoInput = document.getElementById('logoFile');
  if (uploadZone && logoInput) {
    uploadZone.addEventListener('click', () => logoInput.click());
    logoInput.addEventListener('change', handleLogoUpload);
  }

  document.querySelectorAll('#colorPicker .color-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('#colorPicker .color-dot').forEach((item) => item.classList.remove('selected'));
      dot.classList.add('selected');
      state.selectedColor = dot.dataset.color || state.selectedColor;
      state.selectedGrad = dot.dataset.grad || state.selectedGrad;
    });
  });

  const cancelButton = document.getElementById('modalCancelBtn');
  const saveButton = document.getElementById('modalSaveBtn');

  if (cancelButton) cancelButton.addEventListener('click', closeModal);
  if (saveButton) saveButton.addEventListener('click', saveCustomization);

  updateBrandPreview();
}
