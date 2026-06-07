const authTokenKey = 'procurex.authToken';

export function getStoredAuthToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(authTokenKey);
}

export function storeAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(authTokenKey, token);
}

export function clearStoredAuthToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(authTokenKey);
}
