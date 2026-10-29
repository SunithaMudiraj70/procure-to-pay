import { useSessionStore } from '../store/useSessionStore.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message || `API error with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'UNKNOWN_ERROR';
    this.details = details;
  }
}

const buildUrl = (endpoint, params = {}) => {
  const url = new URL(
    endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
    window.location.origin
  );

  // If path doesn't already start with API_BASE_URL, prepend it
  if (!url.pathname.startsWith(API_BASE_URL)) {
    url.pathname = `${API_BASE_URL}${url.pathname}`.replace(/\/+/g, '/');
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, String(value));
    }
  });

  return url.toString();
};

export const apiFetch = async (endpoint, options = {}) => {
  const { params, headers = {}, body, ...customConfig } = options;

  const currentUser = useSessionStore.getState().currentUser;
  const authHeaders = {};
  if (currentUser?.id) {
    authHeaders['X-User-Id'] = currentUser.id;
  }

  const config = {
    ...customConfig,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers
    }
  };

  if (body) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const url = buildUrl(endpoint, params);
  const response = await fetch(url, config);

  // Handle CSV/blob responses
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv') || contentType.includes('application/octet-stream')) {
    if (!response.ok) {
      throw new ApiError(response.status, 'DOWNLOAD_FAILED', 'Failed to download report file');
    }
    return response.blob();
  }

  const rawText = await response.text();
  let json = null;
  try {
    json = rawText ? JSON.parse(rawText) : null;
  } catch {
    json = { message: rawText };
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      json?.code || `HTTP_${response.status}`,
      json?.message || `Request failed (${response.status})`,
      json?.details || json?.errors || null
    );
  }

  return json;
};

export const api = {
  get: (endpoint, params = {}, options = {}) => apiFetch(endpoint, { method: 'GET', params, ...options }),
  post: (endpoint, body, options = {}) => apiFetch(endpoint, { method: 'POST', body, ...options }),
  put: (endpoint, body, options = {}) => apiFetch(endpoint, { method: 'PUT', body, ...options }),
  delete: (endpoint, options = {}) => apiFetch(endpoint, { method: 'DELETE', ...options }),
  download: async (endpoint, params = {}) => {
    const blob = await apiFetch(endpoint, { method: 'GET', params });
    return blob;
  }
};

export default api;
