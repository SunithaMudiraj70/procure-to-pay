/**
 * Centralized query key factory for React Query.
 * All queries and invalidations MUST use these keys.
 */
export const queryKeys = {
  lookups: {
    all: ['lookups'],
    users: ['lookups', 'users']
  },
  dashboard: {
    summary: (from, to) => ['reports', 'summary', { from, to }],
    kpis: ['dashboard', 'kpis'],
    spendByDept: ['dashboard', 'spend-by-dept'],
    pipeline: ['dashboard', 'pipeline']
  },
  requests: {
    all: (filters) => ['requests', filters || {}],
    detail: (id) => ['requests', 'detail', id],
    preview: (params) => ['requests', 'preview', params || {}],
    audit: (id) => ['requests', 'audit', id]
  },
  rfqs: {
    all: (filters) => ['rfqs', filters || {}],
    detail: (id) => ['rfqs', 'detail', id],
    comparison: (id) => ['rfqs', 'comparison', id]
  },
  approvals: {
    all: (filters) => ['approvals', filters || {}]
  },
  purchaseOrders: {
    all: (filters) => ['purchase-orders', filters || {}],
    detail: (id) => ['purchase-orders', 'detail', id]
  },
  deliveries: {
    all: (filters) => ['deliveries', filters || {}]
  },
  suppliers: {
    all: (filters) => ['suppliers', filters || {}],
    detail: (id) => ['suppliers', 'detail', id]
  },
  budgets: {
    all: (filters) => ['budgets', filters || {}],
    detail: (id) => ['budgets', 'detail', id]
  },
  exceptions: {
    all: (filters) => ['exceptions', filters || {}],
    violations: (filters) => ['violations', filters || {}]
  },
  reports: {
    summary: (from, to) => ['reports', 'summary', { from, to }]
  }
};

export default queryKeys;
