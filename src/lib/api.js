const BASE_URL = '/api';

function getHeaders(customHeaders = {}) {
  const token = localStorage.getItem('autodeploy_token');
  const headers = {
    ...customHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth APIs
  async login(username, password) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('autodeploy_token', data.token);
      localStorage.setItem('autodeploy_user', JSON.stringify(data.user));
    }
    return data;
  },

  async register(username, password, fullName, role) {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, fullName, role })
    });
    const data = await res.json();
    if (data.success && data.token) {
      localStorage.setItem('autodeploy_token', data.token);
      localStorage.setItem('autodeploy_user', JSON.stringify(data.user));
    }
    return data;
  },

  async getMe() {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getHeaders()
    });
    return res.json();
  },

  async logout() {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: getHeaders()
      });
    } catch {}
    localStorage.removeItem('autodeploy_token');
    localStorage.removeItem('autodeploy_user');
  },

  // Project & System APIs
  async getStatus() {
    const res = await fetch(`${BASE_URL}/status`, { headers: getHeaders() });
    return res.json();
  },

  async getProjects() {
    const res = await fetch(`${BASE_URL}/projects`, { headers: getHeaders() });
    return res.json();
  },

  async createOrUpdateProject(data) {
    const res = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async deleteProject(repo) {
    const res = await fetch(`${BASE_URL}/projects/${repo}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    return res.json();
  },

  async triggerDeploy(repo, triggerBy, commitMsg) {
    const res = await fetch(`${BASE_URL}/projects/${repo}/deploy`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ triggerBy, commitMsg })
    });
    return res.json();
  },

  async getEnv(repo) {
    const res = await fetch(`${BASE_URL}/projects/${repo}/env`, { headers: getHeaders() });
    return res.json();
  },

  async saveEnv(repo, content) {
    const res = await fetch(`${BASE_URL}/projects/${repo}/env`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ content })
    });
    return res.json();
  },

  async uploadEnvFile(repo, file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/projects/${repo}/env/upload`, {
      method: 'POST',
      headers: getHeaders(),
      body: formData
    });
    return res.json();
  },

  async provisionDb(repo, engine) {
    const res = await fetch(`${BASE_URL}/projects/${repo}/db-provision`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ engine })
    });
    return res.json();
  },

  async testWebhook(repo, commitMsg, author) {
    const res = await fetch(`${BASE_URL}/webhook/test-trigger`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ repo, commitMsg, author })
    });
    return res.json();
  }
};
