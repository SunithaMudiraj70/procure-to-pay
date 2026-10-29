export const getPaginationParams = (query, defaultPageSize = 10, maxPageSize = 100) => {
  const page = Math.max(1, parseInt(query?.page || 1, 10));
  const requestedSize = parseInt(query?.pageSize || defaultPageSize, 10);
  const pageSize = Math.min(maxPageSize, Math.max(1, requestedSize));
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
};

export const formatPaginatedResponse = (data, total, page, pageSize) => {
  return {
    data: data || [],
    page,
    pageSize,
    total: parseInt(total || 0, 10)
  };
};
