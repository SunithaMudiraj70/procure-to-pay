import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api.js';
import queryKeys from '../lib/queryKeys.js';
import { useUiStore } from '../store/useUiStore.js';

export const usePurchaseOrdersQuery = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.all(filters),
    queryFn: () => api.get('/purchase-orders', filters)
  });
};

export const usePurchaseOrderDetailQuery = (poId) => {
  return useQuery({
    queryKey: queryKeys.purchaseOrders.detail(poId),
    queryFn: () => api.get(`/purchase-orders/${poId}`),
    enabled: Boolean(poId)
  });
};

export const useRecordDeliveryMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ poId, body }) => api.post(`/purchase-orders/${poId}/deliveries`, body),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(variables.poId) });
      addToast({
        type: 'success',
        title: 'Delivery Recorded',
        message: `Delivery ${data.delivery_id} logged. Status: ${data.status}`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Delivery Recording Failed',
        message: err.message
      });
    }
  });
};

export const useCancelPoMutation = () => {
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  return useMutation({
    mutationFn: ({ poId, reason }) => api.post(`/purchase-orders/${poId}/cancel`, { reason }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.lookups.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.detail(variables.poId) });
      addToast({
        type: 'warning',
        title: 'PO Cancelled',
        message: `Purchase order ${variables.poId} cancelled. Funds released.`
      });
    },
    onError: (err) => {
      addToast({
        type: 'error',
        title: 'Cancellation Failed',
        message: err.message
      });
    }
  });
};
