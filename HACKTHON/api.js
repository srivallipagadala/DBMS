const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem('smartbus_token');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export function toErrorMessage(error) {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
