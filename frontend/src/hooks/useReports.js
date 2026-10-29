import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';
import { useUiStore } from '../store/useUiStore.js';

export const useReportsSummaryQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.reports.summary(filters.from, filters.to),
    queryFn: () => api.get('/reports/summary', filters)
  });
};

export const useExportCsvMutation = () => {
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: async (type) => {
      const blob = await api.download('/reports/export', { type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      return type;
    },
    onSuccess: (type) => {
      addToast({
        type: 'success',
        title: 'Export Downloaded',
        message: `${type.toUpperCase()} report CSV downloaded successfully.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: err.message
      });
    }
  });
};
