import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';
import { useUiStore } from '../store/useUiStore.js';

export const useSuppliersQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.suppliers.all(filters),
    queryFn: () => api.get('/suppliers', filters)
  });
};

export const useCreateSupplierMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: (payload) => api.post('/suppliers', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
      addToast({
        type: 'success',
        title: 'Supplier Added',
        message: `Supplier ${data.name} (${data.supplier_code}) successfully created.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Creation Failed',
        message: err.message || 'Failed to create supplier'
      });
    }
  });
};
