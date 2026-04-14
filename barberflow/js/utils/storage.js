export function getJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

export function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getItem(key, fallback = null) {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value;
}

export function setItem(key, value) {
  localStorage.setItem(key, value);
}

export function removeItem(key) {
  localStorage.removeItem(key);
}
