
function buildPagination(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
function buildSort(query, allowedColumns, defaultSort) {
  const raw = query.sort || defaultSort;
  const [column, direction] = raw.split(':');

  if (!allowedColumns.includes(column)) {
    const err = new Error(`Geçersiz sort kolonu: '${column}'. İzin verilenler: ${allowedColumns.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const dir = (direction || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return `${column} ${dir}`;
}

function buildMeta(total, page, limit) {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}

module.exports = { buildPagination, buildSort, buildMeta };
