// ─── PWA Install Banner ───────────────────────────────────────────────────────
// Funciona para: dono (/app) e cliente (/client)
// Aparece somente em mobile, somente após login, somente se não instalado

var PWA_DISMISSED_KEY = 'barberflow.pwa.dismissed';
var PWA_DISMISS_DAYS  = 7;
var deferredPrompt    = null;

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isInstalledPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

function wasDismissedRecently() {
  try {
    var ts = localStorage.getItem(PWA_DISMISSED_KEY);
    if (!ts) return false;
    var diff = Date.now() - Number(ts);
    return diff < PWA_DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

function saveDismissed() {
  try { localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now())); } catch {}
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ── Cria o banner ─────────────────────────────────────────────────────────────
function createBanner() {
  var existing = document.getElementById('pwa-install-banner');
  if (existing) return;

  var ios = isIOS();

  var banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.innerHTML =
    '<div class="pwa-banner-inner">'
    + '<img src="/icons/icon-72x72.png" class="pwa-banner-icon" alt="BarberFlow" />'
    + '<div class="pwa-banner-text">'
    + '<div class="pwa-banner-title">Instale o BarberFlow</div>'
    + '<div class="pwa-banner-sub">'
    + (ios
        ? 'Toque em <strong>Compartilhar</strong> e depois <strong>Adicionar à Tela de Início</strong>'
        : 'Acesse rápido pela tela do seu celular')
    + '</div>'
    + '</div>'
    + '<div class="pwa-banner-actions">'
    + (ios
        ? ''
        : '<button id="pwa-install-btn" class="pwa-btn-install">Instalar</button>')
    + '<button id="pwa-dismiss-btn" class="pwa-btn-dismiss">Agora não</button>'
    + '</div>'
    + '</div>'
    + (ios ? '<div class="pwa-ios-arrow">▼</div>' : '');

  document.body.appendChild(banner);

  // Botão instalar (Android)
  var installBtn = document.getElementById('pwa-install-btn');
  if (installBtn && deferredPrompt) {
    installBtn.addEventListener('click', function() {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(result) {
        if (result.outcome === 'accepted') removeBanner();
        deferredPrompt = null;
      });
    });
  }

  // Botão dispensar
  var dismissBtn = document.getElementById('pwa-dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', function() {
      saveDismissed();
      removeBanner();
    });
  }

  // Animação de entrada
  requestAnimationFrame(function() {
    banner.classList.add('pwa-banner-visible');
  });
}

function removeBanner() {
  var banner = document.getElementById('pwa-install-banner');
  if (!banner) return;
  banner.classList.remove('pwa-banner-visible');
  setTimeout(function() { banner && banner.remove(); }, 350);
}

// ── Captura evento do Chrome (Android) ───────────────────────────────────────
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredPrompt = e;
});

// ── Esconde banner se instalar pelo Chrome ────────────────────────────────────
window.addEventListener('appinstalled', function() {
  removeBanner();
  deferredPrompt = null;
});

// ── Função pública chamada após login ─────────────────────────────────────────
export function initPWABanner() {
  if (!isMobile())           return;
  if (isInstalledPWA())      return;
  if (wasDismissedRecently()) return;

  setTimeout(createBanner, 3000);
}
