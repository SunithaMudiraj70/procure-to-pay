import { useQuery } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';

export const useDashboardKpisQuery = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.kpis,
    queryFn: () => api.get('/dashboard/kpis')
  });
};

export const useDashboardSpendByDeptQuery = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.spendByDept,
    queryFn: () => api.get('/dashboard/spend-by-dept')
  });
};

export const useDashboardPipelineQuery = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.pipeline,
    queryFn: () => api.get('/dashboard/pipeline')
  });
};
