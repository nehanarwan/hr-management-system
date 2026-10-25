
const api = {
  token() {
    return localStorage.getItem('hr_token');
  },

  setSession(token, user) {
    localStorage.setItem('hr_token', token);
    localStorage.setItem('hr_user', JSON.stringify(user));
  },

  user() {
    try {
      return JSON.parse(localStorage.getItem('hr_user'));
    } catch (err) {
      return null;
    }
  },

  clear() {
    localStorage.removeItem('hr_token');
    localStorage.removeItem('hr_user');
  },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = api.token();
    if (token) headers.Authorization = 'Bearer ' + token;

    const response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 401 && !path.includes('/auth/login')) {
      api.clear();
      window.location.href = '/index.html';
      throw new Error('Your session has expired');
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload.errors && payload.errors.length
        ? payload.errors.map((e) => e.message).join(', ')
        : payload.message || 'Something went wrong';
      throw new Error(message);
    }

    return payload;
  },

  get(path) { return api.request('GET', path); },
  post(path, body) { return api.request('POST', path, body); },
  patch(path, body) { return api.request('PATCH', path, body); },
  del(path) { return api.request('DELETE', path); },
};
