import { useQuery } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';

export const useBudgetsQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.budgets.all(filters),
    queryFn: () => api.get('/budgets', filters)
  });
};
