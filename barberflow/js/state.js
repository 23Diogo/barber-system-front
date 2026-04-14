export const state = {
  currentPage: 'dash',
  uploadedLogo: null,
  selectedColor: '#4fc3f7',
  selectedGrad: 'linear-gradient(135deg,#4fc3f7,#0066ff)',
  darkMode: true,
  shopBrandName: 'BarberFlow',
  shopName: 'Barbearia do Diogo',
  auth: {
    isAuthenticated: false,
    apiBaseUrl: '',
    token: '',
    devEmail: '',
    user: null,
    barbershop: null,
    hydrated: false,
  },
};

export function setCurrentPage(pageId) {
  state.currentPage = pageId;
}

export function setAuthState(partial = {}) {
  state.auth = {
    ...state.auth,
    ...partial,
  };
}

export function resetAuthState() {
  state.auth = {
    isAuthenticated: false,
    apiBaseUrl: '',
    token: '',
    devEmail: '',
    user: null,
    barbershop: null,
    hydrated: true,
  };
}
