
const HOME_FOR_ROLE = {
  employee: '/employee/dashboard.html',
  manager: '/manager/dashboard.html',
  admin: '/admin/dashboard.html',
};

async function login(companySlug, email, password) {
  const result = await api.post('/api/auth/login', { companySlug, email, password });
  api.setSession(result.data.token, result.data.user);
  return result.data.user;
}

function logout() {
  api.clear();
  window.location.href = '/index.html';
}

function homeFor(role) {
  return HOME_FOR_ROLE[role] || '/employee/dashboard.html';
}


function requireRole(...allowedRoles) {
  const user = api.user();
  if (!api.token() || !user) {
    window.location.href = '/index.html';
    return null;
  }
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    window.location.href = homeFor(user.role);
    return null;
  }
  return user;
}
