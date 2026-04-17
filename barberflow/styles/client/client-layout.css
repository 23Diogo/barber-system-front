body.client-area {
  margin: 0;
  min-height: 100vh;
  font-family: 'DM Sans', sans-serif;
  color: #e8f0fe;
  background:
    radial-gradient(circle at 50% 18%, rgba(255, 90, 31, 0.14), transparent 16%),
    radial-gradient(circle at 50% 18%, rgba(79, 195, 247, 0.08), transparent 28%),
    radial-gradient(circle at 0% 0%, rgba(79, 195, 247, 0.16), transparent 22%),
    radial-gradient(circle at 100% 100%, rgba(156, 111, 255, 0.18), transparent 24%),
    linear-gradient(180deg, #050816 0%, #090d1d 100%);
}

body.client-area::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(79, 195, 247, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79, 195, 247, 0.06) 1px, transparent 1px);
  background-size: 52px 52px;
  opacity: 0.22;
}

.client-shell {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.client-bg-orb {
  position: fixed;
  border-radius: 999px;
  filter: blur(90px);
  opacity: 0.22;
  pointer-events: none;
}

.client-bg-orb--one {
  width: 320px;
  height: 320px;
  top: -80px;
  left: -60px;
  background: rgba(79, 195, 247, 0.5);
}

.client-bg-orb--two {
  width: 360px;
  height: 360px;
  right: -100px;
  bottom: -120px;
  background: rgba(156, 111, 255, 0.42);
}

.client-header {
  position: relative;
  z-index: 2;
  width: min(1120px, calc(100% - 32px));
  margin: 24px auto 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.client-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.client-brand-mark {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  font-family: 'Orbitron', sans-serif;
  font-size: 30px;
  font-weight: 900;
  color: #fff;
  background: linear-gradient(180deg, #ff8a3d 0%, #ff5a1f 55%, #db3d00 100%);
  box-shadow:
    0 0 22px rgba(255, 90, 31, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  animation: clientBrandPulse 2.2s ease-in-out infinite;
}

@keyframes clientBrandPulse {
  0%, 100% {
    transform: translateY(0);
    box-shadow:
      0 0 22px rgba(255, 90, 31, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }

  50% {
    transform: translateY(-2px);
    box-shadow:
      0 0 34px rgba(255, 90, 31, 0.38),
      0 0 55px rgba(79, 195, 247, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }
}

.client-brand-title {
  font-family: 'Orbitron', sans-serif;
  font-size: 24px;
  font-weight: 900;
  color: #f5f9ff;
  line-height: 1;
}

.client-brand-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #8fa3c7;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.client-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.client-header-btn {
  min-height: 42px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid rgba(79, 195, 247, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: #dce8ff;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.18s ease;
}

.client-header-btn:hover {
  border-color: rgba(79, 195, 247, 0.36);
  background: rgba(79, 195, 247, 0.08);
}

.client-header-btn--danger:hover {
  border-color: rgba(255, 99, 132, 0.35);
  background: rgba(255, 23, 68, 0.1);
}

.client-main {
  position: relative;
  z-index: 2;
  flex: 1;
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  display: grid;
  place-items: center;
  padding: 40px 0 56px;
}

.client-card {
  width: min(560px, 100%);
  background: rgba(7, 10, 25, 0.88);
  border: 1px solid rgba(79, 195, 247, 0.12);
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(18px);
}

.client-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.client-title {
  margin: 0;
  font-size: 38px;
  font-weight: 800;
  color: #fff;
  line-height: 1.05;
}

.client-subtitle {
  margin: 10px 0 0;
  color: #8fa3c7;
  line-height: 1.6;
  font-size: 15px;
}

.client-user-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(79, 195, 247, 0.1);
  border: 1px solid rgba(79, 195, 247, 0.16);
  color: #7dd3fc;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.client-feedback {
  min-height: 22px;
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.5;
  color: #7f92b6;
}

.client-feedback.is-success {
  color: #00e676;
}

.client-feedback.is-error {
  color: #ff7b91;
}

@media (max-width: 720px) {
  .client-header {
    width: calc(100% - 24px);
    margin-top: 18px;
  }

  .client-main {
    width: calc(100% - 24px);
    padding: 24px 0 36px;
  }

  .client-card {
    padding: 22px 18px;
    border-radius: 20px;
  }

  .client-card-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .client-title {
    font-size: 30px;
  }

  .client-brand-title {
    font-size: 20px;
  }

  .client-brand-mark {
    width: 50px;
    height: 50px;
    font-size: 26px;
  }
}
